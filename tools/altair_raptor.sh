#!/bin/bash
# Nueva ALTAIR_16 desde el GLB «Raptor» de Meshy (en /tmp/mv, con node_modules de gltf-transform, sharp, meshoptimizer)
set -e
cd /tmp/mv
node rap_retex.mjs raptor_src.glb raptor_rt.glb                  # borra el dorsal «38» (color, normales y rugosidad)
node rap_slim.mjs raptor_rt.glb raptor_slim.glb                 # ~62k triángulos, base 2048 y normales/MR 1024 en JPEG
CREASE=50 node knorm.mjs raptor_slim.glb raptor_nn.glb
BASE=ships45.glb SRC=raptor_nn.glb OUT=fleet_a1.glb node raptor.mjs   # orientación, toberas, levitación, cabina en gota y piloto NEXUS
cp fleet_a1.glb fleet_a2.glb && F=fleet_a2.glb NODE=ALTAIR_16 TEXT=ALTAIR MODE=enamel LEN=1.5 CZ=-0.4 CX=0.7 LIFT=0.035 R=0.14 node nname.mjs
TRIS=1800 node lod.mjs fleet_a2.glb fleet_a3.glb
node lite.mjs fleet_a3.glb lite_all.glb && NODE=ALTAIR_16 node splice.mjs ships45_lite.glb lite_all.glb lite_new.glb
