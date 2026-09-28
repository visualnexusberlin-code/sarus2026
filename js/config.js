// ─────────────────────────────────────────────────────────────
//  SPEED RACING SKIES · configuración central
//  Todo lo "tuneable" vive aquí: física, cámara, atmósfera, intro.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { CIRCUITS } from './circuits.js';

const params = new URLSearchParams(location.search);

export const CONFIG = {
  // Modelos: incrustados (gzip + base64) en la versión publicada; en local se leen los .glb.
  models: {
    circuit: { inline: 'model-data', url: 'saturn6.glb' },
    fleet: { inline: 'model-fleet', url: 'ships21.glb' },   // flota v08: 12 escuderías, acabado con desgaste y pilotos
  },

  // Sentido de carrera. true = orden de los sectores 01→06 (numerales legibles en pista).
  // false = sentido de la nave de referencia colocada en Blender.
  reverse: params.has('reverse'),            // invierte el sentido de cualquier circuito
  laps: 3,
  playerSlot: 7,             // 0 = pole; el jugador sale 8º de 12
  // Relieve: el GLB sube de 70 a 240 m (pendiente media 8,6 %). Se amplifica y se añaden ondulaciones.
  relief: { enabled: !params.has('flat') },   // el relieve de cada circuito está en circuits.js
  // Dificultad: nivel de los rivales, corrección a distancia (solo cuando el hueco es grande) y frecuencia de errores
  difficulties: {
    easy: { label: 'Fácil', skillTop: 0.76, skillStep: 0.022, pace: 0.94, rubberUp: 0.03, rubberDown: 0.08, rubberGap: 100, mistakes: 1.8 },
    normal: { label: 'Normal', skillTop: 0.87, skillStep: 0.016, pace: 0.97, rubberUp: 0.04, rubberDown: 0.06, rubberGap: 140, mistakes: 1.1 },
    hard: { label: 'Difícil', skillTop: 0.97, skillStep: 0.01, pace: 1, rubberUp: 0.055, rubberDown: 0.025, rubberGap: 160, mistakes: 0.4 },
  },
  draft: { min: 6, max: 50, lateral: 3.2, vmax: 0.06, accel: 0.15 },   // rebufo: hasta +6 % de punta pegado a otra nave
  respawn: { time: 3.0, back: 60, invuln: 2.5 },                          // nave destruida: fuera 3 s, reaparece 60 m atrás
  pickups: { every: 430, firstAt: 260, respawn: 6, lanes: [-8.5, 0, 8.5] },
  gridOffset: 30,
  shipScale: 1.5,            // las naves de Blender miden ~5,5 m; en pista se ven a 1,5×            // metros por detrás de la línea de salida (Sector 01)

  // ── Nave (unidades: metros, segundos) ──
  ship: {
    vmax: 150,               // 540 km/h
    vmaxBoost: 192,          // 690 km/h
    accel: 46,               // empuje a velocidad cero
    brake: 70,
    coastDrag: 0.10,
    airbrakeDrag: 0.22,
    turnLow: 2.3,            // rad/s a baja velocidad
    turnHigh: 1.42,          // rad/s a vmax
    airbrakeTurn: 0.95,      // rad/s extra por aerofreno
    turnResponse: 7.5,
    grip: 5.2,               // cuánto sigue la trayectoria al morro (derrape)
    gripAirbrake: 7.5,
    hover: 1.3,           // holgura bajo el casco
    halfWidth: 1.15,
    wallAt: 16.35,           // borde interior del guardarraíl (medido del GLB)
    boostDrain: 0.34,        // por segundo
    boostRegen: 0.055,
    boostAccel: 34,
    // estilo por defecto (cada nave lo sobreescribe en fleet.js)
    turnMult: 1, mass: 1, wallLoss: 1, lean: 0.42, bob: 0.06, bobHz: 2.4, driftYaw: 0.3, pitchK: 1, kick: 1,
  },

  camera: {
    fovBase: 66,
    fovSpeed: 16,
    fovBoost: 7,
    dist: 11.5,
    distSpeed: 0.013,
    height: 3.3,
    lookAhead: 18,
    followYaw: 7.0,
    followUp: 5.0,
    roll: 0.35,
  },

  // ── Atmósfera (niebla de altura analítica + niebla de distancia) ──
  // Atmósfera activa: la de SATURN-6 al arrancar; cada circuito trae la suya (circuits.js)
  atmosphere: { ...CIRCUITS[0].atmosphere },

  introSpeed: 1.0,
  debug: params.has('debug'),
  post: !params.has('nopost'),
};
