// Exporta edificios texturizados de v0.7 a modelos glTF (GLB) georreferenciados para el visor Cesium.
//
// Reutiliza SIN CAMBIOS el generador de v0.7 (v0.7/src/buildings/buildings.js): mismas huellas, tejados, estilos de
// fachada, colores medidos en las fotos y torre del reloj. Las ventanas, persianas y molduras se siguen dibujando en
// un shader: el GLB lleva los datos de fachada por vértice (_AWALL, _AFAC, _UVM) y el visor los pinta con un
// CustomShader (cesium/js/facade.js), port del shader de v0.7.
//
// Uso (desde menorca3d_v2, con `npm install` hecho en v0.7 para tener three):
//   node pipeline/exportar_glb.mjs                  → piloto: Ayuntamiento (todas las piezas de su parcela)
//   node pipeline/exportar_glb.mjs --refs REF1,REF2 --name nombre
//   node pipeline/exportar_glb.mjs --zona          → toda la zona de v0.7, en bloques de 300 × 300 m:
//        edificios (zona.js) y detalle de calle (calle.js: calzadas, aceras, plazas, muros, escaleras, farolas,
//        árboles y bancos, de v0.7/src/world/streetDetail.js). Con --sin-calle solo se exportan los edificios.
//        Si existe data/ide/ide_local.json (pipeline/preparar_ide.py), aceras, escaleras, porches, árboles y paredes
//        secas salen del IDE Menorca (REALES) en lugar de las estimaciones de v0.7; --sin-ide lo desactiva.
// Salida: cesium/models/<nombre>[_i_j].glb y cesium/models/<nombre>.js (lista de modelos que carga el visor).
// Las texturas no van dentro del GLB: se enlazan a cesium/assets/textures (se copian ahí). Hace falta abrir el visor
// con un servidor local (python -m http.server), no con doble clic.
//
// Coordenadas: el GLB está en el marco local de v0.7 (x este, y arriba, z sur; metros) con origen en zone.origin.
// Cesium lo coloca con una matriz ENU en ese origen (glTF y-arriba → z-arriba: este = x, norte = -z, arriba = y).
// Error de posición heredado de la proyección local de v0.7: ~0,1 m a 500 m del origen (ver README).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V07 = path.join(ROOT, 'v0.7');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };

// three.js carga texturas con <img>: en Node basta con un objeto vacío (aquí solo se genera geometría).
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {}, set src(v) {} }) };
globalThis.innerHeight = 800;   // lo usa el halo de las farolas de v0.7 (no se exporta)
const imp = p => import(pathToFileURL(path.join(V07, p)).href);
const THREE = await imp('node_modules/three/build/three.module.js').catch(() => {
  console.error('Falta three: ejecuta `npm install` dentro de v0.7'); process.exit(1);
});
const { createBuildings } = await imp('src/buildings/buildings.js');
const { tex } = await imp('src/core/textures.js');
const { ring, pip } = await imp('src/core/geo.js');

