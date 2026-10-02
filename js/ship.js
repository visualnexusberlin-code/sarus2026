// Nave anti-gravedad: física arcade en coordenadas de pista (s, x) + presentación visual.
// Funciona con cualquier modelo de la flota: detecta toberas por el material "Ion"/"Reactor"
// y las puntas de ala por los vértices más exteriores.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _e = new THREE.Euler();
const _v = new THREE.Vector3();
const ION_RE = /_Ion|Reactor red/i;
const QT = 0.5;
// Desgaste de carrera en el shader (espacio del modelo): mugre, regueros hacia atrás, desconchones, arañazos y hollín trasero.
const WEAR = { LUDOX: 0.85, 'PRIME-EX': 0.8, WOLFEN: 0.6, ADAX: 0.8, MANTA: 0.85, NEXUS: 0.3, ILION: 0.35, X3LEE: 0.35, 'HUE-MING': 0.3 };
// Pulido: normales suavizadas por ángulo (quita el aspecto abollado de mallas generadas)
const POLISH = { MANTA: 35 };
const NO_WEAR = /Ion|Hover|glass|Glass|canopy|Canopy|visor|Visor|HUD|PILOT|Name|LOGO|lamp|light|Light|Red|Cyan|Chrome/;
// Cabina recortada por máscara: dentro del elipsoide, los píxeles con el color del cristal pintado
// desaparecen del casco y solo esos se dibujan en el cristal (borde exacto, sin dientes de triángulo).
// El cristal es oscuro, casi opaco, con suciedad pegada al marco (_rim, horneado en la flota).
function addCanopy(mat, cfg, glass) {
  const prev = mat.onBeforeCompile;
  const [cx, cy, cz, rx, ry, rz] = cfg.ell || [0, 0, 0, 1, 1, 1];
  const ref = (cfg.ref || [0, 0, 0]).map((v) => (v / 255).toFixed(4));
  const mask = !cfg.none;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vCP;${glass ? '\nattribute float _rim; varying float vRim;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCP = position;${glass ? ' vRim = _rim;' : ''}`);
    const test = mask ? `vec3 cq = (vCP - vec3(${cx}, ${cy}, ${cz})) / vec3(${rx}, ${ry}, ${rz});
      vec3 cs = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
      float cMx = max(cs.r, max(cs.g, cs.b)), cMn = min(cs.r, min(cs.g, cs.b));
      bool colOk = ${cfg.mode === 'sat' ? `cMx - cMn < ${(+cfg.satTol).toFixed(3)} && dot(cs, vec3(0.2126, 0.7152, 0.0722)) > ${(+cfg.lumMin).toFixed(3)}` : `distance(cs, vec3(${ref.join(',')})) < ${(cfg.tol / 255).toFixed(4)}`};
      bool isGlass = dot(cq, cq) < 1.0 && cq.y > -${(cfg.below ?? 0.3).toFixed(3)} && colOk;` : 'bool isGlass = true;';
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vCP;${glass ? '\nvarying float vRim;' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      ${test}
      ${glass ? `if (!isGlass) discard;
      float gN = 0.55 + 0.45 * sin(vCP.x * 41.0 + sin(vCP.z * 17.0) * 2.0) * sin(vCP.z * 29.0 + vCP.y * 13.0);
      float grime = clamp(vRim * (0.75 + 0.5 * gN), 0.0, 1.0);
      diffuseColor.rgb = mix(vec3(0.16, 0.19, 0.2), vec3(0.17, 0.15, 0.12), grime);
      diffuseColor.a = 1.0;` : 'if (isGlass) discard;'}`);
    if (glass) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n      roughnessFactor = mix(roughnessFactor, 0.75, grime);')
        .replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0 - grime * 0.92);'));
    }
  };
  const baseKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => baseKey() + (glass ? '|cglass' : '|ccut') + JSON.stringify(cfg);
}

function addWear(mat, k) {
  mat.userData.wear = k;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; varying vec3 vWN;
      float wh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      float wn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(wh(i), wh(i+vec3(1,0,0)), f.x), mix(wh(i+vec3(0,1,0)), wh(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(wh(i+vec3(0,0,1)), wh(i+vec3(1,0,1)), f.x), mix(wh(i+vec3(0,1,1)), wh(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float wf(vec3 p){ return wn(p) * 0.55 + wn(p * 2.3) * 0.3 + wn(p * 5.1) * 0.15; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float wearK = ${k.toFixed(2)};
      vec3 P = vWP; vec3 Nw = normalize(vWN);
      float grime = smoothstep(0.32, 0.72, wf(P * 2.2)) * (0.55 + 0.45 * (1.0 - max(Nw.y, 0.0)));
      float streak = smoothstep(0.55, 0.85, wn(vec3(P.x * 11.0, P.y * 11.0, P.z * 0.55))) * smoothstep(2.5, -2.5, P.z);
      float soot = smoothstep(-1.9, -3.0, P.z) * (0.6 + 0.4 * wn(P * 6.0));
      float chips = smoothstep(0.7, 0.74, wf(P * 11.0 + 3.0)) * smoothstep(0.4, 0.6, wn(P * 2.4));
      float faded = smoothstep(0.62, 0.8, wf(P * 1.3 + 7.0));
      float scratch = smoothstep(0.93, 0.99, wn(vec3(P.x * 3.0, P.y * 70.0, P.z * 3.0))) * smoothstep(0.3, 0.7, wn(P * 1.3));
      vec3 dirt = vec3(0.16, 0.14, 0.12);
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))) * 1.25 + 0.04, 0.6), faded * 0.6 * wearK);
      diffuseColor.rgb = mix(diffuseColor.rgb, dirt * (0.6 + 0.4 * wf(P * 9.0)), clamp(grime * 0.7 + streak * 0.6, 0.0, 0.85) * wearK);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.028, 0.026), soot * 0.7 * wearK);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.61, 0.63), clamp(chips * 0.85 + scratch * 0.7, 0.0, 1.0) * wearK);
      float wearRough = clamp((grime + streak + soot) * wearK, 0.0, 1.0);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n      roughnessFactor = mix(roughnessFactor, 0.85, wearRough * 0.8);');
  };
  const baseKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => baseKey() + '|wear' + k.toFixed(2);
}            // duración del giro brusco asistido

export class Ship {
  // model: Object3D con la nave (morro +Z, escala real en metros). def: entrada de FLEET + stats.
  constructor(model, track, def = {}, { player = false } = {}) {
    this.track = track;
    this.def = def;
    this.name = def.name || 'NAVE';
    this.player = player;
    this.C = { ...CONFIG.ship, ...(def.stats || {}) };
    this.maxHull = 5 + ((def.hull || 4) - 4);   // 4–6 impactos según la escudería (5 la media)
    this.root = new THREE.Group();
    this.body = new THREE.Group();       // recibe balanceo/cabeceo visual
    this.root.add(this.body);
    this.model = new THREE.Group();
    this.model.add(model);
    this.model.scale.setScalar(CONFIG.shipScale || 1);
    this.body.add(this.model);
    this.model.updateMatrixWorld(true);

    this.mergeModel();
    if (def.flame) {                           // propulsión con el color de la escudería
      this.ionColor.setRGB(...def.flame);
      for (const m of this.reactorMats) { m.emissive?.copy(this.ionColor); m.color?.copy(this.ionColor); }
      for (const m of this.hoverMats || []) m.emissive?.copy(this.ionColor);   // emisores y filetes con el color de la escudería
    }
    this.analyse();
    this.buildExhaust();
    // daño progresivo: colores base del casco (se ennegrecen con cada impacto)
    this.dmgMats = this.meshes.map((m) => m.material).filter((m) => !this.reactorMats.includes(m) && m.color)
      .map((m) => ({ m, c: m.color.clone(), r: m.roughness ?? 0.5 }));
    this.frame = track.frame();
    this.fwd = new THREE.Vector3();
    this.upv = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.race = null;
    this.reset(0, 0);
    this.updateEngine(0, 0.3);
  }

  // Todas las piezas → una malla por material, en coordenadas locales de la nave.
  mergeModel() {
    const model = this.model;
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const groups = new Map(); const old = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', '_rim'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(g);
      old.push(o);
    });
    model.clear();
    this.meshes = [];
    this.reactorMats = [];
    this.ionGeos = [];
    this.ionColor = new THREE.Color(1, 0.2, 0.06);
    for (const [mat, geos] of groups) {
      let geo = mergeGeometries(geos, false);
      if (POLISH[this.name] && /Meshy/.test(mat.name)) { geo = toCreasedNormals(geo, POLISH[this.name] * Math.PI / 180); geo.setIndex([...Array(geo.attributes.position.count).keys()]); }
      const m = new THREE.Mesh(geo, mat.clone());
      if (WEAR[this.name] && !NO_WEAR.test(mat.name) && m.material.isMeshStandardMaterial) addWear(m.material, WEAR[this.name]);
      if (mat.userData.canopyCut) addCanopy(m.material, mat.userData.canopyCut, false);
      if (mat.userData.canopyGlass) {
        addCanopy(m.material, mat.userData.canopyGlass, true);
        Object.assign(m.material, { roughness: 0.06, depthWrite: true });
        if (m.material.isMeshPhysicalMaterial) { m.material.transmission = 0.6; m.material.thickness = 0.02; m.material.clearcoat = 1; m.material.clearcoatRoughness = 0.05; }
      }
      m.castShadow = true; m.receiveShadow = true;
      m.material.envMapIntensity = 1.0;
      m.material.side = THREE.DoubleSide;        // interiores de toberas y tomas visibles
      if (/_Hover/.test(mat.name)) this.hoverMats = [...(this.hoverMats || []), m.material];
      if (ION_RE.test(mat.name)) {
        this.reactorMats.push(m.material);
        this.ionGeos.push(geo);
        if (m.material.emissive) this.ionColor.copy(m.material.emissive);
      }
      model.add(m);
      this.meshes.push(m);
    }
  }

  analyse() {
    const box = new THREE.Box3().setFromObject(this.model);
    this.size = box.getSize(new THREE.Vector3());
    this.bottom = box.min.y - this.model.getWorldPosition(_v).y;
    this.length = this.size.z;
    this.halfWidthGeo = this.size.x / 2;

    // Toberas: discos de material Ion. Si hay hueco en x = 0 → dos toberas; si no, una central.
    const pts = [];
    for (const g of this.ionGeos) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i));
    }
    this.nozzles = [];
    const cluster = (arr) => {
      const c = new THREE.Vector3(); let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
      for (const p of arr) { c.add(p); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); minZ = Math.min(minZ, p.z); }
      c.divideScalar(arr.length); c.z = minZ;
      return { pos: c, r: Math.max(0.08, Math.max(maxX - minX, maxY - minY) / 2) };
    };
    if (pts.length) {
      // grupos de vértices próximos (≤ 0,1 m) = una tobera cada uno; admite 1, 2 o más motores
      const par = pts.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[i].distanceToSquared(pts[j]) < 0.1 * 0.1) par[find(i)] = find(j);
      const groups = new Map(); pts.forEach((p, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
      for (const g of groups.values()) if (g.length >= 3) this.nozzles.push(cluster(g));
      if (!this.nozzles.length) this.nozzles.push(cluster(pts));
      for (const n of this.nozzles) n.r = Math.min(n.r, 0.38);
    } else {
      this.nozzles.push({ pos: new THREE.Vector3(0, 0.1, -this.length / 2), r: 0.2 });
    }
    // que la llama y el halo nazcan fuera del casco: detrás del punto más retrasado del casco a la altura de cada tobera
    for (const n of this.nozzles) {
      let zMin = n.pos.z;
      for (const m of this.meshes) {
        const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - n.pos.x) < n.r + 0.12 && Math.abs(p.getY(i) - n.pos.y) < n.r + 0.12) zMin = Math.min(zMin, p.getZ(i));
      }
      n.pos.z = zMin - 0.04;
    }

    // Puntas de ala: vértices extremos en x (para las estelas)
    let maxP = null, minP = null;
    for (const m of this.meshes) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        if (!maxP || x > maxP.x) maxP = new THREE.Vector3().fromBufferAttribute(p, i);
        if (!minP || x < minP.x) minP = new THREE.Vector3().fromBufferAttribute(p, i);
      }
    }
    this.tips = [maxP, minP];

    // Puntos bajos del casco (mín. y por franjas en x y en z): para que alas y morro no atraviesen el tablero
    const NB = 20, bx = new Map(), bz = new Map();
    const mn = new THREE.Box3(); for (const m of this.meshes) { m.geometry.computeBoundingBox(); mn.union(m.geometry.boundingBox); }
    for (const m of this.meshes) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const ix = Math.floor((x - mn.min.x) / (mn.max.x - mn.min.x + 1e-6) * NB), iz = Math.floor((z - mn.min.z) / (mn.max.z - mn.min.z + 1e-6) * NB);
        if (!bx.has(ix) || y < bx.get(ix).y) bx.set(ix, new THREE.Vector3(x, y, z));
        if (!bz.has(iz) || y < bz.get(iz).y) bz.set(iz, new THREE.Vector3(x, y, z));
      }
    }
    this.lowPts = [...bx.values(), ...bz.values(), maxP, minP];
  }

  buildExhaust() {
    // Por tobera: núcleo blanco-caliente con diamantes de choque + penacho exterior del color de la escudería + halo
    const geo = new THREE.ConeGeometry(1, 1, 24, 1, true);
    geo.translate(0, -0.5, 0);
    geo.rotateX(-Math.PI / 2); // punta hacia -Z (atrás)
    const hot = this.ionColor.clone();
    const mx = Math.max(hot.r, hot.g, hot.b, 1e-3); hot.multiplyScalar(1 / mx);
    this.flame = hot;
    const mk = (outer) => new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: { uPower: { value: 0 }, uTime: { value: Math.random() * 10 }, uBoost: { value: 0 }, uHot: { value: hot }, uOuter: { value: outer ? 1 : 0 } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){ vL = -position.z; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uPower, uTime, uBoost, uOuter; uniform vec3 uHot; varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){
          #include <logdepthbuf_fragment>
          float facing = abs(dot(normalize(vN), vV));
          float L = clamp(vL, 0.0, 1.0);
          float flick = 0.85 + 0.15 * sin(uTime * 57.0 + vL * 23.0) * sin(uTime * 31.0);
          vec3 c;
          if (uOuter > 0.5) {
            float body = pow(facing, 0.9) * pow(1.0 - L, 1.3);
            float tongue = smoothstep(0.0, 0.15, L) * (0.6 + 0.4 * sin(vL * 9.0 - uTime * 24.0));
            c = uHot * body * (0.55 + 0.45 * tongue) * 1.15;
          } else {
            float core = pow(facing, 1.8) * pow(1.0 - L, 2.2);
            float diamonds = 0.65 + 0.35 * pow(abs(sin(L * 16.0 - uTime * 3.0)), 3.0);
            c = mix(uHot, vec3(1.0, 0.97, 0.92), (1.0 - L) * 0.6) * core * diamonds * 2.4;
          }
          c = mix(c, c * 1.5 + uHot * 0.2, uBoost);
          gl_FragColor = vec4(c * flick * uPower, 1.0);
        }`,
    });
    this.exhaustMat = mk(false);
    this.plumeMat = mk(true);
    const halo = document.createElement('canvas'); halo.width = halo.height = 64;
    const hg = halo.getContext('2d'); const gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
    this.haloMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), color: hot.clone().multiplyScalar(1.1), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
    this.exhausts = []; this.plumes = []; this.halos = [];
    for (const n of this.nozzles) {
      const core = new THREE.Mesh(geo, this.exhaustMat); core.position.copy(n.pos); core.userData.r = n.r; core.frustumCulled = false;
      const plume = new THREE.Mesh(geo, this.plumeMat); plume.position.copy(n.pos); plume.userData.r = n.r; plume.frustumCulled = false; plume.renderOrder = 2;
      const h = new THREE.Sprite(this.haloMat); h.position.copy(n.pos).add(new THREE.Vector3(0, 0, -0.05)); h.userData.r = n.r;
      this.model.add(core, plume, h);
      this.exhausts.push(core); this.plumes.push(plume); this.halos.push(h);
    }
    // Solo la nave del jugador lleva luz puntual (cada luz extra encarece todos los materiales).
    if (this.player) this.addEngineLight();
  }

  addEngineLight() {
    if (this.engineLight) return;
    this.engineLight = new THREE.PointLight(this.ionColor.clone(), 0, 14, 2);
    this.engineLight.position.set(0, 0.3, this.nozzles[0].pos.z - 0.6);
    this.model.add(this.engineLight);
  }
  removeEngineLight() {
    if (!this.engineLight) return;
    this.model.remove(this.engineLight); this.engineLight.dispose?.(); this.engineLight = null;
  }

  reset(s, x = 0) {
    this.s = this.track.wrap(s);
    this.x = x; this.psi = 0; this.phi = 0; this.v = 0; this.omega = 0;
    this.h = this.C.hover; this.hv = 0;
    this.roll = 0; this.pitch = 0; this.yawVis = 0;
    this.boost = 1; this.boosting = false; this.boostKick = 0;
    this.throttle = 0; this.accel = 0;
    this.distance = 0;
    this.wallHit = 0; this.scraping = 0; this.bump = 0;
    this.ammo = 0; this.spin = 0; this.stun = 0; this.qtRec = 0; this.lift = 0; this.kv = 0; this.susp = 0; this.suspV = 0; this.wasAir = false; this.landEvent = 0;
    this.qt = 0; this.qtDir = 0; this.qtCool = 0; this.power = 0.2;
    this.hull = this.maxHull; this.dead = 0; this.invuln = 0; this.draft = 0;
    this.out = false; this.outAt = 0; this.deckScrape = 0; this.scrapeT = 0;
    this.root.visible = true;
    if (this.dmgMats) this.setDamage();
    this.t = Math.random() * 5;
    this.updateTransform();
  }

  // input: {throttle, brake, steer(-1..1, + = derecha), abL, abR, boost}
  update(dt, input, locked = false) {
    const C = this.C;
    this.t += dt;
    // eliminada: restos que se arrastran hasta pararse y quedan tendidos en la pista
    if (this.out) { this.wreckUpdate(dt); return; }
    if (this.invuln > 0) { this.invuln = Math.max(0, this.invuln - dt); this.model.visible = this.invuln === 0 || Math.floor(this.invuln * 12) % 2 === 0; }
    const tr = this.track;
    tr.sample(this.s, this.frame);
    const k = this.frame.kappa;
    const vPrev = this.v;

    this.stun = Math.max(0, this.stun - dt);
    const ctl = locked || this.stun > 0;
    const thr = ctl ? 0 : input.throttle;
    const brk = ctl ? 0 : input.brake;
    const abL = ctl ? 0 : input.abL, abR = ctl ? 0 : input.abR;
    const ab = Math.max(abL, abR);
    this.throttle += (thr - this.throttle) * Math.min(1, dt * 6);

    // Boost
    this.boosting = !ctl && input.boost && this.boost > 0.02 && thr > 0.1;
    if (this.boosting) this.boost = Math.max(0, this.boost - C.boostDrain * dt);
    else this.boost = Math.min(1, this.boost + C.boostRegen * dt);
    this.boostKick = Math.max(0, this.boostKick - dt);
    const boostOn = this.boosting || this.boostKick > 0;
    const dr = CONFIG.draft;
    const vmax = (boostOn ? C.vmaxBoost : C.vmax) * (1 + dr.vmax * this.draft) * (1 - 0.1 * this.dmg);   // tocada: pierde punta

    // Velocidad longitudinal
    let a = thr * C.accel * (1 + dr.accel * this.draft) * Math.max(0, 1 - this.v / vmax) * (1 + (boostOn ? C.boostAccel / C.accel : 0));
    if (this.v > vmax) a -= (this.v - vmax) * 0.8;
    a -= brk * C.brake;
    a -= (thr < 0.05 ? C.coastDrag : 0.01) * this.v;
    a -= ab * C.airbrakeDrag * this.v;
    a -= this.frame.tan.y * 9.81 * 0.5;      // la pendiente cuenta: se gana en bajada, se pierde en subida
    this.v = locked ? 0 : Math.max(0, this.v + a * dt);
    this.accel = (this.v - vPrev) / Math.max(dt, 1e-4);

    // Giro asistido (doble toque): ~0,45 s de trazada cerrada que lee la curva, sin tirón.
    // Después, 0,4 s de recuperación que endereza la nave para no cruzarse al muro contrario.
    this.qtCool = Math.max(0, this.qtCool - dt);
    const wasQt = this.qt > 0;
    this.qt = Math.max(0, this.qt - dt);
    if (wasQt && this.qt === 0) this.qtRec = 0.4;
    this.qtRec = Math.max(0, (this.qtRec || 0) - dt);
    if (input.quick && !ctl && this.qtCool <= 0 && this.v > 15) {
      this.qt = QT; this.qtRec = 0; this.qtDir = input.quick; this.qtCool = 0.8;
      this.v *= 0.996;
      this.quickEvent = true;
    }

    // Giro
    const sp = Math.min(1, this.v / C.vmax);
    const A = this.assist || 0;
    const rate = (C.turnLow + (C.turnHigh - C.turnLow) * sp) * (C.turnMult || 1) * (1 + 0.45 * A * sp);
    const steer = ctl ? 0 : input.steer;
    const moving = Math.min(1, this.v / 8);
    const denom = Math.max(0.35, 1 + k * this.x);
    const sdot = this.v * Math.cos(this.phi) / denom;
    let target = (-steer * rate - abR * C.airbrakeTurn + abL * C.airbrakeTurn) * moving;
    if (A > 0) {
      target += A * 0.75 * k * sdot;                          // la nave "lee" la curva
      if (Math.abs(steer) < 0.1 && ab < 0.1) target -= A * 1.8 * this.psi;   // se realinea sola al soltar
    }
    // Giro brusco = ráfaga de pilotaje asistido: durante ~0,5 s la nave traza sola hacia el lado pedido
    // (lee la curva, apunta a una línea a un 40 % del muro) con más autoridad de giro y agarre que la normal,
    // y devuelve el control suavemente. Así ayuda en la curva sin cruzar la nave al muro contrario.
    const qtOn = this.qt > 0;
    const qtW = qtOn ? Math.min(1, (1 - this.qt / QT) * 5) : this.qtRec > 0 ? this.qtRec / 0.4 : 0;
    if (qtW > 0) {
      const Ld = 16 + this.v * 0.32;
      const half = C.wallAt * tr.wAt(this.s + Ld) - this.halfWidthGeo - 1;
      const xt = this.qtDir * half * 0.4;
      const phiDes = Math.atan2(this.x - xt, Ld);
      tr.sample(this.s + this.v * 0.1, this.frame);
      const kA = this.frame.kappa;
      tr.sample(this.s, this.frame);
      const wDes = THREE.MathUtils.clamp(kA * sdot + 3.2 * (phiDes - this.psi) + 1.6 * (phiDes - this.phi), -3.2, 3.2);
      target += (wDes - target) * qtW;
    }
    // Seguro de muro: si en ~0,55 s va a tocar el guardarraíl, gira hacia dentro (asistencia y giro brusco)
    const guard = Math.max(A * 0.7, qtOn || this.qtRec > 0 ? 1 : 0);
    const limW = C.wallAt * tr.wAt(this.s) - this.halfWidthGeo * 0.85;
    if (guard > 0) {
      const xp = this.x - this.v * Math.sin(this.phi) * 0.55;
      const over = Math.abs(xp) - (limW - 2.2);
      if (over > 0) target += Math.sign(xp) * Math.min(2.4, over * 0.35) * guard;
    }
    this.omega += (target - this.omega) * Math.min(1, dt * (qtOn ? 12 : C.turnResponse));

    // Avance en coordenadas de Frenet
    this.psi += (this.omega - k * sdot) * dt;
    const grip = (ab > 0.1 ? C.gripAirbrake : C.grip) * (qtOn ? 2.2 : this.qtRec > 0 ? 1.6 : 1);
    this.phi += (this.psi - this.phi) * Math.min(1, dt * grip) - k * sdot * dt;
    this.psi = THREE.MathUtils.clamp(this.psi, -1.6, 1.6);
    this.phi = THREE.MathUtils.clamp(this.phi, -1.6, 1.6);
    const ds = sdot * dt;
    this.s = tr.wrap(this.s + ds);
    this.distance += ds;
    this.x += -this.v * Math.sin(this.phi) * dt;

    // Guardarraíles (la pista se ensancha en algunas curvas: wAt)
    this.wallHit = 0;
    this.scraping = Math.max(0, this.scraping - dt * 4);
    const lim = limW;
    if (Math.abs(this.x) > lim) {
      const side = Math.sign(this.x);
      this.x = side * lim;
      const into = Math.abs(Math.sin(this.phi));
      if (into > 0.09) {
        this.wallHit = this.v * into;
        this.v *= 1 - THREE.MathUtils.clamp((0.1 + into * 0.9) * C.wallLoss * (1 - 0.6 * A) / Math.sqrt(C.mass), 0, 0.6);
        this.phi *= A > 0 ? -0.1 : -0.3;
        this.psi *= 0.45;
        this.omega = side * 0.6;
      } else {
        this.scraping = 1;
        this.v *= 1 - (0.55 - 0.25 * A) * dt;
        this.phi *= 0.5;
      }
    }

    // Levitación magnética: el tablero atrae la nave. En los valles la aplasta (se comprime el colchón),
    // en las crestas el imán no alcanza a curvar la trayectoria y la nave se separa y vuelve a caer.
    const w = Math.PI * 2 * C.bobHz;
    const kv = tr.kvAt(this.s);                           // curvatura vertical: < 0 cresta, > 0 valle
    const hMax = CONFIG.hoverMax || 5;
    const lift = THREE.MathUtils.clamp(-kv * this.v * this.v * 0.02, -0.55 * C.hover, hMax - C.hover - 0.4);
    this.lift = lift;
    const hTarget = C.hover + lift + Math.sin(this.t * w) * C.bob + Math.sin(this.t * w * 2.2) * C.bob * 0.35 * sp;
    // muelle no lineal: más duro cerca del tablero (colchón), más blando arriba (imán que tira de vuelta)
    const dh = hTarget - this.h;
    const stiff = (dh > 0 ? 90 : 38 + 22 * Math.min(1, -dh)) / C.mass;
    this.hv += (dh * stiff - this.hv * 8 / Math.sqrt(C.mass)) * dt;
    if (this.wallHit > 4) this.hv += Math.min(3, this.wallHit * 0.05 / C.mass);
    this.h = THREE.MathUtils.clamp(this.h + this.hv * dt, 0.35, hMax);
    this.kv = kv;
    this.bump = Math.max(0, this.bump - dt * 3);

    // Suspensión visual: el colchón magnético se comprime en valles y al aterrizar, y rebota
    const inAir = tr.jumpLift(this.s, this.v) > 0.05;
    if (this.wasAir && !inAir) { const imp = Math.min(7, 2 + this.v * 0.035); this.suspV -= imp; this.landEvent = Math.min(1.2, 0.35 + this.v * 0.004); }
    this.wasAir = inAir;
    const aV = inAir ? 0 : THREE.MathUtils.clamp(kv * this.v * this.v, -60, 60);   // aceleración vertical de la rasante
    const Ks = 70 / C.mass, Ds = 6.5 / Math.sqrt(C.mass);
    this.suspV += (-Ks * this.susp - Ds * this.suspV - aV * 0.4 + (inAir ? Ks * 0.22 : 0)) * dt;
    this.susp = THREE.MathUtils.clamp(this.susp + this.suspV * dt, -0.6, 0.45);

    // Actitud visual
    const rollT = Math.sin(this.t * 17) * this.suspV * 0.012 + (this.dmg > 0.7 ? Math.sin(this.t * 7.3) * 0.06 * this.dmg : 0) - this.omega * C.lean + (abR - abL) * 0.12 * sp + (qtOn ? this.qtDir * 0.4 : 0);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5 / Math.sqrt(C.mass));
    const pitchT = -THREE.MathUtils.clamp(this.accel * 0.0025 * C.pitchK, -0.09, 0.09) + this.hv * 0.02
      + THREE.MathUtils.clamp(-kv * this.v * 0.3, -0.07, 0.07)
      + THREE.MathUtils.clamp(-this.suspV * 0.018, -0.08, 0.08);   // morro arriba en el valle, abajo en la cresta
    this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 3);
    this.yawVis += ((this.psi - this.phi) * C.driftYaw - this.yawVis) * Math.min(1, dt * 6);
    this.spin = Math.max(0, this.spin - dt * 0.9);

    if (this.deckScrape > 0.03) { this.v *= 1 - Math.min(0.12, this.deckScrape * 0.3) * dt; this.scrapeT += dt; }
    else this.scrapeT = Math.max(0, this.scrapeT - dt * 2);
    this.updateEngine(dt, locked ? 0.25 + input.throttle * 0.5 : 0.2 + this.throttle * 0.8 + (boostOn ? 0.5 : 0), boostOn);
    this.updateTransform();
  }

  updateEngine(dt, power, boostOn = false) {
    const u = this.exhaustMat.uniforms;
    u.uPower.value = power;
    u.uTime.value = this.t;
    u.uBoost.value += ((boostOn ? 1 : 0) - u.uBoost.value) * Math.min(1, dt * 6);
    this.power = power;
    const p2 = this.plumeMat.uniforms;
    p2.uPower.value = power; p2.uTime.value = this.t; p2.uBoost.value = u.uBoost.value;
    const len = 0.5 + power * 1.3 + (boostOn ? 1.0 : 0);
    const flick = 0.92 + Math.random() * 0.16;
    for (const e of this.exhausts) { const r = e.userData.r * (0.85 + power * 0.25); e.scale.set(r, r, len); }
    for (const e of this.plumes) { const r = e.userData.r * (1.35 + power * 0.45 + u.uBoost.value * 0.3); e.scale.set(r, r, len * (1.9 + u.uBoost.value * 0.8) * flick); }
    for (const h of this.halos) { const r = h.userData.r * (1.7 + power * 1.5 + u.uBoost.value * 1.2) * flick; h.scale.set(r, r, 1); }
    this.haloMat.opacity = Math.min(0.7, 0.2 + power * 0.4);
    for (const m of this.reactorMats) m.emissiveIntensity = 1.6 + power * 2.6;
    if (this.engineLight) this.engineLight.intensity = 0.8 + power * 4;
  }

  updateTransform() {
    const F = this.track.sample(this.s, this.frame);
    const c = Math.cos(this.psi), sn = Math.sin(this.psi);
    this.fwd.copy(F.tan).multiplyScalar(c).addScaledVector(F.right, -sn).normalize();
    this.upv.copy(F.up);
    const left = _v.crossVectors(this.upv, this.fwd).normalize();
    _m.makeBasis(left, this.upv, this.fwd);
    this.root.quaternion.setFromRotationMatrix(_m);
    this.root.position.copy(F.pos).addScaledVector(F.right, this.x).addScaledVector(F.up, this.h - this.bottom + this.track.jumpLift(this.s, this.v));
    const sp = this.spin > 0 ? (1 - this.spin) : 0;
    const spinYaw = this.spin > 0 ? Math.PI * 2 * (1 - Math.pow(1 - sp, 2)) : 0;
    _e.set(this.pitch + Math.sin(sp * 20) * this.spin * 0.25, this.yawVis + spinYaw, this.roll + Math.sin(sp * 14) * this.spin * 0.6, 'YXZ');
    this.body.quaternion.setFromEuler(_e);
    this.body.position.y = this.susp || 0;
    // holgura: el punto más bajo del casco (ya inclinado) nunca baja del tablero; si lo intenta, roza
    if (this.lowPts) {
      const me = _m.makeRotationFromQuaternion(this.body.quaternion).elements, sc = CONFIG.shipScale || 1;
      let low = Infinity, lp = null;
      for (const p of this.lowPts) { const y = (me[1] * p.x + me[5] * p.y + me[9] * p.z) * sc; if (y < low) { low = y; lp = p; } }
      const base = this.h - this.bottom + (this.out ? 0 : this.track.jumpLift(this.s, this.v)) + this.body.position.y;
      const extra = Math.max(0, (this.out ? 0.02 : 0.1) - (base + low));
      this.deckScrape = this.out ? 0 : extra; this.scrapePt = lp;
      if (extra > 0) this.root.position.addScaledVector(F.up, extra);
    }
    const cp = Math.cos(this.phi), sphi = Math.sin(this.phi);
    this.velocity.copy(F.tan).multiplyScalar(cp).addScaledVector(F.right, -sphi).multiplyScalar(this.v);
  }

  // Impacto de cohete: frenazo, trompo y un instante sin control. Devuelve 'hit' | 'destroyed' | null
  hit() {
    if (this.out || this.invuln > 0) return null;
    this.hull -= 1;
    if (this.hull <= 0) {                                 // eliminada: sin reconstrucción
      this.hull = 0; this.out = true; this.dead = 1e9; this.outAt = this.t;
      this.boost = 0; this.ammo = 0; this.boosting = false; this.boostKick = 0; this.draft = 0;
      this.v *= 0.55; this.spin = 1; this.hv += 4 / this.C.mass;
      this.wreckRoll = (Math.random() < 0.5 ? -1 : 1) * (0.32 + Math.random() * 0.2);
      this.setDamage();
      return 'destroyed';
    }
    this.setDamage();
    this.v *= 0.38;
    this.spin = 1; this.stun = 0.7;
    this.hv += 3.5 / this.C.mass;
    this.boostKick = 0; this.boosting = false;
    return 'hit';
  }

  // 0 = intacta … 1 = último impacto antes de quedar fuera
  setDamage() {
    this.dmg = this.out ? 1 : (this.maxHull - this.hull) / Math.max(1, this.maxHull - 1);
    const k = this.out ? 0.22 : 1 - 0.28 * this.dmg;
    for (const d of this.dmgMats) { d.m.color.copy(d.c).multiplyScalar(k); if (d.m.roughness !== undefined) d.m.roughness = Math.min(1, d.r + 0.35 * this.dmg); }
    const on = !this.out;
    for (const e of [...this.exhausts, ...this.plumes, ...this.halos]) e.visible = on;
    for (const m of this.reactorMats) m.emissiveIntensity = on ? 1.6 : 0.05;
    if (this.engineLight) this.engineLight.visible = on;
  }

  wreckUpdate(dt) {
    const tr = this.track;
    tr.sample(this.s, this.frame);
    this.v = Math.max(0, this.v * Math.exp(-1.4 * dt) - 9 * dt);
    const ds = this.v * Math.cos(this.phi) * dt;
    this.s = tr.wrap(this.s + ds);
    this.x += -this.v * Math.sin(this.phi) * dt;
    const lim = this.C.wallAt * tr.wAt(this.s) - this.halfWidthGeo * 0.85;
    if (Math.abs(this.x) > lim) { this.x = Math.sign(this.x) * lim; this.phi *= -0.3; this.v *= 0.7; }
    const rest = 0.05;                                   // tendida sobre el tablero
    this.h += (rest - this.h) * Math.min(1, dt * 2.5); this.hv = 0;
    this.susp *= Math.exp(-3 * dt); this.suspV = 0;
    this.roll += (this.wreckRoll - this.roll) * Math.min(1, dt * 2);
    this.pitch += (0.1 - this.pitch) * Math.min(1, dt * 2);
    this.spin = Math.max(0, this.spin - dt * 0.6);
    this.power = 0; this.throttle = 0;
    this.updateTransform();
  }

  respawn() {
    const R = CONFIG.respawn;
    this.s = this.track.wrap(this.s - R.back);
    this.x = 0; this.psi = 0; this.phi = 0; this.omega = 0; this.v = 45;
    this.hull = this.maxHull; this.invuln = R.invuln; this.dead = 0;
    this.root.visible = true; this.spin = 0; this.stun = 0; this.h = this.C.hover;
    if (this.race) this.race.prevS = this.s;             // no cuenta como cruce de meta
    this.respawned = true;
  }

  // Esfera verde: carga de boost + empujón inmediato
  boostPad() {
    this.boost = Math.min(1, this.boost + 0.45);
    this.boostKick = Math.max(this.boostKick, 0.9 * (this.C.kick || 1));
  }

  worldPoint(local, out) { return out.copy(local).applyMatrix4(this.model.matrixWorld); }

  get kmh() { return this.v * 3.6; }
}
