const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['order-template', 'quote-generator', 'quick-price', 'report-template', 'ningbo-weight', 'freight-gold', 'full-board-cut', 'hole-1200', 'wall-panel'];
const css = read('tools/apple-ui.css');

test('首页及九个子工具接入各自最新苹果风样式，完整包不遗漏 CSS', () => {
  assert.match(read('index.html'), /tools\/apple-shell\.css\?v=20260907-3/);
  assert.ok(fs.existsSync(path.join(root, 'tools/apple-shell.css')));
  for (const page of pages) {
    const html = read(`tools/${page}.html`);
    assert.match(html, /apple-ui\.css\?v=20260919-1/);
    assert.ok(html.includes(`class="apple-ui" data-page="${page}"`), page);
    assert.ok(html.indexOf('apple-ui.css') < html.indexOf('</head>'), page);
  }
});

test('全工具占位提示统一半透明，不覆盖实际输入内容或使用金额强调色', () => {
  assert.match(css, /body\.apple-ui :is\(input, textarea\)::placeholder\s*\{[^}]*color: #74747d !important;[^}]*opacity: 0\.5 !important;[^}]*font-weight: 400 !important;/);
  assert.equal((css.match(/::placeholder/g) || []).length, 1);
  assert.doesNotMatch(css, /#totalAmount::placeholder/);
});

test('报备两处复制重置及局部对齐规则保持完整', () => {
  const report = read('tools/report-template.html');
  for (const id of ['copyTop', 'copyBtn']) assert.match(report, new RegExp(`id="${id}"[^>]*>复制</button>`));
  for (const id of ['resetTop', 'resetSide']) assert.match(report, new RegExp(`id="${id}"[^>]*>重置</button>`));
  assert.match(report, /\$\("#copyTop"\)\.addEventListener\("click", copyOutput\)/);
  assert.match(css, /\.section-actions \.btn\s*\{[^}]*width: 72px !important/);
  assert.match(css, /\.concrete-hole-card\s*\{ align-items: end !important/);
  assert.match(css, /button\.product\.active:not\(\.secondary\):not\(\.ghost\)\s*\{[^}]*box-shadow: inset/);
});

test('水泥板四字段同行、单价无嵌套框且空追加容器不占位', () => {
  assert.match(css, /\.cement-card\s*\{[^}]*grid-template-columns: minmax\(0,2fr\) repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.cement-card > \.wide\s*\{ grid-column: auto/);
  assert.match(css, /\.cement-card > \.unit-price-field\s*\{[^}]*padding: 0 !important;[^}]*border: 0 !important/);
  assert.match(css, /#cementAdditionalProducts:empty\s*\{ display: none !important/);
});

test('开单各仓分组不叠加底部留白，空产品容器隐藏且混凝土字段铺满网格', () => {
  assert.match(css, /\.form-grid\s*\{ gap: 12px 16px;/);
  assert.match(css, /padding: 12px 0 0 !important; margin-block: 0 !important/);
  assert.match(css, /:is\(#additionalProducts, #otherAdditionalProducts, #concreteAdditionalProducts\):empty \{ display: none !important/);
  assert.match(css, /\[data-concrete-product-row\] > div \{ grid-column: span 2;/);
  assert.match(css, /\[data-concrete-product-row\] > \.concrete-match-tools \{ grid-column: 1 \/ -1;/);
});

test('报备重置采用中性灰次级按钮，不再使用橙色装饰', () => {
  assert.match(css, /:is\(#resetTop, #resetSide\)\s*\{[^}]*background: #f2f2f7 !important;[^}]*color: #48484a !important;[^}]*font-weight: 500 !important/);
  assert.doesNotMatch(css, /#fff0e3|#934400|#e9c8a9|#ffe3ca/);
});

test('混凝土打孔说明贴合输入行，附加费用说明利用右列', () => {
  assert.match(css, /\.concrete-hole-card > \.hint\s*\{[^}]*align-self: end; min-height: 44px; display: flex; align-items: center/);
  assert.match(css, /\.concrete-surface-options\s*\{[^}]*grid-template-columns: minmax\(0,2fr\) minmax\(0,1fr\)/);
  assert.match(read('tools/order-template.html'), /class="concrete-extra-options concrete-surface-options"/);
});

test('开单14种付款方式含三个个体户，桌面五列三行', () => {
  const order = read('tools/order-template.html');
  assert.equal((order.match(/name="paymentMethod"/g) || []).length, 14);
  for (const name of ['云苗个体户', '安苗个体户', '悦苗个体户']) assert.ok(order.includes(`name="paymentMethod" value="${name}"><span>${name}</span>`));
  assert.match(css, /#paymentMethodGroup \{ grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
});

test('苹果风保留语义色、键盘焦点及减少动态效果选项', () => {
  for (const token of ['--apple-blue:', '--apple-green:', '--apple-orange:', '--apple-red:', ':focus-visible', 'prefers-reduced-motion: reduce']) {
    assert.ok(css.includes(token), token);
  }
  for (const selector of ['.green-count-options', '.minimum-price', '.remove-product', '.delete-history', '.quote-suggestion-item:focus-visible']) {
    assert.ok(css.includes(selector), selector);
  }
});

test('新增界面样式限定屏幕媒体，不覆盖图纸 SVG 内部几何', () => {
  assert.match(css, /^\/\*[^]*?\*\/\s*@media screen\s*\{/);
  assert.doesNotMatch(css, /@media\s+print/);
  assert.doesNotMatch(css, /(?:svg|#drawing)\s+(?:rect|text|line|circle|path|\*)\b/);
  assert.doesNotMatch(css, /(?:viewBox|stroke-width)\s*:/);
});

test('窄屏表单、价格卡和图纸表格具有独立排版规则', () => {
  for (const token of ['max-width: 430px', 'max-width: 680px', 'max-width: 760px', 'max-width: 980px', '#otherProductCount', 'overflow-x: auto', '.price-values > b', '.field-label-row']) {
    assert.ok(css.includes(token), token);
  }
  assert.match(css, /\.cuts[^{}]*\{[^}]*min-width:\s*0;[^}]*overflow-x:\s*auto/);
});

test('完整包所有 HTML 的本地脚本、样式与图片引用都可找到', () => {
  for (const file of ['index.html', ...pages.map(page => `tools/${page}.html`)]) {
    for (const match of read(file).matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
      const ref = match[1];
      if (/^(?:https?:|data:|\/\/)/.test(ref)) continue;
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), ref)), `${file}: ${ref}`);
    }
  }
});

test('修补剂单项同行，数量框固定宽度且保留展开与原控件绑定', () => {
  assert.match(css, /\.repair-agent-card\s*\{\s*display:\s*grid;/);
  assert.match(css, /\.repair-agent-grid\s*\{[^}]*grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.repair-agent-qty-row\s*\{[^}]*grid-template-columns:\s*auto 48px/);
  assert.match(css, /input\.repair-agent-qty\s*\{[^}]*width:\s*48px/);
  assert.match(css, /\.repair-agent-card \.checkline\s*\{[^}]*border:\s*0 !important/);
  const order = read('tools/order-template.html');
  for (const weight of [50, 100, 200, 500]) {
    assert.match(order, new RegExp(`id="repairAgent${weight}"[^>]*type="checkbox"`));
    assert.match(order, new RegExp(`id="repairAgentQty${weight}"[^>]*value="1" disabled`));
  }
  assert.match(order, /id="repairAgentBody"[^>]*hidden/);
});

test('侧栏参考5.0收窄，保留分隔按钮及手机规则', () => {
  const shell = read('tools/apple-shell.css');
  assert.match(shell, /\.app\s*\{[^}]*grid-template-columns:\s*108px minmax\(0,1fr\)/);
  assert.match(shell, /\.nav\s*\{\s*gap:\s*4px/);
  assert.match(shell, /\.brand\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(shell, /\.tool-button\s*\{[^}]*border:\s*1px solid[^}]*font-size:\s*15px/);
  assert.match(shell, /\.tool-button\.active\s*\{[^}]*border-color:\s*#6b9dd5/);
  assert.match(shell, /@media\(max-width:920px\)/);
  assert.match(shell, /\.tool-button:focus-visible/);
});
