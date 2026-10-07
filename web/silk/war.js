// War: every war is a conflict with a cause, sides and a story. Armies march along the cheapest road the seasons
// allow; when they meet, a battle runs for one to three months until a side breaks; towns fall to siege or storm.
import { RULES as R } from './rules.js';
import { PROV, PROVINCES, provincesOf, armiesOf, armiesChanged, realmsChanged, living, atWar, warOf, truceUntil, friendly, allied, key, setOwner, weatherOf, isWinter, clamp, round1, between, chance, rngFor,
  short, ofR, say, vb, poss, nameOf, cityOf, placeOf, months, logWar, yearOf, menText } from './core.js';
import { cavalryOf, wallPower, garrisonOf, strength, incomeOf, knows, pairTreaties } from './economy.js';
import { carryOff } from './world.js';
import { die } from './court.js';

const T = (s, c, k) => R.temper.general[s.chars[c]?.temper]?.[k];

// ---------- conflicts: wars as stories ----------
const CAUSE = {
  border: (s, a, b) => `${say(s, a, 'covets')} the riches of ${ofR(s, b)}`,
  claim: (s, a, b, o) => `${say(s, a, 'claims')} ${cityOf(s, o.place)}, which the registry once gave ${s.realms[a].plural ? 'them' : 'it'}`,
  revenge: (s, a, b) => `${say(s, b, 'was')} unmasked behind a plot against ${ofR(s, a)}`,
  horde: (s, a, b) => `The Great Khan demands that ${short(s, b)} ${vb(s, b, 'bows')}`,
  rising: (s, a, b) => `The people rise against ${ofR(s, b)}`,
  independence: (s, a, b) => `${say(s, a, 'throws')} off the rule of ${ofR(s, b)}`,
  split: (s, a, b) => `A great lord breaks away from ${ofR(s, b)}`,
  steppe: () => 'A war for the mastery of the steppe',
  history: () => 'A quarrel already under way when the age began',
  defiance: (s, a, b) => `${say(s, b, 'defied')} the arbiter's verdict`,
  oath: (s, a, b) => `${say(s, a, 'breaks')} the truce sworn with ${ofR(s, b)}`,
  coat: (s, a, b) => `A general of ${ofR(s, b)} went over to ${ofR(s, a)}`,
  expedition: (s, a, b) => `Knights who owed ${ofR(s, a)} for their ships were paid in the riches of ${ofR(s, b)}`,
};
function conflictName(s, a, b, o) {
  const A = s.realms[a], B = s.realms[b];
  if (o.cause === 'horde') return `The invasion of ${B.short}`;
  if (o.cause === 'expedition') return `The expedition against ${cityOf(s, B.capital)}`;
  if (o.cause === 'rising') return `The rising of ${placeOf(s, A.capital)}`;
  if (o.cause === 'independence') return `${poss(A.short)} war of independence`;
  if (o.cause === 'claim' && o.place) return `The war for ${cityOf(s, o.place)}`;
  if (o.cause === 'split') return `The ${placeOf(s, A.capital)} secession`;
  return `The war of ${ofR(s, a)} and ${ofR(s, b)}`;
}

export function declareWar(s, a, b, emit, o = {}) {
  const A = s.realms[a], B = s.realms[b];
  if (!A || !B || A.fallen || B.fallen || a === b || atWar(s, a, b)) return false;
  if (B.overlord === a) return false; // a vassal that bowed is not attacked by its own overlord
  const truce = truceUntil(s, a, b) > s.month;
  if (truce && !o.breakTruce) return false;
  if (A.overlord === b) A.overlord = null;
  // Oaths broken by this war are written down for good: the realm's word is worth less from now on.
  for (const t of pairTreaties(s, a, b)) if (!t.pay || t.pay.from === a) breakTreaty(s, t, a, emit);
  delete s.allies[key(a, b)];
  let cid = o.join;
  if (!cid) {
    cid = `w${s.nextId++}`;
    const cause = o.cause ?? (truce ? 'oath' : 'border');
    s.conflicts[cid] = { id: cid, name: conflictName(s, a, b, o), cause, why: (CAUSE[cause] ?? CAUSE.border)(s, a, b, o), by: a, vs: b, side: { [a]: 'a', [b]: 'b' }, since: s.month, ended: null,
      outcome: null, log: [], gains: {}, deaths: [], battles: 0, score: { a: 0, b: 0 }, treaty: null, place: o.place ?? null, peak: { a: strength(s, a), b: strength(s, b) } };
  } else {
    const c = s.conflicts[cid];
    if (c && !c.side[a]) c.side[a] = c.side[b] === 'a' ? 'b' : 'a';
    if (c && !c.side[b]) c.side[b] = c.side[a] === 'a' ? 'b' : 'a';
  }
  s.wars[key(a, b)] = { since: s.month, conflict: cid };
  const text = o.text ?? `${say(s, a, 'declares')} war on ${ofR(s, b)}`;
  emit('war', text, { realms: [a, b], war: cid });
  logWar(s, cid, { k: o.join ? 'join' : 'begun', text, realms: [a, b] });
  // Allies honour the alliance.
  for (const k of Object.keys(s.allies)) {
    const [x, y] = k.split('|'), friend = x === b ? y : y === b ? x : null;
    if (friend && friend !== a && !atWar(s, friend, a) && !s.realms[friend].fallen && !allied(s, friend, a)) {
      s.wars[key(friend, a)] = { since: s.month, conflict: cid };
      if (s.conflicts[cid] && !s.conflicts[cid].side[friend]) s.conflicts[cid].side[friend] = s.conflicts[cid].side[b];
      const t = `${say(s, friend, 'joins')} the war at the side of ${ofR(s, b)}`;
      emit('war', t, { realms: [friend, a], war: cid });
      logWar(s, cid, { k: 'join', text: t, realms: [friend, b] });
      for (const tr of pairTreaties(s, friend, a)) breakTreaty(s, tr, friend, emit, true);
    }
  }
  return true;
}

