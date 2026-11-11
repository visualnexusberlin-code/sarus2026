// Troceado del mundo para que el descarte por cámara (frustum culling) sirva de algo.
// Los circuitos fusionan la geometría estática por material (pocas draw calls), pero una malla que abarca
// los 8–10 km del circuito siempre «está en cuadro»: se envían a la GPU todos sus triángulos en cada fotograma,
// también los que quedan detrás de la cámara. Aquí cada malla grande se reparte en celdas de planta cuadrada;
// las celdas cuelgan de la malla original (que se queda vacía y sigue sirviendo para ocultar, mover o cambiar
// el material compartido), y three.js descarta por sí solo las que no se ven.
import * as THREE from 'three';

const baseBefore = THREE.Object3D.prototype.onBeforeRender, baseAfter = THREE.Object3D.prototype.onAfterRender;

function eligible(o, minTris) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh) return false;
  if ((!o.frustumCulled && !o.userData.chunkAnyway) || o.userData.noChunk || o.userData.chunk || o.children.length) return false;
  if (o.onBeforeRender !== baseBefore || o.onAfterRender !== baseAfter) return false;
  const m = o.material, g = o.geometry;
  if (!m || Array.isArray(m) || m.transparent) return false;          // transparentes: el orden de pintado depende de la malla entera
  if (!g || !g.index || !g.attributes.position || g.groups.length > 1) return false;
  if (Object.keys(g.morphAttributes).length) return false;
  for (const k in g.attributes) if (g.attributes[k].isInterleavedBufferAttribute || g.attributes[k].isInstancedBufferAttribute) return false;
  const dr = g.drawRange;
  if (dr.start !== 0 || dr.count < g.index.count) return false;
  return g.index.count / 3 >= minTris;
}