// ---------- Zona (igual que v0.7/src/data/loader.js, sin fetch) ----------
const ZDIR = path.join(V07, 'public/data/menorca/es-castell/santa-anna');
// --zonefile: otro archivo con el formato de zone.json (p. ej. data/extension/zona_municipio.json, el resto del municipio)
const ZFILE = arg('zonefile') ? path.resolve(arg('zonefile')) : path.join(ZDIR, 'zone.json');
const D = JSON.parse(fs.readFileSync(ZFILE, 'utf8')), T = D.terrain;
// v2: Cales Fonts con estilo de casco (centro y radio ESTIMADOS a partir de los nombres de calle de OSM)
if (!D.zones.some(z => z.n == 'Cales Fonts')) D.zones.push({ n: 'Cales Fonts', x: 170, z: -370, r: 140, casco: true });
const HH = new Int16Array(Uint8Array.from(Buffer.from(T.h, 'base64')).buffer);
const h = (a, b) => HH[b * T.cols + a] / 10;
const Hgt = (x, z) => {
  const u = Math.max(0, Math.min(T.cols - 1.001, (x - T.x0) / T.step)), v = Math.max(0, Math.min(T.rows - 1.001, (z - T.z0) / T.step));
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  return (h(i, j) * (1 - fu) + h(i + 1, j) * fu) * (1 - fv) + (h(i, j + 1) * (1 - fu) + h(i + 1, j + 1) * fu) * fv;
};
const landP = ring(D.land), isl = D.islands.map(ring);
const zone = { ...D, Hgt, inLand: (x, z) => pip(x, z, landP) || isl.some(q => pip(x, z, q)) };
// v2: aceras, escaleras, porches, árboles y paredes REALES del IDE Menorca (pipeline/preparar_ide.py), si existen.
// Cada elemento va a la zona detallada (z = 1) o al resto del municipio (z = 0). --sin-ide: como v0.7 (ESTIMADO).
const IDEF = path.join(ROOT, arg('ide') || 'data/ide/ide_local.json');
if (!process.argv.includes('--sin-ide') && fs.existsSync(IDEF)) {
  const I = JSON.parse(fs.readFileSync(IDEF, 'utf8')), zf = ZFILE == path.join(ZDIR, 'zone.json') ? 1 : 0;
  if (I.origin.lon != D.origin.lon || I.origin.lat != D.origin.lat) { console.error('ide_local.json no comparte origen con la zona'); process.exit(1); }
  zone.ide = { aceras: I.aceras.filter(a => a.z == zf), escaleras: I.escaleras.filter(a => a.z == zf), porches: I.porches.filter(a => a.z == zf),
    arboles: I.arboles.filter(a => a[2] == zf), paredes: I.paredes.filter(a => a.z == zf) };
  // Paredes que un generador propio redibuja de otra forma (p. ej. la pared seca baja del jardín del conjunto nº 1061)
  const { recortaParedesIDE } = await imp('src/buildings/casa1061.js');
  zone.ide.paredes = recortaParedesIDE(zone.ide.paredes);
  console.log('IDE Menorca:', Object.entries(zone.ide).map(([k, v]) => `${v.length} ${k}`).join(', '));
} else console.log('Sin capas del IDE: aceras, árboles y escaleras ESTIMADOS como en v0.7');

// Ajustes manuales (por nº de edificio → por referencia catastral), como en v0.7/src/main.js
const nums = JSON.parse(fs.readFileSync(path.join(ZDIR, 'edificios.json'), 'utf8')).edificios;
const byN = new Map(nums.map(e => [String(e.n), e.ref])), ajustes = {};
try { for (const [n, a] of Object.entries(JSON.parse(fs.readFileSync(path.join(ZDIR, 'ajustes_edificios.json'), 'utf8')).edificios || {})) if (byN.has(n)) ajustes[byN.get(n)] = a; } catch { /* sin ajustes */ }

// ---------- Selección ----------
const ZONA = process.argv.includes('--zona') || !!arg('zonefile');
let refs = arg('refs') ? arg('refs').split(',') : null, name = arg('name');
if (ZONA) { refs = [...new Set(D.buildings.map(b => b.ref).filter(Boolean))]; name = name || 'zona'; }
else if (!refs) {   // piloto: parcela del Ayuntamiento (punto REAL de OSM), igual que lo detecta buildings.js
  const th = D.pois.find(p => p.k == 'ayuntamiento');
  const b = th && D.buildings.find(bd => pip(th.x, th.z, ring(bd.p)));
  if (!b || !b.ref) { console.error('No encuentro el edificio del Ayuntamiento en zone.json'); process.exit(1); }
  refs = [b.ref]; name = name || 'ayuntamiento';
}
name = name || 'seleccion';
const CALLE = arg('calle') || (name == 'zona' ? 'calle' : name + '_calle');   // nombre de la capa de calle
const refSet = new Set(refs), sel = ZONA ? D.buildings : D.buildings.filter(b => refSet.has(b.ref));
if (!sel.length) { console.error('Ninguna pieza con esas referencias:', refs.join(', ')); process.exit(1); }
console.log(`${name}: ${sel.length} piezas (${refs.length} parcelas catastrales${ZONA ? ' + edificios solo OSM' : ''})`);

