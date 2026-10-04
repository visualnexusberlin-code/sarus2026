// CASSINI-7: sobre los anillos de Saturno, junto a la división de Cassini. Trazado inspirado en Fuji Speedway
// 1965/74. El tablero descansa en columnas clavadas en fragmentos de hielo y roca de los anillos; bajo la pista,
// el enjambre de fragmentos; hasta el horizonte, la lámina de anillos con sus bandas; al fondo, Saturno
// (colores naturales: beige dorado apagado, bandas suaves; anillos crema, tostado y gris azulado).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';

const RAW = [[390, 385], [560, 282], [750, 172], [900, 84], [1000, 40], [1070, 25], [1122, 42], [1140, 100], [1145, 200], [1135, 300], [1110, 370], [1070, 430], [1010, 470], [950, 470], [915, 440], [905, 390], [930, 330], [965, 280], [960, 230], [920, 200], [860, 205], [800, 240], [760, 290], [730, 350], [715, 420], [700, 480], [670, 540], [620, 550], [570, 520], [545, 450], [535, 420], [510, 420], [495, 450], [495, 520], [495, 600], [485, 680], [440, 740], [370, 780], [270, 795], [170, 790], [100, 760], [70, 700], [90, 620], [150, 560], [250, 480], [330, 420]];
const IDX = { daiichi: 7, suntory: 18, r100: 27, hairpin: 30, r300: 37, last: 41 };
const K = 1.6;                    // ≈ 5,8 km
const RING_Y = -150;              // plano medio del enjambre de fragmentos, bajo la pista
const SAT_R = 12000;              // radio de Saturno (escala artística: lejano y velado)
const SAT_D = 40000;              // distancia al centro de Saturno
const RV = 18000;                 // radio de referencia para las bandas (C, B, Cassini, A, F)

const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }
let _seed = 11;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const P = RAW.map(([x, y]) => new THREE.Vector3((x - cx) * K, 0, (y - cy) * K));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 4; pass++) S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -4; k <= 4; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 9); });
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const fOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return cum[b] / total; };
  const corner = {}; for (const [k, i] of Object.entries(IDX)) corner[k] = fOf(P[i]);
  return { S, cum, total, corner, P };
}

// Saturno hacia −x (a la izquierda al salir por la recta); sol bajo, de lado, rozando el plano de los anillos
const SAT_DIR = new THREE.Vector3(-0.82, 0, -0.57).normalize();
export function cassiniSunDir() { return new THREE.Vector3(0.45, 0.2, -0.87).normalize(); }

