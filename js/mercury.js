// CALORIS · Mercurio, nodo 04. Trazado de archivo (silueta digitalizada de la referencia, invertida en horizontal
// y en vertical), unos 8,3 km. La salida está en el fondo de un pozo abierto en la superficie, al sol; el resto de la
// vuelta corre por galerías industriales enterradas: naves de hormigón brutalista a escala desmesurada, luz mínima.
//   CALORIS SHAFT     parrilla en el fondo del cráter-pozo, terrazas de hormigón, el sol enorme encima
//   FOUNDRY HALLS     primeras naves: losas inclinadas, vigas, pasarelas, abismo bajo el tablero
//   THE TURN          horquilla de 180° dentro de un tubo dodecagonal (el de ENCELADUS, en oscuro)
//   COLUMN ROW        columnas que atraviesan el tablero: cada choque cuesta blindaje
//   THE WELL          puente sobre un pozo vertical que sube hasta la superficie (haz de sol) y baja a la niebla
//   PRESS LINE        prensas colgadas del techo hasta el tablero
//   THE RETURN        segunda horquilla en tubo
//   INFINITE GALLERY  la recta larga: galería alta y estrecha que se pierde en la bruma
// Obstáculos: track.obstacles (la IA los esquiva) y fx.passRings → { kind: 'obstacle' } (main.js aplica el daño).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { buildRaceRings } from './rings.js';
import { tubeMaterial } from './enceladus.js';
import { QUALITY } from './quality.js';

// Silueta de la referencia en píxeles (234×128), recorrida en el sentido de carrera.
// La horquilla izquierda se completa a mano (el contorno digitalizado la cerraba antes de la punta).
const REF = [[158.2, 109.4], [153.0, 109.4], [148.0, 108.0], [143.4, 105.8], [139.3, 102.5], [135.3, 99.1], [130.7, 98.9], [126.4, 101.6], [123.6, 105.6], [118.7, 105.6], [114.1, 103.3], [109.5, 101.0], [105.0, 98.4], [100.7, 95.7], [96.3, 92.9], [91.9, 90.1], [87.7, 87.0], [83.5, 83.9], [79.4, 80.6], [75.3, 77.4], [71.6, 73.6], [69.2, 69.0], [67.7, 64.1], [65.4, 59.5], [62.0, 55.5], [58.1, 52.0], [54.2, 48.3], [50.3, 44.7], [46.5, 41.1], [42.5, 37.6], [38.6, 34.0], [34.8, 30.4], [30.7, 27.8], [26.2, 25.7], [22.4, 23.6], [19.4, 23.7], [17.7, 22.3], [17.35, 20.1], [18.4, 18.25], [20.2, 17.5], [23.0, 17.6], [27.7, 18.5], [32.2, 19.9], [36.7, 21.8], [41.3, 23.3], [46.5, 24.0], [51.7, 24.5], [56.9, 25.1], [62.1, 25.8], [66.9, 27.6], [71.7, 29.5], [76.4, 31.5], [81.2, 33.3], [86.0, 35.3], [90.8, 37.1], [95.6, 39.1], [100.4, 41.0], [105.1, 42.9], [109.9, 44.8], [114.8, 46.6], [119.5, 48.6], [124.3, 50.4], [129.1, 52.4], [133.9, 54.3], [138.7, 56.2], [143.1, 58.8], [146.0, 63.0], [150.6, 65.3], [155.3, 67.5], [159.9, 68.4], [163.4, 70.8], [168.0, 73.0], [172.7, 75.1], [177.4, 77.2], [182.1, 79.4], [186.3, 82.5], [190.1, 86.2], [194.4, 89.2], [199.5, 89.6], [204.4, 87.9], [209.2, 86.0], [214.2, 85.4], [217.4, 89.0], [216.2, 93.8], [211.8, 96.4], [207.1, 98.7], [202.5, 101.1], [197.9, 103.3], [193.3, 105.7], [188.6, 107.9], [183.7, 109.1], [178.6, 108.3], [173.6, 106.9], [168.4, 107.4], [163.4, 108.5]];
const START = 69;                      // índice de la marca de meta (la cruz de la referencia)
const KPX = 17.5;                      // m por píxel → ~8,3 km de vuelta

export const MER = {
  R: 40000,                            // radio artístico de Mercurio (el real son 2440 km)
  Y_SHAFT: -175,                       // cota del tablero en el fondo del pozo
  RF: 395, RR: 540, STEPS: 4, RIM: 12, // pozo: radio del fondo, radio del borde, terrazas, cota del borde
  WELL_R: 120, WELL_BOT: -1500,        // pozo vertical de THE WELL
  TR: 22, TC: 8,                       // tubo de las horquillas (apotema y altura del eje)
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }
let _seed = 1;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

// ── Planta: Catmull-Rom cerrada por la silueta (girada 180°), remuestreada y suavizada ──
export function merPlan(step = 4) {
  const cx = REF.reduce((a, p) => a + p[0], 0) / REF.length, cy = REF.reduce((a, p) => a + p[1], 0) / REF.length;
  let C = REF.map(([x, y]) => new THREE.Vector3(-(x - cx) * KPX, 0, -(y - cy) * KPX));
  C = [...C.slice(START), ...C.slice(0, START)];
  const cr = new THREE.CatmullRomCurve3(C, true, 'centripetal');
  let P = cr.getSpacedPoints(3000); P.pop();
  const sm = (arr, W, passes) => { let a = arr; for (let p = 0; p < passes; p++) { const n = a.length; a = a.map((_, i) => { const v = new THREE.Vector3(); for (let k = -W; k <= W; k++) v.add(a[(i + k + n) % n]); return v.multiplyScalar(1 / (2 * W + 1)); }); } return a; };
  P = sm(P, 6, 7);
  const c2 = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = c2.getLength(), N = Math.round(L / step);
  const S = c2.getSpacedPoints(N); S.pop();
  const cum = [0]; for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + S[i].distanceTo(S[i - 1]));
  const total = cum[cum.length - 1] + S[0].distanceTo(S[S.length - 1]);
  return { S, cum, total };
}

// curvatura en planta por muestra (rad/m) y tramos de horquilla (|κ| media > 1/150 m en ±50 m)
function planCurv(S, step) {
  const n = S.length, yaw = S.map((_, i) => { const a = S[(i + 1) % n], b = S[(i - 1 + n) % n]; return Math.atan2(a.x - b.x, a.z - b.z); });
  const k = yaw.map((_, i) => { let d = yaw[(i + 2) % n] - yaw[(i - 2 + n) % n]; d = Math.atan2(Math.sin(d), Math.cos(d)); return d / (4 * step); });
  const W = Math.round(50 / step); const ka = k.map((_, i) => { let a = 0; for (let j = -W; j <= W; j++) a += Math.abs(k[(i + j + n) % n]); return a / (2 * W + 1); });
  return { k, ka };
}

// ─────────────────────────────────────────────────────────────
//  Superficie: regolito gris pardo con cráteres, curvatura del planeta y el pozo CALORIS escalonado
// ─────────────────────────────────────────────────────────────
function makeSurface(craters, Cc, well) {
  const R = MER.R;
  const drop = (x, z) => R - Math.sqrt(Math.max(0, R * R - x * x - z * z));
  const crat = (x, z) => {
    let h = 0;
    for (const c of craters) {
      const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > c.r * 1.6 || Math.abs(dz) > c.r * 1.6) continue;
      const d = Math.hypot(dx, dz) / c.r;
      if (d < 1) h += c.dep * (d * d - 1) * (1 - 0.25 * d * d);
      h += c.rim * Math.exp(-(((d - 1) / 0.22) ** 2));
    }
    return h;
  };
  const nat0 = (x, z) => 34 * (fbm(x / 2200, z / 2200, 3) - 0.5) + 9 * (fbm(x / 420 + 5, z / 420, 3) - 0.5) + 2.2 * (fbm(x / 60, z / 60, 2) - 0.5) + crat(x, z) - drop(x, z);
  // pozo: fondo plano, cuatro terrazas, borde levantado que se funde con el terreno
  const FLOOR = MER.Y_SHAFT - 5.5, SW = (MER.RR - MER.RF) / MER.STEPS, SH = (MER.RIM - FLOOR) / MER.STEPS;
  const ledge = (k) => FLOOR + k * SH;
  const shaft = (r) => {
    if (r < MER.RF) return FLOOR;
    const k = Math.min(MER.STEPS, Math.floor((r - MER.RF) / SW) + 1);
    return ledge(k);
  };
  const natural = (x, z) => {
    const n = nat0(x, z), r = Math.hypot(x - Cc.x, z - Cc.z);
    if (r > MER.RR + 420) return n;
    if (r < MER.RR) return shaft(r);
    const t = sstep(MER.RR, MER.RR + 420, r);
    return lerp(MER.RIM + 6 * Math.exp(-(((r - MER.RR - 30) / 40) ** 2)), n, t);
  };
  return { natural, nat0, FLOOR, SW, SH, ledge, drop };
}

const NOISE = /* glsl */`
  float mH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mH(i), mH(i+vec2(1,0)), f.x), mix(mH(i+vec2(0,1)), mH(i+vec2(1,1)), f.x), f.y); }
  float mF(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += mN(p) * w; p = p * 2.03 + vec2(1.7, 9.2); w *= 0.5; } return a; }
`;

