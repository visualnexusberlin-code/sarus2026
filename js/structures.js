// Estructuras procedurales que siguen la pista: túnel con lucernarios y puentes que la cruzan.
// Se colocan solas en tramos rectos (curvatura baja), lejos de la meta y de los pórticos de sector.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MATS = (P = {}) => ({
  dark: new THREE.MeshStandardMaterial({ color: P.dark ?? 0x1b1d1e, roughness: 0.78, metalness: P.dark ? 0.05 : 0.35, side: THREE.DoubleSide }),
  pale: new THREE.MeshStandardMaterial({ color: P.pale ?? 0x8f8e88, roughness: 0.38, metalness: P.pale ? 0.2 : 0.7, side: THREE.DoubleSide }),
  amber: new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: P.lamp ?? 0xff7a1c, emissiveIntensity: 2.6, side: THREE.DoubleSide }),
  ivory: new THREE.MeshStandardMaterial({ color: 0x777570, emissive: P.ivory ?? 0xf1ece0, emissiveIntensity: 1.8, side: THREE.DoubleSide }),
});

// Barrido de un perfil [[x, h], …] a lo largo de la pista entre s0 y s1
function sweep(track, s0, s1, step, profile, closed = false) {
  const F = track.frame();
  const pos = [], idx = [];
  const rows = Math.max(1, Math.round((s1 - s0) / step));
  const m = profile.length;
  for (let r = 0; r <= rows; r++) {
    track.sample(s0 + (s1 - s0) * r / rows, F);
    for (const [x, h] of profile) {
      const p = F.pos.clone().addScaledVector(F.right, x).addScaledVector(F.up, h);
      pos.push(p.x, p.y, p.z);
    }
  }
  const segs = closed ? m : m - 1;
  for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) {
    const a = r * m + k, b = r * m + (k + 1) % m, c = a + m, d = b + m;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function box(w, h, d, basis, at) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4().makeBasis(basis.x, basis.y, basis.z).setPosition(at);
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return g;
}

function findWindows(track, len, count, avoid, minGap) {
  const out = [];
  const L = track.length;
  const score = (s) => { let k = 0; for (let d = -30; d <= len + 30; d += 10) k = Math.max(k, Math.abs(track.kappaAt(s + d))); return k; };
  const cands = [];
  for (let s = 350; s < L - len - 350; s += 25) cands.push([s, score(s)]);
  cands.sort((a, b) => a[1] - b[1]);
  for (const [s, k] of cands) {
    if (out.length >= count) break;
    if (k > 0.006) break;
    const clash = [...avoid, ...out.map((o) => ({ s: o, len }))].some((a) => Math.abs(track.delta(a.s + (a.len || 0) / 2, s + len / 2)) < ((a.len || 0) + len) / 2 + minGap);
    if (!clash) out.push(s);
  }
  return out;
}

