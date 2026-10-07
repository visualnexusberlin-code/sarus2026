import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer'; import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: +(process.env.RATIO || 0.08), error: 0.0008 }), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024] }));
let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += p.getAttribute('POSITION').getCount();
await io.write(process.argv[3], doc); console.log('verts', n);
