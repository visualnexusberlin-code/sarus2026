// Hangar: nave girando sobre un pedestal flotante en la niebla, con monolitos lejanos.
import * as THREE from 'three';
import { createSky } from './atmosphere.js';
import { CONFIG } from './config.js';

export class Showroom {
  constructor(env, ships, logos = []) {
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.FogExp2(0xcccccc, 0.00054);   // niebla fija del hangar (el cielo sigue al circuito)
    s.environment = env;
    s.environmentIntensity = 0.9;
    s.add(createSky());
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20000);

    const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
    sun.position.copy(CONFIG.atmosphere.sunDir).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 80 });
    sun.shadow.bias = -0.0005;
    s.add(sun, new THREE.HemisphereLight(0xc9c7c0, 0x18191a, 0.6));

    // pedestal
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c1d, roughness: 0.45, metalness: 0.6 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 4.1, 0.5, 72), dark);
    ped.position.y = -1.05; ped.receiveShadow = true; s.add(ped);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 0.6, 9, 48, 1, true), dark);
    under.position.y = -5.8; s.add(under);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.018, 8, 160),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, emissive: 0xe8e4da, emissiveIntensity: 2.2 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.79; s.add(ring);

    // monolitos lejanos, como en la referencia
    const mono = new THREE.MeshStandardMaterial({ color: 0x2a2c2d, roughness: 0.8 });
    for (const [x, z, w, h] of [[-420, -900, 60, 900], [260, -1300, 70, 1200], [900, -700, 50, 700], [-1100, -400, 40, 500]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6), mono);
      b.position.set(x, h / 2 - 180, z); s.add(b);
    }

    this.stage = new THREE.Group();
    this.stage.scale.setScalar(0.78 / (CONFIG.shipScale || 1));   // en el hangar, algo por debajo del tamaño real
    s.add(this.stage);
    this.displays = ships.map((sh, k) => {
      const g = new THREE.Group();
      const m = sh.model.clone(true);
      m.traverse((o) => { if (o.isLight) o.parent.remove(o); if (o.isMesh) { o.castShadow = true; } });
      g.add(m);
      g.userData.bottom = sh.bottom / (CONFIG.shipScale || 1);
      g.visible = false;
      this.stage.add(g);
      // logo 3D de la escudería flotando y girando sobre la nave
      const logo = logos[k];
      if (logo) {
        const L = logo.clone(true);
        L.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); } });
        const holder = new THREE.Group(); holder.add(L);
        holder.scale.setScalar(0.85 * (CONFIG.shipScale || 1));
        holder.visible = false;
        s.add(holder);
        g.userData.logo = holder;
        g.userData.top = sh.size.y / (CONFIG.shipScale || 1);
      }
      return g;
    });
    this.index = 0; this.t = 0; this.spin = 0.6;
  }

  show(i) {
    this.displays.forEach((d, k) => { d.visible = k === i; if (d.userData.logo) d.userData.logo.visible = k === i; });
    this.index = i;
    this.flash = 1;
  }

  update(dt, aspect, ships) {
    this.t += dt;
    const d = this.displays[this.index];
    this.spin += dt * 0.32;
    this.flash = Math.max(0, (this.flash || 0) - dt * 2.5);
    d.rotation.y = this.spin + this.flash * 0.5;
    d.position.y = (-0.8 - d.userData.bottom + 0.45) * (CONFIG.shipScale || 1) + Math.sin(this.t * 1.6) * 0.06;
    ships[this.index].updateEngine(dt, 0.45 + Math.sin(this.t * 3) * 0.05);
    const L = d.userData.logo;
    if (L) {
      L.position.set(0, -0.8 + 0.45 + Math.min(d.userData.top || 1.2, 1.5) + 0.75 + Math.sin(this.t * 1.3) * 0.08, 0);
      L.rotation.y = this.t * 0.9 - this.flash * 2;
      L.rotation.z = Math.sin(this.t * 0.7) * 0.05;
    }
    const cam = this.camera;
    cam.aspect = aspect;
    if (aspect >= 1) { cam.position.set(5.6, 1.5, 6.1); cam.lookAt(-1.9, 0.1, 0); cam.fov = 34; }
    else { cam.position.set(0.4, 2.6, 10.5); cam.lookAt(0, -1.6, 0); cam.fov = 40; }
    cam.updateProjectionMatrix();
  }
}
