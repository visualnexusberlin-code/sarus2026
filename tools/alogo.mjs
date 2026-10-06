// Logo ALTAIR: estrella de cuatro puntas sobre dos alas de águila en flecha (Altair, «el águila que vuela»)
import * as THREE from '/home/claude/game/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const V = (x, y) => new THREE.Vector2(x, y);
const shapes = [];
// estrella: cuatro puntas, la vertical más larga
{ const c = V(0, 0.27), pts = []; const R = [0.25, 0.12, 0.2, 0.12], r = 0.035;
  for (let k = 0; k < 8; k++) { const a = Math.PI / 2 + k * Math.PI / 4, rr = k % 2 ? r : R[(k / 2) % 4]; pts.push(V(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr)); }
  shapes.push(new THREE.Shape(pts)); }
// alas: cuchillas curvas que bajan desde el centro hacia fuera, con el borde de ataque convexo
const bez = (p0, p1, p2, n = 24) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(V(u*u*p0.x + 2*u*t*p1.x + t*t*p2.x, u*u*p0.y + 2*u*t*p1.y + t*t*p2.y)); } return o; };
for (const s of [-1, 1]) {
  const up = bez(V(s * 0.04, 0.02), V(s * 0.3, 0.02), V(s * 0.52, -0.36));
  const lo = bez(V(s * 0.44, -0.4), V(s * 0.26, -0.13), V(s * 0.05, -0.12));
  let pts = [...up, ...lo]; if (s < 0) pts = pts.reverse();
  shapes.push(new THREE.Shape(pts));
}
const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
geo.translate(0, 0.02, -0.045); const g = geo.toNonIndexed(); g.computeVertexNormals();
const P = g.attributes.position.array, N = g.attributes.normal.array, F = { p: [], n: [] }, E = { p: [], n: [] };
for (let t = 0; t < P.length / 9; t++) { const nz = Math.abs(N[t * 9 + 2] + N[t * 9 + 5] + N[t * 9 + 8]) / 3; const dst = nz > 0.9 ? F : E; for (let k = 0; k < 9; k++) { dst.p.push(P[t * 9 + k]); dst.n.push(N[t * 9 + k]); } }
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (o, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(o.p), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(o.n), 'VEC3'));
const mFace = doc.createMaterial('LOGO_ALTAIR_Face').setBaseColorFactor([0.05, 0.065, 0.075, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.18).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_ALTAIR_Edge').setBaseColorFactor([0.62, 0.03, 0.01, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.25).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_ALTAIR'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_ALTAIR').setMesh(doc.createMesh('LOGO_ALTAIR').addPrimitive(mk(F, mFace)).addPrimitive(mk(E, mEdge))));
await io.write(process.env.OUT, doc); console.log('ok', F.p.length / 9, E.p.length / 9);
