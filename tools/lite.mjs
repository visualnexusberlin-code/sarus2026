// Flota ligera para móviles: cada nave a ~TARGET triángulos (diezmado por primitiva), logos soldados y
// simplificados, texturas a 512 px. Conserva nombres de nodos y materiales (el juego los usa).
import { NodeIO, VertexLayout } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, prune, textureCompress, simplifyPrimitive, weldPrimitive, dedup, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer'; import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
const TARGET = +(process.env.TARGET || 22000), LOGO = +(process.env.LOGO || 1500);
const tri = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
const done = new Set();
for (const n of doc.getRoot().listScenes()[0].listChildren()) {
  const isLogo = n.getName() === 'LOGOS';
  const groups = isLogo ? n.listChildren() : [n];
  for (const g of groups) {
    const prims = []; g.traverse((c) => { const m = c.getMesh(); if (m) for (const p of m.listPrimitives()) if (!done.has(p)) { done.add(p); prims.push(p); } });
    const total = prims.reduce((a, p) => a + tri(p), 0), goal = isLogo ? LOGO : TARGET;
    if (total <= goal) continue;
    const ratio = goal / total;
    for (const p of prims) {
      if (tri(p) < 300) { if (isLogo) { weldPrimitive(p, { tolerance: 0.0001 }); compactPrimitive(p); } continue; }
      weldPrimitive(p, { tolerance: 0.0001 });
      simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false }); compactPrimitive(p);
    }
    console.log(g.getName().padEnd(14), Math.round(total), '→', Math.round(prims.reduce((a, p) => a + tri(p), 0)));
  }
}
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, resize: [512, 512] }));
await io.write(process.argv[3], doc);
