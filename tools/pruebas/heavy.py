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
  G.sim(5); if (G.state !== 'race') G.sim(3);
  const R = {}, P = G.pickups, h = P.heavyItem, tr = G.track, me = G.ship, info = G.renderer.info;
  R.state = G.state; R.purple = h && { s: Math.round(h.s), x: +h.x.toFixed(1), replaced: P.items.filter((i) => i.replaced).length, reds: P.items.filter((i) => i.type === 'R').length };
  const lanes = { side: 0, mid: 0 }; for (let i = 0; i < 400; i++) { P.placeHeavy(); lanes[Math.abs(P.heavyItem.x) > 1 ? 'side' : 'mid']++; } R.lanes = lanes; R.replacedAfter = P.items.filter((i) => i.replaced).length;
  const prog0 = info.programs.length;
  const others = G.ships.filter((q) => q !== me);
  const park = () => others.forEach((o, i) => { o.s = tr.wrap(h.s + 3000 + i * 40); o.v = 0; });
  // recoger la púrpura
  park(); me.s = tr.wrap(h.s - 30); me.x = h.x; me.v = 60; me.psi = me.phi = 0; me.ammo = 0; me.heavy = 0;
  G.input.keys.clear(); G.input.keys.add('ArrowUp'); G.sim(1.2);
  R.picked = { ammo: me.ammo, heavy: me.heavy, active: h.active, banner: G.hud.el.cardBig ? undefined : undefined, weaponHeavy: document.getElementById('weapon').classList.contains('heavy') };
  // cadena: dos naves por delante
  const [a, b] = others; const setup = (gapB) => { me.x = 0; me.psi = me.phi = 0; me.v = 80; a.out = b.out = false; a.invuln = b.invuln = 0; a.dead = b.dead = 0; a.hull = a.maxHull; b.hull = b.maxHull; a.s = tr.wrap(me.s + 90); a.x = 0; a.v = 80; b.s = tr.wrap(a.s + gapB); b.x = 2; b.v = 80; };
  setup(120); const ha = a.hull, hb = b.hull;
  G.missiles.fire(me, G.ships); G.sim(0.1);
  R.fired = { ammo: me.ammo, heavy: me.heavy, missiles: G.missiles.list.map((m) => [m.heavy, m.charges]) };
  G.sim(4);
  R.chain = { a: `${a.name} ${ha}→${a.hull}`, b: `${b.name} ${hb}→${b.hull}`, left: G.missiles.list.length };
  // doble: un solo blanco al alcance
  G.sim(4); park(); me.ammo = 1; me.heavy = 1; me.s = tr.wrap(me.s); setup(2500); const ha2 = a.hull;
  G.missiles.fire(me, G.ships); G.sim(0.1); G.sim(4);
  R.double = { a: `${a.name} ${ha2}→${a.hull}${a.out ? ' (fuera)' : ''}`, b: `${b.hull}/${b.maxHull}` };
  // normal sigue quitando 1
  G.sim(4); me.ammo = 1; me.heavy = 0; setup(2500); const ha3 = a.hull;
  G.missiles.fire(me, G.ships); G.sim(0.1); G.sim(4);
  R.normal = `${ha3}→${a.hull}`;
  G.tick(1/30); G.tick(1/30);
  R.newPrograms = info.programs.length - prog0;
  // foto de la esfera
  P.reset(); const hh = P.heavyItem; park(); me.s = tr.wrap(hh.s - 38); me.x = hh.x * 0.5; me.v = 0; me.psi = me.phi = 0; me.ammo = 1; me.heavy = 1; G.input.keys.clear();
  G.sim(1.5); for (let i = 0; i < 4; i++) G.tick(1/30);
  R.img = G.renderer.domElement.toDataURL('image/jpeg', 0.85);
  return R;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 540}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: m.type == "error" and errs.append(m.text[:200]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    try:
        r = pg.evaluate(JS, [circ])
        import base64
        open(f"/tmp/work/intro/heavy_{circ}.jpg", "wb").write(base64.b64decode(r.pop('img').split(',')[1]))
        for k, v in r.items(): print(k, v)
    except Exception as e: print('ERR', circ, str(e)[:500])
    print(errs[:4]); b.close()
srv.shutdown()
