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

test('markets: each treasury gains or loses 100 gold per 1% its coin moves between turns; trends set battle power; LINK prices soldiers', () => {
  let s = E.newSeason(1, 'standard', { ETH: 2000, BTC: 80000, LINK: 10 });
  assert.deepEqual([E.mood(s, 'red'), E.mercMult(s), E.recruitCost(s)], [0, 1, 2]);
  let r = E.startTurn(s); // red's first turn: nothing to compare with yet
  assert.equal(r.events.find((e) => e.type === 'resources.updated').data.dividend, 0);
  s = E.applyAction(r.state, 'red', { action: 'hold' }).state;
  s = E.applyAction(E.startTurn(s).state, 'blue', { action: 'hold' }).state;
  s = E.setPrice(s, 'ETH', 2010); // ETH +0.5% since red's last turn
  const gold = s.kingdoms.red.gold;
  r = E.startTurn(s);
  const ev = r.events.find((e) => e.type === 'resources.updated');
  assert.deepEqual([ev.data.dividendPct, ev.data.dividend], [0.5, 50]);
  assert.equal(r.state.kingdoms.red.gold, gold + ev.data.income + 50);
  assert.match(ev.summary, /ETH \+0\.50% since its last turn: \+50 gold/);
  s = E.setPrice(E.setPrice(E.setPrice(s, 'ETH', 2020), 'BTC', 79200), 'LINK', 10.5); // this season: ETH +1%, BTC -1%, LINK +5%
  assert.deepEqual([E.mood(s, 'red'), E.mood(s, 'blue')], [0.2, -0.2]);
  assert.deepEqual([E.mercMult(s), E.recruitCost(s)], [2.5, 5]);
  assert.equal(E.mood(E.setPrice(s, 'ETH', 3000), 'red'), 0.4); // capped
  const crash = E.setPrice(r.state, 'ETH', 1000); // a crash can't take the treasury below zero
  assert.equal(E.startTurn(E.applyAction(E.startTurn(E.applyAction(crash, 'red', { action: 'hold' }).state).state, 'blue', { action: 'hold' }).state).state.kingdoms.red.gold, 0);
});

test('weather: five regions dealt random cities each season (one per climate), and every sky only affects its own ground', () => {
  const skies = (n) => Object.values(E.skiesFor(n).regions);
  assert.deepEqual(skies(3), skies(3), 'the same season always gets the same skies');
  assert.deepEqual(new Set(skies(3).map((w) => w.climate)).size, 5, 'one of each climate');
  assert.ok([4, 5, 6, 7].some((n) => skies(n).map((w) => w.place).join() !== skies(3).map((w) => w.place).join()), 'seasons differ');

  const s = E.newSeason(1, 'demo'); // both armies start in the Crownlands (the middle)
  assert.deepEqual(Object.keys(s.weather.regions), ['nw', 'ne', 'mid', 'sw', 'se']);
  const rain = { code: 63, tempC: 12, windKmh: 10 };
  const wetHere = E.setWeather(s, 'mid', rain), wetAway = E.setWeather(s, 'se', rain);
  assert.equal(wetHere.weather.regions.mid.kind, 'rain');
  assert.ok(E.legalMoves(wetHere, 'red').length < E.legalMoves(s, 'red').length, 'mud where red stands slows it');
  assert.deepEqual(E.legalMoves(wetAway, 'red').filter((m) => m.x <= 4 && m.y <= 4), E.legalMoves(s, 'red').filter((m) => m.x <= 4 && m.y <= 4), 'rain elsewhere changes nothing here');
  const fog = { code: 45, tempC: 5, windKmh: 3 };
  assert.equal(E.intel(E.setWeather(s, 'mid', fog), 'red').visible, false, 'blue hides in the fog');
  assert.equal(E.intel(E.setWeather(s, 'nw', fog), 'red').visible, true, 'fog elsewhere hides nothing');
  const near = E.newSeason(1, 'demo');
  Object.assign(near.armies.red, { x: 4, y: 4 });
  const calm = E.odds(near, 'red', 4, 5), stormy = E.odds(E.setWeather(near, 'mid', { code: 95, tempC: 20, windKmh: 30 }), 'red', 4, 5); // Crown Fort is in the Crownlands
  assert.ok(Math.abs(stormy / calm - 0.7) < 0.02, `${stormy} vs ${calm}`);
  const snow = { code: 73, tempC: -5, windKmh: 5 };
  assert.equal(E.eats(E.setWeather(s, 'mid', snow), 'red'), 2 * E.eats(s, 'red'));
  assert.equal(E.eats(E.setWeather(s, 'se', snow), 'red'), E.eats(s, 'red'));
  const fair = { code: 1, tempC: 20, windKmh: 5 };
  const forage = (st) => E.startTurn(st).events.find((e) => e.type === 'resources.updated').data.forage;
  assert.deepEqual([forage(E.setWeather(s, 'mid', fair)), forage(wetHere)], [4, 0], 'clear weather feeds an army; rain does not');
  assert.deepEqual([{ code: 0, tempC: 38, windKmh: 5 }, { code: 2, tempC: 15, windKmh: 30 }, { code: 3, tempC: 1, windKmh: 5 }, fair].map(E.classifyWeather), ['heat', 'wind', 'cold', 'clear']);
});

