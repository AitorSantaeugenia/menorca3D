import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
// v2 · Carrer Fontanilles, a la entrada de Es Castell (a partir de fotos de referencia).
// REAL: huellas y alturas del Catastro (edificios nº 35, 59, 65 y 84), trazado de la calle (OpenStreetMap) y dirección de
// la farmacia (Carrer Fontanilles 47, menorca.info 02-02-2024).
// ESTIMADO a partir de las fotos:
//  · nº 35 y 59: bloque de 4 plantas con esquinas curvas; en la fachada de la calle, franjas color salmón en cada forjado
//    y galerías acristaladas con carpintería oscura en las plantas 1–3; planta baja blanca con zócalo de mármol beige.
//  · Farmàcia Alicia Quesada (planta baja del nº 35): rótulo blanco con letras verdes, puertas de cristal, ventana con
//    reja y cruz verde luminosa en banderola.
//  · nº 84: casa antigua de dos plantas de marés visto con esquinas dentadas blancas (el color de pared va en
//    ajustes_edificios.json).
export const FONTANILLES_REFS = ['0054501FE1105S', '0054529FE1105S', '0054801FE1105S'];
const BLOCK = ['0054501FE1105S', '0054529FE1105S'], OLD = '0054801FE1105S';
// Carrer Fontanilles junto al bloque (OSM)
const STREET = [[-564, -403], [-561, -415], [-553, -425], [-548, -431], [-532, -454], [-515, -479], [-509, -487], [-492, -511]];
// Fachada de la farmacia: tramo recto del nº 35 a la calle (Catastro), de NE (izquierda vista desde la calle) a SO
const PH_A = [-512.5, -476.9], PH_B = [-518.5, -468.1];

const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  const q = [a[0] + dx * t, a[1] + dz * t]; return [Math.hypot(p[0] - q[0], p[1] - q[1]), q]; };
const toStreet = p => { let best = [1e9, null]; for (let i = 0; i + 1 < STREET.length; i++) { const r = segDist(p, STREET[i], STREET[i + 1]); if (r[0] < best[0]) best = r; } return best; };

