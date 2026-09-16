const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cement=require('../tools/cement-render.js');
const read=name=>fs.readFileSync(path.join(__dirname,'../tools',name),'utf8');

test('共用水泥灰凹孔保持中心和半径，不接受无效几何或SVG标识注入',()=>{
  assert.equal(cement.palette.board,'#b8bbbe');
  assert.match(cement.defs('sample'),/id="sample-rim"/);
  const hole=cement.hole(200,150,20,'sample');
  assert.match(hole,/<circle cx="200" cy="150" r="20" fill="url\(#sample-rim\)"/);
  assert.match(hole,/pointer-events="none"/);
  assert.throws(()=>cement.hole(0,0,0,'sample'));
  assert.throws(()=>cement.hole(NaN,0,20,'sample'));
  assert.throws(()=>cement.defs('x" onload="alert(1)'));
});

test('上墙采用已确认黑字凹孔深蓝按钮，屏幕及导出均共用SVG效果',()=>{
  const html=read('wall-panel.html'),css=read('apple-ui.css');
  assert.match(html,/CementRender\.defs\("wall-cement"\)/);
  assert.match(html,/CementRender\.hole\(x \+ hx \* scale, y \+ hy \* scale/);
  assert.doesNotMatch(html,/fill: "#ff4d4d"|fill: "#171917"|fill: "url\(#cement\)"/);
  assert.match(html,/ctx.fillStyle = "#ffffff"/);
  assert.match(html,/class: "copy-wall-button",[\s\S]{0,200}role: "button"/);
  assert.match(css,/\[data-page="wall-panel"\] \.summary\s*\{[^}]*background: #eceef0 !important/);
  assert.match(css,/\[data-page="wall-panel"\] \.summary strong\s*\{[^}]*color: #1d1d1f !important/);
});

test('整板和裁切统一中灰且移除双色图例，孔心渲染与导出沿用同一材质',()=>{
  const wall=read('wall-panel.html'),hole=read('hole-1200.html');
  assert.match(wall,/fill: CementRender\.palette\.board/);
  assert.match(wall,/水泥板 · 中灰/);
  assert.doesNotMatch(wall,/palette\.(full|cut)|p\.full \? CementRender/);
  assert.match(wall,/const totalFull = allPanels\.filter\(\(p\) => p\.full\)\.length/);
  for (const html of [wall,hole]) {
    assert.match(html,/cement-render\.js\?v=20260916-3/);
    assert.doesNotMatch(html,/#969b9f|#c4c6c8/i);
  }
  assert.equal((hole.match(/fill="\$\{CementRender\.palette\.board\}"/g)||[]).length,2);
});

test('关联整板切割同案为三张，六块清单、面积与坐标全部有效',()=>{
  const html=read('full-board-cut.html');
  const context=vm.createContext({});
  for(const name of ['intersects','splitFreeRects','contains','pruneFreeRects','tryPack','compareScore','pack']) {
    const start=html.indexOf('function '+name+'(');
    vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),context);
  }
  const pieces=[2400,2400,2400,1590,1345,660].map((w,id)=>({w,h:480,rawW:w,rawH:480,label:String(id)}));
  const result=context.pack(pieces,1200,2400,true);
  assert.equal(result.boards.length,3);
  const seen=new Set();
  let area=0;
  for(const board of result.boards)for(const [i,p] of board.used.entries()) {
    assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1200&&p.y+p.h<=2400);
    assert.equal(seen.has(p.item.label),false);seen.add(p.item.label);area+=p.w*p.h;
    for(const q of board.used.slice(0,i))assert.equal(context.intersects(p,q),false);
  }
  assert.equal(seen.size,6);assert.equal(area,5181600);
});
