// The people of the world: births, marriages and deaths; heirs and regents; consorts, viziers and generals with
// their temperaments; plots, purges, betrayals, coups and reforms; and the epithets history gives them.
// A character's big choices (to betray, to rebel, to accept a match) are asked as decisions and answered next month by
// whoever speaks for them: a player, the AI, or doctrine.
import { RULES as R } from './rules.js';
import { PROV, baseWealth, word, provincesOf, armiesOf, armiesChanged, living, atWar, allied, friendly, key, setOwner, hops, clamp, round1, chance, pick, rngFor, newChar, newArmy, newRealm, colorFor,
  short, ofR, say, vb, poss, his, him, nameOf, fullName, cityOf, placeOf, ageOf, usedNames, yearOf, menText } from './core.js';
import { strength, incomeOf } from './economy.js';
import { declareWar, disband, fall } from './war.js';
import { cultureOf, personName, womanName, titleFor, kingdomName, consortTitle, vizierTitle, pickTemper } from './names.js';

const TEMPER = (s, id, role) => R.temper[role]?.[s.chars[id]?.temper] ?? {};
const adult = (s, c) => ageOf(s, c) >= R.family.adult;
const QUEENS_REIGN = new Set(['georgian', 'greek', 'latin', 'armenian', 'nubian']); // where a daughter may inherit

// ---------- decisions: asked now, answered next month ----------
export function ask(s, d) {
  if (s.pending.some((x) => x.kind === d.kind && x.char === d.char)) return;
  s.pending.push({ id: `d${s.nextId++}`, m: s.month, ...d });
}
export function settleDecisions(s, inputs, brain, rng, emit) {
  const due = s.pending;
  s.pending = [];
  for (const d of due) {
    const c = s.chars[d.char];
    if (!c?.alive || (d.realm && s.realms[d.realm]?.fallen)) continue;
    const given = inputs?.answers?.[d.id];
    const choice = d.options.includes(given?.choice ?? given) ? given?.choice ?? given : brain.decide(s, d, rng);
    if (given?.say) d.said = String(given.say).slice(0, 200);
    answer(s, d, choice, rng, emit);
  }
}
function answer(s, d, choice, rng, emit) {
  const c = s.chars[d.char], r = s.realms[d.realm];
  if (d.kind === 'betray' || d.kind === 'pretender') {
    if (!r || r.fallen || c.realm !== r.id) return;
    if (choice === 'seize') return coup(s, r, c, emit, d.said);
    if (choice === 'break') return split(s, r.id, c.id, rng, emit, d.kind === 'pretender' ? 'refuses the new crown' : 'rebels against his master', d.said);
    c.loyalty = clamp(c.loyalty + 10, 0, 100);
  } else if (d.kind === 'match') {
    const from = s.realms[d.from], bride = s.chars[d.bride], groom = s.chars[d.groom];
    if (!from || from.fallen || !bride?.alive || !groom?.alive || bride.spouse || groom.spouse) return;
    if (choice !== 'accept') return emit('match.refused', `${fullName(c)} of ${ofR(s, c.realm)} turns down a match with ${ofR(s, d.from)}`, { realms: [c.realm, d.from], chars: [c.id] });
    marry(s, groom.id, bride.id, emit, d.said);
  } else if (d.kind === 'peace' || d.kind === 'verdict') {
    s.answers.push({ ...d, choice }); // acts.js applies them, where treaties live
  }
}

// ---------- the start of an age: give everyone a temperament, a consort, a vizier ----------
export function setupCourt(s, rng, data) {
  for (const r of living(s)) {
    const d = data[r.id] ?? {}, ruler = s.chars[r.ruler];
    if (ruler && d.ruler?.temper) ruler.temper = d.ruler.temper;
    if (ruler && !ruler.spouse && adult(s, ruler) && !r.elective && rng() < 0.85) {
      const sp = d.consort ?? { name: ruler.female ? personName(rng, r.culture, usedNames(s)) : womanName(rng, r.culture, usedNames(s)), born: ruler.born + (ruler.female ? -3 : 6) + Math.floor(rng() * 6), invented: true };
      const id = newChar(s, { ...sp, role: 'consort', realm: r.id, female: !ruler.female, title: sp.title ?? consortTitle(r.culture, !ruler.female), temper: sp.temper ?? pickTemper(rng, R.temper.consort), culture: r.culture, family: sp.family ?? null });
      wed(s, ruler.id, id);
      const heir = s.chars[r.heir];
      if (heir && ['son', 'daughter'].includes(heir.relation)) { heir.parentId = ruler.id; ruler.kids.push(heir.id); }
    }
    if (!r.nomad && !r.elective && provincesOf(s, r.id).length >= 4 && !r.vizier) appointVizier(s, r, rng, d.vizier);
  }
}
function wed(s, a, b) {
  s.chars[a].spouse = b;
  s.chars[b].spouse = a;
}
export function appointVizier(s, r, rng, given) {
  const v = newChar(s, { name: given?.name ?? personName(rng, r.culture, usedNames(s)), title: given?.title ?? vizierTitle(r.culture), role: 'vizier', realm: r.id, born: given?.born ?? yearOf(s.month, s) - 35 - Math.floor(rng() * 20),
    temper: given?.temper ?? pickTemper(rng, R.temper.vizier), skill: 2 + Math.floor(rng() * 3), invented: !given, culture: r.culture });
  r.vizier = v;
  return v;
}

