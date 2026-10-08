// THARSIS SIERRA: Marte, meseta de Tharsis, con la cadena de los tres grandes volcanes (Arsia, Pavonis y
// Ascraeus Mons) al fondo. Trazado de archivo (circuito de meseta), con altibajos que siguen
// la sierra cercana. Estadio con tribunas cubiertas y público animado, plataformas flotantes de espectadores,
// una nave-palco suspendida sobre la recta y una ciudad de arquitectura escalonada con ventanales y franjas de luz.
import * as THREE from 'three';
import { reshapeLoop } from './reshape.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { cofferPatch, cofferKey } from './facades.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';

// Trazado calcado del plano (px del recorte ×2), sentido de la lista; recta de meta abajo, hacia +x
const RAW = [[150,410], [300,410], [500,410], [700,410], [900,410], [990,405], [1035,385], [1058,345], [1065,290], [1060,250], [1045,232], [1018,236], [995,262], [960,300], [900,335], [840,355], [805,350], [790,320], [800,285], [835,262], [880,238], [960,200], [1060,150], [1125,112], [1165,85], [1172,62], [1150,42], [1105,40], [1050,58], [980,90], [900,138], [820,188], [740,236], [660,272], [580,290], [520,280], [480,262], [458,275], [468,310], [500,345], [480,362], [420,350], [360,322], [320,300], [270,302], [200,325], [140,355], [105,382], [105,402]];
const IDX = { straightEnd: 5, bend: 10, loopLow: 16, top: 25, vip: 37, karts: 43, ultima: 47 };
const K = 1.45;                  // m por px → ≈ 4,6 km

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
let _seed = 7;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const P = RAW.map(([x, y]) => new THREE.Vector3((x - cx) * K, 0, (y - cy) * K));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 4; pass++) S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -4; k <= 4; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 9); });
  S = reshapeLoop(S, 'tharsis');               // tramos redibujados (reshape.js)
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const fOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return cum[b] / total; };
  const corner = {}; for (const [k, i] of Object.entries(IDX)) corner[k] = fOf(P[i]);
  return { S, cum, total, corner, P };
}

// Sol de media tarde, bajo: al fondo de la recta de meta
export function tharsisSunDir(elev = 0.1) {
  const { P } = layout();
  const d = P[IDX.straightEnd].clone().sub(P[0]).setY(0).normalize();
  d.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.22);
  return d.multiplyScalar(Math.cos(elev)).setY(Math.sin(elev)).normalize();
}

// ── Materiales ──
const GLSL_HASH = 'float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }';
// Fachada con ventanas: rejilla en coordenadas de mundo, encendidas al azar y alguna planta entera
function windowMaterial(color, { rough = 0.55, metal = 0.2, win = 1.6, cell = [3.4, 3.8], lit = 0.6, warm = [1.0, 0.6, 0.26], cool = [0.92, 0.86, 0.72], dim = 0.4 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const o = { cell: cell[0] * 2.2, levels: 3, zone: 44, depth: 1.0, recess: dim, windows: { lit, warm, cool, k: win } };
  m.onBeforeCompile = (sh) => cofferPatch(sh, o);
  m.customProgramCacheKey = () => `win${color}|` + cofferKey(o);
  return m;
}

// Cubierta de las tribunas: casetones en relieve que se subdividen por zonas, algunos como lucernarios
function roofMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xd9cdbd, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide });
  const o = { cell: 8, levels: 3, zone: 36, depth: 1.1, recess: 0.3, roofs: true, windows: { lit: 0.3, warm: [1.0, 0.62, 0.3], cool: [1.0, 0.8, 0.55], k: 0.9 } };
  m.onBeforeCompile = (sh) => cofferPatch(sh, o);
  m.customProgramCacheKey = () => 'roof' + cofferKey(o);
  return m;
}

// Suelo: enlosado de piedra rosada en la ciudad; fuera, regolito marciano (polvo óxido, basalto en coladas y laderas)
function plazaMaterial(track) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW; varying vec3 vMN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW = (modelMatrix * vec4(transformed, 1.0)).xyz; vMN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vMW; varying vec3 vMN;\n${GLSL_HASH}
      float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vMW.xz; float up = normalize(vMN).y;
        float n = vn2(p * 0.02) * 0.6 + vn2(p * 0.11) * 0.3 + vn2(p * 0.9) * 0.1;
        // regolito
        float n1 = vn2(p * 0.0015), n2 = vn2(p * 0.012);
        vec3 dust = vec3(0.6, 0.33, 0.19), rust = vec3(0.42, 0.17, 0.08), basalt = vec3(0.13, 0.08, 0.065);
        vec3 reg = mix(rust, dust, smoothstep(0.3, 0.8, n1 * 0.6 + n2 * 0.25 + up * 0.25));
        float flows = smoothstep(0.6, 0.72, vn2(vec2(dot(p, vec2(0.8, 0.6)) * 0.0011, dot(p, vec2(-0.6, 0.8)) * 0.0045) + vec2(n2 * 0.8)));
        reg = mix(reg, basalt * 1.3, flows * 0.55);
        float steep = 1.0 - smoothstep(0.6, 0.88, up);
        reg = mix(reg, mix(basalt, rust * 0.7, vn2(vec2(vMW.y * 0.07, (p.x + p.y) * 0.002))), steep * 0.8);
        reg *= 0.8 + 0.3 * vn2(vec2(dot(p, vec2(0.96, 0.28)) * 0.0009, dot(p, vec2(-0.28, 0.96)) * 0.012));
        reg *= 0.88 + 0.2 * n;
        // ciudad: losas de 24 m con juntas, piedra rosada; arena del estadio junto a la pista
        vec2 g = abs(fract(p / 24.0) - 0.5);
        float joint = 1.0 - smoothstep(0.0, 0.012, min(g.x, g.y));
        vec2 g2 = abs(fract(p / 6.0) - 0.5);
        float joint2 = 1.0 - smoothstep(0.0, 0.02, min(g2.x, g2.y));
        vec3 stone = mix(vec3(0.5, 0.38, 0.32), vec3(0.62, 0.48, 0.4), vn2(floor(p / 6.0) * 1.7));
        stone *= 1.0 - joint * 0.45 - joint2 * 0.18;
        float r = length(p - vec2(${track.cx.toFixed(1)}, ${track.cz.toFixed(1)}));
        float city = 1.0 - smoothstep(${(track.r0 + 200).toFixed(1)}, ${(track.r0 + 900).toFixed(1)}, r + (n - 0.5) * 500.0);
        diffuseColor.rgb = mix(reg, stone, city * smoothstep(0.75, 0.9, up));
      }`);
  };
  m.customProgramCacheKey = () => 'tharsisGround';
  return m;
}

// Público: rectángulos con silueta (cabeza, hombros, brazos que se levantan), saltos y oleadas
function crowdMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vPU; varying float vSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPU = uv;
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        vSeed = fract(sin(dot(ip, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float wave = sin(uTime * 1.3 - (ip.x + ip.z) * 0.012);
        float hop = max(0.0, sin(uTime * (5.0 + vSeed * 4.0) + vSeed * 60.0)) * step(0.55, vSeed) * (0.5 + 0.5 * wave);
        transformed.y += hop * 0.22 + max(0.0, wave) * 0.08 * step(0.3, vSeed);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vPU; varying float vSeed;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec2 u = vPU;
          float body = step(abs(u.x - 0.5), 0.3 - u.y * 0.04) * step(u.y, 0.7);
          float head = step(length((u - vec2(0.5, 0.82)) * vec2(1.0, 1.25)), 0.14);
          float cheer = step(0.35, vSeed) * step(0.0, sin(uTime * (2.0 + vSeed * 3.0) + vSeed * 40.0));
          float arms = cheer * step(abs(abs(u.x - 0.5) - 0.36), 0.07) * step(0.45, u.y);
          if (body + head + arms < 0.5) discard;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (length((vPU - vec2(0.5, 0.82)) * vec2(1.0, 1.25)) < 0.14) diffuseColor.rgb = mix(vec3(0.42, 0.28, 0.2), vec3(0.18, 0.12, 0.09), vSeed);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fl = step(0.9975, fract(sin(vSeed * 91.7 + floor(uTime * 6.0) * 13.13) * 43758.5453));
        totalEmissiveRadiance += vec3(4.0, 3.9, 3.6) * fl * step(length(vPU - vec2(0.5, 0.6)), 0.25);`);
  };
  m.customProgramCacheKey = () => 'tharsisCrowd';
  return m;
}

