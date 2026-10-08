const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const name of ['best-rates.js', 'freight-gold-core.js']) vm.runInContext(fs.readFileSync(path.join(root, 'tools', name), 'utf8'), ctx);
  return { core: ctx.window.GoldFreightCore, data: ctx.window.BEST_RATE_DATA };
}
const { core, data } = load();
function quote(weight, address = '浙江省杭州市余杭区测试路', extra = {}) {
  // Tiny synthetic dimensions keep unrelated rate/destination tests on actual weight.
  return core.buildBestQuote({ address, totalWeight: weight, pkg: { type: 'crate', outer: '0.1*0.1*0.1' }, weightLine: `${weight}KG`, packageLine: '测试包装', dbLine: 'DB3', db: 3, paymentMode: 'prepaid', ...extra });
}

test('百世原表31条省价和326条重货记录完整保留并可追溯', () => {
  assert.equal(data.updatedAt, '2026-09-22');
  assert.equal(data.standardRows.length, 31);
  assert.equal(data.heavyRows.length, 326);
  assert.equal(new Set(data.heavyRows.map(row => row.region)).size, 28);
  assert.equal(new Set(data.heavyRows.map(row => `${row.region}/${row.city}`)).size, 324);
  for (const row of data.standardRows) {
    assert.ok(row.province && row.region && row.eta);
    assert.equal(row.rates.length, 2);
    assert.ok(row.rates.every(rate => Number.isFinite(rate) && rate > 0));
  }
  for (let i = 0; i < data.heavyRows.length; i++) {
    const row = data.heavyRows[i];
    assert.equal(row.sourceRow, i + 3);
    assert.ok(row.city && Number.isFinite(row.rate) && Number.isFinite(row.delivery) && row.eta);
  }
  assert.ok(fs.existsSync(path.join(root, 'docs', data.standardFile)));
  assert.ok(fs.existsSync(path.join(root, 'docs', data.heavyFile)));
});

test('百世500及1000KG边界连续，重货数值按元/公斤', () => {
  for (const [weight, rate, delivery] of [[499.5, .6, 0], [500, .6, 0], [500.5, .55, 0], [999.5, .55, 0], [1000, .55, 0], [1000.5, .3, 100], [2000, .3, 100]]) {
    const actual = quote(weight);
    assert.equal(actual.rate, rate, `${weight}kg`);
    assert.equal(actual.deliveryFee, delivery, `${weight}kg`);
    assert.equal(actual.chargeWeight, weight);
    assert.equal(actual.freightFee, Math.round((weight * rate + Number.EPSILON) * 100) / 100);
  }
  assert.equal(quote(2000).totalFee, 738); // 600 freight + 100 delivery + 35 insurance + 3 DB
});

test('百世保险300=5、301至600=10、601至900=15，零碎公斤进下一档', () => {
  for (const [weight, fee] of [[1, 5], [299.5, 5], [300, 5], [300.5, 10], [301, 10], [600, 10], [600.5, 15], [601, 15], [900, 15], [901, 20], [1200, 20], [1201, 25], [5000, 85]]) {
    assert.equal(core.bestInsuranceFee(weight), fee, `${weight}kg`);
    assert.equal(quote(weight).insuranceFee, fee, `${weight}kg`);
  }
  assert.equal(quote(300, undefined, { declaredValue: 1000000 }).insuranceFee, 5);
});

test('百世真实混装半分钱运费正确四舍五入，不受二进制乘法误差影响', () => {
  const shipment = core.calculateShipment([
    { material: 'hard', specKey: 'hard-2440', quantity: 24 },
    { material: 'hard', specKey: 'hard-600', quantity: 63 }
  ]);
  assert.equal(shipment.totalWeight, 1282.5);
  const result = core.buildBestQuote({ ...shipment, address: '江苏省南京市', paymentMode: 'prepaid' });
  assert.equal(result.freightFee, 448.88);
  assert.equal(result.subtotal, 641.88);
  assert.equal(result.totalFee, 642);
  assert.match(result.processText, /费用小计：448.88\+25\+100\+68=641.88元/);
});

