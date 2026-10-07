// The people: how loyal each province is, and what happens when they are not. Provinces revolt; distant governors
// break away; barons force a charter on a bad king; a capital rises; rich cities make themselves communes.
import { RULES as R } from './rules.js';
import { PROVINCES, PROV, provincesOf, living, atWar, key, setOwner, hops, clamp, round1, between, chance, pick, newChar, newArmy, newRealm,
  short, ofR, say, vb, his, fullName, cityOf, placeOf, ageOf, usedNames, yearOf } from './core.js';
import { wealthOf, rulerTemper, rulingTemper, prosperityOf } from './economy.js';
import { declareWar, fall } from './war.js';
import { cultureOf, personName, titleFor, kingdomName, pickTemper } from './names.js';

export function people(s, rng, emit) {
  const L = R.loyalty, near = {};
  for (const r of living(s)) near[r.id] = hops(r.capital);
  const armiesAt = {};
  for (const a of Object.values(s.armies)) (armiesAt[a.at] ??= []).push(a);
  for (const P of PROVINCES) {
    const p = s.provinces[P.id], owner = p.owner, r = s.realms[owner];
    p.conquered = round1(p.conquered * L.conqueredDecay);
    for (const k of ['ravaged', 'plague', 'famine']) if (p[k] > 0) p[k]--;
    if (!r) continue;
    const d = near[owner]?.[P.id] ?? 6;
    let target = L.base + (r.capital === P.id ? L.capital : 0) + L.perHop * Math.max(0, d - L.freeHops) + p.conquered + (L.tax[r.tax] ?? 0);
    if (Object.keys(s.wars).some((k) => k.split('|').includes(owner))) target += L.war;
    const here = armiesAt[P.id] ?? [];
    if (here.some((a) => a.realm !== owner && atWar(s, a.realm, owner))) target += L.enemyArmy;
    if (here.some((a) => a.realm === owner)) target += L.ownArmy;
    if (p.ravaged > 0) target += L.ravaged;
    if (p.plague > 0) target += L.plague;
    if (p.famine > 0) target += L.famine;
    if ((p.prosperity ?? 50) < R.prosperity.poorBelow) target += L.poor;
    target += rulerTemper(s, r, 'loyalty') ?? 0;
    if (r.reforms?.includes('law')) target += 4;
    if (r.charter > s.month) target += 6;
    if (r.golden > s.month) target += 5;
    if (r.rebel) target += 15; // a cause is popular where it began
    p.loyalty = round1(clamp(p.loyalty + (target - p.loyalty) * L.drift + between(rng, [-2, 2]), 0, 100));
    const fear = r.horde ? 0.15 : rulerTemper(s, r, 'fear') ?? 1; // few dare rise against the horde, or a tyrant
    if (p.loyalty < L.revoltBelow && r.capital !== P.id && !p.siege && chance(rng, (L.revoltBelow - p.loyalty) * L.revoltChance * fear)) revolt(s, P.id, rng, emit);
  }
  for (const r of living(s)) unrest(s, r, rng, emit, near[r.id]);
}

