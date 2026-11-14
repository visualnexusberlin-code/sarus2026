// Anillos de recuperación (EUROPA, MIRANDA): cruzarlos repara el blindaje, recarga cohetes y da boost.
// La lámina de luz del anillo se ondula al paso y una película azul recorre la nave de morro a cola.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { setWetRings } from './dressing.js';

// Película de luz de los anillos (lámina) — se ondula al cruzarla
function filmMaterial(col = [0.3, 0.75, 1.0]) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uT: { value: 0 }, uHit: { value: -10 }, uCol: { value: new THREE.Vector3(...col) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uHit; uniform vec3 uCol; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        float rim = smoothstep(0.7, 1.0, r);
        float sh = 0.5 + 0.5 * sin(r * 30.0 - uT * 3.0 + sin(atan(p.y, p.x) * 6.0 + uT) * 0.6);
        float dt = uT - uHit;
        float wave = exp(-pow((r - dt * 1.4) * 9.0, 2.0)) * exp(-dt * 1.6) * step(0.0, dt);
        float a = 0.05 + 0.1 * sh * (0.3 + rim) + 0.5 * rim * rim + 1.4 * wave;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  });
}

// Película azul que recorre la nave al pasar por un anillo
function shellMaterial(col = [0.35, 0.8, 1.0]) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uP: { value: 1 }, uCol: { value: new THREE.Vector3(...col) } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uP; uniform vec3 uCol; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.2);
        float sweep = exp(-pow((vP.z - (1.2 - uP * 3.0)) * 3.2, 2.0));
        float lines = 0.5 + 0.5 * sin(vP.z * 40.0 - uP * 30.0);
        float a = (0.9 * f + 1.6 * sweep * (0.6 + 0.4 * lines)) * pow(max(1.0 - uP, 0.0), 1.4);
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  });
}