test('百世实重超过体积重时使用实重，不增加100KG起重或旧托盘上限', () => {
  assert.equal(quote(10).freightFee, 6);
  assert.equal(quote(325).chargeWeight, 325);
  assert.equal(quote(2001, undefined, { pkg: { type: 'pallet', size: '3*2*2' } }).quoted, true);
  const shipment = core.calculateShipment([{ material: 'hard', specKey: 'hard-2440', quantity: 60 }]);
  const result = core.buildBestQuote({ ...shipment, address: '浙江省杭州市余杭区' });
  assert.equal(result.volume, 2.32);
  assert.equal(result.volumetricWeight, 464);
  assert.equal(result.chargeWeight, 1890);
  assert.equal(result.isVolumetric, false);
  assert.equal(result.subtotal, 792);
  assert.equal(result.totalFee, 816);
});

test('百世截图抛货按0.77方乘200计154KG，保险按计费重量且另加DB3', () => {
  const shipment = core.calculateShipment([{ material: 'soft', specKey: 'soft-2440', quantity: 2 }]);
  assert.equal(shipment.totalWeight, 76);
  const result = core.buildBestQuote({ ...shipment, address: '浙江省台州市椒江区海龙路' });
  assert.equal(result.actualWeight, 76);
  assert.equal(result.volume, .77);
  assert.equal(result.volumetricWeight, 154);
  assert.equal(result.chargeWeight, 154);
  assert.equal(result.isVolumetric, true);
  assert.equal(result.freightFee, 92.4);
  assert.equal(result.insuranceFee, 5);
  assert.equal(result.subtotal, 100.4);
  assert.equal(result.totalFee, 104);
  assert.match(result.quoteText, /2\*15\+46=76KG/);
  assert.match(result.quoteText, /体积：2.46\*1.25\*0.25=0.77方/);
  assert.match(result.quoteText, /实重76KG与体积重154KG取大值=154KG（抛货）/);
  assert.match(result.processText, /费用小计：92.4\+5\+0\+3=100.4元/);
});

test('百世先把体积四舍五入到两位再乘200，不直接把精确体积重向上取整', () => {
  for (const [height, volume, weight] of [[.764, .76, 152], [.765, .77, 154], [.565, .57, 114], [.674, .67, 134]]) {
    const result = quote(76, undefined, { pkg: { type: 'crate', outer: `1*1*${height}` } });
    assert.equal(result.volume, volume);
    assert.equal(result.volumetricWeight, weight);
    assert.equal(result.chargeWeight, weight);
  }
  assert.equal(quote(154, undefined, { pkg: { type: 'pallet', size: '2.46*1.25*0.25' } }).isVolumetric, false);
  assert.equal(quote(154.5, undefined, { pkg: { type: 'pallet', size: '2.46*1.25*0.25' } }).chargeWeight, 154.5);
});

test('百世抛货按计费重量匹配500/1000KG费率、300KG保险和送货费档', () => {
  for (const [volume, weight, rate, insurance, delivery] of [
    [1.5, 300, .6, 5, 0], [1.51, 302, .6, 10, 0],
    [2.5, 500, .6, 10, 0], [2.51, 502, .55, 10, 0],
    [3, 600, .55, 10, 0], [3.01, 602, .55, 15, 0],
    [4.5, 900, .55, 15, 0], [4.51, 902, .55, 20, 0],
    [5, 1000, .55, 20, 0], [5.01, 1002, .3, 20, 100],
    [24.99, 4998, .3, 85, 100], [25, 5000, .3, 85, 0]
  ]) {
    const result = quote(76, undefined, { pkg: { type: 'crate', outer: `1*1*${volume}` } });
    assert.equal(result.chargeWeight, weight);
    assert.equal(result.rate, rate);
    assert.equal(result.insuranceFee, insurance);
    assert.equal(result.deliveryFee, delivery);
  }
  const pickup = quote(76, undefined, { pkg: { type: 'crate', outer: '1*1*5.01' }, destinationPickup: true });
  assert.equal(pickup.deliveryFee, 0);
  assert.equal(quote(76, '青海省西宁市', { pkg: { type: 'crate', outer: '1*1*5.01' } }).totalText, '人工询价');
});