function revolt(s, pid, rng, emit) {
  const p = s.provinces[pid], old = p.owner;
  s.record.revolts++;
  // Join a rebellion already burning next door against the same master, or start a new one.
  const cause = PROV[pid].neighbors.map((n) => s.realms[s.provinces[n].owner]).find((r) => r && r.rebel && r.cause === old && !r.fallen);
  let id = cause?.id;
  if (!id) {
    const culture = cultureOf(pid, s);
    const leader = newChar(s, { name: personName(rng, culture, usedNames(s)), title: 'Rebel leader', role: 'rebel', realm: null, born: yearOf(s.month, s) - 22 - Math.floor(rng() * 25), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 3), invented: true, culture });
    id = newRealm(s, rng, { name: `Rising of ${placeOf(s, pid)}`, short: `${placeOf(s, pid)} rebels`, capital: pid, ruler: leader, origin: 'rebel', rebel: true, cause: old });
    s.chars[leader].title = 'Rebel leader';
    declareWar(s, id, old, () => {}, { cause: 'rising' });
  }
  setOwner(s, pid, id, 'revolt');
  p.loyalty = 60;
  p.conquered = 0;
  p.building = null;
  const leader = s.realms[id].ruler;
  newArmy(s, id, leader && !s.chars[leader].army ? leader : null, pid, round1(1 + wealthOf(s, pid) * 0.9));
  emit('revolt', `${placeOf(s, pid)} rises against ${ofR(s, old)}${cause ? `, joining the ${cause.short}` : `, led by ${s.chars[leader].name}`}`, { realms: [id, old], at: pid, chars: [leader], war: s.wars[key(id, old)]?.conflict });
  if (s.realms[old] && !provincesOf(s, old).length) fall(s, old, emit, `${s.realms[old].name} ${vb(s, old, 'is')} no more: its last province has risen`, id);
}

// Realm-wide troubles, from the edges and from the top.
function unrest(s, r, rng, emit, dist) {
  const U = R.unrest, mine = provincesOf(s, r.id), ruler = s.chars[r.ruler];
  if (!mine.length || r.rebel || !ruler?.alive) return;
  const avg = mine.reduce((t, p) => t + s.provinces[p.id].loyalty, 0) / mine.length;
  // A governor far from the capital keeps the taxes and the province for himself.
  if (mine.length >= 8 && !r.nomad) {
    const far = mine.filter((p) => (dist?.[p.id] ?? 0) >= U.separatistHops && s.provinces[p.id].loyalty < 38 && !s.provinces[p.id].siege && p.id !== r.capital);
    const seat = far.length && pick(rng, far);
    if (seat && chance(rng, U.separatist * (38 - s.provinces[seat.id].loyalty))) return separatist(s, r, seat.id, rng, emit, dist);
  }
  // Barons force a charter on a bad king: no heavy taxes for ten years.
  if (!r.nomad && !r.elective && mine.length >= 5 && !(r.charter > s.month) && avg < 42 && ['tyrant', 'negligent', 'hedonist', 'miser', 'paranoid'].includes(rulingTemper(s, r)) && chance(rng, U.charter)) {
    r.charter = s.month + 120;
    for (const p of mine) s.provinces[p.id].loyalty = clamp(s.provinces[p.id].loyalty + 12, 0, 100);
    emit('charter', `The great lords of ${ofR(s, r.id)} force ${fullName(ruler)} to seal a charter: no heavy taxes without their consent`, { realms: [r.id], chars: [ruler.id], at: r.capital });
    return;
  }
  // The capital itself rises: the ruler is cast down, and a lord of the city takes the throne.
  const cap = s.provinces[r.capital];
  if (cap.owner === r.id && cap.loyalty < 25 && !cap.siege && chance(rng, U.uprising)) {
    const culture = cultureOf(r.capital, s);
    const lord = newChar(s, { name: personName(rng, culture, usedNames(s)), role: 'ruler', realm: r.id, born: yearOf(s.month, s) - 30 - Math.floor(rng() * 20), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 3), invented: true, culture });
    Object.assign(ruler, { alive: false, died: s.month, cause: 'overthrown' });
    r.lineage = [...(r.lineage ?? []), { name: ruler.name, epithet: ruler.epithet, title: ruler.title, since: ruler.since, until: yearOf(s.month, s), cause: 'overthrown', id: ruler.id }].slice(-30);
    Object.assign(s.chars[lord], { title: ruler.title, since: yearOf(s.month, s), family: `House of ${s.chars[lord].name}`, landAtStart: mine.length });
    Object.assign(r, { ruler: lord, heir: null, regent: null, plan: null, power: null, dynasty: `House of ${s.chars[lord].name}` });
    for (const p of mine) s.provinces[p.id].loyalty = clamp(s.provinces[p.id].loyalty + 15, 0, 100);
    emit('uprising', `${cityOf(s, r.capital)} rises against ${fullName(ruler)}: the crowd storms the palace, and ${s.chars[lord].name} takes the throne of ${ofR(s, r.id)}`, { realms: [r.id], chars: [lord, ruler.id], at: r.capital });
    return;
  }
  // A rich, restless city governs itself.
  if (mine.length >= 4) {
    const rich = mine.filter((p) => p.wealth >= 5 && p.id !== r.capital && s.provinces[p.id].loyalty < 45 && (s.provinces[p.id].prosperity ?? 50) >= 55 && !s.provinces[p.id].siege);
    const c = rich.length && pick(rng, rich);
    if (c && chance(rng, U.commune)) return commune(s, r, c.id, rng, emit);
  }
}

