// MIRANDA: luna de Urano. Todo sobre el terreno: la pista es un camino nivelado en el regolito, con guardarraíles
// luminosos recorridos por pulsos y balizas sueltas. Trazado inspirado en Suzuka (figura en ocho): el cruce se
// resuelve con un gran puente en arco, mirador de todo el paisaje y anillo de recuperación. La recta y la horquilla
// van al borde de Verona Rupes: un corte de varios kilómetros con Urano gigante al fondo. Las eses se encajan en
// una garganta a anchura de carrera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { buildRaceRings } from './rings.js';

// Trazado (px del plano). Salida hacia el oeste (−x): primera curva, eses, Dunlop, Degner, bajo el puente,
// horquilla, Spoon, 130R sobre el puente, chicane Casio y recta
const RAW = [[235, 592], [180, 600], [120, 609], [80, 615], [50, 612], [27, 598], [20, 578], [30, 560], [55, 550], [90, 548], [118, 546], [135, 535], [148, 515], [165, 508], [190, 508], [215, 510], [240, 503], [260, 483], [282, 468], [305, 466], [325, 478], [342, 500], [362, 512], [385, 508], [408, 492], [430, 475], [440, 450], [445, 410], [440, 375], [430, 345], [415, 322], [425, 295], [437, 270], [448, 256], [470, 262], [500, 275], [540, 290], [580, 302], [600, 320], [615, 340], [625, 348], [633, 342], [632, 330], [620, 310], [607, 285], [597, 260], [595, 235], [600, 210], [612, 185], [635, 160], [660, 140], [690, 128], [720, 121], [750, 122], [780, 127], [810, 131], [832, 125], [845, 108], [848, 80], [842, 62], [825, 51], [800, 50], [770, 56], [730, 70], [700, 87], [650, 115], [600, 157], [550, 197], [500, 237], [480, 255], [467, 285], [462, 310], [462, 350], [467, 390], [475, 425], [480, 450], [480, 472], [465, 476], [455, 483], [452, 500], [452, 520], [447, 535], [435, 548], [400, 568], [350, 578], [290, 586]];
const IDX = { first: 5, t2: 7, s3: 11, t4: 13, s5: 16, s6: 19, s7: 22, dunlop: 25, degner: 29, t9: 33, crossLo: 34, t10: 37, hairpin: 40, t12: 47, t13: 56, spoon: 59, crossHi: 69, t15: 71, casio: 78, t17: 80, t18: 82 };
const CORNERS = [[1, 'first', 'FIRST TURN'], [2, 't2', 'FIRST TURN'], [3, 's3', "'S' CURVES"], [4, 't4', "'S' CURVES"], [5, 's5', "'S' CURVES"], [6, 's6', "'S' CURVES"], [7, 's7', "'S' CURVES"], [8, 'degner', 'DEGNER'], [9, 't9', 'DEGNER'], [10, 't10', ''], [11, 'hairpin', 'HAIRPIN'], [12, 't12', ''], [13, 't13', 'SPOON'], [14, 'spoon', 'SPOON'], [15, 't15', '130R'], [16, 'casio', 'CASIO'], [17, 't17', 'CASIO'], [18, 't18', 'CASIO']];
// Borde de Verona Rupes (px): al sur de la recta, al este de la horquilla y de Spoon; el vacío queda fuera
const RIM = [[-1800, 1150], [-700, 780], [-150, 690], [-10, 656], [60, 640], [200, 612], [350, 591], [470, 575], [560, 560], [605, 522], [628, 462], [640, 402], [648, 352], [662, 300], [705, 262], [780, 228], [855, 202], [880, 130], [886, 40], [876, -60], [910, -500], [1150, -2600]];
const K = 2.5;
const FLOOR = -4200;                 // fondo del corte
const FAR = 900;                     // meseta del otro lado
const URA_DIR = new THREE.Vector3(-0.6, 0, 0.8).normalize();
const URA_D = 190000, URA_R = 70000, URA_EL = Math.tan(13 * Math.PI / 180);
// Sol detrás y a la izquierda de Urano (visto desde la pista): Urano en creciente ancho y el terreno a contraluz, con filos brillantes
export function mirandaSunDir() { const left = new THREE.Vector3(URA_DIR.z, 0, -URA_DIR.x); return URA_DIR.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.42, 0)).addScaledVector(left, 0.68).normalize(); }

const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
const fbm = (x, z, o = 4) => { let a = 0, w = 0.5; for (let i = 0; i < o; i++) { a += vn(x, z) * w; x = x * 2.03 + 1.7; z = z * 2.03 + 3.1; w *= 0.5; } return a; };
let _seed = 47;
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
  // borde suavizado y remuestreado
  const rc = new THREE.CatmullRomCurve3(RIM.map(toW), false, 'centripetal');
  const rim = rc.getSpacedPoints(Math.round(rc.getLength() / 30)).map((v) => [v.x, v.z]);
  return { S, cum, total, corner, rim };
}

