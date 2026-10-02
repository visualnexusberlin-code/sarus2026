// Piloto automático para los rivales. Produce el mismo objeto de input que el teclado,
// así la IA usa exactamente la misma física que el jugador.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

export class AIDriver {
  constructor(ship, track, { skill = 0.92, bias = 0, aggression = 0.5, seed = Math.random() } = {}) {
    this.ship = ship; this.track = track;
    this.skill = skill; this.bias = bias; this.aggression = aggression; this.seed = seed;
    this.inp = { throttle: 0, brake: 0, steer: 0, abL: 0, abR: 0, boost: false };
    this.avoid = 0; this.t = seed * 100; this.boostHold = 0;
    this.F = track.frame();
    this.cruise = 1;           // <1 tras cruzar la meta (vuelta de enfriamiento)
    this.mistakes = 1;         // frecuencia de errores (según dificultad)
    this.pace = 1;             // ritmo global de los rivales (según dificultad)
    this.errT = 6 + Math.random() * 10; this.err = null;
  }

  update(dt, ships, rubber = 0) {
    const sh = this.ship, tr = this.track, C = sh.C, inp = this.inp;
    this.t += dt;
    const v = sh.v;
    const skill = clamp(this.skill + rubber, 0.4, 1.02) * this.cruise;

    // ── Errores humanos: frenada tardía, titubeo, levantar el pie ──
    this.errT -= dt;
    if (this.errT <= 0 && this.cruise === 1) {
      this.errT = (9 + Math.random() * 14) / Math.max(0.2, this.mistakes);
      const r = Math.random();
      this.err = r < 0.45 ? { type: 'late', t: 2.4 } : r < 0.8 ? { type: 'wobble', t: 1.3, dir: Math.random() < 0.5 ? -1 : 1 } : { type: 'lift', t: 0.9 };
    }
    if (this.err) { this.err.t -= dt; if (this.err.t <= 0) this.err = null; }
    const E = this.err?.type;

    // ── Trazada ──
    const Ld = 14 + v * 0.36;
    const lineAhead = tr.lineAt(sh.s + Ld);
    const wander = Math.sin(this.t * 0.31 + this.seed * 17) * 1.4 * (1 - Math.min(1, Math.abs(lineAhead) / 6));
    let xt = lineAhead * (0.75 + 0.25 * skill) + this.bias + wander + (E === 'wobble' ? this.err.dir * 6 * Math.sin(this.err.t * 5) : 0);

    // ── Esquivar a quien va delante y más lento ──
    let avoidT = 0;
    for (const o of ships) {
      if (o === sh) continue;                              // también esquiva los restos en pista
      const ds = tr.delta(sh.s, o.s);
      if (ds > 0 && ds < (o.out ? 30 + v * 0.45 : 18 + v * 0.22) && Math.abs(o.x - xt - this.avoid) < 3.4 && o.v < v + 3) {
        const room = o.x > 0 ? -1 : 1;                      // pasa por el lado con más pista
        avoidT = clamp(o.x + room * 4.2 - xt, -9, 9);
        break;
      }
    }
    this.avoid += (avoidT - this.avoid) * Math.min(1, dt * 2.5);
    const xw = 13.6 * tr.wAt(sh.s);
    xt = clamp(xt + this.avoid, -xw, xw);

    // ── Ir a por esferas cercanas (verde siempre; roja si no lleva cohete) ──
    if (this.pickups && this.cruise === 1) {
      const it = this.pickups.nearestAhead(sh, 30 + v * 0.9, sh.ammo === 0 && this.aggression > 0.35);
      if (it && Math.abs(it.x - xt) < 9) xt = xt + (it.x - xt) * 0.8;
    }

    // ── Dirección: rumbo deseado hacia el punto objetivo + anticipación de la curva ──
    const phiDes = Math.atan2(sh.x - xt, Ld);
    tr.sample(sh.s + v * 0.12, this.F);
    const wff = this.F.kappa * v;
    const rate = (C.turnLow + (C.turnHigh - C.turnLow) * Math.min(1, v / C.vmax)) * (C.turnMult || 1);
    const wDes = wff + 2.8 * (phiDes - sh.psi) + 1.2 * (phiDes - sh.phi);
    let abL = 0, abR = 0;
    const lim = rate * 0.9;
    if (wDes > lim) abL = clamp((wDes - lim) / C.airbrakeTurn, 0, 1);
    if (wDes < -lim) abR = clamp((-wDes - lim) / C.airbrakeTurn, 0, 1);
    inp.steer = clamp(-(wDes - abL * C.airbrakeTurn + abR * C.airbrakeTurn) / rate, -1, 1);
    inp.abL = abL; inp.abR = abR;

    // ── Velocidad: la más baja que exija cualquier curva dentro de la distancia de frenada ──
    const rTot = C.turnHigh * (C.turnMult || 1) + C.airbrakeTurn * 0.85;
    let vt = C.vmax * (0.82 + 0.18 * skill) * this.pace;
    let straight = true;
    const scan = Math.min(480, 40 + v * 2.7);
    for (let d = 0; d <= scan; d += 8) {
      const k = Math.abs(tr.kappaAt(sh.s + d));
      if (k < 2e-4) continue;
      const vc = (rTot / (k * 0.78)) * (0.66 + 0.34 * skill) * this.pace * (E === 'late' ? 1.22 : 1);
      const allowed = Math.sqrt(vc * vc + 2 * 46 * d);
      if (allowed < vt) vt = allowed;
      if (vc < C.vmax * 1.05 && d < 320) straight = false;
    }
    inp.throttle = E === 'lift' ? 0.2 : v < vt - 1 ? 1 : v < vt + 2 ? 0.35 : 0;
    inp.brake = v > vt + 4 ? clamp((v - vt) / 14, 0, 1) : 0;

    // ── Boost en rectas ──
    this.boostHold = Math.max(0, this.boostHold - dt);
    if (straight && sh.boost > 0.45 && Math.random() < dt * 3 * skill * skill && this.cruise === 1 && this.boostHold === 0 && Math.sin(this.t * 0.9 + this.seed * 9) > 1 - this.aggression * 1.6) this.boostHold = (1.2 + this.aggression * 1.5) * (0.4 + 0.6 * skill);
    inp.boost = this.boostHold > 0 && straight;

    // ── Disparo: con cohete y un rival a tiro delante ──
    inp.fire = false;
    if (sh.ammo > 0 && this.cruise === 1) {
      let tgt = null;
      for (const o of ships) {
        if (o === sh || o.dead > 0 || o.invuln > 0) continue;
        const ds = tr.delta(sh.s, o.s);
        if (ds > 25 && ds < 260 && Math.abs(o.x - sh.x) < 7) { tgt = o; break; }
      }
      if (tgt) { this.aim = (this.aim ?? (0.4 + Math.random() * 1.8)) - dt; if (this.aim <= 0) { inp.fire = true; this.aim = null; } }
      else this.aim = null;
    }
    return inp;
  }
}

