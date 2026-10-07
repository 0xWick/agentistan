// The acts a ruler can take. Doctrine, the AI and players all ask through act(); each act checks the rules before it
// changes anything, so no voice, human or machine, can do what the world does not allow.
import { RULES as R } from './rules.js';
import { PROV, PROVINCES, provincesOf, armiesOf, living, atWar, allied, friendly, truceUntil, key, setOwner, clamp, round1, chance, pick,
  short, ofR, say, vb, poss, nameOf, fullName, cityOf, yearOf } from './core.js';
import { strength, incomeOf, startWork, canBuild, steersman, rulingTemper, pairTreaties } from './economy.js';
import { declareWar, makePeace, peaceTerms, fall, breakTreaty } from './war.js';
import { hire, ask } from './court.js';

export const ACTS = ['war', 'peace', 'ally', 'submit', 'independence', 'power', 'hire', 'build', 'claim'];

export function act(s, id, a, rng, emit) {
  const r = s.realms[id];
  if (!r || r.fallen || !a || !ACTS.includes(a.kind)) return false;
  const t = s.realms[a.target];
  switch (a.kind) {
    case 'war': {
      if (!t || t.fallen || atWar(s, id, t.id)) return false;
      const breakTruce = truceUntil(s, id, t.id) > s.month;
      if (breakTruce && !['conqueror', 'tyrant'].includes(rulingTemper(s, r)) && !a.oath) return false; // only some will break their word
      return declareWar(s, id, t.id, emit, { cause: a.cause ?? (breakTruce ? 'oath' : 'border'), place: a.place, breakTruce, text: a.say ? `${say(s, id, 'declares')} war on ${ofR(s, t.id)}: "${a.say}"` : undefined });
    }
    case 'peace': {
      const w = t && s.wars[key(id, t.id)];
      if (!w || (w.offered ?? -99) > s.month - 12) return false; // an envoy a year, not one a month
      const terms = peaceTerms(s, id, t.id), them = steersman(s, t);
      if (!them) return false;
      w.offered = s.month;
      ask(s, { kind: 'peace', char: them.id, realm: t.id, from: id, terms, options: ['accept', 'refuse'],
        question: `${ofR(s, id).replace(/^./, (c) => c.toUpperCase())} ${vb(s, id, 'offers')} peace. ${terms.winner ? `${short(s, terms.winner)} would keep what ${s.realms[terms.winner].plural ? 'they hold' : 'it holds'}${terms.tribute ? `, and ${short(s, terms.loser)} would pay ${terms.tribute} gold a month for five years` : ''}.` : 'Neither side gains.'} Accept?` });
      return true;
    }
    case 'ally': {
      if (!t || t.fallen || allied(s, id, t.id) || atWar(s, id, t.id) || !acceptsAlliance(s, t.id, id)) return false;
      s.allies[key(id, t.id)] = { since: s.month };
      const tid = treaty(s, 'alliance', [id, t.id], { name: `Alliance of ${cityOf(s, r.capital)}` });
      emit('alliance', `${short(s, id)} and ${short(s, t.id)} swear an alliance`, { realms: [id, t.id], treaty: tid });
      return true;
    }
    case 'submit': {
      if (!t || t.fallen || r.overlord) return false;
      r.overlord = t.id;
      if (atWar(s, id, t.id)) makePeace(s, id, t.id, () => {}, { winner: t.id, loser: id, tribute: 0 });
      const tid = treaty(s, 'vassal', [id, t.id], { name: `Submission of ${cityOf(s, r.capital)}` });
      emit('vassal', `${say(s, id, 'bows')} to ${ofR(s, t.id)} and ${vb(s, id, 'pays')} tribute`, { realms: [id, t.id], treaty: tid });
      return true;
    }
    case 'independence': {
      if (!r.overlord) return false;
      const was = r.overlord;
      r.overlord = null;
      for (const tr of pairTreaties(s, id, was)) if (tr.kind === 'vassal') breakTreaty(s, tr, id, () => {}, true);
      return declareWar(s, id, was, emit, { cause: 'independence', text: `${say(s, id, 'throws')} off the rule of ${ofR(s, was)}` });
    }
    case 'power': return powerMove(s, id, a.power, rng, emit);
    case 'hire': return !r.contract && hire(s, id, a.target);
    case 'build': return startWork(s, id, a.place, a.work, emit);
    case 'claim': return arbitrate(s, id, a.place, rng, emit);
  }
  return false;
}

