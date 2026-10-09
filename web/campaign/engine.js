// The campaign engine: one historical war, turn by turn. Pure (no I/O, no clock): the same campaign, seed and inputs
// give the same war in the browser, on the server and in Node, so the server checks every turn by replaying it and
// anyone can replay a finished campaign from its record.
//
// A turn: the cards → the AI's plans → orders → marching → battles → sieges → money → attrition → will to fight →
// history's own moves → the goal. Inputs for a turn: { orders: { army: { to, plan, storm } }, raise: { army: men },
// cards: { card: option }, peace: { side: 'offer' | 'accept' | 'refuse' }, ai: { side: { stance, target, peace, say } } }.
export const ENGINE = 3; // bump when a change would make an old record replay differently: older runs are then closed

// ---------- randomness: a seeded stream per (seed, turn, step) ----------
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
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, k = 1) => Math.round(v / k) * k;
export const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

// ---------- the campaign, made ready: compact tuples become objects, the map's graph joins the provinces ----------
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const TEMPERS = {
  bold: { name: 'bold', odds: 1.0, lean: ['charge', 'envelop', 'blitz'] },
  rash: { name: 'rash', odds: 0.8, lean: ['charge'] },
  steady: { name: 'steady', odds: 1.3, lean: ['hold', 'dig', 'depth'] },
  cautious: { name: 'cautious', odds: 1.6, lean: ['hold', 'refuse', 'dig'] },
  delaying: { name: 'delaying', odds: 2.2, lean: ['refuse', 'hold'] },
  cunning: { name: 'cunning', odds: 1.1, lean: ['ambush', 'feint', 'envelop'] },
};
const READY = new WeakMap();
export function prepare(C, graph) {
  if (READY.has(C)) return READY.get(C);
  const G = graph?.provinces ? Object.fromEntries(graph.provinces.map((p) => [p.id, p])) : graph ?? {};
  const prov = {};
  for (const row of C.provinces) {
    const [id, name, lat, lon, owner = null, walls = 0, wealth = 1, extra = {}] = row;
    const g = G[id] ?? {};
    prov[id] = { id, name, lat, lon, owner, walls, wealth, ...extra, terrain: extra.terrain ?? g.terrain ?? 'plains', neighbors: g.neighbors ?? [], sea: g.sea ?? [], city: g.city, label: g.label, area: g.area ?? 0 };
  }
  const turns = C.turns.map((label, i) => {
    const season = SEASONS.find((x) => label.toLowerCase().startsWith(x)) ?? (/(january|february|december)/i.test(label) ? 'winter' : /(march|april|may)/i.test(label) ? 'spring' : /(june|july|august)/i.test(label) ? 'summer' : /(september|october|november)/i.test(label) ? 'autumn' : 'summer');
    return { i, label, season, history: C.meanwhile?.[i] ?? '' };
  });
  const sides = {};
  for (const [id, d] of Object.entries(C.sides)) sides[id] = { id, quality: 1, horse: 0.15, fleet: 0, levy: 10000, gold: 100, will: 70, income: 0, ai: 'steady', ...d };
  for (const d of Object.values(sides)) if (d.capital && prov[d.capital]) prov[d.capital].capital = d.id;
  const ready = { ...C, prov, turns, sides, ids: Object.keys(prov), plans: C.plans ?? ERA_PLANS[C.age ?? 'ancient'] };
  READY.set(C, ready);
  return ready;
}

// ---------- a new campaign ----------
export function newCampaign(C0, seed = 1) {
  const C = READY.get(C0) ?? C0;
  const s = {
    v: ENGINE, cid: C.id, seed, turn: 0, status: 'running', end: null, dead: [],
    sides: {}, prov: {}, armies: {}, rel: {}, flags: {}, cards: {}, done: {}, offers: {}, plans: {}, said: {},
    stats: { won: 0, great: 0, lost: 0, taken: 0, fallen: 0, killed: 0, dead: 0, start: 0, peak: 0 }, log: [], next: 1,
  };
  for (const [id, d] of Object.entries(C.sides)) s.sides[id] = { gold: d.gold, will: d.will, fleet: d.fleet, alive: true };
  for (const p of Object.values(C.prov)) s.prov[p.id] = { owner: p.owner, walls: p.walls, siege: 0, by: null, garrison: garrisonOf(p) };
  for (const [side, at, men, gen, skill = 3, extra = {}] of C.armies) spawn(s, side, at, men, gen, skill, extra);
  for (const [a, b] of C.wars ?? []) s.rel[key(a, b)] = 'war';
  for (const [a, b] of C.allies ?? []) s.rel[key(a, b)] = 'ally';
  s.stats.start = s.stats.peak = menOf(s, C.you);
  return s;
}
const garrisonOf = (p) => p.garrison ?? p.walls * 4000 * (p.capital ? 2 : 1);
function spawn(s, side, at, men, gen, skill = 3, extra = {}) {
  const id = extra.id ?? `a${s.next++}`;
  s.armies[id] = { id, side, at, men: Math.round(men), gen: gen ?? null, skill, morale: 70, from: at, ...extra };
  return s.armies[id];
}

// ---------- lookups ----------
export const relOf = (s, a, b) => (a === b ? 'self' : s.rel[key(a, b)] ?? 'peace');
export const atWar = (s, a, b) => relOf(s, a, b) === 'war';
export const friends = (s, a, b) => a === b || relOf(s, a, b) === 'ally';
export const armiesOf = (s, side) => Object.values(s.armies).filter((a) => a.side === side);
export const armiesAt = (s, at) => Object.values(s.armies).filter((a) => a.at === at);
export const menOf = (s, side) => armiesOf(s, side).reduce((t, a) => t + a.men, 0);
export const owned = (s, side) => Object.keys(s.prov).filter((id) => s.prov[id].owner === side);
export const heroOf = (s) => Object.values(s.armies).find((a) => a.hero);
// ---------- the people of the war: who leads each side now, who is dead, who sits in your council ----------
export const leaderOf = (C, s, side) => s.sides[side]?.leader ?? C.sides[side]?.leader ?? C.sides[side]?.name;
export const isDead = (s, name) => !!name && (s.dead ?? []).includes(name);
// Your council this season: the advisers history gives you at this time, if they are still alive, and the
// generals of your armies.
export function courtOf(C, s) {
  const list = (C.court ?? (C.advisor ? [C.advisor] : [])).filter((p) => (p.from === undefined || s.turn >= p.from) && (p.until === undefined || s.turn <= p.until) && !isDead(s, p.name));
  const gens = armiesOf(s, C.you).filter((a) => a.gen && !a.hero && !isDead(s, a.gen)).sort((a, b) => b.men - a.men) // the commander is the player: they do not advise themselves
    .map((a) => ({ id: `army:${a.id}`, name: a.gen, title: `commanding ${fmtMen(a.men)} at ${C.prov[a.at].name}`, look: C.hero.look, army: a.id }));
  return [...list.map((p) => ({ id: p.id ?? p.name, ...p })), ...gens.filter((g) => !list.some((p) => p.name === g.name))];
}
// Only people die: “the Argives” or “New levies” are not anyone.
const GENERIC = /^(the|an?|new)\b|\b(levies|chiefs|garrison|officers|men|warriors|army|militia|tribes|lords|besiegers|host|legions?|satraps|captains|survivors|column)\b/i;
export const isPerson = (n) => !!n && !GENERIC.test(n);
// “King Darius III” and “Darius III”, “Liu Biao, governor of Jing” and “Liu Biao”: the same man.
const bare = (n) => String(n ?? '').replace(/^(King|Queen|Emperor|Consul|General)\s+/i, '').split(/,| of | and /)[0].trim();
export const sameMan = (a, b) => !!a && !!b && bare(a) === bare(b);
// A death: the dead leave the story; their armies pass to a successor (or to the army's own officers), and a side
// they led passes to its heir.
function kill(C, s, name, successor, emit = () => {}) {
  if (!name || isDead(s, name)) return;
  s.dead.push(name);
  const [next, skill] = Array.isArray(successor) ? successor : [successor, null];
  for (const a of Object.values(s.armies)) {
    if (a.gen !== name) continue;
    a.gen = next ?? `the officers of ${C.sides[a.side].short ?? C.sides[a.side].name}`;
    if (skill) a.skill = skill;
  }
  for (const [id, st] of Object.entries(s.sides)) {
    if (!sameMan(leaderOf(C, s, id), name) || / and /.test(leaderOf(C, s, id))) continue;
    const heir = next ?? (C.sides[id].heirs ?? []).find((h) => !isDead(s, h));
    st.leader = heir ?? `the captains of ${C.sides[id].short ?? C.sides[id].name}`;
    if (!successor) emit({ type: 'story', text: `With ${name} dead, ${st.leader} ${heir ? 'leads' : 'lead'} ${C.sides[id].name}`, sides: [id] });
  }
}
export const turnOf = (C, s) => C.turns[Math.min(s.turn, C.turns.length - 1)];
const living = (s) => Object.keys(s.sides).filter((id) => s.sides[id].alive);
const enemiesOf = (s, side) => living(s).filter((o) => atWar(s, side, o));

