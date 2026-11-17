# Mide la cinemática de la cámara de intro: saltos de velocidad y de giro. uso: python3 -I imeasure.py <dist> <circuito>
import sys, json, threading, functools, http.server, socketserver, os
from playwright.sync_api import sync_playwright
d, circ = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async ([CIRC, N, T0, T1]) => { const G_ = window.__srs, THREE_ = G_.THREE;
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout ' + G.state)); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add(CIRC); G.pickCircuit(CIRC); G.confirm();
  await wait(() => G.state === 'intro');
  const I = G.intro, dt = 1 / 60, imgs = [], under = []; I.t = 0; I.roll = 0; I.done = false; I.q = null; I.update(0); G.noRender = true;
  const NF = N || 20, rc = new THREE_.Raycaster(), up = new THREE_.Vector3(0, -1, 0), o = new THREE_.Vector3();
  const metas = []; G.world.traverse((m) => { if (m.isMesh && m.visible && !m.isInstancedMesh && !m.material.transparent) metas.push(m); });
  let nextShot = T0 || 0; const step = ((T1 || I.duration) - nextShot) / NF;
  let tChk = 0;
  while (I.t < I.duration - 1e-3) {
    I.update(dt);
    if (I.t >= tChk) { tChk += 0.2; o.copy(I.cam.position); o.y += 4000; rc.set(o, up); rc.far = 4000 - 0.3; if (I.t > I.duration - 2.1) continue; const h = rc.intersectObjects(metas, false)[0];
      if (h) under.push(`${I.t.toFixed(1)}s bajo ${(h.object.name || h.object.material.name || 'malla').slice(0, 24)} por ${(h.point.y - I.cam.position.y).toFixed(0)} m`); }
    if (I.t >= nextShot && imgs.length < NF) { nextShot += step; G.noRender = false; G.composer.render(0.016); imgs.push(G.renderer.domElement.toDataURL('image/jpeg', 0.8)); G.noRender = true; }
  }
  return { imgs, under, dur: I.duration, worst: (G.liftCache && G.liftCache.worst) + ' | ' + ((G.liftCache && G.liftCache.info) || []).filter((x, i) => i % 3 === 0).join(' ; ') };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": int(os.environ.get("VW", 640)), "height": int(os.environ.get("VW", 640)) * 9 // 16}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); cons = []; pg.on("console", lambda m: (m.type == "error" or "Shader Error" in m.text) and cons.append(m.text[:400]))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test&nogov", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    r = pg.evaluate(JS, [circ, int(sys.argv[4]) if len(sys.argv) > 4 else 20, float(sys.argv[5]) if len(sys.argv) > 5 else 0, float(sys.argv[6]) if len(sys.argv) > 6 else 0])
    import base64
    from PIL import Image
    import io
    ims = [Image.open(io.BytesIO(base64.b64decode(im.split(',')[1]))) for im in r['imgs']]
    w, h = ims[0].size; cols = int(os.environ.get("COLS", 5)); rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (w * cols, h * rows))
    for k, im in enumerate(ims): sh.paste(im, ((k % cols) * w, (k // cols) * h))
    sh.save(sys.argv[3], quality=86)
    print(r['dur'], len(ims), 'elevación', r.get('worst')); print('\n'.join(r['under'][:60]))
    print(errs[:3]); print([c for c in cons][:4]); b.close()
srv.shutdown()
