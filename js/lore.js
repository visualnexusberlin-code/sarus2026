// ─────────────────────────────────────────────────────────────
//  SARUS · capa creativa: nodos del Solar Map, fichas de circuito y de escudería.
//  Bilingüe: L('español', 'English'), elegido al cargar (i18n.js). Nombres propios sin traducir.
//  Regla: mostrar mundo antes que explicarlo. Nada de esto aparece en el HUD de carrera.
// ─────────────────────────────────────────────────────────────

import { L } from './i18n.js';

export const SARUS = { name: 'SARUS', full: 'Solar Advanced Racing Union Series', origin: 'Speed Advanced Racing Über Skies' };

// ── Ruta del campeonato: once nodos en el orden del Solar Map ──
// circuits: ids internos de circuits.js (Marte tiene dos). belt: aún sin circuito.
export const NODES = [
  { n: 1, id: 'earth', label: L('TIERRA', 'EARTH'), title: 'ARCADIA', system: L('TIERRA', 'EARTH'), place: L('COSTA DE ARCADIA', 'ARCADIA COAST'), circuits: ['arcadia'] },
  { n: 2, id: 'moon', label: L('LUNA', 'MOON'), title: 'SELENE', system: L('ÓRBITA TERRESTRE', 'EARTH ORBIT'), place: L('ESTACIÓN DEL MAR BASÁLTICO', 'MARE BASIN STATION'), circuits: ['saturn'] },
  { n: 3, id: 'venus', label: 'VENUS', title: 'TIPHARES', system: 'VENUS', place: L('MAR DE NUBES · 54 KM DE ALTITUD', 'CLOUD SEA · 54 KM ALTITUDE'), circuits: ['tiphares'] },
  { n: 4, id: 'mercury', label: L('MERCURIO', 'MERCURY'), title: 'CALORIS', system: L('MERCURIO', 'MERCURY'), place: L('CUENCA CALORIS · GALERÍAS', 'CALORIS BASIN · GALLERIES'), circuits: ['caloris'] },
  { n: 5, id: 'itaka', label: 'NUEVA ITAKA', title: 'NUEVA ITAKA', system: L('ÓRBITA CISLUNAR', 'CISLUNAR ORBIT'), place: L('SEDE DE SARUS', 'SARUS HEADQUARTERS'), circuits: ['itaka'] },
  { n: 6, id: 'mars', label: L('MARTE', 'MARS'), title: L('MARTE', 'MARS'), system: L('MARTE', 'MARS'), place: L('OLYMPUS MONS · MESETA DE THARSIS', 'OLYMPUS MONS · THARSIS PLATEAU'), circuits: ['olympus', 'tharsis'] },
  { n: 7, id: 'phobos', label: L('FOBOS', 'PHOBOS'), title: 'PHOBOS', system: L('SISTEMA DE MARTE', 'MARS SYSTEM'), place: L('CRÁTER STICKNEY', 'STICKNEY CRATER'), circuits: ['phobos'] },
  { n: 8, id: 'belt', label: L('CINTURÓN DE ASTEROIDES', 'ASTEROID BELT'), title: 'CERES TRANSIT', system: L('CINTURÓN PRINCIPAL', 'MAIN BELT'), place: L('ENJAMBRE DE CERES', 'CERES SWARM'), circuits: ['ceres'] },
  { n: 9, id: 'europa', label: 'EUROPA', title: 'EUROPA', system: L('SISTEMA DE JÚPITER', 'JUPITER SYSTEM'), place: L('CORTEZA DE HIELO · LINEAE', 'ICE CRUST · LINEAE'), circuits: ['europa'] },
  { n: 10, id: 'saturn', label: L('SATURNO', 'SATURN'), title: 'CASSINI', system: L('SISTEMA DE SATURNO', 'SATURN SYSTEM'), place: L('PLANO DE LOS ANILLOS · DIVISIÓN DE CASSINI', 'RING PLANE · CASSINI DIVISION'), circuits: ['cassini', 'enceladus'] },
  { n: 11, id: 'uranus', label: 'MIRANDA', title: 'MIRANDA', system: L('SISTEMA DE URANO', 'URANUS SYSTEM'), place: 'VERONA RUPES', circuits: ['miranda'] },
];

