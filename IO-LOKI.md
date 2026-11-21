# ÍO · LOKI CALDERA — diseño de la fase (publicada en `main` el 21 de noviembre de 2026)

Concepto de Dear (20 de noviembre de 2026): circuito en la caldera de Loki, en Ío, con un lago de lava en el centro, tres cascadas de lava por las paredes de basalto y una colonia minera habitada en la terraza alta (expansión humana de *Cortesía del Tiempo*). Va en el Mapa Solar después de EUROPA: del hielo al fuego, en el mismo sistema de Júpiter.

Referencia de trazado: isométrica `IO_-_LOKI_CALDERA.png` (sectores y desvíos) y su texto.

## Trazado

- Vuelta de unos 8 km sobre la ruta principal, cuatro carriles casi siempre, unas diez curvas de radios distintos.
- Parrilla a la izquierda de la meta; se arranca hacia la derecha por la recta sobre pilares.
- S del flanco derecho junto al pie de una cascada → sube a la bifurcación A.
- Terraza alta de derecha a izquierda junto a la colonia → túnel industrial → bajada por el flanco izquierdo → meta.
- Terrazas, peraltes, cambios de rasante, tramos expuestos. Pendientes locales de 40–50° (a probar pronto con las físicas v2: las naves pesadas pierden mucho en cuesta).

## Desvíos (letales)

| | Ruta | Riesgo | Premio |
|---|---|---|---|
| **A · Viaducto** | Puente corto, sin guardarraíles, sobre una ensenada del lago; recorta la curva superior derecha | Caer a la lava **elimina** la nave | Más corto; arco 2 |
| **B · Salto** | Rampa interior tras el túnel: despegue corto y pronunciado sobre una cresta de basalto, recepción más baja alineada | Despegar torcido o corto → lava → **eliminada** | Más corto |

Decisiones (Claude, aprobadas por Dear el 20 de noviembre):
- Letal solo en los dos desvíos. La ruta principal lleva guardarraíles aunque pase junto a la lava.
- Aviso visual claro en la entrada de cada desvío.
- Viaducto: empezar con **carril y medio**, peralte suave y la luz del arco 2 marcando la trazada; estrecharlo si en la prueba resulta fácil.
- El salto, con el comportamiento de CERES como referencia.

## Arcos (reparto de Dear; orden propuesto por Claude)

| Arco | Dónde | Da | Por qué |
|---|---|---|---|
| 1 | Recta tras la meta | Cohete doble (púrpura) | Abre el combate |
| 2 | Centro del viaducto A | Cohete doble (púrpura) | Premia el riesgo con ataque, no con velocidad: el atajo no se vuelve obligatorio |
| 3 | Terraza de la colonia | Repara el blindaje | A mitad de vuelta, tras la zona de más combate |
| 4 | Descenso final | Megaturbo | Remate hacia la meta |

Cada nave recarga en un mismo arco como mucho una vez por vuelta (si no, el cohete púrpura deja de ser escaso).

## Dirección de arte (referencias de Dear, 20 de noviembre)

Cinco ilustraciones de Ío con Júpiter enorme en el cielo. Lo que se toma de ellas:

- **Cielo negro con estrellas** (Ío no tiene atmósfera), **Júpiter enorme** cerca del horizonte, con la Gran Mancha Roja visible y bandas ocre, crema y óxido. Su luz reflejada tiñe el paisaje de un ámbar cálido; el Sol, pequeño y blanco.
- **Suelo de azufre:** amarillos ácidos y limón, ocres, naranjas, óxido y pardo; manchas de escarcha blanca y blanco verdoso (dióxido de azufre); rocas pardas y negras con relieve rugoso. Nada de un rojo uniforme.
- **Lava viva:** el lago con costra oscura y grietas incandescentes; la orilla con un **borde de fuego continuo** (como Loki Patera vista desde arriba: lago oscuro, perímetro brillante). Cascadas de lava por las paredes de basalto.
- **Penachos volcánicos** en paraguas, altos y difusos, dorados (vulcanismo de Pele), y algún surtidor de fuego a lo lejos.
- **Paredes de basalto** negras y pardas, con vetas de azufre amarillo.
- Una de las referencias tiñe el cielo de verde: es licencia artística (no hay aire que lo tiña). Se puede usar como bruma baja muy leve sobre el lago (vapores), nunca como color del cielo.
- Sensación buscada: calor casi físico. Brillo de la lava hacia arriba sobre las paredes y los bajos de las naves, distorsión por calor sobre el lago, chispas y ceniza en suspensión.

## Estado (20 de noviembre de 2026) · fase 1 hecha: ramales en el motor + trazado en gris