// ---------- each month ----------
export function court(s, rng, emit) {
  lives(s, rng, emit);
  marriages(s, rng, emit);
  intrigue(s, rng, emit);
  betrayals(s, rng, emit);
  plots(s, rng, emit);
  if (s.month % 12 === 0) { for (const c of Object.values(s.chars)) if (c.alive && ['ruler', 'general'].includes(c.role)) earnEpithet(s, c, emit); prune(s); }
}

function lives(s, rng, emit) {
  for (const c of Object.values(s.chars)) {
    if (!c.alive || c.spared > s.month) continue; // history keeps some alive until their hour
    const age = ageOf(s, c);
    const p = (R.life.bands.find(([upTo]) => age < upTo)?.[1] ?? 0.02) * (c.traits.includes('ailing') ? R.life.ailing : 1);
    if (chance(rng, p)) die(s, c.id, 'age', emit, rng);
  }
  for (const r of living(s)) {
    const ruler = s.chars[r.ruler];
    // Children: to a ruler (or heir) and consort while she can bear them.
    for (const parent of [ruler]) {
      if (!parent?.alive || !parent.spouse) continue;
      const sp = s.chars[parent.spouse], mother = parent.female ? parent : sp;
      if (!sp?.alive || ageOf(s, mother) < R.family.adult || ageOf(s, mother) > R.family.fertileUntil || parent.kids.length >= 4 || !chance(rng, R.family.birth)) continue;
      const female = rng() < 0.5;
      const kid = newChar(s, { name: female ? womanName(rng, r.culture, usedNames(s)) : personName(rng, r.culture, usedNames(s)), role: 'child', realm: r.id, born: yearOf(s.month, s), female, family: r.dynasty,
        parent: parent.name, parentId: parent.id, relation: female ? 'daughter' : 'son', temper: null, skill: 1 + Math.floor(rng() * 4), invented: true, culture: r.culture });
      parent.kids.push(kid);
      sp.kids.push(kid);
      const heir = s.chars[r.heir];
      const blood = (h) => h && h.parentId === ruler?.id && ['son', 'daughter'].includes(h.relation);
      const better = !heir || !blood(heir) || (heir.female && !female), eligible = !female || QUEENS_REIGN.has(r.culture);
      if (parent === ruler && !r.elective && better && eligible) {
        if (heir) heir.role = heir.relation === 'son' || heir.relation === 'daughter' ? 'child' : 'courtier';
        r.heir = kid;
        s.chars[kid].role = 'heir';
        emit('birth', `A ${female ? 'daughter' : 'son'} is born to ${fullName(ruler)} of ${ofR(s, r.id)}: ${s.chars[kid].name}, heir to the throne`, { realms: [r.id], chars: [ruler.id, kid] });
      }
    }
    // Coming of age: a regency ends.
    if (r.regent && ruler && ageOf(s, ruler) >= R.family.adult) {
      const reg = s.chars[r.regent];
      r.regent = null;
      emit('regency', `${ruler.name} of ${ofR(s, r.id)} comes of age and takes the reins from ${reg?.alive ? reg.name : 'the regency council'}`, { realms: [r.id], chars: [ruler.id] });
    }
    if (r.regent && !s.chars[r.regent]?.alive) r.regent = null;
    // A ruler with neither heir nor children names one.
    if (!r.heir && !r.rebel && !r.elective && s.month % 12 === 0 && ruler && chance(rng, R.life.heirEachYear)) {
      const kids = (ruler.kids ?? []).map((k) => s.chars[k]).filter((k) => k?.alive && k.role !== 'exile');
      const son = kids.filter((k) => !k.female).sort((a, b) => a.born - b.born)[0] ?? (QUEENS_REIGN.has(r.culture) ? kids.sort((a, b) => a.born - b.born)[0] : null);
      if (son) {
        son.role = 'heir';
        r.heir = son.id;
      } else if (!kids.length || ageOf(s, ruler) > 50) {
        const old = ageOf(s, ruler) > 58, relation = old && rng() < 0.5 ? pick(rng, ['brother', 'nephew', 'cousin']) : 'nephew';
        r.heir = newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'heir', realm: r.id, born: relation === 'brother' ? ruler.born + 4 : Math.max(ruler.born + 18, yearOf(s.month, s) - 24),
          temper: pickTemper(rng, R.temper.ruler), skill: 1 + Math.floor(rng() * 4), family: r.dynasty, relation, parent: ruler.name, invented: true, culture: r.culture });
      }
      if (r.heir) emit('heir', `${nameOf(s, r.ruler)} of ${ofR(s, r.id)} names ${s.chars[r.heir].name} heir`, { realms: [r.id], chars: [r.ruler, r.heir] });
    }
    if (!r.nomad && !r.elective && !r.rebel && provincesOf(s, r.id).length >= 4 && !s.chars[r.vizier]?.alive) {
      const v = appointVizier(s, r, rng);
      emit('vizier', `${nameOf(s, r.ruler)} of ${ofR(s, r.id)} makes ${s.chars[v].name} ${s.chars[v].title}`, { realms: [r.id], chars: [v] });
    }
  }
}

