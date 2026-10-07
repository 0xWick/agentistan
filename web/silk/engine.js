// The Silk Road world, month by month. Pure: no I/O, no clock. Every random draw comes from rngFor(age, month, ...),
// so any month can be replayed exactly. Rulers' decisions come in as plans: doctrine.js by default, the AI later.
import provinceData from './provinces.json' with { type: 'json' };
import graph from './graph.json' with { type: 'json' };
import realmData from './realms.json' with { type: 'json' };
import { RULES as R } from './rules.js';
import { cultureOf, personName, titleFor, kingdomName, randomTraits, pick } from './names.js';

export const PROVINCES = provinceData.map((p, i) => ({ ...p, i, neighbors: graph[p.id].neighbors, xy: graph[p.id].city, label: graph[p.id].label, area: graph[p.id].area }));
export const PROV = Object.fromEntries(PROVINCES.map((p) => [p.id, p]));
export const REALM_DATA = Object.fromEntries(realmData.map((r) => [r.id, r]));

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
const between = (rng, [a, b]) => a + (b - a) * rng();
const chance = (rng, p) => rng() < p;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

// ---------- calendar ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const yearOf = (m) => R.start.year + Math.floor(m / 12);
export const dateText = (m) => `${MONTHS[m % 12]} ${yearOf(m)}`;
export const isWinter = (m) => R.winter.includes(m % 12);

// ---------- lookups ----------
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const atWar = (s, a, b) => !!(a && b && a !== b && s.wars[key(a, b)]);
export const warOf = (s, a, b) => s.wars[key(a, b)];
export const truceUntil = (s, a, b) => s.truces[key(a, b)] ?? -1;
export const allied = (s, a, b) => !!(a && b && s.allies[key(a, b)]);
export const living = (s) => Object.values(s.realms).filter((r) => !r.fallen);
export const provincesOf = (s, id) => PROVINCES.filter((p) => s.provinces[p.id].owner === id);
export const armiesOf = (s, id) => Object.values(s.armies).filter((a) => a.realm === id);
export const friendly = (s, a, b) => a === b || allied(s, a, b) || s.realms[a]?.overlord === b || s.realms[b]?.overlord === a;
const short = (s, id) => (id ? s.realms[id]?.short ?? id : 'the locals');
// "the Ghurids take", "Khwarazm takes": realms with plural names get plural verbs. poss: "Chandelas'", "Georgia's".
const vb = (s, id, verb) => (s.realms[id]?.plural || id === null ? ({ has: 'have', is: 'are' })[verb] ?? verb.replace(/(sh|ch|ss|x)es$/, '$1').replace(/([^s])s$/, '$1') : verb);
const poss = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const say = (s, id, verb) => `${short(s, id)} ${vb(s, id, verb)}`;
const nameOf = (s, c) => (c ? `${s.chars[c]?.title ? `${s.chars[c].title} ` : ''}${s.chars[c]?.name ?? 'someone'}` : 'an unknown captain');
const ageOf = (s, c) => yearOf(s.month) - (s.chars[c]?.born ?? yearOf(s.month));

export const wealthOf = (s, pid) => {
  const p = s.provinces[pid];
  return Math.max(0.5, PROV[pid].wealth - (p.ravaged > 0 ? 1.5 : 0) - (p.plague > 0 ? 1 : 0) - (p.famine > 0 ? 1 : 0));
};
export const garrisonOf = (s, pid) => R.garrison.base + R.garrison.perWealth * PROV[pid].wealth;
export const wallPower = (s, pid) => garrisonOf(s, pid) * (1 + s.provinces[pid].walls * R.walls.defence) * (0.5 + s.provinces[pid].loyalty / 100);
export function strength(s, id) {
  return armiesOf(s, id).reduce((t, a) => t + a.size, 0) + 0.3 * provincesOf(s, id).reduce((t, p) => t + garrisonOf(s, p.id), 0);
}
export function manpower(s, id) {
  return provincesOf(s, id).reduce((t, p) => t + wealthOf(s, p.id) * R.economy.manpower * (0.4 + s.provinces[p.id].loyalty / 160), 0);
}
export function incomeOf(s, id) {
  const r = s.realms[id], tax = { low: 0.8, normal: 1, high: 1.3 }[r.tax] ?? 1;
  let g = 0;
  for (const p of provincesOf(s, id)) g += wealthOf(s, p.id) * R.economy.perWealth * (s.provinces[p.id].loyalty / 100) * tax + (p.silk ? R.economy.silkBonus : 0);
  return round1(g);
}

// Hops from a province over the map (ignoring borders), for distance from the capital.
export function hops(from) {
  const d = { [from]: 0 }, q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of PROV[cur].neighbors) if (d[n] === undefined) { d[n] = d[cur] + 1; q.push(n); }
  }
  return d;
}

// Months for an army to enter a province.
export function moveCost(s, realm, pid) {
  const t = PROV[pid].terrain;
  let c = R.move[t] ?? 1;
  if (isWinter(s.month) && t === 'mountains') c += 2;
  if (s.realms[realm]?.nomad && ['steppe', 'desert', 'plains', 'river'].includes(t)) c = Math.max(0.5, c / R.nomadSpeed);
  return c;
}

