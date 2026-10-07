// Atmósfera: cielo lechoso, niebla de altura por capas, lunas veladas, lava, agua y basalto.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const A = CONFIG.atmosphere;          // se muta al cambiar de circuito (applyAtmosphere)
const f = (n) => Number(n).toFixed(6);
const v3 = (c) => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

// Función de cielo compartida por la cúpula, la niebla y las lunas → todo casa con el horizonte.
export function skyGLSL() {
  const S = A.sunDir, K = A.sky;
  return /* glsl */`
  const vec3 SUN_DIR = vec3(${f(S.x)}, ${f(S.y)}, ${f(S.z)});
  const vec3 SKY_HORIZON = ${v3(K.horizon)};
  vec3 skyColor(vec3 d) {
    float h = d.y;
    vec3 c = mix(SKY_HORIZON, ${v3(K.zenith)}, smoothstep(${f(K.zLow)}, ${f(K.zHigh)}, h));
    c = mix(c, ${v3(K.below)}, smoothstep(0.0, -0.3, h));
    float s = max(dot(d, SUN_DIR), 0.0);
    ${K.glowMix ? `c = mix(c, ${v3(K.glowMix.color)}, clamp(pow(s, ${f(K.glowMix.exp)}) * ${f(K.glowMix.k)}, 0.0, 1.0));` : ''}
    c += ${v3(K.glow)} * pow(s, ${f(K.glowExp ?? 3)}) * ${f(K.glowK)} + ${v3(K.haloCol ?? K.sun)} * pow(s, ${f(K.haloExp ?? 5)}) * ${f(K.halo)} + ${v3(K.sun)} * (pow(s, ${f(K.coronaExp ?? 48)}) * ${f(K.corona)} + pow(s, ${f(K.discExp ?? 900)}) * ${f(K.disc)});
    return c;
  }
`;
}

function fogFuncs() {
  return /* glsl */`
  float fogAmount(vec3 ro, vec3 rd, float t, float density) {
    float base = 1.0 - exp(-t * density);
    const float a = ${f(A.heightDensity)};
    const float b = ${f(A.heightFalloff)};
    float ry = rd.y;
    float hf = abs(ry) < 1e-3
      ? a * exp(-ro.y * b) * t
      : (a / b) * exp(-ro.y * b) * (1.0 - exp(-t * ry * b)) / ry;
    float h = 1.0 - exp(-max(hf, 0.0));
    return clamp(1.0 - (1.0 - base) * (1.0 - h), 0.0, ${f(A.fogMax)});
  }
`;
}

// GLSL autónomo para shaders propios (partículas): cielo + niebla.
export const atmosGLSL = () => skyGLSL() + fogFuncs();

// Materiales propios que llevan el cielo/niebla incrustados: se regeneran al cambiar de atmósfera.
const registry = [];
export function registerAtmos(mat, makeFragment) {
  mat.fragmentShader = makeFragment();
  registry.push({ mat, makeFragment });
  return mat;
}

// Versión de atmósfera: forma parte de la clave de programa de todos los materiales,
// así three.js recompila los shaders integrados (MeshStandard…) con la niebla nueva.
let atmosVersion = 0;
const baseKey = THREE.Material.prototype.customProgramCacheKey;
THREE.Material.prototype.customProgramCacheKey = function () { return baseKey.call(this) + '|atm' + atmosVersion; };

// Cambia la atmósfera en caliente: parámetros → chunks → shaders propios → recompilación.
export function applyAtmosphere(params, ...scenes) {
  A.stars = 0;                         // las claves opcionales no se heredan del circuito anterior
  Object.assign(A, params);
  atmosVersion++;
  installFogChunks();
  for (const r of registry) { r.mat.fragmentShader = r.makeFragment(); r.mat.needsUpdate = true; }
  for (const sc of scenes) sc?.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) m.needsUpdate = true;
  });
}

// Sustituye los chunks de niebla de three.js por niebla de altura + color de cielo por dirección.
export function installFogChunks() {
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
    #ifdef USE_FOG
      varying vec3 vFogWorld;
    #endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
    #ifdef USE_FOG
      vec4 fogW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fogW = instanceMatrix * fogW;
      #endif
      vFogWorld = (modelMatrix * fogW).xyz;
    #endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying vec3 vFogWorld;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
        const float fogDensity = ${f(A.baseDensity)};
      #endif
      ${skyGLSL()}
      ${fogFuncs()}
    #endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      vec3 fogRay = vFogWorld - cameraPosition;
      float fogDist = length(fogRay);
      vec3 fogDir = fogRay / max(fogDist, 1e-4);
      float fogA = fogAmount(cameraPosition, fogDir, fogDist, fogDensity);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, skyColor(fogDir), fogA);
    #endif`;
}

