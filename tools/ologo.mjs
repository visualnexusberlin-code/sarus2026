// Logo ALTAIR: estrella de cuatro puntas sobre dos alas de águila en flecha (Altair, «el águila que vuela»)
import * as THREE from '/home/claude/game/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const V = (x, y) => new THREE.Vector2(x, y);
const shapes = [];
// Orión: las tres estrellas del cinturón en diagonal dentro del arco del cazador (dos medias lunas abiertas)
const star = (cx, cy, R, r) => { const p = []; for (let k = 0; k < 8; k++) { const a = Math.PI / 2 + k * Math.PI / 4, rr = k % 2 ? r : (k % 4 === 0 ? R : R * 0.62); p.push(V(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); } return new THREE.Shape(p); };
for (const k of [-1, 0, 1]) shapes.push(star(k * 0.17, -k * 0.06, k === 0 ? 0.13 : 0.1, 0.028));
const arc = (a0, a1, R0, R1) => { const p = []; for (let i = 0; i <= 28; i++) { const a = a0 + (a1 - a0) * i / 28; p.push(V(Math.cos(a) * R1, Math.sin(a) * R1 * 0.82)); } for (let i = 28; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 28; p.push(V(Math.cos(a) * R0, Math.sin(a) * R0 * 0.82)); } return new THREE.Shape(p); };
shapes.push(arc(0.5, Math.PI - 0.5, 0.4, 0.47), arc(Math.PI + 0.5, 2 * Math.PI - 0.5, 0.4, 0.47));
const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
geo.translate(0, 0.02, -0.045); const g = geo.toNonIndexed(); g.computeVertexNormals();
const P = g.attributes.position.array, N = g.attributes.normal.array, F = { p: [], n: [] }, E = { p: [], n: [] };
for (let t = 0; t < P.length / 9; t++) { const nz = Math.abs(N[t * 9 + 2] + N[t * 9 + 5] + N[t * 9 + 8]) / 3; const dst = nz > 0.9 ? F : E; for (let k = 0; k < 9; k++) { dst.p.push(P[t * 9 + k]); dst.n.push(N[t * 9 + k]); } }
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (o, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(o.p), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(o.n), 'VEC3'));
const mFace = doc.createMaterial('LOGO_ORION_Face').setBaseColorFactor([0.8, 0.82, 0.85, 1]).setMetallicFactor(1).setRoughnessFactor(0.15).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_ORION_Edge').setBaseColorFactor([0.72, 0.42, 0.18, 1]).setMetallicFactor(1).setRoughnessFactor(0.25).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_ORION'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_ORION').setMesh(doc.createMesh('LOGO_ORION').addPrimitive(mk(F, mFace)).addPrimitive(mk(E, mEdge))));
await io.write(process.env.OUT, doc); console.log('ok', F.p.length / 9, E.p.length / 9);
