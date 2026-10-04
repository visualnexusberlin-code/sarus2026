import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE); const add = await io.read('/tmp/mv/manta_v1.glb');
const addRoots = add.getRoot().listScenes()[0].listChildren().map(n => n.getName());
mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0];
const M = main.listChildren().find(n => n.getName() === 'MANTA_9');
for (const c of [...M.listChildren()]) if (!/_ion$|_hover$/.test(c.getName())) { M.removeChild(c); c.dispose(); }
const S = +(process.env.S || 2.7);
const hull = doc.createNode('MANTA_9_hull').setScale([S, S, S]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]).setTranslation([0, -0.2 + 0.22 * S, 0]);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) { sc.removeChild(n); hull.addChild(n); }
M.addChild(hull);
const ion = M.listChildren().find(c => /_ion$/.test(c.getName()));
const [x0, x1, yc, zc] = JSON.parse(process.env.IONBOX);
ion.setTranslation([0,0,0]).setScale([1,1,1]); const b = getBounds(ion);
const sx = (x1 - x0) / Math.max(0.05, b.max[0] - b.min[0]), sy = 0.35;
ion.setScale([sx, sy, 1]).setTranslation([-(b.min[0] + b.max[0]) / 2 * sx, yc - (b.min[1] + b.max[1]) / 2 * sy, zc - b.min[2]]);
const hov = M.listChildren().find(c => /_hover$/.test(c.getName()));
{ hov.setTranslation([0,0,0]).setScale([1,1,1]); const hb = getBounds(hov); const kx = 1.1 / Math.max(Math.abs(hb.min[0]), hb.max[0]), kz = 2.1 / Math.max(Math.abs(hb.min[2]), hb.max[2]); hov.setScale([kx, 1, kz]); console.log('hover k', kx.toFixed(2), kz.toFixed(2)); }
for (const s of scenes.slice(1)) s.dispose();
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
const hb = getBounds(hull); console.log('hull', hb.min.map(v=>v.toFixed(2)), hb.max.map(v=>v.toFixed(2)), 'ion', getBounds(ion).min.map(v=>v.toFixed(2)), getBounds(ion).max.map(v=>v.toFixed(2)));