// ---------- Menorca3D Forge: casas retocadas a mano ----------
// Cada casa editada con Menorca3D Forge (casas/<REF>.forge.json) SUSTITUYE a la que genera v0.7 para esa
// referencia catastral: su parcela no se genera y en su lugar se añade la geometría guardada por Forge (mismo marco
// local de v0.7 y mismos materiales: fachada con huecos en el shader, texturas de v0.7 o color liso).
// Carpeta: menorca3d_v2/casas (o, si no existe, ../menorca3d_v2_forge/casas, donde se guardaban antes).
// --forge <carpeta> cambia la carpeta; --sin-forge exporta como antes, sin las casas editadas.
const FORGE_DIR = path.resolve(ROOT, arg('forge') || (fs.existsSync(path.join(ROOT, 'casas')) ? 'casas' : '../menorca3d_v2_forge/casas'));
const forge = new Map();
if (!process.argv.includes('--sin-forge') && fs.existsSync(FORGE_DIR)) {
  const enZona = new Set(sel.map(b => b.ref).filter(Boolean));
  for (const f of fs.readdirSync(FORGE_DIR)) {
    if (!f.endsWith('.forge.json')) continue;
    try {
      const F = JSON.parse(fs.readFileSync(path.join(FORGE_DIR, f), 'utf8'));
      if (F.formato != 'menorca3d-forge' || !enZona.has(F.ref)) continue;
      if (Math.abs(F.origin.lon - D.origin.lon) > 1e-9 || Math.abs(F.origin.lat - D.origin.lat) > 1e-9) { console.error(`Forge: ${f} no comparte origen con la zona; se ignora`); continue; }
      forge.set(F.ref, F);
    } catch (err) { console.error(`Forge: no se pudo leer ${f}: ${err.message}`); }
  }
  if (forge.size) console.log(`Forge: ${forge.size} casa(s) editada(s) a mano: ${[...forge.keys()].join(', ')}`);
}
function forgeGroup(F) {
  const { createFacadeMaterial } = FACADE, g = new THREE.Group(), mats = new Map();
  const material = m => {
    const k = JSON.stringify(m);
    if (!mats.has(k)) {
      const side = m.doble === false ? THREE.FrontSide : THREE.DoubleSide;
      mats.set(k, m.kind == 'fachada' ? createFacadeMaterial()
        : TEXS[m.kind] ? texturedMaterial(m.kind, { vertexColors: true, side })
          : new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side, ...(m.emissive ? { emissive: new THREE.Color(m.emissive) } : {}) }));
    }
    return mats.get(k);
  };
  for (const o of F.objetos) {
    if (o.visible === false || !o.geo || !o.geo.position || !o.geo.position.length) continue;
    const geo = new THREE.BufferGeometry(), G = o.geo;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(G.position, 3));
    if (G.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(G.normal, 3));
    if (G.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
    if (G.color) geo.setAttribute('color', new THREE.Float32BufferAttribute(G.color, 3));
    if (G.aWall) geo.setAttribute('aWall', new THREE.Float32BufferAttribute(G.aWall, 4));
    if (G.aFac) geo.setAttribute('aFac', new THREE.Float32BufferAttribute(G.aFac, 4));
    const mesh = new THREE.Mesh(geo, material(o.material || { kind: 'color' })), t = o.transform || {};
    if (t.p) mesh.position.fromArray(t.p);
    if (t.q) mesh.quaternion.fromArray(t.q);
    if (t.s) mesh.scale.fromArray(t.s);
    g.add(mesh);
  }
  return g;
}
const FACADE = forge.size ? await imp('src/buildings/facadeMaterial.js') : null;
const { TEXTURES: TEXS, texturedMaterial } = await imp('src/core/textures.js');
const selGen = forge.size ? sel.filter(b => !forge.has(b.ref)) : sel;
const built = createBuildings({ ...zone, buildings: selGen }, ajustes);
for (const F of forge.values()) built.mesh.add(forgeGroup(F));
if (forge.size) {   // el detalle de calle sigue esquivando las huellas del Catastro de las casas editadas
  const huellas = sel.filter(b => forge.has(b.ref)).map(b => ring(b.p)), hit0 = built.hit;
  built.hit = (x, z) => hit0(x, z) || huellas.some(r => pip(x, z, r));
}
const SETS = [{ name, refs, group: built.mesh }];
if (ZONA && !process.argv.includes('--sin-calle')) {
  const { createStreetDetail } = await imp('src/world/streetDetail.js');
  SETS.push({ name: CALLE, refs: [], group: createStreetDetail(zone, built.hit).group });
}

