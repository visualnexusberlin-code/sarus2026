import { THREE, build } from './env.mjs';
for (const id of ['olympus','itaka','tharsis','phobos','europa','miranda','tiphares','cassini']) { globalThis.__RESHAPE={[id]:[]}; const r = await build(id); console.log(id, 'gaps', JSON.stringify(r.track.gaps||[]), 'tunnel', JSON.stringify(r.tunnel||null), 'bridges', JSON.stringify((r.bridges||[]).map?.(b=>b.s??b)||r.bridges)); }
