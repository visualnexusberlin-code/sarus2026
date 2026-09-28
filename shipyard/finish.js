// ─────────────────────────────────────────────────────────────
//  FINISH · escalón de acabado de la flota
//  · Máscaras de desgaste en blanco y negro (desconchones, arañazos, suciedad): procedurales
//    por defecto; setWear() las sustituye por texturas propias sin tocar nada más.
//  · Paneles en relieve (juntas, escotillas, remaches, rejillas) → mapa de normales.
//  · Mapa ORM (G = rugosidad, B = metal): la pintura se desconcha y deja ver el metal.
//  · Detalle fino repetible para las piezas sin librea.
//  Espacio de la librea: x = largo (0 cola → 1 morro), y = contorno (0 fondo · 0.25 costado +x · 0.5 lomo · 0.75 costado −x).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ── Ruido periódico (repetible sin costuras) ──
function periodic(size, cells, seed) {
  const r = rng(seed), g = new Float32Array(cells * cells).map(() => r());
  return (x, y) => {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const i0 = ((ix % cells) + cells) % cells, i1 = (i0 + 1) % cells, j0 = ((iy % cells) + cells) % cells, j1 = (j0 + 1) % cells;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(g[j0 * cells + i0], g[j0 * cells + i1], sx), lerp(g[j1 * cells + i0], g[j1 * cells + i1], sx), sy);
  };
}
function fbmField(size, seed, base, oct) {
  const ns = [...Array(oct)].map((_, i) => periodic(size, base << i, seed + i * 31));
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0, w = 0.5, t = 0;
    for (const n of ns) { a += n(x, y) * w; t += w; w *= 0.5; }
    out[y * size + x] = a / t;
  }
  return out;
}

// ── Máscaras de desgaste (Float32Array size×size, 0..1, blanco = desgaste) ──
const WS = 512;
export const WEAR = { size: WS, chips: null, scratches: null, grime: null, source: 'procedural' };