function separatist(s, r, pid, rng, emit, dist) {
  const culture = cultureOf(pid, s);
  const gov = newChar(s, { name: personName(rng, culture, usedNames(s)), role: 'ruler', realm: null, born: yearOf(s.month, s) - 30 - Math.floor(rng() * 20), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 3), invented: true, culture });
  const nid = newRealm(s, rng, { name: kingdomName(culture, placeOf(s, pid)), short: placeOf(s, pid), capital: pid, ruler: gov, origin: 'separatist' });
  s.chars[gov].title = titleFor(culture);
  const with_ = PROV[pid].neighbors.filter((n) => s.provinces[n].owner === r.id && n !== r.capital && (dist?.[n] ?? 0) >= R.unrest.separatistHops - 1 && s.provinces[n].loyalty < 50).slice(0, 2);
  for (const p of [pid, ...with_]) { setOwner(s, p, nid, 'secession'); Object.assign(s.provinces[p], { loyalty: 55, conquered: 0, siege: null }); }
  newArmy(s, nid, gov, pid, round1(2 + wealthOf(s, pid)));
  declareWar(s, nid, r.id, () => {}, { cause: 'independence' });
  s.record.founded++;
  emit('separatist', `${s.chars[gov].name}, governor of ${placeOf(s, pid)}, refuses ${ofR(s, r.id)} ${his(s.chars[gov])} taxes and proclaims the ${s.realms[nid].name}`, { realms: [nid, r.id], at: pid, chars: [gov], war: s.wars[key(nid, r.id)]?.conflict });
}

function commune(s, r, pid, rng, emit) {
  const culture = cultureOf(pid, s);
  const consul = newChar(s, { name: personName(rng, culture, usedNames(s)), role: 'ruler', realm: null, born: yearOf(s.month, s) - 40 - Math.floor(rng() * 15), temper: pick(rng, ['diplomat', 'builder', 'miser']), skill: 3, invented: true, culture });
  const nid = newRealm(s, rng, { name: `Commune of ${cityOf(s, pid)}`, short: cityOf(s, pid), capital: pid, ruler: consul, origin: 'commune', elective: true });
  Object.assign(s.chars[consul], { title: culture === 'latin' ? 'Podestà' : 'Consul' });
  setOwner(s, pid, nid, 'commune');
  Object.assign(s.provinces[pid], { loyalty: 70, conquered: 0 });
  s.realms[nid].gold = round1(wealthOf(s, pid) * 8);
  newArmy(s, nid, consul, pid, round1(2 + wealthOf(s, pid) * 0.8));
  s.record.founded++;
  emit('commune', `The merchants of ${cityOf(s, pid)} throw off ${ofR(s, r.id)} and govern themselves: the Commune of ${cityOf(s, pid)} elects ${s.chars[consul].name} its ${s.chars[consul].title}`, { realms: [nid, r.id], at: pid, chars: [consul] });
  if (chance(rng, 0.6)) declareWar(s, nid, r.id, emit, { cause: 'independence', text: `${say(s, r.id, 'marches')} to bring ${cityOf(s, pid)} to heel` });
}
export { prosperityOf };
