// ─────────────────────────────────────────────────────────────
//  SARUS · idioma (español / inglés)
//  Se decide al cargar: ?lang=es|en manda; si no, la preferencia guardada; si no, el idioma del navegador
//  (español → es; cualquier otro → en). Cambiar de idioma recarga la página, así cada texto se elige una vez.
//  · L('texto es', 'text en') en los datos y en el código
//  · index.html: el texto español va en el HTML y el inglés en data-en / data-en-aria
//  Nombres propios (naves, escuderías, modelos, circuitos) no se traducen.
// ─────────────────────────────────────────────────────────────
const q = new URLSearchParams(location.search);
let pref = null;
try { pref = localStorage.getItem('sarus-lang'); } catch (e) { /* sin almacenamiento */ }
const browser = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
const asked = q.get('lang');
export const LANG = asked === 'es' || asked === 'en' ? asked : pref === 'es' || pref === 'en' ? pref : browser;
export const EN = LANG === 'en';

export const L = (es, en) => (EN ? en : es);

export function setLang(lang) {
  try { localStorage.setItem('sarus-lang', lang); } catch (e) { /* sin almacenamiento */ }
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.replace(u.toString());
}

// textos fijos del HTML
export function applyDom(root = document) {
  document.documentElement.lang = LANG;
  if (!EN) return;
  root.querySelectorAll('[data-en]').forEach((el) => { el.textContent = el.dataset.en; });
  root.querySelectorAll('[data-en-aria]').forEach((el) => el.setAttribute('aria-label', el.dataset.enAria));
}

// número ordinal de posición: 3º / 3rd
export function ord(n) {
  if (!EN) return `${n}º`;
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
}