// Regolito (fuera del pozo) y hormigón de las terrazas (dentro). Cápsulas: huecos para las bocas de las galerías
function groundMaterial(uni, Cc, caps) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.0 });
  const NC = 12;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCaps = { value: [...caps, ...Array(NC * 2).fill(0).map(() => new THREE.Vector4(0, -1e7, 0, 0))].slice(0, NC * 2) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vMW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vMW; uniform vec4 uCaps[${NC * 2}];
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  float mBump = 0.0;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${NC}; i++) { vec3 a = uCaps[i * 2].xyz, b = uCaps[i * 2 + 1].xyz; vec3 ab = b - a; float t = clamp(dot(vMW - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0); if (length(vMW - a - ab * t) < uCaps[i * 2].w) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vMW.xz;
          float aa = clamp(1.0 - length(fwidth(p)) / 6.0, 0.0, 1.0);
          float a = mF(p / 2400.0), b = mF(p / 260.0 + 3.0), c = mF(p / 14.0 + 7.0);
          vec3 col = mix(vec3(0.42, 0.39, 0.35), vec3(0.74, 0.69, 0.62), smoothstep(0.2, 0.85, a * 0.6 + b * 0.4));
          // rayos claros de cráteres jóvenes y manchas oscuras
          col = mix(col, vec3(0.9, 0.86, 0.78), smoothstep(0.62, 0.8, mF(p / 900.0 + 11.0)) * 0.5);
          col *= 0.85 + 0.3 * c;
          mBump = b * 4.0 + c * 1.2 * aa;
          // dentro del pozo: hormigón en placas con juntas y regueros
          float r = length(p - vec2(${Cc.x.toFixed(1)}, ${Cc.z.toFixed(1)}));
          float built = 1.0 - smoothstep(${(MER.RR + 6).toFixed(1)}, ${(MER.RR + 40).toFixed(1)}, r);
          vec2 q = p / vec2(12.0, 9.0); vec2 f = abs(fract(q) - 0.5);
          float seam = (1.0 - smoothstep(0.0, 0.03, 0.5 - max(f.x, f.y))) * aa;
          vec3 con = vec3(0.46, 0.44, 0.41) * (0.85 + 0.25 * mH(floor(q))) * (1.0 - 0.45 * seam);
          con *= 0.9 + 0.2 * mN(p / 3.0);
          col = mix(col, con, built);
          diffuseColor.rgb = col;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(mBump), hy = dFdy(mBump);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`);
  };
  m.customProgramCacheKey = () => 'merGround';
  return m;
}

// Hormigón brutalista de las naves: placas de 12 × 9 m con juntas, agujeros de encofrado, regueros, franjas de peligro
// y líneas de luz punteada (la luz mínima de las galerías). uv.x: perímetro (m) · uv.y: recorrido (m)
// opts.ceil: techo (más oscuro, artesonado) · opts.floor: fondo del abismo · opts.holes: huecos (pozo)
function concreteMaterial(uni, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.04, side: THREE.DoubleSide });
  const NH = 2;
  m.userData.holes = opts.holes || [];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.uniforms.uHoles = { value: [...m.userData.holes, ...Array(NH * 3).fill(0).map(() => new THREE.Vector4(0, 0, 0, -1))].slice(0, NH * 3) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCu; varying vec3 vCW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vCu = uv; vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vCu; varying vec3 vCW; uniform float uT; uniform vec4 uHoles[${NH * 3}];
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  vec3 cGlow = vec3(0.0); float cSeam = 0.0;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        // huecos rectangulares (bocas de las galerías en el pozo): centro+semiancho, derecha, tangente hacia fuera+cota baja, cota alta
        for (int i = 0; i < ${NH}; i++) { vec4 c = uHoles[i * 3], r = uHoles[i * 3 + 1], t = uHoles[i * 3 + 2]; if (t.w < 0.0 && c.w <= 0.0) continue;
          vec3 d = vCW - c.xyz; if (abs(dot(d, r.xyz)) < c.w && vCW.y > r.w && vCW.y < t.w && dot(d, t.xyz) > -40.0) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vCu.x, s = vCu.y;
          float fw = length(fwidth(vec2(u, s)));
          float aa = clamp(1.25 - fw * 2.5, 0.0, 1.0);
          vec2 q = vec2(s / 12.0, u / 9.0); vec2 cell = floor(q); vec2 f = fract(q);
          float e = min(min(f.x, 1.0 - f.x) * 12.0, min(f.y, 1.0 - f.y) * 9.0);
          cSeam = (1.0 - smoothstep(0.04, 0.16, e)) * aa;
          float pv = mH(cell);
          vec3 col = vec3(${opts.ceil ? '0.16, 0.157, 0.152' : opts.floor ? '0.08, 0.078, 0.076' : '0.34, 0.33, 0.315'}) * (0.82 + 0.3 * pv);
          // regueros verticales (la lluvia de polvo y aceite de siglos) y manchas
          float streak = mN(vec2(s * 0.45, u * 0.012 + pv * 7.0)) * mN(vec2(s * 0.08 + 3.0, u * 0.05));
          col *= 1.0 - 0.35 * smoothstep(0.3, 0.75, streak);
          col *= 0.88 + 0.24 * mF(vec2(s, u) / 40.0);
          // agujeros de encofrado: 3 × 2 por placa
          vec2 g = fract(q * vec2(3.0, 2.0)) - 0.5;
          float tie = (1.0 - smoothstep(0.035, 0.06, length(g * vec2(4.0, 4.5) / vec2(3.0, 2.0)))) * aa * aa;
          col *= 1.0 - 0.55 * tie - 0.5 * cSeam;
          ${opts.ceil || opts.floor ? '' : `
          // franja de peligro en el zócalo de algunos tramos
          float hz = mix(0.5, step(0.5, fract((u + s) / 2.2)), aa);
          float band = step(abs(u - 4.0), 0.9) * step(0.7, mH(vec2(floor(s / 96.0), 3.0)));
          col = mix(col, mix(vec3(0.03), vec3(0.78, 0.5, 0.06), hz), band * 0.9);
          // líneas de luz punteada: una junta horizontal de cada cuatro, puntos de 1,2 m cada 4 m
          float row = floor(u / 9.0 + 0.5);
          float onRow = step(mod(row, 4.0), 0.5) * step(1.0, row);
          // de lejos la fila se ensancha a un píxel y se promedia (sin chispeo)
          float lw = max(0.3, fw * 0.9), farK = smoothstep(0.25, 0.9, fw);
          float dy = abs(u - row * 9.0);
          float lband = (1.0 - smoothstep(lw * 0.6, lw, dy)) * 0.3 / lw;
          float dots = 1.0 - smoothstep(0.45, 0.6, abs(fract(s / 4.0) - 0.5) * 4.0);
          float dot1 = lband * mix(dots, 0.33, farK);
          float lit = step(0.18, mH(vec2(floor(s / 60.0), row)));
          cGlow += vec3(0.85, 0.92, 1.0) * dot1 * onRow * lit * 2.6;
          // placas retroiluminadas sueltas (como las de la referencia): luz blanca difusa muy baja
          float bl = step(0.986, mH(cell + 31.0));
          cGlow += vec3(0.8, 0.84, 0.88) * bl * (0.2 + 0.1 * mN(vec2(s, u) / 3.0)) * (1.0 - cSeam);
          // ventanucos de servicio encendidos, muy raros
          float w = step(0.985, mH(cell + 13.0)) * step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.55);
          cGlow += vec3(1.0, 0.62, 0.26) * w * 1.6;`}
          ${opts.floor ? `
          // el fondo: luces sueltas muy abajo (escala)
          float sp = step(0.992, mH(floor(vec2(s, u) / 6.0)));
          cGlow += mix(vec3(1.0, 0.55, 0.2), vec3(0.6, 0.85, 1.0), mH(floor(vec2(s, u) / 6.0) + 2.0)) * sp * 2.0;` : ''}
          ${opts.ceil ? `
          // rejillas del techo con luz fría de vez en cuando
          float gr = step(0.93, mH(cell + 5.0)) * (0.5 + 0.5 * mix(0.5, step(0.5, fract(s / 1.2)), aa));
          cGlow += vec3(0.6, 0.75, 0.9) * gr * 0.5;` : ''}
          ${opts.rings ? `
          // pozo: anillos de luz punteada cada 40 m de altura
          float rr = abs(fract(vCW.y / 40.0) - 0.5) * 40.0;
          float rw = max(0.35, fw * 0.9);
          float rd = (1.0 - smoothstep(rw * 0.6, rw, abs(rr - 20.0))) * 0.35 / rw;
          cGlow += vec3(0.9, 0.95, 1.0) * rd * mix(1.0 - smoothstep(0.45, 0.6, abs(fract(u / 3.0) - 0.5) * 3.0), 0.4, smoothstep(0.25, 0.9, fw)) * 2.4;` : ''}
          diffuseColor.rgb = col;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 1.0, cSeam);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += cGlow + diffuseColor.rgb * vec3(0.11, 0.11, 0.115);`);
  };
  m.customProgramCacheKey = () => 'merCon' + (opts.ceil ? 'c' : '') + (opts.floor ? 'f' : '') + (opts.rings ? 'r' : '') + (opts.holes ? 'h' : '');
  return m;
}

