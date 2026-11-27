(function (root) {
  'use strict';

  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hasValue(value) {
    return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
  }

  function formatNumber(value) {
    if (!hasValue(value)) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return escapeHtml(value);
    return escapeHtml(new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 2,
      useGrouping: false
    }).format(number));
  }

  function formatArea(value) {
    if (!hasValue(value)) return '';
    const number = Number(value);
    if (!Number.isFinite(number)) return escapeHtml(value);
    return escapeHtml(number.toFixed(2));
  }

  function formatDate(value) {
    if (!hasValue(value)) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
    return escapeHtml(match ? `${match[1]}年${match[2]}月${match[3]}日` : value);
  }

  function textWithBreaks(value) {
    return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
  }

  function getImageData(value) {
    if (typeof value !== 'string') return '';
    const source = value.trim();
    return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : '';
  }

  function fieldValue(result, state, key) {
    return owns(result, key) ? result[key] : state[key];
  }

  function renderPrice(value, mode, showUnit) {
    if (!hasValue(value)) return '';
    const unit = mode === 'area' ? '元/㎡' : '元/片';
    return `${formatNumber(value)}${showUnit ? `<small class="quote-sheet__unit">${unit}</small>` : ''}`;
  }

  function renderProductCell(product) {
    const image = getImageData(product.image);
    return image
      ? `<img class="quote-sheet__image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name || '产品图片')}">`
      : '';
  }

  function groupProductsByWarehouse(products) {
    const groups = [];
    const byWarehouse = new Map();
    products.forEach((rawProduct, index) => {
      const product = rawProduct && typeof rawProduct === 'object' ? rawProduct : {};
      const warehouse = hasValue(product.warehouse) ? String(product.warehouse).trim() : '';
      const key = warehouse ? `named:${warehouse}` : `unnamed:${index}`;
      let group = byWarehouse.get(key);
      if (!group) {
        group = { warehouse, products: [] };
        byWarehouse.set(key, group);
        groups.push(group);
      }
      group.products.push({ product, index });
    });
    return groups;
  }

  function renderProductRow(product, index, resultRows, mixedPricing) {
    product = product && typeof product === 'object' ? product : {};
    const calculated = resultRows[index] && typeof resultRows[index] === 'object' ? resultRows[index] : {};
    const mode = product.mode === 'area' ? 'area' : 'piece';
    return `<tr class="quote-sheet__product-row">
        <td>${textWithBreaks(product.category)}</td>
        <td class="quote-sheet__product-name">${textWithBreaks(product.name)}</td>
        <td>${formatNumber(product.width)}</td>
        <td>${formatNumber(product.height)}</td>
        <td>${formatNumber(product.thickness)}</td>
        <td class="quote-sheet__model-cell" data-photo-index="${index}">${renderProductCell(product)}</td>
        <td>${formatNumber(product.qty)}</td>
        <td>${formatArea(calculated.area)}</td>
        <td>${renderPrice(product.original, mode, mixedPricing)}</td>
        <td>${renderPrice(product.price, mode, mixedPricing)}</td>
        <td class="quote-sheet__money">${formatNumber(calculated.amount)}</td>
        <td class="quote-sheet__remark">${textWithBreaks(product.note)}</td>
      </tr>`;
  }

  function renderColumnHeaders(mixedPricing, sharedMode) {
    return `<tr class="quote-sheet__column-head">
            <th rowspan="2">产品类目</th>
            <th rowspan="2">产品名称</th>
            <th colspan="3">产品规格（mm）</th>
            <th rowspan="2">颜色/型号</th>
            <th rowspan="2">数量/片</th>
            <th rowspan="2">面积/m²</th>
            <th rowspan="2" class="quote-sheet__price-head">原价（元）${sharedMode && !mixedPricing ? `/${sharedMode === 'area' ? '平米' : '片'}` : ''}</th>
            <th rowspan="2" class="quote-sheet__price-head">优惠价（元）${sharedMode && !mixedPricing ? `/${sharedMode === 'area' ? '平米' : '片'}` : ''}</th>
            <th rowspan="2">合计（元）</th>
            <th rowspan="2">备注</th>
          </tr>
          <tr class="quote-sheet__column-head"><th>宽度</th><th>高度</th><th>厚度</th></tr>`;
  }

  function sumPositiveProductFee(group, key) {
    return group.products.reduce((sum, item) => {
      const value = item.product[key];
      const amount = Number(value);
      return hasValue(value) && Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0);
  }

  function renderWarehouseGroup(group, groupIndex, resultRows, lalamove) {
    const modes = new Set(group.products.map(({ product }) => product.mode === 'area' ? 'area' : 'piece'));
    const mixedPricing = modes.size > 1;
    const sharedMode = modes.size === 1 ? modes.values().next().value : '';
    const productRows = group.products
      .map(({ product, index }) => renderProductRow(product, index, resultRows, mixedPricing))
      .join('');
    const boxTotal = lalamove ? 0 : sumPositiveProductFee(group, 'box');
    const freightTotal = lalamove ? 0 : sumPositiveProductFee(group, 'freight');
    const materialTotal = group.products.reduce((sum, item) => {
      const amount = Number(resultRows[item.index] && resultRows[item.index].amount);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    const boxAmount = lalamove ? '0' : (boxTotal > 0 ? formatNumber(boxTotal) : '');
    const freightAmount = lalamove
      ? '货拉拉到付'
      : (freightTotal > 0 ? formatNumber(freightTotal) : '到付');
    const freightNote = '送货不卸货，货到先验货无损坏再签收';
    const subtotal = materialTotal + boxTotal + freightTotal;
    const subtotalLabel = `小计${groupIndex + 1}`;

    return `${renderColumnHeaders(mixedPricing, sharedMode)}
      ${productRows}
      ${feeRow('木箱费', boxAmount, lalamove ? '货拉拉不用木箱' : '木箱包装')}
      ${feeRow(`运费${groupIndex + 1}`, freightAmount, freightNote)}
      <tr class="quote-sheet__subtotal"><th colspan="10">${subtotalLabel}</th><td class="quote-sheet__money">${formatNumber(subtotal)}</td><td></td></tr>`;
  }

  function feeRow(label, amount, note) {
    return `<tr class="quote-sheet__fee-row">
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <td class="quote-sheet__fee-name">${escapeHtml(label)}</td>
      <td class="quote-sheet__money">${amount == null ? '' : amount}</td>
      <td class="quote-sheet__remark">${textWithBreaks(note || '')}</td>
    </tr>`;
  }

  function renderQuoteSheet(container, state, result) {
    if (!container || !('innerHTML' in container)) {
      throw new TypeError('renderQuoteSheet(container, state, result) 需要一个可写 innerHTML 的容器。');
    }
    state = state && typeof state === 'object' ? state : {};
    result = result && typeof result === 'object' ? result : {};

    const products = Array.isArray(state.products) ? state.products : [];
    const resultRows = Array.isArray(result.rows) ? result.rows : [];
    const productFreightIncluded = products.map((product) => {
      const amount = Number(product && product.freight);
      return Number.isFinite(amount) && amount > 0;
    });
    const includedCount = productFreightIncluded.filter(Boolean).length;
    const isDifferent = Boolean(state.different);
    const multiDifferent = Boolean(state.multi && isDifferent && products.length > 1);
    const hasIncludedFreight = typeof result.hasFreight === 'boolean'
      ? result.hasFreight
      : Boolean(state.includesFreight);
    const freightDescription = isDifferent && products.length
      ? (includedCount > 0 && includedCount < products.length
        ? '部分含运费'
        : (includedCount > 0 ? '含运费' : '不含运费'))
      : (hasIncludedFreight ? '含运费' : '不含运费');
    const taxFlag = typeof state.includesTax === 'boolean'
      ? state.includesTax
      : (typeof result.includesTax === 'boolean'
        ? result.includesTax
        : (typeof result.hasTax === 'boolean'
          ? result.hasTax
          : (hasValue(result.tax) && Number(result.tax) !== 0)));
    const lalamove = Boolean(state.lalamove);

    const deliveryText = hasValue(state.delivery) ? state.delivery : '';
    const deliveryTerms = '送货到楼下车可以到的地方，不含卸货、不含上楼，如需送到地下室请提前与物流协商；';
    const productModes = new Set(products.map((product) => product && product.mode === 'area' ? 'area' : 'piece'));
    const mixedPricing = productModes.size > 1;
    const sharedMode = productModes.size === 1 ? productModes.values().next().value : '';
    const warehouseGroups = multiDifferent ? groupProductsByWarehouse(products) : [];
    const groupedWarehouses = multiDifferent && warehouseGroups.length > 1;
    const singleDifferentWarehouse = multiDifferent && warehouseGroups.length === 1;

    const productRowsMarkup = groupedWarehouses
      ? warehouseGroups
        .map((group, index) => renderWarehouseGroup(group, index, resultRows, lalamove))
        .join('')
      : products.map((product, index) => renderProductRow(product, index, resultRows, mixedPricing)).join('');
    const sharedColumnHeaders = renderColumnHeaders(mixedPricing, sharedMode);

    let chargeRows = '';
    if (groupedWarehouses) {
      chargeRows = '';
    } else if (singleDifferentWarehouse) {
      const onlyWarehouse = warehouseGroups[0];
      const boxTotal = lalamove ? 0 : sumPositiveProductFee(onlyWarehouse, 'box');
      const freightTotal = lalamove ? 0 : sumPositiveProductFee(onlyWarehouse, 'freight');
      const box = lalamove ? '0' : (boxTotal > 0 ? formatNumber(boxTotal) : '');
      const freight = lalamove
        ? '货拉拉到付'
        : (freightTotal > 0 ? formatNumber(freightTotal) : '到付');
      chargeRows += feeRow('木箱费', box, lalamove ? '货拉拉不用木箱' : '木箱包装');
      chargeRows += feeRow('运费', freight, '送货不卸货，货到先验货无损坏再签收');
    } else if (isDifferent) {
      products.forEach((rawProduct, index) => {
        const product = rawProduct && typeof rawProduct === 'object' ? rawProduct : {};
        const box = lalamove ? '0' : formatNumber(product.box);
        const itemFreightIncluded = productFreightIncluded[index];
        const freight = itemFreightIncluded
          ? formatNumber(product.freight)
          : (lalamove ? '货拉拉到付' : '到付');
        chargeRows += feeRow('木箱费', box, lalamove ? '货拉拉不用木箱' : '木箱包装');
        chargeRows += feeRow('运费', freight, '送货不卸货，货到先验货无损坏再签收');
      });
    } else {
      const box = lalamove ? '0' : formatNumber(fieldValue(result, state, 'box'));
      chargeRows += feeRow('木箱费', box, lalamove ? '货拉拉不用木箱' : '木箱包装');
      const freight = hasIncludedFreight
        ? formatNumber(fieldValue(result, state, 'freight'))
        : (lalamove ? '货拉拉到付' : '到付');
      chargeRows += feeRow('运费', freight, '送货不卸货，货到先验货无损坏再签收');
    }

    const processing = fieldValue(result, state, 'processing');
    const auxiliary = fieldValue(result, state, 'auxiliary');
    const tax = fieldValue(result, state, 'tax');
    const isPositiveAmount = (value) => hasValue(value) && Number.isFinite(Number(value)) && Number(value) > 0;
    if (isPositiveAmount(processing)) chargeRows += feeRow('加工费', formatNumber(processing), '');
    if (isPositiveAmount(auxiliary)) chargeRows += feeRow('辅料费', formatNumber(auxiliary), '');
    if (isPositiveAmount(tax)) chargeRows += feeRow('税金', formatNumber(tax), '');

    const instructions = [
      `<span>①此报价仅主材，</span><strong class="quote-sheet__red">${taxFlag ? '含税点' : '不含税点'}，${escapeHtml(freightDescription)}；${escapeHtml(deliveryTerms)}</strong>`,
      `<span>②请审核确认好订单明细（款式、数量、尺寸、颜色、金额等）；</span><strong class="quote-sheet__red">都是定制产品，付款后非质量问题不支持退换；</strong><span>（产品是手工制作粗犷型材料，拍照和实物会有色差，不同批次生产的货品可能也会有自然的纹理和色差，不属于质量问题；）</span>`,
      `<span>③运输损坏物流承担：货物到现场后，</span><strong class="quote-sheet__red">先验货（立刻全程录视频查验清点好数量、颜色、款式，查看材料是否有损坏），如发现物品因物流出现破损第一时间联系供货方，我们会与物流协商赔付</strong><span>（签收时验货，录屏）如无问题再签收。</span><strong class="quote-sheet__red">不验货直接签收后期发现的问题概不负责；</strong>`,
      `<span>④注意搬运，搬运卸货过程中要注意避免刮花，断裂等；一旦签收就默认为没有问题，我司无法追究理赔责任。</span>`,
      `<span>⑤新型材料的施工如有疑问，</span><strong class="quote-sheet__red">请提前及时与我们联系对接后再施工，若安装不当导致的问题我们将不予承担；</strong>`,
      `<span>⑥付款方式：全款支付；下定请考虑好损耗</span><strong class="quote-sheet__red">（因工业制品，不同批次会有色差，且补货产生额外的包装和运输，以及时间成本）</strong>`
    ];

    const noteRows = instructions.map((html, index) => {
      const sideCell = index === 0
        ? `<th class="quote-sheet__note-side" rowspan="6"><div class="quote-sheet__note-heading">订单说明<br>注意事项</div><div class="quote-sheet__look-list"><span>一定要看</span><span>一定要看</span><span>一定要看</span></div></th>`
        : '';
      return `<tr>${sideCell}<td class="quote-sheet__note-text">${html}</td></tr>`;
    }).join('');

    const markup = `<div class="quote-sheet">
      <table class="quote-sheet__table quote-sheet__products${groupedWarehouses ? ' quote-sheet__products--warehouse-groups' : ''}" aria-label="产品报价单">
        <colgroup>
          <col style="width:5.8%"><col style="width:15.45%"><col style="width:4.5%"><col style="width:4.2%"><col style="width:4.2%"><col style="width:7.5%"><col style="width:5.7%"><col style="width:6.5%"><col style="width:8.75%"><col style="width:9.3%"><col style="width:7.45%"><col style="width:20.65%">
        </colgroup>
        <thead>
          <tr><th class="quote-sheet__title" colspan="12">产品报价单</th></tr>
          <tr>
            <th>客户信息</th><td class="quote-sheet__meta" colspan="5">${textWithBreaks(state.customer)}</td>
            <th>发货单位</th><td class="quote-sheet__meta" colspan="5">${textWithBreaks(state.shipper)}</td>
          </tr>
          <tr>
            <th>收货地址</th><td class="quote-sheet__meta quote-sheet__address" colspan="5">${textWithBreaks(state.address)}</td>
            <th>业务经理</th><td class="quote-sheet__meta quote-sheet__manager" colspan="5">${textWithBreaks(state.manager)}</td>
          </tr>
          <tr>
            <th>运费明细</th><td class="quote-sheet__meta quote-sheet__delivery" colspan="5">${textWithBreaks(deliveryText)}</td>
            <th>订货日期</th><td class="quote-sheet__meta" colspan="5">${formatDate(state.date)}</td>
          </tr>
          ${groupedWarehouses ? '' : sharedColumnHeaders}
        </thead>
        <tbody>
          ${productRowsMarkup}
          ${chargeRows}
          <tr class="quote-sheet__total-row"><th colspan="10">总价（按优惠价核算）</th><td class="quote-sheet__total">${formatNumber(result.total)}</td><td class="quote-sheet__remark">${textWithBreaks(state.extraNote)}</td></tr>
        </tbody>
      </table>

      <table class="quote-sheet__table quote-sheet__notes" aria-label="订单说明注意事项">
        <colgroup><col style="width:5.8%"><col style="width:94.2%"></colgroup>
        <tbody>${noteRows}</tbody>
      </table>

      ${groupedWarehouses ? '' : `<table class="quote-sheet__table quote-sheet__signatures" aria-label="审批与制单签名">
        <colgroup><col style="width:8%"><col style="width:13%"><col style="width:6%"><col style="width:10%"><col style="width:6%"><col style="width:15%"><col style="width:6%"><col style="width:10%"><col style="width:8%"><col style="width:18%"></colgroup>
        <tbody><tr>
          <th>领导审批：</th><td></td>
          <th>财务：</th><td>姚</td>
          <th>业务：</th><td>张苗苗</td>
          <th>审核：</th><td>周</td>
          <th>制单人：</th><td>高</td>
        </tr></tbody>
      </table>`}
    </div>`;

    container.innerHTML = markup;
    return container.firstElementChild || null;
  }

  root.renderQuoteSheet = renderQuoteSheet;
})(typeof window !== 'undefined' ? window : globalThis);
