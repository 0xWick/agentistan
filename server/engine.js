// Pure game rules: no I/O, no clock. The only randomness is the seeded battle roll.
import { createHash } from 'node:crypto';
import { CFG, MAP, STRONGHOLDS, CAST, SCENARIOS, PLACES } from './config.js';

const N = CFG.size;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const TERRAIN = { '.': 'plains', f: 'forest', m: 'mountain', '~': 'river', F: 'fort', C: 'capital' };
const ACTIONS = ['move', 'attack', 'fortify', 'recruit', 'hold'];

export const other = (k) => (k === 'red' ? 'blue' : 'red');
export const terrainAt = (x, y) => TERRAIN[MAP[y][x]];
export const roundOf = (s) => Math.ceil(s.turn / 2);
export const strongholdAt = (s, x, y) => s.strongholds.find((h) => h.x === x && h.y === y);
const idx = (x, y) => y * N + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const onMap = (a) => !a.routed;
const armyAt = (s, k, x, y) => onMap(s.armies[k]) && s.armies[k].x === x && s.armies[k].y === y;
const capital = (s, k) => s.strongholds.find((h) => h.capital === k);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const morale = (m) => +clamp(m, CFG.army.moraleMin, CFG.army.moraleMax).toFixed(2);

const COINS = ['ETH', 'BTC', 'LINK'];
export const placeFor = (season) => PLACES[(season - 1) % PLACES.length];

export function newSeason(season, scenario = 'standard', prices = {}) {
  const sc = SCENARIOS[scenario] ?? SCENARIOS.standard;
  const owner = Array(N * N).fill(null);
  const strongholds = STRONGHOLDS.map((h) => {
    const o = h.capital ?? h.home ?? null;
    if (o) owner[idx(h.x, h.y)] = o;
    return { ...h, owner: o, garrison: h.capital ? CFG.garrison.capital : o ? CFG.garrison.max : CFG.garrison.neutral };
  });
  const army = ([x, y]) => ({ x, y, strength: CFG.army.start, morale: CFG.army.morale, fortified: false, routed: 0 });
  const realm = () => ({ gold: CFG.gold.start, food: sc.food ?? CFG.food.start, holdStreak: 0, lastSeen: null });
  return {
    season, scenario, turn: 1, active: 'red', maxRounds: sc.rounds ?? CFG.maxRounds,
    owner, strongholds,
    armies: { red: army(sc.red), blue: army(sc.blue) },
    kingdoms: { red: realm(), blue: realm() },
    market: Object.fromEntries(COINS.map((c) => [c, { start: prices[c] ?? null, price: prices[c] ?? null }])),
    weather: { kind: 'clear', place: placeFor(season).name },
    status: 'running', winner: null, endReason: null,
  };
}

// State saved before markets and weather existed: ETH carries over, the rest start from their next reading.
export function upgrade(s0) {
  if (s0.market?.ETH && s0.weather) return s0;
  const s = structuredClone(s0), old = s.market ?? {};
  s.market = Object.fromEntries(COINS.map((c) => [c, old[c] ?? (c === 'ETH' ? { start: old.start ?? null, price: old.price ?? null } : { start: null, price: null })]));
  s.weather ??= { kind: 'clear', place: placeFor(s.season).name };
  return s;
}

// % change of a coin since the season began (0 until there are two readings).
export const marketPct = (s, coin) => {
  const m = s.market[coin];
  return m?.start && m?.price ? +((m.price / m.start - 1) * 100).toFixed(3) : 0;
};
export const coinOf = (k) => CFG.market.coin[k];
export const incomeMult = (s, k) => {
  const c = CFG.market.income;
  return +clamp(1 + marketPct(s, coinOf(k)) * c.per1pct, c.min, c.max).toFixed(2);
};
export const mood = (s, k) => { // battle power bonus (or penalty) from your coin
  const c = CFG.market.mood;
  return +clamp(marketPct(s, coinOf(k)) * c.per1pct, -c.max, c.max).toFixed(3);
};
export const mercMult = (s) => {
  const c = CFG.market.mercs;
  return +clamp(1 + marketPct(s, 'LINK') * c.per1pct, c.min, c.max).toFixed(2);
};
export const recruitCost = (s) => Math.max(1, Math.round(CFG.recruitCost * mercMult(s)));

export function setPrice(s0, coin, price) {
  const s = structuredClone(s0);
  const m = (s.market[coin] ??= { start: null, price: null });
  m.start ??= price;
  m.price = price;
  return s;
}

