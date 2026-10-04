// EUROPA: noche sobre la corteza de hielo de la luna Europa, con Júpiter llenando medio cielo. Trazado inspirado
// en el autódromo José Carlos Pace (Interlagos). Las zonas sombreadas del plano (S de Senna, Descida do Lago,
// Ferradura y Laranjinha, Bico de Pato, Subida dos Boxes) son simas en el hielo: la pista flota sobre el vacío y
// abajo brilla la ciudad azul. Junto a la salida, gradas estratificadas como terrazas de arenisca con luz cálida;
// por la llanura, cúpulas de cristal hexagonal y torres-faro. Anillos de carrera: atravesarlos repara el blindaje,
// recarga dos cohetes y da un empujón de velocidad (con una película de luz azul).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { cofferPatch, cofferKey } from './facades.js';

// Trazado (px del plano), salida hacia +x, sentido antihorario como en Interlagos
const RAW = [[695, 443], [760, 428], [810, 413], [830, 395], [836, 380], [832, 365], [820, 352], [802, 340], [795, 325], [797, 307], [810, 290], [820, 270], [824, 245], [820, 220], [810, 195], [795, 172], [775, 150], [750, 135], [700, 120], [650, 108], [560, 88], [480, 68], [400, 50], [330, 33], [285, 25], [260, 25], [245, 40], [235, 75], [230, 110], [232, 150], [245, 185], [265, 200], [310, 235], [360, 272], [415, 312], [465, 340], [487, 360], [495, 390], [492, 420], [480, 442], [460, 457], [400, 472], [360, 480], [340, 472], [335, 452], [350, 432], [362, 410], [360, 385], [345, 372], [322, 372], [302, 385], [280, 407], [250, 430], [215, 450], [180, 457], [160, 450], [162, 432], [185, 410], [215, 385], [235, 360], [243, 320], [237, 292], [215, 270], [165, 237], [110, 207], [80, 190], [62, 195], [50, 215], [40, 250], [37, 290], [47, 340], [62, 385], [82, 422], [107, 452], [145, 477], [200, 495], [275, 512], [350, 525], [400, 524], [475, 505], [550, 485], [625, 465]];
const IDX = { senna: 4, sol: 15, oposta: 19, lago: 27, ferradura: 36, laranjinha: 39, pinheirinho: 48, bico: 54, mergulho: 60, juncao: 65, boxes: 72, arquib: 77, standA: 76, standB: 1 };
// simas: [cx, cy, semieje x, semieje y, giro°] en px del plano
const CHASMS = [[791, 372, 66, 82, -20], [222, 98, 68, 84, 28], [508, 362, 64, 26, -4], [495, 432, 86, 34, 2], [218, 418, 72, 42, -18], [118, 455, 64, 34, 32]];
const CITADEL_PX = [610, 238];        // montículo con la ciudadela en el gran hueco interior
const RINGS = [19, 28, 38, 72];       // anillos de carrera (índices RAW)
const K = 2.0;                        // ≈ 6,6 km
const FLOOR = -380;                   // fondo de las simas

// Júpiter: delante y a la izquierda al salir por la recta. Luz principal = brillo de Júpiter.
const JUP_DIR = new THREE.Vector3(0.8, 0, -0.6).normalize();
const JUP_D = 170000, JUP_R = 78000, JUP_EL = Math.tan(14 * Math.PI / 180);
export function europaSunDir() { return new THREE.Vector3(JUP_DIR.x, 0.32, JUP_DIR.z).normalize(); }

const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
let _seed = 31;
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
  const chasms = CHASMS.map(([x, y, a, b, r]) => { const c = toW([x, y]); return { x: c.x, z: c.z, a: a * K, b: b * K, cs: Math.cos(r * Math.PI / 180), sn: Math.sin(r * Math.PI / 180) }; });
  return { S, cum, total, corner, P, chasms, citadel: toW(CITADEL_PX), rings: RINGS.map((i) => fOf(P[i])) };
}

// ── Materiales de la ciudad ──
const MAT = () => {
  const facade = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.38, metalness: 0.15, emissive: 0x2c3a50 });
  const fo = { cell: 3.4, levels: 2, zone: 30, depth: 0.8, recess: 0.45, windows: { lit: 0.38, warm: [1.0, 0.72, 0.42], cool: [0.55, 0.85, 1.0], k: 2.4 } };
  facade.onBeforeCompile = (sh) => cofferPatch(sh, fo); facade.customProgramCacheKey = () => cofferKey(fo) + 'eu';
  const deep = new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 0.12, metalness: 0.85, emissive: 0x0a3a5a, emissiveIntensity: 0.6 });
  const dop = { cell: 4.2, levels: 2, zone: 26, depth: 0.6, recess: 0.3, windows: { lit: 0.55, warm: [0.4, 0.9, 1.0], cool: [0.9, 0.95, 1.0], k: 3.0 } };
  deep.onBeforeCompile = (sh) => cofferPatch(sh, dop); deep.customProgramCacheKey = () => cofferKey(dop) + 'eud';
  return {
    facade, deep,
    silver: new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.28, metalness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.45, metalness: 0.2 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffc88a, emissiveIntensity: 2.6 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x5fe0ff, emissiveIntensity: 3.0 }),
    star: new THREE.MeshStandardMaterial({ color: 0x404850, emissive: 0xeaf6ff, emissiveIntensity: 5.0 }),
    sand: sandMaterial(),
    dome: domeMaterial(),
    beam: new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  };
};

