// TANAKA/ALTAIR: ondulación del casco (cintura, valle tras la cabina, joroba de los carenados, vientre ondulado)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN || 'tanaka_src.glb');
const K = +(process.env.K || 1);
const G = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const f = (x, y, z) => {
  const az = Math.abs(z);
  let nz = z * (1 - 0.11 * K * G(x, -0.8, 0.9));                                     // cintura
  let ny = y - 0.13 * K * G(x, -1.15, 0.6) * sm(0.15, 0.7, y);                         // valle antes del lóbulo
  ny += 0.07 * K * G(x, 1.5, 0.7) * sm(0.45, 0.9, az) * sm(-0.1, 0.4, y);             // joroba de los carenados
  ny -= 0.05 * K * G(x, 0.4, 0.5) * sm(0.45, 0.9, az) * sm(0.0, 0.5, y);              // y su caída tras ella
  ny += 0.07 * K * G(x, -0.4, 0.7) * sm(-0.15, -0.5, y);                              // vientre que sube en el centro
  ny -= 0.04 * K * G(x, -2.0, 0.5) * sm(-0.15, -0.45, y);                             // y baja hacia la cola
  return [x, ny, nz];
};
const done = new Set();
for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; for (const p of m.listPrimitives()) { const acc = p.getAttribute('POSITION'); if (done.has(acc)) continue; done.add(acc); const a = acc.getArray().slice(); for (let i = 0; i < a.length; i += 3) { const r = f(a[i], a[i + 1], a[i + 2]); a[i] = r[0]; a[i + 1] = r[1]; a[i + 2] = r[2]; } acc.setArray(a); } }
await io.write(process.env.OUT || 'tanaka_def.glb', doc); console.log('deformed', done.size);
