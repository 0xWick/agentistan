// The cards: click anything on the map or in a panel and its card opens. A province, a realm, an army, a person,
// a war. Each card links to the others (a king's portrait opens the king, a war chip opens the war), with a back
// button to retrace the steps. And the great-event card, which stops the story to show what just happened.
import { PROV, PROVINCES, LAND, provincesOf, armiesOf, living, atWar, friendly, yieldOf, cavalryOf, rations, isWinter, dateText, yearOf, weatherOf, seasonName, ageOf, menOf,
  prosperityOf, steersman, rulingTemper, treatiesOf, INVENTIONS, fortuneOf, cityOf, placeOf, onRoad, yearLabel } from './engine.js';
import { TEMPER_TEXT } from './names.js';
import { isGreat } from './engine.js';
export { isGreat };
import { S, $, esc, icon, kindOf, worth, chip, personChip, pips, meter, sign, months, men, loyalColor, colorOf } from './ui.js';
import { portrait, paintedFor } from './portrait.js';

export const card = { kind: null, id: null, trail: [] };
const s = () => S.s;
const ageText = (c) => (c ? ageOf(s(), c) : '');

export function face(c, size = 56) {
  if (!c) return '';
  const src = paintedFor(c), r = s().realms[c.realm];
  return src ? `<img class="portrait painted" src="${src}" width="${size}" height="${size}" alt="">` : portrait(c, { color: r?.color ?? '#6a5032', age: ageOf(s(), c), size, uid: size });
}
const temperLine = (c) => {
  const t = TEMPER_TEXT[c?.ruleAs && c.role !== 'ruler' ? c.temper : c?.temper];
  return t ? `<span class="temper" title="${esc(t[1])}">${esc(t[0])}</span>` : '';
};
const warChip = (cid) => {
  const w = s().conflicts[cid] ?? warFromStory(cid);
  return w ? `<span class="chip war" data-war="${cid}">${icon('swords')}${esc(w.name.replace(/^The /, ''))}</span>` : '';
};

export function openCard(kind, id, at, { keepTrail = false } = {}) {
  if (card.kind && !keepTrail && (card.kind !== kind || card.id !== id)) card.trail.push({ kind: card.kind, id: card.id });
  if (!keepTrail && !card.kind) card.trail = [];
  card.trail = card.trail.slice(-8);
  Object.assign(card, { kind, id, at });
  refreshCard();
  const c = $('#card');
  c.hidden = false;
  if (at && innerWidth > 760) {
    const r = c.getBoundingClientRect();
    c.style.left = `${Math.min(innerWidth - r.width - 12, Math.max(12, at.x + 16))}px`;
    c.style.top = `${Math.min(innerHeight - r.height - 90, Math.max(80, at.y - 40))}px`;
  }
}
export function closeCard() {
  card.kind = null;
  card.trail = [];
  $('#card').hidden = true;
}
export function backCard() {
  const prev = card.trail.pop();
  if (!prev) return closeCard();
  Object.assign(card, prev);
  refreshCard();
}

export function refreshCard() {
  const c = $('#card'), html = { province, realm, army, char: person, war }[card.kind]?.(card.id);
  if (html === null || html === undefined) return closeCard();
  c.innerHTML = `<div class="card-top">${card.trail.length ? `<button class="back" aria-label="Back">${icon('prev')}</button>` : '<span></span>'}<button class="x" aria-label="Close">×</button></div>${html}`;
  c.dataset.kind = card.kind;
}