// ── Horneado del regolito (GPU, una vez): baldosa periódica de 800 m, media precisión ──
const TILE = 800;
const BAKE = /* glsl */`
  varying vec2 vUv;
  float hP(vec2 n, float N){ n = mod(n, N); return fract(sin(dot(n, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h2P(vec2 n, float N){ n = mod(n, N); return fract(sin(vec2(dot(n, vec2(127.1, 311.7)), dot(n, vec2(269.5, 183.3)))) * 43758.5453); }
  float nP(vec2 p, float N){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hP(i, N), hP(i+vec2(1,0), N), f.x), mix(hP(i+vec2(0,1), N), hP(i+vec2(1,1), N), f.x), f.y); }
  float fP(vec2 p, float N){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += nP(p, N) * w; p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  float hQ(vec2 n, vec2 N){ n = mod(n, N); return fract(sin(dot(n, vec2(127.1, 311.7))) * 43758.5453); }
  float nQ(vec2 p, vec2 N){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hQ(i, N), hQ(i+vec2(1,0), N), f.x), mix(hQ(i+vec2(0,1), N), hQ(i+vec2(1,1), N), f.x), f.y); }
  float fQ(vec2 p, vec2 N){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += nQ(p, N) * w; p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  // cráteres de una escala: devuelve (altura, brillo de eyecta)
  vec2 craters(vec2 q, float N, float cellM, float prob){
    vec2 g = q * N, n = floor(g), f = fract(g); vec2 acc = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = n + vec2(float(i), float(j));
      vec2 o = h2P(c, N); float pr = hP(c + 7.3, N);
      if (pr > prob) continue;
      float r = (0.16 + 0.26 * hP(c + 3.1, N));
      float d = length(vec2(float(i), float(j)) + o - f) / r;
      if (d > 2.2) continue;
      float depth = 0.2 * r * cellM;
      float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
      float rimH = exp(-pow((d - 1.0) / 0.22, 2.0)) * 0.22;
      float ej = exp(-pow((d - 1.25) / 0.45, 2.0)) * (1.0 - smoothstep(0.0, 1.0, pr / prob)) ;
      acc += vec2((bowl + rimH) * depth, ej);
    }
    return acc;
  }
  void main(){
    vec2 q = vUv;
    vec2 c1 = craters(q, 2.0, 400.0, 0.55), c2 = craters(q, 5.0, 160.0, 0.6), c3 = craters(q, 16.0, 50.0, 0.55), c4 = craters(q, 50.0, 16.0, 0.5);
    float h = c1.x * 0.6 + c2.x * 0.8 + c3.x + c4.x;
    // surcos paralelos en bandas (como las coronas de Miranda), dos familias
    float m1 = smoothstep(0.45, 0.6, fP(q * 2.0, 2.0)), m2 = smoothstep(0.5, 0.65, fP(q * 2.0 + 5.0, 2.0));
    float w1 = fP(q * 6.0 + 1.0, 6.0) * 0.6;
    float g1 = 1.0 - pow(abs(sin(6.2831853 * (q.x * 22.0 + q.y * 9.0 + w1))), 0.6);
    float g2 = 1.0 - pow(abs(sin(6.2831853 * (q.x * -7.0 + q.y * 26.0 + w1))), 0.6);
    h += (g1 * m1 + g2 * m2 * (1.0 - m1 * 0.5)) * 1.6;
    h += (fP(q * 100.0, 100.0) - 0.5) * 0.5;
    // multifractal crestado: red casi fractal de crestas y divisorias
    float rg = 0.0, amp = 0.5, wgt = 1.0; vec2 rq = q * 6.0; float RN = 6.0;
    for (int i = 0; i < 5; i++) { float r = 1.0 - abs(2.0 * nP(rq, RN) - 1.0); r = r * r * wgt; rg += r * amp; wgt = clamp(r * 1.6, 0.0, 1.0); rq *= 2.0; RN *= 2.0; amp *= 0.5; }
    h += rg * 3.2;
    float alb = 0.5 + 0.35 * (fP(q * 8.0 + 3.0, 8.0) - 0.5) + (c2.y + c3.y) * 0.2 + c1.y * 0.15 - (g1 * m1 + g2 * m2) * 0.08 + (rg - 0.35) * 0.3;
    // pared (canal A): estrías verticales irregulares, fracturas marcadas y repisas horizontales
    vec2 wq = q + vec2(fQ(q * vec2(4.0, 2.0), vec2(4.0, 2.0)) * 0.025, 0.0);
    vec2 fq = wq * vec2(40.0, 1.0);
    float flutes = nQ(fq, vec2(40.0, 1.0)) * 0.55 + nQ(fq * 2.0 + 1.3, vec2(80.0, 2.0)) * 0.3 + nQ(fq * vec2(4.0, 2.0) + 2.1, vec2(160.0, 2.0)) * 0.15;
    float fr = 1.0 - abs(2.0 * nQ(wq * vec2(16.0, 1.0) + 3.0, vec2(16.0, 1.0)) - 1.0);
    float ledge = smoothstep(0.55, 0.75, fQ(vec2(q.x * 3.0, q.y * 48.0) + 7.0, vec2(3.0, 48.0)));
    float wall = flutes * 0.6 + pow(fr, 10.0) * 0.4 - ledge * 0.15;
    gl_FragColor = vec4(h, alb, m1 + m2, wall);
  }`;

function gpuBake(renderer, size, frag) {
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, type: THREE.HalfFloatType, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.anisotropy = 8;
  const mat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)); renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  return rt;
}

// Roca y regolito: arriba cráteres y surcos (relieve por la normal desde la textura horneada); en las paredes,
// estrías verticales, estratos y escarcha clara cerca del borde
function rockMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRock = { value: tex }; sh.uniforms.uSunR = { value: mirandaSunDir() };
    const hdr = `varying vec3 vRW; varying vec3 vRN; uniform sampler2D uRock; uniform vec3 uSunR;
      float rh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(rh(i), rh(i+vec2(1,0)), f.x), mix(rh(i+vec2(0,1)), rh(i+vec2(1,1)), f.x), f.y); }
      float rf(vec2 p){ return rn(p) * 0.5 + rn(p * 2.03 + 1.7) * 0.28 + rn(p * 4.1 + 3.3) * 0.14 + rn(p * 8.3 + 5.1) * 0.08; }`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${hdr}`)
      .replace('void main() {', 'void main() {\n  vec3 rNw = vec3(0.0, 1.0, 0.0); float rSteep = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vRW; vec3 n = normalize(vRN);
          float camD = length(cameraPosition - p);
          rSteep = 1.0 - smoothstep(0.38, 0.78, n.y);
          // suelo: textura horneada (altura, albedo, surcos) + detalle cercano
          vec3 top = vec3(0.5), face = vec3(0.5), bump = vec3(0.0); float fd = 0.0;
          vec2 hn = normalize(n.xz + 1e-4);
          vec3 tang = normalize(vec3(-hn.y, 0.0, hn.x));
          // derivadas fuera de las ramas (las lecturas con mipmap dentro usan textureGrad)
          vec2 dPx = dFdx(p.xz), dPy = dFdy(p.xz);
          float a = dot(p.xz, vec2(-hn.y, hn.x));
          vec2 wuv = vec2((a + p.y * 0.3) / 520.0, p.y / 2100.0);
          vec2 dWx = dFdx(wuv), dWy = dFdy(wuv);
          if (rSteep < 0.99) {
          vec2 uv = p.xz / ${TILE.toFixed(1)};
          float e = 1.2 / ${TILE.toFixed(1)};
          vec2 gx = dPx / ${TILE.toFixed(1)}, gy = dPy / ${TILE.toFixed(1)};
          vec4 T = textureGrad(uRock, uv, gx, gy);
          float hx = textureGrad(uRock, uv + vec2(e, 0.0), gx, gy).r, hz = textureGrad(uRock, uv + vec2(0.0, e), gx, gy).r;
          float near = 1.0 - smoothstep(40.0, 220.0, camD);
          vec2 uv2 = mat2(0.8, 0.6, -0.6, 0.8) * p.xz / 113.0;
          vec2 g2x = mat2(0.8, 0.6, -0.6, 0.8) * dPx / 113.0, g2y = mat2(0.8, 0.6, -0.6, 0.8) * dPy / 113.0;
          vec4 D = vec4(0.0, 0.5, 0.0, 1.0); float dx2 = 0.0, dz2 = 0.0;
          if (near > 0.0) { D = textureGrad(uRock, uv2, g2x, g2y); dx2 = textureGrad(uRock, uv2 + vec2(e * 7.0, 0.0), g2x, g2y).r - D.r; dz2 = textureGrad(uRock, uv2 + vec2(0.0, e * 7.0), g2x, g2y).r - D.r; }
          bump = vec3(-(hx - T.r) / 1.2 * 0.55 - dx2 / 0.17 * 0.15 * near, 0.0, -(hz - T.r) / 1.2 * 0.55 - dz2 / 0.17 * 0.15 * near);
          top = mix(vec3(0.26, 0.31, 0.34), vec3(0.58, 0.67, 0.71), clamp(T.g * 0.8 + 0.1, 0.0, 1.0)) * (0.9 + 0.2 * D.g * near);
          }
          if (rSteep > 0.01) {
          // paredes: patrón horneado (canal A) en coordenadas de pared (a lo largo, altura)
          float W = textureGrad(uRock, wuv, dWx, dWy).a, Wd = textureGrad(uRock, wuv + vec2(1.6 / 520.0, 0.0), dWx, dWy).a;
          float nearW = 1.0 - smoothstep(60.0, 400.0, camD);
          float W2 = nearW > 0.0 ? textureGrad(uRock, wuv * 5.3 + 0.37, dWx * 5.3, dWy * 5.3).a : 0.5;
          float Wg = textureGrad(uRock, wuv * 0.37 + 0.11, dWx * 0.37, dWy * 0.37).g;
          face = mix(vec3(0.13, 0.16, 0.18), vec3(0.62, 0.76, 0.82), smoothstep(0.25, 0.85, W)) * (0.85 + 0.3 * (W2 - 0.5) * nearW) * (0.8 + 0.35 * Wg);
          float frost = smoothstep(0.62, 0.78, W * 0.6 + Wg * 0.5) * (0.35 + 0.65 * smoothstep(-1200.0, 0.0, p.y));
          face = mix(face, vec3(0.82, 0.92, 0.96), frost * 0.55);
          face *= mix(1.0, 0.7, smoothstep(0.6, 0.8, Wg) * (1.0 - frost));
          fd = (Wd - W) * 2.4;
          }
          diffuseColor.rgb = mix(top, face, rSteep);
          rNw = normalize(n + bump * (1.0 - rSteep) + tang * fd * rSteep);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(rNw, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 Vw = normalize(cameraPosition - vRW); float fr = pow(1.0 - max(dot(rNw, Vw), 0.0), 3.0);
          float lit = max(dot(rNw, uSunR), 0.0);
          totalEmissiveRadiance += vec3(0.42, 0.72, 0.82) * fr * lit * 0.55 * diffuseColor.rgb * 2.0; }`);
  };
  m.customProgramCacheKey = () => 'mirRock6';
  return m;
}

