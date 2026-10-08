// Synthetic orders in isolated Chrome; no real customer records or system clipboard.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/best-payment-20261008/address-browser');
const address = '浙江省台州市椒江区海龙路 台州市公共交通集团有限公司(公交TOD大厦)';
const cleanAddress = address.replace(/\s+/g, '');
const nextAddress = '江苏省南京市玄武区测试路1号';
const errors = [], checks = [];
async function copy(page, button, result) {
  await page.locator(button).click();
  const copied = await page.evaluate(() => window.__copied);
  assert.equal(copied, await page.locator(result).innerText());
  return copied;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [1332, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(() => {
        window.__copied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copied = text; } } });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(pathToFileURL(path.join(root, 'tools/order-template.html')).href);
      await page.locator('#productName').fill('白锈');
      await page.locator('#specSelect').selectOption('soft-2440');
      await page.locator('#quantity').fill('2');
      await page.locator('#sqmPrice').fill('80');
      await page.locator('#totalAmount').fill('1000');
      await page.locator('input[name="logistics"][value="百世"]').check();
      const material = await page.locator('#materialPreview').innerText();
      const kd = await page.locator('#kdPreview').innerText();
      await page.locator('#receiverRaw').fill(address);
      assert.equal(await page.locator('#receiverAddress').inputValue(), cleanAddress);
      assert.equal(await page.locator('#receiverName').inputValue(), '');
      assert.equal(await page.locator('#receiverPhone').inputValue(), '');
      assert.equal(await page.locator('#orderBestTotal').innerText(), '104元');
      assert.equal(await page.locator('#orderBestInsuranceFee').innerText(), '保费：5元');
      assert.match(await page.locator('#orderBestProcess').innerText(), /154KG\*0.6元\/KG=92.4元/);
      assert.ok((await page.locator('#result').innerText()).includes(`姓名，电话，${cleanAddress}`));
      assert.ok((await copy(page, '#copyFreightQuestionBtn', '#freightQuestion')).startsWith(cleanAddress));
      assert.ok((await copy(page, '#copyOrderBestBtn', '#orderBestQuote')).includes(cleanAddress));
      await page.locator('#freightQuestionWrap').screenshot({ path: path.join(output, `question-${width}.png`) });
      await page.locator('#orderBestSection').screenshot({ path: path.join(output, `best-${width}.png`) });

      await page.locator('#receiverRaw').fill(nextAddress);
      assert.equal(await page.locator('#receiverAddress').inputValue(), nextAddress);
      assert.ok((await page.locator('#freightQuestion').innerText()).startsWith(nextAddress));
      assert.ok(!(await page.locator('#orderBestQuote').innerText()).includes(cleanAddress));
      assert.equal(await page.locator('#materialPreview').innerText(), material);
      assert.equal(await page.locator('#kdPreview').innerText(), kd);

      await page.locator('#receiverRaw').fill('');
      assert.equal(await page.locator('#receiverAddress').inputValue(), '');
      assert.match(await page.locator('#freightQuestion').innerText(), /请填写收货地址/);
      assert.equal(await page.locator('#orderBestTotal').innerText(), '-');
      assert.ok(!(await page.locator('#orderBestQuote').innerText()).includes(nextAddress));
      await page.locator('#receiverRaw').fill('路小明');
      assert.equal(await page.locator('#receiverName').inputValue(), '路小明');
      assert.equal(await page.locator('#receiverAddress').inputValue(), '');
      assert.equal(await page.locator('#orderBestTotal').innerText(), '-');

      await page.locator('#receiverRaw').fill(`测试收件人 13800000000 ${address}`);
      assert.equal(await page.locator('#receiverName').inputValue(), '测试收件人');
      assert.equal(await page.locator('#receiverPhone').inputValue(), '13800000000');
      assert.equal(await page.locator('#orderBestTotal').innerText(), '104元');
      const manual = '人工正文保留，金额123.45';
      await page.locator('#result').fill(manual);
      await page.locator('#receiverRaw').fill(nextAddress);
      assert.equal((await copy(page, '#copyBtn', '#result')).trimEnd(), manual);
      assert.ok((await page.locator('#freightQuestion').innerText()).startsWith(nextAddress));
      await page.locator('#resumeAutoBtn').click();
      assert.ok((await page.locator('#result').innerText()).includes(nextAddress));

      // The same parsed address also feeds the Ningbo inquiry, not only BEST.
      await page.locator('input[name="warehouse"][value="宁波仓"]').check();
      await page.locator('#otherProductName').fill('测试板');
      await page.locator('#otherSpecText').fill('1200*2400');
      await page.locator('#otherQty').fill('2');
      await page.locator('#otherSqmPrice').fill('75');
      assert.equal((await page.locator('#freightQuestion').innerText()).split('\n')[0], nextAddress);
      await page.locator('#resetNextBtn').click();
      assert.equal(await page.locator('#receiverRaw').inputValue(), '');
      assert.equal(await page.locator('#receiverAddress').inputValue(), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      checks.push(`${width}px: address-only, collect 104 yuan, copy/change/clear/name-only/contact/manual/Ningbo/reset`);
      console.log('PASS ' + checks.at(-1));
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
