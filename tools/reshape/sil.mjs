import { THREE, build } from './env.mjs';
import fs from 'fs';
const out = {};
for (const id of ['itaka','olympus','tharsis','cassini','tiphares','europa','miranda','phobos']) {
  globalThis.__MIRROR = { [id]: false }; globalThis.__RESHAPE = { [id]: [] };
  const A = await build(id);
  delete globalThis.__MIRROR; delete globalThis.__RESHAPE;
  const B = await build(id);
  const pts = (T) => { const F = T.frame(), r = []; for (let s = 0; s < T.length; s += 10) { T.sample(s, F); r.push([F.pos.x, F.pos.z]); } return r; };
  out[id] = { a: pts(A.track), b: pts(B.track) };
}
fs.writeFileSync('sil.json', JSON.stringify(out));
