// ALTAIR (v3):
//  · ALTAIR_16 recibe el ala en delta «Solaris Phantom» de Dear: carrocería de lapislázuli con pirita y calcita,
//    costados mecánicos y motores en metal, franja de luz en los dos cantos del triángulo frontal y letras ALTAIR
import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, unpartition, weldPrimitive, simplifyPrimitive, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mat4, vec3 } from 'gl-matrix';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE), add = await io.read(process.env.HULL);
const S = +(process.env.S || 2.75);
const root = doc.getRoot(), main = root.listScenes()[0], buf = root.listBuffers()[0];
const node = (n) => main.listChildren().find((c) => c.getName() === n);
const ALT = node('ALTAIR_16');
const kid = (V, re) => V.listChildren().find((c) => re.test(c.getName()));
const hoverMesh = kid(ALT, /_hover$/).getMesh(), hoverScale = kid(ALT, /_hover$/).getScale();
const ionMat0 = kid(ALT, /_ion$/).getMesh().listPrimitives()[0].getMaterial();

for (const c of [...ALT.listChildren()]) { ALT.removeChild(c); c.dispose(); }
// ── el delta ──
let minY = 1e9, maxX = -1e9;
mergeDocuments(doc, add);
const extra = root.listScenes().slice(1);
const hull = doc.createNode('ALTAIR_16_hull').setScale([S, S, S]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);   // popa +X → −Z
for (const sc of extra) for (const n of [...sc.listChildren()]) { const b = getBounds(n); minY = Math.min(minY, b.min[1]); maxX = Math.max(maxX, b.max[0]); sc.removeChild(n); hull.addChild(n); n.setName('ALTAIR | Delta hull'); }
const lift = -0.2 - minY * S; hull.setTranslation([0, lift, 0]);
ALT.addChild(hull);
await MeshoptSimplifier.ready;
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const hn = hull.listChildren()[0], prim = hn.getMesh().listPrimitives()[0];
{ const t0 = prim.getIndices().getCount() / 3; weldPrimitive(prim, { tolerance: 0.0001 });
  simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: (+process.env.TRI || 60000) / t0, error: 0.002, lockBorder: true }); compactPrimitive(prim); }
const P = prim.getAttribute('POSITION'), I = prim.getIndices();
const pv = (i) => P.getElement(i, [0, 0, 0]);

// 2a. reparto de triángulos: costados del fuselaje y motores en metal; el resto, lapislázuli
const lapIdx = [], broIdx = [], titIdx = [], darkIdx = [], pilIdx = [];
for (let t = 0; t < I.getCount(); t += 3) {
  const a = pv(I.getScalar(t)), b = pv(I.getScalar(t + 1)), c = pv(I.getScalar(t + 2));
  const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
  const n = vec3.normalize([], vec3.cross([], vec3.sub([], b, a), vec3.sub([], c, a)));
  const tri = [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)];
  const engine = cx > 0.62 && Math.abs(cz) < 0.3;
  const flank = Math.abs(cz) < 0.37 && Math.abs(n[2]) > 0.5 && cy > -0.14 && cx > -0.55;
  if (engine) (n[1] > -0.2 && cy > 0.02 ? broIdx : darkIdx).push(...tri);            // campanas de bronce, entrañas oscuras
  else if (flank) (n[1] > 0.22 ? titIdx : (cy > 0.1 ? broIdx : darkIdx)).push(...tri); // costado: titanio mate arriba, bronce en el filo alto, mecánica oscura abajo
  else if (cx < -0.12 && Math.abs(cz) < 0.26 + (cx + 0.12) * -0.15 && n[1] > 0.35) pilIdx.push(...tri);   // puesto del piloto
  else lapIdx.push(...tri);
}
const mat0 = prim.getMaterial();
const lapMat = mat0.clone().setName('ALTAIR | Lapis lazuli'), broMat = mat0.clone().setName('ALTAIR | Burnished bronze'), titMat = mat0.clone().setName('ALTAIR | Matte titanium'), darkMat = mat0.clone().setName('ALTAIR | Dark mechanics'), pilMat = mat0.clone().setName('ALTAIR | Pilot shell');
prim.setIndices(A(new Uint32Array(lapIdx), 'SCALAR')).setMaterial(lapMat);
for (const [ix, m] of [[broIdx, broMat], [titIdx, titMat], [darkIdx, darkMat], [pilIdx, pilMat]]) if (ix.length) hn.getMesh().addPrimitive(prim.clone().setIndices(A(new Uint32Array(ix), 'SCALAR')).setMaterial(m));
console.log('piloto', pilIdx.length / 3, 'lapislázuli', lapIdx.length / 3, '· bronce', broIdx.length / 3, '· titanio', titIdx.length / 3, '· oscuro', darkIdx.length / 3);

