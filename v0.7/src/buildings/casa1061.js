import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
// v2 · Conjunto de casas de la parcela nº 1061 (ref. 0748109FE1104N): casa del extremo de la fila con su jardín
// trasero, el paso hacia la calle y la puerta de la pared del fondo. Detalle ESTIMADO a partir de
// fotos de referencia.
// REAL: huellas del Catastro; paredes y escalera del IDE Menorca (trazado del jardín y del paso).
// ESTIMADO a partir de las fotos (medidas tomadas de la foto de la fachada trasera, que mide ~10 m de ancho):
//  · planta baja continua con la casa vecina de la izquierda (las plantas altas, no): se rellena el hueco entre las dos;
//  · fachada trasera dividida en dos cuerpos (línea a ~5,8 m del borde izquierdo de la casa): en el izquierdo, tejadillo
//    de teja sobre la planta baja (sigue hasta la pared de la vecina), toldo beige, corredera y ventana, y arriba balcón
//    con barandilla de madera y puerta con mallorquinas; en el derecho, pared lisa con aire acondicionado, ventanita y
//    ventana con mallorquinas en la planta alta. Todo lo que pinta el sombreado general de fachadas queda tapado;
//  · jardín: terraza enlosada, césped artificial, grava, losas de paso; pared seca baja (0,6 m) con malla verde encima
//    hasta 1,5 m; puerta blanca; barbacoa de obra por dentro, pegada a la pared;
//  · paso entre casas: baldosa roja y verja al pie de la escalera; portón en el hueco de la pared del fondo.
export const REF_1061 = '0748109FE1104N';
// Fachada trasera de la casa (Catastro): de oeste a este (~10 m)
const REAR = [[76.2, 198.3], [80.7, 196.5], [80.8, 196.8], [85.7, 195.0]];
const GARDEN = [[76.2, 198.3], [80.7, 196.5], [85.7, 195.0], [86.6, 196.1], [88.0, 201.7], [80.8, 207.6], [77.4, 204.5], [75.2, 198.7]];
const FENCE = [[86.56, 196.09], [87.98, 201.72], [80.83, 207.6], [77.4, 204.5]];   // pared del IDE que rodea el jardín (+ cierre)
// Hueco entre la casa y la vecina de la izquierda (Catastro): la planta baja es continua
const SLOT = [[73.8, 195.3], [74.4, 194.0], [74.8, 194.9], [75.5, 196.4], [76.2, 198.3], [75.2, 198.7]];
const PASSAGE = [[85.1, 189.3], [87.5, 188.7], [88.5, 190.5], [89.4, 194.7], [88.0, 201.7], [86.6, 196.1], [85.7, 195.0]];

// La pared seca del IDE alrededor del jardín se dibuja aquí, más baja: se quita de las paredes del detalle de calle
// (pipeline/exportar_glb.mjs llama a esta función con las paredes del IDE). El tramo que sigue hacia el sur se conserva.
export function recortaParedesIDE(paredes) {
  return paredes.map(w => {
    const p = w.p, i = p.findIndex(q => Math.abs(q[0] - 80.83) < .05 && Math.abs(q[1] - 207.6) < .05);
    if (Math.abs(p[0][0] - 86.56) < .05 && Math.abs(p[0][1] - 196.09) < .05 && i > 0) return { ...w, p: p.slice(i) };
    return w;
  }).filter(w => w.p.length > 1);
}

