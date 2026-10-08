// The campaigns: each one is whole (map, sides, armies, calendar, cards), plays to an end, and replays exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS, CAMPAIGN } from '../web/campaign/catalog.js';
import { newCampaign, resolve, cardsDue, autoOrders, autoRaise, withCards, checksum, replay, heroOf, PLANS, TEMPERS, VERDICT, verdict, fmtMen } from '../web/campaign/engine.js';

// One war played to its end by the rules, with history's choices on the cards.
function play(C, seed, pick = (c) => c.pick ?? c.advise ?? 0) {
  let s = newCampaign(C, seed);
  const turns = [];
  while (s.status === 'running') {
    const cards = Object.fromEntries(cardsDue(C, s).map((c) => [c.id, pick(c)]));
    const pre = withCards(C, s, cards), inputs = { cards, orders: autoOrders(C, pre), raise: autoRaise(C, pre) };
    turns.push(inputs);
    s = resolve(s, C, inputs).state;
    assert.ok(turns.length <= C.turns.length, `${C.id}: more turns than the calendar`);
  }
  return { s, turns };
}

test('every campaign is whole: its map, sides, armies, calendar and cards', () => {
  assert.ok(CAMPAIGNS.length >= 2);
  const ns = new Set();
  for (const C of CAMPAIGNS) {
    assert.ok(!ns.has(C.n), `${C.id}: its place in history is taken`);
    ns.add(C.n);
    assert.ok(C.sides[C.you], `${C.id}: the player's side`);
    assert.ok(C.turns.length >= 8 && C.turns.length <= 24, `${C.id}: 8 to 24 turns`);
    assert.equal(C.meanwhile.length, C.turns.length, `${C.id}: a history line for every turn`);
    assert.ok(C.brief.length && C.hook && C.history.text, `${C.id}: briefing and history`);
    assert.ok(['peace', 'take', 'destroy', 'hold', 'drive', 'custom'].includes(C.goal.kind), `${C.id}: a known goal`);
    for (const p of Object.values(C.prov)) {
      assert.ok(p.neighbors.length, `${C.id}: ${p.id} has a way out`);
      for (const n of p.neighbors) assert.ok(C.prov[n]?.neighbors.includes(p.id), `${C.id}: ${p.id}–${n} goes both ways`);
      assert.ok(!p.owner || C.sides[p.owner], `${C.id}: ${p.id} is held by a known side`);
    }
    for (const d of Object.values(C.sides)) {
      assert.ok(TEMPERS[d.ai], `${C.id}: ${d.id} has a known temper`);
      assert.ok(!d.capital || C.prov[d.capital], `${C.id}: ${d.id}'s capital is on the map`);
    }
    for (const [side, at] of C.armies) assert.ok(C.sides[side] && C.prov[at], `${C.id}: an army of ${side} at ${at}`);
    for (const c of C.cards ?? []) {
      assert.ok(c.title && c.text && c.options.length >= 2, `${c.id}: a card with choices`);
      assert.ok(c.history, `${C.id}/${c.id}: says what history did`);
      assert.ok(c.pick === undefined || c.options[c.pick], `${C.id}/${c.id}: history's choice is one of the options`);
    }
    for (const id of C.plans) assert.ok(PLANS[id], `${C.id}: plan ${id}`);
  }
});

test('every campaign plays to an end, with a verdict against history', () => {
  for (const C of CAMPAIGNS) {
    for (const seed of [1, 2]) {
      const { s } = play(C, seed);
      assert.notEqual(s.status, 'running');
      assert.ok(s.end?.why, `${C.id}: says why it ended`);
      assert.ok(VERDICT[s.verdict?.as], `${C.id}: a verdict`);
      assert.deepEqual(s.verdict, verdict(C, s));
    }
    play(C, 3, (c) => c.options.length - 1); // the other road, too
  }
});

test('a war replays exactly from its record', () => {
  for (const C of CAMPAIGNS) {
    const { s, turns } = play(C, 7);
    const again = replay(C, 7, turns).state;
    assert.equal(checksum(again), checksum(s), `${C.id}: the replay strays`);
    assert.equal(checksum(replay(C, 7, turns, 3).state), checksum(replay(C, 7, turns.slice(0, 3)).state));
  }
});

