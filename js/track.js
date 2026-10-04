// Pista: extrae la línea central del propio GLB ("TRACK | continuous 32m racing deck")
// y la convierte en un spline muestreado cada metro con marco local (tangente, derecha, arriba, curvatura).
import * as THREE from 'three';
import { CONFIG } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export const normName = (o) => (o.userData?.name || o.name || '').replace(/_/g, ' ');

export class Track {
  // opts: { relief: {amplify, hills, clamp}, inSectorOrder, groundFn(pts) → [{below, above}] por sección }
  constructor(circuit, opts = {}) {
    let pts, n;
    if (opts.points) {                      // circuito generado: línea central ya con cotas
      pts = opts.points.map((p) => p.clone());
      n = pts.length;
      this.width = opts.width || 32;
    } else {
      circuit.updateMatrixWorld(true);
      let deck = null;
      circuit.traverse((o) => { if (o.isMesh && /racing deck/i.test(normName(o))) deck = o; });
      if (!deck) throw new Error('No se encontró "TRACK | continuous 32m racing deck" en el GLB');
      // El tablero exportado desde Blender: secciones de 16 vértices (caja de 4 caras, normales partidas).
      // v0 y v4 son las aristas superiores izquierda/derecha → centro superior de cada sección.
      const pos = deck.geometry.attributes.position;
      const per = 16;
      n = Math.floor(pos.count / per);
      pts = [];
      for (let i = 0; i < n; i++) {
        _a.fromBufferAttribute(pos, i * per).applyMatrix4(deck.matrixWorld);
        _b.fromBufferAttribute(pos, i * per + 4).applyMatrix4(deck.matrixWorld);
        pts.push(_a.clone().add(_b).multiplyScalar(0.5));
        if (i === 0) this.width = _a.distanceTo(_b);
      }
    }
    // ── Relieve: amplifica el perfil vertical y añade ondulaciones (periódicas en la vuelta) ──
    const R = CONFIG.relief.enabled ? (opts.relief || null) : null;
    const mean = pts.reduce((a, p) => a + p.y, 0) / n;
    let delta = pts.map((p, i) => {
      if (!R) return 0;
      let y = mean + (p.y - mean) * R.amplify;
      for (const [amp, f, ph] of R.hills) y += amp * Math.sin(2 * Math.PI * f * i / n + ph);
      return y - p.y;
    });
    const smoothD = (K) => { delta = delta.map((_, i) => { let a = 0; for (let k = -K; k <= K; k++) a += delta[(i + k + n) % n]; return a / (2 * K + 1); }); };
    smoothD(5);
    // holgura: el tablero no baja a menos de 'below' m del suelo/edificios ni sube a menos de 'above' m de lo que tenga encima
    if (R && R.clamp && opts.groundFn) {
      const G = opts.groundFn(pts);
      const clampD = () => { delta = delta.map((d, i) => {
        let y = pts[i].y + d;
        const hi = G[i].above - R.clamp.above, lo = G[i].below + R.clamp.below;
        if (hi < 1e8) y = Math.min(y, hi);
        if (lo > -1e8) y = Math.max(y, lo);
        return y - pts[i].y;
      }); };
      for (const K of [8, 5, 3]) { clampD(); smoothD(K); }
      clampD(); smoothD(1);
    }
    let orig = pts.map((p) => p.clone());
    pts = pts.map((p, i) => p.clone().setY(p.y + delta[i]));

    const inOrder = (opts.inSectorOrder ?? true) !== CONFIG.reverse;
    if (inOrder) {
      const ro = (a) => [a[0], ...a.slice(1).reverse()];
      pts = ro(pts); orig = ro(orig); delta = ro(delta);
    }
    // estadísticas de relieve (consola)
    {
      let lo = Infinity, hi = -Infinity, smax = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const sl = Math.abs(b.y - a.y) / Math.max(0.1, Math.hypot(b.x - a.x, b.z - a.z));
        lo = Math.min(lo, a.y); hi = Math.max(hi, a.y); smax = Math.max(smax, sl); sum += sl;
      }
      this.stats = { minY: lo, maxY: hi, maxSlope: smax, meanSlope: sum / n };
    }
    this.sectionPoints = pts;
    this.orig = orig;
    this.relief = delta;

    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    curve.arcLengthDivisions = pts.length * 40;
    this.length = curve.getLength();
    const lens = curve.getLengths(pts.length * 40);
    this.sectionS = pts.map((_, i) => lens[i * 40]);
    this.buildIndex();
    this.ds = 1.0;
    const M = Math.round(this.length / this.ds);
    this.ds = this.length / M;
    this.count = M;

    const P = curve.getSpacedPoints(M); // M+1 puntos, el último = primero
    this.pos = new Float32Array(M * 3);
    this.tan = new Float32Array(M * 3);
    this.right = new Float32Array(M * 3);
    this.up = new Float32Array(M * 3);
    this.kappa = new Float32Array(M);
    const yaw = new Float32Array(M);

