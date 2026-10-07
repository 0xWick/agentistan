// Battle plans: tactics from real battles, each fitting some ground, some armies and some weather. A ruler may order
// one for his side, or trust his general, who picks by his skill and his temperament. A plan that fits the battle
// adds up to R.tactics.bonus to the side's strength; one that does not costs up to R.tactics.penalty. How well the
// general carries it out depends on his skill.
import { RULES as R } from './rules.js';
import { PROV, weatherOf, friendly, clamp } from './core.js';
import { cavalryOf, knows } from './economy.js';

export const TACTICS = {
  charge: { name: 'Frontal charge', hint: 'Strength against strength: best with more men, on open ground', example: 'Hastings' },
  hold: { name: 'Hold the high ground', hint: 'Make them climb to you: for defenders in hills, mountains or forest', example: 'the shield wall at Hastings' },
  feint: { name: 'Feigned retreat', hint: 'The horsemen flee, then turn on their pursuers: needs cavalry and open ground', example: 'the Mongols at the Kalka' },
  envelop: { name: 'Double envelopment', hint: 'Let the centre give way and close the wings: for a slightly smaller army with good horse', example: 'Cannae' },
  river: { name: 'Hold the crossing', hint: 'Strike them while they are half across the water: for defenders on a river', example: 'Stirling Bridge' },
  archers: { name: 'Archers behind stakes', hint: 'Let the horsemen charge into the arrows: for defenders, best in rain and mud', example: 'Agincourt' },
  fabian: { name: 'Refuse battle, burn the land', hint: 'Fall back and let hunger fight for you: for the weaker side on its own ground', example: 'Fabius against Hannibal' },
  night: { name: 'Night attack', hint: 'A blow in the dark: for a smaller army with a skilled general', example: 'the Night Attack of Târgoviște' },
  barrage: { name: 'Barrage, then advance', hint: 'The guns first, then the infantry: needs heavy artillery', example: 'the Somme' },
  dig: { name: 'Dig in', hint: 'Trenches and machine guns: for defenders', example: 'Verdun' },
  armour: { name: 'Tanks break through', hint: 'Armour across the trenches, on open ground', example: 'Cambrai' },
};
export const MEDIEVAL = ['charge', 'hold', 'feint', 'envelop', 'river', 'archers', 'fabian', 'night'];
export const tacticsOf = (s) => s.tactics ?? MEDIEVAL;

const sum = (s, ids, at) => ids.map((id) => s.armies[id]).filter((a) => a && a.at === at).reduce((t, a) => t + a.size, 0);
const lead = (s, ids, at) => ids.map((id) => s.armies[id]).filter((a) => a && a.at === at).sort((x, y) => y.size - x.size)[0];
// How well a plan fits this side of this battle, from −1 (a disaster) to 1 (made for it).
export function fitOf(s, bt, side, id) {
  const P = PROV[bt.at], mine = side === 'a' ? bt.a : bt.d, theirs = side === 'a' ? bt.d : bt.a;
  const realm = (side === 'a' ? bt.ra : bt.rd)[0], foe = (side === 'a' ? bt.rd : bt.ra)[0], r = s.realms[realm];
  const ratio = sum(s, mine, bt.at) / Math.max(0.1, sum(s, theirs, bt.at));
  const open = ['plains', 'river', 'desert', 'steppe'].includes(P.terrain), rough = ['hills', 'mountains', 'forest'].includes(P.terrain);
  const defending = side === 'd', home = friendly(s, realm, s.provinces[bt.at].owner) || s.provinces[bt.at].owner === realm;
  const cav = cavalryOf(s, realm), theirCav = cavalryOf(s, foe), w = weatherOf(bt.at, s.month);
  const g = s.chars[lead(s, mine, bt.at)?.general], skill = g?.skill ?? 2, foeTemper = s.chars[lead(s, theirs, bt.at)?.general]?.temper;
  switch (id) {
    case 'charge': return clamp((ratio - 1.1) * 1.5 + (open ? 0.2 : rough ? -0.6 : 0), -1, 1);
    case 'hold': return defending ? (rough ? 0.8 : 0.1) : -0.6;
    case 'feint': return cav >= 0.35 && open ? clamp(0.5 + (foeTemper === 'glory' ? 0.35 : 0), -1, 1) : -0.6;
    case 'envelop': return ratio < 0.6 ? -0.8 : ratio <= 1.15 && cav >= 0.2 && open ? 0.8 : -0.3;
    case 'river': return defending && P.terrain === 'river' ? 0.9 : -0.5;
    case 'archers': return defending ? clamp((['rains', 'snow'].includes(w) ? 0.5 : 0.1) + (theirCav >= 0.3 ? 0.3 : -0.2) + (knows(r, 'crossbow') ? 0.2 : 0), -1, 1) : -0.6;
    case 'fabian': return ratio < 0.8 && home ? clamp(0.6 + (w === 'snow' ? 0.3 : 0), -1, 1) : -0.4;
    case 'night': return skill >= 4 && ratio <= 1.1 ? 0.6 : skill <= 2 ? -0.7 : -0.1;
    case 'barrage': return knows(r, 'artillery') ? (defending ? 0.3 : 0.7) : -0.8;
    case 'dig': return defending ? (knows(r, 'machineguns') ? 0.8 : 0.3) : -0.7;
    case 'armour': return knows(r, 'tanks') && open && !defending ? 0.9 : -0.8;
  }
  return 0;
}
// The general's own choice: a skilled one sees the right plan; his temperament leans him towards some.
const LEAN = { glory: ['charge', 'night'], butcher: ['charge'], cautious: ['hold', 'fabian', 'dig'], steady: ['hold', 'dig'], treacherous: ['fabian'], mercenary: ['fabian'] };
export function generalsChoice(s, bt, side, rng) {
  const mine = side === 'a' ? bt.a : bt.d, g = s.chars[lead(s, mine, bt.at)?.general], skill = g?.skill ?? 2;
  const ranked = tacticsOf(s).map((id) => ({ id, v: fitOf(s, bt, side, id) + ((LEAN[g?.temper] ?? []).includes(id) ? 0.3 : 0) + rng() * (6 - skill) * 0.25 })).sort((a, b) => b.v - a.v);
  return ranked[0].id;
}
// What the plan adds to (or takes from) the side's strength this month.
export function planFactor(s, bt, side) {
  const t = bt.tactic?.[side];
  if (!t) return 1;
  const mine = side === 'a' ? bt.a : bt.d, skill = s.chars[lead(s, mine, bt.at)?.general]?.skill ?? 2;
  const fit = fitOf(s, bt, side, t.id), T = R.tactics;
  return 1 + (fit > 0 ? T.bonus * fit : T.penalty * fit) * (0.6 + 0.1 * skill);
}
