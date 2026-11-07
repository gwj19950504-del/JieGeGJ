(function (root, factory) {
  'use strict';
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root) root.FullBoardCutCopyCore = core;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const LIMITS = Object.freeze({
    maxBoards: 32,
    maxPieces: 2000,
    maxSpecs: 500,
    maxBoardDimension: 10000000,
    maxRasterAxis: 10000,
    maxRasterPixels: 16000000,
    minScale: 0.5,
    preferredScale: 2,
    reportWidth: 1600,
    boardColumns: 2,
    boardWidth: 740,
    boardImageHeight: 600,
    boardListChars: 42,
    warningChars: 90
  });

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function wrapText(value, maxChars) {
    const limit = Number.isSafeInteger(maxChars) && maxChars > 0 ? maxChars : 80;
    const lines = [];
    const paragraphs = String(value == null ? '' : value).split(/\r\n|\r|\n/);
    paragraphs.forEach(function (paragraph) {
      const chars = Array.from(paragraph);
      if (!chars.length) {
        lines.push('');
        return;
      }
      for (let offset = 0; offset < chars.length; offset += limit) {
        lines.push(chars.slice(offset, offset + limit).join(''));
      }
    });
    return lines;
  }

  function invalidLayout(reason) {
    return { ok: false, reason: reason, limits: LIMITS };
  }

  function computeReportLayout(options) {
    const data = options || {};
    const boardCount = Number(data.boardCount);
    const pieceCount = Number(data.pieceCount);
    const specCount = Number(data.specCount);
    const warningLineCount = Number(data.warningLineCount);
    const boardWidth = Number(data.boardWidth);
    const boardHeight = Number(data.boardHeight);
    const listLineCounts = Array.isArray(data.listLineCounts) ? data.listLineCounts : [];

    if (!Number.isSafeInteger(boardCount) || boardCount < 1) return invalidLayout('请先完成有效排版计算。');
    if (boardCount > LIMITS.maxBoards) {
      return invalidLayout('完整整图最多支持 ' + LIMITS.maxBoards + ' 张整板；当前 ' + boardCount + ' 张。请减少本次排版数量后再导出，不会省略板图。');
    }
    if (!Number.isSafeInteger(pieceCount) || pieceCount < 1) return invalidLayout('未找到有效的小板排版结果。');
    if (pieceCount > LIMITS.maxPieces) {
      return invalidLayout('完整整图最多支持 ' + LIMITS.maxPieces + ' 块小板；当前 ' + pieceCount + ' 块。请减少本次排版数量后再导出，不会省略内容。');
    }
    if (!Number.isSafeInteger(specCount) || specCount < 0) return invalidLayout('规格汇总无效，无法生成完整图片。');
    if (specCount > LIMITS.maxSpecs) {
      return invalidLayout('完整整图最多支持 ' + LIMITS.maxSpecs + ' 种规格；当前 ' + specCount + ' 种。请减少规格后再导出，不会省略汇总。');
    }
    if (!Number.isSafeInteger(warningLineCount) || warningLineCount < 1) return invalidLayout('结果说明无效，无法生成完整图片。');
    if (!Number.isFinite(boardWidth) || !Number.isFinite(boardHeight) || boardWidth <= 0 || boardHeight <= 0 ||
        boardWidth > LIMITS.maxBoardDimension || boardHeight > LIMITS.maxBoardDimension) {
      return invalidLayout('整板尺寸超出整图安全范围（单边最多 ' + LIMITS.maxBoardDimension + ' mm），未生成图片。');
    }
    if (listLineCounts.length !== boardCount || listLineCounts.some(function (count) {
      return !Number.isSafeInteger(Number(count)) || Number(count) < 1;
    })) return invalidLayout('整板明细不完整，无法生成完整图片。');

    const margin = 48;
    const columnGap = 24;
    const boardCardWidth = LIMITS.boardWidth;
    const boardImageHeight = LIMITS.boardImageHeight;
    const cardWidth = boardCardWidth;
    const summaryTableTop = 210;
    const summaryHeaderHeight = 32;
    const summaryRowHeight = 32;
    const warningTop = summaryTableTop + summaryHeaderHeight + specCount * summaryRowHeight + 26;
    const summaryHeight = warningTop + warningLineCount * 24 + 24;
    const boardStartY = summaryHeight + 28;
    const rowCount = Math.ceil(boardCount / LIMITS.boardColumns);
    const rowHeights = Array.from({ length: rowCount }, function () { return 0; });
    const cardHeights = listLineCounts.map(function (count) {
      return 48 + boardImageHeight + Number(count) * 28 + 24;
    });
    cardHeights.forEach(function (height, index) {
      const row = Math.floor(index / LIMITS.boardColumns);
      rowHeights[row] = Math.max(rowHeights[row], height);
    });

    const width = LIMITS.reportWidth;
    const cells = [];
    let currentY = boardStartY;
    for (let row = 0; row < rowCount; row += 1) {
      const firstIndex = row * LIMITS.boardColumns;
      const boardsInRow = Math.min(LIMITS.boardColumns, boardCount - firstIndex);
      for (let column = 0; column < boardsInRow; column += 1) {
        const index = row * LIMITS.boardColumns + column;
        const x = boardsInRow === 1 ? (width - cardWidth) / 2 : margin + column * (cardWidth + columnGap);
        cells.push({
          index: index,
          row: row,
          column: column,
          x: x,
          y: currentY,
          width: cardWidth,
          height: cardHeights[index],
          imageX: x + 16,
          imageY: currentY + 48,
          imageWidth: cardWidth - 32,
          imageHeight: boardImageHeight,
          listY: currentY + 48 + boardImageHeight + 24
        });
      }
      currentY += rowHeights[row] + columnGap;
    }

    const height = Math.ceil(currentY - columnGap + margin);
    const wantedScale = Math.min(
      LIMITS.preferredScale,
      LIMITS.maxRasterAxis / width,
      LIMITS.maxRasterAxis / height,
      Math.sqrt(LIMITS.maxRasterPixels / (width * height))
    );
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(wantedScale) || wantedScale < LIMITS.minScale) {
      return invalidLayout('完整整图超过 PNG 安全尺寸（' + LIMITS.maxRasterAxis + 'px/边、' + LIMITS.maxRasterPixels +
        ' 像素）；未裁切或遗漏内容，请减少整板/明细后重试。');
    }

    let scale = wantedScale;
    let pixelWidth = Math.ceil(width * scale);
    let pixelHeight = Math.ceil(height * scale);
    while ((pixelWidth > LIMITS.maxRasterAxis || pixelHeight > LIMITS.maxRasterAxis ||
        pixelWidth * pixelHeight > LIMITS.maxRasterPixels) && scale > 0) {
      scale *= 0.999;
      pixelWidth = Math.ceil(width * scale);
      pixelHeight = Math.ceil(height * scale);
    }
    if (scale < LIMITS.minScale || pixelWidth < 1 || pixelHeight < 1) {
      return invalidLayout('完整整图超过 PNG 安全尺寸；未裁切或遗漏内容，请减少整板/明细后重试。');
    }

    return {
      ok: true,
      width: width,
      height: height,
      scale: scale,
      pixelWidth: pixelWidth,
      pixelHeight: pixelHeight,
      boardCount: boardCount,
      pieceCount: pieceCount,
      specCount: specCount,
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      summaryTableTop: summaryTableTop,
      summaryHeaderHeight: summaryHeaderHeight,
      summaryRowHeight: summaryRowHeight,
      warningTop: warningTop,
      summaryHeight: summaryHeight,
      boardStartY: boardStartY,
      cardWidth: cardWidth,
      rowHeights: rowHeights,
      cells: cells,
      limits: LIMITS
    };
  }

  function textElement(value, x, y, size, color, weight, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Microsoft YaHei,Arial,sans-serif" font-size="' +
      size + '" fill="' + escapeXml(color || '#1a1c1f') + '" font-weight="' + escapeXml(weight || 400) +
      '" text-anchor="' + escapeXml(anchor || 'start') + '">' + escapeXml(value) + '</text>';
  }

  function createSvgMarkup(report, layout, watermarkSource, watermarkHeightOverWidth) {
    if (!report || !layout || !layout.ok) throw new Error('没有可导出的完整排版结果');
    if (!watermarkSource) throw new Error('原版水印未载入，请刷新后重试');
    if (!Array.isArray(report.boards) || report.boards.length !== layout.boardCount ||
        report.boards.some(function (board) { return !board.svgMarkup; })) {
      throw new Error('整板图不完整，已取消导出');
    }
    if (!Array.isArray(report.summary.metrics) || report.summary.metrics.length !== 4 ||
        !Array.isArray(report.summary.headers) || !Array.isArray(report.summary.rows) ||
        report.summary.rows.length !== layout.specCount ||
        !Array.isArray(report.summary.warningLines) || report.summary.warningLines.length < 1) {
      throw new Error('汇总内容不完整，已取消导出');
    }
    const ratio = Number(watermarkHeightOverWidth);
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('原版水印比例无效，已取消导出');

    const parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + layout.width + '" height="' + layout.height +
        '" viewBox="0 0 ' + layout.width + ' ' + layout.height + '">',
      '<rect x="0" y="0" width="' + layout.width + '" height="' + layout.height + '" fill="#ffffff"/>',
      textElement('整板切割排版结果', 48, 54, 30, '#1a1c1f', 750),
      textElement('完整结果 · ' + layout.boardCount + ' 张整板 · 原版 M·M 透明水印', 48, 82, 16, '#5b6168', 400)
    ];

    const metricGap = 12;
    const metricWidth = (layout.width - 96 - metricGap * 3) / 4;
    report.summary.metrics.forEach(function (metric, index) {
      const x = 48 + index * (metricWidth + metricGap);
      parts.push('<rect x="' + x + '" y="106" width="' + metricWidth + '" height="78" rx="12" fill="#f7f8fa" stroke="#e5e8eb"/>');
      parts.push(textElement(metric.label, x + 14, 136, 14, '#66707a', 500));
      parts.push(textElement(metric.value, x + 14, 168, 25, '#1a1c1f', 750));
    });

    const tableX = 48;
    const tableY = layout.summaryTableTop;
    const tableWidths = [layout.width * 0.34, layout.width * 0.20, layout.width * 0.46 - 96];
    const tableXPositions = [tableX, tableX + tableWidths[0], tableX + tableWidths[0] + tableWidths[1]];
    parts.push('<rect x="' + tableX + '" y="' + tableY + '" width="' + (layout.width - 96) + '" height="' +
      layout.summaryHeaderHeight + '" fill="#f2f4f6" stroke="#e2e5e8"/>');
    report.summary.headers.forEach(function (header, index) {
      parts.push(textElement(header, tableXPositions[index] + 10, tableY + 22, 14, '#30363b', 700));
    });
    report.summary.rows.forEach(function (row, rowIndex) {
      const y = tableY + layout.summaryHeaderHeight + rowIndex * layout.summaryRowHeight;
      parts.push('<rect x="' + tableX + '" y="' + y + '" width="' + (layout.width - 96) + '" height="' +
        layout.summaryRowHeight + '" fill="' + (rowIndex % 2 ? '#ffffff' : '#fbfcfd') + '" stroke="#e6e8eb"/>');
      row.forEach(function (value, columnIndex) {
        parts.push(textElement(value, tableXPositions[columnIndex] + 10, y + 21, 14, '#30363b', 400));
      });
    });
    report.summary.warningLines.forEach(function (line, index) {
      parts.push(textElement(line, 50, layout.warningTop + 20 + index * 24, 14, '#7a4b00', 400));
    });

    report.boards.forEach(function (board, index) {
      const cell = layout.cells[index];
      const listLines = Array.isArray(board.listLines) ? board.listLines : [];
      parts.push('<rect x="' + cell.x + '" y="' + cell.y + '" width="' + cell.width + '" height="' +
        cell.height + '" rx="14" fill="#ffffff" stroke="#dce1e5"/>');
      parts.push(textElement(board.title, cell.x + 16, cell.y + 30, 17, '#1a1c1f', 700));
      parts.push(textElement(board.usage, cell.x + cell.width - 16, cell.y + 30, 16, '#1a1c1f', 700, 'end'));
      parts.push('<svg x="' + cell.imageX + '" y="' + cell.imageY + '" width="' + cell.imageWidth +
        '" height="' + cell.imageHeight + '" viewBox="0 0 ' + board.width + ' ' + board.height +
        '" preserveAspectRatio="xMidYMid meet">' + board.svgMarkup +
        '<defs><clipPath id="board-watermark-' + index + '" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="' +
        board.width + '" height="' + board.height + '"/></clipPath></defs>' +
        '<g clip-path="url(#board-watermark-' + index + ')"><image href="' + escapeXml(watermarkSource) +
        '" x="0" y="' + ((board.height - board.width * ratio) / 2) + '" width="' + board.width +
        '" height="' + (board.width * ratio) + '" opacity=".82" preserveAspectRatio="none"/></g></svg>');
      listLines.forEach(function (line, lineIndex) {
        parts.push(textElement(line, cell.x + 16, cell.listY + lineIndex * 24, 14, '#333333', 400));
      });
    });
    parts.push('</svg>');
    return parts.join('');
  }

  return Object.freeze({
    LIMITS: LIMITS,
    escapeXml: escapeXml,
    wrapText: wrapText,
    computeReportLayout: computeReportLayout,
    createSvgMarkup: createSvgMarkup
  });
}));

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) return;

  const core = window.FullBoardCutCopyCore;
  const copyButton = document.getElementById('copyFullBoardImage');
  const status = document.getElementById('copyFullBoardStatus');
  const summaryElement = document.getElementById('summary');
  const boardsElement = document.getElementById('boards');
  let busy = false;

  function unavailable(reason) {
    return { ok: false, reason: reason };
  }

  function svgDimensions(svg) {
    const raw = svg && svg.getAttribute('viewBox');
    const values = raw ? raw.trim().split(/[\s,]+/).map(Number) : [];
    if (values.length !== 4) return null;
    return { width: values[2], height: values[3] };
  }

  function collectReport() {
    if (!summaryElement || !boardsElement) return null;
    const metricElements = Array.from(summaryElement.querySelectorAll('.metric'));
    const boardElements = Array.from(boardsElement.querySelectorAll('.boardBox'));
    if (metricElements.length !== 4 || boardElements.length < 1) return null;

    const table = summaryElement.querySelector('.table');
    const headers = table ? Array.from(table.querySelectorAll('thead th')).map(function (node) {
      return node.textContent.trim();
    }) : [];
    const rows = table ? Array.from(table.querySelectorAll('tbody tr')).map(function (tr) {
      return Array.from(tr.querySelectorAll('td')).map(function (cell) { return cell.textContent.trim(); });
    }) : [];
    const warning = summaryElement.querySelector('.warn');
    const warningText = warning ? (warning.innerText || warning.textContent || '') : '';
    const warningLines = core.wrapText(warningText.replace(/\s+/g, ' ').trim(), core.LIMITS.warningChars);
    const metrics = metricElements.map(function (node) {
      return {
        label: (node.querySelector('.name') || {}).textContent.trim(),
        value: (node.querySelector('.num') || {}).textContent.trim()
      };
    });

    let pieceCount = 0;
    const boards = boardElements.map(function (box) {
      const titleNodes = Array.from(box.querySelectorAll('.boardTitle span'));
      const sourceSvg = box.querySelector('svg');
      const dimensions = svgDimensions(sourceSvg);
      if (!dimensions || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)) {
        throw new Error('某张整板图尺寸无效，已取消完整导出');
      }
      const rectCount = sourceSvg.querySelectorAll('rect').length;
      pieceCount += Math.max(0, rectCount - 1);
      const list = box.querySelector('.list');
      const serializer = new XMLSerializer();
      return {
        title: titleNodes[0] ? titleNodes[0].textContent.trim() : '',
        usage: titleNodes[1] ? titleNodes[1].textContent.trim() : '',
        listLines: core.wrapText(list ? list.textContent.trim() : '', core.LIMITS.boardListChars),
        width: dimensions.width,
        height: dimensions.height,
        svgMarkup: Array.from(sourceSvg.childNodes).map(function (node) {
          return serializer.serializeToString(node);
        }).join('')
      };
    });
    const boardSize = boards[0];
    return {
      summary: { metrics: metrics, headers: headers, rows: rows, warningLines: warningLines },
      boards: boards,
      boardWidth: boardSize.width,
      boardHeight: boardSize.height,
      pieceCount: pieceCount
    };
  }

  function analyze() {
    try {
      const report = collectReport();
      if (!report) return { ok: false, reason: '请先完成有效排版计算。' };
      const layout = core.computeReportLayout({
        boardCount: report.boards.length,
        pieceCount: report.pieceCount,
        specCount: report.summary.rows.length,
        warningLineCount: report.summary.warningLines.length,
        listLineCounts: report.boards.map(function (board) { return Math.max(1, board.listLines.length); }),
        boardWidth: report.boardWidth,
        boardHeight: report.boardHeight
      });
      return { ok: layout.ok, reason: layout.reason || '', report: report, layout: layout };
    } catch (error) {
      return { ok: false, reason: error.message || '整图内容检查失败。' };
    }
  }

  function updateAvailability(preserveStatus) {
    const result = analyze();
    copyButton.disabled = busy || !result.ok;
    copyButton.title = result.ok ? '复制包含全部整板与汇总的 PNG 整图' : result.reason;
    if (!busy && !preserveStatus) status.textContent = result.ok ? '可复制完整排版图；包含全部整板、利用率、规格摘要和原版 M·M 水印。' : result.reason;
    return result;
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('图片解码失败')); };
      image.src = url;
    });
  }

  async function createFullImage() {
    const analysis = analyze();
    if (!analysis.ok) throw new Error(analysis.reason);
    if (!window.JieGeWatermarkSource) throw new Error('原版水印未载入，请刷新后重试');

    const watermark = await loadImage(window.JieGeWatermarkSource);
    if (!watermark.naturalWidth || !watermark.naturalHeight) throw new Error('原版水印图片无效，已取消导出');
    const svgMarkup = core.createSvgMarkup(
      analysis.report,
      analysis.layout,
      window.JieGeWatermarkSource,
      watermark.naturalHeight / watermark.naturalWidth
    );
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = await loadImage(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = analysis.layout.pixelWidth;
      canvas.height = analysis.layout.pixelHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建图片画布');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (png) {
          if (png) resolve(png);
          else reject(new Error('PNG 编码失败'));
        }, 'image/png');
      });
      return {
        blob: blob,
        width: canvas.width,
        height: canvas.height,
        boards: analysis.report.boards.length,
        format: 'image/png'
      };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }
  }

  async function exportFullImage() {
    if (busy) return { ok: false, error: '整图正在生成，请稍候。' };
    const current = updateAvailability();
    if (!current.ok) return { ok: false, error: current.reason };

    busy = true;
    copyButton.disabled = true;
    status.textContent = '正在生成包含全部排版结果的 PNG…';
    try {
      const imagePromise = createFullImage();
      let pendingClipboardWrite = null;
      let clipboardFailure = null;
      const canWriteImage = navigator.clipboard && typeof navigator.clipboard.write === 'function' &&
        typeof window.ClipboardItem === 'function';

      if (canWriteImage) {
        try {
          const pngPromise = imagePromise.then(function (image) { return image.blob; });
          pngPromise.catch(function () {});
          const item = new window.ClipboardItem({ 'image/png': pngPromise });
          pendingClipboardWrite = Promise.resolve(navigator.clipboard.write([item])).then(
            function () { return { ok: true }; },
            function (error) { return { ok: false, error: error }; }
          );
        } catch (error) {
          clipboardFailure = error;
        }
      }

      let image;
      try {
        image = await imagePromise;
      } catch (error) {
        if (pendingClipboardWrite) await pendingClipboardWrite;
        throw error;
      }
      const result = Object.assign({ ok: true, copied: false, downloaded: false, reason: '' }, image);
      if (pendingClipboardWrite) {
        const writeResult = await pendingClipboardWrite;
        if (writeResult.ok) {
          result.copied = true;
          status.textContent = '完整整图已复制，包含全部整板、尺寸摘要及原版 M·M 水印。';
          return result;
        }
        clipboardFailure = writeResult.error;
      }

      if (canWriteImage || clipboardFailure) {
        result.reason = clipboardFailure && clipboardFailure.name === 'NotAllowedError' ? 'rejected' : 'write-failed';
        result.clipboardError = clipboardFailure && clipboardFailure.name ? clipboardFailure.name : 'UnknownError';
      } else {
        result.reason = 'unsupported';
      }

      downloadBlob(image.blob, '整板切割完整排版.png');
      result.downloaded = true;
      if (result.reason === 'unsupported') {
        status.textContent = '此浏览器不支持图片剪贴板写入；已触发完整 PNG 下载，请使用下载的 PNG。';
      } else if (result.reason === 'rejected') {
        status.textContent = '浏览器拒绝剪贴板写入（' + result.clipboardError + '）；已触发完整 PNG 下载，请使用下载的 PNG。';
      } else {
        status.textContent = '剪贴板写入失败（' + result.clipboardError + '）；已触发完整 PNG 下载，请使用下载的 PNG。';
      }
      return result;
    } catch (error) {
      status.textContent = '整图生成或下载失败：' + (error.message || '未知错误') + '。没有复制成功。';
      return { ok: false, error: error.message || '整图生成失败' };
    } finally {
      busy = false;
      updateAvailability(true);
    }
  }

  copyButton.addEventListener('click', exportFullImage);
  const observer = new MutationObserver(function () { updateAvailability(); });
  observer.observe(summaryElement, { childList: true, subtree: true, characterData: true });
  observer.observe(boardsElement, { childList: true, subtree: true, characterData: true });

  window.FullBoardCutCopy = Object.freeze({
    createFullImage: createFullImage,
    exportFullImage: exportFullImage,
    updateAvailability: updateAvailability
  });
  updateAvailability();
}());
