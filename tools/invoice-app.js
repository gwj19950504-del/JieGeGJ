(function () {
  'use strict';
  const core = window.InvoiceCore;
  const byId = id => document.getElementById(id);
  const ledgerKey = 'jiege.invoice-preview.monthly-sequence.v1';
  let mode = 'individual';
  let committed = null;
  let copyBusy = false;
  let manualPending = null;
  let manualMonth = false;
  let storageError = '';
  let observedMonth = core.monthNow();
  byId('invoiceMonth').value = observedMonth;

  const checked = name => document.querySelector(`input[name="${name}"]:checked`).value;
  function readState() {
    return {
      mode, individual: checked('individual'), company: checked('company'),
      month: byId('invoiceMonth').value, sequence: byId('sequence').value,
      payOnInvoice: byId('payOnInvoice').checked,
      customerRaw: byId('customerRaw').value,
      product: byId('product').value, quantity: byId('quantity').value, unit: byId('unit').value,
      total: byId('total').value, remark: byId('remark').value
    };
  }
  function readLedger() {
    try {
      const ledger = core.readLedger(localStorage.getItem(ledgerKey));
      storageError = '';
      return ledger;
    } catch (e) {
      storageError = `无法读取本机流水号：${e.message}。请先核对浏览器存储及已用编号，勿默认从001重开。`;
      throw new Error(storageError);
    }
  }
  function refreshNumber() {
    if (!core.validMonth(byId('invoiceMonth').value)) { byId('sequence').value = ''; return; }
    try { byId('sequence').value = String(core.nextSequence(readLedger(), byId('invoiceMonth').value)).padStart(3, '0'); }
    catch (e) { byId('sequence').value = ''; status(e.message, true); }
  }
  function status(text, error = false) {
    byId('copyStatus').textContent = text;
    byId('copyStatus').classList.toggle('error', error);
  }
  function discardManualPending() {
    manualPending = null;
    byId('manualCopiedBtn').hidden = true;
  }
  function render() {
    const state = readState();
    const built = core.build(state);
    byId('sellerName').textContent = core.individuals[state.individual].name;
    byId('individualFields').hidden = mode !== 'individual';
    byId('companyFields').hidden = mode !== 'company';
    for (const [id, selected] of [['individualMode', mode === 'individual'], ['companyMode', mode === 'company']]) {
      byId(id).classList.toggle('active', selected);
      byId(id).setAttribute('aria-pressed', String(selected));
    }
    byId('typeBadge').textContent = mode === 'individual' ? '普票' : core.companies[state.company].type;
    byId('unitPrice').textContent = built.line?.unitPrice || '—';
    byId('priceUnit').textContent = `元 / ${state.unit}`;
    byId('result').value = built.text;
    const errors = [...built.errors];
    if (storageError && mode === 'individual') errors.push(storageError);
    const hasData = Boolean(state.customerRaw || state.product || state.quantity || state.total);
    byId('validation').textContent = errors.length ? (hasData ? errors.join('；') : '粘贴客户资料并填写开票明细后生成。') : '申请已生成，客户资料按原文保留，请核对后复制。';
    byId('validation').classList.toggle('invalid', hasData && errors.length > 0);
    byId('copyInvoiceBtn').disabled = copyBusy || errors.length > 0;
    byId('sequenceHint').textContent = committed
      ? `本单编号 ${committed.month.slice(-2)}-${String(committed.sequence).padStart(3, '0')} 已登记。重复复制不递增；新单请点“下一份申请”。`
      : '三家共用月度流水号，复制成功后登记；本月首次使用可按已有申请校正编号。';
    return { state, built, ready: errors.length === 0 };
  }
  function isCommitted(state) {
    return committed && committed.month === state.month && committed.sequence === Number(state.sequence) && committed.individual === state.individual;
  }
  async function clipboard(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      byId('result').focus();
      byId('result').select();
      try { return document.execCommand('copy'); } catch (_) { return false; }
    }
  }
  async function withNumberLock(callback) {
    if (navigator.locks?.request) return navigator.locks.request('jiege-invoice-monthly-number', callback);
    return callback();
  }
  async function copyApplication(manual = false) {
    if (copyBusy) return;
    const current = render();
    if (!current.ready) return;
    if (manual && (!manualPending || manualPending.text !== current.built.text)) {
      discardManualPending(); status('申请内容已变化，请重新复制。', true); return;
    }
    copyBusy = true;
    document.querySelector('.form-panel').inert = true;
    byId('nextBtn').disabled = true;
    render();
    try {
      await withNumberLock(async () => {
        const { state, built } = current;
        const needsNumber = state.mode === 'individual' && !isCommitted(state);
        let updatedLedger = null;
        if (needsNumber) {
          const ledger = readLedger();
          try { updatedLedger = core.recordSequence(ledger, state.month, state.sequence); }
          catch (e) {
            refreshNumber();
            throw new Error(`${e.message}。已带出下一个可用编号，请核对后再次复制。`);
          }
          // Check storage access without consuming a number before touching the clipboard.
          try { localStorage.setItem(ledgerKey, JSON.stringify(ledger)); }
          catch (_) { storageError = '本浏览器不能保存流水号，暂不登记编号，请检查存储权限。'; throw new Error(storageError); }
        }
        if (!manual && !await clipboard(built.text)) {
          manualPending = { text: built.text };
          byId('manualCopiedBtn').hidden = false;
          status('浏览器未允许自动复制，已选中文字。请手动复制，再点击下方确认按钮；此时尚未登记编号。', true);
          return;
        }
        if (needsNumber) {
          committed = { month: state.month, sequence: Number(state.sequence), individual: state.individual };
          try { localStorage.setItem(ledgerKey, JSON.stringify(updatedLedger)); }
          catch (_) {
            storageError = '文字已复制，但编号未能保存。请人工记录本单编号，暂勿继续自动编号。';
            throw new Error(storageError);
          }
        }
        discardManualPending();
        status(state.mode === 'individual'
          ? `已${manual ? '确认手动' : ''}复制；本单 ${state.month.slice(-2)}-${String(Number(state.sequence)).padStart(3, '0')} 已登记，重复复制不会跳号。`
          : `已${manual ? '确认手动' : ''}复制申请文字。公司开票不占用个体户流水号。`);
      });
    } catch (e) { status(e.message, true); }
    finally {
      copyBusy = false;
      document.querySelector('.form-panel').inert = false;
      byId('nextBtn').disabled = false;
      render();
    }
  }
  function nextApplication() {
    committed = null;
    discardManualPending();
    for (const id of ['customerRaw', 'product', 'quantity', 'total', 'remark']) byId(id).value = '';
    byId('payOnInvoice').checked = false;
    if (!manualMonth) byId('invoiceMonth').value = core.monthNow();
    refreshNumber();
    status('');
    render();
    byId('customerRaw').focus();
  }
  function selectMode(value) {
    if (value === mode) return;
    mode = value;
    committed = null;
    discardManualPending();
    if (mode === 'individual') refreshNumber();
    status('');
    render();
  }
  byId('individualMode').addEventListener('click', () => selectMode('individual'));
  byId('companyMode').addEventListener('click', () => selectMode('company'));
  byId('invoiceMonth').addEventListener('change', () => { manualMonth = true; committed = null; refreshNumber(); discardManualPending(); status(''); render(); });
  byId('sequence').addEventListener('input', () => { if (committed && committed.sequence !== Number(byId('sequence').value)) committed = null; });
  document.querySelectorAll('input[name="individual"]').forEach(input => input.addEventListener('change', () => {
    if (committed) { committed = null; refreshNumber(); }
    status(''); render();
  }));
  document.querySelectorAll('.form-panel input, .form-panel select, .form-panel textarea').forEach(input => {
    input.addEventListener('input', () => { discardManualPending(); status(''); render(); });
    input.addEventListener('change', () => { discardManualPending(); status(''); render(); });
  });
  byId('copyInvoiceBtn').addEventListener('click', () => copyApplication());
  byId('manualCopiedBtn').addEventListener('click', () => copyApplication(true));
  byId('nextBtn').addEventListener('click', nextApplication);
  byId('demoBtn').addEventListener('click', () => {
    if ([byId('customerRaw').value, byId('product').value].some(Boolean)
        && !confirm('示例会替换当前客户资料和商品明细，继续吗？')) return;
    // Demonstration data is fictitious; real customer bank details stay out of the shipped page.
    byId('customerRaw').value = '名称：示例客户有限公司\n纳税人识别号：91310000DEMO000001\n地址：上海市示例路100号\n电话：021-00000000\n开户银行：示例银行示例支行\n银行账号：0000000000000001';
    byId('product').value = mode === 'individual' ? '水泥板' : '鎏金水泥板';
    byId('quantity').value = mode === 'individual' ? '4' : '7';
    byId('total').value = mode === 'individual' ? '1294' : '2556';
    byId('unit').value = '片';
    byId('remark').value = '';
    discardManualPending();
    render();
    status('已填入虚构示例，仅用于查看效果。');
  });
  window.addEventListener('storage', event => {
    if (event.key !== ledgerKey || committed || mode !== 'individual') return;
    status('其他页面已更新月度流水，请复制前核对编号。');
  });
  window.addEventListener('focus', () => {
    const month = core.monthNow();
    if (!manualMonth && !committed && month !== observedMonth) {
      observedMonth = month;
      byId('invoiceMonth').value = month;
      refreshNumber(); render();
    }
  });
  refreshNumber();
  render();
})();
