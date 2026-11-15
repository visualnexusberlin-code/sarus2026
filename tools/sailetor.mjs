// SAILETOR_22 (SAILETOR, Plutón): nave de materiales aerodinámicos a partir del modelo de Dear (SAILATOR.glb, morro −X, 1,9 de largo).
// Malla simplificada (≈197k → ≈60k tris), casco de composite con barniz, nombre en los carenados laterales,
// cuatro toberas traseras (dos por góndola) y filetes de levitación bajo las garras delanteras y la quilla de popa.
// Uso: BASE=ships45.glb MODEL=sailator.glb OUT=out.glb S=3.0 node sailetor.mjs
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition, weldPrimitive, simplifyPrimitive, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { uvPosMap } from './uvpos.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE);
const add = await io.read(process.env.MODEL);
const S = +(process.env.S || 3.0), NODE = 'SAILETOR_22', TAG = 'SAILETOR';
const ION = (process.env.ION || '0.78,0.7,1.0').split(',').map(Number);
const TRIS = +(process.env.TRIS || 60000);

// ── 1. Simplificar la malla (conserva costuras de UV) ──
await MeshoptSimplifier.ready;
const prim = add.getRoot().listMeshes()[0].listPrimitives()[0];
const t0 = prim.getIndices().getCount() / 3;
weldPrimitive(prim, { tolerance: 0.0001 });
simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: TRIS / t0, error: 0.004, lockBorder: false });
compactPrimitive(prim);
console.log('tris', t0, '→', prim.getIndices().getCount() / 3);
const MINY = getBounds(add.getRoot().listScenes()[0]).min[1];

