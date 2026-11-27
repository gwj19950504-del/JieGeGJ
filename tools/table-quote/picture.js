// Internal archives only: clipboard apps commonly strip PNG ancillary chunks.
// Keep the checked pixel format readable for older exports; never stamp a customer image.
// Never include inactive products, original photographs, or unused fees/rates.
(() => {
    'use strict';
    const magic = Uint8Array.of(74,71,81,80,73,67,1,28);
    const maxBytes = 240000, headerBytes = 24;
    const textFields = ['customer','address','date','shipper','manager','delivery','extraNote'];
    const productFields = ['category','name','width','height','thickness','qty','original','price','mode','model','note'];
    const pick = (object, keys) => Object.fromEntries(keys.map(key => [key,String(object[key] ?? '')]));
    function validThickness(value) {
        const match=String(value).trim().match(/^(\d+(?:\.\d+)?)(?:\s*[-–—~～至]\s*(\d+(?:\.\d+)?))?$/);
        return value==='' || Boolean(match && +match[1]>0 && (!match[2] || +match[2]>=+match[1]));
    }
    function snapshot(data, result) {
        const different = data.different && data.products.length > 1;
        const autoTax = Boolean(data.autoTax && !Number(data.tax));
        return {...pick(data,textFields), different:Boolean(different), lalamove:Boolean(data.lalamove),
            processing:String(result.processing), auxiliary:String(result.auxiliary),
            tax:autoTax ? '' : String(result.tax || ''), autoTax, rate:autoTax ? String(data.rate) : '',
            box:different ? '' : String(result.box), freight:different ? '' : String(result.freight || ''),
            total:result.total, products:data.products.map(product => ({...pick(product,productFields),
                warehouse:different ? String(product.warehouse || '') : '',
                box:different && !data.lalamove ? String(product.box || '') : '',
                freight:different && !data.lalamove ? String(product.freight || '') : ''}))};
    }
    function checksum(bytes) {
        let hash = 2166136261;
        for (let index = 0; index < bytes.length; index++) hash = Math.imul(hash ^ bytes[index], 16777619);
        return hash >>> 0;
    }
    function visualCheck(bytes) {
        let hash = 2166136261;
        for (let index = 0; index < bytes.length; index += 4) {
            const rgb = bytes[index] | bytes[index+1]<<8 | (bytes[index+2]&254)<<16;
            hash = Math.imul(hash ^ rgb, 16777619);
        }
        return hash >>> 0;
    }
    function readBytes(pixels, length) {
        const bytes = new Uint8Array(length);
        for (let i=0;i<length;i++) for(let bit=0;bit<8;bit++) bytes[i] |= (pixels[(i*8+bit)*4+2]&1)<<bit;
        return bytes;
    }
    function stamp(canvas, sheet, record) {
        if(!record) return;
        const bounds=sheet.getBoundingClientRect();
        record.pictures=record.products.map(()=>null);
        record.lettering=record.products.map(()=>({}));
        for(const row of sheet.querySelectorAll('.quote-sheet__product-row')) {
            const scale=canvas.width/Math.ceil(bounds.width);
            const index=Number(row.querySelector('[data-photo-index]').dataset.photoIndex);
            function coords(img){const rect=img.getBoundingClientRect();return [rect.x-bounds.x,rect.y-bounds.y,rect.width,rect.height].map(value=>Math.round(value*scale));}
            const image=row.querySelector('.quote-sheet__image');
            if(image)record.pictures[index]=coords(image);
            for(const label of row.querySelectorAll('[data-lettering]'))record.lettering[index][label.dataset.lettering]=coords(label);
        }
        const bytes=new TextEncoder().encode(JSON.stringify(record));
        if(bytes.length>maxBytes || (bytes.length+headerBytes)*8 > canvas.width*canvas.height ||
            canvas.width*canvas.height>24000000 || Math.max(canvas.width,canvas.height)>16000 || !cleanRecord(record))
            throw Error('本单超过精确还原范围，请拆分后再留存内部图。');
        const context=canvas.getContext('2d'), pixels=context.getImageData(0,0,canvas.width,canvas.height);
        const data=new Uint8Array(headerBytes+bytes.length), view=new DataView(data.buffer);
        data.set(magic);view.setUint32(8,bytes.length);view.setUint32(12,checksum(bytes));
        view.setUint32(16,visualCheck(pixels.data));view.setUint32(20,canvas.width);data.set(bytes,headerBytes);
        for(let i=0;i<data.length;i++) for(let bit=0;bit<8;bit++) {
            const index=(i*8+bit)*4+2;
            pixels.data[index]=(pixels.data[index]&254) | ((data[i]>>bit)&1);
        }
        context.putImageData(pixels,0,0);
    }
    function cleanRecord(raw) {
        if (!raw || !Array.isArray(raw.products) || !raw.products.length || raw.products.length > 250 || !Array.isArray(raw.pictures) || raw.pictures.length !== raw.products.length) return null;
        const safeText = value => typeof value==='string' && value.length<=24000;
        const numeric = value => value==='' || (typeof value==='string' && Number.isFinite(Number(value)) && Number(value)>=0);
        const fees=['processing','auxiliary','box','freight','tax','rate'];
        if(!textFields.every(key=>safeText(raw[key])) || !fees.every(key=>numeric(raw[key])) ||
            !['different','lalamove','autoTax'].every(key=>typeof raw[key]==='boolean') ||
            !Number.isFinite(raw.total) || raw.total<0) return null;
        const state={...pick(raw,[...textFields,...fees]), different:raw.different, multi:raw.products.length>1,
            lalamove:raw.lalamove,autoTax:raw.autoTax,rateChoice:raw.autoTax && !['3','10'].includes(raw.rate)?'custom':raw.rate || '10',products:[]};
        if(!state.autoTax)state.rate='10';
        for(const product of raw.products) {
            if(!product || !['area','piece'].includes(product.mode) || ![...productFields,'warehouse','box','freight'].every(key=>safeText(product[key])) ||
                !validThickness(product.thickness) || !['width','height','qty','original','price','box','freight'].every(key=>numeric(product[key])) ||
                !Number.isInteger(+product.qty) || +product.qty<=0 || product.price==='' || !product.name.trim()) return null;
            state.products.push({...pick(product,[...productFields,'warehouse','box','freight']),image:''});
        }
        if(Math.abs(window.QuoteMath.calculate(state).total-raw.total)>.005) return null;
        return state;
    }
    async function read(file) {
        const url=URL.createObjectURL(file), image=new Image(); image.src=url;
        try {
            await image.decode();
            const width=image.naturalWidth, height=image.naturalHeight;
            if(!width || !height || width*height>24000000 || Math.max(width,height)>16000) throw Error('图片太大或尺寸无效，请拖入完整报价原图。');
            if(width*height<headerBytes*8) return null;
            const canvas=document.createElement('canvas');canvas.width=width;
            canvas.height=Math.ceil(headerBytes*8/width);
            let context=canvas.getContext('2d',{willReadFrequently:true});
            context.drawImage(image,0,0);
            const header=readBytes(context.getImageData(0,0,width,canvas.height).data,headerBytes);
            if(!magic.every((value,index)=>value===header[index]))return null;
            const view=new DataView(header.buffer), count=view.getUint32(8);
            if(count>maxBytes || !count || (count+headerBytes)*8>width*height || view.getUint32(20)!==width)return null;
            canvas.height=height;context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
            const pixels=context.getImageData(0,0,width,height).data;
            if(visualCheck(pixels)!==view.getUint32(16))return null;
            const bytes=readBytes(pixels,count+headerBytes).subarray(headerBytes);
            if(checksum(bytes)!==view.getUint32(12))return null;
            let raw;try{raw=JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
            const state=cleanRecord(raw);if(!state)return null;
            function readCrop(rect){
                if(!Array.isArray(rect) || rect.length!==4 || !rect.every(Number.isInteger))return '';
                const [x,y,w,h]=rect;
                if(x<0||y<0||w<=0||h<=0||x+w>width||y+h>height||w*h>1000000)return '';
                const crop=document.createElement('canvas');crop.width=w;crop.height=h;
                crop.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);return crop.toDataURL('image/png');
            }
            for(let step=0;step<raw.pictures.length;step++){
                const rect=raw.pictures[step],product=state.products[step];
                if(rect!==null){product.image=readCrop(rect);if(!product.image)return null;}
                for(const key of ['category','name']){
                    const box=raw.lettering?.[step]?.[key];if(!box)continue;
                    const url=readCrop(box);if(!url)return null;
                    product.labelArt||={};product.labelArt[key]=url;product.labelArt[key+'Width']=box[2]*1280/width;
                }
            }
            return {state,sourceTotal:raw.total,warnings:[]};
        } finally {URL.revokeObjectURL(url);}
    }
    window.QuotePicture={snapshot,stamp,read,validThickness};
})();
