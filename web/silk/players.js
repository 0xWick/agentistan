// Players: people who seize a realm in the living world and rule it, quarter by quarter, from the council. They rule
// a dynasty: the throne passes to their heir and they play on. While they are away the vizier rules in their name, by
// their temperament; a long absence costs the treasury, the provinces and the generals, and in the end the throne.
// Everything here arrives as inputs (inputs.seize, inputs.leave, inputs.councils), so a record replays exactly.
import { RULES as R } from './rules.js';
import { provincesOf, living, newChar, clamp, round1, chance, pick, ofR, short, say, vb, cityOf, placeOf, yearOf, ageOf, realmsChanged } from './core.js';
import { incomeOf, steersman, rulingTemper } from './economy.js';
import { ask, crown, titled, endReign } from './court.js';
import { titleFor } from './names.js';

export const QUARTER = 3; // months between councils
export const isPlayer = (s, id) => !!s.players?.[id];
export const councilMonth = (m) => m % QUARTER === 0;
// A player's ruler decides at the council: decisions put to him wait for the next one.
export const waitsForCouncil = (s, d) => isPlayer(s, d.realm) && d.char === steersman(s, s.realms[d.realm])?.id && !councilMonth(s.month);

// ---------- taking a throne, and letting it go ----------
export function thrones(s, inputs, rng, emit) {
  for (const [id, p] of Object.entries(inputs.leave ?? {})) if (s.players?.[id] && p) {
    delete s.players[id];
    emit('player', `The ${s.realms[id]?.dynasty ?? 'ruling house'} of ${ofR(s, id)} goes on without its master: the vizier and the rules govern now`, { realms: [id], minor: true });
  }
  for (const [id, p] of Object.entries(inputs.seize ?? {})) seize(s, id, p, rng, emit);
}

function seize(s, id, p, rng, emit) {
  const r = s.realms[id];
  if (!r || r.fallen || s.players?.[id] || r.rebel || !provincesOf(s, id).length || !R.temper.ruler[p?.temper] || !p.name) return;
  const old = s.chars[r.ruler], year = yearOf(s.month, s), female = !!p.female;
  const title = old?.title && !/Consul|President|Premier|Minister|Chairman|Leader|Suffete|Archon/.test(old.title) ? titled(old.title, { female }) : titleFor(r.culture);
  const me = newChar(s, { name: String(p.name).slice(0, 40), title, role: 'ruler', realm: id, born: year - 32, temper: p.temper, skill: 3, female, culture: r.culture, family: `House of ${p.name}`, since: year, loyalty: 100 });
  Object.assign(s.chars[me], { player: true, landAtStart: provincesOf(s, id).length });
  if (old) {
    r.lineage = [...(r.lineage ?? []), { name: old.name, epithet: old.epithet, title: old.title, since: old.since ?? year, until: year, cause: 'overthrown', id: old.id }].slice(-30);
    Object.assign(old, { role: old.army ? 'general' : 'exile', loyalty: 0 });
    if (s.chars[old.spouse]) s.chars[old.spouse].role = 'exile';
  }
  const heir = s.chars[r.heir];
  if (heir?.alive) Object.assign(heir, heir.army ? { role: 'general', loyalty: 10 } : { role: 'exile' }); // the old line's heir: a pretender, or a general who hates you
  const pretender = [heir, old].find((c) => c?.alive && c.role === 'exile');
  Object.assign(r, { ruler: me, heir: null, regent: null, plan: null, power: null, dynasty: `House of ${p.name}`, elective: false });
  for (const c of Object.values(s.chars)) if (c.alive && c.realm === id && ['general', 'vizier'].includes(c.role)) c.loyalty = clamp(c.loyalty - R.players.doubt, 0, 100);
  for (const q of provincesOf(s, id)) s.provinces[q.id].loyalty = clamp(s.provinces[q.id].loyalty - R.players.unrest, 0, 100);
  (s.players ??= {})[id] = { name: String(p.name).slice(0, 40), since: s.month, missed: 0, line: String(p.line ?? '').slice(0, 160), pretender: pretender?.id ?? null };
  realmsChanged(s);
  emit('coup', `${p.name} seizes the throne of ${ofR(s, id)} in a sudden coup${old ? `: ${old.name} flees the palace` : ''}`, { realms: [id], chars: [me, old?.id].filter(Boolean), at: r.capital, player: id });
}