test('the cards: their effect is seen before the turn ends, and the turn applies the same', () => {
  const C = CAMPAIGN.hannibal, s = newCampaign(C, 5);
  assert.equal(heroOf(s).at, 'newcarthage');
  const pre = withCards(C, s, { road: 0 });
  assert.equal(heroOf(pre).at, 'taurini', 'over the Alps');
  assert.ok(heroOf(pre).men < heroOf(s).men, 'the Alps cost men');
  assert.equal(heroOf(s).at, 'newcarthage', 'the preview leaves the war untouched');
  const r = resolve(s, C, { cards: { road: 0 } });
  assert.ok(r.events.some((e) => e.type === 'card' && e.card === 'road'));
  assert.equal(r.state.cards.road, 0);
});

test('orders are checked by the engine: no marching another side’s army, or past an army’s reach', () => {
  const C = CAMPAIGN.hannibal, s = newCampaign(C, 9);
  const roman = Object.values(s.armies).find((a) => a.side === 'rome');
  const r = resolve(s, C, { orders: { [roman.id]: { to: 'carthage' }, hannibal: { to: 'rome' } } });
  assert.equal(r.state.armies[roman.id]?.order?.by, undefined);
  assert.notEqual(r.state.armies.hannibal.at, 'rome', 'Rome is far beyond one turn from Spain');
});

test('army sizes read well, from hundreds to millions', () => {
  assert.equal(fmtMen(800), '800');
  assert.equal(fmtMen(45000), '45k');
  assert.equal(fmtMen(1_250_000), '1.3M');
  assert.equal(fmtMen(12_000_000), '12M');
});

test('the people are real: the dead lead no army, no side and no council, and history’s deaths happen', async () => {
  const { courtOf, leaderOf, sameMan } = await import('../web/campaign/engine.js');
  for (const C of CAMPAIGNS) {
    for (let seed = 1; seed <= 6; seed++) {
      let s = newCampaign(C, seed);
      while (s.status === 'running') {
        s = resolve(s, C, { orders: autoOrders(C, s), raise: autoRaise(C, s) }).state;
        const dead = new Set(s.dead);
        for (const a of Object.values(s.armies)) assert.ok(!dead.has(a.gen), `${C.id}: ${a.gen} is dead but leads an army`);
        for (const p of courtOf(C, s)) assert.ok(!dead.has(p.name), `${C.id}: ${p.name} is dead but sits in the council`);
        for (const id of Object.keys(C.sides)) { const l = leaderOf(C, s, id); assert.ok(/ and /.test(l) || !s.dead.some((n) => sameMan(l, n)), `${C.id}: ${l} is dead but leads ${id}`); }
      }
    }
  }
  // Pericles dies of the plague in 429 BC, and Cleon leads his army
  const C = CAMPAIGN.sparta;
  let s = newCampaign(C, 1);
  for (let t = 0; t < 3; t++) s = resolve(s, C, {}).state;
  assert.ok(s.dead.includes('Pericles'));
  assert.ok(!Object.values(s.armies).some((a) => a.gen === 'Pericles'));
  assert.match(leaderOf(C, s, 'athens'), /Cleon/);
});

test('the council understands plain words, and checks them against the war', async () => {
  const { proposal, interpret, summary } = await import('../web/campaign/court.js');
  const C = CAMPAIGN.hannibal, s = newCampaign(C, 3);
  let d = proposal(C, s);
  let r = interpret(C, s, d, 'We cross the Alps');
  assert.equal(r.draft.cards.road, 0, 'the road card is answered');
  d = r.draft;
  r = interpret(C, s, d, 'Hanno, hold Carthage. Hasdrubal, take Tarraco');
  assert.equal(r.draft.orders.hanno.to, null);
  assert.ok(r.draft.orders.hasdrubal.to, 'Hasdrubal marches');
  assert.equal(r.draft.aims.hasdrubal, 'tarraco', 'too far for one season: the aim is kept');
  r = interpret(C, s, r.draft, 'How many men does Rome have?');
  assert.ok(r.replies.some((x) => /80k/.test(x.text)), 'questions are answered from the war’s data');
  assert.ok(summary(C, s, r.draft).length >= 3);
});
