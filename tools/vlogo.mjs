// Logo VEGA: tres lazos entrelazados (variante propia de un nudo trilobulado), cinta plana con relieve
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], sc = root.listScenes()[0];
const LOGOS = sc.listChildren().find(n => n.getName() === 'LOGOS');
// LUDOX: girado 180° (galones hacia abajo)
LOGOS.listChildren().find(n => n.getName() === 'LOGO_LUDOX').setRotation([0, 0, 1, 0]);
const face = [], faceI = [], edge = [], edgeI = [];
const W = +(process.env.W || 0.13), T = 0.11, A = +(process.env.A || 0.045);
const lobes = 3, Rc = +(process.env.RC || 0.2), Rl = +(process.env.RL || 0.29), N = 160;
for (let L = 0; L < lobes; L++) {
  const a0 = Math.PI / 2 + L * 2 * Math.PI / 3;
  const cx = Math.cos(a0) * Rc, cy = Math.sin(a0) * Rc;
  // lazo inclinado sobre su eje radial: los tres se encadenan en profundidad (cruces limpios, por delante y por detrás)
  const ax = [Math.cos(a0), Math.sin(a0), 0], tilt = +(process.env.TILT || 0.5);
  const rot = (v) => { const c = Math.cos(tilt), s = Math.sin(tilt), d = v[0]*ax[0] + v[1]*ax[1] + v[2]*ax[2];
    const cr = [ax[1]*v[2] - ax[2]*v[1], ax[2]*v[0] - ax[0]*v[2], ax[0]*v[1] - ax[1]*v[0]];
    return [v[0]*c + cr[0]*s + ax[0]*d*(1-c), v[1]*c + cr[1]*s + ax[1]*d*(1-c), v[2]*c + cr[2]*s + ax[2]*d*(1-c)]; };
  const pn = rot([0, 0, 1]);
  const P = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2;
    const rr = Rl * (1 + 0.12 * Math.cos(t - a0));
    const v = rot([Math.cos(t) * rr, Math.sin(t) * rr, 0]);
    const w = W * (0.75 + 0.45 * (0.5 + 0.5 * Math.cos(t - a0)));
    P.push([cx + v[0], cy + v[1], v[2], w]);
  }
  for (let i = 0; i < N; i++) {
    const [x, y, z, w] = P[i], q2 = P[(i + 1) % N], q0 = P[(i - 1 + N) % N];
    let t3 = [q2[0] - q0[0], q2[1] - q0[1], q2[2] - q0[2]]; const tl = Math.hypot(...t3); t3 = t3.map((v) => v / tl);
    const n = [t3[1]*pn[2] - t3[2]*pn[1], t3[2]*pn[0] - t3[0]*pn[2], t3[0]*pn[1] - t3[1]*pn[0]];
    const C = (sw, sz) => [x + n[0]*w/2*sw + pn[0]*T/2*sz, y + n[1]*w/2*sw + pn[1]*T/2*sz, z + n[2]*w/2*sw + pn[2]*T/2*sz];
    const of = C(1, 1), inf = C(-1, 1), ob = C(1, -1), ib = C(-1, -1);
    face.push(...of, ...inf, ...ob, ...ib);
    edge.push(...of, ...ob, ...inf, ...ib);
  }
  const base = (L * N) * 4;
  for (let i = 0; i < N; i++) {
    const a = base + i * 4, b = base + ((i + 1) % N) * 4;
    faceI.push(a, b, a + 1, a + 1, b, b + 1);               // cara delantera
    faceI.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);   // trasera
    edgeI.push(a, a + 1, b, b, a + 1, b + 1);               // canto exterior
    edgeI.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);   // canto interior
  }
}
const A_ = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const mk = (pos, idx) => doc.createPrimitive().setAttribute('POSITION', A_(new Float32Array(pos), 'VEC3')).setIndices(A_(new Uint32Array(idx), 'SCALAR'));
// normales: se calculan en el cliente si faltan; mejor ponerlas aproximadas
const normals = (pos, idx) => { const n = new Float32Array(pos.length); for (let i = 0; i < idx.length; i += 3) { const [a, b, c] = [idx[i], idx[i+1], idx[i+2]]; const ux = pos[b*3]-pos[a*3], uy = pos[b*3+1]-pos[a*3+1], uz = pos[b*3+2]-pos[a*3+2], vx = pos[c*3]-pos[a*3], vy = pos[c*3+1]-pos[a*3+1], vz = pos[c*3+2]-pos[a*3+2]; const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; for (const v of [a,b,c]) { n[v*3]+=nx; n[v*3+1]+=ny; n[v*3+2]+=nz; } } for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i+1], n[i+2]) || 1; n[i]/=l; n[i+1]/=l; n[i+2]/=l; } return n; };
const mFace = doc.createMaterial('LOGO_VEGA_Face').setBaseColorFactor([0.86, 0.36, 0.07, 1]).setEmissiveFactor([0.28, 0.1, 0.02]).setMetallicFactor(0.9).setRoughnessFactor(0.24).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_VEGA_Edge').setBaseColorFactor([0.04, 0.05, 0.06, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.3).setDoubleSided(true);
const pf = mk(face, faceI).setMaterial(mFace); pf.setAttribute('NORMAL', A_(normals(face, faceI), 'VEC3'));
const pe = mk(edge, edgeI).setMaterial(mEdge); pe.setAttribute('NORMAL', A_(normals(edge, edgeI), 'VEC3'));
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_VEGA'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_VEGA').setMesh(doc.createMesh('LOGO_VEGA').addPrimitive(pf).addPrimitive(pe)));
await io.write(process.env.OUT, doc);
console.log('ok');
