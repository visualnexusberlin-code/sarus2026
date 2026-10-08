// ─────────────────────────────────────────────────────────────
//  NUEVA-ITAKA · isla flotante en órbita baja, entre la Tierra y la Luna
//  Circuito generado: trazado de archivo (gran bucle de bosque), dentro de un tubo de cristal continuo.
//  Tramos subterráneos con paneles hexagonales, subidas a dos colinas altas y una cúpula
//  de rejilla hexagonal sobre toda la isla. Fondo: espacio, con la Tierra y la Luna.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { reshapeLoop, mx } from './reshape.js';
const MX = mx('itaka');                      // trazado en espejo (reshape.js)
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';

// Trazado (píxeles de la referencia, sentido de carrera desde la salida hacia el oeste)
const RAW = [[193, 821], [135, 830], [78, 846], [48, 846], [38, 832], [50, 815], [97, 808], [152, 799], [202, 793], [221, 788], [229, 777], [222, 762], [180, 770], [136, 735], [104, 698], [77, 633], [57, 563], [51, 501], [87, 452], [116, 407], [133, 351], [139, 289], [124, 256], [139, 236], [180, 239], [263, 228], [303, 205], [332, 179], [350, 158], [407, 149], [466, 131], [478, 101], [463, 75], [458, 48], [474, 47], [514, 35], [535, 24], [565, 42], [575, 66], [578, 87], [592, 87], [638, 107], [667, 127], [676, 113], [683, 99], [745, 114], [800, 123], [830, 133], [817, 155], [793, 201], [793, 236], [820, 281], [857, 313], [890, 360], [926, 397], [933, 411], [990, 418], [1039, 425], [1064, 434], [1069, 445], [1050, 454], [1025, 452], [1004, 458], [1003, 472], [1020, 482], [1050, 482], [1080, 480], [1110, 474], [1127, 466], [1144, 449], [1164, 443], [1184, 461], [1200, 492], [1215, 523], [1222, 554], [1203, 578], [1198, 608], [1202, 636], [1185, 652], [1166, 642], [1141, 630], [1114, 645], [1086, 671], [1045, 707], [1013, 705], [961, 724], [903, 723], [862, 707], [829, 673], [810, 671], [793, 687], [797, 701], [815, 722], [821, 750], [818, 762], [790, 780], [700, 775], [600, 772], [500, 773], [406, 773], [367, 780], [300, 785], [246, 812]];
const IDX = { jump0: 14, jump1: 18, cross0: 82, cross1: 87, crest: 70, dip: 35, bowl: 62, longStraight: 97 };
const K = 2.6;                     // m por píxel → ≈ 10,5 km

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }

function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const P = RAW.map(([x, y]) => new THREE.Vector3(MX * (x - cx) * K, 0, (y - cy) * K));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 3; pass++) S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -3; k <= 3; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 7); });
  S = reshapeLoop(S, 'itaka');               // tramos redibujados (reshape.js)
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const fOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return cum[b] / total; };
  const corner = {}; for (const [k, i] of Object.entries(IDX)) corner[k] = fOf(P[i]);
  return { S, cum, total, corner, P };
}

