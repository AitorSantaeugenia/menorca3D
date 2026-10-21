import { CONTROLS } from '../config/controls.js';
// ¿Se puede pasar de (fx,fz) a (x,z)? Tierra firme, sin edificios ni muros, y sin pendientes imposibles (salvo escaleras).
export function createCollider(zone, buildings, street) {
  const [X0, X1, Z0, Z1] = zone.box, R = CONTROLS.RADIUS, OFF = [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]];
  return (x, z, fx, fz) => x > X0 + 5 && x < X1 - 5 && z > Z0 + 5 && z < Z1 - 5 && zone.inLand(x, z)
    && zone.Hgt(x, z) - zone.Hgt(fx, fz) <= (street.steep(x, z) ? 3.5 : CONTROLS.MAX_SLOPE) * Math.hypot(x - fx, z - fz) + .02
    && !street.blocked(x, z)
    && !OFF.some(o => buildings.hit(x + o[0], z + o[1]));
}
