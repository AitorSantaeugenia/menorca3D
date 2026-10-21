import { makeProjection } from '../core/geo.js';
// Zoom geográfico 2D: Menorca → municipio → zona. El contorno de la isla es REAL si existe
// /data/menorca/outline.json (tools/extraer_contorno_menorca.py); si no, se muestra un aviso PLACEHOLDER.
export async function playIntroMap(canvas, zone, stages) {
  // Tapar la vista 3D desde el primer instante (antes se veía un fotograma aéreo mientras se cargaba el contorno)
  canvas.style.display = 'block'; canvas.style.opacity = 1; canvas.getContext('2d').fillStyle = '#1b6f8a';
  canvas.width = innerWidth; canvas.height = innerHeight; canvas.getContext('2d').fillRect(0, 0, innerWidth, innerHeight);
  let outline = null;
  try { const r = await fetch('/data/menorca/outline.json'); if (r.ok) outline = await r.json(); } catch { /* sin contorno */ }
  const proj = makeProjection(zone.origin), geo = q => { const o = proj.toGeo(q[0], q[1]); return [o.lon, o.lat]; };
  const land = zone.landP.map(geo), roads = zone.roads.map(r => r.p.map(geo));
  canvas.style.display = 'block'; canvas.style.opacity = 1;
  const g = canvas.getContext('2d'), dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  const W = canvas.width, H = canvas.height, cosl = Math.cos(39.9 * Math.PI / 180), HOLD = 1.3, MOVE = 1.6;
  const total = stages.length * HOLD + (stages.length - 1) * MOVE, t0 = performance.now();
  return new Promise(res => {
    const frame = now => {
      const t = Math.max(0, (now - t0) / 1000), i = Math.min(stages.length - 1, Math.floor(t / (HOLD + MOVE))), loc = t - i * (HOLD + MOVE);
      const a = stages[i], b = stages[Math.min(i + 1, stages.length - 1)];
      let k = loc < HOLD ? 0 : Math.min(1, (loc - HOLD) / MOVE); k = k * k * (3 - 2 * k);
      const lon = a.lon + (b.lon - a.lon) * k, lat = a.lat + (b.lat - a.lat) * k, span = Math.exp(Math.log(a.span) + (Math.log(b.span) - Math.log(a.span)) * k);
      const sc = Math.min(W, H) / span, P = q => [W / 2 + (q[0] - lon) * sc * cosl, H / 2 - (q[1] - lat) * sc];
      const path = (pts, close) => { g.beginPath(); pts.forEach((q, j) => { const [x, y] = P(q); j ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); };
      g.fillStyle = '#1b6f8a'; g.fillRect(0, 0, W, H);
      if (outline) { g.strokeStyle = '#f3ead2'; g.lineWidth = 2 * dpr; for (const l of outline) { path(l); g.stroke(); } }
      else { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `${14 * dpr}px system-ui`; g.textAlign = 'center'; g.fillText('Contorno de Menorca pendiente (PLACEHOLDER)', W / 2, H - 40 * dpr); }
      g.fillStyle = '#ece6d6'; path(land, true); g.fill();
      if (span < .08) { g.strokeStyle = 'rgba(120,110,95,.9)'; g.lineWidth = Math.max(dpr, 6 * sc / 111000); for (const r of roads) { path(r); g.stroke(); } }
      g.fillStyle = '#fff'; g.font = `600 ${28 * dpr}px Georgia, serif`; g.textAlign = 'center'; g.fillText((k < .5 ? a : b).label, W / 2, 60 * dpr);
      const last = stages[stages.length - 1], [px, py] = P([last.lon, last.lat]);
      g.fillStyle = '#d62828'; g.beginPath(); g.arc(px, py, 7 * dpr, 0, 7); g.fill();
      if (t < total) requestAnimationFrame(frame);
      else res(() => { canvas.style.opacity = 0; setTimeout(() => { canvas.style.display = 'none'; }, 1300); });
    };
    requestAnimationFrame(frame);
  });
}
