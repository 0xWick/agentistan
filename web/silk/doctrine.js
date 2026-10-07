// Doctrine: how a ruler and his generals act when no AI is speaking for them. Every realm can always run on it;
// the AI cast (Part 2) replaces the plan with its own choices, and the generals still march by these rules.
import { RULES as R } from './rules.js';
import { PROV, PROVINCES, atWar, warOf, truceUntil, friendly, living, provincesOf, armiesOf, strength, route, wealthOf, wallPower, isWinter } from './engine.js';

const has = (c, ...t) => t.some((x) => c?.traits?.includes(x));

// The realms that share a border with this one, and whether unclaimed land lies next door.
export function neighbours(s, id) {
  const out = new Set();
  let neutral = false;
  for (const p of provincesOf(s, id)) for (const n of p.neighbors) {
    const o = s.provinces[n].owner;
    if (o === null) neutral = true;
    else if (o !== id) out.add(o);
  }
  return { realms: [...out].filter((o) => !s.realms[o]?.fallen), neutral };
}

export function plan(s, id, rng) {
  const r = s.realms[id], ruler = s.chars[r.ruler], me = strength(s, id);
  const bold = r.nomad || has(ruler, 'bold', 'ambitious', 'relentless', 'restless', 'proud');
  const cautious = has(ruler, 'cautious', 'timid', 'carefree', 'ailing');
  const { realms: next, neutral } = neighbours(s, id);
  const wars = living(s).filter((o) => atWar(s, id, o.id)).map((o) => o.id);
  const p = { until: s.month + 6 + Math.floor(rng() * 7), tax: 'normal', recruit: 0.5, war: [], peace: [], ally: [], targets: [...wars], power: null, hire: null, by: 'doctrine' };

  // Peace when a war goes badly or drags on with nothing to show.
  for (const w of wars) {
    const them = strength(s, w), since = warOf(s, id, w)?.since ?? s.month;
    if ((them > me * 1.4 && s.month - since > 10) || (s.month - since > R.diplomacy.peaceAfter && rng() < 0.4)) p.peace.push(w);
  }

  if (r.rebel) return { ...p, recruit: 0.9, targets: wars.filter((w) => w === r.cause), peace: [] };

  // The Mongols make war on everyone they touch; most neighbours of a horde think about bowing.
  if (r.id === 'mongol') return { ...p, war: next.filter((n) => !friendly(s, id, n)), targets: next.filter((n) => !friendly(s, id, n)), recruit: 1, peace: [], until: s.month + 4 };
  if (s.realms.mongol && !s.realms.mongol.fallen && next.includes('mongol') && !r.overlord && me < strength(s, 'mongol') * 0.4 && rng() < (cautious ? 0.3 : 0.1)) {
    return { ...p, submit: 'mongol', peace: [], targets: wars.filter((w) => w !== 'mongol') };
  }

  // Vassals break free when they outgrow their master; the weak bow to a crushing enemy.
  if (r.overlord && s.realms[r.overlord] && me > strength(s, r.overlord) * 0.9 && rng() < (bold ? 0.4 : 0.15)) p.independence = true;
  for (const w of wars) if (!r.overlord && me < strength(s, w) * 0.2 && provincesOf(s, id).length <= 3 && rng() < 0.08 && !s.realms[w].rebel) p.submit = w;

  // War on a weaker neighbour, if the ruler has the stomach for it.
  if (!r.nomad && wars.length < (bold ? 2 : 1) && rng() < (bold ? 0.3 : cautious ? 0.06 : 0.14)) {
    const prey = next.filter((n) => !atWar(s, id, n) && !friendly(s, id, n) && truceUntil(s, id, n) <= s.month && !s.realms[n].nomad && strength(s, n) * R.diplomacy.warRatio * (cautious ? 1.4 : 1) < me)
      .map((n) => ({ n, score: provincesOf(s, n).reduce((t, q) => t + q.wealth, 0) / Math.max(1, strength(s, n)) + rng() }))
      .sort((a, b) => b.score - a.score)[0];
    if (prey) p.war.push(prey.n), p.targets.push(prey.n);
  }
  if (neutral && wars.length < 2 && !r.nomad) p.targets.push('neutral');

  // A realm grown too big makes its neighbours close ranks.
  const giant = living(s).find((o) => o.id !== id && provincesOf(s, o.id).length >= PROVINCES.length * R.diplomacy.balance);
  if (giant && next.includes(giant.id)) for (const n of next) if (n !== giant.id && !s.realms[n].nomad && !atWar(s, id, n) && rng() < 0.5) p.ally.push(n);

  // Taxes and soldiers.
  const mine = provincesOf(s, id), avgLoyalty = mine.reduce((t, q) => t + s.provinces[q.id].loyalty, 0) / Math.max(1, mine.length);
  p.tax = avgLoyalty < 38 ? 'low' : (r.gold < 20 && wars.length) || has(ruler, 'greedy') ? 'high' : 'normal';
  p.recruit = wars.length ? (bold ? 0.85 : 0.7) : cautious ? 0.25 : 0.45;

  // One power move per reign, at a moment that suits it.
  if (!r.power && s.month >= 18 && rng() < 0.35) { // a reign's one great gamble is not made in its first months
    const enemy = Math.max(0, ...wars.map((w) => strength(s, w)));
    if (wars.length && me < enemy) p.power = 'levy';
    else if (avgLoyalty < 42) p.power = 'feast';
    else if (r.gold < 25 && mine.filter((q) => q.silk).length >= 2) p.power = 'silktax';
    else if (wars.length && has(ruler, 'cautious', 'steadfast', 'wise')) p.power = 'walls';
    else if (r.gold > 70 && rng() < 0.5) p.power = 'bribe';
  }

  // A schemer at war buys a dagger for the enemy's best man.
  if (wars.length && r.gold > R.agents.contractCost * 1.6 && rng() < (has(ruler, 'scheming', 'shrewd', 'cruel') ? 0.1 : 0.02)) {
    const foe = wars.map((w) => s.realms[w]).filter((o) => !o.rebel).sort((a, b) => strength(s, b.id) - strength(s, a.id))[0];
    const marks = foe && Object.values(s.chars).filter((c) => c.alive && c.realm === foe.id && ['ruler', 'general'].includes(c.role)).sort((a, b) => b.skill - a.skill);
    if (marks?.length) p.hire = (rng() < 0.4 ? marks.find((c) => c.role === 'ruler') : marks[0])?.id ?? null;
  }
  return p;
}