// ---------- marching: how far, and by which way ----------
const COST = { mountains: 2, marsh: 2, forest: 1, hills: 1, plains: 1, river: 1, desert: 1, steppe: 1 };
function stepCost(C, s, side, from, to, season) {
  const P = C.prov[to];
  if (C.prov[from].sea.includes(to)) return s.sides[side].fleet > 0 || C.lanes?.open ? 99 : Infinity; // a crossing takes the whole turn
  let c = COST[P.terrain] ?? 1;
  if (season === 'winter' && P.terrain === 'mountains') c += 1;
  return c;
}
// Every province an army can reach this turn, with the way there. Armies stop where an enemy army stands.
export function reach(C, s, army) {
  const a = s.armies[army];
  if (!a) return {};
  const budget = a.speed ?? C.sides[a.side].speed ?? C.speed ?? 2, season = turnOf(C, s).season;
  const best = { [a.at]: { cost: 0, path: [a.at] } }, queue = [a.at];
  while (queue.length) {
    queue.sort((x, y) => best[x].cost - best[y].cost);
    const here = queue.shift(), { cost, path } = best[here];
    if (here !== a.at && armiesAt(s, here).some((o) => atWar(s, a.side, o.side))) continue; // a battle stops the march
    if (here !== a.at && C.prov[path[path.length - 2]]?.sea.includes(here)) continue; // landed from the sea
    for (const next of C.prov[here].neighbors) {
      const c = stepCost(C, s, a.side, here, next, season);
      const total = c === 99 ? (cost === 0 ? budget : Infinity) : cost + c;
      if (total > budget || (best[next] && best[next].cost <= total)) continue;
      if (s.prov[next].owner && !atWar(s, a.side, s.prov[next].owner) && !friends(s, a.side, s.prov[next].owner) && !C.prov[next].open) continue; // neutral land: not without war
      best[next] = { cost: total, path: [...path, next] };
      queue.push(next);
    }
  }
  delete best[a.at];
  return best;
}
// The shortest way between two provinces whatever the turn's budget (for the AI's longer marches).
export function wayTo(C, s, side, from, to) {
  if (from === to) return [from];
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const here = q.shift();
    for (const n of C.prov[here].neighbors) {
      if (n in prev) continue;
      if (C.prov[here].sea.includes(n) && !(s.sides[side].fleet > 0 || C.lanes?.open)) continue;
      const o = s.prov[n].owner;
      if (o && o !== side && !atWar(s, side, o) && !friends(s, side, o) && !C.prov[n].open && n !== to) continue;
      prev[n] = here;
      if (n === to) {
        const path = [n];
        while (prev[path[0]] !== null) path.unshift(prev[path[0]]);
        return path;
      }
      q.push(n);
    }
  }
  return null;
}

// ---------- battle plans: tactics from real battles, each fitting some ground, numbers and horse ----------
export const PLANS = {
  phalanx: { name: 'Strong wings, running charge', hint: 'Thin your centre, mass your wings and run the last stretch under their arrows: for heavy infantry against lighter troops', example: 'Marathon, Plataea', for: 'both' },
  charge: { name: 'Frontal charge', hint: 'Weight against weight: best with more men, on open ground', example: 'Gaugamela', for: 'both' },
  hold: { name: 'Hold the high ground', hint: 'Make them climb to you: for defenders in hills, mountains or forest', example: 'Hastings', for: 'defend' },
  narrows: { name: 'Hold the narrows', hint: 'A few can stop many in a pass or a strait: for a much smaller army defending mountains or a coast road', example: 'Thermopylae', for: 'defend' },
  envelop: { name: 'Double envelopment', hint: 'Let your centre give way and close the wings: for an army no bigger than theirs, with better horse, on open ground. Rash enemies walk into it', example: 'Cannae', for: 'both' },
  feint: { name: 'Feigned retreat', hint: 'Your horsemen flee, then turn on the pursuers: needs many horsemen and open ground; bold or rash enemies chase', example: 'Hastings, the Mongols at the Kalka', for: 'both' },
  ambush: { name: 'Ambush on the march', hint: 'Hide in forest, hills or mist and strike the column: for the attacker in rough country, best against a rash enemy', example: 'Lake Trasimene, the Teutoburg Forest', for: 'attack' },
  refuse: { name: 'Refuse battle', hint: 'Fall back and let hunger fight for you: the weaker side, on its own ground, keeps its army whole', example: 'Fabius against Hannibal', for: 'defend' },
  archers: { name: 'Archers behind stakes', hint: 'Let their horsemen charge into the arrows: for defenders with good archers, best in rain or mud', example: 'Agincourt', for: 'defend' },
  guns: { name: 'Guns, then the assault', hint: 'The cannon break the line or the walls first: needs gunpowder, best against walls', example: 'Constantinople, Panipat', for: 'attack' },
  corps: { name: 'Strike the hinge', hint: 'Fix them in front, march round, break the joint of their line: for a skilled general with an army as big as theirs', example: 'Austerlitz', for: 'both' },
  wagons: { name: 'The wagon fort', hint: 'Chain the war wagons into a fortress on a rise, with guns and flails inside, and let the knights break on it: for defenders who have the wagons', example: 'Vítkov Hill, Kutná Hora', for: 'defend' },
  dig: { name: 'Dig in', hint: 'Trenches and machine guns: for defenders, against any frontal attack', example: 'Verdun', for: 'defend' },
  barrage: { name: 'Barrage, then advance', hint: 'The guns first, then the infantry: for the attacker with much artillery', example: 'the Somme', for: 'attack' },
  blitz: { name: 'Armour breaks through', hint: 'Tanks and aircraft punch a hole and race behind the lines: for the attacker on open ground', example: 'Sedan 1940', for: 'attack' },
  depth: { name: 'Defence in depth', hint: 'Give ground in belts of mines and guns, then counter-attack the flanks: for defenders with room to fall back', example: 'Kursk', for: 'defend' },
};
export const ERA_PLANS = {
  ancient: ['charge', 'phalanx', 'hold', 'narrows', 'envelop', 'feint', 'ambush', 'refuse'],
  medieval: ['charge', 'hold', 'feint', 'envelop', 'ambush', 'refuse', 'archers'],
  gunpowder: ['charge', 'hold', 'envelop', 'ambush', 'refuse', 'guns'],
  napoleonic: ['charge', 'hold', 'envelop', 'refuse', 'guns', 'corps'],
  modern: ['charge', 'dig', 'barrage', 'refuse', 'blitz', 'depth'],
};
const OPEN = ['plains', 'desert', 'steppe', 'river'], ROUGH = ['hills', 'mountains', 'forest', 'marsh'];
export function battleFacts(C, s, at, mine, theirs, defending) {
  const sum = (list) => list.reduce((t, a) => t + a.men, 0), horse = (list) => list.length ? list.reduce((t, a) => t + a.men * (C.sides[a.side].horse ?? 0.15), 0) / Math.max(1, sum(list)) : 0;
  const lead = (list) => [...list].sort((x, y) => y.men - x.men)[0];
  const foe = lead(theirs), P = C.prov[at];
  return {
    at, terrain: P.terrain, open: OPEN.includes(P.terrain), rough: ROUGH.includes(P.terrain) || !!P.narrows || !!P.lake,
    narrows: !!P.narrows, lake: !!P.lake, walls: s.prov[at]?.walls ?? 0, season: turnOf(C, s).season,
    ratio: sum(mine) / Math.max(1, sum(theirs)), men: sum(mine), foeMen: sum(theirs), horse: horse(mine), foeHorse: horse(theirs),
    defending, home: s.prov[at]?.owner === lead(mine)?.side || friends(s, lead(mine)?.side, s.prov[at]?.owner),
    skill: lead(mine)?.skill ?? 3, foeTemper: foe?.temper ?? (foe ? temperOf(C, s, foe.side) : 'steady'), foeGen: foe?.gen,
    tech: C.sides[lead(mine)?.side]?.tech ?? [],
    quality: C.sides[lead(mine)?.side]?.quality ?? 1, foeQuality: C.sides[foe?.side]?.quality ?? 1,
  };
}
export function fitOf(f, plan) {
  const rash = ['rash', 'bold'].includes(f.foeTemper);
  switch (plan) {
    case 'phalanx': return f.tech.includes('hoplites') ? (f.quality > f.foeQuality + 0.1 ? clamp(0.7 + (f.open ? 0.15 : 0), -1, 1) : 0.15) : -0.6;
    case 'charge': return clamp((f.ratio - 1.15) * 1.4 + (f.open ? 0.2 : f.rough ? -0.5 : 0), -1, 1);
    case 'hold': return f.defending ? (f.rough ? 0.75 : 0.05) : -1;
    case 'narrows': return f.defending && (f.narrows || f.terrain === 'mountains') ? (f.ratio < 0.8 ? 0.95 : 0.4) : -0.6;
    case 'envelop': return f.ratio < 0.45 ? -0.7 : f.ratio <= 1.25 && f.horse >= f.foeHorse && f.open ? clamp(0.75 + (rash ? 0.25 : 0), -1, 1) : -0.3;
    case 'feint': return f.horse >= 0.3 && f.open ? clamp(0.45 + (rash ? 0.35 : 0) + (f.horse - f.foeHorse), -1, 1) : -0.6;
    case 'ambush': return !f.defending && (f.rough || f.lake) && f.ratio >= 0.4 ? clamp(0.65 + (rash ? 0.3 : 0), -1, 1) : -0.5;
    case 'refuse': return f.defending && f.ratio < 1 ? 0.5 : -0.3;
    case 'archers': return f.defending ? clamp((f.tech.includes('longbow') ? 0.45 : 0.05) + (f.foeHorse >= 0.25 ? 0.3 : -0.15) + (['autumn', 'winter'].includes(f.season) ? 0.15 : 0), -1, 1) : -0.7;
    case 'guns': return f.tech.includes('guns') ? (f.walls ? 0.9 : 0.5) : -0.8;
    case 'corps': return f.skill >= 4 && f.ratio >= 0.7 ? clamp(0.5 + (f.skill - 4) * 0.3 + (rash ? 0.15 : 0), -1, 1) : -0.4;
    case 'wagons': return f.defending && f.tech.includes('wagons') ? clamp(0.85 + (f.foeHorse >= 0.25 ? 0.15 : 0), -1, 1) : -0.8;
    case 'dig': return f.defending ? (f.tech.includes('machineguns') ? 0.85 : 0.3) : -1;
    case 'barrage': return !f.defending && f.tech.includes('artillery') ? clamp(0.25 + (f.ratio - 1) * 0.5, -1, 1) : -0.6;
    case 'blitz': return !f.defending && f.tech.includes('tanks') && f.open ? clamp(0.85 + (f.foeTemper === 'cautious' ? 0.1 : 0), -1, 1) : -0.7;
    case 'depth': return f.defending && f.tech.includes('modern') ? (f.ratio < 1.1 ? 0.8 : 0.4) : -0.6;
  }
  return 0;
}
// The plans open to a side in a battle (three or four), and the general's own choice among them.
export function plansFor(C, defending) {
  return C.plans.filter((id) => PLANS[id].for === 'both' || PLANS[id].for === (defending ? 'defend' : 'attack'));
}
export function generalsPlan(C, f, gen, rng, without = []) {
  const lean = TEMPERS[gen?.temper ?? 'steady']?.lean ?? [];
  return plansFor(C, f.defending).filter((id) => !without.includes(id)).map((id) => ({ id, v: fitOf(f, id) + (lean.includes(id) ? 0.3 : 0) + (rng() - 0.5) * (6 - (gen?.skill ?? 3)) * 0.35 })).sort((a, b) => b.v - a.v)[0].id;
}
const planFactor = (fit, skill) => 1 + (fit > 0 ? 0.3 : 0.22) * fit * (0.7 + 0.1 * skill);
// Some plans undo others: a charge into an envelopment, a feigned retreat or a held hill breaks itself.
export const COUNTERS = { phalanx: ['charge', 'hold'], wagons: ['charge', 'feint', 'envelop'], envelop: ['charge'], feint: ['charge'], ambush: ['charge', 'hold'], hold: ['charge'], narrows: ['charge', 'envelop'], archers: ['charge', 'feint'], corps: ['charge', 'hold'], dig: ['charge', 'blitz'], depth: ['blitz', 'charge'], blitz: ['hold', 'charge'], barrage: ['dig'], guns: ['hold', 'charge'], refuse: [] };
const countered = (mine, theirs) => (COUNTERS[theirs] ?? []).includes(mine);

