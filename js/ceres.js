// CERES TRANSIT · nodo 07, cinturón principal. Corredor de tránsito abierto en un enjambre de rocas junto a Ceres.
// Trazado propio (sin origen en ningún circuito real), en «8» con los dos pasos a distinta altura:
//   GRID       plataforma minera colgada frente al asteroide Alfa
//   TRIPLE BORE túnel perforado a través de Alfa, ancho, con tres carriles (impulso · neutro · gases)
//   THE DROP   el tablero se corta y la nave cae a la plataforma de abajo
//   THE GEODE  asteroide hueco Beta: hélice que baja alrededor de un núcleo de cristal que gira
//   THE WALL   pared del asteroide Gamma a 55°; en la cumbre la nave despega y vuela sobre el cruce del 8
//   SHADOW STRAIGHT recta abierta entre campos de fuerza, con impactos anunciados y rebufo de iones
// Estética: polvo a contraluz, roca parda, acentos en blanco sal y ámbar sodio (las sales de los cráteres de Ceres).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { gpuBake } from './miranda.js';
import { QUALITY } from './quality.js';

// ── Planta por tramos: ['S', recta] · ['A', radio, grados (+ antihorario)] · ['M', marca] ──
// Cerrada numéricamente (rectas y ángulos de unión resueltos para que el lazo cierre sin quiebro).
const SEGS = [['M', 'grid'], ['S', 500], ['A', 300, 80], ['M', 'bore'], ['S', 450], ['A', 260, 80], ['M', 'boreOut'], ['S', 250], ['A', 600, 35.8],
  ['M', 'xfer'], ['S', 845.1], ['M', 'knot'], ['S', 200], ['A', 380, -70], ['M', 'drop'], ['S', 300], ['A', 300, -60], ['M', 'geode'], ['A', 170, -400],
  ['M', 'geodeOut'], ['A', 400, -94], ['S', 240], ['M', 'wall'], ['S', 460], ['M', 'shadow'], ['S', 519.8], ['A', 350, 68.1], ['S', 115]];

const TAN55 = Math.tan(55 * Math.PI / 180);
export const CERES = {
  wallSlope: 55,                // grados de THE WALL
  wallRise: 268,                // metros que sube la pared
  laneWiden: 1.42,              // TRIPLE BORE: anchura respecto a la normal
};

function turtle(segs, step = 4) {
  let x = 0, z = 0, h = 0, s = 0; const P = [new THREE.Vector3(0, 0, 0)], D = [0], marks = {};
  for (const sg of segs) {
    if (sg[0] === 'M') { marks[sg[1]] = s; continue; }
    if (sg[0] === 'S') { const n = Math.max(1, Math.round(sg[1] / step)); for (let i = 0; i < n; i++) { x += Math.sin(h) * sg[1] / n; z += Math.cos(h) * sg[1] / n; s += sg[1] / n; P.push(new THREE.Vector3(x, 0, z)); D.push(s); } }
    else { const [, R, deg] = sg, a = deg * Math.PI / 180, L = Math.abs(a) * R, n = Math.max(2, Math.round(L / step)); for (let i = 0; i < n; i++) { h -= a / n; x += Math.sin(h) * L / n; z += Math.cos(h) * L / n; s += L / n; P.push(new THREE.Vector3(x, 0, z)); D.push(s); } }
  }
  // cierre: el pequeño error final se reparte a lo largo de la vuelta
  const err = P[P.length - 1].clone();
  P.forEach((p, i) => p.addScaledVector(err, -D[i] / s));
  P.pop(); D.pop();
  return { P, D, L: s, marks };
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Cotas (m) por distancia en planta. Lineales entre claves, luego suavizadas; los dos vuelos se trazan con Hermite.
export function ceresLayout() {
  const { P, D, L, marks: M } = turtle(SEGS, 4);
  const N = P.length;
  const wallH = CERES.wallRise / TAN55;                 // recorrido en planta de la pared
  const dW0 = M.wall + 120, dW1 = dW0 + wallH;           // pie y labio de la pared
  const dJ1 = dW1 + 175;                                 // aterrizaje tras el salto de cumbre
  const dD0 = M.drop - 30, dD1 = dD0 + 150;              // THE DROP
  const yW0 = -232, yW1 = yW0 + CERES.wallRise;
  // vuelos balísticos (parábola): pendiente de salida m0 y de llegada m1 → la cota de aterrizaje sale sola
  const FL = { drop: [0, -0.62], wall: [TAN55 * 0.97, -0.42] };
  const land = (y0, [m0, m1], H) => y0 + H * (m0 + m1) / 2;
  const yD1 = land(-126, FL.drop, dD1 - dD0), yJ1 = land(yW1, FL.wall, dJ1 - dW1);
  const keys = [
    [0, 0], [470, 0], [760, -4], [1700, -42], [M.xfer, -74], [M.knot, -122], [dD0 - 40, -126], [dD0, -126],
    [dD1, yD1], [dD1 + 70, yD1 - 10], [M.geode, -190], [M.geodeOut, -258], [M.geodeOut + 300, -252], [dW0 - 40, -234], [dW0, yW0],
    [dW1, yW1], [dJ1, yJ1], [dJ1 + 60, yJ1 - 22], [M.shadow + 260, 22], [M.shadow + 480, 10], [L - 260, 2], [L, 0],
  ];
  const yAt = (d) => { let i = 0; while (i < keys.length - 2 && d > keys[i + 1][0]) i++; const [a, ya] = keys[i], [b, yb] = keys[i + 1]; return lerp(ya, yb, Math.min(1, Math.max(0, (d - a) / (b - a)))); };
  let y = D.map(yAt);
  // suavizado: ventana ±W (m); en la pared, ventana corta para que el muro conserve sus 55°
  const ds = L / N;
  const win = (d) => (d > dW0 - 20 && d < dW1 + 4 ? 2 : (d > dW0 - 70 && d < dW0 + 10 ? 9 : 26));
  for (let pass = 0; pass < 3; pass++) y = y.map((_, i) => { const W = Math.round(win(D[i]) / ds); if (W < 1) return y[i]; let a = 0; for (let k = -W; k <= W; k++) a += y[(i + k + N) % N]; return a / (2 * W + 1); });
  // vuelos: parábola desde el labio hasta el aterrizaje
  const iOf = (d) => Math.round(d / ds) % N;
  const flight = (d0, d1, [m0, m1]) => {
    const i0 = iOf(d0), i1 = iOf(d1), y0 = y[i0], a = (m1 - m0) / (2 * (d1 - d0)), yS = y[i1];
    for (let i = i0; i !== (i1 + 1) % N; i = (i + 1) % N) { const x = D[i] - D[i0]; y[i] = y0 + m0 * x + a * x * x; }
    // empalme con lo que sigue: la diferencia residual se reparte en los 60 m siguientes
    const e = y[i1] - yS; for (let k = 1; k <= Math.round(60 / ds); k++) { const j = (i1 + k) % N; y[j] += e * (1 - k * ds / 60); }
  };
  flight(dD0, dD1, FL.drop);
  flight(dW1, dJ1, FL.wall);
  const pts = P.map((p, i) => new THREE.Vector3(p.x, y[i], p.z));
  return { pts, D, L, N, marks: M, d: { W0: dW0, W1: dW1, J1: dJ1, D0: dD0, D1: dD1 }, y };
}

// distancia en planta → s de la pista (por las secciones de la línea central)
function sOfD(track, D, d) {
  const n = D.length; let i = 0; while (i < n - 1 && D[i + 1] < d) i++;
  const t = (d - D[i]) / Math.max(1e-6, (D[(i + 1) % n] || D[i] + 4) - D[i]);
  const a = track.sectionS[i], b = i + 1 < n ? track.sectionS[i + 1] : track.length;
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function ceresTrack() {
  const lay = ceresLayout();
  const { pts, D, marks: M, d } = lay;
  const N = pts.length;
  const s = {};                                         // posiciones en s, rellenas tras crear la pista
  // fracción de la vuelta (en longitud 3D, la que usa la pista) para una distancia en planta
  const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + pts[i % N].distanceTo(pts[i - 1]));
  const fOf = (dd) => { let i = 0; while (i < N - 1 && D[i + 1] < dd) i++; return cum[i] / cum[N]; };
  const boreA = fOf(M.bore - 160), boreB = fOf(M.boreOut + 40);
  const geoA = fOf(M.geode - 60), geoB = fOf(M.geodeOut + 40);
  const track = new Track(null, {
    points: pts, inSectorOrder: false, sectors: [0, 0.16, 0.33, 0.5, 0.67, 0.84],
    // peralte: el de siempre; dentro de la geoda la hélice se inclina más
    bank: (f, k) => THREE.MathUtils.clamp(k * 36, -0.2, 0.2) * (f > geoA && f < geoB ? 1.9 : 1),
    // TRIPLE BORE: tablero ancho (tres carriles)
    narrow: (f) => 1 + (CERES.laneWiden - 1) * sstep(boreA, boreA + 0.012, f) * (1 - sstep(boreB - 0.012, boreB, f)),
  });
  for (const [k, v] of Object.entries(M)) s[k] = sOfD(track, D, v);
  for (const [k, v] of Object.entries(d)) s[k] = sOfD(track, D, v);
  track.gaps = [{ s0: s.D0, s1: s.D1 }, { s0: s.W1, s1: s.J1 }];
  return { track, lay, s };
}

// ─────────────────────────────────────────────────────────────
//  Mundo
// ─────────────────────────────────────────────────────────────
function h1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 269.5 + z * 113.5) * 43758.5453; return s - Math.floor(s); }
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => h3(ix + a, iy + b, iz + d);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm3 = (x, y, z, o = 4) => { let a = 0, w = 0.5, n = 0; for (let i = 0; i < o; i++) { a += vn3(x, y, z) * w; n += w; x = x * 2.03 + 1.7; y = y * 2.03 + 4.1; z = z * 2.03 + 3.1; w *= 0.5; } return a / n; };
let _seed = 77;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

