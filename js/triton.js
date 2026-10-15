// TRITON CHASM · Tritón, nodo 12, sistema de Neptuno. Trazado propio (diseño de Dear), ~9,3 km, gravedad 0,079 g.
//   PIT STRAIGHT     recta de boxes sobre la llanura de hielo de nitrógeno, Neptuno a la espalda
//   CANTALOUPE       eslalon por crestas y flancos de las células del terreno «cantalupo» (pendientes de 35–41°)
//   THE CHASM        trinchera, portal y descenso por una sima enorme en la corteza de hielo de agua (dos tramos a ~45°)
//   STRATA           túnel técnico, estrecho, entre capas de hielo con vetas oscuras
//   THE LAUNCH       rampa a 55° que sale casi en vertical al cielo de Tritón y salta una grieta
//   GEYSER FIELD     penachos de nitrógeno a los lados (turbulencia: sacudida)
//   NEPTUNE STRAIGHT recta final hacia Neptuno, que domina el horizonte
// Bajo tierra: niebla de altura densa y clara (lo lejano se aclara, lo cercano queda oscuro: siluetas brutalistas).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';
import { buildRaceRings } from './rings.js';
import { QUALITY } from './quality.js';

// Planta en el sentido de carrera (x este, z sur), en metros antes de escalar. Cada punto lleva su cota (m, antes de YS).
// 0 = línea de meta, en la recta de boxes (hacia el este)
const PLAN = [
  // recta de boxes sobre la llanura de hielo de nitrógeno
  [0, 0, 0], [450, 0, 0], [900, 0, 0],
  // CANTALOUPE: curva rápida a la izquierda y eslalon entre las crestas y los flancos de las células
  [1180, -150, -10], [1250, -450, -220], [1080, -800, 110], [1250, -1150, -260], [1050, -1500, 70], [650, -1650, 170],
  // sección ondulante hacia el oeste
  [250, -1520, -120], [-150, -1700, 130], [-550, -1560, -190], [-950, -1720, 110],
  // giro al sur y chicane
  [-1300, -1550, 140], [-1380, -1180, -60], [-1150, -900, -210], [-800, -1000, -100], [-500, -860, -25],
  // curva rápida al portal y DESCENSO al abismo (dos tramos a ~45°)
  [-150, -700, -40], [300, -650, -150], [800, -620, -640], [1300, -560, -660], [1750, -350, -1050],
  // eses a media profundidad
  [1950, 0, -1060], [1800, 350, -1040],
  // túnel técnico
  [2000, 650, -1020], [1750, 950, -990], [1450, 850, -960], [1250, 1100, -920],
  // rampa casi vertical a la superficie y despegue
  [900, 1150, -440], [550, 1050, 40],
  // cierre en superficie: subidas y bajadas cortas
  [250, 880, -5], [150, 620, 110], [-100, 520, -5],
  // recta final hacia Neptuno, horquilla y vuelta a la recta de boxes
  [-600, 510, 0], [-900, 450, 0], [-1080, 250, 0], [-900, 40, 0], [-450, 0, 0],
];
export const TRI = { SCALE: 0.56, YS: 0.6, MARK: { cant: 3, wave: 9, chic: 15, portal: 18, deep: 22, tech: 25, ramp: 28, top: 30, close: 31, final: 33, hair: 36 } };

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
//  Terreno «cantalupo»: células de Voronoi (hondonadas con bordes alzados) en dos escalas, nudos y hoyuelos
// ─────────────────────────────────────────────────────────────
const CELL = 430, CELL2 = 150;
function voro(x, z, C) {
  const gx = Math.floor(x / C), gz = Math.floor(z / C);
  let d1 = 1e9, d2 = 1e9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cz = gz + j;
    const px = (cx + 0.15 + 0.7 * h2(cx, cz)) * C, pz = (cz + 0.15 + 0.7 * h2(cx + 3.1, cz + 7.7)) * C;
    const d = Math.hypot(x - px, z - pz);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return (d2 - d1) / C;                // 0 en el borde entre células, ~0,5 en el centro
}
export function cantH(x, z) {
  const e1 = voro(x, z, CELL), e2 = voro(x + 77, z - 41, CELL2);
  let h = -34 * sstep(0.02, 0.42, e1) + 15 * Math.exp(-((e1 / 0.05) ** 2));
  h += -7 * sstep(0.03, 0.4, e2) + 4 * Math.exp(-((e2 / 0.07) ** 2));
  const k = fbm(x / 38, z / 38, 3) - 0.5; h += 36 * k * Math.abs(k);
  h += 22 * (fbm(x / 1600 + 4, z / 1600, 3) - 0.5);
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
function groundMaterial(plains) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPl = { value: plains };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGW; uniform vec4 uPl[4];
      ${NOISE}`)
      .replace('void main() {', 'void main() {\n  float gBump = 0.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vGW.xz;
          float aa = clamp(1.0 - length(fwidth(p)) / 8.0, 0.0, 1.0);
          float e1 = tVor(p, ${CELL.toFixed(1)}), e2 = tVor(p + vec2(77.0, -41.0), ${CELL2.toFixed(1)});
          float a = tF(p / 1800.0), b = tF(p / 220.0 + 3.0), c = tF(p / 12.0 + 7.0);
          // cantalupo: fondo de las células gris verdoso, bordes claros amarillentos, nudos
          vec3 col = mix(vec3(0.3, 0.33, 0.3), vec3(0.5, 0.52, 0.46), smoothstep(0.25, 0.8, a * 0.6 + b * 0.4));
          col *= 0.8 + 0.35 * smoothstep(0.0, 0.4, e1);
          col = mix(col, vec3(0.8, 0.77, 0.66), exp(-pow(e1 / 0.045, 2.0)) * 0.8 + exp(-pow(e2 / 0.06, 2.0)) * 0.25 * aa);
          col *= 0.86 + 0.28 * c * aa + 0.14 * (1.0 - aa);
          // vetas oscuras de los géiseres, alargadas por el viento (hacia el noreste)
          vec2 w = vec2(dot(p, vec2(0.8, -0.6)), dot(p, vec2(0.6, 0.8)));
          float st = smoothstep(0.62, 0.8, tF(vec2(w.x / 900.0, w.y / 140.0) + 5.0));
          col = mix(col, vec3(0.16, 0.15, 0.15), st * 0.7);
          // llanura de nitrógeno (recta de boxes y recta final): hielo claro, rosado, liso
          float pl = 0.0;
          for (int i = 0; i < 2; i++) { vec2 A = uPl[i * 2].xy, B = uPl[i * 2].zw; vec2 ab = B - A; float t = clamp(dot(p - A, ab) / dot(ab, ab), 0.0, 1.0);
            pl = max(pl, 1.0 - smoothstep(uPl[i * 2 + 1].x, uPl[i * 2 + 1].y, length(p - A - ab * t))); }
          vec3 ni = vec3(0.86, 0.8, 0.77) * (0.92 + 0.12 * b) * (0.95 + 0.08 * c * aa);
          ni = mix(ni, vec3(0.7, 0.62, 0.6), smoothstep(0.6, 0.75, tF(p / 70.0)) * 0.35);
          col = mix(col, ni, pl);
          gBump = (b * 3.0 + c * 1.6 * aa) * (1.0 - pl * 0.7);
          diffuseColor.rgb = col;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(gBump), hy = dFdy(gBump);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.06, 0.09);');
  };
  m.customProgramCacheKey = () => 'triGround';
  return m;
}

// Hielo de agua de la corteza: estratos horizontales (por cota real) con vetas oscuras de amoníaco y orgánicos,
// translucidez azul muy baja y líneas de luz azul en algunos labios de los estratos.
// uv.x: índice del punto del perfil (los labios caen en .5) · uv.y: recorrido (m)
function strataMaterial(uni, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide });
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
          float y = vSW.y + (tF(vSW.xz / 160.0) - 0.5) * 18.0;
          float fy = length(fwidth(vSW));
          float aa = clamp(1.3 - fy * 0.6, 0.0, 1.0);
          float band = tN(vec2(y / 2.6, 0.5)), band2 = tN(vec2(y / 0.7, 3.0));
          vec3 col = mix(vec3(${opts.ceil ? '0.2, 0.24, 0.28' : '0.46, 0.54, 0.6'}), vec3(${opts.ceil ? '0.3, 0.35, 0.4' : '0.72, 0.8, 0.86'}), band * 0.7 + mix(0.5, band2, aa) * 0.3);
          // vetas oscuras (amoníaco, orgánicos)
          float vein = smoothstep(0.82, 0.9, tN(vec2(y / 9.0, 7.0))) * (0.6 + 0.4 * tN(vSW.xz / 30.0));
          col = mix(col, vec3(0.12, 0.1, 0.09), vein * 0.8);
          col *= 0.85 + 0.25 * tF(vec2(vSu.y / 30.0, y / 6.0));
          ${opts.floor ? 'col *= 0.35;' : ''}
          ${opts.lips ? `
          // luz azul en los labios de algunos estratos (uno de cada tres)
          float lid = floor(vSu.x), lp = fract(vSu.x);
          float on = step(mod(lid, 3.0), 0.5) * step(0.25, tH(vec2(floor(vSu.y / 80.0), lid)));
          float lw = clamp(fwidth(vSu.x) * 1.5, 0.04, 0.25);
          sGlow += vec3(0.35, 0.65, 1.0) * (1.0 - smoothstep(lw, lw * 2.0, abs(lp - 0.5))) * on * 2.2 * (0.12 / max(0.12, lw * 2.0) + 0.0);` : ''}
          // translucidez: el hielo devuelve un poco de azul
          sGlow += col * vec3(0.022, 0.04, 0.065);
          diffuseColor.rgb = col;
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += sGlow;');
  };
  m.customProgramCacheKey = () => 'triStrata' + (opts.ceil ? 'c' : '') + (opts.floor ? 'f' : '') + (opts.lips ? 'l' : '');
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
        float along = smoothstep(0.0, 0.05, y) * pow(1.0 - y, 1.4);
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
        float a = core * smoothstep(0.0, 0.03, y) * pow(1.0 - y, 1.3) * (0.25 + 1.1 * tb * tb) * 0.55;
        vec3 c = mix(vec3(0.82, 0.86, 0.9), vec3(0.42, 0.42, 0.44), smoothstep(0.35, 0.9, y));
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.85));
      }`,
  });
}

