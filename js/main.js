// ─────────────────────────────────────────────────────────────
//  SPEED RACING SKIES · SATURN-6 · prototipo 02
//  Estados: loading → title → select (hangar) → intro (vuelo de águila) → countdown → race → finished
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';

import { CONFIG } from './config.js';
import { installFogChunks, applyAtmosphere, skyUniforms, createSky, createMoonMaterial, lavaMaterial, lavaUniforms, basaltMaterial, createWater, buildEnvironment } from './atmosphere.js';
import { terrainMaterial, seaMaterial, facadeMaterial, paintedMaterial, plantTrees } from './landscape.js';
import { CIRCUITS, circuitById } from './circuits.js';
import { Track, normName } from './track.js';
import { Ship } from './ship.js';
import { ChaseCamera, EagleFlight, CAM_MODES } from './camera.js';
import { Trails, Motes, Sparks, Rockets, IonTrail, EngineTrails, DamageFx } from './fx.js';
import { HUD, fmt } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { TouchControls, IS_TOUCH } from './touch.js';
import { FLEET, DEFAULT_SHIP, statsFor, traits } from './fleet.js';
import { Flyers } from './flyers.js';
import { AIDriver, resolveCollisions } from './ai.js';
import { Showroom } from './showroom.js';
import { Pickups, Missiles } from './pickups.js';
import { buildStructures } from './structures.js';
import { buildMars, marsSunDir } from './mars.js';
import { buildItaka } from './itaka.js';
import { buildTharsis, tharsisSunDir } from './tharsis.js';
import { buildCassini, cassiniSunDir } from './cassini.js';
import { buildTiphares, tipharesSunDir } from './tiphares.js';
import { buildEuropa, europaSunDir } from './europa.js';
import { buildMiranda, mirandaSunDir } from './miranda.js';
import { buildDeckDetail } from './deckdetail.js';
import { trackUniforms, setPaint, FOLLOWS_TRACK, deformGeometry, deckMaterial, guardMaterial, reflectorMaterial, amberGuideMaterial } from './dressing.js';

installFogChunks();

// ── Renderer / escena ──
const canvas = document.getElementById('view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
} catch (e) {
  window.__srsFail?.('Este visor no permite gráficos 3D (WebGL). Ábrelo en Chrome, Safari o Firefox, desde una web o el enlace del juego.');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.5));   // arranca prudente; la resolución adaptativa sube a 2 si sobra
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.info.autoReset = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.atmosphere.exposure;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcccccc, CONFIG.atmosphere.baseDensity);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.25, 30000);
scene.add(createSky());
scene.environmentIntensity = 0.85;

const sun = new THREE.DirectionalLight(0xffdcb4, 2.5);
sun.position.copy(CONFIG.atmosphere.sunDir).multiplyScalar(300);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 900 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xd8cbb6, 0x241d18, 0.6);
scene.add(hemi);

// ── Post-proceso: bloom → tone mapping → grading (monocromo con rojo preservado, grano, viñeta) ──
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
// Oclusión ambiental en pantalla (N8AO, compatible con el búfer de profundidad logarítmico):
// contacto de naves con el tablero, juntas, cuadernas y pliegues del relieve. A media resolución.
const aoPass = new N8AOPass(scene, camera, innerWidth, innerHeight);
Object.assign(aoPass.configuration, { aoRadius: 4, distanceFalloff: 1.2, intensity: 3.4, gammaCorrection: false, halfRes: true, denoiseRadius: 10 });
aoPass.setQualityMode(IS_TOUCH ? 'Performance' : 'Low');
Object.assign(aoPass.configuration, { halfRes: true });
composer.addPass(aoPass);
let aoOn = !IS_TOUCH;
// qué escena va al compositor (circuito con AO, o el hangar sin ella)
function setView(sc, cam) {
  renderPass.scene = aoPass.scene = sc; renderPass.camera = aoPass.camera = cam;
  aoPass.enabled = aoOn && sc === scene; renderPass.enabled = !aoPass.enabled;
}
setView(scene, camera);
const B = CONFIG.atmosphere.bloom;
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), B.strength, B.radius, B.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uSat: { value: CONFIG.atmosphere.saturation },
    uVignette: { value: 0.42 }, uGrain: { value: 0.045 }, uAberr: { value: 0.0 }, uBlur: { value: 0.0 },
    uTint: { value: new THREE.Vector3(1.045, 1.0, 0.925) }, uContrast: { value: 0.22 }, uRedKeep: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uSat, uVignette, uGrain, uAberr, uBlur, uContrast, uRedKeep; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 dc = vUv - 0.5;
      float ab = uAberr * dot(dc, dc);
      vec3 c = vec3(texture2D(tDiffuse, vUv - dc * ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + dc * ab).b);
      if (uBlur > 0.001) {
        vec3 acc = c;
        for (int i = 1; i < 7; i++) acc += texture2D(tDiffuse, vUv - dc * uBlur * float(i) * 0.01).rgb;
        c = mix(c, acc / 7.0, smoothstep(0.05, 0.45, length(dc)));
      }
      float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // monocromo cálido, pero los colores intensos (luces, esferas, bermellón) se conservan
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      float chroma = (mx - mn) / max(mx, 0.05);
      float vivid = smoothstep(0.35, 0.75, chroma) * smoothstep(0.06, 0.25, mx);
      float red = smoothstep(0.06, 0.3, c.r - max(c.g, c.b));
      float s = mix(uSat, 1.0, max(red * uRedKeep, vivid * mix(0.5, 1.0, uRedKeep)));
      c = mix(vec3(L), c, s);
      c *= uTint;
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      c = c * 0.965 + 0.014;
      float v = smoothstep(0.9, 0.25, length(dc * vec2(1.0, 0.85)));
      c *= mix(1.0 - uVignette, 1.0, v);
      c += (hash(vUv * vec2(1731.0, 977.0) + fract(uTime) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
// suavizado de bordes al final (el lienzo va sin antialias nativo por el posproceso)
const smaa = new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
composer.addPass(smaa);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ── Estado global ──
const input = new Input();
input.touch = new TouchControls(input);
document.querySelectorAll('.panel [data-key]').forEach((b) => b.addEventListener('click', () => input.pressed.add(b.dataset.key)));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['countdown', 'race'].includes(G.state) && !G.paused) input.pressed.add('KeyP');
});
const audio = new Audio();
const G = { state: 'loading', track: null, ship: null, ships: [], ai: new Map(), chase: null, intro: null, hud: null, fx: {}, race: null, paused: false, time: 0, choice: DEFAULT_SHIP };
window.__srs = G; // gancho de depuración

// ── Circuitos y campeonato: ARCADIA-2 se desbloquea al terminar SATURN-6 ──
const POINTS = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];
{
  const url = new URLSearchParams(location.search).get('circuit');
  G.unlocked = new Set(['saturn']);
  try { JSON.parse(localStorage.getItem('srs-unlocked') || '[]').forEach((k) => G.unlocked.add(k)); } catch (e) { /* sin almacenamiento */ }
  if (url && circuitById(url).id === url) G.unlocked.add(url);
  G.circuitId = url && G.unlocked.has(url) ? url : 'saturn';
  G.pick = G.circuitId;
  G.cup = null;          // { round, results: [Map(nombre → puntos)] }
}
function unlock(id) {
  G.unlocked.add(id);
  try { localStorage.setItem('srs-unlocked', JSON.stringify([...G.unlocked])); } catch (e) { /* sin almacenamiento */ }
  renderCircuitChips();
}
function nextCircuit() {
  const i = CIRCUITS.findIndex((c) => c.id === G.circuitId);
  return CIRCUITS[i + 1] || null;
}


// ── Carga de modelos ──
const prog = document.getElementById('prog');
const startBtn = document.getElementById('startBtn');
const status = (t) => { startBtn.textContent = t; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function b64ToBytes(b64) {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gunzip(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede descomprimir el modelo (actualízalo)');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Texturas del GLB → data: URI. Algunos visores (vista previa de archivos) bloquean imágenes blob:,
// que es como three.js carga las texturas incrustadas; data: se acepta en todos.
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function inlineImages(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return bytes;
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  if (!json.images || !json.images.some((im) => im.bufferView !== undefined)) return bytes;
  const binStart = 20 + jsonLen + 8;
  for (const im of json.images) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView], o = binStart + (bv.byteOffset || 0);
    im.uri = `data:${im.mimeType || 'image/png'};base64,${b64(bytes.subarray(o, o + bv.byteLength))}`;
    delete im.bufferView; delete im.mimeType;
  }
  let js = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (js.length % 4)) % 4;
  if (pad) { const t = new Uint8Array(js.length + pad); t.set(js); t.fill(0x20, js.length); js = t; }
  const rest = bytes.subarray(20 + jsonLen);
  const out = new Uint8Array(20 + js.length + rest.length);
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, out.length, true);
  o.setUint32(12, js.length, true); o.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20); out.set(rest, 20 + js.length);
  return out;
}