    for (let i = 0; i < M; i++) {
      const p = P[i];
      this.pos.set([p.x, p.y, p.z], i * 3);
      const pn = P[(i + 1) % M], pp = P[(i - 1 + M) % M];
      const t = _a.subVectors(pn, pp).normalize();
      this.tan.set([t.x, t.y, t.z], i * 3);
      const r = _b.crossVectors(t, UP).normalize();
      this.right.set([r.x, r.y, r.z], i * 3);
      const u = new THREE.Vector3().crossVectors(r, t).normalize();
      this.up.set([u.x, u.y, u.z], i * 3);
      yaw[i] = Math.atan2(t.x, t.z);
    }
    // Curvatura en planta (rad/m, + = giro a la izquierda), suavizada.
    const raw = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      let d = yaw[(i + 2) % M] - yaw[(i - 2 + M) % M];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      raw[i] = d / (4 * this.ds);
    }
    const W = 6;
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let k = -W; k <= W; k++) s += raw[(i + k + M) % M];
      this.kappa[i] = s / (2 * W + 1);
    }
    this.yaw = yaw;

    // Peralte opcional: gira derecha/arriba alrededor de la tangente según la curvatura (suavizada ±W4 m)
    if (opts.bank) {
      const W4 = Math.round((opts.bankSmooth ?? 40) / this.ds), bk = new Float32Array(M);
      let acc = 0;
      for (let k = -W4; k <= W4; k++) acc += this.kappa[(k + M) % M];
      for (let i = 0; i < M; i++) {
        bk[i] = opts.bank(i / M, acc / (2 * W4 + 1));
        acc += this.kappa[(i + W4 + 1) % M] - this.kappa[(i - W4 + M) % M];
      }
      this.bank = bk;
      for (let i = 0; i < M; i++) {
        const a = bk[i]; if (!a) continue;
        const c = Math.cos(a), sn = Math.sin(a), o = i * 3;
        const rx = this.right[o], ry = this.right[o + 1], rz = this.right[o + 2], ux = this.up[o], uy = this.up[o + 1], uz = this.up[o + 2];
        this.right.set([rx * c + ux * sn, ry * c + uy * sn, rz * c + uz * sn], o);
        this.up.set([ux * c - rx * sn, uy * c - ry * sn, uz * c - rz * sn], o);
      }
    }

    // Anchura: hasta +8 % en las curvas (media de curvatura en ±60 m), transición suave
    this.widen = new Float32Array(M);
    {
      const W3 = Math.round(60 / this.ds);
      let acc = 0;
      for (let k = -W3; k <= W3; k++) acc += Math.abs(this.kappa[(k + M) % M]);
      for (let i = 0; i < M; i++) {
        const kk = acc / (2 * W3 + 1);
        const t = Math.min(1, Math.max(0, (kk - 0.0035) / (0.0105 - 0.0035)));
        this.widen[i] = 1 + (opts.widen ?? 0.08) * t * t * (3 - 2 * t);
        acc += Math.abs(this.kappa[(i + W3 + 1) % M]) - Math.abs(this.kappa[(i - W3 + M) % M]);
      }
    }

    // Línea de carrera aproximada: interior de la curva en el vértice (curvatura suavizada ±45 m).
    this.line = new Float32Array(M);
    const W2 = Math.round(45 / this.ds);
    let acc = 0;
    for (let k = -W2; k <= W2; k++) acc += this.kappa[(k + M) % M];
    for (let i = 0; i < M; i++) {
      const kk = acc / (2 * W2 + 1);
      this.line[i] = -Math.max(-10.5, Math.min(10.5, kk * 700));
      acc += this.kappa[(i + W2 + 1) % M] - this.kappa[(i - W2 + M) % M];
    }

    // Sectores: pórticos "Sector NN | gate beam" proyectados sobre la pista (o fracciones dadas)
    this.sectors = [];
    if (opts.sectors) opts.sectors.forEach((f, i) => this.sectors.push({ id: i + 1, s: f * this.length }));
    else circuit.traverse((o) => {
      const m = normName(o).match(/^Sector (\d+) \| gate beam/);
      if (m) {
        o.getWorldPosition(_a);
        this.sectors.push({ id: +m[1], s: this.project(_a).s });
      }
    });
    // Saltos: tramos sin tablero; la nave vuela en parábola (altura según velocidad)
    this.gaps = (opts.gaps || []).map(([f0, f1]) => ({ s0: f0 * this.length, s1: f1 * this.length }));
    this.sectors.sort((a, b) => a.s - b.s);
  }

  // Índice espacial (rejilla XZ de 60 m) sobre la línea central ORIGINAL del GLB.
  buildIndex() {
    this.cell = 60; this.grid = new Map();
    const o = this.orig, n = o.length;
    this.origRight = o.map((p, i) => {
      const t = new THREE.Vector3().subVectors(o[(i + 1) % n], o[(i - 1 + n) % n]); t.y = 0; t.normalize();
      return new THREE.Vector3().crossVectors(t, UP).normalize();
    });
    o.forEach((p, i) => {
      const k = `${Math.floor(p.x / this.cell)},${Math.floor(p.z / this.cell)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    });
  }

  // Para un punto del GLB original: sección más cercana → {s, x lateral, h sobre el tablero, delta de relieve, dist horizontal}
  locate(p, out = {}) {
    const o = this.orig, n = o.length, c = this.cell;
    const cx = Math.floor(p.x / c), cz = Math.floor(p.z / c);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 3 && best < 0; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const list = this.grid.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const q = o[i];
          const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + ((q.y - p.y) * 0.6) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    if (best < 0) { out.far = true; return out; }
    // proyección sobre el segmento vecino más favorable
    let i = best, j = (best + 1) % n, t = 0;
    const seg = (a, b) => {
      const A = o[a], B = o[b];
      const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1;
      return Math.max(0, Math.min(1, ((p.x - A.x) * ex + (p.z - A.z) * ez) / L2));
    };
    const tf = seg(best, (best + 1) % n);
    if (tf > 0) { t = tf; } else { i = (best - 1 + n) % n; j = best; t = seg(i, j); }
    const A = o[i], B = o[j];
    const px = A.x + (B.x - A.x) * t, pz = A.z + (B.z - A.z) * t, py = A.y + (B.y - A.y) * t;
    const r = this.origRight[i];
    const sA = this.sectionS[i], sB = j === 0 ? this.length : this.sectionS[j];
    out.far = false;
    out.s = sA + (sB - sA) * t;
    out.x = (p.x - px) * r.x + (p.z - pz) * r.z;
    out.h = p.y - py;
    out.deckY = py;
    out.dist = Math.hypot(p.x - px, p.z - pz);
    out.delta = this.relief[i] + (this.relief[j] - this.relief[i]) * t;
    out.kappa = this.kappaAt(out.s);
    return out;
  }

  wrap(s) { const L = this.length; return ((s % L) + L) % L; }

  gapAt(s) {
    if (!this.gaps.length) return -1;
    s = this.wrap(s);
    for (const g of this.gaps) if (s >= g.s0 && s <= g.s1) return (s - g.s0) / (g.s1 - g.s0);
    return -1;
  }
  jumpLift(s, v) { const t = this.gapAt(s); return t < 0 ? 0 : 4 * t * (1 - t) * Math.min(16, 3 + v * 0.06); }

  // Muestra interpolada: out = {pos, tan, right, up, kappa, slope}
  sample(s, out) {
    s = this.wrap(s);
    const f = s / this.ds;
    const i = Math.floor(f) % this.count, j = (i + 1) % this.count, t = f - Math.floor(f);
    const lerp3 = (arr, v) => v.set(
      arr[i * 3] + (arr[j * 3] - arr[i * 3]) * t,
      arr[i * 3 + 1] + (arr[j * 3 + 1] - arr[i * 3 + 1]) * t,
      arr[i * 3 + 2] + (arr[j * 3 + 2] - arr[i * 3 + 2]) * t);
    lerp3(this.pos, out.pos);
    lerp3(this.tan, out.tan).normalize();
    lerp3(this.right, out.right).normalize();
    lerp3(this.up, out.up).normalize();
    out.kappa = this.kappa[i] + (this.kappa[j] - this.kappa[i]) * t;
    return out;
  }

  kappaAt(s) { return this.kappa[Math.floor(this.wrap(s) / this.ds) % this.count]; }
  wAt(s) { return this.widen ? this.widen[Math.floor(this.wrap(s) / this.ds) % this.count] : 1; }
  // curvatura vertical (1/m): < 0 en crestas, > 0 en valles
  kvAt(s) { const a = Math.floor(this.wrap(s - 6) / this.ds) % this.count, b = Math.floor(this.wrap(s + 6) / this.ds) % this.count; return (this.tan[b * 3 + 1] - this.tan[a * 3 + 1]) / 12; }
  lineAt(s) { return this.line[Math.floor(this.wrap(s) / this.ds) % this.count]; }
  // diferencia de s con signo en (−L/2, L/2]
  delta(a, b) { const L = this.length; let d = (b - a) % L; if (d > L / 2) d -= L; if (d <= -L / 2) d += L; return d; }

  frame() {
    return { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), kappa: 0 };
  }

  // Punto de pista más cercano a una posición del mundo.
  project(p) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.count; i += 8) {
      const dx = this.pos[i * 3] - p.x, dy = this.pos[i * 3 + 1] - p.y, dz = this.pos[i * 3 + 2] - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    for (let i = best - 8; i <= best + 8; i++) {
      const k = (i + this.count) % this.count;
      const dx = this.pos[k * 3] - p.x, dy = this.pos[k * 3 + 1] - p.y, dz = this.pos[k * 3 + 2] - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = k; }
    }
    return { s: best * this.ds, dist: Math.sqrt(bd) };
  }
}
