// Vista previa del trazado en la ficha del Solar Map: el circuito real en hilo blanco, girando despacio.
// Pesa muy poco a propósito: nada de WebGL (un segundo contexto 3D en el móvil es memoria de GPU y riesgo de perder
// el contexto del juego), solo un <canvas> 2D que proyecta ~160 secciones del tablero (borde izquierdo y derecho).
// Los datos salen del propio juego: sampleShape() lee la pista construida; tools/trackshapes.py los hornea para
// todos los circuitos en js/trackshapes.data.js, y cada circuito que se construye en la sesión actualiza el suyo.
import { SHAPES } from './trackshapes.data.js';

const N = 160, TILT = 0.6, CT = Math.cos(TILT), ST = Math.sin(TILT);
const live = {};                       // formas leídas de pistas construidas en esta sesión (mandan sobre las horneadas)

// Pista → forma compacta: e = [lx,ly,lz, rx,ry,rz]·N en metros enteros; tramos como fracciones de vuelta.
export function sampleShape(track, tunnel) {
  const F = track.frame(), L = track.length, e = [];
  for (let i = 0; i < N; i++) {
    const s = i / N * L; track.sample(s, F);
    const hw = (track.width || 32) / 2 * (track.wAt ? track.wAt(s) : 1);
    e.push(Math.round(F.pos.x - F.right.x * hw), Math.round(F.pos.y - F.right.y * hw), Math.round(F.pos.z - F.right.z * hw),
      Math.round(F.pos.x + F.right.x * hw), Math.round(F.pos.y + F.right.y * hw), Math.round(F.pos.z + F.right.z * hw));
  }
  const fr = (a) => (a || []).map((g) => [+(g.s0 / L).toFixed(4), +(g.s1 / L).toFixed(4)]);
  const tun = tunnel && tunnel.len > 0 ? [[+(track.wrap(tunnel.s) / L).toFixed(4), +(track.wrap(tunnel.s + tunnel.len) / L).toFixed(4)]] : [];
  return { len: Math.round(L), e, gaps: fr(track.gaps), fly: fr(track.flight), tun };
}
export function rememberShape(id, track, tunnel) { try { live[id] = sampleShape(track, tunnel); } catch (err) { /* la vista previa nunca rompe la carga */ } }
export const shapeFor = (id) => live[id] || SHAPES[id] || null;

const inRanges = (f, rs) => rs.some(([a, b]) => (a <= b ? f >= a && f <= b : f >= a || f <= b));

