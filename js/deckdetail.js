// Relieve del tablero: piezas alzadas de verdad sobre el asfalto (no pintura), por zonas.
//  · frenadas → costillas transversales (bandas sonoras) antes de cada curva fuerte
//  · curvas   → bordillos elevados en diente de sierra junto al muro, por el lado interior
//  · rectas   → dos carriles en relieve y campos de placas hexagonales alternos
//  · salida   → cajones de parrilla elevados
// Todo se fusiona en tres mallas (metal oscuro, placa clara, filo luminoso).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _F = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), kappa: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

// Caja biselada (chaflán en la cara superior) apoyada en el tablero, orientada con el marco de la pista
function slab(track, s, x, w, len, h, out, { yaw = 0, bevel = 0.35 } = {}) {
  track.sample(s, _F);
  const g = new THREE.BoxGeometry(w, h, len, 1, 1, 1);
  // chaflán: estrecha la cara superior
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * (1 - bevel * Math.min(1, h / w * 2))); p.setZ(i, p.getZ(i) - Math.sign(p.getZ(i)) * Math.min(len * 0.25, h * 0.8)); }
  g.translate(0, h / 2, 0);
  if (yaw) g.rotateY(yaw);
  const left = _p.copy(_F.right).negate();
  _m.makeBasis(left, _F.up, _F.tan);
  g.applyMatrix4(_m);
  g.translate(_F.pos.x + _F.right.x * x, _F.pos.y + _F.right.y * x, _F.pos.z + _F.right.z * x);
  g.deleteAttribute('uv');
  out.push(g);
}

function hexPlate(track, s, x, r, h, out) {
  track.sample(s, _F);
  const g = new THREE.CylinderGeometry(r * 0.82, r, h, 6, 1);
  g.translate(0, h / 2, 0);
  const left = _p.copy(_F.right).negate();
  _m.makeBasis(left, _F.up, _F.tan);
  g.applyMatrix4(_m);
  g.translate(_F.pos.x + _F.right.x * x, _F.pos.y + _F.right.y * x, _F.pos.z + _F.right.z * x);
  g.deleteAttribute('uv');
  out.push(g);
}

// Tira continua en relieve (perfil trapecial) a lo largo de la pista
function rail(track, s0, s1, x, w, h, out, step = 4) {
  const prof = [[x - w / 2, 0], [x - w * 0.3, h], [x + w * 0.3, h], [x + w / 2, 0]];
  const rows = Math.max(1, Math.round((s1 - s0) / step));
  const pos = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    track.sample(s0 + (s1 - s0) * r / rows, _F);
    for (const [px, ph] of prof) pos.push(_F.pos.x + _F.right.x * px + _F.up.x * ph, _F.pos.y + _F.right.y * px + _F.up.y * ph, _F.pos.z + _F.right.z * px + _F.up.z * ph);
  }
  for (let r = 0; r < rows; r++) for (let k = 0; k < 3; k++) { const a = r * 4 + k, b = a + 1, c = a + 4, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  out.push(g);
}

export function buildDeckDetail(parent, track, palette = {}, { skip = [] } = {}) {
  const L = track.length;
  const dark = [], plate = [], lit = [];
  const halfW = (track.width || 32) / 2 - 0.9;
  const excluded = (s) => skip.some(([a, b]) => { const d = track.delta(a, s); return d >= -6 && d <= b - a + 6; }) || track.gapAt(s) >= 0;
  const k = (s) => Math.abs(track.kappaAt(s));
  const ahead = (s) => { let m = 0; for (let d = 20; d <= 140; d += 10) m = Math.max(m, k(s + d)); return m; };
  const hashS = (s) => Math.abs(Math.sin(s * 12.9898) * 43758.5453) % 1;

  // salida: cajones de parrilla elevados (6 filas × 2)
  for (let r = 0; r < 6; r++) for (const c of [0, 1]) {
    const s = L - 30 - r * 16 - c * 7, x = c ? 6 : -6;
    slab(track, s + 2.2, x - 2.6, 0.35, 5, 0.12, lit); slab(track, s + 2.2, x + 2.6, 0.35, 5, 0.12, lit);
    slab(track, s + 4.8, x, 5.6, 0.35, 0.12, lit);
  }

  let s = 60;
  while (s < L - 60) {
    if (excluded(s)) { s += 8; continue; }
    const kk = k(s), ka = ahead(s);
    if (ka > 0.009 && kk < 0.006) {
      // frenada: costillas transversales cada 4,5 m, en dos medias pistas escalonadas
      const n = 12;
      for (let i = 0; i < n && !excluded(s); i++, s += 4.5) {
        const off = (i % 2) * 1.2;
        slab(track, s, -halfW / 2 - off, halfW - 1.4, 0.9, 0.14, dark);
        slab(track, s, halfW / 2 + off, halfW - 1.4, 0.9, 0.14, dark);
      }
      s += 20;
    } else if (kk > 0.007) {
      // curva: bordillo elevado en diente de sierra por el interior
      const inner = Math.sign(track.kappaAt(s)) > 0 ? -1 : 1;
      let i = 0;
      while (k(s) > 0.005 && !excluded(s) && i < 60) {
        const hgt = i % 2 ? 0.1 : 0.22;
        slab(track, s, inner * (halfW * track.wAt(s) - 1.1), 2.0, 2.6, hgt, i % 2 ? plate : dark, { bevel: 0.6 });
        s += 3; i++;
      }
      s += 12;
    } else {
      // recta: carriles en relieve (tramos de 60 m) y, a veces, un campo de placas hexagonales
      const len = 60;
      let clear = true; for (let d = 0; d <= len; d += 10) if (excluded(s + d) || k(s + d) > 0.006 || ahead(s + d) > 0.009) clear = false;
      if (clear) {
        if (hashS(s) < 0.45) {
          rail(track, s, s + len, -5.4, 0.7, 0.12, plate); rail(track, s, s + len, 5.4, 0.7, 0.12, plate);
          rail(track, s + 2, s + len - 2, -5.4, 0.12, 0.13, lit); rail(track, s + 2, s + len - 2, 5.4, 0.12, 0.13, lit);
        } else if (hashS(s + 7) < 0.6) {
          const x0 = hashS(s + 3) < 0.5 ? -9 : 9;
          for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) hexPlate(track, s + row * 7 + (col % 2) * 3.5, x0 + (col - 1) * 3.3, 1.7, 0.1, row % 3 === 0 ? dark : plate);
        }
        s += len + 25;
      } else s += 10;
    }
  }

  const M = {
    dark: new THREE.MeshStandardMaterial({ color: palette.dark ?? 0x1c1e20, roughness: 0.55, metalness: 0.55 }),
    plate: new THREE.MeshStandardMaterial({ color: palette.plate ?? 0x6c6e70, roughness: 0.45, metalness: 0.5 }),
    lit: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: palette.lit ?? 0xfff0dc, emissiveIntensity: 1.3, roughness: 0.4 }),
  };
  const group = new THREE.Group(); group.name = 'DECK DETAIL';
  for (const [key, list] of [['dark', dark], ['plate', plate], ['lit', lit]]) {
    if (!list.length) continue;
    const norm = list.map((g) => (g.index ? g.toNonIndexed() : g));
    norm.forEach((g) => { for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a); });
    const merged = mergeGeometries(norm, false);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, M[key]);
    mesh.receiveShadow = true; mesh.castShadow = key !== 'lit';
    group.add(mesh);
    list.forEach((g) => g.dispose());
  }
  parent.add(group);
  return { group, pieces: dark.length + plate.length + lit.length };
}
