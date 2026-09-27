import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MAP, STRONGHOLDS } from '../server/config.js';
import * as E from '../server/engine.js';
import { decide, pickOrder, clean } from '../server/agent.js';
import { LENS } from '../web/lens.js';

const turn = (s, k, action, args = {}) => {
  const started = E.startTurn(s).state;
  assert.equal(started.active, k);
  const r = E.applyAction(started, k, { action, args });
  assert.equal(r.error, undefined, r.error);
  return r;
};

test('map: 10x10, mirror-symmetric across the anti-diagonal, 7 strongholds on fort/capital tiles', () => {
  assert.equal(MAP.length, 10);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) assert.equal(MAP[y][x], MAP[9 - x][9 - y], `tile (${x},${y})`);
  assert.equal(STRONGHOLDS.length, 7);
  for (const h of STRONGHOLDS) assert.match(MAP[h.y][h.x], /[FC]/, h.name);
});

test('demo: red captures the Crown Fort on its second turn, and the battle replays identically', () => {
  let s = E.newSeason(1, 'demo');
  s = turn(s, 'red', 'move', { x: 4, y: 4 }).state;
  s = turn(s, 'blue', 'hold').state;
  const a = turn(s, 'red', 'attack', { x: 4, y: 5 });
  const b = turn(s, 'red', 'attack', { x: 4, y: 5 });
  assert.deepEqual(a.battle, b.battle);
  assert.equal(a.battle.seed, E.rolls(1, 3).seed);
  const crown = E.strongholdAt(a.state, 4, 5);
  assert.deepEqual([crown.owner, crown.garrison], ['red', 15]);
  assert.deepEqual([a.state.armies.red.x, a.state.armies.red.y], [4, 5]);
  assert.ok(a.events.some((e) => e.type === 'stronghold.captured'));
});