// Cuerpo rocoso: esfera deformada con radio analítico por dirección (sirve para la malla y para saber qué tapa la pista)
// lobes: [dirección, fuerza, anchura] → bultos y abolladuras grandes para que no parezca una esfera
function makeBody(c, R, amp, seed, extra = {}) {
  const lobes = extra.lobes || [], crag = extra.crag ?? amp * 0.8;
  return {
    c, R, amp, seed, ...extra,
    r(d) {
      let k = 1 + amp * ((fbm3(d.x * 1.6 + seed, d.y * 1.6, d.z * 1.6 - seed, 4) - 0.5) * 2.2 + (vn3(d.x * 5.2 + seed, d.y * 5.2, d.z * 5.2) - 0.5) * 0.5);
      // crestas y escalones a escala de decenas de metros (riscos, no un globo)
      const cr = 1 - Math.abs(2 * vn3(d.x * 11 + seed, d.y * 11 - seed, d.z * 11) - 1), cr2 = 1 - Math.abs(2 * vn3(d.x * 27 - seed, d.y * 27, d.z * 27 + seed) - 1);
      k += (crag * (cr * cr - 0.45) + crag * 0.45 * (cr2 * cr2 - 0.45));
      for (const [v, f, w] of lobes) { const a = Math.acos(Math.min(1, Math.max(-1, d.dot(v)))) / w; if (a < 3) k += f * Math.exp(-a * a); }
      return R * k;
    },
  };
}
const randLobes = (n, fMin, fMax, wMin = 0.45, wMax = 0.9) => Array.from({ length: n }, () => [new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(), fMin + rnd() * (fMax - fMin), wMin + rnd() * (wMax - wMin)]);
// p dentro de la roca con un margen (m)
function inBody(b, p, margin) {
  const v = p.clone().sub(b.c), L = v.length(), d = v.divideScalar(L || 1);
  const r = b.r(d);
  if (b.hollow) return L < r - margin && L > b.hollow * r / b.R + margin;
  return L < r - margin;
}
// Malla de un cuerpo: icosaedro subdividido y desplazado; 'shape(p)' puede retocar cada vértice (pared, cumbre)
function bodyGeometry(b, detail, shape, inner = false) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVerticesSimple(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const r = inner ? b.hollow * b.r(v) / b.R : b.r(v);
    const w = v.clone().multiplyScalar(r).add(b.c);
    if (shape) shape(w, v);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  if (inner) { const ix = g.index.array; for (let t = 0; t < ix.length; t += 3) { const a = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = a; } }
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
// fusiona vértices por posición (el icosaedro de three.js viene sin indexar)
function mergeVerticesSimple(g) {
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    idx.push(j);
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
}

// Textura de roca del cinturón (repetible): r relieve, g albedo, b grano fino, a variación grande. Cráteres escasos y suaves.
const BELT_BAKE = /* glsl */`
  varying vec2 vUv;
  float hP(vec2 n, float N){ n = mod(n, N); return fract(sin(dot(n, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h2P(vec2 n, float N){ n = mod(n, N); return fract(sin(vec2(dot(n, vec2(127.1, 311.7)), dot(n, vec2(269.5, 183.3)))) * 43758.5453); }
  float nP(vec2 p, float N){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hP(i, N), hP(i+vec2(1,0), N), f.x), mix(hP(i+vec2(0,1), N), hP(i+vec2(1,1), N), f.x), f.y); }
  float fP(vec2 p, float N){ float a = 0.0, w = 0.5; for (int i = 0; i < 6; i++) { a += nP(p, N) * w; p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  float rP(vec2 p, float N){ float a = 0.0, w = 0.5, g = 1.0; for (int i = 0; i < 5; i++) { float r = 1.0 - abs(2.0 * nP(p, N) - 1.0); r *= r * g; a += r * w; g = clamp(r * 1.8, 0.0, 1.0); p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  vec2 cr(vec2 q, float N, float prob){ vec2 g = q * N, n = floor(g), f = fract(g); vec2 acc = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = n + vec2(float(i), float(j)); float pr = hP(c + 7.3, N); if (pr > prob) continue;
      vec2 o = h2P(c, N); float r = 0.12 + 0.25 * hP(c + 3.1, N); float d = length(vec2(float(i), float(j)) + o - f) / r; if (d > 2.0) continue;
      acc += vec2((d < 1.0 ? (d * d - 1.0) * 0.35 : 0.0) + exp(-pow((d - 1.0) / 0.25, 2.0)) * 0.12, exp(-pow((d - 1.1) / 0.5, 2.0)) * 0.4); }
    return acc; }
  void main(){
    vec2 q = vUv;
    vec2 c = cr(q, 3.0, 0.35) + cr(q, 9.0, 0.25) * 0.6 + cr(q, 27.0, 0.2) * 0.4;
    float ridge = rP(q * 4.0, 4.0);
    float h = fP(q * 6.0, 6.0) * 0.6 + ridge * 0.5 + c.x * 0.5;
    float alb = fP(q * 3.0 + 4.0, 3.0) * 0.6 + fP(q * 24.0 + 1.0, 24.0) * 0.3 + c.y * 0.1 + (ridge - 0.5) * 0.25;
    float grain = fP(q * 96.0 + 9.0, 96.0);
    float big = fP(q * 2.0 + 13.0, 2.0);
    gl_FragColor = vec4(h, alb, grain, big);
  }`;

// ── Roca del cinturón: regolito pardo, triplanar desde la textura horneada, motas de sal y borde a contraluz ──
// mode 'world': cuerpos fijos (coordenadas de mundo) · 'inst': rocas instanciadas que giran solas
function rockMaterial(tex, uni, mode = 'world', opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, side: opts.side || THREE.FrontSide });
  const NL = (opts.lamps || []).length, NC = 8;
  m.userData.caps = opts.caps || [];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRock = { value: tex }; sh.uniforms.uT = uni.uT; sh.uniforms.uSunC = { value: uni.sun };
    sh.uniforms.uCaps = { value: [...m.userData.caps, ...Array(NC * 2).fill(0).map(() => new THREE.Vector4(0, -1e7, 0, 0))].slice(0, NC * 2) };
    if (NL) sh.uniforms.uLamps = { value: opts.lamps };
    const inst = mode === 'inst';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vRP; varying vec3 vRN; varying vec3 vRW; varying float vTone;
      ${inst ? `attribute vec4 aSpin; uniform float uT;
      mat3 rotA(vec3 a, float t){ float c = cos(t), s = sin(t), C = 1.0 - c;
        return mat3(c + a.x*a.x*C, a.y*a.x*C + a.z*s, a.z*a.x*C - a.y*s, a.x*a.y*C - a.z*s, c + a.y*a.y*C, a.z*a.y*C + a.x*s, a.x*a.z*C + a.y*s, a.y*a.z*C - a.x*s, c + a.z*a.z*C); }` : ''}`)
      .replace('void main() {', `void main() {\n${inst ? '  mat3 spinR = rotA(normalize(aSpin.xyz), uT * aSpin.w + aSpin.x * 9.0);' : ''}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${inst ? '  objectNormal = spinR * objectNormal;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${inst ? `vRP = position * length(instanceMatrix[0].xyz) + vec3(aSpin.w * 977.0); vTone = fract(aSpin.w * 7919.0); transformed = spinR * transformed;` : 'vTone = 0.5;'}
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vRW = (modelMatrix * wp).xyz; ${inst ? '' : 'vRP = vRW;'}
          vec3 n0 = objectNormal;
          #ifdef USE_INSTANCING
            n0 = mat3(instanceMatrix) * n0;
          #endif
          vRN = normalize(mat3(modelMatrix) * n0); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRP; varying vec3 vRN; varying vec3 vRW; varying float vTone; uniform sampler2D uRock; uniform vec3 uSunC; uniform vec4 uCaps[${NC * 2}];
      ${NL ? `uniform vec4 uLamps[${NL}];` : ''}
      vec4 tri(vec3 p, vec3 w, float sc){ return texture2D(uRock, p.zy / sc) * w.x + texture2D(uRock, p.xz / sc) * w.y + texture2D(uRock, p.xy / sc) * w.z; }`)
      .replace('void main() {', 'void main() {\n  vec3 rN = vec3(0.0, 1.0, 0.0);')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${NC}; i++) { vec3 a = uCaps[i * 2].xyz, b = uCaps[i * 2 + 1].xyz; vec3 ab = b - a; float t = clamp(dot(vRW - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0); if (length(vRW - a - ab * t) < uCaps[i * 2].w) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vRN); ${opts.side === THREE.DoubleSide || opts.side === THREE.BackSide ? 'n = gl_FrontFacing ? n : -n;' : ''}
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
          float sc = ${inst ? '38.0' : '260.0'};
          vec4 A = tri(vRP, w, sc), B = tri(vRP, w, sc * 0.17), C = tri(vRP + 11.0, w, sc * 0.031);
          float alb = clamp(A.g * 0.55 + B.g * 0.35 + (C.b - 0.5) * 0.3 + (A.a - 0.5) * 0.4 + (vTone - 0.5) * 0.35 - 0.1, 0.0, 1.0);
          vec3 umber = vec3(0.045, 0.034, 0.026), sand = vec3(0.3, 0.225, 0.16), ochre = vec3(0.4, 0.25, 0.12);
          vec3 col = mix(umber, sand, smoothstep(0.15, 0.85, alb));
          col = mix(col, ochre * 0.7, smoothstep(0.5, 0.8, A.a) * 0.35);
          // sales: motas y vetas blancas en los fondos (el blanco de las manchas de Ceres)
          float salt = smoothstep(0.86, 0.93, C.g * 0.75 + B.g * 0.45) * smoothstep(0.4, 0.7, B.a);
          col = mix(col, vec3(0.82, 0.8, 0.74), salt * 0.8);
          diffuseColor.rgb = col;
          float hx = tri(vRP + vec3(1.3, 0.0, 0.0), w, sc * 0.17).r - B.r, hz = tri(vRP + vec3(0.0, 0.0, 1.3), w, sc * 0.17).r - B.r;
          rN = normalize(n + (vec3(hx, 0.0, hz) - n * dot(vec3(hx, 0.0, hz), n)) * 0.9);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(rN, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // borde a contraluz: el sol detrás de la roca enciende su silueta a través del polvo
          vec3 V = normalize(cameraPosition - vRW);
          float back = pow(max(dot(-V, uSunC), 0.0), 4.0), rim = pow(1.0 - max(dot(rN, V), 0.0), 5.0) * smoothstep(-0.2, 0.3, dot(rN, uSunC));
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * rim * back * ${opts.rim ?? '0.55'};
          ${NL ? `vec3 acc = vec3(0.0);
          for (int i = 0; i < ${NL}; i++) { vec3 d = uLamps[i].xyz - vRW; float l2 = dot(d, d); float r = uLamps[i].w;
            float lam = max(dot(rN, normalize(d)), 0.0) * 0.85 + 0.15;
            acc += lam * r * r / (l2 + r * r * 0.25) * (i % 3 == 0 ? vec3(0.9, 0.92, 1.0) : vec3(1.0, 0.62, 0.22)); }
          totalEmissiveRadiance += diffuseColor.rgb * (acc * 0.8 + vec3(0.55, 0.36, 0.2) * 0.18);` : ''}
        }`);
  };
  m.customProgramCacheKey = () => 'ceRock' + mode + NL + (opts.side || 0) + (opts.rim ?? '');
  return m;
}