// The odds of a fight, as the player sees them before ordering it: the power of each side, without luck.
export function oddsOf(C, s, army, at) {
  const a = s.armies[army], foes = armiesAt(s, at).filter((o) => atWar(s, a.side, o.side));
  const mine = [a], f = battleFacts(C, s, at, mine, foes, false);
  if (!foes.length) {
    const p = s.prov[at];
    if (!p.owner || !atWar(s, a.side, p.owner) || !p.walls) return { kind: 'take', ratio: Infinity };
    if (C.prov[at].port && (s.sides[p.owner]?.fleet ?? 0) > 0 && (s.sides[p.owner]?.fleet ?? 0) >= (s.sides[a.side]?.fleet ?? 0)) return { kind: 'siege', turns: 99, fed: true, garrison: p.garrison, ratio: (a.men * (C.sides[a.side].quality ?? 1)) / Math.max(1, p.garrison * wallPower(p.walls) * (C.sides[p.owner]?.quality ?? 1)) };
    return { kind: 'siege', turns: Math.max(p.by === a.side ? 1 : 2, Math.ceil((p.walls - (p.by === a.side ? p.siege : 0)) / (a.men >= 4 * p.garrison ? 2 : 1))), garrison: p.garrison, ratio: (a.men * (C.sides[a.side].quality ?? 1)) / Math.max(1, p.garrison * wallPower(p.walls) * (C.sides[p.owner]?.quality ?? 1)) };
  }
  const best = Math.max(...plansFor(C, false).map((id) => fitOf(f, id)));
  const pow = (list, side, fit, defending) => list.reduce((t, x) => t + x.men * (C.sides[x.side].quality ?? 1) * (1 + 0.08 * (x.skill - 3)) * (0.6 + x.morale / 250), 0) * planFactor(fit, 3) * (defending ? groundOf(C, s, at) : 1);
  const ratio = pow(mine, a.side, best, false) / Math.max(1, pow(foes, foes[0].side, 0.3, true));
  return { kind: 'battle', ratio, foes: foes.map((x) => x.id), facts: f };
}
const groundOf = (C, s, at) => ({ hills: 1.15, mountains: 1.3, forest: 1.15, marsh: 1.2, river: 1.1 })[C.prov[at].terrain] ?? 1;

// ---------- effects: what a card's choice or history's move does ----------
export function applyFx(C, s, fx, side = C.you, emit = () => {}) {
  if (!fx) return;
  if (fx.chance !== undefined) { // a gamble: the war's own dice decide which way it goes
    const won = rngFor(s.seed, s.turn, 'chance', s.next++)() < fx.chance;
    if (won ? fx.win?.log : fx.lose?.log) emit({ type: won ? 'gamble.won' : 'gamble.lost', text: (won ? fx.win : fx.lose).log });
    return applyFx(C, s, won ? { ...fx.win, log: undefined } : { ...fx.lose, log: undefined }, side, emit);
  }
  const hero = heroOf(s);
  const target = (ref) => (ref === 'hero' ? hero : s.armies[ref] ?? armiesOf(s, side).sort((x, y) => y.men - x.men)[0]);
  if (fx.gold) s.sides[side].gold = Math.max(0, s.sides[side].gold + fx.gold);
  if (fx.will) s.sides[side].will = clamp(s.sides[side].will + fx.will, 0, 100);
  if (fx.ai && TEMPERS[fx.ai]) s.sides[side].ai = fx.ai;
  if (fx.leader) s.sides[side].leader = fx.leader;
  for (const name of [].concat(fx.kill ?? [])) kill(C, s, name, fx.succeed?.[name], emit);
  if (fx.target !== undefined) s.sides[side].target = fx.target;
  if (fx.fleet !== undefined) s.sides[side].fleet = Math.max(0, (typeof fx.fleet === 'number' && fx.fleet < 0 ? s.sides[side].fleet + fx.fleet : fx.fleet));
  if (fx.men) {
    const a = target(fx.army ?? 'hero') ?? target(null);
    if (a) a.men = Math.max(500, Math.round(Math.abs(fx.men) < 1 ? a.men * (1 + fx.men) : a.men + fx.men));
  }
  if (fx.morale) for (const a of armiesOf(s, side)) a.morale = clamp(a.morale + fx.morale, 10, 100);
  for (const [other, d] of Object.entries(fx.sides ?? {})) if (s.sides[other]) applyFx(C, s, d, other, emit);
  for (const sp of (Array.isArray(fx.spawn?.[0]) ? fx.spawn : fx.spawn ? [fx.spawn] : [])) {
    const [sd, at, men, gen, skill, extra] = sp;
    if (s.sides[sd]?.alive !== false) spawn(s, sd, at, men, gen, skill, extra ?? {});
  }
  for (const [p, to] of (Array.isArray(fx.give?.[0]) ? fx.give : fx.give ? [fx.give] : [])) if (s.prov[p]) s.prov[p].owner = to;
  for (const [ref, to] of (Array.isArray(fx.move?.[0]) ? fx.move : fx.move ? [fx.move] : [])) { const a = target(ref); if (a) { a.from = a.at; a.at = to; } }
  for (const [a, b, r] of (Array.isArray(fx.rel?.[0]) ? fx.rel : fx.rel ? [fx.rel] : [])) setRel(s, a, b, r, emit, C);
  for (const f of [].concat(fx.flag ?? [])) s.flags[f] = s.turn;
  for (const f of [].concat(fx.unflag ?? [])) delete s.flags[f];
  if (fx.remove) for (const id of [].concat(fx.remove)) { const a = s.armies[id]; if (a) delete s.armies[a.id]; }
  for (const id of [].concat(fx.free ?? [])) if (s.armies[id]) delete s.armies[id].stay;
  for (const [id, f] of Object.entries(fx.fort ?? {})) if (s.armies[id]) s.armies[id].fort = f; // dug in: siege lines, a fortified camp
  for (const [id, to] of Object.entries(fx.aim ?? {})) if (s.armies[id]) s.armies[id].target = to;
  if (fx.end) finish(C, s, fx.end, fx.why ?? '');
  if (fx.log) emit({ type: 'story', text: fx.log });
  if (typeof fx.then === 'function') fx.then(s, q(C, s), emit, { spawn: (...a) => spawn(s, ...a), C });
}
function setRel(s, a, b, r, emit, C) {
  if (!s.sides[a] || !s.sides[b] || a === b) return;
  const was = relOf(s, a, b);
  if (was === r) return;
  if (r === 'peace') delete s.rel[key(a, b)];
  else s.rel[key(a, b)] = r;
  if (r === 'war') emit({ type: 'war', text: `${C.sides[a].name} and ${C.sides[b].name} are at war`, sides: [a, b] });
  if (r === 'peace' && was === 'war') emit({ type: 'peace', text: `${C.sides[a].name} and ${C.sides[b].name} make peace`, sides: [a, b] });
  if (r === 'ally') emit({ type: 'alliance', text: `${C.sides[a].name} and ${C.sides[b].name} are allies`, sides: [a, b] });
}
// The helper a card's or an event's condition sees.
export function q(C, s) {
  return {
    turn: s.turn, season: turnOf(C, s).season, you: C.you,
    owns: (side, p) => s.prov[p]?.owner === side,
    ownsAll: (side, ps) => ps.every((p) => s.prov[p]?.owner === side),
    count: (side, ps) => (ps ?? Object.keys(s.prov)).filter((p) => s.prov[p]?.owner === side).length,
    flag: (f) => f in s.flags,
    card: (id) => s.cards[id],
    at: (side, p) => armiesAt(s, p).some((a) => a.side === side),
    men: (side) => menOf(s, side),
    will: (side) => s.sides[side]?.will ?? 0,
    gold: (side) => s.sides[side]?.gold ?? 0,
    war: (a, b) => atWar(s, a, b),
    ally: (a, b) => relOf(s, a, b) === 'ally',
    alive: (side) => !!s.sides[side]?.alive,
    won: () => s.stats.won,
    great: () => s.stats.great,
    army: (id) => s.armies[id],
    near: (side, p) => armiesAt(s, p).some((a) => a.side === side) || C.prov[p].neighbors.some((n) => armiesAt(s, n).some((a) => a.side === side)),
    neighbors: (p) => C.prov[p]?.neighbors ?? [],
    lost: () => s.stats.lost,
    hero: () => heroOf(s),
    living: (name) => !isDead(s, name),
    armies: (side) => armiesOf(s, side),
  };
}

