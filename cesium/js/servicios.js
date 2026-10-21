// Capas del visor (botón «Capas» bajo el minimapa, al estilo del IDE Menorca), capa «Servicios» con fichas y horarios,
// y la línea de bus L02 (TMSA): ruta, horarios de la parada y, si el visor se abre con pipeline/servidor.py, la
// posición de los autobuses en directo (TMSA no permite pedirla directamente desde otra web: hace falta ese proxy).
// Sin ese proxy (p. ej. en GitHub Pages) se muestra la posición ESTIMADA según el horario.
window.createServicios = function ({ C, viewer, ground, toggles, border = [] }) {
  const $ = id => document.getElementById(id), scene = viewer.scene;
  const S = window.SERVICIOS || [], BUS = window.BUS_L02 || null;
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const pad = n => String(n).padStart(2, '0'), hm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const mins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const now = () => { const d = new Date(); return { d, dow: d.getDay() || 7, m: d.getHours() * 60 + d.getMinutes() }; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Iconos (SVG propios, sin marcas) ----------
  const GLYPH = {
    ayuntamiento: '<path d="M8 22h16M9 20v-7m4 7v-7m6 7v-7m4 7v-7M7 12l9-5 9 5z" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    iglesia: '<path d="M16 6v14M11 11h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
    policia: '<path d="M16 6l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V9z" fill="#fff"/>',
    biblioteca: '<path d="M8 9c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M16 10v12" stroke="#fff" stroke-width="2"/>',
    correos: '<rect x="7" y="10" width="18" height="12" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M7.5 11l8.5 6 8.5-6" fill="none" stroke="#fff" stroke-width="2"/>',
    salud: '<path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#fff"/>',
    hospital: '<path d="M10 8v16M22 8v16M10 16h12" stroke="#fff" stroke-width="3.2"/>',
    farmacia: '<rect x="7.5" y="7.5" width="17" height="17" rx="3" fill="#fff"/><path d="M14 10h4v4h4v4h-4v4h-4v-4h-4v-4h4z" fill="#1f9d55"/>',
    museo: '<path d="M7 13l9-5 9 5zM8 23h16M8 25h16" stroke="#fff" stroke-width="1.8" fill="#fff" stroke-linejoin="round"/><path d="M10 14.5v7m4-7v7m4-7v7m4-7v7" stroke="#fff" stroke-width="2"/>',
    bus: '<rect x="9" y="7" width="14" height="15" rx="2.5" fill="#fff"/><rect x="11" y="9.5" width="10" height="5" rx="1" fill="#1f5fa8"/><circle cx="12.5" cy="18.5" r="1.3" fill="#1f5fa8"/><circle cx="19.5" cy="18.5" r="1.3" fill="#1f5fa8"/><path d="M11 22v2m10-2v2" stroke="#fff" stroke-width="2"/>',
  };
  const COLOR = { ayuntamiento: '#912033', iglesia: '#6b4c9a', policia: '#1d3f73', biblioteca: '#c66a12', correos: '#c99a00', salud: '#2f9e44', hospital: '#d62828', museo: '#7a4e2d', farmacia: '#1f9d55', bus: '#1f5fa8' };
  // Icono: chincheta redonda grande con borde blanco grueso, aro oscuro fino para que destaque sobre fondos claros,
  // palo hasta el suelo y sombra en el suelo (se lee bien sobre ortofoto, tejados y de noche)
  const icon = t => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 48 64">` +
    `<ellipse cx="24" cy="60.5" rx="7" ry="2.5" fill="#000" fill-opacity=".35"/>` +
    `<path d="M24 40v19" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 40v19" stroke="${COLOR[t]}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="24" cy="22" r="19.5" fill="#0b1f2a" fill-opacity=".55"/>` +
    `<circle cx="24" cy="22" r="18" fill="#fff"/><circle cx="24" cy="22" r="14.5" fill="${COLOR[t]}"/>` +
    `<g transform="translate(8 6)">${GLYPH[t]}</g></svg>`);

  // Frontera del municipio (lon/lat planos) para saber qué tramos y paradas son de Es Castell
  const pipLL = (x, y, f) => { let c = false; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const inCastell = (lon, lat) => !border.length || border.some(r => pipLL(lon, lat, r));
  // Todas las paradas de la L02 que están en Es Castell también son «servicios» (con su ficha y horarios)
  if (BUS) for (const [code, st] of Object.entries(BUS.stops)) {
    if (!inCastell(st.ll[1], st.ll[0])) continue;
    const ya = S.find(x => x.bus && (x.code || BUS.paradaVisor) == code);
    if (ya) { ya.code = code; continue; }
    S.push({ id: 'bus' + code, tipo: 'bus', nombre: `Parada ${st.n} (L02)`, ll: st.ll, h: 4.5, bus: true, code, fuente: BUS.web });
  }
  const bills = scene.primitives.add(new C.BillboardCollection());
  const labels = scene.primitives.add(new C.LabelCollection());
  for (const s of S) {
    const pos = C.Cartesian3.fromDegrees(s.ll[1], s.ll[0], ground(s.ll[1], s.ll[0]) + s.h);
    s.bb = bills.add({ position: pos, image: icon(s.tipo), width: 42, height: 56, verticalOrigin: C.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new C.NearFarScalar(300, 1.1, 20000, .6),
      distanceDisplayCondition: new C.DistanceDisplayCondition(0, 30000), id: { servicio: s } });
    labels.add({ position: pos, text: s.nombre, font: '600 12px system-ui', fillColor: C.Color.WHITE, style: C.LabelStyle.FILL,
      showBackground: true, backgroundColor: C.Color.fromCssColorString('#10343f').withAlpha(.82), backgroundPadding: new C.Cartesian2(7, 4),
      pixelOffset: new C.Cartesian2(0, -62), verticalOrigin: C.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 1800), id: { servicio: s } });
  }
  bills.show = labels.show = false;

  // ---------- Horarios: ¿abierto ahora? ----------
  function estado(s) {
    const { dow, m } = now();
    if (s.misas) {
      const hoy = s.misas.filter(x => x.dias.includes(dow)).flatMap(x => x.horas).map(mins).filter(t => t >= m).sort((a, b) => a - b);
      return hoy.length ? { txt: `Próxima misa hoy a las ${hm(hoy[0])}`, cls: 'ok' } : { txt: 'Hoy ya no hay más misas', cls: 'off' };
    }
    if (!s.horario) return null;
    const d = now().d;
    if (s.mesesCerrado && s.mesesCerrado.includes(d.getMonth() + 1)) return { txt: 'Cerrado este mes', cls: 'off' };
    // ultimo: solo el último día de ese tipo del mes (p. ej. último sábado)
    const ultimo = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const tr = s.horario.filter(x => x.dias.includes(dow) && (!x.ultimo || ultimo)).flatMap(x => x.tramos).map(([a, b]) => [mins(a), mins(b)]);
    const abierto = tr.find(([a, b]) => m >= a && m < b);
    if (abierto) return { txt: abierto[1] >= 1440 ? 'Abierto ahora (24 h)' : `Abierto ahora · cierra a las ${hm(abierto[1])}`, cls: 'ok' };
    const luego = tr.filter(([a]) => a > m).sort((x, y) => x[0] - y[0])[0];
    return { txt: luego ? `Cerrado ahora · abre hoy a las ${hm(luego[0])}` : 'Cerrado ahora', cls: 'off' };
  }

  // ---------- Bus L02: horarios expandidos ----------
  const tipoDia = dow => dow == 7 ? 'dom' : dow == 6 ? 'sab' : 'lv';
  const NOMBRE_DIA = { lv: 'Lunes a viernes', sab: 'Sábados', dom: 'Domingos y festivos' };
  function salidas(sent, tipo) {   // [[min por parada…], …] una fila por expedición
    const H = sent.horarios[tipo], base = [];
    for (const b of H.base) if (typeof b == 'string') base.push(mins(b)); else for (let t = mins(b.from); t <= mins(b.to); t += b.step) base.push(t);
    return base.map((t, i) => (i == 0 && H.off0 ? H.off0 : H.off).map(o => t + o));
  }
  const RESTR = { s: 'solo subida', b: 'solo bajada' };

  // Ruta en el mapa. Capa «Ruta del bus L02»: el tramo de Es Castell. Al abrir la ficha de una parada: la ruta completa
  // hasta Maó con todas sus paradas. Las líneas van 1,5 m por encima del relieve (no «pegadas» al suelo: así no
  // desaparecen donde el visor no tiene modelos ni donde cambia la malla del relieve) y se ven aunque algo las tape.
  const routeLocal = new C.CustomDataSource('busCastell'), route = new C.CustomDataSource('bus');
  viewer.dataSources.add(routeLocal); viewer.dataSources.add(route); route.show = routeLocal.show = false;
  if (BUS) {
    const col = { 1: '#1f6fd1', 2: '#36b3e0' };
    const dens = pts => { const o = []; for (let i = 0; i < pts.length; i++) { const [la, lo] = pts[i];
      if (i) { const [la0, lo0] = pts[i - 1], n = Math.ceil(Math.hypot((lo - lo0) * 85500, (la - la0) * 111000) / 15); for (let k = 1; k < n; k++) o.push([la0 + (la - la0) * k / n, lo0 + (lo - lo0) * k / n]); }
      o.push([la, lo]); } return o; };
    const line = (ds, pts, k) => ds.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(pts.flatMap(([la, lo]) => [lo, la, ground(lo, la) + 1.5])), width: k == 1 ? 6 : 4,
      material: new C.PolylineOutlineMaterialProperty({ color: C.Color.fromCssColorString(col[k]), outlineColor: C.Color.WHITE, outlineWidth: 1.5 }),
      depthFailMaterial: new C.ColorMaterialProperty(C.Color.fromCssColorString(col[k]).withAlpha(.45)) } });
    for (const k of [1, 2]) {
      const pts = dens(BUS.ruta[k]); line(route, pts, k);
      let run = [];   // tramos dentro de Es Castell
      for (const q of pts) { if (inCastell(q[1], q[0])) run.push(q); else { if (run.length > 1) line(routeLocal, run, k); run = []; } }
      if (run.length > 1) line(routeLocal, run, k);
    }
    for (const [code, st] of Object.entries(BUS.stops)) route.entities.add({ position: C.Cartesian3.fromDegrees(st.ll[1], st.ll[0], ground(st.ll[1], st.ll[0]) + 2),
      point: { pixelSize: code == BUS.paradaVisor ? 12 : 8, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#1f5fa8'), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: st.n, font: '600 11px system-ui', fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#1f5fa8'), outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new C.Cartesian2(0, -16), disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 6000) } });
  }
  // ---------- Autobuses ahora ----------
  // 1) EN DIRECTO (REAL): posición de TMSA a través de un intermediario. En local, pipeline/servidor.py (/tmsa/...).
  //    Para otro servicio (p. ej. un Worker en la nube), basta con definir antes de este script:
  //      window.MENORCA_BUS_DIRECTO = 'https://…/posicion/602/{sentido}'
  // 2) Si no hay intermediario (p. ej. GitHub Pages): posición ESTIMADA según el horario (bus_l02.js): por cada
  //    expedición en ruta, el punto del recorrido que corresponde a la hora actual, sin retrasos.
  const LIVE_URL = window.MENORCA_BUS_DIRECTO || '/tmsa/posicion/602/{sentido}';
  const live = new C.CustomDataSource('busLive'); viewer.dataSources.add(live);
  let liveTimer = null, liveOK = null, liveData = [], liveAt = 0, liveInfo = '';

  // Recorrido de cada sentido en metros y distancia de cada parada a lo largo de él (paradas en orden)
  const R = {};
  if (BUS) for (const sent of BUS.sentidos) {
    const pts = BUS.ruta[sent.id] || [], cum = [0], KX = 111320 * Math.cos(39.88 * Math.PI / 180), KY = 110540;
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot((pts[i][1] - pts[i - 1][1]) * KX, (pts[i][0] - pts[i - 1][0]) * KY));
    let from = 0;
    const dStop = sent.stops.map(code => {   // proyección de la parada sobre el recorrido, siempre hacia delante
      const [la, lo] = BUS.stops[code].ll; let best = Infinity, bd = cum[from];
      for (let i = from; i < pts.length - 1; i++) {
        const ax = pts[i][1] * KX, ay = pts[i][0] * KY, bx = pts[i + 1][1] * KX, by = pts[i + 1][0] * KY, px = lo * KX, py = la * KY;
        const L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = L2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2)) : 0;
        const dd = Math.hypot(ax + (bx - ax) * t - px, ay + (by - ay) * t - py);
        if (dd < best - .5) { best = dd; bd = cum[i] + Math.sqrt(L2) * t; from = i; }
      }
      return bd;
    });
    R[sent.id] = { pts, cum, dStop };
  }
  const enRuta = (k, dist) => {   // punto del recorrido a «dist» metros del inicio
    const { pts, cum } = R[k]; let i = 1; while (i < cum.length - 1 && cum[i] < dist) i++;
    const f = cum[i] > cum[i - 1] ? Math.max(0, Math.min(1, (dist - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 0;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  };
  function estimados() {
    if (!BUS) return [];
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, tipo = tipoDia(d.getDay() || 7), out = [];
    for (const sent of BUS.sentidos) {
      const r = R[sent.id]; if (!r || r.pts.length < 2) continue;
      for (const row of salidas(sent, tipo)) {
        if (m < row[0] || m > row[row.length - 1]) continue;
        // El horario da minutos enteros y varias paradas comparten minuto: se interpola por distancia entre la primera
        // parada de cada minuto distinto (y la última), así el autobús avanza sin saltos.
        const anc = []; row.forEach((t, i) => { if (!anc.length || t > anc[anc.length - 1][0]) anc.push([t, r.dStop[i]]); });
        anc.push([row[row.length - 1], r.dStop[row.length - 1]]);
        let j = 1; while (j < anc.length - 1 && anc[j][0] < m) j++;
        const [t0, d0] = anc[j - 1], [t1, d1] = anc[j], dist = d0 + (d1 - d0) * (t1 > t0 ? (m - t0) / (t1 - t0) : 1);
        let sig = sent.stops.findIndex((_, i) => r.dStop[i] > dist + 5); if (sig < 0) sig = sent.stops.length - 1;
        const iv = sent.stops.indexOf(BUS.paradaVisor);
        out.push({ k: sent.id, sentido: sent.nombre, salida: row[0], ll: enRuta(sent.id, dist), siguiente: BUS.stops[sent.stops[sig]].n,
          anterior: sig > 0 ? BUS.stops[sent.stops[sig - 1]].n : null, llegaVisor: iv >= 0 && row[iv] >= m ? row[iv] : null, fin: row[row.length - 1] });
      }
    }
    return out;
  }
  const busEntity = (lon, lat, texto, estimado) => live.entities.add({ position: C.Cartesian3.fromDegrees(lon, lat, ground(lon, lat) + 3),
    billboard: { image: icon('bus'), width: 28, height: 35, verticalOrigin: C.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY,
      color: estimado ? C.Color.WHITE.withAlpha(.8) : C.Color.WHITE },
    label: { text: texto, font: '600 11px system-ui', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -40), disableDepthTestDistance: Number.POSITIVE_INFINITY } });
  async function pollLive() {
    // En directo: cada 20 s mientras funcione; si el primer intento falla (sin intermediario), ya no se vuelve a pedir
    if (liveOK !== false && Date.now() - liveAt > 19000) {
      liveAt = Date.now(); const out = []; let ok = false;
      for (const k of [1, 2]) {
        try { const r = await fetch(LIVE_URL.replace('{sentido}', k), { cache: 'no-store' }); if (!r.ok) throw 0; out.push(...(await r.json()).map(b => ({ ...b, k }))); ok = true; }
        catch { /* sin intermediario o sin conexión */ }
      }
      if (ok) { liveOK = true; liveData = out; } else if (liveOK == null) liveOK = false;
    }
    live.entities.removeAll();
    if (liveOK) {
      for (const b of liveData) busEntity(+b.lon, +b.lat, `Bus ${b.bus_id} · ${b.k == 1 ? '→ Es Castell' : '→ Maó'}`, false);
      liveInfo = liveData.length ? liveData.map(b => `<li>Bus ${esc(b.bus_id)} (${b.k == 1 ? 'hacia Es Castell' : 'hacia Maó'}, salida ${esc(b.viaje)}): próxima parada <b>${esc(b.parada_siguiente_nombre || '—')}</b> · ${esc(b.retraso || '')} <small>(${esc(b.hora_posicion || '')})</small></li>`).join('')
        : '<li>Ahora mismo no hay ningún autobús de la L02 en ruta.</li>';
      liveInfo = '<li class="k sm">EN DIRECTO (TMSA)</li>' + liveInfo;
    } else if (liveOK === false) {
      const E = estimados(), m = new Date().getHours() * 60 + new Date().getMinutes();
      for (const e of E) busEntity(e.ll[1], e.ll[0], `≈ ${e.k == 1 ? '→ Es Castell' : '→ Maó'} (${hm(e.salida)})`, true);
      liveInfo = '<li class="k sm">ESTIMADO según el horario: sin retrasos ni incidencias</li>' + (E.length ? E.map(e => `<li><b>${esc(e.sentido)}</b> (salida ${hm(e.salida)}): `
        + (e.anterior ? `entre ${esc(e.anterior)} y <b>${esc(e.siguiente)}</b>` : `en <b>${esc(e.siguiente)}</b>`)
        + (e.llegaVisor != null ? ` · en Es Castell (Església) ${e.llegaVisor - m <= 0 ? 'ahora' : `en ${e.llegaVisor - m} min`}` : ` · llega a las ${hm(e.fin)}`) + '</li>').join('')
        : '<li>Según el horario, ahora mismo no hay ningún autobús de la L02 en ruta.</li>');
    } else liveInfo = '<li class="k">Consultando…</li>';
    const el = $('busLive'); if (el) el.innerHTML = liveInfo;
  }
  const startLive = () => { if (liveTimer) return; pollLive(); liveTimer = setInterval(pollLive, 5000); };
  const stopLive = () => { clearInterval(liveTimer); liveTimer = null; live.entities.removeAll(); };

  // ---------- Panel de información ----------
  const panel = $('info');
  const close = () => { panel.style.display = 'none'; route.show = false; routeLocal.show = !!layerOn.ruta; stopLive(); };
  function abrir(s) {
    if (!(s.bus && BUS)) { route.show = false; routeLocal.show = !!layerOn.ruta; stopLive(); }
    let h = `<button class="ix" title="Cerrar">✕</button><div class="ih"><img src="${icon(s.tipo)}" alt=""><b>${esc(s.nombre)}</b></div>`;
    if (s.dir) h += `<div class="k">${esc(s.dir)}</div>`;
    if (s.tel) h += `<div>☎ ${esc(s.tel)}</div>`;
    if (s.mail) h += `<div>✉ <a href="mailto:${esc(s.mail)}">${esc(s.mail)}</a></div>`;
    if (s.web) h += `<div>🌐 <a href="${esc(s.web)}" target="_blank" rel="noopener">${esc(new URL(s.web).hostname.replace(/^www\./, ''))}</a></div>`;
    if (s.bus && BUS) h += busHTML(s.code || BUS.paradaVisor); else {
      const e = estado(s); if (e) h += `<div class="est ${e.cls}">${esc(e.txt)}</div>`;
      if (s.horarioTxt) h += '<div class="it">Horario</div><ul>' + s.horarioTxt.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>';
      if (s.horario || s.misas) h += '<div class="k sm">«Abierto ahora» según la hora de tu ordenador; no tiene en cuenta los festivos.</div>';
    }
    h += `<div class="k sm">Fuente: <a href="${esc(s.fuente)}" target="_blank" rel="noopener">${esc(new URL(s.fuente).hostname)}</a></div>`;
    panel.innerHTML = h; panel.style.display = 'block'; panel.scrollTop = 0;
    panel.querySelector('.ix').onclick = close;
    if (s.bus && BUS) {
      route.show = true; routeLocal.show = false; startLive();
      panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { panel.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x == b)); panel.querySelectorAll('.tt').forEach(t => t.style.display = t.dataset.t == b.dataset.tab ? 'block' : 'none'); });
    }
  }
  function busHTML(P) {
    const { dow, m, d } = now(), tipo = tipoDia(dow);
    let h = `<div class="busl"><span class="lin">${BUS.linea}</span> ${esc(BUS.nombre)} · ${esc(BUS.operador)} · ${esc(BUS.tarifa)} · ${esc(BUS.duracion)}</div>`;
    h += `<div class="it">Próximos autobuses en esta parada · hoy (${DIAS[d.getDay()]}, horario de ${NOMBRE_DIA[tipo].toLowerCase()})</div>`;
    for (const sent of BUS.sentidos) {
      const i = sent.stops.indexOf(P); if (i < 0) continue;
      const r = sent.restr[P];
      const next = salidas(sent, tipo).map(row => row[i]).filter(t => t >= m).slice(0, 4);
      h += `<div><b>${esc(sent.nombre)}</b>${r ? ` <small class="k">(${RESTR[r]})</small>` : ''}: ${next.length ? next.map(hm).join(' · ') : 'no hay más hoy'}</div>`;
    }
    h += `<div class="it">Autobuses ahora</div><ul id="busLive">${liveInfo || '<li class="k">Consultando…</li>'}</ul>`;
    h += '<div class="it">Recorrido y horarios completos</div><div class="tabs">' + ['lv', 'sab', 'dom'].map(t => `<button data-tab="${t}" class="${t == tipo ? 'on' : ''}">${NOMBRE_DIA[t]}</button>`).join('') + '</div>';
    for (const t of ['lv', 'sab', 'dom']) {
      h += `<div class="tt" data-t="${t}" style="display:${t == tipo ? 'block' : 'none'}">`;
      for (const sent of BUS.sentidos) {
        const rows = salidas(sent, t);
        h += `<div class="ts">${esc(sent.nombre)}</div><div class="tw"><table><tr>${sent.stops.map(c => `<th class="${c == P ? 'me' : ''}">${esc(BUS.stops[c].n)}${sent.restr[c] ? `<br><small>${RESTR[sent.restr[c]]}</small>` : ''}</th>`).join('')}</tr>`;
        h += rows.map(row => `<tr>${row.map((v, j) => `<td class="${sent.stops[j] == P ? 'me' : ''}">${hm(v)}</td>`).join('')}</tr>`).join('') + '</table></div>';
      }
      h += '</div>';
    }
    h += `<div class="k sm">${esc(BUS.validez)}. ${esc(BUS.aviso)}</div>`;
    return h;
  }

  // ---------- Panel de capas ----------
  const CAPAS = [
    { id: 'servicios', nombre: 'Servicios (ayuntamiento, iglesia, salud, paradas de bus…)', on: true },
    { id: 'ruta', nombre: 'Ruta del bus L02 en Es Castell (clic en una parada: ruta completa)', on: true },
    { id: 'calle', nombre: 'Detalle de calle (aceras, árboles, muros…)', on: true },
    { id: 'frontera', nombre: 'Frontera del municipio', on: true },
    { id: 'faros', nombre: 'Faros y balizas', on: true },
    { id: 'luces', nombre: 'Luces de noche (focos del campo de fútbol, cruz de la farmacia)', on: true },
    { id: 'mar', nombre: 'Mar animado', on: true },
  ];
  const layerOn = {};
  const set = (id, v) => {
    layerOn[id] = v;
    if (id == 'servicios') bills.show = labels.show = v;
    else if (id == 'ruta') { if (!route.show) routeLocal.show = v; }
    else toggles[id] && toggles[id](v);
  };
  const lp = $('layers');
  lp.innerHTML = '<div class="lt">Capas</div>' + CAPAS.map(c => `<label><input type="checkbox" data-id="${c.id}" ${c.on ? 'checked' : ''}> ${esc(c.nombre)}</label>`).join('');
  lp.querySelectorAll('input').forEach(i => i.onchange = () => set(i.dataset.id, i.checked));
  CAPAS.forEach(c => set(c.id, c.on));
  $('btnLayers').onclick = () => { lp.style.display = lp.style.display == 'block' ? 'none' : 'block'; };
  // Capas que solo se ven de noche: de día no se muestran en el panel (conservan si estaban marcadas o no)
  const SOLO_NOCHE = ['faros', 'luces'];
  const setNoche = n => { for (const id of SOLO_NOCHE) { const i = lp.querySelector(`input[data-id="${id}"]`); if (i) i.closest('label').style.display = n ? '' : 'none'; } };

  // Clic en un icono de servicio o en la marquesina de la parada
  const busPos = BUS ? BUS.stops[BUS.paradaVisor].ll : null;
  const api = {
    pick(p, lonlat) {
      if (p && p.id && p.id.servicio) { abrir(p.id.servicio); return true; }
      // con una ficha abierta, un clic en cualquier otro sitio del mapa la cierra (como la ✕) y no hace nada más
      const abierta = panel.style.display == 'block';
      if (busPos && lonlat) {   // clic sobre la marquesina (modelo 3D): a menos de ~6 m de la parada
        const dx = (lonlat[0] - busPos[1]) * 85500, dy = (lonlat[1] - busPos[0]) * 111000;
        if (Math.hypot(dx, dy) < 6) { abrir(S.find(s => s.bus && s.code == BUS.paradaVisor) || S.find(s => s.bus)); return true; }
      }
      if (abierta) { close(); return true; }
      return false;
    },
    close, abrir, set, setNoche,
  };
  return api;
};
