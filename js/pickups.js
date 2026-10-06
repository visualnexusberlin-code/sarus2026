// Esferas de energía sobre la pista (verde = boost, roja = cohete) y cohetes teledirigidos.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const COLORS = { G: new THREE.Color(0.22, 1.0, 0.36), R: new THREE.Color(1.0, 0.1, 0.04) };
const PATTERNS = ['GRG', 'GGG', 'RGR', 'GGR', 'GRG', 'RGG', 'GGG', 'GRR'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

function coreMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        mat4 mm = modelMatrix * instanceMatrix;
        vec4 wp = mm * vec4(position, 1.0);
        vP = position; vN = normalize(mat3(mm) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uTime; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        #include <logdepthbuf_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(f, 1.8);
        float sw = sin(vP.y * 7.0 + uTime * 3.2 + sin(vP.x * 5.0 + uTime * 2.1) * 1.8) * 0.5 + 0.5;
        float band = pow(sw, 6.0);
        vec3 c = uColor * (0.35 + 2.6 * fres + 1.4 * band) + vec3(1.0) * pow(f, 6.0) * 0.8;
        gl_FragColor = vec4(c * 1.6, 1.0);
      }`,
  });
}

function haloMaterial(color, size) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: color }, uSize: { value: size }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uSize; varying vec2 vUv;
      void main(){
        mat4 mm = modelMatrix * instanceMatrix;
        float sc = length(mm[0].xyz);
        vec4 c = viewMatrix * mm * vec4(0.0, 0.0, 0.0, 1.0);
        c.xy += position.xy * uSize * sc;
        vUv = uv;
        gl_Position = projectionMatrix * c;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - r), 2.4) * (0.8 + 0.2 * sin(uTime * 5.0));
        gl_FragColor = vec4(uColor * a * 1.3, 1.0);
      }`,
  });
}

export class Pickups {
  constructor(scene, track) {
    this.track = track;
    const C = CONFIG.pickups;
    this.items = [];
    let k = 0;
    for (let s = C.firstAt; s < track.length - 160; s += C.every, k++) {
      if (track.gapAt && [0, 30, -30].some((d) => track.gapAt(s + d) >= 0)) continue;   // nada en el aire de los saltos
      const pat = PATTERNS[k % PATTERNS.length];
      const wq = Math.min(1, track.wAt ? track.wAt(s) : 1);
      C.lanes.forEach((x, i) => this.items.push({ s, x: x * wq, type: pat[i], active: true, t: 0, pop: 1, seed: Math.random() * 10 }));
    }
    this.meshes = {};
    const geo = new THREE.IcosahedronGeometry(1.25, 3);
    const quad = new THREE.PlaneGeometry(1, 1);
    const ring = new THREE.TorusGeometry(1.85, 0.045, 6, 48);
    for (const type of ['G', 'R']) {
      const list = this.items.filter((i) => i.type === type);
      const core = new THREE.InstancedMesh(geo, coreMaterial(COLORS[type]), list.length);
      const halo = new THREE.InstancedMesh(quad, haloMaterial(COLORS[type], 11), list.length);
      const rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: COLORS[type].clone().multiplyScalar(3), fog: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), list.length);
      for (const m of [core, halo, rings]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
      list.forEach((it, i) => { it.idx = i; });
      this.meshes[type] = { core, halo, rings, list };
    }
    this.F = track.frame();
    this.t = 0;
    this.update(0, []);
  }

  reset() { for (const it of this.items) { it.active = true; it.t = 0; it.pop = 1; } }

  nearestAhead(ship, range, wantRed) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      if (!it.active || (it.type === 'R' && !wantRed)) continue;
      const d = this.track.delta(ship.s, it.s);
      if (d > 12 && d < range) {
        const score = d + Math.abs(it.x - ship.x) * 4 - (it.type === 'G' ? 15 : 0);
        if (score < bd) { bd = score; best = it; }
      }
    }
    return best;
  }

  update(dt, ships, onPick) {
    this.t += dt;
    const tr = this.track, respawn = CONFIG.pickups.respawn;
    for (const it of this.items) {
      if (!it.active) { it.t -= dt; if (it.t <= 0) { it.active = true; it.pop = 0; } continue; }
      it.pop = Math.min(1, it.pop + dt * 2.5);
      for (const sh of ships) {
        if (sh.dead > 0) continue;
        const d = tr.delta(sh.s, it.s);
        if (Math.abs(d) < sh.length * 0.5 + 1.2 && Math.abs(sh.x - it.x) < sh.halfWidthGeo + 1.3) {
          it.active = false; it.t = respawn;
          onPick?.(sh, it);
          break;
        }
      }
    }
    for (const type of ['G', 'R']) {
      const { core, halo, rings, list } = this.meshes[type];
      core.material.uniforms.uTime.value = this.t;
      halo.material.uniforms.uTime.value = this.t;
      for (const it of list) {
        tr.sample(it.s, this.F);
        const sc = it.active ? (1 - Math.pow(1 - it.pop, 3)) * (1 + 0.06 * Math.sin(this.t * 4 + it.seed)) : 0;
        _v.copy(this.F.pos).addScaledVector(this.F.right, it.x).addScaledVector(this.F.up, 2.3 + Math.sin(this.t * 1.8 + it.seed) * 0.25);
        _q.setFromAxisAngle(this.F.up, this.t * 1.3 + it.seed);
        _m.compose(_v, _q, _s.setScalar(Math.max(sc, 1e-4)));
        core.setMatrixAt(it.idx, _m); halo.setMatrixAt(it.idx, _m);
        _q.setFromEuler(new THREE.Euler(Math.PI / 2 + Math.sin(this.t + it.seed) * 0.5, this.t * 2 + it.seed, 0));
        _m.compose(_v, _q, _s.setScalar(Math.max(sc, 1e-4)));
        rings.setMatrixAt(it.idx, _m);
      }
      core.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
    }
  }
}

