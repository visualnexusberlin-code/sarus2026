// Datos de la flota leídos de js/fleet.js y js/lore.js sin ejecutarlos (dependen del navegador)
import fs from 'node:fs';
export function fleetData(repo) {
  const F = fs.readFileSync(`${repo}/js/fleet.js`, 'utf8'), Lr = fs.readFileSync(`${repo}/js/lore.js`, 'utf8');
  const out = [];
  for (const m of F.matchAll(/\{ num: '(\d+)', node: '([A-Z0-9_]+)', hull: \d+, flame: \[([^\]]+)\], name: '([^']+)'/g)) {
    const h = Lr.match(new RegExp(`${m[2]}: \\{ house: '([^']+)', model: '([^']+)'`));
    out.push({ num: m[1], node: m[2], flame: m[3].split(',').map(Number), name: m[4], house: h ? h[1] : m[4], model: h ? h[2] : '' });
  }
  return out;
}
