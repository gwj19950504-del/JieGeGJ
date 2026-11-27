(function attachQuoteTableParser(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuoteTableParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function createQuoteTableParser() {
  'use strict';

  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const blankMarkers = new Set(['', '-', '—', '–', '－', '/', '／', '无', '暂无', '不适用', 'n/a', 'na']);
  const metadataAliases = {
    customer: ['客户信息', '客户名称', '客户'],
    address: ['收货地址', '客户地址', '地址'],
    date: ['订货日期', '订单日期', '报价日期', '日期'],
    shipper: ['发货单位', '供货单位', '供应单位', '供应商'],
    manager: ['业务经理', '业务员', '经理', '联系人'],
    delivery: ['运费明细', '送货说明', '送货方式', '配送说明', '运输说明', '交付说明'],
    extraNote: ['补充说明', '其他说明', '特别说明']
  };
  const metadataLabels = Object.values(metadataAliases).flat().sort((a, b) => b.length - a.length);

  function fail(message) {
    throw new Error(message);
  }

  function cellText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    fail('表格单元格只支持文本或数字，未执行任何单元格内容。');
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) fail('rows 必须是二维数组。');
    return rows.map((row, rowIndex) => {
      if (!Array.isArray(row)) fail(`第 ${rowIndex + 1} 行不是单元格数组。`);
      return { index: rowIndex, cells: row.map(cellText) };
    });
  }

  function normLabel(value) {
    return cellText(value).toLowerCase().replace(/[\s\u3000，,。.;；:：、/\\_—()（）-]+/g, '');
  }

  function classifyHeader(value) {
    const text = cellText(value);
    const n = normLabel(text);
    if (!n) return '';
    if (/(产品)?(类别|类目|品类)$/.test(n) || n === '分类') return 'category';
    if (/(产品)?(名称|名|品名|款式)$/.test(n) || n === '品种') return 'name';
    if (/^(宽度|宽|width)(mm|毫米)?$/.test(n)) return 'width';
    if (/^(高度|长度|长|高|height|length)(mm|毫米)?$/.test(n)) return 'height';
    if (/^(厚度|厚|thickness)(mm|毫米)?$/.test(n)) return 'thickness';
    if (/^(颜色型号|颜色|型号|色号|model)$/.test(n)) return 'model';
    if (/^(数量|数量片|片数|数量件|件数|qty|quantity)$/.test(n)) return 'qty';
    if (/^(面积|平方数|平米数|面积m2|面积m²|面积㎡|面积平米|面积平方米|m2|m²|㎡|平方米)$/.test(n)) return 'area';
    if (/^(原价|原单价|标价|原价.*)$/.test(n)) return 'original';
    if (/(优惠价|折后价|成交价|销售单价|单价|特价|报价单价)/.test(n)) return 'price';
    if (/^(合计|金额|小计|材料金额|产品金额|总金额|总价|成交金额|报价金额)(元|人民币|按优惠价核算|小计|合计)?$/.test(n)) return 'amount';
    if (/^(备注|说明|产品备注|备注说明)$/.test(n)) return 'note';
    if (/^(产品)?规格(mm|毫米)?$/.test(n) || n === '规格尺寸') return 'spec';
    return '';
  }

  function unitHint(text) {
    const source = cellText(text);
    const area = /(?:元\s*\/\s*)?(?:㎡|m²|m2|平米|平方米)|每平(?:方)?米|按平方|平方单价/i.test(source);
    const piece = /(?:元\s*\/\s*)?(?:片|张)|每片|按片|片单价/i.test(source);
    if (area && piece) return 'ambiguous';
    if (area) return 'area';
    if (piece) return 'piece';
    return '';
  }

  function headerInfoFor(rows, start, end) {
    const maxLength = Math.max(...rows.slice(start, end).map(item => item.cells.length), 0);
    const fields = {};
    const partsByColumn = Array.from({ length: maxLength }, () => []);
    for (let r = start; r < end; r += 1) {
      rows[r].cells.forEach((value, col) => {
        if (value) partsByColumn[col].push(value);
      });
    }
    partsByColumn.forEach((parts, col) => {
      for (const part of parts) {
        const field = classifyHeader(part);
        if (!field) continue;
        if (own(fields, field) && fields[field] !== col) continue;
        fields[field] = col;
      }
    });
    const essential = ['name', 'qty', 'price'].filter(field => own(fields, field)).length;
    const recognized = Object.keys(fields).length;
    if (essential < 3 || recognized < 4) return null;
    return {
      index: start,
      end,
      fields,
      partsByColumn,
      priceHeaderText: own(fields, 'price') ? partsByColumn[fields.price].join(' ') : '',
      specColumn: fields.spec
    };
  }

  function findHeader(rows) {
    for (let i = 0; i < rows.length; i += 1) {
      const info = headerInfoFor(rows, i, i + 1);
      if (info) {
        const hasDimensionSubheader = info.fields.spec !== undefined
          && (info.fields.width === undefined || info.fields.height === undefined)
          && i + 1 < rows.length
          && rows[i + 1].cells.some(cell => classifyHeader(cell) === 'width')
          && rows[i + 1].cells.some(cell => classifyHeader(cell) === 'height');
        if (hasDimensionSubheader) {
          const grouped = headerInfoFor(rows, i, i + 2);
          if (grouped) return grouped;
        }
        return info;
      }
      const currentLabels = rows[i].cells.map(classifyHeader).filter(Boolean);
      const headerLike = currentLabels.length >= 2 && (currentLabels.includes('category') || currentLabels.includes('name'));
      if (headerLike && i + 1 < rows.length) {
        const twoRow = headerInfoFor(rows, i, i + 2);
        if (twoRow) return twoRow;
      }
    }
    fail('无法安全识别产品表头；需要包含产品名称、数量、优惠价/单价等可辨认列名。');
  }

  function isBlank(value) {
    return blankMarkers.has(cellText(value).toLowerCase());
  }

  function canonicalNumber(value, label, rowNumber, optional = false) {
    const source = cellText(value);
    if (isBlank(source)) {
      if (optional) return { text: '', number: null };
      fail(`第 ${rowNumber} 行缺少${label}，无法安全导入。`);
    }
    const cleaned = source
      .replace(/\s*\/\s*(?:㎡|m²|m2|平米|平方米|片|张)\s*$/i, '')
      .replace(/(?:按平方|按片|每平(?:方)?米|每片)$/i, '')
      .replace(/[￥¥元\s\u3000,，]/g, '')
      .replace(/毫米|mm|片|张|个|m²|m2|㎡|平方米|平米/gi, '');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) {
      fail(`第 ${rowNumber} 行的${label}“${source}”不是明确数字。`);
    }
    const number = Number(cleaned);
    if (!Number.isFinite(number) || number < 0) fail(`第 ${rowNumber} 行的${label}不能为负数或超出数字范围。`);
    return { text: String(number), number };
  }

  function canonicalThickness(value, rowNumber, optional = true) {
    const source = cellText(value);
    if (isBlank(source)) {
      if (optional) return { text: '', number: null };
      fail(`第 ${rowNumber} 行缺少厚度，无法安全导入。`);
    }
    const range = /^\s*(\d+(?:\.\d+)?)\s*[-–—~～]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?\s*$/i.exec(source);
    if (range) {
      const low = Number(range[1]);
      const high = Number(range[2]);
      if (!(Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > low)) fail(`第 ${rowNumber} 行的厚度范围“${source}”必须是正数且递增。`);
      return { text: `${String(low)}-${String(high)}`, number: null };
    }
    return canonicalNumber(source, '厚度', rowNumber, optional);
  }

  function parseDate(text, rowNumber) {
    const value = cellText(text);
    if (isBlank(value)) return '';
    const match = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(value);
    if (!match) fail(`第 ${rowNumber} 行的日期“${value}”无法明确识别。`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      fail(`第 ${rowNumber} 行的日期“${value}”无效。`);
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function findMetadataLabel(text) {
    const value = cellText(text);
    for (const label of metadataLabels) {
      if (value === label || value.startsWith(label)) {
        return { label, rest: value.slice(label.length).replace(/^\s*[:：]?\s*/, '') };
      }
    }
    return null;
  }

  function metadataKey(label) {
    for (const [key, labels] of Object.entries(metadataAliases)) if (labels.includes(label)) return key;
    return '';
  }

  function extractMetadata(rows, header, warnings) {
    const data = { customer: '', address: '', date: '', shipper: '', manager: '', delivery: '', extraNote: '' };
    const consumed = new Set();
    const scanEnd = Math.min(rows.length, header.index + 1);
    for (let r = 0; r < scanEnd; r += 1) {
      const cells = rows[r].cells;
      for (let c = 0; c < cells.length; c += 1) {
        const found = findMetadataLabel(cells[c]);
        if (!found) continue;
        const key = metadataKey(found.label);
        if (!key || consumed.has(key)) continue;
        let value = found.rest;
        if (!value) {
          for (let next = c + 1; next < cells.length; next += 1) {
            if (!cells[next]) continue;
            if (findMetadataLabel(cells[next])) break;
            value = cells[next];
            break;
          }
        }
        if (value) {
          if (key === 'date') {
            try {
              data.date = parseDate(value, rows[r].index + 1);
              consumed.add(key);
            } catch {
              data.date = '';
              warnings.push(`⚠ 第 ${rows[r].index + 1} 行日期“${value}”无法明确识别，已留空；导出前请补填。`);
            }
          } else {
            data[key] = value;
            consumed.add(key);
          }
        }
      }
    }
    return data;
  }

  function rowValue(row, fields, field) {
    return own(fields, field) ? cellText(row.cells[fields[field]]) : '';
  }

  function parseSpec(text, rowNumber) {
    const value = cellText(text);
    if (isBlank(value)) return null;
    const parts = value.split(/[×xX*＊]/);
    if (parts.length < 2 || parts.length > 3) {
      fail(`第 ${rowNumber} 行的规格“${value}”不能明确拆分为宽×高[×厚]。`);
    }
    const width = canonicalNumber(parts[0], '规格宽度', rowNumber);
    const height = canonicalNumber(parts[1], '规格高度', rowNumber);
    const thickness = parts.length > 2 ? canonicalThickness(parts[2], rowNumber, true) : { text: '', number: null };
    return { width, height, thickness };
  }

  function isTotalRow(cells) {
    return cells.some(cell => /^(?:总价|总计|合计|订单总额|报价总额|总金额)(?:\s*[（(].*)?(?:\s*[:：]?\s*(?:[￥¥]?\s*\d[\d,]*(?:\.\d+)?\s*(?:元)?))?$/.test(cellText(cell).replace(/\s/g, '')));
  }

  function isSubtotalRow(cells) {
    return cells.some(cell => /^小计(?:[（(].*[）)])?(?:\s*[:：]?\s*(?:[￥¥]?\s*\d[\d,]*(?:\.\d+)?\s*(?:元)?))?$/.test(cellText(cell).replace(/\s/g, '')));
  }

  function feeKindFromLabel(value) {
    const text = cellText(value).replace(/\s+/g, ' ').trim();
    if (!text || /^(?:运费明细|运费说明|送货说明|加工说明|补充说明)/.test(text)) return '';
    const tokens = [
      ['tax', /税金|税费/],
      ['processing', /加工费|加工/],
      ['auxiliary', /辅料费|辅料|配件费/],
      ['box', /木箱(?:包装)?费?|木架(?:包装)?费?|包装费/],
      ['freight', /运费|物流费|运输费/]
    ];
    for (const [kind, expression] of tokens) {
      const match = expression.exec(text);
      if (!match) continue;
      const prefix = text.slice(0, match.index).trim();
      const suffix = text.slice(match.index + match[0].length).trim();
      const allowedPrefix = !prefix || /^(?:(?:产品|第)\s*\d+\s*(?:号|项)?(?:\s*[·•|]\s*[^·•|]+)*(?:\s*[·•|])?)$/.test(prefix);
      const allowedSuffix = !suffix || /^(?:(?:\(元\)|（元）|\([^)]*\)|（[^）]*）)\s*)?(?:(?:[:：]\s*)?(?:￥|¥)?\s*\d[\d,]*(?:\.\d+)?\s*(?:元)?|到付|货拉拉.*)?$/.test(suffix);
      if (allowedPrefix && allowedSuffix) return kind;
    }
    return '';
  }

  function feeLabel(row, fields) {
    const amountColumn = own(fields, 'amount') ? fields.amount : row.cells.length;
    for (let col = 0; col < Math.min(amountColumn, row.cells.length); col += 1) {
      const kind = feeKindFromLabel(row.cells[col]);
      if (kind) return { kind, text: row.cells[col], column: col };
    }
    return null;
  }

  function hasProductAnchor(row, fields) {
    const name = rowValue(row, fields, 'name');
    const substantive = ['width', 'height', 'thickness', 'model', 'qty', 'area', 'original', 'spec']
      .some(field => !!rowValue(row, fields, field));
    return substantive || (!!name && !feeKindFromLabel(name));
  }

  function isFeeRow(row, fields) {
    return !isTotalRow(row.cells) && !hasProductAnchor(row, fields) && !!feeLabel(row, fields);
  }

  function likelyProductRow(row, fields) {
    if (isTotalRow(row.cells)) return false;
    if (hasProductAnchor(row, fields)) return true;
    const price = rowValue(row, fields, 'price');
    return !!price && parseCurrencyLoose(price) !== null;
  }

  function parseCurrencyLoose(value) {
    const source = cellText(value).replace(/[￥¥\s\u3000,，元]/g, '');
    if (!source || /到付|货拉拉|不收|无/.test(cellText(value))) return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(source)) return null;
    const number = Number(source);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function lineAmount(row, fields) {
    const direct = rowValue(row, fields, 'amount');
    if (!isBlank(direct)) {
      const value = parseCurrencyLoose(direct);
      if (value !== null) return value;
    }
    return null;
  }

  function amountNumberFromFeeRow(row, fields, kind, label) {
    const direct = own(fields, 'amount') ? cellText(row.cells[fields.amount]) : '';
    if (direct && !/到付|货拉拉/.test(direct)) {
      const parsed = parseCurrencyLoose(direct);
      if (parsed !== null) return parsed;
    }
    for (let col = label.column + 1; col < row.cells.length; col += 1) {
      const adjacent = parseCurrencyLoose(row.cells[col]);
      if (adjacent !== null) return adjacent;
    }
    const inline = /(?:[:：]\s*)?(?:￥|¥)?\s*(\d[\d,]*(?:\.\d+)?)(?:元)?$/.exec(label.text);
    if (inline) return Number(inline[1].replace(/,/g, ''));
    if (kind === 'freight' && /到付|货拉拉/.test(`${label.text} ${row.cells.join(' ')}`)) return null;
    return null;
  }

  function sourceTotal(rows, fields) {
    const found = [];
    for (const row of rows) {
      if (!isTotalRow(row.cells)) continue;
      const labeledValue = row.cells.map(cell => cellText(cell)).filter(Boolean);
      const inline = labeledValue.map(value => {
        const match = /^(?:总价|总计|合计|订单总额|报价总额|总金额)(?:[（(][^）)]*[）)])?\s*[:：]?\s*(?:￥|¥)?\s*(\d[\d,]*(?:\.\d+)?)(?:元)?$/.exec(value.replace(/\s/g, ''));
        return match ? Number(match[1].replace(/,/g, '')) : null;
      }).filter(value => value !== null);
      const candidates = inline.length ? inline : labeledValue.map(parseCurrencyLoose).filter(value => value !== null);
      if (candidates.length) found.push(candidates[candidates.length - 1]);
      else {
        const byAmount = lineAmount(row, fields);
        if (byAmount !== null) found.push(byAmount);
      }
    }
    if (found.length > 1 && found.some(value => Math.abs(value - found[0]) > 0.01)) {
      fail('表格中存在多个互相矛盾的合计，无法安全确定源合计。');
    }
    return found.length ? found[found.length - 1] : null;
  }

  function nearlyEqual(a, b, tolerance = 0.01) {
    return Math.abs(a - b) <= tolerance;
  }

  function sanSheSiRu(value) {
    const floor = Math.floor(value);
    const firstDecimal = Math.floor((value - floor) * 10 + 1e-8);
    return firstDecimal <= 3 ? floor : floor + 1;
  }

  function amountFor(mode, qty, width, height, price) {
    const area = width > 0 && height > 0 ? (width / 1000) * (height / 1000) * qty : 0;
    return sanSheSiRu(mode === 'piece' ? qty * price : area * price);
  }

  function parseUnitFromPrice(text, headerText, contextText, rowNumber) {
    const candidates = [unitHint(text), unitHint(headerText), unitHint(contextText)].filter(Boolean);
    if (candidates.includes('ambiguous')) fail(`第 ${rowNumber} 行同时出现按面积和按片单位，无法安全识别。`);
    const unique = [...new Set(candidates)];
    if (unique.length > 1) fail(`第 ${rowNumber} 行优惠价的单位线索互相矛盾。`);
    return unique[0] || '';
  }

  function getProductFromRow(row, header, tableHint, images, warnings) {
    const f = header.fields;
    const rowNumber = row.index + 1;
    const productNameRaw = rowValue(row, f, 'name');
    if (!productNameRaw) fail(`第 ${rowNumber} 行疑似产品明细但产品名称为空。`);
    const category = rowValue(row, f, 'category');
    const model = rowValue(row, f, 'model');
    const note = rowValue(row, f, 'note');
    const qty = canonicalNumber(rowValue(row, f, 'qty'), '数量/片数', rowNumber);
    if (!Number.isInteger(qty.number) || qty.number <= 0) fail(`第 ${rowNumber} 行数量必须是正整数。`);
    const original = canonicalNumber(rowValue(row, f, 'original'), '原价', rowNumber, true);
    const priceSource = rowValue(row, f, 'price');
    const price = canonicalNumber(priceSource, '优惠价/单价', rowNumber);
    const areaSource = canonicalNumber(rowValue(row, f, 'area'), '面积', rowNumber, true);
    let width = canonicalNumber(rowValue(row, f, 'width'), '宽度', rowNumber, true);
    let height = canonicalNumber(rowValue(row, f, 'height'), '高度/长度', rowNumber, true);
    let thickness = canonicalThickness(rowValue(row, f, 'thickness'), rowNumber, true);

    const specText = header.specColumn === undefined ? '' : cellText(row.cells[header.specColumn]);
    const specIsSeparate = header.specColumn !== undefined
      && header.specColumn !== f.width && header.specColumn !== f.height && header.specColumn !== f.thickness;
    if ((!width.text || !height.text || (specIsSeparate && !thickness.text)) && specText) {
      const spec = parseSpec(specText, rowNumber);
      if (spec) {
        if (!width.text) width = spec.width;
        if (!height.text) height = spec.height;
        if (!thickness.text && spec.thickness.text) thickness = spec.thickness;
      }
    }

    const priceHeader = header.priceHeaderText;
    let mode = parseUnitFromPrice(priceSource, priceHeader, '', rowNumber) || tableHint;
    const amount = lineAmount(row, f);
    const hasArea = areaSource.number !== null;
    const canComputeArea = !!(width.number && height.number);
    if (!canComputeArea && hasArea && areaSource.number > 0) {
      fail(`第 ${rowNumber} 行填写了面积但缺少宽度/高度；编辑器无法保留这项面积。`);
    }
    if (mode === 'ambiguous') fail(`第 ${rowNumber} 行计价单位含混，无法安全导入。`);
    if (!mode) {
      if (amount === null) fail(`第 ${rowNumber} 行优惠价没有单位，也没有可核对的金额；不能猜按平方还是按片。`);
      if (!canComputeArea) fail(`第 ${rowNumber} 行缺少单位与尺寸，无法通过金额核对推断计价方式。`);
      const areaAmount = amountFor('area', qty.number, width.number, height.number, price.number);
      const pieceAmount = amountFor('piece', qty.number, width.number, height.number, price.number);
      const areaMatches = nearlyEqual(areaAmount, amount);
      const pieceMatches = nearlyEqual(pieceAmount, amount);
      if (areaMatches === pieceMatches) {
        fail(`第 ${rowNumber} 行优惠价单位无法唯一推断（表格金额为 ${amount}）；请明确标注元/㎡或元/片。`);
      }
      mode = areaMatches ? 'area' : 'piece';
      warnings.push(`⚠ 第 ${rowNumber} 行缺少优惠价单位，按表格金额唯一吻合，暂推为按${mode === 'area' ? '平方' : '片'}计价；请复核。`);
    }
    if (mode === 'area' && !(width.number > 0 && height.number > 0)) {
      fail(`第 ${rowNumber} 行按平方计价但缺少有效宽度/高度。`);
    }

    if (hasArea) {
      const calculatedArea = canComputeArea ? (width.number / 1000) * (height.number / 1000) * qty.number : 0;
      if (!nearlyEqual(calculatedArea, areaSource.number, 0.021)) {
        fail(`第 ${rowNumber} 行表格面积 ${areaSource.number} 与尺寸×数量计算值 ${calculatedArea.toFixed(2)} 不符；编辑器不能保存源面积，请先核对。`);
      }
    }
    const expectedAmount = amountFor(mode, qty.number, width.number || 0, height.number || 0, price.number);
    if (amount !== null && !nearlyEqual(amount, expectedAmount)) {
      warnings.push(`⚠ 第 ${rowNumber} 行产品金额不符：表格 ${amount}，编辑器按${mode === 'area' ? '平方' : '片'}价计算 ${expectedAmount}；请核对价格、单位或金额。`);
    }

    const warehouseTag = /(?:^|[\n\r])\s*产品\s*\d+\s*[·•|]\s*([^\n\r]+)/.exec(productNameRaw);
    let warehouse = '';
    let name = productNameRaw;
    if (warehouseTag) {
      const candidate = warehouseTag[1].trim();
      if (!/^(同仓发货|分仓发货|异仓发货)$/.test(candidate)) warehouse = candidate;
      name = name.split(/\r?\n|\r/).filter(line => !/^\s*产品\s*\d+\s*[·•|]\s*[^\r\n]+$/.test(line)).join('\n').trim();
      if (!name) fail(`第 ${rowNumber} 行只有发货标签，缺少产品名称，请核对原图。`);
    }

    let image = '';
    if (images && own(images, String(row.index))) {
      const candidate = images[row.index];
      if (typeof candidate === 'string' && /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(candidate.trim())) image = candidate.trim();
      else warnings.push(`⚠ 第 ${rowNumber} 行关联图片不是可安全预览的 PNG/JPEG data URL，已留空。`);
    }

    return {
      category,
      name,
      width: width.text,
      height: height.text,
      thickness: thickness.text,
      qty: qty.text,
      original: original.text,
      price: price.text,
      mode,
      model,
      note,
      image,
      warehouse,
      box: '',
      freight: ''
    };
  }

  function extractProductIndex(cells, productCount, rowNumber) {
    const text = cells.join(' ');
    const match = /(?:产品|第)\s*(\d+)\s*(?:号|项)?/.exec(text);
    if (!match) return null;
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= productCount) fail(`第 ${rowNumber} 行费用指向产品 ${match[1]}，但产品数量为 ${productCount}。`);
    return index;
  }

  function collectFees(rows, header, products) {
    const shared = { box: 0, freight: 0, processing: 0, auxiliary: 0, tax: 0 };
    const perProduct = products.map(() => ({ box: 0, freight: 0 }));
    const perProductSeen = new Set();
    const sharedSeen = new Set();
    let hasLalamove = false;
    for (const row of rows) {
      const label = feeLabel(row, header.fields);
      if (!label || !isFeeRow(row, header.fields)) continue;
      const kind = label.kind;
      const rowNumber = row.index + 1;
      const amount = amountNumberFromFeeRow(row, header.fields, kind, label);
      const rowText = row.cells.join(' ');
      if (kind === 'freight' && /到付|货拉拉/.test(rowText) && amount === null) {
        if (/货拉拉/.test(rowText)) hasLalamove = true;
        continue;
      }
      if (amount === null) fail(`第 ${rowNumber} 行有${kind === 'box' ? '木箱' : kind === 'freight' ? '运费' : kind === 'processing' ? '加工费' : kind === 'auxiliary' ? '辅料费' : '税金'}项目但金额不明确。`);
      if (kind === 'box' || kind === 'freight') {
        const productIndex = extractProductIndex(row.cells, products.length, rowNumber);
        if (productIndex !== null) {
          perProduct[productIndex][kind] += amount;
          perProductSeen.add(kind);
          hasLalamove = hasLalamove || /货拉拉/.test(rowText);
        } else {
          shared[kind] += amount;
          sharedSeen.add(kind);
          hasLalamove = hasLalamove || /货拉拉/.test(rowText);
        }
      } else {
        shared[kind] += amount;
      }
    }
    const hasPerProduct = perProductSeen.size > 0;
    const hasSharedTransport = sharedSeen.size > 0;
    if (hasPerProduct && hasSharedTransport && products.length > 1) {
      fail('表格同时包含整单木箱/运费和按产品木箱/运费，当前编辑器无法无损表达这种混合分摊。');
    }
    if (hasPerProduct && products.length > 1 && hasSharedTransport) {
      fail('同一份报价同时出现共享与分产品木箱/运费，无法安全映射。');
    }
    if (hasLalamove) {
      const positiveTransport = shared.box > 0 || shared.freight > 0 || perProduct.some(item => item.box > 0 || item.freight > 0);
      if (positiveTransport) fail('表格标注货拉拉，但同时填写了正数木箱费/运费；当前编辑器会清空这两项，不能安全导入。');
    }
    if (products.length === 1 && hasPerProduct) {
      shared.box += perProduct[0].box;
      shared.freight += perProduct[0].freight;
    } else if (hasPerProduct) {
      perProduct.forEach((item, index) => {
        products[index].box = item.box ? String(item.box) : '';
        products[index].freight = item.freight ? String(item.freight) : '';
      });
    }
    return {
      shared,
      different: products.length > 1 && hasPerProduct,
      hasPerProduct,
      hasSharedTransport,
      lalamove: hasLalamove
    };
  }

  function explicitShipmentMode(rows, headerIndex) {
    const text = rows.slice(0, headerIndex).map(row => row.cells.join(' ')).join(' ');
    const different = /异仓|不同仓|分仓发货|分别发货/.test(text);
    const same = /同仓发货|同一仓|相同仓/.test(text);
    if (different && same) fail('表格同时标注同仓和异仓，无法安全确定发货方式。');
    return different ? 'different' : same ? 'same' : '';
  }

  function makeState(metadata, products, feeInfo, shipmentMode, warnings) {
    const hasPerProduct = feeInfo.hasPerProduct && products.length > 1;
    let different = hasPerProduct || shipmentMode === 'different';
    if (shipmentMode === 'same' && hasPerProduct) fail('表格标注同仓，但木箱/运费按产品分开，信息矛盾。');
    if (different && feeInfo.hasSharedTransport) fail('表格标注异仓/分仓，但同时有整单共享木箱/运费；无法安全分摊。');
    if (products.length > 1 && !shipmentMode && !hasPerProduct) {
      warnings.push('⚠ 未找到同仓/异仓标注或分产品费用，暂按同仓填写；请复核发货安排。');
    }
    if (products.length === 1) different = false;
    if (feeInfo.lalamove) {
      if (different) products.forEach(product => { product.box = '0'; product.freight = ''; });
      feeInfo.shared.box = 0;
      feeInfo.shared.freight = 0;
    }
    return {
      customer: metadata.customer,
      address: metadata.address,
      date: metadata.date,
      shipper: metadata.shipper,
      manager: metadata.manager,
      delivery: metadata.delivery,
      multi: products.length > 1,
      different,
      box: feeInfo.shared.box ? String(feeInfo.shared.box) : (feeInfo.lalamove ? '0' : ''),
      freight: feeInfo.shared.freight ? String(feeInfo.shared.freight) : '',
      processing: feeInfo.shared.processing ? String(feeInfo.shared.processing) : '0',
      auxiliary: feeInfo.shared.auxiliary ? String(feeInfo.shared.auxiliary) : '0',
      tax: feeInfo.shared.tax ? String(feeInfo.shared.tax) : '',
      autoTax: false,
      rate: '10',
      rateChoice: '10',
      lalamove: feeInfo.lalamove,
      extraNote: metadata.extraNote,
      products
    };
  }

  function calculateState(state) {
    const products = state.products;
    const rows = products.map(product => {
      const width = Number(product.width) || 0;
      const height = Number(product.height) || 0;
      const qty = Number(product.qty) || 0;
      const area = width > 0 && height > 0 ? width / 1000 * (height / 1000) * qty : 0;
      return { area, amount: amountFor(product.mode, qty, width, height, Number(product.price) || 0) };
    });
    const material = rows.reduce((sum, row) => sum + row.amount, 0);
    const box = state.different ? products.reduce((sum, product) => sum + (Number(product.box) || 0), 0) : (Number(state.box) || 0);
    const freight = state.different ? products.reduce((sum, product) => sum + (Number(product.freight) || 0), 0) : (Number(state.freight) || 0);
    const total = material + box + freight + (Number(state.processing) || 0) + (Number(state.auxiliary) || 0) + (Number(state.tax) || 0);
    return { rows, material, box, freight, total };
  }

  function parse(rows, images = {}) {
    const normalized = normalizeRows(rows);
    const header = findHeader(normalized);
    const warnings = [];
    const metadata = extractMetadata(normalized, header, warnings);
    let shipmentMode = explicitShipmentMode(normalized, header.index);
    const tableHints = [header.priceHeaderText, ...normalized.slice(0, header.index).map(row => row.cells.join(' '))]
      .map(unitHint).filter(Boolean);
    if (tableHints.includes('ambiguous')) fail('表格级计价说明同时包含面积和按片单位。');
    const uniqueTableHints = [...new Set(tableHints)];
    if (uniqueTableHints.length > 1) fail('表格级计价说明互相矛盾，无法确定产品计价方式。');
    const tableHint = uniqueTableHints[0] || '';

    const products = [];
    const productSourceRows = [];
    const bodyRows = [];
    for (let i = header.end; i < normalized.length; i += 1) {
      const row = normalized[i];
      if (isTotalRow(row.cells)) break;
      if (isSubtotalRow(row.cells)) continue;
      if (productSourceRows.length && /^(?:补充说明|其他说明|特别说明|领导审批|审批|签名|财务|业务|制单人|订单说明|注意事项)/.test(row.cells.filter(Boolean).join(' '))) break;
      const hasAnyProductField = ['category', 'name', 'width', 'height', 'thickness', 'model', 'qty', 'area', 'original', 'price', 'spec', 'note']
        .some(field => !!rowValue(row, header.fields, field));
      if (likelyProductRow(row, header.fields)) {
        products.push(getProductFromRow(row, header, tableHint, images, warnings));
        productSourceRows.push(row);
        bodyRows.push(row);
      } else if (isFeeRow(row, header.fields)) {
        bodyRows.push(row);
      } else if (hasAnyProductField) {
        fail(`第 ${row.index + 1} 行有疑似产品内容，但无法识别为完整产品或费用行。`);
      }
    }
    if (!products.length) fail('识别到表头，但没有找到可安全导入的产品明细行。');

    const productShipmentText = productSourceRows.map(row => rowValue(row, header.fields, 'name')).join(' ');
    const rowDifferent = /分仓发货|异仓发货|不同仓|分别发货/.test(productShipmentText);
    const rowSame = /同仓发货|同一仓|相同仓/.test(productShipmentText);
    const warehouses = products.map(product => product.warehouse).filter(Boolean);
    const uniqueWarehouses = [...new Set(warehouses)];
    if (rowDifferent && rowSame) fail('产品行同时标注同仓和异仓，无法安全确定发货方式。');
    const productShipmentMode = rowDifferent || uniqueWarehouses.length > 1 ? 'different'
      : rowSame || uniqueWarehouses.length === 1 ? 'same' : '';
    if (shipmentMode && productShipmentMode && shipmentMode !== productShipmentMode) {
      fail('抬头与产品行标注的同仓/异仓信息互相矛盾。');
    }
    shipmentMode = productShipmentMode || shipmentMode;

    const feeInfo = collectFees(bodyRows, header, products);
    feeInfo.lalamove = feeInfo.lalamove || /货拉拉/.test(metadata.delivery);
    if (feeInfo.lalamove) {
      const positiveTransport = feeInfo.shared.box > 0 || feeInfo.shared.freight > 0
        || products.some(product => Number(product.box) > 0 || Number(product.freight) > 0);
      if (positiveTransport) fail('表格标注货拉拉，但同时填写了正数木箱费/运费；当前编辑器会清空这两项，不能安全导入。');
    }
    const state = makeState(metadata, products, feeInfo, shipmentMode, warnings);
    const source = sourceTotal(normalized, header.fields);
    const calculated = calculateState(state);
    if (source !== null && !nearlyEqual(source, calculated.total)) {
      warnings.push(`⚠ 源表合计 ${source} 与编辑器按原税金/费用计算的合计 ${calculated.total} 不符；请核对后再发出。`);
    }
    if (!state.date && !warnings.some(warning => /日期/.test(warning))) warnings.push('⚠ 未识别到订货日期，编辑器导出前需要补填。');
    return { state, warnings, sourceTotal: source };
  }

  function fromTSV(text) {
    if (typeof text !== 'string') fail('TSV 输入必须是文本。');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    let afterQuote = false;
    const pushCell = () => { row.push(cell); cell = ''; afterQuote = false; };
    const pushRow = () => {
      pushCell();
      rows.push(row);
      row = [];
    };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 1; }
          else { quoted = false; afterQuote = true; }
        } else cell += char;
        continue;
      }
      if (afterQuote && char !== '\t' && char !== '\r' && char !== '\n' && !/\s/.test(char)) {
        fail('TSV 引号结束后出现非空格字符，无法安全解析。');
      }
      if (char === '"' && cell.trim() === '' && !afterQuote) {
        cell = '';
        quoted = true;
      } else if (char === '\t') {
        pushCell();
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        pushRow();
      } else if (!afterQuote) {
        cell += char;
      }
    }
    if (quoted) fail('TSV 中有未闭合的引号。');
    if (cell.length || row.length) pushRow();
    return rows;
  }

  return { parse, fromTSV };
});
