import { ring, pip, bbox } from '../core/geo.js';
// Registro de edificios numerados (tools/numerar_edificios.py → edificios.json junto a zone.json).
// Un edificio = una parcela catastral (REAL) con todas sus piezas; los de OSM sin Catastro usan la clave «osm-x_z».
// Estados: 'pendiente' (rojo) · 'acabado' (verde). Se guardan en edificios.json mediante el servidor de desarrollo
// (vite.config.js) y, si no se puede, en este navegador hasta que se guarden o se exporten.
export const ESTADOS = ['pendiente', 'acabado'];
const G = 25;

export async function createBuildingIndex(zone, dataUrl, destId) {
  const file = dataUrl.replace(/zone\.json$/, 'edificios.json'), LS = 'm3d-estados:' + destId;
  let lista = [];
  try { const r = await fetch(file, { cache: 'no-store' }); if (r.ok) lista = (await r.json()).edificios; } catch { /* sin archivo: se numera abajo */ }
  // Piezas → edificios
  const byKey = new Map();
  zone.buildings.forEach((b, i) => {
    const r = ring(b.p), cx = r.reduce((s, q) => s + q[0], 0) / r.length, cz = r.reduce((s, q) => s + q[1], 0) / r.length;
    const k = b.ref || null;
    const piece = { i, r, h: b.h, cx, cz };
    if (k) (byKey.get(k) || byKey.set(k, []).get(k)).push(piece);
    else (byKey.get('osm?') || byKey.set('osm?', []).get('osm?')).push(piece);
  });
  // Las claves de OSM se emparejan por cercanía del centro (evita diferencias de redondeo entre Python y JS).
  const osm = byKey.get('osm?') || []; byKey.delete('osm?');
  for (const e of lista) if (e.ref.startsWith('osm-')) {
    const [x, z] = e.ref.slice(4).split('_').map(Number);
    let best = -1, bd = 2;
    osm.forEach((p, j) => { const d = Math.hypot(p.cx - x, p.cz - z); if (!p.used && d < bd) { bd = d; best = j; } });
    if (best >= 0) { osm[best].used = true; byKey.set(e.ref, [osm[best]]); }
  }
  // Edificios sin número (archivo ausente o desactualizado): número provisional al final, avisando en consola.
  let n = lista.reduce((m, e) => Math.max(m, e.n), 0), sinNum = 0;
  const known = new Set(lista.map(e => e.ref));
  for (const k of [...byKey.keys()].sort()) if (!known.has(k)) { lista.push({ n: ++n, ref: k, estado: 'pendiente', provisional: true }); sinNum++; }
  for (const p of osm) if (!p.used) { const k = `osm-${Math.round(p.cx)}_${Math.round(p.cz)}`; byKey.set(k, [p]); lista.push({ n: ++n, ref: k, estado: 'pendiente', provisional: true }); sinNum++; }
  if (sinNum) console.warn(`${sinNum} edificios sin número estable: ejecuta python tools/numerar_edificios.py`);

  let pend = {}; try { pend = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { /* almacenamiento no disponible */ }
  const all = [], byN = new Map(), byRef = new Map(), grid = new Map(), owner = new Int32Array(zone.buildings.length).fill(-1);
  for (const e of lista) {
    const pieces = byKey.get(e.ref); if (!pieces || e.baja) continue;
    const pts = pieces.flatMap(p => p.r), [x0, x1, z0, z1] = bbox(pts);
    let A = 0, cx = 0, cz = 0;
    for (const p of pieces) { const a = Math.abs(area(p.r)); A += a; cx += p.cx * a; cz += p.cz * a; }
    const big = pieces.reduce((m, p) => Math.abs(area(p.r)) > Math.abs(area(m.r)) ? p : m);
    // Etiqueta dentro de la pieza mayor (el centro ponderado puede caer fuera en edificios en L)
    const lab = pip(cx / A, cz / A, big.r) ? [cx / A, cz / A] : [big.cx, big.cz];
    const b = { n: e.n, ref: e.ref, estado: pend[e.ref] || e.estado || 'pendiente', pieces, box: [x0, x1, z0, z1], lab, A,
      floors: Math.max(...pieces.map(p => Math.round(p.h / 3))), catastro: !e.ref.startsWith('osm-'), provisional: !!e.provisional };
    all.push(b); byN.set(b.n, b); byRef.set(b.ref, b);
    for (const p of pieces) owner[p.i] = all.length - 1;
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) {
      const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(b);
    }
  }
  const listeners = new Set();
  const near = (x, z, R) => { const s = new Set(); for (let gx = Math.floor((x - R) / G); gx <= Math.floor((x + R) / G); gx++) for (let gz = Math.floor((z - R) / G); gz <= Math.floor((z + R) / G); gz++) for (const b of grid.get(gx + ',' + gz) || []) s.add(b); return s; };
  const at = (x, z) => { for (const b of near(x, z, 0)) if (b.pieces.some(p => pip(x, z, p.r))) return b; return null; };
  // Distancia del punto al contorno del edificio (0 si está dentro)
  const dist = (b, x, z) => {
    let d = 1e9;
    for (const p of b.pieces) { if (pip(x, z, p.r)) return 0; for (let i = 0; i < p.r.length; i++) d = Math.min(d, segDist(x, z, p.r[i], p.r[(i + 1) % p.r.length])); }
    return d;
  };
  const nearest = (x, z, R = 15) => { let best = null, bd = R; for (const b of near(x, z, R)) { const d = dist(b, x, z); if (d < bd) { bd = d; best = b; } } return best; };

  let timer = null, lastSave = { ok: true, where: 'archivo' };
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const cambios = { ...pend }; if (!Object.keys(cambios).length) return;
      try {
        const r = await fetch('/__edificios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file, cambios }) });
        if (!r.ok) throw new Error(r.status);
        for (const k in cambios) if (pend[k] == cambios[k]) delete pend[k];
        lastSave = { ok: true, where: 'archivo' };
      } catch { lastSave = { ok: false, where: 'navegador' }; }
      try { localStorage.setItem(LS, JSON.stringify(pend)); } catch { /* sin almacenamiento */ }
      listeners.forEach(f => f());
    }, 400);
  };
  return {
    all, owner, file, at, nearest, dist,
    get(q) { q = String(q).trim().toUpperCase().replace(/^N[ºO°]?\s*/, ''); return /^\d+$/.test(q) ? byN.get(+q) : byRef.get(q) || byRef.get(q.toLowerCase()) || [...byRef.values()].find(b => b.ref.startsWith(q) && q.length >= 7); },
    setEstado(b, estado) { if (b.estado == estado) return; b.estado = estado; pend[b.ref] = estado; try { localStorage.setItem(LS, JSON.stringify(pend)); } catch { /* */ } listeners.forEach(f => f()); save(); },
    counts() { const c = { total: all.length }; for (const e of ESTADOS) c[e] = 0; for (const b of all) c[b.estado]++; return c; },
    saveState: () => ({ ...lastSave, pendientes: Object.keys(pend).length }),
    onChange(f) { listeners.add(f); },
    // Archivo completo para descargar (si no se ha podido guardar en el proyecto)
    exportJSON() {
      const rows = lista.map(e => { const b = byRef.get(e.ref), o = { n: e.n, ref: e.ref, estado: b ? b.estado : e.estado }; if (e.baja) o.baja = true; return JSON.stringify(o); });
      return '{\n"nota": "Números estables de edificio (parcela catastral). Estado: pendiente | acabado.",\n"edificios": [\n' + rows.join(',\n') + '\n]\n}\n';
    },
  };
}
function area(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; }
export function segDist(x, z, a, b) { const p = closestOnSeg(x, z, a, b); return Math.hypot(x - p[0], z - p[1]); }
export function closestOnSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0;
  return [a[0] + t * dx, a[1] + t * dz];
}
