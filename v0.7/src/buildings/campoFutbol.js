import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
// v2 · Campo de fútbol de la Zona Deportiva Sergio Llull de Es Castell (parcela del edificio nº 116, ref. 0251103FE1105S).
// REAL: contorno del césped (OpenStreetMap, leisure=pitch; coincide con la ortofoto PNOA) → posición, tamaño y giro.
// ESTIMADO: césped artificial con franjas, líneas reglamentarias (FIFA) a 2,5 m del borde, porterías de 7,32 × 2,44 m,
// barandilla perimetral, redes altas detrás de las porterías y 6 torres de focos de 18 m (3 por banda; en la ortofoto se
// ven las sombras de las de la banda sureste).
export const SPORTS_REF = '0251103FE1105S';
const NEAR = [-312, -80];   // para elegir el campo correcto entre los 'pitch' de OSM

export function footballPitch(zone) {
  const Hgt = zone.Hgt;
  const area = (zone.areas || []).filter(a => a.k == 'pitch').map(a => a.p.slice(0, -1))
    .find(p => Math.hypot(p.reduce((s, q) => s + q[0], 0) / p.length - NEAR[0], p.reduce((s, q) => s + q[1], 0) / p.length - NEAR[1]) < 40);
  if (!area || area.length != 4) return null;
  // Marco del campo: U a lo largo, V a lo ancho, origen en el centro
  const [a, b, c, d] = area, len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const long1 = len(a, b) > len(b, c);
  const [p0, p1, p2, p3] = long1 ? [a, b, c, d] : [b, c, d, a];   // p0→p1 y p2→p3: bandas (lados largos)
  const L = (len(p0, p1) + len(p2, p3)) / 2, W = (len(p1, p2) + len(p3, p0)) / 2;
  const O = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4];
  const ux = (p1[0] - p0[0] + p2[0] - p3[0]) / 2, uz = (p1[1] - p0[1] + p2[1] - p3[1]) / 2, ul = Math.hypot(ux, uz);
  const U = [ux / ul, uz / ul], V = [-U[1], U[0]];
  const X = (u, v) => [O[0] + U[0] * u + V[0] * v, O[1] + U[1] * u + V[1] * v];
  let Y = -1e9; for (let i = 0; i <= 10; i++) for (let j = 0; j <= 6; j++) Y = Math.max(Y, Hgt(...X((i / 10 - .5) * L, (j / 6 - .5) * W)));
  Y += .08;
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const turf = buffer(), lines = buffer(), side = buffer();
  const P3 = (u, v, y) => { const p = X(u, v); return [p[0], y, p[1]]; };
  const quad = (bf, u0, v0, u1, v1, y, k) => { tri(bf, P3(u0, v0, y), P3(u1, v0, y), P3(u1, v1, y), k); tri(bf, P3(u0, v0, y), P3(u1, v1, y), P3(u0, v1, y), k); };
  // Césped artificial con franjas de corte
  const NB = 14, k1 = new THREE.Color('#3f7d3b'), k2 = new THREE.Color('#4a8b45');
  for (let i = 0; i < NB; i++) quad(turf, -L / 2 + i * L / NB, -W / 2, -L / 2 + (i + 1) * L / NB, W / 2, Y, i % 2 ? k1 : k2);
  // Borde del césped hasta el terreno (si el campo queda por encima en algún punto)
  const ring = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]], kS = new THREE.Color('#9a9488');
  for (let i = 0; i < 4; i++) { const [u0, v0] = ring[i], [u1, v1] = ring[(i + 1) % 4], q0 = P3(u0, v0, Y), q1 = P3(u1, v1, Y);
    const h0 = Hgt(q0[0], q0[2]) - .5, h1 = Hgt(q1[0], q1[2]) - .5;
    tri(side, [q0[0], h0, q0[2]], [q1[0], h1, q1[2]], q1, kS); tri(side, [q0[0], h0, q0[2]], q1, q0, kS); }
  // Líneas (0,12 m)
  const yl = Y + .015, kL = new THREE.Color('#f4f4f0'), lw = .12;
  const seg = (u0, v0, u1, v1) => { const du = u1 - u0, dv = v1 - v0, l = Math.hypot(du, dv) || 1, nu = -dv / l * lw / 2, nv = du / l * lw / 2;
    const A = P3(u0 + nu, v0 + nv, yl), B = P3(u1 + nu, v1 + nv, yl), C = P3(u1 - nu, v1 - nv, yl), D = P3(u0 - nu, v0 - nv, yl);
    tri(lines, A, B, C, kL); tri(lines, A, C, D, kL); };
  const arc = (cu, cv, r, t0, t1, keep = () => true, n = 48) => { for (let i = 0; i < n; i++) {
    const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, A = [cu + r * Math.cos(ta), cv + r * Math.sin(ta)], B = [cu + r * Math.cos(tb), cv + r * Math.sin(tb)];
    if (keep(A) && keep(B)) seg(A[0], A[1], B[0], B[1]); } };
  const m = 2.5, ha = L / 2 - m, hb = W / 2 - m;
  seg(-ha, -hb, ha, -hb); seg(ha, -hb, ha, hb); seg(ha, hb, -ha, hb); seg(-ha, hb, -ha, -hb); seg(0, -hb, 0, hb);
  arc(0, 0, 9.15, 0, Math.PI * 2, undefined, 64); arc(0, 0, .2, 0, Math.PI * 2, undefined, 8);
  for (const s of [-1, 1]) {
    const pb = Math.min(20.16, hb - 1), gb = 9.16, xl = s * ha;
    seg(xl, -pb, xl - s * 16.5, -pb); seg(xl - s * 16.5, -pb, xl - s * 16.5, pb); seg(xl - s * 16.5, pb, xl, pb);
    seg(xl, -gb, xl - s * 5.5, -gb); seg(xl - s * 5.5, -gb, xl - s * 5.5, gb); seg(xl - s * 5.5, gb, xl, gb);
    arc(xl - s * 11, 0, .15, 0, Math.PI * 2, undefined, 8);
    arc(xl - s * 11, 0, 9.15, 0, Math.PI * 2, A => s * A[0] < ha - 16.5, 64);
    for (const t of [-1, 1]) arc(xl, t * hb, 1, 0, Math.PI * 2, A => Math.abs(A[0]) <= ha && Math.abs(A[1]) <= hb, 24);
  }
  g.add(toMesh(turf), toMesh(lines), toMesh(side));

  // Porterías
  const white = M('#f7f7f5'), grey = M('#8d9298'), dark = M('#3c4248'), lamp = M('#e4e8ea'), net = M('#56705a');
  const bar = (A, B, t, mat) => { const l = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (l < 1e-3) return;
    const o = new THREE.Mesh(new THREE.BoxGeometry(t, t, l), mat); o.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2); o.lookAt(...B); g.add(o); };
  for (const s of [-1, 1]) {
    const u = s * (ha + .06), ub = s * (ha + 1.9), gh = 2.44, gw = 3.66;
    for (const v of [-gw, gw]) { bar(P3(u, v, Y), P3(u, v, Y + gh), .12, white); bar(P3(ub, v, Y), P3(ub, v, Y + 1.0), .05, grey);
      bar(P3(u, v, Y + gh), P3(ub, v, Y + 1.0), .05, grey); bar(P3(u, v, Y + .02), P3(ub, v, Y + .02), .05, grey); }
    bar(P3(u, -gw - .06, Y + gh), P3(u, gw + .06, Y + gh), .12, white);
    bar(P3(ub, -gw, Y + 1.0), P3(ub, gw, Y + 1.0), .05, grey); bar(P3(ub, -gw, Y + .02), P3(ub, gw, Y + .02), .05, grey);
  }
  // Barandilla perimetral (1,1 m) a 0,8 m del césped y redes altas (6 m) detrás de las porterías
  const fr = [[-L / 2 - .8, -W / 2 - .8], [L / 2 + .8, -W / 2 - .8], [L / 2 + .8, W / 2 + .8], [-L / 2 - .8, W / 2 + .8]];
  for (let i = 0; i < 4; i++) { const [u0, v0] = fr[i], [u1, v1] = fr[(i + 1) % 4], l = Math.hypot(u1 - u0, v1 - v0), n = Math.round(l / 2.5);
    const yAt = (u, v) => { const p = X(u, v); return Math.max(Y, Hgt(p[0], p[1])); };
    for (let k = 0; k <= n; k++) { const u = u0 + (u1 - u0) * k / n, v = v0 + (v1 - v0) * k / n, y = yAt(u, v); bar(P3(u, v, y - .2), P3(u, v, y + 1.1), .06, grey); }
    for (let k = 0; k < n; k++) { const ua = u0 + (u1 - u0) * k / n, va = v0 + (v1 - v0) * k / n, ub = u0 + (u1 - u0) * (k + 1) / n, vb = v0 + (v1 - v0) * (k + 1) / n;
      bar(P3(ua, va, yAt(ua, va) + 1.1), P3(ub, vb, yAt(ub, vb) + 1.1), .05, grey); }
  }
  for (const s of [-1, 1]) { const u = s * (L / 2 + 1.6), hw = Math.min(25, W / 2), n = Math.round(hw * 2 / 5);
    for (let k = 0; k <= n; k++) { const v = -hw + 2 * hw * k / n; bar(P3(u, v, Y - .2), P3(u, v, Y + 6), .1, dark); }
    bar(P3(u, -hw, Y + 6), P3(u, hw, Y + 6), .05, dark); bar(P3(u, -hw, Y + 3), P3(u, hw, Y + 3), .03, net); }

  // Torres de focos: 3 por banda, 18 m, proyectores orientados al centro del campo
  // userData.luces: para que el visor encienda los focos de noche (pipeline/exportar_glb.mjs → cesium/data/luces.js)
  const focos = [];
  g.userData.luces = { campo: { p: [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([u, v]) => X(u, v)), y: Y }, focos };
  for (const sv of [-1, 1]) for (const fu of [-.35, 0, .35]) {
    const u = fu * L, v = sv * (W / 2 + 2.2), base = P3(u, v, 0), y0 = Hgt(base[0], base[2]) - .3, H = 18;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.16, .28, H, 12), grey); mast.position.set(base[0], y0 + H / 2, base[2]); g.add(mast);
    const head = new THREE.Group(); head.position.set(base[0], y0 + H + .3, base[2]);
    head.lookAt(...P3(u * .6, -sv * W * .15, Y));   // mira hacia el campo y hacia abajo
    focos.push({ x: base[0], y: y0 + H + .3, z: base[2], t: P3(u * .6, -sv * W * .15, Y) });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, .14), dark); head.add(frame);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const lb = new THREE.Mesh(new THREE.BoxGeometry(.7, .58, .32), lamp); lb.position.set(-1.2 + i * .8, -.35 + j * .7, .22); head.add(lb);
    }
    g.add(head);
  }
  return g;
}
