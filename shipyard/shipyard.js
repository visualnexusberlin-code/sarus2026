// ─────────────────────────────────────────────────────────────
//  SHIPYARD · flota SATURN-6 refinada a partir de los bocetos
//  Modelado procedural: cascos por secciones (loft), placas biseladas,
//  góndolas por torno, librea pintada en textura (u = contorno, v = longitud).
//  Convenciones del juego: morro +Z, nodo raíz "<NOMBRE>_<n>", materiales *_Ion = toberas.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishMaterial, detailMaterial, pilotMats, pilotParts, distress } from './finish.js';
import { drawLogo } from './logos.js';
export { setWear, WEAR } from './finish.js';
const hash = (str) => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 100000; return h; };

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const spow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

// ── Interpolación Catmull-Rom de parámetros de estación ──
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
const KEYS = ['z', 'w', 'hT', 'hB', 'y', 'nT', 'nB', 'x', 'tuck'];

function sampleStations(st, sub) {
  const out = [];
  const g = (i) => st[Math.max(0, Math.min(st.length - 1, i))];
  for (let i = 0; i < st.length - 1; i++) {
    for (let k = 0; k < sub; k++) {
      const t = k / sub, o = {};
      for (const key of KEYS) {
        const lin = key === 'nT' || key === 'nB';
        o[key] = lin ? lerp(g(i)[key], g(i + 1)[key], t) : cr(g(i - 1)[key], g(i)[key], g(i + 1)[key], g(i + 2)[key], t);
      }
      out.push(o);
    }
  }
  out.push({ ...st[st.length - 1] });
  return out;
}

// Casco por secciones superelípticas. stations: [{z,w,hT,hB,y,nT,nB,x,tuck}], z ascendente (cola → morro)
// tuck: estrechamiento del fondo (0 = simétrico, >0 = quilla más estrecha que la cubierta)
export function loft(stations, { N = 48, sub = 6, capTail = true, capNose = true, facet = false, zRange = null, arcUV = true, flatU = null } = {}) {
  const st = stations.map((s) => ({ nT: 2.5, nB: 2.5, x: 0, y: 0, tuck: 0, hB: s.hT, ...s }));
  const rings = sampleStations(st, sub);
  const zMin = zRange ? zRange[0] : rings[0].z, zMax = zRange ? zRange[1] : rings[rings.length - 1].z;
  const pos = [], uv = [], idx = [];
  const M = N + 1;
  rings.forEach((r) => {
    const ringStart = pos.length / 3;
    for (let k = 0; k <= N; k++) {
      const u = k / N, th = -Math.PI / 2 + TAU * u;
      const c = Math.cos(th), s = Math.sin(th);
      const top = s >= 0;
      const n = top ? r.nT : r.nB;
      let w = r.w * (top ? 1 : 1 - r.tuck * Math.pow(Math.abs(s), 0.8));
      const x = r.x + w * spow(c, 2 / n);
      const y = r.y + (top ? r.hT : r.hB) * spow(s, 2 / n);
      pos.push(x, y, r.z);
      uv.push((r.z - zMin) / (zMax - zMin), u);
    }
    // contorno por longitud de arco: una letra mide lo mismo en cualquier punto del casco
    if (arcUV) {
      const L = [0];
      for (let k = 1; k <= N; k++) { const a = (ringStart + k - 1) * 3, b = (ringStart + k) * 3; L.push(L[k - 1] + Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1])); }
      const tot = L[N] || 1;
      for (let k = 0; k <= N; k++) uv[(ringStart + k) * 2 + 1] = L[k] / tot;
    }
    if (flatU !== null) for (let k = 0; k <= N; k++) uv[(ringStart + k) * 2 + 1] = flatU;
  });
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < N; k++) {
    const a = i * M + k, b = a + 1, c = a + M, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const addCap = (ri, dir) => {
    const r = rings[ri];
    const ci = pos.length / 3;
    pos.push(r.x, r.y, r.z + dir * 0.0005); uv.push((r.z - zMin) / (zMax - zMin), 0.5);
    for (let k = 0; k < N; k++) {
      const a = ri * M + k, b = a + 1;
      if (dir > 0) idx.push(a, ci, b); else idx.push(a, b, ci);
    }
  };
  if (capTail) addCap(0, -1);
  if (capNose) addCap(rings.length - 1, 1);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  fixWinding(g);
  if (facet) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  else { g.computeVertexNormals(); weldSeamNormals(g, rings.length, M); }
  g.userData.rings = rings;
  return g;
}

// Asegura normales hacia fuera (comprueba el primer anillo contra el eje)
function fixWinding(g) {
  const p = g.attributes.position, ix = g.index.array;
  let dot = 0;
  for (let t = 0; t < Math.min(ix.length, 600); t += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, ix[t]), b = new THREE.Vector3().fromBufferAttribute(p, ix[t + 1]), c = new THREE.Vector3().fromBufferAttribute(p, ix[t + 2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const ctr = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    dot += n.x * ctr.x + n.y * (ctr.y - 0.2);
  }
  if (dot < 0) { for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; } }
}

function weldSeamNormals(g, nRings, M) {
  const nr = g.attributes.normal;
  for (let i = 0; i < nRings; i++) {
    const a = i * M, b = i * M + M - 1;
    const x = (nr.getX(a) + nr.getX(b)) / 2, y = (nr.getY(a) + nr.getY(b)) / 2, z = (nr.getZ(a) + nr.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
  }
}

// Placa biselada a partir de un contorno 2D.
// plane: 'xz' (horizontal, grosor en y), 'zy' (vertical longitudinal, grosor en x), 'xy' (frontal, grosor en z)
export function plate(pts, thick, { plane = 'xz', bevel = 0.02, at = [0, 0, 0], rot = [0, 0, 0], seg = 2 } = {}) {
  const sh = new THREE.Shape();
  pts.forEach(([a, b], i) => {
    const X = plane === 'zy' ? -a : a;
    const Y = plane === 'xz' ? -b : b;
    i ? sh.lineTo(X, Y) : sh.moveTo(X, Y);
  });
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, thick - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 6 });
  g.translate(0, 0, -(thick - bevel * 2) / 2);
  if (plane === 'xz') g.rotateX(-Math.PI / 2);          // forma (x, -z) → (x, z); grosor → y
  else if (plane === 'zy') g.rotateY(Math.PI / 2);      // forma (-z, y) → (z, y); grosor → x
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(...at);
  planarUV(g);
  return g;
}

// Torno a lo largo de Z: perfil [[r, z], …]
export function lathe(profile, { seg = 24, at = [0, 0, 0], phi = 0, arc = TAU } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.0001), z)), seg, phi, arc);
  g.rotateX(Math.PI / 2);
  g.translate(...at);
  return g;
}

export function box(w, h, d, { at = [0, 0, 0], rot = [0, 0, 0], bevel = 0 } = {}) {
  let g;
  if (bevel > 0) {
    const s = new THREE.Shape();
    const x = w / 2 - bevel, y = h / 2 - bevel;
    s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y);
    g = new THREE.ExtrudeGeometry(s, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
    g.translate(0, 0, -(d - bevel * 2) / 2);
    planarUV(g);
  } else g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(...at);
  return g;
}

function planarUV(g) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.5 + 0.5; uv[i * 2 + 1] = p.getY(i) * 0.5 + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function mirrorX(g) {
  const m = g.clone(); m.scale(-1, 1, 1);
  // invertir orden de triángulos tras el espejo
  if (m.index) { const ix = m.index.array; for (let t = 0; t < ix.length; t += 3) { const a = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = a; } }
  else { const p = m.attributes.position; for (const name of Object.keys(m.attributes)) { const at = m.attributes[name], s = at.itemSize; for (let t = 0; t < at.count; t += 3) for (let c = 0; c < s; c++) { const a = at.array[(t + 1) * s + c]; at.array[(t + 1) * s + c] = at.array[(t + 2) * s + c]; at.array[(t + 2) * s + c] = a; } } }
  m.computeVertexNormals();
  return m;
}
const both = (g) => [g, mirrorX(g)];
const srgb = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
// Tubo por puntos (cables, filetes luminosos)
export function tube(pts, r, { seg = 32, radial = 6 } = {}) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), seg, r, radial, false);
}
// Filete luminoso con el color de la escudería (material _Hover), espejado
function glow(p, pts, r = 0.014) { const g = tube(pts, r); p.hover = p.hover || []; p.hover.push(g, mirrorX(g)); }
// Material extra con librea propia y acabado
function extraLivery(name, W, H, painter, wear, seed, opts = {}) {
  const t = livery(W, H, painter);
  return finishMaterial(new THREE.MeshPhysicalMaterial({ name, color: 0xffffff, map: t, metalness: 0.32, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.18, ...opts }), { wear, seed });
}
function solid(name, color, o = {}) { return detailMaterial(new THREE.MeshPhysicalMaterial({ name, color, metalness: 0.35, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.2, ...o }), 0.5); }

