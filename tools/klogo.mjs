// Logo ALTAIR: estrella de cuatro puntas sobre dos alas de águila en flecha (Altair, «el águila que vuela»)
import * as THREE from '/home/claude/game/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const V = (x, y) => new THREE.Vector2(x, y);
const shapes = [];
const bez = (p0, p1, p2, n = 20) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(V(u*u*p0.x + 2*u*t*p1.x + t*t*p2.x, u*u*p0.y + 2*u*t*p1.y + t*t*p2.y)); } return o; };
// tres cabezas: tres colmillos que cuelgan de una mandíbula en arco (Kiberos, el can de tres cabezas)
for (const [cx, h, lean] of [[-0.25, 0.5, -0.08], [0, 0.7, 0], [0.25, 0.5, 0.08]]) {
  const w = cx === 0 ? 0.095 : 0.08, b = 0.24 + 0.11 * Math.sin(Math.acos(cx / 0.38)) + 0.03, tip = V(cx + lean, b - h);
  const L = bez(V(cx - w, b), V(cx - w * 0.9 + lean * 0.4, b - h * 0.5), tip), R = bez(tip, V(cx + w * 0.5 + lean * 0.4, b - h * 0.5), V(cx + w, b));
  shapes.push(new THREE.Shape([...L, ...R].reverse()));
}
{ const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI; pts.push(V(Math.cos(a) * 0.46, 0.2 + Math.sin(a) * 0.2)); } for (let i = 32; i >= 0; i--) { const a = i / 32 * Math.PI; pts.push(V(Math.cos(a) * 0.38, 0.24 + Math.sin(a) * 0.11)); } shapes.push(new THREE.Shape(pts.reverse())); }
const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
geo.translate(0, 0.02, -0.045); const g = geo.toNonIndexed(); g.computeVertexNormals();
const P = g.attributes.position.array, N = g.attributes.normal.array, F = { p: [], n: [] }, E = { p: [], n: [] };
for (let t = 0; t < P.length / 9; t++) { const nz = Math.abs(N[t * 9 + 2] + N[t * 9 + 5] + N[t * 9 + 8]) / 3; const dst = nz > 0.9 ? F : E; for (let k = 0; k < 9; k++) { dst.p.push(P[t * 9 + k]); dst.n.push(N[t * 9 + k]); } }
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (o, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(o.p), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(o.n), 'VEC3'));
const mFace = doc.createMaterial('LOGO_KIBEROS_Face').setBaseColorFactor([0.04, 0.042, 0.046, 1]).setMetallicFactor(0.9).setRoughnessFactor(0.16).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_KIBEROS_Edge').setBaseColorFactor([0.75, 0.77, 0.8, 1]).setMetallicFactor(1).setRoughnessFactor(0.2).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_KIBEROS'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_KIBEROS').setMesh(doc.createMesh('LOGO_KIBEROS').addPrimitive(mk(F, mFace)).addPrimitive(mk(E, mEdge))));
await io.write(process.env.OUT, doc); console.log('ok', F.p.length / 9, E.p.length / 9);