**Ramales** (`Branch` y `BranchView` en `js/track.js`). Un ramal es una pista abierta con su propia línea central entre sA y sB de la principal. La nave que va por él sigue midiendo su posición `s` en la ruta principal: el ramal la traduce en proporción a su propia longitud. Así vueltas, clasificación, rebufo y esferas funcionan igual, y un atajo más corto avanza `s` más deprisa (`ratio`): la ventaja de tiempo sale sola. Física, muros y dibujo usan la geometría real del ramal.
- Entrada: al cruzar sA del lado del desvío (`splitX`); salida en sB. `x` se traduce con el desplazamiento del eje (`offA`, `offB`). `Ship.routeStep()`.
- `open`: tramos sin guardarraíles; salirse del borde es caer (`ship.js`, `openEdge`). `gaps`: tramos de vuelo (salto).
- `lethal`: la caída desde el ramal elimina la nave sin restos (`fallEvent = 'lava'`, aviso en pantalla).
- Esferas, cohetes y choques entre naves solo actúan dentro de la misma ruta (`ship.branch`).
- IA: cada piloto decide una vez por ramal y vuelta (`aiTake`, más probable cuanto más hábil y agresivo); en los ramales estrechos corrige más suave y se aleja del borde.
- El seguro de muro escala su margen al ancho del tablero (antes zigzagueaba en el viaducto).

**Trazado en gris** (`js/io.js`): vuelta de 7,6 km; viaducto de 12 m sin guardarraíles (692 m frente a 905 m de la principal: 24 % más corto); salto de 16 m con rampa, vuelo y recepción con bordes abiertos (884 m frente a 1180 m: 25 % más corto). Lago de lava provisional (plano con grietas). Ío entra en el nodo de Júpiter (09·B) tras EUROPA.

**Medido** (`tools/pruebas/branchtest.py`, carrera acelerada de 180 s con 21 rivales): 33 pasos por el viaducto, 32 saltos, 3 eliminaciones en la lava (≈ 5 %); ninguna nave retrocede en la clasificación; 313 órdenes de dibujo; ninguna compilación de shader en carrera. CERES y EUROPA sin cambios.

**Filas de turbos azules** (petición de Dear, 20 de noviembre): cinco filas de tres esferas de megaturbo que reaparecen a los 1,2 s (`track.megaRows`, `track.megaRespawn` en `io.js`; las lee `Pickups`). Dos seguidas en la recta de salida, una que lanza al viaducto, una en la terraza antes del túnel y otra dentro del túnel que lanza al salto. Medido en 3 min de carrera: 190–220 megaturbos cogidos (casi todo el pelotón, en casi todas las filas) y 6–8 eliminados en la lava, casi todos al entrar con megaturbo en el viaducto o en el salto. La IA con el megaturbo encendido solo se tira al viaducto si es temeraria. Mandos: posiciones en `megaRows`; reaparición en `megaRespawn`.

**Pendiente de la fase 1:** el salto no es aún un vuelo balístico real (sigue la cota del ramal); la recepción no castiga despegar lento.

## Prueba de Dear (21 de noviembre) y arreglos

- **Los cohetes no impactaban en ninguna fase de la beta.** Fallo del código de ramales: la ruta de una nave valía `undefined` y la del cohete `null`, y al compararlas ningún blanco «estaba en la misma ruta». Ahora la ruta es siempre `null` fuera de un ramal y las comparaciones lo normalizan. Medido en ÍO y EUROPA: mismo resultado que la versión pública.
- **Entradas a los desvíos casi invisibles y confusas.**
  - Carril de entrada iluminado en naranja con flechas que corren hacia el desvío, los 260 m previos.
  - Pórtico grande con el nombre («A · VIADUCTO», «B · SALTO») sobre la entrada.
  - Aviso en pantalla a ~450 m, una vez por vuelta, con el lado («Carril derecho →» / «← Carril izquierdo»).
  - **Divisoria física** (morro con luces) en la salida y en la vuelta de cada ramal: arranca en el punto de reparto y se abre hacia el borde a medida que el ramal se aleja (en la vuelta, al revés). Antes se podía cruzar de una ruta a la otra sobre el tablero compartido, y la nave «entraba» o no casi por casualidad.
  - El cambio de ruta se decide justo al cruzar la salida, antes de muros y divisoria (`Ship.update`).
  - La IA respeta la divisoria.
- **Bruma naranja por toda la fase.** Ío no tiene atmósfera: niebla casi a cero, cielo negro, menos resplandor y lava menos sobreexpuesta.

## Segunda prueba de Dear (21 de noviembre): grosor, lava viva y paisaje

