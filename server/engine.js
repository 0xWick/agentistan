// Pure game rules: no I/O, no clock. The only randomness is the seeded battle roll.
import { createHash } from 'node:crypto';
import { CFG, MAP, STRONGHOLDS, CAST, SCENARIOS, REGIONS, CLIMATES, regionAt } from './config.js';

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
// Deal each region a city: shuffle the five climates across the five regions, then pick a city in each.
// Seeded by the season, so a season always has the same skies (and replays agree).
export function skiesFor(season) {
  const h = createHash('sha256').update(`${season}:skies`).digest();
  const climates = Object.keys(CLIMATES);
  for (let i = climates.length - 1; i > 0; i--) {
    const j = h[i] % (i + 1);
    [climates[i], climates[j]] = [climates[j], climates[i]];
  }
  return { regions: Object.fromEntries(REGIONS.map((r, i) => {
    const pool = CLIMATES[climates[i]];
    return [r.id, { kind: 'clear', name: r.name, climate: climates[i], place: pool[h[10 + i] % pool.length].name }];
  })) };
}

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
    weather: skiesFor(season),
    status: 'running', winner: null, endReason: null,
  };
}

// Older saves: before markets (ETH carries over, the rest start from their next reading) and before the five weather regions.
export function upgrade(s0) {
  if (s0.market?.ETH && s0.weather?.regions?.mid) return s0;
  const s = structuredClone(s0), old = s.market ?? {};
  if (!s.market?.ETH) s.market = Object.fromEntries(COINS.map((c) => [c, old[c] ?? (c === 'ETH' ? { start: old.start ?? null, price: old.price ?? null } : { start: null, price: null })]));
  if (!s.weather?.regions?.mid) s.weather = skiesFor(s.season);
  return s;
}

// % change of a coin since the season began (0 until there are two readings).
export const marketPct = (s, coin) => {
  const m = s.market[coin];
  return m?.start && m?.price ? +((m.price / m.start - 1) * 100).toFixed(3) : 0;
};
export const coinOf = (k) => CFG.market.coin[k];
export const mood = (s, k) => { // battle power bonus (or penalty) from your coin's trend this season
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

// Weather from Open-Meteo's current conditions (WMO weather codes, °C, km/h). Only a mild, calm, dry day counts as clear,
// so with the regions' cities some kind of weather is nearly always on the map.
export function classifyWeather({ code, tempC, windKmh }) {
  if (code >= 95 || windKmh >= 40) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (windKmh >= 18) return 'wind';
  if (tempC >= 27) return 'heat';
  if (tempC <= 8) return 'cold';
  return 'clear';
}
export const weatherAt = (s, x, y) => s.weather?.regions?.[regionAt(x, y)]?.kind ?? 'clear';
const sky = (s, x, y) => CFG.weather[weatherAt(s, x, y)] ?? {};

export function setWeather(s0, region, w) {
  const s = structuredClone(s0);
  s.weather.regions[region] = { ...s.weather.regions[region], ...w, kind: classifyWeather(w) };
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
  return CFG.gold.base + CFG.gold.perFort * forts + Math.floor(tiles / CFG.gold.tilesPer);
}

// The treasury is held in the kingdom's coin: each turn it gains or loses gold with the coin's move since its last turn.
export function dividend(s, k) {
  const m = s.market[coinOf(k)];
  const pct = m?.price && m?.last ? +((m.price / m.last - 1) * 100).toFixed(3) : 0;
  return { coin: coinOf(k), pct, gold: Math.round(pct * CFG.market.dividend) };
}

export const recruitable = (s, k) => Math.max(0, Math.min(Math.floor(s.kingdoms[k].gold / recruitCost(s)), CFG.army.max - s.armies[k].strength));
const onOwnLand = (s, k) => s.owner[idx(s.armies[k].x, s.armies[k].y)] === k;
export const eats = (s, k) => {
  const A = s.armies[k];
  return onMap(A) ? Math.ceil((A.strength / CFG.food.perStrength) * (sky(s, A.x, A.y).eat ?? 1)) : 0;
};

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
  const gold = income(s, k), div = dividend(s, k), eat = eats(s, k), wx = onMap(A) ? weatherAt(s, A.x, A.y) : null;
  const forage = wx ? CFG.weather[wx].forage ?? 0 : 0, m = s.market[div.coin];
  if (m?.price) m.last = m.price; // the next dividend counts from here
  K.gold = Math.max(0, K.gold + gold + div.gold);
  K.food = clamp(K.food + CFG.food.base + CFG.food.perFort * holdings(s, k).forts + forage - eat, 0, CFG.food.cap);
  K.dividend = div;
  const coinText = div.gold ? `, ${div.coin} ${div.pct >= 0 ? '+' : ''}${div.pct.toFixed(2)}% since its last turn: ${div.gold >= 0 ? '+' : ''}${div.gold} gold` : '';
  const foodText = `ate ${eat} food${CFG.weather[wx]?.eat ? ` in the ${wx}` : ''}${forage ? `, foraged ${forage} in the clear weather` : ''}`;
  emit('resources.updated', k, `${CAST[k].realm} +${gold} gold${coinText}; ${foodText}; food ${K.food}/${CFG.food.cap}`,
    { gold: K.gold, income: gold, dividend: div.gold, dividendPct: div.pct, coin: div.coin, food: K.food, eat, forage, weather: wx });
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
      const cost = cur.cost + CFG.terrain[terrainAt(x, y)].cost + (sky(s, x, y).moveCost ?? 0); // mud, drifts, storms
      if (cost > CFG.moveBudget || seen.get(idx(x, y)) <= cost) continue;
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
  const atk = { side: k, strength: A.strength, morale: A.morale, terrain: terrainAt(A.x, A.y) === 'river' ? CFG.riverAttackMod : 1, supply: supply(k), market: market(k), weather: sky(s, x, y).attack ?? 1 };
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

// Fog of war: the enemy is visible within Chebyshev distance 3 of your army or any stronghold you own
// (1 if the enemy stands in a foggy region).
export function intel(s, k) {
  const E = s.armies[other(k)];
  if (!onMap(E)) return { visible: true, routed: true, note: 'enemy army was routed and is regrouping at its capital' };
  const eyes = [...(onMap(s.armies[k]) ? [s.armies[k]] : []), ...s.strongholds.filter((h) => h.owner === k)];
  if (eyes.some((p) => cheb(p, E) <= (sky(s, E.x, E.y).vision ?? CFG.fogRange))) return { visible: true, x: E.x, y: E.y, strength: E.strength, morale: E.morale, fortified: E.fortified };
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
  const battle = { season: s.season, turn: s.turn, x, y, stronghold: h?.name ?? null, weather: weatherAt(s, x, y), seed, attacker: atk, defender: def, winner: won ? k : def.side };
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