// ---------- the council: who came ----------
export function attendance(s, inputs) {
  if (!councilMonth(s.month)) return;
  for (const [id, p] of Object.entries(s.players ?? {})) {
    if (!s.realms[id] || s.realms[id].fallen || !provincesOf(s, id).length) { delete s.players[id]; continue; }
    if (p.since === s.month) continue;
    p.missed = inputs.councils?.[id] ? 0 : p.missed + 1;
  }
}

// ---------- away from the council: the vizier rules, and takes his share ----------
export function absence(s, rng, emit) {
  const A = R.absence;
  for (const [id, p] of Object.entries(s.players ?? {})) {
    const r = s.realms[id], t = p.missed - A.grace;
    if (!r || r.fallen || t <= 0) continue;
    const ruler = s.chars[r.ruler], vizier = s.chars[r.vizier];
    if (r.gold > 0) r.gold = round1(r.gold * (1 - Math.min(A.skimMax, A.skim * t)));
    for (const q of provincesOf(s, id)) s.provinces[q.id].loyalty = clamp(s.provinces[q.id].loyalty - A.drift * t, 0, 100);
    for (const c of Object.values(s.chars)) if (c.alive && c.realm === id && c.role === 'general') c.loyalty = clamp(c.loyalty - A.generals * t, 0, 100);
    if (!councilMonth(s.month)) continue;
    if (t === 1) emit('absence', `The court of ${ofR(s, id)} has not seen ${ruler?.name ?? 'its ruler'} in a long while; ${vizier?.alive ? `${vizier.name} signs the orders` : 'the clerks sign the orders'}`, { realms: [id], chars: [ruler?.id].filter(Boolean), minor: true });
    if (t === A.bold) emit('absence', `${vizier?.alive ? `${vizier.name}, vizier of ${ofR(s, id)},` : `The court of ${ofR(s, id)}`} grows bold while ${ruler?.name ?? 'the ruler'} is away: the treasury thins, the governors drift`, { realms: [id], chars: [vizier?.id, ruler?.id].filter(Boolean) });
    if (t >= A.usurp) usurp(s, id, rng, emit);
  }
}

function usurp(s, id, rng, emit) {
  const r = s.realms[id], ruler = s.chars[r.ruler];
  const gens = Object.values(s.chars).filter((c) => c.alive && c.realm === id && c.role === 'general').sort((a, b) => b.skill - a.skill);
  const who = s.chars[r.vizier]?.alive ? s.chars[r.vizier] : gens[0];
  delete s.players[id];
  if (!who) return emit('absence', `${ofR(s, id)} forgets its absent master: the rules govern now`, { realms: [id], usurped: id });
  if (ruler) { endReign(s, r, 'overthrown'); Object.assign(ruler, { role: 'exile' }); }
  Object.assign(who, { role: 'ruler', title: ruler?.title ?? titleFor(r.culture), since: yearOf(s.month, s), family: `House of ${who.name}`, temper: R.temper.ruler[who.temper] ? who.temper : who.temper === 'kingmaker' ? 'tyrant' : 'conqueror', landAtStart: provincesOf(s, id).length });
  if (r.vizier === who.id) r.vizier = null;
  Object.assign(r, { ruler: who.id, heir: null, regent: null, plan: null, power: null, dynasty: `House of ${who.name}` });
  emit('coup', `${who.name} takes the throne of ${ofR(s, id)} that the absent ${ruler?.name ?? 'ruler'} left empty`, { realms: [id], chars: [who.id, ruler?.id].filter(Boolean), at: r.capital, usurped: id });
}

