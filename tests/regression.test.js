const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function functionSource(file, name) {
  const source = read(file);
  const match = new RegExp(`^([ \\t]*)function ${name}\\(`, "m").exec(source);
  assert.ok(match, name);
  const closing = new RegExp(`^${match[1]}\\}`, "gm");
  closing.lastIndex = match.index;
  for (let end; (end = closing.exec(source));) {
    const candidate = source.slice(match.index, end.index + end[0].length);
    try { new vm.Script(`(${candidate})`); return candidate; } catch {}
  }
  throw new Error(`Cannot extract ${name}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadCore(rateData) {
  const context = { window: { SHUNXIN_RATE_DATA: rateData } };
  vm.createContext(context);
  vm.runInContext(read("tools/freight-gold-core.js"), context);
  return context.window.GoldFreightCore;
}

function loadShunxinRateData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("tools/shunxin-rates.js"), context);
  return JSON.parse(JSON.stringify(context.window.SHUNXIN_RATE_DATA));
}

function loadNingboCore() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("tools/ningbo-freight-core.js"), context);
  return context.window.NingboFreightCore;
}

function loadProductData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read("tools/product-data.js"), context);
  return context.window.JieGeProductData;
}

const sampleRates = {
  tiers: [
    { min: 100, max: 500, label: "100-500KG" },
    { min: 501, max: 999, label: "501-999KG" },
    { min: 1000, max: 1500, label: "1000-1500KG" }
  ],
  specialAreas: ["测试特别区"],
  rows: [
    { region: "测试省甲市", aliases: ["测试省甲市", "甲市"], rates: [1.4, 1.3, 1.2], eta: "2-3天", note: "" },
    { region: "测试省乙市", aliases: ["测试省乙市", "乙市"], rates: [3, 2.8, 2.6], eta: "3-4天", note: "" }
  ]
};

test("顺心捷达使用2026-08-15嘉兴最新四档报价", () => {
  const data = loadShunxinRateData();
  assert.equal(data.updatedAt, "2026-08-15");
  assert.deepEqual(data.tiers.map((tier) => tier.label), [
    "100kg-500kg",
    "500kg-999kg",
    "1000kg-2000kg",
    "2000kg以上"
  ]);
  const actual = Object.fromEntries(data.rows.map((row) => [row.region, row.rates]));
  assert.deepEqual(actual, {
    "江浙沪": [0.6, 0.55, 0.5, 0.46],
    "安徽省": [0.65, 0.6, 0.55, 0.5],
    "广东省": [0.85, 0.8, 0.75, 0.7],
    "福建省": [0.85, 0.8, 0.75, 0.7],
    "山东省": [0.85, 0.8, 0.8, 0.7],
    "江西省": [0.85, 0.85, 0.8, 0.7],
    "湖北省": [0.9, 0.8, 0.8, 0.7],
    "湖南省": [0.9, 0.85, 0.8, 0.7],
    "河南省": [0.9, 0.78, 0.75, 0.7],
    "天津": [1, 0.9, 0.75, 0.7],
    "北京": [1, 0.9, 0.8, 0.77],
    "河北省": [0.9, 0.85, 0.8, 0.77],
    "陕西省": [1.3, 1.2, 1, 0.86],
    "山西省": [1.3, 1.2, 1, 0.86],
    "重庆市": [1.3, 1.2, 1, 0.86],
    "四川": [1.3, 1.2, 1, 0.86],
    "广西省": [1.3, 1.2, 1, 0.86],
    "贵州": [1.3, 1.2, 1, 0.86],
    "云南省": [1.4, 1.3, 1.2, 1.1],
    "海南省": [1.9, 1.7, 1.5, 1.4],
    "甘肃省": [1.5, 1.4, 1.3, 1.2],
    "东北三省": [1.4, 1.2, 1.1, 1],
    "内蒙古": [1.6, 1.5, 1.4, 1.3],
    "青海省": [1.6, 1.5, 1.4, 1.2],
    "宁夏省": [1.6, 1.5, 1.4, 1.2],
    "西藏": [2.5, 2.3, 1.9, 1.7],
    "新疆": [2.5, 2.3, 1.9, 1.7]
  });
  assert.equal(data.conditionalFeeNotes.length, 3);
});

test("顺心捷达最新重量档边界连续并支持2000kg以上", () => {
  const data = loadShunxinRateData();
  const core = loadCore(data);
  const quote = (weight) => core.buildShunxinQuote({
    address: "广东省广州市",
    totalWeight: weight,
    pkg: { outer: "1*1*1" },
    weightLine: `${weight}KG`,
    packageLine: "木箱：1*1*1",
    dbLine: "",
    db: 0
  });
  assert.match(quote(500).processText, /0\.85元\/KG=.*100kg-500kg/);
  assert.match(quote(500.5).processText, /0\.8元\/KG=.*500kg-999kg/);
  assert.match(quote(1000).processText, /0\.75元\/KG=.*1000kg-2000kg/);
  assert.match(quote(2000).processText, /0\.75元\/KG=.*1000kg-2000kg/);
  assert.match(quote(2000.5).processText, /0\.7元\/KG=.*2000kg以上/);
  assert.match(quote(2000.5).processText, /到付手续费按到付金额的6%/);
});

function quoteInput(address, totalWeight) {
  return {
    address,
    totalWeight,
    pkg: { size: "2.46*1.25*0.25" },
    weightLine: `${totalWeight}KG`,
    packageLine: "2米托盘：2.46*1.25*0.25",
    dbLine: "DB3",
    db: 3
  };
}

test("顺心捷达重量超过报价上限时停止自动报价", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试省甲市", 2001));
  assert.equal(result.totalText, "人工询价");
  assert.match(result.quoteText, /超出顺心捷达自动报价限制/);
});

test("顺心捷达按实际重量和体积重量取大值并加入DB", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试省甲市", 325));
  assert.equal(result.totalText, "463元");
  assert.match(result.processText, /计费重量：MAX\(325, 153\.8\)=325KG/);
  assert.match(result.quoteText, /顺心捷达预估：463元/);
});

test("顺心捷达保费按货值千分之三计算且最低5元", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.shunxinInsuranceFee(), 5);
  assert.equal(core.shunxinInsuranceFee(2000), 5);
  assert.equal(core.shunxinInsuranceFee(10000), 30);
  const result = core.buildShunxinQuote({ ...quoteInput("测试省甲市", 325), declaredValue: 10000 });
  assert.equal(result.insuranceFee, 30);
  assert.equal(result.totalText, "488元");
  assert.match(result.processText, /保费：30元（10000\*0\.003）/);
});

test("顺心捷达始终计算上门费，仅勾选后并入合计", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.shunxinUpstairsFee(40), 0);
  assert.equal(core.shunxinUpstairsFee(325), 57.5);
  const defaultResult = core.buildShunxinQuote(quoteInput("测试省甲市", 325));
  assert.equal(defaultResult.upstairsFee, 57.5);
  assert.equal(defaultResult.totalText, "463元");
  assert.match(defaultResult.processText, /上门费：57\.5元（未勾选，不计入合计）/);
  const includedResult = core.buildShunxinQuote({ ...quoteInput("测试省甲市", 325), includeUpstairsFee: true });
  assert.equal(includedResult.totalText, "520.5元");
  assert.match(includedResult.processText, /上门费：57\.5元（已计入合计）/);
});

test("顺心捷达特殊地区转人工询价", () => {
  const core = loadCore(sampleRates);
  const result = core.buildShunxinQuote(quoteInput("测试特别区某路", 325));
  assert.equal(result.totalText, "人工询价");
  assert.match(result.processText, /单独询价/);
});

test("顺心捷达优先识别省级地址并拒绝道路名和多省歧义", () => {
  const core = loadCore(loadShunxinRateData());
  assert.equal(core.matchShunxinRate("湖北省武汉市上海路88号").row.region, "湖北省");
  assert.equal(core.matchShunxinRate("江苏省南京市贵阳路10号").row.region, "江浙沪");
  assert.equal(core.matchShunxinRate("贵阳路10号").type, "none");
  assert.equal(core.matchShunxinRate("广东省广州市转浙江省杭州市").type, "ambiguous");
  assert.equal(core.matchShunxinRate("南京市徐州路1号").type, "none");
});

test("鎏金规格厚度由公共核心严格识别", () => {
  const core = loadCore(sampleRates);
  assert.deepEqual(JSON.parse(JSON.stringify(core.resolveFreightSpec("硬质-1220*2440*6mm"))), { material: "hard", specKey: "hard-2440" });
  assert.deepEqual(JSON.parse(JSON.stringify(core.resolveFreightSpec("软质-1200*2440*2～3mm"))), { material: "soft", specKey: "soft-2440" });
  assert.equal(core.resolveFreightSpec("1220*2440*20mm"), null);
  assert.equal(core.resolveFreightSpec("1220*2440mm"), null);
  assert.equal(core.matchSpecKey("hard", "1220*2440*20mm"), null);
});

test("公共包装核心统一处理硬软混装和多只小托盘", () => {
  const core = loadCore(sampleRates);
  const mixed = core.calculateShipment([
    { material: "hard", specKey: "hard-2440", quantity: 9 },
    { material: "soft", specKey: "soft-2440", quantity: 2 }
  ]);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.pkg.output, "2米托盘");
  assert.equal(mixed.totalWeight, 346);
  assert.equal(mixed.weightLine, "9*30+2*15+46=346KG");
  const small = core.calculateShipment([{ material: "hard", specKey: "hard-600", quantity: 201 }]);
  assert.equal(small.pkg.output, "小托盘 x 3");
  assert.equal(small.pkg.weight, 48);
  assert.equal(small.pkg.size, undefined);
});

test("鎏金运费页面只使用公共顺心捷达核心", () => {
  const html = read("tools/freight-gold.html");
  assert.doesNotMatch(html, /function matchShunxinRate\(/);
  assert.match(html, /freightCore\.buildShunxinQuote/);
});

test("鎏金运费不支持的规格不会回退成默认规格", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.matchSpecKey("hard", "硬质-1220*2800*6mm"), null);
  const result = core.calculateShipment([
    { material: "hard", specKey: null, quantity: 2 }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.type, "unsupported-spec");
});

test("鎏金运费页面只保留公共包装核算逻辑", () => {
  const html = read("tools/freight-gold.html");
  assert.match(html, /freightCore\.calculateShipment/);
  assert.doesNotMatch(html, /function choosePackage\(/);
  assert.doesNotMatch(html, /function shipmentLengthType\(/);
});

test("浙江仓 DB 按小中大板规格分别计价并封顶", () => {
  const core = loadCore(sampleRates);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-600", quantity: 12 }]), 6);
  assert.equal(core.calculateDb([{ spec: { label: "600*2440mm" }, quantity: 12 }]), 9);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 12 }]), 18);
  assert.equal(core.calculateDb([
    { material: "hard", specKey: "hard-600", quantity: 12 },
    { spec: { label: "600*2440mm" }, quantity: 4 },
    { material: "hard", specKey: "hard-2440", quantity: 2 }
  ]), 12);
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 31 }]), 47);
  const roundedShipment = core.calculateShipment([
    { material: "hard", specKey: "hard-2440", quantity: 31 }
  ]);
  assert.equal(roundedShipment.db, 47);
  assert.equal(roundedShipment.dbLine, "DB47");
  assert.equal(core.calculateDb([{ material: "hard", specKey: "hard-2440", quantity: 100 }]), 100);
});

test("浙江仓开单、鎏金运费和文字报价共用 DB 核心", () => {
  const order = read("tools/order-template.html");
  assert.match(order, /GoldFreightCore\.calculateShipment\(products\.map/);
  assert.doesNotMatch(order, /function choosePackage\(/);
  assert.doesNotMatch(order, /function chooseSmallPalletPackage\(/);
  assert.doesNotMatch(order, /totalQty \* 1\.5/);
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="freight-gold-core\.js\?v=20260919-1"><\/script>/, file);
  }
});

test("浙江仓物流包含顺心捷达和跨越且不影响其它仓库", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /"浙江仓": \["默认", "姜冉", "西武", "安能", "顺心捷达", "跨越", "货拉拉", "自提"\]/);
  assert.match(html, /"宁波仓": \["默认", "安能", "明邦", "货拉拉", "自提"\]/);
  assert.doesNotMatch(html, /"(?:松诺|168|苏州仓|华中仓|淮海仓|昌盛仓|自选仓)": \[[^\]]*(?:安能|顺心捷达)/);
  assert.match(html, /function renderLogistics\(\)[\s\S]{0,500}index === 0 \? "checked" : ""/);
});

test("浙江仓跨越和货拉拉把DB写进开单并扣除KD", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /function separatesDbLine\(warehouse, logistics\) \{\s*return warehouse === "浙江仓" && logistics !== "跨越" && logistics !== "货拉拉";\s*\}/);
  assert.match(html, /const dbDeduction = warehouse === "浙江仓" && !dbAsSeparateLine \? built\.db : 0;/);
  assert.match(html, /const dbPart = warehouse === "浙江仓" && !dbAsSeparateLine && built\.db > 0 \? `，DB：\$\{money\(built\.db\)\}` : "";/);
  assert.match(html, /const dbLine = dbAsSeparateLine && built\.db > 0 \? `DB\$\{money\(built\.db\)\}` : "";/);
});

test("顺心捷达三个入口均接入保费和上门费", () => {
  const freight = read("tools/freight-gold.html");
  const order = read("tools/order-template.html");
  const quote = read("tools/quote-generator.html");
  assert.match(freight, /id="shunxinDeclaredValue"/);
  assert.match(freight, /declaredValue: els\.shunxinDeclaredValue\.value/);
  assert.match(freight, /includeUpstairsFee: els\.shunxinIncludeUpstairs\.checked/);
  assert.match(order, /declaredValue: total/);
  assert.match(order, /includeUpstairsFee: els\.orderShunxinIncludeUpstairs\.checked/);
  assert.match(order, /const show = warehouse === "浙江仓" && isLiujin;/);
  assert.match(quote, /declaredValue: currentQuoteTotal/);
  assert.match(quote, /includeUpstairsFee: els\.quoteShunxinIncludeUpstairs\.checked/);
});

test("文字报价和开单模板始终保留顺心捷达报价窗口", () => {
  const order = read("tools/order-template.html");
  const quote = read("tools/quote-generator.html");
  assert.match(quote, /<section class="shunxin-section" id="quoteShunxinSection"/);
  assert.doesNotMatch(quote, /quoteShunxinSection\.classList\.(?:add|remove)\("hidden"\)/);
  assert.match(order, /const show = warehouse === "浙江仓" && isLiujin;/);
  assert.doesNotMatch(order, /isLiujin && logistics === "顺心捷达"/);
});

test("顺心捷达三个入口的费用控件使用统一对齐栅格", () => {
  ["tools/freight-gold.html", "tools/order-template.html", "tools/quote-generator.html"].forEach((file) => {
    const html = read(file);
    assert.match(html, /\.shunxin-options\s*\{[\s\S]{0,260}display:\s*grid;/);
    assert.match(html, /class="shunxin-option-cell"/);
    assert.match(html, />上门服务</);
    assert.match(html, />保价费用</);
    assert.match(html, />上门费用</);
  });
});

test("开单模板付款方式包含T农行并可写入付款结果", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /name="paymentMethod" value="T农行"><span>T农行<\/span>/);
  assert.match(html, /const method = selectedPaymentMethod\(\);[\s\S]{0,180}els\.payment\.value = method && channel \? `\$\{method\}-\$\{channel\}` : \(method \|\| channel\);/);
  assert.match(html, /付款方式：\$\{els\.payment\.value\.trim\(\) \|\| "未填写"\}/);
});

test("浙江仓货拉拉隐藏重量包装但在正文写入DB", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /function hidesZhejiangOrderShippingSummary\(warehouse, logistics\) \{\s*return warehouse === "浙江仓" && \(logistics === "货拉拉" \|\| logistics === "自提"\);\s*\}/);
  assert.match(html, /const hideOrderShippingSummary = hidesZhejiangOrderShippingSummary\(warehouse, logistics\);/);
  assert.match(html, /const previewDbLine = warehouse === "浙江仓" && built\.db > 0 \? `DB\$\{money\(built\.db\)\}` : "";/);
  assert.match(html, /const orderWeightPart = hideOrderShippingSummary\s*\? ""/);
  assert.match(html, /if \(orderWeightPart\) lines\.push\(orderWeightPart\);/);
  assert.match(html, /els\.weightPreview\.textContent = weightPart \|\| "-";/);
  assert.match(html, /els\.freightQuestion\.textContent = isNingboWarehouseActive\(\) \? ningboFreightQuestion : zhejiangFreightQuestion;/);
  assert.equal(Number((4555 - 3572.16 - 26).toFixed(2)), 956.84);
});

test("文字报价不把空产品识别成鎏金板", () => {
  const html = read("tools/quote-generator.html");
  assert.match(html, /if \(!productText\.trim\(\)\) return false;/);
});

test("文字报价只在复制完整报价后写入历史记录", () => {
  const html = read("tools/quote-generator.html");
  const renderFunction = html.match(/function render\(\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.doesNotMatch(renderFunction, /saveHistorySnapshot|autoSaveHistory/);
  assert.match(html, /function saveHistorySnapshot\(\)/);
  assert.match(html, /els\.copyBtn\.addEventListener\("click", async \(\) => \{[\s\S]{0,500}saveHistorySnapshot\(\)/);
});

test("空白开单不显示包装超量警告", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /built\.qty > 0 && \(isLiujin \|\| isSandstone\) && !built\.packageOk/);
});

test("宁波仓显示宁波专用规则提示", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /isNingboWarehouseActive\(\)[\s\S]{0,300}宁波仓/);
});

test("宁波多产品合装取最长和最宽并累计厚度", () => {
  const core = loadNingboCore();
  const result = core.calculateShipment([
    { name: "星月石", spec: "1160*3100", qty: 1, thickness: 8, kgPerSqm: 10 },
    { name: "斧开石", spec: "1200*3000", qty: 1, thickness: 12, kgPerSqm: 12 }
  ]);
  assert.equal(result.crateLength, 3200);
  assert.equal(result.crateWidth, 1300);
  assert.equal(result.crateHeight, 220);
  assert.equal(result.packageWeight, 65);
  assert.equal(result.crateLines.length, 1);
  assert.equal(result.crateLines[0], "木箱：1300*3200*220mm");
});

test("宁波多产品合装只计一个包装重量", () => {
  const core = loadNingboCore();
  const result = core.calculateShipment([
    { name: "星月石", spec: "3100*1160", qty: 1, thickness: 8, kgPerSqm: 10 },
    { name: "斧开石", spec: "3000*1200", qty: 1, thickness: 12, kgPerSqm: 12 }
  ]);
  assert.match(result.expression, /\+65=/);
  assert.doesNotMatch(result.expression, /\+65\+65=/);
});

test("宁波 1200*600 规格带厚度时仍按小板包装", () => {
  const core = loadNingboCore();
  const plain = core.calculateShipment([
    { name: "3D洞石", spec: "1200*600", qty: 5, thickness: 6, kgPerSqm: 10 }
  ]);
  const withThickness = core.calculateShipment([
    { name: "3D洞石", spec: "1200*600*6mm", qty: 5, thickness: 6, kgPerSqm: 10 }
  ]);
  assert.equal(withThickness.packageWeight, plain.packageWeight);
  assert.equal(withThickness.packageType, plain.packageType);
  assert.equal(withThickness.crateLength, plain.crateLength);
  assert.equal(withThickness.crateWidth, plain.crateWidth);
});

test("宁波重量和开单模板共同读取宁波运费核心", () => {
  for (const file of ["tools/ningbo-weight.html", "tools/order-template.html"]) {
    const html = read(file);
    assert.match(html, /<script src="ningbo-freight-core\.js\?v=20260905-1"><\/script>/, file);
    assert.match(html, /NingboFreightCore\.calculateShipment/, file);
  }
});

test("宁波重量提供多产品明细操作", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /id="addShipmentItem"/);
  assert.match(html, /id="shipmentItems"/);
});

test("宁波重量同步开单模板的星云石产品", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /<script src="product-data\.js\?v=20260905-1"><\/script>/);
  assert.match(html, /"星云石": "星月石"/);
  assert.match(html, /"星云石B款": "星月石"/);
  assert.match(html, /JieGeProductData\?\.groupedNingboCatalog/);
});

test("宁波仓20圆柱和30内圆使用最新名称与底价", () => {
  const productData = loadProductData();
  const grouped = productData.groupedNingboCatalog();
  const cylinder20 = grouped.find((item) => item.name === "20圆柱");
  const inner30 = grouped.find((item) => item.name === "30内圆");
  assert.equal(cylinder20?.price, 95);
  assert.deepEqual(Array.from(cylinder20?.specs || []), ["3000*1200"]);
  assert.equal(inner30?.price, 90);
  assert.deepEqual(Array.from(inner30?.specs || []), ["3000*1200"]);
  assert.equal(grouped.some((item) => item.name === "20内圆"), false);
  for (const file of ["tools/order-template.html", "tools/quick-price.html", "tools/quote-generator.html", "tools/ningbo-weight.html"]) {
    assert.doesNotMatch(read(file), /20内圆/, file);
  }
});

test("文字报价只自动识别宁波规格且优惠价始终手填", () => {
  const html = read("tools/quote-generator.html");
  assert.match(html, /id="unitPrice"[^>]+placeholder="请手动填写优惠价"/);
  assert.doesNotMatch(html, /id="unitPrice"[^>]+value="95"/);
  assert.match(html, /class="multi-unit-price"[^>]+placeholder="请手动填写优惠价"/);
  assert.doesNotMatch(html, /class="multi-unit-price"[^>]+value="95"/);
  assert.match(html, /els\.product\.addEventListener\("input", \(\) => \{\s*els\.unitPrice\.value = "";/);
  assert.match(html, /card\.querySelector\("\.multi-unit-price"\)\.value = "";/);
  assert.doesNotMatch(html, /selectedProduct\.price/);
  assert.doesNotMatch(html, /ningboVariantForSpec/);
});

test("浙江仓修补剂支持四种规格多选数量并扣入KD", () => {
  const html = read("tools/order-template.html");
  [["50", "15"], ["100", "30"], ["200", "50"], ["500", "125"]].forEach(([weight, price]) => {
    assert.match(html, new RegExp(`data-weight="${weight}" data-price="${price}"`));
    assert.match(html, new RegExp(`aria-label="修补剂${weight}g数量"[^>]+value="1"`));
  });
  assert.match(html, /<section id="repairAgentSection" class="wide repair-agent-section">/);
  assert.match(html, /id="repairAgentToggleButton"[^>]+aria-expanded="false"[^>]+aria-controls="repairAgentBody"/);
  assert.match(html, /id="repairAgentBody" class="repair-agent-body" hidden/);
  assert.match(html, /id="repairAgentToggleLabel">点击展开/);
  assert.match(html, /可多选；勾选后默认数量1/);
  assert.match(html, /id="repairAgentSummary" class="repair-agent-summary">合计：0元/);
  assert.doesNotMatch(html, /repair-agent-subtotal|小计：/);
  assert.match(html, /\.repair-agent-card \{\s*display: flex;/);
  assert.match(html, /function repairAgentFees\(warehouse = currentWarehouse\(\)\)/);
  assert.match(html, /修补剂\$\{item\.weight\}g\*\$\{item\.qtyValue\}：\$\{money\(item\.amount\)\}/);
  assert.match(html, /const extraAmount = \(built\.extraAmount \|\| 0\) \+ repairAgent\.amount \+ zhejiangAccessories\.amount;/);
  assert.match(html, /const extraLines = \[\.\.\.\(built\.extraLines \|\| \[\]\), \.\.\.repairAgent\.lines, \.\.\.zhejiangAccessories\.lines\];/);
  assert.match(html, /const kd = total - dbDeduction - built\.materialAmount - extraAmount/);
  assert.match(html, /els\.repairAgentSection\.classList\.toggle\("hidden", !enabled\);/);
  assert.match(html, /function setRepairAgentExpanded\(expanded\)/);
  assert.match(html, /els\.repairAgentToggleLabel\.textContent = isExpanded \? "点击收起" : "点击展开";/);
  assert.match(html, /setRepairAgentExpanded\(false\);/);
});

test("浙江仓辅料默认不勾选并按填写数量计费", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /id="zhejiangAccessorySection" class="wide form-grid hidden"/);
  assert.match(html, /id="zhejiangGlue" type="checkbox">胶水 15元\/支/);
  assert.match(html, /id="zhejiangProtect1kg" type="checkbox">保护剂1KG 40元\/瓶/);
  assert.match(html, /id="zhejiangProtect5kg" type="checkbox">保护剂5KG 145元\/桶/);
  assert.doesNotMatch(html, /id="zhejiang(?:Glue|Protect1kg|Protect5kg)"[^>]+checked/);
  assert.match(html, /id="zhejiangGlueQty"[^>]+placeholder="填写数量"/);
  assert.match(html, /id="zhejiangProtect1kgQty"[^>]+placeholder="填写数量"/);
  assert.match(html, /id="zhejiangProtect5kgQty"[^>]+placeholder="填写数量"/);
  assert.match(html, /if \(warehouse !== "浙江仓"\) return \{ lines: \[\], amount: 0 \};/);
  assert.match(html, /name: "胶水",\s*unit: "支",\s*price: 15/);
  assert.match(html, /name: "保护剂1KG",\s*unit: "瓶",\s*price: 40/);
  assert.match(html, /name: "保护剂5KG",\s*unit: "桶",\s*price: 145/);
  assert.match(html, /\.filter\(\(item\) => item\.checked && item\.qty > 0\)/);
  assert.match(html, /const zhejiangAccessories = zhejiangAccessoryFees\(warehouse\);/);
  assert.match(html, /resetZhejiangAccessories\(\);/);
});

test("宁波新增产品复用已确认重量并同步最新规格", () => {
  const html = read("tools/ningbo-weight.html");
  assert.match(html, /"波浪": "波浪石"/);
  assert.match(html, /"50马赛克小板1": "50马赛克"/);
  assert.match(html, /"22马赛克小板2": "22马赛克"/);
  assert.match(html, /"3D洞石": \{ default: "洞石", sizeSources: \{ "1200\*600": "小洞石" \} \}/);
  assert.match(html, /"3D新版洞石": "新款洞石"/);
  assert.match(html, /"粗夯土3D": "夯土B（粗夯土）"/);

  const productData = loadProductData();
  const grouped = productData.groupedNingboCatalog();
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "50马赛克小板1").specs), ["1190*590"]);
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "22马赛克小板2").specs), ["1190*590"]);
  assert.deepEqual(Array.from(grouped.find((item) => item.name === "粗夯土3D").specs), ["3000*1200", "2900*1160", "2800*1030", "2680*930"]);
});

test("开单模板使用新版洞石、波浪石和粗夯土的独立重量", () => {
  const html = read("tools/product-data.js");
  assert.match(html, /keys: \["3d新版洞石", "新版洞石"\], kgPerSqm: 7, thickness: 4\.5/);
  assert.match(html, /keys: \["波浪石", "波浪"\], kgPerSqm: 7, thickness: 6/);
  assert.match(html, /keys: \["粗夯土3d"\], kgPerSqm: 6\.5, thickness: 4/);
});

test("宁波同名多价产品按规格查价且未知规格不回退", () => {
  const productData = loadProductData();
  assert.equal(productData.findNingboVariant("洞石", "2800*1200mm").price, 70);
  assert.equal(productData.findNingboVariant("洞石", "600×1200mm").price, 50);
  assert.equal(productData.findNingboVariant("洞石", "999*999mm"), null);
  const grouped = productData.groupedNingboCatalog().find((item) => item.name === "洞石");
  assert.equal(grouped.price, null);
  assert.equal(grouped.priceBySpec["2800*1200"], 70);
  assert.equal(grouped.priceBySpec["1200*600"], 50);
});

test("宁波20圆柱和30内圆规格价格重量统一", () => {
  const productData = loadProductData();
  assert.equal(productData.findNingboVariant("20圆柱", "3000*1200").price, 95);
  assert.equal(productData.findNingboVariant("30内圆", "3000*1200").price, 90);
  assert.deepEqual(JSON.parse(JSON.stringify(productData.findNingboWeightProfile("20圆柱", "3000*1200"))), { kgPerSqm: 8, thickness: 7, family: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(productData.findNingboWeightProfile("30内圆", "3000*1200"))), { kgPerSqm: 8, thickness: 7, family: "" });
  assert.equal(productData.ningboProductCatalog.some((item) => item.name === "20内圆"), false);
});

test("宁波最新尺寸表同步22项且洞石系列保持原值", () => {
  const productData = loadProductData();
  const grouped = productData.groupedNingboCatalog();
  const specsByName = Object.fromEntries(grouped.map((item) => [item.name, Array.from(item.specs)]));
  const expected = {
    "粗纹线石": ["2380*1180", "2360*580"],
    "波浪": ["3000*1200"],
    "中线石": ["1200*3000"],
    "脊线石": ["3000*1200"],
    "环型石": ["3000*1200"],
    "三角板（山纹）": ["1200*3000"],
    "圆铝": ["2360*1160"],
    "马赛克": ["1190*2990"],
    "方形马赛克": ["2950*1180"],
    "条石拼接": ["2800*1200"],
    "斧开石": ["3000*1200", "2300*560"],
    "溶积岩": ["2950*1160"],
    "平板": ["1160*2950", "1200*2400"],
    "平面锈石": ["1160*2950", "1200*2400"],
    "条石纹": ["2900*1000"],
    "苹果叶": ["2950*1160"],
    "芭蕉叶": ["2900*1150"],
    "齿木纹": ["2950*1180"],
    "岩板": ["1160*2950"],
    "岩板3D": ["1160*2950"],
    "大理石3D": ["1160*2950", "1200*2400"],
    "山丘": ["2680*1180"]
  };
  Object.entries(expected).forEach(([name, specs]) => assert.deepEqual(specsByName[name], specs, name));

  const caveStone = productData.ningboProductCatalog
    .filter((item) => item.name.includes("洞石"))
    .map((item) => ({ name: item.name, price: item.price, specs: Array.from(item.specs) }));
  assert.deepEqual(JSON.parse(JSON.stringify(caveStone)), [
    { name: "洞石", price: 70, specs: ["2800*1200", "2400*1200"] },
    { name: "洞石", price: 50, specs: ["1200*600"] },
    { name: "新洞石（密孔）", price: 70, specs: ["2380*1160"] },
    { name: "海洞石", price: 75, specs: ["2400*1200"] },
    { name: "新版洞石", price: 70, specs: ["3000*1200", "2400*1200"] },
    { name: "洞石拼接", price: 100, specs: ["3000*1200"] },
    { name: "3D洞石", price: 75, specs: ["1200*2400", "1200*2800"] },
    { name: "3D洞石", price: 55, specs: ["1200*600"] },
    { name: "3D新版洞石", price: 75, specs: ["1200*2400", "1200*2800", "1200*3000"] },
    { name: "3D新版洞石", price: 55, specs: ["1200*600"] }
  ]);
  assert.equal(fs.existsSync(path.join(root, "docs/柔岩板价格表_最终尺寸替换版.xlsx")), true);
});

test("混凝土价格使用公共表且手工单价不会被自动覆盖", () => {
  const productData = loadProductData();
  const order = read("tools/order-template.html");
  const quick = read("tools/quick-price.html");
  assert.equal(productData.concretePriceTable["松诺"].flat.small.thin, 170);
  assert.equal(productData.concretePriceTable["168"].texture.long.thick, 280);
  assert.match(order, /const concretePriceTable = productData\.concretePriceTable/);
  assert.match(quick, /const concretePriceTable = productData\.concretePriceTable/);
  assert.match(order, /row\.sqmPrice\.dataset\.manualOverride/);
  assert.match(order, /当前使用手工单价，清空后恢复自动价/);
});

test("开单动态产品数量变化保留已填内容", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /function captureControlState\(container\)/);
  assert.match(html, /function restoreControlState\(container, state\)/);
  ["additionalProducts", "otherAdditionalProducts", "concreteAdditionalProducts", "cementAdditionalProducts"].forEach((name) => {
    assert.match(html, new RegExp(`captureControlState\\(els\\.${name}\\)`));
    assert.match(html, new RegExp(`restoreControlState\\(els\\.${name}, previousState\\)`));
  });
});

test("开单隐藏修补剂不收费且TM支付宝扣点实时写入明细和KD", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /return warehouse === "浙江仓" && category === "liujin"/);
  assert.match(html, /const enabled = repairAgentEnabled\(warehouse\)/);
  assert.match(html, /String\(els\.payment\.value \|\| ""\)/);
  assert.match(html, /\^支付宝-TM绿活材料美学馆旗舰店/);
  assert.doesNotMatch(html, /return selectedPaymentMethod\(\) === "支付宝"/);
  assert.match(html, /const paymentDeduction = deductionRate > 0 \? Math\.round\(total \* deductionRate\) : 0/);
  assert.match(html, /const kd = total - dbDeduction - built\.materialAmount - extraAmount - processingFee - crateFee - freightAmount - taxAmount - paymentDeduction/);
  assert.match(html, /扣点：\$\{money\(paymentDeduction\)\}元/);
  assert.match(html, /function syncPaymentFromChoices\(\)[\s\S]{0,260}manualResultMode = false;[\s\S]{0,80}calculate\(\)/);
  assert.match(html, /els\.payment\.addEventListener\("input", \(\) => \{\s*manualResultMode = false;/);
});

test("砂岩附加工艺与鎏金板一致计费", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /category === "liujin" \|\| category === "sandstone" \? coatingLines\(totalArea\)/);
});

test("宁波未知规格和缺失重量明确转人工确认", () => {
  const html = read("tools/order-template.html");
  const weight = read("tools/ningbo-weight.html");
  assert.match(html, /该规格不在价格表，请人工填写平方单价，并人工确认重量和运费/);
  assert.match(html, /缺少权威重量资料，请人工确认/);
  assert.match(html, /return productData\.findNingboWeightProfile\(productName, specText\)/);
  assert.doesNotMatch(html, /const defaultProfile = \{ kgPerSqm:/);
  assert.doesNotMatch(html, /return product;\s*\n\s*}\s*\n\s*function ningboEffectiveSqmPrice/);
  assert.match(weight, /缺少权威重量资料，请人工填写 kg\/㎡ 和厚度后再计算/);
  assert.match(weight, /if \(!Number\.isSafeInteger\(qty\) \|\| qty <= 0 \|\| thickness <= 0 \|\| kgPerSqm <= 0\) return null/);
});

test("上墙留缝不再把所有板均分成错误宽度并支持移动端", () => {
  const html = read("tools/wall-panel.html");
  assert.doesNotMatch(html, /const evenSize = panelSpace \/ estimatedCount/);
  assert.match(html, /const fullCount = Math\.min\(Math\.floor/);
  assert.match(html, /window\.WallPanelMath = \{ distribute \}/);
  assert.match(html, /min-width:\s*0 !important;[\s\S]{0,150}table-layout:\s*fixed !important/);
});

test("主页和报备模板移动端不再出现已知横向溢出", () => {
  const index = read("index.html");
  const report = read("tools/report-template.html");
  assert.match(index, /\.frame-shell \{[\s\S]{0,120}height:\s*100%;/);
  assert.match(report, /@media \(max-width: 760px\)[\s\S]{0,900}\.area-time-grid \.segmented \{\s*grid-template-columns:\s*1fr;/);
  assert.match(report, /\.area-time-grid \.segmented label \{[\s\S]{0,180}white-space:\s*normal;/);
});

test("报备模板顶部蓝色小重置与结果区原重置同时保留", () => {
  const html = read("tools/report-template.html");
  const formStart = html.indexOf('<form class="panel form-panel"');
  const topResetIndex = html.indexOf('id="resetTop"');
  const previewStart = html.indexOf('<section class="panel preview-panel">');
  const previewEnd = html.indexOf("</section>", previewStart);
  assert.ok(topResetIndex > formStart && topResetIndex < previewStart, "顶部一键重置应位于基础信息区");
  assert.doesNotMatch(html, /月份默认取当前月，可手动改/);
  assert.equal((html.match(/id="resetTop"/g) || []).length, 1, "顶部只能保留一个小重置按钮");
  assert.equal((html.match(/id="resetSide"/g) || []).length, 1, "页面只能保留一个一键重置按钮");
  assert.match(html.slice(previewStart, previewEnd), /id="resetSide"/);
  assert.match(html.slice(previewStart, previewEnd), /id="copyBtn"/);
  assert.match(html, /\.section-reset-btn,[\s\S]{0,420}background:\s*#1f6feb\s*!important/);
  assert.match(html, /\.section-reset-btn,[\s\S]{0,460}color:\s*#ffffff\s*!important/);
  assert.match(html, /\.section-title:has\(\.section-reset-btn\)[\s\S]{0,180}grid-template-columns:\s*1fr/);
  assert.match(html, /\$\("#resetTop"\)\.addEventListener\("click", resetForm\)/);
  assert.match(html, /\$\("#resetSide"\)\.addEventListener\("click", resetForm\)/);
});

test("开单模板重置下一个会把加工费归零", () => {
  const html = read("tools/order-template.html");
  const resetStart = html.indexOf("function resetForNextOrder() {");
  const resetEnd = html.indexOf("\n    renderSpecOptions();", resetStart);
  assert.ok(resetStart >= 0 && resetEnd > resetStart, "应能定位重置下一个函数");
  const resetBody = html.slice(resetStart, resetEnd);
  assert.match(resetBody, /els\.processingFee\.value = 0;/);
  assert.ok(
    resetBody.indexOf("els.processingFee.value = 0;") < resetBody.lastIndexOf("calculate();"),
    "加工费必须先归零再重新计算合计"
  );
});

test("快速查价同名产品同时保留宁波和 MLL 结果", () => {
  const html = read("tools/quick-price.html");
  assert.match(html, /sameNameNingboAndMeililai/);
});

test("大漠沙丘名称中的珠光白按大漠系列计价", () => {
  const productData = loadProductData();
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘DM220珠光白", "hard-3050"), 70);
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘DM220珠光白", "soft-3000"), 80);
  assert.equal(productData.findLiujinSeriesPrice("珠光白", "hard-3050"), 155);
});

test("快速查价为全部鎏金系列显示最低售价且不修改共享底价", () => {
  const html = read("tools/quick-price.html");
  const productData = loadProductData();
  assert.match(html, /const liujinMinimumPriceGroups = \[/);
  assert.match(html, /'hard-2440':85, 'hard-3050':85, 'soft-2440':95, 'soft-3000':95/);
  assert.match(html, /'hard-2440':115, 'hard-3050':115, 'soft-2440':125, 'soft-3000':125/);
  assert.match(html, /'hard-2440':125, 'hard-3050':125, 'soft-2440':140, 'soft-3000':140/);
  assert.match(html, /'hard-2440':220, 'hard-3050':220, 'soft-2440':235, 'soft-3000':235/);
  assert.match(html, /\{ 'hard-2440':140 \}/);
  assert.match(html, /<small>最低售价<\/small>/);
  assert.equal(productData.findLiujinSeriesPrice("大漠沙丘", "hard-3050"), 70);
  assert.equal(productData.findLiujinSeriesPrice("珠光", "soft-3000"), 165);
});

test("混凝土168附加费使用最新计价规则", () => {
  const html = read("tools/order-template.html");
  const productData = loadProductData();
  assert.match(html, /return currentWarehouse\(\) === "168" \? 5 : 10/);
  assert.match(html, /倒边米数/);
  assert.match(html, /倒边单价 元\/米/);
  assert.match(html, /const edgeMeters = numberValue\(els\.concreteEdgeMeters\)/);
  assert.match(html, /unit: "米", unitPrice, amount: edgeMeters \* unitPrice/);
  assert.match(html, /干挂孔 1元\/个/);
  assert.match(html, /干挂件 8元\/个/);
  assert.match(html, /30种规格以上 \+10元\/㎡/);
  assert.match(html, /productData\.concrete168PackagingFee\(products, area\)/);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1500*1000mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "平板", productType: "flat", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "虫洞", productType: "cave", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168清水板", specText: "1200*600mm" }], 5), 0);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168透光板", specText: "1200*600mm" }], 4.9), 100);
  assert.equal(productData.concrete168PackagingFee([{ productName: "168透光板", specText: "1200*2400mm" }], 4.9), 150);
  assert.equal(productData.concrete168PackagingFee([
    { productName: "168清水板", specText: "1200*600mm" },
    { productName: "168清水板", specText: "1200*2400mm" }
  ], 4.9), 150);
  assert.doesNotMatch(html, /倒边平方数/);
});

test("快速查价同步松诺与168附加费用说明", () => {
  const html = read("tools/quick-price.html");
  const productData = loadProductData();
  assert.match(html, /打孔\+7元\/㎡；倒边\+10元\/米；超过20种规格另加10元\/㎡/);
  assert.match(html, /打孔\+5元\/㎡；倒边\+5元\/米；干挂孔1元\/个；干挂件8元\/个/);
  assert.match(html, /productData\.concrete168PackagingNote/);
  assert.match(productData.concrete168PackagingNote, /小板（1200\*600mm）包装费100元/);
  assert.match(productData.concrete168PackagingNote, /大板（1200\*2400mm或单件面积1\.5㎡以上）包装费150元/);
  assert.doesNotMatch(html, /倒边\+10元\/㎡|倒边\+5元\/㎡/);
});

test("四个宁波业务页面共同读取最新产品数据", () => {
  for (const file of ["tools/order-template.html", "tools/quick-price.html", "tools/quote-generator.html", "tools/ningbo-weight.html"]) {
    assert.match(read(file), /<script src="product-data\.js\?v=20260905-1"><\/script>/, file);
  }
});

test("美利来开单和快速查价共用完整价格表", () => {
  const productData = loadProductData();
  assert.equal(productData.meililaiProductCatalog.length, 148);

  const beech = productData.meililaiProductCatalog.find((item) => item.name === "榉木板" && item.spec === "1200*3000");
  const qianmo = productData.meililaiProductCatalog.find((item) => item.name === "阡陌石" && item.spec === "1200*3000");
  const special = productData.meililaiProductCatalog.find((item) => item.name.includes("辰美小星月") && item.spec === "1200*2400");
  assert.equal(beech?.price, 67);
  assert.equal(qianmo?.price, 67);
  assert.equal(special?.price, 40);
  assert.equal(special?.importantNote, true);
  assert.match(special?.note || "", /特价款只有纯白和米白/);

  const order = read("tools/order-template.html");
  const quick = read("tools/quick-price.html");
  assert.match(order, /value="宁波仓"[\s\S]{0,300}value="美利来"/);
  assert.match(order, /"美利来": \["默认", "自提"\]/);
  assert.match(order, /const meililaiProductCatalog = productData\.meililaiProductCatalog/);
  assert.match(quick, /const meililaiRows = productData\.meililaiProductCatalog/);
  assert.match(quick, /productData\.groupedMeililaiCatalog\(\)/);
});

test("美利来包装费按合计片数和规格自动计算", () => {
  const productData = loadProductData();
  assert.deepEqual(JSON.parse(JSON.stringify(productData.meililaiPackagingFee([
    { specText: "600*1200", qty: 1 }
  ]))), { amount: 10, name: "纸箱费", totalQty: 1, confirmed: true, rule: "600*1200类纸箱10元" });
  assert.equal(productData.meililaiPackagingFee([{ specText: "600*2400", qty: 2 }]).amount, 100);
  assert.equal(productData.meililaiPackagingFee([{ specText: "1200*3000", qty: 4 }]).amount, 200);
  assert.equal(productData.meililaiPackagingFee([{ specText: "1200*3000", qty: 5 }]).amount, 0);
  assert.equal(productData.meililaiPackagingFee([
    { specText: "600*1200", qty: 1 },
    { specText: "1200*2400", qty: 1 }
  ]).amount, 200);
  assert.equal(productData.meililaiPackagingFee([{ specText: "待确认", qty: 1 }]).confirmed, false);
  for (const specText of ["0*1200", "-600*1200", "600*-1200"]) {
    assert.equal(productData.meililaiPackagingFee([{ specText, qty: 1 }]).confirmed, false);
  }
});

test("美利来只提供打印附加价、五个产品和多条自定义费用", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /isMeililai \? productData\.meililaiPackagingFee\(products\)/);
  assert.match(html, /class="checkline catalog-print-addon"[\s\S]{0,150}打印 \+10元\/平/);
  assert.match(html, /row\.ningboOnlyAddons\?\.forEach\(\(item\) => item\.classList\.toggle\("hidden", isMeililai\)\)/);
  assert.match(html, /id="meililaiCustomFeeEnabled"/);
  assert.match(html, /id="addMeililaiFeeBtn"/);
  assert.match(html, /function meililaiCustomFees\(\)/);
  assert.match(html, /lines: fees\.map\(\(item\) => `\$\{item\.name\}\$\{money\(item\.amount\)\}`\)/);
  for (const count of [1, 2, 3, 4, 5]) {
    assert.match(html, new RegExp(`name="otherProductCount" value="${count}"`));
  }
});

test("美利来费用排版、切仓清空、提示和品类保持正确", () => {
  const html = read("tools/order-template.html");
  assert.doesNotMatch(html, /id="meililaiPackagingHint"/);
  assert.match(html, /<div>\s*<label class="field-label" for="otherUnitPrice">其它品类单片价格<\/label>/);
  assert.doesNotMatch(html, /<div class="unit-price-field">\s*<label class="field-label" for="otherUnitPrice">/);
  assert.match(html, /\? "例如 榉木板 \/ 阡陌石 \/ 辰美小星月"/);
  assert.match(html, /function clearOtherProductsForWarehouseChange\(\)/);
  assert.match(html, /catalogWarehouses = \["宁波仓", "美利来"\]/);
  assert.match(html, /clearOtherProductsForWarehouseChange\(\)/);
  assert.match(html, /currentWarehouseGroup\(\) === "宁波仓" \|\| isMeililaiWarehouseActive\(\)\) \? "柔岩板"/);
});

test("美利来包装费默认自动且可勾选改为手工金额", () => {
  const html = read("tools/order-template.html");
  assert.match(html, /id="meililaiManualPackaging" type="checkbox">手动填写/);
  assert.match(html, /els\.crateFee\.readOnly = !manual/);
  assert.match(html, /if \(!manual\) els\.crateFee\.value = result\.amount > 0/);
  assert.match(html, /manualMeililaiPackaging \? numberValue\(els\.crateFee\) : Number\(built\.packaging\?\.amount \|\| 0\)/);
  assert.match(html, /manualMeililaiPackaging \? "包装费"/);
  assert.match(html, /els\.meililaiManualPackaging\.checked = false/);
  assert.match(html, /取消勾选可恢复自动包装规则/);
});

test("美利来手填包装费开关紧跟标题且移动端不挤压税金栏", () => {
  const order = read("tools/order-template.html");
  const report = read("tools/report-template.html");
  assert.match(order, /\.field-label-row\s*\{[\s\S]{0,220}justify-content:\s*flex-start/);
  assert.match(order, /id="crateFeeLabel">木箱费<\/label>\s*<label class="inline-field-check hidden" id="meililaiManualPackagingWrap"/);
  assert.match(order, /els\.crateFeeLabel\.textContent = manual[\s\S]{0,100}"自动包装费"/);
  assert.match(report, /body\s*\{[\s\S]{0,120}overflow-x:\s*hidden/);
  assert.match(report, /\.segmented input\s*\{[\s\S]{0,140}width:\s*1px;[\s\S]{0,80}height:\s*1px/);
});

test("公共业务逻辑带版本标记避免浏览器继续使用旧缓存", () => {
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="freight-gold-core\.js\?v=20260919-1"><\/script>/, file);
  }
  for (const file of ["tools/order-template.html", "tools/freight-gold.html", "tools/quote-generator.html"]) {
    assert.match(read(file), /<script src="shunxin-rates\.js\?v=20260815-1"><\/script>/, file);
  }
});

test("三处鎏金板业务共同使用顺心捷达且跨越只作为开单物流", () => {
  for (const file of ["tools/freight-gold.html", "tools/order-template.html", "tools/quote-generator.html"]) {
    const html = read(file);
    assert.match(html, /buildShunxinQuote/, file);
    assert.doesNotMatch(html, /KYE|kye-rates|buildKyeQuote/, file);
  }
  assert.doesNotMatch(read("tools/freight-gold.html"), /跨越/);
  assert.doesNotMatch(read("tools/quote-generator.html"), /跨越/);
  assert.match(read("tools/order-template.html"), /"跨越"/);
});

test("整板切割与上墙排版使用统一标题和控件高度", () => {
  const fullBoard = read("tools/full-board-cut.html");
  const wallPanel = read("tools/wall-panel.html");
  assert.match(fullBoard, /\.header h1[\s\S]{0,300}font-size:/);
  assert.match(wallPanel, /\.app > aside > h1[\s\S]{0,300}font-size:/);
  assert.match(fullBoard, /--tool-control-height:\s*44px/);
  assert.match(wallPanel, /--tool-control-height:\s*44px/);
});

test("上墙排版板材参数左侧为板宽右侧为板高", () => {
  const html = read("tools/wall-panel.html");
  assert.match(html, /<label for="boardW">板宽 mm<\/label>\s*<input id="boardW"/);
  assert.match(html, /<label for="boardH">板高 mm<\/label>\s*<input id="boardH"/);
  assert.doesNotMatch(html, /<label[^>]*>板长 mm<\/label>/);
  assert.match(html, /const baseW = Number\(size.boardW\);\s*const baseH = Number\(size.boardH\);/);
});

test("上墙排版支持板间留缝且墙体四周不扣缝", () => {
  const html = read("tools/wall-panel.html");
  ["0", "1", "2", "3", "4", "5", "10", "custom"].forEach((value) => {
    assert.match(html, new RegExp(`<option value="${value}">`));
  });
  assert.match(html, /id="jointGapCustom"[^>]+min="0"[^>]+step="0\.1"/);
  assert.match(html, /只计算板材与板材之间的伸缩缝，墙体四周一圈不预留缝隙/);
  assert.match(html, /const panelSpace = safeTotal - safeGap \* \(count - 1\);/);
  assert.match(html, /if \(col < cols\.length - 1\) x \+= jointGap;/);
  assert.match(html, /if \(row < rows\.length - 1\) y \+= jointGap;/);
  assert.match(html, /留缝 \$\{fmt\(data\.jointGap\)\}（仅板间）/);
});

test("所有仓库共用的合计框未填写时不显示示例数字", () => {
  const html = read("tools/order-template.html");
  const inputs = html.match(/<input\b[^>]*\bid="totalAmount"[^>]*>/g) || [];
  assert.equal(inputs.length, 1);
  assert.doesNotMatch(inputs[0], /\b(?:placeholder|value)="[^"]+"/);
  assert.match(functionSource("tools/order-template.html", "resetForNextOrder"), /els\.totalAmount\.value = ""/);
});

test("主页版本号和所有工具入口完整", () => {
  const index = read("index.html");
  assert.match(index, /v2026\.09\.24\.1/);
  const routeMatch = index.match(/const toolPaths = (\{[^;]+\});/);
  assert.ok(routeMatch, "未找到工具入口表");
  const routes = JSON.parse(routeMatch[1]);
  Object.values(routes).forEach((relativePath) => {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `缺少工具文件：${relativePath}`);
  });
});

test("宁波B款产品和规格级重量使用原始资料而非泛关键词", () => {
  const data = loadProductData();
  assert.equal(data.findNingboVariant("粗纹线石B款", "2800*1200").price, 80);
  const cases = [
    ["粗纹线石B款", "2800*1200", 7.5, 7],
    ["新线石", "2950*1200", 6.5, 4],
    ["双线石", "2650*1180", 10, 8],
    ["阡陌石（方线石）", "2800*1000", 10, 8],
    ["水波纹板", "3000*1150", 8.5, 9],
    ["大竹纹（凹模）", "2800*980", 11, 10],
    ["页岩", "3100*1160", 13, 15],
    ["斧开石", "3000*1200", 11, 13],
    ["斧开石", "2300*560", 12, 12]
  ];
  for (const [name, spec, kg, thickness] of cases) {
    const profile = data.findNingboWeightProfile(name, spec);
    assert.equal(profile.kgPerSqm, kg, name);
    assert.equal(profile.thickness, thickness, name);
  }
  assert.equal(data.findNingboWeightProfile("任意线石", "3000*1200"), null);
  assert.equal(data.findNingboWeightProfile("新线石", "999*999"), null);
  assert.equal(data.findNingboWeightProfile("花岗岩拼接", "2700*1200"), null);
});

test("宁波重量目录旧别名不再暴露过期尺寸", () => {
  const context = { window: { JieGeProductData: loadProductData() } };
  vm.createContext(context);
  const html = read("tools/ningbo-weight.html");
  vm.runInContext(html.slice(html.indexOf("    const products = ["), html.indexOf("    const els = {")) + ";this.rows = products;", context);
  assert.equal(context.rows.some((item) => item.name === "圆线石 脉络石"), false);
  assert.equal(context.rows.some((item) => item.name === "粗线石"), false);
  assert.equal(context.rows.some((item) => item.name === "B款粗线石"), false);
  const pulse = context.rows.find((item) => item.name === "脉络石");
  assert.deepEqual(Array.from(pulse.sizes), ["2800*990", "2800*1200", "2800*600"]);
  assert.equal(pulse.sourceName, "圆线石 脉络石");
  const b = context.rows.find((item) => item.name === "粗纹线石B款");
  assert.deepEqual(Array.from(b.sizes), ["2800*1200"]);
});

test("宁波相同产品拆行不改变包装门槛且原明细保留", () => {
  const core = loadNingboCore();
  const item = { name: "洞石", spec: "1200*600", thickness: 3, kgPerSqm: 5 };
  for (const [a, b] of [[5, 5], [120, 121]]) {
    const single = core.calculateShipment([{ ...item, qty: a + b }]);
    const split = core.calculateShipment([{ ...item, qty: a }, { ...item, qty: b }]);
    assert.equal(split.packageWeight, single.packageWeight);
    assert.equal(split.shippingWeight, single.shippingWeight);
    assert.equal(split.crateHeight, single.crateHeight);
    assert.equal(split.items.length, 2);
  }
});

test("宁波含无效规格或重量时禁止输出部分精确总重", () => {
  const core = loadNingboCore();
  const valid = { name: "新线石", spec: "2950*1200", qty: 10, thickness: 4, kgPerSqm: 6.5 };
  for (const patch of [{ spec: "bad" }, { spec: "-1200*600" }, { thickness: "" }, { kgPerSqm: "" }, { kgPerSqm: Infinity }, { qty: 1.9 }]) {
    assert.equal(core.calculateShipment([valid, { ...valid, ...patch }]), null);
  }
  assert.equal(core.calculateShipment([valid]).shippingWeight, 305);
  assert.equal(core.calculateShipment([{ ...valid, spec: "2950x1200" }]).shippingWeight, 305);
  assert.match(read("tools/order-template.html"), /if \(warnings.length \|\| !items.length\) return \{ manual: true, warnings \}/);
});

test("未知目录产品清除旧自动价但保留人工覆盖", () => {
  const context = { isMeililaiWarehouseActive: () => false, isNingboWarehouseActive: () => true, findNingboProduct: () => null, isCatalogWarehouseActive: () => true };
  vm.createContext(context);
  vm.runInContext(functionSource("tools/order-template.html", "syncNingboProductRow"), context);
  for (const manual of [false, true]) {
    const row = { productName: { value: "未知款" }, sqmPrice: { value: manual ? "123" : "95", dataset: { autoPrice: "95", manualOverride: manual ? "1" : "0" } }, matchTools: { dataset: { product: "旧产品" }, classList: { toggle() {} } } };
    context.syncNingboProductRow(row);
    assert.equal(row.sqmPrice.value, manual ? "123" : "");
    assert.equal(row.sqmPrice.dataset.autoPrice, undefined);
    assert.equal(row.matchTools.dataset.product, undefined);
  }
});

test("混凝土未匹配价格不能继续沿用上一款自动价", () => {
  const context = { isConcreteWarehouse: () => true, syncConcreteSpecOptions() {}, concretePriceMatch: () => ({ price: 0, hint: "未匹配，请手填" }) };
  vm.createContext(context);
  vm.runInContext(functionSource("tools/order-template.html", "syncConcretePrice"), context);
  for (const manual of [false, true]) {
    const row = { sqmPrice: { value: manual ? "199" : "170", dataset: { autoPrice: "170", manualOverride: manual ? "1" : "0" } }, priceHint: {} };
    context.syncConcretePrice(row);
    assert.equal(row.sqmPrice.value, manual ? "199" : "");
    assert.equal(row.sqmPrice.dataset.autoPrice, undefined);
  }
});

test("整板切割拒绝零尺寸零数量及被截断的输入", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(functionSource("tools/full-board-cut.html", "parseInput"), context);
  assert.equal(context.parseInput("318*771=20\n318*762=5").length, 2);
  assert.equal(context.parseInput("318*771=20 318*762=5").length, 2);
  for (const text of ["318*771=20abc", "0*100=1", "318*771=0", "318*771=1.9"]) {
    assert.throws(() => context.parseInput(text), undefined, text);
  }
});

test("孔心排版无效尺寸和重叠孔位禁止导出", () => {
  const base = { widthMm: 1200, heightMm: 600, holes: 6, columns: 3, diameter: 20, marginX: 50, marginY: 50 };
  for (const patch of [{ widthMm: 0 }, { columns: 0 }, { diameter: -1 }, { marginX: -1 }, { marginX: 600 }, { holes: 1.5 }]) {
    const button = {};
    const messages = [];
    const context = { svg: { replaceChildren() {}, append(node) { messages.push(node.text); } }, getValue: id => ({ ...base, ...patch })[id], document: { querySelector: () => button }, el: (tag, attrs, text) => ({ text }),
      materialPreviewSvg: { innerHTML: 'previous drawing', parentElement: { hidden: false }, replaceChildren() { this.innerHTML = ''; }, setAttribute() {}, removeAttribute() {} },
      copyMaterialPreview: { disabled: false }, materialPreviewStatus: { textContent: '' },
    };
    vm.createContext(context);
    vm.runInContext(functionSource("tools/hole-1200.html", "clearMaterialPreview"), context);
    vm.runInContext(functionSource("tools/hole-1200.html", "draw"), context);
    context.draw();
    assert.equal(button.disabled, true);
    assert.equal(messages.length, 1);
    assert.equal(context.materialPreviewSvg.innerHTML, '');
    assert.equal(context.materialPreviewSvg.parentElement.hidden, true);
    assert.equal(context.copyMaterialPreview.disabled, true);
    assert.equal(context.materialPreviewStatus.textContent, messages[0]);
  }
});

test("上墙无法铺满的板缝边界必须提示而非输出零块正常结果", () => {
  const context = { dims: () => ({ boardW: 1200, boardH: 600 }), jointGapValue: () => 1, els: { cutX: { value: "right" }, cutY: { value: "bottom" } } };
  vm.createContext(context);
  for (const name of ["distributeWithoutGap", "distribute", "layout", "escapeHtml"]) vm.runInContext(functionSource("tools/wall-panel.html", name), context);
  const layout = context.layout({ wallW: 1201, wallH: 600 });
  assert.equal(layout.incomplete, true);
  assert.ok(layout.error);
  assert.equal(context.escapeHtml('<b>墙面</b>'), '&lt;b&gt;墙面&lt;/b&gt;');
});

test("报备地址不把路名当城市且多省地址转人工确认", () => {
  const context = { provinceNames: ["上海", "广东", "浙江", "贵州"], municipalities: new Set(["上海"]), provinceByCity: { 贵阳: "贵州", 广州: "广东", 杭州: "浙江", 上海: "上海" } };
  vm.createContext(context);
  for (const name of ["hasProvincePrefix", "formatAddress"]) vm.runInContext(functionSource("tools/report-template.html", name), context);
  for (const value of ["上海路88号", "贵阳路10号", "广东省广州市转浙江省杭州市"]) assert.equal(context.formatAddress(value).matched, false);
  assert.equal(context.formatAddress("贵阳市南明区").text, "贵州贵阳市南明区");
});

test("文字报价手工模式有明确恢复入口且规格同步先于计算", () => {
  const nodes = {};
  const context = { document: { querySelector: id => nodes[id] ||= {} } };
  vm.createContext(context);
  vm.runInContext(`let quoteManuallyEdited = false; ${functionSource("tools/quote-generator.html", "setQuoteManualMode")}`, context);
  context.setQuoteManualMode(true);
  assert.equal(nodes["#resumeQuoteAuto"].hidden, false);
  assert.equal(nodes["#quoteEditStatus"].hidden, false);
  context.setQuoteManualMode(false);
  assert.equal(nodes["#resumeQuoteAuto"].hidden, true);
  const single = functionSource("tools/quote-generator.html", "renderSingle");
  assert.ok(single.indexOf("syncProductQuickSpecs()") < single.indexOf("els.spec.value"));
  for (const name of ["renderSingle", "renderMulti"]) {
    assert.match(functionSource("tools/quote-generator.html", name), /if \(!quoteManuallyEdited\) els\.quote\.textContent/);
  }
});

test('宁波完整开单首行复用物流、付款类型及金额，保留默认和自提语义', () => {
    const context = { isNingboWarehouseActive: () => true };
    vm.createContext(context);
    vm.runInContext(functionSource('tools/order-template.html', 'ningboFreightHeader'), context);
    for (const logistics of ['明邦', '安能', '货拉拉']) {
        for (const payment of ['到付', '代付']) {
            assert.equal(context.ningboFreightHeader(`运费：${logistics}${payment}`, logistics), `${logistics}，${payment}`);
            assert.equal(context.ningboFreightHeader(`运费：${logistics}-100.5${payment}`, logistics), `${logistics}，100.5${payment}`);
        }
    }
    for (const [freight, logistics, expected] of [
        ['运费到付', '默认', '到付'],
        ['运费：100代付', '默认', '100代付'],
        ['运费：明邦-0到付', '明邦', '明邦，0到付'],
        ['工厂自提', '自提', '工厂自提'],
        ['运费：工厂自提', '自提', '工厂自提'],
    ]) {
        assert.equal(context.ningboFreightHeader(freight, logistics), expected);
    }
});

test('物流首行严格限定宁波仓，美利来及其他仓保持原样', () => {
    const context = { currentWarehouseGroup: () => '宁波仓' };
    vm.createContext(context);
    vm.runInContext(functionSource('tools/order-template.html', 'isNingboWarehouseActive'), context);
    vm.runInContext(functionSource('tools/order-template.html', 'ningboFreightHeader'), context);
    for (const warehouse of ['浙江仓', '美利来', '混凝土仓', '水泥板仓库', '自选仓']) {
        context.currentWarehouseGroup = () => warehouse;
        assert.equal(context.ningboFreightHeader('运费：安能到付', '安能'), '', warehouse);
    }
});

test("所有外部脚本引用都存在", () => {
  const htmlFiles = ["index.html", ...fs.readdirSync(path.join(root, "tools")).filter((file) => file.endsWith(".html")).map((file) => `tools/${file}`)];
  htmlFiles.forEach((htmlFile) => {
    const html = read(htmlFile);
    for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
      const scriptPath = match[1].split("?")[0];
      const target = path.resolve(path.dirname(path.join(root, htmlFile)), scriptPath);
      assert.ok(fs.existsSync(target), `${htmlFile} 引用了不存在的脚本：${match[1]}`);
    }
  });
});
