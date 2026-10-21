import { ring } from '../core/geo.js';
import { hex } from '../world/pois.js';
import { ESTADO_COLOR } from '../world/goToBuilding.js';
// Mapa grande (doble clic en el minimapa o tecla M). Norte arriba. Muestra cada edificio en blanco con una máscara
// de su estado (verde = acabado, rojo = pendiente) y su número; permite buscar, ir delante y cambiar el estado.
const MASK = { pendiente: 'rgba(224,49,49,.55)', acabado: 'rgba(47,158,68,.7)' };
export function createBigMap({ zone, idx, pois, player, onGo, onToggle }) {
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
  // Geometría en metros, cacheada como Path2D
  const path = rr => { const p = new Path2D(); rr.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
  const land = [zone.landP, ...zone.islands.map(ring)].map(path);
  const plazas = (zone.plazas || []).map(p => path(ring(p.p)));
  for (const b of idx.all) b.path = (() => { const p = new Path2D(); for (const q of b.pieces) p.addPath(path(q.r)); return p; })();
  const roads = zone.roads.map(r => { const p = new Path2D(); r.p.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); return { p, w: Math.max(r.w || 3, 2), foot: /footway|path|steps|pedestrian/.test(r.t || '') }; });

  let W = 0, H = 0, dpr = 1, cx = 0, cz = 0, s = 1.2, sel = null, hover = null, dirty = true, open = false;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; dirty = true; };
  addEventListener('resize', () => open && resize());
  const toWorld = (px, py) => [(px - W / 2) / s + cx, (py - H / 2) / s + cz];
  const toScreen = (x, z) => [(x - cx) * s + W / 2, (z - cz) * s + H / 2];

  function draw() {
    dirty = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#a9d3e0'; g.fillRect(0, 0, W, H);
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cx * s), dpr * (H / 2 - cz * s));
    g.fillStyle = '#efebe2'; land.forEach(p => g.fill(p));
    g.fillStyle = '#ddd6cb'; plazas.forEach(p => g.fill(p));
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = '#b9b2a4'; for (const r of roads) { g.lineWidth = r.foot ? Math.max(1.2 / s, 1.4) : r.w + 1.6 / s; g.stroke(r.p); }
    g.strokeStyle = '#fff'; for (const r of roads) if (!r.foot) { g.lineWidth = r.w; g.stroke(r.p); }
    const [vx0, vz0] = toWorld(0, 0), [vx1, vz1] = toWorld(W, H), vis = [];
    for (const b of idx.all) { const [x0, x1, z0, z1] = b.box; if (x1 < vx0 || x0 > vx1 || z1 < vz0 || z0 > vz1) continue; vis.push(b);
      g.fillStyle = '#ffffff'; g.fill(b.path); g.fillStyle = MASK[b.estado] || MASK.pendiente; g.fill(b.path); }
    g.lineWidth = Math.min(.6, .8 / s); g.strokeStyle = 'rgba(40,40,40,.55)'; if (s > .8) for (const b of vis) g.stroke(b.path);
    if (sel) { g.fillStyle = 'rgba(255,212,59,.55)'; g.fill(sel.path); }
    for (const [b, c, w] of [[hover, '#ffffff', 2.5], [sel, '#ffd43b', 4]]) if (b) { g.lineWidth = w / s; g.strokeStyle = '#10343f'; g.lineWidth = (w + 2) / s; g.stroke(b.path); g.strokeStyle = c; g.lineWidth = w / s; g.stroke(b.path); }
    for (const p of pois) { g.fillStyle = hex(p.color); g.beginPath(); g.arc(p.x, p.z, 6 / s, 0, 7); g.fill(); }
    // Números (solo con zoom suficiente y si caben)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s >= 1.1) {
      g.font = `600 ${s > 3 ? 12 : 10}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      // Sin solapes: primero el seleccionado y los edificios grandes; se omite la etiqueta que choca con otra
      const fs = s > 3 ? 12 : 10, taken = new Map(), C = 24;
      const free = (x0, y0, x1, y1, put) => {
        for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(y0 / C); j <= Math.floor(y1 / C); j++)
          for (const r of taken.get(i + ',' + j) || []) if (!put && x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false;
        if (put) for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(y0 / C); j <= Math.floor(y1 / C); j++) { const k = i + ',' + j; (taken.get(k) || taken.set(k, []).get(k)).push([x0, y0, x1, y1]); }
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
    // Jugador
    const pl = player(), [px, py] = toScreen(pl.x, pl.z);
    g.save(); g.translate(px, py); g.rotate(-pl.yaw); g.fillStyle = '#1c7ed6'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  const tick = () => { if (!open) return; if (dirty) draw(); requestAnimationFrame(tick); };

  const counts = () => {
    const c = idx.counts(), st = idx.saveState();
    root.querySelector('.bm-count').textContent = `${c.acabado} de ${c.total} acabados (${(c.acabado / c.total * 100).toFixed(1)} %)`;
    const sv = root.querySelector('.bm-save');
    sv.textContent = st.pendientes ? (st.ok ? 'Guardando…' : `${st.pendientes} cambios solo en este navegador · usa Exportar`) : 'Guardado en edificios.json';
    sv.className = 'bm-save' + (st.pendientes && !st.ok ? ' warn' : '');
  };
  idx.onChange(() => { counts(); if (sel) showCard(sel); dirty = true; });

  function showCard(b) {
    card.classList.remove('hide');
    const rc = b.catastro ? `<a href="https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${b.ref.slice(0, 7)}&rc2=${b.ref.slice(7, 14)}" target="_blank" rel="noopener">${b.ref}</a>` : 'sin Catastro (OSM)';
    card.innerHTML = `<button class="bm-x" title="Cerrar">✕</button><div class="bm-n">Edificio nº ${b.n}</div>
      <div class="bm-meta">Ref. catastral: ${rc}<br>${b.pieces.length} ${b.pieces.length == 1 ? 'pieza' : 'piezas'} · hasta ${b.floors} ${b.floors == 1 ? 'planta' : 'plantas'} · ${Math.round(b.A)} m² de huella${b.provisional ? '<br><em>Número provisional: ejecuta tools/numerar_edificios.py</em>' : ''}</div>
      <div class="bm-state" style="background:${ESTADO_COLOR[b.estado]}">${b.estado == 'acabado' ? 'Acabado' : 'Pendiente'}</div>
      <div class="bm-acts"><button class="bm-go">Ir delante</button><button class="bm-tg">${b.estado == 'acabado' ? 'Marcar pendiente' : 'Marcar acabado'}</button></div>`;
    card.querySelector('.bm-x').onclick = () => { sel = null; card.classList.add('hide'); dirty = true; };
    card.querySelector('.bm-go').onclick = () => { api.close(); onGo(b); };
    card.querySelector('.bm-tg').onclick = () => onToggle(b);
  }
  const select = (b, center) => { sel = b; dirty = true; if (!b) { card.classList.add('hide'); return; } if (center) { cx = b.lab[0]; cz = b.lab[1]; s = Math.max(s, 2.5); } showCard(b); };
  const flash = t => { msg.textContent = t; msg.classList.remove('hide'); clearTimeout(flash.t); flash.t = setTimeout(() => msg.classList.add('hide'), 2500); };

  // Interacción: arrastrar, rueda, pellizco, clic
  const pts = new Map(); let moved = 0, pinch = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (pts.size == 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; } });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { if (e.pointerType == 'mouse') { const h = idx.at(...toWorld(e.clientX, e.clientY)); if (h != hover) { hover = h; cv.style.cursor = h ? 'pointer' : 'grab'; dirty = true; } } return; }
    const o = pts.get(e.pointerId), dx = e.clientX - o[0], dy = e.clientY - o[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size == 2 && pinch) { const [a, b] = [...pts.values()]; s = clampS(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d); }
    else if (pts.size == 1) { cx -= dx / s; cz -= dy / s; }
    dirty = true;
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (e.type == 'pointerup' && moved < 6 && pts.size == 0) {
      const b = idx.at(...toWorld(e.clientX, e.clientY));
      if (b && paint.checked) { onToggle(b); select(b); } else select(b);
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const clampS = v => Math.max(.12, Math.min(14, v));
  cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wz] = toWorld(e.clientX, e.clientY); s = clampS(s * Math.exp(-e.deltaY * .0015)); cx = wx - (e.clientX - W / 2) / s; cz = wz - (e.clientY - H / 2) / s; dirty = true; }, { passive: false });
  root.querySelector('.bm-search').onsubmit = e => {
    e.preventDefault(); const b = idx.get(input.value);
    if (b) { select(b, true); input.blur(); } else flash(`No encuentro «${input.value}»`);
  };
  root.querySelector('.bm-close').onclick = () => api.close();
  root.querySelector('.bm-export').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([idx.exportJSON()], { type: 'application/json' })); a.download = 'edificios.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  addEventListener('keydown', e => { if (open && e.code == 'Escape') api.close(); });

  const api = {
    get isOpen() { return open; },
    open(b) {
      if (open) return; open = true; root.classList.remove('hide'); resize(); counts();
      const p = player(); cx = p.x; cz = p.z; s = Math.max(1.4, Math.min(3, Math.min(W, H) / 300));   // con zoom suficiente para ver los números
      if (b) select(b, true); else if (sel) showCard(sel);
      dirty = true; requestAnimationFrame(tick);
    },
    close() { if (!open) return; open = false; root.classList.add('hide'); hover = null; api.onClose && api.onClose(); },
    select(b) { select(b, true); },
    onClose: null,
  };
  return api;
}