// ---------- what the player must decide this turn ----------
const due = (x, s, C, done) => !(x.id in done) && (x.at === undefined || x.at === s.turn) && (x.from === undefined || s.turn >= x.from) && (x.until === undefined || s.turn <= x.until) && (!x.if || x.if(q(C, s)));
export function cardsDue(C, s) {
  const out = (C.cards ?? []).filter((c) => due(c, s, C, s.cards));
  for (const [side, o] of Object.entries(s.offers)) if (o.turn === s.turn && o.to === C.you) out.push(peaceCard(C, s, side));
  return out;
}
function peaceCard(C, s, side) {
  const goal = C.goal.kind === 'peace' && C.goal.foe === side;
  return { id: `peace:${side}`, peace: side, title: `${C.sides[side].name} asks for peace`, art: 'peace',
    text: `${C.sides[side].leader ?? C.sides[side].name} has had enough of this war: ${C.sides[side].name}'s will to fight is ${Math.round(s.sides[side].will)} of 100. ${goal ? 'This is the peace you came for.' : 'Peace would free your armies for your other wars.'}`,
    options: [{ label: 'Accept the peace', fx: {} }, { label: 'Fight on', fx: { will: -2 } }], advise: goal ? 0 : s.sides[C.you].will < 40 ? 0 : 1 };
}

// ---------- the AI's plans, by the rules (the server may send the AI's own) ----------
export const temperOf = (C, s, side) => s.sides[side]?.ai ?? C.sides[side]?.ai ?? 'steady';
export function rulesPlan(C, s, side) {
  const d = { ...C.sides[side], target: s.sides[side].target ?? C.sides[side].target }, t = temperOf(C, s, side), foes = enemiesOf(s, side);
  if (!foes.length) return { stance: 'defend', target: null, peace: false, by: 'rules' };
  const ours = menOf(s, side), theirs = foes.reduce((t2, f) => t2 + menOf(s, f), 0);
  const stance = t === 'delaying' ? 'delay' : (t === 'cautious' && ours < theirs * 1.3) || (t === 'steady' && ours < theirs * 0.8) ? 'defend' : 'attack';
  const targets = foes.flatMap((f) => owned(s, f)).sort((a, b) => (C.prov[b].wealth + (C.sides[s.prov[b].owner]?.capital === b ? 6 : 0)) - (C.prov[a].wealth + (C.sides[s.prov[a].owner]?.capital === a ? 6 : 0)));
  const home = C.sides[side].capital, from = armiesOf(s, side).filter((a) => !a.stay).sort((a, b) => b.men - a.men)[0]?.at ?? home;
  // an enemy army in our lands or on their border, or near our capital, comes first
  const mine = new Set(owned(s, side));
  const invader = Object.values(s.armies).filter((a) => atWar(s, side, a.side) && (mine.has(a.at) || C.prov[a.at].neighbors.some((n) => mine.has(n) && !C.prov[a.at].sea.includes(n)) || (home && (wayTo(C, s, a.side, a.at, home)?.length ?? 99) <= 3))).sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || b.men - a.men)[0];
  if (invader && stance !== 'delay') return { stance, target: invader.at, peace: s.sides[side].will < 25, by: 'rules' };
  const near = targets.map((p) => [p, wayTo(C, s, side, from, p)?.length ?? 99]).sort((a, b) => a[1] - b[1] || C.prov[b[0]].wealth - C.prov[a[0]].wealth);
  return { stance, target: (d.target && s.prov[d.target]?.owner !== side ? d.target : near[0]?.[0]) ?? null, peace: s.sides[side].will < 25, by: 'rules' };
}
// Turn a side's plan into orders for each of its armies.
function aiOrders(C, s, side, plan, rng) {
  const orders = {}, t = TEMPERS[temperOf(C, s, side)] ?? TEMPERS.steady, home = C.sides[side].capital;
  const foes = Object.values(s.armies).filter((a) => atWar(s, side, a.side));
  const threat = home && foes.find((f) => (wayTo(C, s, f.side, f.at, home)?.length ?? 99) <= 3);
  const list = armiesOf(s, side).sort((a, b) => b.men - a.men);
  list.forEach((a, i) => {
    if (a.stay) return void (orders[a.id] = { to: null });
    const r = reach(C, s, a.id), opts = Object.keys(r);
    const fights = opts.map((p) => [p, oddsOf(C, s, a.id, p)]).filter(([, o]) => o.kind === 'battle');
    const own = TEMPERS[a.temper]?.odds ?? t.odds; // a rash general fights whatever his masters say
    const bar = a.temper === 'rash' ? own : plan.stance === 'delay' ? 2.2 : plan.stance === 'defend' ? Math.max(own, 1.4) : own;
    const good = fights.filter(([, o]) => o.ratio >= bar).sort((x, y) => y[1].ratio - x[1].ratio)[0];
    if (good) return void (orders[a.id] = { to: good[0] });
    // in danger where it stands: fall back toward home, or to rough ground
    const here = armiesAt(s, a.at).length, hereFoes = foes.filter((f) => reach(C, s, f.id)[a.at]);
    const danger = hereFoes.reduce((t2, f) => t2 + f.men * (C.sides[f.side].quality ?? 1), 0) > a.men * (C.sides[side].quality ?? 1) * groundOf(C, s, a.at) * (s.prov[a.at].owner === side && s.prov[a.at].walls ? 1.6 : 1) * (plan.stance === 'attack' ? 1.4 : 1.1);
    if (danger && here) {
      const safe = opts.filter((p) => !foes.some((f) => reach(C, s, f.id)[p]) && (s.prov[p].owner === side || friends(s, side, s.prov[p].owner)));
      if (safe.length) return void (orders[a.id] = { to: safe.sort((x, y) => groundOf(C, s, y) - groundOf(C, s, x) + (s.prov[y].walls - s.prov[x].walls))[0] });
    }
    // a besieged capital calls every army within reach home to relieve it
    const besieged = home && s.prov[home].owner === side && armiesAt(s, home).some((o) => atWar(s, side, o.side));
    if (besieged && (wayTo(C, s, side, a.at, home)?.length ?? 99) <= 5) return void (orders[a.id] = { to: stepToward(C, s, a, home) ?? null });
    // the capital is never left bare while an enemy is near: the nearest army goes home
    if (threat && home && s.prov[home].owner === side && !armiesAt(s, home).some((o) => o.side === side) && a.id === nearestTo(C, s, list, home)) return void (orders[a.id] = { to: a.at === home ? null : stepToward(C, s, a, home) });
    const big = [...foes].sort((x, y) => (y.hero && y.men >= 5000 ? 1 : 0) - (x.hero && x.men >= 5000 ? 1 : 0) || y.men - x.men)[0]; // the hero, while he leads an army
    const shadow = plan.stance === 'delay' && big && a.id === nearestTo(C, s, list.filter((x) => !x.stay), big.at);
    if (plan.stance === 'delay' && !shadow) { // the rest keep away from the great enemy and fight the war elsewhere
      const away = opts.filter((p) => !(big && (p === big.at || C.prov[big.at].neighbors.includes(p))));
      const take = away.filter((p) => s.prov[p].owner && atWar(s, side, s.prov[p].owner) && !armiesAt(s, p).some((o) => atWar(s, side, o.side)));
      if (take.length) return void (orders[a.id] = { to: take.sort((x, y) => C.prov[y].wealth - C.prov[x].wealth)[0], storm: a.men > 4 * (s.prov[a.at].garrison || 1) });
      if (s.prov[a.at].owner && atWar(s, side, s.prov[a.at].owner) && !(big && C.prov[big.at].neighbors.includes(a.at))) return void (orders[a.id] = { to: null });
      if (big && (a.at === big.at || C.prov[big.at].neighbors.includes(a.at))) {
        const safe = opts.filter((p) => p !== big.at && !C.prov[big.at].neighbors.includes(p) && (s.prov[p].owner === side || friends(s, side, s.prov[p].owner)));
        if (safe.length) return void (orders[a.id] = { to: safe[0] });
      }
      return void (orders[a.id] = { to: null });
    }
    if (plan.stance === 'delay') { // shadow the strongest enemy at a distance, on rough ground if possible
      if (!big) return void (orders[a.id] = { to: null });
      const near = opts.filter((p) => C.prov[p].neighbors.includes(big.at) && !armiesAt(s, p).some((o) => atWar(s, side, o.side)));
      if (near.length) return void (orders[a.id] = { to: near.sort((x, y) => groundOf(C, s, y) - groundOf(C, s, x))[0] });
      return void (orders[a.id] = { to: stepToward(C, s, a, big.at, true) });
    }
    if (plan.stance === 'defend') {
      const own = owned(s, side), sieged = own.find((p) => armiesAt(s, p).some((o) => atWar(s, side, o.side)));
      if (sieged && i === 0 && (oddsOf(C, s, a.id, sieged).ratio ?? 0) >= 1) return void (orders[a.id] = { to: stepToward(C, s, a, sieged) });
      return void (orders[a.id] = { to: i === 0 && home && a.at !== home ? stepToward(C, s, a, home) : null });
    }
    // attack: march on the target (each army on the nearest enemy land if the target is far), take open land on the way
    const take = opts.filter((p) => s.prov[p].owner && atWar(s, side, s.prov[p].owner) && !armiesAt(s, p).some((o) => atWar(s, side, o.side)));
    const target = a.target && s.prov[a.target] && s.prov[a.target].owner !== side && !friends(s, side, s.prov[a.target].owner) ? a.target : plan.target && s.prov[plan.target] ? plan.target : null;
    if (a.at !== target && target) {
      const way = wayTo(C, s, side, a.at, target);
      if (way && way.length <= 7) return void (orders[a.id] = { to: stepToward(C, s, a, target), storm: true });
    }
    if (take.length) return void (orders[a.id] = { to: take.sort((x, y) => C.prov[y].wealth - C.prov[x].wealth || s.prov[x].walls - s.prov[y].walls)[0], storm: a.men > 3 * (s.prov[a.at].garrison || 1) });
    if (s.prov[a.at].owner && atWar(s, side, s.prov[a.at].owner)) return void (orders[a.id] = { to: null, storm: a.men >= 3 * s.prov[a.at].garrison });
    orders[a.id] = { to: target ? stepToward(C, s, a, target) : null };
  });
  return orders;
}
function nearestTo(C, s, list, to) {
  return list.map((a) => [a.id, wayTo(C, s, a.side, a.at, to)?.length ?? 99]).sort((x, y) => x[1] - y[1])[0]?.[0];
}
function stepToward(C, s, a, to, stopShort = false) {
  const way = wayTo(C, s, a.side, a.at, to);
  if (!way || way.length < 2) return null;
  const r = reach(C, s, a.id);
  let pick = null;
  for (const p of way.slice(1, stopShort ? -1 : undefined)) if (r[p]) pick = p; else break;
  return pick;
}
// The player's turn played by the rules (for the advisor's "let me decide" and for simulations).
export function autoOrders(C0, s, side) {
  const C = READY.get(C0) ?? C0;
  side ??= C.you;
  return aiOrders(C, s, side, rulesPlan(C, s, side), rngFor(s.seed, s.turn, 'auto'));
}
export function autoRaise(C0, s, side) {
  const C = READY.get(C0) ?? C0;
  side ??= C.you;
  const r = aiRaise(C, s, side);
  if (!r) return {};
  const a = armiesOf(s, side).filter((x) => s.prov[x.at].owner === side && C.prov[x.at].wealth >= 1).sort((x, y) => (x.at === r.at ? -1 : 0) - (y.at === r.at ? -1 : 0) || y.men - x.men)[0];
  return a ? { [a.id]: r.men } : homeOf(C, s, side) ? { '@home': r.men } : {};
}
// How much an AI side raises this turn.
export const incomeOf = (C, s, side) => owned(s, side).reduce((t, p) => t + C.prov[p].wealth, 0) * (C.goldPer ?? 6) + (C.sides[side].income ?? 0);
export const upkeepOf = (C, s, side, extra = 0) => ((menOf(s, side) + extra) / 1000) * (C.upkeep ?? 2);
function aiRaise(C, s, side) {
  const d = C.sides[side], st = s.sides[side], cost = C.raiseCost ?? 10, home = d.capital;
  if (!enemiesOf(s, side).length || st.gold < cost * 3 || s.turn < (d.raiseFrom ?? 0)) return null;
  const at = home && s.prov[home]?.owner === side ? home : owned(s, side).sort((a, b) => C.prov[b].wealth - C.prov[a].wealth)[0];
  if (!at) return null;
  // no more men than the treasury can pay for: what is left after this turn's upkeep, for three turns to come
  const spare = incomeOf(C, s, side) - upkeepOf(C, s, side) + st.gold / 4;
  const men = Math.min(d.levy, Math.floor((st.gold * 0.6) / cost) * 1000, Math.floor(spare / (C.upkeep ?? 2)) * 1000);
  return men >= 2000 ? { at, men } : null;
}