// A treaty broken: the record stays, and so does the stain on the breaker's word.
export function breakTreaty(s, t, by, emit, excused = false) {
  if (t.ended !== null) return;
  t.ended = s.month;
  t.broken = { by, m: s.month };
  const r = s.realms[by];
  if (r && !excused) {
    r.rep = clamp((r.rep ?? R.reputation.start) - R.reputation.broken, 0, 100);
    emit('broken', `${say(s, by, 'breaks')} the ${t.name ?? 'treaty'} with ${ofR(s, t.parties.find((p) => p !== by))}: an oath broken`, { realms: t.parties, treaty: t.id });
  }
}

// Who is winning: captures count most, then battles won.
const sideOf = (c, id) => c?.side?.[id];
function score(s, cid, realm, n) {
  const c = s.conflicts[cid], side = sideOf(c, realm);
  if (side) c.score[side] = round1(c.score[side] + n);
}

// Peace, and the terms the stronger side can ask: towns already taken are kept, and a beaten realm may owe tribute.
export function peaceTerms(s, a, b) {
  const w = warOf(s, a, b), c = s.conflicts[w?.conflict];
  const sa = c ? c.score[sideOf(c, a)] ?? 0 : 0, sb = c ? c.score[sideOf(c, b)] ?? 0 : 0;
  const [winner, loser, lead] = sa >= sb ? [a, b, sa - sb] : [b, a, sb - sa];
  const tribute = lead >= 6 && strength(s, loser) < strength(s, winner) ? round1(Math.max(1, incomeOf(s, loser) * R.diplomacy.tribute.share)) : 0;
  return { winner: lead >= 3 ? winner : null, loser: lead >= 3 ? loser : null, tribute, lead };
}

export function makePeace(s, a, b, emit, terms = peaceTerms(s, a, b)) {
  const w = warOf(s, a, b), cid = w?.conflict, c = s.conflicts[cid];
  delete s.wars[key(a, b)];
  s.truces[key(a, b)] = s.month + R.diplomacy.truce;
  for (const pid of Object.keys(s.provinces)) { // sieges between them are lifted
    const sg = s.provinces[pid].siege;
    if (sg && ((sg.realm === a && s.provinces[pid].owner === b) || (sg.realm === b && s.provinces[pid].owner === a))) s.provinces[pid].siege = null;
  }
  for (const bt of Object.values(s.battles)) if ([...bt.ra, ...bt.rd].includes(a) && [...bt.ra, ...bt.rd].includes(b)) endBattle(s, bt, null, emit, true);
  const gains = c ? (c.gains[a] ?? []).filter((p) => s.provinces[p].owner === a).length + (c.gains[b] ?? []).filter((p) => s.provinces[p].owner === b).length : 0;
  const tid = `t${s.nextId++}`;
  const name = c ? `peace that ended ${c.name.replace(/^The /, 'the ')}` : 'peace';
  s.treaties[tid] = { id: tid, kind: 'peace', name: `Peace of ${terms.winner ? cityOf(s, s.realms[terms.winner].capital) : cityOf(s, s.realms[a].capital)}`, parties: [a, b], signed: s.month,
    until: s.month + (terms.tribute ? R.diplomacy.tribute.months : R.diplomacy.truce), ended: null, broken: null, war: cid ?? null,
    pay: terms.tribute ? { from: terms.loser, to: terms.winner, gold: terms.tribute } : null, text: name, sealed: null };
  const text = terms.winner
    ? `${short(s, a)} and ${short(s, b)} make peace: ${short(s, terms.loser)} ${vb(s, terms.loser, 'yields')}${terms.tribute ? ` and ${vb(s, terms.loser, 'pays')} ${terms.tribute} gold a month for five years` : ''}`
    : `${short(s, a)} and ${short(s, b)} make peace${gains ? '' : ', and nothing has changed'}`;
  emit('peace', text, { realms: [a, b], war: cid, treaty: tid });
  if (c) {
    logWar(s, cid, { k: 'peace', text, realms: [a, b] });
    if (!Object.values(s.wars).some((x) => x.conflict === cid)) Object.assign(c, { ended: s.month, treaty: tid, outcome: terms.winner ? `${short(s, terms.winner)} ${vb(s, terms.winner, 'wins')}` : 'A peace with no victor' });
  }
  return tid;
}