// ---------- Materiales ----------
const TEXDIR = path.join(V07, 'public/assets/textures');
const { TEXTURES } = await imp('src/core/textures.js');
const SIZE = Object.fromEntries(Object.entries(TEXTURES).map(([k, v]) => [k, v.size]));   // metros por repetición
const kindOf = m => {
  if (m.onBeforeCompile && m.onBeforeCompile.toString().includes('aWall')) return 'fachada';
  for (const n of Object.keys(TEXTURES)) if (m.map && m.map === tex(n).map) return n;
  return 'color';
};
const TEXOUT = path.join(ROOT, 'cesium/assets/textures'); fs.mkdirSync(TEXOUT, { recursive: true });

// ---------- Recoger triángulos por material y por bloque ----------
// Cada triángulo va al bloque de 300 m donde cae su centro (el piloto de una parcela va en un solo bloque).
// Las mallas instanciadas (farolas, árboles, bancos, peldaños) se expanden; los halos de luz (Points) no se exportan.
const CH = ZONA ? 300 : 1e9, ATTRS = ['position', 'normal', 'uvRaw', 'color', 'aWall', 'aFac'];
const WIDTH = { position: 3, normal: 3, uvRaw: 2, color: 3, aWall: 4, aFac: 4 };
function collect(group) {
  group.updateMatrixWorld(true);
  const parts = new Map(); let tris = 0;
  const add = (g, material, instColor) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count; if (!n) return;   // malla vacía: glTF no admite accesores vacíos
    const kind = kindOf(material), mk = kind == 'color' ? 'c' + material.color.getHexString() + (material.emissive ? material.emissive.getHexString() : '') : kind;
    const src = { position: g.attributes.position, normal: g.attributes.normal, uvRaw: g.attributes.uv, color: g.attributes.color, aWall: g.attributes.aWall, aFac: g.attributes.aFac };
    const useColor = !!src.color || !!instColor, P = src.position.array;
    for (let t = 0; t < n; t += 3) {
      const cx = (P[t * 3] + P[t * 3 + 3] + P[t * 3 + 6]) / 3, cz = (P[t * 3 + 2] + P[t * 3 + 5] + P[t * 3 + 8]) / 3;
      const ck = ZONA ? Math.floor(cx / CH) + '_' + Math.floor(cz / CH) : 'u';
      const blk = parts.get(ck) || parts.set(ck, new Map()).get(ck);
      const key = mk + (useColor ? '+vc' : '');
      const e = blk.get(key) || blk.set(key, { kind, mat: material, hasColor: useColor, a: Object.fromEntries(ATTRS.map(k => [k, []])) }).get(key);
      for (let v = t; v < t + 3; v++) for (const k of ATTRS) {
        const A = src[k], w = WIDTH[k];
        if (k == 'color' && !A && instColor) { e.a.color.push(instColor.r, instColor.g, instColor.b); continue; }
        for (let c = 0; c < w; c++) e.a[k].push(A ? A.array[v * w + c] : (k == 'color' ? 1 : 0));
      }
      tris++;
    }
  };
  const M = new THREE.Matrix4(), col = new THREE.Color();
  group.traverse(o => {
    if (!o.isMesh) return;   // Points, Sprites, luces: fuera
    const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.premultiply(o.matrixWorld);
        add(base.clone().applyMatrix4(M), o.material, o.instanceColor ? (o.getColorAt(i, col), col.clone()) : null);
      }
    } else add(base.clone().applyMatrix4(o.matrixWorld), o.material, null);
  });
  return { parts, tris };
}

// ---------- Escritor GLB mínimo (texturas enlazadas como archivos externos) ----------
// ---------- Georreferenciación por bloque ----------
// v0.7 trabaja en un plano (x este, z sur, y altura) con origen en zone.origin. Cada vértice se pasa a lon/lat/altura
// con la inversa de esa proyección y de ahí al plano tangente (ENU) del centro de SU bloque: así la curvatura de la
// Tierra no levanta los bloques lejanos (a 4 km del origen serían ~1,3 m).
const WA = 6378137, WF = 1 / 298.257223563, WE2 = WF * (2 - WF), RAD = Math.PI / 180;
const KX = 111320 * Math.cos(D.origin.lat * RAD), KZ = 110540;
const ecef = (lon, lat, h) => { const l = lon * RAD, p = lat * RAD, N = WA / Math.sqrt(1 - WE2 * Math.sin(p) ** 2);
  return [(N + h) * Math.cos(p) * Math.cos(l), (N + h) * Math.cos(p) * Math.sin(l), (N * (1 - WE2) + h) * Math.sin(p)]; };
