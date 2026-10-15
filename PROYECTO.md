# Prototipo SATURN-6 — decisiones técnicas y visuales

## Estado (prototipo 10)
Hangar con las 8 naves, dificultad y circuito → intro "vuelo de águila" → parrilla de 8 (jugador 6º) → 3 vueltas con IA → clasificación. Portátil (teclado/mando) y móvil (táctil). Publicado como página única (~5,8 MB, modelos gzip+base64 incrustados; el visor bloquea módulos JS y archivos sueltos).

## Circuito (SATURN-6_v03)
- GLB: 6,39 km, 32 m de ancho, deck 70–240 m, pendiente media 8,6 %, máx. 34 %. Línea central desde `TRACK | continuous 32m racing deck` (516 secciones × 16 vértices).
- **Relieve amplificado en el juego** (config `relief`): perfil ×1,45 + ondulaciones → 20–299 m, pendiente media 15 %, máx. 50 %. `?flat` lo desactiva.
- Sentido de carrera: el de los numerales del suelo. `?reverse` invierte.
- Añadidos procedurales: túnel de 300 m con lucernarios; 3 puentes (viga, arco, doble pasarela).

## Flota v08 (`ships8.glb`) · 12 escuderías
Todas procedurales desde los bocetos (`shipyard/`), salvo PRIME-EX (modelo original). XELTHUS → **THULE**.
| # | Nave | Colores | V/A/M | Blindaje | Tipografía (tratamiento) | Desgaste |
|---|---|---|---|---|---|---|
| 01 | ILION | azul + plata | 5/4/3 | 3 | Audiowide (placa azul noche, cursiva, estela) · logo: cimera troyana | medio |
| 02 | SCUBA | amarillo + petróleo | 3/4/5 | 5 | Bungee Shade · logo: ojo de buey con burbujas | alto |
| 03 | THULE | púrpura + pizarra | 3/5/4 | 4 | Tektur (calada en placa clara) · logo: estrella del norte sobre picos | bajo |
| 04 | LUDOX | petróleo + naranja | 4/3/5 | 5 | Big Shoulders Stencil (relieve) · logo: tuerca hexagonal con galones | alto |
| 05 | PRIME-EX | perla + bermellón | 4/4/4 | 4 | (original) · logo: proa triangular | — |
| 06 | WOLFEN | lima + negro | 5/5/2 | 3 | Knewave (cursiva, contorno) · logo: lobo facetado | medio |
| 07 | ADAX | naranja + negro | 5/3/4 | 4 | Faster One (sombra) · logo: A con faro | medio |
| 08 | NEXUS | marino + cian | 4/5/3 | 4 | Wallpoet · logo: tridente | medio |
| 09 | MANTA | blanco perla + grafito + rosa | 4/4/4 | 4 | Syncopate rosa (sombra) · logo: manta raya | bajo |
| 10 | BERLIN | blanco + naranja + negro (+rojo) | 5/4/3 | 3 | Unbounded (placa roja) · logo: torre con esfera | medio |
| 11 | X3LEE | perla + negro | 4/3/5 | 4 | Major Mono Display · logo: X y tres trazos | mínimo |
| 12 | HUE-MING | gris + pavonado (+naranja) | 3/5/4 | 5 | Russo One (placa pavonada) · logo: rotor de turbina | muy alto |

Acabado común: paneles en relieve, desgaste por máscaras (sustituibles por texturas propias con `setWear`), bandas de ruptura negras/metal oscuro, nombre grande desgastado en el costado, rotulación técnica, piloto con casco de PILOTOS.png tras cabina translúcida, emisores de levitación y filetes con el color de escudería.
Hangar: el logo 3D de cada escudería flota y gira sobre la nave.
Geometría rehecha desde los bocetos en prototipo 08: ILION, MANTA, HUE-MING, LUDOX.
Pendiente: legibilidad del nombre en WOLFEN (se mezcla con su librea) y HUE-MING; BERLIN solo se lee por el costado sin cuchilla; siguiente pasada de geometría para ADAX, SCUBA y WOLFEN si se quiere más fidelidad.

