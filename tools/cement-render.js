/* Shared SVG material treatment. Geometry is supplied by each tool unchanged. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CementRender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const palette = Object.freeze({ full:'#c4c6c8', cut:'#969b9f', ink:'#1d1d1f', blue:'#0066cc', line:'#555b60' });
  function key(prefix) {
    if (!/^[A-Za-z][\w-]*$/.test(prefix)) throw new TypeError('Invalid SVG gradient prefix');
    return prefix;
  }
  function defs(prefix) {
    const id = key(prefix);
    return `<linearGradient id="${id}-rim" x1="12%" y1="0%" x2="82%" y2="100%">
      <stop offset="0%" stop-color="#4e5457"/><stop offset="28%" stop-color="#6e7477"/>
      <stop offset="66%" stop-color="#bfc3c5"/><stop offset="100%" stop-color="#f1f2f3"/>
    </linearGradient><radialGradient id="${id}-floor" cx="60%" cy="77%" r="86%" fx="60%" fy="77%">
      <stop offset="0%" stop-color="#b9bec0"/><stop offset="70%" stop-color="#aab0b3"/><stop offset="100%" stop-color="#777f83"/>
    </radialGradient>`;
  }
  function hole(cx, cy, r, prefix) {
    const id = key(prefix);
    if (![cx, cy, r].every(Number.isFinite) || r <= 0) throw new TypeError('Invalid hole geometry');
    const k = .73 * r;
    return `<g class="cement-recess" data-cx="${cx}" data-cy="${cy}" data-r="${r}" pointer-events="none">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-rim)"/>
      <circle cx="${cx+r*.06}" cy="${cy+r*.085}" r="${r*.77}" fill="url(#${id}-floor)"/>
      <path d="M ${cx-k} ${cy-k*.35} A ${r*.78} ${r*.78} 0 0 1 ${cx+k*.28} ${cy-k}" fill="none" stroke="#687075" stroke-width="${r*.09}" stroke-linecap="round"/>
    </g>`;
  }
  return Object.freeze({ palette, defs, hole });
});
