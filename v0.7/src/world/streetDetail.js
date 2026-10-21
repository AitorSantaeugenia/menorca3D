import * as THREE from 'three';
import { uNight, dayNight } from '../core/dayNight.js';
import { buffer, tri, flat, toMesh, mergeGeos } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
import { ring, pip } from '../core/geo.js';
import { densify, offsetLine, segIndex } from './streetGeom.js';
// Detalle a pie de calle. Trazados REALES (OSM): calzadas, plazas, muros, vallas, setos, aceras y escaleras.
// Materiales PROCEDURALES calibrados con las fotos propias (docs/REFERENCIAS_VISUALES.md). Por zonas:
//   Explanada y calles que la rodean: losa gris de piedra y adoquín gris (fotos 15/–18/)
//   resto del casco: baldosa roja cuadrada (9/, 10/) · urbanizaciones: losa roja de rombos (1/–8/)
// Alturas y anchos por defecto: ESTIMADOS si OSM no los indica. Farolas, árboles de alcorque y bancos: posición ESTIMADA.
const WALL = {
  wall: { h: 1.2, w: .4, mat: 'enlucido' },                 // muro sin material en OSM: tapia enlucida (ESTIMADO)
  dry_stone: { h: 1.2, w: .7, mat: 'piedra' },               // paret seca (material REAL de OSM)
  city_wall: { h: 3, w: 1.2, mat: 'piedra' }, retaining_wall: { h: 1, w: .5, mat: 'piedra' },
  fence: { h: 1.2, w: .06, mat: 'metal', c: '#2f5f55' }, guard_rail: { h: .8, w: .1, mat: 'metal', c: '#9aa0a4' },
  hedge: { h: 1.6, w: .9, mat: 'seto', c: '#424b2d' }, kerb: { h: .12, w: .15, mat: 'enlucido', free: true },
};
// Colores de tapias medidos en las fotos propias: blanco, beige, salmón.
const TAPIA = [['#e9ebe8', 6], ['#c9ae90', 2], ['#b9a091', 1.5], ['#ece6d8', 1.5]];
const ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'living_street']);
const KERB = .12, WALK_W = 1.8, COPING = .08, NEAR_PLAZA = 140;
const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const pickW = (pal, r) => { let t = pal.reduce((s, p) => s + p[1], 0) * r; for (const [c, w] of pal) { if ((t -= w) < 0) return c; } return pal[0][0]; };

// Prisma a lo largo de una línea, apoyado en el terreno. Caras laterales con UV en metros (largo, alto).
function prism(top, sides, p, w, ground, h, kTop, kSide, y0 = -.2) {
  const L = offsetLine(p, -w / 2), R = offsetLine(p, w / 2); let u = 0;
  for (let i = 1; i < p.length; i++) {
    const ya = ground(p[i - 1]), yb = ground(p[i]), d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]), u1 = u + d;
    const l0 = [L[i - 1][0], ya + y0, L[i - 1][1]], l1 = [L[i][0], yb + y0, L[i][1]], r0 = [R[i - 1][0], ya + y0, R[i - 1][1]], r1 = [R[i][0], yb + y0, R[i][1]];
    const L0 = [l0[0], ya + h, l0[2]], L1 = [l1[0], yb + h, l1[2]], R0 = [r0[0], ya + h, r0[2]], R1 = [r1[0], yb + h, r1[2]];
    const H0 = h - y0;
    tri(sides, l0, l1, L1, kSide, [u, 0, u1, 0, u1, H0]); tri(sides, l0, L1, L0, kSide, [u, 0, u1, H0, u, H0]);
    tri(sides, r0, R1, r1, kSide, [u, 0, u1, H0, u1, 0]); tri(sides, r0, R0, R1, kSide, [u, 0, u, H0, u1, H0]);
    tri(top, L0, L1, R1, kTop); tri(top, L0, R1, R0, kTop);
    u = u1;
  }
}
// Cinta de calzada pegada al terreno (cada borde toma su propia altura). UV: largo × ancho, en metros.
function ribbon(b, p, w, zone, lift, k) {
  const L = offsetLine(p, -w / 2), R = offsetLine(p, w / 2); let u = 0;
  const y = q => zone.Hgt(q[0], q[1]) + lift;
  for (let i = 1; i < p.length; i++) {
    const u1 = u + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    const a = [L[i - 1][0], y(L[i - 1]), L[i - 1][1]], bb = [L[i][0], y(L[i]), L[i][1]], c = [R[i][0], y(R[i]), R[i][1]], d = [R[i - 1][0], y(R[i - 1]), R[i - 1][1]];
    tri(b, a, bb, c, k, [u, 0, u1, 0, u1, w]); tri(b, a, c, d, k, [u, 0, u1, w, u, w]);
    u = u1;
  }
}
// Superficie de una plaza: polígono triangulado y subdividido hasta lados de ~3 m para seguir el relieve.
function plazaSurface(b, r, zone, lift, k) {
  const v = q => new THREE.Vector2(q[0], q[1]);
  const stack = THREE.ShapeUtils.triangulateShape(r.map(v), []).map(t => [r[t[0]], r[t[1]], r[t[2]]]);
  while (stack.length) {
    const [a, c, d] = stack.pop(), la = Math.hypot(c[0] - a[0], c[1] - a[1]), lb = Math.hypot(d[0] - c[0], d[1] - c[1]), lc = Math.hypot(a[0] - d[0], a[1] - d[1]);
    const mx = Math.max(la, lb, lc);
    if (mx > 3) {                                      // partir el lado más largo
      if (mx == la) { const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; stack.push([a, m, d], [m, c, d]); }
      else if (mx == lb) { const m = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]; stack.push([a, c, m], [a, m, d]); }
      else { const m = [(d[0] + a[0]) / 2, (d[1] + a[1]) / 2]; stack.push([a, c, m], [m, c, d]); }
      continue;
    }
    const P = q => [q[0], zone.Hgt(q[0], q[1]) + lift, q[1]];
    tri(b, P(a), P(c), P(d), k);
  }
}