## Juego
- Esferas: verde = boost; roja = cohete (máx. 2). Filas de 3 cada 430 m.
- Cohete teledirigido: impacto = frenazo, trompo, 0,7 s sin control y −1 de blindaje. A cero: explosión, reaparición a los 3 s, 60 m atrás, blindaje lleno, 2,5 s invulnerable.
- Giro brusco (doble toque izquierda/derecha; LB/RB en mando; deslizamiento rápido en móvil): desde el prototipo 10 es una **ráfaga de pilotaje asistido** de 0,5 s. La nave lee la curva y traza sola hacia una línea al 40 % del muro del lado pedido, con más autoridad de giro y agarre ×2,2, y devuelve el control en 0,4 s. Ya no da tirón ni cruza la nave al muro contrario.
- Cámaras: persecución, cercana (tercera persona pegada al casco), lejana, morro.
- **Cercanía de carrera** sin tocar el concepto: rebufo (6–50 m detrás, +6 % punta), errores humanos de la IA, 3 dificultades, acercamiento solo con huecos grandes.
- **Levitación magnética** (prototipo 10): el tablero atrae la nave. En los valles el colchón se comprime (hasta −0,7 m) y en las crestas la nave se separa según v² × curvatura vertical (2 m en SATURN-6, 4,5 m en ARCADIA-2, hasta 6 m en OLYMPUS-3) y vuelve a caer con un muelle más blando arriba. El morro cabecea con la rasante. La pendiente pesa más (0,5 g): se gana en bajada y se paga en subida.
- **Asistencia de dirección** (tecla H) más arcade: +45 % de giro a alta velocidad, lee el 75 % de la curva, se realinea sola, seguro de muro (si en 0,55 s va a tocar el guardarraíl, gira hacia dentro) y los golpes cuestan un 60 % menos.
- **Pista más ancha en las curvas**: +8 % en las curvas medias y cerradas (≈30 % del trazado), sin cambiar el trazado. Muro, bordillos, piezas del tablero y colisiones siguen el ensanche (`track.wAt`).
- **Dificultades** rehechas: la IA tiene un abanico de habilidad más amplio y un ritmo global por dificultad (Fácil 90 %, Normal 94,5 %, Difícil 100 %). En Fácil los rivales esperan si se escapan más de 60 m.

## ARCADIA-2 (segundo circuito, campeonato)
- Mismo GLB en sentido inverso; relieve ×2,25 con holgura mínima de 30 m sobre suelo/edificios: cota −21 a 386 m, pendiente media 21 %, máx. 80 %. En las crestas se despega más (levitación hasta 8 m).
- Costa al sol: cielo azul con nubes, mar turquesa que cubre la cuenca de lava, isla verde con campos de lavanda, girasol y amapola, cipreses, pinos piñoneros y arbustos en flor, ciudad en cal/terracota/ocre/azul/rosa, pilares terracota, costillas turquesa, casetas de colores en el agua.
- Pista: líneas blancas, discontinuas amarillas, chevrons magenta, bordillos amarillo/azul, balizas magenta, guía turquesa. Grading sin monocromo.
- Se desbloquea al terminar SATURN-6; campeonato de 2 carreras, puntos 15-12-10-8-6-5-4-3-2-1. En el visor publicado el desbloqueo no persiste entre visitas: triple toque en el chip bloqueado.

## OLYMPUS-3 (tercera fase, Marte)
- Circuito generado (`js/mars.js`), no sale del GLB: trazado digitalizado de la referencia (silueta tipo Spa), escalado a 8,8 km y suavizado para radios aptos a 600 km/h.
- Sobre el borde de la caldera del Olympus Mons: la recta larga corre por el filo con el abismo (paredes de ~2,5 km con terrazas) a un lado; la segunda mitad baja por la ladera exterior con coladas radiales. Curvatura del planeta en el horizonte.
- Cotas que siguen la montaña (−246 a +88 m): bajada y subida tipo Eau Rouge, cresta en la recta. **Dos saltos** sobre grietas (el tablero se corta; la nave vuela en parábola según su velocidad) y **túnel de ~670 m** dentro de una lengua de lava.
- Atardecer azul marciano (referencia de Dear): sol diminuto casi en el horizonte al final de la recta, halo azul frío, cielo tostado, suelo óxido con campos de rocas oscuras, bruma densa en las capas bajas, velos de polvo arrastrados por el viento y remolinos en la ladera. Grading más monocromo.
- Se desbloquea tras ARCADIA-2; el campeonato pasa a 3 carreras.

