// Cámaras: persecución con muelle, morro, lejana. El offset se suaviza en el marco de la nave,
// así la cámara no se queda atrás a 500 km/h pero sí "respira" en las curvas.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const CC = CONFIG.camera;
const WORLD_UP = new THREE.Vector3(0, 1, 0), _t2 = new THREE.Vector3();
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

export const CAM_MODES = [
  { id: 'chase', label: 'Cámara · persecución' },
  { id: 'close', label: 'Cámara · cercana' },
  { id: 'far', label: 'Cámara · lejana' },
  { id: 'nose', label: 'Cámara · morro' },
];

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.mode = 0;
    this.dir = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
    this.roll = 0;
    this.pull = 0;
    this.fov = CC.fovBase;
    this.t = 0;
  }
  cycle() { this.mode = (this.mode + 1) % CAM_MODES.length; return CAM_MODES[this.mode]; }
  snap(ship) { this.dir.copy(ship.fwd); this.up.copy(ship.upv); this.update(ship, 0.016, true); }
  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  // Posición/objetivo deseados (se usa también para empalmar el final de la intro)
  pose(ship, outPos, outLook, dir = this.dir, up = this.up) {
    const m = CAM_MODES[this.mode].id;
    const sp = ship.v;
    if (m === 'nose') {
      outPos.copy(ship.root.position).addScaledVector(ship.upv, ship.size.y * 0.9).addScaledVector(ship.fwd, ship.length * 0.2);
      outLook.copy(outPos).addScaledVector(ship.fwd, 30).addScaledVector(ship.upv, 0.2);
      return;
    }
    const far = m === 'far', close = m === 'close';
    // cercana: pegada al casco, en tercera persona (≈ 3 m detrás de la cola, a la altura de la cabina)
    const dist = close ? ship.length * 0.5 + 3.2 + sp * 0.006 + this.pull * 0.5
      : (far ? 20 : CC.dist) + sp * CC.distSpeed + this.pull;
    const height = close ? ship.size.y * 1.15 + 0.5 : (far ? 6.8 : CC.height) + sp * 0.004;
    outPos.copy(ship.root.position).addScaledVector(dir, -dist).addScaledVector(up, height);
    outLook.copy(ship.root.position).addScaledVector(dir, close ? 12 : CC.lookAhead).addScaledVector(up, close ? ship.size.y * 0.8 : 0.9);
  }

  update(ship, dt, instant = false) {
    this.t += dt;
    const kYaw = instant ? 1 : 1 - Math.exp(-dt * CC.followYaw);
    const kUp = instant ? 1 : 1 - Math.exp(-dt * CC.followUp);
    // mezcla morro + dirección real (el derrape se ve)
    _t.copy(ship.fwd).multiplyScalar(0.65);
    if (ship.v > 1) _t.addScaledVector(_v.copy(ship.velocity).normalize(), 0.35);
    _t.normalize();
    this.dir.lerp(_t, kYaw).normalize();
    this.up.lerp(_t2.copy(ship.upv).lerp(WORLD_UP, 0.45).normalize(), kUp).normalize();
    // tirón de aceleración
    const pullT = THREE.MathUtils.clamp(ship.accel * 0.035, -0.6, 1.8) + (ship.boosting ? 1.4 : 0);
    this.pull += (pullT - this.pull) * (1 - Math.exp(-dt * 2.5));

    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    this.pose(ship, pos, look);

    // sacudida
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const spd = Math.min(1, ship.v / CONFIG.ship.vmax);
    const amp = this.shake * 0.35 + spd * spd * 0.025 + (ship.scraping ? 0.05 : 0);
    const n = (a) => Math.sin(this.t * a) * Math.sin(this.t * a * 0.37 + 1.3);
    pos.x += n(37) * amp; pos.y += n(43) * amp; pos.z += n(31) * amp;

    this.cam.position.copy(pos);
    const rollT = CAM_MODES[this.mode].id === 'nose' ? ship.roll * 0.9 : ship.roll * CC.roll;
    this.roll += (rollT - this.roll) * (instant ? 1 : 1 - Math.exp(-dt * 5));
    _v.copy(this.up).applyAxisAngle(_t.subVectors(look, pos).normalize(), -this.roll);
    this.cam.up.copy(_v);
    this.cam.lookAt(look);

    const fovT = CC.fovBase + spd * CC.fovSpeed + (ship.boosting || ship.boostKick > 0 ? CC.fovBoost : 0);
    this.fov += (fovT - this.fov) * (instant ? 1 : 1 - Math.exp(-dt * 3));
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
  }
}

