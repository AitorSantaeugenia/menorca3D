// Menorca 3D · prueba con CesiumJS.
// Capas: ortofoto PNOA (IGN, servicio WMTS en directo) · relieve MDT IGN (zona de Es Castell) · edificios del Catastro
// extruidos · calles y faros de OSM · intro nocturna con vuelo hasta Es Castell.
// Estado de cada dato: ver ../README.md (REAL · ESTIMADO · PROCEDURAL · PLACEHOLDER).
(function () {
  const $ = id => document.getElementById(id);
  const fail = msg => { $('loader').classList.add('err'); $('lmsg').textContent = msg; };
  if (!window.Cesium) return fail('No se ha podido cargar CesiumJS desde internet (cdn.jsdelivr.net). Comprueba la conexión y recarga.');
  if (!window.MENORCA_DATA) return fail('Falta data/es-castell.js. Genéralo con: python pipeline/preparar_cesium.py');
  const C = Cesium, D = window.MENORCA_DATA;

  // ---------- Relieve: MDT del IGN remuestreado a 10 m (zona de Es Castell). Fuera: nivel del mar (PLACEHOLDER) ----------
  // Alturas ORTOMÉTRICAS usadas directamente como elipsoidales: coherente mientras todo salga de este mismo MDT.
  // Dos mallas: 5 m en la zona detallada de v0.7 (prioridad, es donde se calcularon sus modelos) y 10 m en el municipio.
  const T = D.terrain, O = D.origin;
  const ISLA = window.MENORCA_ISLA ? { ...window.MENORCA_ISLA, HH: new Int16Array(Uint8Array.from(atob(window.MENORCA_ISLA.h), c => c.charCodeAt(0)).buffer) } : null;
  const grids = [D.terrain_fino, T].filter(Boolean).map(G => ({ ...G, HH: new Int16Array(Uint8Array.from(atob(G.h), c => c.charCodeAt(0)).buffer) }));
  const ground = (lon, lat, terreno = false) => {
    const x = (lon - O.lon) * T.kx, z = -(lat - O.lat) * T.kz;
    for (const G of grids) {
      const u = (x - G.x0) / G.step, v = (z - G.z0) / G.step;
      if (!(u >= 0 && v >= 0 && u < G.cols - 1 && v < G.rows - 1)) continue;
      const i = u | 0, j = v | 0, fu = u - i, fv = v - j, h = (a, b) => G.HH[b * G.cols + a] / 10;
      const y = (h(i, j) * (1 - fu) + h(i + 1, j) * fu) * (1 - fv) + (h(i, j + 1) * (1 - fu) + h(i + 1, j + 1) * fu) * fv;
      // Superficie del visor en el municipio: 25 cm por debajo del MDT. Las calzadas, aceras y plazas de v0.7 van
      // 5–12 cm sobre el MDT; Cesium interpola el relieve con triángulos (v0.7, bilineal) y sin este margen asomaría
      // el terreno a trozos por encima del pavimento. Los edificios arrancan 30 cm bajo el MDT: siguen enterrados.
      return Math.max(0, y - (terreno ? .25 : 0));
    }
    // Resto de Menorca: data/isla.js (pipeline/preparar_terreno_isla.py) si existe; si no, plano a 0 m (PLACEHOLDER)
    if (ISLA) {
      const [E, N] = toUTM31(lon, lat), u = (E - ISLA.x0) / ISLA.step, v = (ISLA.y0 - N) / ISLA.step;
      if (u >= 0 && v >= 0 && u < ISLA.cols - 1 && v < ISLA.rows - 1) {
        const i = u | 0, j = v | 0, fu = u - i, fv = v - j, h = (a, b) => ISLA.HH[b * ISLA.cols + a] / 10;
        return Math.max(0, (h(i, j) * (1 - fu) + h(i + 1, j) * fu) * (1 - fv) + (h(i, j + 1) * (1 - fu) + h(i + 1, j + 1) * fu) * fv);
      }
    }
    return 0;
  };
  const toLonLat = (x, z) => [O.lon + x / T.kx, O.lat - z / T.kz];
  const [gW, gN] = toLonLat(T.x0, T.z0), [gE, gS] = toLonLat(T.x0 + (T.cols - 1) * T.step, T.z0 + (T.rows - 1) * T.step);
  // Zona con relieve: el municipio o, si hay data/isla.js, toda Menorca (lon 3,79–4,33, lat 39,80–40,10)
  const GRID = ISLA ? C.Rectangle.fromDegrees(3.74, 39.76, 4.36, 40.12) : C.Rectangle.fromDegrees(gW, gS, gE, gN);
  const tiling = new C.GeographicTilingScheme(), TS = 32, SEABED = -4;
  const terrainProvider = new C.CustomHeightmapTerrainProvider({
    width: TS, height: TS, tilingScheme: tiling, credit: 'Relieve: MDT © Instituto Geográfico Nacional',
    callback(x, y, level) {
      const r = tiling.tileXYToRectangle(x, y, level), out = new Float32Array(TS * TS);
      if (!C.Rectangle.intersection(r, GRID)) return out.fill(SEABED);
      const w = C.Math.toDegrees(r.west), e = C.Math.toDegrees(r.east), n = C.Math.toDegrees(r.north), s = C.Math.toDegrees(r.south);
      // El mar (altura 0) se hunde 4 m: así la lámina de agua animada (más abajo) lo tapa sin parpadeos de profundidad.
      for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const y = ground(w + (e - w) * i / (TS - 1), n - (n - s) * j / (TS - 1), true); out[j * TS + i] = y > .05 ? y : SEABED; }
      return out;
    },
  });

  // ---------- Ortofoto PNOA máxima actualidad (IGN). Licencia del servicio: CC BY 4.0 scne.es ----------
  const pnoa = new C.WebMapTileServiceImageryProvider({
    url: 'https://www.ign.es/wmts/pnoa-ma', layer: 'OI.OrthoimageCoverage', style: 'default', format: 'image/jpeg',
    tileMatrixSetID: 'GoogleMapsCompatible', maximumLevel: 19,
    credit: new C.Credit('Ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0 scne.es)'),
  });
  // El servidor del IGN devuelve a veces 504 (tiempo agotado) si recibe muchas teselas a la vez; la respuesta de
  // error no lleva cabecera CORS y Chrome lo muestra como «blocked by CORS policy». Remedio: menos peticiones
  // simultáneas y reintentar cada tesela fallida hasta 4 veces (mientras, Cesium muestra la tesela de nivel superior).
  C.RequestScheduler.requestsByServer['www.ign.es:443'] = 6;
  pnoa.errorEvent.addEventListener(err => { if (err.timesRetried < 4) err.retry = true; });
  // La teselación WMTS del IGN no es PNOA en los niveles bajos: hasta el nivel 13 sirve un mosaico de satélite más verde,
  // y al acercarse cambia de golpe al PNOA. Por eso el PNOA del IGN solo se dibuja de cerca (relieve nivel ≥ 13, que
  // corresponde a teselas IGN de nivel 14) y, por debajo, la ortofoto del Govern balear (IDEIB, «Orto 2024», la misma
  // ortofoto PNOA a todas las escalas), que se pide por WMS en lon/lat.
  const ortho = new C.ImageryLayer(pnoa, { minimumTerrainLevel: 13 });
  const goib = new C.ImageryLayer(new C.WebMapServiceImageryProvider({
    url: 'https://ideib.caib.es/geoserveis/services/imatges/GOIB_Orto_IB/MapServer/WMSServer', layers: '0',
    parameters: { format: 'image/jpeg', transparent: false, styles: '' }, rectangle: C.Rectangle.fromDegrees(3.6, 39.6, 4.6, 40.2), maximumLevel: 17,
    credit: new C.Credit('Ortofoto: Govern de les Illes Balears · IDEIB (Orto 2024, PNOA © scne.es)') }));
  const orthoLayers = [goib, ortho];

  // ---------- Modo ligero ----------
  // Se activa solo en móviles, tablets, televisores y equipos con poca memoria; ?ligero=1 lo fuerza y ?ligero=0 lo quita.
  const LIGERO = (() => {
    const q = new URLSearchParams(location.search).get('ligero'); if (q == '1') return true; if (q == '0') return false;
    const ua = navigator.userAgent || '';
    return /Mobi|Android|iPhone|iPad|iPod|SmartTV|SMART-TV|Web0S|webOS|NetCast|Tizen|HbbTV|CrKey|AFT|BRAVIA|Viera/i.test(ua)
      || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  })();
  if (LIGERO) console.info('Menorca 3D: modo ligero (?ligero=0 para desactivarlo)');
  let viewer;
  try {
    viewer = new C.Viewer('cesium', {
      baseLayer: goib, terrainProvider, baseLayerPicker: false, geocoder: false, timeline: false, animation: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false,
      infoBox: false, selectionIndicator: false,
    });
  } catch (err) { return fail('Tu navegador no ha podido iniciar WebGL: ' + err.message); }
  const scene = viewer.scene, globe = scene.globe, camera = viewer.camera;
  viewer.imageryLayers.add(ortho);
  // Minimapa y mapa grande de edificios (js/maps.js, como en v0.7)
  const maps = createMaps({ C, viewer, D, ISLA, ground });
  globe.baseColor = C.Color.fromCssColorString('#0b2236');      // si la ortofoto no carga, mar azul oscuro
  globe.depthTestAgainstTerrain = true;
  // Carga: más teselas en caché (la órbita de la intro no vuelve a pedir las mismas) y precarga de las vecinas
  globe.tileCacheSize = LIGERO ? 150 : 400; globe.preloadSiblings = !LIGERO; globe.maximumScreenSpaceError = LIGERO ? 4 : 2.5;
  // Modo ligero (móviles, televisores, equipos con poca memoria): menos resolución de dibujo y menos teselas
  if (LIGERO) { viewer.resolutionScale = Math.min(1, 1.25 / (devicePixelRatio || 1)); scene.postProcessStages.fxaa.enabled = false; }
  // Sin «faldones» en los bordes de las teselas del relieve: asomaban por encima del mar como rayas negras finas
  globe.showSkirts = false;
  // Alejarse como mucho un poco más que la vista inicial de la isla (62 km)
  scene.screenSpaceCameraController.maximumZoomDistance = 80000;
  // Acercarse: fuera de una ciudad (intro / «Ver la isla sin menú») como mucho a 1,5 km del suelo, lo justo para ver un
  // municipio entero y su ciudad en 3D; dentro («Entrar en Es Castell», u otra ciudad en el futuro) hasta 25 m del suelo.
  const ZOOM_MIN = { fuera: 1500, dentro: 25 };
  const zoomMin = dentro => { scene.screenSpaceCameraController.minimumZoomDistance = dentro ? ZOOM_MIN.dentro : ZOOM_MIN.fuera; };
  zoomMin(false);

  // ---------- Mar animado alrededor de Menorca: material Water de Cesium (oleaje PROCEDURAL) ----------
  // Opaco: con agua translúcida se veían a través las juntas entre teselas del relieve como rayas negras
  const SEA_DAY = new C.Color(.10, .33, .45, 1), SEA_NIGHT = new C.Color(.02, .06, .11, 1);
  const seaMat = new C.Material({ fabric: { type: 'Water', uniforms: {
    baseWaterColor: SEA_NIGHT.clone(), blendColor: new C.Color(.05, .25, .3, 1), normalMap: C.buildModuleUrl('Assets/Textures/waterNormals.jpg'),
    frequency: 8000, animationSpeed: .015, amplitude: 4, specularIntensity: .6 } } });
  const sea = scene.primitives.add(new C.Primitive({
    geometryInstances: new C.GeometryInstance({ geometry: new C.RectangleGeometry({ rectangle: C.Rectangle.fromDegrees(2.0, 38.5, 6.2, 41.3),
      height: 0, granularity: C.Math.toRadians(.02), vertexFormat: C.EllipsoidSurfaceAppearance.VERTEX_FORMAT }) }),
    appearance: new C.EllipsoidSurfaceAppearance({ aboveGround: false, translucent: false, material: seaMat }), asynchronous: true }));
  for (const t of ['Edificios: © Dirección General del Catastro', 'Calles, costa y faros: © colaboradores de OpenStreetMap (ODbL)',
    ...(ISLA && ISLA.credito ? [ISLA.credito] : [])])
    viewer.creditDisplay.addStaticCredit(new C.Credit(t));

  // Luz fija (no la del sol real) para que el aspecto no dependa de la hora del ordenador.
  const CENTER = C.Cartesian3.fromDegrees(4.2908, 39.8803, 0);
  const ENU = C.Transforms.eastNorthUpToFixedFrame(CENTER);
  const enuDir = (e, n, u) => C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(ENU, new C.Cartesian3(e, n, u), new C.Cartesian3()), new C.Cartesian3());
  const sun = new C.DirectionalLight({ direction: enuDir(.55, .45, -.7), intensity: 2.2 });
  const moon = new C.DirectionalLight({ direction: enuDir(-.4, .5, -.75), color: C.Color.fromCssColorString('#9db8ff'), intensity: .55 });

  // ---------- Edificios del Catastro: huella y plantas REALES, 3 m por planta ESTIMADO, color PROCEDURAL ----------
  const DAY_COL = ['#eceee9', '#eceee9', '#eceee9', '#e6e3d8', '#c9ae90', '#b9a091', '#bda67a', '#cb947e'].map(c => C.Color.fromCssColorString(c));
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
  const B = D.buildings, dayCol = [], nightCol = [];
  // Parcelas con modelo detallado (pipeline/exportar_glb.mjs): no se dibuja su volumen simple
  const MODELS = window.MENORCA_MODELS || [], detailed = new Set(MODELS.flatMap(m => m.refs));
  if (MODELS.some(m => m.ide)) viewer.creditDisplay.addStaticCredit(new C.Credit("Aceras, escaleras, porches, árboles y paredes: IDE Menorca (CC BY 4.0). " +
    "Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca. http://ide.cime.es"));
  const instances = B.map((b, i) => {
    if (detailed.has(b.r)) return null;
    const r = hash(b.r + i);
    dayCol[i] = DAY_COL[Math.floor(r * DAY_COL.length)];
    nightCol[i] = r < .28 ? C.Color.fromCssColorString(r < .1 ? '#ffd28a' : '#c98d4e') : C.Color.fromCssColorString('#2a3346');   // ventanas encendidas: PROCEDURAL
    const hier = new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(b.p), (b.h || []).map(h => new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(h))));
    return new C.GeometryInstance({
      id: i,
      geometry: new C.PolygonGeometry({ polygonHierarchy: hier, height: b.b - .3, extrudedHeight: b.b + b.f * 3, vertexFormat: C.PerInstanceColorAppearance.VERTEX_FORMAT }),   // base bajo el terreno del visor
      attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(dayCol[i]) },
    });
  }).filter(Boolean);
  // Volúmenes simples solo para las piezas sin modelo detallado (hoy, ninguna en Es Castell)
  const buildings = instances.length ? scene.primitives.add(new C.Primitive({ geometryInstances: instances, appearance: new C.PerInstanceColorAppearance({ translucent: false }), asynchronous: true })) : null;

  // ---------- Modelos detallados: geometría y fachadas de v0.7 (GLB + CustomShader de js/facade.js) ----------
  // Cada entrada de MENORCA_MODELS es una zona exportada: varios bloques GLB de 300 m que comparten origen y shader.
  // Carga POR CERCANÍA (los modelos no se piden al abrir la página: empiezan cuando la isla ya está en pantalla):
  //  · Edificios: se cargan todos (se ven desde lejos), del bloque más cercano a la cámara al más lejano.
  //  · Detalle de calle (el 70 % del peso): solo los bloques a menos de CALLE_R del punto al que mira la cámara y con la
  //    cámara a menos de 4 km de altura; al alejarse se quitan de memoria y se vuelven a pedir al volver.
  // De pocos en pocos (MAXC a la vez); en modo ligero, menos a la vez y un radio de calle más corto.
  const models = [], shaders = [], items = []; let calleOn = true;
  const MAXC = LIGERO ? 3 : 6, CALLE_R = LIGERO ? 600 : 900, CALLE_ALT = 4000;
  for (const M of MODELS) {
    const shader = createFacadeShader(C, M.tex); shaders.push(shader);
    for (const part of M.models) {
      const o = part.origin || M.origin;   // cada bloque lleva su propio origen (plano tangente en su centro)
      items.push({ M, part, o, shader, calle: !M.refs.length, estado: 'pendiente', m: null });
    }
  }
  const NB = items.filter(q => !q.calle).length; let active = 0;
  const C0 = { lon: 4.2908, lat: 39.8803 };
  function puntoCamara() {   // punto del suelo al que mira la cámara (o, si mira al cielo, el que tiene debajo) y altura
    const cv = scene.canvas, p = camera.pickEllipsoid(new C.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2)), c = camera.positionCartographic;
    const g = p ? C.Cartographic.fromCartesian(p) : c;
    return { lon: C.Math.toDegrees(g.longitude), lat: C.Math.toDegrees(g.latitude), alt: c.height };
  }
  const dist = (q, t) => Math.hypot((q.o.lon - t.lon) * T.kx, (q.o.lat - t.lat) * T.kz);
  const quitar = q => { const i = models.findIndex(x => x.m === q.m); if (i >= 0) models.splice(i, 1); scene.primitives.remove(q.m); q.m = null; q.estado = 'pendiente'; };
  const mstat = () => {
    const ed = items.filter(q => !q.calle && q.estado == 'cargado').length, pend = items.filter(q => q.estado == 'cargando').length;
    $('mstat').textContent = ed < NB ? `Cargando edificios ${ed}/${NB}` : pend ? 'Cargando detalle de calle…' : '';
  };
  function pump() {
    if (!modelsStarted) return;
    const t = modelsStarted === 'intro' ? C0 : puntoCamara(), calleSi = calleOn && t.alt < CALLE_ALT;
    if (modelsStarted === 'intro') t.alt = Infinity;
    for (const q of items) {   // quitar de memoria el detalle de calle lejano
      if (q.calle && q.estado == 'cargado' && (!calleSi || dist(q, t) > CALLE_R * 2)) quitar(q);
    }
    const cand = items.filter(q => q.estado == 'pendiente' && (!q.calle || (calleSi && dist(q, t) < CALLE_R + 212)))
      .sort((a, b) => (a.calle - b.calle) * (calleSi ? 0 : 1) || dist(a, t) - dist(b, t));
    while (active < MAXC && cand.length) {
      const q = cand.shift(); active++; q.estado = 'cargando';
      const fin = ok => { active--; if (q.estado == 'cargando') q.estado = ok ? 'cargado' : 'error'; mstat(); pump(); };
      C.Model.fromGltfAsync({ url: q.part.url, customShader: q.shader,
        modelMatrix: C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(q.o.lon, q.o.lat, 0)),
        upAxis: C.Axis.Y, forwardAxis: C.Axis.X,   // glTF estándar: y arriba, sin el giro extra que Cesium aplica por defecto
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, q.calle ? 6000 : 25000) })
        .then(m => { q.m = m; if (q.calle) m.show = calleOn; scene.primitives.add(m); models.push({ m, M: q.M });
          m.readyEvent.addEventListener(() => fin(true)); m.errorEvent.addEventListener(() => fin(false)); })
        .catch(err => { console.error('No se pudo cargar', q.part.url, err); fin(false); });
    }
    mstat();
  }
  let modelsStarted = false;
  // Al empezar (intro) se prioriza Es Castell; al moverse la cámara, lo que tiene delante
  const startModels = () => { if (modelsStarted || !items.length) return; modelsStarted = 'intro'; pump(); setTimeout(() => { modelsStarted = true; pump(); }, 4000); };
  camera.moveEnd.addEventListener(() => pump());
  setInterval(() => pump(), 2500);
  if (MODELS.length && location.protocol == 'file:')
    console.warn('Los modelos detallados necesitan un servidor local: python -m http.server 8080 dentro de la carpeta cesium');

  // ---------- Frontera del municipio (Catastro, aproximada) ----------
  const border = D.border.map(r => viewer.entities.add({ polyline: {
    positions: C.Cartesian3.fromDegreesArray(r), clampToGround: true, width: 5,
    material: new C.PolylineGlowMaterialProperty({ glowPower: .3, color: C.Color.fromCssColorString('#6fd3ff').withAlpha(.9) }) } }));

  // ---------- Costa de toda la isla (OSM): se ve de noche ----------
  const coast = scene.primitives.add(new C.PolylineCollection());
  const coastMat = C.Material.fromType('Color', { color: C.Color.fromCssColorString('#7fb8d8').withAlpha(.35) });
  for (const l of D.coast) if (l.length > 1) coast.add({ positions: C.Cartesian3.fromDegreesArrayHeights(l.flatMap(([lo, la]) => [lo, la, 2])), width: 1.5, material: coastMat });

  // ---------- Farolas: cada ~28 m en calles con tráfico local (posición PROCEDURAL; OSM no las tiene) ----------
  const lamps = scene.primitives.add(new C.PointPrimitiveCollection());
  const LAMP_T = new Set(['residential', 'living_street', 'pedestrian', 'tertiary', 'secondary', 'primary', 'unclassified']);
  for (const r of D.roads) {
    if (!LAMP_T.has(r.t)) continue;
    let carry = 0;
    for (let k = 0; k + 3 < r.p.length; k += 2) {
      const [x0, y0, x1, y1] = [r.p[k], r.p[k + 1], r.p[k + 2], r.p[k + 3]];
      const L = Math.hypot((x1 - x0) * T.kx, (y1 - y0) * T.kz);
      for (let d = 28 - carry; d < L; d += 28) {
        const lo = x0 + (x1 - x0) * d / L, la = y0 + (y1 - y0) * d / L, warm = hash(lo.toFixed(5)) > .25;
        lamps.add({ position: C.Cartesian3.fromDegrees(lo, la, ground(lo, la) + 6), pixelSize: 3.2, color: C.Color.fromCssColorString(warm ? '#ffb45a' : '#f1f3ff'),
          scaleByDistance: new C.NearFarScalar(300, 1.6, 15000, .5) });
      }
      carry = (carry + L) % 28;
    }
  }

  // ---------- Faros y luces de navegación: ritmo REAL de OSM (o ESTIMADO), haz giratorio PROCEDURAL ----------
  const COL = { white: '#fff7e6', red: '#ff2a1a', green: '#33ff59', yellow: '#ffd933', blue: '#4d80ff' };
  const lights = scene.primitives.add(new C.PointPrimitiveCollection());
  const beams = scene.primitives.add(new C.PolylineCollection());
  const labels = scene.primitives.add(new C.LabelCollection());
  const faros = D.faros.map(f => {
    const t = f.tags || {}, g = k => t['seamark:light:' + k] ?? t['seamark:light:1:' + k];
    const col = C.Color.fromCssColorString(COL[(g('colour') || 'white').split(';')[0]] || COL.white);
    const big = f.kind === 'faro', h = Math.max(ground(f.lon, f.lat) + (big ? 18 : 4), parseFloat(g('height')) || 0);
    const pos = C.Cartesian3.fromDegrees(f.lon, f.lat, h);
    const o = { f, col, big, pos, pattern: lightPattern(g('character'), g('group'), parseFloat(g('period')), g('sequence')),
      pt: lights.add({ position: pos, color: col, pixelSize: big ? 10 : 5, scaleByDistance: new C.NearFarScalar(2000, 1.4, 80000, .6) }) };
    if (big) {
      o.frame = C.Transforms.eastNorthUpToFixedFrame(pos);
      o.L = Math.max(1200, Math.min(5000, (parseFloat(g('range')) || 15) * 1852 * .12));   // haz corto: no cruza la ciudad
      o.speed = 2 * Math.PI / Math.max(8, (o.pattern.period || 5) * 2);
      o.beams = [0, Math.PI].map(() => beams.add({ positions: [pos, pos], width: 9,
        material: C.Material.fromType('PolylineGlow', { color: col.withAlpha(.35), glowPower: .2, taperPower: .6 }) }));
      if (f.name) labels.add({ position: pos, text: f.name, font: '500 13px system-ui', fillColor: C.Color.fromCssColorString('#ffe7b0'),
        outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -22),
        distanceDisplayCondition: new C.DistanceDisplayCondition(3000, 150000), disableDepthTestDistance: Number.POSITIVE_INFINITY });
    }
    return o;
  });

  // Destino: Es Castell (Ayuntamiento, punto REAL de OSM)
  const dest = viewer.entities.add({ position: C.Cartesian3.fromDegrees(4.2908, 39.8803, ground(4.2908, 39.8803) + 600),
    label: { text: 'ES CASTELL', font: '600 15px system-ui', fillColor: C.Color.fromCssColorString('#bfe9ff'), outlineColor: C.Color.BLACK,
      outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new C.DistanceDisplayCondition(8000, 400000) } });
  const destCol = viewer.entities.add({ position: C.Cartesian3.fromDegrees(4.2908, 39.8803, ground(4.2908, 39.8803) + 300),
    cylinder: { length: 600, topRadius: 25, bottomRadius: 25, material: C.Color.fromCssColorString('#6fd3ff').withAlpha(.5),
      distanceDisplayCondition: new C.DistanceDisplayCondition(6000, 400000) } });

  // ---------- Día / noche: según la hora REAL en Menorca (altura del sol en Es Castell); el botón lo cambia a mano ----------
  // Fórmula solar aproximada (precisión de ~1 min en la salida y la puesta). Noche: sol por debajo de -0,833°.
  const sunElev = (d, lat = 39.8803, lon = 4.2908) => {
    const R = Math.PI / 180, n = d.getTime() / 864e5 + 2440587.5 - 2451545;
    const L = (280.46 + .9856474 * n) % 360, g = ((357.528 + .9856003 * n) % 360) * R;
    const lam = (L + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * R, eps = (23.439 - 4e-7 * n) * R;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const H = ((18.697374558 + 24.06570982441908 * n) % 24) * 15 * R + lon * R - ra;
    return Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(H)) / R;
  };
  const isNightNow = () => sunElev(new Date()) < -.833;
  // Hora de salida y puesta de hoy (búsqueda minuto a minuto, para el texto de ayuda del botón)
  const sunTimes = () => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); let rise = null, set = null, prev = sunElev(d0) >= -.833;
    for (let m = 1; m <= 1440; m++) { const t = new Date(d0.getTime() + m * 6e4), up = sunElev(t) >= -.833; if (up && !prev) rise = t; if (!up && prev) set = t; prev = up; }
    const f = t => t ? t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
    return `Sale el sol ${f(rise)} · se pone ${f(set)} (hora de tu ordenador)`;
  };
  // Focos del campo de fútbol y halo de la farmacia (js/luces.js)
  // (si falla o falta luces.js —p. ej. un index.html viejo en la caché—, el resto del visor sigue funcionando)
  let luces = { update() {}, setEnabled() {} };
  try { if (typeof createLucesNoche == 'function') luces = createLucesNoche({ C, viewer, ground }); else console.warn('Falta js/luces.js: recarga con Ctrl+F5'); }
  catch (e) { console.error('Luces de noche:', e); }
  let night = isNightNow(), autoNight = night, farosOn = true;
  let alCambiarNoche = () => {};   // lo usa el panel de capas (se crea más abajo)
  function applyNight() {
    for (const o of orthoLayers) { o.brightness = night ? .16 : 1; o.contrast = night ? 1.2 : 1; o.saturation = night ? .25 : 1; o.gamma = night ? 1.1 : 1; }
    scene.light = night ? moon : sun;
    scene.skyAtmosphere.brightnessShift = night ? -.82 : 0;
    globe.atmosphereBrightnessShift = night ? -.8 : 0;
    scene.fog.density = night ? 4e-4 : 2e-4;
    for (const sh of shaders) sh.setUniform('u_night', night ? 1 : 0);
    seaMat.uniforms.baseWaterColor = night ? SEA_NIGHT : SEA_DAY;
    luces.update(night, night && night != autoNight);   // noche puesta a mano: focos encendidos a cualquier hora
    alCambiarNoche(night);
    lamps.show = coast.show = night; lights.show = beams.show = labels.show = night && farosOn;
    if (buildings && buildings.ready) B.forEach((_, i) => { if (i !== sel) setCol(i, night ? nightCol[i] : dayCol[i]); });
    // El botón muestra el modo ACTUAL (como en v0.7); al abrir coincide con la hora real. Clic: cambia al otro modo.
    const real = night == autoNight;
    $('daynight').textContent = (night ? '☾ Noche' : '☀ Día') + (real ? '' : ' (manual)');
    $('daynight').title = (night ? 'Cambiar a modo día' : 'Cambiar a modo noche') + (real ? '\nCoincide con la hora real en Menorca' : '\nElegido a mano: vuelve solo a la hora real al salir o ponerse el sol') + '\n' + sunTimes();
  }
  const setCol = (i, c) => { if (!buildings) return; const a = buildings.getGeometryInstanceAttributes(i); if (a) a.color = C.ColorGeometryInstanceAttribute.toValue(c, a.color); };
  $('daynight').onclick = () => { night = !night; applyNight(); };
  // Cada minuto: si sale o se pone el sol, cambia solo (aunque antes se hubiera elegido a mano)
  setInterval(() => { const n = isNightNow(); if (n != autoNight) { autoNight = n; night = n; applyNight(); } }, 60000);

  // Animación de faros (cada fotograma)
  const t0 = performance.now(), tmp = new C.Cartesian3();
  scene.preRender.addEventListener(() => {
    if (!night || !farosOn) return;
    const t = (performance.now() - t0) / 1000;
    // El haz solo se ve desde lejos: por debajo de ~1,5 km de altura se apaga, y aparece del todo a partir de ~6 km
    const fade = Math.min(1, Math.max(0, (camera.positionCartographic.height - 1500) / 4500));
    beams.show = fade > 0;
    for (const o of faros) {
      const k = o.pattern.at(t);
      o.pt.color = o.col.withAlpha(.25 + .75 * k); o.pt.pixelSize = (o.big ? 9 : 4) * (.5 + k);
      if (o.beams) o.beams.forEach((b, s) => {
        const a = t * o.speed + s * Math.PI;
        const end = C.Matrix4.multiplyByPoint(o.frame, new C.Cartesian3(Math.cos(a) * o.L, Math.sin(a) * o.L, -10), tmp);
        b.positions = [o.pos, C.Cartesian3.clone(end)];
        b.material.uniforms.color = o.col.withAlpha((.1 + .3 * k) * fade);
      });
    }
  });

  // ---------- Ficha del edificio (clic) ----------
  const pipLL = (x, y, f) => { let c = false; for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) { const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  let sel = -1;
  const handler = new C.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction(e => {
    const p = scene.pick(e.position);
    if (sel >= 0) setCol(sel, night ? nightCol[sel] : dayCol[sel]);
    { const c = p && scene.pickPosition(e.position), g = c && C.Cartographic.fromCartesian(c);
      if (servicios.pick(p, g && [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)])) { sel = -1; $('card').style.display = 'none'; return; } }
    const mo = p && models.find(o => o.m === p.primitive);
    if (mo && !mo.M.refs.length) { sel = -1; $('card').style.display = 'none'; return; }   // calle, no edificio
    if (mo) {
      sel = -1; const c = scene.pickPosition(e.position), g = c && C.Cartographic.fromCartesian(c);
      const lo = g && C.Math.toDegrees(g.longitude), la = g && C.Math.toDegrees(g.latitude);
      const b = g && B.find(b => pipLL(lo, la, b.p)) || null, mb = b && maps.building(lo, la);
      $('card').innerHTML = (b ? `<b>Edificio nº ${mb ? mb.n : b.n || '?'}</b>${mb && mb.provisional ? ' <small class="k">(provisional)</small>' : ''}<br>` +
        `<span class="k">Ref. catastral</span> ${b.r} <span class="t">REAL</span><br>` +
        `<span class="k">Plantas</span> ${b.f} <span class="t">REAL</span><br>`
        : '<b>Edificio</b> <small class="k">(solo OSM)</small><br>') +
        `<span class="k">Fachada y tejado</span> <span class="t">PROCEDURAL</span><br>` +
        '<small class="k">Reglas y colores de v0.7, medidos en las fotos propias</small>' +
        (mb ? '<button id="cardmap">Ver en el mapa de edificios</button>' : '');
      $('card').style.display = 'block';
      if (mb) $('cardmap').onclick = () => maps.open(mb);
      return;
    }
    if (!p || !buildings || p.primitive !== buildings || typeof p.id !== 'number') { sel = -1; $('card').style.display = 'none'; return; }
    sel = p.id; const b = B[sel]; setCol(sel, C.Color.fromCssColorString('#6fd3ff'));
    $('card').innerHTML = `<b>${b.n ? 'Edificio nº ' + b.n : 'Edificio'}</b><br>` +
      `<span class="k">Ref. catastral</span> ${b.r} <span class="t">REAL</span><br>` +
      `<span class="k">Plantas</span> ${b.f} <span class="t">REAL</span><br>` +
      `<span class="k">Altura</span> ≈ ${b.f * 3} m <span class="t">ESTIMADA</span><br>` +
      `<span class="k">Suelo</span> ${b.b.toFixed(1)} m <span class="t">MDT IGN</span>` +
      (b.n ? '' : '<br><small class="k">Fuera de la zona numerada en v0.7</small>');
    $('card').style.display = 'block';
  }, C.ScreenSpaceEventType.LEFT_CLICK);

  // Coordenadas bajo el cursor: lon/lat, UTM 31N y altitud del MDT
  handler.setInputAction(e => {
    if ($('coords').style.display !== 'block') return;
    const c = camera.pickEllipsoid(e.endPosition) && globe.pick(camera.getPickRay(e.endPosition), scene);
    if (!c) return;
    const g = C.Cartographic.fromCartesian(c), lo = C.Math.toDegrees(g.longitude), la = C.Math.toDegrees(g.latitude), [E, N] = toUTM31(lo, la);
    $('coords').textContent = `${la.toFixed(6)}° N  ${lo.toFixed(6)}° E\nUTM 31N  E ${E.toFixed(1)}  N ${N.toFixed(1)}\nAltitud ${ground(lo, la).toFixed(1)} m`;
  }, C.ScreenSpaceEventType.MOUSE_MOVE);

  // ---------- Intro y vuelos ----------
  const ISLAND = { destination: C.Cartesian3.fromDegrees(4.06, 39.64, 62000), orientation: { heading: 0, pitch: C.Math.toRadians(-60), roll: 0 } };
  const CASTELL = { destination: C.Cartesian3.fromDegrees(4.2868, 39.8716, 720), orientation: { heading: C.Math.toRadians(20), pitch: C.Math.toRadians(-35), roll: 0 } };
  camera.setView(ISLAND);
  let orbit = true;   // giro lento de la isla en la intro
  scene.preRender.addEventListener(() => { if (orbit) camera.rotate(C.Cartesian3.normalize(C.Cartesian3.fromDegrees(4.06, 39.95), new C.Cartesian3()), 2e-5); });

  // ---------- Límites de la cámara: como mucho, media isla más allá de la costa por cada lado ----------
  // Así no se llega a donde ya no hay mar ni ortofoto. Se limita el punto al que mira la cámara (centro de la pantalla):
  // si se sale, la cámara se desplaza lo justo para volver al borde (hace de pared al arrastrar).
  const LIM = (() => {
    let w = 1e9, s = 1e9, e = -1e9, n = -1e9;
    for (const l of D.coast || []) for (const [lo, la] of l) { w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la); }
    if (w > e) return null;
    const mx = (e - w) / 2, my = (n - s) / 2;   // media isla de ancho (este-oeste) y de alto (norte-sur)
    return { w: w - mx, e: e + mx, s: s - my, n: n + my };
  })();
  const centroPantalla = new C.Cartesian2();
  if (LIM) scene.preRender.addEventListener(() => {
    centroPantalla.x = scene.canvas.clientWidth / 2; centroPantalla.y = scene.canvas.clientHeight / 2;
    const p = camera.pickEllipsoid(centroPantalla), cam = camera.positionCartographic;
    const g = p ? C.Cartographic.fromCartesian(p) : cam, lo = C.Math.toDegrees(g.longitude), la = C.Math.toDegrees(g.latitude);
    const dlo = Math.min(0, LIM.e - lo) + Math.max(0, LIM.w - lo), dla = Math.min(0, LIM.n - la) + Math.max(0, LIM.s - la);
    if (!dlo && !dla) return;
    camera.setView({ destination: C.Cartesian3.fromDegrees(C.Math.toDegrees(cam.longitude) + dlo, C.Math.toDegrees(cam.latitude) + dla, cam.height),
      orientation: { heading: camera.heading, pitch: camera.pitch, roll: camera.roll } });
  });

  $('enter').onclick = () => {
    zoomMin(true); $('menuBtn').style.display = 'none'; orbit = false; startModels(); $('overlay').classList.add('off'); setTimeout(() => $('overlay').style.display = 'none', 1000);
    camera.flyTo({ ...CASTELL, duration: 7, easingFunction: C.EasingFunction.QUADRATIC_IN_OUT,
      complete: () => { $('hud').style.display = $('coords').style.display = 'block'; maps.show(true); $('ctl').style.display = 'flex'; } });
  };
  // Ver la isla sin el menú: se oculta el panel y se para el giro; «☰ Menú» lo vuelve a mostrar
  $('explore').onclick = $('closeMenu').onclick = () => { orbit = false; $('overlay').classList.add('off'); setTimeout(() => { $('overlay').style.display = 'none'; $('menuBtn').style.display = 'block'; }, 600); };
  $('menuBtn').onclick = () => { $('menuBtn').style.display = 'none'; $('overlay').style.display = 'flex'; requestAnimationFrame(() => $('overlay').classList.remove('off')); };
  $('island').onclick = () => {
    zoomMin(false);
    $('hud').style.display = $('coords').style.display = $('card').style.display = 'none'; maps.show(false); $('ctl').style.display = 'none'; $('layers').style.display = 'none'; servicios.close();
    camera.flyTo({ ...ISLAND, duration: 5, complete: () => { $('overlay').style.display = 'flex'; requestAnimationFrame(() => $('overlay').classList.remove('off')); orbit = true; } });
  };

  // Quitar la pantalla de carga cuando la isla esté entera en pantalla (relieve, ortofoto y mar), para que no se vea cómo
  // aparecen y desaparecen teselas de baja resolución; 15 s como máximo. Después, en segundo plano, los modelos.
  let done = false, frames = 0;
  const ready = () => { if (done) return; done = true; applyNight(); $('loader').classList.add('off'); setTimeout(startModels, 1500); };
  applyNight();
  scene.postRender.addEventListener(() => {
    if (done || ++frames < 10) return;
    if (globe.tilesLoaded && sea.ready && (!buildings || buildings.ready)) ready();
  });
  setTimeout(ready, 15000);
  // ---------- Capas (js/servicios.js) ----------
  const servicios = createServicios({ C, viewer, ground, border: D.border, toggles: {
    calle: v => { calleOn = v; for (const o of models) if (!o.M.refs.length) o.m.show = v; pump(); },
    frontera: v => { for (const b of border) b.show = v; },
    faros: v => { farosOn = v; applyNight(); },
    mar: v => { sea.show = v; },
    luces: v => luces.setEnabled(v),
  } });
  alCambiarNoche = n => servicios.setNoche(n); alCambiarNoche(night);

  // ---------- Girar la cámara: botones ⟲ ⟳ (mantener pulsado), «N» para mirar al norte, teclas Q / E ----------
  // Gira alrededor del punto del suelo que hay en el centro de la pantalla, sin cambiar la inclinación ni la distancia.
  function centerPoint() {
    const cv = scene.canvas, ray = camera.getPickRay(new C.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
    return (ray && globe.pick(ray, scene)) || camera.pickEllipsoid(new C.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
  }
  function rotate(rad) {
    const c = centerPoint(); if (!c) { camera.twistRight && camera.setView({ orientation: { heading: camera.heading + rad, pitch: camera.pitch, roll: 0 } }); return; }
    const frame = C.Transforms.eastNorthUpToFixedFrame(c);
    camera.lookAtTransform(frame); camera.rotateRight(-rad); camera.lookAtTransform(C.Matrix4.IDENTITY);   // rad > 0: el rumbo aumenta
  }
  let spin = 0, spinRAF = 0;
  const spinLoop = () => { if (!spin) return; rotate(spin); spinRAF = requestAnimationFrame(spinLoop); };
  for (const [id, dir] of [['rotL', -1], ['rotR', 1]]) {
    const b = $(id);
    b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); spin = dir * .012; cancelAnimationFrame(spinRAF); spinLoop(); };
    b.onpointerup = b.onpointercancel = () => { spin = 0; };
  }
  $('rotN').onclick = () => {   // animación corta hasta mirar al norte
    const c = centerPoint(), start = camera.heading, d = Math.atan2(Math.sin(-start), Math.cos(-start)); if (!c) return;
    let k = 0; const step = () => { k++; rotate(d / 20); if (k < 20) requestAnimationFrame(step); }; step();
  };
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || $('ctl').style.display != 'flex') return;
    if (e.code == 'KeyQ') rotate(-.06); else if (e.code == 'KeyE') rotate(.06);
  });

  // ---------- Qué capas se están viendo ahora (abajo a la izquierda) ----------
  // Ortofoto: el PNOA del IGN se dibuja en las teselas de relieve de nivel ≥ 13 (minimumTerrainLevel); en las demás,
  // la del Govern balear. El nivel de las teselas en pantalla se lee de Cesium (dato interno; si cambia, se estima
  // por la distancia). Relieve: la malla que usa el punto del centro de la pantalla.
  function capasVisibles() {
    let niveles = null;
    try { niveles = globe._surface._tilesToRender.map(t => t.level); } catch { /* API interna no disponible */ }
    const cv = scene.canvas, ray = camera.getPickRay(new C.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2)), c = ray && globe.pick(ray, scene);
    const dist = c ? C.Cartesian3.distance(camera.positionWC, c) : camera.positionCartographic.height;
    let ign, goib;
    if (niveles && niveles.length) { ign = niveles.some(l => l >= 13); goib = niveles.some(l => l < 13); }
    else { ign = dist < 4000; goib = dist > 2000; }
    const img = [goib && 'Ortofoto Govern balear · IDEIB Orto 2024 (lejos)', ign && 'Ortofoto PNOA máxima actualidad · IGN (cerca, ~25 cm)'].filter(Boolean);
    let rel = 'MDE 2007 · IDE Menorca (40 m)';
    if (c) { const g = C.Cartographic.fromCartesian(c), lo = C.Math.toDegrees(g.longitude), la = C.Math.toDegrees(g.latitude);
      const x = (lo - O.lon) * T.kx, z = -(la - O.lat) * T.kz;
      const inG = G => G && x >= G.x0 && z >= G.z0 && x <= G.x0 + (G.cols - 1) * G.step && z <= G.z0 + (G.rows - 1) * G.step;
      if (inG(D.terrain_fino)) rel = 'MDT IGN (5 m, zona detallada)'; else if (inG(T)) rel = 'MDT IGN (10 m, municipio)'; }
    $('vis').innerHTML = `<b>Imagen:</b> ${img.join(' + ')}<br><b>Relieve:</b> ${rel}`;
  }
  setInterval(capasVisibles, 700);

  window.menorca = { viewer, buildings, faros, ground, models, sea, startModels, maps, sunElev, servicios, rotate, luces };   // para depurar desde la consola
})();