// Each January, unmarried rulers and heirs look for a match: often across a border, which makes an alliance.
function marriages(s, rng, emit) {
  if (s.month % 12 !== 0) return;
  for (const r of living(s)) {
    if (r.rebel || r.elective) continue;
    for (const who of [s.chars[r.ruler], s.chars[r.heir]]) {
      if (!who?.alive || who.spouse || ageOf(s, who) < R.family.adult || ageOf(s, who) > 55 || !chance(rng, R.family.marryEachYear)) continue;
      const diplomat = (s.chars[r.ruler]?.temper === 'diplomat') ? 1.5 : 1;
      const near = new Set();
      for (const p of provincesOf(s, r.id)) for (const n of p.neighbors) { const o = s.provinces[n].owner; if (o && o !== r.id) near.add(o); }
      for (const k of Object.keys(s.allies)) if (k.split('|').includes(r.id)) near.add(k.split('|').find((x) => x !== r.id));
      const houses = [...near].map((id) => s.realms[id]).filter((o) => o && !o.fallen && !o.rebel && !o.elective && !atWar(s, r.id, o.id) && s.chars[o.ruler]?.alive);
      if (houses.length && chance(rng, R.family.foreign * diplomat)) {
        const o = pick(rng, houses), kin = s.chars[o.ruler];
        // A daughter or sister of that house, of age; or one the chronicles have not named yet.
        let match = (kin.kids ?? []).map((k) => s.chars[k]).find((k) => k?.alive && !k.spouse && k.female !== who.female && ageOf(s, k) >= 14 && ageOf(s, k) <= 32 && k.role !== 'heir');
        if (!match) match = s.chars[newChar(s, { name: who.female ? personName(rng, o.culture, usedNames(s)) : womanName(rng, o.culture, usedNames(s)), role: 'child', realm: o.id, female: !who.female, born: yearOf(s.month, s) - 16 - Math.floor(rng() * 8),
          family: o.dynasty, relation: who.female ? 'brother' : 'sister', parent: kin.parent ?? kin.name, invented: true, culture: o.culture })];
        ask(s, { kind: 'match', char: kin.id, realm: o.id, from: r.id, bride: who.female ? who.id : match.id, groom: who.female ? match.id : who.id, options: ['accept', 'refuse'],
          question: `${fullName(who)} of ${ofR(s, r.id)} asks for the hand of ${match.name}. Accept the match?` });
      } else {
        const sp = newChar(s, { name: who.female ? personName(rng, r.culture, usedNames(s)) : womanName(rng, r.culture, usedNames(s)), role: 'consort', realm: r.id, female: !who.female, born: yearOf(s.month, s) - 16 - Math.floor(rng() * 6),
          title: who.role === 'ruler' ? consortTitle(r.culture, !who.female) : null, temper: pickTemper(rng, R.temper.consort), invented: true, culture: r.culture });
        wed(s, who.id, sp);
        emit('marriage', `${fullName(who)} of ${ofR(s, r.id)} marries ${s.chars[sp].name}, of a noble house of ${placeOf(s, r.capital)}`, { realms: [r.id], chars: [who.id, sp], minor: true });
      }
    }
  }
}

export function marry(s, groomId, brideId, emit, said) {
  const g = s.chars[groomId], b = s.chars[brideId], home = g.role === 'ruler' || g.role === 'heir' ? g : b, away = home === g ? b : g;
  const ra = home.realm, rb = away.realm;
  wed(s, groomId, brideId);
  Object.assign(away, { realm: ra, role: 'consort', title: home.role === 'ruler' ? consortTitle(s.realms[ra].culture, away.female) : null, temper: away.temper ?? pickTemper(rngFor('age', s.age, 'temper', away.id), R.temper.consort) });
  s.kin[key(ra, rb)] = s.month;
  if (!allied(s, ra, rb) && !atWar(s, ra, rb)) s.allies[key(ra, rb)] = { since: s.month, marriage: true };
  const tid = `t${s.nextId++}`;
  s.treaties[tid] = { id: tid, kind: 'marriage', name: `Marriage of ${g.name} and ${b.name}`, parties: [ra, rb], signed: s.month, until: null, ended: null, broken: null, pay: null, text: `alliance by marriage`, sealed: null, spouses: [groomId, brideId] };
  emit('marriage', `${fullName(home)} of ${ofR(s, ra)} weds ${away.name} of ${ofR(s, rb)}: the two houses are allied`, { realms: [ra, rb], chars: [home.id, away.id], treaty: tid, said });
}