// ---------- marching ----------
// Months for an army to go from one province into the next: the ground it enters, then whatever lies on the road
// between (a great river to ford, a pass closed in winter, a strait to sail), and the weather of the season.
export function moveCost(s, realm, from, pid) {
  const t = PROV[pid].terrain, way = PROV[from]?.ways?.[pid] ?? {}, X = R.cross, r = s.realms[realm], nomad = r?.nomad;
  if (way.sea && nomad) return Infinity; // riders don't take ship
  let c = R.move[t] ?? 1;
  if (nomad && ['steppe', 'desert', 'plains', 'river'].includes(t)) c = Math.max(0.5, c / R.nomadSpeed);
  c += (way.river ?? 0) * X.river + (way.pass ? X.pass : 0) + (way.sea ? Math.max(1, X.sea - (knows(r, 'compass') ? 1 : 0)) : 0) + (way.caravan ? X.desert : 0);
  if (isWinter(s.month) && (t === 'mountains' || way.pass)) c += X.winter;
  const w = weatherOf(pid, s.month);
  if (w === 'snow' && !nomad) c += R.seasons.snow.move;
  if (w === 'rains' && ['plains', 'river', 'forest'].includes(t)) c += R.seasons.rains.move + (way.river ? 1 : 0); // the rivers burst their banks
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
      const d = dist[cur] + moveCost(s, realm, cur, n);
      if (d < (dist[n] ?? Infinity)) { dist[n] = d; prev[n] = cur; open.push(n); }
    }
  }
  if (dist[to] === undefined || !Number.isFinite(dist[to])) return null;
  const path = [];
  for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  return { path, months: dist[to] };
}

export function march(s, rng, emit) {
  for (const a of Object.values(s.armies)) {
    if (a.mode === 'siege' || a.battle || a.rest > 0 || !a.path.length) continue;
    let budget = 1;
    while (budget > 0 && a.path.length && s.armies[a.id]) {
      const next = a.path[0];
      if (!a.eta) a.eta = moveCost(s, a.realm, a.at, next);
      const step = Math.min(budget, a.eta);
      a.eta = round1(a.eta - step);
      budget = round1(budget - step);
      if (a.eta > 0) break;
      a.path.shift();
      a.at = next;
      a.eta = 0;
      if (arrive(s, emit, a)) break;
    }
  }
  // Armies of realms at war that share a province, and are not yet fighting, meet in battle.
  const byPlace = {};
  for (const a of Object.values(s.armies)) (byPlace[a.at] ??= []).push(a);
  for (const list of Object.values(byPlace)) {
    for (const a of list) for (const b of list) {
      if (a.id < b.id && s.armies[a.id] && s.armies[b.id] && atWar(s, a.realm, b.realm) && a.mode !== 'garrison' && b.mode !== 'garrison' && !(a.battle && a.battle === b.battle)) {
        const defender = s.provinces[a.at].owner === a.realm ? a : b;
        engage(s, defender === a ? b : a, defender, emit);
      }
    }
  }
}

// Returns true when the army stops here (a battle or a siege).
function arrive(s, emit, a) {
  const pid = a.at;
  const foe = Object.values(s.armies).find((b) => b.at === pid && b.id !== a.id && atWar(s, a.realm, b.realm) && b.mode !== 'garrison');
  if (foe) {
    engage(s, a, foe, emit);
    return true;
  }
  return beginSiege(s, a, emit);
}

