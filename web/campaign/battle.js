// The battlefield: when the commander takes command of a battle, it is fought hour by hour on a small grid of the
// province's own ground, like a board game. Each army splits into units (foot, horse, archers) by its make-up; each
// hour both sides give orders, the units move and fight, and broken units flee. Pure and seeded, like the engine: the
// same setup and the same orders always give the same battle, so the server replays it from the record and a replay
// shows it again.
//   setup (from the engine's battleSetup): { at, ground, narrows, river, seed, plans: {a, d}, fit: {a, d}, armies: [...] }
//   record: { rounds: [{ orders: { unitId: { to: [x, y] } | { attack: unitId } | { hold: true } }, retreat: bool }], auto }
export const W = 12, H = 8, HOURS = 6;

export const TYPES = {
  foot: { name: 'foot', move: 2, hit: 1, def: 1 },
  horse: { name: 'horse', move: 4, hit: 1.1, def: 0.85 },
  bows: { name: 'archers', move: 2, hit: 0.55, def: 0.7, range: 2 },
};
export const GROUND = {
  open: { name: 'open ground', cost: 1, def: 1 },
  hill: { name: 'a hill', cost: 2, def: 1.25 },
  wood: { name: 'woods', cost: 2, def: 1.2, horse: 0.6 },
  marsh: { name: 'marsh', cost: 3, def: 1.1, horse: 0.5 },
  river: { name: 'the river', cost: 99, def: 1 },
  ford: { name: 'a ford', cost: 2, def: 0.85 },
  rock: { name: 'crags', cost: 99, def: 1 },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

// ---------- the ground, from the province's terrain ----------
function makeGround(setup, rnd) {
  const g = Array.from({ length: H }, () => Array(W).fill('open'));
  const patches = (kind, n, size) => {
    for (let i = 0; i < n; i++) {
      let x = 2 + Math.floor(rnd() * (W - 4)), y = Math.floor(rnd() * H);
      for (let k = 0; k < size; k++) {
        if (inside(x, y) && g[y][x] === 'open') g[y][x] = kind;
        x += Math.floor(rnd() * 3) - 1; y += Math.floor(rnd() * 3) - 1;
      }
    }
  };
  const t = setup.ground;
  if (t === 'hills') { patches('hill', 4, 6); patches('wood', 1, 4); }
  else if (t === 'mountains') { for (let x = 0; x < W; x++) { g[0][x] = 'rock'; g[H - 1][x] = 'rock'; if (setup.narrows) { g[1][x] = 'rock'; g[H - 2][x] = 'rock'; } } patches('hill', 4, 5); }
  else if (t === 'forest') { patches('wood', 5, 7); patches('hill', 1, 3); }
  else if (t === 'marsh') { patches('marsh', 5, 6); }
  else if (t === 'desert') { patches('hill', 2, 4); }
  else if (t === 'steppe') { patches('hill', 1, 3); }
  else { patches('hill', 2, 3); patches('wood', 2, 3); }
  if (setup.river || t === 'river') { // a river across the middle of the field, with two fords
    const x = 5 + Math.floor(rnd() * 2), f1 = 1 + Math.floor(rnd() * 3), f2 = 4 + Math.floor(rnd() * 3);
    for (let y = 0; y < H; y++) if (g[y][x] !== 'rock') g[y][x] = y === f1 || y === f2 ? 'ford' : 'river';
  }
  return g;
}

// ---------- the armies, split into units ----------
function makeUnits(setup) {
  const units = [];
  for (const camp of ['a', 'd']) {
    const list = setup.armies.filter((a) => a.camp === camp);
    let made = [];
    for (const a of list) {
      const horse = Math.round(a.men * a.horse), bows = Math.round(a.men * (a.tech?.includes('longbow') ? 0.3 : 0.15)), foot = a.men - horse - bows;
      const add = (type, men, n) => { if (men >= 600) made.push({ army: a.id, side: a.side, camp, type, men, start: men, morale: a.morale, q: a.q, gen: a.gen, hero: a.hero, n }); };
      const chunks = Math.max(1, Math.min(3, Math.round(foot / 9000)));
      for (let i = 0; i < chunks; i++) add('foot', Math.round(foot / chunks), i);
      add('horse', horse, 0);
      add('bows', bows, 0);
    }
    while (made.length > 9) { // no more than nine units a side: the two smallest foot units join
      const foot = made.filter((u) => u.type === 'foot').sort((x, y) => x.men - y.men);
      if (foot.length < 2) break;
      foot[1].men += foot[0].men; foot[1].start += foot[0].start;
      made = made.filter((u) => u !== foot[0]);
    }
    made.forEach((u, i) => units.push({ ...u, id: `${camp}${i}`, x: 0, y: 0, routed: false, gone: false, moved: false }));
  }
  return units;
}

// ---------- deployment: foot in the centre, horse on the wings, archers behind; the plan shapes it ----------
function deploy(f, setup) {
  const free = (x, y) => inside(x, y) && GROUND[f.ground[y][x]].cost < 99 && !f.units.some((u) => !u.gone && u.x === x && u.y === y);
  for (const camp of ['a', 'd']) {
    const us = f.units.filter((u) => u.camp === camp), plan = setup.plans[camp];
    const front = camp === 'a' ? (plan === 'ambush' ? 4 : 2) : W - 3, back = camp === 'a' ? front - 1 : front + 1, dir = camp === 'a' ? 1 : -1;
    const rows = [3, 4, 2, 5, 1, 6, 0, 7];
    const put = (u, xs, ys) => { for (const x of xs) for (const y of ys) if (free(x, y)) { u.x = x; u.y = y; u.placed = true; return true; } return false; };
    const foot = us.filter((u) => u.type === 'foot'), horse = us.filter((u) => u.type === 'horse'), bows = us.filter((u) => u.type === 'bows');
    const hillsFirst = (xs) => { // a side that holds the high ground stands on it
      if (plan !== 'hold' && plan !== 'narrows') return null;
      const cells = []; for (const x of xs) for (let y = 0; y < H; y++) if (['hill', 'wood'].includes(f.ground[y][x]) && free(x, y)) cells.push([x, y]);
      return cells;
    };
    const zone = camp === 'a' ? [front, front - 1, front + 1] : [front, front + 1, front - 1];
    const high = hillsFirst(camp === 'a' ? [0, 1, 2, 3] : [W - 4, W - 3, W - 2, W - 1]);
    for (const u of foot) { const h = high?.shift(); if (h) { u.x = h[0]; u.y = h[1]; u.placed = true; } else put(u, zone, rows); }
    const wings = plan === 'envelop' || plan === 'feint' ? [front + dir, front] : [front, back];
    horse.forEach((u, i) => put(u, wings, i % 2 ? [7, 6, 5, 0, 1] : [0, 1, 2, 7, 6]));
    for (const u of bows) put(u, [back, front], rows);
    const half = camp === 'a' ? [0, 1, 2, 3, 4] : [W - 1, W - 2, W - 3, W - 4, W - 5];
    for (const u of us) if (!u.placed) put(u, half, rows); // anywhere on its own side of the field
  }
}

export function newField(setup) {
  const rnd = mulberry(setup.seed);
  const f = { at: setup.at, place: setup.place, hour: 0, over: false, winner: null, ground: makeGround(setup, rnd), units: makeUnits(setup), log: [], plans: setup.plans, fit: setup.fit, you: setup.you, seed: setup.seed };
  deploy(f, setup);
  f.units = f.units.filter((u) => u.placed).map(({ placed, ...u }) => u);
  return f;
}

// ---------- moving ----------
const live = (f, camp) => f.units.filter((u) => !u.gone && (!camp || u.camp === camp));
const enemiesOf = (f, u) => live(f).filter((o) => o.camp !== u.camp);
function costAt(f, u, x, y) {
  const g = GROUND[f.ground[y][x]];
  return u.type === 'horse' && g.horse ? Math.ceil(g.cost / g.horse) : g.cost;
}
// The tiles a unit can reach this hour (it stops beside an enemy), with their cost.
export function reachOf(f, u) {
  const best = new Map([[`${u.x},${u.y}`, 0]]), queue = [[u.x, u.y, 0]], move = TYPES[u.type].move;
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = queue.shift();
    if ((x !== u.x || y !== u.y) && enemiesOf(f, u).some((e) => near(e, { x, y }) <= 1)) continue; // engaged: no further
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || live(f).some((o) => o !== u && o.x === nx && o.y === ny)) continue;
      const nc = c + costAt(f, u, nx, ny);
      if (nc > move || (best.has(`${nx},${ny}`) && best.get(`${nx},${ny}`) <= nc)) continue;
      best.set(`${nx},${ny}`, nc);
      queue.push([nx, ny, nc]);
    }
  }
  best.delete(`${u.x},${u.y}`);
  return [...best.keys()].map((k) => k.split(',').map(Number));
}
function stepToward(f, u, tx, ty) {
  const opts = reachOf(f, u);
  if (!opts.length) return;
  const d = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) + (Math.abs(x - tx) + Math.abs(y - ty)) * 0.01;
  const here = d(u.x, u.y), [bx, by] = opts.sort((a, b) => d(a[0], a[1]) - d(b[0], b[1]))[0];
  if (d(bx, by) < here) { u.x = bx; u.y = by; u.moved = true; }
}

