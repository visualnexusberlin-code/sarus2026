# Capturas en carrera en ÍO: la nave del jugador (pilotada por la IA) toma los dos desvíos.
import sys, json, threading, functools, http.server, socketserver, os, base64
from playwright.sync_api import sync_playwright
d, pre = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async () => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout ' + G.state)); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add('io'); G.pickCircuit('io'); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  if (G.state === 'intro') G.api.endIntro();
  G.sim(5); if (G.state !== 'race') G.sim(3);
  const tr = G.track, me = G.ship, [A, B] = tr.branches; A.aiTake = 1; B.aiTake = 1;
  const ai = new G.AIDriver(me, tr, { skill: 1, aggression: 0.2 }); ai.mistakes = 0.0001; ai.errT = 1e9;
  me.invuln = 1e9; G.playerAI = ai;
  const shots = {}, want = [['forkA', A.sA - 120], ['viaduct', A.sA + A.span * 0.5], ['forkB', B.sA - 60], ['jump', B.sA + B.span * 0.28], ['land', B.sA + B.span * 0.42]];
  me.reset(A.sA - 600, 0); me.v = 150;
  let k = 0;
  for (let f = 0; f < 30 * 120 && k < want.length; f++) {
    G.noRender = true; G.tick(1 / 30);
    const [name, s] = want[k];
    if (tr.delta(s, me.s) >= 0 && tr.delta(s, me.s) < 40) { G.noRender = false; G.tick(1 / 30); G.tick(1 / 30); shots[name] = { img: G.renderer.domElement.toDataURL('image/jpeg', 0.85), br: me.branch?.id || 'main', x: +me.x.toFixed(1), out: me.out }; k++; }
  }
  G.noRender = false;
  return shots;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 540}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    r = pg.evaluate(JS)
    for k, v in r.items():
        open(f"{pre}_{k}.jpg", "wb").write(base64.b64decode(v['img'].split(',')[1])); print(k, v['br'], v['x'], v['out'])
    print(errs[:3]); b.close()
srv.shutdown()