// ---------- death and succession ----------
export function die(s, id, cause, emit, rng, how) {
  const c = s.chars[id];
  if (!c?.alive) return;
  Object.assign(c, { alive: false, died: s.month, cause });
  if (c.army && s.armies[c.army]) s.armies[c.army].general = null;
  if (c.spouse && s.chars[c.spouse]) s.chars[c.spouse].widowed = s.month;
  for (const t of Object.values(s.treaties)) if (t.kind === 'marriage' && t.ended === null && t.spouses?.includes(id)) t.ended = s.month;
  earnEpithet(s, c, null);
  const r = s.realms[c.realm];
  const age = ageOf(s, c);
  const who = fullName(c);
  const text = how ? `${who} of ${ofR(s, c.realm)} ${how}` : cause === 'age' ? `${who} of ${ofR(s, c.realm)} dies, aged ${age}` : `${who} of ${ofR(s, c.realm)} is killed`;
  if (r && !r.fallen && r.ruler === id) {
    emit('death', text, { realms: [r.id], chars: [id], ruler: true, cause });
    succession(s, r.id, rng, emit);
  } else {
    if (r?.heir === id) r.heir = null;
    if (r?.vizier === id) r.vizier = null;
    if (r?.regent === id) r.regent = null;
    if (['ruler', 'heir', 'general', 'consort', 'vizier'].includes(c.role) || cause !== 'age') emit('death', text, { realms: [c.realm].filter(Boolean), chars: [id], cause, minor: c.role === 'child' || c.role === 'consort' });
  }
}

// The reign that just ended, written into the realm's lineage.
function endReign(s, r, cause) {
  const c = s.chars[r.ruler];
  if (!c) return;
  r.lineage = [...(r.lineage ?? []), { name: c.name, epithet: c.epithet, title: c.title, since: c.since ?? yearOf(s.month, s), until: yearOf(s.month, s), cause: cause ?? c.cause ?? null, id: c.id }].slice(-30);
}

function crown(s, r, h, emit, how = 'becomes') {
  const title = titled(s.chars[r.ruler]?.title ?? titleFor(r.culture), h);
  Object.assign(h, { role: 'ruler', title, realm: r.id, since: yearOf(s.month, s), landAtStart: provincesOf(s, r.id).length });
  if (!h.temper || !R.temper.ruler[h.temper]) h.temper = pickTemper(rngFor('age', s.age, 'temper', h.id), R.temper.ruler);
  const widow = s.chars[r.ruler]?.spouse ? s.chars[s.chars[r.ruler].spouse] : null;
  if (widow?.alive && widow.id !== h.spouse && widow.role === 'consort') widow.title = widow.female ? 'Queen mother' : 'Prince';
  Object.assign(r, { ruler: h.id, heir: null, power: null, plan: null });
  // A child on the throne: the queen mother, the vizier or the first general rules for him.
  if (ageOf(s, h) < R.family.adult) {
    const mother = s.chars[h.parentId]?.spouse ? s.chars[s.chars[h.parentId].spouse] : null;
    const regent = [mother, s.chars[r.vizier], ...Object.values(s.chars).filter((c) => c.alive && c.realm === r.id && c.role === 'general').sort((a, b) => b.skill - a.skill)].find((c) => c?.alive && adult(s, c));
    if (regent) {
      r.regent = regent.id;
      if (!regent.temper || !R.temper.ruler[regent.temper]) regent.ruleAs = pickTemper(rngFor('age', s.age, 'regent', regent.id), R.temper.ruler);
      emit('regency', `${h.name}, aged ${ageOf(s, h)}, ${how} ${title} of ${ofR(s, r.id)}; ${regent.name} rules as regent`, { realms: [r.id], chars: [h.id, regent.id] });
      return title;
    }
  }
  return title;
}
const titled = (title, c) => ({ Queen: c.female ? 'Queen' : 'King', King: c.female ? 'Queen' : 'King', Emperor: c.female ? 'Empress' : 'Emperor', Empress: c.female ? 'Empress' : 'Emperor' })[title] ?? title;

