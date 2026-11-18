// SARUS · rotulado de carenado para toda la flota (nov. 2026)
// Quita las calcomanías de nombre anteriores (<NAVE>_name) y pone en cada nave la placa del sistema común (plates.mjs)
// en los dos costados, proyectada sobre el casco real. Los costados son lo que se ve en el hangar (la nave gira con la
// cámara casi a ras), en las intros y cuando un rival pasa al lado; una placa plana encima apenas se lee desde la
// cámara de carrera (16° sobre el horizonte), así que la cubierta solo se usa si la nave no tiene costado liso.
// Busca solo el mejor sitio: el mayor rectángulo de casco liso, sin cristal ni emisores, igual en los dos lados.
// Todas las placas comparten un atlas y un material («FLEET | Name livery»): un solo programa de shader.
//
// Uso (desde una carpeta con @gltf-transform, sharp, gl-matrix y opentype.js):
//   F=ships45.glb OUT=out.glb [LITE=1] [ONLY=RAMA_14,ORION_18] [SKIP=WOLFEN_6] [PREVIEW=dir] node livery/apply.mjs
// Ajustes a mano por nave: OVERRIDE abajo.
import { NodeIO, VertexLayout } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { mat4, vec3 } from 'gl-matrix';
import fs from 'node:fs';
import { fleetData } from './fleetdata.mjs';
import { atlasSVG, TILE_W, TILE_H } from './plates.mjs';

const REPO = process.env.REPO || '/home/claude/sarus2026';
const LITE = !!process.env.LITE;
const ASPECT = TILE_W / TILE_H;

// Ajustes por nave (metros, espacio de la nave: morro +Z, arriba +Y).
// face: 'side' | 'top' · cz: centro a lo largo · cy: altura (side) · cx: desplazamiento lateral (top, pareja) · w: largo de la placa
// ink: 'dark' | 'light' · maxW: tope de largo en la búsqueda automática · skip: true (sin placa)
export const OVERRIDE = {
  WOLFEN_6: { skip: true },     // ya lleva WOLFEN enorme en los costados (textura original)
  BERLIN_10: { skip: true },    // ya lleva BERLIN enorme en los costados (textura original)
  // Revisión de Dear (18 nov. 2026): en estas la placa caía sobre la cabina o en mal sitio; vuelven a su rótulo original
  SCUBA_2: { skip: true }, NEXUS_8: { skip: true }, MANTA_9: { skip: true }, X3LEE_11: { skip: true },
  HUEMING_12: { skip: true }, VEGA_13: { skip: true }, RAMA_14: { skip: true }, KIBEROS_17: { skip: true },
  ORION_18: { skip: true }, PHANTOM_19: { skip: true }, ANTARES_20: { skip: true },
  SAILETOR_22: { maxW: 1.7, tilts: [0, 12, 25] },   // casco muy trabajado: placa más corta y casi vertical, sobre el composite liso del flanco
};
// SPOTS=fichero.json: usa los sitios guardados (SAVE=) en una pasada anterior (la flota ligera copia los de la completa)
const SAVED = process.env.SPOTS ? JSON.parse(fs.readFileSync(process.env.SPOTS, 'utf8')) : null;
const SKIP = new Set((process.env.SKIP || '').split(',').filter(Boolean));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
if (LITE) io.setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(process.env.F);
const root = doc.getRoot(), buf = root.listBuffers()[0];
const fleet = fleetData(REPO);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const BAD = /glass|Glass|canopy|Canopy|cockpit|Cockpit|visor|Visor|lattice|Ion|Hover|Halo|PILOT|LOGO|Name|lamp|Lamp|Grille/;
const SKIP_NODE = /_name$|_pilot|_ion$|_hover|_halo|_grille|_lod|LOGO|livery|_lamps/;

// texturas decodificadas (para elegir la tinta según el color real del casco)
const texCache = new Map();
async function texel(tex, u, v) {
  if (!texCache.has(tex)) { const { data, info } = await sharp(Buffer.from(tex.getImage())).resize({ width: 256, height: 256, fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); texCache.set(tex, { data, info }); }
  const { data, info } = texCache.get(tex);
  const x = Math.min(info.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * info.height)));
  const i = (y * info.width + x) * 3; return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
}

