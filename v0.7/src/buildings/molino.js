import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
// v2 · Molino de Es Castell (edificio nº 120, ref. catastral 0251108FE1105S), en lo alto de la loma, delante de la iglesia.
// REAL: posición y diámetro de la torre (el círculo de la huella del Catastro, ~2,3 m de radio; aquí 2,9 m porque la
// ortofoto PNOA y las fotos muestran una torre algo más ancha). El resto de la parcela (franja hacia el sureste) es la
// terraza blanca que se ve en la ortofoto.
// ESTIMADO a partir de las fotos de referencia: torre blanca de sillares algo troncocónica de ~11 m, cubierta cónica con
// gajos rojos y blancos, 6 aspas de celosía con su palo de proa y los cables, puerta elevada con escalera, ventanitas
// cuadradas y plataforma circular de pared seca. Orientación: aspas hacia el NNE (la tramontana) y puerta al ONO
// (en la foto de la puerta se ven a la izquierda las cúpulas de la iglesia y a la derecha los edificios naranjas).
export const MILL_REF = '0251108FE1105S';
const C0 = [-250.33, -139.2];                 // centro de la torre (REAL, círculo de la huella del Catastro)
const AZ_SAILS = 30, AZ_DOOR = 300;           // grados desde el norte, en sentido horario (ESTIMADOS)
const az = d => [Math.sin(d * Math.PI / 180), -Math.cos(d * Math.PI / 180)];   // marco local: x este, z sur