// An army in hostile land with no army left to stop it settles down before the walls.
export function beginSiege(s, a, emit) {
  const pid = a.at, p = s.provinces[pid], owner = p.owner;
  if (owner === a.realm || friendly(s, a.realm, owner) || (owner !== null && !atWar(s, a.realm, owner))) return false;
  if (Object.values(s.armies).some((b) => b.at === pid && atWar(s, a.realm, b.realm) && b.mode !== 'garrison')) return false;
  if (!p.siege || !s.armies[p.siege.army]) {
    const r = s.realms[a.realm], craft = (knows(r, 'trebuchet') || knows(r, 'torsion') ? 1 : 0) + (knows(r, 'gunpowder') ? 1 : 0);
    p.siege = { realm: a.realm, army: a.id, left: Math.max(1, R.walls.baseMonths + p.walls * R.walls.siegeMonths - ((s.chars[a.general]?.skill ?? 2) >= 4 ? 1 : 0) - craft), since: s.month };
    const cid = warOf(s, a.realm, owner)?.conflict;
    emit('siege', `${say(s, a.realm, 'lays')} siege to ${cityOf(s, pid)}`, { realms: [a.realm, owner].filter(Boolean), at: pid, chars: [a.general].filter(Boolean), war: cid });
  }
  a.mode = 'siege';
  a.path = [];
  return true;
}

// ---------- battles that last ----------
// Two armies meet: a battle begins, or the newcomer joins the one already raging there.
function engage(s, att, def, emit) {
  const pid = def.at;
  const bt = s.battles[def.battle] ?? s.battles[att.battle];
  if (bt) { // the newcomer fights against the army it met
    const inA = (x) => bt.a.includes(x.id), inD = (x) => bt.d.includes(x.id);
    const [newcomer, known] = inA(att) || inD(att) ? [def, att] : [att, def];
    if (inA(newcomer) || inD(newcomer)) return;
    const side = inA(known) ? 'd' : 'a', realms = side === 'a' ? bt.ra : bt.rd;
    bt[side].push(newcomer.id);
    if (!realms.includes(newcomer.realm)) realms.push(newcomer.realm);
    for (const p of Object.values(s.provinces)) if (p.siege?.army === newcomer.id) p.siege = null;
    Object.assign(newcomer, { battle: bt.id, path: [], mode: 'battle' });
    return;
  }
  const id = `b${s.nextId++}`, cid = warOf(s, att.realm, def.realm)?.conflict ?? null;
  s.battles[id] = { id, at: pid, war: cid, a: [att.id], d: [def.id], ra: [att.realm], rd: [def.realm], begun: s.month, rounds: 0, lost: [0, 0], start: [att.size, def.size] };
  for (const x of [att, def]) Object.assign(x, { battle: id, path: [], mode: 'battle' });
  // Siege armies leave their lines to fight.
  for (const p of Object.values(s.provinces)) if (p.siege && (p.siege.army === att.id || p.siege.army === def.id)) p.siege = null;
  const text = `Battle at ${cityOf(s, pid)}: ${poss(short(s, att.realm))} ${menText(att.size)} against ${poss(short(s, def.realm))} ${menText(def.size)}`;
  emit('clash', text, { realms: [att.realm, def.realm], at: pid, chars: [att.general, def.general].filter(Boolean), war: cid, battle: id, sizes: [att.size, def.size], minor: true }); // the chronicle tells it if it lasts
}

const sideArmies = (s, ids, at) => ids.map((id) => s.armies[id]).filter((a) => a && a.at === at);

