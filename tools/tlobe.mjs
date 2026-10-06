// TANAKA: lóbulo trasero (cúpula alargada sobre la cola, como en la referencia) con aleta de unión y luces rojas
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN || 'tanaka_split.glb');
const root = doc.getRoot(), buf = root.listBuffers()[0];
const opaque = root.listNodes().find(n => /Opaque/.test(n.getName()));
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const X0 = +(process.env.LX0 || -0.45), X1 = +(process.env.LX1 || -3.3), PK = 0.6;
const HW = +(process.env.HW || 0.6), HH = +(process.env.HH || 0.3);
const yc = (u) => 0.72 - 0.1 * u + 0.04 * Math.sin(u * Math.PI);
const env = (u) => { const e = u < PK ? (u - PK) / PK : (u - PK) / (1 - PK); return Math.sqrt(Math.max(0, 1 - e * e)); };
// cuerpo: cota superior del casco en x
const pts = []; for (const p of opaque.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i + 2]) < 0.15) pts.push([a[i], a[i + 1]]); }
const bodyTop = (x) => { let t = -9; for (const [px, py] of pts) if (Math.abs(px - x) < 0.04) t = Math.max(t, py); return t; };
const NU = 60, NV = 48, pos = [], nrm = [], idx = [];
for (let i = 0; i <= NU; i++) {
  const u = i / NU, x = X0 + (X1 - X0) * u, s = Math.pow(env(u), 0.8);
  const hz = HW * s, hy = HH * s * (0.85 + 0.15 * u);
  for (let j = 0; j <= NV; j++) {
    const a = j / NV * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    // sección: superelipse aplanada abajo, con arista lateral suave
    const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.8), sz = Math.sign(ca) * Math.pow(Math.abs(ca), 0.7);
    pos.push(x, yc(u) + hy * sy * (sa < 0 ? 0.7 : 1), hz * sz);
  }
}
for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
// normales por acumulación
const nv = new Float32Array(pos.length);
for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]; const ux = pos[b*3]-pos[a*3], uy = pos[b*3+1]-pos[a*3+1], uz = pos[b*3+2]-pos[a*3+2], vx = pos[c*3]-pos[a*3], vy = pos[c*3+1]-pos[a*3+1], vz = pos[c*3+2]-pos[a*3+2]; const n = [uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx]; for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nv[v*3+k] += n[k]; }
// orientar hacia fuera
for (let v = 0; v < nv.length / 3; v++) { const l = Math.hypot(nv[v*3], nv[v*3+1], nv[v*3+2]) || 1; for (let k = 0; k < 3; k++) nv[v*3+k] /= l; }
{ const i = Math.round(NU * PK) * (NV + 1) + Math.round(NV / 4); if (nv[i * 3 + 1] < 0) { for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; } for (let k = 0; k < nv.length; k++) nv[k] = -nv[k]; } }
const shell = root.listMaterials().find(m => /Polished edge alloy/.test(m.getName())).clone().setName('TANAKA | Lobe shell').setBaseColorFactor([0.07, 0.09, 0.1, 1]).setMetallicFactor(0.8).setRoughnessFactor(0.24);
opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(shell).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(nv, 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR')));
// aleta de unión bajo el lóbulo (donde se separa del casco)
const fp = [], fi = [], fn = [];
for (const sgn of [-1, 1]) {
  const b = fp.length / 3;
  for (let i = 0; i <= 40; i++) {
    const u = 0.3 + 0.68 * i / 40, x = X0 + (X1 - X0) * u, s = Math.pow(env(u), 0.8);
    const bt = bodyTop(x), lo = (bt < -1 ? 0.2 : bt) - 0.05, hi = yc(u) - HH * s * 0.7 * 0.5;
    const th = 0.05 * (1 - 0.6 * (i / 40));
    fp.push(x, Math.min(lo, hi), sgn * th, x, Math.max(lo, hi), sgn * th * 0.6); fn.push(0, 0, sgn, 0, 0, sgn);
  }
  for (let i = 0; i < 40; i++) { const a = b + i * 2; if (sgn > 0) fi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else fi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
const carbon = root.listMaterials().find(m => /Carbon structure/.test(m.getName()));
opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(carbon).setAttribute('POSITION', A(new Float32Array(fp), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(fn), 'VEC3')).setIndices(A(new Uint32Array(fi), 'SCALAR')));
// luces: dos filetes rojos en el flanco trasero del lóbulo y una barra en la punta (brillan con el color de la escudería)
const lp = [], li = [], ln = [];
const strip = (u0, u1, ang, w) => {
  const b = lp.length / 3, n = 16;
  for (let i = 0; i <= n; i++) {
    const u = u0 + (u1 - u0) * i / n, x = X0 + (X1 - X0) * u, s = Math.pow(env(u), 0.8), hz = HW * s * 1.012, hy = HH * s * (0.85 + 0.15 * u) * 1.012;
    for (const da of [-w, w]) { const a = ang + da, ca = Math.cos(a), sa = Math.sin(a); const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.8), sz = Math.sign(ca) * Math.pow(Math.abs(ca), 0.7); lp.push(x, yc(u) + hy * sy * (sa < 0 ? 0.7 : 1), hz * sz); ln.push(0, sa, ca); }
  }
  for (let i = 0; i < n; i++) { const a = b + i * 2; li.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
};
strip(0.72, 0.93, 0.25, 0.035); strip(0.72, 0.93, Math.PI - 0.25, 0.035); strip(0.955, 0.985, Math.PI / 2 - 0.9, 0.9 * 1); 
const lamp = doc.createMaterial('ALTAIR | Red tail light').setEmissiveFactor([1, 0.12, 0.06]).setBaseColorFactor([1, 0.12, 0.06, 1]).setRoughnessFactor(0.3).setMetallicFactor(0).setDoubleSided(true);
opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(lamp).setAttribute('POSITION', A(new Float32Array(lp), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(ln), 'VEC3')).setIndices(A(new Uint32Array(li), 'SCALAR')));
await io.write(process.env.OUT || 'tanaka_lobe.glb', doc);
console.log('lobe top', Math.max(...pos.filter((_, k) => k % 3 === 1)).toFixed(2), 'body top at -2.2', bodyTop(-2.2).toFixed(2));
