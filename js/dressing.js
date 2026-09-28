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
export function deckMaterial(base) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = trackUniforms.uTime; sh.uniforms.uLen = trackUniforms.uLen; bindPaint(sh);
    sh.vertexShader = COMMON_V(sh.vertexShader);
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
