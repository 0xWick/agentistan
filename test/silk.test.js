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

test('the realms of 1200 start where history put them', () => {
  const s = newAge(1);
  assert.equal(s.provinces.baghdad.owner, 'abbasid');
  assert.equal(s.provinces.samarkand.owner, 'karakhanid');
  assert.equal(s.chars[s.realms.georgia.ruler].name, 'Tamar');
  assert.ok(s.realms.karakhanid.overlord === 'qarakhitai');
  assert.ok(Object.keys(s.wars).includes('ghurid|khwarazm'));
});