// Weather from Open-Meteo's current conditions (WMO weather codes).
export function classifyWeather({ code, tempC, windKmh }) {
  if (code >= 95 || windKmh >= 50) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86 || tempC <= -2) return 'snow';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (tempC >= 35) return 'heat';
  return 'clear';
}
export const weatherKind = (s) => s.weather?.kind ?? 'clear';
const sky = (s) => CFG.weather[weatherKind(s)] ?? {};

export function setWeather(s0, w) {
  const s = structuredClone(s0);
  s.weather = { ...s.weather, ...w, kind: classifyWeather(w) };
  return s;
}

export function holdings(s, k) {
  return {
    strongholds: s.strongholds.filter((h) => h.owner === k).length,
    forts: s.strongholds.filter((h) => h.owner === k && !h.capital).length,
    tiles: s.owner.filter((o) => o === k).length,
  };
}

export function income(s, k) {
  const { forts, tiles } = holdings(s, k);
  return Math.round((CFG.gold.base + CFG.gold.perFort * forts + Math.floor(tiles / CFG.gold.tilesPer)) * incomeMult(s, k));
}

export const recruitable = (s, k) => Math.max(0, Math.min(Math.floor(s.kingdoms[k].gold / recruitCost(s)), CFG.army.max - s.armies[k].strength));
const onOwnLand = (s, k) => s.owner[idx(s.armies[k].x, s.armies[k].y)] === k;
export const eats = (s, k) => (onMap(s.armies[k]) ? Math.ceil((s.armies[k].strength / CFG.food.perStrength) * (sky(s).eat ?? 1)) : 0);

// Economy, garrison regen, fortify expiry and respawn for the kingdom whose turn it is.
export function startTurn(s0) {
  const s = structuredClone(s0), k = s.active, K = s.kingdoms[k], A = s.armies[k];
  const { ev, emit } = log();
  if (k === 'red') for (const h of s.strongholds) if (h.owner && !h.capital) h.garrison = Math.min(CFG.garrison.max, h.garrison + CFG.garrison.regen);
  emit('turn.started', k, `Round ${roundOf(s)}: ${CAST[k].realm}'s turn`, { round: roundOf(s) });
  A.fortified = false;
  if (A.routed && --A.routed === 0) {
    const c = capital(s, k);
    Object.assign(A, { x: c.x, y: c.y, strength: CFG.army.respawnStrength, morale: CFG.army.morale });
    emit('army.moved', k, `${CAST[k].realm}'s army regrouped at ${c.name}`, { x: c.x, y: c.y, respawn: true });
  }
  const gold = income(s, k), eat = eats(s, k), mult = incomeMult(s, k);
  K.gold += gold;
  K.food = clamp(K.food + CFG.food.base + CFG.food.perFort * holdings(s, k).forts - eat, 0, CFG.food.cap);
  emit('resources.updated', k, `${CAST[k].realm} +${gold} gold (${coinOf(k)} x${mult}), ate ${eat} food${weatherKind(s) === 'clear' ? '' : ` in the ${weatherKind(s)}`}, food ${K.food}/${CFG.food.cap}`,
    { gold: K.gold, income: gold, food: K.food, eat, mult, coin: coinOf(k), weather: weatherKind(s) });
  if (K.food === 0 && onMap(A)) {
    A.strength = Math.floor(A.strength * (1 - CFG.starveLoss));
    emit('army.starving', k, `${CAST[k].realm}'s army is starving: strength falls to ${A.strength}`, { strength: A.strength });
    rout(s, k, emit);
  }
  return { state: s, events: ev };
}

export function legalMoves(s, k) {
  const A = s.armies[k];
  if (!onMap(A)) return [];
  const seen = new Map([[idx(A.x, A.y), 0]]);
  const out = [];
  const q = [{ x: A.x, y: A.y, cost: 0, path: [] }];
  while (q.length) {
    const cur = q.shift();
    for (const [dx, dy] of DIRS) {
      const x = cur.x + dx, y = cur.y + dy;
      if (!inside(x, y) || armyAt(s, other(k), x, y)) continue;
      const h = strongholdAt(s, x, y);
      if (h && h.owner !== k) continue; // garrisoned: attack it, don't walk in
      const cost = cur.cost + CFG.terrain[terrainAt(x, y)].cost;
      if (cost > (sky(s).moveBudget ?? CFG.moveBudget) || seen.get(idx(x, y)) <= cost) continue;
      seen.set(idx(x, y), cost);
      const step = { x, y, cost, path: [...cur.path, [x, y]] };
      out.push(step);
      q.push(step);
    }
  }
  return out;
}

