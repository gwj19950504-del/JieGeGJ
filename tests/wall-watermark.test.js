const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../tools/wall-panel.html'), 'utf8');
const source = html.match(/const watermarkSource = "(data:image\/png;base64,[^"]+)"/)[1];
const start = html.indexOf('    async function transparentWatermark()');
const loader = html.slice(start, html.indexOf('\n    }', start) + 6);

test('复制水印逐字节保留用户提供的MMMM原PNG，不用字体重绘', () => {
  const bytes = Buffer.from(source.split(',')[1], 'base64');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'c4020d774ff85f9d9bf509643c22731eae013b3a7f0f823418ff9b677fb233c0');
  assert.equal(bytes.readUInt32BE(16), 1933);
  assert.equal(bytes.readUInt32BE(20), 2522);
});

test('水印加载直接返回原图并缓存，不把原透明边缘改成实心粗笔画', async () => {
  const original = { width:1933, height:2522, sampleAlpha:[0,1,2,4,114,136] };
  let calls = 0;
  const c = vm.createContext({ watermarkSource:source, transparentWatermarkPromise:null,
    loadImage:async value=>{ assert.equal(value,source); calls++; return original; },
    document:{ createElement(){ throw new Error('Must not rewrite source alpha'); } },
  });
  vm.runInContext(loader,c);
  const [a,b] = await Promise.all([c.transparentWatermark(),c.transparentWatermark()]);
  assert.equal(a,original); assert.equal(b,original); assert.equal(calls,1);
  assert.deepEqual(a.sampleAlpha,[0,1,2,4,114,136]);
  assert.doesNotMatch(loader,/getImageData|putImageData|fillText/);
});

test('水印加载失败不缓存失效结果，重试可重新加载', async () => {
  let attempts = 0;
  const original = {};
  const c = vm.createContext({ watermarkSource:source, transparentWatermarkPromise:null,
    loadImage:async()=>{ if(++attempts===1) throw new Error('image failed'); return original; },
  });
  vm.runInContext(loader,c);
  await assert.rejects(c.transparentWatermark(),/image failed/);
  assert.equal(c.transparentWatermarkPromise,null);
  assert.equal(await c.transparentWatermark(),original);
  assert.equal(attempts,2);
});
