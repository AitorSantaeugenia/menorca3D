import * as THREE from 'three';
import { closestOnSeg } from './buildingIndex.js';
// «Ir al edificio nº X»: busca el punto de calle más cercano a su fachada, coloca allí al personaje mirando al
// edificio y lo resalta unos segundos con un contorno del color de su estado.
export function viewpoint(b, zone, idx, hit) {
  const [x0, x1, z0, z1] = b.box, M = 60;
  let best = null;
  const tryPt = (x, z) => {
    if (hit(x, z) || !zone.inLand(x, z)) return;
    const d = idx.dist(b, x, z);
    if (d > 0 && (!best || d < best.d)) best = { x, z, d };
  };
  for (const r of zone.roads) for (let i = 0; i < r.p.length - 1; i++) {
    const a = r.p[i], c = r.p[i + 1];
    if (Math.max(a[0], c[0]) < x0 - M || Math.min(a[0], c[0]) > x1 + M || Math.max(a[1], c[1]) < z0 - M || Math.min(a[1], c[1]) > z1 + M) continue;
    const k = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 1.5));
    for (let j = 0; j <= k; j++) tryPt(a[0] + (c[0] - a[0]) * j / k, a[1] + (c[1] - a[1]) * j / k);
  }
  if (!best) for (let a = 0; a < 16; a++) for (const R of [6, 10, 16, 24]) tryPt(b.lab[0] + Math.cos(a / 16 * 6.283) * R, b.lab[1] + Math.sin(a / 16 * 6.283) * R);
  if (!best) return null;
  // Punto del edificio más cercano → dirección de la mirada
  let T = null, td = 1e9;
  for (const p of b.pieces) for (let i = 0; i < p.r.length; i++) { const q = closestOnSeg(best.x, best.z, p.r[i], p.r[(i + 1) % p.r.length]), d = Math.hypot(q[0] - best.x, q[1] - best.z); if (d < td) { td = d; T = q; } }
  let dx = T[0] - best.x, dz = T[1] - best.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  // Si la calle queda lejos (parcela con jardín), acercarse por terreno libre hasta ~8 m de la fachada
  let sx = best.x, sz = best.z;
  for (let t = 0; t < td - 8; t += .5) { const x = best.x + dx * t, z = best.z + dz * t; if (hit(x, z)) break; sx = x; sz = z; }
  // Distancia de cámara: lo que permita la calle detrás del personaje
  let back = 2.5; for (let t = 1; t <= 14; t += .5) { if (hit(sx - dx * t, sz - dz * t)) break; back = t; }
  return { x: sx, z: sz, yaw: Math.atan2(-dx, -dz), dist: Math.max(2.5, Math.min(11, back - .8)), pitch: td < 6 ? .22 : .12 };
}

export const ESTADO_COLOR = { pendiente: '#e03131', acabado: '#2f9e44' };
export function highlight(b, heights) {
  const v = [];
  for (const p of b.pieces) {
    const [y0, y1] = heights[p.i], r = p.r;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length];
      v.push(a[0], y0, a[1], c[0], y0, c[1], a[0], y1 + .05, a[1], c[0], y1 + .05, c[1], a[0], y0, a[1], a[0], y1 + .05, a[1]);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const m = new THREE.LineBasicMaterial({ color: ESTADO_COLOR[b.estado] || '#ffd43b', transparent: true, depthTest: false });
  const line = new THREE.LineSegments(g, m); line.renderOrder = 20;
  const t0 = performance.now();
  line.onBeforeRender = () => { const t = (performance.now() - t0) / 1000; m.opacity = t > 12 ? 0 : (.55 + .45 * Math.sin(t * 5)) * Math.min(1, (12 - t) / 2); line.visible = t < 12; };
  line.dispose = () => { g.dispose(); m.dispose(); };
  return line;
}