// Each month: where every army goes. Defend first, then take the best prize within reach.
export function orders(s, id, rng) {
  const r = s.realms[id], targets = new Set(r.plan?.targets ?? []);
  const hostileTo = (owner) => (owner === null ? targets.has('neutral') : targets.has(owner) && atWar(s, id, owner));
  const canEnter = (n) => {
    const o = s.provinces[n].owner;
    return friendly(s, id, o) || hostileTo(o) || (o !== null && atWar(s, id, o));
  };
  const claimed = new Set(armiesOf(s, id).filter((a) => a.target && a.mode !== 'idle').map((a) => a.target));
  const winter = isWinter(s.month) && !r.nomad; // settled armies keep to winter quarters
  for (const a of armiesOf(s, id)) {
    if (a.mode === 'siege' || a.rest > 0) continue;
    if (a.path.length && a.target && rng() < 0.85 && (s.provinces[a.target].owner === null ? targets.has('neutral') : atWar(s, id, s.provinces[a.target].owner))) continue;
    // An enemy army on our land, close by and not stronger: go and meet it, winter or not.
    const near = Object.values(s.armies).filter((e) => atWar(s, id, e.realm) && s.provinces[e.at].owner === id);
    const threat = near.map((e) => ({ e, way: route(s, id, a.at, e.at, canEnter) })).filter((x) => x.way && x.way.months <= 3 && a.size >= x.e.size).sort((x, y) => x.way.months - y.way.months)[0];
    if (threat) {
      Object.assign(a, { path: threat.way.path, target: threat.e.at, mode: 'march', eta: 0 });
      continue;
    }
    if (!a.path.length && (winter || rng() > R.campaign.start)) continue; // a campaign takes some deciding
    // The best prize: rich, weakly held, not too far, not already someone else's job.
    const prizes = PROVINCES.filter((p) => hostileTo(s.provinces[p.id].owner) && !claimed.has(p.id))
      .map((p) => {
        const owner = s.provinces[p.id].owner, cap = owner && s.realms[owner]?.capital === p.id;
        const d = Math.abs(p.xy[0] - PROV[a.at].xy[0]) + Math.abs(p.xy[1] - PROV[a.at].xy[1]);
        return { p, guess: wealthOf(s, p.id) * 2 + (cap ? 3 : 0) + (p.silk ? 1 : 0) - (wallPower(s, p.id) / Math.max(1, a.size)) * 4 - d / 90 };
      })
      .sort((x, y) => y.guess - x.guess).slice(0, 5);
    let best = null;
    for (const { p, guess } of prizes) {
      const way = route(s, id, a.at, p.id, canEnter);
      if (!way) continue;
      const score = guess - way.months * 1.2;
      if (!best || score > best.score) best = { p, way, score };
    }
    if (best && a.size >= R.armies.minSize * 1.5) {
      Object.assign(a, { path: best.way.path, target: best.p.id, mode: 'march', eta: 0 });
      claimed.add(best.p.id);
    } else if (!a.path.length && s.provinces[a.at].owner !== id) {
      const home = route(s, id, a.at, r.capital, (n) => friendly(s, id, s.provinces[n].owner));
      if (home) Object.assign(a, { path: home.path, target: null, mode: 'march', eta: 0 });
      else a.mode = 'idle';
    } else if (!a.path.length) a.mode = 'idle';
  }
}

export const brain = { planFor: plan, ordersFor: orders };
