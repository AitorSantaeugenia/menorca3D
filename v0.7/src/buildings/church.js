import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
// v2 · Iglesia del Roser de Es Castell (edificio nº 464, ref. catastral 0352701FE1105S) y su convento.
// Huella REAL (Catastro): la pieza grande de la parcela (≈ 47 × 21 m, una «planta» en el Catastro) es la iglesia; las
// piezas estrechas del lado suroeste (2–3 plantas) son el convento blanco, que se dibuja con el código general.
// Forma y medidas ESTIMADAS a partir de las fotos de referencia: fachada de sillería de marés al
// noroeste, mirando a la plaza; campanario a la izquierda (lado noreste), frontón con cruz y óculo, pórtico con arco y
// pilastras, cuerpo cuadrado a la derecha; nave con contrafuertes y óculos en el lado noreste; cimborrio octogonal con
// cúpula y linterna; sacristía al fondo con cupulín blanco.
export const CHURCH_REF = '0352701FE1105S';
export const CHURCH_TOP = 12;   // altura de la nave (alero), para ocultar las medianeras del convento
const STONE = '#ffffff', STONE_LIGHT = '#fbf6ea', STONE_DARK = '#e2d9c6', DARK = '#2a2521', DOOR = '#3a2a1f', WHITE = '#f1efe8';

