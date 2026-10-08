// PHOBOS: la luna de Marte. Trazado de archivo: circuito urbano portuario, c. 1950. Salida en la superficie con Marte enorme al fondo;
// la pista baja al cráter Stickney, entra en la roca por una boca en su pared (portal con módulos industriales),
// recorre un túnel octogonal iluminado hasta una gran caverna excavada (curva de entrada, horquilla y salida, con
// módulos en las paredes y el anillo de cohetes), vuelve por el túnel largo y sale al fondo del cráter.
//
// Túneles octogonales: caras planas (pocos vértices, paneles y tiras de luz en las aristas, lectura clara a
// velocidad) frente al tubo redondo (más vértices para la misma silueta) o el rectangular (demasiado plano).
import * as THREE from 'three';
import { reshapeLoop, mx } from './reshape.js';
const MX = mx('phobos');                      // trazado en espejo (reshape.js)
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { buildRaceRings } from './rings.js';
import { TILE, BAKE, gpuBake } from './miranda.js';
import { QUALITY } from './quality.js';

// Trazado (px del plano). Salida hacia el noreste: primera curva, subida, curva del fondo del cráter,
// boca A, caverna (entrada, horquilla, salida), túnel largo, boca B, chicane, curva del puerto, última curva
const RAW = [[95, 335], [130, 300], [170, 268], [210, 245], [245, 228], [272, 222], [292, 232], [312, 258], [340, 282], [370, 300], [398, 322], [415, 345], [440, 362], [470, 378], [500, 400], [525, 428], [550, 442], [578, 440], [598, 424], [606, 398], [612, 370], [630, 355], [670, 352], [720, 354], [765, 357], [778, 372], [768, 390], [752, 404], [745, 425], [750, 442], [762, 438], [768, 418], [778, 402], [798, 406], [818, 420], [824, 438], [804, 456], [772, 476], [736, 492], [690, 506], [650, 515], [612, 512], [580, 500], [548, 484], [512, 464], [478, 440], [452, 418], [432, 408], [412, 400], [396, 384], [372, 356], [340, 326], [308, 296], [280, 274], [255, 266], [228, 274], [195, 293], [160, 320], [128, 350], [104, 385], [85, 425], [68, 458], [50, 480], [32, 482], [22, 462], [26, 432], [40, 400], [64, 366]];
const IDX = { c1: 5, c2: 15, inA: 16, c3: 21, c4: 25, hairpin: 29, c5: 35, ring: 36, tunnel: 40, outB: 46, chicane: 48, c6: 52 };
const K = 3.4;                                 // ≈ 7,6 km
const STICKNEY = [480, 420], ST_R = 520, ST_D = 150;
const HALL = [770, 412], HALL_R = [310, 245], HALL_H = 64;
const Y_TUN = -150, Y_HALL = -160;
const TW = 24, TH = 20;                        // túnel: semiancho y alto (m)
// Marte y Sol
const MARS_DIR = new THREE.Vector3(0.52 * MX, 0, -0.85).normalize();
const MARS_D = 160000, MARS_R = 56000, MARS_EL = Math.tan(4 * Math.PI / 180);
export function phobosSunDir() { const side = new THREE.Vector3(-MARS_DIR.z, 0, MARS_DIR.x).multiplyScalar(MX); return MARS_DIR.clone().multiplyScalar(0.25).addScaledVector(side, -0.88).add(new THREE.Vector3(0, 0.42, 0)).normalize(); }
// cuerpo de Phobos: elipsoide (escala de juego, la mitad del real), con la pista en lo alto
const MB = 7000, MA = MB * 1.25, MC = MB * 1.08;

const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
const fbm = (x, z, o = 4) => { let a = 0, w = 0.5; for (let i = 0; i < o; i++) { a += vn(x, z) * w; x = x * 2.03 + 1.7; z = z * 2.03 + 3.1; w *= 0.5; } return a; };
function vn3(x, y, z) { return (vn(x + y * 0.71, z - y * 0.37) + vn(y + z * 0.53, x - z * 0.29)) * 0.5; }
let _seed = 61;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

function layout() {
  let cx = 0, cy = 0; for (const [x, y] of RAW) { cx += x; cy += y; } cx /= RAW.length; cy /= RAW.length;
  const toW = ([x, y]) => new THREE.Vector3(MX * (x - cx) * K, 0, (y - cy) * K);
  const P = RAW.map(toW);
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = curve.getLength(), N = Math.round(L / 8);
  let S = curve.getSpacedPoints(N).slice(0, N);
  for (let pass = 0; pass < 4; pass++) S = S.map((_, i) => { const a = new THREE.Vector3(); for (let k = -4; k <= 4; k++) a.add(S[(i + k + N) % N]); return a.multiplyScalar(1 / 9); });
  S = reshapeLoop(S, 'phobos');               // tramos redibujados (reshape.js)
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + S[i % N].distanceTo(S[i - 1]));
  const total = cum[N];
  const iOf = (p) => { let b = 0, bd = Infinity; S.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; b = i; } }); return b; };
  const corner = {}, ci = {}; for (const [k, i] of Object.entries(IDX)) { ci[k] = iOf(P[i]); corner[k] = cum[ci[k]] / total; }
  return { S, cum, total, corner, ci, st: toW(STICKNEY), hall: toW(HALL) };
}

