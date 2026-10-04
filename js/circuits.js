// Circuitos del campeonato. Los dos usan el mismo GLB (SATURN-6_v03): cambian sentido, relieve,
// atmósfera, luz, grading y materiales. ARCADIA-2 se desbloquea al terminar SATURN-6.
import * as THREE from 'three';

const hex = (h) => new THREE.Color(h);

export const CIRCUITS = [
  {
    id: 'saturn',
    name: 'SATURN-6',
    sub: 'Circuito v03',
    blurb: 'Estación en la niebla',
    inSectorOrder: true,
    relief: { amplify: 1.45, hills: [[18, 6, 0.7], [9, 11, 2.1]] },
    hoverMax: 5,
    atmosphere: {
      sunDir: new THREE.Vector3(0.78, 0.26, -0.56).normalize(),
      baseDensity: 0.00034, heightDensity: 0.0011, heightFalloff: 0.0058, fogMax: 0.985,
      exposure: 0.76, saturation: 0.3,
      bloom: { strength: 0.38, radius: 0.55, threshold: 0.92 },
      sky: {
        horizon: [0.64, 0.595, 0.53], zenith: [0.29, 0.292, 0.29], below: [0.31, 0.29, 0.265], zLow: 0.02, zHigh: 0.62,
        glow: [1.0, 0.8, 0.55], glowK: 0.16, sun: [1.0, 0.9, 0.75], halo: 0.22, corona: 0.38, disc: 1.6,
      },
      clouds: null,
    },
    light: { sun: 0xffdcb4, sunI: 2.5, hemiSky: 0xd8cbb6, hemiGround: 0x241d18, hemiI: 0.6, env: 0.85 },
    grade: { tint: [1.045, 1.0, 0.925], vignette: 0.42, grain: 0.045, contrast: 0.22 },
    // pintura de pista (uniforms de dressing.js)
    paint: {
      edge: [1.0, 0.46, 0.08], chev: [0.9, 0.12, 0.05], lane: [0.86, 0.84, 0.78],
      kerbA: [0.85, 0.83, 0.78], kerbB: [0.95, 0.14, 0.05], edgeGlow: 0.45, chevGlow: 0.22, kerbGlow: 0.18,
      buoy: 0xff3c0a, guide: 0xff7a18,
    },
    structures: { dark: 0x1b1d1e, pale: 0x8f8e88, lamp: 0xff7a1c, ivory: 0xf1ece0 },
    pad: 0x1b1d1e,
    cards: ['Speed Racing Skies', 'SATURN-6'],
  },
  {
    id: 'arcadia',
    name: 'ARCADIA-2',
    sub: 'Costa · sentido inverso',
    blurb: 'Costa al sol · sentido inverso · desniveles extremos',
    unlockAfter: 'saturn',
    inSectorOrder: false,            // al revés que SATURN-6
    // mucho más desnivel; 'clamp' mantiene holgura sobre el terreno y los edificios
    relief: { amplify: 2.25, hills: [[34, 4, 0.9], [20, 7, 2.5], [9, 13, 0.3]], clamp: { below: 30, above: 26 } },
    hoverMax: 8,                     // en las crestas se despega más
    atmosphere: {
      sunDir: new THREE.Vector3(0.52, 0.55, -0.65).normalize(),
      baseDensity: 0.00008, heightDensity: 0.00016, heightFalloff: 0.0032, fogMax: 0.86,
      exposure: 0.84, saturation: 1.0,
      bloom: { strength: 0.22, radius: 0.5, threshold: 0.97 },
      sky: {
        horizon: [0.60, 0.74, 0.86], zenith: [0.10, 0.28, 0.64], below: [0.16, 0.34, 0.46], zLow: -0.02, zHigh: 0.5,
        glow: [1.0, 0.86, 0.62], glowK: 0.14, sun: [1.0, 0.95, 0.84], halo: 0.16, corona: 0.42, disc: 2.2,
      },
      clouds: { scale: 1.15, cover: 0.5, opacity: 0.92, light: [1.02, 1.0, 0.97], shadow: [0.56, 0.62, 0.72] },
    },
    light: { sun: 0xfff0d8, sunI: 3.1, hemiSky: 0xb8d4f5, hemiGround: 0x5d6b35, hemiI: 0.95, env: 1.0 },
    grade: { tint: [1.02, 1.0, 0.97], vignette: 0.26, grain: 0.02, contrast: 0.16 },
    paint: {
      edge: [0.95, 0.95, 0.92], chev: [0.95, 0.16, 0.5], lane: [1.0, 0.8, 0.12],
      kerbA: [1.0, 0.78, 0.08], kerbB: [0.1, 0.42, 0.92], edgeGlow: 0.08, chevGlow: 0.12, kerbGlow: 0.05,
      buoy: 0xff2a8a, guide: 0x19e0cc,
    },
    structures: { dark: 0xe6dfd2, pale: 0xc4623a, lamp: 0x19e0cc, ivory: 0xfff6e0 },
    pad: 0xe2dccf,
    cards: ['Speed Racing Skies', 'ARCADIA-2'],
    // Recoloreado de piezas del GLB: [regex del objeto, regex del material, color | {paint:[…], cell}]
    recolor: [
      [/^LAND \| utility/, /Charcoal/, { paint: [0xf4efe4, 0xd46a3c, 0x2f9fb2, 0xf0c040, 0xe86a8a], cell: 36 }],
      [/^Pylon/, /Charcoal/, 0xc85a36],
      [/^Pylon/, /Ash concrete/, 0xece4d3],
      [/^Cantilever rib/, /Ash concrete/, 0x2b93a8],
      [/^Deck expansion joint/, /Charcoal/, 0xeae4d6],
      [/^MONOLITH/, /Charcoal/, { paint: [0xeee7d8, 0xd08a4a, 0x3a8fb0, 0xc85a36, 0xe8c14a], cell: 240 }],
      [/^MONOLITH/, /Ash concrete/, 0xdcc49e],
      [/^MONOLITH/, /Pale mineral/, 0xf2eee4],
      [/^CITY/, /Charcoal/, 0xe2d6c0],
      [/^PITS/, /Charcoal/, 0xe8e2d6],
      [/^PITS/, /Ash concrete/, 0xf2b33d],
      [/^Sector/, /Charcoal/, 0xf4f1ea],
      [/^Sector/, /Ash concrete/, 0xe0465a],
      [/^(OVERPASS|TECH|TRACK)/, /Charcoal/, 0xb4b8bc],
      [/^OVERPASS/, /Ash concrete/, 0xd9c7a4],
      [/^GUARD/, /./, 0xd9d6cf],
    ],
    // materiales enteros por nombre (sin mirar el objeto)
    matTweaks: {
      'S6 | City arterial lights': { emissive: 0xfff0c8, emissiveIntensity: 0.35 },
      'S6 | Muted cyan checkpoints': { emissive: 0x19e0cc, emissiveIntensity: 1.6 },
      'S6 | UV worn technology': { color: 0x9a9da2, metalness: 0.22 },
      'S6 | Satin silver edges': { color: 0xc9cdd1 },
      'S6 | Ivory route markers': { emissiveIntensity: 0.4 },
    },
    seaLevel: -50,                   // el mar cubre las placas bajas de la cuenca
    moons: { big: false, small: { haze: 0.72, tint: [0.8, 0.82, 0.86] } },
    env: 'arcadia',
  },
];

