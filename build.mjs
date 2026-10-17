// Genera dist/index.html: página única y autónoma (three.js + juego + modelo gzip/base64 incrustados).
import { build } from 'esbuild';
import fs from 'fs';
import zlib from 'zlib';
const r = await build({ entryPoints: ['js/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none', alias: { postprocessing: './js/stub-postprocessing.js' } });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const pack = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).toString('base64').replace(/.{1,4096}/g, '$&\n');
const b64 = pack('saturn6.glb'), b64f = pack('ships45.glb');
let html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script type="importmap">');
const end = html.indexOf('<script type="module" src="js/main.js"></script>') + '<script type="module" src="js/main.js"></script>'.length;
const head = html.slice(0, start), tail = html.slice(end);
const APP = process.argv.includes('--app');   // salida para Capacitor (Android): sin single.html y sin dependencias externas
const OUT = APP ? 'dist-app' : 'dist';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// 1) Web (Firebase): página ligera; modelos y música como archivos aparte (sin límite de tamaño, caché del navegador)
let web = head + `<script>\n${js}\n</script>` + tail;
const ASSETS = ['saturn6.glb', 'ships45.glb', 'ships45_lite.glb', 'music-obsidian-perimeter.mp3', 'music-obsidian-pursuit.mp3', 'music-black-glass-horizon.mp3', 'music-glass-observatory.mp3', 'music-theorbo-in-motion.mp3', 'music-velvet-velocity.mp3', 'music-beneath-the-ninth.mp3', 'sarus-mark.svg', 'miranda.jpg', 'cover-title.jpg', 'cover-title-sm.jpg'];
if (APP) {
  // fuentes locales (las mismas: Michroma e IBM Plex Mono 300/400/500) en lugar de Google Fonts
  fs.mkdirSync(`${OUT}/fonts`, { recursive: true });
  const FONTS = [['Michroma', 400, '@fontsource/michroma/files/michroma-latin-400-normal.woff2'],
    ['IBM Plex Mono', 300, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-300-normal.woff2'],
    ['IBM Plex Mono', 400, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'],
    ['IBM Plex Mono', 500, '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2']];
  const faces = FONTS.map(([fam, w, src]) => { const n = src.split('/').pop(); fs.copyFileSync('node_modules/' + src, `${OUT}/fonts/${n}`);
    return `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${n}) format("woff2")}`; }).join('');
  web = web.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, `<style>${faces}</style>`);
  if (/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/.test(web)) throw new Error('quedan dependencias externas en la salida de la app');
}
// avisos de licencia de terceros y política de privacidad (también accesible desde Ajustes)
const lic = (title, file) => `== ${title} ==\n${fs.readFileSync(file, 'utf8').trim()}\n`;
fs.writeFileSync(`${OUT}/THIRD_PARTY_NOTICES.txt`, ['SARUS · Speed Racing Skies — avisos de licencia de terceros\n',
  lic('three.js (MIT)', 'node_modules/three/LICENSE'), lic('n8ao (ISC)', 'node_modules/n8ao/LICENSE'),
  lic('Michroma (SIL Open Font License 1.1)', 'node_modules/@fontsource/michroma/LICENSE'), lic('IBM Plex Mono (SIL Open Font License 1.1)', 'node_modules/@fontsource/ibm-plex-mono/LICENSE')].join('\n'));
for (const f of [...ASSETS, 'privacy.html']) fs.copyFileSync(f, `${OUT}/` + f);
fs.writeFileSync(`${OUT}/index.html`, web);
if (APP) { console.log('app', (web.length / 1e6).toFixed(2), 'MB + recursos →', OUT); process.exit(0); }
// 2) Visor de Claude: todo incrustado en un solo archivo (límite 16 MB)
const single = head + `<script id="model-data" type="text/plain">\n${b64}</script>\n<script id="model-fleet" type="text/plain">\n${b64f}</script>\n<script id="music-data" type="text/plain">${fs.readFileSync('music-obsidian-perimeter.mp3').toString('base64')}</script>\n<script>\n${js}\n</script>` + tail;
fs.writeFileSync('dist/single.html', single);
console.log('web', (web.length / 1e6).toFixed(2), 'MB + modelos · single', (single.length / 1e6).toFixed(2), 'MB · js', (js.length / 1e3).toFixed(0), 'KB');