export function treaty(s, kind, parties, extra = {}) {
  const tid = `t${s.nextId++}`;
  s.treaties[tid] = { id: tid, kind, name: extra.name ?? kind, parties, signed: s.month, until: extra.until ?? null, ended: null, broken: null, pay: extra.pay ?? null, text: extra.text ?? kind, sealed: null, ...extra.more };
  return tid;
}

export function acceptsPeace(s, them, us) {
  const war = s.wars[key(them, us)], long = s.month - (war?.since ?? 0);
  const t = s.realms[them];
  if (t?.nomad && long <= 60 && !t.horde) return strength(s, them) < strength(s, us) * 0.8;
  if (t?.horde) return false;
  const conqueror = ['conqueror', 'tyrant'].includes(rulingTemper(s, t));
  return strength(s, them) < strength(s, us) * (conqueror ? 1.1 : 1.6) || long > (conqueror ? 72 : 48);
}
export const acceptsAlliance = (s, them, us) => !s.realms[them].nomad && !s.realms[them].rebel && !atWar(s, them, us) && (s.realms[us].rep ?? 60) >= 35;

// Answers that come back to acts: peace offers and arbiters' verdicts.
export function applyAnswers(s, rng, emit) {
  const due = s.answers;
  s.answers = [];
  for (const d of due) {
    if (d.kind === 'peace') {
      if (!atWar(s, d.from, d.realm)) continue;
      if (d.choice === 'accept') makePeace(s, d.from, d.realm, emit, d.terms);
      else emit('peace.refused', `${say(s, d.realm, 'refuses')} the peace ${ofR(s, d.from)} ${vb(s, d.from, 'offers')}${d.said ? `: "${d.said}"` : ''}`, { realms: [d.realm, d.from], war: s.wars[key(d.from, d.realm)]?.conflict, minor: true });
    } else if (d.kind === 'verdict') verdict(s, d, rng, emit);
  }
}

