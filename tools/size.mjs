// Tamaño visual de cada nave en su espacio local: siluetas (planta, popa, perfil) rasterizadas a 3 cm y volumen aproximado.
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mat4, vec3 } from 'gl-matrix';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.argv[2]);
const C = 0.03, OFF = 6, N = Math.round(2 * OFF / C);
const rows = [];
for (const ship of doc.getRoot().listScenes()[0].listChildren()) {
  const name = ship.getName(); if (/LOGOS|LODS/.test(name)) continue;
  const inv = mat4.invert(mat4.create(), ship.getWorldMatrix());
  const top = new Uint8Array(N * N), rear = new Uint8Array(N * N), side = new Uint8Array(N * N);
  const ymin = new Float32Array(N * N).fill(1e9), ymax = new Float32Array(N * N).fill(-1e9);
  const raster = (grid, a, b, c, onCell) => {   // a,b,c = [u,v]
    const minU = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) + OFF) / C)), maxU = Math.min(N - 1, Math.floor((Math.max(a[0], b[0], c[0]) + OFF) / C));
    const minV = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) + OFF) / C)), maxV = Math.min(N - 1, Math.floor((Math.max(a[1], b[1], c[1]) + OFF) / C));
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) return;
    for (let v = minV; v <= maxV; v++) for (let u = minU; u <= maxU; u++) {
      const x = (u + 0.5) * C - OFF, y = (v + 0.5) * C - OFF;
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
      if (l1 >= -1e-4 && l2 >= -1e-4 && l3 >= -1e-4) { grid[v * N + u] = 1; onCell?.(v * N + u, l1, l2, l3); }
    }
  };
  ship.traverse((n) => {
    const m = n.getMesh(); if (!m) return;
    const M = mat4.multiply(mat4.create(), inv, n.getWorldMatrix());
    for (const p of m.listPrimitives()) {
      const mn = p.getMaterial()?.getName() || ''; if (/Name|LOGO|_Ion|_Hover/.test(mn)) continue;
      const pos = p.getAttribute('POSITION'), idx = p.getIndices(); const cnt = idx ? idx.getCount() : pos.getCount();
      const P = []; const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); P.push(vec3.transformMat4([0, 0, 0], v, M)); }
      for (let t = 0; t < cnt; t += 3) {
        const A = P[idx ? idx.getScalar(t) : t], B = P[idx ? idx.getScalar(t + 1) : t + 1], Cc = P[idx ? idx.getScalar(t + 2) : t + 2];
        raster(top, [A[0], A[2]], [B[0], B[2]], [Cc[0], Cc[2]], (k, l1, l2, l3) => { const y = A[1] * l1 + B[1] * l2 + Cc[1] * l3; if (y < ymin[k]) ymin[k] = y; if (y > ymax[k]) ymax[k] = y; });
        raster(rear, [A[0], A[1]], [B[0], B[1]], [Cc[0], Cc[1]]);
        raster(side, [A[2], A[1]], [B[2], B[1]], [Cc[2], Cc[1]]);
      }
    }
  });
  const cnt = (g) => g.reduce((s, v) => s + v, 0) * C * C;
  let vol = 0; for (let k = 0; k < N * N; k++) if (top[k]) vol += Math.max(0.05, ymax[k] - ymin[k]) * C * C;
  rows.push({ name, top: cnt(top), rear: cnt(rear), side: cnt(side), vol });
}
const med = (k) => { const s = rows.map((r) => r[k]).sort((a, b) => a - b); return s[s.length >> 1]; };
const M = { top: med('top'), rear: med('rear'), side: med('side'), vol: med('vol') };
console.log('nave'.padEnd(12), 'planta m²', 'popa m²', 'perfil m²', 'volumen m³', ' índice (1 = mediana)');
for (const r of rows.sort((a, b) => b.vol - a.vol)) {
  const idx = Math.cbrt(r.vol / M.vol) * 0.5 + Math.sqrt(r.top / M.top) * 0.25 + Math.sqrt(r.rear / M.rear) * 0.25;
  console.log(r.name.padEnd(12), r.top.toFixed(1).padStart(8), r.rear.toFixed(2).padStart(8), r.side.toFixed(2).padStart(8), r.vol.toFixed(2).padStart(9), '   ', idx.toFixed(2));
}
console.log('medianas', Object.fromEntries(Object.entries(M).map(([k, v]) => [k, +v.toFixed(2)])));
