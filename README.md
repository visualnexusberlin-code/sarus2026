# SPEED RACING SKIES · prototipo 09 · campeonato SATURN-6 + ARCADIA-2 + OLYMPUS-3

Three.js r170 (módulos ES). Carga `saturn6.glb` (circuito) y `ships8.glb` (flota) y construye todo a partir de los nombres de objetos de Blender.

## Arrancar en local
```bash
npx serve .            # o: python3 -m http.server
# abrir http://localhost:3000/?glb   (?glb = usa el .glb original en vez del base64)
```
Parámetros URL: `?circuit=arcadia` (arranca en ARCADIA-2) · `?glb` · `?touch` (fuerza controles táctiles) · `?debug` (fps, draw calls) · `?reverse` (sentido contrario) · `?nopost` (sin post-proceso).

## Estructura
| Archivo | Qué hace |
|---|---|
| `js/config.js` | **Todos los números ajustables**: física, cámara, niebla, grading |
| `js/track.js` | Línea central extraída de `TRACK \| continuous 32m racing deck` (secciones de 16 vértices) → spline cada 1 m con tangente, derecha, arriba y curvatura. Sectores desde `Sector NN \| gate beam` |
| `js/ship.js` | Física arcade en coordenadas de pista (s, x): empuje, frenos, aerofrenos, derrape, guardarraíles, levitación. Toberas desde `E06 · Nozzle core`, estelas desde `A12 · Outboard scythe` |
| `js/camera.js` | Cámara de persecución (3 modos) + **vuelo de águila** (keyframes en `EagleFlight.build()`) |
| `js/atmosphere.js` | Niebla de altura analítica (sustituye los chunks de three), cielo, lunas veladas, lava procedural, basalto |
| `js/fx.js` | Estelas, polvo, chispas, cohetes junto a los monolitos |
| `js/fleet.js` | **Las 8 naves**: nodo de Blender, V/A/M y estilo de conducción (respuesta, derrape, peso, inclinación, flotación, boost) |
| `js/ai.js` | Pilotos rivales (trazada, frenada por curvatura, esquivas, esferas, disparo) y choques entre naves |
| `js/pickups.js` | Esferas verde (boost) / roja (cohete) y cohetes teledirigidos |
| `js/structures.js` | Túnel con lucernarios y puentes, colocados solos en tramos rectos |
| `js/dressing.js` | Relieve aplicado a la geometría + pintura de asfalto, bordillos y balizas con luz corrida |
| `js/showroom.js` | Hangar de selección de nave |
| `js/hud.js` · `input.js` · `touch.js` · `audio.js` | HUD, teclado + mando + táctil, sonido sintetizado |

## Convenciones de nombres que el código espera del GLB
- Escena del circuito con "Circuit" en el nombre; escena de la nave con "5.5m design"; raíz `PRIME-EX | vehicle root`.
- `TRACK | continuous 32m racing deck`: 16 vértices por sección, v0 y v4 = aristas superiores.
- `MONOLITH NN | dark backbone` → plataformas de lanzamiento de cohetes.
- Se eliminan al cargar: cámaras, `ATMOSPHERE | basin haze`, `PRIME-EX | reference-scale racer`.

## Para añadir naves nuevas
Exportar cada nave en su propia escena con raíz `<NOMBRE> | vehicle root`, morro hacia +Z, ~5,5 m. `new Ship(model, track)` sirve para cualquiera; para IA basta con darle un objeto `input` sintético cada frame.

## Versión publicada (página única)
`node build.mjs` (requiere `npm i -D esbuild three@0.170.0`) genera `dist/index.html`: three.js, el juego y el modelo (gzip + base64) en un solo archivo de ~4 MB, sin dependencias de red. Es lo que se publica como artifact; el visor bloquea los módulos JS y archivos sueltos.

## Flota v07 (`ships7.glb`) · astillero
Las 7 naves de escudería se reconstruyeron a partir de los bocetos en `shipyard/shipyard.js` (una función `buildNOMBRE()` por nave: casco por secciones, placas, torno, librea pintada en textura). `shipyard/preview.html` las renderiza y exporta el GLB (PRIME-EX se copia intacta de `ships6.glb`). Para retocar: editar las estaciones del casco o la librea de una nave, volver a exportar, y `node build.mjs`. El GLB se abre en Blender con materiales PBR y texturas.

## Equilibrio de carrera (prototipo 05)
- **Blindaje** (`fleet.js → hull`): impactos de cohete que aguanta cada nave. ILION y WOLFEN 3 · XELTHUS, PRIME-EX, ADAX, NEXUS 4 · SCUBA y LUDOX 5. Al llegar a cero la nave explota y reaparece a los 3 s, 60 m atrás, con blindaje lleno e invulnerable 2,5 s (`config.js → respawn`).
- **Rebufo** (`config.js → draft`): entre 6 y 50 m detrás de otra nave y a menos de 3,2 m de su eje, hasta +6 % de velocidad punta y +15 % de aceleración.
- **Dificultad** (`config.js → difficulties`, elegible en el hangar con ↑↓): Fácil · Normal · Difícil. Cambia la habilidad de la IA (`skillTop`, `skillStep`), su ritmo global (`pace`: 0,9 / 0,945 / 1), sus errores (frenadas tardías, eses, levantar el pie) y el acercamiento (`rubberGap`, `rubberUp`, `rubberDown`).
- **Acercamiento**: si el rival va detrás, solo actúa a más de 150 m. Si va delante, a partir de `rubberGap` (60 m en Fácil, 100 m en Normal, 150 m en Difícil).
- **Física prototipo 10** (`ship.js`): levitación magnética por curvatura vertical (`track.kvAt`), giro brusco como ráfaga asistida (`QT`), seguro de muro, ensanche de pista (`track.wAt`, `opts.widen` = 0,08).
- **Estelas**: cinta continua y translúcida por tobera (`fx.js → EngineTrails`) en el color de cada escudería.