function gather(R) {
  const tris = [];
  const inv = mat4.invert(mat4.create(), R.getWorldMatrix());
  for (const c of R.listChildren()) {
    if (SKIP_NODE.test(c.getName())) continue;
    c.traverse((n) => {
      const mesh = n.getMesh(); if (!mesh) return;
      const M = mat4.multiply(mat4.create(), inv, n.getWorldMatrix());
      for (const p of mesh.listPrimitives()) {
        const mat = p.getMaterial(), name = mat?.getName() || '';
        const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), ind = p.getIndices();
        const P = [], U = [], v = [0, 0, 0], t = [0, 0];
        for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); P.push(vec3.transformMat4([0, 0, 0], v, M)); if (uv) { uv.getElement(i, t); U.push([t[0], t[1]]); } }
        const N = ind ? ind.getCount() : pos.getCount(), idx = (k) => (ind ? ind.getScalar(k) : k);
        for (let k = 0; k + 2 < N; k += 3) { const a = idx(k), b = idx(k + 1), cc = idx(k + 2); tris.push({ a: P[a], b: P[b], c: P[cc], ua: U[a], ub: U[b], uc: U[cc], mat, bad: BAD.test(name) || BAD.test(c.getName()) }); }
      }
    });
  }
  return tris;
}

// Proyecciones: el rayo entra por «depth» decreciente. p, q: coordenadas en el plano de la placa.
// Costados con el rayo inclinado «tilt» grados hacia arriba: los cascos con flancos que se cierran hacia arriba
// (RAMA, ORION, ANTARES…) no tienen cara vertical, pero sí una cara lisa vista desde un lado y algo por encima.
const PROJ = { top: { f: (P) => [P[0], P[2], P[1]], inv: (p, q, d) => [p, d, q], axis: [0, 1, 0] } };
function sideProj(side, tilt) {
  const t = tilt * Math.PI / 180, a = [side * Math.cos(t), Math.sin(t), 0], b = [-side * Math.sin(t), Math.cos(t), 0];
  return { f: (P) => [P[2], P[0] * b[0] + P[1] * b[1], P[0] * a[0] + P[1] * a[1]], inv: (p, q, d) => [a[0] * d + b[0] * q, a[1] * d + b[1] * q, p], axis: a };
}
const TILTS = [0, 22, 40];

// Rayos paralelos: triángulos repartidos en celdas del plano; devuelve el primer impacto (el más exterior)
function makeField(tris, proj) {
  const CELL = 0.05, grid = new Map(), T = tris.map((t) => ({ t, a: proj.f(t.a), b: proj.f(t.b), c: proj.f(t.c) }));
  let p0 = 1e9, p1 = -1e9, q0 = 1e9, q1 = -1e9;
  for (const o of T) {
    const ps = [o.a[0], o.b[0], o.c[0]], qs = [o.a[1], o.b[1], o.c[1]];
    p0 = Math.min(p0, ...ps); p1 = Math.max(p1, ...ps); q0 = Math.min(q0, ...qs); q1 = Math.max(q1, ...qs);
    const ai = Math.floor(Math.min(...ps) / CELL), bi = Math.floor(Math.max(...ps) / CELL), aj = Math.floor(Math.min(...qs) / CELL), bj = Math.floor(Math.max(...qs) / CELL);
    if ((bi - ai + 1) * (bj - aj + 1) > 4000) continue;
    for (let i = ai; i <= bi; i++) for (let j = aj; j <= bj; j++) { const k = i * 100003 + j; let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(o); }
  }
  function hit(p, q) {
    const L = grid.get(Math.floor(p / CELL) * 100003 + Math.floor(q / CELL)); if (!L) return null;
    let best = null;
    for (const o of L) {
      const [ax, az] = o.a, [bx, bz] = o.b, [cx, cz] = o.c;
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (p - cx) + (cx - bx) * (q - cz)) / d, l2 = ((cz - az) * (p - cx) + (ax - cx) * (q - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const depth = l1 * o.a[2] + l2 * o.b[2] + l3 * o.c[2];
      if (!best || depth > best.depth) best = { depth, t: o.t, l: [l1, l2, l3] };
    }
    if (best) {
      const t = best.t, n = vec3.normalize([0, 0, 0], vec3.cross([0, 0, 0], vec3.sub([0, 0, 0], t.b, t.a), vec3.sub([0, 0, 0], t.c, t.a)));
      if (vec3.dot(n, proj.axis) < 0) vec3.scale(n, n, -1);
      best.n = n; best.facing = vec3.dot(n, proj.axis); best.P = proj.inv(p, q, best.depth);
    }
    return best;
  }
  return { hit, p0, p1, q0, q1, proj };
}

// ¿cabe una placa de largo w centrada en (p, q)? Devuelve las muestras o null
function fits(F, p, q, w, minFacing) {
  const h = w / ASPECT, NX = 12, NZ = 4, S = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const r = F.hit(p + (i / NX - 0.5) * w, q + (j / NZ - 0.5) * h);
    if (!r || r.t.bad || r.facing < minFacing) return null;
    S.push(r);
  }
  const dx = w / NX, dz = h / NZ;                       // sin escalones entre muestras vecinas
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const d = S[j * (NX + 1) + i].depth;
    if (i < NX && Math.abs(S[j * (NX + 1) + i + 1].depth - d) > dx * 0.8) return null;
    if (j < NZ && Math.abs(S[(j + 1) * (NX + 1) + i].depth - d) > dz * 0.8) return null;
  }
  return S;
}