// ---------- a province ----------
const WORKS = { canal: ['rain', 'Canal: more grain'], caravanserai: ['palace', 'Caravanserai: more trade'], market: ['coin', 'Market: more gold'], library: ['book', 'Library: more learning'] };
// A deed already sealed on the chain links to the transaction that sealed it.
const sealLink = (m) => {
  const seal = S.chain?.seals?.find((x) => m >= x.from && m < x.to);
  return seal ? ` <a class="sealed" href="${S.chain.explorer}/tx/${seal.hash}" target="_blank" rel="noopener" title="Sealed on Base Sepolia">${icon('seal')}</a>` : '';
};
const CLIMATE = { cold: 'Cold lands', monsoon: 'Monsoon lands', arid: 'Dry lands', temperate: 'Temperate lands' };
const WEATHER = { snow: ['snow', 'Snow: slow marches, frostbite abroad, thin herds'], rains: ['rain', 'The rains: rivers flood, no campaigns'], heat: ['sun', 'Summer heat: armies in the desert wilt'] };
const HOW = { start: 'held at the start', conquest: 'by conquest', revolt: 'by revolt', secession: 'broke away', bribe: 'by a bribe', inheritance: 'by inheritance', verdict: 'by verdict', commune: 'self-rule', treaty: 'by treaty' };
function province(id) {
  const st = s(), p = PROV[id], q = st.provinces[id], r = st.realms[q.owner];
  const loyal = Math.round(q.loyalty), pros = Math.round(q.prosperity ?? 50);
  const here = Object.values(st.armies).filter((a) => a.at === id);
  const w = weatherOf(id, st.month), y = yieldOf(st, id), works = Object.keys(q.works ?? {});
  const deeds = (st.deeds[id] ?? []).slice(-5).reverse();
  return `<div class="who">${r ? chip(r.id) : 'Unclaimed land'}</div>
    <h3>${esc(cityOf(st, id))}</h3><p class="fa">${esc(st.names?.[id]?.fa ?? p.fa)}</p>
    <div class="stats">
      <span class="stat" title="Wealth">${icon('coin')}${pips(p.wealth, 5)}</span>
      <span class="stat" title="Walls">${icon('tower')}${pips(q.walls, 4)}</span>
      <span class="stat" title="Terrain">${icon('hill')}${esc(p.terrain)}</span>
    </div>
    <div class="bars">
      <span title="Loyalty of the people">${icon('people')}${meter(loyal, loyalColor(loyal))}<small>loyalty</small></span>
      <span title="Prosperity: peace, trade and works raise it; war, plague and famine ruin it">${icon('sun')}${meter(pros, pros < 30 ? '#8c6b3f' : pros > 65 ? '#b3852c' : '#6f8f4a')}<small>${pros < 30 ? 'poor' : pros > 65 ? 'thriving' : 'prosperity'}</small></span>
    </div>
    <div class="gives">${[['wheat', y.grain, 'grain this month'], ['horse', y.horses, 'horses a month'], ['anvil', y.iron, 'iron a month']].filter(([, v]) => v > 0).map(([i, v, t]) => `<span title="${t}">${icon(i)}${Math.round(v * 10) / 10}</span>`).join('')}<small>this month</small>${onRoad(st, id) ? `<span class="trade" title="Share of the Silk Road open to the caravans">${icon('palace')}${Math.round((st.trade?.[id] ?? 0) * 100)}% road</span>` : ''}</div>
    <div class="row season">${icon(WEATHER[w]?.[0] ?? (p.climate === 'cold' ? 'snow' : p.climate === 'monsoon' ? 'rain' : 'sun'))}<span>${esc(CLIMATE[p.climate])}</span> ${esc(WEATHER[w]?.[1] ?? `${seasonName(st.month)[0].toUpperCase()}${seasonName(st.month).slice(1)}: mild`)}</div>
    ${works.length || q.building ? `<div class="row works">${works.map((k) => `<span class="work" title="${WORKS[k][1]}">${icon(WORKS[k][0])}</span>`).join('')}${q.building ? `<span class="building">${icon('hammer')} a ${esc(q.building.kind)} rising · ${months(q.building.left)}</span>` : ''}</div>` : ''}
    ${q.siege ? `<div class="row alarm">${icon('tower')} Besieged by ${chip(q.siege.realm)} · ${months(q.siege.left)}</div>` : ''}
    ${here.length ? `<div class="row">${icon('banner')} ${here.map((a) => `<span class="chip" data-army="${a.id}"><i class="shield" style="--c:${colorOf(a.realm)}"></i>${men(a.size)}</span>`).join(' ')}</div>` : ''}
    ${deeds.length ? `<details class="deeds-reg"><summary>${icon('seal')} The registry of deeds</summary><ol>${deeds.map((d) => `<li><b>${yearLabel(yearOf(d.m, st))}</b> ${st.realms[d.realm] ? chip(d.realm) : esc(d.realm)} <small>${esc(HOW[d.how] ?? d.how)}</small>${sealLink(d.m)}</li>`).join('')}</ol>${S.chain ? `<p class="chain-note">Sealed each year on Base Sepolia: <a href="${S.chain.explorer}/address/${S.chain.address}" target="_blank" rel="noopener">the Chronicle contract</a></p>` : ''}</details>` : ''}
    <p class="fact">${esc(p.fact)}</p>`;
}

