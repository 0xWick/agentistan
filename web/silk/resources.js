// What a province is famous for, besides its grain, horses and iron: silver mines, spices, silk, incense, salt, timber;
// in 1914, coal, oil, rubber and cotton. Holding them pays: more gold, more grain, cheaper works, a stronger modern army.
// An age may name its own (pack.resources); the rest follow the lie of the land.
import { PROVINCES, provincesOf } from './core.js';
import { knows } from './economy.js';

export const RESOURCES = {
  silver: { name: 'Silver mines', icon: 'coin', income: 0.05, more: 0.02, text: 'more gold' },
  gold: { name: 'Gold', icon: 'coin', income: 0.06, more: 0.02, text: 'more gold' },
  spices: { name: 'Spices', icon: 'star', income: 0.04, more: 0.015, text: 'rich trade' },
  silk: { name: 'Silk', icon: 'star', income: 0.04, more: 0.015, text: 'rich trade' },
  incense: { name: 'Incense', icon: 'star', income: 0.04, more: 0.015, text: 'rich trade' },
  salt: { name: 'Salt', icon: 'wheat', grain: 0.06, text: 'grain keeps longer' },
  timber: { name: 'Timber', icon: 'hammer', works: 0.15, text: 'cheaper works' },
  coal: { name: 'Coal', icon: 'anvil', income: 0.04, more: 0.02, needs: ['industry'], text: 'factories run (with industry)' },
  oil: { name: 'Oil', icon: 'flame', power: 0.06, needs: ['aircraft', 'tanks'], text: 'engines run (with aircraft or tanks)' },
  rubber: { name: 'Rubber', icon: 'star', income: 0.03, more: 0.01, text: 'rich trade' },
  cotton: { name: 'Cotton', icon: 'star', income: 0.03, more: 0.01, text: 'rich trade' },
};
const OLD = {
  gold: ['koumbi', 'sosso', 'kangaba', 'nobadia', 'zimbabwe', 'sofala', 'mapungubwe'],
  spices: ['kerala', 'lanka', 'kanchi', 'thanjavur', 'madurai', 'palembang', 'kediri', 'kedah', 'champa'],
  incense: ['hadramawt', 'oman', 'sohar', 'zeila', 'sanaa', 'aden'],
  silk: ['jiankang', 'linan', 'chengdu', 'gilan', 'khotan', 'ezhou', 'tabaristan'],
};
// Every province's resource for an age: the pack's table first, then the land itself.
export function resourcesFor(pack) {
  const given = {};
  for (const [kind, ids] of Object.entries({ ...OLD, ...(pack.resources ?? {}) })) for (const id of ids) given[id] ??= kind;
  for (const [kind, ids] of Object.entries(pack.resources ?? {})) for (const id of ids) given[id] = kind; // the age's own word wins
  const out = {};
  for (const p of PROVINCES) {
    const k = given[p.id] ?? (p.terrain === 'mountains' && p.wealth >= 3 ? 'silver' : p.terrain === 'desert' ? 'salt' : p.terrain === 'forest' ? 'timber' : null);
    if (k) out[p.id] = k;
  }
  return out;
}
export const resourceOf = (s, pid) => s.resources?.[pid] ?? null;
// What a realm holds: { kind: provinces }.
export function heldBy(s, id) {
  const out = {};
  for (const p of provincesOf(s, id)) { const k = s.resources?.[p.id]; if (k) out[k] = (out[k] ?? 0) + 1; }
  return out;
}
const works = (r, k) => !RESOURCES[k].needs || RESOURCES[k].needs.some((n) => knows(r, n));
// The gold the resources add, as a factor on the realm's income.
export function resourceIncome(s, id) {
  if (!s.resources) return 1;
  const r = s.realms[id];
  let f = 1;
  for (const [k, n] of Object.entries(heldBy(s, id))) { const R = RESOURCES[k]; if (R.income && works(r, k)) f += Math.min(R.income + R.more * (n - 1), R.income * 3); }
  return f;
}
export const resourceBonus = (s, id, what) => { // grain, works or power
  if (!s.resources) return 0;
  const r = s.realms[id], held = heldBy(s, id);
  return Object.keys(held).reduce((t, k) => t + (RESOURCES[k][what] && works(r, k) ? RESOURCES[k][what] : 0), 0);
};
