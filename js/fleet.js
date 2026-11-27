// Flota SARUS (ships45.glb): 24 escuderías. V = velocidad punta, A = aceleración, M = manejo (1–5).
// Cada nave tiene además un ESTILO: cómo responde, cuánto derrapa, cuánto pesa, cómo se inclina y flota.
// Todo es provisional y se ajusta aquí.
import { SHIP_LORE } from './lore.js';
import { L } from './i18n.js';

export const FLEET = [
  { num: '01', node: 'ILION_1', hull: 3, flame: [1.0, 0.76, 0.42], name: 'ILION', tag: L('Flecha de recta. Dirección lenta y pesada, pide anticipar la curva.', 'Straight-line arrow. Slow, heavy steering: plan every corner early.'),
    V: 5, A: 4, M: 3,
    style: { response: 5.2, grip: 5.8, gripAB: 7.8, ab: 0.85, mass: 1.15, lean: 0.32, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.7 } },
  { num: '02', node: 'SCUBA_2', hull: 5, flame: [1.0, 0.62, 0.1], name: 'SCUBA', tag: L('Cirujana. Entra al vértice como sobre raíles, pero la recta se le hace larga.', 'The surgeon. Takes the apex as if on rails, but long straights feel longer.'),
    V: 3, A: 4, M: 5,
    style: { response: 12, grip: 8.5, gripAB: 10, ab: 1.05, mass: 0.9, lean: 0.26, bob: 0.05, bobHz: 2.6, drift: 0.12, pitch: 0.8 } },
  { num: '03', node: 'THULE_3', hull: 4, flame: [0.72, 0.3, 1.0], name: 'THULE', tag: L('Ligera y saltarina. Sale disparada y rebota en cada bache.', 'Light and bouncy. Shoots off the line and hops over every bump.'),
    V: 3, A: 5, M: 4,
    style: { response: 10, grip: 5.2, gripAB: 7.5, ab: 0.95, mass: 0.78, lean: 0.55, bob: 0.13, bobHz: 3.4, drift: 0.3, pitch: 1.6, kick: 1.35 } },
  { num: '04', node: 'LUDOX_4', hull: 5, flame: [1.0, 0.45, 0.08], name: 'CALIBUR', logo: 'LUDOX', tag: L('Tanque. Apenas se inmuta con los golpes y sus aerofrenos clavan la nave.', 'A tank. Barely flinches at hits, and its air brakes pin the ship down.'),
    V: 4, A: 3, M: 5,
    style: { response: 5.5, grip: 7.2, gripAB: 11, ab: 1.3, mass: 1.45, lean: 0.2, bob: 0.025, bobHz: 1.3, drift: 0.12, pitch: 0.4 } },
  { num: '05', node: 'PRIMEX_5', hull: 4, flame: [1.0, 0.16, 0.05], name: 'PRIME-EX', tag: L('La referencia. Neutra, predecible y rápida en manos finas.', 'The benchmark. Neutral, predictable and quick in skilled hands.'),
    V: 4, A: 4, M: 4,
    style: { response: 7.5, grip: 5.2, gripAB: 7.5, ab: 0.95, mass: 1.0, lean: 0.42, bob: 0.06, bobHz: 2.4, drift: 0.3, pitch: 1.0 } },
  { num: '06', node: 'WOLFEN_6', hull: 3, flame: [0.55, 1.0, 0.12], name: 'WOLFEN', tag: L('Salvaje. Derrapa de lado en cada curva y su boost es brutal.', 'Wild. Slides sideways through every corner, and its boost is brutal.'),
    V: 5, A: 5, M: 2,
    style: { response: 9, grip: 2.9, gripAB: 5.2, ab: 1.1, mass: 0.88, lean: 0.62, bob: 0.07, bobHz: 2.9, drift: 0.65, pitch: 1.2, boostAccel: 1.3, boostDrain: 1.2 } },
  { num: '07', node: 'ADAX_7', hull: 4, flame: [1.0, 0.52, 0.06], name: 'ADAX', tag: L('Gran turismo. Rápida, ancha y noble, perdona los errores contra el muro.', 'Grand tourer. Fast, wide and forgiving: wall mistakes cost little.'),
    V: 5, A: 3, M: 4,
    style: { response: 6.5, grip: 6.0, gripAB: 8.5, ab: 0.95, mass: 1.25, lean: 0.36, bob: 0.045, bobHz: 2.0, drift: 0.22, pitch: 0.7, wallLoss: 0.7 } },
  { num: '08', node: 'NEXUS_8', hull: 4, flame: [0.1, 0.9, 1.0], name: 'NEXUS', tag: L('Recarga el boost el doble de rápido. Nerviosa al levantar el pie.', 'Recharges boost twice as fast. Twitchy when you lift off.'),
    V: 4, A: 5, M: 3,
    style: { response: 8.5, grip: 4.4, gripAB: 7, ab: 0.9, mass: 0.95, lean: 0.5, bob: 0.08, bobHz: 2.8, drift: 0.4, pitch: 1.3, boostRegen: 2.0 } },
  { num: '09', node: 'MANTA_9', hull: 4, flame: [1.0, 0.3, 0.62], name: 'X3LEE', logo: 'X3LEE', tag: L('Planeadora. Estable y noble; en las crestas vuela más lejos y aterriza sin perder la línea.', 'The glider. Stable and noble; it flies further off crests and lands without losing its line.'),
    V: 4, A: 4, M: 4,
    style: { response: 7.2, grip: 6.2, gripAB: 8.2, ab: 1.0, mass: 1.05, lean: 0.3, bob: 0.1, bobHz: 1.5, drift: 0.24, pitch: 0.8, kick: 1.25 } },
  { num: '10', node: 'BERLIN_10', hull: 3, flame: [1.0, 0.82, 0.45], name: 'BERLIN', tag: L('Dardo asimétrico. De las más rápidas en recta, pero su cuchilla lateral castiga cada roce con el muro.', 'Asymmetric dart. Among the fastest on the straights, but its side blade punishes every wall scrape.'),
    V: 5, A: 4, M: 3,
    style: { response: 8, grip: 4.6, gripAB: 7.2, ab: 0.95, mass: 0.92, lean: 0.46, bob: 0.05, bobHz: 2.6, drift: 0.38, pitch: 1.1, boostAccel: 1.15, wallLoss: 1.25 } },
  { num: '11', node: 'X3LEE_11', hull: 4, flame: [0.72, 0.88, 1.0], name: 'MANTA', logo: 'MANTA', tag: L('Bisturí. Traza perfecta y cero drama en curva; le cuesta arrancar desde abajo.', 'The scalpel. Perfect lines and zero drama in corners; slow to get going from low speed.'),
    V: 4, A: 3, M: 5,
    style: { response: 11, grip: 8.2, gripAB: 10, ab: 1.0, mass: 1.0, lean: 0.24, bob: 0.03, bobHz: 2.2, drift: 0.1, pitch: 0.6 } },
  { num: '12', node: 'HUEMING_12', hull: 5, flame: [0.25, 1.0, 0.62], name: 'HUE-MING', tag: L('Acorazada. Su turbina central empuja con un par brutal y recarga el boost antes; pesa y cuesta girarla.', 'Armored. Its central turbine pushes with brutal torque and recharges boost sooner; heavy and hard to turn.'),
    V: 3, A: 5, M: 4,
    style: { response: 6, grip: 6.4, gripAB: 9, ab: 1.15, mass: 1.4, lean: 0.22, bob: 0.03, bobHz: 1.4, drift: 0.16, pitch: 0.5, boostRegen: 1.4 } },
  { num: '13', node: 'VEGA_13', hull: 4, flame: [0.45, 0.7, 1.0], name: 'VEGA', tag: L('Tres motores y salida fulgurante. Muy estable en apoyo, pero tarda en cambiar de dirección.', 'Three engines and a lightning launch. Very stable under load, but slow to change direction.'),
    V: 4, A: 5, M: 3,
    style: { response: 8.2, grip: 6.6, gripAB: 8.6, ab: 1.0, mass: 1.08, lean: 0.34, bob: 0.05, bobHz: 2.0, drift: 0.22, pitch: 0.9, kick: 1.15 } },
  { num: '14', node: 'RAMA_14', hull: 4, flame: [0.55, 0.92, 1.0], name: 'RAMA', tag: L('Escultura de nácar. La más fina en el aire: punta altísima y trazada limpia, pero castiga cada golpe.', 'Nacre sculpture. The finest in the air: very high top speed and clean lines, but every hit hurts.'),
    V: 5, A: 3, M: 4,
    style: { response: 9, grip: 6.8, gripAB: 8.8, ab: 1.0, mass: 0.95, lean: 0.36, bob: 0.04, bobHz: 2.2, drift: 0.2, pitch: 0.8, wallLoss: 1.15 } },
  { num: '15', node: 'UBIK_15', hull: 5, flame: [1.0, 0.14, 0.1], name: 'UBIK', tag: L('Obsidiana silenciosa. Cuatro motores, equilibrio total y un blindaje que aguanta como ninguno.', 'Silent obsidian. Four engines, total balance and armor that holds like no other.'),
    V: 4, A: 4, M: 4,
    style: { response: 7.6, grip: 6.4, gripAB: 8.4, ab: 1.0, mass: 1.18, lean: 0.3, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.7 } },
  { num: '16', node: 'ALTAIR_16', hull: 3, flame: [1.0, 0.8, 0.38], name: 'ALTAIR', tag: L('El águila. Pico de rapaz, alas en flecha y dos góndolas con franja roja; cabina en gota sobre el lomo: velocísima en recta y fina en curva rápida, pero frágil.', 'The eagle. A raptor beak, swept wings and two red-banded nacelles, with a teardrop canopy on the spine: blazing on straights and sharp in fast corners, but fragile.'),
    V: 5, A: 4, M: 3,
    style: { response: 8.2, grip: 5.8, gripAB: 8.0, ab: 0.95, mass: 0.98, lean: 0.4, bob: 0.05, bobHz: 2.0, drift: 0.26, pitch: 0.9, wallLoss: 1.1 } },
  { num: '17', node: 'KIBEROS_17', hull: 4, flame: [1.0, 0.12, 0.08], name: 'CERBERUS', logo: 'KIBEROS', tag: L('El can de tres cabezas. Morro y dos garras de plata sobre un núcleo negro: arranca como nadie y muerde en el cuerpo a cuerpo.', 'The three-headed hound. A nose and two silver claws over a black core: unmatched launch, and it bites in close combat.'),
    V: 4, A: 5, M: 3,
    style: { response: 8.0, grip: 6.0, gripAB: 8.2, ab: 1.0, mass: 1.12, lean: 0.38, bob: 0.05, bobHz: 2.2, drift: 0.28, pitch: 0.85, kick: 1.15 } },
  { num: '18', node: 'ORION_18', hull: 5, flame: [1.0, 0.66, 0.3], name: 'ORION', tag: L('El cazador. Cromo afilado en láminas, cuatro toberas y letras de bronce: la más estable a fondo y la más dura de derribar, pero pesada al salir.', 'The hunter. Bladed chrome, four nozzles and bronze lettering: the most stable flat out and the hardest to bring down, but heavy off the line.'),
    V: 5, A: 3, M: 4,
    style: { response: 7.8, grip: 6.6, gripAB: 8.6, ab: 1.0, mass: 1.24, lean: 0.3, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.75 } },
  { num: '19', node: 'PHANTOM_19', hull: 3, flame: [0.62, 0.42, 1.0], name: 'PHANTOM', tag: L('La sombra. Obsidiana de firma mínima: los cohetes rivales la fijan tarde y de cerca. Rápida y fina, pero un golpe directo le duele.', 'The shadow. Low-signature obsidian: rival rockets lock on late and only up close. Fast and fine, but a direct hit hurts.'),
    V: 5, A: 4, M: 4,
    style: { response: 8.6, grip: 6.2, gripAB: 8.4, ab: 1.0, mass: 0.96, lean: 0.34, bob: 0.03, bobHz: 2.0, drift: 0.22, pitch: 0.8, wallLoss: 1.1, stealth: 1 } },
  { num: '20', node: 'ANTARES_20', hull: 3, flame: [0.75, 0.95, 1.0], name: 'ANTARES', tag: L('Hielo pulido. Resbala por los muros sin apenas perder velocidad y traza como un cuchillo; acelera con calma y no aguanta muchos golpes.', 'Polished ice. Slides along walls with almost no speed loss and carves like a knife; gentle acceleration, and it cannot take many hits.'),
    V: 4, A: 4, M: 5,
    style: { response: 10.5, grip: 7.6, gripAB: 9.4, ab: 1.0, mass: 0.92, lean: 0.28, bob: 0.03, bobHz: 1.8, drift: 0.14, pitch: 0.7, wallLoss: 0.6 } },
  // ventral: sin propulsión trasera; las cuatro toberas están en los bajos de las góndolas (ship.js orienta la llama abajo y atrás)
  { num: '21', node: 'VOSTOK_21', hull: 5, flame: [0.22, 0.42, 1.0], name: 'VOSTOK', ventral: true, tag: L('Bloque blindado de patrulla. Sin motor trasero: levita y empuja con cuatro toberas ventrales. Es la que más pesa: apenas se inmuta con los golpes y aparta a quien se le cruza, pero cuesta girarla.', 'Armored patrol block. No rear engine: it hovers and pushes on four ventral nozzles. The heaviest of all: it barely flinches at hits and shoves aside whoever gets in its way, but it is hard to turn.'),
    V: 4, A: 3, M: 3,
    style: { response: 5.6, grip: 6.8, gripAB: 9.2, ab: 1.15, mass: 1.6, lean: 0.16, bob: 0.02, bobHz: 1.2, drift: 0.12, pitch: 0.35, wallLoss: 0.8 } },
  { num: '22', node: 'SAILETOR_22', hull: 5, flame: [0.78, 0.7, 1.0], name: 'SEILATOR', tag: L('Composite de Plutón. Estable como pocas en apoyo y a fondo, aguanta golpes y frío extremo; le falta chispa al salir.', 'Pluto composite. Rock-steady under load and flat out, it shrugs off hits and extreme cold; a little flat off the line.'),
    V: 4, A: 3, M: 4,
    style: { response: 7.2, grip: 7.0, gripAB: 9.0, ab: 1.0, mass: 1.12, lean: 0.2, bob: 0.02, bobHz: 1.4, drift: 0.1, pitch: 0.5, wallLoss: 0.5 } },
  // AKO_23 (AKO RESEARCH, Ío): modelo de Dear (Meshy) con cabina biplaza en tándem, librea blanca y azufre, 4 toberas (tools/addship.mjs)
  { num: '23', node: 'AKO_23', hull: 5, flame: [1.0, 0.82, 0.3], name: 'AKO', tag: L('Investigación militar de largo alcance. Punta altísima y blindaje de primera; pesa, le cuesta girar y tarda en arrancar, pero su turbo dura más que ninguno.', 'Long-range military research. Very high top speed and first-rate armor; heavy, hard to turn and slow off the line, but its boost outlasts everyone else\'s.'),
    V: 5, A: 3, M: 3,
    style: { response: 6.2, grip: 6.2, gripAB: 8.8, ab: 1.05, mass: 1.32, lean: 0.26, bob: 0.03, bobHz: 1.6, drift: 0.18, pitch: 0.6, wallLoss: 0.85, boostDrain: 0.75 } },
  // EOS_24 (EOS VESSELS, Fobos): transporte de carga rápido no tripulado; modelo de Dear (Meshy), aros de neón en los ventiladores, dos toberas de popa
  { num: '24', node: 'EOS_24', hull: 3, flame: [1.0, 0.5, 0.35], name: 'EOS', tag: L('Carguero rápido sin tripulación. Sin piloto a bordo, aguanta fuerzas laterales brutales y traza como sobre raíles; ligera y frágil: cada roce con el muro le cuesta.', 'Fast uncrewed freighter. With no pilot aboard it takes brutal lateral forces and corners as if on rails; light and fragile: every wall scrape costs it.'),
    V: 4, A: 4, M: 5,
    style: { response: 10, grip: 7.6, gripAB: 9.4, ab: 1.0, mass: 0.85, lean: 0.48, bob: 0.06, bobHz: 2.2, drift: 0.14, pitch: 0.9, wallLoss: 1.2, boostRegen: 1.3 } },
];