export function battles(s, rng, emit) {
  const B = R.battle;
  for (const bt of Object.values(s.battles)) {
    const A = sideArmies(s, bt.a, bt.at), D = sideArmies(s, bt.d, bt.at);
    if (!A.length || !D.length) { endBattle(s, bt, A.length ? 'a' : D.length ? 'd' : null, emit, true); continue; }
    const P = PROV[bt.at], owner = s.provinces[bt.at].owner;
    const skill = (x) => 1 + B.skill * ((s.chars[x.general]?.skill ?? 2) - 3);
    const horse = (x) => 1 + R.supply.cavalry * cavalryOf(s, x.realm) * (['mountains', 'forest'].includes(P.terrain) ? 0.4 : 1); // riders count most in the open
    const ground = (x) => (owner === x.realm || friendly(s, x.realm, owner) ? (B.terrain[P.terrain] ?? 1) * B.home : 1);
    const open = ['plains', 'river', 'desert', 'steppe'].includes(P.terrain);
    const drill = (x) => { const r = s.realms[x.realm]; return (knows(r, 'legion') ? 1.08 : 1) * (knows(r, 'crossbow') ? 1.06 : 1) * (open && knows(r, 'elephants') ? 1.08 : 1); };
    const power = (side) => side.reduce((t, x) => t + x.size * skill(x) * x.morale * horse(x) * ground(x) * drill(x), 0) * (1 + between(rng, [-B.luck, B.luck]));
    const pa = power(A), pd = power(D);
    bt.rounds++;
    // A month of fighting: each side bleeds by the other's weight.
    const bleed = (own, other) => clamp(B.bleed * (other / own) ** 0.8, 0.03, 0.35);
    const fa = bleed(pa, pd), fd = bleed(pd, pa);
    for (const x of A) { bt.lost[0] = round1(bt.lost[0] + x.size * fa); x.size = round1(x.size * (1 - fa)); }
    for (const x of D) { bt.lost[1] = round1(bt.lost[1] + x.size * fd); x.size = round1(x.size * (1 - fd)); }
    const [worse, better] = fa > fd ? [A, D] : [D, A];
    for (const x of worse) x.morale = clamp(round1(x.morale - 0.07), 0.6, 1.3);
    for (const x of better) x.morale = clamp(round1(x.morale + 0.02), 0.6, 1.3);
    // A treacherous general on the losing side may change sides on the field.
    const losing = pa < pd * 0.9 ? A : pd < pa * 0.9 ? D : null;
    if (losing) for (const x of losing) {
      const g = s.chars[x.general];
      if (g?.alive && g.role === 'general' && chance(rng, (T(s, g.id, 'turncoat') ?? 0) * (g.loyalty < 60 ? 1.5 : 0.6))) turncoat(s, bt, x, losing === A ? 'd' : 'a', emit);
    }
    const morale = (side) => side.reduce((t, x) => t + x.morale * x.size, 0) / Math.max(0.1, side.reduce((t, x) => t + x.size, 0));
    const A2 = sideArmies(s, bt.a, bt.at), D2 = sideArmies(s, bt.d, bt.at);
    if (!A2.length || !D2.length) { endBattle(s, bt, A2.length ? 'a' : 'd', emit); continue; }
    const ratio = pa / pd;
    const lead = (side) => s.chars[side.slice().sort((x, y) => y.size - x.size)[0]?.general];
    let loser = null, withdrew = false;
    if (ratio >= B.crush || morale(D2) < B.breaks) loser = 'd';
    else if (ratio <= 1 / B.crush || morale(A2) < B.breaks) loser = 'a';
    else if (bt.rounds >= B.rounds) loser = pa >= pd ? 'd' : 'a';
    else if (T(s, lead(A2)?.id, 'withdraw') && ratio < 0.85) { loser = 'a'; withdrew = true; }
    else if (T(s, lead(D2)?.id, 'withdraw') && ratio > 1.18) { loser = 'd'; withdrew = true; }
    if (loser) endBattle(s, bt, loser === 'a' ? 'd' : 'a', emit, false, rng, withdrew);
    else {
      const text = bt.rounds === 1
        ? `Battle at ${cityOf(s, bt.at)}: ${poss(short(s, bt.ra[0]))} ${menText(bt.start[0])} against ${poss(short(s, bt.rd[0]))} ${menText(bt.start[1])}, and neither side gives way`
        : `The battle at ${cityOf(s, bt.at)} rages into a third month: ${menText(bt.lost[0] + bt.lost[1])} have fallen`;
      emit('fighting', text, { realms: [...bt.ra, ...bt.rd], at: bt.at, war: bt.war, battle: bt.id, minor: bt.start[0] + bt.start[1] < 8 });
    }
  }
}

function turncoat(s, bt, army, toSide, emit) {
  const g = s.chars[army.general], from = army.realm, to = (toSide === 'a' ? bt.ra : bt.rd).find((r) => s.realms[r] && !s.realms[r].fallen);
  if (!to) return;
  (toSide === 'a' ? bt.d : bt.a).splice((toSide === 'a' ? bt.d : bt.a).indexOf(army.id), 1);
  (toSide === 'a' ? bt.a : bt.d).push(army.id);
  army.realm = to;
  armiesChanged(s);
  Object.assign(g, { realm: to, loyalty: 55 });
  const text = `${g.name} turns ${g.female ? 'her' : 'his'} coat in the battle at ${cityOf(s, bt.at)}: ${menText(army.size)} men of ${ofR(s, from)} now fight for ${ofR(s, to)}`;
  emit('turncoat', text, { realms: [from, to], at: bt.at, chars: [g.id], war: bt.war, battle: bt.id });
  logWar(s, bt.war, { k: 'turncoat', text, at: bt.at, w: to });
}

