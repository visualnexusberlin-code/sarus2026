// ÍO · LOKI PATERA (en construcción, nov. 2026) · ver IO-LOKI.md
// Fase 1: trazado en gris para probar los RAMALES (desvíos reales) del motor:
//   A · VIADUCTO  puente sin guardarraíles por dentro de la curva superior derecha; caer = lava = eliminada
//   B · SALTO     rampa interior tras el túnel, vuelo sobre una cresta y recepción más baja; caer = eliminada
// La vuelta principal lleva guardarraíles siempre. Lago de lava provisional (plano) a LAVA_Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './track.js';
import { deckMaterial, guardMaterial } from './dressing.js';
import { DECK_SOLID } from './deckprofile.js';

export const LAVA_Y = -70;

// ── Planta por tramos (cerrada numéricamente): ['S', recta] · ['A', radio, grados (+ izquierda)] · ['M', marca] ──
const SEGS = [['M', 'grid'], ['S', 1096.5], ['A', 420, 72], ['S', 260], ['A', 300, -58], ['A', 300, 64], ['S', 317.3], ['M', 'forkA'], ['S', 200], ['A', 260, 120],
  ['S', 160], ['M', 'mergeA'], ['S', 80], ['A', 600, -6], ['S', 820], ['M', 'tunnel'], ['S', 420], ['M', 'tunnelOut'], ['S', 40], ['M', 'forkB'], ['A', 320, -38], ['S', 120],
  ['A', 300, 146], ['S', 80], ['M', 'mergeB'], ['A', 400, -36], ['S', 300], ['A', 420, 94]];

