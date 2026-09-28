// Teclado + mando (mapeo estándar). Devuelve un estado normalizado cada frame.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
        // doble toque en una dirección → giro brusco
        const now = performance.now();
        const side = e.code === 'KeyA' || e.code === 'ArrowLeft' ? 'L' : e.code === 'KeyD' || e.code === 'ArrowRight' ? 'R' : null;
        if (side) { if (now - (this.lastTap[side] || 0) < 280) this.pressed.add(side === 'L' ? 'QuickLeft' : 'QuickRight'); this.lastTap[side] = now; }
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.padPrev = [];
    this.lastTap = {};
    this.state = { throttle: 0, brake: 0, steer: 0, abL: 0, abR: 0, boost: false, fire: false, quick: 0 };
  }

  // flancos de pulsación (teclas o botones del mando)
  hit(...codes) { return codes.some((c) => this.pressed.has(c)); }

  poll() {
    const k = (c) => this.keys.has(c);
    const s = this.state;
    s.throttle = k('KeyW') || k('ArrowUp') ? 1 : 0;
    s.brake = k('KeyS') || k('ArrowDown') ? 1 : 0;
    s.steer = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    s.abL = k('KeyQ') ? 1 : 0;
    s.abR = k('KeyE') ? 1 : 0;
    s.boost = k('Space') || k('ShiftLeft') || k('ShiftRight');
    s.fire = this.hit('KeyF', 'KeyX', 'PadX');

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) s.steer = Math.sign(ax) * Math.pow((Math.abs(ax) - 0.12) / 0.88, 1.4);
      const b = (i) => p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0;
      s.throttle = Math.max(s.throttle, b(7));
      s.brake = Math.max(s.brake, b(6));
      s.abL = Math.max(s.abL, b(4));
      s.abR = Math.max(s.abR, b(5));
      s.boost = s.boost || b(0) > 0.5;
      const edges = [[3, 'PadY'], [9, 'PadStart'], [8, 'PadSelect'], [0, 'PadA'], [2, 'PadX'], [1, 'PadB'], [14, 'PadLeft'], [15, 'PadRight'], [4, 'PadLB'], [5, 'PadRB']];
      for (const [i, code] of edges) {
        const now = b(i) > 0.5;
        if (now && !this.padPrev[i]) {
          this.pressed.add(code);
          if (i === 4 || i === 5) {                       // doble toque en LB / RB → giro brusco
            const t = performance.now(), side = i === 4 ? 'PL' : 'PR';
            if (t - (this.lastTap[side] || 0) < 300) this.pressed.add(i === 4 ? 'QuickLeft' : 'QuickRight');
            this.lastTap[side] = t;
          }
        }
        this.padPrev[i] = now;
      }
      break;
    }
    if (this.touch) this.touch.apply(s);
    if (!s.fire) s.fire = this.hit('KeyF', 'KeyX', 'PadX', 'TouchFire');
    s.quick = this.hit('QuickLeft') ? -1 : this.hit('QuickRight') ? 1 : 0;
    return s;
  }

  endFrame() { this.pressed.clear(); }
}
