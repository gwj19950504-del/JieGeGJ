// Isolated browser check: synthetic products, intercepted clipboard, no customer records.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/order-detail-20260927-v2');
const checks = [], errors = [];

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    try {
        for (const width of [1332, 390]) {
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
            const open = () => page.goto(pathToFileURL(path.join(root, 'tools/order-template.html')).href);
            async function fill(values) {
                for (const [id, value] of Object.entries(values)) await page.locator(`#${id}`).fill(value);
            }
            async function copy(scope = page) {
                assert.equal(await scope.locator('#copyBtn').isDisabled(), false);
                await scope.locator('#copyBtn').click();
                const text = await scope.evaluate(() => window.__copied);
                assert.equal(text, await scope.locator('#result').innerText());
                return text;
            }
            async function verify(expectedMaterial, expectedKd, expectedDetail) {
                assert.equal(await page.locator('#materialPreview').innerText(), expectedMaterial);
                assert.equal(await page.locator('#kdPreview').innerText(), expectedKd);
                const text = await copy();
                assert.ok(text.includes(expectedDetail), text);
                assert.ok(text.includes(`KD：${expectedKd}`), text);
                assert.doesNotMatch(text, /单片约|小计/);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
                return text;
            }

            await open();
            await page.locator('input[name="productCount"][value="4"]').check();
            for (const [index, spec, qty, price] of [
                ['', 'soft-2440', '1', '100'], ['2', 'soft-2440', '1', '80'],
                ['3', 'hard-2440', '3', '70'], ['4', 'hard-2440', '7', '75']
            ]) {
                await page.locator(`#specSelect${index}`).selectOption(spec);
                await fill({ [`productName${index}`]: `测试板${index || '1'}`,
                    [`quantity${index}`]: qty, [`sqmPrice${index}`]: price });
            }
            await fill({ crateFee: '200', totalAmount: '3800' });
            const mixed = await verify('2714.99', '885.01', '3片*208.38=625.13（70/平）');
            for (const detail of ['1片*292.8=292.8', '1片*234.24=234.24', '7片*223.26=1562.82']) {
                assert.ok(mixed.includes(detail));
            }
            await page.locator('#result').screenshot({ path: path.join(output, `mixed-${width}.png`) });
            // Preserve explicit manual edits; restoring auto regenerates clean normal details.
            await page.locator('#result').fill('人工开单正文保留');
            await page.locator('#sqmPrice3').fill('80');
            assert.equal((await copy()).trim(), '人工开单正文保留');
            await page.locator('#sqmPrice3').fill('70');
            await page.locator('#resumeAutoBtn').click();
            await verify('2714.99', '885.01', '3片*208.38=625.13（70/平）');
            checks.push({ width, scenario: '四项混装、复制、人工编辑及恢复', material: '2714.99', kd: '885.01' });

            await open();
            await page.locator('input[name="category"][value="other"]').check();
            await fill({ otherProductName: '其它测试板', otherSpecText: '1220*2440*6mm',
                otherQty: '3', otherSqmPrice: '70', totalAmount: '1000' });
            await verify('625.13', '374.87', '3片*208.38=625.13（70/平）');
            await page.locator('#result').screenshot({ path: path.join(output, `other-${width}.png`) });
            await fill({ otherUnitPrice: '216' });
            await verify('648', '352', '3片*216=648（216/片）');
            checks.push({ width, scenario: '其它品类自动面积计价及手填单片价' });

            // Serve all resources locally, but simulate an old response for the unversioned order URL.
            await context.route('https://order-regression.test/**', async route => {
                const url = new URL(route.request().url());
                if (url.pathname === '/tools/order-template.html' && !url.searchParams.has('v')) {
                    return route.fulfill({ contentType: 'text/html', body: '<p id="stale">旧开单缓存：单片约208.38元，小计1041.88元</p>' });
                }
                const file = path.resolve(root, '.' + url.pathname);
                assert.ok(file.startsWith(root + path.sep));
                const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
                return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
            });
            await page.goto('https://order-regression.test/tools/order-template.html');
            assert.equal(await page.locator('#stale').count(), 1, '旧固定地址的响应应先复现');
            await page.goto('https://order-regression.test/index.html?tool=order-template');
            const frame = await (await page.locator('iframe').first().elementHandle()).contentFrame();
            await frame.locator('#quantity').waitFor();
            assert.equal(new URL(frame.url()).searchParams.get('v'), '20261006-1');
            assert.equal(await frame.locator('meta[name="jiege-build"]').getAttribute('content'), 'v2026.10.06.1');
            for (const [id, value] of Object.entries({ productName: '测试板(保留款式括号)',
                quantity: '5', sqmPrice: '70', crateFee: '200', totalAmount: '1580' })) {
                await frame.locator('#' + id).fill(value);
            }
            const five = await copy(frame);
            assert.match(five, /5片\*208.38=1041.88（70\/平）/);
            assert.doesNotMatch(five, /单片约|小计/);
            assert.equal(await frame.locator('#materialPreview').innerText(), '1041.88');
            assert.equal(await frame.locator('#kdPreview').innerText(), '338.12');
            await frame.locator('#result').screenshot({ path: path.join(output, `five-shell-${width}.png`) });
            const legacy = five.replace('5片*208.38=1041.88', '5片（单片约208.38元，小计1041.88元）') + '\n人工备注保留';
            await frame.locator('#result').fill(legacy);
            const manualExpected = (await frame.locator('#result').innerText())
                .replace('5片（单片约208.38元，小计1041.88元）', '5片*208.38=1041.88');
            await frame.locator('#quantity').focus();
            assert.equal(await frame.locator('#result').textContent(), manualExpected, '离开编辑框只清理旧说明，保留可见换行');
            // A programmatic click must also clean text, without relying on blur.
            await frame.locator('#result').fill(legacy);
            await frame.locator('#copyBtn').dispatchEvent('click');
            await frame.waitForFunction(() => window.__copied === document.querySelector('#result').textContent && !window.__copied.includes('单片约'));
            assert.equal(await frame.evaluate(() => window.__copied), manualExpected);
            await page.locator('[data-tool="quick-price"]').click();
            await page.locator('[data-tool="order-template"]').click();
            assert.equal(await frame.locator('#quantity').inputValue(), '5');
            assert.equal((await copy(frame)), manualExpected);
            await frame.locator('#resumeAutoBtn').click();
            assert.equal(await copy(frame), five);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            // Clipboard rejection must select the already-cleaned text for manual copying.
            await frame.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('test clipboard denied'); }; });
            await frame.locator('#result').fill(legacy);
            await frame.locator('#copyBtn').dispatchEvent('click');
            await frame.waitForFunction(() => document.querySelector('#copyBtn').textContent === '已选中，可手动复制');
            assert.equal(await frame.evaluate(() => window.getSelection().toString()), manualExpected);
            checks.push({ width, scenario: '首页版本加载、5片、旧格式清理、复制失败兜底、导航保留草稿' });
            console.log(`PASS order details, clipboard, totals, manual mode and layout ${width}px`);
            await context.close();
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(`PASS ${checks.length} browser groups; no console/page errors`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
