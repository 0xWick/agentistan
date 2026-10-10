// The world, month by month. Pure: no I/O, no clock. Every random draw comes from rngFor(age, month, ...), so any
// month can be replayed exactly from the same state and the same inputs. Decisions come in three ways, all checked
// by the same rules: the brain (doctrine.js, or the AI later), and inputs (players, AI answers, AI plans).
import { RULES as R } from './rules.js';
import { PROVINCES, PROV, LAND, placeOf, yearLabel, rngFor, living, provincesOf, armiesOf, armiesChanged, realmsChanged, setOwner, key, newChar, newArmy, round1, clamp, dateText, yearOf, ofR, vb, cityOf, word, baseWealth, allied } from './core.js';
import { economy, prosperity, incomeOf, suppliesOf, strength, prosperityOf, wealthOf } from './economy.js';
import { march, battles, sieges, weatherToll, fall, homeless } from './war.js';
import { court, settleDecisions, setupCourt } from './court.js';
import { people } from './people.js';
import { world, realSkies } from './world.js';
import { act, applyAnswers, treaty } from './acts.js';
import { thrones, attendance, absence, matters, absorb, QUARTER } from './players.js';
import { resourcesFor } from './resources.js';
export { QUARTER, isPlayer } from './players.js';
import { cultureOf, personName, kingdomName, titleFor, pickTemper, temperFromTraits, isWomanName } from './names.js';
import AGE_1200 from './ages/1200.js';
import AGE_ANCIENT from './ages/ancient.js';
import AGE_MODERN from './ages/modern.js';

export const AGES = { 1200: AGE_1200, ancient: AGE_ANCIENT, modern: AGE_MODERN };
export const ENGINE = 8; // bump when a change to the rules would make old records replay differently
export * from './core.js';
export { wealthOf, yieldOf, suppliesOf, yearlyGrain, rations, cavalryOf, garrisonOf, wallPower, strength, manpower, incomeOf, prosperityOf, steersman, rulingTemper, knows, canBuild, tradeOpen, treatiesOf, pairTreaties } from './economy.js';
export { moveCost, route, declareWar, makePeace, peaceTerms, capture, conflictOf } from './war.js';
export { die, hire, ask } from './court.js';
export { act, ACTS, claimsOf, acceptsPeace, acceptsAlliance, powerMove } from './acts.js';
export { INVENTIONS, fortuneOf } from './world.js';
// A year's line in the ledger: every realm's land, strength, gold and prosperity.
export const ledgerOf = (s) => Object.fromEntries(living(s).map((r) => [r.id, [provincesOf(s, r.id).length, Math.round(strength(s, r.id)), Math.round(r.gold), Math.round(prosperityOf(s, r.id))]]));
export const REALM_DATA = Object.fromEntries(AGE_1200.realms.map((r) => [r.id, r]));