// Tercera fase: Marte, borde de la caldera del Olympus Mons (circuito generado en mars.js)
CIRCUITS.push({
  id: 'olympus',
  name: 'OLYMPUS-3',
  sub: 'Marte · Olympus Mons',
  blurb: 'Marte · borde de la caldera del Olympus Mons · saltos y túnel en la lava',
  unlockAfter: 'arcadia',
  generated: 'mars',
  inSectorOrder: false,
  hoverMax: 8,
  far: 300000,
  rockets: false,
  sunFrom: 'mars',
  atmosphere: {
    sunDir: new THREE.Vector3(0.6, 0.075, -0.8).normalize(),   // se recalcula con el trazado (marsSunDir)
    baseDensity: 0.00008, heightDensity: 0.00011, heightFalloff: 0.00036, fogMax: 0.95,
    exposure: 0.8, saturation: 0.5, redKeep: 0.5,
    bloom: { strength: 0.42, radius: 0.7, threshold: 0.9 },
    sky: {
      horizon: [0.56, 0.43, 0.38], zenith: [0.42, 0.35, 0.34], below: [0.4, 0.27, 0.2], zLow: 0.0, zHigh: 0.7,
      glowMix: { color: [0.12, 0.3, 0.72], exp: 5, k: 1.1 },
      glow: [0.05, 0.22, 0.65], glowK: 0.4, glowExp: 30,
      haloCol: [0.3, 0.65, 1.0], halo: 0.3, haloExp: 500,
      sun: [0.8, 0.95, 1.0], corona: 0.4, coronaExp: 3000, disc: 2.2, discExp: 60000,
    },
    clouds: { scale: 0.7, cover: 0.63, opacity: 0.28, light: [0.86, 0.8, 0.78], shadow: [0.58, 0.48, 0.45] },
  },
  light: { sun: 0xdfe8ff, sunI: 1.7, hemiSky: 0xb98f80, hemiGround: 0x4a2214, hemiI: 1.1, env: 0.7 },
  grade: { tint: [1.04, 0.97, 0.93], vignette: 0.48, grain: 0.05, contrast: 0.3 },
  paint: {
    edge: [0.9, 0.88, 0.84], chev: [0.95, 0.38, 0.1], lane: [0.8, 0.78, 0.74],
    kerbA: [0.86, 0.84, 0.8], kerbB: [0.9, 0.32, 0.08], edgeGlow: 0.3, chevGlow: 0.2, kerbGlow: 0.12,
    buoy: 0xff5a14, guide: 0xffb070,
  },
  structures: { dark: 0x2a2522, pale: 0x8a817a, lamp: 0xff8a3c, ivory: 0xfff0dc },
  pad: 0x2a2522,
  cards: ['Speed Racing Skies', 'OLYMPUS-3'],
  wind: [24, 1.2, -9],
});