// Camino: regolito compactado, líneas de borde luminosas, discontinua central y cuadros de salida
function roadMaterial(L) {
  const m = new THREE.MeshStandardMaterial({ color: 0x4a4b4e, roughness: 0.8, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRd; varying vec3 vRdW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRd = uv; vRdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vRd; varying vec3 vRdW;
      float qh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float qn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(qh(i), qh(i+vec2(1,0)), f.x), mix(qh(i+vec2(0,1)), qh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('void main() {', 'void main() {\n  float rdE = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vRd.x, s = vRd.y;
          float grain = qn(vRdW.xz * 0.6) * 0.6 + qn(vRdW.xz * 2.7) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.3 * grain;
          diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.35, 0.0, abs(u - 0.5) - 0.12) * qn(vec2(s * 0.05, u * 3.0));   // huella central
          rdE = (1.0 - smoothstep(0.02, 0.028, abs(u - 0.04))) + (1.0 - smoothstep(0.02, 0.028, abs(u - 0.96)));
          float dash = (1.0 - smoothstep(0.006, 0.01, abs(u - 0.5))) * step(fract(s / 18.0), 0.42);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.9, 0.95), dash * 0.7 + rdE * 0.6);
          float dS = min(s, ${L.toFixed(1)} - s);
          float chk = mod(floor(s * 0.8) + floor(u * 32.0), 2.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.04), vec3(0.88), chk), 1.0 - smoothstep(2.4, 2.5, dS));
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.35, 0.8, 1.0) * rdE * 0.9;');
  };
  m.customProgramCacheKey = () => 'mirRoad1';
  return m;
}

