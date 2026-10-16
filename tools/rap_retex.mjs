// Borra el dorsal «38» del modelo Meshy (píxeles oscuros del rótulo dentro de los triángulos del costado)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const m = doc.getRoot().listMaterials()[0]; const tex = m.getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = p.getAttribute('POSITION').getArray(), UV = p.getAttribute('TEXCOORD_0').getArray(), I = p.getIndices().getArray();
const BOX = JSON.parse(process.env.BOX || '[-0.18,-0.03,-0.13,0.0,0.24]');   // x0,x1,y0,y1,|z|min
const mask = new Uint8Array(W * H);
let nt = 0;
for (let t = 0; t < I.length; t += 3) {
  const a = I[t], b = I[t+1], c = I[t+2];
  const cx = (P[a*3]+P[b*3]+P[c*3])/3, cy = (P[a*3+1]+P[b*3+1]+P[c*3+1])/3, cz = (P[a*3+2]+P[b*3+2]+P[c*3+2])/3;
  if (cx < BOX[0] || cx > BOX[1] || cy < BOX[2] || cy > BOX[3] || Math.abs(cz) < BOX[4]) continue;
  nt++;
  const u = [UV[a*2], UV[b*2], UV[c*2]].map(v => v * W), v = [UV[a*2+1], UV[b*2+1], UV[c*2+1]].map(v => v * H);
  const x0 = Math.floor(Math.min(...u)) - 1, x1 = Math.ceil(Math.max(...u)) + 1, y0 = Math.floor(Math.min(...v)) - 1, y1 = Math.ceil(Math.max(...v)) + 1;
  const ar = (u[1]-u[0])*(v[2]-v[0]) - (u[2]-u[0])*(v[1]-v[0]); if (Math.abs(ar) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((u[1]-px)*(v[2]-py) - (u[2]-px)*(v[1]-py)) / ar, w1 = ((u[2]-px)*(v[0]-py) - (u[0]-px)*(v[2]-py)) / ar, w2 = 1 - w0 - w1;
    if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
    if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 1;
  }
}
// color del panel: mediana de los píxeles claros de la máscara
const L = []; for (let i = 0; i < W * H; i++) if (mask[i]) { const l = data[i*3] + data[i*3+1] + data[i*3+2]; if (l > 540) L.push(i); }
const med = [0,1,2].map(k => { const v = L.map(i => data[i*3+k]).sort((a,b)=>a-b); return v[v.length >> 1] || 220; });
let np = 0; const hitM = new Uint8Array(W * H);
// píxeles de tinta (oscuros, no rojos) → panel; se dilata 2 px para borrar el antialias
const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (mask[i]) { const r = data[i*3], g = data[i*3+1], bl = data[i*3+2]; const red = r > g + 50 && r > bl + 50; if (!red && r + g + bl < +(process.env.TH || 530)) ink[i] = 1; }
for (let i = 0; i < W * H; i++) if (mask[i]) { const x = i % W, y = (i / W) | 0; let hit = 0; for (let dy = -3; dy <= 3 && !hit; dy++) for (let dx = -3; dx <= 3; dx++) { const j = (y+dy)*W + (x+dx); if (j >= 0 && j < W*H && ink[j]) { hit = 1; break; } }
  const r = data[i*3], g = data[i*3+1], bl = data[i*3+2]; const red = r > g + 50 && r > bl + 50;
  if (hit && !red) { const n = 0.94 + 0.06 * Math.random(); data[i*3] = med[0]*n; data[i*3+1] = med[1]*n; data[i*3+2] = med[2]*n; np++; hitM[i] = 1; } }
// el rótulo también va en relieve en el mapa de normales y en el de rugosidad: se alisa en los mismos píxeles
for (const t2 of [m.getNormalTexture(), m.getMetallicRoughnessTexture()]) {
  if (!t2) continue;
  const r2 = await sharp(Buffer.from(t2.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const d2 = r2.data, W2 = r2.info.width, H2 = r2.info.height;
  const at = (x, y) => hitM[Math.min(H-1, Math.floor(y * H / H2)) * W + Math.min(W-1, Math.floor(x * W / W2))];
  const vals = [[],[],[]]; for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (!at(x, y) && mask[Math.min(H-1, Math.floor(y * H / H2)) * W + Math.min(W-1, Math.floor(x * W / W2))]) { const o = (y*W2+x)*3; for (let k = 0; k < 3; k++) vals[k].push(d2[o+k]); }
  const md = vals.map(v => { v.sort((a,b)=>a-b); return v[v.length >> 1] ?? 128; });
  if (t2 === m.getNormalTexture()) { md[0] = 128; md[1] = 128; md[2] = 255; }
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (at(x, y)) { const o = (y*W2+x)*3; for (let k = 0; k < 3; k++) d2[o+k] = md[k]; }
  const isJ = /jpe?g/.test(t2.getMimeType());
  t2.setImage(await (isJ ? sharp(d2, { raw: { width: W2, height: H2, channels: 3 } }).jpeg({ quality: 92 }) : sharp(d2, { raw: { width: W2, height: H2, channels: 3 } }).png()).toBuffer());
  console.log('alisado', t2.getMimeType(), W2, md);
}
const out = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
tex.setImage(out).setMimeType('image/jpeg');
await io.write(process.argv[3], doc);
console.log('tris', nt, 'panel', med, 'pixels', np);