// ── Ficha de circuito: nombre de competición · localización · archivo ──
// archive: ADN de archivo (sin nombres de circuitos reales ni marcas). year: reconstrucción ficticia.
export const CIRCUIT_LORE = {
  arcadia: { code: 'ARCADIA', gravity: '1.00 G', surface: L('Caliza costera · ciudad en terrazas', 'Coastal limestone · terraced city'), diff: 1, year: 2191,
    archive: L('Geometría original de SARUS. El primer trazado dibujado en el archivo de Nueva Itaka: una costa que la vieja Tierra nunca tuvo.', 'Original SARUS geometry. The first course drawn at the Nueva Itaka archive: a coastline the old Earth never had.') },
  saturn: { code: 'SELENE', gravity: '0.17 G', surface: L('Basalto de mar lunar · regolito', 'Mare basalt · regolith'), diff: 2, year: 2187,
    archive: L('Trazado fundacional de la Unión. Geometría original, vertida en un mar lunar para la primera temporada. La Tierra cuelga sobre la línea de salida.', 'Founding course of the Union. Original geometry, poured into a lunar mare for the first season. Earth hangs over the start line.') },
  tiphares: { code: 'TIPHARES', gravity: '0.90 G', surface: L('Plataformas flotantes · nácar y oro', 'Floating platforms · nacre and gold'), diff: 2, year: 2203,
    archive: L('Dibujado por la Unión para el mar de nubes: un bucle rápido alrededor de la ciudadela loto, tendido sobre plataformas flotantes de nácar.', 'Drawn by the Union for the cloud sea: a fast loop wrapped around the lotus citadel, laid on floating nacre platforms.') },
  caloris: { code: 'CALORIS', gravity: '0.38 G', surface: L('Hormigón de fundición · regolito quemado', 'Foundry concrete · scorched regolith'), diff: 4, year: 2206,
    archive: L('Sobre un trazado de archivo, invertido y enterrado. Las fundiciones solares excavaron bajo la cuenca Caloris galerías a escala de catedral para huir del día de Mercurio; la carrera sale del único pozo abierto al sol y no vuelve a verlo hasta la meta.', 'Over an archive course, flipped and buried. The solar foundries dug cathedral-scale galleries beneath the Caloris basin to escape the Mercurian day; the race leaves from the only shaft open to the sun and does not see it again until the finish.') },
  itaka: { code: 'NUEVA ITAKA', gravity: L('0.85 G · rotación', '0.85 G · spin'), surface: L('Tubo de cristal · túneles hexagonales', 'Glass tube · hexagonal tunnels'), diff: 3, year: 2196,
    archive: L('El circuito de pruebas de la propia Unión y el más largo de la serie, plegado en un tubo de cristal alrededor de la isla.', 'The Union’s own proving loop and the longest course in the series, folded into a glass tube around the island.') },
  olympus: { code: 'OLYMPUS', gravity: '0.38 G', surface: L('Escudo basáltico · tubos de lava', 'Basaltic shield · lava tubes'), diff: 3, year: 2209,
    archive: L('Trazado sobre el borde de la caldera por las primeras cuadrillas marcianas: dos saltos sobre grietas abiertas y una carrera por un tubo de lava.', 'Laid along the caldera rim by the first Martian crews: two jumps over open fissures and a run through a lava tube.') },
  tharsis: { code: 'THARSIS SIERRA', gravity: '0.38 G', surface: L('Meseta volcánica · ciudad estadio', 'Volcanic plateau · stadium city'), diff: 3, year: 2212,
    archive: L('Circuito estadio de las colonias de Tharsis, dibujado entre la ciudad escalonada y los tres gigantes volcánicos.', 'Stadium course of the Tharsis colonies, drawn between the stepped city and the three volcanic giants.') },
  phobos: { code: 'PHOBOS', gravity: '0.0006 G', surface: L('Regolito carbonáceo · roca perforada', 'Carbonaceous regolith · bored rock'), diff: 5, year: 2218,
    archive: L('Perforado a través de la luna por sus mineros: salida en superficie, zambullida en el cráter Stickney y una larga carrera dentro de la roca.', 'Bored through the moon by its mining crews: a surface start, a dive into Stickney crater and a long run inside the rock.') },
  ceres: { code: 'CERES TRANSIT', gravity: L('0.03 G · rocas', '0.03 G · rocks'), surface: L('Regolito pardo · sales de sodio', 'Brown regolith · sodium salts'), diff: 5, year: 2221,
    archive: L('Corredor abierto por las cuadrillas de remolque a través de un enjambre junto a Ceres: un túnel de tres carriles, una geoda hueca y una pared que termina en el vacío.', 'A corridor cut by the tug crews through a swarm off Ceres: a three-lane bore, a hollow geode and a wall that ends in open space.') },
  europa: { code: 'EUROPA', gravity: '0.13 G', surface: L('Hielo de agua · lineae · simas', 'Water ice · lineae · chasms'), diff: 4, year: 2224,
    archive: L('Dibujado sobre la corteza helada por los asentamientos jovianos. Un descenso se hunde en una sima sobre la ciudad iluminada.', 'Drawn over the ice crust by the Jovian settlements. One descent plunges into a chasm above the lit city below.') },
  cassini: { code: 'CASSINI', gravity: 'MICRO-G', surface: L('Hielo de anillo · fragmentos de roca', 'Ring ice · rock fragments'), diff: 4, year: 2231,
    archive: L('Alzado sobre columnas ancladas en fragmentos de anillo, sobre el hueco entre los anillos. Sin suelo: solo hielo y luz.', 'Raised on columns anchored in ring fragments, over the gap between the rings. No ground, only ice and light.') },
  enceladus: { code: 'ENCELADUS', gravity: '0.011 G', surface: L('Hielo joven · rayas de tigre · géiseres', 'Young ice · tiger stripes · geysers'), diff: 5, year: 2233,
    archive: L('Trazado sobre el polo sur de Encélado, con la silueta de un viejo archipiélago de la Tierra. La mitad corre bajo la corteza, por los tubos blancos que levantaron sobre las estaciones abandonadas de la primera colonia.', 'Laid over the south pole of Enceladus in the outline of an old Earth archipelago. Half of it runs below the crust, through the white tubes raised over the abandoned stations of the first colony.') },
  miranda: { code: 'MIRANDA', gravity: '0.008 G', surface: L('Acantilados de hielo · terreno estriado', 'Ice cliffs · grooved terrain'), diff: 5, year: 2236,
    archive: L('Un trazado que se cruza: el puente sobre el cruce mira al acantilado más alto del sistema solar.', 'A crossing course: the bridge over the crossover looks down the highest cliff in the Solar System.') },
};

