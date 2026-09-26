// Isolated local browser regression. No real customer data or clipboard is modified.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/qa-fixes-20260926');
const checks = [], errors = [];
function pass(name, data) { checks.push({ name, data }); console.log(`PASS ${name}`); }
async function fill(page, values) {
    for (const [id, value] of Object.entries(values)) await page.locator(`#${id}`).fill(value);
}
async function assertBlocked(page, selector) {
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
async function noOverflow(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    try {
        for (const width of [1332, 916, 390, 320]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.addInitScript(() => {
                window.__copied = '';
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                    writeText: async text => { window.__copied = text; }
                } });
            });
            const page = await context.newPage();
            page.setDefaultTimeout(6000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            async function open(name) { await page.goto(pathToFileURL(path.join(root, 'tools', `${name}.html`)).href); }
            async function shot(name, locator) {
                await locator.screenshot({ path: path.join(output, `${name}-${width}.png`) });
            }

            await open('wall-panel');
            await fill(page, { wallW: '3888', wallH: '2289' });
            await page.locator('#wallName').focus();
            assert.match(await page.locator('#wallSelect').innerText(), /3888 × 2289mm/);
            assert.match(await page.locator('#drawing').textContent(), /3888mm x 2289mm/);
            await shot('wall-list', page.locator('#wallSelect'));
            const select = await page.locator('#jointGapPreset').evaluate(node => {
                const css = getComputedStyle(node);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.font = `${css.fontSize} ${css.fontFamily}`;
                return { width: node.clientWidth,
                    required: ctx.measureText(node.selectedOptions[0].textContent).width + parseFloat(css.paddingLeft) + parseFloat(css.paddingRight) + 22 };
            });
            assert.ok(select.width > select.required, JSON.stringify(select));
            assert.equal(await page.locator('#jointGapCustom').isDisabled(), true);
            await shot('wall-gap', page.locator('.joint-gap-controls'));
            await page.locator('#jointGapPreset').selectOption('custom');
            assert.equal(await page.locator('#jointGapCustom').isDisabled(), false);
            await page.locator('#jointGapCustom').fill('5');
            await page.locator('#wallName').focus();
            assert.match(await page.locator('#drawing').textContent(), /留缝 5mm/);
            await noOverflow(page);
            pass(`墙面宽高、留缝完整显示及自定义切换 ${width}px`, select);

            await open('ningbo-weight');
            await page.locator('#qty').fill('6');
            const colors = await page.locator('.result-card,.crate').evaluateAll(nodes => nodes.map(node => {
                const css = getComputedStyle(node);
                return { background: css.backgroundColor, border: css.borderTopColor, color: css.color, radius: css.borderRadius };
            }));
            assert.equal(colors.length, 2);
            for (const color of colors) assert.deepEqual(color, { background: 'rgb(245, 245, 247)', border: 'rgb(217, 217, 223)', color: 'rgb(29, 29, 31)', radius: '12px' });
            assert.match(await page.locator('#totalWeight').innerText(), /168/);
            assert.match(await page.locator('#shippingWeight').innerText(), /233/);
            await shot('ningbo-results', page.locator('.result-row'));
            await noOverflow(page);
            pass(`宁波两结果卡中性配色、原重量不变 ${width}px`, colors);

            if (width === 1332 || width === 390) {
                await open('order-template');
                await fill(page, { productName: '测试板', quantity: '6', sqmPrice: '70', totalAmount: '2000' });
                assert.equal(await page.locator('#materialPreview').innerText(), '1250.26');
                assert.equal(await page.locator('#kdPreview').innerText(), '749.74');
                const orderCopy = await copy(page, '#copyBtn');
                assert.match(orderCopy, /6片（单片约208.38元，小计1250.26元）/);
                assert.match(orderCopy, /KD：749.74/);
                assert.doesNotMatch(orderCopy, /6片\*208.38=/);
                await shot('order-detail', page.locator('#result'));
                await page.locator('#result').fill('人工开单正文保留');
                await page.locator('#sqmPrice').fill('80');
                assert.equal((await copy(page, '#copyBtn')).trim(), '人工开单正文保留');
                await noOverflow(page);
                pass(`开单显示、复制、金额及人工正文保留 ${width}px`, orderCopy);

                await open('quote-generator');
                await page.locator('#multiMode').check();
                for (let index = 0; index < 2; index++) {
                    await page.locator('.multi-product').nth(index).fill('鎏金板');
                    await page.locator('.multi-spec').nth(index).fill('硬质-1220*3050*6mm');
                    await page.locator('.multi-quantity').nth(index).fill('3');
                    await page.getByRole('spinbutton', { name: '请手动填写优惠价', exact: true }).nth(index).fill(String(70 + index * 10));
                }
                await page.locator('#quoteFreightAddress').fill('山东省枣庄市薛城区测试路1号');
                assert.match(await copy(page, '#copyQuoteFreightBtn'), /293KG/);
                assert.match(await page.locator('#quote').innerText(), /总计：1975元/);
                await page.getByText('不同仓库发货', { exact: true }).click();
                assert.match(await copy(page, '#copyBtn'), /总计：2275元/);
                for (const address of ['山东省枣庄市薛城区另一测试地址', '']) {
                    await page.locator('#quoteFreightAddress').fill(address);
                    await assertBlocked(page, '#copyQuoteFreightBtn');
                    await assertBlocked(page, '#copyQuoteShunxinBtn');
                    assert.equal(await page.locator('#quoteFreightWeight').innerText(), '-');
                    assert.equal(await page.locator('#quoteShunxinTotal').innerText(), '-');
                }
                assert.match(await page.locator('#quoteShunxinQuote').innerText(), /不同仓库发货，请按仓库分别询价/);
                assert.equal(await page.locator('#copyQuoteFreightBtn').innerText(), '复制运费提问');
                assert.equal(await page.locator('#quoteShunxinQuote').isVisible(), true);
                await shot('different-freight', page.getByRole('region', { name: '鎏金板运费快速提问', exact: true }));
                await page.locator('#clearQuoteFreightBtn').click();
                await assertBlocked(page, '#copyQuoteFreightBtn');
                await page.getByText('同一个仓库发货', { exact: true }).click();
                await page.locator('#quoteFreightAddress').fill('山东省枣庄市薛城区测试路1号');
                assert.match(await copy(page, '#copyQuoteFreightBtn'), /293KG/);
                assert.equal(await page.locator('#copyQuoteShunxinBtn').isDisabled(), false);
                await page.getByText('不同仓库发货', { exact: true }).click();
                await page.locator('#multiMode').uncheck();
                await fill(page, { product: '鎏金板', spec: '硬质-1220*3050*6mm', quantity: '3', unitPrice: '70' });
                assert.match(await copy(page, '#copyQuoteFreightBtn'), /179KG/);
                await page.locator('#quantity').fill('-1');
                await assertBlocked(page, '#copyQuoteFreightBtn');
                await assertBlocked(page, '#copyQuoteShunxinBtn');
                await noOverflow(page);
                pass(`不同仓拦截、修改清空地址、同仓及单产品恢复、非法值保护 ${width}px`);
            }
            await context.close();
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(`PASS ${checks.length} browser groups; no console/page errors`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
