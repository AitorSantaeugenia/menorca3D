// Luces de noche de lugares concretos (datos: data/luces.js, generado por pipeline/exportar_glb.mjs).
// - Campo de fútbol de la Zona Deportiva Sergio Llull: focos encendidos de noche hasta las 00:00 (ESTIMADO: a partir de
//   medianoche ya no hay nadie jugando). Si se pone la noche a mano (botón Día/Noche), se encienden siempre. Se ven el brillo de cada proyector, un cono de luz translúcido hacia el campo y el césped iluminado.
// - Sa Farmàcia: halo verde alrededor de la cruz y luz verde en la acera, toda la noche.
function createLucesNoche({ C, viewer, ground }) {
  const L = window.MENORCA_LUCES, scene = viewer.scene;
  if (!L) return { update() {}, setEnabled() {} };
  // Halo: degradado radial dibujado en un canvas
  const halo = (rgb, core) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, `rgba(${core},1)`); r.addColorStop(.18, `rgba(${rgb},.85)`); r.addColorStop(.5, `rgba(${rgb},.25)`); r.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c; };
  const P = (ll, y) => C.Cartesian3.fromDegrees(ll[0], ll[1], y);   // y: altura elipsoidal, la misma de los modelos

  // ---------- Campo de fútbol ----------
  const campo = new C.CustomDataSource('focos'); viewer.dataSources.add(campo);
  const bills = scene.primitives.add(new C.BillboardCollection());
  const white = halo('255,246,214', '255,255,255'), beamCol = C.Color.fromCssColorString('#fff4d6').withAlpha(.07);
  for (const f of L.focos) {
    const head = P(f.ll, f.y), tgt = P(f.t, f.ty);
    bills.add({ position: head, image: white, width: 70, height: 70, scaleByDistance: new C.NearFarScalar(80, 1.4, 6000, .35), eyeOffset: new C.Cartesian3(0, 0, -1.5) });
    bills.add({ position: head, image: white, width: 18, height: 18, scaleByDistance: new C.NearFarScalar(80, 1.2, 6000, .5), eyeOffset: new C.Cartesian3(0, 0, -1.6) });
    // haz: cono translúcido del proyector al campo (el eje z del cilindro, de abajo a arriba = del campo al proyector)
    const len = C.Cartesian3.distance(head, tgt), mid = C.Cartesian3.midpoint(head, tgt, new C.Cartesian3());
    const dir = C.Cartesian3.normalize(C.Cartesian3.subtract(head, tgt, new C.Cartesian3()), new C.Cartesian3());
    const enu = C.Transforms.eastNorthUpToFixedFrame(mid), inv = C.Matrix4.inverseTransformation(enu, new C.Matrix4());
    const d = C.Matrix4.multiplyByPointAsVector(inv, dir, new C.Cartesian3());   // dirección en el marco local (este, norte, arriba)
    const axis = C.Cartesian3.cross(C.Cartesian3.UNIT_Z, d, new C.Cartesian3()), ang = Math.acos(Math.max(-1, Math.min(1, d.z)));
    const qLocal = C.Cartesian3.magnitude(axis) < 1e-9 ? C.Quaternion.IDENTITY : C.Quaternion.fromAxisAngle(C.Cartesian3.normalize(axis, axis), ang);
    const qEnu = C.Quaternion.fromRotationMatrix(C.Matrix4.getMatrix3(enu, new C.Matrix3()));
    campo.entities.add({ position: mid, orientation: C.Quaternion.multiply(qEnu, qLocal, new C.Quaternion()),
      cylinder: { length: len, topRadius: .4, bottomRadius: 17, material: beamCol, slices: 24 } });
  }
  for (const k of L.campos) {   // césped iluminado: capa verde clara translúcida justo por encima del césped
    campo.entities.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArrayHeights(k.p.flatMap(q => [q[0], q[1], k.y + .05])), perPositionHeight: true,
      material: C.Color.fromCssColorString('#c4f7b4').withAlpha(.4) } });
  }

  // ---------- Farmacia ----------
  const verde = halo('40,255,110', '200,255,215'), farm = new C.CustomDataSource('farmacia'); viewer.dataSources.add(farm);
  const fb = scene.primitives.add(new C.BillboardCollection());
  for (const f of L.farmacias) {
    fb.add({ position: P(f.ll, f.y), image: verde, width: 110, height: 110, scaleByDistance: new C.NearFarScalar(30, 1.5, 4000, .25), eyeOffset: new C.Cartesian3(0, 0, -1.2) });
    farm.entities.add({ position: P(f.ll, f.suelo + .25), ellipse: { semiMajorAxis: 5, semiMinorAxis: 5, height: f.suelo + .25,
      material: new C.ImageMaterialProperty({ image: halo('40,255,110', '120,255,160'), transparent: true }) } });
  }

  let night = false, forzada = false, enabled = true;   // enabled: casilla «Luces de noche» del panel Capas
  // De 00:00 a 07:00 (hora real) los focos están apagados; si la noche se ha puesto a mano (botón Día/Noche), siempre encendidos
  const focosOn = () => { const h = new Date().getHours(); return enabled && night && (forzada || h >= 7); };
  function update(n, aMano) {
    if (n !== undefined) { night = n; forzada = !!aMano; }
    const on = focosOn();
    bills.show = campo.show = on;
    fb.show = farm.show = enabled && night;
    scene.requestRender && scene.requestRender();
  }
  setInterval(() => update(), 60000);   // a medianoche se apagan solos
  update(false);
  const setEnabled = v => { enabled = v; update(); };
  return { update, setEnabled };
}
