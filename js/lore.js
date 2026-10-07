// ─────────────────────────────────────────────────────────────
//  SARUS · capa creativa: nodos del Solar Map, fichas de circuito y de escudería.
//  Terminología de campeonato en inglés (archivo técnico); texto narrativo en español.
//  Regla: mostrar mundo antes que explicarlo. Nada de esto aparece en el HUD de carrera.
// ─────────────────────────────────────────────────────────────

export const SARUS = { name: 'SARUS', full: 'Solar Advanced Racing Union Series', origin: 'Speed Advanced Racing Über Skies' };

// ── Ruta del campeonato: diez nodos en el orden del Solar Map ──
// circuits: ids internos de circuits.js (Marte tiene dos). belt: aún sin circuito.
export const NODES = [
  { n: 1, id: 'earth', label: 'EARTH', title: 'ARCADIA', system: 'EARTH', place: 'ARCADIA COAST', circuits: ['arcadia'] },
  { n: 2, id: 'moon', label: 'LUNA', title: 'SELENE', system: 'EARTH ORBIT', place: 'MARE BASIN STATION', circuits: ['saturn'] },
  { n: 3, id: 'venus', label: 'VENUS', title: 'TIPHARES', system: 'VENUS', place: 'CLOUD SEA · 54 KM ALTITUDE', circuits: ['tiphares'] },
  { n: 4, id: 'itaka', label: 'NUEVA ITAKA', title: 'NUEVA ITAKA', system: 'CISLUNAR ORBIT', place: 'SARUS HEADQUARTERS', circuits: ['itaka'] },
  { n: 5, id: 'mars', label: 'MARS', title: 'MARS', system: 'MARS', place: 'OLYMPUS MONS · THARSIS PLATEAU', circuits: ['olympus', 'tharsis'] },
  { n: 6, id: 'phobos', label: 'PHOBOS', title: 'PHOBOS', system: 'MARS SYSTEM', place: 'STICKNEY CRATER', circuits: ['phobos'] },
  { n: 7, id: 'belt', label: 'ASTEROID BELT', title: 'CERES TRANSIT', system: 'MAIN BELT', place: 'SURVEY IN PROGRESS', circuits: [], soon: true,
    gravity: '0.03 G', archive: 'Survey in progress. Course geometry under reconstruction at the Nueva Itaka archive.' },
  { n: 8, id: 'europa', label: 'EUROPA', title: 'EUROPA', system: 'JUPITER SYSTEM', place: 'ICE CRUST · LINEAE', circuits: ['europa'] },
  { n: 9, id: 'saturn', label: 'SATURN', title: 'CASSINI', system: 'SATURN SYSTEM', place: 'RING PLANE · CASSINI DIVISION', circuits: ['cassini'] },
  { n: 10, id: 'uranus', label: 'MIRANDA', title: 'MIRANDA', system: 'URANUS SYSTEM', place: 'VERONA RUPES', circuits: ['miranda'] },
];

