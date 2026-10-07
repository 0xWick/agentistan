// What a realm lives on: gold, grain, horses and iron; how prosperous each province is; the caravans of the Silk
// Road, which pay only along its open stretches; and the works rulers build.
import { RULES as R } from './rules.js';
import { PROV, PROVINCES, onRoad, provincesOf, armiesOf, menOf, living, atWar, harvestOf, weatherOf, clamp, round1, rngFor, newChar, newArmy, say, poss, nameOf, cityOf, usedNames, yearOf, key, menText } from './core.js';
import { personName, pickTemper } from './names.js';

const T = (s, c, role, k) => R.temper[role]?.[s.chars[c]?.temper]?.[k];
// Whose temperament steers the realm: a regent rules in a child king's name.
export const steersman = (s, r) => (r.regent && s.chars[r.regent]?.alive ? s.chars[r.regent] : s.chars[r.ruler]);
export const rulingTemper = (s, r) => {
  const c = steersman(s, r);
  return R.temper.ruler[c?.ruleAs] ? c.ruleAs : c?.temper;
};
export const rulerTemper = (s, r, k) => R.temper.ruler[rulingTemper(s, r)]?.[k];
export const knows = (r, invention) => !!r?.known?.includes(invention);

export const wealthOf = (s, pid) => {
  const p = s.provinces[pid];
  const base = PROV[pid].wealth * (0.6 + (p.prosperity ?? 50) / 125);
  return Math.max(0.5, base - (p.ravaged > 0 ? 1.5 : 0) - (p.plague > 0 ? 1 : 0) - (p.famine > 0 ? 1 : 0));
};

// What a province gives this month besides gold: grain from its fields (most of it at harvest), horses from its
// pastures, iron from its hills.
export function yieldOf(s, pid, month = s.month) {
  const P = PROV[pid], q = s.provinces[pid], S = R.supply, hurt = q.famine > 0 ? 0 : q.ravaged > 0 ? 0.4 : 1;
  const r = s.realms[q.owner];
  const farming = 1 + (q.works?.canal ? R.works.canal.grain : 0) + (knows(r, 'windmill') ? 0.1 : 0) + (knows(r, 'rotation') ? 0.1 : 0);
  return {
    grain: round1((S.grain[P.terrain] ?? 1) * wealthOf(s, pid) * hurt * farming * harvestOf(pid, month)),
    horses: (S.horses[P.terrain] ?? 0) * (weatherOf(pid, month) === 'snow' ? 0.3 : 1),
    iron: S.iron[P.terrain] ?? 0,
  };
}
export function suppliesOf(s, id, month = s.month) {
  const t = { grain: 0, horses: 0, iron: 0 };
  for (const p of provincesOf(s, id)) for (const [k, v] of Object.entries(yieldOf(s, p.id, month))) t[k] += v;
  return t;
}
// A year's grain, on average: what the card shows as the realm's harvest.
export function yearlyGrain(s, id) {
  let t = 0;
  for (const p of provincesOf(s, id)) t += (R.supply.grain[p.terrain] ?? 1) * wealthOf(s, p.id) * 12;
  return round1(t);
}

// Grain an army eats this month: more far from home, more again in desert and mountains.
export function rations(s, a) {
  const S = R.supply, own = s.provinces[a.at].owner === a.realm, t = PROV[a.at].terrain;
  return a.size * S.eat * (own ? 1 : S.eatAbroad) * (['desert', 'mountains'].includes(t) ? S.eatHard : 1) * (s.realms[a.realm]?.nomad ? 0.5 : 1);
}
// Share of a realm's soldiers that ride: horses in the stables against men under arms.
export const cavalryOf = (s, id) => (s.realms[id]?.nomad ? 1 : clamp((s.realms[id]?.horses ?? 0) / Math.max(1, menOf(s, id) * R.supply.horsesPerK), 0, 1));

export const garrisonOf = (s, pid) => (R.garrison.base + R.garrison.perWealth * PROV[pid].wealth) * (s.realms[s.provinces[pid].owner]?.nomad ? R.economy.nomad.garrison : 1); // on the steppe every herder fights
export const wallPower = (s, pid) => garrisonOf(s, pid) * (1 + s.provinces[pid].walls ** 2 * R.walls.defence) * (R.battle.terrain[PROV[pid].terrain] ?? 1) * (0.5 + s.provinces[pid].loyalty / 100);
export function strength(s, id) {
  return menOf(s, id) + 0.3 * provincesOf(s, id).reduce((t, p) => t + garrisonOf(s, p.id), 0);
}
// Soldiers a realm can field: settled lands by their wealth; the steppe by its riders, one host per pasture.
export function manpower(s, id) {
  const nomad = s.realms[id]?.nomad;
  return provincesOf(s, id).reduce((t, p) => t + (nomad ? R.economy.nomad.riders : wealthOf(s, p.id) * R.economy.manpower) * (0.4 + s.provinces[p.id].loyalty / 160), 0);
}
export const recruitPrice = (s, r) => R.economy.recruitCost * (r.nomad ? R.economy.nomad.recruit : 1) * (r.reforms?.includes('army') ? 0.8 : 1);

