// Doctrine: how rulers, generals and courtiers act when no AI or player speaks for them. Every realm can always run
// on it; the AI cast and players replace its plans and answers, and the armies still march by its rules.
// Temperament drives it: a conqueror wants war, a builder canals, a negligent king nothing at all.
import { RULES as R } from './rules.js';
import { PROV, PROVINCES, baseWealth, hops, onRoad, atWar, allied, warOf, truceUntil, friendly, living, provincesOf, armiesOf, isWinter, weatherOf, ageOf } from './core.js';
import { strength, sideStrength, wealthOf, wallPower, rulingTemper, steersman, canBuild, prosperityOf } from './economy.js';
import { route } from './war.js';
import { claimsOf, acceptsPeace, acceptsAlliance, acceptsUltimatum } from './acts.js';
import { decideMatter } from './players.js';

const has = (c, ...t) => t.some((x) => c?.traits?.includes(x));
// The bloc (a free realm and its client states) that holds the most land.
function leadingBloc(s) {
  let best = null;
  for (const r of living(s)) {
    if (r.overlord) continue;
    const land = provincesOf(s, r.id).length + living(s).filter((v) => v.overlord === r.id).reduce((t, v) => t + provincesOf(s, v.id).length, 0);
    if (!best || land > best.land) best = { id: r.id, land };
  }
  return best && { ...best, share: best.land / PROVINCES.length };
}

// The realms that share a border with this one, and whether unclaimed land lies next door.
export function neighbours(s, id) {
  const out = new Set();
  let neutral = false;
  for (const p of provincesOf(s, id)) for (const n of p.neighbors) {
    const o = s.provinces[n].owner;
    if (o === null) neutral = true;
    else if (o !== id) out.add(o);
  }
  return { realms: [...out].filter((o) => !s.realms[o]?.fallen), neutral };
}

