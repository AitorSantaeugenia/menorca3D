// Utilidades geográficas: proyección local (metros, norte = -z) y polígonos.
export function makeProjection(origin) {
  const kx = 111320 * Math.cos(origin.lat * Math.PI / 180), kz = 110540;
  return {
    toLocal: (lat, lon) => [(lon - origin.lon) * kx, -(lat - origin.lat) * kz],
    toGeo: (x, z) => ({ lat: origin.lat - z / kz, lon: origin.lon + x / kx }),
  };
}
export function ring(p) { p = p.slice(); const f = p[0], l = p[p.length - 1]; if (f[0] == l[0] && f[1] == l[1]) p.pop(); return p; }
export function pip(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) != (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
export function bbox(r) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of r) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } return [x0, x1, z0, z1]; }