export function windmill(Hgt) {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const white = M('#f3f0e8'), red = M('#a8322d'), capW = M('#f6f4ee'), dark = M('#2b2622'), door = M('#4a3322'),
    wood = M('#3b2f27'), wire = M('#5d5a55'), stoneStep = M('#c7b48f'), terr = M('#d9d2c2');
  const yC = Hgt(C0[0], C0[1]), top = yC + .35;            // nivel de la plataforma
  const R0 = 3.0, R1 = 2.7, H = 11.0, eave = top + H;      // torre: radio abajo/arriba y altura (ESTIMADOS)
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // barra de sección cuadrada t entre dos puntos
  const bar = (a, b, t, m) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (L < 1e-3) return;
    const o = new THREE.Mesh(new THREE.BoxGeometry(t, t, L), m); o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    o.lookAt(b[0], b[1], b[2]); g.add(o); };

  // --- Plataforma circular de pared seca (r = 7 m) y terraza blanca de la parcela -----------------------------------
  const st = buffer(), wh = buffer(), pv = buffer(), RP = 7.0, NS = 56, TH = .6;
  const cS = new THREE.Color('#ffffff'), cW = new THREE.Color('#f1efe8'), cP = new THREE.Color('#d8cfbd');
  for (let i = 0; i < NS; i++) {
    const a0 = i / NS * Math.PI * 2, a1 = (i + 1) / NS * Math.PI * 2, u0 = a0 * RP, u1 = a1 * RP;
    const p = (a, r) => [C0[0] + Math.cos(a) * r, C0[1] + Math.sin(a) * r];
    const [o0, o1, i0, i1] = [p(a0, RP), p(a1, RP), p(a0, RP - TH), p(a1, RP - TH)];
    const b0 = Hgt(...o0) - .4, b1 = Hgt(...o1) - .4, yt = top + .45;
    tri(st, [o0[0], b0, o0[1]], [o1[0], b1, o1[1]], [o1[0], yt, o1[1]], cS, [u0, b0, u1, b1, u1, yt]);
    tri(st, [o0[0], b0, o0[1]], [o1[0], yt, o1[1]], [o0[0], yt, o0[1]], cS, [u0, b0, u1, yt, u0, yt]);
    tri(st, [i0[0], top, i0[1]], [i1[0], top, i1[1]], [i1[0], yt, i1[1]], cS, [u0, 0, u1, 0, u1, .45]);
    tri(st, [i0[0], top, i0[1]], [i1[0], yt, i1[1]], [i0[0], yt, i0[1]], cS, [u0, 0, u1, .45, u0, .45]);
    tri(st, [o0[0], yt, o0[1]], [o1[0], yt, o1[1]], [i1[0], yt, i1[1]], cS);
    tri(st, [o0[0], yt, o0[1]], [i1[0], yt, i1[1]], [i0[0], yt, i0[1]], cS);
    tri(pv, [C0[0], top, C0[1]], [i0[0], top, i0[1]], [i1[0], top, i1[1]], cP);   // suelo de la plataforma
  }
  // Terraza (REAL: franja de la parcela hacia el sureste): muros blancos y suelo enlosado al nivel de la plataforma
  const strip = [[-246.12, -133.1], [-238.94, -139.98], [-242.39, -143.57], [-249.0, -137.3]];
  const ty = top - .05;
  for (let j = 0; j < strip.length; j++) { const a = strip[j], c = strip[(j + 1) % strip.length], ha = Hgt(...a) - .4, hc = Hgt(...c) - .4, L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    tri(wh, [a[0], ha, a[1]], [c[0], hc, c[1]], [c[0], ty + .9, c[1]], cW, [0, ha, L, hc, L, ty + .9]);
    tri(wh, [a[0], ha, a[1]], [c[0], ty + .9, c[1]], [a[0], ty + .9, a[1]], cW, [0, ha, L, ty + .9, 0, ty + .9]); }
  tri(pv, [strip[0][0], ty, strip[0][1]], [strip[1][0], ty, strip[1][1]], [strip[2][0], ty, strip[2][1]], cP);
  tri(pv, [strip[0][0], ty, strip[0][1]], [strip[2][0], ty, strip[2][1]], [strip[3][0], ty, strip[3][1]], cP);
  g.add(toMesh(st, texturedMaterial('piedra_seca', { vertexColors: true, normal: 1.3, side: THREE.DoubleSide })));
  g.add(toMesh(wh, texturedMaterial('estuco', { vertexColors: true, normal: .5, side: THREE.DoubleSide })));
  g.add(toMesh(pv, texturedMaterial('losa_plaza', { vertexColors: true, side: THREE.DoubleSide, normal: .5 })));

  // --- Torre ---------------------------------------------------------------------------------------------------------
  add(new THREE.CylinderGeometry(R1, R0, H + .4, 40, 1, true), white, C0[0], top - .4 + (H + .4) / 2, C0[1]);
  add(new THREE.CylinderGeometry(R1 + .12, R1 + .12, .22, 40), white, C0[0], eave - .05, C0[1]);   // cornisa
  // Cubierta cónica: 8 gajos alternos rojo / blanco
  for (let k = 0; k < 8; k++) add(new THREE.ConeGeometry(R1 + .25, 3.2, 6, 1, true, k * Math.PI / 4, Math.PI / 4), k % 2 ? capW : red, C0[0], eave + 1.6, C0[1]);
  add(new THREE.SphereGeometry(.18, 10, 8), capW, C0[0], eave + 3.25, C0[1]);
  const rAt = y => R0 + (R1 - R0) * (y - top) / H;           // radio de la torre a la altura y
  const onWall = (d, y, out = .02) => { const v = az(d), r = rAt(y) + out; return [C0[0] + v[0] * r, C0[1] + v[1] * r]; };
  // Puerta elevada con escalera de marés (foto de la puerta)
  const dy = top + 1.5, [dx, dz] = onWall(AZ_DOOR, dy + 1), rd = -AZ_DOOR * Math.PI / 180;
  add(new THREE.BoxGeometry(1.05, 2.1, .12), door, dx, dy + 1.05, dz, rd);
  add(new THREE.BoxGeometry(1.45, .2, .3), white, dx, dy + 2.25, dz, rd);   // dintel
  const vD = az(AZ_DOOR);
  for (let s = 0; s < 7; s++) {   // 7 peldaños de 0,21 m
    const r = rAt(top) + .3 + (6 - s) * .32, h = (s + 1) * .214;
    add(new THREE.BoxGeometry(1.7, h, .34), stoneStep, C0[0] + vD[0] * r, top + h / 2 - .02, C0[1] + vD[1] * r, rd);
  }
  // Ventanitas cuadradas (fotos): dos en la parte alta y una junto a la puerta
  for (const [d, y, s] of [[AZ_DOOR, top + H - 1.2, .45], [AZ_DOOR + 150, top + 6.5, .4], [AZ_DOOR - 80, top + 3.2, .4], [AZ_DOOR + 40, top + 1.0, .6]]) {
    const [x, z] = onWall(d, y); add(new THREE.BoxGeometry(s, s, .1), dark, x, y, z, -d * Math.PI / 180);
  }

  // --- Aspas: 6 de celosía, palo de proa y cables -------------------------------------------------------------------
  const S = az(AZ_SAILS), E = [-S[1], S[0]];                // S: hacia donde miran las aspas · E: horizontal en su plano
  const hubY = eave + 1.5, hubR = R1 + 1.0;
  const hub = [C0[0] + S[0] * hubR, hubY, C0[1] + S[1] * hubR];
  const P = (o, d, n, r, w) => [o[0] + (d[0] * r + n[0] * w), o[1] + (d[1] * r + n[1] * w), o[2] + (d[2] * r + n[2] * w)];
  bar([C0[0], hubY, C0[1]], hub, .32, wood);                 // eje
  add(new THREE.CylinderGeometry(.35, .35, .5, 12), wood, ...hub).lookAt(hub[0] + S[0], hub[1], hub[2] + S[1]);
  const bow = [hub[0] + S[0] * 3.2, hubY, hub[2] + S[1] * 3.2];
  bar(hub, bow, .1, wood);                                   // palo de proa
  const LS = 9.5, tips = [];
  for (let k = 0; k < 6; k++) {
    const f = Math.PI / 2 + k * Math.PI / 3, d = [E[0] * Math.sin(f), Math.cos(f), E[1] * Math.sin(f)];
    const n = [E[0] * Math.cos(f), -Math.sin(f), E[1] * Math.cos(f)];   // perpendicular al brazo, dentro del plano
    const tip = P(hub, d, n, LS, 0); tips.push(tip);
    bar(hub, tip, .15, wood);                                // brazo
    const r0 = 2.2, wa = -.35, wb = 1.35;                    // celosía: de r0 a la punta, de wa a wb a lo ancho
    for (const w of [wa, wb]) bar(P(hub, d, n, r0, w), P(hub, d, n, LS, w), .06, wood);
    bar(P(hub, d, n, r0, (wa + wb) / 2), P(hub, d, n, LS, (wa + wb) / 2), .04, wood);
    for (let r = r0; r <= LS + 1e-6; r += (LS - r0) / 10) bar(P(hub, d, n, r, wa), P(hub, d, n, r, wb), .05, wood);
    bar(bow, tip, .035, wire);                               // cable de la proa a la punta
  }
  for (let k = 0; k < 6; k++) bar(tips[k], tips[(k + 1) % 6], .03, wire);   // cables entre puntas
  return g;
}