function proceduralWear() {
  if (WEAR.chips) return WEAR;
  // suciedad: manchas suaves
  WEAR.grime = fbmField(WS, 11, 4, 5);
  // desconchones: ruido fino recortado por una máscara amplia
  const fine = fbmField(WS, 23, 24, 3), wide = fbmField(WS, 37, 3, 3);
  WEAR.chips = new Float32Array(WS * WS);
  for (let i = 0; i < WS * WS; i++) WEAR.chips[i] = sstep(0.6, 0.72, fine[i] * 0.85 + wide[i] * 0.25);
  // arañazos: trazos finos casi longitudinales (sentido de la marcha), repetibles
  const c = document.createElement('canvas'); c.width = c.height = WS;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, WS, WS);
  const r = rng(53);
  for (let i = 0; i < 520; i++) {
    const x = r() * WS, y = r() * WS, a = (r() - 0.5) * 0.5 + (r() < 0.2 ? Math.PI / 2 : 0), len = 8 + r() * r() * 110;
    g.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`; g.lineWidth = 0.5 + r() * 1.1;
    for (const ox of [-WS, 0, WS]) for (const oy of [-WS, 0, WS]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  const d = g.getImageData(0, 0, WS, WS).data;
  WEAR.scratches = new Float32Array(WS * WS);
  for (let i = 0; i < WS * WS; i++) WEAR.scratches[i] = d[i * 4] / 255;
  return WEAR;
}

// Sustituye las máscaras por texturas propias (imágenes en blanco y negro, idealmente repetibles).
// imgs: { chips?, scratches?, grime? } → HTMLImageElement | HTMLCanvasElement | ImageBitmap
export function setWear(imgs) {
  proceduralWear();
  const c = document.createElement('canvas'); c.width = c.height = WS;
  const g = c.getContext('2d');
  for (const k of ['chips', 'scratches', 'grime']) {
    if (!imgs[k]) continue;
    g.clearRect(0, 0, WS, WS); g.drawImage(imgs[k], 0, 0, WS, WS);
    const d = g.getImageData(0, 0, WS, WS).data, out = new Float32Array(WS * WS);
    for (let i = 0; i < WS * WS; i++) out[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    WEAR[k] = out;
  }
  WEAR.source = 'custom';
}
// Desgasta un canvas de rotulación (borra según desconchones + arañazos + moteado)
export function distress(canvas, amount = 0.5, seed = 1) {
  proceduralWear();
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  const r = rng(seed);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (!d[i + 3]) continue;
    const wx = x * 1.4 + seed * 131, wy = y * 1.4 + seed * 71;
    const m = Math.max(samp(WEAR.chips, wx, wy) * 1.15, samp(WEAR.scratches, wx * 0.8, wy * 0.8) * 0.9);
    const blot = samp(WEAR.grime, wx * 0.35, wy * 0.35);
    let k = 1 - sstep(0.62 - amount * 0.4, 0.72 - amount * 0.4, m);
    k *= 1 - sstep(0.75 - amount * 0.2, 0.9 - amount * 0.15, blot) * 0.8;
    if (r() < amount * 0.06) k *= 0.2;
    d[i + 3] *= k * (0.93 - amount * 0.1);
  }
  g.putImageData(img, 0, 0);
  return canvas;
}
const samp = (arr, x, y) => arr[((Math.floor(y) % WS + WS) % WS) * WS + ((Math.floor(x) % WS + WS) % WS)];

// ── Paneles en relieve (altura en canvas: 128 = superficie) ──
function panelHeight(W, H, seed, opts = {}) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, W, H);
  const r = rng(seed);
  const both = (fn) => { fn(false); fn(true); };                    // simetría izquierda/derecha
  const U = (u, m) => (m ? 1 - u : u) * H;
  const seam = (pts, m, w = 2.2, val = 38) => { g.strokeStyle = `rgb(${val},${val},${val})`; g.lineWidth = w; g.beginPath(); pts.forEach(([v, u], i) => (i ? g.lineTo(v * W, U(u, m)) : g.moveTo(v * W, U(u, m)))); g.stroke(); };
  // juntas longitudinales con escalones
  const rows = opts.rows || [0.1, 0.19, 0.31, 0.42];
  for (const u0 of rows) both((m) => {
    const pts = []; let u = u0;
    for (let v = 0; v <= 1.001; v += 0.125) { pts.push([v, u]); if (r() < 0.3) { u = u0 + (r() - 0.5) * 0.03; pts.push([v, u]); } }
    seam(pts, m);
  });
  seam([[0, 0.5], [1, 0.5]], false, 1.6, 60);                      // espina dorsal
  // juntas transversales
  const cuts = opts.cuts || 7;
  const vs = [...Array(cuts)].map((_, i) => 0.06 + (i + 0.3 + r() * 0.4) / cuts * 0.9);
  for (const v of vs) both((m) => { const u0 = r() < 0.5 ? 0.02 : 0.1, u1 = r() < 0.6 ? 0.5 : 0.31; seam([[v, u0], [v + (r() - 0.5) * 0.01, u1]], m); });
  // escotillas con tornillería
  const hatches = opts.hatches ?? 8;
  for (let i = 0; i < hatches; i++) {
    const v = 0.08 + r() * 0.8, u = 0.14 + r() * 0.28, w = 0.03 + r() * 0.07, h = 0.03 + r() * 0.06;
    both((m) => {
      const y0 = Math.min(U(u, m), U(u + h, m));
      g.fillStyle = 'rgb(140,140,140)'; g.fillRect(v * W, y0, w * W, h * H);
      g.strokeStyle = 'rgb(45,45,45)'; g.lineWidth = 1.6; g.strokeRect(v * W, y0, w * W, h * H);
      g.fillStyle = 'rgb(200,200,200)';
      for (const [a, b] of [[0.12, 0.15], [0.88, 0.15], [0.12, 0.85], [0.88, 0.85]]) { g.beginPath(); g.arc((v + w * a) * W, y0 + h * H * b, 1.4, 0, 7); g.fill(); }
    });
  }
  // remaches a lo largo de algunas juntas
  g.fillStyle = 'rgb(190,190,190)';
  for (const u0 of rows.slice(0, 2)) both((m) => { for (let v = 0.02; v < 0.98; v += 0.012) { g.beginPath(); g.arc(v * W, U(u0 + 0.012, m), 1.1, 0, 7); g.fill(); } });
  // rejillas de ventilación
  const vents = opts.vents ?? 2;
  for (let i = 0; i < vents; i++) {
    const v = 0.1 + r() * 0.5, u = 0.34 + r() * 0.1, n = 5 + Math.floor(r() * 5);
    both((m) => { g.fillStyle = 'rgb(30,30,30)'; for (let k = 0; k < n; k++) g.fillRect((v + k * 0.009) * W, Math.min(U(u, m), U(u + 0.05, m)), 0.0045 * W, 0.05 * H); });
  }
  return g.getImageData(0, 0, W, H).data;
}

// ── Acabado de una librea: albedo con desgaste + normales + ORM ──
// canvas: la librea ya pintada. wear 0 (impecable) … 1 (muy castigada)
export function finishLivery(canvas, { wear = 0.4, seed = 1, rough = 0.34, metal = 0.32, primer = [0.34, 0.35, 0.36], relief = 1 } = {}) {
  proceduralWear();
  const W = canvas.width, H = canvas.height;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, W, H), A = img.data;
  const hgt = panelHeight(W, H, seed * 7 + 3);
  // proximidad a juntas (para concentrar el desgaste en cantos de panel)
  const seamM = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) seamM[i] = hgt[i * 4] < 80 ? 1 : 0;
  const blurred = new Float32Array(W * H);
  const R = 5;
  for (let y = 0; y < H; y++) { let acc = 0; for (let x = -R; x < W + R; x++) { if (x + R < W) acc += seamM[y * W + x + R]; if (x - R - 1 >= 0) acc -= seamM[y * W + x - R - 1]; if (x >= 0 && x < W) blurred[y * W + x] = acc; } }
  const seamNear = new Float32Array(W * H);
  for (let x = 0; x < W; x++) { let acc = 0; for (let y = -R; y < H + R; y++) { if (y + R < H) acc += blurred[(y + R) * W + x]; if (y - R - 1 >= 0) acc -= blurred[(y - R - 1) * W + x]; if (y >= 0 && y < H) seamNear[y * W + x] = Math.min(1, acc / ((2 * R + 1) * 3)); } }

  const hOut = new Float32Array(W * H);
  const orm = new Uint8ClampedArray(W * H * 4);
  const S = WS / 360;                      // escala de las máscaras: una baldosa ≈ 360 px de librea
  for (let y = 0; y < H; y++) {
    const u = y / H, side = Math.min(u, 1 - u);
    const bottom = 1 - sstep(0.07, 0.2, side);
    for (let x = 0; x < W; x++) {
      const i = y * W + x, v = x / W;
      const tail = 1 - sstep(0.0, 0.22, v), nose = sstep(0.84, 1.0, v);
      const wx = x * S + seed * 97, wy = y * S * 1.6 + seed * 61;
      const edge = clamp01(seamNear[i] * 1.6 + nose * 0.45 + bottom * 0.35 + 0.04);
      const chip = sstep(0.5, 0.62, samp(WEAR.chips, wx * 1.5, wy * 1.5) * clamp01(wear * 1.5 * edge));
      const scr = samp(WEAR.scratches, wx * 1.3, wy * 0.8) * wear * 0.6;
      const grm = samp(WEAR.grime, wx * 0.5, wy * 0.5);
      const grime = sstep(0.35, 0.8, grm) * wear * (0.25 + bottom * 0.7 + tail * 0.4);
      const streak = samp(WEAR.grime, wx * 0.12, wy * 3.0);
      const soot = tail * (0.45 + 0.55 * streak) * wear * 0.95;
      let r = A[i * 4] / 255, gg = A[i * 4 + 1] / 255, b = A[i * 4 + 2] / 255;
      // zonas de ruptura: negro / pavonado neutro → metal oscuro satinado
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const darkMetal = (mx < 0.2 && (mx - mn) < 0.05) ? sstep(0.2, 0.08, mx) : 0;
      // arañazos: la pintura clarea
      const sl = scr * 0.3;
      r = lerp(r, Math.min(1, r * 1.2 + 0.1), sl); gg = lerp(gg, Math.min(1, gg * 1.2 + 0.1), sl); b = lerp(b, Math.min(1, b * 1.2 + 0.1), sl);
      // desconchón: metal de imprimación
      r = lerp(r, primer[0], chip); gg = lerp(gg, primer[1], chip); b = lerp(b, primer[2], chip);
      // suciedad y hollín
      const dk = 1 - 0.42 * grime;
      r *= dk; gg *= dk * 0.99; b *= dk * 0.97;
      const so = Math.min(0.85, soot * 0.85);
      r = lerp(r, 0.05, so); gg = lerp(gg, 0.045, so); b = lerp(b, 0.04, so);
      A[i * 4] = r * 255; A[i * 4 + 1] = gg * 255; A[i * 4 + 2] = b * 255;
      let ro = lerp(rough, 0.4, darkMetal) + 0.28 * grime + 0.14 * scr + 0.3 * so; ro = lerp(ro, 0.42, chip);
      let me = lerp(lerp(metal, 0.78, darkMetal), 0.95, chip); me = lerp(me, 0.08, so * 0.7);
      orm[i * 4] = 255; orm[i * 4 + 1] = clamp01(ro) * 255; orm[i * 4 + 2] = clamp01(me) * 255; orm[i * 4 + 3] = 255;
      hOut[i] = (hgt[i * 4] / 255 - 0.5) * relief - chip * 0.2 - scr * 0.05;
    }
  }
  g.putImageData(img, 0, 0);
  return { normal: normalFromHeight(hOut, W, H, 3.2), orm: toCanvas(orm, W, H) };
}

function toCanvas(data, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  return c;
}
function normalFromHeight(h, W, H, k, wrap = false) {
  const out = new Uint8ClampedArray(W * H * 4);
  const at = (x, y) => {
    if (wrap) { x = (x + W) % W; y = (y + H) % H; } else { x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y)); }
    return h[y * W + x];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * W + x) * 4;
    out[i] = (-dx / l * 0.5 + 0.5) * 255; out[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return toCanvas(out, W, H);
}

// Texturas de un canvas listas para exportar (JPEG en el GLB → mucho más ligero que PNG)
export function tex(canvas, { srgb = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.flipY = false; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.userData.mimeType = 'image/jpeg';
  return t;
}

// Aplica el acabado a un material con librea (map = CanvasTexture de la librea)
export function finishMaterial(mat, opts) {
  const canvas = mat.map.image;
  const { normal, orm } = finishLivery(canvas, { rough: mat.roughness, metal: mat.metalness, ...opts });
  mat.map.needsUpdate = true;
  mat.map.userData.mimeType = 'image/jpeg';
  mat.normalMap = tex(normal); mat.normalScale.set(1, 1);
  const o = tex(orm);
  mat.roughnessMap = o; mat.metalnessMap = o;
  mat.roughness = 1; mat.metalness = 1;
  return mat;
}

// ── Detalle fino repetible (piezas sin librea): micro-rayado, manchas, alguna junta ──
let DETAIL = null;
export function detailMaps() {
  if (DETAIL) return DETAIL;
  proceduralWear();
  const N = 256;
  const h = new Float32Array(N * N), orm = new Uint8ClampedArray(N * N * 4);
  const noise = fbmField(N, 71, 8, 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const scr = WEAR.scratches[(y * 2 % WS) * WS + (x * 2 % WS)];
    const seam = (x % 128 < 2 || y % 128 < 2) ? 1 : 0;
    h[i] = noise[i] * 0.08 - scr * 0.05 - seam * 0.35;
    const ro = 0.72 + noise[i] * 0.2 + scr * 0.08;          // multiplica la rugosidad del material
    orm[i * 4] = 255; orm[i * 4 + 1] = Math.min(1, ro) * 255; orm[i * 4 + 2] = 255; orm[i * 4 + 3] = 255;
  }
  DETAIL = { normal: tex(normalFromHeight(h, N, N, 2.4, true), { repeat: 2 }), orm: tex(toCanvas(orm, N, N), { repeat: 2 }) };
  return DETAIL;
}
export function detailMaterial(mat, scale = 0.6) {
  const D = detailMaps();
  mat.normalMap = D.normal; mat.normalScale.set(scale, scale);
  mat.roughnessMap = D.orm;
  mat.roughness = Math.min(1, mat.roughness / 0.82);
  return mat;
}

// ── Piloto (a partir de los retratos PILOTOS): casco negro lacado, oídos dorados, visor con LED ámbar ──
let PILOT_MATS = null;
export function pilotMats() {
  if (PILOT_MATS) return PILOT_MATS;
  const led = document.createElement('canvas'); led.width = 256; led.height = 64;
  const g = led.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffb347'; g.font = '700 26px monospace'; g.textAlign = 'center'; g.fillText('17:03', 128, 30);
  g.fillStyle = 'rgba(255,170,70,0.7)'; for (let i = 0; i < 14; i++) g.fillRect(20 + i * 16, 44, 9, 4);
  const ledTex = new THREE.CanvasTexture(led); ledTex.colorSpace = THREE.SRGBColorSpace; ledTex.flipY = false; ledTex.userData.mimeType = 'image/png';
  PILOT_MATS = {
    helmet: new THREE.MeshPhysicalMaterial({ name: 'FLEET_Helmet', color: new THREE.Color(0.012, 0.012, 0.014), metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 }),
    visor: new THREE.MeshPhysicalMaterial({ name: 'FLEET_Visor', color: 0x050608, metalness: 0.6, roughness: 0.05, clearcoat: 1, emissive: 0xffffff, emissiveMap: ledTex, emissiveIntensity: 1.6 }),
    gold: new THREE.MeshPhysicalMaterial({ name: 'FLEET_Gold', color: new THREE.Color(0.78, 0.56, 0.24), metalness: 1, roughness: 0.28 }),
    suit: new THREE.MeshPhysicalMaterial({ name: 'FLEET_Suit', color: new THREE.Color(0.02, 0.02, 0.022), metalness: 0.3, roughness: 0.45 }),
  };
  return PILOT_MATS;
}

// Geometrías del piloto en una cabina: cabeza en (x, y, z) con radio r (morro +Z)
export function pilotParts(x, y, z, r) {
  const parts = { helmet: [], visor: [], gold: [], suit: [] };
  const head = new THREE.SphereGeometry(r, 22, 14); head.scale(0.94, 1.0, 1.1); head.translate(x, y, z - r * 0.06);
  parts.helmet.push(head);
  // visor: casquete frontal
  const vis = new THREE.SphereGeometry(r * 1.035, 20, 6, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.36, Math.PI * 0.26);
  vis.scale(0.94, 1.0, 1.1); vis.translate(x, y, z - r * 0.06);
  // UV del visor para el texto LED: proyección frontal
  { const p = vis.attributes.position, uv = vis.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / (r * 1.9) + 0.5, 1 - ((p.getY(i) - y) / (r * 0.9) + 0.55)); }
  parts.visor.push(vis);
  // "oídos" dorados y cresta
  for (const s of [1, -1]) {
    const ear = new THREE.CylinderGeometry(r * 0.34, r * 0.38, r * 0.16, 20); ear.rotateZ(Math.PI / 2); ear.translate(x + s * r * 0.93, y - r * 0.08, z - r * 0.1);
    parts.gold.push(ear);
    const ring = new THREE.TorusGeometry(r * 0.3, r * 0.05, 8, 20); ring.rotateY(Math.PI / 2); ring.translate(x + s * r * 1.02, y - r * 0.08, z - r * 0.1);
    parts.gold.push(ring);
  }
  const crest = new THREE.BoxGeometry(r * 0.16, r * 0.1, r * 1.3); crest.translate(x, y + r * 0.98, z - r * 0.2);
  parts.gold.push(crest);
  // cuello y hombros
  const neck = new THREE.CylinderGeometry(r * 0.42, r * 0.55, r * 0.7, 16); neck.translate(x, y - r * 1.1, z - r * 0.15);
  const sh = new THREE.SphereGeometry(r * 1.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); sh.scale(1.35, 0.55, 0.8); sh.translate(x, y - r * 1.45, z - r * 0.25);
  parts.suit.push(neck, sh);
  return parts;
}