// ---------- the enemy's general, by the rules: what each unit does this hour ----------
export function aiOrders(f, camp, temper = 'steady') {
  const out = {}, mine = live(f, camp), foes = live(f).filter((u) => u.camp !== camp);
  const defending = camp === 'd', waiting = defending && ['steady', 'cautious', 'delaying'].includes(temper) && f.hour < 2 && (f.plans.d === 'hold' || f.plans.d === 'narrows');
  for (const u of mine) {
    if (u.routed || !foes.length) continue;
    const byDist = [...foes].sort((a, b) => near(u, a) - near(u, b) || a.men - b.men);
    if (u.type === 'bows') { const t = byDist[0]; out[u.id] = near(u, t) <= 1 ? { to: [u.x + (camp === 'a' ? -1 : 1), u.y] } : { attack: t.id }; continue; }
    if (u.type === 'horse') { const t = [...foes].sort((a, b) => (a.type === 'bows' ? -1 : 0) - (b.type === 'bows' ? -1 : 0) || near(u, a) - near(u, b))[0]; out[u.id] = { attack: t.id }; continue; }
    if (waiting && !byDist.some((e) => near(u, e) <= 1)) { out[u.id] = { hold: true }; continue; }
    out[u.id] = { attack: byDist[0].id };
  }
  return out;
}

