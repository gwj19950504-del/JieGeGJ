(function (root) {
  'use strict';

  const NUMBER = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const MONEY = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
  const MONEY_WARN_TOLERANCE = (quantity) => quantity * 0.005 + 0.02;

  function createState() {
    return {
      sourceOrderNo: '',
      warehouse: '',
      greenCount: '',
      xCode: '',
      receiver: { name: '', phone: '', address: '' },
      logistics: '',
      freightPay: '',
      freightAmount: '',
      products: [],
      fees: {
        crateFee: 0,
        processingFee: 0,
        promotionFee: 0,
        taxAmount: 0,
        paymentDeduction: 0,
        db: 0
      },
      sourceKd: null,
      total: null,
      payment: '',
      remark: '',
      deposit: null,
      allocation: '',
      extraLines: [],
      shippingSummary: '',
      mentions: [],
      processingNote: ''
    };
  }

  function parseMoney(value) {
    const raw = String(value ?? '').replace(/元\s*$/, '').trim();
    if (!MONEY.test(raw)) return null;
    const number = Number(raw);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function parseSignedMoney(value) {
    const raw = String(value ?? '').replace(/元\s*$/, '').trim();
    if (!/^-?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(raw)) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function addUnique(target, message) {
    if (!target.includes(message)) target.push(message);
  }

  function countMatches(source, regex) {
    return Array.from(source.matchAll(regex)).length;
  }

  function commaPositions(source) {
    const positions = [];
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === '，' || source[index] === ',') positions.push(index);
    }
    return positions;
  }

  function readAmountLabel(segment, labelPattern) {
    const match = segment.match(labelPattern);
    if (!match) return null;
    return { raw: match[match.length - 1], match };
  }

  function findSpec(nameAndSpec) {
    // Only extract a dimension anchored at the end of the name/spec prefix. This protects
    // product-name digits such as "3D" and never drops unknown text after the dimensions.
    // Keep adjacent 硬质-/软质- and a trailing parenthetical spec note in the specification.
    const pattern = new RegExp(
      `((?:硬质[-－]?|软质[-－]?)?\\d+(?:\\.\\d+)?` +
      `(?:\\s*[＊*×xX]\\s*\\d+(?:\\.\\d+)?){1,2}` +
      `(?:\\s*[＊*×xX]\\s*\\d+(?:\\.\\d+)?[~～]\\d+(?:\\.\\d+)?)?` +
      `\\s*(?:mm|毫米)?(?:[（(][^（）()]*[）)])?` +
      `|((?:硬质[-－]?|软质[-－]?)?\\d+(?:\\.\\d+)?\\s*(?:mm|毫米)(?:[（(][^（）()]*[）)])?))$`,
      'i'
    );
    const match = nameAndSpec.match(pattern);
    if (!match) {
      const hasLooseDimension = /(?:硬质[-－]?|软质[-－]?)?\d+(?:\.\d+)?(?:(?:\s*[＊*×xX]\s*\d+(?:\.\d+)?){1,2}(?:\s*[＊*×xX]\s*\d+(?:\.\d+)?[~～]\d+(?:\.\d+)?)?\s*(?:mm|毫米)?|\s*(?:mm|毫米))(?=.+$)/i.test(nameAndSpec);
      const placeholder = nameAndSpec.match(/^(.*?)(请填写规格)$/);
      if (placeholder) return { name: placeholder[1].trim(), spec: placeholder[2], hasLooseDimension: false };
      return { name: nameAndSpec.trim(), spec: '', hasLooseDimension };
    }
    const start = match.index;
    const spec = match[1] || match[2];
    return {
      name: nameAndSpec.slice(0, start).trim(),
      spec: spec.trim(),
      hasLooseDimension: false
    };
  }

  function specArea(spec) {
    const match = String(spec || '').match(/(\d+(?:\.\d+)?)\s*[＊*×xX]\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (!(first > 0 && second > 0)) return null;
    // order-template's board specs are millimetres and area is converted to square metres.
    return first * second / 1000000;
  }

  function parseProduct(segment, errors, warnings, notices, productIndex) {
    const number = NUMBER;
    const productPattern = new RegExp(
      `^(?<nameSpec>.*?)\\s*[＊*×xX]\\s*(?<quantity>${number})\\s*` +
      `(?<quantityUnit>平方|平|㎡|m²|m2|片|张)\\s*[＊*×xX]\\s*` +
      `(?<unitPrice>${number})\\s*元?\\s*=\\s*(?<lineAmount>${number})\\s*元?` +
      `\\s*(?<note>[（(][^）)]*[）)])?$`,
      'i'
    );
    const match = segment.match(productPattern);
    if (!match) return null;

    const rawQuantity = Number(match.groups.quantity);
    const unit = /^(?:平方|平|㎡|m²|m2)$/i.test(match.groups.quantityUnit) ? 'area' : 'piece';
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0 || !Number.isSafeInteger(rawQuantity) && unit === 'piece') {
      addUnique(errors, `产品${productIndex}数量无效；片数必须是正整数，面积须为正数。`);
    }
    const unitPrice = parseMoney(match.groups.unitPrice);
    const lineAmount = parseMoney(match.groups.lineAmount);
    if (unitPrice === null || lineAmount === null) {
      addUnique(errors, `产品${productIndex}单价或小计须为非负金额，最多两位小数。`);
    }

    const split = findSpec(match.groups.nameSpec.trim());
    if (!split.name) addUnique(errors, `产品${productIndex}名称为空。`);
    if (split.hasLooseDimension) {
      addUnique(errors, `产品${productIndex}规格尺寸后有无法识别的文本，请核对完整规格。`);
    }
    if (split.spec === '请填写规格') {
      addUnique(errors, `产品${productIndex}规格未填写。`);
    }
    if (!split.spec) {
      // buildCustom permits a product without a size. Preserve the whole prefix as its name;
      // the UI can decide whether this warning needs user confirmation for the selected mode.
      addUnique(notices, `产品${productIndex}未识别到毫米规格；规格留空，请核对。`);
    }

    let priceBasis = unit === 'area' ? 'area' : 'piece';
    let basisPrice = unitPrice ?? 0;
    const note = match.groups.note || '';
    if (note) {
      const basisMatch = note.match(new RegExp(`(${number})\\s*(?:元)?\\s*[/／]\\s*(平方|平|㎡|m²|m2|片|张)`, 'i'));
      if (basisMatch) {
        basisPrice = Number(basisMatch[1]);
        priceBasis = /^(?:片|张)$/i.test(basisMatch[2]) ? 'piece' : 'area';
      } else if (/\d/.test(note)) {
        addUnique(notices, `产品${productIndex}括号中的价格说明无法判断计价单位；明细金额已保留，请核对单价单位。`);
      }
    }

    const product = {
      name: split.name,
      spec: split.spec,
      quantity: Number.isFinite(rawQuantity) ? rawQuantity : 0,
      unit,
      unitPrice: unitPrice ?? 0,
      lineAmount: lineAmount ?? 0,
      priceBasis,
      basisPrice: Number.isFinite(basisPrice) ? basisPrice : 0
    };

    if (unitPrice !== null && lineAmount !== null && rawQuantity > 0) {
      const expected = rawQuantity * unitPrice;
      const difference = Math.abs(expected - lineAmount);
      if (difference > MONEY_WARN_TOLERANCE(rawQuantity)) {
        addUnique(warnings,
          `产品${productIndex}显示小计${lineAmount}元与数量×单价算得${expected}元相差${difference}元，请人工核对。`);
      }
    }

    if (unitPrice !== null && priceBasis !== 'piece' && unit === 'piece' && basisPrice >= 0 && split.spec) {
      const area = specArea(split.spec);
      if (area !== null && Math.abs(basisPrice * area - unitPrice) > 0.02) {
        addUnique(warnings,
          `产品${productIndex}单片价${unitPrice}元与规格面积×每平价算得${basisPrice * area}元不一致，请人工核对。`);
      }
    }

    return product;
  }

  function parseFreightDescriptor(rawValue) {
    let value = String(rawValue || '').trim().replace(/\s*送货\s*$/, '').trim();
    value = value.replace(/^运费\s*[：:]?\s*/, '').trim();
    if (/^(?:仓库自提|工厂自提|自提)$/.test(value)) {
      return { ok: true, logistics: value === '仓库自提' ? '自提' : value, freightPay: '到付', freightAmount: '' };
    }

    let route = '';
    let amountAndPay = value;
    const comma = value.match(/^(.+?)\s*[，,]\s*(.+)$/);
    if (comma && /(?:到付|代付)/.test(comma[2])) {
      route = comma[1].trim();
      amountAndPay = comma[2].trim();
    } else {
      const dash = value.match(/^(.+?)\s*[-－—]\s*(.+)$/);
      if (dash) {
        route = dash[1].trim();
        amountAndPay = dash[2].trim();
      }
    }

    const payMatch = amountAndPay.match(/(到付|代付)\s*$/);
    if (!payMatch) return { ok: false, message: '运费缺少“到付”或“代付”。' };
    const freightPay = payMatch[1];
    const amountText = amountAndPay.slice(0, payMatch.index).trim();
    if (!route && /^[-－−]\s*\d/.test(amountText)) {
      return { ok: false, message: '运费金额不能为负数。' };
    }
    let freightAmount = '';
    if (amountText) {
      const amount = parseMoney(amountText);
      if (amount !== null) {
        freightAmount = amount;
        if (!route) route = '默认';
      } else if (!route) {
        // The generator omits the dash when a selected route has no amount, e.g. 明邦到付.
        route = amountText;
      } else {
        // Recognize common route-without-dash-plus-amount forms without guessing a split.
        return { ok: false, message: `运费“${value}”无法识别；路线与金额之间应有连字符。` };
      }
    } else if (!route) route = '默认';
    return { ok: true, logistics: route || '默认', freightPay, freightAmount };
  }

  function parsePayment(rawPayment, state, errors, warnings, notices) {
    let payment = rawPayment.trim();
    // Allocation is emitted after the deposit suffix, so peel it first.
    const allocationMatch = payment.match(/[（(]([^（）()]*[\u3400-\u9fff][^（）()]*)[）)]\s*$/);
    if (allocationMatch && !/^\s*定金/.test(allocationMatch[1]) && !/尾款/.test(allocationMatch[1]) &&
        (/[，,;；]/.test(allocationMatch[1]) || /分配/.test(allocationMatch[1]) || /\d/.test(allocationMatch[1]))) {
      state.allocation = allocationMatch[1];
      payment = payment.slice(0, allocationMatch.index).trimEnd();
    }
    const depositPattern = /[（(]定金\s*((?:\d+(?:\.\d{1,2})?)|(?:\.\d{1,2}))\s*[，,]\s*尾款\s*((?:\d+(?:\.\d{1,2})?)|(?:\.\d{1,2}))(?:待支付)?[）)]\s*$/;
    const depositMatch = payment.match(depositPattern);
    if (depositMatch) {
      const amount = parseMoney(depositMatch[1]);
      const balance = parseMoney(depositMatch[2]);
      if (amount === null || balance === null) {
        addUnique(errors, '定金或尾款金额无效。');
      } else {
        state.deposit = { amount, balance };
        payment = payment.slice(0, depositMatch.index).trimEnd();
        const expectedBalance = state.total === null ? null : Math.round((state.total - amount) * 100) / 100;
        if (expectedBalance !== null && (expectedBalance < 0 || Math.abs(expectedBalance - balance) > 0.01)) {
          addUnique(warnings, `定金${amount}元与尾款${balance}元和原合计${state.total}元不一致，请人工核对。`);
        }
      }
    } else if (/[（(]定金/.test(payment)) {
      addUnique(errors, '定金/尾款后缀格式无法识别。');
    }

    if (!payment) addUnique(notices, '付款方式为空，请补充后再提交。');
    state.payment = payment;
  }

  function parseDeliveryInfo(rawValue) {
    const parts = String(rawValue || '').split(/[，,]/).map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return { ok: false, missing: true };
    const pickup = parts.find((part) => /^(?:仓库自提|工厂自提|自提)$/.test(part));
    let selected = null;
    for (const part of parts) {
      if (part === pickup) continue;
      const parsed = parseFreightDescriptor(part);
      if (!parsed.ok) return parsed;
      if (selected && (selected.logistics !== parsed.logistics || selected.freightPay !== parsed.freightPay ||
          selected.freightAmount !== parsed.freightAmount)) {
        return { ok: false, message: '检测到多条互相冲突的运费信息。' };
      }
      selected = parsed;
    }
    if (pickup) {
      return {
        ok: true,
        logistics: pickup === '仓库自提' ? '自提' : pickup,
        freightPay: selected?.freightPay || '到付',
        freightAmount: selected?.freightAmount || ''
      };
    }
    return selected || { ok: false, message: '物流信息为空。' };
  }

  function knownShippingLine(line) {
    const value = line.trim();
    return /^(?:DB\s*[：:]?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:KG|公斤|吨)|.*(?:托盘|拖盘|木箱|夹板|包装|公斤|\bKG\b|吨).*)$/i.test(value);
  }

  function isFeeLikeResidual(segment) {
    return /(?:费|DB|KD|税金|扣点|防水|耐磨|打孔|修补剂|保护剂|辅料|胶水|元|=|\d)/i.test(segment);
  }

  function parseDetail(detail, state, errors, warnings, notices) {
    const segments = detail
      .replace(/\r\n?/g, '\n')
      .replace(/\n+/g, '，')
      .split(/[，,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const seenFees = new Set();
    let foundFeeOrProduct = false;

    const feeDefinitions = [
      { key: 'crateFee', names: '木箱费|包装费|包装箱费', display: '木箱/包装费' },
      { key: 'processingFee', names: '加工费', display: '加工费' },
      { key: 'promotionFee', names: '推广费', display: '推广费' },
      { key: 'taxAmount', names: '税金', display: '税金' },
      { key: 'paymentDeduction', names: '扣点', display: '扣点' },
      { key: 'db', names: 'DB', display: 'DB' }
    ];

    for (const segment of segments) {
      const product = parseProduct(segment, errors, warnings, notices, state.products.length + 1);
      if (product) {
        state.products.push(product);
        foundFeeOrProduct = true;
        continue;
      }

      let matchedFee = false;
      for (const definition of feeDefinitions) {
        const labelPattern = definition.key === 'processingFee'
          ? new RegExp(`^加工费(?:[-－—]([^：:]+?))?\\s*[：:]\\s*(${NUMBER})\\s*元?$`, 'i')
          : new RegExp(`^(?:${definition.names})\\s*[：:]?\\s*(${NUMBER})\\s*元?$`, 'i');
        const feeMatch = readAmountLabel(segment, labelPattern);
        if (!feeMatch) continue;
        matchedFee = true;
        foundFeeOrProduct = true;
        if (seenFees.has(definition.key)) {
          addUnique(errors, `${definition.display}重复，请只粘贴一份开单正文。`);
          break;
        }
        seenFees.add(definition.key);
        const amount = parseMoney(feeMatch.raw);
        if (amount === null) addUnique(errors, `${definition.display}金额无效。`);
        else if (definition.key === 'db') state.fees.db = amount;
        else state.fees[definition.key] = amount;
        if (definition.key === 'processingFee' && feeMatch.match[1]) {
          state.processingNote = feeMatch.match[1].trim();
        }
        break;
      }
      if (matchedFee) continue;

      const invalidFeeLabel = segment.match(/^(木箱费|包装费|包装箱费|加工费|推广费|税金|扣点|DB)\s*[：:]?/i);
      if (invalidFeeLabel) {
        addUnique(errors, `字段“${invalidFeeLabel[1]}”金额无法识别或为负数。`);
        continue;
      }

      const kdMatch = segment.match(/^KD\s*[：:]?\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*元?$/i);
      if (kdMatch) {
        foundFeeOrProduct = true;
        if (seenFees.has('sourceKd')) addUnique(errors, 'KD重复，请只粘贴一份开单正文。');
        else {
          seenFees.add('sourceKd');
          state.sourceKd = parseSignedMoney(kdMatch[1]);
          if (state.sourceKd === null) addUnique(errors, 'KD金额无效。');
        }
        continue;
      }
      if (/^KD\s*[：:]?/i.test(segment)) {
        addUnique(errors, 'KD金额无法识别或为负数。');
        continue;
      }

      if (/[：:]\s*[-－−]\s*\d/.test(segment)) {
        addUnique(errors, `字段“${segment.split(/[：:]/, 1)[0]}”金额不能为负数。`);
        continue;
      }

      const hasProductQuantityUnit = /(?:片|张|平方|平|㎡|m²|m2)/i.test(segment);
      const hasBoardSpec = /(?:\d+(?:\.\d+)?\s*(?:mm|毫米)|\d+(?:\.\d+)?\s*[＊*×xX]\s*\d+(?:\.\d+)?)/i.test(segment);
      if (segment.includes('=') && (hasProductQuantityUnit || hasBoardSpec)) {
        addUnique(errors, `产品明细公式无法识别或包含非法数量/金额：“${segment}”。`);
        continue;
      }

      // Other generated accessory / construction charges are returned verbatim. The caller
      // must explicitly decide whether to support them; they are never silently discarded.
      if (isFeeLikeResidual(segment)) {
        state.extraLines.push(segment);
        addUnique(notices, `发现暂未自动回填的附加费用或明细：“${segment}”；请人工核对。`);
        foundFeeOrProduct = true;
      } else {
        state.extraLines.push(segment);
        addUnique(notices, `货物明细中有未映射文本：“${segment}”；原文已保留。`);
      }
    }

    if (!state.products.length) addUnique(errors, '没有识别到可回填的产品明细公式。');
    if (!foundFeeOrProduct && !segments.length) addUnique(errors, '货物明细为空。');
    // The order-entry UI has a five-product limit. Preserve any additional parsed products;
    // the caller blocks the import based on products.length instead of losing source lines.
    return { seenFees };
  }

  function parse(input) {
    const errors = [];
    const warnings = [];
    const notices = [];
    const state = createState();
    const result = () => ({ ok: errors.length === 0, errors, warnings, notices, state });
    const source = String(input ?? '').replace(/\r\n?/g, '\n');
    if (!source.trim()) {
      addUnique(errors, '请先粘贴一份完整开单正文。');
      return result();
    }
    if (source.length > 60000) {
      addUnique(errors, '原文过长，请只粘贴一份开单正文（不超过60000字）。');
      return result();
    }

    const orderPattern = /\d{6,14}-[^\n：:]{1,60}[：:]\s*绿活-张苗苗\d*\s*[：:]/g;
    const orderStarts = Array.from(source.matchAll(orderPattern));
    if (orderStarts.length === 0) {
      addUnique(errors, '未识别到“单号-仓库：绿活-张苗苗X：”开单标题。');
      return result();
    }
    if (orderStarts.length > 1) addUnique(errors, '检测到两张或多张订单，请每次只粘贴一张。');

    const firstStart = orderStarts[0];
    const header = firstStart[0].match(/^(\d{6,14})-([^\n：:]{1,60})[：:]\s*绿活-张苗苗(\d*)\s*[：:]$/);
    if (!header) {
      addUnique(errors, '开单标题结构无法识别。');
      return result();
    }
    state.sourceOrderNo = header[1];
    state.warehouse = header[2].trim();
    state.greenCount = header[3] || '0';
    if (!state.warehouse) addUnique(errors, '标题中缺少仓库名称。');

    const beforeOrder = source.slice(0, firstStart.index).split('\n').map((line) => line.trim()).filter(Boolean);
    const freightHeaders = [];
    for (const line of beforeOrder) {
      const parsed = parseFreightDescriptor(line);
      if (parsed.ok) freightHeaders.push({ raw: line, parsed });
      else if (/^@\S/.test(line)) addUnique(state.mentions, line);
      else {
        state.extraLines.push(line);
        addUnique(notices, '开单标题前有未映射内容：“' + line + '”；原文已保留。');
      }
    }
    if (freightHeaders.length > 1) addUnique(errors, '物流摘要首行重复，请只保留一条。');

    const body = source.slice(firstStart.index + firstStart[0].length);
    const fieldDefinitions = [
      ['detail', '货物明细'], ['total', '合计'], ['payment', '付款方式'], ['remark', '备注']
    ];
    const fields = {};
    for (const [key, label] of fieldDefinitions) {
      const regex = new RegExp('[,，]\\s*' + label + '\\s*[：:]', 'g');
      fields[key] = Array.from(body.matchAll(regex), (match) => ({ index: match.index, marker: match[0] }));
      if (fields[key].length > 1) addUnique(errors, label + '重复，请只粘贴一份开单正文。');
    }
    if (!fields.detail.length) addUnique(errors, '缺少货物明细字段。');
    for (const [key, label] of fieldDefinitions.slice(1)) {
      if (!fields[key].length) addUnique(notices, '缺少' + label + '字段，请补充。');
    }
    if (!fields.detail.length) return result();

    const firstField = (key) => fields[key][0] || null;
    const presentFields = fieldDefinitions.map(([key]) => ({ key, value: firstField(key) }))
      .filter((item) => item.value)
      .sort((a, b) => a.value.index - b.value.index);
    const expectedOrder = presentFields.map((item) => item.key).sort((a, b) =>
      fieldDefinitions.findIndex(([key]) => key === a) - fieldDefinitions.findIndex(([key]) => key === b));
    if (presentFields.some((item, index) => item.key !== expectedOrder[index])) {
      addUnique(errors, '订单字段顺序异常，请粘贴完整且未被重排的开单正文。');
    }

    const markerEnd = (key) => firstField(key).index + firstField(key).marker.length;
    const nextFieldIndex = (key) => {
      const index = firstField(key).index;
      return presentFields.find((item) => item.value.index > index)?.value.index ?? body.length;
    };
    const detailMarker = firstField('detail');
    const beforeDetail = body.slice(0, detailMarker.index);

    const splitSegments = (value) => value.split(/[，,]/).map((part) => part.trim());
    const looksLikeDelivery = (part) =>
      /^(?:运费\s*[：:]?\s*)?(?:仓库自提|工厂自提|自提)(?:\s*送货)?$/.test(part) ||
      /^(?:运费\s*[：:]?\s*)?.*(?:到付|代付)(?:\s*送货)?$/.test(part);
    let addressPrefix = '';
    const applyReceiverTag = (value) => {
      const tagMatch = value.trim().replace(/[，,]\s*$/, '').match(/^(.+?)-(.+)$/);
      if (!tagMatch) return false;
      state.xCode = tagMatch[1].trim();
      const receiverText = tagMatch[2].trim();
      const trailingAddress = receiverText.match(/^(\S+)\s+(.+)$/);
      if (trailingAddress && /[省市区县镇乡路街道巷号]/.test(trailingAddress[2])) {
        state.receiver.name = trailingAddress[1];
        addressPrefix = trailingAddress[2].trim();
      } else state.receiver.name = receiverText;
      return Boolean(state.xCode && state.receiver.name);
    };
    const applyDelivery = (segments) => {
      const items = segments.map((part) => part.trim()).filter(Boolean);
      const deliveryIndex = items.findIndex(looksLikeDelivery);
      if (deliveryIndex < 0) {
        state.receiver.address = [addressPrefix, items.join('，')].filter(Boolean).join('，').trim();
        return;
      }
      state.receiver.address = [addressPrefix, items.slice(0, deliveryIndex).join('，')].filter(Boolean).join('，').trim();
      const freight = parseDeliveryInfo(items.slice(deliveryIndex).join('，'));
      if (!freight.ok) addUnique(errors, '物流信息无法识别：' + (freight.message || '物流信息为空。'));
      else {
        state.logistics = freight.logistics;
        state.freightPay = freight.freightPay;
        state.freightAmount = freight.freightAmount;
      }
    };

    const phoneMatches = Array.from(beforeDetail.matchAll(/(?<!\d)(\+?\d[\d\s()\-]{5,}\d)(?!\d)/g));
    const validPhone = phoneMatches.find((match) => {
      const digits = match[1].replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    });
    if (validPhone) {
      applyReceiverTag(beforeDetail.slice(0, validPhone.index));
      state.receiver.phone = validPhone[1].trim();
      const suffix = beforeDetail.slice(validPhone.index + validPhone[0].length).replace(/^[，,]\s*/, '');
      applyDelivery(splitSegments(suffix));
    } else {
      const parts = splitSegments(beforeDetail);
      applyReceiverTag(parts[0] || '');
      // If the name/phone text was removed from a pickup order, the route may now
      // immediately follow the X-code (for example, "X-仓库自提"). Do not mistake
      // that route for a receiver name; pass it through the normal delivery parser.
      const taggedDelivery = state.receiver.name && looksLikeDelivery(state.receiver.name)
        ? state.receiver.name
        : '';
      if (taggedDelivery) state.receiver.name = '';
      applyDelivery([taggedDelivery, ...parts.slice(1)]);
      addUnique(notices, '收货电话未识别，请补充。');
    }
    if (!state.receiver.name) addUnique(notices, '收货人未识别，请补充。');
    const phoneDigits = state.receiver.phone.replace(/\D/g, '');
    if (state.receiver.phone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      addUnique(notices, '收货电话格式异常，请核对。');
      state.receiver.phone = '';
    }

    const detailText = body.slice(markerEnd('detail'), nextFieldIndex('detail')).trim();
    const detailMetadata = parseDetail(detailText, state, errors, warnings, notices);

    if (firstField('total')) {
      const totalValue = body.slice(markerEnd('total'), nextFieldIndex('total')).trim();
      if (!totalValue) addUnique(notices, '合计金额为空，请补充。');
      else {
        const total = parseMoney(totalValue);
        if (total === null) addUnique(errors, '合计金额无法识别；仅支持非负、最多两位小数的金额。');
        else state.total = total;
      }
    }

    if (firstField('payment')) {
      const rawPayment = body.slice(markerEnd('payment'), nextFieldIndex('payment'));
      parsePayment(rawPayment, state, errors, warnings, notices);
    }

    if (firstField('remark')) {
      const rawRemark = body.slice(markerEnd('remark'));
      const retainedLines = [];
      for (const line of rawRemark.split('\n')) {
        if (/^\s*@\S/.test(line)) addUnique(state.mentions, line.trim());
        else retainedLines.push(line);
      }
      state.remark = retainedLines.shift() || '';
      const trailing = retainedLines.map((line) => line.trim()).filter(Boolean);
      if (trailing.length && trailing.every(knownShippingLine)) {
        state.shippingSummary = trailing.join('\n');
        let summaryDbSeen = false;
        for (const line of trailing) {
          const dbMatch = line.match(/^DB\s*[：:]?\s*(\d+(?:\.\d{1,2})?)$/i);
          if (dbMatch) {
            if (summaryDbSeen || detailMetadata.seenFees.has('db')) addUnique(errors, 'DB在正文或物流摘要中重复。');
            else state.fees.db = Number(dbMatch[1]);
            summaryDbSeen = true;
          }
        }
      } else if (trailing.length) {
        state.extraLines.push(...trailing);
        addUnique(notices, '备注后的附加文本已保留，请人工核对：“' + trailing.join('；') + '”。');
      }
      if (!state.remark.trim()) addUnique(notices, '备注内容为空，请补充。');
    }

    if (freightHeaders.length === 1) {
      const headerFreight = freightHeaders[0].parsed;
      state.shippingSummary = [freightHeaders[0].raw, state.shippingSummary].filter(Boolean).join('\n');
      if (!state.logistics) {
        state.logistics = headerFreight.logistics;
        state.freightPay = headerFreight.freightPay;
        state.freightAmount = headerFreight.freightAmount;
      } else if (state.logistics !== headerFreight.logistics || state.freightPay !== headerFreight.freightPay ||
          state.freightAmount !== headerFreight.freightAmount) {
        addUnique(errors, '首行物流摘要与正文物流字段不一致，请核对后再导入。');
      }
    }

    if (!state.logistics) addUnique(notices, '物流方式未识别，请补充；不会默认选择物流。');
    if (!state.receiver.address && state.logistics !== '自提' && state.logistics !== '工厂自提') {
      addUnique(notices, '收货地址未填写，请补充；自提可留空。');
    }
    if (!firstField('remark')) addUnique(notices, '备注内容为空，请补充。');

    return result();
  }

  const api = { parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OrderImportCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
