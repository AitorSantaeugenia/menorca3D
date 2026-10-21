import { MENU } from '../config/destinations.js';
import { PRESETS, BODIES } from '../character/presets.js';
import { loadProfile, saveProfile } from '../core/profile.js';
// Logo → ¿dónde explorar? → zona → nombre y personaje. Devuelve {destId, municipality, profile}.
export function runOnboarding(onPreview) {
  const ov = document.getElementById('overlay'), saved = loadProfile() || {};
  const sel = { preset: saved.preset || 0, body: saved.body || 0 };
  const show = html => { ov.innerHTML = '<div class="panel"><div class="logo">MENORCA<span>3D</span></div>' + html + '</div>'; };
  const chips = (el, items, key) => { el.innerHTML = ''; items.forEach((it, i) => { const b = document.createElement('button'); b.className = 'chip' + (sel[key] == i ? ' on' : ''); b.textContent = it.name; b.onclick = () => { sel[key] = i; onPreview(sel); chips(el, items, key); }; el.appendChild(b); }); };
  const button = (parent, text, fn) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = text; b.onclick = fn; parent.appendChild(b); };
  return new Promise(res => {
    show('<div class="sub">Explora Menorca · empezamos por Es Castell</div><button class="go" id="b0">Empezar</button>');
    ov.querySelector('#b0').onclick = () => {
      show('<div style="font-size:18px">¿Dónde quieres explorar?</div><div class="row" id="m"></div>');
      MENU.forEach(mu => button(ov.querySelector('#m'), mu.name, () => {
        const zoneStep = f => { if (mu.children.length == 1) return f(mu.children[0]);   // una sola zona: directamente al personaje
          show(`<div style="font-size:18px">¿Qué zona de ${mu.name}?</div><div class="row" id="z"></div>`);
          mu.children.forEach(ch => button(ov.querySelector('#z'), ch.name, () => f(ch))); };
        zoneStep(ch => {
          show('<label for="nm" style="font-size:18px">¿Cómo quieres que te llamemos?</label><input id="nm" maxlength="20" placeholder="Nombre" autocomplete="off"><div>Elige tu personaje</div><div class="row" id="pr"></div><div class="row" id="bo"></div><button class="go" id="go"></button>');
          ov.querySelector('#go').textContent = 'Entrar en ' + ch.name;
          ov.querySelector('#nm').value = saved.name || '';
          chips(ov.querySelector('#pr'), PRESETS, 'preset'); chips(ov.querySelector('#bo'), BODIES, 'body'); onPreview(sel);
          ov.querySelector('#go').onclick = () => {
            const profile = { name: ov.querySelector('#nm').value.trim() || 'Visitante', ...sel };
            saveProfile(profile); ov.classList.add('hide'); res({ destId: ch.dest, municipality: mu, profile });
          };
        });
      }));
    };
  });
}