// ---------- the registry: claims, arbitration and verdicts ----------
// A realm has a claim on a province it held for ten years or more and lost by force within the last thirty.
export function claimsOf(s, id) {
  const out = [];
  for (const p of PROVINCES) {
    const deeds = s.deeds[p.id] ?? [], q = s.provinces[p.id];
    if (q.owner === id || !q.owner || s.realms[id]?.spent?.includes(p.id)) continue;
    for (let i = deeds.length - 1; i >= 0; i--) {
      const d = deeds[i];
      if (d.realm !== id) continue;
      const until = deeds[i + 1]?.m ?? s.month, held = until - d.m, lostBy = deeds[i + 1]?.how;
      if (held >= R.dispute.years * 12 - (d.how === 'start' ? 60 : 0) && s.month - until <= 360 && ['conquest', 'revolt', 'secession', 'bribe'].includes(lostBy)) out.push({ place: p.id, held, lost: until, holder: q.owner });
      break;
    }
  }
  return out;
}
function arbitrate(s, id, place, rng, emit) {
  const claim = claimsOf(s, id).find((c) => c.place === place);
  if (!claim) return false;
  const holder = claim.holder, H = s.realms[holder];
  if (!H || atWar(s, id, holder) || s.pending.some((d) => d.kind === 'verdict' && d.place === place)) return false;
  // The arbiter: the mightiest realm at peace with both, whose word is good.
  const arbiter = living(s).filter((o) => o.id !== id && o.id !== holder && !o.rebel && !atWar(s, o.id, id) && !atWar(s, o.id, holder) && (o.rep ?? 60) >= 40 && provincesOf(s, o.id).length >= 4)
    .sort((a, b) => strength(s, b.id) - strength(s, a.id))[0];
  if (!arbiter) return false;
  const deeds = s.deeds[place] ?? [];
  const last = deeds[deeds.length - 1];
  const holderMonths = s.month - (last?.m ?? s.month);
  // The registry weighs: how long each held it, how the holder got it, whether its people are content, and friendship.
  const forClaimant = claim.held * (last?.how === 'conquest' ? 1.4 : 1) * (s.provinces[place].loyalty < 40 ? 1.3 : 1) * (allied(s, arbiter.id, id) ? 1.3 : 1);
  const forHolder = holderMonths * (['treaty', 'inheritance', 'verdict'].includes(last?.how) ? 1.5 : 1) * (allied(s, arbiter.id, holder) ? 1.3 : 1) + 24;
  const winner = forClaimant > forHolder ? id : holder;
  emit('dispute', `${say(s, id, 'brings')} ${poss(short(s, id))} claim to ${cityOf(s, place)} before ${fullName(steersman(s, arbiter))} of ${ofR(s, arbiter.id)}; the registry shows ${ofR(s, id)} held it ${Math.round(claim.held / 12)} years`,
    { realms: [id, holder, arbiter.id], at: place });
  if (winner === holder) {
    const tid = treaty(s, 'verdict', [id, holder], { name: `Verdict on ${cityOf(s, place)}`, more: { place, arbiter: arbiter.id, for: holder } });
    emit('verdict', `${fullName(steersman(s, arbiter))} rules that ${cityOf(s, place)} stays with ${ofR(s, holder)}; ${poss(short(s, id))} claim is struck from the registry`, { realms: [id, holder, arbiter.id], at: place, treaty: tid });
    (s.realms[id].spent ??= []).push(place); // the claim is spent; the deeds themselves are never erased
    return true;
  }
  const them = steersman(s, H);
  ask(s, { kind: 'verdict', char: them.id, realm: holder, claimant: id, place, arbiter: arbiter.id, options: ['accept', 'defy'],
    question: `${fullName(steersman(s, arbiter))} of ${ofR(s, arbiter.id)} rules that ${cityOf(s, place)} must return to ${ofR(s, id)}. Accept the verdict, or defy it?` });
  emit('verdict', `${fullName(steersman(s, arbiter))} rules that ${cityOf(s, place)} must return to ${ofR(s, id)}; ${short(s, holder)} must answer`, { realms: [id, holder, arbiter.id], at: place, minor: true });
  return true;
}
function verdict(s, d, rng, emit) {
  const place = d.place, holder = d.realm, claimant = d.claimant, A = s.realms[d.arbiter];
  if (s.provinces[place].owner !== holder || s.realms[claimant]?.fallen) return;
  if (d.choice === 'accept') {
    setOwner(s, place, claimant, 'verdict');
    Object.assign(s.provinces[place], { siege: null, conquered: -6 });
    for (const a of Object.values(s.armies)) if (a.at === place && a.realm === holder) a.path = [];
    const tid = treaty(s, 'verdict', [claimant, holder], { name: `Verdict on ${cityOf(s, place)}`, more: { place, arbiter: d.arbiter, for: claimant } });
    s.realms[holder].rep = clamp((s.realms[holder].rep ?? 60) + 6, 0, 100);
    emit('ceded', `${say(s, holder, 'accepts')} the verdict and ${vb(s, holder, 'hands')} ${cityOf(s, place)} back to ${ofR(s, claimant)}`, { realms: [holder, claimant], at: place, treaty: tid });
    if (!provincesOf(s, holder).length) fall(s, holder, emit, `${s.realms[holder].name} ${vb(s, holder, 'is')} no more`, claimant);
  } else {
    const H = s.realms[holder];
    H.rep = clamp((H.rep ?? 60) - R.reputation.defied, 0, 100);
    emit('defied', `${say(s, holder, 'defies')} the verdict on ${cityOf(s, place)}${d.said ? `: "${d.said}"` : ''}. ${poss(short(s, holder))} word is worth less now`, { realms: [holder, claimant, d.arbiter], at: place });
    if (strength(s, claimant) > strength(s, holder) * 0.7 || chance(rng, 0.5)) declareWar(s, claimant, holder, emit, { cause: 'defiance', place });
    if (A && !A.fallen && chance(rng, 0.3) && !atWar(s, A.id, holder)) declareWar(s, A.id, holder, emit, { join: s.wars[key(claimant, holder)]?.conflict, text: `${say(s, A.id, 'takes')} up arms to enforce ${poss(short(s, A.id))} verdict` });
  }
}

