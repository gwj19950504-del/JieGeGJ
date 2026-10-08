// Isolated synthetic orders; clipboard writes are intercepted in this browser only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = process.env.OUTPUT_DIR || path.resolve(root, '../work/best-payment-20261008/browser');
const errors = [], checks = [];
const address = '浙江省杭州市余杭区测试路1号';
async function fill(page, fields) {
  for (const [id, value] of Object.entries(fields)) await page.locator('#' + id).fill(value);
}
async function copy(page, button, result) {
  assert.equal(await page.locator(button).isDisabled(), false);
  await page.locator(button).click();
  const copied = await page.evaluate(() => window.__bestCopied);
  assert.equal(copied, await page.locator(result).textContent());
  return copied;
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
async function checkBrand(page) {
  assert.equal(await page.locator('.best-brand strong').evaluate(node => getComputedStyle(node).color), 'rgb(219, 6, 29)');
  const details = await page.locator('.best-title > div:last-child').boundingBox();
  assert.ok(details.width >= 110, `Header text is squeezed to ${details.width}px`);
}
function pass(name) { checks.push(name); console.log('PASS ' + name); }
async function checkVolume(page, total, quote, process, button, setPayment, stableFields = []) {
  const stable = await Promise.all(stableFields.map(selector => page.locator(selector).innerText()));
  assert.equal(await page.locator(total).innerText(), '104元');
  const copied = await copy(page, button, quote);
  assert.match(copied, /体积：2.46\*1.25\*0.25=0.77方/);
  assert.match(copied, /实重76KG与体积重154KG取大值=154KG（抛货）/);
  assert.match(copied, /运费92.4元、易碎品保险5元、送货费0元、DB3元/);
  assert.match(copied, /到付：100.4元\*1.03=103.412元，向上取整=104元/);
  assert.match(await page.locator(process).innerText(), /154KG\*0.6元\/KG=92.4元/);
  await setPayment('prepaid');
  assert.equal(await page.locator(total).innerText(), '101元');
  assert.match(await copy(page, button, quote), /我们付：100.4元（不加3%），向上取整=101元/);
  assert.deepEqual(await Promise.all(stableFields.map(selector => page.locator(selector).innerText())), stable);
  await setPayment('collect');
  assert.equal(await page.locator(total).innerText(), '104元');
  assert.deepEqual(await Promise.all(stableFields.map(selector => page.locator(selector).innerText())), stable);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [1332, 916, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(() => {
        window.__bestCopied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__bestCopied = text; } } });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      page.on('pageerror', err => errors.push(err.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      const open = name => page.goto(pathToFileURL(path.join(root, 'tools', name + '.html')).href);
      const shot = async (name, selector) => {
        await checkBrand(page);
        await noOverflow(page);
        return page.locator(selector).screenshot({ path: path.join(output, `${name}-${width}.png`) });
      };

      await open('freight-gold');
      await page.locator('.item-quantity').fill('60');
      await page.locator('#address').fill(address);
      assert.equal(await page.locator('#bestPaymentMode').inputValue(), 'collect');
      assert.equal(await page.locator('#bestTotal').innerText(), '816元');
      assert.match(await copy(page, '#copyBestBtn', '#bestQuote'), /1890KG/);
      assert.match(await page.locator('#bestProcess').innerText(), /1890KG\*0.3元\/KG=567元/);
      await shot('freight', '#bestSection');
      await page.locator('.item-material input[value="soft"]').check();
      await page.locator('.item-quantity').fill('2');
      await checkVolume(page, '#bestTotal', '#bestQuote', '#bestProcess', '#copyBestBtn', mode => page.locator('#bestPaymentMode').selectOption(mode));
      await shot('freight-volume', '#bestSection');
      await page.locator('.item-material input[value="hard"]').check();
      await page.locator('input[value="hard-600"]').check();
      assert.equal(await page.locator('#bestTotal').innerText(), '人工询价');
      assert.match(await copy(page, '#copyBestBtn', '#bestQuote'), /包装长宽高不完整/);
      await page.locator('input[value="hard-2440"]').check();
      await page.locator('.item-quantity').fill('60');
      await page.locator('#bestDestinationPickup').check();
      assert.equal(await page.locator('#bestTotal').innerText(), '713元');
      assert.equal(await page.locator('#bestDeliveryFee').innerText(), '送货费：0元');
      await page.locator('#bestDestinationPickup').uncheck();
      await page.locator('#address').fill('广西壮族自治区柳州市鱼峰区测试路');
      assert.match(await page.locator('#bestProcess').innerText(), /0.65元\/KG/);
      assert.equal(await page.locator('#bestTotal').innerText(), '1601元');
      await page.locator('.item-quantity').fill('8');
      await page.locator('#address').fill(address);
      assert.equal(await page.locator('#bestTotal').innerText(), '195元');
      assert.equal(await page.locator('#bestInsuranceFee').innerText(), '保费：5元');
      await page.locator('.item-quantity').fill('9');
      assert.equal(await page.locator('#bestInsuranceFee').innerText(), '保费：10元');
      await page.locator('.item-quantity').fill('60');
      await page.locator('#address').fill('青海省西宁市');
      assert.equal(await page.locator('#bestTotal').innerText(), '人工询价');
      assert.match(await copy(page, '#copyBestBtn', '#bestQuote'), /没有价格/);
      await page.locator('#bestPaymentMode').selectOption('prepaid');
      assert.equal(await page.locator('#bestTotal').innerText(), '人工询价');
      await page.locator('#clearBtn').click();
      assert.equal(await page.locator('#bestTotal').innerText(), '-');
      assert.equal(await page.locator('#bestPaymentMode').inputValue(), 'prepaid');
      await page.locator('#address').fill(address);
      await page.locator('.item-quantity').fill('-1');
      assert.equal(await page.locator('#copyBestBtn').isDisabled(), true);
      await page.locator('#resetFreightBtn').click();
      assert.equal(await page.locator('#bestDestinationPickup').isChecked(), false);
      assert.equal(await page.locator('#bestPaymentMode').inputValue(), 'collect');
      assert.equal(await page.locator('#bestTotal').innerText(), '-');
      await noOverflow(page);
      pass(`鎏金运费 ${width}px: collect/prepaid ceil, volumetric/actual, missing dimensions/rate, copy/clear/reset`);

      await open('order-template');
      await fill(page, { productName: '测试板', quantity: '60', sqmPrice: '70', totalAmount: '30000', receiverRaw: `测试收件人 13800000000 ${address}` });
      await page.locator('input[name="logistics"][value="百世"]').check();
      assert.equal(await page.locator('#orderBestTotal').innerText(), '816元');
      const normalKd = await page.locator('#kdPreview').innerText();
      const material = await page.locator('#materialPreview').innerText();
      assert.match(await page.locator('#result').innerText(), /运费：百世/);
      assert.match(await copy(page, '#copyOrderBestBtn', '#orderBestQuote'), /百世快运预估：816元/);
      await shot('order', '#orderBestSection');
      await page.locator('#specSelect').selectOption('soft-2440');
      await page.locator('#quantity').fill('2');
      await checkVolume(page, '#orderBestTotal', '#orderBestQuote', '#orderBestProcess', '#copyOrderBestBtn', async mode => {
        await page.locator(`input[name="freightPay"][value="${mode === 'collect' ? '到付' : '代付'}"]`).check();
        assert.match(await page.locator('#orderBestPaymentSummary').innerText(), mode === 'collect' ? /到付.*加3%/ : /我们付.*不加3%/);
      }, ['#materialPreview', '#kdPreview']);
      await shot('order-volume', '#orderBestSection');
      await page.locator('#specSelect').selectOption('hard-600');
      assert.equal(await page.locator('#orderBestTotal').innerText(), '人工询价');
      assert.match(await copy(page, '#copyOrderBestBtn', '#orderBestQuote'), /包装长宽高不完整/);
      await page.locator('#specSelect').selectOption('hard-2440');
      await page.locator('#quantity').fill('60');
      await page.locator('#orderBestDestinationPickup').check();
      assert.equal(await page.locator('#orderBestTotal').innerText(), '713元');
      assert.equal(await page.locator('#kdPreview').innerText(), normalKd);
      await page.locator('input[name="logistics"][value="跨越"]').check();
      assert.equal(Number(await page.locator('#kdPreview').innerText()), Number(normalKd) - 90);
      assert.equal(await page.locator('#orderBestSection').isVisible(), true);
      await page.locator('input[name="logistics"][value="百世"]').check();
      assert.equal(await page.locator('#materialPreview').innerText(), material);
      assert.equal(await page.locator('#kdPreview').innerText(), normalKd);
      await page.locator('input[name="warehouse"][value="宁波仓"]').check();
      assert.equal(await page.locator('input[name="logistics"][value="百世"]').count(), 0);
      assert.equal(await page.locator('#orderBestSection').isVisible(), false);
      await page.locator('#resetNextBtn').click();
      assert.equal(await page.locator('#orderBestDestinationPickup').isChecked(), false);
      assert.equal(await page.locator('input[name="freightPay"][value="到付"]').isChecked(), true);
      // This legacy example control is intentionally hidden; verify its retained handler only.
      await page.locator('#fillDemoBtn').dispatchEvent('click');
      assert.equal(await page.locator('input[name="logistics"][value="百世"]').isChecked(), true);
      await noOverflow(page);
      pass(`开单 ${width}px: 到付/代付同步与向上取整、抛货/实重、DB/KD不变、重置和复制`);

      await open('quote-generator');
      await fill(page, { product: '鎏金板', spec: '硬质-1220*2440*6mm', quantity: '60', unitPrice: '70', quoteFreightAddress: address });
      assert.equal(await page.locator('#quoteBestPaymentMode').inputValue(), 'collect');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '816元');
      assert.match(await copy(page, '#copyQuoteBestBtn', '#quoteBestQuote'), /百世快运预估：816元/);
      await shot('quote', '#quoteBestSection');
      await fill(page, { spec: '软质-1200*2440*2~3mm', quantity: '2' });
      await checkVolume(page, '#quoteBestTotal', '#quoteBestQuote', '#quoteBestProcess', '#copyQuoteBestBtn', mode => page.locator('#quoteBestPaymentMode').selectOption(mode));
      await shot('quote-volume', '#quoteBestSection');
      await page.locator('#quote').fill('人工商品报价保留123.45元');
      await page.locator('#quoteBestPaymentMode').selectOption('prepaid');
      assert.equal((await page.locator('#quote').innerText()).trim(), '人工商品报价保留123.45元');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '101元');
      await page.locator('#quoteBestPaymentMode').selectOption('collect');
      await page.locator('#resumeQuoteAuto').click();
      await page.locator('#spec').fill('硬质-1200*600*6mm');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '人工询价');
      assert.match(await copy(page, '#copyQuoteBestBtn', '#quoteBestQuote'), /包装长宽高不完整/);
      await fill(page, { spec: '硬质-1220*2440*6mm', quantity: '60' });
      await page.locator('#quoteBestDestinationPickup').check();
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '713元');
      await page.locator('#quoteBestPaymentMode').selectOption('prepaid');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '692元');
      const state = await page.evaluate(() => collectState());
      assert.equal(state.quoteBestDestinationPickup, true);
      assert.equal(state.quoteBestPaymentMode, 'prepaid');
      await page.locator('#quoteBestPaymentMode').selectOption('collect');
      await page.locator('#quoteBestDestinationPickup').uncheck();
      await page.evaluate(state => { applyState(state); render(); }, state);
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '692元');
      assert.equal(await page.locator('#quoteBestPaymentMode').inputValue(), 'prepaid');
      // A historic carrier option is intentionally not interpreted as a BEST pickup choice.
      await page.evaluate(state => { delete state.quoteBestDestinationPickup; delete state.quoteBestPaymentMode; state.quoteShunxinIncludeUpstairs = true; applyState(state); render(); }, state);
      assert.equal(await page.locator('#quoteBestDestinationPickup').isChecked(), false);
      assert.equal(await page.locator('#quoteBestPaymentMode').inputValue(), 'collect');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '816元');
      await page.locator('#multiMode').check();
      await page.getByText('不同仓库发货', { exact: true }).click();
      assert.equal(await page.locator('#copyQuoteBestBtn').isDisabled(), true);
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '-');
      assert.match(await page.locator('#quoteBestQuote').innerText(), /按仓库分别询价/);
      await page.locator('#quoteBestPaymentMode').selectOption('prepaid');
      assert.equal(await page.locator('#copyQuoteBestBtn').isDisabled(), true);
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '-');
      await page.locator('#quoteBestPaymentMode').selectOption('collect');
      await page.locator('#multiMode').uncheck();
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '816元');
      await page.locator('#quantity').fill('-1');
      assert.equal(await page.locator('#copyQuoteBestBtn').isDisabled(), true);
      await page.locator('#quoteBestPaymentMode').selectOption('prepaid');
      assert.equal(await page.locator('#copyQuoteBestBtn').isDisabled(), true);
      await page.locator('#resetBtn').click();
      assert.equal(await page.locator('#quoteBestDestinationPickup').isChecked(), false);
      assert.equal(await page.locator('#quoteBestPaymentMode').inputValue(), 'collect');
      assert.equal(await page.locator('#quoteBestTotal').innerText(), '-');
      await noOverflow(page);
      pass(`文字报价 ${width}px: collect/prepaid ceil, history/legacy default, manual quote, crosswarehouse/validation/reset`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`PASS ${checks.length} browser groups; no script/console errors`);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
