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
