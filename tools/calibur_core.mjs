// CALIBUR (nodo LUDOX_4): núcleo estructural bajo la cubierta superior.
// La losa superior flota sobre el casco y la franja central (|x| < 0,42 m) estaba vacía desde el suelo hasta la losa:
// por los huecos entre las placas doradas se veía el fondo. Este núcleo la rellena: una columna de metal con
// cuadernas que sigue la cara inferior de la losa (medida en el propio modelo) y usa el material de metal de la nave
// (sin draw calls nuevas: la paleta del juego lo funde con el resto).
// Uso: node tools/calibur_core.mjs ships45.glb ships45.glb   (y lo mismo con ships45_lite.glb). Repetible: sustituye el núcleo anterior.
import { NodeIO, VertexLayout } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setVertexLayout(VertexLayout.SEPARATE);
const [, , src, out] = process.argv;
const doc = await io.read(src);
const NAME = 'LUDOX_4', CORE = 'LUDOX_4_core', MAT = '04 | exposed gunmetal';
const root = doc.getRoot().listScenes()[0].listChildren().find((n) => n.getName() === NAME);
for (const c of [...root.listChildren()]) if (c.getName() === CORE) { root.removeChild(c); c.getMesh()?.dispose(); c.dispose(); }
const mat = doc.getRoot().listMaterials().find((m) => m.getName() === MAT);
if (!mat) throw new Error('falta el material ' + MAT);

// vértices en espacio de la raíz
const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
const pts = [];
const walk = (n, M) => { const W = mul(M, n.getMatrix()); const mesh = n.getMesh(); if (mesh) for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'), v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push([W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]]); } } for (const c of n.listChildren()) walk(c, W); };
for (const c of root.listChildren()) walk(c, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const Z0 = -2.0, Z1 = 0.62, HALF = 0.5, BOT = 0.12, ST = 22;
// cara inferior de la losa por estación (|x| < 0,5, y > 0,88); sin dato → la vecina
const tops = [];
for (let i = 0; i <= ST; i++) {
  const z = Z0 + (Z1 - Z0) * i / ST;
  let lo = Infinity; for (const p of pts) if (Math.abs(p[2] - z) < 0.09 && Math.abs(p[0]) < HALF && p[1] > 0.88 && p[1] < 1.3) lo = Math.min(lo, p[1]);
  tops.push(lo);
}
for (let i = 0; i <= ST; i++) if (!isFinite(tops[i])) { let j = 1; while (!isFinite(tops[i - j] ?? Infinity) && !isFinite(tops[i + j] ?? Infinity) && j < ST) j++; tops[i] = Math.min(tops[i - j] ?? Infinity, tops[i + j] ?? Infinity); }
const topAt = (i) => Math.max(BOT + 0.3, (isFinite(tops[i]) ? tops[i] : 0.9) - 0.035);

const P = [], N = [], I = [];
const quad = (a, b, c, d) => {   // a b c d en sentido antihorario visto desde fuera; normal plana
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
  const k = P.length / 3; for (const q of [a, b, c, d]) { P.push(...q); N.push(...n); } I.push(k, k + 1, k + 2, k, k + 2, k + 3);
};
// sección: hexágono con chaflanes arriba (x, y) en sentido antihorario visto desde +z
const ring = (w, top, ch) => [[w, BOT], [w, top - ch], [w - ch, top], [-w + ch, top], [-w, top - ch], [-w, BOT]];
const loft = (z0, z1, sec0, sec1, caps) => {
  const n = sec0.length;
  for (let j = 0; j < n; j++) { const k = (j + 1) % n; quad([sec0[j][0], sec0[j][1], z0], [sec0[k][0], sec0[k][1], z0], [sec1[k][0], sec1[k][1], z1], [sec1[j][0], sec1[j][1], z1]); }
  if (caps) {
    const c0 = sec0.map(([x, y]) => [x, y, z0]).reverse(), c1 = sec1.map(([x, y]) => [x, y, z1]);
    for (const c of [c0, c1]) for (let j = 1; j < c.length - 1; j++) { const k = P.length / 3; const a = c[0], b = c[j], d = c[j + 1];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...nn) || 1; nn = nn.map((x) => x / l);
      for (const q of [a, b, d]) { P.push(...q); N.push(...nn); } I.push(k, k + 1, k + 2); }
  }
};
// columna central
for (let i = 0; i < ST; i++) {
  const z0 = Z0 + (Z1 - Z0) * i / ST, z1 = Z0 + (Z1 - Z0) * (i + 1) / ST;
  loft(z0, z1, ring(HALF - 0.06, topAt(i), 0.08), ring(HALF - 0.06, topAt(i + 1), 0.08), i === 0 || i === ST - 1);
}
// cuadernas: anillos algo más anchos cada ~0,24 m (dan estructura a lo que se ve entre las placas)
for (let i = 1; i < ST; i += 2) {
  const z = Z0 + (Z1 - Z0) * i / ST, t = topAt(i) + 0.012;
  loft(z - 0.03, z + 0.03, ring(HALF, t, 0.06), ring(HALF, t, 0.06), true);
}
// larguero central sobre la columna
for (let i = 0; i < ST; i++) {
  const z0 = Z0 + (Z1 - Z0) * i / ST, z1 = Z0 + (Z1 - Z0) * (i + 1) / ST;
  const s = (t) => [[0.06, t - 0.06], [0.06, t + 0.006], [-0.06, t + 0.006], [-0.06, t - 0.06]];
  loft(z0, z1, s(topAt(i)), s(topAt(i + 1)), i === 0 || i === ST - 1);
}

const buf = doc.getRoot().listBuffers()[0];
const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf);
const nor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf);
const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(I)).setBuffer(buf);
const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setIndices(idx).setMaterial(mat);
root.addChild(doc.createNode(CORE).setMesh(doc.createMesh(CORE).addPrimitive(prim)));
await io.write(out, doc);
console.log(`${CORE}: ${I.length / 3} triángulos; cara inferior de la losa ${Math.min(...tops.filter(isFinite)).toFixed(2)}–${Math.max(...tops.filter(isFinite)).toFixed(2)} m`);