// ── Cúpula de cielo (con nubes cuando la atmósfera las pide) ──
export const skyUniforms = { uTime: { value: 0 } };
const skyFrag = () => {
  const C = A.clouds;
  return /* glsl */`
      varying vec3 vDir;
      uniform float uTime;
      ${skyGLSL()}
      ${C ? /* glsl */`
      float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(ch(i), ch(i+vec2(1,0)), f.x), mix(ch(i+vec2(0,1)), ch(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += cn(p) * w; p = p * 2.03 + vec2(1.7, 9.2); w *= 0.5; } return a; }
      vec3 clouds(vec3 c, vec3 d) {
        if (d.y <= 0.0) return c;
        vec2 uv = d.xz / (d.y + 0.1) * ${f(C.scale)} + vec2(uTime * 0.006, uTime * 0.002);
        float n = fbm(uv);
        float cov = smoothstep(${f(C.cover)}, ${f(C.cover + 0.24)}, n) * smoothstep(0.0, 0.14, d.y);
        float shade = fbm(uv + SUN_DIR.xz * 0.12);
        vec3 lit = mix(${v3(C.shadow)}, ${v3(C.light)}, clamp(0.55 + (n - shade) * 5.0, 0.0, 1.0));
        lit = mix(lit, SKY_HORIZON, smoothstep(0.3, 0.02, d.y) * 0.55);
        return mix(c, lit, cov * ${f(C.opacity)});
      }` : 'vec3 clouds(vec3 c, vec3 d) { return c; }'}
      ${A.stars ? /* glsl */`
      float starAt(vec3 d, float k) {
        vec3 p = d * k; vec3 i = floor(p); vec3 q = fract(p) - 0.5;
        float h = fract(sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        vec3 o = vec3(fract(h * 13.7), fract(h * 71.3), fract(h * 37.9)) - 0.5;
        float r = length(q - o * 0.5);
        return step(0.982, h) * smoothstep(0.22, 0.0, r) * (0.35 + (h - 0.982) * 36.0);
      }
      vec3 stars(vec3 c, vec3 d) {
        float m = smoothstep(-0.02, 0.12, d.y);
        float s = starAt(d, 260.0) + starAt(d.yzx, 140.0) * 1.4;
        return c + vec3(0.92, 0.95, 1.0) * s * m * ${f(A.stars)};
      }` : 'vec3 stars(vec3 c, vec3 d) { return c; }'}
      void main() { vec3 d = normalize(vDir); gl_FragColor = vec4(stars(clouds(skyColor(d), d), d), 1.0); }`;
};
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
  });
  registerAtmos(mat, skyFrag);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  return sky;
}

