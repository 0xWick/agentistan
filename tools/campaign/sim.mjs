// Plays campaigns with the rules on every side, to see that each one runs, and how often history is beaten.
//   node tools/campaign/sim.mjs [id] [runs] [--verbose] [--smart] [--why] [--hero] [--cards=history|advise|first|second]
// --hero follows your hero's army season by season, and tells how it ended.
// --smart plays your side as a competent player would: gather, then strike together with the plan that fits.
import { CAMPAIGNS } from '../../web/campaign/catalog.js';
import { newCampaign, resolve, cardsDue, autoOrders, autoRaise, VERDICT, menOf, fmtMen, withCards, goalState, reach, wayTo, atWar, armiesOf, battleFacts, plansFor, fitOf, friends, heroOf } from '../../web/campaign/engine.js';

// A competent player: enough armies to hold the capital stay home; the rest strike the enemy's main army together,
// with the plan that fits, only when the odds are good (the green badge: 1.2:1 or better, counting spirits, the plan
// and the ground, as the page does), or march on the cities the goal names; a war of defence keeps to its own land;
// peace is taken when the goal asks for it. Every army that may be attacked knows how it will fight.
export const smartOrders = (C, s) => withDefence(C, s, strike(C, s));
// Every army that may be attacked this season knows how it will fight: the plan that fits its ground best.
function withDefence(C, s, orders) {
  for (const a of armiesOf(s, C.you)) {
    const o = orders[a.id] ?? {}, at = o.to ?? a.at;
    if (o.plan) continue;
    const foes = Object.values(s.armies).filter((x) => atWar(s, C.you, x.side) && (x.at === at || reach(C, s, x.id)[at]));
    if (!foes.length) continue;
    const f = battleFacts(C, s, at, [a], foes, true);
    orders[a.id] = { ...o, plan: plansFor(C, true).filter((p) => p !== 'refuse' || at !== C.sides[C.you].capital).map((p) => [p, fitOf(f, p)]).sort((x, y) => y[1] - x[1])[0][0] };
  }
  return orders;
}
function strike(C, s) {
  const you = C.you, mine = armiesOf(s, you), base = autoOrders(C, s);
  const area = new Set(C.goal.provs ?? Object.keys(C.prov));
  const foes = Object.values(s.armies).filter((a) => atWar(s, you, a.side)).sort((a, b) => (area.has(b.at) - area.has(a.at)) || b.men - a.men);
  const T = foes[0];
  if (!T || !mine.length) return base;
  // a war of defence (drive them out, hold the land): keep the armies at home, and strike what comes in
  if (['drive', 'hold'].includes(C.goal.kind) && !area.has(T.at)) {
    const orders = { ...base }, home = C.sides[you].capital;
    for (const a of mine) {
      if (area.has(a.at)) { orders[a.id] = { to: null }; continue; }
      const way = home && wayTo(C, s, you, a.at, home), r = reach(C, s, a.id);
      let pick = null;
      for (const p of way?.slice(1) ?? []) if (r[p]) pick = p; else break;
      orders[a.id] = { to: pick };
    }
    return orders;
  }
  const q = (a) => a.men * (C.sides[a.side].quality ?? 1) * (1 + 0.08 * (a.skill - 3)) * (0.6 + a.morale / 250);
  const ground = (p) => ({ hills: 1.15, mountains: 1.3, forest: 1.15, marsh: 1.2, river: 1.1 })[C.prov[p].terrain] ?? 1;
  // first, the capital, when losing it loses the war: as many as it takes to hold it go home, the hero's own army last
  const cap = C.sides[you].capital, guard = new Set();
  if (cap && C.loseCapital !== false && s.prov[cap]?.owner === you) {
    const threat = Object.values(s.armies).filter((x) => atWar(s, you, x.side) && reach(C, s, x.id)[cap]).reduce((t, x) => t + q(x), 0);
    let held = mine.filter((x) => x.at === cap).reduce((t, x) => t + q(x), 0) * ground(cap);
    if (threat > held) {
      for (const x of mine) if (x.at === cap) guard.add(x.id);
      for (const x of mine.filter((y) => y.at !== cap && reach(C, s, y.id)[cap]).sort((a, b) => (a.hero ? 1 : 0) - (b.hero ? 1 : 0) || q(b) - q(a))) {
        if (held >= threat * 1.1) break;
        guard.add(x.id);
        held += q(x) * ground(cap);
      }
    }
  }
  const field = mine.filter((x) => !guard.has(x.id));
  const orders = { ...base, ...Object.fromEntries([...guard].map((id) => [id, { to: s.armies[id].at === cap ? null : cap }])) };
  if (!field.length) return orders;
  // the main enemy army, when we can beat it: counting whoever can join them this season, the plan that fits, the ground
  const there = Object.values(s.armies).filter((a) => (a.side === T.side || friends(s, a.side, T.side)) && (a.at === T.at || reach(C, s, a.id)[T.at]));
  const theirs = there.reduce((t, a) => t + q(a), 0) * 1.09 * ground(T.at);
  const can = field.filter((a) => reach(C, s, a.id)[T.at]);
  if (can.length) {
    const f = battleFacts(C, s, T.at, can, there, false);
    const [plan, fit] = plansFor(C, false).map((p) => [p, fitOf(f, p)]).sort((x, y) => y[1] - x[1])[0];
    const late = s.turn >= C.turns.length - 2 && !goalState(C, s).met; // in the last seasons, a commander who must still win fights at even odds
    if (can.reduce((t, a) => t + q(a), 0) * (1 + 0.3 * fit) >= theirs * (late ? 0.95 : 1.2)) {
      for (const a of can) orders[a.id] = { to: T.at, plan };
      return orders;
    }
  }
  // no battle worth fighting: march on the cities the goal names (or the enemy capital), and take them
  const goalCities = (C.goal.provs ?? [C.sides[C.goal.foe]?.capital].filter(Boolean)).filter((p) => s.prov[p] && s.prov[p].owner !== you && !friends(s, you, s.prov[p].owner));
  if (goalCities.length && ['take', 'destroy', 'peace', 'custom'].includes(C.goal.kind)) {
    for (const a of field.sort((x, y) => y.men - x.men)) {
      const near = goalCities.map((p) => [p, wayTo(C, s, you, a.at, p)]).filter(([, w]) => w).sort((x, y) => x[1].length - y[1].length)[0];
      if (!near) continue;
      const [p, way] = near, r = reach(C, s, a.id);
      if (a.at === p) { orders[a.id] = { to: null, storm: s.prov[p].garrison * 3 < a.men }; continue; }
      let pick = null;
      for (const x of way.slice(1)) {
        if (!r[x]) break;
        const foesThere = Object.values(s.armies).filter((o) => atWar(s, you, o.side) && (o.at === x || reach(C, s, o.id)[x])).reduce((t, o) => t + q(o), 0); // and whoever can come
        if (foesThere && q(a) < foesThere * 1.15) break; // never walk into a battle at bad odds
        pick = x;
        if (foesThere) break;
      }
      if (pick) orders[a.id] = { to: pick, storm: pick === p && s.prov[p].garrison * 3 < a.men };
    }
    return orders;
  }
  for (const a of field) { // gather next to the enemy, or come closer
    const r = reach(C, s, a.id), way = wayTo(C, s, you, a.at, T.at);
    if (!way) continue;
    const near = Object.keys(r).filter((p) => C.prov[T.at].neighbors.includes(p) && !Object.values(s.armies).some((o) => o.at === p && atWar(s, you, o.side)));
    if (near.length) orders[a.id] = { to: near[0] };
    else { let pick = null; for (const p of way.slice(1, -1)) if (r[p]) pick = p; else break; orders[a.id] = { to: pick }; }
  }
  return orders;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
function main() {
const args = process.argv.slice(2), verbose = args.includes('--verbose'), smart = args.includes('--smart'), how = (args.find((a) => a.startsWith('--cards=')) ?? '--cards=history').slice(8);
const [id, runs = 20] = args.filter((a) => !a.startsWith('--'));
for (const C of CAMPAIGNS.filter((c) => !id || c.id === id)) {
  const tally = { better: 0, as: 0, worse: 0 }, ends = {}, turns = [];
  for (let seed = 1; seed <= +runs; seed++) {
    let s = newCampaign(C, seed);
    const trail = [];
    while (s.status === 'running') {
      const cards = Object.fromEntries(cardsDue(C, s).map((c) => [c.id, how === 'history' ? c.pick ?? c.advise ?? 0 : how === 'first' ? 0 : how === 'second' ? Math.min(1, c.options.length - 1) : c.advise ?? 0]));
      // a competent commander takes the peace his goal asks for, and offers it when the enemy wavers
      const wants = (x) => smart && ['peace', 'drive'].includes(C.goal.kind) && x === C.goal.foe;
      for (const c of cardsDue(C, s)) if (c.peace && wants(c.peace)) cards[c.id] = 0;
      const peace = wants(C.goal.foe) && atWar(s, C.you, C.goal.foe) && s.sides[C.goal.foe].will < 40 ? { [C.goal.foe]: 'offer' } : {};
      const pre = withCards(C, s, cards);
      const orders = smart ? smartOrders(C, pre) : autoOrders(C, pre);
      if (args.includes('--orders') && verbose) console.log('  orders', JSON.stringify(orders));
      const r = resolve(s, C, { cards, orders, raise: autoRaise(C, pre), peace });
      if (verbose && seed === (+(args.find((a) => a.startsWith('--seed='))?.slice(7) ?? 1))) {
        console.log(`\n${C.turns[s.turn].label}: ${C.sides[C.you].name} ${fmtMen(menOf(r.state, C.you))} men, gold ${Math.round(r.state.sides[C.you].gold)}, will ${Math.round(r.state.sides[C.you].will)}; ` + Object.keys(C.sides).filter((x) => x !== C.you && r.state.sides[x].alive).map((x) => `${x} ${fmtMen(menOf(r.state, x))} w${Math.round(r.state.sides[x].will)} ${r.state.plans[x]?.stance ?? ''}`).join(', '));
        for (const e of r.events) if (!e.minor || args.includes('--minor')) console.log('   ', e.type, '·', e.text, e.type === 'battle' ? JSON.stringify({ men: e.men, lost: e.lost, plans: e.plans }) : '');
      }
      if (args.includes('--hero')) {
        const h = heroOf(r.state), fell = r.events.find((e) => e.type === 'hero');
        trail.push(h ? `${fmtMen(h.men)}@${h.at}` : 'X');
        if (fell) trail.push(`(${r.events.filter((e) => e.type === 'battle' && e.at === fell.at).map((e) => `${e.text} ${JSON.stringify({ men: e.men, lost: e.lost })}`).join('; ')})`);
      }
      s = r.state;
    }
    if (args.includes('--hero')) console.log(`   seed ${seed} ${s.verdict.as}: ${trail.join(' ')}`);
    tally[s.verdict.as]++;
    if (args.includes('--why')) console.log(`   seed ${seed}: turn ${s.end.turn}, ${s.end.why} · ${goalState(C, s).text}`);
    ends[s.end.why] = (ends[s.end.why] ?? 0) + 1;
    turns.push(s.end.turn);
  }
  console.log(`${C.id}: ${Object.entries(tally).map(([k, v]) => `${VERDICT[k]} ${v}`).join(', ')} · mean end turn ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} of ${C.turns.length}`);
  for (const [why, n] of Object.entries(ends).sort((a, b) => b[1] - a[1])) console.log(`   ${n}× ${why}`);
}
}