async function parseGLB(bytes) {
  bytes = inlineImages(bytes);
  // Texturas vía <img> (blob:) en lugar de fetch+createImageBitmap: más compatible con visores restringidos.
  const cib = window.createImageBitmap;
  try { window.createImageBitmap = undefined; } catch (e) { /* noop */ }
  const p = new GLTFLoader().parseAsync(bytes.buffer, '');
  try { window.createImageBitmap = cib; } catch (e) { /* noop */ }
  return p;
}

// src = { inline: id del <script> con gzip+base64, url: .glb para desarrollo local }
async function loadModel(src, label, p0, p1) {
  let bytes;
  const el = document.getElementById(src.inline);
  status(`${label}…`); prog.style.width = `${p0}%`; await nextFrame();
  if (el) bytes = await gunzip(b64ToBytes(el.textContent));
  else {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`${src.url}: ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  const gltf = await parseGLB(bytes);
  prog.style.width = `${p1}%`;
  return gltf;
}

(async () => {
  const circuit = await loadModel(CONFIG.models.circuit, 'Cargando circuito', 10, 45);
  const fleet = await loadModel(CONFIG.models.fleet, 'Cargando flota', 50, 70);
  status('Construyendo circuito…'); await nextFrame();
  onLoaded(circuit, fleet);
})().catch((err) => {
  console.error(err);
  window.__srsFail?.(`No se pudo cargar: ${err?.message || err}`);
});
setTimeout(() => { if (G.state === 'loading') window.__srsFail?.('La carga del modelo no termina. Recarga la página.'); }, 90000);

function findScene(gltf, re) { return gltf.scenes.find((s) => re.test(normName(s))); }
function findNode(gltf, name) {
  for (const sc of gltf.scenes) {
    let hit = null;
    sc.traverse((o) => { if (!hit && (o.userData?.name || o.name) === name) hit = o; });
    if (hit) return hit;
  }
  return null;
}

function onLoaded(gltf, fleetGltf) {
  prog.style.width = '85%';
  G.circuitSrc = findScene(gltf, /Circuit/i) || gltf.scene;
  G.circuitSrc.updateMatrixWorld(true);

  G.chase = new ChaseCamera(camera);
  G.fx.motes = new Motes(scene);
  G.fx.sparks = new Sparks(scene);
  G.fx.damage = new DamageFx(scene);
  G.fx.ion = new IonTrail(scene);
  G.fx.engine = new EngineTrails(scene);

  buildCircuit(circuitById(G.circuitId));
  const track = G.track;

  // Flota: una nave por entrada de FLEET (nodo con el mismo nombre que en Blender)
  G.ships = FLEET.map((def) => {
    const node = findNode(fleetGltf, def.node);
    if (!node) { console.warn('[SRS] falta la nave', def.node); return null; }
    const sh = new Ship(node, track, { ...def, stats: statsFor(def) });
    scene.add(sh.root);
    sh.trails = new Trails(scene, 2);
    return sh;
  }).filter(Boolean);
  console.info(`[SRS] flota: ${G.ships.map((s) => s.name).join(', ')}`);
  G.choice = Math.min(G.choice, G.ships.length - 1);

  G.hud = new HUD(track);
  for (const sh of G.ships) G.fx.engine.add(sh);
  const logos = G.ships.map((sh) => findNode(fleetGltf, 'LOGO_' + (sh.def.logo || sh.def.node.split('_')[0])));
  G.showroom = new Showroom(G.envs.saturn || scene.environment, G.ships, logos);

  setPlayer(G.choice);
  resetRace();
  G.intro.update(0);
  G.state = 'title';
  prog.style.width = '100%';
  startBtn.disabled = false;
  startBtn.textContent = 'Iniciar · Enter';
  startBtn.focus();
}

// ── Circuito: atmósfera + pista + mundo. Se puede reconstruir en caliente (campeonato). ──
G.envs = {};
function disposeWorld() {
  if (!G.world) return;
  scene.remove(G.world);
  G.world.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => m.dispose());
  });
  for (const d of G.disposables || []) d.dispose?.();
  G.world = null; G.disposables = [];
}

function applyLook(def) {
  const A = CONFIG.atmosphere;
  if (def.sunFrom === 'mars' && !def._sun) { def.atmosphere.sunDir = marsSunDir(); def._sun = true; }
  if (def.sunFrom === 'tharsis' && !def._sun) { def.atmosphere.sunDir = tharsisSunDir(); def._sun = true; }
  if (def.sunFrom === 'cassini' && !def._sun) { def.atmosphere.sunDir = cassiniSunDir(); def._sun = true; }
  if (def.sunFrom === 'tiphares' && !def._sun) { def.atmosphere.sunDir = tipharesSunDir(); def._sun = true; }
  if (def.sunFrom === 'europa' && !def._sun) { def.atmosphere.sunDir = europaSunDir(); def._sun = true; }
  if (def.sunFrom === 'miranda' && !def._sun) { def.atmosphere.sunDir = mirandaSunDir(); def._sun = true; }
  camera.far = def.far || 30000; camera.updateProjectionMatrix();
  grade.uniforms.uRedKeep.value = def.atmosphere.redKeep ?? 1;
  if (G.fx.rockets) G.fx.rockets.enabled = def.rockets !== false;
  if (G.fx.motes) {
    G.fx.motes.wind = def.wind ? new THREE.Vector3(...def.wind) : null;
    G.fx.motes.points.material.color.setHex(def.wind ? 0xd9a27c : 0xe8e4da);
    G.fx.motes.points.material.size = def.wind ? 0.22 : 0.16;
    G.fx.motes.points.visible = def.motes !== false;          // sin polvo flotante en las lunas sin aire (MIRANDA)
  }
  applyAtmosphere(def.atmosphere, scene, G.showroom?.scene);
  scene.fog.density = A.baseDensity;
  renderer.toneMappingExposure = A.exposure;
  bloom.strength = A.bloom.strength; bloom.radius = A.bloom.radius; bloom.threshold = A.bloom.threshold;
  const g = def.grade;
  grade.uniforms.uSat.value = A.saturation;
  grade.uniforms.uTint.value.set(...g.tint);
  grade.uniforms.uVignette.value = g.vignette;
  grade.uniforms.uGrain.value = g.grain;
  grade.uniforms.uContrast.value = g.contrast;
  const L = def.light;
  sun.color.setHex(L.sun); hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround);
  G.light = L;
  if (!G.envs[def.id]) G.envs[def.id] = buildEnvironment(renderer);
  scene.environment = G.envs[def.id];
  setPaint(def.paint);
  CONFIG.hoverMax = def.hoverMax || 5;
  document.body.dataset.circuit = def.id;
}

// Semilla por pieza dentro de una malla: componentes conexas (triángulos + vértices en la misma posición);
// cada una recibe un valor 0–1 según su centro. Así un bloque de ciudad fusionado tiene un color por edificio.
function pieceSeeds(g) {
  const pos = g.attributes.position, n = pos.count, par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const key = new Map();
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos.getX(i) * 20)},${Math.round(pos.getY(i) * 20)},${Math.round(pos.getZ(i) * 20)}`; const o = key.get(k); if (o === undefined) key.set(k, i); else uni(i, o); }
  const idx = g.index ? g.index.array : null;
  if (idx) for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
  const acc = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); let a = acc.get(r); if (!a) acc.set(r, a = [0, 0, 0, 0]); a[0] += pos.getX(i); a[1] += pos.getY(i); a[2] += pos.getZ(i); a[3]++; }
  const seed = new Map(); for (const [r, a] of acc) { const x = a[0] / a[3], y = a[1] / a[3], z = a[2] / a[3]; seed.set(r, Math.abs(Math.sin(x * 12.9898 + z * 78.233 + y * 37.719) * 43758.5453) % 1); }
  const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = seed.get(find(i));
  return new THREE.BufferAttribute(out, 1);
}