// ---------- the Silk Road: caravans pay only along the stretches they can travel ----------
// A stretch breaks where two neighbouring cities on the road are at war with each other, besieged, or unclaimed.
export function tradeOpen(s, roads) {
  const open = {};
  for (const road of roads ?? []) {
    let run = [], prev = null;
    const flush = () => { for (const pid of run) open[pid] = Math.max(open[pid] ?? 0, run.length / road.length); run = []; };
    for (const pid of road) {
      const q = s.provinces[pid];
      if (!q.owner || q.siege) { flush(); prev = null; continue; }
      if (run.length && atWar(s, q.owner, prev)) flush();
      run.push(pid);
      prev = q.owner;
    }
    flush();
  }
  return open;
}

export function incomeOf(s, id) {
  const r = s.realms[id], tax = { low: 0.8, normal: 1, high: 1.3 }[r.tax] ?? 1;
  let g = 0;
  for (const p of provincesOf(s, id)) {
    const q = s.provinces[p.id];
    g += wealthOf(s, p.id) * R.economy.perWealth * (q.loyalty / 100) * tax * (q.works?.market ? 1 + R.works.market.gold : 1)
      + (onRoad(s, p.id) ? R.economy.trade * (s.trade?.[p.id] ?? 0) + (q.works?.caravanserai ? R.works.caravanserai.trade : 0) : 0)
      + (r.nomad && ['steppe', 'desert', 'mountains', 'forest'].includes(p.terrain) ? R.economy.nomad.herds : 0);
  }
  const vizier = s.chars[r.vizier];
  g *= (rulerTemper(s, r, 'income') ?? 1) * (vizier?.alive ? T(s, vizier.id, 'vizier', 'income') ?? 1 : 1)
    * (r.golden && r.golden > s.month ? 1.1 : 1) * (knows(r, 'credit') ? 1.08 : 1) * (r.reforms?.includes('tax') ? 1.1 : 1);
  return round1(g);
}

