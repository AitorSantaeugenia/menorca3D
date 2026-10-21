// Minimapa (arriba a la derecha) y mapa grande de edificios (doble clic en el minimapa o tecla M), como en v0.7
// (v0.7/src/map/minimap.js y bigMap.js), adaptados a Cesium.
// Edificios: piezas REALES del Catastro agrupadas por referencia catastral, con el número estable de v0.7
// (edificios.json) y su estado: rojo = pendiente, verde = acabado. Los cambios de estado se guardan en este navegador
// y se pueden exportar (Exportar → edificios.json), porque el servidor local (python -m http.server) no escribe archivos.
// Coordenadas del mapa: el plano local de v0.7 (x este, z sur, metros) con origen en D.origin.
window.createMaps = function ({ C, viewer, D, ISLA, ground }) {
  const $ = id => document.getElementById(id), scene = viewer.scene, camera = viewer.camera;
  const O = D.origin, KX = D.terrain.kx, KZ = D.terrain.kz;
  const toXZ = (lon, lat) => [(lon - O.lon) * KX, -(lat - O.lat) * KZ];
  const toLL = (x, z) => [O.lon + x / KX, O.lat - z / KZ];
  const ESTADO_COLOR = { pendiente: '#e03131', acabado: '#2f9e44' };
  const MASK = { pendiente: 'rgba(224,49,49,.55)', acabado: 'rgba(47,158,68,.7)' };

  // ---------- Edificios: piezas → parcelas ----------
  const ringXZ = flat => { const r = []; for (let i = 0; i < flat.length; i += 2) r.push(toXZ(flat[i], flat[i + 1])); const f = r[0], l = r[r.length - 1]; if (r.length > 1 && f[0] == l[0] && f[1] == l[1]) r.pop(); return r; };
  const area = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const pip = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) != (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const byRef = new Map();
  D.buildings.forEach((b, i) => {
    const r = ringXZ(b.p), holes = (b.h || []).map(ringXZ);
    const e = byRef.get(b.r) || byRef.set(b.r, { ref: b.r, n: null, pieces: [] }).get(b.r);
    e.pieces.push({ i, r, holes, f: b.f, base: b.b }); if (b.n) e.n = b.n;
  });
  const LS = 'm3d-v2-estados';
  let pend = {}; try { pend = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { /* sin almacenamiento */ }
  const EST = window.MENORCA_ESTADOS || {};
  let maxN = 0; for (const e of byRef.values()) if (e.n) maxN = Math.max(maxN, e.n);
  const all = [], byN = new Map(), grid = new Map(), G = 25;
  for (const e of [...byRef.values()].sort((a, b) => (a.n || 1e9) - (b.n || 1e9) || (a.ref < b.ref ? -1 : 1))) {
    const provisional = !e.n; if (provisional) e.n = ++maxN;   // fuera de la zona numerada en v0.7: número provisional
    let A = 0, cx = 0, cz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of e.pieces) {
      const a = Math.abs(area(p.r)) || 1e-6; let px = 0, pz = 0;
      for (const q of p.r) { px += q[0]; pz += q[1]; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      p.cx = px / p.r.length; p.cz = pz / p.r.length; p.A = a; A += a; cx += p.cx * a; cz += p.cz * a;
    }
    const big = e.pieces.reduce((m, p) => p.A > m.A ? p : m);
    const lab = pip(cx / A, cz / A, big.r) ? [cx / A, cz / A] : [big.cx, big.cz];
    const path = new Path2D();
    for (const p of e.pieces) for (const rr of [p.r, ...p.holes]) { rr.forEach((q, k) => k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])); path.closePath(); }
    const b = { ...e, provisional, estado: pend[e.ref] || EST[e.ref] || 'pendiente', A, lab, box: [x0, x1, z0, z1], path,
      floors: Math.max(...e.pieces.map(p => p.f)), base: Math.min(...e.pieces.map(p => p.base)) };
    all.push(b); byN.set(b.n, b); byRef.set(b.ref, b);
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) { const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(b); }
  }
  const at = (x, z) => { for (const b of grid.get(Math.floor(x / G) + ',' + Math.floor(z / G)) || []) if (b.pieces.some(p => pip(x, z, p.r) && !p.holes.some(h => pip(x, z, h)))) return b; return null; };
  const get = q => { q = String(q).trim().toUpperCase(); return byN.get(+q) || byRef.get(q) || all.find(b => b.ref.startsWith(q) && q.length >= 7) || null; };
  const listeners = new Set();
  const setEstado = (b, estado) => {
    b.estado = estado; if (estado == (EST[b.ref] || 'pendiente')) delete pend[b.ref]; else pend[b.ref] = estado;
    try { localStorage.setItem(LS, JSON.stringify(pend)); } catch { /* sin almacenamiento */ }
    listeners.forEach(f => f());
  };
  const toggle = b => setEstado(b, b.estado == 'acabado' ? 'pendiente' : 'acabado');
  const exportJSON = () => JSON.stringify({ nota: 'Exportado desde Menorca 3D v2 (cesium). Números estables de v0.7; provisional = fuera de la zona numerada.',
    edificios: all.slice().sort((a, b) => a.n - b.n).map(b => ({ n: b.n, ref: b.ref, estado: b.estado, ...(b.provisional ? { provisional: true } : {}) })) }, null, 1);

  // ---------- Capas de fondo: tierra (relieve de la isla > 0 m), costa y calles ----------
  // Tierra: una imagen con un píxel por celda de data/isla.js, colocada en el plano local con un ajuste afín
  // UTM → local (la cuadrícula UTM está girada ~0,8° respecto al norte en Menorca).
  let land = null;
  if (ISLA) {
    const cv = document.createElement('canvas'); cv.width = ISLA.cols; cv.height = ISLA.rows;
    const g = cv.getContext('2d'), img = g.createImageData(ISLA.cols, ISLA.rows);
    for (let k = 0; k < ISLA.HH.length; k++) if (ISLA.HH[k] > 0) { img.data[k * 4] = 239; img.data[k * 4 + 1] = 235; img.data[k * 4 + 2] = 226; img.data[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    // Ajuste afín con tres puntos: píxel (i, j) → UTM → lon/lat (inversa numérica de toUTM31) → local
    const utmToLL = (E, N) => { let lo = 4.29, la = 39.88; for (let it = 0; it < 6; it++) { const [e1, n1] = toUTM31(lo, la), [e2] = toUTM31(lo + 1e-4, la), [, n3] = toUTM31(lo, la + 1e-4); lo += (E - e1) / ((e2 - e1) / 1e-4); la += (N - n1) / ((n3 - n1) / 1e-4); } return [lo, la]; };
    const P = [[0, 0], [ISLA.cols, 0], [0, ISLA.rows]].map(([i, j]) => toXZ(...utmToLL(ISLA.x0 - ISLA.step / 2 + i * ISLA.step, ISLA.y0 + ISLA.step / 2 - j * ISLA.step)));
    land = { cv, m: [(P[1][0] - P[0][0]) / ISLA.cols, (P[1][1] - P[0][1]) / ISLA.cols, (P[2][0] - P[0][0]) / ISLA.rows, (P[2][1] - P[0][1]) / ISLA.rows, P[0][0], P[0][1]] };
  }
  const coast = new Path2D();
  for (const l of D.coast) l.forEach(([lo, la], k) => { const [x, z] = toXZ(lo, la); k ? coast.lineTo(x, z) : coast.moveTo(x, z); });
  const ROAD_W = { primary: 9, secondary: 8, tertiary: 7, residential: 5.5, unclassified: 5, living_street: 5, service: 3.5, track: 3 };
  const roads = D.roads.map(r => {
    const p = new Path2D(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = 0; k < r.p.length; k += 2) { const [x, z] = toXZ(r.p[k], r.p[k + 1]); k ? p.lineTo(x, z) : p.moveTo(x, z); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { p, w: ROAD_W[r.t] || 2, foot: !ROAD_W[r.t], box: [x0, x1, z0, z1] };
  });
  const drawBase = (g, s, vx0, vz0, vx1, vz1, light) => {
    if (land) { g.save(); g.transform(...land.m); g.imageSmoothingEnabled = true; g.drawImage(land.cv, 0, 0); g.restore(); }
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = 'rgba(80,120,140,.55)'; g.lineWidth = 1.5 / s; g.stroke(coast);
    const vis = roads.filter(r => !(r.box[1] < vx0 || r.box[0] > vx1 || r.box[3] < vz0 || r.box[2] > vz1));
    g.strokeStyle = '#b9b2a4'; for (const r of vis) { g.lineWidth = r.foot ? Math.max(1.2 / s, 1.4) : r.w + 1.6 / s; g.stroke(r.p); }
    g.strokeStyle = '#fff'; for (const r of vis) if (!r.foot) { g.lineWidth = r.w; g.stroke(r.p); }
    if (light) { g.fillStyle = '#d6cfc2'; for (const b of all) { const [x0, x1, z0, z1] = b.box; if (x1 < vx0 || x0 > vx1 || z1 < vz0 || z0 > vz1) continue; g.fill(b.path, 'evenodd'); } }
  };

  // ---------- Punto de vista: lo que hay en el centro de la pantalla y hacia dónde mira la cámara ----------
  const view = () => {
    const w = scene.canvas.clientWidth, h = scene.canvas.clientHeight;
    const ray = camera.getPickRay(new C.Cartesian2(w / 2, h / 2)), hit = ray && scene.globe.pick(ray, scene);
    const c = C.Cartographic.fromCartesian(hit || camera.positionWC);
    const [x, z] = toXZ(C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude));
    const cc = camera.positionCartographic, alt = cc.height - ground(C.Math.toDegrees(cc.longitude), C.Math.toDegrees(cc.latitude));
    return { x, z, yaw: camera.heading, alt };
  };

  // ---------- Minimapa: orientado con la cámara (arriba = hacia donde miras), como en v0.7 ----------
  const mm = $('mm'), mg = mm.getContext('2d'), MS = 140;
  let mmLast = 0;
  function drawMini(t) {
    if (mm.style.display != 'block' || t - mmLast < 90) return; mmLast = t;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (mm.width != MS * dpr) { mm.width = mm.height = MS * dpr; }
    const v = view(), R = Math.max(120, Math.min(6000, v.alt * 1.1)), s = (MS / 2) / R;
    const g = mg; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, MS, MS);
    g.save(); g.beginPath(); g.arc(MS / 2, MS / 2, MS / 2, 0, 7); g.clip(); g.fillStyle = '#bfe0ea'; g.fillRect(0, 0, MS, MS);
    g.translate(MS / 2, MS / 2); g.rotate(-v.yaw); g.scale(s, s); g.translate(-v.x, -v.z);
    const r2 = R * 1.5; drawBase(g, s, v.x - r2, v.z - r2, v.x + r2, v.z + r2, true);
    g.restore();
    g.fillStyle = '#d62828'; g.beginPath(); g.moveTo(MS / 2, MS / 2 - 10); g.lineTo(MS / 2 + 6, MS / 2 + 8); g.lineTo(MS / 2 - 6, MS / 2 + 8); g.fill();
    // Norte
    g.save(); g.translate(MS / 2, MS / 2); g.rotate(-v.yaw); g.fillStyle = '#10343f'; g.font = '700 11px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 0, -MS / 2 + 10); g.restore();
  }
  scene.postRender.addEventListener(() => drawMini(performance.now()));

  // ---------- Mapa grande ----------
  const root = document.createElement('div'); root.id = 'bigmap'; root.className = 'hide';
  root.innerHTML = `<canvas></canvas>
  <div class="bm-bar">
    <b class="bm-title">Mapa de edificios</b>
    <form class="bm-search"><input placeholder="Nº o ref. catastral" inputmode="text" autocomplete="off"><button>Buscar</button></form>
    <label class="bm-chip" title="Cada clic cambia el estado del edificio"><input type="checkbox"> Marcar con clic</label>
    <button class="bm-close" title="Cerrar (Esc o M)">✕</button>
  </div>
  <div class="bm-legend"><span><i style="background:${MASK.acabado}"></i>Acabado</span><span><i style="background:${MASK.pendiente}"></i>Pendiente</span>
    <span class="bm-count"></span><span class="bm-save"></span><button class="bm-export" title="Descargar edificios.json con los estados">Exportar</button></div>
  <div class="bm-card hide"></div>
  <div class="bm-msg hide"></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), g = cv.getContext('2d'), card = root.querySelector('.bm-card'), msg = root.querySelector('.bm-msg');
  const paint = root.querySelector('.bm-chip input'), input = root.querySelector('.bm-search input');
  let W = 0, H = 0, dpr = 1, cx = 0, cz = 0, s = 1.2, sel = null, hover = null, dirty = true, open = false, me = null;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; dirty = true; };
  addEventListener('resize', () => open && resize());
  const toWorld = (px, py) => [(px - W / 2) / s + cx, (py - H / 2) / s + cz];
  const toScreen = (x, z) => [(x - cx) * s + W / 2, (z - cz) * s + H / 2];

  function draw() {
    dirty = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#a9d3e0'; g.fillRect(0, 0, W, H);
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cx * s), dpr * (H / 2 - cz * s));
    const [vx0, vz0] = toWorld(0, 0), [vx1, vz1] = toWorld(W, H);
    drawBase(g, s, vx0, vz0, vx1, vz1, false);
    const vis = [];
    for (const b of all) { const [x0, x1, z0, z1] = b.box; if (x1 < vx0 || x0 > vx1 || z1 < vz0 || z0 > vz1) continue; vis.push(b);
      g.fillStyle = '#ffffff'; g.fill(b.path, 'evenodd'); g.fillStyle = MASK[b.estado] || MASK.pendiente; g.fill(b.path, 'evenodd'); }
    g.lineWidth = Math.min(.6, .8 / s); g.strokeStyle = 'rgba(40,40,40,.55)'; if (s > .8) for (const b of vis) g.stroke(b.path);
    if (sel) { g.fillStyle = 'rgba(255,212,59,.55)'; g.fill(sel.path, 'evenodd'); }
    for (const [b, c, w] of [[hover, '#ffffff', 2.5], [sel, '#ffd43b', 4]]) if (b) { g.strokeStyle = '#10343f'; g.lineWidth = (w + 2) / s; g.stroke(b.path); g.strokeStyle = c; g.lineWidth = w / s; g.stroke(b.path); }
    // Números (con zoom suficiente y sin solaparse: primero el seleccionado y los edificios grandes)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s >= 1.1) {
      const fs = s > 3 ? 12 : 10, taken = new Map(), CC = 24;
      g.font = `600 ${fs}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const free = (x0, y0, x1, y1, put) => {
        for (let i = Math.floor(x0 / CC); i <= Math.floor(x1 / CC); i++) for (let j = Math.floor(y0 / CC); j <= Math.floor(y1 / CC); j++)
          for (const r of taken.get(i + ',' + j) || []) if (!put && x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false;
        if (put) for (let i = Math.floor(x0 / CC); i <= Math.floor(x1 / CC); i++) for (let j = Math.floor(y0 / CC); j <= Math.floor(y1 / CC); j++) { const k = i + ',' + j; (taken.get(k) || taken.set(k, []).get(k)).push([x0, y0, x1, y1]); }
        return true;
      };
      vis.sort((a, b) => (b == sel) - (a == sel) || b.A - a.A);
      for (const b of vis) {
        const [px, py] = toScreen(b.lab[0], b.lab[1]), t = String(b.n), w = g.measureText(t).width / 2 + 2, h = fs / 2 + 1;
        if (px < -20 || py < -20 || px > W + 20 || py > H + 20) continue;
        if (b != sel && !free(px - w, py - h, px + w, py + h)) continue;
        free(px - w, py - h, px + w, py + h, true);
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(t, px, py); g.fillStyle = b == sel ? '#000' : '#1b1b1b'; g.fillText(t, px, py);
      }
    }
    // Cámara (punto de vista actual)
    if (me) {
      const [px, py] = toScreen(me.x, me.z);
      g.save(); g.translate(px, py); g.rotate(me.yaw); g.fillStyle = '#1c7ed6'; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  }
  const tick = () => { if (!open) return; if (dirty) draw(); requestAnimationFrame(tick); };
  const counts = () => {
    const ac = all.filter(b => b.estado == 'acabado').length, np = Object.keys(pend).length;
    root.querySelector('.bm-count').textContent = `${ac} de ${all.length} acabados (${(ac / all.length * 100).toFixed(1)} %)`;
    const sv = root.querySelector('.bm-save');
    sv.textContent = np ? `${np} cambios guardados solo en este navegador · usa Exportar` : '';
    sv.className = 'bm-save' + (np ? ' warn' : '');
  };
  listeners.add(() => { counts(); if (sel) showCard(sel); dirty = true; });

  function showCard(b) {
    card.classList.remove('hide');
    const rc = /^[0-9A-Z]{14}$/.test(b.ref) ? `<a href="https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${b.ref.slice(0, 7)}&rc2=${b.ref.slice(7, 14)}" target="_blank" rel="noopener">${b.ref}</a>` : b.ref;
    card.innerHTML = `<button class="bm-x" title="Cerrar">✕</button><div class="bm-n">Edificio nº ${b.n}</div>
      <div class="bm-meta">Ref. catastral: ${rc}<br>${b.pieces.length} ${b.pieces.length == 1 ? 'pieza' : 'piezas'} · hasta ${b.floors} ${b.floors == 1 ? 'planta' : 'plantas'} · ${Math.round(b.A)} m² de huella${b.provisional ? '<br><em>Número provisional (fuera de la zona numerada en v0.7)</em>' : ''}</div>
      <div class="bm-state" style="background:${ESTADO_COLOR[b.estado]}">${b.estado == 'acabado' ? 'Acabado' : 'Pendiente'}</div>
      <div class="bm-acts"><button class="bm-go">Ir delante</button><button class="bm-tg">${b.estado == 'acabado' ? 'Marcar pendiente' : 'Marcar acabado'}</button></div>`;
    card.querySelector('.bm-x').onclick = () => { sel = null; card.classList.add('hide'); dirty = true; };
    card.querySelector('.bm-go').onclick = () => { api.close(); goTo(b); };
    card.querySelector('.bm-tg').onclick = () => toggle(b);
  }
  const select = (b, center) => { sel = b; dirty = true; if (!b) { card.classList.add('hide'); return; } if (center) { cx = b.lab[0]; cz = b.lab[1]; s = Math.max(s, 2.5); } showCard(b); };
  const flash = t => { msg.textContent = t; msg.classList.remove('hide'); clearTimeout(flash.t); flash.t = setTimeout(() => msg.classList.add('hide'), 2500); };

  // Interacción: arrastrar, rueda, pellizco, clic
  const pts = new Map(); let moved = 0, pinch = null;
  const clampS = v => Math.max(.02, Math.min(14, v));
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size == 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; } });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { if (e.pointerType == 'mouse') { const h = at(...toWorld(e.clientX, e.clientY)); if (h != hover) { hover = h; cv.style.cursor = h ? 'pointer' : 'grab'; dirty = true; } } return; }
    const o = pts.get(e.pointerId), dx = e.clientX - o[0], dy = e.clientY - o[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size == 2 && pinch) { const [a, b] = [...pts.values()]; s = clampS(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d); }
    else if (pts.size == 1) { cx -= dx / s; cz -= dy / s; }
    dirty = true;
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (e.type == 'pointerup' && moved < 6 && pts.size == 0) { const b = at(...toWorld(e.clientX, e.clientY)); if (b && paint.checked) { toggle(b); select(b); } else select(b); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wz] = toWorld(e.clientX, e.clientY); s = clampS(s * Math.exp(-e.deltaY * .0015)); cx = wx - (e.clientX - W / 2) / s; cz = wz - (e.clientY - H / 2) / s; dirty = true; }, { passive: false });
  root.querySelector('.bm-search').onsubmit = e => { e.preventDefault(); const b = get(input.value); if (b) { select(b, true); input.blur(); } else flash(`No encuentro «${input.value}»`); };
  root.querySelector('.bm-close').onclick = () => api.close();
  root.querySelector('.bm-export').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = 'edificios.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code == 'Escape' && open) api.close();
    else if (e.code == 'KeyM' && mm.style.display == 'block') open ? api.close() : api.open();
  });
  mm.addEventListener('dblclick', () => api.open());

  // ---------- «Ir delante»: vuelo hasta el edificio y contorno parpadeante durante 12 s ----------
  let hl = [];
  function goTo(b) {
    const [lon, lat] = toLL(b.lab[0], b.lab[1]), top = b.base + b.floors * 3, d = Math.max(60, Math.sqrt(b.A) * 3);
    const [lo2, la2] = toLL(b.lab[0], b.lab[1] + d);   // d metros al sur, mirando al norte
    camera.flyTo({ destination: C.Cartesian3.fromDegrees(lo2, la2, top + d * .75), orientation: { heading: 0, pitch: C.Math.toRadians(-35), roll: 0 }, duration: 2.5 });
    hl.forEach(e => viewer.entities.remove(e)); hl = [];
    const col = C.Color.fromCssColorString(ESTADO_COLOR[b.estado]), t0 = performance.now();
    const mat = new C.ColorMaterialProperty(new C.CallbackProperty(() => { const t = (performance.now() - t0) / 1000; return col.withAlpha(t > 12 ? 0 : (.55 + .45 * Math.sin(t * 5)) * Math.min(1, (12 - t) / 2)); }, false));
    for (const p of b.pieces) {
      const h = p.base + p.f * 3 + .4, pos = C.Cartesian3.fromDegreesArrayHeights(p.r.concat([p.r[0]]).flatMap(([x, z]) => [...toLL(x, z), h]));
      hl.push(viewer.entities.add({ polyline: { positions: pos, width: 4, material: mat, depthFailMaterial: mat } }));
    }
    setTimeout(() => { hl.forEach(e => viewer.entities.remove(e)); hl = []; }, 12500);
    void lon; void lat;
  }

  const api = {
    get isOpen() { return open; },
    open(b) {
      if (open) return; open = true; root.classList.remove('hide'); resize(); counts();
      me = view(); cx = me.x; cz = me.z; s = Math.max(1.4, Math.min(3, Math.min(W, H) / 300));
      if (b) select(b, true); else if (sel) showCard(sel);
      dirty = true; requestAnimationFrame(tick);
    },
    close() { if (!open) return; open = false; root.classList.add('hide'); hover = null; },
    show(v) { mm.style.display = v ? 'block' : 'none'; if (!v) api.close(); },
    building: (lon, lat) => at(...toXZ(lon, lat)),
    get, goTo, all,
  };
  return api;
};
