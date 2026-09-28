// HUD tipográfico: vueltas, tiempos, velocidad, boost, minimapa y avisos.
const $ = (id) => document.getElementById(id);

export const fmt = (t) => {
  if (!isFinite(t)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

export class HUD {
  constructor(track) {
    this.track = track;
    this.el = {
      hud: $('hud'), lap: $('lapNum'), lapTot: $('lapTot'), time: $('lapTime'), best: $('bestTime'),
      speed: $('speed'), speedBar: $('speedBar'), boost: $('boostBar'), sector: $('sectorLbl'), cam: $('camLbl'),
      banner: $('banner'), bannerTxt: $('bannerTxt'), bannerSplit: $('bannerSplit'), count: $('count'), warn: $('warn'),
      card: $('card'), cardBig: $('cardBig'), cardSmall: $('cardSmall'),
      pos: $('posNum'), posTot: $('posTot'), hull: $('hull'), draft: $('draft'), weapon: $('weapon'), weaponN: $('weaponN'), fire: $('touchFire'),
    };
    this.map = $('minimap');
    this.ctx = this.map.getContext('2d');
    this.prepareMap();
    this.bannerTimer = 0;
  }

  setTrack(track) { this.track = track; this.prepareMap(); }

  prepareMap() {
    const tr = this.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < tr.count; i++) {
      const x = tr.pos[i * 3], z = tr.pos[i * 3 + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const W = this.map.width, pad = 22;
    const sc = (W - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const ox = (W - (maxX - minX) * sc) / 2, oz = (W - (maxZ - minZ) * sc) / 2;
    // vista con el norte (−z, monolitos) arriba
    this.toMap = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
    const off = document.createElement('canvas'); off.width = off.height = W;
    const g = off.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => { g.beginPath(); for (let i = 0; i <= tr.count; i += 6) { const k = i % tr.count; const [a, b] = this.toMap(tr.pos[k * 3], tr.pos[k * 3 + 2]); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.closePath(); };
    g.strokeStyle = 'rgba(20,22,23,0.55)'; g.lineWidth = 9; path(); g.stroke();
    g.strokeStyle = 'rgba(216,213,205,0.7)'; g.lineWidth = 2.5; path(); g.stroke();
    // sectores
    for (const s of tr.sectors) {
      const i = Math.round(s.s / tr.ds) % tr.count;
      const [a, b] = this.toMap(tr.pos[i * 3], tr.pos[i * 3 + 2]);
      g.fillStyle = s.id === 1 ? '#e4391f' : 'rgba(216,213,205,0.9)';
      g.fillRect(a - 3, b - 3, 6, 6);
    }
    this.mapBase = off;
  }

  drawMap(ship, ships = []) {
    const g = this.ctx, W = this.map.width;
    g.clearRect(0, 0, W, W);
    g.drawImage(this.mapBase, 0, 0);
    for (const o of ships) {
      if (o === ship) continue;
      const [a, b] = this.toMap(o.root.position.x, o.root.position.z);
      g.fillStyle = 'rgba(232,228,218,0.95)';
      g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill();
    }
    const p = ship.root.position;
    const [a, b] = this.toMap(p.x, p.z);
    const ang = Math.atan2(ship.fwd.x, ship.fwd.z);
    g.save(); g.translate(a, b); g.rotate(-ang);
    g.fillStyle = '#e4391f';
    g.beginPath(); g.moveTo(0, 10); g.lineTo(6, -7); g.lineTo(0, -3); g.lineTo(-6, -7); g.closePath(); g.fill();
    g.restore();
  }

  show(on) { this.el.hud.classList.toggle('on', on); }

  update(race, ship, dt, ships = []) {
    const e = this.el;
    e.lap.textContent = Math.min(ship.race?.lap ?? 1, race.laps);
    e.pos.textContent = race.pos; e.posTot.textContent = ships.length || 1;
    const hk = `${ship.hull}/${ship.maxHull}/${ship.dead > 0}`;
    if (hk !== this.hullKey) {
      this.hullKey = hk;
      e.hull.innerHTML = Array.from({ length: ship.maxHull }, (_, i) => `<i class="${i < ship.hull && !(ship.dead > 0) ? 'on' : ''}"></i>`).join('');
      e.hull.classList.toggle('low', ship.hull === 1);
    }
    e.draft.classList.toggle('on', ship.draft > 0.45);
    const armed = ship.ammo > 0;
    e.weapon.classList.toggle('on', armed); e.weaponN.textContent = armed ? `× ${ship.ammo}` : '—';
    e.fire?.classList.toggle('armed', armed);
    e.lapTot.textContent = race.laps;
    e.time.textContent = fmt(race.lapTime);
    e.best.textContent = `Mejor ${fmt(race.best)}`;
    e.speed.textContent = Math.round(ship.kmh);
    e.speedBar.style.width = `${Math.min(100, ship.v / ship.C.vmaxBoost * 100)}%`;
    e.boost.style.width = `${ship.boost * 100}%`;
    e.sector.textContent = `Sector ${String(race.sector).padStart(2, '0')}`;
    e.warn.classList.toggle('show', race.wrongWay);
    this.drawMap(ship, ships);
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) e.banner.classList.remove('show'); }
  }

  banner(text, split = '', plus = false, time = 2.2) {
    const e = this.el;
    e.bannerTxt.textContent = text;
    e.bannerSplit.textContent = split;
    e.bannerSplit.classList.toggle('plus', plus);
    e.banner.classList.add('show');
    this.bannerTimer = time;
  }

  count(txt) {
    const c = this.el.count;
    c.textContent = txt;
    c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
  }

  card(small, big) {
    const e = this.el;
    if (!big) { e.card.classList.remove('show'); return; }
    e.cardSmall.textContent = small; e.cardBig.textContent = big;
    e.card.classList.add('show');
  }
}
