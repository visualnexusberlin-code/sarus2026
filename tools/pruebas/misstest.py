# ¿Impactan los cohetes? uso: python3 -I misstest.py <dist> <circuito>
import sys, threading, functools, http.server, socketserver, os
from playwright.sync_api import sync_playwright
d, circ = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async ([CIRC]) => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout')); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add(CIRC); G.pickCircuit(CIRC); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  if (G.state === 'intro') G.api.endIntro();
  G.sim(6);
  const me = G.ship, tr = G.track, res = [];
  for (let k = 0; k < 3; k++) {
    const v = G.ships.find((q) => q !== me && !q.out);
    v.invuln = 0; v.dead = 0; v.s = tr.wrap(me.s + 80); v.x = me.x; v.v = me.v; const h0 = v.hull;
    me.ammo = 1; G.missiles.fire(me, G.ships); G.sim(3);
    res.push(`${v.name}: ${h0}→${v.hull}`);
  }
  return res;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    pg = b.new_page(viewport={"width": 320, "height": 180}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    print(circ, pg.evaluate(JS, [circ]), errs[:2]); b.close()
srv.shutdown()
