import { THREE, build } from './env.mjs';
const id = process.argv[2];
globalThis.__RESHAPE = { [id]: [] }; const A = await build(id);
delete globalThis.__RESHAPE; const B = await build(id);
const F = A.track.frame(), pts = [];
for (let s = 0; s < A.track.length; s += 4) { A.track.sample(s, F); pts.push(F.pos.clone()); }
let cx = 0, cz = 0; pts.forEach(p => { cx += p.x; cz += p.z; }); cx /= pts.length; cz /= pts.length;
const G = B.track.frame(); let cur = null; const out = [];
for (let s = 0; s < B.track.length; s += 8) { B.track.sample(s, G); let bd = 1e9, bp = null; for (const p of pts) { const d = Math.hypot(p.x - G.pos.x, p.z - G.pos.z); if (d < bd) { bd = d; bp = p; } }
  const toC = Math.hypot(cx - G.pos.x, cz - G.pos.z) < Math.hypot(cx - bp.x, cz - bp.z);
  if (bd > 4) { if (!cur) cur = { a: s, max: 0, inward: 0, n: 0 }; cur.max = Math.max(cur.max, bd); cur.inward += toC ? 1 : 0; cur.n++; cur.b = s; } else if (cur) { out.push(cur); cur = null; } }
if (cur) out.push(cur);
console.log(id, out.map(o => `${o.a}-${o.b} max ${o.max.toFixed(0)}m ${o.inward / o.n > 0.5 ? 'hacia dentro' : 'hacia fuera'}`).join(' | '));