function succession(s, id, rng, emit) {
  const r = s.realms[id], provs = provincesOf(s, id);
  const dead = s.chars[r.ruler];
  endReign(s, r);
  if (r.elective) { // a pope, a doge, a podestà: chosen, not born
    const chosen = newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'heir', realm: id, born: yearOf(s.month, s) - 45 - Math.floor(rng() * 25), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 2), relation: 'elected', family: r.dynasty, invented: true, culture: r.culture });
    const title = dead?.title ?? 'Lord';
    Object.assign(s.chars[chosen], { role: 'ruler', title, since: yearOf(s.month, s), landAtStart: provs.length });
    Object.assign(r, { ruler: chosen, heir: null, power: null, plan: null });
    emit('crowned', `${s.chars[chosen].name} is chosen ${title} of ${ofR(s, id)}`, { realms: [id], chars: [chosen] });
    return;
  }
  let heir = r.heir && s.chars[r.heir]?.alive ? r.heir : null;
  if (!heir) { // the eldest living child, then kin abroad, then the best general
    const kids = (dead?.kids ?? []).map((k) => s.chars[k]).filter((k) => k?.alive && k.realm === id);
    heir = (kids.filter((k) => !k.female).sort((a, b) => a.born - b.born)[0] ?? (QUEENS_REIGN.has(r.culture) ? kids.sort((a, b) => a.born - b.born)[0] : null))?.id ?? null;
  }
  const generals = Object.values(s.chars).filter((c) => c.alive && c.realm === id && c.role === 'general').sort((a, b) => b.skill - a.skill);
  if (!heir) {
    // A line dies out: a kinsman abroad may claim the crown, and two realms become one.
    const borders = new Set(provs.flatMap((p) => p.neighbors).map((n) => s.provinces[n].owner));
    const kin = Object.keys(s.kin).filter((k) => k.split('|').includes(id)).map((k) => s.realms[k.split('|').find((x) => x !== id)])
      .find((o) => o && !o.fallen && !o.nomad && !atWar(s, o.id, id) && borders.has(o.id) && s.month - (o.unitedAt ?? -999) > 360);
    if (kin && provs.length && provs.length <= provincesOf(s, kin.id).length * 1.5 && chance(rng, 0.15)) return union(s, r, kin, emit);
    heir = generals[0]?.id ?? newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'heir', realm: id, born: yearOf(s.month, s) - 20 - Math.floor(rng() * 20), temper: pickTemper(rng, R.temper.ruler), skill: 2 + Math.floor(rng() * 3), invented: true, culture: r.culture });
  }
  const h = s.chars[heir];
  const weak = ageOf(s, h) < 16 || ['negligent', 'hedonist'].includes(h.temper);
  if (h.family !== r.dynasty && !['son', 'daughter', 'brother', 'nephew', 'cousin', 'sister'].includes(h.relation)) { // no blood heir: a general takes the crown and founds a house
    r.dynasty = `House of ${h.name}`;
    h.family = r.dynasty;
  }
  const title = crown(s, r, h, emit);
  if (!r.regent) emit('crowned', `${h.name} becomes ${title} of ${ofR(s, id)}${weak ? ', but the court whispers' : ''}`, { realms: [id], chars: [heir] });
  if (provs.length < 4) return;
  const S = R.succession, p = r.rebel ? 0 : S.crisis + S.perProvince * provs.length + (weak ? S.weakHeir : 0);
  const pretenders = generals.filter((g) => g.id !== heir && g.army && s.armies[g.army] && TEMPER(s, g.id, 'general').betray !== 0 && (['treacherous', 'mercenary', 'glory'].includes(g.temper) || g.loyalty < 55 || chance(rng, 0.4)));
  for (const g of pretenders.slice(0, provs.length > 14 ? 2 : 1)) {
    if (chance(rng, p)) ask(s, { kind: 'pretender', char: g.id, realm: id, options: ['bow', 'break', 'seize'], question: `${h.name} is crowned ${title} of ${ofR(s, id)}. ${g.name} commands ${menText(s.armies[g.army].size)} men. Bow to the new ruler, break away with the provinces around the army, or seize the throne?` });
  }
}

// Two crowns on one head: the realm passes whole to the kin realm.
function union(s, r, kin, emit) {
  const king = s.chars[kin.ruler];
  for (const p of [...provincesOf(s, r.id)]) setOwner(s, p.id, kin.id, 'inheritance');
  for (const a of [...armiesOf(s, r.id)]) a.realm = kin.id;
  armiesChanged(s);
  for (const c of Object.values(s.chars)) if (c.alive && c.realm === r.id) c.realm = kin.id;
  kin.gold = round1(kin.gold + r.gold);
  kin.unitedAt = s.month;
  fall(s, r.id, emit, `The line of ${ofR(s, r.id)} dies out: by marriage the crown passes to ${fullName(king)} of ${ofR(s, kin.id)}, and the two realms are joined`, kin.id);
  s.record.unions = (s.record.unions ?? 0) + 1;
}