// Textura de rejilla hexagonal (líneas = 1, celdas = 0), repetible
function hexTexture(line = 0.075) {
  const W = 256, H = Math.round(256 * Math.sqrt(3)), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff'; g.lineWidth = W * line; g.lineJoin = 'round';
  const r = W / 3;                                   // hexágono de lado r (cara plana arriba), celda W × H
  const hex = (cx, cy) => { g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  const h = r * Math.sqrt(3) / 2;
  // columnas cada 1,5 r, filas cada 2h, columnas impares desplazadas h
  for (let i = -1; i <= 3; i++) for (let j = -1; j <= 3; j++) hex(i * 1.5 * r, j * 2 * h + (i % 2 ? h : 0));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function buildItaka(def, { world, own, srcMat }) {
  const T0 = performance.now();
  const { S, cum, total, corner, P } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
  let rMax = 0; for (const p of S) rMax = Math.max(rMax, Math.hypot(p.x - centroid.x, p.z - centroid.z));
  const R_I = rMax + 650;                            // radio de la isla

  // ── Relieve de la isla: praderas onduladas, dos colinas altas, borde que cae al vacío ──
  const H1 = P[IDX.crest], H2 = P[IDX.dip];
  function base(x, z) {
    const d = Math.hypot(x - centroid.x, z - centroid.z);
    let h = 22 * (fbm(x * 0.0016, z * 0.0016, 4) - 0.5) + 6 * (fbm(x * 0.012, z * 0.012, 3) - 0.5);
    h += 290 * Math.exp(-(((x - H1.x) ** 2 + (z - H1.z) ** 2) / (640 * 640)));
    h += 250 * Math.exp(-(((x - H2.x) ** 2 + (z - H2.z) ** 2) / (560 * 560)));
    h -= 70 * sstep(R_I - 520, R_I, d);             // el borde se redondea hacia abajo
    return h;
  }

  // ── Cotas de la pista: a ras de suelo, hundida en los dos tramos subterráneos ──
  const hb = S.map((p) => base(p.x, p.z));
  const hs = hb.map((_, i) => { let a = 0; for (let k = -10; k <= 10; k++) a += hb[(i + k + N) % N]; return a / 21; });
  const within = (f, a, b) => (a <= b ? f >= a && f <= b : f >= a || f <= b);
  const ramp = 320 / total;
  const deep = (f) => {
    let d = 0;
    for (const [a, b] of [[corner.jump0, corner.jump1], [corner.cross0, corner.cross1]]) {
      const da = ((f - a + 1) % 1), db = ((b - f + 1) % 1), len = ((b - a + 1) % 1);
      if (da <= len) d = Math.max(d, Math.min(sstep(0, ramp, da), sstep(0, ramp, db)));
    }
    return d;
  };
  let y = S.map((p, i) => hs[i] + 2.4 - 62 * deep(cum[i] / total));
  const lim = 0.26 * 8;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - lim), y[i - 1] + lim);
    for (let i = N - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - lim), y[i + 1] + lim);
  }
  y = y.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += y[(i + k + N) % N]; return a / 7; });

  const pts = [];
  for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.15, 0.3, 0.47, 0.64, 0.8] });
  track.gaps = [];
  const F = track.frame();

  // enterrado = el techo del tubo queda bajo el terreno
  const buried = [];
  for (let s = 0; s < track.length; s += 6) { track.sample(s, F); buried.push(base(F.pos.x, F.pos.z) - F.pos.y > 24); }
  const isBuried = (s) => buried[Math.floor(((s % track.length) + track.length) % track.length / 6) % buried.length];
  const runs = []; { let cur = null; for (let i = 0; i < buried.length; i++) { if (buried[i] && !cur) cur = { s: i * 6, len: 6 }; else if (buried[i]) cur.len += 6; else if (cur) { runs.push(cur); cur = null; } } if (cur) runs.push(cur); }
  const tunnel = runs.length ? runs.reduce((a, b) => (b.len > a.len ? b : a)) : null;

  // Suelo final: se allana junto al tubo; en las bocas de los tramos enterrados se abre una trinchera
  const loc = {}, _p = new THREE.Vector3();
  const ground = (x, z) => {
    let h = base(x, z);
    track.locate(_p.set(x, h, z), loc);
    if (loc.far || loc.dist > 200) return h;
    if (isBuried(loc.s) && loc.dist < 48) return Math.max(h, loc.deckY + 23 + 10 * sstep(20, 48, loc.dist));   // roca sobre el tubo enterrado
    if (h > loc.deckY + 34) return h;
    const w = 1 - sstep(26, 90, loc.dist);
    return lerp(h, loc.deckY - 2.2, w);
  };
  const mouths = [];
  for (let i = 0; i < buried.length; i++) { const a = buried[i], b = buried[(i + 1) % buried.length]; if (a !== b) mouths.push({ s: (i + 1) * 6, into: b }); }
  const lc2 = {}, p2 = new THREE.Vector3();
  const skipCell = (x, z) => {
    const d = Math.hypot(x - centroid.x, z - centroid.z); if (d > R_I) return true;
    const h = base(x, z); track.locate(p2.set(x, h, z), lc2);
    if (lc2.far || lc2.dist > 28) return false;
    return mouths.some((mo) => Math.abs(track.delta(mo.s, lc2.s)) < 34);   // boca: el campo de alturas no admite voladizos
  };

  // ── Materiales ──
  const hexT = hexTexture(0.07); own.push(hexT);
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x7d8286))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xc7ced3))),
    rib: new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: 0.3, metalness: 0.85 }),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x23282c)),
    edge: srcMat('S6 | Satin silver edges'),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(0.25, 0.85, 1.0); m.emissiveIntensity = 2.0; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
    lit: new THREE.MeshStandardMaterial({ color: 0x10202a, emissive: 0x4fdcff, emissiveIntensity: 2.2 }),
  };
  const glassM = new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const hexU = hexT.clone(); hexU.needsUpdate = true; hexU.repeat.set(10, 1); own.push(hexU);
  const hexGlassM = new THREE.MeshStandardMaterial({ color: 0xbfd6e2, transparent: true, alphaMap: hexU, opacity: 1, roughness: 0.2, metalness: 0.85, depthWrite: false, side: THREE.DoubleSide, emissive: 0x3fc8ff, emissiveMap: hexU, emissiveIntensity: 0.35 });
  hexGlassM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= 0.1 + 0.9 * texture2D( alphaMap, vAlphaMapUv ).g;'); };
  const panelM = new THREE.MeshStandardMaterial({ color: 0x2c3338, roughness: 0.45, metalness: 0.8, emissive: 0x39d5ff, emissiveMap: hexU, emissiveIntensity: 1.1, side: THREE.DoubleSide });
  Object.values(M).forEach((m) => own.push(m)); own.push(glassM, hexGlassM, panelM);
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [], lit: [] };
  const tubeParts = { glass: [], hex: [], panel: [] };

  const sweepSeg = (s0, s1, step, prof, closed, vScale = 20, uScale = 1) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (s1 - s0) * r / rows; track.sample(s, F);
      const wv = track.wAt(s);
      prof.forEach(([x0, h], k) => { const x = x0 * wv; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1) * uScale, s / vScale); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };

  // ── Tablero, muros y detalles (vuelta completa, sin saltos) ──
  const L = track.length;
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  const spine = [[-3.2, -1.6], [3.2, -1.6], [2.2, -4.6], [-2.2, -4.6]];
  const CH = 400;                                                            // trozos de 400 m (menos cálculo de visibilidad fina)
  for (let a = 0; a < L; a += CH) {
    const b = Math.min(L, a + CH);
    parts.deck.push(sweepSeg(a, b, 3, deckProf, true, 32));
    parts.guard.push(sweepSeg(a, b, 3, wallL, false), sweepSeg(a, b, 3, wallR, false));
    parts.frame.push(sweepSeg(a, b, 6, spine, true));
    parts.edge.push(sweepSeg(a, b, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(a, b, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  }
  const boxAt = (s, x0, h, w, hh, d, list) => {
    track.sample(s, F);
    const x = Math.abs(x0) > 10 ? x0 * track.wAt(s) : x0;
    const bx = new THREE.BoxGeometry(w, hh, d);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx);
  };
  for (let s = 5; s < L; s += 24) for (const x of [-16.2, 16.2]) boxAt(s, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let s = 0; s < L; s += 14) boxAt(s, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (let s = 0; s < L; s += 12) boxAt(s, 0, -2.0, 30, 0.8, 1.3, parts.rib);
  for (const sc of track.sectors) {                                          // pórticos de sector dentro del tubo
    const s = sc.s + (sc.id === 1 ? 6 : 0);
    for (const x of [-18.2, 18.2]) boxAt(s, x, 6, 1.2, 12, 1.2, parts.frame);
    boxAt(s, 0, 12.6, 36, 1.2, 1.6, parts.frame);
    boxAt(s, 0, 11.9, 30, 0.25, 1.7, parts.gate);
  }

  // ── Tubo continuo: cristal liso, cristal con rejilla hexagonal y paneles hexagonales bajo tierra ──
  const arc = []; for (let k = 0; k <= 14; k++) { const a = Math.PI * k / 14; arc.push([Math.cos(a) * 19.4, 1.4 + Math.sin(a) * 15.5]); }
  const tubeProf = [[19.4, -2.2], ...arc, [-19.4, -2.2]];
  const mode = (s) => {
    if (isBuried(s) || isBuried(s - 40) || isBuried(s + 40)) return 'panel';
    track.sample(s, F);
    if (F.pos.y > 95 || (Math.floor(s / 650) % 3 === 1)) return 'hex';        // subidas a las colinas y algún tramo más
    return 'glass';
  };
  const TS = 30;
  let segStart = 0, segMode = mode(0);
  const flush = (a, b, md) => { if (b - a < 1) return; tubeParts[md].push(sweepSeg(a, b, 3, tubeProf, false, md === 'glass' ? 20 : 11, md === 'glass' ? 1 : 1)); };
  for (let s = TS; s <= L + 0.01; s += TS) {
    const md = s >= L ? null : mode(s);
    if (md !== segMode) { flush(segStart, Math.min(L, s), segMode); segStart = s; segMode = md; }
  }
  // cuadernas metálicas del tubo
  const ribProf = arc.map(([x, h]) => [x * 1.012, h * 1.01 + 0.05]);
  const ribIn = arc.map(([x, h]) => [x * 0.985, h * 0.985]);
  for (let s = 0; s < L; s += 18) { const g1 = sweepSeg(s, s + 0.9, 0.9, ribProf, false); const g2 = sweepSeg(s, s + 0.9, 0.9, ribIn, false); parts.rib.push(g1, g2); }
  // tira de luz en la cumbrera
  for (let a = 0; a < L; a += CH) parts.lit.push(sweepSeg(a, Math.min(L, a + CH), 6, [[-0.3, 16.75], [0.3, 16.75]], false));

  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const norm = list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
    let merged = mergeGeometries(norm, false);
    norm.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]);
    mesh.receiveShadow = true; mesh.castShadow = k !== 'deck' && k !== 'rib';
    world.add(mesh);
  }
  const tubeMat = { glass: glassM, hex: hexGlassM, panel: panelM };
  for (const [k, list] of Object.entries(tubeParts)) {
    if (!list.length) continue;
    const merged = mergeGeometries(list, false); list.forEach((gg) => gg.dispose());
    const mesh = new THREE.Mesh(merged, tubeMat[k]);
    mesh.renderOrder = k === 'panel' ? 0 : 3; mesh.receiveShadow = k === 'panel';
    world.add(mesh);
  }

  // ── Isla: superficie, borde rocoso inferior y rocas flotantes ──
  const tmat = islandMaterial(); own.push(tmat, tmat.userData.grass);
  const grid = (x0, x1, z0, z1, step, hf, skip) => {
    const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step, z = z0 + j * step, o = (j * (nx + 1) + i) * 3;
      pos[o] = x; pos[o + 1] = hf(x, z); pos[o + 2] = z;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (skip && skip(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step)) continue;
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  const RG = R_I + 40;
  const geoTop = grid(centroid.x - RG, centroid.x + RG, centroid.z - RG, centroid.z + RG, 22, ground, skipCell);
  { const m = new THREE.Mesh(geoTop, tmat); m.receiveShadow = true; world.add(m); }
  // bocas: pared de roca con el arco del tubo recortado, donde el terreno se abre
  const rockM = underRockMaterial(); own.push(rockM);
  {
    const parts2 = [], litRings = [];
    const outer = [[-21, -3], ...arc.map(([x, h]) => [x * 1.07, h * 1.06 + 0.3]), [21, -3]];
    for (const mo of mouths) {
      const sh = new THREE.Shape(); sh.moveTo(-34, -32); sh.lineTo(34, -32); sh.lineTo(34, 8); sh.absarc(0, 8, 34, 0, Math.PI, false); sh.lineTo(-34, -32);
      sh.holes.push(new THREE.Path(outer.map(([x, h]) => new THREE.Vector2(-x, h))));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 2, curveSegments: 18 });
      g.translate(0, 0, mo.into ? 0 : -8);
      track.sample(mo.s + (mo.into ? 8 : -8), F);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
      g.translate(F.pos.x, F.pos.y, F.pos.z); g.computeVertexNormals();
      parts2.push(g);
      const ringS = mo.s + (mo.into ? 7.4 : -8.6);
      litRings.push(sweepSeg(ringS, ringS + 1.2, 1.2, outer.map(([x, h]) => [x * 1.02, h * 1.02 + 0.1]), false));
    }
    if (parts2.length) { const pm = new THREE.Mesh(mergeGeometries(parts2.map((g) => { g.deleteAttribute('uv'); return g; }), false), M.frame); pm.castShadow = pm.receiveShadow = true; world.add(pm); }
    if (litRings.length) world.add(new THREE.Mesh(mergeGeometries(litRings.map((g) => { g.deleteAttribute('uv'); return g; }), false), M.lit));
  }
  // cara inferior: cono de roca irregular que cuelga en el vacío
  {
    const prof = []; const depth = 2600;
    for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(Math.max(8, (R_I + 30) * Math.pow(1 - t, 0.55) * (1 - 0.12 * Math.sin(t * 9))), 20 - 90 * sstep(0, 0.08, t) - depth * t)); }
    prof.reverse();                                      // de abajo arriba: normales hacia fuera
    const g = new THREE.LatheGeometry(prof, 140);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), yv = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (yv > -10) continue;
      const k = 1 + 0.22 * (fbm(a * 5 + 3, yv * 0.004, 4) - 0.5) + 0.08 * (vn(a * 40, yv * 0.03) - 0.5);
      p.setXYZ(i, x * k, yv + 60 * (fbm(a * 9, r * 0.003, 3) - 0.5), z * k);
    }
    g.translate(centroid.x, 0, centroid.z); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, rockM));
  }
  // rocas que flotan alrededor
  {
    const rg = new THREE.DodecahedronGeometry(1, 1);
    { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 0.7 + 0.6 * h2(v.x * 3.1 + 7, v.z * 2.3 + v.y); p.setXYZ(i, v.x * k * 1.2, v.y * k * 0.8, v.z * k); } rg.computeVertexNormals(); }
    own.push(rg);
    const n = 70, im = new THREE.InstancedMesh(rg, rockM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = R_I * (1.08 + Math.random() * 0.7), s = 12 + Math.pow(Math.random(), 2.5) * 160;
      ps.set(centroid.x + Math.cos(a) * r, -150 - Math.random() * 1300 + (i % 5 === 0 ? 700 : 0), centroid.z + Math.sin(a) * r);
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 6, Math.random() * 3));
      im.setMatrixAt(i, m4.compose(ps, q, sc.set(s, s * (0.6 + Math.random() * 0.5), s)));
    }
    im.computeBoundingSphere(); world.add(im);
  }
  // bosques: siluetas pintadas en tres planos cruzados alrededor de un eje vertical (pino y frondoso)
  {
    const cross = (w, h) => {
      const gs = [];
      for (let k = 0; k < 3; k++) {
        const g = new THREE.PlaneGeometry(w, h, 1, 2); g.translate(0, h / 2, 0); g.rotateY(k * Math.PI / 3);
        const nn = g.attributes.normal, pp = g.attributes.position;
        for (let i = 0; i < nn.count; i++) { const x = pp.getX(i), z = pp.getZ(i), l = Math.hypot(x, z) || 1; const v = new THREE.Vector3(x / l * 0.55, 0.85, z / l * 0.55).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
        gs.push(g);
      }
      const m = mergeGeometries(gs, false); gs.forEach((g) => g.dispose()); return m;
    };
    const kinds = [
      { geo: cross(9, 20), map: treeTexture('pine'), n: 3600 },
      { geo: cross(13, 14), map: treeTexture('broad'), n: 1600 },
    ];
    const lc = {}, ps = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (const kd of kinds) {
      own.push(kd.geo, kd.map);
      const tm = new THREE.MeshStandardMaterial({ map: kd.map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 }); own.push(tm);
      const im = new THREE.InstancedMesh(kd.geo, tm, kd.n);
      let k = 0, tries = 0;
      while (k < kd.n && tries < kd.n * 10) {
        tries++;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (R_I - 150);
        const x = centroid.x + Math.cos(a) * r, z = centroid.z + Math.sin(a) * r;
        const f = fbm(x * 0.0025 + 9, z * 0.0025, 3);
        if (kd.n > 2000 ? f < 0.52 : (f < 0.44 || f > 0.56)) continue;                  // pinos en el bosque, frondosos en los lindes
        track.locate(ps.set(x, 0, z), lc); if (!lc.far && lc.dist < 55) continue;
        const s = 0.75 + Math.random() * 0.6;
        ps.set(x, ground(x, z) - 0.8, z);
        im.setMatrixAt(k++, m4.compose(ps, q.setFromEuler(new THREE.Euler(0, Math.random() * 6.28, 0)), sc.set(s, s * (0.85 + Math.random() * 0.4), s)));
      }
      im.count = k; im.computeBoundingSphere(); im.receiveShadow = true; world.add(im);
    }
  }

  // ── Cúpula de rejilla hexagonal sobre toda la isla ──
  const RD = R_I * 1.02;
  const domeM = new THREE.MeshStandardMaterial({ color: 0xa9c7d6, transparent: true, roughness: 0.3, metalness: 0.9, depthWrite: false, side: THREE.DoubleSide, emissive: 0x4ad2ff, emissiveIntensity: 0.5, fog: false });
  const CELLS = RD / 70;                                                     // celdas de ~70 m en toda la cúpula
  domeM.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDome;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDome = normalize(position);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vDome;
      const vec2 HS = vec2(1.0, 1.7320508);
      float hexD(vec2 p){ p = abs(p); return max(dot(p, HS * 0.5), p.x); }
      vec2 hexLocal(vec2 uv){ vec4 hC = floor(vec4(uv, uv - vec2(0.5, 1.0)) / HS.xyxy) + 0.5; vec4 h = vec4(uv - hC.xy * HS, uv - (hC.zw + 0.5) * HS); return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float th = acos(clamp(vDome.y, -1.0, 1.0)), ph = atan(vDome.z, vDome.x);
      vec2 uvD = vec2(cos(ph), sin(ph)) * th * ${CELLS.toFixed(2)};
      float e = 0.5 - hexD(hexLocal(uvD)), aa = fwidth(e) * 1.2;
      float mDome = 1.0 - smoothstep(0.035, 0.035 + aa, e);`)
      .replace('#include <alphamap_fragment>', 'diffuseColor.a *= 0.02 + 0.62 * mDome;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= mDome;');
  };
  own.push(domeM);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RD, 160, 48, 0, Math.PI * 2, 0, Math.PI / 2), domeM);
  dome.position.set(centroid.x, -60, centroid.z); dome.scale.y = 0.42; dome.renderOrder = 4; dome.frustumCulled = false;
  world.add(dome);
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(RD, 14, 8, 200), M.frame); ring.rotation.x = Math.PI / 2; ring.position.set(centroid.x, -60, centroid.z); world.add(ring); }

  // ── Espacio: estrellas, la Tierra y la Luna ──
  const space = new Space(world, centroid, def.atmosphere.sunDir);

  // Intro: desde el espacio, con la Tierra detrás, hacia la cúpula y la salida
  const toEarth = space.earthDir.clone().setY(0).normalize();
  const introKeys = () => [
    [0.0, centroid.clone().addScaledVector(toEarth, -9500).setY(2600), centroid.clone().setY(-300), 46],
    [4.0, centroid.clone().addScaledVector(toEarth, -5200).setY(1100), centroid.clone().setY(0), 50],
    [7.2, centroid.clone().addScaledVector(toEarth, -1900).setY(520), S[0].clone().setY(y[0]), 56],
    [9.5, S[Math.round(N * 0.03)].clone().setY(y[0] + 60), S[0].clone().setY(y[0]), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] NUEVA-ITAKA: ${track.length.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · tramos bajo tierra ${runs.map((r) => r.len.toFixed(0)).join('+')} m · isla r=${R_I.toFixed(0)} m · ${(performance.now() - T0).toFixed(0)} ms`);
  space.mouths = mouths;
  return { track, ground, tunnel, introKeys, fx: space };
}