test('rules reject illegal orders', () => {
  const s = E.startTurn(E.newSeason(1, 'demo')).state;
  assert.match(E.validate(s, 'blue', { action: 'hold' }), /not blue's turn/);
  assert.match(E.validate(s, 'red', { action: 'move', args: { x: 9, y: 9 } }), /not reachable/);
  assert.match(E.validate(s, 'red', { action: 'attack', args: { x: 8, y: 8 } }), /not an adjacent/);
  assert.match(E.validate(s, 'red', { action: 'recruit', args: { n: 5 } }), /own land/);
  assert.match(E.validate(s, 'red', { action: 'nuke' }), /unknown action/);
  assert.ok(E.applyAction(s, 'red', { action: 'move', args: { x: 9, y: 9 } }).error);
  assert.equal(E.validate(s, 'red', { action: 'move', args: { x: 4, y: 4 } }), null);
});

test('economy: starving armies lose 10% strength; buy_food refills without ending the turn', () => {
  const s = E.newSeason(1, 'standard');
  s.kingdoms.red.food = 0;
  const r = E.startTurn(s);
  assert.equal(r.state.armies.red.strength, 90);
  assert.ok(r.events.some((e) => e.type === 'army.starving'));
  const fed = E.applyAction(r.state, 'red', { action: 'buy_food', args: { n: 30 } });
  assert.equal(fed.state.kingdoms.red.food, 30);
  assert.equal(fed.state.active, 'red');
});

test('markets: each treasury coin moves income and battle power; LINK prices mercenaries for both', () => {
  let s = E.newSeason(1, 'standard', { ETH: 2000, BTC: 80000, LINK: 10 });
  assert.deepEqual([E.incomeMult(s, 'red'), E.incomeMult(s, 'blue'), E.mercMult(s), E.recruitCost(s)], [1, 1, 1, 2]);
  s = E.setPrice(E.setPrice(E.setPrice(s, 'ETH', 2020), 'BTC', 79200), 'LINK', 10.5); // ETH +1%, BTC -1%, LINK +5%
  assert.deepEqual([E.incomeMult(s, 'red'), E.incomeMult(s, 'blue')], [1.4, 0.6]);
  assert.deepEqual([E.mood(s, 'red'), E.mood(s, 'blue')], [0.1, -0.1]);
  assert.deepEqual([E.mercMult(s), E.recruitCost(s)], [2, 4]);
  s = E.setPrice(s, 'ETH', 3000); // +50%: clamped
  assert.deepEqual([E.incomeMult(s, 'red'), E.mood(s, 'red')], [3, 0.25]);
  assert.equal(E.incomeMult(E.newSeason(1), 'red'), 1); // no prices yet
});

test('weather: rain bogs armies down, fog blinds scouts, storms blunt attacks, snow doubles rations', () => {
  const s = E.newSeason(1, 'demo');
  const wet = E.setWeather(s, { code: 63, tempC: 12, windKmh: 10 });
  assert.equal(wet.weather.kind, 'rain');
  assert.ok(E.legalMoves(wet, 'red').every((m) => m.cost <= 1) && E.legalMoves(wet, 'red').length < E.legalMoves(s, 'red').length);
  assert.equal(E.intel(E.setWeather(s, { code: 45, tempC: 5, windKmh: 3 }), 'red').visible, false);
  const near = E.newSeason(1, 'demo');
  Object.assign(near.armies.red, { x: 4, y: 4 });
  const calm = E.odds(near, 'red', 4, 5), stormy = E.odds(E.setWeather(near, { code: 95, tempC: 20, windKmh: 30 }), 'red', 4, 5);
  assert.ok(Math.abs(stormy / calm - 0.7) < 0.02, `${stormy} vs ${calm}`);
  assert.equal(E.eats(E.setWeather(s, { code: 73, tempC: -5, windKmh: 5 }), 'red'), 2 * E.eats(s, 'red'));
  assert.equal(E.classifyWeather({ code: 0, tempC: 38, windKmh: 5 }), 'heat');
});

test('upgrade: a save from before markets and weather keeps its ETH baseline', () => {
  const old = { ...E.newSeason(2, 'demo'), market: { start: 2600, price: 2650, mult: 1.19 } };
  delete old.weather;
  const s = E.upgrade(old);
  assert.deepEqual(s.market.ETH, { start: 2600, price: 2650 });
  assert.deepEqual(s.market.BTC, { start: null, price: null });
  assert.equal(s.weather.kind, 'clear');
  assert.equal(E.upgrade(s), s);
});

test('recruiting works anywhere on your own land, at the LINK price', () => {
  let s = E.startTurn(E.newSeason(1, 'demo', { LINK: 10 })).state;
  s = E.applyAction(s, 'red', { action: 'move', args: { x: 4, y: 4 } }).state; // claims the path
  s = E.applyAction(E.startTurn(s).state, 'blue', { action: 'hold' }).state;
  s = E.startTurn(s).state;
  assert.equal(E.validate(s, 'red', { action: 'recruit', args: { n: 5 } }), null);
  const gold = s.kingdoms.red.gold, r = E.applyAction(s, 'red', { action: 'recruit', args: { n: 5 } });
  assert.equal(r.state.kingdoms.red.gold, gold - 5 * E.recruitCost(s));
});

test('fog of war hides a distant enemy', () => {
  const s = E.newSeason(1, 'standard');
  assert.equal(E.intel(s, 'red').visible, false);
  assert.equal(E.intel(E.newSeason(1, 'demo'), 'red').visible, true);
});

test('seasons end on capital capture and at the round limit', () => {
  const s = E.newSeason(1, 'standard');
  Object.assign(s.armies.red, { x: 8, y: 7, strength: 200 });
  Object.assign(s.armies.blue, { x: 5, y: 5 });
  const r = turn(s, 'red', 'attack', { x: 8, y: 8 });
  assert.deepEqual([r.state.status, r.state.winner], ['ended', 'red']);

  const t = E.newSeason(1, 'standard');
  Object.assign(t, { turn: t.maxRounds * 2, active: 'blue' });
  const end = turn(t, 'blue', 'hold');
  assert.equal(end.state.status, 'ended');
  assert.equal(end.state.winner, 'blue'); // equal score: tie goes to the defender
});

test('standing orders play whole seasons to a result, and every event type has a Tech Lens entry', () => {
  const seen = new Set();
  for (const scenario of ['demo', 'standard']) {
    let s = E.newSeason(7, scenario, { ETH: 2500, BTC: 80000, LINK: 12 });
    for (let i = 0; i < 400 && s.status === 'running'; i++) {
      const started = E.startTurn(s);
      const r = E.applyAction(started.state, started.state.active, pickOrder(started.state, started.state.active));
      assert.equal(r.error, undefined, `${scenario} turn ${s.turn}: ${r.error}`);
      [...started.events, ...r.events].forEach((e) => seen.add(e.type));
      s = r.state;
    }
    assert.equal(s.status, 'ended', `${scenario} season should finish`);
  }
  // plus every event type the server and agent can emit
  for (const f of readdirSync(new URL('../server/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(`../server/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/emit\(\s*'([a-z0-9_]+\.[a-z0-9_]+)'/g)) seen.add(m[1]);
  }
  const missing = [...seen].filter((t) => !LENS[t]);
  assert.deepEqual(missing, [], 'event types without a Tech Lens entry');
  assert.ok(seen.size > 25);
});

test('agent: reads intel, gets corrected on an illegal order, then returns a legal one', async () => {
  const s = E.startTurn(E.newSeason(1, 'demo')).state;
  const call = (name, args) => ({ id: `c${Math.random()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  const script = [
    [call('get_battlefield', { say: 'Show me the field.' })],
    [call('attack', { say: 'Now!', x: 8, y: 8, public_rationale: 'Straight at their capital.', memory_note: 'x' })],
    [call('move', { say: 'Fine.', x: 4, y: 4, public_rationale: 'Closer to the Crown Fort. See https://evil.example <b>now</b>', memory_note: 'Next turn: take the Crown Fort.' })],
  ];
  const llm = { status: () => ({ mode: 'live' }), chat: async () => ({ message: { content: '', tool_calls: script.shift() } }) };
  const events = [];
  const d = await decide({ s, k: 'red', mem: { journal: { red: [], blue: [] }, lessons: { red: [], blue: [] } }, llm, emit: (type, summary) => events.push({ type, summary }) });
  assert.deepEqual([d.action, d.args, d.mode], ['move', { x: 4, y: 4 }, 'live']);
  assert.equal(d.public_rationale, 'Closer to the Crown Fort. See bnow/b');
  assert.ok(events.some((e) => e.type === 'agent.tool_result' && /Rejected/.test(e.summary)));
  assert.ok(events.some((e) => e.type === 'agent.thought'));

  const broken = { status: () => ({ mode: 'live' }), chat: async () => { throw new Error('boom'); } };
  const fb = await decide({ s, k: 'red', mem: { journal: { red: [] }, lessons: { red: [] } }, llm: broken, emit: () => {} });
  assert.equal(fb.mode, 'standing');
  assert.equal(E.validate(s, 'red', fb), null);
});

test('clean() strips links and markup and caps length', () => {
  assert.equal(clean('go to http://x.io <script>now</script> please', 30), 'go to scriptnow/script please');
  assert.equal(clean('a b c d e', 3), 'a b c');
});

test('narrator: whole seasons read as plain sentences, with no coordinates or blanks', async () => {
  const { headline, turnStory, momentText, isMoment, flow } = await import('../web/story.js');
  const { CAST } = await import('../server/config.js');
  const meta = { cast: CAST, turnIntervalMs: 1_800_000, llm: { mode: 'live', model: 'openai/gpt-oss-120b' } };
  const bad = /\(\d+,\d+\)|undefined|NaN|null/;
  let s = E.newSeason(3, 'demo', { ETH: 2500, BTC: 80000, LINK: 12 }), texts = 0;
  for (let i = 0; i < 400 && s.status === 'running'; i++) {
    const started = E.startTurn(s), k = started.state.active, o = pickOrder(started.state, k);
    const r = E.applyAction(started.state, k, o);
    const evs = [...started.events, { type: 'agent.decision', kingdom: k, stage: 'agent', data: { ...o, public_rationale: 'Why not.' } }, ...r.events];
    const out = [...headline(r.state, CAST), ...turnStory(evs, r.state, CAST).lines, ...evs.filter(isMoment).map((e) => momentText(e, r.state, CAST)),
      ...flow(evs, r.state, meta, 'agent', []).map((f) => f.now)];
    for (const t of out) assert.doesNotMatch(t, bad, t);
    texts += out.length;
    s = r.state;
  }
  assert.equal(s.status, 'ended');
  assert.match(headline(s, CAST)[0], /won season 3/);
  assert.ok(texts > 100);
});
