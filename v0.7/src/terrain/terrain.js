import * as THREE from 'three';
// Terreno REAL (MDT IGN remuestreado) con textura de suelo generada desde OSM. Futuro: tiles con LOD.
export function createTerrain(zone, groundUrl, renderer) {
  const T = zone.terrain, w = (T.cols - 1) * T.step, d = (T.rows - 1) * T.step;
  const g = new THREE.PlaneGeometry(w, d, T.cols - 1, T.rows - 1).rotateX(-Math.PI / 2);
  g.translate(T.x0 + w / 2, 0, T.z0 + d / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, zone.HH[i] / 10);
  g.computeVertexNormals();
  const tex = new THREE.TextureLoader().load(groundUrl); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, color: '#bcb592' })); // tono de tierra/hierba seca (ESTIMADO) sobre los colores de mapa
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4fa9c8, transparent: true, opacity: .92 }));
  const group = new THREE.Group(); group.add(sea, ground); return group;
}