// Cheapest route for an army, through land it may cross: its own, its friends', and its targets. Stops at the
// first hostile province on the way (that's where the fighting is).
export function route(s, realm, from, to, canEnter) {
  const dist = { [from]: 0 }, prev = {}, done = new Set();
  const open = [from];
  while (open.length) {
    open.sort((a, b) => dist[a] - dist[b]);
    const cur = open.shift();
    if (cur === to) break;
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur !== from && !friendly(s, realm, s.provinces[cur].owner)) continue; // fighting stops a march
    for (const n of PROV[cur].neighbors) {
      if (!canEnter(n)) continue;
      const d = dist[cur] + moveCost(s, realm, n);
      if (d < (dist[n] ?? Infinity)) { dist[n] = d; prev[n] = cur; open.push(n); }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [];
  for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  return { path, months: dist[to] };
}

// ---------- the world in January 1200 ----------
export function newAge(age = 1) {
  const rng = rngFor('age', age, 'setup');
  const s = { age, month: 0, nextId: 1, status: 'running', winner: null, endReason: null, provinces: {}, realms: {}, chars: {}, armies: {}, groups: {}, wars: {}, allies: {}, truces: {}, mongolsAt: null, record: { founded: 0, fallen: 0, assassinations: 0, battles: 0, captures: 0, revolts: 0, splits: 0 } };
  for (const p of PROVINCES) s.provinces[p.id] = { owner: p.owner ?? null, loyalty: p.loyalty ?? (p.owner ? 62 : 55), walls: p.walls, conquered: 0, ravaged: 0, plague: 0, famine: 0, siege: null };
  for (const r of realmData) {
    s.realms[r.id] = { id: r.id, name: r.name, short: r.short, plural: !!r.plural, color: r.color, capital: r.capital, ai: !!r.ai, nomad: !!r.nomad, agents: !!r.agents, overlord: r.overlord ?? null,
      gold: 0, tax: 'normal', ruler: null, heir: null, power: null, origin: 'historic', founded: 0, fallen: false, plan: null, culture: cultureOf(r.capital), fa: r.fa };
    const realm = s.realms[r.id];
    // Where the chronicles have lost a name, the world gives one from the region's customs (marked as invented).
    const named = (c) => (c.name.startsWith('the ') ? { ...c, name: personName(rng, realm.culture, usedNames(s)), invented: true } : c);
    realm.ruler = newChar(s, { ...named(r.ruler), role: 'ruler', realm: r.id, skill: 3 });
    if (r.heir) realm.heir = newChar(s, { ...r.heir, role: 'heir', realm: r.id, skill: 3 });
    for (const c of r.court ?? []) newChar(s, { ...c, role: 'courtier', realm: r.id, skill: 3 });
    const wealth = provincesOf(s, r.id).reduce((t, p) => t + p.wealth, 0) * (r.levy ?? 1);
    const generals = r.generals.length ? r.generals : r.agents ? [] : [{ name: personName(rng, realm.culture, usedNames(s)), invented: true, skill: 2, traits: randomTraits(rng, 1), at: r.capital }];
    for (const g0 of generals) {
      const g = named(g0);
      const heirGeneral = g.heir && realm.heir && s.chars[realm.heir].name === g.name;
      const gid = heirGeneral ? realm.heir : newChar(s, { name: g.name, title: g.title, role: 'general', realm: r.id, born: 1150 + Math.floor(rng() * 30), traits: g.traits, skill: g.skill, invented: g.invented });
      if (heirGeneral) s.chars[gid].skill = g.skill;
      const at = s.provinces[g.at]?.owner === r.id ? g.at : r.capital;
      newArmy(s, r.id, gid, at, Math.max(R.armies.minSize, round1((R.armies.startPerWealth * wealth) / generals.length)));
    }
  }
  for (const r of living(s)) r.gold = round1(incomeOf(s, r.id) * R.economy.startGold);
  // The quarrels already under way in 1200.
  for (const [a, b] of [['khwarazm', 'ghurid'], ['georgia', 'eldiguzid'], ['ghurid', 'chandela']]) s.wars[key(a, b)] = { since: 0 };
  s.allies[key('karakhanid', 'qarakhitai')] = { since: 0 };
  // Most ages, the Mongols come: when, the stars decide (around 1219, the year they really did).
  const M = R.steppe.mongols;
  if (chance(rng, M.chance)) {
    const g = (rng() + rng() + rng() - 1.5) * 2 * M.spread; // roughly normal
    s.mongolsAt = clamp(Math.round((M.year - R.start.year + g) * 12 + rng() * 12), 60, R.months - 120);
  }
  return s;
}

function newChar(s, c) {
  const id = `c${s.nextId++}`;
  s.chars[id] = { id, name: c.name, title: c.title ?? null, role: c.role, realm: c.realm, born: c.born ?? 1170, traits: c.traits ?? [], skill: c.skill ?? 3, loyalty: c.loyalty ?? 70, alive: true, died: null, cause: null,
    female: !!c.female || FEMALE.has(c.name), invented: !!c.invented };
  return id;
}

const FEMALE = new Set(['Tamar', 'Terken Khatun', 'Rusudan']);
// A crown passes with the right word for whoever wears it.
const titled = (title, c) => ({ Queen: c.female ? 'Queen' : 'King', King: c.female ? 'Queen' : 'King' })[title] ?? title;

function newArmy(s, realm, general, at, size) {
  const id = `a${s.nextId++}`;
  s.armies[id] = { id, realm, general, at, size: round1(size), path: [], eta: 0, mode: 'idle', target: null, morale: 1, rest: 0 };
  if (general) s.chars[general].army = id;
  return id;
}

function newRealm(s, rng, { name, short, capital, ruler, origin, color, nomad = false, rebel = false, cause = null }) {
  const id = `${origin}${s.nextId++}`;
  s.realms[id] = { id, name, short, plural: rebel, color: color ?? colorFor(rng), capital, ai: false, nomad, agents: false, overlord: null, gold: 10, tax: 'normal', ruler, heir: null, power: null,
    origin, founded: s.month, fallen: false, plan: null, rebel, cause, culture: cultureOf(capital), fa: PROV[capital].fa };
  if (ruler) Object.assign(s.chars[ruler], { realm: id, role: 'ruler' });
  return id;
}

const PALETTE = ['#8e4b2f', '#3d6b8c', '#7a8c3d', '#8c3d6b', '#4b8c7a', '#9a6a2a', '#5b4b8c', '#8c5b3d', '#2f6f6f', '#a0523a', '#6b7a2f', '#7a3d3d'];
const colorFor = (rng) => pick(rng, PALETTE);

// ---------- one month ----------
// planFor(s, realmId, rng) returns a realm's plan when it has none (or it expired); doctrine.plan by default.
export function tick(s0, { planFor, ordersFor }) {
  const s = structuredClone(s0);
  const events = [];
  const emit = (type, text, data = {}) => events.push({ type, month: s.month, date: dateText(s.month), text, ...data });
  if (s.status !== 'running') return { state: s, events };
  const rng = (step) => rngFor('age', s.age, 'month', s.month, step);

  if (s.month === 0) emit('age.started', `The year 1200. ${living(s).length} realms share the Silk Road.`);
  plans(s, rng('plan'), emit, planFor);
  economy(s, emit);
  for (const r of living(s)) ordersFor(s, r.id, rng(`orders:${r.id}`));
  march(s, rng('march'), emit);
  sieges(s, rng('siege'), emit);
  loyalty(s, rng('loyalty'), emit);
  fate(s, rng, emit);
  settle(s, rng('settle'), emit);

  s.month++;
  if (s.status === 'running') ageEnd(s, emit);
  return { state: s, events };
}

// ---------- plans and diplomacy ----------
function plans(s, rng, emit, planFor) {
  for (const r of living(s)) {
    if (!r.plan || r.plan.until <= s.month) r.plan = planFor(s, r.id, rng);
    const p = r.plan;
    r.tax = p.tax ?? 'normal';
    for (const t of p.war ?? []) declareWar(s, r.id, t, emit);
    for (const t of p.peace ?? []) if (atWar(s, r.id, t) && acceptsPeace(s, t, r.id)) makePeace(s, r.id, t, emit);
    for (const t of p.ally ?? []) if (!allied(s, r.id, t) && !atWar(s, r.id, t) && s.realms[t] && !s.realms[t].fallen && acceptsAlliance(s, t, r.id)) {
      s.allies[key(r.id, t)] = { since: s.month };
      emit('alliance', `${r.short} and ${short(s, t)} swear an alliance`, { realms: [r.id, t] });
    }
    if (p.submit && s.realms[p.submit] && !s.realms[p.submit].fallen && !r.overlord) {
      r.overlord = p.submit;
      delete s.wars[key(r.id, p.submit)];
      emit('vassal', `${say(s, r.id, 'bows')} to ${short(s, p.submit)} and ${vb(s, r.id, 'pays')} tribute`, { realms: [r.id, p.submit] });
    }
    if (p.independence && r.overlord) {
      const was = r.overlord;
      r.overlord = null;
      declareWar(s, r.id, was, emit, `${say(s, r.id, 'throws')} off the rule of ${short(s, was)}`);
    }
    if (p.power && !r.power) { powerMove(s, r.id, p.power, rng, emit); p.power = null; } // once, not every month of the plan
    if (p.hire && !r.contract) { hire(s, r.id, p.hire, emit); p.hire = null; }
  }
}

export function declareWar(s, a, b, emit, text) {
  const A = s.realms[a], B = s.realms[b];
  if (!A || !B || A.fallen || B.fallen || a === b || atWar(s, a, b) || (s.truces[key(a, b)] ?? -1) > s.month) return false;
  if (A.overlord === b || B.overlord === a) {
    if (A.overlord === b) A.overlord = null;
    else B.overlord = null;
  }
  delete s.allies[key(a, b)];
  s.wars[key(a, b)] = { since: s.month };
  emit('war', text ?? `${say(s, a, 'declares')} war on ${B.short}`, { realms: [a, b] });
  // Allies honour the alliance.
  for (const k of Object.keys(s.allies)) {
    const [x, y] = k.split('|'), friend = x === b ? y : y === b ? x : null;
    if (friend && friend !== a && !atWar(s, friend, a) && !s.realms[friend].fallen) {
      s.wars[key(friend, a)] = { since: s.month };
      emit('war', `${say(s, friend, 'joins')} the war at the side of ${B.short}`, { realms: [friend, a] });
    }
  }
  return true;
}

function acceptsPeace(s, them, us) {
  const war = s.wars[key(them, us)];
  return !s.realms[them]?.nomad || s.month - (war?.since ?? 0) > 60 ? strength(s, them) < strength(s, us) * 1.6 || s.month - (war?.since ?? 0) > 48 : false;
}
const acceptsAlliance = (s, them, us) => !s.realms[them].nomad && !s.realms[them].rebel && !atWar(s, them, us);

export function makePeace(s, a, b, emit) {
  delete s.wars[key(a, b)];
  s.truces[key(a, b)] = s.month + R.diplomacy.truce;
  for (const pid of Object.keys(s.provinces)) { // sieges between them are lifted
    const sg = s.provinces[pid].siege;
    if (sg && ((sg.realm === a && s.provinces[pid].owner === b) || (sg.realm === b && s.provinces[pid].owner === a))) s.provinces[pid].siege = null;
  }
  emit('peace', `${short(s, a)} and ${short(s, b)} make peace`, { realms: [a, b] });
}

// ---------- gold ----------
function economy(s, emit) {
  for (const r of living(s)) {
    const horde = r.id === 'mongol'; // the horde lives off the land it rides through
    const income = incomeOf(s, r.id) + (r.id === 'alamut' ? R.agents.alamutDues : 0); // fear of Alamut's agents pays
    const upkeep = horde ? 0 : armiesOf(s, r.id).reduce((t, a) => t + a.size * R.economy.upkeep, 0);
    let tribute = 0;
    if (r.overlord && s.realms[r.overlord] && !s.realms[r.overlord].fallen) {
      tribute = income * R.economy.tribute;
      s.realms[r.overlord].gold += tribute;
    }
    r.gold = round1(r.gold + income - upkeep - tribute);
    r.lastIncome = income;
    if (r.gold < 0) { // unpaid soldiers walk home
      r.gold = 0;
      for (const a of armiesOf(s, r.id)) a.size = round1(a.size * 0.92);
      if (!r.broke && s.month - (r.brokeSaid ?? -99) >= 12 && (r.brokeSaid = s.month) >= 0) emit('broke', `${poss(r.short)} treasury is empty: unpaid soldiers desert`, { realms: [r.id] });
      r.broke = true;
    } else r.broke = false;
    // Recruiting, as the plan says: spare gold becomes soldiers, up to what the land can field and the treasury can
    // keep paying for.
    const men = armiesOf(s, r.id).reduce((t, a) => t + a.size, 0);
    const atWarNow = Object.keys(s.wars).some((k) => k.split('|').includes(r.id));
    const affordable = horde ? Infinity : (income * (atWarNow ? R.sustain.war : R.sustain.peace)) / R.economy.upkeep - men;
    const room = Math.min(manpower(s, r.id) - men, affordable);
    const share = r.plan?.recruit ?? 0.5;
    const spend = Math.min(room * R.economy.recruitCost, Math.max(0, r.gold - 12) * share);
    if (spend >= R.economy.recruitCost) raise(s, r, spend / R.economy.recruitCost, emit);
    if (horde) for (const a of armiesOf(s, r.id)) a.size = round1(Math.min(a.size + 0.8, 40)); // the steppe sends riders
    for (const a of armiesOf(s, r.id)) if (a.rest > 0) a.rest--;
  }
}

function raise(s, r, men, emit) {
  r.gold = round1(r.gold - men * R.economy.recruitCost);
  const n = provincesOf(s, r.id).length, max = clamp(Math.floor(n / R.armies.perProvinces) + 1, R.armies.min, R.armies.max);
  const mine = armiesOf(s, r.id);
  if (mine.length < max && men >= R.armies.minSize) {
    const rng = rngFor('age', s.age, 'raise', s.month, r.id);
    const free = Object.values(s.chars).find((c) => c.alive && c.realm === r.id && c.role === 'general' && !s.armies[c.army]);
    const gen = free?.id ?? newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'general', realm: r.id, born: yearOf(s.month) - 25 - Math.floor(rng() * 15), traits: randomTraits(rng, 1), skill: 1 + Math.floor(rng() * 4) });
    const at = s.provinces[r.capital]?.owner === r.id ? r.capital : provincesOf(s, r.id)[0]?.id;
    if (!at) return;
    newArmy(s, r.id, gen, at, men);
    emit('army.raised', `${say(s, r.id, 'raises')} an army of ${Math.round(men)},000 under ${nameOf(s, gen)}`, { realms: [r.id], at, chars: [gen] });
  } else if (mine.length) {
    const a = mine.sort((x, y) => x.size - y.size)[0];
    a.size = round1(a.size + men);
  }
}
const usedNames = (s) => new Set(Object.values(s.chars).map((c) => c.name));

