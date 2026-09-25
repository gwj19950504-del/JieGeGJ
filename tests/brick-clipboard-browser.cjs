// Real Clipboard API + native paste round trip in a separate headless Chrome session.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

async function run() {
    const server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname === '/paste-test') {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end('<!doctype html><title>Local image paste test</title><div contenteditable="true" id="paste">Paste here</div>');
            return;
        }
        const filename = path.resolve(root, '.' + pathname);
        if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
            response.writeHead(404).end();
            return;
        }
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
        response.setHeader('Content-Type', (types[path.extname(filename)] || 'application/octet-stream') + '; charset=utf-8');
        fs.createReadStream(filename).pipe(response);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const origin = `http://127.0.0.1:${server.address().port}`;
        browser = await chromium.launch({ headless: true,
            executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
        const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
        const page = await context.newPage();
        await page.goto(origin + '/index.html?tool=brick-layout');
        const frame = page.frameLocator('iframe[title="水泥板砖纹排版"]');
        await frame.locator('#brickWidth').fill('100');
        await frame.locator('#brickHeight').fill('1220');
        await frame.locator('#copyBrick').click();
        await frame.locator('#exportStatus').filter({ hasText: '图片已复制，已带原版' }).waitFor();
        const paste = await context.newPage();
        await paste.goto(origin + '/paste-test');
        await paste.evaluate(() => {
            document.addEventListener('paste', async (event) => {
                const image = [...event.clipboardData.items].find((item) => item.type === 'image/png');
                if (!image) return;
                const blob = image.getAsFile();
                const bitmap = await createImageBitmap(blob);
                window.pasteResult = { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height };
                bitmap.close();
            });
        });
        await paste.locator('#paste').click();
        await paste.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
        await paste.waitForFunction(() => window.pasteResult);
        const result = await paste.evaluate(() => window.pasteResult);
        assert.equal(result.type, 'image/png');
        assert.deepEqual([result.width, result.height], [2200, 2620]);
        assert.ok(result.size > 100000);
        console.log('PASS 首页 iframe 点击复制 → 浏览器原生粘贴获得带水印 PNG，2200×2620');
    } finally {
        if (browser) await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
