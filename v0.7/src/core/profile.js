// Perfil de invitado guardado en local. Más adelante: AuthProvider (Google, Apple, email) sin cambiar esta interfaz.
const KEY = 'menorca3d.profile';
export function loadProfile() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ } }
