// TANAKA/ALTAIR: láminas escalonadas bajo el morro (como en la referencia): bajo el carenado central y bajo cada carenado lateral
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN || 'tanaka_lobe.glb');
const root = doc.getRoot(), buf = root.listBuffers()[0];
const opaque = root.listNodes().find(n => /Opaque/.test(n.getName()));
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const pts = []; for (const p of opaque.getMesh().listPrimitives()) if (/Graphite blue/.test(p.getMaterial().getName())) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) pts.push([a[i], a[i + 1], a[i + 2]]); }
const regions = JSON.parse(process.env.REG || '[[-0.32,0.32],[-1.9,-0.62],[0.62,1.9]]');
const mats = ['Machined titanium', 'Carbon structure', 'Polished edge alloy'].map(n => root.listMaterials().find(m => m.getName().includes(n)));
const red = root.listMaterials().find(m => /Vermilion fittings/.test(m.getName()));
const parts = mats.map(() => ({ p: [], i: [] })), rp = { p: [], i: [] };
const slab = (o, rows) => {                                     // rows: [x, y, zL, zR, th]
  const b = o.p.length / 3;
  for (const [x, y, zL, zR, th] of rows) o.p.push(x, y, zL, x, y, zR, x, y - th, zR, x, y - th, zL);
  for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < 4; k++) { const a = b + r * 4 + k, c = b + r * 4 + (k + 1) % 4; o.i.push(a, c, a + 4, c, c + 4, a + 4); }
  const e = b + (rows.length - 1) * 4; o.i.push(e, e + 1, e + 2, e, e + 2, e + 3, b, b + 2, b + 1, b, b + 3, b + 2);
};
for (const [z0, z1] of regions) {
  // perfil inferior de la región
  const prof = [];
  for (let x = 0.4; x <= 3.4; x += 0.05) {
    let lo = 9, zs = []; for (const q of pts) if (Math.abs(q[0] - x) < 0.04 && q[2] > z0 && q[2] < z1) lo = Math.min(lo, q[1]);
    if (lo > 8) continue;
    for (const q of pts) if (Math.abs(q[0] - x) < 0.04 && q[2] > z0 && q[2] < z1 && q[1] < lo + 0.06) zs.push(q[2]);
    prof.push([x, lo, Math.min(...zs), Math.max(...zs)]);
  }
  if (prof.length < 4) continue;
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < prof.length - 1; i++) for (let k = 1; k < 4; k++) prof[i][k] = (prof[i - 1][k] + 2 * prof[i][k] + prof[i + 1][k]) / 4;
  const tip = prof[prof.length - 1][0];
  for (let k = 0; k < 3; k++) {
    const ext = 0.06 + k * 0.07, inset = 0.03 + k * 0.035, drop = 0.012 + k * 0.035, xs = 0.55 + k * 0.35;
    const rows = [];
    for (const [x, lo, zl, zr] of prof) { if (x < xs) continue; const w = zr - zl; if (w < 2 * inset + 0.04) continue; rows.push([x, lo - drop, zl + inset, zr - inset, 0.018]); }
    if (rows.length < 3) continue;
    // punta: se adelanta y se afila
    const [lx, ly, lzl, lzr] = rows[rows.length - 1], mid = (lzl + lzr) / 2, hw = (lzr - lzl) / 2;
    for (let s = 1; s <= 4; s++) { const t = s / 4; rows.push([lx + ext * t, ly - 0.005 * t, mid - hw * (1 - 0.85 * t), mid + hw * (1 - 0.85 * t), 0.018]); }
    slab(parts[k], rows);
    if (k === 1) { const r2 = rows.slice(-6).map(([x, y, zl, zr]) => [x, y - 0.019, zl + 0.01, zr - 0.01, 0.006]); slab(rp, r2); }
  }
}
const prim = (o, m) => { const g = doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(o.p), 'VEC3')).setIndices(A(new Uint32Array(o.i), 'SCALAR'));
  // normales planas aproximadas
  const n = new Float32Array(o.p.length); for (let t = 0; t < o.i.length; t += 3) { const [a, b, c] = [o.i[t], o.i[t+1], o.i[t+2]]; const ux=o.p[b*3]-o.p[a*3],uy=o.p[b*3+1]-o.p[a*3+1],uz=o.p[b*3+2]-o.p[a*3+2],vx=o.p[c*3]-o.p[a*3],vy=o.p[c*3+1]-o.p[a*3+1],vz=o.p[c*3+2]-o.p[a*3+2]; const nn=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx]; for (const v of [a,b,c]) for (let k=0;k<3;k++) n[v*3+k]+=nn[k]; }
  for (let v = 0; v < n.length; v += 3) { const l = Math.hypot(n[v], n[v+1], n[v+2]) || 1; n[v] /= l; n[v+1] /= l; n[v+2] /= l; }
  return g.setAttribute('NORMAL', A(n, 'VEC3')); };
parts.forEach((o, k) => { if (o.i.length) { mats[k].setDoubleSided(true); opaque.getMesh().addPrimitive(prim(o, mats[k])); } });
if (rp.i.length) opaque.getMesh().addPrimitive(prim(rp, red));
await io.write(process.env.OUT || 'tanaka_panel.glb', doc);
console.log('blades', parts.map(o => o.i.length / 3));
