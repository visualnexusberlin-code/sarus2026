import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.F);
const R = doc.getRoot().listScenes()[0].listChildren().find(n => n.getName() === 'RAMA_14');
const h = R.listChildren().find(c => c.getName() === 'RAMA_14_hover');
console.log('antes', h.getScale(), getBounds(h).min.map(v=>v.toFixed(2)), getBounds(h).max.map(v=>v.toFixed(2)));
const s = h.getScale(); h.setScale([s[0] * +process.env.KX, s[1], s[2] * +(process.env.KZ || 1)]);
console.log('después', getBounds(h).min.map(v=>v.toFixed(2)), getBounds(h).max.map(v=>v.toFixed(2)));
await io.write(process.env.F, doc);
