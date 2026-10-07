// What happens to the world besides its rulers: the turn of the seasons, plague, famine, floods and earthquakes;
// inventions that spread across borders and by conquest; and each realm's fortune, read every January: golden ages,
// decline and poverty.
import { RULES as R } from './rules.js';
import { PROVINCES, PROV, onRoad, provincesOf, living, atWar, weatherOf, clamp, round1, chance, pick, short, ofR, say, vb, poss, fullName, cityOf, placeOf, yearOf } from './core.js';
import { prosperityOf, steersman } from './economy.js';

// The inventions an age can know. Effects live where they act (knows(realm, id) in economy.js and war.js).
export const INVENTIONS = {
  paper: { name: 'Paper', icon: 'scroll', text: 'Paper mills: more scholars, faster learning', cost: 60, learn: 1.25 },
  trebuchet: { name: 'Counterweight trebuchet', icon: 'tower', text: 'Siege engines that cut a month off every siege', cost: 90 },
  gunpowder: { name: 'Gunpowder', icon: 'flame', text: 'Fire lances and bombs: shorter sieges, stronger storms', cost: 150 },
  compass: { name: 'Compass', icon: 'star', text: 'Ships find their way: straits are crossed faster', cost: 90 },
  windmill: { name: 'Windmills', icon: 'wheat', text: 'Mills grind more grain from the same fields', cost: 70 },
  rotation: { name: 'Three-field rotation', icon: 'wheat', text: 'Fields rest in turn and give more', cost: 80 },
  credit: { name: 'Bills of exchange', icon: 'coin', text: 'Merchants lend across the world: more gold', cost: 100 },
  steel: { name: 'Crucible steel', icon: 'anvil', text: 'Fine blades from less iron', cost: 90 },
  printing: { name: 'Movable type', icon: 'scroll', text: 'Books for the many: learning flows faster', cost: 170, learn: 1.4 },
  observatory: { name: 'Observatory', icon: 'eye', text: 'Astronomers and true calendars: learning and renown', cost: 120, learn: 1.2 },
  torsion: { name: 'Torsion catapults', icon: 'tower', text: 'Engines of twisted sinew that cut a month off every siege', cost: 80 },
  elephants: { name: 'War elephants', icon: 'castle', text: 'Elephants that break lines in open country', cost: 90 },
  legion: { name: 'The legion', icon: 'banner', text: 'Drilled maniples that win more battles', cost: 120 },
  crossbow: { name: 'Crossbows', icon: 'bow', text: 'Bolts that pierce armour: stronger infantry', cost: 90 },
};

export function world(s, rng, emit) {
  seasons(s, emit);
  disasters(s, rng, emit);
  learning(s, rng, emit);
  if (s.month % 12 === 0 && s.month > 0) fortune(s, emit);
}

// ---------- the turn of the year ----------
// Twice a year the chronicle notes what the season does: winter closes the north, the monsoon closes India.
function seasons(s, emit) {
  const mo = s.month % 12;
  const held = (pred) => PROVINCES.filter((p) => pred(p) && s.provinces[p.id].owner);
  if (mo === 11 && held((p) => p.climate === 'cold').length) emit('season', 'Winter: snow closes the passes of the north, the herds grow thin, and armies seek winter quarters', { weather: 'snow' });
  if (mo === 5 && held((p) => p.climate === 'monsoon').length) emit('season', 'The monsoon breaks over India and the south of China: rivers flood and campaigns halt until autumn', { weather: 'rains' });
  if (mo === 6 && held((p) => p.climate === 'arid').length) emit('season', 'High summer: the deserts burn, and armies caught in them wilt', { weather: 'heat', minor: true });
  if (mo === 7) emit('season', 'Harvest: the granaries of the temperate lands fill for the year', { weather: 'harvest', minor: true });
}