// ── Materiales ──
// Roca y regolito: gris pardo (las fotos de la Mars Express), cráteres y estrías horneados; en las paredes,
// estrías y estratos. Arriba se mira con la vertical local del cuerpo (las laderas de la luna se ven como suelo).
function rockMaterial(tex, center, cave = false) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRock = { value: tex }; sh.uniforms.uC = { value: center }; sh.uniforms.uCaps = { value: m.userData.caps || [0, 0, 0, 0].map(() => new THREE.Vector4(0, -1e6, 0, 0)) };
    sh.uniforms.uLamps = { value: cave.lamps || [new THREE.Vector4(0, -1e6, 0, 1)] };
    const NL = (cave.lamps || [0]).length;
    const hdr = `varying vec3 vRW; varying vec3 vRN; uniform sampler2D uRock; uniform vec3 uC; uniform vec4 uLamps[${NL}]; uniform vec4 uCaps[4];
      float rh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(rh(i), rh(i+vec2(1,0)), f.x), mix(rh(i+vec2(0,1)), rh(i+vec2(1,1)), f.x), f.y); }`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${hdr}`)
      .replace('void main() {', 'void main() {\n  vec3 rNw = vec3(0.0, 1.0, 0.0); float rSteep = 0.0;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${cave ? '' : `for (int i = 0; i < 2; i++) { vec3 a = uCaps[i * 2].xyz, b = uCaps[i * 2 + 1].xyz; vec3 ab = b - a; float t = clamp(dot(vRW - a, ab) / dot(ab, ab), 0.0, 1.0); if (length(vRW - a - ab * t) < uCaps[i * 2].w) discard; }`}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vRW; vec3 n = normalize(vRN);
          ${cave ? 'n = gl_FrontFacing ? n : -n;' : ''}
          vec3 up = ${cave ? 'vec3(0.0, 1.0, 0.0)' : 'normalize(p - uC)'};
          float camD = length(cameraPosition - p);
          rSteep = 1.0 - smoothstep(0.42, 0.8, dot(n, up));
          vec3 top = vec3(0.5), face = vec3(0.5), bump = vec3(0.0); float fd = 0.0;
          vec3 tang = normalize(cross(up, n) + vec3(1e-4, 0.0, 0.0));
          float a = dot(p, tang);
          vec2 dPx = dFdx(p.xz), dPy = dFdy(p.xz);
          vec2 wuv = vec2((a + p.y * 0.25) / 520.0, dot(p, up) / 2100.0);
          vec2 dWx = dFdx(wuv), dWy = dFdy(wuv);
          float flatK = up.y;
          if (rSteep < 0.99) {
            vec2 uv = p.xz / ${TILE.toFixed(1)};
            float e = 1.2 / ${TILE.toFixed(1)};
            vec2 gx = dPx / ${TILE.toFixed(1)}, gy = dPy / ${TILE.toFixed(1)};
            vec4 T = textureGrad(uRock, uv, gx, gy);
            float hx = textureGrad(uRock, uv + vec2(e, 0.0), gx, gy).r, hz = textureGrad(uRock, uv + vec2(0.0, e), gx, gy).r;
            float near = (1.0 - smoothstep(40.0, 220.0, camD)) * step(0.9, flatK);
            vec2 uv2 = mat2(0.8, 0.6, -0.6, 0.8) * p.xz / 113.0;
            vec4 D = vec4(0.0, 0.5, 0.0, 1.0); float dx2 = 0.0, dz2 = 0.0;
            if (near > 0.0) { vec2 g2x = mat2(0.8, 0.6, -0.6, 0.8) * dPx / 113.0, g2y = mat2(0.8, 0.6, -0.6, 0.8) * dPy / 113.0; D = textureGrad(uRock, uv2, g2x, g2y); dx2 = textureGrad(uRock, uv2 + vec2(e * 7.0, 0.0), g2x, g2y).r - D.r; dz2 = textureGrad(uRock, uv2 + vec2(0.0, e * 7.0), g2x, g2y).r - D.r; }
            float bk = smoothstep(0.6, 0.95, flatK);
            bump = vec3(-(hx - T.r) / 1.2 * 0.5 - dx2 / 0.17 * 0.15 * near, 0.0, -(hz - T.r) / 1.2 * 0.5 - dz2 / 0.17 * 0.15 * near) * bk;
            float alb = clamp(T.g * 0.8 + 0.1, 0.0, 1.0);
            top = mix(vec3(0.25, 0.235, 0.22), vec3(0.6, 0.56, 0.52), alb) * (0.9 + 0.2 * D.g * near);
            top = mix(top, top * vec3(0.86, 0.9, 0.98), clamp(T.b, 0.0, 1.0) * 0.5);           // surcos gris azulado
          }
          if (rSteep > 0.01) {
            float W = textureGrad(uRock, wuv, dWx, dWy).a, Wd = textureGrad(uRock, wuv + vec2(1.6 / 520.0, 0.0), dWx, dWy).a;
            float Wg = textureGrad(uRock, wuv * 0.37 + 0.11, dWx * 0.37, dWy * 0.37).g;
            face = mix(vec3(0.12, 0.115, 0.11), vec3(0.52, 0.49, 0.46), smoothstep(0.25, 0.85, W)) * (0.8 + 0.35 * Wg);
            fd = (Wd - W) * 2.4;
          }
          diffuseColor.rgb = mix(top, face, rSteep);
          rNw = normalize(n + bump * (1.0 - rSteep) + tang * fd * rSteep);
          { vec3 tw = pow(abs(n), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
            vec4 ax = texture2D(uRock, p.zy / 230.0), ay = texture2D(uRock, p.xz / 230.0), az = texture2D(uRock, p.xy / 230.0);
            vec4 bx = texture2D(uRock, p.zy / 37.0 + 0.3), by = texture2D(uRock, p.xz / 37.0 + 0.3), bz = texture2D(uRock, p.xy / 37.0 + 0.3);
            float A = ax.a * tw.x + ay.a * tw.y + az.a * tw.z, Gc = ax.g * tw.x + ay.g * tw.y + az.g * tw.z, Bc = bx.g * tw.x + by.g * tw.y + bz.g * tw.z;
            vec3 tri = mix(vec3(0.1, 0.095, 0.09), vec3(0.5, 0.47, 0.44), clamp(A * 0.6 + Gc * 0.5 + (Bc - 0.5) * 0.5 - 0.15, 0.0, 1.0));
            ${cave ? '' : 'diffuseColor.rgb = mix(diffuseColor.rgb, tri, smoothstep(0.3, 0.9, rSteep)); rNw = normalize(mix(rNw, n, smoothstep(0.3, 0.9, rSteep)));'} }
          ${cave ? `{ vec3 tw = pow(abs(n), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
            vec4 ax = texture2D(uRock, p.zy / 230.0), ay = texture2D(uRock, p.xz / 230.0), az = texture2D(uRock, p.xy / 230.0);
            vec4 bx = texture2D(uRock, p.zy / 37.0 + 0.3), by = texture2D(uRock, p.xz / 37.0 + 0.3), bz = texture2D(uRock, p.xy / 37.0 + 0.3);
            float A = ax.a * tw.x + ay.a * tw.y + az.a * tw.z, Gc = ax.g * tw.x + ay.g * tw.y + az.g * tw.z, Bc = bx.g * tw.x + by.g * tw.y + bz.g * tw.z;
            float hgt = (ax.r * tw.x + ay.r * tw.y + az.r * tw.z);
            diffuseColor.rgb = mix(vec3(0.07, 0.065, 0.06), vec3(0.42, 0.39, 0.36), clamp(A * 0.6 + Gc * 0.5 + (Bc - 0.5) * 0.4 - 0.15, 0.0, 1.0));
            rNw = normalize(n + (vec3(dFdx(hgt), dFdy(hgt), 0.0)) * 0.0); }` : ''}
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(rNw, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${cave ? `{ vec3 acc = vec3(0.0);
          for (int i = 0; i < ${NL}; i++) { vec3 d = uLamps[i].xyz - vRW; float l2 = dot(d, d); float r = uLamps[i].w;
            float lam = max(dot(rNw, normalize(d)), 0.0) * 0.8 + 0.2;
            acc += lam * r * r / (l2 + r * r * 0.3) * (i % 2 == 0 ? vec3(1.0, 0.72, 0.42) : vec3(0.55, 0.8, 1.0)); }
          totalEmissiveRadiance += diffuseColor.rgb * acc * 0.16; }` : ''}`);
  };
  m.customProgramCacheKey = () => (cave ? 'phCave' + (cave.lamps || []).length : 'phRock') + '5';
  return m;
}