function buildCircuit(def) {
  const t0 = performance.now();
  disposeWorld();
  G.circuit = def;
  G.circuitId = def.id;
  applyLook(def);
  const own = G.disposables = [];
  G.circuitFx = null; G.introKeys = null; G.flyers?.dispose(); G.flyers = null;
  if (def.generated) return buildGenerated(def, own, t0);
  const circuit = G.circuitSrc.clone(true);
  circuit.updateMatrixWorld(true);
  const arcadia = def.id === 'arcadia';

  // Limpieza de la escena del circuito
  const remove = [];
  let moonBig = null, moonSmall = null, lava = null;
  const land = [], obstacles = [];
  circuit.traverse((o) => {
    const n = normName(o);
    if (o.isCamera || /^CAM \||^FOCUS/.test(n)) remove.push(o);
    if (/reference-scale racer/i.test(n)) remove.push(o);
    if (/^ATMOSPHERE/.test(n)) remove.push(o);
    if (/immense pale moon/i.test(n)) moonBig = o;
    if (/small satellite/i.test(n)) moonSmall = o;
    if (/lava inlet/i.test(n)) lava = o;
    if (o.isMesh && (/basalt|LAND \| fractured/i.test(n) || /Basalt/.test(o.material?.name || ''))) land.push(o);
    if (o.isMesh && /^(LAND|COAST|CITY|MONOLITH)/.test(n)) obstacles.push(o);
  });
  remove.forEach((o) => o.parent && o.parent.remove(o));
  circuit.updateMatrixWorld(true);

  // Pista (antes de fusionar, necesita el mesh original del tablero)
  // Suelo bajo el trazado: rejilla de alturas máximas (8 m) de terreno, costa, ciudad y monolitos.
  // Mucho más rápido que lanzar rayos contra la cuenca entera; se calcula una vez por circuito.
  G.groundCache = G.groundCache || {};
  const groundFn = (pts) => {
    if (G.groundCache[def.id]) return G.groundCache[def.id];
    const C = 8, grid = new Map();
    const put = (x, z, y) => { const k = Math.floor(x / C) * 100003 + Math.floor(z / C); const v = grid.get(k); if (v === undefined || y > v) grid.set(k, y); };
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (const o of obstacles) {
      const g = o.geometry, pa = g.attributes.position, idx = g.index;
      const tc = idx ? idx.count / 3 : pa.count / 3;
      for (let t = 0; t < tc; t++) {
        A.fromBufferAttribute(pa, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(o.matrixWorld);
        B.fromBufferAttribute(pa, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(o.matrixWorld);
        Cc.fromBufferAttribute(pa, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(o.matrixWorld);
        const span = Math.max(Math.abs(A.x - B.x), Math.abs(A.z - B.z), Math.abs(A.x - Cc.x), Math.abs(A.z - Cc.z), Math.abs(B.x - Cc.x), Math.abs(B.z - Cc.z));
        const steps = Math.min(60, Math.ceil(span / (C * 0.5)));
        for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
          const u = i / Math.max(1, steps), v = j / Math.max(1, steps), w = 1 - u - v;
          put(A.x * w + B.x * u + Cc.x * v, A.z * w + B.z * u + Cc.z * v, A.y * w + B.y * u + Cc.y * v);
        }
      }
    }
    const get = (x, z) => grid.get(Math.floor(x / C) * 100003 + Math.floor(z / C));
    const r = new THREE.Vector3(), t = new THREE.Vector3();
    const out = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length], pp = pts[(i - 1 + pts.length) % pts.length];
      t.subVectors(q, pp).setY(0).normalize(); r.set(-t.z, 0, t.x);
      let below = -1e9, above = 1e9;
      for (let x = -16; x <= 16; x += 8) {
        const h = get(p.x + r.x * x, p.z + r.z * x);
        if (h === undefined) continue;
        if (h <= p.y + 2) below = Math.max(below, h); else above = Math.min(above, h);
      }
      return { below, above };
    });
    G.groundCache[def.id] = out;
    return out;
  };
  const track = G.track = new Track(circuit, { relief: def.relief, inSectorOrder: def.inSectorOrder, groundFn });
  const st = track.stats;
  console.info(`[SRS] ${def.name}: ${track.length.toFixed(0)} m · cota ${st.minY.toFixed(0)}–${st.maxY.toFixed(0)} m · pendiente media ${(st.meanSlope * 100).toFixed(1)} % · máx ${(st.maxSlope * 100).toFixed(0)} %`);

  // Materiales del paisaje
  if (moonBig) {
    if (arcadia && def.moons && !def.moons.big) moonBig.visible = false;
    else own.push(moonBig.material = createMoonMaterial(0.6));
  }
  if (moonSmall) {
    const M = arcadia ? def.moons?.small : null;
    own.push(moonSmall.material = M ? createMoonMaterial(M.haze, new THREE.Color(...M.tint)) : createMoonMaterial(0.62, new THREE.Color(0.5, 0.5, 0.48)));
  }
  if (lava) { if (arcadia) lava.visible = false; else own.push(lava.material = lavaMaterial()); }
  const ground = arcadia ? terrainMaterial() : basaltMaterial();
  own.push(ground);
  land.forEach((m) => { m.material = ground; });
  const world = G.world = new THREE.Group();
  world.name = `WORLD ${def.name}`;

  // Plataformas de lanzamiento junto a cada monolito
  const pads = [];
  const ray = new THREE.Raycaster();
  const padGroup = new THREE.Group();
  const padMat = new THREE.MeshStandardMaterial({ color: def.pad, roughness: 0.7, metalness: arcadia ? 0.05 : 0.3 });
  own.push(padMat);
  circuit.traverse((o) => {
    const m = normName(o).match(/^MONOLITH (\d+) \| dark backbone/);
    if (m) {
      const p = o.getWorldPosition(new THREE.Vector3());
      const pad = new THREE.Vector3(p.x + 84, 400, p.z + 30);
      ray.set(pad, new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(land, false)[0];
      const gy = hit ? hit.point.y : -110;
      const top = new THREE.Box3().setFromObject(o).min.y;
      pad.y = Math.max(gy, top);
      if (pad.y - gy > 1) {
        const h = pad.y - gy + 4;
        const geo = new THREE.CylinderGeometry(24, 30, h, 32); own.push(geo);
        const plat = new THREE.Mesh(geo, padMat);
        plat.position.set(pad.x, gy + h / 2 - 4, pad.z);
        plat.receiveShadow = true;
        padGroup.add(plat);
      }
      pads.push({ id: +m[1], pos: pad });
    }
  });
  pads.sort((a, b) => a.id - b.id);

  // Arbolado (antes de fusionar: necesita el terreno con sus matrices)
  if (arcadia) {
    const trees = plantTrees(world, land, track);
    if (trees) { console.info(`[SRS] árboles: ${trees.count}`); trees.group.traverse((o) => { if (o.isMesh) own.push(o.geometry); }); }
  }
  // Materiales por circuito: copia del original + retoques del tema (+ recoloreado por pieza)
  const baseCache = new Map(), ruleCache = new Map(), special = new Map();
  const baseMat = (m) => {
    if (baseCache.has(m.uuid)) return baseCache.get(m.uuid);
    let c;
    if (arcadia && /CITY \| graphite with lit windows/.test(m.name)) c = facadeMaterial(m);
    else {
      c = m.clone();
      if (!arcadia) {
        if (/CITY \| graphite with lit windows/.test(m.name)) c.emissive?.setRGB(1.0, 0.66, 0.36);
        if (/City arterial lights/.test(m.name)) c.emissive?.setRGB(1.0, 0.55, 0.25);
        if (/Muted cyan checkpoints/.test(m.name)) { c.emissive?.setRGB(0.1, 0.75, 0.8); c.emissiveIntensity = 2.2; }
      } else {
        const t = def.matTweaks?.[m.name];
        if (t) for (const [k, v] of Object.entries(t)) { if (c[k]?.isColor) c[k].setHex(v); else c[k] = v; }
      }
    }
    own.push(c); baseCache.set(m.uuid, c);
    return c;
  };
  const themed = (o, n) => {
    const src = o.material;
    if (arcadia && def.recolor) {
      for (let r = 0; r < def.recolor.length; r++) {
        const [on, mn, col] = def.recolor[r];
        if (!on.test(n) || !mn.test(src.name)) continue;
        const k = r + '|' + src.uuid;
        if (!ruleCache.has(k)) {
          let c;
          if (typeof col === 'object') c = paintedMaterial(baseMat(src), col.paint, col.cell);
          else { c = baseMat(src).clone(); c.color.setHex(col); c.map = null; c.metalnessMap = null; c.metalness = Math.min(c.metalness, 0.12); c.roughness = Math.max(c.roughness, 0.6); }
          own.push(c); ruleCache.set(k, c);
        }
        return ruleCache.get(k);
      }
    }
    return baseMat(src);
  };
  const matFor = (base, kind) => {
    const k = kind + '|' + base.uuid;
    if (!special.has(k)) {
      const m = kind === 'deck' ? deckMaterial(base) : kind === 'guard' ? guardMaterial(base)
        : kind === 'reflector' ? reflectorMaterial(def.paint.buoy) : amberGuideMaterial(def.paint.guide);
      special.set(k, m); own.push(m);
    }
    return special.get(k);
  };

  // Fusión de geometría estática por material → ~20 draw calls en lugar de ~1400
  // + relieve aplicado a todo lo que cuelga de la pista, y materiales de color para asfalto, muros y balizas
  const keep = new Set([moonBig, moonSmall, lava].filter(Boolean));
  const groups = new Map();
  const toRemove = [];
  trackUniforms.uLen.value = track.length;
  const trackBox = new THREE.Box3().setFromArray(track.orig.flatMap((p) => [p.x, p.y, p.z])).expandByScalar(200);
  circuit.traverse((o) => {
    if (!o.isMesh || keep.has(o)) return;
    const n = normName(o);
    if (/^TECH \| guiding edge light/.test(n)) { toRemove.push(o); return; }   // duplicaba la línea luminosa (parpadeo)
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const tm = arcadia ? themed(o, n) : null;
    if (tm?.userData.painted) g.setAttribute('aSeed', pieceSeeds(g));   // un color por pieza (no por celda del mundo)
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    let kind = null;
    let mat = land.includes(o) ? ground : themed(o, n);
    if (/racing deck/i.test(n)) kind = 'deck';
    else if (/^GUARD \| tapered curve wall/.test(n)) kind = 'guard';
    else if (/^TRACK \| reflector/.test(n)) kind = 'reflector';
    else if (/^Center guide/.test(n)) kind = 'guide';
    if (kind) mat = matFor(mat, kind);
    if (kind === 'guide') kind = null;
    g.computeBoundingBox();
    if (FOLLOWS_TRACK(n) && g.boundingBox.intersectsBox(trackBox)) deformGeometry(g, track, kind, CONFIG.relief.enabled);
    else if (kind) deformGeometry(g, track, kind, false);
    const key = mat.uuid + '|' + Object.keys(g.attributes).sort().join(',');
    if (!groups.has(key)) groups.set(key, { mat, geos: [] });
    groups.get(key).geos.push(g);
    toRemove.push(o);
  });
  toRemove.forEach((o) => o.parent.remove(o));
  for (const { mat, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    merged.computeBoundingSphere();
    own.push(merged);
    world.add(mesh);
  }
  for (const o of keep) { o.parent?.remove(o); o.matrix.copy(o.matrixWorld); o.matrix.decompose(o.position, o.quaternion, o.scale); world.add(o); }
  const water = createWater(def.seaLevel ?? -66);
  if (arcadia) { water.material.dispose(); water.material = seaMaterial(); }
  own.push(water.geometry, water.material);
  world.add(water, padGroup);
  scene.add(world);
  G.structures = buildStructures(world, track, def.structures);
  G.structures.group.traverse((o) => { if (o.isMesh) own.push(o.geometry, o.material); });
  console.info('[SRS] túnel', G.structures.tunnel, 'puentes', G.structures.bridges);

  if (!G.fx.rockets) G.fx.rockets = new Rockets(scene, pads);
  else if (!G.fx.rockets.pads.length) G.fx.rockets.pads = pads;
  G.fx.rockets.enabled = def.rockets !== false;
  finishCircuit(def, world, track, t0);
}

// Material del GLB por nombre (copia), para los circuitos generados
function srcMat(name, tweak) {
  let found = null;
  G.circuitSrc.traverse((o) => { if (!found && o.isMesh && o.material?.name === name) found = o.material; });
  const m = found ? found.clone() : new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 });
  tweak?.(m);
  return m;
}

