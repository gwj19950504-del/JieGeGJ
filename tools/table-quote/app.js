(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const all = (selector, root = document) => [...root.querySelectorAll(selector)];
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    const quickSizes = [[1200,600,6],[1220,2440,6],[1220,3050,6],[1200,2440,2],[1200,3000,2]];
    const dateNow = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
    const newProduct = () => ({ category:'', name:'', width:'', height:'', thickness:'', qty:'', original:'', price:'',
        mode:'area', model:'', note:'', image:'', warehouse:'', box:'', freight:'' });
    const fresh = () => ({ customer:'', address:'', date:dateNow(), shipper:'M&M新材', manager:'苗苗18721378741',
        delivery:'送货上门（不含上楼，不含卸货和搬运）', multi:false, different:false, box:'300', freight:'', processing:'0', auxiliary:'0',
        tax:'', autoTax:false, rate:'10', rateChoice:'10', lalamove:false, extraNote:'', products:[newProduct()] });
    let state = fresh(), dirty = false, zoom = false, currentBlobUrl = '', pendingFiles = 0;
    let beforeRestore = null;
    let toastTimer, imageIds = new WeakMap();
    let revision = 0, rasterJob = null, rasterTimer, liveUrl = '', collapsed = false;
    const activeProducts = () => state.multi ? state.products : state.products.slice(0,1);
    const payload = () => ({...state, products:activeProducts(), different: state.multi && state.different});
    const calc = () => window.QuoteMath.calculate(payload());
    function notify(text) { $('message').textContent = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('message').textContent = '', 4500); }
    function numField(key, title, p, options='') {
        return '<label>'+title+'<input type="number" data-p="'+key+'" min="0" step="'+(key==='qty'?'1':'any')+'" value="'+escape(p[key])+'" '+options+'></label>';
    }
    function textField(key,title,p,cls='',opts='') {
        const original = p.labelArt?.[key];
        const input = '<input data-p="'+key+'" value="'+escape(p[key])+'" '+opts+'>';
        if (!original) return '<label class="'+cls+'">'+title+input+'</label>';
        return '<label class="'+cls+'">'+title+' <small>原图字样 · 点框可改</small><span class="ocr-label-field">'+input
            +'<span aria-hidden="true"><img alt="" src="'+escape(original)+'"></span></span></label>';
    }
    function photoField(product,index) {
        const label = '产品'+(index+1)+'颜色／型号图片';
        return '<div class="photo-field"><div>颜色 / 型号 <small>图片选填</small></div><div class="photo-controls">'
            +'<label class="drop">'+(product.image?'<img src="'+escape(product.image)+'" alt="">':'')
            +'<span>'+(product.image?'更换图片':'＋ 添加图片')+'</span><input type="file" accept="image/*" aria-label="'+label+'"></label>'
            +(product.image?'<button type="button" data-action="rmPhoto" aria-label="移除'+label+'">移除</button>':'')
            +'</div></div>';
    }
    function card(p,index) {
        const unit = p.mode==='area'?'㎡':'片';
        return '<article class="prod" data-index="'+index+'"><div class="prod-head"><strong>产品 '+String(index+1).padStart(2,'0')+'</strong>'
            +(state.multi && state.products.length>2?'<button data-action="remove">移除本项</button>':'')+'</div><div class="prod-fields">'
            +textField('category','产品类目',p,'','list="categories" placeholder="如：鎏金板"')+textField('name','产品名称',p,'span2','placeholder="填写产品或款式全称"')
            +photoField(p,index)
            +'<label class="span2">快捷规格<select data-preset><option value="">自填尺寸</option>'+quickSizes.map(a=>'<option value="'+a.join()+'" '+(a.join()===[p.width,p.height,p.thickness].join()?'selected':'')+'>'+a.join(' × ')+' mm</option>').join('')+'</select></label>'
            +numField('width','宽度（mm）',p)+numField('height','高度 / 长度（mm）',p)+textField('thickness','厚度（mm）',p,'','placeholder="如 2 或 2-3"')
            +'<div class="mode-cap">计价方式<div class="segment">'+['area','piece'].map(m=>'<button data-mode="'+m+'" aria-pressed="'+(m===p.mode)+'">'+(m==='area'?'按平方':'按片')+'</button>').join('')+'</div></div>'
            +numField('qty','数量（片）',p)+(payload().different?textField('warehouse','发货仓 <small>选填</small>',p,'','placeholder="仓库名称"'):'')
            +numField('original','原价（元/<span data-unit>'+unit+'</span>）',p,'placeholder="选填"')
            +numField('price','优惠价（元/<span data-unit>'+unit+'</span>）',p)
            +'<label class="span2">产品备注<textarea data-p="note" rows="1" placeholder="如色差提示、使用说明">'+escape(p.note)+'</textarea></label>'
            +(payload().different?numField('box','本项木箱费（元）',p,state.lalamove?'disabled':'')+numField('freight','本项运费（元）',p,state.lalamove?'disabled':'placeholder="空白为到付"'):'')
            +'</div><div class="photo-line"><span class="row-amount"></span></div></article>';
    }
    function loadInputs() {
        if(state.lalamove){
            if(payload().different)activeProducts().forEach(p=>{p.box='0';p.freight='';});
            else {state.box='0';state.freight='';}
        }
        all('[data-top]').forEach(el => { const val=state[el.dataset.top]; if(el.type==='checkbox') el.checked=val; else el.value=val; });
        $('multi').checked=state.multi; $('shipment').value=state.different?'different':'same'; $('rateChoice').value=state.rateChoice;
        drawProducts(); update();
    }
    function drawProducts() { $('products').innerHTML=activeProducts().map(card).join(''); }
    function issue() {
        if (pendingFiles) return ['请等待产品图片读取完成。', null];
        if (!state.date) return ['请填写订货日期。', '[data-top="date"]'];
        for (const el of all('#editor input[type=number]')) {
            if (!el.disabled && el.getClientRects().length && !el.validity.valid)
                return ['请检查「'+el.parentElement.textContent.trim()+'」：数量须为整数，金额和尺寸不能为负数。', el];
        }
        for (const [i,p] of activeProducts().entries()) {
            const target=k=>'[data-index="'+i+'"] [data-p="'+k+'"]', msg='产品 '+(i+1)+'：';
            if(!p.name.trim()) return [msg+'请填写产品名称。',target('name')];
            if(p.thickness && !window.QuotePicture.validThickness(p.thickness))return [msg+'厚度请填毫米数或递增范围，例如 2-3。',target('thickness')];
            if(!(Number(p.qty)>0 && Number.isInteger(+p.qty)))return [msg+'请填写有效片数。',target('qty')];
            if(p.mode==='area' && !(+p.width>0&&+p.height>0))return [msg+'按平方计价需要填写宽度和高度。',target(+p.width>0?'height':'width')];
            if(String(p.price).trim()==='' || +p.price<0)return [msg+'请填写优惠价。',target('price')];
        }
        if(state.autoTax && state.rateChoice==='custom' && !Number(state.tax) && (state.rate==='' || +state.rate<0 || +state.rate>100))
            return ['请填写 0 至 100 之间的自定义税率。','[data-top="rate"]'];
        return null;
    }
    function update(){
        const data=payload(), result=calc();
        $('warehouseBar').hidden=!state.multi; $('addProduct').hidden=!state.multi;
        $('warehouseHint').textContent=data.different?'同名仓的产品合为一段，各项木箱和运费按仓汇总，同一笔费用只填一次。不填仓名时每项单列一仓。':'整单只计一次木箱与运费。';
        all('.shared').forEach(label=>{label.hidden=data.different; label.querySelector('input').disabled=state.lalamove||data.different;});
        $('rateBox').hidden=!state.autoTax; $('customRateWrap').hidden=state.rateChoice!=='custom'; 
        all('.row-amount').forEach((el,i)=>{const p=result.rows[i];el.textContent='面积 '+money(p.area)+' ㎡　·　材料 ¥'+money(p.amount);});
        const hasPrice=data.products.some(p=>p.price!=='' && +p.qty>0);
        $('totalValue').textContent=hasPrice?'¥ '+money(result.total):'—';
        $('totalDetail').textContent='材料 '+money(result.material)+'　木箱 '+money(result.box)+'　运费 '+(result.hasFreight?money(result.freight):'到付')+'　税金 '+money(result.tax);
        renderSheet();
    }
    function renderSheet(){
        const result=calc(); window.renderQuoteSheet($('paper'),payload(),result);
        for (const row of all('.quote-sheet__product-row',$('paper'))) {
            const product=activeProducts()[+row.querySelector('[data-photo-index]').dataset.photoIndex];
            for(const [index,key] of ['category','name'].entries())if(product?.labelArt?.[key]){
                const img=document.createElement('img'); img.className='quote-original-lettering';img.dataset.lettering=key;
                img.alt=product[key]||'原图字样';img.src=product.labelArt[key];img.style.width=product.labelArt[key+'Width']+'px';row.cells[index].replaceChildren(img);
            }
        }
        all('[data-photo-index]', $('paper')).forEach(cell=>{cell.tabIndex=0;cell.title='点选或拖入产品图片';cell.setAttribute('aria-label','为产品 '+(+cell.dataset.photoIndex+1)+' 添加或更换图片');});
        const err=issue(); $('sheetInfo').textContent=err?'草稿 · '+err[0]:activeProducts().length+' 项产品　·　合计 ¥ '+money(result.total);
        revision++; rasterJob = null; clearTimeout(rasterTimer);
        $('liveImage').hidden=true;
        fit(); followInput();
        queueRaster();
    }
    function imageForCurrentQuote(){
        if(rasterJob && rasterJob.version===revision) return rasterJob.promise;
        const sheet=$('paper').firstElementChild, version=revision;
        const promise=window.quoteSheetPng(sheet).then(blob=>{
            if(!blob || blob.type!=='image/png' || !blob.size) throw Error('没有生成完整报价图片');
            if(version===revision){
                const previous=liveUrl; liveUrl=URL.createObjectURL(blob);
                const img=$('liveImage');img.src=liveUrl;img.hidden=false;
                if(previous)URL.revokeObjectURL(previous);
            }
            return blob;
        }).catch(err=>{if(version===revision)rasterJob=null;throw err;});
        rasterJob={version,promise};return promise;
    }
    function queueRaster(){
        clearTimeout(rasterTimer);
        if(!collapsed && !document.hidden) rasterTimer=setTimeout(()=>imageForCurrentQuote().catch(()=>{}),550);
    }
    function followInput(){
        const el=document.activeElement, stage=$('stage');
        if(collapsed||zoom||!el||!$('editor').contains(el)||stage.scrollHeight<=stage.clientHeight)return;
        const product=el.closest('.prod');let target=null;
        if(product)target=$('paper').querySelector('[data-photo-index="'+product.dataset.index+'"]')?.closest('tr');
        else if(el.dataset.top)target=$('paper').querySelector(
            ['customer','address','date','manager','shipper','delivery'].includes(el.dataset.top)?'thead':'.quote-sheet__total-row');
        if(!target)return;
        const a=target.getBoundingClientRect(), b=stage.getBoundingClientRect();
        if(a.top<b.top||a.bottom>b.bottom)stage.scrollTop+=a.top-b.top-Math.max(0,(stage.clientHeight-a.height)/2);
    }
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRaster();});
    $('editor').addEventListener('focusin',()=>requestAnimationFrame(followInput));
    function fit(){
        if(collapsed)return;
        const w=1280;const s=zoom?1:Math.min(1,($('stage').clientWidth-2)/w);
        $('paper').style.transform='scale('+s+')'; $('scaled').style.width=(w*s)+'px';
        $('scaled').style.height=Math.ceil($('paper').offsetHeight*s)+'px';
    }
    function previewState(){
        $('stage').hidden=collapsed;
        $('collapsePreview').setAttribute('aria-expanded',String(!collapsed));
        $('collapsePreview').textContent=collapsed?'展开':'收起';
        $('collapsePreview').hidden=zoom;
        $('zoom').setAttribute('aria-expanded',String(zoom));$('zoom').textContent=zoom?'返回编辑':'放大';
        $('preview').classList.toggle('expanded',zoom);
        $('editor').inert=zoom;
        fit();queueRaster();
    }
    function validForExport(){
        const err=issue();
        if(!err)return true;
        if(zoom){zoom=false;previewState();}
        notify(err[0]);const node=typeof err[1]==='string'?document.querySelector(err[1]):err[1]; node?.focus();return false;
    }
    async function readPhoto(file,prod){
        if(!file)return;
        if(file.size>30*1024*1024){notify('图片超过 30 MB，请选较小的图片。');return;}
        const token={};imageIds.set(prod,token);pendingFiles++; const url=URL.createObjectURL(file);
        try {
            const picture=new Image();picture.src=url;await picture.decode();
            const scale=Math.min(1,1200/Math.max(picture.naturalWidth,picture.naturalHeight));const c=document.createElement('canvas');
            c.width=Math.max(1,Math.round(picture.naturalWidth*scale));c.height=Math.max(1,Math.round(picture.naturalHeight*scale));
            const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(picture,0,0,c.width,c.height);
            if(imageIds.get(prod)!==token||!state.products.includes(prod))return;
            prod.image=c.toDataURL('image/jpeg',.90);dirty=true;drawProducts();notify('图片已放入对应产品的「颜色/型号」栏。');
        }catch{notify('无法读取这张图片，请选用 JPG、PNG 或手机可预览的照片。');}
        finally{pendingFiles--;URL.revokeObjectURL(url);update();}
    }
    function reset(mode){
        if(dirty&&!confirm('这会替换正在填写的报价，继续吗？'))return;
        beforeRestore=null;$('restoreUndo').hidden=true;
        state=fresh();dirty=false;zoom=false;
        if(mode==='warehouses'){
            state.multi=true;state.different=true;state.visitedDifferent=true;
            state.products=[{category:'鎏金板',name:'软质板示例',width:'1200',height:'2440',thickness:'2-3',qty:'27',original:'120',price:'90'},
                {category:'柔岩板',name:'柔岩板示例',width:'1200',height:'3000',thickness:'3-4',qty:'17',original:'130',price:'100'}]
                .map(values=>({...newProduct(),...values,mode:'area',box:'300',freight:''}));
        }else if(mode){
            const area=mode==='area';
            Object.assign(state.products[0],{category:area?'鎏金板':'陨石板',name:area?'软质板示例':'定制板示例',
                width:'1200',height:area?'2440':'600',thickness:area?'2':'6',qty:area?'5':'6',mode,
                original:'150',price:'130'});
            state.box=area?'300':'0';state.freight=area?'350':'';
        }
        collapsed=false;previewState();loadInputs();$('stage').scrollTop=0;window.scrollTo({top:0});
    }
    $('example').onchange=e=>{const mode=e.target.value;e.target.value='';if(mode)reset(mode);};
    $('clear').onclick=()=>reset(null);
    $('collapsePreview').onclick=()=>{collapsed=!collapsed;previewState();};
    $('zoom').onclick=()=>{zoom=!zoom;collapsed=false;previewState();};
    window.addEventListener('keydown',event=>{if(zoom && event.key==='Escape' && !$('saveDialog').open){zoom=false;previewState();$('zoom').focus();}});
    $('multi').onchange=e=>{
        if(!e.target.checked && state.different){state.box=state.products[0].box;state.freight=state.products[0].freight;}
        if(e.target.checked && state.different){state.products[0].box=state.box;state.products[0].freight=state.freight;}
        state.multi=e.target.checked;if(state.multi&&state.products.length===1)state.products.push(newProduct());
        dirty=true;loadInputs();
    };
    $('shipment').onchange=e=>{
        const next=e.target.value==='different';
        if(next && !state.visitedDifferent){state.products[0].box=state.box;state.products[0].freight=state.freight;state.visitedDifferent=true;}
        state.different=next;dirty=true;loadInputs();
    };
    $('addProduct').onclick=()=>{state.products.push(newProduct());dirty=true;drawProducts();update();all('.prod').at(-1).querySelector('[data-p=name]').focus();};
    $('rateChoice').onchange=e=>{state.rateChoice=e.target.value;state.rate=e.target.value==='custom'?'':e.target.value;dirty=true;loadInputs();};
    $('editor').addEventListener('input',e=>{
        const el=e.target;const key=el.dataset.top;
        if(key){
            state[key]=el.type==='checkbox'?el.checked:el.value;dirty=true;
            if(key==='lalamove'){
                if(state.lalamove){if(payload().different)activeProducts().forEach(p=>{p.box='0';p.freight='';});else{state.box='0';state.freight='';}}
                loadInputs();
            } else update();return;
        }
        const c=el.closest('.prod'); if(!c||!el.dataset.p)return;
        const p=state.products[+c.dataset.index]; p[el.dataset.p]=el.value;dirty=true;
        if(p.labelArt&&['category','name'].includes(el.dataset.p)){
            delete p.labelArt[el.dataset.p];
            const field = el.closest('.ocr-label-field');
            if (field) {field.closest('label')?.querySelector('small')?.remove();field.querySelector('span')?.remove();field.classList.remove('ocr-label-field');}
        }
        if(['width','height','thickness'].includes(el.dataset.p)){c.querySelector('[data-preset]').value=[p.width,p.height,p.thickness].join();}update();
    });
    $('products').addEventListener('click',e=>{
        const btn=e.target.closest('button');if(!btn)return;
        const el=btn.closest('.prod'),i=+el.dataset.index,p=state.products[i];const action=btn.dataset.action;
        if(btn.dataset.mode)p.mode=btn.dataset.mode;
        else if(action==='rmPhoto'){imageIds.delete(p);p.image='';}
        else if(action==='remove'){if((p.name||p.qty||p.image)&&!confirm('移除本项产品？'))return;state.products.splice(i,1);}
        else return;dirty=true;drawProducts();update();
    });
    $('products').addEventListener('change',e=>{
        const el=e.target,p=state.products[+el.closest('.prod').dataset.index];
        if(el.type==='file')readPhoto(el.files[0],p);
        if(el.hasAttribute('data-preset')&&el.value){[p.width,p.height,p.thickness]=el.value.split(',');dirty=true;drawProducts();update();}
    });
    ['dragover','dragleave','drop'].forEach(type=>$('products').addEventListener(type,e=>{
        const drop=e.target.closest('.drop');if(!drop)return;e.preventDefault();drop.classList.toggle('drag',type==='dragover');
        if(type==='drop')readPhoto(e.dataTransfer.files[0],state.products[+drop.closest('.prod').dataset.index]);
    }));
    window.addEventListener('resize',fit);
    let cellProduct=null;
    function chooseCell(e){
        const cell=e.target.closest('[data-photo-index]');
        if(!cell || (e.type==='keydown' && !['Enter',' '].includes(e.key)))return;
        e.preventDefault();cellProduct=activeProducts()[+cell.dataset.photoIndex];$('cellFile').value='';$('cellFile').click();
    }
    $('paper').addEventListener('click',chooseCell);$('paper').addEventListener('keydown',chooseCell);
    $('cellFile').onchange=e=>{if(cellProduct)readPhoto(e.target.files[0],cellProduct);};
    for(const type of ['dragover','drop'])$('paper').addEventListener(type,e=>{
        const cell=e.target.closest('[data-photo-index]');if(!cell)return;e.preventDefault();
        if(type==='drop')readPhoto(e.dataTransfer.files[0],activeProducts()[+cell.dataset.photoIndex]);
    });
    new ResizeObserver(fit).observe($('paper'));
    $('print').onclick=()=>{if(validForExport())window.print();};
    async function copyQuoteImage(internal) {
        if(!validForExport())return;
        const customerButton = $('png'), internalButton = $('internalPng');
        if (customerButton.disabled || internalButton.disabled) return;
        const button = internal ? internalButton : customerButton;
        const label = button.textContent;
        customerButton.disabled = internalButton.disabled = true;
        button.textContent = '复制中…';
        try{
            const image = internal
                ? window.quoteSheetInternalPng($('paper').firstElementChild, window.QuotePicture.snapshot(payload(), calc()))
                : imageForCurrentQuote();
            try{
                if(!window.ClipboardItem || !navigator.clipboard?.write)throw Error('没有图像剪贴板');
                // Register the write in this click gesture, including on Safari.
                await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);
                notify(internal ? '已复制内部留存图。包含还原信息，请勿发给客户。' : '已复制客户报价图，可粘贴发给客户。');
            }catch{
                const blob=await image;
                $('saveTitle').textContent = internal ? '手动复制内部留存图（可还原，请勿外发）' : '手动复制客户报价图';
                $('saveImage').alt = internal ? '内部留存图，可还原' : '客户报价图';
                currentBlobUrl=URL.createObjectURL(blob);$('saveImage').src=currentBlobUrl;
                $('saveDialog').showModal();
            }
        }catch(error){notify(internal ? '内部留存图未复制：'+(error.message || '请重试。') : '客户报价图生成失败，请重试。');}
        finally{customerButton.disabled=internalButton.disabled=false;button.textContent=label;}
    }
    $('png').onclick = () => copyQuoteImage(false);
    $('internalPng').onclick = () => copyQuoteImage(true);
    $('saveDialog').addEventListener('close', () => {
        $('saveImage').removeAttribute('src');
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = '';
    });
    $('closeSave').onclick=()=>$('saveDialog').close();
    new ResizeObserver(fit).observe($('preview'));
    window.QuoteRestoreUI.init({
        applyState(restored) {
            beforeRestore = {state, dirty};
            const defaults = fresh();
            // Never add the fresh quote's 300 yuan box fee or today's date to an old quote.
            state = {...defaults, box:'', freight:'', date:'', shipper:'', manager:'', delivery:'', ...restored,
                products:restored.products.map(product => ({...newProduct(), ...product, model:''}))};
            state.multi=state.products.length>1;state.visitedDifferent=Boolean(state.different);
            dirty=true;zoom=false;collapsed=false;imageIds=new WeakMap();
            previewState();loadInputs();$('restoreUndo').hidden=false;
            const quantity=$('products').querySelector('[data-p="qty"]');
            quantity?.focus();quantity?.select();
            notify('已还原。修改片数即可重新报价，木箱和运费请按需要调整。');
        },
        undoState() {
            if(!beforeRestore || !confirm('撤销还原？将返回导入前的报价，放弃本次还原后的修改。'))return;
            ({state,dirty}=beforeRestore);beforeRestore=null;imageIds=new WeakMap();
            $('restoreUndo').hidden=true;loadInputs();notify('已回到导入前的报价。');
        }
    });
    loadInputs();previewState();
})();
