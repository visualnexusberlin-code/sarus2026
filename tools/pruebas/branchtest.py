# Prueba de ramales en ÍO: carrera acelerada con la IA; registra quién toma cada desvío, caídas a la lava y coherencia de vueltas.
import sys, json, threading, functools, http.server, socketserver, os, base64
from playwright.sync_api import sync_playwright
d = sys.argv[1]; SECS = int(sys.argv[2]) if len(sys.argv) > 2 else 240
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async ([SECS]) => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout ' + G.state)); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add('io'); G.pickCircuit('io'); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  if (G.state === 'intro') G.api.endIntro();
  G.sim(5); if (G.state !== 'race') G.sim(3);
  const tr = G.track, br = tr.branches, R = { len: Math.round(tr.length), branches: br.map((b) => ({ id: b.id, sA: Math.round(b.sA), sB: Math.round(b.sB), blen: Math.round(b.blen), span: Math.round(b.span), ratio: +b.ratio.toFixed(3), side: b.side })) };
  const ev = {}, dbg = [], me = G.ship;
  me.assist = 1;                                       // el jugador lo lleva la IA para la prueba
  const ai = new G.AIDriver(me, tr, { skill: 0.95, aggression: 0.6 });
  G.ships.forEach((q) => { q._seen = {}; });
  let T = 0, prevDist = new Map(), back = 0, maxJump = 0;
  for (let f = 0; f < SECS * 30; f++) {
    G.input.keys.clear();
    G.noRender = true; G.tick(1 / 30); T += 1 / 30;
    for (const q of G.ships) {
      if (q.routeEvent) { const k = q.routeEvent; ev[k] = (ev[k] || 0) + 1; q.routeEvent = null; }
      const pd = prevDist.get(q); if (pd !== undefined && !q.out) { const dd = q.distance - pd; if (dd < -1) back++; if (dd > maxJump) maxJump = dd; } prevDist.set(q, q.distance);
    }
    if (f % 300 === 0) dbg.push([Math.round(T), G.ships.filter((q) => q.branch).map((q) => q.name + '@' + q.branch.id + ':' + q.x.toFixed(1)).join(' ')]);
    if (G.state !== 'race') break;
  }
  G.noRender = false;
  R.events = ev; R.lavaOut = G.ships.filter((q) => q.sunk).map((q) => q.name); R.out = G.ships.filter((q) => q.out).length;
  R.onBranch = G.ships.filter((q) => q.branch).map((q) => ({ n: q.name, b: q.branch.id, x: +q.x.toFixed(1), out: q.out, sunk: !!q.sunk, fall: +q.fall.toFixed(2), v: Math.round(q.v), u: Math.round(q.branch.u(q.s)), hull: q.hull, player: q === me }));
  R.laps = G.ships.map((q) => q.race?.lap ?? q.lap).slice(0, 22); R.state = G.state; R.T = Math.round(T); R.backSteps = back; R.maxStep = +maxJump.toFixed(2); R.dbg = [];
  return R;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 480, "height": 270}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: m.type == "error" and errs.append(m.text[:200]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    try: print(json.dumps(pg.evaluate(JS, [SECS]), ensure_ascii=False, indent=1))
    except Exception as e: print('ERR', str(e)[:600])
    print(errs[:5]); b.close()
srv.shutdown()