// Paneles del túnel octogonal: juntas, remaches de luz, tiras en las aristas con pulsos que corren
function tunnelMaterial(uni, tint) {
  const m = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.55, metalness: 0.55, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTu;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTu = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vTu; uniform float uT;
      float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('void main() {', 'void main() {\n  float tStrip = 0.0, tPulse = 0.0, tSeam = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vTu.x, s = vTu.y;                      // u: perímetro (m), s: recorrido (m)
          float cs = fract(s / 6.0), cu = fract(u / 4.0);
          tSeam = max(1.0 - smoothstep(0.0, 0.025, min(cs, 1.0 - cs)), 1.0 - smoothstep(0.0, 0.03, min(cu, 1.0 - cu)));
          vec2 cell = vec2(floor(s / 6.0), floor(u / 4.0));
          diffuseColor.rgb *= (0.8 + 0.35 * th(cell)) * (1.0 - 0.55 * tSeam);
          // tiras: arista techo-chaflán (u≈ 0.5/0.5 del perímetro, marcadas por vTu.x en el perfil) y zócalo
          float k = mod(u, 1000.0);
          tStrip = 0.0;
          ${[0, 1, 2, 3].map((i) => `tStrip = max(tStrip, 1.0 - smoothstep(0.18, 0.32, abs(u - uStrip${i})));`).join('\n          ')}
          float ph = fract((s - uT * 120.0) / 90.0) * 90.0;
          tPulse = exp(-pow((ph - 45.0) / 4.0, 2.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08), tStrip);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.9, tSeam);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += ${'vec3(' + tint.map((v) => v.toFixed(3)).join(',') + ')'} * tStrip * (1.6 + 5.0 * tPulse);
        totalEmissiveRadiance += vec3(0.02, 0.022, 0.026) * (1.0 - tSeam);`);
    sh.fragmentShader = sh.fragmentShader.replace('varying vec2 vTu; uniform float uT;', `varying vec2 vTu; uniform float uT;\n      ${uni.strips.map((v, i) => `const float uStrip${i} = ${v.toFixed(3)};`).join(' ')}`);
  };
  m.customProgramCacheKey = () => 'phTun' + tint.join(',') + uni.strips.join(',');
  return m;
}

// Marte (mapa horneado): ocre, mares oscuros, casquetes, Valles Marineris, velo de atmósfera
const MARS_BAKE = /* glsl */`
  varying vec2 vUv;
  float hP(vec2 n, float N){ n = mod(n, N); return fract(sin(dot(n, vec2(127.1, 311.7))) * 43758.5453); }
  float nP(vec2 p, float N){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hP(i, N), hP(i+vec2(1,0), N), f.x), mix(hP(i+vec2(0,1), N), hP(i+vec2(1,1), N), f.x), f.y); }
  float fP(vec2 p, float N){ float a = 0.0, w = 0.5; for (int i = 0; i < 6; i++) { a += nP(p, N) * w; p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  void main(){
    float u = vUv.x, lat = (vUv.y - 0.5) * 3.14159265;
    vec2 q = vec2(u * 8.0, vUv.y * 4.0);
    float a = fP(q, 8.0), b = fP(q * 3.0 + 7.0, 24.0), c = fP(q * 9.0 + 3.0, 72.0);
    vec3 col = mix(vec3(0.62, 0.33, 0.18), vec3(0.82, 0.52, 0.32), a);
    col *= 0.85 + 0.3 * c;
    float dark = smoothstep(0.55, 0.68, fP(q * 0.5 + 11.0, 4.0) * 0.7 + b * 0.4) * (1.0 - smoothstep(0.7, 1.1, abs(lat)));
    col = mix(col, vec3(0.3, 0.2, 0.15), dark * 0.75);
    float vm = exp(-pow((lat + 0.15 + (b - 0.5) * 0.04) / 0.02, 2.0)) * smoothstep(0.25, 0.3, u) * (1.0 - smoothstep(0.42, 0.47, u));
    col = mix(col, vec3(0.32, 0.18, 0.12), vm * 0.8);
    float cap = smoothstep(1.18, 1.3, abs(lat) + (b - 0.5) * 0.12);
    col = mix(col, vec3(0.92, 0.9, 0.88), cap);
    gl_FragColor = vec4(col, 1.0);
  }`;
function marsMaterial(center, sun, tex) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sun }, uMap: { value: tex }, uT: { value: 0 } },
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
      uniform vec3 uC, uSun; uniform sampler2D uMap; uniform float uT; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.z, n.x) + uT * 0.003;
        vec3 col = texture2D(uMap, vec2(fract(lon / 6.2831853 + 0.5), lat / 3.14159265 + 0.5)).rgb;
        float lam = dot(n, normalize(uSun)), day = smoothstep(-0.1, 0.25, lam);
        float limb = pow(max(0.0, dot(n, V)), 0.4);
        col = pow(col, vec3(1.35)) * 1.25;
        vec3 c = col * (0.006 + 0.95 * day * (0.25 + 0.75 * max(lam, 0.0))) * (0.6 + 0.4 * limb);
        c += vec3(0.85, 0.55, 0.42) * pow(1.0 - max(0.0, dot(n, V)), 3.0) * 0.35 * smoothstep(-0.3, 0.3, lam);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildPhobos(def, { world, own, srcMat, renderer }) {
  const T0 = performance.now();
  _seed = 61;
  const { S, cum, total, corner, ci, st, hall } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);
  const MC0 = new THREE.Vector3(centroid.x, -MB, centroid.z);       // centro del cuerpo

  // ── Terreno natural: curvatura del cuerpo, Stickney, cráteres, surcos ──
  const craters = [];
  for (let k = 0, tries = 0; k < 70 && tries < 600; tries++) {
    const a = rnd() * Math.PI * 2, rr = 200 + Math.pow(rnd(), 0.8) * 5200, R = 25 + Math.pow(rnd(), 2.4) * 380;
    const x = centroid.x + Math.cos(a) * rr * 1.2, z = centroid.z + Math.sin(a) * rr;
    if (Math.hypot(x - st.x, z - st.z) < ST_R + R * 1.4) continue;
    craters.push({ x, z, R }); k++;
  }
  const bodyTop = (x, z) => { const dx = (x - MC0.x) / MA, dz = (z - MC0.z) / MC; return MC0.y + MB * Math.sqrt(Math.max(0, 1 - dx * dx - dz * dz)); };
  const stickney = (x, z) => {
    const u = Math.hypot(x - st.x, z - st.z) / ST_R + (vn(x / 160, z / 160) - 0.5) * 0.06;
    if (u > 2.2) return 0;
    if (u < 1) return -ST_D + (ST_D + 26) * Math.pow(sstep(0.66, 1, u), 1.25) + 4 * (fbm(x / 90, z / 90, 3) - 0.5) * (1 - sstep(0.6, 0.9, u));
    return 26 * Math.exp(-(((u - 1) / 0.32) ** 2));
  };
  const natural = (x, z) => {
    let y = bodyTop(x, z) + stickney(x, z) + 10 * (fbm(x / 1100, z / 1100, 3) - 0.5) + 2.5 * (vn(x / 130, z / 130) - 0.5);
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.R; if (d > 2.2) continue;
      y += (d < 1 ? (d * d - 1) * 0.2 * c.R : 0) + Math.exp(-(((d - 1) / 0.25) ** 2)) * 0.05 * c.R;
    }
    // surcos de Phobos: cadenas paralelas
    const gr = Math.abs(Math.sin((x * 0.8 + z * 0.6) / 46 + fbm(x / 700, z / 700, 2) * 4));
    y -= 2.2 * Math.pow(1 - gr, 6) * sstep(0.45, 0.6, vn(x / 900 + 7, z / 900));
    return y;
  };
  const inHall = (x, z, k = 1) => (((x - hall.x) / (HALL_R[0] * k)) ** 2 + ((z - hall.z) / (HALL_R[1] * k)) ** 2);

  // ── Cotas: superficie suavizada; dentro, a −150 m con el valle de Le Tunnel; caverna plana ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  const inInt = (i) => i >= ci.inA && i <= ci.outB;
  let base = S.map((p) => natural(p.x, p.z));
  for (let pass = 0; pass < 8; pass++) base = base.map((_, i) => { let a = 0; for (let k = -12; k <= 12; k++) a += base[(i + k + N) % N]; return a / 25; });
  let y = S.map((p, i) => {
    const f = cum[i] / total;
    if (!inInt(i)) return Math.max(base[i], natural(p.x, p.z) - 28) + 3 * g(f, corner.c1, 140);
    return Y_TUN - 16 * g(f, corner.tunnel, 230) + 4 * g(f, corner.c3, 120);
  });
  for (let pass = 0; pass < 5; pass++) y = y.map((_, i) => { let a = 0; for (let k = -6; k <= 6; k++) a += y[(i + k + N) % N]; return a / 13; });
  // caverna: plana
  const hallW = S.map((p) => sstep(1.0, 0.8, inHall(p.x, p.z)));
  y = y.map((v, i) => lerp(v, Y_HALL, hallW[i]));
  for (let pass = 0; pass < 2; pass++) y = y.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += y[(i + k + N) % N]; return a / 7; });
  y = y.map((v, i) => (hallW[i] > 0.999 ? Y_HALL : v));

  // pendiente máxima ~20 % al aire: las rampas del cráter se hacen trinchera en el borde en vez de muro
  { const ds = total / N, gm = 0.2 * ds;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < N; i++) if (!inInt(i)) y[i] = Math.min(y[i], y[i - 1] + gm);
      for (let i = N - 2; i >= 0; i--) if (!inInt(i)) y[i] = Math.min(y[i], y[i + 1] + gm);
    }
    for (let pass = 0; pass < 2; pass++) y = y.map((v, i) => { if (inInt(i)) return v; let a = 0; for (let k = -2; k <= 2; k++) a += y[(i + k + N) % N]; return a / 5; }); }
  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.17, 0.33, 0.5, 0.66, 0.83], bank: (f, k) => THREE.MathUtils.clamp(k * 36, -0.2, 0.2) });
  const F = track.frame();
  const L = track.length;

  // ── Tramo interior: tapado por roca (natural muy por encima del tablero) o dentro de la caverna ──
  const sA0 = corner.inA * L, sB0 = corner.outB * L;
  const covered = (s) => { track.sample(s, F); return inHall(F.pos.x, F.pos.z) < 1 || natural(F.pos.x, F.pos.z) > F.pos.y + TH + 6; };
  let sIn = sA0; while (sIn < sB0 && !covered(sIn)) sIn += 2;
  let sOut = sB0; while (sOut > sIn && !covered(sOut)) sOut -= 2;
  // entrada y salida de la caverna
  const hallVal = (s) => { track.sample(s, F); return inHall(F.pos.x, F.pos.z); };
  let hIn = sIn; while (hIn < sOut && hallVal(hIn) > 1) hIn += 1;
  let hOut = sOut; while (hOut > hIn && hallVal(hOut) > 1) hOut -= 1;
  const zone = (s) => { s = track.wrap(s); if (s < sIn || s > sOut) return 0; return (s >= hIn && s <= hOut) ? 2 : 1; };   // 0 aire, 1 túnel, 2 caverna

  // ── Muestras de pista para el terreno ──
  const smp = [];
  for (let s = 0; s < L; s += 4) {
    track.sample(s, F);
    const rh = Math.hypot(F.right.x, F.right.z), th = Math.hypot(F.tan.x, F.tan.z);
    smp.push({ s, x: F.pos.x, z: F.pos.z, y: F.pos.y, rx: F.right.x / rh, rz: F.right.z / rh, slope: F.right.y / rh, tx: F.tan.x / th, tz: F.tan.z / th, grade: F.tan.y / th, hw: 17.6 * track.wAt(s), zone: zone(s) });
  }
  const CELL = 40, hash = new Map();
  smp.forEach((q, i) => { const k = `${Math.floor(q.x / CELL)},${Math.floor(q.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const nearSamples = (x, z, r) => {
    const out = [], c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL), d0 = Math.floor((z - r) / CELL), d1 = Math.floor((z + r) / CELL);
    for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) { const l = hash.get(`${a},${b}`); if (l) for (const i of l) out.push(smp[i]); }
    return out;
  };
  const clearOf = (x, z, r = 90) => { let d = Infinity; for (const q of nearSamples(x, z, r)) d = Math.min(d, Math.hypot(q.x - x, q.z - z)); return d; };
  // terreno final: junto a la pista al aire, nivelado con el tablero; sobre túnel y caverna, roca por encima
  const terrain = (x, z) => {
    const nat = natural(x, z);
    let best = null, bd = Infinity;
    for (const q of nearSamples(x, z, 150)) { const d = (x - q.x) ** 2 + (z - q.z) ** 2; if (d < bd) { bd = d; best = q; } }
    let y0 = nat;
    if (best) {
      const q = best, dx = x - q.x, dz = z - q.z, lat = Math.abs(dx * q.rx + dz * q.rz);
      if (q.zone === 0) {
        { const ty = q.y + (dx * q.rx + dz * q.rz) * q.slope + (dx * q.tx + dz * q.tz) * q.grade - 1.1, bw = Math.max(34, (nat - ty) * 0.9); if (lat < q.hw + 4 + bw) { const w = lat < q.hw + 4 ? 1 : sstep(q.hw + 4 + bw, q.hw + 4, lat); y0 = lerp(nat, ty, w); } }
      } else {
        const top = q.y + (q.zone === 2 ? HALL_H : TH) + 16, w = sstep(TW + 130, TW + 30, lat);
        y0 = Math.max(nat, lerp(nat, top, w));
      }
    }
    const e = inHall(x, z, 1.15);
    if (e < 1.6) y0 = Math.max(y0, lerp(y0, Y_HALL + HALL_H + 18, sstep(1.6, 1.0, e)));
    return y0;
  };

  const uni = { uT: { value: 0 } };
  const rockRT = gpuBake(renderer, 1024, BAKE); own.push(rockRT);
  // bocas del cráter: hueco en el terreno donde entra el túnel (cápsula a lo largo del eje del túnel)
  const caps = [];
  for (const [s0, s1] of [[sIn - 22, sIn + 30], [sOut + 22, sOut - 30]]) { track.sample(s0, F); const a = F.pos.clone().addScaledVector(F.up, TH * 0.45); track.sample(s1, F); const b = F.pos.clone().addScaledVector(F.up, TH * 0.45); caps.push(new THREE.Vector4(a.x, a.y, a.z, 22.5), new THREE.Vector4(b.x, b.y, b.z, 0)); }
  const rock = rockMaterial(rockRT.texture, MC0); rock.userData.caps = caps; own.push(rock);

  // ── Malla fina alrededor de la pista (losetas, normales compartidas) ──
  let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity; for (const q of smp) { ix0 = Math.min(ix0, q.x); ix1 = Math.max(ix1, q.x); iz0 = Math.min(iz0, q.z); iz1 = Math.max(iz1, q.z); }
  ix0 -= 600; ix1 += 600; iz0 -= 600; iz1 += 600;
  {
    const RES = 8, nx = Math.ceil((ix1 - ix0) / RES), nz = Math.ceil((iz1 - iz0) / RES);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = ix0 + i * RES, z = iz0 + j * RES, o = (j * (nx + 1) + i) * 3; pos[o] = x; pos[o + 1] = terrain(x, z); pos[o + 2] = z; }
    const idx = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const full = new THREE.BufferGeometry(); full.setAttribute('position', new THREE.BufferAttribute(pos, 3)); full.setIndex(idx); full.computeVertexNormals();
    const nrm = full.attributes.normal.array; full.dispose();
    const TS = 96;
    for (let j0 = 0; j0 < nz; j0 += TS) for (let i0 = 0; i0 < nx; i0 += TS) {
      const i1 = Math.min(nx, i0 + TS), j1 = Math.min(nz, j0 + TS), w = i1 - i0 + 1, hh = j1 - j0 + 1;
      const tp = new Float32Array(w * hh * 3), tn = new Float32Array(w * hh * 3), ti = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const src = (j * (nx + 1) + i) * 3, dst = ((j - j0) * w + (i - i0)) * 3; for (let c = 0; c < 3; c++) { tp[dst + c] = pos[src + c]; tn[dst + c] = nrm[src + c]; } }
      for (let j = 0; j < hh - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i, b = a + 1, c = a + w, d = c + 1; ti.push(a, c, b, b, c, d); }
      const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.BufferAttribute(tp, 3)); gt.setAttribute('normal', new THREE.BufferAttribute(tn, 3)); gt.setIndex(ti); gt.computeBoundingSphere();
      const mesh = new THREE.Mesh(gt, rock); mesh.receiveShadow = true; mesh.castShadow = true; world.add(mesh); own.push(gt);
    }
  }
  // ── El cuerpo entero de Phobos (para la intro y el horizonte): elipsoide grumoso, con hueco bajo la malla fina ──
  {
    const sg = new THREE.SphereGeometry(1, Math.round(320 * QUALITY.segs), Math.round(160 * QUALITY.segs));
    const p = sg.attributes.position, v = new THREE.Vector3();
    const big = []; for (let k = 0; k < 40; k++) { const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(); big.push([d, 0.04 + Math.pow(rnd(), 2) * 0.22]); }
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let P = new THREE.Vector3(v.x * MA, v.y * MB, v.z * MC);
      const wTop = sstep(0.72, 0.86, v.y);
      // forma grumosa y cráteres grandes lejos de lo alto
      let k = 1 + 0.07 * (vn3(v.x * 2.1, v.y * 2.1, v.z * 2.1) - 0.5) * 2 + 0.025 * (vn3(v.x * 6, v.y * 6, v.z * 6) - 0.5) * 2;
      for (const [d, r] of big) { const c = Math.acos(Math.min(1, v.dot(d))) / r; if (c < 1.6) k += (c < 1 ? (c * c - 1) * 0.18 * r : 0) + Math.exp(-(((c - 1) / 0.25) ** 2)) * 0.04 * r; }
      P.multiplyScalar(lerp(k, 1, wTop));
      P.add(MC0);
      if (wTop > 0) {
        const inPatch = P.x > ix0 + 20 && P.x < ix1 - 20 && P.z > iz0 + 20 && P.z < iz1 - 20;
        P.y = lerp(P.y, natural(P.x, P.z) - (inPatch ? 6 : 0), wTop);
      }
      p.setXYZ(i, P.x, P.y, P.z);
    }
    // quita los triángulos que quedan del todo bajo la malla fina
    const idx = sg.index.array, keep = [];
    const inside = (i) => { const x = p.getX(i), z = p.getZ(i), yy = p.getY(i); return yy > MC0.y + MB * 0.5 && x > ix0 + 8 && x < ix1 - 8 && z > iz0 + 8 && z < iz1 - 8; };
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    sg.setIndex(keep); sg.deleteAttribute('uv'); sg.computeVertexNormals(); sg.computeBoundingSphere();
    const mesh = new THREE.Mesh(sg, rock); mesh.receiveShadow = true; mesh.frustumCulled = false; world.add(mesh); own.push(sg);
  }

  // ── Tablero ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x55575c))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0x8e8a86))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x3a3b3e)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xc8ccd0)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.6, 0.3); m.emissiveIntensity = 2.2; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed, opts = {}) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (s1 - s0) * r / rows; track.sample(s, F);
      const wv = opts.noWiden ? 1 : track.wAt(s);
      let per = 0;
      prof.forEach(([x0, h], k) => {
        const [x1, hh] = opts.prof ? opts.prof(s, x0, h, k) : [x0 * wv, h];
        pos.push(F.pos.x + F.right.x * x1 + F.up.x * hh, F.pos.y + F.right.y * x1 + F.up.y * hh, F.pos.z + F.right.z * x1 + F.up.z * hh);
        if (k) per += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);
        uv.push(opts.uPer ? per : k / (m - 1), opts.uPer ? s : s / 20);
      });
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
  parts.deck.push(sweepSeg(0, L, 3, deckProf, true));
  parts.guard.push(sweepSeg(0, L, 3, wallL, false), sweepSeg(0, L, 3, wallR, false));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  const boxAt = (s, x0, h, w, hh, d, list) => {
    track.sample(s, F);
    const x = Math.abs(x0) > 10 ? x0 * track.wAt(s) : x0;
    const bx = new THREE.BoxGeometry(w, hh, d);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx);
    return bx;
  };
  for (let s = 5; s < L; s += 24) for (const x of [-16.2, 16.2]) boxAt(s, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let s = 0; s < L; s += 14) boxAt(s, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (const sc of track.sectors) { const s = sc.s + (sc.id === 1 ? 6 : 0); for (const x of [-17.6, 17.6]) boxAt(s, x, 7.5, 0.9, 15, 0.9, parts.frame); boxAt(s, 0, 15.2, 36, 0.4, 1.2, parts.gate); }
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh);
  }

  // ── Túneles octogonales ──
  // perfil (x, h) en el marco de la pista; el perímetro (m) sirve de coordenada u para paneles y tiras de luz
  const oct = [[-TW + 6, -2.4], [TW - 6, -2.4], [TW, 3], [TW, TH - 7], [TW - 7, TH], [-TW + 7, TH], [-TW, TH - 7], [-TW, 3]];
  const octC = [...oct, oct[0]];
  let per = 0; const perAt = [0]; for (let k = 1; k < octC.length; k++) { per += Math.hypot(octC[k][0] - octC[k - 1][0], octC[k][1] - octC[k - 1][1]); perAt.push(per); }
  const strips = [perAt[2] + 0.6, perAt[4], perAt[5], perAt[8] - 0.6];   // zócalos y aristas del techo
  const uniA = { uT: uni.uT, strips }, uniC = { uT: uni.uT, strips };
  const tunA = tunnelMaterial(uniA, [1.0, 0.62, 0.28]), tunC = tunnelMaterial(uniC, [0.45, 0.82, 1.0]);
  own.push(tunA, tunC);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.8 }); own.push(metal);
  const pale = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.42, metalness: 0.35, emissive: 0x23262c }); own.push(pale);
  const warm = new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffb070, emissiveIntensity: 3.2 }); own.push(warm);
  const cyan = new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x7fdcff, emissiveIntensity: 3.2 }); own.push(cyan);
  const arch = { metal: [], pale: [], warm: [], cyan: [] };
  const tube = (s0, s1, mat) => {
    const gg = sweepSeg(s0, s1, 3, octC, false, { noWiden: true, uPer: true });
    const mesh = new THREE.Mesh(gg, mat); mesh.receiveShadow = true; mesh.castShadow = true; world.add(mesh); own.push(gg);
  };
  // cuadernas: anillo octogonal grueso con banda de luz, cada 30 m
  const rib = (s, list, lit, scale = 1, depth = 1.6) => {
    const pos = [], idx = [];
    const inner = oct.map(([x, h]) => [x * 0.94 * scale, (h - TH / 2) * 0.9 * scale + TH / 2]), outer = oct.map(([x, h]) => [x * scale * 1.01, (h - TH / 2) * scale * 1.01 + TH / 2]);
    const put = (ss, [x, h]) => { track.sample(ss, F); pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); return pos.length / 3 - 1; };
    const n = oct.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const q = [put(s, inner[k]), put(s, inner[k2]), put(s + depth, inner[k]), put(s + depth, inner[k2]), put(s, outer[k]), put(s, outer[k2]), put(s + depth, outer[k]), put(s + depth, outer[k2])];
      idx.push(q[0], q[1], q[2], q[1], q[3], q[2], q[4], q[5], q[0], q[5], q[1], q[0], q[2], q[3], q[6], q[3], q[7], q[6]);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    list.push(gg);
    if (lit) { const band = sweepSeg(s + depth * 0.35, s + depth * 0.65, depth * 0.3, inner.slice(2, 7).map(([x, h]) => [x * 0.995, (h - TH / 2) * 0.995 + TH / 2]), false, { noWiden: true }); lit.push(band); }
  };
  const ext = 14;
  const tA0 = sIn - ext, tA1 = hIn + ext, tC0 = hOut - ext, tC1 = sOut + ext;
  tube(tA0, tA1, tunA); tube(tC0, tC1, tunC);
  for (let s = tA0 + 18; s < tA1 - 10; s += 30) rib(s, arch.metal, arch.warm);
  for (let s = tC0 + 18; s < tC1 - 10; s += 30) rib(s, arch.metal, arch.cyan);
  // portales: marco grande en las cuatro bocas (dos en el cráter, dos en la caverna)
  const portal = (s, dir, lit) => {
    rib(s - (dir > 0 ? 0 : 6), arch.pale, null, 1.22, 6);
    rib(s - (dir > 0 ? -1 : 5), arch.metal, lit, 1.12, 2.2);
  };
  portal(tA0, 1, arch.warm); portal(tA1, -1, arch.warm); portal(tC0, 1, arch.cyan); portal(tC1, -1, arch.cyan);
  // fachada de las bocas del cráter: dos marcos escalonados más grandes con banda de luz
  for (const [s, lit] of [[tA0 - 2, arch.warm], [tC1 - 4, arch.cyan]]) { rib(s, arch.pale, lit, 1.55, 4); rib(s + 1.5, arch.metal, null, 1.38, 3); }

  // módulos industriales (referencia: base en la cueva): bloques con ventanas, montantes, tuberías
  const module = (cx, cy, cz, yaw, w, h, d) => {
    const m4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, cy, cz);
    const add = (list, geo, x, yy, z) => { geo.translate(x, yy, z); geo.applyMatrix4(m4); list.push(geo); };
    add(arch.pale, new THREE.BoxGeometry(w, h, d), 0, h / 2, 0);
    add(arch.metal, new THREE.BoxGeometry(w * 1.04, 1.2, d * 1.06), 0, 0.6, 0);
    add(arch.metal, new THREE.BoxGeometry(w * 1.02, 0.8, d * 1.08), 0, h * 0.62, 0);
    const nW = Math.max(1, Math.floor(w / 4.2));
    for (let k = 0; k < nW; k++) { const x = -w / 2 + (k + 0.5) * w / nW; add(rnd() < 0.7 ? arch.warm : arch.cyan, new THREE.BoxGeometry(w / nW * 0.62, 1.1, 0.2), x, h * 0.45, d / 2 + 0.05); }
    add(arch.cyan, new THREE.BoxGeometry(w * 0.9, 0.25, 0.2), 0, h * 0.82, d / 2 + 0.05);
    for (const sx of [-1, 1]) add(arch.metal, new THREE.BoxGeometry(1.2, h * 1.05, 1.4), sx * (w / 2 + 0.4), h * 0.52, d / 2 - 0.3);
    if (rnd() < 0.6) { const pc = new THREE.CylinderGeometry(0.7, 0.7, w * 1.1, 10); pc.rotateZ(Math.PI / 2); add(arch.metal, pc, 0, h + 1.2, d * 0.2); }
    if (rnd() < 0.5) add(arch.pale, new THREE.BoxGeometry(w * 0.5, h * 0.35, d * 0.7), (rnd() - 0.5) * w * 0.3, h + h * 0.175, -d * 0.1);
  };
  // junto a las bocas del cráter, a ambos lados, apoyados en la roca
  const lamps = [];
  for (const [s, dir] of [[tA0, 1], [tC1, -1]]) {
    track.sample(s, F);
    const fw = new THREE.Vector3(F.tan.x, 0, F.tan.z).normalize().multiplyScalar(dir), rt = new THREE.Vector3(F.right.x, 0, F.right.z).normalize();
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const off = 36 + k * 19 + rnd() * 4, back = -6 - k * 5 + (rnd() - 0.5) * 6;
      const p = F.pos.clone().addScaledVector(rt, side * off).addScaledVector(fw, back);
      const gy = natural(p.x, p.z), base = Math.min(gy, F.pos.y - 1);
      const h = 14 + rnd() * 16 + (3 - k) * 4;
      module(p.x, base, p.z, Math.atan2(-fw.x, -fw.z), 14 + rnd() * 6, h, 10 + rnd() * 4);
    }
    // focos sobre el portal
    for (const side of [-1, 1]) { const p = F.pos.clone().addScaledVector(rt, side * 30).addScaledVector(fw, -3); p.y += TH + 8; lamps.push(p.clone()); const lg = new THREE.BoxGeometry(2.4, 1.2, 2.4); lg.translate(p.x, p.y, p.z); arch.warm.push(lg); }
  }

  // ── Caverna: bóveda elíptica excavada (rocosa, con agujeros donde entran los túneles), suelo, módulos, focos ──
  const holes = [];
  for (const s of [hIn, hOut]) { track.sample(s, F); holes.push(new THREE.Vector4(F.pos.x, F.pos.y + TH / 2, F.pos.z, 30)); }
  const hallLamps = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2; hallLamps.push(new THREE.Vector4(hall.x + Math.cos(a) * HALL_R[0] * 0.62, Y_HALL + HALL_H * 0.8, hall.z + Math.sin(a) * HALL_R[1] * 0.62, k % 2 ? 90 : 120)); }
  hallLamps.push(new THREE.Vector4(hall.x, Y_HALL + HALL_H * 0.92, hall.z, 140), new THREE.Vector4(hall.x + 120, Y_HALL + 30, hall.z - 60, 90));
  const cave = rockMaterial(rockRT.texture, MC0, { lamps: hallLamps }); own.push(cave);
  cave.side = THREE.DoubleSide;
  const prevC = cave.onBeforeCompile;
  cave.onBeforeCompile = (sh) => {
    prevC(sh);
    sh.uniforms.uHoles = { value: holes };
    sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 uC;', 'uniform vec3 uC; uniform vec4 uHoles[2];')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n for (int i = 0; i < 2; i++) if (length(vRW - uHoles[i].xyz) < uHoles[i].w) discard;');
  };
  {
    const dg = new THREE.SphereGeometry(1, 128, 40, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = dg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const nz = vn3(v.x * 5, v.y * 5, v.z * 5), nz2 = vn3(v.x * 17 + 3, v.y * 17, v.z * 17);
      const k = 1 + 0.06 * (nz - 0.5) + 0.025 * (nz2 - 0.5);
      p.setXYZ(i, hall.x + v.x * HALL_R[0] * k, Y_HALL - 2 + v.y * HALL_H * (1 + 0.12 * (nz - 0.5)), hall.z + v.z * HALL_R[1] * k);
    }
    dg.deleteAttribute('uv'); dg.computeVertexNormals();
    const dome = new THREE.Mesh(dg, cave); dome.receiveShadow = true; world.add(dome); own.push(dg);
    const fg = new THREE.CircleGeometry(1, 96); fg.rotateX(-Math.PI / 2); fg.scale(HALL_R[0] * 1.08, 1, HALL_R[1] * 1.08); fg.translate(hall.x, Y_HALL - 1.9, hall.z);
    const floor = new THREE.Mesh(fg, cave); floor.receiveShadow = true; world.add(floor); own.push(fg);
  }
  // módulos alrededor de la pared de la caverna y en el centro de la horquilla
  {
    let placed = 0;
    for (let k = 0, tries = 0; k < 44 && tries < 400; tries++) {
      const a = rnd() * Math.PI * 2, rr = 0.82 + rnd() * 0.1;
      const x = hall.x + Math.cos(a) * HALL_R[0] * rr, z = hall.z + Math.sin(a) * HALL_R[1] * rr;
      if (clearOf(x, z, 60) < 34) continue;
      if (holes.some((hv) => Math.hypot(hv.x - x, hv.z - z) < 50)) continue;
      const yaw = Math.atan2(hall.x - x, hall.z - z) + (rnd() - 0.5) * 0.3;
      module(x, Y_HALL - 1.9, z, yaw, 14 + rnd() * 12, 16 + rnd() * 22, 10 + rnd() * 6); k++; placed++;
    }
    // focos colgados de la bóveda
    for (const l of hallLamps) { const lg = new THREE.CylinderGeometry(3.2, 4.2, 1.2, 12); lg.translate(l.x, Y_HALL + HALL_H * 0.86, l.z); arch.warm.push(lg); const c = new THREE.CylinderGeometry(0.25, 0.25, HALL_H * 0.2, 6); c.translate(l.x, Y_HALL + HALL_H * 0.96, l.z); arch.metal.push(c); }
    void placed;
  }
  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (!q.index) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, { metal, pale, warm, cyan }[k]); mesh.castShadow = k === 'metal' || k === 'pale'; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── Marte, estrellas ──
  const sun = phobosSunDir();
  const mc = centroid.clone().addScaledVector(MARS_DIR, MARS_D).setY(MARS_D * MARS_EL - MARS_R * 0.15);
  const marsRT = gpuBake(renderer, 1024, MARS_BAKE); own.push(marsRT);
  marsRT.texture.wrapS = THREE.RepeatWrapping;
  const mm = marsMaterial(mc, sun, marsRT.texture); own.push(mm);
  const mars = new THREE.Mesh(new THREE.SphereGeometry(MARS_R, 128, 96), mm); mars.position.copy(mc); mars.frustumCulled = false; world.add(mars); own.push(mars.geometry);
  {
    const n = 5200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(320000);
      pos.set([centroid.x + v.x, v.y, centroid.z + v.z], i * 3);
      const b = 0.3 + Math.pow(rnd(), 5) * 2.4, t = rnd();
      col.set(t < 0.2 ? [b * 0.8, b * 0.9, b] : t > 0.9 ? [b, b * 0.88, b * 0.74] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const stp = new THREE.Points(gg, sm); stp.frustumCulled = false; stp.renderOrder = -2; world.add(stp); own.push(gg, sm);
  }

  // ── Anillo de cohetes, a la salida de la caverna ──
  const rr = buildRaceRings(world, track, [corner.ring * L], own, { kind: 'rockets', color: [1.0, 0.45, 0.18] });

  const fx = {
    t: 0, gates: rr.gates,
    update(dt) { this.t += dt; uni.uT.value = this.t; mm.uniforms.uT.value = this.t; rr.update(dt); },
    passRings: (ships, onPass) => rr.passRings(ships, onPass),
    reset() { rr.reset(); },
  };

  // Intro: Phobos entero contra Marte, descenso sobre Stickney y la boca, y a la parrilla
  track.sample(0, F); const grid = F.pos.clone(), gridTan = F.tan.clone();
  const side = new THREE.Vector3(-MARS_DIR.z, 0, MARS_DIR.x).multiplyScalar(MX);
  const introKeys = () => [
    [0.0, MC0.clone().addScaledVector(MARS_DIR, -36000).addScaledVector(side, 15000).setY(MC0.y + 7000), MC0.clone().addScaledVector(MARS_DIR, 6000).addScaledVector(side, 2500).setY(MC0.y + 1500), 42],
    [4.2, st.clone().addScaledVector(MARS_DIR, -1500).addScaledVector(side, 600).setY(900), st.clone().setY(-120).addScaledVector(MARS_DIR, 300), 52],
    [7.4, grid.clone().addScaledVector(gridTan, -420).addScaledVector(side, 160).setY(grid.y + 120), grid.clone().addScaledVector(gridTan, 300), 56],
    [9.5, grid.clone().addScaledVector(gridTan, -180).setY(grid.y + 55), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] PHOBOS: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · interior ${sIn.toFixed(0)}–${sOut.toFixed(0)} (caverna ${hIn.toFixed(0)}–${hOut.toFixed(0)}) · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => terrain(x, z), tunnel: { s: sIn, len: sOut - sIn }, ownTunnel: true, bridges: 0, introKeys, fx, dbg: { natural, terrain, sIn, sOut, hIn, hOut } };
}
