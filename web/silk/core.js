// The world's foundations: the map, randomness, the calendar and its seasons, fast lookups, new people and realms,
// and the words the chronicle uses. Pure, and shared by the browser, the Worker and Node.
import provinceData from './provinces.json' with { type: 'json' };
import graph from './graph.json' with { type: 'json' };
import { RULES as R } from './rules.js';
import { cultureOf, pick } from './names.js';

// ---------- climate: what the year does to each land ----------
// cold: the steppe, the high plateaus and the north; monsoon: India and the south of China; arid: the deserts and the
// hot lowlands from the Maghreb to Sindh; temperate: the rest (the Mediterranean, Anatolia, the plains of China).
function climateOf({ lat, lon, terrain }) {
  if ((lat >= 42) || (lat >= 36 && ['mountains', 'steppe'].includes(terrain)) || (lon >= 98 && lat >= 38)) return 'cold';
  if (terrain !== 'desert' && ((lon >= 70 && lon <= 93 && lat <= 31) || (lon >= 98 && lon <= 125 && lat <= 31))) return 'monsoon';
  if (terrain === 'desert' || (lat < 32.5 && lon >= -17 && lon <= 72) || (lat < 36 && lon >= 43 && lon <= 66 && terrain !== 'mountains')) return 'arid';
  return 'temperate';
}

export const PROVINCES = provinceData.map((p, i) => ({ ...p, i, neighbors: graph[p.id].neighbors, ways: graph[p.id].ways, xy: graph[p.id].city, label: graph[p.id].label, area: graph[p.id].area, climate: climateOf(p) }));
export const PROV = Object.fromEntries(PROVINCES.map((p) => [p.id, p]));
export const LAND = PROVINCES.reduce((t, p) => t + p.area, 0);

// ---------- randomness: a seeded stream per (age, month, step) ----------
function seedOf(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
export function rngFor(...parts) {
  let a = seedOf(parts.join(':'));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (rng, [a, b]) => a + (b - a) * rng();
export const chance = (rng, p) => rng() < p;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round1 = (v) => Math.round(v * 10) / 10;
export { pick };

// ---------- calendar and seasons ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const startYear = (s) => s?.startYear ?? R.start.year;
export const yearOf = (m, s) => startYear(s) + Math.floor(m / 12);
export const yearLabel = (y) => (y < 0 ? `${-y} BC` : `${y}`);
const yearText = yearLabel;
export const dateText = (m, s) => `${MONTHS[m % 12]} ${yearText(yearOf(m, s))}`;
export const isWinter = (m) => R.winter.includes(m % 12);
export const seasonName = (m) => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m % 12];
// What this month does to a province: snow in the cold lands in winter, the rains in monsoon lands, heat in the
// arid ones in summer. Null when the season is mild.
export function weatherOf(pid, m) {
  const c = PROV[pid].climate, mo = m % 12, S = R.seasons;
  if (c === 'cold' && S.snow.months.includes(mo)) return 'snow';
  if (c === 'monsoon' && S.rains.months.includes(mo)) return 'rains';
  if (c === 'arid' && S.heat.months.includes(mo)) return 'heat';
  return null;
}
export const harvestOf = (pid, m) => R.seasons.harvest[PROV[pid].climate][m % 12];

// ---------- fast lookups ----------
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export { key };
// Who holds what, rebuilt lazily for each new state (tick clones the state, so the cache follows it).
const OWNED = new WeakMap();
function owned(s) {
  let ix = OWNED.get(s.provinces);
  if (!ix) {
    ix = {};
    for (const p of PROVINCES) (ix[s.provinces[p.id].owner] ??= []).push(p);
    OWNED.set(s.provinces, ix);
  }
  return ix;
}
export const provincesOf = (s, id) => owned(s)[id] ?? [];
export const atWar = (s, a, b) => !!(a && b && a !== b && s.wars[key(a, b)]);
export const warOf = (s, a, b) => s.wars[key(a, b)];
export const truceUntil = (s, a, b) => s.truces[key(a, b)] ?? -1;
export const allied = (s, a, b) => !!(a && b && s.allies[key(a, b)]);
// The living realms and each realm's armies, kept until something changes them (armiesChanged / realmsChanged).
// Callers must never reorder these arrays: replays depend on the same order everywhere.
const LIVING = new WeakMap(), BYREALM = new WeakMap();
export function living(s) {
  let l = LIVING.get(s.realms);
  if (!l) LIVING.set(s.realms, (l = Object.values(s.realms).filter((r) => !r.fallen)));
  return l;
}
export function armiesOf(s, id) {
  let ix = BYREALM.get(s.armies);
  if (!ix) {
    ix = {};
    for (const a of Object.values(s.armies)) (ix[a.realm] ??= []).push(a);
    BYREALM.set(s.armies, ix);
  }
  return ix[id] ?? [];
}
export const armiesChanged = (s) => BYREALM.delete(s.armies);
export const realmsChanged = (s) => LIVING.delete(s.realms);
export const menOf = (s, id) => armiesOf(s, id).reduce((t, a) => t + a.size, 0);
export const enemiesOf = (s, id) => living(s).filter((o) => atWar(s, id, o.id)).map((o) => o.id);
// Unclaimed land (null) is nobody's friend: it can be crossed only by taking it.
export const friendly = (s, a, b) => a === b || (!!a && !!b && (allied(s, a, b) || s.realms[a]?.overlord === b || s.realms[b]?.overlord === a));

// Every change of hands goes through here, so the registry of deeds is never missed.
export function setOwner(s, pid, realm, how) {
  const p = s.provinces[pid];
  if (p.owner === realm) return;
  p.owner = realm;
  OWNED.delete(s.provinces);
  const deeds = (s.deeds[pid] ??= []);
  deeds.push({ realm, m: s.month, how });
  if (deeds.length > 12) deeds.shift();
}

// Hops from a province over the map (ignoring borders), for distance from the capital.
const HOPS = {};
export function hops(from) {
  if (HOPS[from]) return HOPS[from];
  const d = { [from]: 0 }, q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of PROV[cur].neighbors) if (d[n] === undefined) { d[n] = d[cur] + 1; q.push(n); }
  }
  return (HOPS[from] = d);
}

