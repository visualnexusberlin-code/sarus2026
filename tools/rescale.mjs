// Escala una nave de la flota sin tocar su modelo: hijos del nodo raíz × k (traslación y escala) y su LOD horneado × k,
// con la base de la nave de nuevo a y = −0,2. Uso: F=in.glb OUT=out.glb NODE=ORION_18 K=0.87 [LAYOUT=separate] node rescale.mjs
import { NodeIO, VertexLayout, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); if (process.env.LAYOUT === 'separate') io.setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(process.env.F), K = +process.env.K, NODE = process.env.NODE;
const main = doc.getRoot().listScenes()[0], V = main.listChildren().find((n) => n.getName() === NODE);
const y0 = getBounds(V).min[1], dy = y0 - K * y0;
for (const c of V.listChildren()) { const t = c.getTranslation(), s = c.getScale(); c.setTranslation([t[0] * K, t[1] * K + dy, t[2] * K]).setScale([s[0] * K, s[1] * K, s[2] * K]); }
const lod = main.listChildren().find((n) => n.getName() === 'LODS')?.listChildren().find((n) => n.getName() === NODE + '_lod');
if (lod) for (const p of lod.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'), arr = a.getArray().slice(); for (let i = 0; i < arr.length; i += 3) { arr[i] *= K; arr[i + 1] = arr[i + 1] * K + dy; arr[i + 2] *= K; } p.setAttribute('POSITION', a.clone().setArray(arr)); }
await io.write(process.env.OUT, doc);
const b = getBounds(V); console.log(NODE, '×', K, 'largo', (b.max[2] - b.min[2]).toFixed(2), 'ancho', (b.max[0] - b.min[0]).toFixed(2), 'base', b.min[1].toFixed(2), 'lod', !!lod);
