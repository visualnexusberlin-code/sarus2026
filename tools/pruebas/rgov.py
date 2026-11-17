# Mide la cinemática de la cámara de intro: saltos de velocidad y de giro. uso: python3 -I imeasure.py <dist> <circuito>
import sys, json, threading, functools, http.server, socketserver, os
from playwright.sync_api import sync_playwright
d, circ = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async ([CIRC, SECS]) => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout ' + G.state)); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add(CIRC); G.pickCircuit(CIRC); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  if (G.state === 'intro') G.api.endIntro();
  G.sim(5); if (G.state !== 'race') G.sim(3);
  const info = G.renderer.info, out = []; G.input.keys.clear(); G.input.keys.add('ArrowUp'); G.sim(4);
  const snap = (tag) => { G.noRender = false; G.tick(1 / 30); G.tick(1 / 30); out.push(`${tag}: nivel ${G.gov.level} pr ${G.gov.pr} lodK ${G.gov.lodK} low ${!!G.gov.low} calls ${info.render.calls} tris ${Math.round(info.render.triangles / 1000)}k completas ${G.ships.filter((q) => !q.far).length} proxy ${G.ships.filter((q) => q.shadowProxy).length} fx0 ${G.ships.filter((q) => q.fxLevel === 0).length}`); };
  snap('inicio');
  for (let L = 1; L <= 8; L++) { G.govSet(L, 'prueba'); G.sim(0.6); snap('baja'); }
  G.govSet(0, 'prueba'); G.sim(0.6); snap('sube');
  return { circ: CIRC, out, stored: localStorage.getItem('srs-gov') };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 480, "height": 270}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test" + (("&" + sys.argv[3]) if len(sys.argv) > 3 else ""), wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    try: print(json.dumps(pg.evaluate(JS, [circ, int(sys.argv[4]) if len(sys.argv) > 4 else 45])))
    except Exception as e: print('ERR', circ, str(e)[:300])
    print(errs[:3]); b.close()
srv.shutdown()