export function plan(s, id, rng) {
  const r = s.realms[id], who = steersman(s, r), temper = rulingTemper(s, r), T = R.temper.ruler[temper] ?? {}, me = strength(s, id);
  const bold = r.nomad || ['conqueror', 'tyrant'].includes(temper);
  const cautious = ['diplomat', 'negligent', 'hedonist', 'miser', 'builder', 'just'].includes(temper) || has(who, 'cautious', 'timid', 'ailing');
  const { realms: next, neutral } = neighbours(s, id);
  const wars = living(s).filter((o) => atWar(s, id, o.id)).map((o) => o.id);
  const p = { until: s.month + 6 + Math.floor(rng() * 7), tax: 'normal', recruit: 0.5, targets: [...wars], acts: [], by: 'doctrine', temper };

  // Peace when a war goes badly or drags on with nothing to show; sooner for those who never wanted it.
  // Allies still fighting the same enemy: no separate peace unless the war is lost.
  for (const w of wars) {
    const them = sideStrength(s, w, id), ours = sideStrength(s, id, w), since = warOf(s, id, w)?.since ?? s.month;
    const together = living(s).some((x) => x.id !== id && allied(s, x.id, id) && atWar(s, x.id, w));
    const after = (s.mods?.peaceAfter ?? R.diplomacy.peaceAfter) * (bold ? 1.5 : cautious ? 0.6 : 1) * (together ? 2 : 1);
    if ((them > ours * 1.4 && s.month - since > 10) || (s.month - since > after && rng() < 0.4)) p.acts.push({ kind: 'peace', target: w });
  }

  if (r.rebel) return { ...p, recruit: 0.9, targets: wars.filter((w) => w === r.cause), acts: [] };

  // A horde makes war on everyone it touches; most neighbours of a horde think about bowing.
  if (r.horde) {
    const prey = next.filter((n) => !friendly(s, id, n));
    return { ...p, acts: prey.map((n) => ({ kind: 'war', target: n, cause: 'horde' })), targets: [...prey, 'neutral'], recruit: 1, until: s.month + 4 }; // across the Gobi too
  }
  // Before that, a khan of the steppe fights for the steppe, and when only his ally is left, turns on him too.
  if (r.nomad && id === 'mongol') {
    const tribes = next.filter((n) => s.realms[n]?.nomad && n !== 'kipchak');
    const prey = tribes.filter((n) => !friendly(s, id, n));
    const war = prey.length ? prey.filter((n) => !atWar(s, id, n)).slice(0, 1) : tribes.filter(() => rng() < 0.25).slice(0, 1);
    return { ...p, acts: war.map((n) => ({ kind: 'war', target: n, cause: 'steppe', oath: true })), targets: [...new Set([...wars, ...war, ...prey])], recruit: 0.9 };
  }
  const horde = living(s).find((o) => o.horde && next.includes(o.id));
  if (horde && !r.overlord && me < strength(s, horde.id) * 0.4 && rng() < (cautious ? 0.3 : 0.1)) {
    return { ...p, acts: [{ kind: 'submit', target: horde.id }], targets: wars.filter((w) => w !== horde.id) };
  }

  // The pull of an empire (the living world): a small realm next to the leading bloc may bow to it unasked.
  if (s.rule === 'hegemony' && !r.overlord && !s.players?.[id] && provincesOf(s, id).length <= 4) {
    const lead = leadingBloc(s);
    if (lead && lead.id !== id && lead.share >= R.hegemony.pull && next.some((n) => n === lead.id || s.realms[n]?.overlord === lead.id) && strength(s, id) < strength(s, lead.id) * 0.15 && !atWar(s, id, lead.id) && rng() < R.hegemony.bandwagon)
      return { ...p, acts: [{ kind: 'submit', target: lead.id }], targets: wars };
  }
  // Vassals break free when they outgrow their master; the weak bow to a crushing enemy.
  if (r.overlord && s.realms[r.overlord] && me > strength(s, r.overlord) * 0.9 && rng() < (bold ? 0.4 : 0.15)) p.acts.push({ kind: 'independence' });
  for (const w of wars) if (!r.overlord && me < strength(s, w) * 0.2 && provincesOf(s, id).length <= 3 && rng() < 0.08 && !s.realms[w].rebel) p.acts.push({ kind: 'submit', target: w });

  // Old claims: the peaceable take them to an arbiter, the warlike to the field.
  const claims = claimsOf(s, id).filter((c) => !atWar(s, id, c.holder) && next.includes(c.holder));
  const claim = claims.length && claims[Math.floor(rng() * claims.length)];
  if (claim && rng() < R.dispute.chance * 6) {
    if (bold && strength(s, claim.holder) * 1.2 < me && truceUntil(s, id, claim.holder) <= s.month) p.acts.push({ kind: 'war', target: claim.holder, cause: 'claim', place: claim.place }), p.targets.push(claim.holder);
    else p.acts.push({ kind: 'claim', place: claim.place });
  }

  // War on a weaker neighbour, if the ruler has the stomach for it. A conqueror may even break a truce.
  if (!r.nomad && wars.length < (bold ? 2 : 1) && rng() < 0.14 * (T.war ?? 1) * (s.mods?.war ?? 1)) {
    const prey = next.filter((n) => !atWar(s, id, n) && !friendly(s, id, n) && (!r.overlord || atWar(s, r.overlord, n)) && (truceUntil(s, id, n) <= s.month || (bold && rng() < 0.15)) && !s.realms[n].nomad && (strength(s, n) + (s.realms[n].overlord && s.realms[n].overlord !== id ? strength(s, s.realms[n].overlord) : 0)) * R.diplomacy.warRatio * (cautious ? 1.4 : 1) < me)
      .map((n) => ({ n, score: provincesOf(s, n).reduce((t, q) => t + baseWealth(s, q.id), 0) / Math.max(1, strength(s, n)) + rng() + (s.kin[[id, n].sort().join('|')] ? -2 : 0) + ((s.players?.[n]?.missed ?? 0) > R.absence.grace ? 2 : 0) })) // an absent king is easy prey
      .sort((a, b) => b.score - a.score)[0];
    if (prey && bold && !s.realms[prey.n].overlord && strength(s, prey.n) * R.submission.ultimatum < me && rng() < 0.5) p.acts.push({ kind: 'demand', target: prey.n }); // bow, or else
    else if (prey) p.acts.push({ kind: 'war', target: prey.n }), p.targets.push(prey.n);
  }
  if (neutral && wars.length < 2 && !r.nomad && temper !== 'negligent') p.targets.push('neutral');

  // A realm grown too big makes its neighbours close ranks; a diplomat seeks friends anyway.
  const giant = living(s).find((o) => o.id !== id && provincesOf(s, o.id).length >= PROVINCES.length * R.diplomacy.balance);
  if (giant && next.includes(giant.id)) for (const n of next) if (n !== giant.id && !s.realms[n].nomad && !atWar(s, id, n) && rng() < 0.5) p.acts.push({ kind: 'ally', target: n });
  if (T.ally && rng() < 0.08 * T.ally) {
    const friend = next.filter((n) => !atWar(s, id, n) && !friendly(s, id, n) && !s.realms[n].nomad)[0];
    if (friend) p.acts.push({ kind: 'ally', target: friend });
  }

  // Taxes and soldiers.
  const mine = provincesOf(s, id), avgLoyalty = mine.reduce((t, q) => t + s.provinces[q.id].loyalty, 0) / Math.max(1, mine.length);
  p.tax = T.tax === 'high' ? 'high' : avgLoyalty < 38 ? 'low' : (r.gold < 20 && wars.length) || temper === 'miser' || has(who, 'greedy') ? 'high' : temper === 'just' && avgLoyalty < 55 ? 'low' : 'normal';
  p.recruit = wars.length ? (bold ? 0.85 : 0.7) : cautious ? 0.25 : 0.45;
  const eats = armiesOf(s, id).reduce((t, a) => t + a.size, 0) * R.supply.eat;
  if (!r.nomad && (r.grain ?? 0) < eats * 2) { p.recruit *= 0.4; p.hungry = true; } // empty granaries: no new mouths

  // One power move per reign, at a moment that suits it.
  if (!r.power && s.month >= 18 && rng() < 0.35 && temper !== 'negligent') { // a reign's one great gamble is not made in its first months
    const enemy = Math.max(0, ...wars.map((w) => strength(s, w)));
    const kind = wars.length && me < enemy ? 'levy' : avgLoyalty < 42 ? 'feast' : r.gold < 25 && mine.filter((q) => onRoad(s, q.id)).length >= 2 ? 'silktax'
      : wars.length && ['builder', 'diplomat', 'just'].includes(temper) ? 'walls' : r.gold > 70 && rng() < 0.5 ? 'bribe' : null;
    if (kind) p.acts.push({ kind: 'power', power: kind });
  }

  // A schemer at war buys a dagger for the enemy's best man.
  if (wars.length && r.gold > R.agents.contractCost * 1.6 && rng() < (['paranoid', 'tyrant'].includes(temper) || has(who, 'scheming', 'shrewd', 'cruel') ? 0.06 : 0.012)) {
    const foe = wars.map((w) => s.realms[w]).filter((o) => !o.rebel).sort((a, b) => strength(s, b.id) - strength(s, a.id))[0];
    const marks = foe && Object.values(s.chars).filter((c) => c.alive && c.realm === foe.id && ['ruler', 'general'].includes(c.role)).sort((a, b) => b.skill - a.skill);
    const target = marks?.length ? (rng() < 0.4 ? marks.find((c) => c.role === 'ruler') : marks[0])?.id : null;
    if (target) p.acts.push({ kind: 'hire', target });
  }

  // Works: a builder raises them often, others now and then, when the treasury allows.
  const buildChance = T.build ?? 0.012;
  if (rng() < buildChance * (wars.length ? 0.4 : 1) * 6) {
    const work = bestWork(s, id);
    if (work) p.acts.push({ kind: 'build', ...work });
  }
  return p;
}

