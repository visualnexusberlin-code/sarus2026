// Cambia la textura de ALTAIR por la editada a mano (mismo tamaño y misma disposición de vistas).
// Uso: node retex.mjs flota.glb textura.png salida.glb
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.argv[2]);
const t = doc.getRoot().listTextures().find((x) => x.getName() === 'ALTAIR_textura_editable');
t.setImage(fs.readFileSync(process.argv[3])).setMimeType(process.argv[3].endsWith('.jpg') ? 'image/jpeg' : 'image/png');
for (const m of doc.getRoot().listMaterials()) if (m.getName() === 'ALTAIR | Burnished bronze') m.setMetallicFactor(0.8).setRoughnessFactor(0.34);
await io.write(process.argv[4], doc); console.log('ok');