// ── Familias de vehículo (filtro del hangar) ──
export const FAMILIES = [
  { id: 'balanced', label: L('EQUILIBRADA', 'BALANCED'), sub: L('Versatilidad · fácil de pilotar', 'Versatility · easy to pilot') },
  { id: 'speed', label: L('VELOCIDAD', 'SPEED'), sub: L('Velocidad punta · aceleración', 'Top speed · acceleration') },
  { id: 'handling', label: L('MANEJO', 'HANDLING'), sub: L('Control · agarre · precisión', 'Control · grip · precision') },
  { id: 'heavy', label: L('PESADA', 'HEAVY'), sub: L('Masa · blindaje · resistencia', 'Mass · armor · endurance') },
  { id: 'experimental', label: 'EXPERIMENTAL', sub: L('Prototipos · agresivas · sin clasificar', 'Prototypes · aggressive · unclassified') },
];

// ── Linajes corporativos (worldbuilding; se presentan la primera vez que se entra al hangar) ──
export const LINEAGES = {
  earth: { label: L('CASAS DE LA VIEJA TIERRA', 'OLD EARTH HOUSES'), text: L('Herederas de fabricantes terrestres anteriores a la expansión orbital.', 'Heirs to Earth manufacturers that predate the orbital expansion.') },
  orbital: { label: L('INDUSTRIAS ORBITALES', 'ORBITAL INDUSTRIES'), text: L('Nacidas con las estaciones, los puertos y el transporte entre órbitas.', 'Born with the stations, the ports and the transport between orbits.') },
  outer: { label: L('EQUIPOS DEL SISTEMA EXTERIOR', 'OUTER SYSTEM TEAMS'), text: L('Ligadas a colonias lejanas y a entornos extremos.', 'Tied to distant colonies and extreme environments.') },
  lab: { label: L('EXPERIMENTALES / INDEPENDIENTES', 'EXPERIMENTAL / INDEPENDENT'), text: L('Laboratorios y fabricantes radicales sin industria que los respalde.', 'Labs and radical makers with no industry behind them.') },
};

