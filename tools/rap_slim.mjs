import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer'; import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
const m = doc.getRoot().listMaterials()[0];
m.getBaseColorTexture().setName('ALTAIR_raptor_base'); m.getNormalTexture()?.setName('ALTAIR_raptor_nrm'); m.getMetallicRoughnessTexture()?.setName('ALTAIR_raptor_mr');
await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: +(process.env.RATIO || 0.35), error: 0.0005 }), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [2048, 2048], slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], slots: /normal|metallicRoughness/ }));
let n = 0; for (const me of doc.getRoot().listMeshes()) for (const p of me.listPrimitives()) n += p.getIndices().getCount() / 3;
await io.write(process.argv[3], doc); console.log('tris', n);