function turtle(segs, step = 4) {
  let x = 0, z = 0, h = Math.PI / 2, s = 0; const P = [new THREE.Vector3(0, 0, 0)], D = [0], marks = {};
  for (const sg of segs) {
    if (sg[0] === 'M') { marks[sg[1]] = s; continue; }
    if (sg[0] === 'S') { const n = Math.max(1, Math.round(sg[1] / step)); for (let i = 0; i < n; i++) { x += Math.sin(h) * sg[1] / n; z += Math.cos(h) * sg[1] / n; s += sg[1] / n; P.push(new THREE.Vector3(x, 0, z)); D.push(s); } }
    else { const [, R, deg] = sg, a = deg * Math.PI / 180, L = Math.abs(a) * R, n = Math.max(2, Math.round(L / step)); for (let i = 0; i < n; i++) { h -= a / n; x += Math.sin(h) * L / n; z += Math.cos(h) * L / n; s += L / n; P.push(new THREE.Vector3(x, 0, z)); D.push(s); } }
  }
  const err = P[P.length - 1].clone();
  P.forEach((p, i) => p.addScaledVector(err, -D[i] / s));
  P.pop(); D.pop();
  return { P, D, L: s, marks };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Cotas por distancia en planta: recta de salida sobre el lago, subida por el flanco derecho, terraza alta, bajada por el izquierdo
function heights(D, L, M) {
  const keys = [[0, 0], [900, 0], [M.forkA - 300, 92], [M.forkA, 100], [M.mergeA, 132], [M.mergeA + 420, 170], [M.tunnelOut, 170], [M.forkB, 160],
    [M.mergeB, 70], [M.mergeB + 400, 30], [L - 500, 0], [L, 0]];
  const yAt = (d) => { let i = 0; while (i < keys.length - 2 && d > keys[i + 1][0]) i++; const [a, ya] = keys[i], [b, yb] = keys[i + 1]; return lerp(ya, yb, Math.min(1, Math.max(0, (d - a) / (b - a)))); };
  let y = D.map(yAt); const N = y.length, W = 12;
  for (let p = 0; p < 4; p++) y = y.map((_, i) => { let a = 0; for (let k = -W; k <= W; k++) a += y[(i + k + N) % N]; return a / (2 * W + 1); });
  return y;
}

function sOfD(track, D, d) {
  const n = D.length; let i = 0; while (i < n - 1 && D[i + 1] < d) i++;
  const t = (d - D[i]) / Math.max(1e-6, (D[(i + 1) % n] || D[i] + 4) - D[i]);
  const a = track.sectionS[i], b = i + 1 < n ? track.sectionS[i + 1] : track.length;
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// Ramal: una sola curva (Bézier en planta) desde main(sA) desplazado offA hasta main(sB) desplazado offB, tangente a la
// principal en los dos extremos: se separa del tablero suavemente, sin quiebros. Cotas por claves (yMid: [[f, cota], …]).
// Mientras se solapa con la principal, su tablero va un pelo por debajo y manda el principal.
function branchPoints(track, { sA, sB, offA, offB, yMid, tension = 0.33 }) {
  const F = track.frame();
  track.sample(sA, F); const p0 = F.pos.clone().addScaledVector(F.right, offA), t0 = F.tan.clone().setY(0).normalize();
  track.sample(sB, F); const p3 = F.pos.clone().addScaledVector(F.right, offB), t3 = F.tan.clone().setY(0).normalize();
  const chord = Math.hypot(p3.x - p0.x, p3.z - p0.z), k = chord * tension;
  const c1 = p0.clone().addScaledVector(t0, k), c2 = p3.clone().addScaledVector(t3, -k);
  // cotas: arranca y acaba a la altura de la principal, con la misma pendiente los primeros/últimos metros
  const yKeys = [[0, p0.y], [0.06, p0.y + (t0.y || 0)], ...(yMid || []), [0.94, p3.y], [1, p3.y]];
  const yAt = (f) => { let i = 0; while (i < yKeys.length - 2 && f > yKeys[i + 1][0]) i++; const [a, ya] = yKeys[i], [b, yb] = yKeys[i + 1]; const u = Math.min(1, Math.max(0, (f - a) / (b - a))); return lerp(ya, yb, u * u * (3 - 2 * u)); };
  const n = Math.max(24, Math.round(chord / 6)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = 1 - t;
    const p = p0.clone().multiplyScalar(a * a * a).addScaledVector(c1, 3 * a * a * t).addScaledVector(c2, 3 * a * t * t).addScaledVector(p3, t * t * t);
    p.y = yAt(t); pts.push(p);
  }
  return pts;
}

export function ioTrack() {
  const { P, D, L, marks: M } = turtle(SEGS, 4);
  const y = heights(D, L, M);
  const pts = P.map((p, i) => new THREE.Vector3(p.x, y[i], p.z));
  const track = new Track(null, {
    points: pts, inSectorOrder: false, sectors: [0, 0.17, 0.33, 0.5, 0.67, 0.83],
    bank: (f, k) => THREE.MathUtils.clamp(k * 30, -0.16, 0.16),
  });
  const s = {}; for (const [k, v] of Object.entries(M)) s[k] = sOfD(track, D, v);
  // lado interior de cada desvío (hacia el centro de la curva que recorta)
  const F = track.frame(), inner = (sa, sb) => { track.sample(sa, F); const a = F.pos.clone(), r = F.right.clone(); track.sample((sa + sb) / 2, F); return Math.sign(F.pos.clone().sub(a).dot(r)) || 1; };
  const sideA = inner(s.forkA, s.mergeA), sideB = inner(s.forkB, s.mergeB);
  // A · VIADUCTO: carril y medio (12 m), sin guardarraíles en todo el cruce, baja hacia la ensenada de lava
  const ptsA = branchPoints(track, { sA: s.forkA, sB: s.mergeA, offA: 10 * sideA, offB: 10 * sideA, yMid: [[0.5, 80]], tension: 0.3 });
  const A = track.addBranch({ id: 'viaduct', pts: ptsA, sA: s.forkA, sB: s.mergeA, offA: 10 * sideA, offB: 10 * sideA, width: 12, lethal: true });
  A.open = [[110, A.blen - 110]]; A.aiTake = 0.45;
  // B · SALTO: dos carriles (16 m); rampa que sube, vuelo sobre la cresta, recepción más baja (bordes abiertos los primeros 70 m)
  const ptsB = branchPoints(track, { sA: s.forkB, sB: s.mergeB, offA: 8 * sideB, offB: 8 * sideB, yMid: [[0.2, 172], [0.27, 176], [0.5, 120]], tension: 0.3 });
  const B = track.addBranch({ id: 'jump', pts: ptsB, sA: s.forkB, sB: s.mergeB, offA: 8 * sideB, offB: 8 * sideB, width: 16, lethal: true });
  // vuelo: desde la cima de la rampa hasta la recepción
  let uTop = 0, yTop = -1e9; for (let u = 110; u < B.blen - 110; u += 2) { B.sampleU(u, F); if (F.pos.y > yTop) { yTop = F.pos.y; uTop = u; } }
  const uLand = uTop + 95;
  B.bgaps = [[uTop, uLand]]; B.open = [[uLand, uLand + 70]]; B.view.gaps = [{ s0: B.sOfU(uTop), s1: B.sOfU(uLand) }]; B.aiTake = 0.5;
  return { track, s, M, A, B };
}

// ─────────────────────────────────────────────────────────────
//  Mundo (gris de prueba)
// ─────────────────────────────────────────────────────────────
export function ioSunDir() { return new THREE.Vector3(-0.4, 0.5, 0.75).normalize(); }

export function buildIo(def, { world, own, srcMat }) {
  const { track, s, A, B } = ioTrack();
  const L = track.length, F = track.frame();
  const MAT = {
    deck: deckMaterial(srcMat('S6 | UV worn technology', (m) => m.color.setHex(0x6e6a66))),
    guard: guardMaterial(srcMat('S6 | Pale mineral track', (m) => m.color.setHex(0xc9c0b4))),
    warn: new THREE.MeshStandardMaterial({ color: 0x1a0e08, emissive: 0xff6a1a, emissiveIntensity: 2.4 }),
    pier: new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.9 }),
  };
  Object.values(MAT).forEach((m) => own.push(m));
  const parts = { deck: [], guard: [], warn: [], pier: [] };

  // barrido de un perfil a lo largo de la principal (s) o de un ramal (u); escribe aTrack (s, x, h, máscara) para la pintura del tablero
  const sweep = (smp, a, b, step, prof, closed, deckLike) => {
    const rows = Math.max(1, Math.round((b - a) / step)), m = prof.length, pos = [], uv = [], at = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const q = a + (b - a) * r / rows, w = smp(q, F);
      prof.forEach(([x0, h], k) => { const x = x0 * w; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), q / 32); at.push(q, x, h, 0); });
    }
    const segs = closed ? m : m - 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const i0 = r * m + k, i1 = r * m + (k + 1) % m, c = i0 + m, d = i1 + m; idx.push(i0, c, i1, i1, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (deckLike) g.setAttribute('aTrack', new THREE.Float32BufferAttribute(at, 4));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const mainS = (q, Fo) => { track.sample(q, Fo); return track.wAt(q); };
  const brU = (br) => (u, Fo) => { br.sampleU(u, Fo); Fo.pos.y -= 0.06; return 1; };   // un pelo por debajo: donde se solapa, manda el tablero principal

  const wallL = [[-16.35, -0.05], [-16.35, 1.75], [-16.9, 1.95], [-17.4, 1.75], [-17.4, -0.7]];
  const wallR = wallL.map(([x, h]) => [-x, h]).reverse();
  parts.deck.push(sweep(mainS, 0, L, 3, DECK_SOLID, true, true));
  // guardarraíles: abiertos del lado del desvío mientras el ramal se separa / se reincorpora
  const holes = { [1]: [], [-1]: [] };
  for (const br of [A, B]) { holes[br.side].push([br.sA - 2, br.sA + 140], [br.sB - 140, br.sB + 2]); }
  const wallRuns = (side) => { const hs = holes[side].map(([a, b]) => [track.wrap(a), track.wrap(b)]).sort((p, q) => p[0] - q[0]); const runs = []; let a = 0; for (const [h0, h1] of hs) { if (h0 > a) runs.push([a, h0]); a = Math.max(a, h1); } if (a < L) runs.push([a, L]); return runs; };
  // el perfil wallR está en x > 0 (lado +right)
  for (const [a, b] of wallRuns(1)) parts.guard.push(sweep(mainS, a, b, 3, wallR, false, true));
  for (const [a, b] of wallRuns(-1)) parts.guard.push(sweep(mainS, a, b, 3, wallL, false, true));

  // ramales: tablero fino; viaducto sin muros con balizas de aviso; salto con muros en la rampa y hueco en el vuelo
  const slab = (hw) => [[-hw, 0], [hw, 0], [hw + 0.6, -0.5], [hw * 0.6, -2.2], [-hw * 0.6, -2.2], [-hw - 0.6, -0.5]];
  const deckRuns = (br) => { const runs = []; let a = 0; for (const [g0, g1] of br.bgaps) { runs.push([a, g0]); a = g1; } runs.push([a, br.blen]); return runs; };
  for (const br of [A, B]) {
    const hw = 16 * br.wScale;
    for (const [a, b] of deckRuns(br)) parts.deck.push(sweep(brU(br), a, b, 2, slab(hw), true, true));
    // aviso: filo naranja en los bordes abiertos
    for (const [a, b] of br.open) { parts.warn.push(sweep(brU(br), a, b, 2, [[-hw - 0.1, 0.02], [-hw - 0.1, 0.35], [-hw + 0.5, 0.35]], false, false), sweep(brU(br), a, b, 2, [[hw - 0.5, 0.35], [hw + 0.1, 0.35], [hw + 0.1, 0.02]], false, false)); }
    // muros donde no está abierto ni en vuelo (rampa del salto)
    const closed = []; let a = 110; const cuts = [...br.open, ...br.bgaps].sort((p, q) => p[0] - q[0]);
    for (const [c0, c1] of cuts) { if (c0 > a) closed.push([a, c0]); a = Math.max(a, c1); } if (a < br.blen - 110) closed.push([a, br.blen - 110]);
    const wl = [[-hw - 0.35, -0.05], [-hw - 0.35, 1.6], [-hw - 0.9, 1.6], [-hw - 0.9, -0.6]], wr = wl.map(([x, h]) => [-x, h]).reverse();
    for (const [c0, c1] of closed) parts.guard.push(sweep(brU(br), c0, c1, 3, wl, false, false), sweep(brU(br), c0, c1, 3, wr, false, false));
    // pilas del ramal hasta la lava
    for (let u = 90; u < br.blen - 90; u += 70) { br.sampleU(u, F); if (br.gapAtU(u) >= 0) continue; const h = F.pos.y - LAVA_Y; const c = new THREE.CylinderGeometry(1.6, 2.6, h, 10); c.translate(F.pos.x, LAVA_Y + h / 2 - 2.5, F.pos.z); parts.pier.push(c); }
  }
  // pilas de la principal
  for (let q = 40; q < L; q += 90) { track.sample(q, F); const h = F.pos.y - LAVA_Y; for (const sd of [-9, 9]) { const p = F.pos.clone().addScaledVector(F.right, sd); const c = new THREE.CylinderGeometry(2.2, 3.4, h, 10); c.translate(p.x, LAVA_Y + h / 2 - 3, p.z); parts.pier.push(c); } }

  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const norm = list.map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aTrack'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.aTrack && (k === 'deck' || k === 'guard')) g.setAttribute('aTrack', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4)); return g; });
    const merged = mergeGeometries(norm, false); list.forEach((g) => g.dispose()); own.push(merged);
    const mesh = new THREE.Mesh(merged, MAT[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck' && k !== 'warn';
    world.add(mesh);
  }

  // lago de lava provisional: costra oscura con grietas incandescentes
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vW.xz * 0.012; float t = uT * 0.03;
        float n = vn(p + t) * 0.55 + vn(p * 2.3 - t) * 0.3 + vn(p * 6.1 + t * 2.0) * 0.15;
        float crack = 1.0 - smoothstep(0.02, 0.09, abs(n - 0.5));
        vec3 crust = vec3(0.05, 0.02, 0.015), hot = vec3(4.0, 1.1, 0.18);
        gl_FragColor = vec4(mix(crust, hot, crack) + hot * 0.06, 1.0);
      }`,
  });
  own.push(lavaMat);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2), lavaMat);
  const c = new THREE.Box3(); for (let q = 0; q < L; q += 50) { track.sample(q, F); c.expandByPoint(F.pos); }
  const ctr = c.getCenter(new THREE.Vector3()); lava.position.set(ctr.x, LAVA_Y, ctr.z);
  own.push(lava.geometry); world.add(lava);

  const fx = { update(dt) { lavaMat.uniforms.uT.value += dt; } };
  return { track, ground: () => LAVA_Y, tunnel: { s: s.tunnel, len: s.tunnelOut - s.tunnel }, bridges: 0, fx, dbg: { s, A, B } };
}