// Arenisca estratificada (referencia: interior de capas orgánicas, luz ámbar desde abajo)
function sandMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xd4ab82, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW; varying vec3 vSN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW; varying vec3 vSN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float strata = 0.5 + 0.5 * sin(vSW.y * 9.0 + sin(vSW.x * 0.05 + vSW.z * 0.04) * 3.0);
        diffuseColor.rgb *= 0.97 + 0.04 * strata;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float under = clamp(-normalize(vSN).y, 0.0, 1.0);
          totalEmissiveRadiance += vec3(1.0, 0.56, 0.26) * (0.05 + 0.55 * under * under); }`);
  };
  m.customProgramCacheKey = () => 'euSand';
  return m;
}

// Cúpula de cristal con retícula hexagonal: marco plateado, celdas de vidrio oscuro con luces cálidas dentro
function domeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.45 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDU = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vDU;
      float dh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec4 hexc(vec2 uv){ vec2 r = vec2(1.0, 1.7320508); vec2 h = r * 0.5; vec2 a = mod(uv, r) - h; vec2 b = mod(uv - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b; vec2 q = abs(gv); float d = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
        return vec4(gv, 0.5 - d, 0.0) + vec4(0.0, 0.0, 0.0, dh(floor((uv - gv) * 7.0 + 0.5))); }`)
      .replace('void main() {', 'void main() {\n  float hxF = 0.0, hxId = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec4 hx = hexc(vec2(vDU.x, vDU.y)); hxF = 1.0 - smoothstep(0.045, 0.085, hx.z); hxId = hx.w;
          diffuseColor.rgb = mix(vec3(0.3, 0.42, 0.56), vec3(0.9, 0.93, 0.97), hxF); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.05, 0.28, hxF);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float lit = step(hxId, 0.22) * (1.0 - hxF) * (0.3 + 0.7 * step(vDU.y, 3.0)); float acc = step(0.93, hxId) * (1.0 - hxF);
          totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * lit * (0.25 + 1.4 * pow(fract(hxId * 7.3), 2.0)) + vec3(0.35, 0.85, 1.0) * acc * 1.2; }`);
  };
  m.customProgramCacheKey = () => 'euDome';
  return m;
}

// Hielo: placas con grietas, líneas pardo-rojizas (lineae), paredes de sima que pasan de pardo a azul luminoso
function iceMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    const hdr = `varying vec3 vIW; varying vec3 vIN;
      float ih(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2 ih2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float inn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(ih(i), ih(i+vec2(1,0)), f.x), mix(ih(i+vec2(0,1)), ih(i+vec2(1,1)), f.x), f.y); }
      float ifb(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 4; i++) { a += inn(p) * w; p = p * 2.03 + 3.1; w *= 0.5; } return a; }
      // distancia al borde de celda de Voronoi
      float vedge(vec2 x){ vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = ih2(n + g); vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
        md = 8.0;
        for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(float(i), float(j)); vec2 o = ih2(n + g); vec2 r = g + o - f; if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
        return md; }
      // placas grandes: distancia al borde (unidades de celda) y tono de la placa
      vec2 vcell(vec2 x){ vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)); vec2 o = ih2(n + g); vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
        float id = ih(n + mg + 0.37); md = 8.0;
        for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(float(i), float(j)); vec2 o = ih2(n + g); vec2 r = g + o - f; if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
        return vec2(md, id); }`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIW; varying vec3 vIN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIW = (modelMatrix * vec4(transformed, 1.0)).xyz; vIN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${hdr}`)
      .replace('void main() {', 'void main() {\n  float iDep = 0.0, iSteep = 0.0, iGlint = 0.0, iStreak = 0.0, iVein = 0.0, iCrack = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vIW; vec3 n = normalize(vIN);
          float camD = length(cameraPosition - p);
          iSteep = 1.0 - smoothstep(0.28, 0.7, n.y);
          iDep = clamp(-p.y / 300.0, 0.0, 1.0);
          float f1 = ifb(p.xz * 0.004), f2 = ifb(p.xz * 0.045);
          vec2 vPl = vcell(p.xz / 78.0 + (vec2(ifb(p.xz * 0.006), ifb(p.xz * 0.006 + 5.0)) - 0.5) * 0.5); vPl.x *= 78.0;
          // hielo blanco-azulado, cada placa con su tono
          vec3 ice = mix(vec3(0.5, 0.6, 0.74), vec3(0.8, 0.86, 0.94), f1 * 0.6 + vPl.y * 0.4);
          ice *= 0.93 + 0.1 * f2;
          // red de vetas claras (hielo recongelado, como cristal)
          float fade = 1.0 - smoothstep(60.0, 260.0, camD);
          vec2 wq = p.xz / 13.0 + vec2(ifb(p.xz * 0.04), ifb(p.xz * 0.04 + 9.0)) * 1.3;
          float v1 = vedge(wq), v2 = fade > 0.0 ? vedge(p.xz / 2.4 + 31.0) : 1.0;
          iVein = (1.0 - smoothstep(0.0, 0.07, v1)) * 0.9 * mix(1.0, 0.2, smoothstep(250.0, 1100.0, camD)) + (1.0 - smoothstep(0.0, 0.05, v2)) * 0.3 * fade;
          ice = mix(ice, vec3(0.95, 0.98, 1.0), iVein * 0.8);
          ice = mix(ice, ice * vec3(0.78, 0.86, 0.98), smoothstep(0.1, 0.45, v1) * 0.4);
          // grietas grandes entre placas: núcleo pardo-rojizo con un filo claro
          float ed = vPl.x + (inn(p.xz * 0.12) - 0.5) * 1.4;
          float subOn = step(0.55, inn(p.xz * 0.004 + 2.0));
          vec2 sub = subOn > 0.5 ? vcell(p.xz / 31.0 + 11.0) : vec2(9.0);
          ed = min(ed, mix(99.0, sub.x * 31.0 + 0.35, subOn));
          iCrack = (1.0 - smoothstep(0.5, 1.3, ed)) * mix(1.0, 0.45, smoothstep(250.0, 1500.0, camD));
          float lip = smoothstep(0.9, 1.6, ed) - smoothstep(2.0, 4.0, ed);
          ice = mix(ice, vec3(0.97, 0.98, 1.0), lip * 0.55);
          ice = mix(ice, mix(vec3(0.5, 0.26, 0.18), vec3(0.72, 0.44, 0.32), inn(p.xz * 0.6)), iCrack);
          // grietas secundarias finas
          float ve2 = fade > 0.0 ? vedge(p.xz / 26.0 + 17.0 + vec2(f1)) : 1.0;
          ice = mix(ice, vec3(0.55, 0.42, 0.4), (1.0 - smoothstep(0.0, 0.01, ve2)) * 0.35 * fade);
          // paredes de las simas: hielo columnar claro arriba, azul cada vez más luminoso abajo, vetas pardas
          iStreak = inn(vec2(dot(p.xz, vec2(0.23, 0.19)) * 1.6, p.y * 0.012));
          float colm = inn(vec2(dot(p.xz, vec2(0.37, -0.29)) * 0.9, 0.0));
          vec3 wall = mix(vec3(0.78, 0.85, 0.93), vec3(0.18, 0.5, 0.78), smoothstep(0.02, 0.28, iDep));
          wall *= 0.7 + 0.45 * iStreak * (0.6 + 0.4 * colm);
          wall = mix(wall, vec3(0.5, 0.28, 0.2), smoothstep(0.72, 0.9, inn(vec2(dot(p.xz, vec2(0.11, 0.07)), p.y * 0.03))) * 0.55 * (1.0 - smoothstep(0.1, 0.4, iDep)));
          diffuseColor.rgb = mix(ice, wall, iSteep);
          iGlint = step(0.9985, ih(floor(p.xz * 2.3))) * (1.0 - iSteep) * fade;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(mix(0.32, 0.18, iVein), 0.6, iCrack); roughnessFactor = mix(roughnessFactor, 0.2, iSteep);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.08, 0.5, 1.0) * smoothstep(0.02, 0.7, iDep) * (0.5 + 0.9 * iStreak) * 1.7;
        totalEmissiveRadiance += vec3(0.05, 0.08, 0.13) * (1.0 - iSteep) * (1.0 - iCrack);
        totalEmissiveRadiance += vec3(0.75, 0.9, 1.0) * iGlint * 1.2;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { float cd = length(cameraPosition - vIW); float k = smoothstep(80.0, 900.0, cd); reflectedLight.directSpecular *= mix(1.0, 0.04, k); reflectedLight.indirectSpecular *= mix(1.0, 0.12, k); }`);
  };
  m.customProgramCacheKey = () => 'euIce3';
  return m;
}

// Júpiter (y Io): bandas, remolinos y la Gran Mancha Roja, calculados en el fragmento; luz del Sol real por detrás
function planetMaterial(center, sunDir, kind) {
  const toV = JUP_DIR.clone().negate().setY(0).normalize(), east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toV).normalize();
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uC: { value: center }, uSun: { value: sunDir }, uV: { value: toV }, uE: { value: east }, uT: { value: 0 }, uKind: { value: kind } },
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
      uniform vec3 uC, uSun, uV, uE; uniform float uT, uKind; varying vec3 vW;
      float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float pn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(ph(i), ph(i+vec2(1,0)), f.x), mix(ph(i+vec2(0,1)), ph(i+vec2(1,1)), f.x), f.y); }
      float pf(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += pn(p) * w; p = p * 2.1 + 1.7; w *= 0.5; } return a; }
      vec3 band(float lat, float t){
        // zonas claras y cinturones (norte → sur), de los colores de las fotos de la Juno/Cassini
        vec3 zone = vec3(0.93, 0.88, 0.8), belt = vec3(0.66, 0.46, 0.33), polar = vec3(0.55, 0.56, 0.6);
        float d = lat * 57.3;
        float b = 0.0;
        b += smoothstep(4.0, 9.0, d) * (1.0 - smoothstep(16.0, 20.0, d));          // NEB
        b += smoothstep(-9.0, -5.0, -d + 0.0) * 0.0;
        b += smoothstep(-21.0, -17.0, -d) * 0.0;
        b += (smoothstep(-20.0, -16.0, d) - smoothstep(-8.0, -5.0, d)) * 0.9;       // SEB
        b += (smoothstep(24.0, 27.0, d) - smoothstep(31.0, 34.0, d)) * 0.7;        // NTB
        b += (smoothstep(-36.0, -33.0, d) - smoothstep(-29.0, -26.0, d)) * 0.6;    // STB
        b += (smoothstep(38.0, 41.0, d) - smoothstep(44.0, 47.0, d)) * 0.45;
        b += (smoothstep(-48.0, -45.0, d) - smoothstep(-42.0, -39.0, d)) * 0.4;
        b = clamp(b, 0.0, 1.0);
        vec3 c = mix(zone, belt, b * (0.75 + 0.5 * t));
        c = mix(c, vec3(0.86, 0.76, 0.6), (1.0 - smoothstep(0.0, 6.0, abs(d))) * 0.35);  // zona ecuatorial ocre
        c = mix(c, polar, smoothstep(50.0, 66.0, abs(d)));
        return c;
      }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC);
        vec3 V = normalize(cameraPosition - vW);
        float lam = dot(n, normalize(uSun));
        float day = smoothstep(-0.08, 0.25, lam);
        vec3 col;
        if (uKind < 0.5) {
          // inclinación leve del eje
          vec3 up = normalize(vec3(0.0, 1.0, 0.0) + uE * 0.1);
          float lat = asin(clamp(dot(n, up), -1.0, 1.0));
          float lon = atan(dot(n, uE), dot(n, uV)) + uT * 0.004;
          vec2 q = vec2(lon * 4.0, lat * 26.0);
          vec2 w = vec2(pf(q + vec2(uT * 0.01, 0.0)), pf(q * 1.3 + 5.2));
          float latW = lat + (w.y - 0.5) * 0.05 + (pf(vec2(lon * 14.0, lat * 90.0)) - 0.5) * 0.012;
          float t = pf(vec2(lon * 9.0 + w.x * 2.0, lat * 60.0));
          col = band(latW, t);
          // bandas finas y turbulencia de borde (muchas franjas estrechas como en las fotos)
          float fine = sin(latW * 140.0 + (w.x - 0.5) * 3.0) * 0.5 + 0.5;
          col *= 0.88 + 0.16 * fine;
          float edgeTurb = pf(vec2(lon * 22.0 + w.y * 6.0, latW * 160.0));
          col = mix(col, col * vec3(1.08, 1.02, 0.95), smoothstep(0.55, 0.8, edgeTurb) * 0.6);
          col = mix(col, col * vec3(0.8, 0.68, 0.6), smoothstep(0.6, 0.85, pf(vec2(lon * 12.0, latW * 90.0) + 4.0)) * 0.5);
          // vetas finas a lo largo de los paralelos
          col *= 0.9 + 0.2 * pf(vec2(lon * 40.0 + w.x * 4.0, latW * 400.0));
          // óvalos blancos y festones
          float ov = pf(vec2(lon * 6.0, lat * 26.0) + 13.0);
          col = mix(col, vec3(0.97, 0.95, 0.9), smoothstep(0.72, 0.8, ov) * 0.6 * step(0.25, abs(lat)));
          // Gran Mancha Roja (lat −22°)
          vec2 g = vec2((lon + 0.42) / 0.2, (lat + 0.385) / 0.085);
          float r = length(g);
          float ang = atan(g.y, g.x) + r * 2.4 - uT * 0.02;
          float sw = pf(vec2(cos(ang), sin(ang)) * r * 3.0 + 7.0);
          vec3 grs = mix(vec3(0.72, 0.36, 0.22), vec3(0.86, 0.55, 0.38), sw);
          col = mix(col, grs, (1.0 - smoothstep(0.75, 1.05, r)));
          col = mix(col, vec3(0.95, 0.9, 0.82), (smoothstep(0.95, 1.08, r) - smoothstep(1.1, 1.35, r)) * 0.55);
        } else {
          // Io: azufre amarillo con manchas pardas y blancas
          vec2 q = vec2(atan(n.z, n.x) * 3.0, asin(n.y) * 3.0);
          float a = pf(q * 2.0), b = pf(q * 7.0 + 3.0);
          col = mix(vec3(0.86, 0.76, 0.38), vec3(0.95, 0.9, 0.7), a);
          col = mix(col, vec3(0.45, 0.28, 0.16), smoothstep(0.62, 0.7, b));
        }
        float limb = pow(max(0.0, dot(n, V)), 0.35);
        vec3 c = col * (0.015 + 0.62 * day * (0.35 + 0.65 * max(lam, 0.0))) * (0.55 + 0.45 * limb);
        c += vec3(0.5, 0.6, 0.8) * pow(1.0 - max(0.0, dot(n, V)), 5.0) * 0.14 * day;     // velo azulado del limbo
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Película de luz de los anillos (lámina) — se ondula al cruzarla
function filmMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 }, uHit: { value: -10 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uHit; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        float rim = smoothstep(0.7, 1.0, r);
        float sh = 0.5 + 0.5 * sin(r * 30.0 - uT * 3.0 + sin(atan(p.y, p.x) * 6.0 + uT) * 0.6);
        float dt = uT - uHit;
        float wave = exp(-pow((r - dt * 1.4) * 9.0, 2.0)) * exp(-dt * 1.6) * step(0.0, dt);
        float a = 0.05 + 0.1 * sh * (0.3 + rim) + 0.5 * rim * rim + 1.4 * wave;
        gl_FragColor = vec4(vec3(0.3, 0.75, 1.0) * a, 1.0);
      }`,
  });
}

