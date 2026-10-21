// Geometría de calle sin Three.js (probada por separado): densificar, desplazar líneas, índice de segmentos.
export function densify(p, step) {
  const o = [p[0]];
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return o;
}
// Desplaza la línea d metros; d > 0 = derecha según el sentido de la vía (x este, z sur).
export function offsetLine(p, d) {
  return p.map((q, i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [q[0] - dz / l * d, q[1] + dx / l * d]; });
}
export function distSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dz - z);
}
export function segIndex(G = 8) {
  const cells = new Map();
  return {
    add(a, b, r, tag) {
      const s = { a, b, r, tag };
      for (let gx = Math.floor((Math.min(a[0], b[0]) - r) / G); gx <= Math.floor((Math.max(a[0], b[0]) + r) / G); gx++)
        for (let gz = Math.floor((Math.min(a[1], b[1]) - r) / G); gz <= Math.floor((Math.max(a[1], b[1]) + r) / G); gz++) { const k = gx + ',' + gz; (cells.get(k) || cells.set(k, []).get(k)).push(s); }
    },
    all(x, z) { return cells.get(Math.floor(x / G) + ',' + Math.floor(z / G)) || []; },
    near(x, z, extra = 0) { const l = cells.get(Math.floor(x / G) + ',' + Math.floor(z / G)); if (l) for (const s of l) if (distSeg(x, z, s.a, s.b) < s.r + extra) return s; return null; },
  };
}