// Gradas: el público pintado en los escalones (manchas de ropa, cabezas, sombra entre filas), para que
// entre los espectadores animados nunca se vea hormigón y de lejos se lea como una masa compacta
function seatsMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW; varying vec3 vMN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMW = (modelMatrix * vec4(transformed, 1.0)).xyz; vMN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime; varying vec3 vMW; varying vec3 vMN;\n${GLSL_HASH}
      vec3 cloth(float h){
        vec3 c = vec3(0.79, 0.64, 0.15);
        c = mix(c, vec3(0.72, 0.2, 0.16), step(0.12, h)); c = mix(c, vec3(0.9, 0.87, 0.8), step(0.24, h));
        c = mix(c, vec3(0.11, 0.1, 0.1), step(0.36, h)); c = mix(c, vec3(0.18, 0.43, 0.47), step(0.48, h));
        c = mix(c, vec3(0.48, 0.29, 0.17), step(0.58, h)); c = mix(c, vec3(0.82, 0.42, 0.18), step(0.68, h));
        c = mix(c, vec3(0.42, 0.44, 0.54), step(0.78, h)); c = mix(c, vec3(0.55, 0.19, 0.29), step(0.88, h));
        return c;
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 n = normalize(vMN);
        vec2 q = n.y > 0.5 ? vMW.xz / 0.52 : vec2((abs(n.x) > abs(n.z) ? vMW.z : vMW.x) / 0.52, vMW.y / 0.42);
        vec2 id = floor(q), f = fract(q) - 0.5;
        float h = hh(id);
        vec3 c = cloth(h) * (0.7 + 0.45 * hh(id + 7.0));
        float head = 1.0 - smoothstep(0.16, 0.24, length(f - vec2(0.0, 0.18)));
        c = mix(c, mix(vec3(0.38, 0.25, 0.18), vec3(0.15, 0.1, 0.08), hh(id + 3.0)), head * step(0.5, n.y));
        c *= 0.55 + 0.45 * smoothstep(0.5, 0.15, length(f));               // huecos en sombra
        c *= 0.85 + 0.15 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);        // movimiento
        diffuseColor.rgb = c * (n.y > 0.5 ? 1.0 : 0.6);
      }`);
  };
  m.customProgramCacheKey = () => 'tharsisSeats';
  return m;
}

const CROWD_COLS = [0xc9a227, 0xb8322a, 0xe8e0d0, 0x1c1a1a, 0x2f6f78, 0x7a4a2c, 0xd06a2e, 0x6b6f8a, 0xa88a6a, 0x8c2f4a, 0xf0e6c8, 0x3a3f44];

export function buildTharsis(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 7;
  const { S, cum, total, corner, P } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
  let rMax = 0; for (const p of S) rMax = Math.max(rMax, Math.hypot(p.x - centroid.x, p.z - centroid.z));

  // ── Orografía: meseta ondulada, la sierra que da nombre al circuito y los tres volcanes de Tharsis ──
  const MARS_R = 3389500;
  const rCity = rMax + 140;
  // sierra: cordal paralelo a la diagonal larga, por fuera; y un cerro junto a la horquilla VIP
  const dA = P[IDX.loopLow + 3], dB = P[IDX.top - 1];
  const dDir = dB.clone().sub(dA).setY(0).normalize();
  let dOut = new THREE.Vector3(-dDir.z, 0, dDir.x); if (dOut.dot(dA.clone().lerp(dB, 0.5).sub(centroid)) < 0) dOut.negate();
  const ridgeO = dA.clone().lerp(dB, 0.5).addScaledVector(dOut, 520);
  const knoll = P[IDX.vip].clone().addScaledVector(P[IDX.vip].clone().sub(centroid).setY(0).normalize(), -220);
  // volcanes: línea NE–SO al norte (−z), a 75–95 km; [x, z, altura, radio]
  const VOL = [[-52000, -70000, 11500, 46000], [0, -83000, 13000, 50000], [54000, -96000, 10500, 44000]].map(([x, z, H, R]) => [centroid.x + x, centroid.z + z, H, R]);
  function volcano(x, z) {
    let h = 0;
    for (const [vx, vz, H, R] of VOL) {
      const d = Math.hypot(x - vx, z - vz); if (d > R * 1.3) continue;
      const u = d / R;
      let v = H * Math.pow(Math.max(0, 1 - u), 1.45) + H * 0.04 * Math.exp(-(((u - 1.05) / 0.12) ** 2));   // escudo + falda
      const ang = Math.atan2(z - vz, x - vx);
      v *= 0.93 + 0.14 * fbm(ang * 9 + vx * 0.001, u * 6, 3);                                               // coladas radiales
      const uc = d / (R * 0.11); if (uc < 1.2) v -= H * 0.07 * (1 - sstep(0.85, 1.2, uc));                // caldera
      h = Math.max(h, v);
    }
    return h;
  }
  function base(x, z) {
    const r = Math.hypot(x - centroid.x, z - centroid.z);
    let h = 70 * (fbm(x * 0.00045, z * 0.00045, 4) - 0.5) + 22 * (fbm(x * 0.0028, z * 0.0028, 3) - 0.5) + 4 * (fbm(x * 0.02, z * 0.02, 2) - 0.5);
    h *= lerp(0.08, 1, sstep(rCity - 200, rCity + 1600, r));                                             // la ciudad, casi llana
    // sierra
    const vx = x - ridgeO.x, vz = z - ridgeO.z, along = vx * dDir.x + vz * dDir.z, across = vx * dOut.x + vz * dOut.z;
    h += 150 * Math.exp(-((across / 300) ** 2)) * (1 - sstep(900, 1900, Math.abs(along))) * (0.75 + 0.5 * fbm(along * 0.004, 3.3, 3));
    h += 30 * Math.exp(-(((x - knoll.x) ** 2 + (z - knoll.z) ** 2) / (160 * 160)));
    // grietas (fossae) lejanas, paralelas
    const fx = (x * 0.8 + z * 0.6) * 0.0011; h -= 45 * Math.pow(Math.max(0, Math.sin(fx * 6.28) - 0.92) / 0.08, 2) * sstep(rCity + 1500, rCity + 4000, r);
    h += volcano(x, z);
    h -= r * r / (2 * MARS_R);
    return h;
  }
  // ── Cotas de la pista: siguen la orografía suavizada (sube hacia la sierra) con holgura sobre el suelo ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  const hb = S.map((p) => base(p.x, p.z));
  let y = hb.map((_, i) => { let a = 0; for (let k = -18; k <= 18; k++) a += hb[(i + k + N) % N]; return a / 37; });
  y = y.map((v, i) => v * 0.8 + 10 + 6 * g(cum[i] / total, corner.top, 300));
  const lim = 0.14 * 8;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - lim), y[i - 1] + lim);
    for (let i = N - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - lim), y[i + 1] + lim);
  }
  for (let pass = 0; pass < 3; pass++) y = y.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += y[(i + k + N) % N]; return Math.max(a / 7, hb[i] + 6); });

  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.15, 0.32, 0.5, 0.66, 0.82] });
  const F = track.frame();
  const tc = { cx: centroid.x, cz: centroid.z, r0: rCity };
  // suelo final: bajo el tablero se excava una vaguada para que la pista siempre vuele por encima
  const loc = {}, _p = new THREE.Vector3();
  const ground = (x, z) => {
    let h = base(x, z);
    track.locate(_p.set(x, h, z), loc);
    if (loc.far || loc.dist > 320) return h;
    const floor = loc.deckY - 9, w = 1 - sstep(70, 300, loc.dist);
    if (h > floor) h = lerp(h, floor, w);
    return h;
  };

  // ── Tablero, muros, balizas, costillas, pilares y pórticos (como en las otras fases generadas) ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x8c8580))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xd8cbbd))),
    rib: srcMat('S6 | Ash concrete', (m) => m.color.setHex(0x6b5a50)),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x24211f)),
    edge: srcMat('S6 | Satin silver edges'),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.6, 0.25); m.emissiveIntensity = 2.2; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed, vScale = 20, offSide = 0) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (s1 - s0) * r / rows; track.sample(s, F);
      const wv = track.wAt(s);
      prof.forEach(([x0, h], k) => { const x = offSide ? offSide * (16.4 * wv + x0) : x0 * wv; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), s / vScale); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; if (offSide < 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  const L = track.length;
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  parts.deck.push(sweepSeg(0, L, 3, deckProf, true, 32));
  parts.guard.push(sweepSeg(0, L, 3, wallL, false), sweepSeg(0, L, 3, wallR, false));
  parts.frame.push(sweepSeg(0, L, 6, [[-3.2, -1.6], [3.2, -1.6], [2.2, -4.6], [-2.2, -4.6]], true));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
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
  // pilares: pares de columnas cilíndricas hasta la explanada
  for (let s = 30; s < L; s += 64) {
    track.sample(s, F);
    for (const sd of [-1, 1]) {
      const top = F.pos.clone().addScaledVector(F.right, sd * 7).addScaledVector(F.up, -4.2);
      const gy = ground(top.x, top.z), hgt = top.y - gy + 1;
      if (hgt < 3) continue;
      const leg = new THREE.CylinderGeometry(1.0, 1.3, hgt, 12, 1); leg.translate(top.x, top.y - hgt / 2, top.z); parts.rib.push(leg);
      const cap = new THREE.CylinderGeometry(2.6, 1.0, 1.4, 12); cap.translate(top.x, top.y - 0.4, top.z); parts.rib.push(cap);
    }
  }
  for (const sc of track.sectors) {
    const s = sc.s + (sc.id === 1 ? 6 : 0);
    for (const x of [-19, 19]) boxAt(s, x, 7, 1.6, 16, 1.6, parts.frame);
    boxAt(s, 0, 15.4, 40, 1.8, 2.2, parts.frame);
    boxAt(s, 0, 14.4, 34, 0.3, 2.3, parts.gate);
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

  // ── Explanada ──
  const pmat = plazaMaterial(tc); own.push(pmat);
  {
    const bb = new THREE.Box3().setFromPoints(S);
    const near = { x0: bb.min.x - 1500, x1: bb.max.x + 1500, z0: bb.min.z - 1500, z1: bb.max.z + 1500 };
    const grid = (x0, x1, z0, z1, step, hf, skip) => {
      const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
      const pos = new Float32Array((nx + 1) * (nz + 1) * 3), idx = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * step, z = z0 + j * step, o = (j * (nx + 1) + i) * 3; pos[o] = x; pos[o + 1] = hf(x, z); pos[o + 2] = z; }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (skip && skip(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step)) continue; const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    };
    const inNear = (x, z, m = 0) => x > near.x0 + m && x < near.x1 - m && z > near.z0 + m && z < near.z1 - m;
    const cx = (near.x0 + near.x1) / 2, cz = (near.z0 + near.z1) / 2, MID = 24000;
    const gNear = grid(near.x0, near.x1, near.z0, near.z1, 20, ground);
    const gMid = grid(cx - MID, cx + MID, cz - MID, cz + MID, 220, (x, z) => base(x, z) - (inNear(x, z, -400) ? 4 : 0), (x, z) => inNear(x, z, 220));
    const rings = 90, segs = 400, r0 = MID * 0.96, r1 = 300000, fp = [], fi = [];
    for (let i = 0; i <= rings; i++) { const r = r0 * Math.pow(r1 / r0, i / rings); for (let j = 0; j <= segs; j++) { const a = j / segs * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; fp.push(x, base(x, z) - 20, z); } }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + 1, c = a + segs + 1, d = c + 1; fi.push(a, b, c, b, d, c); }
    const gFar = new THREE.BufferGeometry(); gFar.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); gFar.setIndex(fi); gFar.computeVertexNormals();
    for (const gg of [gNear, gMid, gFar]) { const m = new THREE.Mesh(gg, pmat); m.receiveShadow = gg === gNear; m.frustumCulled = gg === gNear; world.add(m); own.push(gg); }
  }

  // ── Tribunas cubiertas con público ──
  const uni = { uTime: { value: 0 } };
  const SM = {
    stand: (() => { const m = windowMaterial(0xb8a48e, { rough: 0.7, metal: 0.05, win: 1.1, lit: 0.24, cell: [3.2, 4.2], dim: 0.3 }); m.side = THREE.DoubleSide; return m; })(),
    standDark: new THREE.MeshStandardMaterial({ color: 0x2b2624, roughness: 0.6, metalness: 0.3 }),
    roof: roofMaterial(),
    glow: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xffa04a, emissiveIntensity: 2.4, side: THREE.DoubleSide }),
    teal: new THREE.MeshStandardMaterial({ color: 0x0c2a2c, emissive: 0x3fd6cf, emissiveIntensity: 1.6 }),
    crowd: crowdMaterial(uni),
    seats: (() => { const m = seatsMaterial(uni); m.side = THREE.DoubleSide; return m; })(),
  };
  Object.values(SM).forEach((m) => own.push(m));
  const fAt = (f) => ((f % 1) + 1) % 1 * L;
  // lado de fuera del trazado en s
  const outside = (s) => { track.sample(s, F); const v = F.pos.clone().sub(centroid).setY(0); return Math.sign(v.dot(F.right)) || 1; };
  // [desde, hasta (fracción del recorrido), lado: 'out' | 'in' | 'both', filas]
  const standDefs = [
    [-0.03, corner.straightEnd - 0.01, 'out', 22],          // recta de meta: gran tribuna
    [0.03, corner.straightEnd - 0.04, 'in', 12],            // boxes / podio enfrente
    [corner.bend - 0.025, corner.bend + 0.02, 'out', 14],
    [corner.top - 0.03, corner.top + 0.015, 'out', 14],
    [corner.vip - 0.03, corner.vip + 0.02, 'out', 16],
    [corner.karts - 0.02, corner.karts + 0.03, 'out', 12],
  ];
  const standParts = { stand: [], seats: [], standDark: [], roof: [], glow: [], teal: [] };
  // distancia a otros tramos de la pista (excluye el propio, ±160 m de recorrido)
  const trackS = []; for (let s = 0; s < L; s += 12) { track.sample(s, F); trackS.push([F.pos.x, F.pos.z, s]); }
  const clearOther = (x, z, s) => { let d = Infinity; for (const [px, pz, ps] of trackS) { if (Math.abs(track.delta(s, ps)) < 160) continue; d = Math.min(d, (px - x) ** 2 + (pz - z) ** 2); } return Math.sqrt(d); };
  const crowd = [];   // [pos, toward, color]
  const RD = 1.55, RR = 0.82, standLog = [];
  for (const [fa, fb, sideDef, rowsDef] of standDefs) {
    const s0 = fAt(fa), s1raw = fAt(fb), s1 = s1raw < s0 ? s1raw + L : s1raw;
    const sides = sideDef === 'both' ? [1, -1] : [sideDef === 'out' ? outside((s0 + s1) / 2) : -outside((s0 + s1) / 2)];
    for (const sd of sides) {
      const x0 = 6.5, h0 = -0.4;
      // la tribuna no puede invadir otro tramo: menos filas o fuera
      let rowsOk = rowsDef;
      for (let s = s0; s <= s1; s += 20) {
        const sw = s % L; track.sample(sw, F);
        while (rowsOk > 4) { const p = F.pos.clone().addScaledVector(F.right, sd * (16.4 * track.wAt(sw) + x0 + rowsOk * RD + 6)); if (clearOther(p.x, p.z, sw) > 34) break; rowsOk--; }
      }
      standLog.push(`${fa.toFixed(2)}:${sd}:${rowsOk}`);
      if (rowsOk <= 4) continue;
      const rows = rowsOk;
      // perfil escalonado: (x desde el muro, h)
      const seat = [[x0, h0 + 1.2]];
      for (let r = 0; r < rows; r++) { seat.push([x0 + r * RD, h0 + r * RR + 1.2]); seat.push([x0 + (r + 1) * RD, h0 + r * RR + 1.2]); }
      const xb = x0 + rows * RD, hb = h0 + rows * RR + 1.2;
      seat.push([xb, hb]);
      standParts.seats.push(sweepSeg(s0, s1, 4, seat, false, 20, sd));
      standParts.stand.push(sweepSeg(s0, s1, 4, [[x0 - 1.5, -40], [x0 - 1.5, h0 + 1.2], [x0, h0 + 1.2]], false, 20, sd));
      standParts.stand.push(sweepSeg(s0, s1, 4, [[xb, hb - 0.05], [xb, hb + 3.2], [xb + 1.2, hb + 3.2], [xb + 1.2, -40]], false, 20, sd));
      // pantalla y barandilla oscuras, tira de luz bajo el borde del voladizo
      standParts.standDark.push(sweepSeg(s0, s1, 4, [[x0 - 1.6, h0 + 1.2], [x0 - 1.6, h0 + 2.3], [x0 - 1.3, h0 + 2.3]], false, 20, sd));
      const rh0 = hb + 9, rh1 = hb + 13;
      standParts.roof.push(sweepSeg(s0, s1, 4, [[x0 - 9, rh0], [x0 - 9, rh0 + 0.7], [xb + 4, rh1 + 1.2], [xb + 4, rh1]], true, 20, sd));
      standParts.glow.push(sweepSeg(s0, s1, 4, [[x0 - 8.7, rh0 - 0.25], [x0 - 7.2, rh0 - 0.1]], false, 20, sd));
      standParts.teal.push(sweepSeg(s0, s1, 4, [[x0 - 1.62, h0 + 2.0], [x0 - 1.62, h0 + 2.2]], false, 20, sd));
      // torres de escalera en los extremos: cierran la tribuna hasta el suelo y sostienen el voladizo
      const frameAt = (s) => { track.sample(((s % L) + L) % L, F); return { m: new THREE.Matrix4().makeBasis(F.right, F.up, F.tan), p: F.pos.clone(), w: track.wAt(((s % L) + L) % L) }; };
      for (const [se, dir] of [[s0, 1], [s1, -1]]) {
        const { m, p, w } = frameAt(se + dir * 3);
        const off = 16.4 * w;
        const sh = new THREE.Shape([[off + x0 - 2.6, -40], [off + xb + 2.4, -40], [off + xb + 2.4, rh1 + 1.8], [off + x0 - 2.6, rh0 + 1.4]].map(([x, h]) => new THREE.Vector2(sd * x, h)));
        const tg = new THREE.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false }); tg.translate(0, 0, -3.5);
        tg.applyMatrix4(m); tg.translate(p.x, p.y, p.z); standParts.stand.push(tg);
        // rendijas de luz verticales en la cara exterior y remate oscuro
        for (const k of [0.25, 0.5, 0.75]) {
          const sl = new THREE.BoxGeometry(0.35, Math.max(4, rh0 + 30), 0.3); sl.translate(sd * (off + x0 + (xb - x0) * k), (rh0 - 14) / 2, dir > 0 ? -3.65 : 3.65);
          sl.applyMatrix4(m); sl.translate(p.x, p.y, p.z); standParts.glow.push(sl);
        }
        const cap = new THREE.BoxGeometry(xb - x0 + 6.0, 1.2, 7.6); cap.translate(sd * (off + (x0 + xb) / 2 - 0.1), rh1 + 1.9, 0); cap.applyMatrix4(m); cap.translate(p.x, p.y, p.z); standParts.standDark.push(cap);
      }
      // costillas transversales sobre la cubierta
      for (let s = s0 + 4; s < s1 - 2; s += 12) {
        const { m, p, w } = frameAt(s), off = 16.4 * w;
        const a = new THREE.Vector2(sd * (off + x0 - 9), rh0 + 1.1), b = new THREE.Vector2(sd * (off + xb + 4), rh1 + 1.6);
        const rg = new THREE.BoxGeometry(a.distanceTo(b), 0.9, 0.9); rg.rotateZ(Math.atan2(b.y - a.y, b.x - a.x)); rg.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
        rg.applyMatrix4(m); rg.translate(p.x, p.y, p.z); standParts.standDark.push(rg);
      }
      // pilastras oscuras en la fachada trasera (ritmo vertical)
      for (let s = s0 + 9; s < s1 - 6; s += 12) {
        const { m, p, w } = frameAt(s);
        const pg = new THREE.BoxGeometry(1.0, hb + 3.2 + 40, 1.6); pg.translate(sd * (16.4 * w + xb + 1.7), (hb + 3.2 - 40) / 2, 0);
        pg.applyMatrix4(m); pg.translate(p.x, p.y, p.z); standParts.standDark.push(pg);
      }
      // mástiles del voladizo
      for (let s = s0 + 6; s < s1 - 4; s += 28) {
        track.sample(s % L, F);
        const base = F.pos.clone().addScaledVector(F.right, sd * (16.4 * track.wAt(s % L) + xb + 2.5));
        const topY = F.pos.y + rh1 + 1.0, gy = ground(base.x, base.z) - 1;
        const mg = new THREE.BoxGeometry(1.1, topY - gy, 1.1); mg.translate(base.x, (topY + gy) / 2, base.z); standParts.standDark.push(mg);
      }
      // público
      for (let s = s0 + 1; s < s1 - 1; s += 0.6) {
        const sw = s % L; track.sample(sw, F);
        const wv = track.wAt(sw);
        const toward = F.right.clone().multiplyScalar(-sd);
        for (let r = 0; r < rows; r++) {
          if (rnd() < 0.05) continue;
          const x = sd * (16.4 * wv + x0 + r * RD + RD * (0.25 + rnd() * 0.45));
          const h = h0 + r * RR + 1.2 + 0.62;
          const p = F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h).addScaledVector(F.tan, (rnd() - 0.5) * 0.3);
          crowd.push([p, toward, CROWD_COLS[Math.floor(rnd() * CROWD_COLS.length)]]);
        }
      }
    }
  }
  for (const [k, list] of Object.entries(standParts)) {
    if (!list.length) continue;
    const mg = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    const mesh = new THREE.Mesh(mg, SM[k]); mesh.castShadow = k === 'roof' || k === 'stand' || k === 'seats'; mesh.receiveShadow = true; world.add(mesh);
  }
  const personGeo = new THREE.PlaneGeometry(0.72, 1.25); personGeo.translate(0, 0.1, 0); own.push(personGeo);
  const placeCrowd = (list, parent) => {
    const im = new THREE.InstancedMesh(personGeo, SM.crowd, list.length);
    const m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), xx = new THREE.Vector3(), col = new THREE.Color();
    list.forEach(([p, toward, c], i) => {
      const z = toward.clone().setY(0).normalize().applyAxisAngle(up, (h2(p.x, p.z) - 0.5) * 0.5);
      xx.crossVectors(up, z).normalize();
      const sc = 0.9 + h2(p.z, p.x) * 0.22;
      m4.makeBasis(xx.multiplyScalar(sc), up.clone().multiplyScalar(sc), z).setPosition(p);
      im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(c).multiplyScalar(0.8 + h2(p.x * 3, p.z) * 0.35));
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere();
    parent.add(im);
    return im;
  };
  placeCrowd(crowd, world);

  // ── Plataformas flotantes de espectadores (platillos con barandilla luminosa y público) ──
  const platMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.35, metalness: 0.35 });
  const platDark = new THREE.MeshStandardMaterial({ color: 0x1d1a1b, roughness: 0.5, metalness: 0.5 });
  own.push(platMat, platDark);
  const platforms = [];
  const platAt = [[0.3, 1], [corner.loopLow + 0.012, -1], [0.43, 1], [corner.top + 0.045, 1], [0.6, -1], [0.72, 1], [corner.karts + 0.05, -1], [0.93, -1]];
  for (const [f, sgn] of platAt) {
    const s = fAt(f); track.sample(s, F);
    let sd = sgn * outside(s); const R = 13 + rnd() * 7, off = R + 12 + rnd() * 14, lift = 6 + rnd() * 14;
    const cAt = (sg) => F.pos.clone().addScaledVector(F.right, sg * (16.4 * track.wAt(s) + off));
    let c = cAt(sd);
    if (clearOther(c.x, c.z, s) < R + 26) { sd = -sd; c = cAt(sd); if (clearOther(c.x, c.z, s) < R + 26) continue; }
    c.setY(F.pos.y + lift);
    const grp = new THREE.Group(); grp.position.copy(c);
    const prof = [[0, -4.6], [R * 0.35, -4.2], [R * 0.85, -1.6], [R, -0.2], [R * 1.04, 0.3], [R, 0.6], [R * 0.97, 0.4], [0, 0.4]].map(([a, b]) => new THREE.Vector2(a, b));
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), platMat); hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R * 0.985, 0.12, 6, 64), SM.glow); rail.rotation.x = Math.PI / 2; rail.position.y = 1.4; grp.add(rail);
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.3, 1.6, 24), platDark); belly.position.y = -5; grp.add(belly);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.16, R * 0.16, 0.2, 24), SM.teal); lamp.position.y = -5.85; grp.add(lamp);
    const toTrack = F.pos.clone().sub(c).setY(0).normalize();
    const pc = [];
    for (let k = 0; k < R * R * 2.6; k++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R * 0.92;
      const lp = new THREE.Vector3(Math.cos(a) * rr, 1.0, Math.sin(a) * rr);
      if (toTrack.dot(lp.clone().normalize()) < -0.3 && rr > R * 0.4 && rnd() < 0.6) continue;   // más gente asomada hacia la pista
      pc.push([lp, toTrack, CROWD_COLS[Math.floor(rnd() * CROWD_COLS.length)]]);
    }
    placeCrowd(pc, grp);
    world.add(grp);
    platforms.push({ grp, y0: c.y, ph: rnd() * 6.28, sp: 0.25 + rnd() * 0.2 });
  }

  // ── Nave-palco suspendida sobre la recta de meta ──
  const liner = new THREE.Group();
  {
    track.sample(fAt(0.04), F);
    const a = F.pos.clone(); track.sample(fAt(corner.straightEnd - 0.04), F); const b = F.pos.clone();
    const mid = a.clone().lerp(b, 0.45), dir = b.clone().sub(a).setY(0).normalize();
    const side = outside(fAt(0.06));
    track.sample(fAt(0.06), F);
    liner.position.copy(mid).addScaledVector(F.right, side * 46).setY(mid.y + 62);
    liner.lookAt(liner.position.clone().add(dir));
    const hullG = new THREE.SphereGeometry(1, 48, 18); hullG.scale(26, 7, 120);
    const top = new THREE.Mesh(hullG, platMat); top.castShadow = true; liner.add(top);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 150), platDark); keel.position.y = -7; liner.add(keel);
    const deckG = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 90), platDark); deckG.position.set(0, -9, 10); liner.add(deckG);
    const win = new THREE.Mesh(new THREE.BoxGeometry(30.4, 1.2, 86), SM.glow); win.position.set(0, -8.4, 10); liner.add(win);
    const winT = new THREE.Mesh(new THREE.BoxGeometry(52.4, 0.6, 1.2), SM.teal); winT.position.set(0, -2, 0); winT.scale.set(1, 1, 120); liner.add(winT);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 40), platDark); arm.position.set(side * -14, -12, 60); arm.rotation.y = side * 0.4; liner.add(arm);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 6, 20), platMat); pod.position.set(side * -22, -14, 76); liner.add(pod);
    const terr = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 92), platMat); terr.position.set(0, -14.5, 10); liner.add(terr);
    const tRail = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.25, 92.4), SM.glow); tRail.position.set(0, -13.0, 10); liner.add(tRail);
    const pc = []; for (let k = 0; k < 520; k++) pc.push([new THREE.Vector3((rnd() - 0.5) * 33, -13.4, -34 + rnd() * 88), new THREE.Vector3(side, 0, 0), CROWD_COLS[Math.floor(rnd() * CROWD_COLS.length)]]);
    placeCrowd(pc, liner);
    world.add(liner);
  }

  // ── Ciudad: zigurats escalonados con franjas de luz, torres de ventanales, agujas y discos ──
  const CM = {
    dark: windowMaterial(0x1d1b20, { rough: 0.5, metal: 0.35, win: 1.3, lit: 0.42 }),
    stone: windowMaterial(0x8a7262, { rough: 0.8, metal: 0.02, win: 0.9, lit: 0.3, cell: [4.2, 4.6], dim: 0.6 }),
    teal: windowMaterial(0x1f4448, { rough: 0.45, metal: 0.3, win: 1.5, lit: 0.55, warm: [1.0, 0.82, 0.5], cool: [1.0, 0.75, 0.4] }),
    roof: new THREE.MeshStandardMaterial({ color: 0x141215, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    glow: SM.glow,
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a1d20, emissive: 0x9fe8ff, emissiveIntensity: 1.9 }),
    spire: new THREE.MeshStandardMaterial({ color: 0x2a2626, roughness: 0.3, metalness: 0.8 }),
    drum: (() => {   // tambores de adobe: estrías horizontales y aristas gastadas por el polvo
      const m = new THREE.MeshStandardMaterial({ color: 0x9c7a60, roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vDW;\n${GLSL_HASH}`).replace('#include <color_fragment>', `#include <color_fragment>
          float gy = fract(vDW.y / 3.2); float groove = smoothstep(0.0, 0.08, gy) * smoothstep(1.0, 0.92, gy);
          float stain = hh(floor(vDW.xz / 9.0) + floor(vDW.y / 14.0));
          diffuseColor.rgb *= (0.72 + 0.28 * groove) * (0.86 + 0.24 * stain) * (0.9 + 0.1 * smoothstep(-20.0, 60.0, vDW.y));`);
      };
      m.customProgramCacheKey = () => 'drum';
      return m;
    })(),
    chrome: new THREE.MeshStandardMaterial({ color: 0xa9b2b8, roughness: 0.14, metalness: 1.0 }),
  };
  Object.values(CM).forEach((m) => own.push(m));
  const cells = new Map();                       // trozos de 1,6 km: la cámara recorta lo que no ve
  let curY = 0;
  const put = (key, mat, geo) => { if (curY) geo.translate(0, curY, 0); const k = key + '|' + mat; if (!cells.has(k)) cells.set(k, { mat, list: [] }); cells.get(k).list.push(geo); };
  const trackPts = []; for (let s = 0; s < L; s += 16) { track.sample(s, F); trackPts.push([F.pos.x, F.pos.z]); }
  const clearance = (x, z) => { let d = Infinity; for (const [px, pz] of trackPts) d = Math.min(d, (px - x) ** 2 + (pz - z) ** 2); return Math.sqrt(d); };
  const B = (w, h, d, x, yb, z, rot, key, mat) => { const gg = new THREE.BoxGeometry(w, h, d); gg.rotateY(rot); gg.translate(x, yb + h / 2, z); put(key, mat, gg); };
  const ziggurat = (x, z, s, rot, key) => {
    let w = 60 * s, d = 44 * s, yb = 0;
    const levels = 3 + Math.floor(rnd() * 3);
    B(w * 1.25, 9 * s, d * 1.25, x, 0, z, rot, key, 'stone');                    // zócalo de piedra
    yb = 9 * s;
    for (let l = 0; l < levels; l++) {
      const h = (14 + rnd() * 10) * s;
      B(w, h, d, x, yb, z, rot, key, l === 0 ? 'stone' : 'dark');
      B(w * 1.12, 2.2 * s, d * 1.12, x, yb + h, z, rot, key, 'roof');            // voladizo
      B(w * 1.06, 1.0 * s, d * 1.06, x, yb + h - 1.0 * s, z, rot, key, 'glow');   // franja de luz bajo el voladizo
      yb += h + 2.2 * s; w *= 0.74; d *= 0.74;
    }
    const cone = new THREE.ConeGeometry(Math.max(w, d) * 0.85, 26 * s, 4); cone.rotateY(rot + Math.PI / 4); cone.translate(x, yb + 13 * s, z); put(key, 'roof', cone);
    if (rnd() < 0.5) for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {   // agujas
      const hN = (60 + rnd() * 140) * s, ox = (rnd() - 0.5) * w, oz = (rnd() - 0.5) * d;
      const ng = new THREE.ConeGeometry(1.4 * s, hN, 6); ng.translate(x + ox, yb + hN / 2, z + oz); put(key, 'spire', ng);
    }
  };
  const tower = (x, z, s, rot, key) => {
    const w = (20 + rnd() * 26) * s, d = (20 + rnd() * 26) * s, h = (70 + rnd() * 190) * s;
    const mat = rnd() < 0.3 ? 'teal' : 'dark';
    B(w * 1.3, 10 * s, d * 1.3, x, 0, z, rot, key, 'stone');
    B(w, h, d, x, 10 * s, z, rot, key, mat);
    B(w * 1.08, 1.4 * s, d * 1.08, x, 10 * s + h * 0.62, z, rot, key, 'glow');
    B(w * 0.7, 10 * s, d * 0.7, x, 10 * s + h, z, rot, key, 'roof');
    if (rnd() < 0.6) { const hN = (40 + rnd() * 120) * s; const ng = new THREE.ConeGeometry(1.2 * s, hN, 6); ng.translate(x, 20 * s + h + hN / 2, z); put(key, 'spire', ng); }
  };
  // tambor escalonado con aleros abocinados, cúpula y torreta (arquitectura de adobe futurista)
  const lathe = (pts, segs = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const drum = (x, z, s, key) => {
    const R = (28 + rnd() * 20) * s, H = (34 + rnd() * 26) * s;
    const add = (g, mat) => { g.translate(x, 0, z); put(key, mat, g); };
    add(lathe([[0, 0], [R * 1.04, 0], [R, H * 0.08], [R, H]]), 'drum');
    add(lathe([[R * 0.99, H - 0.4 * s], [R * 1.3, H + 2.5 * s], [R * 1.3, H + 3.4 * s], [R * 0.86, H + 4.2 * s]]), 'roof');   // alero
    add(lathe([[R * 1.004, H - 3.2 * s], [R * 1.004, H - 1.8 * s]]), 'glow');                                                // banda de luz bajo el alero
    const R2 = R * (0.72 + rnd() * 0.12), H2 = H + 4 * s + (12 + rnd() * 10) * s;
    add(lathe([[0, H + 4 * s], [R2, H + 4 * s], [R2, H2]]), 'drum');
    add(lathe([[R2 * 1.004, H2 - 3.5 * s], [R2 * 1.004, H2 - 2.4 * s]]), 'glow');
    add(lathe([[R2 * 0.98, H2 - 0.3 * s], [R2 * 1.22, H2 + 1.8 * s], [R2 * 1.2, H2 + 2.6 * s], [R2 * 0.8, H2 + 3.2 * s]]), 'roof');
    const dome = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; dome.push([Math.cos(a) * R2 * 0.8, H2 + 3.2 * s + Math.sin(a) * R2 * 0.42]); }
    add(lathe(dome), 'drum');
    const top = H2 + 3.2 * s + R2 * 0.42;
    add(lathe([[0, top], [R2 * 0.14, top], [R2 * 0.14, top + 6 * s], [R2 * 0.3, top + 7.5 * s], [R2 * 0.16, top + 9 * s], [0, top + 10 * s]], 20), 'roof');
    if (rnd() < 0.6) {   // torre esbelta adosada, con platillo arriba
      const a = rnd() * Math.PI * 2, tx = x + Math.cos(a) * R * 1.05, tz = z + Math.sin(a) * R * 1.05, r3 = R * 0.3, H3 = H2 * (1.25 + rnd() * 0.3);
      const g1 = lathe([[0, 0], [r3, 0], [r3 * 0.92, H3]], 24); g1.translate(tx, 0, tz); put(key, 'drum', g1);
      const g2 = lathe([[r3 * 0.9, H3 - 1], [r3 * 2.2, H3 + 3 * s], [r3 * 2.2, H3 + 4.4 * s], [r3 * 1.0, H3 + 6 * s], [r3 * 1.0, H3 + 9 * s]], 32); g2.translate(tx, 0, tz); put(key, 'roof', g2);
      const g3 = lathe([[r3 * 2.21, H3 + 3.2 * s], [r3 * 2.21, H3 + 4.2 * s]], 32); g3.translate(tx, 0, tz); put(key, 'glow', g3);
      const d2 = []; for (let i = 0; i <= 8; i++) { const b = i / 8 * Math.PI / 2; d2.push([Math.cos(b) * r3, H3 + 9 * s + Math.sin(b) * r3 * 0.8]); }
      const g4 = lathe(d2, 24); g4.translate(tx, 0, tz); put(key, 'drum', g4);
    }
  };
  const disc = (x, z, s, key) => {
    const h = (50 + rnd() * 70) * s, R = (40 + rnd() * 40) * s;
    const col = new THREE.CylinderGeometry(9 * s, 12 * s, h, 16); col.translate(x, h / 2, z); put(key, 'stone', col);
    const dg = new THREE.CylinderGeometry(R, R * 0.8, 10 * s, 40); dg.translate(x, h + 5 * s, z); put(key, 'stone', dg);
    const rim = new THREE.CylinderGeometry(R * 1.01, R * 1.01, 1.4 * s, 40, 1, true); rim.translate(x, h + 2.8 * s, z); put(key, 'glow', rim);
    const cap = new THREE.CylinderGeometry(R * 0.55, R * 0.7, 6 * s, 32); cap.translate(x, h + 13 * s, z); put(key, 'dark', cap);
  };
  const lattice = (x, z, s, key) => {
    const w = 34 * s, h = 300 * s;
    B(w, h, w, x, 0, z, 0, key, 'dark');
    const segs = 6, sh = h / segs;
    for (let i = 0; i < segs; i++) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sg of [1, -1]) {
      const len = Math.hypot(w, sh), gg = new THREE.BoxGeometry(1.4 * s, len, 1.4 * s);
      gg.rotateZ(sg * Math.atan2(w, sh));
      if (nz) gg.rotateY(Math.PI / 2);
      gg.translate(x + nx * (w / 2 + 0.8 * s), sh * (i + 0.5), z + nz * (w / 2 + 0.8 * s));
      put(key, 'cyan', gg);
    }
    const ng = new THREE.ConeGeometry(2 * s, 160 * s, 6); ng.translate(x, h + 80 * s, z); put(key, 'spire', ng);
  };
  let nB = 0;
  const place = (count, r0, r1, minClear, scale, kinds) => {
    let tries = 0;
    for (let k = 0; k < count && tries < count * 20; tries++) {
      const a = rnd() * Math.PI * 2, r = r0 + Math.sqrt(rnd()) * (r1 - r0);
      const x = centroid.x + Math.cos(a) * r, z = centroid.z + Math.sin(a) * r;
      if (clearance(x, z) < minClear) continue;
      const key = `${Math.floor(x / 1600)},${Math.floor(z / 1600)}`;
      const s = scale * (0.7 + rnd() * 0.7), rot = Math.round(rnd() * 4) * Math.PI / 4 * 0.5;
      const t = rnd(); let acc = 0, kind = kinds[0][0];
      for (const [kk, w] of kinds) { acc += w; if (t < acc) { kind = kk; break; } }
      curY = ground(x, z) - 2;
      if (kind === 'zig') ziggurat(x, z, s, rot, key); else if (kind === 'tower') tower(x, z, s, rot, key); else if (kind === 'drum') drum(x, z, s, key); else disc(x, z, s, key);
      k++; nB++;
    }
  };
  place(140, 120, rMax + 500, 150, 0.8, [['zig', 0.28], ['tower', 0.3], ['drum', 0.27], ['disc', 0.15]]);         // dentro y junto al circuito
  place(240, rMax + 300, rMax + 2600, 210, 1.15, [['zig', 0.32], ['tower', 0.35], ['drum', 0.22], ['disc', 0.11]]);
  place(160, rMax + 2600, rMax + 7000, 0, 2.2, [['zig', 0.45], ['tower', 0.5], ['disc', 0.05]]);    // perfil lejano
  // tres hitos con la X luminosa
  for (const [ang, rr] of [[0.15, 900], [2.4, 1500], [4.3, 1150]]) {
    const x = centroid.x + Math.cos(ang) * (rMax + rr), z = centroid.z + Math.sin(ang) * (rMax + rr);
    curY = ground(x, z) - 2;
    lattice(x, z, 1.1, `${Math.floor(x / 1600)},${Math.floor(z / 1600)}`); nB++;
  }
  let nMesh = 0;
  // pórticos de pilones cromados con anillos luminosos a ambos lados de la pista
  {
    const PP = { chrome: [], teal: [] };
    const prof = [[0, 0], [5.5, 0], [5.5, 1.4], [2.4, 2.6], [1.5, 8], [1.5, 11.5]];
    for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; prof.push([Math.max(1.3, Math.cos(a) * 6.4), 20 + Math.sin(a) * 8.5]); }
    prof.push([1.3, 30], [2.6, 31], [2.6, 32.2], [0.9, 33.4], [0.5, 44], [0, 44.5]);
    const body = lathe(prof, 36);
    const fins = [], rings = [];
    for (const [k, y] of [[0, 14.5], [1, 16.6], [0, 18.7], [1, 20.8], [0, 22.9], [1, 25]]) {
      const r = Math.cos(Math.asin(Math.min(0.98, Math.abs(y - 20) / 8.5))) * 6.4 + 1.6;
      const fg = new THREE.CylinderGeometry(r, r, 0.32, 40); fg.translate(0, y, 0); fins.push(fg);
      if (k) { const tg = new THREE.TorusGeometry(r + 0.05, 0.1, 6, 48); tg.rotateX(Math.PI / 2); tg.translate(0, y, 0); rings.push(tg); }
    }
    const capG = new THREE.CylinderGeometry(2.4, 2.4, 0.25, 32); capG.translate(0, 32.35, 0); rings.push(capG);
    const pylonGeo = mergeGeometries(norm([body, ...fins]), false), ringGeo = mergeGeometries(norm(rings), false);
    let nP = 0;
    for (const f of [corner.loopLow - 0.004, 0.375, 0.452, 0.6, 0.695, 0.76]) {
      const s0 = fAt(f); track.sample(s0, F);
      for (const sd of [-1, 1]) {
        const p = F.pos.clone().addScaledVector(F.right, sd * (16.4 * track.wAt(s0) + 14));
        if (clearOther(p.x, p.z, s0) < 40) continue;
        const gy = ground(p.x, p.z) - 0.5;
        const a = pylonGeo.clone(); a.translate(p.x, gy, p.z); PP.chrome.push(a);
        const b = ringGeo.clone(); b.translate(p.x, gy, p.z); PP.teal.push(b);
        nP++;
      }
    }
    if (PP.chrome.length) {
      const mc = new THREE.Mesh(mergeGeometries(PP.chrome, false), CM.chrome); mc.castShadow = true; mc.receiveShadow = true; world.add(mc);
      const mt = new THREE.Mesh(mergeGeometries(PP.teal, false), SM.teal); world.add(mt);
    }
    pylonGeo.dispose(); ringGeo.dispose();
    nB += nP;
  }
  for (const { mat, list } of cells.values()) {
    const mg = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    const mesh = new THREE.Mesh(mg, CM[mat]); mesh.castShadow = false; mesh.receiveShadow = true; world.add(mesh); nMesh++;
  }

  function sunH0() { const sd = tharsisSunDir(); return new THREE.Vector3(sd.x, 0, sd.z).normalize(); }
  // ── Animación: público, plataformas que flotan, nave-palco que se mece ──
  const fx = {
    t: 0,
    update(dt, camera) {
      this.t += dt; uni.uTime.value = this.t;
      for (const p of platforms) { p.grp.position.y = p.y0 + Math.sin(this.t * p.sp + p.ph) * 1.6; p.grp.rotation.y += dt * 0.03; p.grp.rotation.z = Math.sin(this.t * p.sp * 0.7 + p.ph) * 0.02; }
      liner.rotation.z = Math.sin(this.t * 0.2) * 0.012;
    },
  };

  // Intro: desde el cielo del atardecer sobre la ciudad, baja hacia el estadio y entra por la recta
  const sun = tharsisSunDir();
  const sunH = new THREE.Vector3(sun.x, 0, sun.z).normalize();
  track.sample(fAt(0.02), F); const grid = F.pos.clone();
  track.sample(fAt(0.1), F); const straight = F.pos.clone();
  const vMid = new THREE.Vector3(VOL[1][0], 5000, VOL[1][1]);
  const toV = vMid.clone().sub(centroid).setY(0).normalize();
  const introKeys = () => [
    [0.0, centroid.clone().addScaledVector(toV, -3200).setY(1100), vMid.clone(), 40],
    [4.2, centroid.clone().addScaledVector(toV, -1300).setY(380), centroid.clone().addScaledVector(toV, 2500).setY(500), 48],
    [7.4, straight.clone().addScaledVector(sunH, -650).setY(straight.y + 230), grid.clone().setY(grid.y + 10), 56],
    [9.5, grid.clone().addScaledVector(sunH, -160).setY(grid.y + 60), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] THARSIS SIERRA: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · gradas ${standLog.join(' ')} · público ${crowd.length} · edificios ${nB} en ${nMesh} mallas · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground, tunnel: false, introKeys, fx };
}
