// Ritmo de las luces náuticas. Copiado de v0.7 (src/intro/nightIntro.js, función pattern) sin cambios de lógica.
// Devuelve { period, at(t) → 0..1 } a partir de las etiquetas OSM seamark:light:*.
window.lightPattern = function pattern(ch = 'Fl', group = '1', period = NaN, sequence = '') {
  const seq = [];   // [encendida, duración]
  if (sequence) for (const tk of String(sequence).split(/[+,]/)) { const m = tk.trim().match(/^(\()?\s*([\d.]+)\s*\)?$/); if (m && +m[2] > 0) seq.push([m[1] ? 0 : 1, +m[2]]); }
  if (!seq.length) {
    ch = String(ch || 'Fl').trim(); const groups = String(group || '1').split('+').map(g => parseInt(g) || 1);
    if (/^F$/i.test(ch)) return { period: 0, at: () => 1 };
    if (/^Iso/i.test(ch)) { const P = period || 4; seq.push([1, P / 2], [0, P / 2]); }
    else if (/^Oc/i.test(ch)) { const P = period || 5; for (const g of groups) for (let i = 0; i < g; i++) seq.push([0, 1], [1, .7]); const used = seq.reduce((s, x) => s + x[1], 0); seq.push([1, Math.max(.5, P - used)]); }
    else if (/^V?Q/i.test(ch)) { const f = /^VQ/i.test(ch) ? .25 : .5, n = groups.reduce((a, b) => a + b, 0) || 1; for (let i = 0; i < n; i++) seq.push([1, f * .4], [0, f * .6]); if (period) seq.push([0, Math.max(0, period - n * f)]); }
    else { const on = /^LFl/i.test(ch) ? 2 : .5, P = period || 5; groups.forEach((g, gi) => { for (let i = 0; i < g; i++) seq.push([1, on], [0, 1]); if (gi < groups.length - 1) seq.push([0, 1.5]); }); const used = seq.reduce((s, x) => s + x[1], 0); seq.push([0, Math.max(.5, P - used)]); }
  }
  const P = seq.reduce((s, x) => s + x[1], 0);
  return { period: P, at(t) { let r = t % P; for (const [o, d] of seq) { if (r < d) return o ? Math.min(1, Math.min(r, d - r) * 12 + .2) : 0; r -= d; } return 0; } };
}
