// Runs whole ages of the Silk Road world with the rule-based rulers, to see what history comes out.
//   node tools/simulate.js            20 ages, a summary of each and the averages
//   node tools/simulate.js story 3    the chronicle of age 3, month by month
import { newAge, tick, living, provincesOf, PROVINCES, yearOf, dateText } from '../web/silk/engine.js';
import { brain } from '../web/silk/doctrine.js';

const [mode = 'stats', arg = '20'] = process.argv.slice(2);

function run(age, onEvents) {
  let s = newAge(age);
  const share = {};
  const t0 = performance.now();
  while (s.status === 'running') {
    const r = tick(s, brain, {}, { inPlace: true });
    s = r.state;
    onEvents?.(r.events, s);
    if (s.month % 120 === 0) {
      const top = living(s).map((x) => [x.short, provincesOf(s, x.id).length]).sort((a, b) => b[1] - a[1])[0];
      share[yearOf(s.month)] = `${top[0]} ${Math.round((top[1] / PROVINCES.length) * 100)}%`;
    }
  }
  return { s, share, ms: performance.now() - t0 };
}

if (mode === 'story') {
  const quiet = new Set(['army.raised', 'siege', 'heir']);
  run(+arg, (events) => {
    for (const e of events) if (!quiet.has(e.type)) console.log(`${e.date.padEnd(15)} ${e.type.padEnd(12)} ${e.text}`);
  });
} else {
  const rows = [];
  for (let age = 1; age <= +arg; age++) {
    const kinds = {};
    const { s, share, ms } = run(age, (events) => events.forEach((e) => { kinds[e.type] = (kinds[e.type] ?? 0) + 1; }));
    const alive = living(s).length, top3 = living(s).map((x) => `${x.short} ${provincesOf(s, x.id).length}`).sort((a, b) => +b.split(' ').pop() - +a.split(' ').pop()).slice(0, 3);
    const historic = living(s).filter((x) => x.origin === 'historic').length;
    rows.push({ age, end: yearOf(s.month), alive, historic, founded: s.record.founded, fallen: s.record.fallen, splits: s.record.splits, revolts: s.record.revolts, kills: s.record.assassinations,
      battles: s.record.battles, captures: s.record.captures, mongols: s.record.genghis === null ? 'no Great Khan' : 'Great Khan ' + dateText(s.record.genghis), ms: Math.round(ms) });
    console.log(`age ${age}: ends ${yearOf(s.month)} | ${s.endReason}`);
    console.log(`   alive ${alive} (historic ${historic}) | founded ${s.record.founded} fallen ${s.record.fallen} splits ${s.record.splits} revolts ${s.record.revolts} assassinations ${s.record.assassinations} | battles ${s.record.battles} captures ${s.record.captures} | ${rows.at(-1).mongols}${s.realms.mongol ? ` → ${s.realms.mongol.fallen ? 'gone' : `${provincesOf(s, 'mongol').length} provinces`}` : ''}`);
    console.log(`   top: ${top3.join(', ')} | leader by decade: ${Object.entries(share).map(([y, v]) => `${y} ${v}`).join(', ')} | ${Math.round(ms)} ms`);
    console.log(`   events: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  const avg = (k) => (rows.reduce((t, r) => t + r[k], 0) / rows.length).toFixed(1);
  console.log(`\naverages over ${rows.length} ages: alive ${avg('alive')}, founded ${avg('founded')}, fallen ${avg('fallen')}, splits ${avg('splits')}, revolts ${avg('revolts')}, assassinations ${avg('kills')}, battles ${avg('battles')}, captures ${avg('captures')}, ${avg('ms')} ms per age`);
}
