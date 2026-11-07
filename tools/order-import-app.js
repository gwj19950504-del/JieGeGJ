(function () {
  'use strict';
  const section = document.querySelector('#orderImportSection');
  const text = document.querySelector('#orderImportText');
  const preview = document.querySelector('#orderImportPreview');
  const undoButton = document.querySelector('#undoOrderImport');
  const confirmBox = document.querySelector('#orderImportConfirm');
  const accepted = document.querySelector('#acceptOrderImportDifference');
  const categoryWrap = document.querySelector('#orderImportCategoryWrap');
  const categoryChoice = document.querySelector('#orderImportZhejiangCategory');
  let timer = null;
  let undo = null;
  let appliedText = null;
  let applying = false;
  const dynamicIds = ['logisticsGroup', 'additionalProducts', 'otherAdditionalProducts', 'cementAdditionalProducts', 'concreteAdditionalProducts', 'concretePromoRows', 'meililaiFeeRows', 'customFeeRows'];
  const normalControls = () => Array.from(document.querySelectorAll('input, textarea, select')).filter(node => !section.contains(node));
  const radio = (name, value) => Array.from(document.querySelectorAll(`input[name="${name}"]`)).find(node => node.value === String(value));
  function choose(name, value) {
    const node = radio(name, value);
    if (!node) throw new Error(`无法还原选项：${name} / ${value}`);
    node.checked = true;
  }
  function setValue(node, value) { node.value = value === null || value === undefined ? '' : String(value); }
  function manualPrice(node, value) {
    setValue(node, value);
    node.dataset.manualOverride = '1';
    delete node.dataset.autoPrice;
  }
  function capture() {
    return {
      containers: dynamicIds.map(id => { const node = document.getElementById(id); return { node, children:Array.from(node.childNodes) }; }),
      controls: normalControls().map(node => ({ node, value:node.value, checked:node.checked, disabled:node.disabled, readOnly:node.readOnly, options:node.tagName === 'SELECT' ? node.innerHTML : null })),
      datasets: Array.from(document.querySelectorAll('main *')).filter(node => !section.contains(node)).map(node => ({node, data:{...node.dataset}, className:node.getAttribute('class'), hidden:node.hidden})),
      hints: Array.from(document.querySelectorAll('.ningbo-hint, .catalog-product-note, .catalog-spec-label, #formNotice')).map(node=>({node,text:node.textContent})),
      manual:manualResultMode, result:els.result.innerHTML, previousWarehouse:previousWarehouseGroup,
      focus:document.activeElement, scrollX:window.scrollX, scrollY:window.scrollY
    };
  }
  function restore(snapshot) {
    snapshot.containers.forEach(({node,children}) => node.replaceChildren(...children));
    snapshot.controls.forEach(saved => {
      if (saved.options !== null) saved.node.innerHTML = saved.options;
      saved.node.value = saved.value;
      if (saved.checked !== undefined) saved.node.checked = saved.checked;
      saved.node.disabled = saved.disabled;
      if (saved.readOnly !== undefined) saved.node.readOnly = saved.readOnly;
    });
    snapshot.datasets.forEach(({node,data}) => { Object.keys(node.dataset).forEach(key => delete node.dataset[key]); Object.assign(node.dataset,data); });
    previousWarehouseGroup = snapshot.previousWarehouse;
    manualResultMode = snapshot.manual;
    calculate();
    snapshot.datasets.forEach(({node,className,hidden})=>{if(className===null)node.removeAttribute('class');else node.setAttribute('class',className);node.hidden=hidden;});
    snapshot.hints.forEach(({node,text})=>node.textContent=text);
    if (snapshot.manual) els.result.innerHTML = snapshot.result;
    snapshot.focus?.focus({preventScroll:true});
    window.scrollTo(snapshot.scrollX,snapshot.scrollY);
  }
  function normalizedSpec(value) { return String(value).replace(/[×xX＊]/g,'*').replace(/\s|mm|毫米|硬质-?|软质-?/gi,''); }
  function preflight(state) {
    if (!state.products.length || state.products.length > 5) throw new Error('现有开单表单支持1至5个产品，请只粘贴对应的一张完整订单。');
    if (state.extraLines?.length) throw new Error('以下附加明细暂不能完整还原，请人工开单，当前表单未改变：\n' + state.extraLines.join('\n'));
    let group = state.warehouse;
    let category = 'other';
    let specKeys = [];
    if (['松诺','168'].includes(group)) { group='混凝土仓'; category='songnuo'; }
    else if (['苏州仓','华中仓','淮海仓','昌盛仓'].includes(group)) { group='水泥板仓库'; category='cement'; }
    else if (!['浙江仓','宁波仓','美利来'].includes(group)) {
      if(state.sourceKd!==null)throw new Error('无法确定旧单仓库，不能改用自选仓回填。');
      group='自选仓'; category='custom';
    }
    if (group==='自选仓' && state.products.length!==1) throw new Error('自选仓现有表单仅支持单产品，不能把多产品订单合并回填。');
    if (group==='自选仓' && (state.fees.crateFee || state.fees.processingFee)) throw new Error('自选仓的包装/加工费用需要明确附加费用字段，请人工核对，当前单未改变。');
    if (group==='浙江仓') {
      category=categoryChoice.value;
      if(!category)throw new Error('已识别浙江仓旧单。正文没有记录品类，请先在下方选择原单品类，再自动还原。');
      const list = category==='sandstone' ? sandstoneSpecs : specs;
      specKeys=state.products.map(item => {
        const matches=list.filter(spec => {
          if(normalizedSpec(spec.label)===normalizedSpec(item.spec))return true;
          return /软质/.test(item.spec) && spec.material==='soft' && normalizedSpec(spec.label).split('*').slice(0,2).join('*')===normalizedSpec(item.spec);
        });
        return matches.length===1 ? matches[0].value : null;
      });
      if(category!=='other' && (!specKeys.every(Boolean) || !state.products.every(item=>item.priceBasis==='area' && item.unit==='piece')))throw new Error('该品类规格无法唯一匹配现有计价/重量规则，请核对原单品类与规格。');
      if(category==='other' && (state.fees.db || state.shippingSummary))throw new Error('其它品类的旧重量/包装不能随新数量自动重算，请人工核对后开单。');
    }
    if (!radio('greenCount',state.greenCount) && state.greenCount!=='0') throw new Error('人员编号无法匹配当前选项，请核对旧单。');
    if (!radio('xCode',state.xCode)) throw new Error('客户标记无法匹配当前选项，请核对旧单。');
    const logisticsKey=group==='自选仓'?'自选仓':state.warehouse;
    const availableLogistics=logisticsByWarehouse[logisticsKey] || [];
    // Both existing pickup options generate the same 工厂自提 wording.
    const logistics=state.logistics==='工厂自提' && !availableLogistics.includes('工厂自提') && availableLogistics.includes('自提') ? '自提' : state.logistics;
    if (!availableLogistics.includes(logistics)) throw new Error(`当前仓库未提供物流“${state.logistics}”，请核对，未替换为其他物流。`);
    for (const item of state.products) {
      if (category==='songnuo' && item.unit!=='area') throw new Error('混凝土需要原单中的面积明细，不能由片数猜算。');
      if (category!=='songnuo' && category!=='custom' && item.unit!=='piece') throw new Error('该仓库需要片数明细，不能由面积猜算片数。');
      if (category==='other' && item.priceBasis==='area' && !areaFromSpecText(item.spec)) throw new Error('无法识别规格面积，请核对后重试。');
    }
    return {group,category,specKeys,logistics};
  }
  function fill(state, plan) {
    const newIndex=els.orderIndex.value;
    resetForNextOrder();
    els.orderIndex.value=newIndex;
    normalControls().forEach(node=>{delete node.dataset.autoPrice;delete node.dataset.manualOverride;});
    choose('warehouse',plan.group);
    if(plan.group==='混凝土仓') choose('concreteWarehouse',state.warehouse);
    if(plan.group==='水泥板仓库') choose('cementWarehouse',state.warehouse);
    if(plan.group==='自选仓') setValue(els.customWarehouseName,state.warehouse);
    choose('category',['liujin','sandstone','other'].includes(plan.category)?plan.category:'other');
    previousWarehouseGroup=plan.group;
    setGreenCount(state.greenCount==='0'?'':state.greenCount);
    setXCode(state.xCode);
    setValue(els.receiverName,state.receiver.name);
    setValue(els.receiverPhone,state.receiver.phone);
    setValue(els.receiverAddress,state.receiver.address);
    els.receiverRaw.value=[state.receiver.name,state.receiver.phone,state.receiver.address].filter(Boolean).join('，');
    renderLogistics();
    choose('logistics',plan.logistics);
    choose('freightPay',state.freightPay);
    setValue(els.freightAmount,state.freightAmount);
    renderSpecOptions();
    if (plan.category==='other') {
      setOtherProductCount(state.products.length);
      renderOtherAdditionalProducts();
      otherRows().forEach((row,index)=>{
        const item=state.products[index];
        setValue(row.productName,item.name);
        if(row.matchTools) delete row.matchTools.dataset.product;
        syncNingboProductRow(row,false,false);
        setValue(row.specText,item.spec);
        syncNingboSpecSelect(row);
        setValue(row.qty,item.quantity);
        manualPrice(row.sqmPrice,item.priceBasis==='area'?item.basisPrice:'');
        setValue(row.unitPrice,item.priceBasis==='piece'?item.unitPrice:'');
      });
      setValue(els.otherDb,state.fees.db || '');
    } else if (plan.category==='liujin' || plan.category==='sandstone') {
      setProductCount(state.products.length);
      renderAdditionalProducts();
      liujinRows().forEach((row,index)=>{
        const item=state.products[index];
        setValue(row.productName,item.name);
        row.specSelect.value=plan.specKeys[index];
        setValue(row.qty,item.quantity);
        manualPrice(row.sqmPrice,item.basisPrice);
      });
    } else if (plan.category==='cement') {
      setCementProductCount(state.products.length);
      renderCementAdditionalProducts();
      cementRows().forEach((row,index)=>{const item=state.products[index];setValue(row.productName,item.name);setValue(row.specText,item.spec);setValue(row.qty,item.quantity);setValue(row.unitPrice,item.unitPrice);});
    } else if (plan.category==='songnuo') {
      setConcreteProductCount(state.products.length);
      renderConcreteAdditionalProducts();
      concreteRows().forEach((row,index)=>{
        const item=state.products[index];
        setValue(row.productName,item.name);
        choose(row.specPresetName,'custom');
        setValue(row.specText,item.spec);
        setValue(row.area,item.quantity);
        manualPrice(row.sqmPrice,item.unitPrice);
        row.materialAmount.value='';
      });
    } else {
      const item=state.products[0];
      choose('customPriceMode',item.unit==='area'?'sqm':'piece');
      setValue(els.customProductName,item.name);setValue(els.customSpecText,item.spec);
      setValue(els.customQty,item.quantity);setValue(els.customUnitPrice,item.unitPrice);
      els.customDetail.value='';els.customPriceNote.value='';els.customFeeRows.innerHTML='';
    }
    els.normalTaxAuto.checked=false;els.specialTaxAuto.checked=false;
    setValue(els.taxAmount,state.fees.taxAmount || '');
    setValue(els.processingFee,state.fees.processingFee || '');
    setValue(els.promotionFee,state.fees.promotionFee || '');
    els.meililaiManualPackaging.checked=plan.group==='美利来';
    setValue(els.crateFee,state.fees.crateFee || '');
    setValue(els.totalAmount,state.total);
    clearPaymentChoice();
    // Keep the exact original payment text; choose matching controls only for convenience.
    const methods=Array.from(document.querySelectorAll('input[name="paymentMethod"]')).sort((a,b)=>b.value.length-a.value.length);
    const method=methods.find(node=>state.payment===node.value || state.payment.startsWith(node.value+'-'));
    if(method) { method.checked=true; const channel=radio('paymentChannel',state.payment.slice(method.value.length+1));if(channel)channel.checked=true; }
    setValue(els.payment,state.payment);
    if(state.deposit) {els.depositEnabled.checked=true;setValue(els.depositAmount,state.deposit.amount);}
    if(state.allocation) {els.allocationEnabled.checked=true;setValue(els.allocationText,state.allocation);}
    syncRemarkPresetAvailability();
    document.querySelectorAll('.remarkPreset').forEach(node=>node.checked=false);
    els.remarkCustom.value=state.remark==='无'?'':state.remark;
    manualResultMode=false;
    calculate();
    const invalid=orderValidationError();
    if(invalid)throw new Error(invalid);
  }
  function clear() {
    if(applying)return;
    clearTimeout(timer);timer=null;undo=null;appliedText=null;text.value='';
    undoButton.disabled=true;confirmBox.hidden=true;accepted.checked=false;categoryWrap.hidden=true;categoryChoice.value='';
    preview.textContent='输入完整开单后自动还原；可撤销恢复回填前的表单和正文。原文仅在本页处理，不上传、不保存。';
  }
  function run(allowDifference=false) {
    clearTimeout(timer);timer=null;
    const source=text.value;
    if(source===appliedText){preview.textContent='这份原文已处理，不会重复覆盖你修改的数量或金额；需要再次还原请点击“重新识别”。';return;}
    confirmBox.hidden=true;
    const result=window.OrderImportCore.parse(source);
    categoryWrap.hidden=result.state?.warehouse!=='浙江仓';
    if(!result.ok){preview.textContent='暂不能回填，当前开单未改变：\n'+result.errors.join('\n');return;}
    let plan;
    try {plan=preflight(result.state);} catch(error){preview.textContent='暂不能回填，当前开单未改变：\n'+error.message;return;}
    const snapshot=capture();
    applying=true;
    try {
      fill(result.state,plan);
      const actualMaterial=Number(els.materialPreview.textContent);
      const expectedMaterial=result.state.products.reduce((sum,item)=>sum+item.lineAmount,0);
      const differences=[...result.warnings];
      if(Math.abs(actualMaterial-expectedMaterial)>0.05) differences.push(`材料费：原单${money(expectedMaterial)}，当前明细计算${money(actualMaterial)}。`);
      if(result.state.sourceKd!==null && Math.abs(Number(els.kdPreview.textContent)-result.state.sourceKd)>0.05) differences.push(`KD：原单${money(result.state.sourceKd)}，按当前规则计算${els.kdPreview.textContent}。`);
      if(differences.length && !allowDifference) {
        restore(snapshot);
        confirmBox.hidden=false;accepted.checked=false;
        preview.textContent='已识别，但发现需核对的差异，当前开单未改变：\n'+differences.join('\n');
        return;
      }
      undo=snapshot;appliedText=source;undoButton.disabled=false;
      preview.textContent=`已还原 ${result.state.warehouse} · ${result.state.products.length} 个产品。\n旧单号 ${result.state.sourceOrderNo} 仅供核对；新单号沿用当前日期及上方编号。\n保留原合计 ${money(result.state.total)} 元、原单价与费用。现在可修改数量、价格或合计；税金按原金额手填，不倒推税率。`+(differences.length?'\n已确认差异：\n'+differences.join('\n'):'');
      text.focus({preventScroll:true});window.scrollTo(snapshot.scrollX,snapshot.scrollY);
    } catch(error) {
      restore(snapshot);
      preview.textContent='未完成回填，已恢复原开单：\n'+error.message;
    } finally {applying=false;}
  }
  text.addEventListener('input',event=>{
    clearTimeout(timer);accepted.checked=false;confirmBox.hidden=true;categoryChoice.value='';categoryWrap.hidden=true;
    preview.textContent='正在识别，当前开单未改变…';
    if(!event.isComposing)timer=setTimeout(()=>run(),250);
  });
  text.addEventListener('compositionend',()=>{clearTimeout(timer);timer=setTimeout(()=>run(),250);});
  categoryChoice.addEventListener('change',()=>{accepted.checked=false;appliedText=null;run();});
  document.querySelector('#retryOrderImport').addEventListener('click',()=>{appliedText=null;run();});
  document.querySelector('#clearOrderImport').addEventListener('click',clear);
  document.querySelector('#confirmOrderImport').addEventListener('click',()=>{if(accepted.checked)run(true);});
  undoButton.addEventListener('click',()=>{
    if(!undo)return;
    clearTimeout(timer);applying=true;
    try {restore(undo);} finally {applying=false;}
    undo=null;appliedText=text.value;undoButton.disabled=true;confirmBox.hidden=true;accepted.checked=false;
    preview.textContent='已撤销，恢复回填前的表单和正文。需要再次还原请点击“重新识别”。';
  });
  document.addEventListener('input',event=>{
    if(applying || section.contains(event.target) || !timer)return;
    clearTimeout(timer);timer=null;
    preview.textContent='检测到你正在修改开单，已停止待执行的自动回填；需要还原请点击“重新识别”。';
  },true);
  window.OrderImportApp={clear};
})();
