#!/bin/bash
# uso: allcheck.sh <dist> <salida> circuito...
d=$1; out=$2; shift 2
for c in "$@"; do r=$(VW=640 COLS=2 timeout 900 python3 -I isheet.py $d $c /tmp/work/intro/chk_$c.jpg 2 2>&1 | grep -v "GL Driver" | tail -4 | tr '\n' ' ' | cut -c1-420); echo "$c :: $r" >> $out; done
echo FIN >> $out
