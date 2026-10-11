// Nombre de escudería sobre el carenado: calcomanía que sigue la superficie, a lo largo de la nave en ambos costados,
// legible desde fuera. MODE=ghost: obsidiana iridiscente (solo aparece con el reflejo) · MODE=enamel: esmalte de color
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS, KHRMaterialsIridescence } from '@gltf-transform/extensions';
import sharp from 'sharp'; import { vec3 } from 'gl-matrix';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.F);
const root = doc.getRoot(), buf = root.listBuffers()[0], NODE = process.env.NODE, TEXT = process.env.TEXT, MODE = process.env.MODE || 'enamel';
const V = root.listScenes()[0].listChildren().find(n => n.getName() === NODE);
for (const c of [...V.listChildren()]) if (c.getName() === NODE + '_name') c.dispose();
const W = 2048, H = 256;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="${W / 2}" y="${H * 0.72}" text-anchor="middle" font-family="Michroma" font-size="${H * 0.62}" letter-spacing="${H * 0.16}" fill="#fff" stroke="#fff" stroke-width="${H * (+process.env.BOLD || 0)}">${TEXT}</text></svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await sharp(png).flatten({ background: '#555' }).toFile(`/tmp/mv/${NODE}_name_preview.png`);
const tex = doc.createTexture(NODE + '_name').setImage(new Uint8Array(png)).setMimeType('image/png');
const mat = doc.createMaterial(NODE.split('_')[0] + '_Name').setBaseColorTexture(tex).setAlphaMode('BLEND').setDoubleSided(false);
if (MODE === 'ghost') {
  mat.setBaseColorFactor([0.02, 0.02, 0.03, 1]).setMetallicFactor(1).setRoughnessFactor(0.1);
  const ext = doc.createExtension(KHRMaterialsIridescence);
  mat.setExtension('KHR_materials_iridescence', ext.createIridescence().setIridescenceFactor(1).setIridescenceIOR(1.9).setIridescenceThicknessMinimum(280).setIridescenceThicknessMaximum(760));
} else {
  mat.setBaseColorFactor([0.45, 0.01, 0.008, 1]).setMetallicFactor(0).setRoughnessFactor(0.5).setEmissiveTexture(tex).setEmissiveFactor([0.42, 0.0, 0.0]);
}
const hull = V.listChildren().find(c => /_hull$/.test(c.getName())); const P = [];
hull.traverse((n) => { const m = n.getMesh(); if (!m) return; const M = n.getWorldMatrix(); for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); P.push(vec3.transformMat4([0, 0, 0], v, M)); } } });
const surfY = (x, z) => { const r = +process.env.R || 0.08; let y = -1e9; for (const p of P) if (Math.abs(p[0] - x) < r && Math.abs(p[2] - z) < r) y = Math.max(y, p[1]); return y; };
const LEN = +process.env.LEN, HGT = LEN * H / W * 1.15, CZ = +process.env.CZ, CX = +process.env.CX, NU = 128, NV = 6;
const pos = [], uv = [], idx = [];
for (const s of [-1, 1]) {
  const base = pos.length / 3;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = i / NU, v = j / NV;
    const z = CZ - s * (u - 0.5) * LEN;                    // a lo largo: legible desde su costado
    const x = s * (CX + (0.5 - v) * HGT);                  // la parte alta de las letras hacia el eje
    pos.push(x, surfY(x, z) + (+process.env.LIFT || 0.01), z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; if (s > 0) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c); }
}
// huecos del muestreo (juntas, rendijas): cada vértice no baja más de 5 cm de la mediana de su fila
for (let k = 0; k < 2; k++) for (let j = 0; j <= NV; j++) {
  const row = []; for (let i = 0; i <= NU; i++) row.push((k * (NV + 1) * (NU + 1) + j * (NU + 1) + i) * 3 + 1);
  const med = row.map((q) => pos[q]).sort((a, b) => a - b)[Math.floor(row.length / 2)];
  for (const q of row) if (pos[q] < med - 0.05) pos[q] = med;
}
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const nrm = []; for (let i = 0; i < pos.length; i += 3) nrm.push(0, 1, 0);
const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')).setIndices(A(new Uint32Array(idx), 'SCALAR'));
V.addChild(doc.createNode(NODE + '_name').setMesh(doc.createMesh(NODE + '_name').addPrimitive(prim)));
const ys = []; for (let i = 1; i < pos.length; i += 3) ys.push(pos[i]); console.log(NODE, 'y', Math.min(...ys).toFixed(2), Math.max(...ys).toFixed(2));
await io.write(process.env.F, doc);