// Película azul que recorre la nave al pasar por un anillo
function shellMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uP: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uP; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float sweep = exp(-pow((vP.z - (1.2 - uP * 3.0)) * 3.2, 2.0));
        float lines = 0.5 + 0.5 * sin(vP.z * 40.0 - uP * 30.0);
        float a = (0.9 * f + 1.6 * sweep * (0.6 + 0.4 * lines)) * pow(1.0 - uP, 1.4);
        gl_FragColor = vec4(vec3(0.35, 0.8, 1.0) * a, 1.0);
      }`,
  });
}

const lathe = (pts, segs = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segs);

// Cúpula hexagonal sobre tambor con ventanas, linterna y aguja
function domeGeos(R, P) {
  const drumH = R * (0.18 + rnd() * 0.12);
  P.facade.push(lathe([[R * 1.02, 0], [R * 1.02, drumH], [0, drumH]], 48));
  P.silver.push(lathe([[R * 1.06, drumH - 0.6], [R * 1.08, drumH], [R * 1.0, drumH + 0.8]], 48));
  P.silver.push(lathe([[R * 1.12, 0], [R * 1.12, 1.4], [R * 1.02, 1.6]], 48));
  const NA = Math.max(16, Math.round(2 * Math.PI * R / 3.4));
  const sp = new THREE.SphereGeometry(R, 56, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  { const uv = sp.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * NA, uv.getY(i) * NA * 0.25 * 1.15); }
  sp.scale(1, 0.86, 1); sp.translate(0, drumH, 0); P.dome.push(sp);
  const top = drumH + R * 0.86;
  P.silver.push(lathe([[R * 0.12, top - 1], [R * 0.12, top + R * 0.12], [R * 0.08, top + R * 0.16], [0, top + R * 0.16]], 16));
  P.star.push(lathe([[R * 0.1, top + R * 0.03], [R * 0.1, top + R * 0.1]], 16));
  P.silver.push(lathe([[R * 0.03, top + R * 0.16], [0, top + R * 0.4]], 8));
  P.warm.push(lathe([[R * 1.025, drumH * 0.3], [R * 1.025, drumH * 0.38]], 48));
  return { top: top + R * 0.4 };
}

// Torre-faro: tambor, fuste con galerías, linterna brillante y aguja
function towerGeos(H, P) {
  const R0 = H * (0.09 + rnd() * 0.04), R1 = R0 * (0.55 + rnd() * 0.15);
  P.facade.push(lathe([[R0 * 1.4, 0], [R0 * 1.4, H * 0.12], [R0, H * 0.14], [R1 * 1.05, H * 0.62], [R1, H * 0.7], [0, H * 0.7]], 24));
  P.silver.push(lathe([[R0 * 1.55, H * 0.115], [R0 * 1.55, H * 0.13], [R0 * 1.4, H * 0.135]], 24));
  for (const f of [0.32, 0.5]) P.silver.push(lathe([[R1 * 1.5, H * f], [R1 * 1.55, H * f + 0.8], [R1 * 1.2, H * f + 1.4]], 24));
  P.silver.push(lathe([[R1 * 1.6, H * 0.7], [R1 * 1.6, H * 0.71], [R1 * 0.8, H * 0.72]], 24));
  P.star.push(lathe([[R1 * 0.75, H * 0.72], [R1 * 0.72, H * 0.8]], 16));
  P.silver.push(lathe([[R1 * 0.95, H * 0.8], [R1 * 0.6, H * 0.84], [R1 * 0.2, H * 0.88], [0.4, H], [0, H]], 16));
  P.cyan.push(lathe([[R0 * 1.42, H * 0.06], [R0 * 1.42, H * 0.075]], 24));
  return { lamp: H * 0.76, top: H };
}

// Pedestal de platos apilados (referencia de las capas): estrecho abajo, se abre hacia arriba
function vaseGeos(H, R, P) {
  const n = Math.round(H / 2.2), prof = [[R * 0.25, -4]];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), r = R * (0.25 + 0.75 * Math.pow(u, 1.7)), y = i * H / n, h = H / n;
    prof.push([r * 0.94, y], [r * 1.02, y + h * 0.35], [r, y + h * 0.75], [r * 0.95, y + h]);
  }
  prof.push([0, H]);
  P.sand.push(lathe(prof, 40));
  P.warm.push(lathe([[R * 0.6, H + 0.05], [R * 0.6, H + 0.06], [0, H + 0.06]], 24));
}

export function buildEuropa(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 31;
  const { S, cum, total, corner, chasms, citadel, rings } = layout();
  const N = S.length;
  const centroid = S.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / N);

  // ── Fisuras: grietas largas y estrechas que cruzan la llanura ──
  const fiss = [];
  for (let k = 0, tries = 0; k < 11 && tries < 80; tries++) {
    let x = centroid.x + (rnd() - 0.5) * 2800, z = centroid.z + (rnd() - 0.5) * 2000, a = rnd() * Math.PI * 2;
    const pts = [[x, z]], w = 5 + rnd() * 8;
    for (let i = 0; i < 9; i++) { a += (rnd() - 0.5) * 0.7; const l = 60 + rnd() * 90; x += Math.cos(a) * l; z += Math.sin(a) * l; pts.push([x, z]); }
    if (pts.some(([px, pz]) => Math.hypot(px - citadel.x, pz - citadel.z) < 300)) continue;
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const [px, pz] of pts) { bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); bz0 = Math.min(bz0, pz); bz1 = Math.max(bz1, pz); }
    fiss.push({ pts, w, bx0: bx0 - 30, bx1: bx1 + 30, bz0: bz0 - 30, bz1: bz1 + 30 }); k++;
  }

  // ── Suelo: llanura de hielo (las placas y grietas las dibuja el shader), montículo, simas y fisuras ──
  const surf = (x, z) => {
    const dm = Math.hypot(x - citadel.x, z - citadel.z);
    return 1.6 * (vn(x / 140, z / 140) - 0.5) + 0.35 * (vn(x / 17, z / 17) - 0.5) + (dm < 600 ? 74 * Math.exp(-((dm / 185) ** 2)) * (0.85 + 0.3 * vn(x / 40, z / 40)) : 0);
  };
  const chasmT = (x, z) => {
    let t = 0;
    for (const c of chasms) {
      const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > c.a + c.b || Math.abs(dz) > c.a + c.b) continue;
      const lx = dx * c.cs + dz * c.sn, lz = -dx * c.sn + dz * c.cs;
      const e = Math.hypot(lx / c.a, lz / c.b) + (vn(x / 45, z / 45) - 0.5) * 0.3 + (vn(x / 13, z / 13) - 0.5) * 0.07;
      t = Math.max(t, sstep(1.0, 0.93, e));
    }
    return t;
  };
  const fissT = (x, z) => {
    let t = 0;
    for (const f of fiss) {
      if (x < f.bx0 || x > f.bx1 || z < f.bz0 || z > f.bz1) continue;
      let d = Infinity;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1], vx = bx - ax, vz = bz - az;
        const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
        d = Math.min(d, Math.hypot(x - ax - vx * u, z - az - vz * u));
      }
      const w = f.w * (0.6 + 0.8 * vn(x / 60, z / 60));
      t = Math.max(t, sstep(w, w * 0.5, d));
    }
    return t;
  };
  const H = (x, z) => {
    const s0 = surf(x, z), tc = chasmT(x, z), tf = fissT(x, z);
    let y = s0;
    if (tc > 0) y = lerp(y, FLOOR + 40 * vn(x / 70, z / 70), tc);
    if (tf > 0) y = Math.min(y, lerp(s0, -170 + 30 * vn(x / 50, z / 50), tf));
    return y;
  };

  // ── Cotas: Interlagos baja de la recta por el S de Senna hasta el lago y sube por la Subida dos Boxes ──
  const g = (f, c, w) => { let d = Math.abs(f - c); d = Math.min(d, 1 - d); return Math.exp(-((d * total / w) ** 2)); };
  let y = S.map((_, i) => {
    const f = cum[i] / total;
    return 12 + 12 * g(f, 0, 700) + 5 * g(f, corner.sol, 300) - 5 * g(f, corner.lago, 380) + 7 * g(f, corner.ferradura, 260) + 5 * g(f, corner.pinheirinho, 200) - 3 * g(f, corner.mergulho, 200) + 9 * g(f, corner.arquib, 500);
  });
  for (let i = 0; i < N; i++) y[i] = Math.max(y[i], surf(S[i].x, S[i].z) + 7);
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -4; k <= 4; k++) a += y[(i + k + N) % N]; return a / 9; });

  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  const track = new Track(null, { points: pts, inSectorOrder: false, sectors: [0, 0.16, 0.33, 0.5, 0.66, 0.82] });
  const F = track.frame();
  const L = track.length;
  const trackPts = []; for (let s = 0; s < L; s += 10) { track.sample(s, F); trackPts.push([F.pos.x, F.pos.z, F.pos.y]); }
  const clear = (x, z) => { let d = Infinity; for (const [px, pz] of trackPts) d = Math.min(d, (px - x) ** 2 + (pz - z) ** 2); return Math.sqrt(d); };

  // ── Tablero: grafito y plata, quilla con luz azul (la pista flota sobre las simas) ──
  const M = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x5a6068))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xe6ecf2))),
    rib: srcMat('S6 | Ash concrete', (m) => m.color.setHex(0xc9d1da)),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0xd4dbe3)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xcfd8e2)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(0.4, 0.85, 1.0); m.emissiveIntensity = 2.4; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(M).forEach((m) => own.push(m));
  const PM = MAT(); Object.values(PM).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], rib: [], frame: [], edge: [], gate: [] };
  const city = { facade: [], deep: [], silver: [], white: [], warm: [], cyan: [], star: [], sand: [], dome: [] };
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
  parts.frame.push(sweepSeg(0, L, 6, [[-15.5, -1.6], [15.5, -1.6], [8, -5.0], [-8, -5.0]], true));
  parts.edge.push(sweepSeg(0, L, 4, [[-17.45, 1.72], [-17.45, 1.98], [-16.3, 1.98]], false), sweepSeg(0, L, 4, [[16.3, 1.98], [17.45, 1.98], [17.45, 1.72]], false));
  city.cyan.push(sweepSeg(0, L, 4, [[-12.2, -3.3], [-11.0, -4.1]], false), sweepSeg(0, L, 4, [[11.0, -4.1], [12.2, -3.3]], false));
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
  for (const sc of track.sectors) {
    const s = sc.s + (sc.id === 1 ? 6 : 0); track.sample(s, F);
    const arc = new THREE.TorusGeometry(19.5, 0.8, 8, 40, Math.PI); arc.scale(1, 0.85, 1);
    arc.applyMatrix4(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan)); arc.translate(F.pos.x, F.pos.y, F.pos.z);
    city.silver.push(arc);
    boxAt(s, 0, 15.6, 30, 0.3, 1.2, parts.gate);
  }

  // ── Arcadas bajo la pista sobre el hielo (sobre las simas no hay apoyos: flota) ──
  {
    const BAY = 34, pos = [], idx = [];
    for (const side of [-1, 1]) {
      let prev = null;
      for (let s = 0; s <= L; s += 2) {
        track.sample(s, F);
        const ex = side * 13.4, px = F.pos.x + F.right.x * ex, pz = F.pos.z + F.right.z * ex;
        const top = F.pos.y + F.right.y * ex - 4.6, gy = H(px, pz);
        const hgt = top - gy;
        if (hgt > 70 || hgt < 1.5) { prev = null; continue; }
        const u = (s % BAY) / BAY, pier = u < 0.1 || u > 0.9;
        let bot = gy - 2;
        if (!pier && hgt > 8) { const v = (u - 0.5) / 0.4; const spring = gy + hgt * 0.32, crown = top - Math.min(3, hgt * 0.18); bot = spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - v * v)); }
        const i0 = pos.length / 3; pos.push(px, top, pz, px, bot, pz);
        if (prev !== null) idx.push(prev, prev + 1, i0, i0, prev + 1, i0 + 1);
        prev = i0;
        if (Math.abs(s % BAY) < 1 && hgt > 3) boxAt(s, side * 13.4, -4.6 - hgt / 2, 3.2, hgt + 2, 3.2, city.white);
      }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    const am = PM.white.clone(); am.side = THREE.DoubleSide; own.push(am, gg);
    const mesh = new THREE.Mesh(gg, am); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
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

  // ── Gradas estratificadas junto a la salida (Arquibancadas): capas de arenisca que ondulan ──
  const sA = corner.standA * L, sB = (corner.standB < corner.standA ? corner.standB + 1 : corner.standB) * L;
  {
    const NL = 10, pos = [], idx = [];
    let outSide = 1;
    { track.sample(sA + (sB - sA) * 0.5, F); const a = F.pos.clone().addScaledVector(F.right, 60), b = F.pos.clone().addScaledVector(F.right, -60); outSide = a.distanceTo(centroid) > b.distanceTo(centroid) ? 1 : -1; }
    const rowsN = Math.round((sB - sA) / 3); let m = 0;
    for (let r = 0; r <= rowsN; r++) {
      const s = sA + (sB - sA) * r / rowsN; track.sample(s, F);
      const taper = sstep(0, 0.14, r / rowsN) * sstep(1, 0.86, r / rowsN);
      const rt = new THREE.Vector3(F.right.x, 0, F.right.z).normalize().multiplyScalar(outSide);
      const prof = [];
      const base = (o) => H(F.pos.x + rt.x * o, F.pos.z + rt.z * o);
      let d = 34, yy = base(32) - 2;
      prof.push([d - 3, yy - 1]);
      for (let k = 0; k < NL; k++) {
        const h = (0.8 + 2.4 * taper) * (k === 0 ? 1.3 : 1.0);
        const wob = 4.5 * Math.sin(s / 48 + k * 0.55) + 2.4 * Math.sin(s / 19 - k * 0.9) + 1.6 * (vn(s / 26, k * 0.7) - 0.5);
        const dk = d + wob * taper, nose = 0.6 + 1.8 * taper;
        // losa redondeada: entrante abajo, morro abombado, canto superior
        prof.push([dk + nose * 0.3, yy], [dk - nose * 0.6, yy + h * 0.22], [dk - nose, yy + h * 0.5], [dk - nose * 0.7, yy + h * 0.8], [dk + 0.2, yy + h]);
        yy += h; d += 2.6 + 1.6 * taper;
      }
      prof.push([d + 3, yy], [d + 7, yy - 2.5], [d + 16, base(d + 16) - 3]);
      m = prof.length;
      for (const [o, hh] of prof) pos.push(F.pos.x + rt.x * o, hh, F.pos.z + rt.z * o);
    }
    for (let r = 0; r < rowsN; r++) for (let k = 0; k < m - 1; k++) { const a = r * m + k, b = a + 1, c = a + m, dd = c + 1; if (outSide > 0) idx.push(a, b, c, b, dd, c); else idx.push(a, c, b, b, c, dd); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    city.sand.push(gg);
    // pedestales de platos y faroles cálidos a lo largo de la grada (lado de dentro y detrás)
    for (let s = sA + 60; s < sB - 40; s += 70 + rnd() * 40) {
      track.sample(s, F);
      const rt = new THREE.Vector3(F.right.x, 0, F.right.z).normalize().multiplyScalar(-outSide);
      const o = 46 + rnd() * 30, x = F.pos.x + rt.x * o, z = F.pos.z + rt.z * o;
      if (clear(x, z) < 38 || chasmT(x, z) > 0) continue;
      const hh = 14 + rnd() * 18, R = 8 + rnd() * 7, gy = H(x, z);
      const P2 = { sand: [], warm: [] }; vaseGeos(hh, R, P2);
      for (const [k, l] of Object.entries(P2)) for (const gq of l) { gq.translate(x, gy, z); city[k].push(gq); }
    }
  }

  // ── Ciudadela sobre el montículo: torres-faro y cúpulas ──
  const lamps = [];
  const placeTower = (x, z, Hh) => { const gy = H(x, z) - 1; const P2 = { facade: [], silver: [], star: [], cyan: [] }; const t = towerGeos(Hh, P2); for (const [k, l] of Object.entries(P2)) for (const gq of l) { gq.translate(x, gy, z); city[k].push(gq); } lamps.push([x, gy + t.lamp, z, Hh]); };
  const placeDome = (x, z, R) => { const gy = H(x, z) - 0.5; const P2 = { facade: [], silver: [], dome: [], star: [], warm: [] }; domeGeos(R, P2); for (const [k, l] of Object.entries(P2)) for (const gq of l) { gq.translate(x, gy, z); city[k].push(gq); } };
  const placed = [];
  const freeAt = (x, z, r, margin) => clear(x, z) > r + margin && placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r + 8) && chasmT(x, z) === 0 && [0, 1, 2, 3].every((k) => chasmT(x + Math.cos(k * 1.57) * r, z + Math.sin(k * 1.57) * r) === 0 && fissT(x + Math.cos(k * 1.57) * r, z + Math.sin(k * 1.57) * r) === 0) && fissT(x, z) === 0;
  {
    const cx = citadel.x, cz = citadel.z, cl = clear(cx, cz);
    const sc = Math.min(1.25, Math.max(0.7, (cl - 70) / 180));
    placeTower(cx, cz, 210 * sc); placed.push([cx, cz, 24 * sc]);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + 0.3, r = 52 * sc; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; placeTower(x, z, (80 + rnd() * 50) * sc); placed.push([x, z, 12 * sc]); }
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = (105 + rnd() * 25) * sc, R = (16 + rnd() * 12) * sc; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (freeAt(x, z, R, 30)) { placeDome(x, z, R); placed.push([x, z, R]); } }
  }
  // cúpulas y torres por la llanura cercana
  let nDome = 0, nTower = 0;
  for (let tries = 0; tries < 900 && (nDome < 16 || nTower < 26); tries++) {
    const a = rnd() * Math.PI * 2, rr = 300 + Math.pow(rnd(), 0.8) * 1500;
    const x = centroid.x + Math.cos(a) * rr * 1.25, z = centroid.z + Math.sin(a) * rr;
    if (Math.hypot(x - citadel.x, z - citadel.z) < 260) continue;
    if (nDome < 16 && rnd() < 0.45) { const R = 20 + rnd() * 32; if (freeAt(x, z, R, 40)) { placeDome(x, z, R); placed.push([x, z, R]); nDome++; } }
    else if (nTower < 26) { const Hh = 50 + rnd() * 90; if (freeAt(x, z, 14, 36)) { placeTower(x, z, Hh); placed.push([x, z, 14]); nTower++; } }
  }
  // asentamientos lejanos hacia el horizonte (sobre todo bajo Júpiter)
  for (let k = 0; k < 60; k++) {
    const toward = rnd() < 0.6, a = toward ? Math.atan2(JUP_DIR.z, JUP_DIR.x) + (rnd() - 0.5) * 1.6 : rnd() * Math.PI * 2;
    const rr = 2600 + Math.pow(rnd(), 0.7) * 9000, x = centroid.x + Math.cos(a) * rr, z = centroid.z + Math.sin(a) * rr;
    if (rnd() < 0.5) { const P2 = { facade: [], silver: [], dome: [], star: [], warm: [] }; domeGeos(30 + rnd() * 60, P2); for (const [kk, l] of Object.entries(P2)) for (const gq of l) { gq.translate(x, surf(x, z), z); city[kk].push(gq); } }
    else { const Hh = 90 + rnd() * 200, P2 = { facade: [], silver: [], star: [], cyan: [] }; const t = towerGeos(Hh, P2); for (const [kk, l] of Object.entries(P2)) for (const gq of l) { gq.translate(x, surf(x, z), z); city[kk].push(gq); } lamps.push([x, surf(x, z) + t.lamp, z, Hh]); }
  }

  // ── Ciudad azul dentro de las simas: fustes de cristal con discos, haces de luz ──
  const beams = [];
  for (const c of chasms) {
    const n = Math.round((c.a * c.b) / 2600);
    for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.8;
      const lx = Math.cos(a) * r * c.a, lz = Math.sin(a) * r * c.b;
      const x = c.x + lx * c.cs - lz * c.sn, z = c.z + lx * c.sn + lz * c.cs;
      const R = 6 + rnd() * 9;
      if ([0, 1, 2, 3, 4, 5].some((q) => chasmT(x + Math.cos(q * 1.05) * R * 2.6, z + Math.sin(q * 1.05) * R * 2.6) < 0.999)) continue;
      const top = -30 - rnd() * 140;
      city.deep.push(lathe([[R, FLOOR - 40], [R, top], [R * 0.6, top + 6], [0, top + 6]], 20).translate(x, 0, z));
      const nd = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < nd; i++) {
        const yy = top - 12 - i * (40 + rnd() * 50), rd = R * (1.8 + rnd() * 1.2);
        city.silver.push(lathe([[R, yy - 4], [rd * 0.9, yy - 3], [rd, yy - 0.8], [rd * 0.98, yy + 0.6], [R, yy + 0.6]], 32).translate(x, 0, z));
        city[i % 2 ? 'warm' : 'cyan'].push(lathe([[rd * 1.005, yy - 1.6], [rd * 1.005, yy - 0.9]], 32).translate(x, 0, z));
      }
      if (rnd() < 0.15) beams.push([x, top + 6, z]);
      k++;
    }
  }

  // ── Mezcla por material ──
  for (const [k, list] of Object.entries(city)) {
    if (!list.length) continue;
    const mg = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    const mesh = new THREE.Mesh(mg, PM[k]); mesh.castShadow = !['warm', 'cyan', 'star', 'deep'].includes(k); mesh.receiveShadow = true; world.add(mesh); own.push(mg);
  }
  // haces de luz que suben de las simas
  {
    const geos = beams.map(([x, yy, z]) => new THREE.CylinderGeometry(1.6, 4.5, 700, 10, 1, true).translate(x, yy + 350, z));
    if (false && geos.length) { const gg = mergeGeometries(geos, false); const bm = new THREE.Mesh(gg, PM.beam); bm.frustumCulled = false; world.add(bm); own.push(gg); }
  }
  // destellos en las linternas de las torres
  {
    const c = document.createElement('canvas'); c.width = c.height = 64; const gx = c.getContext('2d');
    const gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(200,235,255,0.8)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
    gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); own.push(tex);
    const pos = new Float32Array(lamps.length * 3); lamps.forEach(([x, yy, z], i) => pos.set([x, yy, z], i * 3));
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ size: 26, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xd8f0ff, fog: false });
    const pt = new THREE.Points(gg, pm); pt.frustumCulled = false; world.add(pt); own.push(gg, pm);
  }

  // ── Bloques de hielo en los bordes de las simas ──
  const tp = []; for (let s = 0; s < L; s += 4) { track.sample(s, F); tp.push([F.pos.x, F.pos.z]); }
  {
    const geo = new THREE.IcosahedronGeometry(1, 1); own.push(geo);
    { const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.7 + 0.5 * h2(v.x * 3 + v.y, v.z * 3 - v.y); p.setXYZ(i, v.x * k, v.y * k * 1.3, v.z * k); } geo.computeVertexNormals(); }
    const mat = new THREE.MeshStandardMaterial({ color: 0xeaf2fb, roughness: 0.22, metalness: 0.0, flatShading: true, emissive: 0x10263a }); own.push(mat);
    const list = [];
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const [x, z] of tp) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
    for (let x = bx0 - 300; x < bx1 + 300; x += 7) for (let z = bz0 - 300; z < bz1 + 300; z += 7) {
      const jx = x + (rnd() - 0.5) * 6, jz = z + (rnd() - 0.5) * 6;
      if (chasmT(jx, jz) > 0 || fissT(jx, jz) > 0) continue;
      let rim = 0; for (const [dx, dz] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) rim = Math.max(rim, chasmT(jx + dx, jz + dz), fissT(jx + dx, jz + dz) * (rnd() < 0.12 ? 1 : 0));
      if (rim < 0.5 || rnd() < 0.15) continue;
      if (clear(jx, jz) < 24) continue;
      const r = 1.8 + Math.pow(rnd(), 2) * 7.5;
      list.push([jx, surf(jx, jz) + r * 0.25, jz, r]);
    }
    const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, yy, z, r], i) => { q.setFromEuler(e.set((rnd() - 0.5) * 0.6, rnd() * 6.28, (rnd() - 0.5) * 0.6)); m4.compose(new THREE.Vector3(x, yy, z), q, new THREE.Vector3(r, r * (0.6 + rnd() * 0.8), r)); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); world.add(im);
  }

  // ── Suelo: malla fina alrededor de la pista + llanura que llega al horizonte ──
  const iceMat = iceMaterial(); own.push(iceMat);
  let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity; for (const [x, z] of tp) { ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x); iz0 = Math.min(iz0, z); iz1 = Math.max(iz1, z); }
  ix0 -= 520; ix1 += 520; iz0 -= 520; iz1 += 520;
  {
    const RES = 6, nx = Math.ceil((ix1 - ix0) / RES), nz = Math.ceil((iz1 - iz0) / RES);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), idx = new Uint32Array(nx * nz * 6);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = ix0 + i * RES, z = iz0 + j * RES, k = j * (nx + 1) + i, o = k * 3; pos[o] = x; pos[o + 1] = H(x, z); pos[o + 2] = z; }
    let q = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setIndex(new THREE.BufferAttribute(idx, 1)); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, iceMat); mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }
  {
    const axis = (a0, a1) => { const v = []; for (let x = a0, st = 40; x > -200000; st *= 1.13) { v.unshift(x); x -= st; } v.unshift(-200000); for (let x = a0 + 120; x < a1; x += 120) v.push(x); for (let x = a1, st = 40; x < 200000; st *= 1.13) { v.push(x); x += st; } v.push(200000); return v; };
    const X = axis(ix0, ix1), Z = axis(iz0, iz1), nx = X.length, nz = Z.length;
    const pos = new Float32Array(nx * nz * 3), idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X[i], z = Z[j], o = (j * nx + i) * 3, far = Math.hypot(x - centroid.x, z - centroid.z);
      pos[o] = x; pos[o + 2] = z; pos[o + 1] = surf(x, z) - 0.35 + (far > 4000 ? 40 * (vn(x / 3000, z / 3000) - 0.5) * sstep(4000, 12000, far) : 0);
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
      if (cx > ix0 + 8 && cx < ix1 - 8 && cz > iz0 + 8 && cz < iz1 - 8) continue;
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, iceMat); mesh.receiveShadow = true; mesh.frustumCulled = false; world.add(mesh); own.push(gg);
  }

  // ── Júpiter, Io y estrellas ──
  const realSun = JUP_DIR.clone().negate().add(new THREE.Vector3(0, 0.18, 0)).add(new THREE.Vector3(-JUP_DIR.z, 0, JUP_DIR.x).multiplyScalar(-0.42)).normalize();
  const jc = centroid.clone().addScaledVector(JUP_DIR, JUP_D).setY(JUP_D * JUP_EL);
  const jm = planetMaterial(jc, realSun, 0); own.push(jm);
  const jup = new THREE.Mesh(new THREE.SphereGeometry(JUP_R, 128, 96), jm); jup.position.copy(jc); jup.scale.y = 0.935; jup.frustumCulled = false; world.add(jup); own.push(jup.geometry);
  const ioC = centroid.clone().add(new THREE.Vector3(-JUP_DIR.z, 0, JUP_DIR.x).multiplyScalar(-90000)).addScaledVector(JUP_DIR, 140000).setY(60000);
  const im2 = planetMaterial(ioC, realSun, 1); own.push(im2);
  const io = new THREE.Mesh(new THREE.SphereGeometry(2300, 48, 32), im2); io.position.copy(ioC); io.frustumCulled = false; world.add(io); own.push(io.geometry);
  {
    const n = 5200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const band = new THREE.Vector3(0.3, 0.55, 0.78).normalize();
    for (let i = 0; i < n; i++) {
      let v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 0.15, rnd() * 2 - 1).normalize();
      if (i % 3 === 0) { v.addScaledVector(band, -v.dot(band) * (0.9 + rnd() * 0.1)).normalize(); if (v.y < -0.05) v.y = -v.y; }   // vía láctea
      v.multiplyScalar(300000);
      pos.set([centroid.x + v.x, v.y, centroid.z + v.z], i * 3);
      const b = 0.35 + Math.pow(rnd(), 5) * 2.6, tint = rnd();
      col.set(tint < 0.2 ? [b * 0.8, b * 0.88, b] : tint > 0.88 ? [b, b * 0.88, b * 0.72] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const st = new THREE.Points(gg, sm); st.frustumCulled = false; st.renderOrder = -2; world.add(st); own.push(gg, sm);
  }

  // ── Anillos de carrera ──
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.32, metalness: 0.9 }); own.push(ringMat);
  const gates = [];
  const RR = 30, RC = 8;
  for (const f of rings) {
    const s = f * L; track.sample(s, F);
    const grp = new THREE.Group();
    const basis = new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan);
    grp.quaternion.setFromRotationMatrix(basis); grp.position.copy(F.pos).addScaledVector(F.up, RC);
    const gp = { metal: [], silver: [], cyan: [], star: [] };
    gp.metal.push(new THREE.TorusGeometry(RR, 2.6, 14, 120));
    gp.cyan.push(new THREE.TorusGeometry(RR - 2.7, 0.42, 8, 120));
    gp.star.push(new THREE.TorusGeometry(RR + 2.9, 0.22, 6, 120));
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2, big = k % 3 === 0;
      const b = new THREE.BoxGeometry(big ? 7.6 : 6.4, big ? 4.2 : 2.6, big ? 6.4 : 5.6);
      b.rotateZ(a); b.translate(Math.cos(a) * RR, Math.sin(a) * RR, 0);
      (big ? gp.silver : gp.metal).push(b);
      if (big) gp.cyan.push(new THREE.BoxGeometry(0.5, 2.6, 6.6).rotateZ(a).translate(Math.cos(a) * (RR - 3.75), Math.sin(a) * (RR - 3.75), 0));
    }
    const mats = { metal: ringMat, silver: PM.silver, cyan: PM.cyan, star: PM.star };
    for (const [k, l] of Object.entries(gp)) { const mg = mergeGeometries(norm(l), false); l.forEach((gq) => gq.dispose()); const mesh = new THREE.Mesh(mg, mats[k]); mesh.castShadow = k === 'metal' || k === 'silver'; mesh.receiveShadow = true; grp.add(mesh); own.push(mg); }
    const fm = filmMaterial(); own.push(fm);
    const film = new THREE.Mesh(new THREE.CircleGeometry(RR - 2.6, 72), fm); film.renderOrder = 3; grp.add(film); own.push(film.geometry);
    world.add(grp);
    gates.push({ s, film: fm });
  }

  // ── Película azul sobre las naves que cruzan un anillo ──
  const shellGeo = new THREE.SphereGeometry(1, 28, 18); own.push(shellGeo);
  const shells = new Map(), prevD = new Map();
  const shellFor = (sh) => {
    let e = shells.get(sh);
    if (!e) {
      const m = shellMaterial(); own.push(m);
      const mesh = new THREE.Mesh(shellGeo, m); mesh.frustumCulled = false; mesh.renderOrder = 4;
      mesh.scale.set(sh.halfWidthGeo * 1.25, sh.size.y * 0.8, sh.length * 0.62);
      mesh.position.set(0, sh.bottom + sh.size.y * 0.5, 0);
      (sh.body || sh.root).add(mesh);
      e = { mesh, m, p: 1 }; shells.set(sh, e);
    }
    return e;
  };

  const fx = {
    t: 0, gates,
    update(dt) {
      this.t += dt;
      jm.uniforms.uT.value = this.t;
      for (const gt of gates) gt.film.uniforms.uT.value = this.t;
      for (const e of shells.values()) { if (e.p < 1) { e.p = Math.min(1, e.p + dt / 1.15); e.m.uniforms.uP.value = e.p; } e.mesh.visible = e.p < 1; }
    },
    // cruce de anillos: devuelve al llamador cada nave que pasa por uno
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevD.delete(sh); continue; }
        let pd = prevD.get(sh); if (!pd) { pd = gates.map(() => null); prevD.set(sh, pd); }
        gates.forEach((gt, i) => {
          const d = track.delta(sh.s, gt.s);
          if (pd[i] !== null && pd[i] > 0 && d <= 0 && d > -40) {
            gt.film.uniforms.uHit.value = this.t;
            const e = shellFor(sh); e.p = 0; e.m.uniforms.uP.value = 0; e.mesh.visible = true;
            onPass?.(sh);
          }
          pd[i] = d;
        });
      }
    },
    reset() { prevD.clear(); for (const e of shells.values()) { e.p = 1; e.mesh.visible = false; } },
  };

  // Intro: Júpiter sobre la llanura y la ciudadela, vuelo rasante sobre la sima de Senna y bajada a la parrilla
  track.sample(0, F); const grid = F.pos.clone(); const gridTan = F.tan.clone();
  const side = new THREE.Vector3(-JUP_DIR.z, 0, JUP_DIR.x);
  const senna = new THREE.Vector3(chasms[0].x, 0, chasms[0].z);
  const introKeys = () => [
    [0.0, centroid.clone().addScaledVector(JUP_DIR, -1500).addScaledVector(side, 500).setY(260), centroid.clone().addScaledVector(JUP_DIR, 4000).setY(1300), 52],
    [4.2, citadel.clone().addScaledVector(JUP_DIR, -420).addScaledVector(side, -260).setY(120), senna.clone().setY(-40), 54],
    [7.4, senna.clone().lerp(centroid, 0.12).setY(75), grid.clone().setY(grid.y + 4), 56],
    [9.5, grid.clone().addScaledVector(gridTan, -180).setY(grid.y + 55), grid.clone(), 60],
  ];

  let ymin = Infinity, ymax = -Infinity; for (const v of y) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
  console.info(`[SRS] EUROPA: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · cúpulas ${nDome} · torres ${nTower} · faros ${lamps.length} · anillos ${gates.length} · fisuras ${fiss.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: H, tunnel: false, bridges: 0, introKeys, fx };
}
