# Vuelta en solitario de cada nave con la IA: tiempo, golpes de muro. uso: python3 -I phys.py <dist> <circuito>
import sys, json, threading, functools, http.server, socketserver, os
from playwright.sync_api import sync_playwright
d, circ = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async ([CIRC]) => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout ' + G.state)); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add(CIRC); G.pickCircuit(CIRC); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  if (G.state === 'intro') G.api.endIntro();
  const sh = G.ships.find((q) => q !== G.ship) || G.ship, tr = G.track, C0 = G.CONFIG.ship;
  const old = (d) => { const s = d.style || {}; const vmax = (139 + d.V * 3.2) * 1.12; return { vmax, vmaxBoost: vmax + 46, accel: (36 + d.A * 3) * 1.5, turnMult: 0.86 + d.M * 0.045, turnResponse: s.response ?? 7.5, grip: s.grip ?? 5.2, gripAirbrake: s.gripAB ?? 7.5, airbrakeTurn: (s.ab ?? 0.95) * 1.1, mass: s.mass ?? 1, wallLoss: s.wallLoss ?? 1, boostAccel: 46 * (s.boostAccel ?? 1), boostDrain: 0.34 * (s.boostDrain ?? 1), boostRegen: 0.055 * (s.boostRegen ?? 1), slideDrag: 0 }; };
  const run = (stats) => {
    sh.C = { ...C0, ...stats }; sh.reset(0, 0); sh.out = false;
    const ai = new G.AIDriver(sh, tr, { skill: 0.97, bias: 0, aggression: 0.6, seed: 0.3 }); ai.mistakes = 0.0001; ai.errT = 1e9;
    let t = 0, walls = 0, scrape = 0, dist0 = 0, lapT = null, start = null, vmaxSeen = 0, vmin = 1e9;
    const dt = 1 / 60;
    while (t < 400) {
      const inp = ai.update(dt, [sh], 0); sh.update(dt, inp); t += dt;
      if (sh.fall > 0 || sh.out) return { fail: 'fall' };
      if (start === null && sh.distance > 300) { start = t; dist0 = sh.distance; }
      if (start !== null) { if (sh.wallHit > 2) walls++; if (sh.scraping > 0.5) scrape += dt; vmaxSeen = Math.max(vmaxSeen, sh.v); vmin = Math.min(vmin, sh.v);
        if (sh.distance - dist0 >= tr.length) { lapT = t - start; break; } }
    }
    return { lap: lapT && +lapT.toFixed(2), walls, scrape: +scrape.toFixed(1), vtop: Math.round(vmaxSeen * 3.6), vmin: Math.round(vmin * 3.6) };
  };
  const out = {};
  for (const d of G.fleet.map((q) => (q.V ? q : q.def))) out[d.name] = { old: run(old(d)), neu: run(G.statsFor(d)) };
  return { circ: CIRC, len: Math.round(tr.length), out };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 320, "height": 180}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    try:
        r = pg.evaluate(JS, [circ]); print(r['circ'], r['len'], 'm')
        for k, v in r['out'].items(): print(f"{k:10s} antes {v['old']}  ahora {v['neu']}")
    except Exception as e: print('ERR', circ, str(e)[:400])
    print(errs[:3]); b.close()
srv.shutdown()