// The roads of the age (the Silk Road in 1200, the Royal Road in 200 BC...): which provinces stand on them.
const ROADSET = new WeakMap();
export function onRoad(s, pid) {
  let set = ROADSET.get(s.roads ?? EMPTY);
  if (!set) ROADSET.set(s.roads ?? EMPTY, (set = new Set((s.roads ?? []).flat())));
  return set.has(pid);
}
const EMPTY = [];

// ---------- words ----------
// An age's own words for some events (s.words, from its pack); fallback is the medieval phrasing.
export const word = (s, k, fallback) => s.words?.[k] ?? fallback;
export const cityOf = (s, pid) => s.names?.[pid]?.city ?? PROV[pid].city;
export const placeOf = (s, pid) => s.names?.[pid]?.name ?? PROV[pid].name;
export const short = (s, id) => (id ? s.realms[id]?.short ?? id : 'the locals');
// "of the Ghurids", "of Khwarazm".
export const ofR = (s, id) => (s.realms[id]?.plural ? `the ${short(s, id)}` : short(s, id));
// "the Ghurids take", "Khwarazm takes": realms with plural names get plural verbs. poss: "Chandelas'", "Georgia's".
const plural = (w) => ({ has: 'have', is: 'are', was: 'were' })[w] ?? w.replace(/(sh|ch|ss|x)es$/, '$1').replace(/([^s])s$/, '$1');
export const vb = (s, id, verb) => (s.realms[id]?.plural || id === null ? verb.replace(/^\S+/, plural) : verb);
export const poss = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
export const say = (s, id, verb) => `${short(s, id)} ${vb(s, id, verb)}`;
export const his = (c) => (c?.female ? 'her' : 'his');
export const him = (c) => (c?.female ? 'her' : 'him');
export const he = (c) => (c?.female ? 'she' : 'he');
export const fullName = (c) => (c ? `${c.title ? `${c.title} ` : ''}${c.name}${c.epithet ? ` ${c.epithet}` : ''}` : 'someone');
export const nameOf = (s, id) => (id && s.chars[id] ? fullName(s.chars[id]) : 'an unknown captain');
// A province's wealth in this age: the pack's own figure, or the map's.
export const baseWealth = (s, pid) => s.wealth?.[pid] ?? PROV[pid].wealth;
export const ageOf = (s, c) => yearOf(s.month, s) - (c?.born ?? yearOf(s.month, s));
export const usedNames = (s) => new Set(Object.values(s.chars).map((c) => c.name));
export const menText = (k) => (k < 0.95 ? `${Math.max(1, Math.round(k * 10)) * 100}` : `${Math.round(k).toLocaleString("en-US")},000`);
export const months = (n) => `${n} ${n === 1 ? 'month' : 'months'}`;