// 2b. textura de lapislázuli (la del metal se queda con la original, aclarada a titanio pavonado)
const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
{
  const tex = mat0.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, lap = Buffer.alloc(W * H * 3), bro = Buffer.alloc(W * H * 3), tit = Buffer.alloc(W * H * 3), dark = Buffer.alloc(W * H * 3);
  const put = (buf, i, c) => { for (let k = 0; k < 3; k++) buf[i + k] = Math.max(0, Math.min(255, c[k] * 255)); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
    const accent = sat > 0.55 && mx > 0.35, metal = L > 0.42;
    let c = [r, g, b];
    if (!accent && !metal) {
      const t = Math.min(1, Math.pow(L / 0.38, 1.1));
      const cloud = vn(x / 110, y / 110) * 0.6 + vn(x / 27, y / 27) * 0.4;
      c = [0.022 + 0.06 * t, 0.036 + 0.11 * t, 0.13 + 0.34 * t].map((v) => v * (0.7 + 0.6 * cloud) * (0.75 + 1.1 * L));
      const cal = Math.max(0, (vn(x / 70 + 9, y / 70 - 4) - 0.72) * 3.2) + Math.max(0, 1 - Math.abs(vn(x / 160 + 3, y / 55) - 0.5) * 70) * (vn(x / 320, y / 320) > 0.6 ? 0.6 : 0);
      c = c.map((v, k) => v + Math.min(1, cal) * [0.26, 0.29, 0.34][k] * 0.55);
      if (h(Math.floor(x / 2), Math.floor(y / 2)) > 0.9978) c = [0.82, 0.64, 0.24];
    }
    put(lap, i, c);
    const d = Math.min(1, L * 1.6);
    // bronce bruñido: el detalle de la pieza original en una rampa de bronce, con pátina en los huecos
    const pat = vn(x / 40, y / 40);
    put(bro, i, accent ? [r, g, b] : [0.3 + 0.56 * d, 0.2 + 0.46 * d, 0.09 + 0.24 * d].map((v, k) => v * (0.85 + 0.25 * pat) + (d < 0.25 ? [-0.06, 0.02, 0.01][k] * (1 - pat) : 0)));
    // titanio mate: gris frío con cepillado fino
    const brush = 0.94 + 0.06 * Math.sin(y * 0.9 + vn(x / 8, y / 200) * 6);
    put(tit, i, accent ? [r, g, b] : [0.36 + 0.42 * d, 0.37 + 0.42 * d, 0.39 + 0.43 * d].map((v) => v * brush));
    // mecánica oscura: grafito con moleteado en rombo
    const knurl = (Math.abs(Math.sin((x + y) * 0.35)) > 0.86 || Math.abs(Math.sin((x - y) * 0.35)) > 0.86) ? 0.65 : 1;
    put(dark, i, accent ? [r * 0.8, g * 0.8, b * 0.8] : [0.055 + 0.16 * d, 0.055 + 0.16 * d, 0.06 + 0.17 * d].map((v) => v * knurl));
  }
  const mk = async (name, buf) => doc.createTexture(name).setImage(await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toBuffer()).setMimeType('image/jpeg');
  lapMat.setBaseColorTexture(await mk('ALTAIR_lapis', lap)).setMetallicFactor(0.22).setRoughnessFactor(0.3).setMetallicRoughnessTexture(null);
  pilMat.setBaseColorTexture(null).setBaseColorFactor([0.012, 0.018, 0.045, 1]).setMetallicFactor(0.75).setRoughnessFactor(0.08).setMetallicRoughnessTexture(null);
  broMat.setBaseColorTexture(await mk('ALTAIR_bronze', bro)).setMetallicFactor(1.0).setRoughnessFactor(0.38);
  titMat.setBaseColorTexture(await mk('ALTAIR_titanium', tit)).setMetallicFactor(0.85).setRoughnessFactor(0.8);
  darkMat.setBaseColorTexture(await mk('ALTAIR_dark', dark)).setMetallicFactor(0.7).setRoughnessFactor(0.58);
}