// ── Bandas de los anillos (perfil radial, colores naturales) ──
function ringTexture() {
  const W = 2048, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const r0 = 1.2, r1 = 2.4;                       // radio en unidades de RV
  for (let i = 0; i < W; i++) {
    const r = r0 + (r1 - r0) * i / (W - 1);
    let d = 0, col = [0.62, 0.62, 0.64];
    if (r < 1.24) d = 0;
    else if (r < 1.53) { d = 0.3 + 0.2 * fbm(r * 90, 0.5, 3); col = [0.42, 0.44, 0.5]; }                           // C: gris azulado, tenue
    else if (r < 1.95) { const u = (r - 1.53) / 0.42; d = 0.75 + 0.25 * Math.sin(u * 3.0) + 0.35 * (fbm(r * 160, 1.5, 4) - 0.5); col = [lerp(0.72, 1.0, u), lerp(0.66, 0.92, u), lerp(0.6, 0.78, u)]; } // B: crema
    else if (r < 2.03) { d = 0.04 + 0.05 * fbm(r * 300, 2, 2); col = [0.4, 0.4, 0.42]; }                             // división de Cassini
    else if (r < 2.27) { const b = fbm(r * 120, 3, 4); d = 0.62 + 0.4 * (b - 0.5) - (Math.abs(r - 2.21) < 0.006 ? 0.55 : 0); col = [0.72 + b * 0.2, 0.68 + b * 0.18, 0.62 + b * 0.12]; } // A (con la división de Encke)
    else if (r < 2.33) d = 0.02;
    else if (r < 2.335) { d = 0.45; col = [0.85, 0.82, 0.76]; }                                                       // F
    d = Math.max(0, Math.min(1, d * (0.9 + 0.2 * fbm(r * 800, 4, 2))));
    const fine = 0.82 + 0.36 * vn(r * 2400, 0.5);
    col = col.map((v) => v * fine);
    for (let j = 0; j < H; j++) {
      const spoke = 1 - 0.12 * Math.max(0, fbm(i * 0.004, j * 0.2, 2) - 0.55) * 3;                                    // radios (spokes) muy suaves
      const o = (j * W + i) * 4;
      img.data[o] = Math.min(255, col[0] * 255 * spoke); img.data[o + 1] = Math.min(255, col[1] * 255 * spoke); img.data[o + 2] = Math.min(255, col[2] * 255 * spoke); img.data[o + 3] = d * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return { tex: t, r0, r1 };
}

// ── Saturno: beige dorado apagado, bandas suaves, polo algo más gris ──
function saturnTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const lat = (j / (H - 1) - 0.5) * Math.PI;              // −π/2 … π/2
    const b = Math.sin(lat * 9.0 + Math.sin(lat * 3.1) * 0.8) * 0.5 + 0.5;
    const b2 = Math.sin(lat * 23.0) * 0.5 + 0.5;
    const pole = Math.pow(Math.abs(Math.sin(lat)), 6);
    for (let i = 0; i < W; i++) {
      const n = fbm(i * 0.01 + lat * 3, lat * 40, 3);
      const t = b * 0.7 + b2 * 0.2 + (n - 0.5) * 0.25;
      let r = lerp(0.72, 0.86, t), gg = lerp(0.62, 0.76, t), bb = lerp(0.46, 0.58, t);
      r = lerp(r, 0.62, pole * 0.8); gg = lerp(gg, 0.64, pole * 0.8); bb = lerp(bb, 0.62, pole * 0.8);
      const o = (j * W + i) * 4; img.data[o] = r * 255; img.data[o + 1] = gg * 255; img.data[o + 2] = bb * 255; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Roca/hielo irregular (icosaedro deformado por ruido)
function rockGeo(detail, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 1.7 + seed, v.y * 1.7 + v.z * 1.3 + seed * 2, 4);
    const k = 0.62 + n * 0.75 + 0.12 * Math.sin(v.x * 5 + seed) * Math.sin(v.z * 4 + seed * 3);
    p.setXYZ(i, v.x * k * 1.15, v.y * k * 0.82, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function buildCassini(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 11;
  const { S, cum, total, corner, P } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
  let rMax = 0; for (const p of S) rMax = Math.max(rMax, Math.hypot(p.x - centroid.x, p.z - centroid.z));

  // ── Cotas: Fuji baja por la recta y sube por la 300R; aquí se acentúa sobre el vacío ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  let y = S.map((_, i) => { const f = cum[i] / total; return 4 - 14 * g(f, corner.daiichi, 420) + 10 * g(f, corner.suntory, 300) - 8 * g(f, corner.hairpin, 220) + 22 * g(f, corner.r300, 520) + 8 * g(f, corner.last, 260); });
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -4; k <= 4; k++) a += y[(i + k + N) % N]; return a / 9; });
  const ground = () => RING_Y;

  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.16, 0.33, 0.5, 0.66, 0.83] });
  const F = track.frame();
  const L = track.length;

  // ── Tablero, muros, balizas, costillas y pórticos ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x84827f))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xd6d2ca))),
    rib: srcMat('S6 | Ash concrete', (m) => m.color.setHex(0x5e5c59)),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x1f1f20)),
    edge: srcMat('S6 | Satin silver edges'),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.82, 0.55); m.emissiveIntensity = 2.0; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
    col: new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.35, metalness: 0.55 }),
    lit: new THREE.MeshStandardMaterial({ color: 0x1c1a16, emissive: 0xffe2b0, emissiveIntensity: 2.2 }),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [], col: [], lit: [] };
  const sweepSeg = (s0, s1, step, prof, closed, vScale = 20) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (s1 - s0) * r / rows; track.sample(s, F);
      const wv = track.wAt(s);
      prof.forEach(([x0, h], k) => { const x = x0 * wv; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), s / vScale); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  parts.deck.push(sweepSeg(0, L, 3, deckProf, true, 32));
  parts.guard.push(sweepSeg(0, L, 3, wallL, false), sweepSeg(0, L, 3, wallR, false));
  parts.frame.push(sweepSeg(0, L, 6, [[-3.2, -1.6], [3.2, -1.6], [2.2, -4.6], [-2.2, -4.6]], true));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  // filo de luz bajo el tablero (se lee la cinta flotando sobre el vacío)
  parts.lit.push(sweepSeg(0, L, 4, [[-15.0, -1.75], [-13.6, -1.75]], false), sweepSeg(0, L, 4, [[13.6, -1.75], [15.0, -1.75]], false));
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
  for (const sc of track.sectors) {
    const s = sc.s + (sc.id === 1 ? 6 : 0);
    for (const x of [-19, 19]) boxAt(s, x, 7, 1.6, 16, 1.6, parts.frame);
    boxAt(s, 0, 15.4, 40, 1.8, 2.2, parts.frame);
    boxAt(s, 0, 14.4, 34, 0.3, 2.3, parts.gate);
  }

  // ── Columnas sobre fragmentos: cada apoyo es un par en V que baja hasta una roca grande del anillo ──
  const anchors = [];   // [centro, radio]
  for (let s = 20; s < L; s += 78) {
    track.sample(s, F);
    const R = 26 + rnd() * 22;
    const c = F.pos.clone().addScaledVector(F.right, (rnd() - 0.5) * 18);
    c.y = RING_Y + 10 + (rnd() - 0.5) * 30;
    anchors.push([c, R]);
    const foot = c.clone().setY(c.y + R * 0.55);
    for (const sd of [-1, 1]) {
      const top = F.pos.clone().addScaledVector(F.right, sd * 8).addScaledVector(F.up, -4.2);
      const ft = foot.clone().addScaledVector(F.right, sd * R * 0.25);
      const len = top.distanceTo(ft), dir = top.clone().sub(ft).normalize();
      const leg = new THREE.CylinderGeometry(1.5, 2.8, len, 12, 1);
      leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      leg.translate((top.x + ft.x) / 2, (top.y + ft.y) / 2, (top.z + ft.z) / 2);
      parts.col.push(leg);
      const cap = new THREE.CylinderGeometry(2.4, 0.9, 1.2, 10); cap.translate(top.x, top.y - 0.3, top.z); parts.col.push(cap);
      const shoe = new THREE.CylinderGeometry(2.2, 3.2, 3.0, 12); shoe.translate(ft.x, ft.y, ft.z); parts.rib.push(shoe);
      // anilla de luz en la columna
      const ring = new THREE.TorusGeometry(1.4, 0.14, 6, 16); ring.rotateX(Math.PI / 2);
      ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      const rp = ft.clone().lerp(top, 0.35); ring.translate(rp.x, rp.y, rp.z); parts.lit.push(ring);
    }
  }
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck' && k !== 'lit';
    world.add(mesh);
  }

  // ── Fragmentos del anillo: hielo sucio y roca (instancias) ──
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02, flatShading: false });
  own.push(rockMat);
  const geoBig = [rockGeo(3, 1.3), rockGeo(3, 4.1), rockGeo(3, 7.7)], geoMid = [rockGeo(2, 2.2), rockGeo(2, 5.5)], geoSmall = [rockGeo(1, 3.3), rockGeo(1, 8.8)];
  [...geoBig, ...geoMid, ...geoSmall].forEach((gg) => own.push(gg));
  const ICE = [[0.86, 0.83, 0.77], [0.78, 0.74, 0.66], [0.66, 0.63, 0.58], [0.9, 0.88, 0.84], [0.55, 0.52, 0.48], [0.74, 0.7, 0.62]];
  const trackPts = []; for (let s = 0; s < L; s += 14) { track.sample(s, F); trackPts.push([F.pos.x, F.pos.y, F.pos.z]); }
  const nearTrack = (x, z) => { let d = Infinity, yy = 0; for (const [px, py, pz] of trackPts) { const q = (px - x) ** 2 + (pz - z) ** 2; if (q < d) { d = q; yy = py; } } return [Math.sqrt(d), yy]; };
  const spin = [];      // fragmentos grandes que giran lentamente
  const instanced = (geos, list, cast) => {
    const per = geos.map(() => []);
    list.forEach((it, i) => per[i % geos.length].push(it));
    geos.forEach((gg, k) => {
      const arr = per[k]; if (!arr.length) return;
      const im = new THREE.InstancedMesh(gg, rockMat, arr.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), col = new THREE.Color();
      arr.forEach(([p, r, rot], i) => {
        q.setFromEuler(e.set(rot[0], rot[1], rot[2]));
        m4.compose(p, q, sc.set(r, r * (0.8 + h2(p.x, p.z) * 0.4), r));
        im.setMatrixAt(i, m4);
        const c = ICE[Math.floor(h2(p.z * 1.3, p.x) * ICE.length)];
        im.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere();
      world.add(im);
    });
  };
  const rot3 = () => [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  // anclajes
  instanced(geoBig, anchors.map(([c, R]) => [c, R, rot3()]), true);
  // enjambre cercano bajo la pista y alrededor (capa fina)
  const mids = [], smalls = [], drifting = [];
  const R0 = rMax + 2600;
  for (let k = 0; k < 5200; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R0;
    const x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    const r = 3 + Math.pow(rnd(), 2.4) * 30;
    const [d, ty] = nearTrack(x, z);
    let yy = RING_Y + (rnd() - 0.5) * 50;
    if (d < 40 + r) yy = Math.min(yy, ty - 45 - r);
    mids.push([new THREE.Vector3(x, yy, z), r, rot3()]);
  }
  for (let k = 0; k < 7000; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (R0 + 2500);
    const x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    const r = 0.6 + Math.pow(rnd(), 3) * 5;
    smalls.push([new THREE.Vector3(x, RING_Y + (rnd() - 0.5) * 70, z), r, rot3()]);
  }
  // fragmentos sueltos a la altura de la pista, a distancia (el anillo tiene espesor)
  for (let k = 0; k < 90; k++) {
    const a = rnd() * Math.PI * 2, rr = rMax * 0.2 + rnd() * (rMax + 900);
    const x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    const [d, ty] = nearTrack(x, z);
    const r = 5 + rnd() * 22;
    if (d < 90 + r) continue;
    drifting.push([new THREE.Vector3(x, ty - 40 + rnd() * 110, z), r, rot3()]);
  }
  instanced(geoMid, mids.filter((m) => m[1] > 9), false);
  instanced(geoSmall, mids.filter((m) => m[1] <= 9), false);
  instanced(geoSmall, smalls, false);
  // los sueltos son mallas propias: giran despacio
  drifting.forEach(([p, r, rot], i) => {
    const m = new THREE.Mesh(geoMid[i % 2], rockMat.clone());
    const c = ICE[i % ICE.length]; m.material.color.setRGB(c[0], c[1], c[2]); own.push(m.material);
    m.position.copy(p); m.scale.set(r, r * 0.85, r); m.rotation.set(rot[0], rot[1], rot[2]); m.castShadow = true; m.receiveShadow = true;
    world.add(m); spin.push({ m, w: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.06), y0: p.y, ph: rnd() * 6.28 });
  });

  // ── Lámina de los anillos: anillo enorme centrado en Saturno, con las bandas (C, B, Cassini, A, Encke, F) ──
  const satC = centroid.clone().addScaledVector(SAT_DIR, SAT_D).setY(RING_Y - 8);
  const { tex: rTex, r0: rr0, r1: rr1 } = ringTexture();
  const ringMat = new THREE.MeshBasicMaterial({ map: rTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xc9c3b6, fog: false });
  own.push(ringMat, rTex);
  {
    const RS = 220, AS = 720, pos = [], uv = [], idx = [];
    for (let i = 0; i <= RS; i++) {
      const u = i / RS, r = (rr0 + (rr1 - rr0) * u) * RV;
      for (let j = 0; j <= AS; j++) { const a = j / AS * Math.PI * 2; pos.push(satC.x + Math.cos(a) * r, satC.y, satC.z + Math.sin(a) * r); uv.push(u, j / AS * 24); }
    }
    for (let i = 0; i < RS; i++) for (let j = 0; j < AS; j++) { const a = i * (AS + 1) + j, b = a + 1, c = a + AS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
    const ring = new THREE.Mesh(gg, ringMat); ring.frustumCulled = false; ring.renderOrder = -1; world.add(ring); own.push(gg);
  }
  // Saturno
  const satTex = saturnTexture(); own.push(satTex);
  const satMat = new THREE.MeshStandardMaterial({ map: satTex, roughness: 1, metalness: 0 }); own.push(satMat);
  const saturn = new THREE.Mesh(new THREE.SphereGeometry(SAT_R, 96, 64), satMat);
  saturn.scale.y = 0.9; saturn.position.copy(satC); saturn.rotation.z = 0.04; world.add(saturn); own.push(saturn.geometry);
  // estrellas
  {
    const n = 2400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.6 - 0.25, rnd() * 2 - 1).normalize().multiplyScalar(250000);
      pos.set([centroid.x + v.x, v.y, centroid.z + v.z], i * 3);
      const b = 0.4 + Math.pow(rnd(), 4) * 2.2; col.set([b, b * 0.97, b * 0.92], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const st = new THREE.Points(gg, sm); st.frustumCulled = false; st.renderOrder = -2; world.add(st); own.push(gg, sm);
  }

  // ── Animación: fragmentos sueltos que rotan y flotan ──
  const fx = {
    t: 0,
    update(dt) {
      this.t += dt;
      for (const s of spin) { s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt; s.m.position.y = s.y0 + Math.sin(this.t * 0.12 + s.ph) * 3; }
      saturn.rotation.y += dt * 0.002;
    },
  };

  // Intro: muy alto sobre el plano de los anillos (se ven las bandas curvándose hacia Saturno), picado hasta la parrilla
  track.sample(0, F); const grid = F.pos.clone();
  const side = new THREE.Vector3(-SAT_DIR.z, 0, SAT_DIR.x);
  const introKeys = () => [
    [0.0, centroid.clone().addScaledVector(SAT_DIR, -9000).addScaledVector(side, -4000).setY(5200), satC.clone().setY(RING_Y + 2500), 44],
    [4.2, centroid.clone().addScaledVector(SAT_DIR, -2600).addScaledVector(side, -1200).setY(1300), centroid.clone().addScaledVector(SAT_DIR, 3000).setY(RING_Y), 50],
    [7.4, centroid.clone().addScaledVector(SAT_DIR, -700).setY(260), grid.clone().setY(RING_Y + 40), 56],
    [9.5, grid.clone().addScaledVector(SAT_DIR, -180).setY(grid.y + 55), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] CASSINI-7: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · apoyos ${anchors.length} · fragmentos ${anchors.length + mids.length + smalls.length + drifting.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground, tunnel: false, introKeys, fx };
}