// ---------- marching and fighting ----------
function march(s, rng, emit) {
  for (const a of Object.values(s.armies)) {
    if (a.mode === 'siege' || a.rest > 0 || !a.path.length) continue;
    let budget = 1;
    while (budget > 0 && a.path.length && s.armies[a.id]) {
      const next = a.path[0];
      if (!a.eta) a.eta = moveCost(s, a.realm, next);
      const step = Math.min(budget, a.eta);
      a.eta = round1(a.eta - step);
      budget = round1(budget - step);
      if (a.eta > 0) break;
      a.path.shift();
      a.at = next;
      a.eta = 0;
      if (arrive(s, rng, emit, a)) break;
    }
  }
  // Armies of realms at war that share a province fight it out.
  const byPlace = {};
  for (const a of Object.values(s.armies)) (byPlace[a.at] ??= []).push(a);
  for (const [pid, list] of Object.entries(byPlace)) {
    for (const a of list) for (const b of list) {
      if (a.id < b.id && s.armies[a.id] && s.armies[b.id] && atWar(s, a.realm, b.realm)) {
        const defender = s.provinces[pid].owner === a.realm ? a : b;
        fight(s, rng, emit, defender === a ? b : a, defender, pid);
      }
    }
  }
}

// Returns true when the army stops here (a fight or a siege).
function arrive(s, rng, emit, a) {
  const pid = a.at, owner = s.provinces[pid].owner;
  const foe = Object.values(s.armies).find((b) => b.at === pid && b.id !== a.id && atWar(s, a.realm, b.realm));
  if (foe) {
    fight(s, rng, emit, a, foe, pid);
    return true;
  }
  if (owner !== a.realm && !friendly(s, a.realm, owner) && (owner === null || atWar(s, a.realm, owner))) {
    const p = s.provinces[pid];
    if (!p.siege || !s.armies[p.siege.army]) {
      p.siege = { realm: a.realm, army: a.id, left: Math.max(1, p.walls * R.walls.siegeMonths - ((s.chars[a.general]?.skill ?? 2) >= 4 ? 1 : 0)), since: s.month };
      emit('siege', `${say(s, a.realm, 'lays')} siege to ${PROV[pid].city}`, { realms: [a.realm, owner].filter(Boolean), at: pid, chars: [a.general] });
    }
    a.mode = 'siege';
    a.path = [];
    return true;
  }
  return false;
}

