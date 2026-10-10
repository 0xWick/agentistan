// The court: the commander speaks, the council answers and turns the words into orders. The AI does it when it
// can (server/campaigns.js); these rules do it otherwise, and check whatever the AI proposes against the war's
// own data: only living people, only these armies and places, only what one season allows.
import { withCards, armiesOf, armiesAt, reach, oddsOf, battleFacts, plansFor, fitOf, PLANS, cardsDue, atWar, friends, owned, fmtMen, wayTo, autoOrders, homeOf, courtOf, leaderOf, menOf, goalState, heroOf, turnOf, temperOf, relOf } from './engine.js';

const fold = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '');
const words = (t) => fold(t).split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(['the', 'of', 'and', 'to', 'a', 'an', 'at', 'on', 'in', 'my', 'our', 'your', 'his', 'with', 'by', 'for', 'from', 'is', 'be', 'king', 'great', 'river', 'lake', 'city']);

// ---------- what an order means, in words ----------
export function orderText(C, s, id, o) {
  const a = s.armies[id];
  if (!a) return '';
  const who = `${a.gen ?? 'An army'} (${fmtMen(a.men)})`;
  if (!o?.to || o.to === a.at) return `${who} holds ${C.prov[a.at].name}${o?.plan ? `, ready to ${PLANS[o.plan].name.toLowerCase()} if attacked` : ''}${o?.aid ? ', and will march to the aid of any friend attacked next to it' : ''}`;
  const friend = Object.values(s.armies).find((x) => x.id !== id && x.at === o.to && friends(s, a.side, x.side));
  if (friend && !Object.values(s.armies).some((x) => x.at === o.to && atWar(s, a.side, x.side))) return `${who} marches to join ${friend.gen ?? 'our army'} at ${C.prov[o.to].name}`;
  const odds = oddsOf(C, s, id, o.to), P = C.prov[o.to].name;
  if (odds.kind === 'battle') return `${who} attacks at ${P}${o.plan ? ` with ${PLANS[o.plan].name.toLowerCase()}` : ', the general choosing the plan'} (odds ${odds.ratio >= 0.9 && odds.ratio < 1.1 ? 'about even' : odds.ratio >= 1 ? `${odds.ratio.toFixed(1)} to 1` : `1 to ${(1 / odds.ratio).toFixed(1)} against`})`;
  if (odds.kind === 'siege') return `${who} ${o.storm ? 'storms' : 'besieges'} ${P}${odds.fed ? ', a port fed from the sea' : o.storm ? '' : ` (about ${odds.turns} seasons)`}`;
  return `${who} marches to ${P}`;
}
export function summary(C, s0, draft) {
  const s = withCards(C, s0, draft.cards ?? {});
  const out = armiesOf(s, C.you).sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || b.men - a.men).map((a) => orderText(C, s, a.id, draft.orders?.[a.id]));
  for (const [id, n] of Object.entries(draft.raise ?? {})) out.push(id === '@home' ? `${fmtMen(n)} new men raised at ${C.prov[homeOf(C, s, C.you)]?.name ?? 'home'}` : `${fmtMen(n)} new men join ${s.armies[id]?.gen ?? 'an army'}`);
  for (const [side, how] of Object.entries(draft.peace ?? {})) if (how) out.push(`an envoy offers peace to ${C.sides[side].name}`);
  return out;
}

