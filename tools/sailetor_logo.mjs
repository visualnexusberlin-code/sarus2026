// Logo SAILETOR (Plutón): anillo de órbita inclinado y, dentro, una vela-ala curva (perfil aerodinámico) que corta el anillo;
// en el centro, el corazón de hielo de Plutón como hueco.
import * as THREE from '/home/claude/sarus2026/node_modules/three/build/three.module.js';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.env.IN);
const root = doc.getRoot(), buf = root.listBuffers()[0], LOGOS = root.listScenes()[0].listChildren().find(n => n.getName() === 'LOGOS');
const V = (x, y) => new THREE.Vector2(x, y);
const ell = (rx, ry, rot, n = 64) => [...Array(n).keys()].map((k) => { const a = k / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return V(x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)); });
const face = [], edge = [];
{ const s = new THREE.Shape(ell(0.48, 0.3, 0.32)); s.holes.push(new THREE.Path(ell(0.41, 0.235, 0.32).reverse())); face.push(s); }
// vela-ala: borde de ataque curvo, baluma recta, puño de escota afilado
{ const s = new THREE.Shape(); s.moveTo(-0.08, 0.46); s.quadraticCurveTo(0.3, 0.05, 0.2, -0.42); s.lineTo(-0.3, -0.3); s.quadraticCurveTo(-0.02, -0.05, -0.08, 0.46);
  // corazón (Tombaugh) hueco
  const h = new THREE.Path(); const hx = 0.0, hy = -0.12, r = 0.07;
  h.moveTo(hx, hy - r * 1.3); h.bezierCurveTo(hx + r * 1.6, hy - r * 0.2, hx + r * 1.0, hy + r * 1.2, hx, hy + r * 0.45); h.bezierCurveTo(hx - r * 1.0, hy + r * 1.2, hx - r * 1.6, hy - r * 0.2, hx, hy - r * 1.3);
  s.holes.push(h); edge.push(s); }
const ext = (shapes, d) => { const g = new THREE.ExtrudeGeometry(shapes, { depth: d, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 }); g.translate(0, 0, -d / 2); return g.toNonIndexed(); };
const gF = ext(face, 0.08), gE = ext(edge, 0.12);
gF.computeVertexNormals(); gE.computeVertexNormals();
const A = (arr, ty) => doc.createAccessor().setArray(arr).setType(ty).setBuffer(buf);
const mk = (g, m) => doc.createPrimitive().setMaterial(m).setAttribute('POSITION', A(new Float32Array(g.attributes.position.array), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(g.attributes.normal.array), 'VEC3'));
const ION = (process.env.ION || '0.78,0.7,1.0').split(',').map(Number);
const mFace = doc.createMaterial('LOGO_SAILETOR_Face').setBaseColorFactor([0.86, 0.34, 0.16, 1]).setMetallicFactor(0.3).setRoughnessFactor(0.3).setDoubleSided(true);
const mEdge = doc.createMaterial('LOGO_SAILETOR_Edge').setBaseColorFactor([0.93, 0.93, 0.95, 1]).setEmissiveFactor(ION.map((v) => v * 0.18)).setMetallicFactor(0.2).setRoughnessFactor(0.22).setDoubleSided(true);
const old = LOGOS.listChildren().find(n => n.getName() === 'LOGO_SAILETOR'); if (old) old.dispose();
LOGOS.addChild(doc.createNode('LOGO_SAILETOR').setMesh(doc.createMesh('LOGO_SAILETOR').addPrimitive(mk(gF, mFace)).addPrimitive(mk(gE, mEdge))));
await io.write(process.env.OUT, doc); console.log('logo ok', gF.attributes.position.count / 3, gE.attributes.position.count / 3);
