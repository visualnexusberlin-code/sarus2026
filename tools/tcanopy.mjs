// ALTAIR: cabina nueva y agresiva (cristal largo que sube desde el morro hasta una burbuja alta), marco oscuro,
// cubeta interior y piloto elevado para que se vea a través del cristal
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN || 'tanaka_lobe.glb');
const root = doc.getRoot(), buf = root.listBuffers()[0];
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const opaque = root.listNodes().find(n => /Opaque/.test(n.getName()));
const glassNode = root.listNodes().find(n => /\| Glass/.test(n.getName()));
const oldGlassPrim = glassNode.getMesh().listPrimitives()[0], glassMat = oldGlassPrim.getMaterial();
glassNode.getMesh().removePrimitive(oldGlassPrim);
const XA = +(process.env.XA || -0.4), XB = +(process.env.XB || 2.8), TOP0 = +(process.env.TOP0 || 1.1), HW = +(process.env.HW || 0.42);
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// cota del casco central (antes de recortar)
const cpts = []; for (const p of opaque.getMesh().listPrimitives()) if (/Graphite blue/.test(p.getMaterial().getName())) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i + 2]) < 0.12) cpts.push([a[i], a[i + 1]]); }
const hullTop = (x) => { let t = -9; for (const [px, py] of cpts) if (Math.abs(px - x) < 0.05) t = Math.max(t, py); return t < -1 ? 0.3 : t; };
const env = (t) => t < 0.14 ? Math.sqrt(Math.max(0, 1 - ((0.14 - t) / 0.14) ** 2)) : Math.pow(Math.max(0, 1 - Math.pow((t - 0.14) / 0.86, 1.5)), 0.65);
const topY = (x) => { const t = (x - XA) / (XB - XA); return 0.34 + (TOP0 - 0.34) * Math.pow(1 - Math.max(0, t - 0.12) / 0.88, 0.75); };
const NU = 72, NV = 40;
const prof = []; for (let i = 0; i <= NU; i++) { const t = i / NU, x = XA + (XB - XA) * t, e = env(t), yb = hullTop(x) - 0.14; prof.push({ x, t, e, yb, hw: HW * e, top: yb + Math.max(0, topY(x) - yb) * Math.pow(e, 0.6) }); }
// recorte del casco bajo el cristal
let cut = 0;
for (const p of opaque.getMesh().listPrimitives()) {
  if (!/Graphite blue|Polished edge|Machined|Carbon|Recess/.test(p.getMaterial().getName())) continue;
  const a = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += a[idx[t + k] * 3] / 3; cy += a[idx[t + k] * 3 + 1] / 3; cz += a[idx[t + k] * 3 + 2] / 3; }
    const u = (cx - XA) / (XB - XA); let inside = false;
    if (u > 0.01 && u < 0.97) { const q = prof[Math.round(u * NU)]; inside = Math.abs(cz) < q.hw * 0.9 && cy > q.yb - 0.02; }
    if (inside) cut++; else keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  p.setIndices(A(new Uint32Array(keep), 'SCALAR'));
}
// cristal
const gp = [], gi = [];
for (const q of prof) for (let j = 0; j <= NV; j++) { const a = Math.PI * j / NV, ca = Math.cos(a), sa = Math.sin(a);
  const sz = Math.sign(ca) * Math.pow(Math.abs(ca), 0.75), sy = Math.pow(sa, 0.7);
  gp.push(q.x, q.yb + (q.top - q.yb) * sy, q.hw * sz); }
for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; gi.push(a, b, a + 1, a + 1, b, b + 1); }
const gn = new Float32Array(gp.length);
for (let t = 0; t < gi.length; t += 3) { const [a, b, c] = [gi[t], gi[t+1], gi[t+2]]; const ux=gp[b*3]-gp[a*3],uy=gp[b*3+1]-gp[a*3+1],uz=gp[b*3+2]-gp[a*3+2],vx=gp[c*3]-gp[a*3],vy=gp[c*3+1]-gp[a*3+1],vz=gp[c*3+2]-gp[a*3+2]; const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx]; for (const v of [a,b,c]) for (let k=0;k<3;k++) gn[v*3+k]+=n[k]; }
for (let v = 0; v < gn.length; v += 3) { const l = Math.hypot(gn[v], gn[v+1], gn[v+2]) || 1; gn[v] /= l; gn[v+1] /= l; gn[v+2] /= l; }
{ const mid = Math.round(NU * 0.3) * (NV + 1) + NV / 2; if (gn[mid * 3 + 1] < 0) { for (let t = 0; t < gi.length; t += 3) { const q = gi[t + 1]; gi[t + 1] = gi[t + 2]; gi[t + 2] = q; } for (let k = 0; k < gn.length; k++) gn[k] = -gn[k]; } }
glassNode.getMesh().addPrimitive(doc.createPrimitive().setMaterial(glassMat).setAttribute('POSITION', A(new Float32Array(gp), 'VEC3')).setAttribute('NORMAL', A(gn, 'VEC3')).setIndices(A(new Uint32Array(gi), 'SCALAR')));
// marco: cordón oscuro en la base, nervio central en la mitad delantera y dos montantes inclinados
const carbon = root.listMaterials().find(m => /Carbon structure/.test(m.getName()));
const tube = (path, r, o) => { const b = o.p.length / 3, S = 8; path.forEach((c, i) => { const nx = path[Math.min(path.length - 1, i + 1)], pv = path[Math.max(0, i - 1)]; const T = [nx[0]-pv[0], nx[1]-pv[1], nx[2]-pv[2]]; const l = Math.hypot(...T) || 1; T.forEach((v, k) => T[k] = v / l);
  let U = [0, 1, 0]; const d = U[0]*T[0]+U[1]*T[1]+U[2]*T[2]; U = U.map((v, k) => v - d * T[k]); const lu = Math.hypot(...U) || 1; U = U.map(v => v / lu); const W = [T[1]*U[2]-T[2]*U[1], T[2]*U[0]-T[0]*U[2], T[0]*U[1]-T[1]*U[0]];
  for (let s = 0; s < S; s++) { const a = s / S * Math.PI * 2; const nn = U.map((v, k) => v * Math.cos(a) + W[k] * Math.sin(a)); o.p.push(c[0] + nn[0] * r, c[1] + nn[1] * r, c[2] + nn[2] * r); o.n.push(...nn); } });
  for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < S; s++) { const a = b + i * S + s, c = b + i * S + (s + 1) % S; o.i.push(a, a + S, c, c, a + S, c + S); } };
