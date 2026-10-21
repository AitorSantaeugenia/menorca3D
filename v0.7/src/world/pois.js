import * as THREE from 'three';
// Puntos de interés REALES (OSM) con haz de luz y cartel. Futuro: comercios, turismo, eventos.
export const POI_COLORS = { explanada: 0xb455d6, farmacia: 0x2fb36b, supermercado: 0xf28c28, ayuntamiento: 0xc0392b };
export const hex = k => '#' + ('000000' + k.toString(16)).slice(-6);
export function createPOIs(zone, scene) {
  const nearRoad = (x, z) => { let b = null, bd = 1e12; for (const r of zone.roads) for (const q of r.p) { const d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; b = q; } } return b; };
  const list = zone.pois.map(p => {
    const col = POI_COLORS[p.k] || 0xffffff, y = zone.Hgt(p.x, p.z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 90, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(p.x, y + 45, p.z);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(16,52,63,.88)'; g.fillRect(0, 0, 512, 96); g.fillStyle = hex(col); g.fillRect(0, 0, 14, 96);
    g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'middle'; g.fillText(p.l.length > 26 ? p.l.slice(0, 25) + '…' : p.l, 28, 48);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.position.set(p.x, y + 70, p.z); sp.renderOrder = 9;
    scene.add(beam, sp);
    return { ...p, color: col, sprite: sp, beam, road: nearRoad(p.x, p.z) };
  });
  // De cerca (< 45 m) se ocultan el haz y el cartel para no tapar la vista del lugar.
  const update = cam => { for (const p of list) { const d = Math.hypot(cam.position.x - p.x, cam.position.z - p.z), s = Math.max(8, cam.position.distanceTo(p.sprite.position) * .07); p.sprite.scale.set(s * 5.33, s, 1); p.sprite.visible = p.beam.visible = d > 45; } };
  return { list, update };
}
