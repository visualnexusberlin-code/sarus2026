import sys, threading, functools, http.server, socketserver, os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
d = sys.argv[1]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *x): pass
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.path.abspath(d)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    pg = b.new_page(viewport={"width": 1280, "height": 720}); ext = set(); bad = []
    pg.on("request", lambda r: urlparse(r.url).hostname not in ("127.0.0.1", None) and ext.add(urlparse(r.url).hostname))
    pg.on("response", lambda r: r.status >= 400 and bad.append(f"{r.status} {r.url[-60:]}"))
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?lang=es", wait_until="load", timeout=300000)
    pg.wait_for_timeout(6000)
    print('externos:', sorted(ext), '| 4xx:', bad[:4])
    print(pg.evaluate("document.fonts.ready.then(() => ({ michroma: document.fonts.check('16px Michroma'), plex: document.fonts.check('500 14px \"IBM Plex Mono\"'), cargadas: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join(', ') }))"))
    pg.screenshot(path='/tmp/work/intro/menu.png'); b.close()
srv.shutdown()