// Haces de luz en la bruma (rejillas del techo, el sol que entra por el pozo)
function beamMaterial(uni, col, k = 0.08) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT, uCol: { value: new THREE.Vector3(...col) }, uK: { value: k } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vD = length(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uK; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        #include <logdepthbuf_fragment>
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float y = vUv.y;
        float along = smoothstep(0.0, 0.05, y) * pow(1.0 - y, 1.4);
        along *= 0.8 + 0.2 * sin(vUv.x * 40.0 + y * 9.0 + uT * 0.4);
        float near = smoothstep(8.0, 70.0, vD);
        gl_FragColor = vec4(uCol * core * along * uK * near, 1.0);
      }`,
  });
}

// Mercurio entero (intro): regolito con cráteres y rayos; lado nocturno negro
function planetMaterial(center, sun) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sun } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uC, uSun; varying vec3 vW;
      ${NOISE}
      float crat(vec2 p){ vec2 g = floor(p), f = fract(p); float d = 9.0, r = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 c = o + vec2(mH(g + o), mH(g + o + 4.1)) - f; float rr = 0.15 + 0.3 * mH(g + o + 9.3); float dd = length(c) / rr; if (dd < d) { d = dd; r = rr; } }
        return d; }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        vec2 q = vec2(atan(n.z, n.x), asin(clamp(n.y, -1.0, 1.0))) * 6.0;
        float a = mF(q + 2.0), b = mF(q * 5.0 + 1.0);
        vec3 col = mix(vec3(0.34, 0.31, 0.28), vec3(0.78, 0.72, 0.64), smoothstep(0.2, 0.85, a * 0.6 + b * 0.4));
        float c1 = crat(q * 3.0), c2 = crat(q * 11.0 + 3.0);
        col *= 0.75 + 0.25 * smoothstep(0.6, 1.0, c1) + 0.2 * (1.0 - smoothstep(0.85, 1.05, abs(c1 - 1.0) + 0.9));
        col *= 0.85 + 0.15 * smoothstep(0.5, 1.0, c2);
        col = mix(col, vec3(0.7, 0.67, 0.62), smoothstep(0.66, 0.82, mF(q * 2.0 + 8.0)) * 0.45);
        float lam = dot(n, uSun), day = smoothstep(-0.02, 0.18, lam) * max(lam, 0.0);
        vec3 c = col * (0.002 + 1.6 * day);
        float rim = pow(1.0 - max(0.0, dot(n, V)), 6.0);
        c += vec3(1.0, 0.7, 0.4) * rim * smoothstep(-0.25, 0.1, lam) * 0.25;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// El Sol desde Mercurio: enorme, granulación turbulenta naranja y amarilla, oscurecimiento del limbo y borde vivo
function sunMaterial(uni, center) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uT: uni.uT, uC: { value: center } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW; varying vec3 vL;
      void main(){ vL = position; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; uniform vec3 uC; varying vec3 vW; varying vec3 vL;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vL), V = normalize(cameraPosition - vW);
        float mu = max(0.0, dot(normalize(vW - uC), V));
        // triplanar (sin el remolino de los polos de una proyección esférica)
        vec3 w3 = pow(abs(n), vec3(4.0)); w3 /= w3.x + w3.y + w3.z;
        float gran = 0.0;
        for (int k = 0; k < 3; k++) {
          vec2 q = k == 0 ? n.yz : k == 1 ? n.zx : n.xy;
          q *= 9.0;
          float g = mF(q * 6.0 + vec2(uT * 0.02, 0.0)) * 0.45 + mF(q * 22.0 - vec2(0.0, uT * 0.05)) * 0.35 + mF(q * 60.0 + uT * 0.08) * 0.2;
          gran += g * (k == 0 ? w3.x : k == 1 ? w3.y : w3.z);
        }
        vec3 hot = vec3(1.0, 0.74, 0.3), mid = vec3(0.95, 0.36, 0.04), dark = vec3(0.42, 0.07, 0.0);
        vec3 col = mix(dark, mid, smoothstep(0.25, 0.55, gran));
        col = mix(col, hot, smoothstep(0.55, 0.8, gran));
        float limb = pow(mu, 0.45);
        col *= 0.35 + 0.65 * limb;
        col += vec3(1.0, 0.75, 0.3) * pow(1.0 - mu, 8.0) * 0.8;
        gl_FragColor = vec4(col * 1.15, 1.0);
      }`,
  });
}

// ─────────────────────────────────────────────────────────────
//  Trazado: cotas por tramo
// ─────────────────────────────────────────────────────────────
// cota objetivo del tablero por fracción de vuelta (bajo el pozo; se mezcla con su fondo cerca de la salida)
const YK = [[0, -175], [0.03, -178], [0.1, -236], [0.125, -240], [0.165, -242], [0.24, -262], [0.31, -284], [0.37, -282], [0.43, -300], [0.47, -300],
  [0.53, -250], [0.6, -240], [0.645, -250], [0.69, -250], [0.75, -262], [0.8, -296], [0.835, -292], [0.9, -200], [0.925, -178], [1, -175]];
const yKey = (f) => { for (let i = 1; i < YK.length; i++) if (f <= YK[i][0]) { const [a, ya] = YK[i - 1], [b, yb] = YK[i]; const t = (f - a) / (b - a); return lerp(ya, yb, t * t * (3 - 2 * t)); } return YK[0][1]; };

export function merLayout() {
  const { S, cum, total } = merPlan(4);
  const N = S.length, f = (i) => cum[i] / total;
  const { k, ka } = planCurv(S, 4);
  // centro del pozo: sobre la recta de meta, 270 m antes de la línea
  const iC = S.findIndex((_, i) => cum[i] >= total - 270);
  const Cc = S[iC].clone();
  // pozo vertical de THE WELL: el punto más recto entre 0,4 y 0,47 de la vuelta
  let iW = 0, best = Infinity; for (let i = 0; i < N; i++) if (f(i) > 0.4 && f(i) < 0.47 && ka[i] < best) { best = ka[i]; iW = i; }
  const Wc = S[iW].clone();
  let y = S.map((p, i) => {
    const r = Math.hypot(p.x - Cc.x, p.z - Cc.z);
    return lerp(yKey(f(i)), MER.Y_SHAFT, 1 - sstep(MER.RF + 30, MER.RF + 260, r));
  });
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -10; k <= 10; k++) a += y[(i + k + N) % N]; return a / 21; });
  // en el fondo del pozo, plano exacto
  y = y.map((v, i) => { const r = Math.hypot(S[i].x - Cc.x, S[i].z - Cc.z); return lerp(v, MER.Y_SHAFT, 1 - sstep(MER.RF - 20, MER.RF + 40, r)); });
  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  // horquillas: tramos con curvatura media alta
  const hp = []; let st = -1;
  for (let i = 0; i <= N; i++) { const on = i < N && ka[i] > 1 / 150; if (on && st < 0) st = i; if (!on && st >= 0) { let turn = 0; for (let j = st; j < i; j++) turn += k[j] * 4; if (cum[i - 1] - cum[st] > 80 && Math.abs(turn) > 2.3) hp.push([f(st), f(i - 1)]); st = -1; } }
  return { S, cum, total, y, pts, Cc, Wc, fW: f(iW), hp };
}

const HW = 17.6;
// El sol: alto (51°) y de frente sobre la recta de meta, para que la intro llegue desde el lado nocturno por la prolongación
// de la recta y la parrilla mire al sol
let SUN = null;
function sunDirFromLayout() {
  if (SUN) return SUN;
  const { S, cum, total } = merPlan(4);
  const at = (d) => S[Math.max(0, cum.findIndex((c) => c >= total - d))];
  const a = at(700), b = at(350), ax = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), el = 0.89;
  SUN = new THREE.Vector3(ax.x * Math.cos(el), Math.sin(el), ax.z * Math.cos(el)).normalize();
  return SUN;
}
const SUN_D = 1.9e6, SUN_R = 360000;                                // ~11° de radio aparente: el sol de Mercurio, desmesurado
export function mercurySunDir() { return sunDirFromLayout().clone(); }

