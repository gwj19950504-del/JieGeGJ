(function () {
  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()（）]/g, "");
  }

  function parseSize(value) {
    const match = String(value || "").replace(/[xX×]/g, "*").match(/(?:^|[^\d.+-])(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)/);
    if (!match) return { length: 0, width: 0 };
    const first = Number(match[1]) || 0;
    const second = Number(match[2]) || 0;
    return { length: Math.max(first, second), width: Math.min(first, second) };
  }

  function productFamily(name) {
    const text = String(name || "");
    if (text.includes("花岗岩")) return "花岗岩";
    if (text.includes("星月石")) return "星月石";
    if (text.includes("黑山岩")) return "黑山岩";
    if (text.includes("洞石")) return "洞石";
    return "";
  }

  function isSmallBoardSpec(spec) {
    const dimensions = parseSize(spec);
    return dimensions.length === 1200 && dimensions.width === 600;
  }

  function requiresFinishChoice(name, spec) {
    if (isSmallBoardSpec(spec)) return false;
    return ["莱姆石", "洞石", "平板"].some((keyword) => String(name || "").includes(keyword));
  }

  function roundUpHalf(value) {
    return Math.ceil(value * 2) / 2;
  }

  function singlePackage(item) {
    const family = item.family || productFamily(item.name);
    const isSmallSize = isSmallBoardSpec(item.spec);
    const plywoodLimits = { "洞石": 10, "花岗岩": 10, "星月石": 6, "黑山岩": 6 };
    const smallCrateLimits = { "洞石": 240, "花岗岩": 160, "星月石": 80, "黑山岩": 80 };

    if (isSmallSize && family) {
      if (item.qty <= plywoodLimits[family]) {
        return { type: "夹板", weight: 10, rule: `${family} 1200*600，${plywoodLimits[family]}片以内` };
      }
      if (item.qty <= smallCrateLimits[family]) {
        return { type: "小木箱", weight: 30, rule: `${family} 1200*600，${smallCrateLimits[family]}片以内` };
      }
      return { type: "大木箱", weight: 65, rule: `${family} 1200*600，超过${smallCrateLimits[family]}片` };
    }

    if (!isSmallSize && family && item.qty === 1 && item.kgPerSqm <= 7.5) {
      const plywoodSheets = roundUpHalf(item.area * 2 / (1.22 * 2.44));
      const plywoodWeight = plywoodSheets * 20;
      const packedWeight = item.productWeight + plywoodWeight;
      if (packedWeight <= 80) {
        return {
          type: "大夹板",
          weight: plywoodWeight,
          plywoodSheets,
          packedWeight,
          rule: `${family}非1200*600单张夹板`
        };
      }
    }

    if (requiresFinishChoice(item.name, item.spec)) {
      if (item.finishType === "color") return { type: "大木箱", weight: 65, rule: "上色产品使用大木箱" };
      if (item.qty <= 6) return { type: "小木箱", weight: 30, rule: "打印产品 6片以内" };
      return { type: "大木箱", weight: 65, rule: "打印产品超过6片" };
    }

    return { type: "大木箱", weight: 65, rule: "其他产品统一使用大木箱" };
  }

  function normalizeItem(source, index) {
    const dims = parseSize(source.spec);
    const qty = Math.max(0, Math.floor(Number(source.qty) || 0));
    const kgPerSqm = Math.max(0, Number(source.kgPerSqm) || 0);
    const thickness = Math.max(0, Number(source.thickness) || 0);
    const area = dims.length / 1000 * dims.width / 1000;
    const rawWeight = area * kgPerSqm;
    const sheetWeight = Math.ceil(rawWeight);
    const productWeight = sheetWeight * qty;
    return {
      id: source.id || `item-${index + 1}`,
      name: String(source.name || "未命名产品"),
      spec: String(source.spec || ""),
      qty,
      kgPerSqm,
      thickness,
      family: source.family || productFamily(source.name),
      finishType: source.finishType || "print",
      length: dims.length,
      width: dims.width,
      area,
      rawWeight,
      sheetWeight,
      productWeight
    };
  }

  function calculateShipment(sources) {
    const activeSources = (Array.isArray(sources) ? sources : [])
      .filter((item) => item && item.qty !== "" && item.qty != null && Number(item.qty) !== 0);
    if (activeSources.some((item) => {
      const dims = parseSize(item.spec);
      return !Number.isSafeInteger(Number(item.qty)) || Number(item.qty) < 0
        || ![dims.length, dims.width, Number(item.kgPerSqm), Number(item.thickness)].every((value) => Number.isFinite(value) && value > 0);
    })) return null;
    const items = activeSources.map(normalizeItem);
    if (!items.length) return null;

    const productWeight = items.reduce((sum, item) => sum + item.productWeight, 0);
    const crateLength = Math.max(...items.map((item) => item.length)) + 100;
    const crateWidth = Math.max(...items.map((item) => item.width)) + 100;
    const contentThickness = items.reduce((sum, item) => sum + item.thickness * item.qty, 0);
    const crateHeight = Math.ceil(contentThickness + 200);
    // 同一产品拆成多行不能绕过包装数量门槛；仅合并参数完全一致的行。
    const packageGroups = new Map();
    items.forEach((item) => {
      const key = JSON.stringify([item.name, item.length, item.width, item.family, item.finishType, item.kgPerSqm, item.thickness]);
      const group = packageGroups.get(key);
      if (group) {
        group.qty += item.qty;
        group.productWeight += item.productWeight;
      } else packageGroups.set(key, { ...item });
    });
    const itemPackages = Array.from(packageGroups.values(), singlePackage);
    let crate;

    if (itemPackages.length === 1) {
      crate = itemPackages[0];
    } else {
      const needsLargeCrate = itemPackages.some((item) => item.weight >= 65);
      crate = {
        type: needsLargeCrate ? "大木箱" : "小木箱",
        weight: needsLargeCrate ? 65 : 30,
        rule: "多产品合装一个木箱；长宽取各产品最大值，厚度累计"
      };
    }

    const packageWeight = crate.weight;
    const shippingWeight = productWeight + packageWeight;
    const weightTerms = items.map((item) => `${item.qty}*${item.sheetWeight}`);
    const packageLabel = crate.type.includes("夹板") ? "夹板" : "木箱";

    return {
      items,
      productWeight,
      packageWeight,
      shippingWeight,
      crate,
      crateLength,
      crateWidth,
      crateHeight,
      contentThickness,
      expression: `${weightTerms.join("+")}+${packageWeight}=${shippingWeight}KG`,
      crateLines: [`${packageLabel}：${crateWidth}*${crateLength}*${crateHeight}mm`]
    };
  }

  window.NingboFreightCore = {
    calculateShipment,
    parseSize,
    isSmallBoardSpec,
    productFamily,
    requiresFinishChoice
  };
})();
