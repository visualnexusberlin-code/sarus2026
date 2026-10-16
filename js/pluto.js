// VIRGIL-CTHULHU ABYSS · Plutón, nodo 13, el último de la ruta. Trazado propio (diseño de Dear), ~9 km, gravedad 0,06 g.
// En Belton Regio (antes Cthulhu Macula, «la Ballena»), la gran región ecuatorial oscura y rojiza de tolinas:
//   BELTON STRAIGHT   recta de salida y llegada sobre el hielo manchado de rojo, Caronte en el cielo
//   VIRGIL FOSSAE     la fosa: corredor rápido entre paredes, bajando con ondulaciones; respiraderos criovolcánicos
//   CTHULHU MINES     galerías mineras bajo la fosa: escala colosal, casi a oscuras (la luz de las naves cuenta)
//   ELLIOT RIM        salida por la pared norte del cráter Elliot (la fosa corta su borde) y curva rápida por dentro
//   ELLIOT BOWL       cuenco técnico: paredes interiores, eses en el fondo y el pico central
//   THE CLIMB         rampa a ~52° por la pared sur hasta el borde y vuelta a la superficie
//   WHALE BACK        cierre ondulante sobre la superficie rojiza antes de la recta final
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { buildRaceRings } from './rings.js';
import { QUALITY } from './quality.js';

// Planta en el sentido de carrera (x este, z sur), en metros antes de escalar, con la cota de cada punto.
// 0 = línea de meta, en la recta de Belton (hacia el oeste)
const PLAN = [
  // recta de salida sobre Belton Regio, hacia el oeste
  [0, 0, 0], [-500, 0, 0], [-900, -10, 5],
  // curva amplia hacia el norte
  [-1180, -90, 15], [-1290, -300, 30], [-1200, -560, 10], [-950, -800, -20],
  // VIRGIL FOSSAE: la fosa, hacia el este, bajando con ondulaciones
  [-600, -1000, -90], [-250, -1120, -140], [150, -1210, -230],
  // CTHULHU MINES: galerías bajo la fosa
  [550, -1260, -360], [950, -1270, -440], [1250, -1215, -380],
  // ELLIOT: sale por la pared norte del cráter y sigue el borde por dentro
  [1500, -1160, -150], [1800, -1190, -170], [2080, -1010, -210],
  // cuenco técnico: baja por la pared este, eses en el fondo, sube al pico central y a las paredes
  [2200, -700, -320], [2030, -470, -345], [1780, -620, -190], [1560, -760, -345], [1400, -560, -170], [1560, -330, -345],
  // THE CLIMB: rampa por la pared sur hasta el borde y vuelta a la superficie
  [1720, -150, -230], [1780, 60, 70], [1660, 260, 20],
  // WHALE BACK: cierre ondulante sobre la superficie rojiza y recta final
  [1350, 300, 45], [1000, 180, -10], [650, 60, 25], [300, 0, 0],
];
export const TRI = { SCALE: 0.94, YS: 1.0, MARK: { loop: 3, fossa: 7, mine: 10, rim: 13, bowl: 16, climb: 22, top: 23, close: 25, final: 27 } };
// cráter Elliot (antes de escalar): centro, radio del fondo, radio del borde, cotas; pico central
const ELLIOT = { x: 1800, z: -680, R0: 380, RR: 650, floor: -345, rim: 60, peak: 170, peakR: 190 };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz; const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); return lerp(lerp(h2(ix, iz), h2(ix + 1, iz), ux), lerp(h2(ix, iz + 1), h2(ix + 1, iz + 1), ux), uz); }
function fbm(x, z, o = 4) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += vn(x, z) * w; t += w; x = x * 2.03 + 3.1; z = z * 2.03 + 1.7; w *= 0.5; } return a / t; }
let _seed = 1;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };

export function triPlan(step = 4, scale = TRI.SCALE) {
  const C = PLAN.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale));
  const cr = new THREE.CatmullRomCurve3(C, true, 'centripetal');
  let P = cr.getSpacedPoints(4000); P.pop();
  const sm = (arr, W, passes) => { let a = arr; for (let p = 0; p < passes; p++) { const n = a.length; a = a.map((_, i) => { const v = new THREE.Vector3(); for (let k = -W; k <= W; k++) v.add(a[(i + k + n) % n]); return v.multiplyScalar(1 / (2 * W + 1)); }); } return a; };
  P = sm(P, 5, 5);
  const c2 = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const L = c2.getLength(), N = Math.round(L / step);
  let S = c2.getSpacedPoints(N); S.pop();
  let k0 = 0, bd = Infinity; S.forEach((p, i) => { const d = p.distanceToSquared(C[0]); if (d < bd) { bd = d; k0 = i; } });
  S = [...S.slice(k0), ...S.slice(0, k0)];
  const cum = [0]; for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + S[i].distanceTo(S[i - 1]));
  const total = cum[cum.length - 1] + S[0].distanceTo(S[S.length - 1]);
  // distancia en planta de cada punto de control (en orden: el más cercano a partir del anterior)
  const dC = []; let from = 0;
  C.forEach((c, ci) => { let b = from, bd2 = Infinity; for (let i = from; i < S.length; i++) { const d = S[i].distanceToSquared(c); if (d < bd2) { bd2 = d; b = i; } } dC.push(ci === 0 ? 0 : cum[b]); from = ci === 0 ? 0 : b; });
  return { S, cum, total, dC };
}

// Cotas: interpolación lineal entre los puntos de control (por distancia en planta) y suavizado (la pendiente no se aplana en cada punto)
export function triLayout(scale = TRI.SCALE, ys = TRI.YS) {
  const { S, cum, total, dC } = triPlan(4, scale);
  const N = S.length;
  const keys = PLAN.map((p, i) => [dC[i], p[2] * ys]).sort((a, b) => a[0] - b[0]);
  keys.push([total, keys[0][1]]);
  const yAt = (d) => { for (let i = 1; i < keys.length; i++) if (d <= keys[i][0]) { const [a, ya] = keys[i - 1], [b, yb] = keys[i]; const t = (d - a) / Math.max(1e-6, b - a); return lerp(ya, yb, t); } return keys[0][1]; };
  let y = cum.map(yAt);
  for (let pass = 0; pass < 4; pass++) y = y.map((_, i) => { let a = 0; for (let k = -13; k <= 13; k++) a += y[(i + k + N) % N]; return a / 27; });
  const pts = []; for (let i = 0; i < N; i += 2) pts.push(new THREE.Vector3(S[i].x, y[i], S[i].z));
  return { S, cum, total, dC, y, pts };
}


// ─────────────────────────────────────────────────────────────
//  Terreno de Belton Regio: llanura antigua con cráteres, grietas, la fosa Virgil y el cráter Elliot
// ─────────────────────────────────────────────────────────────
function makeCraters(n, seed, box, rMin, rMax) {
  let sd = seed; const r1 = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const out = [];
  for (let i = 0; i < n; i++) { const r = rMin + Math.pow(r1(), 2.4) * (rMax - rMin); out.push({ x: lerp(box[0], box[1], r1()), z: lerp(box[2], box[3], r1()), r, dep: Math.min(0.16 * r, 70), rim: 0.05 * r }); }
  return out;
}
function craterSum(list, x, z) {
  let h = 0;
  for (const c of list) {
    const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > c.r * 1.7 || Math.abs(dz) > c.r * 1.7) continue;
    const d = Math.hypot(dx, dz) / c.r;
    if (d < 1) h += c.dep * (d * d - 1) * (1 - 0.3 * d * d);
    h += c.rim * Math.exp(-(((d - 1) / 0.24) ** 2));
  }
  return h;
}

const NOISE = /* glsl */`
  float tH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(tH(i), tH(i+vec2(1,0)), f.x), mix(tH(i+vec2(0,1)), tH(i+vec2(1,1)), f.x), f.y); }
  float tF(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += tN(p) * w; p = p * 2.03 + vec2(1.7, 9.2); w *= 0.5; } return a; }
  float tVor(vec2 p, float C){ vec2 g = floor(p / C); float d1 = 1e9, d2 = 1e9;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = g + vec2(float(i), float(j));
      vec2 q = (c + 0.15 + 0.7 * vec2(tH(c), tH(c + vec2(3.1, 7.7)))) * C; float d = length(p - q);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return (d2 - d1) / C; }
`;

// Hielo de Tritón: llanura de nitrógeno rosada y clara; cantalupo gris verdoso con bordes claros; vetas oscuras de los géiseres

