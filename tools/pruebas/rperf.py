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
  const info = G.renderer.info, S = [], js = []; let prog = info.programs.length; const p0 = prog, news = [];
  G.input.keys.clear(); G.input.keys.add('ArrowUp');
  let T = 0;
  for (let f = 0; f < SECS * 30; f++) {
    const rend = f % 6 === 0; G.noRender = !rend; const t0 = performance.now(); G.tick(1 / 30); const ms = performance.now() - t0; T += 1 / 30;
    if (rend) { S.push([info.render.calls, info.render.triangles, G.ships.filter((q) => !q.far).length]); if (info.programs.length !== prog) { news.push(`${T.toFixed(1)}s +${info.programs.length - prog} ` + info.programs.slice(prog).map((q) => { const gl = G.renderer.getContext(); let src = ''; try { src = gl.getShaderSource(q.fragmentShader) || ''; } catch (e) {} const i = src.lastIndexOf('void main'); return q.name + ' :: ' + src.slice(Math.max(0, i - 260), i + 200).replace(/\s+/g, ' '); }).join(' ;; ')); prog = info.programs.length; } }
    else js.push(ms);
  }
  G.noRender = false;
  const st = (k) => { const v = S.map((s) => s[k]).sort((a, b) => a - b); return [Math.round(v.reduce((a, b) => a + b, 0) / v.length), v[Math.floor(v.length * 0.95)], v[v.length - 1]]; };
  js.sort((a, b) => a - b);
  return { circ: CIRC, state: G.state, lap: G.ship.lap, calls_med_p95_max: st(0), tris_med_p95_max: st(1).map((v) => Math.round(v / 1000) + 'k'), navesCompletas: st(2), programas: p0, nuevosProgramas: news, jsMs_med_p95_max: [js[js.length >> 1], js[Math.floor(js.length * 0.95)], js[js.length - 1]].map((v) => +v.toFixed(1)), level: G.gov ? G.gov.level : null };
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