// The work that would do a realm the most good: a caravanserai on a busy road, a canal on rich fields, a market in
// a rich town, a library in the capital.
export function bestWork(s, id) {
  const r = s.realms[id], options = [];
  for (const p of provincesOf(s, id)) {
    for (const kind of Object.keys(R.works)) {
      if (!canBuild(s, id, p.id, kind) || r.gold < R.works[kind].cost + 30) continue;
      const value = kind === 'caravanserai' ? 4 * (s.trade?.[p.id] ?? 0.3) + 1 : kind === 'canal' ? wealthOf(s, p.id) * (p.terrain === 'river' ? 1.2 : 0.8) : kind === 'market' ? wealthOf(s, p.id) * 0.9 : (p.id === r.capital ? 3 : 1) + baseWealth(s, p.id) * 0.4;
      options.push({ place: p.id, work: kind, value });
    }
  }
  return options.sort((a, b) => b.value - a.value)[0] ?? null;
}

// Answers to the decisions characters face, by temperament.
export function decide(s, d, rng) {
  const c = s.chars[d.char], r = s.realms[d.realm];
  if (d.kind === 'betray' || d.kind === 'pretender') {
    const lean = { treacherous: 0.7, kingmaker: 0.6, mercenary: 0.5, glory: 0.35, butcher: 0.4, steady: 0.15, cautious: 0.1, loyal: 0 }[c.temper] ?? 0.2;
    if (rng() > lean * (d.kind === 'pretender' ? 1.3 : 1) * (c.loyalty < 50 ? 1.4 : 0.8)) return d.options[0];
    const ruler = s.chars[r?.ruler], army = s.armies[c.army];
    const weak = r?.regent || ['negligent', 'hedonist'].includes(ruler?.temper) || (ruler && ageOf(s, ruler) < 16);
    if (d.options.includes('seize') && (army?.at === r?.capital || weak || c.temper === 'kingmaker' || !d.options.includes('break'))) return 'seize';
    return d.options.includes('break') ? 'break' : d.options[0];
  }
  if (d.kind === 'match') {
    const from = s.realms[d.from];
    if (!from || atWar(s, d.realm, d.from) || (from.rep ?? 60) < 30) return 'refuse';
    return rng() < ({ diplomat: 0.95, paranoid: 0.5, tyrant: 0.6 }[rulingTemper(s, r)] ?? 0.8) ? 'accept' : 'refuse';
  }
  if (d.kind === 'peace') return acceptsPeace(s, d.realm, d.from) ? 'accept' : 'refuse';
  if (d.kind === 'matter') return decideMatter(s, d);
  if (d.kind === 'alliance') return acceptsAlliance(s, d.realm, d.from) ? 'accept' : 'refuse';
  if (d.kind === 'ultimatum') return acceptsUltimatum(s, d.realm, d.from) ? 'bow' : 'refuse';
  if (d.kind === 'verdict') {
    const t = rulingTemper(s, r), weak = strength(s, d.realm) < strength(s, d.claimant) * 1.2;
    if (['just', 'diplomat'].includes(t)) return 'accept';
    if (['conqueror', 'tyrant', 'paranoid'].includes(t)) return weak && rng() < 0.5 ? 'accept' : 'defy';
    return weak || rng() < 0.4 ? 'accept' : 'defy';
  }
  return d.options[0];
}

