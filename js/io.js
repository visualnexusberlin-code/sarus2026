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
import { jupiterSky } from './europa.js';

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
  A.open = [[170, A.blen - 110]]; A.aiTake = 0.45;   // los primeros 170 m con muro: la nave se asienta antes de quedar sin red
  // B · SALTO: dos carriles (16 m); rampa que sube, vuelo sobre la cresta, recepción más baja (bordes abiertos los primeros 70 m)
  const ptsB = branchPoints(track, { sA: s.forkB, sB: s.mergeB, offA: 8 * sideB, offB: 8 * sideB, yMid: [[0.2, 172], [0.27, 176], [0.5, 120]], tension: 0.3 });
  const B = track.addBranch({ id: 'jump', pts: ptsB, sA: s.forkB, sB: s.mergeB, offA: 8 * sideB, offB: 8 * sideB, width: 16, lethal: true });
  // vuelo: desde la cima de la rampa hasta la recepción
  let uTop = 0, yTop = -1e9; for (let u = 110; u < B.blen - 110; u += 2) { B.sampleU(u, F); if (F.pos.y > yTop) { yTop = F.pos.y; uTop = u; } }
  const uLand = uTop + 95;
  B.bgaps = [[uTop, uLand]]; B.open = [[uLand, uLand + 70]]; B.view.gaps = [{ s0: B.sOfU(uTop), s1: B.sOfU(uLand) }]; B.aiTake = 0.5;
  // Filas de tres turbos azules (petición de Dear, 20 nov.): reaparecen enseguida para que casi todos cojan uno.
  // Puestas para la locura: dos seguidas en la recta de salida, una que lanza al viaducto sin guardarraíles,
  // una en la terraza que mete al pelotón en el túnel y otra dentro del túnel que lanza al salto.
  track.megaRows = [300, 760, s.forkA - 260, s.mergeA + 420, s.tunnel + 260].map((q) => track.wrap(q));
  track.megaRespawn = 1.2;
  return { track, s, M, A, B };
}

// ─────────────────────────────────────────────────────────────
//  Mundo (gris de prueba)
// ─────────────────────────────────────────────────────────────
export function ioSunDir() { return new THREE.Vector3(-0.4, 0.5, 0.75).normalize(); }

