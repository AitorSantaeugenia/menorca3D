import * as THREE from 'three';
import { buffer, tri, toMesh } from '../core/geometry.js';
import { texturedMaterial } from '../core/textures.js';
// v2 · Sa Farmàcia – Teresa Hernández Jansà (Carrer Gran 32-J), en la esquina oeste del edificio nº 642
// (ref. 0453901FE1105S). REAL: la esquina y las dos fachadas (huella del Catastro) y la posición (OpenStreetMap).
// ESTIMADO a partir de las fotos de referencia: escaparates con marco blanco y zócalo morado, pilares color melocotón,
// zócalo de ladrillo, rótulo morado «Farmàcia» en las dos fachadas (la de 14 m con la placa del nombre), cruz verde
// luminosa en la esquina y plaza de aparcamiento pintada (blanca con borde y cruz verdes) delante de la fachada larga.
// El rótulo largo va en la fachada noroeste (la foto con la esquina a la derecha) y el corto en la suroeste.
export const PHARMACY_REF = '0453901FE1105S';
// Fachadas: contorno de OSM del mismo edificio, que queda ~0,8 m por fuera del Catastro y es la pared que se ve
const CORNER = [-161.5, -326.7], TO_N = [-152.9, -339.4], TO_SE = [-117.2, -295.7], INSIDE = [-135, -317];
const LONG = 14.0, SHORT = 7.0;   // largos de los rótulos (pipeline/textura_rotulos.py)

