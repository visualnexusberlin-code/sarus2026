// Controles táctiles: volante deslizante a la izquierda, botonera a la derecha.
// Aceleración automática por defecto (se puede apagar). Multitáctil con Pointer Events.
export const IS_TOUCH = (() => {
  const p = new URLSearchParams(location.search);
  if (p.has('touch')) return true;
  if (p.has('notouch')) return false;
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches;
})();

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.active = IS_TOUCH;
    this.steer = 0; this.brake = false; this.boost = false; this.abL = false; this.abR = false;
    this.auto = true;
    if (this.active) document.body.classList.add('touch');
    this.build();
    // tocar la pantalla durante la intro = saltar
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' && !this.active) { this.active = true; document.body.classList.add('touch'); }
      if (document.body.classList.contains('cine') && !e.target.closest('button')) input.pressed.add('Enter');
    });
  }

  build() {
    const root = document.getElementById('touch');
    // volante
    const zone = root.querySelector('.steer-zone');
    const knob = root.querySelector('.steer-knob');
    const track = root.querySelector('.steer-track');
    let id = null, x0 = 0;
    const RANGE = Math.max(56, Math.min(90, innerWidth * 0.07));
    const show = (x, y) => {
      track.style.left = `${x}px`; track.style.top = `${y}px`;
      knob.style.left = `${x}px`; knob.style.top = `${y}px`;
      track.style.width = `${RANGE * 2}px`;
      zone.classList.add('on');
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; x0 = e.clientX; zone.setPointerCapture(id);
      this.t0 = performance.now(); this.xStart = e.clientX; this.flicked = false;
      show(e.clientX, e.clientY); e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      // deslizamiento rápido → giro brusco
      if (!this.flicked && performance.now() - this.t0 < 170 && Math.abs(e.clientX - this.xStart) > 48) {
        this.flicked = true; this.input.pressed.add(e.clientX > this.xStart ? 'QuickRight' : 'QuickLeft');
      }
      let d = (e.clientX - x0) / RANGE;
      if (Math.abs(d) > 1) { x0 += (Math.abs(d) - 1) * RANGE * Math.sign(d); d = Math.sign(d); } // el centro sigue al dedo
      this.steer = Math.sign(d) * Math.pow(Math.abs(d), 1.25);
      knob.style.left = `${x0 + d * RANGE}px`;
      track.style.left = `${x0}px`;
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.steer = 0; zone.classList.remove('on'); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // botones mantenidos
    const hold = (sel, key) => {
      const b = root.querySelector(sel);
      const on = (e) => { this[key] = true; b.classList.add('down'); b.setPointerCapture(e.pointerId); e.preventDefault(); };
      const off = () => { this[key] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
    };
    hold('[data-hold="brake"]', 'brake');
    hold('[data-hold="boost"]', 'boost');
    hold('[data-hold="abL"]', 'abL');
    hold('[data-hold="abR"]', 'abR');

    // botones de acción (equivalen a teclas)
    root.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      this.input.pressed.add(b.dataset.key); e.preventDefault();
    }));
    const fireBtn = root.querySelector('#touchFire');
    fireBtn.addEventListener('pointerdown', (e) => { this.input.pressed.add('TouchFire'); fireBtn.classList.add('down'); e.preventDefault(); });
    const up = () => fireBtn.classList.remove('down');
    fireBtn.addEventListener('pointerup', up); fireBtn.addEventListener('pointercancel', up);
    const autoBtn = root.querySelector('[data-auto]');
    autoBtn.addEventListener('pointerdown', (e) => {
      this.auto = !this.auto;
      autoBtn.classList.toggle('off', !this.auto);
      autoBtn.textContent = this.auto ? 'Auto' : 'Manual';
      root.querySelector('[data-hold="throttle"]').hidden = this.auto;
      e.preventDefault();
    });
    hold('[data-hold="throttle"]', 'throttleHeld');
    this.boostRing = root.querySelector('.boost-ring');
    document.querySelector('[data-hold="throttle"]').hidden = true;
  }

  apply(s) {
    if (!this.active) return;
    if (this.steer) s.steer = this.steer;
    const thr = this.auto ? !this.brake : this.throttleHeld;
    if (thr) s.throttle = 1;
    if (this.brake) { s.brake = 1; if (this.auto) s.throttle = 0; }
    if (this.boost) s.boost = true;
    if (this.abL) s.abL = 1;
    if (this.abR) s.abR = 1;
  }

  setBoost(v) { if (this.boostRing) this.boostRing.style.setProperty('--b', `${Math.round(v * 360)}deg`); }
}
