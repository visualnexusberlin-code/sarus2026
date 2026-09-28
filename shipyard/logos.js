// ─────────────────────────────────────────────────────────────
//  LOGOS · un símbolo por escudería (formas vectoriales en [-1, 1])
//  → logo 3D extruido (hangar) y estampado 2D en la librea (lomo).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const TAU = Math.PI * 2;
const circlePts = (r, cx = 0, cy = 0, n = 48, a0 = 0, a1 = TAU) => [...Array(n + 1)].map((_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const shape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const hole = (pts) => { const h = new THREE.Path(); pts.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y))); h.closePath(); return h; };
const ring = (ro, ri, cx = 0, cy = 0) => { const s = shape(circlePts(ro, cx, cy, 64)); s.holes.push(hole(circlePts(ri, cx, cy, 64).reverse())); return s; };
const disc = (r, cx = 0, cy = 0) => shape(circlePts(r, cx, cy, 40));
// barra de a → b con grosor w
const bar = ([ax, ay], [bx, by], w) => { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2; return shape([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]); };
const para = (x, y, w, h, sk) => shape([[x - w / 2 - sk, y - h / 2], [x + w / 2 - sk, y - h / 2], [x + w / 2 + sk, y + h / 2], [x - w / 2 + sk, y + h / 2]]);
const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

export const LOGOS = {
  // cimera troyana sobre tres barras de velocidad, dentro de un anillo
  ILION: () => {
    const crest = shape([...circlePts(0.66, 0, -0.08, 32, 0.25, Math.PI - 0.25), ...circlePts(0.5, 0, -0.22, 32, Math.PI - 0.35, 0.35)]);
    return [ring(1, 0.85), crest, para(0.05, -0.2, 1.05, 0.1, 0.08), para(0.1, -0.4, 0.8, 0.1, 0.08), para(0.15, -0.6, 0.5, 0.1, 0.08)];
  },
  // ojo de buey con pernos y burbujas
  SCUBA: () => {
    const r = ring(1, 0.78);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; r.holes.push(hole(circlePts(0.045, Math.cos(a) * 0.89, Math.sin(a) * 0.89, 12).reverse())); }
    return [r, ring(0.3, 0.19, -0.18, -0.24), disc(0.17, 0.24, 0.14), disc(0.1, 0.04, 0.46)];
  },
  // estrella del norte sobre picos helados
  THULE: () => {
    const star = shape([[0, 1], [0.07, 0.42], [0.42, 0.34], [0.07, 0.26], [0, -0.3], [-0.07, 0.26], [-0.42, 0.34], [-0.07, 0.42]]);
    const peaks = shape([[-1, -0.95], [-0.55, -0.2], [-0.32, -0.5], [0, 0.02], [0.3, -0.46], [0.52, -0.22], [1, -0.95]]);
    peaks.holes.push(hole([[-0.72, -0.8], [-0.55, -0.5], [-0.42, -0.72]].reverse()), hole([[-0.18, -0.8], [0, -0.3], [0.18, -0.8]].reverse()), hole([[0.4, -0.8], [0.52, -0.5], [0.72, -0.8]].reverse()));
    return [star, peaks];
  },
  // tuerca hexagonal con galones de blindaje
  LUDOX: () => {
    const hex = (r) => [...Array(6)].map((_, i) => { const a = i / 6 * TAU + Math.PI / 6; return [Math.cos(a) * r, Math.sin(a) * r]; });
    const nut = shape(hex(1)); nut.holes.push(hole(hex(0.8).reverse()));
    const chev = (y) => shape([[-0.52, y - 0.2], [0, y + 0.2], [0.52, y - 0.2], [0.52, y - 0.44], [0, y - 0.04], [-0.52, y - 0.44]]);
    return [nut, chev(0.42), chev(0.02), para(0, -0.5, 0.7, 0.14, 0)];
  },
  // proa triangular
  PRIMEX: () => {
    const t = shape([[-0.75, 0.85], [0.95, 0], [-0.75, -0.85]]);
    t.holes.push(hole([[-0.5, 0.45], [-0.5, -0.45], [0.4, 0]]));
    return [t, shape([[-0.35, 0.18], [0.05, 0], [-0.35, -0.18]])];
  },
  // cabeza de lobo facetada
  WOLFEN: () => {
    const half = [[0, -1], [0.34, -0.56], [0.62, -0.1], [0.7, 0.35], [0.8, 1], [0.4, 0.56], [0, 0.64]];
    const head = shape([...half, ...mirror(half).slice(1, -1)]);
    head.holes.push(hole([[0.12, 0.08], [0.42, 0.06], [0.46, 0.22]]), hole([[-0.12, 0.08], [-0.46, 0.22], [-0.42, 0.06]]), hole([[0, -0.58], [0.1, -0.42], [-0.1, -0.42]]));
    return [head];
  },
  // A con faro
  ADAX: () => {
    const a = shape([[-0.82, -0.92], [-0.18, 0.92], [0.18, 0.92], [0.82, -0.92], [0.5, -0.92], [0.32, -0.36], [-0.32, -0.36], [-0.5, -0.92]]);
    a.holes.push(hole([[-0.17, -0.08], [0.17, -0.08], [0, 0.44]]));
    return [a, ring(0.17, 0.09, 0, -0.66)];
  },
  // tridente en horquilla
  NEXUS: () => {
    const mid = shape([[-0.08, -0.7], [0.08, -0.7], [0.08, 0.72], [0, 0.98], [-0.08, 0.72]]);
    const prong = (s) => { const p = new THREE.Shape(); p.moveTo(s * 0.1, -0.7); p.bezierCurveTo(s * 0.75, -0.55, s * 0.72, 0.2, s * 0.6, 0.98); p.lineTo(s * 0.46, 0.7); p.bezierCurveTo(s * 0.52, 0.1, s * 0.42, -0.35, s * 0.1, -0.46); p.closePath(); return p; };
    return [mid, prong(1), prong(-1), para(0, -0.78, 0.9, 0.12, 0)];
  },
  // manta raya
  MANTA: () => {
    const half = [[0, 0.3], [0.12, 0.64], [0.24, 0.44], [0.62, 0.3], [1.0, -0.06], [0.56, -0.26], [0.2, -0.44], [0.05, -0.5], [0.02, -1.0]];
    const m = shape([...half, ...mirror(half)]);
    m.holes.push(hole([[0.3, 0.12], [0.46, 0.08], [0.32, 0.04]]), hole([[-0.3, 0.12], [-0.32, 0.04], [-0.46, 0.08]]));
    return [m];
  },
  // torre con esfera y cuchilla asimétrica
  BERLIN: () => [shape([[-0.05, -0.72], [0.05, -0.72], [0.05, 0.84], [0, 1], [-0.05, 0.84]]), ring(0.3, 0.17, 0, 0.3), shape([[-0.38, -1], [0.38, -1], [0.12, -0.7], [-0.12, -0.7]]), shape([[0.2, -0.25], [0.82, 0.5], [0.8, 0.66], [0.18, -0.06]])],
  // X y tres trazos
  X3LEE: () => [bar([-0.78, -0.8], [0.2, 0.8], 0.22), bar([-0.78, 0.8], [0.2, -0.8], 0.22), para(0.68, 0.45, 0.38, 0.11, 0), para(0.68, 0, 0.38, 0.11, 0), para(0.68, -0.45, 0.38, 0.11, 0)],
  // rotor de turbina
  HUEMING: () => {
    const out = [ring(1, 0.86), ring(0.22, 0.1)];
    for (let k = 0; k < 7; k++) {
      const a0 = k / 7 * TAU, pts = [];
      for (let i = 0; i <= 8; i++) { const r = 0.25 + i / 8 * 0.58; pts.push([Math.cos(a0 + (r - 0.25) * 1.2) * r, Math.sin(a0 + (r - 0.25) * 1.2) * r]); }
      for (let i = 8; i >= 0; i--) { const r = 0.25 + i / 8 * 0.58; const a = a0 + 0.3 + (r - 0.25) * 1.2 - (1 - i / 8) * 0.12; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      out.push(shape(pts));
    }
    return out;
  },
};