// ---------- the real sky: today's weather over a real city, brought by n8n, falls on the game ----------
// readings: { provinceId: { kind: 'storm' | 'rain' | 'snow' | 'heat' | 'cold', tempC, city } }. Storms and great heat
// wear down the armies there; heavy rain may flood a river province; a hard frost thins the herds.
export function realSkies(s, readings, emit) {
  for (const [pid, w] of Object.entries(readings ?? {})) {
    const P = PROV[pid], q = s.provinces[pid];
    if (!P || !q || !w?.kind) continue;
    const here = Object.values(s.armies).filter((a) => a.at === pid);
    const text = { storm: 'a storm', rain: 'heavy rain', snow: 'snow', heat: 'fierce heat', cold: 'a hard frost' }[w.kind];
    if (!text) continue;
    if (['storm', 'heat', 'cold'].includes(w.kind)) for (const a of here) a.size = round1(a.size * 0.97);
    if (w.kind === 'rain' && P.terrain === 'river') q.famine = Math.max(q.famine, 2);
    if (w.kind === 'cold' && q.owner && s.realms[q.owner]) s.realms[q.owner].horses = round1((s.realms[q.owner].horses ?? 0) * 0.96);
    emit('skies', `The real sky over ${w.city ?? P.city} today brings ${text}${Number.isFinite(w.tempC) ? ` (${Math.round(w.tempC)}°C)` : ''}${here.length ? ', and the armies camped there suffer' : ''}`, { at: pid, realms: [q.owner].filter(Boolean), weather: w.kind === 'storm' || w.kind === 'rain' ? 'rains' : w.kind === 'snow' || w.kind === 'cold' ? 'snow' : 'heat', real: true });
  }
}

