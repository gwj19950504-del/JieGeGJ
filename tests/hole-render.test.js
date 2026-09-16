const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cement = require('../tools/cement-render.js');
const html = fs.readFileSync(path.join(__dirname, '../tools/hole-1200.html'), 'utf8');

function source(name) {
  const start = html.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n    }', start) + 6);
}

function fixture(overrides = {}) {
  const fields = { widthMm:1200, heightMm:600, holes:6, diameter:40, columns:3, marginX:200, marginY:150, ...overrides };
  const node = (tag, attrs = {}, value = '') => ({ tag, attrs, text:value, children:[], innerHTML:'', parentElement:{ hidden:false },
    append(child) { this.children.push(child); }, replaceChildren() { this.children=[]; this.innerHTML=''; },
    setAttribute(k,v) { this.attrs[k]=String(v); }, removeAttribute(k) { delete this.attrs[k]; },
  });
  const calls = [];
  const download = {};
  const context = vm.createContext({
    svg:node('svg'), materialPreviewSvg:node('svg'), copyMaterialPreview:{}, materialPreviewStatus:{},
    getValue:id=>fields[id], el:node, document:{ querySelector:()=>download },
    CementRender:{ ...cement, hole(...args) { calls.push(args); return cement.hole(...args); } },
  });
  for (const name of ['line','text','clearMaterialPreview','materialLabel','renderMaterialPreview','draw']) vm.runInContext(source(name), context);
  return { context, fields, calls, download };
}

function assertLinked(f) {
  f.calls.length = 0;
  f.context.draw();
  const { context:c, fields:v, calls } = f;
  const board = c.svg.children[0];
  const plate = board.children.find(n=>n.tag==='rect');
  const circles = board.children.filter(n=>n.attrs.class==='hole');
  const scale = Math.min(780/v.widthMm, 410/v.heightMm);
  assert.equal(circles.length, v.holes);
  assert.equal(calls.length, v.holes + 1, 'one zoomed hole in addition to actual holes');
  for (let i=0;i<v.holes;i++) {
    const a=circles[i].attrs, b=calls[i];
    assert.ok(Math.abs(a.cx/plate.attrs.width - (b[0]-34)/(v.widthMm*scale))<1e-10);
    assert.ok(Math.abs(a.cy/plate.attrs.height - (b[1]-62)/(v.heightMm*scale))<1e-10);
    assert.ok(Math.abs(a.r/plate.attrs.width - b[2]/(v.widthMm*scale))<1e-10);
  }
  assert.equal(c.materialPreviewSvg.attrs['data-hole-count'],String(v.holes));
  assert.equal(c.materialPreviewSvg.parentElement.hidden,false);
  assert.equal(c.copyMaterialPreview.disabled,false);
  assert.match(c.materialPreviewSvg.innerHTML,/id="hole-material-rim"/);
  assert.doesNotMatch(c.materialPreviewSvg.innerHTML,/NaN|Infinity/);
}

test('孔心默认六孔保留原示意图，在下方新增同位置同孔径的水泥灰渲染',()=>{
  assert.ok(html.indexOf('id="svg"') < html.indexOf('id="materialPreviewSvg"'));
  assert.match(html,/cement-render\.js\?v=20260916-1/);
  assertLinked(fixture());
});

test('四孔参考、单孔居中、末行不足、竖板和小数孔径均跟随当前参数',()=>{
  const f=fixture();
  for(const values of [
    { holes:4,columns:2,diameter:25,marginX:100,marginY:100 },
    { widthMm:600,heightMm:1200,holes:1,columns:1,diameter:55.5 },
    { widthMm:1220,heightMm:800,holes:5,columns:3,diameter:40,marginX:180,marginY:130 },
    { widthMm:1200,heightMm:600,holes:7,columns:3,diameter:25 },
  ]) { Object.assign(f.fields,values); assertLinked(f); }
});

test('无效尺寸、孔数、边距和重叠孔位清空旧渲染并同时禁用两种输出',()=>{
  for(const values of [{widthMm:0},{heightMm:NaN},{holes:0},{holes:1.5},{columns:0},{diameter:1000},{marginX:-1},{marginY:300}]) {
    const f=fixture(); assertLinked(f); Object.assign(f.fields,values); f.context.draw();
    const c=f.context;
    assert.equal(c.materialPreviewSvg.innerHTML,'');
    assert.equal(c.materialPreviewSvg.parentElement.hidden,true);
    assert.equal(c.materialPreviewSvg.attrs['data-hole-count'],undefined);
    assert.equal(c.copyMaterialPreview.disabled,true);
    assert.equal(f.download.disabled,true);
    assert.match(c.materialPreviewStatus.textContent,/请/);
  }
});

test('空点或非有限坐标不能生成带NaN的凹孔图纸',()=>{
  const {context:c}=fixture();
  for(const points of [[],[[NaN,100]],[[100,Infinity]],[[100]]]) {
    c.renderMaterialPreview(points,1200,600,40);
    assert.equal(c.materialPreviewSvg.innerHTML,'');
    assert.equal(c.copyMaterialPreview.disabled,true);
  }
});

test('原示意图SVG输出独立，新增复制优先PNG并保留矢量兜底',()=>{
  const original=html.slice(html.indexOf("document.querySelector('#downloadSvg').addEventListener"),html.indexOf('    function materialPreviewBlob'));
  assert.match(original,/new Blob\(\[svg\.outerHTML\]/);
  assert.doesNotMatch(original,/materialPreviewSvg/);
  assert.match(html,/new ClipboardItem\(\{ 'image\/png': png \}\)/);
  assert.match(html,/downloadMaterialPreview\(png \|\| fallbackSvg, png \? 'png' : 'svg'\)/);
});