// ── Ficha de circuito: nombre de competición · localización · archivo ──
// archive: ADN de archivo (sin nombres de circuitos reales ni marcas). year: reconstrucción ficticia.
export const CIRCUIT_LORE = {
  arcadia: { code: 'ARCADIA', gravity: '1.00 G', surface: 'Coastal limestone · terraced city', diff: 1, year: 2191,
    archive: 'Original SARUS geometry. The first course drawn at the Nueva Itaka archive: a coastline the old Earth never had.' },
  saturn: { code: 'SELENE', gravity: '0.17 G', surface: 'Mare basalt · regolith', diff: 2, year: 2187,
    archive: 'Founding course of the Union. Original geometry, poured into a lunar mare for the first season. Earth hangs over the start line.' },
  tiphares: { code: 'TIPHARES', gravity: '0.90 G', surface: 'Floating platforms · nacre and gold', diff: 2, year: 2203,
    archive: 'Rebuilt from a southern city autodrome in the terrestrial archive. Where the lake once was, the lotus citadel now floats.' },
  itaka: { code: 'NUEVA ITAKA', gravity: '0.85 G · spin', surface: 'Glass tube · hexagonal tunnels', diff: 3, year: 2196,
    archive: 'Fragments of the longest forest loop in the archive, folded into a glass tube around the island that hosts the Union.' },
  olympus: { code: 'OLYMPUS', gravity: '0.38 G', surface: 'Basaltic shield · lava tubes', diff: 3, year: 2209,
    archive: 'A valley course from the archive: the climb out of the valley floor survives almost intact on the caldera rim.' },
  tharsis: { code: 'THARSIS SIERRA', gravity: '0.38 G', surface: 'Volcanic plateau · stadium city', diff: 3, year: 2212,
    archive: 'Plateau circuit from a mid-century archive record, rebuilt between the three Tharsis giants.' },
  phobos: { code: 'PHOBOS', gravity: '0.0006 G', surface: 'Carbonaceous regolith · bored rock', diff: 5, year: 2218,
    archive: 'Harbour street course, archive configuration c. 1950. Its waterfront tunnel was bored again, this time through a moon.' },
  europa: { code: 'EUROPA', gravity: '0.13 G', surface: 'Water ice · lineae · chasms', diff: 4, year: 2224,
    archive: 'Anticlockwise highland city course from the archive. The old lake descent now plunges into an ice chasm.' },
  cassini: { code: 'CASSINI', gravity: 'MICRO-G', surface: 'Ring ice · rock fragments', diff: 4, year: 2231,
    archive: 'Volcano-side course, archive configuration of the mid-1970s, laid over the gap between the rings.' },
  miranda: { code: 'MIRANDA', gravity: '0.008 G', surface: 'Ice cliffs · grooved terrain', diff: 5, year: 2236,
    archive: 'The only figure-eight in the archive. Its crossover became a bridge above the highest cliff in the Solar System.' },
};

// ── Familias de vehículo (filtro del hangar) ──
export const FAMILIES = [
  { id: 'balanced', label: 'BALANCED', sub: 'Versatility · easy to pilot' },
  { id: 'speed', label: 'SPEED', sub: 'Top speed · acceleration' },
  { id: 'handling', label: 'HANDLING', sub: 'Control · grip · precision' },
  { id: 'heavy', label: 'HEAVY', sub: 'Mass · armor · endurance' },
  { id: 'experimental', label: 'EXPERIMENTAL', sub: 'Prototypes · aggressive · unclassified' },
];

// ── Linajes corporativos (worldbuilding; se presentan la primera vez que se entra al hangar) ──
export const LINEAGES = {
  earth: { label: 'OLD EARTH HOUSES', text: 'Herederas de fabricantes terrestres anteriores a la expansión orbital.' },
  orbital: { label: 'ORBITAL INDUSTRIES', text: 'Nacidas con las estaciones, los puertos y el transporte entre órbitas.' },
  outer: { label: 'OUTER SYSTEM TEAMS', text: 'Ligadas a colonias lejanas y a entornos extremos.' },
  lab: { label: 'EXPERIMENTAL / INDEPENDENT', text: 'Laboratorios y fabricantes radicales sin industria que los respalde.' },
};

