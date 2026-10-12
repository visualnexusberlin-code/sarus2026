// ALTAIR: UV nuevas legibles (proyecciones planas por vistas) y textura horneada en ellas, para editar en Photoshop.
// Distribución 2048 px (misma escala en todas las vistas, el morro siempre hacia arriba o a la izquierda):
//   arriba izq.: VISTA SUPERIOR (morro arriba) · arriba dcha.: VISTA INFERIOR (espejo, como vista desde abajo)
//   centro: COSTADO IZQUIERDO (morro a la izq.) y COSTADO DERECHO (morro a la dcha.)
//   abajo: FRENTE y POPA
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp'; import { vec3 } from 'gl-matrix'; import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN), buf = doc.getRoot().listBuffers()[0];
const V = doc.getRoot().listScenes()[0].listChildren().find((n) => n.getName() === 'ALTAIR_16');
const hull = V.listChildren().find((n) => n.getName() === 'ALTAIR_16_hull').listChildren()[0];
const N = 2048, OUTDIR = process.env.TEX || 'tex2'; fs.mkdirSync(OUTDIR, { recursive: true });
const prims = hull.getMesh().listPrimitives().filter((p) => !/Edge glow/.test(p.getMaterial().getName()));
// límites del casco (coordenadas del modelo de origen: morro −X, derecha −Z, arriba +Y)
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of prims) { const a = p.getAttribute('POSITION'), v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } } }
const Lx = mx[0] - mn[0], Ly = mx[1] - mn[1], Lz = mx[2] - mn[2], s = 980 / Math.max(Lx, Lz);
const R = {   // origen de cada vista en píxeles
  top: [12 + (1000 - Lz * s) / 2, 12], bot: [1036 + (1000 - Lz * s) / 2, 12],
  left: [12, 1040], right: [1036, 1040], front: [12 + (1000 - Lz * s) / 2, 1080 + Ly * s], back: [1036 + (1000 - Lz * s) / 2, 1080 + Ly * s],
};
const proj = (view, p) => {
  const [x, y, z] = p, o = R[view];
  if (view === 'top') return [o[0] + (mx[2] - z) * s, o[1] + (x - mn[0]) * s];
  if (view === 'bot') return [o[0] + (z - mn[2]) * s, o[1] + (x - mn[0]) * s];
  if (view === 'left') return [o[0] + (x - mn[0]) * s, o[1] + (mx[1] - y) * s];
  if (view === 'right') return [o[0] + (mx[0] - x) * s, o[1] + (mx[1] - y) * s];
  if (view === 'front') return [o[0] + (mx[2] - z) * s, o[1] + (mx[1] - y) * s];
  return [o[0] + (z - mn[2]) * s, o[1] + (mx[1] - y) * s];
};
const out = Buffer.alloc(N * N * 3), cov = new Uint8Array(N * N);
const texCache = new Map();
const texOf = async (m) => { const t = m.getBaseColorTexture(); if (!t) return null; if (!texCache.has(t)) texCache.set(t, await sharp(Buffer.from(t.getImage())).resize(N, N).removeAlpha().raw().toBuffer()); return texCache.get(t); };
const counts = {};
for (const p of prims) {
  const m = p.getMaterial(), img = await texOf(m), fac = m.getBaseColorFactor().map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255));
  const P = p.getAttribute('POSITION'), NR = p.getAttribute('NORMAL'), UV = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
  const nP = [], nN = [], nU = [];
  for (let k = 0; k < I.getCount(); k += 3) {
    const ids = [0, 1, 2].map((j) => I.getScalar(k + j));
    const pos = ids.map((i) => P.getElement(i, [0, 0, 0])), uvo = ids.map((i) => UV.getElement(i, [0, 0]));
    const n = vec3.normalize([], vec3.cross([], vec3.sub([], pos[1], pos[0]), vec3.sub([], pos[2], pos[0])));
    const ax = [Math.abs(n[0]), Math.abs(n[1]) * 1.25, Math.abs(n[2])];   // se prefiere arriba/abajo
    const view = ax[1] >= ax[0] && ax[1] >= ax[2] ? (n[1] >= 0 ? 'top' : 'bot') : ax[2] >= ax[0] ? (n[2] >= 0 ? 'left' : 'right') : (n[0] < 0 ? 'front' : 'back');
    counts[view] = (counts[view] || 0) + 1;
    const q = pos.map((v) => proj(view, v));
    ids.forEach((i, j) => { nP.push(...pos[j]); nN.push(...NR.getElement(i, [0, 0, 0])); nU.push(q[j][0] / N, q[j][1] / N); });
    // horneado: cada píxel del triángulo nuevo toma el color de su punto en la UV antigua (con 2 px de margen)
    const [a, b, c] = q, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])) - 2), x1 = Math.min(N - 1, Math.ceil(Math.max(a[0], b[0], c[0])) + 2);
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])) - 2), y1 = Math.min(N - 1, Math.ceil(Math.max(a[1], b[1], c[1])) + 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d, w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d, w2 = 1 - w0 - w1;
      const inside = w0 >= 0 && w1 >= 0 && w2 >= 0, i = y * N + x;
      if (!inside && (cov[i] === 2 || Math.min(w0, w1, w2) < -0.25)) continue;
      w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const ws = w0 + w1 + w2; w0 /= ws; w1 /= ws; w2 /= ws;
      let col = fac;
      if (img) { const u = uvo[0][0] * w0 + uvo[1][0] * w1 + uvo[2][0] * w2, v = uvo[0][1] * w0 + uvo[1][1] * w1 + uvo[2][1] * w2; const sx = Math.min(N - 1, Math.max(0, Math.floor(u * N))), sy = Math.min(N - 1, Math.max(0, Math.floor(v * N))), si = (sy * N + sx) * 3; col = [img[si], img[si + 1], img[si + 2]]; }
      out[i * 3] = col[0]; out[i * 3 + 1] = col[1]; out[i * 3 + 2] = col[2]; cov[i] = inside ? 2 : 1;
    }
  }
  const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
  p.setAttribute('POSITION', A(new Float32Array(nP), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nN), 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(nU), 'VEC2'));
  p.setIndices(A(new Uint32Array(nP.length / 3).map((_, i) => i), 'SCALAR'));
}
console.log('triángulos por vista', JSON.stringify(counts));
const png = await sharp(out, { raw: { width: N, height: N, channels: 3 } }).png().toBuffer();
fs.writeFileSync(`${OUTDIR}/ALTAIR_textura_editable.png`, png);
// una sola textura para todas las zonas; cada zona conserva su brillo y su metal. Sin mapa normal (iba con la UV antigua)
const tex = doc.createTexture('ALTAIR_textura_editable').setImage(png).setMimeType('image/png');
for (const p of prims) { const m = p.getMaterial(); m.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setNormalTexture(null).setMetallicRoughnessTexture(null); }
// guía para Photoshop: contornos de las vistas y rótulos
const box = (v, w, h) => { const o = R[v]; return `<rect x="${o[0] - 4}" y="${o[1] - 4}" width="${w * s + 8}" height="${h * s + 8}" fill="none" stroke="#ffcc66" stroke-width="2" stroke-dasharray="10 6"/>`; };
const lab = (v, t, dx = 0, dy = -2) => `<text x="${R[v][0] + 6 + dx}" y="${R[v][1] + 26 + dy}" fill="#ffcc66" font-family="Arial" font-size="22" font-weight="bold">${t}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">${box('top', Lz, Lx)}${box('bot', Lz, Lx)}${box('left', Lx, Ly)}${box('right', Lx, Ly)}${box('front', Lz, Ly)}${box('back', Lz, Ly)}
${lab('top', 'VISTA SUPERIOR · morro arriba')}${lab('bot', 'VISTA INFERIOR · morro arriba (espejo)')}${lab('left', 'COSTADO IZQUIERDO · morro a la izquierda')}${lab('right', 'COSTADO DERECHO · morro a la derecha')}${lab('front', 'FRENTE')}${lab('back', 'POPA · motores')}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(`${OUTDIR}/ALTAIR_guia_vistas.png`);
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
