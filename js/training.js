// ─────────────────────────────────────────────────────────────
//  SARUS · TRAINING / PILOT TEST
//  Tramo guiado en ARCADIA con PRIME-EX: seis pasos que esperan a que el piloto haga cada cosa,
//  con un instante de cámara lenta al presentar cada esfera. Obligatorio solo en el primer inicio.
// ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'throttle', title: 'THROTTLE', text: 'Accelerate down the straight.', desk: 'W / ↑ · acelerar', touch: 'La nave acelera sola · mantén FRENO para frenar' },
  { id: 'boost', title: 'BOOST', text: 'BOOST PICKUP · Collect to recharge thrust.', desk: 'Pasa por la esfera verde · ESPACIO para usar el boost', touch: 'Desliza hacia la esfera verde · botón BOOST' },
  { id: 'ordnance', title: 'ORDNANCE', text: 'Collect ammunition.', desk: 'Pasa por la esfera roja', touch: 'Desliza hacia la esfera roja' },
  { id: 'fire', title: 'FIRE', text: 'Launch weapon.', desk: 'F · disparar al objetivo', touch: 'Botón COHETE' },
  { id: 'hard', title: 'HARD TURN', text: 'Use for rapid trajectory correction.', desk: 'Doble toque A A / D D', touch: 'Desliz rápido a un lado' },
  { id: 'brake', title: 'AIR BRAKE', text: 'Control lateral drift.', desk: 'Q / E · aerofreno izquierdo / derecho', touch: 'Botones ◁ AF ▷' },
];

export class Training {
  constructor({ G, el, touch }) {
    this.G = G; this.el = el; this.touch = touch;
    this.i = -1; this.t = 0; this.timeScale = 1; this.slowT = 0; this.done = false; this.hold = 0; this.target = null;
  }

  start(target) {
    this.target = target;
    this.i = -1; this.done = false; this.endT = 0;
    this.el.box.hidden = false;
    this.next();
  }

  next() {
    this.i++;
    this.t = 0; this.hold = 0; this.focus = null;
    if (this.i >= STEPS.length) { this.clear(); return; }
    const S = STEPS[this.i];
    this.show(String(this.i + 1).padStart(2, '0'), S.title, S.text, this.touch ? S.touch : S.desk);
    this.slow(0.9);
  }

  show(num, title, text, hint) {
    const e = this.el;
    e.num.textContent = num; e.title.textContent = title; e.text.textContent = text; e.hint.textContent = hint || '';
    e.box.classList.remove('pop'); void e.box.offsetWidth; e.box.classList.add('pop');
  }

  slow(sec) { this.slowT = Math.max(this.slowT, sec); }

  clear() {
    this.done = true; this.endT = 0;
    this.show('✓', 'PILOT CLEARANCE GRANTED', 'SARUS licence validated · Solar Advanced Racing Union Series', '');
    this.el.box.classList.add('granted');
  }

  // esfera más cercana por delante, del tipo pedido
  sphereAhead(type) {
    const { ship, pickups, track } = this.G;
    let best = null, bd = Infinity;
    for (const it of pickups.items) {
      if (!it.active || it.type !== type) continue;
      const d = track.delta(ship.s, it.s);
      if (d > 30 && d < 900 && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  onPick(sh, it) {
    if (sh !== this.G.ship || this.done) return;
    const id = STEPS[this.i]?.id;
    if ((id === 'boost' && it.type === 'G') || (id === 'ordnance' && it.type === 'R')) this.next();
  }

  onHit(shooter, victim) {
    if (shooter === this.G.ship && victim === this.target && STEPS[this.i]?.id === 'fire') this.next();
  }

  // realDt: tiempo real (los temporizadores no se ralentizan con la cámara lenta)
  update(realDt, inp) {
    const { G } = this;
    const ship = G.ship;
    this.slowT = Math.max(0, this.slowT - realDt);
    const want = this.slowT > 0 ? 0.28 : 1;
    this.timeScale += (want - this.timeScale) * Math.min(1, realDt * 8);
    if (this.done) { this.endT += realDt; return this.endT > 3.2; }
    this.t += realDt;
    const id = STEPS[this.i].id;
    if (id === 'throttle' && ship.v > 52 && this.t > 1.2) this.next();
    else if (id === 'boost' || id === 'ordnance') {
      // marca la esfera que toca y, al acercarse, un instante de cámara lenta
      const it = this.sphereAhead(id === 'boost' ? 'G' : 'R');
      if (it && it !== this.focus) { this.focus = it; this.near = false; }
      if (it) {
        const d = G.track.delta(ship.s, it.s);
        if (!this.near && d < 110) { this.near = true; this.slow(1.1); }
        G.trainMark = it;
      }
      if (id === 'ordnance' && ship.ammo > 0 && this.t > 0.5) this.next();
    } else if (id === 'fire') {
      const tg = this.target || (this.target = G.trainAddTarget());
      if (this.t < 0.05 || (tg && G.track.delta(ship.s, tg.s) < 15) || (tg && G.track.delta(ship.s, tg.s) > 600)) {
        // el objetivo aparece por delante, en el mismo carril, y se aleja despacio
        tg.reset(ship.s + 170, ship.x * 0.5);
        tg.v = ship.v * 0.55; tg.dead = 0; tg.out = false; tg.invuln = 0; tg.root.visible = true;
      }
      if (ship.ammo <= 0 && !G.missiles.list.length) ship.ammo = 1;
    } else if (id === 'hard') {
      if (ship.quickEvent) this.next();
    } else if (id === 'brake') {
      if (inp.abL > 0.5 || inp.abR > 0.5) this.hold += realDt;
      if (this.hold > 0.7) this.next();
    }
    if (id !== 'boost' && id !== 'ordnance') G.trainMark = null;
    return false;
  }

  stop() {
    this.el.box.hidden = true;
    this.el.box.classList.remove('granted');
    this.G.trainMark = null;
    this.timeScale = 1;
  }
}