function enuFrame(lon, lat) {
  const l = lon * RAD, p = lat * RAD, o = ecef(lon, lat, 0);
  const e = [-Math.sin(l), Math.cos(l), 0], n = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)], u = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  return (x, y, z) => {   // local v0.7 → glTF del bloque (x = este, y = arriba, z = sur)
    const q = ecef(D.origin.lon + x / KX, D.origin.lat - z / KZ, y), d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    const dot = v => v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
    return [dot(e), dot(u), -dot(n)];
  };
}

// ---------- Escritor GLB (indexado + KHR_mesh_quantization; texturas enlazadas como archivos externos) ----------
// Posición: enteros de 16 bits con escala uniforme en el nodo (~7 mm en un bloque de 300 m). Normales y colores: 8 bits.
// UV y datos de fachada: coma flotante (el shader de fachadas necesita la precisión).
function writeGLB(blk, file, origin) {
  const bin = [], bviews = [], accessors = [], images = [], textures = [], materials = [], prims = [];
  let off = 0;
  const pushBytes = (buf, target, byteStride) => {
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), pad = (4 - (b.length % 4)) % 4;
    bviews.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}), ...(byteStride ? { byteStride } : {}) });
    bin.push(b, Buffer.alloc(pad)); off += b.length + pad; return bviews.length - 1;
  };
  const NC = { VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 };
  const accF = (arr, type) => { accessors.push({ bufferView: pushBytes(Float32Array.from(arr), 34962), componentType: 5126, count: arr.length / NC[type], type }); return accessors.length - 1; };
  const accQ = (typed, ct, type, stride, extra = {}) => {   // atributo cuantizado con relleno hasta múltiplo de 4 bytes
    accessors.push({ bufferView: pushBytes(typed, 34962, stride), componentType: ct, count: typed.length / (stride / typed.BYTES_PER_ELEMENT), type, ...extra });
    return accessors.length - 1;
  };
  const texIdx = new Map();
  const texture = f => {
    if (!texIdx.has(f)) {
      if (!fs.existsSync(path.join(TEXOUT, f))) fs.copyFileSync(path.join(TEXDIR, f), path.join(TEXOUT, f));
      images.push({ uri: '../assets/textures/' + f }); textures.push({ source: images.length - 1, sampler: 0 }); texIdx.set(f, textures.length - 1);
    }
    return texIdx.get(f);
  };
  // Posiciones del bloque en su ENU y escala común de cuantización
  const toBlk = enuFrame(origin.lon, origin.lat), all = [];
  for (const [, e] of blk) { const P = e.a.position, Q = new Float64Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const r = toBlk(P[i], P[i + 1], P[i + 2]); Q[i] = r[0]; Q[i + 1] = r[1]; Q[i + 2] = r[2]; }
    e.q = Q; all.push(Q); }
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const Q of all) for (let i = 0; i < Q.length; i++) { const k = i % 3; if (Q[i] < mn[k]) mn[k] = Q[i]; if (Q[i] > mx[k]) mx[k] = Q[i]; }
  const sc = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], 1e-3) / 65535;
  for (const [, e] of blk) {
    const m = e.mat, pbr = { metallicFactor: 0, roughnessFactor: 1 }, mat = { name: e.kind, pbrMetallicRoughness: pbr, doubleSided: m.side == THREE.DoubleSide };
    if (e.kind == 'color') {
      pbr.baseColorFactor = [m.color.r, m.color.g, m.color.b, 1];   // three guarda los colores en lineal, como glTF
      if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) mat.emissiveFactor = [m.emissive.r, m.emissive.g, m.emissive.b];
    } else {
      pbr.baseColorTexture = { index: texture(`${e.kind == 'fachada' ? 'estuco' : e.kind}_albedo.png`) };
      if (m.color && (m.color.r < 1 || m.color.g < 1 || m.color.b < 1)) pbr.baseColorFactor = [m.color.r, m.color.g, m.color.b, 1];
    }
    if (e.kind == 'fachada') mat.extras = { fachada: true };
    materials.push(mat);
    const s = SIZE[e.kind == 'fachada' ? 'estuco' : e.kind] || 1, a = e.a, fac = e.kind == 'fachada', tex = e.kind != 'color', n = a.position.length / 3;
    // Cuantizar y quitar vértices repetidos (los triángulos de v0.7 vienen sueltos: 6 vértices por cada cara de 4)
    const map = new Map(), idx = new Uint32Array(n), P = [], N = [], C = [], UV = [], UVM = [], AW = [], AF = [];
    for (let v = 0; v < n; v++) {
      const p = [0, 1, 2].map(k => Math.round((e.q[v * 3 + k] - mn[k]) / sc));
      const nr = [0, 1, 2].map(k => Math.round(Math.max(-1, Math.min(1, a.normal[v * 3 + k])) * 127));
      const c = e.hasColor ? [0, 1, 2].map(k => Math.round(Math.max(0, Math.min(1, a.color[v * 3 + k])) * 255)) : [];
      const uv = tex ? [a.uvRaw[v * 2] / s, a.uvRaw[v * 2 + 1] / s] : [];
      const ex = fac ? [a.uvRaw[v * 2], a.uvRaw[v * 2 + 1], ...a.aWall.slice(v * 4, v * 4 + 4), ...a.aFac.slice(v * 4, v * 4 + 4)] : [];
      const key = p.join() + '|' + nr.join() + '|' + c.join() + '|' + uv.map(x => x.toFixed(4)).join() + '|' + ex.map(x => x.toFixed(4)).join();
      let id = map.get(key);
      if (id === undefined) {
        id = map.size; map.set(key, id);
        P.push(...p, 0); N.push(...nr, 0); if (e.hasColor) C.push(...c, 255);
        if (tex) UV.push(...uv); if (fac) { UVM.push(ex[0], ex[1]); AW.push(...ex.slice(2, 6)); AF.push(...ex.slice(6, 10)); }
      }
      idx[v] = id;
    }
    const nv = map.size, pmin = [Infinity, Infinity, Infinity], pmax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { const x = P[i * 4 + k]; if (x < pmin[k]) pmin[k] = x; if (x > pmax[k]) pmax[k] = x; }
    const attributes = {
      POSITION: accQ(Uint16Array.from(P), 5123, 'VEC3', 8, { min: pmin, max: pmax }),
      NORMAL: accQ(Int8Array.from(N), 5120, 'VEC3', 4, { normalized: true }),
    };
    if (e.hasColor) attributes.COLOR_0 = accQ(Uint8Array.from(C), 5121, 'VEC3', 4, { normalized: true });
    if (tex) attributes.TEXCOORD_0 = accF(UV, 'VEC2');
    // Datos de fachada solo donde hacen falta: en el resto, Cesium da valor 0 y el shader no hace nada
    if (fac) Object.assign(attributes, { _UVM: accF(UVM, 'VEC2'), _AWALL: accF(AW, 'VEC4'), _AFAC: accF(AF, 'VEC4') });
    const big = nv > 65535, ind = big ? idx : Uint16Array.from(idx);
    accessors.push({ bufferView: pushBytes(ind, 34963), componentType: big ? 5125 : 5123, count: n, type: 'SCALAR' });
    prims.push({ attributes, indices: accessors.length - 1, material: materials.length - 1, mode: 4 });
  }
  const json = {
    asset: { version: '2.0', generator: 'Menorca 3D v2 · pipeline/exportar_glb.mjs (geometría de v0.7)' },
    extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: file, translation: mn, scale: [sc, sc, sc] }], meshes: [{ name: file, primitives: prims }],
    materials, accessors, bufferViews: bviews, buffers: [{ byteLength: off }],
    ...(textures.length ? { textures, images, samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] } : {}),
    extras: { origin, fuente: 'Catastro (volúmenes REALES) + IDE Menorca (CC BY 4.0, ide.cime.es) + reglas PROCEDURALES de v0.7' },
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const body = Buffer.concat(bin), total = 12 + 8 + js.length + 8 + body.length;
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  const glb = Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(body.length, 0x004E4942), body]);
  fs.writeFileSync(path.join(OUT, file + '.glb'), glb);
  return glb.length;
}

