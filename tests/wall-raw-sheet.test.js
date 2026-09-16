const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../tools/wall-panel.html'), 'utf8');

function setup(widths, rawW = 1200, rawH = 2400, allowRotate = true) {
  const pieces = widths.map((p, i) => ({ ...(typeof p === 'number' ? { w:p, h:480 } : p), id:i + 1 }));
  const c = vm.createContext({ allWallPanels:() => pieces, value:k => k === 'rawW' ? rawW : rawH, els:{allowRotate:{checked:allowRotate}} });
  for (const name of ['validateRawSheetPlan', 'rawSheetPlan']) {
    const start = html.indexOf(`    function ${name}(`);
    if (start >= 0) vm.runInContext(html.slice(start, html.indexOf('\n    }', start) + 6), c);
  }
  return { c, pieces, plan:c.rawSheetPlan() };
}

function assertGeometry(plan, count) {
  assert.equal(plan.error, undefined);
  assert.equal(plan.sheets.reduce((sum,s) => sum + s.pieces.length, 0) + plan.impossible.length, count);
  for (const sheet of plan.sheets) {
    assert.ok(sheet.pieces.length);
    let area = 0;
    for (const p of sheet.pieces) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= plan.rawW + 1e-7 && p.y + p.h <= plan.rawH + 1e-7, JSON.stringify(p));
      area += p.w * p.h;
    }
    assert.ok(area <= plan.rawW * plan.rawH + 1e-5);
    for (let i=0; i<sheet.pieces.length; i++) for (let j=i+1; j<sheet.pieces.length; j++) {
      const a=sheet.pieces[i],b=sheet.pieces[j];
      assert.ok(a.x+a.w <= b.x+1e-7 || b.x+b.w <= a.x+1e-7 || a.y+a.h <= b.y+1e-7 || b.y+b.h <= a.y+1e-7);
    }
  }
}

test('169%案例：六块成品需要三张原板且无越界、重叠或遗漏', () => {
  const {plan} = setup([2400,2400,2400,1590,1345,660]);
  assert.equal(plan.sheets.length, 3);
  assertGeometry(plan, 6);
  assert.equal(plan.impossible.length, 0);
  const area = plan.sheets.flatMap(s=>s.pieces).reduce((sum,p)=>sum+p.originalW*p.originalH,0);
  assert.equal(area, 5181600);
});

test('利用短板后方余料：1590与660同板，1345可单独使用长半板', () => {
  const {plan} = setup([2400,2400,2400,1590,1345,660]);
  assert.ok(plan.sheets.some(s=>[2400,1590,660].every(w=>s.pieces.some(p=>p.originalW===w))));
  assert.ok(plan.sheets.some(s=>s.pieces.length===1 && s.pieces[0].originalW===1345));
});

test('旋转预检查不能许可未旋转的越宽放置，低于100%也必须核验边界', () => {
  const {plan}=setup([1590]);
  assertGeometry(plan,1);
  assert.equal(plan.sheets[0].pieces[0].w,480);
  assert.equal(plan.sheets[0].pieces[0].h,1590);
});

test('禁止旋转时无法切割的规格保留提示而非丢弃或越界', () => {
  const {plan}=setup([2400,1590,1345,660],1200,2400,false);
  assertGeometry(plan,4);
  assert.equal(plan.impossible.length,3);
  assert.equal(plan.sheets.length,1);
});

test('超过两边尺寸的板块无法切割，空输入不生成空原板', () => {
  const {plan}=setup([{w:2500,h:1300}]);
  assert.equal(plan.impossible.length,1);
  assert.equal(plan.sheets.length,0);
  assertGeometry(setup([]).plan,0);
});

test('正方形精确铺满及小数尺寸保持面积和数量', () => {
  for (const {plan} of [setup(Array.from({length:8},()=>({w:600,h:600}))),setup(Array.from({length:8},()=>({w:300.25,h:600.5})),600.5,2402)]) {
    assertGeometry(plan,8);
    assert.equal(plan.sheets.length,1);
  }
});

test('最终校验拒绝越界、重叠、重复、遗漏、尺寸篡改和不允许的旋转', () => {
  const {c,pieces,plan}=setup([{w:600,h:300},{w:600,h:300}],1200,1200,false);
  assert.equal(c.validateRawSheetPlan(plan,pieces,false),true);
  for (const mutate of [
    p=>{p.sheets[0].pieces[0].x=1000;},
    p=>{Object.assign(p.sheets[0].pieces[1],{x:p.sheets[0].pieces[0].x,y:p.sheets[0].pieces[0].y});},
    p=>{p.sheets[0].pieces[1].id=p.sheets[0].pieces[0].id;},
    p=>{p.sheets[0].pieces.pop();},
    p=>{p.sheets[0].pieces[0].originalW=500;},
    p=>{Object.assign(p.sheets[0].pieces[0],{w:300,h:600});},
    p=>{p.impossible.push(pieces[0]);},
  ]) {
    const invalid=JSON.parse(JSON.stringify(plan));mutate(invalid);
    assert.equal(c.validateRawSheetPlan(invalid,pieces,false),false);
  }
});

test('确定性混合规格回归：所有合法结果均通过几何和清单验证', () => {
  let seed=169;
  const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return 1+seed%n;};
  for(let i=0;i<60;i++) {
    const specs=Array.from({length:20},()=>({w:rand(2500),h:rand(1400)}));
    const {c,pieces,plan}=setup(specs,1200,2400,i%2===0);
    assertGeometry(plan,specs.length);
    assert.equal(c.validateRawSheetPlan(plan,pieces,i%2===0),true);
  }
});
