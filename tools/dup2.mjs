import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, vec3 } from 'gl-matrix';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.argv[2]);
const ship = doc.getRoot().listNodes().find(n => n.getName() === process.argv[3]);
const inv = mat4.invert(mat4.create(), ship.getWorldMatrix());
const tris = []; const vk = (v) => Array.from(v).map(x => Math.round(x * 2000)).join(',');
ship.traverse(n => { const m = n.getMesh(); if (!m) return; const M = mat4.multiply(mat4.create(), inv, n.getWorldMatrix());
  for (const p of m.listPrimitives()) { const mn = p.getMaterial()?.getName(); const pos = p.getAttribute('POSITION'), idx = p.getIndices(); const cnt = idx ? idx.getCount() : pos.getCount();
    console.log(n.getName(), mn, cnt/3, p.getMaterial()?.getDoubleSided());
    const g = (i) => vec3.transformMat4(vec3.create(), pos.getElement(i, [0,0,0]), M);
    for (let i = 0; i < cnt; i += 3) { const a = g(idx ? idx.getScalar(i) : i), b = g(idx ? idx.getScalar(i+1) : i+1), c = g(idx ? idx.getScalar(i+2) : i+2);
      const ce = [(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3]; const nrm = vec3.cross(vec3.create(), vec3.sub(vec3.create(), b, a), vec3.sub(vec3.create(), c, a)); const ar = vec3.length(nrm); if (ar < 1e-9) continue; vec3.scale(nrm, nrm, 1/ar);
      tris.push({ k: [vk(a),vk(b),vk(c)].sort().join('|'), mn }); } } });

const m = new Map(); for (const t of tris) m.set(t.k, (m.get(t.k)||0)+1); let d=0; for (const v of m.values()) if (v>1) d+=v-1; console.log('tris', tris.length, 'exact duplicates', d);