const OUT = path.join(ROOT, 'cesium/models'); fs.mkdirSync(OUT, { recursive: true });
for (const f of ['aplacado_albedo.png', 'sillarejo_albedo.png']) fs.copyFileSync(path.join(TEXDIR, f), path.join(TEXOUT, f));
// Luces que el visor enciende de noche (focos del campo de fútbol, cruz de la farmacia): userData.luces de los generadores
if (ZONA) {
  // y: altura elipsoidal, la misma que usan los modelos (el GLB pone cada vértice en ecef(lon, lat, y))
  const ll = (x, z) => [+(D.origin.lon + x / KX).toFixed(8), +(D.origin.lat - z / KZ).toFixed(8)], r2 = v => +v.toFixed(2);
  const L = { focos: [], campos: [], farmacias: [] };
  built.mesh.traverse(o => { const u = o.userData && o.userData.luces; if (!u) return;
    for (const f of u.focos || []) L.focos.push({ ll: ll(f.x, f.z), y: r2(f.y), t: ll(f.t[0], f.t[2]), ty: r2(f.t[1]) });
    if (u.campo) L.campos.push({ p: u.campo.p.map(q => ll(q[0], q[1])), y: r2(u.campo.y) });
    if (u.farmacia) L.farmacias.push({ ll: ll(u.farmacia.x, u.farmacia.z), y: r2(u.farmacia.y), suelo: r2(u.farmacia.suelo) }); });
  // Solo se escribe si esta zona tiene luces (o es la zona detallada): al exportar después el resto del municipio, que no
  // tiene ninguna, no se vacía luces.js (pasaba en GitHub Actions, que exporta las dos zonas seguidas).
  if (name == 'zona' || L.focos.length || L.farmacias.length) {
    fs.writeFileSync(path.join(ROOT, 'cesium/data/luces.js'), `// Generado por pipeline/exportar_glb.mjs: luces de noche (y = altura elipsoidal, como los modelos).\nwindow.MENORCA_LUCES = ${JSON.stringify(L)};\n`);
    console.log(`escrito cesium/data/luces.js: ${L.focos.length} focos, ${L.farmacias.length} farmacia(s)`);
  } else console.log('sin luces de noche en esta zona: cesium/data/luces.js no se toca');
}
for (const S of SETS) {
  const { parts, tris } = collect(S.group), entries = []; let bytes = 0;
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(S.name + '_') && f.endsWith('.glb')) fs.unlinkSync(path.join(OUT, f));   // bloques viejos
  for (const [ck, blk] of parts) {
    const file = ZONA ? `${S.name}_${ck}` : S.name;
    let cx = 0, cz = 0;   // centro del bloque (o del modelo, si no hay bloques)
    if (ZONA) { const [i, j] = ck.split('_').map(Number); cx = (i + .5) * CH; cz = (j + .5) * CH; }
    else { let n = 0; for (const [, e] of blk) for (let k = 0; k < e.a.position.length; k += 3) { cx += e.a.position[k]; cz += e.a.position[k + 2]; n++; } cx /= n; cz /= n; }
    const origin = { lon: +(D.origin.lon + cx / KX).toFixed(8), lat: +(D.origin.lat - cz / KZ).toFixed(8) };
    bytes += writeGLB(blk, file, origin);
    // ?v=<huella del archivo>: si el modelo cambia, el navegador no usa la copia vieja de su caché
    const v = crypto.createHash('md5').update(fs.readFileSync(path.join(OUT, file + '.glb'))).digest('hex').slice(0, 10);
    entries.push({ name: file, url: `models/${file}.glb?v=${v}`, origin });
  }
  const manifest = { name: S.name, origin: D.origin, refs: S.refs, models: entries, ...(S.refs.length == 0 && zone.ide ? { ide: true } : {}),
    tex: { aplacado: 'assets/textures/aplacado_albedo.png', sillarejo: 'assets/textures/sillarejo_albedo.png' } };
  fs.writeFileSync(path.join(OUT, S.name + '.js'), `// Generado por pipeline/exportar_glb.mjs: no editar a mano.\n(window.MENORCA_MODELS = window.MENORCA_MODELS || []).push(${JSON.stringify(manifest)});\n`);
  console.log(`escrito cesium/models/${S.name}.js: ${entries.length} modelo(s), ${(bytes / 1e6).toFixed(1)} MB, ${tris} triángulos`);
}