// Circuito generado (OLYMPUS-3): mundo propio, sin el GLB
function buildGenerated(def, own, t0) {
  const world = G.world = new THREE.Group();
  world.name = `WORLD ${def.name}`;
  const r = ({ itaka: buildItaka, mars: buildMars, tharsis: buildTharsis, cassini: buildCassini, tiphares: buildTiphares, europa: buildEuropa, miranda: buildMiranda })[def.generated](def, { world, own, srcMat, renderer });
  const track = G.track = r.track;
  trackUniforms.uLen.value = track.length;
  scene.add(world);
  const own_tube = def.generated === 'itaka';          // NUEVA-ITAKA trae su propio tubo continuo: sin túnel ni puentes añadidos
  G.structures = buildStructures(world, track, def.structures, { tunnel: own_tube ? false : (r.tunnel || false), bridges: own_tube ? 0 : (r.bridges ?? 2), ground: r.ground, rock: true });
  if (own_tube) G.structures.tunnel = r.tunnel;
  G.structures.group.traverse((o) => { if (o.isMesh) own.push(o.geometry, o.material); });
  G.circuitFx = r.fx; G.introKeys = r.introKeys;
  if (G.fx.rockets) G.fx.rockets.enabled = false;
  finishCircuit(def, world, track, t0);
}

// Parte común: relieve del tablero, esferas, cohetes-arma y reenlazar naves y HUD con la pista nueva
function finishCircuit(def, world, track, t0) {
  const tn = G.structures?.tunnel;
  const dd = buildDeckDetail(world, track, def.deckDetail || {}, { skip: [[track.length - 140, track.length], ...(tn ? [[tn.s, tn.s + tn.len]] : [])] });
  console.info(`[SRS] relieve del tablero: ${dd.pieces} piezas`);
  if (!G.fx.rockets) G.fx.rockets = new Rockets(scene, []);
  G.pickups = new Pickups(world, track);
  G.missiles = new Missiles(world, track, { sparks: G.fx.sparks, smoke: G.fx.rockets.smoke });

  // lo que ya existía apunta a la pista nueva
  for (const sh of G.ships || []) { sh.track = track; sh.frame = track.frame(); }
  G.hud?.setTrack(track);
  console.info(`[SRS] ${def.name} construido en ${(performance.now() - t0).toFixed(0)} ms`);
}

// ── Jugador y parrilla ──
function setPlayer(i) {
  G.ships.forEach((s) => { s.player = false; s.removeEngineLight(); });
  G.ships.forEach((s) => { s.assist = 0; });
  G.ship = G.ships[i];
  G.ship.player = true;
  G.ship.assist = G.assistOn ? 1 : 0;
  G.ship.addEngineLight();
}

function gridSlot(k) {
  const row = Math.floor(k / 2), col = k % 2;
  return { s: -CONFIG.gridOffset - row * 16 - col * 7, x: col ? 6 : -6 };
}

function resetRace() {
  const { ship: player, track } = G;
  const rivals = G.ships.filter((s) => s !== player);
  const slots = [...Array(G.ships.length).keys()].filter((k) => k !== CONFIG.playerSlot);
  const order = [];
  rivals.forEach((sh, i) => order.push([sh, slots[i]]));
  order.push([player, Math.min(CONFIG.playerSlot, G.ships.length - 1)]);
  G.ai.clear();
  for (const [sh, slot] of order) {
    const g = gridSlot(slot);
    sh.reset(g.s, g.x);
    sh.trails.reset();
    sh.race = { lap: 1, halfway: false, prevS: sh.s, finished: false, finishTime: null, lapStart: 0, progress: 0, slot };
    if (sh !== player) {
      const D = diff();
      const skill = D.skillTop - slot * D.skillStep * 7 / Math.max(1, G.ships.length - 1);   // mismo abanico con 8 o 12 naves
      const ai = new AIDriver(sh, track, { skill, bias: (Math.random() - 0.5) * 3, aggression: 0.3 + Math.random() * 0.6 });
      ai.mistakes = D.mistakes; ai.pace = D.pace ?? 1;
      ai.pickups = G.pickups;
      G.ai.set(sh, ai);
    }
  }
  G.pickups?.reset();
  G.circuitFx?.reset?.();
  G.fx.engine?.reset();
  G.missiles?.reset();
  G.chase.snap(player);
  G.intro = new EagleFlight(camera, track, player, G.chase, G.introKeys);
  G.race = {
    laps: CONFIG.laps, lapTime: 0, total: 0, best: Infinity, times: [],
    sector: 1, sectorIdx: 0, bestSplits: {}, wrongWay: false, countdown: 0, lastCount: null,
    pos: order.length, finishedAt: 0, resultsTimer: 0,
  };
  G.playerAI = null;
  updateStandings();
}

// ── Flujo de estados ──
const $ = (id) => document.getElementById(id);

function begin() {
  if (G.state !== 'title') return;
  audio.start();
  if (IS_TOUCH) {   // pantalla completa + horizontal cuando el navegador lo permite
    const el = document.documentElement;
    const fs = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    Promise.resolve(fs).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
  $('title').classList.add('gone');
  goSelect();
}
startBtn.addEventListener('click', begin);

function goSelect() {
  G.state = 'select';
  audio.setEngines(false);
  G.paused = false;
  $('pause').hidden = true; $('results').hidden = true;
  document.body.classList.remove('cine');
  G.hud.show(false);
  $('select').hidden = false;
  G.pick = G.circuitId;
  for (const sh of G.ships) { sh.out = false; sh.dead = 0; sh.hull = sh.maxHull; sh.setDamage(); }   // el hangar las muestra reparadas
  setView(G.showroom.scene, G.showroom.camera);
  showChoice(G.choice);
}

function showChoice(i) {
  const n = G.ships.length;
  G.choice = (i + n) % n;
  const sh = G.ships[G.choice], d = sh.def;
  G.showroom.show(G.choice);
  renderCircuitChips();
  $('selNum').textContent = d.num;
  $('selTot').textContent = String(n).padStart(2, '0');
  $('selName').textContent = d.name;
  $('selTag').textContent = d.tag;
  const pips = (el, v) => { el.innerHTML = [1, 2, 3, 4, 5].map((k) => `<i class="${k <= v ? 'on' : ''}"></i>`).join(''); };
  const t = traits(d);
  pips($('stV'), t.V); pips($('stA'), t.A); pips($('stM'), t.M); pips($('stD'), t.D); pips($('stP'), t.P); pips($('stH'), t.H);
  $('selLen').textContent = `${(sh.length / (CONFIG.shipScale || 1)).toFixed(1).replace('.', ',')} m`;
}
$('selPrev').addEventListener('click', () => { showChoice(G.choice - 1); audio.beep(false); });
$('selNext').addEventListener('click', () => { showChoice(G.choice + 1); audio.beep(false); });
$('selGo').addEventListener('click', () => confirmChoice());
{
  let x0 = null;
  $('select').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) x0 = e.clientX; });
  $('select').addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { showChoice(G.choice + (dx < 0 ? 1 : -1)); audio.beep(false); }
  });
}