// A great man takes the provinces around his army and makes them a kingdom of his own.
export function split(s, id, gid, rng, emit, why = 'breaks away', said) {
  const r = s.realms[id], g = s.chars[gid], a = s.armies[g?.army];
  if (!a || s.provinces[a.at].owner !== id) return;
  const mine = provincesOf(s, id), want = Math.max(1, Math.round(mine.length * R.succession.splitShare * (0.6 + rng() * 0.6)));
  const d = hops(a.at), taken = mine.filter((p) => p.id !== r.capital).sort((x, y) => d[x.id] - d[y.id]).slice(0, want);
  if (!taken.length) return;
  const seat = taken[0].id, culture = cultureOf(seat, s);
  if (a.battle) return;
  const nid = newRealm(s, rng, { name: kingdomName(culture, placeOf(s, seat)), short: placeOf(s, seat), capital: seat, ruler: gid, origin: 'split', color: colorFor(rng), from: id });
  Object.assign(g, { title: titleFor(culture), temper: R.temper.ruler[g.temper] ? g.temper : 'conqueror', landAtStart: taken.length });
  for (const p of taken) { setOwner(s, p.id, nid, 'secession'); Object.assign(s.provinces[p.id], { loyalty: Math.max(40, s.provinces[p.id].loyalty), siege: null }); }
  a.realm = nid;
  armiesChanged(s);
  s.realms[nid].gold = round1(r.gold * 0.3);
  r.gold = round1(r.gold * 0.7);
  declareWar(s, nid, id, () => {}, { cause: 'split' });
  s.record.splits++;
  s.record.founded++;
  emit('split', `${g.name} ${why} and founds the ${s.realms[nid].name}: ${taken.length} provinces of ${ofR(s, id)} go with ${him(g)}`, { realms: [nid, id], at: seat, chars: [gid], war: s.wars[key(nid, id)]?.conflict, said });
}

function coup(s, r, c, emit, said) {
  const old = s.chars[r.ruler];
  emit('coup', `${c.name} seizes the throne of ${ofR(s, r.id)}${old ? `, overthrowing ${old.name}` : ''}`, { realms: [r.id], chars: [c.id, old?.id].filter(Boolean), said });
  if (old) Object.assign(old, { alive: false, died: s.month, cause: 'overthrown' });
  endReign(s, r, 'overthrown');
  if (r.heir && s.chars[r.heir]) s.chars[r.heir].role = 'exile';
  Object.assign(c, { role: 'ruler', title: old?.title ?? titleFor(r.culture), since: yearOf(s.month, s), family: `House of ${c.name}`, landAtStart: provincesOf(s, r.id).length });
  if (!R.temper.ruler[c.temper]) c.temper = c.temper === 'kingmaker' ? 'tyrant' : 'conqueror';
  Object.assign(r, { ruler: c.id, heir: null, plan: null, power: null, regent: null, dynasty: `House of ${c.name}` });
  if (r.vizier === c.id) r.vizier = null;
}

// ---------- intrigue: what temperaments do at court ----------
function intrigue(s, rng, emit) {
  for (const r of living(s)) {
    const ruler = s.chars[r.ruler];
    if (!ruler?.alive || r.rebel) continue;
    const T = R.temper.ruler[ruler.temper] ?? {};
    // The paranoid ruler strikes first.
    if (T.purge && chance(rng, T.purge)) {
      const marks = Object.values(s.chars).filter((c) => c.alive && c.realm === r.id && (c.role === 'general' || c.role === 'vizier' || (c.role === 'heir' && !['son', 'daughter'].includes(c.relation))) && (c.skill >= 3 || c.loyalty < 60));
      const v = marks.length && pick(rng, marks);
      if (v) {
        ruler.deeds.purges++;
        for (const c of Object.values(s.chars)) if (c.alive && c.realm === r.id && c.id !== ruler.id) c.loyalty = clamp(c.loyalty - 8, 0, 100);
        die(s, v.id, 'executed', emit, rng, `is put to death on the orders of ${ruler.name}, who fears a plot`);
      }
    }
    // A scheming consort wants her own son crowned.
    const sp = s.chars[ruler.spouse], heir = s.chars[r.heir];
    if (sp?.alive && sp.temper === 'schemer' && heir && !sp.kids.includes(heir.id)) {
      const son = sp.kids.map((k) => s.chars[k]).find((k) => k?.alive && !k.female && k.id !== heir?.id);
      if (son && chance(rng, R.temper.consort.schemer.scheme)) {
        heir.role = 'exile';
        son.role = 'heir';
        r.heir = son.id;
        emit('intrigue', `${sp.name} persuades ${ruler.name} of ${ofR(s, r.id)} to name her son ${son.name} heir; ${heir.name} is cast out`, { realms: [r.id], chars: [sp.id, son.id, heir.id] });
      }
    }
    // A kingmaker vizier, under a weak or absent ruler, takes the throne.
    const vz = s.chars[r.vizier];
    const weak = r.regent || ['negligent', 'hedonist'].includes(ruler.temper) || ageOf(s, ruler) > 72;
    if (vz?.alive && vz.temper === 'kingmaker' && weak && chance(rng, R.temper.vizier.kingmaker.usurp)) {
      ask(s, { kind: 'betray', char: vz.id, realm: r.id, options: ['serve', 'seize'], question: `${ruler.name} of ${ofR(s, r.id)} is weak. Seize the throne for yourself, or keep serving?` });
    }
    // A reformer changes the laws once or twice a reign.
    if (T.reform && chance(rng, T.reform) && (r.reforms?.length ?? 0) < 3) {
      const kind = ['tax', 'army', 'law'].find((k) => !r.reforms.includes(k));
      if (kind) {
        r.reforms.push(kind);
        for (const p of provincesOf(s, r.id)) s.provinces[p.id].loyalty = clamp(s.provinces[p.id].loyalty + (kind === 'law' ? 6 : -5), 0, 100);
        emit('reform', `${fullName(ruler)} of ${ofR(s, r.id)} ${{ tax: 'reforms the taxes: the treasury will fill, though the landlords grumble', army: 'reforms the army: soldiers come cheaper', law: 'issues a new code of laws: the people take heart' }[kind]}`, { realms: [r.id], chars: [ruler.id], reform: kind });
      }
    }
    // The pleasure-lover feasts.
    if (ruler.temper === 'hedonist' && chance(rng, 0.03) && r.gold > 40) {
      const spent = round1(r.gold * 0.2);
      r.gold = round1(r.gold - spent);
      emit('feast', `${ruler.name} of ${ofR(s, r.id)} spends ${Math.round(spent)} gold on feasts, hunts and pleasure gardens`, { realms: [r.id], chars: [ruler.id], minor: true });
    }
  }
}

