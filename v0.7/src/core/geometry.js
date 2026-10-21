import * as THREE from 'three';
// Acumulador de triángulos con color y UV por vértice → una sola malla (pocas draw calls).
// UV en METROS reales (u, v), listas para texturas que se repitan a escala correcta.
export const buffer = () => ({ p: [], c: [], uv: [], wall: [], fac: [] });
const NOFAC = [0, 0, 0, 0], NOWALL = new Array(12).fill(0);
// fac (opcional): datos de fachada [anchoVano, alturaMuro, estilo, semilla] + wall: por vértice (vano, altura, largo del lado, nº de vanos)
export function tri(b, a, d, e, k, uv, fac, wall) {
  b.p.push(...a, ...d, ...e); for (let i = 0; i < 3; i++) { b.c.push(k.r, k.g, k.b); b.fac.push(...(fac || NOFAC)); }
  b.uv.push(...(uv || [a[0], a[2], d[0], d[2], e[0], e[2]])); // por defecto: proyección en planta
  b.wall.push(...(wall || NOWALL));
}
// Polígono horizontal a la altura y, con huecos opcionales (patios).
export function flat(b, r, y, k, holes = []) {
  const v = q => new THREE.Vector2(q[0], q[1]), all = r.concat(...holes);
  for (const t of THREE.ShapeUtils.triangulateShape(r.map(v), holes.map(h => h.map(v))))
    tri(b, [all[t[0]][0], y, all[t[0]][1]], [all[t[1]][0], y, all[t[1]][1]], [all[t[2]][0], y, all[t[2]][1]], k);
}
export function toMesh(b, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(b.wall, 4));
  g.setAttribute('aFac', new THREE.Float32BufferAttribute(b.fac, 4));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material || new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}
// Une varias geometrías (convertidas a no indexadas) en una sola: posición y normal.
export function mergeGeos(list) {
  const parts = list.map(g => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