// ---------- the realm's own troubles, put to the ruler at each council ----------
export function matters(s, rng) {
  const M = R.players.matters;
  for (const [id, p] of Object.entries(s.players ?? {})) {
    const r = s.realms[id], ruler = steersman(s, r);
    if (!r || r.fallen || !ruler) continue;
    const mine = provincesOf(s, id), income = Math.max(5, incomeOf(s, id));
    const out = [];
    const pretender = s.chars[p.pretender];
    if (pretender?.alive && pretender.role === 'exile' && s.month - p.since < M.pretenderFor)
      out.push({ topic: 'pretender', target: pretender.id, cost: round1(income * M.pretenderPay), options: ['pay', 'hunt', 'ignore'],
        question: `${pretender.name}, of the house you overthrew, gathers friends in exile and claims the throne. Pay him off (${round1(income * M.pretenderPay)} gold), hunt him down, or ignore him?` });
    const proud = Object.values(s.chars).filter((c) => c.alive && c.realm === id && c.role === 'general' && c.loyalty < M.ambitionBelow && c.skill >= 3).sort((a, b) => a.loyalty - b.loyalty)[0];
    if (proud) out.push({ topic: 'ambition', target: proud.id, cost: M.reward, options: ['reward', 'dismiss', 'ignore'],
      question: `General ${proud.name} commands ${s.armies[proud.army] ? `an army at ${cityOf(s, s.armies[proud.army].at)}` : 'no army'} and speaks of what he is owed. Reward him (${M.reward} gold), dismiss him, or let it pass?` });
    const restless = mine.filter((q) => q.id !== r.capital && s.provinces[q.id].loyalty < M.unrestBelow && !s.provinces[q.id].siege).sort((a, b) => s.provinces[a.id].loyalty - s.provinces[b.id].loyalty)[0];
    if (restless) out.push({ topic: 'unrest', place: restless.id, cost: M.grant, options: ['grant', 'garrison', 'ignore'],
      question: `${placeOf(s, restless.id)} grumbles against your rule. Ease its taxes (${M.grant} gold), quarter soldiers in its towns, or ignore it?` });
    const hungry = mine.find((q) => s.provinces[q.id].famine > 0);
    if (hungry) out.push({ topic: 'famine', place: hungry.id, cost: M.relief, options: ['relief', 'ignore'],
      question: `Famine in ${placeOf(s, hungry.id)}. Open the granaries and send relief (${M.relief} gold), or let it run its course?` });
    for (const m of out.slice(0, M.perCouncil)) ask(s, { kind: 'matter', char: ruler.id, realm: id, ...m });
  }
}

// How the vizier (or a ruler with no player) would settle a matter: by the ruling temperament.
export function decideMatter(s, d) {
  const t = rulingTemper(s, s.realms[d.realm]), r = s.realms[d.realm], rich = (r?.gold ?? 0) > (d.cost ?? 0) * 2;
  const by = {
    pretender: ['tyrant', 'paranoid', 'conqueror'].includes(t) ? 'hunt' : rich && ['diplomat', 'just', 'builder'].includes(t) ? 'pay' : 'ignore',
    ambition: rich && ['diplomat', 'just', 'builder', 'reformer'].includes(t) ? 'reward' : ['paranoid', 'tyrant'].includes(t) ? 'dismiss' : 'ignore',
    unrest: rich && ['just', 'reformer', 'diplomat'].includes(t) ? 'grant' : ['tyrant', 'conqueror', 'paranoid'].includes(t) ? 'garrison' : 'ignore',
    famine: rich && t !== 'miser' && t !== 'tyrant' ? 'relief' : 'ignore',
  };
  return d.options.includes(by[d.topic]) ? by[d.topic] : 'ignore';
}

