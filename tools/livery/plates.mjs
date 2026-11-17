// SARUS · sistema de rotulado de carenado (nov. 2026)
// Cada nave lleva la misma pieza, una «placa de identidad»: un bloque de tinta con el extremo izquierdo en semicírculo
// (los bloques redondeados y los círculos-terminal de los carteles de referencia) y, dentro:
//  · un círculo de acento con el color de la propulsión de la escudería (el único color de la pieza);
//  · el NOMBRE en Michroma, la tipografía de la interfaz, engrosado para que aguante la distancia;
//  · un raíl de «tinta sobre papel»: barra con nodos que codifica en binario el número de la nave (cada nave el suyo);
//  · el resto del nombre de la escudería y su número en IBM Plex Mono.
// El bloque oscuro garantiza el contraste sobre cualquier casco (cromo, nácar, blindaje con relieve).
// Todas las placas van a un único atlas: una textura y un material para toda la flota.
import fs from 'node:fs';
import opentype from 'opentype.js';

const FONTS = process.env.FONTS || '/tmp/work/livery/ttf';
const display = opentype.parse(fs.readFileSync(`${FONTS}/Michroma.ttf`).buffer);
const mono = opentype.parse(fs.readFileSync(`${FONTS}/PlexMono-500.ttf`).buffer);

export const TILE_W = 1024, TILE_H = 256;
export const PANEL = '#111318', INK = '#eef0f3';

function layout(font, text, size, track) {
  const glyphs = font.stringToGlyphs(text); let x = 0; const parts = [];
  glyphs.forEach((g, i) => { parts.push([g, x]); x += g.advanceWidth / font.unitsPerEm * size + (i < glyphs.length - 1 ? track * size : 0); });
  return { width: x, path: (ox, oy) => parts.map(([g, gx]) => g.getPath(ox + gx, oy, size).toPathData(2)).join(' ') };
}
const capH = (font) => (font.tables.os2.sCapHeight || font.ascender * 0.7) / font.unitsPerEm;
const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

// d: { name, num, house, flame:[r,g,b] }
export function plateSVG(d, ox = 0, oy = 0) {
  const W = TILE_W, H = TILE_H, m = 6, R = (H - 2 * m) / 2;
  const f = d.flame, mx = Math.max(...f), acc = hex(f.map((v) => v / mx));
  // bloque: semicírculo a la izquierda, corte recto a la derecha
  const panel = `<path d="M${ox + m + R},${oy + m} H${ox + W - m} V${oy + H - m} H${ox + m + R} A${R},${R} 0 0 1 ${ox + m + R},${oy + m} Z" fill="${PANEL}"/>`;
  const dot = `<circle cx="${ox + m + R}" cy="${oy + H / 2}" r="${R * 0.52}" fill="${acc}"/>`;
  // nombre
  const x0 = ox + m + 2 * R + 14, x1 = ox + W - 40, track = 0.06, maxCap = 92, cap = capH(display);
  let size = 200, L = layout(display, d.name, size, track);
  size = Math.min(size * (x1 - x0) / L.width, maxCap / cap); L = layout(display, d.name, size, track);
  const base = oy + 44 + maxCap;
  const name = `<path d="${L.path(x0, base)}" fill="${INK}" stroke="${INK}" stroke-width="${(size * 0.028).toFixed(1)}" stroke-linejoin="miter"/>`;
  // raíl con nodos: cinco bits del número (1 = nodo; 0 = la barra se corta)
  const ry = base + 50, t = 8, r = 13, rx1 = x0 + 330, bits = (+d.num).toString(2).padStart(5, '0'), step = (rx1 - x0) / 6;
  let rail = '', seg = x0;
  for (let i = 0; i < 5; i++) {
    const cx = x0 + step * (i + 1);
    if (bits[i] === '1') rail += `<circle cx="${cx}" cy="${ry}" r="${r}" fill="${INK}"/>`;
    else { rail += `<rect x="${seg}" y="${ry - t / 2}" width="${cx - r - seg}" height="${t}" fill="${INK}"/>`; seg = cx + r; }
  }
  rail += `<rect x="${seg}" y="${ry - t / 2}" width="${rx1 - seg}" height="${t}" fill="${INK}"/>`;
  // micro: resto del nombre de escudería + número
  const rest = d.house.startsWith(d.name) ? d.house.slice(d.name.length).trim() : d.house;
  const micro = [rest, `N°${String(+d.num).padStart(2, '0')}`].filter(Boolean).join('  ·  ');
  let ms = 25, M = layout(mono, micro, ms, 0.08); const room = x1 - (rx1 + 30);
  if (M.width > room) { ms *= room / M.width; M = layout(mono, micro, ms, 0.08); }
  const microP = `<path d="${M.path(x1 - M.width, ry + capH(mono) * ms / 2)}" fill="${INK}" fill-opacity="0.82"/>`;
  return panel + dot + name + rail + microP;
}

export function atlasSVG(list, cols = 2) {
  const rows = Math.ceil(list.length / cols);
  const body = list.map((d, i) => plateSVG(d, (i % cols) * TILE_W, Math.floor(i / cols) * TILE_H)).join('');
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * TILE_W}" height="${rows * TILE_H}">${body}</svg>`, cols, rows };
}
