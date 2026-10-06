// TANAKA: cristal de cabina con el tratamiento de la flota (oscuro translúcido, suciedad en el marco, piloto visible)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0];
const glassSrc = root.listMaterials().find(m => /transparent smoked cockpit/.test(m.getName()));
const V = root.listScenes()[0].listChildren().find(n => n.getName() === process.env.NODE);
let prim = null; V.traverse(n => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) if (/Polished smoked canopy/.test(p.getMaterial()?.getName())) prim = p; });
const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray(), NV = pos.length / 3;
const key = (j) => pos[j*3].toFixed(4)+','+pos[j*3+1].toFixed(4)+','+pos[j*3+2].toFixed(4);
const ek = new Map();
for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[0,1],[1,2],[2,0]]) { const ka = key(idx[t+a]), kb = key(idx[t+b]); const k = ka < kb ? ka+'|'+kb : kb+'|'+ka; ek.set(k, (ek.get(k)||0)+1); }
const bp = []; for (const [k, c] of ek) if (c === 1) for (const s of k.split('|')) bp.push(s.split(',').map(Number));
if (!bp.length) { // cristal cerrado: el marco es donde el casco toca el cristal
  let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]; for (let j = 0; j < NV; j++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[j*3+k]); mx[k] = Math.max(mx[k], pos[j*3+k]); }
  V.traverse(n => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) if (/Graphite blue/.test(p.getMaterial()?.getName())) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) if ([0,1,2].every(k => a[i+k] > mn[k] - 0.05 && a[i+k] < mx[k] + 0.05)) bp.push([a[i], a[i+1], a[i+2]]); } });
}
const W = +(process.env.RIMW || 0.14), rim = new Float32Array(NV);
for (let j = 0; j < NV; j++) { let d = 1e9; for (const b of bp) d = Math.min(d, Math.hypot(pos[j*3]-b[0], pos[j*3+1]-b[1], pos[j*3+2]-b[2])); rim[j] = Math.max(0, 1 - d / W); }
const g = glassSrc.clone().setName(process.env.NODE + '_Canopy'); g.setExtras({ canopyGlass: { none: true } });
prim.setMaterial(g).setAttribute('_RIM', doc.createAccessor().setArray(rim).setType('SCALAR').setBuffer(buf));
await io.write(process.env.OUT, doc);
console.log('glass verts', NV, 'boundary pts', bp.length);
