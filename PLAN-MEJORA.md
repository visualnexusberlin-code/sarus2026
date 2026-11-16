# SARUS · Plan general de mejora (estado a 16 de noviembre de 2026)

Documento de relevo: resume dónde está el juego, qué queda por hacer y cómo continuar con cualquier modelo (Claude Opus 5.5 incluido). El detalle técnico de cada sistema está en `PROYECTO.md` y `MODELOS.md`; léelos antes de tocar código.

## 0. Cómo trabajar en este repositorio

- **Ramas y publicación.** `main` se publica sola en https://sarus-2026.web.app. Cada push a una rama `claude/**` o `beta/**` se publica en el canal beta (https://sarus-2026--beta-rc97nqys.web.app) sin tocar la versión pública. Regla de Dear: nunca publicar en `main` sin su «publica» explícito, y antes guardar copia en una rama `estable/AAAA-MM-DD-motivo`.
- **Estado actual.** Rama `claude/fluidez`: contiene fluidez, repaso visual, pista nueva y tipografías en local. Está en la beta y **pendiente de aprobación** para pasar a `main`.
- **Compilar:** `npm run build` (esbuild → `dist/`).
- **Verificar sin GPU** (el entorno de trabajo no tiene tarjeta gráfica): se miden órdenes de dibujo, triángulos, compilaciones de shader y errores con Playwright + SwiftShader y los ganchos de prueba (`window.__srs`, `?test`, `?nogov`, `?debug`). Los fps y el aspecto final solo los puede juzgar Dear en la beta. Decirlo siempre así.
- **Reglas que ya costaron un fallo** (no repetir):
  - No ocultar ni crear luces durante la carrera (recompila todos los materiales).
  - `pow(x, 2.0)` con x negativo da NaN en algunas GPU: usar `(x) * (x)`.
  - `patch` es palabra reservada en GLSL ES 3.0.
  - La flota ligera (`ships45_lite.glb`) se escribe con `VertexLayout.SEPARATE`.
  - Solo cuenta como calentamiento de shaders el fotograma dibujado por `composer.render`.
  - Sin nombres reales ni marcas registradas en el juego.

## 1. Hecho en esta tanda (13–16 de noviembre)

- Naves nuevas VOSTOK_21 y SAILETOR_22 (22 escuderías), escala de flota coherente.
- Cámara de intros: velocidad continua, giro amortiguado, no atraviesa el terreno.
- Fluidez: sin recompilaciones en carrera, regulador de fluidez con memoria, de ~800–1.200 a ~300–450 órdenes de dibujo por imagen.
- Repaso visual: THARSIS (calles, solares, sombras), relieve de Marte, OLYMPUS (luz y base), SELENE (suelo lunar), ARCADIA y SELENE (detalle de estructuras), NUEVA ITAKA (prado y árboles).
- Pista: casco macizo en planetas y lunas (`js/deckprofile.js`), señalización futurista en el shader (`deckMaterial`, `js/dressing.js`).
- Tipografías en local (`fonts/`, SIL OFL): ya no hay ninguna petición a servidores externos.
- Físicas v2: la masa de cada nave manda en la inercia (frenada, empuje, cuestas, crestas, impactos) y V/A/M separan más las naves (`statsFor`, `js/fleet.js`).
- Esfera púrpura y cohete de doble impacto (`js/pickups.js`, `CONFIG.heavy`).

## 2. Pendiente inmediato (antes de publicar en `main`)

1. **Prueba de Dear en la beta:** fluidez real, pista nueva (grosor del casco, intensidad de los LED), luz de OLYMPUS, calles de THARSIS, SELENE.
   - **Físicas v2:** probar tres naves opuestas (CALIBUR, THULE, WOLFEN) y decir si la diferencia se nota poco, bien o demasiado. Solo está comprobado por simulación que ninguna nave se vuelve inconducible para la IA; el tacto no se puede medir sin jugar.
   - **Cohete de doble impacto:** si la esfera púrpura se distingue bien de la roja y si 45 s de reaparición es la escasez que se busca.