// Cuarta fase: NUEVA-ITAKA, isla flotante en órbita (circuito generado en itaka.js)
CIRCUITS.push({
  id: 'itaka',
  name: 'NUEVA-ITAKA',
  sub: 'Isla orbital · tubo de cristal',
  blurb: 'Isla flotante en órbita · tubo de cristal continuo · túneles hexagonales y dos colinas',
  unlockAfter: 'olympus',
  generated: 'itaka',
  inSectorOrder: false,
  hoverMax: 7,
  far: 320000,
  rockets: false,
  atmosphere: {
    sunDir: new THREE.Vector3(-0.62, 0.36, -0.7).normalize(),
    baseDensity: 0.000004, heightDensity: 0.0, heightFalloff: 0.001, fogMax: 0.3,
    exposure: 0.95, saturation: 0.9,
    bloom: { strength: 0.34, radius: 0.55, threshold: 0.86 },
    sky: {
      horizon: [0.006, 0.008, 0.014], zenith: [0.002, 0.003, 0.006], below: [0.004, 0.005, 0.01], zLow: -0.2, zHigh: 0.6,
      glow: [0.9, 0.9, 1.0], glowK: 0.05, glowExp: 60, haloCol: [1.0, 0.97, 0.9], halo: 0.12, haloExp: 900,
      sun: [1.0, 0.98, 0.94], corona: 0.6, coronaExp: 4000, disc: 6.0, discExp: 40000,
    },
    clouds: null,
  },
  light: { sun: 0xfff6ea, sunI: 3.0, hemiSky: 0x9fb8d8, hemiGround: 0x1d2a1f, hemiI: 0.55, env: 0.6 },
  grade: { tint: [0.98, 1.0, 1.04], vignette: 0.4, grain: 0.03, contrast: 0.24 },
  paint: {
    edge: [0.85, 0.95, 1.0], chev: [0.2, 0.8, 1.0], lane: [0.88, 0.9, 0.92],
    kerbA: [0.9, 0.92, 0.95], kerbB: [0.15, 0.7, 0.95], edgeGlow: 0.5, chevGlow: 0.35, kerbGlow: 0.2,
    buoy: 0x39d5ff, guide: 0x7fe8ff,
  },
  structures: { dark: 0x23282c, pale: 0x9aa4ab, lamp: 0x4fdcff, ivory: 0xeef6ff },
  pad: 0x23282c,
  cards: ['Speed Racing Skies', 'NUEVA-ITAKA'],
});

