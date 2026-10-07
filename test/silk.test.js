import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAge, tick, frame, PROVINCES, PROV, living } from '../web/silk/engine.js';
import { brain } from '../web/silk/doctrine.js';

function run(age, months, check) {
  let s = newAge(age);
  const frames = [];
  for (let m = 0; m < months && s.status === 'running'; m++) {
    const r = tick(s, brain);
    s = r.state;
    frames.push(frame(s));
    check?.(s, r.events);
  }
  return { s, frames };
}

test('the same age replays exactly, month by month', () => {
  assert.equal(JSON.stringify(run(7, 120).frames), JSON.stringify(run(7, 120).frames));
  assert.notEqual(JSON.stringify(run(7, 60).frames), JSON.stringify(run(8, 60).frames));
});

test('the world stays coherent for decades', () => {
  run(3, 360, (s, events) => {
    const alive = new Set(living(s).map((r) => r.id));
    for (const p of PROVINCES) {
      const o = s.provinces[p.id].owner;
      assert.ok(o === null || alive.has(o), `${p.id} is held by ${o}, which is gone (month ${s.month})`);
    }
    for (const a of Object.values(s.armies)) {
      assert.ok(alive.has(a.realm), `army ${a.id} serves a fallen realm`);
      assert.ok(PROV[a.at] && a.size > 0 && Number.isFinite(a.size), `army ${a.id} is somewhere impossible`);
    }
    for (const r of living(s)) assert.ok(Number.isFinite(r.gold) && r.gold >= 0, `${r.id} has ${r.gold} gold`);
    for (const e of events) assert.doesNotMatch(e.text, /undefined|NaN|null|\[object/, e.text);
  });
});

test('the inner life of the world happens: courts, battles over months, works, learning, the registry', () => {
  const seen = new Set();
  let longBattle = false, decided = 0;
  const { s } = run(5, 300, (s, events) => {
    for (const e of events) seen.add(e.type);
    if (events.some((e) => e.type === 'battle' && e.rounds > 1)) longBattle = true;
    decided += s.pending.length;
    for (const p of PROVINCES) {
      const d = s.deeds[p.id];
      if (s.provinces[p.id].owner) assert.equal(d.at(-1).realm, s.provinces[p.id].owner, `the registry of ${p.id} disagrees with the map`);
    }
  });
  for (const t of ['clash', 'battle', 'marriage', 'built', 'invention', 'season', 'peace', 'crowned']) assert.ok(seen.has(t), `no ${t} in 25 years`);
  assert.ok(longBattle, 'no battle lasted more than a month');
  assert.ok(decided > 0, 'no character ever faced a decision');
  assert.ok(Object.values(s.chars).some((c) => c.alive && c.temper), 'nobody has a temperament');
});

test('the realms of 1200 start where history put them', () => {
  const s = newAge(1);
  assert.equal(s.provinces.baghdad.owner, 'abbasid');
  assert.equal(s.provinces.samarkand.owner, 'karakhanid');
  assert.equal(s.chars[s.realms.georgia.ruler].name, 'Tamar');
  assert.ok(s.realms.karakhanid.overlord === 'qarakhitai');
  assert.ok(Object.keys(s.wars).includes('ghurid|khwarazm'));
});


test('the other ages start whole, and 1914 goes to war as it did', () => {
  for (const ageId of ['ancient', 'modern']) {
    const s = newAge(3, ageId);
    for (const p of PROVINCES) { const o = s.provinces[p.id].owner; assert.ok(o === null || s.realms[o], `${ageId}: ${p.id} held by ${o}`); }
    assert.ok(living(s).length > 30, `${ageId}: realms`);
  }
  let s = newAge(3, 'modern');
  const seen = [];
  for (let m = 0; m < 12; m++) { const r = tick(s, brain, {}, { inPlace: true }); s = r.state; seen.push(...r.events); }
  const war = (a, b) => seen.some((e) => e.type === 'war' && e.realms?.includes(a) && e.realms?.includes(b)); // declared, though it may be over already
  assert.ok(seen.some((e) => e.type === 'death' && /Franz Ferdinand/.test(e.text)), 'Sarajevo');
  for (const [a, b] of [['austria', 'serbia'], ['germany', 'russia'], ['germany', 'france'], ['uk', 'germany'], ['ottoman', 'russia']]) assert.ok(war(a, b), `${a} and ${b} went to war in 1914`);
  assert.ok(!war('italy', 'france') && !war('italy', 'germany'), 'Italy waits');
});

test('a player seizes a throne, rules from the council, and loses it by staying away', () => {
  let s = newAge(5);
  const id = 'georgia';
  const step = (inputs = {}) => { const r = tick(s, brain, inputs, { inPlace: true }); s = r.state; return r.events; };
  const seen = step({ seize: { [id]: { name: 'Vakhtang the Bold', temper: 'conqueror', line: 'a soldier of the mountains' } } });
  const me = s.chars[s.realms[id].ruler];
  assert.equal(me.name, 'Vakhtang the Bold');
  assert.ok(s.players[id] && seen.some((e) => e.type === 'coup' && e.player === id), 'the coup');
  // Decisions put to the player's ruler wait for the next council; matters arrive for it.
  for (let i = 0; i < 2; i++) step();
  const mine = () => s.pending.filter((d) => d.realm === id && d.char === s.realms[id].ruler);
  assert.ok(mine().some((d) => d.kind === 'matter'), 'matters for the council');
  const m = mine().find((d) => d.kind === 'matter');
  step({ councils: { [id]: true }, answers: { [m.id]: { choice: 'ignore' } } }); // the council month: answered
  assert.ok(!s.pending.some((d) => d.id === m.id), 'settled at the council');
  assert.equal(s.players[id].missed, 0);
  // Heir and abdication.
  const kin = Object.values(s.chars).find((c) => c.alive && c.realm === id && ['general', 'courtier', 'child'].includes(c.role));
  step({ acts: { [id]: [{ kind: 'heir', char: kin.id }] } });
  assert.equal(s.realms[id].heir, kin.id);
  // Away for too long: the vizier skims, and at last someone else takes the throne.
  let usurped = false;
  for (let q = 0; q < 16 && !usurped; q++) for (let i = 0; i < 3; i++) usurped ||= step().some((e) => e.usurped === id);
  assert.ok(usurped && !s.players[id], 'the throne is lost after a long absence');
});