// Neptuno: azul profundo con bandas, mancha oscura, cirros blancos, borde de atmósfera cian y terminador
function neptuneMaterial(uni, center, sun, axis) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uT: uni.uT, uC: { value: center }, uSun: { value: sun }, uAx: { value: axis } },
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
      uniform float uT; uniform vec3 uC, uSun, uAx; varying vec3 vW;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vW - uC), V = normalize(cameraPosition - vW);
        float lat = asin(clamp(dot(n, uAx), -1.0, 1.0));
        vec3 e1 = normalize(cross(uAx, vec3(0.0, 0.0, 1.0))), e2 = cross(uAx, e1);
        float lon = atan(dot(n, e2), dot(n, e1)) + uT * 0.004;
        float w = tF(vec2(lon * 2.0, lat * 6.0)) * 0.35;
        float bands = tN(vec2(0.5, (lat + w * 0.25) * 9.0)) * 0.6 + tN(vec2(1.5, (lat + w * 0.15) * 23.0)) * 0.4;
        vec3 col = mix(vec3(0.07, 0.2, 0.62), vec3(0.24, 0.48, 0.92), bands);
        col = mix(col, vec3(0.42, 0.66, 0.98), smoothstep(0.65, 0.95, abs(sin(lat))) * 0.5);
        // gran mancha oscura y su nube blanca acompañante
        vec2 sp = vec2(lon - 0.6, (lat + 0.36) * 1.9);
        float spot = exp(-dot(sp, sp) / 0.012);
        col = mix(col, vec3(0.02, 0.07, 0.28), spot * 0.85);
        float sx = (lon - 0.5) / 0.09, sy = (lat + 0.28) / 0.025; float sc = exp(-sx * sx - sy * sy);
        // cirros blancos alargados
        float cir = smoothstep(0.72, 0.86, tF(vec2(lon * 9.0, lat * 70.0) + 3.0)) * smoothstep(0.1, 0.5, abs(sin(lat * 3.0)));
        col = mix(col, vec3(0.92, 0.96, 1.0), clamp(cir * 0.8 + sc * 0.9, 0.0, 1.0));
        float lam = dot(n, uSun), day = smoothstep(-0.05, 0.25, lam) * max(lam, 0.0);
        vec3 c = col * (0.008 + 1.35 * day);
        float mu = clamp(dot(n, V), 0.0, 1.0);
        c *= 0.55 + 0.45 * pow(max(mu, 1e-4), 0.35);                               // oscurecimiento del limbo
        float rim = pow(1.0 - mu, 5.0);
        c += vec3(0.3, 0.6, 1.0) * rim * smoothstep(-0.3, 0.3, lam) * 0.9;
        if (any(isnan(c))) c = vec3(0.04, 0.12, 0.4);
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Tritón entero (intro y horizonte): casquete rosado y crema con manchas oscuras, cantalupo verdoso, lado nocturno
function moonMaterial(center, sun) {
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
        vec2 q = vec2(atan(n.z, n.x), asin(clamp(n.y, -1.0, 1.0))) * 8.0;
        float a = tF(q + 2.0), b = tF(q * 4.0 + 1.0);
        float cell = tVor(q * 40.0, 1.0);
        vec3 col = mix(vec3(0.42, 0.46, 0.41), vec3(0.62, 0.64, 0.58), smoothstep(0.2, 0.85, a * 0.6 + b * 0.4));
        col = mix(col, vec3(0.78, 0.76, 0.66), exp(-pow(cell / 0.06, 2.0)) * 0.45);
        float cap = smoothstep(0.1, 0.35, dot(n, normalize(vec3(0.3, -0.2, 1.0))) + (a - 0.5) * 0.25);
        vec3 cc = mix(vec3(0.86, 0.8, 0.7), vec3(0.78, 0.7, 0.64), b);
        cc = mix(cc, vec3(0.3, 0.27, 0.26), smoothstep(0.7, 0.82, tF(q * vec2(10.0, 2.0) + 5.0)) * 0.6);
        col = mix(col, cc, cap);
        float lam = dot(n, uSun), day = smoothstep(-0.03, 0.2, lam) * max(lam, 0.0);
        vec3 c = col * (0.01 + 1.25 * day);
        c += col * vec3(0.01, 0.02, 0.05) * (1.0 - day);                 // luz de Neptuno en el lado nocturno
        float rim = pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 6.0);
        c += vec3(0.5, 0.65, 0.9) * rim * smoothstep(-0.3, 0.3, lam) * 0.18;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ─────────────────────────────────────────────────────────────
