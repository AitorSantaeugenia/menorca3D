import './ui/style.css';
import { DESTINATIONS, INTRO } from './config/destinations.js';
import { createScene } from './scene/scene.js';
import { setMaxAnisotropy } from './core/textures.js';
import { makeProjection } from './core/geo.js';
import { loadZone } from './data/loader.js';
import { createTerrain } from './terrain/terrain.js';
import { createBuildings } from './buildings/buildings.js';
import { createCollider } from './world/collision.js';
import { createStreetDetail } from './world/streetDetail.js';
import { createVegetation } from './vegetation/vegetation.js';
import { createPOIs } from './world/pois.js';
import { createPlayer } from './character/player.js';
import { FollowCamera } from './camera/followCamera.js';
import { createInput } from './core/input.js';
import { createMinimap } from './map/minimap.js';
import { createNightIntro } from './intro/nightIntro.js';
import { runOnboarding } from './ui/onboarding.js';
import { createHud } from './ui/hud.js';
import { createBuildingIndex } from './world/buildingIndex.js';
import { viewpoint, highlight, ESTADO_COLOR } from './world/goToBuilding.js';
import { createBigMap } from './map/bigMap.js';
import { createDayNightButton } from './core/dayNight.js';
import { DEV_PLACES } from './config/places.js';
import { POI_COLORS } from './world/pois.js';

