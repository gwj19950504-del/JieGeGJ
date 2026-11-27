(function (root) {
  'use strict';

  const MAX_FILE_BYTES = 24 * 1024 * 1024;
  const MAX_PIXELS = 24_000_000;
  const MAX_DIMENSION = 12_000;
  const DARK_LUMA = 190;
  const LOW_CONFIDENCE = 75;
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function makeAbortError(message) {
    const error = new Error(message || '导入已取消。');
    error.name = 'AbortError';
    return error;
  }

  function emit(progress, stage, percent, message) {
    if (!progress) return;
    const event = { stage, percent, message };
    if (typeof progress === 'function') {
      if (progress(event) === false) throw makeAbortError('进度回调已取消导入。');
    } else if (typeof progress.onProgress === 'function') {
      if (progress.onProgress(event) === false) throw makeAbortError('进度回调已取消导入。');
    }
  }

  function checkAbort(progress) {
    const signal = progress && (progress.signal || progress.abortSignal);
    if (signal && signal.aborted) throw makeAbortError();
  }

  function fileTypeAllowed(file) {
    const type = String(file && file.type || '').toLowerCase();
    const name = String(file && file.name || '').toLowerCase();
    return type === 'image/png' || type === 'image/jpeg' || type === 'image/webp' || /\.(png|jpe?g|webp)$/.test(name);
  }

  function createCanvas(width, height) {
    let canvas;
    if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    throw new Error('当前环境不支持 Canvas，无法读取本地报价图片。');
  }

  async function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file, { imageOrientation: 'from-image' });
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      throw new Error('当前浏览器不支持安全地读取本地图片。');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('图片无法解码，请换用完整的 PNG/JPG 文件。'));
        element.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function luma(data, offset) {
    return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
  }

  function isDark(data, offset) {
    return data[offset + 3] > 96 && luma(data, offset) < DARK_LUMA;
  }

  function groupScores(scores, threshold, gap) {
    const groups = [];
    let start = -1;
    let last = -1;
    let total = 0;
    let count = 0;
    const maxGap = gap == null ? 2 : gap;
    for (let index = 0; index < scores.length; index += 1) {
      if (scores[index] >= threshold) {
        if (start < 0) start = index;
        else if (index - last > maxGap + 1) {
          groups.push({ start, end: last, center: count ? total / count : (start + last) / 2 });
          start = index;
          total = 0;
          count = 0;
        }
        last = index;
        total += index * scores[index];
        count += scores[index];
      }
    }
    if (start >= 0) groups.push({ start, end: last, center: count ? total / count : (start + last) / 2 });
    return groups.map((group) => Math.round(group.center));
  }

  function horizontalScores(data, width, height) {
    const scores = new Array(height).fill(0);
    for (let y = 0; y < height; y += 1) {
      let dark = 0;
      let row = y * width * 4;
      for (let x = 0; x < width; x += 1, row += 4) if (isDark(data, row)) dark += 1;
      scores[y] = dark / width;
    }
    return scores;
  }

  function verticalScores(data, width, height, y0, y1) {
    const start = Math.max(0, Math.floor(y0));
    const end = Math.min(height, Math.ceil(y1));
    const span = Math.max(1, end - start);
    const scores = new Array(width).fill(0);
    for (let x = 0; x < width; x += 1) {
      let dark = 0;
      for (let y = start; y < end; y += 1) {
        const offset = (y * width + x) * 4;
        if (isDark(data, offset)) dark += 1;
      }
      scores[x] = dark / span;
    }
    return scores;
  }

  function detectLongLines(data, width, height) {
    const hScores = horizontalScores(data, width, height);
    return {
      horizontal: groupScores(hScores, 0.61, 3),
      horizontalScores: hScores
    };
  }

  function detectColumns(data, width, height, y0, y1) {
    const scores = verticalScores(data, width, height, y0, y1);
    return {
      lines: groupScores(scores, 0.49, 3),
      scores
    };
  }

  function near(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
  }

  function detectTableGeometry(data, width, height) {
    const hLines = detectLongLines(data, width, height).horizontal;
    if (hLines.length < 7) return { ok: false, reason: `只检测到 ${hLines.length} 条横向网格线，无法定位标题、三行抬头、表头和金额行。`, hLines };
    const frameTolerance = Math.max(4, height * 0.015);
    if (hLines[0] > frameTolerance) return { ok: false, reason: '图片顶部缺少报价表外框，可能标题区已裁切。', hLines };
    const titleTop = hLines[0], titleBottom = hLines[1];
    const headerTop = hLines[4], headerBottom = hLines[5];
    if (!(titleTop < titleBottom && titleBottom < hLines[2] && hLines[2] < hLines[3]
      && hLines[3] < headerTop && headerTop < headerBottom)) {
      return { ok: false, reason: '顶部网格不符合“标题＋三行抬头＋两行表头”结构，图片可能裁切或模板不匹配。', hLines };
    }

    const firstBodyLine = 5;
    const rowProfiles = [];
    const columnTolerance = Math.max(6, width * 0.018);
    for (let index = firstBodyLine; index < hLines.length - 1; index += 1) {
      const y0 = hLines[index], y1 = hLines[index + 1];
      if (y1 - y0 < Math.max(8, height * 0.004)) continue;
      rowProfiles[index] = detectColumns(data, width, height, y0 + 2, y1 - 2).lines;
    }

    // Fee rows have a stable 13-boundary profile. Product photos can add extra
    // rules; seed from the last exact-13 row and keep all canonical rules present.
    const seeds = [];
    for (let index = firstBodyLine; index < rowProfiles.length; index += 1) {
      const profile = rowProfiles[index];
      if (profile && profile.length === 13 && profile[0] <= width * 0.015 && profile[12] >= width * 0.985) {
        seeds.push({ index, profile });
      }
    }
    const seed = seeds[seeds.length - 1];
    if (!seed) return { ok: false, reason: '费用区未检测到稳定的 12 列竖线；无法从实拍缩略图边缘可靠区分列界。', hLines };
    const columns = seed.profile.slice();
    columns[0] = 0;
    columns[12] = width;
    const expectedMerged = [columns[0], columns[10], columns[11], columns[12]];
    const matchesColumns = (profile, y0, y1) => {
      if (!profile || profile.length < 11) return false;
      const hasOuterEdges = profile[0] <= width * 0.015 && profile[profile.length - 1] >= width * 0.985;
      if (!hasOuterEdges) return false;
      const missing = columns.map((x, index) => profile.some(candidate => near(x, candidate, columnTolerance)) ? -1 : index)
        .filter(index => index !== -1);
      if (missing.length <= 1) return true;
      // A full-bleed photo can merge both vertical rules into one wide dark band.
      // Check the actual pixels on those two known rules, not the band's midpoint.
      if (missing.length !== 2 || missing[0] !== 5 || missing[1] !== 6) return false;
      return missing.every(index => {
        for (let x = columns[index] - 1; x <= columns[index] + 1; x++) {
          let dark = 0;
          for (let y = y0 + 2; y < y1 - 2; y++) if (isDark(data, (y * width + x) * 4)) dark++;
          if (dark >= (y1 - y0 - 4) * 0.85) return true;
        }
        return false;
      });
    };
    const matchesMerged = (profile) => profile && profile.length >= 3 && profile.length <= 6
      && expectedMerged.every((x) => profile.some((candidate) => near(x, candidate, columnTolerance)));

    const intervals = [], sparseRows = [];
    let sawDense = false;
    for (let index = firstBodyLine; index < rowProfiles.length; index += 1) {
      const profile = rowProfiles[index];
      if (!profile) continue;
      const interval = { y0: hLines[index], y1: hLines[index + 1], lineIndex: index, profile };
      if (matchesColumns(profile, interval.y0, interval.y1)) {
        intervals.push({ ...interval, kind: 'dense' });
        sawDense = true;
      } else if (matchesMerged(profile)) {
        intervals.push({ ...interval, kind: 'merged' });
        sparseRows.push(interval);
      } else if (sparseRows.length) {
        // Order notes/signatures after the final merged amount band no longer
        // share the product grid and must not leak into imported rows.
        break;
      } else if (sawDense) {
        return { ok: false, reason: '产品/费用行网格未包含稳定的12列边界，未生成部分导入。', hLines, columns };
      }
    }
    if (!sparseRows.length) return { ok: false, reason: '未检测到小计/总价合并行（第10/11列分隔），图片可能裁切。', hLines, columns };
    const lastMerged = sparseRows[sparseRows.length - 1];
    const tableIntervals = intervals.filter((item) => item.y0 < lastMerged.y1);
    if (!tableIntervals.some((item) => item.kind === 'dense')) return { ok: false, reason: '产品/费用区为空，未找到可导入行。', hLines, columns };
    return {
      ok: true, hLines, columns, intervals: tableIntervals, sparseRows,
      body: tableIntervals.filter((item) => item.kind === 'dense'),
      totalCandidates: sparseRows, titleTop, titleBottom, headerTop, headerBottom, columnTolerance
    };
  }

  function nearestLine(lines, y, direction) {
    let selected = null;
    for (const line of lines) {
      if (direction === 'before' && line > y) break;
      if (direction === 'after' && line < y) continue;
      if (selected == null || Math.abs(line - y) < Math.abs(selected - y)) selected = line;
    }
    return selected;
  }

  function textOf(word) {
    return String(word && word.text != null ? word.text : '').trim();
  }

  function wordCenter(word, axis) {
    const start = Number(word && word[axis === 'x' ? 'x0' : 'y0']);
    const end = Number(word && word[axis === 'x' ? 'x1' : 'y1']);
    return Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : NaN;
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  function clusterLines(words, height) {
    const sorted = words.map((word) => ({ word, y: wordCenter(word, 'y') }))
      .filter((entry) => Number.isFinite(entry.y) && textOf(entry.word))
      .sort((a, b) => a.y - b.y);
    const tolerance = Math.max(7, height * 0.012);
    const lines = [];
    for (const entry of sorted) {
      let line = lines[lines.length - 1];
      if (!line || entry.y - line.center > tolerance) {
        line = { center: entry.y, words: [] };
        lines.push(line);
      }
      line.words.push(entry.word);
      line.center = line.words.reduce((sum, word) => sum + wordCenter(word, 'y'), 0) / line.words.length;
    }
    return lines.map((line) => {
      line.words.sort((a, b) => wordCenter(a, 'x') - wordCenter(b, 'x'));
      line.text = line.words.map(textOf).join('');
      return line;
    });
  }

  function textForRegion(words, x0, x1, y0, y1) {
    return words.filter((word) => {
      const x = wordCenter(word, 'x');
      const y = wordCenter(word, 'y');
      return Number.isFinite(x) && Number.isFinite(y) && x >= x0 && x < x1 && y >= y0 && y < y1;
    }).sort((a, b) => {
      const delta = wordCenter(a, 'y') - wordCenter(b, 'y');
      return Math.abs(delta) > 3 ? delta : wordCenter(a, 'x') - wordCenter(b, 'x');
    }).map(textOf).join('');
  }

  function columnIndex(x, columns) {
    for (let index = 0; index < columns.length - 1; index += 1) {
      if (x >= columns[index] && x < columns[index + 1]) return index;
    }
    return -1;
  }

  function putCellText(words, columns, y0, y1, onLowConfidence, rowIndex) {
    const cells = new Array(12).fill('');
    const grouped = new Array(12).fill(null).map(() => []);
    for (const word of words) {
      const x = wordCenter(word, 'x');
      const y = wordCenter(word, 'y');
      if (!Number.isFinite(x) || !Number.isFinite(y) || y < y0 || y >= y1) continue;
      const index = columnIndex(x, columns);
      if (index < 0 || index >= 12) continue;
      grouped[index].push(word);
      const confidence = Number(word.confidence);
      if (Number.isFinite(confidence) && confidence < LOW_CONFIDENCE && /\d/.test(textOf(word))) {
        onLowConfidence(rowIndex, index, word, confidence);
      }
    }
    grouped.forEach((items, index) => {
      items.sort((a, b) => {
        const dy = wordCenter(a, 'y') - wordCenter(b, 'y');
        return Math.abs(dy) > 3 ? dy : wordCenter(a, 'x') - wordCenter(b, 'x');
      });
      cells[index] = items.map(textOf).join('');
    });
    return cells;
  }

  function collectCellText(words, x0, x1, y0, y1) {
    return textForRegion(words, x0, x1, y0, y1);
  }

  function likelyPhotoBox(data, width, height, bounds) {
    const x0 = Math.max(0, Math.ceil(bounds.x0 + 2));
    const x1 = Math.min(width, Math.floor(bounds.x1 - 2));
    const y0 = Math.max(0, Math.ceil(bounds.y0 + 2));
    const y1 = Math.min(height, Math.floor(bounds.y1 - 2));
    const cellWidth = x1 - x0;
    const cellHeight = y1 - y0;
    if (cellWidth < 24 || cellHeight < 24) return null;

    const rowScores = [];
    for (let y = y0; y < y1; y += 1) {
      let nonWhite = 0;
      let chromatic = 0;
      for (let x = x0; x < x1; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 96) continue;
        const r = data[offset], g = data[offset + 1], b = data[offset + 2];
        const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
        if (maximum < 226 || (255 - minimum) > 44) nonWhite += 1;
        if (maximum - minimum > 30 && maximum < 248) chromatic += 1;
      }
      rowScores.push({ y, score: Math.max(nonWhite / cellWidth * 0.72, chromatic / cellWidth) });
    }
    const cutoff = 0.16;
    const runs = [];
    let run = null;
    for (const item of rowScores) {
      if (item.score >= cutoff) {
        if (!run) run = { start: item.y, end: item.y, sum: 0, count: 0 };
        run.end = item.y;
        run.sum += item.score;
        run.count += 1;
      } else if (run) {
        runs.push(run);
        run = null;
      }
    }
    if (run) runs.push(run);
    const minHeight = Math.max(9, cellHeight * 0.13);
    const photoRuns = runs.filter((item) => item.end - item.start + 1 >= minHeight)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start));
    if (!photoRuns.length) return null;
    const selected = photoRuns[0];
    const top = Math.max(y0, selected.start - 1);
    const bottom = Math.min(y1, selected.end + 2);
    const colScores = [];
    for (let x = x0; x < x1; x += 1) {
      let active = 0;
      for (let y = top; y < bottom; y += 1) {
        const offset = (y * width + x) * 4;
        const r = data[offset], g = data[offset + 1], b = data[offset + 2];
        const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
        if (maximum < 226 || (maximum - minimum > 30 && maximum < 248)) active += 1;
      }
      colScores.push({ x, score: active / Math.max(1, bottom - top) });
    }
    const colCutoff = 0.10;
    const activeCols = colScores.filter((item) => item.score >= colCutoff).map((item) => item.x);
    if (activeCols.length < Math.max(8, cellWidth * 0.12)) return null;
    return {
      x0: Math.max(x0, activeCols[0] - 1),
      x1: Math.min(x1, activeCols[activeCols.length - 1] + 2),
      y0: top,
      y1: bottom
    };
  }

  async function canvasToDataUrl(canvas) {
    if (typeof canvas.toDataURL === 'function') return canvas.toDataURL('image/png');
    if (typeof canvas.convertToBlob !== 'function') throw new Error('浏览器无法导出产品缩略图。');
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('产品缩略图导出失败。'));
        reader.readAsDataURL(blob);
      });
    }
    if (typeof btoa === 'function' && blob.arrayBuffer) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let start = 0; start < bytes.length; start += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(start, start + 0x8000));
      }
      return `data:image/png;base64,${btoa(binary)}`;
    }
    throw new Error('浏览器无法把产品缩略图转换为 data URL。');
  }

  async function cropPhoto(bitmap, sourceData, sourceWidth, sourceHeight, bounds) {
    const box = likelyPhotoBox(sourceData, sourceWidth, sourceHeight, bounds);
    if (!box) return '';
    const cropWidth = box.x1 - box.x0;
    const cropHeight = box.y1 - box.y0;
    const scale = Math.min(1, 768 / Math.max(cropWidth, cropHeight));
    const width = Math.max(1, Math.round(cropWidth * scale));
    const height = Math.max(1, Math.round(cropHeight * scale));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, box.x0, box.y0, cropWidth, cropHeight, 0, 0, width, height);
    return canvasToDataUrl(canvas);
  }

  function cropCanvas(bitmap, bounds) {
    const x0 = Math.max(0, Math.ceil(bounds.x0));
    const y0 = Math.max(0, Math.ceil(bounds.y0));
    const width = Math.max(1, Math.floor(bounds.x1) - x0);
    const height = Math.max(1, Math.floor(bounds.y1) - y0);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, x0, y0, width, height, 0, 0, width, height);
    return canvas;
  }

  function averageCenter(words) {
    const values = words.map((word) => wordCenter(word, 'y')).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
  }

  function describeCoordinate(word) {
    const c = Number(word && word.confidence);
    return Number.isFinite(c) ? `（置信度 ${Math.round(c)}）` : '';
  }

  async function read(file, recognize, progress) {
    if (!file) throw new TypeError('请先选择 PNG/JPG 报价图片。');
    if (typeof recognize !== 'function') throw new TypeError('需要提供本地 OCR 函数 recognize(canvas)。');
    if (!fileTypeAllowed(file)) throw new Error('仅支持正式表格 PNG/JPG 图片；请勿上传编辑器截图或其它格式。');
    if (Number(file.size) > MAX_FILE_BYTES) throw new Error('图片文件超过 24 MB，请先缩小图片后重试。');
    checkAbort(progress);
    emit(progress, 'load', 3, '正在载入报价图片');

    let bitmap;
    try {
      bitmap = await loadBitmap(file);
      const width = Number(bitmap.width || bitmap.naturalWidth);
      const height = Number(bitmap.height || bitmap.naturalHeight);
      if (!(width > 0 && height > 0)) throw new Error('图片尺寸无效或已损坏。');
      if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
        throw new Error('图片分辨率超过安全上限（单边 12000 像素、总计 2400 万像素），请先缩小图片。');
      }

      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('无法创建图片读取画布。');
      context.drawImage(bitmap, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      checkAbort(progress);
      emit(progress, 'ocr', 15, '正在识别表格文字');
      // Deliberately one pass: adapters keep their default language/configuration.
      const rawWords = await recognize(canvas);
      checkAbort(progress);
      const words = Array.isArray(rawWords) ? rawWords.filter((word) => textOf(word)) : [];
      if (!Array.isArray(rawWords)) throw new Error('OCR 回调应返回 word[]，每项包含 text/x0/x1/y0/y1/confidence。');
      if (!words.length) return { rows: [], images: {}, warnings: ['OCR 未返回可用文字，未能确认表格结构；请检查图片清晰度、方向及 OCR 输出。'] };

      const lines = detectLongLines(imageData.data, width, height).horizontal;
      const textLines = clusterLines(words, height);
      const title = textLines.find((line) => line.text.includes('产品报价单'));
      const total = textLines.find((line) => line.text.includes('总价'));
      const headerMatchers = /产品类别|产品名称|颜色|数量|面积|原价|优惠价|合计|备注|产品规格|宽度|高度|厚度/;
      const headers = textLines.filter((line) => headerMatchers.test(line.text)
        && line.center > titleYFallback(textLines) && (!total || line.center < total.center));
      const warnings = [];

      if (!title) warnings.push('未识别到“产品报价单”标题，无法确认图片顶部是否为完整报价表。');
      if (!total) warnings.push('未识别到总价行，可能图片被裁切或金额未识别；不会推算总价。');
      if (headers.length < 2) warnings.push('未识别到足够的产品表头，无法可靠定位 12 列产品区域。');

      if (!title || !total || headers.length < 2) {
        return { rows: [], images: {}, warnings };
      }

      const titleY = title.center;
      const totalY = total.center;
      const titleTop = nearestLine(lines, titleY, 'before');
      const titleBottom = nearestLine(lines, titleY, 'after');
      const headerY0 = Math.min(...headers.map((line) => line.center));
      const headerY1 = Math.max(...headers.map((line) => line.center));
      const headerTop = nearestLine(lines, headerY0, 'before');
      const headerBottom = nearestLine(lines, headerY1, 'after');
      const totalTop = nearestLine(lines, totalY, 'before');
      const totalBottom = nearestLine(lines, totalY, 'after');

      if ([titleTop, titleBottom, headerTop, headerBottom, totalTop, totalBottom].some((value) => value == null)) {
        warnings.push('报价表外框或总价行的横线不完整，图片可能裁切；请检查后重新导入。');
        return { rows: [], images: {}, warnings };
      }
      if (!(titleTop < titleBottom && titleBottom <= headerTop && headerTop < headerBottom && headerBottom < totalTop && totalTop < totalBottom)) {
        warnings.push('标题、表头与总价行的网格顺序不符合正式报价表结构，图片可能裁切或不是支持的模板。');
        return { rows: [], images: {}, warnings };
      }

      const columnResult = detectColumns(imageData.data, width, height, headerTop, totalTop);
      let columns = columnResult.lines;
      if (columns.length === 13 && columns[0] <= width * 0.015 && columns[12] >= width * 0.985) {
        columns[0] = 0;
        columns[12] = width;
      } else {
        warnings.push(`检测到 ${Math.max(0, columns.length - 1)} 个表格列区间，常规结构需要 12 列；图片可能裁切或网格不完整。`);
        return { rows: [], images: {}, warnings };
      }
      const columnSpan = columns[12] - columns[0];
      if (columns.slice(1, 12).some((x, index) => x - columns[index] < columnSpan * 0.018)) {
        warnings.push('检测到宽度异常的表格列，无法安全映射单元格；请检查网格或裁切。');
        return { rows: [], images: {}, warnings };
      }

      emit(progress, 'grid', 48, '已定位表格边界与 12 列结构');
      const warningKeys = new Set();
      const lowConfidence = (rowIndex, column, word, confidence) => {
        const key = `${rowIndex}:${column}:${textOf(word)}`;
        if (warningKeys.has(key)) return;
        warningKeys.add(key);
        warnings.push(`第 ${rowIndex + 1} 行第 ${column + 1} 列数字“${textOf(word)}”置信度较低（${Math.round(confidence)}），请人工复核。`);
      };
      const rows = [];
      const images = {};
      rows.push(['产品报价单']);

      const metadataLines = lines.filter((line) => line >= titleBottom && line <= headerTop);
      const metaBounds = metadataLines.length >= 4
        ? metadataLines.slice(0, 4)
        : [titleBottom, ...lines.filter((line) => line > titleBottom && line < headerTop), headerTop];
      if (metaBounds.length !== 4) warnings.push(`抬头区检测到 ${Math.max(0, metaBounds.length - 1)} 行，模板通常为 3 行；请复核客户/发货信息。`);
      for (let index = 0; index < metaBounds.length - 1; index += 1) {
        const y0 = metaBounds[index], y1 = metaBounds[index + 1];
        const labelL = collectCellText(words, columns[0], columns[1], y0, y1);
        const valueL = collectCellText(words, columns[1], columns[6], y0, y1);
        const labelR = collectCellText(words, columns[6], columns[7], y0, y1);
        const valueR = collectCellText(words, columns[7], columns[12], y0, y1);
        rows.push([labelL, valueL, labelR, valueR]);
      }

      const headerRow1 = new Array(12).fill('');
      const headerRow2 = new Array(12).fill('');
      const inHeader = (word) => {
        const y = wordCenter(word, 'y');
        return Number.isFinite(y) && y >= headerTop && y <= headerBottom;
      };
      const widthWords = words.filter((word) => inHeader(word) && /宽度|高度|厚度/.test(cleanText(textOf(word))));
      const subHeaderY = averageCenter(widthWords);
      const primaryHeaderWords = words.filter((word) => {
        const text = cleanText(textOf(word));
        return inHeader(word) && headerMatchers.test(text) && !/宽度|高度|厚度/.test(text);
      });
      const primaryY = averageCenter(primaryHeaderWords);
      const headerMid = Number.isFinite(subHeaderY) && Number.isFinite(primaryY)
        ? (subHeaderY + primaryY) / 2
        : (headerTop + headerBottom) / 2;
      const firstHeader = putCellText(primaryHeaderWords, columns, headerTop, headerMid + 2, lowConfidence, rows.length);
      const secondHeader = putCellText(widthWords, columns, headerMid + 2, headerBottom + 1, lowConfidence, rows.length + 1);
      firstHeader.forEach((text, index) => { headerRow1[index] = text; });
      secondHeader.forEach((text, index) => { headerRow2[index] = text; });
      const specWord = primaryHeaderWords.find((word) => /产品规格/.test(cleanText(textOf(word))));
      if (specWord) {
        // 产品规格 is a colspan group covering the width/height/thickness columns.
        headerRow1[2] = textOf(specWord);
        headerRow1[3] = '';
        headerRow1[4] = '';
      }
      if (!headerRow1.some((text) => /产品类别|产品名称/.test(text)) || !widthWords.length) {
        warnings.push('表头两行文字未能完整识别；网格按 12 列保留，表头字段请人工复核。');
      }
      rows.push(headerRow1, headerRow2);

      const bodyBounds = [headerBottom, ...lines.filter((line) => line > headerBottom && line < totalTop), totalTop];
      const uniqueBounds = bodyBounds.filter((value, index) => index === 0 || value > bodyBounds[index - 1]);
      if (uniqueBounds.length < 2) {
        warnings.push('产品/费用区缺少行分隔线，未能可靠拆分单元格。');
        return { rows: [], images: {}, warnings };
      }
      emit(progress, 'cells', 66, '正在按网格整理产品、费用与备注');
      const bodyRows = [];
      for (let index = 0; index < uniqueBounds.length - 1; index += 1) {
        const y0 = uniqueBounds[index], y1 = uniqueBounds[index + 1];
        if (y1 - y0 < Math.max(8, height * 0.004)) continue;
        const rowIndex = rows.length;
        const cells = putCellText(words, columns, y0, y1, lowConfidence, rowIndex);
        bodyRows.push({ cells, y0, y1, rowIndex });
        rows.push(cells);
      }

      const totalLabelWords = total.words.filter((word) => wordCenter(word, 'x') < columns[10]);
      const totalAmount = collectCellText(words, columns[10], columns[11], totalTop, totalBottom);
      if (!totalAmount) warnings.push('总价标签已定位但金额未识别；金额留空，不会推算。');
      totalLabelWords.forEach((word) => {
        const confidence = Number(word.confidence);
        if (Number.isFinite(confidence) && confidence < LOW_CONFIDENCE && /\d/.test(textOf(word))) {
          lowConfidence(rows.length, 10, word, confidence);
        }
      });
      rows.push(['总价（按优惠价核算）', totalAmount]);

      for (const item of bodyRows) {
        const box = { x0: columns[5], x1: columns[6], y0: item.y0, y1: item.y1 };
        const dataUrl = await cropPhoto(bitmap, imageData.data, width, height, box);
        if (dataUrl) images[item.rowIndex] = dataUrl;
      }

      const missingHeaderCells = [0, 1, 5, 6, 7, 8, 9, 10, 11].filter((index) => !headerRow1[index]);
      if (missingHeaderCells.length >= 3) warnings.push('多个产品列表头为空，可能源图分辨率过低或该模板列结构不同。');
      if (titleTop > Math.max(3, height * 0.012) || totalBottom < height * 0.43) {
        warnings.push('报价表外边框未覆盖图片常见上下范围，请确认未裁掉标题或总价行。');
      }
      if (!columns[0] || columns[12] === width) {
        // Edge-aligned borders are normal in exported tables; only warn when the detected frame is weak.
        const outerScores = columnResult.scores;
        if (outerScores[columns[0]] < 0.7 || outerScores[Math.min(width - 1, columns[12] - 1)] < 0.7) {
          warnings.push('表格左右外框线不完整，图片可能裁切；请人工核对首列与备注列。');
        }
      }
      emit(progress, 'done', 100, '表格单元格已整理');
      return { rows, images, warnings };
    } finally {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    }
  }

  function priceUnit(text) {
    const value = cleanText(text).replace(/（/g, '(').replace(/）/g, ')');
    const match = /(?:\/|／)(片|㎡|m²|m2|平米|平方米)/i.exec(value);
    if (!match) return '';
    const unit = match[1].toLowerCase();
    return unit === 'm²' || unit === 'm2' || unit === '平米' || unit === '平方米' ? '㎡' : match[1];
  }

  async function readGeometry(file, recognize, progress) {
    if (!file) throw new TypeError('请先选择 PNG/JPG/WebP 报价图片。');
    if (typeof recognize !== 'function') throw new TypeError('需要提供本地 OCR 函数 recognize(canvas)。');
    if (!fileTypeAllowed(file)) throw new Error('仅支持正式表格 PNG/JPG/WebP 图片；请勿上传编辑器截图或其它格式。');
    if (Number(file.size) > MAX_FILE_BYTES) throw new Error('图片文件超过 24 MB，请先缩小图片后重试。');
    checkAbort(progress);
    emit(progress, 'load', 3, '正在载入报价图片');
    let bitmap;
    try {
      bitmap = await loadBitmap(file);
      const width = Number(bitmap.width || bitmap.naturalWidth);
      const height = Number(bitmap.height || bitmap.naturalHeight);
      if (!(width > 0 && height > 0)) throw new Error('图片尺寸无效或已损坏。');
      if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
        throw new Error('图片分辨率超过安全上限（单边 12000 像素、总计 2400 万像素），请先缩小图片。');
      }
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('无法创建图片读取画布。');
      context.drawImage(bitmap, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      checkAbort(progress);
      const geometry = detectTableGeometry(imageData.data, width, height);
      if (!geometry.ok) return { rows: [], images: {}, warnings: [geometry.reason] };

      emit(progress, 'ocr', 24, '网格已定位，正在识别单元格文字');
      // One pass only. The OCR adapter keeps its current default language/configuration.
      const rawWords = await recognize(canvas);
      checkAbort(progress);
      if (!Array.isArray(rawWords)) throw new Error('OCR 回调应返回 word[]，每项包含 text/x0/x1/y0/y1/confidence。');
      const words = rawWords.filter((word) => textOf(word)
        && Number.isFinite(wordCenter(word, 'x')) && Number.isFinite(wordCenter(word, 'y')));
      const warnings = [];
      const { hLines, columns, intervals, sparseRows } = geometry;
      if (!words.length) warnings.push('OCR 未返回可用文字；不能区分小计和最终总价，已拒绝部分导入。');

      // Sparse amount bands share the same geometry. Require explicit OCR labels so
      // a warehouse subtotal can never be mistaken for the final total.
      const summaryRows = sparseRows.map((item) => {
        const label = collectCellText(words, columns[0], columns[10], item.y0, item.y1);
        const amount = collectCellText(words, columns[10], columns[11], item.y0, item.y1);
        const normalized = cleanText(label);
        return { ...item, label, amount, kind: normalized.includes('总价') ? 'total' : (normalized.includes('小计') ? 'subtotal' : 'unknown') };
      });
      for (const item of summaryRows) {
        if (item.kind !== 'unknown') continue;
        checkAbort(progress);
        const labelCanvas = cropCanvas(bitmap, { x0: columns[0] + 2, x1: columns[10] - 2, y0: item.y0 + 2, y1: item.y1 - 2 });
        const fallbackWords = await recognize(labelCanvas, { psm: 7 });
        checkAbort(progress);
        if (Array.isArray(fallbackWords)) {
          const fallbackLabel = fallbackWords.slice().sort((a, b) => Number(a.x0) - Number(b.x0)).map(textOf).join('');
          if (fallbackLabel) item.label = fallbackLabel;
          const normalized = cleanText(item.label);
          item.kind = normalized.includes('总价') ? 'total' : (normalized.includes('小计') ? 'subtotal' : 'unknown');
        }
      }
      const totalRows = summaryRows.filter((item) => item.kind === 'total');
      if (totalRows.length !== 1 || summaryRows[summaryRows.length - 1].kind !== 'total'
        || summaryRows.some((item) => item.kind === 'unknown')) {
        const unclassified = summaryRows.filter((item) => item.kind === 'unknown').length;
        const subtotalCount = summaryRows.filter((item) => item.kind === 'subtotal').length;
        return {
          rows: [], images: {},
          warnings: [`识别到 ${summaryRows.length} 个小计/总价样式金额行，其中 ${subtotalCount} 个小计、${unclassified} 个标签不明；未能唯一确认最终“总价”，为避免误导入已拒绝整单。`]
        };
      }
      const finalTotal = totalRows[0];
      const tableIntervals = intervals.filter((item) => item.y0 < finalTotal.y0);
      const totalCandidates = summaryRows.filter((item) => item.y0 <= finalTotal.y0);
      const subtotalRows = totalCandidates.filter((item) => item.kind === 'subtotal');
      const partitioned = subtotalRows.length > 0;
      const body = tableIntervals.filter((item) => item.kind === 'dense');
      if (!body.length) return { rows: [], images: {}, warnings: ['总价前没有可识别的产品/费用行，未导入。'] };

      emit(progress, 'cells', 60, '正在按分仓段落拆分产品、费用与小计');
      const rows = [['产品报价单']];
      const bounds = { 0: [geometry.titleTop, geometry.titleBottom] };
      for (let index = 0; index < 3; index += 1) {
        const y0 = hLines[index + 1], y1 = hLines[index + 2];
        const labelL = collectCellText(words, columns[0], columns[1], y0, y1);
        const valueL = collectCellText(words, columns[1], columns[6], y0, y1);
        const labelR = collectCellText(words, columns[6], columns[7], y0, y1);
        const valueR = collectCellText(words, columns[7], columns[12], y0, y1);
        if (!labelL || !labelR) warnings.push(`抬头第 ${index + 1} 行字段标签识别不完整，请人工核对。`);
        rows.push([labelL, valueL, labelR, valueR]);
        bounds[index + 1] = [y0, y1];
      }

      const rawOriginalPrice = collectCellText(words, columns[8], columns[9], geometry.headerTop, geometry.headerBottom);
      const rawDiscountPrice = collectCellText(words, columns[9], columns[10], geometry.headerTop, geometry.headerBottom);
      const originalUnit = priceUnit(rawOriginalPrice);
      const discountUnit = priceUnit(rawDiscountPrice);
      const headerRow1 = [
        '产品类别', '产品名称', '产品规格（mm）', '', '', '颜色/型号', '数量/片', '面积/m²',
        originalUnit ? `原价（元）/${originalUnit}` : (rawOriginalPrice || '原价（元）'),
        discountUnit ? `优惠价（元）/${discountUnit}` : (rawDiscountPrice || '优惠价（元）'),
        '合计（元）', '备注'
      ];
      const headerRow2 = ['', '', '宽度', '高度', '厚度', '', '', '', '', '', '', ''];
      if (!originalUnit) warnings.push('原价单位未从表头清楚识别，保留 OCR 原文；请人工复核，不作单位推断。');
      if (!discountUnit) warnings.push('优惠价单位未从表头清楚识别，保留 OCR 原文；请人工复核，不作单位推断。');
      rows.push(headerRow1, headerRow2);
      bounds[4] = [geometry.headerTop, geometry.headerBottom];
      bounds[5] = [geometry.headerTop, geometry.headerBottom];

      const lowConfidenceKeys = new Set();
      const lowConfidence = (rowIndex, column, word, confidence) => {
        const key = `${rowIndex}:${column}:${textOf(word)}`;
        if (lowConfidenceKeys.has(key)) return;
        lowConfidenceKeys.add(key);
        warnings.push(`第 ${rowIndex + 1} 行第 ${column + 1} 列数字“${textOf(word)}”置信度较低（${Math.round(confidence)}），请人工复核。`);
      };
      const groups = [];
      let groupNumber = 1;
      let currentGroup = { number: groupNumber, name: `仓${groupNumber}`, productRows: [], productNumbers: [], feeRows: [], sourceHeader: null, subtotal: null };
      const outputSourceRows = [];
      const photoRows = [];
      let productNumber = 0;
      const finalizeGroup = (summary) => {
        currentGroup.subtotal = summary ? [summary.y0, summary.y1] : null;
        groups.push(currentGroup);
        if (summary && currentGroup.productRows.length === 0) warnings.push(`仓${currentGroup.number}没有识别到产品行。`);
        groupNumber += 1;
        currentGroup = { number: groupNumber, name: `仓${groupNumber}`, productRows: [], productNumbers: [], feeRows: [], sourceHeader: null, subtotal: null };
      };
      const isRepeatedHeader = (cells) => {
        const c0 = cleanText(cells[0]), c1 = cleanText(cells[1]);
        const c6 = cleanText(cells[6]), c7 = cleanText(cells[7]), c9 = cleanText(cells[9]), c11 = cleanText(cells[11]);
        return (/产品类别|产品类目/.test(c0) && /产品名称/.test(c1))
          || (/数量/.test(c6) && /面积/.test(c7) && /优惠价/.test(c9) && /备注/.test(c11));
      };
      const subtotalByLine = new Map(subtotalRows.map((item) => [item.lineIndex, item]));
      const headerBandHeight = geometry.headerBottom - geometry.headerTop;
      let expectRepeatedHeader = false;
      for (const item of tableIntervals) {
        if (item.kind === 'merged') {
          const summary = subtotalByLine.get(item.lineIndex);
          if (!summary || summary.kind !== 'subtotal') continue;
          finalizeGroup(summary);
          outputSourceRows.push({ sourceLine: item.lineIndex, kind: 'subtotal', bounds: [item.y0, item.y1], outputRow: null });
          expectRepeatedHeader = true;
          continue;
        }
        const cells = putCellText(words, columns, item.y0, item.y1, lowConfidence, rows.length);
        const headerHeightMatch = expectRepeatedHeader
          && Math.abs((item.y1 - item.y0) - headerBandHeight) <= headerBandHeight * 0.35;
        if (isRepeatedHeader(cells) || headerHeightMatch) {
          currentGroup.sourceHeader = [item.y0, item.y1];
          outputSourceRows.push({ sourceLine: item.lineIndex, kind: 'repeated-header', bounds: [item.y0, item.y1], outputRow: null, group: currentGroup.number });
          expectRepeatedHeader = false;
          continue;
        }
        expectRepeatedHeader = false;
        const hasProduct = Boolean(cells[0] || cells[1] || /^\d+$/.test(cleanText(cells[6])));
        const fee = /木箱费|运费/.test(cleanText(cells[9])) || (!hasProduct && item.y1 - item.y0 < headerBandHeight * 0.7);
        if (!fee && !(cells[0] || cells[1])) {
          warnings.push(`第 ${item.lineIndex - 4} 行网格内容为空或无法分类；为了保留数据仍输出空白12列。`);
        }
        if (fee) {
          const firstProduct = currentGroup.productNumbers[0] || productNumber || currentGroup.number;
          const label = cells[9];
          if (label) cells[9] = `产品${firstProduct} · ${label}`;
        } else {
          productNumber += 1;
          const name = cells[1];
          if (partitioned) cells[1] = `${name}${name ? '\n' : ''}产品${productNumber} · 分仓${currentGroup.name}`;
          currentGroup.productRows.push(rows.length);
          currentGroup.productNumbers.push(productNumber);
        }
        const outputIndex = rows.length;
        rows.push(cells);
        bounds[outputIndex] = [item.y0, item.y1];
        outputSourceRows.push({ sourceLine: item.lineIndex, kind: fee ? 'fee' : 'product', bounds: [item.y0, item.y1], outputRow: outputIndex, group: currentGroup.number });
        if (fee) currentGroup.feeRows.push(outputIndex);
        // Do not make image preservation contingent on whole-page OCR text.
        photoRows.push({ outputRow: outputIndex, y0: item.y0, y1: item.y1 });
      }
      if (currentGroup.productRows.length || currentGroup.feeRows.length || currentGroup.sourceHeader) finalizeGroup(null);

      if (!finalTotal.amount) warnings.push('最终总价金额未识别；金额留空，不会用小计相加。');
      const totalRowIndex = rows.length;
      rows.push(['总价（按优惠价核算）', finalTotal.amount]);
      bounds[totalRowIndex] = [finalTotal.y0, finalTotal.y1];
      outputSourceRows.push({ sourceLine: finalTotal.lineIndex, kind: 'total', bounds: [finalTotal.y0, finalTotal.y1], outputRow: totalRowIndex });

      const images = {};
      for (const item of photoRows) {
        const box = { x0: columns[5], x1: columns[6], y0: item.y0, y1: item.y1 };
        const dataUrl = await cropPhoto(bitmap, imageData.data, width, height, box);
        if (dataUrl) images[item.outputRow] = dataUrl;
      }
      if (subtotalRows.length) warnings.push(`已识别 ${subtotalRows.length} 条仓库小计，并从导入矩阵中排除；仅保留最终总价。`);
      emit(progress, 'done', 100, '表格单元格已整理');
      return {
        rows, images, warnings,
        groups: groups.map((group) => ({
          index: group.number, name: group.name, productRows: group.productRows.slice(),
          feeRows: group.feeRows.slice(), subtotalBounds: group.subtotal
        })),
        geometry: {
          columns: columns.slice(), bounds, groups: groups.map((group) => ({
            index: group.number, name: group.name, productRows: group.productRows.slice(), feeRows: group.feeRows.slice(), subtotalBounds: group.subtotal
          })),
          sourceRows: outputSourceRows, totalSourceBounds: [finalTotal.y0, finalTotal.y1]
        }
      };
    } finally {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    }
  }

  const QuoteGrid = {
    read: readGeometry,
    // Small, pure helpers are exposed for deterministic offline grid QA.
    _debug: { detectLongLines, detectColumns, detectTableGeometry, groupScores, likelyPhotoBox }
  };
  root.QuoteGrid = QuoteGrid;
  if (typeof module !== 'undefined' && module.exports) module.exports = QuoteGrid;
})(typeof window !== 'undefined' ? window : globalThis);
