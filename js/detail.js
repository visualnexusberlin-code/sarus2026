// Detalle de superficie para materiales lisos (color plano, sin textura): las estructuras de las fases más antiguas
// (ARCADIA y SELENE comparten el mismo modelo) eran bloques de un solo tono. Se les añade, en el propio shader y en
// coordenadas de mundo: despiece en paneles con juntas rehundidas, variación de tono y de pulido por panel, chorretones
// de suciedad en las caras verticales, manchas en las horizontales y una franja de asiento oscurecida en las aristas
// inferiores de cada panel. Sin texturas ni geometría nuevas: no cuesta órdenes de dibujo.
import * as THREE from 'three';

const PLAIN = THREE.Material.prototype.onBeforeCompile;

export function surfaceDetail(m, { panel = 5.0, tall = 3.6, grime = 0.3, seam = 0.42, vary = 0.1, key = '' } = {}) {
  if (m.userData.detailed) return m;
  m.userData.detailed = true;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDW; varying vec3 vDN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vDW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vDN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vDW = (modelMatrix * vec4(transformed, 1.0)).xyz; vDN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vDW; varying vec3 vDN;
      float dH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float dN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(dH(i), dH(i+vec2(1,0)), f.x), mix(dH(i+vec2(0,1)), dH(i+vec2(1,1)), f.x), f.y); }`)
      .replace('void main() {', 'void main() {\n  float dBump = 0.0; float dRough = 1.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 n = normalize(vDN); float wall = 1.0 - smoothstep(0.45, 0.7, abs(n.y));
        // coordenadas del despiece: a lo largo de la fachada y en altura; en planta, xz
        vec2 uvW = vec2(dot(vDW.xz, normalize(vec2(-n.z, n.x) + 1e-4)), vDW.y) / vec2(${panel.toFixed(2)}, ${tall.toFixed(2)});
        vec2 uvF = vDW.xz / ${(panel * 1.2).toFixed(2)};
        vec2 uv = mix(uvF, uvW, step(0.5, wall));
        vec2 id = floor(uv), f = fract(uv), fw = fwidth(uv);
        float aa = clamp(1.0 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);          // de lejos el despiece se funde (sin moaré)
        vec2 e = min(f, 1.0 - f);
        float joint = (1.0 - smoothstep(0.0, 0.028 + max(fw.x, fw.y), min(e.x, e.y))) * aa;
        float h1 = dH(id + 7.3), h2 = dH(id * 1.7 + 2.1);
        // paneles: tono y pulido distintos; uno de cada siete, registro oscuro con rejilla
        float hatch = step(0.86, h2) * step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.75) * aa;
        float slats = hatch * step(0.5, fract(f.y * 9.0));
        vec3 c = diffuseColor.rgb * (1.0 + (h1 - 0.5) * ${(vary * 2).toFixed(3)} * aa);
        c *= 1.0 - joint * ${seam.toFixed(3)} - hatch * 0.16 - slats * 0.14;
        // franja de asiento: la parte baja de cada panel, algo más oscura (polvo y sombra de la junta)
        c *= 1.0 - 0.1 * aa * (1.0 - smoothstep(0.0, 0.3, f.y)) * wall;
        // suciedad: chorretones verticales en fachada, manchas amplias en planta
        float drip = dN(vec2(uvW.x * 3.1, uvW.y * 0.22)) * dN(vec2(uvW.x * 0.6, uvW.y * 0.05 + 3.0));
        float stain = dN(vDW.xz * 0.045) * 0.6 + dN(vDW.xz * 0.21) * 0.4;
        float dirt = mix(smoothstep(0.35, 0.8, stain), smoothstep(0.18, 0.55, drip), wall);
        c *= 1.0 - ${grime.toFixed(3)} * dirt;
        c *= 0.94 + 0.12 * dN(vDW.xz * 1.3 + vDW.y * 0.9);                  // grano fino
        diffuseColor.rgb = c;
        dBump = (joint * -1.0 + hatch * -0.5 + slats * 0.35) * 0.06 + dirt * 0.004;
        dRough = 1.0 + (h2 - 0.5) * 0.35 * aa + dirt * 0.25 + joint * 0.3;
      }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor * dRough, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(dBump), hy = dFdy(dBump);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2) * 14.0); }`);
  };
  m.customProgramCacheKey = () => `detail|${panel}|${tall}|${grime}|${seam}|${vary}|${key}`;
  m.needsUpdate = true;
  return m;
}

// Aplica el detalle a todo material liso de un grupo: estándar, sin textura, sin shader propio, opaco y no luminoso.
export function detailPlain(root, opts = {}) {
  const seen = new Set(); let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || seen.has(m)) continue; seen.add(m);
      if (!m.isMeshStandardMaterial || m.map || m.transparent || m.userData.detailed || m.userData.noDetail) continue;
      if (m.onBeforeCompile !== PLAIN) continue;
      const lum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) / 3 * (m.emissiveIntensity ?? 1) : 0;
      if (lum > 0.25) continue;
      if (opts.skip && opts.skip(m, o)) continue;
      // chapa pulida (aristas satinadas): despiece fino y apenas suciedad
      const metal = (m.metalness ?? 0) > 0.6;
      surfaceDetail(m, metal ? { panel: 3.2, tall: 3.2, grime: 0.14, seam: 0.3, vary: 0.05 } : { panel: opts.panel ?? 5.0, tall: opts.tall ?? 3.6, grime: opts.grime ?? 0.3, seam: opts.seam ?? 0.42, vary: opts.vary ?? 0.1 });
      n++;
    }
  });
  return n;
}