// Belton Regio: tolinas rojo profundo y pardo, parches de hielo claro y azulado, crestas brillantes (grietas heladas) y hoyos
function groundMaterial(EL) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEl = { value: new THREE.Vector4(EL.x, EL.z, EL.R0, EL.RR) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec3 vGN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGW; varying vec3 vGN; uniform vec4 uEl;
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  float gBump = 0.0; float gIce = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vGW.xz;
          float aa = clamp(1.0 - length(fwidth(p)) / 8.0, 0.0, 1.0);
          float a = tF(p / 2200.0), b = tF(p / 260.0 + 3.0), c = tF(p / 14.0 + 7.0);
          // tolinas: rojo profundo, pardo y naranja quemado
          vec3 col = mix(vec3(0.24, 0.06, 0.035), vec3(0.5, 0.15, 0.07), smoothstep(0.25, 0.8, a * 0.55 + b * 0.45));
          col = mix(col, vec3(0.62, 0.3, 0.16), smoothstep(0.66, 0.85, tF(p / 600.0 + 9.0)) * 0.6);
          col *= 0.82 + 0.3 * c * aa + 0.15 * (1.0 - aa);
          // hielo: en las laderas empinadas (escarcha en las paredes de la fosa y del cráter) y en parches sueltos, claro y azulado
          float steep = 1.0 - smoothstep(0.55, 0.85, vGN.y);
          float iceP = smoothstep(0.78, 0.84, tF(p / 180.0 + 2.0)) * 0.55;
          iceP *= clamp(1.0 - length(fwidth(p)) / 60.0, 0.0, 1.0);          // de lejos los parches pequeños no agrisan el rojo
          gIce = clamp(steep * (0.55 + 0.45 * tN(p / 30.0)) + iceP, 0.0, 1.0);
          vec3 ice = mix(vec3(0.82, 0.8, 0.76), vec3(0.55, 0.68, 0.86), smoothstep(0.5, 0.8, tF(p / 900.0 + 4.0)));
          ice *= 0.85 + 0.2 * c;
          col = mix(col, ice, gIce * 0.85);
          // crestas brillantes: grietas heladas finas (como en la referencia)
          vec2 wp = p + (vec2(tF(p / 300.0), tF(p / 300.0 + 5.0)) - 0.5) * 220.0;
          float cr = tVor(wp, 380.0);
          float line = (1.0 - smoothstep(0.0, 0.012, cr)) * smoothstep(0.55, 0.7, tF(p / 1500.0 + 1.0));
          col = mix(col, vec3(0.95, 0.9, 0.82), line * 0.85 * aa);
          // cráter Elliot: el fondo con hielo más limpio, el borde claro
          float re = length(p - uEl.xy);
          col = mix(col, vec3(0.7, 0.66, 0.62), smoothstep(uEl.w - 20.0, uEl.w, re) * (1.0 - smoothstep(uEl.w, uEl.w + 40.0, re)) * 0.5);
          gBump = b * 3.0 + c * 1.4 * aa + line * 2.0;
          diffuseColor.rgb = col;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.45, gIce);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(gBump), hy = dFdy(gBump);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.035, 0.04);');
  };
  m.customProgramCacheKey = () => 'pluGround';
  return m;
}

// Roca de las minas: hielo de agua sucio de tolinas (pardo rojizo oscuro) en bancos horizontales, escarcha en vetas,
// marcas de las rozadoras; filas de lámparas en algunos labios. uv.x: índice del punto del perfil · uv.y: recorrido (m)
function strataMaterial(uni, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uni.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSu; varying vec3 vSW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSu = uv; vSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vSu; varying vec3 vSW; uniform float uT;
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  vec3 sGlow = vec3(0.0);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float y = vSW.y + (tF(vSW.xz / 140.0) - 0.5) * 14.0;
          float fy = length(fwidth(vSW));
          float aa = clamp(1.3 - fy * 0.6, 0.0, 1.0);
          float band = tN(vec2(y / 3.2, 0.5)), band2 = tN(vec2(y / 0.8, 3.0));
          vec3 col = mix(vec3(${opts.ceil ? '0.07, 0.04, 0.035' : '0.16, 0.08, 0.06'}), vec3(${opts.ceil ? '0.12, 0.08, 0.07' : '0.3, 0.17, 0.12'}), band * 0.7 + mix(0.5, band2, aa) * 0.3);
          // escarcha en vetas (hielo de agua y sales de amoníaco)
          float frost = smoothstep(0.78, 0.9, tN(vec2(y / 7.0, 2.0))) * (0.5 + 0.5 * tN(vSW.xz / 22.0));
          col = mix(col, vec3(0.55, 0.6, 0.66), frost * 0.55);
          // marcas de las rozadoras: estrías diagonales
          float cut = smoothstep(0.42, 0.5, abs(fract((vSu.y + y * 1.3) / 2.4) - 0.5)) * aa;
          col *= 1.0 - 0.18 * cut;
          col *= 0.85 + 0.25 * tF(vec2(vSu.y / 30.0, y / 6.0));
          ${opts.floor ? 'col *= 0.4;' : ''}
          ${opts.lips ? `
          // filas de lámparas ámbar en uno de cada cuatro labios, a tramos: puntos que se pierden a lo lejos
          float lid = floor(vSu.x), lp = fract(vSu.x);
          float on = step(mod(lid, 4.0), 0.5) * step(0.35, tH(vec2(floor(vSu.y / 120.0), lid)));
          float lw = clamp(fwidth(vSu.x) * 1.5, 0.04, 0.25);
          float dots = 1.0 - smoothstep(0.08, 0.14, abs(fract(vSu.y / 9.0) - 0.5));
          float far = smoothstep(0.6, 2.5, fy);
          sGlow += vec3(1.0, 0.62, 0.3) * (1.0 - smoothstep(lw, lw * 2.0, abs(lp - 0.5))) * on * mix(dots * 3.0, 0.5, far);` : ''}
          sGlow += col * vec3(0.02, 0.015, 0.015);
          diffuseColor.rgb = col;
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += sGlow;');
  };
  m.customProgramCacheKey = () => 'pluRock' + (opts.ceil ? 'c' : '') + (opts.floor ? 'f' : '') + (opts.lips ? 'l' : '');
  return m;
}

// Haces de luz en la niebla (rejillas del techo)
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
        float along = smoothstep(0.0, 0.05, y) * pow(max(1.0 - y, 0.0), 1.4);
        along *= 0.8 + 0.2 * sin(vUv.x * 40.0 + y * 9.0 + uT * 0.4);
        float near = smoothstep(8.0, 70.0, vD);
        gl_FragColor = vec4(uCol * core * along * uK * near, 1.0);
      }`,
  });
}

// Penachos de los géiseres de nitrógeno: columna translúcida que se dobla con el viento arriba
function plumeMaterial(uni) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: uni.uT },
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
      uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.2);
        float y = vUv.x;                                   // 0 en la boca, 1 en la punta (TubeGeometry: u a lo largo)
        float tb = tF(vec2(vUv.y * 5.0, y * 14.0 - uT * 0.35)) * 0.7 + tF(vec2(vUv.y * 13.0 + 2.0, y * 40.0 - uT * 0.8)) * 0.3;
        float a = core * smoothstep(0.0, 0.03, y) * pow(max(1.0 - y, 0.0), 1.3) * (0.25 + 1.1 * tb * tb) * 0.55;
        vec3 c = mix(vec3(0.82, 0.86, 0.9), vec3(0.42, 0.42, 0.44), smoothstep(0.35, 0.9, y));
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.85));
      }`,
  });
}

// Neptuno: azul profundo con bandas, mancha oscura, cirros blancos, borde de atmósfera cian y terminador