// The cards of this turn, answered: the first step of a turn, and what the page shows before the turn ends.
export function answer(C, s, inputs, emit = () => {}, onlyAnswered = false) {
  for (const c of cardsDue(C, s)) {
    if (onlyAnswered && inputs.cards?.[c.id] === undefined) continue; // a preview shows only what the commander chose
    const pick = inputs.cards?.[c.id] ?? c.advise ?? 0, o = c.options[pick] ?? c.options[0];
    if (c.peace) {
      if (pick === 0) makePeace(C, s, c.peace, emit);
      delete s.offers[c.peace];
    } else {
      s.cards[c.id] = c.options.indexOf(o);
      emit({ type: 'card', card: c.id, text: `${c.title}: ${o.label}`, choice: s.cards[c.id], by: inputs.cards?.[c.id] === undefined ? 'advisor' : 'you' });
    }
    applyFx(C, s, o.fx, C.you, emit);
    if (s.status !== 'running') break;
  }
  for (const [side, o] of Object.entries(s.offers)) if (o.turn < s.turn) delete s.offers[side];
  return s;
}
export function withCards(C0, s0, cards) {
  const C = READY.get(C0) ?? C0, s = clone(s0);
  answer(C, s, { cards: Object.fromEntries(Object.entries(cards ?? {}).filter(([, v]) => v !== undefined)) }, () => {}, true);
  return s;
}

// ---------- the turn ----------
export function resolve(s0, C0, inputs = {}) {
  const C = READY.get(C0) ?? C0, s = clone(s0), rng = (step) => rngFor(s.seed, s.turn, step);
  if (s.status !== 'running') return { state: s, events: [] };
  const log = [];
  const emit = (e) => log.push({ turn: s.turn, ...e });
  for (const a of Object.values(s.armies)) a.from = a.at;
  s.said = {};
  const dug = Object.fromEntries(Object.values(s.armies).filter((a) => a.fort).map((a) => [a.id, a.at]));

  // 1. the cards
  answer(C, s, inputs, emit);
  if (s.status !== 'running') return wrap(C, s, log);
  // the player's own offer of peace
  for (const [side, how] of Object.entries(inputs.peace ?? {})) {
    if (how !== 'offer' || !atWar(s, C.you, side) || C.sides[side].noPeace) continue;
    const at = C.sides[side].peaceAt ?? 40, yes = s.sides[side].will < at || (s.sides[side].will < at + 15 && menOf(s, side) < menOf(s, C.you) * 0.6);
    if (yes) makePeace(C, s, side, emit);
    else emit({ type: 'peace.refused', text: `${C.sides[side].name} refuses your offer of peace`, sides: [side] });
  }
  if (s.status !== 'running') return wrap(C, s, log);

  // 2. the AI's plans and orders; the player's orders
  const orders = {};
  for (const side of living(s)) {
    if (side === C.you) continue;
    const ai = inputs.ai?.[side], plan = ai && ['attack', 'defend', 'delay', 'raid'].includes(ai.stance) ? { stance: ai.stance === 'raid' ? 'attack' : ai.stance, target: s.prov[ai.target] ? ai.target : rulesPlan(C, s, side).target, peace: !!ai.peace, by: ai.by ?? 'ai' } : rulesPlan(C, s, side);
    s.plans[side] = plan;
    if (ai?.say) s.said[side] = String(ai.say).slice(0, 200);
    Object.assign(orders, aiOrders(C, s, side, plan, rng(`ai:${side}`)));
    if (plan.peace && !C.sides[side].noPeace && atWar(s, side, C.you) && !s.offers[side] && s.sides[side].will < (C.sides[side].peaceAt ?? 40) + 5) s.offers[side] = { turn: s.turn + 1, to: C.you };
    const r = aiRaise(C, s, side);
    if (r) {
      const there = armiesAt(s, r.at).find((a) => a.side === side);
      s.sides[side].gold -= (r.men / 1000) * (C.raiseCost ?? 10);
      if (there) there.men += r.men;
      else spawn(s, side, r.at, r.men, C.sides[side].levyGeneral ?? null, 2);
      emit({ type: 'raised', text: `${C.sides[side].name} raises ${fmtMen(r.men)} at ${C.prov[r.at].name}`, at: r.at, sides: [side], minor: true });
    }
  }
  for (const [id, o] of Object.entries(inputs.orders ?? {})) {
    const a = s.armies[id];
    if (!a || a.side !== C.you) continue;
    const r = o.to ? reach(C, s, id)[o.to] : null;
    orders[id] = { to: r ? o.to : null, plan: o.plan && PLANS[o.plan] ? o.plan : null, storm: !!o.storm };
  }
  for (const [id, men] of Object.entries(inputs.raise ?? {})) raise(C, s, id, men, emit);

  // 3. marching: every army at once, along its way, stopping where an enemy stood at the start of the turn
  const start = Object.fromEntries(Object.values(s.armies).map((a) => [a.id, a.at]));
  const moves = [];
  for (const a of Object.values(s.armies)) {
    const o = orders[a.id];
    a.order = o ?? null;
    if (!o?.to) continue;
    const way = reach(C, s, a.id)[o.to]?.path;
    if (!way) continue;
    moves.push([a, way]);
  }
  // an army that an enemy marches on stands to fight it, unless it refuses battle; when two armies march on each
  // other, the larger presses on and the smaller stands
  const pinned = new Set();
  for (const [a, way] of moves) {
    const threats = moves.filter(([o, w]) => o.id !== a.id && atWar(s, o.side, a.side) && w.slice(1).includes(a.at));
    if (!threats.length || orders[a.id]?.plan === 'refuse') continue;
    const mutual = threats.filter(([o]) => way.slice(1).includes(o.at));
    if (mutual.length && mutual.every(([o]) => a.men >= o.men) && mutual.length === threats.length) continue;
    pinned.add(a.id);
  }
  for (const [a, way] of moves) {
    if (pinned.has(a.id)) continue;
    let stop = a.at;
    for (const p of way.slice(1)) {
      stop = p;
      if (Object.values(s.armies).some((o) => o.id !== a.id && start[o.id] === p && atWar(s, a.side, o.side))) break;
    }
    if (C.prov[a.at].sea.includes(way[1]) && rng(`sea:${a.id}`)() < (C.lanes?.storm ?? 0.08)) {
      const lost = Math.round(a.men * (0.1 + 0.2 * rng(`sea2:${a.id}`)()));
      a.men -= lost;
      emit({ type: 'storm', text: `A storm at sea costs ${C.sides[a.side].name} ${fmtMen(lost)} men`, at: way[1], sides: [a.side] });
    }
    a.at = stop;
  }

  for (const [id, at] of Object.entries(dug)) if (s.armies[id] && s.armies[id].at !== at) delete s.armies[id].fort; // siege lines stay behind when an army marches
  // 4. battles, wherever enemies stand together
  const places = [...new Set(Object.values(s.armies).map((a) => a.at))];
  for (const at of places) battleAt(C, s, at, orders, start, rng(`battle:${at}`), emit);

  // 5. sieges and captures
  for (const at of Object.keys(s.prov)) siegeAt(C, s, at, orders, rng(`siege:${at}`), emit);

  // 6. money and upkeep; 7. attrition; 8. will to fight
  for (const side of living(s)) economy(C, s, side, emit);
  for (const a of Object.values(s.armies)) attrition(C, s, a, emit);
  for (const side of living(s)) {
    if (enemiesOf(s, side).length) s.sides[side].will = clamp(s.sides[side].will - (C.sides[side].weariness ?? C.weariness ?? 1), 0, 100);
    if (!owned(s, side).length && !armiesOf(s, side).length && s.sides[side].alive) {
      s.sides[side].alive = false;
      emit({ type: 'fallen', text: `${C.sides[side].name} is no more`, sides: [side] });
    }
    if (C.sides[side].noPeace) continue; // some never treat: the Great King did not, while he lived
    if (submits(C, s, side, emit)) continue;
    if (side !== C.you && atWar(s, side, C.you) && s.sides[side].will < Math.min(25, C.sides[side].peaceAt ?? 25) && !s.offers[side]) s.offers[side] = { turn: s.turn + 1, to: C.you };
    if (side !== C.you && atWar(s, side, C.you) && s.sides[side].will <= 0) { emit({ type: 'yield', text: `${C.sides[side].name} can fight no more and yields`, sides: [side] }); makePeace(C, s, side, emit); }
  }

  // 9. history's own moves
  for (const ev of C.events ?? []) {
    if (!due(ev, s, C, s.done) || s.status !== 'running') continue;
    if (ev.chance !== undefined && rng(`event:${ev.id}`)() >= ev.chance) continue;
    if (ev.once !== false) s.done[ev.id] = s.turn;
    applyFx(C, s, ev.fx, ev.side ?? C.you, emit);
    if (ev.text) emit({ type: ev.type ?? 'history', text: ev.text, at: ev.place, sides: ev.sides });
  }
  for (const side of living(s)) submits(C, s, side, emit); // history's moves may have broken a people's will
  s.stats.peak = Math.max(s.stats.peak, menOf(s, C.you));

  // 10. the goal, and the next turn
  if (s.status === 'running') goals(C, s, emit);
  if (s.status === 'running') {
    s.turn += 1;
    if (s.turn >= C.turns.length) {
      const g = goalState(C, s);
      s.turn = C.turns.length - 1;
      finish(C, s, g.met ? 'win' : 'lose', g.met ? C.goal.won ?? g.text : C.lose?.time ?? `The time ran out before you could ${C.goal.text[0].toLowerCase()}${C.goal.text.slice(1)}`);
    }
  }
  return wrap(C, s, log);
}
function wrap(C, s, log) {
  if (s.status !== 'running' && !s.end.logged) { s.end.logged = true; log.push({ turn: s.turn, type: s.end.result === 'win' ? 'victory' : 'defeat', text: s.end.why }); }
  s.log = log;
  return { state: s, events: log };
}
export const fmtMen = (n) => (n >= 995000 ? `${(n / 1e6).toFixed(n >= 9.95e6 ? 0 : 1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n / 100) * 100}`);

