// Regolito con textura (heredado del suelo de Belton Regio en Plutón): ruido en tres escalas, paleta rojo-pardo
// con naranja quemado, crestas finas tipo Voronoi y relieve por derivadas (bump) que rompe el aspecto plano.
// Se usa en el suelo de Marte (OLYMPUS y THARSIS SIERRA) sobre su color de base, sin cambiar la fase.

export const REG_NOISE = /* glsl */`
  float rgH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rgN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(rgH(i), rgH(i+vec2(1,0)), f.x), mix(rgH(i+vec2(0,1)), rgH(i+vec2(1,1)), f.x), f.y); }
  float rgF(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += rgN(p) * w; p = p * 2.03 + vec2(1.7, 9.2); w *= 0.5; } return a; }
  float rgVor(vec2 p, float C){ vec2 g = floor(p / C); float d1 = 1e9, d2 = 1e9;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = g + vec2(float(i), float(j));
      vec2 q = (c + 0.15 + 0.7 * vec2(rgH(c), rgH(c + vec2(3.1, 7.7)))) * C; float d = length(p - q);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return (d2 - d1) / C; }
`;

// Bloque GLSL: modifica `col` (vec3) en el punto `p` (vec2, xz de mundo) y deja el relieve en `rgBump`.
// `amt` (expresión float) atenúa el efecto; `lines` las crestas (0 en el pavimento de la ciudad de Tharsis).
export const regolithColor = (col, p, amt = '1.0', lines = '1.0') => /* glsl */`
  {
    float rAmt = ${amt};
    float aa = clamp(1.0 - length(fwidth(${p})) / 8.0, 0.0, 1.0);
    float ra = rgF(${p} / 2200.0), rb = rgF(${p} / 260.0 + 3.0), rc = rgF(${p} / 14.0 + 7.0);
    // paleta de las tolinas, algo más clara para la luz de Marte: rojo profundo, pardo y naranja quemado
    vec3 pc = mix(vec3(0.33, 0.1, 0.05), vec3(0.64, 0.24, 0.11), smoothstep(0.25, 0.8, ra * 0.55 + rb * 0.45));
    pc = mix(pc, vec3(0.74, 0.4, 0.21), smoothstep(0.66, 0.85, rgF(${p} / 600.0 + 9.0)) * 0.6);
    // conserva la luminosidad de la base (coladas de basalto oscuras, laderas) y le pone la paleta y el grano de Plutón
    vec3 c0 = mix(${col}, pc * clamp(dot(${col}, vec3(0.6, 0.3, 0.1)) / 0.36, 0.3, 1.5), 0.82);
    c0 *= 0.62 + 0.42 * rb + 0.0;                                          // manchas medianas más contrastadas
    c0 *= 0.74 + 0.48 * rc * aa + 0.24 * (1.0 - aa);                         // grano fino
    // crestas finas y claras (polvo acumulado en grietas): red de Voronoi deformada
    vec2 wp = ${p} + (vec2(rgF(${p} / 300.0), rgF(${p} / 300.0 + 5.0)) - 0.5) * 220.0;
    float cr = rgVor(wp, 380.0);
    float line = (1.0 - smoothstep(0.0, 0.018, cr)) * smoothstep(0.5, 0.66, rgF(${p} / 1500.0 + 1.0)) * (${lines});
    c0 = mix(c0, vec3(0.92, 0.66, 0.46), line * 0.85 * aa);
    ${col} = mix(${col}, c0, rAmt);
    rgBump = (rb * 5.0 + rc * 2.6 * aa + line * 3.0) * rAmt;
  }`;

// Relieve por derivadas de pantalla (va tras <normal_fragment_maps>)
export const REG_BUMP = /* glsl */`
  { vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(rgBump), hy = dFdy(rgBump);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
    normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`;

// ── Relieve de Marte en la malla (JS): cráteres de impacto con borde y eyecta, campos de dunas y frentes de colada.
//    Con el sol bajo de las dos fases, el relieve real es lo que da sombra y lectura al terreno. ──
const _h = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const _vn = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (_h(ix, iz) * (1 - ux) + _h(ix + 1, iz) * ux) * (1 - uz) + (_h(ix, iz + 1) * (1 - ux) + _h(ix + 1, iz + 1) * ux) * uz; };
const _ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function craterField(x, z, cell, rMin, rMax, prob, seed) {
  const gx = Math.floor(x / cell), gz = Math.floor(z / cell); let h = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cz = gz + j, k = _h(cx + seed, cz - seed * 1.7); if (k > prob) continue;
    const R = rMin + (rMax - rMin) * Math.pow(_h(cx * 1.3 + 5 + seed, cz * 0.7 + 2), 2.2);
    const ox = (cx + 0.2 + 0.6 * _h(cx + 11 + seed, cz + 3)) * cell, oz = (cz + 0.2 + 0.6 * _h(cx + 7, cz + 13 + seed)) * cell;
    const d = Math.hypot(x - ox, z - oz) / R; if (d > 1.9) continue;
    const wob = 1 + 0.07 * Math.sin(Math.atan2(z - oz, x - ox) * 5 + k * 40), dd = d / wob;
    const bowl = dd < 1 ? -0.2 * R * (1 - dd * dd) * (0.75 + 0.25 * dd * dd) : 0;         // cuenco de fondo algo plano
    const rim = 0.065 * R * Math.exp(-(((dd - 1.02) / 0.16) ** 2));                           // borde levantado
    const ejecta = dd >= 1 ? 0.018 * R * (1 - _ss(1, 1.9, dd)) : 0;                          // manto de eyecta
    h += bowl + rim + ejecta;
  }
  return h;
}
// detalle: 'near' (parche cercano, malla de ~20 m) incluye cráteres medianos, dunas y frentes de colada; 'mid' solo los grandes
export function marsRelief(x, z, detail = 'near') {
  let h = craterField(x, z, 2600, 280, 700, 0.7, 3.0);
  if (detail !== 'near') return h;
  h += craterField(x, z, 560, 60, 230, 0.72, 17.0);
  // dunas transversales al viento, en campos
  const field = _ss(0.5, 0.68, _vn(x * 0.0011 + 4, z * 0.0011));
  const u = (x * 0.96 + z * 0.28) * 0.052 + 2.4 * _vn(x * 0.004, z * 0.004);
  h += field * 3.2 * (0.5 + 0.5 * Math.sin(u)) * (0.6 + 0.4 * _vn(x * 0.01, z * 0.01));
  // frentes de colada: escalones lobulados de unos metros
  const fl = _vn(x * 0.0026 + 9, z * 0.0026 - 4) + 0.35 * _vn(x * 0.011, z * 0.011);
  h += 7 * _ss(0.6, 0.64, fl) + 5 * _ss(0.86, 0.9, fl);
  return h;
}