// ── Praderas y bosque de la isla (verde apagado, caminos de piedra, roca en las pendientes) ──
function islandMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.0 });
  const grass = grassTexture();
  m.userData.grass = grass;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGrass = { value: grass };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMW;\nvarying vec3 vMN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvMN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMW; varying vec3 vMN; uniform sampler2D uGrass;
        float mh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mh(i), mh(i+vec2(1,0)), f.x), mix(mh(i+vec2(0,1)), mh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 P = vMW; float up = normalize(vMN).y;
          float n1 = mn(P.xz * 0.002), n2 = mn(P.xz * 0.015), n3 = mn(P.xz * 0.11);
          vec3 meadow = vec3(0.25, 0.36, 0.15), dry = vec3(0.42, 0.4, 0.22), forest = vec3(0.09, 0.17, 0.09), rock = vec3(0.3, 0.29, 0.27);
          vec3 c = mix(meadow, dry, smoothstep(0.45, 0.8, n1 * 0.7 + n2 * 0.3));
          c = mix(c, forest, smoothstep(0.5, 0.56, mn(P.xz * 0.0025 + vec2(9.0, 0.0)) * 0.9 + n2 * 0.1));
          // parcelas de cultivo (como el valle del Eifel)
          vec2 fld = floor(P.xz / vec2(140.0, 90.0)); float fv = mh(fld);
          c = mix(c, mix(vec3(0.5, 0.45, 0.24), vec3(0.3, 0.4, 0.16), fv), step(0.72, fv) * smoothstep(0.7, 0.95, up) * 0.6);
          // briznas: la misma textura a dos escalas y giradas, para no ver la repetición
          vec3 g1 = texture2D(uGrass, P.xz * 0.19).rgb, g2 = texture2D(uGrass, mat2(0.8, -0.6, 0.6, 0.8) * P.xz * 0.037).rgb;
          vec3 gd = mix(g1, g2, 0.45 + 0.3 * n2);
          float grassy = smoothstep(0.7, 0.9, up);
          c *= mix(vec3(1.0), gd * 1.9, grassy * 0.85);
          c = mix(c, c * vec3(1.08, 1.02, 0.78), smoothstep(0.55, 0.75, mn(P.xz * 0.006 + 4.0)) * grassy * 0.5);   // manchas secas
          c = mix(c, c * vec3(0.8, 0.95, 1.02), smoothstep(0.6, 0.8, mn(P.xz * 0.004 + 11.0)) * grassy * 0.4);  // manchas frescas
          c = mix(c, rock * (0.8 + 0.4 * gd.g), 1.0 - smoothstep(0.62, 0.86, up));
          c *= 0.85 + 0.25 * n3;
          diffuseColor.rgb = c;
        }`);
  };
  return m;
}
// Textura de hierba: miles de briznas cortas en verdes y pajizos (se repite en coordenadas de mundo)
function grassTexture() {
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
  g.fillStyle = 'rgb(88,112,52)'; g.fillRect(0, 0, W, W);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W, y = rnd() * W, L = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
    const t = rnd(), v = 0.7 + rnd() * 0.6;
    const col = t < 0.12 ? [150, 140, 80] : t < 0.3 ? [70, 100, 40] : t < 0.8 ? [95, 128, 55] : [120, 150, 70];
    g.strokeStyle = `rgba(${(col[0] * v) | 0},${(col[1] * v) | 0},${(col[2] * v) | 0},0.85)`; g.lineWidth = 0.8 + rnd() * 0.8;
    for (const dx of [0, W, -W]) for (const dy of [0, W, -W]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// Silueta de árbol pintada (pino por pisos o frondoso por racimos), con luz a un lado
function treeTexture(kind) {
  const W = 128, H = kind === 'pine' ? 256 : 160, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let seed = kind === 'pine' ? 3 : 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = 'rgb(58,42,30)'; g.fillRect(W / 2 - 3, H * 0.72, 6, H * 0.28);                     // tronco
  if (kind === 'pine') {
    for (let i = 0; i < 9; i++) {                                                                  // pisos de ramas colgantes
      const y0 = H * 0.06 + i * H * 0.085, w = 10 + i * 6.2, hgt = H * 0.16;
      const shade = 0.75 + i * 0.03;
      for (let k = 0; k < 60; k++) {
        const u = rnd(), side = rnd() < 0.5 ? -1 : 1, x = W / 2 + side * u * w, y = y0 + hgt * (0.35 + u * 0.65) + (rnd() - 0.5) * 6;
        const lit = side > 0 ? 1.15 : 0.8;
        g.fillStyle = `rgb(${(30 * shade * lit) | 0},${(62 * shade * lit + rnd() * 14) | 0},${(34 * shade * lit) | 0})`;
        g.beginPath(); g.moveTo(W / 2, y0); g.lineTo(x, y); g.lineTo(x - side * 5, y + 3); g.closePath(); g.fill();
      }
    }
  } else {
    for (let k = 0; k < 140; k++) {                                                               // racimos de hojas
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()), x = W / 2 + Math.cos(a) * r * W * 0.42, y = H * 0.38 + Math.sin(a) * r * H * 0.3;
      const lit = 0.75 + 0.45 * ((x - W / 2) / W + 0.5) * (1 - (y / H)), rr = 5 + rnd() * 9;
      g.fillStyle = `rgb(${(58 * lit) | 0},${(88 * lit + rnd() * 18) | 0},${(38 * lit) | 0})`;
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function underRockMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMW2; float rh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(rh(i), rh(i+vec2(1,0)), f.x), mix(rh(i+vec2(0,1)), rh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float st = rn(vec2(vMW2.y * 0.03, (vMW2.x + vMW2.z) * 0.004)); float n = rn(vMW2.xz * 0.01 + vMW2.y * 0.005);
          diffuseColor.rgb = mix(vec3(0.16, 0.13, 0.11), vec3(0.34, 0.3, 0.26), st * 0.7 + n * 0.3); }`);
  };
  return m;
}

