// Fachadas futuristas: casetones en relieve (op-art: retícula que se subdivide por zonas, biseles asimétricos
// que dan profundidad oblicua). El relieve perturba la normal, así que la luz real lo modela; el fondo de cada
// casetón puede encenderse como ventana.
//
// cofferPatch(shader, opts) modifica un MeshStandardMaterial en onBeforeCompile:
//   opts.cell      tamaño base del casetón (m)
//   opts.levels    nº de subdivisiones por zonas (1 = retícula uniforme)
//   opts.zone      tamaño de zona (m) en la que cambia la subdivisión
//   opts.depth     intensidad del relieve (0–1.5)
//   opts.recess    oscurecido del fondo (0–1)
//   opts.windows   { lit: fracción encendida, warm: [r,g,b], cool: [r,g,b], k: intensidad } | null
//   opts.roofs     también en caras horizontales
const f = (v) => (+v).toFixed(4);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

export const COFFER_GLSL = /* glsl */`
  float cfh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // devuelve: xy = inclinación del bisel (T, B), z = fondo (0/1), w = marco (0/1); id de celda en cid
  vec4 coffer(vec2 p, float cell, out vec2 cid, out vec2 q) {
    vec2 g = p / cell; cid = floor(g); q = fract(g);
    float m = 0.07;                                  // marco
    float bl = 0.26, bt = 0.22, br = 0.06, bb = 0.07;  // biseles asimétricos: profundidad oblicua
    float dl = q.x - m, dr = 1.0 - m - q.x, db = q.y - m, dt = 1.0 - m - q.y;
    float frame = step(min(min(dl, dr), min(db, dt)), 0.0);
    vec2 s = vec2(0.0); float inner = 0.0;
    if (frame < 0.5) {
      float el = dl / bl, er = dr / br, eb = db / bb, et = dt / bt;
      float e = min(min(el, er), min(eb, et));
      if (e >= 1.0) inner = 1.0;
      else if (e == el) s = vec2(1.0, 0.0);
      else if (e == er) s = vec2(-1.0, 0.0);
      else if (e == eb) s = vec2(0.0, 1.0);
      else s = vec2(0.0, -1.0);
    }
    return vec4(s, inner, frame);
  }
`;

export function cofferPatch(sh, o = {}) {
  const cell = o.cell ?? 4, levels = o.levels ?? 3, zone = o.zone ?? 48, depth = o.depth ?? 0.9, recess = o.recess ?? 0.35;
  const W = o.windows;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCfW; varying vec3 vCfN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCfW = (modelMatrix * vec4(transformed, 1.0)).xyz; vCfN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vCfW; varying vec3 vCfN;\n${COFFER_GLSL}`)
    .replace('void main() {', 'void main() {\n  vec4 cf = vec4(0.0); vec2 cfId = vec2(0.0), cfQ = vec2(0.0); vec3 cfT = vec3(1.0, 0.0, 0.0), cfB = vec3(0.0, 1.0, 0.0); float cfOn = 0.0;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 Nw = normalize(vCfN);
        bool wall = abs(Nw.y) < 0.45;
        if (wall || ${o.roofs ? 'true' : 'false'}) {
          vec2 p;
          if (wall) { cfT = normalize(cross(vec3(0.0, 1.0, 0.0), Nw)); cfB = vec3(0.0, 1.0, 0.0); p = vec2(dot(vCfW, cfT), vCfW.y); }
          else { cfT = vec3(1.0, 0.0, 0.0); cfB = vec3(0.0, 0.0, -1.0); p = vec2(vCfW.x, -vCfW.z); }
          // subdivisión por zonas (la retícula se densifica a saltos, como en el grabado op-art)
          vec2 zc = floor(p / ${f(zone)});
          float lv = floor(cfh(zc + 3.7) * ${f(levels)});
          float c = ${f(cell)} / pow(2.0, lv);
          cf = coffer(p, c, cfId, cfQ);
          cfId += zc * 97.0;
          float shade = 1.0 + 0.06 * cf.x + 0.05 * cf.y;
          diffuseColor.rgb *= mix(1.0, 0.82 + 0.3 * cfh(zc), 0.5);              // tono por zona
          diffuseColor.rgb *= (1.0 - cf.z * ${f(recess)}) * (1.0 + cf.w * 0.12) * shade;
          ${W ? `cfOn = cf.z * step(${f(1 - W.lit)}, cfh(cfId + 0.31)) * step(0.36, cfQ.y) * step(cfQ.y, 0.5) * step(0.36, cfQ.x) * step(cfQ.x, 0.9);` : ''}
        }
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (dot(cf.xy, cf.xy) > 0.0) {
        vec3 nw = normalize(vCfN + (cfT * cf.x + cfB * cf.y) * ${f(depth)});
        normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
      }`);
  if (W) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += mix(${v3(W.warm)}, ${v3(W.cool)}, cfh(cfId * 1.7)) * cfOn * ${f(W.k)} * (0.6 + 0.4 * cfh(cfId * 2.3));`);
}

export function cofferKey(o) { return 'cof' + JSON.stringify(o); }
