// ENCELADUS · nodo 09·B, sistema de Saturno. Trazado con la silueta de Japón (simplificada), unos 9 km.
// La mitad corre sobre la corteza de hielo (cian en falso color infrarrojo, con las «rayas de tigre» rojas y sus géiseres);
// la otra mitad baja por un tubo blanco a la oscuridad industrial que hay bajo la corteza:
//   SURFACE       tablero sobre el hielo, cruzando las rayas de tigre (puentes sobre las grietas)
//   THE DESCENT   rampa dentro del tubo blanco dodecagonal, atraviesa la corteza
//   GALLERIES     tubos colgados en el vacío, ventanas a las siluetas a contraluz; anillo de cohetes
//   FREE FLIGHT   sin tablero: el eje lateral se curva (ship.js / track.place) entre tres bandas de luz flotantes
//   GALLERIES II  segundo anillo de cohetes
//   THE ASCENT    vuelta a la superficie
// Estructuras: arquitectura tubular blanca segmentada (referencia del autor) sobre las ruinas de estaciones anteriores a SARUS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { buildRaceRings } from './rings.js';
import { ringTexture, saturnTexture } from './cassini.js';
import { QUALITY } from './quality.js';

// Silueta de Japón en píxeles del plano de referencia (442×460), de Kyushu hacia el norte por la costa oeste,
// Hokkaido y vuelta al sur por la costa del Pacífico.
const JP = [[45, 440], [40, 418], [62, 395], [95, 375], [130, 358], [165, 340], [188, 320], [215, 300], [238, 268], [252, 228], [262, 192], [272, 160], [284, 138], [291, 108], [294, 72], [297, 42], [312, 34], [330, 58], [352, 80], [385, 94], [414, 108], [406, 124], [380, 134], [357, 158], [333, 150], [306, 148], [293, 172], [300, 200], [310, 226], [320, 252], [324, 282], [313, 303], [299, 322], [294, 350], [284, 374], [264, 388], [238, 394], [213, 399], [188, 394], [166, 398], [145, 412], [118, 426], [92, 438], [68, 446]];
const KPX = 6.95;                      // m por píxel → ~9 km de vuelta

export const ENC = {
  Y_UG: -225,                          // cota de las galerías
  CEIL: -95,                           // techo del vacío (cara inferior de la corteza)
  FLOOR: -560,                         // fondo (el océano oscuro, casi siempre en la niebla)
  TR: 22, TC: 8,                       // tubo: apotema del dodecágono y altura del eje sobre el tablero
  FR: 26,                              // radio del vuelo libre
  // tramos por fracción de la vuelta (en planta)
  Z: { down: [0.322, 0.4], gal1: [0.4, 0.555], fly: [0.565, 0.695], gal2: [0.705, 0.772], up: [0.772, 0.855] },
  rings: [0.485, 0.742],
  surfTubes: [[0.045, 0.085], [0.2, 0.236]],   // tramos de tubo blanco sobre la superficie
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }
let _seed = 1;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

// ── Planta: Catmull-Rom cerrada por la silueta, remuestreada cada 4 m y suavizada hasta un radio mínimo razonable ──
export function encPlan(step = 4, f0 = 0.1) {
  const cx = JP.reduce((a, p) => a + p[0], 0) / JP.length, cy = JP.reduce((a, p) => a + p[1], 0) / JP.length;
  const C = JP.map(([x, y]) => new THREE.Vector3((x - cx) * KPX, 0, (y - cy) * KPX));
  const cr = new THREE.CatmullRomCurve3(C, true, 'centripetal');
  let P = cr.getSpacedPoints(3000); P.pop();
  // suavizado: media móvil (varias pasadas) — redondea los cabos más cerrados (Noto, Hokkaido)
  const sm = (arr, W, passes) => { let a = arr; for (let p = 0; p < passes; p++) { const n = a.length; a = a.map((_, i) => { const v = new THREE.Vector3(); for (let k = -W; k <= W; k++) v.add(a[(i + k + n) % n]); return v.multiplyScalar(1 / (2 * W + 1)); }); } return a; };
  P = sm(P, 7, 9);
  const c2 = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = c2.getLength(), N = Math.round(L / step);
  let S = c2.getSpacedPoints(N); S.pop();
  // la salida, en la recta larga de la costa oeste (no en la curva de Kyushu)
  const k0 = Math.round(f0 * S.length); S = [...S.slice(k0), ...S.slice(0, k0)];
  const cum = [0]; for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + S[i].distanceTo(S[i - 1]));
  const total = cum[cum.length - 1] + S[0].distanceTo(S[S.length - 1]);
  return { S, cum, total };
}

// ─────────────────────────────────────────────────────────────
//  Relieve: llanura de hielo joven con surcos, curvatura de la luna y las cuatro rayas de tigre
// ─────────────────────────────────────────────────────────────
export const MOON_R = 60000;           // radio artístico de Encélado (el real son 252 km)
const ST = { a: 0.56, wig: 70, wsc: 520 };   // rayas: rumbo, ondulación (m) y su escala
const stDir = () => { const t = new THREE.Vector2(Math.cos(ST.a), Math.sin(ST.a)); return { t, n: new THREE.Vector2(-t.y, t.x) }; };
function makeRelief(offsets) {
  const { t, n } = stDir();
  const stripeD = (x, z) => {
    const pn = x * n.x + z * n.y, pt = x * t.x + z * t.y; let d = 1e9, k0 = 0;
    offsets.forEach((c, k) => { const dd = pn - (c + ST.wig * Math.sin(pt / ST.wsc + k * 1.7)); if (Math.abs(dd) < Math.abs(d)) { d = dd; k0 = k; } });
    return { d, k: k0 };
  };
  const stripeH = (d) => -38 * Math.exp(-((d / 44) ** 2)) + 15 * Math.exp(-(((Math.abs(d) - 100) / 42) ** 2));
  const drop = (x, z) => MOON_R - Math.sqrt(Math.max(0, MOON_R * MOON_R - x * x - z * z));
  const fadeR = (x, z) => 1 - sstep(20000, 30000, Math.hypot(x, z));
  const groove = (x, z) => { const g = Math.abs(Math.sin((x * 0.3 + z * 0.95) / 38 + fbm(x / 600, z / 600, 2) * 3)); return 2.2 * Math.pow(1 - g, 3); };
  const nat0 = (x, z) => 26 * (fbm(x / 1400, z / 1400, 3) - 0.5) + 9 * (fbm(x / 330 + 5, z / 330, 3) - 0.5) + groove(x, z) - drop(x, z);
  const natural = (x, z) => nat0(x, z) + stripeH(stripeD(x, z).d) * fadeR(x, z);
  const ceil = (x, z) => ENC.CEIL + 14 * (fbm(x / 420 + 9, z / 420, 3) - 0.5) - drop(x, z);
  return { stripeD, stripeH, nat0, natural, ceil, t, n };
}

// GLSL común: ruido, rayas y red de grietas (igual que en JS para que relieve y color casen)
const NOISE = /* glsl */`
  float eH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float eN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(eH(i), eH(i+vec2(1,0)), f.x), mix(eH(i+vec2(0,1)), eH(i+vec2(1,1)), f.x), f.y); }
  float eF(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += eN(p) * w; p = p * 2.03 + vec2(1.7, 9.2); w *= 0.5; } return a; }
  float eCrack(vec2 p){ vec2 g = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 r = o + vec2(eH(g + o), eH(g + o + 3.1)) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return sqrt(d2) - sqrt(d1); }
  float eStripe(vec2 p, vec4 dir, vec4 off){ float pn = dot(p, dir.zw), pt = dot(p, dir.xy), d = 1e9;
    for (int k = 0; k < 4; k++) { float c = off[k] + ${ST.wig.toFixed(1)} * sin(pt / ${ST.wsc.toFixed(1)} + float(k) * 1.7); float dd = pn - c; if (abs(dd) < abs(d)) d = dd; }
    return d; }
`;

