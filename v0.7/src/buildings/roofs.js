// Generación de tejados (PROCEDURAL salvo que OSM indique roof:shape). Funciones puras, sin Three.js.
export function area(r) { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
// Rectángulo orientado mínimo (probando la dirección de cada lado).
export function obb(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const q of r) { const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (A > 0 && (!best || A < best.A)) best = { A, c, s, u0, u1, v0, v1 };
  }
  return best;
}
// Decide el tipo de tejado: 'hipped' (a cuatro aguas, teja) o 'flat' (terraza con pretil).
export function roofType(r, bd) {
  if (bd.rs) return ['hipped', 'gabled', 'pyramidal'].includes(bd.rs) ? 'hipped' : 'flat';
  if (bd.att || bd.holes) return 'flat'; // adosados (medianeras) y edificios con patio: terraza
  const A = area(r), o = obb(r);
  return o && A > 20 && A < 450 && A / o.A > .85 && bd.h <= 7.5 ? 'hipped' : 'flat';
}
// Tejado a cuatro aguas sobre el rectángulo orientado, con alero. Devuelve triángulos [[x,y,z]x3].
export function hippedRoof(r, y, overhang = .35, pitch = .51) {
  const o = obb(r); let { c, s } = o, U = (o.u1 - o.u0) / 2 + overhang, V = (o.v1 - o.v0) / 2 + overhang;
  const uc = (o.u0 + o.u1) / 2, vc = (o.v0 + o.v1) / 2;
  const W = (u, v, h) => [(uc + u) * c - (vc + v) * s, h, (uc + u) * s + (vc + v) * c];
  let P;
  if (U >= V) P = (u, v, h) => W(u, v, h); else { [U, V] = [V, U]; P = (u, v, h) => W(v, u, h); }
  const R = U - V, top = y + V * pitch, a = P(-U, -V, y), b = P(U, -V, y), cc = P(U, V, y), d = P(-U, V, y), r1 = P(-R, 0, top), r2 = P(R, 0, top);
  return [[a, b, r2], [a, r2, r1], [cc, d, r1], [cc, r1, r2], [b, cc, r2], [d, a, r1]];
}
