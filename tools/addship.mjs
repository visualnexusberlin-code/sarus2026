// Añade a la flota una nave ya preparada (casco con textura, *_Ion para las toberas, *_Hover para las luces de levitación)
// y su logo de hangar (lámina con transparencia a partir de un PNG). El modelo viene con el morro hacia −X y +Y arriba
// (como SAILETOR): aquí se gira a +Z, se escala y se apoya la base en y = −0,2.
// Uso: BASE=ships45.glb MODEL=ako.glb LOGOPNG=ako_logo.png NODE=AKO_23 LOGO=LOGO_AKO S=3.0 OUT=out.glb node tools/addship.mjs
// Modelos de origen: AKO RESEARCH (Ío) y EOS VESSELS (Fobos), preparados a partir de los modelos de Dear (Meshy),
// ver PROYECTO.md.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE);
const add = await io.read(process.env.MODEL);
const S = +(process.env.S || 3.0), NODE = process.env.NODE, LOGO = process.env.LOGO;
const MINY = getBounds(add.getRoot().listScenes()[0]).min[1];

mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0], buf = root.listBuffers()[0];
for (const nm of [NODE]) { const old = main.listChildren().find((n) => n.getName() === nm); if (old) old.dispose(); }
const V = doc.createNode(NODE); main.addChild(V);
const hull = doc.createNode(NODE + '_hull').setScale([S, S, S]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]).setTranslation([0, -0.2 - MINY * S, 0]);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) { sc.removeChild(n); hull.addChild(n); }
V.addChild(hull);
for (const s of scenes.slice(1)) s.dispose();

// logo de hangar: lámina doble cara con el PNG (alfa recortada), ~1,1 de ancho
if (process.env.LOGOPNG) {
  const LOGOS = main.listChildren().find((n) => n.getName() === 'LOGOS');
  const old = LOGOS.listChildren().find((n) => n.getName() === LOGO); if (old) old.dispose();
  const png = await sharp(process.env.LOGOPNG).resize({ width: 1024 }).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  const w = 1.1, h = w * height / width;
  const tex = doc.createTexture(LOGO).setImage(new Uint8Array(png)).setMimeType('image/png');
  const mat = doc.createMaterial(LOGO + '_Face').setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([0.35, 0.35, 0.35])
    .setAlphaMode('MASK').setAlphaCutoff(0.4).setMetallicFactor(0.1).setRoughnessFactor(0.4).setDoubleSided(true);
  const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', A(new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]), 'VEC3'))
    .setAttribute('NORMAL', A(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3'))
    .setAttribute('TEXCOORD_0', A(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 'VEC2'))
    .setIndices(A(new Uint32Array([0, 1, 2, 0, 2, 3]), 'SCALAR'));
  LOGOS.addChild(doc.createNode(LOGO).setMesh(doc.createMesh(LOGO).addPrimitive(prim)));
}
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
console.log('ok', NODE, 'base y', (-0.2).toFixed(2), 'escala', S);