// Hielo en falso color (la imagen infrarroja de Cassini): cian y azul, grietas oscuras, rayas de tigre rojas y anaranjadas
function iceMaterial(uni, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.0 });
  const NC = 12;
  m.userData.caps = opts.caps || [];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT; sh.uniforms.uSt = uni.uSt; sh.uniforms.uSo = uni.uSo; sh.uniforms.uSunI = { value: SUN };
    sh.uniforms.uCaps = { value: [...m.userData.caps, ...Array(NC * 2).fill(0).map(() => new THREE.Vector4(0, -1e7, 0, 0))].slice(0, NC * 2) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vIW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vIW; uniform float uT; uniform vec4 uSt; uniform vec4 uSo; uniform vec3 uSunI; uniform vec4 uCaps[${NC * 2}];
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  float eHot = 0.0, eBump = 0.0;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${NC}; i++) { vec3 a = uCaps[i * 2].xyz, b = uCaps[i * 2 + 1].xyz; vec3 ab = b - a; float t = clamp(dot(vIW - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0); if (length(vIW - a - ab * t) < uCaps[i * 2].w) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vIW.xz;
          float aa = clamp(1.0 - length(fwidth(p)) / 40.0, 0.0, 1.0);
          float a = eF(p / 2600.0), b = eF(p / 320.0 + 3.0), c = eF(p / 18.0 + 7.0);
          vec3 col = mix(vec3(0.04, 0.24, 0.46), vec3(0.42, 0.84, 0.95), smoothstep(0.15, 1.0, a * 0.8 + b * 0.25));
          col = mix(col, vec3(0.72, 0.93, 0.98), smoothstep(0.62, 0.8, b) * 0.35);
          col *= 0.9 + 0.2 * c;
          // red de grietas: dos escalas, líneas azul profundo
          vec2 wp = p + (vec2(eF(p / 210.0 + 2.0), eF(p / 210.0 + 9.0)) - 0.5) * 260.0;
          float k1 = eCrack(wp / 300.0), k2 = eCrack(wp / 70.0 + 11.0);
          float line = (1.0 - smoothstep(0.0, 0.03, k1)) * (0.4 + 0.6 * eN(p / 120.0)) + (1.0 - smoothstep(0.0, 0.04, k2)) * 0.35 * aa * eN(p / 60.0 + 4.0);
          col = mix(col, vec3(0.02, 0.09, 0.22), clamp(line, 0.0, 1.0) * 0.75);
          eBump = eF(p / 90.0) * 3.0 + c * 0.7 - clamp(line, 0.0, 1.0) * 1.6;
          // rayas de tigre: banda ancha roja y anaranjada, núcleo caliente en el fondo de la grieta
          float d = eStripe(p, uSt, uSo), fr = 1.0 - smoothstep(20000.0, 30000.0, length(p));
          float band = exp(-pow(d / 150.0, 2.0)) * fr, core = exp(-pow(d / 20.0, 2.0)) * fr;
          col = mix(col, mix(vec3(0.7, 0.16, 0.08), vec3(1.0, 0.5, 0.14), exp(-pow(d / 65.0, 2.0))), band * 0.9);
          eHot = core * (0.75 + 0.25 * sin(uT * 1.3 + p.x * 0.01)) + band * 0.22;
          // lado nocturno de la luna (visto desde el espacio en la intro): sin luz de relleno
          vec3 nS = normalize(vIW - vec3(0.0, ${(-MOON_R).toFixed(1)}, 0.0));
          float dayK = smoothstep(-0.06, 0.14, dot(nS, uSunI));
          diffuseColor.rgb = col * (0.04 + 0.96 * dayK);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.14) * eHot * 1.6 + diffuseColor.rgb * 0.16;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(eBump), hy = dFdy(eBump);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`);
  };
  m.customProgramCacheKey = () => 'encIce';
  return m;
}

// Cara inferior de la corteza (techo del vacío): hielo negro azulado; por las grietas se cuela luz cian y, bajo las rayas, rojiza
function ceilMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide });
  const NC = 12;
  m.userData.caps = [];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT; sh.uniforms.uSt = uni.uSt; sh.uniforms.uSo = uni.uSo;
    sh.uniforms.uCaps = { value: [...m.userData.caps, ...Array(NC * 2).fill(0).map(() => new THREE.Vector4(0, -1e7, 0, 0))].slice(0, NC * 2) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vIW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vIW; uniform float uT; uniform vec4 uSt; uniform vec4 uSo; uniform vec4 uCaps[${NC * 2}];
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  vec3 eGlow = vec3(0.0);')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${NC}; i++) { vec3 a = uCaps[i * 2].xyz, b = uCaps[i * 2 + 1].xyz; vec3 ab = b - a; float t = clamp(dot(vIW - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0); if (length(vIW - a - ab * t) < uCaps[i * 2].w) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vIW.xz;
          float a = eF(p / 300.0), b = eF(p / 40.0 + 5.0);
          diffuseColor.rgb = mix(vec3(0.02, 0.035, 0.05), vec3(0.06, 0.1, 0.13), a * 0.7 + b * 0.3);
          float k1 = eCrack(p / 260.0), k2 = eCrack(p / 64.0 + 11.0);
          float line = (1.0 - smoothstep(0.0, 0.035, k1)) + (1.0 - smoothstep(0.0, 0.05, k2)) * 0.35;
          float d = eStripe(p, uSt, uSo);
          eGlow = vec3(0.25, 0.75, 0.95) * line * (0.18 + 0.12 * a) + vec3(1.0, 0.36, 0.12) * exp(-pow(d / 70.0, 2.0)) * (0.35 + line * 1.2) * (0.8 + 0.2 * sin(uT * 0.9 + p.y * 0.01));
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += eGlow;`);
  };
  m.customProgramCacheKey = () => 'encCeil';
  return m;
}

// Tubo blanco segmentado (TUBULAR ARCHITECTURE): paneles con juntas, cara interior iluminada por la tira del techo
// y los aros de luz; en los tramos con ventanas, ranuras abiertas al vacío. uv.x: perímetro (m) · uv.y: recorrido (m)
// tone (MERCURY reutiliza el tubo para sus horquillas de 180°): base del panel, zócalo y luz rebotada interior
export function tubeMaterial(uni, per, face, { windows = false, lamp = [0.85, 0.95, 1.0], lampK = 2.4, base = [0.86, 0.87, 0.86], low = [0.32, 0.34, 0.36], bounce = [0.5, 0.54, 0.58] } = {}) {
  const v3 = (c) => `vec3(${c.map((v) => v.toFixed(3)).join(',')})`;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.08, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aC; varying vec2 vTu; varying vec3 vTW; varying vec3 vTC;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vTu = uv; vTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTC = (modelMatrix * vec4(aC, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vTu; varying vec3 vTW; varying vec3 vTC; uniform float uT;
      const float PER = ${per.toFixed(3)}, FACE = ${face.toFixed(3)};
      float tH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('void main() {', 'void main() {\n  float tLamp = 0.0, tSeam = 0.0, tIn = 0.0, tHaz = 0.0;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${windows ? `{
          float u = vTu.x, s = vTu.y, fu = mod(u, FACE), sec = fract(s / 9.0);
          float fi = floor(u / FACE);
          // ventanas en las caras laterales altas (no en el suelo ni en la del techo): ranura de 6 m × 4 m por cada panel de 9 m
          bool side = (fi > 1.5 && fi < 4.5) || (fi > 6.5 && fi < 9.5);
          if (side && fi != 3.0 && fi != 8.0 && fu > 2.2 && fu < FACE - 2.2 && sec > 0.17 && sec < 0.83) discard;
        }` : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vTu.x, s = vTu.y;
          tIn = step(dot(vTW - vTC, cameraPosition - vTW), 0.0);          // 1: se ve la cara interior
          float aa = clamp(1.4 - length(fwidth(vec2(u, s))) * 0.6, 0.0, 1.0);
          float fu = mod(u, FACE), cs = fract(s / 9.0);
          tSeam = max(1.0 - smoothstep(0.0, 0.07, min(fu, FACE - fu)), 1.0 - smoothstep(0.0, 0.012, min(cs, 1.0 - cs))) * aa;
          vec2 cell = vec2(floor(s / 9.0), floor(u / FACE));
          vec3 col = ${v3(base)} * (0.93 + 0.1 * tH(cell));
          // paneles menores dentro de cada panel (refuerzo central) y franja gris en el zócalo
          float sub = 1.0 - smoothstep(0.0, 0.05, abs(fract(s / 4.5) - 0.5) - 0.47);
          col *= 1.0 - 0.06 * sub * aa;
          float low = 1.0 - smoothstep(FACE * 0.9, FACE * 1.1, min(u, PER - u));
          col = mix(col, ${v3(low)}, low * 0.85);
          // abrazaderas con banda de peligro cada 36 m
          float cl = fract(s / 36.0);
          tHaz = (1.0 - smoothstep(0.0, 0.004, abs(cl - 0.5) - 0.02));
          float hz = step(0.5, fract((u + s) / 1.6));
          col = mix(col, mix(vec3(0.05), vec3(0.95, 0.66, 0.08), hz), tHaz * (1.0 - tIn * 0.6));
          diffuseColor.rgb = col * (1.0 - 0.6 * tSeam);
          // tira de luz en la cara del techo y aros de luz cada 36 m (desfasados de las abrazaderas)
          float top = abs(u - PER * 0.5);
          float strip = 1.0 - smoothstep(0.55, 0.9, top);
          float rd = min(fract(s / 36.0), 1.0 - fract(s / 36.0)) * 36.0;
          float ring = (1.0 - smoothstep(0.3, 0.6, rd)) * (1.0 - low);
          float ph = fract((s - uT * 150.0) / 120.0) * 120.0;
          tLamp = (strip + ring * 0.8) * aa * tIn;
          tLamp *= 0.75 + 0.25 * exp(-pow((ph - 60.0) / 6.0, 2.0)) * 4.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1), min(1.0, strip) * tIn);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.85, tSeam);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(${lamp.map((v) => v.toFixed(3)).join(',')}) * tLamp * ${lampK.toFixed(2)};
        // luz rebotada dentro del tubo: la cara interior se ve blanca aunque fuera sea de noche
        totalEmissiveRadiance += diffuseColor.rgb * tIn * ${v3(bounce)} * (1.0 - tSeam * 0.7);
        totalEmissiveRadiance += diffuseColor.rgb * (1.0 - tIn) * vec3(0.12, 0.14, 0.16);`);
  };
  m.customProgramCacheKey = () => 'encTube' + windows + per.toFixed(2) + lamp.join(',') + lampK + base.join(',') + low.join(',') + bounce.join(',');
  return m;
}

