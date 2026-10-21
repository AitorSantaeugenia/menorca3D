// Modo día / noche, compartido por la pantalla de inicio y el juego. Se recuerda en el navegador.
// uNight es un uniform de shader que va de 0 (día) a 1 (noche) con una transición suave.
const KEY = 'm3d-modo';
let night = true;
try { night = (localStorage.getItem(KEY) || 'noche') == 'noche'; } catch { /* sin almacenamiento */ }
const subs = new Set();
export const uNight = { value: night ? 1 : 0 };
let anim = null;
const step = now => {
  const k = Math.min(1, (now - anim.t0) / 900), e = k * k * (3 - 2 * k);
  uNight.value = anim.from + (anim.to - anim.from) * e;
  subs.forEach(f => f(uNight.value));
  if (k < 1) requestAnimationFrame(step); else anim = null;
};
export const dayNight = {
  get night() { return night; },
  set(n) {
    if (n == night) return; night = n;
    try { localStorage.setItem(KEY, n ? 'noche' : 'dia'); } catch { /* */ }
    anim = { t0: performance.now(), from: uNight.value, to: n ? 1 : 0 }; requestAnimationFrame(step);
    updateButton();
  },
  toggle() { this.set(!night); },
  // f(v) se llama con el valor de uNight (0..1) en cada paso de la transición y una vez al suscribirse
  on(f) { subs.add(f); f(uNight.value); return () => subs.delete(f); },
};
let btn = null;
function updateButton() { if (btn) { btn.textContent = night ? '☾  Noche' : '☀  Día'; btn.title = night ? 'Cambiar a modo día' : 'Cambiar a modo noche'; } }
export function createDayNightButton() {
  btn = document.createElement('button'); btn.id = 'daynight'; btn.type = 'button';
  btn.onclick = () => dayNight.toggle(); updateButton(); document.body.appendChild(btn);
  return btn;
}
