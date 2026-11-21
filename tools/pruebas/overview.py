# Vistas generales de ÍO desde cámaras fijas (sin GPU). uso: python3 -I overview.py <dist> <prefijo>
import sys, threading, functools, http.server, socketserver, os, base64, time
from playwright.sync_api import sync_playwright
d, pre = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async () => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout')); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  const t0 = performance.now();
  G.unlocked.add('io'); G.pickCircuit('io'); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  const loadMs = Math.round(performance.now() - t0);
  if (G.state === 'intro') G.api.endIntro();
  G.noRender = true; G.sim(8); G.noRender = false;
  const tr = G.track, F = tr.frame(), cam = G.camera, out = { loadMs };
  const B = new G.THREE.Box3 ? null : null;
  let mn = [1e9, 1e9], mx = [-1e9, -1e9]; for (let s = 0; s < tr.length; s += 40) { tr.sample(s, F); mn = [Math.min(mn[0], F.pos.x), Math.min(mn[1], F.pos.z)]; mx = [Math.max(mx[0], F.pos.x), Math.max(mx[1], F.pos.z)]; }
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2], R = Math.max(mx[0] - mn[0], mx[1] - mn[1]);
  tr.sample(0, F); const st = F.pos.clone(), stT = F.tan.clone();
  const views = {
    iso: [[c[0] - R * 0.15, R * 0.55, c[1] - R * 0.9], [c[0], -40, c[1] + R * 0.1]],
    terraza: [[c[0], 260, c[1] - R * 0.1], [c[0], 100, c[1] + R * 0.6]],
  };
  const sh = (name) => { G.circuitFx?.update(1 / 30, cam, G); G.composer.render(); out[name] = G.renderer.domElement.toDataURL('image/jpeg', 0.85); };
  for (const [k, [p, t]] of Object.entries(views)) { cam.position.set(...p); cam.lookAt(...t); cam.updateMatrixWorld(); cam.far = 30000; cam.updateProjectionMatrix(); for (let i = 0; i < 40; i++) G.circuitFx?.update(1 / 30, cam, G); sh(k); }
  return out;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1280, "height": 720}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("console", lambda m: m.type == "error" and errs.append(m.text[:200]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    r = pg.evaluate(JS)
    print('carga', r.pop('loadMs'), 'ms')
    for k, v in r.items(): open(f"{pre}_{k}.jpg", "wb").write(base64.b64decode(v.split(',')[1]))
    print(errs[:4]); b.close()
srv.shutdown()