export function fontanilles(zone) {
  const Hgt = zone.Hgt, g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const salmon = new THREE.Color('#d6937a'), tile = new THREE.Color('#b0583d'), beige = new THREE.Color('#d2b892'), white = new THREE.Color('#f4f3ef');
  const glassM = M('#405565', { side: THREE.DoubleSide }), frameM = M('#2a2c2e'), bands = buffer(), plain = buffer(), glass = buffer();
  const quad = (b, p0, p1, y0, y1, k) => { const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    tri(b, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], k, [0, y0, L, y0, L, y1]); tri(b, [p0[0], y0, p0[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], k, [0, y0, L, y1, 0, y1]); };
  const hquad = (b, a0, a1, b1, b0, y, k) => { tri(b, [a0[0], y, a0[1]], [a1[0], y, a1[1]], [b1[0], y, b1[1]], k); tri(b, [a0[0], y, a0[1]], [b1[0], y, b1[1]], [b0[0], y, b0[1]], k); };
  const bar = (a, b, t, m) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (L < 1e-3) return; const o = new THREE.Mesh(new THREE.BoxGeometry(t, t, L), m);
    o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); o.lookAt(...b); g.add(o); };

  // ---------- Bloque nº 35 + 59: franjas salmón y galerías en la fachada de la calle ----------
  for (const bd of zone.buildings.filter(b => BLOCK.includes(b.ref) && b.h >= 12)) {
    const r = bd.p.slice(0, -1), n = r.length, cen = [r.reduce((s, q) => s + q[0], 0) / n, r.reduce((s, q) => s + q[1], 0) / n];
    // aristas que dan a la calle: cerca de ella y mirando hacia ella
    const sel = r.map((a, i) => { const c = r[(i + 1) % n], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if ((m[0] - cen[0]) * nx + (m[1] - cen[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const [d, q] = toStreet(m); return d < 11 && (q[0] - m[0]) * nx + (q[1] - m[1]) * nz > 0 ? [nx, nz] : null; });
    // cadenas de aristas seguidas
    const chains = []; let start = sel.findIndex((s, i) => s && !sel[(i - 1 + n) % n]);
    if (start < 0 && sel.every(Boolean)) start = 0;
    if (start < 0) continue;
    for (let k = 0, i = start; k < n; k++, i = (i + 1) % n) { if (!sel[i]) continue; if (!sel[(i - 1 + n) % n] || !chains.length || i == start) chains.push([]); chains[chains.length - 1].push(i); }
    for (const ch of chains) {
      // vértices de la cadena y su normal media (inglete) para desplazar hacia fuera
      const idx = [...ch, (ch[ch.length - 1] + 1) % n], P = idx.map(i => r[i]);
      const N = idx.map((v, j) => { const e = [j > 0 ? sel[ch[j - 1]] : null, j < ch.length ? sel[ch[j]] : null].filter(Boolean);
        let x = e.reduce((s, q) => s + q[0], 0), z = e.reduce((s, q) => s + q[1], 0); const l = Math.hypot(x, z) || 1; x /= l; z /= l;
        const c = Math.max(.5, x * e[0][0] + z * e[0][1]); return [x / c, z / c]; });
      const off = d => P.map((p, j) => [p[0] + N[j][0] * d, p[1] + N[j][1] * d]);
      const y0 = P.reduce((s, p) => s + Hgt(p[0], p[1]), 0) / P.length + .05;
      const W0 = off(.03), F = off(1.0), G = off(.95), Z = off(.05);
      for (let j = 0; j + 1 < P.length; j++) {
        quad(plain, Z[j], Z[j + 1], y0 - .3, y0 + .9, beige);                                   // zócalo de mármol
        for (let k = 1; k <= 3; k++) {
          const yb = y0 + 3 * k - .25, yt = y0 + 3 * k + .85;
          quad(bands, F[j], F[j + 1], yb, yt, salmon);                                         // frente de la franja
          hquad(bands, W0[j], W0[j + 1], F[j + 1], F[j], yt, salmon); hquad(bands, W0[j], W0[j + 1], F[j + 1], F[j], yb, salmon);
          quad(glass, G[j], G[j + 1], yt, y0 + 3 * (k + 1) - .25, white);                       // galería acristalada
        }
        quad(bands, F[j], F[j + 1], y0 + 11.75, y0 + 12.25, tile);                             // alero de teja
        hquad(bands, W0[j], W0[j + 1], F[j + 1], F[j], y0 + 12.25, tile); hquad(bands, W0[j], W0[j + 1], F[j + 1], F[j], y0 + 11.75, tile);
      }
      // carpintería oscura: montantes cada ~1,2 m y travesaño
      let acc = 0;
      for (let j = 0; j + 1 < P.length; j++) {
        const L = Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]); acc += L;
        if (acc < 1.2 && j + 2 < P.length) continue; acc = 0;
        const q = G[j + 1]; for (let k = 1; k <= 3; k++) bar([q[0], y0 + 3 * k + .85, q[1]], [q[0], y0 + 3 * k + 2.75, q[1]], .07, frameM);
      }
      for (let k = 1; k <= 3; k++) for (let j = 0; j + 1 < P.length; j++) bar([G[j][0], y0 + 3 * k + 1.5, G[j][1]], [G[j + 1][0], y0 + 3 * k + 1.5, G[j + 1][1]], .05, frameM);
      // cierres laterales de las galerías
      for (const j of [0, P.length - 1]) { const a = W0[j], b = F[j]; for (let k = 1; k <= 3; k++) quad(plain, a, b, y0 + 3 * k - .25, y0 + 3 * k + 2.75, white); }
    }
  }
  g.add(toMesh(bands, texturedMaterial('estuco', { vertexColors: true, normal: .5, side: THREE.DoubleSide })));
  g.add(toMesh(plain, texturedMaterial('estuco', { vertexColors: true, normal: .3, side: THREE.DoubleSide })));
  g.add(toMesh(glass, glassM));

  // ---------- Farmàcia Alicia Quesada ----------
  if (zone.buildings.some(b => b.ref == '0054501FE1105S')) {
    const L = Math.hypot(PH_B[0] - PH_A[0], PH_B[1] - PH_A[1]), U = [(PH_B[0] - PH_A[0]) / L, (PH_B[1] - PH_A[1]) / L];
    let N = [-U[1], U[0]]; const [, q] = toStreet(PH_A); if ((q[0] - PH_A[0]) * N[0] + (q[1] - PH_A[1]) * N[1] < 0) N = [-N[0], -N[1]];
    const W = (u, n) => [PH_A[0] + U[0] * u + N[0] * n, PH_A[1] + U[1] * u + N[1] * n], rot = Math.atan2(-U[1], U[0]);
    const y0 = Hgt(...W(L / 2, 0)) + .05;
    const box = (u0, u1, ya, yb, n0, n1, m) => { const c = W((u0 + u1) / 2, (n0 + n1) / 2), o = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, yb - ya, n1 - n0), m);
      o.position.set(c[0], y0 + (ya + yb) / 2, c[1]); o.rotation.y = rot; g.add(o); return o; };
    const whiteM = M('#f6f6f3'), doorM = M('#4a3a2c'), glassD = M('#556a75'), steel = M('#b8bcbf'), cross = M('#25c45a', { emissive: '#139a42' });
    box(.3, 1.5, 0, 2.3, .04, .1, doorM);                       // portal del nº 45 (madera y vidrio)
    box(3.0, 5.0, 0, 2.35, .04, .08, glassD);                   // puertas correderas de cristal
    box(3.0, 5.0, 2.35, 2.45, .04, .12, steel); box(2.95, 3.05, 0, 2.45, .04, .12, steel); box(4.95, 5.05, 0, 2.45, .04, .12, steel); box(3.97, 4.03, 0, 2.35, .08, .1, steel);
    box(6.3, 6.9, .9, 2.2, .04, .07, glassD);                   // ventana estrecha con reja
    for (let i = 0; i < 4; i++) box(6.36 + i * .16, 6.38 + i * .16, .9, 2.2, .07, .1, steel);
    box(1.6, 9.0, 2.12, 2.72, 0, .16, whiteM);                  // rótulo blanco
    const tb = buffer(), k = new THREE.Color('#ffffff'), p = (u, y) => { const c = W(u, .165); return [c[0], y0 + y, c[1]]; };
    tri(tb, p(1.6, 2.12), p(9.0, 2.12), p(9.0, 2.72), k, [0, 1, 1, 1, 1, 0]); tri(tb, p(1.6, 2.12), p(9.0, 2.72), p(1.6, 2.72), k, [0, 1, 1, 0, 0, 0]);
    g.add(toMesh(tb, texturedMaterial('rotulo_farmacia3', { side: THREE.DoubleSide })));
    // cruz verde en banderola, a la derecha del rótulo
    const cp = W(9.45, .65);
    for (const [w, h] of [[.8, .26], [.26, .8]]) { const o = new THREE.Mesh(new THREE.BoxGeometry(.12, h, w), cross); o.position.set(cp[0], y0 + 2.45, cp[1]); o.rotation.y = rot; g.add(o); }
    { const a = W(9.45, .2), o = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .5), steel); o.position.set(a[0], y0 + 2.45, a[1]); o.rotation.y = rot; g.add(o); }
    g.userData.luces = { farmacia: { x: cp[0], y: y0 + 2.45, z: cp[1], suelo: y0 } };
  }

  // ---------- nº 84: esquinas dentadas blancas ----------
  const old = zone.buildings.find(b => b.ref == OLD);
  if (old) {
    // contorno simplificado: fuera vértices de aristas muy cortas o casi en línea recta (el Catastro trae muchos)
    let r = old.p.slice(0, -1);
    for (let ch = true; ch && r.length > 3;) { ch = false;
      for (let i = 0; i < r.length; i++) { const a = r[(i - 1 + r.length) % r.length], v = r[i], c = r[(i + 1) % r.length];
        const e1 = [a[0] - v[0], a[1] - v[1]], e2 = [c[0] - v[0], c[1] - v[1]], l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
        if (l1 < .6 || l2 < .6 || (e1[0] * e2[0] + e1[1] * e2[1]) / (l1 * l2) < -.97) { r.splice(i, 1); ch = true; break; } } }
    const n = r.length, qm = M('#f2f0ea'), hs = r.map(q => Hgt(q[0], q[1])), yb = Math.min(...hs) - .2, yt = hs.reduce((s, v) => s + v, 0) / n + old.h;
    for (let i = 0; i < n; i++) {
      const a = r[(i - 1 + n) % n], v = r[i], c = r[(i + 1) % n];
      const e1 = [a[0] - v[0], a[1] - v[1]], e2 = [c[0] - v[0], c[1] - v[1]], l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
      if (l1 < 1 || l2 < 1 || Math.abs((e1[0] * e2[0] + e1[1] * e2[1]) / (l1 * l2)) > .7) continue;   // solo esquinas de verdad
      const d1 = [e1[0] / l1, e1[1] / l1], d2 = [e2[0] / l2, e2[1] / l2];
      for (let y = yb + .1, s = 0; y + .3 < yt; y += .36, s++) {
        const la = s % 2 ? .55 : .3, lb = s % 2 ? .3 : .55;   // alternan largo y corto en cada cara
        for (const [d, l] of [[d1, la], [d2, lb]]) {
          const o = new THREE.Mesh(new THREE.BoxGeometry(l, .3, .06), qm), m = [v[0] + d[0] * l / 2, v[1] + d[1] * l / 2];
          const nrm = [-d[1], d[0]], inside = (r.reduce((S, q) => S + q[0], 0) / n - m[0]) * nrm[0] + (r.reduce((S, q) => S + q[1], 0) / n - m[1]) * nrm[1] > 0 ? -1 : 1;
          o.position.set(m[0] + nrm[0] * .03 * inside, y + .15, m[1] + nrm[1] * .03 * inside); o.rotation.y = Math.atan2(-d[1], d[0]); g.add(o);
        }
      }
    }
  }
  return g;
}
