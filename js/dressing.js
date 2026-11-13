// Vestido de pista: aplica el relieve a la geometría del circuito y añade color
// (pintura en el asfalto, bordillos en curva, balizas naranjas con luz corrida).
import * as THREE from 'three';

export const trackUniforms = {
  uTime: { value: 0 }, uLen: { value: 1 },
  uEdge: { value: new THREE.Color() }, uChev: { value: new THREE.Color() }, uLane: { value: new THREE.Color() },
  uKerbA: { value: new THREE.Color() }, uKerbB: { value: new THREE.Color() }, uGlow: { value: new THREE.Vector3() },
};
// Pintura de pista del circuito activo (circuits.js → paint)
export function setPaint(P) {
  const U = trackUniforms;
  U.uEdge.value.setRGB(...P.edge); U.uChev.value.setRGB(...P.chev); U.uLane.value.setRGB(...P.lane);
  U.uKerbA.value.setRGB(...P.kerbA); U.uKerbB.value.setRGB(...P.kerbB);
  U.uGlow.value.set(P.edgeGlow, P.chevGlow, P.kerbGlow);
}
const PAINT_U = 'uniform vec3 uEdge, uChev, uLane, uKerbA, uKerbB; uniform vec3 uGlow;';
const bindPaint = (sh) => { for (const k of ['uEdge', 'uChev', 'uLane', 'uKerbA', 'uKerbB', 'uGlow']) sh.uniforms[k] = trackUniforms[k]; };
const _F = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), kappa: 0 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Qué piezas siguen al relieve (todo lo que cuelga de la pista, no el paisaje)
export const FOLLOWS_TRACK = (name) => !/^(LAND|COAST|CITY|MONOLITH|SKY|ATMOSPHERE)/.test(name);

// kind: 'deck' | 'guard' | 'reflector' | null → añade atributo aTrack (s, x, h, máscara)
export function deformGeometry(g, track, kind, relief = true) {
  const p = g.attributes.position;
  const n = p.count;
  const aTrack = kind ? new Float32Array(n * 4) : null;
  const v = new THREE.Vector3(), loc = {};
  const GROUND = -40;
  let moved = false;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    track.locate(v, loc);
    if (loc.far) continue;
    if (relief) {
      const wH = 1 - smooth(70, 160, loc.dist);
      const wV = Math.min(1, Math.max(0, (v.y - GROUND) / Math.max(1, loc.deckY - GROUND)));
      if (wH > 0 && wV > 0 && loc.delta) { p.setY(i, v.y + loc.delta * wH * wV); moved = true; }
    }
    // ensanche en curvas: desplaza lateralmente lo que está sobre la pista (tablero, muros, balizas)
    if (loc.dist < 40 && Math.abs(loc.x) < 40) {
      const w = track.wAt(loc.s);
      if (w > 1.0005) {
        track.sample(loc.s, _F);
        const dx = loc.x * (w - 1);
        const cx = p.getX(i) + _F.right.x * dx, cz = p.getZ(i) + _F.right.z * dx;
        p.setX(i, cx); p.setZ(i, cz); moved = true;
      }
    }
    if (aTrack) {
      let mask = 0;
      if (kind === 'deck') {
        // chevrons en las zonas de frenada: curva fuerte 20–130 m por delante y todavía recto aquí
        let ahead = 0;
        for (let d = 20; d <= 130; d += 10) ahead = Math.max(ahead, Math.abs(track.kappaAt(loc.s + d)));
        mask = smooth(0.0065, 0.011, ahead) * (1 - smooth(0.004, 0.008, Math.abs(loc.kappa)));
      } else if (kind === 'guard') {
        mask = smooth(0.005, 0.009, Math.abs(loc.kappa));
      }
      aTrack.set([loc.s, loc.x, loc.h, mask], i * 4);
    }
  }
  p.needsUpdate = true;
  if (aTrack) g.setAttribute('aTrack', new THREE.BufferAttribute(aTrack, 4));
  if (moved) g.computeVertexNormals();
  return g;
}

