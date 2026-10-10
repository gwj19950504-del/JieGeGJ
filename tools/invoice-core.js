(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.InvoiceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const individuals = {
    yunmiao: { short: '云苗', owner: '高炜杰', name: '义乌市云苗贸易商行（个体工商户）' },
    anmiao: { short: '安苗', owner: '张静静', name: '义乌市安苗贸易商行（个体工商户）' },
    yuemiao: { short: '悦苗', owner: '张振虎', name: '义乌市悦苗贸易商行（个体工商户）' }
  };
  const companies = {
    greenlive: { name: '绿活', type: '专票' },
    jianan: { name: '嘉南', type: '专票' },
    xinchengde: { name: '鑫成德', type: '普票' },
    yongpei: { name: '上海永沛', type: '普票' }
  };
  const clean = value => String(value ?? '').trim();
  function decimal(value, maxPlaces, label) {
    const raw = clean(value);
    if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error(`请填写有效的${label}，不要包含单位或其它字符`);
    const [whole, fraction = ''] = raw.split('.');
    if (whole.length > 12 || fraction.length > maxPlaces) throw new Error(`${label}最多12位整数、${maxPlaces}位小数`);
    const digits = BigInt(whole + fraction);
    if (digits <= 0n) throw new Error(`${label}须大于0`);
    const normalizedWhole = BigInt(whole).toString();
    const normalizedFraction = fraction.replace(/0+$/, '');
    return { digits, scale: fraction.length, text: normalizedWhole + (normalizedFraction ? '.' + normalizedFraction : '') };
  }
  function calculateLine(product, quantity, unit, total) {
    if (!clean(product)) throw new Error('请填写商品名称');
    if (!['片', '平'].includes(unit)) throw new Error('请选择片或平');
    const q = decimal(quantity, 6, '数量');
    const amount = decimal(total, 2, '开票总金额');
    // Exact decimal arithmetic: truncate the quotient to four places, never round it.
    const scaledPrice = amount.digits * (10n ** BigInt(q.scale + 4)) / (q.digits * (10n ** BigInt(amount.scale)));
    if (scaledPrice <= 0n) throw new Error('单价小于0.0001元，请核对数量和总金额');
    const priceWhole = scaledPrice / 10000n;
    const priceFraction = (scaledPrice % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
    const unitPrice = priceWhole.toString() + (priceFraction ? '.' + priceFraction : '');
    return { unitPrice, quantity: q.text, total: amount.text,
      text: `${clean(product)}*${q.text}${unit}*${unitPrice}=${amount.text}` };
  }
  function validMonth(month) { return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(month)); }
  function validSequence(value) { return /^\d{1,6}$/.test(String(value)) && Number(value) > 0 && Number(value) <= 999999; }
  function monthNow(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(date);
    return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
  }
  function emptyLedger() { return { version: 1, months: {} }; }
  function readLedger(text) {
    if (text === null || text === undefined) return emptyLedger();
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 1 || !parsed.months || typeof parsed.months !== 'object' || Array.isArray(parsed.months)) throw new Error('流水记录格式异常，请勿直接从001重新编号');
    const months = {};
    for (const [month, last] of Object.entries(parsed.months)) {
      if (!validMonth(month) || !Number.isSafeInteger(last) || last < 0 || last > 999999) throw new Error('流水记录异常，请核对本月已用编号');
      months[month] = last;
    }
    return { version: 1, months };
  }
  function nextSequence(ledger, month) {
    if (!validMonth(month)) throw new Error('请选择有效的开票月份');
    const next = (ledger.months[month] || 0) + 1;
    if (next > 999999) throw new Error('本月编号已超上限，请人工核对');
    return next;
  }
  function recordSequence(ledger, month, sequence) {
    if (!validMonth(month) || !validSequence(sequence)) throw new Error('月份或流水号无效');
    const number = Number(sequence);
    if (number <= (ledger.months[month] || 0)) throw new Error('该编号在本浏览器已使用，请使用下一个编号');
    return { version: 1, months: { ...ledger.months, [month]: number } };
  }
  function build(state) {
    const errors = [];
    const warnings = [];
    let line;
    try { line = calculateLine(state.product, state.quantity, state.unit, state.total); } catch (e) { errors.push(e.message); }
    // Customer text is user-owned: never parse, normalize, reorder or trim it.
    const customer = String(state.customerRaw ?? '');
    if (!customer.trim()) errors.push('请粘贴客户开票资料');
    let heading = '';
    let type = '';
    if (state.mode === 'individual') {
      const seller = individuals[state.individual];
      if (!seller) errors.push('请选择个体户');
      if (!validMonth(state.month)) errors.push('请选择有效的开票月份');
      if (!validSequence(state.sequence)) errors.push('流水号须为1至999999的整数');
      if (seller && validMonth(state.month) && validSequence(state.sequence)) {
        heading = `开票${state.month.slice(-2)}-${String(Number(state.sequence)).padStart(3, '0')}\n法人：${seller.owner}\n名称：${seller.name}\n----------------------------------\n开票资料`;
      }
      type = '普票';
    } else if (state.mode === 'company') {
      const company = companies[state.company];
      if (!company) errors.push('请选择公司开票模板');
      if (company && line) {
        heading = `${company.name}-${company.type}-${line.total}${state.payOnInvoice ? '（见票付款）' : ''}`;
        type = company.type;
      }
    } else errors.push('请选择开票类别');
    if (errors.length) return { ok: false, errors, warnings, text: '', line, type };
    const remark = clean(state.remark);
    return { ok: true, errors, warnings, type, line, text: `${heading}\n\n${customer}\n\n${line.text}${remark ? '\n\n备注：' + remark : ''}` };
  }
  return { individuals, companies, calculateLine, build, monthNow, validMonth, validSequence, readLedger, nextSequence, recordSequence, emptyLedger };
});
