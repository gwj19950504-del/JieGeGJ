const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, 'tools', file), 'utf8'); }
function functionSource(file, name) {
    const source = read(file);
    const match = new RegExp(`^([ \\t]*)function ${name}\\(`, 'm').exec(source);
    assert.ok(match, name);
    const closing = new RegExp(`^${match[1]}\\}`, 'gm');
    closing.lastIndex = match.index;
    for (let end; (end = closing.exec(source));) {
        const candidate = source.slice(match.index, end.index + end[0].length);
        try { new vm.Script(`(${candidate})`); return candidate; } catch {}
    }
    throw new Error(name);
}
function load(file) {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(read(file), context);
    return context.window;
}

test('鎏金公共核心拒绝小数负数非数，不静默取整或忽略混装中的错误项', () => {
    const core = load('freight-gold-core.js').GoldFreightCore;
    const valid = { material: 'hard', specKey: 'hard-2440', quantity: 2 };
    assert.equal(core.calculateShipment([valid]).totalWeight, 106);
    assert.equal(core.calculateShipment([valid]).pkg.output, '2米托盘');
    for (const quantity of [1.5, -1, '1abc', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal(core.calculateShipment([valid, { ...valid, quantity }]).ok, false);
        assert.equal(core.calculateDb([valid, { ...valid, quantity }]), null);
    }
    assert.equal(core.calculateShipment([valid, { ...valid, quantity: '' }]).totalWeight, 106);
});

test('宁波页面不在送入公共核心之前截断数量', () => {
    const context = {
        els: { qty: { value: '1.5' }, crateThickness: { value: '8' }, kgPerSqm: { value: '10' } },
        selectedProduct: { name: '脉络石' }, selectedSize: '2800*990',
        productFamily: () => 'flat', selectedFinishType: () => 'print'
    };
    vm.createContext(context);
    vm.runInContext(functionSource('ningbo-weight.html', 'currentShipmentItem'), context);
    for (const value of ['1.5', '-1', '0', '', 'abc']) {
        context.els.qty.value = value;
        assert.equal(context.currentShipmentItem(), null);
    }
    context.els.qty.value = '3';
    assert.equal(context.currentShipmentItem().qty, 3);
});

test('公用数字校验忽略隐藏旧仓与禁用输入，保留当前错误并标注', () => {
    const helper = load('input-validation.js').InputValidation;
    function input(visible, disabled, valid) {
        return { value: '-1', disabled, validity: { valid }, labels: [{ textContent: '合计' }],
            validationMessage: '必须大于或等于0', attributes: {},
            getClientRects: () => visible ? [{}] : [],
            removeAttribute(name) { delete this.attributes[name]; },
            setAttribute(name, value) { this.attributes[name] = value; } };
    }
    const hidden = input(false, false, false), disabled = input(true, true, false), active = input(true, false, false);
    assert.equal(helper.numberError({ querySelectorAll: () => [hidden, disabled] }), '');
    assert.match(helper.numberError({ querySelectorAll: () => [hidden, active] }), /合计填写无效/);
    assert.equal(active.attributes['aria-invalid'], 'true');
    active.value = '100'; active.validity.valid = true;
    assert.equal(helper.numberError({ querySelectorAll: () => [active] }), '');
    assert.equal(active.attributes['aria-invalid'], undefined);
});

test('开单未知规格仅在确认单片价或人工明细加材料额齐全时放行', () => {
    const row = { qty: { value: '2' }, unitPrice: { value: '' }, specText: { value: 'UNKNOWN' } };
    let catalog = false, numberError = '';
    const context = {
        window: { InputValidation: { numberError: () => numberError } }, document: {},
        currentCategory: () => 'other', isCatalogWarehouseActive: () => catalog,
        els: { otherMaterialAmount: { value: '' }, otherDetail: { value: '' } },
        otherRows: () => [row], areaFromSpecText: (value) => value === '1200*600' ? 0.72 : 0
    };
    vm.createContext(context);
    vm.runInContext(functionSource('order-template.html', 'orderValidationError'), context);
    assert.match(context.orderValidationError(), /规格无法识别/);
    context.els.otherDetail.value = '人工明细';
    assert.match(context.orderValidationError(), /规格无法识别/);
    context.els.otherMaterialAmount.value = '200';
    assert.equal(context.orderValidationError(), '');
    catalog = true;
    assert.match(context.orderValidationError(), /规格无法识别/);
    row.unitPrice.value = '100';
    assert.equal(context.orderValidationError(), '');
    row.unitPrice.value = ''; row.specText.value = '1200*600';
    assert.equal(context.orderValidationError(), '');
    numberError = '合计负数';
    assert.equal(context.orderValidationError(), numberError);
});

test('文字报价单多产品平方计价拦截无效规格，按张和合法人工正文保留', () => {
    const product = { quantity: 2, spec: 'UNKNOWN', pricingMode: 'area' };
    const context = {
        window: { InputValidation: { numberError: () => '' } }, document: { querySelector: () => ({}) },
        quoteManuallyEdited: false, els: { multiMode: { checked: true } },
        getProductCards: () => [product], readProductCard: (item) => item,
        parseSpec: (value) => value === '1200*600' ? { width: 1.2, height: 0.6 } : null
    };
    vm.createContext(context);
    vm.runInContext(functionSource('quote-generator.html', 'quoteValidationError'), context);
    assert.match(context.quoteValidationError(), /规格无法识别/);
    product.pricingMode = 'sheet';
    assert.equal(context.quoteValidationError(), '');
    product.pricingMode = 'area'; product.spec = '1200*600';
    assert.equal(context.quoteValidationError(), '');
    product.spec = 'UNKNOWN'; context.quoteManuallyEdited = true;
    assert.equal(context.quoteValidationError(), '');
});

test('报价面积解析拒绝零尺寸，多产品合计位于费用区而非独立网格列', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(functionSource('quote-generator.html', 'parseSpec'), context);
    for (const text of ['0*600', '1200*0', 'UNKNOWN']) assert.equal(context.parseSpec(text), null);
    assert.equal(context.parseSpec('1200*600').width, 1.2);
    const html = read('quote-generator.html');
    assert.match(html, /id="calcLine"[^\n]*\n\s*<div id="multiCalcLine"/);
    assert.match(html, /for="manualTaxFee"[^>]*>税金（元）<\/label>/);
});
