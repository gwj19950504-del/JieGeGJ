const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'tools', file), 'utf8');

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

function loadFunctions(context, file, names) {
    vm.createContext(context);
    for (const name of names) vm.runInContext(functionSource(file, name), context);
    return context;
}

test('开单金额正常展示为片数乘单片价等于小计，不插入舍入解释', () => {
    const context = loadFunctions({}, 'order-template.html', ['money', 'piecePriceDetail']);
    assert.equal(context.piecePriceDetail(3, 208.376, 625.128), '3片*208.38=625.13');
    assert.equal(context.piecePriceDetail(5, 208.376, 1041.88), '5片*208.38=1041.88');
    assert.equal(context.piecePriceDetail(6, 208.376, 1250.256), '6片*208.38=1250.26');
    assert.equal(context.piecePriceDetail(1000, 208.376, 208376), '1000片*208.38=208376');
    assert.equal(context.piecePriceDetail(6, 208.38, 1250.28), '6片*208.38=1250.28');
    assert.equal(context.piecePriceDetail(28, 216, 6048), '28片*216=6048');
    assert.equal(context.piecePriceDetail(0, 208.376, 0), '0片*208.38=0');
});

test('历史约单价括号只转正常明细，兼容中文英文标点、换行和重复复制', () => {
    const context = loadFunctions({}, 'order-template.html', ['normalizeLegacyPiecePriceNotes']);
    const old = '货物明细：测试板1220*2440*6mm*5片（单片约208.38元，小计1041.88元）（70/平）\nKD：338.12，备注：【货好拍照】';
    const expected = '货物明细：测试板1220*2440*6mm*5片*208.38=1041.88（70/平）\nKD：338.12，备注：【货好拍照】';
    assert.equal(context.normalizeLegacyPiecePriceNotes(old), expected);
    assert.equal(context.normalizeLegacyPiecePriceNotes(expected), expected);
    assert.equal(context.normalizeLegacyPiecePriceNotes('5片 ( 单片约208.38元,\n小计1041.88元 )'), '5片*208.38=1041.88');
    // Old explanations after a hand-written formula must not replace its amounts.
    assert.equal(context.normalizeLegacyPiecePriceNotes('3片*208.376=635.128（单片约208.38元，小计625.13元）'), '3片*208.376=635.128');
    assert.equal(context.normalizeLegacyPiecePriceNotes('（单片约208.38元，小计1041.88元）'), '');
});

test('历史解释清理不动其它括号、手工金额、备注或近似但非旧格式的文字', () => {
    const context = loadFunctions({}, 'order-template.html', ['normalizeLegacyPiecePriceNotes']);
    for (const text of ['', '艺术板(粉黛雪融)5片*208.38=1041.88（70/平）',
        '备注：小计待确认（单片价格待定），😀谢谢', '（单片约208.38元，小计待确认）',
        '（单片约' + '1'.repeat(10000) + 'x元，小计20元）']) {
        assert.equal(context.normalizeLegacyPiecePriceNotes(text), text);
    }
});

test('鎏金及其它品类共用正常开单格式，保留原始金额与手工单价', () => {
    const spec = { value: 'test', label: '硬质-1220*2440*6mm', width: 1.22, length: 2.44 };
    const context = loadFunctions({
        currentWarehouse: () => 'zhejiang', currentCategory: () => 'liujin',
        activeBoardSpecs: () => [spec], usesManualSpec: () => false,
        areaFromSpecText: () => 1.22 * 2.44
    }, 'order-template.html', ['money', 'piecePriceDetail', 'numberValue', 'liujinSpecForDetail', 'readLiujinProduct', 'readOtherProduct']);
    const row = Object.fromEntries(Object.entries({
        productName: '测试板', specSelect: 'test', specText: '1220*2440', qty: '6', sqmPrice: '70', unitPrice: ''
    }).map(([key, value]) => [key, { value }]));
    const expected = 70 * (1.22 * 2.44) * 6;
    for (const product of [context.readLiujinProduct(row), context.readOtherProduct(row)]) {
        assert.equal(product.materialAmount, expected);
        assert.match(product.detail, /6片\*208.38=1250.26/);
        assert.doesNotMatch(product.detail, /单片约|小计/);
        assert.match(product.detail, /（70\/平）$/);
    }
    row.unitPrice.value = '216';
    const manual = context.readOtherProduct(row);
    assert.equal(manual.materialAmount, 1296);
    assert.match(manual.detail, /6片\*216=1296（216\/片）$/);
});

