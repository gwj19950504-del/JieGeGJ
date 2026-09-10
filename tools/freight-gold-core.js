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
    short: { label: "2米拖盘", size: "2.46*1.25*0.25", weight: 46 },
    long: { label: "3米拖盘", size: "3.15*1.35*0.16", weight: 65 },
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
      const quantity = Number.parseInt(String(item.quantity ?? item.qty ?? "").trim(), 10);
      if (!Number.isFinite(quantity) || quantity <= 0) return sum;

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
    const quantity = Number.parseInt(String(item.quantity || "").trim(), 10);
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

  function shunxinData() {
    return window.SHUNXIN_RATE_DATA || {};
  }

  function matchShunxinRate(address) {
    const text = String(address || "").replace(/\s+/g, "");
    if (!text || text === "请粘贴地址") return { type: "empty" };

    const data = shunxinData();
    const specialArea = (data.specialAreas || []).find((area) => {
      if (area.endsWith("岛")) return text.includes(area);
      return text.includes(`${area}市`) || text.includes(`省${area}`) || text.startsWith(area);
    });
    if (specialArea) return { type: "special", area: specialArea };

    const candidates = (data.rows || []).flatMap((row, rowIndex) =>
      (row.aliases || []).map((alias, aliasIndex) => ({
        row,
        rowIndex,
        alias,
        aliasIndex,
        index: alias ? text.indexOf(alias) : -1,
        administrative: /省$|市$|自治区$/.test(alias || "") ? 1 : 0
      })).filter((item) => item.index >= 0 && (item.administrative || (item.aliasIndex === 0 && item.index === 0)))
    );
    const explicitRegions = [...new Set(candidates.filter((item) => item.administrative).map((item) => item.row.region))];
    if (explicitRegions.length > 1) return { type: "ambiguous", regions: explicitRegions };
    candidates.sort((a, b) =>
      b.administrative - a.administrative
      || a.index - b.index
      || b.alias.length - a.alias.length
      || a.rowIndex - b.rowIndex
    );
    return candidates.length ? { type: "rate", row: candidates[0].row } : { type: "none" };
  }

  function shunxinTier(chargeWeight) {
    const tiers = shunxinData().tiers || [];
    const index = tiers.findIndex((tier) => {
      const min = Number(tier.min);
      const max = tier.max === null || tier.max === undefined ? null : Number(tier.max);
      const aboveMin = tier.minExclusive ? chargeWeight > min : chargeWeight >= min;
      const belowMax = max === null ? true : (tier.maxExclusive ? chargeWeight < max : chargeWeight <= max);
      return Number.isFinite(min) && aboveMin && belowMax;
    });
    return index >= 0 ? { index, tier: tiers[index] } : null;
  }

  function packageDimensions(pkg) {
    const values = packageDimensionText(pkg).match(/\d+(?:\.\d+)?/g);
    if (!values || values.length < 3) return null;
    const dimensions = values.slice(0, 3).map(Number);
    return dimensions.every((value) => Number.isFinite(value) && value > 0) ? dimensions : null;
  }

  function manualShunxinQuote(address, message, processText) {
    return {
      totalText: "人工询价",
      quoteText: `${address ? `${address}\n\n` : ""}${message}`,
      processText
    };
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function shunxinInsuranceFee(declaredValue) {
    const value = Number(declaredValue);
    if (!Number.isFinite(value) || value <= 2000) return 5;
    return roundMoney(value * 0.003);
  }

  function shunxinUpstairsFee(chargeWeight) {
    const weight = Number(chargeWeight);
    if (!Number.isFinite(weight) || weight <= 40) return 0;
    return roundMoney(25 + weight * 0.1);
  }

  function buildShunxinQuote({
    address,
    totalWeight,
    pkg,
    weightLine,
    packageLine,
    dbLine,
    db,
    declaredValue,
    includeUpstairsFee = false
  }) {
    if (!Number.isFinite(totalWeight) || totalWeight <= 0 || !pkg) {
      return { totalText: "-", quoteText: "请填写地址和规格数量", processText: "自动显示计算过程" };
    }

    const match = matchShunxinRate(address);
    if (match.type === "empty") {
      return { totalText: "-", quoteText: "请先填写收货地址", processText: "需要地址后才能匹配顺心捷达费率。" };
    }
    if (match.type === "special") {
      return manualShunxinQuote(
        address,
        `${match.area}需单独询价。`,
        `报价单注明${match.area}需单独询价。`
      );
    }
    if (match.type === "none") {
      return manualShunxinQuote(address, "未匹配到顺心捷达费率，请手动查询。", "当前地址没有匹配到报价表里的省份。请检查省份是否填写完整。");
    }
    if (match.type === "ambiguous") {
      return manualShunxinQuote(address, "地址中识别到多个省级地区，请人工确认目的地后询价。", `识别到：${match.regions.join("、")}。系统不按出现顺序猜测。`);
    }

    const row = match.row;
    const dimensions = packageDimensions(pkg);
    if (!dimensions) {
      return manualShunxinQuote(address, "包装尺寸不完整，请手动查询。", "顺心捷达按实际重量和体积重量取大值，当前包装缺少完整长宽高。");
    }

    const [length, width, height] = dimensions;
    const isPallet = Boolean(pkg.size);
    if (isPallet && (length + width + height > 4.8 || height > 1.8 || totalWeight > 1000)) {
      return manualShunxinQuote(
        address,
        "托盘超出顺心捷达自动报价限制，请手动查询。",
        "托盘限制：三边之和不超过4.8米、高度不超过1.8米、实际重量不超过1000KG。"
      );
    }

    const volumeWeight = length * width * height * 200;
    const chargeWeight = Math.max(totalWeight, volumeWeight);
    const tierMatch = shunxinTier(chargeWeight);
    if (!tierMatch) {
      return manualShunxinQuote(
        address,
        `计费重量${formatWeight(chargeWeight)}KG，未匹配到最新报价表重量档，请手动查询。`,
        `实际重量${formatWeight(totalWeight)}KG，体积重量${formatWeight(volumeWeight)}KG；最新报价表100KG起计，当前取大值后无法匹配报价档。`
      );
    }

    const rate = Number(row.rates[tierMatch.index]);
    if (!Number.isFinite(rate)) {
      return manualShunxinQuote(address, "当前地区缺少对应重量档价格，请手动查询。", "报价表中没有可用单价。");
    }

    const freightFee = Math.ceil(chargeWeight * rate);
    const declaredAmount = Number(declaredValue);
    const insuranceFee = shunxinInsuranceFee(declaredValue);
    const upstairsFee = shunxinUpstairsFee(chargeWeight);
    const parsedDb = Number.isFinite(Number(db))
      ? Number(db)
      : Number((String(dbLine || "").match(/\d+(?:\.\d+)?/) || [0])[0]);
    const includedUpstairsFee = includeUpstairsFee ? upstairsFee : 0;
    const totalFee = roundMoney(freightFee + insuranceFee + parsedDb + includedUpstairsFee);
    const feeSummary = [
      `运费${formatMoney(freightFee)}元`,
      `保费${formatMoney(insuranceFee)}元`,
      `DB${formatMoney(parsedDb)}元`,
      includeUpstairsFee ? `上门费${formatMoney(upstairsFee)}元` : ""
    ].filter(Boolean).join("、");
    const quoteText = `${address}\n\n${weightLine}\n${packageLine}\n${dbLine}\n\n顺心捷达预估：${formatMoney(totalFee)}元（${feeSummary}）`;
    const insuranceText = Number.isFinite(declaredAmount) && declaredAmount > 2000
      ? `保费：${formatMoney(insuranceFee)}元（${formatMoney(declaredAmount)}*0.003）`
      : `保费：${formatMoney(insuranceFee)}元（2000元以内默认保费5元）`;
    const upstairsText = upstairsFee === 0
      ? "上门费：0元（40KG以内免费）"
      : `上门费：${formatMoney(upstairsFee)}元（${includeUpstairsFee ? "已计入合计" : "未勾选，不计入合计"}）`;
    const rateData = shunxinData();
    const sourceText = rateData.source
      ? `费率来源：${rateData.source}${rateData.updatedAt ? `，更新于${rateData.updatedAt}` : ""}`
      : "";
    const conditionalFeeText = (rateData.conditionalFeeNotes || []).length
      ? `附加条件（未自动计入）：${rateData.conditionalFeeNotes.join("；")}`
      : "";
    const processText = [
      sourceText,
      `匹配：${row.region}，时效约${row.eta}${row.note ? `；${row.note}` : ""}`,
      `包装：${formatMoney(length)}*${formatMoney(width)}*${formatMoney(height)}米`,
      `实际重量：${formatWeight(totalWeight)}KG`,
      `体积重量：${formatMoney(length)}*${formatMoney(width)}*${formatMoney(height)}*200=${formatWeight(volumeWeight)}KG`,
      `计费重量：MAX(${formatWeight(totalWeight)}, ${formatWeight(volumeWeight)})=${formatWeight(chargeWeight)}KG`,
      `运费：${formatWeight(chargeWeight)}KG*${formatMoney(rate)}元/KG=${freightFee}元（${tierMatch.tier.label}）`,
      insuranceText,
      upstairsText,
      `DB：${formatMoney(parsedDb)}元`,
      `合计：${freightFee}+${formatMoney(insuranceFee)}+${formatMoney(parsedDb)}${includeUpstairsFee ? `+${formatMoney(upstairsFee)}` : ""}=${formatMoney(totalFee)}元`,
      conditionalFeeText
    ].filter(Boolean).join("\n");

    return {
      totalText: `${formatMoney(totalFee)}元`,
      quoteText,
      processText,
      freightFee,
      insuranceFee,
      upstairsFee,
      includedUpstairsFee,
      totalFee,
      chargeWeight
    };
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
    shunxinInsuranceFee,
    shunxinUpstairsFee,
    matchShunxinRate,
    buildShunxinQuote
  };
})();