// ── Vuelo de águila: planeo desde los monolitos hasta la parrilla ──
export class EagleFlight {
  constructor(camera, track, ship, chase, introKeys = null) {
    this.cam = camera; this.track = track; this.ship = ship; this.chase = chase; this.introKeys = introKeys;
    this.build();
    this.t = 0;
    this.roll = 0;
    this.done = false;
  }

  build() {
    const tr = this.track, sh = this.ship;
    const F = tr.frame();
    const G = sh.root.position.clone();
    const fwd = sh.fwd.clone(), up = sh.upv.clone();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const at = (s, lat, h) => { tr.sample(sh.s + s, F); return F.pos.clone().addScaledVector(F.right, lat).addScaledVector(F.up, h); };
    const rel = (f, r, u) => G.clone().addScaledVector(fwd, f).addScaledVector(right, r).addScaledVector(up, u);

    // chase final
    const endPos = new THREE.Vector3(), endLook = new THREE.Vector3();
    this.chase.dir.copy(fwd); this.chase.up.copy(up);
    this.chase.pose(sh, endPos, endLook, fwd, up);

    // [tiempo, posición, objetivo, fov]
    // tramo inicial propio de cada circuito (o el de SATURN-6: monolitos y cohete)
    const head = this.introKeys ? this.introKeys(at) : [
      [0.0, new THREE.Vector3(-640, -12, -380), new THREE.Vector3(-862, 62, -1000), 50],
      [4.2, new THREE.Vector3(-676, 22, -468), new THREE.Vector3(-840, 215, -1000), 50],
      [7.4, new THREE.Vector3(-650, 150, -520), new THREE.Vector3(-806, 330, -949), 52],
      [9.5, new THREE.Vector3(-575, 245, -430), new THREE.Vector3(-160, 140, -640), 60],
    ];
    this.keys = [
      ...head,
      [11.8, at(-520, -40, 95), at(-330, 0, 12), 60],
      [14.6, at(-230, 26, 34), at(-20, 0, 2), 62],
      [16.8, rel(-42, 9, 8), rel(8, 0, 0.6), 58],
      [18.6, rel(13, 9.5, 1.8), rel(0, 0, 0.5), 48],
      [19.9, rel(-1, 11, 2.6), rel(0.5, 0, 0.5), 54],
      [21.4, endPos, endLook, CONFIG.camera.fovBase],
    ];
    this.duration = this.keys[this.keys.length - 1][0];
    this.posCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k[1]), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(this.keys.map((k) => k[2]), false, 'centripetal');
  }

  // tiempo → parámetro de curva (lineal por tramos entre claves, con suavizado en los extremos)
  u(t) {
    const K = this.keys; const n = K.length - 1;
    t = THREE.MathUtils.clamp(t, 0, this.duration);
    let i = 0; while (i < n - 1 && t > K[i + 1][0]) i++;
    const a = K[i][0], b = K[i + 1][0];
    let f = (t - a) / (b - a);
    if (i === 0) f = f * f * (3 - 2 * f) * 0.5 + f * 0.5;   // arranque suave
    if (i === n - 1) f = 1 - Math.pow(1 - f, 2);            // llegada suave
    return { u: (i + f) / n, i, f };
  }

  update(dt) {
    this.t += dt * CONFIG.introSpeed;
    const { u, i, f } = this.u(this.t);
    const p = this.posCurve.getPoint(u), l = this.lookCurve.getPoint(u);
    // alabeo de águila a partir de la aceleración lateral de la trayectoria
    const e = 0.004;
    const p0 = this.posCurve.getPoint(Math.max(0, u - e)), p1 = this.posCurve.getPoint(Math.min(1, u + e));
    const v1 = p.clone().sub(p0), v2 = p1.clone().sub(p);
    const turn = v1.x * v2.z - v1.z * v2.x;
    const len = v1.length() * v2.length() + 1e-6;
    const rollT = THREE.MathUtils.clamp(-turn / len * 9, -0.32, 0.32) * (this.t < this.duration - 2.5 ? 1 : 0);
    this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * 2));
    this.cam.position.copy(p);
    const dir = l.clone().sub(p).normalize();
    this.cam.up.set(0, 1, 0).applyAxisAngle(dir, this.roll);
    this.cam.lookAt(l);
    const K = this.keys;
    const fov = K[i][3] + (K[i + 1][3] - K[i][3]) * f;
    this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
    if (this.t >= this.duration) this.done = true;
    return this.t;
  }
}