const COMMON_V = (vs) => vs
  .replace('#include <common>', '#include <common>\nattribute vec4 aTrack;\nvarying vec4 vTrack;')
  .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrack = aTrack;');

// Asfalto: líneas ámbar de borde, discontinuas de carril, chevrons bermellón antes de cada curva, línea de meta.
// opts.wet (prueba visual, EUROPA): tablero pulido y húmedo. Rugosidad variable (regueros a lo largo de la pista,
// charcos de brillo), juntas de placa, y el reflejo de cada arco de luz estirado sobre el asfalto (opts.wet.rings:
// posiciones en metros, hasta 4). No usa texturas ni pasadas extra: son unas pocas operaciones más por píxel.
const WET_GLSL = /* glsl */`
  uniform vec4 uWetRings; uniform vec3 uWetCol; uniform vec4 uWetShips[6];
  float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(wh(i), wh(i+vec2(1,0)), f.x), mix(wh(i+vec2(0,1)), wh(i+vec2(1,1)), f.x), f.y); }
  float wetK = 0.0, wetStreak = 0.0;`;
export function deckMaterial(base, opts = {}) {
  const m = base.clone();
  const wet = opts.wet || null;
  if (wet) { m.roughness = 0.3; m.metalness = 0.3; m.envMapIntensity = 1.6; }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = trackUniforms.uTime; sh.uniforms.uLen = trackUniforms.uLen; bindPaint(sh);
    sh.vertexShader = COMMON_V(sh.vertexShader);
    if (wet) {
      const r = wet.rings || [];
      sh.uniforms.uWetRings = { value: new THREE.Vector4(r[0] ?? -1e6, r[1] ?? -1e6, r[2] ?? -1e6, r[3] ?? -1e6) };
      sh.uniforms.uWetCol = { value: new THREE.Color(...(wet.color || [0.5, 0.78, 1.0])) };
      sh.uniforms.uWetShips = wet.ships || { value: Array.from({ length: 6 }, () => new THREE.Vector4(-1e6, 0, 0, 0)) };   // (s, x, intensidad) de las naves cercanas
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + WET_GLSL)
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float s = vTrack.x, x = vTrack.y;
          wetStreak = wn(vec2(x * 1.1, s * 0.03)) * 0.6 + wn(vec2(x * 3.7, s * 0.011)) * 0.4;       // regueros largos
          float pool = wn(vec2(x * 0.22, s * 0.07));
          wetK = smoothstep(0.3, 0.72, pool * 0.55 + wetStreak * 0.45);
          float fine = wn(vec2(x * 7.0, s * 0.9));
          float seam = max(1.0 - smoothstep(0.02, 0.06, abs(fract(s / 24.0 + 0.5) - 0.5) * 24.0), 1.0 - smoothstep(0.03, 0.07, abs(abs(x) - 8.4)));
          diffuseColor.rgb = (diffuseColor.rgb * 1.6 + 0.035) * mix(0.55, 1.2, wetStreak) * (0.9 + 0.2 * fine);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, seam * 0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 1.0) * 0.8, wetK * 0.5);      // lo húmedo, más oscuro y frío
        }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(0.48, 0.2, wetK) + (wn(vec2(vTrack.y * 9.0, vTrack.x * 1.3)) - 0.5) * 0.1, 0.14, 1.0);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(0.5));   // el reflejo del sol es un brillo, no un fogonazo`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.15, 0.5, wetK);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // reflejo de los arcos: una lengua de luz hacia delante y hacia atrás, rota por los regueros
          float s = vTrack.x, ax = abs(vTrack.y), glow = 0.0;
          for (int i = 0; i < 4; i++) {
            float d = s - uWetRings[i]; d -= uLen * floor(d / uLen + 0.5);
            float ad = abs(d);
            glow += exp(-ad / 60.0) * (1.0 - smoothstep(3.0, 14.0, ax)) + 0.8 * exp(-ad / 10.0) * (1.0 - smoothstep(10.0, 17.0, ax));
          }
          totalEmissiveRadiance += uWetCol * glow * (0.04 + 0.26 * wetK) * (0.45 + 0.8 * wetStreak);
          // motores: charco de luz cálida bajo la popa de cada nave cercana, estirado hacia atrás
          for (int i = 0; i < 6; i++) {
            vec4 w = uWetShips[i]; if (w.z <= 0.0) continue;
            float d = s - w.x; d -= uLen * floor(d / uLen + 0.5);
            float q = d + w.w, dx = vTrack.y - w.y;
            float fall = q < 0.0 ? exp(q / 3.2) : exp(-q * q / 4.0);
            totalEmissiveRadiance += vec3(1.0, 0.56, 0.24) * w.z * fall * exp(-dx * dx / 5.0) * (0.3 + 0.7 * wetK) * (0.5 + 0.8 * wetStreak) * 0.28;
          }
          // brillo rasante: el asfalto pulido devuelve la claridad del hielo y del cielo cuando se mira a lo lejos
          float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 5.0);
          totalEmissiveRadiance += vec3(0.34, 0.46, 0.62) * fres * (0.12 + 0.5 * wetK) * (0.5 + 0.7 * wetStreak);
        }`);
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTrack; uniform float uTime; uniform float uLen; ' + PAINT_U)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float s = vTrack.x, x = vTrack.y, ax = abs(x), cm = vTrack.w;
          vec3 amber = uEdge, verm = uChev, ivory = uLane;
          float edge = smoothstep(12.55, 12.6, ax) * (1.0 - smoothstep(13.05, 13.1, ax));
          float lane = (1.0 - smoothstep(0.07, 0.11, abs(ax - 5.4))) * step(fract(s / 14.0), 0.45);
          float chev = step(fract((s + ax * 0.6) / 7.0), 0.16) * (1.0 - smoothstep(9.0, 9.5, ax)) * step(3.0, ax) * cm;
          float dS = min(s, uLen - s);
          float sf = 1.0 - smoothstep(2.4, 2.5, dS);
          float chk = mod(floor(s * 0.8) + floor((x + 16.0) * 0.8), 2.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, amber * 0.8, edge * 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, ivory * 0.7, lane * 0.55);
          diffuseColor.rgb = mix(diffuseColor.rgb, verm, chev * 0.75);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.03), vec3(0.86, 0.84, 0.78), chk), sf * (1.0 - smoothstep(14.0, 14.2, ax)));
          float pulse = 0.75 + 0.25 * sin(uTime * 6.0 - s * 0.08);
          totalEmissiveRadiance += amber * edge * uGlow.x + verm * chev * uGlow.y * pulse;
        }`);
  };
  if (wet) m.customProgramCacheKey = () => 'deckWet5';
  return m;
}

