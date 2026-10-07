// recalcula normales suaves ponderadas por área tras el diezmado (posiciones soldadas: se promedian por posición)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const CREASE = Math.cos((+process.env.CREASE || 50) * Math.PI / 180);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  const P = p.getAttribute('POSITION').getArray(), I = p.getIndices().getArray(), nv = P.length / 3;
  const fn = new Float32Array(I.length);   // normal de cara por triángulo (sin normalizar = área)
  const key = new Map(), vk = new Int32Array(nv);
  for (let v = 0; v < nv; v++) { const k = P[v*3].toFixed(5) + ',' + P[v*3+1].toFixed(5) + ',' + P[v*3+2].toFixed(5); let id = key.get(k); if (id === undefined) { id = key.size; key.set(k, id); } vk[v] = id; }
  const tris = I.length / 3, faceN = new Float32Array(tris * 3);
  for (let t = 0; t < tris; t++) { const a = I[t*3], b = I[t*3+1], c = I[t*3+2]; const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2]; faceN[t*3]=uy*vz-uz*vy; faceN[t*3+1]=uz*vx-ux*vz; faceN[t*3+2]=ux*vy-uy*vx; }
  // por posición: lista de caras
  const pf = Array.from({ length: key.size }, () => []);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) pf[vk[I[t*3+k]]].push(t);
  const N = new Float32Array(nv * 3), unit = (t) => { const x = faceN[t*3], y = faceN[t*3+1], z = faceN[t*3+2], l = Math.hypot(x, y, z) || 1; return [x/l, y/l, z/l]; };
  // normal de vértice: caras de su posición que no forman arista viva con las caras del propio vértice
  const own = Array.from({ length: nv }, () => []); for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) own[I[t*3+k]].push(t);
  for (let v = 0; v < nv; v++) {
    let ref = [0, 0, 0]; for (const t of own[v]) { const u = unit(t); ref[0] += u[0]; ref[1] += u[1]; ref[2] += u[2]; }
    const rl = Math.hypot(...ref) || 1; ref = ref.map((x) => x / rl);
    let x = 0, y = 0, z = 0;
    for (const t of pf[vk[v]]) { const u = unit(t); if (u[0]*ref[0]+u[1]*ref[1]+u[2]*ref[2] < CREASE) continue; x += faceN[t*3]; y += faceN[t*3+1]; z += faceN[t*3+2]; }
    let l = Math.hypot(x, y, z); if (l < 1e-12) { [x, y, z] = ref; l = Math.hypot(x, y, z); } if (l < 1e-12) { x = 0; y = 1; z = 0; l = 1; } N[v*3] = x/l; N[v*3+1] = y/l; N[v*3+2] = z/l;
  }
  p.getAttribute('NORMAL').setArray(N);
}
await io.write(process.argv[3], doc); console.log('ok');