export function buildIo(def, { world, own, srcMat, renderer }) {
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
    const rows = Math.max(1, Math.round((b - a) / step)), m = (typeof prof === 'function' ? prof(a) : prof).length, pos = [], uv = [], at = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const q = a + (b - a) * r / rows, w = smp(q, F);
      (typeof prof === 'function' ? prof(q) : prof).forEach(([x0, h], k) => { const x = x0 * w; pos.push(F.pos.x + F.right.x * x + F.up.x * h, F.pos.y + F.right.y * x + F.up.y * h, F.pos.z + F.right.z * x + F.up.z * h); uv.push(k / (m - 1), q / 32); at.push(q, x, h, 0); });
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
  // sección maciza de los ramales (petición de Dear: que no parezcan una lámina): hombro, costado que baja y quilla en V;
  // cada punto duplicado para que las aristas salgan vivas, como DECK_SOLID
  const slab = (hw) => [[-hw, 0], [hw, 0], [hw + 1.4, -0.5], [hw + 1.4, -1.8], [hw * 0.92, -5.8], [hw * 0.45, -7.4], [0, -7.9], [-hw * 0.45, -7.4], [-hw * 0.92, -5.8], [-hw - 1.4, -1.8], [-hw - 1.4, -0.5]].flatMap((q) => [q, q]);
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

  // Señalización de cada desvío: carril de entrada iluminado con flechas que se mueven hacia el ramal (260 m antes),
  // pórtico con el nombre sobre la salida y divisoria con luces (el morro) donde las dos rutas se separan y se juntan.
  const lane = [], gores = [];
  for (const br of [A, B]) {
    const x0 = br.splitX, x1 = br.side * 15.6;
    const a0 = br.sA - 260, prof = [[Math.min(x0, x1), 0.12], [Math.max(x0, x1), 0.12]];
    lane.push(sweep((q, Fo) => { track.sample(track.wrap(q), Fo); return 1; }, a0, br.sA + 30, 2, prof, false, false));
    // la divisoria sigue la misma línea que la física (Branch.goreX): del morro hacia el borde
    const gx = (q) => track.dividerAt(track.wrap(q))?.x ?? br.side * 16.6;
    const gp = (q) => { const x = gx(q); return [[x - 0.45, -0.02], [x - 0.45, 1.1], [x + 0.45, 1.1], [x + 0.45, -0.02]]; };
    const gl = (q) => { const x = gx(q); return [[x - 0.5, 1.1], [x + 0.5, 1.1], [x + 0.5, 1.35], [x - 0.5, 1.35]]; };
    const msm = (q, Fo) => { track.sample(track.wrap(q), Fo); return 1; };
    gores.push(sweep(msm, br.sA + 0.5, br.sA + br.gore, 2, gp, false, false), sweep(msm, br.sB - br.gore, br.sB - 0.5, 2, gp, false, false));
    parts.warn.push(sweep(msm, br.sA + 0.5, br.sA + br.gore, 2, gl, true, false), sweep(msm, br.sB - br.gore, br.sB - 0.5, 2, gl, true, false));
  }
  parts.guard.push(...gores);
  const laneMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        // flechas «>» a lo largo del carril, corriendo hacia el desvío
        float v = vUv.y * 32.0 / 14.0 - uT * 3.0, x = abs(vUv.x - 0.5) * 2.0;
        float chev = fract(v - x * 0.55), a = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.32, 0.4, chev));
        float edge = smoothstep(0.86, 0.98, x);
        gl_FragColor = vec4(vec3(1.0, 0.42, 0.08) * (a * 3.0 + edge * 2.2 + 0.22), 1.0);
      }`,
  });
  own.push(laneMat);
  { const g = mergeGeometries(lane.map((q) => { q.deleteAttribute('normal'); return q; }), false); lane.forEach((q) => q.dispose()); own.push(g); world.add(new THREE.Mesh(g, laneMat)); }
  // pórtico con el nombre del desvío sobre la salida
  const sign = (txt, sub) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = '#120a06'; x.fillRect(0, 0, 1024, 256); x.fillStyle = '#ff7a1e'; x.fillRect(0, 0, 1024, 14); x.fillRect(0, 242, 1024, 14);
    x.fillStyle = '#ffe6cc'; x.font = '84px Michroma, sans-serif'; x.textAlign = 'center'; x.fillText(txt, 512, 128);
    x.fillStyle = '#ff9a4a'; x.font = '40px "IBM Plex Mono", monospace'; x.fillText(sub, 512, 205);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; own.push(t); return t;
  };
  for (const br of [A, B]) {
    const [txt, sub] = br.id === 'viaduct' ? ['A · VIADUCTO', 'SIN GUARDARRAÍL · LAVA'] : ['B · SALTO', 'RECEPCIÓN SIN RED · LAVA'];
    const m = new THREE.MeshBasicMaterial({ map: sign(txt, sub), toneMapped: false }); own.push(m);
    track.sample(br.sA - 160, F);
    const cx = (br.splitX + br.side * 15.6) / 2, p = F.pos.clone().addScaledVector(F.right, cx).addScaledVector(F.up, 11.5);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), m); own.push(board.geometry);
    board.position.copy(p); board.lookAt(p.clone().sub(F.tan)); world.add(board);
    for (const px of [br.splitX, br.side * 16.5]) { const q = F.pos.clone().addScaledVector(F.right, px); const g = new THREE.BoxGeometry(0.6, 14, 0.6); g.translate(q.x, q.y + 7, q.z); parts.pier.push(g); }
  }

  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const norm = list.map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aTrack'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.aTrack && (k === 'deck' || k === 'guard')) g.setAttribute('aTrack', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4)); return g; });
    const merged = mergeGeometries(norm, false); list.forEach((g) => g.dispose()); own.push(merged);
    const mesh = new THREE.Mesh(merged, MAT[k]); mesh.receiveShadow = true; mesh.castShadow = k !== 'deck' && k !== 'warn';
    world.add(mesh);
  }

  const land = buildCaldera(world, own, track, [A, B], s);
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
        vec3 crust = vec3(0.035, 0.016, 0.012), hot = vec3(2.4, 0.62, 0.1);
        gl_FragColor = vec4(mix(crust, hot, crack) + hot * 0.025, 1.0);
      }`,
  });
  own.push(lavaMat);
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(land.half * 1.9, land.half * 1.9, 1, 1).rotateX(-Math.PI / 2), lavaMat);
  lava.position.set(land.cx, LAVA_Y, land.cz);
  own.push(lava.geometry); world.add(lava);
  // Júpiter enorme sobre el horizonte, hacia donde mira la recta de salida
  if (renderer) { track.sample(0, F); jupiterSky(world, own, renderer, new THREE.Vector3(land.cx, 0, land.cz), F.tan.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35), { dist: 150000, elev: 15, sunDir: ioSunDir() }); }

  const lavaFx = new LavaFX(world, own, track, [A, B], land);
  const fx = { update(dt, cam, G) { lavaMat.uniforms.uT.value += dt; laneMat.uniforms.uT.value += dt; land.update(dt); lavaFx.update(dt, cam, G); } };
  return { track, ground: (x, z) => Math.max(LAVA_Y, land.heightAt(x, z)), tunnel: { s: s.tunnel, len: s.tunnelOut - s.tunnel }, bridges: 0, fx, dbg: { s, A, B } };
}

