const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../tools/brick-layout-core.js');

test('砖纹示例60×240缝5按净尺寸排布，整板固定1220×2440', () => {
    const data = core.layout({ width: 60, height: 240, gap: 5, boardWidth: 300, boardHeight: 600 });
    assert.equal(data.boardWidth, 1220);
    assert.equal(data.boardHeight, 2440);
    assert.equal(data.horizontal.bricks.length, 19);
    assert.equal(data.vertical.bricks.length, 10);
    assert.deepEqual([data.total, data.full, data.partial], [190, 162, 28]);
    assert.equal(data.horizontal.bricks.at(-1).size, 50);
    assert.equal(data.vertical.bricks.at(-1).size, 235);
    assert.equal(data.horizontal.bricks[1].start, 65);
    assert.equal(data.vertical.bricks[1].start, 245);
});

test('砖宽砖高缝隙可以独立调整，不绑定示例', () => {
    const data = core.layout({ width: 200, height: 300, gap: 8 });
    assert.deepEqual([data.brickWidth, data.brickHeight, data.gap], [200, 300, 8]);
    assert.deepEqual([data.horizontal.bricks.length, data.vertical.bricks.length], [6, 8]);
    assert.equal(data.horizontal.bricks.at(-1).size, 180);
    assert.equal(data.vertical.bricks.at(-1).size, 284);
    const swapped = core.layout({ width: 240, height: 60, gap: 5 });
    assert.equal(swapped.horizontal.bricks[0].size, 240);
    assert.equal(swapped.vertical.bricks[0].size, 60);
});

test('零缝、整除、单格覆盖不额外扣边缝或生成多余一格', () => {
    const data = core.layout({ width: 61, height: 244, gap: 0 });
    assert.deepEqual([data.total, data.full, data.partial], [200, 200, 0]);
    assert.equal(data.horizontal.grooves.length, 0);
    assert.equal(data.vertical.grooves.length, 0);
    const full = core.layout({ width: 1220, height: 2440, gap: 5 });
    assert.equal(full.total, 1);
    assert.equal(full.full, 1);
    assert.equal(full.horizontal.grooves.length + full.vertical.grooves.length, 0);
});

test('板边落在凹槽时按实际剩余槽宽截断，不画越界砖或假造收边砖', () => {
    const data = core.layout({ width: 1218, height: 240, gap: 5 });
    assert.equal(data.horizontal.bricks.length, 1);
    assert.deepEqual(data.horizontal.grooves, [{ start: 1218, size: 2 }]);
    const exact = core.layout({ width: 300, height: 240, gap: 5 });
    assert.equal(exact.horizontal.bricks.length, 4);
    assert.deepEqual(exact.horizontal.grooves.at(-1), { start: 1215, size: 5 });
});

test('各种尺寸、小数和极值的砖面加槽精确覆盖整板，无重叠无越界', () => {
    const cases = [
        [30, 90, 5], [60.1, 240.4, 3.2], [1219.9, 2439.9, 0.1], [1, 2440, 0],
        [1220, 1, 0], [1, 1, 1220], [1200, 2400, 10], [300, 600, 5],
    ];
    for (let index = 1; index <= 50; index++) cases.push([20 + index * 13.1, 25 + index * 17.3, index % 11]);
    for (const [width, height, gap] of cases) {
        const data = core.layout({ width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10, gap });
        for (const [axis, extent, requested] of [
            [data.horizontal, 1220, data.brickWidth], [data.vertical, 2440, data.brickHeight],
        ]) {
            const spans = [...axis.bricks, ...axis.grooves].sort((left, right) => left.start - right.start);
            let cursor = 0;
            for (const item of spans) {
                assert.ok(Math.abs(item.start - cursor) < 1e-7);
                assert.ok(item.size > 0);
                cursor = item.start + item.size;
                assert.ok(cursor <= extent + 1e-7);
            }
            assert.ok(Math.abs(cursor - extent) < 1e-7);
            assert.ok(axis.bricks.filter((item) => item.full).every((item) => item.size === requested));
        }
        assert.equal(data.total, data.full + data.partial);
    }
});

test('空白、负数、非数、越界、超精度与过密排版明确报错', () => {
    for (const width of ['', ' ', null, undefined, true, NaN, Infinity, -1, 0, 1220.1, 60.01, 'abc']) {
        assert.throws(() => core.layout({ width, height: 240, gap: 5 }));
    }
    for (const height of [0, '', -240, Infinity, 2440.1]) {
        assert.throws(() => core.layout({ width: 60, height, gap: 5 }));
    }
    for (const gap of ['', -1, NaN, 1221, 0.01]) {
        assert.throws(() => core.layout({ width: 60, height: 240, gap }));
    }
    assert.throws(() => core.layout({ width: 1, height: 1, gap: 0 }), /超过 6000 格/);
});

test('首页孔心移至原工具末尾，砖纹随后，旧排序迁移且后续拖动仍可保存', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const defaultTools = JSON.parse(html.match(/const defaultTools = (\[[\s\S]*?\]);/)[1]);
    const context = { defaultTools };
    vm.createContext(context);
    vm.runInContext(html.match(/    function orderedTools\(savedOrder\) \{[\s\S]*?\n    \}/)[0], context);
    function ids(order) { return Array.from(context.orderedTools(order), (item) => item.id); }
    const expected = defaultTools.map((item) => item.id);
    assert.equal(expected.length, 10);
    assert.deepEqual(expected.slice(-2), ['hole-1200', 'brick-layout']);
    assert.deepEqual(ids([]), expected);
    const older = ['quote-generator', 'hole-1200', 'order-template', 'wall-panel'];
    const migrated = ids(older);
    assert.deepEqual(migrated.slice(0, 3), ['quote-generator', 'order-template', 'wall-panel']);
    assert.deepEqual(migrated.slice(-2), ['hole-1200', 'brick-layout']);
    assert.equal(new Set(ids(['hole-1200', 'hole-1200', 'unknown'])).size, 10);
    assert.deepEqual(ids(null), expected);
    assert.deepEqual(ids('bad data'), expected);
    const rearranged = ['brick-layout', ...expected.filter((id) => id !== 'brick-layout')];
    assert.deepEqual(ids(rearranged), rearranged);
});

test('砖纹渲染和资源独立于孔心/上墙，不给旧工具替换材质', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../tools/brick-layout.html'), 'utf8');
    assert.match(html, /data-page="brick-layout"/);
    assert.match(html, /以上三项均可修改/);
    assert.match(html, /brick-layout-core\.js\?v=20260924-1/);
    assert.match(html, /brick-layout\.js\?v=20260924-1/);
    assert.doesNotMatch(html, /cement-render\.js/);
    for (const file of ['hole-1200.html', 'wall-panel.html']) {
        const previous = fs.readFileSync(path.resolve(__dirname, '../tools', file), 'utf8');
        assert.match(previous, /cement-render\.js\?v=20260916-3/);
        assert.doesNotMatch(previous, /brick-layout\.js/);
    }
});
