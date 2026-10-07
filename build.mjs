// Genera dist/index.html: página única y autónoma (three.js + juego + modelo gzip/base64 incrustados).
import { build } from 'esbuild';
import fs from 'fs';
import zlib from 'zlib';
const r = await build({ entryPoints: ['js/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none', alias: { postprocessing: './js/stub-postprocessing.js' } });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const pack = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).toString('base64').replace(/.{1,4096}/g, '$&\n');
const b64 = pack('saturn6.glb'), b64f = pack('ships41.glb');
let html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script type="importmap">');
const end = html.indexOf('<script type="module" src="js/main.js"></script>') + '<script type="module" src="js/main.js"></script>'.length;
const head = html.slice(0, start), tail = html.slice(end);
fs.mkdirSync('dist', { recursive: true });
// 1) Web (Firebase): página ligera; modelos y música como archivos aparte (sin límite de tamaño, caché del navegador)
const web = head + `<script>\n${js}\n</script>` + tail;
fs.writeFileSync('dist/index.html', web);
for (const f of ['saturn6.glb', 'ships41.glb', 'ships41_lite.glb', 'music-obsidian-perimeter.mp3', 'music-obsidian-pursuit.mp3', 'miranda.jpg']) fs.copyFileSync(f, 'dist/' + f);
// 2) Visor de Claude: todo incrustado en un solo archivo (límite 16 MB)
const single = head + `<script id="model-data" type="text/plain">\n${b64}</script>\n<script id="model-fleet" type="text/plain">\n${b64f}</script>\n<script id="music-data" type="text/plain">${fs.readFileSync('music-obsidian-perimeter.mp3').toString('base64')}</script>\n<script>\n${js}\n</script>` + tail;
fs.writeFileSync('dist/single.html', single);
console.log('web', (web.length / 1e6).toFixed(2), 'MB + modelos · single', (single.length / 1e6).toFixed(2), 'MB · js', (js.length / 1e3).toFixed(0), 'KB');
