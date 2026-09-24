// Local Chrome/Playwright acceptance. Uses a mocked clipboard, never the user's clipboard.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/brick-layout-20260924');

async function values(page, width, height, gap) {
    for (const [id, value] of [['brickWidth', width], ['brickHeight', height], ['brickGap', gap]]) {
        await page.locator(`#${id}`).fill(String(value));
    }
}

async function download(page, button, filename) {
    const pending = page.waitForEvent('download');
    await page.locator(button).click();
    const result = await pending;
    await result.saveAs(path.join(output, filename));
    assert.equal(await result.failure(), null);
    await page.waitForFunction(() => !document.getElementById('copyBrick').disabled);
    return fs.readFileSync(path.join(output, filename));
}

async function run() {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    try {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
        await context.addInitScript(() => {
            window.copyImageInfo = null;
            window.rejectClipboard = false;
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                write: async (items) => {
                    if (window.rejectClipboard) throw new Error('Test clipboard denial');
                    const blob = await items[0].getType('image/png');
                    window.copyImageInfo = { type: blob.type, size: blob.size };
                },
            } });
        });
        const errors = [];
        context.on('page', (page) => {
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        });
        const page = await context.newPage();
        await page.goto(pathToFileURL(path.join(root, 'tools/brick-layout.html')).href);
        assert.match(await page.locator('#brickSummary').innerText(), /19 列 × 10 行/);
        assert.match(await page.locator('#brickSummary').innerText(), /50 mm/);
        assert.match(await page.locator('#brickSummary').innerText(), /235 mm/);
        for (const width of [1600, 1280, 1024, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow ${width}`);
            const boxes = await page.locator('#brickWidth,#brickHeight').evaluateAll((nodes) => nodes.map((node) => {
                const box = node.getBoundingClientRect(); return { top: box.top, width: box.width };
            }));
            assert.ok(Math.abs(boxes[0].top - boxes[1].top) < 1, `field alignment ${width}`);
            assert.ok(boxes.every((box) => box.width > 70));
            if ([1600, 768, 390].includes(width)) {
                await page.screenshot({ path: path.join(output, `brick-page-${width}.png`), fullPage: true });
            }
        }
        console.log('PASS 示例几何、六档宽度无整页横溢、输入同行对齐');

        await page.setViewportSize({ width: 1440, height: 1000 });
        for (const [width, height, gap] of [[200, 300, 8], [30, 90, 3], [90.5, 150.5, 2.5], [61, 244, 0], [1220, 2440, 5], [1218, 240, 5], [1, 2440, 0], [1220, 1, 0]]) {
            await values(page, width, height, gap);
            assert.equal(await page.locator('#brickError').isVisible(), false);
            assert.match(await page.locator('#brickDrawing title').textContent(), new RegExp(`小砖${width}×${height}mm，缝隙${gap}mm`));
            const bounds = await page.locator('#brickDrawing svg text').evaluateAll((nodes) => nodes.map((node) => {
                const box = node.getBoundingClientRect();
                const svg = node.ownerSVGElement.getBoundingClientRect();
                return { text: node.textContent, x: box.left - svg.left, right: svg.right - box.right };
            }));
            assert.ok(bounds.every((box) => box.x >= 0 && box.right >= 0), `drawing text bounds ${width}×${height}/${gap}`);
        }
        await values(page, 200, 300, 8);
        await page.locator('#swapBrick').click();
        assert.equal(await page.locator('#brickWidth').inputValue(), '300');
        assert.equal(await page.locator('#brickHeight').inputValue(), '200');
        await page.locator('#brickGap').focus();
        await page.mouse.wheel(0, 100);
        assert.equal(await page.locator('#brickGap').inputValue(), '8');
        console.log('PASS 多规格、小数、零缝、单格、末端槽、极值、宽高互换与滚轮保护');

        for (const [width, height, gap] of [['', 240, 5], [-1, 240, 5], [60, 0, 5], [60, 240, -1], [1221, 240, 5], [60.01, 240, 5], [1, 1, 0]]) {
            await values(page, width, height, gap);
            assert.equal(await page.locator('#brickDrawing svg').count(), 0);
            assert.equal(await page.locator('#brickError').isVisible(), true);
            for (const id of ['copyBrick', 'saveBrickPng', 'saveBrickSvg']) assert.equal(await page.locator(`#${id}`).isDisabled(), true);
        }
        await page.locator('#resetBrick').click();
        assert.equal(await page.locator('#brickWidth').inputValue(), '60');
        assert.equal(await page.locator('#brickHeight').inputValue(), '240');
        assert.equal(await page.locator('#brickGap').inputValue(), '5');
        assert.equal(await page.locator('#copyBrick').isDisabled(), false);
        console.log('PASS 非法/空参数及过密排版阻断导出，载入示例恢复');

        const svg = await download(page, '#saveBrickSvg', '砖纹示例.svg');
        assert.match(svg.toString(), /href="data:image\/png;base64,/);
        assert.match(svg.toString(), /小砖60×240mm，缝隙5mm/);
        assert.doesNotMatch(svg.toString(), /href="https?:/);
        const png = await download(page, '#saveBrickPng', '砖纹示例.png');
        assert.equal(png.readUInt32BE(16), 2200);
        assert.equal(png.readUInt32BE(20), 2620);
        await page.locator('#copyBrick').click();
        await page.waitForFunction(() => window.copyImageInfo?.size > 100000);
        assert.equal((await page.evaluate(() => window.copyImageInfo)).type, 'image/png');
        await page.waitForFunction(() => !document.getElementById('copyBrick').disabled);
        await page.evaluate(() => { window.rejectClipboard = true; });
        await download(page, '#copyBrick', '复制受限自动下载.png');
        assert.match(await page.locator('#exportStatus').innerText(), /未允许复制/);
        await values(page, 90, 300, 6);
        const changed = await download(page, '#saveBrickSvg', '自定义90x300缝6.svg');
        assert.match(changed.toString(), /小砖90×300mm，缝隙6mm/);
        console.log('PASS SVG自带材质、PNG2200×2620、真实PNG复制、拒绝复制时下载及自定义参数导出');

        const exported = await context.newPage();
        await exported.goto(pathToFileURL(path.join(output, '砖纹示例.svg')).href);
        assert.match(await exported.locator('svg title').textContent(), /小砖60×240mm/);
        assert.equal(await exported.locator('parsererror').count(), 0);
        await exported.close();

        const shell = await context.newPage();
        await shell.goto(pathToFileURL(path.join(root, 'index.html')).href + '?tool=brick-layout');
        const ids = await shell.locator('#toolNav button').evaluateAll((nodes) => nodes.map((node) => node.dataset.tool));
        assert.deepEqual(ids.slice(-2), ['hole-1200', 'brick-layout']);
        assert.equal(ids.length, 10);
        const frame = shell.frameLocator('iframe[title="水泥板砖纹排版"]');
        await frame.locator('#brickDrawing svg').waitFor();
        await frame.locator('#brickWidth').fill('90');
        await shell.locator('[data-tool="hole-1200"]').click();
        await shell.frameLocator('iframe[title="1200×600 孔心排版"]').locator('svg').first().waitFor();
        await shell.locator('[data-tool="brick-layout"]').click();
        assert.equal(await frame.locator('#brickWidth').inputValue(), '90');
        await shell.screenshot({ path: path.join(output, 'brick-navigation.png'), fullPage: true });
        await shell.evaluate(() => localStorage.setItem('jiege-tool-order-v1', JSON.stringify([
            'quote-generator', 'hole-1200', 'order-template', 'wall-panel',
        ])));
        await shell.reload();
        const migrated = await shell.locator('#toolNav button').evaluateAll((nodes) => nodes.map((node) => node.dataset.tool));
        assert.deepEqual(migrated.slice(-2), ['hole-1200', 'brick-layout']);
        assert.deepEqual(migrated.slice(0, 3), ['quote-generator', 'order-template', 'wall-panel']);
        await shell.setViewportSize({ width: 390, height: 844 });
        assert.equal(await shell.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        console.log('PASS 首页新入口、孔心入口、切换保留参数、旧排序迁移、手机外壳');
        assert.deepEqual(errors, []);
        console.log('PASS console/pageerror = 0');
    } finally {
        await browser.close();
    }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
