// VOSTOK_21 (VOSTOK PATROLS): nave de bloque blindado a partir del modelo de Dear (GORDION.glb, morro −X, 1,72 de largo).
// Casco oscuro y metálico, cabina alargada y ventana trasera pulidas, nombre en los carenados laterales,
// cuatro toberas ventrales (sin propulsión trasera), filetes de levitación y brillo del motor tras las rejillas de popa.
// Uso: BASE=ships45.glb MODEL=gordion.glb OUT=out.glb node vostok.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';
import { SEL, lumAt } from './sel.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE);
const add = await io.read(process.env.MODEL);
const S = +(process.env.S || 3.3), NODE = 'VOSTOK_21', TAG = 'VOSTOK';
const ION = [0.22, 0.42, 1.0];

// ── 1. Texturas: casco oscuro (hierro antiguo con cantos gastados), metal en el canal azul del mapa MR ──
const mat0 = add.getRoot().listMaterials()[0];
const raw = async (tex, ch) => sharp(Buffer.from(tex.getImage())).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
const bc = await raw(mat0.getBaseColorTexture()), mr = await raw(mat0.getMetallicRoughnessTexture());
const W = bc.info.width, H = bc.info.height, nC = bc.info.channels, nM = mr.info.channels;
const outBC = Buffer.alloc(W * H * 3), outMR = Buffer.alloc(W * H * 3);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TINT = [0.98, 0.97, 0.95];
for (let i = 0; i < W * H; i++) {
  const r = bc.data[i * nC] / 255, g = bc.data[i * nC + 1] / 255, b = bc.data[i * nC + 2] / 255;
  const lum = 0.3 * r + 0.55 * g + 0.15 * b, edge = ss(0.62, 0.9, lum);
  for (let k = 0; k < 3; k++) outBC[i * 3 + k] = Math.round(Math.min(1, Math.pow([r, g, b][k], 1.35) * 0.9 * TINT[k]) * 255);
  const j = (i % W) + Math.floor(i / W) * mr.info.width;   // mismo tamaño
  const rough0 = mr.data[j * nM + 1] / 255;
  outMR[i * 3] = mr.data[j * nM];
  outMR[i * 3 + 1] = Math.round(Math.min(0.85, Math.max(0.22, rough0 * 0.92 - 0.22 * edge)) * 255);
  outMR[i * 3 + 2] = Math.round((0.55 + 0.4 * edge) * 255);
}
const jpg = (buf, q = 90) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: q, chromaSubsampling: '4:4:4' }).toBuffer();
mat0.getBaseColorTexture().setImage(new Uint8Array(await jpg(outBC))).setMimeType('image/jpeg').setURI('');
mat0.getMetallicRoughnessTexture().setImage(new Uint8Array(await jpg(outMR, 92))).setMimeType('image/jpeg').setURI('');
const nt = mat0.getNormalTexture();
nt.setImage(new Uint8Array(await sharp(Buffer.from(nt.getImage())).removeAlpha().jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer())).setMimeType('image/jpeg').setURI('');
mat0.setName(`${TAG} | Ancient armor`).setMetallicFactor(1).setRoughnessFactor(1).setBaseColorFactor([1, 1, 1, 1]);