- El «humo» en la pista era la estela de los cohetes que nunca impactaban (volaban 4,5 s soltando humo). Resuelto con el arreglo de los cohetes.
- **Grosor de los desvíos:** sección maciza (hombro, costado y quilla en V de 7,9 m) en lugar de la losa de 2 m.
- **Géiseres y burbujas** (`LavaFX`): 16 respiraderos sobre la lava junto a la pista y bajo los desvíos entran en erupción cada 3–12 s (gotas incandescentes que suben 60–170 m y caen enfriándose); burbujas de piel de lava que se hinchan cerca de la cámara y revientan en salpicadura; chispas al pie de las cascadas. Una nube de puntos y una malla instanciada: dos programas, ninguna luz nueva.
- **Caldera** (`buildCaldera`, primera versión): terreno en rejilla según la pista. Dentro del lazo, lago; junto a los tramos altos, repisa de roca bajo el tablero que cae en acantilado al lago. Fuera, la pared de la caldera sube hasta ~380 m y sigue una llanura de azufre. Color por vértice (basalto, azufre, ocre, escarcha, óxido) y brillo de la lava desde abajo.
- **Tres cascadas de lava** por el acantilado (flanco derecho y bajo la colonia), **rocas** sueltas en repisas y lago, **colonia minera** en la terraza alta (módulos con ventanas iluminadas, algunos asomados sobre las cascadas, castilletes con luz roja, conducción hasta el túnel).
- **Júpiter** enorme sobre el horizonte, visible desde la recta de salida (`jupiterSky`, la misma textura que en EUROPA).
- Medido: 356 órdenes de dibujo (137 en ligera), sin compilaciones en carrera.
- Pendiente: el acantilado interior es aún una pared lisa; la colonia puede crecer (más módulos, pasarelas, luces); el lago en sí sigue siendo un plano.

## Tercera tanda (21 de noviembre): más interés y tráfico aéreo

- **Tráfico aéreo** (`IoTraffic`): cuatro lanzaderas mineras que despegan de una plataforma de la colonia, cruzan la caldera en arco y vuelven; un carguero de mineral de 160 m que cruza muy alto y despacio con su fila de luces; y una **patrulla VOSTOK** de tres naves en cuña dando vueltas sobre el lago (la escuadra de *Cortesía del Tiempo*). Se suman a las naves de fondo que ya cruzan todas las fases. La patrulla se monta fuera de la carrera para no dar tirones.
- **Acantilados con estratos**: bandas de basalto, columnas y vetas de azufre en las paredes (en el shader del terreno).
- **Lava con corrientes**: el lago deriva despacio, con grietas finas y pulso de calor.
- **Colonia**: plataforma de aterrizaje con anillo de luz y balizas, y farolas a lo largo de la conducción.
- Medido: 356 órdenes de dibujo de mediana, sin compilaciones en carrera, sin tirones nuevos (pico de JS 18 ms).

## Cuarta prueba de Dear (21 de noviembre)

- **Desvío B imposible de tomar** (se llegaba del túnel a tope y el reparto estaba a 40 m de la boca): ahora está a 230 m de la salida del túnel, el carril de entrada es medio tablero (reparto en el eje) y la fila de turbos azules del túnel pasa a su entrada, para no llegar con el megaturbo encendido. El carril iluminado arranca ya dentro del túnel.
- **«Solapamiento de rampas»**: los ramales macizos asomaban costados y quilla a través del tablero principal mientras se separaban de él, y la rampa del salto empezaba a subir encima de la principal. Ahora, mientras se solapan, solo se dibuja su superficie; la sección maciza empieza donde ya está separado del todo; la rampa no sube hasta haberse separado.
- **Guardarraíl izquierdo** en el viaducto y en la recepción del salto (`rail: 'L'` en `addBranch`; `openAt(s, x)` mira el lado). El lado derecho sigue abierto y letal.
- Medido en 2,5 min: ninguna caída en el viaducto (antes, 1–3); 3 en la recepción del salto.
- Dear lo encuentra algo fácil de ganar (con mucha experiencia de juego). Pendiente de decidir si se sube el ritmo de la IA en ÍO.

## Publicación (21 de noviembre)

- Música propia: **Glacial Pursuit** (Dear, con Gemini), `music-glacial-pursuit.mp3`, clave `glacial` en `js/audio.js`. Antes usaba `pursuit`.
- Rama `claude/io` publicada en `main`. Copia de la versión anterior: rama `estable/2026-11-21-antes-de-io`.
- Pendiente de la fase: ritmo de la IA en ÍO (Dear la encuentra fácil), los cuatro arcos con sus premios, salto balístico real, lava letal en todo el lago.

## Orden de trabajo

1. **Ramales en el motor** (bifurcaciones reales: geometría propia, posición traducida a la ruta principal para vueltas, clasificación, IA y esferas). Probarlos en un trazado de Ío con geometría simple.
2. Trazado de Ío en gris: vuelta, dos desvíos, lava letal, arcos. Medir tiempos de las cuatro rutas con varias naves.
3. Terreno y lago de lava (paredes, cascadas, vapor, brillo).
4. Colonia minera, túnel, pilares.
5. Ajuste, Ío en el Mapa Solar tras EUROPA, beta.