## Circuitos y campeonato (prototipo 06)
- `js/circuits.js`: cada circuito define sentido, relieve (+ holgura mínima sobre suelo y edificios), atmósfera (cielo, niebla, nubes), luz, grading, pintura de pista, paleta de estructuras y recoloreado de piezas del GLB.
- **ARCADIA-2**: mismo GLB, sentido inverso, relieve ×2,25 + ondulaciones (cota −21 a 386 m, pendiente media 21 %, máx. 80 %), mar turquesa a −50 m, terreno con campos de lavanda/girasol/amapola, 2600 árboles instanciados, ciudad pastel, nubes. `js/landscape.js`.
- Se desbloquea al terminar SATURN-6 (en el visor publicado, triple toque sobre el chip bloqueado lo abre). SATURN-6 abre un campeonato de 2 carreras con puntos 15-12-10-8-6-5-4-3-2-1.
- El mundo se reconstruye en caliente (`buildCircuit`): atmósfera y shaders se regeneran (`applyAtmosphere`), la pista y la geometría fusionada se rehacen desde una copia del GLB.
- Para un tercer circuito: añadir una entrada a `CIRCUITS` con `unlockAfter` y un chip en el hangar.

## Flota v08 (`ships8.glb`) · 12 escuderías
- Nuevas: MANTA-9, BERLIN-10, X3LEE-11, HUE-MING-12 (desde los bocetos). XELTHUS pasa a llamarse **THULE** (nodo `THULE_3`).
- `shipyard/finish.js`: acabado común. Paneles en relieve (juntas, escotillas, remaches, rejillas) → mapa de normales; máscaras de desgaste (desconchones en cantos de panel, arañazos, suciedad, hollín en cola) → albedo + mapa rugosidad/metal; zonas negras/pavonadas de la librea se vuelven metal oscuro satinado; detalle fino repetible en piezas sin librea.
- **Máscaras propias**: `setWear({ chips, scratches, grime })` con imágenes en blanco y negro (blanco = desgaste, ideal 1024–2048 px repetibles) sustituye las procedurales.
- **Identidad (prototipo 08)**: nombre enorme que envuelve el costado, con tratamiento propio (`L.brand`: placa, letra calada, relieve, cursiva, contorno, estela) y tipografía OFL (`shipyard/fonts`):
  ILION Audiowide en placa azul noche con estela · SCUBA Bungee Shade · THULE Tektur calada en placa · LUDOX Big Shoulders Stencil con relieve · WOLFEN Knewave en cursiva con contorno · ADAX Faster One con sombra · NEXUS Wallpoet · MANTA Syncopate rosa con sombra grafito · BERLIN Unbounded sobre placa roja · X3LEE Major Mono Display · HUE-MING Russo One en placa pavonada.
- **Logos** (`shipyard/logos.js`): un símbolo vectorial por escudería → logo 3D extruido (nodos `LOGO_<NOMBRE>` del GLB, flotan y giran sobre la nave en el hangar) y estampado en el lomo de la librea.
- Geometría rehecha desde los bocetos: ILION (escalón de hombro, popa elevada, sin bloque trasero), MANTA (cavidad lateral abierta con núcleo, turbinas y actuadores; visera sobre el morro), HUE-MING (caparazones que dejan ver cuerpo y turbina), LUDOX (turbina adelantada y baja, lamas junto a la aleta).
- Piloto (casco negro lacado, oídos dorados, visor LED ámbar; de PILOTOS.png) en cada cabina, ahora translúcida. Emisores de levitación y filetes luminosos (`*_Hover`) que el juego tiñe con el color de cada escudería.
- Contorno de la librea por longitud de arco (`loft({ arcUV })`): la rotulación mantiene su proporción en cualquier casco. `flatU` para piezas secundarias.
- Exportación: texturas JPEG (calidad 0,8). GLB 7,4 MB (3,8 MB comprimido). Página publicada ≈ 9,2 MB.
- Parrilla de 12, el jugador sale 8º; la habilidad de la IA se reparte en el mismo abanico que con 8 naves.

## OLYMPUS-3 (prototipo 09)
- `js/mars.js`: trazado (píxeles de `mars-layout-ref.png` → metros), terreno (caldera, ladera, lengua de lava, grietas), cotas, saltos (`track.gaps`, `track.jumpLift`), túnel, tablero/muros/pilares generados, rocas, polvo y remolinos, intro propia.
- `Track` acepta `points` (línea central con cotas), `sectors` (fracciones) y `gaps`.
- Atmósfera: exponentes del sol configurables y `glowMix` (halo que tiñe el cielo, no solo suma luz); `redKeep` en el grading.
- `js/deckdetail.js`: relieve del tablero en todos los circuitos.