export function fight(s, rng, emit, A, D, pid, garrison = false) {
  const B = R.battle, P = PROV[pid];
  const skill = (x) => 1 + B.skill * ((s.chars[x.general]?.skill ?? 2) - 3);
  const luck = () => 1 + between(rng, [-B.luck, B.luck]);
  const home = (x) => (s.provinces[pid].owner === x.realm ? B.home : 1);
  const pa = A.size * skill(A) * A.morale * luck();
  const pd = garrison ? D.size * luck() : D.size * skill(D) * D.morale * (B.terrain[P.terrain] ?? 1) * home(D) * luck();
  const won = pa > pd, ratio = won ? pd / pa : pa / pd;
  const [W, L] = won ? [A, D] : [D, A];
  L.size = round1(L.size * (1 - between(rng, B.loserLoss)));
  if (!garrison || W !== D) W.size = round1(W.size * (1 - between(rng, B.winnerLoss) * clamp(ratio * 1.5, 0.3, 1)));
  if (!garrison) {
    W.morale = clamp(round1(W.morale + 0.1), 0.7, 1.3);
    L.morale = clamp(round1(L.morale - 0.1), 0.7, 1.3);
    W.rest = B.rest.winner;
    L.rest = B.rest.loser;
  } else if (!won) A.rest = B.rest.loser;
  s.record.battles++;
  const fallen = [];
  for (const [x, p] of [[W, B.generalDies.winner], [L, B.generalDies.loser]]) {
    if (x.general && s.chars[x.general]?.alive && chance(rng, p)) {
      fallen.push(x.general);
      die(s, x.general, 'battle', emit, rngFor('age', s.age, 'death', s.month, x.general), `falls in battle at ${P.city}`);
      x.general = null;
    }
  }
  const sideA = short(s, A.realm), sideD = garrison ? `the defenders of ${P.city}` : short(s, D.realm);
  const crushing = ratio < 0.6;
  const verb = (id, one) => (garrison && id === null ? one.replace(/(sh|ch)es$/, '$1').replace(/([^s])s$/, '$1') : vb(s, id, one));
  emit('battle', won ? `${sideA} ${verb(A.realm, crushing ? 'crushes' : 'defeats')} ${sideD} at ${P.city}` : `${sideD} ${garrison ? (crushing ? 'crush' : 'beat back') : verb(D.realm, crushing ? 'crushes' : 'beats back')} ${sideA} at ${P.city}`,
    { realms: [A.realm, garrison ? s.provinces[pid].owner : D.realm].filter(Boolean), at: pid, chars: [A.general, D.general, ...fallen].filter(Boolean), winner: won ? A.realm : garrison ? s.provinces[pid].owner : D.realm, sizes: [A.size, D.size] });
  if (!garrison) {
    if (L.size < R.armies.minSize) disband(s, L, emit, `${poss(short(s, L.realm))} army at ${P.city} is destroyed`);
    else retreat(s, L);
  }
  return won;
}

function retreat(s, a) {
  const r = s.realms[a.realm];
  const home = route(s, a.realm, a.at, r.capital, (n) => friendly(s, a.realm, s.provinces[n].owner));
  const step = home?.path[0] ?? PROV[a.at].neighbors.find((n) => friendly(s, a.realm, s.provinces[n].owner));
  if (step) Object.assign(a, { at: step, path: [], eta: 0, mode: 'idle' });
  else a.mode = 'idle';
  for (const p of Object.values(s.provinces)) if (p.siege?.army === a.id) p.siege = null;
}

function disband(s, a, emit, text) {
  if (text) emit('army.destroyed', text, { realms: [a.realm], at: a.at, chars: [a.general].filter(Boolean) });
  if (a.general && s.chars[a.general]) s.chars[a.general].army = null;
  for (const p of Object.values(s.provinces)) if (p.siege?.army === a.id) p.siege = null;
  delete s.armies[a.id];
}

// ---------- sieges ----------
function sieges(s, rng, emit) {
  for (const pid of Object.keys(s.provinces)) {
    const p = s.provinces[pid], sg = p.siege;
    if (!sg) continue;
    const a = s.armies[sg.army];
    if (!a || a.at !== pid || (p.owner && !atWar(s, a.realm, p.owner))) {
      p.siege = null;
      if (a) a.mode = 'idle';
      continue;
    }
    const gen = s.chars[a.general], bold = gen?.traits.some((t) => ['bold', 'relentless', 'cruel', 'restless'].includes(t));
    const defence = wallPower(s, pid);
    if (sg.left > 1 && a.size >= defence * R.walls.stormRatio * (bold ? 0.8 : 1) && chance(rng, bold ? 0.5 : 0.25)) {
      emit('storm', `${say(s, a.realm, 'storms')} the walls of ${PROV[pid].city}`, { realms: [a.realm, p.owner].filter(Boolean), at: pid, chars: [a.general].filter(Boolean) });
      a.size = round1(a.size * (1 - R.walls.stormLoss * rng()));
      if (fight(s, rng, emit, a, { size: defence, realm: p.owner, morale: 1 }, pid, true)) capture(s, pid, a.realm, emit, rng, 'storm');
      continue;
    }
    sg.left--;
    if (sg.left <= 0) capture(s, pid, a.realm, emit, rng, 'siege');
  }
}

