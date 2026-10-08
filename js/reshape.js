// ─────────────────────────────────────────────────────────────
//  SARUS · retoques de trazado
//  Los circuitos generados parten de trazados de archivo. Para que ninguno sea una copia, cada uno lleva
//  al menos dos tramos redibujados: un desplazamiento lateral suave (curva en campana) sobre la línea ya
//  suavizada. Todo lo que se construye a partir de la pista (tablero, muros, terreno nivelado, túneles,
//  columnas, balizas) sigue al trazado nuevo; los tramos se eligen lejos de las piezas fijas del entorno.
//  s: centro del tramo (m desde la salida, sobre la línea suavizada) · len: longitud (m) · off: desplazamiento
//  máximo (m; + hacia la derecha en sentido de carrera, − hacia la izquierda)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const EDITS = {
  itaka: [{ s: 9550, len: 500, off: 45 }, { s: 5500, len: 350, off: 35 }],        // recta larga final · subida a la colina
  olympus: [{ s: 1100, len: 450, off: 40 }, { s: 2450, len: 400, off: 45 }],     // salida del valle · recta larga
  tharsis: [{ s: 3100, len: 400, off: 35 }, { s: 2250, len: 260, off: -25 }],     // contrarrecta · enlace del bucle
  tiphares: [{ s: 3750, len: 500, off: -45 }, { s: 5050, len: 350, off: -40 }],    // recta larga · recta de vuelta
  europa: [{ s: 1400, len: 450, off: 45 }, { s: 2500, len: 350, off: -40 }],      // recta opuesta · salida de la sima
  miranda: [{ s: 3300, len: 450, off: 35 }, { s: 1950, len: 300, off: -30 }],     // curva larga · tras la horquilla
  phobos: [{ s: 1600, len: 400, off: -35 }, { s: 6300, len: 400, off: 30 }],      // bajada al cráter · subida a la superficie
  cassini: [{ s: 600, len: 500, off: -45 }, { s: 4450, len: 500, off: 30 }],      // recta de meta (lejos de la parrilla) · curva larga
};

export function reshapeLoop(S, id) {
  const edits = globalThis.__RESHAPE?.[id] ?? EDITS[id] ?? [];
  if (!edits.length) return S;
  const N = S.length;
  const cum = [0];
  for (let i = 1; i < N; i++) cum.push(cum[i - 1] + S[i].distanceTo(S[i - 1]));
  const total = cum[N - 1] + S[0].distanceTo(S[N - 1]);
  const out = S.map((p) => p.clone());
  const t = new THREE.Vector3();
  for (const e of edits) {
    for (let i = 0; i < N; i++) {
      let d = cum[i] - e.s;
      d -= Math.round(d / total) * total;                 // distancia con signo, cerrando el bucle
      const u = d / e.len + 0.5;
      if (u <= 0 || u >= 1) continue;
      const w = Math.sin(Math.PI * u) ** 2;
      t.subVectors(S[(i + 1) % N], S[(i - 1 + N) % N]).setY(0).normalize();
      out[i].x += -t.z * e.off * w;                        // derecha en sentido de carrera = (−t.z, 0, t.x)
      out[i].z += t.x * e.off * w;
    }
  }
  return out;
}