export function attackTargets(s, k) {
  const A = s.armies[k], e = other(k);
  if (!onMap(A)) return [];
  return DIRS.map(([dx, dy]) => [A.x + dx, A.y + dy])
    .filter(([x, y]) => inside(x, y))
    .map(([x, y]) => {
      const h = strongholdAt(s, x, y), army = armyAt(s, e, x, y);
      if (!army && !(h && h.owner !== k)) return null;
      return { x, y, stronghold: h?.name ?? null, owner: h?.owner ?? null, defender: army ? 'army' : 'garrison', strength: army ? s.armies[e].strength : h.garrison, odds: odds(s, k, x, y) };
    })
    .filter(Boolean);
}

// Both sides of an attack on (x,y), everything except the dice. fight() and odds() share it.
function sides(s, k, x, y) {
  const e = other(k), A = s.armies[k], E = s.armies[e], h = strongholdAt(s, x, y), vsArmy = armyAt(s, e, x, y);
  const supply = (kk) => (s.kingdoms[kk].food === 0 ? CFG.starveSupply : 1);
  const market = (kk) => +(1 + mood(s, kk)).toFixed(3);
  const defTerrain = CFG.terrain[terrainAt(x, y)].def * (vsArmy && E.fortified ? CFG.fortifyMod : 1);
  const atk = { side: k, strength: A.strength, morale: A.morale, terrain: terrainAt(A.x, A.y) === 'river' ? CFG.riverAttackMod : 1, supply: supply(k), market: market(k), weather: sky(s).attack ?? 1 };
  const def = vsArmy
    ? { side: e, strength: E.strength, morale: E.morale, terrain: defTerrain, supply: supply(e), market: market(e), home: s.owner[idx(x, y)] === e ? CFG.homeDefence : 1 }
    : { side: h.owner ?? 'neutral', garrison: true, strength: h.garrison, morale: 1, terrain: defTerrain, supply: 1, market: h.owner ? market(h.owner) : 1 };
  return { atk, def, vsArmy, h };
}
const basePower = (p) => p.strength * p.morale * p.terrain * p.supply * p.market * (p.weather ?? 1) * (p.home ?? 1);

// Attack odds before the dice: above 1 favours the attacker (the dice swing each side by up to ±20%).
export function odds(s, k, x, y) {
  const { atk, def } = sides(s, k, x, y);
  return +(basePower(atk) / Math.max(1, basePower(def))).toFixed(2);
}

// Fog of war: the enemy is visible within Chebyshev distance 3 (1 in fog) of your army or any stronghold you own.
export function intel(s, k) {
  const E = s.armies[other(k)];
  if (!onMap(E)) return { visible: true, routed: true, note: 'enemy army was routed and is regrouping at its capital' };
  const eyes = [...(onMap(s.armies[k]) ? [s.armies[k]] : []), ...s.strongholds.filter((h) => h.owner === k)];
  if (eyes.some((p) => cheb(p, E) <= (sky(s).vision ?? CFG.fogRange))) return { visible: true, x: E.x, y: E.y, strength: E.strength, morale: E.morale, fortified: E.fortified };
  const ls = s.kingdoms[k].lastSeen;
  return { visible: false, lastSeen: ls && { x: ls.x, y: ls.y, turnsAgo: s.turn - ls.turn } };
}

// Returns an error string, or null when the action is legal.
export function validate(s, k, { action, args = {} } = {}) {
  if (s.status !== 'running') return 'the season is over';
  const K = s.kingdoms[k], A = s.armies[k];
  if (!K) return `unknown kingdom "${k}"`;
  if (action === 'buy_food') {
    if (!Number.isInteger(args.n) || args.n < 1) return 'n must be a positive integer';
    return K.gold < 1 ? 'no gold to buy food' : K.food >= CFG.food.cap ? 'granary is full' : null;
  }
  if (k !== s.active) return `it is not ${k}'s turn`;
  if (!ACTIONS.includes(action)) return `unknown action "${action}"`;
  if (action === 'hold') return null;
  if (!onMap(A)) return 'your army is routed; you can only hold';
  if (action === 'fortify') return null;
  if (action === 'recruit') {
    if (!onOwnLand(s, k)) return 'you can only recruit while standing on your own land';
    if (!Number.isInteger(args.n) || args.n < 1) return 'n must be a positive integer';
    return recruitable(s, k) < 1 ? 'not enough gold, or the army is at max strength' : null;
  }
  const { x, y } = args;
  if (action === 'move') return legalMoves(s, k).some((m) => m.x === x && m.y === y) ? null : `(${x},${y}) is not reachable this turn`;
  return attackTargets(s, k).some((t) => t.x === x && t.y === y) ? null : `(${x},${y}) is not an adjacent enemy army or enemy/neutral stronghold`;
}