function renderCircuitChips() {
  document.querySelectorAll('[data-circ]').forEach((b) => {
    const c = circuitById(b.dataset.circ), open = G.unlocked.has(c.id);
    b.classList.toggle('locked', !open);
    b.setAttribute('aria-pressed', String(G.pick === c.id));
    b.setAttribute('aria-disabled', String(!open));
  });
  const c = circuitById(G.pick);
  const note = $('circNote');
  if (note) note.textContent = c.id === 'saturn' ? `${c.blurb} · abre el campeonato de ${CIRCUITS.length} carreras` : c.blurb;
}
function pickCircuit(id) {
  const c = circuitById(id);
  if (!G.unlocked.has(c.id)) {
    // atajo de prototipo: tres toques seguidos en el circuito bloqueado lo abren
    const now = performance.now();
    G.lockTaps = G.lockTaps && G.lockTaps.id === c.id && now - G.lockTaps.t < 1500 ? { id: c.id, n: G.lockTaps.n + 1, t: now } : { id: c.id, n: 1, t: now };
    if (G.lockTaps.n >= 3) { unlock(c.id); G.lockTaps = null; }
    else {
      const need = circuitById(c.unlockAfter);
      $('circNote').textContent = `Termina ${need.name} para desbloquear ${c.name}`;
      audio.beep(false);
      return;
    }
  }
  G.pick = c.id;
  renderCircuitChips();
  audio.beep(false);
}
document.querySelectorAll('[data-circ]').forEach((b) => b.addEventListener('click', () => pickCircuit(b.dataset.circ)));

// Cambio de circuito con cortinilla (la reconstrucción tarda un par de segundos)
function travel(id, then, rebuild = true) {
  const c = circuitById(id);
  $('travelName').textContent = c.name;
  $('travelSub').textContent = c.blurb;
  $('travel').hidden = false;
  G.state = 'travel';
  G.hud.show(false);
  audio.setEngines(false);                 // el hilo se bloquea al construir: que no quede un zumbido colgado
  setTimeout(() => {
    if (rebuild) buildCircuit(c);
    warmup();
    then();
    tick(0.0001);          // primer plano de la intro ya pintado bajo la cortinilla: no se cuela la cámara de parrilla
    requestAnimationFrame(() => { $('travel').hidden = true; });
  }, 60);
}

// Calentamiento tras la cortinilla: compila todos los shaders y sube a la GPU geometría y texturas
// de todo el circuito (un fotograma sin recorte de frustum). Así la intro y la carrera no se atascan
// la primera vez que la cámara descubre una zona, una explosión o una nave tocada.
function warmup() {
  const t0 = performance.now();
  if (!G.flyers && G.track && G.ships.length) G.flyers = new Flyers(scene, G.track, G.ships, G.circuitId === 'olympus' ? 8 : 6);
  resetRace();
  const culled = [], hidden = [];
  scene.traverse((o) => {
    if (o.frustumCulled && (o.isMesh || o.isPoints || o.isSprite || o.isLine)) { culled.push(o); o.frustumCulled = false; }
  });
  // las piezas en reserva (destellos de explosión) también, aunque estén ocultas
  G.missiles?.flashPool?.forEach((s) => { hidden.push(s); s.visible = true; });
  setView(scene, camera);
  try { renderer.compile(scene, camera); composer.render(0.001); } catch (e) { console.warn('warmup', e); }
  culled.forEach((o) => { o.frustumCulled = true; });
  hidden.forEach((o) => { o.visible = false; });
  G.warmMs = performance.now() - t0;
}

function confirmChoice() {
  if (G.state !== 'select') return;
  $('select').hidden = true;
  setView(scene, camera);
  setPlayer(G.choice);
  audio.beep(true);
  // SATURN-6 abre el campeonato; ARCADIA-2 elegida suelta es una carrera independiente
  G.cup = G.pick === CIRCUITS[0].id ? { round: 0, results: [] } : null;
  travel(G.pick, startIntro, G.pick !== G.circuitId);
}

function goNext() {
  const nx = nextCircuit();
  if (G.state !== 'finished' || !nx || !G.unlocked.has(nx.id)) return;
  $('results').hidden = true;
  if (G.cup) G.cup.round++;
  G.pick = nx.id;
  audio.beep(true);
  travel(nx.id, startIntro);
}

function startIntro() {
  audio.music(true, G.circuit?.music || 'perimeter');   // la intro del tema abre cada fase (Marte: Obsidian Pursuit)
  audio.setEngines(true);
  resetRace();
  G.state = 'intro';
  document.body.classList.add('cine');
  G.hud.show(false);
  if (G.fx.rockets.enabled !== false) G.fx.rockets.launch(0, 1.4);        // un cohete despega junto al monolito del primer plano
  G.fx.rockets.timer = 40;
  audio.whoosh();
}

function endIntro() {
  document.body.classList.remove('cine');
  G.hud.card('', '');
  G.state = 'countdown';
  G.race.countdown = 3.6;
  G.hud.show(true);
  G.chase.snap(G.ship);
}

function introCards() {
  const c = G.circuit;
  const round = G.cup ? `Campeonato · carrera ${G.cup.round + 1}/${CIRCUITS.length}` : c.cards[0];
  return [
    [0.9, 4.6, round, c.cards[1]],
    [6.6, 10.4, `${c.sub} · ${G.ships.length} naves · ${CONFIG.laps} vueltas`, `${(G.track.length / 1000).toFixed(2).replace('.', ',')} KM`],
    [12.6, 16.4, `Piloto · sale ${CONFIG.playerSlot + 1}º`, G.ship.name],
  ];
}

function updateIntro(dt) {
  const t = G.intro.update(dt);
  let shown = false;
  for (const [a, b, small, big] of introCards()) {
    if (t >= a && t < b) {
      if (G.hud.el.cardBig.textContent !== big || !G.hud.el.card.classList.contains('show')) G.hud.card(small, big);
      shown = true;
    }
  }
  if (!shown && G.hud.el.card.classList.contains('show')) G.hud.card('', '');
  if (G.intro.done) endIntro();
}

// ── Vueltas y clasificación (todas las naves) ──
function lapTrack(sh) {
  const r = sh.race, L = G.track.length, s = sh.s, ps = r.prevS, T = G.race.total;
  if (sh.out) { r.prevS = s; r.progress = -1e7 + sh.outAt; return false; }   // eliminadas: al fondo, por orden de caída
  if (s > L * 0.45 && s < L * 0.55) r.halfway = true;
  let crossed = false;
  if (ps > L - 150 && s < 150 && r.halfway) {
    crossed = true;
    r.halfway = false;
    if (!r.finished) {
      if (r.lap >= G.race.laps) { r.finished = true; r.finishTime = T; }
      else r.lap++;
    }
  }
  r.prevS = s;
  r.progress = r.finished ? G.race.laps * L + 1e6 - r.finishTime : (r.lap - 1) * L + (s > L * 0.5 && !r.halfway ? s - L : s);
  return crossed;
}

function updateStandings() {
  G.order = [...G.ships].sort((a, b) => b.race.progress - a.race.progress);
  G.race.pos = G.order.indexOf(G.ship) + 1;
}

