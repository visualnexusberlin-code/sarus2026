// TIPHARES: Venus, sobre el mar de nubes al atardecer. Trazado inspirado en el autódromo Oscar y Juan Gálvez
// (Buenos Aires). La pista se despliega sobre una cadena de plataformas flotantes de nácar y oro con jardines;
// en el gran espacio interior del trazado (donde estaría el lago) flota la ciudadela Tiphares: un loto metálico
// de pétalos curvos, con una cúpula de cristal llena de agujas y un tallo de discos que se hunde en las nubes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';

// Trazado (px del recorte del plano), recta de meta hacia +x
const RAW = [[350, 183], [500, 172], [650, 158], [710, 155], [738, 175], [745, 205], [765, 215], [800, 190], [860, 130], [920, 90], [980, 62], [1020, 58], [1035, 80], [1020, 105], [960, 130], [900, 170], [875, 200], [900, 225], [960, 215], [1100, 170], [1250, 115], [1380, 72], [1450, 75], [1540, 150], [1585, 260], [1560, 370], [1480, 400], [1250, 435], [1000, 470], [800, 495], [700, 500], [670, 490], [640, 510], [580, 505], [450, 420], [300, 300], [180, 200], [95, 125], [100, 105], [130, 108], [230, 150]];
const IDX = { curva1: 5, reutemann: 11, ciervo: 16, lago: 20, salotto: 24, km: 28, ascari: 31, larga: 37 };
const CITADEL_PX = [1150, 300];       // centro del lago
const K = 1.6;                        // ≈ 6,1 km
const CLOUD_Y = -320;                 // techo del mar de nubes

const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
let _seed = 23;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const toW = ([x, y]) => new THREE.Vector3((x - cx) * K, 0, (y - cy) * K);
  const P = RAW.map(toW);
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 4; pass++) S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -4; k <= 4; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 9); });
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const fOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return cum[b] / total; };
  const corner = {}; for (const [k, i] of Object.entries(IDX)) corner[k] = fOf(P[i]);
  return { S, cum, total, corner, P, citadel: toW(CITADEL_PX) };
}

// Sol bajo, detrás de la ciudadela vista desde la recta de meta
export function tipharesSunDir() { return new THREE.Vector3(0.62, 0.11, 0.78).normalize(); }