// The end of a battle: the loser flees (or holds its walls, or is destroyed), generals may fall, the winner may
// lay siege. winner: 'a' | 'd' | null (broken off).
function endBattle(s, bt, winner, emit, quiet = false, rng = rngFor('age', s.age, 'battle-end', bt.id), withdrew = false) {
  delete s.battles[bt.id];
  const W = winner ? sideArmies(s, winner === 'a' ? bt.a : bt.d, bt.at) : [], L = winner ? sideArmies(s, winner === 'a' ? bt.d : bt.a, bt.at) : [];
  for (const id of [...bt.a, ...bt.d]) if (s.armies[id]) Object.assign(s.armies[id], { battle: null, mode: 'idle' });
  if (!winner || quiet) { // the other side left the field: whoever holds it carries on
    for (const x of W) if (s.armies[x.id]) beginSiege(s, x, emit);
    return;
  }
  const B = R.battle, P = PROV[bt.at];
  const wr = winner === 'a' ? bt.ra[0] : bt.rd[0], lr = winner === 'a' ? bt.rd[0] : bt.ra[0];
  for (const x of L) {
    const rout = (withdrew ? B.rout / 2 : B.rout) * between(rng, [0.6, 1.4]);
    bt.lost[winner === 'a' ? 1 : 0] = round1(bt.lost[winner === 'a' ? 1 : 0] + x.size * rout);
    x.size = round1(x.size * (1 - rout));
    x.morale = clamp(round1(x.morale - 0.1), 0.6, 1.3);
    x.rest = B.rest.loser;
  }
  for (const x of W) { x.morale = clamp(round1(x.morale + 0.1), 0.6, 1.3); x.rest = B.rest.winner; }
  s.record.battles++;
  const fallen = [];
  for (const [side, p] of [[W, B.generalDies.winner], [L, B.generalDies.loser]]) for (const x of side) {
    const g = s.chars[x.general];
    if (!g?.alive) continue;
    g.deeds[side === W ? 'wins' : 'losses']++;
    if (chance(rng, p * (1 + (bt.rounds - 1) * 0.3))) {
      fallen.push(g.id);
      die(s, g.id, 'battle', emit, rngFor('age', s.age, 'death', s.month, g.id), `falls in the battle at ${cityOf(s, bt.at)}`);
      x.general = null;
    }
  }
  const lostL = bt.lost[winner === 'a' ? 1 : 0], lostW = bt.lost[winner === 'a' ? 0 : 1];
  const crushing = lostL > lostW * 2.2;
  const long = bt.rounds > 1 ? ` after ${months(bt.rounds)} of fighting` : '';
  const text = withdrew
    ? `${short(s, lr)} ${vb(s, lr, 'breaks')} off the battle at ${cityOf(s, bt.at)} and ${vb(s, lr, 'withdraws')}${long}: ${menText(lostL + lostW)} have fallen`
    : `${short(s, wr)} ${vb(s, wr, crushing ? 'crushes' : 'defeats')} ${ofR(s, lr)} at ${cityOf(s, bt.at)}${long}: ${menText(lostL)} of ${ofR(s, lr)} fall, ${menText(lostW)} of ${ofR(s, wr)}`;
  emit('battle', text, { realms: [wr, lr], at: bt.at, chars: [...W, ...L].map((x) => x.general).filter(Boolean).concat(fallen), winner: wr, war: bt.war, battle: bt.id, lost: [round1(lostW), round1(lostL)], rounds: bt.rounds, minor: bt.start[0] + bt.start[1] < 8 && bt.rounds === 1 });
  const c = s.conflicts[bt.war];
  if (c) {
    c.battles++;
    logWar(s, bt.war, { k: 'battle', text, at: bt.at, w: wr, lost: [round1(lostW), round1(lostL)] });
    for (const g of fallen) c.deaths.push({ m: s.month, name: s.chars[g]?.name, realm: s.chars[g]?.realm, how: 'battle' });
    score(s, bt.war, wr, crushing ? 2 : 1);
  }
  for (const x of L) {
    if (!s.armies[x.id]) continue;
    if (x.size < R.armies.minSize) disband(s, x, emit, `${poss(short(s, x.realm))} army at ${cityOf(s, bt.at)} is destroyed`);
    else if (!retreat(s, x) && s.provinces[bt.at].owner === x.realm) x.mode = 'garrison'; // cornered at home: behind the walls
  }
  for (const x of W) if (s.armies[x.id] && s.armies[x.id].at === bt.at) beginSiege(s, x, emit);
}

function retreat(s, a) {
  const r = s.realms[a.realm];
  const home = route(s, a.realm, a.at, r.capital, (n) => friendly(s, a.realm, s.provinces[n].owner));
  const step = home?.path[0] ?? PROV[a.at].neighbors.find((n) => friendly(s, a.realm, s.provinces[n].owner));
  for (const p of Object.values(s.provinces)) if (p.siege?.army === a.id) p.siege = null;
  if (!step || step === a.at) {
    a.mode = 'idle';
    return false;
  }
  Object.assign(a, { at: step, path: [], eta: 0, mode: 'idle' });
  return true;
}

