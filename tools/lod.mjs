// LOD de la flota: por cada nave, una malla única (~TRIS triángulos) con el color horneado en los vértices
// (textura base × factor, emisivos con su color, cristales oscuros). Sin texturas: 1 draw call por nave lejana.
// Se guarda bajo el nodo raíz «LODS» como «<NODO>_lod», en coordenadas locales del nodo de la nave.
// Uso: TRIS=1800 node lod.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mat4, vec3 } from 'gl-matrix';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
const TRIS = +(process.env.TRIS || 1800);
const root = doc.getRoot(), scene = root.listScenes()[0], buf = root.listBuffers()[0];
const SKIP = /Name|LOGO/;
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const texCache = new Map();
async function texels(tex) {
  if (texCache.has(tex)) return texCache.get(tex);
  const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(256, 256, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = { data, w: info.width, h: info.height }; texCache.set(tex, t); return t;
}
function sample(t, u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(t.w - 1, Math.floor(u * t.w)), y = Math.min(t.h - 1, Math.floor(v * t.h)), i = (y * t.w + x) * 3;
  return [srgb(t.data[i] / 255), srgb(t.data[i + 1] / 255), srgb(t.data[i + 2] / 255)];
}

let lods = scene.listChildren().find((n) => n.getName() === 'LODS');
if (lods) { for (const c of lods.listChildren()) { c.getMesh()?.dispose(); c.dispose(); } lods.dispose(); }
lods = doc.createNode('LODS'); scene.addChild(lods);

for (const ship of scene.listChildren()) {
  const name = ship.getName();
  if (name === 'LOGOS' || name === 'LODS') continue;
  const inv = mat4.invert(mat4.create(), ship.getWorldMatrix());
  const P = [], C = [], I = [];
  const parts = [];
  ship.traverse((n) => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) parts.push([n, p]); });
  for (const [n, p] of parts) {
    const mat = p.getMaterial(); const mn = mat?.getName() || '';
    if (SKIP.test(mn)) continue;
    const M = mat4.multiply(mat4.create(), inv, n.getWorldMatrix());
    const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
    const bc = mat?.getBaseColorFactor() || [1, 1, 1, 1];
    const tex = mat?.getBaseColorTexture();
    const t = tex ? await texels(tex) : null;
    const em = mat?.getEmissiveFactor() || [0, 0, 0];
    const emStr = mat?.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength?.() ?? 1;
    const glow = Math.max(...em) * emStr > 0.3 || /_Ion|_Hover|Reactor/.test(mn);
    const glass = !!mat?.getExtension('KHR_materials_transmission') || /canopy|Canopy|cockpit|glass|Glass/.test(mn);
    const base = P.length / 3;
    const v = [0, 0, 0], q = vec3.create();
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v); vec3.transformMat4(q, v, M); P.push(q[0], q[1], q[2]);
      let c;
      if (glow) c = em.map((e) => Math.min(1, e * emStr));
      else if (glass) c = [0.035, 0.04, 0.045];
      else { c = [bc[0], bc[1], bc[2]]; if (t && uv) { const w = uv.getElement(i, [0, 0]); const s = sample(t, w[0], w[1]); c = [c[0] * s[0], c[1] * s[1], c[2] * s[2]]; } }
      C.push(c[0], c[1], c[2]);
    }
    if (idx) for (let i = 0; i < idx.getCount(); i++) I.push(base + idx.getScalar(i));
    else for (let i = 0; i < pos.getCount(); i++) I.push(base + i);
  }
  if (!I.length) continue;
  // soldar por posición (2 mm): colores promediados, así el simplificador puede colapsar libremente
  const key = new Map(), remap = new Int32Array(P.length / 3), WP = [], WC = [], WN = [];
  for (let i = 0; i < P.length / 3; i++) {
    const k = `${Math.round(P[i * 3] * 500)},${Math.round(P[i * 3 + 1] * 500)},${Math.round(P[i * 3 + 2] * 500)}`;
    let j = key.get(k);
    if (j === undefined) { j = WP.length / 3; key.set(k, j); WP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); WC.push(0, 0, 0); WN.push(0); }
    remap[i] = j; WC[j * 3] += C[i * 3]; WC[j * 3 + 1] += C[i * 3 + 1]; WC[j * 3 + 2] += C[i * 3 + 2]; WN[j]++;
  }
  for (let j = 0; j < WN.length; j++) for (let k = 0; k < 3; k++) WC[j * 3 + k] /= WN[j];
  let tri = [];
  for (let i = 0; i < I.length; i += 3) { const a = remap[I[i]], b = remap[I[i + 1]], c = remap[I[i + 2]]; if (a !== b && b !== c && a !== c) tri.push(a, b, c); }
  const pos32 = new Float32Array(WP), idx32 = new Uint32Array(tri);
  let [out, err] = MeshoptSimplifier.simplify(idx32, pos32, 3, TRIS * 3, 0.02, []);
  if (out.length > TRIS * 3 * 1.3) [out] = MeshoptSimplifier.simplifySloppy(idx32, pos32, 3, null, TRIS * 3, 0.05);
  // compactar
  const used = new Map(), FP = [], FC = [], FI = [];
  for (const i of out) { let j = used.get(i); if (j === undefined) { j = used.size; used.set(i, j); FP.push(WP[i * 3], WP[i * 3 + 1], WP[i * 3 + 2]); FC.push(WC[i * 3], WC[i * 3 + 1], WC[i * 3 + 2]); } FI.push(j); }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(FP)).setBuffer(buf))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(FC)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(used.size > 65535 ? new Uint32Array(FI) : new Uint16Array(FI)).setBuffer(buf));
  const node = doc.createNode(name + '_lod').setMesh(doc.createMesh(name + '_lod').addPrimitive(prim));
  lods.addChild(node);
  console.log(name.padEnd(14), (I.length / 3) | 0, '→', FI.length / 3, 'tris ·', used.size, 'verts · err', err?.toFixed?.(4));
}
await io.write(process.argv[3], doc);