function updateRace(dt) {
  const { ship, race, track, hud } = G;
  const inp = input.state;

  if (G.state === 'countdown') {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown - 0.6);
    if (n !== race.lastCount && n <= 3) {
      race.lastCount = n;
      if (n > 0) { hud.count(String(n)); audio.beep(false); }
      else { hud.count('GO'); audio.beep(true); }
    }
    if (race.countdown < 0.9 && race.countdown > 0.6 && inp.throttle) race.perfect = true;
    if (race.countdown <= 0.6) {
      G.state = 'race';
      if (race.perfect) { ship.boostKick = 1.4; hud.banner('Salida perfecta', '', false, 1.4); }
      // los rivales también tienen reflejos (unos mejores que otros)
      for (const [sh, ai] of G.ai) if (Math.random() < ai.skill - 0.5) sh.boostKick = 0.6 + Math.random() * 0.6;
    }
  }
  const locked = G.state === 'countdown';
  const running = G.state === 'race' || G.state === 'finished';
  if (running) race.total += dt;

  // rebufo: pegado detrás de otra nave → más punta y aceleración (para todos)
  const DR = CONFIG.draft;
  for (const sh of G.ships) {
    let tgt = 0;
    if (running && sh.dead <= 0 && sh.v > 40) for (const o of G.ships) {
      if (o === sh || o.dead > 0) continue;
      const d = track.delta(sh.s, o.s);
      if (d > DR.min && d < DR.max && Math.abs(o.x - sh.x) < DR.lateral) { tgt = Math.max(tgt, 1 - (d - DR.min) / (DR.max - DR.min) * 0.5); }
    }
    sh.draft += (tgt - sh.draft) * Math.min(1, dt * (tgt > sh.draft ? 1.6 : 3));
  }

  // física de todas las naves
  for (const sh of G.ships) {
    let i;
    if (sh === ship) i = G.playerAI ? G.playerAI.update(dt, G.ships) : inp;
    else {
      const ai = G.ai.get(sh);
      const D = diff();
      // corrección solo con huecos grandes (> ~150 m): en los duelos cercanos no actúa
      const gap = ship.race.progress - sh.race.progress;
      const eff = Math.sign(gap) * Math.max(0, Math.abs(gap) - (gap < 0 ? D.rubberGap ?? 150 : 150));
      const rubber = sh.race.finished ? 0 : THREE.MathUtils.clamp(eff / 1100, -D.rubberDown, D.rubberUp);
      if (sh.race.finished) ai.cruise = 0.72;
      i = ai.update(dt, G.ships, rubber);
    }
    sh.update(dt, i, locked);
    if (sh === ship && sh.landEvent) { G.chase.addShake(sh.landEvent); sh.landEvent = 0; }
  }
  if (running) {
    G.pickups.update(dt, G.ships, (sh, it) => {
      if (it.type === 'G') sh.boostPad(); else sh.ammo = Math.min(2, sh.ammo + 1);
      if (sh === ship) {
        audio.chime(it.type === 'R');
        hud.banner(it.type === 'G' ? 'Boost' : 'Cohete listo', it.type === 'R' ? (IS_TOUCH ? 'Pulsa COHETE' : 'F · disparar') : '', false, 1.2);
      }
    });
    // anillos de carrera (EUROPA): reparan el blindaje, recargan dos cohetes y dan un empujón
    G.circuitFx?.passRings?.(G.ships, (sh) => {
      sh.hull = sh.maxHull; sh.setDamage(); sh.ammo = 2;
      sh.boostPad(); sh.boost = 1; sh.boostKick = Math.max(sh.boostKick, 1.5 * (sh.C.kick || 1));
      if (sh === ship) { audio.ring?.(); ringFilm(); hud.banner('Anillo', 'Blindaje restaurado · cohetes × 2 · boost', false, 1.6); }
    });
    for (const sh of G.ships) {
      const wants = sh === ship ? (inp.fire && !G.playerAI) : G.ai.get(sh)?.inp.fire;
      if (wants && sh.ammo > 0 && G.state === 'race' && G.missiles.fire(sh, G.ships) && (sh === ship || sh.root.position.distanceTo(ship.root.position) < 300)) audio.launch();
    }
  }
  G.missiles.update(dt, G.ships, (shooter, victim, result, pos) => {
    const d = victim.root.position.distanceTo(ship.root.position);
    const destroyed = result === 'destroyed';
    if (d < 700) audio.boom(Math.max(0.25, 1 - d / 700) * (destroyed ? 1.4 : 1));
    if (destroyed) {                                   // gran explosión
      for (let k = 0; k < 3; k++) G.missiles.explode(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4)), true);
      G.fx.sparks.burst(pos, victim.fwd.clone().multiplyScalar(0.4), 90, 30);
      if (d < 120) G.chase.addShake(destroyed && victim === ship ? 1.5 : 0.6);
    }
    if (victim === ship) {
      G.chase.addShake(1.1);
      if (destroyed) hud.banner('Eliminado', `Fuera de carrera · ${shooter.name}`, true, 3.2);
      else hud.banner(ship.hull === 1 ? 'Blindaje crítico' : 'Impacto', `Blindaje ${ship.hull}/${ship.maxHull} · ${shooter.name}`, true, 1.6);
    } else if (shooter === ship) hud.banner(destroyed ? `${victim.name} eliminada` : `Impacto · ${victim.name}`, destroyed ? 'Fuera de carrera' : `Blindaje ${victim.hull}/${victim.maxHull}`, false, 1.6);
    else if (destroyed && d < 900) hud.banner(`${victim.name} eliminada`, `por ${shooter.name}`, false, 1.4);
  });
  // jugador eliminado: unos segundos viendo los restos y a la clasificación
  if (ship.out && G.state === 'race') { race.outTimer = (race.outTimer ?? 3.5) - dt; if (race.outTimer <= 0) finish(); }
  resolveCollisions(G.ships, track, (a, b, impact) => {
    if (a === ship || b === ship) {
      G.chase.addShake(Math.min(0.9, impact / 25));
      audio.thud(Math.min(0.8, impact / 30));
      const p = a.root.position.clone().lerp(b.root.position, 0.5);
      G.fx.sparks.burst(p, ship.velocity.clone().normalize().multiplyScalar(0.2), 16, 8 + impact * 0.3);
    }
  });
  for (const sh of G.ships) sh.updateTransform();

  if (running) {
    for (const sh of G.ships) {
      const crossed = lapTrack(sh);
      if (sh === ship && crossed && G.state === 'race') playerLap();
    }
    updateStandings();
  }

  if (G.state === 'race' && !ship.out) {
    race.lapTime += dt;
    const s = ship.s, ps = ship.race.prevS;
    const next = track.sectors[race.sectorIdx + 1];
    if (next && s >= next.s && s - next.s < 100 && ship.race._lastSector !== race.sectorIdx + 1 && track.delta(next.s, s) >= 0 && track.delta(next.s, s) < 100) {
      race.sectorIdx++;
      ship.race._lastSector = race.sectorIdx;
      race.sector = race.sectorIdx + 1;
      const split = race.lapTime;
      const key = `${race.sectorIdx}`;
      const prevBest = race.bestSplits[key];
      const delta = prevBest !== undefined ? split - prevBest : null;
      if (prevBest === undefined || split < prevBest) race.bestSplits[key] = split;
      hud.banner(`Sector ${String(race.sector).padStart(2, '0')} · P${race.pos}`, delta === null ? fmt(split) : `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`, delta !== null && delta > 0);
    }
    race.wrongWay = Math.cos(ship.psi) < -0.2 && ship.v > 5;
  }

  if (G.state === 'finished') {
    race.resultsTimer -= dt;
    if (race.resultsTimer <= 0) { cupPoints(); renderStandings(); race.resultsTimer = 0.5; }
  }

  // impactos contra el muro (jugador)
  if (ship.wallHit > 3) {
    G.chase.addShake(Math.min(1.2, ship.wallHit / 40));
    audio.thud(Math.min(1, ship.wallHit / 50));
    G.fx.sparks.burst(ship.root.position, ship.velocity.clone().normalize().multiplyScalar(0.3), 30, 12 + ship.wallHit * 0.2);
  } else if (ship.scraping > 0.9 && Math.random() < 0.6) {
    const side = Math.sign(ship.x);
    const p = ship.root.position.clone().addScaledVector(G.track.sample(ship.s, G.track.frame()).right, side * 1.0);
    G.fx.sparks.burst(p, ship.velocity.clone().normalize().multiplyScalar(-0.2), 3, 10);
  }
  if (ship.deckScrape > 0.08 && !ship.out) G.chase.addShake(Math.min(0.25, ship.deckScrape * 0.6) * dt * 10);
  if (input.hit('KeyC', 'PadY')) hud.el.cam.textContent = G.chase.cycle().label;
  if (ship.quickEvent) { audio.whoosh(); G.chase.addShake(0.12); }
  for (const sh of G.ships) sh.quickEvent = false;
  G.chase.update(ship, dt);
  hud.update(race, ship, dt, G.ships);
  input.touch.setBoost(ship.boost);
  audio.engine(Math.min(1.3, ship.v / ship.C.vmax), ship.throttle, ship.boosting || ship.boostKick > 0 ? 1 : 0);
}

function playerLap() {
  const r = G.race;
  r.times.push(r.lapTime);
  if (r.lapTime < r.best) r.best = r.lapTime;
  if (G.ship.race.finished) { finish(); return; }
  G.hud.banner(G.ship.race.lap === r.laps ? `Última vuelta · P${r.pos}` : `Vuelta ${G.ship.race.lap} · P${r.pos}`, fmt(r.lapTime), false, 2.6);
  r.lapTime = 0; r.sectorIdx = 0; r.sector = 1; G.ship.race._lastSector = 0;
  audio.beep(true);
}

function finish() {
  const r = G.race;
  G.state = 'finished';
  audio.setEngines(false);                 // clasificación sin motores: cambio de tono
  r.finishedAt = r.total;
  updateStandings();
  G.playerAI = new AIDriver(G.ship, G.track, { skill: 0.85 });
  G.playerAI.cruise = 0.72;
  // puntos del campeonato (se sobrescriben si la carrera se repite)
  cupPoints();
  const nx = nextCircuit();
  const unlocking = nx && !G.unlocked.has(nx.id) && nx.unlockAfter === G.circuitId;
  if (unlocking) unlock(nx.id);
  const last = G.cup && G.cup.round === CIRCUITS.length - 1;
  const dnf = G.ship.out;
  $('resLabel').textContent = last ? 'Campeonato · clasificación final' : `${G.circuit.name} · ${dnf ? 'Eliminado' : 'Carrera terminada'}`;
  $('resPos').textContent = dnf ? 'DNF' : `${r.pos}º`;
  $('resTotal').textContent = dnf ? `Vuelta ${Math.min(G.ship.race.lap, r.laps)} de ${r.laps}` : fmt(r.finishedAt);
  $('resBest').textContent = `Mejor vuelta ${r.best < Infinity ? fmt(r.best) : '—'}` + (G.cup ? ` · +${dnf ? 0 : POINTS[r.pos - 1] || 0} pts` : '');
  const nb = $('nextBtn');
  nb.hidden = !(nx && G.unlocked.has(nx.id));
  if (nx) nb.textContent = `${G.cup ? 'Siguiente carrera' : 'Siguiente circuito'} · ${nx.name}`;
  $('resUnlock').hidden = !unlocking;
  if (unlocking) $('resUnlock').textContent = `Desbloqueado · ${nx.name}`;
  r.resultsTimer = 0;
  if (!dnf) G.hud.banner(r.pos === 1 ? 'Victoria' : `Meta · ${r.pos}º`, fmt(r.finishedAt), false, 3);
  setTimeout(() => { if (G.state === 'finished') { renderStandings(); $('results').hidden = false; } }, 1600);
  audio.beep(true);
}