// ---------- plague, famine, flood, earthquake ----------
function disasters(s, rng, emit) {
  const D = R.disasters;
  if (chance(rng, D.plague)) {
    const p = pick(rng, PROVINCES.filter((x) => onRoad(s, x.id) && s.provinces[x.id].owner));
    if (p && !s.provinces[p.id].plague) {
      s.provinces[p.id].plague = D.plagueMonths;
      emit('plague', `Plague breaks out in ${cityOf(s, p.id)}`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
    }
  }
  for (const P of PROVINCES) { // plague travels with the caravans
    if (s.provinces[P.id].plague === D.plagueMonths - 2) {
      for (const n of P.neighbors) if (!s.provinces[n].plague && chance(rng, onRoad(s, n) ? D.spread.silk : D.spread.other)) {
        s.provinces[n].plague = D.plagueMonths;
        emit('plague', `The plague spreads to ${cityOf(s, n)}`, { at: n, realms: [s.provinces[n].owner].filter(Boolean), minor: true });
      }
    }
    if (s.provinces[P.id].plague > 0) for (const a of Object.values(s.armies)) if (a.at === P.id) a.size = round1(a.size * 0.95);
  }
  if (chance(rng, D.earthquake)) {
    const p = pick(rng, PROVINCES.filter((x) => ['hills', 'mountains'].includes(x.terrain)));
    s.provinces[p.id].walls = Math.max(0, s.provinces[p.id].walls - 1);
    s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 10);
    s.provinces[p.id].prosperity = Math.max(0, (s.provinces[p.id].prosperity ?? 50) - 10);
    emit('earthquake', `An earthquake shakes ${cityOf(s, p.id)}; its walls crack`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
  }
  if (chance(rng, D.famine)) {
    const p = pick(rng, PROVINCES.filter((x) => s.provinces[x.id].owner));
    for (const id of [p.id, ...p.neighbors.filter(() => rng() < 0.5)]) s.provinces[id].famine = 6;
    emit('famine', `The harvest fails around ${cityOf(s, p.id)}: famine`, { at: p.id, realms: [s.provinces[p.id].owner].filter(Boolean) });
  }
  // In the rains, a great river may burst its banks.
  if (chance(rng, D.flood)) {
    const wet = PROVINCES.filter((x) => x.terrain === 'river' && weatherOf(x.id, s.month) === 'rains' && s.provinces[x.id].owner);
    const p = wet.length && pick(rng, wet);
    if (p) {
      s.provinces[p.id].famine = Math.max(s.provinces[p.id].famine, 3);
      s.provinces[p.id].prosperity = Math.max(0, (s.provinces[p.id].prosperity ?? 50) - 8);
      emit('flood', `The river floods around ${cityOf(s, p.id)}, drowning fields and villages`, { at: p.id, realms: [s.provinces[p.id].owner], weather: 'rains' });
    }
  }
}

// ---------- learning and inventions ----------
export const knownBy = (s, id) => s.realms[id]?.known ?? [];
function learning(s, rng, emit) {
  const L = R.learning, exist = s.inventions ?? Object.keys(INVENTIONS);
  for (const r of living(s)) {
    const mine = provincesOf(s, r.id);
    if (!mine.length) continue;
    let gain = 0;
    for (const p of mine) {
      const q = s.provinces[p.id];
      gain += (q.prosperity ?? 50) * p.wealth * L.perProsperity + (q.works?.library ? L.library : 0);
    }
    for (const k of r.known) gain *= INVENTIONS[k]?.learn ?? 1;
    if (r.golden > s.month) gain *= 1.5;
    r.learning = round1((r.learning ?? 0) + gain);
    // Learned from a neighbour, a trading partner, or worked out at home.
    const next = new Set();
    for (const p of mine) for (const n of p.neighbors) { const o = s.provinces[n].owner; if (o && o !== r.id) next.add(o); }
    for (const inv of exist) {
      if (r.known.includes(inv)) continue;
      const teachers = [...next].filter((o) => s.realms[o]?.known?.includes(inv));
      if (teachers.length && chance(rng, L.spread * (1 + teachers.length * 0.3) * (atWar(s, r.id, teachers[0]) ? 0.5 : 1))) {
        r.known.push(inv);
        emit('invention', `${INVENTIONS[inv].name} reaches ${ofR(s, r.id)} from ${ofR(s, pick(rng, teachers))}: ${INVENTIONS[inv].text.toLowerCase()}`, { realms: [r.id], invention: inv, minor: true });
        break;
      }
      if (r.learning >= INVENTIONS[inv].cost * 2.5 && chance(rng, 0.05)) {
        r.learning = round1(r.learning - INVENTIONS[inv].cost * 2);
        r.known.push(inv);
        const best = [...mine].sort((a, b) => b.wealth - a.wealth)[0];
        emit('invention', `The scholars of ${cityOf(s, best.id)} work out ${INVENTIONS[inv].name.toLowerCase()} for ${ofR(s, r.id)}: ${INVENTIONS[inv].text.toLowerCase()}`, { realms: [r.id], at: best.id, invention: inv, first: !living(s).some((o) => o.id !== r.id && o.known.includes(inv)) });
        break;
      }
    }
  }
}
// A conqueror carries off a fallen city's engineers and craftsmen, and what they know.
export function carryOff(s, realm, from, pid, rng, emit) {
  const R2 = s.realms[realm], F = s.realms[from];
  if (!R2 || !F) return;
  const new_ = F.known.filter((k) => !R2.known.includes(k));
  if (!new_.length || !chance(rng, R.learning.conquest * (R2.horde ? 2 : 1))) return;
  const inv = pick(rng, new_);
  R2.known.push(inv);
  emit('invention', `${say(s, realm, 'carries')} off the engineers and craftsmen of ${cityOf(s, pid)}, and with them ${INVENTIONS[inv].name.toLowerCase()}`, { realms: [realm, from], at: pid, invention: inv });
}

// ---------- fortune: a realm's year, read each January ----------
export function fortuneOf(s, id) {
  const r = s.realms[id], mine = provincesOf(s, id);
  if (!mine.length) return 0;
  const loyal = mine.reduce((t, p) => t + s.provinces[p.id].loyalty, 0) / mine.length;
  const wars = living(s).filter((o) => atWar(s, id, o.id)).length;
  return Math.round(0.55 * prosperityOf(s, id) + 0.3 * loyal + 1.5 * r.known.length + (r.gold > (r.lastIncome ?? 0) * 6 ? 5 : 0) - Math.min(12, wars * 4) + (r.golden > s.month ? 4 : 0));
}
function fortune(s, emit) {
  const F = R.fortune;
  for (const r of living(s)) {
    if (r.rebel || provincesOf(s, r.id).length < 2) continue;
    const f = fortuneOf(s, r.id);
    r.fortune = [...(r.fortune ?? []), f].slice(-6);
    const run = r.fortune.slice(-F.years);
    const who = steersman(s, r);
    if (run.length === F.years && run.every((x) => x >= F.golden) && !(r.golden > s.month) && s.month - (r.goldenSaid ?? -999) > 240) {
      r.golden = s.month + F.goldenYears * 12;
      r.goldenSaid = s.month;
      emit('golden', `A golden age for ${ofR(s, r.id)}${who ? ` under ${fullName(who)}` : ''}: full granaries, busy markets, poets and builders at court`, { realms: [r.id], chars: who ? [who.id] : [], at: r.capital });
    } else if (run.length === F.years && run.every((x) => x <= F.decline) && (r.fortune[0] ?? 0) >= F.decline + 10 && s.month - (r.declineSaid ?? -999) > 180) {
      r.declineSaid = s.month;
      emit('decline', `${ofR(s, r.id).replace(/^./, (c) => c.toUpperCase())} ${vb(s, r.id, 'is')} in decline: empty fields, empty coffers, and the people murmur`, { realms: [r.id], at: r.capital });
    }
    if (prosperityOf(s, r.id) < R.prosperity.poorBelow && s.month - (r.poorSaid ?? -999) > 120) {
      r.poorSaid = s.month;
      emit('poverty', `Poverty grips ${ofR(s, r.id)}: villages stand empty and beggars fill the towns`, { realms: [r.id], at: r.capital });
    }
  }
}
export { prosperityOf };