// ---------- one hour of battle ----------
export function hour(f0, orders = {}, { retreat = null, tempers = {} } = {}) {
  const f = JSON.parse(JSON.stringify(f0)), rnd = mulberry(f.seed + 7919 * (f.hour + 1));
  if (f.over) return f;
  const said = [];
  if (retreat) { // a camp that falls back: the battle ends, lost, but with no rout
    f.over = true; f.winner = retreat === 'a' ? 'd' : 'a'; f.withdrew = retreat;
    f.log.push({ hour: f.hour, text: `${retreat === f.you ? 'We fall back' : 'The enemy falls back'} in good order` });
    return f;
  }
  const all = { ...aiOrders(f, 'a', tempers.a), ...aiOrders(f, 'd', tempers.d), ...orders };
  for (const u of live(f)) u.moved = false;
  // movement: horse first, then foot and archers
  for (const u of [...live(f)].sort((a, b) => TYPES[b.type].move - TYPES[a.type].move || (a.id < b.id ? -1 : 1))) {
    if (u.routed) continue;
    const o = all[u.id];
    if (!o || o.hold) continue;
    const t = o.attack ? f.units.find((x) => x.id === o.attack && !x.gone) : null;
    if (t) { if (near(u, t) > (TYPES[u.type].range ?? 1)) stepToward(f, u, t.x, t.y); }
    else if (Array.isArray(o.to)) stepToward(f, u, o.to[0], o.to[1]);
  }
  // fighting: every unit strikes the enemy it can reach, the one it was sent against if it can
  const hits = [];
  for (const u of live(f)) {
    if (u.routed) continue;
    const range = TYPES[u.type].range ?? 1, adj = enemiesOf(f, u).filter((e) => near(u, e) <= 1), inRange = enemiesOf(f, u).filter((e) => near(u, e) <= range);
    const pool = adj.length ? adj : u.type === 'bows' ? inRange : [];
    if (!pool.length) continue;
    const want = all[u.id]?.attack, t = pool.find((e) => e.id === want) ?? [...pool].sort((a, b) => a.men * a.morale - b.men * b.morale)[0];
    hits.push([u, t]);
  }
  for (const [u, t] of hits) {
    const many = hits.filter(([, x]) => x === t).length, g = GROUND[f.ground[t.y][t.x]];
    const charge = u.type === 'horse' && u.moved && !['wood', 'marsh', 'hill'].includes(f.ground[t.y][t.x]) ? 1.3 : 1;
    const spears = t.type === 'foot' && u.type === 'horse' ? 0.8 : 1; // the horse breaks on steady foot
    const plan = 1 + 0.25 * (f.fit[u.camp] ?? 0) * (f.hour < 3 ? 1 : 0.5);
    const dmg = u.men * u.q * TYPES[u.type].hit * charge * spears * plan * (0.5 + u.morale / 200) * (1 + 0.25 * (many - 1)) / (g.def * TYPES[t.type].def) * 0.055 * (0.85 + 0.3 * rnd());
    t.hurt = (t.hurt ?? 0) + dmg;
    t.flanked = Math.max(t.flanked ?? 0, many);
  }
  for (const t of live(f)) {
    if (!t.hurt) continue;
    const k = Math.min(t.men, Math.round(t.hurt));
    t.men -= k; t.lost = (t.lost ?? 0) + k;
    t.morale = clamp(t.morale - (k / t.start) * 140 - (t.flanked > 1 ? 6 : 0), 0, 100);
    delete t.hurt; delete t.flanked;
  }
  // the broken flee: a third of them are cut down as they go, the rest rejoin their army after the battle
  for (const u of live(f)) {
    if (u.morale >= 22 && u.men >= u.start * 0.25) continue;
    const cut = Math.round(u.men * 0.3);
    u.men -= cut; u.lost = (u.lost ?? 0) + cut; u.gone = true; u.routed = true;
    f.log.push({ hour: f.hour, camp: u.camp, unit: u.id, text: `${label(u)} ${u.camp === f.you ? 'breaks and flees' : 'breaks and flees: the enemy line is opening'}` });
    for (const o of live(f, u.camp)) o.morale = clamp(o.morale - 6, 0, 100); // the sight of it shakes their friends
  }
  f.hour += 1;
  const left = { a: live(f, 'a').length, d: live(f, 'd').length };
  if (!left.a || !left.d || f.hour >= HOURS) {
    f.over = true;
    const power = (c) => live(f, c).reduce((t, u) => t + u.men * (0.5 + u.morale / 200) * u.q, 0);
    f.winner = !left.a ? 'd' : !left.d ? 'a' : power('a') >= power('d') ? 'a' : 'd';
    f.log.push({ hour: f.hour, text: !left.a || !left.d ? 'The field is won' : 'Night falls on the field; the weaker side draws off in the dark' });
  }
  f.said = said;
  return f;
}
export const label = (u) => { const n = u.gen?.split(' ').at(-1); return n ? `${n}${n.endsWith('s') ? '’' : '’s'} ${TYPES[u.type].name}` : `the ${TYPES[u.type].name}`; };