// puntos de la ronda: las eliminadas no puntúan (se recalcula mientras el resto termina)
function cupPoints() {
  if (G.cup) G.cup.results[G.cup.round] = new Map(G.order.map((sh, i) => [sh.name, sh.out ? 0 : POINTS[i] || 0]));
}

function cupTotals() {
  const tot = new Map(G.ships.map((sh) => [sh.name, 0]));
  for (const res of G.cup.results) if (res) for (const [k, v] of res) tot.set(k, (tot.get(k) || 0) + v);
  return tot;
}

function renderStandings() {
  if (G.cup && G.cup.round === CIRCUITS.length - 1 && G.cup.results[G.cup.round]) {
    const tot = cupTotals(), race = G.cup.results[G.cup.round];
    const rows = [...G.ships].sort((a, b) => tot.get(b.name) - tot.get(a.name) || race.get(b.name) - race.get(a.name));
    $('standings').innerHTML = rows.map((sh, i) => `<li class="${sh === G.ship ? 'me' : ''}"><span>${i + 1}</span><b>${sh.name}</b><em>${tot.get(sh.name)} pts <small>+${race.get(sh.name)}</small></em></li>`).join('');
    return;
  }
  const L = G.track.length, lead = G.order[0];
  $('standings').innerHTML = G.order.map((sh, i) => {
    const r = sh.race;
    let t;
    if (sh.out) t = 'Eliminada';
    else if (r.finished) t = i === 0 ? fmt(r.finishTime) : `+${(r.finishTime - lead.race.finishTime).toFixed(2)}`;
    else {
      const gap = (lead.race.finished ? G.race.laps * L : lead.race.progress) - r.progress;
      t = gap > L ? `+${Math.floor(gap / L)} v` : 'en pista';
    }
    const pts = G.cup ? ` <small>+${sh.out ? 0 : POINTS[i] || 0}</small>` : '';
    return `<li class="${sh === G.ship ? 'me' : ''}"><span>${i + 1}</span><b>${sh.name}</b><em>${t}${pts}</em></li>`;
  }).join('');
}

function restart(withIntro = false) {
  $('results').hidden = true;
  $('pause').hidden = true;
  G.paused = false;
  if (withIntro) { startIntro(); return; }
  audio.setEngines(true);
  resetRace();
  G.state = 'countdown';
  G.race.countdown = 3.6;
  G.hud.show(true);
}

// ── Daño visible: humo, chispas y fuego según los impactos; restos humeando; roces del casco con el tablero ──
const _dp = new THREE.Vector3(), _dv = new THREE.Vector3(), _dl = new THREE.Vector3();
// Película de luz azul sobre la pantalla al cruzar un anillo
function ringFilm() {
  let el = document.getElementById('ringFilm');
  if (!el) {
    el = document.createElement('div'); el.id = 'ringFilm';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;mix-blend-mode:screen;background:radial-gradient(ellipse at 50% 55%, rgba(80,190,255,0) 30%, rgba(70,180,255,0.32) 72%, rgba(150,225,255,0.7) 100%), linear-gradient(180deg, rgba(120,220,255,0) 0%, rgba(120,220,255,0.35) 48%, rgba(190,240,255,0.55) 50%, rgba(120,220,255,0.35) 52%, rgba(120,220,255,0) 100%);background-size:100% 100%, 100% 260%;';
    document.body.appendChild(el);
  }
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ opacity: 1, backgroundPosition: '0 0, 0 100%' }, { opacity: 0.55, offset: 0.35 }, { opacity: 0, backgroundPosition: '0 0, 0 0%' }], { duration: 1100, easing: 'ease-out' });
}

function emitDamage(dt) {
  if (G.state === 'title' || G.state === 'select') return;
  const D = G.fx.damage;
  for (const sh of G.ships) {
    if (sh.root.position.distanceToSquared(camera.position) > 450 * 450) continue;
    const lvl = sh.out ? 1.4 : (sh.maxHull - sh.hull) / Math.max(1, sh.maxHull - 1);
    // roce con el tablero: chispas en el punto de contacto, fuego si dura
    if (sh.deckScrape > 0.03 && sh.scrapePt && sh.v > 15) {
      sh.worldPoint(sh.scrapePt, _dp);
      const n = Math.min(6, 1 + sh.deckScrape * 25) * (sh === G.ship ? 1 : 0.5);
      G.fx.sparks.burst(_dp, _dv.copy(sh.fwd).multiplyScalar(-0.5), n < 1 ? (Math.random() < n ? 1 : 0) : Math.round(n), 6 + sh.v * 0.08);
      if (sh.scrapeT > 0.5) for (let k = 0; k < 2; k++) D.fire.emit(_dp, _dv.copy(sh.velocity).multiplyScalar(0.4).add({ x: 0, y: 1.5, z: 0 }), 0.22, 0.7, 0.2, 2, 2);
    }
    if (lvl <= 0) continue;
    sh._dmgAcc = (sh._dmgAcc || 0) + dt;
    const step = sh.out ? 1 / 22 : 1 / (6 + lvl * 22);
    if (sh._dmgAcc < step) continue;
    const n = Math.min(4, Math.floor(sh._dmgAcc / step)); sh._dmgAcc -= n * step;
    for (let k = 0; k < n; k++) {
      _dl.set((Math.random() - 0.5) * sh.size.x * 0.4, sh.size.y * 0.25, (Math.random() - 0.3) * sh.length * 0.3);
      sh.model.localToWorld(_dp.copy(_dl).divideScalar(CONFIG.shipScale || 1));
      _dp.addScaledVector(sh.upv, 0.5);
      _dv.copy(sh.velocity).multiplyScalar(0.25).addScaledVector(sh.upv, 3 + Math.random() * 2.5);
      if (sh.out) {                                            // restos: columna de humo negro y llamas bajas
        D.smoke.emit(_dp, _dv, 5 + Math.random() * 3, 1.2, 10 + Math.random() * 6, 0.35, 2.6);
        if (Math.random() < 0.8) D.fire.emit(_dp, _dv.multiplyScalar(0.6), 0.35 + Math.random() * 0.25, 1.4 + Math.random() * 0.8, 0.3, 1.5, 3);
        if (Math.random() < 0.03) G.fx.sparks.burst(_dp, _dv.set(0, 0.6, 0), 6, 6);
      } else {
        D.smoke.emit(_dp, _dv, 0.7 + lvl * 1.3, 0.35 + lvl * 0.3, 1.4 + lvl * 2.6, 1.2, 2.5);
        if (lvl >= 0.5 && Math.random() < lvl * 0.25) G.fx.sparks.burst(_dp, _dv.copy(sh.fwd).multiplyScalar(-0.4), 3, 8);
        if (lvl >= 0.75) D.fire.emit(_dp, _dv.copy(sh.velocity).multiplyScalar(0.6), 0.18 + Math.random() * 0.12, 0.9 + lvl * 0.5, 0.25, 2, 1);
      }
    }
  }
}

// ── Chispas iónicas de las toberas (color de cada escudería) ──
const _np = new THREE.Vector3(), _nv = new THREE.Vector3();
function emitIon(dt) {
  if (G.state === 'title' || G.state === 'select') return;
  for (const sh of G.ships) {
    const pw = sh.power || 0;
    if (pw < 0.3) continue;
    const near = sh.root.position.distanceToSquared(camera.position) < 250 * 250;
    if (!near) continue;
    if (sh.dead > 0) continue;
    const n = (pw > 0.9 ? 1 : 0.6) * (sh === G.ship ? 1 : 0.4);
    for (const nz of sh.nozzles) {
      for (let k = 0; k < n; k++) {
        if (n < 1 && Math.random() > n) continue;
        sh.worldPoint(nz.pos, _np);
        _nv.copy(sh.velocity).multiplyScalar(0.55).addScaledVector(sh.fwd, -(14 + pw * 24))
          .add({ x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 });
        _np.addScaledVector(sh.velocity, -Math.random() * dt);
        G.fx.ion.emit(_np, _nv, sh.flame, 0.3 + Math.random() * 0.3, nz.r * 1.4 * (CONFIG.shipScale || 1) * (0.6 + pw * 0.5), 0.8);
      }
    }
  }
  G.fx.ion.update(dt, camera, renderer);
}

// ── Dificultad (se recuerda en este navegador) ──
G.diffKey = (() => { try { return localStorage.getItem('srs-difficulty') || 'normal'; } catch (e) { return 'normal'; } })();
function diff() { return CONFIG.difficulties[G.diffKey] || CONFIG.difficulties.normal; }
function setDifficulty(k) {
  if (!CONFIG.difficulties[k]) return;
  G.diffKey = k;
  try { localStorage.setItem('srs-difficulty', k); } catch (e) { /* sin almacenamiento */ }
  document.querySelectorAll('[data-diff]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.diff === k)));
}
document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { setDifficulty(b.dataset.diff); audio.beep(false); }));
setDifficulty(G.diffKey);

