// Ruling a realm. In the living world anyone may seize a free throne (the coup takes effect at the turn of the quarter)
// and then rules from the council: an hour of reflection after each quarter, then the council stays open until the
// quarter turns. The matters before the ruler, what his vizier advises, his standing orders; whatever he leaves, the
// vizier decides, as the ruler's persona would. Private games (?game=<id>) still run month by month.
import { S, $, esc, icon, chip, personChip, meter, sign, men, loyalColor } from './ui.js';
import { living, provincesOf, armiesOf, menOf, atWar, allied, steersman, claimsOf, cityOf, placeOf, dateText, prosperityOf } from './engine.js';
import { incomeOf } from './economy.js';
import { RULES } from './rules.js';
import { TEMPER_TEXT } from './names.js';
import { neighbours, bestWork } from './doctrine.js';
import { portrait } from './portrait.js';
import { ageOf, ofR } from './core.js';

export const GAME = new URLSearchParams(location.search).get('game');
export const API = GAME ? `/api/game/${encodeURIComponent(GAME)}/era` : '/api/era';
const KEY = `agentistan:seat:${GAME ?? 'live'}`;
const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private window */ } } };
const post = (u, body) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({})));
let me = null, seats = [], council = null, draft = null, saving = 0;
const POWER = { levy: 'Great Levy: every village sends its sons', walls: 'Mighty Walls round the capital', bribe: 'Bribe a neighbouring governor', feast: 'A Royal Feast for the people', silktax: 'A Silk Tax on the caravans' };
const RULERS = ['conqueror', 'builder', 'diplomat', 'just', 'reformer', 'miser', 'paranoid', 'hedonist', 'tyrant', 'negligent'];
const CARD = { peace: ['scroll', 'An offer of peace'], match: ['rings', 'A match'], verdict: ['scales', "The arbiter's verdict"], pretender: ['crown', 'A pretender'], ambition: ['swords', 'An ambitious general'], unrest: ['flame', 'A restless province'], famine: ['wheat', 'Famine'] };
const SAY = { accept: 'Accept', refuse: 'Refuse', defy: 'Defy', pay: 'Pay him off', hunt: 'Hunt him down', ignore: 'Ignore it', reward: 'Reward him', dismiss: 'Dismiss him', grant: 'Ease the taxes', garrison: 'Send soldiers', relief: 'Send relief' };
const left = (t) => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return m >= 90 ? `${Math.round(m / 60)} h` : m >= 60 ? `1 h${m > 60 ? ` ${m - 60} min` : ""}` : `${m} min`; };
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const seatsByRealm = () => Object.fromEntries(seats.map((x) => [x.realm, x]));
export const myRealm = () => me?.realm ?? null;
export async function loadSeats() {
  const d = await fetch(`${API}/seats`).then((r) => r.json()).catch(() => null);
  seats = d?.seats ?? [];
  const token = store.get();
  me = token ? await post(`${API}/me`, { token }).then((x) => (x.realm ? { ...x, token } : null)) : null;
  if (token && !me) store.set(null); // the throne was lost: the seat is gone
  S.mine = me?.realm ?? null;
  badge();
}
export function onSeats(list) { seats = list ?? seats; if (!$('#rule').hidden) render(); }

export async function openRule(realm) {
  if (!GAME && me) return openCouncil();
  $('#rule').hidden = false;
  $('#rule-btn').setAttribute('aria-pressed', 'true');
  await loadSeats();
  if (!GAME && me) { closeRule(); return openCouncil(); }
  render(realm);
}
export function closeRule() {
  $('#rule').hidden = true;
  $('#rule-btn').setAttribute('aria-pressed', 'false');
}
export async function refreshRule() {
  if (!$('#rule').hidden) { await loadSeats(); render(); }
  if ($('#council').open) await openCouncil(true);
  else if (me && !GAME) { council = await post(`${API}/council`, { token: me.token }); badge(); }
}
function badge() {
  const b = $('#rule-btn');
  if (!b) return;
  const n = council && council.phase === 'council' && !council.ended ? council.cards.length : 0;
  b.querySelector('span').textContent = GAME ? 'Play' : me ? 'Council' : 'Seize a throne';
  b.dataset.badge = n ? String(n) : '';
}