test('四项混装案例不把显示舍入反算进材料费与KD', () => {
    const context = loadFunctions({
        areaFromSpecText: spec => spec === '1200*2440mm' ? 1.2 * 2.44 : 1.22 * 2.44
    }, 'order-template.html', ['money', 'piecePriceDetail', 'numberValue', 'readOtherProduct']);
    const products = [
        ['1200*2440mm', '1', '100'], ['1200*2440mm', '1', '80'],
        ['1220*2440*6mm', '3', '70'], ['1220*2440*6mm', '7', '75']
    ].map(([specText, qty, sqmPrice]) => context.readOtherProduct(Object.fromEntries(
        Object.entries({ productName: '测试板', specText, qty, sqmPrice, unitPrice: '' })
            .map(([key, value]) => [key, { value }])
    )));
    assert.equal(products[2].detail, '测试板1220*2440*6mm*3片*208.38=625.13（70/平）');
    assert.equal(products[2].materialAmount, 625.128);
    const material = products.reduce((sum, product) => sum + product.materialAmount, 0);
    assert.equal(context.money(material), '2714.99');
    assert.equal(context.money(3800 - 200 - material), '885.01');
    assert.doesNotMatch(products.map(product => product.detail).join('\n'), /单片约|小计/);
});

test('墙面列表统一宽乘高并转义名称，不改变墙面几何或选中项', () => {
    const walls = [
        { name: '自定义墙 1', wallW: 3888, wallH: 2289 },
        { name: '<测试墙>', wallW: 1022, wallH: 2375 },
        { name: '空墙', wallW: '', wallH: '' }
    ];
    const before = JSON.stringify(walls);
    const context = loadFunctions({ walls, activeWall: 1, els: { wallSelect: {} } }, 'wall-panel.html', ['escapeHtml', 'renderWallSelect']);
    context.renderWallSelect();
    assert.match(context.els.wallSelect.innerHTML, /自定义墙 1 3888 × 2289mm/);
    assert.match(context.els.wallSelect.innerHTML, /&lt;测试墙&gt; 1022 × 2375mm/);
    assert.match(read('wall-panel.html'), /for="wallSelect">墙面列表（宽 × 高）/);
    assert.match(context.els.wallSelect.innerHTML, /空墙 待输入尺寸/);
    assert.equal(context.els.wallSelect.value, '1');
    assert.equal(JSON.stringify(walls), before);
});

function freightContext() {
    const calls = { shipment: 0, shunxin: 0 };
    const validation = {};
    const ids = ['quoteFreightWeight', 'quoteFreightPackage', 'quoteFreightDb', 'quoteFreightBox', 'quoteFreightNotice',
        'quoteShunxinTotal', 'quoteShunxinQuote', 'quoteShunxinProcess', 'quoteShunxinInsuranceFee', 'quoteShunxinUpstairsFee',
        'copyQuoteFreightBtn', 'copyQuoteShunxinBtn', 'copyBtn', 'calcLine', 'multiCalcLine', 'quote'];
    const context = {
        calls, mode: 'different', error: '', currentQuoteTotal: 2275, quoteManuallyEdited: true,
        els: Object.fromEntries(ids.map(id => [id, { textContent: '旧结果', disabled: false }])),
        document: { querySelector: () => validation }, money: value => String(value),
        currentGoldFreightItems: () => [{ material: 'hard', specKey: 'hard-3050', quantity: 3 }],
        updateModeUi() {}, renderMulti() {}, renderSingle() {},
        window: { GoldFreightCore: {
            calculateShipment() {
                calls.shipment++;
                return { ok: true, weightLine: '179KG', packageLine: '3米托盘', dbLine: 'DB6', notice: '一票货', detailLine: '3张' };
            },
            buildShunxinQuote() {
                calls.shunxin++;
                return { totalText: '123元', quoteText: '同仓运费报价', processText: '同仓计算', insuranceFee: 10, upstairsFee: 20 };
            }
        } }
    };
    context.els.multiMode = { checked: true };
    context.els.shipmentMode = () => context.mode;
    context.els.quoteFreightAddress = { value: '测试地址' };
    context.els.quoteShunxinIncludeUpstairs = { checked: false };
    context.quoteValidationError = () => context.error;
    return loadFunctions(context, 'quote-generator.html', ['setQuoteShunxinResult', 'setQuoteFreightEmpty', 'updateQuoteFreight', 'render']);
}