// ---------- the situation, for the AI: only what the war's data says ----------
export function situation(C, s0, draft = null) {
  const s = draft?.cards && Object.keys(draft.cards).length ? withCards(C, s0, draft.cards) : s0; // the world the chosen cards make
  const you = C.you, sides = Object.keys(C.sides).filter((id) => s.sides[id].alive), t = turnOf(C, s);
  const L = [`Date: ${t.label} (turn ${s.turn + 1} of ${C.turns.length}; it is ${t.season}). The war: ${C.title}. The commander (the player) is ${heroOf(s)?.gen ?? C.hero.name} of ${C.sides[you].name}. Goal: ${C.goal.text}. ${goalState(C, s).text}.`];
  for (const id of sides) {
    const d = C.sides[id], st = s.sides[id];
    const rel = id === you ? 'THE PLAYER’S SIDE' : relOf(s, you, id) === 'war' ? 'at war with the player' : relOf(s, you, id) === 'ally' ? 'allied to the player' : 'at peace with the player';
    const wars = sides.filter((x) => x !== id && atWar(s, id, x)).map((x) => C.sides[x].short ?? C.sides[x].name);
    L.push(`SIDE ${id} — ${d.name} (${rel}), led now by ${leaderOf(C, s, id)}; temper ${temperOf(C, s, id)}; will to fight ${Math.round(st.will)}/100; gold ${Math.round(st.gold)}; ${fmtMen(menOf(s, id))} men; ${owned(s, id).length} provinces${d.fleet !== undefined ? `; fleet ${st.fleet}` : ''}; at war with ${wars.join(', ') || 'no one'}.`);
    if (id === you) L.push(`  ${raising(C, s)}`);
    for (const a of armiesOf(s, id)) {
      L.push(`  army ${a.id}: ${fmtMen(a.men)} under ${a.gen ?? 'no famous general'} (skill ${a.skill}/5${a.temper ? `, ${a.temper}` : ''}, morale ${a.morale}) at ${a.at} (${C.prov[a.at].name}, ${C.prov[a.at].terrain})${id === you && draft?.orders?.[a.id] ? `; current order: ${orderText(C, s, a.id, draft.orders[a.id])}` : ''}`);
      if (id !== you) continue;
      const can = Object.keys(reach(C, s, a.id)).map((p) => {
        const o = oddsOf(C, s, a.id, p);
        if (o.kind === 'battle') return `${p} (${C.prov[p].name}: battle, odds ${o.ratio.toFixed(1)}, best plan ${bestPlan(C, o.facts)})`;
        if (o.kind === 'siege') return `${p} (${C.prov[p].name}: ${o.fed ? 'port fed from the sea' : `siege ~${o.turns} seasons`}, storm odds ${o.ratio.toFixed(1)})`;
        return `${p} (${C.prov[p].name})`;
      });
      L.push(`    can reach this season: ${can.join(', ') || 'nowhere'}`);
    }
  }
  L.push(`Provinces (id: name, holder, walls): ${C.ids.map((p) => `${p}: ${C.prov[p].name}, ${s.prov[p].owner ?? 'free'}${s.prov[p].walls ? `, walls ${s.prov[p].walls}` : ''}`).join(' | ')}`);
  if (s.dead?.length) L.push(`DEAD (they cannot act or speak; never mention them as alive): ${s.dead.join(', ')}.`);
  const cards = cardsDue(C, s0);
  if (cards.length) L.push(`DECISIONS before the commander this season: ${cards.map((c) => `card ${c.id} "${c.title}": ${c.text} Options: ${c.options.map((o, i) => `${i} = ${o.label}`).join('; ')}${draft?.cards?.[c.id] !== undefined ? ` (already chosen: ${draft.cards[c.id]})` : ''}`).join(' || ')}`);
  return L.join('\n');
}
export const bestPlan = (C, facts) => plansFor(C, facts.defending).map((p) => [p, fitOf(facts, p)]).sort((x, y) => y[1] - x[1])[0][0];

