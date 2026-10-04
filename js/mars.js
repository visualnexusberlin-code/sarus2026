// ─────────────────────────────────────────────────────────────
//  OLYMPUS-3 · Marte · borde de la caldera del Olympus Mons
//  Circuito generado (no viene del GLB): trazado digitalizado de la referencia,
//  cotas que siguen la montaña, dos saltos sobre grietas y un túnel dentro de una lengua de lava.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { lavaUniforms } from './atmosphere.js';

// Trazado de la referencia (píxeles de la imagen, sentido de carrera: salida → La Source → Eau Rouge → …)
const RAW = [[290, 715], [200, 773], [110, 833], [40, 875], [14, 886], [6, 870], [28, 832], [60, 760], [95, 690], [130, 648], [175, 610], [215, 568], [255, 520], [290, 470], [322, 440], [365, 420], [420, 405], [480, 355], [540, 305], [600, 262], [660, 240], [800, 190], [950, 135], [1070, 95], [1120, 75], [1155, 68], [1182, 80], [1205, 100], [1240, 100], [1290, 82], [1322, 86], [1360, 130], [1410, 180], [1450, 230], [1476, 268], [1474, 298], [1447, 306], [1415, 282], [1377, 242], [1340, 218], [1300, 224], [1200, 257], [1100, 285], [1020, 305], [970, 335], [952, 380], [955, 440], [985, 500], [1050, 530], [1150, 555], [1240, 578], [1280, 610], [1285, 650], [1275, 700], [1290, 735], [1340, 770], [1420, 810], [1445, 845], [1430, 880], [1390, 935], [1330, 965], [1250, 962], [1180, 935], [1120, 895], [1070, 820], [1030, 745], [990, 680], [960, 650], [880, 612], [760, 585], [680, 610], [560, 665], [450, 690], [392, 706], [376, 690], [368, 665], [352, 654], [336, 664], [312, 694]];
const IDX = { eauRouge: 12, raidillon: 15, kemmel: 22, combes: 27, bruxelles: 35, pouhon: 45, stavelot: 58, blanchimont: 66 };
const K = 1.75;                 // m por píxel → ≈ 8,9 km
const R_CALDERA = 9000;         // radio de la caldera (comprimida para que se lea desde la pista)
const MARS_R = 3389500;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }

// ── Trazado: píxeles → metros, curva cerrada, suavizado (radio mínimo) ──
function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const P = RAW.map(([x, y]) => new THREE.Vector3((x - cx) * K, 0, (y - cy) * K));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 4; pass++) {                           // suavizado circular ±32 m
    S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -4; k <= 4; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 9); });
  }
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const fOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return cum[b] / total; };
  const corner = {}; for (const [k, i] of Object.entries(IDX)) corner[k] = fOf(P[i]);
  return { S, cum, total, corner, P };
}

// Dirección del sol: al final de la recta de Kemmel, casi en el horizonte (atardecer azul marciano)
export function marsSunDir(elev = 0.075) {
  const { P } = layout();
  const d = P[IDX.kemmel + 1].clone().sub(P[IDX.kemmel - 2]).setY(0).normalize();
  return d.multiplyScalar(Math.cos(elev)).setY(Math.sin(elev)).normalize();
}