// ---------- new people, armies and realms ----------
export function newChar(s, c) {
  const id = `c${s.nextId++}`;
  s.chars[id] = {
    id, name: c.name, title: c.title ?? null, role: c.role, realm: c.realm, born: c.born ?? (s.startYear ?? 1200) - 30, traits: c.traits ?? [], temper: c.temper ?? null, skill: c.skill ?? 3,
    loyalty: c.loyalty ?? 70, alive: true, died: null, cause: null, female: !!c.female, invented: !!c.invented, since: c.since ?? null, relation: c.relation ?? null,
    parent: c.parent ?? null, parentId: c.parentId ?? null, spouse: null, kids: [], family: c.family ?? null, culture: c.culture ?? null, epithet: c.epithet ?? null,
    deeds: { wins: 0, losses: 0, captures: 0, works: 0, purges: 0 }, army: null, famous: c.famous ?? null,
  };
  return id;
}

export function newArmy(s, realm, general, at, size) {
  const id = `a${s.nextId++}`;
  s.armies[id] = { id, realm, general, at, size: round1(size), path: [], eta: 0, mode: 'idle', target: null, morale: 1, rest: 0, battle: null };
  armiesChanged(s);
  if (general) s.chars[general].army = id;
  return id;
}

const PALETTE = ['#8e4b2f', '#3d6b8c', '#7a8c3d', '#8c3d6b', '#4b8c7a', '#9a6a2a', '#5b4b8c', '#8c5b3d', '#2f6f6f', '#a0523a', '#6b7a2f', '#7a3d3d'];
export const colorFor = (rng) => pick(rng, PALETTE);

export function newRealm(s, rng, { name, short: sh, capital, ruler, origin, color, nomad = false, rebel = false, cause = null, elective = false, plural = rebel }) {
  const id = `${origin}${s.nextId++}`;
  s.realms[id] = {
    id, name, short: sh, plural, color: color ?? colorFor(rng), capital, ai: false, nomad, agents: false, overlord: null, gold: 10, grain: 10, horses: 2, iron: 4, tax: 'normal', ruler, heir: null,
    power: null, origin, founded: s.month, fallen: false, plan: null, rebel, cause, culture: cultureOf(capital, s), fa: s.names?.[capital]?.fa ?? PROV[capital].fa, lineage: [],
    dynasty: ruler ? `House of ${s.chars[ruler].name}` : null, elective, rep: R.reputation.start, known: [], learning: 0, fortune: [], golden: null, reforms: [], regent: null, vizier: null,
  };
  if (ruler) Object.assign(s.chars[ruler], { realm: id, role: 'ruler', since: yearOf(s.month, s), family: s.realms[id].dynasty });
  realmsChanged(s);
  return id;
}

// One line of the record of a war, kept with the war itself so its story can be told later.
export function logWar(s, cid, entry) {
  const c = s.conflicts[cid];
  if (!c) return;
  c.log.push({ m: s.month, ...entry });
  if (c.log.length > 25) c.log.splice(1, 1); // keep the opening, drop the oldest middle
}
