// ALTAIR_16 nueva: nave «Raptor» (Meshy) con morro de águila, cabina en gota suavizada con el piloto estándar NEXUS,
// toberas en las dos góndolas y barras de levitación de MANTA. Sustituye a la ALTAIR anterior en la flota.
import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.BASE);
const root = doc.getRoot(), main = root.listScenes()[0], buf = root.listBuffers()[0];
// fuera la ALTAIR anterior y su LOD (el logo LOGO_ALTAIR se queda)
const old = main.listChildren().find(n => n.getName() === 'ALTAIR_16'); const oi = main.listChildren().indexOf(old);
main.removeChild(old); const oldNodes = []; old.traverse(n => oldNodes.push(n)); oldNodes.forEach(n => n.dispose());
const lods = main.listChildren().find(n => n.getName() === 'LODS'); const ol = lods.listChildren().find(c => c.getName() === 'ALTAIR_16_lod'); if (ol) { lods.removeChild(ol); ol.dispose(); }
await doc.transform(prune());
const add = await io.read(process.env.SRC);
mergeDocuments(doc, add);
const scenes = root.listScenes();
const S = +(process.env.S || 3.0);
const V = doc.createNode('ALTAIR_16'); main.addChild(V);
const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];   // morro −X → +Z
let minY = 1e9;
const hull = doc.createNode('ALTAIR_16_hull').setScale([S, S, S]).setRotation(q);
let hullPrim = null;
for (const sc of scenes.slice(1)) for (const n of [...sc.listChildren()]) {
  sc.removeChild(n); const b = getBounds(n); minY = Math.min(minY, b.min[1]); hull.addChild(n);
  n.traverse(c => { const m = c.getMesh(); if (m) { m.setName('ALTAIR_16_hull'); hullPrim = m.listPrimitives()[0]; } });
}
for (const m of root.listMaterials()) if (!m.getName()) m.setName('ALTAIR | Raptor white hull').setMetallicFactor(+(process.env.MET || 0.55));
const lift = -0.2 - minY * S; hull.setTranslation([0, lift, 0]);
V.addChild(hull);
const toShip = (x, y, z) => [z * S, y * S + lift, -x * S];
const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);

