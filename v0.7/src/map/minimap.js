import { hex } from '../world/pois.js';
// Minimapa orientado según la cámara. Capas futuras: comercios, rutas, zonas protegidas, pesca, eventos.
export function createMinimap(canvas, zone, pois) {
  const g = canvas.getContext('2d'), S = .4;
  const line = r => { g.beginPath(); r.p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); };
  return (pos, yaw) => {
    g.save(); g.clearRect(0, 0, 140, 140); g.beginPath(); g.arc(70, 70, 70, 0, 7); g.clip(); g.fillStyle = '#bfe0ea'; g.fillRect(0, 0, 140, 140);
    g.translate(70, 70); g.rotate(yaw); g.scale(S, S); g.translate(-pos.x, -pos.z);
    g.fillStyle = '#f2efe9'; g.beginPath(); zone.landP.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.fill();
    g.lineCap = g.lineJoin = 'round';
    const near = zone.roads.filter(r => r.p.some(q => Math.abs(q[0] - pos.x) < 300 && Math.abs(q[1] - pos.z) < 300));
    g.strokeStyle = '#8f8a7c'; for (const r of near) { g.lineWidth = Math.max(r.w, 4) + 2; line(r); }
    g.strokeStyle = '#fff'; for (const r of near) { g.lineWidth = Math.max(r.w, 4); line(r); }
    for (const p of pois) { g.fillStyle = hex(p.color); g.beginPath(); g.arc(p.x, p.z, 12, 0, 7); g.fill(); }
    g.restore(); g.fillStyle = '#d62828'; g.beginPath(); g.moveTo(70, 60); g.lineTo(76, 78); g.lineTo(64, 78); g.fill();
  };
}
