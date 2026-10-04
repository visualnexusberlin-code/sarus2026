// Logo UBIK: disco con tres U concéntricas (bandas en relieve), obsidiana pulida con canto plata
import * as THREE from '/home/claude/game/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const R = 0.5, yc = -0.05, SEG = 40;
const arc = (cx, cy, r, a0, a1, n = SEG) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } return p; };
const top = (x) => Math.sqrt(R * R - x * x) * 0.985;
const shapes = [];
// disco exterior con la boca en U abierta arriba
{ const a = 0.37, aT = Math.acos(a / R), pts = [];
  pts.push(...arc(0, 0, R, Math.PI - aT, 2 * Math.PI + aT, 96));            // de arriba-izquierda, por abajo, a arriba-derecha
  pts.push(new THREE.Vector2(a, yc)); pts.push(...arc(0, yc, a, 0, -Math.PI, SEG)); pts.push(new THREE.Vector2(-a, top(a)));
  shapes.push(new THREE.Shape(pts)); }
for (const [a, t] of [[0.325, 0.066], [0.215, 0.066], [0.105, 0.066]]) {
  const b = a - t, pts = [new THREE.Vector2(-a, top(a)), new THREE.Vector2(-a, yc), ...arc(0, yc, a, Math.PI, 2 * Math.PI), new THREE.Vector2(a, top(a)), new THREE.Vector2(b, top(a)), new THREE.Vector2(b, yc), ...arc(0, yc, b, 2 * Math.PI, Math.PI), new THREE.Vector2(-b, top(a))];
  shapes.push(new THREE.Shape(pts));
}
const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 });
geo.translate(0, 0, -0.045); const g = geo.toNonIndexed(); g.computeVertexNormals();
// cara frontal/trasera (normal ±z) → material cara; resto → canto
const P = g.attributes.position.array, N = g.attributes.normal.array, F = { p: [], n: [] }, E = { p: [], n: [] };
for (let t = 0; t < P.length / 9; t++) { const nz = Math.abs(N[t * 9 + 2] + N[t * 9 + 5] + N[t * 9 + 8]) / 3; const dst = nz > 0.9 ? F : E; for (let k = 0; k < 9; k++) { dst.p.push(P[t * 9 + k]); dst.n.push(N[t * 9 + k]); } }
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (o, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(o.p), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(o.n), 'VEC3'));
const mFace = doc.createMaterial('LOGO_UBIK_Face').setBaseColorFactor([0.02, 0.022, 0.025, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.14).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_UBIK_Edge').setBaseColorFactor([0.72, 0.78, 0.8, 1]).setMetallicFactor(1).setRoughnessFactor(0.2).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_UBIK'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_UBIK').setMesh(doc.createMesh('LOGO_UBIK').addPrimitive(mk(F, mFace)).addPrimitive(mk(E, mEdge))));
await io.write(process.env.OUT, doc); console.log('ok', F.p.length / 9, E.p.length / 9);
