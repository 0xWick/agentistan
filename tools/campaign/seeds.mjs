// Reads the campaigns (web/campaign/c/*.js) and prints their map seeds as JSON for tools/campaign/build.py. Also
// writes web/campaign/catalog.js, which joins every campaign to its map's graph, in the order of history.
//   node tools/campaign/seeds.mjs [id ...] | python tools/campaign/build.py
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'web', 'campaign', 'c');
const only = new Set(process.argv.slice(2));
const all = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const C = (await import(pathToFileURL(join(dir, f)).href)).default;
  if (!C?.id || `${C.id}.js` !== f) throw new Error(`${f}: its id must match the file name`);
  all.push(C);
}
all.sort((a, b) => a.n - b.n);
const ids = new Set();
for (const C of all) {
  for (const [id] of C.provinces) { if (ids.has(`${C.id}:${id}`)) throw new Error(`${C.id}: province ${id} twice`); ids.add(`${C.id}:${id}`); }
  const known = new Set(C.provinces.map((p) => p[0]));
  for (const [a, b] of [...(C.sea ?? []), ...(C.straits ?? []), ...(C.cut ?? [])]) if (!known.has(a) || !known.has(b)) throw new Error(`${C.id}: ${a}-${b} names an unknown province`);
  for (const a of C.armies) if (!known.has(a[1])) throw new Error(`${C.id}: an army stands in unknown ${a[1]}`);
}

// The catalog, in the order of history; a campaign whose map is not built yet waits outside it.
const built = all.filter((C) => existsSync(join(root, 'web', 'campaign', 'maps', `${C.id}.graph.json`)) || only.has(C.id));
const name = (id) => id.replace(/[^a-z0-9]/gi, '_');
writeFileSync(join(root, 'web', 'campaign', 'catalog.js'), `// Every campaign, in the order of history, joined to its map's graph. Written by tools/campaign/seeds.mjs.
import { prepare } from './engine.js';
${built.map((C) => `import ${name(C.id)} from './c/${C.id}.js';\nimport ${name(C.id)}_map from './maps/${C.id}.graph.json' with { type: 'json' };`).join('\n')}

export const CAMPAIGNS = [${built.map((C) => `prepare(${name(C.id)}, ${name(C.id)}_map)`).join(', ')}];
export const CAMPAIGN = Object.fromEntries(CAMPAIGNS.map((C) => [C.id, C]));
`);

const out = all.filter((C) => !only.size || only.has(C.id)).map((C) => ({
  id: C.id, view: C.view, reach: C.reach ?? null, sea: C.sea ?? [], straits: C.straits ?? [], cut: C.cut ?? [],
  provinces: C.provinces.map(([id, , lat, lon, , , , extra = {}]) => ({ id, lat, lon, terrain: extra.terrain ?? null, reach: extra.reach ?? null })),
}));
process.stdout.write(JSON.stringify(out));