2. Ajustes que salgan de esa prueba. Mandos fáciles:
   - Diferencia entre naves: exponentes de la masa en `statsFor` (`js/fleet.js`); cada nave, en su `style`.
   - Púrpura: `CONFIG.heavy` (`side`, `respawn`, `reach`) en `js/config.js`.
   - Casco: perfil `DECK_SOLID` en `js/deckprofile.js` (ancho del hombro, profundidad).
   - Brillo de la señalización: `edgeGlow` / `chevGlow` por circuito en `js/circuits.js` (`paint`), y los factores del bloque «Señalización de pista (v2)» en `js/dressing.js`.
3. Publicar con copia de seguridad.

## 3. Repaso visual que falta, por circuito

Método que funcionó (el de EUROPA y el de esta tanda): 1) capturar la intro y la carrera, 2) nombrar lo que se ve pobre, 3) arreglarlo en el shader o con mallas fundidas (nunca muchas mallas sueltas), 4) medir órdenes de dibujo antes y después, 5) beta.

| Circuito | Estado | Qué falta |
|---|---|---|
| ARCADIA | Parcial | Mar y franja de costa sencillos; torres con poca identidad; pide un repaso propio como el de EUROPA |
| SELENE | Hecho | Revisar nivel de luz con Dear |
| TIPHARES (Venus) | Sin revisar a fondo | Se ve bien en capturas; comprobar pista nueva sobre las nubes |
| CALORIS (Mercurio) | Sin revisar | Terreno en 67 mallas con el mismo material (fundir o trocear mejor); revisar el Sol lejano |
| NUEVA ITAKA | Parcial | Árboles: siguen siendo planos cruzados; faltan caminos y edificios de la sede |
| OLYMPUS | Hecho en parte | La base de apoyo es pequeña; falta vida (tráfico, luces) y un segundo foco de interés en el recorrido |
| THARSIS | Hecho en parte | Farolas en volumen, tráfico, bruma algo más limpia si Dear lo pide |
| PHOBOS, CERES, CASSINI | Sin revisar | Comprobar pista (CERES y CASSINI conservan la losa fina a propósito) |
| EUROPA | Hecho (referencia) | — |
| ENCELADUS, MIRANDA | Sin revisar | Comprobar intro y pista nueva |
| TRITON, PLUTO | Sin revisar | Los mundos pesan 1,8–2,2 M de triángulos: aligerar terreno lejano |

Pendientes de juego del roadmap (`claude/roadmap-sarus-v1.md`): ajustes de CERES, ENCELADUS, CALORIS, TRITON y PLUTO que requieren jugar; sonidos propios de impactos.

## 4. Rendimiento y código

- **Naves a 3–4 materiales** con atlas por nave (hoy la paleta ya funde las piezas lisas; falta atlas para las texturizadas) y compresión de geometría de la flota (meshopt/Draco: de 18,6 MB a ~5 MB en ligera).
- **Cargar solo las naves que corren** en ligera.
- **Fuga de geometrías** al cambiar de circuito (12–50 por cambio; candidatos: misiles, explosiones, estelas, `Flyers`).
- **Duplicación:** los 12 circuitos generados copian el mismo barrido de pista (`sweepSeg`, muros, pilares). Extraerlo a un módulo común reduce errores; el perfil ya está en `deckprofile.js`.
- **Profundidad logarítmica:** probar `?nolog` en móvil; si no parpadea, adoptarlo en ligera.
- **Regulador de fluidez:** validar umbrales en móvil real (`?debug` muestra «fluidez n/N»).
- **Sello de versión** visible en Ajustes (hoy solo en `?debug`).

## 5. Google Play (Android)

No hay proyecto Android en el repositorio todavía. Pasos, en orden:

