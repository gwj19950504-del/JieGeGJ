(function (root) {
    'use strict';

    const numberPattern = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
    const unitPattern = '(?:平(?:方(?:米)?)?|㎡|m²|m2|张|片)';

    function emptyProduct() {
        return { product: '', spec: '', quantity: '', originalPrice: '', unitPrice: '',
            pricingMode: 'area', boxFee: 0, freightFee: 0 };
    }

    function normalizeLine(value) {
        return value.trim().replace(/^([^:：]*?)：/, '$1:');
    }

    function compact(value) {
        return normalizeLine(value).replace(/：/g, ':').replace(/，/g, ',')
            .replace(/[＊×xX]/g, '*').replace(/\s/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')');
    }

    function roundedMaterial(value) {
        const floor = Math.floor(value);
        return Math.floor((value - floor) * 10 + 1e-8) <= 3 ? floor : floor + 1;
    }

    function parseAmount(value) {
        const match = compact(value).match(new RegExp(`^(${numberPattern})元?$`));
        return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
    }

    function parse(text, { standardNotes = [] } = {}) {
        const errors = [];
        const warnings = [];
        const products = [];
        const state = {
            multiMode: false, shipmentMode: 'same', lalamove: false, includeTax: false,
            taxType: '10', customTax: 10, noteExtra: '', replaceDefaultNote: false,
            quoteFreightAddress: '', quoteBestDestinationPickup: false, quoteBestPaymentMode: 'collect',
            fees: { processingFee: 0, accessoryFee: 0, manualTaxFee: 0 },
            single: emptyProduct(), multi: { boxFee: 0, freightFee: 0, products: [] },
        };
        const source = String(text || '').replace(/\r\n?/g, '\n').trim();
        if (!source || source.length > 60000) {
            return { ok: false, errors: [source ? '原文过长，请只粘贴一份报价（不超过60000字）。' : '请先粘贴文字报价。'], warnings, state };
        }
        const lines = source.split('\n');
        const records = [];
        const feeRecords = [];
        const seenGlobal = new Set();
        let current = null;
        let shipment = '';
        let sourceTotal = null;
        let afterTotal = false;
        let noteStart = -1;

        function duplicate(set, key, label) {
            if (set.has(key)) errors.push(`${label}重复，请只粘贴一份完整报价。`);
            set.add(key);
        }

        for (const [lineIndex, rawLine] of lines.entries()) {
            const line = normalizeLine(rawLine);
            if (afterTotal && /^总计\s*:/.test(line)) {
                errors.push('总计重复，请只粘贴一份完整报价。');
                continue;
            }
            if (/^备注\s*:/.test(line) || (afterTotal && line)) {
                noteStart = lineIndex;
                break;
            }
            if (!line || /^[—\-─_＝=]{3,}$/.test(line)) continue;
            if (/^【以下是(?:同一个|不同)仓库发货】$/.test(line)) {
                duplicate(seenGlobal, 'shipment', '发货方式');
                shipment = line.includes('不同') ? 'different' : 'same';
                continue;
            }
            const productMatch = line.match(/^产品\s*(\d*)\s*:\s*(.*)$/);
            if (productMatch) {
                current = { item: emptyProduct(), number: productMatch[1], seen: new Set(), material: null };
                current.item.product = productMatch[2].trim();
                records.push(current);
                products.push(current.item);
                if (products.length > 100) { errors.push('一次最多还原100个产品。'); break; }
                continue;
            }
            const match = line.match(/^(数量|规格|价格|材料费|木箱费|运费|加工费|辅料费|税金|总计)\s*(\d*)\s*:\s*(.*)$/);
            if (!match) { errors.push(`未识别行：${rawLine.trim().slice(0, 100)}`); continue; }
            const [, label, index, rawValue] = match;
            const value = compact(rawValue);
            if (['数量', '规格', '价格', '材料费'].includes(label)) {
                if (!current) { errors.push(`${label}前缺少产品行。`); continue; }
                duplicate(current.seen, label, `产品${records.length}的${label}`);
                if (index && index !== current.number) errors.push(`${label}${index}与所在产品编号不一致。`);
                if (label === '数量') {
                    const quantity = value.match(/^(\d+)张$/);
                    if (!quantity || !Number.isSafeInteger(Number(quantity[1])) || Number(quantity[1]) <= 0) {
                        errors.push(`产品${records.length}数量须为正整数张。`);
                    } else current.item.quantity = Number(quantity[1]);
                } else if (label === '规格') {
                    current.item.spec = rawValue.trim().replace(/[＊×xX]/g, '*');
                } else if (label === '价格') {
                    const price = value.match(new RegExp(`^原价(${numberPattern})(?:元)?/(${unitPattern}),折扣优惠价(${numberPattern})(?:元)?/(${unitPattern})$`));
                    if (!price) errors.push(`产品${records.length}价格行格式无法识别。`);
                    else {
                        current.item.originalPrice = Number(price[1]);
                        current.price = Number(price[3]);
                        current.priceMode = /张|片/.test(price[4]) ? 'sheet' : 'area';
                        if ((/张|片/.test(price[2]) ? 'sheet' : 'area') !== current.priceMode) {
                            errors.push(`产品${records.length}原价与优惠价单位不一致。`);
                        }
                    }
                } else {
                    const material = value.match(new RegExp(`^(${numberPattern})张\\*(.*?)(${numberPattern})元/(${unitPattern})=(${numberPattern})元$`));
                    if (!material) errors.push(`产品${records.length}材料费公式无法识别。`);
                    else {
                        current.item.unitPrice = Number(material[3]);
                        current.item.pricingMode = /张|片/.test(material[4]) ? 'sheet' : 'area';
                        current.formulaQuantity = Number(material[1]);
                        current.material = Number(material[5]);
                        current.dimensions = material[2];
                        if (current.item.pricingMode === 'sheet' && current.dimensions !== '') {
                            errors.push(`产品${records.length}按张公式格式不一致。`);
                        }
                        if (current.item.pricingMode === 'area' &&
                            !current.dimensions.match(new RegExp(`^${numberPattern}\\*${numberPattern}${unitPattern}\\*$`))) {
                            errors.push(`产品${records.length}按平方公式缺少宽高。`);
                        }
                    }
                }
                continue;
            }
            if (label === '木箱费' || label === '运费') {
                feeRecords.push({ label, index, value });
                continue;
            }
            duplicate(seenGlobal, label, label);
            const amount = parseAmount(value);
            if (amount === null || !Number.isSafeInteger(amount)) {
                errors.push(`${label}须为非负整数金额。`);
                continue;
            }
            if (label === '总计') { sourceTotal = amount; afterTotal = true; }
            else state.fees[{ 加工费: 'processingFee', 辅料费: 'accessoryFee', 税金: 'manualTaxFee' }[label]] = amount;
        }

        if (!products.length) errors.push('没有识别到“产品：”或“产品1：”，请粘贴报价文字，不是截图或客户修改指令。');
        state.multiMode = Boolean(shipment) || products.length > 1 || records.some(record => record.number);
        if (state.multiMode && !shipment) {
            errors.push('多产品报价缺少同仓／不同仓标题，请补全原文以确定费用归属。');
        }
        state.shipmentMode = shipment || 'same';
        records.forEach((record, index) => {
            const { item } = record;
            if (state.multiMode && record.number !== String(index + 1)) errors.push('多产品编号须从产品1开始连续排列。');
            if (!item.product) errors.push(`产品${index + 1}名称为空。`);
            if (!item.spec) errors.push(`产品${index + 1}规格为空。`);
            if (!item.quantity) errors.push(`产品${index + 1}缺少有效数量。`);
            if (record.material === null) errors.push(`产品${index + 1}缺少材料费公式，不能确定计价方式和单价。`);
            if (record.formulaQuantity !== undefined && record.formulaQuantity !== item.quantity) {
                errors.push(`产品${index + 1}数量与材料费公式不一致，请先核对原文。`);
            }
            if (record.price !== undefined &&
                (record.price !== item.unitPrice || record.priceMode !== item.pricingMode)) {
                errors.push(`产品${index + 1}价格行与材料费公式不一致，请先核对原文。`);
            }
            for (const price of [item.unitPrice, item.originalPrice]) {
                if (price !== '' && (!Number.isFinite(price) || price < 0 || Math.abs(price * 100 - Math.round(price * 100)) > 1e-6)) {
                    errors.push(`产品${index + 1}单价须为非负金额，最多两位小数。`);
                }
            }
            let rawMaterial = Number(item.quantity) * Number(item.unitPrice);
            if (item.pricingMode === 'area') {
                // Match the quote form's parseSpec semantics, including its mm/metre threshold.
                const dimensions = item.spec.replace(/\s/g, '').match(/(\d+(?:\.\d+)?)\*(\d+(?:\.\d+)?)/);
                if (!dimensions || Number(dimensions[1]) <= 0 || Number(dimensions[2]) <= 0) {
                    errors.push(`产品${index + 1}规格无法按平方计价。`);
                } else {
                    const width = Number(dimensions[1]) / (Number(dimensions[1]) > 20 ? 1000 : 1);
                    const height = Number(dimensions[2]) / (Number(dimensions[2]) > 20 ? 1000 : 1);
                    rawMaterial *= width * height;
                    // Formula dimensions are display-rounded to two decimals by the existing generator.
                    const expected = `${Number(width.toFixed(2))}*${Number(height.toFixed(2))}`;
                    if (record.dimensions && !record.dimensions.startsWith(`${expected}平`) &&
                        !record.dimensions.startsWith(`${expected}㎡`)) {
                        warnings.push(`产品${index + 1}公式宽高与规格显示不一致，将按规格重新计算。`);
                    }
                }
            }
            record.computed = roundedMaterial(rawMaterial);
            if (record.material !== null && record.computed !== record.material) {
                warnings.push(`产品${index + 1}原材料费${record.material}元，按现有规格、数量和单价重算为${record.computed}元。`);
            }
        });

        const feeKeys = new Set();
        let lalamoveCount = 0;
        feeRecords.forEach(({ label, index, value }) => {
            const separate = state.multiMode && state.shipmentMode === 'different';
            const record = index ? records[Number(index) - 1] : null;
            if ((separate && (!record || record.number !== index)) || (!separate && index)) {
                errors.push(`${label}${index}无法对应当前发货方式。`);
                return;
            }
            duplicate(feeKeys, `${label}${index}`, `${label}${index}`);
            const target = separate ? record.item : state.multiMode ? state.multi : state.single;
            let amount = parseAmount(value);
            if (label === '运费' && value === '到付') amount = 0;
            if (label === '运费' && value === '货拉拉到付') { amount = 0; lalamoveCount++; }
            if (label === '木箱费' && value === '0元(货拉拉不用木箱)') amount = 0;
            if (amount === null || !Number.isSafeInteger(amount)) {
                errors.push(`${label}${index}无法识别；到付运费不能作为已含金额计入总计。`);
            } else target[label === '木箱费' ? 'boxFee' : 'freightFee'] = amount;
        });
        state.lalamove = lalamoveCount > 0;
        const feeTargets = state.multiMode && state.shipmentMode === 'different' ? products
            : [state.multiMode ? state.multi : state.single];
        if (state.lalamove && (lalamoveCount !== feeTargets.length ||
            feeTargets.some(item => item.boxFee > 0 || item.freightFee > 0))) {
            errors.push('货拉拉与其它费用混用，无法作为整单货拉拉还原，请核对原文。');
        }
        if (feeRecords.some(fee => fee.value.includes('货拉拉')) && !state.lalamove) {
            errors.push('货拉拉木箱说明缺少对应“运费：货拉拉到付”。');
        }
        feeTargets.forEach((target, index) => {
            const suffix = state.multiMode && state.shipmentMode === 'different' ? String(index + 1) : '';
            if (!feeKeys.has(`木箱费${suffix}`)) warnings.push(`原文缺少木箱费${suffix}，回填为0，请核对。`);
            if (suffix && !feeKeys.has(`运费${suffix}`)) warnings.push(`原文缺少运费${suffix}，回填为0（到付），请核对。`);
        });

        const note = noteStart < 0 ? '' : lines.slice(noteStart).join('\n').trim();
        if (/^[\s>＞|｜]*产品\s*\d*\s*[:：].*\n[\s>＞|｜]*数量\s*[:：]/m.test(note)) {
            errors.push('检测到第二份报价或备注中的完整产品段，请每次只粘贴一份报价。');
        }
        const noteLines = note.split('\n');
        let matchedNote = false;
        for (const standardNote of standardNotes) {
            const expectedNote = compact(standardNote);
            let prefix = '';
            for (let count = 1; count <= noteLines.length; count++) {
                prefix += compact(noteLines[count - 1]);
                if (prefix === expectedNote) {
                    state.noteExtra = noteLines.slice(count).join('\n').trim();
                    matchedNote = true;
                    break;
                }
                if (prefix.length >= expectedNote.length) break;
            }
            if (matchedNote) break;
        }
        if (note && !matchedNote) {
            state.replaceDefaultNote = true;
            state.noteExtra = note;
            warnings.push('原文备注为自定义内容，已完整保留并替代默认备注；修改费用后请同步核对其中的含税／运费说明。');
        }
        if (matchedNote) {
            const hasFreight = feeTargets.some(item => item.freightFee > 0);
            const noteHasFreight = !/不含运费/.test(note) && /含运费/.test(note);
            if (noteHasFreight !== hasFreight) warnings.push('原文备注的含运费说明与费用不一致，将按费用重新生成默认备注。');
            if (/不含税金/.test(note) && state.fees.manualTaxFee > 0) {
                warnings.push('原文备注写不含税金，但有税金金额，将按含税重新生成默认备注。');
            }
        }
        if (!note) warnings.push('原文没有备注，将使用工具默认备注。');
        if (state.fees.manualTaxFee > 0) {
            warnings.push(`税金${state.fees.manualTaxFee}元按手填金额还原，不反推税率；改数量或价格后请重新核对税金。`);
        } else if (note && /(?:^|[，,；;\s])含税金/.test(note)) {
            warnings.push('原文注明含税金但没有税金金额，无法恢复税率；请核对税金设置。');
        }
        const computedTotal = records.reduce((sum, record) => sum + record.computed, 0) +
            feeTargets.reduce((sum, item) => sum + item.boxFee + item.freightFee, 0) +
            Object.values(state.fees).reduce((sum, amount) => sum + amount, 0);
        if (sourceTotal === null) warnings.push('未识别原文总计，将按回填字段重新计算。');
        else if (computedTotal !== sourceTotal) warnings.push(`原文总计${sourceTotal}元，重新计算为${computedTotal}元，请核对差额。`);
        if (!Number.isSafeInteger(computedTotal) || computedTotal < 0) errors.push('重算金额超出安全范围。');
        if (state.multiMode) {
            state.multi.products = products;
            state.single = { ...products[0], ...(state.shipmentMode === 'same'
                ? { boxFee: state.multi.boxFee, freightFee: state.multi.freightFee } : {}) };
        } else {
            state.single = { ...products[0], boxFee: state.single.boxFee, freightFee: state.single.freightFee };
            state.multi = { boxFee: state.single.boxFee, freightFee: state.single.freightFee,
                products: [{ ...state.single }, emptyProduct()] };
        }
        return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)],
            state, products, sourceTotal, computedTotal };
    }

    const api = { parse };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.QuoteImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