const fr = { p: [], n: [], i: [] };
for (const sg of [-1, 1]) tube(prof.filter(q => q.e > 0.02).map(q => [q.x, q.yb + 0.012, sg * q.hw * 1.005]), 0.022, fr);
tube(prof.filter(q => q.t > 0.42 && q.t < 0.985).map(q => [q.x, q.top + 0.004, 0]), 0.016, fr);
for (const sg of [-1, 1]) { const q = prof[Math.round(NU * 0.36)]; const path = []; for (let j = 0; j <= 12; j++) { const a = Math.PI / 2 * j / 12; const ca = Math.cos(a), sa = Math.sin(a); path.push([q.x, q.yb + (q.top - q.yb) * Math.pow(sa, 0.7) + 0.006, sg * q.hw * Math.pow(ca, 0.75) * 1.01]); } tube(path, 0.018, fr); }
opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(carbon).setAttribute('POSITION', A(new Float32Array(fr.p), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(fr.n), 'VEC3')).setIndices(A(new Uint32Array(fr.i), 'SCALAR')));
// cubeta: carcasa oscura bajo el cristal
const tp = [], ti = [], tn = [];
for (const q of prof) for (let j = 0; j <= NV; j++) { const a = Math.PI + Math.PI * j / NV, ca = Math.cos(a), sa = Math.sin(a); tp.push(q.x, q.yb + 0.01 + sa * 0.32 * q.e, ca * q.hw * 0.99); tn.push(0, -sa, -ca); }
for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; ti.push(a, a + 1, b, a + 1, b + 1, b); }
const tub = doc.createMaterial('ALTAIR | CockpitTub').setBaseColorFactor([0.03, 0.033, 0.036, 1]).setRoughnessFactor(0.8).setMetallicFactor(0.2).setDoubleSided(true);
opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(tub).setAttribute('POSITION', A(new Float32Array(tp), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(tn), 'VEC3')).setIndices(A(new Uint32Array(ti), 'SCALAR')));
// piloto: sube y se centra bajo la burbuja
const pilotRe = /PILOT|pilot suit|^0[1-7] \|/;
let pmin = [9, 9, 9], pmax = [-9, -9, -9];
const pprims = opaque.getMesh().listPrimitives().filter(p => pilotRe.test(p.getMaterial()?.getName()));
for (const p of pprims) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { pmin[k] = Math.min(pmin[k], a[i + k]); pmax[k] = Math.max(pmax[k], a[i + k]); } }
const PX = +(process.env.PX || 0.15), PS = +(process.env.PS || 1.1);
const qh = prof.reduce((b, q) => Math.abs(q.x - PX) < Math.abs(b.x - PX) ? q : b);
const pcx = (pmin[0] + pmax[0]) / 2, dyTop = qh.top - 0.11;
const done = new Set();
for (const p of pprims) { const acc = p.getAttribute('POSITION'); if (done.has(acc)) continue; done.add(acc); const a = acc.getArray().slice();
  for (let i = 0; i < a.length; i += 3) { a[i] = PX + (a[i] - pcx) * PS; a[i + 1] = dyTop + (a[i + 1] - pmax[1]) * PS; a[i + 2] *= PS; } acc.setArray(a); }
await io.write(process.env.OUT || 'tanaka_cab.glb', doc);
console.log('cut tris', cut, 'pilot bbox', pmin.map(v => v.toFixed(2)), pmax.map(v => v.toFixed(2)), 'canopy top', Math.max(...prof.map(q => q.top)).toFixed(2), 'head at', dyTop.toFixed(2));