// ---------- generals who betray ----------
function betrayals(s, rng, emit) {
  if (s.month < 12) return;
  for (const c of Object.values(s.chars)) {
    if (!c.alive || c.role !== 'general' || !s.armies[c.army] || s.armies[c.army].battle) continue;
    const r = s.realms[c.realm];
    if (!r || r.fallen || r.rebel || provincesOf(s, r.id).length < 3) continue;
    const T = TEMPER(s, c.id, 'general');
    // A mercenary leaves an empty treasury for the enemy's gold.
    if (T.sells && r.broke && chance(rng, 0.08)) {
      const buyer = living(s).filter((o) => atWar(s, o.id, r.id) && o.gold > 40).sort((a, b) => b.gold - a.gold)[0];
      if (buyer) {
        const a = s.armies[c.army];
        a.realm = buyer.id;
        armiesChanged(s);
        Object.assign(c, { realm: buyer.id, loyalty: 50 });
        buyer.gold = round1(buyer.gold - 25);
        emit('turncoat', `${c.name}, unpaid, sells ${his(c)} sword and ${menText(a.size)} men to ${ofR(s, buyer.id)}`, { realms: [r.id, buyer.id], at: a.at, chars: [c.id], war: s.wars[key(r.id, buyer.id)]?.conflict });
        continue;
      }
    }
    if (!T.betray) continue;
    const ruler = s.chars[r.ruler];
    const troubled = r.broke || r.regent || ['negligent', 'hedonist', 'tyrant'].includes(ruler?.temper) || (ruler && ageOf(s, ruler) < 18);
    if (!chance(rng, R.betrayal.chance * T.betray * (troubled ? 3 : 1) * (c.loyalty < 50 ? 2 : 0.6) * (s.mods?.betrayal ?? 1))) continue;
    ask(s, { kind: 'betray', char: c.id, realm: r.id, options: ['serve', 'seize', 'break'],
      question: `${fullName(ruler)} of ${ofR(s, r.id)} ${troubled ? 'is weak' : 'trusts you'}. You command ${menText(s.armies[c.army].size)} men at ${cityOf(s, s.armies[c.army].at)}. Serve, seize the throne, or break away?` });
  }
}

// ---------- hired daggers ----------
function plots(s, rng, emit) {
  const A = R.agents;
  for (const r of living(s)) {
    const c = r.contract;
    if (!c) continue;
    r.contract = null;
    const t = s.chars[c.target];
    if (!t?.alive) continue;
    const odds = A.success * (['paranoid', 'cautious'].includes(t.temper) || t.traits.includes('shrewd') ? 0.6 : 1) * (c.by === 'alamut' ? 1.25 : 1);
    const ok = chance(rng, odds), exposed = chance(rng, ok ? A.exposed : A.exposed + 0.3);
    if (ok) {
      s.record.assassinations++;
      die(s, t.id, 'assassin', emit, rng, `is struck down by ${c.by === 'alamut' ? 'the hidden agents of Alamut' : word(s, 'daggers', 'hired daggers')}${exposed && r.id !== 'alamut' ? `, paid by ${ofR(s, r.id)}` : ''}`);
    } else emit('plot', `A plot against ${nameOf(s, t.id)} of ${ofR(s, t.realm)} fails${exposed ? `: the trail leads to ${ofR(s, r.id)}` : ''}`, { realms: [t.realm, ...(exposed ? [r.id] : [])], chars: [t.id] });
    if (exposed && t.realm && t.realm !== r.id) declareWar(s, t.realm, r.id, emit, { cause: 'revenge', text: `${say(s, t.realm, 'declares')} war on ${ofR(s, r.id)} to avenge the plot` });
  }
  for (const P of Object.values(PROV)) {
    if (baseWealth(s, P.id) >= 5 && s.provinces[P.id].loyalty < 50 && !Object.values(s.groups).some((g) => g.at === P.id) && chance(rng, A.guildChance)) {
      const id = `g${s.nextId++}`;
      s.groups[id] = { id, kind: 'guild', at: P.id, since: s.month, name: `the Daggers of ${cityOf(s, P.id)}` };
      emit('guild', `${word(s, 'guild', 'A guild of hired daggers gathers in the back streets of')} ${cityOf(s, P.id)}`, { at: P.id });
    }
  }
}

