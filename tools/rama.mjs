import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE); const add = await io.read('/tmp/mv/rama.glb');
mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0], buf = root.listBuffers()[0];
const S = +(process.env.S || 0.78);
const V = doc.createNode('RAMA_14'); main.addChild(V);
// morro +X → +Z: giro −90° en Y
const q = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
let minY = 1e9; const engines = [[-3.76, -0.08, 0.78], [-3.76, -0.08, -0.78]];
const hull = doc.createNode('RAMA_14_hull').setScale([S, S, S]).setRotation(q);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) {
  sc.removeChild(n);
  
  hull.addChild(n); const b = getBounds(n); minY = Math.min(minY, b.min[1]);
}
const lift = -0.2 - minY * S; hull.setTranslation([0, lift, 0]);
V.addChild(hull);
// toberas: discos en las tres salidas de motor (mirando hacia atrás, −Z)
const M = main.listChildren().find(n => n.getName() === 'MANTA_9');
const mIon = M.listChildren().find(c => /_ion$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial();
const ionMat = mIon.clone().setName('RAMA_Ion');
const pos = [], idx = []; const R = 0.34 * S, SEG = 20;
for (const [x, y, z] of engines) {
  const cx = -z * S, cy = y * S + lift, cz = x * S - 0.02; const b = pos.length / 3;
  pos.push(cx, cy, cz); for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz); }
  for (let k = 1; k <= SEG; k++) idx.push(b, b + k + 1, b + k);
}
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const nrm = new Float32Array(pos.length); for (let i = 2; i < nrm.length; i += 3) nrm[i] = -1;
const ionPrim = doc.createPrimitive().setMaterial(ionMat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(nrm, 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR'));
V.addChild(doc.createNode('RAMA_14_ion').setMesh(doc.createMesh('RAMA_14_ion').addPrimitive(ionPrim)));
// barras de levitación: las de MANTA, ajustadas
const mh = M.listChildren().find(c => /_hover$/.test(c.getName()));
const hv = doc.createNode('RAMA_14_hover').setMesh(mh.getMesh()).setScale(mh.getScale()).setTranslation(mh.getTranslation());
V.addChild(hv);
// piloto estándar (el de NEXUS) dentro de la cabina
{
  const nx = main.listChildren().find(n => n.getName() === 'NEXUS_8'), ck = nx.listChildren().find(c => c.getName() === 'NEXUS_8_cockpit');
  const pil = ck.listChildren().filter(c => /^PILOT/.test(c.getName()));
  let pmin = [1e9,1e9,1e9], pmax = [-1e9,-1e9,-1e9]; for (const p of pil) { const b = getBounds(p); for (let i=0;i<3;i++){ pmin[i]=Math.min(pmin[i],b.min[i]); pmax[i]=Math.max(pmax[i],b.max[i]); } }
  const ckT = ck.getTranslation(), ckS = ck.getScale()[0], k = +(process.env.PK || 0.85);
  const headTop = 0.74 * S + lift, pz = +(process.env.PZ || 0.35) * S, pcz = (pmin[2] + pmax[2]) / 2;
  const rig = doc.createNode('RAMA_14_pilot').setScale([k, k, k]).setTranslation([0, headTop - pmax[1] * k, pz - pcz * k]);
  for (const p of pil) { const t = p.getTranslation(); rig.addChild(doc.createNode(p.getName()).setMesh(p.getMesh()).setTranslation([ckT[0] + ckS*t[0], ckT[1] + ckS*t[1], ckT[2] + ckS*t[2]]).setScale([ckS,ckS,ckS]).setRotation(p.getRotation())); }
  V.addChild(rig);
}
for (const s of scenes.slice(1)) s.dispose();
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
const hb = getBounds(hull); console.log('engines', engines.length, 'hull', hb.min.map(v=>v.toFixed(2)), hb.max.map(v=>v.toFixed(2)));
