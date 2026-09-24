const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const customerHtml = path.join(root, "宁波仓价格表", "客户版", "MM苗苗柔岩板价格表.html");

test("宁波客户价格表逐规格出厂价为目录价加10，且不展示内部计价字段", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "tools", "product-data.js"), "utf8"), context);
  const expected = context.window.JieGeProductData.ningboProductCatalog.flatMap((product) =>
    product.specs.map(() => product.price + 10));
  const html = fs.readFileSync(customerHtml, "utf8");
  const rows = [...html.matchAll(/<tr class="price-row[^\"]*" data-search="[^\"]+">([\s\S]*?)<\/tr>/g)];

  assert.match(html, /<h1>MM苗苗柔岩板价格表<\/h1>/);
  assert.equal(rows.length, expected.length);
  assert.equal(rows.length, 120);
  rows.forEach((match, index) => {
    const price = /<td data-label="出厂价" class="price">¥([^<]+)<\/td>/.exec(match[1]);
    assert.ok(price, `第 ${index + 1} 行缺少出厂价`);
    assert.equal(Number(price[1]), expected[index]);
    assert.match(match[1], /<td data-label="备注" class="note">打印另加 10 元\/㎡<\/td>/);
  });
  assert.doesNotMatch(html, /原表底价|原表价|打印参考价|开单目录/);
});