// Caronte: gris con cráteres, casquete rojizo en el polo norte (Mordor Macula) y el cañón ecuatorial
function charonMaterial(center, sun, axis) {
  return new THREE.ShaderMaterial({
    fog: false, depthWrite: false,
    uniforms: { uC: { value: center }, uSun: { value: sun }, uAx: { value: axis } },
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
      uniform vec3 uC, uSun, uAx; varying vec3 vW;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        float lat = asin(clamp(dot(n, uAx), -1.0, 1.0));
        vec3 e1 = normalize(cross(uAx, vec3(0.0, 0.0, 1.0))), e2 = cross(uAx, e1);
        float lon = atan(dot(n, e2), dot(n, e1));
        vec2 q = vec2(lon * 3.0, lat * 3.0);
        float a = tF(q + 2.0), b = tF(q * 5.0 + 1.0);
        vec3 col = mix(vec3(0.34, 0.33, 0.32), vec3(0.62, 0.6, 0.57), smoothstep(0.2, 0.85, a * 0.6 + b * 0.4));
        float cr = tVor(q * 6.0, 1.0);
        col *= 0.8 + 0.25 * smoothstep(0.0, 0.3, cr);
        float cap = smoothstep(0.85, 1.15, lat + (a - 0.5) * 0.3);
        col = mix(col, vec3(0.42, 0.16, 0.1), cap * 0.85);
        float canyon = exp(-pow((lat - 0.05 * sin(lon * 3.0)) / 0.025, 2.0));
        col *= 1.0 - 0.45 * canyon;
        float lam = dot(n, uSun), day = smoothstep(-0.03, 0.2, lam) * max(lam, 0.0);
        vec3 c = col * (0.006 + 1.3 * day);
        float mu = clamp(dot(n, V), 0.0, 1.0);
        c *= 0.6 + 0.4 * pow(max(mu, 1e-4), 0.3);
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Plutón entero (intro): la Ballena roja de tolinas, el corazón blanco de nitrógeno al este, parches azules al norte,
// bruma azul en el limbo y lado nocturno
function plutoMaterial(center, sun) {
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
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        vec2 q = vec2(atan(n.z, n.x), asin(clamp(n.y, -1.0, 1.0))) * 6.0;
        float a = tF(q + 2.0), b = tF(q * 4.0 + 1.0), c = tF(q * 18.0);
        // la Ballena: rojo de tolinas alrededor del circuito (polo de la esfera = la zona de la carrera)
        vec3 col = mix(vec3(0.3, 0.07, 0.04), vec3(0.6, 0.2, 0.1), smoothstep(0.2, 0.85, a * 0.6 + b * 0.4));
        // el corazón: llanura de nitrógeno blanca hacia el este (con su textura celular)
        float heart = smoothstep(0.15, 0.4, dot(n, normalize(vec3(0.5, 0.1, -0.86))) + (a - 0.5) * 0.35);
        vec3 hc = mix(vec3(0.66, 0.62, 0.56), vec3(0.76, 0.72, 0.66), tVor(q * 30.0, 1.0));
        col = mix(col, hc, heart);
        // parches azules (metano) y crema al norte
        float blue = smoothstep(0.3, 0.55, dot(n, normalize(vec3(-0.6, 0.5, 0.6))) + (b - 0.5) * 0.4) * (1.0 - heart);
        col = mix(col, mix(vec3(0.75, 0.74, 0.7), vec3(0.3, 0.5, 0.82), smoothstep(0.45, 0.7, b)), blue);
        col *= 0.82 + 0.3 * c;
        float lam = dot(n, uSun), day = smoothstep(-0.03, 0.2, lam) * max(lam, 0.0);
        vec3 cc = col * (0.006 + 1.0 * day);
        // bruma azul en capas sobre el limbo (la atmósfera de Plutón)
        float rim = pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 4.0);
        cc += vec3(0.25, 0.5, 1.0) * rim * smoothstep(-0.35, 0.25, lam) * 0.32;
        gl_FragColor = vec4(cc, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ─────────────────────────────────────────────────────────────
//  Cielo: el Sol (diminuto, a 40 UA) y Caronte (grande, sobre la recta de salida)
// ─────────────────────────────────────────────────────────────
const SUN = new THREE.Vector3(0.45, 0.36, 0.82).normalize();          // sur-sureste, bajo: sombras largas
const CH_DIR = new THREE.Vector3(-0.9, 0.38, -0.2).normalize();       // oeste-noroeste, 22° sobre el horizonte, sobre la recta
const CH_D = 4.0e5, CH_R = 30000;                                       // ~4,3° de radio aparente (a menos de 450 km: precisión)
export function plutoSunDir() { return SUN.clone(); }
export const PLUTO_R = 60000;                                           // radio artístico de Plutón (el real son 1188 km)

const HW = 17.6;

export function buildPluto(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 71;
  const lite = QUALITY.lite;
  const lay = triLayout();
  const S_ = TRI.SCALE, EL = { x: ELLIOT.x * S_, z: ELLIOT.z * S_, R0: ELLIOT.R0 * S_, RR: ELLIOT.RR * S_, floor: ELLIOT.floor, rim: ELLIOT.rim, peak: ELLIOT.peak, peakR: ELLIOT.peakR * S_ };
  const track = new Track(null, { points: lay.pts, inSectorOrder: false, sectors: [0, 0.15, 0.32, 0.5, 0.66, 0.84],
    bank: (fq, k) => THREE.MathUtils.clamp(k * 30, -0.16, 0.16) });
  const F = track.frame(), L = track.length;
  const P3 = (q, x = 0, h = 0) => { track.sample(q, F); return F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h); };
  const sOfD = (d) => { let i = 0; while (i < lay.cum.length - 1 && lay.cum[i + 1] < d) i++; const j = Math.min(track.sectionS.length - 1, Math.round(i / 2)); return track.sectionS[j]; };
  const sM = {}; for (const [k, v] of Object.entries(TRI.MARK)) sM[k] = sOfD(lay.dC[v]);
  const uni = { uT: { value: 0 } };
  const inRange = (q, a, b) => { const d = track.delta(a, q); return d >= 0 && d <= track.delta(a, b) + (b < a ? L : 0); };

  // ── Muestras de la pista ──
  const smp = [];
  for (let q = 0; q < L; q += 4) { track.sample(q, F); smp.push({ s: q, p: F.pos.clone(), r: F.right.clone(), u: F.up.clone(), t: F.tan.clone() }); }
  const CELLH = 60;
  const mkHash = (list) => { const h = new Map(); list.forEach((q) => { const k = `${Math.floor(q.p.x / CELLH)},${Math.floor(q.p.z / CELLH)}`; if (!h.has(k)) h.set(k, []); h.get(k).push(q); }); return h; };
  const nearIn = (hash, x, z, rad = 150) => {
    let best = null, bd = Infinity; const n = Math.ceil(rad / CELLH), cx = Math.floor(x / CELLH), cz = Math.floor(z / CELLH);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = hash.get(`${cx + a},${cz + b}`); if (l) for (const q of l) { const d = (q.p.x - x) ** 2 + (q.p.z - z) ** 2; if (d < bd) { bd = d; best = q; } } }
    return { q: best, d: Math.sqrt(bd) };
  };
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const q of smp) { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); bz0 = Math.min(bz0, q.p.z); bz1 = Math.max(bz1, q.p.z); }
  const MARG = 1500, gx0 = bx0 - MARG, gx1 = bx1 + MARG, gz0 = bz0 - MARG, gz1 = bz1 + MARG;

  // ── Relieve natural: llanura craterizada + fosa Virgil (eje = la pista, prolongado) + cráter Elliot con pico central ──
  const craters = makeCraters(lite ? 60 : 110, 913, [gx0, gx1, gz0, gz1], 30, 420)
    .filter((c) => Math.hypot(c.x - EL.x, c.z - EL.z) > EL.RR + c.r + 150);
  // eje de la fosa: la pista desde la curva hacia el norte hasta el borde de Elliot; el fondo no baja de −150 m (bajo él, las minas)
  const FMIN = -150;
  const fossaAx = smp.filter((q) => inRange(q.s, sM.loop + 260, sM.rim - 60)).filter((_, i) => i % 3 === 0).map((q) => ({ p: q.p, y: Math.max(q.p.y, FMIN) - 2 }));
  {
    // prolongación de la fosa hacia el oeste (se cierra) y hacia el cráter (lo corta)
    const a = fossaAx[0], b = fossaAx[6], dir = new THREE.Vector3(a.p.x - b.p.x, 0, a.p.z - b.p.z).normalize();
    for (let k = 1; k <= 30; k++) fossaAx.unshift({ p: a.p.clone().addScaledVector(dir, k * 24), y: lerp(a.y, 10, sstep(0, 30, k)) });
  }
  const fossaHash = mkHash(fossaAx);
  const fossaH = (x, z) => {
    const { q, d } = nearIn(fossaHash, x, z, 360); if (!q) return null;
    const w = 1 - sstep(60, 210, d);                                 // fondo de 120 m y paredes de ~150 m de ancho
    return { y: q.y, w, d };
  };
  const elliot = (x, z) => {
    const r = Math.hypot(x - EL.x, z - EL.z);
    if (r > EL.RR + 520) return null;
    let h;
    if (r < EL.R0) h = EL.floor + EL.peak * Math.exp(-((r / EL.peakR) ** 2) * 2.2);
    else if (r < EL.RR) { const t = (r - EL.R0) / (EL.RR - EL.R0); h = EL.floor + (EL.rim - EL.floor) * Math.pow(t, 1.6); }
    else h = EL.rim * (1 - sstep(EL.RR, EL.RR + 520, r)) + 6 * Math.exp(-(((r - EL.RR - 30) / 40) ** 2));
    return { h, w: 1 - sstep(EL.RR + 300, EL.RR + 520, r) };
  };
  const natural = (x, z) => {
    let h = 26 * (fbm(x / 1800, z / 1800, 3) - 0.5) + 7 * (fbm(x / 320 + 5, z / 320, 3) - 0.5) + 1.6 * (fbm(x / 40, z / 40, 2) - 0.5) + craterSum(craters, x, z);
    const e = elliot(x, z); if (e) h = lerp(h, e.h + 4 * (fbm(x / 90, z / 90, 2) - 0.5), e.w);
    const f = fossaH(x, z); if (f && f.w > 0) h = Math.min(h, lerp(h, f.y + 3 * (fbm(x / 60, z / 60, 2) - 0.5), f.w));
    return h;
  };

  // ── Bajo tierra: más de 45 m de roca encima entre la fosa y el borde de Elliot ──
  const depthAt = (q) => natural(q.p.x, q.p.z) - q.p.y;
  let sIn = null, sOut = null;
  for (const q of smp) if (inRange(q.s, sM.fossa, sM.rim + 300) && depthAt(q) > 45) { if (sIn === null) sIn = q.s; sOut = q.s; }
  sIn = Math.ceil(sIn / 6) * 6; sOut = Math.floor(sOut / 6) * 6;
  const ug = (q) => inRange(track.wrap(q), sIn, sOut);
  const gapS0 = sM.top + 14, gapS1 = sM.top + 96;
  track.gaps = [{ s0: gapS0, s1: gapS1 }];
  const inGap = (q) => inRange(track.wrap(q), gapS0 - 6, gapS1 + 6);
  const surfHash = mkHash(smp.filter((q) => !ug(q.s)));
  const terrain = (x, z) => {
    const nat = natural(x, z);
    const { q } = nearIn(surfHash, x, z, 260); if (!q) return nat;
    const dx = x - q.p.x, dz = z - q.p.z, lat = Math.abs(dx * q.r.x + dz * q.r.z), along = dx * q.t.x + dz * q.t.z;
    if ((Math.abs(track.delta(sIn, q.s)) < 6 && along > 0) || (Math.abs(track.delta(sOut, q.s)) < 6 && along < 0)) return nat;
    // bajo el tablero, siguiendo su peralte (con la cota del eje, el hielo asomaba en placas por el lado bajo de las curvas)
    const latS = THREE.MathUtils.clamp(dx * q.r.x + dz * q.r.z, -(HW + 6), HW + 6);
    let ty = q.p.y + q.r.y * latS - (lite ? 5 : 2.4);              // en ligera la malla es más gruesa: más margen
    if (inGap(q.s)) ty = q.p.y - 55 + 28 * sstep(HW + 4, HW + 40, lat);
    const w = lat < HW + 6 ? 1 : sstep(HW + 6 + Math.max(36, Math.abs(nat - ty) * 1.1), HW + 6, lat);
    return lerp(nat, ty, w);
  };

  // ── Malla del terreno ──
  const ground = groundMaterial(EL); own.push(ground);
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
  const GRES = lite ? 16 : 9;
  // bocas del túnel: se recortan las celdas que unen el suelo de la fosa con la ladera de encima (tapaban la boca)
  const mouthF = [[sIn, 1], [sOut, -1]].map(([q, sg]) => { track.sample(q, F); const tH = F.tan.clone().setY(0).normalize(); return { p: F.pos.clone(), tH, rH: new THREE.Vector3().crossVectors(tH, new THREE.Vector3(0, 1, 0)).normalize(), sg }; });
  const mouthHole = (x, z) => mouthF.some((f) => { const dx = x - f.p.x, dz = z - f.p.z; const lat = Math.abs(dx * f.rH.x + dz * f.rH.z), al = (dx * f.tH.x + dz * f.tH.z) * f.sg;
    return lat < 30 && al > -GRES * 0.8 && al < GRES * 0.8; });
  heightGrid(terrain, GRES, ground, !lite, [gx0, gx1, gz0, gz1], mouthHole);
  const OUT = 14000, ORES = lite ? 700 : 400;
  const inInner = (x, z) => x > gx0 + 2 && x < gx1 - 2 && z > gz0 + 2 && z < gz1 - 2;
  const PR = PLUTO_R, drop = (x, z) => PR - Math.sqrt(Math.max(0, PR * PR - x * x - z * z));
  heightGrid((x, z) => (inInner(x, z) ? terrain(x, z) : 26 * (fbm(x / 1800, z / 1800, 3) - 0.5) - 2 - drop(x, z)), ORES, ground, false, [-OUT, OUT, -OUT, OUT], (x, z) => inInner(x - ORES * 0.5, z - ORES * 0.5) && inInner(x + ORES * 0.5, z + ORES * 0.5) || Math.hypot(x, z) > OUT);

  // ── Plutón entero (intro y horizonte) ──
  const MC = new THREE.Vector3(0, -PR, 0);
  {
    const mm = plutoMaterial(MC, SUN); own.push(mm);
    const sg = new THREE.SphereGeometry(PR, lite ? 160 : 256, lite ? 80 : 128);
    sg.translate(0, -PR - 40, 0);
    const p = sg.attributes.position, idx = sg.index.array, keep = [];
    const inside = (i) => p.getY(i) > -PR && Math.hypot(p.getX(i), p.getZ(i)) < OUT - 1500;
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    sg.setIndex(keep); sg.deleteAttribute('uv'); sg.computeBoundingSphere();
    const mesh = new THREE.Mesh(sg, mm); mesh.frustumCulled = false; mesh.renderOrder = -1; world.add(mesh); own.push(sg);
  }
  // ── Caronte ──
  const chC = CH_DIR.clone().multiplyScalar(CH_D);
  {
    const cm = charonMaterial(chC, SUN, new THREE.Vector3(0.1, 1, 0.3).normalize()); own.push(cm);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(CH_R, 128, 64), cm); ch.position.copy(chC); ch.frustumCulled = false; ch.renderOrder = -2; world.add(ch); own.push(ch.geometry);
  }
  // espacio negro delante de la cúpula, con las capas de bruma azul de Plutón sobre el horizonte; el Sol diminuto
  {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 rel = cameraPosition - vec3(0.0, ${(-PLUTO_R).toFixed(1)}, 0.0); float dist = max(length(rel), ${PLUTO_R.toFixed(1)} + 1.0); vec3 upv = rel / dist; float hz = -sqrt(1.0 - pow(${PLUTO_R.toFixed(1)} / dist, 2.0)); float h = dot(d, upv) - hz; float k = 1.0 - smoothstep(4000.0, 60000.0, dist - ${PLUTO_R.toFixed(1)}); float layers = 0.75 + 0.25 * sin(h * 900.0); vec3 c = vec3(0.12, 0.26, 0.55) * exp(-max(h, 0.0) / 0.03) * layers * smoothstep(-0.006, 0.0, h) * 0.6 * k; gl_FragColor = vec4(c, 1.0); }`,
    }));
    shell.renderOrder = -999; shell.frustumCulled = false;
    shell.onBeforeRender = (r, sc, cam) => { shell.position.copy(cam.position); shell.updateMatrixWorld(); };
    world.add(shell); own.push(shell.geometry, shell.material);
    const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    own.push(dot);
    const sm = new THREE.SpriteMaterial({ map: dot, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: false });
    const sun = new THREE.Sprite(sm); sun.position.copy(SUN).multiplyScalar(4.4e5); sun.scale.setScalar(0.05); sun.renderOrder = -3; sun.frustumCulled = false; world.add(sun); own.push(sm);
  }
  // estrellas (lejos, pero dentro del margen de precisión de la profundidad)
  {
    const n = 8000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(4.6e5);
      pos.set([v.x, v.y, v.z], i * 3);
      const b = 0.25 + Math.pow(rnd(), 5) * 2.2, t = rnd();
      col.set(t < 0.25 ? [b * 0.8, b * 0.9, b] : t > 0.9 ? [b, b * 0.86, b * 0.72] : [b, b, b], i * 3);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sm = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
    const stp = new THREE.Points(gg, sm); stp.frustumCulled = false; stp.renderOrder = -4; world.add(stp); own.push(gg, sm);
  }

  // ── Tablero ──
  const MT = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x5a5654))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xc9bdb2))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x221d1c)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xd8d0c8)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(1.0, 0.55, 0.25); m.emissiveIntensity = 2.6; }),
    buoy: reflectorMaterial(def.paint.buoy), guide: amberGuideMaterial(def.paint.guide),
  };
  Object.values(MT).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], buoy: [], guide: [], frame: [], edge: [], gate: [] };
  const sweepSeg = (s0, s1, step, prof, closed) => {
    const rows = Math.max(1, Math.round((s1 - s0) / step)), m = prof.length;
    const pos = [], uv = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const q = s0 + (s1 - s0) * r / rows; track.sample(q, F);
      prof.forEach(([x, h], k) => { pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), q / 20); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
    gg.computeVertexNormals();
    return gg;
  };
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  for (const [a, b] of [[gapS1, gapS0 + L]]) {
    parts.deck.push(sweepSeg(a, b, 3, deckProf, true));
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
  // balizas más juntas bajo tierra: en la oscuridad marcan el trazado
  for (let q = 5; q < L; q += ug(q) ? 12 : 24) if (!inGap(q)) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
  for (let q = 0; q < L; q += 14) if (!inGap(q)) boxAt(q, 0, 0.03, 0.28, 0.06, 3.2, parts.guide);
  for (const sc of track.sectors) { const q = sc.s + (sc.id === 1 ? 6 : 0); if (inGap(q)) continue; for (const x of [-17.6, 17.6]) boxAt(q, x, 7.5, 0.9, 15, 0.9, parts.frame); boxAt(q, 0, 15.2, 36, 0.4, 1.2, parts.gate); }
  for (const q of [gapS0 - 0.6, gapS1 + 0.6]) boxAt(q, 0, 0.15, 34, 0.3, 0.8, parts.gate);
  const kinds = { deck: 'deck', guard: 'guard', buoy: 'reflector' };
  const norm = (list) => list.map((gg) => { for (const a of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(a)) gg.deleteAttribute(a); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); if (!gg.index) gg.setIndex([...Array(gg.attributes.position.count).keys()]); return gg; });
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    let merged = mergeGeometries(norm(list), false); list.forEach((gg) => gg.dispose());
    if (kinds[k]) merged = deformGeometry(merged, track, kinds[k], false);
    const mesh = new THREE.Mesh(merged, MT[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck';
    world.add(mesh); own.push(merged);
  }

  // ── Materiales de estructura: acero oscuro, hormigón, óxido, luces ámbar escasas ──
  const SM = {
    steel: new THREE.MeshStandardMaterial({ color: 0x141213, roughness: 0.55, metalness: 0.75 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x3e3836, roughness: 0.7, metalness: 0.35, emissive: 0x050404 }),
    slab: new THREE.MeshStandardMaterial({ color: 0x2a2523, roughness: 0.9, metalness: 0.05, emissive: 0x050303 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x4a2414, roughness: 0.8, metalness: 0.4, emissive: 0x080302 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xc98a12, roughness: 0.55, metalness: 0.1, emissive: 0x2a1802 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xffa04a, emissiveIntensity: 3.2 }),
    white: new THREE.MeshStandardMaterial({ color: 0x101418, emissive: 0xfff0dc, emissiveIntensity: 3.0 }),
    cold: new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x8fc8ff, emissiveIntensity: 3.0 }),
    red: new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff2a14, emissiveIntensity: 3.4 }),
  };
  own.push(...Object.values(SM));
  const arch = Object.fromEntries(Object.keys(SM).map((k) => [k, []]));
  const cyl = (a, b, r, list, seg = 10, r2 = r) => {
    const d = b.clone().sub(a), len = d.length(); if (len < 0.1) return;
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, false); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); list.push(g);
  };
  const hbox = (g, x, h, w, hh, d, list, rotZ = 0) => {
    const bx = new THREE.BoxGeometry(w, hh, d); if (rotZ) bx.rotateZ(rotZ);
    bx.applyMatrix4(new THREE.Matrix4().makeBasis(g.rH, new THREE.Vector3(0, 1, 0), g.tH));
    bx.translate(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); list.push(bx); return bx;
  };
  const hframe = (q) => { track.sample(q, F); const tH = F.tan.clone().setY(0).normalize(); return { p: F.pos.clone(), tH, rH: new THREE.Vector3().crossVectors(tH, new THREE.Vector3(0, 1, 0)).normalize() }; };

  // ── CTHULHU MINES: galerías cada 6 m (anchura W, techo H, abismo D) ──
  const STEP = 6, G6 = [];
  for (let q = sIn; q <= sOut; q += STEP) {
    track.sample(q, F);
    const p = F.pos.clone(), tH = F.tan.clone().setY(0).normalize(), rH = new THREE.Vector3().crossVectors(tH, new THREE.Vector3(0, 1, 0)).normalize();
    // naves enormes alternadas con tramos de galería más estrecha (la escala se nota al salir de ellos)
    const narrow = sstep(0.45, 0.6, fbm(q / 420, 7.7, 2));
    const W = lerp(105, 38, narrow) + 30 * (fbm(q / 260, 2.3, 2) - 0.5), H = lerp(150, 48, narrow), D = lerp(190, 30, narrow);
    G6.push({ q, p, tH, rH, W, H, D, narrow, k: Math.abs(F.kappa), dep: natural(p.x, p.z) - p.y });
  }
  const NG = G6.length;
  {
    const lim = G6.map((g, i) => { let km = 0; for (let j = -10; j <= 10; j++) km = Math.max(km, G6[Math.min(NG - 1, Math.max(0, i + j))].k); return km > 1e-5 ? 0.82 / km : 1e9; });
    const Hl = G6.map((g) => { let t = Infinity; for (const x of [-g.W, 0, g.W]) t = Math.min(t, natural(g.p.x + g.rH.x * x, g.p.z + g.rH.z * x)); return t - 28 - g.p.y; });
    const ero = (a, w) => a.map((_, i) => { let m = Infinity; for (let k = -w; k <= w; k++) m = Math.min(m, a[Math.min(NG - 1, Math.max(0, i + k))]); return m; });
    const avg = (a, w) => a.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += a[Math.min(NG - 1, Math.max(0, i + k))]; return s / (2 * w + 1); });
    const mouth = G6.map((g) => 1 - sstep(45, 140, g.dep));
    let W = G6.map((g, i) => Math.min(g.W, lim[i]));
    W = avg(ero(W, 10), 10).map((w, i) => lerp(w, 22, mouth[i]));
    const H = avg(ero(G6.map((g, i) => Math.max(17, Math.min(lerp(g.H, 18, mouth[i]), Hl[i]))), 8), 8);
    const D = avg(ero(G6.map((g, i) => lerp(g.D, 4, mouth[i])), 8), 8);
    G6.forEach((g, i) => { g.W = Math.max(21, W[i]); g.H = Math.max(16, H[i]); g.D = Math.max(3, D[i]); });
  }
  const gAt = (q) => G6[Math.min(NG - 1, Math.max(0, Math.round((q - sIn) / STEP)))];
  const CW = strataMaterial(uni, { lips: true }), CC = strataMaterial(uni, { ceil: true }), CF = strataMaterial(uni, { floor: true });
  own.push(CW, CC, CF);
  const NL = 16;
  const wallProf = (g, sd) => {
    const out = [], span = g.H - 6 + g.D;
    for (let k = 0; k <= NL; k++) {
      const h0 = -g.D + span * k / NL, lip = (1.6 + 2.2 * h2(k, Math.round(g.q / 48))) * Math.min(1, g.W / 40);
      out.push([sd * g.W, h0, k], [sd * (g.W - lip), h0 + span / NL * 0.3, k + 0.5], [sd * (g.W - lip), h0 + span / NL * 0.42, k + 0.5]);
    }
    out.push([sd * (g.W - 6), g.H, NL + 1]);
    return sd > 0 ? out : out.reverse();
  };
  const sweepHall = (profFn, mat, shadow) => {
    const pos = [], uv = [], idx = []; let m = 0;
    for (let i = 0; i < NG; i++) {
      const g = G6[i], prof = profFn(g); m = prof.length;
      prof.forEach(([x, h, u]) => { pos.push(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); uv.push(u ?? 0, g.q); });
    }
    for (let r = 0; r < NG - 1; r++) for (let k = 0; k < m - 1; k++) { const a = r * m + k, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, mat); mesh.receiveShadow = true; mesh.castShadow = shadow && !lite; world.add(mesh); own.push(gg);
  };
  sweepHall((g) => wallProf(g, 1), CW, true);
  sweepHall((g) => wallProf(g, -1), CW, true);
  sweepHall((g) => [[-g.W + 6, g.H, 0], [-g.W * 0.35, g.H + 5, 1], [g.W * 0.35, g.H + 5, 2], [g.W - 6, g.H, 3]], CC, true);
  sweepHall((g) => [[-g.W, -g.D, 0], [g.W, -g.D, 1]], CF, false);

  // portales mineros: frente de hormigón y acero con franja ámbar (en el fondo de la fosa y en la pared de Elliot)
  const portal = (q, sg) => {
    const g = gAt(q), top = Math.max(26, natural(g.p.x, g.p.z) + 6 - g.p.y);
    // collar de hormigón hacia fuera: tapa el recorte del terreno junto a la boca
    { const C = GRES * 1.2 + 8, gc = { ...g, p: g.p.clone().addScaledVector(g.tH, -sg * (C / 2 - 4)) };
      for (const sd of [-1, 1]) { hbox(gc, sd * (HW + 0.5 + 15), (top - 40) / 2, 30, top + 40, C, arch.slab); hbox(gc, sd * (HW + 0.6), 3, 0.3, 0.6, C, arch.warm); } }
    const fw = 70, hw = 21, ht = 18;
    for (const [x, h, w, hh] of [[-(fw + hw) / 2, top / 2 - 4, fw - hw, top + 8], [(fw + hw) / 2, top / 2 - 4, fw - hw, top + 8], [0, (ht + top) / 2, hw * 2, top - ht]]) hbox(g, x, h, w, hh, 8, arch.slab);
    hbox(g, 0, ht + 2, hw * 2 + 10, 4, 10, arch.rust);
    hbox(g, 0, ht + 0.4, hw * 2, 0.4, 10.4, arch.warm);
    for (const x of [-hw - 2, hw + 2]) { hbox(g, x, ht / 2, 2.4, ht, 10.4, arch.steel); hbox(g, x, ht / 2, 0.4, ht, 10.8, arch.warm); }
    for (const x of [-hw - 10, hw + 10]) hbox(g, x, 1.5, 6, 3, 10.6, arch.hazard);
  };
  portal(sIn, 1); portal(sOut, -1);

  // ── Vestido minero: pórticos grúa, cintas transportadoras, cabezas de tuneladora, pilares, cabinas, cables ──
  const beamsW = [];
  G6.forEach((g) => {
    const i = Math.round(g.q / STEP), big = g.narrow < 0.5;
    if (g.dep < 70) return;
    // pórticos grúa cada 120 m: viga alta y bloque del gancho colgando
    if (i % 20 === 0) {
      const h = Math.min(g.H - 6, big ? 60 + 30 * h2(i, 2) : g.H - 4);
      hbox(g, 0, h, g.W * 2 - 4, 3, 3, arch.steel);
      for (const sd of [-1, 1]) hbox(g, sd * (g.W - 3), (h - g.D) / 2, 3, h + g.D, 3, arch.steel);
      if (big) { const x = (h2(i, 3) - 0.5) * g.W; hbox(g, x, h - 12, 0.4, 20, 0.4, arch.grey); hbox(g, x, h - 24, 5, 5, 4, arch.rust); hbox(g, x, h - 21.3, 1.2, 0.4, 1.2, arch.red); }
      hbox(g, 0, h - 1.8, 2, 0.5, 2, arch.warm);
    }
    // cinta transportadora a lo largo del muro izquierdo, con rodillos
    if (big && g.D > 40) {
      const nx = G6[Math.min(NG - 1, G6.indexOf(g) + 1)];
      const at = (o) => new THREE.Vector3(o.p.x - o.rH.x * (o.W - 9), o.p.y - o.D * 0.45, o.p.z - o.rH.z * (o.W - 9));
      cyl(at(g), at(nx), 1.6, arch.grey, 6);
      if (i % 2 === 0) hbox(g, -(g.W - 9), -g.D * 0.45 - 4, 0.8, 8, 0.8, arch.steel);
      if (i % 9 === 0) hbox(g, -(g.W - 9), -g.D * 0.45 - 2, 3, 0.4, 0.6, arch.warm);
    }
    // cabezas de tuneladora aparcadas en el fondo
    if (big && i % 47 === 11 && g.D > 80) {
      const sd = h2(i, 1) < 0.5 ? -1 : 1, x = sd * (g.W * 0.45), base = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y - g.D + 14, g.p.z + g.rH.z * x);
      const ax = g.tH.clone(); const a = base.clone().addScaledVector(ax, -22), b = base.clone().addScaledVector(ax, 18);
      cyl(a, b, 13, arch.rust, 18); cyl(b, b.clone().addScaledVector(ax, 8), 13.5, arch.steel, 18, 4);
      for (let k = 0; k < 8; k++) { const ang = k / 8 * Math.PI * 2; const tip = b.clone().addScaledVector(ax, 4).add(new THREE.Vector3(g.rH.x * Math.cos(ang) * 10, Math.sin(ang) * 10, g.rH.z * Math.cos(ang) * 10)); const bb = new THREE.BoxGeometry(2, 2, 2); bb.translate(tip.x, tip.y, tip.z); arch.steel.push(bb); }
      const lb = new THREE.BoxGeometry(2, 2, 2); lb.translate(base.x, base.y + 14, base.z); arch.red.push(lb);
    }
    // pilares colosales
    if (big && i % 17 === 5) for (const sd of [-1, 1]) if (h2(i, sd) > 0.4) {
      const x = sd * (24 + Math.max(0, g.W - 34) * h2(i, sd + 4)), r = 4 + 6 * h2(i, 9);
      const base = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y - g.D, g.p.z + g.rH.z * x), top = base.clone().setY(g.p.y + g.H + 4);
      cyl(base, top, r, arch.slab, 8, r * 0.8);
      if (h2(i, 11) > 0.6) { const lb = new THREE.BoxGeometry(r * 2.2, 0.8, r * 2.2); lb.translate(base.x, g.p.y + g.H * 0.4, base.z); arch.warm.push(lb); }
    }
    // cabinas de control colgadas de los muros, con ventanales
    if (big && i % 13 === 0 && h2(i, 6) > 0.4) {
      const sd = h2(i, 7) < 0.5 ? -1 : 1, w = 8 + 10 * h2(i, 8), hh = 6 + 8 * h2(i, 9), h = -g.D * 0.3 + (g.H + g.D * 0.3 - 20) * h2(i, 10);
      hbox(g, sd * (g.W - w / 2), h, w, hh, 10 + 12 * h2(i, 11), arch.slab);
      hbox(g, sd * (g.W - w - 0.2), h + 0.5, 0.3, hh * 0.35, 8, h2(i, 12) > 0.8 ? arch.cold : arch.warm);
    }
    // quilla bajo el tablero y péndolas
    if (i % 4 === 0 && g.D > 10) {                                   // viga bajo el tablero: sigue la pendiente real (horizontal asomaba en escalera sobre la pista)
      track.sample(g.q + STEP * 2, F); const bx = new THREE.BoxGeometry(8, 3.4, STEP * 4.05);
      bx.applyMatrix4(new THREE.Matrix4().makeBasis(F.right, F.up, F.tan)); const c = F.pos.clone().addScaledVector(F.up, -3.6); bx.translate(c.x, c.y, c.z); arch.steel.push(bx);
    }
    if (big && i % 6 === 3) for (const x of [-17.1, 17.1]) { const a = P3(g.q, x, -1.2), c = new THREE.Vector3(a.x, g.p.y + g.H, a.z); cyl(a, c, 0.22, arch.grey, 5); }
    // tramos estrechos: costillas de entibación de acero
    if (!big && i % 3 === 0) { hbox(g, -g.W + 0.8, (g.H - g.D) / 2, 1.2, g.H + g.D, 1.2, arch.steel); hbox(g, g.W - 0.8, (g.H - g.D) / 2, 1.2, g.H + g.D, 1.2, arch.steel); hbox(g, 0, g.H - 0.8, g.W * 2, 1.2, 1.2, arch.steel); if (i % 9 === 0) hbox(g, 0, g.H - 1.6, 4, 0.3, 0.6, arch.warm); }
    // pocos haces de luz desde el techo: islas de claridad en la oscuridad
    if (big && i % 41 === 19 && g.H > 60) {
      const x = (h2(i, 9) - 0.5) * g.W * 1.2, top = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y + g.H - 1, g.p.z + g.rH.z * x);
      const len = g.H + g.D * 0.7, r0 = 3, r1 = 16 + 14 * h2(i, 2);
      const gg = new THREE.CylinderGeometry(r0, r1, len, 18, 1, true); gg.translate(0, -len / 2, 0);
      const uvb = gg.attributes.uv; for (let k = 0; k < uvb.count; k++) uvb.setY(k, 1 - uvb.getY(k));
      gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3((h2(i, 4) - 0.5) * 0.3, -1, 0).normalize())); gg.translate(top.x, top.y, top.z);
      beamsW.push(gg); hbox(g, x, g.H - 0.6, 5, 1, 5, arch.warm);
    }
  });
  // carteles en los muros
  {
    const labels = ['VC-13', '−400 M', 'THOLIN', 'SHAFT 7', 'NO ENTRY', 'BELTON', 'LEVEL 4', 'KEEP CLEAR', 'ELLIOT', 'CH4 / N2', 'DEEP 9', 'ABYSS'];
    const c = document.createElement('canvas'); c.width = 1024; c.height = 768; const x2 = c.getContext('2d');
    x2.fillStyle = '#000'; x2.fillRect(0, 0, 1024, 768); x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    labels.forEach((t, k) => { const col = k % 2, row = Math.floor(k / 2); x2.font = `bold ${t.length > 6 ? 70 : 104}px "Arial Narrow", Impact, sans-serif`; x2.fillText(t, 256 + col * 512, 64 + row * 128); });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; own.push(tex);
    const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.5, 0.3, 0.16), side: THREE.DoubleSide });
    own.push(sm);
    const quads = [];
    G6.forEach((g) => {
      const i = Math.round(g.q / STEP); if (i % 23 !== 4 || g.dep < 70) return;
      const k = Math.floor(h2(i, 2) * labels.length), col = k % 2, row = Math.floor(k / 2);
      const sd = h2(i, 8) < 0.5 ? -1 : 1, h = 6 + h2(i, 3) * Math.max(4, g.H * 0.3), w = 24, hh = 6;
      const qd = new THREE.PlaneGeometry(w, hh); const uv = qd.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, (col + uv.getX(j)) / 2, 1 - (row + 1 - uv.getY(j)) / 6);
      qd.applyMatrix4(new THREE.Matrix4().makeBasis(g.tH.clone().multiplyScalar(-sd), new THREE.Vector3(0, 1, 0), g.rH.clone().multiplyScalar(-sd)));
      qd.translate(g.p.x + g.rH.x * sd * (g.W - 3), g.p.y + h, g.p.z + g.rH.z * sd * (g.W - 3)); quads.push(qd);
    });
    if (quads.length) { const gg = mergeGeometries(quads, false); quads.forEach((q) => q.dispose()); const m = new THREE.Mesh(gg, sm); m.renderOrder = 2; world.add(m); own.push(gg); }
  }
  if (beamsW.length) { const mW = beamMaterial(uni, [1.0, 0.7, 0.42], 0.06); own.push(mW); const gg = mergeGeometries(beamsW, false); beamsW.forEach((q) => q.dispose()); const mesh = new THREE.Mesh(gg, mW); mesh.renderOrder = 5; mesh.frustumCulled = false; world.add(mesh); own.push(gg); }
  // polvo en suspensión en las naves grandes (velos tenues, rojizos)
  const smokes = [];
  {
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    own.push(tex);
    for (const g of G6) {
      const i = Math.round(g.q / STEP); if (g.narrow > 0.5 || g.dep < 120 || i % (lite ? 12 : 6) !== 0) continue;
      const x = (h2(i, 1) - 0.5) * g.W * 1.6, h = -g.D * 0.9 + (g.D * 0.9 + g.H * 0.5) * h2(i, 2);
      if (Math.abs(x) < 26 && Math.abs(h) < 20) continue;
      const m = new THREE.SpriteMaterial({ map: tex, color: 0x8a6458, transparent: true, opacity: 0.06 + 0.08 * h2(i, 3), depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m); sp.position.set(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); sp.scale.setScalar(60 + 140 * h2(i, 4)); sp.renderOrder = 4;
      world.add(sp); own.push(m); smokes.push({ sp, base: sp.position.clone(), ph: h2(i, 5) * 6.28 });
    }
  }

  // ── Superficie: boxes y tribuna en la recta, pilotes, mástiles, torres en el borde de Elliot ──
  {
    const sA = L - 520, sB = L - 120;
    for (let q = sA; q < sB; q += 40) {
      const g = hframe(q);
      hbox(g, -44, 7, 22, 18, 40.5, arch.slab); hbox(g, -32.9, 8, 0.3, 4, 36, arch.warm); hbox(g, -44, 16.6, 24, 1.2, 41, arch.rust);
      if (Math.round(q / 40) % 3 === 0) { hbox(g, -44, 34, 3, 36, 3, arch.steel); hbox(g, -44, 52.5, 5, 1.5, 5, arch.white); }
    }
    for (let q = sA + 80; q < sB - 40; q += 40) { const g = hframe(q); for (let k = 0; k < 6; k++) hbox(g, 34 + k * 3.5, 1.5 + k * 2.2, 3.5, 3 + k * 4.4, 40.5, arch.grey); hbox(g, 46, 18, 22, 1, 40.5, arch.rust); }
    for (let q = 10; q < L; q += 30) {
      if (ug(q)) continue;
      for (const sd of [-1, 1]) { const top = P3(q, sd * 9, -1.6), gy = terrain(top.x, top.z) - 3; if (top.y - gy < 4) continue; cyl(new THREE.Vector3(top.x, gy, top.z), top, 1.1, arch.slab, 8, 0.8); }
    }
    for (let q = 60; q < L; q += 180) {
      if (ug(q) || inGap(q)) continue;
      const sd = Math.round(q / 180) % 2 ? 1 : -1; const b = P3(q, sd * 30, 0); b.y = terrain(b.x, b.z) - 2; const hh = 26 + 12 * h2(q, 1);
      cyl(b, b.clone().setY(b.y + hh), 0.5, arch.steel, 6);
      const lb = new THREE.BoxGeometry(2.4, 0.8, 2.4); lb.translate(b.x, b.y + hh, b.z); arch.white.push(lb);
    }
    for (const q of [gapS0, gapS1]) { const g = hframe(q); for (const sd of [-1, 1]) hbox(g, sd * 24, 0.5, 2, 3, 2, arch.red); }
    // torres de minería en el borde de Elliot (siluetas contra Caronte en la intro)
    for (let j = 0; j < 10; j++) {
      const a = (j + 0.4 * h2(j, 1)) / 10 * Math.PI * 2, r = EL.RR + 30 + 40 * h2(j, 2), x = EL.x + Math.cos(a) * r, z = EL.z + Math.sin(a) * r;
      if (nearIn(surfHash, x, z, 120).d < 70) continue;
      const y = terrain(x, z) - 2, hh = 50 + 70 * h2(j, 3);
      for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]]) cyl(new THREE.Vector3(x + dx, y, z + dz), new THREE.Vector3(x + dx * 0.4, y + hh, z + dz * 0.4), 0.5, arch.steel, 6);
      for (let yy = 8; yy < hh - 4; yy += 10) { const b = new THREE.BoxGeometry(4, 0.4, 4); b.translate(x, y + yy, z); arch.steel.push(b); }
      const wb = new THREE.BoxGeometry(9, 9, 9); wb.translate(x, y + hh - 2, z); arch.rust.push(wb);
      const lb = new THREE.BoxGeometry(1.4, 1.4, 1.4); lb.translate(x, y + hh + 4, z); arch.red.push(lb);
    }
  }

  // ── Respiraderos criovolcánicos en la fosa Virgil: penachos fríos y azulados junto a las paredes ──
  const vents = [];
  const allHash = mkHash(smp);
  {
    const pm = plumeMaterial(uni); own.push(pm);
    const tubes = [];
    const cands = smp.filter((q) => inRange(q.s, sM.fossa - 300, sIn - 40));
    for (let k = 0, tries = 0; k < (lite ? 4 : 7) && tries < 300; tries++) {
      const q = cands[Math.floor(rnd() * cands.length)]; if (!q) break;
      const sd = rnd() < 0.5 ? -1 : 1, x = q.p.x + q.r.x * sd * (45 + rnd() * 30), z = q.p.z + q.r.z * sd * (45 + rnd() * 30);
      if (vents.some((v) => Math.hypot(v.x - x, v.z - z) < 160)) continue;
      const gy = terrain(x, z) - 3, h = 160 + rnd() * 380;
      const pts = []; for (let j = 0; j <= 12; j++) { const t = j / 12; pts.push(new THREE.Vector3(x + 0.6 * h * t * t * 0.3, gy + h * t, z - 0.4 * h * t * t * 0.3)); }
      // el penacho no puede cruzar la pista en ningún punto del circuito (antes, en las curvas, alguno quedaba en mitad del trazado)
      if (pts.some((c, j) => { const { q: nq, d } = nearIn(allHash, c.x, c.z, 200); return nq && c.y < nq.p.y + 140 && d < 4 + 60 * Math.pow(j / 12, 1.4) + 40; })) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const tg = new THREE.TubeGeometry(curve, 32, 1, 14, false);
      const pp = tg.attributes.position, uvp = tg.attributes.uv;
      for (let i = 0; i < pp.count; i++) { const t = uvp.getX(i), c = curve.getPointAt(Math.min(1, t)); const rr = 4 + 60 * Math.pow(t, 1.4); pp.setXYZ(i, c.x + (pp.getX(i) - c.x) * rr, c.y + (pp.getY(i) - c.y) * rr, c.z + (pp.getZ(i) - c.z) * rr); }
      tg.computeVertexNormals(); tubes.push(tg); vents.push(new THREE.Vector3(x, gy, z));
      const v = new THREE.CylinderGeometry(6, 10, 3, 12); v.translate(x, gy + 1.5, z); arch.cold.push(v);
      k++;
    }
    if (tubes.length) { const gg = mergeGeometries(tubes, false); tubes.forEach((t) => t.dispose()); const m = new THREE.Mesh(gg, pm); m.renderOrder = 6; m.frustumCulled = false; world.add(m); own.push(gg); }
  }

  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (q.index === null) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, SM[k]); mesh.castShadow = ['steel', 'slab', 'grey', 'rust'].includes(k) && !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── Anillo de cohetes en lo más hondo de las minas ──
  const rr = buildRaceRings(world, track, [sM.mine + 360], own, { kind: 'rockets', ammo: 3, R: 17, lift: 8, color: [1.0, 0.6, 0.3] });
  for (const g of rr.gates) g.ammo = 2;

  const zones = [
    [sM.fossa - 200, 'VIRGIL FOSSAE', ['La fosa: corredor entre paredes', 'The fossa: a corridor between walls']],
    [sIn - 220, 'CTHULHU MINES', ['Galerías a oscuras · confía en tu luz', 'Dark galleries · trust your light']],
    [sOut - 60, 'ELLIOT RIM', ['La fosa corta el cráter', 'The fossa cuts the crater']],
    [sM.bowl - 80, 'ELLIOT BOWL', ['Paredes, fondo y pico central', 'Walls, floor and central peak']],
    [sM.climb - 220, 'THE CLIMB', ['Rampa a 52° · mantén la velocidad', '52° ramp · keep your speed']],
    [sM.close, 'WHALE BACK', ['Lomo rojo de Belton Regio', 'The red back of Belton Regio']],
  ].map(([q, title, sub]) => ({ s: track.wrap(q), title, sub }));

  const prevS = new Map(), gustT = new Map();
  const fx = {
    t: 0, gates: rr.gates, zones,
    update(dt) { this.t += dt; uni.uT.value = this.t; rr.update(dt); for (const o of smokes) { o.sp.position.set(o.base.x + Math.sin(this.t * 0.05 + o.ph) * 20, o.base.y + Math.sin(this.t * 0.07 + o.ph * 2) * 6, o.base.z + Math.cos(this.t * 0.04 + o.ph) * 20); o.sp.material.rotation += dt * 0.01; } },
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevS.delete(sh); continue; }
        const p = prevS.get(sh) ?? sh.s;
        for (const z of zones) { const d0 = track.delta(p, z.s), d1 = track.delta(sh.s, z.s); if (d0 > 0 && d1 <= 0 && d1 > -60) onPass?.(sh, { kind: 'banner', title: z.title, sub: z.sub }); }
        prevS.set(sh, sh.s);
        if (sh.player && vents.length && this.t - (gustT.get(sh) ?? -9) > 0.5) {
          let dmin = Infinity; for (const gp of vents) dmin = Math.min(dmin, Math.hypot(gp.x - sh.root.position.x, gp.z - sh.root.position.z));
          if (dmin < 240) { gustT.set(sh, this.t); onPass?.(sh, { kind: 'shake', k: 0.25 * (1 - dmin / 240) }); }
        }
      }
      rr.passRings(ships, onPass);
    },
    reset() { prevS.clear(); gustT.clear(); rr.reset(); },
  };

  const introKeys = makeIntro({ P3, MC, chC, EL, L, sM });
  let ymin = Infinity, ymax = -Infinity; for (const q of smp) { ymin = Math.min(ymin, q.p.y); ymax = Math.max(ymax, q.p.y); }
  console.info('[SRS] marcas', JSON.stringify(Object.fromEntries(Object.entries(sM).map(([k, v]) => [k, Math.round(v)]))));
  console.info(`[SRS] VIRGIL-CTHULHU ABYSS: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · minas ${Math.round(sIn)}–${Math.round(sOut)} · salto ${Math.round(gapS0)}–${Math.round(gapS1)} · respiraderos ${vents.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => terrain(x, z), tunnel: { s: sIn, len: sOut - sIn }, ownTunnel: true, bridges: 0, introKeys, fx,
    dbg: { G6, sIn, sOut, sM, vents, natural, terrain, EL } };
}