// Each month: where every army goes. Defend first, then take the best prize within reach, if the season allows.
export function orders(s, id, rng) {
  const r = s.realms[id], targets = new Set(r.plan?.targets ?? []), temper = rulingTemper(s, r), T = R.temper.ruler[temper] ?? {};
  const hostileTo = (owner) => (owner === null ? targets.has('neutral') : targets.has(owner) && atWar(s, id, owner));
  const canEnter = (n) => {
    const o = s.provinces[n].owner;
    return friendly(s, id, o) || hostileTo(o) || (o !== null && atWar(s, id, o));
  };
  const claimed = new Set(armiesOf(s, id).filter((a) => a.target && a.mode !== 'idle').map((a) => a.target));
  const autumn = [8, 9].includes(s.month % 12); // after the harvest: the campaigning season
  for (const a of armiesOf(s, id)) {
    if (a.battle) continue;
    if (a.mode === 'garrison' && s.provinces[a.at].siege) continue; // holding the walls
    if (a.mode === 'garrison') a.mode = 'idle';
    if (a.mode === 'siege' || a.rest > 0) continue;
    if (a.order && follow(s, id, a)) continue; // a ruler's standing orders
    if (a.path.length && a.target && rng() < 0.85 && (s.provinces[a.target].owner === null ? targets.has('neutral') : atWar(s, id, s.provinces[a.target].owner))) continue;
    const gen = s.chars[a.general], daring = R.temper.general[gen?.temper]?.attack ?? 1;
    // An enemy army on our land, close by and not much stronger: go and meet it, whatever the season.
    const near = Object.values(s.armies).filter((e) => atWar(s, id, e.realm) && s.provinces[e.at].owner === id);
    const threat = near.map((e) => ({ e, way: route(s, id, a.at, e.at, canEnter) })).filter((x) => x.way && x.way.months <= 3 && a.size * daring >= x.e.size).sort((x, y) => x.way.months - y.way.months)[0];
    if (threat && temper !== 'negligent') {
      Object.assign(a, { path: threat.way.path, target: threat.e.at, mode: 'march', eta: 0 });
      continue;
    }
    const w = weatherOf(a.at, s.month);
    const closed = (!r.nomad && (isWinter(s.month) || w === 'snow')) || w === 'rains'; // winter quarters; the monsoon
    const start = R.campaign.start * (T.campaign ?? 1) * (autumn ? 1.5 : 1);
    if (!a.path.length && (closed || r.plan?.hungry || rng() > start)) continue; // a campaign takes some deciding, and grain
    // The best prize: rich, weakly held, not too far, not already someone else's job.
    const prizes = PROVINCES.filter((p) => hostileTo(s.provinces[p.id].owner) && !claimed.has(p.id))
      .map((p) => {
        const owner = s.provinces[p.id].owner, cap = owner && s.realms[owner]?.capital === p.id;
        const d = Math.abs(p.xy[0] - PROV[a.at].xy[0]) + Math.abs(p.xy[1] - PROV[a.at].xy[1]);
        return { p, guess: wealthOf(s, p.id) * 2 + (cap ? 3 : 0) + (onRoad(s, p.id) ? 1 : 0) - (wallPower(s, p.id) / Math.max(1, a.size)) * 4 - d / 90 };
      })
      .sort((x, y) => y.guess - x.guess).slice(0, 5);
    let best = null;
    for (const { p, guess } of prizes) {
      const way = route(s, id, a.at, p.id, canEnter);
      if (!way) continue;
      const score = guess - way.months * 1.2;
      if (!best || score > best.score) best = { p, way, score };
    }
    if (best && a.size >= R.armies.minSize * 1.5) {
      Object.assign(a, { path: best.way.path, target: best.p.id, mode: 'march', eta: 0 });
      claimed.add(best.p.id);
    } else if (!a.path.length && s.provinces[a.at].owner !== id) {
      const home = route(s, id, a.at, r.capital, (n) => friendly(s, id, s.provinces[n].owner));
      if (home) Object.assign(a, { path: home.path, target: null, mode: 'march', eta: 0 });
      else a.mode = 'idle';
    } else if (!a.path.length) a.mode = 'idle';
  }
}