const MAT = () => ({
  pearl: new THREE.MeshStandardMaterial({ color: 0xf2e9df, roughness: 0.22, metalness: 0.55, side: THREE.DoubleSide }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a75e, roughness: 0.28, metalness: 1.0, side: THREE.DoubleSide }),
  silver: new THREE.MeshStandardMaterial({ color: 0xdcdcdf, roughness: 0.16, metalness: 1.0, side: THREE.DoubleSide }),
  garden: new THREE.MeshStandardMaterial({ color: 0x5c6a2c, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
  vine: new THREE.MeshStandardMaterial({ color: 0x4a5a24, roughness: 0.95, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xffeee4, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  light: new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffd6a0, emissiveIntensity: 2.4, side: THREE.DoubleSide }),
  beam: new THREE.MeshBasicMaterial({ color: 0xfff1dc, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
});

// Mar de nubes: lámina con relieve de fbm, rosada y dorada, que se mueve despacio (cumulus vistos desde arriba)
function cloudSeaMaterial(uniforms, sun) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    const hdr = `uniform float uTime;
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(ch(i), ch(i+vec2(1,0)), f.x), mix(ch(i+vec2(0,1)), ch(i+vec2(1,1)), f.x), f.y); }
      float cf(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += cn(p) * w; p = p * 2.07 + 1.3; w *= 0.5; } return a; }`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vCW;\n${hdr}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
        vec2 q = wp0.xz * 0.0011 + vec2(uTime * 0.004, uTime * 0.0015);
        float hgt = pow(cf(q), 1.6) * 260.0;
        transformed.y += hgt; vCW = wp0.xyz + vec3(0.0, hgt, 0.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vCW;\n${hdr}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 q = vCW.xz * 0.0011 + vec2(uTime * 0.004, uTime * 0.0015);
          float e = 2.0;
          float hx = pow(cf(q + vec2(0.01, 0.0)), 1.6) - pow(cf(q - vec2(0.01, 0.0)), 1.6);
          float hz = pow(cf(q + vec2(0.0, 0.01)), 1.6) - pow(cf(q - vec2(0.0, 0.01)), 1.6);
          vec3 nrm = normalize(vec3(-hx * 26.0, 1.0, -hz * 26.0));
          float lit = clamp(dot(nrm, normalize(vec3(${sun.x.toFixed(3)}, ${Math.max(0.25, sun.y).toFixed(3)}, ${sun.z.toFixed(3)}))), 0.0, 1.0);
          float top = smoothstep(${(CLOUD_Y + 20).toFixed(1)}, ${(CLOUD_Y + 240).toFixed(1)}, vCW.y);
          vec3 shade = mix(vec3(0.62, 0.38, 0.4), vec3(0.98, 0.72, 0.56), lit);
          shade = mix(shade * 0.75, shade, top);
          shade += vec3(1.0, 0.82, 0.6) * pow(lit, 6.0) * 0.35 * top;
          diffuseColor.rgb = shade;
        }`)
      .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.55;');
  };
  m.customProgramCacheKey = () => 'tipharesClouds';
  return m;
}

const lathe = (pts, segs = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segs);

// Pétalo curvo: lámina con sección en V que se abre y se curva hacia fuera y arriba (como una hoja de loto metálica)
function petalGeo(len, wid, lift, curl) {
  const NU = 26, NV = 7, pos = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const w = wid * Math.sin(Math.PI * Math.pow(u, 0.8)) * (1 - 0.15 * u);
    const x = len * u, y = lift * Math.pow(u, 1.8) + curl * Math.sin(u * Math.PI) * 0.2;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV * 2 - 1;
      pos.push(x - Math.abs(v) * w * 0.15 * u, y + Math.abs(v) * w * 0.35, v * w);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Ciudadela Tiphares
function buildCitadel(scale = 1) {
  const s = scale, parts = { pearl: [], gold: [], silver: [], garden: [], glass: [], light: [] };
  const add = (k, g) => parts[k].push(g);
  // tallo de discos que se hunde en las nubes (de ancho a estrecho)
  let y = 0;
  for (let i = 0; i < 14; i++) {
    const r = (150 - i * 9.5) * s * (i % 3 === 0 ? 1.12 : 1), t = (6 + (i % 2) * 3) * s;
    add(i % 3 === 0 ? 'gold' : 'pearl', lathe([[0, y - t], [r * 0.92, y - t], [r, y - t * 0.4], [r * 0.97, y], [0, y]]));
    if (i % 3 === 0) add('light', lathe([[r * 1.005, y - t * 0.7], [r * 1.005, y - t * 0.4]]));
    y -= t + (8 + i * 1.5) * s;
  }
  add('silver', lathe([[22 * s, 0], [18 * s, y * 0.6], [6 * s, y - 40 * s], [0, y - 90 * s]], 24));
  // plataforma principal: terrazas con jardín
  add('pearl', lathe([[0, -10 * s], [210 * s, -10 * s], [228 * s, 0], [222 * s, 6 * s], [0, 6 * s]], 72));
  add('gold', lathe([[229 * s, -2 * s], [231 * s, 3 * s]], 72));
  add('garden', lathe([[150 * s, 6.2 * s], [205 * s, 6.2 * s], [200 * s, 9 * s], [160 * s, 10 * s]], 72));
  add('pearl', lathe([[0, 6 * s], [150 * s, 6 * s], [148 * s, 18 * s], [0, 18 * s]], 64));
  add('light', lathe([[150.6 * s, 10 * s], [150.6 * s, 12 * s]], 64));
  add('pearl', lathe([[0, 18 * s], [120 * s, 18 * s], [118 * s, 32 * s], [0, 32 * s]], 64));
  // pétalos: dos coronas, la exterior más larga y abierta
  for (const [n, len, wid, lift, rot0, base] of [[10, 260, 58, 150, 0, 120], [10, 180, 44, 190, Math.PI / 10, 95], [8, 110, 30, 170, 0.2, 70]]) {
    for (let i = 0; i < n; i++) {
      const g = petalGeo(len * s, wid * s, lift * s, 1);
      g.translate(base * s, 24 * s, 0);
      g.rotateY(rot0 + i / n * Math.PI * 2);
      add(i % 2 ? 'silver' : 'pearl', g);
      // nervio dorado
      const rib = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map((u) => new THREE.Vector3(base * s + len * s * u, 24 * s + lift * s * Math.pow(u, 1.8) + 2 * s, 0))), 16, 1.6 * s, 6);
      rib.rotateY(rot0 + i / n * Math.PI * 2); add('gold', rib);
    }
  }
  // cúpula de cristal con agujas dentro
  const R = 112 * s;
  // perfil: elipse alta, abierta arriba hacia la aguja
  const dp = []; for (let i = 0; i <= 28; i++) { const a = -Math.PI / 2 + i / 28 * Math.PI * 0.94; dp.push([Math.cos(a) * R, 32 * s + R * 1.45 * (Math.sin(a) + 1) * 0.95]); }
  add('glass', lathe(dp, 64));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = new THREE.TorusGeometry(R * 0.995, 0.8 * s, 6, 64, Math.PI); c.rotateY(a); c.rotateZ(Math.PI / 2); c.scale(1, 1.38, 1); c.translate(0, 32 * s + R * 1.38, 0); add('gold', c); }
  // agujas góticas
  for (let k = 0; k < 70; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.pow(rnd(), 0.8) * R * 0.85, h = (40 + (1 - rr / R) * 190 + rnd() * 40) * s, w = (3 + rnd() * 6) * s;
    const g = new THREE.ConeGeometry(w, h, 6); g.translate(Math.cos(a) * rr, 32 * s + h / 2, Math.sin(a) * rr); add(k % 4 ? 'pearl' : 'silver', g);
  }
  { const g = new THREE.ConeGeometry(14 * s, 290 * s, 8); g.translate(0, 32 * s + 145 * s, 0); add('silver', g); }
  { const g = new THREE.CylinderGeometry(2.2 * s, 2.2 * s, 260 * s, 8); g.translate(0, 32 * s + R * 2.7 + 130 * s, 0); add('silver', g); }
  const grp = new THREE.Group();
  const M = MAT();
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const g = mergeGeometries(list.map((x) => { x.deleteAttribute('uv'); if (!x.index) x.setIndex([...Array(x.attributes.position.count).keys()]); return x; }), false);
    const m = new THREE.Mesh(g, M[k]); m.castShadow = k !== 'glass' && k !== 'light'; m.receiveShadow = true; if (k === 'glass') m.renderOrder = 2; grp.add(m);
  }
  // haz de luz vertical
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(9 * s, 9 * s, 6000, 16, 1, true), M.beam); beam.position.y = 32 * s + 3000; grp.add(beam);
  const beam2 = new THREE.Mesh(new THREE.CylinderGeometry(26 * s, 26 * s, 6000, 16, 1, true), M.beam.clone()); beam2.material.opacity = 0.08; beam2.position.y = 32 * s + 3000; grp.add(beam2);
  grp.userData.mats = M;
  return grp;
}

// Torre-jardín: aguja con discos escalonados, ramas, enredaderas colgantes (fondo y media distancia)
function towerGeos(s) {
  const P = { pearl: [], gold: [], garden: [], vine: [], light: [] };
  const H = (120 + rnd() * 160) * s;
  P.pearl.push(lathe([[3 * s, -H * 0.6], [7 * s, -H * 0.2], [5 * s, H * 0.6], [1.5 * s, H]], 12));
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const y = -H * 0.35 + i * H * 0.28, r = (30 - i * 5 + rnd() * 10) * s;
    P.pearl.push(lathe([[0, y - 3 * s], [r * 0.6, y - 3.5 * s], [r, y], [r * 0.98, y + 1.6 * s], [0, y + 1.6 * s]], 32));
    P.gold.push(lathe([[r * 1.01, y - 0.2 * s], [r * 1.01, y + 0.8 * s]], 32));
    if (i < 2) P.garden.push(lathe([[r * 0.45, y + 1.7 * s], [r * 0.9, y + 1.7 * s], [r * 0.8, y + 5 * s], [r * 0.5, y + 6 * s]], 24));
    if (i === n - 1) P.light.push(lathe([[r * 0.3, y + 1.8 * s], [r * 0.3, y + 3 * s]], 16));
    for (let k = 0; k < 7; k++) { const a = rnd() * Math.PI * 2, len = (10 + rnd() * 40) * s; const g = new THREE.CylinderGeometry(0.5 * s, 0.25 * s, len, 4); g.translate(Math.cos(a) * r * 0.95, y - len / 2, Math.sin(a) * r * 0.95); P.vine.push(g); }
  }
  return P;
}

export function buildTiphares(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 23;
  const { S, cum, total, corner, P, citadel } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
  let rMax = 0; for (const p of S) rMax = Math.max(rMax, Math.hypot(p.x - centroid.x, p.z - centroid.z));

  // ── Cotas: ondulación suave, sube en Reutemann y en el curvón; baja en la recta del kilómetro ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  let y = S.map((_, i) => { const f = cum[i] / total; return 10 + 16 * g(f, corner.reutemann, 360) + 12 * g(f, corner.salotto, 500) - 10 * g(f, corner.km, 600) + 8 * g(f, corner.larga, 300) - 6 * g(f, corner.ciervo, 200); });
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -4; k <= 4; k++) a += y[(i + k + N) % N]; return a / 9; });
  const ground = () => CLOUD_Y;

  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.15, 0.31, 0.48, 0.64, 0.8] });
  const F = track.frame();
  const L = track.length;

  // ── Tablero (nácar y oro) ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x8e8682))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xf0e6da))),
    rib: srcMat('S6 | Ash concrete', (m) => m.color.setHex(0xd8cbbd)),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0xe9e0d4)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xd9a75e)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.8, 0.55); m.emissiveIntensity = 2.0; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const PM = MAT(); Object.values(PM).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [] };
  const extra = { pearl: [], gold: [], garden: [], vine: [], light: [], silver: [] };
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
  // quilla: casco de nácar bajo el tablero, con filo dorado y luz cálida
  parts.frame.push(sweepSeg(0, L, 6, [[-15.5, -1.6], [15.5, -1.6], [9, -5.5], [-9, -5.5]], true));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  extra.light.push(sweepSeg(0, L, 4, [[-12.5, -3.4], [-11.2, -4.2]], false), sweepSeg(0, L, 4, [[11.2, -4.2], [12.5, -3.4]], false));
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
  // pórticos de sector en arco (oro)
  for (const sc of track.sectors) {
    const s = sc.s + (sc.id === 1 ? 6 : 0); track.sample(s, F);
    const arc = new THREE.TorusGeometry(19.5, 0.9, 8, 40, Math.PI); arc.scale(1, 0.85, 1);
    arc.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan)); arc.translate(F.pos.x, F.pos.y, F.pos.z);
    extra.gold.push(arc);
    boxAt(s, 0, 15.6, 30, 0.3, 1.2, parts.gate);
  }

  // ── Plataformas flotantes bajo la pista: discos de nácar con jardín y enredaderas ──
  const plats = [];
  for (let s = 40; s < L; s += 150 + rnd() * 90) {
    track.sample(s, F);
    const R = 36 + rnd() * 30, off = (rnd() - 0.5) * 16;
    const c = F.pos.clone().addScaledVector(F.right, off); const top = c.y - 6;
    const depth = 26 + rnd() * 40;
    const prof = [[0, top - depth], [R * 0.25, top - depth * 0.92], [R * 0.55, top - depth * 0.55], [R * 0.82, top - 9], [R, top - 2.5], [R * 1.02, top], [R * 0.97, top + 1.2], [0, top + 1.2]];
    const pg = lathe(prof, 48); pg.translate(c.x, 0, c.z); extra.pearl.push(pg);
    const rg = lathe([[R * 1.025, top - 1.6], [R * 1.025, top - 0.4]], 48); rg.translate(c.x, 0, c.z); extra.gold.push(rg);
    const lg = lathe([[R * 0.86, top - 8.6], [R * 0.86, top - 7.4]], 48); lg.translate(c.x, 0, c.z); extra.light.push(lg);
    // jardín en el anillo exterior que asoma fuera de la pista
    const gg = lathe([[R * 0.62, top + 1.25], [R * 0.95, top + 1.25], [R * 0.9, top + 3.2], [R * 0.7, top + 3.6]], 48); gg.translate(c.x, 0, c.z); extra.garden.push(gg);
    // enredaderas colgando
    for (let k = 0; k < 18; k++) { const a = rnd() * Math.PI * 2, len = 8 + rnd() * 34; const vg = new THREE.CylinderGeometry(0.45, 0.2, len, 4); vg.translate(c.x + Math.cos(a) * R * 0.9, top - 4 - len / 2, c.z + Math.sin(a) * R * 0.9); extra.vine.push(vg); }
    // aguja inferior
    const ng = lathe([[R * 0.12, top - depth], [R * 0.05, top - depth - 30], [0, top - depth - 42]], 16); ng.translate(c.x, 0, c.z); extra.silver.push(ng);
    plats.push([c, R]);
  }

  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh);
  }
  const addMerged = (lists, parent, cast = true) => {
    for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const mg = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
      const mesh = new THREE.Mesh(mg, PM[k]); mesh.castShadow = cast && k !== 'light'; mesh.receiveShadow = true; parent.add(mesh); own.push(mg);
    }
  };
  addMerged(extra, world);

  // ── Ciudadela Tiphares, en el gran hueco interior ──
  const cit = buildCitadel(1.55);
  cit.position.set(citadel.x, 20, citadel.z);
  world.add(cit);
  cit.traverse((o) => { if (o.isMesh) own.push(o.geometry, o.material); });

  // ── Torres-jardín y islas en media y larga distancia, unidas por cables ──
  const far = { pearl: [], gold: [], garden: [], vine: [], light: [] };
  const trackPts = []; for (let s = 0; s < L; s += 20) { track.sample(s, F); trackPts.push([F.pos.x, F.pos.z]); }
  const clear = (x, z) => { let d = Infinity; for (const [px, pz] of trackPts) d = Math.min(d, (px - x) ** 2 + (pz - z) ** 2); return Math.sqrt(d); };
  const towers = [];
  for (let k = 0, tries = 0; k < 70 && tries < 900; tries++) {
    const a = rnd() * Math.PI * 2, rr = rMax * 0.6 + Math.pow(rnd(), 0.7) * 9000;
    const x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    if (clear(x, z) < 160 || Math.hypot(x - citadel.x, z - citadel.z) < 420) continue;
    const s = 0.8 + rnd() * 1.6 * Math.min(1, rr / 3000);
    const gs = towerGeos(s), yy = -40 + rnd() * 120;
    for (const [kk, list] of Object.entries(gs)) for (const gg of list) { gg.translate(x, yy, z); far[kk].push(gg); }
    towers.push(new THREE.Vector3(x, yy + 40 * s, z)); k++;
  }
  addMerged(far, world, false);
  // cables catenarios entre torres cercanas y hacia la ciudadela
  {
    const pos = [];
    const cat = (a, b, sag) => { let prev = null; for (let i = 0; i <= 24; i++) { const t = i / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; if (prev) pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p; } };
    const cTop = new THREE.Vector3(citadel.x, 10, citadel.z);
    towers.forEach((t, i) => {
      let best = null, bd = Infinity; towers.forEach((u, j) => { if (j === i) return; const d = t.distanceTo(u); if (d < bd) { bd = d; best = u; } });
      if (best && bd < 2200) cat(t, best, bd * 0.12);
      if (t.distanceTo(cTop) < 2600 && rnd() < 0.6) cat(t, cTop.clone().add(new THREE.Vector3((rnd() - 0.5) * 300, 0, (rnd() - 0.5) * 300)), t.distanceTo(cTop) * 0.1);
    });
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const lm = new THREE.LineBasicMaterial({ color: 0x5a4a3a, transparent: true, opacity: 0.55 });
    world.add(new THREE.LineSegments(gg, lm)); own.push(gg, lm);
  }

  // ── Mar de nubes ──
  const uni = { uTime: { value: 0 } };
  const cm = cloudSeaMaterial(uni, tipharesSunDir()); own.push(cm);
  {
    const gg = new THREE.PlaneGeometry(90000, 90000, 360, 360); gg.rotateX(-Math.PI / 2); gg.translate(centroid.x, CLOUD_Y, centroid.z);
    const sea = new THREE.Mesh(gg, cm); sea.frustumCulled = false; sea.receiveShadow = false; world.add(sea); own.push(gg);
  }
  // cúmulos sueltos que asoman (bolas suaves instanciadas)
  {
    const geo = new THREE.IcosahedronGeometry(1, 2); own.push(geo);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2c4a8, roughness: 1, metalness: 0, emissive: 0x5a2e2c, emissiveIntensity: 0.35, flatShading: false }); own.push(mat);
    const list = [];
    for (let c = 0; c < 70; c++) {
      const a = rnd() * Math.PI * 2, rr = 900 + Math.pow(rnd(), 0.6) * 12000;
      const cx = centroid.x + Math.cos(a) * rr, cz = centroid.z + Math.sin(a) * rr, sc = 60 + rnd() * 160;
      if (clear(cx, cz) < 300) continue;
      for (let k = 0; k < 22; k++) { const r = sc * (0.35 + rnd() * 0.75), dx = (rnd() - 0.5) * sc * 4, dz = (rnd() - 0.5) * sc * 4; list.push([cx + dx, CLOUD_Y + 140 + r * 0.3 + (1 - Math.hypot(dx, dz) / (sc * 2.8)) * sc * 0.8, cz + dz, r]); }
    }
    const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4();
    list.forEach(([x, yy, z, r], i) => { m4.makeScale(r, r * 0.62, r).setPosition(x, yy, z); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); world.add(im);
  }

  const fx = {
    t: 0,
    update(dt) { this.t += dt; uni.uTime.value = this.t; cit.rotation.y += dt * 0.006; cit.position.y = 20 + Math.sin(this.t * 0.15) * 2.5; },
  };

  // Intro: frente a la ciudadela contra el sol, rodeándola, y bajada a la parrilla
  track.sample(0, F); const grid = F.pos.clone();
  const sun = tipharesSunDir(), sunH = new THREE.Vector3(sun.x, 0, sun.z).normalize();
  const cTop = new THREE.Vector3(citadel.x, 240, citadel.z);
  const introKeys = () => [
    [0.0, cTop.clone().addScaledVector(sunH, -2100).setY(330), cTop.clone().setY(260), 40],
    [4.2, cTop.clone().addScaledVector(sunH, -700).add(new THREE.Vector3(-sunH.z, 0, sunH.x).multiplyScalar(-500)).setY(200), cTop.clone().setY(120), 50],
    [7.4, grid.clone().addScaledVector(sunH, -400).setY(grid.y + 160), grid.clone().setY(grid.y + 10), 56],
    [9.5, grid.clone().addScaledVector(F.tan, -180).setY(grid.y + 55), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] TIPHARES: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · plataformas ${plats.length} · torres ${towers.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground, tunnel: false, introKeys, fx };
}