// ---------- the world at the start of an age ----------
export function newAge(age = 1, ageId = '1200') {
  const pack = AGES[ageId];
  const rng = rngFor('age', age, 'setup');
  const s = {
    // v3: the court has its affairs (an age begun before keeps its own rules)
    v: 3, age, ageId, startYear: pack.start, months: pack.months, month: 0, nextId: 1, status: 'running', winner: null, endReason: null,
    provinces: {}, realms: {}, chars: {}, armies: {}, groups: {}, wars: {}, allies: {}, truces: {}, conflicts: {}, battles: {}, treaties: {}, deeds: {}, kin: {},
    pending: [], answers: [], players: {}, roads: pack.roads, inventions: pack.inventions, names: pack.names ?? null, cultures: pack.cultures ?? null, words: pack.words ?? null, mods: pack.mods ?? null, wealth: pack.wealth ?? null, resources: resourcesFor(pack), tactics: pack.tactics ?? null, trade: {},
    record: { genghis: null, founded: 0, fallen: 0, assassinations: 0, battles: 0, captures: 0, revolts: 0, splits: 0, unions: 0 },
  };
  const female = new Set(pack.female ?? []);
  for (const p of PROVINCES) {
    const o = pack.provinces?.[p.id] ?? {};
    const owner = o.owner !== undefined ? o.owner : pack.provinces ? null : p.owner ?? null; // an age that names its owners leaves the rest free
    s.provinces[p.id] = { owner, loyalty: p.loyalty ?? (owner ? 62 : 55), walls: o.walls ?? p.walls, conquered: 0, ravaged: 0, plague: 0, famine: 0, siege: null, prosperity: R.prosperity.start + (baseWealth(s, p.id) - 3) * 3, works: {}, building: null };
    s.deeds[p.id] = owner ? [{ realm: owner, m: 0, how: 'start' }] : [];
  }
  for (const r of pack.realms) {
    const P = pack.people?.[r.id] ?? {};
    s.realms[r.id] = {
      id: r.id, name: r.name, short: r.short, plural: !!r.plural, color: r.color, capital: r.capital, ai: !!r.ai, nomad: !!r.nomad, agents: !!r.agents, overlord: r.overlord ?? null,
      gold: 0, tax: 'normal', ruler: null, heir: null, power: null, origin: 'historic', founded: 0, fallen: false, plan: null, culture: cultureOf(r.capital, s), fa: r.fa, elective: !!r.elective,
      seats: r.seats ?? null, rep: R.reputation.start, known: Object.entries(pack.known ?? {}).filter(([, who]) => who.includes(r.id)).map(([k]) => k), learning: 0, fortune: [], golden: null, reforms: [], regent: null, vizier: null,
    };
    const realm = s.realms[r.id];
    // Where the chronicles have lost a name, the world gives one from the region's customs (marked as invented).
    const named = (c) => (c.name.startsWith('the ') ? { ...c, name: personName(rng, realm.culture, usedNames(s)), invented: true } : c);
    Object.assign(realm, { dynasty: r.dynasty ?? r.short, lineage: (r.lineage ?? []).map((l) => ({ name: l.name, title: r.ruler.title, since: l.since, until: l.until, cause: null })) });
    const ruler = named(r.ruler);
    realm.ruler = newChar(s, { ...ruler, role: 'ruler', realm: r.id, skill: r.ruler.skill ?? 3, family: realm.dynasty, female: female.has(ruler.name), temper: P.ruler ?? temperFromTraits(r.ruler.traits, rng), culture: realm.culture, famous: !ruler.invented });
    s.chars[realm.ruler].landAtStart = 0;
    if (r.heir) realm.heir = newChar(s, { ...r.heir, role: 'heir', realm: r.id, skill: 3, family: realm.dynasty, parent: s.chars[realm.ruler].name, female: female.has(r.heir.name), temper: P.heir ?? temperFromTraits(r.heir.traits, rng), culture: realm.culture, famous: true });
    for (const c of r.court ?? []) newChar(s, { ...c, role: 'courtier', title: c.role.replace(/^./, (x) => x.toUpperCase()), realm: r.id, skill: 3, family: r.dynasty, female: female.has(c.name), temper: 'schemer', culture: realm.culture, famous: true });
    const wealth = PROVINCES.filter((p) => s.provinces[p.id].owner === r.id).reduce((t, p) => t + baseWealth(s, p.id), 0) * (r.levy ?? (r.nomad ? R.economy.nomad.levy : 1));
    const generals = r.generals.length ? r.generals : r.agents ? [] : [{ name: personName(rng, realm.culture, usedNames(s)), invented: true, skill: 2, traits: [], at: r.capital }];
    for (const g0 of generals) {
      const g = named(g0);
      const heirGeneral = g.heir && realm.heir && s.chars[realm.heir].name === g.name;
      const gid = heirGeneral ? realm.heir : newChar(s, { name: g.name, title: g.title, role: 'general', realm: r.id, born: g.born ?? pack.start - 50 + Math.floor(rng() * 30), traits: g.traits, skill: g.skill, invented: g.invented, temper: P.generals?.[g.name] ?? pickTemper(rng, R.temper.general), culture: realm.culture, famous: !g.invented });
      if (heirGeneral) s.chars[gid].skill = g.skill;
      const at = s.provinces[g.at]?.owner === r.id ? g.at : r.capital;
      newArmy(s, r.id, gid, at, Math.max(R.armies.minSize, round1((R.armies.startPerWealth * wealth) / generals.length)));
    }
  }
  for (const r of living(s)) {
    r.gold = round1(incomeOf(s, r.id) * R.economy.startGold);
    let grain = 0;
    for (let m = 0; m < 12; m++) grain += suppliesOf(s, r.id, m).grain;
    const y = suppliesOf(s, r.id);
    Object.assign(r, { grain: round1((grain / 12) * R.supply.start), horses: round1(y.horses * R.supply.start), iron: round1(y.iron * R.supply.start) });
    s.chars[r.ruler].landAtStart = provincesOf(s, r.id).length;
  }
  setupCourt(s, rng, pack.people ?? {});
  for (const r of living(s)) {
    const ruler = s.chars[r.ruler], main = [...armiesOf(s, r.id)].sort((a, b) => b.size - a.size)[0];
    if (main && R.temper.ruler[ruler.temper]?.leads && ruler.born <= pack.start - 15) { // a conqueror rides at the head of the main army
      if (main.general && s.chars[main.general]) s.chars[main.general].army = null;
      main.general = ruler.id;
      ruler.army = main.id;
    }
    if (r.overlord) treaty(s, 'vassal', [r.id, r.overlord], { name: `Submission of ${cityOf(s, r.capital)}` });
  }
  pack.setup?.(s, rng);
  // The quarrels already under way when the age begins, and the alliances.
  for (const [a, b, cause] of pack.wars ?? []) {
    if (!s.realms[a] || !s.realms[b]) continue;
    const cid = `w${s.nextId++}`;
    s.conflicts[cid] = { id: cid, name: `The war of ${ofR(s, a)} and ${ofR(s, b)}`, cause: cause ?? 'history', why: cause === 'steppe' ? 'A war for the mastery of the steppe' : 'A quarrel already under way when the age began', by: a, vs: b, side: { [a]: 'a', [b]: 'b' },
      since: 0, ended: null, outcome: null, log: [], gains: {}, deaths: [], battles: 0, score: { a: 0, b: 0 }, treaty: null, place: null, peak: { a: 0, b: 0 } };
    s.wars[key(a, b)] = { since: 0, conflict: cid };
  }
  for (const [a, b] of pack.allies ?? []) if (s.realms[a] && s.realms[b]) {
    s.allies[key(a, b)] = { since: 0 };
    treaty(s, 'alliance', [a, b], { name: `Alliance of ${cityOf(s, s.realms[a].capital)}` });
  }
  return s;
}
const usedNames = (s) => new Set(Object.values(s.chars).map((c) => c.name));

