// Every campaign, many seeds, the rules playing both sides: no dead person may lead an army, lead a side, sit in the
// council, or win a battle after death. Prints how often each person died. Usage: node tools/campaign/people-check.mjs [seeds]
import { CAMPAIGNS } from '../../web/campaign/catalog.js';
import { newCampaign, resolve, autoOrders, autoRaise, courtOf, leaderOf, sameMan } from '../../web/campaign/engine.js';

const SEEDS = +(process.argv[2] ?? 40);
let bad = 0, runs = 0;
for (const C of CAMPAIGNS) {
  const deaths = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    let s = newCampaign(C, seed);
    while (s.status === 'running') {
      const r = resolve(s, C, { orders: autoOrders(C, s, C.you), raise: autoRaise(C, s, C.you), cards: {} });
      const dead = new Set(r.state.dead);
      for (const e of r.events) for (const n of s.dead) if (e.type === 'battle' && (e.gens ?? []).includes(n)) { bad++; console.log(C.id, seed, 'a dead man fights:', n, '|', e.text); }
      for (const a of Object.values(r.state.armies)) if (dead.has(a.gen)) { bad++; console.log(C.id, seed, 'a dead man leads an army:', a.gen); }
      for (const id of Object.keys(C.sides)) {
        const l = leaderOf(C, r.state, id);
        if (!/ and /.test(l) && [...dead].some((n) => sameMan(l, n))) { bad++; console.log(C.id, seed, 'a dead man leads a side:', id, l); }
      }
      for (const p of courtOf(C, r.state)) if (dead.has(p.name)) { bad++; console.log(C.id, seed, 'a dead man sits in the council:', p.name); }
      for (const n of r.state.dead) if (!s.dead.includes(n)) deaths[n] = (deaths[n] ?? 0) + 1;
      s = r.state;
    }
    runs++;
  }
  console.log(C.id.padEnd(14), Object.entries(deaths).map(([n, k]) => `${n}×${k}`).join(', '));
}
console.log(`${runs} wars, ${bad} problems`);
process.exitCode = bad ? 1 : 0;