// A ruler's standing orders for an army: attack or raid a province, defend one, or go into winter quarters.
// Returns false (and drops the order) when it is done or can no longer be carried out; the general then decides.
function follow(s, id, a) {
  const o = a.order, owner = (p) => s.provinces[p]?.owner;
  const enter = (n) => friendly(s, id, owner(n)) || (owner(n) !== null && atWar(s, id, owner(n))) || n === o.place;
  const go = (to) => { const way = route(s, id, a.at, to, enter); if (!way) return false; Object.assign(a, { path: way.path, target: to, mode: 'march', eta: 0 }); return true; };
  if (o.kind === 'winter') {
    if (owner(a.at) === id && !a.path.length) { a.mode = 'idle'; return true; }
    if (a.path.length) return true;
    const d = hops(a.at), home = provincesOf(s, id).filter((p) => (d[p.id] ?? 99) <= 4).sort((x, y) => s.provinces[y.id].walls - s.provinces[x.id].walls || d[x.id] - d[y.id])[0] ?? provincesOf(s, id)[0];
    return home ? go(home.id) || true : false;
  }
  if (o.kind === 'defend') {
    if (owner(o.place) !== id) { a.order = null; return false; }
    const near = [o.place, ...PROV[o.place].neighbors].filter((n) => owner(n) === id);
    const foe = Object.values(s.armies).find((e) => atWar(s, id, e.realm) && near.includes(e.at) && e.at !== a.at);
    if (foe) return go(foe.at) || true;
    if (a.at !== o.place) return (a.path.length && a.target === o.place) || go(o.place) || true;
    a.mode = 'idle';
    return true;
  }
  const ow = owner(o.place); // attack or raid
  if (!PROV[o.place] || ow === id || (ow !== null && !atWar(s, id, ow))) { a.order = null; return false; }
  if (a.at === o.place || (a.path.length && a.target === o.place)) return true;
  if (!go(o.place)) { a.order = null; return false; }
  return true;
}

export const brain = { planFor: plan, ordersFor: orders, decide };
export { prosperityOf };
