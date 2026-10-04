// ARCADIA-2: paisaje terrestre y colorido sobre la geometría de SATURN-6.
// Terreno (hierba, roca ocre, campos de lavanda / girasol / amapola, playas), mar turquesa,
// fachadas mediterráneas, piezas pintadas y arbolado instanciado (cipreses, pinos piñoneros, arbustos en flor).
import * as THREE from 'three';
import { cofferPatch, cofferKey } from './facades.js';
import { lavaUniforms } from './atmosphere.js';

const NOISE = /* glsl */`
  float th(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }
`;
const worldVarying = (sh, v = 'vLW') => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 ${v};\nvarying vec3 ${v}N;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${v} = (modelMatrix * vec4(transformed, 1.0)).xyz;\n${v}N = normalize(mat3(modelMatrix) * objectNormal);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 ${v};\nvarying vec3 ${v}N;\n${NOISE}`);
};

// ── Terreno ──
export function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    worldVarying(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      {
        vec3 P = vLW; float up = normalize(vLWN).y;
        float n1 = tn(P.xz * 0.012), n2 = tn(P.xz * 0.05), n3 = tn(P.xz * 0.23);
        float grassM = smoothstep(0.5, 0.74, up + (n2 - 0.5) * 0.3);
        vec3 grass = mix(vec3(0.17, 0.36, 0.08), vec3(0.46, 0.55, 0.14), n1) * (0.78 + 0.42 * n3);
        float strata = tn(vec2(P.y * 0.085, (P.x + P.z) * 0.006));
        vec3 rock = mix(vec3(0.56, 0.38, 0.24), vec3(0.83, 0.67, 0.46), smoothstep(0.25, 0.75, strata)) * (0.72 + 0.36 * n3);
        vec3 col = mix(rock, grass, grassM);
        // parcelas agrícolas y campos solares: retícula girada, subdividida, tonos apagados, lindes y surcos
        {
          vec2 R = mat2(0.866, -0.5, 0.5, 0.866) * P.xz;
          vec2 pc = R / 110.0, pid = floor(pc), q = fract(pc);
          if (th(pid * 1.31) > 0.5) { pid.x += step(0.5, q.x) * 0.5; q.x = fract(q.x * 2.0); }
          if (th(pid * 2.17 + 4.0) > 0.6) { pid.y += step(0.5, q.y) * 0.25; q.y = fract(q.y * 2.0); }
          float zone = smoothstep(0.42, 0.52, tn(P.xz * 0.0022 + 7.0)) * smoothstep(0.84, 0.93, up);
          float k = th(pid + 5.1);
          vec3 pc1 = k < 0.24 ? vec3(0.74, 0.63, 0.38) : k < 0.44 ? vec3(0.4, 0.45, 0.2) : k < 0.6 ? vec3(0.56, 0.6, 0.42)
            : k < 0.74 ? vec3(0.66, 0.5, 0.3) : k < 0.82 ? vec3(0.5, 0.47, 0.58) : vec3(0.1, 0.13, 0.18);
          float solar = step(0.82, k);
          float dir = step(0.5, th(pid + 9.3));
          float rowsC = mix(q.x, q.y, dir) * 28.0;
          float rowsM = 0.82 + 0.18 * step(0.5, fract(rowsC));
          vec2 sg = abs(fract(q * vec2(9.0, 5.0)) - 0.5);
          float solarGrid = 1.0 - smoothstep(0.0, 0.06, 0.5 - max(sg.x, sg.y));
          vec3 fcol = solar > 0.5 ? mix(vec3(0.1, 0.13, 0.18), vec3(0.55, 0.6, 0.66), solarGrid * 0.6) : pc1 * rowsM * (0.9 + 0.2 * n3);
          float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
          float hedge = 1.0 - smoothstep(0.012, 0.03, edge);
          fcol = mix(fcol, vec3(0.2, 0.28, 0.1), hedge * (1.0 - solar) + hedge * solar * 0.3);
          col = mix(col, fcol, zone);
        }
        // playas y roca clara junto al mar
        float sand = 1.0 - smoothstep(-50.0, -38.0, P.y + (n2 - 0.5) * 8.0);
        col = mix(col, vec3(0.9, 0.8, 0.6), sand);
        diffuseColor.rgb = col;
      }`);
  };
  return m;
}

// ── Mar: turquesa en calma con oleaje suave y brillos ──
export function seaMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0f6f8a, roughness: 0.07, metalness: 0.0, envMapIntensity: 1.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = lavaUniforms.uTime;
    worldVarying(sh, 'vSW');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        {
          float n = tn(vSW.xz * 0.0035 + uTime * 0.004) * 0.6 + tn(vSW.xz * 0.012 - uTime * 0.01) * 0.4;
          diffuseColor.rgb = mix(vec3(0.015, 0.17, 0.3), vec3(0.04, 0.5, 0.56), smoothstep(0.35, 0.8, n));
        }`)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
        {
          vec2 q = vSW.xz;
          float t = uTime;
          vec2 w = vec2(sin(q.x * 0.045 + t * 1.1) + sin((q.x + q.y) * 0.07 - t * 1.4) * 0.6 + (tn(q * 0.08 + t * 0.2) - 0.5) * 1.6,
                        sin(q.y * 0.05 - t * 0.9) + sin((q.y - q.x) * 0.083 + t * 1.2) * 0.6 + (tn(q * 0.08 - t * 0.2 + 4.0) - 0.5) * 1.6);
          normal = normalize(normal + mat3(viewMatrix) * vec3(w.x, 0.0, w.y) * 0.09);
        }`);
  };
  return m;
}