// 2c. franja de luz en los dos cantos del triángulo frontal (vista cenital: del morro truncado hacia las puntas de ala)
const verts = []; for (let i = 0; i < P.getCount(); i++) verts.push(pv(i));
let minX = 1e9; for (const v of verts) minX = Math.min(minX, v[0]);
const slice = (x, w = 0.012) => verts.filter((v) => Math.abs(v[0] - x) < w);
let xW = minX, wMax = 0; for (let x = minX + 0.02; x < 0.8; x += 0.02) { const s = slice(x); const w = Math.max(...s.map((v) => Math.abs(v[2]))); if (w > wMax) { wMax = w; xW = x; } }
const topAt = (x, z) => { let y = -1e9; for (const v of verts) if (Math.abs(v[0] - x) < 0.018 && Math.abs(v[2] - z) < 0.018) y = Math.max(y, v[1]); return y; };
const gPos = [], gIdx = [];
for (const side of [-1, 1]) {
  const base = gPos.length / 3, xs = [], es = [];
  for (let x = minX + 0.025; x <= xW - 0.03; x += 0.012) { const s = slice(x).filter((v) => v[2] * side > 0); if (!s.length) continue; xs.push(x); es.push(Math.max(...s.map((v) => Math.abs(v[2])))); }
  const sm = (a, K) => a.map((_, i) => { let t = 0, n = 0; for (let k = -K; k <= K; k++) if (a[i + k] !== undefined) { t += a[i + k]; n++; } return t / n; });
  const e2 = sm(sm(es, 4), 4);
  const rows = [0.02, 0.042].map((ins) => xs.map((x, i) => { const z = side * (e2[i] - ins), y = topAt(x, z); return [x, y, z]; }));
  for (const row of rows) { const ys = sm(sm(row.map((p) => (p[1] > -1e8 ? p[1] : 0)), 3), 3); row.forEach((p, i) => (p[1] = ys[i])); }
  const yTop = rows[0].map((p, i) => Math.max(p[1], rows[1][i][1]));
  for (let i = 0; i < xs.length; i++) for (const row of rows) gPos.push(row[i][0], yTop[i] + 0.006, row[i][2]);
  const n = xs.length;
  for (let k = 0; k < n - 1; k++) { const a = base + k * 2; gIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
}
// cortes de luz longitudinales: dos por lado, en segmentos (del borde del puesto del piloto hacia la popa)
for (const zc of [-0.66, -0.47, 0.47, 0.66]) {
  const segs = Math.abs(zc) < 0.55 ? [[-0.38, -0.12], [-0.06, 0.2], [0.26, 0.44]] : [[-0.2, 0.02], [0.08, 0.3]];
  for (const [xa, xb] of segs) {
    const xs = []; for (let x = xa; x <= xb + 1e-6; x += 0.012) xs.push(x);
    let ys = xs.map((x) => { const y = topAt(x, zc); return y > -1e8 ? y : NaN; });
    const ok = ys.filter((v) => !isNaN(v)); if (ok.length < 3) continue;
    const med = ok.slice().sort((a, b) => a - b)[ok.length >> 1]; ys = ys.map((v) => (isNaN(v) || Math.abs(v - med) > 0.05 ? med : v));
    for (let p = 0; p < 3; p++) ys = ys.map((_, i) => (ys[Math.max(0, i - 1)] + ys[i] + ys[Math.min(ys.length - 1, i + 1)]) / 3);
    const base = gPos.length / 3;
    xs.forEach((x, i) => { for (const dz of [-0.007, 0.007]) gPos.push(x, ys[i] + 0.006, zc + dz); });
    for (let k = 0; k < xs.length - 1; k++) { const a = base + k * 2; gIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
}
const glowMat = doc.createMaterial('ALTAIR | Edge glow').setBaseColorFactor([0.2, 0.14, 0.06, 1]).setEmissiveFactor([1.0, 0.8, 0.45]).setDoubleSided(true);
glowMat.setExtension('KHR_materials_emissive_strength', doc.createExtension(KHRMaterialsEmissiveStrength).createEmissiveStrength().setEmissiveStrength(4));
const gN = new Float32Array(gPos.length); for (let i = 1; i < gN.length; i += 3) gN[i] = 1;
const glowPrim = doc.createPrimitive().setMaterial(glowMat).setAttribute('POSITION', A(new Float32Array(gPos), 'VEC3')).setAttribute('NORMAL', A(gN, 'VEC3')).setIndices(A(new Uint32Array(gIdx), 'SCALAR'));
hn.getMesh().addPrimitive(glowPrim);
console.log('franja de luz', gIdx.length / 3, 'tri · ancho máximo en x', xW.toFixed(2));

// 2d. toberas y emisores de levitación
const NZ = JSON.parse(process.env.NZ || '[[0.07,0,0.075],[0.17,0.19,0.05],[0.17,-0.19,0.05]]');
const ip = [], ii = [], SEG = 16;
for (const [y, z, r] of NZ) { const cx = z * S, cy = y * S + lift, cz = -maxX * S - 0.03, R = r * S, b0 = ip.length / 3; ip.push(cx, cy, cz); for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; ip.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz); } for (let k = 1; k <= SEG; k++) ii.push(b0, b0 + k + 1, b0 + k); }
const iN = new Float32Array(ip.length); for (let i = 2; i < iN.length; i += 3) iN[i] = -1;
const ionMat = ionMat0.clone().setName('ALTAIR_Ion');
ALT.addChild(doc.createNode('ALTAIR_16_ion').setMesh(doc.createMesh('ALTAIR_16_ion').addPrimitive(doc.createPrimitive().setMaterial(ionMat).setAttribute('POSITION', A(new Float32Array(ip), 'VEC3')).setAttribute('NORMAL', A(iN, 'VEC3')).setIndices(A(new Uint32Array(ii), 'SCALAR')))));
ALT.addChild(doc.createNode('ALTAIR_16_hover').setMesh(hoverMesh).setScale([hoverScale[0] * 1.3, hoverScale[1], hoverScale[2] * 0.9]));

// 2e. letras ALTAIR en las dos alas (oro de pirita), legibles desde la cámara de persecución
{
  const W = 2048, H = 320, sw = 34, top = 70, bot = 210, mid = (top + bot) / 2, r = (bot - top) / 2;
  const O = (x) => `M${x + 170},${mid} A${85},${r} 0 1 0 ${x},${mid} A${85},${r} 0 1 0 ${x + 170},${mid}`;
  const glyph = {
    A: (x) => `M${x},${bot} L${x + 85},${top} L${x + 170},${bot} M${x + 38},${top + 92} L${x + 132},${top + 92}`,
    L: (x) => `M${x + 15},${top} L${x + 15},${bot} L${x + 160},${bot}`,
    T: (x) => `M${x},${top} L${x + 170},${top} M${x + 85},${top} L${x + 85},${bot}`,
    I: (x) => `M${x + 80},${top} L${x + 80},${bot}`,
    R: (x) => `M${x},${bot} L${x},${top} L${x + 110},${top} Q${x + 160},${top} ${x + 160},${top + 36} Q${x + 160},${top + 72} ${x + 110},${top + 72} L${x},${top + 72} M${x + 90},${top + 72} L${x + 165},${bot}`,
  };
  const LS2 = 290, x1 = 150;
  const d = ['A', 'L', 'T', 'A', 'I', 'R'].map((c, i) => glyph[c](x1 + i * LS2)).join(' ');
  const sx = x1 + 6 * LS2 + 40, sy = mid, st = `M${sx},${sy - 70} L${sx + 16},${sy - 16} L${sx + 70},${sy} L${sx + 16},${sy + 16} L${sx},${sy + 70} L${sx - 16},${sy + 16} L${sx - 70},${sy} L${sx - 16},${sy - 16} Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="miter"/><path d="${st}" fill="#fff"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const tex = doc.createTexture('ALTAIR_name').setImage(new Uint8Array(png)).setMimeType('image/png');
  const mat = doc.createMaterial('ALTAIR_Name').setBaseColorFactor([0.86, 0.66, 0.26, 1]).setEmissiveFactor([1.0, 0.76, 0.3]).setEmissiveTexture(tex).setBaseColorTexture(tex).setAlphaMode('BLEND').setMetallicFactor(1.0).setRoughnessFactor(0.25).setDoubleSided(true);
  // superficie superior del casco en el espacio de la nave
  const M = mat4.create(); mat4.fromRotationTranslationScale(M, hull.getRotation(), hull.getTranslation(), hull.getScale());
  const SP = verts.map((v) => vec3.transformMat4([0, 0, 0], v, M));
  const surfY = (x, z, rr = 0.11) => { for (let k = 0; k < 6; k++, rr *= 1.6) { let y = -1e9; for (const p of SP) if (Math.abs(p[0] - x) < rr && Math.abs(p[2] - z) < rr) y = Math.max(y, p[1]); if (y > -1e8) return y; } return 0; };
  const pos = [], uv = [], idx = [];
  const LEN = +(process.env.LEN || 1.55), HGT = LEN * H / W, CZ = +(process.env.CZ || -1.0), CX = +(process.env.CX || 1.28), NU = 60, NV = 8;
  for (const side of [-1, 1]) { const base = pos.length / 3, cx = side * CX;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const u = i / NU, v = j / NV; const x = cx + (0.5 - u) * LEN, z = CZ + (v - 0.5) * HGT; pos.push(x, surfY(x, z, 0.06) + 0.014, z); uv.push(u, 1 - v); }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; idx.push(a, b, c, b, e, c); } }
  const nrm = []; for (let i = 0; i < pos.length; i += 3) nrm.push(0, 1, 0);
  ALT.addChild(doc.createNode('ALTAIR_16_name').setMesh(doc.createMesh('ALTAIR_16_name').addPrimitive(doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')).setIndices(A(new Uint32Array(idx), 'SCALAR')))));
}
for (const s of extra) s.dispose();
await doc.transform(prune(), unpartition());   // sin dedup: compartir accesores rompe la fusión de geometrías de otras naves
await io.write(process.env.OUT, doc);
console.log('ALTAIR delta · S', S, 'lift', lift.toFixed(3));