export function casa1061(zone) {
  const Hgt = zone.Hgt, g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const yG = Hgt(80.5, 199.5) + .12;   // nivel del jardín (llano en las fotos)
  const C = c => new THREE.Color(c), white = '#f3f1ea';
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const box = (p, ry, w, h, d, y, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(p[0], y + h / 2, p[1]); o.rotation.y = ry; g.add(o); return o; };
  const ang = (a, b) => Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const fan = (bf, P, y, k) => { const c = [P.reduce((s, q) => s + q[0], 0) / P.length, P.reduce((s, q) => s + q[1], 0) / P.length];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; tri(bf, [c[0], y, c[1]], [a[0], y, a[1]], [b[0], y, b[1]], k); } };
  const gc = [GARDEN.reduce((s, q) => s + q[0], 0) / GARDEN.length, GARDEN.reduce((s, q) => s + q[1], 0) / GARDEN.length];
  const inward = (a, b) => { let n = [-(b[1] - a[1]), b[0] - a[0]]; const l = Math.hypot(...n); n = [n[0] / l, n[1] / l]; const m = lerp(a, b, .5);
    return (gc[0] - m[0]) * n[0] + (gc[1] - m[1]) * n[1] > 0 ? n : [-n[0], -n[1]]; };

  // ---------- Marco de la fachada trasera: u a lo largo (0 = borde izquierdo de la casa), n hacia el jardín ----------
  // la fachada tiene un pequeño quiebro (Catastro): W(u, n) recorre los tramos y desplaza n hacia el jardín en cada uno
  const segs = []; let acc = 0;
  for (let i = 0; i + 1 < REAR.length; i++) { const a = REAR[i], b = REAR[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, u0: acc, L, U: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], N: inward(a, b) }); acc += L; }
  const LR = acc, A = REAR[0], B = REAR[REAR.length - 1];
  const segAt = u => segs.find(s => u <= s.u0 + s.L) || segs[segs.length - 1];
  const W = (u, n) => { const s = u < 0 ? segs[0] : segAt(u), t = u - s.u0; return [s.a[0] + s.U[0] * t + s.N[0] * n, s.a[1] + s.U[1] * t + s.N[1] * n]; };
  const n0 = segs[0].N, ry = Math.atan2(-(B[1] - A[1]), B[0] - A[0]);
  const ryAt = u => { const s = u < 0 ? segs[0] : segAt(u); return Math.atan2(-s.U[1], s.U[0]); };
  const yH = Math.max(Hgt(...W(LR / 2, 0)) + .05, yG);
  // caja en la fachada; si cruza el quiebro se parte en un trozo por tramo
  const fbox = (u0, u1, ya, yb, nA, nB, m) => { const cuts = [u0, ...segs.map(s => s.u0).filter(c => c > u0 && c < u1), u1];
    for (let i = 0; i + 1 < cuts.length; i++) { const a = cuts[i], b = cuts[i + 1]; if (b - a < .005) continue;
      box(W((a + b) / 2, (nA + nB) / 2), ryAt((a + b) / 2), b - a, yb - ya, nB - nA, yH + ya, m); } };
  // SPLIT: separación entre los dos cuerpos = quiebro del Catastro (solo en la planta alta) · UL: pared de la vecina
  const SPLIT = segs[0].L, UL = -1.05;
  // Planta baja: un solo plano, el del cuerpo derecho prolongado hacia la vecina (abajo no hay nada metido hacia dentro)
  const P0 = REAR[2], sg = segs[2], G = (u, n) => [P0[0] + sg.U[0] * (u - sg.u0) + sg.N[0] * n, P0[1] + sg.U[1] * (u - sg.u0) + sg.N[1] * n];
  const ryG = Math.atan2(-sg.U[1], sg.U[0]);
  const gbox = (u0, u1, ya, yb, nA, nB, m) => box(G((u0 + u1) / 2, (nA + nB) / 2), ryG, u1 - u0, yb - ya, nB - nA, yH + ya, m);
  // Medidas tomadas de la foto de la fachada (px → m): cuerpo izquierdo 830 px = 4,85 m; cuerpo derecho 660 px = 5,2 m

  // ---------- Suelos ----------
  const grava = buffer(), cesped = buffer(), losas = buffer(), roja = buffer();
  fan(grava, GARDEN, yG - .02, C('#b9ad99'));
  fan(cesped, [W(0, 3.0), W(5.4, 3.0), W(5.4, 7.0), [79.2, 205.8], [77.0, 203.4]], yG + .01, C('#4f9a3a'));
  fan(losas, [W(UL, 0), W(LR, 0), W(LR, 2.6), W(UL, 2.6)], yG + .015, C('#d9c3a0'));
  for (let i = 0; i < 5; i++) { const p = W(6.0 + i * .15, 3 + i * .9); fan(losas, [[p[0] - .35, p[1] - .25], [p[0] + .35, p[1] - .25], [p[0] + .35, p[1] + .25], [p[0] - .35, p[1] + .25]], yG + .02, C('#e2d6bf')); }
  { const c = [PASSAGE.reduce((s, q) => s + q[0], 0) / PASSAGE.length, PASSAGE.reduce((s, q) => s + q[1], 0) / PASSAGE.length], k = C('#b5674d');
    for (let i = 0; i < PASSAGE.length; i++) { const a = PASSAGE[i], b = PASSAGE[(i + 1) % PASSAGE.length], y = q => Math.max(Hgt(q[0], q[1]), yG) + .06;
      tri(roja, [c[0], y(c), c[1]], [a[0], y(a), a[1]], [b[0], y(b), b[1]], k); } }
  g.add(toMesh(grava, texturedMaterial('adoquin', { vertexColors: true, normal: .4, side: THREE.DoubleSide })));
  g.add(toMesh(cesped, M('#ffffff', { vertexColors: true, side: THREE.DoubleSide })));
  g.add(toMesh(losas, texturedMaterial('losa_plaza', { vertexColors: true, normal: .4, side: THREE.DoubleSide })));
  g.add(toMesh(roja, texturedMaterial('baldosa_roja', { vertexColors: true, normal: .5, side: THREE.DoubleSide })));

  // ---------- Pared seca baja (0,6 m) y malla verde encima hasta 1,5 m ----------
  const seca = buffer(), malla = M('#2f7d4f'), poste = M('#5b5f63'), kS = C('#ffffff'), TOP = .6, MESH = 1.5;
  for (let i = 0; i + 1 < FENCE.length; i++) {
    const a = FENCE[i], b = FENCE[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ra = ang(a, b), n = inward(a, b);
    for (const s of [-.2, .2]) {   // dos caras y la coronación (UV en metros para la textura de piedra)
      const p = q => [q[0] - n[0] * s, q[1] - n[1] * s], pa = p(a), pb = p(b), ya = Hgt(a[0], a[1]) - .3, yb = Hgt(b[0], b[1]) - .3, yt = yG + TOP;
      tri(seca, [pa[0], ya, pa[1]], [pb[0], yb, pb[1]], [pb[0], yt, pb[1]], kS, [0, ya, L, yb, L, yt]); tri(seca, [pa[0], ya, pa[1]], [pb[0], yt, pb[1]], [pa[0], yt, pa[1]], kS, [0, ya, L, yt, 0, yt]);
    }
    const o = [a[0] + n[0] * .2, a[1] + n[1] * .2], o2 = [b[0] + n[0] * .2, b[1] + n[1] * .2], e = [a[0] - n[0] * .2, a[1] - n[1] * .2], e2 = [b[0] - n[0] * .2, b[1] - n[1] * .2];
    tri(seca, [o[0], yG + TOP, o[1]], [o2[0], yG + TOP, o2[1]], [e2[0], yG + TOP, e2[1]], kS); tri(seca, [o[0], yG + TOP, o[1]], [e2[0], yG + TOP, e2[1]], [e[0], yG + TOP, e[1]], kS);
    box(lerp(a, b, .5), ra, L, MESH - TOP, .04, yG + TOP, malla);
    for (let t = 0; t <= 1.001; t += 1 / Math.max(1, Math.round(L / 2.5))) box(lerp(a, b, t), ra, .05, MESH - TOP + .05, .05, yG + TOP, poste);
  }
  g.add(toMesh(seca, texturedMaterial('piedra_seca', { vertexColors: true, normal: 1.3, side: THREE.DoubleSide })));
  // puerta blanca del jardín cerca de la esquina y barbacoa por dentro, pegada a la pared (posiciones ESTIMADAS)
  { const a = FENCE[1], b = FENCE[2], ra = ang(a, b), n = inward(a, b), pw = M('#f7f7f4');
    box(lerp(a, b, .86), ra, 1.0, MESH + .35, .08, yG, pw);
    box(lerp(a, b, .86 - .065), ra, .3, MESH + .45, .32, yG - .1, M(white)); box(lerp(a, b, .86 + .065), ra, .3, MESH + .45, .32, yG - .1, M(white));
    const bq = lerp(a, b, .6), q = [bq[0] + n[0] * .55, bq[1] + n[1] * .55], gris = M('#bdbab3');
    box(q, ra, 1.1, .9, .7, yG, gris); box(q, ra, 1.2, .08, .8, yG + .9, M('#d98c4a')); box(q, ra, .9, .7, .6, yG + 1.0, gris);
    box(q, ra, 1.0, .25, .7, yG + 1.7, gris); box(q, ra, .35, .5, .35, yG + 1.95, gris);
  }
  // ---------- Verja del paso (acceso al patio interior), al pie de la escalera ----------
  { const a = [85.2, 189.6], b = [88.4, 189.0], ra = ang(a, b), hi = Math.max(Hgt(86.8, 189.6), yG) + .06, met = M('#7d8186'), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    box(lerp(a, b, .08), ra, .45, 1.9, .45, hi - .1, M('#e9e3d6')); box(lerp(a, b, .92), ra, .45, 1.9, .45, hi - .1, M('#e9e3d6'));
    box(lerp(a, b, .5), ra, L * .76, .06, .05, hi + 1.7, met); box(lerp(a, b, .5), ra, L * .76, .06, .05, hi + .1, met); box(lerp(a, b, .5), ra, L * .76, .05, .05, hi + .9, met);
    for (let t = .14; t <= .86; t += .045) box(lerp(a, b, t), ra, .03, 1.65, .03, hi + .08, met);
  }
  // ---------- Portón en el hueco de la pared del fondo del conjunto ----------
  { const a = [80.5, 220.2], b = [76.1, 220.5], ra = ang(a, b), y0 = Hgt(78.3, 220.3) - .1;
    box(lerp(a, b, .04), ra, .45, 2.0, .45, y0, M(white)); box(lerp(a, b, .96), ra, .45, 2.0, .45, y0, M(white));
    box(lerp(a, b, .5), ra, 3.8, 1.7, .05, y0 + .15, M('#e8e6df')); box(lerp(a, b, .5), ra, .04, 1.7, .08, y0 + .15, M('#6f7377'));
  }

  // ---------- Planta baja continua con la vecina: relleno del hueco (3 m, blanco) ----------
  { const sl = buffer(), kW = C(white), yt = yH + 2.75, y0 = yH - .4;
    for (let i = 0; i < SLOT.length; i++) { const a = SLOT[i], b = SLOT[(i + 1) % SLOT.length];
      tri(sl, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], yt, b[1]], kW); tri(sl, [a[0], y0, a[1]], [b[0], yt, b[1]], [a[0], yt, a[1]], kW); }
    fan(sl, SLOT, yt, kW);
    g.add(toMesh(sl, texturedMaterial('estuco', { vertexColors: true, normal: .4, side: THREE.DoubleSide }))); }

  // ---------- Fachada trasera ----------
  const wM = M(white), cristal = M('#55656e'), marco = M('#f4f4f2'), madera = M('#c8b08d'), mallor = M('#f7f7f5');
  // volumen de planta baja entre la pared del Catastro (cuerpo izquierdo) y el plano único de planta baja
  { const bl = buffer(), kW = C(white), yt = yH + 2.75, y0 = yH - .4, P = [W(UL, 0), W(SPLIT, 0), P0, G(UL, 0)];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
      tri(bl, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], yt, b[1]], kW); tri(bl, [a[0], y0, a[1]], [b[0], yt, b[1]], [a[0], yt, a[1]], kW); }
    fan(bl, P, yt, kW); g.add(toMesh(bl, texturedMaterial('estuco', { vertexColors: true, normal: .4, side: THREE.DoubleSide }))); }
  // paños blancos que tapan lo que pinta el sombreado general: planta baja (un plano), planta alta de cada cuerpo y quiebro
  gbox(UL, SPLIT + .32, -.3, 2.75, -.02, .04, wM);
  fbox(sg.u0, LR + .05, -.3, 5.9, -.02, .04, wM);
  fbox(-.1, SPLIT, 2.75, 5.9, -.02, .04, wM); fbox(SPLIT, sg.u0, 2.75, 5.9, -.02, .04, wM);
  // pared de la casa vecina que da al jardín (planta baja): sin ventanas
  { const a = [77.4, 204.5], b = [75.2, 198.7], n = inward(a, b), L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = lerp(a, b, .5);
    box([m[0] + n[0] * .03, m[1] + n[1] * .03], ang(a, b), L, 3.05, .06, yH - .3, wM); }
  // tejadillo de teja: de la pared de la vecina hasta la separación de los cuerpos, con pendiente hacia el jardín
  const teja = buffer(), kT = C('#ffffff'), yT0 = yH + 3.1, yT1 = yH + 2.75, d = 1.3;
  { const p = (u, n, y) => { const q = W(u, n); return [q[0], y, q[1]]; };
    tri(teja, p(UL, 0, yT0), p(SPLIT, 0, yT0), p(SPLIT, d, yT1), kT, [UL, 0, SPLIT, 0, SPLIT, d]); tri(teja, p(UL, 0, yT0), p(SPLIT, d, yT1), p(UL, d, yT1), kT, [UL, 0, SPLIT, d, UL, d]); }
  g.add(toMesh(teja, texturedMaterial('teja', { vertexColors: true, side: THREE.DoubleSide, normal: 1.2 })));
  fbox(UL, SPLIT, 2.6, 2.75, .02, d, M('#f1efe9'));                                  // canto blanco del tejadillo
  // toldo beige: desde la vecina hasta antes de la separación
  { const p = (u, n, y) => { const q = G(u, n); return [q[0], y, q[1]]; }, aw = buffer(), k = C('#dccbb0'), u0 = UL + .2, u1 = 4.5;
    tri(aw, p(u0, .05, yH + 2.6), p(u1, .05, yH + 2.6), p(u1, 2.3, yH + 2.25), k); tri(aw, p(u0, .05, yH + 2.6), p(u1, 2.3, yH + 2.25), p(u0, 2.3, yH + 2.25), k);
    g.add(toMesh(aw, M('#ffffff', { vertexColors: true, side: THREE.DoubleSide }))); gbox(u0, u1, 2.05, 2.25, 2.25, 2.32, M('#cdb898')); }
  // planta baja: corredera de cristal y ventana del patio (a la izquierda de la separación)
  gbox(.47, 2.63, 0, 2.2, .03, .07, cristal); gbox(.47, 2.63, 2.2, 2.28, .03, .09, marco); gbox(1.53, 1.57, 0, 2.2, .03, .09, marco);
  gbox(3.75, 4.7, .95, 2.15, .03, .07, cristal); gbox(3.65, 4.8, .88, .95, .03, .17, marco);
  // planta alta, cuerpo izquierdo: balcón sobre el tejadillo (acaba en la separación) y puerta con mallorquinas
  const bu0 = .9, bu1 = SPLIT - .05;
  fbox(bu0, bu1, 3.95, 4.03, 1.05, 1.15, madera);
  for (let u = bu0; u <= bu1 + 1e-6; u += .14) fbox(u - .02, u + .02, 3.05, 3.95, 1.07, 1.13, madera);
  fbox(2.28, 3.39, 3.15, 5.2, .04, .08, mallor); fbox(2.82, 2.85, 3.15, 5.2, .04, .1, M('#e3e2de'));
  // cuerpo derecho: aire acondicionado (más bajo), ventanita y ventana con mallorquinas en la planta alta
  fbox(5.6, 6.5, 2.3, 2.85, .04, .34, M('#eceeef'));
  fbox(6.1, 6.7, 4.2, 4.7, .04, .07, cristal); fbox(6.05, 6.75, 4.15, 4.2, .04, .09, marco);
  fbox(8.3, 9.55, 3.8, 5.0, .04, .09, mallor); fbox(8.91, 8.94, 3.8, 5.0, .04, .11, M('#e3e2de')); fbox(8.2, 9.65, 5.0, 5.12, .04, .27, M('#d98c6a'));
  return g;
}