G.assistOn = true;
function setAssist(on) {
  G.assistOn = on;
  if (G.ship) G.ship.assist = on ? 1 : 0;
  const b = document.getElementById('assistBtn'); if (b) b.textContent = `Asistencia · ${on ? 'sí' : 'no'}`;
  G.hud?.banner(`Asistencia de dirección · ${on ? 'activada' : 'desactivada'}`, '', false, 1.4);
}

// ── Bucle ──
const clock = new THREE.Clock();
const fpsEl = $('fps');
if (CONFIG.debug) fpsEl.hidden = false;
let fpsAcc = 0, fpsN = 0;
let selPrevSteer = 0;

// Resolución adaptativa: si el equipo no llega a ~50 fps baja la densidad de píxeles, y la recupera si sobra
const PR_MAX = Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2), PR_MIN = Math.min(PR_MAX, 1);
const perf = { pr: renderer.getPixelRatio(), acc: 0, n: 0, last: 0, good: 0 };
function adaptRes() {
  const now = performance.now(), d = now - perf.last; perf.last = now;
  if (d > 250 || !['intro', 'countdown', 'race', 'finished'].includes(G.state) || G.paused) return;
  perf.acc += d; perf.n++;
  if (perf.acc < 2000) return;
  const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
  let pr = perf.pr;
  if (avg > 22 && pr > PR_MIN) { pr = Math.max(PR_MIN, pr - 0.25); perf.good = 0; }
  else if (avg > 24 && aoOn) { aoOn = false; setView(renderPass.scene, renderPass.camera); perf.good = 0; }   // último recurso: sin AO
  else if (avg < 13 && pr < PR_MAX) { if (++perf.good >= 3) { pr = Math.min(PR_MAX, pr + 0.25); perf.good = 0; } }
  else perf.good = 0;
  if (pr !== perf.pr) { perf.pr = pr; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize(); }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  adaptRes();
  tick(dt);
}

function tick(dt) {
  if (G.state === 'loading') { renderer.render(scene, camera); return; }
  if (G.state === 'travel') { input.endFrame(); return; }

  renderer.info.reset();
  input.poll();
  // teclas globales
  if (G.state === 'title' && input.hit('Enter', 'Space', 'PadA', 'PadStart')) begin();
  else if (G.state === 'select') {
    const st = Math.round(input.state.steer);
    if (input.hit('ArrowLeft', 'KeyA') || (st < 0 && selPrevSteer >= 0 && !input.keys.size)) { showChoice(G.choice - 1); audio.beep(false); }
    if (input.hit('ArrowRight', 'KeyD') || (st > 0 && selPrevSteer <= 0 && !input.keys.size)) { showChoice(G.choice + 1); audio.beep(false); }
    selPrevSteer = st;
    if (input.hit('Enter', 'Space', 'PadA', 'PadStart')) confirmChoice();
    const keys = Object.keys(CONFIG.difficulties), di = keys.indexOf(G.diffKey);
    if (input.hit('ArrowUp', 'KeyW')) setDifficulty(keys[Math.max(0, di - 1)]);
    if (input.hit('ArrowDown', 'KeyS')) setDifficulty(keys[Math.min(keys.length - 1, di + 1)]);
    CIRCUITS.forEach((c, i) => { if (input.hit(`Digit${i + 1}`)) pickCircuit(c.id); });
  }
  else if (G.state === 'intro' && input.hit('Enter', 'Space', 'Escape', 'PadA', 'PadStart')) { G.intro.t = G.intro.duration - 0.01; }
  else if (['countdown', 'race', 'finished'].includes(G.state)) {
    if (input.hit('KeyP', 'Escape', 'PadStart') && G.state !== 'finished') { G.paused = !G.paused; $('pause').hidden = !G.paused; if (G.state !== 'finished') audio.setEngines(!G.paused); }
    if (input.hit('KeyR', 'PadSelect')) restart(false);
    if (G.paused && input.hit('KeyI')) restart(true);
    if ((G.paused || G.state === 'finished') && input.hit('KeyV')) goSelect();
    if (G.state === 'finished' && input.hit('KeyN')) goNext();
    if (input.hit('KeyH')) setAssist(!G.assistOn);
  }
  if (input.hit('KeyM')) audio.toggleMute();
  document.body.classList.toggle('racing', (G.state === 'countdown' || G.state === 'race') && !G.paused);

  if (G.state === 'select') {
    G.time += dt;
    G.showroom.update(dt, innerWidth / innerHeight, G.ships);
    audio.engine(0, 0, 0, false);
  } else if (!G.paused) {
    G.time += dt;
    lavaUniforms.uTime.value = G.time;
    skyUniforms.uTime.value = G.time;
    if (G.state === 'intro') {
      updateIntro(dt);
      for (const sh of G.ships) sh.update(dt, { throttle: 0, brake: 0, steer: 0, abL: 0, abR: 0, boost: false }, true);
      audio.engine(0, 0, 0, false);
    } else if (G.state !== 'title') {
      updateRace(dt);
    }
    for (const sh of G.ships) sh.trails.update(sh, dt);
    emitIon(dt);
    emitDamage(dt);
    G.fx.damage.update(dt, camera, renderer);
    G.fx.engine.update(dt, camera, G.time);
    for (const sh of G.ships) sh.respawned = false;
    G.fx.sparks.update(dt, camera, renderer);
    G.fx.rockets.update(dt, camera, renderer);
  }
  if (G.state !== 'select') G.fx.motes.update(camera, G.paused ? 0 : dt);
  if (G.state !== 'select' && !G.paused) G.circuitFx?.update(dt, camera, G);
  if (!G.flyers && G.track && G.ships.length) G.flyers = new Flyers(scene, G.track, G.ships, G.circuitId === 'olympus' ? 8 : 6);
  if (G.flyers && G.state !== 'select' && !G.paused) G.flyers.update(dt);
  if (G.flyers) G.flyers.group.visible = G.state !== 'select';

  // dentro del túnel baja la luz global (el techo y las cuadernas ya arrojan sombra)
  trackUniforms.uTime.value = G.time;
  const tn = G.structures?.tunnel;
  let inside = 0;
  if (tn && G.state !== 'select' && G.state !== 'title' && G.state !== 'intro') {
    const d = G.track.delta(tn.s, G.ship.s);
    inside = Math.min(THREE.MathUtils.smoothstep(d, -10, 30), 1 - THREE.MathUtils.smoothstep(d, tn.len - 30, tn.len + 10));
  }
  G.dim = (G.dim || 0) + (inside - (G.dim || 0)) * Math.min(1, dt * 3);
  const L = G.light || { sunI: 2.5, hemiI: 0.6, env: 0.85 };
  sun.intensity = L.sunI * (1 - 0.8 * G.dim);
  hemi.intensity = L.hemiI * (1 - 0.55 * G.dim);
  scene.environmentIntensity = L.env * (1 - 0.6 * G.dim);

  // la sombra sigue a la nave del jugador
  sun.target.position.copy(G.ship.root.position);
  sun.position.copy(G.ship.root.position).addScaledVector(CONFIG.atmosphere.sunDir, 300);

  // grading dinámico
  const sp = G.state === 'select' ? 0 : Math.min(1, G.ship.v / G.ship.C.vmaxBoost);
  const boostOn = G.state !== 'select' && (G.ship.boosting || G.ship.boostKick > 0);
  grade.uniforms.uTime.value = G.time;
  grade.uniforms.uAberr.value += ((sp * sp * 0.006 + (boostOn ? 0.008 : 0)) - grade.uniforms.uAberr.value) * Math.min(1, dt * 4);
  grade.uniforms.uBlur.value += (((boostOn ? 1 : 0) * sp) - grade.uniforms.uBlur.value) * Math.min(1, dt * 4);

  if (!G.noRender) { if (CONFIG.post) composer.render(dt); else renderer.render(renderPass.scene, renderPass.camera); }
  input.endFrame();

  if (CONFIG.debug) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`; fpsAcc = 0; fpsN = 0; }
  }
}
// cabecera: la música arranca con el primer gesto (los navegadores no dejan sonar antes)
const firstGesture = () => { if (G.state === 'title' || G.state === 'loading') audio.music(true); else audio.music(); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); };
addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);
G.tick = tick; G.input = input; G.audio = audio; G.AIDriver = AIDriver;
G.showChoice = showChoice; G.begin = begin; G.confirm = confirmChoice; G.select = goSelect; G.next = goNext; G.pickCircuit = pickCircuit; G.buildCircuit = (id) => buildCircuit(circuitById(id));
G.renderer = renderer; G.camera = camera; G.scene = scene; G.composer = composer;
G.aoPass = aoPass; G.setAO = (on) => { aoOn = on; setView(renderPass.scene, renderPass.camera); };
if (!location.search.includes('test')) requestAnimationFrame(frame);
// simulación acelerada para pruebas: G.sim(segundos)
G.sim = (sec, dt = 1 / 30) => { G.noRender = true; for (let t = 0; t < sec; t += dt) tick(dt); G.noRender = false; tick(0.0001); };