// Where new troops can be raised away from any army: the capital, or failing it the richest city still held.
export function homeOf(C, s, side) {
  const cap = C.sides[side].capital;
  if (cap && s.prov[cap]?.owner === side && !armiesAt(s, cap).some((o) => atWar(s, side, o.side))) return cap;
  return owned(s, side).filter((p) => C.prov[p].wealth >= 2 && !armiesAt(s, p).some((o) => atWar(s, side, o.side))).sort((a, b) => C.prov[b].wealth - C.prov[a].wealth)[0] ?? null;
}
function raise(C, s, id, men, emit) {
  if (id === '@home') { // a new army, raised at home
    const side = C.you, at = homeOf(C, s, side), cost = C.raiseCost ?? 10;
    if (!at) return;
    const n = Math.min(Math.round(men / 1000) * 1000, C.sides[side].levy, Math.floor(s.sides[side].gold / cost) * 1000);
    if (n < 1000) return;
    s.sides[side].gold -= (n / 1000) * cost;
    const there = armiesAt(s, at).find((a) => a.side === side);
    if (there) there.men += n;
    else spawn(s, side, at, n, C.sides[side].levyGeneral ?? 'New levies', 2, { morale: 50 });
    emit({ type: 'raised', text: `${fmtMen(n)} new men are raised at ${C.prov[at].name}`, at, sides: [side] });
    return;
  }
  const a = s.armies[id], side = a?.side, cost = C.raiseCost ?? 10;
  if (!a || side !== C.you || !men) return;
  const p = s.prov[a.at];
  if (!(p.owner === side || friends(s, side, p.owner)) || C.prov[a.at].wealth < 1) return;
  const n = Math.min(Math.round(men / 1000) * 1000, C.sides[side].levy, Math.floor(s.sides[side].gold / cost) * 1000);
  if (n < 1000) return;
  s.sides[side].gold -= (n / 1000) * cost;
  a.men += n;
  a.morale = Math.max(40, a.morale - Math.round((n / (a.men || 1)) * 20)); // new men are green
  emit({ type: 'raised', text: `${fmtMen(n)} new men join ${a.gen ?? 'your army'} at ${C.prov[a.at].name}`, at: a.at, sides: [side] });
}

function battleAt(C, s, at, orders, start, rng, emit) {
  const here = armiesAt(s, at);
  if (here.length < 2) return;
  const sides = [...new Set(here.map((a) => a.side))];
  const hostile = sides.some((x) => sides.some((y) => atWar(s, x, y)));
  if (!hostile) return;
  // two camps: the strongest army that stood here first defends, with its friends; its enemies attack
  const stood = here.filter((a) => start[a.id] === at), came = here.filter((a) => start[a.id] !== at);
  const ds = [...(stood.length ? stood : came)].sort((x, y) => y.men - x.men)[0].side;
  const d = here.filter((a) => friends(s, a.side, ds));
  const att = here.filter((a) => atWar(s, a.side, ds));
  if (!att.length) return;
  const as = [...att].sort((x, y) => y.men - x.men)[0].side;
  const fa = battleFacts(C, s, at, att, d, false), fd = battleFacts(C, s, at, d, att, true);
  const lead = (list) => [...list].sort((x, y) => y.men - x.men)[0];
  const la = lead(att), ld = lead(d);
  const choose = (list, f, side) => {
    const ordered = list.map((a) => orders[a.id]?.plan).find(Boolean);
    if (ordered && plansFor(C, f.defending).includes(ordered)) return { id: ordered, by: side === C.you ? 'you' : 'ai' };
    const g = lead(list);
    return { id: generalsPlan(C, f, { temper: g.temper ?? temperOf(C, s, g.side), skill: g.skill }, rng), by: 'general' };
  };
  const pa = choose(att, fa, as), pd = choose(d, fd, ds);
  // refusing battle: the defender slips away, whole, if there is somewhere to go
  if (pd.id === 'refuse') {
    const back = C.prov[at].neighbors.find((p) => (s.prov[p].owner === ds || friends(s, ds, s.prov[p].owner)) && !armiesAt(s, p).some((o) => atWar(s, ds, o.side)) && !C.prov[at].sea.includes(p));
    if (back && fd.ratio < 1.2) {
      for (const a of d) { a.at = back; a.morale = clamp(a.morale - 3, 10, 100); }
      emit({ type: 'refused', text: `${ld.gen ?? C.sides[ds].name} refuses battle at ${C.prov[at].name} and falls back to ${C.prov[back].name}`, at, sides: [ds, as], plans: { a: pa, d: pd } });
      if (ds === C.you || as === C.you) s.sides[as].will = clamp(s.sides[as].will - 1, 0, 100);
      return;
    }
    pd.id = generalsPlan(C, fd, { temper: 'steady', skill: ld.skill }, rng, ['refuse']);
  }
  const fitA = clamp(fitOf(fa, pa.id) - (countered(pa.id, pd.id) ? 0.8 : 0), -1, 1), fitD = clamp(fitOf(fd, pd.id) - (countered(pd.id, pa.id) ? 0.8 : 0), -1, 1);
  const pow = (list, fit, defending) => list.reduce((t, a) => t + a.men * (C.sides[a.side].quality ?? 1) * (1 + 0.08 * (a.skill - 3)) * (0.6 + a.morale / 250) * (defending ? a.fort ?? 1 : 1), 0)
    * planFactor(fit, lead(list).skill) * (defending ? groundOf(C, s, at) : 1) * (0.85 + 0.3 * rng());
  const PA = pow(att, fitA, false), PD = pow(d, fitD, true);
  const aWins = PA > PD, win = aWins ? att : d, lose = aWins ? d : att, r = Math.max(PA, PD) / Math.max(1, Math.min(PA, PD));
  const loseFrac = clamp(0.15 + 0.2 * r, 0.25, 0.75), winFrac = clamp(0.2 / r, 0.03, 0.22);
  const tally = (list, frac) => list.reduce((t, a) => { const k = Math.round(a.men * frac); a.men -= k; return t + k; }, 0);
  const lostW = tally(win, winFrac), lostL = tally(lose, loseFrac);
  const ws = lead(win).side, ls = lead(lose).side, decisive = loseFrac >= 0.5;
  for (const a of win) a.morale = clamp(a.morale + (decisive ? 15 : 8), 10, 100);
  for (const a of lose) a.morale = clamp(a.morale - (decisive ? 25 : 12), 10, 100);
  s.sides[ws].will = clamp(s.sides[ws].will + (decisive ? 8 : 4), 0, 100);
  s.sides[ls].will = clamp(s.sides[ls].will - (decisive ? 12 : 5), 0, 100);
  const mine = att.some((a) => a.side === C.you) || d.some((a) => a.side === C.you), weWon = win.some((a) => friends(s, a.side, C.you));
  if (mine) {
    if (weWon) { s.stats.won++; if (decisive) s.stats.great++; } else s.stats.lost++;
    s.stats.killed += weWon ? lostL : lostW;
    s.stats.dead += weWon ? lostW : lostL;
  }
  // the loser falls back, toward home, or is destroyed
  const gone = [];
  for (const a of lose) {
    // fall back to a neighbour with no enemy army in it: your own land first, then land at war with you; never across the sea
    const ok = (p) => !C.prov[at].sea.includes(p) && !armiesAt(s, p).some((o) => atWar(s, a.side, o.side)) && (!s.prov[p].owner || s.prov[p].owner === a.side || friends(s, a.side, s.prov[p].owner) || atWar(s, a.side, s.prov[p].owner));
    const score = (p) => (s.prov[p].owner === a.side || friends(s, a.side, s.prov[p].owner) ? 10 : 0) + s.prov[p].walls * (s.prov[p].owner === a.side ? 1 : 0) + groundOf(C, s, p);
    const back = C.prov[at].neighbors.filter(ok).sort((x, y) => score(y) - score(x))[0];
    if (back && a.men >= 1500) a.at = back;
    else { gone.push(a); delete s.armies[a.id]; }
  }
  // after a great victory, nearby towns of the beaten side may open their gates rather than face a siege
  if (decisive && atWar(s, ws, ls)) {
    for (const p of [at, ...C.prov[at].neighbors]) {
      const st = s.prov[p];
      if (st.owner !== ls || C.prov[p].capital || armiesAt(s, p).some((o) => o.side === ls) || C.prov[p].sea.includes(at)) continue;
      if (rng() < (C.surrender ?? 0.35)) capture(C, s, p, ws, emit, 'opens its gates');
    }
  }
  const P = C.prov[at].name, wn = C.sides[ws].name, ln = C.sides[ls].name;
  emit({
    type: 'battle', at, sides: [as, ds], winner: ws, loser: ls, decisive,
    text: `${decisive ? 'A great victory' : 'Victory'} for ${wn} at ${P}: ${lead(win).gen ?? wn} beats ${lead(lose).gen ?? ln}${gone.length ? `, whose army is destroyed` : ''}`,
    men: [Math.round(att.reduce((t, a) => t + a.men, 0) + (aWins ? lostW : lostL)), Math.round(d.reduce((t, a) => t + a.men, 0) + (aWins ? lostL : lostW))],
    lost: aWins ? [lostW, lostL] : [lostL, lostW], plans: { a: { ...pa, fit: round(fitA, 0.01) }, d: { ...pd, fit: round(fitD, 0.01) } }, gens: [la.gen, ld.gen],
  });
  // a commander whose army is destroyed may still escape with his bodyguard, to the nearest friendly ground
  for (const a of gone) {
    if (!a.hero) { // a general without his army: taken or killed, or he gets away
      if (!isPerson(a.gen)) continue;
      if (rng() < 0.5) emit({ type: 'escape', text: `${a.gen} gets away from the rout with a handful of horsemen`, at, sides: [a.side], minor: true });
      else { kill(C, s, a.gen, null, emit); emit({ type: 'fallen', text: `${a.gen} dies with his army at ${C.prov[at].name}`, at, sides: [a.side] }); }
      continue;
    }
    const hunted = (p) => Object.values(s.armies).some((o) => atWar(s, a.side, o.side) && reach(C, s, o.id)[p]); // where no enemy can reach this season, if he can
    const safe = Object.keys(s.prov).filter((p) => (s.prov[p].owner === a.side || friends(s, a.side, s.prov[p].owner)) && !armiesAt(s, p).some((o) => atWar(s, a.side, o.side)))
      .map((p) => [p, wayTo(C, s, a.side, at, p)?.length ?? 99]).filter(([, d]) => d < 99).sort((x, y) => hunted(x[0]) - hunted(y[0]) || x[1] - y[1])[0];
    if (safe && safe[1] < 99 && rng() < 0.85) {
      s.armies[a.id] = { ...a, at: safe[0], from: at, men: 3000, morale: 30 };
      emit({ type: 'escape', text: `${a.gen} escapes the rout with a few hundred horsemen and reaches ${C.prov[safe[0]].name}`, at: safe[0], sides: [a.side] });
    } else { emit({ type: 'hero', text: `${a.gen} is lost with his army`, at, sides: [a.side] }); kill(C, s, a.gen, null, emit); }
  }
}

