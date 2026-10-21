import * as THREE from 'three';
// Texturas PROCEDURALES compartidas (tools/generar_texturas.py → public/assets/textures).
// Las UV de toda la geometría están en METROS: 'size' es cuántos metros cubre una repetición.
export const TEXTURES = {
  piedra_seca: { size: 2 }, aplacado: { size: 2 }, acera: { size: 0.66 }, asfalto: { size: 4 },
  estuco: { size: 4 }, teja: { size: 2 }, terraza: { size: 2 },
  losa_plaza: { size: 2.4 }, baldosa_roja: { size: 1 }, adoquin: { size: 1 }, sillarejo: { size: 2 },
  sillar: { size: 4 },   // v2: sillería de marés de la iglesia del Roser (pipeline/textura_sillar.py)
  rotulo_farmacia: { size: 1 }, rotulo_farmacia2: { size: 1 }, rotulo_farmacia3: { size: 1 },   // v2: rótulos con texto (pipeline/textura_rotulos.py); UV 0–1
};
const loader = new THREE.TextureLoader(), cache = new Map();
let anisotropy = 4;
export function setMaxAnisotropy(renderer) { anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
// Devuelve { map, normalMap } con repetición y escala ya configuradas (se reutilizan entre materiales).
export function tex(name) {
  if (cache.has(name)) return cache.get(name);
  const s = 1 / TEXTURES[name].size, base = `/assets/textures/${name}`;
  const set = (t, srgb) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(s, s); t.anisotropy = anisotropy; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const r = { map: set(loader.load(`${base}_albedo.png`), true), normalMap: set(loader.load(`${base}_normal.png`), false) };
  cache.set(name, r);
  return r;
}
// Material estándar con textura, color multiplicador opcional y colores por vértice opcionales.
export function texturedMaterial(name, opts = {}) {
  const t = tex(name);
  return new THREE.MeshLambertMaterial({
    map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1),
    color: opts.color ?? 0xffffff, vertexColors: !!opts.vertexColors, side: opts.side ?? THREE.FrontSide,
    polygonOffset: !!opts.offset, polygonOffsetFactor: opts.offset ? -opts.offset : 0, polygonOffsetUnits: opts.offset ? -opts.offset : 0,
  });
}
