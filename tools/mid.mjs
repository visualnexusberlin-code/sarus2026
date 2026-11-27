// Nivel intermedio de las naves (entre el modelo completo y la malla ligera de LODS).
// Solo se guardan ÍNDICES: cada pieza grande de una nave recibe una primitiva gemela que comparte sus mismos accesores de
// vértices (posición, normal, UV) y su mismo material, con un índice simplificado (meshopt, respeta las costuras de UV).
// Así el archivo crece solo lo que ocupan los índices y en la GPU no se duplica ningún vértice ni ninguna textura.
// Las piezas pequeñas (< SMALL triángulos, 300 por defecto) no llevan gemela: en el nivel intermedio se dibujan tal cual.
// Se guarda bajo la raíz «MIDS» como «<NODO>_mid»; ship.js empareja cada gemela con su pieza por el accesor de posición.
// Uso: TARGET=9000 node tools/mid.mjs in.glb out.glb   (flota ligera: TARGET=5000 LAYOUT=separate; ERR = error máximo, 0,03)
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';

const LAYOUT = process.env.LAYOUT === 'separate' ? VertexLayout.SEPARATE : VertexLayout.INTERLEAVED;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(LAYOUT);
const doc = await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
const TARGET = +(process.env.TARGET || 9000), SMALL = +(process.env.SMALL || 300), ERR = +(process.env.ERR || 0.03);
const root = doc.getRoot(), scene = root.listScenes()[0], buf = root.listBuffers()[0];
const tri = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;

let mids = scene.listChildren().find((n) => n.getName() === 'MIDS');
if (mids) { for (const c of mids.listChildren()) { c.traverse((n) => { for (const p of n.getMesh()?.listPrimitives() || []) p.getIndices()?.dispose(); n.getMesh()?.dispose(); }); c.dispose(); } mids.dispose(); }
mids = doc.createNode('MIDS'); scene.addChild(mids);

let bytes = 0;
for (const ship of scene.listChildren()) {
  const name = ship.getName();
  if (['LOGOS', 'LODS', 'MIDS'].includes(name)) continue;
  const parts = [];
  ship.traverse((n) => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) parts.push(p); });
  if (!parts.length) continue;
  const total = parts.reduce((a, p) => a + tri(p), 0);
  const big = parts.filter((p) => p.getIndices() && tri(p) >= SMALL);
  const small = total - big.reduce((a, p) => a + tri(p), 0);
  const ratio = Math.min(1, Math.max(0.06, (TARGET - small) / Math.max(1, total - small)));   // la misma proporción para todas las piezas grandes
  const group = doc.createNode(name + '_mid'); mids.addChild(group);
  let out = small;
  for (const p of big) {
    const I = new Uint32Array(p.getIndices().getArray());
    const pos = p.getAttribute('POSITION'), n = pos.getCount();
    const P = new Float32Array(n * 3), e = [0, 0, 0];
    for (let i = 0; i < n; i++) { pos.getElement(i, e); P[i * 3] = e[0]; P[i * 3 + 1] = e[1]; P[i * 3 + 2] = e[2]; }
    const target = Math.max(3, Math.floor(I.length * ratio / 3) * 3);
    const [r] = MeshoptSimplifier.simplify(I, P, 3, target, ERR, []);
    if (process.env.DBG && process.env.DBG === name) console.log('  pieza', tri(p), '→', r.length / 3, 'objetivo', target / 3, 'err', MeshoptSimplifier.getScale ? '' : '');
    if (r.length >= I.length * 0.9) { out += tri(p); continue; }   // no compensa: el nivel intermedio usa la pieza completa
    const arr = n < 65536 ? Uint16Array.from(r) : Uint32Array.from(r);
    const q = p.clone().setIndices(doc.createAccessor().setArray(arr).setType('SCALAR').setBuffer(buf));
    group.addChild(doc.createNode('m').setMesh(doc.createMesh('m').addPrimitive(q)));
    out += r.length / 3; bytes += arr.byteLength;
  }
  if (process.env.DBG === name) console.log('  pequeñas', small, 'piezas', parts.length, 'grandes', big.length);
  console.log(name.padEnd(14), String(total).padStart(7), '→', String(Math.round(out)).padStart(6), 'tris');
}
await io.write(process.argv[3], doc);
console.log('índices', (bytes / 1e6).toFixed(2), 'MB');
