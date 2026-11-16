# Hornea el trazado de todos los circuitos para la vista previa del Solar Map (js/trackshapes.data.js).
# Abre el juego ya construido (dist/) en Chrome sin interfaz, construye cada circuito y lee su pista con G.sampleShape.
# Volver a ejecutarlo cuando se retoque un trazado o se añada un circuito:
#   npm run build && python3 tools/trackshapes.py && npm run build
# Requiere: pip install playwright (y Chrome instalado; CHROME=/ruta/al/chrome si no está en /usr/bin/google-chrome).
import os, json, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.join(ROOT, "dist")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = {}
with sync_playwright() as p:
    exe = os.environ.get("CHROME", "/usr/bin/google-chrome")
    b = p.chromium.launch(executable_path=exe if os.path.exists(exe) else None, args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    pg = b.new_page(viewport={"width": 844, "height": 390})
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?test&lite", wait_until="load", timeout=120000)
    pg.wait_for_function("window.__srs && window.__srs.state !== 'loading' && window.__srs.fleet", timeout=240000)
    ids = pg.evaluate("() => __srs.circuits.map((c) => c.id)")
    for cid in ids:
        out[cid] = pg.evaluate("""(cid) => { const G = __srs; G.noRender = true; G.api.buildCircuit(G.circuits.find((c) => c.id === cid)); G.noRender = false;
            return G.sampleShape(G.track, G.structures && G.structures.tunnel); }""", cid)
        print(cid, out[cid]["len"], "m", "saltos", out[cid]["gaps"], "tunel", out[cid]["tun"], "vuelo", out[cid]["fly"])
    b.close()
srv.shutdown()
with open(os.path.join(ROOT, "js", "trackshapes.data.js"), "w") as f:
    f.write("// Generado por tools/trackshapes.py: no editar a mano. Trazado de cada circuito (bordes del tablero, metros).\n")
    f.write("export const SHAPES = {\n")
    for k, v in out.items(): f.write(f"  {k}: {json.dumps(v, separators=(',', ':'))},\n")
    f.write("};\n")
print("escrito js/trackshapes.data.js", os.path.getsize(os.path.join(ROOT, "js", "trackshapes.data.js")) // 1024, "KB")
