// Calidad: «completa» (escritorio) o «ligera» (móviles y equipos modestos). Se decide al cargar:
//   ?lite / ?full en la URL mandan; si no, la preferencia guardada; si no, detección automática
//   (pantalla táctil sin 8 GB de memoria y 8 núcleos → ligera).
const q = new URLSearchParams(location.search);
let pref = null;
try { pref = localStorage.getItem('srs-quality'); } catch (e) { /* sin almacenamiento */ }
const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in globalThis;
const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
const auto = touch && !(mem >= 8 && cores >= 8);
export const LITE = q.has('lite') ? true : q.has('full') ? false : pref ? pref === 'lite' : auto;

export const QUALITY = LITE
  ? { lite: true, rivals: 9, prMin: 0.6, prMax: 1.0, prStart: 1.0, shadows: false, ao: false, smaa: false, bloomScale: 0.25, segs: 0.5 }
  : { lite: false, rivals: 99, prMin: 0.75, prMax: 2.0, prStart: 1.5, shadows: true, ao: true, smaa: true, bloomScale: 0.5, segs: 1 };

export function setQuality(lite) {
  try { localStorage.setItem('srs-quality', lite ? 'lite' : 'full'); } catch (e) { /* sin almacenamiento */ }
  const u = new URL(location.href); u.searchParams.delete('lite'); u.searchParams.delete('full');
  location.replace(u.toString());
}
