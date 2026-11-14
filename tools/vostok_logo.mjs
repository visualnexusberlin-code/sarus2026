// Logo VOSTOK PATROLS: hexágono de bastión (tuerca: lo que no se abre) con un ojo de vigilancia y su pupila en rombo;
// una punta de flecha al este (vostok = este) sale del ojo y atraviesa el bastión.
import * as THREE from '/home/claude/sarus2026/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const V = (x, y) => new THREE.Vector2(x, y);
const poly = (pts) => new THREE.Shape(pts.map(([x, y]) => V(x, y)));
const hole = (pts) => new THREE.Path(pts.map(([x, y]) => V(x, y)));
const hex = (R) => [...Array(6).keys()].map((k) => { const a = k * Math.PI / 3; return [Math.cos(a) * R, Math.sin(a) * R]; });
const face = [], edge = [];
// bastión: anillo hexagonal (vértices a izquierda y derecha), con un corte al este por donde sale la flecha
{ const s = poly(hex(0.47)); s.holes.push(hole(hex(0.38).reverse())); face.push(s); }
// ojo: lente de dos arcos, hueca
const lens = (w, h, n = 24) => { const p = []; for (let i = 0; i <= n; i++) { const t = -1 + 2 * i / n; p.push([t * w, h * (1 - t * t)]); } for (let i = n - 1; i > 0; i--) { const t = -1 + 2 * i / n; p.push([t * w, -h * (1 - t * t)]); } return p; };
{ const s = poly(lens(0.27, 0.15)); s.holes.push(hole(lens(0.2, 0.095).reverse())); edge.push(s); }
// pupila en rombo y flecha al este
edge.push(poly([[0, 0.065], [0.05, 0], [0, -0.065], [-0.05, 0]]));
edge.push(poly([[0.3, 0.022], [0.4, 0.022], [0.4, 0.06], [0.5, 0], [0.4, -0.06], [0.4, -0.022], [0.3, -0.022]]));
const ext = (shapes, d) => { const g = new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 12 }); g.translate(0, 0, -d / 2); return g.toNonIndexed(); };
const gF = ext(face, 0.09), gE = ext(edge, 0.12);
gF.computeVertexNormals(); gE.computeVertexNormals();
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (g, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(g.attributes.position.array), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(g.attributes.normal.array), 'VEC3'));
const mFace = doc.createMaterial('LOGO_VOSTOK_Face').setBaseColorFactor([0.3, 0.31, 0.33, 1]).setMetallicFactor(1).setRoughnessFactor(0.32).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_VOSTOK_Edge').setBaseColorFactor([0.22, 0.42, 1.0, 1]).setEmissiveFactor([0.06, 0.12, 0.3]).setMetallicFactor(0.6).setRoughnessFactor(0.25).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_VOSTOK'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_VOSTOK').setMesh(doc.createMesh('LOGO_VOSTOK').addPrimitive(mk(gF, mFace)).addPrimitive(mk(gE, mEdge))));
await io.write(process.env.OUT, doc); console.log('logo ok', gF.attributes.position.count / 3, gE.attributes.position.count / 3);
