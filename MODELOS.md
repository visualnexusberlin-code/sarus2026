# Actualizar modelos 3D sin tocar código

Cada cambio en la rama `main` reconstruye el juego y lo publica en Firebase (pestaña **Actions**, 1–2 min).

## Sustituir un modelo
1. En GitHub: **Add file → Upload files** y arrastra el `.glb` con **el mismo nombre** (máx. 25 MB por archivo desde la web).
2. Escribe una línea en "Commit changes" (p. ej. `ILION: nuevo alerón`) y confirma.
3. Espera el ✔ verde en **Actions** y recarga la web.

| Archivo | Qué es |
|---|---|
| `saturn6.glb` | Circuito SATURN-6 (también base de ARCADIA-2) |
| `ships8.glb` | Flota de 12 naves |
| `music.mp3` | Tema musical |

OLYMPUS-3 no usa GLB: se genera en `js/mars.js`.

## Reglas para que la nave siga funcionando al exportar desde Blender
- Un objeto raíz por nave con el nombre de la flota (`ILION_1`, `SCUBA_2`, `THULE_3`… `HUEMING_12`; ver `js/fleet.js`).
- Morro hacia +Z (hacia −Y en Blender antes de exportar con +Y arriba), escala real (~5,5 m de largo).
- Materiales con estos sufijos, que el juego reconoce: `_Hover` (emisores de levitación), `_Ion` (toberas).
- Logo del hangar: objeto `LOGO_NOMBRE` (p. ej. `LOGO_ILION`).
- Exportar como glTF binario (.glb), texturas incrustadas, JPEG para color.