test('百世缺少或无效包装尺寸转人工，不能跳过抛货核算', () => {
  const shipment = core.calculateShipment([{ material: 'hard', specKey: 'hard-600', quantity: 2 }]);
  assert.equal(shipment.totalWeight, 31);
  const result = core.buildBestQuote({ ...shipment, address: '江苏省南京市' });
  assert.equal(result.quoted, false);
  assert.equal(result.totalText, '人工询价');
  assert.match(result.quoteText, /包装长宽高不完整/);
  for (const size of ['', '1*2', '1*2*0', '1*2*-3', '1*2*NaN', '1*2*Infinity', '1*2*3*4', '1*2*3m']) {
    assert.equal(quote(76, undefined, { pkg: { type: 'pallet', size } }).totalText, '人工询价', size);
  }
  assert.equal(quote(76, '', { pkg: { type: 'pallet' } }).totalText, '-');
});

test('百世重货送货费自提免收，5吨及以上免收，1吨以内已含门到门', () => {
  assert.equal(quote(4999).deliveryFee, 100);
  assert.equal(quote(5000).deliveryFee, 0);
  assert.equal(quote(5000.5).deliveryFee, 0);
  assert.equal(quote(2000, undefined, { destinationPickup: true }).totalFee, 638);
  assert.equal(quote(300).totalFee, quote(300, undefined, { destinationPickup: true }).totalFee);
  assert.match(quote(300).processText, /门到门已含送货，不含上楼费/);
  assert.match(quote(300, undefined, { destinationPickup: true }).processText, /自提不自动减价/);
});

test('百世柳州采用用户确认0.65，原始冲突行保留；相同唐山重复价可报价', () => {
  const liuzhou = data.heavyRows.filter(row => row.city === '柳州市');
  assert.deepEqual(Array.from(liuzhou, row => row.rate), [.65, .75]);
  const result = quote(2000, '广西壮族自治区柳州市鱼峰区');
  assert.equal(result.rate, .65);
  assert.equal(result.deliveryFee, 200);
  assert.equal(result.totalFee, 1538);
  assert.match(result.processText, /用户确认采用0.65/);
  assert.equal(quote(2000, '河北省唐山市').rate, .55);
  const unconfirmed = load();
  unconfirmed.data.confirmedOverrides.length = 0;
  assert.equal(unconfirmed.core.matchBestRate('广西柳州市', true).type, 'conflict');
});

test('百世地址识别不把道路名作为省市，多个省份或城市阻断', () => {
  assert.equal(core.matchBestRate('湖北省武汉市上海路88号').row.region, '湖北');
  assert.equal(core.matchBestRate('江苏省南京市贵阳路10号').row.region, '江苏');
  assert.equal(core.matchBestRate('贵阳路10号').type, 'none');
  assert.equal(core.matchBestRate('南京市徐州路1号').row.region, '江苏');
  assert.equal(core.matchBestRate('上海路10号').type, 'none');
  assert.equal(quote(2000, '广东省广州市转浙江省杭州市').totalText, '人工询价');
  assert.equal(quote(2000, '江苏省南京市苏州市').totalText, '人工询价');
  assert.equal(quote(2000, '浙江杭州余杭区').rate, .3);
  assert.equal(quote(2000, '浙江省宁波市江北区').rate, .3);
  assert.equal(quote(2000, '重庆市江北区').rate, .63);
});

test('百世重货精确匹配直辖市分区，不默认将未知区县归入市区', () => {
  assert.equal(quote(2000, '上海市浦东新区').rate, .3);
  assert.equal(quote(2000, '上海市市区').rate, .35);
  assert.equal(quote(2000, '北京市市区').deliveryFee, 200);
  assert.equal(quote(2000, '天津市市区').deliveryFee, 150);
  assert.equal(quote(2000, '上海市崇明区').deliveryFee, 150);
  assert.equal(quote(2000, '北京市延庆区').deliveryFee, 300);
  assert.equal(quote(2000, '上海市未知区').totalText, '人工询价');
  assert.equal(quote(2000, '北京市').totalText, '人工询价');
});

test('百世未列省份/城市和疑似错字不自动套价，1吨以内仍按省价', () => {
  for (const address of ['青海省西宁市', '新疆维吾尔自治区乌鲁木齐市', '西藏自治区拉萨市']) {
    assert.equal(quote(1000, address).quoted, true);
    assert.equal(quote(1000.5, address).totalText, '人工询价');
  }
  for (const address of ['云南省怒江州', '河北省沧州市', '湖北省襄阳市', '香港特别行政区']) {
    assert.equal(quote(2000, address).totalText, '人工询价');
  }
  assert.equal(quote(2000, '浙江省舟山市').rate, .4);
  assert.equal(quote(2000, '江苏省徐州市').rate, .4);
});

