import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { vec3 } from 'gl-matrix';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.env.F);
const V = doc.getRoot().listScenes()[0].listChildren().find(n => n.getName() === process.env.NODE);
const hull = V.listChildren().find(c => /_hull$/.test(c.getName())); const P = [];
hull.traverse((n) => { const m = n.getMesh(); if (!m) return; const M = n.getWorldMatrix(); for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), v = [0,0,0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); P.push(vec3.transformMat4([0,0,0], v, M)); } } });
const G = new Map(); for (const p of P) { const k = Math.round(p[0] / 0.1) + ',' + Math.round(p[2] / 0.2); G.set(k, Math.max(G.get(k) ?? -9, p[1])); }
let s = '      x:' + [...Array(16).keys()].map(i => (i * 0.1).toFixed(1).padStart(5)).join('') + '\n';
for (let zi = 14; zi >= -14; zi--) { s += ('z' + (zi * 0.2).toFixed(1)).padStart(6) + ':'; for (let xi = 0; xi < 16; xi++) { const h = G.get(xi + ',' + zi); s += (h === undefined ? '   . ' : h.toFixed(2).padStart(5)); } s += '\n'; }
console.log(s);