// Devuelve { meshes, chunks } (cuántas mallas se han troceado y en cuántas celdas).
export function chunkWorld(world, { cell: cellMin = 420, minTris = 9000, minCell = 900, perCell = 3500, maxCells = 144, margin = 12 } = {}) {
  const list = [];
  world.traverse((o) => { if (eligible(o, minTris)) list.push(o); });
  let chunks = 0, meshes = 0;
  for (const mesh of list) {
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index.array, nT = idx.length / 3;
    g.computeBoundingBox();
    const bb = g.boundingBox, sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
    if (Math.max(sx, sz) < cellMin * 1.6) continue;                    // ya es pequeña: una sola celda
    // tamaño de celda según la malla: ~perCell triángulos por celda, nunca menos de cellMin metros ni más de maxCells celdas
    const want = Math.min(maxCells, Math.max(2, nT / perCell));
    const cell = Math.max(cellMin, Math.sqrt(Math.max(sx, 1) * Math.max(sz, 1) / want), Math.max(sx, sz) / 24);
    const nx = Math.max(1, Math.ceil(sx / cell)), nz = Math.max(1, Math.ceil(sz / cell));
    const cellOf = new Int32Array(nT), count = new Int32Array(nx * nz);
    for (let t = 0; t < nT; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      const ix = Math.min(nx - 1, Math.max(0, Math.floor((cx - bb.min.x) / cell))), iz = Math.min(nz - 1, Math.max(0, Math.floor((cz - bb.min.z) / cell)));
      const k = cellOf[t] = iz * nx + ix; count[k]++;
    }
    // celdas con muy pocos triángulos se unen a la vecina más poblada (menos draw calls sueltas)
    const remap = new Int32Array(nx * nz);
    for (let k = 0; k < remap.length; k++) remap[k] = k;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const k = iz * nx + ix;
      if (!count[k] || count[k] >= minCell) continue;
      let best = -1, bc = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const j = jz * nx + jx; if (count[j] > bc) { bc = count[j]; best = j; }
      }
      if (best >= 0 && bc >= minCell) remap[k] = best;
    }
    const tris = new Map();
    for (let t = 0; t < nT; t++) { const k = remap[cellOf[t]]; let a = tris.get(k); if (!a) tris.set(k, a = []); a.push(t); }
    if (tris.size < 2) continue;
    const names = Object.keys(g.attributes), vmap = new Int32Array(pos.count);
    for (const list of tris.values()) {
      vmap.fill(-1);
      const order = [], ni = new Uint32Array(list.length * 3);
      for (let i = 0; i < list.length; i++) for (let j = 0; j < 3; j++) {
        const v = idx[list[i] * 3 + j];
        if (vmap[v] < 0) { vmap[v] = order.length; order.push(v); }
        ni[i * 3 + j] = vmap[v];
      }
      const cg = new THREE.BufferGeometry();
      for (const n of names) {
        const src = g.attributes[n], is = src.itemSize, sa = src.array, da = new sa.constructor(order.length * is);
        for (let i = 0; i < order.length; i++) { const o = order[i] * is; for (let j = 0; j < is; j++) da[i * is + j] = sa[o + j]; }
        cg.setAttribute(n, new THREE.BufferAttribute(da, is, src.normalized));
      }
      cg.setIndex(new THREE.BufferAttribute(order.length > 65535 ? ni : new Uint16Array(ni), 1));
      cg.computeBoundingSphere(); cg.computeBoundingBox(); cg.boundingSphere.radius += margin;   // margen: pequeños desplazamientos en el shader
      const cm = new THREE.Mesh(cg, mesh.material);
      cm.name = mesh.name; cm.userData.chunk = true;
      cm.castShadow = mesh.castShadow; cm.receiveShadow = mesh.receiveShadow; cm.renderOrder = mesh.renderOrder;
      cm.layers.mask = mesh.layers.mask;
      if (mesh.customDepthMaterial) cm.customDepthMaterial = mesh.customDepthMaterial;
      if (mesh.customDistanceMaterial) cm.customDistanceMaterial = mesh.customDistanceMaterial;
      cm.matrixAutoUpdate = false;                                     // identidad: hereda la matriz de la malla original
      mesh.add(cm); chunks++;
    }
    g.dispose();
    mesh.geometry = new THREE.BufferGeometry();                        // la original queda de contenedor (0 triángulos)
    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    mesh.layers.disableAll();                                          // no se pinta ella misma (las capas no se heredan: las celdas sí)
    mesh.userData.chunked = true;
    meshes++;
  }
  // Instancias (campos de rocas, público, arbolado): solo las marcadas como estáticas con userData.chunkInst.
  // Una InstancedMesh se descarta entera o nada; repartida por celdas, las que quedan fuera de cuadro no se envían.
  const inst = [];
  world.traverse((o) => { if (o.isInstancedMesh && o.userData.chunkInst && !o.userData.chunk && o.geometry && !Array.isArray(o.material)) inst.push(o); });
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const im of inst) {
    const g = im.geometry, per = (g.index ? g.index.count : g.attributes.position.count) / 3, n = im.count;
    if (n < 48 || n * per < minTris) continue;
    if (Object.values(g.attributes).some((a) => a.isInstancedBufferAttribute)) continue;
    const arr = im.instanceMatrix.array;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = arr[i * 16 + 12], z = arr[i * 16 + 14]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const sx = x1 - x0, sz = z1 - z0;
    if (Math.max(sx, sz) < cellMin * 1.6) continue;
    const want = Math.min(64, Math.max(2, n * per / perCell));
    const cell = Math.max(cellMin, Math.sqrt(Math.max(sx, 1) * Math.max(sz, 1) / want), Math.max(sx, sz) / 16);
    const nx = Math.max(1, Math.ceil(sx / cell));
    const cells = new Map();
    for (let i = 0; i < n; i++) {
      const k = Math.floor((arr[i * 16 + 14] - z0) / cell) * nx + Math.floor((arr[i * 16 + 12] - x0) / cell);
      let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(i);
    }
    if (cells.size < 2) continue;
    for (const list of cells.values()) {
      const c = new THREE.InstancedMesh(g, im.material, list.length);
      for (let j = 0; j < list.length; j++) { im.getMatrixAt(list[j], m4); c.setMatrixAt(j, m4); if (im.instanceColor) { im.getColorAt(list[j], col); c.setColorAt(j, col); } }
      c.instanceMatrix.needsUpdate = true; if (c.instanceColor) c.instanceColor.needsUpdate = true;
      c.computeBoundingSphere(); c.boundingSphere.radius += margin;
      c.name = im.name; c.userData.chunk = true;
      c.castShadow = im.castShadow; c.receiveShadow = im.receiveShadow; c.renderOrder = im.renderOrder; c.layers.mask = im.layers.mask;
      c.matrixAutoUpdate = false;
      im.add(c); chunks++;
    }
    im.layers.disableAll(); im.userData.chunked = true;
    meshes++;
  }
  return { meshes, chunks };
}

// Último recurso en equipos justos: la mitad de las instancias de decoración (una sí, una no) en las celdas troceadas.
export function thinInstances(world) {
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let cut = 0;
  world.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData.chunk || o.userData.thinned || o.count < 4) return;
    const n = Math.ceil(o.count / 2);
    for (let j = 1; j < n; j++) { o.getMatrixAt(j * 2, m4); o.setMatrixAt(j, m4); if (o.instanceColor) { o.getColorAt(j * 2, col); o.setColorAt(j, col); } }
    cut += o.count - n; o.count = n; o.userData.thinned = true;
    o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true;
  });
  return cut;
}