// ---------- checking a proposal: whatever the AI (or anyone) proposes passes through here ----------
export function normalize(C, s0, draft, prop = {}) {
  const out = { orders: { ...(draft.orders ?? {}) }, raise: { ...(draft.raise ?? {}) }, cards: { ...(draft.cards ?? {}) }, peace: { ...(draft.peace ?? {}) }, aims: { ...(draft.aims ?? {}) } }, notes = [];
  for (const [id, n] of Object.entries(prop.cards ?? {})) {
    const c = cardsDue(C, s0).find((x) => x.id === id);
    if (c && Number.isInteger(+n) && c.options[+n]) out.cards[id] = +n;
  }
  const s = withCards(C, s0, out.cards); // orders are given in the world the cards make
  for (const id of Object.keys(out.orders)) if (!s.armies[id]) delete out.orders[id];
  for (const [id, o] of Object.entries(prop.orders ?? {})) {
    const a = s.armies[id];
    if (!a || a.side !== C.you) continue;
    if (o === null || o.to === null || o.to === a.at) { out.orders[id] = { to: null, plan: PLANS[o?.plan] ? o.plan : out.orders[id]?.plan ?? null, ...(o?.aid ? { aid: true } : {}) }; delete out.aims[id]; continue; }
    if (!C.prov[o.to]) continue;
    const r = reach(C, s, id);
    let to = o.to;
    if (!r[to]) { // too far this season: go as far as the road allows, and keep the aim for next season
      const way = wayTo(C, s, a.side, a.at, to);
      let step = null;
      for (const p of way?.slice(1) ?? []) if (r[p]) step = p; else break;
      notes.push(step ? `${C.prov[to].name} is beyond one season’s march for ${a.gen ?? 'that army'}: it goes as far as ${C.prov[step].name}, and on next season.` : `${a.gen ?? 'That army'} cannot reach ${C.prov[to].name} by any road open to it.`);
      if (!step) continue;
      out.aims[id] = to;
      to = step;
    } else delete out.aims[id];
    out.orders[id] = { to, plan: PLANS[o.plan] && plansFor(C, false).includes(o.plan) ? o.plan : null, storm: !!o.storm };
  }
  for (const [id, n] of Object.entries(prop.raise ?? {})) if ((id === '@home' || s.armies[id]?.side === C.you) && +n > 0) out.raise[id] = Math.round(+n);
  for (const [side, how] of Object.entries(prop.peace ?? {})) if (C.sides[side] && atWar(s, C.you, side) && !C.sides[side].noPeace) out.peace[side] = how ? 'offer' : undefined;
  return { draft: out, notes, state: s };
}

// ---------- the season's first counsel, by the rules: an order for every army, toward the aims already set ----------
export function proposal(C, s0, aims = {}, cards = {}) {
  const s = withCards(C, s0, cards), orders = autoOrders(C, s), out = {};
  for (const a of armiesOf(s, C.you)) {
    const aim = aims[a.id];
    if (aim && C.prov[aim] && s.prov[aim].owner !== C.you) out[a.id] = { to: aim }; // keep marching where the commander sent it
    else out[a.id] = orders[a.id] ?? { to: null };
  }
  return normalize(C, s0, { aims, cards }, { orders: out }).draft;
}