//  Cielo: el Sol (lejano, pequeño) y Neptuno (enorme, al oeste, sobre la recta final)
// ─────────────────────────────────────────────────────────────
const SUN = new THREE.Vector3(0.38, 0.4, 0.83).normalize();           // sur-sureste, bajo: sombras largas en el cantalupo
const NEP_DIR = new THREE.Vector3(-0.95, 0.26, 0.12).normalize();      // oeste, 15° sobre el horizonte
// ~13° de radio aparente: Neptuno domina el cielo. A 450 km y no más lejos: a varios millones de metros, con el plano
// cercano de la cámara a 0,25 m, la profundidad en precisión simple roza 1,0 y se recortan fragmentos (manchas negras)
const NEP_D = 4.5e5, NEP_R = 103500;
export function tritonSunDir() { return SUN.clone(); }
export const TRITON_R = 26000;                                         // radio artístico de Tritón (el real son 1353 km)

const HW = 17.6;

export function buildTriton(def, { world, own, srcMat }) {
  const T0 = performance.now();
  _seed = 53;
  const lite = QUALITY.lite;
  const lay = triLayout();
  const track = new Track(null, { points: lay.pts, inSectorOrder: false, sectors: [0, 0.15, 0.33, 0.5, 0.66, 0.83],
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

  // ── Campo de cotas que sigue a la pista de superficie (las células se hunden donde baja la pista) ──
  const ugCand = (q) => inRange(q.s, sM.portal, sM.top) && q.p.y < -50;
  const surfS = smp.filter((q) => !ugCand(q));
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const q of smp) { bx0 = Math.min(bx0, q.p.x); bx1 = Math.max(bx1, q.p.x); bz0 = Math.min(bz0, q.p.z); bz1 = Math.max(bz1, q.p.z); }
  const MARG = 1500, gx0 = bx0 - MARG, gx1 = bx1 + MARG, gz0 = bz0 - MARG, gz1 = bz1 + MARG;
  const BR = 40, bnx = Math.ceil((gx1 - gx0) / BR) + 1, bnz = Math.ceil((gz1 - gz0) / BR) + 1, Bg = new Float32Array(bnx * bnz);
  {
    const sub = surfS.filter((_, i) => i % 3 === 0), hsh = mkHash(sub), SIG = 230, R3 = SIG * 3;
    for (let j = 0; j < bnz; j++) for (let i = 0; i < bnx; i++) {
      const x = gx0 + i * BR, z = gz0 + j * BR; let sw = 0, sy = 0;
      const n = Math.ceil(R3 / CELLH), cx = Math.floor(x / CELLH), cz = Math.floor(z / CELLH);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = hsh.get(`${cx + a},${cz + b}`); if (l) for (const q of l) { const d2 = (q.p.x - x) ** 2 + (q.p.z - z) ** 2; if (d2 > R3 * R3) continue; const w = Math.exp(-d2 / (2 * SIG * SIG)); sw += w; sy += w * q.p.y; } }
      Bg[j * bnx + i] = sy / (sw + 6);
    }
  }
  const Bf = (x, z) => {
    const fx = THREE.MathUtils.clamp((x - gx0) / BR, 0, bnx - 1.001), fz = THREE.MathUtils.clamp((z - gz0) / BR, 0, bnz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = j * bnx + i;
    return lerp(lerp(Bg[o], Bg[o + 1], u), lerp(Bg[o + bnx], Bg[o + bnx + 1], u), v);
  };
  // llanuras: la recta de boxes (de la horquilla al final de la recta) y la recta final
  const plainSeg = [[P3(sM.hair + 60), P3(sM.cant - 120)], [P3(sM.final + 20), P3(sM.hair - 40)]];
  const plainD = (x, z) => Math.min(...plainSeg.map(([A, B]) => { const abx = B.x - A.x, abz = B.z - A.z; const t = THREE.MathUtils.clamp(((x - A.x) * abx + (z - A.z) * abz) / (abx * abx + abz * abz), 0, 1); return Math.hypot(x - A.x - abx * t, z - A.z - abz * t); }));
  const natural = (x, z) => Bf(x, z) + cantH(x, z) * sstep(140, 520, plainD(x, z));

  // ── Bajo tierra: del primer punto con más de 45 m de roca encima tras el portal al último antes de la cima ──
  const depthAt = (q) => natural(q.p.x, q.p.z) - q.p.y;
  let sIn = null, sOut = null;
  for (const q of smp) if (inRange(q.s, sM.portal, sM.top) && depthAt(q) > 45) { if (sIn === null) sIn = q.s; sOut = q.s; }
  sIn = Math.ceil(sIn / 6) * 6; sOut = Math.floor(sOut / 6) * 6;
  const ug = (q) => inRange(track.wrap(q), sIn, sOut);
  const gapS0 = sM.top + 14, gapS1 = sM.top + 104;
  track.gaps = [{ s0: gapS0, s1: gapS1 }];
  const inGap = (q) => inRange(track.wrap(q), gapS0 - 6, gapS1 + 6);
  const surfHash = mkHash(smp.filter((q) => !ug(q.s)));
  // terreno final: en el pasillo de la pista el hielo se ajusta al tablero (rampas y trincheras de hielo reforzado);
  // bajo el salto, una grieta; en las bocas del túnel, el frente vertical de la corteza
  const terrain = (x, z) => {
    const nat = natural(x, z);
    const { q } = nearIn(surfHash, x, z, 260); if (!q) return nat;
    const dx = x - q.p.x, dz = z - q.p.z, lat = Math.abs(dx * q.r.x + dz * q.r.z), along = dx * q.t.x + dz * q.t.z;
    if ((Math.abs(track.delta(sIn, q.s)) < 6 && along > 0) || (Math.abs(track.delta(sOut, q.s)) < 6 && along < 0)) return nat;
    let ty = q.p.y - 1.6;
    if (inGap(q.s)) ty = q.p.y - 60 + 30 * sstep(HW + 4, HW + 40, lat);
    const w = lat < HW + 6 ? 1 : sstep(HW + 6 + Math.max(36, Math.abs(nat - ty) * 1.1), HW + 6, lat);
    return lerp(nat, ty, w);
  };

  // ── Malla del terreno (losetas) ──
  const ground = groundMaterial(plainSeg.flatMap(([A, B]) => [new THREE.Vector4(A.x, A.z, B.x, B.z), new THREE.Vector4(140, 520, 0, 0)])); own.push(ground);
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
  heightGrid(terrain, GRES, ground, !lite, [gx0, gx1, gz0, gz1]);
  const OUT = 20000, ORES = lite ? 900 : 500;
  const inInner = (x, z) => x > gx0 + 2 && x < gx1 - 2 && z > gz0 + 2 && z < gz1 - 2;
  heightGrid((x, z) => (inInner(x, z) ? terrain(x, z) : cantH(x, z) * 0.6 - 2 - 500 * sstep(OUT - 6000, OUT, Math.hypot(x, z))), ORES, ground, false, [-OUT, OUT, -OUT, OUT], (x, z) => inInner(x - ORES * 0.5, z - ORES * 0.5) && inInner(x + ORES * 0.5, z + ORES * 0.5) || Math.hypot(x, z) > OUT);

  // ── Tritón entero (intro y horizonte) ──
  const MC = new THREE.Vector3(0, -TRITON_R, 0);
  {
    const mm = moonMaterial(MC, SUN); own.push(mm);
    const sg = new THREE.SphereGeometry(TRITON_R, lite ? 160 : 256, lite ? 80 : 128);
    sg.translate(0, -TRITON_R - 40, 0);
    const p = sg.attributes.position, idx = sg.index.array, keep = [];
    const inside = (i) => p.getY(i) > -TRITON_R && Math.hypot(p.getX(i), p.getZ(i)) < OUT - 6500;
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    sg.setIndex(keep); sg.deleteAttribute('uv'); sg.computeBoundingSphere();
    const mesh = new THREE.Mesh(sg, mm); mesh.frustumCulled = false; mesh.renderOrder = -1; world.add(mesh); own.push(sg);
  }
  // ── Neptuno y sus anillos tenues ──
  const nepC = NEP_DIR.clone().multiplyScalar(NEP_D);
  const nepAx = new THREE.Vector3(0.25, 1, -0.35).normalize();
  {
    const nm = neptuneMaterial(uni, nepC, SUN, nepAx); own.push(nm);
    // sin escribir profundidad: a 3 millones de metros la oclusión ambiental (N8AO) pierde precisión y deja manchas negras
    nm.depthWrite = false;
    const nep = new THREE.Mesh(new THREE.SphereGeometry(NEP_R, 160, 80), nm); nep.position.copy(nepC); nep.frustumCulled = false; nep.renderOrder = -2; world.add(nep); own.push(nep.geometry);
    const ringM = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uC: { value: nepC }, uR: { value: NEP_R }, uSun: { value: SUN } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uC, uSun; uniform float uR; varying vec2 vUv; varying vec3 vW;
        void main(){
          #include <logdepthbuf_fragment>
          float r = vUv.x;
          float q1 = (r - 0.2) / 0.012, q2 = (r - 0.62) / 0.008, q3 = (r - 0.95) / 0.02; float a = exp(-q1 * q1) * 0.5 + exp(-q2 * q2) * 0.35 + exp(-q3 * q3) * 0.6;
          float qa = sin((vUv.y - 0.15) * 3.14159) / 0.12; float arc = 1.0 + 1.6 * exp(-qa * qa) * step(0.9, r);
          // detrás del disco de Neptuno (visto desde la cámara) no se dibuja: el planeta no escribe profundidad
          vec3 ro = cameraPosition, rd = normalize(vW - ro); vec3 oc = ro - uC; float bq = dot(oc, rd), cq = dot(oc, oc) - uR * uR, dq = bq * bq - cq;
          if (dq > 0.0) { float th = -bq - sqrt(dq); if (th > 0.0 && th < length(vW - ro)) discard; }
          vec3 rel = vW - uC; float t = dot(rel, uSun); vec3 perp = rel - uSun * t;
          float sh = (t < 0.0 && length(perp) < uR) ? 0.05 : 1.0;
          gl_FragColor = vec4(vec3(0.75, 0.8, 0.88), a * arc * 0.16 * sh);          // en la sombra de Neptuno el anillo desaparece (no se oscurece)
        }`,
    });
    own.push(ringM);
    const RS = 24, AS = 400, pos = [], uv = [], idx = [], r0 = NEP_R * 1.7, r1 = NEP_R * 2.55;
    const e1 = new THREE.Vector3().crossVectors(nepAx, new THREE.Vector3(1, 0, 0)).normalize(), e2 = new THREE.Vector3().crossVectors(nepAx, e1).normalize();
    for (let i = 0; i <= RS; i++) { const u = i / RS, r = r0 + (r1 - r0) * u; for (let j = 0; j <= AS; j++) { const a = j / AS * Math.PI * 2; const p = nepC.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r); pos.push(p.x, p.y, p.z); uv.push(u, j / AS); } }
    for (let i = 0; i < RS; i++) for (let j = 0; j < AS; j++) { const a = i * (AS + 1) + j, b = a + 1, c = a + AS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
    const ring = new THREE.Mesh(gg, ringM); ring.frustumCulled = false; ring.renderOrder = -1; world.add(ring); own.push(gg);
  }
  // espacio: cáscara negra delante de la cúpula del cielo (la niebla sigue usando su color claro bajo tierra),
  // con un halo tenue de la bruma de Tritón justo sobre el horizonte; y el Sol, pequeño y blanco a 30 UA
  {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vDir; void main(){ vec3 d = normalize(vDir); float h = d.y; vec3 c = vec3(0.16, 0.22, 0.3) * exp(-max(h, 0.0) / 0.018) * smoothstep(-0.012, 0.0, h) * 0.55 * (1.0 - smoothstep(400.0, 2500.0, cameraPosition.y)); gl_FragColor = vec4(c, 1.0); }',
    }));
    shell.renderOrder = -999; shell.frustumCulled = false;
    shell.onBeforeRender = (r, sc, cam) => { shell.position.copy(cam.position); shell.updateMatrixWorld(); };
    world.add(shell); own.push(shell.geometry, shell.material);
    const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    own.push(dot);
    const sm = new THREE.SpriteMaterial({ map: dot, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: false });
    const sun = new THREE.Sprite(sm); sun.position.copy(SUN).multiplyScalar(6e6); sun.scale.setScalar(0.06); sun.renderOrder = -3; sun.frustumCulled = false; world.add(sun); own.push(sm);
  }
  // estrellas
  {
    const n = 7000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(6.5e6);
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
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x5c646c))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xc4ccd2))),
    frame: srcMat('S6 | Charcoal structure', (m) => m.color.setHex(0x1f2328)),
    edge: srcMat('S6 | Satin silver edges', (m) => m.color?.setHex(0xd2d8de)),
    gate: srcMat('S6 | Muted cyan checkpoints', (m) => { m.emissive?.setRGB(0.4, 0.75, 1.0); m.emissiveIntensity = 2.6; }),
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
  const solid = [[gapS1, gapS0 + L]];
  const deckProf = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  for (const [a, b] of solid) {
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
  for (let q = 5; q < L; q += 24) if (!inGap(q)) for (const x of [-16.2, 16.2]) boxAt(q, x, 1.0, 0.28, 0.4, 1.3, parts.buoy);
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

  // ── Materiales de estructura ──
  const SM = {
    steel: new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.55, metalness: 0.75 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x4c535a, roughness: 0.7, metalness: 0.35, emissive: 0x06080a }),
    slab: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.9, metalness: 0.05, emissive: 0x05070a }),
    pale: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.82, metalness: 0.05, emissive: 0x161c22 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xc98a12, roughness: 0.55, metalness: 0.1, emissive: 0x2a1802 }),
    cold: new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x7fc4ff, emissiveIntensity: 3.2 }),
    white: new THREE.MeshStandardMaterial({ color: 0x101418, emissive: 0xe6f2ff, emissiveIntensity: 3.0 }),
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

  // ── La sima y los túneles: secciones cada 6 m en el marco horizontal (anchura W, techo H, abismo D) ──
  const STEP = 6, G6 = [];
  for (let q = sIn; q <= sOut; q += STEP) {
    track.sample(q, F);
    const p = F.pos.clone(), tH = F.tan.clone().setY(0).normalize(), rH = new THREE.Vector3().crossVectors(tH, new THREE.Vector3(0, 1, 0)).normalize();
    let W = 150, H = 220, D = 330, kind = 'chasm';
    if (inRange(q, sM.deep, sM.tech)) { W = 95; H = 130; D = 190; kind = 'mid'; }
    if (inRange(q, sM.tech, sM.ramp - 40)) { W = 27; H = 26; D = 8; kind = 'tech'; }
    if (inRange(q, sM.ramp - 40, sOut + 10)) { W = 34; H = 44; D = 24; kind = 'shaft'; }
    W += (kind === 'chasm' ? 50 : 18) * (fbm(q / 300, 1.3, 2) - 0.5);
    G6.push({ q, p, tH, rH, W, H, D, kind, k: Math.abs(F.kappa), dep: natural(p.x, p.z) - p.y });
  }
  const NG = G6.length;
  {
    const lim = G6.map((g, i) => { let km = 0; for (let j = -10; j <= 10; j++) km = Math.max(km, G6[Math.min(NG - 1, Math.max(0, i + j))].k); return km > 1e-5 ? 0.82 / km : 1e9; });
    const ugHash = mkHash(G6.map((g) => ({ p: g.p, s: g.q })));
    const clr = G6.map((g) => { let best = Infinity; const n = Math.ceil(400 / CELLH), cx = Math.floor(g.p.x / CELLH), cz = Math.floor(g.p.z / CELLH);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const l = ugHash.get(`${cx + a},${cz + b}`); if (l) for (const o of l) { if (Math.abs(o.s - g.q) < 300 || Math.abs(o.p.y - g.p.y) > 260) continue; best = Math.min(best, Math.hypot(o.p.x - g.p.x, o.p.z - g.p.z)); } }
      return best; });
    const Hl = G6.map((g) => { let t = Infinity; for (const x of [-g.W, 0, g.W]) t = Math.min(t, natural(g.p.x + g.rH.x * x, g.p.z + g.rH.z * x)); return t - 28 - g.p.y; });
    const ero = (a, w) => a.map((_, i) => { let m = Infinity; for (let k = -w; k <= w; k++) m = Math.min(m, a[Math.min(NG - 1, Math.max(0, i + k))]); return m; });
    const avg = (a, w) => a.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += a[Math.min(NG - 1, Math.max(0, i + k))]; return s / (2 * w + 1); });
    const mouth = G6.map((g) => 1 - sstep(45, 140, g.dep));             // bocas: túnel estrecho junto a la superficie
    let W = G6.map((g, i) => Math.min(g.W, lim[i], isFinite(clr[i]) ? Math.max(22, clr[i] / 2 - 12) : 1e9));
    W = avg(ero(W, 10), 10).map((w, i) => lerp(w, 22, mouth[i]));
    const H = avg(ero(G6.map((g, i) => Math.max(17, Math.min(lerp(g.H, 18, mouth[i]), Hl[i]))), 8), 8);
    const D = avg(ero(G6.map((g, i) => lerp(g.D, 4, mouth[i])), 8), 8);
    G6.forEach((g, i) => { g.W = Math.max(21, W[i]); g.H = Math.max(16, H[i]); g.D = Math.max(3, D[i]); });
  }
  const gAt = (q) => G6[Math.min(NG - 1, Math.max(0, Math.round((q - sIn) / STEP)))];
  const CW = strataMaterial(uni, { lips: true }), CC = strataMaterial(uni, { ceil: true }), CF = strataMaterial(uni, { floor: true });
  own.push(CW, CC, CF);
  // muros en estratos: labios redondeados que sobresalen, en número fijo por sección (repartidos entre el fondo y el techo)
  const NL = 14;
  const wallProf = (g, sd) => {
    const out = [], span = g.H - 6 + g.D;
    for (let k = 0; k <= NL; k++) {
      const h0 = -g.D + span * k / NL, lip = (2.2 + 2.6 * h2(k, Math.round(g.q / 60))) * Math.min(1, g.W / 40);
      out.push([sd * g.W, h0, k], [sd * (g.W - lip), h0 + span / NL * 0.35, k + 0.5], [sd * (g.W - lip * 0.6), h0 + span / NL * 0.55, k + 0.5]);
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

  // portales: frente de hormigón brutalista con la boca y franjas de luz azul (al final de la trinchera y en la salida)
  const portal = (q) => {
    const g = gAt(q), top = Math.max(26, natural(g.p.x, g.p.z) + 6 - g.p.y);
    const fw = 70, hw = 21, ht = 18;
    for (const [x, h, w, hh] of [[-(fw + hw) / 2, top / 2 - 4, fw - hw, top + 8], [(fw + hw) / 2, top / 2 - 4, fw - hw, top + 8], [0, (ht + top) / 2, hw * 2, top - ht]]) hbox(g, x, h, w, hh, 8, arch.slab);
    hbox(g, 0, ht + 2, hw * 2 + 10, 4, 10, arch.steel);
    hbox(g, 0, ht + 0.4, hw * 2, 0.4, 10.4, arch.cold);
    for (const x of [-hw - 2, hw + 2]) { hbox(g, x, ht / 2, 2.4, ht, 10.4, arch.steel); hbox(g, x, ht / 2, 0.4, ht, 10.8, arch.cold); }
    for (const x of [-hw - 10, hw + 10]) hbox(g, x, 1.5, 6, 3, 10.6, arch.hazard);
    for (const sd of [-1, 1]) for (const k of [0, 1]) hbox(g, sd * (hw + 16 + k * 14), top * 0.35, 4, top * 0.7, 26, arch.slab, sd * -0.18);
  };
  portal(sIn); portal(sOut);

  // ── Vestido: pilares colosales en la sima, pórticos y celosías sobre el tablero, pasarelas, haces de luz ──
  const beamsC = [], beamsW = [];
  G6.forEach((g) => {
    const i = Math.round(g.q / STEP), big = g.kind === 'chasm' || g.kind === 'mid';
    if (g.dep < 70) return;
    if (big ? i % 24 === 0 : i % 8 === 0) {
      const h = big ? Math.min(g.H - 8, 42 + 30 * h2(i, 2)) : g.H - 3;
      hbox(g, 0, h, g.W * 2 - 4, 2.4, 2.2, arch.steel);
      if (big) { for (let x = -g.W + 8; x < g.W - 6; x += 9) hbox(g, x, h - 4, 0.5, 6, 0.5, arch.grey, Math.round(x / 9) % 2 ? 0.6 : -0.6); hbox(g, 0, h - 6.5, g.W * 2 - 4, 1.2, 1.6, arch.steel); }
      hbox(g, 0, h - 1.6, 1.4, 0.5, 1.4, arch.white);
      for (const x of [-17.3, 17.3]) { const a = P3(g.q, x, 1.9); cyl(a, new THREE.Vector3(a.x, g.p.y + h - 1.2, a.z), 0.3, arch.steel, 6); }
    }
    if (big && i % 13 === 3) for (const sd of [-1, 1]) if (h2(i, sd) > 0.35) {
      const x = sd * (24 + Math.max(0, g.W - 34) * h2(i, sd + 4)), r = 4 + 7 * h2(i, 9);
      const base = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y - g.D, g.p.z + g.rH.z * x), top = base.clone().setY(g.p.y + g.H + 4);
      cyl(base, top, r, arch.slab, 8, r * 0.8);
      const lb = new THREE.BoxGeometry(r * 2.2, 1.2, r * 2.2); lb.translate(base.x, g.p.y - g.D * 0.4, base.z); arch.cold.push(lb);
      if (h2(i, 11) > 0.5) { const rb = new THREE.BoxGeometry(1.4, 1.4, 1.4); rb.translate(top.x, g.p.y + g.H * 0.7, top.z); arch.red.push(rb); }
    }
    if (big && i % 31 === 17) {
      const h = (h2(i, 5) < 0.5 ? -1 : 1) * (30 + 50 * h2(i, 6));
      if (h < g.H - 6 && h > -g.D + 10) { hbox(g, 0, h, g.W * 2, 2, 4, arch.steel); for (let x = -g.W + 6; x < g.W - 4; x += 11) hbox(g, x, h - 1.2, 0.8, 0.3, 0.8, arch.cold); }
    }
    if (i % 4 === 0 && g.D > 10) hbox(g, 0, -3.4, 8, 3.4, STEP * 4.05, arch.steel);
    if (big && i % 6 === 3) for (const x of [-17.1, 17.1]) { const a = P3(g.q, x, -1.2), c = new THREE.Vector3(a.x, g.p.y + g.H, a.z); cyl(a, c, 0.22, arch.grey, 5); }
    if (big && i % 19 === 7 && g.H > 50) {
      const x = (h2(i, 9) - 0.5) * g.W * 1.4, top = new THREE.Vector3(g.p.x + g.rH.x * x, g.p.y + g.H - 1, g.p.z + g.rH.z * x);
      const len = g.H + g.D * 0.7, r0 = 3, r1 = 20 + 18 * h2(i, 2);
      const gg = new THREE.CylinderGeometry(r0, r1, len, 18, 1, true); gg.translate(0, -len / 2, 0);
      const uvb = gg.attributes.uv; for (let k = 0; k < uvb.count; k++) uvb.setY(k, 1 - uvb.getY(k));
      gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3((h2(i, 4) - 0.5) * 0.3, -1, 0).normalize())); gg.translate(top.x, top.y, top.z);
      (h2(i, 6) < 0.7 ? beamsC : beamsW).push(gg);
      hbox(g, x, g.H - 0.6, 6, 1, 6, arch.white);
    }
    if (g.kind === 'tech' && i % 3 === 0) { hbox(g, -g.W + 0.8, g.H * 0.45, 1.2, g.H * 0.9, 1.2, arch.steel); hbox(g, g.W - 0.8, g.H * 0.45, 1.2, g.H * 0.9, 1.2, arch.steel); hbox(g, 0, g.H - 0.8, g.W * 2, 1.2, 1.2, arch.steel); if (i % 6 === 0) hbox(g, 0, g.H - 1.6, 6, 0.3, 0.6, arch.cold); }
    if (g.kind === 'shaft' && i % 7 === 0) { hbox(g, 0, g.H - 1, g.W * 2 - 2, 1.6, 1.4, arch.steel); for (const x of [-g.W + 1.4, g.W - 1.4]) hbox(g, x, g.H * 0.3, 0.5, g.H * 0.5, 0.5, arch.cold); }
  });
  // fachadas brutalistas incrustadas en los muros de la sima (bloques con ventanucos), como una ciudad excavada
  G6.forEach((g) => {
    const i = Math.round(g.q / STEP); if (g.kind !== 'chasm' && g.kind !== 'mid') return; if (g.dep < 120 || i % 9 !== 0) return;
    for (const sd of [-1, 1]) {
      if (h2(i, sd * 3) < 0.25) continue;
      const n = 2 + Math.floor(h2(i, sd * 5) * 4);
      for (let k = 0; k < n; k++) {
        const w = 6 + 18 * h2(i + k, sd), hh = 8 + 26 * h2(i - k, sd + 2), dd = 10 + 22 * h2(i * 3 + k, sd);
        const h = -g.D * 0.8 + (g.H + g.D * 0.8 - 30) * h2(i * 7 + k, sd + 9);
        const x = sd * (g.W - w / 2 + 1);
        const bx = hbox(g, x, h, w, hh, dd, arch.slab); void bx;
        const rows = Math.floor(hh / 4);
        for (let r = 1; r < rows; r++) if (h2(i + r, k + sd) > 0.45) hbox(g, sd * (g.W - w - 0.3) + sd * 0.1, h - hh / 2 + r * 4, 0.3, 0.7, dd * (0.3 + 0.5 * h2(r, k)), h2(r, i) > 0.85 ? arch.cold : arch.white);
        if (h2(i, k + 13) > 0.7) hbox(g, sd * (g.W - w - 4), h + hh / 2 + 0.4, 8, 0.8, 1.2, arch.steel);
      }
    }
  });
  // carteles pintados en los muros
  {
    const labels = ['TC-12', '−400 M', 'N2 / H2O', 'CHASM 3', 'AG LOCK', 'LEVEL 7', 'NO ENTRY', 'STRATA', 'SHAFT B', '1353', 'KEEP CLEAR', 'TRITON'];
    const c = document.createElement('canvas'); c.width = 1024; c.height = 768; const x2 = c.getContext('2d');
    x2.fillStyle = '#000'; x2.fillRect(0, 0, 1024, 768); x2.fillStyle = '#fff'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    labels.forEach((t, k) => { const col = k % 2, row = Math.floor(k / 2); x2.font = `bold ${t.length > 6 ? 70 : 104}px "Arial Narrow", Impact, sans-serif`; x2.fillText(t, 256 + col * 512, 64 + row * 128); });
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; own.push(tex);
    const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.25, 0.38, 0.5), side: THREE.DoubleSide });
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
  {
    const mC = beamMaterial(uni, [0.55, 0.78, 1.0], 0.07), mW = beamMaterial(uni, [0.85, 0.92, 1.0], 0.05); own.push(mC, mW);
    for (const [l, m] of [[beamsC, mC], [beamsW, mW]]) { if (!l.length) continue; const gg = mergeGeometries(l, false); l.forEach((q) => q.dispose()); const mesh = new THREE.Mesh(gg, m); mesh.renderOrder = 5; mesh.frustumCulled = false; world.add(mesh); own.push(gg); }
  }

  // humo que flota en la sima: velos grandes y tenues que se mueven despacio (lo lejano se pierde en la bruma clara)
  const smokes = [];
  {
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    own.push(tex);
    for (const g of G6) {
      const i = Math.round(g.q / STEP); if ((g.kind !== 'chasm' && g.kind !== 'mid') || g.dep < 120 || i % (lite ? 10 : 5) !== 0) continue;
      const x = (h2(i, 1) - 0.5) * g.W * 1.6, h = -g.D * 0.9 + (g.D * 0.9 + g.H * 0.5) * h2(i, 2);
      if (Math.abs(x) < 26 && Math.abs(h) < 20) continue;                 // fuera del pasillo de la nave
      const m = new THREE.SpriteMaterial({ map: tex, color: 0xb8cce0, transparent: true, opacity: 0.08 + 0.1 * h2(i, 3), depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m); sp.position.set(g.p.x + g.rH.x * x, g.p.y + h, g.p.z + g.rH.z * x); sp.scale.setScalar(70 + 160 * h2(i, 4)); sp.renderOrder = 4;
      world.add(sp); own.push(m); smokes.push({ sp, base: sp.position.clone(), ph: h2(i, 5) * 6.28 });
    }
  }

  // ── Superficie: boxes y tribuna en la recta de boxes, pilotes bajo el tablero alzado, mástiles de luz ──
  {
    const sA = L - 520, sB = L - 120;
    for (let q = sA; q < sB; q += 40) {
      const g = hframe(q);
      hbox(g, -44, 7, 22, 18, 40.5, arch.slab); hbox(g, -32.9, 8, 0.3, 4, 36, arch.cold); hbox(g, -44, 16.6, 24, 1.2, 41, arch.steel);
      if (Math.round(q / 40) % 3 === 0) { hbox(g, -44, 34, 3, 36, 3, arch.steel); hbox(g, -44, 52.5, 5, 1.5, 5, arch.white); }
    }
    for (let q = sA + 80; q < sB - 40; q += 40) { const g = hframe(q); for (let k = 0; k < 6; k++) hbox(g, 34 + k * 3.5, 1.5 + k * 2.2, 3.5, 3 + k * 4.4, 40.5, arch.pale); hbox(g, 46, 18, 22, 1, 40.5, arch.steel); }
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
  }

  // ── Géiseres de nitrógeno junto a la salida del pozo ──
  const geysers = [];
  {
    const pm = plumeMaterial(uni); own.push(pm);
    const tubes = [];
    const ex = P3(sOut), wind = new THREE.Vector3(0.8, 0, -0.6).normalize();
    for (let k = 0, tries = 0; k < (lite ? 5 : 8) && tries < 400; tries++) {
      const a = rnd() * Math.PI * 2, r = 380 + rnd() * 1600, x = ex.x + Math.cos(a) * r, z = ex.z + Math.sin(a) * r;
      if (nearIn(surfHash, x, z, 300).d < 220) continue;
      const gy = terrain(x, z) - 4, h = 900 + rnd() * 1800, bend = 0.35 + rnd() * 0.4;
      const pts = []; for (let j = 0; j <= 16; j++) { const t = j / 16; pts.push(new THREE.Vector3(x + wind.x * h * bend * t * t * 1.6, gy + h * (t < 0.7 ? t / 0.7 : 1 + (t - 0.7) * 0.15), z + wind.z * h * bend * t * t * 1.6)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tg = new THREE.TubeGeometry(curve, 48, 1, 16, false);
      const pp = tg.attributes.position, uvp = tg.attributes.uv;
      for (let i = 0; i < pp.count; i++) { const t = uvp.getX(i), c = curve.getPointAt(Math.min(1, t)); const dx = pp.getX(i) - c.x, dy = pp.getY(i) - c.y, dz = pp.getZ(i) - c.z; const rr = 14 + 220 * Math.pow(t, 1.5); pp.setXYZ(i, c.x + dx * rr, c.y + dy * rr, c.z + dz * rr); }
      tg.computeVertexNormals();
      tubes.push(tg); geysers.push(new THREE.Vector3(x, gy, z));
      const vent = new THREE.CylinderGeometry(10, 18, 4, 14); vent.translate(x, gy + 2, z); arch.slab.push(vent);
      k++;
    }
    if (tubes.length) { const gg = mergeGeometries(tubes, false); tubes.forEach((t) => t.dispose()); const m = new THREE.Mesh(gg, pm); m.renderOrder = 6; m.frustumCulled = false; world.add(m); own.push(gg); }
  }

  // fusiona estructuras
  for (const [k, list] of Object.entries(arch)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((q) => { for (const a of Object.keys(q.attributes)) if (!['position', 'normal'].includes(a)) q.deleteAttribute(a); if (q.index === null) q.setIndex([...Array(q.attributes.position.count).keys()]); return q; }), false);
    list.forEach((q) => q.dispose()); gg.computeVertexNormals();
    const mesh = new THREE.Mesh(gg, SM[k]); mesh.castShadow = ['steel', 'slab', 'grey', 'pale'].includes(k) && !lite; mesh.receiveShadow = true; world.add(mesh); own.push(gg);
  }

  // ── Anillo de cohetes en el fondo de la sima ──
  const rr = buildRaceRings(world, track, [sM.deep + 60], own, { kind: 'rockets', R: 17, lift: 8, color: [0.45, 0.75, 1.0] });
  for (const g of rr.gates) g.ammo = 2;

  // ── Zonas con nombre ──
  const zones = [
    [sM.cant - 150, 'CANTALOUPE', ['Crestas y células del hielo', 'Ridges and cells of the ice']],
    [sIn - 260, 'THE CHASM', ['Descenso en la corteza de hielo de agua', 'Descent into the water-ice crust']],
    [sM.tech - 120, 'STRATA', ['Túnel técnico', 'Technical tunnel']],
    [sM.ramp - 150, 'THE LAUNCH', ['Rampa a 55° · mantén la velocidad', '55° ramp · keep your speed']],
    [sM.close + 40, 'GEYSER FIELD', ['Géiseres de nitrógeno', 'Nitrogen geysers']],
    [sM.final + 10, 'NEPTUNE STRAIGHT', ['Neptuno en el horizonte', 'Neptune on the horizon']],
  ].map(([q, title, sub]) => ({ s: track.wrap(q), title, sub }));

  const prevS = new Map(), gustT = new Map();
  const fx = {
    t: 0, gates: rr.gates, zones,
    update(dt) { this.t += dt; uni.uT.value = this.t; rr.update(dt); for (const o of smokes) { o.sp.position.set(o.base.x + Math.sin(this.t * 0.05 + o.ph) * 25, o.base.y + Math.sin(this.t * 0.07 + o.ph * 2) * 8, o.base.z + Math.cos(this.t * 0.04 + o.ph) * 25); o.sp.material.rotation += dt * 0.01; } },
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevS.delete(sh); continue; }
        const p = prevS.get(sh) ?? sh.s;
        for (const z of zones) { const d0 = track.delta(p, z.s), d1 = track.delta(sh.s, z.s); if (d0 > 0 && d1 <= 0 && d1 > -60) onPass?.(sh, { kind: 'banner', title: z.title, sub: z.sub }); }
        prevS.set(sh, sh.s);
        // turbulencia junto a los géiseres: sacudida suave
        if (sh.player && geysers.length && this.t - (gustT.get(sh) ?? -9) > 0.5) {
          let dmin = Infinity; for (const gp of geysers) dmin = Math.min(dmin, Math.hypot(gp.x - sh.root.position.x, gp.z - sh.root.position.z));
          if (dmin < 700) { gustT.set(sh, this.t); onPass?.(sh, { kind: 'shake', k: 0.22 * (1 - dmin / 700) }); }
        }
      }
      rr.passRings(ships, onPass);
    },
    reset() { prevS.clear(); gustT.clear(); rr.reset(); },
  };

  const introKeys = makeIntro({ P3, MC, nepC, sOut, L });
  let ymin = Infinity, ymax = -Infinity; for (const q of smp) { ymin = Math.min(ymin, q.p.y); ymax = Math.max(ymax, q.p.y); }
  console.info(`[SRS] TRITON CHASM: ${L.toFixed(0)} m · cota ${ymin.toFixed(0)}…${ymax.toFixed(0)} m · bajo tierra ${Math.round(sIn)}–${Math.round(sOut)} · salto ${Math.round(gapS0)}–${Math.round(gapS1)} · géiseres ${geysers.length} · ${(performance.now() - T0).toFixed(0)} ms`);
  return { track, ground: (x, z) => terrain(x, z), tunnel: { s: sIn, len: sOut - sIn }, ownTunnel: true, bridges: 0, introKeys, fx,
    dbg: { G6, sIn, sOut, sM, geysers, natural, terrain } };
}

// ── Intro: Neptuno enorme con Tritón en creciente delante; bajada sobre el cantalupo con Neptuno de frente; los géiseres;
//    la recta final hacia Neptuno; giro amplio sobre la horquilla y llegada por detrás de la parrilla ──
function makeIntro({ P3, MC, nepC, sOut, L }) {
  const up = new THREE.Vector3(0, 1, 0);
  const nH = new THREE.Vector3(NEP_DIR.x, 0, NEP_DIR.z).normalize();
  const side = new THREE.Vector3().crossVectors(up, nH).normalize();
  const c0 = MC.clone().addScaledVector(nH, -95000).addScaledVector(up, 42000).addScaledVector(side, 18000);
  const l0 = nepC.clone().addScaledVector(up, -NEP_R * 0.35);
  const c1 = new THREE.Vector3(0, 9000, 0).addScaledVector(nH, -14000).addScaledVector(side, 3000);
  const l1 = nepC.clone().addScaledVector(up, -NEP_R * 0.9);
  const ex = P3(sOut);
  const c2 = ex.clone().addScaledVector(nH, -1400).setY(ex.y + 420);
  const l2 = ex.clone().addScaledVector(nH, 1200).setY(ex.y - 80);
  const f0 = P3(L - 1400), f1 = P3(L - 1700);
  const c3 = f0.clone().setY(f0.y + 160).addScaledVector(side, 60);
  // en la horquilla la cámara gira con la pista (oeste → norte → este) mirando a la misma distancia: sin barridos
  const W = new THREE.Vector3(-1, 0, 0), Nn = new THREE.Vector3(0, 0, -1);
  const l3 = c3.clone().addScaledVector(W, 520).setY(c3.y - 70);
  const h0 = P3(L - 1000);
  const c4 = h0.clone().addScaledVector(nH, 300).addScaledVector(Nn, -120).setY(h0.y + 185);
  const l4 = c4.clone().addScaledVector(Nn, 520).addScaledVector(W, 120).setY(c4.y - 90);
  const c5 = P3(-780, -50, 175), l5 = P3(-400, 0, 10);
  void f1;
  const keys = [
    [0.0, c0, l0, 30],
    [5.0, c1, l1, 44],
    [9.5, c2, l2, 56],
    [13.0, c3, l3, 58],
    [16.2, c4, l4, 60],
    [19.0, c5, l5, 58],
  ];
  return () => keys.map(([tt, a, b, f]) => [tt, a.clone(), b.clone(), f]);
}