export function capture(s, pid, realm, emit, rng, how) {
  const p = s.provinces[pid], old = p.owner, R2 = s.realms[realm];
  p.owner = realm;
  p.siege = null;
  p.conquered = R.loyalty.conquered;
  p.loyalty = Math.min(p.loyalty, R2.rebel ? 55 : 35);
  if (R2.id === 'mongol') { // the horde loots what it takes
    Object.assign(p, { ravaged: 24, loyalty: 25 });
    R2.gold = round1(R2.gold + PROV[pid].wealth * 12);
  }
  for (const a of Object.values(s.armies)) if (a.at === pid && a.realm === realm) a.mode = 'idle';
  s.record.captures++;
  const lost = old && s.realms[old];
  const capital = lost && lost.capital === pid;
  emit('capture', `${say(s, realm, how === 'storm' ? 'storms' : 'takes')} ${PROV[pid].city}${lost ? ` from ${lost.short}` : ''}${capital ? `, the capital` : ''}`,
    { realms: [realm, old].filter(Boolean), at: pid, capital });
  if (capital) moveCapital(s, old, emit);
  if (lost && !provincesOf(s, old).length && !homeless(s, old)) fall(s, old, emit, `${lost.name} is no more: ${R2.short} ${vb(s, realm, 'has')} taken its last city`);
}

// A nomad realm that has lost every city lives on while its armies ride.
const homeless = (s, id) => s.realms[id]?.nomad && armiesOf(s, id).length > 0;

function moveCapital(s, id, emit) {
  const r = s.realms[id], left = provincesOf(s, id);
  if (!left.length) return;
  r.capital = left.sort((a, b) => b.wealth - a.wealth || (b.walls - a.walls))[0].id;
  for (const p of left) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 8);
  emit('capital', `${say(s, id, 'moves')} the court to ${PROV[r.capital].city}`, { realms: [id], at: r.capital });
}

function fall(s, id, emit, text) {
  const r = s.realms[id];
  if (!r || r.fallen) return;
  r.fallen = true;
  r.fellAt = s.month;
  s.record.fallen++;
  for (const a of armiesOf(s, id)) disband(s, a);
  for (const k of Object.keys(s.wars)) if (k.split('|').includes(id)) delete s.wars[k];
  for (const k of Object.keys(s.allies)) if (k.split('|').includes(id)) delete s.allies[k];
  for (const v of living(s)) if (v.overlord === id) v.overlord = null;
  for (const c of Object.values(s.chars)) if (c.alive && c.realm === id && c.role !== 'ruler') c.role = 'exile';
  emit('fallen', text, { realms: [id] });
}

// ---------- the people ----------
function loyalty(s, rng, emit) {
  const L = R.loyalty, near = {};
  for (const r of living(s)) near[r.id] = hops(r.capital);
  const armiesAt = {};
  for (const a of Object.values(s.armies)) (armiesAt[a.at] ??= []).push(a);
  for (const P of PROVINCES) {
    const p = s.provinces[P.id], owner = p.owner, r = s.realms[owner];
    p.conquered = round1(p.conquered * L.conqueredDecay);
    for (const k of ['ravaged', 'plague', 'famine']) if (p[k] > 0) p[k]--;
    if (!r) continue;
    const ruler = s.chars[r.ruler];
    const d = near[owner]?.[P.id] ?? 6;
    let target = L.base + (r.capital === P.id ? L.capital : 0) + L.perHop * Math.max(0, d - L.freeHops) + p.conquered + (L.tax[r.tax] ?? 0);
    if (Object.keys(s.wars).some((k) => k.split('|').includes(owner))) target += L.war;
    const here = armiesAt[P.id] ?? [];
    if (here.some((a) => a.realm !== owner && atWar(s, a.realm, owner))) target += L.enemyArmy;
    if (here.some((a) => a.realm === owner)) target += L.ownArmy;
    if (p.ravaged > 0) target += L.ravaged;
    if (p.plague > 0) target += L.plague;
    if (p.famine > 0) target += L.famine;
    for (const t of ruler?.traits ?? []) target += { beloved: 8, just: 5, wise: 3, cruel: -8, greedy: -3, carefree: -3 }[t] ?? 0;
    if (r.rebel) target += 15; // a cause is popular where it began
    p.loyalty = round1(clamp(p.loyalty + (target - p.loyalty) * L.drift + between(rng, [-2, 2]), 0, 100));
    const fear = owner === 'mongol' ? 0.15 : 1; // few dare rise against the Mongols
    if (p.loyalty < L.revoltBelow && r.capital !== P.id && !p.siege && chance(rng, (L.revoltBelow - p.loyalty) * L.revoltChance * fear)) revolt(s, P.id, rng, emit);
  }
}

function revolt(s, pid, rng, emit) {
  const p = s.provinces[pid], old = p.owner;
  s.record.revolts++;
  // Join a rebellion already burning next door against the same master, or start a new one.
  const cause = PROV[pid].neighbors.map((n) => s.realms[s.provinces[n].owner]).find((r) => r && r.rebel && r.cause === old && !r.fallen);
  let id = cause?.id;
  if (!id) {
    const culture = cultureOf(pid);
    const leader = newChar(s, { name: personName(rng, culture, usedNames(s)), title: null, role: 'rebel', realm: null, born: yearOf(s.month) - 22 - Math.floor(rng() * 25), traits: randomTraits(rng, 2), skill: 2 + Math.floor(rng() * 3) });
    id = newRealm(s, rng, { name: `Rising of ${PROV[pid].name}`, short: `${PROV[pid].name} rebels`, capital: pid, ruler: leader, origin: 'rebel', rebel: true, cause: old });
    s.chars[leader].title = 'Rebel leader';
  }
  p.owner = id;
  p.loyalty = 60;
  p.conquered = 0;
  s.wars[key(id, old)] = { since: s.month };
  newArmy(s, id, s.realms[id].ruler && !s.chars[s.realms[id].ruler].army ? s.realms[id].ruler : null, pid, round1(1 + wealthOf(s, pid) * 0.9));
  emit('revolt', `${PROV[pid].name} rises against ${short(s, old)}${cause ? `, joining the ${cause.short}` : `, led by ${s.chars[s.realms[id].ruler].name}`}`, { realms: [id, old], at: pid, chars: [s.realms[id].ruler] });
  if (s.realms[old] && !provincesOf(s, old).length) fall(s, old, emit, `${s.realms[old].name} is no more: its last province has risen`);
}

// ---------- fate: deaths, heirs, plots, betrayals, the steppe, disasters ----------
function fate(s, rng, emit) {
  lives(s, rng('lives'), emit);
  plots(s, rng('plots'), emit);
  betrayals(s, rng('betrayal'), emit);
  steppe(s, rng('steppe'), emit);
  disasters(s, rng('disasters'), emit);
}

function lives(s, rng, emit) {
  for (const c of Object.values(s.chars)) {
    if (!c.alive) continue;
    const age = yearOf(s.month) - c.born;
    const p = (R.life.bands.find(([upTo]) => age < upTo)?.[1] ?? 0.02) * (c.traits.includes('ailing') ? R.life.ailing : 1);
    if (chance(rng, p)) die(s, c.id, 'age', emit, rng);
  }
  for (const r of living(s)) {
    if (!r.heir && !r.rebel && s.month % 12 === 0 && chance(rng, R.life.heirEachYear)) {
      const ruler = s.chars[r.ruler];
      r.heir = newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'heir', realm: r.id, born: Math.max((ruler?.born ?? 1170) + 18, yearOf(s.month) - 20), traits: randomTraits(rng, 2), skill: 1 + Math.floor(rng() * 4) });
      emit('heir', `${nameOf(s, r.ruler)} of ${r.short} names ${s.chars[r.heir].name} heir`, { realms: [r.id], chars: [r.ruler, r.heir] });
    }
  }
}

