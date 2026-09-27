// Scoped visual and interaction regression for the freight material selector.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/freight-material-20260926');

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const checks = [], errors = [];
    try {
        for (const width of [1812, 1332, 916, 660, 390, 320]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
                value: { writeText: async text => { window.__copied = text; } } }));
            const page = await context.newPage();
            page.setDefaultTimeout(6000);
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            await page.goto(pathToFileURL(path.join(root, 'tools/freight-gold.html')).href);
            async function checkGroups() {
                const groups = await page.locator('.item-material').evaluateAll(nodes => nodes.map(node => {
                    const css = getComputedStyle(node), box = node.getBoundingClientRect();
                    return { background: css.backgroundColor, padding: css.padding, shadow: css.boxShadow,
                        height: box.height, gap: css.columnGap, segmented: node.classList.contains('segmented'),
                        options: [...node.querySelectorAll('.option')].map(label => {
                            const span = label.querySelector('span'), rect = span.getBoundingClientRect();
                            return { labelHeight: label.getBoundingClientRect().height, height: rect.height,
                                offset: rect.top - box.top, overflow: span.scrollWidth > span.clientWidth + 1 };
                        }) };
                }));
                for (const group of groups) {
                    assert.equal(group.segmented, false);
                    assert.equal(group.background, 'rgba(0, 0, 0, 0)');
                    assert.equal(group.padding, '0px');
                    assert.equal(group.shadow, 'none');
                    assert.equal(group.height, 44);
                    assert.equal(group.gap, '12px');
                    for (const option of group.options) assert.deepEqual(option, { labelHeight: 44, height: 44, offset: 0, overflow: false });
                }
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
                return groups;
            }
            await checkGroups();
            await page.locator('.item-quantity').first().fill('6');
            await page.locator('#copyBtn').click();
            const original = await page.evaluate(() => window.__copied);
            assert.match(original, /226KG/);
            await page.locator('.item-material input[value="soft"]').first().check();
            assert.equal(await page.locator('.item-material input[value="soft"]').first().isChecked(), true);
            assert.equal(await page.locator('.item-quantity').first().inputValue(), '6');
            await checkGroups();
            await page.locator('.item-material input[value="hard"]').first().check();
            await page.locator('#copyBtn').click();
            assert.equal(await page.evaluate(() => window.__copied), original);
            await page.locator('#addItemBtn').click();
            await page.locator('.item-material input[value="soft"]').nth(1).check();
            await page.locator('.item-quantity').nth(1).fill('2');
            assert.equal(await page.locator('.item-material input[value="hard"]').first().isChecked(), true);
            assert.equal(await page.locator('.item-material input[value="soft"]').nth(1).isChecked(), true);
            await page.locator('#copyBtn').click();
            assert.notEqual(await page.evaluate(() => window.__copied), original);
            const groups = await checkGroups();
            await page.locator('.freight-item').first().screenshot({ path: path.join(output, `material-${width}.png`) });
            await page.locator('.freight-item-remove').nth(1).click();
            await page.locator('#copyBtn').click();
            assert.equal(await page.evaluate(() => window.__copied), original);
            await page.locator('.item-material input[value="hard"]').focus();
            await page.keyboard.press('ArrowRight');
            assert.equal(await page.locator('.item-material input[value="soft"]').isChecked(), true);
            // The existing handler rebuilds the row after a change; refocus the new radio.
            await page.locator('.item-material input[value="soft"]').focus();
            const focus = await page.locator('.item-material input[value="soft"] + span').evaluate(node => {
                const css = getComputedStyle(node);
                return { outline: css.outlineStyle, width: css.outlineWidth, selected: css.backgroundColor };
            });
            assert.deepEqual(focus, { outline: 'solid', width: '2px', selected: 'rgb(234, 243, 255)' });
            checks.push({ width, groups, focus });
            console.log(`PASS ${width}px: no gray tray, equal 44px heights, add/switch/remove/copy/focus`);
            await context.close();
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
