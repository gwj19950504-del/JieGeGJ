/* Physical dimensions only. All groove widths are clear distances, not brick pitches. */
(function (root) {
    'use strict';

    const BOARD_WIDTH = 1220;
    const BOARD_HEIGHT = 2440;
    const MAX_CELLS = 6000;
    const PRECISION = 1000000;

    function rounded(value) {
        return Math.round(value * PRECISION) / PRECISION;
    }

    function dimension(value, label, minimum, maximum) {
        const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
        if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isFinite(number)
            || number < minimum || number > maximum || Math.abs(number - rounded(number)) > 1e-9) {
            throw new Error(`${label}请输入 ${minimum}–${maximum} mm，最多保留6位小数。`);
        }
        return rounded(number);
    }

    function equalSize(length, gap, count) {
        if (count < 1) return null;
        const size = (length - (count - 1) * gap) / count;
        if (size < 1 || size > length) return null;
        return { count, size, input: rounded(size) };
    }

    function matchingDivision(length, brick, gap) {
        const count = Math.round((length + gap) / (brick + gap));
        const candidate = equalSize(length, gap, count);
        // A six-decimal recommendation represents its exact division, not a rounded cutting size.
        return candidate && Math.abs(candidate.input - brick) < 1e-9 ? candidate : null;
    }

    function suggestions(length, value, gapValue) {
        const brick = dimension(value, '砖纹尺寸', 1, length);
        const gap = dimension(gapValue, '缝隙', 0, BOARD_WIDTH);
        const current = matchingDivision(length, brick, gap);
        const count = current ? current.count : (length + gap) / (brick + gap);
        return {
            current,
            lower: equalSize(length, gap, Math.floor(count) + 1),
            upper: equalSize(length, gap, Math.ceil(count) - 1),
        };
    }

    function splitAxis(length, brick, gap) {
        const division = matchingDivision(length, brick, gap);
        if (division) {
            const { count, size } = division;
            return {
                bricks: Array.from({ length: count }, (_, index) => ({ start: index * (size + gap), size, full: true })),
                grooves: gap > 0 ? Array.from({ length: count - 1 }, (_, index) => ({ start: index * (size + gap) + size, size: gap })) : [],
                fullCount: count, uniform: true, brickSize: size,
            };
        }
        // Integer millionths preserve manual dimensions without accumulated edge slivers.
        const extent = Math.round(length * PRECISION);
        const size = Math.round(brick * PRECISION);
        const joint = Math.round(gap * PRECISION);
        const bricks = [];
        const grooves = [];
        for (let position = 0; position < extent; position += size + joint) {
            const actualSize = Math.min(size, extent - position);
            bricks.push({ start: position / PRECISION, size: actualSize / PRECISION, full: actualSize === size });
            const grooveStart = position + actualSize;
            if (joint > 0 && grooveStart < extent) {
                grooves.push({ start: grooveStart / PRECISION, size: Math.min(joint, extent - grooveStart) / PRECISION });
            }
        }
        return { bricks, grooves, fullCount: bricks.filter((item) => item.full).length, uniform: false, brickSize: brick };
    }

    function layout({ width, height, gap }) {
        const brickWidth = dimension(width, '小砖宽', 1, BOARD_WIDTH);
        const brickHeight = dimension(height, '小砖高', 1, BOARD_HEIGHT);
        const groove = dimension(gap, '缝隙', 0, BOARD_WIDTH);
        const horizontal = splitAxis(BOARD_WIDTH, brickWidth, groove);
        const vertical = splitAxis(BOARD_HEIGHT, brickHeight, groove);
        const total = horizontal.bricks.length * vertical.bricks.length;
        if (total > MAX_CELLS) {
            throw new Error(`当前排版超过 ${MAX_CELLS} 格，请增大小砖尺寸或缝隙后再生成。`);
        }
        const full = horizontal.fullCount * vertical.fullCount;
        return {
            boardWidth: BOARD_WIDTH, boardHeight: BOARD_HEIGHT,
            brickWidth: horizontal.brickSize, brickHeight: vertical.brickSize, gap: groove,
            horizontal, vertical, total, full, partial: total - full,
        };
    }

    const api = Object.freeze({ BOARD_WIDTH, BOARD_HEIGHT, MAX_CELLS, layout, suggestions });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BrickLayoutCore = api;
}(typeof window !== 'undefined' ? window : globalThis));
