// Requires Playwright and local Chrome. Clipboard writes are mocked to protect the user's clipboard.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/ningbo-header-20260920');

async function choose(page, name, value) {
    await page.locator(`input[name="${name}"][value="${value}"]`).locator('..').click();
}

async function checkCopy(page, header, bodyFreight) {
    const text = await page.locator('#result').textContent();
    assert.equal(text.split('\n')[0], header);
    assert.match(text.split('\n')[1], /^\d+-宁波仓：/);
    assert.ok(text.split('\n')[1].includes(bodyFreight));
    assert.equal(await page.locator('#copyBtn').isDisabled(), false);
    await page.locator('#copyBtn').click();
    assert.equal(await page.evaluate(() => window.copiedOrder), text);
}

async function run() {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.addInitScript(() => {
            window.copiedOrder = '';
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                writeText: async (text) => { window.copiedOrder = text; },
            } });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto(pathToFileURL(path.join(root, 'tools/order-template.html')).href);
        await choose(page, 'warehouse', '宁波仓');
        for (const [id, value] of Object.entries({
            receiverRaw: '测试客户 13800000000 山东省枣庄市薛城区测试路',
            otherProductName: '测试板', otherSpecText: '1200*2400', otherQty: '28', otherSqmPrice: '75',
            crateFee: '260', taxAmount: '783', totalAmount: '8700',
        })) {
            await page.locator(`#${id}`).fill(value);
        }
        await choose(page, 'logistics', '明邦');
        await checkCopy(page, '明邦，到付', '运费：明邦到付  送货');
        assert.equal(await page.locator('#materialPreview').innerText(), '6048');
        assert.equal(await page.locator('#kdPreview').innerText(), '1609');
        const freightInquiry = await page.locator('#freightQuestion').textContent();
        console.log('PASS 明邦首行、正文运费、复制一致；材料6048/KD1609不变');
        await page.locator('#result').screenshot({ path: path.join(output, 'ningbo-header-desktop.png') });

        for (const logistics of ['安能', '货拉拉']) {
            await choose(page, 'logistics', logistics);
            await checkCopy(page, `${logistics}，到付`, `运费：${logistics}到付  送货`);
        }
        await choose(page, 'freightPay', '代付');
        await page.locator('#freightAmount').fill('100.5');
        await checkCopy(page, '货拉拉，100.5代付', '运费：货拉拉-100.5代付  送货');
        assert.equal(await page.locator('#kdPreview').innerText(), '1508.5');
        assert.equal(await page.locator('#freightQuestion').textContent(), freightInquiry);
        await choose(page, 'logistics', '默认');
        await checkCopy(page, '100.5代付', '运费：100.5代付  送货');
        await choose(page, 'logistics', '自提');
        await checkCopy(page, '工厂自提', '工厂自提，货物明细：');
        console.log('PASS 其他宁波物流、金额/代付、默认、自提；运费询价模板未变');

        for (const warehouse of ['浙江仓', '美利来', '混凝土仓', '水泥板仓库', '自选仓']) {
            await choose(page, 'warehouse', warehouse);
            const text = await page.locator('#result').textContent();
            assert.match(text.split('\n')[0], /^\d+-/);
            assert.ok(!text.startsWith('工厂自提\n'));
        }
        await choose(page, 'warehouse', '宁波仓');
        await choose(page, 'logistics', '明邦');
        await choose(page, 'freightPay', '到付');
        await page.locator('#freightAmount').fill('');
        await checkCopy(page, '明邦，到付', '运费：明邦到付  送货');
        console.log('PASS 其他五仓无首行，来回切仓后宁波首行不重复');

        await page.locator('#result').fill('人工确认的开单正文');
        const manualText = await page.locator('#result').textContent();
        await choose(page, 'logistics', '安能');
        await page.locator('#copyBtn').click();
        assert.equal(await page.evaluate(() => window.copiedOrder), manualText);
        await page.locator('#resumeAutoBtn').click();
        await checkCopy(page, '安能，到付', '运费：安能到付  送货');
        console.log('PASS 手工编辑保持原文，恢复自动生成后只有一行物流标题');

        await page.setViewportSize({ width: 390, height: 844 });
        await checkCopy(page, '安能，到付', '运费：安能到付  送货');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.locator('#result').screenshot({ path: path.join(output, 'ningbo-header-mobile.png') });
        assert.deepEqual(errors, []);
        console.log('PASS 手机复制、无整页横溢、无脚本/控制台错误');
    } finally {
        await browser.close();
    }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
