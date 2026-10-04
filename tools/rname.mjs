// RAMA: letras de la escudería sobre las dos góndolas traseras (calcomanía que sigue la superficie) + piloto más atrás
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { mat4, vec3 } from 'gl-matrix';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.F);
const root = doc.getRoot(), buf = root.listBuffers()[0];
const V = root.listScenes()[0].listChildren().find(n => n.getName() === 'RAMA_14');
for (const c of [...V.listChildren()]) if (c.getName() === 'RAMA_14_name') c.dispose();
// piloto hacia atrás
const pil = V.listChildren().find(c => c.getName() === 'RAMA_14_pilot');
if (process.env.DZ) { const t = pil.getTranslation(); pil.setTranslation([t[0], t[1] + +(process.env.DY || 0), t[2] + +process.env.DZ]); }
// letras: trazos geométricos finos, A sin travesaño, subrayado curvo que nace bajo la R
const W = 2048, H = 320, sw = 13, LS = 300, x0 = 330, top = 70, bot = 210;
const glyph = { R: (x) => `M${x},${bot} L${x},${top} L${x + 120},${top} Q${x + 170},${top} ${x + 170},${(top + 140) / 2 + 2} Q${x + 170},${top + 70} ${x + 120},${top + 72} L${x},${top + 72} M${x + 95},${top + 72} L${x + 175},${bot}`,
  A: (x) => `M${x},${bot} L${x + 90},${top} L${x + 180},${bot}`,
  M: (x) => `M${x},${bot} L${x},${top} L${x + 95},${bot - 30} L${x + 190},${top} L${x + 190},${bot}` };
const d = ['R', 'A', 'M', 'A'].map((c, i) => glyph[c](x0 + i * LS)).join(' ');
const swoosh = `M${x0 - 60},${top - 40} Q${x0 - 120},${bot + 50} ${x0 + 40},${bot + 52} L${x0 + 4 * LS + 40},${bot + 44}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <path d="${d}" fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="miter"/>
  <path d="${swoosh}" fill="none" stroke="#ffffff" stroke-width="${sw * 1.6}" stroke-linecap="round"/>
</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await sharp(png).flatten({ background: '#777' }).toFile('/tmp/mv/rama_name_preview.png');
const tex = doc.createTexture('RAMA_name').setImage(new Uint8Array(png)).setMimeType('image/png');
const mat = doc.createMaterial('RAMA_Name').setBaseColorFactor([0.08, 0.2, 0.22, 1]).setBaseColorTexture(tex).setAlphaMode('BLEND').setMetallicFactor(0.6).setRoughnessFactor(0.3).setDoubleSided(true);
// vértices del casco (nácar) en el espacio de la nave
const hull = V.listChildren().find(c => c.getName() === 'RAMA_14_hull');
const P = [];
hull.traverse((n) => { const m = n.getMesh(); if (!m) return; const M = n.getWorldMatrix(); for (const p of m.listPrimitives()) { if (!/Pearl ceramic/.test(p.getMaterial().getName())) continue; const a = p.getAttribute('POSITION'); const v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const o = vec3.transformMat4([0, 0, 0], v, M); P.push(o); } } });
const surfY = (x, z, r = 0.13) => { let y = -1e9; for (const p of P) if (Math.abs(p[0] - x) < r && Math.abs(p[2] - z) < r) y = Math.max(y, p[1]); return y; };
const pos = [], uv = [], idx = [];
const LEN = +(process.env.LEN || 0.62), HGT = LEN * H / W, CZ = +(process.env.CZ || -1.75), CX = +(process.env.CX || 0.86);
const NU = 40, NV = 6;
for (const side of [-1, 1]) {
  const base = pos.length / 3, cx = side * CX;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = i / NU, v = j / NV;
    const x = cx + (0.5 - u) * LEN;            // u a lo ancho (vista desde atrás: derecha = −x)
    const z = CZ + (v - 0.5) * HGT;            // v hacia el morro
    const y = surfY(x, z) + 0.008;
    pos.push(x, y, z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
}
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const nrm = []; for (let i = 0; i < pos.length; i += 3) nrm.push(0, 1, 0);
const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')).setIndices(A(new Uint32Array(idx), 'SCALAR'));
V.addChild(doc.createNode('RAMA_14_name').setMesh(doc.createMesh('RAMA_14_name').addPrimitive(prim)));
let ys = []; for (let i = 1; i < pos.length; i += 3) ys.push(pos[i]); console.log('y', Math.min(...ys).toFixed(2), Math.max(...ys).toFixed(2), 'pts', P.length);
await io.write(process.env.F, doc);