// ---------- power moves: once per reign ----------
export function powerMove(s, id, kind, rng, emit) {
  const r = s.realms[id], who = nameOf(s, r.ruler), mine = provincesOf(s, id);
  if (!R.power.includes(kind) || r.power || !mine.length) return false;
  if (kind === 'levy') {
    for (const a of armiesOf(s, id)) a.size = round1(a.size * 1.5);
    for (const p of mine) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 10);
    emit('power', `${who} of ${ofR(s, id)} calls a Great Levy: every village sends its sons`, { realms: [id], chars: [r.ruler], power: kind });
  } else if (kind === 'walls') {
    const frontier = mine.filter((p) => p.neighbors.some((n) => s.provinces[n].owner !== id)).sort((a, b) => b.wealth - a.wealth)[0];
    for (const p of [s.provinces[r.capital], frontier && s.provinces[frontier.id]].filter(Boolean)) p.walls = Math.min(4, p.walls + 1);
    emit('power', `${who} of ${ofR(s, id)} raises Mighty Walls around ${cityOf(s, r.capital)}${frontier ? ` and ${cityOf(s, frontier.id)}` : ''}`, { realms: [id], chars: [r.ruler], power: kind, at: r.capital });
  } else if (kind === 'bribe') {
    const t = mine.flatMap((p) => p.neighbors).filter((n) => s.provinces[n].owner !== id && s.provinces[n].loyalty < 55 && s.realms[s.provinces[n].owner]?.capital !== n).sort((a, b) => PROV[b].wealth - PROV[a].wealth)[0];
    if (!t || r.gold < 40) return false;
    r.gold -= 40;
    const old = s.provinces[t].owner;
    setOwner(s, t, id, 'bribe');
    Object.assign(s.provinces[t], { loyalty: 45, siege: null });
    emit('power', `${who} of ${ofR(s, id)} bribes the governor of ${cityOf(s, t)}, who opens the gates${old ? ` to spite ${ofR(s, old)}` : ''}`, { realms: [id, old].filter(Boolean), chars: [r.ruler], power: kind, at: t });
    if (old && s.realms[old] && !provincesOf(s, old).length) fall(s, old, emit, `${s.realms[old].name} ${vb(s, old, 'is')} no more`, id);
  } else if (kind === 'feast') {
    for (const p of mine) s.provinces[p.id].loyalty = Math.min(100, s.provinces[p.id].loyalty + 20);
    emit('power', `${who} of ${ofR(s, id)} holds a Royal Feast: the people cheer their ruler`, { realms: [id], chars: [r.ruler], power: kind });
  } else if (kind === 'silktax') {
    const silk = mine.filter((p) => p.silk);
    if (!silk.length) return false;
    r.gold = round1(r.gold + 20 * silk.length);
    for (const p of silk) s.provinces[p.id].loyalty = Math.max(0, s.provinces[p.id].loyalty - 12);
    emit('power', `${who} of ${ofR(s, id)} levies a Silk Tax on the caravans: ${20 * silk.length} gold, and angry merchants`, { realms: [id], chars: [r.ruler], power: kind });
  }
  r.power = kind;
  return true;
}
export { canBuild };
