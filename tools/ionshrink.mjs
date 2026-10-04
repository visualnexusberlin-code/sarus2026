import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.F);
const n = doc.getRoot().listNodes().find(n => n.getName() === process.env.NODE);
const a = n.getMesh().listPrimitives()[0].getAttribute('POSITION'), p = a.getArray().slice(), per = +process.env.PER, k = +process.env.K;
for (let d = 0; d < p.length / 3 / per; d++) { const c = d * per * 3; for (let i = 1; i < per; i++) for (let j = 0; j < 3; j++) p[c + i * 3 + j] = p[c + j] + (p[c + i * 3 + j] - p[c + j]) * k; }
a.setArray(p); await io.write(process.env.F, doc); console.log('ok', p.length / 3 / per, 'discos');
