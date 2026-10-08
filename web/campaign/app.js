// The campaigns page: the list of wars, a war's briefing, the war itself (the map, your armies' orders, the cards,
// the news of each turn) and its scroll at the end; or someone else's war, watched live or replayed.
import { CAMPAIGNS, CAMPAIGN } from './catalog.js';
import {
  newCampaign, resolve, cardsDue, withCards, counsel, reach, oddsOf, battleFacts, plansFor, fitOf, PLANS, armiesOf, armiesAt, menOf,
  owned, heroOf, goalState, atWar, fmtMen, checksum, VERDICT, incomeOf, upkeepOf, temperOf, friends, wallPower,
} from './engine.js';
import { makeMap } from './map.js';
import { portrait } from '../silk/portrait.js';
import { makeWallet, myWallet, exportKey } from './wallet.js';

const $ = (q) => document.querySelector(q);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* a private window */ } },
};
const RUNS = 'agentistan:runs', BEST = 'agentistan:best', NAME = 'agentistan:name';
const myRuns = () => store.get(RUNS, {});
function saveRun(run) { const all = myRuns(); all[run.id] = run; store.set(RUNS, all); }

// ---------- the server ----------
async function post(u, body) {
  const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? `${r.status}`), { status: r.status, body: j });
  return j;
}
const api = {
  start: (cid, name) => post('/api/run', { cid, name }),
  plan: (run, t) => post(`/api/run/${run.id}/plan`, { token: run.token, t }),
  turn: (run, t, inputs) => post(`/api/run/${run.id}/turn`, { token: run.token, t, inputs }),
  get: (id) => fetch(`/api/run/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)),
  runs: () => fetch('/api/runs').then((r) => (r.ok ? r.json() : { live: [], recent: [] })).catch(() => ({ live: [], recent: [] })),
  claim: (run, body) => post(`/api/run/${run.id}/claim`, { token: run.token, ...body }),
};
const ART = new Set();
fetch('/art/manifest.json').then((r) => r.json()).then((m) => (m.events ?? []).forEach((k) => ART.add(k))).catch(() => {});
const artOf = (k) => (k && ART.has(k) ? `/art/events/${k}.webp` : null);

// ---------- small pieces of markup ----------
const face = (who, color, size = 64, uid = '') => who.art ? `<img src="/art/people/${encodeURIComponent(who.art)}.webp" alt="" width="${size}" height="${size}" style="border-radius:50%;border:3px solid #c9a03c;object-fit:cover;width:${size}px;height:${size}px">` : portrait({ id: who.name, name: who.name, culture: who.look ?? 'roman', female: !!who.female, role: 'general', title: who.title ?? '' }, { color, age: who.age ?? 38, size, uid });
const stars = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;
const meter = (v, col) => `<span class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></span>`;
const sideChip = (C, id) => `<b style="color:${C.sides[id].color}">${esc(C.sides[id].short ?? C.sides[id].name)}</b>`;
const turnLabel = (C, t) => C.turns[Math.min(t, C.turns.length - 1)].label;
function toast(text, ms = 3200) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), ms);
}
const sheet = $('#sheet');
function openSheet(html, { onClose } = {}) {
  sheet.innerHTML = `<div class="panel">${html}</div>`;
  sheet.onclose = () => onClose?.();
  if (!sheet.open) sheet.showModal();
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
  return sheet;
}
sheet.addEventListener('click', (e) => { if (e.target === sheet && !sheet.dataset.sticky) sheet.close(); });

// ---------- the menu ----------
function showMenu() {
  $('#menu').hidden = false;
  $('#game').hidden = true;
  document.title = 'Campaigns · Agentistan';
  const best = store.get(BEST, {}), going = Object.values(myRuns()).filter((r) => !r.done);
  const eras = [];
  for (const C of CAMPAIGNS) { const e = eras.find((x) => x[0] === C.era); e ? e[1].push(C) : eras.push([C.era, [C]]); }
  $('#eras').innerHTML = eras.map(([era, list]) => `<section class="era"><h2>${esc(era)}</h2><div class="cards">${list.map((C) => {
    const run = going.filter((r) => r.cid === C.id).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
    return `<a class="camp" href="${run ? `?run=${run.id}` : `?c=${C.id}`}">
      ${run ? '<span class="badge on">Continue</span>' : best[C.id] ? `<span class="badge">${stars(best[C.id])}</span>` : ''}
      <span class="yr">${esc(C.years)}</span>
      <div class="who">${face(C.hero, C.sides[C.you].color, 46, `m${C.id}`)}<div><h3>${esc(C.title)}</h3><span class="as">as ${esc(C.hero.name)}</span></div></div>
      <p class="hook">${esc(C.hook)}</p>
    </a>`;
  }).join('')}</div></section>`).join('');
  api.runs().then(({ live = [], recent = [] }) => {
    const box = $('#live-runs');
    const rows = [...live.map((r) => ({ ...r, live: true })), ...recent.slice(0, 6)];
    if (!rows.length) return;
    box.hidden = false;
    box.innerHTML = `<h2>${live.length ? 'Being played now, and lately' : 'Lately'}</h2><ul>${rows.map((r) => `<li><a href="?run=${encodeURIComponent(r.id)}">${r.live ? '<i class="dot"></i>' : r.stars ? stars(r.stars) : ''} ${esc(CAMPAIGN[r.cid]?.title ?? r.cid)}${r.name ? ` · ${esc(r.name)}` : ''} <small>${r.live ? `turn ${r.turn + 1}` : esc(VERDICT[r.verdict] ?? '')}</small></a></li>`).join('')}</ul>`;
  });
}

// ---------- the briefing ----------
function briefing(C, { inGame = false } = {}) {
  if (!inGame) { $('#menu').hidden = false; showMenu(); }
  const sides = Object.entries(C.sides).filter(([id]) => C.armies.some((a) => a[0] === id) || C.provinces.some((p) => p[4] === id));
  const menAt = (id) => C.armies.filter((a) => a[0] === id).reduce((t, a) => t + a[2], 0);
  const going = Object.values(myRuns()).filter((r) => r.cid === C.id && !r.done).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  const art = artOf(C.art ?? 'war');
  openSheet(`<button class="x" data-close aria-label="Close">×</button>
    ${art ? `<img class="art" src="${art}" alt="">` : ''}
    <div style="display:flex;gap:14px;align-items:center">${face(C.hero, C.sides[C.you].color, 76, 'brief')}<div><h2>${esc(C.title)}</h2><p class="sub">${esc(C.years)} · you are <b>${esc(C.hero.name)}</b>, ${esc(C.hero.title)}</p></div></div>
    ${C.brief.map((p) => `<p>${esc(p)}</p>`).join('')}
    <div class="goal"><b>Your goal:</b> ${esc(C.goal.text)}. You have ${C.turns.length} turns, from ${esc(C.turns[0].label)} to ${esc(C.turns.at(-1).label)}.</div>
    <div class="forces">${sides.map(([id, d]) => `<div style="--c:${d.color}"><b>${esc(d.name)}</b>${esc(d.leader ?? '')}<br><small>${fmtMen(menAt(id))} men${id === C.you ? ' · you' : ''}</small></div>`).join('')}</div>
    <details><summary><b>How to play</b></summary>
      <ul>
        <li>Tap one of your armies, then a place it can reach this turn. The badge on each place shows the odds of a battle there, or how long a siege would take.</li>
        <li>When you march on an enemy army, choose a battle plan. Each plan suits some ground, some numbers and some enemies: read the hints, and your advisor’s counsel.</li>
        <li>The big decisions of the war come as cards. After you choose, you see what the real ${esc(C.hero.name.split(' ')[0])} did.</li>
        <li>Watch the will to fight: yours, and your enemy’s. Wars are won when the other side gives up.</li>
        <li>End the turn. Everyone moves at once; then you read the news, and what really happened at this time.</li>
      </ul></details>
    <div class="share">${inGame ? '<button class="btn main" data-close>Back to the war</button>' : `${going ? `<a class="btn main" href="?run=${going.id}">Continue your campaign</a><button class="btn" data-begin>Start again</button>` : '<button class="btn main" data-begin>Begin the campaign</button>'}<a class="btn" href="/campaign/">All campaigns</a>`}</div>`, { onClose: () => { if (inGame) return void (G.s?.status === 'running' && !G.watch && nextCard()); if (!G.C) history.replaceState(null, '', '/campaign/'); } });
  sheet.querySelector('[data-begin]')?.addEventListener('click', () => { sheet.close(); startRun(C); });
}

// ---------- a war ----------
const G = { C: null, data: null, map: null, run: null, s: null, pre: null, turns: [], events: [], draft: null, sel: null, stand: {}, advice: null, busy: false, watch: false, ws: null, view: 0, bare: false };

async function startRun(C) {
  let run;
  const name = store.get(NAME, '') || null;
  try {
    const r = await api.start(C.id, name);
    run = { id: r.id, token: r.token, seed: r.seed, cid: C.id, at: Date.now() };
  } catch {
    run = { id: `local-${Math.random().toString(36).slice(2, 10)}`, seed: 1 + Math.floor(Math.random() * 1e6), cid: C.id, local: true, turns: [], at: Date.now() };
  }
  saveRun(run);
  history.replaceState(null, '', `?run=${encodeURIComponent(run.id)}`);
  await loadGame(C, run, []);
}
async function openRun(id) {
  const mine = myRuns()[id];
  if (mine?.local) return CAMPAIGN[mine.cid] ? loadGame(CAMPAIGN[mine.cid], mine, mine.turns ?? []) : showMenu();
  const rec = await api.get(id).catch(() => null);
  if (!rec || !CAMPAIGN[rec.cid]) { showMenu(); toast('That campaign could not be found.'); return; }
  const run = mine?.token ? { ...mine, seed: rec.seed } : { id, cid: rec.cid, seed: rec.seed, watch: true };
  await loadGame(CAMPAIGN[rec.cid], run, rec.turns ?? [], rec);
}

async function loadGame(C, run, turns, rec = null) {
  Object.assign(G, { C, run, turns: turns.slice(), events: [], sel: null, stand: {}, advice: null, watch: !!run.watch, rec });
  $('#menu').hidden = true;
  $('#game').hidden = false;
  document.title = `${C.title} · Agentistan`;
  G.data = await fetch(`/campaign/maps/${C.id}.json`).then((r) => r.json());
  G.map = makeMap($('#map'), G.data, C, { army: onArmy, province: onProvince, target: onTarget, empty: () => { closePop(); if (G.sel) { G.sel = null; draw(); } }, restyle: () => { clearTimeout(G.restyle); G.restyle = setTimeout(() => G.s && draw(), 160); }, inset: () => (G.watch ? 0 : 364) });
  let s = newCampaign(C, run.seed);
  for (const inp of G.turns) { const r = resolve(s, C, inp); G.events.push(r.events); s = r.state; }
  G.s = s;
  G.view = G.turns.length;
  if (G.watch || (rec && rec.status && rec.status !== 'running' && !run.token)) return watchMode(rec);
  if (s.status !== 'running') { draw(); return scroll(); }
  if (!G.turns.length && !sheet.open) briefing(C, { inGame: true });
  newTurn();
}

function newTurn() {
  const C = G.C, s = G.s;
  G.draft = { orders: {}, raise: {}, cards: {}, peace: {} };
  for (const a of armiesOf(s, C.you)) if (G.stand[a.id]) G.draft.orders[a.id] = { to: null, plan: G.stand[a.id] };
  G.sel = null;
  G.advice = null;
  G.pre = s;
  draw();
  if (!G.run.local) api.plan(G.run, s.turn).then((p) => { G.advice = p; renderTurn(); }).catch(() => {});
  const due = cardsDue(C, s);
  if (due.length && !sheet.open) setTimeout(() => !sheet.open && openCard(due[0]), 500);
}
// the state as it will be once the cards are answered: what your orders are given from
function refreshPre() { G.pre = withCards(G.C, G.s, G.draft.cards); }

function draw() {
  if (!G.s) return;
  const view = G.watch ? G.s : G.pre ?? G.s;
  G.map.paint(view, { sel: G.watch ? null : G.sel, orders: G.watch ? {} : G.draft?.orders ?? {}, you: G.C.you });
  renderHud(view);
  if (!G.watch) renderTurn();
}

function renderHud(s) {
  const C = G.C, you = C.you, st = s.sides[you], g = goalState(C, s), net = Math.round(incomeOf(C, s, you) - upkeepOf(C, s, you));
  const hero = heroOf(s), foe = C.goal.foe;
  $('#hud').innerHTML = `<div class="face">${face(C.hero, C.sides[you].color, 64, 'hud')}</div>
    <div><h1>${esc(C.hero.name)}</h1>
      <div class="date">${esc(turnLabel(C, s.turn))} · turn ${Math.min(s.turn + 1, C.turns.length)} of ${C.turns.length}${G.watch ? '' : ''}</div>
      <div class="meters">
        <span title="Gold, and what it gains or loses each turn after paying the armies">Gold <b>${Math.round(st.gold)}</b> <small>${net >= 0 ? '+' : ''}${net}</small></span>
        <span title="All your soldiers">Men <b>${fmtMen(menOf(s, you))}</b></span>
        <span title="Your side's will to fight: at 0 you are recalled">Will <b>${Math.round(st.will)}</b>${meter(st.will, st.will > 40 ? '#4f7a3a' : '#a3361f')}</span>
        ${foe ? `<span title="${esc(g.text)}">${esc(C.sides[foe].short ?? C.sides[foe].name)}’s will <b>${Math.round(s.sides[foe].will)}</b>${meter(s.sides[foe].will, '#a3361f')}</span>` : `<span title="${esc(g.text)}">Goal ${meter(g.progress * 100, '#27466e')}</span>`}
      </div>
      ${hero ? '' : ''}
    </div>`;
}

// ---------- the turn panel ----------
function renderTurn() {
  const C = G.C, s = G.s, pre = G.pre ?? s, you = C.you, box = $('#turn');
  if (G.watch || s.status !== 'running') { box.hidden = true; return; }
  box.hidden = G.bare;
  const due = cardsDue(C, s), advisor = C.advisor ?? { name: 'Your advisor', look: C.hero.look };
  const lines = G.advice?.advice?.length ? G.advice.advice : counsel(C, pre);
  const by = G.advice?.by === 'ai' ? 'counsel by the AI' : 'counsel by the rules';
  const foes = Object.keys(C.sides).filter((x) => x !== you && pre.sides[x].alive && atWar(pre, you, x) && !C.sides[x].noPeace);
  box.innerHTML = `<h2>${esc(turnLabel(C, s.turn))}</h2>
    <div class="advisor"><div class="face">${face(advisor, C.sides[you].color, 44, 'adv')}</div><div>${lines.slice(0, 3).map((l) => `<p>${esc(l)}</p>`).join('')}<span class="by">${esc(advisor.name)}${advisor.title ? `, ${esc(advisor.title)}` : ''} · ${by}</span></div></div>
    ${due.length ? `<h3>Decisions</h3><div class="decide">${due.map((c) => `<button data-card="${esc(c.id)}" class="${G.draft.cards[c.id] !== undefined ? 'done' : ''}">${esc(c.title)}<span class="tag">${G.draft.cards[c.id] !== undefined ? esc(c.options[G.draft.cards[c.id]].label) : 'decide'}</span></button>`).join('')}</div>` : ''}
    <h3>Your armies</h3><div class="armies">${armiesOf(pre, you).sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || b.men - a.men).map((a) => armyRow(a)).join('') || '<p class="sub">You have no army in the field.</p>'}</div>
    ${foes.length ? `<h3>Peace</h3><div class="peace-row">${foes.map((f) => `<button class="btn${G.draft.peace[f] ? ' blue' : ''}" data-peace="${f}">${G.draft.peace[f] ? '✓ ' : ''}Offer peace to ${esc(C.sides[f].short ?? C.sides[f].name)}</button>`).join('')}</div><p class="fine">They accept only when their will to fight is low.</p>` : ''}
    <div class="end"><button class="btn main wide" id="end-turn">${G.busy ? 'The turn unfolds…' : `End the turn${due.some((c) => G.draft.cards[c.id] === undefined) ? ' (your advisor decides the rest)' : ''}`}</button></div>`;
  box.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => openCard(due.find((c) => c.id === b.dataset.card))));
  box.querySelectorAll('[data-sel]').forEach((r) => r.addEventListener('click', (e) => { if (e.target.closest('select, button')) return; select(r.dataset.sel); }));
  box.querySelectorAll('select[data-stand]').forEach((sel) => sel.addEventListener('change', () => {
    const id = sel.dataset.stand, o = (G.draft.orders[id] ??= { to: null });
    o.plan = sel.value || null;
    G.stand[id] = sel.value || null;
    renderTurn();
  }));
  box.querySelectorAll('[data-raise]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.raise;
    if (G.draft.raise[id]) delete G.draft.raise[id]; else G.draft.raise[id] = +b.dataset.men;
    renderTurn();
  }));
  box.querySelectorAll('[data-hold]').forEach((b) => b.addEventListener('click', () => { const o = G.draft.orders[b.dataset.hold]; if (o) o.to = null; draw(); }));
  box.querySelectorAll('[data-peace]').forEach((b) => b.addEventListener('click', () => { const f = b.dataset.peace; G.draft.peace[f] = G.draft.peace[f] ? undefined : 'offer'; renderTurn(); }));
  $('#end-turn').disabled = G.busy;
  $('#end-turn').addEventListener('click', endTurn);
}
function armyRow(a) {
  const C = G.C, pre = G.pre, o = G.draft.orders[a.id];
  const where = C.prov[a.at].name;
  let ord = `<div class="ord none">Holds at ${esc(where)}</div>`;
  if (o?.to && o.to !== a.at) {
    const odds = oddsOf(C, pre, a.id, o.to);
    const what = odds.kind === 'battle' ? `Attack at ${C.prov[o.to].name}${o.plan ? ` · ${PLANS[o.plan].name.toLowerCase()}` : ''}` : odds.kind === 'siege' ? `${o.storm ? 'Storm' : 'Besiege'} ${C.prov[o.to].name}` : `March to ${C.prov[o.to].name}`;
    ord = `<div class="ord">→ ${esc(what)} <button class="link" data-hold="${a.id}">stay instead</button></div>`;
  } else if (pre.prov[a.at].owner && atWar(pre, C.you, pre.prov[a.at].owner) && pre.prov[a.at].walls) ord = `<div class="ord">Besieging ${esc(where)}</div>`;
  const P = pre.prov[a.at], cost = C.raiseCost ?? 10, levy = C.sides[C.you].levy;
  const canRaise = (P.owner === C.you || friends(pre, C.you, P.owner)) && C.prov[a.at].wealth >= 1;
  const n = Math.min(levy, Math.floor(pre.sides[C.you].gold / cost) * 1000);
  const defend = plansFor(C, true);
  return `<div class="arow${G.sel === a.id ? ' sel' : ''}" data-sel="${a.id}">
    <div class="top"><span style="color:${C.sides[C.you].color}">⚑</span><b>${fmtMen(a.men)}</b><span>${esc(a.gen ?? 'An army')}${a.hero ? ' ★' : ''}</span><small>${esc(where)}</small></div>
    ${ord}
    <div class="ctl">
      <select data-stand="${a.id}" title="What this army does if it is attacked"><option value="">If attacked: the general decides</option>${defend.map((p) => `<option value="${p}"${(o?.plan ?? G.stand[a.id]) === p ? ' selected' : ''}>If attacked: ${esc(PLANS[p].name.toLowerCase())}</option>`).join('')}</select>
      ${canRaise && n >= 1000 ? `<button class="mini${G.draft.raise[a.id] ? ' on' : ''}" data-raise="${a.id}" data-men="${n}" title="Recruit here: ${cost} gold for every thousand">${G.draft.raise[a.id] ? `✓ raising ${fmtMen(n)}` : `Raise ${fmtMen(n)} (${(n / 1000) * cost} gold)`}</button>` : ''}
    </div>
  </div>`;
}

function select(id) {
  closePop();
  G.sel = G.sel === id ? null : id;
  if (G.sel) G.map.focus(G.pre.armies[id].at);
  draw();
}
function onArmy(id, e) {
  const a = (G.watch ? G.s : G.pre ?? G.s).armies[id];
  if (!a) return;
  if (!G.watch && a.side === G.C.you && G.s.status === 'running') return select(id);
  if (G.sel && !G.watch) return onTarget(a.at, e);
  infoPop(a.at, e);
}
function onProvince(pid, e) {
  if (G.sel && !G.watch) {
    const r = reach(G.C, G.pre, G.sel);
    if (r[pid] || pid === G.pre.armies[G.sel]?.at) return onTarget(pid, e);
  }
  infoPop(pid, e);
}
function onTarget(pid, e) {
  const C = G.C, pre = G.pre, a = pre.armies[G.sel];
  if (!a) return;
  const o = (G.draft.orders[a.id] ??= { to: null, plan: G.stand[a.id] ?? null });
  if (pid === a.at) { o.to = null; o.storm = false; closePop(); return draw(); }
  if (!reach(C, pre, a.id)[pid]) return toast('Too far for one turn.');
  o.to = pid;
  o.storm = false;
  const odds = oddsOf(C, pre, a.id, pid);
  if (odds.kind === 'battle') { o.plan = null; planPop(a, pid, odds, e); }
  else if (odds.kind === 'siege') siegePop(a, pid, odds, e);
  else closePop();
  draw();
}

// ---------- popovers ----------
function place(pop, e) {
  const w = pop.offsetWidth || 300, h = pop.offsetHeight || 200;
  const x = Math.min(innerWidth - w - 12, Math.max(12, (e?.clientX ?? innerWidth / 2) + 14)), y = Math.min(innerHeight - h - 12, Math.max(12, (e?.clientY ?? innerHeight / 2) - 20));
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
}
function closePop() { $('#pop').hidden = true; }
function planPop(a, pid, odds, e) {
  const C = G.C, pre = G.pre, f = odds.facts, foe = pre.armies[odds.foes[0]], mine = plansFor(C, false);
  const best = mine.map((p) => [p, fitOf(f, p)]).sort((x, y) => y[1] - x[1])[0][0];
  const temper = foe.temper ?? temperOf(C, pre, foe.side);
  const pop = $('#pop');
  pop.innerHTML = `<button class="x" aria-label="Close">×</button><h3>Battle at ${esc(C.prov[pid].name)}</h3>
    <div class="facts">You: ${fmtMen(f.men)}${f.horse >= 0.3 ? ', many horsemen' : f.horse >= 0.18 ? ', some horse' : ', few horse'} · Them: ${fmtMen(f.foeMen)} under ${esc(foe.gen ?? C.sides[foe.side].name)} (${esc(temper)})${f.foeHorse >= 0.3 ? ', strong in horse' : ''}<br>Ground: ${esc(f.terrain)}${f.lake ? ' by a lake' : ''}${f.narrows ? ', a narrow pass' : ''} · ${esc(f.season)} · odds without a plan ${odds.ratio >= 1 ? `${odds.ratio.toFixed(1)} to 1 for you` : `1 to ${(1 / odds.ratio).toFixed(1)} against you`}</div>
    <div class="plans">${mine.map((p) => `<button data-plan="${p}"><b>${esc(PLANS[p].name)}${p === best ? ` <small>· ${esc(C.advisor?.name ?? 'your advisor')} favours this</small>` : ''}</b><small>${esc(PLANS[p].hint)}. As at ${esc(PLANS[p].example)}.</small></button>`).join('')}
      <button data-plan=""><b>Let ${esc(a.gen ?? 'the general')} decide</b><small>He picks by his skill and temper.</small></button></div>`;
  pop.hidden = false;
  place(pop, e);
  pop.querySelector('.x').onclick = closePop;
  pop.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
    G.draft.orders[a.id].plan = b.dataset.plan || null;
    closePop();
    draw();
  }));
}
function siegePop(a, pid, odds, e) {
  const C = G.C, pop = $('#pop');
  pop.innerHTML = `<button class="x" aria-label="Close">×</button><h3>The walls of ${esc(C.prov[pid].name)}</h3>
    <div class="facts">Walls ${G.pre.prov[pid].walls} · garrison ${fmtMen(odds.garrison)}. A siege takes about ${odds.turns} turn${odds.turns > 1 ? 's' : ''}; a storm is quick but bloody, and fails if the walls hold.</div>
    <div class="plans"><button data-s="0"><b>Lay siege</b><small>Starve them out: about ${odds.turns} turn${odds.turns > 1 ? 's' : ''}.</small></button>
    <button data-s="1"><b>Storm the walls</b><small>Your strength against the walls: ${odds.ratio >= 1 ? `${odds.ratio.toFixed(1)} to 1` : `1 to ${(1 / odds.ratio).toFixed(1)}`}. ${odds.ratio >= 1.3 ? 'It should succeed.' : odds.ratio >= 1 ? 'A gamble.' : 'It would likely fail.'}</small></button></div>`;
  pop.hidden = false;
  place(pop, e);
  pop.querySelector('.x').onclick = closePop;
  pop.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { G.draft.orders[a.id].storm = b.dataset.s === '1'; closePop(); draw(); }));
}
function infoPop(pid, e) {
  const C = G.C, s = G.watch ? G.s : G.pre ?? G.s, P = C.prov[pid], st = s.prov[pid], pop = $('#pop');
  const here = armiesAt(s, pid);
  pop.innerHTML = `<button class="x" aria-label="Close">×</button><h3>${esc(P.name)}</h3>
    <dl><dt>Held by</dt><dd>${st.owner ? sideChip(C, st.owner) : 'no one'}</dd>
    <dt>Ground</dt><dd>${esc(P.terrain)}${P.lake ? ', a lake shore' : ''}${P.narrows ? ', a narrow pass' : ''}</dd>
    ${st.walls ? `<dt>Walls</dt><dd>${'▮'.repeat(st.walls)} · garrison ${fmtMen(st.garrison)}${st.siege ? ` · besieged (${st.siege}/${st.walls})` : ''}</dd>` : ''}
    <dt>Wealth</dt><dd>${'●'.repeat(P.wealth) || '–'}</dd>
    ${here.map((a) => `<dt>Army</dt><dd>${sideChip(C, a.side)} ${fmtMen(a.men)}${a.gen ? ` under ${esc(a.gen)}` : ''}${a.side !== C.you ? ` <small>(${esc(a.temper ?? temperOf(C, s, a.side))})</small>` : ''}</dd>`).join('')}</dl>`;
  pop.hidden = false;
  place(pop, e);
  pop.querySelector('.x').onclick = closePop;
}

// ---------- the cards ----------
function fxText(C, fx = {}) {
  const out = [];
  if (fx.chance !== undefined) return `a gamble: about ${Math.round(fx.chance * 10) * 10}% to go your way`;
  const n = (v, unit) => `${v > 0 ? '+' : ''}${v}${unit}`;
  if (fx.gold) out.push(n(fx.gold, ' gold'));
  if (fx.men) out.push(Math.abs(fx.men) < 1 ? `${fx.men > 0 ? '+' : '−'}${Math.round(Math.abs(fx.men) * 100)}% men` : `${fx.men > 0 ? '+' : '−'}${fmtMen(Math.abs(fx.men))} men`);
  if (fx.will) out.push(n(fx.will, ' your will'));
  if (fx.morale) out.push(n(fx.morale, ' morale'));
  for (const [side, d] of Object.entries(fx.sides ?? {})) if (d.will) out.push(`${C.sides[side].short ?? C.sides[side].name} will ${d.will > 0 ? '+' : ''}${d.will}`);
  if (fx.give) for (const [p, to] of Array.isArray(fx.give[0]) ? fx.give : [fx.give]) out.push(`${C.prov[p]?.name} goes to ${C.sides[to]?.short ?? C.sides[to]?.name}`);
  if (fx.move) out.push('your army moves');
  if (fx.spawn) out.push('an army appears');
  if (fx.rel) for (const [a, b, r] of Array.isArray(fx.rel[0]) ? fx.rel : [fx.rel]) out.push(`${C.sides[a]?.short ?? C.sides[a]?.name} ${r === 'ally' ? 'allies with' : r === 'war' ? 'goes to war with' : 'makes peace with'} ${C.sides[b]?.short ?? C.sides[b]?.name}`);
  return out.join(' · ');
}
function openCard(c, { reveal = false } = {}) {
  if (!c) return;
  const C = G.C, chosen = G.draft.cards[c.id], art = artOf(c.art);
  const advise = c.options[c.advise ?? 0]?.label;
  const showHistory = reveal || chosen !== undefined;
  openSheet(`<button class="x" data-close aria-label="Close">×</button>
    ${art ? `<img class="art" src="${art}" alt="">` : ''}
    <h2>${esc(c.title)}</h2><p class="sub">${esc(turnLabel(C, G.s.turn))}</p>
    <p>${esc(c.text)}</p>
    <div class="opts">${c.options.map((o, i) => `<button class="opt${chosen === i ? ' chosen' : ''}" data-opt="${i}"><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}${fxText(C, o.fx) ? `<span class="fx">${esc(fxText(C, o.fx))}</span>` : ''}</button>`).join('')}</div>
    ${!c.peace ? `<p class="advice">${esc(C.advisor?.name ?? 'Your advisor')} would choose: <b>${esc(advise)}</b>${chosen === undefined ? '. If you do not decide, he will.' : ''}</p>` : ''}
    ${showHistory && c.history ? `<div class="history"><h4>What history did</h4><p>${esc(c.history)}${c.pick !== undefined ? ` <b>(${esc(c.options[c.pick].label)})</b>` : ''}</p></div><div class="share"><button class="btn main" data-close>Continue</button></div>` : ''}`);
  sheet.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    G.draft.cards[c.id] = +b.dataset.opt;
    refreshPre();
    draw();
    if (c.peace || !c.history) { sheet.close(); return nextCard(); }
    openCard(c, { reveal: true });
    sheet.querySelector('[data-close].btn')?.addEventListener('click', () => setTimeout(nextCard, 50));
  }));
}
function nextCard() {
  const next = cardsDue(G.C, G.s).find((x) => G.draft.cards[x.id] === undefined);
  if (next) setTimeout(() => openCard(next), 250);
}

// ---------- the end of a turn ----------
async function endTurn() {
  if (G.busy || G.s.status !== 'running') return;
  G.busy = true;
  closePop();
  G.sel = null;
  renderTurn();
  const C = G.C, before = G.s;
  const inputs = { orders: G.draft.orders, raise: G.draft.raise, cards: G.draft.cards, peace: Object.fromEntries(Object.entries(G.draft.peace).filter(([, v]) => v)) };
  let final = inputs, chk = null;
  if (!G.run.local) {
    try {
      const res = await api.turn(G.run, before.turn, inputs);
      final = res.inputs;
      chk = res.chk;
    } catch (err) {
      if (err.status === 409 && err.body?.turns) { // the server is ahead of this page: catch up from its record
        G.busy = false;
        return openRun(G.run.id);
      }
      G.busy = false;
      renderTurn();
      return toast(err.status ? `The turn was not accepted: ${err.message}` : 'The server cannot be reached. Try again in a moment.');
    }
  }
  const r = resolve(before, C, final);
  if (chk && checksum(r.state) !== chk) console.warn('this replay strays from the server: reloading');
  G.turns.push(final);
  G.events.push(r.events);
  G.s = r.state;
  G.pre = r.state;
  if (G.run.local) { G.run.turns = G.turns; G.run.at = Date.now(); saveRun(G.run); }
  else saveRun({ ...G.run, at: Date.now(), turn: G.s.turn });
  draw();
  G.map.clash(r.events);
  await sleep(1400);
  G.busy = false;
  recap(before, r, () => {
    if (G.s.status !== 'running') return scroll();
    newTurn();
  });
}

const GOOD = new Set(['victory']), BAD = new Set(['defeat', 'hero', 'unpaid']);
function news(C, s, e) {
  const you = C.you, mine = (x) => x === you || friends(s, you, x);
  let cls = '';
  if (e.type === 'battle') cls = mine(e.winner) ? 'good' : (e.sides ?? []).some(mine) ? 'bad' : '';
  else if (['capture', 'starved', 'storm'].includes(e.type)) cls = mine(e.sides?.[0]) ? 'good' : mine(e.sides?.[1]) ? 'bad' : '';
  else if (GOOD.has(e.type)) cls = 'good';
  else if (BAD.has(e.type)) cls = 'bad';
  const icon = { battle: '⚔', capture: '⚑', starved: '⚑', storm: '⚑', siege: '◎', repulsed: '✕', refused: '↩', war: '⚔', peace: '☮', alliance: '∞', raised: '+', attrition: '❄', story: '❧', history: '❧', card: '✎', victory: '★', defeat: '✝', yield: '☮', storm2: '≈' }[e.type] ?? '·';
  let more = '';
  if (e.type === 'battle' && e.plans) {
    const side = e.sides?.[0] === you || friends(s, you, e.sides?.[0]) ? 'a' : e.sides?.[1] === you || friends(s, you, e.sides?.[1]) ? 'd' : null;
    if (side) {
      const p = e.plans[side], q = e.plans[side === 'a' ? 'd' : 'a'], lost = e.lost[side === 'a' ? 0 : 1], killed = e.lost[side === 'a' ? 1 : 0];
      const how = p.fit >= 0.5 ? 'it suited the ground and the armies' : p.fit >= 0 ? 'it served' : 'it did not suit the ground or the armies';
      more = `<small>Your plan: ${esc(PLANS[p.id]?.name ?? p.id)}${p.by === 'general' ? ' (your general’s choice)' : ''}, and ${how}. Theirs: ${esc(PLANS[q.id]?.name ?? q.id)}. You lost ${fmtMen(lost)}, they lost ${fmtMen(killed)}.</small>`;
    }
  }
  return `<li class="${cls}"><span class="i">${icon}</span><span>${esc(e.text)}${more}</span></li>`;
}
function recap(before, r, then) {
  const C = G.C, s = r.state, t = before.turn;
  // the news that matters, once: "opens its gates" says enough without "takes" after it
  const fell = new Set(r.events.filter((e) => ['starved', 'storm'].includes(e.type)).map((e) => e.at));
  const shown = r.events.filter((e) => (!e.minor || (e.sides ?? []).includes(C.you)) && !(e.type === 'capture' && fell.has(e.at))).slice(0, 12);
  const said = Object.entries(s.said ?? {}).filter(([side]) => C.sides[side]);
  const art = artOf(r.events.find((e) => e.type === 'battle')?.decisive ? 'battle' : r.events.some((e) => e.type === 'capture' && e.capital) ? 'siege' : null);
  openSheet(`${art ? `<img class="art" src="${art}" alt="">` : ''}<h2>${esc(turnLabel(C, t))}</h2>
    ${shown.length ? `<ul class="news">${shown.map((e) => news(C, s, e)).join('')}</ul>` : '<p class="sub">A quiet season: the armies march and watch each other.</p>'}
    ${said.map(([side, line]) => `<p class="said" style="--c:${C.sides[side].color}">${sideChip(C, side)}: “${esc(line)}”</p>`).join('')}
    ${C.turns[t].history ? `<div class="history"><h4>Meanwhile, in history</h4><p>${esc(C.turns[t].history)}</p></div>` : ''}
    <div class="share"><button class="btn main" data-close>${s.status !== 'running' ? 'See how it ended' : 'Continue'}</button></div>`, { onClose: then });
}

// ---------- the scroll: how the war ended, beside history ----------
function topEvent(C, list) {
  const you = C.you, of = (e) => (e.sides ?? []).includes(you) || e.winner === you;
  const pick = list.find((e) => ['victory', 'defeat'].includes(e.type)) ?? list.find((e) => e.type === 'battle' && of(e) && e.decisive) ?? list.find((e) => e.type === 'battle' && of(e)) ?? list.find((e) => ['capture', 'starved', 'storm'].includes(e.type) && of(e) && !e.minor) ?? list.find((e) => e.type === 'card') ?? list.find((e) => !e.minor);
  return pick?.text ?? '';
}
async function scroll() {
  const C = G.C, s = G.s, v = s.verdict ?? { as: 'as', stars: 2 }, st = s.stats;
  const best = store.get(BEST, {});
  if (!G.watch && v.stars > (best[C.id] ?? 0)) { best[C.id] = v.stars; store.set(BEST, best); }
  if (!G.watch) saveRun({ ...G.run, done: true, at: Date.now() });
  const link = G.run.local ? null : `${location.origin}/campaign/?run=${encodeURIComponent(G.run.id)}`;
  const next = CAMPAIGNS[CAMPAIGNS.indexOf(C) + 1];
  const rows = C.turns.slice(0, Math.max(G.events.length, 1)).map((tt, i) => `<div class="d">${esc(tt.label)}</div><div>${esc(topEvent(C, G.events[i] ?? []))}</div><div class="hist">${esc(tt.history)}</div>`).join('');
  openSheet(`<button class="x" data-close aria-label="Close">×</button>
    <div class="scroll-head">${face(C.hero, C.sides[C.you].color, 84, 'scroll')}<h2>${esc(C.title)}</h2>${stars(v.stars)}<div class="verdict">${esc(VERDICT[v.as])}</div><p>${esc(s.end?.why ?? '')}</p></div>
    <div class="stats"><span><b>${st.won}</b>battles won</span><span><b>${st.lost}</b>battles lost</span><span><b>${st.taken}</b>cities taken</span><span><b>${fmtMen(st.dead)}</b>of your men fell</span><span><b>${(s.end?.turn ?? s.turn) + 1}</b>turns</span></div>
    <div class="history"><h4>How it really ended</h4><p>${esc(C.history.text)}</p></div>
    <div class="history"><h4>The historian’s judgement</h4><p id="summary" class="thinking">${G.rec?.summary ? esc(G.rec.summary) : G.run.local ? esc(localSummary(C, s)) : 'The historian is writing…'}</p></div>
    <details open><summary><b>Your war, beside history’s</b></summary><div class="timeline"><div class="h">When</div><div class="h">Your war</div><div class="h">History</div>${rows}</div></details>
    ${link ? `<div class="share"><input readonly value="${esc(link)}" aria-label="The link to this campaign"><button class="btn" data-copy>Copy the link</button></div>` : '<p class="fine">This campaign was played without the server, so it has no link to share and no NFT.</p>'}
    ${link && !G.watch ? `<div class="nft" id="nft"><img src="/nft/${esc(G.rec?.token ?? '')}.svg" alt="" hidden><div><b>Keep this scroll as an NFT</b><p class="sub">A token on Base Sepolia (a test network: no money value), with your verdict and this summary. The game pays the fees.</p><div id="nft-box"></div></div></div>` : ''}
    <div class="share">${!G.watch ? `<a class="btn main" href="?c=${C.id}">Play it again</a>` : ''}${next ? `<a class="btn" href="?c=${next.id}">Next: ${esc(next.title)}</a>` : ''}<a class="btn" href="/campaign/">All campaigns</a></div>`, {});
  sheet.querySelector('[data-copy]')?.addEventListener('click', () => { navigator.clipboard?.writeText(link); toast('The link is copied.'); });
  if (link && !G.watch) nftBox();
  if (!G.run.local && !G.rec?.summary) waitForSummary();
}
function localSummary(C, s) {
  const v = s.verdict?.as ?? 'as';
  return `${C.hero.name} ${s.status === 'won' ? 'achieved what history did not allow' : 'fought on'}: ${s.stats.won} battles won, ${s.stats.lost} lost, ${s.stats.taken} cities taken. ${v === 'better' ? 'A better ending than history’s.' : v === 'as' ? 'History would recognise this war.' : 'History went better than this.'}`;
}
async function waitForSummary() {
  for (let i = 0; i < 40 && sheet.open; i++) {
    const rec = await api.get(G.run.id).catch(() => null);
    if (rec?.summary) {
      G.rec = rec;
      const p = $('#summary');
      if (p) { p.textContent = rec.summary; p.classList.remove('thinking'); }
      nftBox();
      return;
    }
    await sleep(4000);
  }
  const p = $('#summary');
  if (p && p.classList.contains('thinking')) p.textContent = localSummary(G.C, G.s);
}
function nftBox() {
  const box = $('#nft-box');
  if (!box) return;
  const rec = G.rec ?? {}, w = myWallet();
  if (rec.owner) {
    const img = $('#nft img');
    if (img && rec.token) { img.src = `/nft/${rec.token}.svg`; img.hidden = false; }
    box.innerHTML = `<p>${rec.nft === 'minted' ? `✓ Minted to <code>${esc(rec.owner.slice(0, 8))}…</code>${rec.tx ? ` · <a href="https://sepolia.basescan.org/tx/${esc(rec.tx)}" target="_blank" rel="noopener">see it on Basescan</a>` : ''}` : `It goes to <code>${esc(rec.owner.slice(0, 8))}…</code> with the next mint, within a few minutes.`}</p>${w?.address?.toLowerCase() === rec.owner.toLowerCase() ? '<button class="btn" data-export>Export your wallet’s key</button>' : ''}`;
    box.querySelector('[data-export]')?.addEventListener('click', () => exportKey(myWallet()));
    return;
  }
  box.innerHTML = `<form class="share" id="claim"><input name="name" maxlength="40" placeholder="Your name on the scroll (optional)" value="${esc(store.get(NAME, ''))}"><input name="address" maxlength="42" placeholder="Your address 0x… (or make a wallet)" value="${esc(w?.address ?? '')}"><button class="btn blue">Claim it</button><button class="btn" type="button" data-make>${w ? 'Use the wallet in this browser' : 'Make me a wallet'}</button></form>`;
  const f = $('#claim');
  f.querySelector('[data-make]').addEventListener('click', async () => { const ww = myWallet() ?? await makeWallet(); f.address.value = ww.address; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = f.name.value.trim(), address = f.address.value.trim();
    if (name) store.set(NAME, name);
    try {
      const r = await api.claim(G.run, { address, name });
      G.rec = { ...(G.rec ?? {}), ...r };
      nftBox();
      if (myWallet()?.address?.toLowerCase() === address.toLowerCase()) toast('Export your wallet’s key and keep it safe: it lives only in this browser.', 6000);
    } catch (err) { toast(err.message === 'address' ? 'That is not an address: 0x and 40 letters or digits.' : `It did not work: ${err.message}`); }
  });
}

// ---------- watching someone else's war ----------
function watchMode(rec) {
  const C = G.C;
  G.watch = true;
  $('#turn').hidden = true;
  const bar = document.createElement('div');
  bar.className = 'replay panel';
  bar.id = 'replay';
  $('#game').append(bar);
  const chip = document.createElement('div');
  chip.className = 'watching panel';
  $('#game').append(chip);
  const setChip = () => { chip.innerHTML = `${G.rec?.status === 'running' ? '<i class="dot"></i> Live' : 'Replay'} · ${esc(G.rec?.name ?? 'Someone')} as ${esc(C.hero.name)}`; };
  setChip();
  const at = (n) => {
    let s = newCampaign(C, G.run.seed);
    for (let i = 0; i < n; i++) s = resolve(s, C, G.turns[i]).state;
    return s;
  };
  const show = (n) => {
    G.view = Math.max(0, Math.min(G.turns.length, n));
    G.s = at(G.view);
    draw();
    if (G.view > 0) G.map.clash(G.events[G.view - 1] ?? []);
    bar.innerHTML = `<button class="round" data-b aria-label="Back">‹</button><button class="round" data-p aria-label="Play">${G.playing ? '❚❚' : '▶'}</button><button class="round" data-f aria-label="Forward">›</button><input type="range" min="0" max="${G.turns.length}" value="${G.view}" aria-label="Turn"><small>${esc(turnLabel(C, G.view))}</small>${G.s.status !== 'running' ? '<button class="btn" data-end>The scroll</button>' : ''}`;
    bar.querySelector('[data-b]').onclick = () => { G.playing = false; show(G.view - 1); };
    bar.querySelector('[data-f]').onclick = () => { G.playing = false; show(G.view + 1); };
    bar.querySelector('[data-p]').onclick = () => { G.playing = !G.playing; if (G.playing && G.view >= G.turns.length) show(0); play(); show(G.view); };
    bar.querySelector('input').oninput = (e) => { G.playing = false; show(+e.target.value); };
    bar.querySelector('[data-end]')?.addEventListener('click', () => scroll());
    const last = G.events[G.view - 1] ?? [];
    const top = last.filter((e) => !e.minor).slice(0, 2).map((e) => e.text).join(' · ');
    if (top) toast(top, 2600);
  };
  const play = async () => {
    while (G.playing && G.view < G.turns.length) { await sleep(2600); if (G.playing) show(G.view + 1); }
    G.playing = false;
  };
  G.playing = G.turns.length > 0 && rec?.status !== 'running';
  show(G.playing ? 0 : G.turns.length);
  if (G.playing) play();
  // live: new turns as they are played
  if (rec?.status === 'running') {
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/run/${encodeURIComponent(G.run.id)}/live`);
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.t === 'turn' && d.n === G.turns.length) {
          const s = at(G.turns.length), r = resolve(s, C, d.inputs);
          G.turns.push(d.inputs);
          G.events.push(r.events);
          if (G.view === G.turns.length - 1) show(G.turns.length); else show(G.view);
        }
        if (d.t === 'end') { G.rec = { ...(G.rec ?? {}), ...d.run, status: 'over' }; setChip(); }
      };
      ws.onclose = () => { if (G.rec?.status === 'running') setTimeout(connect, 5000); };
      G.ws = ws;
    };
    connect();
  }
}

// ---------- the tools ----------
function setBare(on) {
  G.bare = on;
  $('#game').classList.toggle('bare', on);
  $('#hide-btn').setAttribute('aria-pressed', String(on));
  $('#show-btn').hidden = !on;
  if (!on && !G.watch) renderTurn();
}
$('#hide-btn').addEventListener('click', () => setBare(!G.bare));
$('#show-btn').addEventListener('click', () => setBare(false));
$('#brief-btn').addEventListener('click', () => G.C && briefing(G.C, { inGame: true }));
$('#zin').addEventListener('click', () => G.map?.zoomAt(1.5));
$('#zout').addEventListener('click', () => G.map?.zoomAt(1 / 1.5));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'h' || e.key === 'H') setBare(!G.bare);
  if (e.key === 'Escape') { closePop(); if (G.sel) { G.sel = null; draw(); } }
  if (e.key === 'Enter' && e.ctrlKey && !G.watch) endTurn();
});

// ---------- where to begin ----------
const params = new URLSearchParams(location.search);
if (params.get('run')) openRun(params.get('run'));
else if (params.get('c') && CAMPAIGN[params.get('c')]) briefing(CAMPAIGN[params.get('c')]);
else showMenu();