// ── 2. Casco v2: el naranja pasa a blanco perla helado (composite de Plutón); quedan el negro y acentos naranja
//       en las aletas inferiores delanteras y en las capotas de los motores. Barniz encima.
const mat0 = add.getRoot().listMaterials()[0], TW = 2048;
const { map: PM, ok: POK } = uvPosMap(prim, TW);
const bc0 = await sharp(Buffer.from(mat0.getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer();
const mr0 = await sharp(Buffer.from(mat0.getMetallicRoughnessTexture().getImage())).removeAlpha().raw().toBuffer();
{
  const out = Buffer.from(bc0), mr = Buffer.from(mr0), PEARL = [0.9, 0.935, 0.985], sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let k = 0; k < TW * TW; k++) {
    const r = bc0[k * 3], g = bc0[k * 3 + 1], b = bc0[k * 3 + 2];
    const o = Math.max(0, Math.min(1, (r - g * 1.35) / Math.max(r, 1) * 2.2)); if (o <= 0) continue;
    const x = PM[k * 3], y = PM[k * 3 + 1];
    const keep = POK[k] ? Math.max(sm(-0.07, -0.11, y) * sm(-0.3, -0.36, x), sm(0.7, 0.76, x)) : 0;   // acentos que siguen naranja
    const f = o * (1 - keep), v = Math.pow(r / 255, 0.7) * 1.04;
    out[k * 3] = Math.min(255, r + (PEARL[0] * v * 255 - r) * f); out[k * 3 + 1] = Math.min(255, g + (PEARL[1] * v * 255 - g) * f); out[k * 3 + 2] = Math.min(255, b + (PEARL[2] * v * 255 - b) * f);
    mr[k * 3 + 1] = Math.round(mr0[k * 3 + 1] * (1 - 0.25 * f));   // el composite claro, algo más pulido
  }
  const enc = (buf) => sharp(buf, { raw: { width: TW, height: TW, channels: 3 } }).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
  mat0.getBaseColorTexture().setImage(new Uint8Array(await enc(out))).setMimeType('image/jpeg').setURI('');
  mat0.getMetallicRoughnessTexture().setImage(new Uint8Array(await enc(mr))).setMimeType('image/jpeg').setURI('');
  const nt = mat0.getNormalTexture(); nt.setImage(new Uint8Array(await sharp(Buffer.from(nt.getImage())).removeAlpha().jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer())).setMimeType('image/jpeg').setURI('');
}
const cc = add.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(+(process.env.CC || 0.55)).setClearcoatRoughnessFactor(0.18);
mat0.setName(`${TAG} | Aero composite`).setExtension('KHR_materials_clearcoat', cc);

// ── 2b. Ensanchar el tercio trasero (planta en delta en vez de huso): z crece hacia popa; normales corregidas ──
const WIDE = +(process.env.WIDE || 0.38), PUSH = +(process.env.PUSH || 0.045);
const sms = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const dfz = (x, z) => { const w = sms(0.0, 0.7, x); return z * (1 + WIDE * w) + Math.sign(z) * PUSH * w * sms(0.02, 0.1, Math.abs(z)); };
const dfm = ([x, y, z]) => [x, y, dfz(x, z)];
{
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TANGENT'), v = [0, 0, 0], n = [0, 0, 0], t = [0, 0, 0, 0], e = 1e-4;
  for (let i = 0; i < P.getCount(); i++) {
    P.getElement(i, v); const a = (dfz(v[0] + e, v[2]) - dfz(v[0] - e, v[2])) / (2 * e), b = (dfz(v[0], v[2] + e) - dfz(v[0], v[2] - e)) / (2 * e);
    if (N) { N.getElement(i, n); const m = [n[0] - a / b * n[2], n[1], n[2] / b], l = Math.hypot(...m) || 1; N.setElement(i, m.map((q) => q / l)); }
    if (T) { T.getElement(i, t); const m = [t[0], t[1], a * t[0] + b * t[2]], l = Math.hypot(...m) || 1; T.setElement(i, [m[0] / l, m[1] / l, m[2] / l, t[3]]); }
    P.setElement(i, dfm(v));
  }
}

// triángulos (espacio original) para proyectar nombre y piezas por rayos
const PA = prim.getAttribute('POSITION'), UA = prim.getAttribute('TEXCOORD_0'), IDX = prim.getIndices().getArray(), RT = [], RUV = [];
{ const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0]; for (let t = 0; t < IDX.length; t += 3) { PA.getElement(IDX[t], a); PA.getElement(IDX[t + 1], b); PA.getElement(IDX[t + 2], c); RT.push([a.slice(), b.slice(), c.slice()]); RUV.push([UA.getElement(IDX[t], []), UA.getElement(IDX[t + 1], []), UA.getElement(IDX[t + 2], [])]); } }
let HIT = null;   // último impacto: [triángulo, u, v]
const ray = (o, d) => {
  let best = Infinity; HIT = null;
  for (let ti = 0; ti < RT.length; ti++) { const [a, b, c] = RT[ti];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]; if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tv = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv; if (u < 0 || u > 1) continue;
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
    const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv; if (t > 1e-5 && t < best) { best = t; HIT = [ti, u, v]; }
  }
  return best;
};

