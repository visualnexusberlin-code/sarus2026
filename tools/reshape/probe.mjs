import { THREE, build } from './env.mjs';
const id = process.argv[2];
const t0 = Date.now();
try {
  const r = await build(id);
  const T = r.track; let tris = 0, meshes = 0; r.world.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  console.log(id, 'L', T.length.toFixed(0), 'meshes', meshes, 'tris', (tris/1e6).toFixed(2)+'M', (Date.now()-t0)+'ms');
} catch (e) { console.log(id, 'FAIL', e.message, e.stack.split('\n').slice(1,4).join(' | ')); }
