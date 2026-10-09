// Follows one army through a simulated war, season by season, with what happened to it (for balancing).
//   node tools/campaign/follow.mjs <campaign> <army id> [seed]
import { CAMPAIGN } from '../../web/campaign/catalog.js';
import { newCampaign, resolve, cardsDue, autoRaise, withCards, fmtMen } from '../../web/campaign/engine.js';
import { smartOrders } from './sim.mjs';
const [cid, army, seed = 2] = process.argv.slice(2), C = CAMPAIGN[cid];
let s = newCampaign(C, +seed);
while (s.status === 'running') {
  const cards = Object.fromEntries(cardsDue(C, s).map((c) => [c.id, c.pick ?? c.advise ?? 0]));
  const pre = withCards(C, s, cards), before = pre.armies[army];
  const r = resolve(s, C, { cards, orders: smartOrders(C, pre), raise: autoRaise(C, pre) });
  const a = r.state.armies[army];
  console.log(C.turns[s.turn].label, before ? `${fmtMen(before.men)}@${before.at}` : '-', '→', a ? `${fmtMen(a.men)}@${a.at}` : 'gone', r.events.filter((e) => JSON.stringify(e).includes(army) || (before && e.at === before.at)).map((e) => e.type + ': ' + e.text).join(' | '));
  s = r.state;
}
