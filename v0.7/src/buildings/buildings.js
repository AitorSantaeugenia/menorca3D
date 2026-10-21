import * as THREE from 'three';
import { ring, pip, bbox } from '../core/geo.js';
import { buffer, tri, flat, toMesh } from '../core/geometry.js';
import { roofType, hippedRoof, area, obb } from './roofs.js';
import { createFacadeMaterial } from './facadeMaterial.js';
import { churchOfRoser, busShelter, CHURCH_REF, CHURCH_TOP } from './church.js';
import { windmill, MILL_REF } from './molino.js';
import { footballPitch, SPORTS_REF } from './campoFutbol.js';
import { pharmacyFront, PHARMACY_REF } from './farmacia.js';
import { fontanilles, FONTANILLES_REFS } from './fontanilles.js';
import { casa1061, REF_1061 } from './casa1061.js';
import { texturedMaterial } from '../core/textures.js';
// Volúmenes REALES del Catastro (una pieza por parte, con patios) o huellas OSM. Plantas REALES, 3 m/planta ESTIMADO.
// Tejados PROCEDURALES salvo roof:shape. Las colisiones usan la huella exterior de cada pieza.
// Tres mallas compartidas: fachadas (estuco + huecos), tejados de teja y terrazas → pocas draw calls.

// Paletas MEDIDAS en las fotos propias (docs/REFERENCIAS_VISUALES.md), con su peso aproximado.
// Casco de Es Castell: blanco dominante, ocre, crema, coral, melocotón, magenta y granate.
const CASCO = [['#ece9e2', 40], ['#c9b07f', 14], ['#e3d5b5', 12], ['#cdbfa5', 7], ['#d39a82', 8], ['#e2b394', 6], ['#8f5a6e', 5], ['#7a2233', 4]];
// Urbanizaciones (Santa Anna / Sol del Este).
const RESID = [['#e9ebe8', 62], ['#ece6d8', 12], ['#c9ae90', 10], ['#b9a091', 8], ['#9aa59e', 4], ['#e8dcc0', 4]];
const RED_CUARTEL = '#82233f', RED_AYTO = '#912033';
const TILE_TINT = ['#ffffff', '#f2e6e0', '#e6ddd6'], G = 32, PARAPET = .7, PITCH = .51;
const pickW = (pal, r) => { let t = pal.reduce((s, p) => s + p[1], 0) * r; for (const [c, w] of pal) { if ((t -= w) < 0) return c; } return pal[0][0]; };
const rnd = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