// ── 2. Cabina: canal alargado (con el parabrisas) y ventana de la caja de popa, en un material pulido ──
const prim = add.getRoot().listMeshes()[0].listPrimitives()[0];
const { data: g8, info: gi } = await sharp(Buffer.from(mat0.getBaseColorTexture().getImage())).greyscale().raw().toBuffer({ resolveWithObject: true });
const img = { d: g8, w: gi.width, h: gi.height };
const PA = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0'), IDX = prim.getIndices().getArray();
const RT = [];   // triángulos en espacio original, para proyectar el nombre
const hullI = [], cockI = [];
{
  const p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], u = [[0, 0], [0, 0], [0, 0]];
  for (let t = 0; t < IDX.length; t += 3) {
    for (let k = 0; k < 3; k++) { PA.getElement(IDX[t + k], p[k]); UV.getElement(IDX[t + k], u[k]); }
    RT.push(p.map((v) => v.slice()));
    const c = [0, 1, 2].map((a) => (p[0][a] + p[1][a] + p[2][a]) / 3);
    const e1 = p[1].map((v, a) => v - p[0][a]), e2 = p[2].map((v, a) => v - p[0][a]);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const L = Math.hypot(...n) || 1; n = n.map((v) => v / L);
    // la luminancia se mide en la textura original (antes de oscurecer): umbrales de sel.mjs
    const lum = lumAt(img, (u[0][0] + u[1][0] + u[2][0]) / 3, (u[0][1] + u[1][1] + u[2][1]) / 3) ** (1 / 1.35) / 0.93;
    (SEL.channel(c, n, lum) || SEL.rear(c, n, lum) ? cockI : hullI).push(IDX[t], IDX[t + 1], IDX[t + 2]);
  }
}
const abuf = add.getRoot().listBuffers()[0];
prim.setIndices(add.createAccessor().setArray(new Uint32Array(hullI)).setType('SCALAR').setBuffer(abuf));
const cc = add.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(0.8).setClearcoatRoughnessFactor(0.14);
const cockMat = mat0.clone().setNormalTexture(null).setName(`${TAG} | Polished cockpit`).setBaseColorFactor([0.78, 0.82, 0.9, 1]).setRoughnessFactor(0.42).setExtension('KHR_materials_clearcoat', cc);
// cabina con normales planas: placas de cristal blindado nítidas (con normales suavizadas el reflejo ondulaba como papel)
{
  const cp = [], cn = [], cu = [], ci = [], a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], ua = [0, 0];
  for (let t = 0; t < cockI.length; t += 3) {
    PA.getElement(cockI[t], a); PA.getElement(cockI[t + 1], b); PA.getElement(cockI[t + 2], c);
    const e1 = b.map((v, k) => v - a[k]), e2 = c.map((v, k) => v - a[k]);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const L = Math.hypot(...n) || 1; n = n.map((v) => v / L);
    for (const [k, p] of [[0, a], [1, b], [2, c]]) { cp.push(...p); cn.push(...n); UV.getElement(cockI[t + k], ua); cu.push(...ua); ci.push(ci.length); }
  }
  const acc = (arr, ty) => add.createAccessor().setArray(arr).setType(ty).setBuffer(abuf);
  add.getRoot().listMeshes()[0].addPrimitive(add.createPrimitive().setMaterial(cockMat).setAttribute('POSITION', acc(new Float32Array(cp), 'VEC3')).setAttribute('NORMAL', acc(new Float32Array(cn), 'VEC3')).setAttribute('TEXCOORD_0', acc(new Float32Array(cu), 'VEC2')).setIndices(acc(new Uint32Array(ci), 'SCALAR')));
}
console.log('casco', hullI.length / 3, 'tris · cabina', cockI.length / 3, 'tris');

// ── 3. Fusionar en la flota y montar el nodo con la orientación del juego (morro −X → +Z, base a y = −0,2) ──
mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0], buf = root.listBuffers()[0];
const old = main.listChildren().find((n) => n.getName() === NODE); if (old) old.dispose();
const V = doc.createNode(NODE); main.addChild(V);
const MINY = -0.232, lift = -0.2 - MINY * S;
const hull = doc.createNode(NODE + '_hull').setScale([S, S, S]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]).setTranslation([0, lift, 0]);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) { sc.removeChild(n); hull.addChild(n); }
V.addChild(hull);
for (const s of scenes.slice(1)) s.dispose();
const sh = ([x, y, z]) => [S * z, S * y + lift, -S * x];          // espacio original → espacio de la nave
const shN = ([x, y, z]) => [z, y, -x];

