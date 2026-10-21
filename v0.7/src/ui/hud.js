import { hex } from '../world/pois.js';
// HUD discreto: nombre, zona actual, lugares (teletransporte de prueba) y atribución.
export function createHud(profile, pois, onTeleport, attribution) {
  document.getElementById('who').textContent = profile.name;
  document.getElementById('attr').textContent = attribution;
  const pl = document.getElementById('pl'); pl.innerHTML = '';
  pois.forEach(p => {
    const b = document.createElement('button'), dot = document.createElement('span');
    dot.style.color = hex(p.color); dot.textContent = '● '; b.append(dot, p.l); b.onclick = () => onTeleport(p); pl.appendChild(b);
  });
  const zoneEl = document.getElementById('zone'), coordsEl = document.getElementById('coords'), bldEl = document.getElementById('bld');
  return {
    show() { document.getElementById('hud').style.display = 'block'; document.getElementById('mm').style.display = 'block'; coordsEl.style.display = 'block'; bldEl.style.display = 'block'; document.getElementById('ui').classList.add('on'); },
    // Edificio más cercano: número para pedir cambios («edificio nº X») y su estado
    setBuilding(b, color) { const k = b ? b.n + color : ''; if (bldEl.dataset.k === k) return; bldEl.dataset.k = k; bldEl.innerHTML = b ? `<i style="background:${color}"></i>Edificio nº ${b.n}` : 'Sin edificio cerca'; },
    setZone(text) { zoneEl.textContent = text; },
    // Coordenadas ETRS89/WGS84 (aprox. < 1 m por la proyección local) y altitud del MDT
    setCoords(lat, lon, alt) { coordsEl.textContent = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}\n${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'O'}\n${alt.toFixed(0)} m`; },
  };
}
