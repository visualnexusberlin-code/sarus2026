// Cabinas con piloto estándar NEXUS para naves Meshy: separa el cristal pintado (elipsoide + color),
// crea un cristal oscuro con suciedad en el borde (_RIM), una cubeta interior y coloca al piloto.
import { NodeIO, getBounds } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.env.IN);
const root = doc.getRoot(), sc = root.listScenes()[0], buf = root.listBuffers()[0];
const CFG = JSON.parse(process.env.CFG);
const nx = sc.listChildren().find(n => n.getName() === 'NEXUS_8');
const ck = nx.listChildren().find(c => c.getName() === 'NEXUS_8_cockpit');
const pilotSrc = ck.listChildren().filter(c => /^PILOT/.test(c.getName()));
const glassSrc = root.listMaterials().find(m => /transparent smoked cockpit/.test(m.getName()));
// límites del piloto en coordenadas del grupo de cabina (sin la transformación del grupo)
const ckM = ck.getMatrix(); const inv = (m) => { /* sólo T y S uniformes */ return m; };
let pmin = [1e9,1e9,1e9], pmax = [-1e9,-1e9,-1e9];
for (const p of pilotSrc) { const b = getBounds(p); for (let i=0;i<3;i++){ pmin[i]=Math.min(pmin[i],b.min[i]); pmax[i]=Math.max(pmax[i],b.max[i]); } }
// getBounds da mundo (NEXUS_8 identidad) → incluye la transformación del grupo ck (T, S 1.4)
const ckT = ck.getTranslation(), ckS = ck.getScale()[0];
const acc = (a) => a.getArray();
async function texPixels(tex) { const img = sharp(Buffer.from(tex.getImage())); const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }
for (const C of CFG) {
  const ship = sc.listChildren().find(n => n.getName() === C.node);
  // limpieza (BERLIN: piloto, casco, cubeta y cristal antiguos)
  for (const c of [...ship.listChildren()]) if ((C.drop || []).some(r => new RegExp(r).test(c.getName()))) c.dispose();
  const hullN = ship.listChildren().find(c => c.getName().endsWith('_hull'));
  const mesh = hullN.getMesh();
  for (const p of [...mesh.listPrimitives()]) if ((C.dropMat || []).some(r => new RegExp(r).test(p.getMaterial()?.getName()))) mesh.removePrimitive(p);
  const gsrc = C.glassMat ? mesh.listPrimitives().find(p => new RegExp(C.glassMat).test(p.getMaterial().getName())) : null;
  const prim = gsrc || mesh.listPrimitives().find(p => /Meshy/.test(p.getMaterial().getName()));
  if (gsrc && !gsrc.getMaterial().getBaseColorTexture()) gsrc.getMaterial().setBaseColorTexture(mesh.listPrimitives().find(p => /Meshy/.test(p.getMaterial().getName())).getMaterial().getBaseColorTexture());
  const mat = prim.getMaterial(); const px = await texPixels(mat.getBaseColorTexture());
  const pos = acc(prim.getAttribute('POSITION')), uv = prim.getAttribute('TEXCOORD_0') ? acc(prim.getAttribute('TEXCOORD_0')) : new Float32Array(prim.getAttribute('POSITION').getCount()*2), idx = acc(prim.getIndices());
  const [cx,cy,cz,rx,ry,rz] = C.ell;
  const col = (u, v) => { const x = Math.min(px.w-1, Math.max(0, Math.floor(((u%1)+1)%1 * px.w))), y = Math.min(px.h-1, Math.max(0, Math.floor(((v%1)+1)%1 * px.h))); const o = (y*px.w+x)*4; return [px.data[o], px.data[o+1], px.data[o+2]]; };
  const T = idx.length / 3, cen = new Float32Array(T*3), tcol = [], tny = new Float32Array(T), inE = new Uint8Array(T);
  for (let t = 0; t < T; t++) {
    const a = idx[t*3], b = idx[t*3+1], c = idx[t*3+2];
    for (let k = 0; k < 3; k++) cen[t*3+k] = (pos[a*3+k]+pos[b*3+k]+pos[c*3+k])/3;
    const ux=pos[b*3]-pos[a*3],uy=pos[b*3+1]-pos[a*3+1],uz=pos[b*3+2]-pos[a*3+2],vx=pos[c*3]-pos[a*3],vy=pos[c*3+1]-pos[a*3+1],vz=pos[c*3+2]-pos[a*3+2];
    const nX=uy*vz-uz*vy,nY=uz*vx-ux*vz,nZ=ux*vy-uy*vx; tny[t]=nY/(Math.hypot(nX,nY,nZ)||1);
    const e = ((cen[t*3]-cx)/rx)**2 + ((cen[t*3+1]-cy)/ry)**2 + ((cen[t*3+2]-cz)/rz)**2;
    inE[t] = e < 1 && cen[t*3+1] > cy - (C.below ?? 0.3) * ry && tny[t] > (C.minNy ?? -0.3) ? 1 : 0;
    tcol.push(col((uv[a*2]+uv[b*2]+uv[c*2])/3, (uv[a*2+1]+uv[b*2+1]+uv[c*2+1])/3));
  }
  // color de referencia: mediana de los triángulos más altos cerca del centro
  const top = []; for (let t = 0; t < T; t++) if (inE[t] && Math.abs(cen[t*3]-cx) < rx*0.3 && Math.abs(cen[t*3+2]-cz) < rz*0.4) top.push(t);
  top.sort((p, q) => cen[q*3+1] - cen[p*3+1]); const ref = [0,1,2].map(k => { const v = top.slice(0, 40).map(t => tcol[t][k]).sort((a,b)=>a-b); return v[v.length>>1]; });
  const ref2 = C.ref || ref;
  const sel = new Uint8Array(T); let n = 0;
  if (gsrc) { sel.fill(1); n = T; inE.fill(1); }
  else
  for (let t = 0; t < T; t++) if (inE[t]) {
    const c3 = tcol[t]; let ok;
    if (C.mode === 'sat') { const mx = Math.max(...c3)/255, mn = Math.min(...c3)/255; ok = mx - mn < C.satTol && (0.2126*c3[0]+0.7152*c3[1]+0.0722*c3[2])/255 > C.lumMin; }
    else ok = Math.hypot(c3[0]-ref2[0], c3[1]-ref2[1], c3[2]-ref2[2]) < (C.tol ?? 70);
    if (ok) { sel[t] = 1; n++; } }
  // cierre: rellena huecos (triángulo no elegido rodeado de elegidos) y quita islas sueltas
  const vt = new Map(); for (let t=0;t<T;t++) for (let k=0;k<3;k++){ const kk = pos[idx[t*3+k]*3].toFixed(4)+','+pos[idx[t*3+k]*3+1].toFixed(4)+','+pos[idx[t*3+k]*3+2].toFixed(4); if(!vt.has(kk)) vt.set(kk,[]); vt.get(kk).push(t); }
  const vkey = (i) => pos[i*3].toFixed(4)+','+pos[i*3+1].toFixed(4)+','+pos[i*3+2].toFixed(4);
  const neigh = (t) => { const s = new Set(); for (let k=0;k<3;k++) for (const o of vt.get(vkey(idx[t*3+k]))) if (o!==t) s.add(o); return s; };
  for (let pass = 0; pass < (C.close ?? 2); pass++) { const add = []; for (let t=0;t<T;t++) if (!sel[t] && inE[t]) { const ns=[...neigh(t)]; if (ns.filter(o=>sel[o]).length / ns.length > 0.6) add.push(t); } add.forEach(t=>{sel[t]=1;n++;}); }
  // componente conexa mayor
  const comp = new Int32Array(T).fill(-1); let best = -1, bestN = 0, ci = 0;
  for (let t=0;t<T;t++) if (sel[t] && comp[t]<0) { const st=[t]; comp[t]=ci; let cnt=0; while(st.length){ const u=st.pop(); cnt++; for (const o of neigh(u)) if (sel[o] && comp[o]<0){ comp[o]=ci; st.push(o);} } if (cnt>bestN){bestN=cnt;best=ci;} ci++; }
  if (!gsrc) for (let t=0;t<T;t++) if (sel[t] && comp[t]!==best) sel[t]=0;
  // cristal: modo máscara → todos los triángulos del elipsoide (el shader separa cristal y casco por el color
  // de la textura, píxel a píxel); BERLIN → su cristal ya separado
  const inV = (i) => { const q = [(pos[i*3]-cx)/rx, (pos[i*3+1]-cy)/ry, (pos[i*3+2]-cz)/rz]; return q[0]*q[0]+q[1]*q[1]+q[2]*q[2] < 1.02 && q[1] > -(C.below ?? 0.3) - 0.02; };
  const glassTris = []; for (let t=0;t<T;t++) if (gsrc ? 1 : (inV(idx[t*3]) || inV(idx[t*3+1]) || inV(idx[t*3+2]))) glassTris.push(t);
  if (gsrc) mesh.removePrimitive(gsrc);
  const gIdx = [], map = new Map(), gp = [], gn = [], guv = [];
  const nrm = acc(prim.getAttribute('NORMAL'));
  for (const t of glassTris) for (let k=0;k<3;k++) { const i = idx[t*3+k]; if (!map.has(i)) { map.set(i, gp.length/3); gp.push(pos[i*3],pos[i*3+1],pos[i*3+2]); gn.push(nrm[i*3],nrm[i*3+1],nrm[i*3+2]); guv.push(uv[i*2],uv[i*2+1]); } gIdx.push(map.get(i)); }
  const NV = gp.length/3, rim = new Float32Array(NV);
  // suciedad: cerca de lo que NO es cristal (casco pintado alrededor)
  const bpts = [];
  if (gsrc) { const gkey = (j) => gp[j*3].toFixed(4)+','+gp[j*3+1].toFixed(4)+','+gp[j*3+2].toFixed(4); const ek = new Map();
    for (let t = 0; t < gIdx.length; t += 3) for (const [a,b] of [[0,1],[1,2],[2,0]]) { const ka=gkey(gIdx[t+a]), kb=gkey(gIdx[t+b]); const k = ka<kb?ka+'|'+kb:kb+'|'+ka; ek.set(k,(ek.get(k)||0)+1); }
    for (const [k,c] of ek) if (c===1) for (const s2 of k.split('|')) bpts.push(s2.split(',').map(Number)); }
  else for (let t=0;t<T;t++) { if (sel[t]) continue; const e = ((cen[t*3]-cx)/rx)**2 + ((cen[t*3+1]-cy)/ry)**2 + ((cen[t*3+2]-cz)/rz)**2; if (e < 1.6 && cen[t*3+1] > cy - 0.6*ry) bpts.push([cen[t*3],cen[t*3+1],cen[t*3+2]]); }
  for (let j=0;j<NV;j++){ let d=1e9; for (const b of bpts) d=Math.min(d,Math.hypot(gp[j*3]-b[0],gp[j*3+1]-b[1],gp[j*3+2]-b[2])); rim[j] = Math.max(0, 1 - d / (C.rimW ?? 0.22)); }
  // extensión del cristal visible (triángulos que casan con el color)
  let gmin=[1e9,1e9,1e9], gmax=[-1e9,-1e9,-1e9];
  for (let t=0;t<T;t++) if (sel[t]) for (let k=0;k<3;k++){ const i = idx[t*3+k]; for (let a=0;a<3;a++){ gmin[a]=Math.min(gmin[a],pos[i*3+a]); gmax[a]=Math.max(gmax[a],pos[i*3+a]); } }
  const maskCfg = gsrc ? null : { ell: C.ell, below: C.below ?? 0.3, ref: ref2, tol: C.tol ?? 70, mode: C.mode || 'ref', satTol: C.satTol ?? 0, lumMin: C.lumMin ?? 0 };
  if (maskCfg) mat.setExtras({ ...(mat.getExtras() || {}), canopyCut: maskCfg });
  const A = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
  const glass = glassSrc.clone().setName(C.name + '_Canopy');
  if (C.tint) glass.setBaseColorFactor(C.tint);
  glass.setExtras({ canopyGlass: maskCfg || { none: true } });
  if (maskCfg) glass.setBaseColorTexture(mat.getBaseColorTexture());
  const gprim = doc.createPrimitive().setMaterial(glass)
    .setAttribute('POSITION', A(new Float32Array(gp), 'VEC3')).setAttribute('NORMAL', A(new Float32Array(gn), 'VEC3')).setAttribute('TEXCOORD_0', A(new Float32Array(guv), 'VEC2'))
    .setAttribute('_RIM', A(rim, 'SCALAR')).setIndices(A(new Uint32Array(gIdx), 'SCALAR'));
  ship.addChild(doc.createNode(C.node + '_canopy').setMesh(doc.createMesh(C.node + '_canopy').addPrimitive(gprim)));
  // cubeta: media elipsoide hueca bajo el cristal (tapa la malla interior)
  const tub = C.tub || {};
  const tcx=(gmin[0]+gmax[0])/2, tcz=(gmin[2]+gmax[2])/2, trx=(gmax[0]-gmin[0])/2*(tub.sx??0.92), trz=(gmax[2]-gmin[2])/2*(tub.sz??0.92), ty=gmin[1]+(tub.dy??0.02), tdep=tub.depth??0.45;
  const tp=[], ti=[]; const SU=28, SV=8;
  for (let i=0;i<=SV;i++){ const ph=(i/SV)*Math.PI/2; for (let j=0;j<=SU;j++){ const th=j/SU*Math.PI*2; tp.push(tcx+Math.cos(th)*Math.cos(ph)*trx, ty-Math.sin(ph)*tdep, tcz+Math.sin(th)*Math.cos(ph)*trz); } }
  for (let i=0;i<SV;i++) for (let j=0;j<SU;j++){ const a=i*(SU+1)+j, b=a+SU+1; ti.push(a,b,a+1, a+1,b,b+1); }
  const tubMat = doc.createMaterial(C.name + '_CockpitTub').setBaseColorFactor([0.035,0.037,0.04,1]).setRoughnessFactor(0.8).setMetallicFactor(0.2).setDoubleSided(true);
  const tprim = doc.createPrimitive().setMaterial(tubMat).setAttribute('POSITION', A(new Float32Array(tp),'VEC3')).setIndices(A(new Uint32Array(ti),'SCALAR'));
  // normales hacia dentro aprox.
  const tn = []; for (let k=0;k<tp.length;k+=3){ const x=(tp[k]-tcx)/trx, y=(tp[k+1]-ty)/tdep, z=(tp[k+2]-tcz)/trz; const l=Math.hypot(x,y,z)||1; tn.push(-x/l,-y/l,-z/l); }
  tprim.setAttribute('NORMAL', A(new Float32Array(tn),'VEC3'));
  ship.addChild(doc.createNode(C.node + '_tub').setMesh(doc.createMesh(C.node+'_tub').addPrimitive(tprim)));
  // piloto: escala uniforme; casco a 'head' bajo el techo del cristal, centrado en x, en z según 'pz' (0 = trasera, 1 = morro)
  const ph = pmax[1]-pmin[1];
  const k = C.pilotScale ?? Math.min(1.25, ((gmax[1] - ty + tdep*0.35) * 0.95) / ph);
  const headTop = gmax[1] - (C.head ?? 0.06);
  const pzc = gmin[2] + (gmax[2]-gmin[2]) * (C.pz ?? 0.42);
  const pcz = (pmin[2]+pmax[2])/2;
  const rig = doc.createNode(C.node + '_pilot');
  // rig: lleva puntos del espacio NEXUS-mundo al espacio de la nave
  rig.setScale([k,k,k]).setTranslation([tcx - 0*k, headTop - pmax[1]*k, pzc - pcz*k]);
  for (const p of pilotSrc) {
    const q = doc.createNode(p.getName()).setMesh(p.getMesh());
    // p está bajo ck: mundo = ckT + ckS * (pT + pLocal)
    const t = p.getTranslation(); q.setTranslation([ckT[0] + ckS*t[0], ckT[1] + ckS*t[1], ckT[2] + ckS*t[2]]).setScale([ckS,ckS,ckS]).setRotation(p.getRotation());
    rig.addChild(q);
  }
  ship.addChild(rig);
  console.log(C.node, 'ref', ref, 'glass tris', glassTris.length, 'of', T, 'bbox', gmin.map(v=>v.toFixed(2)), gmax.map(v=>v.toFixed(2)), 'pilot k', k.toFixed(2), 'pilot h', (ph*k).toFixed(2));
}
// LUDOX: piloto más bajo
for (const L of (JSON.parse(process.env.LOWER || '[]'))) {
  const ship = sc.listChildren().find(n => n.getName() === L.node);
  ship.traverse(n => { const m = n.getMesh(); if (!m) return; for (const p of m.listPrimitives()) if (/^PILOT|pilot suit/.test(p.getMaterial()?.getName())) {
    const a = p.getAttribute('POSITION'); const arr = a.getArray().slice(); for (let i = 1; i < arr.length; i += 3) arr[i] -= L.dy; for (let i = 2; i < arr.length; i += 3) arr[i] += (L.dz || 0); a.setArray(arr); } });
}
await io.write(process.env.OUT, doc);
