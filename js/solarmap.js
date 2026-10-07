// ─────────────────────────────────────────────────────────────
//  SARUS · SOLAR MAP
//  Mapa de navegación del campeonato: un Sistema Solar estilizado (no a escala), con la ruta numerada
//  01→10 trazada en arcos de vuelo. Las etiquetas son HTML (nítidas y pulsables) sobre la escena 3D.
//  Escena propia y ligera: planetas con shader procedural (sin texturas), estrellas en puntos.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NODES } from './lore.js';

const LOGV = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vW; varying vec3 vN; varying vec3 vO;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vO = position; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;

const NOISE = /* glsl */`
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += n3(p) * w; p = p * 2.05 + 3.1; w *= 0.5; } return a; }`;

// Tipos: 0 roca · 1 Tierra · 2 bandas (gigantes gaseosos) · 3 hielo con líneas · 4 liso (nubes, Urano)
function planetMaterial({ type = 0, a = 0x888888, b = 0x444444, c = 0xffffff, atm = 0x000000, atmK = 0, spot = 0, scale = 3 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) },
      uAtm: { value: new THREE.Color(atm) }, uAtmK: { value: atmK }, uSpot: { value: spot }, uScale: { value: scale }, uTime: { value: 0 },
    },
    vertexShader: LOGV,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uA, uB, uC, uAtm; uniform float uAtmK, uSpot, uScale, uTime;
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      ${NOISE}
      void main() {
        #include <logdepthbuf_fragment>
        vec3 o = normalize(vO), n = normalize(vN), v = normalize(cameraPosition - vW), L = normalize(-vW);
        vec3 col;
        ${type === 0 ? /* glsl */`
          float f = fbm(o * uScale) + 0.35 * fbm(o * uScale * 4.0);
          float cr = smoothstep(0.62, 0.7, fbm(o * uScale * 2.3 + 5.0));
          col = mix(uB, uA, smoothstep(0.35, 0.95, f)) * (1.0 - cr * 0.25);` : ''}
        ${type === 1 ? /* glsl */`
          float land = fbm(o * 2.2 + 7.0) + 0.12 * fbm(o * 9.0);
          float isL = smoothstep(0.53, 0.56, land);
          vec3 g = mix(vec3(0.13, 0.24, 0.09), vec3(0.45, 0.36, 0.22), smoothstep(0.4, 0.7, fbm(o * 5.0 + 2.0)));
          col = mix(mix(vec3(0.02, 0.08, 0.24), vec3(0.05, 0.2, 0.4), smoothstep(0.56, 0.45, land)), g, isL);
          col = mix(col, vec3(0.92), smoothstep(0.8, 0.88, abs(o.y)));
          float cl = smoothstep(0.62, 0.86, fbm(o * 3.4 + vec3(uTime * 0.02, 0.0, 11.0)) + 0.3 * fbm(o * vec3(14.0, 4.0, 14.0)));
          col = mix(col, vec3(0.97), cl * 0.9);` : ''}
        ${type === 2 ? /* glsl */`
          float y = o.y + 0.06 * fbm(o * vec3(2.0, 6.0, 2.0) + vec3(uTime * 0.01, 0.0, 0.0));
          float band = 0.5 + 0.5 * sin(y * uScale * 6.283);
          float fine = fbm(vec3(y * 40.0, o.x * 2.0, o.z * 2.0));
          col = mix(uA, uB, smoothstep(0.25, 0.75, band));
          col = mix(col, uC, smoothstep(0.55, 0.8, fine) * 0.4);
          if (uSpot > 0.0) { vec2 sp = vec2(atan(o.z, o.x) - 0.6, (o.y + 0.36) * 2.6); float e = length(sp * vec2(1.6, 1.0)); col = mix(col, vec3(0.75, 0.32, 0.18), smoothstep(0.42, 0.28, e) * uSpot); }` : ''}
        ${type === 3 ? /* glsl */`
          float f = fbm(o * 4.0);
          col = mix(uA, uB, smoothstep(0.3, 0.9, f));
          float l1 = abs(sin(dot(o, vec3(0.8, 0.3, 0.5)) * 14.0 + fbm(o * 3.0) * 6.0));
          float l2 = abs(sin(dot(o, vec3(-0.4, 0.7, 0.6)) * 11.0 + fbm(o * 2.5 + 3.0) * 5.0));
          col = mix(col, uC, (smoothstep(0.06, 0.0, l1) + smoothstep(0.05, 0.0, l2) * 0.8) * 0.85);` : ''}
        ${type === 4 ? /* glsl */`
          float f = fbm(o * vec3(1.5, uScale, 1.5) + vec3(uTime * 0.015, 0.0, 0.0));
          col = mix(uA, uB, smoothstep(0.3, 0.8, f));
          col = mix(col, uC, smoothstep(0.6, 0.95, abs(o.y)) * 0.5);` : ''}
        float d = dot(n, L);
        float lit = smoothstep(-0.15, 0.6, d);
        vec3 c = col * (0.06 + 1.15 * lit);
        float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6);
        c += uAtm * rim * uAtmK * smoothstep(-0.4, 0.5, d);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function ringMaterial({ inner, outer, tint = 0xd8c8a8, alpha = 0.8, bands = 1 }) {
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uIn: { value: inner }, uOut: { value: outer }, uTint: { value: new THREE.Color(tint) }, uAlpha: { value: alpha }, uBands: { value: bands } },
    vertexShader: LOGV,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uIn, uOut, uAlpha, uBands; uniform vec3 uTint;
      varying vec3 vW; varying vec3 vN; varying vec3 vO;
      float h1(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main() {
        #include <logdepthbuf_fragment>
        float r = (length(vO.xy) - uIn) / (uOut - uIn);
        float k = floor(r * 60.0 * uBands);
        float b = mix(h1(k), h1(k + 1.0), fract(r * 60.0 * uBands));
        float a = (0.35 + 0.65 * b) * smoothstep(0.0, 0.04, r) * smoothstep(1.0, 0.94, r);
        a *= 1.0 - smoothstep(0.58, 0.6, r) * smoothstep(0.66, 0.64, r) * 0.85;     // la división
        gl_FragColor = vec4(uTint * (0.6 + 0.6 * b), a * uAlpha);
      }`,
  });
}

function glowTexture(inner = 'rgba(255,240,210,1)', mid = 'rgba(255,170,80,0.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.18, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const polar = (r, a, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

export class SolarMap {
  constructor(dom, lite = false) {
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x020306);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
    this.camera.position.set(0, 95, 120);
    this.controls = new OrbitControls(this.camera, dom);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 300, maxPolarAngle: 1.45, rotateSpeed: 0.6, zoomSpeed: 0.9, panSpeed: 0.6 });
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => { this.anim = null; });
    this.t = 0;
    this.spin = [];
    const seg = lite ? 40 : 64;
    const sphere = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat);

    // estrellas
    const N = lite ? 1400 : 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 500);
      pos.set([v.x, v.y, v.z], i * 3);
      const k = 0.35 + Math.random() * 0.65, w = Math.random();
      col.set([k * (0.85 + 0.15 * w), k * 0.9, k * (1.05 - 0.2 * w)], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    S.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })));

    // Sol
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4.5, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.8) }));
    S.add(sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(36); S.add(glow);
    this.sunGlow = glow;

    // órbitas
    const orbit = (r, op = 0.16) => {
      const pts = []; for (let i = 0; i <= 256; i++) pts.push(polar(r, i / 256 * Math.PI * 2));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xbcc4cc, transparent: true, opacity: op, depthWrite: false }));
      S.add(l); return l;
    };
    const R = { venus: 13, earth: 21, mars: 30, belt: 38.5, jupiter: 50, saturn: 63, uranus: 76 };
    const A = { venus: 2.62, earth: 1.92, mars: 1.12, belt: 0.5, jupiter: -0.1, saturn: -0.9, uranus: -1.9 };
    for (const k of ['venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus']) orbit(R[k]);

    const body = (name, r, mat, at) => { const m = sphere(r, mat); m.position.copy(at); m.name = name; S.add(m); return m; };
    const B = this.bodies = {};
    B.venus = body('venus', 1.3, planetMaterial({ type: 4, a: 0xe8d2a0, b: 0xc9a46a, c: 0xf4ead0, atm: 0xffe2a8, atmK: 0.6, scale: 5 }), polar(R.venus, A.venus));
    B.earth = body('earth', 1.45, planetMaterial({ type: 1, atm: 0x5aa0ff, atmK: 1.1 }), polar(R.earth, A.earth));
    B.mars = body('mars', 1.0, planetMaterial({ type: 0, a: 0xc8643a, b: 0x6e2c18, atm: 0xf0a070, atmK: 0.35, scale: 2.6 }), polar(R.mars, A.mars));
    B.jupiter = body('jupiter', 3.7, planetMaterial({ type: 2, a: 0xe9d6b6, b: 0xb07a4e, c: 0xffffff, atm: 0xf2dcc0, atmK: 0.25, spot: 1, scale: 4.5 }), polar(R.jupiter, A.jupiter));
    B.saturn = body('saturn', 3.0, planetMaterial({ type: 2, a: 0xe8d8b0, b: 0xc8ae7c, c: 0xf6ecd0, atm: 0xf0e2c0, atmK: 0.2, scale: 3.5 }), polar(R.saturn, A.saturn));
    B.uranus = body('uranus', 2.2, planetMaterial({ type: 4, a: 0x9fe0e0, b: 0x7cc8d0, c: 0xc8f4f0, atm: 0xbff8ff, atmK: 0.6, scale: 1.2 }), polar(R.uranus, A.uranus));

    // anillos
    const sr = new THREE.Mesh(new THREE.RingGeometry(4.0, 7.6, 160, 1), ringMaterial({ inner: 4.0, outer: 7.6 }));
    sr.rotation.x = -Math.PI / 2 + 0.45; sr.rotation.y = 0.2; B.saturn.add(sr);
    const ur = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.6, 120, 1), ringMaterial({ inner: 3.0, outer: 3.6, tint: 0x9fb8c0, alpha: 0.45, bands: 0.4 }));
    ur.rotation.x = 0.12; ur.rotation.y = 1.4; B.uranus.add(ur);

    // lunas (giran despacio alrededor de su planeta)
    const moon = (parent, name, r, mat, dist, a0, speed, tilt = 0) => {
      const pivot = new THREE.Group(); pivot.position.copy(parent.position); pivot.rotation.z = tilt; S.add(pivot);
      const m = sphere(r, mat); m.name = name; m.position.copy(polar(dist, 0)); pivot.add(m);
      pivot.rotation.y = a0;
      this.spin.push([pivot, speed]);
      return m;
    };
    B.moon = moon(B.earth, 'moon', 0.42, planetMaterial({ type: 0, a: 0xbdbab2, b: 0x55534f, scale: 3.5 }), 3.4, -2.6, 0.05);
    B.phobos = moon(B.mars, 'phobos', 0.26, planetMaterial({ type: 0, a: 0x8a7a6a, b: 0x3a3028, scale: 5 }), 2.0, -2.2, 0.12, 0.1);
    B.phobos.scale.set(1.35, 0.9, 1.0);
    B.europa = moon(B.jupiter, 'europa', 0.42, planetMaterial({ type: 3, a: 0xf2ecdf, b: 0xcfc2a8, c: 0x8a4a30, scale: 3 }), 6.2, -2.0, 0.04);
    B.miranda = moon(B.uranus, 'miranda', 0.34, planetMaterial({ type: 0, a: 0xb4c4c8, b: 0x4c5a60, scale: 4 }), 4.2, -2.4, 0.05, 0.4);

    // Nueva Itaka: isla orbital entre la Tierra y la Luna (anillo de luz + núcleo)
    const it = new THREE.Group(); it.name = 'itaka';
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.18, 24), new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 1.8) }));
    halo.rotation.x = Math.PI / 2;
    it.add(core, halo);
    const itPivot = new THREE.Group(); itPivot.position.copy(B.earth.position); S.add(itPivot);
    it.position.copy(polar(1.9, 0)); itPivot.add(it);
    itPivot.rotation.y = -2.6 + 0.35;
    this.spin.push([itPivot, 0.05]);
    B.itaka = it;

    // cinturón de asteroides + baliza del nodo 07
    const BN = lite ? 1600 : 3200, bp = new Float32Array(BN * 3);
    for (let i = 0; i < BN; i++) { const a = Math.random() * Math.PI * 2, r = 36.5 + Math.random() * 4 + (Math.random() - 0.5) * 1.5; bp.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.9, Math.sin(a) * r], i * 3); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const belt = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8c8478, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false }));
    S.add(belt); this.spin.push([belt, 0.004]);
    const rocks = new THREE.Group(); rocks.position.copy(polar(R.belt, A.belt)); rocks.name = 'belt';
    const rockMat = planetMaterial({ type: 0, a: 0x8a8278, b: 0x3e3a36, scale: 6 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.3, 1);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.8 + Math.random() * 0.4), p.getY(k) * (0.7 + Math.random() * 0.4), p.getZ(k) * (0.8 + Math.random() * 0.4));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat); m.position.set((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.2); rocks.add(m);
    }
    S.add(rocks); B.belt = rocks;

    // anclas de cada nodo y encuadre al seleccionarlo (objeto que se sigue, centro del sistema, distancia)
    this.nodes = NODES.map((nd) => {
      const anchor = { earth: B.earth, moon: B.moon, venus: B.venus, itaka: B.itaka, mars: B.mars, phobos: B.phobos, belt: B.belt, europa: B.europa, saturn: B.saturn, uranus: B.miranda }[nd.id];
      const center = { moon: B.earth, itaka: B.earth, phobos: B.mars, europa: B.jupiter, uranus: B.uranus }[nd.id] || anchor;
      const dist = { earth: 11, moon: 11, itaka: 9, venus: 7, mars: 8, phobos: 8, belt: 9, europa: 22, saturn: 24, uranus: 17 }[nd.id];
      return { ...nd, anchor, center, dist, el: null };
    });

    // ruta: arcos de vuelo entre nodos consecutivos (los completados, en bermellón; el siguiente, con pulso)
    this.route = [];
    const tubeMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
    this.matOn = tubeMat(new THREE.Color(1.6, 0.42, 0.22), 0.95);
    this.matNext = tubeMat(new THREE.Color(1.2, 0.95, 0.7), 0.6);
    this.matOff = tubeMat(0x8c949c, 0.22);
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const seg = { a: this.nodes[i], b: this.nodes[i + 1], mesh: new THREE.Mesh(new THREE.BufferGeometry(), this.matOff), curve: null };
      S.add(seg.mesh); this.route.push(seg);
    }
    this.pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,140,90,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.pulse.scale.setScalar(2.2); S.add(this.pulse);

    S.add(new THREE.AmbientLight(0xffffff, 0.2));
    this.ray = new THREE.Raycaster();
    this.state = { unlocked: new Set(), done: new Set() };
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.overview();
  }

  // estado de progreso: qué nodos están abiertos, cuáles completados y cuál es el siguiente
  setState(nodeStatus) {
    this.status = nodeStatus;     // [{status: 'done'|'active'|'locked'|'soon'}] por nodo
    this.route.forEach((seg, i) => {
      const sa = nodeStatus[i].status, sb = nodeStatus[i + 1].status;
      seg.mesh.material = sa === 'done' && (sb === 'done' || sb === 'active') ? this.matOn : (sa === 'done' || sa === 'active') && sb !== 'locked' ? this.matNext : this.matOff;
    });
    this.next = nodeStatus.findIndex((s) => s.status === 'active');
  }

  posOf(node, out) { return node.anchor.getWorldPosition(out); }

  updateRoute() {
    for (const seg of this.route) {
      const a = this.posOf(seg.a, new THREE.Vector3()), b = this.posOf(seg.b, new THREE.Vector3());
      const d = a.distanceTo(b);
      const mid = a.clone().lerp(b, 0.5); mid.y += Math.min(14, d * 0.28) + 0.8;
      seg.curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      seg.mesh.geometry.dispose();
      seg.mesh.geometry = new THREE.TubeGeometry(seg.curve, 48, seg.mesh.material === this.matOn ? 0.09 : 0.06, 5, false);
    }
  }

  overview(aspect = this.camera.aspect || 1.6) {
    const d = 150 / Math.min(1, aspect / 1.25);
    this.anim = { target: new THREE.Vector3(0, 0, -8), pos: new THREE.Vector3(0, d * 0.62, d * 0.78), follow: null };
    this.focused = null;
  }

  focus(node) {
    const c = this.posOf({ anchor: node.center }, new THREE.Vector3());
    const dir = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    const portrait = this.camera.aspect < 1 ? 1.5 : 1;
    const d = node.dist * portrait;
    this.anim = { target: c, pos: c.clone().addScaledVector(dir, d * 0.82).setY(c.y + d * 0.5), follow: node.center };
    this.focused = node;
  }

  // pulsación sobre un cuerpo → nodo
  pick(ndcX, ndcY) {
    this.ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    let best = null, bd = Infinity;
    for (const nd of this.nodes) {
      const p = this.posOf(nd, this._v);
      const dist = this.ray.ray.distanceToPoint(p);
      const r = Math.max(0.6, (nd.anchor.geometry?.parameters?.radius || 0.6) * 1.4);
      const along = p.clone().sub(this.ray.ray.origin).dot(this.ray.ray.direction);
      if (dist < r && along > 0 && along < bd) { bd = along; best = nd; }
    }
    return best;
  }

  update(dt, aspect, W, H) {
    this.t += dt;
    const cam = this.camera;
    cam.aspect = aspect;
    // con la ficha abierta, el centro de la vista se desplaza al hueco libre (izquierda, o arriba en vertical)
    this.sx = (this.sx || 0) + ((this.shiftX || 0) - (this.sx || 0)) * Math.min(1, dt * 4);
    this.sy = (this.sy || 0) + ((this.shiftY || 0) - (this.sy || 0)) * Math.min(1, dt * 4);
    if (Math.abs(this.sx) + Math.abs(this.sy) > 1e-3) cam.setViewOffset(W, H, W * this.sx, H * this.sy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    for (const [o, s] of this.spin) o.rotation.y += dt * s;
    for (const k of ['venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'moon', 'europa', 'miranda', 'phobos']) {
      const b = this.bodies[k]; b.rotation.y += dt * 0.05;
      if (b.material.uniforms?.uTime) b.material.uniforms.uTime.value = this.t;
    }
    this.bodies.itaka.rotation.y += dt * 0.6;
    this.bodies.belt.rotation.y += dt * 0.05;
    this.sunGlow.scale.setScalar(36 + Math.sin(this.t * 1.3) * 1.2);
    this.updateRoute();

    // pulso viajando por el tramo hacia el siguiente nodo abierto
    const seg = this.route[Math.max(0, (this.next ?? 1) - 1)];
    if (seg?.curve && this.next > 0) { this.pulse.visible = true; seg.curve.getPoint((this.t * 0.35) % 1, this.pulse.position); }
    else this.pulse.visible = false;

    // animación de cámara hacia el nodo (o la vista general); el usuario la interrumpe al arrastrar
    if (this.anim) {
      const k = Math.min(1, dt * 2.6);
      if (this.anim.follow) {
        const c = this.anim.follow.getWorldPosition(this._w);
        this.anim.pos.add(this._v.copy(c).sub(this.anim.target)); this.anim.target.copy(c);
      }
      this.controls.target.lerp(this.anim.target, k);
      cam.position.lerp(this.anim.pos, k);
      if (cam.position.distanceTo(this.anim.pos) < 0.05) this.anim = null;
    } else if (this.focused) {
      // seguir al cuerpo enfocado aunque orbite
      const c = this.focused.center.getWorldPosition(this._w);
      const dlt = this._v.copy(c).sub(this.controls.target);
      this.controls.target.add(dlt); cam.position.add(dlt);
    }
    this.controls.update();

    // etiquetas HTML
    for (const nd of this.nodes) {
      if (!nd.el) continue;
      const p = this.posOf(nd, this._v);
      const r = nd.anchor.geometry?.parameters?.radius || 0.5;
      p.y += r * (nd.anchor.scale?.y || 1);
      const behind = p.clone().sub(cam.position).dot(cam.getWorldDirection(this._w)) < 0;
      p.project(cam);
      nd.el.style.transform = `translate(${((p.x + 1) / 2 * W).toFixed(1)}px, ${((1 - p.y) / 2 * H).toFixed(1)}px)`;
      nd.el.style.visibility = behind ? 'hidden' : 'visible';
    }
  }
}