1. **Envoltorio.** Capacitor (`@capacitor/core`, `@capacitor/android`), `webDir: dist`, orientación apaisada, pantalla completa inmersiva, mantener pantalla encendida. Alternativa sin código nativo: TWA (Bubblewrap) sobre la web publicada; es más simple, pero las compras dentro de la app y el modo sin conexión son más limitados. Recomendación: Capacitor.
2. **Tamaño.** `dist` pesa ~166 MB (flota completa 55 MB, música, GLB). Para Android: incluir solo la flota ligera, comprimir geometría y revisar la música (8 pistas MP3). El límite del paquete base de Play es 200 MB; conviene quedar muy por debajo.
3. **Rendimiento en móvil real.** Probar en al menos un Android de gama media: calidad ligera por defecto, regulador de fluidez, memoria (recarga cada 4 circuitos).
4. **Controles táctiles y pausa** al perder el foco o al recibir una llamada (eventos `pause`/`resume` de Capacitor), botón Atrás de Android.
5. **Audio:** desbloqueo por gesto, pausa en segundo plano.
6. **Compras:** freemium decidido (nodos 01–03 gratis; `sarus_full` a 2,99 €) con Google Play Billing (`cordova-plugin-purchase`). Restaurar compra, estado sin conexión.
7. **Idiomas:** i18n completo ES/EN (hay textos de lore solo en español en partes).
8. **Privacidad y legal.**
   - Política de privacidad pública (URL obligatoria en Play). Hoy el juego no envía datos: solo guarda progreso en el dispositivo (`localStorage`); ya no carga Google Fonts.
   - Formulario «Seguridad de los datos» de Play: sin recogida ni cesión de datos, si se mantiene así. Si se añade analítica o publicidad, cambia.
   - Clasificación de contenido (cuestionario IARC), público objetivo (no dirigir a menores de 13 si no se quiere el programa Familias).
   - Etiquetado de contenido generado con IA donde aplique (AI Act) y créditos y licencias: música (autoría de Dear con Gemini: revisar condiciones de uso comercial), modelos 3D generados, tipografías OFL, three.js y N8AO (MIT).
   - Marcas: confirmar que no quedan nombres registrados (regla ya aplicada).
9. **Ficha de Play:** icono 512², gráfico de funciones 1024×500 (hay material en `store/`), capturas de teléfono y tableta, descripción corta y larga ES/EN, vídeo opcional.
10. **Requisitos técnicos de Play:** API de destino vigente, AAB firmado (Play App Signing), 64 bits, y para cuentas personales nuevas, prueba cerrada con 12 testers durante 14 días antes de producción (comprobar el requisito vigente en la consola).
11. **Pruebas:** pista interna → cerrada → producción; informe previo al lanzamiento de Play.

## 6. Orden recomendado

1. Aprobar y publicar la rama actual.
2. Proyecto Capacitor + compilación de prueba en un Android real (descubre pronto los problemas de tamaño y fluidez).
3. Reducir tamaño (flota ligera comprimida, música).
4. Compras, i18n, privacidad, ficha.
5. En paralelo, repaso visual de ARCADIA, NUEVA ITAKA y CALORIS, que son las que más lo necesitan.
6. Prueba cerrada y lanzamiento.

## 7. Con qué modelo continuar

Opus 5.5 puede continuar todo lo anterior: la base del juego se hizo con él y este plan, `PROYECTO.md` y los comentarios del código están escritos para que cualquier modelo retome el trabajo. Consejos para que rinda:

- Empezar cada sesión pidiendo que lea `PLAN-MEJORA.md` y `PROYECTO.md`.
- Una tarea acotada por sesión (un circuito, o un paso de Android), siempre en una rama `claude/…` y con prueba en la beta.
- Pedir medida antes y después (órdenes de dibujo, errores en los 15 circuitos) y capturas.
- Para el trabajo de shaders y de rendimiento, pedir que explique la causa antes de cambiar nada.
