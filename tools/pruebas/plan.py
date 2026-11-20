# Planta de Ío: pista principal y ramales (sin GPU). uso: python3 -I plan.py <dist> <out.png>
import sys, json, threading, functools, http.server, socketserver, os
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async () => {
  const G = window.__srs, wait = (f, ms = 400000) => new Promise((ok, no) => { const t0 = Date.now(); const h = setInterval(() => { try { G.tick(1/30); } catch (e) {} if (f()) { clearInterval(h); ok(); } else if (Date.now() - t0 > ms) { clearInterval(h); no(new Error('timeout')); } }, 30); });
  G.store.set('sarus-trained', true); G.store.set('sarus-lineage', true); G.select(); G.showChoice(0);
  G.unlocked.add('io'); G.pickCircuit('io'); G.confirm();
  await wait(() => G.state === 'intro' || G.state === 'countdown' || G.state === 'race');
  const tr = G.track, F = tr.frame(), main = [];
  for (let s = 0; s < tr.length; s += 8) { tr.sample(s, F); main.push([F.pos.x, F.pos.z, F.pos.y, tr.kappaAt(s)]); }
  const br = tr.branches.map((b) => { const p = []; let km = 0; for (let u = 0; u <= b.blen; u += 4) { b.sampleU(u, F); const k = b.kappa[Math.round(u / b.bds)]; km = Math.max(km, Math.abs(k)); p.push([F.pos.x, F.pos.z, F.pos.y, b.gapAtU(u) >= 0 ? 1 : b.openAtU(u) ? 2 : 0]); } return { id: b.id, p, kmax: km, rmin: Math.round(1 / km) }; });
  const marks = Object.fromEntries(Object.entries(G.circuitDbg?.s || {}).map(([k, s]) => { tr.sample(s, F); return [k, [F.pos.x, F.pos.z]]; }));
  return { main, br, marks };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    pg = b.new_page(viewport={"width": 320, "height": 180})
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es&test", wait_until="load", timeout=300000)
    pg.wait_for_function("window.__srs && window.__srs.fleet && window.__srs.fleet.length>=20 && window.__srs.state!=='loading'", timeout=300000)
    r = pg.evaluate(JS); b.close()
srv.shutdown()
allp = r['main'] + [q for br in r['br'] for q in br['p']]
x0 = min(q[0] for q in allp); x1 = max(q[0] for q in allp); z0 = min(q[1] for q in allp); z1 = max(q[1] for q in allp)
W = 1400; sc = (W - 80) / max(x1 - x0, z1 - z0); H = int((z1 - z0) * sc) + 80
img = Image.new('RGB', (W, H), (24, 14, 10)); g = ImageDraw.Draw(img)
P = lambda q: (40 + (q[0] - x0) * sc, H - 40 - (q[1] - z0) * sc)
ymin = min(q[2] for q in allp); ymax = max(q[2] for q in allp)
col = lambda y: (int(90 + 165 * (y - ymin) / (ymax - ymin + 1e-6)), 200, int(255 - 165 * (y - ymin) / (ymax - ymin + 1e-6)))
m = r['main']
for i in range(len(m)): g.line([P(m[i]), P(m[(i + 1) % len(m)])], fill=col(m[i][2]), width=int(max(2, 32 * sc)))
for br in r['br']:
    pp = br['p']
    for i in range(len(pp) - 1): g.line([P(pp[i]), P(pp[i + 1])], fill=(255, 60, 30) if pp[i][3] == 1 else (255, 170, 40) if pp[i][3] == 2 else (230, 230, 230), width=int(max(2, 14 * sc)))
    g.text(P(pp[len(pp) // 2]), f"{br['id']} rmin {br['rmin']} m", fill=(255, 255, 255))
for k, q in r['marks'].items(): g.ellipse([P(q)[0] - 4, P(q)[1] - 4, P(q)[0] + 4, P(q)[1] + 4], fill=(255, 255, 0)); g.text((P(q)[0] + 6, P(q)[1] - 6), k, fill=(255, 255, 0))
g.text((10, 10), f"cotas {ymin:.0f}..{ymax:.0f} m (azul bajo, verde-amarillo alto) · ramal: blanco con muros, naranja abierto, rojo vuelo", fill=(255, 255, 255))
img.save(out); print([(br['id'], br['rmin']) for br in r['br']])