// ---------- one month ----------
// brain: { planFor(s, id, rng), ordersFor(s, id, rng), decide(s, decision, rng) } (doctrine.js by default).
// inputs: { answers: { decisionId: choice | { choice, say } }, acts: { realmId: [act] }, plans: { realmId: partial plan } }
// inPlace: change s0 itself (the server and the page keep no use for the month before; it saves copying a large state).
export function tick(s0, brain, inputs = {}, { inPlace = false } = {}) {
  const s = inPlace ? s0 : structuredClone(s0);
  const events = [];
  const emit = (type, text, data = {}) => events.push({ type, month: s.month, date: dateText(s.month, s), text, ...data });
  if (s.status !== 'running') return { state: s, events };
  const rng = (step) => rngFor('age', s.age, 'month', s.month, step);

  for (const [id, p] of Object.entries(inputs.personas ?? {})) if (s.chars[id]) s.chars[id].persona = p; // written by the AI cast
  if (inputs.skies) realSkies(s, inputs.skies, emit);
  if (s.month === 0) emit('age.started', `The year ${yearLabel(yearOf(0, s))}. ${living(s).length} realms share ${word(s, 'world', 'the Old World')}.`);
  thrones(s, inputs, rng('throne'), emit); // players seize thrones and leave them
  attendance(s, inputs); // who came to the council this quarter
  settleDecisions(s, inputs, brain, rng('decide'), emit);
  applyAnswers(s, rng('answers'), emit);
  plans(s, rng('plan'), emit, brain, inputs);
  economy(s, emit);
  for (const r of living(s)) brain.ordersFor(s, r.id, rng(`orders:${r.id}`));
  march(s, rng('march'), emit);
  battles(s, rng('battles'), emit);
  sieges(s, rng('siege'), emit);
  weatherToll(s, emit);
  prosperity(s);
  people(s, rng('people'), emit);
  court(s, rng('court'), emit);
  absorb(s, rng('absorb'), emit);
  absence(s, rng('absence'), emit);
  AGES[s.ageId]?.month?.(s, rng, emit);
  world(s, rng('world'), emit);
  settle(s, rng('settle'), emit);
  if ((s.month + 1) % QUARTER === 0) matters(s, rng('matters')); // for the next council

  s.month++;
  if (s.status === 'running') ageEnd(s, emit);
  return { state: s, events };
}