// ── Librea: textura pintada en el espacio (v = largo, u = contorno) ──
// u: 0 fondo · 0.25 costado izquierdo (+x) · 0.5 lomo · 0.75 costado derecho (−x)
export function livery(W, H, painter) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const P = {
    g, W, H,
    rect(v0, v1, u0, u1, col) { g.fillStyle = col; g.fillRect(v0 * W, u0 * H, (v1 - v0) * W, (u1 - u0) * H); },
    poly(pts, col) { g.fillStyle = col; g.beginPath(); pts.forEach(([v, u], i) => (i ? g.lineTo(v * W, u * H) : g.moveTo(v * W, u * H))); g.closePath(); g.fill(); },
    // banda simétrica en ambos costados: función u(v) para el lado izquierdo, espejada para el derecho
    sideBand(vs, uTop, uBot, col) {
      for (const mirror of [false, true]) {
        const f = (u) => (mirror ? 1 - u : u);
        const pts = [...vs.map((v, i) => [v, f(uTop[i])]), ...vs.map((v, i) => [v, f(uBot[i])]).reverse()];
        this.poly(pts, col);
      }
    },
    lines(seed, col, count, vMin = 0, vMax = 1) {
      let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      g.strokeStyle = col; g.lineWidth = 1.4;
      for (let i = 0; i < count; i++) {
        const v = lerp(vMin, vMax, rnd()); const u0 = rnd(), len = 0.04 + rnd() * 0.12;
        g.beginPath(); g.moveTo(v * W, u0 * H); g.lineTo(v * W, (u0 + len) * H); g.stroke();
        if (rnd() < 0.5) { const v2 = v + (rnd() - 0.5) * 0.12; g.beginPath(); g.moveTo(v * W, (u0 + len) * H); g.lineTo(v2 * W, (u0 + len) * H); g.stroke(); }
      }
    },
    // texto o emblema en un costado. side: 'L' (+x, u≈0.25) o 'R' (−x, u≈0.75); legible desde fuera, morro a la derecha/izquierda según el lado
    text(str, v, u, size, col, side = 'R', font = '700 %px "Arial Black", Arial, sans-serif') {
      g.save(); g.translate(v * W, u * H);
      if (side === 'L') g.rotate(Math.PI);
      g.fillStyle = col; g.font = font.replace('%', Math.round(size * H)); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(str, 0, 0); g.restore();
    },
    ring(v, u, r, col, lw = 0.012) { g.strokeStyle = col; g.lineWidth = lw * H; g.beginPath(); g.ellipse(v * W, u * H, r * H * (H / W) * 2, r * H, 0, 0, TAU); g.stroke(); },
    disc(v, u, r, col) { g.fillStyle = col; g.beginPath(); g.ellipse(v * W, u * H, r * H * (H / W) * 2, r * H, 0, 0, TAU); g.fill(); },
    // Rotulación de identidad: nombre enorme a lo largo del costado (envuelve el casco y se corta en los cantos).
    // ar = (m por px en contorno)/(m por px en largo) → letra con su proporción real.
    // Tratamientos: skew (cursiva), shadow {dx,dy,color,depth} (relieve), outline {w,color,only},
    // plate {color,pad,slant,knockout} (placa / letra calada), fade [a,b] (desvanecido de velocidad), lines (estela).
    brand(name, o) {
      const { font, v0 = 0.2, v1 = 0.75, u = 0.25, h = 0.1, color = '#111', ar = 1.5, wear = 0.5, seed = 5, sides = 'LR', tracking = 0,
        skew = 0, shadow = null, outline = null, plate = null, fade = null, lines = null, stroke = null, stretch = 1 } = o;
      const fam = `"SRS ${font}", "Arial Black", sans-serif`;
      for (const side of sides) {
        const t = document.createElement('canvas'); t.width = W; t.height = Math.ceil(h * H * 3);
        const c = t.getContext('2d', { willReadFrequently: true });
        const size = 200;
        c.font = `${size}px ${fam}`;
        if (tracking) c.letterSpacing = `${tracking * size}px`;
        const m = c.measureText(name);
        const capH = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || size * 0.72;
        // px por metro: a lo largo W/L, en contorno H/P → ar = (P/H)/(L/W); la horizontal lleva ar× más píxeles
        let sy = (h * H) / capH, sx = sy * ar * stretch;
        const maxW = (v1 - v0) * W;
        if (m.width * sx > maxW) { const k = maxW / (m.width * sx); sx *= k; sy *= k; }
        const cx = (side === 'L' ? 1 - (v0 + v1) / 2 : (v0 + v1) / 2) * W, cy = t.height / 2;
        const yb = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
        const inText = (ctx, fn) => { ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0, -skew, 1, 0, 0); ctx.scale(sx, sy); ctx.font = `${size}px ${fam}`; if (tracking) ctx.letterSpacing = `${tracking * size}px`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; fn(ctx); ctx.restore(); };
        // placa (con extremos en bisel) — opcionalmente con la letra calada
        if (plate) {
          const pc = document.createElement('canvas'); pc.width = t.width; pc.height = t.height;
          const g2 = pc.getContext('2d');
          const pw = m.width * sx / 2 + (plate.pad ?? 0.25) * h * H, ph = capH * sy / 2 * (1 + (plate.padY ?? 0.35)), sl = (plate.slant ?? 0.6) * ph;
          g2.fillStyle = plate.color; g2.beginPath();
          g2.moveTo(cx - pw - sl, cy + ph); g2.lineTo(cx - pw + sl, cy - ph); g2.lineTo(cx + pw + sl + (plate.tail ?? 0) * W, cy - ph); g2.lineTo(cx + pw - sl + (plate.tail ?? 0) * W, cy + ph); g2.closePath(); g2.fill();
          if (plate.knockout) { g2.globalCompositeOperation = 'destination-out'; inText(g2, (x) => { x.fillStyle = '#000'; x.fillText(name, 0, yb); }); }
          c.drawImage(pc, 0, 0);
        }
        if (lines) {                                  // estela: líneas de velocidad desde la cola del nombre
          c.fillStyle = lines.color;
          const x0 = cx - m.width * sx / 2 - 6, hh = capH * sy;
          for (let k = 0; k < lines.n; k++) { const y = cy - hh / 2 + (k + 0.5) * hh / lines.n; const len = lines.len * W * (1 - k * 0.12); c.fillRect(x0 - len, y - hh * 0.035, len, hh * 0.07); }
        }
        if (shadow) for (let d = shadow.depth || 1; d >= 1; d--) inText(c, (x) => { x.fillStyle = shadow.color; x.fillText(name, shadow.dx * d * size * 0.012, shadow.dy * d * size * 0.012 + yb); });
        if (!plate?.knockout) inText(c, (x) => {
          if (stroke) { x.strokeStyle = stroke; x.lineWidth = size * 0.06; x.lineJoin = 'round'; x.strokeText(name, 0, yb); }
          if (outline) { x.strokeStyle = outline.color; x.lineWidth = size * outline.w; x.lineJoin = 'miter'; x.strokeText(name, 0, yb); }
          if (!outline?.only) { x.fillStyle = color; x.fillText(name, 0, yb); }
        });
        if (fade) {                                   // desvanecido a lo largo (en sentido de lectura)
          const x0 = cx - m.width * sx / 2, x1 = cx + m.width * sx / 2;
          const gr = c.createLinearGradient(x0, 0, x1, 0);
          gr.addColorStop(0, `rgba(0,0,0,${fade[0]})`); gr.addColorStop(1, `rgba(0,0,0,${fade[1]})`);
          c.globalCompositeOperation = 'destination-in'; c.fillStyle = gr; c.fillRect(0, 0, t.width, t.height); c.globalCompositeOperation = 'source-over';
        }
        distress(t, Math.min(0.5, wear), seed + (side === 'L' ? 0 : 7));   // gastado, pero legible
        const uu = side === 'L' ? u : 1 - u;
        g.save(); g.translate(0, uu * H);
        if (side === 'L') { g.translate(W, 0); g.scale(-1, -1); }   // costado +x: se lee desde fuera
        g.drawImage(t, 0, -t.height / 2);
        g.restore();
      }
    },
    // Logo de escudería en el lomo (u = 0.5), apuntando al morro; ar compensa la proporción de la librea
    logo(name, v, size, col, ar = 1.5, { u = 0.5, wear = 0.3, seed = 3 } = {}) {
      const t = document.createElement('canvas'); t.width = W; t.height = H;
      drawLogo(t.getContext('2d'), name, v * W, u * H, size, col, { rot: Math.PI / 2, sx: 1 / ar });
      distress(t, wear, seed);
      g.drawImage(t, 0, 0);
    },
    // Banda de ruptura transversal (en chevron, simétrica): v en el lomo, desplazada 'slant' hacia el fondo
    breakBand(v, width, slant, col) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([v + slant * (1 - Math.abs(u - 0.5) * 2), u]); }
      const back = pts.map(([a, u]) => [a + width, u]).reverse();
      this.poly([...pts, ...back], col);
    },
    grime(seed, alpha = 0.06) {
      let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * alpha})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2); }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * alpha * 0.8})`; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
    },
  };
  painter(P);
  if (!P.noStencils) stencils(P, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Rotulación técnica pequeña (inventada): avisos, códigos, flechas, código de barras.
// El color se elige por contraste con lo que ya hay pintado debajo.
function stencils(P, W, H) {
  const g = P.g;
  const ink = (v, u) => { const d = g.getImageData(Math.min(W - 1, v * W), Math.min(H - 1, u * H), 1, 1).data; return (d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11) > 120 ? 'rgba(12,14,16,0.78)' : 'rgba(236,236,230,0.78)'; };
  const small = '600 %px "Arial Narrow", Arial, sans-serif';
  for (const [side, u] of [['L', 0.44], ['R', 0.56]]) {
    P.text('NO STEP', 0.34, u, 0.018, ink(0.34, u), side, small);
    P.text('SRS-SPEC · 5.5M · AG-7', 0.18, side === 'L' ? 0.4 : 0.6, 0.016, ink(0.18, side === 'L' ? 0.4 : 0.6), side, small);
  }
  for (const [side, u] of [['L', 0.19], ['R', 0.81]]) {
    const col = ink(0.06, u);
    P.text('⚠ IGN', 0.06, u, 0.022, col, side, small);
    g.fillStyle = col;
    for (let k = 0; k < 18; k++) g.fillRect((0.93 + k * 0.0022) * W, (u - 0.015) * H, (k % 3 ? 1 : 2), 0.03 * H);   // código de barras
    for (let k = 0; k < 3; k++) P.poly([[0.1 + k * 0.012, u - 0.012], [0.108 + k * 0.012, u], [0.1 + k * 0.012, u + 0.012]], col);   // flechas
  }
}

// ── Materiales compartidos de la flota ──
const SHARED = {};
function shared() {
  if (SHARED.graphite) return SHARED;
  SHARED.graphite = new THREE.MeshPhysicalMaterial({ name: 'FLEET_Graphite', color: new THREE.Color(0.018, 0.026, 0.035), metalness: 0.75, roughness: 0.36 });
  SHARED.carbon = new THREE.MeshPhysicalMaterial({ name: 'FLEET_Carbon', color: new THREE.Color(0.012, 0.013, 0.015), metalness: 0.3, roughness: 0.62 });
  SHARED.titanium = new THREE.MeshPhysicalMaterial({ name: 'FLEET_Titanium', color: new THREE.Color(0.25, 0.3, 0.33), metalness: 0.85, roughness: 0.28 });
  SHARED.glass = new THREE.MeshPhysicalMaterial({ name: 'FLEET_ObsidianGlass', color: new THREE.Color(0.01, 0.035, 0.055), metalness: 0.55, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.66, depthWrite: false });
  for (const k of ['graphite', 'carbon', 'titanium']) detailMaterial(SHARED[k], k === 'carbon' ? 0.9 : 0.6);
  Object.assign(SHARED, pilotMats());
  SHARED.navRed = new THREE.MeshStandardMaterial({ name: 'FLEET_NavRed', color: 0x330404, emissive: new THREE.Color(1, 0.08, 0.04), emissiveIntensity: 3 });
  SHARED.navIvory = new THREE.MeshStandardMaterial({ name: 'FLEET_NavIvory', color: 0x444444, emissive: new THREE.Color(1, 0.96, 0.9), emissiveIntensity: 2.5 });
  return SHARED;
}

function teamMats(name, armor, accent, ion, liveryTex, { wear = 0.4, primer } = {}) {
  const S = shared();
  const M = {
    ...S,
    armor: new THREE.MeshPhysicalMaterial({ name: `${name}_Armor`, color: 0xffffff, map: liveryTex, metalness: 0.32, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    armorPlain: new THREE.MeshPhysicalMaterial({ name: `${name}_ArmorPlain`, color: armor, metalness: 0.32, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    accent: new THREE.MeshPhysicalMaterial({ name: `${name}_Accent`, color: accent, metalness: 0.4, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    ion: new THREE.MeshStandardMaterial({ name: `${name}_Ion`, color: ion, emissive: ion, emissiveIntensity: 3, metalness: 0.1, roughness: 0.3 }),
    hover: new THREE.MeshStandardMaterial({ name: `${name}_Hover`, color: 0x111111, emissive: ion, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.4 }),
  };
  finishMaterial(M.armor, { wear, seed: hash(name), primer });
  detailMaterial(M.armorPlain, 0.5); detailMaterial(M.accent, 0.55);
  M.wear = wear;
  return M;
}

// Tobera completa: carcasa de titanio, cavidad oscura, disco Ion en la cara trasera
function nozzle(parts, { x, y, z, r, len = 0.5, flare = 1.15 }) {
  parts.titanium.push(lathe([[r * flare, 0], [r * 1.05, len * 0.3], [r, len * 0.7], [r * 1.02, len]], { at: [x, y, z] }));
  parts.carbon.push(lathe([[r * 0.93, 0.02], [r * 0.9, len * 0.8], [r * 0.2, len * 0.95]], { at: [x, y, z] }));
  parts.titanium.push(lathe([[r * 0.35, 0.05], [r * 0.18, 0.2], [0.001, 0.22]], { at: [x, y, z + 0.02] }));
  const disc = new THREE.CircleGeometry(r * 0.86, 32);
  disc.rotateY(Math.PI); disc.translate(x, y, z + 0.06);
  parts.ion.push(disc);
}

// Rejilla de lamas (instanciable → aquí geometría fusionada, pocas piezas)
function slats(parts, key, { n, at, step, size, rot = [0, 0, 0] }) {
  for (let i = 0; i < n; i++) parts[key].push(box(size[0], size[1], size[2], { at: [at[0] + step[0] * i, at[1] + step[1] * i, at[2] + step[2] * i], rot }));
}

// Volumen con signo: < 0 → caras invertidas (normales hacia dentro)
export function signedVolume(g) {
  const p = g.attributes.position, ix = g.index ? g.index.array : null;
  const n = ix ? ix.length : p.count;
  let v = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    a.fromBufferAttribute(p, ix ? ix[t] : t); b.fromBufferAttribute(p, ix ? ix[t + 1] : t + 1); c.fromBufferAttribute(p, ix ? ix[t + 2] : t + 2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}
export const AUDIT = [];

// Piloto en la cabina principal (el cristal más grande) y emisores de levitación bajo el casco.
function crew(parts, mats, { pilot = true, pads = true, padInset = 0.42, pilotAt = null } = {}) {
  if (pilot && parts.glass?.length) {
    let head;
    if (pilotAt) head = pilotAt;
    else {
      const gl = parts.glass.reduce((a, g) => { g.computeBoundingBox(); const s = g.boundingBox.getSize(new THREE.Vector3()); const v = s.x * s.y * s.z; return v > a.v ? { g, v } : a; }, { g: null, v: -1 }).g;
      const bb = gl.boundingBox, sz = bb.getSize(new THREE.Vector3());
      // punto más alto de la burbuja → la cabeza queda bajo él
      const p = gl.attributes.position; let top = null;
      for (let i = 0; i < p.count; i++) if (!top || p.getY(i) > top.y) top = new THREE.Vector3().fromBufferAttribute(p, i);
      const r = Math.min(0.15, sz.x * 0.24, (sz.y) * 0.5);
      head = { x: (bb.min.x + bb.max.x) / 2, y: top.y - r * 1.2, z: top.z - r * 0.4, r };
    }
    const pp = pilotParts(head.x, head.y, head.z, head.r);
    for (const [k, list] of Object.entries(pp)) { parts[k] = parts[k] || []; parts[k].push(...list); }
  }
  if (pads && parts.armor?.length) {
    const hull = new THREE.Mesh(mergeGeometries(parts.armor.map((g) => { const c = g.index ? g.toNonIndexed() : g.clone(); for (const a of Object.keys(c.attributes)) if (a !== 'position') c.deleteAttribute(a); return c; }), false), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    hull.geometry.computeBoundingBox();
    const bb = hull.geometry.boundingBox, L = bb.max.z - bb.min.z;
    const ray = new THREE.Raycaster();
    parts.hover = parts.hover || [];
    for (const fz of [0.24, 0.7]) for (const s of [1, -1]) {
      const z = bb.min.z + L * fz;
      // anchura del casco a esa altura: buscamos el costado con un rayo lateral
      ray.set(new THREE.Vector3(s * 5, (bb.min.y + bb.max.y) / 2, z), new THREE.Vector3(-s, 0, 0));
      const side = ray.intersectObject(hull)[0];
      const x = side ? side.point.x * padInset : s * 0.3;
      ray.set(new THREE.Vector3(x, bb.min.y - 2, z), new THREE.Vector3(0, 1, 0));
      const hit = ray.intersectObject(hull)[0];
      if (!hit) continue;
      const y = hit.point.y;
      const pad = new THREE.CylinderGeometry(0.13, 0.15, 0.03, 20); pad.translate(x, y - 0.012, z);
      parts.hover.push(pad);
      const ring = new THREE.CylinderGeometry(0.19, 0.2, 0.05, 20, 1, true); ring.translate(x, y - 0.005, z);
      parts.titanium.push(ring);
    }
    hull.geometry.dispose();
  }
}

function assemble(name, parts, mats, crewOpts = {}) {
  crew(parts, mats, crewOpts);
  const root = new THREE.Group();
  root.name = name;
  for (const [k, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const list = geos.map((g) => {
      const n = g;
      if (!n.index) n.setIndex([...Array(n.attributes.position.count).keys()]);
      for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a);
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      if (!n.attributes.normal) n.computeVertexNormals();
      return n;
    });
    const merged = mergeGeometries(list, false);
    if (!mats[k]) { console.warn('sin material', name, k); continue; }
    mats[k].side = THREE.DoubleSide;           // como la flota original: sin agujeros en piezas abiertas
    const mesh = new THREE.Mesh(merged, mats[k]);
    mesh.name = `${name}_${k}`;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}

const P = () => ({ armor: [], armorPlain: [], accent: [], graphite: [], carbon: [], titanium: [], glass: [], ion: [], navRed: [], navIvory: [] });
const hex = (c) => '#' + new THREE.Color(c).getHexString();

// ═════════════════════════════════════════════════════════════
//  01 · ILION — lancha de recta: losa larga y baja, morro de pico de pato,
//  cubierta dorsal escalonada, franja lateral que cae hacia el morro.
//  Colores: azul (carrocería) + plata azulada (acento) + grafito (fondo).
// ═════════════════════════════════════════════════════════════
export function buildILION() {
  const ARM = new THREE.Color().setRGB(9 / 255, 40 / 255, 145 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(145 / 255, 162 / 255, 175 / 255, THREE.SRGBColorSpace);
  const ION = new THREE.Color(0.12, 0.6, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    // mitad inferior oscura con barrido que sube hacia la popa (boceto)
    L.sideBand([0, 0.2, 0.45, 0.7, 0.9, 1.0], [0.24, 0.24, 0.21, 0.17, 0.12, 0.08], [0, 0, 0, 0, 0, 0], '#0a0d12');
    L.sideBand([0.02, 0.3, 0.6, 0.85, 1.0], [0.27, 0.265, 0.235, 0.19, 0.13], [0.245, 0.24, 0.215, 0.175, 0.115], hex(ACC));
    L.sideBand([0.02, 0.35, 0.65, 0.88, 1.0], [0.285, 0.28, 0.25, 0.205, 0.14], [0.275, 0.27, 0.242, 0.197, 0.135], '#eef2f5');
    L.poly([[0.86, 0.47], [0.97, 0.5], [0.86, 0.53], [0.89, 0.5]], hex(ACC));
    L.lines(11, 'rgba(0,0,0,0.4)', 150);
    L.rect(0, 0.045, 0, 1, '#25282c'); L.rect(0.975, 1, 0, 1, '#0a0d12');
    L.breakBand(0.66, 0.014, 0.06, '#0b0c0e'); L.breakBand(0.1, 0.01, 0.03, '#0b0c0e');
    L.brand('ILION', { font: 'audiowide', v0: 0.18, v1: 0.82, u: 0.29, h: 0.11, color: '#eef2f5', ar: 2.0, wear: 0.35, seed: 11, skew: 0.25, plate: { color: '#0a1a55', slant: 0.9, pad: 0.3, tail: 0.05 }, lines: { n: 3, len: 0.08, color: '#c9d3e6' } });
    L.text('01', 0.88, 0.3, 0.05, '#eef2f5', 'L'); L.text('01', 0.88, 0.7, 0.05, '#eef2f5', 'R');
    L.logo('ILION', 0.86, 30, '#eef2f5', 2.0);
    L.grime(3);
  });
  const M = teamMats('ILION', ARM, ACC, ION, tex, { wear: 0.45 });
  const p = P();
  const Z = [-2.85, 2.85];
  // casco bajo: arista de hombro, popa alta, morro de cincel con barbilla negra
  p.armor.push(loft([
    { z: -2.8, w: 0.98, hT: 0.36, hB: 0.22, y: 0.22, nT: 6, nB: 5, tuck: 0.2 },
    { z: -2.0, w: 1.06, hT: 0.36, hB: 0.26, y: 0.2, nT: 6, nB: 5, tuck: 0.24 },
    { z: -0.6, w: 1.08, hT: 0.32, hB: 0.28, y: 0.17, nT: 6, nB: 5, tuck: 0.26 },
    { z: 0.8, w: 1.02, hT: 0.26, hB: 0.26, y: 0.13, nT: 5, nB: 4, tuck: 0.26 },
    { z: 1.8, w: 0.88, hT: 0.18, hB: 0.2, y: 0.07, nT: 4, nB: 3.5, tuck: 0.22 },
    { z: 2.45, w: 0.62, hT: 0.09, hB: 0.12, y: 0.02, nT: 3.5, nB: 3, tuck: 0.16 },
    { z: 2.82, w: 0.26, hT: 0.03, hB: 0.04, y: -0.01, nT: 3 },
  ], { N: 72, zRange: Z }));
  // cubierta superior más estrecha (escalón de hombro) que se eleva hacia la popa
  p.armor.push(loft([
    { z: -2.78, w: 0.8, hT: 0.14, hB: 0.04, y: 0.58, nT: 7 },
    { z: -1.6, w: 0.82, hT: 0.12, hB: 0.04, y: 0.52, nT: 7 },
    { z: 0.0, w: 0.78, hT: 0.1, hB: 0.04, y: 0.46, nT: 6 },
    { z: 1.0, w: 0.64, hT: 0.07, hB: 0.04, y: 0.38, nT: 5 },
    { z: 1.8, w: 0.36, hT: 0.02, hB: 0.02, y: 0.26, nT: 4 },
  ], { N: 40, zRange: Z, flatU: 0.44 }));
  // filo plateado del escalón
  for (const g of both(loft([
    { z: -2.75, w: 0.03, hT: 0.02, hB: 0.02, y: 0.56, x: 0.82, nT: 3 },
    { z: -1.6, w: 0.03, hT: 0.02, hB: 0.02, y: 0.5, x: 0.84, nT: 3 },
    { z: 0.0, w: 0.03, hT: 0.02, hB: 0.02, y: 0.44, x: 0.8, nT: 3 },
    { z: 1.0, w: 0.025, hT: 0.015, hB: 0.015, y: 0.36, x: 0.66, nT: 3 },
    { z: 1.8, w: 0.02, hT: 0.01, hB: 0.01, y: 0.25, x: 0.38, nT: 3 },
  ], { N: 10 }))) p.accent.push(g);
  // arista lateral baja
  for (const g of both(loft([
    { z: -2.7, w: 0.05, hT: 0.03, hB: 0.03, y: 0.24, x: 1.07, nT: 3 },
    { z: -0.8, w: 0.06, hT: 0.03, hB: 0.03, y: 0.2, x: 1.1, nT: 3 },
    { z: 0.9, w: 0.05, hT: 0.03, hB: 0.03, y: 0.12, x: 1.03, nT: 3 },
    { z: 2.0, w: 0.04, hT: 0.02, hB: 0.02, y: 0.03, x: 0.86, nT: 3 },
    { z: 2.72, w: 0.02, hT: 0.01, hB: 0.01, y: -0.02, x: 0.46, nT: 3 },
  ], { N: 12 }))) p.accent.push(g);
  // cabina baja
  p.glass.push(loft([
    { z: -0.75, w: 0.24, hT: 0.08, hB: 0.02, y: 0.6, nT: 2.6 },
    { z: -0.2, w: 0.42, hT: 0.17, hB: 0.02, y: 0.56, nT: 2.6 },
    { z: 0.6, w: 0.4, hT: 0.13, hB: 0.02, y: 0.5, nT: 2.6 },
    { z: 1.2, w: 0.24, hT: 0.05, hB: 0.02, y: 0.42, nT: 2.6 },
    { z: 1.45, w: 0.05, hT: 0.01, hB: 0.01, y: 0.38 },
  ], { N: 40 }));
  p.graphite.push(loft([
    { z: -0.8, w: 0.27, hT: 0.03, hB: 0.02, y: 0.59, nT: 2.6 },
    { z: -0.2, w: 0.45, hT: 0.04, hB: 0.02, y: 0.55, nT: 2.6 },
    { z: 0.6, w: 0.43, hT: 0.04, hB: 0.02, y: 0.49, nT: 2.6 },
    { z: 1.25, w: 0.27, hT: 0.03, hB: 0.02, y: 0.41, nT: 2.6 },
  ], { N: 40 }));
  // popa: labio levantado y dos aletas de esquina
  p.accent.push(plate([[-0.84, -0.2], [0.84, -0.2], [0.78, 0.2], [-0.78, 0.2]], 0.05, { plane: 'xz', bevel: 0.012 }).rotateX(-0.28).translate(0, 0.78, -2.72));
  for (const s of [1, -1]) {
    p.armorPlain.push(plate([[-2.1, 0.6], [-2.88, 0.6], [-2.95, 0.95], [-2.62, 0.93]], 0.05, { plane: 'zy', bevel: 0.01, at: [s * 0.8, 0, 0] }));
    p.carbon.push(box(0.05, 0.16, 0.9, { at: [s * 1.07, 0.36, -1.7], bevel: 0.015, rot: [0, 0, s * 0.15] }));
    slats(p, 'titanium', { n: 6, at: [s * 1.09, 0.36, -2.05], step: [0, 0, 0.14], size: [0.02, 0.14, 0.03], rot: [0, 0, s * 0.15] });
    p.carbon.push(box(0.16, 0.08, 0.36, { at: [s * 0.9, 0.38, 0.95], bevel: 0.02, rot: [0.1, s * 0.12, 0] }));
  }
  // barbilla negra y faldones
  p.carbon.push(loft([
    { z: 1.6, w: 0.8, hT: 0.02, hB: 0.1, y: -0.08, nT: 3, nB: 3 },
    { z: 2.5, w: 0.5, hT: 0.02, hB: 0.08, y: -0.06, nT: 3, nB: 3 },
    { z: 2.86, w: 0.16, hT: 0.01, hB: 0.03, y: -0.03, nT: 3 },
  ], { N: 16, facet: true }));
  for (const g of both(loft([
    { z: -2.6, w: 0.07, hT: 0.08, hB: 0.1, y: -0.06, x: 0.82, nT: 3 },
    { z: -0.6, w: 0.08, hT: 0.08, hB: 0.1, y: -0.08, x: 0.8, nT: 3 },
    { z: 1.4, w: 0.05, hT: 0.05, hB: 0.06, y: -0.1, x: 0.64, nT: 3 },
  ], { N: 14 }))) p.graphite.push(g);
  // cara trasera, toberas y difusor
  p.graphite.push(box(1.9, 0.56, 0.1, { at: [0, 0.24, -2.82], bevel: 0.03 }));
  for (const x of [0.52, -0.52]) nozzle(p, { x, y: 0.2, z: -2.88, r: 0.18, len: 0.3 });
  slats(p, 'carbon', { n: 5, at: [-0.3, -0.04, -2.64], step: [0.15, 0, 0], size: [0.03, 0.12, 0.45] });
  glow(p, [[1.11, 0.2, -2.5], [1.11, 0.18, -0.8], [1.03, 0.1, 0.9], [0.86, 0.01, 2.0]], 0.014);
  for (const s of [1, -1]) { p.navIvory.push(box(0.3, 0.02, 0.04, { at: [s * 0.4, 0.02, 2.64], rot: [0, s * 0.55, 0] })); p.navRed.push(box(0.2, 0.04, 0.03, { at: [s * 0.75, 0.32, -2.88] })); }
  return assemble('ILION_1', p, M);
}

// ═════════════════════════════════════════════════════════════
//  02 · SCUBA — fuselaje de cápsula, gran burbuja de cabina, morro redondeado,
//  bahía mecánica expuesta y dos motores cilíndricos colgados atrás; aleta dorsal.
//  Colores: amarillo anaranjado (carrocería) + petróleo (acento).
// ═════════════════════════════════════════════════════════════
export function buildSCUBA() {
  const ARM = new THREE.Color().setRGB(225 / 255, 132 / 255, 6 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(7 / 255, 88 / 255, 105 / 255, THREE.SRGBColorSpace);
  const ACC2 = new THREE.Color().setRGB(120 / 255, 170 / 255, 180 / 255, THREE.SRGBColorSpace); // petróleo claro de la cola en el boceto
  const ION = new THREE.Color(0.12, 0.6, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    // cola petróleo con corte en diagonal (como el boceto)
    L.poly([[0, 0], [0.34, 0], [0.42, 0.25], [0.36, 0.5], [0.42, 0.75], [0.34, 1], [0, 1]], hex(ACC2));
    L.poly([[0, 0.38], [0.2, 0.38], [0.26, 0.5], [0.2, 0.62], [0, 0.62]], hex(ACC));
    // barbilla petróleo bajo el morro
    L.poly([[0.62, 0], [1, 0], [1, 0.16], [0.8, 0.12], [0.66, 0.06]], hex(ACC)); L.poly([[0.62, 1], [1, 1], [1, 0.84], [0.8, 0.88], [0.66, 0.94]], hex(ACC));
    L.lines(22, 'rgba(40,20,0,0.45)', 160);
    for (const [v, u] of [[0.75, 0.2], [0.8, 0.3], [0.52, 0.2], [0.18, 0.2]]) { L.disc(v, u, 0.012, 'rgba(30,20,10,0.8)'); L.disc(v, 1 - u, 0.012, 'rgba(30,20,10,0.8)'); }
    L.text('02', 0.87, 0.26, 0.06, '#1b2a2e', 'L'); L.text('02', 0.87, 0.74, 0.06, '#1b2a2e', 'R');
    L.breakBand(0.4, 0.014, -0.05, '#0b0c0e'); L.rect(0.975, 1, 0, 1, '#2a2d31'); L.rect(0, 0.03, 0, 1, '#2a2d31');
    L.brand('SCUBA', { font: 'bungee-shade', v0: 0.43, v1: 0.93, u: 0.26, h: 0.2, color: '#0d2a31', ar: 1.69, wear: 0.55, seed: 22 });
    L.logo('SCUBA', 0.3, 34, '#0d2a31', 1.69);
    L.grime(7, 0.08);
  });
  const M = teamMats('SCUBA', ARM, ACC, ION, tex, { wear: 0.7 });
  const p = P();
  p.armor.push(loft([
    { z: -2.15, w: 0.5, hT: 0.46, hB: 0.44, y: 0.25, nT: 2.3, nB: 2.3 },
    { z: -1.6, w: 0.62, hT: 0.56, hB: 0.5, y: 0.24, nT: 2.4, nB: 2.4 },
    { z: -0.4, w: 0.68, hT: 0.6, hB: 0.5, y: 0.24, nT: 2.4, nB: 2.3 },
    { z: 0.8, w: 0.6, hT: 0.52, hB: 0.44, y: 0.2, nT: 2.3, nB: 2.2 },
    { z: 1.7, w: 0.44, hT: 0.36, hB: 0.32, y: 0.13, nT: 2.2, nB: 2.2 },
    { z: 2.25, w: 0.26, hT: 0.2, hB: 0.2, y: 0.07, nT: 2.1, nB: 2.1 },
    { z: 2.48, w: 0.08, hT: 0.06, hB: 0.06, y: 0.05 },
  ], { N: 56 }));
  // burbuja de cabina
  p.glass.push(loft([
    { z: -0.55, w: 0.2, hT: 0.1, hB: 0.05, y: 0.72 },
    { z: -0.2, w: 0.44, hT: 0.3, hB: 0.05, y: 0.66 },
    { z: 0.5, w: 0.46, hT: 0.3, hB: 0.05, y: 0.6 },
    { z: 1.1, w: 0.32, hT: 0.18, hB: 0.05, y: 0.5 },
    { z: 1.45, w: 0.06, hT: 0.02, hB: 0.02, y: 0.44 },
  ], { N: 40 }));
  // bahía mecánica lateral (hueco oscuro con tubos)
  for (const s of [1, -1]) {
    p.carbon.push(box(0.08, 0.42, 1.1, { at: [s * 0.64, 0.12, -0.7], bevel: 0.02 }));
    for (let i = 0; i < 4; i++) p.titanium.push(lathe([[0.035, 0], [0.035, 0.95]], { at: [s * 0.7, -0.02 + i * 0.1, -1.2], seg: 10 }));
    p.titanium.push(box(0.1, 0.1, 0.2, { at: [s * 0.7, 0.22, -0.3] }));
  }
  // motores colgados: gondolas cilíndricas con anillos
  for (const s of [1, -1]) {
    const x = s * 0.9, y = 0.06;
    p.accent.push(lathe([[0.3, 0], [0.36, 0.25], [0.37, 0.8], [0.37, 1.6], [0.33, 1.9], [0.2, 2.05]], { at: [x, y, -2.45] }));
    for (const z of [-2.1, -1.75, -1.4, -1.05]) p.titanium.push(lathe([[0.385, 0], [0.39, 0.035], [0.385, 0.07]], { at: [x, y, z] }));
    p.graphite.push(lathe([[0.33, 0], [0.34, 0.12], [0.34, 0.38]], { at: [x, y, -2.62] }));
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; p.titanium.push(box(0.03, 0.03, 0.3, { at: [x + Math.cos(a) * 0.35, y + Math.sin(a) * 0.35, -2.47] })); }
    nozzle(p, { x, y, z: -2.72, r: 0.29, len: 0.38 });
    p.titanium.push(box(0.5, 0.08, 0.9, { at: [s * 0.62, 0.05, -1.75], rot: [0, 0, s * -0.25] }));
    p.accent.push(box(0.55, 0.14, 0.5, { at: [s * 0.6, 0.12, -1.8], bevel: 0.03, rot: [0, 0, s * -0.25] }));
  }
  // aleta dorsal petróleo y antenas
  p.accent.push(plate([[-2.2, 0.55], [-1.2, 0.62], [-1.9, 1.05], [-2.35, 1.08]], 0.07, { plane: 'zy', bevel: 0.015 }));
  for (const s of [1, -1]) p.titanium.push(lathe([[0.012, 0], [0.012, 0.7]], { at: [s * 0.18, 0.95, -1.9], seg: 6 }));
  p.titanium.push(lathe([[0.02, 0], [0.02, 2.2]], { at: [0.62, 0.33, -2.1], seg: 8 }), lathe([[0.02, 0], [0.02, 2.2]], { at: [-0.62, 0.33, -2.1], seg: 8 }));
  // luces
  p.navIvory.push(lathe([[0.05, 0], [0.05, 0.02]], { at: [0, 0.15, 2.4] }));
  for (const s of [1, -1]) p.navRed.push(box(0.04, 0.04, 0.04, { at: [s * 1.2, 0.2, -1.7] }));
  glow(p, [[0.5, -0.12, -1.6], [0.56, -0.16, -0.2], [0.46, -0.12, 1.2]], 0.012);
  for (const s of [1, -1]) p.hover.push(lathe([[0.372, 0], [0.374, 0.025], [0.372, 0.05]], { at: [s * 0.9, 0.06, -2.3] }));
  return assemble('SCUBA_2', p, M);
}

// ═════════════════════════════════════════════════════════════
//  03 · THULE (antes XELTHUS) — punta de flecha: morro de aguja muy largo, fuselaje facetado,
//  alas delta con tomas, dos derivas altas inclinadas hacia fuera, cuchillas exteriores.
//  Colores: púrpura (carrocería) + pizarra (acento) + titanio claro.
// ═════════════════════════════════════════════════════════════
export function buildTHULE() {
  const ARM = new THREE.Color().setRGB(70 / 255, 19 / 255, 119 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(34 / 255, 41 / 255, 53 / 255, THREE.SRGBColorSpace);
  const LIGHT = '#c9c4d6';
  const ION = new THREE.Color(0.12, 0.6, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, LIGHT);
    // morro y lomo púrpura, costados claros, filete pizarra
    L.poly([[0.5, 0.18], [1, 0.05], [1, 0.95], [0.5, 0.82], [0.4, 0.66], [0.4, 0.34]], hex(ARM));
    L.rect(0, 0.42, 0.36, 0.64, hex(ARM));
    L.sideBand([0.05, 0.4, 0.7, 1.0], [0.34, 0.33, 0.28, 0.22], [0.31, 0.3, 0.25, 0.2], hex(ARM));
    L.rect(0, 1, 0, 0.12, hex(ACC)); L.rect(0, 1, 0.88, 1, hex(ACC));
    L.lines(33, 'rgba(20,10,40,0.35)', 110);
    // emblema circular en el morro (como el boceto)
    for (const u of [0.36, 0.64]) { L.ring(0.8, u, 0.05, '#ece8f3', 0.012); L.ring(0.8, u, 0.032, '#ece8f3', 0.008); }
    L.text('03', 0.28, 0.25, 0.055, '#ece8f3', 'L'); L.text('03', 0.28, 0.75, 0.055, '#ece8f3', 'R');
    L.breakBand(0.41, 0.012, 0.08, '#0b0c0e'); L.rect(0, 0.05, 0, 1, '#2a2d31'); L.rect(0.975, 1, 0, 1, '#0b0c0e');
    L.brand('THULE', { font: 'tektur', v0: 0.5, v1: 0.93, u: 0.3, h: 0.1, color: hex(ARM), ar: 1.12, wear: 0.35, seed: 33, skew: 0.22, plate: { color: '#ece8f3', slant: 1.2, pad: 0.3, knockout: true } });
    L.logo('THULE', 0.3, 34, '#ece8f3', 1.12);
    L.grime(5);
  });
  const M = teamMats('THULE', ARM, ACC, ION, tex, { wear: 0.35 });
  const p = P();
  p.armor.push(loft([
    { z: -2.75, w: 0.46, hT: 0.34, hB: 0.24, y: 0.24, nT: 1.7, nB: 2.2 },
    { z: -1.7, w: 0.6, hT: 0.44, hB: 0.26, y: 0.24, nT: 1.7, nB: 2.2 },
    { z: -0.5, w: 0.52, hT: 0.4, hB: 0.24, y: 0.2, nT: 1.7, nB: 2.2 },
    { z: 0.7, w: 0.36, hT: 0.28, hB: 0.2, y: 0.13, nT: 1.7, nB: 2.2 },
    { z: 1.8, w: 0.22, hT: 0.17, hB: 0.14, y: 0.07, nT: 1.7, nB: 2.2 },
    { z: 2.6, w: 0.1, hT: 0.07, hB: 0.07, y: 0.03, nT: 1.8, nB: 2 },
    { z: 2.95, w: 0.02, hT: 0.01, hB: 0.01, y: 0.02 },
  ], { N: 16, facet: true }));
  // cabina alargada
  p.glass.push(loft([
    { z: -0.6, w: 0.14, hT: 0.08, hB: 0.02, y: 0.58, nT: 1.9 },
    { z: -0.2, w: 0.25, hT: 0.2, hB: 0.02, y: 0.54, nT: 1.9 },
    { z: 0.55, w: 0.22, hT: 0.14, hB: 0.02, y: 0.44, nT: 1.9 },
    { z: 1.25, w: 0.1, hT: 0.04, hB: 0.02, y: 0.34, nT: 1.9 },
  ], { N: 24 }));
  p.armor.push(loft([
    { z: -2.7, w: 0.2, hT: 0.1, hB: 0.02, y: 0.62, nT: 1.8 },
    { z: -1.6, w: 0.26, hT: 0.16, hB: 0.02, y: 0.64, nT: 1.8 },
    { z: -0.7, w: 0.24, hT: 0.14, hB: 0.02, y: 0.62, nT: 1.8 },
    { z: -0.35, w: 0.12, hT: 0.04, hB: 0.02, y: 0.62, nT: 1.8 },
  ], { N: 12, facet: true, zRange: [-2.95, 2.95], flatU: 0.47 }));
  p.accent.push(box(0.3, 0.05, 0.5, { at: [0, 0.78, -1.5], bevel: 0.015 }));
  slats(p, 'carbon', { n: 5, at: [-0.12, 0.81, -1.5], step: [0.06, 0, 0], size: [0.025, 0.02, 0.4] });
  // alas delta (espejadas) con anhedro leve y bordes pizarra
  const wing = [[0.4, -2.55], [1.18, -2.35], [1.24, -1.55], [0.46, 0.85]];
  for (const s of [1, -1]) {
    const g = plate(wing.map(([x, z]) => [x * s, z]), 0.09, { plane: 'xz', bevel: 0.02, at: [0, 0.14, 0], rot: [0, 0, s * -0.06] });
    p.armorPlain.push(s > 0 ? g : g);
    p.accent.push(plate([[0.5 * s, -2.5], [1.2 * s, -2.3], [1.22 * s, -2.05], [0.52 * s, -2.2]], 0.1, { plane: 'xz', bevel: 0.01, at: [0, 0.15, 0], rot: [0, 0, s * -0.06] }));
    // tomas de aire sobre la raíz del ala
    p.armor.push(loft([
      { z: -2.3, w: 0.2, hT: 0.2, hB: 0.05, y: 0.24, x: s * 0.62, nT: 3 },
      { z: -1.4, w: 0.2, hT: 0.2, hB: 0.05, y: 0.24, x: s * 0.62, nT: 3 },
      { z: -0.6, w: 0.08, hT: 0.06, hB: 0.04, y: 0.2, x: s * 0.55, nT: 3 },
    ], { N: 16, facet: true, zRange: [-2.95, 2.95], flatU: 0.47 }));
    p.carbon.push(box(0.38, 0.3, 0.04, { at: [s * 0.62, 0.32, -0.66], rot: [0.5, 0, 0] }));
    slats(p, 'titanium', { n: 4, at: [s * 0.62, 0.22, -0.64], step: [0, 0.06, -0.03], size: [0.34, 0.015, 0.02], rot: [0.5, 0, 0] });
    slats(p, 'carbon', { n: 5, at: [s * 0.85, 0.2, -1.9], step: [0, 0, 0.18], size: [0.3, 0.015, 0.06], rot: [0, 0, s * -0.06] });
    p.titanium.push(plate([[0.46 * s, 0.85], [1.24 * s, -1.55], [1.2 * s, -1.6], [0.44 * s, 0.75]], 0.1, { plane: 'xz', bevel: 0.01, at: [0, 0.14, 0], rot: [0, 0, s * -0.06] }));
    // cuchillas exteriores largas
    p.accent.push(plate([[s * 1.2, -2.95], [s * 1.28, -2.95], [s * 1.26, -1.2], [s * 1.22, -1.1]], 0.05, { plane: 'xz', bevel: 0.01, at: [0, 0.1, 0] }));
    // derivas altas inclinadas hacia fuera (pizarra con canto púrpura)
    const fin = plate([[-0.9, 0.3], [-2.25, 0.34], [-2.95, 1.32], [-2.62, 1.36], [-1.65, 0.62]], 0.07, { plane: 'zy', bevel: 0.015 });
    fin.rotateZ(s * -0.24); fin.translate(s * 0.5, 0.05, 0);
    p.accent.push(fin);
    const tip = plate([[-2.62, 1.2], [-2.95, 1.32], [-2.62, 1.36], [-2.45, 1.2]], 0.075, { plane: 'zy', bevel: 0.01 });
    tip.rotateZ(s * -0.24); tip.translate(s * 0.5, 0.05, 0);
    p.armorPlain.push(tip);
  }
  // cola y toberas
  p.graphite.push(box(0.9, 0.46, 0.1, { at: [0, 0.22, -2.78], bevel: 0.03 }));
  for (const x of [0.28, -0.28]) nozzle(p, { x, y: 0.2, z: -2.85, r: 0.15, len: 0.3 });
  p.navRed.push(box(0.03, 0.03, 0.12, { at: [0, 0.03, 2.8] }));
  for (const s of [1, -1]) p.navIvory.push(box(0.04, 0.04, 0.04, { at: [s * 1.24, 0.12, -1.15] }));
  glow(p, [[0.47, 0.19, 0.8], [0.85, 0.19, -0.35], [1.22, 0.19, -1.5]], 0.012);
  p.titanium.push(lathe([[0.01, 0], [0.006, 0.45]], { seg: 6 }).rotateX(-1.2).translate(0, 0.66, 1.3));
  return assemble('THULE_3', p, M);
}

// ═════════════════════════════════════════════════════════════
//  04 · LUDOX — cuña blindada facetada, gran aleta de tiburón,
//  turbina lateral expuesta, chevron naranja delantero, lamas traseras.
//  Colores: petróleo oscuro (carrocería) + naranja (acento).
// ═════════════════════════════════════════════════════════════
export function buildLUDOX() {
  const ARM = new THREE.Color().setRGB(5 / 255, 58 / 255, 63 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(214 / 255, 110 / 255, 24 / 255, THREE.SRGBColorSpace);
  const ION = new THREE.Color(1, 0.43, 0.08);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    // chevron naranja: de la mitad baja del costado hacia el morro
    L.sideBand([0.45, 0.62, 0.8, 1.0], [0.14, 0.2, 0.3, 0.36], [0.02, 0.02, 0.05, 0.08], hex(ACC));
    L.sideBand([0.47, 0.64, 0.82, 1.0], [0.215, 0.26, 0.335, 0.4], [0.2, 0.235, 0.31, 0.37], '#0a1c1e');
    L.rect(0.78, 1, 0.46, 0.54, hex(ACC));
    L.lines(44, 'rgba(0,0,0,0.4)', 140);
    // emblema: círculo con aspa (lado)
    for (const [u, side] of [[0.3, 'L'], [0.7, 'R']]) { L.disc(0.3, u, 0.055, '#e9eceb'); L.disc(0.3, u, 0.042, hex(ARM)); L.text('4', 0.3, u, 0.06, '#e9eceb', side); }
    L.breakBand(0.4, 0.016, 0.05, '#0b0c0e'); L.rect(0, 0.04, 0, 1, '#2a2d31');
    L.brand('LUDOX', { font: 'big-shoulders-stencil-display', v0: 0.03, v1: 0.55, u: 0.27, h: 0.13, color: hex(ACC), ar: 2.7, wear: 0.5, seed: 44, shadow: { dx: 1.2, dy: 1.2, color: '#050b0c', depth: 3 } });
    L.logo('LUDOX', 0.62, 40, '#e9eceb', 2.7);
    L.grime(9, 0.08);
  });
  const M = teamMats('LUDOX', ARM, ACC, ION, tex, { wear: 0.75 });
  const p = P();
  p.armor.push(loft([
    { z: -2.2, w: 1.0, hT: 0.42, hB: 0.34, y: 0.26, nT: 10, nB: 8, tuck: 0.16 },
    { z: -1.2, w: 1.12, hT: 0.46, hB: 0.36, y: 0.26, nT: 9, nB: 8, tuck: 0.18 },
    { z: 0.1, w: 1.08, hT: 0.4, hB: 0.34, y: 0.21, nT: 7, nB: 7, tuck: 0.18 },
    { z: 1.15, w: 0.88, hT: 0.27, hB: 0.27, y: 0.11, nT: 4, nB: 6, tuck: 0.14 },
    { z: 1.9, w: 0.6, hT: 0.14, hB: 0.18, y: 0.02, nT: 3.2, nB: 5, tuck: 0.1 },
    { z: 2.25, w: 0.34, hT: 0.05, hB: 0.1, y: -0.02, nT: 2.6, nB: 4 },
  ], { N: 12, facet: true }));
  // lomo alto y cabina angular
  p.armor.push(loft([
    { z: -2.1, w: 0.55, hT: 0.16, hB: 0.04, y: 0.66, nT: 6 },
    { z: -0.6, w: 0.5, hT: 0.14, hB: 0.04, y: 0.64, nT: 6 },
    { z: 0.4, w: 0.36, hT: 0.08, hB: 0.04, y: 0.56, nT: 5 },
  ], { N: 12, facet: true, zRange: [-2.25, 2.25], flatU: 0.47 }));
  p.glass.push(loft([
    { z: 0.1, w: 0.3, hT: 0.16, hB: 0.02, y: 0.56, nT: 3 },
    { z: 0.7, w: 0.3, hT: 0.12, hB: 0.02, y: 0.48, nT: 3 },
    { z: 1.3, w: 0.16, hT: 0.04, hB: 0.02, y: 0.33, nT: 3 },
  ], { N: 12, facet: true }));
  // aleta de tiburón (petróleo con canto naranja)
  p.armorPlain.push(plate([[-0.3, 0.72], [-2.15, 0.8], [-2.75, 1.95], [-2.45, 1.98], [-1.6, 1.12], [-0.9, 0.85]], 0.13, { plane: 'zy', bevel: 0.03 }));
  p.accent.push(plate([[-2.5, 1.62], [-2.75, 1.95], [-2.45, 1.98], [-2.25, 1.6]], 0.14, { plane: 'zy', bevel: 0.01 }));
  for (const s of [1, -1]) p.graphite.push(plate([[-2.2, 1.0], [-2.5, 1.5], [-2.42, 1.52], [-2.1, 1.02]], 0.02, { plane: 'zy', bevel: 0, at: [s * 0.075, 0, 0] }));
  for (let i = 0; i < 4; i++) p.graphite.push(box(0.14, 0.03, 0.25, { at: [0, 0.95 + i * 0.07, -2.15 - i * 0.05], bevel: 0.01 }));
  // turbinas laterales expuestas
  for (const s of [1, -1]) {
    p.carbon.push(box(0.08, 0.5, 0.8, { at: [s * 1.08, 0.08, 0.55], bevel: 0.02 }));
    const t = lathe([[0.27, 0], [0.3, 0.05], [0.27, 0.12]], { seg: 28 }); t.rotateY(s * Math.PI / 2); t.translate(s * 1.08, 0.06, 0.55); p.titanium.push(t);
    const hub = lathe([[0.1, 0], [0.06, 0.08], [0.001, 0.1]], { seg: 16 }); hub.rotateY(s * Math.PI / 2); hub.translate(s * 1.12, 0.06, 0.55); p.titanium.push(hub);
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; p.graphite.push(box(0.03, 0.2, 0.04, { at: [s * 1.13, 0.06 + Math.sin(a) * 0.11, 0.55 + Math.cos(a) * 0.11], rot: [a + 0.4, 0, 0] })); }
    p.accent.push(box(0.1, 0.06, 1.0, { at: [s * 1.08, -0.2, 0.55], bevel: 0.015 }));
    slats(p, 'carbon', { n: 4, at: [s * 0.86, 0.36, 0.75], step: [0, -0.05, 0.12], size: [0.1, 0.025, 0.07], rot: [0, 0, s * 0.3] });
  }
  // lamas apiladas junto a la raíz de la aleta (boceto)
  for (let i = 0; i < 5; i++) for (const sd of [1, -1]) p.graphite.push(box(0.2, 0.025, 0.3, { at: [sd * 0.24, 0.84 + i * 0.07, -2.0 - i * 0.06], rot: [0, 0, sd * -0.25], bevel: 0.008 }));
  // cara trasera con lamas y toberas
  p.graphite.push(box(1.9, 0.62, 0.12, { at: [0, 0.26, -2.22], bevel: 0.03 }));
  slats(p, 'carbon', { n: 5, at: [0, 0.5, -2.3], step: [0, 0.035, 0], size: [1.5, 0.02, 0.06] });
  for (const x of [0.55, -0.55]) nozzle(p, { x, y: 0.06, z: -2.32, r: 0.2, len: 0.3 });
  for (const s of [1, -1]) p.navRed.push(box(0.05, 0.05, 0.05, { at: [s * 0.95, 0.6, -2.2] }));
  p.navIvory.push(box(0.5, 0.025, 0.03, { at: [0, 0.03, 2.2] }));
  glow(p, [[0.95, 0.02, 0.1], [0.82, 0.02, 1.2], [0.6, -0.02, 1.9]], 0.014);
  for (const s of [1, -1]) slats(p, 'graphite', { n: 3, at: [s * 0.7, 0.62, -1.2], step: [0, 0, 0.18], size: [0.18, 0.03, 0.1], rot: [0, 0, s * 0.35] });
  return assemble('LUDOX_4', p, M);
}

// ═════════════════════════════════════════════════════════════
//  06 · WOLFEN — cohete tubular con gran burbuja, dos góndolas laterales
//  largas unidas por riostras, tobera única enorme, aletas traseras en X.
//  Colores: verde lima (carrocería) + negro (acento).
// ═════════════════════════════════════════════════════════════
export function buildWOLFEN() {
  const ARM = new THREE.Color().setRGB(100 / 255, 163 / 255, 9 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(13 / 255, 18 / 255, 19 / 255, THREE.SRGBColorSpace);
  const ION = new THREE.Color(0.12, 0.6, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    // zona central negra con llamas (como la zona blanca del boceto)
    L.poly([[0.22, 0.12], [0.55, 0.12], [0.6, 0.3], [0.55, 0.5], [0.6, 0.7], [0.55, 0.88], [0.22, 0.88], [0.26, 0.5]], hex(ACC));
    for (let i = 0; i < 7; i++) { const u = 0.18 + i * 0.1; L.poly([[0.55, u - 0.03], [0.66 + (i % 2) * 0.04, u], [0.55, u + 0.03]], hex(ACC)); }
    L.rect(0.08, 0.1, 0, 1, hex(ACC)); L.rect(0.13, 0.14, 0, 1, hex(ACC));
    L.lines(66, 'rgba(0,0,0,0.35)', 120);
    for (const [u, side] of [[0.25, 'L'], [0.75, 'R']]) { L.disc(0.72, u, 0.05, '#101415'); L.ring(0.72, u, 0.05, '#e7ecd9', 0.01); L.text('6', 0.72, u, 0.055, '#e7ecd9', side); }
    L.rect(0, 0.05, 0, 1, '#2a2d31');
    L.brand('WOLFEN', { font: 'knewave', v0: 0.18, v1: 0.62, u: 0.26, h: 0.24, color: '#9ed43a', ar: 1.15, wear: 0.45, seed: 66, skew: 0.28, outline: { w: 0.05, color: '#e7ecd9' } });
    L.logo('WOLFEN', 0.82, 30, '#101415', 1.15);
    L.grime(13);
  });
  const M = teamMats('WOLFEN', ARM, ACC, ION, tex, { wear: 0.6 });
  const p = P();
  p.armor.push(loft([
    { z: -2.35, w: 0.38, hT: 0.38, hB: 0.38, y: 0.26 },
    { z: -1.7, w: 0.48, hT: 0.48, hB: 0.46, y: 0.26 },
    { z: -0.2, w: 0.47, hT: 0.47, hB: 0.43, y: 0.25 },
    { z: 1.1, w: 0.4, hT: 0.38, hB: 0.36, y: 0.22 },
    { z: 2.0, w: 0.28, hT: 0.26, hB: 0.25, y: 0.18 },
    { z: 2.55, w: 0.13, hT: 0.12, hB: 0.12, y: 0.15 },
    { z: 2.8, w: 0.02, hT: 0.02, hB: 0.02, y: 0.14 },
  ], { N: 48 }));
  // burbuja con marco
  p.glass.push(loft([
    { z: -0.9, w: 0.16, hT: 0.08, hB: 0.04, y: 0.7 },
    { z: -0.4, w: 0.34, hT: 0.28, hB: 0.04, y: 0.64 },
    { z: 0.5, w: 0.34, hT: 0.26, hB: 0.04, y: 0.58 },
    { z: 1.1, w: 0.2, hT: 0.1, hB: 0.04, y: 0.5 },
    { z: 1.35, w: 0.04, hT: 0.01, hB: 0.01, y: 0.47 },
  ], { N: 40 }));
  for (const z of [-0.45, 0.4]) { const r = lathe([[0.36, 0], [0.37, 0.03], [0.36, 0.06]], { at: [0, 0.64, z], seg: 40, phi: -Math.PI / 2, arc: Math.PI }); p.titanium.push(r); }
  p.accent.push(lathe([[0.49, 0], [0.5, 0.12], [0.49, 0.24]], { at: [0, 0.26, -1.5], seg: 40 }));
  // cuchillas laterales largas (planos con ventana de cristal) unidas por riostras
  for (const s of [1, -1]) {
    const x = s * 0.98;
    p.accent.push(plate([[x - s * 0.2, -2.55], [x + s * 0.22, -2.45], [x + s * 0.2, 0.2], [x + s * 0.02, 1.25], [x - s * 0.16, 0.4]], 0.07, { plane: 'xz', bevel: 0.02, at: [0, 0.1, 0] }));
    p.glass.push(plate([[x - s * 0.1, -2.2], [x + s * 0.12, -2.15], [x + s * 0.1, 0.1], [x - s * 0.06, 0.3]], 0.085, { plane: 'xz', bevel: 0.008, at: [0, 0.105, 0] }));
    p.armorPlain.push(plate([[x + s * 0.2, -2.45], [x + s * 0.26, -2.4], [x + s * 0.24, 0.2], [x + s * 0.2, 0.2]], 0.1, { plane: 'xz', bevel: 0.01, at: [0, 0.1, 0] }));
    for (const z of [-1.95, -0.3]) p.titanium.push(box(0.62, 0.06, 0.18, { at: [s * 0.63, 0.14, z], rot: [0, 0, s * 0.08], bevel: 0.015 }));
    p.graphite.push(lathe([[0.07, 0], [0.09, 0.1], [0.09, 0.5], [0.06, 0.6]], { at: [x + s * 0.02, 0.1, -2.7] }));
    // aletas traseras en X
    const fin = plate([[-1.5, 0.0], [-2.3, 0.0], [-2.62, 0.66], [-2.3, 0.68]], 0.05, { plane: 'zy', bevel: 0.01 });
    fin.rotateZ(s * -0.6); fin.translate(s * 0.12, 0.52, 0);
    p.armorPlain.push(fin);
    const fin2 = plate([[-1.6, 0.0], [-2.3, 0.0], [-2.5, 0.46], [-2.25, 0.48]], 0.05, { plane: 'zy', bevel: 0.01 });
    fin2.rotateZ(Math.PI + s * 0.6); fin2.translate(s * 0.12, 0.0, 0);
    p.accent.push(fin2);
    p.titanium.push(box(0.03, 0.5, 0.03, { at: [s * 0.4, 0.62, -2.1], rot: [0, 0, s * -0.5] }));
  }
  // tobera única
  p.graphite.push(lathe([[0.38, 0], [0.4, 0.2], [0.36, 0.3]], { at: [0, 0.26, -2.55] }));
  nozzle(p, { x: 0, y: 0.26, z: -2.75, r: 0.3, len: 0.35, flare: 1.2 });
  p.navRed.push(lathe([[0.03, 0], [0.03, 0.02]], { at: [0, 0.14, 2.78] }));
  for (const s of [1, -1]) p.navIvory.push(box(0.03, 0.03, 0.03, { at: [s * 0.98, 0.1, 1.24] }));
  glow(p, [[1.24, 0.1, -2.3], [1.23, 0.1, -0.6], [1.19, 0.1, 0.2]], 0.014);
  p.titanium.push(lathe([[0.01, 0], [0.006, 0.5]], { seg: 6 }).rotateX(-0.9).translate(0, 0.72, -1.4));
  return assemble('WOLFEN_6', p, M);
}

// ═════════════════════════════════════════════════════════════
//  07 · ADAX — gran turismo: cuña alta y facetada con morro largo y faro,
//  cabina sobre el lomo, dos góndolas negras enormes con turbinas redondas.
//  Colores: naranja (carrocería) + negro (acento).
// ═════════════════════════════════════════════════════════════
export function buildADAX() {
  const ARM = new THREE.Color().setRGB(186 / 255, 93 / 255, 14 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(8 / 255, 9 / 255, 12 / 255, THREE.SRGBColorSpace);
  const ION = new THREE.Color(0.12, 0.6, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    // paneles negros inferiores en cuña (boceto) y ranuras
    L.sideBand([0, 0.3, 0.55, 0.8, 1.0], [0.22, 0.24, 0.24, 0.2, 0.14], [0, 0, 0, 0, 0], hex(ACC));
    L.sideBand([0.3, 0.42, 0.5], [0.3, 0.3, 0.26], [0.24, 0.24, 0.24], hex(ACC));
    L.sideBand([0.6, 0.7, 0.78], [0.27, 0.27, 0.23], [0.24, 0.24, 0.2], hex(ACC));
    for (let i = 0; i < 5; i++) L.sideBand([0.82 + i * 0.03, 0.835 + i * 0.03], [0.19, 0.19], [0.15, 0.15], '#1a0b02');
    L.rect(0.9, 1, 0.43, 0.57, hex(ACC));
    L.lines(77, 'rgba(40,15,0,0.45)', 170);
    L.text('07', 0.62, 0.42, 0.05, '#101010', 'L'); L.text('07', 0.62, 0.58, 0.05, '#101010', 'R');
    L.breakBand(0.58, 0.014, 0.04, '#0b0c0e'); L.rect(0.98, 1, 0, 1, '#25282c');
    L.brand('ADAX', { font: 'faster-one', v0: 0.4, v1: 0.94, u: 0.27, h: 0.18, color: '#101010', ar: 1.86, wear: 0.45, seed: 77, shadow: { dx: -1.4, dy: 1.1, color: 'rgba(245,236,220,0.9)', depth: 2 } });
    L.logo('ADAX', 0.72, 34, '#101010', 1.86);
    L.grime(17, 0.07);
  });
  const M = teamMats('ADAX', ARM, ACC, ION, tex, { wear: 0.5 });
  const p = P();
  p.armor.push(loft([
    { z: -1.7, w: 0.72, hT: 0.52, hB: 0.34, y: 0.38, nT: 4, nB: 6, tuck: 0.15 },
    { z: -0.7, w: 0.78, hT: 0.56, hB: 0.35, y: 0.36, nT: 3.6, nB: 6, tuck: 0.15 },
    { z: 0.5, w: 0.72, hT: 0.44, hB: 0.32, y: 0.3, nT: 3.2, nB: 5, tuck: 0.15 },
    { z: 1.5, w: 0.62, hT: 0.3, hB: 0.28, y: 0.19, nT: 2.8, nB: 5, tuck: 0.12 },
    { z: 2.3, w: 0.46, hT: 0.16, hB: 0.2, y: 0.08, nT: 2.4, nB: 4, tuck: 0.1 },
    { z: 2.7, w: 0.2, hT: 0.06, hB: 0.1, y: 0.03, nT: 2.2, nB: 3 },
  ], { N: 20, facet: true }));
  p.glass.push(loft([
    { z: -0.6, w: 0.2, hT: 0.1, hB: 0.03, y: 0.88, nT: 2.4 },
    { z: -0.2, w: 0.36, hT: 0.24, hB: 0.03, y: 0.84, nT: 2.4 },
    { z: 0.55, w: 0.34, hT: 0.18, hB: 0.03, y: 0.74, nT: 2.4 },
    { z: 1.05, w: 0.14, hT: 0.04, hB: 0.03, y: 0.62, nT: 2.4 },
  ], { N: 24, facet: true }));
  p.graphite.push(box(0.5, 0.05, 0.12, { at: [0, 0.99, -0.55], bevel: 0.02 }));
  // faro redondo en el morro
  const lamp = lathe([[0.1, 0], [0.1, 0.03]], { seg: 24 }); lamp.rotateX(-0.45); lamp.translate(0, 0.19, 2.3);
  p.navIvory.push(lamp);
  const lampRim = lathe([[0.13, 0], [0.14, 0.02], [0.13, 0.04]], { seg: 24 }); lampRim.rotateX(-0.45); lampRim.translate(0, 0.18, 2.29);
  p.titanium.push(lampRim);
  // góndolas negras enormes con turbina redonda
  for (const s of [1, -1]) {
    const x = s * 1.0, y = 0.58;
    p.accent.push(loft([
      { z: -2.8, w: 0.46, hT: 0.56, hB: 0.5, y, x, nT: 6, nB: 6 },
      { z: -2.1, w: 0.48, hT: 0.58, hB: 0.5, y, x, nT: 6, nB: 6 },
      { z: -1.2, w: 0.42, hT: 0.48, hB: 0.36, y, x: x * 0.96, nT: 5, nB: 5 },
      { z: -0.45, w: 0.22, hT: 0.24, hB: 0.16, y: y - 0.04, x: x * 0.9, nT: 4, nB: 4 },
      { z: -0.2, w: 0.08, hT: 0.08, hB: 0.06, y: y - 0.06, x: x * 0.88, nT: 3, nB: 3 },
    ], { N: 16, facet: true }));
    const ringG = lathe([[0.4, 0], [0.43, 0.06], [0.4, 0.12]], { seg: 36 }); ringG.translate(x, y, -2.86); p.titanium.push(ringG);
    nozzle(p, { x, y, z: -2.9, r: 0.36, len: 0.32, flare: 1.06 });
    slats(p, 'graphite', { n: 7, at: [x, y + 0.58, -2.55], step: [0, 0, 0.2], size: [0.56, 0.04, 0.1] });
    p.carbon.push(box(0.05, 0.4, 1.1, { at: [x + s * 0.47, y, -2.1], bevel: 0.015 }));
    p.navRed.push(box(0.02, 0.06, 0.6, { at: [x + s * 0.5, y + 0.25, -2.2] }));
  }
  // puente superior entre góndolas con rejilla
  p.accent.push(box(1.7, 0.12, 0.9, { at: [0, 1.0, -2.25], bevel: 0.035 }));
  slats(p, 'titanium', { n: 8, at: [-0.63, 1.08, -2.25], step: [0.18, 0, 0], size: [0.05, 0.03, 0.75] });
  p.graphite.push(box(1.4, 0.62, 0.1, { at: [0, 0.45, -1.72], bevel: 0.03 }));
  // boca negra bajo el morro
  p.accent.push(loft([
    { z: 1.4, w: 0.5, hT: 0.04, hB: 0.1, y: -0.02, nT: 3, nB: 4 },
    { z: 2.3, w: 0.38, hT: 0.04, hB: 0.08, y: -0.02, nT: 3, nB: 4 },
    { z: 2.62, w: 0.16, hT: 0.02, hB: 0.04, y: 0.0, nT: 3, nB: 3 },
  ], { N: 16 }));
  glow(p, [[0.74, 0.1, -0.6], [0.66, 0.06, 0.8], [0.5, 0.0, 2.0]], 0.014);
  for (const s of [1, -1]) { const g = lathe([[0.16, 0], [0.165, 0.02], [0.16, 0.04]], { seg: 24 }); g.rotateY(s * Math.PI / 2); g.translate(s * 1.47, 0.58, -2.1); p.hover.push(g); }
  return assemble('ADAX_7', p, M);
}

// ═════════════════════════════════════════════════════════════
//  08 · NEXUS — catamarán de horquilla: fuselaje central estrecho con cabina adelantada,
//  dos cascos laterales que se adelantan como púas, unidos por planos.
//  Colores: azul marino (cascos, carrocería) + cian (fuselaje central, acento).
// ═════════════════════════════════════════════════════════════
export function buildNEXUS() {
  const ARM = new THREE.Color().setRGB(8 / 255, 19 / 255, 51 / 255, THREE.SRGBColorSpace), ACC = new THREE.Color().setRGB(9 / 255, 140 / 255, 162 / 255, THREE.SRGBColorSpace);
  const ION = new THREE.Color(0.12, 0.6, 1);
  const podTex = livery(1024, 256, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.sideBand([0.1, 0.5, 0.9, 1.0], [0.34, 0.33, 0.3, 0.2], [0.3, 0.29, 0.26, 0.18], hex(ACC));
    L.rect(0, 1, 0, 0.1, '#05080f'); L.rect(0, 1, 0.9, 1, '#05080f');
    L.lines(88, 'rgba(0,0,0,0.5)', 90);
    L.text('08', 0.6, 0.25, 0.1, '#bfe9f0', 'L'); L.text('08', 0.6, 0.75, 0.1, '#bfe9f0', 'R');
    L.rect(0, 0.04, 0, 1, '#2a2d31'); L.breakBand(0.52, 0.012, 0.03, '#0b0c0e');
    L.brand('NEXUS', { font: 'wallpoet', v0: 0.1, v1: 0.52, u: 0.26, h: 0.3, color: '#39d6ea', ar: 1.32, wear: 0.4, seed: 88, outline: { w: 0.03, color: '#e6f6f8' } });
    L.logo('NEXUS', 0.3, 22, '#e6f6f8', 1.32);
    L.grime(21);
  });
  const bodyTex = livery(1024, 256, (L) => {
    L.rect(0, 1, 0, 1, hex(ACC));
    L.rect(0, 1, 0.47, 0.53, '#e6f6f8');
    L.rect(0, 1, 0, 0.18, hex(ARM)); L.rect(0, 1, 0.82, 1, hex(ARM));
    L.lines(99, 'rgba(0,20,30,0.4)', 80);
    L.disc(0.18, 0.5, 0.05, '#e6f6f8'); L.text('N', 0.18, 0.5, 0.07, hex(ARM), 'R');
    L.breakBand(0.42, 0.012, 0.04, '#0b0c0e'); L.breakBand(0.7, 0.01, 0.04, '#0b0c0e');
    L.grime(23);
  });
  const M = teamMats('NEXUS', ARM, ACC, ION, podTex, { wear: 0.4 });
  M.body = finishMaterial(new THREE.MeshPhysicalMaterial({ name: 'NEXUS_Body', color: 0xffffff, map: bodyTex, metalness: 0.35, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15 }), { wear: 0.4, seed: 808 });
  const p = { ...P(), body: [] };
  // fuselaje central cian
  p.body.push(loft([
    { z: -2.3, w: 0.38, hT: 0.32, hB: 0.24, y: 0.24, nT: 2.6 },
    { z: -1.2, w: 0.46, hT: 0.38, hB: 0.25, y: 0.24, nT: 2.6 },
    { z: 0.3, w: 0.44, hT: 0.36, hB: 0.24, y: 0.22, nT: 2.4 },
    { z: 1.4, w: 0.26, hT: 0.24, hB: 0.2, y: 0.18, nT: 2.3 },
    { z: 2.05, w: 0.12, hT: 0.1, hB: 0.1, y: 0.14, nT: 2.2 },
    { z: 2.25, w: 0.02, hT: 0.02, hB: 0.02, y: 0.13 },
  ], { N: 40 }));
  p.glass.push(loft([
    { z: 0.55, w: 0.12, hT: 0.08, hB: 0.02, y: 0.5 },
    { z: 0.9, w: 0.2, hT: 0.16, hB: 0.02, y: 0.47 },
    { z: 1.4, w: 0.16, hT: 0.1, hB: 0.02, y: 0.4 },
    { z: 1.75, w: 0.04, hT: 0.02, hB: 0.02, y: 0.34 },
  ], { N: 28 }));
  // cascos laterales en horquilla (facetados, púa delantera)
  for (const s of [1, -1]) {
    const x = s * 0.78;
    p.armor.push(loft([
      { z: -2.85, w: 0.2, hT: 0.44, hB: 0.2, y: 0.18, x, nT: 5, nB: 6 },
      { z: -1.6, w: 0.22, hT: 0.46, hB: 0.2, y: 0.18, x, nT: 4, nB: 6 },
      { z: 0.4, w: 0.2, hT: 0.38, hB: 0.18, y: 0.15, x: x * 1.02, nT: 3.4, nB: 5 },
      { z: 1.9, w: 0.13, hT: 0.24, hB: 0.12, y: 0.1, x: x * 1.02, nT: 3, nB: 4 },
      { z: 2.7, w: 0.05, hT: 0.08, hB: 0.05, y: 0.07, x: x * 0.98, nT: 2.4 },
      { z: 2.9, w: 0.01, hT: 0.01, hB: 0.01, y: 0.07, x: x * 0.97 },
    ], { N: 14, facet: true }));
    // alas exteriores (planos grises del boceto)
    p.titanium.push(plate([[s * 0.95, -2.4], [s * 1.12, -2.2], [s * 1.12, -0.6], [s * 0.95, 0.4]], 0.05, { plane: 'xz', bevel: 0.012, at: [0, 0.16, 0] }));
    p.accent.push(plate([[s * 1.1, -2.25], [s * 1.14, -2.2], [s * 1.14, -0.7], [s * 1.1, -0.65]], 0.12, { plane: 'xz', bevel: 0.01, at: [0, 0.18, 0] }));
    slats(p, 'carbon', { n: 5, at: [x + s * 0.2, 0.32, -1.9], step: [0, 0, 0.3], size: [0.03, 0.18, 0.12] });
    // aleta en cada casco
    p.accent.push(plate([[-1.6, 0.44], [-2.7, 0.46], [-2.9, 0.82], [-2.6, 0.84]], 0.05, { plane: 'zy', bevel: 0.01, at: [x, 0, 0] }));
    // tomas frontales
    p.carbon.push(box(0.26, 0.14, 0.05, { at: [x, 0.26, 0.9], rot: [-0.35, 0, 0] }));
    nozzle(p, { x, y: 0.16, z: -2.92, r: 0.16, len: 0.28 });
    p.navRed.push(box(0.03, 0.03, 0.06, { at: [x * 0.98, 0.07, 2.86] }));
  }
  // planos de unión y núcleo trasero
  for (const s of [1, -1]) p.armorPlain.push(plate([[s * 0.3, -2.1], [s * 0.66, -2.3], [s * 0.66, 0.6], [s * 0.3, 0.9]], 0.06, { plane: 'xz', bevel: 0.015, at: [0, 0.2, 0] }));
  p.graphite.push(box(0.6, 0.42, 0.1, { at: [0, 0.24, -2.33], bevel: 0.03 }));
  slats(p, 'titanium', { n: 4, at: [0, 0.14, -2.4], step: [0, 0.07, 0], size: [0.46, 0.02, 0.05] });
  glow(p, [[0.98, 0.0, -2.6], [1.0, 0.0, -0.4], [0.94, 0.02, 1.8]], 0.012);
  M.body.name = 'NEXUS_Body';  M.body.name = 'NEXUS_Body';
  return assemble('NEXUS_8', p, M);
}


// ═════════════════════════════════════════════════════════════
//  09 · MANTA — cuña facetada de planeador: gran lomo blanco, banda oscura de ventanas,
//  bahías laterales abiertas con toberas gemelas y tres actuadores, alas bajas anchas
//  que avanzan hacia el morro, visera superior que sobrevuela la punta, escape en ranura.
//  Colores: blanco perla / plata (carrocería) + grafito (acento) + filete rosa.
// ═════════════════════════════════════════════════════════════
export function buildMANTA() {
  const ARM = srgb(226, 228, 230), ACC = srgb(34, 36, 41), PINK = '#ff4f8a';
  const ION = new THREE.Color(1, 0.3, 0.62);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.sideBand([0, 0.3, 0.6, 0.85, 1], [0.13, 0.14, 0.14, 0.12, 0.09], [0, 0, 0, 0, 0], hex(ACC));
    L.sideBand([0.3, 0.5, 0.72, 0.86], [0.46, 0.47, 0.46, 0.44], [0.4, 0.39, 0.39, 0.41], '#2b2e34');
    L.sideBand([0.04, 0.5, 0.96], [0.2, 0.205, 0.185], [0.193, 0.198, 0.18], PINK);
    L.sideBand([0.52, 0.7, 0.86], [0.33, 0.33, 0.31], [0.25, 0.25, 0.24], '#c8cbcf');
    L.rect(0, 0.06, 0, 1, '#24272c');
    L.lines(91, 'rgba(0,0,0,0.3)', 120);
    L.text('09', 0.45, 0.43, 0.05, '#23262b', 'L'); L.text('09', 0.45, 0.57, 0.05, '#23262b', 'R');
    L.breakBand(0.44, 0.012, 0.04, '#24272c'); L.rect(0.975, 1, 0, 1, '#24272c');
    L.brand('MANTA', { font: 'syncopate', v0: 0.55, v1: 0.97, u: 0.25, h: 0.12, color: '#ff4f8a', ar: 1.93, wear: 0.25, seed: 99, tracking: 0.12, shadow: { dx: 1.6, dy: 1.2, color: '#1b1d21', depth: 1 } });
    L.logo('MANTA', 0.25, 34, '#ff4f8a', 1.93);
    L.grime(29, 0.05);
  });
  const M = teamMats('MANTA', ARM, ACC, ION, tex, { wear: 0.3 });
  const p = P();
  const Z = [-2.85, 3.15];
  // popa fina y proa alta: el costado queda abierto entre ambas (cavidad del boceto)
  p.armor.push(loft([
    { z: -2.85, w: 0.72, hT: 0.1, hB: 0.06, y: 0.16, nT: 5, nB: 5 },
    { z: -2.2, w: 0.96, hT: 0.24, hB: 0.12, y: 0.2, nT: 5, nB: 5, tuck: 0.2 },
    { z: -1.5, w: 1.05, hT: 0.36, hB: 0.18, y: 0.24, nT: 5, nB: 5, tuck: 0.25 },
  ], { N: 22, facet: true, zRange: Z }));
  p.armor.push(loft([
    { z: 0.45, w: 1.08, hT: 0.5, hB: 0.24, y: 0.26, nT: 4, nB: 5, tuck: 0.25 },
    { z: 1.4, w: 1.0, hT: 0.46, hB: 0.22, y: 0.24, nT: 4, nB: 5, tuck: 0.25 },
    { z: 2.2, w: 0.78, hT: 0.3, hB: 0.16, y: 0.2, nT: 3.5, nB: 4, tuck: 0.2 },
    { z: 2.7, w: 0.46, hT: 0.14, hB: 0.1, y: 0.16, nT: 3, nB: 4 },
    { z: 2.95, w: 0.18, hT: 0.03, hB: 0.03, y: 0.14, nT: 3 },
  ], { N: 22, facet: true, zRange: Z }));
  // puente superior y quilla sobre la cavidad
  p.armor.push(loft([
    { z: -1.6, w: 1.04, hT: 0.18, hB: 0.05, y: 0.43, nT: 5, nB: 5 },
    { z: -0.5, w: 1.08, hT: 0.27, hB: 0.05, y: 0.45, nT: 5, nB: 5 },
    { z: 0.55, w: 1.08, hT: 0.31, hB: 0.05, y: 0.46, nT: 5, nB: 5 },
  ], { N: 22, facet: true, zRange: Z }));
  p.graphite.push(loft([
    { z: -1.6, w: 0.92, hT: 0.04, hB: 0.1, y: 0.12, nT: 4, nB: 4 },
    { z: 0.55, w: 0.98, hT: 0.04, hB: 0.12, y: 0.12, nT: 4, nB: 4 },
  ], { N: 16, facet: true }));
  // núcleo oscuro dentro de la cavidad
  p.carbon.push(loft([
    { z: -1.7, w: 0.76, hT: 0.3, hB: 0.14, y: 0.26, nT: 4, nB: 4 },
    { z: 0.65, w: 0.8, hT: 0.34, hB: 0.14, y: 0.26, nT: 4, nB: 4 },
  ], { N: 20, facet: true }));
  // visera que sobrevuela el morro + banda de ventanas bajo ella
  p.armor.push(loft([
    { z: -0.6, w: 0.5, hT: 0.03, hB: 0.02, y: 0.8, nT: 5 },
    { z: 0.6, w: 0.92, hT: 0.06, hB: 0.03, y: 0.84, nT: 5 },
    { z: 1.8, w: 0.82, hT: 0.06, hB: 0.03, y: 0.74, nT: 5 },
    { z: 2.7, w: 0.5, hT: 0.04, hB: 0.02, y: 0.5, nT: 4 },
    { z: 3.15, w: 0.14, hT: 0.01, hB: 0.01, y: 0.36, nT: 3 },
  ], { N: 14, facet: true, zRange: Z, flatU: 0.47 }));
  p.glass.push(loft([
    { z: 0.25, w: 0.98, hT: 0.08, hB: 0.02, y: 0.72, nT: 4 },
    { z: 1.2, w: 0.97, hT: 0.1, hB: 0.02, y: 0.69, nT: 4 },
    { z: 2.2, w: 0.74, hT: 0.07, hB: 0.02, y: 0.5, nT: 4 },
    { z: 2.55, w: 0.5, hT: 0.02, hB: 0.01, y: 0.4, nT: 3 },
  ], { N: 20, facet: true }));
  for (const s of [1, -1]) {
    // turbinas gemelas de cara al exterior, sobre el núcleo
    for (const z of [-0.95, -0.35]) {
      const face = lathe([[0.17, 0], [0.175, 0.04], [0.15, 0.1]], { seg: 28 }); face.rotateY(s * Math.PI / 2); face.translate(s * 0.78, 0.25, z); p.titanium.push(face);
      const cav = lathe([[0.15, 0], [0.13, 0.06], [0.04, 0.09]], { seg: 28 }); cav.rotateY(s * Math.PI / 2); cav.translate(s * 0.8, 0.25, z); p.carbon.push(cav);
      const hub = lathe([[0.05, 0], [0.03, 0.05], [0.001, 0.06]], { seg: 16 }); hub.rotateY(s * Math.PI / 2); hub.translate(s * 0.84, 0.25, z); p.titanium.push(hub);
    }
    // tres actuadores con costillas colgando del puente
    for (let i = 0; i < 3; i++) {
      const z = -1.3 + i * 0.55;
      p.titanium.push(box(0.12, 0.08, 0.36, { at: [s * 0.9, 0.4, z], bevel: 0.02, rot: [0.2, 0, 0] }));
      slats(p, 'carbon', { n: 4, at: [s * 0.9, 0.45, z - 0.12], step: [0, 0.01, 0.08], size: [0.13, 0.02, 0.03], rot: [0.2, 0, 0] });
    }
    // ala baja ancha, con caída hacia fuera
    p.armorPlain.push(plate([[s * 0.85, -1.3], [s * 1.5, -0.3], [s * 1.45, 1.9], [s * 0.76, 2.5]], 0.07, { plane: 'xz', bevel: 0.02, at: [0, 0.04, 0], rot: [0, 0, s * -0.1] }));
    p.graphite.push(plate([[s * 1.44, -0.35], [s * 1.54, -0.3], [s * 1.5, 1.9], [s * 1.42, 1.9]], 0.09, { plane: 'xz', bevel: 0.01, at: [0, 0.0, 0], rot: [0, 0, s * -0.1] }));
    p.accent.push(plate([[s * 0.76, 2.35], [s * 1.4, 1.9], [s * 1.2, 2.55], [s * 0.7, 2.68]], 0.05, { plane: 'xz', bevel: 0.01, at: [0, 0.07, 0] }));
  }
  glow(p, [[1.52, -0.08, -0.2], [1.5, -0.08, 0.9], [1.46, -0.07, 1.9]], 0.016);
  glow(p, [[0.93, 0.36, -1.55], [0.95, 0.36, -0.5], [0.95, 0.36, 0.5]], 0.012);
  // cola: escape en ranura y toberas
  p.graphite.push(box(1.3, 0.16, 0.1, { at: [0, 0.16, -2.86], bevel: 0.03 }));
  for (const x of [0.4, -0.4]) nozzle(p, { x, y: 0.16, z: -2.92, r: 0.09, len: 0.18 });
  slats(p, 'carbon', { n: 5, at: [-0.14, 0.16, -2.9], step: [0.07, 0, 0], size: [0.025, 0.12, 0.06] });
  for (const s of [1, -1]) { p.navRed.push(box(0.03, 0.03, 0.1, { at: [s * 1.5, 0.02, 2.0] })); p.navIvory.push(box(0.12, 0.02, 0.02, { at: [s * 0.3, 0.38, 3.08] })); }
  return assemble('MANTA_9', p, M, { pilot: false });
}

// ═════════════════════════════════════════════════════════════
//  10 · BERLIN — dardo asimétrico: fuselaje de aguja blanco con morro naranja y barbilla negra,
//  cabina larga ribeteada en naranja, cuchilla exterior negra con canto naranja a un lado
//  y costado-pontón con número al otro; dos motores traseros con aros naranja.
//  Colores: blanco + naranja + negro, con rojo en las etiquetas.
// ═════════════════════════════════════════════════════════════
export function buildBERLIN() {
  const ARM = srgb(238, 236, 230), ACC = srgb(236, 130, 22), BLK = srgb(14, 14, 16), RED = '#cf2027';
  const ION = new THREE.Color(1, 0.82, 0.45);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.rect(0.9, 1, 0, 1, hex(ACC));                         // morro naranja
    L.rect(0.965, 1, 0, 1, hex(BLK));
    L.sideBand([0, 0.4, 0.8, 1], [0.12, 0.12, 0.1, 0.1], [0, 0, 0, 0], hex(BLK));
    L.sideBand([0.34, 0.6, 0.82], [0.43, 0.42, 0.4], [0.415, 0.405, 0.385], hex(ACC));   // ribete de cabina
    L.sideBand([0.05, 0.9], [0.165, 0.15], [0.155, 0.14], hex(ACC));
    for (const [u0, u1, side] of [[0.35, 0.42, 'L'], [0.58, 0.65, 'R']]) {
      L.rect(0.74, 0.84, u0, u1, RED);
      L.text('G10', 0.79, (u0 + u1) / 2, 0.045, '#ffffff', side);
    }
    for (const [u, side] of [[0.29, 'L'], [0.71, 'R']]) L.text('10', 0.24, u, 0.12, hex(BLK), side, '400 %px "SRS archivo-black", "Arial Black", sans-serif');
    L.breakBand(0.885, 0.012, 0, hex(BLK)); L.rect(0, 0.035, 0, 1, '#25282c');
    L.brand('BERLIN', { font: 'unbounded', v0: 0.42, v1: 0.88, u: 0.26, h: 0.13, color: hex(BLK), ar: 1.12, wear: 0.28, seed: 110, plate: { color: '#cf2027', slant: 0.9, pad: 0.3, padY: 0.25 } });
    L.logo('BERLIN', 0.85, 26, '#0e0e10', 1.12);
    L.lines(101, 'rgba(0,0,0,0.3)', 130);
    L.grime(31, 0.06);
  });
  const M = teamMats('BERLIN', ARM, ACC, ION, tex, { wear: 0.5 });
  M.red = solid('BERLIN_Red', new THREE.Color(RED));
  M.pontoon = extraLivery('BERLIN_Pontoon', 512, 256, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.rect(0, 1, 0, 0.14, hex(BLK)); L.rect(0, 1, 0.86, 1, hex(BLK));
    L.rect(0.52, 0.64, 0.6, 0.86, RED); L.rect(0.66, 0.7, 0.6, 0.86, RED);
    L.text('10', 0.32, 0.7, 0.2, hex(BLK), 'R', '900 %px "Arial Black", Arial, sans-serif');
    L.rect(0.1, 0.9, 0.5, 0.52, hex(ACC));
  }, 0.5, 1010);
  const p = { ...P(), red: [], pontoon: [] };
  const Z = [-2.75, 3.0];
  p.armor.push(loft([
    { z: -2.7, w: 0.46, hT: 0.4, hB: 0.34, y: 0.3, nT: 2.6 },
    { z: -1.8, w: 0.56, hT: 0.46, hB: 0.36, y: 0.3, nT: 2.6 },
    { z: -0.3, w: 0.52, hT: 0.42, hB: 0.32, y: 0.26, nT: 2.5 },
    { z: 1.2, w: 0.4, hT: 0.3, hB: 0.26, y: 0.2, nT: 2.4 },
    { z: 2.3, w: 0.24, hT: 0.16, hB: 0.15, y: 0.14, nT: 2.3 },
    { z: 2.85, w: 0.1, hT: 0.05, hB: 0.06, y: 0.1, nT: 2.2 },
    { z: 3.0, w: 0.02, hT: 0.01, hB: 0.01, y: 0.1 },
  ], { N: 48, zRange: Z }));
  p.carbon.push(loft([
    { z: 1.9, w: 0.27, hT: 0.02, hB: 0.13, y: 0.07, nT: 3, nB: 3 },
    { z: 2.6, w: 0.19, hT: 0.02, hB: 0.1, y: 0.06, nT: 3, nB: 3 },
    { z: 2.97, w: 0.06, hT: 0.01, hB: 0.03, y: 0.07, nT: 3 },
  ], { N: 16, facet: true }));
  p.glass.push(loft([
    { z: -0.9, w: 0.18, hT: 0.08, hB: 0.02, y: 0.68, nT: 2.3 },
    { z: -0.3, w: 0.33, hT: 0.21, hB: 0.02, y: 0.63, nT: 2.3 },
    { z: 0.7, w: 0.3, hT: 0.15, hB: 0.02, y: 0.54, nT: 2.3 },
    { z: 1.5, w: 0.16, hT: 0.05, hB: 0.02, y: 0.43, nT: 2.3 },
    { z: 1.8, w: 0.03, hT: 0.01, hB: 0.01, y: 0.39 },
  ], { N: 36 }));
  p.accent.push(loft([
    { z: -0.95, w: 0.2, hT: 0.02, hB: 0.02, y: 0.68, nT: 2.3 },
    { z: -0.3, w: 0.35, hT: 0.03, hB: 0.02, y: 0.63, nT: 2.3 },
    { z: 0.7, w: 0.32, hT: 0.03, hB: 0.02, y: 0.54, nT: 2.3 },
    { z: 1.5, w: 0.18, hT: 0.02, hB: 0.02, y: 0.43, nT: 2.3 },
  ], { N: 36 }));
  // cuchilla exterior (lado +x): negra con canto naranja, unida por dos riostras
  const bx = 0.98;
  p.carbon.push(loft([
    { z: -2.55, w: 0.1, hT: 0.16, hB: 0.08, y: 0.22, x: bx, nT: 3, nB: 3 },
    { z: -1.0, w: 0.12, hT: 0.18, hB: 0.09, y: 0.22, x: bx, nT: 3, nB: 3 },
    { z: 1.2, w: 0.08, hT: 0.12, hB: 0.06, y: 0.18, x: bx * 0.95, nT: 3, nB: 3 },
    { z: 2.7, w: 0.015, hT: 0.02, hB: 0.015, y: 0.12, x: bx * 0.82, nT: 3 },
  ], { N: 12, facet: true }));
  p.accent.push(loft([
    { z: -0.2, w: 0.03, hT: 0.02, hB: 0.01, y: 0.39, x: bx, nT: 3 },
    { z: 1.2, w: 0.03, hT: 0.02, hB: 0.01, y: 0.3, x: bx * 0.95, nT: 3 },
    { z: 2.72, w: 0.01, hT: 0.01, hB: 0.01, y: 0.14, x: bx * 0.82, nT: 3 },
  ], { N: 8, facet: true }));
  for (const z of [-1.9, -0.3]) p.graphite.push(box(0.56, 0.06, 0.22, { at: [0.68, 0.24, z], bevel: 0.015 }));
  // pontón (lado −x) con número
  p.pontoon.push(loft([
    { z: -2.6, w: 0.3, hT: 0.3, hB: 0.2, y: 0.3, x: -0.74, nT: 4, nB: 4 },
    { z: -1.2, w: 0.34, hT: 0.28, hB: 0.2, y: 0.28, x: -0.76, nT: 4, nB: 4 },
    { z: -0.2, w: 0.22, hT: 0.18, hB: 0.14, y: 0.24, x: -0.68, nT: 3.5, nB: 3.5 },
    { z: 0.4, w: 0.05, hT: 0.05, hB: 0.05, y: 0.22, x: -0.6, nT: 3 },
  ], { N: 32 }));
  p.red.push(box(0.02, 0.06, 0.5, { at: [-1.1, 0.36, -1.5] }));
  // motores traseros con aro naranja
  for (const s of [1, -1]) {
    const x = s * 0.42, y = 0.66;
    p.carbon.push(lathe([[0.18, 0], [0.22, 0.2], [0.22, 0.8], [0.16, 1.05], [0.06, 1.2]], { at: [x, y, -2.55] }));
    p.accent.push(lathe([[0.235, 0], [0.24, 0.05], [0.235, 0.1]], { at: [x, y, -2.55] }));
    nozzle(p, { x, y, z: -2.72, r: 0.18, len: 0.24 });
  }
  p.graphite.push(box(0.9, 0.5, 0.1, { at: [0, 0.3, -2.7], bevel: 0.03 }));
  glow(p, [[0.55, 0.08, -2.4], [0.56, 0.08, -0.4], [0.42, 0.06, 1.4]], 0.012);
  p.navRed.push(box(0.03, 0.03, 0.08, { at: [bx * 0.84, 0.13, 2.66] }));
  p.navIvory.push(box(0.06, 0.02, 0.02, { at: [0, 0.14, 2.96] }));
  return assemble('BERLIN_10', p, M);
}

// ═════════════════════════════════════════════════════════════
//  11 · X3LEE — lente alargada de perla: casco liso de ballena, juntas negras finas
//  que parten el volumen, rendija de cabina en el lomo, labio inferior en cuchilla,
//  aleta ventral barrida y dos toberas pequeñas. Casi sin desgaste.
//  Colores: blanco perla + negro + plata.
// ═════════════════════════════════════════════════════════════
export function buildX3LEE() {
  const ARM = srgb(236, 238, 238), ACC = srgb(16, 17, 19);
  const ION = new THREE.Color(0.72, 0.88, 1);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.g.strokeStyle = '#141517'; L.g.lineWidth = 2.2;
    for (const u of [0.22, 0.31, 0.4]) for (const m of [false, true]) {
      const U = (x) => (m ? 1 - x : x) * 512;
      L.g.beginPath(); L.g.moveTo(0.04 * 1024, U(u + 0.02)); L.g.bezierCurveTo(0.3 * 1024, U(u), 0.7 * 1024, U(u - 0.01), 0.97 * 1024, U(u + 0.04)); L.g.stroke();
    }
    L.sideBand([0.02, 0.5, 0.97], [0.262, 0.262, 0.27], [0.25, 0.25, 0.258], hex(ACC));
    L.rect(0, 0.04, 0, 1, '#1a1b1e');
    L.breakBand(0.12, 0.008, 0.02, '#2a2d31');
    L.brand('X3LEE', { font: 'major-mono-display', v0: 0.1, v1: 0.8, u: 0.25, h: 0.17, color: '#17181b', ar: 1.37, wear: 0.15, seed: 121, tracking: 0.08 });
    L.logo('X3LEE', 0.86, 22, '#17181b', 1.37);
    L.text('11', 0.8, 0.35, 0.03, '#141517', 'L'); L.text('11', 0.8, 0.65, 0.03, '#141517', 'R');
    L.grime(37, 0.03);
  });
  const M = teamMats('X3LEE', ARM, ACC, ION, tex, { wear: 0.12 });
  const p = P();
  const Z = [-2.9, 3.0];
  const body = [
    { z: -2.85, w: 0.42, hT: 0.24, hB: 0.2, y: 0.32, nT: 2.2 },
    { z: -2.2, w: 0.62, hT: 0.4, hB: 0.28, y: 0.32, nT: 2.2 },
    { z: -0.8, w: 0.74, hT: 0.5, hB: 0.32, y: 0.3, nT: 2.2 },
    { z: 0.8, w: 0.7, hT: 0.44, hB: 0.3, y: 0.28, nT: 2.2 },
    { z: 2.0, w: 0.48, hT: 0.26, hB: 0.2, y: 0.24, nT: 2.2 },
    { z: 2.7, w: 0.2, hT: 0.09, hB: 0.08, y: 0.22, nT: 2.2 },
    { z: 3.0, w: 0.03, hT: 0.015, hB: 0.015, y: 0.22 },
  ];
  p.armor.push(loft(body.map((b) => ({ ...b, tuck: 0.12 })), { N: 64, zRange: Z }));
  // juntas negras laterales (el canto que parte el volumen)
  for (const g of both(loft([
    { z: -2.6, w: 0.025, hT: 0.018, hB: 0.018, y: 0.32, x: 0.52, nT: 3 },
    { z: -0.8, w: 0.03, hT: 0.02, hB: 0.02, y: 0.3, x: 0.745, nT: 3 },
    { z: 0.8, w: 0.03, hT: 0.02, hB: 0.02, y: 0.28, x: 0.705, nT: 3 },
    { z: 2.0, w: 0.025, hT: 0.016, hB: 0.016, y: 0.24, x: 0.485, nT: 3 },
    { z: 2.8, w: 0.01, hT: 0.01, hB: 0.01, y: 0.22, x: 0.15, nT: 3 },
  ], { N: 10 }))) p.graphite.push(g);
  // rendija de cabina
  p.glass.push(loft([
    { z: -1.3, w: 0.14, hT: 0.05, hB: 0.02, y: 0.78, nT: 2.4 },
    { z: -0.6, w: 0.3, hT: 0.14, hB: 0.02, y: 0.78, nT: 2.4 },
    { z: 0.6, w: 0.3, hT: 0.12, hB: 0.02, y: 0.72, nT: 2.4 },
    { z: 1.4, w: 0.12, hT: 0.03, hB: 0.02, y: 0.6, nT: 2.4 },
  ], { N: 32 }));
  slats(p, 'carbon', { n: 8, at: [-0.07, 0.66, 1.42], step: [0.02, 0, 0], size: [0.012, 0.02, 0.2], rot: [-0.25, 0, 0] });
  // labio inferior en cuchilla
  p.armorPlain.push(plate([[0.5, 1.1], [0.16, 3.12], [-0.16, 3.12], [-0.5, 1.1]], 0.05, { plane: 'xz', bevel: 0.015, at: [0, 0.07, 0] }));
  p.graphite.push(plate([[0.52, 1.0], [0.52, 1.2], [-0.52, 1.2], [-0.52, 1.0]], 0.06, { plane: 'xz', bevel: 0.01, at: [0, 0.06, 0] }));
  // aleta ventral barrida y pequeñas góndolas
  p.accent.push(plate([[1.0, 0.04], [0.2, 0.04], [-0.45, -0.34], [0.05, -0.36]], 0.06, { plane: 'zy', bevel: 0.015 }));
  for (const s of [1, -1]) p.titanium.push(box(0.14, 0.1, 0.5, { at: [s * 0.36, 0.0, -1.6], bevel: 0.03 }));
  // cola: tapa negra y dos toberas pequeñas
  p.graphite.push(lathe([[0.42, 0], [0.4, 0.12], [0.3, 0.2]], { at: [0, 0.32, -2.95], seg: 40 }));
  for (const s of [1, -1]) nozzle(p, { x: s * 0.2, y: 0.3, z: -3.0, r: 0.11, len: 0.2 });
  glow(p, [[0.745, 0.29, -0.8], [0.72, 0.285, 0.2], [0.7, 0.28, 0.8]], 0.008);
  p.navIvory.push(box(0.14, 0.015, 0.02, { at: [0, 0.23, 2.98] }));
  for (const s of [1, -1]) p.navRed.push(box(0.03, 0.03, 0.03, { at: [s * 0.46, 0.34, -2.6] }));
  return assemble('X3LEE_11', p, M);
}

// ═════════════════════════════════════════════════════════════
//  12 · HUE-MING — cápsula acorazada: casco gris de placas con marcos de metal pavonado,
//  turbina central expuesta a ambos lados con haces de cables, dos chimeneas de escape
//  cromadas apiladas en la cola y cañón-sensor bajo el morro. Muy castigada.
//  Colores: gris claro (placas) + pavonado (marcos) + etiquetas naranjas.
// ═════════════════════════════════════════════════════════════
export function buildHUEMING() {
  const ARM = srgb(192, 194, 196), ACC = srgb(66, 70, 77), OR = '#e8761a';
  const ION = new THREE.Color(0.25, 1, 0.62);
  const tex = livery(1024, 512, (L) => {
    L.rect(0, 1, 0, 1, hex(ARM));
    L.sideBand([0, 0.35, 0.7, 1], [0.24, 0.25, 0.25, 0.22], [0.2, 0.21, 0.21, 0.19], hex(ACC));
    L.rect(0, 1, 0.47, 0.53, hex(ACC));
    L.sideBand([0.12, 0.3], [0.46, 0.46], [0.4, 0.4], '#a9acb0');
    L.sideBand([0.62, 0.9], [0.44, 0.42], [0.34, 0.33], '#cfd1d3');
    for (const [v, u] of [[0.82, 0.36], [0.2, 0.4], [0.55, 0.3]]) { L.rect(v, v + 0.03, u, u + 0.02, OR); L.rect(v, v + 0.03, 1 - u - 0.02, 1 - u, OR); }
    L.breakBand(0.62, 0.016, 0.05, '#0b0c0e'); L.rect(0, 0.04, 0, 1, '#2a2d31'); L.rect(0.975, 1, 0, 1, '#2a2d31');
    L.brand('HUE-MING', { font: 'russo-one', v0: 0.46, v1: 0.96, u: 0.28, h: 0.16, color: '#ff8a2a', ar: 1.9, wear: 0.35, seed: 132, skew: -0.12, plate: { color: '#343940', slant: -0.5, pad: 0.25, padY: 0.3 } });
    L.logo('HUEMING', 0.2, 36, '#e8761a', 1.9);
    L.text('12', 0.86, 0.3, 0.045, '#2e3237', 'L'); L.text('12', 0.86, 0.7, 0.045, '#2e3237', 'R');
    L.lines(121, 'rgba(0,0,0,0.4)', 120);
    L.grime(41, 0.1);
  });
  const M = teamMats('HUEMING', ARM, ACC, ION, tex, { wear: 0.6 });
  const p = P();
  const Z = [-2.6, 3.05];
  // cuerpo interior pavonado (visible entre caparazones)
  p.accent.push(loft([
    { z: -2.45, w: 0.62, hT: 0.44, hB: 0.36, y: 0.42, nT: 3, nB: 3 },
    { z: -0.6, w: 0.8, hT: 0.52, hB: 0.42, y: 0.42, nT: 3, nB: 3 },
    { z: 1.4, w: 0.76, hT: 0.48, hB: 0.38, y: 0.38, nT: 3, nB: 3 },
    { z: 2.6, w: 0.4, hT: 0.24, hB: 0.2, y: 0.3, nT: 2.6, nB: 2.6 },
  ], { N: 40 }));
  // caparazón delantero (placas grises) — deja el bajo del costado abierto
  p.armor.push(loft([
    { z: -0.05, w: 1.0, hT: 0.66, hB: 0.1, y: 0.44, nT: 2.6, nB: 3 },
    { z: 0.9, w: 0.97, hT: 0.64, hB: 0.1, y: 0.42, nT: 2.6, nB: 3 },
    { z: 1.9, w: 0.82, hT: 0.5, hB: 0.1, y: 0.38, nT: 2.5, nB: 3 },
    { z: 2.6, w: 0.52, hT: 0.3, hB: 0.08, y: 0.33, nT: 2.4, nB: 3 },
    { z: 3.0, w: 0.18, hT: 0.08, hB: 0.04, y: 0.3, nT: 2.2 },
  ], { N: 48, zRange: Z }));
  // caparazón trasero
  p.armor.push(loft([
    { z: -2.5, w: 0.78, hT: 0.52, hB: 0.42, y: 0.44, nT: 3, nB: 3 },
    { z: -1.7, w: 0.95, hT: 0.64, hB: 0.46, y: 0.44, nT: 3, nB: 3 },
    { z: -0.95, w: 0.98, hT: 0.66, hB: 0.12, y: 0.44, nT: 2.8, nB: 3 },
  ], { N: 48, zRange: Z }));
  // mandíbula inferior delantera oscura
  p.carbon.push(loft([
    { z: 0.2, w: 0.86, hT: 0.1, hB: 0.3, y: 0.3, nT: 3, nB: 3 },
    { z: 1.6, w: 0.8, hT: 0.1, hB: 0.28, y: 0.28, nT: 3, nB: 3 },
    { z: 2.5, w: 0.48, hT: 0.08, hB: 0.18, y: 0.22, nT: 3, nB: 3 },
    { z: 2.95, w: 0.18, hT: 0.04, hB: 0.08, y: 0.2, nT: 3 },
  ], { N: 32 }));
  // marcos pavonados en los bordes de los caparazones
  for (const g of both(loft([
    { z: -0.05, w: 0.05, hT: 0.04, hB: 0.04, y: 0.42, x: 0.99, nT: 3 },
    { z: 0.9, w: 0.05, hT: 0.04, hB: 0.04, y: 0.4, x: 0.96, nT: 3 },
    { z: 1.9, w: 0.04, hT: 0.03, hB: 0.03, y: 0.36, x: 0.81, nT: 3 },
    { z: 2.7, w: 0.03, hT: 0.02, hB: 0.02, y: 0.31, x: 0.46, nT: 3 },
  ], { N: 10 }))) p.accent.push(g);
  for (const g of both(loft([
    { z: -2.4, w: 0.04, hT: 0.04, hB: 0.04, y: 0.02, x: 0.62, nT: 3 },
    { z: -1.7, w: 0.05, hT: 0.04, hB: 0.04, y: 0.0, x: 0.8, nT: 3 },
    { z: -0.95, w: 0.05, hT: 0.04, hB: 0.04, y: 0.34, x: 0.97, nT: 3 },
  ], { N: 10 }))) p.accent.push(g);
  // placa superior y rendija de cabina
  p.armorPlain.push(plate([[0.42, -1.9], [0.5, 0.9], [0.28, 1.6], [-0.28, 1.6], [-0.5, 0.9], [-0.42, -1.9]], 0.05, { plane: 'xz', bevel: 0.015, at: [0, 1.1, 0] }));
  p.glass.push(loft([
    { z: 1.0, w: 0.3, hT: 0.1, hB: 0.02, y: 0.98, nT: 3 },
    { z: 1.7, w: 0.36, hT: 0.12, hB: 0.02, y: 0.88, nT: 3 },
    { z: 2.35, w: 0.2, hT: 0.05, hB: 0.02, y: 0.68, nT: 3 },
  ], { N: 20, facet: true }));
  // turbina central en el hueco + cables que bajan del caparazón
  for (const s of [1, -1]) {
    const x = s * 0.66, y = 0.3, z0 = -1.15;
    p.graphite.push(lathe([[0.3, 0], [0.37, 0.06], [0.38, 0.2], [0.38, 1.0], [0.34, 1.14], [0.22, 1.2]], { at: [x, y, z0], seg: 40 }));
    for (const k of [0, 1]) p.titanium.push(lathe([[0.39, 0], [0.4, 0.04], [0.39, 0.08]], { at: [x, y, z0 + 0.12 + k * 0.9], seg: 40 }));
    for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + r * 0.3; p.carbon.push(box(0.05, 0.08, 0.2, { at: [x + Math.cos(a) * 0.375, y + Math.sin(a) * 0.375, z0 + 0.4 + r * 0.32], rot: [0, 0, a] })); }
    for (let k = 0; k < 5; k++) {
      const yy = 0.62 + k * 0.05, xo = s * (0.9 - k * 0.02);
      p.carbon.push(tube([[s * 0.95, yy + 0.2, 0.2], [xo, yy + 0.05, -0.2], [s * 0.86, 0.5 - k * 0.03, -0.6], [s * 0.74, 0.62 - k * 0.02, -0.95]], 0.024, { seg: 24, radial: 6 }));
    }
    p.titanium.push(tube([[s * 0.78, 0.06, 0.1], [s * 0.82, 0.05, -0.5], [s * 0.8, 0.06, -1.1]], 0.03, { seg: 16, radial: 8 }));
  }
  // chimeneas cromadas apiladas
  for (const y of [0.26, 0.64]) {
    p.titanium.push(lathe([[0.22, 0], [0.24, 0.1], [0.24, 0.45], [0.2, 0.55]], { at: [0, y, -3.0] }));
    for (let k = 0; k < 3; k++) p.graphite.push(lathe([[0.25, 0], [0.255, 0.03], [0.25, 0.06]], { at: [0, y, -2.95 + k * 0.12] }));
    nozzle(p, { x: 0, y, z: -3.07, r: 0.18, len: 0.2 });
  }
  p.accent.push(box(0.9, 0.9, 0.12, { at: [0, 0.46, -2.5], bevel: 0.04 }));
  // cañón-sensor bajo el morro
  p.titanium.push(lathe([[0.05, 0], [0.05, 0.7], [0.07, 0.72], [0.07, 0.8]], { at: [0, 0.1, 2.5], seg: 16 }));
  glow(p, [[0.99, 0.42, 0.0], [0.96, 0.4, 0.9], [0.81, 0.36, 1.9]], 0.012);
  for (const s of [1, -1]) p.navRed.push(box(0.04, 0.04, 0.04, { at: [s * 0.62, 0.98, -2.3] }));
  p.navIvory.push(box(0.2, 0.03, 0.03, { at: [0, 0.3, 3.0] }));
  return assemble('HUEMING_12', p, M);
}

export const BUILDERS = { ILION: buildILION, SCUBA: buildSCUBA, THULE: buildTHULE, LUDOX: buildLUDOX, WOLFEN: buildWOLFEN, ADAX: buildADAX, NEXUS: buildNEXUS, MANTA: buildMANTA, BERLIN: buildBERLIN, X3LEE: buildX3LEE, HUEMING: buildHUEMING };