// ---------- v2: capas REALES del IDE Menorca (zone.ide, de pipeline/preparar_ide.py) ----------
// Superficie de un polígono con huecos, subdividida hasta lados de ~6 m para seguir el relieve (malla de 5–10 m).
function polySurface(b, rings, y, k, maxL = 6) {
  const v = q => new THREE.Vector2(q[0], q[1]), all = [].concat(...rings);
  const stack = THREE.ShapeUtils.triangulateShape(rings[0].map(v), rings.slice(1).map(h => h.map(v))).map(t => [all[t[0]], all[t[1]], all[t[2]]]);
  while (stack.length) {
    const [a, c, d] = stack.pop(), la = Math.hypot(c[0] - a[0], c[1] - a[1]), lb = Math.hypot(d[0] - c[0], d[1] - c[1]), lc = Math.hypot(a[0] - d[0], a[1] - d[1]);
    const mx = Math.max(la, lb, lc);
    if (mx > maxL && stack.length < 2e5) {
      if (mx == la) { const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; stack.push([a, m, d], [m, c, d]); }
      else if (mx == lb) { const m = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2]; stack.push([a, c, m], [a, m, d]); }
      else { const m = [(d[0] + a[0]) / 2, (d[1] + a[1]) / 2]; stack.push([a, c, m], [m, c, d]); }
      continue;
    }
    const P = q => [q[0], y(q), q[1]];
    tri(b, P(a), P(c), P(d), k);
  }
}
// Paredes verticales a lo largo de un anillo cerrado, de y0(q) a y1(q). UV: largo × alto, en metros.
function ringWalls(b, r, y0, y1, k, step = 5) {
  const p = densify(r.concat([r[0]]), step); let u = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], c = p[i], u1 = u + Math.hypot(c[0] - a[0], c[1] - a[1]);
    const a0 = [a[0], y0(a), a[1]], a1 = [a[0], y1(a), a[1]], c0 = [c[0], y0(c), c[1]], c1 = [c[0], y1(c), c[1]];
    tri(b, a0, c0, c1, k, [u, a0[1], u1, c0[1], u1, c1[1]]); tri(b, a0, c1, a1, k, [u, a0[1], u1, c1[1], u, a1[1]]);
    u = u1;
  }
}
// Recorte de un polígono por el semiplano f(q) >= 0 (Sutherland–Hodgman, f lineal).
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], fa = f(a), fc = f(c);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) != (fc >= 0)) { const t = fa / (fa - fc); out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
  }
  return out;
}
const centroid = r => r.reduce((s, q) => [s[0] + q[0] / r.length, s[1] + q[1] / r.length], [0, 0]);
// Escalera REAL en planta (IDE) → peldaños de ~17 cm. Sentido de subida: pendiente del relieve si se nota en el polígono;
// si no (escalones de entrada a una casa), hacia el edificio más cercano, con 0,5 m de subida (ESTIMADO).
function stairSteps(b, sides, r, zone, hitBuilding, k, kSide) {
  const c = centroid(r), hs = r.map(q => zone.Hgt(q[0], q[1]));
  let sxx = 0, szz = 0, sxz = 0;
  for (const q of r) { const dx = q[0] - c[0], dz = q[1] - c[1]; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const th = .5 * Math.atan2(2 * sxz, sxx - szz), U = [Math.cos(th), Math.sin(th)], V = [-U[1], U[0]];
  const ext = d => { let a = Infinity, z = -Infinity; for (const q of r) { const s = (q[0] - c[0]) * d[0] + (q[1] - c[1]) * d[1]; a = Math.min(a, s); z = Math.max(z, s); } return [a, z]; };
  // gradiente del relieve en el polígono (muestras en una cruz de ±3 m)
  const gx = (zone.Hgt(c[0] + 3, c[1]) - zone.Hgt(c[0] - 3, c[1])) / 6, gz = (zone.Hgt(c[0], c[1] + 3) - zone.Hgt(c[0], c[1] - 3)) / 6, gm = Math.hypot(gx, gz);
  let dir = null, rise = .5;
  if (gm > 1e-6) { const d = [gx / gm, gz / gm], [a, z] = ext(d); if (gm * (z - a) >= .3) { dir = d; rise = gm * (z - a); } }
  if (!dir) {
    for (const d of [U, [-U[0], -U[1]], V, [-V[0], -V[1]]]) { const [, z] = ext(d); if (hitBuilding(c[0] + d[0] * (z + .6), c[1] + d[1] * (z + .6))) { dir = d; break; } }
    dir = dir || U;
  }
  const [s0, s1] = ext(dir), L = s1 - s0; if (L < .2) return 0;
  rise = Math.min(Math.max(rise, .17), 8);
  const n = Math.max(1, Math.min(Math.round(rise / .17), Math.floor(L / .25) || 1));
  const proj = q => (q[0] - c[0]) * dir[0] + (q[1] - c[1]) * dir[1];
  const base = Math.min(...hs) - .02;
  for (let i = 0; i < n; i++) {
    const a = s0 + L * i / n, z = s0 + L * (i + 1) / n;
    const sl = clipHalf(clipHalf(r, q => proj(q) - a), q => z - proj(q)); if (sl.length < 3) continue;
    const top = base + rise * (i + 1) / n;
    flat(b, sl, top, k); ringWalls(sides, sl, () => base - .2, () => top, kSide, 5);
  }
  return n;
}

export function createStreetDetail(zone, hitBuilding) {
  const group = new THREE.Group(), ground = q => zone.Hgt(q[0], q[1]);
  const block = segIndex(), walk = segIndex(), stairs = segIndex(), stats = { calzadas: 0, plazas: 0, muros: 0, aceras: 0, escaleras: 0, farolas: 0, arboles_calle: 0, bancos: 0 };
  // ¿Zona urbana? (edificio a menos de ~30 m) → los muros de piedra llevan albardilla blanca, como en las fotos.
  const urban = new Set();
  for (const b of zone.buildings) { const q = b.p[0]; urban.add(Math.floor(q[0] / 30) + ',' + Math.floor(q[1] / 30)); }
  const isUrban = q => { const gx = Math.floor(q[0] / 30), gz = Math.floor(q[1] / 30); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (urban.has((gx + i) + ',' + (gz + j))) return true; return false; };
  const cascos = (zone.zones || []).filter(z => z.n == 'Es Castell' || z.casco);   // v2: varias zonas de casco
  const inCasco = q => cascos.some(c => Math.hypot(q[0] - c.x, q[1] - c.z) < c.r);
  const plazas = (zone.plazas || []).map(p => ring(p.p)), main = (zone.plazas || []).find(p => p.n && /esplanada/i.test(p.n));
  const pc = main ? ring(main.p).reduce((s, q, _, a) => [s[0] + q[0] / a.length, s[1] + q[1] / a.length], [0, 0]) : null;
  const nearPlaza = q => pc && Math.hypot(q[0] - pc[0], q[1] - pc[1]) < NEAR_PLAZA;
  const inPlaza = (x, z) => plazas.some(r => pip(x, z, r));
  const white = new THREE.Color('#ffffff');
  const IDE = zone.ide || null;   // v2: aceras, escaleras, porches, árboles y paredes REALES (IDE Menorca)
  const paretIdx = segIndex(), ideStairs = segIndex();
  if (IDE) {
    for (const w of IDE.paredes) for (let k = 1; k < w.p.length; k++) paretIdx.add(w.p[k - 1], w.p[k], 1.5, w.t);
    for (const e of IDE.escaleras) { const r = e.r[0]; for (let k = 0; k < r.length; k++) ideStairs.add(r[k], r[(k + 1) % r.length], 3, 'escalera'); }
    Object.assign(stats, { aceras_ide: 0, escaleras_ide: 0, peldanos: 0, porches: 0, marquesinas: 0, arboles_ide: 0, paredes_ide: 0, muros_osm_sustituidos: 0 });
  }

  // --- Calzadas: adoquín gris junto a la Explanada (fotos 16/, 17/), asfalto en el resto ---
  const ba = buffer(), bq = buffer();
  zone.roads.forEach((r, i) => {
    if (!ROADS.has(r.t)) return;
    const mid = r.p[Math.floor(r.p.length / 2)], k = new THREE.Color().setScalar(.93 + rnd(i) * .07);
    ribbon(nearPlaza(mid) ? bq : ba, densify(r.p, 2), r.w, zone, .05 + (i % 6) * .004, k); stats.calzadas++;
  });
  if (ba.p.length) group.add(toMesh(ba, texturedMaterial('asfalto', { vertexColors: true, offset: 1, side: THREE.DoubleSide })));
  if (bq.p.length) group.add(toMesh(bq, texturedMaterial('adoquin', { vertexColors: true, offset: 1, side: THREE.DoubleSide, normal: .8 })));

  // --- Plazas (REAL en forma: vías peatonales cerradas de OSM): losa gris ---
  const bp = buffer();
  plazas.forEach(r => { plazaSurface(bp, r, zone, .1, white); stats.plazas++; });
  if (bp.p.length) group.add(toMesh(bp, texturedMaterial('losa_plaza', { offset: 2, side: THREE.DoubleSide, normal: .6 })));

  // --- Muros, vallas y setos ---
  const B = { piedraT: buffer(), piedraS: buffer(), enlT: buffer(), enlS: buffer(), seto: buffer(), metal: buffer() };
  (zone.walls || []).forEach((w, i) => {
    if (IDE && (w.t == 'wall' || w.t == 'retaining_wall')) {   // ya está en el IDE (paret seca o muro de contención REAL)
      const m = w.p[Math.floor(w.p.length / 2)], m2 = w.p.length > 1 ? [(w.p[0][0] + w.p[1][0]) / 2, (w.p[0][1] + w.p[1][1]) / 2] : m;
      if (paretIdx.near(m[0], m[1]) && paretIdx.near(m2[0], m2[1])) { stats.muros_osm_sustituidos++; return; }
    }
    const stone = w.t == 'wall' && (w.m == 'dry_stone' || w.m == 'stone');
    const s = (stone ? WALL.dry_stone : WALL[w.t]) || WALL.wall, p = densify(w.p, 3), h = w.h || s.h; stats.muros++;
    if (s.mat == 'piedra') {
      const tint = new THREE.Color().setScalar(.9 + rnd(i) * .1);
      prism(B.piedraT, B.piedraS, p, s.w, ground, h, tint, tint);
      if (isUrban(p[0])) { const cap = new THREE.Color('#e4e2d5'); prism(B.enlT, B.enlS, p, s.w + .06, ground, h + COPING, cap, cap, h); }  // albardilla enlucida
    } else if (s.mat == 'enlucido') {
      const c = new THREE.Color(pickW(TAPIA, rnd(i + 31)));
      prism(B.enlT, B.enlS, p, s.w, ground, h, c, c);
    } else if (s.mat == 'seto') {
      const c = new THREE.Color(s.c).multiplyScalar(.85 + rnd(i) * .3);
      prism(B.seto, B.seto, p, s.w, ground, h, c, c);
    } else { const c = new THREE.Color(s.c); prism(B.metal, B.metal, p, s.w, ground, h, c, c); }
    if (!s.free) for (let k = 1; k < p.length; k++) block.add(p[k - 1], p[k], s.w / 2, w.t);
  });
  // v2: paredes REALES del IDE (trazado 1:5.000). Alto y ancho por tipo: ESTIMADOS (la capa no los da).
  if (IDE) {
    const PT = { paret: { h: 1.2, w: .7 }, contencion: { h: 1.0, w: .5 }, marjada: { h: .8, w: .5 } };
    const DW = Math.max(6, ((zone.terrain && zone.terrain.step) || 5) * 1.5);   // un vértice cada ~1,5 celdas del relieve
    IDE.paredes.forEach((w, i) => {
      const s = PT[w.t] || PT.paret, p = densify(w.p, DW), tint = new THREE.Color().setScalar(.9 + rnd(i + 5000) * .1);
      // Acabado por zona (ESTIMADO, como v0.7 y las fotos): casco → tapia enlucida; urbanización → piedra con
      // albardilla blanca; campo → paret seca sin albardilla. Los muros de contención y bancales, siempre de piedra.
      const mid = p[Math.floor(p.length / 2)];
      if (w.t == 'paret' && inCasco(mid)) { const c = new THREE.Color(pickW(TAPIA, rnd(i + 31))); prism(B.enlT, B.enlS, p, .4, ground, s.h + .3, c, c); }
      else {
        prism(B.piedraT, B.piedraS, p, s.w, ground, s.h, tint, tint);
        if (w.t == 'paret' && isUrban(mid)) { const cap = new THREE.Color('#e4e2d5'); prism(B.enlT, B.enlS, p, s.w + .06, ground, s.h + COPING, cap, cap, s.h); }
      }
      for (let k = 1; k < p.length; k++) block.add(p[k - 1], p[k], s.w / 2, 'paret');
      stats.paredes_ide++;
    });
  }
  const piedra = texturedMaterial('piedra_seca', { vertexColors: true, normal: 1.3, side: THREE.DoubleSide }), enl = texturedMaterial('estuco', { vertexColors: true, normal: .5, side: THREE.DoubleSide });
  if (B.piedraS.p.length) group.add(toMesh(B.piedraS, piedra), toMesh(B.piedraT, piedra));
  if (B.enlS.p.length) group.add(toMesh(B.enlS, enl), toMesh(B.enlT, enl));
  if (B.seto.p.length) group.add(toMesh(B.seto, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  if (B.metal.p.length) group.add(toMesh(B.metal, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  // --- Aceras: material por zona + bordillo gris ---
  const W = { acera: buffer(), baldosa_roja: buffer(), losa_plaza: buffer() }, ss = buffer(), kerbC = new THREE.Color('#8a8987'), walksList = [];
  const addWalk = (p, w) => {
    p = densify(p, 2); const mid = p[Math.floor(p.length / 2)];
    const mat = nearPlaza(mid) ? 'losa_plaza' : inCasco(mid) ? 'baldosa_roja' : 'acera';
    prism(W[mat], ss, p, w, ground, KERB, white, kerbC); for (let i = 1; i < p.length; i++) walk.add(p[i - 1], p[i], w / 2);
    walksList.push({ p, w, mat }); stats.aceras++;
  };
  const aceraGrid = new Map(), AG = 20;   // v2: aceras REALES del IDE, indexadas para los alcorques
  if (IDE) for (const a of IDE.aceras) {
    const r = a.r[0], c = centroid(r), mat = nearPlaza(c) ? 'losa_plaza' : inCasco(c) ? 'baldosa_roja' : 'acera';
    polySurface(W[mat], a.r, q => ground(q) + KERB, white);
    for (const h of a.r) { ringWalls(ss, h, q => ground(q) - .2, q => ground(q) + KERB, kerbC); const d = densify(h.concat([h[0]]), 2); for (let i = 1; i < d.length; i++) walk.add(d[i - 1], d[i], .1); }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const q of r) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    for (let gx = Math.floor(x0 / AG); gx <= Math.floor(x1 / AG); gx++) for (let gz = Math.floor(z0 / AG); gz <= Math.floor(z1 / AG); gz++) { const k = gx + ',' + gz; (aceraGrid.get(k) || aceraGrid.set(k, []).get(k)).push(a.r); }
    stats.aceras_ide++;
  }
  const onAcera = (x, z) => (aceraGrid.get(Math.floor(x / AG) + ',' + Math.floor(z / AG)) || []).some(rs => pip(x, z, rs[0]) && !rs.slice(1).some(h => pip(x, z, h)));
  if (!IDE) for (const r of zone.roads) {   // sin IDE: aceras de OSM y ESTIMADAS (como v0.7)
    const off = r.w / 2 + WALK_W / 2;
    if (r.sw == 'both' || r.sw == 'right') addWalk(offsetLine(r.p, off), WALK_W);
    if (r.sw == 'both' || r.sw == 'left') addWalk(offsetLine(r.p, -off), WALK_W);
    if (r.fw == 'sidewalk') addWalk(r.p, WALK_W);
  }
  if (!IDE) for (const w of zone.walks || []) addWalk(w.p, w.w); // aceras ESTIMADAS (tools/aceras_estimadas.py)
  for (const [name, b] of Object.entries(W)) if (b.p.length) group.add(toMesh(b, texturedMaterial(name, { normal: .8, side: THREE.DoubleSide })));
  if (ss.p.length) group.add(toMesh(ss, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  // --- Escaleras: peldaños + barandilla de acero inoxidable (fotos 1/) ---
  const treads = [], posts = [], rail = buffer(), steel = new THREE.Color('#c7ccd0');
  for (const r of zone.roads) if (r.t == 'steps') {
    if (IDE) { const m = r.p[Math.floor(r.p.length / 2)]; if (ideStairs.near(m[0], m[1])) continue; }   // ya está en el IDE
    const p = densify(r.p, .32); stats.escaleras++;
    for (let i = 1; i < p.length; i++) { treads.push([p[i - 1], p[i], r.w]); stairs.add(p[i - 1], p[i], r.w / 2 + .5); }
    for (const sgn of [-1, 1]) {
      const line = offsetLine(densify(r.p, 1.2), sgn * (Math.max(r.w, 1.2) / 2 + .03));
      line.forEach(q => posts.push(q));
      prism(rail, rail, line, .05, ground, .95, steel, steel, .9);
    }
  }
  const o = new THREE.Object3D(), place = (im, i, x, y, z, ry = 0, s = 1) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); };
  if (treads.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .16, 1), texturedMaterial('acera', { normal: .6 }), treads.length);
    treads.forEach(([a, b, w], i) => { o.position.set((a[0] + b[0]) / 2, zone.Hgt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) - .02, (a[1] + b[1]) / 2); o.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0); o.scale.set(Math.max(w, 1.2), 1, .34); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    group.add(im);
  }
  if (IDE) {   // v2: escaleras REALES en planta (IDE); peldaños y sentido de subida: ver stairSteps
    const st = buffer(), sd = buffer(), stone = new THREE.Color('#ffffff'), riser = new THREE.Color('#d9d6cf');
    for (const e of IDE.escaleras) { const n = stairSteps(st, sd, e.r[0], zone, hitBuilding, stone, riser); if (n) { stats.escaleras_ide++; stats.peldanos += n; } const r = e.r[0]; for (let k = 0; k < r.length; k++) stairs.add(r[k], r[(k + 1) % r.length], .5); }
    if (st.p.length) group.add(toMesh(st, texturedMaterial('acera', { vertexColors: true, normal: .6, side: THREE.DoubleSide })), toMesh(sd, texturedMaterial('estuco', { vertexColors: true, normal: .5, side: THREE.DoubleSide })));
  }
  if (posts.length) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .025, .95, 6).translate(0, .475, 0), new THREE.MeshLambertMaterial({ color: steel }), posts.length);
    posts.forEach((q, i) => place(im, i, q[0], zone.Hgt(q[0], q[1]), q[1]));
    group.add(im, toMesh(rail, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }

  // --- v2: porches y marquesinas REALES en planta (IDE). Altura, grosor y pilares: ESTIMADOS ---
  if (IDE && IDE.porches.length) {
    const pt = buffer(), ps = buffer(), pilares = [], cream = new THREE.Color('#eceae3');
    for (const pz of IDE.porches) {
      const r = pz.r[0], hs = r.map(q => ground(q)), porche = pz.t == 'porche';
      const top = Math.max(...hs) + (porche ? 2.7 : 2.6), th = porche ? .25 : .12;
      flat(pt, r, top, cream); flat(pt, r.slice().reverse(), top - th, cream);
      ringWalls(ps, r, () => top - th, () => top, cream, 5);
      if (porche) {   // pilares en las esquinas que no tocan un edificio
        const c = centroid(r);
        for (let i = 0; i < r.length; i++) {
          const a = r[(i + r.length - 1) % r.length], q = r[i], d = r[(i + 1) % r.length];
          const t1 = Math.atan2(q[1] - a[1], q[0] - a[0]), t2 = Math.atan2(d[1] - q[1], d[0] - q[0]), turn = Math.abs(Math.atan2(Math.sin(t2 - t1), Math.cos(t2 - t1)));
          if (turn < .35) continue;   // vértice casi alineado: no es esquina
          const dx = q[0] - c[0], dz = q[1] - c[1], l = Math.hypot(dx, dz) || 1;
          if (hitBuilding(q[0] + dx / l * .5, q[1] + dz / l * .5)) continue;
          const x = q[0] - dx / l * .2, z = q[1] - dz / l * .2, g = ground([x, z]);
          pilares.push([x, z, g, top - th - g]); block.add([x, z], [x + .01, z], .2, 'pilar');
        }
      }
      stats[porche ? 'porches' : 'marquesinas']++;
    }
    const em = texturedMaterial('estuco', { vertexColors: true, normal: .5, side: THREE.DoubleSide });
    group.add(toMesh(pt, em), toMesh(ps, em));
    if (pilares.length) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.28, 1, .28).translate(0, .5, 0), new THREE.MeshLambertMaterial({ color: '#eceae3' }), pilares.length);
      pilares.forEach(([x, z, g, h], i) => { o.position.set(x, g - .1, z); o.rotation.set(0, 0, 0); o.scale.set(1, Math.max(.5, h + .1), 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      group.add(im);
    }
  }

  // --- Fachadas cercanas (para farolas de brazo): índice de lados de edificio ---
  const facades = segIndex(10);
  for (const b of zone.buildings) for (let i = 1; i < b.p.length; i++) facades.add(b.p[i - 1], b.p[i], 6, 'fachada');
  const nearestFacade = (x, z) => {   // punto más cercano de una fachada a menos de 6 m, con su normal hacia la calle
    let best = null;
    for (const sg of facades.all(x, z)) {
      const ex = sg.b[0] - sg.a[0], ez = sg.b[1] - sg.a[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - sg.a[0]) * ex + (z - sg.a[1]) * ez) / L2));
      const px = sg.a[0] + t * ex, pz = sg.a[1] + t * ez, d = Math.hypot(x - px, z - pz);
      if (d < 6 && (!best || d < best.d)) best = { d, x: px, z: pz, nx: (x - px) / (d || 1), nz: (z - pz) / (d || 1) };
    }
    return best;
  };

  // --- Farolas (forma según fotos; posición PROCEDURAL cada ~25 m — OSM no tiene farolas mapeadas aquí) ---
  //   urbanizaciones: poste blanco con globo (26/) · casco: brazo en fachada (13/, 14/, 22/) · plaza: poste alto (17/, 18/)
  const lamps = { globo: [], farol: [], brazo: [], plaza: [] }, near = new Map(), LG = 12;
  const freeSpot = (x, z, dmin) => { const gx = Math.floor(x / LG), gz = Math.floor(z / LG);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of near.get((gx + i) + ',' + (gz + j)) || []) if (Math.hypot(q[0] - x, q[1] - z) < dmin) return false; return true; };
  const mark = (x, z) => { const k = Math.floor(x / LG) + ',' + Math.floor(z / LG); (near.get(k) || near.set(k, []).get(k)).push([x, z]); };
  zone.roads.forEach((r, ri) => {
    if (!ROADS.has(r.t) || r.t == 'service') return;
    const p = densify(r.p, 1); let acc = 8 + rnd(ri) * 10, side = ri % 2 ? 1 : -1;
    for (let i = 1; i < p.length; i++) {
      acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (acc < 25) continue;
      const dx = p[i][0] - p[i - 1][0], dz = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dz) || 1, off = r.w / 2 + .45;
      const x = p[i][0] - dz / l * off * side, z = p[i][1] + dx / l * off * side;
      if (!isUrban([x, z]) || !zone.inLand(x, z) || hitBuilding(x, z) || block.near(x, z, .3) || inPlaza(x, z) || !freeSpot(x, z, 14)) continue;
      if (inCasco([x, z])) {
        const f = nearestFacade(x, z);
        if (f) { lamps.brazo.push([f.x, f.z, Math.atan2(f.nx, f.nz)]); mark(x, z); acc = 0; side = -side; continue; }
        lamps.farol.push([x, z]);
      } else lamps.globo.push([x, z]);
      mark(x, z); block.add([x, z], [x + .01, z], .15, 'farola'); acc = 0; side = -side;
    }
  });
  if (main) {   // perímetro de la Explanada: postes altos cada ~22 m
    const r = ring(main.p); let acc = 0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      for (let t = 11 - acc; t < L; t += 22) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[1] + (c[1] - a[1]) * t / L; const q = [x + (pc[0] - x) * .04, z + (pc[1] - z) * .04]; lamps.plaza.push(q); block.add(q, [q[0] + .01, q[1]], .15, 'farola'); }
      acc = (acc + L) % 22;
    }
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: '#f4efe0', emissive: '#3a3628' }), grey = new THREE.MeshLambertMaterial({ color: '#8c9196' }), whiteM = new THREE.MeshLambertMaterial({ color: '#e8e8e4' }), dark = new THREE.MeshLambertMaterial({ color: '#3a3d40' });
  const inst = (geo, mat, list, f) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((q, i) => f(im, i, q)); group.add(im); };
  const onGround = (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + KERB, q[1]);
  inst(new THREE.CylinderGeometry(.045, .06, 3.6, 8).translate(0, 1.8, 0), whiteM, lamps.globo, onGround);                       // globo
  inst(new THREE.SphereGeometry(.24, 14, 10).translate(0, 3.8, 0), lampMat, lamps.globo, onGround);
  inst(mergeGeos([new THREE.CylinderGeometry(.05, .07, 4, 8).translate(0, 2, 0), new THREE.ConeGeometry(.26, .22, 8).translate(0, 4.55, 0)]), grey, lamps.farol, onGround);   // farol
  inst(new THREE.CylinderGeometry(.2, .12, .45, 8).translate(0, 4.22, 0), lampMat, lamps.farol, onGround);
  const arm = mergeGeos([new THREE.BoxGeometry(.12, .2, .06).translate(0, 4.6, .03), new THREE.CylinderGeometry(.025, .025, .9, 6).rotateX(Math.PI / 2).translate(0, 4.7, .5)]);
  inst(arm, dark, lamps.brazo, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]), q[1], q[2]));                            // brazo de fachada
  inst(new THREE.BoxGeometry(.22, .1, .5).translate(0, 4.66, 1.0), lampMat, lamps.brazo, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]), q[1], q[2]));
  inst(new THREE.CylinderGeometry(.06, .09, 7.5, 8).translate(0, 3.75, 0), grey, lamps.plaza, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + .1, q[1]));   // plaza
  inst(new THREE.BoxGeometry(.35, .12, .35).translate(0, 7.55, 0), lampMat, lamps.plaza, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + .1, q[1]));
  stats.farolas = lamps.globo.length + lamps.farol.length + lamps.brazo.length + lamps.plaza.length;
  // De noche: bombillas encendidas (emisivas) y un halo de luz alrededor de cada una (modo día/noche)
  { const P = [], H = (x, z) => zone.Hgt(x, z);
    for (const q of lamps.globo) P.push(q[0], H(q[0], q[1]) + KERB + 3.8, q[1]);
    for (const q of lamps.farol) P.push(q[0], H(q[0], q[1]) + KERB + 4.2, q[1]);
    for (const q of lamps.brazo) P.push(q[0] + Math.sin(q[2]), H(q[0], q[1]) + 4.6, q[1] + Math.cos(q[2]));
    for (const q of lamps.plaza) P.push(q[0], H(q[0], q[1]) + 7.6, q[1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const glow = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uNight, uScale: { value: innerHeight / (2 * Math.tan(30 * Math.PI / 180)) } },
      vertexShader: 'uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(5.5 * uScale / -mv.z, 2., 160.); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNight; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(vec3(1., .72, .42) * (exp(-d * d * 7.) * .55 + exp(-d * d * 60.)) * uNight, 1.); }',
    }));
    glow.frustumCulled = false; group.add(glow);
    dayNight.on(n => { glow.visible = n > .02; lampMat.emissive.set('#3a3628').lerp(new THREE.Color('#ffd9a0'), n); });
  }

  // --- Árboles de alcorque en las aceras del casco (fotos 15/–24/) y arbolado de la Explanada (17/, 18/): ESTIMADO ---
  // Plátano de sombra cerca de la Explanada; naranjo / ficus de copa redonda en el resto del casco.
  const trees = { platano: [], redondo: [] }, pits = [];
  if (IDE) for (const [x, z] of IDE.arboles) {   // v2: posición REAL (IDE); especie y tamaño ESTIMADOS
    (nearPlaza([x, z]) ? trees.platano : trees.redondo).push([x, z]); mark(x, z); block.add([x, z], [x + .01, z], .2, 'arbol');
    if (onAcera(x, z)) pits.push([x, z]);
    stats.arboles_ide++;
  }
  if (!IDE) walksList.forEach((w, wi) => {
    if (w.mat == 'acera' || w.w < 1.5 || rnd(wi + 77) < .45) return;
    let acc = 4;
    for (let i = 1; i < w.p.length; i++) {
      acc += Math.hypot(w.p[i][0] - w.p[i - 1][0], w.p[i][1] - w.p[i - 1][1]);
      if (acc < 9) continue;
      const [x, z] = w.p[i];
      if (hitBuilding(x, z) || !freeSpot(x, z, 4)) continue;
      (nearPlaza([x, z]) ? trees.platano : trees.redondo).push([x, z]); pits.push([x, z]); mark(x, z); block.add([x, z], [x + .01, z], .2, 'arbol'); acc = 0;
    }
  });
  const benches = [];
  if (main) {   // filas de árboles jóvenes y bancos dentro de la Explanada
    const r = ring(main.p), xs = r.map(q => q[0]), zs = r.map(q => q[1]);
    for (let x = Math.min(...xs) + 6; x < Math.max(...xs) - 4; x += 9) for (let z = Math.min(...zs) + 6; z < Math.max(...zs) - 4; z += 14) {
      const jx = x + (rnd(x * 7 + z) - .5) * 2, jz = z + (rnd(x + z * 3) - .5) * 2;
      if (!pip(jx, jz, r) || hitBuilding(jx, jz)) continue;
      if (rnd(jx * 3.1 + jz) < .75) { if (IDE) continue; trees.platano.push([jx, jz]); pits.push([jx, jz]); block.add([jx, jz], [jx + .01, jz], .2, 'arbol'); }
      else if (pip(jx + 2, jz, r)) { benches.push([jx + 2, jz, 0]); block.add([jx + 1.2, jz], [jx + 2.8, jz], .35, 'banco'); }
    }
  }
  const trunk = new THREE.MeshLambertMaterial({ color: '#b4a58e' }), leaf = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const treeAt = (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + .1, q[1], rnd(q[0] + q[1]) * 6, .8 + rnd(q[0] * 3) * .4);
  inst(new THREE.CylinderGeometry(.12, .18, 4.2, 6).translate(0, 2.1, 0), trunk, trees.platano, treeAt);
  inst(mergeGeos([new THREE.IcosahedronGeometry(2.6, 1).scale(1, .75, 1).translate(0, 5.6, 0), new THREE.IcosahedronGeometry(1.8, 1).translate(1.3, 4.9, .6)]), leaf, trees.platano, (im, i, q) => { treeAt(im, i, q); im.setColorAt(i, new THREE.Color('#5d7f3c').multiplyScalar(.85 + rnd(i) * .3)); });
  inst(new THREE.CylinderGeometry(.08, .12, 2, 6).translate(0, 1, 0), new THREE.MeshLambertMaterial({ color: '#7a6a58' }), trees.redondo, treeAt);
  inst(new THREE.IcosahedronGeometry(1.25, 1).translate(0, 2.7, 0), leaf, trees.redondo, (im, i, q) => { treeAt(im, i, q); im.setColorAt(i, new THREE.Color('#3f6b32').multiplyScalar(.85 + rnd(i * 5) * .3)); });
  inst(new THREE.BoxGeometry(1, .04, 1).translate(0, .02, 0), new THREE.MeshLambertMaterial({ color: '#5a4a3a' }), pits, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + KERB + .01, q[1]));   // alcorque
  // Bancos: listones de madera y patas de metal oscuro (fotos 15/, 17/).
  inst(mergeGeos([new THREE.BoxGeometry(1.8, .06, .45).translate(0, .45, 0), new THREE.BoxGeometry(1.8, .4, .05).translate(0, .7, -.22)]), new THREE.MeshLambertMaterial({ color: '#7a5636' }), benches, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + .1, q[1], q[2]));
  inst(mergeGeos([new THREE.BoxGeometry(.06, .45, .45).translate(-.8, .22, 0), new THREE.BoxGeometry(.06, .45, .45).translate(.8, .22, 0)]), dark, benches, (im, i, q) => place(im, i, q[0], zone.Hgt(q[0], q[1]) + .1, q[1], q[2]));
  stats.arboles_calle = trees.platano.length + trees.redondo.length; stats.bancos = benches.length;

  console.info('Detalle de calle:', stats);
  return {
    group,
    blocked: (x, z) => !!block.near(x, z, .35),          // muros, vallas, farolas, árboles y bancos no se atraviesan
    extra: (x, z) => (walk.near(x, z) ? KERB : inPlaza(x, z) ? .1 : 0),   // subir a la acera o a la plaza
    steep: (x, z) => !!stairs.near(x, z),                // en escaleras se permite más pendiente
  };
}