export function die(s, id, cause, emit, rng, how) {
  const c = s.chars[id];
  if (!c?.alive) return;
  Object.assign(c, { alive: false, died: s.month, cause });
  if (c.army && s.armies[c.army]) s.armies[c.army].general = null;
  const r = s.realms[c.realm];
  const age = yearOf(s.month) - c.born;
  const who = `${c.title ? `${c.title} ` : ''}${c.name}`;
  const text = how ? `${who} of ${short(s, c.realm)} ${how}` : cause === 'age' ? `${who} of ${short(s, c.realm)} dies, aged ${age}` : `${who} of ${short(s, c.realm)} is killed`;
  if (r && !r.fallen && r.ruler === id) {
    emit('death', text, { realms: [r.id], chars: [id], ruler: true, cause });
    succession(s, r.id, rng, emit);
  } else {
    if (r?.heir === id) r.heir = null;
    if (['ruler', 'heir', 'general', 'courtier'].includes(c.role) || cause !== 'age') emit('death', text, { realms: [c.realm].filter(Boolean), chars: [id], cause });
  }
}

function succession(s, id, rng, emit) {
  const r = s.realms[id], provs = provincesOf(s, id);
  let heir = r.heir && s.chars[r.heir]?.alive ? r.heir : null;
  const generals = Object.values(s.chars).filter((c) => c.alive && c.realm === id && c.role === 'general').sort((a, b) => b.skill - a.skill);
  if (!heir) heir = generals[0]?.id ?? newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'heir', realm: id, born: yearOf(s.month) - 20 - Math.floor(rng() * 20), traits: randomTraits(rng, 2), skill: 2 + Math.floor(rng() * 3) });
  const h = s.chars[heir];
  const weak = yearOf(s.month) - h.born < 16 || h.traits.includes('timid') || h.traits.includes('carefree');
  const S = R.succession;
  const p = r.rebel ? 0 : S.crisis + S.perProvince * provs.length + (weak ? S.weakHeir : 0);
  const pretenders = generals.filter((g) => g.id !== heir && g.army && s.armies[g.army] && !g.traits.includes('loyal') && (g.traits.includes('ambitious') || g.traits.includes('scheming') || chance(rng, 0.5)));
  const title = titled(s.chars[r.ruler]?.title ?? titleFor(r.culture), h);
  Object.assign(h, { role: 'ruler', title, realm: id });
  r.ruler = heir;
  r.heir = null;
  r.power = null; // a new reign may make its own power move
  r.plan = null;
  emit('crowned', `${h.name} becomes ${title} of ${r.short}${weak ? ', but the court whispers' : ''}`, { realms: [id], chars: [heir] });
  if (provs.length < 4) return;
  for (const g of pretenders.slice(0, provs.length > 14 ? 2 : 1)) {
    if (chance(rng, p)) split(s, id, g.id, rng, emit);
  }
}

// A great man takes the provinces around his army and makes them a kingdom of his own.
function split(s, id, gid, rng, emit, why = 'breaks away') {
  const r = s.realms[id], g = s.chars[gid], a = s.armies[g.army];
  if (!a || s.provinces[a.at].owner !== id) return;
  const mine = provincesOf(s, id), want = Math.max(1, Math.round(mine.length * R.succession.splitShare * (0.6 + rng() * 0.6)));
  const d = hops(a.at), taken = mine.filter((p) => p.id !== r.capital).sort((x, y) => d[x.id] - d[y.id]).slice(0, want);
  if (!taken.length) return;
  const seat = taken[0].id, culture = cultureOf(seat);
  const nid = newRealm(s, rng, { name: kingdomName(culture, PROV[seat].name), short: PROV[seat].name, capital: seat, ruler: gid, origin: 'split', color: colorFor(rng) });
  Object.assign(g, { title: titleFor(culture) });
  for (const p of taken) Object.assign(s.provinces[p.id], { owner: nid, loyalty: Math.max(40, s.provinces[p.id].loyalty), siege: null });
  a.realm = nid;
  s.realms[nid].gold = round1(r.gold * 0.3);
  r.gold = round1(r.gold * 0.7);
  s.wars[key(nid, id)] = { since: s.month };
  s.record.splits++;
  s.record.founded++;
  emit('split', `${g.name} ${why} and founds the ${s.realms[nid].name}: ${taken.length} provinces of ${r.short} go with him`, { realms: [nid, id], at: seat, chars: [gid] });
}

function plots(s, rng, emit) {
  const A = R.agents;
  // Hired killings, paid last month.
  for (const r of living(s)) {
    const c = r.contract;
    if (!c) continue;
    r.contract = null;
    const t = s.chars[c.target];
    if (!t?.alive) continue;
    const odds = A.success * (t.traits.includes('cautious') || t.traits.includes('shrewd') ? 0.6 : 1) * (c.by === 'alamut' ? 1.25 : 1);
    const ok = chance(rng, odds), exposed = chance(rng, ok ? A.exposed : A.exposed + 0.3);
    if (ok) {
      s.record.assassinations++;
      die(s, t.id, 'assassin', emit, rng, `is struck down by ${c.by === 'alamut' ? 'the hidden agents of Alamut' : 'hired daggers'}${exposed && r.id !== 'alamut' ? `, paid by ${r.short}` : ''}`);
    } else emit('plot', `A plot against ${nameOf(s, t.id)} of ${short(s, t.realm)} fails${exposed ? `: the trail leads to ${r.short}` : ''}`, { realms: [t.realm, ...(exposed ? [r.id] : [])], chars: [t.id] });
    if (exposed && t.realm && t.realm !== r.id) declareWar(s, t.realm, r.id, emit, `${say(s, t.realm, 'declares')} war on ${r.short} to avenge the plot`);
  }
  // The Lords of Alamut strike on their own account at whoever threatens them.
  const alamut = s.realms.alamut;
  if (alamut && !alamut.fallen && chance(rng, 1 / A.alamutEvery) && alamut.gold >= A.alamutStrike) {
    const foes = living(s).filter((r) => r.id !== 'alamut' && (atWar(s, r.id, 'alamut') || provincesOf(s, r.id).some((p) => p.neighbors.some((n) => s.provinces[n].owner === 'alamut'))));
    const target = foes.sort((a, b) => strength(s, b.id) - strength(s, a.id))[0];
    if (target) {
      const victims = Object.values(s.chars).filter((c) => c.alive && c.realm === target.id && ['ruler', 'general', 'heir'].includes(c.role));
      const v = victims.find((c) => c.id === target.ruler && rng() < 0.4) ?? pick(rng, victims);
      if (v) {
        alamut.gold -= R.agents.alamutStrike;
        alamut.contract = { target: v.id, by: 'alamut' };
      }
    }
  }
  // Guilds of daggers form in rich, restless cities.
  for (const P of PROVINCES) {
    if (P.wealth >= 5 && s.provinces[P.id].loyalty < 50 && !Object.values(s.groups).some((g) => g.at === P.id) && chance(rng, A.guildChance)) {
      const id = `g${s.nextId++}`;
      s.groups[id] = { id, kind: 'guild', at: P.id, since: s.month, name: `the Daggers of ${P.city}` };
      emit('guild', `A guild of hired daggers gathers in the back streets of ${P.city}`, { at: P.id });
    }
  }
}