test('百世报价含DB，费用小计与付款取整分开说明，非法输入和无地址不保留旧总额', () => {
  const result = quote(300);
  assert.equal(result.totalFee, 188);
  assert.match(result.quoteText, /百世快运预估：188元/);
  assert.match(result.quoteText, /运费180元、易碎品保险5元、送货费0元、DB3元/);
  assert.match(result.processText, /费用小计：180\+5\+0\+3=188元/);
  assert.match(result.quoteText, /偏远\/特殊派送/);
  for (const weight of [0, -1, NaN, Infinity, '300']) assert.equal(quote(weight).totalText, '-');
  assert.equal(quote(300, '').totalText, '-');
  assert.equal(quote(300, undefined, { db: NaN }).totalText, '人工询价');
  assert.equal(core.buildShunxinQuote, undefined);
});

test('百世到付含DB的整票小计加3%后向上取整，我们付不加3%也向上取整', () => {
  const shipment = core.calculateShipment([{ material: 'soft', specKey: 'soft-2440', quantity: 2 }]);
  const collect = core.buildBestQuote({ ...shipment, address: '浙江省台州市' });
  const prepaid = core.buildBestQuote({ ...shipment, address: '浙江省台州市', paymentMode: 'prepaid' });
  for (const result of [collect, prepaid]) {
    assert.equal(result.subtotal, 100.4);
    assert.equal(result.freightFee, 92.4);
    assert.equal(result.insuranceFee, 5);
    assert.equal(result.deliveryFee, 0);
    assert.equal(result.chargeWeight, 154);
  }
  assert.equal(collect.paymentMode, 'collect');
  assert.equal(collect.payableBeforeRounding, 103.412);
  assert.equal(collect.totalFee, 104);
  assert.match(collect.quoteText, /到付：100.4元\*1.03=103.412元，向上取整=104元/);
  assert.equal(prepaid.paymentMode, 'prepaid');
  assert.equal(prepaid.totalFee, 101);
  assert.match(prepaid.quoteText, /我们付：100.4元（不加3%），向上取整=101元/);
});

test('百世付款向上取整保留已是整数的金额，加3%后不先四舍五入到分', () => {
  const collect = quote(150, undefined, { db: 5, dbLine: 'DB5', paymentMode: 'collect' });
  assert.equal(collect.subtotal, 100);
  assert.equal(collect.payableBeforeRounding, 103);
  assert.equal(collect.totalFee, 103);
  assert.equal(quote(150, undefined, { db: 5 }).totalFee, 100);
  const fraction = quote(100, undefined, { db: 32.09, dbLine: 'DB32.09', paymentMode: 'collect' });
  assert.equal(fraction.subtotal, 97.09);
  assert.equal(fraction.payableBeforeRounding, 100.0027);
  assert.equal(fraction.totalFee, 101, '先保留两位会错误变成100元');
  assert.match(fraction.processText, /97.09元\*1.03=100.0027元，向上取整=101元/);
});

test('百世新付款方式不能静默接受未知值或省略到付加收', () => {
  assert.equal(quote(300, undefined, { paymentMode: undefined }).totalFee, 194);
  assert.equal(quote(300, undefined, { paymentMode: 'unknown' }).totalText, '人工询价');
});

test('三个运行入口不再引用顺心资源或保价、上门费控件', () => {
  for (const name of ['order-template.html', 'freight-gold.html', 'quote-generator.html']) {
    const html = fs.readFileSync(path.join(root, 'tools', name), 'utf8');
    assert.doesNotMatch(html, /shunxin|Shunxin|顺心|DeclaredValue|IncludeUpstairs|declaredValue:/);
    assert.match(html, /best-rates\.js\?v=20261008-1/);
    assert.match(html, /freight-gold-core\.js\?v=20261008-4/);
    assert.match(html, /运费付款/);
    assert.match(html, /实重与体积重取大值/);
    assert.match(html, /向上取整/);
    assert.doesNotMatch(html, /按实际总重量及/);
    assert.match(html, /DestinationPickup/);
    assert.match(html, /best-brand/);
  }
});
