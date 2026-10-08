(function () {
  const specs = {
    hard: [
      { label: "1220*2440mm", key: "hard-2440", unitWeight: 30, lengthType: "short", material: "hard" },
      { label: "1220*3050mm", key: "hard-3050", unitWeight: 38, lengthType: "long", material: "hard" },
      { label: "1200*600mm", key: "hard-600", unitWeight: 7.5, lengthType: "small", material: "hard" }
    ],
    soft: [
      { label: "1200*2440mm", key: "soft-2440", unitWeight: 15, lengthType: "short", material: "soft" },
      { label: "1200*3000mm", key: "soft-3000", unitWeight: 20, lengthType: "long", material: "soft" }
    ]
  };

  const crates = {
    short: [
      { name: "木箱7", outer: "2.53*1.31*0.25", weight: 65, hardCap: 15, softCap: 30 },
      { name: "木箱7", outer: "2.53*1.31*0.35", weight: 70, hardCap: 30, softCap: 60 },
      { name: "木箱7", outer: "2.53*1.31*0.45", weight: 75, hardCap: 45, softCap: 90 },
      { name: "木箱7", outer: "2.53*1.31*0.7", weight: 90, hardCap: 88, softCap: 176 }
    ],
    long: [
      { name: "木箱9", outer: "3.09*1.31*0.3", weight: 92, hardCap: 15, softCap: 30 },
      { name: "木箱9", outer: "3.09*1.31*0.35", weight: 100, hardCap: 30, softCap: 60 },
      { name: "木箱9", outer: "3.09*1.31*0.45", weight: 108, hardCap: 45, softCap: 90 },
      { name: "木箱9", outer: "3.09*1.28*0.55", weight: 116, hardCap: 60, softCap: 120 }
    ]
  };

  const pallets = {
    short: { label: "2米托盘", size: "2.46*1.25*0.25", weight: 46 },
    long: { label: "3米托盘", size: "3.15*1.35*0.16", weight: 65 },
    small: { label: "小托盘", weight: 16 }
  };

  function specDimensions(value) {
    const matches = String(value || "")
      .replace(/[×xX]/g, "*")
      .match(/\d+(?:\.\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const first = Number(matches[0]);
    const second = Number(matches[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
    return [Math.min(first, second), Math.max(first, second)];
  }

  function matchSpecKey(material, specText) {
    const group = specs[material] || [];
    const direct = group.find((item) => item.key === specText);
    if (direct) return direct.key;

    const numericParts = String(specText || "")
      .replace(/[×xX]/g, "*")
      .match(/\d+(?:\.\d+)?/g)
      ?.map(Number) || [];
    const thicknessParts = numericParts.slice(2);
    if (thicknessParts.length) {
      const supportedThickness = material === "soft"
        ? thicknessParts.every((value) => value >= 2 && value <= 3)
        : thicknessParts.length === 1 && thicknessParts[0] === 6;
      if (!supportedThickness) return null;
    }

    const target = specDimensions(specText);
    if (!target) return null;
    const matched = group.find((item) => {
      const dimensions = specDimensions(item.label);
      return dimensions && dimensions[0] === target[0] && dimensions[1] === target[1];
    });
    return matched ? matched.key : null;
  }

  function specByKey(material, specKey) {
    const group = specs[material] || [];
    return group.find((item) => item.key === specKey) || null;
  }

  function resolveFreightSpec(specText) {
    const text = String(specText || "").replace(/毫米/ig, "mm");
    const values = text.replace(/[×xX]/g, "*").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
    const thicknesses = values.slice(2);
    let material = null;
    if (/软质/.test(text)) material = "soft";
    if (/硬质/.test(text)) material = material ? null : "hard";
    if (!material && thicknesses.length) {
      if (thicknesses.every((value) => value >= 2 && value <= 3)) material = "soft";
      else if (thicknesses.length === 1 && thicknesses[0] === 6) material = "hard";
    }
    if (!material) return null;
    const specKey = matchSpecKey(material, text);
    return specKey ? { material, specKey } : null;
  }

  function dbRateForSpec(specValue) {
    const source = specValue && typeof specValue === "object"
      ? (specValue.label || specValue.value || specValue.key || "")
      : specValue;
    const dimensions = specDimensions(source);
    if (!dimensions) return null;

    const [shortSide, longSide] = dimensions;
    if (shortSide <= 600 && longSide <= 1200) return 0.5;
    if (shortSide <= 600) return 0.75;
    return 1.5;
  }

  function calculateDb(rawItems) {
    let unsupported = false;
    const amount = (rawItems || []).reduce((sum, item) => {
      const quantity = Number(String(item.quantity ?? item.qty ?? '').trim());
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        unsupported = true;
        return sum;
      }
      if (quantity === 0) return sum;

      const material = item.material === "soft" ? "soft" : "hard";
      const spec = item.spec && item.spec.label
        ? item.spec
        : specByKey(material, item.specKey) || item.specText || item.spec;
      const rate = dbRateForSpec(spec);
      if (!Number.isFinite(rate)) {
        unsupported = true;
        return sum;
      }
      return sum + quantity * rate;
    }, 0);

    return unsupported ? null : Math.min(100, Math.round(amount + Number.EPSILON));
  }

  function normalizeItem(item) {
    const material = item.material === "soft" ? "soft" : "hard";
    const suppliedSpec = item.spec && item.spec.key
      && Number.isFinite(Number(item.spec.unitWeight))
      && ["short", "long", "small"].includes(item.spec.lengthType)
      ? item.spec
      : null;
    const spec = suppliedSpec || specByKey(material, item.specKey);
    const quantity = Number(String(item.quantity ?? '').trim());
    return { ...item, material, spec, quantity };
  }

  function shipmentLengthType(items) {
    if (items.some((item) => item.spec.lengthType === "long")) return "long";
    if (items.some((item) => item.spec.lengthType === "short")) return "short";
    return "small";
  }

  function shipmentSpecLabel(items) {
    return items.map((item) => item.spec.label).join(" + ");
  }

  function boardWeightLine(items) {
    return items.map((item) => `${item.quantity}*${item.spec.unitWeight}`).join("+");
  }

  function boardWeight(items) {
    return items.reduce((sum, item) => sum + item.quantity * item.spec.unitWeight, 0);
  }

  function hardEquivalentQuantity(items) {
    return items.reduce((sum, item) => sum + item.quantity * (item.material === "soft" ? 0.5 : 1), 0);
  }

  function formatWeight(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  }

  function packageQuestionLine(pkg) {
    if (!pkg) return "";
    if (pkg.type === "pallet" && pkg.size) return `${pkg.label}：${pkg.size}`;
    return pkg.output;
  }

  function choosePackage(items, lengthType) {
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (lengthType === "small") {
      const palletCount = quantity > 100 ? Math.ceil(quantity / 100) : 1;
      const weight = pallets.small.weight * palletCount;
      return {
        ...pallets.small,
        weight,
        type: "pallet",
        output: palletCount > 1 ? `${pallets.small.label} x ${palletCount}` : pallets.small.label
      };
    }

    const equivalentQuantity = hardEquivalentQuantity(items);
    if (equivalentQuantity <= 10) {
      return { ...pallets[lengthType], type: "pallet", output: pallets[lengthType].label };
    }

    const crate = crates[lengthType].find((entry) => equivalentQuantity <= entry.hardCap);
    if (crate) {
      return { ...crate, type: "crate", output: crate.outer };
    }

    return null;
  }

  function maxCapacity(lengthType) {
    if (lengthType === "small") return 100;
    return lengthType === "short" ? 88 : 60;
  }

  function calculateShipment(rawItems) {
    if (rawItems.some((item) => {
      const quantity = Number(String(item.quantity ?? '').trim());
      return !Number.isSafeInteger(quantity) || quantity < 0;
    })) return { ok: false, type: 'invalid-quantity', message: '每一组规格的数量必须是大于 0 的整数，请修正后再计算。' };
    const items = rawItems
      .map(normalizeItem)
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!items.length) {
      return { ok: false, type: "empty", message: "请填写至少一组规格数量" };
    }

    if (items.some((item) => !item.spec)) {
      return {
        ok: false,
        type: "unsupported-spec",
        message: "存在不支持的鎏金板规格，请手动确认后再计算运费"
      };
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const lengthType = shipmentLengthType(items);
    const pkg = choosePackage(items, lengthType);
    const db = calculateDb(items);
    const dbLine = `DB${formatMoney(db)}`;

    if (!pkg) {
      const max = maxCapacity(lengthType);
      const message = `当前合计 ${formatWeight(hardEquivalentQuantity(items))} 张硬质等效数量超过表格最大可装数量（${max}张），请拆分多箱后再提交。`;
      return { ok: false, type: "overflow", message, dbLine };
    }

    const boardTotal = boardWeight(items);
    const totalWeight = boardTotal + pkg.weight;
    const detailLine = shipmentSpecLabel(items);
    const weightLine = `${boardWeightLine(items)}+${pkg.weight}=${formatWeight(totalWeight)}KG`;
    const packageLine = packageQuestionLine(pkg);
    const notice = pkg.type === "pallet"
      ? `合计${totalQuantity}张，硬软混装按硬质等效 ${formatWeight(hardEquivalentQuantity(items))} 张核算，在优先托盘范围内，使用${pkg.output}，包装重量 ${pkg.weight}KG。`
      : `合计${totalQuantity}张，硬软混装按硬质等效 ${formatWeight(hardEquivalentQuantity(items))} 张核算，按最长规格匹配${pkg.name}，外径 ${pkg.outer}，木箱重量 ${pkg.weight}KG。`;

    return {
      ok: true,
      items,
      totalQuantity,
      lengthType,
      pkg,
      boardTotal,
      totalWeight,
      db,
      detailLine,
      weightLine,
      packageLine,
      dbLine,
      notice
    };
  }

  function packageDimensionText(pkg) {
    if (!pkg) return "";
    return pkg.size || pkg.outer || "";
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return "-";
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  }

  function bestData() {
    return window.BEST_RATE_DATA || {};
  }

  function containsPlace(text, name) {
    const index = text.indexOf(name);
    return index >= 0 && !/^[路街巷道]/.test(text.slice(index + name.length));
  }

  function matchBestRate(address, heavy = false) {
    const text = String(address || "").replace(/\s+/g, "");
    if (!text || text === "请粘贴地址") return { type: "empty" };
    const data = bestData();
    const standardRows = data.standardRows || [];
    const heavyRows = data.heavyRows || [];
    const explicit = standardRows.filter(row => containsPlace(text, row.province));
    const prefixed = standardRows.filter(row => text.startsWith(row.region)
      && !/^[路街巷道]/.test(text.slice(row.region.length)));
    let regions = [...new Set([...explicit, ...prefixed].map(row => row.region))];
    if (!regions.length) {
      // A district alone cannot identify its province; only table-listed cities can.
      regions = [...new Set(heavyRows.filter(row => /市$|自治州$/.test(row.city)
        && containsPlace(text, row.city)).map(row => row.region))];
    }
    if (regions.length > 1) return { type: "ambiguous", regions };
    if (!regions.length) return { type: "none" };
    const region = regions[0];
    const provinceRow = standardRows.find(row => row.region === region);
    if (!heavy) return { type: "rate", row: provinceRow };
    const provinceRows = heavyRows.filter(row => row.region === region);
    if (!provinceRows.length) return { type: "missing-heavy", region };
    let localText = text;
    for (const prefix of [provinceRow.province, provinceRow.region]) {
      if (localText.startsWith(prefix)) { localText = localText.slice(prefix.length); break; }
    }
    const candidates = provinceRows.filter(row => {
      if (row.city === "市区") return localText.startsWith("市区");
      if (containsPlace(text, row.city)) return true;
      const shortName = row.city.replace(/自治州$|市$|区$|县$/, "");
      return localText.startsWith(shortName) && !/^[路街巷道]/.test(localText.slice(shortName.length));
    });
    const cities = [...new Set(candidates.map(row => row.city))];
    if (!cities.length) return { type: "missing-city", region };
    if (cities.length > 1) return { type: "ambiguous-city", region, cities };
    const override = (data.confirmedOverrides || []).find(item => item.region === region && item.city === cities[0]);
    if (override) {
      const confirmedRow = candidates.find(row => row.rate === override.rate);
      if (confirmedRow) return { type: "rate", row: confirmedRow, confirmation: override.note };
    }
    const prices = new Set(candidates.map(row => `${row.rate}/${row.delivery}/${row.eta}`));
    if (prices.size > 1) return { type: "conflict", region, city: cities[0], rows: candidates };
    return { type: "rate", row: candidates[0] };
  }

  function manualBestQuote(address, message, processText) {
    return {
      quoted: false,
      totalText: "人工询价",
      quoteText: `${address ? `${address}\n\n` : ""}${message}`,
      processText
    };
  }

  function roundMoney(value) {
    const cents = Number(value) * 100;
    return Math.round(cents + Math.abs(cents) * Number.EPSILON) / 100;
  }

  function bestInsuranceFee(weight) {
    const value = Number(weight);
    return Number.isFinite(value) && value > 0 ? Math.ceil(value / 300) * 5 : 0;
  }

  function buildBestQuote({ address, totalWeight, pkg, weightLine, packageLine, dbLine, db = 0, destinationPickup = false, paymentMode = "collect" }) {
    if (!Number.isFinite(totalWeight) || totalWeight <= 0 || !pkg) {
      return { quoted: false, totalText: "-", quoteText: "请填写地址和规格数量", processText: "自动显示计算过程" };
    }
    if (!Number.isFinite(db) || db < 0) {
      return manualBestQuote(address, "DB金额不完整，请人工确认。", "请先完成公共重量、包装和DB核算。");
    }
    if (paymentMode !== "collect" && paymentMode !== "prepaid") {
      return manualBestQuote(address, "请确认百世运费付款方式。", "到付加3%，我们付不加3%；两种方式最终均向上取整到元。");
    }
    const provinceMatch = matchBestRate(address);
    if (provinceMatch.type === "empty") {
      return { quoted: false, totalText: "-", quoteText: "请先填写收货地址", processText: "需要地址后才能匹配百世快运费率。" };
    }
    const dimensionText = String(packageDimensionText(pkg));
    const parts = dimensionText.split(/[×xX*]/).map(part => part.trim());
    const dimensions = parts.map(Number);
    const rawVolume = dimensions.reduce((volume, value) => volume * value, 1);
    if (parts.length !== 3 || parts.some(part => !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(part))
      || dimensions.some(value => !Number.isFinite(value) || value <= 0)
      || !Number.isFinite(rawVolume) || rawVolume <= 0) {
      return manualBestQuote(address, "包装长宽高不完整，无法核算百世体积重，请人工确认。", "百世按实重与体积重取较大值；缺少尺寸时不猜体积，也不直接套实际重量报价。");
    }
    const volume = roundMoney(rawVolume);
    const volumetricWeight = roundMoney(volume * 200);
    if (!Number.isFinite(volumetricWeight)) {
      return manualBestQuote(address, "包装尺寸超出有效计算范围，请人工确认。", "无法取得有效体积重，不继续生成运费。");
    }
    const chargeWeight = Math.max(totalWeight, volumetricWeight);
    const isVolumetric = volumetricWeight > totalWeight;
    const heavy = chargeWeight > 1000;
    const match = heavy ? matchBestRate(address, true) : provinceMatch;
    if (match.type === "none") {
      return manualBestQuote(address, "未匹配到百世快运费率，请补充省市后人工确认。", "不会按道路名称推测目的地，也不会使用其它省市的价格。");
    }
    if (match.type === "ambiguous") {
      return manualBestQuote(address, "地址中识别到多个省级地区，请人工确认目的地。", `识别到：${match.regions.join("、")}。系统不按出现顺序猜测。`);
    }
    if (match.type === "missing-heavy") {
      return manualBestQuote(address, `${match.region}在1吨以上报价表中没有价格，请人工询价。`, "超过1000KG不能沿用1吨以下价格或套用其它省份。");
    }
    if (match.type === "missing-city") {
      return manualBestQuote(address, `${match.region}重货未匹配到具体目的地，请补充城市或区县并人工核对。`, "重货按表内城市/区县计价；“市区”范围原表未定义，不把所有未列区县自动归入市区。");
    }
    if (match.type === "ambiguous-city") {
      return manualBestQuote(address, "识别到多个重货目的地，请人工确认。", `识别到：${match.cities.join("、")}。`);
    }
    if (match.type === "conflict") {
      return manualBestQuote(address, `${match.region}${match.city}原表存在冲突价格，请人工询价。`, `重货表${match.rows.map(row => `第${row.sourceRow}行：${row.rate}元/KG`).join("；")}。不自动取高价或低价。`);
    }
    const row = match.row;
    const rate = heavy ? row.rate : row.rates[chargeWeight <= 500 ? 0 : 1];
    if (!Number.isFinite(rate) || rate <= 0 || (heavy && !Number.isFinite(row.delivery))) {
      return manualBestQuote(address, "目的地价格数据不完整，请人工询价。", "没有可用单价或送货费，不按0元计费。");
    }
    const tierLabel = heavy ? "1000KG以上" : chargeWeight <= 500 ? "500KG以内" : "超过500至1000KG";
    const freightFee = roundMoney(chargeWeight * rate);
    const insuranceFee = bestInsuranceFee(chargeWeight);
    const listedDeliveryFee = heavy ? row.delivery : 0;
    const deliveryFee = heavy && chargeWeight < 5000 && !destinationPickup ? listedDeliveryFee : 0;
    const deliveryReason = !heavy ? "1吨以内门到门已含送货，不含上楼费"
      : destinationPickup ? "到站自提，免送货费"
      : chargeWeight >= 5000 ? "计费重量5吨及以上免送货费" : "按目的地送货费";
    const subtotal = roundMoney(freightFee + insuranceFee + deliveryFee + db);
    const isCollect = paymentMode === "collect";
    // 用整数分计算百分比，避免整数边界的浮点尾差；加3%后不先舍入到分。
    const payableBeforeRounding = Math.round(subtotal * 100) * (isCollect ? 103 : 100) / 10000;
    const totalFee = Math.ceil(payableBeforeRounding);
    const payableText = payableBeforeRounding.toFixed(4).replace(/\.?0+$/, "");
    const paymentLine = isCollect
      ? `到付：${formatMoney(subtotal)}元*1.03=${payableText}元，向上取整=${formatMoney(totalFee)}元`
      : `我们付：${formatMoney(subtotal)}元（不加3%），向上取整=${formatMoney(totalFee)}元`;
    const feeSummary = `运费${formatMoney(freightFee)}元、易碎品保险${formatMoney(insuranceFee)}元、送货费${formatMoney(deliveryFee)}元、DB${formatMoney(db)}元`;
    const caveat = "预估仅供核对；偏远/特殊派送区域、上楼及未列费用另询。";
    const volumeLine = `体积：${dimensionText}=${formatMoney(volume)}方（四舍五入保留2位）`;
    const volumetricLine = `体积重：${formatMoney(volume)}方*200KG/方=${formatWeight(volumetricWeight)}KG`;
    const chargeLine = `计费重量：实重${formatWeight(totalWeight)}KG与体积重${formatWeight(volumetricWeight)}KG取大值=${formatWeight(chargeWeight)}KG（${isVolumetric ? "抛货" : "按实重"}）`;
    const quoteText = [address, "", weightLine, packageLine, volumeLine, volumetricLine, chargeLine, dbLine, "", `费用小计：${formatMoney(subtotal)}元（${feeSummary}）`, paymentLine, `百世快运预估：${formatMoney(totalFee)}元`, `送货：${deliveryReason}。`, caveat].filter(line => line !== undefined).join("\n");
    const source = heavy ? `${bestData().heavyFile} · 重货!D${row.sourceRow}:F${row.sourceRow}` : `${bestData().standardFile} · Sheet1!B${row.sourceRow}:D${row.sourceRow}`;
    const processText = [
      `费率来源：${source}，2026-09-22`,
      `匹配：${row.region}${heavy ? ` · ${row.city}` : ""}，时效约${row.eta}`,
      match.confirmation || "",
      `实际总重量：${formatWeight(totalWeight)}KG（含包装）`,
      volumeLine,
      volumetricLine,
      chargeLine,
      `运费：${formatWeight(chargeWeight)}KG*${formatMoney(rate)}元/KG=${formatMoney(freightFee)}元（${tierLabel}）`,
      `易碎品保险：按计费重量每开始300KG收5元，${Math.ceil(chargeWeight / 300)}档*5=${formatMoney(insuranceFee)}元`,
      `送货费：${formatMoney(deliveryFee)}元（${deliveryReason}${heavy && deliveryFee === 0 ? `；表列${formatMoney(listedDeliveryFee)}元` : ""}）`,
      !heavy && destinationPickup ? "1吨以内原表未单列可扣减的送货费，自提不自动减价。" : "",
      `DB：${formatMoney(db)}元`,
      `费用小计：${formatMoney(freightFee)}+${formatMoney(insuranceFee)}+${formatMoney(deliveryFee)}+${formatMoney(db)}=${formatMoney(subtotal)}元`,
      paymentLine,
      heavy ? "原表表头写“元/吨”，用户已确认数值实际按元/公斤；重货报价含税。" : "",
      caveat
    ].filter(Boolean).join("\n");
    return { quoted: true, totalText: `${formatMoney(totalFee)}元`, quoteText, processText, freightFee, insuranceFee, listedDeliveryFee, deliveryFee, subtotal, paymentMode, payableBeforeRounding, totalFee, actualWeight: totalWeight, volume, volumetricWeight, chargeWeight, isVolumetric, rate, tierLabel };
  }

  window.GoldFreightCore = {
    specs,
    crates,
    pallets,
    matchSpecKey,
    resolveFreightSpec,
    specByKey,
    dbRateForSpec,
    calculateDb,
    normalizeItem,
    calculateShipment,
    formatWeight,
    packageQuestionLine,
    bestInsuranceFee,
    matchBestRate,
    buildBestQuote
  };
})();
