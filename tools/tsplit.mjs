// TANAKA: separa los carenados laterales del morro del cuerpo central (hueco oscuro entre ambos, como en la referencia)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN || 'tanaka_def.glb');
const root = doc.getRoot(), buf = root.listBuffers()[0];
const X0 = +(process.env.X0 || 0.35), GAP = +(process.env.GAP || 0.15), XG = +(process.env.XG || 1.3);
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gap = (x) => GAP * sst(X0, XG, x);
// puntos del casco para localizar el valle entre la cabina y los carenados
const hullRe = /Graphite blue|Polished edge|Machined|Carbon|Recess|Engine ceramic|Vermilion|Red ion/;
const pts = [];
const opaque = root.listNodes().find(n => /Opaque/.test(n.getName()));
for (const p of opaque.getMesh().listPrimitives()) if (/Graphite blue/.test(p.getMaterial().getName())) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) pts.push([a[i], a[i + 1], a[i + 2]]); }
let xMax = -9; for (const p of pts) xMax = Math.max(xMax, p[0]);
const SX = [];
for (let x = X0 - 0.2; x <= xMax + 0.01; x += 0.1) {
  let best = 0.45, bv = 9;
  for (let z = 0.12; z <= 0.7; z += 0.02) { let top = -9; for (const p of pts) if (Math.abs(p[0] - x) < 0.06 && Math.abs(Math.abs(p[2]) - z) < 0.025) top = Math.max(top, p[1]); if (top > -8 && top < bv) { bv = top; best = z; } }
  SX.push([x, best]);
}
// suavizado y monotonía (el valle se estrecha hacia el morro)
for (let i = 1; i < SX.length; i++) if (SX[i][0] > 1.0) SX[i][1] = Math.min(SX[i][1], SX[i - 1][1]);
for (let k = 0; k < 3; k++) for (let i = 1; i < SX.length - 1; i++) SX[i][1] = (SX[i - 1][1] + SX[i][1] * 2 + SX[i + 1][1]) / 4;
// el corte nunca entra en el cristal: al menos 3 cm fuera de su borde
{ const gl = []; for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; for (const p of m.listPrimitives()) if (/canopy/.test(p.getMaterial().getName())) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) gl.push([a[i], Math.abs(a[i + 2])]); } }
  for (const s of SX) { let w = 0; for (const [x, z] of gl) if (Math.abs(x - s[0]) < 0.08) w = Math.max(w, z); s[1] = Math.max(s[1], w + 0.03); } }