// ---------- plans: what each ruler means to do, and the acts that follow ----------
function plans(s, rng, emit, brain, inputs) {
  for (const r of living(s)) {
    if (!r.plan || r.plan.until <= s.month) r.plan = brain.planFor(s, r.id, rng);
    if (inputs.plans?.[r.id]) Object.assign(r.plan, inputs.plans[r.id], { by: inputs.plans[r.id].by ?? 'ai' }); // the AI or a player sets the course
    if (inputs.plans?.[r.id]?.by === 'player' && s.players?.[r.id] && inputs.plans[r.id].tax) s.players[r.id].tax = inputs.plans[r.id].tax; // a player's taxes stand until he changes them
    const p = r.plan;
    if (s.players?.[r.id]?.tax) p.tax = s.players[r.id].tax;
    r.tax = r.charter > s.month && p.tax === 'high' ? 'normal' : p.tax ?? 'normal';
    if (s.players?.[r.id] && !s.players[r.id].missed) p.acts = []; // a ruler at his council makes his own moves
    const todo = [...(p.acts ?? []), ...(inputs.acts?.[r.id] ?? [])];
    p.acts = [];
    for (const a of todo) act(s, r.id, a, rng, emit);
  }
}

// ---------- rebels become kingdoms; armies without masters disband ----------
function settle(s, rng, emit) {
  for (const r of living(s)) {
    const n = provincesOf(s, r.id).length;
    if (!n && homeless(s, r.id)) continue; // a horde without a city still rides
    if (!n) { fall(s, r.id, emit, r.rebel ? `The ${r.name} is crushed` : `${r.name} ${vb(s, r.id, 'is')} no more`); continue; }
    if (r.rebel && s.month - r.founded >= R.rebels.foundAfter && (n >= R.rebels.minProvinces || s.month - r.founded >= R.rebels.foundAfter * 2)) {
      const culture = cultureOf(r.capital, s), leader = s.chars[r.ruler];
      Object.assign(r, { rebel: false, plural: false, name: kingdomName(culture, placeOf(s, r.capital)), short: placeOf(s, r.capital), origin: 'founded', founded: s.month });
      if (leader) Object.assign(leader, { title: titleFor(culture), landAtStart: n });
      s.record.founded++;
      emit('founded', `${leader?.name ?? 'The rebels'} proclaims the ${r.name}`, { realms: [r.id], at: r.capital, chars: [r.ruler] });
    }
  }
  for (const a of Object.values(s.armies)) if (a.size < R.armies.minSize / 2 && !a.battle) {
    if (a.general && s.chars[a.general]) s.chars[a.general].army = null;
    for (const p of Object.values(s.provinces)) if (p.siege?.army === a.id) p.siege = null;
    delete s.armies[a.id];
    armiesChanged(s);
  }
  // Idle armies of one realm in one place join up under the better general.
  const camp = {};
  for (const a of Object.values(s.armies)) {
    if (a.mode !== 'idle' || a.path.length || a.battle) continue;
    const k = `${a.realm}@${a.at}`, b = camp[k];
    if (!b) { camp[k] = a; continue; }
    const ga = s.chars[a.general], gb = s.chars[b.general];
    const rank = (g) => (g?.role === 'ruler' ? 10 : g?.role === 'heir' ? 8 : 0) + (g?.skill ?? 0);
    const [keep, go] = rank(ga) > rank(gb) ? [a, b] : [b, a];
    keep.size = round1(keep.size + go.size);
    if (go.general && s.chars[go.general]) s.chars[go.general].army = null;
    delete s.armies[go.id];
    armiesChanged(s);
    camp[k] = keep;
  }
}