// ---------- a realm ----------
const END = { age: 'skull', battle: 'swords', assassin: 'dagger', overthrown: 'dagger', coup: 'dagger', poisoned: 'dagger', executed: 'dagger' };
function realm(id) {
  const st = s(), r = st.realms[id];
  if (!r) return null;
  const ruler = st.chars[r.ruler], heir = st.chars[r.heir], regent = st.chars[r.regent], vizier = st.chars[r.vizier], consort = st.chars[ruler?.spouse];
  const mine = provincesOf(st, id), soldiers = menOf(st, id);
  const wars = [...new Set(living(st).filter((o) => atWar(st, id, o.id)).map((o) => st.wars[[id, o.id].sort().join('|')]?.conflict).filter(Boolean))];
  const friends = living(st).filter((o) => o.id !== id && friendly(st, id, o.id)).map((o) => o.id);
  const generals = Object.values(st.chars).filter((c) => c.alive && c.realm === id && c.role === 'general').sort((a, b) => b.skill - a.skill);
  const leads = ruler?.army && st.armies[ruler.army] ? st.armies[ruler.army] : null;
  const pros = Math.round(prosperityOf(st, id)), fortune = fortuneOf(st, id);
  const tr = treatiesOf(st, id).filter((t) => t.pay);
  const p = r.plan ?? {}, aims = (p.targets ?? []).filter((t) => t !== 'neutral' && st.realms[t] && !st.realms[t].fallen);
  const temper = rulingTemper(st, r);
  const thoughts = [
    temper && TEMPER_TEXT[temper] ? `${TEMPER_TEXT[temper][0]}: ${TEMPER_TEXT[temper][1]}` : null,
    aims.length ? `Wants ${aims.slice(0, 3).map((t) => esc(st.realms[t].short)).join(', ')}` : null,
    (p.targets ?? []).includes('neutral') ? 'Eyes the free lands next door' : null,
    r.tax === 'high' ? 'Taxes are heavy' : r.tax === 'low' ? 'Taxes eased to calm the people' : null,
    r.charter > st.month ? 'Bound by a charter: no heavy taxes' : null,
  ].filter(Boolean);
  const said = p.said ? `<p class="voice">“${esc(p.said)}”</p>` : '';
  const past = (r.lineage ?? []).slice().reverse();
  const word = r.rep ?? 60;
  return `<div class="who"><i class="shield big" style="--c:${r.color}"></i>${r.rebel ? 'A rebellion' : r.origin === 'historic' ? `A power of ${yearLabel(st.startYear ?? 1200)}` : r.origin === 'commune' ? 'A free city' : `Founded ${yearLabel(yearOf(r.founded, st))}`}${r.golden > st.month ? `<span class="badge gold">${icon('sun')} Golden age</span>` : pros < 30 ? `<span class="badge poor">${icon('wheat')} Poverty</span>` : ''}</div>
    <h3>${esc(r.name)}</h3>${r.fa ? `<p class="fa">${esc(r.fa)}</p>` : ''}
    ${ruler ? `<div class="king" data-char="${ruler.id}">${face(ruler, 58)}<span><b>${esc(`${ruler.title ?? ''} ${ruler.name}${ruler.epithet ? ` ${ruler.epithet}` : ''}`.trim())}</b>
      <small>${temperLine(ruler)} aged ${ageText(ruler)}${ruler.since ? ` · since ${yearLabel(ruler.since)}` : ''}${leads ? ` · leads ${men(leads.size)} at ${esc(cityOf(st, leads.at))}` : ''}</small></span></div>` : '<div class="king"><b>No ruler</b></div>'}
    ${regent ? `<div class="row">${icon('crown')}<span>Regent</span> ${personChip(regent)} ${temperLine({ temper: regent.ruleAs ?? regent.temper })}</div>` : ''}
    <div class="family">
      ${consort?.alive ? `<span>${icon('rings')}${personChip(consort)} <small>${esc(consort.title ?? 'consort')}${consort.temper === 'schemer' ? ' · a schemer' : ''}</small></span>` : ''}
      ${heir ? `<span>${icon('circlet')}${personChip(heir)} <small>${esc(heir.relation ?? 'heir')} and heir, ${ageText(heir)}</small></span>` : ''}
      ${vizier?.alive ? `<span>${icon('scroll')}${personChip(vizier)} <small>${esc(vizier.title ?? 'vizier')} · ${esc(TEMPER_TEXT[vizier.temper]?.[0] ?? '')}</small></span>` : ''}
      ${(ruler?.kids ?? []).filter((k) => st.chars[k]?.alive && k !== r.heir).length ? `<span>${icon('people')}<small>${(ruler.kids).filter((k) => st.chars[k]?.alive && k !== r.heir).map((k) => personChip(st.chars[k])).join(' ')}</small></span>` : ''}
    </div>
    <div class="grid4">
      <span>${icon('castle')}<b>${mine.length}</b><small>provinces · ${Math.max(1, Math.round(mine.reduce((t, x) => t + x.area, 0) / LAND * 100))}% of the land</small></span>
      <span>${icon('palace')}<b>${esc(cityOf(st, r.capital) ?? '—')}</b><small>capital</small></span>
    </div>
    <div class="stores">
      <span title="Soldiers under arms">${icon('banner')}<b>${men(soldiers)}</b><small>soldiers</small></span>
      <span title="Gold in the treasury, and this month's balance">${icon('coin')}<b>${Math.round(r.gold)}</b><small>${sign(r.lastIncome)} gold</small></span>
      <span class="${(r.grain ?? 0) < soldiers * 1.2 && !r.nomad ? 'low' : ''}" title="Grain in the granaries; this month's harvest less what the armies ate">${icon('wheat')}<b>${Math.round(r.grain ?? 0)}</b><small>${sign(r.lastSupply?.grain)} grain</small></span>
      <span title="Horses, and the share of the army that rides">${icon('horse')}<b>${Math.round(r.horses ?? 0)}</b><small>${Math.round(cavalryOf(st, id) * 100)}% ride</small></span>
      <span title="Iron to arm new soldiers">${icon('anvil')}<b>${Math.round(r.iron ?? 0)}</b><small>${sign(r.lastSupply?.iron)} iron</small></span>
    </div>
    <div class="bars">
      <span title="How well the people live">${icon('sun')}${meter(pros, pros < 30 ? '#8c6b3f' : pros > 65 ? '#b3852c' : '#6f8f4a')}<small>prosperity</small></span>
      <span title="The realm's word: kept treaties raise it, broken ones and defied verdicts ruin it">${icon('seal')}${meter(word, word < 35 ? '#a3361f' : word > 70 ? '#2b7d7a' : '#b3852c')}<small>${word < 35 ? 'oathbreaker' : 'its word'}</small></span>
    </div>
    ${r.known?.length ? `<div class="row known">${icon('book')}${r.known.map((k) => `<span class="inv" title="${esc(INVENTIONS[k]?.name)}: ${esc(INVENTIONS[k]?.text)}">${icon(INVENTIONS[k]?.icon ?? 'book')}</span>`).join('')}</div>` : ''}
    ${wars.length ? `<div class="row">${icon('swords')}<span>At war</span> ${wars.map(warChip).join('')}</div>` : ''}
    ${friends.length ? `<div class="row">${icon('rings')}<span>Friends</span> ${friends.map(chip).join('')}</div>` : ''}
    ${tr.length ? `<div class="row">${icon('coin')}<span>Tribute</span> ${tr.map((t) => `${t.pay.from === id ? 'pays' : 'receives'} ${t.pay.gold} a month ${t.pay.from === id ? 'to' : 'from'} ${chip(t.pay.from === id ? t.pay.to : t.pay.from)}`).join('; ')}</div>` : ''}
    ${generals.length ? `<div class="row gens">${icon('helmet')}<span>Generals</span> ${generals.slice(0, 5).map((g) => personChip(g)).join('')}</div>` : ''}
    ${thoughts.length || said ? `<div class="mind"><b>${icon('eye')} In the ruler's mind</b>${thoughts.join('. ')}.${said}</div>` : ''}
    ${past.length ? `<details class="lineage"><summary>${icon('scroll')} The ${esc(r.dynasty ?? 'line')}: ${past.length} before</summary><ol>${past.map((l) => `<li><span>${esc(l.name)}${l.epithet ? ` <i>${esc(l.epithet)}</i>` : ''}</span><small>${yearLabel(l.since)}–${yearLabel(l.until)}</small>${l.cause && END[l.cause] ? `<i title="${esc(l.cause)}">${icon(END[l.cause])}</i>` : ''}</li>`).join('')}</ol></details>` : ''}`;
}

// ---------- an army ----------
function army(id) {
  const st = s(), a = st.armies[id];
  if (!a) return null;
  const r = st.realms[a.realm], g = st.chars[a.general], P = PROV[a.at], n = a.path.length;
  const lead = !a.general ? 'helmet' : a.general === r?.ruler ? 'crown' : a.general === r?.heir ? 'circlet' : 'helmet';
  const bt = st.battles[a.battle];
  const doing = bt ? ['swords', `In the battle at ${cityOf(st, a.at)} · month ${bt.rounds + 1} of the fighting`]
    : a.mode === 'siege' ? ['tower', `Besieging ${cityOf(st, a.at)} · ${months(st.provinces[a.at].siege?.left ?? 1)} to go`]
    : a.mode === 'garrison' ? ['castle', `Holding the walls of ${cityOf(st, a.at)}`]
    : a.rest > 0 ? ['swords', `Recovering from battle at ${cityOf(st, a.at)}`]
    : n ? ['banner', `Marching on ${cityOf(st, a.path[n - 1])} · ${n} ${n === 1 ? 'province' : 'provinces'} to go`]
    : isWinter(st.month) && !r.nomad ? ['snow', `In winter quarters at ${cityOf(st, a.at)}`]
    : ['banner', `Camped at ${cityOf(st, a.at)}`];
  const deeds = recent((e) => g && e.chars?.includes(g.id), 4);
  return `<div class="who">${chip(a.realm)}<span>${lead === 'crown' ? 'The ruler leads in person' : lead === 'circlet' ? 'Led by the heir' : a.free ? 'Knights who fight for plunder' : 'An army in the field'}</span></div>
    ${g ? `<div class="king" data-char="${g.id}">${face(g, 58)}<span><b>${esc(`${g.title ?? ''} ${g.name}${g.epithet ? ` ${g.epithet}` : ''}`.trim())}</b><small>${temperLine(g)} aged ${ageText(g)}${g.deeds?.wins ? ` · ${g.deeds.wins} victories` : ''}</small></span></div>` : '<div class="king"><b>No commander</b><small>its general has fallen</small></div>'}
    ${g ? `<div class="stats"><span class="stat" title="Skill in war">${icon('swords')}${pips(g.skill, 5)}</span>${(g.traits ?? []).map((t) => `<span class="trait">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="stores four">
      <span title="Soldiers">${icon('banner')}<b>${men(a.size)}</b><small>soldiers</small></span>
      <span title="Share that rides">${icon('horse')}<b>${Math.round(cavalryOf(st, a.realm) * 100)}%</b><small>ride</small></span>
      <span title="Grain this army eats each month">${icon('wheat')}<b>${r.nomad ? '—' : Math.round(rations(st, a) * 10) / 10}</b><small>${r.nomad ? 'lives on its herds' : 'grain a month'}</small></span>
      <span title="Spirit: battles won lift it, defeats and hunger sink it">${icon('flame')}<b>${Math.round(a.morale * 100)}%</b><small>spirit</small></span>
    </div>
    <div class="row doing">${icon(doing[0])}${esc(doing[1])}</div>
    ${bt?.war ? `<div class="row">${warChip(bt.war)}</div>` : ''}
    ${deeds.length ? `<ol class="deeds">${deeds.map(line).join('')}</ol>` : ''}`;
}

// ---------- a person ----------
const ROLE = { ruler: 'Ruler', heir: 'Heir', consort: 'Consort', vizier: 'Minister', general: 'General', child: 'Child of the house', courtier: 'At court', rebel: 'Rebel leader', exile: 'In exile' };
function person(id) {
  const st = s(), c = st.chars[id];
  if (!c) return null;
  const r = st.realms[c.realm], parent = st.chars[c.parentId], spouse = st.chars[c.spouse];
  const kids = (c.kids ?? []).map((k) => st.chars[k]).filter(Boolean);
  const t = TEMPER_TEXT[c.temper], d = c.deeds ?? {};
  const deeds = recent((e) => e.chars?.includes(id), 6);
  const army = st.armies[c.army];
  const ruling = r?.regent === id ? `Regent of ${esc(r.short)}` : null;
  return `<div class="who">${r ? chip(r.id) : ''}<span>${esc(c.alive ? ROLE[c.role] ?? c.role : `Died ${yearLabel(yearOf(c.died, st))}${c.cause ? ` · ${c.cause === 'age' ? 'of age' : c.cause}` : ''}`)}</span>${c.invented ? '<span class="badge" title="Not in the chronicles: invented by this age">new to history</span>' : ''}</div>
    <div class="person-head">${face(c, 96)}<div><h3>${esc(c.name)}</h3>${c.epithet ? `<p class="epithet">${esc(c.epithet)}</p>` : ''}<p class="sub">${esc(c.title ?? '')}${c.title ? ' · ' : ''}${c.alive ? `aged ${ageText(c)}` : `${yearLabel(c.born)}–${yearLabel(yearOf(c.died, st))}`}</p></div></div>
    ${t ? `<div class="mind"><b>${icon('eye')} ${esc(t[0])}</b>${esc(t[1][0].toUpperCase() + t[1].slice(1))}.${c.persona?.ambition ? ` ${esc(c.persona.ambition)}` : ''}</div>` : ''}
    ${c.persona?.voice ? `<p class="voice">“${esc(c.persona.voice)}”</p>` : ''}
    <div class="stats">${['general', 'ruler', 'heir'].includes(c.role) ? `<span class="stat" title="Skill">${icon('swords')}${pips(c.skill, 5)}</span>` : ''}${c.role !== 'ruler' && c.alive ? `<span class="stat" title="Loyalty to the crown">${icon('people')}${meter(c.loyalty, loyalColor(c.loyalty))}</span>` : ''}${(c.traits ?? []).map((x) => `<span class="trait">${esc(x)}</span>`).join('')}</div>
    ${ruling || army ? `<div class="row">${ruling ? `${icon('crown')}<span>${ruling}</span>` : ''}${army ? `${icon('banner')}<span class="chip" data-army="${army.id}"><i class="shield" style="--c:${colorOf(army.realm)}"></i>${men(army.size)} at ${esc(cityOf(st, army.at))}</span>` : ''}</div>` : ''}
    <div class="family">
      ${c.family ? `<span>${icon('scroll')}<small>${esc(c.family)}</small></span>` : ''}
      ${parent ? `<span>${icon('crown')}${personChip(parent)} <small>parent</small></span>` : c.parent ? `<span>${icon('crown')}<small>child of ${esc(c.parent)}</small></span>` : ''}
      ${spouse ? `<span>${icon('rings')}${personChip(spouse)} <small>${spouse.alive ? 'spouse' : 'late spouse'}</small></span>` : ''}
      ${kids.length ? `<span>${icon('circlet')}<small>${kids.map(personChip).join(' ')}</small></span>` : ''}
    </div>
    ${d.wins || d.losses || d.captures >= 1 || d.works || d.purges ? `<div class="deedrow">${d.wins ? `<span>${icon('swords')}${d.wins} won</span>` : ''}${d.losses ? `<span>${icon('skull')}${d.losses} lost</span>` : ''}${d.captures >= 1 ? `<span>${icon('castle')}${Math.floor(d.captures)} taken</span>` : ''}${d.works ? `<span>${icon('hammer')}${d.works} built</span>` : ''}${d.purges ? `<span>${icon('dagger')}${d.purges} purged</span>` : ''}</div>` : ''}
    ${deeds.length ? `<ol class="deeds">${deeds.map(line).join('')}</ol>` : ''}`;
}

// ---------- a war, told as a story ----------
export function warFromStory(cid) {
  const evs = allEvents((e) => e.war === cid);
  if (!evs.length) return null;
  const first = evs[0];
  return { id: cid, name: `The war of ${first.realms?.map((x) => s().realms[x]?.short).filter(Boolean).join(' and ')}`, why: '', by: first.realms?.[0], vs: first.realms?.[1], side: { [first.realms?.[0]]: 'a', [first.realms?.[1]]: 'b' }, since: first.month, ended: evs.find((e) => e.type === 'peace')?.month ?? null, score: { a: 0, b: 0 }, gains: {}, deaths: [] };
}
const BIG = new Set(['war', 'clash', 'battle', 'capture', 'storm', 'turncoat', 'peace', 'fallen', 'split', 'army.destroyed', 'death', 'revolt', 'siege']);
function war(cid) {
  const st = s(), w = st.conflicts[cid] ?? warFromStory(cid);
  if (!w) return null;
  const sides = { a: [], b: [] };
  for (const [rid, side] of Object.entries(w.side ?? {})) if (st.realms[rid]) sides[side].push(rid);
  const evs = allEvents((e) => e.war === cid && BIG.has(e.type)), shown = evs.length > 16 ? [...evs.slice(0, 4), null, ...evs.slice(-11)] : evs;
  const total = (w.score?.a ?? 0) + (w.score?.b ?? 0), shareA = total ? Math.round(((w.score?.a ?? 0) / total) * 100) : 50;
  const battles = evs.filter((e) => e.type === 'battle'), lost = battles.reduce((t, e) => t + (e.lost?.[0] ?? 0) + (e.lost?.[1] ?? 0), 0);
  const gains = Object.entries(w.gains ?? {}).filter(([, list]) => list.length);
  const treaty = st.treaties[w.treaty];
  const after = w.ended !== null ? allEvents((e) => e.month > w.ended && e.month <= w.ended + 24 && e.realms?.some((x) => x === w.by || x === w.vs) && ['crowned', 'fallen', 'revolt', 'coup', 'split', 'capital', 'golden', 'decline', 'uprising', 'separatist', 'war'].includes(e.type)).slice(0, 5) : [];
  return `<div class="who">${icon('swords')}<span>${w.ended !== null ? `${yearLabel(yearOf(w.since, st))}–${yearLabel(yearOf(w.ended, st))} · ${esc(w.outcome ?? 'ended')}` : `Raging since ${dateText(w.since, st)}`}</span></div>
    <h3>${esc(w.name)}</h3>
    ${w.why ? `<p class="why">${esc(w.why)}</p>` : ''}
    <div class="sides"><div>${sides.a.map(chip).join('')}</div><b>against</b><div>${sides.b.map(chip).join('')}</div></div>
    <div class="score" title="Who is winning: towns taken and battles won"><i style="width:${shareA}%;background:${colorOf(sides.a[0])}"></i><i style="width:${100 - shareA}%;background:${colorOf(sides.b[0])}"></i></div>
    <div class="deedrow"><span>${icon('swords')}${battles.length} battles</span><span>${icon('skull')}${men(lost)} fallen</span><span>${icon('castle')}${evs.filter((e) => e.type === 'capture').length} towns taken</span></div>
    <ol class="story">${shown.map((e) => (e ? line(e) : '<li class="gap">…</li>')).join('')}</ol>
    ${gains.length ? `<div class="row">${icon('castle')}<span>Gains</span> ${gains.map(([rid, list]) => `${chip(rid)} ${list.filter((pid) => st.provinces[pid].owner === rid).map((pid) => `<span class="town" data-prov="${pid}">${esc(cityOf(st, pid))}</span>`).join(', ') || '<small>nothing kept</small>'}`).join(' ')}</div>` : ''}
    ${treaty ? `<div class="row">${icon('seal')}<span>${esc(treaty.name)}</span> ${treaty.pay ? `${chip(treaty.pay.from)} pays ${treaty.pay.gold} gold a month to ${chip(treaty.pay.to)}` : ''}${treaty.broken ? ` <b class="alarm">broken by ${esc(st.realms[treaty.broken.by]?.short)}</b>` : ''}</div>` : ''}
    ${after.length ? `<div class="after"><b>${icon('scroll')} What came after</b><ol class="deeds">${after.map(line).join('')}</ol></div>` : ''}`;
}

// ---------- helpers for the stories ----------
export function allEvents(pred) {
  const out = [], story = S.story;
  for (let m = 0; m < s().month; m++) for (const e of story.events[m] ?? []) if (pred(e)) out.push(e);
  return out;
}
function recent(pred, n) {
  const out = [], story = S.story;
  for (let m = s().month - 1; m >= 0 && out.length < n; m--) for (const e of [...(story.events[m] ?? [])].reverse()) if (out.length < n && worth(e) && pred(e)) out.push(e);
  return out;
}
const line = (e) => `<li${e.war ? ` data-war="${e.war}"` : ''}><span style="color:${kindOf(e)[1]}">${icon(kindOf(e)[0])}</span><span>${esc(e.text)}<small>${esc(e.date)}</small></span></li>`;

// ---------- the great-event card ----------
// A great event stops the story at 1× with a picture, what happened, what it changed, and what follows from it.
export const ART = new Set();
const HEAD = {
  battle: (e) => `The Battle of ${cityOf(s(), e.at)}`, capture: (e) => `The Fall of ${cityOf(s(), e.at)}`, fallen: () => 'The End of a Realm', founded: () => 'A New Kingdom', split: () => 'The Realm Splits',
  separatist: () => 'A Governor Rebels', coup: () => 'A Coup', horde: () => 'The Great Khan', golden: () => 'A Golden Age', charter: () => 'The Charter', commune: () => 'A Free City',
  uprising: () => 'The People Rise', turncoat: () => 'Treachery on the Field', death: (e) => (e.cause === 'assassin' ? 'Murder' : 'A Ruler Dies'), invention: () => 'A Discovery',
  defied: () => 'A Verdict Defied', plague: () => 'Plague', famine: () => 'Famine', earthquake: () => 'Earthquake', flood: () => 'The Flood', ceded: () => 'A Verdict Obeyed', war: () => 'War', 'age.ended': () => 'The End of the Age', decline: () => 'Decline', marriage: () => 'A Royal Wedding',
};
const ARTKEY = { battle: 'battle', capture: 'siege', fallen: 'fallen', founded: 'crowned', split: 'split', separatist: 'split', coup: 'coup', horde: 'horde', golden: 'golden', charter: 'charter',
  commune: 'commune', uprising: 'uprising', turncoat: 'turncoat', invention: 'invention', defied: 'court', ceded: 'court', war: 'war', 'age.ended': 'crowned', decline: 'decline', marriage: 'wedding',
  plague: 'plague', famine: 'famine', earthquake: 'earthquake', flood: 'flood', raid: 'raid', peace: 'peace', built: 'built', toll: 'winter', revolt: 'uprising' };
export function artFor(e) {
  const k = e.type === 'death' ? (e.cause === 'assassin' ? 'assassin' : e.cause === 'battle' ? 'battle' : 'funeral') : e.type === 'war' && /Frankish|knights/.test(e.text) ? 'expedition' : ARTKEY[e.type];
  return k && ART.has(k) ? `/art/events/${k}.webp` : null;
}
export function eventCard(e, before, after, sameMonth) {
  const d = $('#event'), [ic, color] = kindOf(e), art = artFor(e);
  const realms = (e.realms ?? []).filter((id) => after.realms[id] || before.realms[id]).slice(0, 2);
  const stat = (st, id) => ({ n: provincesOf(st, id).length, men: menOf(st, id), gold: st.realms[id]?.gold ?? 0, fallen: !!st.realms[id]?.fallen });
  const arrow = (a, b, f = (x) => Math.round(x)) => `<span>${f(a)}</span><i class="${b > a ? 'up' : b < a ? 'down' : ''}">→</i><b>${f(b)}</b>`;
  const graph = realms.map((id) => {
    const b = stat(before, id), a = stat(after, id), r = after.realms[id] ?? before.realms[id];
    return `<div class="ig"><div class="ig-head"><i class="shield" style="--c:${r.color}"></i>${esc(r.short)}${a.fallen ? ' <b class="alarm">fallen</b>' : ''}</div>
      <div class="ig-row">${icon('castle')}${arrow(b.n, a.n)}</div><div class="ig-row">${icon('banner')}${arrow(b.men, a.men, men)}</div><div class="ig-row">${icon('coin')}${arrow(b.gold, a.gold)}</div></div>`;
  }).join('');
  const follows = sameMonth.filter((x) => x !== e && worth(x) && x.realms?.some((id) => realms.includes(id))).slice(0, 3);
  const who = (e.chars ?? []).map((id) => after.chars[id] ?? before.chars[id]).filter(Boolean)[0];
  d.querySelector('.panel').innerHTML = `
    <figure class="art" style="--c:${color}">${art ? `<img src="${art}" alt="">` : `<span class="art-seal">${icon(ic)}</span>`}${who ? `<span class="art-face">${face(who, 72)}</span>` : ''}</figure>
    <div class="ev-body">
      <p class="kicker" style="color:${color}">${icon(ic)} ${esc(e.date)}${e.at ? ` · ${esc(cityOf(after, e.at))}` : ''}</p>
      <h2>${esc((HEAD[e.type] ?? (() => 'News'))(e))}</h2>
      <p class="ev-text">${esc(e.text)}</p>
      ${e.said ? `<p class="voice">“${esc(e.said)}”</p>` : ''}
      ${graph ? `<div class="igs">${graph}</div>` : ''}
      ${follows.length ? `<ul class="follows">${follows.map((x) => `<li><span style="color:${kindOf(x)[1]}">${icon(kindOf(x)[0])}</span>${esc(x.text)}</li>`).join('')}</ul>` : ''}
      <div class="go"><button class="btn main" value="go">Continue</button>${e.war ? `<button class="btn" value="war" data-war="${e.war}">The war</button>` : realms[0] && after.realms[realms[0]] && !after.realms[realms[0]].fallen ? `<button class="btn" value="realm" data-realm="${realms[0]}">${esc(after.realms[realms[0]].short)}</button>` : ''}</div>
    </div>`;
  if (!d.open) d.showModal();
}