// The whole battle from its record: the engine's way of fighting a commanded battle. What each army lost, and who won.
export function play(setup, record = {}, tempers = {}) {
  let f = newField(setup);
  const rounds = Array.isArray(record.rounds) ? record.rounds.slice(0, HOURS) : [];
  for (const r of rounds) { if (f.over) break; f = hour(f, sanitize(f, r.orders), { retreat: r.retreat ? f.you : null, tempers }); }
  while (!f.over) f = hour(f, record.auto ? aiOrders(f, f.you, 'steady') : {}, { tempers }); // the rest of the day, as the general fights it
  return { field: f, ...outcome(f, setup) };
}
// Only the commander's own units, and only orders of the known kinds.
export function sanitize(f, orders = {}) {
  const out = {};
  for (const [id, o] of Object.entries(orders ?? {})) {
    const u = f.units.find((x) => x.id === id);
    if (!u || u.camp !== f.you || !o || typeof o !== 'object') continue;
    if (o.hold) out[id] = { hold: true };
    else if (typeof o.attack === 'string' && f.units.some((x) => x.id === o.attack && x.camp !== u.camp)) out[id] = { attack: o.attack };
    else if (Array.isArray(o.to) && inside(o.to[0] | 0, o.to[1] | 0)) out[id] = { to: [o.to[0] | 0, o.to[1] | 0] };
  }
  return out;
}
export function outcome(f, setup) {
  const lost = {}, men = {};
  for (const u of f.units) { lost[u.army] = (lost[u.army] ?? 0) + (u.lost ?? 0); men[u.army] = (men[u.army] ?? 0) + u.start; }
  const camp = (c) => setup.armies.filter((a) => a.camp === c).map((a) => a.id), sum = (ids, o) => ids.reduce((t, id) => t + (o[id] ?? 0), 0);
  const loser = f.winner === 'a' ? 'd' : 'a', share = sum(camp(loser), lost) / Math.max(1, sum(camp(loser), men));
  return { aWins: f.winner === 'a', lost, decisive: !f.withdrew && (share >= 0.35 || live(f, loser).length === 0), withdrew: f.withdrew ?? null };
}

