// Mapa de posiciones en espacio UV: para cada texel, el punto 3D del casco (rasterizado de triángulos + dilatación de bordes).
export function uvPosMap(prim, W) {
  const P = prim.getAttribute('POSITION'), U = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices().getArray();
  const map = new Float32Array(W * W * 3), ok = new Uint8Array(W * W);
  const p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], u = [[0, 0], [0, 0], [0, 0]];
  for (let t = 0; t < I.length; t += 3) {
    for (let k = 0; k < 3; k++) { P.getElement(I[t + k], p[k]); U.getElement(I[t + k], u[k]); u[k][0] = u[k][0] * W - 0.5; u[k][1] = u[k][1] * W - 0.5; }
    const x0 = Math.max(0, Math.floor(Math.min(u[0][0], u[1][0], u[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(u[0][0], u[1][0], u[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(u[0][1], u[1][1], u[2][1]))), y1 = Math.min(W - 1, Math.ceil(Math.max(u[0][1], u[1][1], u[2][1])));
    const d = (u[1][1] - u[2][1]) * (u[0][0] - u[2][0]) + (u[2][0] - u[1][0]) * (u[0][1] - u[2][1]); if (Math.abs(d) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = ((u[1][1] - u[2][1]) * (x - u[2][0]) + (u[2][0] - u[1][0]) * (y - u[2][1])) / d, b = ((u[2][1] - u[0][1]) * (x - u[2][0]) + (u[0][0] - u[2][0]) * (y - u[2][1])) / d, c = 1 - a - b;
      if (a < -0.02 || b < -0.02 || c < -0.02) continue;
      const k = y * W + x; ok[k] = 1; for (let j = 0; j < 3; j++) map[k * 3 + j] = a * p[0][j] + b * p[1][j] + c * p[2][j];
    }
  }
  for (let it = 0; it < 6; it++) { const add = [];
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (ok[k]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue; const n = yy * W + xx; if (ok[n]) { add.push(k, n); break; } } }
    for (let i = 0; i < add.length; i += 2) { ok[add[i]] = 1; for (let j = 0; j < 3; j++) map[add[i] * 3 + j] = map[add[i + 1] * 3 + j]; } }
  return { map, ok };
}