export function buildMercury(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 47;
  sunDirFromLayout();
  const lite = QUALITY.lite;
  const lay = merLayout();
  const { Cc, Wc } = lay;
  const track = new Track(null, { points: lay.pts, inSectorOrder: false, sectors: [0, 0.16, 0.33, 0.5, 0.66, 0.83],
    bank: (fq, k) => THREE.MathUtils.clamp(k * 30, -0.16, 0.16) });
  const F = track.frame(), L = track.length;
  const P3 = (q, x = 0, h = 0) => { track.sample(q, F); return F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h); };
  const sOfF = (fr) => fr * L;
  const uni = { uT: { value: 0 } };

  // ── Muestras de la pista (cada 4 m) e índice espacial ──
  const smp = [];
  for (let q = 0; q < L; q += 4) { track.sample(q, F); smp.push({ s: q, p: F.pos.clone(), r: F.right.clone(), u: F.up.clone(), t: F.tan.clone() }); }
  const CELL = 60, hash = new Map();
  smp.forEach((q, i) => { const k = `${Math.floor(q.p.x / CELL)},${Math.floor(q.p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const nearXZ = (x, z, rad = 150, skip = null) => {
    let best = null, bd = Infinity; const n = Math.ceil(rad / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = hash.get(`${cx + a},${cz + b}`); if (l) for (const i of l) { const q = smp[i]; if (skip && skip(q)) continue; const d = (q.p.x - x) ** 2 + (q.p.z - z) ** 2; if (d < bd) { bd = d; best = q; } } }
    return { q: best, d: Math.sqrt(bd) };
  };
  const distC = (p) => Math.hypot(p.x - Cc.x, p.z - Cc.z);

  // ── Tramos ──
  const sW = (() => { let b = 0, bd = Infinity; for (const q of smp) { const d = Math.hypot(q.p.x - Wc.x, q.p.z - Wc.z); if (d < bd) { bd = d; b = q.s; } } return b; })();
  const tubes = lay.hp.map(([a, b]) => [sOfF(a) - 70, sOfF(b) + 70]);
  // bocas del pozo: donde la pista sale del fondo (radio RF)
  let mouthOut = 0, mouthIn = L;
  for (let q = 0; q < L / 2; q += 2) if (distC(P3(q)) > MER.RF) { mouthOut = q; break; }
  for (let q = L; q > L / 2; q -= 2) if (distC(P3(q)) > MER.RF) { mouthIn = q; break; }
  const inRange = (q, a, b) => { const d = track.delta(a, q); return d >= 0 && d <= track.delta(a, b) + (b < a ? L : 0); };
  const inTube = (q) => tubes.some(([a, b]) => inRange(track.wrap(q), track.wrap(a), track.wrap(b)));
  const open = (q) => inRange(track.wrap(q), mouthIn, mouthOut + L);           // a cielo abierto, en el pozo
  const WR = MER.WELL_R;
  const inWell = (q) => Math.abs(track.delta(sW, q)) < WR;
  // obstáculos: dos campos en tramos amplios (lejos de las filas de esferas y de las horquillas)
  const sCol = sOfF(0.235), sPress = sOfF(0.545), sRing = sOfF(0.395), sInf = tubes.length > 1 ? tubes[1][1] + 120 : sOfF(0.7);

  // ── Superficie con cráteres (lejos de la pista: las naves siempre tienen roca encima) ──
  const craters = [];
  for (let k = 0, tries = 0; k < (lite ? 70 : 120) && tries < 4000; tries++) {
    const r = 40 + Math.pow(rnd(), 2.6) * 900, x = (rnd() - 0.5) * 16000, z = (rnd() - 0.5) * 14000;
    if (Math.hypot(x - Cc.x, z - Cc.z) < MER.RR + r + 250 || Math.hypot(x - Wc.x, z - Wc.z) < WR + r + 120) continue;
    const { d } = nearXZ(x, z, Math.min(1500, r * 1.2 + 160));
    if (d < r * 1.15 + 130 && r > 110) continue;
    craters.push({ x, z, r, dep: Math.min(0.17 * r, r < 110 ? 18 : 200), rim: 0.045 * r }); k++;
  }
  const SF = makeSurface(craters, Cc, Wc);
  const { natural } = SF;

  // ── Galería por muestra: semiancho W, altura del techo H y profundidad del abismo D (sobre el tablero) ──
  // kind: 'open' pozo · 'tube' horquilla · 'well' pozo vertical · 'tunnel' bocas · 'hall' nave
  const G6 = []; const STEP = 6;
  for (let q = 0; q < L; q += STEP) {
    track.sample(q, F);
    const p = F.pos.clone(), tH = F.tan.clone().setY(0).normalize(), rH = new THREE.Vector3().crossVectors(tH, new THREE.Vector3(0, 1, 0)).normalize();
    const dc = distC(p);
    let kind = open(q) && dc < MER.RF - 2 ? 'open' : inTube(q) ? 'tube' : inWell(q) ? 'well' : 'hall';
    const fq = q / L;
    // diseño por tramo
    let W = 66 + 22 * (fbm(q / 520, 3.3, 2) - 0.5), H = 115, D = 120;
    if (fq < 0.16) { W = 56; H = 92; D = 95; }                                              // FOUNDRY HALLS
    if (fq > 0.33 && fq < 0.37) { W = 42; H = 70; D = 70; }                                // eses
    if (Math.abs(track.delta(sW, q)) < 420) { W = 64; H = 104; D = 150; }                  // junto al pozo
    if (fq > 0.48 && fq < 0.66) { W = 86; H = 150; D = 170; }                              // la nave mayor, PRESS LINE
    if (track.delta(sInf, q) > 0 && track.delta(sInf, q) < track.delta(sInf, mouthIn) - 250) { W = 40; H = 118; D = 55; }   // INFINITE GALLERY
    // bocas del pozo: túnel estrecho hasta salir de las terrazas
    const tunnelK = 1 - sstep(MER.RR + 60, MER.RR + 260, dc);
    W = lerp(W, 22, tunnelK); H = lerp(H, 17, tunnelK); D = lerp(D, 3.5, tunnelK);
    if (kind === 'hall' && tunnelK > 0.98) kind = 'tunnel';
    G6.push({ q, p, tH, rH, kind, W, H, D, dc, k: Math.abs(F.kappa) });
  }
  const NG = G6.length;
  // límites: radio de curva (lado interior), holgura con otros tramos, roca encima
  {
    const lim = G6.map((g, i) => {
      let kmax = 0; for (let j = -10; j <= 10; j++) kmax = Math.max(kmax, G6[(i + j + NG) % NG].k);
      return kmax > 1e-5 ? 0.82 / kmax : 1e9;
    });
    // holgura: distancia en planta al resto de la pista (excluyendo ±260 m)
    const clr = G6.map((g) => nearXZ(g.p.x, g.p.z, 500, (o) => Math.abs(track.delta(o.s, g.q)) < 260).d);
    let W = G6.map((g, i) => Math.min(g.W, lim[i]));
    W = W.map((w, i) => (isFinite(clr[i]) ? Math.min(w, Math.max(22, clr[i] - Math.max(26, Math.min(clr[i] / 2, 90)) - 10)) : w));
    // roca encima: el techo a 25 m bajo el terreno (centro y costados)
    const Hl = G6.map((g, i) => { let t = Infinity; for (const x of [-W[i], 0, W[i]]) t = Math.min(t, natural(g.p.x + g.rH.x * x, g.p.z + g.rH.z * x)); return t - 25 - g.p.y; });
    // suavizado conservador: mínimo móvil y luego media (nunca supera el límite)
    const ero = (a, w) => a.map((_, i) => { let m = Infinity; for (let k = -w; k <= w; k++) m = Math.min(m, a[(i + k + NG) % NG]); return m; });
    const avg = (a, w) => a.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += a[(i + k + NG) % NG]; return s / (2 * w + 1); });
    W = avg(ero(W, 12), 12);
    let H = avg(ero(G6.map((g, i) => Math.max(16, Math.min(g.H, Hl[i]))), 10), 10);
    let D = avg(ero(G6.map((g) => g.D), 10), 10);
    G6.forEach((g, i) => { g.W = Math.max(21, W[i]); g.H = Math.max(15, H[i]); g.D = Math.max(3, D[i]); });
  }
  const gAt = (q) => G6[Math.floor(track.wrap(q) / STEP) % NG];

  // ── Bocas de las galerías en la pared del pozo: cápsulas que vacían el terreno ──
  const caps = [];
  for (const [q, dir] of [[mouthOut, 1], [mouthIn, -1]]) {
    for (let k = -1; k < 4; k++) {
      const a = P3(q + dir * k * 40, 0, 8), b = P3(q + dir * (k + 1) * 40, 0, 8);
      caps.push(new THREE.Vector4(a.x, a.y, a.z, 24), new THREE.Vector4(b.x, b.y, b.z, 0));
    }
  }
  const ground = groundMaterial(uni, Cc, caps); own.push(ground);

  // ── Malla del terreno (losetas) ──
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const q of smp) { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); bz0 = Math.min(bz0, q.p.z); bz1 = Math.max(bz1, q.p.z); }
  const gx0 = bx0 - 1800, gx1 = bx1 + 1800, gz0 = bz0 - 1800, gz1 = bz1 + 1800;
  const GRES = lite ? 16 : 9;
  const wellHole = (x, z) => Math.hypot(x - Wc.x, z - Wc.z) < WR + 3;
  const heightGrid = (fn, RES, mat, shadow, B, hole = null) => {
    const [x0, x1, z0, z1] = B;
    const nx = Math.ceil((x1 - x0) / RES), nz = Math.ceil((z1 - z0) / RES);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * RES, z = z0 + j * RES, o = (j * (nx + 1) + i) * 3; pos[o] = x; pos[o + 1] = fn(x, z); pos[o + 2] = z; }
    const idx = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const full = new THREE.BufferGeometry(); full.setAttribute('position', new THREE.BufferAttribute(pos, 3)); full.setIndex(idx); full.computeVertexNormals();
    const nrm = full.attributes.normal.array; full.dispose();
    const TS = 96;
    for (let j0 = 0; j0 < nz; j0 += TS) for (let i0 = 0; i0 < nx; i0 += TS) {
      const i1 = Math.min(nx, i0 + TS), j1 = Math.min(nz, j0 + TS), w = i1 - i0 + 1, hh = j1 - j0 + 1;
      const tp = new Float32Array(w * hh * 3), tn = new Float32Array(w * hh * 3), ti = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const src = (j * (nx + 1) + i) * 3, dst = ((j - j0) * w + (i - i0)) * 3; for (let c = 0; c < 3; c++) { tp[dst + c] = pos[src + c]; tn[dst + c] = nrm[src + c]; } }
      for (let j = 0; j < hh - 1; j++) for (let i = 0; i < w - 1; i++) { if (hole && hole(x0 + (i0 + i + 0.5) * RES, z0 + (j0 + j + 0.5) * RES)) continue; const a = j * w + i, b = a + 1, c = a + w, d = c + 1; ti.push(a, c, b, b, c, d); }
      if (!ti.length) continue;
      const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.BufferAttribute(tp, 3)); gt.setAttribute('normal', new THREE.BufferAttribute(tn, 3)); gt.setIndex(ti); gt.computeBoundingSphere();
      const mesh = new THREE.Mesh(gt, mat); mesh.receiveShadow = true; mesh.castShadow = shadow; world.add(mesh); own.push(gt);
    }
  };
  heightGrid(natural, GRES, ground, !lite, [gx0, gx1, gz0, gz1], wellHole);
  const OUT = 30000, ORES = lite ? 900 : 500;
  const inInner = (x, z) => x > gx0 + 2 && x < gx1 - 2 && z > gz0 + 2 && z < gz1 - 2;
  heightGrid((x, z) => (inInner(x, z) ? natural(x, z) : SF.nat0(x, z) - 3 - 600 * sstep(OUT - 7000, OUT, Math.hypot(x, z))), ORES, ground, false, [-OUT, OUT, -OUT, OUT], (x, z) => inInner(x - ORES * 0.5, z - ORES * 0.5) && inInner(x + ORES * 0.5, z + ORES * 0.5) || Math.hypot(x, z) > OUT);

  // ── Mercurio entero (intro y horizonte), fuera de lo que cubre la malla fina ──
  const MC = new THREE.Vector3(0, -MER.R, 0);
  {
    const pm = planetMaterial(MC, SUN); own.push(pm);
    const sg = new THREE.SphereGeometry(MER.R, lite ? 160 : 256, lite ? 80 : 128);
    sg.translate(0, -MER.R - 40, 0);
    const p = sg.attributes.position, idx = sg.index.array, keep = [];
    const inside = (i) => p.getY(i) > -MER.R && Math.hypot(p.getX(i), p.getZ(i)) < OUT - 7500;
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    sg.setIndex(keep); sg.deleteAttribute('uv'); sg.computeBoundingSphere();
    const mesh = new THREE.Mesh(sg, pm); mesh.frustumCulled = false; mesh.renderOrder = -1; world.add(mesh); own.push(sg);
  }
  // el Sol y su corona
  const sunC = SUN.clone().multiplyScalar(SUN_D);
  const softDot = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  own.push(softDot);
  {
    const sm = sunMaterial(uni, sunC); own.push(sm);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 96, 48), sm); sun.position.copy(sunC); sun.frustumCulled = false; sun.renderOrder = -3; world.add(sun); own.push(sun.geometry);
    for (const [sc, col, op] of [[2.6, 0xffb060, 0.55], [6.5, 0xff7a20, 0.28]]) {
      const mat = new THREE.SpriteMaterial({ map: softDot, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat); sp.position.copy(sunC); sp.scale.setScalar(SUN_R * sc); sp.renderOrder = -2; sp.frustumCulled = false; world.add(sp); own.push(mat);
    }
  }
  // estrellas (pocas: el sol lo apaga todo)
  {
    const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      if (v.dot(SUN) > 0.8) v.negate();
      v.multiplyScalar(6.5e6); pos.set([v.x, v.y, v.z], i * 3);
      const b = 0.2 + Math.pow(rnd(), 5) * 1.8; col.set([b, b * 0.97, b * 0.92], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const stp = new THREE.Points(gg, sm); stp.frustumCulled = false; stp.renderOrder = -4; world.add(stp); own.push(gg, sm);
  }

  // ── Tablero ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x55585b))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xa9a69f))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x2a2b2d)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xc8c6c0)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.62, 0.28); m.emissiveIntensity = 2.4; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed, opts = {}) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [], cen = opts.center !== undefined ? [] : null;
    for (let r = 0; r <= rows; r++) {
      const q = s0 + (s1 - s0) * r / rows; track.sample(q, F);
      let per = 0;
      prof.forEach(([x, h], k) => {
        pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
        if (cen) cen.push(F.pos.x + F.up.x * opts.center, F.pos.y + F.up.y * opts.center, F.pos.z + F.up.z * opts.center);
        if (k) per += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);
        uv.push(opts.uPer ? per : k / (m - 1), opts.uPer ? q : q / 20);
      });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
    if (cen) gg.setAttribute('aC', new THREE.Float32BufferAttribute(cen, 3));
    gg.computeVertexNormals();
    return gg;
  };
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  parts.deck.push(sweepSeg(0, L, 3, deckProf, true));
  parts.guard.push(sweepSeg(0, L, 3, wallL, false), sweepSeg(0, L, 3, wallR, false));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  const boxAt = (q, x, h, w, hh, d, list) => {
    track.sample(q, F);
    const bx = new THREE.BoxGeometry(w, hh, d);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx); return bx;
  };
  for (let q = 5; q < L; q += 24) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let q = 0; q < L; q += 14) boxAt(q, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (const sc of track.sectors) { const q = sc.s + (sc.id === 1 ? 6 : 0); if (gAt(q).H < 17 || inTube(q)) continue; for (const x of [-17.6, 17.6]) boxAt(q, x, 7.5, 0.9, 15, 0.9, parts.frame); boxAt(q, 0, 15.2, 36, 0.4, 1.2, parts.gate); }
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh); own.push(merged);
  }

  // ── Materiales de las naves ──
  const CW = concreteMaterial(uni), CC = concreteMaterial(uni, { ceil: true }), CF = concreteMaterial(uni, { floor: true });
  const SM = {
    steel: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.75 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x5c5d5f, roughness: 0.7, metalness: 0.3, emissive: 0x0b0b0c }),
    slab: new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.9, metalness: 0.05, emissive: 0x070707 }),
    pale: new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85, metalness: 0.05, emissive: 0x2a2826 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xc98a12, roughness: 0.55, metalness: 0.1, emissive: 0x2a1802 }),
    cold: new THREE.MeshStandardMaterial({ color: 0x101820, emissive: 0xdfeaff, emissiveIntensity: 3.0 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xffa04a, emissiveIntensity: 3.2 }),
    red: new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff2a14, emissiveIntensity: 3.4 }),
  };
  own.push(CW, CC, CF, ...Object.values(SM));
  const arch = { steel: [], grey: [], slab: [], pale: [], hazard: [], cold: [], warm: [], red: [] };
  const cyl = (a, b, r, list, seg = 10, r2 = r) => {
    const d = b.clone().sub(a), len = d.length(); if (len < 0.1) return;
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, false); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); list.push(g);
  };
  // caja orientada en el marco horizontal de la galería: centro (x lateral, h sobre el tablero), tamaños (lateral, alto, a lo largo)
  const hbox = (g, x, h, w, hh, d, list, rotZ = 0) => {
    const bx = new THREE.BoxGeometry(w, hh, d); if (rotZ) bx.rotateZ(rotZ);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(g.rH, new THREE.Vector3(0, 1, 0), g.tH));
    bx.translate(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); list.push(bx); return bx;
  };

  // ── Naves: paredes, techo y fondo barridos en el marco horizontal (no se inclinan con el peralte) ──
  const runs = [];                                    // tramos continuos de galería (hall/tunnel)
  { let st = null; for (let i = 0; i <= NG; i++) { const g = G6[i % NG], on = i < NG && (g.kind === 'hall' || g.kind === 'tunnel'); if (on && st === null) st = i; if ((!on || i === NG) && st !== null) { runs.push([st, i - 1]); st = null; } } }
  // une el último tramo con el primero si la vuelta los conecta
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === NG - 1) { const last = runs.pop(); runs[0] = [last[0] - NG, runs[0][1]]; }
  const sweepHall = (i0, i1, profFn, mat, shadow) => {
    const pos = [], uv = [], idx = []; let m = 0;
    for (let i = i0; i <= i1; i++) {
      const g = G6[(i + NG) % NG], prof = profFn(g); m = prof.length;
      let per = 0;
      prof.forEach(([x, h], k) => { pos.push(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); if (k) per += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]); uv.push(per, i * STEP); });
    }
    const rows = i1 - i0;
    for (let r = 0; r < rows; r++) for (let k = 0; k < m - 1; k++) { const a = r * m + k, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, mat); mesh.receiveShadow = true; mesh.castShadow = shadow && !lite; world.add(mesh); own.push(gg);
  };
  for (const [a, b] of runs) {
    // paredes (con el perímetro medido desde el fondo: las líneas de luz caen a alturas fijas sobre el abismo)
    sweepHall(a, b, (g) => [[g.W, -g.D], [g.W, g.H - 6], [g.W - 6, g.H]], CW, true);
    sweepHall(a, b, (g) => [[-g.W + 6, g.H], [-g.W, g.H - 6], [-g.W, -g.D]].reverse(), CW, true);
    sweepHall(a, b, (g) => [[-g.W + 6, g.H], [-g.W * 0.35, g.H + 4], [g.W * 0.35, g.H + 4], [g.W - 6, g.H]], CC, true);
    sweepHall(a, b, (g) => [[-g.W, -g.D], [g.W, -g.D]], CF, false);
  }
  // mamparos en los extremos de cada tramo: el muro con un hueco para la pista (o la boca del tubo)
  const bulkhead = (g, dir, hole) => {
    const [hw, hb, ht] = hole;                                   // semiancho del hueco y cotas (sobre el tablero)
    const W = g.W - 0.35, H = g.H + 3.6, D = g.D - 0.35;
    const sl = [[(-W - hw) / 2, (-D + H) / 2, W - hw, H + D], [(W + hw) / 2, (-D + H) / 2, W - hw, H + D], [0, (ht + H) / 2, hw * 2, H - ht], [0, (hb - D) / 2, hw * 2, hb + D]];
    for (const [x, h, w, hh] of sl) if (w > 0.5 && hh > 0.5) hbox(g, x, h, w, hh, 2.5, arch.slab);
    hbox(g, 0, ht + 1.2, hw * 2 + 4, 2.4, 3.2, arch.steel); hbox(g, 0, ht - 0.5, hw * 2, 0.35, 3.4, arch.warm);
    void dir;
  };
  for (const [a, b] of runs) {
    for (const [i, dir] of [[a, 1], [b, -1]]) {
      const g = G6[(i + NG) % NG], nb = G6[(i - dir + NG) % NG];
      if (nb.kind === 'open' || nb.kind === 'well') continue;   // la boca del pozo lleva su pórtico; el pozo vertical, su hueco
      bulkhead(g, dir, nb.kind === 'tube' ? [MER.TR + 2, -MER.TR + MER.TC - 2, MER.TC + MER.TR + 2] : [g.W * 0.82, -g.D * 0.8, g.H * 0.8]);
    }
  }

  // ── Vestido de las naves: vigas, losas inclinadas, pasarelas, tuberías, péndolas, luces ──
  const hallG = G6.filter((g) => g.kind === 'hall');
  const beamsCold = [], beamsWarm = [];
  hallG.forEach((g, n) => {
    const i = Math.round(g.q / STEP);
    // vigas transversales cada 30 m
    if (i % 5 === 0) {
      hbox(g, 0, g.H - 2.4, g.W * 2 - 2.6, 3.2, 2.4, arch.steel);
      if (i % 10 === 0) { hbox(g, 0, g.H - 3.6, 1.6, 0.6, 1.6, arch.warm); for (const x of [-g.W + 8, g.W - 8]) hbox(g, x, g.H - 3.3, 1.2, 1.2, 1.2, arch.red); }
    }
    // pilas bajo el tablero o péndolas al techo (alternas)
    if (i % 8 === 0 && g.D > 20 && !inWell(g.q)) {
      if (i % 16 === 0) for (const x of [-10, 10]) { const top = P3(g.q, x, -1.7), bot = new THREE.Vector3(top.x, g.p.y - g.D, top.z); cyl(bot, top, 1.5, arch.grey, 10, 1.1); }
      else for (const x of [-17.1, 17.1]) { const a = P3(g.q, x, 1.9), c = new THREE.Vector3(a.x, g.p.y + g.H - 3, a.z); cyl(a, c, 0.28, arch.steel, 6); }
    }
    // quilla bajo el tablero
    if (i % 4 === 0 && g.D > 10) hbox(g, 0, -3.4, 8, 3.4, STEP * 4.05, arch.steel);
    // losas inclinadas apoyadas en los muros (la referencia), alternas, cada ~96 m
    if (i % 16 === 8 && g.W > 40) {
      const sd = (i / 16) % 2 < 1 ? 1 : -1;
      const hb = -g.D * 0.55, ht = g.H * 0.86, k = Math.min(g.W - 28, 0.4 * (ht - hb));
      const len = Math.hypot(k, ht - hb), ang = Math.atan2(k, ht - hb);
      const xm = sd * (g.W - k / 2 - 1.2), hm = (hb + ht) / 2;
      hbox(g, xm, hm, 2.4, len, 18, arch.slab, sd * ang);
      hbox(g, sd * (g.W - k - 1.2), ht - 0.8, 3.2, 1.6, 18.6, arch.steel);
    }
    // pasarelas que cruzan la nave a media altura (cada ~220 m)
    if (i % 37 === 11 && g.H > 40) {
      const h = Math.min(g.H - 14, 26 + 30 * h2(i, 1.7));
      hbox(g, 0, h, g.W * 2, 1.2, 3.4, arch.steel);
      for (const z of [-1.6, 1.6]) { const r = hbox(g, 0, h + 1.2, g.W * 2, 0.12, 0.12, arch.grey); r.translate(g.tH.x * z, 0, g.tH.z * z); }
      for (let x = -g.W + 10; x < g.W - 6; x += 14) hbox(g, x, h - 0.75, 0.9, 0.25, 0.9, arch.cold);
      for (const x of [-g.W + 3, g.W - 3]) hbox(g, x, h + 2, 1.2, 1.2, 1.2, arch.red);
    }
    // tuberías por los muros a dos alturas (cada tramo de 6 m)
    const nx = G6[(i + 1) % NG];
    if (nx.kind === 'hall') for (const sd of [-1, 1]) for (const [hf, r] of [[(o) => o.H * 0.38, 1.1], [(o) => o.H * 0.38 + 3, 0.7], [(o) => -o.D * 0.3, 1.6]]) {
      const at = (o) => new THREE.Vector3(o.p.x + o.rH.x * sd * (o.W - 2.5), o.p.y + hf(o), o.p.z + o.rH.z * sd * (o.W - 2.5));
      cyl(at(g), at(nx), r, arch.grey, 6);
    }
    // máquinas en el fondo (escala), con ventanucos
    if (i % 23 === 5 && g.D > 60) for (const sd of [-1, 1]) if (h2(i, sd) > 0.4) { const w = 12 + 20 * h2(i, 3), hh = 10 + 30 * h2(i, 5); hbox(g, sd * (g.W * 0.5), -g.D + hh / 2, w, hh, 14 + 20 * h2(i, 7), arch.slab); hbox(g, sd * (g.W * 0.5), -g.D + hh * 0.7, w + 0.2, 0.6, 3, arch.warm); }
    // haces de luz fría desde las rejillas del techo (pocos)
    if (i % 17 === 13 && g.H > 50) {
      const x = (h2(i, 9) - 0.5) * g.W * 1.2, top = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y + g.H - 1, g.p.z + g.rH.z * x);
      const len = g.H + g.D * 0.6, r0 = 3, r1 = 18 + 14 * h2(i, 2);
      const gg = new THREE.CylinderGeometry(r0, r1, len, 18, 1, true); gg.translate(0, -len / 2, 0);
      const uv = gg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
      gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3((h2(i, 4) - 0.5) * 0.3, -1, 0).normalize())); gg.translate(top.x, top.y, top.z);
      (h2(i, 6) < 0.6 ? beamsCold : beamsWarm).push(gg);
      hbox(g, x, g.H - 0.6, 6, 1, 6, arch.cold);
    }
    void n;
  });
  // carteles pintados en los muros (códigos de galería): un atlas de texto, emisivo muy bajo
  {
    const labels = ['16201', 'C-04', 'CALORIS', 'SECTOR 7', '−320 M', 'HG-12', 'KEEP CLEAR', 'DECK 3', '04-B', 'NO ENTRY', 'LEVEL 9', 'MRC'];
    const c = document.createElement('canvas'); c.width = 1024; c.height = 768; const x2 = c.getContext('2d');
    x2.fillStyle = '#000'; x2.fillRect(0, 0, 1024, 768); x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    labels.forEach((t, k) => { const col = k % 2, row = Math.floor(k / 2); x2.font = `bold ${t.length > 6 ? 70 : 104}px "Arial Narrow", Impact, sans-serif`; x2.fillText(t, 256 + col * 512, 64 + row * 128); });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; own.push(tex);
    const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.32, 0.32, 0.3), side: THREE.DoubleSide });
    own.push(sm);
    const quads = [];
    hallG.forEach((g) => {
      const i = Math.round(g.q / STEP); if (i % 27 !== 4) return;
      const k = Math.floor(h2(i, 2) * labels.length), col = k % 2, row = Math.floor(k / 2);
      const sd = h2(i, 8) < 0.5 ? -1 : 1, h = 8 + h2(i, 3) * Math.max(4, g.H * 0.5), w = 26, hh = 6.5;
      const q = new THREE.PlaneGeometry(w, hh); const uv = q.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, (col + uv.getX(j)) / 2, 1 - (row + 1 - uv.getY(j)) / 6);
      q.applyMatrix4(new THREE.Matrix4().makeBasis(g.tH.clone().multiplyScalar(-sd), new THREE.Vector3(0, 1, 0), g.rH.clone().multiplyScalar(-sd)));
      q.translate(g.p.x + g.rH.x * sd * (g.W - 0.3), g.p.y + h, g.p.z + g.rH.z * sd * (g.W - 0.3)); quads.push(q);
    });
    if (quads.length) { const gg = mergeGeometries(quads, false); quads.forEach((q) => q.dispose()); const m = new THREE.Mesh(gg, sm); m.renderOrder = 2; world.add(m); own.push(gg); }
  }

  // ── Tubos de las horquillas (el tubo dodecagonal de ENCELADUS, en hormigón oscuro y luz cálida) ──
  const TR = MER.TR, TC = MER.TC, N12 = 12, RV = TR / Math.cos(Math.PI / N12);
  const dodec = []; for (let k = 0; k <= N12; k++) { const a = -Math.PI / 2 + Math.PI / N12 + k * 2 * Math.PI / N12; dodec.push([Math.cos(a) * RV, TC + Math.sin(a) * RV]); }
  const FACE = 2 * TR * Math.tan(Math.PI / N12), PER = FACE * N12;
  const tubeM = tubeMaterial(uni, PER, FACE, { lampK: 1.0, lamp: [1.0, 0.72, 0.42], base: [0.3, 0.3, 0.29], low: [0.12, 0.12, 0.12], bounce: [0.16, 0.15, 0.14] }); own.push(tubeM);
  const collar = (q, list, sc, depth, band = null) => {
    const pos = [], idx = [];
    const inner = dodec.map(([x, h]) => [x * sc, (h - TC) * sc + TC]), outer = dodec.map(([x, h]) => [x * (sc + 0.09), (h - TC) * (sc + 0.09) + TC]);
    const put = (ss, [x, h]) => { track.sample(ss, F); pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); return pos.length / 3 - 1; };
    for (let k = 0; k < N12; k++) {
      const v = [put(q, inner[k]), put(q, inner[k + 1]), put(q + depth, inner[k]), put(q + depth, inner[k + 1]), put(q, outer[k]), put(q, outer[k + 1]), put(q + depth, outer[k]), put(q + depth, outer[k + 1])];
      idx.push(v[4], v[6], v[5], v[5], v[6], v[7], v[0], v[4], v[1], v[1], v[4], v[5], v[2], v[3], v[6], v[3], v[7], v[6]);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); list.push(gg);
    if (band) band.push(sweepSeg(q + depth * 0.3, q + depth * 0.7, depth * 0.4, outer.map(([x, h]) => [x * 1.006, (h - TC) * 1.006 + TC]), false));
  };
  for (const [a, b] of tubes) {
    const gg = sweepSeg(a, b, 3, dodec, false, { uPer: true, center: TC });
    const mesh = new THREE.Mesh(gg, tubeM); mesh.receiveShadow = true; world.add(mesh); own.push(gg);
    for (let q = a + 18; q < b - 6; q += 36) collar(q, arch.grey, 1.035, 1.4, arch.hazard);
    for (const q of [a, b - 4]) { collar(q, arch.steel, 1.12, 4, arch.warm); }
  }

  // ── CALORIS SHAFT: paredes de las terrazas, pórticos de las bocas, borde, mástiles de luz ──
  {
    const segN = 220;
    const crossA = Math.atan2(P3(mouthOut).z - Cc.z, P3(mouthOut).x - Cc.x), crossB = Math.atan2(P3(mouthIn).z - Cc.z, P3(mouthIn).x - Cc.x);
    for (let k = 0; k < MER.STEPS; k++) {
      const r = MER.RF + k * SF.SW - GRES - 2, y0 = SF.ledge(k) - 2, y1 = SF.ledge(k + 1) + 0.5;
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= segN; j++) {
        const a = j / segN * Math.PI * 2; const x = Cc.x + Math.cos(a) * r, z = Cc.z + Math.sin(a) * r;
        pos.push(x, y0, z, x, y1, z); uv.push(a * r, 0, a * r, y1 - y0);
      }
      for (let j = 0; j < segN; j++) {
        const am = (j + 0.5) / segN * Math.PI * 2;
        const gap = k === 0 && [crossA, crossB].some((c) => Math.abs(Math.atan2(Math.sin(am - c), Math.cos(am - c))) * r < 25);
        if (gap) continue;
        const a0 = j * 2, b0 = a0 + 2; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv.map((v, i) => (i % 2 ? v : v)), 2)); gg.setIndex(idx); gg.computeVertexNormals();
      // uv del muro: x = altura, y = recorrido (como en las naves: las placas casan)
      const u2 = gg.attributes.uv; for (let i = 0; i < u2.count; i++) { const a = u2.getX(i), b = u2.getY(i); u2.setXY(i, b, a); }
      const mesh = new THREE.Mesh(gg, CW); mesh.receiveShadow = true; mesh.castShadow = !lite; world.add(mesh); own.push(gg);
      // remate del borde de cada terraza
      for (let j = 0; j < 96; j++) { const a = (j + 0.5) / 96 * Math.PI * 2; if (k === 0 && [crossA, crossB].some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) * r < 30)) continue; const bx = new THREE.BoxGeometry(2 * Math.PI * r / 96 + 0.4, 1.4, 2.2); bx.rotateY(-a + Math.PI / 2); bx.translate(Cc.x + Math.cos(a) * (r + 0.6), y1 + 0.2, Cc.z + Math.sin(a) * (r + 0.6)); arch.steel.push(bx); }
      // luces puntuales en cada repisa
      for (let j = 0; j < 48; j++) { const a = (j + 0.25) / 48 * Math.PI * 2; const lb = new THREE.BoxGeometry(0.9, 0.9, 0.9); lb.translate(Cc.x + Math.cos(a) * (r + 1.5), y1 + 1.4, Cc.z + Math.sin(a) * (r + 1.5)); (j % 6 === 0 ? arch.red : arch.warm).push(lb); }
    }
    // pórticos en las bocas: marco de acero y franja de luz
    for (const q of [mouthOut, mouthIn]) {
      const g = gAt(q);
      for (const [x, h, w, hh] of [[-24, 10, 4, 24], [24, 10, 4, 24], [0, 22, 52, 4]]) hbox(g, x, h, w, hh, 6, arch.steel);
      hbox(g, 0, 19.6, 44, 0.5, 6.4, arch.warm);
      for (const x of [-24, 24]) hbox(g, x, 1.2, 4.4, 2.4, 6.4, arch.hazard);
    }
    // anillo del borde: banda de hormigón y gálibo de luces, visible desde el espacio
    {
      const r = MER.RR + 8, pos = [], idx = [], uv = [];
      for (let j = 0; j <= segN; j++) { const a = j / segN * Math.PI * 2; for (const [rr, yy] of [[r, MER.RIM - 8], [r, MER.RIM + 14], [r + 16, MER.RIM + 14]]) { pos.push(Cc.x + Math.cos(a) * rr, yy, Cc.z + Math.sin(a) * rr); uv.push(yy, a * r); } }
      for (let j = 0; j < segN; j++) for (let k = 0; k < 2; k++) { const a = j * 3 + k, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
      const mesh = new THREE.Mesh(gg, CW); mesh.castShadow = !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
      for (let j = 0; j < 72; j++) { const a = j / 72 * Math.PI * 2; const lb = new THREE.BoxGeometry(1.6, 1.6, 1.6); lb.translate(Cc.x + Math.cos(a) * (r - 0.8), MER.RIM + 10, Cc.z + Math.sin(a) * (r - 0.8)); (j % 3 ? arch.warm : arch.red).push(lb); }
    }
    // mástiles de luz y grúas sobre el borde (siluetas contra el sol en la intro)
    for (let j = 0; j < 9; j++) {
      const a = (j + 0.3 * h2(j, 1)) / 9 * Math.PI * 2, r = MER.RR + 40 + 30 * h2(j, 2), x = Cc.x + Math.cos(a) * r, z = Cc.z + Math.sin(a) * r, y = natural(x, z) - 2;
      const hh = 70 + 90 * h2(j, 3);
      for (const [dx, dz] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) cyl(new THREE.Vector3(x + dx, y, z + dz), new THREE.Vector3(x + dx * 0.4, y + hh, z + dz * 0.4), 0.45, arch.steel, 6);
      for (let yy = 8; yy < hh - 4; yy += 10) { const b = new THREE.BoxGeometry(3.6, 0.35, 3.6); b.translate(x, y + yy, z); arch.steel.push(b); }
      if (j % 3 === 0) { const arm = new THREE.BoxGeometry(2, 2, 120); arm.translate(0, 0, -50); arm.rotateY(-a + Math.PI / 2 + Math.PI); arm.translate(x, y + hh, z); arch.steel.push(arm); }
      const lb = new THREE.BoxGeometry(5, 2.4, 5); lb.translate(x, y + hh + 1, z); arch.warm.push(lb);
      const rb = new THREE.BoxGeometry(1.4, 1.4, 1.4); rb.translate(x, y + hh + 4, z); arch.red.push(rb);
    }
  }

  // ── THE WELL: pozo vertical que cruza la galería; puente, anillos de luz y el sol que entra desde arriba ──
  {
    const top = natural(Wc.x, Wc.z) + 4, bot = MER.WELL_BOT, hgt = top - bot;
    const holes = [];
    for (const dir of [-1, 1]) {
      const q = sW + dir * (WR - 2), g = gAt(q);
      const c = new THREE.Vector3(g.p.x, g.p.y, g.p.z);
      const tOut = g.tH.clone().multiplyScalar(dir);
      holes.push(new THREE.Vector4(c.x, c.y, c.z, g.W + 0.5), new THREE.Vector4(g.rH.x, 0, g.rH.z, g.p.y - g.D - 0.5), new THREE.Vector4(tOut.x, 0, tOut.z, g.p.y + g.H + 4.5));
    }
    const WM = concreteMaterial(uni, { rings: true, holes }); own.push(WM);
    const cg = new THREE.CylinderGeometry(WR, WR, hgt, 160, 1, true); cg.translate(Wc.x, bot + hgt / 2, Wc.z);
    const uv = cg.attributes.uv, pp = cg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getY(i) - bot, uv.getX(i) * Math.PI * 2 * WR);
    const mesh = new THREE.Mesh(cg, WM); mesh.receiveShadow = true; world.add(mesh); own.push(cg);
    // fondo: niebla y un resplandor cálido muy abajo
    const fg = new THREE.CircleGeometry(WR, 64); fg.rotateX(-Math.PI / 2); fg.translate(Wc.x, bot + 1, Wc.z); world.add(new THREE.Mesh(fg, CF)); own.push(fg);
    // labio en la superficie y anillos de pasarela con luces
    for (let yy = top - 2; yy > bot + 60; yy -= yy > -400 ? 60 : 120) {
      const tg = new THREE.TorusGeometry(WR - 3, 1.2, 6, 96); tg.rotateX(Math.PI / 2); tg.translate(Wc.x, yy, Wc.z); arch.steel.push(tg);
      for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2; const lb = new THREE.BoxGeometry(0.8, 0.8, 0.8); lb.translate(Wc.x + Math.cos(a) * (WR - 4), yy + 1.4, Wc.z + Math.sin(a) * (WR - 4)); (j % 4 ? arch.cold : arch.red).push(lb); }
    }
    // puente: celosía bajo el tablero y tirantes al muro del pozo
    const gq = gAt(sW);
    for (let q = sW - WR + 4; q < sW + WR - 4; q += 6) { const g = gAt(q); hbox(g, 0, -5, 22, 6, 6.2, arch.steel); for (const x of [-12, 12]) hbox(g, x, -9, 1.2, 12, 1.2, arch.grey); }
    for (const sd of [-1, 1]) for (const k of [-0.6, -0.2, 0.2, 0.6]) {
      const a = P3(sW + k * WR, sd * 17.3, 2);
      const wdir = new THREE.Vector3(a.x - Wc.x, 0, a.z - Wc.z).normalize();
      const e = new THREE.Vector3(Wc.x, a.y + 70 + 40 * Math.abs(k), Wc.z).addScaledVector(wdir, WR - 1);
      cyl(a, e, 0.35, arch.steel, 6);
    }
    void gq;
    // el sol que entra por la boca: haz grueso inclinado
    const bl = 900, bg = new THREE.CylinderGeometry(WR * 0.55, WR * 0.9, bl, 32, 1, true); bg.translate(0, -bl / 2, 0);
    const buv = bg.attributes.uv; for (let k = 0; k < buv.count; k++) buv.setY(k, 1 - buv.getY(k));
    bg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), SUN.clone().negate())); bg.translate(Wc.x, top, Wc.z);
    const bm = beamMaterial(uni, [1.0, 0.82, 0.55], 0.1); own.push(bm);
    const bmesh = new THREE.Mesh(bg, bm); bmesh.renderOrder = 5; bmesh.frustumCulled = false; world.add(bmesh); own.push(bg);
  }

  // ── Obstáculos: columnas que atraviesan el tablero (COLUMN ROW) y prensas colgadas (PRESS LINE) ──
  const obstacles = [];
  const place = (s0, list, kind) => {
    for (const [dq, x] of list) {
      const q = s0 + dq;
      const g = gAt(q); if (g.kind !== 'hall') continue;
      obstacles.push({ s: track.wrap(q), x, hw: 3.3, hl: 3.3, kind });
      const tr = P3(q, x, 0);
      const gg = { p: new THREE.Vector3(tr.x, g.p.y, tr.z), rH: g.rH, tH: g.tH };
      if (kind === 'column') {
        const yb = -g.D, yt = g.H + 2;
        hbox(gg, 0, (yb + yt) / 2, 6.4, yt - yb, 6.4, arch.pale);
        for (const a of [-3.25, 3.25]) for (const b of [-3.25, 3.25]) { const st = hbox(gg, a, (2.5 + Math.min(yt, 60)) / 2, 0.25, Math.min(yt, 60) - 2.5, 0.25, arch.cold); st.translate(g.tH.x * b, 0, g.tH.z * b); }
        hbox(gg, 0, 1.0, 7.0, 3.0, 7.0, arch.hazard);
        hbox(gg, 0, 4.6, 6.8, 0.5, 6.8, arch.warm);
        for (const [a, b] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) { const lb = hbox(gg, a, 2.8, 0.7, 0.7, 0.7, arch.red); lb.translate(g.tH.x * b, 0, g.tH.z * b); }
      } else {
        const yb = 0.9, yt = g.H;
        hbox(gg, 0, yb + 9, 6.6, 18, 6.6, arch.pale);
        for (const a of [-3.35, 3.35]) for (const b of [-3.35, 3.35]) { const st = hbox(gg, a, yb + 10, 0.25, 16, 0.25, arch.cold); st.translate(g.tH.x * b, 0, g.tH.z * b); }
        hbox(gg, 0, yb + 1.0, 7.0, 2.0, 7.0, arch.hazard);
        hbox(gg, 0, yb - 0.25, 6.0, 0.4, 6.0, arch.red);
        for (const a of [-2, 2]) for (const b of [-2, 2]) { const r = hbox(gg, a, (yb + 18 + yt) / 2, 0.8, yt - yb - 18, 0.8, arch.grey); r.translate(g.tH.x * b, 0, g.tH.z * b); }
        hbox(gg, 0, yt - 3, 12, 6, 12, arch.steel);
      }
    }
  };
  // eslalon: lado, lado, puerta doble (hueco central), centro… a 170 m (≈1 s a fondo): siempre hay línea, pero hay que verla
  place(sCol, [[0, 6.5], [170, -6.5], [340, -9.5], [340, 9.5], [510, 0]], 'column');
  place(sPress, [[0, -6.5], [170, 6.5], [340, 0], [510, -9.5], [510, 9.5], [680, 6.5]], 'press');
  obstacles.sort((a, b) => a.s - b.s);
  track.obstacles = obstacles;

  // haces de luz de las naves
  {
    const mC = beamMaterial(uni, [0.62, 0.78, 1.0], 0.06), mW = beamMaterial(uni, [1.0, 0.62, 0.3], 0.06); own.push(mC, mW);
    for (const [l, m] of [[beamsCold, mC], [beamsWarm, mW]]) { if (!l.length) continue; const gg = mergeGeometries(l, false); l.forEach((q) => q.dispose()); const mesh = new THREE.Mesh(gg, m); mesh.renderOrder = 5; mesh.frustumCulled = false; world.add(mesh); own.push(gg); }
  }

  // fusiona estructuras
  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (q.index === null) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, SM[k]); mesh.castShadow = (k === 'steel' || k === 'slab' || k === 'grey' || k === 'pale') && !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── Anillo de reparación antes del pozo (los obstáculos cuestan blindaje) ──
  const rr = buildRaceRings(world, track, [sRing], own, { R: 17, lift: 8, color: [1.0, 0.7, 0.35] });

  // ── Zonas con nombre ──
  const zones = [
    [mouthOut + 80, 'FOUNDRY HALLS', ['Galerías bajo la cuenca Caloris', 'Galleries beneath the Caloris basin']],
    ...(tubes[0] ? [[tubes[0][0] - 160, 'THE TURN', ['Horquilla de 180° en tubo', '180° hairpin in a tube']]] : []),
    [sCol - 260, 'COLUMN ROW', ['Columnas en el tablero · cada choque cuesta blindaje', 'Columns on the deck · every hit costs armor']],
    [sW - WR - 220, 'THE WELL', ['Puente sobre el pozo', 'Bridge over the shaft']],
    [sPress - 260, 'PRESS LINE', ['Prensas hasta el tablero · esquívalas', 'Presses down to the deck · dodge them']],
    ...(tubes[1] ? [[tubes[1][0] - 160, 'THE RETURN', ['Segunda horquilla en tubo', 'Second hairpin in a tube']]] : []),
    [sInf + 20, 'INFINITE GALLERY', ['La galería sin fin', 'The endless gallery']],
    [mouthIn - 260, 'CALORIS SHAFT', ['De vuelta al sol', 'Back into the sun']],
  ].map(([q, title, sub]) => ({ s: track.wrap(q), title, sub }));

  const prevS = new Map(), cd = new Map(), _hp = new THREE.Vector3();
  const fx = {
    t: 0, gates: rr.gates, zones,
    update(dt) { this.t += dt; uni.uT.value = this.t; rr.update(dt); for (const [k, v] of cd) { if (v - dt <= 0) cd.delete(k); else cd.set(k, v - dt); } },
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevS.delete(sh); continue; }
        const p = prevS.get(sh) ?? sh.s;
        for (const z of zones) { const d0 = track.delta(p, z.s), d1 = track.delta(sh.s, z.s); if (d0 > 0 && d1 <= 0 && d1 > -60) onPass?.(sh, { kind: 'banner', title: z.title, sub: z.sub }); }
        prevS.set(sh, sh.s);
        // choques contra columnas y prensas
        for (const o of obstacles) {
          const ds = track.delta(o.s, sh.s); if (Math.abs(ds) > o.hl + sh.length * 0.45) continue;
          const dx = sh.x - o.x, lim = o.hw + sh.halfWidthGeo * 0.85; if (Math.abs(dx) >= lim) continue;
          const sgn = Math.sign(dx) || (sh.x > 0 ? -1 : 1);
          sh.x = o.x + sgn * (lim + 0.15); sh.phi *= 0.3; sh.psi *= 0.5;
          if (cd.has(sh)) continue;
          cd.set(sh, 1.0);
          track.sample(o.s, F); _hp.copy(F.pos).addScaledVector(F.right, o.x + sgn * o.hw).addScaledVector(F.up, 1.2);
          onPass?.(sh, { kind: 'obstacle', pos: _hp.clone(), obstacle: o });
        }
      }
      rr.passRings(ships, onPass);
    },
    reset() { prevS.clear(); cd.clear(); rr.reset(); },
  };

  const introKeys = makeIntro({ P3, Cc, MC });
  let ymin = Infinity, ymax = -Infinity; for (const q of smp) { ymin = Math.min(ymin, q.p.y); ymax = Math.max(ymax, q.p.y); }
  console.info(`[SRS] CALORIS: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · bocas ${Math.round(mouthOut)} / ${Math.round(mouthIn)} · pozo ${Math.round(sW)} · tubos ${tubes.map(([a, b]) => `${Math.round(a)}–${Math.round(b)}`).join(', ')} · obstáculos ${obstacles.length} · cráteres ${craters.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => natural(x, z), tunnel: { s: mouthOut + 10, len: mouthIn - mouthOut - 20 }, ownTunnel: true, bridges: 0, introKeys, fx,
    dbg: { G6, tubes, mouthOut, mouthIn, sW, obstacles, craters, Cc, Wc, natural, runs } };
}

// ── Intro: Mercurio en tránsito sobre el disco del Sol; acercamiento a contraluz con la corona; amanecer rasante sobre
//    los cráteres; el borde del pozo CALORIS y el picado hasta la parrilla ──
function makeIntro({ P3, Cc, MC }) {
  const up = new THREE.Vector3(0, 1, 0);
  const T = up.clone().addScaledVector(SUN, -up.dot(SUN)).normalize();              // terminador más cercano al polo
  const e1 = new THREE.Vector3().crossVectors(SUN, up).normalize();
  const sunC = SUN.clone().multiplyScalar(SUN_D);
  const Th = new THREE.Vector3(T.x, 0, T.z).normalize();                              // de la parrilla hacia el terminador: se llega desde ahí, con el sol de frente
  const Ch = new THREE.Vector3(Cc.x, MER.Y_SHAFT, Cc.z);
  // tránsito: lejos, en el lado nocturno, Mercurio como un punto negro junto al limbo del Sol
  // desplazado de lado para que el punto negro caiga cerca del limbo (como en la referencia)
  const D0 = 2.5e6, off = Math.tan(0.11) * D0;
  const c0 = MC.clone().addScaledVector(SUN, -D0).addScaledVector(e1, off);
  const dS = sunC.clone().sub(c0).normalize(), dM = MC.clone().sub(c0).normalize();
  const l0 = c0.clone().addScaledVector(dS.multiplyScalar(0.45).addScaledVector(dM, 0.55).normalize(), 1e6);
  const c1 = MC.clone().addScaledVector(SUN, -95000).addScaledVector(T, 50000).addScaledVector(e1, 5000);
  const tP = MC.clone().addScaledVector(T.clone().multiplyScalar(0.35).add(up.clone().multiplyScalar(0.65)).normalize(), MER.R);
  const c2 = tP.clone().addScaledVector(tP.clone().sub(MC).normalize(), 5200);
  // mira por delante del recorrido (más allá de la clave siguiente): el rumbo apenas cambia al llegar
  const l1 = c2.clone().addScaledVector(c2.clone().sub(c1).normalize(), 30000).lerp(Ch, 0.35);
  const l2 = Ch.clone().addScaledVector(Th, 2500).setY(-300);
  // paso intermedio: frena el descenso desde la órbita (sin cambio brusco de velocidad ni de rumbo en la clave)
  const nT = tP.clone().sub(MC).normalize();
  void nT;
  // aproximación final por la prolongación de la recta de meta: el pozo de frente y el picado sin giros
  const g0 = P3(-600);
  const c3 = g0.clone().addScaledVector(Th, 2600).setY(950);
  const l3 = Ch.clone().addScaledVector(Th, -150).setY(-140);
  // picado alineado con la recta de meta: empalma con la llegada común (520 m por detrás de la nave) sin barrido lateral
  const c4 = P3(-780, -50, 175);
  const l4 = P3(-400, 0, 10);
  // llegada: muy lejos, el disco del Sol llena el encuadre y Mercurio entra en él (4 s más para el arranque del tema)
  const Dp = 4.6e6, cp = MC.clone().addScaledVector(SUN, -Dp).addScaledVector(e1, Math.tan(0.05) * Dp);
  const lp = cp.clone().addScaledVector(sunC.clone().sub(cp).normalize(), 1e6);
  const keys = [
    [0.0, cp, lp, 9],
    [4.4, c0, l0, 7],
    [8.0, c1, l1, 30],
    [12.2, c2, l2, 52],
    [14.8, c3, l3, 50],
    [17.2, c4, l4, 58],
  ];
  return () => keys.map(([tt, a, b, f]) => [tt, a.clone(), b.clone(), f]);
}