// Túnel perforado: roca con las marcas en espiral de la broca, anillos de lámparas de sodio y una franja de sal en el zócalo
function boreMaterial(tex, uni, per, lamp = [1.0, 0.62, 0.2]) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.05, side: THREE.DoubleSide });
  m.userData.per = per;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRock = { value: tex }; sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTu;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTu = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vTu; uniform sampler2D uRock; uniform float uT;`)
      .replace('void main() {', 'void main() {\n  float bLamp = 0.0, bPulse = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float u = vTu.x, s = vTu.y;                       // u: perímetro (m) desde el zócalo derecho · s: recorrido (m)
          vec4 T = texture2D(uRock, vec2(u, s) / 90.0), Q = texture2D(uRock, vec2(u, s) / 17.0 + 0.3);
          float aa = clamp(1.4 - length(fwidth(vec2(u, s))) * 0.5, 0.0, 1.0);   // de lejos, sin rayado (antialias)
          float drill = 0.5 + 0.5 * sin((s * 0.9 + u * 0.55) * 1.1 + Q.b * 3.0) * aa;  // estrías en espiral de la broca
          float alb = clamp(T.g * 0.6 + Q.g * 0.35 + (drill - 0.5) * 0.22 - 0.1, 0.0, 1.0);
          diffuseColor.rgb = mix(vec3(0.045, 0.034, 0.026), vec3(0.32, 0.24, 0.17), alb);
          float lr = fract(s / 36.0);                        // anillo de lámparas cada 36 m, en la bóveda
          float top = smoothstep(14.0, 22.0, u) * (1.0 - smoothstep(PER - 22.0, PER - 14.0, u));
          bLamp = (1.0 - smoothstep(0.0, 0.012, abs(lr - 0.5))) * top * aa;
          float ph = fract((s - uT * 140.0) / 108.0) * 108.0;
          bPulse = exp(-pow((ph - 54.0) / 5.0, 2.0));
          float salt = (1.0 - smoothstep(0.4, 0.8, abs(u - 2.2))) + (1.0 - smoothstep(0.4, 0.8, abs(u - (PER - 2.2))));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.83, 0.78), salt * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08), bLamp);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(${lamp.map((v) => v.toFixed(3)).join(',')}) * bLamp * (2.4 + 4.0 * bPulse);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.7, 0.4) * 0.35;`);
    sh.fragmentShader = sh.fragmentShader.replace('varying vec2 vTu;', `varying vec2 vTu; const float PER = ${m.userData.per.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'ceBore' + lamp.join(',') + m.userData.per;
  return m;
}

// Campo de fuerza: lámina translúcida, barrido de luz y rejilla de celdas; brilla más al mirarla de canto
function fieldMaterial(uni, col = [1.0, 0.62, 0.22]) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT, uCol: { value: new THREE.Vector3(...col) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float s = vUv.y, h = vUv.x;                           // s: recorrido (m) · h: altura 0–1
        vec2 c = vec2(s / 3.2, h * 4.0); c.x += step(1.0, mod(floor(c.y), 2.0)) * 0.5;
        vec2 f = abs(fract(c) - 0.5);
        float cell = smoothstep(0.42, 0.5, max(f.x, f.y * 0.9));
        float sweep = exp(-pow((fract((s - uT * 160.0) / 140.0) - 0.5) * 9.0, 2.0));
        float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float top = smoothstep(0.75, 1.0, h) + (1.0 - smoothstep(0.0, 0.08, h)) * 0.6;
        float fade = 1.0 - smoothstep(0.82, 1.0, h);
        float a = (0.035 + cell * 0.12 + sweep * 0.32 + pow(edge, 3.0) * 0.25) * fade + top * 0.5;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  });
}

// Rayos de luz en el polvo: cilindros largos alineados con el sol, más densos en el eje y con grano
function shaftMaterial(uni) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT, uK: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hh(float n){ return fract(sin(n * 91.7) * 43758.5); }
      void main(){
        #include <logdepthbuf_fragment>
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);       // centro del haz, bordes difusos
        float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float grain = 0.75 + 0.25 * sin(vUv.x * 40.0 + vUv.y * 9.0 + uT * 0.2);
        gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * core * along * grain * 0.075 * uK, 1.0);
      }`,
  });
}

// Ceres: esfera parda y gris, cráteres, las manchas blancas de sal y un fino halo de polvo
const CERES_BAKE = /* glsl */`
  varying vec2 vUv;
  float hP(vec2 n, float N){ n = mod(n, N); return fract(sin(dot(n, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h2P(vec2 n, float N){ n = mod(n, N); return fract(sin(vec2(dot(n, vec2(127.1, 311.7)), dot(n, vec2(269.5, 183.3)))) * 43758.5453); }
  float nP(vec2 p, float N){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hP(i, N), hP(i+vec2(1,0), N), f.x), mix(hP(i+vec2(0,1), N), hP(i+vec2(1,1), N), f.x), f.y); }
  float fP(vec2 p, float N){ float a = 0.0, w = 0.5; for (int i = 0; i < 6; i++) { a += nP(p, N) * w; p *= 2.0; N *= 2.0; w *= 0.5; } return a; }
  float cr(vec2 q, float N, float prob){ vec2 g = q * N, n = floor(g), f = fract(g); float acc = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = n + vec2(float(i), float(j)); if (hP(c + 7.3, N) > prob) continue;
      vec2 o = h2P(c, N); float r = 0.15 + 0.3 * hP(c + 3.1, N); float d = length(vec2(float(i), float(j)) + o - f) / r;
      acc += (d < 1.0 ? (d * d - 1.0) * 0.6 : 0.0) + exp(-pow((d - 1.0) / 0.2, 2.0)) * 0.3; }
    return acc; }
  void main(){
    vec2 q = vec2(vUv.x * 2.0, vUv.y);
    float h = cr(q, 6.0, 0.6) * 0.6 + cr(q, 16.0, 0.55) * 0.35 + cr(q, 44.0, 0.5) * 0.2 + (fP(q * 8.0, 16.0) - 0.5) * 0.6;
    float a = fP(q * 4.0, 8.0);
    vec3 col = mix(vec3(0.11, 0.095, 0.08), vec3(0.27, 0.23, 0.19), a) * (0.85 + h * 0.25);
    // manchas de sal: un cráter con su mancha brillante y un puñado de puntos menores
    float spot = exp(-pow(length((q - vec2(0.62, 0.58)) * vec2(1.0, 2.0)) / 0.018, 2.0)) + exp(-pow(length((q - vec2(0.645, 0.565)) * vec2(1.0, 2.0)) / 0.009, 2.0));
    spot += smoothstep(0.83, 0.9, fP(q * 22.0 + 3.0, 44.0)) * 0.6;
    col = mix(col, vec3(0.95, 0.94, 0.9), clamp(spot, 0.0, 1.0));
    gl_FragColor = vec4(col, h * 0.5 + 0.5);
  }`;
function ceresMaterial(center, sun, tex) {
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
        float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.z, n.x) + uT * 0.002;
        vec4 T = texture2D(uMap, vec2(fract(lon / 6.2831853 + 0.5), lat / 3.14159265 + 0.5));
        float lam = dot(n, normalize(uSun));
        float day = smoothstep(-0.05, 0.3, lam);
        float limb = pow(max(0.0, dot(n, V)), 0.35);
        vec3 c = T.rgb * vec3(1.0, 0.9, 0.78) * (0.003 + 0.5 * day * max(lam, 0.0)) * (0.65 + 0.35 * limb);
        // halo de polvo a contraluz en el borde
        float rim = pow(1.0 - max(0.0, dot(n, V)), 4.0);
        c += vec3(1.0, 0.66, 0.36) * rim * (0.08 + 0.5 * smoothstep(-0.4, 0.4, lam));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ── Sol y Ceres ──
