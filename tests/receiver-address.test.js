const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../tools/order-template.html'), 'utf8');
const source = html.slice(html.indexOf('    function parseReceiver()'), html.indexOf('    function receiverLine('));
function parse(raw, existing = {}) {
  const els = Object.fromEntries(['receiverRaw', 'receiverName', 'receiverPhone', 'receiverAddress']
    .map(key => [key, { value: existing[key] || '' }]));
  els.receiverRaw.value = raw;
  vm.runInNewContext(source + ';parseReceiver();', { els });
  return Object.fromEntries(Object.entries(els).map(([key, field]) => [key, field.value]));
}

test('只粘贴截图中的收货地址，不要求先填写姓名和手机号', () => {
  const address = '浙江省台州市椒江区海龙路 台州市公共交通集团有限公司(公交TOD大厦)';
  const actual = parse(address);
  assert.equal(actual.receiverAddress, address.replace(/\s+/g, ''));
  assert.equal(actual.receiverName, '');
  assert.equal(actual.receiverPhone, '');
  assert.equal(actual.receiverRaw, address, '原始输入不被改写');
});

test('省市区与道路门牌纯地址兼容换行、空格和明确地址标签', () => {
  for (const [raw, expected] of [
    ['  江苏省\n南京市 玄武区测试路1号  ', '江苏省南京市玄武区测试路1号'],
    ['杭州市余杭区', '杭州市余杭区'],
    ['海龙路168号', '海龙路168号'],
    ['收货地址：浙江省台州市椒江区海龙路', '浙江省台州市椒江区海龙路'],
    ['地址: 公交TOD大厦', '公交TOD大厦']
  ]) {
    const actual = parse(raw);
    assert.equal(actual.receiverAddress, expected, raw);
    assert.equal(actual.receiverName, '', raw);
    assert.equal(actual.receiverPhone, '', raw);
  }
});

test('只有姓名或无明确地址特征的文字不生成目的地', () => {
  for (const name of ['张三', '路小明', '欧阳小路', '王路老师', '测试收件人', '测试有限公司', '台州市公共交通集团有限公司']) {
    const actual = parse(name);
    assert.equal(actual.receiverName, name);
    assert.equal(actual.receiverAddress, '');
    assert.equal(actual.receiverPhone, '');
  }
});

test('原姓名手机号地址格式及分隔符解析保持不变', () => {
  for (const raw of [
    '测试收件人 13800000000 浙江省杭州市余杭区测试路1号',
    'X-测试收件人，138 0000 0000，浙江省杭州市余杭区测试路1号'
  ]) {
    const actual = parse(raw);
    assert.equal(actual.receiverName, '测试收件人');
    assert.equal(actual.receiverPhone, '13800000000');
    assert.equal(actual.receiverAddress, '浙江省杭州市余杭区测试路1号');
  }
});

test('解析不会覆盖已有的独立收件字段', () => {
  const existing = { receiverName: '保留姓名', receiverPhone: '13900000000', receiverAddress: '保留地址' };
  for (const raw of ['浙江省台州市椒江区海龙路', '测试收件人 13800000000 浙江省杭州市']) {
    const actual = parse(raw, existing);
    for (const [key, value] of Object.entries(existing)) assert.equal(actual[key], value);
  }
});

test('空白收件输入保持空字段，不虚构姓名电话或地址', () => {
  const actual = parse(' \n ');
  for (const key of ['receiverName', 'receiverPhone', 'receiverAddress']) assert.equal(actual[key], '');
});