// ── Lunas: iluminadas por el sol y veladas por la atmósfera, como en la referencia ──
export function createMoonMaterial(haze = 0.5, tint = new THREE.Color(0.56, 0.57, 0.54)) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uHaze: { value: haze }, uTint: { value: tint } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vO = normalize(position);
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uHaze; uniform vec3 uTint;
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      ${skyGLSL()}
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 d = normalize(vW - cameraPosition);
        vec3 n = normalize(vN);
        float surf = n3(vO * 3.0) * 0.5 + n3(vO * 9.0) * 0.3 + n3(vO * 27.0) * 0.2;
        float l = dot(n, SUN_DIR);
        float diff = smoothstep(-0.25, 0.85, l);
        vec3 lit = uTint * (0.78 + 0.35 * surf) * diff * 1.35;
        float rim = pow(1.0 - abs(dot(n, -d)), 3.0);
        vec3 sky = skyColor(d);
        vec3 c = mix(lit, sky, clamp(uHaze + rim * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ── La Tierra vista desde la Luna: océanos, continentes, casquetes y nubes; borde de atmósfera azul ──
export function earthMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vO = normalize(position);
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      ${skyGLSL()}
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 6; i++) { a += n3(p) * w; p = p * 2.07 + 3.1; w *= 0.5; } return a; }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 d = normalize(vW - cameraPosition);
        vec3 n = normalize(vN);
        vec3 o = vO;
        float lat = abs(o.y);
        float land = fbm(o * 2.2 + 7.0) + 0.12 * fbm(o * 9.0);
        float isLand = smoothstep(0.53, 0.56, land);
        float dry = smoothstep(0.25, 0.0, abs(lat - 0.38) - 0.05) * fbm(o * 5.0 + 2.0);
        vec3 ocean = mix(vec3(0.02, 0.08, 0.22), vec3(0.04, 0.18, 0.36), smoothstep(0.56, 0.45, land));
        vec3 ground = mix(vec3(0.12, 0.22, 0.08), vec3(0.42, 0.33, 0.2), smoothstep(0.35, 0.7, dry));
        vec3 c = mix(ocean, ground, isLand);
        c = mix(c, vec3(0.9, 0.93, 0.96), smoothstep(0.78, 0.86, lat + 0.06 * fbm(o * 6.0)));
        float cl = fbm(o * 3.4 + vec3(0.0, 0.0, 11.0)) + 0.35 * fbm(o * vec3(14.0, 4.0, 14.0));
        float cloud = smoothstep(0.62, 0.86, cl);
        c = mix(c, vec3(0.96), cloud * 0.92);
        float l = dot(n, SUN_DIR);
        float day = smoothstep(-0.12, 0.35, l);
        float spec = pow(max(dot(reflect(-SUN_DIR, n), -d), 0.0), 40.0) * (1.0 - isLand) * (1.0 - cloud) * 0.6;
        vec3 lit = c * day * 1.25 + vec3(1.0, 0.95, 0.85) * spec * day;
        float rim = pow(1.0 - abs(dot(n, -d)), 2.5);
        lit += vec3(0.25, 0.5, 1.0) * rim * smoothstep(-0.3, 0.4, l) * 0.9;
        gl_FragColor = vec4(lit, 1.0);
      }`,
  });
}

// ── Lava: costra oscura con fisuras incandescentes (Voronoi en mundo) ──
export function lavaMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0d0c0b, roughness: 0.6, metalness: 0.1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = lavaUniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLavaW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLavaW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying vec3 vLavaW;
        vec2 lh(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        float edge(vec2 x){ vec2 n = floor(x), f = fract(x); vec2 mg, mr; float md = 8.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=lh(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){md=d;mr=r;mg=g;} }
          md = 8.0;
          for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=mg+vec2(i,j); vec2 o=lh(n+g); vec2 r=g+o-f; if(dot(mr-r,mr-r)>0.00001) md=min(md, dot(0.5*(mr+r), normalize(r-mr))); }
          return md; }
        float lnz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=fract(sin(dot(i,vec2(12.99,78.23)))*43758.5); float b=fract(sin(dot(i+vec2(1,0),vec2(12.99,78.23)))*43758.5); float c=fract(sin(dot(i+vec2(0,1),vec2(12.99,78.23)))*43758.5); float d=fract(sin(dot(i+vec2(1,1),vec2(12.99,78.23)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 lp = vLavaW.xz * 0.05;
        vec2 wv = vec2(lnz(lp * 0.4), lnz(lp * 0.4 + 5.2));
        lp += (wv - 0.5) * 1.8;
        float e1 = edge(lp);
        float e2 = edge(lp * 2.7 + 11.0);
        float mask = smoothstep(0.5, 0.78, lnz(vLavaW.xz * 0.0045 + 3.0)) * smoothstep(0.3, 0.6, lnz(vLavaW.xz * 0.013 + 1.7));
        float mask2 = smoothstep(0.55, 0.8, lnz(vLavaW.xz * 0.011 + 9.0));
        float glow = (1.0 - smoothstep(0.0, 0.022, e1)) * mask + (1.0 - smoothstep(0.0, 0.02, e2)) * mask * mask2 * 0.6;
        float ember = (1.0 - smoothstep(0.0, 0.16, e1)) * mask * 0.18;
        float pulse = 0.7 + 0.3 * sin(uTime * 0.6 + vLavaW.x * 0.012 + vLavaW.z * 0.017);
        totalEmissiveRadiance = vec3(1.0, 0.2, 0.035) * (glow * 4.5 + ember) * pulse;
        diffuseColor.rgb *= (0.35 + 0.4 * lnz(vLavaW.xz * 0.03)) * (1.0 - glow) * (1.0 - (1.0 - smoothstep(0.0, 0.03, e1)) * 0.6);`);
  };
  return m;
}
export const lavaUniforms = { uTime: { value: 0 } };

// ── Basalto con ruido triplanar barato (el material original no exporta color) ──
export function basaltMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x2a2b2a, roughness: 0.93, metalness: 0.04 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBW;
        float bh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float bn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(bh(i),bh(i+vec2(1,0)),f.x), mix(bh(i+vec2(0,1)),bh(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float bnz = bn(vBW.xz * 0.02) * 0.5 + bn(vBW.xz * 0.09) * 0.3 + bn(vBW.xz * 0.4) * 0.2;
        float strata = smoothstep(0.4, 0.6, bn(vec2(vBW.y * 0.08, vBW.x * 0.004)));
        diffuseColor.rgb *= 0.45 + 0.9 * bnz * (0.8 + 0.2 * strata);`);
  };
  return m;
}

export function createWater(y = -66) {
  const g = new THREE.PlaneGeometry(14000, 14000);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.4 });
  const w = new THREE.Mesh(g, m);
  w.position.y = y;
  w.receiveShadow = false;
  return w;
}

// Mapa de entorno a partir del propio cielo → reflejos metálicos coherentes con la niebla.
export function buildEnvironment(renderer) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: skyFrag(),
  }));
  s.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.02, 0.1, 5000);
  pmrem.dispose();
  sky.geometry.dispose(); sky.material.dispose();
  return rt.texture;
}