export function disband(s, a, emit, text) {
  if (text) emit('army.destroyed', text, { realms: [a.realm], at: a.at, chars: [a.general].filter(Boolean) });
  if (a.general && s.chars[a.general]) s.chars[a.general].army = null;
  for (const p of Object.values(s.provinces)) if (p.siege?.army === a.id) p.siege = null;
  delete s.armies[a.id];
  armiesChanged(s);
}

// A garrison storm: one bloody day against the walls.
function storm(s, rng, emit, a, pid) {
  const B = R.battle, p = s.provinces[pid];
  const inside = Object.values(s.armies).filter((b) => b.at === pid && b.realm === p.owner && b.mode === 'garrison');
  const defence = wallPower(s, pid) + inside.reduce((t, b) => t + b.size, 0);
  a.size = round1(a.size * (1 - R.walls.stormLoss * rng()));
  const pa = a.size * (1 + B.skill * ((s.chars[a.general]?.skill ?? 2) - 3)) * a.morale * (knows(s.realms[a.realm], 'gunpowder') ? 1.15 : 1) * (1 + between(rng, [-B.luck, B.luck]));
  const won = pa > defence * (1 + between(rng, [-B.luck, B.luck]));
  const cid = warOf(s, a.realm, p.owner)?.conflict;
  s.record.battles++;
  if (!won) {
    a.rest = B.rest.loser;
    const text = `The defenders of ${cityOf(s, pid)} beat back ${poss(short(s, a.realm))} storm`;
    emit('battle', text, { realms: [a.realm, p.owner].filter(Boolean), at: pid, chars: [a.general].filter(Boolean), winner: p.owner, war: cid });
    logWar(s, cid, { k: 'storm', text, at: pid, w: p.owner });
    score(s, cid, p.owner, 1);
    return false;
  }
  for (const b of inside) b.size = round1(b.size * 0.5);
  return true;
}

// ---------- sieges ----------
export function sieges(s, rng, emit) {
  for (const pid of Object.keys(s.provinces)) {
    const p = s.provinces[pid], sg = p.siege;
    if (!sg) continue;
    const a = s.armies[sg.army];
    if (!a || a.at !== pid || a.battle || (p.owner && !atWar(s, a.realm, p.owner))) {
      p.siege = null;
      if (a && !a.battle) a.mode = 'idle';
      continue;
    }
    const inside = Object.values(s.armies).filter((b) => b.at === pid && b.realm === p.owner && b.mode === 'garrison');
    const defence = wallPower(s, pid) + inside.reduce((t, b) => t + b.size, 0);
    const daring = T(s, a.general, 'storm') ?? 1;
    if (sg.left > 1 && a.size >= defence * R.walls.stormRatio / daring && chance(rng, 0.3 * daring)) {
      emit('storm', `${say(s, a.realm, 'storms')} the walls of ${cityOf(s, pid)}`, { realms: [a.realm, p.owner].filter(Boolean), at: pid, chars: [a.general].filter(Boolean), war: warOf(s, a.realm, p.owner)?.conflict });
      if (storm(s, rng, emit, a, pid)) capture(s, pid, a.realm, emit, rng, 'storm');
      continue;
    }
    sg.left--;
    if (sg.left <= 0) capture(s, pid, a.realm, emit, rng, 'siege');
  }
}