export function pharmacyFront(Hgt) {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const purple = M('#682a68'), panel = M('#5b2763'), glass = M('#5d7685'), glassD = M('#4a5d69'), white = M('#f4f3f0'),
    pillar = M('#e2ad8d'), brick = M('#b0695b'), cross = M('#25c45a', { emissive: '#139a42' });
  const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const sign = { long: texturedMaterial('rotulo_farmacia', { side: THREE.DoubleSide }), short: texturedMaterial('rotulo_farmacia2', { side: THREE.DoubleSide }) };

  // Una fachada: A = extremo izquierdo visto desde la calle, U = hacia la derecha, N = hacia fuera
  function front(A, U, L, bays) {
    let N = [-U[1], U[0]]; const mid = [A[0] + U[0] * L / 2, A[1] + U[1] * L / 2];
    if ((mid[0] + N[0] - INSIDE[0]) ** 2 + (mid[1] + N[1] - INSIDE[1]) ** 2 < (mid[0] - INSIDE[0]) ** 2 + (mid[1] - INSIDE[1]) ** 2) N = [-N[0], -N[1]];
    const y0 = Hgt(mid[0], mid[1]) + .02;
    const W = (u, n) => [A[0] + U[0] * u + N[0] * n, A[1] + U[1] * u + N[1] * n];
    // caja: de u0 a u1 a lo largo, de y0+ya a y0+yb de alto, de n0 a n1 hacia fuera
    const box = (u0, u1, ya, yb, n0, n1, m) => { const c = W((u0 + u1) / 2, (n0 + n1) / 2), o = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, yb - ya, n1 - n0), m);
      o.position.set(c[0], y0 + (ya + yb) / 2, c[1]); o.rotation.y = Math.atan2(-U[1], U[0]); g.add(o); return o; };
    box(0, L, -.4, .3, 0, .14, brick);                                     // zócalo de ladrillo
    for (const [u0, u1, t] of bays) {
      if (t == 'p') { box(u0, u1, .3, 2.47, 0, .14, pillar); continue; }
      box(u0, u1, .3, 2.45, .02, .06, t == 'd' ? glassD : glass);           // vidrio
      const f = .07;                                                       // marco blanco
      box(u0, u1, 2.45 - f, 2.45, .02, .1, white); box(u0, u1, .3, .3 + f, .02, .1, white);
      box(u0, u0 + f, .3, 2.45, .02, .1, white); box(u1 - f, u1, .3, 2.45, .02, .1, white);
      if (t == 'w') box(u0 + f, u1 - f, .3 + f, .64, .06, .09, panel);       // zócalo morado del escaparate
      else { box((u0 + u1) / 2 - .02, (u0 + u1) / 2 + .02, .3, 2.45, .02, .1, white); box(u0 + .3, u1 - .3, 1.0, 1.04, .1, .13, white); }   // puerta de dos hojas
    }
    box(0, L, 2.45, 3.05, 0, .28, purple);                                  // rótulo (volumen)
    return { W, y0, N };
  }
  // Cara del rótulo con la textura (UV 0–1: arriba v = 0)
  const tb = { long: buffer(), short: buffer() }, k = new THREE.Color('#ffffff');
  const face = (b, W, y0, L) => { const p = (u, y) => { const q = W(u, .285); return [q[0], y0 + y, q[1]]; };
    tri(b, p(0, 2.45), p(L, 2.45), p(L, 3.05), k, [0, 1, 1, 1, 1, 0]); tri(b, p(0, 2.45), p(L, 3.05), p(0, 3.05), k, [0, 1, 1, 0, 0, 0]); };

  // Fachada noroeste (14 m, esquina a la derecha): 5 escaparates y la puerta junto a la esquina
  const Un = unit(TO_N, CORNER), An = [CORNER[0] - Un[0] * LONG, CORNER[1] - Un[1] * LONG];
  const P = .45, nw = [[0, P, 'p']];
  for (let i = 0; i < 5; i++) { const a = P + i * 2.3; nw.push([a, a + 1.85, 'w'], [a + 1.85, a + 2.3, 'p']); }
  nw.push([11.95, 13.55, 'd'], [13.55, 14, 'p']);
  const F1 = front(An, Un, LONG, nw);
  face(tb.long, F1.W, F1.y0, LONG);
  // Fachada suroeste (7 m, esquina a la izquierda): puerta y dos escaparates
  const Us = unit(CORNER, TO_SE);
  const F2 = front(CORNER, Us, SHORT, [[0, P, 'p'], [P, 2.3, 'd'], [2.3, 2.75, 'p'], [2.75, 4.9, 'w'], [4.9, 5.35, 'p'], [5.35, 6.55, 'w'], [6.55, 7, 'p']]);
  face(tb.short, F2.W, F2.y0, SHORT);
  g.add(toMesh(tb.long, sign.long), toMesh(tb.short, sign.short));

  // Cruz verde luminosa en banderola, en la fachada noroeste junto a la esquina
  const cpos = F1.W(13.0, .75), crot = Math.atan2(-Un[1], Un[0]);   // placa perpendicular a la fachada
  for (const [w, h] of [[.8, .26], [.26, .8]]) { const o = new THREE.Mesh(new THREE.BoxGeometry(.12, h, w), cross); o.position.set(cpos[0], F1.y0 + 3.55, cpos[1]); o.rotation.y = crot; g.add(o); }
  g.userData.luces = { farmacia: { x: cpos[0], y: F1.y0 + 3.55, z: cpos[1], suelo: F1.y0 } };   // halo verde de noche (visor)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .5), white); { const q = F1.W(13.0, .3); arm.position.set(q[0], F1.y0 + 3.55, q[1]); arm.rotation.y = crot; g.add(arm); }

  // Plaza de aparcamiento pintada delante de la fachada noroeste (foto 1): blanca, borde verde y cruz verde
  const pb = buffer(), cW = new THREE.Color('#f2f2ee'), cG = new THREE.Color('#2fa84f');
  const pq = (u0, u1, n0, n1, c, dy) => { const p = (u, n) => { const q = F1.W(u, n); return [q[0], Hgt(q[0], q[1]) + dy, q[1]]; };
    tri(pb, p(u0, n0), p(u1, n0), p(u1, n1), c); tri(pb, p(u0, n0), p(u1, n1), p(u0, n1), c); };
  const u0 = 2.6, u1 = 12.4, n0 = 2.7, n1 = 5.0, bw = .14, um = (u0 + u1) / 2, nm = (n0 + n1) / 2;
  pq(u0, u1, n0, n1, cW, .09);
  pq(u0, u1, n0, n0 + bw, cG, .1); pq(u0, u1, n1 - bw, n1, cG, .1); pq(u0, u0 + bw, n0, n1, cG, .1); pq(u1 - bw, u1, n0, n1, cG, .1);
  pq(um - .9, um + .9, nm - .22, nm + .22, cG, .1); pq(um - .3, um + .3, nm - .7, nm + .7, cG, .1);
  g.add(toMesh(pb));
  return g;
}