// ---------- the end of an age ----------
// Hegemony: one power with its client states holds half the world's land or wealth, and no great power stands apart.
export function hegemon(s) {
  const all = living(s), H = R.hegemony;
  const bloc = (id) => [id, ...all.filter((v) => v.overlord === id).map((v) => v.id)];
  const landOf = (ids) => ids.reduce((t, id) => t + provincesOf(s, id).length, 0);
  const goldOf = (ids) => ids.reduce((t, id) => t + provincesOf(s, id).reduce((u, p) => u + wealthOf(s, p.id), 0), 0);
  const free = all.filter((r) => !r.overlord), blocs = free.map((r) => ({ id: r.id, ids: bloc(r.id) })).map((b) => ({ ...b, land: landOf(b.ids) })).sort((a, b) => b.land - a.land);
  const lead = blocs[0];
  if (!lead) return null;
  const share = lead.land / PROVINCES.length, wealth = goldOf(lead.ids) / Math.max(1, goldOf(all.map((r) => r.id)));
  if (share < H.share && wealth < H.share) return null;
  const rival = blocs.slice(1).find((b) => b.land >= Math.max(H.rivalMin, lead.land * H.rival));
  return rival ? null : { id: lead.id, share, wealth };
}
function ageEnd(s, emit) {
  if (s.rule === 'hegemony') {
    const h = hegemon(s);
    if (h) return end(s, h.id, `${ofR(s, h.id).replace(/^./, (c) => c.toUpperCase())} ${vb(s, h.id, 'masters')} the world: with ${s.realms[h.id].plural ? 'their' : 'its'} client states, ${Math.round(Math.max(h.share, h.wealth) * 100)}% of the ${h.share >= h.wealth ? 'land' : 'wealth'} bows to ${s.realms[h.id].plural ? 'them' : 'it'}, and no great power stands apart`, emit);
    if (s.month >= (s.months ?? R.hegemony.cap)) { // the safety cap: the strongest coalition is the victor
      const top = living(s).filter((r) => !r.overlord).map((r) => [r.id, strength(s, r.id) + living(s).filter((o) => allied(s, r.id, o.id) || o.overlord === r.id).reduce((t, o) => t + strength(s, o.id), 0)]).sort((a, b) => b[1] - a[1])[0]?.[0];
      return end(s, top, `After ${Math.round(s.month / 12)} years no power masters the world; ${ofR(s, top)} and ${s.realms[top]?.plural ? 'their' : 'its'} friends stand strongest as the era closes`, emit);
    }
    return;
  }
  const counts = living(s).map((r) => {
    const own = provincesOf(s, r.id).length;
    return [r.id, own, own + living(s).filter((v) => v.overlord === r.id).reduce((t, v) => t + provincesOf(s, v.id).length, 0)];
  }).sort((a, b) => b[1] - a[1]);
  const [top, n, withVassals] = counts[0] ?? [null, 0, 0];
  const months = s.months ?? R.months;
  if (n >= PROVINCES.length * R.unite.alone || withVassals >= PROVINCES.length * R.unite.withVassals) return end(s, top, `${s.realms[top].name} unites the Old World`, emit);
  if (s.month >= months) return end(s, top, `The age ends in ${yearLabel(yearOf(s.month, s))}; ${ofR(s, top)} ${vb(s, top, 'stands')} tallest, with ${n} provinces`, emit);
}

function end(s, winner, reason, emit) {
  Object.assign(s, { status: 'ended', winner, endReason: reason });
  emit('age.ended', reason, { realms: [winner] });
}

// ---------- the events worth stopping the story for (the page's cards, the server's heralds) ----------
export function isGreat(e, st) {
  if (['founded', 'fallen', 'split', 'coup', 'slump', 'horde', 'golden', 'charter', 'commune', 'uprising', 'turncoat', 'separatist', 'defied', 'age.ended'].includes(e.type)) return true;
  if (e.type === 'capture' && e.capital) return true;
  if (e.type === 'death' && e.ruler && (e.cause !== 'age' || rankOf(st, e.realms?.[0]) < 8)) return true;
  if (e.type === 'battle' && (e.lost?.[0] ?? 0) + (e.lost?.[1] ?? 0) >= 14) return true;
  if (e.type === 'invention' && e.first) return true;
  if (['famine', 'earthquake', 'flood'].includes(e.type) || (e.type === 'plague' && !e.minor)) return true;
  if (e.type === 'war' && /Frankish/.test(e.text)) return true;
  return false;
}
const rankOf = (st, id) => living(st).map((r) => [r.id, provincesOf(st, r.id).length]).sort((a, b) => b[1] - a[1]).findIndex(([x]) => x === id);

// ---------- what the map shows: one compact frame per month ----------
export function frame(s) {
  return {
    m: s.month,
    owner: PROVINCES.map((p) => s.provinces[p.id].owner),
    loyalty: PROVINCES.map((p) => Math.round(s.provinces[p.id].loyalty)),
    armies: Object.values(s.armies).map((a) => [a.id, a.realm, a.at, Math.round(a.size * 10) / 10, a.path[0] ?? null, a.general ? s.chars[a.general]?.name ?? null : null, a.mode]),
    sieges: PROVINCES.filter((p) => s.provinces[p.id].siege).map((p) => [p.id, s.provinces[p.id].siege.realm, s.provinces[p.id].siege.left]),
    battles: Object.values(s.battles).map((b) => [b.id, b.at, b.ra[0], b.rd[0], b.rounds]),
    marks: PROVINCES.filter((p) => s.provinces[p.id].plague || s.provinces[p.id].ravaged || s.provinces[p.id].famine).map((p) => [p.id, s.provinces[p.id].plague ? 'plague' : s.provinces[p.id].famine ? 'famine' : 'ravaged']),
    groups: Object.values(s.groups).map((g) => [g.id, g.kind, g.at]),
  };
}
