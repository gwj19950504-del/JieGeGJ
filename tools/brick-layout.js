(function () {
    'use strict';

    const core = window.BrickLayoutCore;
    const fields = ['brickWidth', 'brickHeight', 'brickGap'].map((id) => document.getElementById(id));
    const drawing = document.getElementById('brickDrawing');
    const errorBox = document.getElementById('brickError');
    const status = document.getElementById('exportStatus');
    const exportButtons = ['copyBrick', 'saveBrickPng', 'saveBrickSvg'].map((id) => document.getElementById(id));
    let currentLayout = null;
    let busy = false;
    let texture = '';

    function format(value) {
        return String(Math.round(value * 10) / 10);
    }

    function hash(x, y, seed = 17) {
        const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
        return value - Math.floor(value);
    }

    function noise(x, y, period) {
        const column = Math.floor(x);
        const row = Math.floor(y);
        const horizontal = x - column;
        const vertical = y - row;
        const smoothX = horizontal * horizontal * (3 - 2 * horizontal);
        const smoothY = vertical * vertical * (3 - 2 * vertical);
        const top = hash(column % period, row % period) * (1 - smoothX)
            + hash((column + 1) % period, row % period) * smoothX;
        const bottom = hash(column % period, (row + 1) % period) * (1 - smoothX)
            + hash((column + 1) % period, (row + 1) % period) * smoothX;
        return top * (1 - smoothY) + bottom * smoothY;
    }

    function cementTexture() {
        if (texture) return texture;
        // Seamless, deterministic mineral grain: no network assets or photos containing perspective/shadows.
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d');
        const pixels = context.createImageData(256, 256);
        for (let row = 0; row < 256; row++) {
            for (let column = 0; column < 256; column++) {
                const grain = (noise(column / 32, row / 32, 8) - 0.5) * 14
                    + (noise(column / 8, row / 8, 32) - 0.5) * 20
                    + (noise(column / 2, row / 2, 128) - 0.5) * 26
                    + (hash(column, row, 39) - 0.5) * 26;
                const pore = hash(column, row, 57) < 0.055 ? -24 : 0;
                const offset = (row * 256 + column) * 4;
                [166, 164, 158].forEach((base, channel) => { pixels.data[offset + channel] = base + grain + pore; });
                pixels.data[offset + 3] = 255;
            }
        }
        context.putImageData(pixels, 0, 0);
        texture = canvas.toDataURL('image/png');
        return texture;
    }

    function text(x, y, content, size = 18, attributes = '') {
        return `<text x="${x}" y="${y}" font-size="${size}" ${attributes}>${content}</text>`;
    }

    function horizontalDimension(start, end, y, anchorY, label, labelY = y - 10) {
        const narrow = end - start < 32;
        return `<g fill="none" stroke="#303333" stroke-width="1.1">
            <path d="M${start} ${anchorY}V${y + 8}M${end} ${anchorY}V${y + 8}"/>
            ${narrow
                ? `<path d="M${start - 22} ${y}H${start}" marker-end="url(#arrow)"/><path d="M${end + 22} ${y}H${end}" marker-end="url(#arrow)"/>`
                : `<path d="M${start} ${y}H${end}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`}
            </g>${text((start + end) / 2, labelY, label, 17, 'text-anchor="middle"')}`;
    }

    function verticalDimension(start, end, x, anchorX, label) {
        return `<g fill="none" stroke="#303333" stroke-width="1.1">
            <path d="M${anchorX} ${start}H${x - 8}M${anchorX} ${end}H${x - 8}"/>
            <path d="M${x} ${start}V${end}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
            </g>${text(x - 12, (start + end) / 2, label, 17,
                `text-anchor="middle" transform="rotate(-90 ${x - 12} ${(start + end) / 2})"`)}`;
    }

    function boardMarkup(data, width = data.boardWidth, height = data.boardHeight) {
        const elements = [`<rect width="${width}" height="${height}" fill="url(#cementGrain)"/>`];
        for (const [row, vertical] of data.vertical.bricks.entries()) {
            if (vertical.start >= height) break;
            for (const [column, horizontal] of data.horizontal.bricks.entries()) {
                if (horizontal.start >= width) break;
                const brickWidth = Math.min(horizontal.size, width - horizontal.start);
                const brickHeight = Math.min(vertical.size, height - vertical.start);
                const tone = hash(column, row, 21);
                elements.push(`<rect x="${horizontal.start}" y="${vertical.start}" width="${brickWidth}" height="${brickHeight}"
                    fill="${tone > 0.5 ? '#fff' : '#232724'}" opacity="${Math.abs(tone - 0.5) * 0.065}"/>`);
            }
        }
        if (data.gap > 0) {
            for (const groove of data.horizontal.grooves) {
                if (groove.start >= width) break;
                elements.push(`<rect x="${groove.start}" width="${Math.min(groove.size, width - groove.start)}" height="${height}" fill="url(#verticalGroove)"/>`);
            }
            for (const groove of data.vertical.grooves) {
                if (groove.start >= height) break;
                elements.push(`<rect y="${groove.start}" height="${Math.min(groove.size, height - groove.start)}" width="${width}" fill="url(#horizontalGroove)"/>`);
            }
        }
        return elements.join('');
    }

    function edgeDescription(axis, extent, edgeName) {
        const last = axis.bricks.at(-1);
        const groove = axis.grooves.at(-1);
        if (groove && Math.abs(groove.start + groove.size - extent) < 0.01) {
            return `${edgeName}落在槽内 · 槽宽 ${format(groove.size)} mm`;
        }
        return last.full ? `${edgeName}为完整砖纹` : `${edgeName}收边 ${format(last.size)} mm`;
    }

    function makeSvg(data) {
        const x = 108;
        const y = 148;
        const scale = 0.4;
        const width = data.boardWidth * scale;
        const height = data.boardHeight * scale;
        const detailWidth = Math.min(data.boardWidth, data.brickWidth * 2 + data.gap);
        const detailHeight = Math.min(data.boardHeight, data.brickHeight + data.gap + Math.min(data.brickHeight * 0.16, 28));
        const zoom = Math.min(276 / detailWidth, 380 / detailHeight);
        const detailX = 704;
        const detailY = 254;
        const renderedWidth = detailWidth * zoom;
        const renderedHeight = detailHeight * zoom;
        const verticalGap = data.horizontal.grooves[0];
        const horizontalGap = data.vertical.grooves[0];
        let gapAnnotation = text(detailX, detailY + renderedHeight + 55, '缝隙 0 mm · 不留槽', 16);
        if (verticalGap) {
            gapAnnotation = horizontalDimension(detailX + verticalGap.start * zoom,
                detailX + (verticalGap.start + verticalGap.size) * zoom,
                detailY + renderedHeight + 25, detailY + renderedHeight + 4,
                `缝隙 ${format(verticalGap.size)} mm`, detailY + renderedHeight + 51);
        } else if (horizontalGap) {
            gapAnnotation = `<path d="M${detailX + renderedWidth / 2} ${detailY + (horizontalGap.start + horizontalGap.size / 2) * zoom}L${detailX + renderedWidth + 18} ${detailY + renderedHeight + 32}" stroke="#303333" fill="none"/>
                ${text(detailX, detailY + renderedHeight + 56, `缝隙 ${format(horizontalGap.size)} mm`, 16)}`;
        } else if (data.gap > 0) {
            gapAnnotation = text(detailX, detailY + renderedHeight + 55, '单格覆盖整板 · 板内无缝', 16);
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1310" viewBox="0 0 1100 1310" role="img" aria-labelledby="brickSvgTitle brickSvgDesc">
          <title id="brickSvgTitle">砖纹排版：整板1220×2440mm，小砖${format(data.brickWidth)}×${format(data.brickHeight)}mm，缝隙${format(data.gap)}mm</title>
          <desc id="brickSvgDesc">对齐直缝，从左上角起排。${edgeDescription(data.horizontal, data.boardWidth, '右侧')}；${edgeDescription(data.vertical, data.boardHeight, '底部')}。右侧含局部放大和尺寸标注。</desc>
          <defs>
            <pattern id="cementGrain" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${cementTexture()}" width="128" height="128" preserveAspectRatio="none"/></pattern>
            <linearGradient id="verticalGroove"><stop stop-color="#64665e"/><stop offset=".25" stop-color="#74776d"/><stop offset=".7" stop-color="#aaa99c"/><stop offset="1" stop-color="#deddd3"/></linearGradient>
            <linearGradient id="horizontalGroove" x2="0" y2="1"><stop stop-color="#64665e"/><stop offset=".25" stop-color="#74776d"/><stop offset=".7" stop-color="#aaa99c"/><stop offset="1" stop-color="#deddd3"/></linearGradient>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 5L0 0V10Z" fill="#303333"/></marker>
          </defs>
          <rect width="1100" height="1310" fill="#fff"/>
          <g fill="#232627" font-family="-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif">
            ${text(x, 53, '水泥板 · 砖纹排版', 28, 'font-weight="600"')}
            ${text(x, 86, `小砖 ${format(data.brickWidth)} × ${format(data.brickHeight)} mm　|　缝隙 ${format(data.gap)} mm　|　对齐直缝`, 17)}
            <rect x="${x + 3}" y="${y + 4}" width="${width}" height="${height}" fill="#000" opacity=".08"/>
            <g data-board="full" transform="translate(${x} ${y}) scale(${scale})">${boardMarkup(data)}</g>
            <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#72766e" stroke-width="1"/>
            ${horizontalDimension(x, x + width, y - 22, y - 6, '整板宽 1220 mm')}
            ${verticalDimension(y, y + height, x - 35, x - 6, '整板高 2440 mm')}
            ${text(detailX, 168, '砖面与凹槽 · 局部放大', 22, 'font-weight="600"')}
            ${text(detailX, 198, '标注为净尺寸，砖面不含缝隙', 15)}
            <g data-board="detail" transform="translate(${detailX} ${detailY}) scale(${zoom})">${boardMarkup(data, detailWidth, detailHeight)}</g>
            <rect x="${detailX}" y="${detailY}" width="${renderedWidth}" height="${renderedHeight}" fill="none" stroke="#72766e" stroke-width=".8"/>
            ${horizontalDimension(detailX, detailX + data.brickWidth * zoom, detailY - 18, detailY - 4, `宽 ${format(data.brickWidth)} mm`)}
            ${verticalDimension(detailY, detailY + data.brickHeight * zoom, detailX + renderedWidth + 32, detailX + renderedWidth + 4, `高 ${format(data.brickHeight)} mm`)}
            ${gapAnnotation}
            ${text(detailX, 800, '排版与收边', 22, 'font-weight="600"')}
            ${text(detailX, 838, `${data.horizontal.bricks.length} 列 × ${data.vertical.bricks.length} 行 · 共 ${data.total} 格`, 17)}
            ${text(detailX, 870, `完整砖纹 ${data.full} 格 · 收边砖纹 ${data.partial} 格`, 16)}
            ${text(detailX, 920, edgeDescription(data.horizontal, data.boardWidth, '右侧'), 16)}
            ${text(detailX, 952, edgeDescription(data.vertical, data.boardHeight, '底部'), 16)}
            ${text(detailX, 1006, '整板固定；末端按实际余量收边。', 15)}
            ${text(detailX, 1036, '水泥质感及槽内阴影为效果示意，', 15)}
            ${text(detailX, 1064, '槽深未设定，颜色与槽型以实物为准。', 15)}
            ${text(x, 1170, '整板正视图 · 1220 × 2440 mm', 19, 'font-weight="600"')}
            ${text(x, 1203, `砖纹净尺寸 ${format(data.brickWidth)} × ${format(data.brickHeight)} mm　|　横竖缝 ${format(data.gap)} mm`, 17)}
            <path d="M${x} 1230H1000" stroke="#dddde2"/>
            ${text(x, 1262, '按实际尺寸绘制 · 整板四周不另加边框 · 不足一格不拉伸', 16)}
          </g>
        </svg>`;
    }

    function update() {
        status.textContent = '';
        fields.forEach((field) => field.removeAttribute('aria-invalid'));
        try {
            fields.forEach((field) => {
                if (!field.checkValidity()) field.setAttribute('aria-invalid', 'true');
            });
            currentLayout = core.layout({ width: fields[0].value, height: fields[1].value, gap: fields[2].value });
            drawing.innerHTML = makeSvg(currentLayout);
            const data = currentLayout;
            document.getElementById('brickSummary').innerHTML = [
                ['排版', `${data.horizontal.bricks.length} 列 × ${data.vertical.bricks.length} 行`],
                ['完整 / 收边', `${data.full} / ${data.partial} 格`],
                ['右侧', edgeDescription(data.horizontal, data.boardWidth, '').trim()],
                ['底部', edgeDescription(data.vertical, data.boardHeight, '').trim()],
            ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
            errorBox.hidden = true;
            document.getElementById('brickEmpty').hidden = true;
        } catch (error) {
            currentLayout = null;
            drawing.replaceChildren();
            document.getElementById('brickSummary').replaceChildren();
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            document.getElementById('brickEmpty').hidden = false;
        }
        exportButtons.forEach((button) => { button.disabled = !currentLayout || busy; });
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    async function pngBlob(svg) {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = 2200;
            canvas.height = 2620;
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            return await new Promise((resolve, reject) => canvas.toBlob((png) => {
                if (png) resolve(png);
                else reject(new Error('图片生成失败'));
            }, 'image/png'));
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    async function exportDrawing(kind) {
        if (!currentLayout || busy) return;
        const svg = new XMLSerializer().serializeToString(drawing.querySelector('svg'));
        const filename = `砖纹排版-1220x2440-砖${format(currentLayout.brickWidth)}x${format(currentLayout.brickHeight)}-缝${format(currentLayout.gap)}`;
        busy = true;
        [...exportButtons, ...fields, document.getElementById('swapBrick'), document.getElementById('resetBrick')]
            .forEach((control) => { control.disabled = true; });
        status.textContent = '正在生成图片…';
        try {
            if (kind === 'svg') {
                saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
                status.textContent = 'SVG 已导出，包含材质与尺寸标注。';
            } else if (kind === 'copy' && navigator.clipboard?.write && window.ClipboardItem) {
                const imagePromise = pngBlob(svg);
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagePromise })]);
                    status.textContent = '图片已复制，可直接粘贴发送。';
                } catch (error) {
                    saveBlob(await imagePromise, `${filename}.png`);
                    status.textContent = '浏览器未允许复制，已改为下载 PNG。';
                }
            } else {
                saveBlob(await pngBlob(svg), `${filename}.png`);
                status.textContent = kind === 'copy' ? '此浏览器不支持图片复制，已下载 PNG。' : 'PNG 已下载，包含整板、局部与尺寸。';
            }
        } catch (error) {
            status.textContent = `导出失败，请重试：${error.message}`;
        } finally {
            busy = false;
            [...exportButtons, ...fields, document.getElementById('swapBrick'), document.getElementById('resetBrick')]
                .forEach((control) => { control.disabled = false; });
        }
    }

    document.getElementById('brickForm').addEventListener('submit', (event) => event.preventDefault());
    fields.forEach((field) => field.addEventListener('input', update));
    document.addEventListener('wheel', (event) => {
        if (fields.includes(document.activeElement)) {
            document.activeElement.blur();
            event.preventDefault();
        }
    }, { passive: false, capture: true });
    document.getElementById('swapBrick').addEventListener('click', () => {
        const previousWidth = fields[0].value;
        fields[0].value = fields[1].value;
        fields[1].value = previousWidth;
        update();
    });
    document.getElementById('resetBrick').addEventListener('click', () => {
        [60, 240, 5].forEach((value, index) => { fields[index].value = value; });
        update();
    });
    exportButtons.forEach((button, index) => button.addEventListener('click', () => exportDrawing(['copy', 'png', 'svg'][index])));
    update();
}());