// ── 3. Fusionar en la flota con la orientación del juego (morro −X → +Z, base a y = −0,2) ──
mergeDocuments(doc, add);
const root = doc.getRoot(), scenes = root.listScenes(), main = scenes[0], buf = root.listBuffers()[0];
const old = main.listChildren().find((n) => n.getName() === NODE); if (old) old.dispose();
const V = doc.createNode(NODE); main.addChild(V);
const lift = -0.2 - MINY * S;
const hull = doc.createNode(NODE + '_hull').setScale([S, S, S]).setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]).setTranslation([0, lift, 0]);
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) { sc.removeChild(n); hull.addChild(n); }
V.addChild(hull);
for (const s of scenes.slice(1)) s.dispose();
const sh = ([x, y, z]) => [S * z, S * y + lift, -S * x];
const shN = ([x, y, z]) => [z, y, -x];
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const mkPrim = (mat, pos, nrm, idx, uv) => { const p = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR')); if (uv) p.setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')); return p; };
const M9 = main.listChildren().find((n) => n.getName() === 'MANTA_9');
const ionMat = M9.listChildren().find((c) => /_ion$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial().clone().setName(`${TAG}_Ion`).setEmissiveFactor(ION).setBaseColorFactor([...ION, 1]);
const hovMat = M9.listChildren().find((c) => /_hover$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial().clone().setName(`${TAG}_Hover`).setEmissiveFactor(ION);

// ── 4. Toberas: dos por góndola (superior pequeña, inferior grande), discos en el fondo de cada boca, mirando atrás (+X) ──
{
  const pos = [], nrm = [], idx = [], SEG = 22; let n = 0;
  const KZ = 1 + WIDE;   // las bocas se ensanchan con la popa: óvalos
  for (const side of [1, -1]) for (const [y, z0, R] of [[0.068, 0.118, 0.021], [-0.052, 0.227, 0.03]]) {
    const z = dfz(0.93, z0);
    const o = [1.2, y, z * side], t = ray(o, [-1, 0, 0]); if (!isFinite(t)) { console.log('tobera sin impacto', y, z * side); continue; }
    const x = 1.2 - t + 0.003, b = pos.length / 3;
    pos.push(...sh([x, y, z * side])); nrm.push(...shN([1, 0, 0]));
    for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(...sh([x, y + Math.cos(a) * R, z * side + Math.sin(a) * R * KZ])); nrm.push(...shN([1, 0, 0])); }
    for (let k = 1; k <= SEG; k++) idx.push(b, b + k, b + k + 1, b, b + k + 1, b + k);
    n++; console.log('tobera', side, y, 'x', x.toFixed(3));
  }
  V.addChild(doc.createNode(NODE + '_ion').setMesh(doc.createMesh(NODE + '_ion').addPrimitive(mkPrim(ionMat, pos, nrm, idx))));
}
// ── 5. Filetes de levitación: cinta pegada al vientre de las dos garras delanteras y de la quilla de popa ──
{
  const pos = [], nrm = [], idx = [], W = 0.006, NS = 24;
  for (const [x0, x1, z] of [[-0.68, -0.38, 0.195], [-0.68, -0.38, -0.195], [0.5, 0.74, 0], [0.5, 0.8, dfz(0.65, 0.2)], [0.5, 0.8, -dfz(0.65, 0.2)]]) {
    const b = pos.length / 3; let ok = 0;
    for (let i = 0; i <= NS; i++) {
      const x = x0 + (x1 - x0) * i / NS;
      for (const dz of [-W, W]) {
        const o = [x, -0.6, z + dz], t = ray(o, [0, 1, 0]); const y = isFinite(t) ? -0.6 + t - 0.002 : MINY; if (isFinite(t)) ok++;
        pos.push(...sh([x, y, z + dz])); nrm.push(0, -1, 0);
      }
    }
    for (let i = 0; i < NS; i++) { const a = b + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    console.log('filete', z, 'impactos', ok, 'de', (NS + 1) * 2);
  }
  V.addChild(doc.createNode(NODE + '_hover').setMesh(doc.createMesh(NODE + '_hover').addPrimitive(mkPrim(hovMat, pos, nrm, idx))));
}

// ── 5b. Halos de suspensor de gravedad: discos de luz suave bajo las dos aletas delanteras y bajo la popa (dos capas para dar volumen).
//        Material «_Hover Halo»: toma el color de los propulsores; ship.js lo dibuja aditivo y sin sombra. ──
{
  const G = 128, px = Buffer.alloc(G * G * 4);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const r = Math.hypot(x - G / 2 + 0.5, y - G / 2 + 0.5) / (G / 2), a = Math.pow(Math.max(0, 1 - r), 1.7); px.set([255, 255, 255, Math.round(a * 255)], (y * G + x) * 4); }
  const tex = doc.createTexture(`${TAG}_halo`).setImage(new Uint8Array(await sharp(px, { raw: { width: G, height: G, channels: 4 } }).png().toBuffer())).setMimeType('image/png');
  const halo = hovMat.clone().setName(`${TAG}_Hover Halo`).setBaseColorFactor([0, 0, 0, 1]).setBaseColorTexture(tex).setEmissiveFactor(ION.map((q) => q * 0.75)).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(true);
  halo.setExtension('KHR_materials_emissive_strength', null);
  const pos = [], nrm = [], uv = [], idx = [];
  const under = (x, z) => { const t = ray([x, -0.6, z], [0, 1, 0]); return isFinite(t) ? -0.6 + t : MINY; };
  const ZR = dfz(0.65, 0.2);
  for (const [xc, zc, lx, lz] of [[-0.53, 0.195, 0.62, 0.3], [-0.53, -0.195, 0.62, 0.3], [0.62, 0, 0.55, ZR * 2 + 0.16]]) {
    const y0 = Math.min(under(xc, zc), under(xc - lx * 0.25, zc), under(xc + lx * 0.25, zc));
    for (const [k, dy] of [[1, -0.012], [1.35, -0.04]]) {
      const b = pos.length / 3, y = y0 + dy;
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(...sh([xc + (u - 0.5) * lx * k, y, zc + (v - 0.5) * lz * k])); nrm.push(0, -1, 0); uv.push(u, v); }
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    console.log('halo', xc, zc, 'y', y0.toFixed(3));
  }
  V.addChild(doc.createNode(NODE + '_halo').setMesh(doc.createMesh(NODE + '_halo').addPrimitive(mkPrim(halo, pos, nrm, idx, uv))));
}

// ── 5c. Malla hexagonal sobre el cristal de la cúpula: retícula en geometría (nítida a cualquier distancia), proyectada
//        radialmente desde el eje de la cúpula; solo donde el impacto cae sobre cristal (texel oscuro y pulido). ──
{
  const R0 = 0.2, YC = 0.02, rr = +(process.env.HEX || 0.024), HW = 0.0019, LIFT = 0.0022;
  const P3 = new Map();
  const proj = (x, s) => { const key = Math.round(x * 2e4) + ',' + Math.round(s * 2e4); if (P3.has(key)) return P3.get(key);
    const th = s / R0, d = [0, Math.cos(th), Math.sin(th)], o = [x, YC + d[1] * 0.6, d[2] * 0.6], t = ray(o, d.map((q) => -q)); let res = null;
    if (isFinite(t)) { const [ti, u, v] = HIT, w = 1 - u - v, U = RUV[ti], tu = U[0][0] * w + U[1][0] * u + U[2][0] * v, tv = U[0][1] * w + U[1][1] * u + U[2][1] * v;
      const k = Math.min(TW - 1, Math.max(0, Math.floor(tv * TW))) * TW + Math.min(TW - 1, Math.max(0, Math.floor(tu * TW)));
      const hit = [0, 1, 2].map((j) => o[j] - d[j] * t);
      if (Math.max(bc0[k * 3], bc0[k * 3 + 1], bc0[k * 3 + 2]) < 78 && mr0[k * 3 + 1] < 72 && hit[1] > 0.045) res = { p: hit.map((q, j) => q + d[j] * LIFT), n: d }; }
    P3.set(key, res); return res; };
  const edges = new Map(), q3 = Math.sqrt(3);
  for (let j = -12; j <= 12; j++) for (let i = -24; i <= 9; i++) {
    const cx = rr * q3 * (i + 0.5 * (j & 1)), cy = rr * 1.5 * j, c = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    for (let k = 0; k < 6; k++) { const A0 = c[k], B0 = c[(k + 1) % 6], ka = A0.map((q) => Math.round(q * 2e4)).join(), kb = B0.map((q) => Math.round(q * 2e4)).join(); edges.set(ka < kb ? ka + '|' + kb : kb + '|' + ka, [A0, B0]); }
  }
  const pos = [], nrm = [], idx = []; let ne = 0;
  for (const [A0, B0] of edges.values()) {
    if (Math.abs(A0[1]) > R0 * 1.35 || A0[0] < -0.95 || A0[0] > 0.32) continue;
    const pts = [A0, [(A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2], B0].map(([x, s2]) => proj(x, s2)); if (pts.some((q) => !q)) continue;
    for (let k = 0; k < 2; k++) { const P = pts[k], Q = pts[k + 1], e = [Q.p[0] - P.p[0], Q.p[1] - P.p[1], Q.p[2] - P.p[2]], n = P.n;
      const sd = [e[1] * n[2] - e[2] * n[1], e[2] * n[0] - e[0] * n[2], e[0] * n[1] - e[1] * n[0]], l = Math.hypot(...sd) || 1, w = sd.map((q) => q / l * HW), b = pos.length / 3;
      for (const [X, sg, nn] of [[P, 1, P.n], [P, -1, P.n], [Q, 1, Q.n], [Q, -1, Q.n]]) { pos.push(...sh(X.p.map((q, j2) => q + sg * w[j2]))); nrm.push(...shN(nn)); }
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    ne++;
  }
  const lat = doc.createMaterial(`${TAG} | Canopy lattice`).setBaseColorFactor([0.72, 0.78, 0.9, 1]).setMetallicFactor(1).setRoughnessFactor(0.28).setEmissiveFactor(ION.map((q) => q * 0.22)).setDoubleSided(true);
  V.addChild(doc.createNode(NODE + '_lattice').setMesh(doc.createMesh(NODE + '_lattice').addPrimitive(mkPrim(lat, pos, nrm, idx))));
  console.log('retícula: aristas', ne, 'tris', idx.length / 3);
}

// ── 5d. Derivas de popa: dos alas-vela en flecha que salen del flanco de las góndolas y dan envergadura al tercio trasero
//        (perfil lenticular de composite perla; filo de luz en la punta con el color de los propulsores). WING=0 las quita. ──
if (+(process.env.WING ?? 1)) {
  const SPAN = +(process.env.SPAN || 0.19), YW = -0.03, NT = 6, NC = 8, lerp = (a, b, t) => a + (b - a) * t;
  let zr = 9; for (let i = 0; i <= 8; i++) { const x = lerp(0.46, 0.84, i / 8), t = ray([x, YW, 1.2], [0, 0, -1]); if (isFinite(t)) zr = Math.min(zr, 1.2 - t); }
  zr -= 0.03;
  const wingMat = doc.createMaterial(`${TAG} | Winglet composite`).setBaseColorFactor([0.86, 0.9, 0.96, 1]).setMetallicFactor(0).setRoughnessFactor(0.3).setDoubleSided(true)
    .setExtension('KHR_materials_clearcoat', doc.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(0.55).setClearcoatRoughnessFactor(0.18));
  const pos = [], nrm = [], idx = [], tp = [], tn = [], ti = [];
  const pt = (side, t, c, sgn) => { const le = lerp(0.42, 0.76, Math.pow(t, 0.85)), te = lerp(0.87, 0.945, t), th = lerp(0.013, 0, Math.pow(t, 1.5));
    return [lerp(le, te, c), YW - 0.04 * t + sgn * th * 4 * c * (1 - c), side * (zr + (SPAN + 0.03) * t)]; };
  for (const side of [1, -1]) for (const sgn of [1, -1]) {
    const b = pos.length / 3, g = [];
    for (let j = 0; j <= NT; j++) for (let i = 0; i <= NC; i++) g.push(pt(side, j / NT, i / NC, sgn));
    for (let j = 0; j <= NT; j++) for (let i = 0; i <= NC; i++) {
      const P = g[j * (NC + 1) + i], A = g[j * (NC + 1) + Math.min(NC, i + 1)], B = g[j * (NC + 1) + Math.max(0, i - 1)], C = g[Math.min(NT, j + 1) * (NC + 1) + i], D = g[Math.max(0, j - 1) * (NC + 1) + i];
      const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]], v = [C[0] - D[0], C[1] - D[1], C[2] - D[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map((q) => q / l); if (n[1] * sgn < 0) n = n.map((q) => -q);
      pos.push(...sh(P)); nrm.push(...shN(n));
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NC; i++) { const a = b + j * (NC + 1) + i, c = a + NC + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  }
  // filo de luz en la punta
  for (const side of [1, -1]) for (const dy of [0.0012, -0.0012]) { const b = tp.length / 3;
    for (let i = 0; i <= NC; i++) for (const t of [0.9, 1]) { const P = pt(side, t, i / NC, Math.sign(dy)); tp.push(...sh([P[0], P[1] + dy, P[2]])); tn.push(0, Math.sign(dy), 0); }
    for (let i = 0; i < NC; i++) { const a = b + i * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  V.addChild(doc.createNode(NODE + '_wing').setMesh(doc.createMesh(NODE + '_wing').addPrimitive(mkPrim(wingMat, pos, nrm, idx)).addPrimitive(mkPrim(hovMat, tp, tn, ti))));
  console.log('derivas: raíz z', zr.toFixed(3), 'punta z', (zr + SPAN + 0.03).toFixed(3));
}

// ── 6. Nombre en los carenados laterales: letra geométrica inclinada, grafito con filo claro (el carenado es ahora blanco) ──
{
  const s = 20, Wd = 92, X = (i) => 34 + i * 117, T = 34, B = 176, M = 105;
  const L = {
    S: (x) => `<polyline points="${x + Wd},${T + s / 2} ${x + s / 2},${T + s / 2} ${x + s / 2},${M} ${x + Wd - s / 2},${M} ${x + Wd - s / 2},${B - s / 2} ${x},${B - s / 2}"/>`,
    A: (x) => `<polyline points="${x},${B} ${x + Wd / 2},${T} ${x + Wd},${B}" stroke-linejoin="miter"/><line x1="${x + 22}" y1="${M + 28}" x2="${x + Wd - 22}" y2="${M + 28}"/>`,
    I: (x) => `<line x1="${x + Wd / 2}" y1="${T}" x2="${x + Wd / 2}" y2="${B}"/>`,
    L: (x) => `<polyline points="${x + s / 2},${T} ${x + s / 2},${B - s / 2} ${x + Wd},${B - s / 2}"/>`,
    E: (x) => `<polyline points="${x + Wd},${T + s / 2} ${x + s / 2},${T + s / 2} ${x + s / 2},${B - s / 2} ${x + Wd},${B - s / 2}"/><line x1="${x + s / 2}" y1="${M}" x2="${x + Wd - 14}" y2="${M}"/>`,
    T: (x) => `<line x1="${x}" y1="${T + s / 2}" x2="${x + Wd}" y2="${T + s / 2}"/><line x1="${x + Wd / 2}" y1="${T + s}" x2="${x + Wd / 2}" y2="${B}"/>`,
    O: (x) => `<rect x="${x + s / 2}" y="${T + s / 2}" width="${Wd - s}" height="${B - T - s}" rx="30"/>`,
    R: (x) => `<path d="M${x + s / 2},${B} V${T + s / 2} H${x + Wd - 30} Q${x + Wd - s / 2},${T + s / 2} ${x + Wd - s / 2},${(T + M) / 2} Q${x + Wd - s / 2},${M} ${x + Wd - 30},${M} H${x + s / 2} M${x + 44},${M} L${x + Wd},${B}"/>`,
  };
  const word = TAG.split(''), WID = 1000, HG = 210;
  const glyphs = word.map((c, i) => L[c](X(i))).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WID}" height="${HG}"><g transform="translate(40,0) skewX(-16)" fill="none" stroke-linecap="butt" stroke-linejoin="round">
    <g stroke="#eef2f8" stroke-width="${s + 9}">${glyphs}</g><g stroke="#15171c" stroke-width="${s}">${glyphs}</g></g></svg>`;
  const png = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
  await sharp(png).flatten({ background: '#d8572a' }).toFile('/tmp/work/sail/name_preview.png');
  const tex = doc.createTexture(`${TAG}_name`).setImage(new Uint8Array(png)).setMimeType('image/png');
  const nm = doc.createMaterial(`${TAG}_Name`).setBaseColorTexture(tex).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.35).setDoubleSided(true);
  const pos = [], nrm = [], uv = [], idx = [];
  const LEN = +(process.env.NLEN || 0.44), HGT = LEN * HG / WID, XC = +(process.env.NX || -0.2), YC = +(process.env.NY || 0.06), NU = 56, NV = 6;
  for (const side of [1, -1]) {
    const N0 = [0, +(process.env.NTILT || 0.25), side], nl = Math.hypot(...N0), N = N0.map((v) => v / nl);
    const D0 = [0 - N[0] * N[1], 1 - N[1] * N[1], 0 - N[2] * N[1]], dl = Math.hypot(...D0), D = D0.map((v) => v / dl);
    const R = [D[1] * N[2] - D[2] * N[1], D[2] * N[0] - D[0] * N[2], D[0] * N[1] - D[1] * N[0]];
    const C = [XC, YC, 0.3 * side];
    const base = pos.length / 3; let miss = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = i / NU, v = j / NV;
      const P0 = [0, 1, 2].map((k) => C[k] + R[k] * (u - 0.5) * LEN + D[k] * (v - 0.5) * HGT);
      const O = P0.map((p, k) => p + N[k] * 0.12), d = N.map((k) => -k);
      let t = ray(O, d); if (!isFinite(t)) { t = 0.12; miss++; }
      const hit = O.map((o, k) => o + d[k] * t + N[k] * 0.0018);
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