// ── Escuderías: clave = nodo de la nave en el GLB ──
// house: escudería · model: modelo · sector: especialidad · origin: procedencia (una línea)
// doctrine: una frase (ficha) · lore: texto ampliado (MORE DATA)
export const SHIP_LORE = {
  ILION_1: { house: 'ILION FORGE', model: 'ACHILLES', family: 'speed', lineage: 'earth', cls: L('VELOCIDAD / ALTO RENDIMIENTO PESADO', 'SPEED / HEAVY PERFORMANCE'),
    sector: L('Ingeniería estructural pesada', 'Structural Heavy Engineering'), origin: L('Bastidores de estaciones orbitales', 'Orbital station frames'),
    doctrine: L('Estabilidad absoluta a velocidad extrema.', 'Absolute stability at extreme speed.'),
    lore: L('ILION empezó fabricando bastidores de carga para estaciones orbitales y llevó esa rigidez estructural a sus chasis de competición.', 'ILION began by building load frames for orbital stations and carried that structural rigidity into its racing chassis.') },
  SCUBA_2: { house: 'SCUBA EXPLORATIONS', model: 'E-7', family: 'handling', lineage: 'outer', cls: L('MANEJO / PRECISIÓN', 'HANDLING / PRECISION'),
    sector: L('Sistemas de exploración subsuperficial', 'Subsurface Exploration Systems'), origin: L('Programa de investigación oceánica de Europa', 'Europa Oceanic Research Program'),
    doctrine: L('Navegación creada para océanos extraterrestres, adaptada a la competición.', 'Navigation built for alien oceans, adapted to racing.'),
    lore: L('SCUBA adaptó sistemas de navegación pensados para los océanos bajo el hielo de Europa: precisión intacta incluso cuando la tracción desaparece.', 'SCUBA adapted navigation systems designed for the oceans beneath Europa’s ice: precision stays intact even when traction disappears.') },
  THULE_3: { house: 'THULE DEFENSES', model: 'BOREAL', family: 'handling', lineage: 'outer', cls: L('MANEJO / RENDIMIENTO LIGERO', 'HANDLING / LIGHT PERFORMANCE'),
    sector: L('Tecnologías de frontera', 'Frontier Technologies'), origin: L('Puestos remotos · regiones sin infraestructura', 'Remote outposts · low-infrastructure regions'),
    doctrine: L('Masa mínima, respuesta inmediata.', 'Minimum mass, instant response.'),
    lore: L('THULE diseña máquinas para funcionar lejos de cualquier infraestructura estable. Sus naves de carreras conservan esa filosofía: ligereza, autonomía y sistemas robustos.', 'THULE designs machines to work far from any stable infrastructure. Its racers keep that philosophy: lightness, autonomy and robust systems.') },
  LUDOX_4: { house: 'CALIBUR SYSTEMS', model: 'LX-8', family: 'heavy', lineage: 'earth', cls: L('PESADA / TÉCNICA', 'HEAVY / TECHNICAL'),
    sector: L('Sistemas de control y automatización', 'Control & Automation Systems'), origin: L('Redes de transporte automatizado', 'Automated transport networks'),
    doctrine: L('Comportamiento calculado: predecible, estable, imperturbable.', 'Calculated behaviour: predictable, stable, unshakeable.'),
    lore: L('CALIBUR desarrolló sistemas de control para el transporte automatizado y los trasladó a vehículos de comportamiento extremadamente calculado.', 'CALIBUR developed control systems for automated transport and moved them into vehicles of extremely calculated behaviour.') },
  PRIMEX_5: { house: 'PRIME-EX', model: 'PX-01', family: 'balanced', lineage: 'orbital', cls: L('EQUILIBRADA / ESTÁNDAR', 'BALANCED / STANDARD'), recommended: true,
    sector: L('División de prototipos', 'Prototype Division'), origin: L('Plataforma de homologación entre industrias', 'Inter-industry homologation platform'),
    doctrine: L('La plataforma estándar del campeonato.', 'The championship’s standard platform.'),
    lore: L('PRIME-EX no representa a ninguna industria: nació como plataforma común de homologación para comparar tecnologías rivales en condiciones idénticas.', 'PRIME-EX represents no industry: it was born as a shared homologation platform to compare rival technologies under identical conditions.') },
  WOLFEN_6: { house: 'WOLFEN MOTORS', model: 'FENRIR', family: 'experimental', lineage: 'earth', cls: L('AGRESIVA / MILITAR', 'AGGRESSIVE / MILITARY'),
    sector: L('Máquinas tácticas', 'Tactical Machines'), origin: L('División de interceptación rápida', 'Rapid Interception Division'),
    doctrine: L('Aceleración agresiva y respuesta nerviosa.', 'Aggressive acceleration and a nervous response.'),
    lore: L('WOLFEN convirtió tecnología de interceptación y respuesta táctica en máquinas rapidísimas y difíciles de dominar.', 'WOLFEN turned interception and tactical-response technology into blisteringly fast machines that are hard to tame.') },
  ADAX_7: { house: 'ADAX DYNAMICS', model: 'AX-12', family: 'experimental', lineage: 'lab', cls: L('EXPERIMENTAL', 'EXPERIMENTAL'),
    sector: L('Ingeniería experimental', 'Experimental Engineering'), origin: L('Laboratorio de prototipos', 'Prototype laboratory'),
    doctrine: L('Soluciones que aún no tienen industria.', 'Solutions that have no industry yet.'),
    lore: L('ADAX usa SARUS como entorno de validación para conceptos que todavía no pertenecen a ninguna industria establecida.', 'ADAX uses SARUS as a proving ground for concepts that do not yet belong to any established industry.') },
  NEXUS_8: { house: 'NEXUS AEROTECH', model: 'NX-9', family: 'balanced', lineage: 'orbital', cls: L('EQUILIBRADA / VELOCIDAD', 'BALANCED / SPEED'),
    sector: L('Tránsito orbital', 'Orbital Transit'), origin: L('Redes de transporte entre estaciones', 'Station-to-station transport networks'),
    doctrine: L('Cada segundo de maniobra cuenta.', 'Every second of manoeuvre counts.'),
    lore: L('NEXUS nació en las redes de transporte entre estaciones y puertos orbitales. Sus naves conservan la obsesión por la respuesta inmediata.', 'NEXUS was born in the transport networks between stations and orbital ports. Its ships keep the obsession with instant response.') },
  MANTA_9: { house: 'X3LEE LABS', model: 'PROTOTYPE 03', family: 'experimental', lineage: 'lab', cls: L('EXPERIMENTAL / AGRESIVA', 'EXPERIMENTAL / AGGRESSIVE'),
    sector: L('Investigación independiente', 'Independent Research'), origin: L('Estudios de materiales, forma y propulsión', 'Materials, form and propulsion studies'),
    doctrine: L('Romper estándares.', 'Break the standards.'),
    lore: L('X3LEE evita deliberadamente las arquitecturas convencionales. Cada una de sus máquinas es un demostrador experimental.', 'X3LEE deliberately avoids conventional architectures. Every one of its machines is an experimental demonstrator.') },
  BERLIN_10: { house: 'BERLIN KRAFTWERK', model: 'ADLER-17', family: 'speed', lineage: 'earth', cls: L('VELOCIDAD / RENDIMIENTO INDUSTRIAL', 'SPEED / INDUSTRIAL PERFORMANCE'),
    sector: L('Ingeniería de movilidad avanzada', 'Advanced Mobility Engineering'), origin: L('Herencia industrial de la vieja Tierra', 'Old Earth Industrial Heritage'),
    doctrine: L('Ingeniería disciplinada para la velocidad punta.', 'Disciplined engineering for top speed.'),
    lore: L('BERLIN KRAFTWERK procede de una tradición industrial terrestre anterior a la expansión orbital. Su prestigio: máquinas duraderas, rápidas y extremadamente precisas.', 'BERLIN KRAFTWERK comes from an Earth industrial tradition older than the orbital expansion. Its reputation: durable, fast and extremely precise machines.') },
  X3LEE_11: { house: 'MANTA MAGNETICS', model: 'RAY', family: 'handling', lineage: 'orbital', cls: L('MANEJO / PRECISIÓN', 'HANDLING / PRECISION'),
    sector: L('Movilidad orbital', 'Orbital Mobility'), origin: L('Investigación hidrodinámica y atmosférica', 'Hydrodynamic and atmospheric research'),
    doctrine: L('Fluir con el medio en lugar de luchar contra él.', 'Flow with the medium instead of fighting it.'),
    lore: L('MANTA adapta principios del desplazamiento submarino y atmosférico a vehículos de competición de bajísima resistencia.', 'MANTA adapts principles of underwater and atmospheric motion to ultra-low-drag racing vehicles.') },
  HUEMING_12: { house: 'HUE-MING TECHNOLOGIES', model: 'HM-8', family: 'handling', lineage: 'earth', cls: L('MANEJO / TÉCNICA', 'HANDLING / TECHNICAL'),
    sector: L('Instrumentación de precisión', 'Precision Instrumentation'), origin: L('Sistemas de navegación aeroespacial', 'Aerospace navigation systems'),
    doctrine: L('Cada corrección, mínima y exacta.', 'Every correction, minimal and exact.'),
    lore: L('HUE-MING construye sus vehículos alrededor de una premisa: cada corrección de trayectoria debe ser mínima, exacta y predecible.', 'HUE-MING builds its vehicles around one premise: every trajectory correction must be minimal, exact and predictable.') },
  VEGA_13: { house: 'VEGA CORPORATION', model: 'V-11', family: 'speed', lineage: 'outer', cls: L('VELOCIDAD / AGRESIVA', 'SPEED / AGGRESSIVE'),
    sector: L('Industrias de propulsión', 'Propulsion Industries'), origin: L('Sistemas de lanzamiento y aceleradores', 'Launch systems and accelerators'),
    doctrine: L('Máxima energía en el mínimo tiempo.', 'Maximum energy in minimum time.'),
    lore: L('VEGA viene de la industria de la propulsión. Sus máquinas se diseñan alrededor del motor, y no al revés.', 'VEGA comes from the propulsion industry. Its machines are designed around the engine, not the other way round.') },
  RAMA_14: { house: 'RAMA AEROSPACE', model: 'PEARL-14', family: 'speed', lineage: 'orbital', cls: L('VELOCIDAD / ALTO RENDIMIENTO DE LUJO', 'SPEED / LUXURY PERFORMANCE'),
    sector: L('Atelier aeroespacial', 'Aerospace Atelier'), origin: L('Transporte orbital de lujo', 'Premium Orbital Transport'),
    doctrine: L('Velocidad, ligereza y diseño escultórico.', 'Speed, lightness and sculptural design.'),
    lore: L('RAMA convirtió la ingeniería de transporte de alto nivel en un oficio casi artesanal. Sus naves compiten por rendimiento y por presencia.', 'RAMA turned high-end transport engineering into an almost artisanal craft. Its ships compete on performance and on presence.') },
  UBIK_15: { house: 'UBIK INDUSTRIES', model: 'OBSIDIAN', family: 'heavy', lineage: 'lab', cls: L('PESADA / INDUSTRIAL', 'HEAVY / INDUSTRIAL'),
    sector: L('Materiales avanzados', 'Advanced Materials'), origin: L('Compuestos para alto impacto y radiación', 'High-impact and radiation composites'),
    doctrine: L('Masa, estabilidad y absorción de impacto.', 'Mass, stability and impact absorption.'),
    lore: L('UBIK desarrolló materiales para entornos de alto impacto y radiación. Sus chasis apenas se inmutan.', 'UBIK developed materials for high-impact, high-radiation environments. Its chassis barely flinch.') },
  ALTAIR_16: { house: 'ALTAIR SPACECRAFT', model: 'AQUILA', family: 'speed', lineage: 'outer', cls: L('VELOCIDAD', 'SPEED'),
    sector: L('Sistemas de alta velocidad', 'High-Speed Systems'), origin: L('Mensajería exprés interplanetaria', 'Interplanetary express courier'),
    doctrine: L('Velocidad punta y respuesta firme.', 'Top speed and a firm response.'),
    lore: L('ALTAIR nació resolviendo un problema simple: mover cargas pequeñas entre mundos más rápido que nadie.', 'ALTAIR was born solving a simple problem: moving small loads between worlds faster than anyone else.') },
  KIBEROS_17: { house: 'KYBEROS ARMORING', model: 'CERBERUS', family: 'heavy', lineage: 'orbital', cls: L('PESADA / AGRESIVA', 'HEAVY / AGGRESSIVE'),
    sector: L('Escolta y plataformas blindadas', 'Escort & Armored Platforms'), origin: L('Flotas de escolta orbital', 'Orbital escort fleets'),
    doctrine: L('Blindaje, masa y combate.', 'Armor, mass and combat.'),
    lore: L('KYBEROS convirtió plataformas de escolta y protección en máquinas capaces de sobrevivir a impactos que retirarían a cualquier otra.', 'KYBEROS turned escort and protection platforms into machines able to survive hits that would retire any other.') },
  PHANTOM_19: { house: 'PHANTOM ENTERPRISES', model: 'SHADOW', family: 'experimental', lineage: 'lab', cls: L('EXPERIMENTAL / SIGILO', 'EXPERIMENTAL / STEALTH'),
    sector: L('Sistemas de reducción de firma', 'Signature Reduction Systems'), origin: L('Programas de reconocimiento clasificados', 'Classified reconnaissance programs'),
    doctrine: L('Llegar sin ser vista.', 'Arrive unseen.'),
    lore: L('PHANTOM ENTERPRISES nunca ha publicado un organigrama. Su casco de obsidiana absorbe radar y luz; en SARUS compite para demostrar que lo que no se puede fijar tampoco se puede alcanzar.', 'PHANTOM ENTERPRISES has never published an org chart. Its obsidian hull swallows radar and light; in SARUS it races to prove that what cannot be locked cannot be caught.') },
  ANTARES_20: { house: 'ANTARES GLACIAL SHIPS', model: 'ZERO', family: 'handling', lineage: 'outer', cls: L('MANEJO / GLACIAL', 'HANDLING / GLACIAL'),
    sector: L('Ingeniería criogénica de cascos', 'Cryogenic Hull Engineering'), origin: L('Astilleros de las lunas heladas del sistema exterior', 'Ice-moon shipyards of the outer system'),
    doctrine: L('Fricción cero.', 'Zero friction.'),
    lore: L('ANTARES nació en los astilleros de las lunas heladas, donde el casco se pule a temperaturas cercanas al cero absoluto. Lleva el nombre del corazón rojo del Escorpión: un núcleo de fuego dentro de una carrocería de hielo.', 'ANTARES was born in the shipyards of the ice moons, where hulls are polished at temperatures close to absolute zero. It is named after the red heart of Scorpius: a core of fire inside a body of ice.') },
  ORION_18: { house: 'ORION AERONAUTICS', model: 'HUNTER', family: 'balanced', lineage: 'outer', cls: L('EQUILIBRADA / EXPLORACIÓN', 'BALANCED / EXPLORATION'),
    sector: L('Sistemas de espacio profundo', 'Deep Space Systems'), origin: L('Exploración y búsqueda de largo alcance', 'Long-range exploration and search'),
    doctrine: L('Persecución y equilibrio ofensivo.', 'Pursuit and offensive balance.'),
    lore: L('ORION desarrolla vehículos capaces de operar mucho tiempo lejos de cualquier infraestructura humana: en carrera, equilibrio y fiabilidad.', 'ORION builds vehicles able to operate for a long time far from any human infrastructure: in racing, balance and reliability.') },
};

export const MOTTO = L('SARUS no enfrenta veinte naves. Enfrenta veinte filosofías tecnológicas.', 'SARUS does not pit twenty ships against each other. It pits twenty technological philosophies.');