// ── Intro: Plutón con Caronte; bajada sobre la Ballena roja; la fosa Virgil y el cráter Elliot desde lo alto; la recta de salida ──
function makeIntro({ P3, MC, chC, EL, L, sM }) {
  const up = new THREE.Vector3(0, 1, 0);
  const cH = new THREE.Vector3(CH_DIR.x, 0, CH_DIR.z).normalize();
  const side = new THREE.Vector3().crossVectors(up, cH).normalize();
  // 1) desde el espacio: Plutón abajo, Caronte arriba (mirando hacia Caronte)
  const c0 = MC.clone().addScaledVector(cH, -175000).addScaledVector(up, 38000).addScaledVector(side, 30000);
  const dP = MC.clone().sub(c0).normalize(), dC = chC.clone().sub(c0).normalize();
  const l0 = c0.clone().addScaledVector(dP.multiplyScalar(0.5).addScaledVector(dC, 0.5).normalize(), 1e5);
  // 2) bajada sobre la región roja, aún mirando hacia Caronte
  const c1 = new THREE.Vector3(0, 1500, 0).addScaledVector(cH, -6000).addScaledVector(side, 1500);
  const l1 = c1.clone().addScaledVector(cH.clone().addScaledVector(up, 0.02).normalize(), 5000);
  // 3) sobre el cráter Elliot, picado: la fosa entra por el borde norte
  const E = new THREE.Vector3(EL.x, 0, EL.z);
  const c2 = E.clone().addScaledVector(cH, -900).add(new THREE.Vector3(0, 900, 300));
  const l2 = E.clone().addScaledVector(cH, 600).setY(-200);
  // 4) hacia el oeste sobre la recta final, alineándose con la recta de salida
  const c3 = P3(L - 900, 40, 160);
  const l3 = P3(L - 300, 0, 0);
  const c4 = P3(-780, -50, 175), l4 = P3(-400, 0, 10);
  void sM;
  const keys = [
    [0.0, c0, l0, 46],
    [5.0, c1, l1, 52],
    [9.6, c2, l2, 56],
    [13.4, c3, l3, 58],
    [16.6, c4, l4, 58],
  ];
  return () => keys.map(([tt, a, b, f]) => [tt, a.clone(), b.clone(), f]);
}
