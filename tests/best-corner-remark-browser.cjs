// Synthetic orders and intercepted clipboard; no real orders or system clipboard writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/best-corner-remark-20261009/browser');
const cornerText = '【单独包护角】';

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    try {
        for (const width of [1332, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                    writeText: async text => { window.copiedOrder = text; }
                } });
            });
            const page = await context.newPage();
            const errors = [];
            page.setDefaultTimeout(6000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.goto(pathToFileURL(path.join(root, 'tools/order-template.html')).href);
            const corner = page.locator(`.remarkPreset[value="${cornerText}"]`);
            const choose = (name, value) => page.locator(`input[name="${name}"][value="${value}"]`).check();
            async function copy() {
                assert.equal(await page.locator('#copyBtn').isDisabled(), false);
                await page.locator('#copyBtn').click();
                const copied = await page.evaluate(() => window.copiedOrder);
                assert.equal(copied, await page.locator('#result').innerText());
                return copied;
            }
            async function expectCorner(available, checked = available) {
                assert.equal(await corner.isVisible(), available);
                assert.equal(await corner.isDisabled(), !available);
                assert.equal(await corner.isChecked(), checked);
                assert.equal((await page.evaluate(() => selectedRemarks())).includes(cornerText), checked);
            }
            await expectCorner(false);
            for (const [id, value] of Object.entries({ productName: '测试白锈', quantity: '2', sqmPrice: '80',
                totalAmount: '1000', receiverRaw: '浙江省台州市椒江区海龙路 测试大厦' })) {
                await page.locator(`#${id}`).fill(value);
            }
            await page.locator('#specSelect').selectOption('soft-2440');
            const before = await page.locator('#materialPreview').innerText();
            const beforeKd = await page.locator('#kdPreview').innerText();
            await choose('logistics', '百世');
            await expectCorner(true);
            assert.ok((await copy()).includes(cornerText));
            assert.equal(await page.locator('#materialPreview').innerText(), before);
            assert.equal(await page.locator('#kdPreview').innerText(), beforeKd);
            assert.equal(await page.locator('#orderBestTotal').innerText(), '104元');
            await corner.locator('..').locator('..').screenshot({ path: path.join(output, `best-presets-${width}.png`) });

            await corner.uncheck();
            await page.locator('#remarkCustom').fill('普通手写备注');
            await choose('freightPay', '代付');
            await expectCorner(true, false);
            assert.ok(!(await copy()).includes(cornerText));
            assert.equal(await page.locator('#orderBestTotal').innerText(), '101元');
            await corner.check();
            assert.ok((await copy()).includes(cornerText));
            const logistics = await page.locator('input[name="logistics"]').evaluateAll(inputs => inputs.map(input => input.value));
            for (const value of logistics.filter(value => value !== '百世')) {
                await choose('logistics', value);
                await expectCorner(false);
                assert.ok(!(await copy()).includes(cornerText), value);
                await choose('logistics', '百世');
                await expectCorner(true);
            }
            // The condition has no category restriction.
            for (const category of ['sandstone', 'other', 'liujin']) {
                await choose('category', category);
                await expectCorner(true);
            }
            // Only automatic presets change; user-authored content stays intact.
            await page.locator('#result').fill('手工确认正文：' + cornerText);
            const manualText = await page.locator('#result').innerText();
            await choose('logistics', '安能');
            await expectCorner(false);
            assert.equal(await copy(), manualText);
            await page.locator('#resumeAutoBtn').click();
            assert.ok(!(await copy()).includes(cornerText));
            await page.locator('#remarkCustom').fill('手写保留：' + cornerText);
            assert.ok((await copy()).includes('手写保留：' + cornerText));
            await page.locator('#remarkCustom').fill('');
            for (const warehouse of ['宁波仓', '美利来', '混凝土仓', '水泥板仓库', '自选仓']) {
                await choose('warehouse', warehouse);
                await expectCorner(false);
                const options = await page.locator('input[name="logistics"]').evaluateAll(inputs => inputs.map(input => input.value));
                for (const value of options) {
                    await choose('logistics', value);
                    await expectCorner(false);
                }
            }
            await page.locator('#customWarehouseName').fill('浙江仓');
            await expectCorner(false);
            await choose('warehouse', '浙江仓');
            await expectCorner(false); // Warehouse changes reset logistics to 默认.
            await choose('logistics', '百世');
            await expectCorner(true);
            await page.locator('#resetNextBtn').click();
            await expectCorner(false);
            await choose('logistics', '百世');
            await expectCorner(true);
            // Existing hidden example entry points also reset remarks consistently.
            await page.evaluate(() => fillDemo());
            await expectCorner(true);
            assert.ok((await copy()).includes(cornerText));
            await corner.uncheck();
            await page.evaluate(() => fillDemo());
            await expectCorner(true);
            await page.evaluate(() => fillNingboDemo());
            await expectCorner(false);
            assert.ok(!(await copy()).includes(cornerText));
            await page.evaluate(() => fillSongnuoDemo());
            await expectCorner(false);
            assert.ok(!(await copy()).includes(cornerText));
            await page.evaluate(() => fillDemo());
            await expectCorner(true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: Zhejiang/BEST only, category independence, toggles, copy, manual text, reset, demos, fees and layout`);
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
