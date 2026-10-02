// Efectos: estelas de las puntas, polvo atmosférico, chispas y lanzamientos de cohetes junto a los monolitos.
import * as THREE from 'three';
import { atmosGLSL, registerAtmos } from './atmosphere.js';
import { CONFIG } from './config.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function softTexture(size = 128, inner = 0.0, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Estelas de luz desde las puntas de las cuchillas ──
export class Trails {
  constructor(scene, count = 2, N = 42) {
    this.N = N;
    this.trails = [];
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aT; varying float vT;
        void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uAlpha; varying float vT;
        void main(){
          #include <logdepthbuf_fragment>
          float a = pow(1.0 - vT, 2.2) * uAlpha;
          gl_FragColor = vec4(vec3(0.95, 0.93, 0.88) * a * 1.4, 1.0);
        }`,
    });
    this.mat = mat;
    for (let k = 0; k < count; k++) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 2 * 3);
      const t = new Float32Array(N * 2);
      const idx = [];
      for (let i = 0; i < N; i++) { t[i * 2] = t[i * 2 + 1] = i / (N - 1); }
      for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.trails.push({ mesh, pts: [], ups: [] });
    }
  }
  reset() { for (const tr of this.trails) { tr.pts.length = 0; tr.ups.length = 0; } }
  update(ship, dt) {
    const speed = ship.v;
    this.mat.uniforms.uAlpha.value = THREE.MathUtils.clamp((speed - 30) / 90, 0, 1) * 0.55;
    ship.tips.forEach((tip, k) => {
      const tr = this.trails[k]; if (!tr) return;
      const p = ship.worldPoint(tip, new THREE.Vector3());
      tr.pts.unshift(p); tr.ups.unshift(ship.upv.clone());
      if (tr.pts.length > this.N) { tr.pts.pop(); tr.ups.pop(); }
      const pos = tr.mesh.geometry.attributes.position;
      for (let i = 0; i < this.N; i++) {
        const q = tr.pts[Math.min(i, tr.pts.length - 1)] || p;
        const u = tr.ups[Math.min(i, tr.ups.length - 1)] || ship.upv;
        const w = 0.07 * (1 - i / this.N);
        pos.setXYZ(i * 2, q.x + u.x * w, q.y + u.y * w, q.z + u.z * w);
        pos.setXYZ(i * 2 + 1, q.x - u.x * w, q.y - u.y * w, q.z - u.z * w);
      }
      pos.needsUpdate = true;
    });
  }
}

// ── Polvo en suspensión alrededor de la cámara: da escala y sensación de velocidad ──
export class Motes {
  constructor(scene, count = 900, box = 140) {
    this.box = box;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) p[i] = (Math.random() - 0.5) * box;
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xe8e4da, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
      map: softTexture(32),
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(cam, dt = 0) {
    const a = this.points.geometry.attributes.position; const h = this.box / 2;
    const w = this.wind;
    for (let i = 0; i < a.count; i++) {
      for (let c = 0; c < 3; c++) {
        const cc = cam.position.getComponent(c);
        let v = a.array[i * 3 + c] + (w ? w.getComponent(c) * dt : 0);
        if (v < cc - h) v += this.box; else if (v > cc + h) v -= this.box;
        a.array[i * 3 + c] = v;
      }
    }
    a.needsUpdate = true;
  }
}

// ── Sistema de partículas genérico con shader (humo y chispas) ──
class ParticlePool {
  constructor(scene, max, { additive = false, color = new THREE.Color(1, 1, 1), lit = false, fogScale = 1 } = {}) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.rise = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aSeed = new THREE.BufferAttribute(new Float32Array(max).map(() => Math.random()), 1);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aSeed', this.aSeed);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 500 }, uColor: { value: color }, uLit: { value: lit ? 1 : 0 }, uFogScale: { value: fogScale } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aSize; attribute float aAlpha; attribute float aSeed;
        uniform float uScale;
        varying float vAlpha; varying float vSeed; varying vec3 vWorld;
        void main(){
          vAlpha = aAlpha; vSeed = aSeed;
          vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
          vec4 mv = viewMatrix * w;
          vAlpha *= smoothstep(aSize * 0.8, aSize * 4.0, -mv.z);
          gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 2048.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
          // humo pegado a la cámara (invisible por el fundido) → fuera, sin rasterizar un punto enorme
          if (vAlpha < 0.004) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; }
        }`,
    });
    registerAtmos(this.mat, () => /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        ${atmosGLSL()}
        uniform vec3 uColor; uniform float uLit; uniform float uFogScale;
        varying float vAlpha; varying float vSeed; varying vec3 vWorld;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          float n = sin((c.x + vSeed) * 13.0) * sin((c.y - vSeed) * 11.0) * 0.12;
          float a = smoothstep(1.0, 0.25, r + n) * vAlpha;
          if (a < 0.003) discard;
          vec3 col = uColor;
          if (uLit > 0.5) { col *= 0.78 + 0.35 * (0.5 - c.y) + 0.12 * (0.5 + c.x); }
          vec3 ray = vWorld - cameraPosition; float d = length(ray);
          float fa = fogAmount(cameraPosition, ray / d, d, ${CONFIG.atmosphere.baseDensity.toFixed(6)}) * uFogScale;
          col = mix(col, skyColor(ray / d), fa);
          gl_FragColor = vec4(col, a);
        }`);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, life, s0, s1, drag = 0.2, rise = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag; this.rise[i] = rise;
  }
  update(dt, cam, renderer, alphaFn) {
    const h = renderer.domElement.height;
    this.mat.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const j = --this.n;
        if (i !== j) {
          for (const arr of [this.pos, this.vel]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
          for (const arr of [this.age, this.life, this.s0, this.s1, this.drag, this.rise]) arr[i] = arr[j];
        }
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.rise[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.age[i] / this.life[i];
      this.aPos.setXYZ(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.aSize.setX(i, this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - Math.pow(1 - t, 2.2)));
      this.aAlpha.setX(i, alphaFn(t));
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

export class Sparks {
  constructor(scene) {
    this.pool = new ParticlePool(scene, 400, { additive: true, color: new THREE.Color(3.0, 1.3, 0.5), fogScale: 0 });
  }
  burst(p, dir, n, speed) {
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(speed * 0.5).addScaledVector(dir, speed * (0.4 + Math.random() * 0.6));
      this.pool.emit(p, _v, 0.25 + Math.random() * 0.4, 0.22, 0.05, 1.5, -12);
    }
  }
  update(dt, cam, r) { this.pool.update(dt, cam, r, (t) => 1 - t); }
}

// ── Cohetes: despegan junto a los monolitos, como en la imagen de referencia ──
export class Rockets {
  constructor(scene, pads) {
    this.scene = scene;
    this.pads = pads;           // [{pos: Vector3}]
    this.smoke = new ParticlePool(scene, 2600, { color: new THREE.Color(1.0, 0.99, 0.95), lit: true, fogScale: 0.35 });
    this.flameTex = softTexture(128, 0, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,230,190,0.9)'], [0.6, 'rgba(255,140,60,0.25)'], [1, 'rgba(255,100,40,0)']]);
    this.active = [];
    this.timer = 20;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xbdbcb6, roughness: 0.45, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1d, roughness: 0.5, metalness: 0.5 });
    this.makeBody = () => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 52, 20), bodyMat); b.position.y = 26; g.add(b);
      const n = new THREE.Mesh(new THREE.ConeGeometry(4, 13, 20), bodyMat); n.position.y = 58.5; g.add(n);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.05, 3, 20), darkMat); band.position.y = 40; g.add(band);
      for (let k = 0; k < 4; k++) {
        const booster = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 24, 12), bodyMat);
        const a = k * Math.PI / 2 + Math.PI / 4;
        booster.position.set(Math.cos(a) * 5.4, 12, Math.sin(a) * 5.4); g.add(booster);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      return g;
    };
  }

  launch(padIndex = Math.floor(Math.random() * this.pads.length), t0 = 0) {
    const pad = this.pads[padIndex];
    if (!pad) return;
    const body = this.makeBody();
    body.position.copy(pad.pos);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: new THREE.Color(9, 6, 3.6),
    }));
    flame.center.set(0.5, 0.85);
    flame.scale.set(26, 70, 1);
    body.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.1, 0.7),
    }));
    glow.scale.set(160, 160, 1);
    this.scene.add(glow);
    this.scene.add(body);
    this.active.push({ body, flame, glow, pad, t: t0, tiltDir: Math.random() * Math.PI * 2 });
  }

  update(dt, cam, renderer) {
    this.timer -= dt;
    if (this.timer <= 0 && this.enabled !== false) { this.launch(); this.timer = 38 + Math.random() * 30; }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const r = this.active[i];
      r.t += dt;
      const t = r.t;
      const ignite = Math.min(1, t / 1.2);
      const lift = Math.max(0, t - 2.2);
      const y = 0.5 * 11 * lift * lift + 0.08 * lift * lift * lift;
      const tilt = Math.min(0.5, Math.max(0, lift - 9) * 0.035);
      const horiz = y * Math.sin(tilt) * 0.6;
      r.body.position.set(r.pad.pos.x + Math.cos(r.tiltDir) * horiz, r.pad.pos.y + y, r.pad.pos.z + Math.sin(r.tiltDir) * horiz);
      r.body.rotation.set(Math.sin(r.tiltDir) * tilt, 0, -Math.cos(r.tiltDir) * tilt);
      const flick = 0.85 + Math.random() * 0.3;
      r.flame.scale.set(24 * flick * ignite, (60 + Math.min(lift, 10) * 6) * flick * ignite, 1);
      r.flame.material.opacity = ignite;
      r.glow.position.copy(r.body.position).y += 2;
      r.glow.material.opacity = ignite * Math.max(0.15, 1 - lift * 0.1);

      // humo
      const base = r.body.position;
      if (t < 9) {
        const n = Math.floor((t < 3 ? 26 : 12) * dt * 10 + Math.random());
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2; const sp = 18 + Math.random() * 28;
          _v.set(r.pad.pos.x, r.pad.pos.y + 4, r.pad.pos.z);
          _w.set(Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp);
          this.smoke.emit(_v, _w, 10 + Math.random() * 8, 30, 120 + Math.random() * 60, 0.45, 1.2);
        }
      }
      if (lift > 0 && y < 3200) {
        const n = Math.floor(40 * dt + Math.random());
        for (let k = 0; k < n + 1; k++) {
          _v.set(base.x + (Math.random() - 0.5) * 4, base.y - 6 - Math.random() * 8, base.z + (Math.random() - 0.5) * 4);
          _w.set((Math.random() - 0.5) * 5, -8 - Math.random() * 8, (Math.random() - 0.5) * 5);
          this.smoke.emit(_v, _w, 12 + Math.random() * 10, 14, 60 + Math.random() * 50, 0.3, 0.6);
        }
      }
      if (t > 70) {
        this.scene.remove(r.body); this.scene.remove(r.glow);
        this.active.splice(i, 1);
      }
    }
    this.smoke.update(dt, cam, renderer, (t) => Math.min(1, t * 8) * Math.pow(1 - t, 1.5) * 0.7);
  }
}

// ── Chispas iónicas de la propulsión: color por partícula (el de cada escudería) ──
export class IonTrail {
  constructor(scene, max = 3000) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.life = new Float32Array(max); this.size = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 500 } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 aCol; attribute float aSize; uniform float uScale; varying vec3 vCol;
        void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 64.0);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vCol;
        void main(){
          #include <logdepthbuf_fragment>
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - r), 2.0);
          gl_FragColor = vec4(vCol * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, color, life, size, bright = 2.5) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r * bright, color.g * bright, color.b * bright], i * 3);
    this.age[i] = 0; this.life[i] = life; this.size[i] = size;
  }
  update(dt, cam, renderer) {
    this.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const j = --this.n;
        if (i !== j) {
          for (const arr of [this.pos, this.vel, this.col]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
          this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size[i] = this.size[j];
        }
        continue;
      }
      const d = Math.exp(-3 * dt);
      for (let c = 0; c < 3; c++) { this.vel[i * 3 + c] *= d; this.pos[i * 3 + c] += this.vel[i * 3 + c] * dt; }
      const t = this.age[i] / this.life[i], f = (1 - t) * (1 - t);
      this.aPos.setXYZ(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.aCol.setXYZ(i, this.col[i * 3] * f, this.col[i * 3 + 1] * f, this.col[i * 3 + 2] * f);
      this.aSize.setX(i, this.size[i] * (1 - t * 0.6));
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
}

// ── Estela continua de propulsión: una cinta por tobera, translúcida, orientada a cámara.
//    Se alarga sola con la velocidad (los puntos quedan atrás a v·dt).
export class EngineTrails {
  constructor(scene, N = 30) {
    this.scene = scene; this.N = N; this.list = [];
  }
  add(ship) {
    const N = this.N;
    for (const nz of ship.nozzles) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 2 * 3), t = new Float32Array(N * 2), side = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) { t[i * 2] = t[i * 2 + 1] = i / (N - 1); side[i * 2] = -1; side[i * 2 + 1] = 1; }
      const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aT', new THREE.BufferAttribute(t, 1)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: ship.flame.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_vertex>
          attribute float aT; attribute float aSide; varying float vT; varying float vS;
          void main(){ vT = aT; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform vec3 uColor; uniform float uAlpha, uTime; varying float vT; varying float vS;
          void main(){
            #include <logdepthbuf_fragment>
            float across = 1.0 - vS * vS;                     // borde suave
            float along = pow(1.0 - vT, 1.7) * smoothstep(0.0, 0.06, vT);
            float shimmer = 0.85 + 0.15 * sin(vT * 40.0 - uTime * 30.0);
            vec3 c = mix(uColor, vec3(1.0), (1.0 - vT) * 0.25);
            gl_FragColor = vec4(c * across * across * along * shimmer * uAlpha, 1.0);
          }`,
      });
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.list.push({ ship, nz, mesh, mat, pts: [], w: nz.r * 2.1 * (ship.model.scale.x || 1) });
    }
  }
  reset() { for (const tr of this.list) tr.pts.length = 0; }
  update(dt, cam, time) {
    const N = this.N, P = new THREE.Vector3(), D = new THREE.Vector3(), S = new THREE.Vector3(), V = new THREE.Vector3();
    for (const tr of this.list) {
      const sh = tr.ship;
      const pw = sh.dead > 0 ? 0 : Math.max(0, (sh.power || 0) - 0.15);
      tr.mat.uniforms.uAlpha.value += ((sh.v > 5 ? Math.min(0.85, pw * 0.8) : 0) - tr.mat.uniforms.uAlpha.value) * Math.min(1, dt * 5);
      tr.mat.uniforms.uTime.value = time;
      tr.mesh.visible = tr.mat.uniforms.uAlpha.value > 0.01 && sh.root.visible;
      const p = sh.worldPoint(tr.nz.pos, new THREE.Vector3());
      if (sh.dead > 0 || sh.respawned) { tr.pts.length = 0; }
      tr.pts.unshift(p);
      if (tr.pts.length > N) tr.pts.pop();
      if (!tr.mesh.visible) continue;
      const pos = tr.mesh.geometry.attributes.position;
      const w0 = tr.w * (0.8 + pw * 0.5);
      for (let i = 0; i < N; i++) {
        const q = tr.pts[Math.min(i, tr.pts.length - 1)];
        const q2 = tr.pts[Math.min(i + 1, tr.pts.length - 1)];
        D.subVectors(q, q2); if (D.lengthSq() < 1e-6) D.copy(sh.fwd);
        V.subVectors(cam.position, q);
        S.crossVectors(D, V).normalize();
        const w = w0 * (1 - i / N * 0.55);
        pos.setXYZ(i * 2, q.x - S.x * w, q.y - S.y * w, q.z - S.z * w);
        pos.setXYZ(i * 2 + 1, q.x + S.x * w, q.y + S.y * w, q.z + S.z * w);
      }
      pos.needsUpdate = true;
    }
  }
}

// ── Daño: humo oscuro y llamas para naves tocadas y restos en pista ──
export class DamageFx {
  constructor(scene) {
    this.smoke = new ParticlePool(scene, 1400, { color: new THREE.Color(0.16, 0.15, 0.14), lit: true, fogScale: 0.6 });
    this.fire = new ParticlePool(scene, 500, { additive: true, color: new THREE.Color(3.2, 1.25, 0.32), fogScale: 0.2 });
  }
  update(dt, cam, r) {
    this.smoke.update(dt, cam, r, (t) => Math.min(1, t * 6) * Math.pow(1 - t, 1.3) * 0.8);
    this.fire.update(dt, cam, r, (t) => (1 - t) * (1 - t));
  }
}
