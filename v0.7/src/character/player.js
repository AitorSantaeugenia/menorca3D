import * as THREE from 'three';
import { PRESETS, BODIES } from './presets.js';
import { CONTROLS } from '../config/controls.js';
// Personaje + controlador: aceleración suave, giro suave, idle/walk/run/jump.
export function createPlayer() {
  const root = new THREE.Group(), L = c => new THREE.MeshLambertMaterial({ color: c });
  const mS = L(0), mP = L(0), mH = L(0), mK = L(0xe0b08a);
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); root.add(o); return o; };
  const body = add(new THREE.BoxGeometry(.5, .62, .28), mS, 0, 1.15, 0);
  add(new THREE.SphereGeometry(.14, 12, 10), mK, 0, 1.62, 0); add(new THREE.SphereGeometry(.15, 12, 8, 0, 6.29, 0, 1.6), mH, 0, 1.65, 0);
  const limb = (w, m, x, y) => add(new THREE.BoxGeometry(w, .6, w).translate(0, -.3, 0), m, x, y, 0);
  const legL = limb(.17, mP, -.12, .85), legR = limb(.17, mP, .12, .85), armL = limb(.12, mS, -.33, 1.43), armR = limb(.12, mS, .33, 1.43);
  const st = { vel: new THREE.Vector3(), vy: 0, py: 0, phase: 0, t: 0 };
  return {
    root,
    setLook(sel) { const p = PRESETS[sel.preset] || PRESETS[0]; mS.color.set(p.shirt); mP.color.set(p.pants); mH.color.set(p.hair); root.scale.setScalar((BODIES[sel.body] || BODIES[0]).scale); },
    teleport(x, z) { root.position.x = x; root.position.z = z; st.vel.set(0, 0, 0); },
    update(dt, input, yaw, free, Hgt) {
      const [ix, iz] = input.axis(), mag = Math.min(Math.hypot(ix, iz), 1), sp = (input.running() ? CONTROLS.RUN : CONTROLS.WALK) * (input.turbo ? CONTROLS.TURBO : 1);
      let tx = 0, tz = 0;
      if (mag > .05) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); tx = fx * -iz + rx * ix; tz = fz * -iz + rz * ix; const l = Math.hypot(tx, tz) || 1; tx = tx / l * sp * mag; tz = tz / l * sp * mag; }
      const a = 1 - Math.exp(-dt * (mag > .05 ? 7 : 10)); st.vel.x += (tx - st.vel.x) * a; st.vel.z += (tz - st.vel.z) * a;
      const p = root.position, nx = p.x + st.vel.x * dt, nz = p.z + st.vel.z * dt;
      if (free(nx, nz, p.x, p.z)) { p.x = nx; p.z = nz; } else if (free(nx, p.z, p.x, p.z)) p.x = nx; else if (free(p.x, nz, p.x, p.z)) p.z = nz; else st.vel.set(0, 0, 0);
      const spd = Math.hypot(st.vel.x, st.vel.z);
      if (spd > .15) { let da = Math.atan2(st.vel.x, st.vel.z) - root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); root.rotation.y += da * Math.min(1, dt * 10); st.phase += dt * Math.min(spd, 7) * 2; }
      if (st.py == 0 && input.jumping()) st.vy = CONTROLS.JUMP;
      st.vy -= CONTROLS.GRAVITY * dt; st.py += st.vy * dt; if (st.py <= 0) { st.py = 0; st.vy = 0; }
      p.y = Hgt(p.x, p.z) + st.py; st.t += dt;
      const air = st.py > .05, sw = Math.sin(st.phase) * Math.min(spd / CONTROLS.WALK, 2.2) * .55;
      legL.rotation.x = air ? -.5 : sw; legR.rotation.x = air ? .3 : -sw; armL.rotation.x = air ? -2.4 : -sw; armR.rotation.x = air ? -2.4 : sw;
      body.position.y = 1.15 + (spd < .15 && !air ? Math.sin(st.t * 2) * .01 : 0); // idle: respiración
      return spd;
    },
  };
}