// ---------- each month: the treasury, the granaries, the stables and the forges ----------
export function economy(s, emit) {
  s.trade = tradeOpen(s, s.roads);
  for (const r of living(s)) {
    const horde = !!r.horde; // the horde lives off the land it rides through
    const income = incomeOf(s, r.id) + (r.id === 'alamut' ? R.agents.alamutDues : 0); // fear of Alamut's agents pays
    const upkeep = horde ? 0 : (menOf(s, r.id) - armiesOf(s, r.id).filter((a) => a.free).reduce((t, a) => t + a.size, 0)) * R.economy.upkeep * (r.nomad ? R.economy.nomad.upkeep : 1); // herds feed the steppe's riders
    let tribute = 0;
    if (r.overlord && s.realms[r.overlord] && !s.realms[r.overlord].fallen) {
      tribute = income * R.economy.tribute;
      s.realms[r.overlord].gold += tribute;
    }
    r.gold = round1(r.gold + income - upkeep - tribute);
    r.lastIncome = income;
    const y = suppliesOf(s, r.id), S = R.supply, mine = armiesOf(s, r.id);
    // The steppe eats its herds, not its granaries: a nomad host never starves, but its herds thin.
    const eaten = r.nomad ? 0 : mine.reduce((t, a) => t + rations(s, a), 0);
    if (r.nomad) r.horses = round1(Math.max(0, (r.horses ?? 0) - mine.reduce((t, a) => t + rations(s, a), 0) * 0.15));
    const snowy = provincesOf(s, r.id).filter((p) => weatherOf(p.id, s.month) === 'snow').length / Math.max(1, provincesOf(s, r.id).length);
    r.grain = round1((r.grain ?? 0) * (1 - S.spoil) + y.grain - eaten);
    r.horses = round1(Math.max(0, (r.horses ?? 0) * (1 - S.spoil - snowy * R.seasons.snow.herds) + y.horses));
    r.iron = round1((r.iron ?? 0) + y.iron);
    r.lastSupply = { grain: round1(y.grain - eaten), horses: round1(y.horses), iron: y.iron, eaten: round1(eaten), harvest: round1(y.grain) };
    const buy = (what, need) => { // merchants sell what the treasury can pay for
      const n = Math.min(need, Math.max(0, (r.gold - 15) / S.price[what]));
      if (n > 0) { r[what] = round1(r[what] + n); r.gold = round1(r.gold - n * S.price[what]); }
    };
    if (r.grain < eaten * 2) buy('grain', eaten * 3 - r.grain);
    if (r.grain < 0) { // hunger: soldiers desert or die, spirits sink
      r.grain = 0;
      for (const a of mine) {
        a.size = round1(a.size * (1 - S.starve));
        a.morale = clamp(round1(a.morale - 0.05), 0.7, 1.3);
      }
      if (s.month - (r.hungerSaid ?? -99) >= 36) {
        r.hungerSaid = s.month;
        emit('hunger', `${poss(r.short)} granaries are empty: the soldiers go hungry and desert`, { realms: [r.id] });
      }
    }
    if (r.gold < 0) { // unpaid soldiers walk home
      r.gold = 0;
      for (const a of mine) a.size = round1(a.size * 0.92);
      if (!r.broke && s.month - (r.brokeSaid ?? -99) >= 12 && (r.brokeSaid = s.month) >= 0) emit('broke', `${poss(r.short)} treasury is empty: unpaid soldiers desert`, { realms: [r.id] });
      r.broke = true;
    } else r.broke = false;
    // Recruiting, as the plan says: spare gold becomes soldiers, up to what the land can field and the treasury can
    // keep paying for.
    const men = menOf(s, r.id);
    const atWarNow = Object.keys(s.wars).some((k) => k.split('|').includes(r.id));
    const affordable = horde ? Infinity : (income * (atWarNow ? R.sustain.war : R.sustain.peace)) / (R.economy.upkeep * (r.nomad ? R.economy.nomad.upkeep : 1)) - men;
    const room = Math.min(manpower(s, r.id) - men, affordable);
    const share = (r.plan?.recruit ?? 0.5) * (rulerTemper(s, r, 'recruit') ?? 1);
    const price = recruitPrice(s, r);
    let recruits = Math.min(room, (Math.max(0, r.gold - 12) * share) / price);
    const ironPerK = R.supply.ironPerK * (knows(r, 'steel') ? 0.7 : 1);
    if (!r.nomad && r.iron < recruits * ironPerK) buy('iron', recruits * ironPerK - r.iron);
    if (!r.nomad) recruits = Math.min(recruits, r.iron / ironPerK);
    if (recruits >= 1) {
      if (!r.nomad) r.iron = round1(r.iron - recruits * ironPerK);
      raise(s, r, recruits, emit);
    }
    if (horde) for (const a of mine) a.size = round1(Math.min(a.size + 0.8, 40)); // the steppe sends riders
    for (const a of mine) if (a.rest > 0) a.rest--;
  }
  treaties(s, emit);
  works(s, emit);
}

function raise(s, r, men, emit) {
  r.gold = round1(r.gold - men * recruitPrice(s, r));
  const n = provincesOf(s, r.id).length, max = clamp(Math.floor(n / R.armies.perProvinces) + 1, R.armies.min, R.armies.max);
  const mine = armiesOf(s, r.id);
  const unbesieged = (pid) => s.provinces[pid]?.owner === r.id && !s.provinces[pid].siege && !Object.values(s.armies).some((b) => b.at === pid && atWar(s, r.id, b.realm));
  if (mine.length < max && men >= R.armies.minSize) {
    const rng = rngFor('age', s.age, 'raise', s.month, r.id);
    const free = Object.values(s.chars).find((c) => c.alive && c.realm === r.id && c.role === 'general' && !s.armies[c.army]);
    const gen = free?.id ?? newChar(s, { name: personName(rng, r.culture, usedNames(s)), role: 'general', realm: r.id, born: yearOf(s.month, s) - 25 - Math.floor(rng() * 15), traits: [], temper: pickTemper(rng, R.temper.general), skill: 1 + Math.floor(rng() * 4), culture: r.culture, invented: true });
    // Recruits gather where no siege can catch them: the capital if it is free, otherwise any free province.
    const at = unbesieged(r.capital) ? r.capital : provincesOf(s, r.id).find((p) => unbesieged(p.id))?.id;
    if (!at) return;
    newArmy(s, r.id, gen, at, men);
    emit('army.raised', `${say(s, r.id, 'raises')} an army of ${menText(men)} under ${nameOf(s, gen)}`, { realms: [r.id], at, chars: [gen] });
  } else if (mine.length) {
    const a = mine.filter((x) => !x.battle && unbesieged(x.at)).sort((x, y) => x.size - y.size)[0];
    if (a) a.size = round1(a.size + men);
  }
}