function siegeAt(C, s, at, orders, rng, emit) {
  const P = s.prov[at], here = armiesAt(s, at);
  if (!here.length) { if (P.siege) Object.assign(P, { siege: 0, by: null }); return; }
  const side = [...here].sort((x, y) => y.men - x.men)[0].side;
  if (here.some((a) => atWar(s, a.side, side))) return; // still contested
  const owner = P.owner;
  if (owner === side || friends(s, side, owner) || (owner && !atWar(s, side, owner))) {
    if (P.walls && P.garrison < garrisonOf({ ...C.prov[at], walls: P.walls })) P.garrison = Math.min(garrisonOf({ ...C.prov[at], walls: P.walls }), P.garrison + 1500 * P.walls);
    if (P.siege) Object.assign(P, { siege: 0, by: null });
    return;
  }
  const men = here.filter((a) => a.side === side || friends(s, a.side, side)).reduce((t, a) => t + a.men, 0);
  if (!P.walls || P.garrison < 500) return capture(C, s, at, side, emit);
  const storm = here.some((a) => orders[a.id]?.storm);
  if (storm) {
    const att = men * (C.sides[side].quality ?? 1) * (0.85 + 0.3 * rng()), def = P.garrison * wallPower(P.walls) * (C.sides[owner]?.quality ?? 1);
    const r = att / Math.max(1, def), lost = Math.round(Math.min(men * 0.35, P.garrison * (0.6 + 0.3 * P.walls) * (r > 1 ? 0.8 : 1.2)));
    for (const a of here) a.men -= Math.round(lost * (a.men / men));
    if (side === C.you || friends(s, side, C.you)) s.stats.dead += lost;
    if (r > 1) {
      emit({ type: 'storm', text: `${C.sides[side].name} storms the walls of ${C.prov[at].name}`, at, sides: [side, owner] });
      return capture(C, s, at, side, emit);
    }
    P.garrison = Math.round(P.garrison * 0.8);
    emit({ type: 'repulsed', text: `The assault on ${C.prov[at].name} is thrown back with heavy losses`, at, sides: [side, owner] });
    return;
  }
  if (P.by !== side) Object.assign(P, { siege: 0, by: side, since: s.turn });
  // a port fed from the sea cannot be starved while its masters rule the sea
  if (C.prov[at].port && (s.sides[owner]?.fleet ?? 0) > 0 && (s.sides[owner]?.fleet ?? 0) >= (s.sides[side]?.fleet ?? 0)) {
    if (!P.fedNoted) emit({ type: 'fed', text: `${C.prov[at].name} is fed from the sea: only a storm, or the loss of its fleet, will take it`, at, sides: [side, owner] });
    P.fedNoted = true;
    return;
  }
  P.siege += men >= 4 * P.garrison ? 2 : 1;
  if (P.siege >= P.walls && (P.since ?? -1) < s.turn) { // a siege lasts at least a season
    emit({ type: 'starved', text: `${C.prov[at].name} opens its gates to ${C.sides[side].name} after a siege`, at, sides: [side, owner] });
    return capture(C, s, at, side, emit);
  }
  if (P.siege === 1) emit({ type: 'siege', text: `${C.sides[side].name} lays siege to ${C.prov[at].name}`, at, sides: [side, owner], minor: true });
}
export const wallPower = (walls) => 1.5 + 0.6 * walls;
function capture(C, s, at, side, emit, how = null) {
  const P = s.prov[at], was = P.owner, D = C.prov[at];
  Object.assign(P, { owner: side, siege: 0, by: null, garrison: Math.round(garrisonOf({ ...D, walls: P.walls }) * 0.3) });
  const capital = was && C.sides[was]?.capital === at;
  if (was) s.sides[was].will = clamp(s.sides[was].will - (capital ? 22 : 1 + D.wealth / 2), 0, 100);
  s.sides[side].will = clamp(s.sides[side].will + (capital ? 12 : 1 + Math.ceil(D.wealth / 2)), 0, 100);
  if (side === C.you) s.stats.taken++;
  if (was === C.you) s.stats.fallen++;
  // a city taken pays: its plunder, and a royal treasury once
  const loot = Math.round(D.wealth * (C.plunder ?? 6) + (P.looted ? 0 : D.treasure ?? 0));
  P.looted = true;
  if (loot) s.sides[side].gold += loot;
  emit({ type: 'capture', text: how ? `${D.name} ${how} to ${C.sides[side].name}${D.treasure && loot > 100 ? `, with its treasury: ${loot} gold` : ''}` : `${C.sides[side].name} takes ${D.name}${was ? ` from ${C.sides[was].name}` : ''}${D.treasure && loot > 100 ? `, and its treasury: ${loot} gold` : ''}`, at, sides: [side, was], capital, minor: !capital && D.wealth < 2 && !D.walls && !D.treasure });
}
function economy(C, s, side, emit) {
  const st = s.sides[side], d = C.sides[side];
  const income = incomeOf(C, s, side), upkeep = upkeepOf(C, s, side);
  st.gold = Math.round((st.gold + income - upkeep) * 10) / 10;
  if (st.gold < 0) { // unpaid soldiers desert: the army shrinks to what the treasury can feed
    const short = clamp(-st.gold / Math.max(1, upkeep), 0, 1);
    st.gold = 0;
    st.will = clamp(st.will - 1, 0, 100);
    let gone = 0;
    for (const a of armiesOf(s, side)) {
      const k = Math.round(a.men * 0.08 * short);
      a.men -= k;
      gone += k;
      a.morale = clamp(a.morale - 8, 10, 100);
    }
    if (side === C.you) emit({ type: 'unpaid', text: `The treasury is empty: ${fmtMen(gone)} unpaid soldiers desert`, sides: [side] });
  }
}
function attrition(C, s, a, emit) {
  const P = C.prov[a.at], st = s.prov[a.at], season = turnOf(C, s).season, home = st.owner === a.side || friends(s, a.side, st.owner);
  let rate = home ? 0 : C.forage ?? 0.03;
  if (P.terrain === 'mountains' && season === 'winter') rate += 0.12;
  if (P.terrain === 'desert' && season === 'summer') rate += 0.06;
  if (P.terrain === 'steppe' && season === 'winter') rate += 0.05;
  if (P.terrain === 'marsh') rate += 0.03;
  rate += C.sides[a.side].attrition ?? 0;
  if (home) a.morale = clamp(a.morale + 4, 10, 100);
  if (rate <= 0) return;
  const lost = Math.round(a.men * rate);
  a.men -= lost;
  if (a.side === C.you) s.stats.dead += lost;
  if (rate >= 0.08) emit({ type: 'attrition', text: `${a.gen ?? C.sides[a.side].name} loses ${fmtMen(lost)} men to ${P.terrain === 'mountains' ? 'the cold of the mountains' : P.terrain === 'desert' ? 'the heat and thirst' : 'hunger and sickness'}`, at: a.at, sides: [a.side], minor: a.side !== C.you });
  if (a.men < 800) { delete s.armies[a.id]; emit({ type: 'melted', text: `${a.gen ?? `An army of ${C.sides[a.side].name}`}'s army melts away`, at: a.at, sides: [a.side] }); }
}
// A beaten people that submits gives hostages and becomes a client of the player.
function submits(C, s, side, emit) {
  const beaten = !armiesOf(s, side).some((a) => a.men >= 3000); // a people with no army left gives in, whatever its pride
  if (!C.sides[side].submits || side === C.you || !atWar(s, side, C.you) || (s.sides[side].will >= 30 && !beaten)) return false;
  setRel(s, side, C.you, 'ally', emit, C);
  emit({ type: 'submits', text: `${C.sides[side].name} submit${/s$/.test(C.sides[side].name) ? '' : 's'} to ${C.sides[C.you].short ?? C.sides[C.you].name} and give hostages`, sides: [side, C.you] });
  for (const a of armiesOf(s, side)) a.stay = true;
  s.sides[side].will = 40;
  return true;
}
function makePeace(C, s, side, emit) {
  if (!atWar(s, side, C.you)) return;
  setRel(s, side, C.you, 'peace', emit, C);
  delete s.offers[side];
  // at peace, its armies leave your lands and your friends': home to their capital, or they disband
  const home = C.sides[side].capital && s.prov[C.sides[side].capital]?.owner === side ? C.sides[side].capital : null;
  for (const a of armiesOf(s, side)) {
    const o = s.prov[a.at].owner;
    if (o !== C.you && !friends(s, C.you, o)) continue;
    if (home) Object.assign(a, { from: a.at, at: home });
    else delete s.armies[a.id];
  }
  if ((C.goal.kind === 'peace' || C.goal.kind === 'drive') && C.goal.foe === side) finish(C, s, 'win', C.goal.won ?? `${C.sides[side].name} makes peace on your terms`);
}

