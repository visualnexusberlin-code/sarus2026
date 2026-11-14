// SAILETOR_22 (SAILETOR, Plutón): nave de materiales aerodinámicos a partir del modelo de Dear (SAILATOR.glb, morro −X, 1,9 de largo).
// Malla simplificada (≈197k → ≈60k tris), casco de composite con barniz, nombre en los carenados laterales,
// cuatro toberas traseras (dos por góndola) y filetes de levitación bajo las garras delanteras y la quilla de popa.
// Uso: BASE=ships45.glb MODEL=sailator.glb OUT=out.glb S=3.0 node sailetor.mjs
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition, weldPrimitive, simplifyPrimitive, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

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

// ── 2. Casco: composite con barniz (los materiales nuevos de Plutón: brillo limpio, sin desgaste) ──
const mat0 = add.getRoot().listMaterials()[0];
for (const tex of [mat0.getBaseColorTexture(), mat0.getMetallicRoughnessTexture(), mat0.getNormalTexture()])
  tex.setImage(new Uint8Array(await sharp(Buffer.from(tex.getImage())).removeAlpha().jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer())).setMimeType('image/jpeg').setURI('');
const cc = add.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(+(process.env.CC || 0.55)).setClearcoatRoughnessFactor(0.18);
mat0.setName(`${TAG} | Aero composite`).setExtension('KHR_materials_clearcoat', cc);

// triángulos (espacio original) para proyectar nombre y piezas por rayos
const PA = prim.getAttribute('POSITION'), IDX = prim.getIndices().getArray(), RT = [];
{ const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0]; for (let t = 0; t < IDX.length; t += 3) { PA.getElement(IDX[t], a); PA.getElement(IDX[t + 1], b); PA.getElement(IDX[t + 2], c); RT.push([a.slice(), b.slice(), c.slice()]); } }
const ray = (o, d) => {
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
  for (const side of [1, -1]) for (const [y, z, R] of [[0.068, 0.118, 0.021], [-0.052, 0.227, 0.03]]) {
    const o = [1.2, y, z * side], t = ray(o, [-1, 0, 0]); if (!isFinite(t)) { console.log('tobera sin impacto', y, z * side); continue; }
    const x = 1.2 - t + 0.003, b = pos.length / 3;
    pos.push(...sh([x, y, z * side])); nrm.push(...shN([1, 0, 0]));
    for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(...sh([x, y + Math.cos(a) * R, z * side + Math.sin(a) * R])); nrm.push(...shN([1, 0, 0])); }
    for (let k = 1; k <= SEG; k++) idx.push(b, b + k, b + k + 1, b, b + k + 1, b + k);
    n++; console.log('tobera', side, y, 'x', x.toFixed(3));
  }
  V.addChild(doc.createNode(NODE + '_ion').setMesh(doc.createMesh(NODE + '_ion').addPrimitive(mkPrim(ionMat, pos, nrm, idx))));
}
// ── 5. Filetes de levitación: cinta pegada al vientre de las dos garras delanteras y de la quilla de popa ──
{
  const pos = [], nrm = [], idx = [], W = 0.006, NS = 24;
  for (const [x0, x1, z] of [[-0.68, -0.38, 0.195], [-0.68, -0.38, -0.195], [0.5, 0.74, 0]]) {
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

// ── 6. Nombre en los carenados laterales: letra geométrica inclinada, blanca con filo oscuro ──
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
    <g stroke="#1b1d22" stroke-width="${s + 9}">${glyphs}</g><g stroke="#fff" stroke-width="${s}">${glyphs}</g></g></svg>`;
  const png = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
  await sharp(png).flatten({ background: '#d8572a' }).toFile('/tmp/work/sail/name_preview.png');
  const tex = doc.createTexture(`${TAG}_name`).setImage(new Uint8Array(png)).setMimeType('image/png');
  const nm = doc.createMaterial(`${TAG}_Name`).setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([0.12, 0.12, 0.13]).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.35).setDoubleSided(true);
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