// Quinta fase: THARSIS SIERRA, Marte, meseta de Tharsis con los tres volcanes al fondo; estadio y ciudad
// (trazado inspirado en el Jarama; tharsis.js)
CIRCUITS.push({
  id: 'tharsis',
  name: 'THARSIS SIERRA',
  sub: 'Marte · meseta de Tharsis',
  blurb: 'Marte · estadio y ciudad en la meseta de Tharsis · la sierra y los tres volcanes al fondo',
  unlockAfter: 'itaka',
  generated: 'tharsis',
  inSectorOrder: false,
  hoverMax: 7,
  far: 340000,
  rockets: false,
  sunFrom: 'tharsis',
  atmosphere: {
    sunDir: new THREE.Vector3(0.95, 0.1, 0.2).normalize(),
    baseDensity: 0.00003, heightDensity: 0.0002, heightFalloff: 0.0016, fogMax: 0.8,
    exposure: 0.84, saturation: 0.78, redKeep: 0.7,
    bloom: { strength: 0.5, radius: 0.62, threshold: 0.82 },
    sky: {
      horizon: [0.86, 0.6, 0.42], zenith: [0.32, 0.22, 0.21], below: [0.52, 0.33, 0.22], zLow: -0.02, zHigh: 0.55,
      glowMix: { color: [0.36, 0.52, 0.78], exp: 9, k: 0.7 },
      glow: [0.5, 0.62, 0.85], glowK: 0.18, glowExp: 24,
      haloCol: [0.6, 0.75, 1.0], halo: 0.22, haloExp: 400,
      sun: [1.0, 0.92, 0.8], corona: 0.45, coronaExp: 2600, disc: 2.4, discExp: 50000,
    },
    clouds: { scale: 1.2, cover: 0.58, opacity: 0.32, light: [0.98, 0.82, 0.68], shadow: [0.6, 0.44, 0.38] },
  },
  light: { sun: 0xffd2a8, sunI: 2.5, hemiSky: 0xc69478, hemiGround: 0x4a2414, hemiI: 0.95, env: 0.6 },
  grade: { tint: [1.04, 0.98, 0.93], vignette: 0.44, grain: 0.04, contrast: 0.26 },
  paint: {
    edge: [1.0, 0.62, 0.25], chev: [0.95, 0.3, 0.1], lane: [0.9, 0.85, 0.78],
    kerbA: [0.92, 0.9, 0.86], kerbB: [0.12, 0.62, 0.66], edgeGlow: 0.5, chevGlow: 0.3, kerbGlow: 0.18,
    buoy: 0xff7a2a, guide: 0x48e0d4,
  },
  structures: { dark: 0x1d1b1f, pale: 0xb59a80, lamp: 0xffa040, ivory: 0xfff0d8 },
  pad: 0x1d1b1f,
  cards: ['Speed Racing Skies', 'THARSIS SIERRA'],
  wind: [20, 1.0, -8],
});

export const circuitById = (id) => CIRCUITS.find((c) => c.id === id) || CIRCUITS[0];
export { hex };
