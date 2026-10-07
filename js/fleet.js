// Flota SARUS (ships41.glb): 18 escuderías. V = velocidad punta, A = aceleración, M = manejo (1–5).
// Cada nave tiene además un ESTILO: cómo responde, cuánto derrapa, cuánto pesa, cómo se inclina y flota.
// Todo es provisional y se ajusta aquí.
import { SHIP_LORE } from './lore.js';

export const FLEET = [
  { num: '01', node: 'ILION_1', hull: 3, flame: [1.0, 0.76, 0.42], name: 'ILION', tag: 'Flecha de recta. Dirección lenta y pesada, pide anticipar la curva.',
    V: 5, A: 4, M: 3,
    style: { response: 5.2, grip: 5.8, gripAB: 7.8, ab: 0.85, mass: 1.15, lean: 0.32, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.7 } },
  { num: '02', node: 'SCUBA_2', hull: 5, flame: [1.0, 0.62, 0.1], name: 'SCUBA', tag: 'Cirujana. Entra al vértice como sobre raíles, pero la recta se le hace larga.',
    V: 3, A: 4, M: 5,
    style: { response: 12, grip: 8.5, gripAB: 10, ab: 1.05, mass: 0.9, lean: 0.26, bob: 0.05, bobHz: 2.6, drift: 0.12, pitch: 0.8 } },
  { num: '03', node: 'THULE_3', hull: 4, flame: [0.72, 0.3, 1.0], name: 'THULE', tag: 'Ligera y saltarina. Sale disparada y rebota en cada bache.',
    V: 3, A: 5, M: 4,
    style: { response: 10, grip: 5.2, gripAB: 7.5, ab: 0.95, mass: 0.78, lean: 0.55, bob: 0.13, bobHz: 3.4, drift: 0.3, pitch: 1.6, kick: 1.35 } },
  { num: '04', node: 'LUDOX_4', hull: 5, flame: [1.0, 0.45, 0.08], name: 'CALIBUR', logo: 'LUDOX', tag: 'Tanque. Apenas se inmuta con los golpes y sus aerofrenos clavan la nave.',
    V: 4, A: 3, M: 5,
    style: { response: 5.5, grip: 7.2, gripAB: 11, ab: 1.3, mass: 1.45, lean: 0.2, bob: 0.025, bobHz: 1.3, drift: 0.12, pitch: 0.4 } },
  { num: '05', node: 'PRIMEX_5', hull: 4, flame: [1.0, 0.16, 0.05], name: 'PRIME-EX', tag: 'La referencia. Neutra, predecible y rápida en manos finas.',
    V: 4, A: 4, M: 4,
    style: { response: 7.5, grip: 5.2, gripAB: 7.5, ab: 0.95, mass: 1.0, lean: 0.42, bob: 0.06, bobHz: 2.4, drift: 0.3, pitch: 1.0 } },
  { num: '06', node: 'WOLFEN_6', hull: 3, flame: [0.55, 1.0, 0.12], name: 'WOLFEN', tag: 'Salvaje. Derrapa de lado en cada curva y su boost es brutal.',
    V: 5, A: 5, M: 2,
    style: { response: 9, grip: 2.9, gripAB: 5.2, ab: 1.1, mass: 0.88, lean: 0.62, bob: 0.07, bobHz: 2.9, drift: 0.65, pitch: 1.2, boostAccel: 1.3, boostDrain: 1.2 } },
  { num: '07', node: 'ADAX_7', hull: 4, flame: [1.0, 0.52, 0.06], name: 'ADAX', tag: 'Gran turismo. Rápida, ancha y noble, perdona los errores contra el muro.',
    V: 5, A: 3, M: 4,
    style: { response: 6.5, grip: 6.0, gripAB: 8.5, ab: 0.95, mass: 1.25, lean: 0.36, bob: 0.045, bobHz: 2.0, drift: 0.22, pitch: 0.7, wallLoss: 0.7 } },
  { num: '08', node: 'NEXUS_8', hull: 4, flame: [0.1, 0.9, 1.0], name: 'NEXUS', tag: 'Recarga el boost el doble de rápido. Nerviosa al levantar el pie.',
    V: 4, A: 5, M: 3,
    style: { response: 8.5, grip: 4.4, gripAB: 7, ab: 0.9, mass: 0.95, lean: 0.5, bob: 0.08, bobHz: 2.8, drift: 0.4, pitch: 1.3, boostRegen: 2.0 } },
  { num: '09', node: 'MANTA_9', hull: 4, flame: [1.0, 0.3, 0.62], name: 'X3LEE', logo: 'X3LEE', tag: 'Planeadora. Estable y noble; en las crestas vuela más lejos y aterriza sin perder la línea.',
    V: 4, A: 4, M: 4,
    style: { response: 7.2, grip: 6.2, gripAB: 8.2, ab: 1.0, mass: 1.05, lean: 0.3, bob: 0.1, bobHz: 1.5, drift: 0.24, pitch: 0.8, kick: 1.25 } },
  { num: '10', node: 'BERLIN_10', hull: 3, flame: [1.0, 0.82, 0.45], name: 'BERLIN', tag: 'Dardo asimétrico. De las más rápidas en recta, pero su cuchilla lateral castiga cada roce con el muro.',
    V: 5, A: 4, M: 3,
    style: { response: 8, grip: 4.6, gripAB: 7.2, ab: 0.95, mass: 0.92, lean: 0.46, bob: 0.05, bobHz: 2.6, drift: 0.38, pitch: 1.1, boostAccel: 1.15, wallLoss: 1.25 } },
  { num: '11', node: 'X3LEE_11', hull: 4, flame: [0.72, 0.88, 1.0], name: 'MANTA', logo: 'MANTA', tag: 'Bisturí. Traza perfecta y cero drama en curva; le cuesta arrancar desde abajo.',
    V: 4, A: 3, M: 5,
    style: { response: 11, grip: 8.2, gripAB: 10, ab: 1.0, mass: 1.0, lean: 0.24, bob: 0.03, bobHz: 2.2, drift: 0.1, pitch: 0.6 } },
  { num: '12', node: 'HUEMING_12', hull: 5, flame: [0.25, 1.0, 0.62], name: 'HUE-MING', tag: 'Acorazada. Su turbina central empuja con un par brutal y recarga el boost antes; pesa y cuesta girarla.',
    V: 3, A: 5, M: 4,
    style: { response: 6, grip: 6.4, gripAB: 9, ab: 1.15, mass: 1.4, lean: 0.22, bob: 0.03, bobHz: 1.4, drift: 0.16, pitch: 0.5, boostRegen: 1.4 } },
  { num: '13', node: 'VEGA_13', hull: 4, flame: [0.45, 0.7, 1.0], name: 'VEGA', tag: 'Tres motores y salida fulgurante. Muy estable en apoyo, pero tarda en cambiar de dirección.',
    V: 4, A: 5, M: 3,
    style: { response: 8.2, grip: 6.6, gripAB: 8.6, ab: 1.0, mass: 1.08, lean: 0.34, bob: 0.05, bobHz: 2.0, drift: 0.22, pitch: 0.9, kick: 1.15 } },
  { num: '14', node: 'RAMA_14', hull: 4, flame: [0.55, 0.92, 1.0], name: 'RAMA', tag: 'Escultura de nácar. La más fina en el aire: punta altísima y trazada limpia, pero castiga cada golpe.',
    V: 5, A: 3, M: 4,
    style: { response: 9, grip: 6.8, gripAB: 8.8, ab: 1.0, mass: 0.95, lean: 0.36, bob: 0.04, bobHz: 2.2, drift: 0.2, pitch: 0.8, wallLoss: 1.15 } },
  { num: '15', node: 'UBIK_15', hull: 5, flame: [1.0, 0.14, 0.1], name: 'UBIK', tag: 'Obsidiana silenciosa. Cuatro motores, equilibrio total y un blindaje que aguanta como ninguno.',
    V: 4, A: 4, M: 4,
    style: { response: 7.6, grip: 6.4, gripAB: 8.4, ab: 1.0, mass: 1.18, lean: 0.3, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.7 } },
  { num: '16', node: 'ALTAIR_16', hull: 3, flame: [1.0, 0.22, 0.16], name: 'ALTAIR', tag: 'El águila. Grafito ondulado y un solo motor central: velocísima en recta y fina en curva rápida, pero frágil.',
    V: 5, A: 4, M: 3,
    style: { response: 8.2, grip: 5.8, gripAB: 8.0, ab: 0.95, mass: 0.98, lean: 0.4, bob: 0.05, bobHz: 2.0, drift: 0.26, pitch: 0.9, wallLoss: 1.1 } },
  { num: '17', node: 'KIBEROS_17', hull: 4, flame: [1.0, 0.12, 0.08], name: 'CERBERUS', logo: 'KIBEROS', tag: 'El can de tres cabezas. Morro y dos garras de plata sobre un núcleo negro: arranca como nadie y muerde en el cuerpo a cuerpo.',
    V: 4, A: 5, M: 3,
    style: { response: 8.0, grip: 6.0, gripAB: 8.2, ab: 1.0, mass: 1.12, lean: 0.38, bob: 0.05, bobHz: 2.2, drift: 0.28, pitch: 0.85, kick: 1.15 } },
  { num: '18', node: 'ORION_18', hull: 5, flame: [1.0, 0.66, 0.3], name: 'ORION', tag: 'El cazador. Cromo afilado en láminas, cuatro toberas y letras de bronce: la más estable a fondo y la más dura de derribar, pero pesada al salir.',
    V: 5, A: 3, M: 4,
    style: { response: 7.8, grip: 6.6, gripAB: 8.6, ab: 1.0, mass: 1.24, lean: 0.3, bob: 0.04, bobHz: 1.8, drift: 0.2, pitch: 0.75 } },
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
  const vmax = (139 + d.V * 3.2) * 1.12;  // 166 – 174 m/s (600 – 625 km/h)
  return {
    vmax,
    vmaxBoost: vmax + 46,
    accel: (36 + d.A * 3) * 1.5,         // 68 – 77 m/s² desde parado
    turnMult: 0.86 + d.M * 0.045,        // 0,95 – 1,085
    turnResponse: s.response ?? 7.5,
    grip: s.grip ?? 5.2,
    gripAirbrake: s.gripAB ?? 7.5,
    airbrakeTurn: (s.ab ?? 0.95) * 1.1,
    mass: s.mass ?? 1,
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
  };
}