export function hire(s, id, target) {
  const r = s.realms[id], t = s.chars[target];
  if (!t?.alive || t.realm === id || r.gold < R.agents.contractCost) return false;
  const seller = s.realms.alamut && !s.realms.alamut.fallen && t.realm !== 'alamut' ? 'alamut' : Object.values(s.groups).some((g) => g.kind === 'guild') ? 'guild' : null;
  if (!seller) return false;
  r.gold = round1(r.gold - R.agents.contractCost);
  if (seller === 'alamut') s.realms.alamut.gold += R.agents.contractCost * 0.8;
  r.contract = { target, by: seller };
  return true;
}

// ---------- what history calls them ----------
export function earnEpithet(s, c, emit) {
  if (!c || c.epithet || / the |Khan$|^Genghis/.test(c.name)) return;
  const d = c.deeds ?? {}, r = s.realms[c.realm];
  let e = null;
  if (c.role === 'ruler' || c.cause && c.since) {
    const land = r ? provincesOf(s, r.id).length : 0, start = c.landAtStart ?? land, reign = yearOf(s.month, s) - (c.since ?? yearOf(s.month, s));
    if (start && land >= start * 2 && land - start >= 5) e = 'the Great';
    else if (d.captures >= 10) e = 'the Conqueror';
    else if (d.works >= 3) e = 'the Builder';
    else if (d.purges >= 2) e = 'the Cruel';
    else if (r?.golden && r.golden > s.month && reign >= 8) e = 'the Magnificent';
    else if (start >= 6 && land <= start * 0.6) e = 'the Unlucky';
    else if ((r?.reforms?.length ?? 0) >= 2 && c.temper === 'reformer') e = 'the Lawgiver';
    else if (c.temper === 'just' && reign >= 15) e = 'the Just';
    else if (!c.alive && c.cause === 'age' && ageOf(s, c) >= 76) e = 'the Old';
  } else if (c.role === 'general') {
    if (d.wins >= 5 && d.losses <= 1) e = 'the Invincible';
    else if (d.wins >= 4) e = 'the Lion';
  }
  if (!e) return;
  c.epithet = e;
  if (emit && c.alive) emit('epithet', `The people now call ${c.title ? `${c.title} ` : ''}${c.name} of ${ofR(s, c.realm)} "${e}"`, { realms: [c.realm].filter(Boolean), chars: [c.id] });
}

// The dead are remembered in lineages and chronicles; after fifteen years they leave the court's records.
function prune(s) {
  // Grown children with no office, and widowed consorts, fade from the court's records (they live on, unrecorded).
  for (const c of Object.values(s.chars)) {
    if (!c.alive) continue;
    const idle = (c.role === 'child' && ageOf(s, c) >= 30) || (c.role === 'consort' && c.widowed !== undefined && s.month - c.widowed > 60) || (c.role === 'courtier' && ageOf(s, c) > 70) || (c.role === 'exile' && s.month - (c.since ?? 0) > 240);
    if (idle && !c.army && !Object.values(s.realms).some((r) => !r.fallen && [r.ruler, r.heir, r.regent, r.vizier].includes(c.id))) Object.assign(c, { alive: false, died: s.month, cause: 'faded' });
  }
  const keep = new Set();
  for (const r of living(s)) for (const id of [r.ruler, r.heir, r.vizier, r.regent]) if (id) keep.add(id);
  for (const c of Object.values(s.chars)) if (c.alive) { if (c.parentId) keep.add(c.parentId); if (c.spouse) keep.add(c.spouse); }
  for (const c of Object.values(s.chars)) if (!c.alive && s.month - c.died > 180 && !keep.has(c.id)) delete s.chars[c.id];
  // Old wars and old treaties: the chronicle and the chain keep them; the court's records let them go after ten years.
  for (const [id, w] of Object.entries(s.conflicts)) if (w.ended !== null && s.month - w.ended > 120) delete s.conflicts[id];
  for (const [id, t] of Object.entries(s.treaties)) if (t.ended !== null && s.month - t.ended > 120 && (t.sealed || !s.sealing)) delete s.treaties[id];
}
export { strength, incomeOf, friendly };
