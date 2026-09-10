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
    assert.match(html, /apple-ui\.css\?v=20260908-2/);
    assert.ok(html.includes(`class="apple-ui" data-page="${page}"`), page);
    assert.ok(html.indexOf('apple-ui.css') < html.indexOf('</head>'), page);
  }
});

test('全工具占位提示统一半透明，不覆盖实际输入内容或使用金额强调色', () => {
  assert.match(css, /body\.apple-ui :is\(input, textarea\)::placeholder\s*\{[^}]*color: #74747d !important;[^}]*opacity: 0\.5 !important;[^}]*font-weight: 400 !important;/);
  assert.equal((css.match(/::placeholder/g) || []).length, 1);
  assert.doesNotMatch(css, /#totalAmount::placeholder/);
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

test('修补剂卡片独立两行，数量框固定宽度且保留展开与原控件绑定', () => {
  assert.match(css, /\.repair-agent-card\s*\{\s*display:\s*grid;/);
  assert.match(css, /\.repair-agent-qty-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) 80px/);
  assert.match(css, /input\.repair-agent-qty\s*\{[^}]*width:\s*80px/);
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