// ---------- the goal, and the verdict against history ----------
export function goalState(C, s) {
  const g = C.goal, Q = q(C, s), you = C.you;
  switch (g.kind) {
    case 'peace': {
      const capital = C.sides[g.foe].capital, foe = s.sides[g.foe];
      return { met: !atWar(s, you, g.foe) && s.status !== 'running' ? true : !!(capital && s.prov[capital]?.owner === you), progress: clamp(1 - (foe.will - 25) / 75, 0, 1), text: `${C.sides[g.foe].name}'s will to fight: ${Math.round(foe.will)} (they sue for peace below 25)` };
    }
    case 'take': {
      const have = g.provs.filter((p) => s.prov[p]?.owner === you || (g.allies && friends(s, you, s.prov[p]?.owner))).length, need = g.count ?? g.provs.length;
      return { met: have >= need, progress: have / need, text: `${have} of ${need}: ${g.provs.slice(0, 4).map((p) => C.prov[p].name).join(', ')}${g.provs.length > 4 ? '…' : ''}` };
    }
    case 'destroy': {
      const left = owned(s, g.foe).length, start = Object.values(C.prov).filter((p) => p.owner === g.foe).length;
      const capital = C.sides[g.foe].capital;
      return { met: !s.sides[g.foe].alive || left === 0 || (g.capital !== false && capital && s.prov[capital]?.owner === you), progress: clamp(1 - left / Math.max(1, start), 0, 1), text: `${C.sides[g.foe].name} holds ${left} of its ${start} provinces${capital ? `; its capital is ${C.prov[capital].name}` : ''}` };
    }
    case 'hold': case 'drive': {
      const foeIn = g.kind === 'drive' ? Object.values(s.armies).filter((a) => a.side === g.foe && g.provs.includes(a.at) && a.men >= (g.min ?? 5000)).length : 0;
      const have = g.provs.filter((p) => s.prov[p]?.owner === you || friends(s, you, s.prov[p]?.owner)).length;
      const met = have >= (g.count ?? g.provs.length) && foeIn === 0;
      return { met, progress: have / g.provs.length * (foeIn ? 0.6 : 1), text: g.kind === 'drive' ? `${foeIn ? `${foeIn} enemy armies still stand in the land` : 'No enemy army in the land'}; you and your allies hold ${have} of ${g.provs.length}` : `You hold ${have} of ${g.provs.length}` };
    }
    case 'custom': return g.check(Q, s);
  }
  return { met: false, progress: 0, text: '' };
}
function goals(C, s, emit) {
  const you = C.you, g = goalState(C, s);
  if (g.met && C.goal.kind !== 'hold' && C.goal.kind !== 'drive' && !(C.goal.kind === 'custom' && C.goal.atEnd)) return finish(C, s, 'win', C.goal.won ?? g.text);
  if (C.goal.kind === 'drive' && g.met && C.goal.early && s.turn >= C.goal.early) return finish(C, s, 'win', C.goal.won ?? g.text);
  const hero = C.armies.some((a) => a[5]?.hero) ? heroOf(s) : true;
  if (!hero) return finish(C, s, 'lose', C.lose?.hero ?? `${C.hero.name} has fallen`);
  if (s.sides[you].will <= 0) return finish(C, s, 'lose', C.lose?.will ?? `${C.sides[you].name} has lost the will to fight: you are recalled`);
  const cap = C.sides[you].capital;
  if (cap && C.loseCapital !== false && s.prov[cap]?.owner !== you && !friends(s, you, s.prov[cap]?.owner)) return finish(C, s, 'lose', C.lose?.capital ?? `${C.prov[cap].name} has fallen`);
  if (!armiesOf(s, you).length && !owned(s, you).length) return finish(C, s, 'lose', 'Nothing is left of your army or your lands');
}
function finish(C, s, result, why) {
  if (s.status !== 'running') return;
  s.status = result === 'win' ? 'won' : 'lost';
  s.end = { result, why, turn: s.turn };
  s.verdict = verdict(C, s);
}
// Better than history, as history, or worse: the stars of a finished campaign.
export function verdict(C, s) {
  if (s.status === 'running') return null;
  const H = C.history, won = s.status === 'won', turn = s.end?.turn ?? s.turn;
  if (typeof H.judge === 'function') { const v = H.judge(q(C, s), s, won); if (v) return { as: v, stars: v === 'better' ? 3 : v === 'as' ? 2 : 1 }; }
  let v;
  if (H.won) v = !won ? 'worse' : turn < H.at ? 'better' : 'as';
  else v = won ? 'better' : turn >= H.at - 1 ? 'as' : 'worse';
  return { as: v, stars: v === 'better' ? 3 : v === 'as' ? 2 : 1 };
}
export const VERDICT = { better: 'Better than history', as: 'As history', worse: 'Worse than history' };

// ---------- the advisor, by the rules: what to look at this turn ----------
export function counsel(C, s) {
  const you = C.you, out = [], hero = heroOf(s);
  const foes = Object.values(s.armies).filter((a) => atWar(s, you, a.side));
  for (const a of armiesOf(s, you)) {
    for (const [p] of Object.entries(reach(C, s, a.id))) {
      const o = oddsOf(C, s, a.id, p);
      if (o.kind !== 'battle') continue;
      const f = o.facts, best = plansFor(C, false).map((id) => [id, fitOf(f, id)]).sort((x, y) => y[1] - x[1])[0];
      const foe = s.armies[o.foes[0]];
      out.push({ w: o.ratio, text: `${foe.gen ?? C.sides[foe.side].name} is within reach at ${C.prov[p].name} with ${fmtMen(f.foeMen)} to your ${fmtMen(f.men)}${['rash', 'bold'].includes(f.foeTemper) ? `, and he is ${f.foeTemper}` : ''}. ${o.ratio >= 1.15 ? 'The odds favour you' : o.ratio >= 0.9 ? 'It would be a close fight' : 'The odds are against you'}${best[1] > 0.5 ? `: the ground suits ${PLANS[best[0]].name.toLowerCase()}` : ''}.` });
    }
  }
  const threats = foes.filter((f) => armiesOf(s, you).some((a) => reach(C, s, f.id)[a.at]));
  for (const f of threats.slice(0, 2)) out.push({ w: 2, text: `${f.gen ?? C.sides[f.side].name} (${fmtMen(f.men)}) can reach you next turn.` });
  if (s.sides[you].gold < 20) out.push({ w: 1.5, text: 'The treasury is nearly empty: take rich cities, or the men will go unpaid.' });
  if (hero && hero.morale < 40) out.push({ w: 1.4, text: 'The men are weary: a turn on friendly ground would restore them.' });
  if (s.sides[you].will < 30) out.push({ w: 3, text: 'At home they are losing heart. A victory would silence your critics.' });
  const g = goalState(C, s);
  out.push({ w: 0.5, text: `Remember the goal: ${C.goal.text}. ${g.text}.` });
  return out.sort((a, b) => b.w - a.w).slice(0, 3).map((x) => x.text);
}

// A short fingerprint of the war, so a replay that strays from the record is noticed.
export function checksum(s) {
  const str = JSON.stringify([s.turn, s.status, s.sides, s.prov, Object.values(s.armies).map((a) => [a.id, a.side, a.at, a.men, a.morale]), s.rel, s.flags]);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
// Replay a record: the start, then each turn's inputs.
export function replay(C, seed, turns, upto = Infinity) {
  let s = newCampaign(C, seed);
  const all = [];
  for (let t = 0; t < Math.min(turns.length, upto); t++) {
    const r = resolve(s, C, turns[t] ?? {});
    all.push(r.events);
    s = r.state;
  }
  return { state: s, events: all };
}