// Siluetas del vacío: metal casi negro con ventanas encendidas a puntos (torres) — instanciado
function hullMaterial(uni, windows = true) {
  const m = new THREE.MeshStandardMaterial({ color: 0x0b0e11, roughness: 0.72, metalness: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHL; varying float vHS;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 w = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            vHL = (instanceMatrix * w).xyz - instanceMatrix[3].xyz; vHS = fract(instanceMatrix[3].x * 0.0137 + instanceMatrix[3].z * 0.0071);
          #else
            vHL = (modelMatrix * w).xyz; vHS = 0.5;
          #endif
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vHL; varying float vHS; uniform float uT;
      float wH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`)
      .replace('void main() {', 'void main() {\n  vec3 hWin = vec3(0.0);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${windows ? `{
          vec3 g = vec3(floor((vHL.x + vHL.z) / 4.0), floor(vHL.y / 6.0), vHS * 97.0);
          vec2 f = vec2(fract((vHL.x + vHL.z) / 4.0), fract(vHL.y / 6.0));
          float r = wH(g), lit = step(0.84, r) * step(0.2, f.x) * step(f.x, 0.8) * step(0.35, f.y) * step(f.y, 0.65);
          float aa = clamp(1.6 - length(fwidth(vHL)) * 0.35, 0.0, 1.0);
          hWin = mix(vec3(1.0, 0.6, 0.25), vec3(0.6, 0.85, 1.0), step(0.93, r)) * lit * aa * (0.8 + 0.2 * sin(uT * 0.7 + r * 30.0));
        }` : ''}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += hWin * 2.2;');
  };
  m.customProgramCacheKey = () => 'encHull' + windows;
  return m;
}

// Haces de luz en la niebla (focos del techo, chorros de los géiseres): cono abierto, núcleo según el ángulo de vista
function beamMaterial(uni, col, k = 0.08, opts = {}) {
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
      float bH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float bN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(bH(i), bH(i+vec2(1,0)), f.x), mix(bH(i+vec2(0,1)), bH(i+vec2(1,1)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        float core = pow(abs(dot(normalize(vN), normalize(vV))), ${opts.coreExp ?? '2.0'});
        float y = vUv.y;                                  // 0 en la boca, 1 en la punta
        float along = smoothstep(0.0, 0.04, y) * pow(1.0 - y, ${opts.tail ?? '1.6'});
        ${opts.plume ? `float tb = bN(vec2(vUv.x * 7.0, y * 9.0 - uT * 0.9)) * 0.6 + bN(vec2(vUv.x * 19.0 + 3.0, y * 25.0 - uT * 1.7)) * 0.4;
        along *= 0.2 + 1.2 * tb * tb;` : 'along *= 0.85 + 0.15 * sin(vUv.x * 40.0 + y * 9.0 + uT * 0.3);'}
        float near = smoothstep(${opts.near ?? '6.0'}, ${opts.near2 ?? '60.0'}, vD)${opts.alt ? ` * smoothstep(${opts.alt[0].toFixed(1)}, ${opts.alt[1].toFixed(1)}, cameraPosition.y)` : ''};
        gl_FragColor = vec4(uCol * core * along * uK * near, 1.0);
      }`,
  });
}

// Saturno visto desde Encélado: creciente enorme (el sol queda detrás), bandas, sombra de los anillos; anillos casi de canto
function saturnMaterial(center, sun, tex, ringN, rr) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sun }, uMap: { value: tex }, uRN: { value: ringN }, uRR: { value: new THREE.Vector2(...rr) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uC, uSun, uRN; uniform vec2 uRR; uniform sampler2D uMap; varying vec3 vW; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        vec3 T = texture2D(uMap, vUv).rgb;
        float lam = dot(n, uSun);
        float day = smoothstep(-0.02, 0.25, lam) * max(lam, 0.0);
        // sombra de los anillos sobre el disco: rayo hacia el sol que corta el plano de los anillos dentro de la banda
        float t = -dot(vW - uC, uRN) / dot(uSun, uRN);
        vec3 hp = vW + uSun * t; float rh = length(hp - uC);
        float sh = (t > 0.0 && rh > uRR.x && rh < uRR.y) ? 0.45 : 1.0;
        vec3 c = T * vec3(1.0, 0.94, 0.84) * day * 1.35 * sh;
        // luz de los anillos en la cara nocturna y halo fino de la atmósfera en el borde
        c += T * vec3(0.012, 0.011, 0.01) * (1.0 - day);
        float rim = pow(1.0 - max(0.0, dot(n, V)), 6.0);
        c += vec3(1.0, 0.86, 0.62) * rim * smoothstep(-0.25, 0.2, lam) * 0.55;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Encélado entero (para la intro y el horizonte): hielo cian, grietas; en el polo (arriba) las rayas de tigre
function moonMaterial(center, sun, uni) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sun }, uT: uni.uT, uSt: uni.uSt, uSo: uni.uSo },
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
      uniform vec3 uC, uSun; uniform float uT; uniform vec4 uSt, uSo; varying vec3 vW;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.z, n.x);
        vec2 q = vec2(lon * 2.0, lat * 2.0) * 3.0;
        float a = eF(q + 4.0), b = eF(q * 4.0 + 1.0);
        vec3 col = mix(vec3(0.16, 0.42, 0.62), vec3(0.6, 0.86, 0.95), smoothstep(0.15, 1.0, a * 0.7 + b * 0.3));
        float k1 = eCrack(q * 2.0), k2 = eCrack(q * 7.0 + 3.0);
        col = mix(col, vec3(0.04, 0.14, 0.28), ((1.0 - smoothstep(0.0, 0.05, k1)) * 0.8 + (1.0 - smoothstep(0.0, 0.07, k2)) * 0.4) * 0.7);
        // polo (la zona del circuito): las rayas en coordenadas de mundo, y un halo rojizo alrededor
        float pole = smoothstep(0.93, 0.985, n.y);
        float d = eStripe(vW.xz, uSt, uSo);
        float band = exp(-pow(d / 160.0, 2.0)) * pole;
        float polar = smoothstep(0.86, 0.97, n.y) * (0.35 + 0.65 * eF(vW.xz / 3000.0));
        col = mix(col, vec3(0.62, 0.22, 0.12), polar * 0.5);
        col = mix(col, vec3(0.95, 0.5, 0.16), band * 0.9);
        float lam = dot(n, uSun), day = smoothstep(-0.04, 0.2, lam) * max(lam, 0.0);
        vec3 c = col * (0.006 + 1.25 * day);
        c += vec3(1.0, 0.45, 0.15) * exp(-pow(d / 22.0, 2.0)) * pole * 1.2;
        float rim = pow(1.0 - max(0.0, dot(n, V)), 5.0);
        c += vec3(0.5, 0.8, 1.0) * rim * smoothstep(-0.3, 0.3, lam) * 0.2;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Bandas de luz flotantes del vuelo libre: cinta aditiva con pulsos que corren hacia delante
function bandMaterial(uni, col) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT, uCol: { value: new THREE.Vector3(...col) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying float vD;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vD = length(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; uniform vec3 uCol; varying vec2 vUv; varying float vD;
      void main(){
        #include <logdepthbuf_fragment>
        float x = vUv.x * 2.0 - 1.0, s = vUv.y;              // x: −1…1 a lo ancho · s: recorrido (m)
        float core = exp(-x * x * 9.0) * 1.4 + exp(-x * x * 1.6) * 0.35;
        float ph = fract((s - uT * 210.0) / 90.0);
        float pulse = exp(-pow((ph - 0.5) * 14.0, 2.0));
        float dash = 0.75 + 0.25 * step(0.5, fract(s / 6.0));
        float fade = exp(-vD / 2200.0);
        gl_FragColor = vec4(uCol * core * (0.8 * dash + 2.2 * pulse) * (0.35 + 0.65 * fade), 1.0);
      }`,
  });
}

// Lámina holográfica casi invisible entre las bandas: marca la superficie curva por la que se vuela
function veilMaterial(uni) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying float vD;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vD = length(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; varying vec2 vUv; varying float vD;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c = vec2(vUv.x * 24.0, vUv.y / 6.0);
        vec2 f = abs(fract(c) - 0.5);
        float aa = clamp(2.0 - vD / 120.0, 0.0, 1.0);
        float grid = (1.0 - smoothstep(0.0, 0.04, 0.5 - max(f.x, f.y))) * aa;
        float sweep = exp(-pow((fract((vUv.y - uT * 260.0) / 400.0) - 0.5) * 12.0, 2.0));
        float edge = smoothstep(0.38, 0.5, abs(vUv.x - 0.5));
        gl_FragColor = vec4(vec3(0.35, 0.8, 1.0) * (grid * 0.05 + sweep * 0.05 + edge * 0.04) * exp(-vD / 900.0), 1.0);
      }`,
  });
}

// ─────────────────────────────────────────────────────────────
//  Trazado: cotas por tramo
// ─────────────────────────────────────────────────────────────
export function encLayout() {
  const { S, cum, total } = encPlan(4);
  const N = S.length, Z = ENC.Z;
  const f = (i) => cum[i] / total;
  // rayas de tigre: cuatro, repartidas por el tramo de superficie de la costa oeste
  const { n } = stDir();
  let pmin = Infinity, pmax = -Infinity;
  for (let i = 0; i < N; i++) if (f(i) > 0.02 && f(i) < Z.down[0] - 0.02) { const pn = S[i].x * n.x + S[i].z * n.y; pmin = Math.min(pmin, pn); pmax = Math.max(pmax, pn); }
  const offsets = [0, 1, 2, 3].map((k) => pmin + (k + 0.5) / 4 * (pmax - pmin));
  let R = makeRelief(offsets);
  // la parrilla (los 260 m antes de la salida) no puede caer sobre una grieta: si cae, se desplazan las cuatro
  for (let tries = 0; tries < 6; tries++) {
    let worst = Infinity; for (let i = N - 70; i < N + 8; i++) { const p = S[(i + N) % N]; worst = Math.min(worst, Math.abs(R.stripeD(p.x, p.z).d)); }
    if (worst > 170) break;
    for (let k = 0; k < 4; k++) offsets[k] += 90; R = makeRelief(offsets);
  }
  // superficie: el relieve sin rayas, muy suavizado, + 8 m (tablero sobre puntales)
  let base = S.map((p) => R.nat0(p.x, p.z));
  for (let pass = 0; pass < 8; pass++) base = base.map((_, i) => { let a = 0; for (let k = -20; k <= 20; k++) a += base[(i + k + N) % N]; return a / 41; });
  const ug = (fi) => {
    let y = ENC.Y_UG + 9 * Math.sin(fi * Math.PI * 2 * 9) + 6 * Math.sin(fi * Math.PI * 2 * 23 + 1.3);
    // vuelo libre: se hunde en el vacío y vuelve a subir
    const [a, b] = Z.fly; if (fi > a - 0.02 && fi < b + 0.02) { const u = (fi - (a - 0.02)) / (b - a + 0.04); y -= 70 * Math.pow(Math.sin(Math.PI * u), 2) + 18 * Math.sin(Math.PI * 3 * u); }
    return y;
  };
  const wUG = (fi) => {                                      // 0 superficie · 1 bajo la corteza (rampas lineales; luego se suaviza)
    const [d0, d1] = Z.down, [u0, u1] = Z.up;
    if (fi < d0 || fi > u1) return 0; if (fi < d1) return (fi - d0) / (d1 - d0); if (fi > u0) return 1 - (fi - u0) / (u1 - u0); return 1;
  };
  let y = S.map((p, i) => lerp(base[i] + 8, ug(f(i)), wUG(f(i))));
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -14; k <= 14; k++) a += y[(i + k + N) % N]; return a / 29; });
  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  return { S, cum, total, y, pts, R, offsets, wUG };
}