## NUEVA-ITAKA (cuarta fase, isla orbital)
- Circuito generado (`js/itaka.js`): trazado digitalizado de la referencia del Nordschleife (103 puntos ajustados a la banda de la imagen), 10,5 km.
- Isla flotante en órbita baja: praderas, parcelas y bosques de pinos; cara inferior de roca que cuelga en el vacío y rocas flotando alrededor. Dos colinas altas (Hohe Acht ≈ 290 m y Wehrseifen ≈ 250 m) con subidas de hasta el 26 %.
- La pista va entera dentro de un **tubo continuo**: cristal liso con cuadernas, cristal con rejilla hexagonal en las subidas y en tramos alternos, y **paneles hexagonales luminosos** en los tramos subterráneos (Flugplatz y Schwalbenschwanz). Las bocas llevan pórtico en arco con aro de luz.
- Cúpula de rejilla hexagonal sobre toda la isla. Fondo: espacio con 9000 estrellas, la **Tierra** (océanos, continentes, nubes, luces nocturnas y atmósfera) y la **Luna**.
- Se desbloquea tras OLYMPUS-3; el campeonato pasa a 4 carreras.
- Música propia: *Velvet Velocity* (`music-velvet-velocity.mp3`, compuesta por Dear con Gemini); antes sonaba *Obsidian Perimeter*, que se repetía en cuatro fases.

## Relieve del tablero (todos los circuitos)
Piezas alzadas reales (`js/deckdetail.js`): costillas transversales en frenadas, bordillos en diente de sierra por el interior de las curvas, carriles en relieve y campos de placas hexagonales en rectas, cajones de parrilla en la salida.

## Dirección visual
Monocromo cálido (saturación 0,3) con colores intensos conservados. Brillo frontal del sol y de las toberas rebajado para que las naves se lean. Estela de propulsión continua y translúcida en el color de cada escudería.

## Siguiente
Ajuste fino jugando (dificultad Normal como referencia), sonido por nave, escudos/más armas, tercer circuito (añadir entrada en `js/circuits.js`), música/ambiente por circuito.

## CERES TRANSIT (nodo 07, cinturón principal)
- Circuito generado (`js/ceres.js`), trazado propio sin origen en ningún circuito real: planta en «8» cerrada numéricamente, 8,28 km, cotas −257 a +125 m. Entre PHOBOS y EUROPA.
- **Tramos:** parrilla en una plataforma minera frente al asteroide Alfa · **TRIPLE BORE**, túnel perforado de 1,2 km con tres carriles (izquierdo de impulso, centro neutro, derecho de gases que recargan el boost y frenan) · paso por dentro de Gamma (el nudo del 8) · **THE DROP**, el tablero se corta y se cae 50 m · **THE GEODE**, asteroide hueco Beta con hélice libre alrededor de un núcleo de cristal que gira · **THE WALL**, pared a 55° que sube 268 m por la cara de Gamma y termina en un despegue balístico de ~90 m sobre la cumbre · **SHADOW STRAIGHT**, recta entre campos de fuerza con impactos anunciados.
- **Elemento nuevo, la pared:** `wallGrip` en `circuits.js` (pendiente > 0,62, 380 km/h). Por debajo, la nave se despega, pierde empuje y la pendiente pesa el doble (`ship.js`); nunca se queda clavada. Aviso MAG GRIP en el HUD.
- **Recta:** impactos cada 2–4 s delante de alguna nave (aro de aviso 1,6 s, roca, destello; frenazo y trompo). Rebufo de iones: 2,2 s pegado a otra nave repara +1 de blindaje.
- **Estética:** contraluz con el sol bajo de frente en la salida, polvo dorado y rayos de luz, roca parda con motas de sal, acentos blanco sal y ámbar sodio. Ceres gibosa al fondo, banda del cinturón en el cielo. Túnel redondo de broca (frente al octógono de PHOBOS) y tubo de celosía abierto (frente al cristal de NUEVA ITAKA).
- **Rendimiento:** ~2.000 rocas instanciadas en 5 formas que giran en el shader, pasillo libre de 60 m alrededor de la pista. Versión ligera: unas 620 rocas de baja resolución.
- **Intro propia (24,5 s):** teleobjetivo desde el fondo del enjambre con Gamma recortada contra el sol, paso entre rocas, la pared de perfil, despegue sobre el vacío y bajada a SHADOW STRAIGHT hasta la parrilla. `EagleFlight` desplaza la llegada común cuando una intro propia dura más.