export function resolveMatter(s, d, choice, rng, emit) {
  const r = s.realms[d.realm], M = R.players.matters;
  if (!r || r.fallen) return;
  const pay = (gold) => { if (r.gold < gold) return false; r.gold = round1(r.gold - gold); return true; };
  const c = s.chars[d.target], ruler = s.chars[r.ruler];
  if (d.topic === 'pretender' && c?.alive) {
    if (choice === 'pay' && pay(d.cost)) { Object.assign(c, { role: 'courtier', realm: null }); return emit('matter', `${ruler?.name} pays off the pretender ${c.name}, who gives up his claim to ${ofR(s, r.id)}`, { realms: [r.id], chars: [c.id], minor: true }); }
    if (choice === 'hunt') {
      if (chance(rng, M.hunt)) { Object.assign(c, { alive: false, died: s.month, cause: 'executed' }); return emit('matter', `The agents of ${ruler?.name} find the pretender ${c.name} and put an end to his claim`, { realms: [r.id], chars: [c.id] }); }
      for (const q of provincesOf(s, r.id)) s.provinces[q.id].loyalty = clamp(s.provinces[q.id].loyalty - M.huntFails, 0, 100);
      return emit('matter', `The pretender ${c.name} escapes the hunters of ${ofR(s, r.id)}, and the story spreads`, { realms: [r.id], chars: [c.id] });
    }
    if (chance(rng, M.pretenderRises)) {
      const far = provincesOf(s, r.id).filter((q) => q.id !== r.capital).sort((a, b) => s.provinces[a.id].loyalty - s.provinces[b.id].loyalty)[0];
      if (far) { s.provinces[far.id].loyalty = Math.min(s.provinces[far.id].loyalty, 8); emit('matter', `The pretender ${c.name} stirs up ${placeOf(s, far.id)} against ${ofR(s, r.id)}`, { realms: [r.id], chars: [c.id], at: far.id }); }
    }
    return;
  }
  if (d.topic === 'ambition' && c?.alive) {
    if (choice === 'reward' && pay(d.cost)) { c.loyalty = clamp(c.loyalty + M.rewardLoyalty, 0, 100); return emit('matter', `${ruler?.name} showers General ${c.name} with gold and honours`, { realms: [r.id], chars: [c.id], minor: true }); }
    if (choice === 'dismiss') {
      const a = s.armies[c.army];
      if (a) a.general = null;
      Object.assign(c, { role: 'courtier', army: null, loyalty: clamp(c.loyalty - 20, 0, 100) });
      return emit('matter', `${ruler?.name} dismisses General ${c.name} from command`, { realms: [r.id], chars: [c.id], minor: true });
    }
    return;
  }
  const q = s.provinces[d.place];
  if (!q || q.owner !== r.id) return;
  if (d.topic === 'unrest') {
    if (choice === 'grant' && pay(d.cost)) { q.loyalty = clamp(q.loyalty + M.grantLoyalty, 0, 100); return emit('matter', `${ruler?.name} eases the taxes of ${placeOf(s, d.place)}`, { realms: [r.id], at: d.place, minor: true }); }
    if (choice === 'garrison') { q.loyalty = clamp(q.loyalty + M.garrisonLoyalty, 0, 100); q.prosperity = Math.max(0, (q.prosperity ?? 50) - M.garrisonCost); return emit('matter', `Soldiers of ${ofR(s, r.id)} are quartered in the towns of ${placeOf(s, d.place)}`, { realms: [r.id], at: d.place, minor: true }); }
    return;
  }
  if (d.topic === 'famine') {
    if (choice === 'relief' && pay(d.cost)) { q.loyalty = clamp(q.loyalty + M.reliefLoyalty, 0, 100); q.famine = Math.max(0, q.famine - 2); return emit('matter', `${ruler?.name} opens the granaries for ${placeOf(s, d.place)}`, { realms: [r.id], at: d.place, minor: true }); }
    q.loyalty = clamp(q.loyalty - M.famineAnger, 0, 100);
  }
}

// ---------- the dynasty: an heir named at any time, a crown given up at any time ----------
export function nameHeir(s, id, cid, emit) {
  const r = s.realms[id], c = s.chars[cid];
  if (!r || !c?.alive || c.realm !== id || c.id === r.ruler || !['heir', 'child', 'courtier', 'general', 'consort'].includes(c.role)) return false;
  const was = s.chars[r.heir];
  if (was && was.id !== c.id) was.role = was.army ? 'general' : ageOf(s, was) < R.family.adult ? 'child' : 'courtier';
  r.heir = c.id;
  c.role = 'heir';
  emit('heir', `${s.chars[r.ruler]?.name} of ${ofR(s, id)} names ${c.name} heir to the throne`, { realms: [id], chars: [c.id] });
  return true;
}
export function abdicate(s, id, emit) {
  const r = s.realms[id], old = s.chars[r?.ruler], h = s.chars[r?.heir];
  if (!old || !h?.alive || h.realm !== id) return false;
  endReign(s, r, 'abdicated');
  old.role = 'courtier';
  const title = crown(s, r, h, emit, 'is crowned');
  emit('crowned', `${old.name} gives up the throne of ${ofR(s, id)}: ${h.name} is crowned ${title}`, { realms: [id], chars: [h.id, old.id] });
  return true;
}