test('upgrade: an old save keeps its ETH baseline and gets the five regions', () => {
  const old = { ...E.newSeason(2, 'demo'), market: { start: 2600, price: 2650, mult: 1.19 }, weather: { kind: 'rain', place: 'Lahore, Pakistan' } };
  const s = E.upgrade(old);
  assert.deepEqual(s.market.ETH, { start: 2600, price: 2650 });
  assert.deepEqual(s.market.BTC, { start: null, price: null });
  assert.deepEqual(Object.values(s.weather.regions).map((w) => w.kind), ['clear', 'clear', 'clear', 'clear', 'clear']);
  assert.deepEqual([s.weather.regions.mid.name, s.weather.regions.ne.name], ['Crownlands', 'Northern Marches']);
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
  const { headline, turnStory, momentText, isMoment, flow, asBusiness } = await import('../web/story.js');
  const { CAST } = await import('../server/config.js');
  const meta = { cast: CAST, turnIntervalMs: 1_800_000, llm: { mode: 'live', model: 'openai/gpt-oss-120b' } };
  const bad = /\(\d+,\d+\)|undefined|NaN|null/;
  // "See it as your business" must leave no war words behind, and no "an team" style grammar.
  const war = /\b(armies|army|soldiers?|castles?|strongholds?|battles?|attacks?|gold|food|generals?|marshal|war|kingdoms?|enemy|season|rounds?)\b|\ban (team|bid|staff)\b/i;
  let s = E.newSeason(3, 'demo', { ETH: 2500, BTC: 80000, LINK: 12 }), texts = 0;
  for (let i = 0; i < 400 && s.status === 'running'; i++) {
    const started = E.startTurn(s), k = started.state.active, o = pickOrder(started.state, k);
    const r = E.applyAction(started.state, k, o);
    const evs = [...started.events, { type: 'agent.decision', kingdom: k, stage: 'agent', data: { ...o, public_rationale: 'Why not.' } }, ...r.events];
    const out = [...headline(r.state, CAST), ...turnStory(evs, r.state, CAST).lines, ...evs.filter(isMoment).map((e) => momentText(e, r.state, CAST)),
      ...flow(evs, r.state, meta, 'agent', []).map((f) => f.now)];
    for (const t of out) {
      assert.doesNotMatch(t, bad, t);
      assert.doesNotMatch(asBusiness(t), war, asBusiness(t));
    }
    texts += out.length;
    s = r.state;
  }
  assert.equal(s.status, 'ended');
  assert.match(headline(s, CAST)[0], /won season 3/);
  assert.ok(texts > 100);
});

test('plan: the model\'s JSON is trimmed to known tech, 3 steps and plain text; empty or off-topic plans are handled', async () => {
  const { normalizePlan } = await import('../server/plan.js');
  const step = (n) => ({ title: `Step ${n}`, today: 'Calls all day', automated: 'An AI agent books it <b>now</b> http://evil.x', tech: ['AI agent', 'Rocket', 'AI agent', 'n8n automation'], result: 'Quiet phones' });
  const p = normalizePlan(JSON.stringify({ fit: true, headline: 'Your front desk, on autopilot', steps: [1, 2, 3, 4].map(step), extra: 'ignored' }));
  assert.equal(p.steps.length, 3);
  assert.deepEqual(p.steps[0].tech, ['AI agent', 'n8n automation']);
  assert.doesNotMatch(p.steps[0].automated, /<|http/);
  assert.equal(p.extra, undefined);
  assert.equal(normalizePlan({ fit: false, headline: 'I can only help with business workflows.' }).fit, false);
  assert.throws(() => normalizePlan({ fit: true, headline: 'x', steps: [] }));
  assert.throws(() => normalizePlan('not json'));
});