## ENCELADUS (nodo 09·B, sistema de Saturno)
- `js/enceladus.js`. Trazado con la silueta de Japón (44 puntos de control, ~9 km), salida en la recta de la costa oeste.
- Superficie (0–0,32 y 0,855–1): hielo en falso color infrarrojo (cian y azul, grietas), cuatro rayas de tigre rojas y anaranjadas con géiseres; tablero sobre puntales blancos y dos tramos de tubo.
- THE DESCENT / THE ASCENT: rampas dentro del tubo blanco dodecagonal (apotema 22 m), que atraviesa la corteza; huecos por cápsulas en el hielo y en el techo del vacío.
- GALLERIES: tubos colgados en el vacío (techo −95 m, galerías −225 m), con ventanas a torres y pilares a contraluz, haces de luz y niebla de altura. Dos anillos de cohetes (0,485 y 0,742), un cohete cada uno.
- FREE FLIGHT: `track.flight` + `track.flightAt/place`. Sin tablero; el eje lateral se curva sobre un arco de radio 26 m hasta ~110° (`ship.js`), con límites blandos. Tres bandas de luz, costillas parciales y una lámina casi invisible.
- Intro: Encélado entero con su penacho y Saturno en creciente, picado sobre el polo, a ras de una raya entre géiseres, ruinas anteriores a SARUS y la parrilla.
- El campeonato pasa a 12 carreras.

## CALORIS (nodo 04, Mercurio)
- `js/mercury.js`. Trazado de archivo digitalizado de la referencia de Dear, **invertido en horizontal y en vertical** (giro de 180°), ~8,2 km. Cotas −300 a −175 m: toda la vuelta va enterrada salvo la salida.
- **CALORIS SHAFT:** la parrilla está en el fondo de un pozo abierto en la superficie (fondo de 395 m de radio, cuatro terrazas de hormigón hasta el borde, anillo de luces y mástiles), a pleno sol. Las dos bocas de las galerías se abren en la primera terraza.
- **Galerías:** naves barridas en marco horizontal (no se inclinan con el peralte), con anchura, techo y abismo por tramo, limitados por el radio de curva, la distancia a otros tramos y 25 m de roca bajo la superficie. Hormigón brutalista en placas de 12 × 9 m con juntas, agujeros de encofrado y regueros; líneas de luz punteada, placas retroiluminadas sueltas, losas inclinadas apoyadas en los muros, vigas, pasarelas, tuberías, péndolas, máquinas al fondo, carteles con códigos y haces de luz desde las rejillas.
- **Tramos:** FOUNDRY HALLS · THE TURN y THE RETURN (las dos horquillas de 180°, dentro del tubo dodecagonal de ENCELADUS en hormigón oscuro: `tubeMaterial` ahora es exportable y admite tono) · COLUMN ROW · THE WELL (puente sobre un pozo vertical de 120 m de radio que sube a la superficie, con haz de sol, y baja a la niebla) · PRESS LINE · INFINITE GALLERY (la recta larga, nave alta y estrecha que se pierde en la bruma).
- **Obstáculos:** 5 columnas que atraviesan el tablero y 6 prensas colgadas hasta él (`track.obstacles`). Cada choque cuesta 1 de blindaje, frenazo y trompo (`ship.hit()`, como un cohete) y puede eliminar. La IA los esquiva (`ai.js`, reacciona antes con más nivel). Anillo de reparación antes del pozo. Las filas de esferas se apartan de los obstáculos.
- **Luz:** bajo tierra el sol se apaga al 97 % (`dimSun`), porque la sombra del techo solo cubre unos metros alrededor de la nave. Bruma de altura más densa abajo. El túnel cubierto ocupa más de media vuelta: el cálculo de «dentro del túnel» ya no usa `delta` (que daba la vuelta a mitad de pista).
- **Intro (29 s, 4 s más para enganchar el arranque del tema):** llegada desde muy lejos con el Sol llenando el plano (radio aparente ~11°, granulación triplanar), Mercurio en tránsito como un disco negro junto al limbo, amanecer rasante sobre el limbo, descenso al lado de día y aproximación por la prolongación de la recta de meta hasta el picado al pozo. El Sol se orienta con la recta de meta (51° de altura, de frente a la parrilla), así la cámara no cruza nunca por encima del pozo: el giro brusco de la primera versión (160°/s) baja a menos de 40°/s.
- **Superficie quemada:** regolito y hormigón del pozo mucho más claros, sol a 6,2 y exposición +35 % a cielo abierto (`openBoost`, se apaga al entrar en las galerías).
- **Parpadeo:** el detalle fino del hormigón (juntas, agujeros, franjas) se apaga con la distancia y las líneas de luz punteada se ensanchan a un píxel y se promedian; vigas del techo y mamparos separados de las superficies con las que coincidían.
- Música propia: *Theorbo in Motion* (`music-theorbo-in-motion.mp3`, compuesta por Dear con Gemini).
- Nodo nuevo en el Solar Map entre Venus y Nueva Itaka; los nodos pasan a ser 11 y el campeonato a 13 carreras. La primera carrera no elimina a nadie, para que el total de cortes no cambie.

