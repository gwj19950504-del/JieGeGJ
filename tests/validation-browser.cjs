// Run with Playwright installed; OUTPUT_DIR can override the screenshot/report directory.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/qa-fixes-20260919');
const checks = [], errors = [];
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function fill(page, values) {
    for (const [id, value] of Object.entries(values)) await page.locator(`#${id}`).fill(value);
}
async function choose(page, name, value) {
    await page.locator(`input[name="${name}"][value="${value}"]`).locator('..').click();
}
async function blocked(page, selector) {
    assert.equal(await page.locator(selector).isDisabled(), true);
    const before = await page.evaluate(() => window.__copied);
    await page.locator(selector).dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__copied), before);
}
async function copy(page, selector) {
    assert.equal(await page.locator(selector).isDisabled(), false);
    await page.locator(selector).click();
    return page.evaluate(() => window.__copied);
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext({ viewport: { width: 916, height: 1000 } });
    await context.addInitScript(() => {
        window.__copied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async (text) => { window.__copied = text; }
        } });
        const original = document.execCommand.bind(document);
        document.execCommand = (command, ...args) => {
            if (command === 'copy') { window.__copied = document.activeElement.value; return true; }
            return original(command, ...args);
        };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    async function open(file) { await page.goto(pathToFileURL(path.join(root, 'tools', file)).href); }
    try {
        for (let run = 1; run <= 2; run++) {
            await open('quote-generator.html');
            await fill(page, { product: '鎏金板', quantity: '10', unitPrice: '100', boxFee: '0' });
            await page.locator('#quickSpec').selectOption('硬质-1220*2440*6mm');
            assert.match(await copy(page, '#copyBtn'), /总计：2977元/);
            await fill(page, { quantity: '-1' });
            await blocked(page, '#copyBtn');
            assert.doesNotMatch(await page.locator('#quote').innerText(), /总计：-298/);
            await fill(page, { quantity: '10', spec: '无法识别的规格' });
            await blocked(page, '#copyBtn');
            assert.match(await page.locator('#quoteValidation').innerText(), /规格无法识别/);
            await fill(page, { spec: '1200*600' });
            assert.match(await copy(page, '#copyBtn'), /总计：720元/);
            pass(`Q-02/Q-03 拒绝、复制阻断与修正恢复 ${run}`);
        }
        const positions = await page.locator('#processingFee,#accessoryFee,#manualTaxFee').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
        assert.ok(Math.max(...positions) - Math.min(...positions) < 1);
        await page.locator('#singleFees').screenshot({ path: path.join(output, 'quote-fees-916.png') });
        pass('Q-01 税金等三输入框916px对齐');
        await page.locator('#multiMode').check();
        for (let index = 0; index < 2; index++) {
            await page.locator('.multi-product').nth(index).fill(`测试板${index + 1}`);
            await page.locator('.multi-spec').nth(index).fill('1200*600');
            await page.locator('.multi-quantity').nth(index).fill(String(index + 2));
            await page.locator('.multi-unit-price').nth(index).fill(String((index + 1) * 100));
        }
        await fill(page, { multiBoxFee: '0' });
        assert.match(await copy(page, '#copyBtn'), /总计：576元/);
        assert.equal(await page.locator('#multiCalcLine').evaluate((node) => node.parentElement.id), 'singleFees');
        const layout = await page.locator('.fee-section,.note-section').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
        assert.ok(Math.abs(layout[0] - layout[1]) < 1);
        await page.locator('.form').screenshot({ path: path.join(output, 'quote-multi-916.png') });
        await page.locator('.multi-spec').nth(1).fill('UNKNOWN');
        await blocked(page, '#copyBtn');
        await page.locator('.multi-spec').nth(1).fill('1200*600');
        await page.locator('.multi-quantity').nth(1).fill('-1');
        await blocked(page, '#copyBtn');
        await page.locator('.multi-quantity').nth(1).fill('3');
        await page.locator('#quote').fill('人工确认报价：900元');
        await fill(page, { noteExtra: '保留手工正文' });
        assert.equal(await copy(page, '#copyBtn'), '人工确认报价：900元');
        pass('Q-04 多产品布局、576元正常合计、第二产品校验、人工正文');

        await open('order-template.html');
        for (const warehouse of ['浙江仓', '宁波仓', '美利来', '混凝土仓', '水泥板仓库', '自选仓']) {
            await choose(page, 'warehouse', warehouse);
            await fill(page, { totalAmount: '-500' });
            await blocked(page, '#copyBtn');
            assert.equal(await page.locator('#materialPreview').innerText(), '待核对');
            await fill(page, { totalAmount: '1000' });
            assert.equal(await page.locator('#copyBtn').isDisabled(), false);
        }
        pass('ORDER-001 六仓负合计阻断、修正恢复');
        await choose(page, 'warehouse', '浙江仓');
        await choose(page, 'category', 'other');
        await fill(page, { otherProductName: '未知规格产品', otherSpecText: 'UNKNOWN-SPEC', otherQty: '2', otherSqmPrice: '100' });
        await blocked(page, '#copyBtn');
        assert.match(await page.locator('#formNotice').innerText(), /规格无法识别/);
        await fill(page, { otherDetail: '人工确认产品2片' });
        await blocked(page, '#copyBtn');
        await fill(page, { otherMaterialAmount: '200' });
        assert.match(await copy(page, '#copyBtn'), /人工确认产品2片/);
        await fill(page, { otherMaterialAmount: '-100' });
        await blocked(page, '#copyBtn');
        await fill(page, { otherMaterialAmount: '', otherDetail: '', otherUnitPrice: '100' });
        assert.match(await copy(page, '#copyBtn'), /200/);
        await fill(page, { otherUnitPrice: '', otherSpecText: '1200*600' });
        assert.equal(await page.locator('#copyBtn').isDisabled(), false);
        await fill(page, { otherMaterialAmount: '-100' });
        await choose(page, 'category', 'liujin');
        assert.equal(await page.locator('#copyBtn').isDisabled(), false);
        pass('ORDER-001/002 负材料额、未知规格、人工例外、隐藏旧字段');
        for (const warehouse of ['宁波仓', '美利来']) {
            await choose(page, 'warehouse', warehouse);
            await fill(page, { otherProductName: '人工产品', otherSpecText: 'UNKNOWN-SPEC', otherQty: '2', otherSqmPrice: '100' });
            await blocked(page, '#copyBtn');
            await fill(page, { otherSpecText: '1200*600' });
            assert.equal(await page.locator('#copyBtn').isDisabled(), false);
        }
        pass('宁波/美利来同步校验自动面积且接受有效自定义尺寸');

        await open('freight-gold.html');
        for (let run = 1; run <= 2; run++) {
            await page.locator('.item-quantity').first().fill('1.5');
            await blocked(page, '#copyBtn');
            assert.match(await page.locator('#result').innerText(), /整数/);
            await page.locator('.item-quantity').first().fill('2');
            assert.match(await copy(page, '#copyBtn'), /2\*30\+46=106KG/);
            assert.match(await page.locator('#result').innerText(), /2米托盘/);
        }
        pass('FREIGHT-001/002 两次小数阻断、恢复106KG及托盘文案');
        await open('ningbo-weight.html');
        for (let run = 1; run <= 2; run++) {
            await fill(page, { qty: '1.5' });
            await page.locator('#addShipmentItem').click();
            assert.equal(await page.locator('.shipment-item').count(), 0);
            await blocked(page, '#copySummary');
            await blocked(page, '#copyFreight');
            await fill(page, { qty: '3' });
            assert.match(await copy(page, '#copyFreight'), /3\*28\+65=149KG/);
        }
        await page.locator('#addShipmentItem').click();
        await fill(page, { qty: '1.5' });
        await blocked(page, '#copyFreight');
        await fill(page, { qty: '' });
        assert.match(await copy(page, '#copyFreight'), /149KG/);
        pass('NINGBO-001 小数不加入、两次恢复、已有明细不掩盖非法草稿');

        for (const file of ['quote-generator.html', 'order-template.html', 'freight-gold.html', 'ningbo-weight.html']) {
            await open(file);
            for (const width of [1332, 916, 660, 390, 320]) {
                await page.setViewportSize({ width, height: 1000 });
                assert.ok(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1));
            }
            pass(`${file} 五档宽度无整页横向溢出`);
        }
        assert.deepEqual(errors, []);
        pass('浏览器无console error/pageerror');
    } finally {
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