const seam = (x) => { if (x <= SX[0][0]) return SX[0][1]; for (let i = 0; i < SX.length - 1; i++) if (x <= SX[i + 1][0]) { const t = (x - SX[i][0]) / (SX[i + 1][0] - SX[i][0]); return SX[i][1] + (SX[i + 1][1] - SX[i][1]) * t; } return SX[SX.length - 1][1]; };
console.log('seam', SX.map(([x, z]) => x.toFixed(1) + ':' + z.toFixed(2)).join(' '));
// cristal: comprobar que queda dentro
for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; for (const p of m.listPrimitives()) if (/canopy/.test(p.getMaterial().getName())) { const a = p.getAttribute('POSITION').getArray(); let bad = 0, ex = []; for (let i = 0; i < a.length; i += 3) if (a[i] > X0 && Math.abs(a[i + 2]) > seam(a[i]) - 0.01) { bad++; if (bad % 40 === 1) ex.push([a[i], a[i+1], a[i+2]].map(v => v.toFixed(2)).join(',') + ' s' + seam(a[i]).toFixed(2)); } console.log('glass verts outside seam', bad, ex.join(' | ')); } }
// corte y desplazamiento
const isPod = (x, z) => x > X0 && Math.abs(z) > seam(x);
const done = new Set(); let removed = 0;
const caps = [];       // límites verticales del corte por x
for (const p of opaque.getMesh().listPrimitives()) {
  const pa = p.getAttribute('POSITION'), a = pa.getArray(), idx = p.getIndices().getArray();
  const side = new Int8Array(a.length / 3); for (let i = 0; i < side.length; i++) side[i] = isPod(a[i * 3], a[i * 3 + 2]) ? 1 : 0;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) { const s0 = side[idx[t]], s1 = side[idx[t + 1]], s2 = side[idx[t + 2]]; const gm = Math.max(gap(a[idx[t] * 3]), gap(a[idx[t + 1] * 3]), gap(a[idx[t + 2] * 3]));
    if ((s0 === s1 && s1 === s2) || gm < 0.012) keep.push(idx[t], idx[t + 1], idx[t + 2]); else { removed++; for (let k = 0; k < 3; k++) caps.push([a[idx[t + k] * 3], a[idx[t + k] * 3 + 1], a[idx[t + k] * 3 + 2]]); } }
  p.setIndices(doc.createAccessor().setArray(new Uint32Array(keep)).setType('SCALAR').setBuffer(buf));
  if (!done.has(pa)) { done.add(pa); const b = a.slice(); for (let i = 0; i < side.length; i++) if (side[i]) b[i * 3 + 2] += Math.sign(b[i * 3 + 2]) * gap(b[i * 3]); pa.setArray(b); }
}
console.log('removed tris', removed);
// tapas oscuras: a cada lado del hueco, una lámina vertical que sigue el contorno del corte
const recess = root.listMaterials().find(m => /Recess and gaskets/.test(m.getName()));
const cp = [], ci = [];
for (const sgn of [-1, 1]) for (const off of [0, 1]) {
  const col = [];
  for (const [x] of SX) { if (gap(x) < 0.008) continue; let lo = 9, hi = -9; for (const q of caps) if (Math.abs(q[0] - x) < 0.07 && Math.sign(q[2]) === sgn) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } if (hi < lo) continue; col.push([x, lo + 0.01, hi - 0.015]); }
  const b = cp.length / 3;
  for (const [x, lo, hi] of col) { const z = sgn * (seam(x) + (off ? gap(x) : 0) + (off ? 0.006 : -0.006)); cp.push(x, lo, z, x, hi, z); }
  for (let i = 0; i < col.length - 1; i++) { const a0 = b + i * 2; ci.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
}
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const cn = new Float32Array(cp.length); for (let i = 0; i < cn.length; i += 3) cn[i + 2] = cp[i + 2] > 0 ? -1 : 1;
const cap = doc.createPrimitive().setMaterial(recess).setAttribute('POSITION', A(new Float32Array(cp), 'VEC3')).setAttribute('NORMAL', A(cn, 'VEC3')).setIndices(A(new Uint32Array(ci), 'SCALAR'));
opaque.getMesh().addPrimitive(cap);
// filos: cordón pulido a lo largo de cada borde del corte (oculta el dentado de los triángulos)
{
  const edgeMat = root.listMaterials().find(m => /Polished edge alloy/.test(m.getName()));
  const ep = [], en = [], ei = [];
  const tube = (path, r) => { const b = ep.length / 3, S = 8; path.forEach((c, i) => { const nx = path[Math.min(path.length - 1, i + 1)], pv = path[Math.max(0, i - 1)]; const T = [nx[0]-pv[0], nx[1]-pv[1], nx[2]-pv[2]]; const l = Math.hypot(...T) || 1; T.forEach((v, k) => T[k] = v / l);
    let U = [0, 1, 0]; const d = U[0]*T[0]+U[1]*T[1]+U[2]*T[2]; U = U.map((v, k) => v - d * T[k]); const lu = Math.hypot(...U) || 1; U = U.map(v => v / lu); const W = [T[1]*U[2]-T[2]*U[1], T[2]*U[0]-T[0]*U[2], T[0]*U[1]-T[1]*U[0]];
    for (let s = 0; s < S; s++) { const a = s / S * Math.PI * 2; const nn = U.map((v, k) => v * Math.cos(a) + W[k] * Math.sin(a)); ep.push(c[0] + nn[0] * r, c[1] + nn[1] * r, c[2] + nn[2] * r); en.push(...nn); } });
    for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < S; s++) { const a = b + i * S + s, c = b + i * S + (s + 1) % S; ei.push(a, a + S, c, c, a + S, c + S); } };
  for (const sgn of [-1, 1]) for (const pod of [0, 1]) {
    const rows = [];
    for (let x = X0 + 0.05; x <= xMax; x += 0.04) { if (gap(x) < 0.01) continue; const zs = seam(x); let hi = -9;
      for (const q of caps) if (Math.abs(q[0] - x) < 0.05 && Math.sign(q[2]) === sgn && (pod ? Math.abs(q[2]) > zs : Math.abs(q[2]) <= zs)) hi = Math.max(hi, q[1]);
      if (hi > -8) rows.push([x, hi, sgn * (zs + (pod ? gap(x) + 0.004 : -0.004))]); }
    for (let k = 0; k < 4; k++) for (let i = 1; i < rows.length - 1; i++) rows[i][1] = (rows[i - 1][1] + 2 * rows[i][1] + rows[i + 1][1]) / 4;
    if (rows.length > 3) tube(rows, 0.024);
  }
  opaque.getMesh().addPrimitive(doc.createPrimitive().setMaterial(edgeMat).setAttribute('POSITION', doc.createAccessor().setArray(new Float32Array(ep)).setType('VEC3').setBuffer(buf)).setAttribute('NORMAL', doc.createAccessor().setArray(new Float32Array(en)).setType('VEC3').setBuffer(buf)).setIndices(doc.createAccessor().setArray(new Uint32Array(ei)).setType('SCALAR').setBuffer(buf)));
}
recess.setDoubleSided(true);
await io.write(process.env.OUT || 'tanaka_split.glb', doc);
