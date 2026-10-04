// Logo RAMA: anillos concéntricos que se retuercen hacia dentro en tres lenguas (op-art), cinta nacarada en relieve
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS, KHRMaterialsIridescence, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], sc = root.listScenes()[0];
const LOGOS = sc.listChildren().find(n => n.getName() === 'LOGOS');
const face = [], faceI = [], edge = [], edgeI = [];
const RINGS = 7, R0 = 0.12, R1 = 0.52, sp = (R1 - R0) / (RINGS - 1), W = sp * 0.52, T = 0.05, N = 540;
const D = +(process.env.D || 1.6) * sp, Z = +(process.env.Z || 0.06);
// pulso por sector: subida brusca, retorno suave (la "lengua" del remolino)
const pulse = (th) => { let u = ((th / (2 * Math.PI / 3)) % 1 + 1) % 1; const a = 0.08, b = 0.62; if (u < a) return 0; if (u < a + 0.17) { const t = (u - a) / 0.17; return t * t * (3 - 2 * t); } if (u < b) { const t = (u - a - 0.17) / (b - a - 0.17); return 1 - t * t * (3 - 2 * t); } return 0; };
let base = 0;
for (let k = 0; k < RINGS; k++) {
  const ri = R0 + k * sp, P = [];
  for (let i = 0; i < N; i++) {
    const th = i / N * Math.PI * 2, p = pulse(th + k * 0.06);
    const r = Math.max(0.04, ri - D * p * (0.35 + 0.65 * k / (RINGS - 1)));
    P.push([Math.cos(th) * r, Math.sin(th) * r, 0.16 * p * (k + 1) / RINGS]);
  }
  for (let i = 0; i < N; i++) {
    const [x, y, z] = P[i], q2 = P[(i + 1) % N], q0 = P[(i - 1 + N) % N];
    let tx = q2[0] - q0[0], ty = q2[1] - q0[1]; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    const nx = ty, ny = -tx;
    const C = (sw, sz) => [x + nx * W / 2 * sw, y + ny * W / 2 * sw, z + T / 2 * sz];
    face.push(...C(1, 1), ...C(-1, 1), ...C(1, -1), ...C(-1, -1));
    edge.push(...C(1, 1), ...C(1, -1), ...C(-1, 1), ...C(-1, -1));
  }
  for (let i = 0; i < N; i++) {
    const a = base + i * 4, b = base + ((i + 1) % N) * 4;
    faceI.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
    edgeI.push(a, a + 1, b, b, a + 1, b + 1, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
  }
  base += N * 4;
}
// disco de fondo oscuro (como el negro del original) detrás de las cintas
const disc = [], discI = []; const DN = 96;
disc.push(0, 0, -0.035); for (let i = 0; i <= DN; i++) { const a = i / DN * Math.PI * 2; disc.push(Math.cos(a) * (R1 + W), Math.sin(a) * (R1 + W), -0.035); }
for (let i = 1; i <= DN; i++) discI.push(0, i, i + 1);
const A_ = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
const normals = (pos, idx) => { const n = new Float32Array(pos.length); for (let i = 0; i < idx.length; i += 3) { const [a, b, c] = [idx[i], idx[i+1], idx[i+2]]; const ux = pos[b*3]-pos[a*3], uy = pos[b*3+1]-pos[a*3+1], uz = pos[b*3+2]-pos[a*3+2], vx = pos[c*3]-pos[a*3], vy = pos[c*3+1]-pos[a*3+1], vz = pos[c*3+2]-pos[a*3+2]; const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; for (const v of [a,b,c]) { n[v*3]+=nx; n[v*3+1]+=ny; n[v*3+2]+=nz; } } for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i+1], n[i+2]) || 1; n[i]/=l; n[i+1]/=l; n[i+2]/=l; } return n; };
const prim = (pos, idx, mat) => doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A_(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A_(normals(pos, idx), 'VEC3')).setIndices(A_(new Uint32Array(idx), 'SCALAR'));
const irid = doc.createExtension(KHRMaterialsIridescence).createIridescence().setIridescenceFactor(1.0).setIridescenceIOR(1.4).setIridescenceThicknessMinimum(250).setIridescenceThicknessMaximum(520);
const cc = doc.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(1.0).setClearcoatRoughnessFactor(0.08);
const mFace = doc.createMaterial('LOGO_RAMA_Face').setBaseColorFactor([0.93, 0.92, 0.9, 1]).setMetallicFactor(0.35).setRoughnessFactor(0.2).setDoubleSided(true).setExtension('KHR_materials_iridescence', irid).setExtension('KHR_materials_clearcoat', cc);
const mEdge = doc.createMaterial('LOGO_RAMA_Edge').setBaseColorFactor([0.62, 0.7, 0.74, 1]).setMetallicFactor(0.9).setRoughnessFactor(0.25).setDoubleSided(true);
const mDisc = doc.createMaterial('LOGO_RAMA_Edge').setBaseColorFactor([0.02, 0.04, 0.05, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.3).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_RAMA'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_RAMA').setMesh(doc.createMesh('LOGO_RAMA').addPrimitive(prim(face, faceI, mFace)).addPrimitive(prim(edge, edgeI, mEdge)).addPrimitive(prim(disc, discI, mDisc))));
await io.write(process.env.OUT, doc); console.log('ok');