export function buildMars(def, { world, own, srcMat }) {
  const T0 = performance.now();
  const { S, cum, total, corner, P } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);

  // Caldera: el borde corre paralelo a la recta de Kemmel, a 130 m por el lado de fuera
  const kA = P[IDX.kemmel - 2], kB = P[IDX.kemmel + 1];
  const kMid = kA.clone().add(kB).multiplyScalar(0.5);
  const kDir = kB.clone().sub(kA).setY(0).normalize();
  let nOut = new THREE.Vector3(-kDir.z, 0, kDir.x);
  if (nOut.dot(kMid.clone().sub(centroid)) < 0) nOut.negate();
  const C = kMid.clone().addScaledVector(nOut, R_CALDERA + 130);

  // Lengua de lava sobre Stavelot → túnel; grietas bajo los dos saltos
  const spur = P[IDX.stavelot].clone().lerp(P[IDX.stavelot + 2], 0.5);
  const fAt = (f) => S[Math.round(((f % 1) + 1) % 1 * N) % N];
  const gapDefs = [[corner.kemmel + 0.004, 58], [corner.blanchimont - 0.012, 50]];   // [fracción, largo m]
  const trenches = gapDefs.map(([f, len]) => {
    const i = Math.round(f * N) % N, p = S[i], t = S[(i + 2) % N].clone().sub(S[(i - 2 + N) % N]).setY(0).normalize();
    return { p: p.clone().addScaledVector(t, len / 2), d: new THREE.Vector3(-t.z, 0, t.x) };
  });

  function base(x, z) {
    const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz), t = d - R_CALDERA;
    let h;
    if (t < 0) {                                           // pared y fondo de la caldera, con terrazas
      const u = Math.min(1, -t / 1300);
      h = -2500 * Math.pow(sstep(0, 1, u), 0.85) + 70 * Math.sin(u * 11) * u * (1 - u) * 4 - Math.max(0, -t - 1300) * 0.02;
    } else h = -0.17 * Math.min(t, 2500) - 0.09 * Math.max(0, t - 2500);
    h += 38 * Math.exp(-((t / 260) ** 2));                // labio del borde
    const ang = Math.atan2(dz, dx);
    h += 55 * (fbm(ang * 38, d * 0.0005, 4) - 0.5) * sstep(-300, 1800, t);   // coladas radiales
    h += 18 * (fbm(x * 0.0035, z * 0.0035, 4) - 0.5) + 5 * (fbm(x * 0.03, z * 0.03, 3) - 0.5);
    h -= d * d / (2 * MARS_R);                            // curvatura del planeta
    return h;
  }
  const bumpAt = (x, z) => 250 * Math.exp(-(((x - spur.x) ** 2 + (z - spur.z) ** 2) / (230 * 230)));
  const trenchAt = (x, z) => {
    let h = 0;
    for (const tr of trenches) {
      const vx = x - tr.p.x, vz = z - tr.p.z, along = vx * tr.d.x + vz * tr.d.z;
      const across = Math.abs(vx * tr.d.z - vz * tr.d.x);
      h -= 330 * (1 - sstep(22, 95, across)) * (1 - sstep(500, 900, Math.abs(along)));
    }
    return h;
  };
  const full = (x, z) => base(x, z) + bumpAt(x, z) + trenchAt(x, z);

  // ── Cotas de la pista: siguen la montaña (suavizada) + holgura + rasgos ──
  const hb = S.map((p) => base(p.x, p.z));
  let hs = hb.map((_, i) => { let a = 0; for (let k = -15; k <= 15; k++) a += hb[(i + k + N) % N]; return a / 31; });
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  const feat = (f) => -32 * g(f, corner.eauRouge, 60) + 42 * g(f, corner.raidillon, 75) + 30 * g(f, corner.kemmel, 110)
    + 18 * g(f, corner.combes, 150) + 24 * g(f, corner.blanchimont - 0.014, 90) + 30 * g(f, (corner.kemmel + corner.raidillon) / 2, 400);
  let y = S.map((p, i) => hs[i] + 58 + feat(cum[i] / total));
  const lim = 0.42 * 8;                                    // pendiente máxima ~42 %
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - lim), y[i - 1] + lim);
    for (let i = N - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - lim), y[i + 1] + lim);
  }
  y = y.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += y[(i + k + N) % N]; return Math.max(a / 7, hb[i] + 24); });

  // ── Pista ──
  const pts = [];
  for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.14, 0.3, 0.47, 0.64, 0.8] });
  // saltos en s de la pista
  track.gaps = gapDefs.map(([f, len]) => { const s0 = track.project(fAt(f).clone().setY(y[Math.round(f * N) % N])).s; return { s0, s1: s0 + len }; });
  const inGap = (s) => track.gapAt(s) >= 0;

  // túnel: tramo donde la lengua de lava queda por encima del tablero
  let run = null, cur = null;
  const F = track.frame();
  for (let s = 0; s < track.length; s += 6) {
    track.sample(s, F);
    const over = full(F.pos.x, F.pos.z) - F.pos.y > 22;
    if (over && !cur) cur = { s0: s, s1: s }; else if (over) cur.s1 = s;
    if (!over && cur) { if (!run || cur.s1 - cur.s0 > run.s1 - run.s0) run = cur; cur = null; }
  }
  const tunnel = run ? { s: run.s0 - 30, len: Math.max(160, run.s1 - run.s0 + 60) } : null;
  const inTunnel = (s) => tunnel && ((track.delta(tunnel.s, s) >= -4) && (track.delta(tunnel.s, s) <= tunnel.len + 4));

  // Suelo final: lo que sigue a la pista se talla (trinchera bajo el tablero, techo sobre el túnel)
  const loc = {}, _p = new THREE.Vector3();
  const ground = (x, z) => {
    let h = full(x, z);
    track.locate(_p.set(x, h, z), loc);
    if (loc.far || loc.dist > 240) return h;
    if (inTunnel(loc.s)) { const w = 1 - sstep(38, 120, loc.dist); h = Math.max(h, lerp(h, loc.deckY + 34, w)); }
    else { const floor = loc.deckY - (inGap(loc.s) ? 260 : 24); const w = 1 - sstep(40, 170, loc.dist); if (h > floor) h = lerp(h, floor, w); }
    return h;
  };

  // ── Tablero, muros, balizas, guías, costillas y pilares ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x8a8480))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xb9b0a8))),
    rib: srcMat('S6 | Ash concrete', (m) => m.color.setHex(0x5b4f49)),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x2a2522)),
    edge: srcMat('S6 | Satin silver edges'),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.55, 0.22); m.emissiveIntensity = 2.0; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
    lit: new THREE.MeshStandardMaterial({ color: 0x221a14, emissive: 0xff8a3c, emissiveIntensity: 2.4 }),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [], lit: [] };

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
  // tramos continuos de tablero (cortados en los saltos)
  const spans = [];
  {
    const L = track.length, cuts = [...track.gaps].sort((p, q) => p.s0 - q.s0);
    if (!cuts.length) spans.push([0, L]);
    else cuts.forEach((c, i) => { const nx = cuts[(i + 1) % cuts.length]; spans.push([c.s1, nx.s0 + (i === cuts.length - 1 ? L : 0)]); });
  }
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  const spine = [[-3.2, -1.6], [3.2, -1.6], [2.2, -4.6], [-2.2, -4.6]];
  for (const [a, b] of spans) {
    parts.deck.push(sweepSeg(a, b, 3, deckProf, true, 32));
    parts.guard.push(sweepSeg(a, b, 3, wallL, false), sweepSeg(a, b, 3, wallR, false));
    parts.frame.push(sweepSeg(a, b, 6, spine, true));
    parts.edge.push(sweepSeg(a, b, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(a, b, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  }
  const boxAt = (s, x0, h, w, hh, d, list) => {
    track.sample(s, F);
    const x = Math.abs(x0) > 10 ? x0 * track.wAt(s) : x0;
    const bx = new THREE.BoxGeometry(w, hh, d);
    const mtx = new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan);
    bx.applyMatrix4(mtx); bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx);
  };
  for (let s = 5; s < track.length; s += 24) if (!inGap(s)) for (const x of [-16.2, 16.2]) boxAt(s, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let s = 0; s < track.length; s += 14) if (!inGap(s)) boxAt(s, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (let s = 0; s < track.length; s += 12) if (!inGap(s)) boxAt(s, 0, -2.0, 30, 0.8, 1.3, parts.rib);
  // bordes de los saltos: fin de tablero con tira luminosa
  for (const gp of track.gaps) for (const s of [gp.s0 - 0.4, gp.s1 + 0.4]) boxAt(s, 0, 0.2, 33, 0.4, 0.8, parts.lit);
  // pilares en V hasta el suelo (si el suelo está a menos de 900 m)
  const pyl = [];
  for (let s = 40; s < track.length; s += 96) {
    if (inGap(s) || inGap(s + 30) || inGap(s - 30) || inTunnel(s)) continue;
    track.sample(s, F);
    for (const sd of [-1, 1]) {
      const top = F.pos.clone().addScaledVector(F.right, sd * 5).addScaledVector(F.up, -4.2);
      const foot = F.pos.clone().addScaledVector(F.right, sd * 16); foot.y = ground(foot.x, foot.z) - 3;
      const hgt = top.y - foot.y;
      if (hgt < 6 || hgt > 900) continue;
      const leg = new THREE.CylinderGeometry(1.1, 1.9, hgt, 10, 1);
      const dir = top.clone().sub(foot).normalize();
      leg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      leg.translate((top.x + foot.x) / 2, (top.y + foot.y) / 2, (top.z + foot.z) / 2);
      pyl.push(leg);
      const ft = new THREE.CylinderGeometry(4, 5, 4, 12); ft.translate(foot.x, foot.y + 1, foot.z); pyl.push(ft);
    }
  }
  parts.rib.push(...pyl);
  // pórticos de sector
  for (const sc of track.sectors) {
    const s = sc.s + (sc.id === 1 ? 6 : 0);
    if (inGap(s) || inTunnel(s)) continue;
    for (const x of [-19, 19]) boxAt(s, x, 7, 1.6, 16, 1.6, parts.frame);
    boxAt(s, 0, 15.4, 40, 1.8, 2.2, parts.frame);
    boxAt(s, 0, 14.4, 34, 0.3, 2.3, parts.gate);
  }

  // aTrack (pintura, bordillos, ola de luz) y fusión
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const norm = list.map((gg) => { const n = gg.index ? gg : gg; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); if (!n.index) n.setIndex([...Array(n.attributes.position.count).keys()]); return n; });
    let merged = mergeGeometries(norm, false);
    norm.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]);
    mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh);
  }

  // ── Terreno: parche cercano tallado, anillo medio y disco lejano ──
  const tmat = marsTerrainMaterial(); own.push(tmat);
  const bb = new THREE.Box3().setFromPoints(S);
  const near = { x0: bb.min.x - 1100, x1: bb.max.x + 1100, z0: bb.min.z - 1100, z1: bb.max.z + 1100 };
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
  const inNear = (x, z, m = 0) => x > near.x0 + m && x < near.x1 - m && z > near.z0 + m && z < near.z1 - m;
  const cx = (near.x0 + near.x1) / 2, cz = (near.z0 + near.z1) / 2;
  // bocas del túnel: sin terreno sobre el pasillo de la pista (el campo de alturas no admite voladizos)
  const portals = tunnel ? [tunnel.s, tunnel.s + tunnel.len].map((s) => { track.sample(s, F); return F.pos.clone(); }) : [];
  const lcP = {}, pP = new THREE.Vector3();
  const portalSkip = (x, z) => {
    if (!portals.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < 75 * 75)) return false;
    track.locate(pP.set(x, 0, z), lcP); if (lcP.far || lcP.dist > 26) return false;
    const d = track.delta(tunnel.s, lcP.s);
    return (d > -24 && d < 16) || (d > tunnel.len - 16 && d < tunnel.len + 24);
  };
  const geoNear = grid(near.x0, near.x1, near.z0, near.z1, 18, ground, portalSkip);
  // fachada de roca con el arco abierto en cada boca
  if (tunnel) {
    const outer = [[-23, -1.5], [-23, 10], [-18, 16], [-7, 18.5], [7, 18.5], [18, 16], [23, 10], [23, -1.5]];
    for (const [s, sgn] of [[tunnel.s - 3, -1], [tunnel.s + tunnel.len + 3, 1]]) {
      const sh = new THREE.Shape([new THREE.Vector2(-70, -30), new THREE.Vector2(70, -30), new THREE.Vector2(70, 52), new THREE.Vector2(-70, 52)]);
      sh.holes.push(new THREE.Path(outer.map(([x, h]) => new THREE.Vector2(x * 0.97, h * 0.97)).reverse()));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 22, bevelEnabled: false, curveSegments: 4 });
      g.translate(0, 0, sgn > 0 ? 0 : -22);
      track.sample(s, F);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
      g.translate(F.pos.x, F.pos.y, F.pos.z);
      g.computeVertexNormals();
      const fm = new THREE.Mesh(g, tmat); fm.receiveShadow = true; world.add(fm);
    }
  }
  const MID = 22000;
  const geoMid = grid(cx - MID, cx + MID, cz - MID, cz + MID, 170, (x, z) => full(x, z) - (inNear(x, z, -400) ? 6 : 0), (x, z) => inNear(x, z, 170));
  // disco lejano (anillos polares)
  const far = (() => {
    const rings = 70, segs = 180, r0 = MID * 0.96, r1 = 260000, pos = [], idx = [];
    for (let i = 0; i <= rings; i++) {
      const r = r0 * Math.pow(r1 / r0, i / rings);
      for (let j = 0; j <= segs; j++) { const a = j / segs * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pos.push(x, full(x, z) - 25, z); }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + 1, c = a + segs + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  })();
  for (const gg of [geoNear, geoMid, far]) { const m = new THREE.Mesh(gg, tmat); m.receiveShadow = gg === geoNear; m.frustumCulled = gg === geoNear; world.add(m); }

  // ── Rocas oscuras sueltas (como en la referencia) ──
  {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 0.75 + 0.5 * h2(v.x * 3.1 + 7, v.z * 2.3 + v.y); p.setXYZ(i, v.x * k * 1.3, v.y * k * 0.7, v.z * k); } rockGeo.computeVertexNormals(); }
    const rmat = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.92, flatShading: true }); own.push(rmat, rockGeo);
    const n = 2600, im = new THREE.InstancedMesh(rockGeo, rmat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), lc = {};
    let k = 0, tries = 0;
    while (k < n && tries < n * 6) {
      tries++;
      const x = near.x0 + Math.random() * (near.x1 - near.x0), z = near.z0 + Math.random() * (near.z1 - near.z0);
      track.locate(ps.set(x, 0, z), lc);
      if (!lc.far && lc.dist < 45) continue;
      if (fbm(x * 0.004, z * 0.004, 2) < 0.42) continue;          // en campos, no uniformes
      const s = 0.8 + Math.pow(Math.random(), 3) * 9;
      ps.set(x, ground(x, z) - s * 0.25, z);
      q.setFromEuler(new THREE.Euler(Math.random() * 0.4, Math.random() * 6.28, Math.random() * 0.4));
      m4.compose(ps, q, sc.set(s, s, s)); im.setMatrixAt(k++, m4);
    }
    im.count = k; im.receiveShadow = true; im.castShadow = false; im.computeBoundingSphere();
    world.add(im);
  }

  // ── Viento: velos de polvo y remolinos ──
  const dust = new MarsDust(world, track, ground, nOut);

  // Intro: sube desde el abismo de la caldera, asoma al borde y vuela sobre el trazado
  const nIn = nOut.clone().negate();
  const introKeys = (at) => [
    [0.0, kMid.clone().addScaledVector(nOut, 2900).setY(-1650), kMid.clone().setY(60), 48],
    [4.2, kMid.clone().addScaledVector(nOut, 1500).setY(-520), kMid.clone().setY(120), 52],
    [7.4, kMid.clone().addScaledVector(nOut, 260).setY(340), kMid.clone().addScaledVector(kDir, -700).setY(40), 58],
    [9.5, centroid.clone().add(new THREE.Vector3(0, 720, 0)).addScaledVector(nIn, 600), S[0].clone().setY(y[0]), 60],
  ];

  console.info(`[SRS] OLYMPUS-3: ${track.length.toFixed(0)} m · cota ${Math.min(...y).toFixed(0)}…${Math.max(...y).toFixed(0)} m · túnel ${tunnel ? tunnel.len.toFixed(0) + ' m' : 'no'} · saltos ${track.gaps.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground, tunnel, introKeys, fx: dust };
}

// ── Regolito marciano: polvo óxido, basalto oscuro en coladas, estratos en paredes, vetas de viento ──
function marsTerrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMW;\nvarying vec3 vMN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvMN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMW; varying vec3 vMN;
        float mh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float mn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mh(i), mh(i+vec2(1,0)), f.x), mix(mh(i+vec2(0,1)), mh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 P = vMW; float up = normalize(vMN).y;
          float n1 = mn(P.xz * 0.0015), n2 = mn(P.xz * 0.012), n3 = mn(P.xz * 0.09);
          vec3 dust = vec3(0.58, 0.27, 0.14), rust = vec3(0.4, 0.15, 0.07), basalt = vec3(0.12, 0.075, 0.06);
          vec3 c = mix(rust, dust, smoothstep(0.3, 0.8, n1 * 0.6 + n2 * 0.25 + up * 0.25));
          // coladas: bandas alargadas, no manchas
          float flows = smoothstep(0.6, 0.72, mn(vec2(dot(P.xz, vec2(0.8, 0.6)) * 0.0011, dot(P.xz, vec2(-0.6, 0.8)) * 0.0045) + vec2(n2 * 0.8)));
          c = mix(c, basalt * 1.3, flows * 0.6);
          float strata = mn(vec2(P.y * 0.07, (P.x + P.z) * 0.002));
          float steep = 1.0 - smoothstep(0.55, 0.85, up);
          c = mix(c, mix(basalt, rust * 0.7, strata), steep * 0.85);
          // grava oscura y vetas de viento
          vec2 gc = P.xz * 0.35; float grit = step(0.88, mh(floor(gc))) * (1.0 - smoothstep(0.12, 0.2, length(fract(gc) - 0.5)));
          c = mix(c, basalt, grit * 0.55 * smoothstep(0.7, 0.9, up));
          float streak = mn(vec2(dot(P.xz, vec2(0.96, 0.28)) * 0.0009, dot(P.xz, vec2(-0.28, 0.96)) * 0.012));
          c *= 0.78 + 0.34 * streak;
          c *= 0.8 + 0.3 * n3;
          diffuseColor.rgb = c;
        }`);
  };
  return m;
}

