import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE); const add = await io.read('/tmp/mv/kib_snn.glb');
mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0], buf = root.listBuffers()[0];
const S = +(process.env.S || 0.9);
const V = doc.createNode('KIBEROS_17'); main.addChild(V);
// morro +X → +Z: giro −90° en Y
const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];   // morro −X → +Z
let minY = 1e9; const engines = [];
const hull = doc.createNode('KIBEROS_17_hull').setScale([S, S, S]).setRotation(q);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) {
  sc.removeChild(n);
  
  const b = getBounds(n); minY = Math.min(minY, b.min[1]); hull.addChild(n);
}
for (const z of [-0.085, 0.085]) engines.push([0.946, 0.036, z]);
for (const m of doc.getRoot().listMaterials()) if (!m.getName()) m.setName('KIBEROS | Silver hull').setMetallicFactor(+(process.env.MET || 0.5));
const lift = -0.2 - minY * S; hull.setTranslation([0, lift, 0]);
V.addChild(hull);
// toberas: discos en las tres salidas de motor (mirando hacia atrás, −Z)
const M = main.listChildren().find(n => n.getName() === 'MANTA_9');
const mIon = M.listChildren().find(c => /_ion$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial();
const ionMat = mIon.clone().setName('KIBEROS_Ion');
const pos = [], idx = []; const R = +(process.env.R || 0.05) * S, SEG = 16;
for (const [x, y, z] of engines) {
  const cx = z * S, cy = y * S + lift, cz = -x * S - 0.02; const b = pos.length / 3;
  pos.push(cx, cy, cz); for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz); }
  for (let k = 1; k <= SEG; k++) idx.push(b, b + k + 1, b + k);
}
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const nrm = new Float32Array(pos.length); for (let i = 2; i < nrm.length; i += 3) nrm[i] = -1;
const ionPrim = doc.createPrimitive().setMaterial(ionMat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(nrm, 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR'));
V.addChild(doc.createNode('KIBEROS_17_ion').setMesh(doc.createMesh('KIBEROS_17_ion').addPrimitive(ionPrim)));
// barras de levitación: las de MANTA, ajustadas
const mh = M.listChildren().find(c => /_hover$/.test(c.getName()));
const hv = doc.createNode('KIBEROS_17_hover').setMesh(mh.getMesh()).setScale(mh.getScale()).setTranslation(mh.getTranslation());
V.addChild(hv);
for (const s of scenes.slice(1)) s.dispose();
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
const hb = getBounds(hull); console.log('engines', engines.length, 'hull', hb.min.map(v=>v.toFixed(2)), hb.max.map(v=>v.toFixed(2)));
