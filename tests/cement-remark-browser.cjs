// Synthetic input and intercepted clipboard; no real orders or system clipboard writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/cement-remark-20261006');
const repairText = '修补剂随货发，谢谢！';

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const errors = [];
    try {
        for (const width of [1332, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                    writeText: async text => { window.copiedOrder = text; }
                } });
            });
            const page = await context.newPage();
            page.setDefaultTimeout(6000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.goto(pathToFileURL(path.join(root, 'tools/order-template.html')).href);
            const repair = page.locator(`.remarkPreset[value="${repairText}"]`);
            const choose = (name, value) => page.locator(`input[name="${name}"][value="${value}"]`).check();
            async function copy() {
                assert.equal(await page.locator('#copyBtn').isDisabled(), false);
                await page.locator('#copyBtn').click();
                const copied = await page.evaluate(() => window.copiedOrder);
                assert.equal(copied, await page.locator('#result').innerText());
                return copied;
            }
            assert.equal(await repair.isVisible(), true);
            assert.equal(await repair.isChecked(), true);
            await choose('warehouse', '水泥板仓库');
            for (const [id, value] of Object.entries({ cementProductName: '测试水泥板', cementSpecText: '6mm',
                cementQty: '14', cementUnitPrice: '75', processingFee: '700', totalAmount: '3080' })) {
                await page.locator(`#${id}`).fill(value);
            }
            for (const warehouse of ['苏州仓', '华中仓', '淮海仓', '昌盛仓']) {
                await choose('cementWarehouse', warehouse);
                assert.equal(await repair.isVisible(), false, warehouse);
                assert.equal(await repair.isDisabled(), true, warehouse);
                const copied = await copy();
                assert.ok(!copied.includes(repairText), warehouse);
                assert.ok(copied.includes('【货好拍照】'), warehouse);
                assert.equal(await page.locator('#materialPreview').innerText(), '1050');
                assert.equal(await page.locator('#kdPreview').innerText(), '1330');
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            await repair.locator('..').locator('..').screenshot({ path: path.join(output, `cement-presets-${width}.png`) });
            await page.locator('#remarkCustom').fill('手写保留：' + repairText);
            assert.ok((await copy()).includes('手写保留：' + repairText));
            await page.locator('#result').fill('手工确认正文：' + repairText);
            const manualText = await page.locator('#result').innerText();
            assert.equal(await copy(), manualText);
            await page.locator('#remarkCustom').fill('');
            await page.locator('#resumeAutoBtn').click();
            assert.ok(!(await copy()).includes(repairText));

            for (const warehouse of ['浙江仓', '宁波仓', '美利来', '混凝土仓', '自选仓']) {
                await choose('warehouse', warehouse);
                assert.equal(await repair.isVisible(), true, warehouse);
                assert.equal(await repair.isDisabled(), false, warehouse);
                assert.ok((await page.evaluate(() => selectedRemarks())).includes(repairText), warehouse);
                await repair.uncheck();
                await page.locator('#remarkCustom').fill('普通备注');
                assert.equal(await repair.isChecked(), false, warehouse);
                assert.ok(!(await page.evaluate(() => selectedRemarks())).includes(repairText), warehouse);
                await repair.check();
            }
            // A same-named custom warehouse is not a cement warehouse.
            await page.locator('#customWarehouseName').fill('苏州仓');
            assert.equal(await repair.isVisible(), true);
            await choose('warehouse', '水泥板仓库');
            assert.equal(await repair.isVisible(), false);
            await page.locator('#resetNextBtn').click();
            assert.equal(await repair.isVisible(), true);
            assert.equal(await repair.isDisabled(), false);
            assert.equal(await repair.isChecked(), true);
            await choose('warehouse', '水泥板仓库');
            assert.equal(await repair.isVisible(), false);
            assert.ok(!(await page.evaluate(() => selectedRemarks())).includes(repairText));
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: four cement warehouses, other warehouses, copy, manual text, reset and layout`);
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