## TRITON CHASM (nodo 12, sistema de Neptuno · última fase)
- `js/triton.js`. Trazado propio de Dear (sin origen en ningún circuito real), 9,3 km en 3D (8,5 km en planta), cotas −634 a +82 m. Gravedad 0,079 g.
- **Tramos:** PIT STRAIGHT sobre la llanura de hielo de nitrógeno (boxes con ventanal azul y tribuna, Neptuno a la espalda) · CANTALOUPE, eslalon por crestas y células del terreno «cantalupo» con pendientes de 35–41° · THE CHASM, trinchera, portal brutalista y descenso por una sima en la corteza de hielo de agua (dos tramos a 46° y 39°, hasta −634 m) · STRATA, túnel técnico estrecho · THE LAUNCH, rampa a 55° que sale casi en vertical y salta una grieta de 90 m · GEYSER FIELD · NEPTUNE STRAIGHT.
- **Terreno cantalupo:** células de Voronoi en dos escalas (430 y 150 m), hondonadas con bordes alzados, nudos y vetas oscuras de los géiseres; el relieve grande sigue a la pista (las células se hunden donde baja el tablero). Llanuras de nitrógeno lisas y rosadas en las dos rectas.
- **La sima:** secciones de hasta 300 m de ancho y 550 de alto, muros en estratos de hielo con labios redondeados, vetas de amoníaco y luz azul en uno de cada tres labios; fachadas brutalistas incrustadas en el hielo con ventanucos, pilares colosales, pasarelas, celosías altas, haces de luz y humo flotante. Bruma de altura muy densa en profundidad y de color claro: lo cercano oscuro, lo lejano claro.
- **Física:** `slopeG` 0,55 (la pendiente pesa la mitad), `hoverMax` 9 (en las crestas se despega mucho), `wallGrip` en la rampa (por debajo de ~330 km/h el imán no sujeta). Salto con `track.gaps` (sin caída al vacío).
- **Cielo:** Neptuno enorme (≈13° de radio aparente, a 450 km: más lejos la profundidad en precisión simple recorta fragmentos y aparecen manchas negras) al oeste sobre la recta final, con bandas, gran mancha oscura, cirros, borde cian y anillos tenues; Sol diminuto; cáscara negra de espacio delante de la cúpula (la niebla sigue usando el color claro bajo tierra) con un halo tenue de bruma sobre el horizonte.
- **Géiseres:** ocho penachos doblados por el viento junto a la salida; pasar cerca da una sacudida suave (`kind: 'shake'`).
- **Intro (~31 s):** Neptuno llenando el plano, bajada sobre el polo con los géiseres, la recta final hacia Neptuno, giro amplio sobre la horquilla y llegada por detrás de la parrilla.
- Anillo de cohetes (2) en el fondo de la sima. Nodo 12 en el Solar Map (Neptuno y Tritón en órbita retrógrada). El campeonato pasa a 14 carreras; las dos primeras no eliminan, así que el número total de cortes no cambia.
