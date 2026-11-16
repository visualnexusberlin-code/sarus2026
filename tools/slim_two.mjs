// Flota ligera: ILION_1 y LUDOX_4 (CALIBUR) a ~TARGET triángulos (soldado + simplificación por primitiva, como lite.mjs).
// Estaban en ~32,5k (el doble que el resto) y con la malla sin soldar (2,6 vértices por triángulo).
// Uso: TARGET=16000 node tools/slim_two.mjs ships45_lite.glb ships45_lite.glb
import { NodeIO, VertexLayout } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weldPrimitive, compactPrimitive, unweldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(process.argv[2]); await MeshoptSimplifier.ready;
const TARGET = +(process.env.TARGET || 16000), NODES = (process.env.NODES || 'ILION_1,LUDOX_4').split(',');
// normales con ángulo de arista: cada esquina promedia las caras vecinas que no doblan más de deg grados
function creased(p, deg) {
  unweldPrimitive(p);
  const pa = p.getAttribute('POSITION'), n = pa.getCount(), P = pa.getArray(), F = n / 3, fn = new Float32Array(n);
  const key = (i) => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
  for (let f = 0; f < F; f++) {
    const a = f * 9, ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1;
    fn[f * 3] = x / l; fn[f * 3 + 1] = y / l; fn[f * 3 + 2] = z / l;
  }
  const by = new Map(); for (let i = 0; i < n; i++) { const k = key(i); if (!by.has(k)) by.set(k, []); by.get(k).push(Math.floor(i / 3)); }
  const cos = Math.cos(deg * Math.PI / 180), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const f = Math.floor(i / 3); let x = 0, y = 0, z = 0;
    for (const g of by.get(key(i))) if (fn[f * 3] * fn[g * 3] + fn[f * 3 + 1] * fn[g * 3 + 1] + fn[f * 3 + 2] * fn[g * 3 + 2] >= cos) { x += fn[g * 3]; y += fn[g * 3 + 1]; z += fn[g * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1; N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
  }
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(doc.getRoot().listBuffers()[0]));
  weldPrimitive(p, { tolerance: 0.0001 });   // vuelve a indexar: comparte vértices donde la normal coincide
}
const tri = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
for (const n of doc.getRoot().listScenes()[0].listChildren()) {
  if (!NODES.includes(n.getName())) continue;
  const prims = []; n.traverse((c) => { const m = c.getMesh(); if (m && !/_core$/.test(c.getName())) for (const p of m.listPrimitives()) prims.push(p); });
  const verts = () => prims.reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0);
  const total = prims.reduce((a, p) => a + tri(p), 0), v0 = verts();
  // las normales van separadas por cara: el simplificador no puede soldar aristas. Se sueldan por posición
  // (sin normales), se simplifica y se recalculan normales con ángulo de arista (CREASE grados).
  // las piezas pequeñas (cables, filetes, luces, piloto) no se tocan: el recorte recae solo en las grandes
  const MIN = +(process.env.MIN || 1200), big = prims.filter((p) => tri(p) >= MIN), small = total - big.reduce((a, p) => a + tri(p), 0);
  const ratio = Math.min(1, Math.max(0.05, (TARGET - small) / Math.max(1, total - small)));
  for (const p of big) {
    if (ratio >= 1) continue;
    for (const s of p.listSemantics()) if (s !== 'POSITION') { const a = p.getAttribute(s); p.setAttribute(s, null); if (!a.listParents().some((x) => x !== doc.getRoot() && x !== p)) a.dispose(); }
    weldPrimitive(p, { tolerance: 0.0002 }); compactPrimitive(p);
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: false }); compactPrimitive(p);
    creased(p, +(process.env.CREASE || 38));
  }
  console.log(n.getName().padEnd(10), Math.round(total), '→', Math.round(prims.reduce((a, p) => a + tri(p), 0)), 'triángulos ·', v0, '→', verts(), 'vértices');
}
await io.write(process.argv[3], doc);