export function capture(s, pid, realm, emit, rng, how) {
  const p = s.provinces[pid], old = p.owner, R2 = s.realms[realm];
  const cid = old ? warOf(s, realm, old)?.conflict : null;
  setOwner(s, pid, realm, how === 'storm' || how === 'siege' ? 'conquest' : how);
  p.siege = null;
  p.conquered = R.loyalty.conquered;
  p.loyalty = Math.min(p.loyalty, R2.rebel ? 55 : 35);
  p.building = null;
  const taker = Object.values(s.armies).find((a) => a.at === pid && a.realm === realm);
  const gen = s.chars[taker?.general];
  if (R2.horde || (gen && T(s, gen.id, 'ravage'))) { // the horde loots what it takes; a butcher burns it
    Object.assign(p, { ravaged: R2.horde ? 24 : 12, loyalty: 25 });
    p.prosperity = Math.max(0, (p.prosperity ?? 50) - 25);
    R2.gold = round1(R2.gold + PROV[pid].wealth * (R2.horde ? 12 : 6));
  }
  if (gen) gen.deeds.captures++;
  const ruler = s.chars[R2.ruler];
  if (ruler && ruler.army && s.armies[ruler.army]?.at === pid) ruler.deeds.captures++;
  else if (ruler) ruler.deeds.captures += 0.5;
  for (const a of Object.values(s.armies)) if (a.at === pid && a.realm === realm && !a.battle) a.mode = 'idle';
  for (const a of Object.values(s.armies)) if (a.at === pid && a.realm === old && old) disband(s, a, emit, `${poss(short(s, old))} army in ${cityOf(s, pid)} lays down its arms`);
  s.record.captures++;
  const lost = old && s.realms[old];
  const capital = lost && lost.capital === pid;
  const text = `${say(s, realm, how === 'storm' ? 'storms' : 'takes')} ${cityOf(s, pid)}${lost ? ` from ${ofR(s, old)}` : ''}${capital ? `, the capital` : ''}`;
  emit('capture', text, { realms: [realm, old].filter(Boolean), at: pid, capital, war: cid, chars: gen ? [gen.id] : [] });
  if (cid && s.conflicts[cid]) {
    const c = s.conflicts[cid];
    logWar(s, cid, { k: 'capture', text, at: pid, w: realm });
    (c.gains[realm] ??= []).includes(pid) || c.gains[realm].push(pid);
    if (c.gains[old]) c.gains[old] = c.gains[old].filter((x) => x !== pid);
    score(s, cid, realm, capital ? 6 : 3);
  }
  if (old) carryOff(s, realm, old, pid, rng, emit);
  if (capital) moveCapital(s, old, emit);
  if (lost && !provincesOf(s, old).length && !homeless(s, old)) fall(s, old, emit, `${lost.name} ${vb(s, old, 'is')} no more: ${R2.short} ${vb(s, realm, 'has')} taken its last city`, realm);
}

// A nomad realm that has lost every city lives on while its armies ride.
export const homeless = (s, id) => s.realms[id]?.nomad && armiesOf(s, id).length > 0;

export function moveCapital(s, id, emit) {
  const r = s.realms[id], left = [...provincesOf(s, id)];
  if (!left.length) return;
  r.capital = left.sort((a, b) => b.wealth - a.wealth || (b.walls - a.walls))[0].id;
  for (const p of left) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 8);
  emit('capital', `${say(s, id, 'moves')} the court to ${cityOf(s, r.capital)}`, { realms: [id], at: r.capital });
}

export function fall(s, id, emit, text, by = null) {
  const r = s.realms[id];
  if (!r || r.fallen) return;
  r.fallen = true;
  realmsChanged(s);
  r.fellAt = s.month;
  r.fellTo = by;
  for (const k of ['plan', 'lastSupply', 'fortune', 'known', 'reforms', 'spent']) delete r[k]; // a fallen realm keeps its name, colours and lineage
  s.record.fallen++;
  for (const a of armiesOf(s, id)) disband(s, a);
  for (const [k, w] of Object.entries(s.wars)) if (k.split('|').includes(id)) {
    delete s.wars[k];
    const c = s.conflicts[w.conflict];
    if (c && !c.ended && !Object.values(s.wars).some((x) => x.conflict === w.conflict)) Object.assign(c, { ended: s.month, outcome: `${r.name} ${vb(s, id, 'falls')}` });
  }
  for (const k of Object.keys(s.allies)) if (k.split('|').includes(id)) delete s.allies[k];
  for (const t of Object.values(s.treaties)) if (t.ended === null && t.parties.includes(id)) t.ended = s.month;
  for (const v of living(s)) if (v.overlord === id) v.overlord = null;
  for (const c of Object.values(s.chars)) if (c.alive && c.realm === id && c.role !== 'ruler') c.role = 'exile';
  emit('fallen', text, { realms: [id, by].filter(Boolean) });
}

// ---------- the season's toll on armies far from home ----------
export function weatherToll(s, emit) {
  const S = R.seasons;
  for (const a of Object.values(s.armies)) {
    const w = weatherOf(a.at, s.month), r = s.realms[a.realm], home = s.provinces[a.at].owner === a.realm;
    let loss = 0;
    if (w === 'snow' && !home && !r?.nomad) loss = S.snow.cold;
    if (w === 'heat' && PROV[a.at].terrain === 'desert' && !r?.nomad) loss = S.heat.loss;
    if (!loss) continue;
    a.size = round1(a.size * (1 - loss));
    if ((a.tollSaid ?? -99) < s.month - 9 && a.size > 6) {
      a.tollSaid = s.month;
      emit('toll', w === 'snow' ? `Snow and frost thin ${poss(short(s, a.realm))} army at ${cityOf(s, a.at)}` : `The summer heat wears down ${poss(short(s, a.realm))} army in the desert at ${cityOf(s, a.at)}`, { realms: [a.realm], at: a.at, weather: w });
    }
  }
}

export const conflictOf = (s, a, b) => s.conflicts[warOf(s, a, b)?.conflict];
export { PROVINCES, yearOf };
