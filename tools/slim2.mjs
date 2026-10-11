// Diezma nodos concretos de la flota completa (ONLY=NODO1,NODO2 TARGET=n) y elimina triángulos duplicados exactos
// (mismos 3 vértices, en cualquier sentido) en todas las naves: provocan parpadeo (z-fighting) al girar.
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weldPrimitive, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); await MeshoptSimplifier.ready;
const ONLY = new Set((process.env.ONLY || '').split(',').filter(Boolean)), TARGET = +(process.env.TARGET || 60000);
const tri = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
function dedupTris(p) {
  const idx = p.getIndices(); if (!idx) return 0; const pos = p.getAttribute('POSITION');
  const k = (i) => pos.getElement(i, [0, 0, 0]).map((x) => Math.round(x * 4000)).join(',');
  const seen = new Set(), out = []; let removed = 0; const a = idx.getArray();
  for (let i = 0; i < a.length; i += 3) { const key = [k(a[i]), k(a[i + 1]), k(a[i + 2])].sort().join('|'); if (seen.has(key)) { removed++; continue; } seen.add(key); out.push(a[i], a[i + 1], a[i + 2]); }
  if (removed) idx.setArray(new (a.constructor)(out));
  return removed;
}
for (const n of doc.getRoot().listScenes()[0].listChildren()) {
  const name = n.getName(); if (name === 'LOGOS' || name === 'LODS') continue;
  const prims = []; n.traverse((c) => { const m = c.getMesh(); if (m) prims.push(...m.listPrimitives()); });
  let rm = 0;
  if (ONLY.has(name)) {
    const total = prims.reduce((a, p) => a + tri(p), 0), ratio = TARGET / total;
    for (const p of prims) { if (tri(p) < 300 || /Name|_Ion|_Hover/.test(p.getMaterial()?.getName() || '')) continue; weldPrimitive(p, { tolerance: 0.0001 }); simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }); compactPrimitive(p); }
    console.log(name, 'diezmado', Math.round(total), '→', Math.round(prims.reduce((a, p) => a + tri(p), 0)));
  }
  for (const p of prims) rm += dedupTris(p);
  if (rm) console.log(name, 'duplicados eliminados', rm);
}
await io.write(process.argv[3], doc);