// Applies one action. General actions end the turn; buy_food (the quartermaster) does not.
export function applyAction(s0, k, a) {
  const err = validate(s0, k, a);
  if (err) return { error: err };
  const s = structuredClone(s0), A = s.armies[k], K = s.kingdoms[k], name = CAST[k].realm, args = a.args ?? {};
  const { ev, emit } = log();
  let battle = null;
  switch (a.action) {
    case 'buy_food': {
      const n = Math.min(args.n, K.gold, CFG.food.cap - K.food);
      K.gold -= n;
      K.food += n;
      emit('resources.updated', k, `${name} bought ${n} food (food ${K.food}/${CFG.food.cap}, gold ${K.gold})`, { bought: n, food: K.food, gold: K.gold });
      return { state: s, events: ev };
    }
    case 'hold':
      emit('army.held', k, `${name}'s army holds position`);
      break;
    case 'fortify':
      A.fortified = true;
      A.strength = Math.min(CFG.army.max, A.strength + CFG.fortifyHeal);
      emit('army.fortified', k, `${name} fortified at (${A.x},${A.y}); strength ${A.strength}`, { x: A.x, y: A.y, strength: A.strength });
      break;
    case 'recruit': {
      const n = Math.min(args.n, recruitable(s, k)), cost = recruitCost(s);
      K.gold -= n * cost;
      A.strength += n;
      emit('army.recruited', k, `${name} recruited ${n} troops for ${n * cost} gold (${cost} each at the LINK price); strength ${A.strength}`, { n, cost, strength: A.strength, gold: K.gold });
      break;
    }
    case 'move': {
      const m = legalMoves(s, k).find((mv) => mv.x === args.x && mv.y === args.y);
      const from = { x: A.x, y: A.y };
      for (const [x, y] of m.path) if (!strongholdAt(s, x, y)) s.owner[idx(x, y)] = k;
      Object.assign(A, { x: m.x, y: m.y });
      emit('army.moved', k, `${name} marched to (${m.x},${m.y})`, { from, x: m.x, y: m.y, path: m.path });
      break;
    }
    case 'attack':
      battle = fight(s, k, args.x, args.y, emit);
      break;
  }
  endTurn(s, k, emit);
  return { state: s, events: ev, battle };
}

// Deterministic, replayable roll: seed = sha256(season:turn:battle).
export function rolls(season, turn) {
  const seed = createHash('sha256').update(`${season}:${turn}:battle`).digest('hex');
  const r = (hex) => +((parseInt(hex, 16) / 0xffffffff) * 2 * CFG.combat.roll - CFG.combat.roll).toFixed(4);
  return { seed, atk: r(seed.slice(0, 8)), def: r(seed.slice(8, 16)) };
}

