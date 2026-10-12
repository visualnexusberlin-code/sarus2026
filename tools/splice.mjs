// Sustituye en la flota ligera existente solo ALTAIR_16 y su LOD (el resto queda tal cual)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]), src = await io.read(process.argv[3]);
const NAME = process.env.NODE || 'ALTAIR_16';
// fuente: solo la nave y su LOD
const ss = src.getRoot().listScenes()[0];
for (const n of [...ss.listChildren()]) { if (n.getName() === NAME) continue; if (n.getName() === 'LODS') { for (const c of [...n.listChildren()]) if (c.getName() !== NAME + '_lod') { n.removeChild(c); c.dispose(); } continue; } ss.removeChild(n); n.dispose(); }
await src.transform(prune());
const sc = doc.getRoot().listScenes()[0];
const old = sc.listChildren().find((n) => n.getName() === NAME); const idx = sc.listChildren().indexOf(old);
old.traverse((n) => {}); sc.removeChild(old); old.dispose();
const lods = sc.listChildren().find((n) => n.getName() === 'LODS'); const ol = lods.listChildren().find((c) => c.getName() === NAME + '_lod'); if (ol) { lods.removeChild(ol); ol.dispose(); }
mergeDocuments(doc, src);
const extra = doc.getRoot().listScenes().slice(1);
for (const e of extra) for (const n of [...e.listChildren()]) { e.removeChild(n); if (n.getName() === 'LODS') { for (const c of [...n.listChildren()]) { n.removeChild(c); lods.addChild(c); } n.dispose(); } else sc.addChild(n); }
for (const e of extra) e.dispose();
await doc.transform(prune(), unpartition());
await io.write(process.argv[4], doc);
console.log('ok', sc.listChildren().map((n) => n.getName()).join(' '));
