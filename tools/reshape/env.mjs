const noop = new Proxy(function () {}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : noop, apply: () => noop, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop, style: {} }) };
globalThis.window = globalThis; globalThis.location = { search: '' }; Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); globalThis.matchMedia = () => ({ matches: false }); globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.localStorage = { getItem: () => null, setItem() {} };
export const THREE = await import('/home/claude/game/node_modules/three/build/three.module.js');
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const { CIRCUITS } = await import('/home/claude/game/js/circuits.js');
const mods = { itaka: ['itaka.js', 'buildItaka'], olympus: ['mars.js', 'buildMars'], tharsis: ['tharsis.js', 'buildTharsis'], cassini: ['cassini.js', 'buildCassini'], tiphares: ['tiphares.js', 'buildTiphares'], europa: ['europa.js', 'buildEuropa'], miranda: ['miranda.js', 'buildMiranda'], phobos: ['phobos.js', 'buildPhobos'] };
export async function build(id) {
  const [f, fn] = mods[id];
  const m = await import('/home/claude/game/js/' + f + '?' + Date.now());
  const world = new THREE.Group(), own = [];
  const renderer = { getRenderTarget: () => null, setRenderTarget() {}, render() {}, capabilities: { getMaxAnisotropy: () => 8 }, getPixelRatio: () => 1 };
  const def = CIRCUITS.find((c) => c.id === id);
  const srcMat = () => new THREE.MeshStandardMaterial();
  const r = m[fn](def, { world, own, renderer, srcMat });
  world.updateMatrixWorld(true);
  return { ...r, world };
}