// ── Cohetes ──
export class Missiles {
  constructor(scene, track, fx) {
    this.scene = scene; this.track = track; this.fx = fx;
    this.list = [];
    this.F = track.frame();
    const body = new THREE.CylinderGeometry(0.11, 0.14, 1.3, 10); body.rotateX(Math.PI / 2);
    this.bodyGeo = body;
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.6, roughness: 0.4, emissive: 0xff2a0a, emissiveIntensity: 0.6 });
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,190,120,0.9)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.flameTex = new THREE.CanvasTexture(c);
    this.flashes = [];
    // todo precreado: ni materiales nuevos ni shaders que compilar en mitad de la carrera
    this.flameMat = new THREE.SpriteMaterial({ map: this.flameTex, color: new THREE.Color(6, 3, 1.4), blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.flashPool = Array.from({ length: 12 }, () => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, color: new THREE.Color(8, 4, 1.8), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
      spr.visible = false; spr.frustumCulled = false; this.scene.add(spr); return spr;
    });
    this.flashI = 0;
  }

  reset() { for (const m of this.list) this.scene.remove(m.obj); this.list.length = 0; }

  fire(owner, ships) {
    if (owner.ammo <= 0) return false;
    owner.ammo--;
    // objetivo: la nave más cercana por delante (hasta 450 m)
    let target = null, bd = Infinity;
    for (const o of ships) {
      if (o === owner || o.dead > 0 || o.invuln > 0) continue;
      const d = this.track.delta(owner.s, o.s);
      if (d > 4 && d < 450) { const sc = d + Math.abs(o.x - owner.x) * 6; if (sc < bd) { bd = sc; target = o; } }
    }
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(this.bodyGeo, this.bodyMat));
    const flame = new THREE.Sprite(this.flameMat);
    flame.scale.set(1.6, 1.6, 1); flame.position.z = -0.9;
    obj.add(flame);
    this.scene.add(obj);
    this.list.push({ obj, owner, target, s: owner.s + owner.length * 0.6, x: owner.x, v: Math.max(owner.v + 55, 120), life: 4.5, h: 1.3 });
    return true;
  }

  update(dt, ships, onHit) {
    const tr = this.track;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.life -= dt;
      m.v = Math.min(270, m.v + 120 * dt);
      m.s = tr.wrap(m.s + m.v * dt);
      if (m.target) {
        const d = tr.delta(m.s, m.target.s);
        if (d < -6) m.target = null;
        else m.x += THREE.MathUtils.clamp(m.target.x - m.x, -1, 1) * 42 * dt;
      }
      tr.sample(m.s, this.F);
      const pos = _v.copy(this.F.pos).addScaledVector(this.F.right, m.x).addScaledVector(this.F.up, m.h);
      m.obj.position.copy(pos);
      m.obj.lookAt(pos.clone().add(this.F.tan));
      // estela
      this.fx.sparks.pool.emit(pos, this.F.tan.clone().multiplyScalar(-20), 0.35, 0.35, 0.08, 2, 0);
      if (Math.random() < 0.7) this.fx.smoke?.emit(pos, this.F.up.clone().multiplyScalar(1.5), 1.6, 0.8, 4, 0.8, 0.5);
      // impacto
      let hit = null;
      for (const o of ships) {
        if ((o === m.owner && m.life > 4.2) || o.out) continue;
        if (Math.abs(tr.delta(m.s, o.s)) < 3 && Math.abs(o.x - m.x) < 2.1) { hit = o; break; }
      }
      const wall = Math.abs(m.x) > 15.6;
      if (hit || wall || m.life <= 0) {
        this.explode(pos, !!hit);
        if (hit) { const r = hit.hit(); if (r) onHit?.(m.owner, hit, r, pos.clone()); }
        this.scene.remove(m.obj);
        this.list.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.t += dt;
      const k = f.t / 0.45;
      f.spr.scale.setScalar(4 + k * 14);
      f.spr.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { f.spr.visible = false; this.flashes.splice(i, 1); }
    }
  }

  explode(pos, big) {
    this.fx.sparks.burst(pos, _v.set(0, 0.3, 0), big ? 70 : 25, big ? 22 : 12);
    for (let k = 0; k < (big ? 14 : 5); k++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(10);
      this.fx.smoke?.emit(pos, d, 1.6 + Math.random(), 2, 9, 1.2, 1.5);
    }
    const spr = this.flashPool[this.flashI++ % this.flashPool.length];
    const old = this.flashes.findIndex((f) => f.spr === spr); if (old >= 0) this.flashes.splice(old, 1);
    spr.position.copy(pos); spr.visible = true; spr.scale.setScalar(4); spr.material.opacity = 1;
    this.flashes.push({ spr, t: 0 });
  }
}
