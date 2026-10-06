#!/bin/bash
set -e
cd /tmp/mv
node tdeform.mjs
node tsplit.mjs | tail -2
node tlobe.mjs
node tcanopy.mjs
IN=tanaka_cab.glb OUT=tanaka_panel.glb node tpanel.mjs
BASE=/home/claude/game/ships38.glb OUT=/tmp/mv/a1.glb S=0.93 R=0.22 node altair2.mjs
IN=a1.glb OUT=a2.glb NODE=ALTAIR_16 node tglass.mjs
IN=a2.glb OUT=ships39.glb node alogo.mjs