// ---------- prosperity: how well each province lives ----------
export function prosperity(s) {
  const P = R.prosperity;
  const armiesAt = {};
  for (const a of Object.values(s.armies)) (armiesAt[a.at] ??= []).push(a);
  for (const pr of PROVINCES) {
    const q = s.provinces[pr.id], r = s.realms[q.owner];
    if (!r) { q.prosperity = round1((q.prosperity ?? P.start) + (P.start - 10 - (q.prosperity ?? P.start)) * P.drift); continue; }
    const atWarNow = Object.keys(s.wars).some((k) => k.split('|').includes(r.id));
    let target = P.start + (atWarNow ? P.war : P.peace) + (r.capital === pr.id ? P.capital : 0) + P.perWork * Object.keys(q.works ?? {}).length + (P.tax[r.tax] ?? 0)
      + (onRoad(s, pr.id) ? P.trade * (s.trade?.[pr.id] ?? 0) : 0) + (q.conquered < -5 ? P.conquered : 0) + (r.golden && r.golden > s.month ? P.golden : 0);
    if (q.siege) target += P.siege;
    if ((armiesAt[pr.id] ?? []).some((a) => atWar(s, a.realm, q.owner))) target += P.enemyArmy;
    if (q.ravaged > 0) target += P.ravaged;
    if (q.plague > 0) target += P.plague;
    if (q.famine > 0) target += P.famine;
    q.prosperity = round1(clamp((q.prosperity ?? P.start) + (target - (q.prosperity ?? P.start)) * P.drift, 0, 100));
  }
}
export const prosperityOf = (s, id) => {
  const mine = provincesOf(s, id);
  return mine.length ? mine.reduce((t, p) => t + (s.provinces[p.id].prosperity ?? 50), 0) / mine.length : 0;
};

// ---------- works: canals, caravanserais, markets, libraries ----------
export function canBuild(s, id, pid, kind) {
  const W = R.works[kind], q = s.provinces[pid], P = PROV[pid], r = s.realms[id];
  if (!W || q.owner !== id || q.works?.[kind] || q.building || q.siege || r.gold < W.cost + 10) return false;
  if (W.terrain && !W.terrain.includes(P.terrain)) return false;
  if (W.silk && !onRoad(s, pid)) return false;
  if (W.wealth && P.wealth < W.wealth) return false;
  return true;
}
export function startWork(s, id, pid, kind, emit) {
  if (!canBuild(s, id, pid, kind)) return false;
  const r = s.realms[id];
  r.gold = round1(r.gold - R.works[kind].cost);
  s.provinces[pid].building = { kind, left: R.works[kind].months, by: r.ruler };
  return true;
}
const WORK_TEXT = { canal: 'digs a canal to water the fields of', caravanserai: 'raises a caravanserai for the caravans at', market: 'builds a great market in', library: 'founds a library in' };
function works(s, emit) {
  for (const pr of PROVINCES) {
    const q = s.provinces[pr.id], b = q.building;
    if (!b) continue;
    if (q.siege || !s.realms[q.owner]) { if (q.siege) b.left++; continue; } // war halts the masons
    if (--b.left > 0) continue;
    (q.works ??= {})[b.kind] = s.month;
    q.building = null;
    const who = s.chars[b.by];
    if (who) who.deeds.works++;
    emit('built', `${who?.alive ? nameOf(s, who.id) : say(s, q.owner, 'completes')} ${who?.alive ? WORK_TEXT[b.kind] : `a ${b.kind} at`} ${cityOf(s, pr.id)}`, { realms: [q.owner], at: pr.id, chars: who ? [who.id] : [], work: b.kind });
  }
}

// ---------- treaties that move gold: tribute and subsidies, paid every month like an escrow ----------
function treaties(s, emit) {
  for (const t of Object.values(s.treaties)) {
    if (t.ended !== null || !t.pay) continue;
    if (t.until !== null && s.month >= t.until) { t.ended = s.month; continue; }
    const from = s.realms[t.pay.from], to = s.realms[t.pay.to];
    if (!from || !to || from.fallen || to.fallen) { t.ended = s.month; continue; }
    const amount = Math.min(from.gold, t.pay.gold);
    from.gold = round1(from.gold - amount);
    to.gold = round1(to.gold + amount);
    t.paid = round1((t.paid ?? 0) + amount);
  }
}
export const treatiesOf = (s, id) => Object.values(s.treaties).filter((t) => t.ended === null && t.parties.includes(id));
export const pairTreaties = (s, a, b) => Object.values(s.treaties).filter((t) => t.ended === null && t.parties.includes(a) && t.parties.includes(b));
export { key };
