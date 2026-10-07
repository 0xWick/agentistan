// How long the realms of 1200 last: the share still standing by decade, over many ages. History keeps most of
// them alive for decades; a world where they all vanish in five years has lost its history.
//   node tools/survival.js 12
import { newAge, tick, living, yearOf, dateText } from '../web/silk/engine.js';
import { brain } from '../web/silk/doctrine.js';

const ages = +(process.argv[2] ?? 12);
const by = {};
const fallTimes = {};
for (let age = 1; age <= ages; age++) {
  let s = newAge(age);
  const historic = Object.keys(s.realms);
  while (s.status === 'running') {
    s = tick(s, brain, {}, { inPlace: true }).state;
    if (s.month % 60 === 0) {
      const y = yearOf(s.month);
      (by[y] ??= []).push(historic.filter((id) => s.realms[id] && !s.realms[id].fallen).length / historic.length);
    }
  }
  for (const id of historic) if (s.realms[id].fallen) (fallTimes[id] ??= []).push(yearOf(s.realms[id].fellAt ?? s.month));
}
console.log('realms of 1200 still standing:', Object.entries(by).map(([y, v]) => `${y} ${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100)}%`).join(' · '));
console.log('median year of fall:', Object.entries(fallTimes).map(([id, ys]) => `${id} ${ys.sort()[Math.floor(ys.length / 2)]} (${ys.length}/${ages})`).join(', '));
