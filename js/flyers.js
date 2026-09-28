// Tráfico aéreo de ambiente: naves de la flota que cruzan el cielo alrededor del circuito
// (patrullas, equipos de retransmisión, corredores rezagados). Solo decorado: no chocan ni compiten.
import * as THREE from 'three';

const _F = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), kappa: 0 };
const _G = { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), kappa: 0 };
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _m = new THREE.Matrix4(), _x = new THREE.Vector3();

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

export class Flyers {
  constructor(parent, track, ships, count = 6) {
    this.track = track; this.group = new THREE.Group(); this.group.name = 'FLYERS'; parent.add(this.group);
    this.tex = glowTex(); this.mats = [];
    this.items = [];
    const L = track.length;
    for (let i = 0; i < count; i++) {
      const src = ships[(i * 5 + 3) % ships.length];
      const m = src.model.clone(true);
      // fuera llamas y halos (materiales animados de la nave de carrera)
      const drop = []; m.traverse((o) => { if (o.isSprite || o.isLight || (o.material && o.material.isShaderMaterial)) drop.push(o); });
      drop.forEach((o) => o.parent.remove(o));
      const holder = new THREE.Group(); holder.add(m);
      const gm = new THREE.SpriteMaterial({ map: this.tex, color: src.flame ?? 0xffa060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      this.mats.push(gm);
      const glow = new THREE.Sprite(gm); glow.scale.setScalar(9); glow.position.set(0, 0.6, -4.8); holder.add(glow);
      this.group.add(holder);
      const side = i % 2 ? 1 : -1;
      this.items.push({
        holder, glow,
        s: (i / count) * L + Math.random() * 200,
        v: (i % 3 === 0 ? -1 : 1) * (95 + Math.random() * 70),      // alguno va en sentido contrario
        lat: side * (140 + Math.random() * 380), H: 55 + Math.random() * 200, ph: Math.random() * 6.28,
        wing: i % 4 === 1 ? 2 : 1,                                     // a veces en pareja
      });
      if (i % 4 === 1) {                                                // escolta en formación
        const m2 = m.clone(true); m2.position.set(-9, -2, -12); holder.add(m2);
        const g2 = new THREE.Sprite(gm); g2.scale.setScalar(8); g2.position.set(-9, -1.4, -16.8); holder.add(g2);
      }
    }
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const tr = this.track, L = tr.length;
    for (const it of this.items) {
      it.s = ((it.s + it.v * dt) % L + L) % L;
      const dir = Math.sign(it.v);
      tr.sample(it.s, _F); tr.sample(it.s + dir * 40, _G);
      const lat = it.lat + Math.sin(this.t * 0.23 + it.ph) * 60;
      const h = it.H + Math.sin(this.t * 0.4 + it.ph) * 18;
      _p.copy(_F.pos).addScaledVector(_F.right, lat).setY(Math.max(_F.pos.y, _F.pos.y) + h);
      _q.copy(_G.pos).addScaledVector(_G.right, lat).setY(_G.pos.y + h);
      it.holder.position.copy(_p);
      _x.subVectors(_q, _p).normalize();
      _m.lookAt(_q, _p, THREE.Object3D.DEFAULT_UP);                   // morro (+Z) hacia delante
      it.holder.quaternion.setFromRotationMatrix(_m);
      it.holder.rotateZ(-dir * _F.kappa * 60 + Math.sin(this.t * 0.9 + it.ph) * 0.08);   // alabeo en curva
      const fl = 0.85 + Math.random() * 0.3; it.glow.scale.setScalar(9 * fl);
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.mats.forEach((m) => m.dispose()); this.tex.dispose();
  }
}