// Guardarraíl: bordillo bermellón/marfil en las curvas, sobre la banda alta del muro.
export function guardMaterial(base) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    bindPaint(sh);
    sh.vertexShader = COMMON_V(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTrack; ' + PAINT_U)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float s = vTrack.x, h = vTrack.z, cm = vTrack.w;
          float band = smoothstep(0.42, 0.46, h) * (1.0 - smoothstep(0.82, 0.86, h));
          float stripe = step(0.5, fract(s / 3.0));
          vec3 kerb = mix(uKerbA, uKerbB, stripe);
          diffuseColor.rgb = mix(diffuseColor.rgb, kerb, band * cm);
          totalEmissiveRadiance += kerb * band * cm * uGlow.z;
        }`);
  };
  return m;
}

// Balizas ("boyas"): naranja intenso con una ola de luz que corre en el sentido de la carrera.
export function reflectorMaterial(color = 0xff3c0a) {
  const m = new THREE.MeshStandardMaterial({ color: 0x1a0d08, emissive: color, emissiveIntensity: 1, roughness: 0.4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = trackUniforms.uTime;
    sh.vertexShader = COMMON_V(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTrack; uniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float w = fract(vTrack.x / 110.0 - uTime * 1.15);
          float wave = smoothstep(0.82, 1.0, w) * 3.5;
          totalEmissiveRadiance *= 1.6 + wave;
        }`);
  };
  return m;
}

export function amberGuideMaterial(color = 0xff7a18) {
  return new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: color, emissiveIntensity: 1.8, roughness: 0.5 });
}
