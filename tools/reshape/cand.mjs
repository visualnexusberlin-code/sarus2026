import { THREE, build } from './env.mjs';
const id = process.argv[2];
globalThis.__RESHAPE = { [id]: [] };
const r = await build(id);
const T = r.track, L = T.length, F = T.frame();
const meshes = []; r.world.traverse((o) => { if (o.isMesh && o.visible !== false) meshes.push(o); });
const ray = new THREE.Raycaster();
const step = 8, n = Math.floor(L / step);
const pts = [], hd = [];
for (let i = 0; i < n; i++) { T.sample(i * step, F); pts.push({ p: F.pos.clone(), r: F.right.clone(), f: F.tangent ? F.tangent.clone() : null }); }
for (let i = 0; i < n; i++) { const a = pts[(i + 1) % n].p.clone().sub(pts[i].p); hd.push(Math.atan2(a.z, a.x)); }
const dh = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// self proximity: for each i, nearest other part (|ds|>300) horizontal distance and side
function selfNear(i) {
  let best = 1e9, side = 0; const P = pts[i];
  for (let j = 0; j < n; j++) { let ds = Math.abs(j - i) * step; ds = Math.min(ds, L - ds); if (ds < 300) continue;
    const d = Math.hypot(pts[j].p.x - P.p.x, pts[j].p.z - P.p.z); if (d < best) { best = d; side = Math.sign((pts[j].p.x - P.p.x) * P.r.x + (pts[j].p.z - P.p.z) * P.r.z); } }
  return [best, side];
}
function freeSide(i, sgn) {
  const P = pts[i]; let free = 120;
  for (const h of [2, 10]) {
    const o = P.p.clone().addScaledVector(P.r, sgn * 20); o.y += h;
    const dir = P.r.clone().multiplyScalar(sgn); dir.y = 0; dir.normalize();
    ray.set(o, dir); ray.far = 120;
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) free = Math.min(free, hit.distance);
  }
  return free;
}
const W = 50; // 400 m windows
const out = [];
for (let i = 0; i < n; i += 4) {
  let turn = 0, maxk = 0;
  for (let k = -W / 2; k < W / 2; k++) { const a = (i + k + n) % n; const d = dh(hd[a], hd[(a + 1) % n]); turn += d; maxk = Math.max(maxk, Math.abs(d)); }
  const s = i * step;
  out.push({ s, turn: +turn.toFixed(2), maxk: +(maxk / step * 1000).toFixed(1) });
}
// summarise every 100 m: straightness + free space each side + self proximity
const rows = [];
for (let s = 0; s < L; s += 100) {
  const i = Math.round(s / step) % n;
  const o = out.reduce((a, b) => Math.abs(b.s - s) < Math.abs(a.s - s) ? b : a);
  const [sd, sside] = selfNear(i);
  rows.push(`${String(s).padStart(5)}  turn400=${String(o.turn).padStart(6)} maxk=${String(o.maxk).padStart(5)}  freeL=${freeSide(i, -1).toFixed(0).padStart(3)} freeR=${freeSide(i, 1).toFixed(0).padStart(3)}  self=${sd.toFixed(0).padStart(4)}${sside > 0 ? 'R' : 'L'}  y=${pts[i].p.y.toFixed(0)}`);
}
console.log(id, 'L', L.toFixed(0)); console.log(rows.join('\n'));
