import * as THREE from 'three';
import { ring, pip, bbox } from '../core/geo.js';
import { mergeGeos } from '../core/geometry.js';
// Vegetación PROCEDURAL colocada solo dentro de zonas REALES de OSM (bosque, matorral, parque, jardín), con instancing.
// Especies elegidas por la flora de Menorca y por lo que se ve en las fotos propias de Santa Anna / Sol del Este:
// pino carrasco, acebuche/olivo, ciprés, palmera canaria y matorral (lentisco). La especie de cada árbol es PROCEDURAL.
function speciesGeos() {
  const fronds = [];
  for (let k = 0; k < 14; k++) {             // palmera canaria: hojas arqueadas alrededor del penacho
    const g = new THREE.BoxGeometry(2.8, .04, .42).translate(1.4, 0, 0);
    g.rotateZ(-(.25 + (k % 3) * .18)); g.rotateY(k / 14 * Math.PI * 2 + (k % 2) * .2); g.translate(0, 5.6, 0);
    fronds.push(g);
  }
  return {
    pino: { trunk: new THREE.CylinderGeometry(.14, .26, 6.2, 6).translate(0, 3.1, 0).rotateZ(.06), crown: mergeGeos([
      new THREE.IcosahedronGeometry(1, 1).scale(3.2, 1.3, 3).translate(.3, 6.6, 0), new THREE.IcosahedronGeometry(1, 1).scale(2.2, 1, 2.2).translate(-1, 6.1, .6)]), color: '#41602f', trunkColor: '#6e5643' },
    acebuche: { trunk: new THREE.CylinderGeometry(.12, .2, 1.9, 6).translate(0, .95, 0), crown: new THREE.IcosahedronGeometry(1.8, 1).scale(1, .8, 1).translate(0, 2.9, 0), color: '#6c7f52', trunkColor: '#6b5a4a' },
    cipres: { trunk: new THREE.CylinderGeometry(.1, .14, .8, 5).translate(0, .4, 0), crown: new THREE.ConeGeometry(.75, 7.5, 8).translate(0, 4.4, 0), color: '#2f4a2a', trunkColor: '#5d4a3a' },
    palmera: { trunk: new THREE.CylinderGeometry(.34, .42, 5.6, 8).translate(0, 2.8, 0), crown: mergeGeos(fronds), color: '#5c7d36', trunkColor: '#8a7258' },
    arbusto: { trunk: null, crown: new THREE.IcosahedronGeometry(1, 1).scale(1.3, .75, 1.2).translate(0, .55, 0), color: '#56693a' },
  };
}
const MIX = {   // proporciones por tipo de zona de OSM
  wood: [['pino', .65], ['acebuche', .3], ['arbusto', .05]], forest: [['pino', .7], ['acebuche', .3]],
  scrub: [['arbusto', .7], ['acebuche', .2], ['pino', .1]], heath: [['arbusto', .8], ['acebuche', .2]],
  park: [['palmera', .25], ['pino', .25], ['acebuche', .3], ['cipres', .2]],
  garden: [['acebuche', .35], ['palmera', .25], ['cipres', .2], ['arbusto', .2]],
};
const DENSITY = { wood: 250, forest: 250, scrub: 140, heath: 160, park: 260, garden: 450 };   // m² por planta
export function createVegetation(zone, hit) {
  let sd = 7; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const G = speciesGeos(), spots = Object.fromEntries(Object.keys(G).map(k => [k, []]));
  let total = 0;
  for (const a of zone.areas) if (MIX[a.k]) {
    const r = ring(a.p), [x0, x1, z0, z1] = bbox(r), n = Math.min(160, Math.floor((x1 - x0) * (z1 - z0) / DENSITY[a.k]));
    let got = 0;
    for (let t = 0; t < n * 4 && got < n && total < 2600; t++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!pip(x, z, r) || hit(x, z)) continue;
      let u = rnd(), sp = MIX[a.k][0][0];
      for (const [name, p] of MIX[a.k]) { if ((u -= p) < 0) { sp = name; break; } }
      spots[sp].push([x, z]); got++; total++;
    }
  }
  const group = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (const [name, list] of Object.entries(spots)) {
    if (!list.length) continue;
    const S = G[name], crown = new THREE.InstancedMesh(S.crown, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: name != 'palmera' }), list.length);
    const trunk = S.trunk && new THREE.InstancedMesh(S.trunk, new THREE.MeshLambertMaterial({ color: S.trunkColor }), list.length);
    list.forEach(([x, z], i) => {
      const k = .75 + rnd() * .55;
      q.setFromEuler(e.set(0, rnd() * Math.PI * 2, 0));
      m.compose(new THREE.Vector3(x, zone.Hgt(x, z) - .15, z), q, new THREE.Vector3(k, k * (.9 + rnd() * .25), k));
      crown.setMatrixAt(i, m); crown.setColorAt(i, c.set(S.color).multiplyScalar(.85 + rnd() * .3));
      if (trunk) trunk.setMatrixAt(i, m);
    });
    group.add(crown); if (trunk) group.add(trunk);
  }
  console.info('Vegetación:', Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v.length])));
  return group;
}
