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
  assert.match(E.validate(s, 'red', { action: 'recruit', args: { n: 5 } }), /own capital or fort/);
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

test('market multiplier follows the real price, amplified and clamped', () => {
  assert.equal(E.marketMult(2000, 2020), 1.1);
  assert.equal(E.marketMult(2000, 3000), 1.5);
  assert.equal(E.marketMult(2000, 1000), 0.5);
  assert.equal(E.marketMult(null, 2000), 1);
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
    let s = E.newSeason(7, scenario, 2500);
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