// Colores de logo: [cara, cantos]
export const LOGO_COLORS = {
  ILION: [0x1b3fd0, 0xc9d3e6], SCUBA: [0xe1840a, 0x07586a], THULE: [0x7b2fd0, 0x2a303c], LUDOX: [0xe07418, 0x05393d],
  PRIMEX: [0xe03a1e, 0xe8e4da], WOLFEN: [0x8fe01a, 0x101415], ADAX: [0xe07a14, 0x0c0d10], NEXUS: [0x16c8e0, 0x0a1433],
  MANTA: [0xff4f8a, 0xe2e4e6], BERLIN: [0xcf2027, 0xeceae4], X3LEE: [0x14151a, 0xeceeee], HUEMING: [0xe8761a, 0x4a4f57],
};

// Logo 3D: extrusión biselada, cara de color metalizada y cantos del segundo color (algo emisivos para el hangar)
export function logoMesh(name, size = 1) {
  const shapes = LOGOS[name]();
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.08);
  g.scale(size, size, size);
  const [a, b] = LOGO_COLORS[name];
  const face = new THREE.MeshPhysicalMaterial({ name: `LOGO_${name}_Face`, color: a, metalness: 0.65, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: a, emissiveIntensity: 0.25 });
  const side = new THREE.MeshPhysicalMaterial({ name: `LOGO_${name}_Edge`, color: b, metalness: 0.9, roughness: 0.22 });
  const m = new THREE.Mesh(g, [face, side]);
  m.name = `LOGO_${name}`;
  return m;
}

// Estampa 2D en un contexto de canvas (relleno par-impar para respetar los huecos)
export function drawLogo(ctx, name, cx, cy, size, color, { rot = 0, sx = 1 } = {}) {
  const shapes = LOGOS[name]();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(size * sx, -size); ctx.fillStyle = color;
  for (const s of shapes) {
    const { shape: outer, holes } = s.extractPoints(12);
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    for (const h of holes) { h.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); }
    ctx.fill('evenodd');
  }
  ctx.restore();
}