// ── Espacio: estrellas, Tierra con nubes y atmósfera, Luna ──
const NOISE3 = /* glsl */`
  float hh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hh(i), hh(i+vec3(1,0,0)), f.x), mix(hh(i+vec3(0,1,0)), hh(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hh(i+vec3(0,0,1)), hh(i+vec3(1,0,1)), f.x), mix(hh(i+vec3(0,1,1)), hh(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fb3(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 6; i++){ a += n3(p) * w; p = p * 2.03 + 1.7; w *= 0.5; } return a; }`;
class Space {
  constructor(parent, c, sunDir) {
    this.group = new THREE.Group(); this.group.name = 'SPACE'; parent.add(this.group);
    this.t = 0;
    // estrellas
    const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), R = 240000;
      pos.set([c.x + Math.cos(a) * r * R, u * R, c.z + Math.sin(a) * r * R], i * 3);
      const k = 0.5 + Math.random() * 0.5, t = Math.random();
      col.set(t < 0.15 ? [k, k * 0.85, k * 0.7] : t < 0.3 ? [k * 0.8, k * 0.88, k] : [k, k, k], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -900; this.group.add(this.stars);
    // Tierra (grande, abajo a un lado) y Luna
    this.earthDir = new THREE.Vector3(0.62 * MX, -0.3, 0.72).normalize();
    const sun = sunDir.clone().normalize();
    const earthM = new THREE.ShaderMaterial({
      fog: false, uniforms: { uSun: { value: sun }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vO; varying vec3 vW; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
      fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vO; varying vec3 vW; ${NOISE3}
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          float land = smoothstep(0.52, 0.56, fb3(vO * 2.6));
          vec3 ocean = mix(vec3(0.01, 0.05, 0.16), vec3(0.03, 0.12, 0.28), fb3(vO * 9.0));
          vec3 ground = mix(vec3(0.16, 0.22, 0.09), vec3(0.42, 0.36, 0.22), smoothstep(0.4, 0.7, fb3(vO * 7.0 + 3.0)));
          vec3 c = mix(ocean, ground, land);
          c = mix(c, vec3(0.9), smoothstep(0.78, 0.9, abs(vO.y)));
          float cl = smoothstep(0.5, 0.72, fb3(vO * 4.5 + vec3(uTime * 0.004, 0.0, 0.0)));
          c = mix(c, vec3(0.95), cl * 0.9);
          float d = dot(N, uSun), day = smoothstep(-0.08, 0.25, d);
          vec3 col = c * (0.04 + 1.25 * max(d, 0.0));
          float city = step(0.83, hh(floor(vO * 260.0))) * land * (1.0 - cl) * (1.0 - day);
          col += vec3(1.0, 0.7, 0.35) * city * 0.6;
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.3, 0.6, 1.0) * rim * (0.15 + 1.1 * smoothstep(-0.2, 0.4, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(62000, 128, 80), earthM);
    this.earth.position.copy(c).addScaledVector(this.earthDir, 175000);
    this.earth.frustumCulled = false; this.earth.renderOrder = -800; this.group.add(this.earth);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(62000 * 1.035, 96, 64), new THREE.ShaderMaterial({
      fog: false, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, uniforms: { uSun: { value: sun } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }',
      fragmentShader: 'uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float r = pow(1.0 - abs(dot(normalize(vN), V)), 5.0); float d = smoothstep(-0.3, 0.5, dot(normalize(vN), uSun)); gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * r * (0.2 + d), 1.0); }',
    }));
    halo.position.copy(this.earth.position); halo.frustumCulled = false; this.group.add(halo);
    this.moonDir = new THREE.Vector3(-0.7 * MX, 0.25, 0.66).normalize();
    const moonM = new THREE.ShaderMaterial({
      fog: false, uniforms: { uSun: { value: sun } },
      vertexShader: 'varying vec3 vN; varying vec3 vO; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vO; ${NOISE3}
        void main(){ float m = fb3(vO * 3.0); float cr = smoothstep(0.62, 0.66, fb3(vO * 11.0 + 5.0));
          vec3 c = mix(vec3(0.62), vec3(0.34), smoothstep(0.45, 0.6, m)) * (1.0 - cr * 0.25);
          float d = max(dot(normalize(vN), uSun), 0.0); gl_FragColor = vec4(c * (0.02 + 1.15 * d), 1.0); }`,
    });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(15000, 64, 48), moonM);
    this.moon.position.copy(c).addScaledVector(this.moonDir, 215000);
    this.moon.frustumCulled = false; this.moon.renderOrder = -800; this.group.add(this.moon);
    this.earthM = earthM;
  }
  update(dt) { this.t += dt; this.earthM.uniforms.uTime.value = this.t; this.earth.rotation.y += dt * 0.004; }
}
