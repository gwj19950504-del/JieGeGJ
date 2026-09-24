/* Physical dimensions only. All groove widths are clear distances, not brick pitches. */
(function (root) {
    'use strict';

    const BOARD_WIDTH = 1220;
    const BOARD_HEIGHT = 2440;
    const MAX_CELLS = 6000;

    function dimension(value, label, minimum, maximum) {
        const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
        if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isFinite(number)
            || number < minimum || number > maximum || Math.abs(number * 10 - Math.round(number * 10)) > 1e-7) {
            throw new Error(`${label}请输入 ${minimum}–${maximum} mm，最多保留1位小数。`);
        }
        return Math.round(number * 10) / 10;
    }

    function splitAxis(length, brick, gap) {
        // Integer tenths avoid accumulated rounding at the board edge.
        const extent = Math.round(length * 10);
        const size = Math.round(brick * 10);
        const joint = Math.round(gap * 10);
        const bricks = [];
        const grooves = [];
        for (let position = 0; position < extent; position += size + joint) {
            const actualSize = Math.min(size, extent - position);
            bricks.push({ start: position / 10, size: actualSize / 10, full: actualSize === size });
            const grooveStart = position + actualSize;
            if (joint > 0 && grooveStart < extent) {
                grooves.push({ start: grooveStart / 10, size: Math.min(joint, extent - grooveStart) / 10 });
            }
        }
        return { bricks, grooves, fullCount: bricks.filter((item) => item.full).length };
    }

    function layout({ width, height, gap }) {
        const brickWidth = dimension(width, '小砖宽', 1, BOARD_WIDTH);
        const brickHeight = dimension(height, '小砖高', 1, BOARD_HEIGHT);
        const groove = dimension(gap, '缝隙', 0, BOARD_WIDTH);
        const columns = Math.ceil(BOARD_WIDTH / (brickWidth + groove));
        const rows = Math.ceil(BOARD_HEIGHT / (brickHeight + groove));
        if (columns * rows > MAX_CELLS) {
            throw new Error(`当前排版超过 ${MAX_CELLS} 格，请增大小砖尺寸或缝隙后再生成。`);
        }
        const horizontal = splitAxis(BOARD_WIDTH, brickWidth, groove);
        const vertical = splitAxis(BOARD_HEIGHT, brickHeight, groove);
        const total = horizontal.bricks.length * vertical.bricks.length;
        const full = horizontal.fullCount * vertical.fullCount;
        return {
            boardWidth: BOARD_WIDTH, boardHeight: BOARD_HEIGHT,
            brickWidth, brickHeight, gap: groove,
            horizontal, vertical, total, full, partial: total - full,
        };
    }

    const api = Object.freeze({ BOARD_WIDTH, BOARD_HEIGHT, MAX_CELLS, layout });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BrickLayoutCore = api;
}(typeof window !== 'undefined' ? window : globalThis));