// capa creativa: escudería, modelo, clase, familia, linaje, procedencia y lore (lore.js)
for (const d of FLEET) Object.assign(d, SHIP_LORE[d.node] || {});

// hull: impactos de cohete que aguanta (las más rápidas, menos: 3 · 4 · 5)
// flame: color de la propulsión (los colores de cada escudería)
export const DEFAULT_SHIP = 4; // PRIME-EX

// Rasgos para el hangar (1–5): velocidad, aceleración, manejo y blindaje (los que cambian la conducción)
export function traits(d) {
  return { V: d.V, A: d.A, M: d.M, H: d.hull || 4 };
}

export function statsFor(d) {
  const s = d.style || {};
  const m = s.mass ?? 1;
  const cl = (v, a, b) => Math.min(b, Math.max(a, v));
  // Físicas v2 (nov. 2026): V, A y M separan más las naves y la MASA pasa a mandar en todo lo que es inercia.
  // PRIME-EX (4·4·4, masa 1) es la referencia y queda igual que antes; las demás se alejan de ella.
  const vmax = (131 + d.V * 5.2) * 1.12;  // 164 – 176 m/s (590 – 633 km/h); antes 166 – 174
  return {
    vmax,
    vmaxBoost: vmax + 46,
    accel: (30 + d.A * 4.6) * 1.5,       // 66 – 80 m/s² desde parado; antes 68 – 77
    turnMult: 0.80 + d.M * 0.06,         // 0,92 – 1,10; antes 0,95 – 1,085
    turnLow: 2.3 * cl(0.76 + (s.response ?? 7.5) / 31, 0.9, 1.15),   // ágil a baja velocidad quien responde rápido
    turnHigh: 1.42 * cl(Math.pow(m, -0.25), 0.88, 1.07),             // a fondo, la masa cuesta de girar
    turnResponse: s.response ?? 7.5,
    grip: s.grip ?? 5.2,
    gripAirbrake: s.gripAB ?? 7.5,
    airbrakeTurn: (s.ab ?? 0.95) * 1.1,
    mass: m,
    brake: 70 / Math.sqrt(m),            // 55 (tanque) – 79 (ligera)
    coastDrag: 0.10 * Math.pow(m, -0.8), // al soltar gas: la pesada conserva la inercia, la ligera se frena sola
    spool: cl(9 * Math.pow(m, -1.5), 3.5, 12),   // lo que tarda el empuje en llegar al pisar (1/s)
    slopeK: Math.sqrt(m),                // las cuestas pesan más (y las bajadas dan más) cuanta más masa
    slideDrag: 0.12 * Math.pow((s.grip ?? 5.2) / 5.2, 1.5),   // derrapar roba velocidad a las de agarre; a las derrapadoras, casi nada
    liftK: s.glide ?? cl(Math.pow(m, -0.8), 0.7, 1.25),       // cuánto despega en las crestas
    hover: cl(1.3 + (1 - m) * 0.5, 1.15, 1.45),               // las ligeras flotan más alto
    hitKeep: cl(0.38 * Math.pow(m, 0.6), 0.3, 0.52),          // velocidad que conserva tras un cohete
    hitStun: 0.7 / Math.sqrt(m),                              // tiempo sin mando tras un cohete
    wallLoss: s.wallLoss ?? 1,
    lean: s.lean ?? 0.42,
    bob: s.bob ?? 0.06,
    bobHz: s.bobHz ?? 2.4,
    driftYaw: s.drift ?? 0.3,
    pitchK: s.pitch ?? 1,
    boostAccel: 46 * (s.boostAccel ?? 1),
    boostDrain: 0.34 * (s.boostDrain ?? 1),
    boostRegen: 0.055 * (s.boostRegen ?? 1),
    kick: s.kick ?? 1,
    stealth: s.stealth ?? 0,
  };
}