export function churchOfRoser(Hgt) {
  // Marco de la iglesia: A–B = línea de fachada (REAL, esquinas de la huella del Catastro), U = hacia el altar (sureste),
  // V = a lo ancho, de A (lado del convento) a B (lado del campanario).
  const A = [-240.9, -202.2], B = [-228.4, -219.5];
  const W = Math.hypot(B[0] - A[0], B[1] - A[1]), V = [(B[0] - A[0]) / W, (B[1] - A[1]) / W], U = [-V[1], V[0]];
  const L = 40, LA = 47.2;   // nave hasta 40 m; sacristía hasta el fondo de la parcela (REAL: 47,2 m)
  const P = (u, v, y) => [A[0] + U[0] * u + V[0] * v, y, A[1] + U[1] * u + V[1] * v];
  const Hu = (u, v) => Hgt(A[0] + U[0] * u + V[0] * v, A[1] + U[1] * u + V[1] * v);
  const g = Hu(-3, W / 2);   // suelo de la plaza delante de la puerta
  let gmin = g; for (const [u, v] of [[0, 0], [0, W], [LA, 0], [LA, W], [L / 2, W / 2]]) gmin = Math.min(gmin, Hu(u, v));
  const y0 = gmin - .6;      // las paredes arrancan bajo el terreno
  const st = buffer(), wh = buffer(), dk = buffer(), tl = buffer(), group = new THREE.Group();
  const C = c => new THREE.Color(c), cS = C(STONE), cL = C(STONE_LIGHT), cD = C(STONE_DARK), cK = C(DARK), cW = C(WHITE);

  // Cara plana de 4 vértices (abajo-izq., abajo-der., arriba-der., arriba-izq.), orientada hacia fuera de «inside».
  const quad = (b, p0, p1, p2, p3, k, Lw, Hh, inside) => {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2];
    if (n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) + n[2] * (m[2] - inside[2]) < 0) {
      tri(b, p1, p0, p3, k, [Lw, 0, 0, 0, 0, Hh]); tri(b, p1, p3, p2, k, [Lw, 0, 0, Hh, Lw, Hh]);
    } else { tri(b, p0, p1, p2, k, [0, 0, Lw, 0, Lw, Hh]); tri(b, p0, p2, p3, k, [0, 0, Lw, Hh, 0, Hh]); }
  };
  // Prisma alineado con la iglesia: u0–u1 (fondo), v0–v1 (ancho), ya–yb (altura)
  const box = (b, u0, u1, v0, v1, ya, yb, k, top = true) => {
    const c = P((u0 + u1) / 2, (v0 + v1) / 2, (ya + yb) / 2), du = u1 - u0, dv = v1 - v0, h = yb - ya;
    quad(b, P(u0, v0, ya), P(u1, v0, ya), P(u1, v0, yb), P(u0, v0, yb), k, du, h, c);
    quad(b, P(u1, v0, ya), P(u1, v1, ya), P(u1, v1, yb), P(u1, v0, yb), k, dv, h, c);
    quad(b, P(u1, v1, ya), P(u0, v1, ya), P(u0, v1, yb), P(u1, v1, yb), k, du, h, c);
    quad(b, P(u0, v1, ya), P(u0, v0, ya), P(u0, v0, yb), P(u0, v1, yb), k, dv, h, c);
    if (top) quad(b, P(u0, v0, yb), P(u1, v0, yb), P(u1, v1, yb), P(u0, v1, yb), k, du, dv, P((u0 + u1) / 2, (v0 + v1) / 2, yb - 1));
  };
  // Hastial o frontón triangular de grosor t, con su base en ya y vértice en yb (plano u = uf … uf + t)
  const gable = (b, uf, t, v0, v1, ya, yb, k) => {
    const vm = (v0 + v1) / 2, inside = P(uf + t / 2, vm, ya + (yb - ya) / 3);
    for (const u of [uf, uf + t]) {
      const a = P(u, v0, ya), c = P(u, v1, ya), d = P(u, vm, yb);
      const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], m = P(u, vm, ya + 1);
      const out = n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) + n[2] * (m[2] - inside[2]) >= 0;
      const uv = [0, 0, v1 - v0, 0, (v1 - v0) / 2, yb - ya];
      out ? tri(b, a, c, d, k, uv) : tri(b, c, a, d, k, [uv[2], 0, 0, 0, uv[4], uv[5]]);
    }
    const s = Math.hypot((v1 - v0) / 2, yb - ya);
    quad(b, P(uf, v0, ya), P(uf + t, v0, ya), P(uf + t, vm, yb), P(uf, vm, yb), k, t, s, inside);
    quad(b, P(uf, v1, ya), P(uf + t, v1, ya), P(uf + t, vm, yb), P(uf, vm, yb), k, t, s, inside);
  };
  // Hueco oscuro (puerta, arco, óculo) en un plano: pts2 = [[s, h]], s a lo largo del plano, h altura sobre el suelo
  const plate = (b, pts2, map, k) => {
    const v2 = pts2.map(q => new THREE.Vector2(q[0], q[1]));
    for (const t of THREE.ShapeUtils.triangulateShape(v2, [])) {
      const [a, c, d] = t.map(i => map(pts2[i][0], pts2[i][1]));
      // las placas son de doble cara en el material: el orden de vértices da igual
      tri(b, a, c, d, k, [pts2[t[0]][0], pts2[t[0]][1], pts2[t[1]][0], pts2[t[1]][1], pts2[t[2]][0], pts2[t[2]][1]]);
    }
  };
  const arch = (s0, w, h) => {   // contorno de un arco de medio punto: ancho w, altura total h
    const r = w / 2, pts = [[s0, 0], [s0 + w, 0], [s0 + w, h - r]];
    for (let i = 1; i < 12; i++) { const a = Math.PI * i / 12; pts.push([s0 + r + r * Math.cos(a), h - r + r * Math.sin(a)]); }
    pts.push([s0, h - r]); return pts;
  };
  const disc = (s, h, r, n = 18) => Array.from({ length: n }, (_, i) => [s + r * Math.cos(2 * Math.PI * i / n), h + r * Math.sin(2 * Math.PI * i / n)]);
  const onFront = u => (s, h) => P(u, s, g + h);                 // planos de fachada (miran al noroeste): s = v
  const onSideNE = v => (s, h) => P(s, v, g + h);                // lado noreste: s = u

  // ---------- Nave (marés) con cubierta de teja a dos aguas ----------
  // Ortofoto PNOA (IGN): nave de unos 10 m de ancho centrada entre el cuerpo derecho y el campanario, capillas laterales
  // con tejadillos perpendiculares en el lado noreste, cupulín blanco sobre el crucero y otro sobre la sacristía.
  const T0 = W - 5.6, NV0 = 5.4, NV1 = T0, NM = (NV0 + NV1) / 2;  // campanario v T0…W · nave v NV0…NV1
  const EAVE = g + CHURCH_TOP + .5, RIDGE = EAVE + (NV1 - NV0) / 2 * Math.tan(THREE.MathUtils.degToRad(28));
  box(st, 0, L, NV0, NV1, y0, EAVE, cS, false);
  gable(st, L - .6, .6, NV0, NV1, EAVE, RIDGE, cS);               // hastial del fondo
  gable(st, 0, .4, NV0, NV1, EAVE, RIDGE, cS);                    // hastial delantero (tras la fachada)
  const OV = .45, tile = C('#f2e6e0');
  const roofSide = (va, vb) => {                                   // faldón de va (alero) a vb (cumbrera)
    const a = P(-.2, va, EAVE - .15), b = P(L + OV, va, EAVE - .15), c = P(L + OV, vb, RIDGE), d = P(-.2, vb, RIDGE);
    quad(tl, a, b, c, d, tile, L + OV + .2, Math.hypot(vb - va, RIDGE - EAVE), P(L / 2, NM, EAVE));
  };
  roofSide(NV0 - OV, NM); roofSide(NV1 + OV, NM);
  // Nave lateral del lado del convento (v 0…NV0): muro de marés y tejado de una vertiente apoyado en la nave
  box(st, 5.0, L, 0, NV0, y0, g + 8.6, cS, false);
  quad(tl, P(5.0, -.35, g + 8.5), P(L + OV, -.35, g + 8.5), P(L + OV, NV0, g + 10.4), P(5.0, NV0, g + 10.4), tile, L - 5, NV0, P(L / 2, NV0 / 2, g));
  // Capillas del lado noreste (v NV1…W), cada una con su tejadillo a dos aguas perpendicular a la nave y contrafuertes
  const CH0 = 5.0, CH1 = 31, NB = 5, BW = (CH1 - CH0) / NB, CE = g + 8.0, CR = CE + BW / 2 * .55;
  box(st, CH0, CH1, NV1, W, y0, CE, cS, false);
  const gableV = (b, vf, t, u0, u1, ya, yb, k) => {               // hastial en el plano v = vf … vf + t
    const um = (u0 + u1) / 2, inside = P(um, vf - 2, ya);
    const n = (a, c, d) => { const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; };
    for (const v of [vf, vf + t]) { const a = P(u0, v, ya), c = P(u1, v, ya), d = P(um, v, yb), nn = n(a, c, d), m = P(um, v, ya + 1);
      const out = nn[0] * (m[0] - inside[0]) + nn[1] * (m[1] - inside[1]) + nn[2] * (m[2] - inside[2]) >= 0;
      out ? tri(b, a, c, d, k, [0, 0, u1 - u0, 0, (u1 - u0) / 2, yb - ya]) : tri(b, c, a, d, k, [u1 - u0, 0, 0, 0, (u1 - u0) / 2, yb - ya]); }
  };
  for (let i = 0; i < NB; i++) {
    const u0 = CH0 + i * BW, u1 = u0 + BW, um = (u0 + u1) / 2, s = Math.hypot(BW / 2 + .3, CR - CE);
    quad(tl, P(u0 - .3, NV1, CE - .15), P(u0 - .3, W + .35, CE - .15), P(um, W + .35, CR), P(um, NV1, CR), tile, W + .35 - NV1, s, P(um, (NV1 + W) / 2, CE));
    quad(tl, P(u1 + .3, NV1, CE - .15), P(u1 + .3, W + .35, CE - .15), P(um, W + .35, CR), P(um, NV1, CR), tile, W + .35 - NV1, s, P(um, (NV1 + W) / 2, CE));
    gableV(st, W - .3, .3, u0, u1, CE, CR, cS);
    plate(dk, disc(um, 5.6, .42), onSideNE(W + .03), cK);                                          // óculo de la capilla
    plate(dk, disc(um, 10.9, .45), (s2, h) => P(s2, NV1 + .03, g + h), cK);                      // óculo alto de la nave
    box(st, u0 - .45, u0 + .45, W, W + 1.0, y0, g + 6.8, cD);                                    // contrafuerte
    quad(st, P(u0 - .45, W + 1.0, g + 6.8), P(u0 + .45, W + 1.0, g + 6.8), P(u0 + .45, W, g + 7.9), P(u0 - .45, W, g + 7.9), cD, .9, 1.4, P(u0, W - 1, g + 6));
  }
  box(st, CH1, L, NV1, W, y0, g + 9.0, cS);                       // sacristía lateral (cubierta plana)
  // ---------- Fachada (noroeste) ----------
  // Cuerpo central con frontón (v 5,4 … T0), adelantado 0,6 m
  box(st, -.6, 0, 5.4, T0, y0, g + 12.2, cS);
  box(st, -1.0, 0, 5.1, T0 + .2, g + 12.2, g + 12.65, cL);        // cornisa
  gable(st, -.75, .75, 5.4, T0, g + 12.65, g + 17.4, cS);
  box(st, -.95, -.6, 5.2, T0 + .1, g + 12.65, g + 12.85, cL, true);
  { const vm = (5.4 + T0) / 2;                                    // cruz de piedra en el vértice
    box(st, -.55, -.25, vm - .13, vm + .13, g + 17.2, g + 19.0, cL); box(st, -.55, -.25, vm - .55, vm + .55, g + 18.2, g + 18.45, cL);
    plate(dk, disc(vm, 11.25, .62), onFront(-.63), cK);           // óculo sobre el pórtico
    plate(st, disc(vm, 11.25, .82), onFront(-.62), cL);            // su moldura
  }
  // Cuerpo derecho (lado del convento, v 0 … 5,4): bloque cuadrado de cubierta plana (frontandwhitehouse.webp)
  box(st, -.3, 0, 0, 5.4, y0, g + 13.0, cS); box(st, -.5, 0, -.1, 5.4, g + 13.0, g + 13.35, cL);
  plate(dk, disc(2.7, 7.6, .32), onFront(-.33), cK); plate(dk, disc(2.7, 11.0, .32), onFront(-.33), cK);
  // Pórtico con arco de medio punto y pilastras (front.webp, gate.webp)
  const p0 = 6.6, p1 = T0 - 1.0, pm = (p0 + p1) / 2;
  box(st, -1.9, -.6, p0, p1, y0, g + 9.3, cS);
  box(st, -2.15, -.6, p0 - .2, p1 + .2, g + 9.3, g + 10.1, cL);                  // entablamento
  box(st, -2.3, -.6, p0 - .3, p1 + .3, g + 10.1, g + 10.3, cL);
  for (const v of [p0 + .1, p0 + 1.45, p1 - 1.45, p1 - .1]) box(st, -2.05, -1.9, v - .32, v + .32, y0, g + 9.3, cL, false);   // pilastras
  plate(dk, arch(pm - 1.85, 3.7, 7.4), onFront(-2.08), cK);                         // arco (sombra)
  plate(st, arch(pm - 2.15, 4.3, 7.75), onFront(-2.07), cL);                        // dovelas
  plate(dk, [[pm - 1.05, 0], [pm + 1.05, 0], [pm + 1.05, 3.9], [pm - 1.05, 3.9]], onFront(-2.1), C(DOOR));   // puerta
  // Campanario (v T0 … W): fuste, cornisa, cuerpo de campanas con arcos, remate
  box(st, -.6, 5.0, T0, W, y0, g + 15.0, cS);
  box(st, -.85, 5.25, T0 - .25, W + .25, g + 15.0, g + 15.4, cL);
  box(st, -.35, 4.75, T0 + .25, W - .25, g + 15.4, g + 19.6, cS);
  box(st, -.6, 5.0, T0, W, g + 19.6, g + 19.95, cL);
  box(st, -.2, 4.6, T0 + .4, W - .4, g + 19.95, g + 20.6, cS);
  { const tc = P(2.2, (T0 + W) / 2, g + 20.6), tw = W - .4 - (T0 + .4);
    const sm = new THREE.MeshLambertMaterial({ color: '#cfc3a6' });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(tw * .42, tw * .46, .7, 8), sm); drum.position.set(tc[0], tc[1] + .35, tc[2]); group.add(drum);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(tw * .36, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), sm); cap.scale.set(1, 1.1, 1); cap.position.set(tc[0], tc[1] + .7, tc[2]); group.add(cap);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), new THREE.MeshLambertMaterial({ color: '#cfc3a6' }));
    ball.position.set(tc[0], tc[1] + .7 + tw * .4 + .2, tc[2]); group.add(ball);
    const vm = (T0 + W) / 2;
    const hb = 16.3;   // arranque de los arcos del cuerpo de campanas
    for (const [plane, s] of [[(q, h) => P(-.38, q, g + hb + h), vm], [(q, h) => P(4.78, q, g + hb + h), vm], [(q, h) => P(q, T0 + .22, g + hb + h), 2.2], [(q, h) => P(q, W - .22, g + hb + h), 2.2]])
      plate(dk, arch(s - .65, 1.3, 2.7), plane, cK);
    plate(dk, disc(vm, 8.0, .3), onFront(-.63), cK); plate(dk, disc(2.2, 8.0, .3), onSideNE(W + .03), cK);
  }

  // ---------- Cupulín blanco sobre el crucero (ortofoto: círculo blanco sobre la cumbrera) ----------
  { const u = CH1 + .3; box(st, u - 1.3, u + 1.3, NM - 1.3, NM + 1.3, RIDGE - 1.5, RIDGE + .5, cL); cupolaAt(u, NM, RIDGE + .5, 1.0); }
  // ---------- Sacristía al fondo (marés) con cupulín blanco; anexo blanco del convento ----------
  box(st, L, LA, 0, W, y0, g + 9.0, cS); box(st, L - .1, LA + .2, -.2, W + .2, g + 9.0, g + 9.35, cL);
  box(wh, L - 3, LA, -7.1, 0, y0, g + 6.0, cW); box(wh, L - 3.1, LA + .1, -7.2, .05, g + 6.0, g + 6.6, cW);
  function cupolaAt(u, v, y, r) {   // cupulín blanco (lateral1.webp, lateral2.webp)
    const p = P(u, v, y), m = new THREE.MeshLambertMaterial({ color: WHITE }), dm = new THREE.MeshLambertMaterial({ color: DARK });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 1.6, 12), m); body.position.set(p[0], y + r * .8, p[2]); group.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m); dome.position.set(p[0], y + r * 1.6, p[2]); group.add(dome);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r * .18, 8, 6), m); tip.position.set(p[0], y + r * 2.75, p[2]); group.add(tip);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, w = new THREE.Mesh(new THREE.PlaneGeometry(r * .45, r * .7), dm);
      w.position.set(p[0] + Math.sin(a) * (r + .02), y + r * .9, p[2] + Math.cos(a) * (r + .02)); w.rotation.y = a; group.add(w); }
  };
  cupolaAt(L + 2.3, NM, g + 9.35, 1.1);
  cupolaAt(LA - 2.5, -3.6, g + 6.6, .95);

  group.add(toMesh(st, texturedMaterial('sillar', { vertexColors: true, side: THREE.DoubleSide, normal: .8 })));
  group.add(toMesh(wh, texturedMaterial('estuco', { vertexColors: true, side: THREE.DoubleSide, normal: .4 })));
  group.add(toMesh(dk, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  group.add(toMesh(tl, texturedMaterial('teja', { vertexColors: true, side: THREE.DoubleSide, normal: 1.2 })));
  return group;
}

// v2 · Marquesina de la parada de bus «Església des Castell» (TMSA L02, parada 8130). Posición REAL de TMSA
// (39.877933 N, 4.28925 E), en la acera de la plaza, paralela a la calle; forma y medidas ESTIMADAS (marquesina
// metálica con cristal, banco, panel informativo y poste con la señal de parada).
export function busShelter(Hgt) {
  const A = [-240.9, -202.2], B = [-228.4, -219.5];
  const W = Math.hypot(B[0] - A[0], B[1] - A[1]), V = [(B[0] - A[0]) / W, (B[1] - A[1]) / W], U = [-V[1], V[0]];
  const P = (u, v) => [A[0] + U[0] * u + V[0] * v, A[1] + U[1] * u + V[1] * v];
  const [u0, v0] = [1.0, -13.2];                   // centro de la marquesina en el marco de la iglesia (de la posición de TMSA)
  const c = P(u0, v0), y0 = Hgt(c[0], c[1]) + .1, rot = -Math.atan2(U[1], U[0]);
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const metal = M('#2f3a44'), glass = M('#a9c4cf'), wood = M('#7a5636'), blue = M('#1f5fa8'), white = M('#f4f4f2');
  // caja (du a lo largo de la calle, dv hacia la plaza, h alto) colocada en (u, v, y) del marco de la iglesia
  const box = (du, h, dv, u, v, y, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(du, h, dv), m), p = P(u, v); o.position.set(p[0], y, p[1]); o.rotation.y = rot; g.add(o); return o; };
  const L = 4.0, D = 1.6, H = 2.5, vb = v0 + D / 2, vf = v0 - D / 2;   // vb: lado de la plaza (respaldo) · vf: lado de la calle
  for (const du of [-L / 2, L / 2]) for (const v of [vb, vf]) box(.08, H, .08, u0 + du, v, y0 + H / 2, metal);   // pilares
  box(L + .4, .09, D + .35, u0, v0 - .05, y0 + H + .045, metal);                     // cubierta
  box(L + .3, .03, D + .25, u0, v0 - .05, y0 + H + .1, white);
  box(L - .1, 2.0, .03, u0, vb, y0 + 1.25, glass);                                   // cristal del respaldo
  box(.03, 2.0, D - .1, u0 - L / 2, v0, y0 + 1.25, glass);                           // cristal lateral
  box(.12, 1.8, 1.2, u0 + L / 2 - .1, v0 + .1, y0 + 1.1, blue);                      // panel informativo (horarios)
  box(.13, 1.5, 1.0, u0 + L / 2 - .1, v0 + .1, y0 + 1.15, white);
  box(2.2, .05, .42, u0 - .4, vb - .3, y0 + .46, wood);                              // banco
  for (const du of [-1.3, .5]) box(.06, .44, .38, u0 + du, vb - .3, y0 + .22, metal);
  // poste con la señal de parada, en el borde de la acera
  const pp = P(u0 + L / 2 + 1.0, vf - .2), pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 3.0, 8), metal);
  pole.position.set(pp[0], y0 + 1.5, pp[1]); g.add(pole);
  box(.05, .5, .5, u0 + L / 2 + 1.0, vf - .2, y0 + 2.75, blue).rotation.y = rot + Math.PI / 2;
  box(.06, .22, .22, u0 + L / 2 + 1.0, vf - .2, y0 + 2.75, white).rotation.y = rot + Math.PI / 2;
  return g;
}