// ---------- seizing a throne ----------
async function render(pre) {
  const box = $('#rule-body'), s = S.s;
  if (GAME) return renderGame(box, s);
  $('#rule-title').lastChild.textContent = 'Seize a throne';
  const taken = new Set([...seats.map((x) => x.realm), ...Object.keys(s.players ?? {})]);
  const free = living(s).map((r) => [r, provincesOf(s, r.id).length]).filter(([r, n]) => n > 0 && !taken.has(r.id) && !r.rebel).sort((a, b) => b[1] - a[1]);
  const q = S.era?.quarter;
  box.innerHTML = `<p class="sub">Take a realm of the living world by a sudden coup, and rule it with everyone else, quarter by quarter.</p>
    <ul class="how"><li>${icon('clock')} A quarter every 6 hours: an hour to see what happened, then your council is open until the quarter turns.</li>
      <li>${icon('scroll')} Matters come to you as cards; give your orders, then end your turn.</li>
      <li>${icon('eye')} What you leave undecided, your vizier decides as you would. Stay away for days, and he takes his share, and then your throne.</li></ul>
    ${seats.length ? `<div class="row">${icon('crown')}<span>Ruled by players</span> ${seats.map((x) => `${chip(x.realm)}`).join(' ')}</div>` : ''}
    <form id="claim-form" class="rule-form">
      <label><span>${icon('banner')} The realm</span><select name="realm">${free.map(([r, n]) => `<option value="${r.id}"${r.id === pre ? ' selected' : ''}>${esc(r.name)} · ${n} provinces</option>`).join('')}</select></label>
      <label><span>${icon('crown')} Your name</span><input name="name" maxlength="32" required placeholder="As the chronicles shall call you"></label>
      <label class="check"><input type="checkbox" name="female"> I rule as a queen</label>
      <label><span>${icon('star')} Your temperament</span><select name="temper">${RULERS.map((t) => `<option value="${t}">${esc(TEMPER_TEXT[t][0])}: ${esc(TEMPER_TEXT[t][1])}</option>`).join('')}</select></label>
      <label><span>${icon('quill')} In a line: who are you?</span><input name="line" maxlength="160" placeholder="A soldier of the frontier who trusts no one"></label>
      <label><span>${icon('bell')} Discord webhook <small>(optional: the council calls you)</small></span><input name="webhook" placeholder="https://discord.com/api/webhooks/…"></label>
      <button class="btn main wide">${icon('dagger')} Plot the coup</button>
    </form>
    <p class="fine">The coup takes effect when the quarter turns${q ? `, at ${hhmm(q.ends)}` : ''}. You can give your first orders at once.</p>`;
  $('#claim-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), d = await post(`${API}/claim`, { ...f, female: !!f.female });
    if (!d.token) return box.insertAdjacentHTML('afterbegin', `<p class="note">${esc(d.error ?? 'That did not work.')}</p>`);
    store.set(d.token);
    await loadSeats();
    closeRule();
    openCouncil();
  };
}
document.addEventListener('click', (e) => { // "Seize this throne" on a realm's card
  const b = e.target.closest('[data-seize]');
  if (b) openRule(b.dataset.seize);
  if (e.target.closest('[data-council]')) openCouncil();
});

// ---------- the council ----------
export async function openCouncil(quiet = false) {
  if (!me) return;
  council = await post(`${API}/council`, { token: me.token });
  if (council.error) { store.set(null); me = null; S.mine = null; badge(); return; }
  if (!quiet || !draft) draft = { acts: council.draft?.acts ?? [], answers: { ...(council.draft?.answers ?? {}) }, tax: council.draft?.tax ?? null };
  badge();
  const d = $('#council');
  d.innerHTML = `<div class="panel">${councilHTML()}</div>`;
  wireCouncil(d);
  if (!d.open) d.showModal();
}