const HW = 17.6;
const SUN = new THREE.Vector3(-0.66, 0.22, -0.74).normalize();            // bajo, rasante: las crestas y los puntales proyectan sombras largas
const SAT_DIR = (() => { const a = Math.atan2(SUN.z, SUN.x) + 0.78, el = 0.3; return new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize(); })();
const SAT_R = 110000, SAT_D = 520000;
export function enceladusSunDir() { return SUN.clone(); }

export function buildEnceladus(def, { world, own, srcMat, renderer }) {
  const T0 = performance.now();
  _seed = 91;
  const lite = QUALITY.lite;
  const lay = encLayout();
  const { R: RL, offsets, wUG } = lay;
  const { natural, nat0, ceil, stripeD } = RL;
  const Z = ENC.Z, TR = ENC.TR, TC = ENC.TC, FR = ENC.FR;
  const track = new Track(null, { points: lay.pts, inSectorOrder: false, sectors: [0, 0.16, 0.32, 0.48, 0.64, 0.8],
    bank: (fq, k) => THREE.MathUtils.clamp(k * 36, -0.2, 0.2) });
  const F = track.frame(), L = track.length;
  const sOf = (fp) => { const j = Math.min(lay.pts.length - 1, Math.max(0, Math.round(fp * lay.S.length / 2))); return track.sectionS[j]; };
  const S = {};
  for (const [k, [a, b]] of Object.entries(Z)) { S[k + '0'] = sOf(a); S[k + '1'] = sOf(b); }
  track.flight = [{ s0: S.fly0, s1: S.fly1 }]; track.flightR = FR; track.flightRamp = 110;
  const RAMP = track.flightRamp;
  const inRange = (q, a, b) => { const d = track.delta(a, q); return d >= 0 && d <= track.delta(a, b) + (b < a ? L : 0); };
  const P3 = (q, x = 0, h = 0) => { track.sample(q, F); return F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h); };

  const uni = { uT: { value: 0 }, uSt: { value: new THREE.Vector4(RL.t.x, RL.t.y, RL.n.x, RL.n.y) }, uSo: { value: new THREE.Vector4(...offsets) } };

  // ── Muestras de la pista y zona de cada una ──
  // zone: 'surf' superficie · 'ramp' rampas · 'ug' galerías · 'fly' vuelo libre
  const zoneOf = (q) => {
    if (inRange(q, S.fly0 - RAMP - 10, S.fly1 + RAMP + 10)) return 'fly';
    if (inRange(q, S.down0, S.down1) || inRange(q, S.up0, S.up1)) return 'ramp';
    if (inRange(q, S.down1, S.up0)) return 'ug';
    return 'surf';
  };
  const smp = [];
  for (let q = 0; q < L; q += 4) { track.sample(q, F); smp.push({ s: q, p: F.pos.clone(), r: F.right.clone(), u: F.up.clone(), t: F.tan.clone(), zone: zoneOf(q) }); }
  const CELL = 60, hash = new Map();
  smp.forEach((q, i) => { const k = `${Math.floor(q.p.x / CELL)},${Math.floor(q.p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const nearXZ = (x, z, rad = 150) => {
    let best = null, bd = Infinity; const n = Math.ceil(rad / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = hash.get(`${cx + a},${cz + b}`); if (l) for (const i of l) { const q = smp[i]; const d = (q.p.x - x) ** 2 + (q.p.z - z) ** 2; if (d < bd) { bd = d; best = q; } } }
    return { q: best, d: Math.sqrt(bd) };
  };
  // distancia 3D a la línea central (para dejar libre el pasillo en el vacío)
  const near3 = (p, rad = 150) => {
    let best = null, bd = Infinity; const n = Math.ceil(rad / CELL), cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = hash.get(`${cx + a},${cz + b}`); if (l) for (const i of l) { const d = smp[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = smp[i]; } } }
    return { q: best, d: Math.sqrt(bd) };
  };

  // ── Terreno final: bajo el tablero de superficie, nivelado por debajo; junto a las bocas, trinchera para el tubo ──
  const terrain = (x, z) => {
    const nat = natural(x, z);
    const { q } = nearXZ(x, z, 160); if (!q) return nat;
    const dx = x - q.p.x, dz = z - q.p.z, lat = Math.abs(dx * q.r.x + dz * q.r.z);
    if (q.zone === 'surf') {
      const ty = q.p.y - 6.5, w = lat < HW + 10 ? 1 : sstep(HW + 80, HW + 10, lat);
      return Math.min(nat, lerp(nat, ty, w));
    }
    if (q.zone === 'ramp' && q.p.y + TC + TR > nat - 4) {                  // el tubo aún asoma: trinchera hasta su panza
      const ty = q.p.y - 17, w = lat < TR + 6 ? 1 : sstep(TR + 70, TR + 6, lat);
      return Math.min(nat, lerp(nat, ty, w));
    }
    return nat;
  };

  // ── Cruces del tubo con la superficie y con el techo del vacío: huecos (cápsulas) en el hielo ──
  const crossings = (fn) => {
    const out = [];
    for (const [a, b] of [[S.down0, S.down1], [S.up0, S.up1]]) {
      let prev = null;
      for (let q = a; q <= b; q += 2) { const A = P3(q, 0, TC), v = A.y - fn(A.x, A.z); if (prev !== null && Math.sign(v) !== Math.sign(prev)) out.push(q); prev = v; }
    }
    return out;
  };
  const surfX = crossings(natural), ceilX = crossings(ceil);
  // cápsulas de 55 m a lo largo del eje del tubo alrededor de cada cruce (máx. 12 por material: ver NC)
  const capsAt = (list, span = 110) => { const c = []; for (const q of list) for (let k = -span; k < span; k += 55) { const a = P3(q + k, 0, TC), b = P3(q + k + 55, 0, TC); c.push(new THREE.Vector4(a.x, a.y, a.z, TR + 2.2), new THREE.Vector4(b.x, b.y, b.z, 0)); } return c; };
  const ice = iceMaterial(uni, { caps: capsAt(surfX) }); own.push(ice);
  const ceilM = ceilMaterial(uni); ceilM.userData.caps = capsAt(ceilX, 140); own.push(ceilM);
  // el tramo «a cubierto» (luz atenuada): desde que el tubo entra en el hielo hasta que sale
  const covA = surfX[0] ?? S.down0 + 100, covB = surfX[surfX.length - 1] ?? S.up1 - 100;

  // ── Malla del terreno (losetas con normales compartidas) y techo del vacío ──
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const q of smp) { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); bz0 = Math.min(bz0, q.p.z); bz1 = Math.max(bz1, q.p.z); }
  const gx0 = bx0 - 1700, gx1 = bx1 + 1700, gz0 = bz0 - 1700, gz1 = bz1 + 1700;
  const heightGrid = (fn, RES, mat, shadow, recv = true, B = [gx0, gx1, gz0, gz1], hole = null) => {
    const [gx0, gx1, gz0, gz1] = B;
    const nx = Math.ceil((gx1 - gx0) / RES), nz = Math.ceil((gz1 - gz0) / RES);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = gx0 + i * RES, z = gz0 + j * RES, o = (j * (nx + 1) + i) * 3; pos[o] = x; pos[o + 1] = fn(x, z); pos[o + 2] = z; }
    const idx = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const full = new THREE.BufferGeometry(); full.setAttribute('position', new THREE.BufferAttribute(pos, 3)); full.setIndex(idx); full.computeVertexNormals();
    const nrm = full.attributes.normal.array; full.dispose();
    const TS = 96;
    for (let j0 = 0; j0 < nz; j0 += TS) for (let i0 = 0; i0 < nx; i0 += TS) {
      const i1 = Math.min(nx, i0 + TS), j1 = Math.min(nz, j0 + TS), w = i1 - i0 + 1, hh = j1 - j0 + 1;
      const tp = new Float32Array(w * hh * 3), tn = new Float32Array(w * hh * 3), ti = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const src = (j * (nx + 1) + i) * 3, dst = ((j - j0) * w + (i - i0)) * 3; for (let c = 0; c < 3; c++) { tp[dst + c] = pos[src + c]; tn[dst + c] = nrm[src + c]; } }
      for (let j = 0; j < hh - 1; j++) for (let i = 0; i < w - 1; i++) { if (hole && hole(gx0 + (i0 + i + 0.5) * RES, gz0 + (j0 + j + 0.5) * RES)) continue; const a = j * w + i, b = a + 1, c = a + w, d = c + 1; ti.push(a, c, b, b, c, d); }
      if (!ti.length) continue;
      const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.BufferAttribute(tp, 3)); gt.setAttribute('normal', new THREE.BufferAttribute(tn, 3)); gt.setIndex(ti); gt.computeBoundingSphere();
      const mesh = new THREE.Mesh(gt, mat); mesh.receiveShadow = recv; mesh.castShadow = shadow; world.add(mesh); own.push(gt);
    }
  };
  heightGrid(terrain, lite ? 18 : 10, ice, !lite);
  heightGrid(ceil, lite ? 60 : 36, ceilM, false, false);
  // anillo exterior grueso hasta 45 km: el mismo hielo (mismo sombreado) hasta muy lejos; la esfera solo más allá
  const OUT = 45000, ORES = lite ? 900 : 500;
  const inInner = (x, z) => x > gx0 + 2 && x < gx1 - 2 && z > gz0 + 2 && z < gz1 - 2;
  heightGrid((x, z) => (inInner(x, z) ? terrain(x, z) : natural(x, z) - 4), ORES, ice, false, true, [-OUT, OUT, -OUT, OUT], (x, z) => inInner(x - ORES * 0.5, z - ORES * 0.5) && inInner(x + ORES * 0.5, z + ORES * 0.5) || Math.hypot(x, z) > OUT);
  // fondo: el océano oscuro, en la niebla
  { const fg = new THREE.PlaneGeometry(gx1 - gx0 + 4000, gz1 - gz0 + 4000); fg.rotateX(-Math.PI / 2); fg.translate((gx0 + gx1) / 2, ENC.FLOOR, (gz0 + gz1) / 2);
    const fm = new THREE.MeshStandardMaterial({ color: 0x03070a, roughness: 0.18, metalness: 0.3 }); own.push(fm, fg);
    world.add(new THREE.Mesh(fg, fm)); }

  // ── Encélado entero (intro y horizonte): esfera con la parte alta fundida con el terreno fino ──
  const MC = new THREE.Vector3(0, -MOON_R, 0);
  const moonM = moonMaterial(MC, SUN, uni); own.push(moonM);
  {
    const sg = new THREE.SphereGeometry(MOON_R, lite ? 160 : 256, lite ? 80 : 128);
    sg.translate(0, -MOON_R - 30, 0);
    // fuera los triángulos que quedan bajo el anillo de hielo (radio < 44 km alrededor del polo)
    const p = sg.attributes.position, idx = sg.index.array, keep = [];
    const inside = (i) => p.getY(i) > -MOON_R && Math.hypot(p.getX(i), p.getZ(i)) < OUT - 1200;
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    sg.setIndex(keep); sg.deleteAttribute('uv'); sg.computeBoundingSphere();
    const mesh = new THREE.Mesh(sg, moonM); mesh.frustumCulled = false; mesh.renderOrder = -1; world.add(mesh); own.push(sg);
  }

  // ── Tablero ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x6e767c))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xd6dadb))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0xdfe2e2)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xe8ecee)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(0.55, 0.9, 1.0); m.emissiveIntensity = 2.4; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed, opts = {}) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [], cen = opts.center ? [] : null;
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
  const span = (a, b, fn) => { const out = []; let st = null; for (let q = a; q <= b; q += 2) { const ok = fn(q); if (ok && st === null) st = q; if (!ok && st !== null) { out.push([st, q]); st = null; } } if (st !== null) out.push([st, b]); return out; };
  const noFly = (q) => !inRange(q, S.fly0, S.fly1);
  const railed = (q) => !inRange(q, S.fly0 - RAMP, S.fly1 + RAMP);
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  for (const [a, b] of span(0, L, noFly)) parts.deck.push(sweepSeg(a, b, 3, deckProf, true));
  for (const [a, b] of span(0, L, railed)) {
    parts.guard.push(sweepSeg(a, b, 3, wallL, false), sweepSeg(a, b, 3, wallR, false));
    parts.edge.push(sweepSeg(a, b, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(a, b, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  }
  const boxAt = (q, x, h, w, hh, d, list) => {
    track.sample(q, F);
    const bx = new THREE.BoxGeometry(w, hh, d);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx); return bx;
  };
  for (let q = 5; q < L; q += 24) if (railed(q)) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let q = 0; q < L; q += 14) if (noFly(q)) boxAt(q, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (const sc of track.sectors) { const q = sc.s + (sc.id === 1 ? 6 : 0); if (!railed(q)) continue; for (const x of [-17.6, 17.6]) boxAt(q, x, 7.5, 0.9, 15, 0.9, parts.frame); boxAt(q, 0, 15.2, 36, 0.4, 1.2, parts.gate); }
  // borde del tablero en el vuelo libre: barra de luz de lado a lado
  for (const q of [S.fly0 - 0.6, S.fly1 + 0.6]) boxAt(q, 0, 0.15, 34, 0.3, 0.8, parts.gate);
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh); own.push(merged);
  }

  // ── Materiales de estructura: blanco tubular, gris de las ruinas, metal oscuro, luces ──
  const SM = {
    white: new THREE.MeshStandardMaterial({ color: 0xd9dcdc, roughness: 0.4, metalness: 0.1 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.7, metalness: 0.2, emissive: 0x141a1e }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: 0.6, metalness: 0.6 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xe8a316, roughness: 0.5, metalness: 0.1, emissive: 0x2a1a02 }),
    cold: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0xbfeaff, emissiveIntensity: 3.0 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xffa050, emissiveIntensity: 3.0 }),
    red: new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff3a20, emissiveIntensity: 3.2 }),
  };
  Object.values(SM).forEach((m) => own.push(m));
  const arch = { white: [], grey: [], dark: [], hazard: [], cold: [], warm: [], red: [] };
  const cyl = (a, b, r, list, seg = 10, r2 = r) => {
    const d = b.clone().sub(a), len = d.length(); if (len < 0.1) return;
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, false); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); list.push(g);
  };

  // ── Tubos dodecagonales ──
  const N12 = 12, RV = TR / Math.cos(Math.PI / N12);
  const dodec = []; for (let k = 0; k <= N12; k++) { const a = -Math.PI / 2 + Math.PI / N12 + k * 2 * Math.PI / N12; dodec.push([Math.cos(a) * RV, TC + Math.sin(a) * RV]); }
  const FACE = 2 * TR * Math.tan(Math.PI / N12);
  const PER = FACE * N12;
  // u = 0 en el vértice bajo-derecho: la cara del techo queda en u = PER/2
  const tubeSolid = tubeMaterial(uni, PER, FACE, { windows: false }), tubeWin = tubeMaterial(uni, PER, FACE, { windows: true });
  own.push(tubeSolid, tubeWin);
  // collar exterior (abrazadera) dodecagonal: anillo grueso con su banda de peligro
  const collar = (q, list, sc, depth, band = null) => {
    const pos = [], idx = [];
    const inner = dodec.map(([x, h]) => [x * sc, (h - TC) * sc + TC]), outer = dodec.map(([x, h]) => [x * (sc + 0.09), (h - TC) * (sc + 0.09) + TC]);
    const put = (ss, [x, h]) => { track.sample(ss, F); pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); return pos.length / 3 - 1; };
    for (let k = 0; k < N12; k++) {
      const v = [put(q, inner[k]), put(q, inner[k + 1]), put(q + depth, inner[k]), put(q + depth, inner[k + 1]), put(q, outer[k]), put(q, outer[k + 1]), put(q + depth, outer[k]), put(q + depth, outer[k + 1])];
      idx.push(v[4], v[6], v[5], v[5], v[6], v[7], v[0], v[4], v[1], v[1], v[4], v[5], v[2], v[3], v[6], v[3], v[7], v[6]);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); list.push(gg);
    if (band) { const b = sweepSeg(q + depth * 0.3, q + depth * 0.7, depth * 0.4, outer.map(([x, h]) => [x * 1.006, (h - TC) * 1.006 + TC]), false); band.push(b); }
  };
  const tubeRuns = [];
  const addTube = (a, b, windows) => {
    const gg = sweepSeg(a, b, 3, dodec, false, { uPer: true, center: TC });
    const mesh = new THREE.Mesh(gg, windows ? tubeWin : tubeSolid); mesh.receiveShadow = true; mesh.castShadow = !lite; world.add(mesh); own.push(gg);
    tubeRuns.push([a, b]);
  };
  // bajo la corteza: tubo continuo desde la rampa de bajada hasta la de subida, abierto en el vuelo libre
  const tA = S.down0 + 30, tB = S.up1 - 30;
  const flyA = S.fly0 - RAMP - 24, flyB = S.fly1 + RAMP + 24;
  const inCrust = (q) => { const A = P3(q, 0, TC); return A.y > ceil(A.x, A.z) - 30; };
  // tramos con ventanas: en el vacío, uno de cada dos bloques de 144 m
  const segRuns = (a, b) => {
    const out = []; let st = a, cur = null;
    for (let q = a; q <= b; q += 4) {
      const w = !inCrust(q) && Math.floor((q - a) / 144) % 2 === 1;
      if (cur === null) cur = w; else if (w !== cur) { out.push([st, q, cur]); st = q; cur = w; }
    }
    out.push([st, b, cur]); return out;
  };
  for (const [a, b] of [[tA, flyA], [flyB, tB]]) for (const [x, y, w] of segRuns(a, b)) addTube(x, y, w);
  // tubos sobre la superficie
  for (const [fa, fb] of ENC.surfTubes) addTube(sOf(fa), sOf(fb), false);
  // abrazaderas cada 36 m, bocas con marco doble
  for (const [a, b] of tubeRuns) for (let q = a + 18; q < b - 6; q += 36) collar(q, arch.white, 1.035, 1.4, arch.hazard);
  const mouths = [[tA, 1], [flyA, -1], [flyB, 1], [tB, -1], ...ENC.surfTubes.flatMap(([fa, fb]) => [[sOf(fa), 1], [sOf(fb), -1]])];
  for (const [q, dir] of mouths) { collar(q - (dir > 0 ? 2 : 0), arch.white, 1.12, 4, arch.cold); collar(q - (dir > 0 ? 5 : -2), arch.dark, 1.2, 2.2); }
  // collares donde el tubo atraviesa el hielo (superficie y techo)
  for (const q of [...surfX, ...ceilX]) { collar(q - 3, arch.white, 1.16, 6, arch.warm); collar(q + 4, arch.dark, 1.24, 2.5); }
  // haz de tuberías por fuera (arriba a la derecha) y quilla oscura por debajo
  for (const [a, b] of tubeRuns) {
    for (const [x, h, r] of [[TR * 0.62, TC + TR * 0.86, 0.9], [TR * 0.72, TC + TR * 0.78, 0.6], [TR * 0.54, TC + TR * 0.93, 0.5]]) {
      const n = 8, prof = []; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2; prof.push([x + Math.cos(t) * r * 1.6, h + Math.sin(t) * r * 1.6]); }
      arch.grey.push(sweepSeg(a + 2, b - 2, 6, prof, true));
    }
    arch.dark.push(sweepSeg(a, b, 6, [[-3.5, TC - TR - 0.4], [3.5, TC - TR - 0.4], [2.2, TC - TR - 3.4], [-2.2, TC - TR - 3.4]], true));
  }

  // ── Anclajes en el vacío: péndolas al techo y pilas al fondo ──
  for (let q = tA; q < tB; q += 4) {
    const z = zoneOf(q); if (z === 'surf' || inCrust(q)) continue;
    if (Math.round(q / 4) % 30 === 0) {
      const top = P3(q, 0, TC + TR + 1), c = ceil(top.x, top.z);
      if (c > top.y + 4) { for (const x of [-9, 9]) { const a = P3(q, x, TC + TR * 0.85); cyl(a, new THREE.Vector3(a.x, c + 6, a.z), 0.55, arch.white, 8); } cyl(top, new THREE.Vector3(top.x, c + 6, top.z), 1.4, arch.grey, 10); }
    }
    if (Math.round(q / 4) % 60 === 15 && z !== 'fly') {
      const bot = P3(q, 0, TC - TR - 3); cyl(new THREE.Vector3(bot.x, ENC.FLOOR, bot.z), bot, 3.2, arch.dark, 12, 2.4);
      for (const x of [-1, 1]) { const a = P3(q, x * 12, TC - TR * 0.7); cyl(new THREE.Vector3(bot.x + (a.x - bot.x) * 4, bot.y - 90, bot.z + (a.z - bot.z) * 4), a, 0.8, arch.white, 8); }
    }
  }

  // ── Superficie: puntales blancos bajo el tablero (en V) ──
  for (let q = 10; q < L; q += 40) {
    if (zoneOf(q) !== 'surf') continue;
    if (tubeRuns.some(([a, b]) => q > a - 10 && q < b + 10)) {
      // bajo los tubos de superficie, patas dobles más gruesas
    }
    track.sample(q, F);
    for (const sd of [-1, 1]) {
      const top = P3(q, sd * 9, -1.6), gx = top.x + F.right.x * sd * 6, gz = top.z + F.right.z * sd * 6, gy = terrain(gx, gz) - 3;
      if (top.y - gy < 3) continue;
      cyl(new THREE.Vector3(gx, gy, gz), top, 0.9, arch.white, 10, 0.7);
    }
    const mid = P3(q, 0, -1.8); const gy = terrain(mid.x, mid.z);
    if (mid.y - gy > 12) { const a = P3(q, -9, -2.6), b = P3(q, 9, -2.6); cyl(a, b, 0.5, arch.grey, 8); }
  }

  // ── Ruinas anteriores a SARUS: estaciones grises medio enterradas, mástiles, cúpulas, rejillas ──
  const ruinAt = (cx, cz, scale, yaw) => {
    const gy = natural(cx, cz);
    const m4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, gy, cz);
    const add = (list, g, x, y, z) => { g.translate(x, y, z); g.applyMatrix4(m4); list.push(g); };
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {                                    // cúpulas
      const r = (10 + rnd() * 16) * scale, g = new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
      add(arch.grey, g, (rnd() - 0.5) * 120 * scale, -r * 0.25, (rnd() - 0.5) * 120 * scale);
      const rg = new THREE.TorusGeometry(r * 0.98, 0.5, 6, 32); rg.rotateX(Math.PI / 2); add(arch.dark, rg, 0, 0, 0); arch.dark.pop();
    }
    for (let k = 0; k < 4; k++) {                                    // mástiles con celosía y baliza roja
      const x = (rnd() - 0.5) * 140 * scale, z = (rnd() - 0.5) * 140 * scale, h = (40 + rnd() * 60) * scale;
      for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) add(arch.grey, new THREE.CylinderGeometry(0.35, 0.5, h, 6), x + dx, h / 2 - 4, z + dz);
      for (let y = 6; y < h - 4; y += 9) add(arch.grey, new THREE.BoxGeometry(3.6, 0.4, 3.6), x, y, z);
      add(arch.red, new THREE.BoxGeometry(1.6, 1.6, 1.6), x, h - 3, z);
    }
    for (let k = 0; k < 3; k++) {                                    // bloques inclinados, hundidos en el hielo
      const g = new THREE.BoxGeometry((18 + rnd() * 30) * scale, (8 + rnd() * 10) * scale, (10 + rnd() * 14) * scale);
      g.rotateZ((rnd() - 0.5) * 0.35); g.rotateX((rnd() - 0.5) * 0.25);
      add(rnd() < 0.5 ? arch.grey : arch.dark, g, (rnd() - 0.5) * 160 * scale, -2, (rnd() - 0.5) * 160 * scale);
    }
    // rejilla de antenas (la «red» de la estación)
    const gx = 5, gz = 4, step = 22 * scale;
    for (let i = 0; i < gx; i++) for (let j = 0; j < gz; j++) {
      const x = 90 * scale + i * step, z = -40 * scale + j * step;
      add(arch.grey, new THREE.CylinderGeometry(0.3, 0.3, 14 * scale, 5), x, 7 * scale - 2, z);
      if (i < gx - 1) { const b = new THREE.CylinderGeometry(0.18, 0.18, step, 4); b.rotateZ(Math.PI / 2); add(arch.grey, b, x + step / 2, 13 * scale, z); }
      if (j < gz - 1) { const b = new THREE.CylinderGeometry(0.18, 0.18, step, 4); b.rotateX(Math.PI / 2); add(arch.grey, b, x, 13 * scale, z + step / 2); }
      if ((i + j) % 3 === 0) add(arch.warm, new THREE.BoxGeometry(0.8, 0.8, 0.8), x, 14 * scale, z);
    }
  };
  const ruins = [];
  for (let k = 0, tries = 0; k < (lite ? 6 : 11) && tries < 400; tries++) {
    const x = lerp(gx0 + 500, gx1 - 500, rnd()), z = lerp(gz0 + 500, gz1 - 500, rnd());
    const { q, d } = nearXZ(x, z, 400);
    if (q && d < 260) continue;
    if (ruins.some((r) => Math.hypot(r.x - x, r.z - z) < 700)) continue;
    if (Math.abs(stripeD(x, z).d) < 160) continue;
    const sc = 0.8 + rnd() * 0.6; ruinAt(x, z, sc, rnd() * 6.28); ruins.push({ x, z, sc }); k++;
  }

  // ── El vacío: pilares, torres a contraluz con ventanas, pasarelas; libre alrededor del pasillo ──
  const hullW = hullMaterial(uni, true), hullP = hullMaterial(uni, false); own.push(hullW, hullP);
  const ugSmp = smp.filter((q) => q.zone !== 'surf' && q.p.y < ENC.CEIL - 40);
  let ux0 = Infinity, ux1 = -Infinity, uz0 = Infinity, uz1 = -Infinity; for (const q of ugSmp) { ux0 = Math.min(ux0, q.p.x); ux1 = Math.max(ux1, q.p.x); uz0 = Math.min(uz0, q.p.z); uz1 = Math.max(uz1, q.p.z); }
  ux0 -= 900; ux1 += 900; uz0 -= 900; uz1 += 900;
  const clear3 = (p, rad) => near3(p, rad + 150).d > rad + 55;
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0); own.push(box);
  const pillarG = new THREE.CylinderGeometry(1, 1.15, 1, 12, 1, true); pillarG.translate(0, 0.5, 0); own.push(pillarG);
  const towers = [], pillars = [];
  const towerN = lite ? 120 : 300, pillarN = lite ? 50 : 120;
  for (let k = 0, tries = 0; k < towerN && tries < towerN * 20; tries++) {
    const x = lerp(ux0, ux1, rnd()), z = lerp(uz0, uz1, rnd());
    const w = 14 + rnd() * 36, d = 14 + rnd() * 30, top = ENC.Y_UG - 120 + rnd() * 200;
    const h = top - ENC.FLOOR;
    // libre del pasillo: compruebo la columna en varias alturas
    let ok = true; for (const yy of [top, (top + ENC.Y_UG) / 2, ENC.Y_UG - 60, ENC.Y_UG]) { if (yy > top) continue; if (!clear3(new THREE.Vector3(x, yy, z), Math.max(w, d) * 0.75)) { ok = false; break; } }
    if (!ok) continue;
    towers.push({ x, z, w, d, h, yaw: rnd() * 3 }); k++;
  }
  for (let k = 0, tries = 0; k < pillarN && tries < pillarN * 20; tries++) {
    const x = lerp(ux0, ux1, rnd()), z = lerp(uz0, uz1, rnd()), r = 6 + Math.pow(rnd(), 2) * 30;
    let ok = true; for (const yy of [ENC.CEIL - 20, ENC.Y_UG + 40, ENC.Y_UG - 40, ENC.Y_UG - 110]) if (!clear3(new THREE.Vector3(x, yy, z), r)) { ok = false; break; }
    if (!ok) continue;
    pillars.push({ x, z, r, top: ceil(x, z) + 8 }); k++;
  }
  {
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler();
    const ti = new THREE.InstancedMesh(box, hullW, towers.length);
    towers.forEach((t, i) => { q4.setFromEuler(e.set(0, t.yaw, 0)); m4.compose(new THREE.Vector3(t.x, ENC.FLOOR, t.z), q4, new THREE.Vector3(t.w, t.h, t.d)); ti.setMatrixAt(i, m4); });
    ti.instanceMatrix.needsUpdate = true; ti.frustumCulled = false; world.add(ti);
    const pi = new THREE.InstancedMesh(pillarG, hullP, pillars.length);
    pillars.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, ENC.FLOOR, p.z), q4.identity(), new THREE.Vector3(p.r, p.top - ENC.FLOOR, p.r)); pi.setMatrixAt(i, m4); });
    pi.instanceMatrix.needsUpdate = true; pi.frustumCulled = false; world.add(pi);
    // remates de las torres: antenas y luz de baliza
    for (const t of towers) if (rnd() < 0.35) { const tp = new THREE.Vector3(t.x, ENC.FLOOR + t.h, t.z); const hh = 12 + rnd() * 30; cyl(tp, tp.clone().add(new THREE.Vector3(0, hh, 0)), 0.5, arch.dark, 6); const b = new THREE.BoxGeometry(1.4, 1.4, 1.4); b.translate(tp.x, tp.y + hh, tp.z); (rnd() < 0.5 ? arch.red : arch.warm).push(b); }
  }
  // pasarelas entre torres vecinas (siluetas horizontales)
  for (let i = 0; i < towers.length; i++) {
    const a = towers[i]; if (rnd() > 0.25) continue;
    let best = null, bd = Infinity; for (let j = 0; j < towers.length; j++) { if (j === i) continue; const d = Math.hypot(towers[j].x - a.x, towers[j].z - a.z); if (d < bd && d > 60) { bd = d; best = towers[j]; } }
    if (!best || bd > 260) continue;
    const y = ENC.FLOOR + Math.min(a.h, best.h) - 20 - rnd() * 40;
    const pa = new THREE.Vector3(a.x, y, a.z), pb = new THREE.Vector3(best.x, y, best.z);
    if (!clear3(pa.clone().lerp(pb, 0.5), 20)) continue;
    cyl(pa, pb, 2.2, arch.dark, 8);
    if (rnd() < 0.5) { const m = pa.clone().lerp(pb, 0.5); const g = new THREE.BoxGeometry(2, 0.5, 2); g.translate(m.x, y + 2.6, m.z); arch.cold.push(g); }
  }

  // ── Luces del vacío: halos a contraluz detrás de las siluetas y haces desde el techo ──
  const softDot = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  own.push(softDot);
  const glows = [];
  for (let k = 0, tries = 0; k < (lite ? 26 : 48) && tries < 900; tries++) {
    const x = lerp(ux0, ux1, rnd()), z = lerp(uz0, uz1, rnd()), y = ENC.Y_UG - 160 + rnd() * 150;
    if (!clear3(new THREE.Vector3(x, y, z), 120)) continue;
    const warm = rnd() < 0.62, sz = 160 + rnd() * 420;
    const mat = new THREE.SpriteMaterial({ map: softDot, color: warm ? 0xff8a3a : 0x9fdcff, transparent: true, opacity: 0.5 + rnd() * 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(mat); sp.position.set(x, y, z); sp.scale.setScalar(sz); sp.renderOrder = -1; world.add(sp); own.push(mat);
    glows.push(sp); k++;
  }
  const beamCold = beamMaterial(uni, [0.55, 0.85, 1.0], 0.07), beamWarm = beamMaterial(uni, [1.0, 0.6, 0.25], 0.07);
  own.push(beamCold, beamWarm);
  {
    const lists = { c: [], w: [] };
    for (let k = 0, tries = 0; k < (lite ? 22 : 44) && tries < 900; tries++) {
      const x = lerp(ux0, ux1, rnd()), z = lerp(uz0, uz1, rnd()), top = ceil(x, z) - 2;
      const len = 260 + rnd() * 260, r0 = 3 + rnd() * 4, r1 = 30 + rnd() * 70;
      const tilt = new THREE.Vector3((rnd() - 0.5) * 0.5, -1, (rnd() - 0.5) * 0.5).normalize();
      const mid = new THREE.Vector3(x, top, z).addScaledVector(tilt, len * 0.5);
      if (!clear3(mid, r1 * 0.6)) continue;
      const g = new THREE.CylinderGeometry(r0, r1, len, 20, 1, true); g.translate(0, -len / 2, 0);
      // uv.y: 0 en la boca (arriba), 1 en la punta
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tilt)); g.translate(x, top, z);
      (rnd() < 0.55 ? lists.c : lists.w).push(g);
      const lmp = new THREE.CylinderGeometry(r0 * 1.4, r0 * 1.8, 2.5, 12); lmp.translate(x, top - 1, z); (rnd() < 0.5 ? arch.cold : arch.warm).push(lmp);
      k++;
    }
    for (const [k, l] of Object.entries(lists)) { if (!l.length) continue; const gg = mergeGeometries(l, false); l.forEach((q) => q.dispose()); const m = new THREE.Mesh(gg, k === 'c' ? beamCold : beamWarm); m.renderOrder = 5; m.frustumCulled = false; world.add(m); own.push(gg); }
  }

  // ── Vuelo libre: tres bandas de luz flotantes, costillas parciales y lámina casi invisible ──
  const bandC = bandMaterial(uni, [0.6, 0.92, 1.0]), bandW = bandMaterial(uni, [1.0, 0.62, 0.28]), veil = veilMaterial(uni);
  own.push(bandC, bandW, veil);
  const _pl = { pos: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() };
  const fA = S.fly0 - RAMP, fB = S.fly1 + RAMP;
  const xLim = (q) => Math.max(HW, track.flightAt(q) * FR * 1.92);
  const ribbon = (xFn, half, hOff) => {
    const pos = [], uv = [], idx = []; const rows = Math.round((fB - fA) / 3);
    for (let r = 0; r <= rows; r++) {
      const q = fA + (fB - fA) * r / rows, xc = xFn(q);
      for (const [k, dx] of [[0, -half], [1, half]]) { track.place(q, xc + dx, hOff, F, _pl); pos.push(_pl.pos.x, _pl.pos.y, _pl.pos.z); uv.push(k, q); }
      if (r < rows) { const a = r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); return gg;
  };
  {
    const bands = [ribbon((q) => -xLim(q) - 2.2, 1.6, -0.6), ribbon((q) => xLim(q) + 2.2, 1.6, -0.6)];
    const gC = mergeGeometries(bands, false); bands.forEach((b) => b.dispose());
    const mC = new THREE.Mesh(gC, bandC); mC.renderOrder = 4; mC.frustumCulled = false; world.add(mC); own.push(gC);
    const gW = ribbon(() => 0, 1.3, -1.2); const mW = new THREE.Mesh(gW, bandW); mW.renderOrder = 4; mW.frustumCulled = false; world.add(mW); own.push(gW);
    // lámina: superficie del arco entre las bandas (u: 0…1 a lo ancho, v: recorrido)
    const pos = [], uv = [], idx = []; const rows = Math.round((fB - fA) / 4), cols = 24;
    for (let r = 0; r <= rows; r++) { const q = fA + (fB - fA) * r / rows, lim = xLim(q) + 2.2; for (let c = 0; c <= cols; c++) { track.place(q, -lim + 2 * lim * c / cols, -0.9, F, _pl); pos.push(_pl.pos.x, _pl.pos.y, _pl.pos.z); uv.push(c / cols, q); } }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gv.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gv.setIndex(idx);
    const mv = new THREE.Mesh(gv, veil); mv.renderOrder = 3; mv.frustumCulled = false; world.add(mv); own.push(gv);
    // costillas parciales: arcos blancos por fuera de la superficie de vuelo, cada 54 m, con péndolas al techo en los extremos
    let n = 0;
    for (let q = S.fly0 - 30; q < S.fly1 + 30; q += 54, n++) {
      const lim = xLim(q) + 7, pts = [];
      for (let c = 0; c <= 32; c++) { track.place(q, -lim + 2 * lim * c / 32, -3.2, F, _pl); pts.push(_pl.pos.clone()); }
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, n % 3 === 0 ? 1.1 : 0.7, 8, false); tg.deleteAttribute('uv');
      (n % 3 === 0 ? arch.white : arch.grey).push(tg);
      if (n % 3 === 0) { for (const e of [pts[0], pts[pts.length - 1]]) { const c = ceil(e.x, e.z); if (c > e.y + 5) cyl(e, new THREE.Vector3(e.x, c + 6, e.z), 0.6, arch.white, 8); const lb = new THREE.BoxGeometry(2.2, 2.2, 2.2); lb.translate(e.x, e.y, e.z); arch.cold.push(lb); } }
    }
  }

  // ── Superficie: géiseres sobre las rayas de tigre (chorros cercanos y penachos enormes para la intro) ──
  const plumeM = beamMaterial(uni, [0.82, 0.92, 1.0], 0.032, { plume: true, coreExp: '0.6', tail: '3.2', near: '60.0', near2: '900.0' });
  const giantM = beamMaterial(uni, [0.7, 0.85, 1.0], 0.05, { plume: true, coreExp: '1.2', tail: '0.8', near: '2000.0', near2: '20000.0', alt: [4000, 16000] });
  own.push(plumeM, giantM);
  const geysers = [];
  {
    const l1 = [], l2 = [];
    const { t, n } = stDir();
    for (let k = 0; k < 4; k++) for (let j = 0; j < (lite ? 2 : 4); j++) {
      const along = lerp(-3400, 3400, (j + 0.5 + (rnd() - 0.5) * 0.6) / (lite ? 2 : 4));
      let pn = offsets[k] + ST.wig * Math.sin(along / ST.wsc + k * 1.7);
      const x = t.x * along + n.x * pn, z = t.y * along + n.y * pn;
      if (near3(new THREE.Vector3(x, natural(x, z), z), 300).d < 180) continue;     // lejos del tablero: se ven, no se atraviesan
      const gy = natural(x, z) - 6, h = 1800 + rnd() * 3200, r1 = 260 + rnd() * 420;
      const g = new THREE.CylinderGeometry(r1, 14 + rnd() * 10, h, 24, 1, true); g.translate(0, h / 2, 0);
      const tilt = new THREE.Vector3((rnd() - 0.5) * 0.25, 1, (rnd() - 0.5) * 0.25).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tilt)); g.translate(x, gy, z);
      l1.push(g); geysers.push(new THREE.Vector3(x, gy, z));
      // boca: anillo de hielo y luz caliente
      const vent = new THREE.CylinderGeometry(16, 24, 3, 16); vent.translate(x, gy + 2, z); arch.warm.push(vent);
    }
    // penachos gigantes (desde el espacio): conos largos y abiertos sobre el polo
    for (let k = 0; k < 4; k++) {
      const pn = offsets[k], x = n.x * pn, z = n.y * pn, h = 70000 + rnd() * 30000;
      const g = new THREE.CylinderGeometry(30000 + rnd() * 12000, 900, h, 32, 1, true); g.translate(0, h / 2, 0); g.translate(x + t.x * (rnd() - 0.5) * 2000, -200, z + t.y * (rnd() - 0.5) * 2000);
      l2.push(g);
    }
    const m1 = new THREE.Mesh(mergeGeometries(l1, false), plumeM); m1.renderOrder = 6; m1.frustumCulled = false; world.add(m1); own.push(m1.geometry); l1.forEach((g) => g.dispose());
    const m2 = new THREE.Mesh(mergeGeometries(l2, false), giantM); m2.renderOrder = 6; m2.frustumCulled = false; world.add(m2); own.push(m2.geometry); l2.forEach((g) => g.dispose());
  }

  // fusiona estructuras
  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (!q.index) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, SM[k]); mesh.castShadow = (k === 'white' || k === 'grey' || k === 'dark') && !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── Anillos de cohetes en las galerías ──
  const rr = buildRaceRings(world, track, ENC.rings.map(sOf), own, { kind: 'rockets', R: 17, lift: TC, color: [0.45, 0.85, 1.0] });
  for (const g of rr.gates) g.ammo = 1;                          // dos anillos en tubos estrechos: un cohete cada uno

  // ── Cielo: Saturno en creciente con los anillos casi de canto, estrellas ──
  const cen = new THREE.Vector3();
  const satC = cen.clone().addScaledVector(SAT_DIR, SAT_D);
  const ringN = (() => { const u = new THREE.Vector3(0, 1, 0); const pp = u.clone().addScaledVector(SAT_DIR, -u.dot(SAT_DIR)).normalize(); return pp.addScaledVector(SAT_DIR, -0.1).normalize(); })();
  // el plano de los anillos casi contiene la visual (Encélado orbita en él): ligero picado para que se lea la lámina
  {
    const { tex: rTex, r0, r1 } = ringTexture(); own.push(rTex);
    const satTex = saturnTexture(); own.push(satTex);
    const sm = saturnMaterial(satC, SUN, satTex, ringN, [r0 * SAT_R, r1 * SAT_R]); own.push(sm);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(SAT_R, 128, 64), sm); sat.scale.y = 0.9; sat.position.copy(satC);
    sat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ringN); sat.frustumCulled = false; sat.renderOrder = -2; world.add(sat); own.push(sat.geometry);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uMap: { value: rTex }, uSun: { value: SUN }, uC: { value: satC }, uR: { value: SAT_R }, uN: { value: ringN } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uMap; uniform vec3 uSun, uC, uN; uniform float uR; varying vec2 vUv; varying vec3 vW;
        void main(){
          #include <logdepthbuf_fragment>
          vec4 T = texture2D(uMap, vUv);
          // sombra de Saturno sobre los anillos
          vec3 rel = vW - uC; float t = dot(rel, uSun); vec3 perp = rel - uSun * t;
          float sh = (t < 0.0 && length(perp) < uR * 0.98) ? 0.05 : 1.0;
          // iluminada por la cara que mira al sol; a contraluz las partes finas brillan, las densas se apagan
          vec3 V = normalize(cameraPosition - vW);
          float same = sign(dot(uN, uSun)) * sign(dot(uN, V));
          float lit = same > 0.0 ? 1.0 : (1.0 - T.a) * 1.6 + 0.08;
          gl_FragColor = vec4(T.rgb * 1.1 * lit * sh, T.a * 0.95);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    own.push(ringMat);
    const RS = 8, AS = 512, pos = [], uv = [], idx = [];
    const e1 = new THREE.Vector3().crossVectors(ringN, new THREE.Vector3(1, 0, 0)).normalize(), e2 = new THREE.Vector3().crossVectors(ringN, e1).normalize();
    for (let i = 0; i <= RS; i++) { const u = i / RS, r = (r0 + (r1 - r0) * u) * SAT_R; for (let j = 0; j <= AS; j++) { const a = j / AS * Math.PI * 2; const p = satC.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r); pos.push(p.x, p.y, p.z); uv.push(u, j / AS * 16); } }
    for (let i = 0; i < RS; i++) for (let j = 0; j < AS; j++) { const a = i * (AS + 1) + j, b = a + 1, c = a + AS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
    const ring = new THREE.Mesh(gg, ringMat); ring.frustumCulled = false; ring.renderOrder = -1; world.add(ring); own.push(gg);
  }
  {
    const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(800000);
      pos.set([v.x, v.y, v.z], i * 3);
      const b = 0.25 + Math.pow(rnd(), 5) * 2.2, t = rnd();
      col.set(t < 0.2 ? [b * 0.8, b * 0.9, b] : t > 0.88 ? [b, b * 0.86, b * 0.7] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const stp = new THREE.Points(gg, sm); stp.frustumCulled = false; stp.renderOrder = -3; world.add(stp); own.push(gg, sm);
  }

  // ── Zonas con nombre (cartel al entrar) ──
  let firstStripe = null;
  for (let q = 60; q < S.down0; q += 6) { const p = P3(q); if (Math.abs(stripeD(p.x, p.z).d) < 60) { firstStripe = q; break; } }
  const zones = [
    [(firstStripe ?? 600) - 220, 'TIGER STRIPES', ['Grietas vivas · géiseres', 'Live fissures · geysers']],
    [S.down0 - 160, 'THE DESCENT', ['Bajo la corteza de hielo', 'Below the ice crust']],
    [S.gal10 + 40, 'GALLERIES', ['Anillo de cohetes', 'Rocket ring']],
    [S.fly0 - RAMP - 200, 'FREE FLIGHT', ['Sin tablero · vuela entre las bandas', 'No deck · fly between the bands']],
    [S.up0 - 120, 'THE ASCENT', ['Vuelta a la superficie', 'Back to the surface']],
  ].map(([q, title, sub]) => ({ s: track.wrap(q), title, sub }));

  const prevS = new Map();
  const fx = {
    t: 0, gates: rr.gates, zones,
    update(dt) {
      this.t += dt; uni.uT.value = this.t; rr.update(dt);
      for (const g of glows) g.material.rotation += dt * 0.005;
    },
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevS.delete(sh); continue; }
        const p = prevS.get(sh) ?? sh.s;
        for (const z of zones) { const d0 = track.delta(p, z.s), d1 = track.delta(sh.s, z.s); if (d0 > 0 && d1 <= 0 && d1 > -60) onPass?.(sh, { kind: 'banner', title: z.title, sub: z.sub }); }
        prevS.set(sh, sh.s);
      }
      rr.passRings(ships, onPass);
    },
    reset() { prevS.clear(); rr.reset(); },
  };

  // ── Intro ──
  const introKeys = makeIntro({ track, S, F, P3, natural, offsets, ruins, satC, MC, geysers });

  let ymin = Infinity, ymax = -Infinity; for (const q of smp) { ymin = Math.min(ymin, q.p.y); ymax = Math.max(ymax, q.p.y); }
  console.info(`[SRS] ENCELADUS: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · bajo hielo ${Math.round(covA)}–${Math.round(covB)} · vuelo ${Math.round(S.fly0)}–${Math.round(S.fly1)} · torres ${towers.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => terrain(x, z), tunnel: { s: covA, len: covB - covA }, ownTunnel: true, bridges: 0, introKeys, fx,
    dbg: { S, smp, zones, terrain, natural, ceil, surfX, ceilX, towers, pillars, ruins, offsets, tubeRuns, geysers, near3 } };
}

// ── Intro: Encélado entero con sus penachos y Saturno detrás; picado sobre el polo; a ras de una raya de tigre entre géiseres;
//    sobre una estación anterior a SARUS; y a la parrilla ──
function makeIntro({ track, S, F, P3, natural, offsets, ruins, satC, MC, geysers }) {
  const up = new THREE.Vector3(0, 1, 0);
  const satH = new THREE.Vector3(satC.x, 0, satC.z).normalize();
  const side = new THREE.Vector3().crossVectors(up, satH).normalize();
  const { t, n } = stDir();
  // raya elegida: la que más cerca pasa de la salida
  const g0 = P3(0); let k0 = 0, bd = Infinity; offsets.forEach((c, k) => { const d = Math.abs(g0.x * n.x + g0.z * n.y - c); if (d < bd) { bd = d; k0 = k; } });
  const onStripe = (along, alt) => { const pn = offsets[k0] + ST.wig * Math.sin(along / ST.wsc + k0 * 1.7); const x = t.x * along + n.x * pn, z = t.y * along + n.y * pn; return new THREE.Vector3(x, natural(x, z) + alt, z); };
  const along0 = g0.x * t.x + g0.z * t.y;
  const ru = ruins.length ? ruins.reduce((a, r) => (Math.hypot(r.x - g0.x, r.z - g0.z) < Math.hypot(a.x - g0.x, a.z - g0.z) ? r : a), ruins[0]) : { x: g0.x + 600, z: g0.z };
  const ruP = new THREE.Vector3(ru.x, natural(ru.x, ru.z), ru.z);
  track.sample(0, F); const gridTan = F.tan.clone();
  void geysers;
  const keys = [
    [0.0, MC.clone().addScaledVector(satH, -150000).addScaledVector(up, 70000).addScaledVector(side, 26000), MC.clone().addScaledVector(up, 58000).addScaledVector(satH, 40000), 36],
    [3.8, new THREE.Vector3(0, 21000, 0).addScaledVector(satH, -14000).addScaledVector(side, 5000), new THREE.Vector3(0, 0, 0).addScaledVector(satH, 6000), 46],
    [7.0, onStripe(along0 - 2600, 240), onStripe(along0 - 800, 60), 58],
    [9.6, onStripe(along0 - 900, 120).lerp(ruP.clone().add(new THREE.Vector3(0, 90, 0)), 0.55), ruP.clone().add(new THREE.Vector3(0, 10, 0)), 60],
    [12.4, P3(-620, 70, 60), P3(-120, 0, 0), 58],
  ];
  void gridTan;
  return () => keys.map(([tt, a, b, f]) => [tt, a.clone(), b.clone(), f]);
}
