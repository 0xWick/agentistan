// The field of battle: a commanded battle is fought again exactly from its record, in the engine as on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN } from '../web/campaign/catalog.js';
import { newCampaign, resolve, battlesAhead, cardsDue, checksum } from '../web/campaign/engine.js';
import { newField, hour, battleWords, play } from '../web/campaign/battle.js';

test('a battle commanded on the field replays exactly, and the page and the engine agree', () => {
  const C = CAMPAIGN.persian, s = newCampaign(C, 3);
  const inputs = { orders: { athenians: { to: 'marathon', plan: 'phalanx' } }, cards: Object.fromEntries(cardsDue(C, s).map((c) => [c.id, c.pick ?? 0])) };
  const [b] = battlesAhead(C, s, inputs);
  assert.equal(b?.at, 'marathon');
  // the page: two hours of orders in words, then the general fights the rest
  let f = newField(b.setup);
  const rounds = [];
  for (const words of ['Charge!', 'Archers, loose at their foot. Foot, hold']) { const o = battleWords(f, words).orders; rounds.push({ orders: o }); f = hour(f, o, { tempers: b.setup.tempers }); }
  const record = { rounds, auto: true };
  const page = play(b.setup, record, b.setup.tempers);
  // the engine, twice
  const one = resolve(s, C, { ...inputs, battles: { marathon: record } }), two = resolve(s, C, { ...inputs, battles: { marathon: record } });
  assert.equal(checksum(one.state), checksum(two.state));
  const fought = one.events.find((e) => e.type === 'battle' && e.at === 'marathon');
  assert.ok(fought?.commanded, 'the battle is marked as commanded');
  assert.equal(fought.winner === b.setup.armies.find((a) => a.camp === 'a').side, page.aWins);
});