function fight(s, k, x, y, emit) {
  const e = other(k), A = s.armies[k], E = s.armies[e];
  const { atk, def, vsArmy, h } = sides(s, k, x, y);
  const { seed, atk: ra, def: rd } = rolls(s.season, s.turn);
  Object.assign(atk, { roll: ra });
  Object.assign(def, { roll: rd });
  const power = (p) => +(basePower(p) * (1 + p.roll)).toFixed(2);
  atk.power = power(atk);
  def.power = power(def);
  const won = atk.power > def.power; // ties go to the defender
  const ratio = won ? def.power / atk.power : atk.power / def.power;
  const loss = (str, lost) => Math.round(str * CFG.combat.loserLoss * (lost ? 1 : ratio));

  A.strength -= loss(A.strength, !won);
  A.morale = morale(A.morale + (won ? 1 : -1) * CFG.army.moraleStep);
  if (vsArmy) {
    E.strength -= loss(E.strength, won);
    E.morale = morale(E.morale + (won ? -1 : 1) * CFG.army.moraleStep);
  } else if (!won) h.garrison = Math.max(1, h.garrison - loss(h.garrison, false));

  const where = h?.name ?? `(${x},${y})`;
  const defName = vsArmy ? CAST[e].realm : 'the garrison';
  const battle = { season: s.season, turn: s.turn, x, y, stronghold: h?.name ?? null, weather: weatherKind(s), seed, attacker: atk, defender: def, winner: won ? k : def.side };
  emit('battle.resolved', k, `Battle at ${where}: ${CAST[k].realm} ${atk.power} vs ${defName} ${def.power}. ${won ? CAST[k].realm : defName} wins`, battle);

  rout(s, k, emit);
  if (vsArmy) rout(s, e, emit);
  if (!won) {
    retreat(s, k, emit);
    return battle;
  }
  if (vsArmy) retreat(s, e, emit);
  if (h && h.owner !== k && onMap(A)) {
    if (armyAt(s, e, x, y)) forceRout(s, e, emit, 'was surrounded with nowhere to retreat');
    const prev = h.owner;
    Object.assign(h, { owner: k, garrison: CFG.garrison.captured });
    s.owner[idx(x, y)] = k;
    Object.assign(A, { x, y });
    emit('stronghold.captured', k, `${CAST[k].realm} captured ${h.name}${prev ? ` from ${CAST[prev].realm}` : ''}`, { strongholdId: h.id, name: h.name, previousOwner: prev, x, y });
    if (h.capital) end(s, k, `captured the enemy capital, ${h.name}`, emit);
  }
  return battle;
}

function retreat(s, k, emit) {
  const A = s.armies[k];
  if (!onMap(A)) return;
  const c = capital(s, k), d = (x, y) => Math.abs(x - c.x) + Math.abs(y - c.y);
  const to = DIRS.map(([dx, dy]) => [A.x + dx, A.y + dy]).find(([x, y]) =>
    inside(x, y) && !armyAt(s, other(k), x, y) && (strongholdAt(s, x, y)?.owner ?? k) === k && d(x, y) < d(A.x, A.y));
  if (!to) return;
  Object.assign(A, { x: to[0], y: to[1] });
  emit('army.moved', k, `${CAST[k].realm} fell back to (${to[0]},${to[1]})`, { x: to[0], y: to[1], retreat: true });
}

function rout(s, k, emit) {
  if (onMap(s.armies[k]) && s.armies[k].strength < CFG.army.routBelow) forceRout(s, k, emit, 'broke and fled home');
}

function forceRout(s, k, emit, why) {
  // +1 because the counter ticks at the start of each own turn; the army sits out respawnTurns turns.
  Object.assign(s.armies[k], { routed: CFG.army.respawnTurns + 1, strength: 0, fortified: false });
  emit('army.routed', k, `${CAST[k].realm}'s army ${why}`, {});
}

function end(s, winner, reason, emit) {
  if (s.status !== 'running') return;
  Object.assign(s, { status: 'ended', winner, endReason: reason });
  emit('season.ended', winner, `Season ${s.season} is over: ${CAST[winner].realm} wins (${reason})`, { winner, reason, rounds: roundOf(s) });
}

function endTurn(s, k, emit) {
  for (const kk of ['red', 'blue']) {
    const i = intel(s, kk);
    if (i.visible && !i.routed) s.kingdoms[kk].lastSeen = { x: i.x, y: i.y, turn: s.turn };
  }
  if (s.status === 'running' && k === 'blue') {
    for (const kk of ['red', 'blue']) {
      const n = holdings(s, kk).strongholds, K = s.kingdoms[kk];
      K.holdStreak = n >= CFG.win.strongholds ? K.holdStreak + 1 : 0;
      if (K.holdStreak >= CFG.win.rounds) end(s, kk, `held ${n} of 7 strongholds for ${CFG.win.rounds} rounds`, emit);
    }
    if (s.status === 'running' && roundOf(s) >= s.maxRounds) {
      const score = (kk) => 10 * holdings(s, kk).strongholds + holdings(s, kk).tiles;
      const r = score('red'), b = score('blue');
      end(s, r > b ? 'red' : 'blue', `round limit reached, score ${r} to ${b}`, emit);
    }
  }
  if (s.status === 'running') {
    s.turn += 1;
    s.active = other(k);
  }
}

function log() {
  const ev = [];
  return { ev, emit: (type, kingdom, summary, data = {}) => ev.push({ type, kingdom, summary, data }) };
}