// Guardarraíl luminoso: brillo tenue y pulsos que corren en el sentido de la carrera; intermitencia en las curvas
function railMaterial(uni) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: uni.uT },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aK; varying vec2 vUv; varying float vK;
      void main(){ vUv = uv; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; varying vec2 vUv; varying float vK;
      void main(){
        #include <logdepthbuf_fragment>
        float s = vUv.y;
        float ph = fract((s - uT * 85.0) / 150.0) * 150.0;
        float pulse = exp(-pow((ph - 75.0) / 5.0, 2.0));
        float blink = vK * step(0.5, fract(uT * 1.6 + s * 0.004));
        vec3 base = mix(vec3(0.3, 0.75, 1.0), vec3(1.0, 0.62, 0.22), vK);
        vec3 c = base * (0.55 + 3.2 * pulse + 1.2 * blink);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Urano: azul verdoso pálido, bandas apenas visibles, casquete polar más claro; anillos finos y oscuros
function uranusMaterial(center, sun, axis) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sun }, uA: { value: axis } },
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
      uniform vec3 uC, uSun, uA; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        float lat = asin(clamp(dot(n, normalize(uA)), -1.0, 1.0));
        vec3 col = mix(vec3(0.6, 0.82, 0.86), vec3(0.7, 0.88, 0.9), 0.5 + 0.5 * sin(lat * 9.0));
        col = mix(col, vec3(0.78, 0.9, 0.9), smoothstep(0.7, 1.2, lat) * 0.6);
        col *= 0.96 + 0.04 * sin(lat * 31.0);
        float lam = dot(n, normalize(uSun));
        float day = smoothstep(-0.1, 0.3, lam);
        float limb = pow(max(0.0, dot(n, V)), 0.45);
        vec3 c = col * (0.006 + 1.7 * day * (0.2 + 0.8 * max(lam, 0.0))) * (0.6 + 0.4 * limb);
        c += vec3(0.03, 0.022, 0.03) * (1.0 - day);                                   // lado nocturno apenas violáceo
        c += vec3(0.5, 0.8, 0.85) * pow(1.0 - max(0.0, dot(n, V)), 3.0) * 0.5 * smoothstep(-0.35, 0.2, lam);   // halo del limbo a contraluz
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
function ringsMaterial() {
  return new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vP;
      float ring(float r, float c, float w){ return exp(-pow((r - c) / w, 2.0)); }
      void main(){
        #include <logdepthbuf_fragment>
        float r = length(vP.xy);
        float a = ring(r, 2.0, 0.006) * 0.9 + ring(r, 1.92, 0.003) * 0.35 + ring(r, 1.86, 0.003) * 0.3 + ring(r, 1.72, 0.004) * 0.25 + ring(r, 1.6, 0.012) * 0.08;
        gl_FragColor = vec4(vec3(0.55, 0.6, 0.62) * a, a * 0.85);
      }`,
  });
}

const lathe = (pts, segs = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segs);

export function buildMiranda(def, { world, own, renderer }) {
  const T0 = performance.now();
  _seed = 47;
  const { S, cum, total, corner, rim } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);

  // ── Borde: distancia con signo (+ hacia el vacío) y punto más cercano ──
  let sgn = 1;
  const rimQ = (x, z) => {
    let bd = Infinity, bx = 0, bz = 0, side = 0;
    for (let i = 0; i < rim.length - 1; i++) {
      const [ax, az] = rim[i], [cx2, cz2] = rim[i + 1], vx = cx2 - ax, vz = cz2 - az, l2 = vx * vx + vz * vz;
      const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      const px = ax + vx * u, pz = az + vz * u, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; bx = px; bz = pz; side = vx * (z - az) - vz * (x - ax); }
    }
    return { sd: Math.sign(side || 1) * sgn * Math.sqrt(bd), x: bx, z: bz };
  };
  if (rimQ(centroid.x, centroid.z).sd > 0) sgn = -1;
  // el vacío está acotado por una gran pared lejana (círculo); fuera de él, la meseta del otro lado
  let rcx = 0, rcz = 0, rn = 0; for (const [x, z] of rim) if (Math.hypot(x - centroid.x, z - centroid.z) < 3500) { rcx += x; rcz += z; rn++; }
  rcx /= rn; rcz /= rn;
  const outDir = new THREE.Vector2(rcx - centroid.x, rcz - centroid.z).normalize();
  const CF = { x: rcx + outDir.x * 4600, z: rcz + outDir.y * 4600 }, RF = 7600;

  // ── Terreno natural: ondulación, surcos geométricos, cráteres, garganta alzada alrededor de las eses ──
  const craters = [];
  for (let k = 0, tries = 0; k < 34 && tries < 400; tries++) {
    const a = rnd() * Math.PI * 2, rr = 300 + Math.pow(rnd(), 0.8) * 3800, R = 40 + Math.pow(rnd(), 2.2) * 520;
    const x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    craters.push({ x, z, R }); k++;
  }
  const sCurve = []; for (let i = 0; i < N; i++) { const f = cum[i] / total; if (f > corner.s3 - 0.008 && f < corner.s7 + 0.006) sCurve.push([S[i].x, S[i].z]); }
  const gorge = (x, z) => { let d = Infinity; for (const [px, pz] of sCurve) d = Math.min(d, (px - x) ** 2 + (pz - z) ** 2); d = Math.sqrt(d); return 62 * sstep(170, 55, d); };
  const natural = (x, z) => {
    let y = 14 * (fbm(x / 900, z / 900, 3) - 0.5) + 3 * (vn(x / 140, z / 140) - 0.5);
    const band = sstep(0.55, 0.7, vn(x / 1400 + 3, z / 1400));
    y += band * 4.5 * Math.pow(Math.abs(Math.sin((x * 0.6 + z * 0.8) / 38 + fbm(x / 400, z / 400, 2) * 3)), 3);
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.R; if (d > 2.2) continue;
      y += (d < 1 ? (d * d - 1) * 0.2 * c.R : 0) + Math.exp(-(((d - 1) / 0.25) ** 2)) * 0.05 * c.R;
    }
    return y;
  };
  const gorgeFn = (x, z) => (Math.abs(x - S[0].x) < 3000 ? gorge(x, z) : 0);

  // ── Cotas de la pista ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  const sMid = (corner.s3 + corner.s7) / 2;
  let y = S.map((_, i) => {
    const f = cum[i] / total;
    return 2 - 7 * g(f, corner.first, 180) - 34 * g(f, sMid, 330) + 10 * g(f, corner.dunlop, 160) + 6 * g(f, corner.degner, 160)
      - 10 * g(f, corner.crossLo, 110) - 4 * g(f, corner.hairpin, 150) + 16 * g(f, corner.t12, 190) + 9 * g(f, corner.spoon, 200)
      + 50 * g(f, corner.crossHi, 210) - 4 * g(f, corner.casio, 160);
  });
  for (let pass = 0; pass < 3; pass++) y = y.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += y[(i + k + N) % N]; return a / 7; });
  // la pista va sobre el terreno: se suma la cota natural de su sitio (suavizada)
  let base = S.map((p) => natural(p.x, p.z));
  for (let pass = 0; pass < 6; pass++) base = base.map((_, i) => { let a = 0; for (let k = -6; k <= 6; k++) a += base[(i + k + N) % N]; return a / 13; });
  y = y.map((v, i) => v + base[i]);

  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const win = (f, a, b, e) => sstep(a - e, a, f) * (1 - sstep(b, b + e, f));
  const narrow = (f) => 1 - 0.38 * win(f, corner.s3, corner.s7, 0.012) - 0.22 * win(f, corner.hairpin - 0.006, corner.hairpin + 0.006, 0.01);
  const track = new Track(null, {
    points: pts, inSectorOrder: false, sectors: [0, 0.17, 0.33, 0.5, 0.67, 0.84],
    bank: (f, k) => THREE.MathUtils.clamp(k * 40, -0.22, 0.22), narrow,
  });
  const F = track.frame();
  const L = track.length;

  // ── Muestras de pista (cada 4 m) para nivelar el terreno, con índice espacial ──
  const smp = [];
  for (let s = 0; s < L; s += 4) {
    track.sample(s, F);
    const rh = Math.hypot(F.right.x, F.right.z);
    const nat = natural(F.pos.x, F.pos.z) + gorgeFn(F.pos.x, F.pos.z);
    const th = Math.hypot(F.tan.x, F.tan.z);
    smp.push({ s, x: F.pos.x, z: F.pos.z, y: F.pos.y, rx: F.right.x / rh, rz: F.right.z / rh, slope: F.right.y / rh, tx: F.tan.x / th, tz: F.tan.z / th, grade: F.tan.y / th, hw: 17.6 * track.wAt(s), bridge: F.pos.y - nat > 7 && Math.abs(track.delta(s, corner.crossHi * L)) < 330, narrow: track.wAt(s) < 0.9 });
  }
  const CELL = 40, hash = new Map();
  smp.forEach((q, i) => { const k = `${Math.floor(q.x / CELL)},${Math.floor(q.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const nearSamples = (x, z, r) => {
    const out = [], c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL), d0 = Math.floor((z - r) / CELL), d1 = Math.floor((z + r) / CELL);
    for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) { const l = hash.get(`${a},${b}`); if (l) for (const i of l) out.push(smp[i]); }
    return out;
  };
  const clearOf = (x, z, r = 80) => { let d = Infinity; for (const q of nearSamples(x, z, r)) d = Math.min(d, Math.hypot(q.x - x, q.z - z)); return d; };
  // terreno nivelado: dentro de la anchura, cota del camino (con su peralte); fuera, talud hacia la cota natural
  const graded = (x, z, nat) => {
    let best = 0, ty = nat;
    for (const q of nearSamples(x, z, 70)) {
      if (q.bridge) continue;
      const dx = x - q.x, dz = z - q.z, lat = dx * q.rx + dz * q.rz, d = Math.abs(lat), along = Math.abs(dx * q.rz - dz * q.rx);
      if (along > 4.5) continue;
      const bank = q.narrow ? 9 : 34, sh = q.narrow ? 8 : 4;          // arcén plano: la malla de 7 m no invade el camino
      const w = d < q.hw + sh ? 1 : sstep(q.hw + sh + bank, q.hw + sh, d);
      if (w > best) { best = w; ty = q.y + lat * q.slope + (dx * q.tx + dz * q.tz) * q.grade - 0.7; }
    }
    return best > 0 ? lerp(nat, ty, best) : nat;
  };
  const plateauY = (x, z) => graded(x, z, natural(x, z) + gorgeFn(x, z));

  // ── Altura final con el corte: se pegan al borde los vértices de la celda vecina (pared vertical) ──
  const heightAt = (x, z, cell) => {
    const rq = rimQ(x, z), dF = Math.hypot(x - CF.x, z - CF.z);
    if (rq.sd <= 0) {
      if (rq.sd > -0.75 * cell) return [rq.x, plateauY(rq.x - 0.01, rq.z - 0.01), rq.z];
      return [x, plateauY(x, z), z];
    }
    // lado del vacío
    if (dF < RF) {
      if (rq.sd < cell) return [rq.x, FLOOR, rq.z];
      if (dF > RF - cell) { const k = RF / dF; return [CF.x + (x - CF.x) * k, FLOOR, CF.z + (z - CF.z) * k]; }
      return [x, FLOOR + 120 * (fbm(x / 1500, z / 1500, 3) - 0.5) + 300 * sstep(RF * 0.75, RF, dF), z];
    }
    if (dF < RF + cell) { const k = RF / dF; return [CF.x + (x - CF.x) * k, FAR, CF.z + (z - CF.z) * k]; }
    if (rq.sd < cell) return [rq.x, FAR, rq.z];
    return [x, FAR + 80 * (fbm(x / 2500, z / 2500, 3) - 0.5), z];
  };

  const uni = { uT: { value: 0 } };
  const rockRT = gpuBake(renderer, 1024, BAKE); own.push(rockRT);
  const rock = rockMaterial(rockRT.texture); own.push(rock);

  // malla fina alrededor de la pista (losetas con normales compartidas)
  let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity; for (const q of smp) { ix0 = Math.min(ix0, q.x); ix1 = Math.max(ix1, q.x); iz0 = Math.min(iz0, q.z); iz1 = Math.max(iz1, q.z); }
  ix0 -= 650; ix1 += 650; iz0 -= 650; iz1 += 650;
  const tileMesh = (pos, nx, nz, mat) => {
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
      const mesh = new THREE.Mesh(gt, mat); mesh.receiveShadow = true; mesh.castShadow = false; world.add(mesh); own.push(gt);
    }
  };
  {
    const RES = 7, nx = Math.ceil((ix1 - ix0) / RES), nz = Math.ceil((iz1 - iz0) / RES);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const o = (j * (nx + 1) + i) * 3, v = heightAt(ix0 + i * RES, iz0 + j * RES, RES); pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2]; }
    tileMesh(pos, nx, nz, rock);
  }
  // llanura exterior hasta el horizonte (rejilla de paso creciente, hueco donde está la malla fina)
  {
    const axis = (a0, a1) => { const v = []; for (let x = a0, st = 30; x > -220000; st *= 1.12) { v.unshift(x); x -= st; } v.unshift(-220000); for (let x = a0 + 90; x < a1; x += 90) v.push(x); for (let x = a1, st = 30; x < 220000; st *= 1.12) { v.push(x); x += st; } v.push(220000); return v; };
    const X = axis(ix0, ix1), Z = axis(iz0, iz1), nx = X.length, nz = Z.length;
    const pos = new Float32Array(nx * nz * 3), idx = [];
    const step = (arr, i) => Math.max(arr[Math.min(arr.length - 1, i + 1)] - arr[i], arr[i] - arr[Math.max(0, i - 1)]);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const v = heightAt(X[i], Z[j], Math.max(step(X, i), step(Z, j)) * 1.05), o = (j * nx + i) * 3;
      pos[o] = v[0]; pos[o + 1] = v[1] - 0.3; pos[o + 2] = v[2];
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      if (cx > ix0 + 6 && cx < ix1 - 6 && cz > iz0 + 6 && cz < iz1 - 6) continue;
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, rock); mesh.receiveShadow = true; mesh.frustumCulled = false; world.add(mesh); own.push(gg);
  }

  // ── Paredes: el acantilado de Verona Rupes (cinta desplazada hacia el vacío) y la pared lejana ──
  const ribbon = (line, outward, yTop, yBot, rows, dispFn) => {
    const pos = [], idx = [], m = rows.length;
    line.forEach(([x, z, nxo, nzo, top], c) => {
      rows.forEach((t, r) => {
        const yy = lerp(top ?? yTop, yBot, t), o = dispFn(c, t, x, z, yy);
        pos.push(x + nxo * o, yy, z + nzo * o);
      });
    });
    // sentido de los triángulos: la cara visible mira hacia donde se desplaza la pared
    const [x0, z0, nx0, nz0] = line[0], [x1, z1] = line[1];
    const flip = (-(z1 - z0)) * nx0 + (x1 - x0) * nz0 < 0;
    for (let c = 0; c < line.length - 1; c++) for (let r = 0; r < m - 1; r++) { const a = c * m + r, b = a + 1, cc = a + m, d = cc + 1; if (!flip) idx.push(a, b, cc, b, d, cc); else idx.push(a, cc, b, b, cc, d); }
    void outward;
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); gg.computeBoundingSphere();
    return gg;
  };
  const rowsT = [0, 0.002, 0.005, 0.01, 0.018, 0.03, 0.045, 0.065, 0.09, 0.12, 0.16, 0.21, 0.27, 0.34, 0.42, 0.51, 0.6, 0.7, 0.8, 0.88, 0.94, 0.98, 1];
  {
    // borde dentro del círculo del vacío, muestreado fino cerca de la pista y más ancho lejos
    const line = [];
    let acc = 1e9;
    for (let i = 0; i < rim.length - 1; i++) {
      const [ax, az] = rim[i], [bx, bz] = rim[i + 1];
      const segL = Math.hypot(bx - ax, bz - az), nx0 = (bz - az) / segL * -sgn, nz0 = -(bx - ax) / segL * -sgn;
      for (let u = 0; u < segL; u += 4) {
        const x = ax + (bx - ax) * u / segL, z = az + (bz - az) * u / segL;
        if (Math.hypot(x - CF.x, z - CF.z) > RF + 40) continue;
        const dc = Math.hypot(x - centroid.x, z - centroid.z), spacing = dc < 2500 ? 8 : dc < 5000 ? 24 : 60;
        acc += 4; if (acc < spacing) continue; acc = 0;
        line.push([x, z, nx0, nz0, plateauY(x - nx0 * 0.5, z - nz0 * 0.5)]);
      }
    }
    // normal hacia el vacío comprobada con la distancia con signo
    if (line.length) { const [x, z, a, b] = line[Math.floor(line.length / 2)]; if (rimQ(x + a * 30, z + b * 30).sd < 0) line.forEach((l) => { l[2] *= -1; l[3] *= -1; }); }
    let uAcc = 0;
    const us = line.map((l, i) => (i ? (uAcc += Math.hypot(l[0] - line[i - 1][0], l[1] - line[i - 1][1])) : 0));
    const disp = (c, t, x, z, yy) => {
      const u = us[c], d = -yy;
      const mass = 110 * Math.pow(fbm(u / 340, d / 1400, 3), 1.6);                              // grandes contrafuertes
      const cols = 45 * Math.pow(1 - Math.abs(2 * fbm(u / 80 + d / 900, d / 4000 + 3.3, 3) - 1), 3);   // inclinadas, como las estrías   // columnas y fracturas irregulares
      const ledge = 10 * sstep(0.58, 0.7, fbm(u / 900, d / 120, 2));                        // repisas
      const scree = 900 * Math.pow(Math.max(0, (t - 0.72) / 0.28), 1.7) * (0.6 + 0.6 * fbm(u / 700, 5, 2));
      return 1.5 + (mass + cols + ledge) * sstep(0, 0.008, t) * (1 + 2.5 * t) + scree;
    };
    const gg = ribbon(line, true, 0, FLOOR, rowsT, disp);
    const mesh = new THREE.Mesh(gg, rock); mesh.castShadow = false; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }
  {
    // pared lejana: arco del círculo que queda del lado del vacío, de cara a la pista
    const line = [];
    for (let a = 0; a < Math.PI * 2; a += 50 / RF) {
      const x = CF.x + Math.cos(a) * RF, z = CF.z + Math.sin(a) * RF;
      if (rimQ(x, z).sd < 60) continue;
      line.push([x, z, -Math.cos(a), -Math.sin(a), FAR]);
    }
    const disp = (c, t) => 4 + 70 * Math.pow(fbm(c / 7, t * 5, 3), 1.5) * (1 + 2 * t) + 40 * Math.pow(1 - Math.abs(2 * fbm(c / 2.5, t * 2, 2) - 1), 3) + 1500 * Math.pow(Math.max(0, (t - 0.7) / 0.3), 1.8);
    const gg = ribbon(line, true, FAR, FLOOR, rowsT, disp);
    const mesh = new THREE.Mesh(gg, rock); mesh.receiveShadow = true; mesh.frustumCulled = false; world.add(mesh); own.push(gg);
  }

  // ── Camino, guardarraíles luminosos, postes ──
  const sweepSeg = (s0, s1, step, prof, closed, vScale = 1, attrK = null) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [], kk = [];
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (s1 - s0) * r / rows; track.sample(s, F);
      const wv = track.wAt(s), kv = attrK ? attrK(s) : 0;
      prof.forEach(([x0, h], k) => { const x = x0 * wv; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), s / vScale); kk.push(kv); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (attrK) gg.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1));
    gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  const road = roadMaterial(L); own.push(road);
  {
    const gg = sweepSeg(0, L, 2, [[17.6, -0.05], [16.8, 0.02], [-16.8, 0.02], [-17.6, -0.05]], false, 1);
    const uvA = gg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setX(i, [1, 0.977, 0.023, 0][i % 4]);
    const mesh = new THREE.Mesh(gg, road); mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }
  const railM = railMaterial(uni); own.push(railM);
  const kSharp = (s) => sstep(0.006, 0.012, Math.max(...[0, 30, 60, 90].map((d) => Math.abs(track.kappaAt(s + d)))));
  {
    const list = [];
    for (const side of [-1, 1]) {
      const x0 = side * 16.6, prof = [[x0, 0.78], [x0, 1.0], [x0 + side * 0.18, 1.0], [x0 + side * 0.18, 0.78]];
      list.push(sweepSeg(0, L, 2, prof, true, 1, kSharp));
    }
    const gg = mergeGeometries(list, false); list.forEach((q) => q.dispose());
    const mesh = new THREE.Mesh(gg, railM); world.add(mesh); own.push(gg);
  }
  const metal = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7 }); own.push(metal);
  const pale = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.6, metalness: 0.2 }); own.push(pale);
  const lampM = new THREE.MeshStandardMaterial({ color: 0x303438, emissive: 0xfff2dc, emissiveIntensity: 4 }); own.push(lampM);
  const cyanM = new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x5fe0ff, emissiveIntensity: 3 }); own.push(cyanM);
  const parts = { metal: [], pale: [], lamp: [], cyan: [] };
  const atTrack = (s, x, h, geo, list, yaw = 0) => {
    track.sample(s, F);
    const wx = x * track.wAt(s);
    if (yaw) geo.rotateY(yaw);
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    geo.translate(F.pos.x + F.right.x * wx + F.up.x * h, F.pos.y + F.right.y * wx + F.up.y * h, F.pos.z + F.right.z * wx + F.up.z * h);
    list.push(geo);
  };
  for (let s = 0; s < L; s += 8) for (const side of [-1, 1]) atTrack(s, side * 16.7, 0.45, new THREE.BoxGeometry(0.22, 1.0, 0.22), parts.metal);
  // balizas estáticas: postes con luz a ambos lados, alternos
  const lamps = [];
  for (let s = 20, k = 0; s < L; s += 64, k++) {
    const side = k % 2 ? 1 : -1;
    track.sample(s, F);
    const x = side * 19.5 * track.wAt(s);
    const px = F.pos.x + F.right.x * x, pz = F.pos.z + F.right.z * x;
    if (rimQ(px, pz).sd > -2) continue;
    atTrack(s, side * 19.5, 2.2, new THREE.CylinderGeometry(0.12, 0.18, 4.4, 6), parts.metal);
    atTrack(s, side * 19.5, 4.5, new THREE.BoxGeometry(0.6, 0.3, 0.6), parts.lamp);
    lamps.push(new THREE.Vector3(px, F.pos.y + F.right.y * x + 4.6, pz));
  }

  // ── Carteles de curva numerados (fuera de la curva, junto a la cuerda) ──
  {
    const C = document.createElement('canvas'); C.width = 2048; C.height = 1024; const cx = C.getContext('2d');
    CORNERS.forEach(([n, , name], i) => {
      const u = (i % 6) * 340, v = Math.floor(i / 6) * 340;
      cx.fillStyle = '#e9ecef'; cx.fillRect(u + 6, v + 6, 328, 328);
      cx.fillStyle = '#16191c'; cx.fillRect(u + 6, v + 6, 328, 30); cx.fillRect(u + 6, v + 304, 328, 30);
      cx.fillStyle = '#c4332a'; cx.beginPath(); cx.arc(u + 170, v + 160, 104, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#ffffff'; cx.font = 'bold 150px "Space Mono", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(n), u + 170, v + 166);
      cx.fillStyle = '#e9ecef'; cx.font = 'bold 22px "Space Mono", monospace'; cx.fillText(name, u + 170, v + 320);
    });
    const tex = new THREE.CanvasTexture(C); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; own.push(tex);
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }); own.push(bm);
    const boards = [];
    CORNERS.forEach(([, key], i) => {
      const s = track.wrap(corner[key] * L - 70); track.sample(s, F);
      const out = -Math.sign(track.kappaAt(s + 70) || 1);
      const off = out * (21 + 3) * track.wAt(s);
      const px = F.pos.x + F.right.x * off, pz = F.pos.z + F.right.z * off;
      if (rimQ(px, pz).sd > -4) return;
      const gq = new THREE.PlaneGeometry(6, 6);
      const uvA = gq.attributes.uv, u0 = (i % 6) * 340 / 2048, v0 = 1 - (Math.floor(i / 6) * 340 + 340) / 1024;
      for (let k = 0; k < uvA.count; k++) uvA.setXY(k, u0 + uvA.getX(k) * 340 / 2048, v0 + uvA.getY(k) * 340 / 1024);
      gq.rotateY(Math.PI);                                       // de cara a quien llega
      atTrack(s, out * 24, 5.2, gq, boards);
      atTrack(s, out * 24 - 2.4, 2.2, new THREE.BoxGeometry(0.25, 4.4, 0.25), parts.metal);
      atTrack(s, out * 24 + 2.4, 2.2, new THREE.BoxGeometry(0.25, 4.4, 0.25), parts.metal);
    });
    if (boards.length) { const gg = mergeGeometries(boards, false); const mesh = new THREE.Mesh(gg, bm); mesh.castShadow = true; world.add(mesh); own.push(gg); }
  }

  // ── Puente en arco del cruce: tablero con viga cajón, arco bajo el tablero sobre la pista inferior, pilas ──
  const bridgeS = smp.filter((q) => q.bridge).map((q) => q.s);
  const sHi = corner.crossHi * L;
  if (bridgeS.length) {
    let b0 = sHi, b1 = sHi;
    while (smp[Math.floor(track.wrap(b0 - 4) / 4)]?.bridge) b0 -= 4;
    while (smp[Math.floor(track.wrap(b1 + 4) / 4) % smp.length]?.bridge) b1 += 4;
    b0 -= 10; b1 += 10;
    parts.pale.push(sweepSeg(b0, b1, 3, [[-17.2, -0.3], [17.2, -0.3], [12, -5.5], [-12, -5.5]], true));
    parts.cyan.push(sweepSeg(b0, b1, 3, [[-12.6, -4.6], [-12.0, -5.2]], false), sweepSeg(b0, b1, 3, [[12.0, -5.2], [12.6, -4.6]], false));
    const lower = smp.filter((q) => !q.bridge);
    const distLower = (x, z) => { let d = Infinity; for (const q of nearSamples(x, z, 60)) if (!q.bridge) d = Math.min(d, Math.hypot(q.x - x, q.z - z)); return d; };
    void lower;
    // arco: dos costillas que nacen del suelo a ±85 m del cruce y tocan el tablero en el centro
    const A0 = sHi - 85, A1 = sHi + 85;
    for (const side of [-1, 1]) {
      const ptsA = [];
      for (let k = 0; k <= 40; k++) {
        const u = k / 40, s = lerp(A0, A1, u); track.sample(s, F);
        const x = side * 10, px = F.pos.x + F.right.x * x, pz = F.pos.z + F.right.z * x;
        const gy = natural(px, pz), top = F.pos.y - 6;
        const yy = gy + (top - gy) * (1 - Math.pow(2 * u - 1, 2));
        ptsA.push(new THREE.Vector3(px, yy, pz));
      }
      const cv = new THREE.CatmullRomCurve3(ptsA);
      parts.pale.push(new THREE.TubeGeometry(cv, 80, 2.0, 10, false));
      const lit = new THREE.CatmullRomCurve3(ptsA.map((p) => p.clone().add(new THREE.Vector3(0, -1.9, 0))));
      parts.cyan.push(new THREE.TubeGeometry(lit, 80, 0.25, 6, false));
      // montantes del arco al tablero
      for (let k = 2; k < 40; k += 3) {
        const p = ptsA[k], u = k / 40, s = lerp(A0, A1, u); track.sample(s, F);
        const top = F.pos.y - 5.5, h = top - p.y; if (h < 1.5) continue;
        const col = new THREE.BoxGeometry(1.2, h, 1.2); col.translate(p.x, p.y + h / 2, p.z); parts.pale.push(col);
      }
    }
    // pilas fuera del arco, lejos de la pista inferior
    for (let s = b0 + 12; s < b1 - 6; s += 34) {
      if (s > A0 - 6 && s < A1 + 6) continue;
      track.sample(s, F);
      if (distLower(F.pos.x, F.pos.z) < 30) continue;
      const gy = natural(F.pos.x, F.pos.z) - 2, top = F.pos.y - 5.4, h = top - gy; if (h < 2) continue;
      const pg = new THREE.CylinderGeometry(2.2, 3.2, h, 10); pg.translate(F.pos.x, gy + h / 2, F.pos.z); parts.pale.push(pg);
    }
  }
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (!q.index) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose());
    const mesh = new THREE.Mesh(gg, { metal, pale, lamp: lampM, cyan: cyanM }[k]); mesh.castShadow = k !== 'lamp' && k !== 'cyan'; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }
  // destellos de las balizas
  {
    const c = document.createElement('canvas'); c.width = c.height = 64; const gx = c.getContext('2d');
    const gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,215,0.7)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); own.push(tex);
    const pos = new Float32Array(lamps.length * 3); lamps.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ size: 7, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pt = new THREE.Points(gg, pm); pt.frustumCulled = false; world.add(pt); own.push(gg, pm);
  }

  // ── Urano, anillos, estrellas ──
  const sun = mirandaSunDir();
  const uc = centroid.clone().addScaledVector(URA_DIR, URA_D).setY(URA_D * URA_EL);
  const side = new THREE.Vector3(-URA_DIR.z, 0, URA_DIR.x);
  const axis = new THREE.Vector3(0, 1, 0).multiplyScalar(0.94).addScaledVector(side, 0.33).addScaledVector(URA_DIR, -0.08).normalize();
  const um = uranusMaterial(uc, sun, axis); own.push(um);
  const ura = new THREE.Mesh(new THREE.SphereGeometry(URA_R, 96, 64), um); ura.position.copy(uc); ura.frustumCulled = false; world.add(ura); own.push(ura.geometry);
  {
    const rg = new THREE.RingGeometry(URA_R * 1.55, URA_R * 2.06, 256, 1); rg.scale(1 / URA_R, 1 / URA_R, 1 / URA_R);
    const rm = ringsMaterial(); own.push(rm, rg);
    const ring = new THREE.Mesh(rg, rm); ring.scale.setScalar(URA_R); ring.position.copy(uc);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis); ring.frustumCulled = false; ring.renderOrder = 1; world.add(ring);
  }
  {
    const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 0.2, rnd() * 2 - 1).normalize().multiplyScalar(300000);
      pos.set([centroid.x + v.x, v.y, centroid.z + v.z], i * 3);
      const b = 0.3 + Math.pow(rnd(), 5) * 2.4, t = rnd();
      col.set(t < 0.2 ? [b * 0.8, b * 0.9, b] : t > 0.9 ? [b, b * 0.88, b * 0.74] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const st = new THREE.Points(gg, sm); st.frustumCulled = false; st.renderOrder = -2; world.add(st); own.push(gg, sm);
  }

  // ── Anillo de recuperación en lo alto del puente ──
  const rr = buildRaceRings(world, track, [sHi], own, { R: 30, lift: 8 });

  // ── Prólogo: Miranda entera (foto de la Voyager 2) antes de bajar al circuito ──
  const keep = new Set();
  const globeTex = new THREE.TextureLoader().load('miranda.jpg'); globeTex.colorSpace = THREE.SRGBColorSpace; own.push(globeTex);
  const gm = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: globeTex }, uA: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uMap; uniform float uA; varying vec3 vN;
      void main(){ vec3 n = normalize(vN); vec3 c = texture2D(uMap, vec2(0.5 + n.x * 0.497, 0.5 + n.y * 0.497)).rgb; gl_FragColor = vec4(c * smoothstep(-0.05, 0.25, n.z), uA); }`,
  });
  own.push(gm);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), gm); globe.renderOrder = 20; globe.frustumCulled = false; globe.visible = false; world.add(globe); own.push(globe.geometry);
  keep.add(globe);
  world.children.forEach((o) => { if (o.isPoints && o.material.vertexColors) keep.add(o); });
  let pro = false;
  const setPro = (on, G) => {
    if (on === pro) return; pro = on;
    for (const o of world.children) if (!keep.has(o)) o.visible = !on;
    globe.visible = on;
    G?.ships?.forEach((sh) => { if (!sh.out) sh.root.visible = !on; });
  };
  const PRO_T = 2.8;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

  const fx = {
    t: 0, gates: rr.gates, dbg: { heightAt, plateauY, natural, graded },
    update(dt, camera, G) {
      this.t += dt; uni.uT.value = this.t; rr.update(dt);
      const it = G?.state === 'intro' && G.intro ? G.intro.t : 99;
      setPro(it < PRO_T, G);
      if (pro && camera) {
        // la Miranda de la foto delante de la cámara, acercándose; la luna gira despacio
        const k = it / PRO_T, dist = lerp(4.2, 2.35, k * k * (3 - 2 * k));
        camera.getWorldDirection(_v);
        globe.position.copy(camera.position).addScaledVector(_v, dist * 1000);
        globe.scale.setScalar(1000);
        globe.quaternion.copy(camera.quaternion);
        _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.05 + k * 0.08); globe.quaternion.multiply(_q);
        gm.uniforms.uA.value = 1 - sstep(0.88, 1, k);
      }
    },
    passRings: (ships, onPass) => rr.passRings(ships, onPass),
    reset() { rr.reset(); },
  };

  // Intro (tras el prólogo): muy alto sobre el corte con Urano al fondo, bajada pegada a la pared del acantilado,
  // subida por encima del borde junto a la recta y la parrilla
  track.sample(0, F); const grid = F.pos.clone(), gridTan = F.tan.clone();
  const r0 = rimQ(grid.x, grid.z), rimP = new THREE.Vector3(r0.x, grid.y, r0.z), toVoid = new THREE.Vector3(r0.x - grid.x, 0, r0.z - grid.z).normalize();
  const along = new THREE.Vector3(-toVoid.z, 0, toVoid.x);
  const introKeys = () => [
    [0.0, rimP.clone().addScaledVector(URA_DIR, -1700).addScaledVector(toVoid, 700).setY(380), rimP.clone().addScaledVector(URA_DIR, 6000).setY(700), 54],
    [3.2, rimP.clone().addScaledVector(URA_DIR, -1300).addScaledVector(toVoid, 900).setY(240), rimP.clone().addScaledVector(URA_DIR, 6000).setY(500), 54],
    [6.2, rimP.clone().addScaledVector(toVoid, 1300).addScaledVector(along, -900).setY(-700), rimP.clone().addScaledVector(along, 1600).setY(700), 58],
    [8.6, rimP.clone().addScaledVector(toVoid, 160).addScaledVector(along, 120).setY(grid.y + 60), grid.clone().addScaledVector(gridTan, 80), 58],
    [10.6, grid.clone().addScaledVector(gridTan, -180).setY(grid.y + 55), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] MIRANDA: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · puente ${bridgeS.length * 4} m · balizas ${lamps.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => heightAt(x, z, 1)[1], tunnel: false, bridges: 0, introKeys, fx };
}