// ── Polvo en suspensión arrastrado por el viento (velos grandes cerca de la cámara) + remolinos lejanos ──
export class MarsDust {
  constructor(parent, track, ground, windDir) {
    this.wind = new THREE.Vector3(windDir.z, 0, -windDir.x).multiplyScalar(26).add(new THREE.Vector3(0, 1.5, 0));
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const img = g.createImageData(128, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const dx = (x - 64) / 64, dy = (y - 64) / 64, r = Math.hypot(dx, dy);
        const n = fbm(x * 0.06, y * 0.06, 4);
        const a = Math.max(0, 1 - r) ** 1.6 * (0.45 + n * 0.9);
        const i = (y * 128 + x) * 4; img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255);
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); return t;
    })();
    this.count = 140; this.box = 700;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(0.6, 0.4, 0.3) }, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */`
        #include <common>
        #include <fog_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aDust; varying vec2 vUv; varying float vA;
        void main(){
          vUv = uv; vA = aDust.w;
          vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 transformed = aDust.xyz + (camR * position.x + camU * position.y * 0.55) * (aDust.w > 0.0 ? 1.0 : 0.0) * uvScale();
          vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`.replace('uvScale()', 'SIZE'),
      fragmentShader: /* glsl */`
        #include <common>
        #include <fog_pars_fragment>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vA;
        void main(){
          #include <logdepthbuf_fragment>
          float a = texture2D(uMap, vUv).a * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
          #include <fog_fragment>
        }`,
    });
    this.mat.vertexShader = this.mat.vertexShader.replace('SIZE', '240.0');
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(this.count * 4), 4);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index; ig.setAttribute('position', geo.attributes.position); ig.setAttribute('uv', geo.attributes.uv); ig.setAttribute('aDust', this.attr); ig.instanceCount = this.count;
    this.mesh = new THREE.Mesh(ig, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    parent.add(this.mesh);
    this.seeded = false;
    // remolinos de polvo en la ladera (columnas que giran)
    this.devils = [];
    const dmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: { uTime: lavaUniforms.uTime, uColor: { value: new THREE.Color(0.7, 0.47, 0.33) }, ...THREE.UniformsLib.fog },
      vertexShader: `#include <common>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; vec3 transformed = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;\n#include <logdepthbuf_vertex>\n#include <fog_vertex>\n}`,
      fragmentShader: `#include <common>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\nuniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        float dh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float dn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(dh(i), dh(i+vec2(1,0)), f.x), mix(dh(i+vec2(0,1)), dh(i+vec2(1,1)), f.x), f.y); }
        void main(){
          #include <logdepthbuf_fragment>
          float n = dn(vec2(vUv.x * 10.0 + vUv.y * 6.0 - uTime * 1.8, vUv.y * 5.0 - uTime * 0.6));
          float a = (0.25 + 0.75 * n) * smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y)) * 0.32;
          gl_FragColor = vec4(uColor * (0.8 + 0.3 * n), a);
          #include <fog_fragment>
        }`,
    });
    const F = track.frame();
    const spots = [[0.2, -1, 1400], [0.55, 1, 2100], [0.72, 1, 1700], [0.9, -1, 2600]];
    for (let i = 0; i < 16; i++) spots.push([(i + 0.5) / 16 + (Math.random() - 0.5) * 0.03, i % 2 ? 1 : -1, 160 + Math.random() * 520, true]);   // remolinos cercanos, a la vista desde la pista
    spots.forEach(([f, side, off, small]) => {
      track.sample(f * track.length, F);
      const p = F.pos.clone().addScaledVector(F.right, side * off);
      const h = small ? 160 + Math.random() * 280 : 900 + Math.random() * 500;
      const cone = small ? new THREE.CylinderGeometry(26 + Math.random() * 18, 6, h, 18, 6, true) : new THREE.CylinderGeometry(90, 18, h, 24, 8, true); cone.translate(0, h / 2, 0);
      const m = new THREE.Mesh(cone, dmat); m.position.set(p.x, ground(p.x, p.z) - 10, p.z);
      m.userData = { base: m.position.clone(), ph: Math.random() * 6.28, r: small ? 40 + Math.random() * 60 : 0, spin: small ? 1.4 + Math.random() : 0.8 };
      parent.add(m); this.devils.push(m);
    });
  }
  update(dt, cam) {
    const a = this.attr.array, B = this.box, hb = B / 2, c = cam.position;
    for (let i = 0; i < this.count; i++) {
      let x = a[i * 4], y = a[i * 4 + 1], z = a[i * 4 + 2];
      if (!this.seeded) { x = c.x + (Math.random() - 0.5) * B; y = c.y + (Math.random() - 0.4) * 160; z = c.z + (Math.random() - 0.5) * B; a[i * 4 + 3] = 0.025 + Math.random() * 0.05; }
      x += this.wind.x * dt; y += this.wind.y * dt * 0.2; z += this.wind.z * dt;
      if (x < c.x - hb) x += B; else if (x > c.x + hb) x -= B;
      if (z < c.z - hb) z += B; else if (z > c.z + hb) z -= B;
      if (y < c.y - 90) y += 180; else if (y > c.y + 90) y -= 180;
      a[i * 4] = x; a[i * 4 + 1] = y; a[i * 4 + 2] = z;
    }
    this.seeded = true;
    this.attr.needsUpdate = true;
    this.t = (this.t || 0) + dt;
    for (const d of this.devils) { const u = d.userData; d.rotation.y += dt * u.spin; if (u.r) { d.position.x = u.base.x + Math.sin(this.t * 0.11 + u.ph) * u.r; d.position.z = u.base.z + Math.cos(this.t * 0.09 + u.ph) * u.r; d.scale.x = d.scale.z = 1 + 0.15 * Math.sin(this.t * 0.7 + u.ph); } }
  }
}