async function main() {
  const { renderer, scene, camera } = createScene(document.getElementById('c'));
  setMaxAnisotropy(renderer);
  const player = createPlayer();
  createDayNightButton();
  // Inicio: toda la isla detrás del panel translúcido (si falla, se sigue sin él)
  const introP = createNightIntro(document.getElementById('intro3d'), INTRO.data, { marks: INTRO.marks }).catch(e => { console.warn('Inicio nocturno no disponible:', e.message); return null; });
  document.getElementById('attr').textContent = 'Es Castell: Dirección General del Catastro · relieve: MDT © IGN · costa, calles y faros: © OpenStreetMap contributors · resto de la isla: campo provisional';
  // Pantalla de carga hasta que la isla está dibujada; después, el panel de inicio encima
  const intro = await introP, loader = document.getElementById('loader');
  if (loader) { loader.style.opacity = 0; setTimeout(() => loader.remove(), 650); }
  const { destId, municipality, profile } = await runOnboarding(sel => player.setLook(sel));
  const dest = DESTINATIONS[destId], status = document.getElementById('istatus');
  status.textContent = `Cargando ${dest.settlement}…`; status.style.display = 'flex';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // que se vea el aviso antes del trabajo pesado
  const zone = await loadZone(dest), proj = makeProjection(zone.origin);
  // Pipeline: datos procesados → coordenadas locales → geometría Three.js
  scene.add(createTerrain(zone, dest.ground, renderer));
  const idx = await createBuildingIndex(zone, dest.data, destId);   // números de edificio (también para los ajustes)
  const ajustes = {};
  try { const r = await fetch(dest.data.replace(/zone\.json$/, 'ajustes_edificios.json'), { cache: 'no-store' }); if (r.ok) for (const [n, a] of Object.entries((await r.json()).edificios || {})) { const b = idx.get(n); if (b) ajustes[b.ref] = a; } } catch { /* sin ajustes */ }
  const buildings = createBuildings(zone, ajustes); scene.add(buildings.mesh);
  scene.add(createVegetation(zone, buildings.hit));
  const street = createStreetDetail(zone, buildings.hit); scene.add(street.group);
  const ground = (x, z) => zone.Hgt(x, z) + street.extra(x, z);
  // Lugares propios (config/places.js): delante del edificio indicado
  for (const dp of DEV_PLACES) { const b = idx.get(dp.building), v = b && viewpoint(b, zone, idx, buildings.hit); if (v) { POI_COLORS['dev:' + dp.name] = dp.color; zone.pois.push({ k: 'dev:' + dp.name, l: dp.name, x: v.x, z: v.z }); } }
  const pois = createPOIs(zone, scene), free = createCollider(zone, buildings, street);
  // Inicio del personaje: en la calle, delante del edificio del punto de inicio (Ayuntamiento), mirándolo
  const sb = idx.at(dest.start.x, dest.start.z);
  const spawn = (sb && buildings.plaza && plazaSpawn(sb, buildings.plaza, buildings.hit)) || (sb && viewpoint(sb, zone, idx, buildings.hit)) || { x: dest.start.x, z: dest.start.z };
  player.setLook(profile); player.teleport(spawn.x, spawn.z); scene.add(player.root);
  const follow = new FollowCamera(camera, zone.Hgt), input = createInput(renderer.domElement, (dx, dy) => follow.look(dx, dy));
  const minimap = createMinimap(document.getElementById('mm'), zone, pois.list);
  const hud = createHud(profile, pois.list, p => player.teleport(p.road[0], p.road[1]),
    zone.attr + ' · relieve: MDT © Instituto Geográfico Nacional · plantas: Dirección General del Catastro · texturas y árboles: procedurales');
  // Edificios numerados: «ir al edificio nº X», mapa grande con estado acabado/pendiente
  if (spawn.yaw != null) follow.yaw = spawn.yaw;
  let mark = null;
  const goTo = b => {
    const v = viewpoint(b, zone, idx, buildings.hit);
    if (!v) { console.warn('Sin punto de vista para el edificio', b.n); return; }
    player.teleport(v.x, v.z); follow.yaw = v.yaw; follow.pitch = v.pitch; follow.dist = v.dist; follow.anim = null; follow.snap = true;
    if (mark) { scene.remove(mark); mark.dispose(); }
    mark = highlight(b, buildings.heights); scene.add(mark);
  };
  const bigMap = createBigMap({ zone, idx, pois: pois.list, player: () => ({ x: player.root.position.x, z: player.root.position.z, yaw: follow.yaw }),
    onGo: goTo, onToggle: b => idx.setEstado(b, b.estado == 'acabado' ? 'pendiente' : 'acabado') });
  const openMap = b => { if (mode != 'play') return; mode = 'map'; input.keys = {}; input.paused = true; bigMap.open(b); };
  bigMap.onClose = () => { mode = 'play'; input.paused = false; last = performance.now(); };
  document.getElementById('mm').addEventListener('dblclick', () => openMap());
  let tapT = 0; document.getElementById('mm').addEventListener('pointerup', e => { if (e.pointerType != 'mouse') { const t = performance.now(); if (t - tapT < 350) openMap(); tapT = t; } });
  document.getElementById('bmap').onclick = () => openMap();
  addEventListener('keydown', e => { if (e.code == 'KeyM' && !/INPUT|TEXTAREA/.test(e.target.tagName)) bigMap.isOpen ? bigMap.close() : openMap(); });
  const bgo = document.getElementById('bgo');
  bgo.onsubmit = e => { e.preventDefault(); const q = bgo.querySelector('input'), b = idx.get(q.value); if (b) { goTo(b); q.value = ''; q.blur(); } else { q.value = ''; q.placeholder = 'No existe'; setTimeout(() => { q.placeholder = 'Edificio nº'; }, 1800); } };
  // Vista aérea inicial sobre el destino (oculta tras el mapa 2D hasta que termina el zoom)
  const sy = zone.Hgt(spawn.x, spawn.z);
  camera.position.set(spawn.x, sy + 600, spawn.z + 1); camera.lookAt(spawn.x, sy, spawn.z);
  player.root.position.y = sy;
  let mode = 'intro', last = performance.now(), fr = 0;
  const loop = now => {
    requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000, .05); last = now;
    if (mode == 'play') {
      player.update(dt, input, follow.yaw, free, ground);
      follow.update(dt, player.root.position);
      if (++fr % 3 == 0) {
        minimap(player.root.position, follow.yaw);
        const pp = player.root.position, g = proj.toGeo(pp.x, pp.z); hud.setCoords(g.lat, g.lon, zone.Hgt(pp.x, pp.z));
        let zn = dest.municipality, bd = 1e9;
        for (const z of zone.zones) { const q = Math.hypot(z.x - player.root.position.x, z.z - player.root.position.z); if (q < z.r && q < bd) { bd = q; zn = z.n; } }
        const nb = idx.nearest(pp.x, pp.z, 15); hud.setBuilding(nb, nb && ESTADO_COLOR[nb.estado]);
        hud.setZone(`${zn} · ${dest.municipality} · ${dest.island}${input.turbo ? ' · TURBO' : ''}`);
      }
    }
    if (mode == 'map' || mode == 'intro') return;   // el mapa grande o el zoom 2D tapan la vista 3D: no se renderiza
    pois.update(camera); renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
  // Solo para pruebas (?debug): situar al personaje y la cámara desde la consola o un test automático.
  if (new URLSearchParams(location.search).has('debug')) window.__dbg = v => { if (v.goto != null) { const b = idx.get(v.goto); if (b) goTo(b); mode = 'play'; return b && { n: b.n, ref: b.ref }; } if (v.map != null) { mode = 'play'; if (v.map === false) return bigMap.close(); const b = v.map === true ? undefined : idx.get(v.map); if (bigMap.isOpen) bigMap.select(b); else openMap(b); return; } if (v.x != null) player.teleport(v.x, v.z); if (v.yaw != null) follow.yaw = v.yaw; if (v.pitch != null) follow.pitch = v.pitch; if (v.dist != null) follow.dist = v.dist; follow.anim = null; follow.snap = true; mode = 'play'; return { ...renderer.info.render, geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures }; };
  status.textContent = `Llegando a ${dest.settlement}…`;
  if (intro) await intro.flyTo(spawn.x, sy, spawn.z);   // termina en la misma vista aérea que la cámara del juego
  status.style.display = 'none';
  mode = 'play'; renderer.render(scene, camera);
  if (intro) intro.fadeOut();
  follow.descend(4); hud.show();
}
// Inicio en la plaza, delante de la fachada del edificio que da a ella (Ayuntamiento → Plaça de s'Esplanada)
function plazaSpawn(b, plaza, hit) {
  const P = plaza.p[0][0] == plaza.p.at(-1)[0] && plaza.p[0][1] == plaza.p.at(-1)[1] ? plaza.p.slice(0, -1) : plaza.p;
  const pc = P.reduce((s, q) => [s[0] + q[0] / P.length, s[1] + q[1] / P.length], [0, 0]);
  const inPlaza = (x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], d = P[j]; if ((a[1] > z) != (d[1] > z) && x < (d[0] - a[0]) * (z - a[1]) / (d[1] - a[1]) + a[0]) c = !c; } return c; };
  let best = null;
  for (const p of b.pieces) for (let i = 0; i < p.r.length; i++) {
    const a = p.r[i], c = p.r[(i + 1) % p.r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 4) continue;
    const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
    if ((m[0] - p.cx) * nx + (m[1] - p.cz) * nz < 0) { nx = -nx; nz = -nz; }                      // normal hacia fuera
    if ((pc[0] - m[0]) * nx + (pc[1] - m[1]) * nz <= 0) continue;                                 // el lado mira a la plaza
    const score = Math.hypot(pc[0] - m[0], pc[1] - m[1]) - L * .6;
    if (!best || score < best.score) best = { m, nx, nz, score };
  }
  if (!best) return null;
  for (let d = 14; d >= 4; d -= 1) { const x = best.m[0] + best.nx * d, z = best.m[1] + best.nz * d; if (inPlaza(x, z) && !hit(x, z)) return { x, z, yaw: Math.atan2(best.nx, best.nz) }; }
  return null;
}
main().catch(e => {
  document.getElementById('loader')?.remove();
  const ov = document.getElementById('overlay'); ov.classList.remove('hide');
  ov.innerHTML = '<div class="logo">MENORCA<span>3D</span></div><p></p>'; ov.querySelector('p').textContent = 'Error: ' + e.message; console.error(e);
});