export class TrackPreview {
  constructor(canvas, shape, { accent = '#e4391f' } = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.accent = accent;
    this.a = 0.6; this.spin = 0.32; this.drag = null; this.raf = 0; this.last = 0;
    this.still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setShape(shape);
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', (ev) => { this.drag = { x: ev.clientX, a: this.a }; canvas.setPointerCapture?.(ev.pointerId); });
    canvas.addEventListener('pointermove', (ev) => { if (this.drag) { this.a = this.drag.a + (ev.clientX - this.drag.x) * 0.012; if (this.still) this.draw(); } });
    const end = () => { this.drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  setShape(shape) {
    const e = shape.e, n = e.length / 6;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) for (const o of [0, 3]) {
      const x = e[i * 6 + o], y = e[i * 6 + o + 1], z = e[i * 6 + o + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = (y0 + y1) / 2;
    // el tablero mide ~32 m en un trazado de kilómetros: a esta escala sería un hilo. Se ensancha para que se lea
    // como cinta (peraltes, rampas y muros se ven); planta y cotas van a escala real.
    const WIDE = 3.2, TALL = 1.8;                                       // y el relieve ×1,8, como en un perfil de etapa
    const P = new Float32Array(n * 9);                                  // izquierda, derecha, centro
    let rad = 1;
    for (let i = 0; i < n; i++) {
      const lx = e[i * 6] - cx, ly = (e[i * 6 + 1] - cy) * TALL, lz = e[i * 6 + 2] - cz, rx = e[i * 6 + 3] - cx, ry = (e[i * 6 + 4] - cy) * TALL, rz = e[i * 6 + 5] - cz;
      const mx = (lx + rx) / 2, my = (ly + ry) / 2, mz = (lz + rz) / 2, hx = (rx - lx) / 2 * WIDE, hy = (ry - ly) / 2 * WIDE, hz = (rz - lz) / 2 * WIDE;
      P.set([mx - hx, my - hy, mz - hz, mx + hx, my + hy, mz + hz, mx, my, mz], i * 9);
      rad = Math.max(rad, Math.hypot(mx, mz) + Math.hypot(hx, hz));
    }
    this.P = P; this.n = n; this.rad = rad; this.floor = (y0 - cy) * TALL - Math.max(60, (y1 - y0) * TALL * 0.12);
    this.kind = new Uint8Array(n);                                      // 0 tablero · 1 túnel · 2 salto · 3 vuelo libre
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; this.kind[i] = inRanges(f, shape.gaps || []) ? 2 : inRanges(f, shape.fly || []) ? 3 : inRanges(f, shape.tun || []) ? 1 : 0; }
    this.S = new Float32Array(n * 9);                                   // proyección: x, y, profundidad de cada punto
    this.B = new Float32Array(n * 2);                                   // huella en el plano base
    // encuadre fijo: el mayor tamaño proyectado en una vuelta entera (así no «respira» al girar)
    this.dist = rad * 3.4;
    let mx = 1, lo = Infinity, hi = -Infinity; const t = [0, 0];
    for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) { this.proj(P[i * 9 + j * 3], P[i * 9 + j * 3 + 1], P[i * 9 + j * 3 + 2], ang, 1, t, 0); mx = Math.max(mx, Math.abs(t[0])); lo = Math.min(lo, t[1]); hi = Math.max(hi, t[1]); }
        this.proj(P[i * 9 + 6], this.floor, P[i * 9 + 8], ang, 1, t, 0); mx = Math.max(mx, Math.abs(t[0])); lo = Math.min(lo, t[1]); hi = Math.max(hi, t[1]);
      }
    }
    this.fit = { mx, lo, hi };
  }

  // perspectiva suave: giro sobre el eje vertical, cámara inclinada 34°. Escribe x, y (sin centrar) y devuelve la profundidad.
  proj(x, y, z, ang, k, out, o) {
    const ca = Math.cos(ang), sa = Math.sin(ang), X = x * ca - z * sa, Z = x * sa + z * ca;
    const Y2 = y * CT - Z * ST, Z2 = y * ST + Z * CT, f = k * this.dist / (this.dist + Z2);
    out[o] = X * f; out[o + 1] = -Y2 * f; return Z2;
  }

  tick(t) {
    if (!this.c.isConnected) { this.raf = 0; return; }                  // la ficha se ha cerrado o redibujado: fin
    this.raf = requestAnimationFrame(this.tick);
    const visible = this.c.offsetParent !== null && !document.hidden;
    const dt = Math.min(0.1, (t - this.last) / 1000 || 0);
    if (!visible || (t - this.last < 30 && this.last)) return;          // ~30 imágenes por segundo bastan
    this.last = t;
    if (!this.drag && !this.still) this.a += this.spin * dt;
    this.draw();
  }

  draw() {
    const c = this.c, dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = this.ctx, n = this.n, P = this.P, S = this.S, B = this.B;
    g.clearRect(0, 0, w, h);
    const F = this.fit, k = Math.min(w * 0.94 / (2 * F.mx), h * 0.88 / (F.hi - F.lo));
    const ox = w / 2, oy = h / 2 - k * (F.lo + F.hi) / 2;
    const proj = (x, y, z, out, o) => { const d = this.proj(x, y, z, this.a, k, out, o); out[o] += ox; out[o + 1] += oy; return d; };
    let dmin = Infinity, dmax = -Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) { const d = proj(P[i * 9 + j * 3], P[i * 9 + j * 3 + 1], P[i * 9 + j * 3 + 2], S, i * 9 + j * 3); S[i * 9 + j * 3 + 2] = d; if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
      proj(P[i * 9 + 6], this.floor, P[i * 9 + 8], B, i * 2);
    }
    const near = (d) => 1 - (d - dmin) / Math.max(1, dmax - dmin);     // 1 = delante, 0 = al fondo
    const line = (x0, y0, x1, y1, a, lw) => { g.globalAlpha = a; g.lineWidth = lw * dpr; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    g.lineCap = 'round'; g.strokeStyle = '#fff';
    // huella en el plano base y pilares: dan la altura de cada tramo
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      line(B[i * 2], B[i * 2 + 1], B[j * 2], B[j * 2 + 1], 0.13, 0.7);
      if (i % 8 === 0 && this.kind[i] !== 2) line(S[i * 9 + 6], S[i * 9 + 7], B[i * 2], B[i * 2 + 1], 0.1 + 0.1 * near(S[i * 9 + 8]), 0.6);
    }
    // cinta: dos bordes y un travesaño por sección
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, kd = this.kind[i], nr = near((S[i * 9 + 8] + S[j * 9 + 8]) / 2), a = 0.28 + 0.72 * nr;
      if (kd === 2 || kd === 3) {                                       // salto o vuelo libre: sin tablero, solo la trayectoria a puntos
        if (i % 2 === 0) line(S[i * 9 + 6], S[i * 9 + 7], (S[i * 9 + 6] + S[j * 9 + 6]) / 2, (S[i * 9 + 7] + S[j * 9 + 7]) / 2, a * 0.8, 1);
        continue;
      }
      const dim = kd === 1 ? 0.5 : 1;                                   // túnel: más tenue y sin travesaños alternos
      line(S[i * 9], S[i * 9 + 1], S[j * 9], S[j * 9 + 1], a * dim, 1);
      line(S[i * 9 + 3], S[i * 9 + 4], S[j * 9 + 3], S[j * 9 + 4], a * dim, 1);
      if (kd === 0 || i % 2 === 0) line(S[i * 9], S[i * 9 + 1], S[i * 9 + 3], S[i * 9 + 4], a * 0.42 * dim, 0.6);
    }
    // línea de salida y sentido de carrera
    g.strokeStyle = this.accent;
    line(S[0], S[1], S[3], S[4], 1, 2.2);
    const q = 2 % n; line(S[6], S[7], S[q * 9 + 6], S[q * 9 + 7], 1, 1.6);
    g.globalAlpha = 1;
  }
}