const SUN = new THREE.Vector3(-0.36, 0.2, 0.91).normalize();          // bajo y de frente al salir: contraluz en la recta
const CERES_DIR = new THREE.Vector3(0.9, 0.18, -0.1).normalize();      // a la derecha de la parrilla, en fase gibosa
const CERES_D = 170000, CERES_R = 60000;
export function ceresSunDir() { return SUN.clone(); }

const TR = 24, TC = 8;                         // túnel perforado: radio y altura del centro sobre el tablero
const HW = 17.6;                               // semiancho del tablero

export function buildCeres(def, { world, own, srcMat, renderer }) {
  const T0 = performance.now();
  _seed = 77;
  const { track, lay, s: S } = ceresTrack();
  const F = track.frame(), L = track.length;
  const uni = { uT: { value: 0 }, sun: SUN.clone() };
  const lite = QUALITY.lite;
  const inRange = (q, a, b) => { const d = track.delta(a, q); return d >= 0 && d <= track.delta(a, b) + (b < a ? L : 0); };
  const R = { ramp: [S.W0 - 30, S.W1 + 4], shadow: [S.J1 + 70, L - 330], grid: [L - 300, 430] };

  // ── Muestras de la línea central ──
  const smp = [];
  for (let q = 0; q < L; q += 4) { track.sample(q, F); smp.push({ s: q, p: F.pos.clone(), r: F.right.clone(), u: F.up.clone(), t: F.tan.clone(), w: track.wAt(q), gap: track.gapAt(q) >= 0 }); }
  const CELL = 90, hash = new Map();
  smp.forEach((q, i) => { const k = `${Math.floor(q.p.x / CELL)},${Math.floor(q.p.y / CELL)},${Math.floor(q.p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const nearest = (p, rad = CELL) => {
    let best = null, bd = Infinity; const n = Math.ceil(rad / CELL);
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let c = -n; c <= n; c++) { const l = hash.get(`${cx + a},${cy + b},${cz + c}`); if (l) for (const i of l) { const d = smp[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = smp[i]; } } }
    return best ? { q: best, d: Math.sqrt(bd) } : { q: null, d: Infinity };
  };
  const range = (a, b) => smp.filter((q) => inRange(q.s, a, b));

  // ── Cuerpos: Alfa (perforado), Beta (geoda hueca), Gamma (la pared) ──
  const cen = (list) => list.reduce((a, q) => a.add(q.p), new THREE.Vector3()).multiplyScalar(1 / list.length);
  const boreS = range(S.bore - 40, S.boreOut - 40);
  const cA = cen(boreS).add(new THREE.Vector3(0, -30, 0));
  let rA = 0; for (const q of boreS) rA = Math.max(rA, q.p.distanceTo(cA));
  const alfa = makeBody(cA, (rA + TR + 46) / 0.86, 0.09, 3.1, { name: 'alfa', lobes: randLobes(5, -0.06, 0.22) });
  const helix = range(S.geode, S.geodeOut);
  const cB = cen(helix); let rB = 0; for (const q of helix) rB = Math.max(rB, q.p.distanceTo(cB));
  const BRi = rB + 62, beta = makeBody(cB, BRi + 62, 0.05, 7.7, { name: 'beta', hollow: BRi, lobes: randLobes(4, 0.06, 0.2) });
  track.sample((S.W0 + S.W1) / 2, F);
  const rampMid = F.pos.clone(), rampN = F.up.clone();
  const GR = 300, gamma = makeBody(rampMid.clone().addScaledVector(rampN, -(GR + 4)), GR, 0.08, 11.3, { name: 'gamma', lobes: randLobes(4, -0.05, 0.18).map((l) => (l[0].dot(rampN) > 0.5 ? [l[0], Math.min(l[1], 0), l[2]] : l)) });
  track.sample(S.W1, F); const lip = F.pos.clone(), lipF = new THREE.Vector3(F.tan.x, 0, F.tan.z).normalize();
  const bodies = [alfa, beta, gamma];

  // ── Qué tramos van por dentro de la roca → túneles ──
  const covered = (q) => { if (q.gap || inRange(q.s, ...R.ramp)) return null; const c = q.p.clone().addScaledVector(q.u, TC + 4); for (const b of bodies) if (inBody(b, c, 6)) return b; return null; };
  const tunnels = [];
  { let cur = null;
    for (const q of smp) { const b = covered(q); if (b && cur && cur.body === b && q.s - cur.b <= 44) cur.b = q.s; else if (b) { cur = { a: q.s, b: q.s, body: b }; tunnels.push(cur); } }
    for (let i = tunnels.length - 1; i >= 0; i--) if (tunnels[i].b - tunnels[i].a < 24) tunnels.splice(i, 1);
  }
  const inTunnel = (q) => tunnels.some((t) => q >= t.a - 18 && q <= t.b + 18);
  const caps = [];
  for (const t of tunnels) for (const [s0, s1] of [[t.a - 26, t.a + 34], [t.b + 26, t.b - 34]]) { track.sample(s0, F); const a = F.pos.clone().addScaledVector(F.up, TC); track.sample(s1, F); const b = F.pos.clone().addScaledVector(F.up, TC); caps.push(new THREE.Vector4(a.x, a.y, a.z, TR + 3), new THREE.Vector4(b.x, b.y, b.z, 0)); }

  // ── Textura de roca y materiales ──
  const rockRT = gpuBake(renderer, lite ? 512 : 1024, BELT_BAKE); own.push(rockRT);
  const tex = rockRT.texture;
  // lámparas de la geoda: cristales y focos (luz emisiva sobre la roca, sin luces reales)
  const geodeLamps = [];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3, yy = (k % 3 - 1) * 0.42; geodeLamps.push(new THREE.Vector4(cB.x + Math.cos(a) * BRi * 0.78, cB.y + yy * BRi, cB.z + Math.sin(a) * BRi * 0.78, k % 3 === 0 ? 90 : 120)); }
  geodeLamps.push(new THREE.Vector4(cB.x, cB.y + 40, cB.z, 170), new THREE.Vector4(cB.x, cB.y - 60, cB.z, 150), new THREE.Vector4(cB.x, cB.y + BRi * 0.7, cB.z, 120));
  const rock = rockMaterial(tex, uni, 'world', { caps }); own.push(rock);
  const cave = rockMaterial(tex, uni, 'world', { caps, lamps: geodeLamps, side: THREE.DoubleSide, rim: '0.0' }); own.push(cave);
  const instRock = rockMaterial(tex, uni, 'inst'); own.push(instRock);

  // ── Mallas de los cuerpos ──
  const detail = lite ? 30 : 56;
  const hw = HW + 6;
  // Gamma: cara bajo la rampa aplanada al tablero; tras la cumbre la roca cae a pico (desde el labio se vuela)
  const shapeGamma = (w) => {
    const rel = w.clone().sub(lip), fwd = rel.dot(lipF);
    if (fwd > -6) w.y = Math.min(w.y, lip.y - 6 - Math.max(0, fwd) * 2.4);
    const n = nearest(w, 120); if (!n.q || !inRange(n.q.s, S.W0 - 90, S.W1 + 2)) return;
    const q = n.q, v = w.clone().sub(q.p), lat = Math.abs(v.dot(q.r)), h = v.dot(q.u);
    if (h > -120 && lat < hw + 70) {
      const tgt = -2.4 - Math.max(0, lat - hw) * 0.55;
      if (lat < hw || h > tgt) w.addScaledVector(q.u, tgt - h);
    }
  };
  const meshBody = (b, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = !lite; world.add(m); own.push(geo); return m; };
  meshBody(alfa, bodyGeometry(alfa, detail), rock);
  meshBody(gamma, bodyGeometry(gamma, detail, shapeGamma), rock);
  meshBody(beta, bodyGeometry(beta, detail), rock);
  meshBody(beta, bodyGeometry(beta, detail, null, true), cave);

  // ── Tablero (por tramos: los vuelos van sin tablero) ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x4e4a46))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0x8f8a82))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x34302c)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xd8d4cc)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.66, 0.24); m.emissiveIntensity = 2.2; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed, opts = {}) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const q = s0 + (s1 - s0) * r / rows; track.sample(q, F);
      const wv = opts.widen ? track.wAt(q) : 1;
      let per = 0;
      prof.forEach(([x0, h], k) => {
        const x1 = x0 * wv;
        pos.push(F.pos.x + F.right.x * x1 + F.up.x * h, F.pos.y + F.right.y * x1 + F.up.y * h, F.pos.z + F.right.z * x1 + F.up.z * h);
        if (k) per += Math.hypot((prof[k][0] - prof[k - 1][0]) * wv, prof[k][1] - prof[k - 1][1]);
        uv.push(opts.uPer ? per : k / (m - 1), opts.uPer ? q : q / 20);
      });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  };
  // tramos con tablero: la vuelta menos los dos vuelos
  const solid = []; { const g = [...track.gaps].sort((a, b) => a.s0 - b.s0); let a = g[g.length - 1].s1 - L; for (const gp of g) { solid.push([a, gp.s0]); a = gp.s1; } }
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  for (const [a, b] of solid) {
    parts.deck.push(sweepSeg(a, b, 3, deckProf, true));
    if (!true) continue;
    parts.guard.push(sweepSeg(a, b, 3, wallL, false), sweepSeg(a, b, 3, wallR, false));
    parts.edge.push(sweepSeg(a, b, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(a, b, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  }
  const boxAt = (q, x0, h, w, hh, d, list, widen = true) => {
    track.sample(q, F);
    const x = widen && Math.abs(x0) > 10 ? x0 * track.wAt(q) : x0;
    const bx = new THREE.BoxGeometry(w, hh, d);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    bx.translate(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h);
    list.push(bx); return bx;
  };
  const onDeck = (q) => track.gapAt(q) < 0 && track.gapAt(q + 3) < 0 && track.gapAt(q - 3) < 0;
  for (let q = 5; q < L; q += 24) if (onDeck(q)) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.28, 0.4, 1.3, parts.buoy, false);
  // la pared: balizas cada 8 m, la ola de luz trepa con la nave
  for (let q = S.W0 - 20; q < S.W1 - 2; q += 8) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.32, 0.5, 2.2, parts.buoy, false);
  for (let q = 0; q < L; q += 14) if (onDeck(q)) boxAt(q, 0, 0.03, 0.28, 0.06, 3.2, parts.guide, false);
  for (const sc of track.sectors) { const q = sc.s + (sc.id === 1 ? 6 : 0); if (!onDeck(q) || inTunnel(q)) continue; for (const x of [-17.6, 17.6]) boxAt(q, x, 7.5, 0.9, 15, 0.9, parts.frame); boxAt(q, 0, 15.2, 36 * track.wAt(q), 0.4, 1.2, parts.gate, false); }
  // labios de los vuelos: barra de luz de lado a lado
  for (const gp of track.gaps) for (const q of [gp.s0 - 0.6, gp.s1 + 0.6]) boxAt(q, 0, 0.15, 34, 0.3, 0.8, parts.gate, false);
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, M[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh); own.push(merged);
  }

  // ── Estructuras: metal oscuro, blanco sal, ámbar sodio ──
  const SM = {
    metal: new THREE.MeshStandardMaterial({ color: 0x2c2926, roughness: 0.5, metalness: 0.75 }),
    salt: new THREE.MeshStandardMaterial({ color: 0xa9a399, roughness: 0.5, metalness: 0.3 }),
    hull: new THREE.MeshStandardMaterial({ color: 0x4a443d, roughness: 0.62, metalness: 0.45 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xffa040, emissiveIntensity: 3.0 }),
    white: new THREE.MeshStandardMaterial({ color: 0x303030, emissive: 0xfff4e4, emissiveIntensity: 3.2 }),
  };
  Object.values(SM).forEach((m) => own.push(m));
  const arch = { metal: [], salt: [], hull: [], amber: [], white: [] };
  // anillo en el marco de la pista (polígono de n lados), con fondo 'depth'
  const ring = (q, list, rad, n, depth, th, hc = TC, lit = null, arc = null) => {
    const pos = [], idx = [];
    const pts = []; for (let k = 0; k <= n; k++) { const a = arc ? arc[0] + (arc[1] - arc[0]) * k / n : k / n * Math.PI * 2; pts.push([Math.cos(a), Math.sin(a)]); }
    const put = (ss, x, h) => { track.sample(ss, F); pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); return pos.length / 3 - 1; };
    for (let k = 0; k < n; k++) {
      const [a0, b0] = pts[k], [a1, b1] = pts[k + 1];
      const v = [];
      for (const [ss, rr] of [[q, rad], [q, rad + th], [q + depth, rad], [q + depth, rad + th]]) v.push(put(ss, a0 * rr, hc + b0 * rr), put(ss, a1 * rr, hc + b1 * rr));
      // v: [q,in,0] [q,in,1] [q,out,0] [q,out,1] [d,in,0] [d,in,1] [d,out,0] [d,out,1]
      idx.push(v[0], v[4], v[1], v[1], v[4], v[5], v[2], v[3], v[6], v[3], v[7], v[6], v[0], v[2], v[4], v[2], v[6], v[4], v[0], v[1], v[2], v[1], v[3], v[2], v[4], v[6], v[5], v[5], v[6], v[7]);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    list.push(gg);
    if (lit) { const gl = new THREE.BufferGeometry(); const lp = [], li = []; for (let k = 0; k < n; k++) { const [a0, b0] = pts[k], [a1, b1] = pts[k + 1]; const r0 = rad - 0.15; const i0 = lp.length / 3; for (const [ss, x, h] of [[q + depth * 0.3, a0 * r0, hc + b0 * r0], [q + depth * 0.3, a1 * r0, hc + b1 * r0], [q + depth * 0.7, a0 * r0, hc + b0 * r0], [q + depth * 0.7, a1 * r0, hc + b1 * r0]]) { track.sample(ss, F); lp.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); } li.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3); } gl.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); gl.setIndex(li); gl.computeVertexNormals(); lit.push(gl); }
  };

  // Túneles perforados (perfil circular abierto por abajo; en TRIPLE BORE se ensancha)
  const prof = []; { const n = 26, a0 = -0.42, a1 = Math.PI + 0.42; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; prof.push([Math.cos(a) * TR, TC + Math.sin(a) * TR]); } }
  let per = 0; for (let k = 1; k < prof.length; k++) per += Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]);
  const boreM = boreMaterial(tex, uni, per); own.push(boreM);
  for (const t of tunnels) {
    const a = t.a - 30, b = t.b + 30;
    const gg = sweepSeg(a, b, 3, prof, false, { widen: true, uPer: true });
    const mesh = new THREE.Mesh(gg, boreM); mesh.receiveShadow = true; world.add(mesh); own.push(gg);
    // pórticos: marco de sal escalonado con banda ámbar
    for (const [q, dir] of [[a, 1], [b, -1]]) {
      const w = track.wAt(q);
      ring(q - (dir > 0 ? 3 : 0), arch.salt, (TR + 0.5) * Math.max(1, w * 0.92), 30, 3, 3.2, TC, arch.amber, [-0.42, Math.PI + 0.42]);
      ring(q - (dir > 0 ? 6 : -3), arch.metal, (TR + 3.6) * Math.max(1, w * 0.92), 30, 2, 4.5, TC, null, [-0.42, Math.PI + 0.42]);
    }
  }

  // Tubo de celosía en el espacio abierto: costillas cada 26 m, una de cada cuatro encendida, y cuatro largueros
  const open = [];
  const bT = tunnels.filter((t) => t.body === beta).sort((p, q) => p.a - q.a);
  const cavity = bT.length >= 2 ? [bT[0].b + 18, bT[bT.length - 1].a - 18] : [S.geode, S.geodeOut];
  { let a = null; for (let q = 0; q < L; q += 4) { const ok = onDeck(q) && !inTunnel(q) && !inRange(q, ...cavity) && !inRange(q, ...R.grid) && !inRange(q, ...R.shadow) && !inRange(q, ...R.ramp) && !inRange(q, S.J1 - 10, S.J1 + 70); if (ok && a === null) a = q; if (!ok && a !== null) { if (q - a > 60) open.push([a, q]); a = null; } } if (a !== null) open.push([a, L]); }
  let nRing = 0;
  for (const [a, b] of open) {
    for (let q = a + 10; q < b - 6; q += 26) { const lit = nRing++ % 4 === 0; ring(q, lit ? arch.salt : arch.metal, 25.5, 20, lit ? 1.8 : 1.2, lit ? 1.4 : 1.0, TC - 2, lit ? arch.amber : null); }
    for (const k of [0.25, 0.75, 1.25, 1.75]) { const ang = k * Math.PI, x = Math.cos(ang) * 26.2, h = TC - 2 + Math.sin(ang) * 26.2; arch.metal.push(sweepSeg(a + 6, b - 6, 8, [[x - 0.6, h - 0.6], [x + 0.6, h - 0.6], [x + 0.6, h + 0.6], [x - 0.6, h + 0.6]], true)); }
    // quilla bajo el tablero
    arch.metal.push(sweepSeg(a, b, 8, [[-3, -1.8], [3, -1.8], [1.6, -4.2], [-1.6, -4.2]], true));
  }
  void nRing;

  // la hélice de la geoda: quilla con franja de luz ámbar y focos bajo el tablero cada 40 m
  arch.metal.push(sweepSeg(cavity[0], cavity[1], 6, [[-4, -1.8], [4, -1.8], [2.2, -5.2], [-2.2, -5.2]], true));
  arch.amber.push(sweepSeg(cavity[0], cavity[1], 6, [[-0.8, -5.2], [0.8, -5.2], [0.8, -5.6], [-0.8, -5.6]], true));
  for (let q = cavity[0] + 20; q < cavity[1]; q += 40) for (const x of [-15, 15]) boxAt(q, x, -2.2, 2.2, 0.6, 2.2, arch.white, false);
  // ── THE DROP: anillos de captura en el aterrizaje ──
  for (const q of [S.D1 + 6, S.D1 + 30]) { ring(q, arch.salt, 25, 32, 1.6, 1.3, TC, arch.white, [-0.2, Math.PI + 0.2]); }
  // ── la cumbre de THE WALL: pórtico de despegue ──
  ring(S.W1 - 14, arch.salt, 24, 30, 2.4, 1.6, TC, arch.amber, [-0.25, Math.PI + 0.25]);

  // ── Plataforma de salida frente a Alfa: losa, módulos mineros, mástiles y cables de anclaje ──
  const module = (cx, cy, cz, yaw, w, h, d) => {
    const m4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, cy, cz);
    const add = (list, geo, x, yy, z) => { geo.translate(x, yy, z); geo.applyMatrix4(m4); list.push(geo); };
    add(arch.hull, new THREE.BoxGeometry(w, h, d), 0, h / 2, 0);
    add(arch.salt, new THREE.BoxGeometry(w * 1.04, 1.2, d * 1.06), 0, 0.6, 0);
    add(arch.metal, new THREE.BoxGeometry(w * 1.02, 0.8, d * 1.08), 0, h * 0.62, 0);
    const nW = Math.max(1, Math.floor(w / 4.2));
    for (let k = 0; k < nW; k++) { const x = -w / 2 + (k + 0.5) * w / nW; add(rnd() < 0.75 ? arch.amber : arch.white, new THREE.BoxGeometry(w / nW * 0.62, 1.1, 0.2), x, h * 0.45, d / 2 + 0.05); }
    for (const sx of [-1, 1]) add(arch.metal, new THREE.BoxGeometry(1.2, h * 1.05, 1.4), sx * (w / 2 + 0.4), h * 0.52, d / 2 - 0.3);
    if (rnd() < 0.6) { const pc = new THREE.CylinderGeometry(0.7, 0.7, w * 1.1, 10); pc.rotateZ(Math.PI / 2); add(arch.metal, pc, 0, h + 1.2, d * 0.2); }
  };
  {
    const a = R.grid[0] - L, b = R.grid[1];
    arch.metal.push(sweepSeg(a, b, 6, [[-78, -2.2], [78, -2.2], [78, -6.5], [-78, -6.5]], true));
    arch.salt.push(sweepSeg(a, b, 6, [[-79, -1.6], [-70, -1.6], [-70, -2.3], [-79, -2.3]], true), sweepSeg(a, b, 6, [[70, -1.6], [79, -1.6], [79, -2.3], [70, -2.3]], true));
    for (let q = a + 20; q < b - 20; q += 34) {
      track.sample(q, F);
      const yaw = Math.atan2(F.tan.x, F.tan.z);
      for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const off = 44 + rnd() * 16, p = F.pos.clone().addScaledVector(F.right, side * off);
        module(p.x, p.y - 2.2, p.z, yaw + (side > 0 ? Math.PI : 0), 14 + rnd() * 10, 10 + rnd() * 16, 9 + rnd() * 5);
      }
      if (Math.round(q / 34) % 3 === 0) for (const side of [-1, 1]) { const p = F.pos.clone().addScaledVector(F.right, side * 30); const mast = new THREE.CylinderGeometry(0.5, 0.7, 26, 8); mast.translate(p.x, p.y + 11, p.z); arch.metal.push(mast); const lmp = new THREE.BoxGeometry(3.2, 0.8, 1.6); lmp.translate(p.x, p.y + 24, p.z); arch.white.push(lmp); }
    }
    // cables de anclaje hacia la cara de Alfa
    for (const [q, side] of [[a + 60, -1], [a + 60, 1], [b - 40, -1], [b - 40, 1], [(a + b) / 2, -1], [(a + b) / 2, 1]]) {
      track.sample(q, F); const p0 = F.pos.clone().addScaledVector(F.right, side * 76).addScaledVector(F.up, -4);
      const dir = alfa.c.clone().sub(p0).normalize(), len = Math.max(20, p0.distanceTo(alfa.c) - alfa.r(dir.clone().negate()) * 0.97 + 10);
      const cy = new THREE.CylinderGeometry(0.9, 0.9, len, 8); cy.translate(0, len / 2, 0);
      cy.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); cy.translate(p0.x, p0.y, p0.z); arch.metal.push(cy);
    }
  }

  // ── SHADOW STRAIGHT: campos de fuerza y emisores; sin paredes sólidas ──
  const fieldM = fieldMaterial(uni); own.push(fieldM);
  {
    const [a, b] = R.shadow, rows = Math.round((b - a) / 4), pos = [], uv = [], idx = [];
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      for (let r = 0; r <= rows; r++) { const q = a + (b - a) * r / rows; track.sample(q, F); for (const h of [0, 1]) { const x = side * 17.0, hh = h * 11; pos.push(F.pos.x + F.right.x * x + F.up.x * hh, F.pos.y + F.right.y * x + F.up.y * hh, F.pos.z + F.right.z * x + F.up.z * hh); uv.push(h, q); } }
      for (let r = 0; r < rows; r++) { const i = base + r * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, fieldM); mesh.renderOrder = 3; world.add(mesh); own.push(gg);
    for (let q = a; q <= b; q += 40) for (const x of [-17.6, 17.6]) { boxAt(q, x, 6, 1.0, 13, 1.0, arch.metal, false); boxAt(q, x, 12.4, 1.3, 0.5, 1.3, arch.amber, false); }
    arch.metal.push(sweepSeg(a, b, 8, [[-2.4, -1.8], [2.4, -1.8], [1.2, -3.6], [-1.2, -3.6]], true));
    arch.amber.push(sweepSeg(a, b, 8, [[-0.5, -3.6], [0.5, -3.6], [0.5, -3.9], [-0.5, -3.9]], true));
  }

  // ── TRIPLE BORE: lomos de sal entre carriles; carril de impulso con chevrones, carril de gases con respiraderos ──
  const bore = tunnels.find((t) => t.body === alfa) || tunnels[0];
  const lane = { a: bore ? bore.a - 10 : 0, b: bore ? bore.b + 10 : 0, edge: HW * CERES.laneWiden / 3 };
  if (bore) {
    for (let q = lane.a; q < lane.b; q += 3) {
      const w = track.wAt(q); if (w < 1.3) continue;
      for (const x of [-lane.edge, lane.edge]) boxAt(q, x, 0.12, 0.7, 0.24, 3.2, arch.salt, false);
    }
    for (let q = lane.a; q < lane.b; q += 9) { if (track.wAt(q) < 1.3) continue; boxAt(q, -lane.edge * 2, 0.05, 6.5, 0.08, 1.1, arch.amber, false); }
  }
  const softDot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  own.push(softDot);
  const gasM = new THREE.PointsMaterial({ color: 0xb08a60, map: softDot, size: 11, transparent: true, opacity: 0.12, depthWrite: false, sizeAttenuation: true });
  // los gases solo se ven de cerca (de lejos serían polvo de píxeles)
  gasM.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvFade = 1.0 - smoothstep(220.0, 520.0, -mvPosition.z);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\ngl_FragColor.a *= vFade;');
  };
  own.push(gasM);
  let gas = null;
  if (bore) {
    const n = lite ? 700 : 1600, gp = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { const q = lane.a + rnd() * (lane.b - lane.a); track.sample(q, F); const x = lane.edge * (1.1 + rnd() * 1.8), h = rnd() * 14; const p = F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h); gp.set([p.x, p.y, p.z], i * 3); seed[i] = rnd(); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.computeBoundingSphere();
    gas = new THREE.Points(gg, gasM); world.add(gas); own.push(gg);
  }

  // ── THE GEODE: cristales en la pared interior, núcleo que gira y anillos de esquirlas ──
  const glowTip = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.g * vColor.g * 1.6 + 0.04;'); }; m.customProgramCacheKey = () => 'ceCry' + m.emissive.getHex(); return m; };
  const crystalA = glowTip(new THREE.MeshStandardMaterial({ color: 0x6a3a14, emissive: 0xff8a2a, emissiveIntensity: 1.4, roughness: 0.12, metalness: 0.45, flatShading: true, vertexColors: true }));
  const crystalW = glowTip(new THREE.MeshStandardMaterial({ color: 0x9a948a, emissive: 0xffe2bc, emissiveIntensity: 0.9, roughness: 0.16, metalness: 0.3, flatShading: true, vertexColors: true }));
  own.push(crystalA, crystalW);
  const cry = { a: [], w: [] };
  const prism = (len, rad) => {
    const g = new THREE.CylinderGeometry(rad, rad * 1.05, len, 6, 1); const tip = new THREE.ConeGeometry(rad, rad * 1.6, 6); tip.translate(0, len / 2 + rad * 0.8, 0);
    const m = mergeGeometries([g.toNonIndexed(), tip.toNonIndexed()], false); g.dispose(); tip.dispose(); m.translate(0, len / 2, 0);
    const p = m.attributes.position, col = new Float32Array(p.count * 3), top = len + rad * 1.6;
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, p.getY(i) / top)); const c = 0.35 + 0.65 * t; col.set([0.55 + 0.45 * t, t, c], i * 3); }
    m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.deleteAttribute('uv');
    return m;
  };
  {
    let placed = 0;
    for (let k = 0, tries = 0; k < (lite ? 70 : 150) && tries < 2000; tries++) {
      const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      const base = cB.clone().addScaledVector(d, BRi * beta.r(d) / beta.R * 0.99);
      const len = 14 + Math.pow(rnd(), 2) * 70, rad = len * (0.08 + rnd() * 0.06);
      const dir = d.clone().negate().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.5)).normalize();
      const tip = base.clone().addScaledVector(dir, len + rad * 2);
      if (nearest(tip, 180).d < hw + 22 || nearest(base.clone().addScaledVector(dir, len * 0.5), 180).d < hw + 22) continue;
      const g = prism(len, rad); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate(base.x, base.y, base.z);
      (rnd() < 0.72 ? cry.a : cry.w).push(g); k++; placed++;
    }
    void placed;
  }
  for (const [k, list] of Object.entries(cry)) if (list.length) { const gg = mergeGeometries(list, false); list.forEach((q) => q.dispose()); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, k === 'a' ? crystalA : crystalW); world.add(m); own.push(gg); }
  const core = new THREE.Group(); core.position.copy(cB); world.add(core);
  {
    const lst = { a: [], w: [] };
    const coreR = 46;
    for (let k = 0; k < 11; k++) { const len = 45 + rnd() * 70, rad = 4 + rnd() * 5; const g = prism(len, rad); const a = rnd() * Math.PI * 2, rr = rnd() * coreR * 0.5; g.rotateZ((rnd() - 0.5) * 0.35); g.rotateX((rnd() - 0.5) * 0.35); g.translate(Math.cos(a) * rr, -len * 0.55, Math.sin(a) * rr); (k % 3 ? lst.a : lst.w).push(g); }
    for (let k = 0; k < 9; k++) { const len = 35 + rnd() * 60, rad = 3.5 + rnd() * 4; const g = prism(len, rad); g.rotateX(Math.PI); const a = rnd() * Math.PI * 2, rr = rnd() * coreR * 0.5; g.translate(Math.cos(a) * rr, len * 0.55, Math.sin(a) * rr); (k % 2 ? lst.a : lst.w).push(g); }
    // dos anillos de esquirlas que orbitan por encima y por debajo de la hélice
    for (const [yy, rr, n] of [[BRi * 0.52, BRi * 0.72, 26], [-BRi * 0.5, BRi * 0.7, 22]]) for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rnd() * 0.2, len = 10 + rnd() * 26; const g = prism(len, len * 0.12); g.rotateZ(rnd() * 3); g.rotateX(rnd() * 3); g.translate(Math.cos(a) * rr, yy + (rnd() - 0.5) * 20, Math.sin(a) * rr); (k % 4 ? lst.a : lst.w).push(g); }
    for (const [k, list] of Object.entries(lst)) { const gg = mergeGeometries(list, false); list.forEach((q) => q.dispose()); gg.computeVertexNormals(); core.add(new THREE.Mesh(gg, k === 'a' ? crystalA : crystalW)); own.push(gg); }
  }

  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (!q.index) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, SM[k]); mesh.castShadow = (k === 'metal' || k === 'salt' || k === 'hull') && !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── El enjambre: rocas instanciadas que giran solas (5 formas), con un pasillo libre alrededor de la pista ──
  const shapes = [];
  for (let k = 0; k < 5; k++) {
    const b = makeBody(new THREE.Vector3(), 1, 0.16 + k * 0.03, 20 + k * 7.3, { lobes: randLobes(3, -0.12, 0.3, 0.5, 1.0) });
    const sx = 0.75 + rnd() * 0.5, sz = 0.7 + rnd() * 0.5;
    const g = bodyGeometry(b, lite ? 2 : 5, (w) => { w.x *= sx; w.z *= sz; });
    shapes.push(g); own.push(g);
  }
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const q of smp) { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); bz0 = Math.min(bz0, q.p.z); bz1 = Math.max(bz1, q.p.z); by0 = Math.min(by0, q.p.y); by1 = Math.max(by1, q.p.y); }
  const midY = (by0 + by1) / 2;
  const introPath = [];                       // lo rellena la intro: la cámara pasa por aquí sin chocar
  const instances = shapes.map(() => []);
  const clearOf = (p, rad) => { const n = nearest(p, rad + 120); if (n.d < rad + 60) return false; for (const b of bodies) if (p.distanceTo(b.c) < b.R * 1.12 + rad) return false; for (const ip of introPath) if (ip.distanceTo(p) < rad + 45) return false; return true; };
  const place = (n, rMin, rMax, spread, ySpread, near = false) => {
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const rad = rMin * Math.pow(rMax / rMin, Math.pow(rnd(), 2.2));
      let p;
      if (near) { const q = smp[Math.floor(rnd() * smp.length)]; const side = rnd() < 0.5 ? -1 : 1; p = q.p.clone().addScaledVector(q.r, side * (60 + rnd() * 240)).addScaledVector(q.u, (rnd() - 0.5) * 300); }
      else { p = new THREE.Vector3(lerp(bx0 - spread, bx1 + spread, rnd()), midY + (rnd() + rnd() + rnd() - 1.5) * ySpread, lerp(bz0 - spread, bz1 + spread, rnd())); }
      if (!clearOf(p, rad)) continue;
      instances[Math.floor(rnd() * shapes.length)].push({ p, rad, axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: (rnd() - 0.5) * (rad < 12 ? 0.5 : 0.12), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)) });
      k++;
    }
  };
  const fieldRocks = { place, instances, built: false };
  const buildField = () => {
    place(lite ? 380 : 1100, 4, 70, 1800, 520);
    place(lite ? 170 : 700, 1.6, 9, 0, 0, true);
    place(lite ? 70 : 180, 60, 260, 6000, 1100);
    shapes.forEach((g, k) => {
      const list = instances[k]; if (!list.length) return;
      const im = new THREE.InstancedMesh(g, instRock, list.length);
      const spin = new Float32Array(list.length * 4), m4 = new THREE.Matrix4();
      list.forEach((it, i) => { m4.compose(it.p, it.q, new THREE.Vector3(it.rad, it.rad, it.rad)); im.setMatrixAt(i, m4); spin.set([it.axis.x, it.axis.y, it.axis.z, it.spin], i * 4); });
      g.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 4));
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = !lite;
      world.add(im);
    });
    fieldRocks.built = true;
  };

  // ── Cielo del cinturón: banda de polvo y rocas lejanas, estrellas, Ceres ──
  const bandN = lite ? 9000 : 24000;
  {
    const nrm = new THREE.Vector3(0.12, 1, -0.2).normalize(), e1 = new THREE.Vector3(1, 0, 0).cross(nrm).normalize(), e2 = nrm.clone().cross(e1);
    const pos = new Float32Array(bandN * 3), col = new Float32Array(bandN * 3);
    const c0 = cen(smp);
    for (let i = 0; i < bandN; i++) {
      const a = rnd() * Math.PI * 2, r = 30000 + Math.pow(rnd(), 0.6) * 200000, th = (rnd() + rnd() + rnd() - 1.5) * r * 0.05;
      const p = c0.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r).addScaledVector(nrm, th);
      pos.set([p.x, p.y, p.z], i * 3);
      const dir = p.clone().sub(c0).normalize(), lit = 0.25 + 0.75 * Math.pow(Math.max(0, dir.dot(SUN)), 2.0);
      const b = (0.15 + Math.pow(rnd(), 3) * 0.9) * lit;
      col.set([b * 1.0, b * 0.78, b * 0.58], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(gg, sm); pts.frustumCulled = false; pts.renderOrder = -2; world.add(pts); own.push(gg, sm);
  }
  {
    const n = 4200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(330000);
      pos.set([v.x, v.y, v.z], i * 3);
      const b = 0.25 + Math.pow(rnd(), 5) * 2.2, t = rnd();
      col.set(t < 0.2 ? [b * 0.8, b * 0.9, b] : t > 0.85 ? [b, b * 0.85, b * 0.68] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const stp = new THREE.Points(gg, sm); stp.frustumCulled = false; stp.renderOrder = -3; world.add(stp); own.push(gg, sm);
  }
  const ceresRT = gpuBake(renderer, lite ? 512 : 1024, CERES_BAKE); own.push(ceresRT);
  ceresRT.texture.wrapS = THREE.RepeatWrapping;
  const cc = cen(smp).addScaledVector(CERES_DIR, CERES_D);
  const cm = ceresMaterial(cc, SUN, ceresRT.texture); own.push(cm);
  const ceres = new THREE.Mesh(new THREE.SphereGeometry(CERES_R, 128, 96), cm); ceres.position.copy(cc); ceres.frustumCulled = false; ceres.renderOrder = -1; world.add(ceres); own.push(ceres.geometry);

  // ── Rayos de sol en el polvo ──
  const shaftM = shaftMaterial(uni); own.push(shaftM);
  {
    const list = [];
    const anchors = [S.W1, S.J1 + 300, S.xfer, S.knot - 200, S.grid + 300, S.D1, L - 500, S.shadow + 200, S.boreOut + 100];
    for (const [i, q] of anchors.entries()) {
      for (let k = 0; k < 2; k++) {
        track.sample(q, F);
        const len = 2600 + rnd() * 1800, rad = 70 + rnd() * 160;
        const g = new THREE.CylinderGeometry(rad, rad * 1.4, len, 20, 1, true);
        g.translate(0, len * 0.5, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN.clone().negate()));
        const off = F.right.clone().multiplyScalar((rnd() - 0.5) * 900).add(new THREE.Vector3(0, (rnd() - 0.5) * 300 + 80, 0));
        const o = F.pos.clone().add(off).addScaledVector(SUN, len * 0.55);
        g.translate(o.x, o.y, o.z); list.push(g); void i;
      }
    }
    const gg = mergeGeometries(list, false); list.forEach((q) => q.dispose());
    const m = new THREE.Mesh(gg, shaftM); m.renderOrder = 5; m.frustumCulled = false; world.add(m); own.push(gg);
  }

  // ── Impactos anunciados en SHADOW STRAIGHT ──
  const warnM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const flashM = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  own.push(warnM, flashM);
  const warnG = new THREE.RingGeometry(5.2, 7.2, 40), flashG = new THREE.SphereGeometry(1, 16, 12); own.push(warnG, flashG);
  const meteors = [];
  for (let i = 0; i < 4; i++) {
    const wm = warnM.clone(), fm = flashM.clone(); own.push(wm, fm);
    const warn = new THREE.Mesh(warnG, wm), flash = new THREE.Mesh(flashG, fm), rockI = new THREE.Mesh(shapes[i % 5], rock);
    warn.visible = flash.visible = rockI.visible = false; warn.renderOrder = 4; flash.renderOrder = 4;
    world.add(warn, flash, rockI);
    meteors.push({ warn, flash, rock: rockI, t: -1, s: 0, x: 0, pos: new THREE.Vector3(), up: new THREE.Vector3(), from: new THREE.Vector3(), hit: false });
  }
  let meteorClock = 3;

  // ── Zonas con nombre (cartel al entrar, solo en la primera vuelta) ──
  const zones = [
    [bore ? bore.a - 120 : S.bore, 'TRIPLE BORE', ['Tres carriles: impulso · neutro · gases', 'Three lanes: impulse · neutral · gas']],
    [S.D0 - 260, 'THE DROP', ['El tablero se corta: cae recto', 'The deck ends: drop straight']],
    [S.geode - 120, 'THE GEODE', ['Hélice dentro de Beta', 'Helix inside Beta']],
    [S.W0 - 260, 'THE WALL', ['55° · entra por encima de 380 km/h', '55° · enter above 380 km/h']],
    [S.J1 + 60, 'SHADOW STRAIGHT', ['Impactos · rebufo de iones repara', 'Impacts · ion wake repairs']],
  ].map(([q, title, sub]) => ({ s: track.wrap(q), title, sub }));

  const ships0 = new Map();
  let lastT = 0;
  const fx = {
    t: 0, gates: [], zones, lane, tunnels, meteors,
    update(dt) {
      this.t += dt; uni.uT.value = this.t; cm.uniforms.uT.value = this.t;
      core.rotation.y += dt * 0.06;
      if (gas) gas.rotation.set(0, 0, 0);
      for (const m of meteors) {
        if (m.t < 0) continue;
        m.t += dt;
        const k = m.t / 1.6;
        m.warn.material.opacity = m.t < 1.6 ? 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(m.t * 22)) : Math.max(0, 0.9 - (m.t - 1.6) * 0.8);
        m.warn.scale.setScalar(m.t < 1.6 ? 1.6 - 0.6 * k : 1);
        if (m.t > 1.25 && m.t < 1.6) { const f = (m.t - 1.25) / 0.35; m.rock.visible = true; m.rock.position.lerpVectors(m.from, m.pos, f); m.rock.rotation.x += dt * 9; }
        else m.rock.visible = false;
        if (m.t >= 1.6 && m.t < 2.6) { const f = (m.t - 1.6); m.flash.visible = true; m.flash.scale.setScalar(4 + f * 34); m.flash.material.opacity = Math.max(0, 1 - f * 1.2); }
        else m.flash.visible = false;
        if (m.t > 3.0) { m.t = -1; m.warn.visible = m.flash.visible = m.rock.visible = false; }
      }
    },
    passRings(ships, onPass) {
      const dt = Math.min(0.1, this.t - lastT); lastT = this.t;
      const [sa, sb] = R.shadow;
      for (const sh of ships) {
        if (sh.out || sh.dead > 0 || sh.fall) { if (sh.fall) ships0.delete(sh); continue; }
        let st = ships0.get(sh); if (!st) { st = { prev: sh.s, ion: 0 }; ships0.set(sh, st); }
        // carteles de zona
        for (const z of zones) { const d0 = track.delta(st.prev, z.s), d1 = track.delta(sh.s, z.s); if (d0 > 0 && d1 <= 0 && d1 > -60) onPass?.(sh, { kind: 'banner', title: z.title, sub: z.sub }); }
        st.prev = sh.s;
        // TRIPLE BORE: carriles
        if (bore && inRange(sh.s, lane.a, lane.b) && track.wAt(sh.s) > 1.3) {
          if (sh.x < -lane.edge) { sh.v = Math.min(sh.v + 9 * dt, Math.max(sh.v, sh.C.vmax * 1.07)); }
          else if (sh.x > lane.edge) { sh.boost = Math.min(1, sh.boost + 0.32 * dt); sh.v *= 1 - 0.05 * dt; }
        }
        // THE WALL: aviso de agarre (la física está en ship.js)
        if (sh.gripLoss > 0.15 && this.t - (st.grip || -9) > 2.5) { st.grip = this.t; onPass?.(sh, { kind: 'grip' }); }
        // rebufo de iones: pegado a otra nave en la recta repara blindaje
        if (inRange(sh.s, sa, sb) && sh.draft > 0.5) { st.ion += dt; if (st.ion > 2.2) { st.ion = 0; if (sh.hull < sh.maxHull) onPass?.(sh, { kind: 'ion' }); } }
        else st.ion = Math.max(0, st.ion - dt * 0.5);
      }
      // impactos: uno cada 2–4 s delante de alguna nave que va por la recta
      meteorClock -= dt;
      if (meteorClock <= 0) {
        meteorClock = 2 + rnd() * 2;
        const cand = ships.filter((sh) => !sh.out && inRange(sh.s, sa, sb - 200));
        const m = meteors.find((q) => q.t < 0);
        if (cand.length && m) {
          const sh = cand[Math.floor(rnd() * cand.length)];
          m.s = track.wrap(sh.s + Math.max(60, sh.v * 1.7)); m.x = (rnd() - 0.5) * 24; m.t = 0; m.hit = false;
          track.sample(m.s, F); m.pos.copy(F.pos).addScaledVector(F.right, m.x).addScaledVector(F.up, 0.25); m.up.copy(F.up);
          m.from.copy(m.pos).addScaledVector(SUN, -420).addScaledVector(F.up, 260);
          m.warn.position.copy(m.pos); m.warn.lookAt(m.pos.clone().add(F.up)); m.warn.visible = true;
          m.flash.position.copy(m.pos); m.rock.scale.setScalar(2.2);
        }
      }
      for (const m of meteors) if (m.t >= 1.6 && !m.hit) {
        m.hit = true;
        for (const sh of ships) { if (sh.out || sh.fall) continue; const d = track.delta(m.s, sh.s); if (Math.abs(d) < 10 && Math.abs(sh.x - m.x) < 8.5) onPass?.(sh, { kind: 'meteor', pos: m.pos.clone() }); }
        onPass?.(null, { kind: 'impact', pos: m.pos.clone() });
      }
    },
    reset() { ships0.clear(); for (const m of meteors) { m.t = -1; m.warn.visible = m.flash.visible = m.rock.visible = false; } meteorClock = 3; },
  };

  // ── Intro ──
  const flyby = [];
  const introKeys = makeIntro({ track, S, F, gamma, introPath, flyby });
  for (const fb of flyby) instances[flyby.indexOf(fb) % shapes.length].push({ p: fb.p, rad: fb.rad, axis: new THREE.Vector3(0.3, 1, 0.2).normalize(), spin: 0.05, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)) });
  buildField();

  let ymin = Infinity, ymax = -Infinity; for (const q of smp) { ymin = Math.min(ymin, q.p.y); ymax = Math.max(ymax, q.p.y); }
  console.info(`[SRS] CERES TRANSIT: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · túneles ${tunnels.map((t) => `${t.body.name} ${Math.round(t.a)}–${Math.round(t.b)}`).join(', ')} · pared ${Math.round(S.W0)}–${Math.round(S.W1)} · ${(performance.now() - T0).toFixed(0)} ms`);
  const main = bore || { a: 0, b: 0 };
  return { track, ground: () => -1e5, tunnel: { s: main.a - 30, len: main.b - main.a + 60 }, ownTunnel: true, bridges: 0, introKeys, fx, dbg: { S, tunnels, bodies, lane, fieldRocks, smp, nearest, zones } };
}

// ── Intro: del enjambre a contraluz a la pared, el despegue sobre el nudo y la parrilla ──
// Plano a plano (12,6 s propios + la llegada común a la parrilla):
//   0,0  teleobjetivo desde el fondo del enjambre: Gamma recortada contra el sol, rayos en el polvo
//   3,6  la cámara se cuela entre dos rocas grandes que pasan rozando
//   6,4  THE WALL de perfil: la rampa cruza el cuadro en diagonal
//   8,4  sube junto a la pared hasta la cumbre y su pórtico
//   10,2 sale al vacío por encima del vuelo y mira abajo, a la recta
//   12,6 baja hacia SHADOW STRAIGHT entre los campos de fuerza, rumbo a la parrilla
function makeIntro({ track, S, F, gamma, introPath, flyby }) {
  const P = (q, lat, h) => { track.sample(q, F); return F.pos.clone().addScaledVector(F.right, lat).addScaledVector(F.up, h); };
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(SUN, up).normalize();
  const g = gamma.c, lipP = P(S.W1, 0, 0);
  const keys = [
    [0.0, g.clone().addScaledVector(SUN, -2300).addScaledVector(side, 420).addScaledVector(up, 300), lipP.clone().addScaledVector(up, -60), 30],
    [3.6, g.clone().addScaledVector(SUN, -1150).addScaledVector(side, 190).addScaledVector(up, 120), lipP.clone().addScaledVector(up, -30), 40],
    [6.4, P(S.W0 + 30, -95, 22), P(S.W0 + 200, 0, 0), 62],
    [8.4, P(S.W1 - 60, -78, 52), P(S.W1 + 70, 0, 30), 66],
    [10.2, P(S.W1 + 70, -36, 70), P(S.J1 + 380, 0, -40), 70],
    [12.6, P(S.J1 + 260, 62, 78), P(S.J1 + 700, 0, 0), 58],
  ];
  // recorrido de la cámara (para dejarlo libre de rocas) y dos rocas que pasan rozando entre el plano 1 y el 2
  const cv = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal');
  for (let i = 0; i <= 160; i++) introPath.push(cv.getPoint(i / 160));
  for (const [u, off, rad] of [[0.12, -1, 34], [0.19, 1, 22], [0.27, -1, 46]]) {
    const p = cv.getPoint(u), t = cv.getTangent(u), n = new THREE.Vector3().crossVectors(t, up).normalize();
    flyby.push({ p: p.clone().addScaledVector(n, off * (rad + 26)).addScaledVector(up, (u - 0.2) * 120), rad });
  }
  return () => keys.map(([t, a, b, f]) => [t, a.clone(), b.clone(), f]);
}
