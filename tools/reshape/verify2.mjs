import { THREE, build } from './env.mjs';
const id = process.argv[2];
const edits = JSON.parse(process.argv[3]);
async function probe(eds) {
  globalThis.__RESHAPE = { [id]: eds };
  const r = await build(id);
  const T = r.track, L = T.length, F = T.frame();
  const meshes = []; r.world.traverse((o) => { if (o.isMesh && o.visible !== false) meshes.push(o); });
  const ray = new THREE.Raycaster();
  const step = 8, n = Math.floor(L / step), P = [];
  for (let i = 0; i < n; i++) { T.sample(i * step, F); P.push(F.pos.clone()); }
  let cx = 0, cz = 0; P.forEach((p) => { cx += p.x; cz += p.z; }); cx /= n; cz /= n;
  const res = [];
  for (const e of edits) {
    const a = e.s - e.len / 2 - 40, b = e.s + e.len / 2 + 40;
    let selfMin = 1e9, hits = {}, gapMax = 0, gapMin = 1e9, inner = 0, maxk = 0, prevH = null;
    for (let s = a; s <= b; s += 8) {
      const sw = ((s % L) + L) % L; T.sample(sw, F);
      const p = F.pos.clone(), rt = F.right.clone(), up = F.up.clone(), w = T.wAt ? T.wAt(sw) : 1;
      const i = Math.round(sw / step) % n;
      for (let j = 0; j < n; j++) { let ds = Math.abs(j - i) * step; ds = Math.min(ds, L - ds); if (ds < 300) continue; selfMin = Math.min(selfMin, Math.hypot(P[j].x - p.x, P[j].z - p.z)); }
      const o = p.clone().addScaledVector(up, 1.5);
      for (const [dir, far] of [[rt, 14 * w], [rt.clone().negate(), 14 * w], [up, 9]]) {
        ray.set(o, dir.clone().normalize()); ray.far = far;
        const h = ray.intersectObjects(meshes, false)[0];
        if (h) { const k = (h.object.name || h.object.material?.name || 'mesh') + (dir === up ? '^' : ''); hits[k] = (hits[k] || 0) + 1; if (process.env.DBG) console.log("HIT", s.toFixed(0), dir === up ? "up" : "lat", h.distance.toFixed(1), h.object.material?.type, h.object.geometry?.type, JSON.stringify(h.point)); }
      }
      ray.set(p.clone().addScaledVector(up, -0.6), up.clone().negate()); ray.far = 400;
      const g = ray.intersectObjects(meshes, false)[0]; const gd = g ? g.distance : 400; gapMax = Math.max(gapMax, gd); gapMin = Math.min(gapMin, gd);
      const toC = new THREE.Vector3(cx - p.x, 0, cz - p.z); inner += Math.sign(toC.dot(rt));
      const hd = Math.atan2(F.tan?.z ?? 0, F.tan?.x ?? 0); if (prevH !== null) { let d = hd - prevH; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; maxk = Math.max(maxk, Math.abs(d) / 8); } prevH = hd;
    }
    res.push({ s: e.s, selfMin: Math.round(selfMin), hits, gap: [gapMin.toFixed(1), gapMax.toFixed(1)], interiorSide: inner > 0 ? 'R' : 'L', minR: Math.round(1 / Math.max(maxk, 1e-6)) });
  }
  return { L: Math.round(L), res };
}
const before = await probe([]);
const after = await probe(edits);
console.log(id, 'L', before.L, '→', after.L);
for (let k = 0; k < edits.length; k++) {
  const b = before.res[k], a = after.res[k];
  console.log(`edit s=${edits[k].s} len=${edits[k].len} off=${edits[k].off}  interior=${b.interiorSide}`);
  console.log('  before self', b.selfMin, 'gap', b.gap, 'minR', b.minR, 'hits', JSON.stringify(b.hits));
  console.log('  after  self', a.selfMin, 'gap', a.gap, 'minR', a.minR, 'hits', JSON.stringify(a.hits));
}
