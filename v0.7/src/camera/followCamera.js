import * as THREE from 'three';
// Cámara en tercera persona con suavizado y descenso inicial desde la vista aérea.
export class FollowCamera {
  constructor(cam, Hgt) { this.cam = cam; this.Hgt = Hgt; this.yaw = 0; this.pitch = .35; this.dist = 5; this.anim = null; }
  look(dx, dy) { this.yaw -= dx * .005; this.pitch = Math.max(.05, Math.min(1.2, this.pitch + dy * .005)); }
  descend(dur = 4) { this.anim = { t: 0, dur, from: this.cam.position.clone() }; }
  update(dt, target) {
    const tg = target.clone(); tg.y += 1.5; const cp = Math.cos(this.pitch);
    const want = new THREE.Vector3(tg.x + Math.sin(this.yaw) * cp * this.dist, tg.y + Math.sin(this.pitch) * this.dist, tg.z + Math.cos(this.yaw) * cp * this.dist);
    if (this.anim) {
      const A = this.anim; A.t += dt; const k = Math.min(1, A.t / A.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.cam.position.lerpVectors(A.from, want, e); this.cam.lookAt(tg); if (k >= 1) this.anim = null; return;
    }
    if (this.snap) { this.cam.position.copy(want); this.snap = false; }
    this.cam.position.lerp(want, 1 - Math.exp(-dt * 9));
    this.cam.position.y = Math.max(this.cam.position.y, this.Hgt(this.cam.position.x, this.cam.position.z) + .6);
    this.cam.lookAt(tg);
  }
}