// ── Fachadas: color por manzana (cal, terracota, ocre, azul, rosa), ventanas de día ──
export function facadeMaterial(base) {
  const m = base.clone();
  m.userData.painted = true;                 // color por edificio (aSeed), no por celda del mundo
  const co = { cell: 5.5, levels: 3, zone: 40, depth: 1.0, recess: 0.55 };
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSeed; varying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = aSeed;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSeed;')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      {
        float h = vSeed;
        vec3 pal = h < 0.3 ? vec3(0.94, 0.92, 0.87) : h < 0.45 ? vec3(0.8, 0.56, 0.44) : h < 0.6 ? vec3(0.9, 0.8, 0.6)
          : h < 0.74 ? vec3(0.62, 0.74, 0.8) : h < 0.86 ? vec3(0.86, 0.7, 0.66) : vec3(0.97, 0.96, 0.93);
        diffuseColor.rgb = pal;
      }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.0;');
    cofferPatch(sh, co);
  };
  m.customProgramCacheKey = () => 'facadeArc' + cofferKey(co);
  m.emissiveIntensity = 1;
  m.metalness = 0.05; m.roughness = 0.7;
  return m;
}

// ── Piezas pintadas por celdas del mundo (cada monolito / bloque con su color) ──
export function paintedMaterial(base, palette, cell = 240) {
  const m = base.clone();
  m.color.setRGB(1, 1, 1);
  m.metalness = 0.08; m.roughness = 0.72;
  m.userData.painted = true;                 // la fusión añade aSeed (uno por pieza): cada pieza un color entero
  const cols = palette.map((h) => new THREE.Color(h));
  const co = { cell: 7, levels: 3, zone: 56, depth: 0.95, recess: 0.16 };
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSeed; varying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = aSeed;');
    const list = cols.map((c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSeed;')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      {
        int k = int(floor(vSeed * ${list.length}.0));
        vec3 c = ${list.map((v, i) => i < list.length - 1 ? `k == ${i} ? ${v} : ` : v).join('')};
        diffuseColor.rgb *= c;
      }`);
    cofferPatch(sh, co);
  };
  m.customProgramCacheKey = () => 'painted' + palette.join(',') + cofferKey(co);
  return m;
}

// ── Arbolado ──
// Muestrea triángulos del terreno orientados hacia arriba y reparte cipreses, pinos y arbustos en flor.
export function plantTrees(parent, landMeshes, track, count = 2600) {
  const tris = [], areas = [];
  let total = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const o of landMeshes) {
    const g = o.geometry, p = g.attributes.position, idx = g.index;
    const tc = idx ? idx.count / 3 : p.count / 3;
    for (let t = 0; t < tc; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      const ar = n.length() / 2;
      if (ar < 1) continue;
      n.normalize();
      if (Math.abs(n.y) < 0.8) continue;
      if ((a.y + b.y + c.y) / 3 < -38) continue;           // ni en la playa ni bajo el agua
      tris.push([a.clone(), b.clone(), c.clone()]);
      total += ar; areas.push(total);
    }
  }
  if (!tris.length) return null;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const clump = (x, z) => Math.sin(x * 0.011) * Math.sin(z * 0.013 + 1.7) + Math.sin((x + z) * 0.004) * 0.8;
  const spots = [];
  const loc = {};
  for (let k = 0; k < count * 4 && spots.length < count; k++) {
    const r = rnd() * total;
    let lo = 0, hi = areas.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
    const [A, B, C] = tris[lo];
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const P = A.clone().addScaledVector(e1.subVectors(B, A), u).addScaledVector(e2.subVectors(C, A), v);
    if (clump(P.x, P.z) < -0.2 + rnd() * 0.6) continue;     // bosquetes, no una alfombra uniforme
    track.locate(P, loc);
    if (!loc.far && loc.dist < 34) continue;               // fuera del trazado y de los pilares
    spots.push(P);
  }

  const group = new THREE.Group();
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.9 });
  const kinds = {
    cypress: { geo: new THREE.ConeGeometry(2.1, 17, 7).translate(0, 8.5, 0), mat: leaf, list: [] },
    pineTop: { geo: new THREE.SphereGeometry(1, 9, 5).scale(7.5, 2.6, 7.5).translate(0, 11, 0), mat: leaf, list: [] },
    trunk: { geo: new THREE.CylinderGeometry(0.45, 0.8, 11, 6).translate(0, 5.5, 0), mat: bark, list: [] },
    bush: { geo: new THREE.IcosahedronGeometry(3.4, 0).translate(0, 2.4, 0), mat: leaf, list: [] },
  };
  const greens = [0x2c5a26, 0x3e6b2a, 0x4f7d2e, 0x2f4f2a];
  const blooms = [0xd8338a, 0xf2c230, 0xe8563a, 0x9a6fd0, 0x3e7a2c, 0x5a8a34];
  const col = new THREE.Color();
  for (const P of spots) {
    const r = rnd(), s = 0.75 + rnd() * 0.6, rot = rnd() * Math.PI * 2;
    const m = new THREE.Matrix4().compose(P.clone().setY(P.y - 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s * (0.85 + rnd() * 0.4), s));
    if (r < 0.42) kinds.cypress.list.push([m, col.setHex(greens[(rnd() * 2) | 0]).clone()]);
    else if (r < 0.72) { kinds.pineTop.list.push([m, col.setHex(greens[1 + ((rnd() * 3) | 0)]).clone()]); kinds.trunk.list.push([m, col.setHex(0xffffff).clone()]); }
    else kinds.bush.list.push([m, col.setHex(blooms[(rnd() * blooms.length) | 0]).clone()]);
  }
  for (const k of Object.values(kinds)) {
    if (!k.list.length) continue;
    const im = new THREE.InstancedMesh(k.geo, k.mat, k.list.length);
    k.list.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  parent.add(group);
  return { group, count: spots.length };
}
