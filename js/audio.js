// Sonido sintetizado con WebAudio (sin archivos): turbina, viento, impactos y pitidos de salida.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.55; this.master.connect(c.destination);

    // turbina: dos osciladores desafinados → paso bajo
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 6; this.lp.frequency.value = 400;
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'square';
    this.o3 = c.createOscillator(); this.o3.type = 'sine';
    const g2 = c.createGain(); g2.gain.value = 0.35;
    const g3 = c.createGain(); g3.gain.value = 0.6;
    this.o1.connect(this.lp); this.o2.connect(g2).connect(this.lp); this.o3.connect(g3).connect(this.engGain);
    this.lp.connect(this.engGain).connect(this.master);
    [this.o1, this.o2, this.o3].forEach((o) => o.start());

    // viento: ruido → paso banda
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
    this.bp = c.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.Q.value = 0.7;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    n.connect(this.bp).connect(this.windGain).connect(this.master); n.start();

    // ambiente: zumbido grave del valle
    const amb = c.createOscillator(); amb.type = 'sine'; amb.frequency.value = 42;
    this.ambGain = c.createGain(); this.ambGain.gain.value = 0.05;
    amb.connect(this.ambGain).connect(this.master); amb.start();
  }

  // Música (Between Two Corners): incrustada en base64 en la versión publicada, music.mp3 en local
  music(fromStart = false) {
    if (!this.track) {
      const el = document.getElementById('music-data');
      const src = el ? 'data:audio/mpeg;base64,' + el.textContent.trim() : 'music.mp3';
      this.track = new window.Audio(src); this.track.loop = true; this.track.volume = 0.5;
    }
    this.track.muted = this.muted;
    if (fromStart) { try { this.track.currentTime = 0; } catch (e) { /* aún sin cargar */ } }
    const p = this.track.play(); if (p && p.catch) p.catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.track) this.track.muted = this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  engine(speed01, throttle, boost, active = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed01 * 150 + throttle * 12 + boost * 25;
    this.o1.frequency.setTargetAtTime(f, t, 0.08);
    this.o2.frequency.setTargetAtTime(f * 1.503, t, 0.08);
    this.o3.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.lp.frequency.setTargetAtTime(260 + speed01 * 1900 + throttle * 500 + boost * 900, t, 0.1);
    this.engGain.gain.setTargetAtTime(active ? 0.05 + throttle * 0.05 + boost * 0.03 : 0.015, t, 0.1);
    this.bp.frequency.setTargetAtTime(300 + speed01 * 1600, t, 0.1);
    this.windGain.gain.setTargetAtTime(active ? speed01 * speed01 * 0.16 : 0.03, t, 0.2);
  }

  thud(strength = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.setValueAtTime(Math.min(0.6, 0.15 + strength * 0.4), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 0.4);
  }

  beep(high = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = high ? 1320 : 660;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.7 : 0.25));
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.8);
  }

  chime(red = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    (red ? [440, 330] : [880, 1320, 1760]).forEach((f, i) => {
      const o = c.createOscillator(); o.type = red ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const g = c.createGain(); const t0 = t + i * 0.05;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(red ? 0.08 : 0.12, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 0.4);
    });
  }

  launch() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 0.7);
  }

  boom(strength = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.9);
    const g = c.createGain(); g.gain.setValueAtTime(0.5 * strength, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 1.2);
  }

  whoosh() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 1);
  }
}
