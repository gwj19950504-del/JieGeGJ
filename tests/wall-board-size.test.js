const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../tools/wall-panel.html'), 'utf8');
function setup() {
  const c = vm.createContext({
    sharedBoardSize: { boardW: '1200', boardH: '600' }, orientation: 'horizontal', activeWall: 0,
    walls: [{ name: '墙1', wallW: 2400, wallH: 1200 }, { name: '墙2', wallW: 2580, wallH: 1000, useCustomBoardSize: true, customBoardSize: { boardW: '645', boardH: '1000' } }],
    els: Object.fromEntries(['boardW', 'boardH', 'wallName', 'wallW', 'wallH', 'customBoardSize', 'boardSizeHint', 'cutX', 'cutY', 'jointGapPreset'].map(k => [k, { value: k.startsWith('cut') ? 'end' : '0' }])),
  });
  for (const name of ['currentWall', 'boardSizeFor', 'syncBoardSizeFromInputs', 'dims', 'value', 'jointGapValue', 'distributeWithoutGap', 'distribute', 'layout', 'allWallPanels', 'summarizeAllWalls', 'syncInputsFromWall']) {
    const start = html.indexOf(`    function ${name}(`);
    const end = html.indexOf('\n    }', start) + 6;
    vm.runInContext(html.slice(start, end), c);
  }
  return c;
}
test('单墙自定义板材不影响统一尺寸且所有墙按各自规格排版', () => {
  const c = setup();
  assert.equal(c.layout(c.walls[0]).panels.length, 4);
  assert.equal(c.layout(c.walls[1]).panels.length, 4);
  assert.equal(c.layout(c.walls[1]).boardW, 645);
  c.activeWall = 1;
  c.syncInputsFromWall();
  assert.equal(c.els.boardW.value, '645');
  assert.equal(c.els.customBoardSize.checked, true);
  c.els.boardW.value = '860'; c.syncBoardSizeFromInputs();
  assert.equal(c.sharedBoardSize.boardW, '1200');
  assert.equal(c.layout(c.walls[1]).panels.length, 3);
  c.activeWall = 0; c.syncInputsFromWall();
  assert.equal(c.els.boardW.value, '1200');
  c.els.boardW.value = '600'; c.syncBoardSizeFromInputs();
  assert.equal(c.layout(c.walls[0]).panels.length, 8);
  assert.equal(c.layout(c.walls[1]).boardW, 860);
});
test('取消自定义恢复统一尺寸、再次启用保留本墙草稿，方向在有效规格上交换', () => {
  const c = setup();
  c.walls[1].useCustomBoardSize = false;
  assert.equal(c.dims(c.walls[1]).boardW, 1200);
  c.walls[1].useCustomBoardSize = true;
  c.orientation = 'vertical';
  assert.equal(c.dims(c.walls[1]).boardW, 1000);
  assert.equal(c.dims(c.walls[1]).boardH, 645);
});
test('同一成品规格可同时包含整板和裁切板，汇总保留归属', () => {
  const c = setup();
  c.walls[0].wallW = 645; c.walls[0].wallH = 600;
  c.walls[1].wallW = 645; c.walls[1].wallH = 600;
  c.walls[1].customBoardSize.boardH = '600';
  const items = c.summarizeAllWalls();
  assert.equal(items.length, 1);
  assert.equal(items[0].count, 2);
  assert.equal(items[0].fullCount, 1);
});
test('未选中墙面的无效自定义尺寸不能进入排版计算', () => {
  const c = setup();
  for (const value of ['', '0', '-1', 'Infinity', 'NaN']) {
    c.walls[1].customBoardSize.boardW = value;
    assert.ok(c.layout(c.walls[1]).error);
    assert.equal(c.layout(c.walls[1]).panels.length, 0);
  }
});