// opts: { tunnel: {s, len} (explícito) | false, bridges: n, ground(x, z) → cota del suelo, rock: túnel dentro de la montaña }
export function buildStructures(scene, track, palette, opts = {}) {
  const M = MATS(palette);
  const parts = { dark: [], pale: [], amber: [], ivory: [] };
  const sectorsAvoid = track.sectors.map((sc) => ({ s: sc.s - 40, len: 80 }));

  // ── Túnel ──
  let TL = 300, t0;
  if (opts.tunnel) { t0 = opts.tunnel.s; TL = opts.tunnel.len; }
  else if (opts.tunnel !== false) [t0] = findWindows(track, TL, 1, sectorsAvoid, 120);
  const tunnel = t0 !== undefined ? { s: t0, len: TL } : null;
  if (tunnel) {
    const wallL = [[-19.5, -1.5], [-19.5, 8], [-15.5, 12.5]];
    const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
    const roof = [[-15.5, 12.5], [-6, 14.6], [6, 14.6], [15.5, 12.5]];
    parts.dark.push(sweep(track, t0, t0 + TL, 4, wallL), sweep(track, t0, t0 + TL, 4, wallR));
    // techo por paneles con rendijas: el sol entra en franjas
    if (opts.rock) parts.dark.push(sweep(track, t0, t0 + TL, 4, roof));      // dentro de la roca: techo continuo
    else for (let s = t0; s < t0 + TL; s += 12.5) parts.dark.push(sweep(track, s, Math.min(t0 + TL, s + 9.5), 3, roof));
    // cuadernas
    for (let s = t0; s <= t0 + TL; s += 12.5) {
      const rib = [[-19.4, -1.5], [-19.4, 8], [-15.4, 12.4], [-6, 14.4], [6, 14.4], [15.4, 12.4], [19.4, 8], [19.4, -1.5]];
      const inner = rib.map(([x, h]) => [x * 0.955, h * 0.94]);
      parts.pale.push(sweep(track, s, s + 1.1, 1.1, inner), sweep(track, s, s + 1.1, 1.1, rib));
    }
    // tiras de luz: ámbar en paredes, marfil en el techo
    for (const side of [-1, 1]) parts.amber.push(sweep(track, t0, t0 + TL, 4, [[side * 19.35, 5.6], [side * 19.35, 6.0]]));
    parts.ivory.push(sweep(track, t0, t0 + TL, 4, [[-0.35, 14.5], [0.35, 14.5]]));
    // portales
    for (const s of [t0 - 3, t0 + TL]) {
      const outer = [[-23, -1.5], [-23, 10], [-18, 16], [-7, 18.5], [7, 18.5], [18, 16], [23, 10], [23, -1.5]];
      const inner = [[-19.5, -1.5], [-19.5, 8], [-15.5, 12.5], [-6, 14.6], [6, 14.6], [15.5, 12.5], [19.5, 8], [19.5, -1.5]];
      for (let k = 0; k < outer.length - 1; k++) {
        parts.dark.push(sweep(track, s, s + 3, 3, [outer[k], outer[k + 1]]), sweep(track, s, s + 3, 3, [inner[k], outer[k]]));
      }
      parts.amber.push(sweep(track, s - 0.05, s + 0.25, 0.3, outer.map(([x, h]) => [x * 0.93, h * 0.93 - 0.2])));
    }
  }

  // ── Puentes ──
  const avoid = [...sectorsAvoid, ...(tunnel ? [{ s: tunnel.s - 60, len: tunnel.len + 120 }] : [])];
  const spots = findWindows(track, 20, opts.bridges ?? 5, avoid, 520);
  const F = track.frame();
  spots.forEach((s, i) => {
    track.sample(s + 10, F);
    const R = F.right.clone(), T = F.tan.clone().setY(0).normalize(), U = new THREE.Vector3(0, 1, 0);
    const across = new THREE.Vector3().crossVectors(U, T).normalize(); // horizontal, perpendicular a la pista
    const basis = { x: across, y: U, z: T };
    const base = F.pos.clone();
    const type = i % 3;
    const addGirder = (h, zOff, span = 118, depth = 9) => {
      const c = base.clone().addScaledVector(U, h).addScaledVector(T, zOff);
      parts.dark.push(box(span, 2.6, depth, basis, c));
      parts.pale.push(box(span, 0.35, depth + 0.6, basis, c.clone().addScaledVector(U, 1.45)));
      for (const e of [-1, 1]) parts.amber.push(box(span, 0.18, 0.18, basis, c.clone().addScaledVector(U, -1.35).addScaledVector(T, e * depth / 2)));
      return c;
    };
    const addPier = (x, top) => {
      const px = base.clone().addScaledVector(across, x);
      const bottom = opts.ground ? opts.ground(px.x, px.z) - 4 : -45;
      const hgt = top - bottom;
      const c = base.clone().addScaledVector(across, x); c.y = bottom + hgt / 2;
      parts.dark.push(box(3.4, hgt, 3.4, basis, c));
      parts.pale.push(box(3.8, 0.4, 3.8, basis, c.clone().setY(top - 0.3)));
    };
    if (type === 0) {                                   // viga con pilas
      const c = addGirder(20, 0);
      addPier(-52, c.y - 1.3); addPier(52, c.y - 1.3);
    } else if (type === 1) {                            // arco
      const N = 22, rad = 44;
      for (let k = 0; k < N; k++) {
        const a0 = Math.PI * k / N, a1 = Math.PI * (k + 1) / N, am = (a0 + a1) / 2;
        const p = base.clone().addScaledVector(across, Math.cos(am) * rad).addScaledVector(U, Math.sin(am) * rad * 0.72 - 2);
        const segLen = rad * (a1 - a0) * 1.08;
        const tang = across.clone().multiplyScalar(-Math.sin(am)).addScaledVector(U, Math.cos(am) * 0.72).normalize();
        const nrm = new THREE.Vector3().crossVectors(T, tang).normalize();
        parts.dark.push(box(segLen, 2.2, 3.2, { x: tang, y: nrm, z: T }, p));
        parts.amber.push(box(segLen, 0.16, 0.16, { x: tang, y: nrm, z: T }, p.clone().addScaledVector(nrm, -1.15)));
      }
      addGirder(26, 0, 70, 4);
    } else {                                            // doble pasarela a dos alturas
      const c1 = addGirder(16, -7, 110, 7);
      const c2 = addGirder(29, 8, 110, 7);
      addPier(-50, c2.y - 1.3); addPier(50, c2.y - 1.3);
      for (const x of [-38, 38]) parts.pale.push(box(1.2, c2.y - c1.y, 1.2, basis, c1.clone().addScaledVector(across, x).addScaledVector(T, 0.5).setY((c1.y + c2.y) / 2)));
    }
  });

  const group = new THREE.Group();
  for (const [k, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const norm = geos.map((g) => { const n = g.index ? g : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal'].includes(a)) n.deleteAttribute(a); return n; });
    const mesh = new THREE.Mesh(mergeGeometries(norm, false), M[k]);
    mesh.castShadow = k === 'dark';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  return { tunnel, bridges: spots, group };
}
