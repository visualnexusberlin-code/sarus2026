import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = '/home/claude/game/dist';
const types = { '.html':'text/html', '.js':'text/javascript', '.glb':'model/gltf-binary','.mp3':'audio/mpeg' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); try { const b = fs.readFileSync(p.endsWith('/')? p+'index.html':p); r.writeHead(200, {'content-type': types[path.extname(p)]||'text/html'}); r.end(b);} catch(e){ r.writeHead(404); r.end(); } }).listen(8795);
const out = process.argv[2] || '/tmp/claude-0/-home-claude/6979a570-cf23-52a3-9a4a-c1288127608d/scratchpad/shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const VP = JSON.parse(process.env.VP || '{"viewport":{"width":1280,"height":720}}'); const page = await browser.newPage(VP);
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0,300)));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', async (route) => {
  const u = route.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.170.0/', '');
  route.fulfill({ path: path.join(root, 'node_modules/three', u), contentType: 'text/javascript' });
});
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto('http://localhost:8795/index.html' + (process.argv[3]||''));
await page.waitForFunction(() => window.__srs && window.__srs.state === 'title', null, { timeout: 180000 });
console.log('loaded');
const steps = JSON.parse(process.argv[4] || '[]');
await page.screenshot({ path: `${out}/00_title.png` });
for (const [name, code] of steps) {
  const r = await page.evaluate(code);
  if (r) console.log(name, JSON.stringify(r));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 400000 });
}
await browser.close(); srv.close();
