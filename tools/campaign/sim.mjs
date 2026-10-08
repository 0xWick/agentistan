// Plays campaigns with the rules on every side, to see that each one runs, and how often history is beaten.
//   node tools/campaign/sim.mjs [id] [runs] [--verbose] [--smart] [--cards=history|advise|first|second]
// --smart plays your side as a competent player would: gather, then strike together with the plan that fits.
import { CAMPAIGNS } from '../../web/campaign/catalog.js';
import { newCampaign, resolve, cardsDue, autoOrders, autoRaise, VERDICT, menOf, fmtMen, withCards, reach, wayTo, atWar, armiesOf, battleFacts, plansFor, fitOf, friends } from '../../web/campaign/engine.js';

// A competent player: all armies gather against the enemy's main army and strike together, with the plan that fits,
// only when the odds are good; otherwise the rules' orders.
function smartOrders(C, s) {
  const you = C.you, mine = armiesOf(s, you), base = autoOrders(C, s);
  const area = new Set(C.goal.provs ?? Object.keys(C.prov));
  const foes = Object.values(s.armies).filter((a) => atWar(s, you, a.side)).sort((a, b) => (area.has(b.at) - area.has(a.at)) || b.men - a.men);
  const T = foes[0];
  if (!T || !mine.length) return base;
  const q = (a) => a.men * (C.sides[a.side].quality ?? 1) * (1 + 0.08 * (a.skill - 3));
  const there = Object.values(s.armies).filter((a) => a.at === T.at && (a.side === T.side || friends(s, a.side, T.side)));
  const theirs = there.reduce((t, a) => t + q(a), 0) * ({ hills: 1.15, mountains: 1.3, forest: 1.15, marsh: 1.2, river: 1.1 }[C.prov[T.at].terrain] ?? 1);
  const can = mine.filter((a) => reach(C, s, a.id)[T.at]);
  const ours = can.reduce((t, a) => t + q(a), 0);
  const orders = { ...base };
  if (can.length && ours >= theirs * 1.1) {
    const f = battleFacts(C, s, T.at, can, there, false);
    const plan = plansFor(C, false).map((p) => [p, fitOf(f, p)]).sort((x, y) => y[1] - x[1])[0][0];
    for (const a of can) orders[a.id] = { to: T.at, plan };
    return orders;
  }
  for (const a of mine) { // gather next to the enemy, or come closer
    const r = reach(C, s, a.id), way = wayTo(C, s, you, a.at, T.at);
    if (!way) continue;
    const near = Object.keys(r).filter((p) => C.prov[T.at].neighbors.includes(p) && !Object.values(s.armies).some((o) => o.at === p && atWar(s, you, o.side)));
    if (near.length) orders[a.id] = { to: near[0], plan: 'hold' };
    else { let pick = null; for (const p of way.slice(1, -1)) if (r[p]) pick = p; else break; orders[a.id] = { to: pick, plan: 'hold' }; }
  }
  return orders;
}

const args = process.argv.slice(2), verbose = args.includes('--verbose'), smart = args.includes('--smart'), how = (args.find((a) => a.startsWith('--cards=')) ?? '--cards=history').slice(8);
const [id, runs = 20] = args.filter((a) => !a.startsWith('--'));
for (const C of CAMPAIGNS.filter((c) => !id || c.id === id)) {
  const tally = { better: 0, as: 0, worse: 0 }, ends = {}, turns = [];
  for (let seed = 1; seed <= +runs; seed++) {
    let s = newCampaign(C, seed);
    while (s.status === 'running') {
      const cards = Object.fromEntries(cardsDue(C, s).map((c) => [c.id, how === 'history' ? c.pick ?? c.advise ?? 0 : how === 'first' ? 0 : how === 'second' ? Math.min(1, c.options.length - 1) : c.advise ?? 0]));
      const pre = withCards(C, s, cards);
      const r = resolve(s, C, { cards, orders: smart ? smartOrders(C, pre) : autoOrders(C, pre), raise: autoRaise(C, pre) });
      if (verbose && seed === 1) {
        console.log(`\n${C.turns[s.turn].label}: ${C.sides[C.you].name} ${fmtMen(menOf(r.state, C.you))} men, gold ${Math.round(r.state.sides[C.you].gold)}, will ${Math.round(r.state.sides[C.you].will)}; ` + Object.keys(C.sides).filter((x) => x !== C.you && r.state.sides[x].alive).map((x) => `${x} ${fmtMen(menOf(r.state, x))} w${Math.round(r.state.sides[x].will)} ${r.state.plans[x]?.stance ?? ''}`).join(', '));
        for (const e of r.events) if (!e.minor) console.log('   ', e.type, '·', e.text);
      }
      s = r.state;
    }
    tally[s.verdict.as]++;
    ends[s.end.why] = (ends[s.end.why] ?? 0) + 1;
    turns.push(s.end.turn);
  }
  console.log(`${C.id}: ${Object.entries(tally).map(([k, v]) => `${VERDICT[k]} ${v}`).join(', ')} · mean end turn ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} of ${C.turns.length}`);
  for (const [why, n] of Object.entries(ends).sort((a, b) => b[1] - a[1])) console.log(`   ${n}× ${why}`);
}