// ── Escuderías: clave = nodo de la nave en el GLB ──
// house: escudería · model: modelo · sector: especialidad · origin: procedencia (una línea)
// doctrine: una frase (ficha) · lore: texto ampliado (MORE DATA)
export const SHIP_LORE = {
  ILION_1: { house: 'ILION FORGE', model: 'ACHILLES', family: 'speed', lineage: 'earth', cls: 'SPEED / HEAVY PERFORMANCE',
    sector: 'Structural Heavy Engineering', origin: 'Orbital station frames',
    doctrine: 'Estabilidad absoluta a velocidad extrema.',
    lore: 'ILION empezó fabricando bastidores de carga para estaciones orbitales y llevó esa rigidez estructural a sus chasis de competición.' },
  SCUBA_2: { house: 'SCUBA EXPLORATIONS', model: 'E-7', family: 'handling', lineage: 'outer', cls: 'HANDLING / PRECISION',
    sector: 'Subsurface Exploration Systems', origin: 'Europa Oceanic Research Program',
    doctrine: 'Navegación creada para océanos extraterrestres, adaptada a la competición.',
    lore: 'SCUBA adaptó sistemas de navegación pensados para los océanos bajo el hielo de Europa: precisión intacta incluso cuando la tracción desaparece.' },
  THULE_3: { house: 'THULE DEFENSES', model: 'BOREAL', family: 'handling', lineage: 'outer', cls: 'HANDLING / LIGHT PERFORMANCE',
    sector: 'Frontier Technologies', origin: 'Remote outposts · low-infrastructure regions',
    doctrine: 'Masa mínima, respuesta inmediata.',
    lore: 'THULE diseña máquinas para funcionar lejos de cualquier infraestructura estable. Sus naves de carreras conservan esa filosofía: ligereza, autonomía y sistemas robustos.' },
  LUDOX_4: { house: 'CALIBUR SYSTEMS', model: 'LX-8', family: 'heavy', lineage: 'earth', cls: 'HEAVY / TECHNICAL',
    sector: 'Control & Automation Systems', origin: 'Automated transport networks',
    doctrine: 'Comportamiento calculado: predecible, estable, imperturbable.',
    lore: 'CALIBUR desarrolló sistemas de control para el transporte automatizado y los trasladó a vehículos de comportamiento extremadamente calculado.' },
  PRIMEX_5: { house: 'PRIME-EX', model: 'PX-01', family: 'balanced', lineage: 'orbital', cls: 'BALANCED / STANDARD', recommended: true,
    sector: 'Prototype Division', origin: 'Inter-industry homologation platform',
    doctrine: 'La plataforma estándar del campeonato.',
    lore: 'PRIME-EX no representa a ninguna industria: nació como plataforma común de homologación para comparar tecnologías rivales en condiciones idénticas.' },
  WOLFEN_6: { house: 'WOLFEN MOTORS', model: 'FENRIR', family: 'experimental', lineage: 'earth', cls: 'AGGRESSIVE / MILITARY',
    sector: 'Tactical Machines', origin: 'Rapid Interception Division',
    doctrine: 'Aceleración agresiva y respuesta nerviosa.',
    lore: 'WOLFEN convirtió tecnología de interceptación y respuesta táctica en máquinas rapidísimas y difíciles de dominar.' },
  ADAX_7: { house: 'ADAX DYNAMICS', model: 'AX-12', family: 'experimental', lineage: 'lab', cls: 'EXPERIMENTAL',
    sector: 'Experimental Engineering', origin: 'Prototype laboratory',
    doctrine: 'Soluciones que aún no tienen industria.',
    lore: 'ADAX usa SARUS como entorno de validación para conceptos que todavía no pertenecen a ninguna industria establecida.' },
  NEXUS_8: { house: 'NEXUS AEROTECH', model: 'NX-9', family: 'balanced', lineage: 'orbital', cls: 'BALANCED / SPEED',
    sector: 'Orbital Transit', origin: 'Station-to-station transport networks',
    doctrine: 'Cada segundo de maniobra cuenta.',
    lore: 'NEXUS nació en las redes de transporte entre estaciones y puertos orbitales. Sus naves conservan la obsesión por la respuesta inmediata.' },
  MANTA_9: { house: 'X3LEE LABS', model: 'PROTOTYPE 03', family: 'experimental', lineage: 'lab', cls: 'EXPERIMENTAL / AGGRESSIVE',
    sector: 'Independent Research', origin: 'Materials, form and propulsion studies',
    doctrine: 'Romper estándares.',
    lore: 'X3LEE evita deliberadamente las arquitecturas convencionales. Cada una de sus máquinas es un demostrador experimental.' },
  BERLIN_10: { house: 'BERLIN KRAFTWERK', model: 'ADLER-17', family: 'speed', lineage: 'earth', cls: 'SPEED / INDUSTRIAL PERFORMANCE',
    sector: 'Advanced Mobility Engineering', origin: 'Old Earth Industrial Heritage',
    doctrine: 'Ingeniería disciplinada para la velocidad punta.',
    lore: 'BERLIN KRAFTWERK procede de una tradición industrial terrestre anterior a la expansión orbital. Su prestigio: máquinas duraderas, rápidas y extremadamente precisas.' },
  X3LEE_11: { house: 'MANTA MAGNETICS', model: 'RAY', family: 'handling', lineage: 'orbital', cls: 'HANDLING / PRECISION',
    sector: 'Orbital Mobility', origin: 'Hydrodynamic and atmospheric research',
    doctrine: 'Fluir con el medio en lugar de luchar contra él.',
    lore: 'MANTA adapta principios del desplazamiento submarino y atmosférico a vehículos de competición de bajísima resistencia.' },
  HUEMING_12: { house: 'HUE-MING TECHNOLOGIES', model: 'HM-8', family: 'handling', lineage: 'earth', cls: 'HANDLING / TECHNICAL',
    sector: 'Precision Instrumentation', origin: 'Aerospace navigation systems',
    doctrine: 'Cada corrección, mínima y exacta.',
    lore: 'HUE-MING construye sus vehículos alrededor de una premisa: cada corrección de trayectoria debe ser mínima, exacta y predecible.' },
  VEGA_13: { house: 'VEGA CORPORATION', model: 'V-11', family: 'speed', lineage: 'outer', cls: 'SPEED / AGGRESSIVE',
    sector: 'Propulsion Industries', origin: 'Launch systems and accelerators',
    doctrine: 'Máxima energía en el mínimo tiempo.',
    lore: 'VEGA viene de la industria de la propulsión. Sus máquinas se diseñan alrededor del motor, y no al revés.' },
  RAMA_14: { house: 'RAMA AEROSPACE', model: 'PEARL-14', family: 'speed', lineage: 'orbital', cls: 'SPEED / LUXURY PERFORMANCE',
    sector: 'Aerospace Atelier', origin: 'Premium Orbital Transport',
    doctrine: 'Velocidad, ligereza y diseño escultórico.',
    lore: 'RAMA convirtió la ingeniería de transporte de alto nivel en un oficio casi artesanal. Sus naves compiten por rendimiento y por presencia.' },
  UBIK_15: { house: 'UBIK INDUSTRIES', model: 'OBSIDIAN', family: 'heavy', lineage: 'lab', cls: 'HEAVY / INDUSTRIAL',
    sector: 'Advanced Materials', origin: 'High-impact and radiation composites',
    doctrine: 'Masa, estabilidad y absorción de impacto.',
    lore: 'UBIK desarrolló materiales para entornos de alto impacto y radiación. Sus chasis apenas se inmutan.' },
  ALTAIR_16: { house: 'ALTAIR SPACECRAFT', model: 'AQUILA', family: 'speed', lineage: 'outer', cls: 'SPEED',
    sector: 'High-Speed Systems', origin: 'Interplanetary express courier',
    doctrine: 'Velocidad punta y respuesta firme.',
    lore: 'ALTAIR nació resolviendo un problema simple: mover cargas pequeñas entre mundos más rápido que nadie.' },
  KIBEROS_17: { house: 'KYBEROS ARMORING', model: 'CERBERUS', family: 'heavy', lineage: 'orbital', cls: 'HEAVY / AGGRESSIVE',
    sector: 'Escort & Armored Platforms', origin: 'Orbital escort fleets',
    doctrine: 'Blindaje, masa y combate.',
    lore: 'KYBEROS convirtió plataformas de escolta y protección en máquinas capaces de sobrevivir a impactos que retirarían a cualquier otra.' },
  ORION_18: { house: 'ORION AERONAUTICS', model: 'HUNTER', family: 'balanced', lineage: 'outer', cls: 'BALANCED / EXPLORATION',
    sector: 'Deep Space Systems', origin: 'Long-range exploration and search',
    doctrine: 'Persecución y equilibrio ofensivo.',
    lore: 'ORION desarrolla vehículos capaces de operar mucho tiempo lejos de cualquier infraestructura humana: en carrera, equilibrio y fiabilidad.' },
};

export const MOTTO = 'SARUS no enfrenta dieciocho naves. Enfrenta dieciocho filosofías tecnológicas.';