// sList: posiciones (m) en la pista. opts: { R: radio, lift: altura del centro sobre el tablero }
export function buildRaceRings(world, track, sList, own, opts = {}) {
  const RR = opts.R ?? 30, RC = opts.lift ?? 8, F = track.frame();
  const M = {
    metal: new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.32, metalness: 0.9 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.28, metalness: 0.6 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x5fe0ff, emissiveIntensity: 3.0 }),
    star: new THREE.MeshStandardMaterial({ color: 0x404850, emissive: 0xeaf6ff, emissiveIntensity: 5.0 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb070, emissiveIntensity: 4.0 }),
  };
  const arch = opts.style !== 'classic';
  setWetRings(sList, opts.color);
  if (arch) {
    M.silver = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.34, metalness: 0.55, emissive: 0x0d1420 });
    M.star = new THREE.MeshStandardMaterial({ color: 0x404850, emissive: opts.color ? new THREE.Color(...opts.color).lerp(new THREE.Color(0.87, 0.94, 1.0), 0.4) : new THREE.Color(0xdff0ff), emissiveIntensity: 3.2 });
  }
  Object.values(M).forEach((m) => own.push(m));
  const gates = [];
  for (const s of sList) {
    track.sample(s, F);
    const grp = new THREE.Group();
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.right.clone().negate(), F.up, F.tan));
    grp.position.copy(F.pos).addScaledVector(F.up, RC);
    const gp = { metal: [], silver: [], cyan: [], star: [], warm: [] };
    if (arch) {
      // Arco monumental: aro ancho de acero claro, tres paneles de luz por dentro separados por dos abrazaderas,
      // costillas y balizas cálidas en el canto. Todo a escala del radio (k = 1 con R = 30).
      const DEG = Math.PI / 180, k = RR / 30;
      gp.silver.push(new THREE.TorusGeometry(RR + 1.2 * k, 3.6 * k, 12, 140).scale(1, 1, 2.3));
      gp.metal.push(new THREE.TorusGeometry(RR + 4.6 * k, 0.5 * k, 6, 140).translate(0, 0, 5.4 * k), new THREE.TorusGeometry(RR + 4.6 * k, 0.5 * k, 6, 140).translate(0, 0, -5.4 * k));
      for (const [c, span] of [[162, 70], [90, 44], [18, 70]]) gp.star.push(new THREE.TorusGeometry(RR - 2.5 * k, 1.25 * k, 8, 48, span * DEG).scale(1, 1, 3.4).rotateZ((c - span / 2) * DEG));
      for (const c of [123, 57]) { const a = c * DEG; gp.metal.push(new THREE.BoxGeometry(6.5 * k, 2.6 * k, 13 * k).rotateZ(a).translate(Math.cos(a) * (RR - 3.2 * k), Math.sin(a) * (RR - 3.2 * k), 0)); }
      for (let q = 0; q < 28; q++) {
        const a = (q + 0.5) / 28 * Math.PI * 2;
        gp.metal.push(new THREE.BoxGeometry(8.2 * k, 0.7 * k, 17.4 * k).rotateZ(a).translate(Math.cos(a) * (RR + 1.4 * k), Math.sin(a) * (RR + 1.4 * k), 0));
        if (q % 2 === 0) gp.warm.push(new THREE.BoxGeometry(0.9 * k, 0.9 * k, 0.5).rotateZ(a).translate(Math.cos(a) * (RR + 3.4 * k), Math.sin(a) * (RR + 3.4 * k), -8.5 * k));
      }
    } else {
    gp.metal.push(new THREE.TorusGeometry(RR, 2.6, 14, 120));
    gp.cyan.push(new THREE.TorusGeometry(RR - 2.7, 0.42, 8, 120));
    gp.star.push(new THREE.TorusGeometry(RR + 2.9, 0.22, 6, 120));
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2, big = k % 3 === 0;
      const b = new THREE.BoxGeometry(big ? 7.6 : 6.4, big ? 4.2 : 2.6, big ? 6.4 : 5.6);
      b.rotateZ(a); b.translate(Math.cos(a) * RR, Math.sin(a) * RR, 0);
      (big ? gp.silver : gp.metal).push(b);
      if (big) gp.cyan.push(new THREE.BoxGeometry(0.5, 2.6, 6.6).rotateZ(a).translate(Math.cos(a) * (RR - 3.75), Math.sin(a) * (RR - 3.75), 0));
    }
    }
    for (const [k, l] of Object.entries(gp)) {
      if (!l.length) continue;
      const mg = mergeGeometries(l.map((g) => { g.deleteAttribute('uv'); return g; }), false); l.forEach((gq) => gq.dispose());
      const mesh = new THREE.Mesh(mg, M[k]); mesh.castShadow = k === 'metal' || k === 'silver'; mesh.receiveShadow = true; grp.add(mesh); own.push(mg);
    }
    const fm = filmMaterial(opts.color); own.push(fm);
    const film = new THREE.Mesh(new THREE.CircleGeometry(RR - 2.6, 72), fm); film.renderOrder = 3; grp.add(film); own.push(film.geometry);
    world.add(grp);
    gates.push({ s, film: fm, group: grp, kind: opts.kind || 'full', ammo: opts.ammo });
  }

  const shellGeo = new THREE.SphereGeometry(1, 28, 18); own.push(shellGeo);
  const shells = new Map(), prevD = new Map();
  const shellFor = (sh) => {
    let e = shells.get(sh);
    if (!e) {
      const host = sh.body || sh.root;
      for (const o of [...host.children]) if (o.name === 'ringShell') host.remove(o);     // restos de otra fase
      const m = shellMaterial(opts.color); own.push(m);
      const mesh = new THREE.Mesh(shellGeo, m); mesh.name = 'ringShell'; mesh.frustumCulled = false; mesh.renderOrder = 4;
      mesh.scale.set(sh.halfWidthGeo * 1.25, sh.size.y * 0.8, sh.length * 0.62);
      mesh.position.set(0, sh.bottom + sh.size.y * 0.5, 0);
      host.add(mesh);
      e = { mesh, m, p: 1 }; shells.set(sh, e);
    }
    return e;
  };
  let t = 0;
  return {
    gates,
    update(dt) {
      t += dt;
      for (const gt of gates) gt.film.uniforms.uT.value = t;
      for (const e of shells.values()) { if (e.p < 1) { e.p = Math.min(1, e.p + dt / 1.15); e.m.uniforms.uP.value = e.p; } e.mesh.visible = e.p < 1; }
    },
    passRings(ships, onPass) {
      for (const sh of ships) {
        if (sh.out || sh.dead > 0) { prevD.delete(sh); continue; }
        let pd = prevD.get(sh); if (!pd) { pd = gates.map(() => null); prevD.set(sh, pd); }
        gates.forEach((gt, i) => {
          const d = track.delta(sh.s, gt.s);
          if (pd[i] !== null && pd[i] > 0 && d <= 0 && d > -40) {
            gt.film.uniforms.uHit.value = t;
            const e = shellFor(sh); e.p = 0; e.m.uniforms.uP.value = 0; e.mesh.visible = true;
            onPass?.(sh, gt);
          }
          pd[i] = d;
        });
      }
    },
    reset() { prevD.clear(); for (const e of shells.values()) { e.p = 1; e.mesh.visible = false; } },
  };
}