// Costados: la misma placa a los dos lados (p = z, q = y). Se prefiere el largo; a igual largo, más arriba y más atrás.
function placeSide(R, Fr, Fl, o, tilt) {
  const L = Fr.p1 - Fr.p0, zA = Fr.p0 + 0.1 * L, zB = Fr.p1 - 0.18 * L;
  for (let w = Math.min(o.maxW || 2.6, 0.6 * L); w >= 0.6; w -= 0.05) {
    const h = w / ASPECT; let best = null;
    for (let q = Fr.q1 - h / 2; q >= Fr.q0 + h / 2; q -= 0.03)
      for (let p = zA + w / 2; p <= zB - w / 2; p += 0.04) {
        const A = fits(Fr, p, q, w, 0.45); if (!A) continue;
        const B = fits(Fl, p, q, w, 0.45); if (!B) continue;
        const score = q * 2 - p * 0.3;
        if (!best || score > best.score) best = { face: 'side', tilt, cz: p, cy: q, w, S: A.concat(B), score };
      }
    if (best) return best;
  }
  return null;
}
function placeTop(Ft, o) {
  const L = Ft.q1 - Ft.q0, half = Math.min(-Ft.p0, Ft.p1), zA = Ft.q0 + 0.05 * L, zB = Ft.q0 + 0.62 * L;
  for (let w = Math.min(o.maxW || 1.9, 2 * half * 0.92); w >= 0.4; w -= 0.03)
    for (let q = zA + w / ASPECT / 2; q <= zB; q += 0.03) { const S = fits(Ft, 0, q, w, 0.72); if (S) return { face: 'top', cx: 0, cz: q, w, S }; }
  return null;
}

