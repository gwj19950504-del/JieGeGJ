(function attachQuoteMath(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.QuoteMath = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createQuoteMath() {
  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  // Keep the quote-generator's existing rounding rule: inspect only the first
  // decimal digit; 0-3 rounds down and 4-9 rounds up.
  function sanSheSiRu(value) {
    if (!Number.isFinite(value)) return 0;
    const floor = Math.floor(value);
    const firstDecimal = Math.floor((value - floor) * 10 + 1e-8);
    return firstDecimal <= 3 ? floor : floor + 1;
  }

  function productArea(product) {
    const widthMm = money(product.width);
    const heightMm = money(product.height);
    const quantity = money(product.qty);
    if (widthMm <= 0 || heightMm <= 0 || quantity <= 0) return 0;
    return (widthMm / 1000) * (heightMm / 1000) * quantity;
  }

  function productAmount(product, area) {
    const quantity = money(product.qty);
    const price = money(product.price);
    const rawAmount = product.mode === "piece"
      ? quantity * price
      : area * price;
    return sanSheSiRu(rawAmount);
  }

  function calculate(input) {
    const options = input && typeof input === "object" ? input : {};
    const products = Array.isArray(options.products) ? options.products : [];
    const different = options.different === true;
    const lalamove = options.lalamove === true;

    const rows = products.map((product) => {
      const item = product && typeof product === "object" ? product : {};
      const area = productArea(item);
      return {
        area,
        amount: productAmount(item, area),
      };
    });
    const material = rows.reduce((sum, row) => sum + row.amount, 0);

    let box;
    let freight;
    if (different) {
      box = products.reduce((sum, product) => sum + money(product && product.box), 0);
      freight = products.reduce((sum, product) => sum + money(product && product.freight), 0);
    } else {
      box = money(options.box);
      freight = money(options.freight);
    }

    // The source page clears the active packaging and freight inputs when
    // Lalamove is selected, so neither fee is included in this quote.
    if (lalamove) {
      box = 0;
      freight = 0;
    }

    const processing = money(options.processing);
    const auxiliary = money(options.auxiliary);
    const taxBase = material + box + freight + processing + auxiliary;
    const manualTax = money(options.tax);
    const rate = money(options.rate);
    const autoTax = options.autoTax === true;
    const tax = manualTax > 0
      ? manualTax
      : autoTax
        ? sanSheSiRu(taxBase * rate / 100)
        : 0;
    const total = taxBase + tax;

    return {
      rows,
      material,
      box,
      freight,
      processing,
      auxiliary,
      tax,
      total,
      hasFreight: freight > 0,
      // The source quote's note marks tax included when auto-tax is selected,
      // even if its rate is 0; a positive manual fee also marks it included.
      hasTax: tax > 0 || autoTax,
    };
  }

  return { calculate };
});
