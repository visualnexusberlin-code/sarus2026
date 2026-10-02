import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.F);
const sh = doc.getRoot().listScenes()[0].listChildren().find(n => n.getName() === 'LUDOX_4');
sh.traverse(n => { const m = n.getMesh(); if (!m) return; for (const p of m.listPrimitives()) if (/signal vermilion/.test(p.getMaterial().getName())) {
  const at = p.getAttribute('POSITION'), a = at.getArray().slice(); let c = 0;
  for (let i=0;i<a.length;i+=3) if (Math.abs(a[i])<0.05 && a[i+2]>1.05 && a[i+2]<1.6 && a[i+1]>0.95) { a[i+1]-=0.2; c++; }
  at.setArray(a); console.log('moved', c); } });
await io.write(process.env.F, doc);