// ---------- understanding the commander, by the rules ----------
const PLAN_WORDS = [
  ['envelop', ['envelop', 'envelopment', 'pincer', 'encircle', 'surround', 'cannae']], ['phalanx', ['wings', 'phalanx', 'running', 'marathon']],
  ['ambush', ['ambush', 'trap', 'mist']], ['feint', ['feign', 'feigned', 'feint', 'lure']], ['narrows', ['narrows', 'pass', 'thermopylae']],
  ['hold', ['high', 'hill', 'hills', 'ground']], ['refuse', ['refuse', 'avoid', 'delay', 'fabian', 'shadow']], ['archers', ['archers', 'arrows', 'longbow', 'stakes']],
  ['guns', ['guns', 'cannon', 'cannons', 'bombard']], ['corps', ['hinge', 'corps', 'austerlitz']], ['dig', ['dig', 'trench', 'trenches']],
  ['barrage', ['barrage', 'artillery', 'shell']], ['blitz', ['tanks', 'armour', 'armor', 'blitz', 'panzer']], ['depth', ['depth', 'belts', 'mines']],
  ['wagons', ['wagon', 'wagons', 'wagenburg']], ['charge', ['charge', 'frontal', 'head']],
];
const MOVE = ['march', 'go', 'move', 'attack', 'take', 'besiege', 'siege', 'storm', 'assault', 'advance', 'invade', 'strike', 'seize', 'capture', 'relieve', 'cross', 'head', 'send', 'sail', 'fall', 'join', 'reinforce', 'rescue'];
const SUPPORT = /\b(join|support|reinforce|help|aid|assist|back up|rescue)\b/;
const HOLD = ['hold', 'stay', 'remain', 'wait', 'defend', 'guard', 'rest', 'stand', 'keep'];
function findPlace(C, ws, text) {
  let best = null;
  for (const p of Object.values(C.prov)) {
    const names = [p.id, ...words(p.name).filter((w) => !STOP.has(w) && w.length > 2)];
    for (const n of names) {
      if (ws.includes(n) || (n.length > 4 && ws.some((w) => w.length > 4 && (w.startsWith(n.slice(0, 5)) || n.startsWith(w.slice(0, 5)))))) {
        const at = fold(text).indexOf(n.slice(0, 5));
        if (!best || at > best.at) best = { id: p.id, at }; // the last place named is where they go
      }
    }
  }
  return best?.id ?? null;
}
function findArmies(C, s, ws) {
  const mine = armiesOf(s, C.you), hits = [];
  for (const a of mine) {
    const names = words(a.gen).filter((w) => !STOP.has(w) && w.length > 2);
    if (names.some((n) => ws.includes(n))) hits.push(a.id);
    else if (ws.includes(fold(C.prov[a.at].name).split(' ')[0]) && ws.includes('army')) hits.push(a.id);
  }
  if (['all', 'everyone', 'every', 'armies'].some((w) => ws.includes(w))) return mine.map((a) => a.id);
  return hits;
}
export function interpret(C, s, draft, text) {
  const t = fold(text), out = { orders: {}, raise: {}, cards: {}, peace: {} }, said = [], court = courtOf(C, s), advisor = court[0] ?? { id: 'advisor', name: 'Your adviser' };
  let end = /\b(end (the )?turn|make it so|so be it|proceed|carry on|go ahead|let it be done)\b/.test(t);
  const asking = /\?|^\s*(how|what|where|who|when|why|which|should|can|could|is|are|do|does|tell me)\b/.test(t);
  const sideWords = new Set(Object.values(C.sides).flatMap((d) => [...words(d.name), ...words(d.short)]));
  // the cards before you (a question is not an answer)
  for (const c of asking ? [] : cardsDue(C, s)) {
    let best = -1, score = 0;
    const tw = words(t), own = c.options.map((o) => words(o.label).filter((w) => !STOP.has(w) && w.length > 3 && !MOVE.includes(w) && !HOLD.includes(w) && !sideWords.has(w)));
    own.forEach((ow, i) => { // the option's own words, not the common ones every order uses; a word only it has counts double
      const hit = ow.reduce((n, w) => n + (tw.includes(w) ? (own.every((x, j) => j === i || !x.includes(w)) ? 2 : 1) : 0), 0) / Math.max(1, ow.length);
      if (hit > score) { score = hit; best = i; }
    });
    if (score < 0.5) best = -1;
    const only = cardsDue(C, s).filter((x) => draft.cards?.[x.id] === undefined).length === 1;
    if (best < 0 && only && /\b(yes|accept|agree|do it|very well|aye)\b/.test(t)) best = 0;
    if (best < 0 && only && /\b(no|refuse|reject|decline|never)\b/.test(t)) best = c.options.length - 1;
    if (best >= 0) { out.cards[c.id] = best; said.push({ who: advisor.id, text: `${c.title}: “${c.options[best].label}”. So it shall be.` }); }
  }
  // the orders: clause by clause, in the world the cards make
  const answered = Object.keys(out.cards).length;
  const ps = withCards(C, s, { ...(draft.cards ?? {}), ...out.cards });
  let last = []; // a clause that names no army speaks of the one named just before (“Leonidas, hold Sparta and come to the aid…”)
  for (const clause of t.split(/[;.\n]|,? (?:and then|then|while|but|and) /)) {
    const ws = words(clause);
    if (!ws.length) continue;
    const named = findArmies(C, ps, ws), place = findPlace(C, ws, clause);
    const ids = named.length ? named : /\b(we|us)\b/.test(clause) ? [] : last;
    if (named.length) last = named;
    if (answered && !ids.length) continue;
    const plan = PLAN_WORDS.find(([, kw]) => kw.some((k) => ws.includes(k)))?.[0];
    const raiseN = clause.match(/(?:raise|recruit|levy|hire|call up)\D*(\d[\d,.]*)\s*(k|thousand)?/);
    if (raiseN) {
      const n = Math.round(parseFloat(raiseN[1].replace(/,/g, '')) * (raiseN[2] ? 1000 : 1)) || 5000;
      const where = ids.find((id) => ps.prov[ps.armies[id].at].owner === C.you);
      out.raise[where ?? '@home'] = n < 100 ? n * 1000 : n;
      continue;
    }
    if (/\b(peace|terms|treat|truce)\b/.test(clause)) {
      for (const side of Object.keys(C.sides)) if (side !== C.you && atWar(s, C.you, side) && (words(C.sides[side].name).some((w) => ws.includes(w) && !STOP.has(w)) || ws.includes(side))) out.peace[side] = 'offer';
      continue;
    }
    // “Leonidas, support Miltiades”: whoever is named first goes where the one named after the word is going
    const sup = clause.match(SUPPORT);
    if (sup && !/\bif\b|\bwhen\b|sound of/.test(clause)) {
      const after = findArmies(C, ps, words(clause.slice(sup.index + sup[0].length))), before = findArmies(C, ps, words(clause.slice(0, sup.index)));
      const target = after.find((id) => !before.includes(id)), movers = (before.length ? before : heroOf(ps)?.side === C.you ? [heroOf(ps).id] : []).filter((id) => id !== target);
      const dest = target ? (out.orders[target]?.to ?? draft.orders?.[target]?.to ?? ps.armies[target].at) : place;
      if (dest && movers.length) { for (const id of movers) out.orders[id] = { to: dest, plan: plan ?? null }; continue; }
    }
    // “come to the aid of your friends if they are attacked”: hold, and march to the sound of the guns
    if (/\b(aid|help|support|sound of the guns)\b/.test(clause) && /\bif\b|\bwhen\b|ready|sound of/.test(clause)) {
      const movers = ids.length ? ids : heroOf(ps)?.side === C.you ? [heroOf(ps).id] : [];
      for (const id of movers) out.orders[id] = { to: null, plan: plan ?? null, aid: true };
      if (movers.length) continue;
    }
    const moving = MOVE.some((w) => ws.includes(w)), holding = HOLD.some((w) => ws.includes(w));
    const who = ids.length ? ids : (moving || holding || plan) && heroOf(ps)?.side === C.you ? [heroOf(ps).id] : [];
    for (const id of who) {
      if (holding && !moving) out.orders[id] = { to: null, plan: plan ?? null };
      else if (place) out.orders[id] = { to: place, plan: plan ?? null, storm: /\b(storm|assault)\b/.test(clause) };
      else if (plan) out.orders[id] = { ...(draft.orders?.[id] ?? { to: null }), plan };
    }
  }
  const { draft: next, notes, state: after } = normalize(C, s, draft, out);
  const changed = Object.keys(out.orders).length + Object.keys(out.raise).length + Object.keys(out.peace).length;
  for (const id of Object.keys(out.orders)) if (next.orders[id]) said.push({ who: after.armies[id]?.hero ? advisor.id : `army:${id}`, text: `${orderText(C, after, id, next.orders[id])}. It will be done.` });
  for (const [id, n] of Object.entries(out.raise)) said.push({ who: advisor.id, text: `We will raise ${fmtMen(n)} men${id === '@home' ? ` at ${C.prov[homeOf(C, s, C.you)]?.name ?? 'home'}` : ''}, if the treasury allows.` });
  for (const side of Object.keys(out.peace)) said.push({ who: advisor.id, text: `An envoy will ride to ${C.sides[side].name}. They will listen only if their will to fight is low (it is ${Math.round(s.sides[side].will)}).` });
  for (const n of notes) said.push({ who: advisor.id, text: n });
  const known = !changed && !Object.keys(out.cards).length && !end ? answer(C, s, t) : null;
  if (!changed && !Object.keys(out.cards).length && !end) said.push({ who: advisor.id, text: known ?? notUnderstood(C, s) });
  return { draft: next, replies: said, end, asking, known: !!known, notes, literal: out }; // literal: what the words themselves said, before any guessing
}