function councilHTML() {
  const s = S.s, r = s.realms[council.realm], who = steersman(s, r), c = council;
  if (!r || r.fallen) return `<button class="x" data-close>×</button><h2>Your realm is no more</h2><p class="sub">${esc(c.name)}'s house has fallen. Seize another throne whenever you like.</p>`;
  const open = c.phase === 'council', mine = provincesOf(s, r.id), inc = incomeOf(s, r.id);
  const loyal = mine.reduce((t, p) => t + s.provinces[p.id].loyalty, 0) / Math.max(1, mine.length);
  const wars = living(s).filter((o) => atWar(s, r.id, o.id)), friends = living(s).filter((o) => allied(s, r.id, o.id)), vassals = living(s).filter((o) => o.overlord === r.id);
  const threats = Object.values(s.armies).filter((a) => atWar(s, r.id, a.realm) && (s.provinces[a.at].owner === r.id || mine.some((p) => p.neighbors.includes(a.at))));
  const away = c.missed > c.grace ? `<p class="warn">${icon('eye')} You have missed ${c.missed} councils: your vizier grows bold, the treasury thins and the governors drift.</p>` : '';
  const when = open ? `${icon('clock')} Council open · the quarter turns in ${left(c.ends)} (${hhmm(c.ends)})` : `${icon('book')} Reflection · the council opens in ${left(c.opens)} (${hhmm(c.opens)})`;
  return `<button class="x" data-close aria-label="Close">×</button>
  <header class="c-head">
    ${who ? portrait(who, { color: r.color, age: ageOf(s, who), size: 64, uid: 'council' }) : ''}
    <div><h2>The council of ${esc(ofR(s, r.id))}</h2>
      <p class="sub">${esc(who?.title ?? '')} ${esc(who?.name ?? '')}${who && !who.player && c.seized ? '' : ''} · ${esc(dateText(s.month, s))} · played by ${esc(c.name)}</p>
      <p class="when ${open ? 'on' : ''}">${when}</p></div>
    ${c.ended ? `<span class="sealed">${icon('seal')} Orders sealed</span>` : ''}
  </header>
  ${c.seized ? '' : `<p class="note">${icon('dagger')} Your coup is set for the turn of the quarter. Your first orders go out with it.</p>`}
  ${away}
  <div class="c-grid">
    <section class="c-realm">
      <h3>${icon('banner')} The realm</h3>
      <div class="tiles">
        <div><b>${mine.length}</b><small>provinces</small></div>
        <div><b>${men(menOf(s, r.id))}</b><small>soldiers</small></div>
        <div><b>${Math.round(r.gold)}</b><small>gold ${sign(inc)}/mo</small></div>
        <div><b>${Math.round(r.grain ?? 0)}</b><small>grain</small></div>
      </div>
      <p class="m">prosperity ${meter(prosperityOf(s, r.id), '#4f7a3a')}</p>
      <p class="m">loyalty ${meter(loyal, loyalColor(loyal))}</p>
      <p class="m">its word ${meter(r.rep ?? 60, '#b3852c')}</p>
      ${wars.length ? `<p class="row">${icon('swords')} At war: ${wars.map((o) => chip(o.id)).join(' ')}</p>` : '<p class="row">At peace</p>'}
      ${friends.length ? `<p class="row">${icon('rings')} Allies: ${friends.map((o) => chip(o.id)).join(' ')}</p>` : ''}
      ${vassals.length ? `<p class="row">${icon('scroll')} Client states: ${vassals.map((o) => chip(o.id)).join(' ')}</p>` : ''}
      ${r.overlord ? `<p class="row">${icon('scroll')} You bow to ${chip(r.overlord)}</p>` : ''}
      ${threats.length ? `<p class="row warn">${icon('flame')} Enemy armies at the border: ${threats.map((a) => `${men(a.size)} of ${esc(s.realms[a.realm]?.short)} at ${esc(cityOf(s, a.at))}`).join('; ')}</p>` : ''}
      <h3>${icon('swords')} Armies</h3>
      <ul class="armies">${armiesOf(s, r.id).map((a) => `<li>${men(a.size)} at ${esc(cityOf(s, a.at))}${s.chars[a.general] ? ` · ${personChip(s.chars[a.general])}` : ''}${a.battle ? ` · ${icon('swords')} in battle` : a.mode === 'siege' ? ' · besieging' : a.target ? ` · marching on ${esc(cityOf(s, a.target))}` : ''}</li>`).join('') || '<li>none</li>'}</ul>
    </section>
    <section class="c-matters">
      <h3>${icon('scroll')} ${open ? 'Matters before you' : 'The quarter in review'}</h3>
      ${open ? mattersHTML() : reviewHTML()}
    </section>
    <section class="c-orders">
      <h3>${icon('quill')} Your orders</h3>
      ${open && !c.ended ? ordersHTML() : open ? `<p class="sub">Your orders are sealed. They will be carried out when the quarter turns.</p>${ordersSummary()}` : `<p class="sub">The council opens at ${hhmm(c.opens)}. Until then, study the world: every realm's card, the chronicle and the slider are open to you.</p>`}
    </section>
  </div>
  <footer class="c-foot">
    ${open ? (c.ended ? `<button class="btn" data-reopen>${icon('quill')} Reopen my orders</button>` : `<span class="saved" id="saved"></span><button class="btn main" data-end>${icon('seal')} End my turn</button>`) : ''}
    <button class="link" data-leave>Give up the throne</button>
  </footer>`;
}

function mattersHTML() {
  const cards = council.cards;
  if (!cards.length) return `<p class="sub">No matters wait for you this quarter. Your realm is quiet: give your orders.</p>`;
  return `<div class="cards">${cards.map((d) => {
    const [ic, title] = CARD[d.topic ?? d.kind] ?? ['scroll', 'A matter'], mine = draft.answers[d.id];
    return `<article class="mcard${mine ? ' answered' : ''}" data-card="${d.id}">
      <h4>${icon(ic)} ${esc(title)}</h4>
      <p>${esc(d.question)}</p>
      <div class="picks">${d.options.map((o) => `<button class="pick${mine === o ? ' on' : ''}" data-answer="${d.id}" data-choice="${o}">${esc(SAY[o] ?? o)}</button>`).join('')}</div>
      <p class="advice">${icon('eye')} The vizier advises: <b>${esc(SAY[d.advice?.choice] ?? d.advice?.choice ?? '')}</b>${d.advice?.why ? `: ${esc(d.advice.why)}` : ''}${mine ? ` <button class="link" data-answer="${d.id}" data-choice="">leave it to him</button>` : ' <i>(he decides if you do not)</i>'}</p>
    </article>`;
  }).join('')}</div>`;
}

function reviewHTML() {
  const s = S.s, story = S.story, rid = council.realm, from = Math.max(0, s.month - 3), out = [], world = [];
  for (let m = from; m < s.month; m++) for (const e of story?.events?.[m] ?? []) {
    if (e.realms?.includes(rid)) out.push(e);
    else if (!e.minor && ['war', 'peace', 'capture', 'battle', 'fallen', 'coup', 'founded', 'split', 'alliance', 'vassal'].includes(e.type)) world.push(e);
  }
  const li = (e) => `<li><small>${esc(e.date)}</small> ${esc(e.text)}</li>`;
  return `${out.length ? `<h5>Your realm</h5><ul class="review">${out.slice(-14).map(li).join('')}</ul>` : '<p class="sub">A quiet quarter for your realm.</p>'}
    ${world.length ? `<h5>The world</h5><ul class="review">${world.slice(-10).map(li).join('')}</ul>` : ''}`;
}

function ordersHTML() {
  const s = S.s, r = s.realms[council.realm], next = neighbours(s, r.id).realms;
  const wars = living(s).filter((o) => atWar(s, r.id, o.id)).map((o) => o.id);
  const peaceful = next.filter((id) => !atWar(s, r.id, id)), friends = peaceful.filter((id) => !allied(s, r.id, id) && !s.realms[id].nomad);
  const work = bestWork(s, r.id), claims = claimsOf(s, r.id).filter((c) => !atWar(s, r.id, c.holder));
  const kin = Object.values(s.chars).filter((c) => c.alive && c.realm === r.id && c.id !== r.ruler && ['heir', 'child', 'courtier', 'general', 'consort'].includes(c.role));
  const has = (k) => draft.acts.find((a) => a.kind === k);
  const opts = (ids, k) => ids.map((id) => `<option value="${id}"${has(k)?.target === id ? ' selected' : ''}>${esc(s.realms[id].short)}</option>`).join('');
  const tax = draft.tax ?? s.players?.[r.id]?.tax ?? r.tax;
  return `<form id="orders" class="rule-form">
    <label><span>${icon('coin')} Taxes</span><select name="tax">${[['low', 'low: the people are grateful'], ['normal', 'normal'], ['high', 'high: gold now, anger later']].map(([k, t]) => `<option value="${k}"${tax === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    ${peaceful.length ? `<label><span>${icon('swords')} Declare war on</span><select name="war"><option value=""></option>${opts(peaceful, 'war')}</select></label>` : ''}
    ${wars.length ? `<label><span>${icon('scroll')} Offer peace to</span><select name="peace"><option value=""></option>${opts(wars, 'peace')}</select></label>` : ''}
    ${friends.length ? `<label><span>${icon('rings')} Seek an alliance with</span><select name="ally"><option value=""></option>${opts(friends, 'ally')}</select></label>` : ''}
    ${work ? `<label class="check"><input type="checkbox" name="build"${has('build') ? ' checked' : ''}> ${icon('hammer')} Build a ${esc(work.work)} at ${esc(cityOf(s, work.place))} (${RULES.works[work.work].cost} gold)</label>` : ''}
    ${!r.power ? `<label><span>${icon('star')} Your reign's great gamble</span><select name="power"><option value=""></option>${Object.entries(POWER).map(([k, t]) => `<option value="${k}"${has('power')?.power === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}
    ${claims.length ? `<label><span>${icon('scales')} Take a claim to an arbiter</span><select name="claim"><option value=""></option>${claims.map((c) => `<option value="${c.place}"${has('claim')?.place === c.place ? ' selected' : ''}>${esc(cityOf(s, c.place))}</option>`).join('')}</select></label>` : ''}
    ${kin.length ? `<label><span>${icon('crown')} Your heir</span><select name="heir"><option value="">${s.chars[r.heir] ? `as now: ${esc(s.chars[r.heir].name)}` : 'none named'}</option>${kin.filter((c) => c.id !== r.heir).map((c) => `<option value="${c.id}"${has('heir')?.char === c.id ? ' selected' : ''}>${esc(c.name)} (${esc(c.role)}, ${ageOf(s, c)})</option>`).join('')}</select></label>` : ''}
    ${s.chars[r.heir] ? `<label class="check"><input type="checkbox" name="abdicate"${has('abdicate') ? ' checked' : ''}> ${icon('crown')} Give up the throne to ${esc(s.chars[r.heir].name)} (you play on as the new ruler)</label>` : ''}
    <label><span>${icon('quill')} Your words to the chronicle</span><input name="say" maxlength="120" placeholder="optional" value="${esc(has('war')?.say ?? '')}"></label>
  </form>`;
}
function ordersSummary() {
  const s = S.s, list = draft.acts.map((a) => ({ war: `War on ${s.realms[a.target]?.short}`, peace: `Peace offered to ${s.realms[a.target]?.short}`, ally: `An alliance sought with ${s.realms[a.target]?.short}`, build: 'A new work', power: POWER[a.power], claim: `A claim to ${cityOf(s, a.place)}`, heir: `${s.chars[a.char]?.name} named heir`, abdicate: 'The crown passes to your heir' })[a.kind]);
  return list.length ? `<ul class="review">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
}
function readOrders() {
  const f = $('#orders');
  if (!f) return;
  const s = S.s, r = s.realms[council.realm], v = Object.fromEntries(new FormData(f)), say = v.say || undefined, acts = [], work = bestWork(s, r.id);
  if (v.war) acts.push({ kind: 'war', target: v.war, say });
  if (v.peace) acts.push({ kind: 'peace', target: v.peace });
  if (v.ally) acts.push({ kind: 'ally', target: v.ally });
  if (v.build && work) acts.push({ kind: 'build', ...work });
  if (v.power) acts.push({ kind: 'power', power: v.power });
  if (v.claim) acts.push({ kind: 'claim', place: v.claim });
  if (v.heir) acts.push({ kind: 'heir', char: v.heir });
  if (v.abdicate) acts.push({ kind: 'abdicate' });
  Object.assign(draft, { acts, tax: v.tax || null });
}
async function save(end = false) {
  readOrders();
  const d = await post(`${API}/orders`, { token: me.token, ...draft, end });
  const el = $('#saved');
  if (el) el.textContent = d.saved ? `Saved ${hhmm(Date.now())}` : d.error ?? 'Not saved';
  return d;
}
function wireCouncil(d) {
  d.onclick = async (e) => {
    if (e.target === d || e.target.closest('[data-close]')) return d.close();
    const a = e.target.closest('[data-answer]');
    if (a) {
      if (a.dataset.choice) draft.answers[a.dataset.answer] = a.dataset.choice;
      else delete draft.answers[a.dataset.answer];
      await save();
      return openCouncil(true);
    }
    if (e.target.closest('[data-end]')) { const x = await save(true); if (x.saved) openCouncil(true); return; }
    if (e.target.closest('[data-reopen]')) { await post(`${API}/orders`, { token: me.token, ...draft, end: false }); return openCouncil(true); }
    if (e.target.closest('[data-leave]') && confirm('Give up your throne? Your house goes on, ruled by the vizier and the rules.')) {
      await post(`${API}/leave`, { token: me.token });
      store.set(null);
      me = null;
      S.mine = null;
      badge();
      d.close();
    }
  };
  const f = $('#orders');
  if (f) f.onchange = () => { clearTimeout(saving); saving = setTimeout(() => save(), 400); };
}

// ---------- private games (off the menu): the month-by-month seat ----------
function renderGame(box, s) {
  if (!me) {
    const taken = seatsByRealm();
    const free = living(s).map((r) => [r, provincesOf(s, r.id).length]).filter(([r, n]) => n > 0 && !taken[r.id] && !r.rebel).sort((a, b) => b[1] - a[1]);
    box.innerHTML = `<p class="sub">Choose a realm to rule. Its ruler's choices become yours; the rules play everyone else.</p>
      <form id="claim-form" class="rule-form">
        <label><span>Realm</span><select name="realm">${free.map(([r, n]) => `<option value="${r.id}">${esc(r.name)} · ${n} provinces</option>`).join('')}</select></label>
        <label><span>Your name</span><input name="name" maxlength="24" required></label>
        <button class="btn main wide">Take the throne</button>
      </form>`;
    $('#claim-form').onsubmit = async (e) => {
      e.preventDefault();
      const d = await post(`${API}/claim`, Object.fromEntries(new FormData(e.target)));
      if (d.token) { store.set(d.token); await loadSeats(); render(); } else box.insertAdjacentHTML('afterbegin', `<p class="note">${esc(d.error ?? 'That did not work.')}</p>`);
    };
    return;
  }
  const r = s.realms[me.realm];
  box.innerHTML = `<div class="who">${chip(r.id)}<span>played by ${esc(me.name)}</span></div>
    ${(me.decisions ?? []).map((d) => `<div class="decision"><p>${esc(d.question)}</p><div class="picks">${d.options.map((o) => `<button class="pick" data-gans="${d.id}" data-choice="${o}">${esc(o)}</button>`).join('')}</div></div>`).join('')}
    <div class="go"><button class="btn" id="ready">${icon('play')} Ready</button></div>`;
  box.querySelectorAll('[data-gans]').forEach((b) => (b.onclick = async () => { await post(`${API}/answer`, { token: me.token, id: b.dataset.gans, choice: b.dataset.choice }); b.closest('.decision').remove(); }));
  $('#ready').onclick = async () => { await post(`${API}/ready`, { token: me.token }); await loadSeats(); render(); };
}