export function hire(s, id, target, emit) {
  const r = s.realms[id], t = s.chars[target];
  if (!t?.alive || t.realm === id || r.gold < R.agents.contractCost) return false;
  const seller = s.realms.alamut && !s.realms.alamut.fallen && t.realm !== 'alamut' ? 'alamut' : Object.values(s.groups).some((g) => g.kind === 'guild') ? 'guild' : null;
  if (!seller) return false;
  r.gold = round1(r.gold - R.agents.contractCost);
  if (seller === 'alamut') s.realms.alamut.gold += R.agents.contractCost * 0.8;
  r.contract = { target, by: seller };
  return true;
}

function betrayals(s, rng, emit) {
  for (const c of Object.values(s.chars)) {
    if (!c.alive || c.role !== 'general' || !s.armies[c.army]) continue;
    const r = s.realms[c.realm];
    if (!r || r.fallen || r.rebel || provincesOf(s, r.id).length < 3) continue;
    const ruler = s.chars[r.ruler];
    const troubled = r.broke || (ruler && (yearOf(s.month) - ruler.born < 18 || ruler.traits.includes('timid') || ruler.traits.includes('carefree')));
    if (!c.traits.includes('ambitious') && !c.traits.includes('scheming')) continue;
    if (!chance(rng, R.betrayal.chance * (troubled ? 3 : 1) * (c.traits.includes('loyal') ? 0.1 : 1))) continue;
    const a = s.armies[c.army];
    if (a.at === r.capital || chance(rng, R.betrayal.coupShare * (troubled ? 1.3 : 0.6))) {
      const old = s.chars[r.ruler];
      emit('coup', `${c.name} seizes the throne of ${r.short}${old ? `, overthrowing ${old.name}` : ''}`, { realms: [r.id], chars: [c.id, old?.id].filter(Boolean) });
      if (old) Object.assign(old, { alive: false, died: s.month, cause: 'overthrown' });
      if (r.heir && s.chars[r.heir]) s.chars[r.heir].role = 'exile';
      Object.assign(c, { role: 'ruler', title: old?.title ?? titleFor(r.culture) });
      Object.assign(r, { ruler: c.id, heir: null, plan: null, power: null });
    } else split(s, r.id, c.id, rng, emit, 'rebels against his master');
  }
}

function steppe(s, rng, emit) {
  // Kipchak riders raid the settled lands next to the steppe.
  const kip = s.realms.kipchak;
  if (kip && !kip.fallen && chance(rng, 1 / R.steppe.raidEvery)) {
    const from = provincesOf(s, 'kipchak');
    const targets = from.flatMap((p) => p.neighbors).filter((n) => s.provinces[n].owner && s.provinces[n].owner !== 'kipchak' && !friendly(s, 'kipchak', s.provinces[n].owner));
    if (targets.length) {
      const t = pick(rng, targets), p = s.provinces[t], victim = s.realms[p.owner];
      const loot = Math.min(victim.gold, PROV[t].wealth * 4);
      victim.gold = round1(victim.gold - loot);
      kip.gold = round1(kip.gold + loot);
      p.ravaged = Math.max(p.ravaged, 4);
      emit('raid', `Kipchak riders raid ${PROV[t].name}, burning villages and carrying off ${Math.round(loot)} gold`, { realms: ['kipchak', victim.id], at: t });
    }
  }
  // The Mongols.
  if (s.mongolsAt === s.month && !s.realms.mongol) {
    const entry = ['almaliq', 'otrar', 'kashgar', 'balasagun', 'jand'].find((pid) => PROV[pid]) ?? 'almaliq';
    const khan = newChar(s, { name: 'Genghis Khan', title: 'Great Khan', role: 'ruler', realm: null, born: 1162, traits: ['relentless', 'cruel', 'shrewd'], skill: 5 });
    const id = 'mongol';
    s.realms[id] = { id, name: 'Mongol Empire', short: 'Mongols', plural: true, color: '#e9e2c6', capital: entry, ai: true, nomad: true, agents: false, overlord: null, gold: 120, tax: 'normal', ruler: khan, heir: null, power: null,
      origin: 'horde', founded: s.month, fallen: false, plan: null, culture: 'mongol', fa: 'مغولان' };
    s.chars[khan].realm = id;
    const old = s.provinces[entry].owner;
    s.provinces[entry].owner = id;
    s.provinces[entry].loyalty = 40;
    const names = ['Jebe', 'Subutai', 'Jochi', 'Tolui', 'Chagatai', 'Ögedei'];
    const M = R.steppe.mongols;
    newArmy(s, id, khan, entry, M.size / M.generals);
    for (let i = 0; i < M.generals - 1; i++) {
      const g = newChar(s, { name: names[i], role: 'general', realm: id, born: 1180 + i * 3, traits: i < 2 ? ['relentless', 'bold'] : ['bold'], skill: i < 2 ? 5 : 4 });
      newArmy(s, id, g, entry, M.size / M.generals);
    }
    if (old && s.realms[old]) {
      s.wars[key(id, old)] = { since: s.month };
      if (!provincesOf(s, old).length) fall(s, old, emit, `${s.realms[old].name} is swept away`);
    }
    emit('horde', `Riders from the east: Genghis Khan's Mongols pour into ${PROV[entry].name}`, { realms: [id, old].filter(Boolean), at: entry, chars: [khan] });
  }
}