// What the player's side can raise this season, and what it costs.
export function raising(C, s) {
  const you = C.you, st = s.sides[you], cost = C.raiseCost ?? 10, up = C.upkeep ?? 2, home = homeOf(C, s, you);
  const can = Math.max(0, Math.min(C.sides[you].levy ?? 0, Math.floor(st.gold / cost) * 1000));
  return `We can raise up to ${fmtMen(can)} men this season${home ? `, gathering at ${C.prov[home].name}` : ''}: ${cost} gold for every thousand, and ${up} a season to keep them (the treasury holds ${Math.round(st.gold)}; our ${fmtMen(menOf(s, you))} men already cost ${Math.round((menOf(s, you) / 1000) * up)} a season).`;
}

// A question, answered from the war's data; null when it is not a question these rules know (the AI takes it then).
function answer(C, s, t) {
  const you = C.you, all = Object.keys(C.sides).filter((x) => s.sides[x].alive), foes = all.filter((x) => x !== you && atWar(s, you, x));
  const ws = words(t), named = all.filter((x) => x !== you).find((f) => [...words(C.sides[f].name), ...words(C.sides[f].short)].some((w) => !STOP.has(w) && w.length > 2 && ws.some((x) => x === w || (w.length > 4 && x.startsWith(w))))); // “Persians” is Persia
  const self = !named && /\b(we|our|us|ours|my|mine)\b/.test(t); // “can we raise more?” is about us
  const side = named ?? (self ? you : foes[0]), place = findPlace(C, ws, t), hero = heroOf(s)?.side === you ? heroOf(s) : armiesOf(s, you)[0];
  const P = (id) => C.prov[id].name, list = (id) => armiesOf(s, id).sort((a, b) => b.men - a.men).slice(0, 4).map((a) => `${a.gen ?? 'an army'} with ${fmtMen(a.men)} at ${P(a.at)}`).join('; ');
  if (/\b(raise|recruit|levy|levies|reinforce\w*|conscript|more (men|troops|soldiers|army|armies)|new (men|troops|army|levies))\b/.test(t)) return `${raising(C, s)} Say “raise 5,000 men”, and name an army if they should join it.`;
  if (/\b(ally|allies|allied|friends?|help|aid|support)\b/.test(t) && !named) {
    const friends_ = all.filter((x) => x !== you && friends(s, you, x)), neutral = all.filter((x) => x !== you && !friends(s, you, x) && !atWar(s, you, x));
    const f = friends_.map((x) => `${C.sides[x].name} (${fmtMen(menOf(s, x))} men, will ${Math.round(s.sides[x].will)}${foes.some((e) => atWar(s, x, e)) ? `, at war with ${foes.filter((e) => atWar(s, x, e)).map((e) => C.sides[e].short ?? C.sides[e].name).join(' and ')}` : ', not yet in the war'})`);
    return `${f.length ? `Our allies: ${f.join('; ')}. They fight beside us as they judge best; their armies move on their own.` : 'We have no allies in this war: we stand alone.'}${neutral.length ? ` ${neutral.map((x) => C.sides[x].name).join(', ')} ${neutral.length > 1 ? 'are' : 'is'} at peace with us, and may yet choose a side.` : ''}`;
  }
  if (/\b(gold|money|treasury|pay|afford|cost)\b/.test(t)) return `We have ${Math.round(s.sides[you].gold)} gold. ${raising(C, s)}`;
  if (place && hero && /\b(odds|chance|chances|win|beat|attack|fight|battle)\b/.test(t)) {
    const o = oddsOf(C, s, hero.id, place), r = reach(C, s, hero.id)[place];
    if (o.kind === 'battle') return `At ${P(place)} we would fight ${o.foes.map((id) => s.armies[id]?.gen ?? 'their army').join(' and ')}: odds ${o.ratio >= 0.9 && o.ratio < 1.1 ? 'about even' : o.ratio >= 1 ? `${o.ratio.toFixed(1)} to 1 for us` : `1 to ${(1 / o.ratio).toFixed(1)} against us`}, best with ${PLANS[bestPlan(C, o.facts)].name.toLowerCase()}.${r ? '' : ' It is beyond one season’s march.'}`;
    if (o.kind === 'siege') return `${P(place)} has walls: ${o.fed ? 'a port fed from the sea, which only a storm can take' : `a siege of about ${o.turns} seasons`}; storming it, our odds are ${o.ratio.toFixed(1)} to 1.`;
    return `No army stands at ${P(place)}${s.prov[place].owner && atWar(s, you, s.prov[place].owner) ? ': it is ours for the taking' : ''}.${r ? '' : ' It is beyond one season’s march.'}`;
  }
  if (place && /\b(siege|walls|storm|take|besiege)\b/.test(t) && hero) { const o = oddsOf(C, s, hero.id, place); if (o.kind === 'siege') return `${P(place)}: ${o.fed ? 'fed from the sea, so only a storm will take it' : `about ${o.turns} seasons of siege`}; a storm at odds of ${o.ratio.toFixed(1)} to 1.`; }
  if (side && /\b(who|leads?|leader|king|rules?)\b/.test(t) && !/\b(how many|where)\b/.test(t)) {
    const fallen = (s.dead ?? []).filter((n) => [C.sides[side].leader, ...armiesOf(s, side).map((a) => a.gen)].some((x) => x && x.includes(n)) || (C.sides[side].leader ?? '').startsWith(n));
    return `${C.sides[side].name} ${side === you ? 'is yours to lead' : `is led by ${leaderOf(C, s, side)}`}.${fallen.length ? ` ${fallen.join(' and ')} ${fallen.length > 1 ? 'are' : 'is'} dead.` : ''} ${side === you ? '' : `${relOf(s, you, side) === 'war' ? 'We are at war with them' : relOf(s, you, side) === 'ally' ? 'They are our allies' : 'We are at peace with them'}; their will to fight is ${Math.round(s.sides[side].will)}.`}`.trim();
  }
  if (side && /\b(how many|numbers|strength|strong|army|armies|where|enemy|enemies|they|them|men|troops|forces)\b/.test(t)) {
    if (side === you) return `We have ${fmtMen(menOf(s, you))} men: ${list(you) || 'no army in the field'}. Our will to fight is ${Math.round(s.sides[you].will)}.`;
    return `${C.sides[side].name}, led by ${leaderOf(C, s, side)}, has ${fmtMen(menOf(s, side))} men: ${list(side) || 'no army in the field'}. Their will to fight is ${Math.round(s.sides[side].will)}.`;
  }
  if (/\b(goal|win|victory|aim)\b/.test(t)) return `${C.goal.text}. ${goalState(C, s).text}.`;
  return null;
}
// Words the rules could not read: how to speak, with this war's own names.
function notUnderstood(C, s) {
  const you = C.you, foes = Object.keys(C.sides).filter((x) => x !== you && s.sides[x].alive && atWar(s, you, x));
  const g = goalState(C, s), other = armiesOf(s, you).find((a) => !a.hero && a.gen && isPersonName(a.gen)), foe = foes[0];
  const near = foe ? owned(s, foe).map((p) => C.prov[p].name)[0] : null;
  const eg = [other ? `“${other.gen.split(' ')[0]}, hold ${C.prov[other.at].name}”` : null, near ? `“we march on ${near}”` : null, '“raise 5,000 men”', foe && !C.sides[foe].noPeace ? `“offer peace to ${C.sides[foe].short ?? C.sides[foe].name}”` : null].filter(Boolean);
  return `Forgive me, I do not follow. Tell us what to do in plain words, ${eg.join(', ')}, or ask: where the enemy is, who leads them, what we can raise, what our allies do. ${g.text}.`;
}
const isPersonName = (n) => /^[A-Z]/.test(n) && !/\b(levies|chiefs|garrison|officers|men|army)\b/i.test(n);

