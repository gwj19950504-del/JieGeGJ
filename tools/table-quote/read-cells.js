// Read the actual cell contents after QuoteGrid has found the lines. Full-page OCR
// commonly drops isolated numbers surrounded by rules. Never fill them from a catalog.
(() => {
    'use strict';
    function makeCanvas(w,h) {const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function cleanCell(source, x0,x1,y0,y1) {
        const gap=Math.max(3,Math.round(source.width/650));
        const w=Math.round(x1-x0)-gap*2,h=Math.round(y1-y0)-gap*2;
        if(w<2||h<2)return null;
        const cell=makeCanvas(w,h),ctx=cell.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(source,x0+gap,y0+gap,w,h,0,0,w,h);
        const pix=ctx.getImageData(0,0,w,h),d=pix.data;
        let lo=w,hi=-1,top=h,bottom=-1;
        const lineCount=new Uint16Array(h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const off=(y*w+x)*4, v=.28*d[off]+.57*d[off+1]+.15*d[off+2];
            const ink=v<180;
            d[off]=d[off+1]=d[off+2]=ink?0:255;d[off+3]=255;
            if(ink){lo=Math.min(x,lo);hi=Math.max(x,hi);top=Math.min(y,top);bottom=y;lineCount[y]++;}
        }
        if(hi-lo<1||bottom-top<2)return null;
        ctx.putImageData(pix,0,0);
        const lines=[];
        for(let y=top;y<=bottom;y++)if(lineCount[y]>=1){
            const prev=lines.at(-1);
            if(!prev||y-prev[1]>Math.max(3,Math.round(source.width/1100)))lines.push([y,y]);else prev[1]=y;
        }
        return {cell,lo,hi,top,bottom,lines};
    }
    function wordLines(words) {
        const rows=[];
        for(const word of [...words].sort((a,b)=>(a.y0+a.y1)-(b.y0+b.y1))){
            const cy=(word.y0+word.y1)/2,h=word.y1-word.y0;
            const row=rows.find(line=>Math.abs(cy-line.y)<Math.max(h,line.height)*.65);
            if(row){row.words.push(word);row.y0=Math.min(row.y0,word.y0);row.y1=Math.max(row.y1,word.y1);}
            else rows.push({y:cy,y0:word.y0,y1:word.y1,height:h,words:[word]});
        }
        return rows.map(row=>({...row,text:row.words.sort((a,b)=>a.x0-b.x0).map(word=>word.text.trim()).join('')}));
    }
    function groupedText(words) {
        return wordLines(words).map(row=>row.text).join('\n');
    }
    function stripLegacyNameSubtitle(words) {
        const lines=wordLines(words);
        const isSubtitle=text=>{
            const compact=String(text||'').replace(/\s/g,'');
            return /^(?:产品\d+[·•|,，'’‘、.。:：_-]*)?发货仓(?:(?::|：).*)?$/.test(compact)
                || /^产品\d+[·•|,，'’‘、.。:：_-]*(?:同仓发货|分仓发货|异仓发货)$/.test(compact);
        };
        let kept=lines.length;
        while(kept>0&&isSubtitle(lines[kept-1].text))kept--;
        return {lines:lines.slice(0,kept),removed:kept<lines.length};
    }
    async function refine(file, data, recognize, progress) {
        if(!data.geometry || !data.rows.length)return data;
        const image=new Image(),url=URL.createObjectURL(file);
        try{
            image.src=url;await image.decode();
            const source=makeCanvas(image.naturalWidth,image.naturalHeight);
            source.getContext('2d').drawImage(image,0,0);
            const {columns,bounds}=data.geometry,rows=data.rows;
            const get=(r,a,b=a+1)=>cleanCell(source,columns[a],columns[b],...bounds[r]);
            data.labelArt={};
            const retries = [];
            const nameArtworkLimits=new Map(),labelCells=new Map();
            const averageConfidence = words => words.reduce((sum, word) => sum + word.confidence, 0) / Math.max(words.length, 1);
            function withoutLegacyCaption(cell, words) {
                if(cell.lines.length<2)return null;
                const previous=cell.lines.at(-2),last=cell.lines.at(-1);
                const mainHeight=previous[1]-previous[0]+1, smallHeight=last[1]-last[0]+1;
                if(smallHeight>mainHeight*.9 || last[0]-previous[1]<mainHeight*.25)return null;
                // A damaged caption can OCR as “产品2，RH”. Require both the smaller,
                // separated bottom band and an actual legacy marker before clipping.
                const text=(wordLines(words).at(-1)?.text || '').replace(/\s/g,'');
                if(!/产品\d+[·•|,，'’‘、.。:：_-]|(?:同仓发货|异仓发货|分仓发货|发货仓[:：])/.test(text))return null;
                return {...cell,bottom:previous[1],lines:cell.lines.slice(0,-1)};
            }
            function rememberNameArtworkLimit(r,cell,originTop,scale,pad,result){
                if(!result.removed)return;
                const last=result.lines.at(-1);
                nameArtworkLimits.set(r,last?Math.min(cell.bottom,Math.ceil(originTop+(last.y1+2-pad)/scale)):null);
            }
            function originalLettering(cell,r,c,bottomLimit){
                if(!cell||bottomLimit===null)return '';
                const gap=Math.max(3,Math.round(source.width/650)),w=cell.hi-cell.lo+1;
                const bottom=bottomLimit===undefined?cell.bottom:Math.min(cell.bottom,Math.floor(bottomLimit));
                const h=bottom-cell.top+1;
                if(h<1)return '';
                const crop=makeCanvas(w,h);
                crop.getContext('2d').drawImage(source,columns[c]+gap+cell.lo,bounds[r][0]+gap+cell.top,w,h,0,0,w,h);
                return crop.toDataURL('image/png');
            }
            let tasks=0;
            async function read(cell,kind='text',target){
                if(!cell)return '';
                if(progress?.('正在逐格核对文字和金额 · '+(++tasks))===false)throw Error('已取消识别');
                const {lo,hi,top}=cell;
                let bottom=cell.bottom;
                const numeric=kind==='num'||kind==='thick';
                if(numeric)bottom=cell.lines.find(line=>line[1]-line[0]>=4)?.[1] ?? bottom;
                const lineHeight=cell.lines[0][1]-cell.lines[0][0]+1;
                const scale=Math.min(3,Math.max(.75,43/Math.max(12,lineHeight)));
                const w=hi-lo+1,h=Math.max(1,bottom-top+1),pad=16;
                const canvas=makeCanvas(Math.ceil(w*scale)+pad*2,Math.ceil(h*scale)+pad*2),ctx=canvas.getContext('2d');
                ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(cell.cell,lo,top,w,h,pad,pad,w*scale,h*scale);
                const options={psm:numeric||cell.lines.length<2?'7':'6'};
                if(numeric)options.whitelist=kind==='thick'?'0123456789.-~':'0123456789.,';
                const words = await recognize(canvas,options);
                const productNameTarget=target?.[0]>=6&&target?.[1]===1;
                if(productNameTarget&&kind!=='name-body'){
                    const clipped=withoutLegacyCaption(cell,words);
                    if(clipped){
                        nameArtworkLimits.set(target[0],clipped.bottom);
                        return read(clipped,'name-body',target);
                    }
                }
                const nameLines=productNameTarget?stripLegacyNameSubtitle(words):null;
                const text = nameLines?nameLines.lines.map(line=>line.text).join('\n'):groupedText(words);
                if(productNameTarget)rememberNameArtworkLimit(target[0],cell,top,scale,pad,nameLines);
                if (target && /[A-Za-z]{2}/.test(text)) {
                    retries.push({cell, target, text, confidence:averageConfidence(words)});
                }
                return numeric?text.replace(/\s/g,''):text;
            }
            const labels=[['客户信息','发货单位'],['收货地址','业务经理'],['运费明细','订货日期']];
            for(let r=1;r<=3;r++){
                rows[r]=[labels[r-1][0],await read(get(r,1,6),'text',r===3?[r,1]:null),labels[r-1][1],await read(get(r,7,12))];
            }
            const normalizeHeader=name=>(/平方|平米|㎡|m[²2]/i.test(name)?'/㎡':/(?:\/|每|元)片/.test(name)?'/片':'');
            rows[4][8]='原价'+normalizeHeader(rows[4][8]); rows[4][9]='优惠价'+normalizeHeader(rows[4][9]);
            const grouped=(data.geometry.groups||[]).filter(group=>group.subtotalBounds);
            const sourceRows=new Map((data.geometry.sourceRows||[]).map(row=>[row.outputRow,row]));
            const firstProducts=new Map(), seenGroups=new Set(), groupNames=new Map(), groupAmounts=new Map();let productNumber=0;
            for(const group of grouped) {
                const label=(await read(cleanCell(source,columns[0],columns[10],...group.subtotalBounds))).replace(/\s+/g,'');
                const labelName=label.match(/小计\d+[·•:：](.{1,30})$/)?.[1];
                groupNames.set(group.index,labelName || '仓'+group.index);
                const original=await read(cleanCell(source,columns[10],columns[11],...group.subtotalBounds),'num');
                groupAmounts.set(group.index,{original,actual:0});
            }
            if(grouped.length>1){rows[4][8]='原价';rows[4][9]='优惠价';}
            for(let r=6;r<rows.length;r++){
                if(!bounds[r])continue;
                if(r===rows.length-1){
                    rows[r]=['总价（按优惠价核算）',await read(get(r,10),'num')];
                    const note = await read(get(r,11));
                    if (note) rows[0].push('补充说明',note);
                    continue;
                }
                const cells=rows[r], name=get(r,1), qty=get(r,6), pWidth=get(r,2);
                const groupNumber=sourceRows.get(r)?.group;
                if(name||qty||pWidth){
                    const category=get(r,0);
                    const displayWidth=cell=>cell?(cell.hi-cell.lo+1)*1280/source.width:0;
                    cells[0]=await read(category,'text',[r,0]);
                    cells[1]=await read(name,'text',[r,1]);
                    labelCells.set(r,{name,category,nameWidth:displayWidth(name),categoryWidth:displayWidth(category)});
                    productNumber++;
                    if(grouped.length>1 && groupNumber){
                        if(!firstProducts.has(groupNumber))firstProducts.set(groupNumber, productNumber);
                        seenGroups.add(groupNumber);
                        if(cells[1].trim())cells[1]+='\n产品'+productNumber+' · '+(groupNames.get(groupNumber)||'仓'+groupNumber);
                    }
                    for(const col of [2,3,4,6,7,8,9,10]){
                        cells[col]=await read(get(r,col),col===4?'thick':'num');
                    }
                    // The printed area has two decimal places immediately followed by a tiny m².
                    // Only trim OCR's extra unit glyphs when the numeric prefix agrees with
                    // width × length × pieces independently; never overwrite a disagreeing value.
                    const area=(Number(cells[2])*Number(cells[3])*Number(cells[6])/1e6).toFixed(2);
                    if(Number(area)>0 && cells[7].startsWith(area) && /^[.2]*$/.test(cells[7].slice(area.length))) cells[7]=area;
                    if(groupAmounts.has(groupNumber))groupAmounts.get(groupNumber).actual+=Number(cells[10])||0;
                    // The colour/model column is photo-only; an empty cell has no text fallback.
                    cells[5]='';
                    cells[11]=await read(get(r,11));
                }else{
                    // The amount column may say 到付 or 货拉拉到付 instead of a number.
                    const rawLabel=await read(get(r,9)), amountCell=get(r,10);
                    const rawAmount=await read(amountCell), clean=rawAmount.replace(/\s/g,'');
                    const amount=/付|货拉拉/.test(clean)?clean:await read(amountCell,'num');
                    let key=rawLabel.replace(/\s/g,'');
                    if(!/木箱|运费|加工|辅料|税金/.test(key)){
                        const note=(String(cells[11] || '') + ' ' + await read(get(r,11))).replace(/\s/g,'');
                        if(note.includes('箱')&&note.includes('包')) key='木箱费';
                        else if(note.includes('先验货')&&note.includes('签收')) key='运费';
                    }
                    const groupLabel=grouped.length>1 && firstProducts.has(groupNumber) && /木箱|运费/.test(key)
                        ? '产品'+firstProducts.get(groupNumber)+' · ' : '';
                    if(groupLabel) key=key.replace(/\d+$/,'');
                    if(groupLabel && groupAmounts.has(groupNumber))groupAmounts.get(groupNumber).actual+=Number(amount)||0;
                    rows[r]=Array(12).fill('');
                    rows[r][9]=groupLabel+key;rows[r][10]=amount;
                }
            }
            if(grouped.length>1 && seenGroups.size!==grouped.length)throw Error('分仓数量与已识别产品不一致，未导入不完整的报价。');
            // A Latin-language pass sometimes reads an entire Chinese label as uppercase letters.
            // Keep real model codes; retry doubtful text only, using the original antialiased glyphs.
            if (retries.length && recognize.useChinese) {
                await recognize.useChinese();
                for (const {cell, target:[r,c], text, confidence} of retries) {
                    if (progress?.('正在核对原图中文字') === false) throw Error('已取消识别');
                    const gap = Math.max(3,Math.round(source.width/650));
                    const w = cell.hi-cell.lo+1, h = cell.bottom-cell.top+1, padding = 12;
                    const crop = makeCanvas(w+2*padding, h+2*padding), context = crop.getContext('2d');
                    context.fillStyle = 'white'; context.fillRect(0,0,crop.width,crop.height);
                    context.drawImage(source,columns[c]+gap+cell.lo,bounds[r][0]+gap+cell.top,w,h,padding,padding,w,h);
                    const han = value => (value.match(/\p{Script=Han}/gu)||[]).length;
                    const options = {psm:cell.lines.length>1?6:7};
                    for (const factor of [1,2]) {
                        const sample = factor === 1 ? crop : makeCanvas(crop.width*factor,crop.height*factor);
                        if (factor !== 1) sample.getContext('2d').drawImage(crop,0,0,sample.width,sample.height);
                        const words = await recognize(sample,options), productNameTarget=r>=6&&c===1;
                        const nameLines=productNameTarget?stripLegacyNameSubtitle(words):null;
                        const chinese = nameLines?nameLines.lines.map(line=>line.text).join('\n'):groupedText(words);
                        const annotationOnly=productNameTarget&&nameLines.removed&&!nameLines.lines.length;
                        if ((han(chinese) >= Math.max(2,han(text)+1) || annotationOnly) && averageConfidence(words) > confidence) {
                            if(productNameTarget)rememberNameArtworkLimit(r,cell,cell.top,factor,padding*factor,nameLines);
                            rows[r][c] = chinese + rows[r][c].slice(text.length);
                            break;
                        }
                    }
                }
            }
            for(const [r,item] of labelCells){
                const limit=nameArtworkLimits.has(r)?nameArtworkLimits.get(r):undefined;
                data.labelArt[r]={name:originalLettering(item.name,r,1,limit),category:originalLettering(item.category,r,0),nameWidth:item.nameWidth,categoryWidth:item.categoryWidth};
            }
            for(const [groupNumber,item] of groupAmounts)if(!item.original || Math.abs(Number(item.original)-item.actual)>.01)
                data.warnings.push('第 '+groupNumber+' 仓原图小计与识别明细未能核对一致，请逐仓确认后再出图。');
            // Stage two re-reads every number. Do not repeat first-pass warnings for
            // the discarded text; still require explicit image review in the UI.
            data.warnings=(data.warnings||[]).filter(message=>!/置信度较低|抬头第|单位未从表头|总价金额未识别|总价行文字/.test(message));
            return data;
        } finally{URL.revokeObjectURL(url);}
    }
    window.QuoteCellOCR={refine};
})();