// ─────────────────────────────────────────────────────────────
//  Géiseres y burbujas de lava (petición de Dear, 21 nov.)
// ─────────────────────────────────────────────────────────────
// Géiseres: respiraderos fijos junto a la pista que entran en erupción cada pocos segundos: un surtidor de gotas
// incandescentes que suben 60–170 m y caen enfriándose (amarillo → naranja → rojo oscuro).
// Burbujas: cúpulas de piel de lava que se hinchan en el lago cerca de la cámara y revientan en una salpicadura.
// Una sola nube de puntos (gotas) y una malla instanciada (burbujas): dos programas, cero luces nuevas.
const MAXP = 4200, MAXB = 18, GRAV = 14;
class LavaFX {
  constructor(world, own, track, branches, land) {
    this.world = world; this.land = land;
    // gotas
    this.p = new Float32Array(MAXP * 3); this.v = new Float32Array(MAXP * 3); this.age = new Float32Array(MAXP); this.life = new Float32Array(MAXP); this.size = new Float32Array(MAXP); this.n = 0;
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aHeat = new THREE.BufferAttribute(new Float32Array(MAXP * 2), 2).setUsage(THREE.DynamicDrawUsage);   // calor, tamaño
    g.setAttribute('position', this.aPos); g.setAttribute('aHeat', this.aHeat); g.setDrawRange(0, 0);
    this.pmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 500 } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec2 aHeat; uniform float uScale; varying float vHeat;
        void main(){ vHeat = aHeat.x; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aHeat.y * uScale / max(-mv.z, 0.1), 0.0, 256.0); gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying float vHeat;
        void main(){
          #include <logdepthbuf_fragment>
          float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, r);
          if (a < 0.01) discard;
          vec3 hot = vec3(3.2, 2.2, 0.8), warm = vec3(2.4, 0.7, 0.1), cool = vec3(0.35, 0.05, 0.01);
          vec3 c = vHeat > 0.5 ? mix(warm, hot, (vHeat - 0.5) * 2.0) : mix(cool, warm, vHeat * 2.0);
          gl_FragColor = vec4(c * a * (0.5 + 0.5 * (1.0 - r)), 1.0);
        }`,
    });
    own.push(g, this.pmat);
    this.points = new THREE.Points(g, this.pmat); this.points.frustumCulled = false; world.add(this.points);

    // burbujas: media esfera de piel de lava; aGrow (0–1) hincha y abre las grietas
    const bg = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.bmat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aGrow; varying float vGrow; varying vec3 vN; varying vec3 vL; varying vec3 vV;
        void main(){ vGrow = aGrow; vL = position; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uT; varying float vGrow; varying vec3 vN; varying vec3 vL; varying vec3 vV;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          #include <logdepthbuf_fragment>
          float n = vn(vL * 3.5 + uT * 0.2) * 0.6 + vn(vL * 8.0) * 0.4;
          float crack = 1.0 - smoothstep(0.03, 0.03 + 0.12 * (1.0 - vGrow * 0.7), abs(n - 0.5));   // la piel se abre al hincharse
          float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
          vec3 crust = vec3(0.06, 0.025, 0.015), hot = vec3(3.0, 0.9, 0.15);
          vec3 c = mix(crust, hot, clamp(crack + rim * 0.7 + vGrow * vGrow * 0.25, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    own.push(bg, this.bmat);
    this.bub = new THREE.InstancedMesh(bg, this.bmat, MAXB); this.bub.frustumCulled = false; this.bub.count = 0;
    this.aGrow = new THREE.InstancedBufferAttribute(new Float32Array(MAXB), 1).setUsage(THREE.DynamicDrawUsage);
    bg.setAttribute('aGrow', this.aGrow); world.add(this.bub);
    this.bubbles = [];

    // respiraderos: junto a la pista y bajo los desvíos, sobre la lava, sin caer bajo el tablero
    const F = track.frame(); this.vents = [];
    const add = (p) => land.heightAt(p.x, p.z) < LAVA_Y - 2 && this.vents.push({ x: p.x, z: p.z, t: Math.random() * 8, on: 0, power: 0.75 + Math.random() * 0.5 });
    for (let q = 200; q < track.length * 3 && this.vents.length < 14; q += track.length / 23) {
      track.sample(track.wrap(q), F); const sd = Math.random() < 0.5 ? -1 : 1, off = 55 + Math.random() * 120;
      add(F.pos.clone().addScaledVector(F.right, sd * off));
    }
    for (const br of branches) { br.sampleU(br.blen * 0.5, F); add(F.pos.clone().addScaledVector(F.right, 40)); add(F.pos.clone().addScaledVector(F.right, -45)); }
    this.tb = 1;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
  }
  emit(x, y, z, vx, vy, vz, life, size) {
    if (this.n >= MAXP) return; const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size;
  }
  update(dt, cam, G) {
    if (!dt) return;
    dt = Math.min(dt, 0.05);
    const Y = LAVA_Y + 0.5;
    // géiseres
    for (const g of this.vents) {
      g.t -= dt;
      if (g.on <= 0 && g.t <= 0) { g.on = 1.8 + Math.random() * 2.6; g.t = g.on + 3 + Math.random() * 9; g.vy = (38 + Math.random() * 26) * g.power; }
      if (g.on > 0) {
        g.on -= dt;
        const rate = 260 * g.power, k = Math.floor(rate * dt + Math.random());
        for (let j = 0; j < k; j++) {
          const a = Math.random() * 6.283, r = Math.random() * 3.5, sp = 2 + Math.random() * 7;
          this.emit(g.x + Math.cos(a) * r, Y, g.z + Math.sin(a) * r, Math.cos(a) * sp, g.vy * (0.75 + Math.random() * 0.35), Math.sin(a) * sp, 12, 2.5 + Math.random() * 4.5);
        }
      }
    }
    // pie de las cascadas: gotas y chispas que saltan sin parar
    for (const f of this.land.falls || []) { const k = Math.floor(40 * dt + Math.random()); for (let j = 0; j < k; j++) { const a = Math.random() * 6.283, sp = 6 + Math.random() * 14; this.emit(f.x + (Math.random() - 0.5) * f.w, LAVA_Y + 1, f.z + (Math.random() - 0.5) * 8, Math.cos(a) * sp * 0.4, 10 + Math.random() * 18, Math.sin(a) * sp * 0.4, 4, 1.5 + Math.random() * 2.5); } }
    // burbujas cerca de la cámara
    const cp = cam.position;
    this.tb -= dt;
    if (this.tb <= 0 && this.bubbles.length < MAXB) {
      this.tb = 0.35 + Math.random() * 0.9;
      const a = Math.random() * 6.283, d = 120 + Math.random() * 650;
      const bx = cp.x + Math.cos(a) * d, bz = cp.z + Math.sin(a) * d;
      if (this.land.heightAt(bx, bz) < LAVA_Y - 3) this.bubbles.push({ x: bx, z: bz, t: 0, T: 1.6 + Math.random() * 2.4, R: 4 + Math.random() * 15 });
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]; b.t += dt;
      if (b.t >= b.T) {                                  // revienta: salpicadura radial y un golpe de gotas hacia arriba
        const n = Math.round(30 + b.R * 6);
        for (let j = 0; j < n; j++) { const a = Math.random() * 6.283, up = 0.4 + Math.random() * 0.9, sp = (8 + Math.random() * 18) * (0.6 + b.R / 18);
          this.emit(b.x + Math.cos(a) * b.R * 0.7, Y + b.R * 0.3, b.z + Math.sin(a) * b.R * 0.7, Math.cos(a) * sp * (1 - up * 0.5), sp * up * 1.6, Math.sin(a) * sp * (1 - up * 0.5), 6, 1.5 + Math.random() * 3); }
        this.bubbles.splice(i, 1);
      }
    }
    this.bub.count = this.bubbles.length;
    this.bubbles.forEach((b, i) => {
      const f = b.t / b.T, r = b.R * (0.15 + 0.85 * Math.sqrt(f)) * (1 + 0.04 * Math.sin(b.t * 9));
      this._m.compose(new THREE.Vector3(b.x, LAVA_Y - r * 0.15, b.z), this._q, new THREE.Vector3(r, r * (0.55 + 0.35 * f), r));
      this.bub.setMatrixAt(i, this._m); this.aGrow.array[i] = f;
    });
    this.bub.instanceMatrix.needsUpdate = true; this.aGrow.needsUpdate = true;
    this.bmat.uniforms.uT.value += dt;
    // gotas: gravedad, se enfrían, mueren al volver a la lava
    let w = 0; const P = this.p, V = this.v, ap = this.aPos.array, ah = this.aHeat.array;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt; V[i * 3 + 1] -= GRAV * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (this.age[i] > this.life[i] || (P[i * 3 + 1] < LAVA_Y && V[i * 3 + 1] < 0)) continue;
      if (w !== i) { for (let k = 0; k < 3; k++) { P[w * 3 + k] = P[i * 3 + k]; V[w * 3 + k] = V[i * 3 + k]; } this.age[w] = this.age[i]; this.life[w] = this.life[i]; this.size[w] = this.size[i]; }
      ap[w * 3] = P[w * 3]; ap[w * 3 + 1] = P[w * 3 + 1]; ap[w * 3 + 2] = P[w * 3 + 2];
      ah[w * 2] = Math.max(0, 1 - this.age[w] / (this.life[w] * 0.8)); ah[w * 2 + 1] = this.size[w];
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w); this.aPos.needsUpdate = true; this.aHeat.needsUpdate = true;
    const h = (G?.renderer?.domElement?.height) || innerHeight;
    this.pmat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov || 60) / 2));
  }
}

// ─────────────────────────────────────────────────────────────
//  Caldera: paredes de basalto, terrazas, cascadas de lava, rocas y colonia minera (paso 3–4, primera versión)
// ─────────────────────────────────────────────────────────────
// Terreno en rejilla según la pista: dentro del lazo, lago (bajo la lava) salvo junto a los tramos altos, donde una
// repisa de roca sostiene el tablero y cae en acantilado al lago; fuera del lazo, la pared de la caldera sube hasta
// ~380 m. Junto a los tramos bajos (recta de salida sobre pilares) la lava llega hasta la pista por los dos lados.
// Color por vértice (basalto, azufre amarillo, escarcha blanca, óxido) y brillo de la lava desde abajo.
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash2(i, j) * (1 - u) + hash2(i + 1, j) * u) * (1 - v) + (hash2(i, j + 1) * (1 - u) + hash2(i + 1, j + 1) * u) * v; }
function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.27 + vnoise(x * 4.3, z * 4.3) * 0.15 + vnoise(x * 9.1, z * 9.1) * 0.08; }

function buildCaldera(world, own, track, branches, S) {
  const F = track.frame(), L = track.length;
  // muestras de la principal (cada 16 m) y de los ramales (sin repisa, solo para no atravesar su tablero)
  const T = []; for (let q = 0; q < L; q += 16) { track.sample(q, F); T.push([F.pos.x, F.pos.z, F.pos.y]); }
  const BR = []; for (const br of branches) for (let u = 0; u < br.blen; u += 12) { br.sampleU(u, F); BR.push([F.pos.x, F.pos.z, F.pos.y]); }
  const inside = (x, z) => { let c = false; for (let i = 0, j = T.length - 1; i < T.length; j = i++) { const [xi, zi] = T[i], [xj, zj] = T[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const near = (x, z) => { let bd = 1e18, by = 0; for (const [tx, tz, ty] of T) { const d = (tx - x) ** 2 + (tz - z) ** 2; if (d < bd) { bd = d; by = ty; } } return [Math.sqrt(bd), by]; };
  const nearB = (x, z) => { let bd = 1e18, by = 0; for (const [tx, tz, ty] of BR) { const d = (tx - x) ** 2 + (tz - z) ** 2; if (d < bd) { bd = d; by = ty; } } return [Math.sqrt(bd), by]; };
  const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const FLOOR = LAVA_Y - 14;
  const heightRaw = (x, z) => {
    const [d, yN] = near(x, z), ins = inside(x, z), n = fbm(x * 0.006, z * 0.006), n2 = fbm(x * 0.03 + 7, z * 0.03);
    const high = sst(40, 90, yN);                         // tramo alto: hay repisa de roca bajo el tablero
    const bench = yN - 9 - n2 * 3;
    let h;
    if (ins) {
      const cliff = bench - sst(26, 70 + n * 120, d) * (bench - FLOOR);
      h = FLOOR + (cliff - FLOOR) * high;
      // agujas e islotes de basalto sueltos en el lago
    } else {
      const base = FLOOR + (bench - FLOOR) * high;
      const start = 30 + (1 - high) * 230;               // junto a los tramos bajos la lava llega a la pista
      h = base + sst(start, start + 650, d) * (380 + n * 140 - base) + (sst(20, 80, d) * n2 * 18);
    }
    // nunca por encima de un tablero (principal: 9 m de margen en 24 m a cada lado; ramales: 10 m en 14 m)
    if (d < 34) h = Math.min(h, yN - 10.5 - Math.max(0, 24 - d) * 0);
    const [db, yb] = nearB(x, z); if (db < 22) h = Math.min(h, yb - 11);
    return h;
  };
  // rejilla
  const c = new THREE.Box3(); for (const [x, z] of T) c.expandByPoint(new THREE.Vector3(x, 0, z));
  const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2, half = Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2 + 900;
  const N = 230, step = 2 * half / N, H = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = heightRaw(cx - half + i * step, cz - half + j * step);
  const heightAt = (x, z) => {
    const fi = (x - (cx - half)) / step, fj = (z - (cz - half)) / step; if (fi < 0 || fj < 0 || fi >= N || fj >= N) return 380;
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * (N + 1) + i;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N + 1] * (1 - u) + H[k + N + 2] * u) * v;
  };
  const geo = new THREE.PlaneGeometry(2 * half, 2 * half, N, N).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k) + cx, z = pos.getZ(k) + cz;    // PlaneGeometry rotada: filas en z
    const i = Math.round((x - (cx - half)) / step), j = Math.round((z - (cz - half)) / step);
    pos.setXYZ(k, x, H[j * (N + 1) + i], z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), flat = nrm.getY(k), n = fbm(x * 0.012, z * 0.012), n2 = fbm(x * 0.05 + 3, z * 0.05);
    // basalto pardo/negro; en lo llano, azufre amarillo y ocre; parches de escarcha blanca; vetas de óxido en las paredes
    let r = 0.075 + n2 * 0.04, g = 0.06 + n2 * 0.03, b = 0.05 + n2 * 0.02;
    const sulf = sst(0.6, 0.88, flat) * sst(0.58, 0.78, n) * 0.85;
    r += sulf * (0.66 - r); g += sulf * (0.5 - g); b += sulf * (0.1 - b);
    const ochre = sst(0.5, 0.8, flat) * sst(0.62, 0.75, n2) * (1 - sulf); r += ochre * 0.3; g += ochre * 0.15;
    const frost = sst(0.7, 0.95, flat) * sst(0.78, 0.86, fbm(x * 0.02 - 9, z * 0.02 + 4)); r += frost * (0.82 - r); g += frost * (0.86 - g); b += frost * (0.78 - b);
    const rust = (1 - sst(0.4, 0.7, flat)) * sst(0.6, 0.8, fbm(x * 0.04, y * 0.04)); r += rust * 0.2; g += rust * 0.05;
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  // brillo de la lava desde abajo: las paredes se encienden cerca del lago
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLY;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * 1.3 * pow(1.0 - smoothstep(${LAVA_Y.toFixed(1)}, ${(LAVA_Y + 70).toFixed(1)}, vLY), 2.0);`);
  };
  mat.customProgramCacheKey = () => 'ioCaldera';
  own.push(geo, mat);
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; world.add(ground);
  {
    const ring = new THREE.RingGeometry(half * 0.97, 40000, 96, 6).rotateX(-Math.PI / 2); ring.translate(cx, 372, cz);
    const rc = new Float32Array(ring.attributes.position.count * 3);
    for (let k = 0; k < rc.length / 3; k++) { const x = ring.attributes.position.getX(k), z = ring.attributes.position.getZ(k), n = fbm(x * 0.0007, z * 0.0007); rc[k * 3] = 0.09 + n * 0.16; rc[k * 3 + 1] = 0.07 + n * 0.11; rc[k * 3 + 2] = 0.04 + n * 0.03; }
    ring.setAttribute('color', new THREE.BufferAttribute(rc, 3)); own.push(ring);
    const rm = new THREE.Mesh(ring, mat); rm.receiveShadow = true; world.add(rm);
  }

  // ── cascadas de lava: cintas que bajan por el acantilado desde la repisa hasta el lago (tres, como en el concepto)
  const fallMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT; varying vec2 vUv;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vec2(vUv.x * 6.0, vUv.y * 14.0 + uT * 1.6);
        float n = vn(p) * 0.6 + vn(p * 2.7 + 3.0) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 hot = vec3(3.4, 1.2, 0.2), crust = vec3(0.25, 0.05, 0.01);
        vec3 c = mix(crust, hot, smoothstep(0.35, 0.75, n) * edge + 0.25 * edge);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  own.push(fallMat);
  const fallG = [], falls = [];
  const fallAt = (sq, w) => {
    // punto de la repisa por el lado del lago (dentro del lazo) y caída hacia el agua de lava
    track.sample(track.wrap(sq), F);
    let side = 1; { const p = F.pos.clone().addScaledVector(F.right, 60); if (!inside(p.x, p.z)) side = -1; }
    const dir = F.right.clone().multiplyScalar(side).setY(0).normalize(), along = F.tan.clone().setY(0).normalize();
    const rows = 40, pts = [], uvs = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, d = 24 + t * 190;
      for (let k = 0; k <= 1; k++) {
        const p = F.pos.clone().addScaledVector(dir, d).addScaledVector(along, (k - 0.5) * w * (1 + t * 0.6));
        const y = Math.max(LAVA_Y - 1, heightAt(p.x, p.z) + 1.2);
        pts.push(p.x, y, p.z); uvs.push(k, 1 - t);
      }
    }
    for (let r = 0; r < rows; r++) { const a = r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    fallG.push(g);
    const end = F.pos.clone().addScaledVector(dir, 214); falls.push({ x: end.x, z: end.z, w });
  };
  fallAt((S.forkA + S.mergeA) / 2 - 520, 48);            // flanco derecho, junto a la S
  fallAt(S.mergeA + 520, 70);                           // bajo la colonia
  fallAt(S.mergeA + 860, 44);
  if (fallG.length) { const g = mergeGeometries(fallG, false); fallG.forEach((q) => q.dispose()); own.push(g); const m = new THREE.Mesh(g, fallMat); m.material.side = THREE.DoubleSide; world.add(m); }

  // ── rocas: bloques de basalto aquí y allá (repisas y lago), no por todas partes
  const rockG = new THREE.IcosahedronGeometry(1, 1); { const p = rockG.attributes.position; for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k); v.multiplyScalar(0.75 + hash2(v.x * 9 + 1, v.z * 7 + v.y * 3) * 0.5); p.setXYZ(k, v.x, v.y, v.z); } rockG.computeVertexNormals(); }
  const rockM = new THREE.MeshStandardMaterial({ color: 0x2a221e, roughness: 0.95, flatShading: true });
  own.push(rockG, rockM);
  const rocks = []; let tries = 0;
  while (rocks.length < 160 && tries++ < 4000) {
    const x = cx - half * 0.8 + hash2(tries, 1.3) * half * 1.6, z = cz - half * 0.8 + hash2(2.7, tries) * half * 1.6;
    const [d] = near(x, z); if (d < 40) continue;
    const [db] = nearB(x, z); if (db < 30) continue;
    const h = heightAt(x, z), onLava = h < LAVA_Y;
    if (!onLava && (hash2(x, z) > 0.45 || h > 300)) continue;
    if (onLava && hash2(z, x) > 0.18) continue;
    const sc = onLava ? 6 + hash2(x * 3, z) * 22 : 3 + hash2(x, z * 5) * 14;
    rocks.push([x, Math.max(h, LAVA_Y) - sc * 0.25, z, sc, hash2(z * 2, x) * 6.28, onLava ? 1.6 + hash2(x, 9) : 0.8 + hash2(x, 3) * 0.6]);
  }
  const rk = new THREE.InstancedMesh(rockG, rockM, rocks.length); const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion();
  rocks.forEach(([x, y, z, sc, a, tall], i) => { q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(x, y, z), q4, new THREE.Vector3(sc, sc * tall, sc * (0.8 + hash2(a, sc) * 0.4))); rk.setMatrixAt(i, m4); });
  rk.castShadow = true; rk.receiveShadow = true; world.add(rk);

  // ── colonia minera en la terraza alta, por fuera de la pista (módulos iluminados, castilletes, conducciones)
  const metal = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.7, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x140c06, emissive: 0xffb060, emissiveIntensity: 2.2 });
  const red = new THREE.MeshStandardMaterial({ color: 0x200404, emissive: 0xff2a10, emissiveIntensity: 3 });
  own.push(metal, glow, red);
  const cg = { metal: [], glow: [], red: [] };
  const box = (list, w, h, d, p, yaw) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(p.x, p.y + h / 2, p.z); list.push(g); };
  const t0 = S.mergeA + 380, t1 = S.tunnel - 40;
  for (let q = t0, k = 0; q < t1; q += 70 + hash2(q, 1) * 60, k++) {
    track.sample(track.wrap(q), F);
    let side = 1; { const p = F.pos.clone().addScaledVector(F.right, 80); if (inside(p.x, p.z)) side = -1; }
    const yaw = Math.atan2(F.tan.x, F.tan.z);
    // módulos por fuera (contra la pared) y, uno de cada tres, asomados al acantilado por dentro, sobre las cascadas
    const inner = k % 3 === 2, off = inner ? 42 + hash2(q, 7) * 14 : 44 + hash2(q, 7) * 70;
    const p = F.pos.clone().addScaledVector(F.right, (inner ? -side : side) * off); p.y = Math.max(heightAt(p.x, p.z), F.pos.y - 14);
    if (p.y > F.pos.y + 30) continue;
    const w = 30 + hash2(q, 2) * 26, h = 12 + hash2(q, 3) * 10, d = 18 + hash2(q, 4) * 12;
    box(cg.metal, w, h + 12, d, p.clone().setY(p.y - 12), yaw);                         // con zócalo enterrado
    box(cg.glow, w * 0.94, 1.4, d + 0.3, p.clone().setY(p.y + h * 0.35), yaw);           // dos franjas de ventanas
    box(cg.glow, w * 0.94, 1.4, d + 0.3, p.clone().setY(p.y + h * 0.7), yaw);
    if (k % 2 === 0) { box(cg.metal, w * 0.5, 6, d * 0.6, p.clone().setY(p.y + h), yaw); box(cg.red, 1.2, 1.2, 1.2, p.clone().setY(p.y + h + 6), 0); }
    if (k % 3 === 1) {                                     // castillete de extracción: cuatro patas, cabezal y luz roja
      const tp = F.pos.clone().addScaledVector(F.right, side * (off + 60)); tp.y = heightAt(tp.x, tp.z); const H2 = 70 + hash2(q, 9) * 34;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.7, 0.9, H2 * 1.03, 6); g.rotateZ(a * 0.12); g.rotateX(b * 0.12); g.translate(tp.x + a * 4, tp.y + H2 / 2, tp.z + b * 4); cg.metal.push(g); }
      box(cg.metal, 12, 5, 12, tp.clone().setY(tp.y + H2), yaw);
      const wh = new THREE.TorusGeometry(5, 0.5, 6, 20); wh.rotateY(yaw); wh.translate(tp.x, tp.y + H2 + 9, tp.z); cg.metal.push(wh);
      box(cg.red, 1.4, 1.4, 1.4, tp.clone().setY(tp.y + H2 + 15), 0);
    }
  }
  // conducción junto a la pista hasta la boca del túnel
  for (let q = t0; q < S.tunnel + 30; q += 6) {
    track.sample(track.wrap(q), F); let side = 1; { const p = F.pos.clone().addScaledVector(F.right, 80); if (inside(p.x, p.z)) side = -1; }
    const p = F.pos.clone().addScaledVector(F.right, side * 27); p.y = F.pos.y - 2; const g = new THREE.CylinderGeometry(1.3, 1.3, 6.2, 8); g.rotateX(Math.PI / 2); g.rotateY(Math.atan2(F.tan.x, F.tan.z)); g.translate(p.x, p.y, p.z); cg.metal.push(g);
  }
  for (const [k, list] of Object.entries(cg)) { if (!list.length) continue; const g = mergeGeometries(list.map((q) => q.toNonIndexed ? q.toNonIndexed() : q), false); list.forEach((q) => q.dispose()); own.push(g); const mesh = new THREE.Mesh(g, k === 'metal' ? metal : k === 'glow' ? glow : red); mesh.castShadow = k === 'metal'; mesh.receiveShadow = true; world.add(mesh); }

  return { heightAt, falls, cx, cz, half, update(dt) { fallMat.uniforms.uT.value += dt; } };
}