async function inkFor(S) {
  let sum = 0, n = 0;
  for (const r of S) {
    const m = r.t.mat; if (!m) continue;
    const f = m.getBaseColorFactor(); let c = [f[0], f[1], f[2]].map((v) => Math.pow(v, 1 / 2.2));
    const tex = m.getBaseColorTexture();
    if (tex && r.t.ua) { const u = r.l[0] * r.t.ua[0] + r.l[1] * r.t.ub[0] + r.l[2] * r.t.uc[0], v = r.l[0] * r.t.ua[1] + r.l[1] * r.t.ub[1] + r.l[2] * r.t.uc[1]; const tx = await texel(tex, u, v); c = c.map((k, i) => k * tx[i]); }
    const metal = m.getMetallicFactor() * (1 - m.getRoughnessFactor());   // el metal pulido se ve más oscuro en pista
    sum += (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * (1 - 0.45 * metal); n++;
  }
  const lum = n ? sum / n : 0.5;
  return { ink: lum > 0.42 ? 'dark' : 'light', lum };
}

// Malla de la placa: rejilla que sigue el casco (cada vértice es un impacto del rayo), separada 8 mm por su normal
function decalMesh(spot, fields, tile, cols, rows, mat, name) {
  const NU = LITE ? 32 : 48, NV = LITE ? 8 : 10, h = spot.w / ASPECT, lift = 0.008;
  const pos = [], nrm = [], uv = [], idx = [];
  const col = tile % cols, row = Math.floor(tile / cols);
  // cada copia: campo de rayos + cómo va el texto (u: izquierda→derecha de quien mira, v: abajo→arriba)
  const copies = spot.face === 'side'
    ? [{ F: fields.side[spot.tilt].right, pq: (u, v) => [spot.cz - (u - 0.5) * spot.w, spot.cy + (v - 0.5) * h] },     // costado derecho (+X): se lee del morro a la cola
       { F: fields.side[spot.tilt].left, pq: (u, v) => [spot.cz + (u - 0.5) * spot.w, spot.cy + (v - 0.5) * h] }]      // costado izquierdo: de la cola al morro
    : (spot.cx ? [spot.cx, -spot.cx] : [0]).map((cx) => ({ F: fields.top, pq: (u, v) => [cx + (0.5 - u) * spot.w, spot.cz + (v - 0.5) * h] }));
  for (const { F, pq } of copies) {
    const base = pos.length / 3; let last = null;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const u = i / NU, v = j / NV, [p, q] = pq(u, v), r = F.hit(p, q) || last;
      if (r) last = r;
      const P = r ? F.proj.inv(p, q, r.depth) : F.proj.inv(p, q, 0), n = r ? r.n : F.proj.axis;
      pos.push(P[0] + n[0] * lift, P[1] + n[1] * lift, P[2] + n[2] * lift); nrm.push(...n);
      uv.push((col + u) / cols, (row + 1 - v) / rows);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = base + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
  }
  const A = (arr, t) => doc.createAccessor().setArray(arr).setType(t).setBuffer(buf);
  const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', A(new Float32Array(pos), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(nrm), 'VEC3'))
    .setAttribute('TEXCOORD_0', A(new Float32Array(uv), 'VEC2')).setIndices(A(pos.length / 3 < 65535 ? new Uint16Array(idx) : new Uint32Array(idx), 'SCALAR'));
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

// ── 1. sitio y tinta de cada nave
const scene = root.listScenes()[0];
const jobs = [];
for (const d of fleet) {
  if (only && !only.includes(d.node)) continue;
  const R = scene.listChildren().find((n) => n.getName() === d.node); if (!R) { console.log('falta', d.node); continue; }
  const o = { ...(OVERRIDE[d.node] || {}), ...(SAVED?.[d.node] || {}) };
  // sin placa: la nave conserva su rótulo original (calcomanía propia o nombre pintado en la textura)
  if (SKIP.has(d.node) || o.skip) { console.log(d.node.padEnd(12), 'rótulo original'); continue; }
  for (const c of [...R.listChildren()]) if (c.getName() === `${d.node}_name`) c.dispose();
  const tris = gather(R);
  const fields = { top: makeField(tris, PROJ.top), side: {} };
  for (const t of TILTS) fields.side[t] = { right: makeField(tris, sideProj(1, t)), left: makeField(tris, sideProj(-1, t)) };
  let spot;
  if (o.cz !== undefined) {
    spot = { face: o.face || 'side', tilt: o.tilt || 0, cz: o.cz, cy: o.cy, cx: o.cx || 0, w: o.w };
    if (spot.face === 'side' && !fields.side[spot.tilt]) fields.side[spot.tilt] = { right: makeField(tris, sideProj(1, spot.tilt)), left: makeField(tris, sideProj(-1, spot.tilt)) };
    spot.S = spot.face === 'side' ? (fits(fields.side[spot.tilt].right, spot.cz, spot.cy, spot.w, 0) || []) : (fits(fields.top, spot.cx, spot.cz, spot.w, 0) || []);
  } else {
    // costado si es razonable (es lo que se ve en el hangar y en las intros); la cubierta solo si el costado no da
    // de cada inclinación, la placa más larga; una inclinación mayor tiene que ganar al menos un 12 % de largo
    let side = null;
    if (o.face !== 'top') for (const t of o.tilts || TILTS) {
      if (!fields.side[t]) fields.side[t] = { right: makeField(tris, sideProj(1, t)), left: makeField(tris, sideProj(-1, t)) }; const c = placeSide(R, fields.side[t].right, fields.side[t].left, o, t); if (c && (!side || c.w > side.w * 1.12)) side = c; }
    const top = o.face === 'side' ? null : placeTop(fields.top, o);
    spot = side && (!top || side.w >= 0.9 || side.w >= 0.6 * top.w) ? side : top || side;
  }
  if (!spot) { console.log(d.node, 'SIN SITIO'); continue; }
  const auto = await inkFor(spot.S);
  const ink = o.ink || auto.ink;
  jobs.push({ d, R, fields, spot, ink });
  console.log(d.node.padEnd(12), (spot.face + (spot.face === 'side' ? ' ' + spot.tilt + '°' : '')).padEnd(8), `z ${spot.cz.toFixed(2)} ${spot.face === 'side' ? 'y ' + spot.cy.toFixed(2) : 'x ' + spot.cx.toFixed(2)} largo ${spot.w.toFixed(2)} m`, `tinta ${ink} (lum ${auto.lum.toFixed(2)})`);
}

if (process.env.SAVE) fs.writeFileSync(process.env.SAVE, JSON.stringify(Object.fromEntries(jobs.map((j) => [j.d.node, { face: j.spot.face, tilt: j.spot.tilt || 0, cz: +j.spot.cz.toFixed(3), cy: j.spot.cy === undefined ? undefined : +j.spot.cy.toFixed(3), cx: j.spot.cx || 0, w: +j.spot.w.toFixed(3) }])), null, 1));

// ── 2. atlas común y material único
const list = jobs.map((j) => ({ ...j.d, ink: j.ink }));
const { svg, cols, rows } = atlasSVG(list);
let png = await sharp(Buffer.from(svg)).png().toBuffer();
if (LITE) png = await sharp(png).resize({ width: cols * TILE_W / 2 }).png().toBuffer();
png = await sharp(png).png({ compressionLevel: 9 }).toBuffer();
if (process.env.PREVIEW) fs.writeFileSync(`${process.env.PREVIEW}/atlas${LITE ? '_lite' : ''}.png`, png);
for (const t of root.listTextures()) if (t.getName() === 'FLEET_name_atlas') t.dispose();
for (const m of root.listMaterials()) if (m.getName() === 'FLEET | Name livery') m.dispose();
const tex = doc.createTexture('FLEET_name_atlas').setImage(new Uint8Array(png)).setMimeType('image/png');
const mat = doc.createMaterial('FLEET | Name livery').setBaseColorTexture(tex).setAlphaMode('BLEND').setMetallicFactor(0).setRoughnessFactor(0.62).setDoubleSided(true);

// ── 3. placas
jobs.forEach((j, i) => { j.R.addChild(decalMesh(j.spot, j.fields, i, cols, rows, mat, `${j.d.node}_name`)); });

// limpieza de texturas y materiales huérfanos de las placas anteriores
for (const m of root.listMaterials()) if (/_Name$/.test(m.getName()) && !m.listParents().some((p) => p.propertyType === 'Primitive')) m.dispose();
for (const t of root.listTextures()) if (/_name$/.test(t.getName()) && !t.listParents().some((p) => p.propertyType === 'Material')) t.dispose();
await io.write(process.env.OUT, doc);
console.log('atlas', cols * TILE_W / (LITE ? 2 : 1), 'x', rows * TILE_H / (LITE ? 2 : 1), '·', (png.length / 1024).toFixed(0), 'KB');