function disasters(s, rng, emit) {
  const D = R.disasters;
  if (chance(rng, D.plague)) {
    const silk = PROVINCES.filter((p) => p.silk && s.provinces[p.id].owner);
    const p = pick(rng, silk);
    if (p && !s.provinces[p.id].plague) {
      s.provinces[p.id].plague = D.plagueMonths;
      emit('plague', `Plague breaks out in ${p.city}`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
    }
  }
  for (const P of PROVINCES) { // plague travels with the caravans
    if (s.provinces[P.id].plague === D.plagueMonths - 2) {
      for (const n of P.neighbors) if (!s.provinces[n].plague && chance(rng, PROV[n].silk ? D.spread.silk : D.spread.other)) {
        s.provinces[n].plague = D.plagueMonths;
        emit('plague', `The plague spreads to ${PROV[n].city}`, { at: n, realms: [s.provinces[n].owner].filter(Boolean) });
      }
    }
    if (s.provinces[P.id].plague > 0) for (const a of Object.values(s.armies)) if (a.at === P.id) a.size = round1(a.size * 0.95);
  }
  if (chance(rng, D.earthquake)) {
    const p = pick(rng, PROVINCES.filter((x) => ['hills', 'mountains'].includes(x.terrain)));
    s.provinces[p.id].walls = Math.max(0, s.provinces[p.id].walls - 1);
    s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 10);
    emit('earthquake', `An earthquake shakes ${p.city}; its walls crack`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
  }
  if (chance(rng, D.famine)) {
    const p = pick(rng, PROVINCES.filter((x) => s.provinces[x.id].owner));
    for (const id of [p.id, ...p.neighbors.filter(() => rng() < 0.5)]) s.provinces[id].famine = 6;
    emit('famine', `The harvest fails around ${p.city}: famine`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
  }
}

// ---------- power moves: once per reign ----------
export function powerMove(s, id, kind, rng, emit) {
  const r = s.realms[id], who = nameOf(s, r.ruler), mine = provincesOf(s, id);
  if (!R.power.includes(kind) || r.power || !mine.length) return false;
  if (kind === 'levy') {
    for (const a of armiesOf(s, id)) a.size = round1(a.size * 1.5);
    for (const p of mine) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 10);
    emit('power', `${who} of ${r.short} calls a Great Levy: every village sends its sons`, { realms: [id], chars: [r.ruler], power: kind });
  } else if (kind === 'walls') {
    const frontier = mine.filter((p) => p.neighbors.some((n) => s.provinces[n].owner !== id)).sort((a, b) => b.wealth - a.wealth)[0];
    for (const p of [s.provinces[r.capital], frontier && s.provinces[frontier.id]].filter(Boolean)) p.walls = Math.min(4, p.walls + 1);
    emit('power', `${who} of ${r.short} raises Mighty Walls around ${PROV[r.capital].city}${frontier ? ` and ${frontier.city}` : ''}`, { realms: [id], chars: [r.ruler], power: kind, at: r.capital });
  } else if (kind === 'bribe') {
    const t = mine.flatMap((p) => p.neighbors).filter((n) => s.provinces[n].owner !== id && s.provinces[n].loyalty < 55 && s.realms[s.provinces[n].owner]?.capital !== n).sort((a, b) => PROV[b].wealth - PROV[a].wealth)[0];
    if (!t || r.gold < 40) return false;
    r.gold -= 40;
    const old = s.provinces[t].owner;
    Object.assign(s.provinces[t], { owner: id, loyalty: 45, siege: null });
    emit('power', `${who} of ${r.short} bribes the governor of ${PROV[t].city}, who opens the gates${old ? ` to spite ${short(s, old)}` : ''}`, { realms: [id, old].filter(Boolean), chars: [r.ruler], power: kind, at: t });
    if (old && s.realms[old] && !provincesOf(s, old).length) fall(s, old, emit, `${s.realms[old].name} is no more`);
  } else if (kind === 'feast') {
    for (const p of mine) s.provinces[p.id].loyalty = Math.min(100, s.provinces[p.id].loyalty + 20);
    emit('power', `${who} of ${r.short} holds a Royal Feast: the people cheer their ruler`, { realms: [id], chars: [r.ruler], power: kind });
  } else if (kind === 'silktax') {
    const silk = mine.filter((p) => p.silk);
    if (!silk.length) return false;
    r.gold = round1(r.gold + 20 * silk.length);
    for (const p of silk) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 12);
    emit('power', `${who} of ${r.short} levies a Silk Tax on the caravans: ${20 * silk.length} gold, and angry merchants`, { realms: [id], chars: [r.ruler], power: kind });
  }
  r.power = kind;
  return true;
}

// ---------- rebels become kingdoms; armies without masters disband ----------
function settle(s, rng, emit) {
  for (const r of living(s)) {
    const n = provincesOf(s, r.id).length;
    if (!n && homeless(s, r.id)) continue; // a horde without a city still rides
    if (!n) { fall(s, r.id, emit, r.rebel ? `The ${r.name} is crushed` : `${r.name} is no more`); continue; }
    if (r.rebel && s.month - r.founded >= R.rebels.foundAfter && (n >= R.rebels.minProvinces || s.month - r.founded >= R.rebels.foundAfter * 2)) {
      const culture = cultureOf(r.capital), leader = s.chars[r.ruler];
      Object.assign(r, { rebel: false, name: kingdomName(culture, PROV[r.capital].name), short: PROV[r.capital].name, origin: 'founded', founded: s.month });
      if (leader) leader.title = titleFor(culture);
      s.record.founded++;
      emit('founded', `${leader?.name ?? 'The rebels'} proclaims the ${r.name}`, { realms: [r.id], at: r.capital, chars: [r.ruler] });
    }
  }
  for (const a of Object.values(s.armies)) if (a.size < R.armies.minSize / 2) disband(s, a);
  // Idle armies of one realm in one place join up under the better general.
  const camp = {};
  for (const a of Object.values(s.armies)) {
    if (a.mode !== 'idle' || a.path.length) continue;
    const k = `${a.realm}@${a.at}`, b = camp[k];
    if (!b) { camp[k] = a; continue; }
    const [keep, go] = (s.chars[a.general]?.skill ?? 0) > (s.chars[b.general]?.skill ?? 0) ? [a, b] : [b, a];
    keep.size = round1(keep.size + go.size);
    if (go.general && s.chars[go.general]) s.chars[go.general].army = null;
    delete s.armies[go.id];
    camp[k] = keep;
  }
}

// ---------- the end of an age ----------
function ageEnd(s, emit) {
  const counts = living(s).map((r) => {
    const own = provincesOf(s, r.id).length;
    return [r.id, own, own + living(s).filter((v) => v.overlord === r.id).reduce((t, v) => t + provincesOf(s, v.id).length, 0)];
  }).sort((a, b) => b[1] - a[1]);
  const [top, n, withVassals] = counts[0] ?? [null, 0, 0];
  if (n >= PROVINCES.length * R.unite.alone || withVassals >= PROVINCES.length * R.unite.withVassals) return end(s, top, `${s.realms[top].name} unites the Silk Road`, emit);
  if (s.month >= R.months) return end(s, top, `The age ends in ${yearOf(s.month)}; the ${s.realms[top].name} stands tallest, with ${n} provinces`, emit);
}

function end(s, winner, reason, emit) {
  Object.assign(s, { status: 'ended', winner, endReason: reason });
  emit('age.ended', reason, { realms: [winner] });
}

// ---------- what the map shows: one compact frame per month ----------
export function frame(s) {
  return {
    m: s.month,
    owner: PROVINCES.map((p) => s.provinces[p.id].owner),
    loyalty: PROVINCES.map((p) => Math.round(s.provinces[p.id].loyalty)),
    armies: Object.values(s.armies).map((a) => [a.id, a.realm, a.at, Math.round(a.size * 10) / 10, a.path[0] ?? null, a.general ? s.chars[a.general]?.name ?? null : null, a.mode]),
    sieges: PROVINCES.filter((p) => s.provinces[p.id].siege).map((p) => [p.id, s.provinces[p.id].siege.realm, s.provinces[p.id].siege.left]),
    marks: PROVINCES.filter((p) => s.provinces[p.id].plague || s.provinces[p.id].ravaged || s.provinces[p.id].famine).map((p) => [p.id, s.provinces[p.id].plague ? 'plague' : s.provinces[p.id].famine ? 'famine' : 'ravaged']),
    groups: Object.values(s.groups).map((g) => [g.id, g.kind, g.at]),
  };
}