test('不同仓发货不调用合票或顺心核算，清除旧结果并只禁用两个运费复制', () => {
    const context = freightContext();
    context.updateQuoteFreight();
    assert.deepEqual(context.calls, { shipment: 0, shunxin: 0 });
    for (const id of ['quoteFreightWeight', 'quoteFreightPackage', 'quoteFreightDb', 'quoteShunxinTotal']) {
        assert.equal(context.els[id].textContent, '-');
    }
    assert.match(context.els.quoteFreightBox.textContent, /不同仓库发货，请按仓库分别询价/);
    assert.match(context.els.quoteShunxinQuote.textContent, /不同仓库发货，请按仓库分别询价/);
    assert.match(context.els.quoteShunxinProcess.textContent, /不能合并为一票/);
    assert.equal(context.els.quoteShunxinInsuranceFee.textContent, '保费：待计算');
    assert.equal(context.els.quoteShunxinUpstairsFee.textContent, '上门费：待计算');
    assert.equal(context.els.copyQuoteFreightBtn.disabled, true);
    assert.equal(context.els.copyQuoteShunxinBtn.disabled, true);
    assert.equal(context.els.copyQuoteFreightBtn.textContent, '复制运费提问');
    assert.equal(context.els.copyQuoteShunxinBtn.textContent, '复制顺心捷达报价');
    assert.equal(context.els.copyBtn.disabled, false);
    assert.equal(context.currentQuoteTotal, 2275);
    assert.equal(context.els.quote.textContent, '旧结果');
});

test('同仓切不同仓和地址更新不泄露旧询价；恢复同仓或单产品可算，非法输入仍拦截', () => {
    const context = freightContext();
    context.mode = 'same'; context.render();
    assert.equal(context.els.quoteShunxinTotal.textContent, '123元');
    context.mode = 'different'; context.render();
    for (const address of ['另一个地址', '']) {
        context.els.quoteFreightAddress.value = address;
        context.updateQuoteFreight();
        assert.equal(context.els.copyQuoteFreightBtn.disabled, true);
        assert.equal(context.els.quoteShunxinTotal.textContent, '-');
    }
    assert.equal(context.calls.shipment, 1);
    context.mode = 'same'; context.render();
    assert.equal(context.calls.shipment, 2);
    assert.equal(context.els.copyQuoteShunxinBtn.disabled, false);
    context.mode = 'different'; context.render();
    context.els.multiMode.checked = false; context.render();
    assert.equal(context.calls.shipment, 3);
    assert.equal(context.els.copyQuoteFreightBtn.disabled, false);
    context.error = '非法数量'; context.render();
    assert.equal(context.calls.shipment, 3);
    assert.equal(context.els.copyBtn.disabled, true);
    assert.equal(context.els.copyQuoteFreightBtn.disabled, true);
    assert.equal(context.els.copyQuoteShunxinBtn.disabled, true);
    assert.equal(context.els.quote.textContent, '旧结果');
});

test('上墙留缝控件局部独占一列，保留完整选项和控制绑定', () => {
    assert.match(read('wall-panel.html'), /<div class="grid joint-gap-controls">\s*<div class="field">\s*<label for="jointGapPreset">/);
    assert.match(read('wall-panel.html'), /<option value="0">0 mm（不留缝）<\/option>/);
    assert.match(read('apple-ui.css'), /body\.apple-ui\[data-page="wall-panel"\] aside > \.joint-gap-controls \{ grid-template-columns: minmax\(0,1fr\) !important; \}/);
});

test('宁波结果两卡采用局部中性灰样式，数字深色且说明次级灰', () => {
    const css = read('apple-ui.css');
    assert.match(css, /body\.apple-ui\[data-page="ningbo-weight"\] :is\(\.result-card, \.crate\) \{\s*background: #f5f5f7 !important; color: var\(--apple-ink\) !important;\s*border: 1px solid var\(--apple-line\) !important; box-shadow: none !important;/);
    assert.match(css, /:is\(\.result-card, \.crate\) :is\(\.label, \.result-note\) \{ color: var\(--apple-muted\) !important;/);
    assert.match(css, /:is\(\.result-value, \.crate-size\) \{ color: var\(--apple-ink\) !important;/);
});
