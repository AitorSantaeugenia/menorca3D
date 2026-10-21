import { ring, pip } from '../core/geo.js';
// Carga una zona procesada (zone.json). Futuro: varias zonas/chunks cargados y descargados según la posición.
export async function loadZone(dest) {
  const r = await fetch(dest.data);
  if (!r.ok) throw new Error('No se pudo cargar ' + dest.data);
  const D = await r.json(), T = D.terrain;
  const HH = new Int16Array(Uint8Array.from(atob(T.h), c => c.charCodeAt(0)).buffer);
  const h = (a, b) => HH[b * T.cols + a] / 10;
  const Hgt = (x, z) => {
    const u = Math.max(0, Math.min(T.cols - 1.001, (x - T.x0) / T.step)), v = Math.max(0, Math.min(T.rows - 1.001, (z - T.z0) / T.step));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    return (h(i, j) * (1 - fu) + h(i + 1, j) * fu) * (1 - fv) + (h(i, j + 1) * (1 - fu) + h(i + 1, j + 1) * fu) * fv;
  };
  const landP = ring(D.land), isl = D.islands.map(ring);
  return { ...D, HH, Hgt, landP, inLand: (x, z) => pip(x, z, landP) || isl.some(p => pip(x, z, p)) };
}