// ---------- the commander's words, by the rules ----------
// “Horse, round their left!”, “Hold the hill”, “Archers, loose at their foot”, “Charge!”, “Fall back”: which of our
// units, doing what, against whom. The AI may read the words too (server: /battle); its orders pass sanitize() as well.
const KINDS = [['horse', /\b(horse|horsemen|cavalry|riders?|knights|companions|numidians?|cataphracts?)\b/], ['bows', /\b(archers?|bows?|bowmen|slingers?|skirmishers?|javelin\w*|arrows?)\b/], ['foot', /\b(foot|infantry|phalanx|legions?|legionaries|spears?|pikes?|hoplites|line|centre|center|men)\b/]];
const sideWord = (t) => (/\b(left)\b/.test(t) ? 'left' : /\b(right)\b/.test(t) ? 'right' : /\b(centre|center|middle)\b/.test(t) ? 'centre' : null);
// left and right as the commander faces the enemy: the attacker faces east, the defender west
const onSide = (f, camp, u, w) => { const north = camp === 'a' ? w === 'left' : w === 'right'; return w === 'centre' ? u.y >= 2 && u.y <= 5 : north ? u.y <= 3 : u.y >= 4; };
export function battleWords(f, text) {
  const parts = String(text ?? '').split(/[.!;?]+|\bthen\b/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) { // each sentence its own order, the later ones over the earlier
    const out = { orders: {}, retreat: false, said: null };
    for (const part of parts) { const r = battleWords(f, part); if (r.retreat) return r; Object.assign(out.orders, r.orders); out.said ??= r.said; }
    if (Object.keys(out.orders).length) out.said = null;
    return out;
  }
  const t = String(text ?? '').toLowerCase(), you = f.you, mine = live(f, you), foes = live(f).filter((u) => u.camp !== you), orders = {};
  if (/\b(fall back|retreat|withdraw|sound the retreat|break off)\b/.test(t)) return { orders, retreat: true, said: 'We fall back, in good order.' };
  const theirs = t.match(/\b(their|the enemy'?s?|at the|on the|against)\b(.*)$/)?.[2] ?? '';
  const ours = theirs ? t.slice(0, t.length - theirs.length) : t;
  let who = mine.filter((u) => KINDS.some(([k, re]) => re.test(ours) && u.type === k));
  const w = sideWord(ours);
  if (w && !theirs) who = (who.length ? who : mine).filter((u) => onSide(f, you, u, w));
  if (!who.length) who = mine;
  let targets = foes.filter((u) => KINDS.some(([k, re]) => re.test(theirs) && u.type === k));
  const tw = sideWord(theirs);
  if (tw) targets = (targets.length ? targets : foes).filter((u) => onSide(f, u.camp, u, tw));
  if (/\b(king|general|commander|leader)\b/.test(theirs)) targets = foes.filter((u) => u.hero || u.type === 'foot').sort((a, b) => b.men - a.men).slice(0, 1);
  const nearestOf = (u, list) => [...list].sort((a, b) => near(u, a) - near(u, b))[0];
  let did = '';
  if (/\b(hold|stand|stay|keep|defend|steady|wait)\b/.test(t) && !/\b(hill|high ground)\b/.test(t)) { for (const u of who) orders[u.id] = { hold: true }; did = 'hold'; }
  else if (/\b(hill|high ground|heights?|woods?|trees)\b/.test(t)) {
    const want = /\b(woods?|trees)\b/.test(t) ? ['wood'] : ['hill'];
    for (const u of who) {
      let best = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (want.includes(f.ground[y][x]) && !live(f).some((o) => o !== u && o.x === x && o.y === y) && (!best || near(u, { x, y }) < near(u, best))) best = { x, y };
      if (best) orders[u.id] = { to: [best.x, best.y] };
    }
    did = want[0] === 'wood' ? 'woods' : 'hill';
  } else if (/\b(flank|round|around|wheel|behind|rear|envelop|encircle|outflank|turn their)\b/.test(t)) {
    const flank = tw ?? (who.reduce((t2, u) => t2 + u.y, 0) / Math.max(1, who.length) < H / 2 ? 'left' : 'right');
    const enemyNorth = you === 'a' ? flank === 'left' : flank === 'right', y = enemyNorth ? 0 : H - 1;
    const rear = Math.max(...foes.map((u) => (you === 'a' ? u.x : -u.x)), 0) * (you === 'a' ? 1 : -1);
    for (const u of who) orders[u.id] = { to: [Math.max(0, Math.min(W - 1, rear + (you === 'a' ? 1 : -1))), y] };
    did = 'flank';
  } else if (/\b(charge|attack|strike|hit|engage|loose|shoot|fire|advance|forward|push|close|at them|crush|break)\b/.test(t)) {
    for (const u of who) { const e = nearestOf(u, targets.length ? targets : foes); if (e) orders[u.id] = { attack: e.id }; }
    did = 'attack';
  }
  return { orders: sanitize(f, orders), retreat: false, said: did ? null : 'Tell us what to do, sir: charge, hold, take the hill, go round their flank, or fall back.' };
}

// What the officers report after an hour: who broke, how the losses stand, where the line is in danger.
export function report(f0, f1) {
  const lines = [], you = f1.you, lost = (f, c) => f.units.filter((u) => u.camp === c).reduce((t, u) => t + (u.lost ?? 0), 0);
  for (const l of f1.log.filter((x) => x.hour === f0.hour)) lines.push({ unit: l.unit, camp: l.camp, text: l.text });
  const ours = lost(f1, you) - lost(f0, you), theirs = lost(f1, you === 'a' ? 'd' : 'a') - lost(f0, you === 'a' ? 'd' : 'a');
  if (ours + theirs > 0) lines.push({ text: `This hour we lost ${fmt(ours)}, they lost ${fmt(theirs)}.${ours > theirs * 1.5 ? ' We cannot go on like this.' : theirs > ours * 1.5 ? ' They are bleeding.' : ''}` });
  const shaky = live(f1, you).filter((u) => u.morale < 40).sort((a, b) => a.morale - b.morale)[0];
  if (shaky && !f1.over) lines.push({ unit: shaky.id, camp: you, text: `${label(shaky)} is wavering: it needs help, or rest.` });
  const flanked = live(f1, you).find((u) => live(f1).filter((e) => e.camp !== you && near(e, u) <= 1).length >= 2);
  if (flanked && !f1.over) lines.push({ unit: flanked.id, camp: you, text: `${label(flanked)} is attacked from two sides!` });
  return lines;
}
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);
