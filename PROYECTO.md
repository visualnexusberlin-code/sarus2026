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

## Relieve del tablero (los tres circuitos)
Piezas alzadas reales (`js/deckdetail.js`): costillas transversales en frenadas, bordillos en diente de sierra por el interior de las curvas, carriles en relieve y campos de placas hexagonales en rectas, cajones de parrilla en la salida.

## Dirección visual
Monocromo cálido (saturación 0,3) con colores intensos conservados. Brillo frontal del sol y de las toberas rebajado para que las naves se lean. Estela de propulsión continua y translúcida en el color de cada escudería.

## Siguiente
Ajuste fino jugando (dificultad Normal como referencia), sonido por nave, escudos/más armas, tercer circuito (añadir entrada en `js/circuits.js`), música/ambiente por circuito.