// ajustes: { [ref catastral]: { fachada: '#rrggbb', tejado: 'teja' } } (ajustes_edificios.json, ajustes manuales)
export function createBuildings(zone, ajustes = {}) {
  const fb = buffer(), rb = buffer(), tb = buffer(), polys = [], grid = new Map(), stats = { hipped: 0, flat: 0 };
  // Paredes compartidas entre piezas (medianeras, cuerpos de distinta altura): en cada arista común solo se dibuja
  // lo que asoma por encima de la pieza vecina. Así se evitan dos paredes en el mismo plano (parpadeo / z-fighting).
  const ek = (a, c) => { const A = Math.round(a[0] * 10) + ',' + Math.round(a[1] * 10), C = Math.round(c[0] * 10) + ',' + Math.round(c[1] * 10); return A < C ? A + '|' + C : C + '|' + A; };
  // Lado de la arista (en su sentido canónico) en el que queda la pieza: medianera = lados opuestos; solape = mismo lado.
  const sideOf = (a, c, cen) => { const A = Math.round(a[0] * 10) + ',' + Math.round(a[1] * 10), C = Math.round(c[0] * 10) + ',' + Math.round(c[1] * 10), [p, q] = A < C ? [a, c] : [c, a];
    return Math.sign((q[0] - p[0]) * (cen[1] - p[1]) - (q[1] - p[1]) * (cen[0] - p[0])); };
  const shared = new Map(), tops = [];
  // Altura que tapa mi pared en esa arista: medianera → la pieza vecina más alta tapa desde abajo;
  // solape (mismo lado) → solo la tapa por completo una pieza más alta. Empate: dibuja la de índice menor.
  const ownerTop = (key, me, side, y0) => { let t = -1e9;
    for (const [i, y, sd] of shared.get(key) || []) {
      if (i == me || (Math.abs(y - tops[me]) < .01 && i > me)) continue;
      t = Math.max(t, sd == side ? (y >= tops[me] - .01 ? y : -1e9) : y);
    }
    return t; };
  // Muros: UV en metros + coordenadas de vano por lado (cada lado se divide en vanos de ~3,2 m para los huecos).
  const walls = (r, y0, y1, k, style = 0, seed = 0, openings = true, me = -1, cen = null) => { let u = 0;
    for (let j = 0; j < r.length; j++) { const a = r[j], c = r[(j + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), H = y1 - y0;
      let lo = y0;
      if (me >= 0) { const ot = ownerTop(ek(a, c), me, sideOf(a, c, cen), y0); if (ot >= y1 - .05) { u += L; continue; } if (ot > y0) lo = ot; }
      const v0 = lo - y0, n = Math.max(1, Math.round(L / 3.2)), fac = openings && L >= 1.6 ? [L / n, H, style, seed * 16 + (j % 16)] : null;
      tri(fb, [a[0], lo, a[1]], [c[0], lo, c[1]], [c[0], y1, c[1]], k, [u, v0, u + L, v0, u + L, H], fac, [0, v0, L, n, n, v0, L, n, n, H, L, n]);
      tri(fb, [a[0], lo, a[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], k, [u, v0, u + L, H, u, H], fac, [0, v0, L, n, n, H, L, n, 0, H, L, n]); u += L; } };
  // Teja: UV en metros a lo largo del alero (u) y siguiendo la pendiente (v), para que las hiladas bajen por el faldón.
  const roofTri = (t, k) => {
    const [a, b, c] = t, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    if (ny < 0) { nx = -nx; nz = -nz; }
    const l = Math.hypot(nx, nz) || 1, dx = nx / l, dz = nz / l, cs = Math.cos(Math.atan(PITCH));
    const uv = p => [p[0] * -dz + p[2] * dx, -(p[0] * dx + p[2] * dz) / cs];
    tri(rb, a, b, c, k, [...uv(a), ...uv(b), ...uv(c)]);
  };
  // Ayuntamiento (REAL: posición OSM amenity=townhall) y cuarteles de la Explanada (REAL: contornos con nombre en OSM).
  // Rojo, esquinas dentadas y recercados blancos, como en las fotos propias (17/, 18/).
  const th = zone.pois.find(p => p.k == 'ayuntamiento');
  const thRef = th && (zone.buildings.find(bd => pip(th.x, th.z, ring(bd.p))) || {}).ref;
  const cuarteles = (zone.landmarks || []).filter(l => l.k == 'cuartel').map(l => ring(l.p));
  // v2: puede haber varias zonas con estilo de casco (Es Castell y, en v2, Cales Fonts: zona con casco: true)
  const cascos = (zone.zones || []).filter(z => z.n == 'Es Castell' || z.casco);
  const inCasco = (x, z) => cascos.some(c => Math.hypot(x - c.x, z - c.z) < c.r);
  const pre = zone.buildings.map((bd, i) => {
    const r = ring(bd.p), hs = r.map(q => zone.Hgt(q[0], q[1]));
    const y0 = Math.min(...hs) - .3, y1 = Math.max(hs.reduce((s, v) => s + v, 0) / hs.length + bd.h, Math.max(...hs) + 2.5);
    const cen = [r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length];
    const key = bd.ref ? [...bd.ref].reduce((s, ch) => s * 31 + ch.charCodeAt(0) | 0, 7) : i, seed = Math.abs(key) % 997;
    const town = th && (bd.ref ? bd.ref == thRef : pip(th.x, th.z, r)), cuartel = !town && cuarteles.some(c => pip(cen[0], cen[1], c));
    // v2: iglesia del Roser (edificio nº 464): la pieza grande es la iglesia (js aparte, church.js); el resto, el convento
    // v2: molino (edificio nº 120): se construye aparte (molino.js), como la iglesia
    const church = (bd.ref == CHURCH_REF && area(r) > 500) || bd.ref == MILL_REF, convent = bd.ref == CHURCH_REF && !church;
    const old = inCasco(cen[0], cen[1]);
    const style = town ? 1 : cuartel ? 4 : old ? (rnd(seed + 9) < .04 ? 5 : 0) : (rnd(seed + 5) < .3 ? 3 : 2);
    // Cuarteles y Ayuntamiento: cubierta de teja a cuatro aguas (fotos 17/, 18/) si la huella es casi rectangular.
    const o = obb(r), aj = (bd.ref && ajustes[bd.ref]) || null;
    // v2: el Ayuntamiento tiene azotea con pretil blanco y remates (foto de referencia), no cubierta de teja
    const civicHip = cuartel && o && area(r) / o.A > .8, ajHip = aj && aj.tejado == 'teja' && o && area(r) > 6 && area(r) / o.A > .62;
    const flatRoof = town || (!civicHip && !ajHip && !convent && roofType(r, bd) != 'hipped'), tejaFlat = flatRoof && aj && aj.tejado == 'teja'; tops[i] = church ? Math.min(...hs) + (bd.ref == MILL_REF ? 12 : CHURCH_TOP) : y1 + (flatRoof && !tejaFlat ? PARAPET : 0);
    for (let j = 0; j < r.length; j++) { const a = r[j], c = r[(j + 1) % r.length], k = ek(a, c); (shared.get(k) || shared.set(k, []).get(k)).push([i, tops[i], sideOf(a, c, cen)]); }
    return { r, y0, y1, flatRoof, tejaFlat, cen, seed, style, town, aj, church, convent };
  });
  let towerAt = null; const pinnacleAt = [];
  zone.buildings.forEach((bd, i) => {
    const { r, y0, y1, flatRoof, tejaFlat, cen, seed, style, town, aj, church, convent } = pre[i], holes = (bd.holes || []).map(ring);
    const [x0, x1, z0, z1] = bbox(r);
    if (church) {   // la iglesia se construye aparte (church.js); aquí solo cuenta para colisiones
      polys.push(r);
      for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) { const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
      return;
    }
    const col = convent ? '#efede6' : aj && aj.fachada ? aj.fachada : style == 1 ? RED_AYTO : style == 4 ? RED_CUARTEL : bd.c || (style == 0 || style == 5 ? pickW(CASCO, rnd(seed)) : pickW(RESID, rnd(seed)));
    const w = new THREE.Color(col);
    stats[style == 0 || style == 5 ? 'casco' : style == 1 || style == 4 ? 'emblematicos' : 'residencial'] = (stats[style == 0 || style == 5 ? 'casco' : style == 1 || style == 4 ? 'emblematicos' : 'residencial'] || 0) + 1;
    walls(r, y0, y1, w, style, seed, true, i, cen); for (const h of holes) walls(h, y0 + .3, y1, w, style, seed);
    if (!flatRoof) { const k = new THREE.Color(TILE_TINT[seed % 3]); for (const t of hippedRoof(r, y1, style == 1 || style == 4 ? .5 : .35, PITCH)) roofTri(t, k); stats.hipped++; }
    else if (tejaFlat) { flat(rb, r, y1 - .02, new THREE.Color('#ffffff'), holes); stats.flat++; }   // ajuste manual: cubierta de teja (forma irregular: sin faldones)
    else { flat(tb, r, y1 - .02, new THREE.Color('#ffffff'), holes); walls(r, y1, y1 + PARAPET, town ? new THREE.Color('#ece9e2') : w, 0, 0, false, i, cen); stats.flat++;
      if (town) pinnacleAt.push({ r, y: y1 + PARAPET }); }
    if (town && (!towerAt || area(r) > towerAt.A)) towerAt = { r, y1, A: area(r) };
    polys.push(r);
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) { const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  });
  const hit = (x, z) => { const l = grid.get(Math.floor(x / G) + ',' + Math.floor(z / G)); return !!l && l.some(i => pip(x, z, polys[i])); };
  console.info('Edificios:', zone.buildings.length, stats);
  const group = new THREE.Group();
  group.add(toMesh(fb, createFacadeMaterial()));
  group.add(toMesh(rb, texturedMaterial('teja', { vertexColors: true, side: THREE.DoubleSide, normal: 1.2 })));
  group.add(toMesh(tb, texturedMaterial('terraza', { vertexColors: true, side: THREE.DoubleSide, normal: .5 })));
  // Torre del reloj del Ayuntamiento (fotos 18/frame_000002–04): posición y medidas ESTIMADAS — centrada en la fachada
  // que da a la Explanada, unos 3,6 m de lado y 7 m por encima del alero.
  const plaza = (zone.plazas || []).find(p => p.n && /esplanada/i.test(p.n));
  if (towerAt && plaza) group.add(clockTower(towerAt, plaza));
  if (zone.buildings.some(bd => bd.ref == CHURCH_REF)) group.add(churchOfRoser(zone.Hgt), busShelter(zone.Hgt));
  // v2: molino (nº 120) y campo de fútbol de la Zona Deportiva Sergio Llull (nº 116)
  if (zone.buildings.some(bd => bd.ref == MILL_REF)) group.add(windmill(zone.Hgt));
  if (zone.buildings.some(bd => bd.ref == SPORTS_REF)) { const fp = footballPitch(zone); if (fp) group.add(fp); }
  // v2: fachada de Sa Farmàcia (edificio nº 642)
  if (zone.buildings.some(bd => bd.ref == PHARMACY_REF)) group.add(pharmacyFront(zone.Hgt));
  // v2: Carrer Fontanilles (nº 35, 59 y 84) y la Farmàcia Alicia Quesada
  if (zone.buildings.some(bd => FONTANILLES_REFS.includes(bd.ref))) group.add(fontanilles(zone));
  // v2: casa del extremo de la fila del conjunto nº 1061, su jardín, el paso y las puertas del conjunto
  if (zone.buildings.some(bd => bd.ref == REF_1061)) group.add(casa1061(zone));
  // v2: remates blancos sobre el pretil del Ayuntamiento, cada ~3,2 m (según foto de referencia)
  if (pinnacleAt.length) {
    const wm = new THREE.MeshLambertMaterial({ color: '#ece9e2' }), pg = new THREE.Group();
    for (const { r, y } of pinnacleAt) for (let j = 0; j < r.length; j++) {
      const a = r[j], c = r[(j + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.round(L / 3.2));
      for (let k = 0; k < n; k++) {
        const t = k / n, m = new THREE.Mesh(new THREE.BoxGeometry(.32, .55, .32), wm);
        m.position.set(a[0] + (c[0] - a[0]) * t, y + .27, a[1] + (c[1] - a[1]) * t); pg.add(m);
        const b = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), wm); b.position.set(m.position.x, y + .66, m.position.z); pg.add(b);
      }
    }
    group.add(pg);
  }
  return { mesh: group, hit, inCasco, plaza, heights: pre.map(q => [q.y0, q.y1]) };
}

function clockTower({ r, y1 }, plaza) {
  const pc = ring(plaza.p).reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]).map(v => v / (plaza.p.length - 1));
  let best = null;   // lado del Ayuntamiento más cercano al centro de la plaza
  for (let j = 0; j < r.length; j++) {
    const a = r[j], c = r[(j + 1) % r.length], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], d = Math.hypot(m[0] - pc[0], m[1] - pc[1]), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L > 8 && (!best || d < best.d)) best = { a, c, m, d, L };
  }
  const g = new THREE.Group(); if (!best) return g;
  const ang = Math.atan2(best.c[1] - best.a[1], best.c[0] - best.a[0]);
  let nx = -(best.c[1] - best.a[1]) / best.L, nz = (best.c[0] - best.a[0]) / best.L;     // normal hacia la plaza
  if ((pc[0] - best.m[0]) * nx + (pc[1] - best.m[1]) * nz < 0) { nx = -nx; nz = -nz; }
  // v2: torre según la foto de referencia y el fotograma 18/: fuste rojo con esquinas blancas, cuerpo del
  // reloj, balaustrada blanca, linterna roja y veleta de hierro. Medidas ESTIMADAS (≈ 10 m sobre la azotea).
  const S = 3.6, cxT = best.m[0] - nx * (S / 2 - .2), czT = best.m[1] - nz * (S / 2 - .2), base = y1 - 1;
  const red = new THREE.MeshLambertMaterial({ color: RED_AYTO }), white = new THREE.MeshLambertMaterial({ color: '#ece9e2' }), iron = new THREE.MeshLambertMaterial({ color: '#1d1d1d' });
  const box = (w, h, d, y, m, x = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const quoins = (w, y0, h) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.42, h, .42, y0 + h / 2, white, sx * (w / 2 - .19), sz * (w / 2 - .19)); };
  box(S, 4.4, S, base + 2.2, red); quoins(S, base, 4.4);                          // fuste
  box(S + .35, .3, S + .35, base + 4.55, white);                                  // cornisa
  box(S - .3, 2.6, S - .3, base + 6.0, red); quoins(S - .3, base + 4.7, 2.6);     // cuerpo del reloj
  const face = new THREE.MeshLambertMaterial({ color: '#f7f4ea', emissive: '#2a2a22' }), hand = new THREE.MeshBasicMaterial({ color: '#1d1d1d' });
  for (let k = 0; k < 4; k++) {                                                   // esferas en los cuatro lados
    const a = k * Math.PI / 2, dx = Math.sin(a), dz = Math.cos(a), R = (S - .3) / 2 + .02;
    const f = new THREE.Mesh(new THREE.CircleGeometry(.7, 24), face); f.position.set(dx * R, base + 6.0, dz * R); f.rotation.y = a; g.add(f);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(.06, .55), hand); h.position.set(dx * (R + .01), base + 6.15, dz * (R + .01)); h.rotation.y = a; g.add(h);
  }
  box(S + .2, .25, S + .2, base + 7.42, white);                                   // cornisa superior
  const bt = base + 7.55;                                                         // balaustrada
  for (let q = -3; q <= 3; q++) { const t = q * S / 7;
    for (const [x, z] of [[t, S / 2], [t, -S / 2], [S / 2, t], [-S / 2, t]]) box(.12, .7, .12, bt + .35, white, x, z); }
  for (const [w, d, x, z] of [[S + .2, .14, 0, S / 2], [S + .2, .14, 0, -S / 2], [.14, S + .2, S / 2, 0], [.14, S + .2, -S / 2, 0]]) box(w, .12, d, bt + .76, white, x, z);
  box(S * .55, 1.7, S * .55, bt + .85, red); quoins(S * .55, bt, 1.7);           // linterna
  box(S * .65, .2, S * .65, bt + 1.8, white);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(S * .3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), iron); crown.position.y = bt + 1.9; g.add(crown);
  const vane = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 6), iron); vane.position.y = bt + 3.0; g.add(vane);
  box(.7, .06, .02, bt + 3.4, iron);
  g.position.set(cxT, 0, czT); g.rotation.y = -ang;
  return g;
}
