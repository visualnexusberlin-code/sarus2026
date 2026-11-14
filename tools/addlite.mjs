// Añade VOSTOK_21 (nave, logo y LOD) a la flota ligera existente sin regenerar las demás naves.
// Uso: LITE=ships45_lite.glb FULL=ships45_new.glb OUT=out.glb node addlite.mjs
import { NodeIO, VertexLayout } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);   // como lite.mjs: con atributos intercalados el juego no puede fusionar las mallas
const NODE = 'VOSTOK_21', LOGO = 'LOGO_VOSTOK';
const doc = await io.read(process.env.LITE), src = await io.read(process.env.FULL);
const ss = src.getRoot().listScenes()[0];
for (const n of [...ss.listChildren()]) {
  const nm = n.getName();
  if (nm === NODE) continue;
  if (nm === 'LOGOS' || nm === 'LODS') { for (const c of [...n.listChildren()]) if (c.getName() !== LOGO && c.getName() !== NODE + '_lod') c.dispose(); continue; }
  n.dispose();
}
await src.transform(prune(), textureCompress({ encoder: sharp, resize: [512, 512] }));
mergeDocuments(doc, src);
const sc = doc.getRoot().listScenes(), main = sc[0], extra = sc.slice(1);
const find = (s, nm) => s.listChildren().find((n) => n.getName() === nm);
for (const nm of [NODE]) { const o = find(main, nm); if (o) o.dispose(); }
for (const s of extra) for (const n of [...s.listChildren()]) {
  s.removeChild(n);
  if (n.getName() === NODE) main.addChild(n);
  else { const grp = find(main, n.getName()); for (const c of [...n.listChildren()]) { const o = grp.listChildren().find((x) => x.getName() === c.getName()); if (o) o.dispose(); n.removeChild(c); grp.addChild(c); } n.dispose(); }
}
for (const s of extra) s.dispose();
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
console.log('ok', main.listChildren().map((n) => n.getName()).join(' '));
