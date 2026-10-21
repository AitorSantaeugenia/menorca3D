// Teclado, joystick táctil y arrastre de cámara.
export function createInput(canvas, onLook) {
  const s = { paused: false, keys: {}, jx: 0, jy: 0, run: false, jump: false, turbo: false };
  addEventListener('keydown', e => { if (s.paused || /INPUT|TEXTAREA/.test(e.target.tagName)) return; s.keys[e.code] = true; if (e.code == 'KeyT') s.turbo = !s.turbo; if (e.code == 'Space') e.preventDefault(); });
  addEventListener('keyup', e => { s.keys[e.code] = false; });
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId != drag.id) return; onLook(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; });
  ['pointerup', 'pointercancel'].forEach(v => canvas.addEventListener(v, () => { drag = null; }));
  const st = document.getElementById('stick'), kn = document.getElementById('knob'); let sid = null;
  const move = e => { const r = st.getBoundingClientRect(), ox = Math.max(-40, Math.min(40, e.clientX - r.left - 60)), oy = Math.max(-40, Math.min(40, e.clientY - r.top - 60)); kn.style.transform = `translate(${ox}px,${oy}px)`; s.jx = ox / 40; s.jy = oy / 40; };
  st.addEventListener('pointerdown', e => { sid = e.pointerId; st.setPointerCapture(sid); move(e); });
  st.addEventListener('pointermove', e => { if (e.pointerId == sid) move(e); });
  ['pointerup', 'pointercancel'].forEach(v => st.addEventListener(v, () => { sid = null; s.jx = s.jy = 0; kn.style.transform = ''; }));
  const hold = (id, k) => { const el = document.getElementById(id); el.addEventListener('pointerdown', () => { s[k] = true; }); ['pointerup', 'pointercancel'].forEach(v => el.addEventListener(v, () => { s[k] = false; })); };
  hold('run', 'run'); hold('jmp', 'jump');
  s.axis = () => {
    const k = s.keys;
    return [s.jx + (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), s.jy + (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0)];
  };
  s.running = () => s.run || s.keys.ShiftLeft || s.keys.ShiftRight;
  s.jumping = () => s.jump || s.keys.Space;
  return s;
}