const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const mkPrim = (mat, pos, nrm, idx, uv) => { const p = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR')); if (uv) p.setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')); return p; };
const M9 = main.listChildren().find((n) => n.getName() === 'MANTA_9');
const ionMat = M9.listChildren().find((c) => /_ion$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial().clone().setName(`${TAG}_Ion`).setEmissiveFactor(ION).setBaseColorFactor([...ION, 1]);
const hovMat = M9.listChildren().find((c) => /_hover$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial().clone().setName(`${TAG}_Hover`).setEmissiveFactor(ION);

// ── 4. Toberas ventrales: dos discos bajo el raíl de cada góndola, mirando abajo ──
{
  const pos = [], nrm = [], idx = [], SEG = 20, R = 0.045;
  for (const z of [0.677, -0.677]) for (const x of [-0.28, 0.42]) {
    const b = pos.length / 3, y = -0.2345;
    pos.push(...sh([x, y, z])); nrm.push(0, -1, 0);
    for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(...sh([x + Math.cos(a) * R, y, z + Math.sin(a) * R])); nrm.push(0, -1, 0); }
    for (let k = 1; k <= SEG; k++) idx.push(b, b + k, b + k + 1);
  }
  V.addChild(doc.createNode(NODE + '_ion').setMesh(doc.createMesh(NODE + '_ion').addPrimitive(mkPrim(ionMat, pos, nrm, idx))));
}
// ── 5. Filetes de levitación: dos líneas a lo largo del raíl inferior de cada góndola ──
{
  const pos = [], nrm = [], idx = [];
  const quad = (pts, n) => { const b = pos.length / 3; for (const p of pts) { pos.push(...sh(p)); nrm.push(...shN(n)); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  for (const zc of [0.677, -0.677]) for (const dz of [-0.026, 0.026]) {
    const z = zc + dz, y = -0.2335, w = 0.0045;
    quad([[-0.36, y, z - w], [0.49, y, z - w], [0.49, y, z + w], [-0.36, y, z + w]], [0, -1, 0]);
  }
  V.addChild(doc.createNode(NODE + '_hover').setMesh(doc.createMesh(NODE + '_hover').addPrimitive(mkPrim(hovMat, pos, nrm, idx))));
}
// ── 6. Motor tras las rejillas de popa: lámina emisiva con lamas, en el fondo de cada rejilla ──
{
  const GW = 256, GH = 192, px = Buffer.alloc(GW * GH * 4);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const v = y / (GH - 1), u = x / (GW - 1);
    const slat = Math.pow(Math.max(0, Math.sin(v * Math.PI * 7)), 2.2);            // siete franjas de calor entre lamas
    const vig = ss(0, 0.12, u) * ss(0, 0.12, 1 - u) * ss(0, 0.1, v) * ss(0, 0.1, 1 - v);
    const core = 0.55 + 0.45 * Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) / 0.08);
    const a = Math.min(1, slat * vig * core * 1.15), i = (y * GW + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = Math.round(255 * Math.min(1, slat * core)); px[i + 3] = Math.round(255 * a);
  }
  const png = await sharp(px, { raw: { width: GW, height: GH, channels: 4 } }).png().toBuffer();
  const tex = doc.createTexture(`${TAG}_grille`).setImage(new Uint8Array(png)).setMimeType('image/png');
  const gm = doc.createMaterial(`${TAG}_Grille_Hover`).setBaseColorFactor([0, 0, 0, 1]).setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor(ION).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(1);
  const pos = [], nrm = [], idx = [], uv = [];
  for (const zc of [0.6765, -0.6765]) {
    const b = pos.length / 3, x = 0.6672, y0 = -0.064, y1 = 0.048, z0 = zc - 0.04, z1 = zc + 0.04;
    for (const [p, t] of [[[x, y0, z0], [0, 1]], [[x, y0, z1], [1, 1]], [[x, y1, z1], [1, 0]], [[x, y1, z0], [0, 0]]]) { pos.push(...sh(p)); nrm.push(...shN([1, 0, 0])); uv.push(...t); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  V.addChild(doc.createNode(NODE + '_grille').setMesh(doc.createMesh(NODE + '_grille').addPrimitive(mkPrim(gm, pos, nrm, idx, uv))));
}

// ── 7. Nombre en los carenados superiores laterales: letras de plantilla, pintura hueso gastada ──
const ray = (o, d) => {           // Möller–Trumbore contra el casco original: distancia al primer impacto
  let best = Infinity;
  for (const [a, b, c] of RT) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]; if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tv = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv; if (u < 0 || u > 1) continue;
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
    const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv; if (t > 1e-5 && t < best) best = t;
  }
  return best;
};
{
  // letras V O S T O K en plantilla (huecos de stencil), sobre lienzo 1000 × 210
  const s = 26, gap = 9, X = (i) => 40 + i * 155;
  const L = {
    V: (x) => `<polyline points="${x},20 ${x + 55},190 ${x + 110},20" stroke-linejoin="miter"/>`,
    O: (x) => `<rect x="${x + s / 2}" y="${20 + s / 2}" width="${110 - s}" height="${170 - s}" rx="14"/>`,
    S: (x) => `<polyline points="${x + 110},${20 + s / 2} ${x + s / 2},${20 + s / 2} ${x + s / 2},105 ${x + 110 - s / 2},105 ${x + 110 - s / 2},${190 - s / 2} ${x},${190 - s / 2}"/>`,
    T: (x) => `<line x1="${x}" y1="${20 + s / 2}" x2="${x + 110}" y2="${20 + s / 2}"/><line x1="${x + 55}" y1="${20 + s}" x2="${x + 55}" y2="190"/>`,
    K: (x) => `<line x1="${x + s / 2}" y1="20" x2="${x + s / 2}" y2="190"/><polyline points="${x + 110},20 ${x + 40},105 ${x + 110},190"/>`,
  };
  const cuts = (c, x) => ({   // huecos de plantilla
    O: `<rect x="${x + 55 - gap / 2}" y="10" width="${gap}" height="40"/><rect x="${x + 55 - gap / 2}" y="160" width="${gap}" height="40"/>`,
    S: `<rect x="${x + 70}" y="10" width="${gap}" height="40"/><rect x="${x + 32}" y="160" width="${gap}" height="40"/>`,
    T: `<rect x="${x + 40}" y="${20 + s}" width="30" height="${gap}"/>`,
    K: `<rect x="${x + s + 2}" y="10" width="${gap}" height="190"/>`,
    V: `<rect x="${x + 40}" y="150" width="30" height="${gap}"/>`,
  })[c];
  const word = 'VOSTOK'.split('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="210"><defs><mask id="m"><rect width="1000" height="210" fill="#fff"/><g fill="#000">${word.map((c, i) => cuts(c, X(i))).join('')}</g></mask></defs>
    <g mask="url(#m)" fill="none" stroke="#fff" stroke-width="${s}" stroke-linecap="butt">${word.map((c, i) => L[c](X(i))).join('')}</g></svg>`;
  const { data: tx, info: ti } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // desgaste: ruido de valor en dos escalas recorta la pintura
  const hsh = (x, y) => { const s2 = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s2 - Math.floor(s2); };
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, a = hsh(i, j), b = hsh(i + 1, j), c = hsh(i, j + 1), d = hsh(i + 1, j + 1), ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; };
  for (let y = 0; y < ti.height; y++) for (let x = 0; x < ti.width; x++) {
    const i = (y * ti.width + x) * 4, n = vn(x / 22, y / 22) * 0.6 + vn(x / 6, y / 6) * 0.4;
    tx[i + 3] = Math.round(tx[i + 3] * (n < 0.3 ? 0.25 : n < 0.38 ? 0.65 : 1));
  }
  const png = await sharp(tx, { raw: { width: ti.width, height: ti.height, channels: 4 } }).png().toBuffer();
  await sharp(png).flatten({ background: '#3a3c40' }).toFile('/tmp/work/destro/vostok_name_preview.png');
  const tex = doc.createTexture(`${TAG}_name`).setImage(new Uint8Array(png)).setMimeType('image/png');
  const nm = doc.createMaterial(`${TAG}_Name`).setBaseColorFactor([0.8, 0.76, 0.66, 1]).setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([0.07, 0.066, 0.058]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.7).setDoubleSided(true);
  const pos = [], nrm = [], uv = [], idx = [];
  const LEN = +(process.env.NLEN || 0.36), HGT = LEN * 210 / 1000, XC = +(process.env.NX || 0.06), NU = 48, NV = 6;
  for (const side of [1, -1]) {
    const N0 = [0, 0.76, 0.52 * side], nl = Math.hypot(...N0), N = N0.map((v) => v / nl);
    const D0 = [0 - N[0] * N[1], 1 - N[1] * N[1], 0 - N[2] * N[1]], dl = Math.hypot(...D0), D = D0.map((v) => v / dl);   // arriba en la pendiente
    const R = [D[1] * N[2] - D[2] * N[1], D[2] * N[0] - D[0] * N[2], D[0] * N[1] - D[1] * N[0]];                          // derecha de lectura vista desde fuera
    const C = [XC, 0.136, 0.24 * side];
    const base = pos.length / 3; let miss = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = i / NU, v = j / NV;
      const P0 = [0, 1, 2].map((k) => C[k] + R[k] * (u - 0.5) * LEN + D[k] * (v - 0.5) * HGT);
      const O = P0.map((p, k) => p + N[k] * 0.06), d = N.map((k) => -k);
      let t = ray(O, d); if (!isFinite(t)) { t = 0.06; miss++; }
      const hit = O.map((o, k) => o + d[k] * t + N[k] * 0.0016);
      pos.push(...sh(hit)); nrm.push(...shN(N)); uv.push(u, 1 - v);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
    console.log('nombre lado', side, 'sin impacto', miss, 'de', (NU + 1) * (NV + 1));
  }
  V.addChild(doc.createNode(NODE + '_name').setMesh(doc.createMesh(NODE + '_name').addPrimitive(mkPrim(nm, pos, nrm, idx, uv))));
}

await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
console.log('ok', NODE, 'escala', S, 'elevación', lift.toFixed(3));