// ── toberas: discos de ión en las dos góndolas ──
const M = main.listChildren().find(n => n.getName() === 'MANTA_9');
const mIon = M.listChildren().find(c => /_ion$/.test(c.getName())).getMesh().listPrimitives()[0].getMaterial();
const ionMat = mIon.clone().setName('ALTAIR_Ion');
{ const pos = [], idx = []; const R = +(process.env.R || 0.068) * S, SEG = 20;
  for (const [x, y, z] of [[0.946, 0.088, -0.2], [0.946, 0.088, 0.2]]) {
    const [cx, cy, cz0] = toShip(x, y, z), cz = cz0 - 0.02; const b = pos.length / 3;
    pos.push(cx, cy, cz); for (let k = 0; k <= SEG; k++) { const a = k / SEG * Math.PI * 2; pos.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz); }
    for (let k = 1; k <= SEG; k++) idx.push(b, b + k + 1, b + k);
  }
  const nrm = new Float32Array(pos.length); for (let i = 2; i < nrm.length; i += 3) nrm[i] = -1;
  V.addChild(doc.createNode('ALTAIR_16_ion').setMesh(doc.createMesh('ALTAIR_16_ion').addPrimitive(doc.createPrimitive().setMaterial(ionMat)
    .setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(nrm, 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR'))))); }
// ── levitación: barras de MANTA ──
const mh = M.listChildren().find(c => /_hover$/.test(c.getName()));
V.addChild(doc.createNode('ALTAIR_16_hover').setMesh(mh.getMesh()).setScale(mh.getScale()).setTranslation(mh.getTranslation()));

// ── cabina en gota: planta y alzado (coordenadas de la malla original: morro −X, arriba +Y) ──
const XF = +(process.env.XF || -0.70), XB = +(process.env.XB || -0.17), WMAX = +(process.env.WM || 0.105), HMAX = +(process.env.HM || 0.078), TMAX = 0.36;
const spineY = (x) => { const k = (x - XF) / (XB - XF); return 0.014 + (0.066 - 0.014) * Math.min(1, Math.max(0, k)) - 0.02; };   // lomo suavizado (sin la aleta)
const prof = (t) => t < TMAX ? Math.sqrt(Math.max(0, 1 - ((TMAX - t) / TMAX) ** 2)) : Math.pow(Math.max(0, 1 - ((t - TMAX) / (1 - TMAX)) ** 2), 0.85);
const NU = 48, NV = 28;
const gp = [], gn = [], guv = [], grim = [], gi = [];
for (let i = 0; i <= NU; i++) {
  const t = i / NU, x = XF + (XB - XF) * t, w = WMAX * prof(t), h = HMAX * Math.pow(prof(t), 0.75), y0 = spineY(x);
  for (let j = 0; j <= NV; j++) {
    const a = Math.PI * j / NV, cz = -Math.cos(a), cy = Math.sin(a);   // de −z a +z por arriba
    const px = x, py = y0 + h * Math.pow(cy, 0.85), pz = w * cz;
    const P = toShip(px, py, pz); gp.push(...P); guv.push(j / NV, t);
    grim.push(Math.max(0, 1 - cy / 0.32) * 0.9 + (t > 0.9 ? (t - 0.9) * 6 : 0));
  }
}
for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; gi.push(a, a + 1, b, a + 1, b + 1, b); }
// normales por promedio de caras
const gN = new Float32Array(gp.length);
for (let k = 0; k < gi.length; k += 3) { const [a, b, c] = [gi[k], gi[k+1], gi[k+2]]; const ux = gp[b*3]-gp[a*3], uy = gp[b*3+1]-gp[a*3+1], uz = gp[b*3+2]-gp[a*3+2], vx = gp[c*3]-gp[a*3], vy = gp[c*3+1]-gp[a*3+1], vz = gp[c*3+2]-gp[a*3+2];
  const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; for (const v of [a, b, c]) { gN[v*3] += nx; gN[v*3+1] += ny; gN[v*3+2] += nz; } }
for (let v = 0; v < gN.length; v += 3) { const l = Math.hypot(gN[v], gN[v+1], gN[v+2]) || 1; gN[v] /= l; gN[v+1] /= l; gN[v+2] /= l; if (gN[v+1] < 0) { gN[v] *= -1; gN[v+1] *= -1; gN[v+2] *= -1; } }
const nx8 = main.listChildren().find(n => n.getName() === 'NEXUS_8'); const ck = nx8.listChildren().find(c => c.getName() === 'NEXUS_8_cockpit');
const glassSrc = root.listMaterials().find(m => /transparent smoked cockpit/.test(m.getName()));
const glass = glassSrc.clone().setName('ALTAIR_Canopy'); glass.setExtras({ canopyGlass: { none: true } });
V.addChild(doc.createNode('ALTAIR_16_canopy').setMesh(doc.createMesh('ALTAIR_16_canopy').addPrimitive(doc.createPrimitive().setMaterial(glass)
  .setAttribute('POSITION', A(new Float32Array(gp), 'VEC3')).setAttribute('NORMAL', A(gN, 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(guv), 'VEC2'))
  .setAttribute('_RIM', A(new Float32Array(grim), 'SCALAR')).setIndices(A(new Uint32Array(gi), 'SCALAR')))));
// junta oscura alrededor de la base (tubo a lo largo del contorno)
const gasketMat = root.listMaterials().find(m => m.getName() === 'FLEET_Graphite');
{ const pos = [], idx = [], nrm = []; const outline = [];
  for (let i = 0; i <= NU; i++) { const t = i / NU, x = XF + (XB - XF) * t; outline.push([x, -WMAX * prof(t)]); }
  for (let i = NU; i >= 0; i--) { const t = i / NU, x = XF + (XB - XF) * t; outline.push([x, WMAX * prof(t)]); }
  const RS = 0.011, SEG = 8;
  outline.forEach(([x, z], k) => { const y0 = spineY(x); const nb = outline[Math.min(outline.length - 1, k + 1)], pb = outline[Math.max(0, k - 1)];
    let dx = nb[0] - pb[0], dz = nb[1] - pb[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const ox = -dz, oz = dx;   // normal en planta
    for (let s = 0; s <= SEG; s++) { const a = s / SEG * Math.PI * 2; const ex = ox * Math.cos(a) * RS, ez = oz * Math.cos(a) * RS, ey = Math.sin(a) * RS;
      pos.push(...toShip(x + ex, y0 + ey, z + ez)); const n = toShip(ox * Math.cos(a), Math.sin(a), oz * Math.cos(a)); nrm.push(n[0] / S, (n[1] - lift) / S, n[2] / S); } });
  for (let k = 0; k < outline.length - 1; k++) for (let s = 0; s < SEG; s++) { const a = k * (SEG + 1) + s, b = a + SEG + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  V.addChild(doc.createNode('ALTAIR_16_gasket').setMesh(doc.createMesh('ALTAIR_16_gasket').addPrimitive(doc.createPrimitive().setMaterial(gasketMat)
    .setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3')).setIndices(A(new Uint32Array(idx), 'SCALAR'))))); }
// casco: fuera los triángulos que quedan dentro de la gota (la aleta y el lomo bajo el cristal)
{ const P = hullPrim.getAttribute('POSITION').getArray(), I = hullPrim.getIndices().getArray(); const keep = []; let cut = 0;
  for (let k = 0; k < I.length; k += 3) { let inside = 0;
    for (let e = 0; e < 3; e++) { const v = I[k+e]; const x = P[v*3], y = P[v*3+1], z = P[v*3+2]; const t = (x - XF) / (XB - XF);
      if (t > 0.01 && t < 0.99 && Math.abs(z) < WMAX * prof(t) * 0.97 && y > spineY(x) - 0.03) inside++; }
    if (inside === 3) cut++; else keep.push(I[k], I[k+1], I[k+2]); }
  hullPrim.setIndices(A(new Uint32Array(keep), 'SCALAR')); console.log('hull tris cut', cut); }
// cubeta oscura bajo el cristal
{ const tp = [], ti = [], tn = []; const SU = 40, SV = 10, DEP = 0.07;
  for (let i = 0; i <= SU; i++) { const t = i / SU, x = XF + (XB - XF) * t, w = WMAX * prof(t) * 0.98, y0 = spineY(x) + 0.004;
    for (let j = 0; j <= SV; j++) { const a = Math.PI * j / SV; const cz = -Math.cos(a), cy = -Math.sin(a);
      tp.push(...toShip(x, y0 + DEP * prof(t) * cy, w * cz)); tn.push(...[cz, -cy, 0].map((v, k) => k === 0 ? 0 : v)); } }
  for (let i = 0; i < SU; i++) for (let j = 0; j < SV; j++) { const a = i * (SV + 1) + j, b = a + SV + 1; ti.push(a, b, a + 1, a + 1, b, b + 1); }
  const tnS = []; for (let k = 0; k < tn.length; k += 3) { tnS.push(tn[k+2], tn[k+1], 0); }
  const tubMat = doc.createMaterial('ALTAIR_CockpitTub').setBaseColorFactor([0.035, 0.037, 0.04, 1]).setRoughnessFactor(0.8).setMetallicFactor(0.2).setDoubleSided(true);
  V.addChild(doc.createNode('ALTAIR_16_tub').setMesh(doc.createMesh('ALTAIR_16_tub').addPrimitive(doc.createPrimitive().setMaterial(tubMat)
    .setAttribute('POSITION', A(new Float32Array(tp), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(tnS), 'VEC3')).setIndices(A(new Uint32Array(ti), 'SCALAR'))))); }
// piloto estándar NEXUS
{ const pilotSrc = ck.listChildren().filter(c => /^PILOT/.test(c.getName()));
  let pmin = [1e9,1e9,1e9], pmax = [-1e9,-1e9,-1e9];
  for (const p of pilotSrc) { const b = getBounds(p); for (let i = 0; i < 3; i++) { pmin[i] = Math.min(pmin[i], b.min[i]); pmax[i] = Math.max(pmax[i], b.max[i]); } }
  const ckT = ck.getTranslation(), ckS = ck.getScale()[0];
  const k = +(process.env.PK || 0.82);
  const tPeak = TMAX, xh = XF + (XB - XF) * (+(process.env.PT || 0.42));
  const top = toShip(xh, spineY(xh) + HMAX * 0.93, 0);
  const pzc = toShip(XF + (XB - XF) * (+(process.env.PC || 0.55)), 0, 0)[2];
  const rig = doc.createNode('ALTAIR_16_pilot').setScale([k, k, k]).setTranslation([0, top[1] - pmax[1] * k, pzc - (pmin[2] + pmax[2]) / 2 * k]);
  for (const p of pilotSrc) { const qn = doc.createNode(p.getName()).setMesh(p.getMesh()); const t = p.getTranslation();
    qn.setTranslation([ckT[0] + ckS * t[0], ckT[1] + ckS * t[1], ckT[2] + ckS * t[2]]).setScale([ckS, ckS, ckS]).setRotation(p.getRotation()); rig.addChild(qn); }
  V.addChild(rig);
  const rb = getBounds(rig); console.log('pilot', rb.min.map(v => v.toFixed(2)), rb.max.map(v => v.toFixed(2))); }
// orden: la nueva ALTAIR donde estaba la anterior
const kids = main.listChildren(); main.removeChild(V); 
for (const s of scenes.slice(1)) s.dispose();
const rest = main.listChildren(); for (const n of rest) main.removeChild(n); rest.splice(oi, 0, V); for (const n of rest) main.addChild(n);
await doc.transform(prune(), unpartition());
await io.write(process.env.OUT, doc);
const cb = getBounds(V.listChildren().find(c => c.getName() === 'ALTAIR_16_canopy')), hb = getBounds(hull);
console.log('hull', hb.min.map(v => v.toFixed(2)), hb.max.map(v => v.toFixed(2)), 'canopy', cb.min.map(v => v.toFixed(2)), cb.max.map(v => v.toFixed(2)));
