// SELENE · torres de la estación lunar
// Agujas habitadas sobre el mar basáltico: fustes negros y afilados, tambores escalonados con nervios verticales,
// platillos de atraque, remates en aguja y miles de ventanucos encendidos (blanco cálido, cian y rosa).
// Se reparten en racimos a ambos lados del trazado, sin tocar la pista ni las piezas del GLB.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { QUALITY } from './quality.js';

const h2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// metal oscuro con ventanas: rejilla en las caras verticales, celdas encendidas al azar (fijo por celda)
function towerMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x101219, roughness: 0.62, metalness: 0.45, envMapIntensity: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vTN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vTW; varying vec3 vTN;
      float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 n = normalize(vTN);
        float side = 1.0 - smoothstep(0.35, 0.6, abs(n.y));
        // coordenada horizontal a lo largo de la fachada (sirve para fustes redondos y caras planas)
        float u = dot(vTW.xz, normalize(vec2(-n.z, n.x) + 1e-4));
        vec2 cell = vec2(u / 2.4, vTW.y / 3.6);
        vec2 id = floor(cell), f = fract(cell);
        float lit = step(0.6, th(id + floor(vTW.xz / 60.0)));
        float win = step(0.18, f.x) * step(f.x, 0.72) * step(0.25, f.y) * step(f.y, 0.7);
        float aa = clamp(1.4 - length(fwidth(cell)) * 1.2, 0.0, 1.0);
        float pick = th(id * 1.7 + 3.0);
        vec3 wc = pick < 0.62 ? vec3(1.0, 0.82, 0.6) : pick < 0.84 ? vec3(0.45, 0.95, 1.0) : vec3(1.0, 0.55, 0.85);
        float far = 1.0 - aa;                       // de lejos: un brillo medio en lugar de la rejilla (sin parpadeo)
        totalEmissiveRadiance += wc * side * (lit * win * aa * 3.2 + far * 0.3 * 0.22);
      }`);
  };
  m.customProgramCacheKey = () => 'seleneTower';
  return m;
}

export function buildSelene(world, track, own, avoid = []) {
  const lite = QUALITY.lite;
  const SEG = lite ? 10 : 16;
  const T = towerMaterial(), dark = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.55, metalness: 0.6, envMapIntensity: 0.5 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x06201f, emissive: 0x39d6c8, emissiveIntensity: 2.2 });
  const rose = new THREE.MeshStandardMaterial({ color: 0x24101c, emissive: 0xe07ab4, emissiveIntensity: 2.0 });
  const warm = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, emissive: 0xffc27a, emissiveIntensity: 2.4 });
  own.push(T, dark, teal, rose, warm);
  const L = { T: [], dark: [], teal: [], rose: [], warm: [] };
  const cyl = (list, x, y0, y1, z, r0, r1, seg = SEG) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1); g.translate(x, (y0 + y1) / 2, z); list.push(g); };
  const box = (list, x, y, z, w, h, d, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); list.push(g); };

  // muestras del trazado para mantener las torres lejos de la pista
  const pts = [];
  const tmp = track.frame();
  for (let s = 0; s < track.length; s += 20) { track.sample(s, tmp); pts.push({ x: tmp.pos.x, y: tmp.pos.y, z: tmp.pos.z, rx: tmp.right.x, rz: tmp.right.z }); }
  const clearOf = (x, z, r) => {
    for (const p of pts) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return false;
    for (const b of avoid) if (x > b.min.x - 25 && x < b.max.x + 25 && z > b.min.z - 25 && z < b.max.z + 25) return false;
    return true;
  };
  let ymin = Infinity; for (const p of pts) ymin = Math.min(ymin, p.y);
  const BASE = ymin - 220;                       // los fustes nacen bajo el mar basáltico

  // una torre: fuste + tambores escalonados con nervios + platillos + aguja
  const tower = (x, z, H, R, seed) => {
    const tiers = 3 + Math.floor(h2(seed, 1) * 4);
    let y = BASE, r = R;
    cyl(L.T, x, BASE, BASE + H * 0.22 + 220, z, R * 1.25, R * 1.05);             // zócalo ancho
    y = BASE + H * 0.22 + 220;
    for (let k = 0; k < tiers; k++) {
      const th = (H * 0.78 - 40) / tiers * (0.75 + 0.5 * h2(seed, k + 3)), rt = r * (0.92 - 0.12 * h2(seed, k + 9));
      cyl(L.T, x, y, y + th, z, r, rt);
      // nervios verticales (contrafuertes) alrededor del tambor
      const nr = 6 + Math.floor(h2(seed, k) * 5);
      for (let j = 0; j < nr; j++) { const a = (j / nr) * Math.PI * 2 + h2(seed, k + 20), rr = (r + rt) / 2;
        box(L.dark, x + Math.cos(a) * rr, y + th * 0.5, z + Math.sin(a) * rr, 1.6, th * 0.92, r * 0.28, -a); }
      // platillo de atraque y anillo de luz al final del tambor
      if (h2(seed, k + 40) > 0.35) { const pr = rt * (1.7 + 0.9 * h2(seed, k + 41));
        cyl(L.dark, x, y + th - 1.2, y + th + 0.6, z, pr, pr * 0.96, SEG + 4);
        cyl(h2(seed, k + 42) > 0.55 ? L.teal : L.rose, x, y + th + 0.6, y + th + 1.1, z, pr * 0.97, pr * 0.95, SEG + 4); }
      else cyl(L.warm, x, y + th - 0.6, y + th, z, rt * 1.02, rt * 1.02);
      y += th; r = rt * (0.86 - 0.1 * h2(seed, k + 60));
    }
    // aguja y luz de balizamiento
    const sp = 30 + 70 * h2(seed, 70);
    cyl(L.dark, x, y, y + sp, z, Math.max(1.2, r * 0.45), 0.25, 8);
    box(L.rose, x, y + sp + 1, z, 1.6, 1.6, 1.6);
    // torres satélite adosadas (agujas finas pegadas al fuste)
    const ns = Math.floor(h2(seed, 80) * 3);
    for (let j = 0; j < ns; j++) { const a = h2(seed, 81 + j) * Math.PI * 2, d = R * (1.35 + 0.3 * h2(seed, 90 + j)), hs = H * (0.35 + 0.35 * h2(seed, 95 + j));
      cyl(L.T, x + Math.cos(a) * d, BASE, BASE + 220 + hs, z + Math.sin(a) * d, R * 0.38, R * 0.22);
      cyl(L.dark, x + Math.cos(a) * d, BASE + 220 + hs, BASE + 260 + hs, z + Math.sin(a) * d, R * 0.2, 0.2, 8); }
    // pasarela al vecino más cercano (se añade fuera)
    return { x, z, top: BASE + 220 + H };
  };

  // racimos repartidos a lo largo de la vuelta, alternando lados
  const towers = [];
  const NC = lite ? 7 : 10, PER = lite ? 4 : 6;
  for (let c = 0; c < NC; c++) {
    const p = pts[Math.floor((c + 0.5) / NC * pts.length)];
    const side = c % 2 ? 1 : -1, off = 260 + 380 * h2(c, 5);
    const cx = p.x + p.rx * side * off, cz = p.z + p.rz * side * off;
    for (let k = 0, tries = 0; k < PER && tries < 40; tries++) {
      const a = h2(c, tries + 10) * Math.PI * 2, d = 40 + 170 * h2(c, tries + 30);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!clearOf(x, z, 120) || towers.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 70 * 70)) continue;
      const big = k === 0 && c % 3 === 0;
      const H = big ? 520 + 260 * h2(c, 7) : 160 + 300 * h2(c, tries + 50);
      const R = big ? 26 + 8 * h2(c, 8) : 10 + 10 * h2(c, tries + 60);
      towers.push(tower(x, z, H, R, c * 31 + tries)); k++;
    }
  }
  // pasarelas iluminadas entre torres vecinas del mismo racimo
  for (let i = 0; i < towers.length; i++) for (let j = i + 1; j < towers.length; j++) {
    const a = towers[i], b = towers[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d > 190 || h2(i, j) < 0.45) continue;
    const y = Math.min(a.top, b.top) * 0.55 + BASE * 0.45 + 40 * h2(j, i), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, ang = Math.atan2(b.z - a.z, b.x - a.x);
    box(L.dark, mx, y, mz, d, 3, 5, -ang);
    box(h2(i, j + 5) > 0.5 ? L.teal : L.warm, mx, y - 1.7, mz, d, 0.4, 0.6, -ang);
  }
  for (const [k, list] of Object.entries(L)) {
    if (!list.length) continue;
    const gg = mergeGeometries(list.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }), false);
    list.forEach((g) => g.dispose());
    const mat = { T, dark, teal, rose, warm }[k];
    const mesh = new THREE.Mesh(gg, mat); mesh.castShadow = !lite && (k === 'T' || k === 'dark'); mesh.receiveShadow = true;
    world.add(mesh); own.push(gg);
  }
  console.info(`[SRS] SELENE: ${towers.length} torres`);
  return towers;
}