// Choques entre naves en espacio de pista: separación lateral y transferencia de velocidad.
export function resolveCollisions(ships, track, onHit) {
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i], b = ships[j];
      if (a.out && b.out) continue;
      const ds = track.delta(a.s, b.s);                    // + → b va delante
      const len = (a.length + b.length) * 0.5 * 0.92;
      if (Math.abs(ds) > len) continue;
      const wid = (a.halfWidthGeo + b.halfWidthGeo) * 0.85;
      const dx = b.x - a.x;
      if (Math.abs(dx) > wid) continue;
      const overlapX = wid - Math.abs(dx);
      const overlapS = len - Math.abs(ds);
      const [front, back] = ds >= 0 ? [b, a] : [a, b];
      let impact = 0;
      if (a.out || b.out) {
        // restos: masa muerta. Desvían a quien los toca y le roban velocidad; ellos apenas se mueven
        const w = a.out ? a : b, l = a.out ? b : a;
        const sgn = Math.sign(l.x - w.x) || 1;
        if (overlapX < overlapS * 0.6 || l !== back) { l.x += sgn * (overlapX + 0.05); l.phi *= 0.5; impact = Math.abs(l.v * Math.sin(l.phi)) + 3; }
        else {
          impact = l.v - w.v;
          l.x += sgn * Math.min(overlapX + 0.05, 1.2);
          l.s = track.wrap(l.s - overlapS * (l === back ? 1 : -1));
          if (impact > 0) { w.v = Math.max(w.v, l.v * 0.35); l.v *= 0.62; l.spin = Math.max(l.spin, 0.5); }
        }
        if (impact > 1.5) { a.bump = b.bump = 1; onHit?.(a, b, impact); }
        continue;
      }
      if (overlapX < overlapS * 0.6) {
        // roce lateral
        const push = overlapX + 0.04, sgn = Math.sign(dx) || 1;
        const ma = a.C.mass || 1, mb = b.C.mass || 1;
        a.x -= sgn * push * mb / (ma + mb); b.x += sgn * push * ma / (ma + mb);
        const lat = Math.abs(a.v * Math.sin(a.phi) - b.v * Math.sin(b.phi));
        a.phi *= 0.6; b.phi *= 0.6;
        impact = lat;
      } else {
        // alcance por detrás
        const rel = back.v - front.v;
        if (rel > 0) {
          const mf = front.C.mass || 1, mbk = back.C.mass || 1;
          back.v = front.v + rel * 0.15 - 2;
          front.v += rel * 0.35 * mbk / mf;
          impact = rel;
        }
        back.x += (back.x >= front.x ? 1 : -1) * 0.25;
        back.s = track.wrap(back.s - overlapS * 0.5);
      }
      if (impact > 1.5) { a.bump = b.bump = 1; onHit?.(a, b, impact); }
    }
  }
}