// Three things the commander might say next, from the situation.
export function suggestions(C, s0, draft) {
  const out = [];
  for (const c of cardsDue(C, s0)) if (draft.cards?.[c.id] === undefined) out.push(c.options[c.advise ?? 0].label);
  const s = withCards(C, s0, draft.cards ?? {}), hero = heroOf(s) ?? armiesOf(s, C.you)[0];
  if (hero) {
    const r = Object.keys(reach(C, s, hero.id)).map((p) => [p, oddsOf(C, s, hero.id, p)]);
    const fight = r.filter(([, o]) => o.kind === 'battle').sort((a, b) => b[1].ratio - a[1].ratio)[0];
    const who = hero.hero ? 'We' : `${hero.gen.split(' ')[0]},`; // the commander speaks of his own army as “we”
    if (fight) out.push(`${who} attack at ${C.prov[fight[0]].name} with ${PLANS[bestPlan(C, fight[1].facts)].name.toLowerCase()}`);
    const take = r.filter(([p, o]) => o.kind !== 'battle' && s.prov[p].owner && atWar(s, C.you, s.prov[p].owner)).sort((a, b) => C.prov[b[0]].wealth - C.prov[a[0]].wealth)[0];
    if (take) out.push(`${who} march on ${C.prov[take[0]].name}`);
  }
  const foe = Object.keys(C.sides).find((x) => x !== C.you && atWar(s, C.you, x));
  if (foe) out.push(`Where are ${C.sides[foe].short ?? C.sides[foe].name}’s armies?`);
  return [...new Set(out)].slice(0, 3);
}
