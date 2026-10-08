// The campaigns page: the list of wars, a war's briefing, the war itself and its scroll at the end; or someone else's
// war, watched live or replayed. In a war you do not fill in forms: you speak to your council in plain words, they
// answer in character and turn your words into orders (the AI when it can, the rules otherwise), and the map shows
// what will happen. The big decisions arrive as cards in the same conversation.
import { CAMPAIGNS, CAMPAIGN } from './catalog.js';
import { newCampaign, resolve, cardsDue, withCards, PLANS, armiesOf, menOf, heroOf, goalState, atWar, fmtMen, checksum, VERDICT, incomeOf, upkeepOf, friends, courtOf, leaderOf, ENGINE, oddsOf, reach } from './engine.js';
import { proposal, interpret, summary, suggestions, normalize } from './court.js';
import { makeMap } from './map.js';
import { history as pastOf, snapOf, warRoom } from './warroom.js';
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
  council: (run, t, message, draft, chat) => post(`/api/run/${run.id}/council`, { token: run.token, t, message, draft, chat }),
  turn: (run, t, inputs, aims) => post(`/api/run/${run.id}/turn`, { token: run.token, t, inputs, aims }),
  get: (id) => fetch(`/api/run/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)),
  runs: () => fetch('/api/runs').then((r) => (r.ok ? r.json() : { live: [], recent: [] })).catch(() => ({ live: [], recent: [] })),
  claim: (run, body) => post(`/api/run/${run.id}/claim`, { token: run.token, ...body }),
};
const ART = new Set();
fetch('/art/manifest.json').then((r) => r.json()).then((m) => (m.events ?? []).forEach((k) => ART.add(k))).catch(() => {});
const artOf = (k) => (k && ART.has(k) ? `/art/events/${k}.webp` : null);

// ---------- small pieces of markup ----------
const face = (who, color, size = 64, uid = '') => (who.art ? `<img class="painted" src="/art/people/${encodeURIComponent(who.art)}.webp" alt="" width="${size}" height="${size}">` : portrait({ id: who.name, name: who.name, culture: who.look ?? 'roman', female: !!who.female, role: 'general', title: who.title ?? '' }, { color, age: who.age ?? 40, size, uid }));
const stars = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;
const meter = (v, col) => `<span class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></span>`;
const turnLabel = (C, t) => C.turns[Math.min(t, C.turns.length - 1)].label;
function toast(text, ms = 3600) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), ms);
}
const sheet = $('#sheet');
function openSheet(html, { onClose, wide = false } = {}) {
  sheet.innerHTML = `<div class="panel">${html}</div>`;
  sheet.classList.toggle('wide', wide);
  sheet.onclose = () => onClose?.();
  if (!sheet.open) sheet.showModal();
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
  return sheet;
}
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

// ---------- the menu ----------
function showMenu() {
  $('#menu').hidden = false;
  $('#game').hidden = true;
  document.title = 'Campaigns · Agentistan';
  const best = store.get(BEST, {}), going = Object.values(myRuns()).filter((r) => !r.done && (r.v ?? 1) === ENGINE);
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
    const rows = [...live.map((r) => ({ ...r, live: true })), ...recent.slice(0, 6)].filter((r) => CAMPAIGN[r.cid]);
    if (!rows.length) return;
    box.hidden = false;
    box.innerHTML = `<h2>${live.length ? 'Being played now, and lately' : 'Lately'}</h2><ul>${rows.map((r) => `<li><a href="?run=${encodeURIComponent(r.id)}">${r.live ? '<i class="dot"></i>' : r.stars ? stars(r.stars) : ''} ${esc(CAMPAIGN[r.cid].title)}${r.name ? ` · ${esc(r.name)}` : ''} <small>${r.live ? `season ${r.turn + 1}` : esc(VERDICT[r.verdict] ?? '')}</small></a></li>`).join('')}</ul>`;
  });
}

// ---------- the briefing ----------
function briefing(C, { inGame = false } = {}) {
  if (!inGame) showMenu();
  const sides = Object.entries(C.sides).filter(([id]) => C.armies.some((a) => a[0] === id) || C.provinces.some((p) => p[4] === id));
  const menAt = (id) => C.armies.filter((a) => a[0] === id).reduce((t, a) => t + a[2], 0);
  const going = Object.values(myRuns()).filter((r) => r.cid === C.id && !r.done && (r.v ?? 1) === ENGINE).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  const art = artOf(C.art ?? 'war'), adv = (C.court ?? [C.advisor]).filter(Boolean)[0];
  openSheet(`<button class="x" data-close aria-label="Close">×</button>
    ${art ? `<img class="art" src="${art}" alt="">` : ''}
    <div class="brief-head">${face(C.hero, C.sides[C.you].color, 76, 'brief')}<div><h2>${esc(C.title)}</h2><p class="sub">${esc(C.years)} · you are <b>${esc(C.hero.name)}</b>, ${esc(C.hero.title)}</p></div></div>
    ${C.brief.map((p) => `<p>${esc(p)}</p>`).join('')}
    <div class="goal"><b>Your goal:</b> ${esc(C.goal.text)}. You have ${C.turns.length} seasons, from ${esc(C.turns[0].label)} to ${esc(C.turns.at(-1).label)}.</div>
    <div class="forces">${sides.map(([id, d]) => `<div style="--c:${d.color}"><b>${esc(d.name)}</b>${esc(d.leader ?? '')}<br><small>${fmtMen(menAt(id))} men${id === C.you ? ' · you' : ''}</small></div>`).join('')}</div>
    <div class="howto"><b>How to play.</b> You command through your council${adv ? `, ${esc(adv.name)} first among them` : ''}. Speak to them in plain words, as a commander would: <i>“Hasdrubal, hold Spain. We march on Capua, and if Varro comes, we envelop him.”</i> They answer, and turn your words into orders you see on the map. Ask them anything: where the enemy is, what a siege would cost. The great decisions come as cards in the conversation; afterwards you learn what the real ${esc(C.hero.name.split(' ')[0])} chose. When you are ready, end the season: everyone moves at once, and the dispatches tell you what happened, and what happened in history.</div>
    <div class="share">${inGame ? '<button class="btn main" data-close>To the council</button>' : `${going ? `<a class="btn main" href="?run=${going.id}">Continue your campaign</a><button class="btn" data-begin>Start again</button>` : '<button class="btn main" data-begin>Begin the campaign</button>'}<a class="btn" href="/campaign/">All campaigns</a>`}</div>`, { onClose: () => { if (!inGame && !G.C) history.replaceState(null, '', '/campaign/'); } });
  sheet.querySelector('[data-begin]')?.addEventListener('click', () => { sheet.close(); startRun(C); });
}

// ---------- a war ----------
const G = { C: null, data: null, map: null, run: null, s: null, pre: null, turns: [], events: [], snaps: [], draft: null, aims: {}, sel: null, busy: false, watch: false, bare: false, chat: [], thinking: false };

async function startRun(C) {
  let run;
  const name = store.get(NAME, '') || null;
  try {
    const r = await api.start(C.id, name);
    run = { id: r.id, token: r.token, seed: r.seed, cid: C.id, at: Date.now(), v: r.v ?? ENGINE };
  } catch {
    run = { id: `local-${Math.random().toString(36).slice(2, 10)}`, seed: 1 + Math.floor(Math.random() * 1e6), cid: C.id, local: true, turns: [], at: Date.now(), v: ENGINE };
  }
  saveRun(run);
  history.replaceState(null, '', `?run=${encodeURIComponent(run.id)}`);
  await loadGame(C, run, []);
}
async function openRun(id) {
  const mine = myRuns()[id];
  if (mine?.local) {
    if ((mine.v ?? 1) !== ENGINE || !CAMPAIGN[mine.cid]) return oldRun(CAMPAIGN[mine.cid]);
    return loadGame(CAMPAIGN[mine.cid], mine, mine.turns ?? []);
  }
  const rec = await api.get(id).catch(() => null);
  if (!rec || !CAMPAIGN[rec.cid]) { showMenu(); toast('That campaign could not be found.'); return; }
  if (rec.old) return oldRun(CAMPAIGN[rec.cid], rec);
  const run = mine?.token ? { ...mine, seed: rec.seed } : { id, cid: rec.cid, seed: rec.seed, watch: true };
  await loadGame(CAMPAIGN[rec.cid], run, rec.turns ?? [], rec);
}
// A campaign begun under older rules cannot be replayed faithfully: say so, kindly, and offer it again.
function oldRun(C, rec = null) {
  showMenu();
  openSheet(`<button class="x" data-close aria-label="Close">×</button><h2>${esc(C?.title ?? 'This campaign')}</h2>
    <p>This campaign was begun under an older version of the rules, which have changed since. It cannot go on as it was, and a replay would not be true to it.</p>
    ${rec?.summary ? `<div class="history"><h4>What the historian wrote</h4><p>${esc(rec.summary)}</p></div>` : ''}
    <div class="share">${C ? `<a class="btn main" href="?c=${C.id}">Begin it again</a>` : ''}<a class="btn" href="/campaign/">All campaigns</a></div>`);
}

async function loadGame(C, run, turns, rec = null) {
  Object.assign(G, { C, run, turns: turns.slice(), events: [], sel: null, watch: !!run.watch, rec, chat: [], aims: run.aims ?? {} });
  $('#menu').hidden = true;
  $('#game').hidden = false;
  $('#chat').innerHTML = '';
  document.title = `${C.title} · Agentistan`;
  try {
    G.data = await fetch(`/campaign/maps/${C.id}.json`).then((r) => r.json());
    G.map = makeMap($('#map'), G.data, C, { army: onArmy, province: onProvince, target: onTarget, empty: () => { closePop(); if (G.sel) { G.sel = null; draw(); } }, inset: () => (G.watch || G.bare ? 0 : $('#court').offsetWidth + 24) });
    let s = newCampaign(C, run.seed);
    for (const inp of G.turns) { const r = resolve(s, C, inp); G.events.push(r.events); s = r.state; }
    G.s = s;
    G.snaps = pastOf(C, run.seed, G.turns);
  } catch (err) {
    console.error(err);
    return oldRun(C);
  }
  if (G.watch || (rec && rec.status && rec.status !== 'running' && !run.token)) return watchMode(rec);
  $('#court').hidden = false;
  G.map.fit();
  if (G.s.status !== 'running') { draw(); return scroll(); }
  if (!G.turns.length && !sheet.open) briefing(C, { inGame: true });
  if (G.turns.length) dispatch(G.events.at(-1), G.s, G.turns.length - 1, { quiet: true });
  newTurn();
}

// ---------- the season: cards, counsel, your words ----------
function newTurn() {
  const C = G.C, s = G.s;
  G.sel = null;
  G.draft = proposal(C, s, G.aims);
  G.pre = s;
  chat({ kind: 'divider', text: turnLabel(C, s.turn), sub: `season ${s.turn + 1} of ${C.turns.length}` });
  for (const c of cardsDue(C, s)) chat({ kind: 'card', card: c });
  const adv = courtOf(C, s)[0];
  G.shown = null;
  postOrders('Unless you say otherwise, this is what we will do this season:');
  draw();
  if (!G.run.local) {
    G.thinking = adv?.name ?? true;
    showChips();
    api.plan(G.run, s.turn).then((p) => {
      G.thinking = false;
      if (p.proposal && !G.touched) { G.draft = normalize(C, s, { ...p.proposal, cards: G.draft.cards, aims: G.aims }, {}).draft; refreshOrders(); }
      if (p.advice?.length) chat({ kind: 'msg', who: adv?.id, text: p.advice.join(' '), by: p.by });
      draw();
    }).catch(() => { G.thinking = false; showChips(); });
  }
  G.touched = false;
  showChips();
}
function refreshPre() { G.pre = withCards(G.C, G.s, G.draft.cards); }

// The things that can speak in your council: advisers, your generals, envoys, the dispatches.
function speaker(id) {
  const C = G.C, s = G.pre ?? G.s;
  if (id === 'you') return { name: heroOf(s)?.gen ?? C.hero.name, title: 'you', look: C.hero.look, art: C.hero.art, color: C.sides[C.you].color };
  const p = courtOf(C, s).find((x) => x.id === id) ?? courtOf(C, G.s).find((x) => x.id === id);
  if (p) return { ...p, color: C.sides[C.you].color };
  if (id?.startsWith('side:')) { const side = id.slice(5); return { name: `Envoy of ${C.sides[side].name}`, title: `for ${leaderOf(C, s, side)}`, look: C.sides[side].look ?? C.hero.look, color: C.sides[side].color }; }
  const first = courtOf(C, s)[0];
  return first ? { ...first, color: C.sides[C.you].color } : { name: 'Your council', look: C.hero.look, color: C.sides[C.you].color };
}

// ---------- the conversation ----------
function chat(m) {
  G.chat.push(m);
  const li = document.createElement('li');
  li.className = `m ${m.kind}${m.who === 'you' ? ' you' : ''}`;
  li.innerHTML = msgHTML(m);
  $('#chat').append(li);
  m.li = li;
  wire(li, m);
  li.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return li;
}
function msgHTML(m) {
  const C = G.C;
  if (m.kind === 'divider') return `<span>${esc(m.text)}</span><small>${esc(m.sub ?? '')}</small>`;
  if (m.kind === 'history') return `<h4>Meanwhile, in history</h4><p>${esc(m.text)}</p>`;
  if (m.kind === 'dispatch') return `<h4>${esc(m.title)}</h4><ul class="news">${m.items}</ul>`;
  if (m.kind === 'orders') {
    const who = speaker(m.who);
    return `<div class="who">${face(who, who.color, 30, 'o')}<b>${esc(who.name)}</b></div><p>${esc(m.lead)}</p><ul class="plan">${summary(C, G.s, G.draft).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  if (m.kind === 'card') {
    const c = m.card, chosen = G.draft?.cards?.[c.id], art = artOf(c.art), adv = c.options[c.advise ?? 0]?.label;
    return `${art ? `<img class="art" src="${art}" alt="" loading="lazy">` : ''}<h4>${esc(c.title)}</h4><p>${esc(c.text)}</p>
      <div class="opts">${c.options.map((o, i) => `<button class="opt${chosen === i ? ' chosen' : ''}" data-opt="${i}"${chosen !== undefined && chosen !== i ? ' disabled' : ''}><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}${fxText(C, o.fx) ? `<span class="fx">${esc(fxText(C, o.fx))}</span>` : ''}</button>`).join('')}</div>
      ${c.peace ? '' : chosen === undefined ? `<p class="advice">${esc(speaker(courtOf(C, G.s)[0]?.id).name)} would choose “${esc(adv)}”. Choose, or say what you will do.</p>` : ''}
      ${chosen !== undefined && c.history ? `<div class="history"><h4>What history did</h4><p>${esc(c.history)}${c.pick !== undefined ? ` <b>(${esc(c.options[c.pick].label)})</b>` : ''}</p></div>` : ''}`;
  }
  const who = speaker(m.who);
  return `${m.who === 'you' ? '' : `<div class="face">${face(who, who.color, 36, `c${G.chat.length}`)}</div>`}<div class="bubble">${m.who === 'you' ? '' : `<b>${esc(who.name)}</b>${who.title ? `<small>${esc(who.title)}</small>` : ''}`}<p>${esc(m.text)}</p>${m.by === 'rules' && m.who !== 'you' ? '' : ''}</div>`;
}
function wire(li, m) {
  if (m.kind === 'card') li.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answerCard(m.card, +b.dataset.opt)));
}
function refreshCards() { for (const m of G.chat) if (m.kind === 'card' && m.li && !m.done) { m.li.innerHTML = msgHTML(m); wire(m.li, m); if (G.draft.cards[m.card.id] !== undefined) m.done = true; } }
// The standing orders: one message, which moves to the end of the conversation when the orders change.
function postOrders(lead) {
  const now = JSON.stringify(summary(G.C, G.s, G.draft));
  if (now === G.shown) return;
  G.shown = now;
  const old = [...G.chat].reverse().find((x) => x.kind === 'orders' && x.t === G.s.turn);
  if (old) { old.li?.remove(); G.chat.splice(G.chat.indexOf(old), 1); }
  chat({ kind: 'orders', who: courtOf(G.C, G.s)[0]?.id, lead, t: G.s.turn });
}
function refreshOrders() {
  const m = [...G.chat].reverse().find((x) => x.kind === 'orders');
  if (m?.li) { m.li.innerHTML = msgHTML(m); G.shown = JSON.stringify(summary(G.C, G.s, G.draft)); }
  showChips();
}
function answerCard(c, i) {
  if (G.draft.cards[c.id] !== undefined || G.busy) return;
  G.touched = true;
  G.draft.cards[c.id] = i;
  // the card may move your armies: orders it made impossible are given again by your council
  const keep = { ...G.draft.orders };
  const fresh = proposal(G.C, G.s, G.aims, G.draft.cards);
  const ps = withCards(G.C, G.s, G.draft.cards);
  for (const [id, o] of Object.entries(keep)) if (!ps.armies[id] || (o?.to && !reach(G.C, ps, id)[o.to])) keep[id] = fresh.orders[id];
  G.draft = normalize(G.C, G.s, { ...G.draft, orders: { ...fresh.orders, ...keep } }, {}).draft;
  refreshPre();
  refreshCards();
  refreshOrders();
  draw();
}
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
  if (fx.spawn) out.push('an army takes the field');
  return out.join(' · ');
}

// Your words to the council.
async function say(text) {
  text = text.trim();
  if (!text || G.busy || G.watch) return;
  G.touched = true;
  chat({ kind: 'msg', who: 'you', text });
  $('#say-text').value = '';
  autosize();
  const C = G.C, s = G.s;
  G.thinking = speaker(courtOf(C, s)[0]?.id).name;
  showChips();
  let r;
  if (!G.run.local) {
    try { r = await api.council(G.run, s.turn, text, G.draft, G.chat.filter((m) => m.kind === 'msg').slice(-8).map((m) => ({ who: m.who, name: m.who === 'you' ? 'COMMANDER' : speaker(m.who).name, text: m.text }))); }
    catch (err) { if (err.status === 410) return oldRun(C); r = null; }
  }
  r ??= interpret(C, s, G.draft, text);
  G.thinking = false;
  const before = JSON.stringify(G.draft.cards);
  G.draft = r.draft;
  G.aims = { ...G.aims, ...(r.draft.aims ?? {}) };
  for (const x of r.replies ?? []) chat({ kind: 'msg', who: x.who, text: x.text, by: r.by });
  if (JSON.stringify(G.draft.cards) !== before) { refreshCards(); refreshPre(); }
  postOrders('The orders now stand:');
  draw();
  showChips();
  if (r.end) endTurn();
}
function showChips() {
  const box = $('#chips');
  if (!G.s || G.s.status !== 'running' || G.watch) { box.innerHTML = ''; return; }
  if (G.thinking) { box.innerHTML = `<span class="thinking">${esc(typeof G.thinking === 'string' ? G.thinking : 'Your council')} is thinking…</span>`; return; }
  box.innerHTML = suggestions(G.C, G.s, G.draft).map((t) => `<button class="chip" type="button">${esc(t)}</button>`).join('');
  box.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    const c = cardsDue(G.C, G.s).find((x) => x.options.some((o) => o.label === b.textContent) && G.draft.cards[x.id] === undefined);
    if (c) return answerCard(c, c.options.findIndex((o) => o.label === b.textContent));
    say(b.textContent);
  }));
}
function autosize() { const t = $('#say-text'); t.style.height = 'auto'; t.style.height = `${Math.min(120, t.scrollHeight)}px`; }

function draw() {
  if (!G.s) return;
  const view = G.watch ? G.s : G.pre ?? G.s;
  G.map.paint(view, { sel: G.watch ? null : G.sel, orders: G.watch ? {} : G.draft?.orders ?? {}, you: G.C.you });
  renderHud(view);
}
function renderHud(s) {
  const C = G.C, you = C.you, st = s.sides[you], g = goalState(C, s), net = Math.round(incomeOf(C, s, you) - upkeepOf(C, s, you));
  const foe = C.goal.foe ?? Object.keys(C.sides).find((x) => x !== you && atWar(s, you, x));
  const hero = heroOf(s);
  $('#hud').innerHTML = `<div class="face">${face({ ...C.hero, name: hero?.gen ?? C.hero.name }, C.sides[you].color, 56, 'hud')}</div>
    <div><h1>${esc(hero?.gen ?? C.hero.name)}</h1>
      <div class="date">${esc(turnLabel(C, s.turn))} · season ${Math.min(s.turn + 1, C.turns.length)} of ${C.turns.length}</div>
      <div class="meters">
        <span title="Gold, and what it gains or loses each season after paying the armies">Gold <b>${Math.round(st.gold)}</b> <small>${net >= 0 ? '+' : ''}${net}</small></span>
        <span title="All your soldiers">Men <b>${fmtMen(menOf(s, you))}</b></span>
        <span title="Your side's will to fight: at 0 you are recalled">Will <b>${Math.round(st.will)}</b>${meter(st.will, st.will > 40 ? '#4f7a3a' : '#a3361f')}</span>
        ${foe ? `<span title="${esc(g.text)}">${esc(C.sides[foe].short ?? C.sides[foe].name)} <b>${Math.round(s.sides[foe].will)}</b>${meter(s.sides[foe].will, C.sides[foe].color)}</span>` : ''}
        <span class="goalmeter" title="${esc(g.text)}">Goal ${meter(g.progress * 100, '#27466e')}</span>
      </div>
    </div>`;
}

// ---------- the map: taps help you speak ----------
function onArmy(id, e) {
  const s = G.pre ?? G.s, a = s.armies[id];
  if (!a) return;
  if (!G.watch && a.side === G.C.you && G.s.status === 'running') {
    G.sel = G.sel === id ? null : id;
    closePop();
    draw();
    if (G.sel) { prefill(a.hero ? 'We ' : `${(a.gen ?? 'Army').split(' ')[0]}, `); toast('Tap a lit place on the map to send this army there, or say what it should do.'); }
    return;
  }
  infoPop(a.at, e);
}
function onProvince(pid, e) {
  if (G.sel && !G.watch) { const r = reach(G.C, G.pre ?? G.s, G.sel); if (r[pid]) return onTarget(pid, e); }
  infoPop(pid, e);
}
function onTarget(pid) {
  const s = G.pre ?? G.s, a = s.armies[G.sel];
  if (!a) return;
  const o = oddsOf(G.C, s, a.id, pid), P = G.C.prov[pid].name, who = a.hero ? 'We' : `${(a.gen ?? 'Army').split(' ')[0]},`;
  prefill(o.kind === 'battle' ? `${who} attack at ${P}` : o.kind === 'siege' ? `${who} besiege ${P}` : `${who} march to ${P}`);
  G.sel = null;
  draw();
}
function prefill(text) { const t = $('#say-text'); t.value = text; autosize(); t.focus(); t.setSelectionRange(text.length, text.length); }

// ---------- popovers ----------
function closePop() { $('#pop').hidden = true; }
function infoPop(pid, e) {
  const C = G.C, s = G.watch ? G.s : G.pre ?? G.s, P = C.prov[pid], st = s.prov[pid], pop = $('#pop');
  const here = Object.values(s.armies).filter((a) => a.at === pid);
  pop.innerHTML = `<button class="x" aria-label="Close">×</button><h3>${esc(P.name)}</h3>
    <dl><dt>Held by</dt><dd>${st.owner ? `<b style="color:${C.sides[st.owner].color}">${esc(C.sides[st.owner].name)}</b>, led by ${esc(leaderOf(C, s, st.owner))}` : 'no one'}</dd>
    <dt>Ground</dt><dd>${esc(P.terrain)}${P.lake ? ', a lake shore' : ''}${P.narrows ? ', a narrow pass' : ''}${P.port ? ', a port' : ''}</dd>
    ${st.walls ? `<dt>Walls</dt><dd>${'▮'.repeat(st.walls)} · garrison ${fmtMen(st.garrison)}${st.siege ? ` · besieged (${st.siege} of ${st.walls})` : ''}</dd>` : ''}
    <dt>Wealth</dt><dd>${'●'.repeat(P.wealth) || '–'}</dd>
    ${here.map((a) => `<dt>Army</dt><dd><b style="color:${C.sides[a.side].color}">${esc(a.gen ?? C.sides[a.side].name)}</b> · ${fmtMen(a.men)} · ${esc(C.sides[a.side].short ?? C.sides[a.side].name)}</dd>`).join('')}</dl>
    <div class="share"><button class="btn" data-war>The war room</button>${!G.watch && G.s.status === 'running' ? `<button class="btn" data-ask>Ask about ${esc(P.name)}</button>` : ''}</div>`;
  pop.hidden = false;
  const w = pop.offsetWidth || 300, h = pop.offsetHeight || 220;
  pop.style.left = `${Math.min(innerWidth - w - 12, Math.max(12, (e?.clientX ?? innerWidth / 2) + 14))}px`;
  pop.style.top = `${Math.min(innerHeight - h - 12, Math.max(12, (e?.clientY ?? innerHeight / 2) - 20))}px`;
  pop.querySelector('.x').onclick = closePop;
  pop.querySelector('[data-war]').onclick = () => { closePop(); openWarRoom(); };
  pop.querySelector('[data-ask]')?.addEventListener('click', () => { closePop(); prefill(`What do we know of ${P.name}?`); });
}
function openWarRoom() {
  const C = G.C, s = G.watch ? G.s : G.pre ?? G.s;
  const snaps = G.watch ? G.snaps.slice(0, (G.view ?? G.snaps.length - 1) + 1) : [...G.snaps];
  openSheet(`<button class="x" data-close aria-label="Close">×</button>${warRoom(C, s, snaps, { face, esc, label: turnLabel(C, s.turn) })}`, { wide: true });
}

// ---------- the end of a season ----------
async function endTurn() {
  if (G.busy || G.s.status !== 'running' || G.watch) return;
  G.busy = true;
  closePop();
  G.sel = null;
  $('#end-turn').disabled = true;
  $('#end-turn').textContent = 'The season unfolds…';
  const C = G.C, before = G.s;
  const inputs = { orders: G.draft.orders, raise: G.draft.raise, cards: G.draft.cards, peace: Object.fromEntries(Object.entries(G.draft.peace ?? {}).filter(([, v]) => v)) };
  let final = inputs, chk = null;
  if (!G.run.local) {
    try {
      const res = await api.turn(G.run, before.turn, inputs, G.aims);
      final = res.inputs;
      chk = res.chk;
    } catch (err) {
      G.busy = false;
      $('#end-turn').disabled = false;
      $('#end-turn').textContent = 'End the season';
      if (err.status === 410) return oldRun(C);
      if (err.status === 409 && err.body?.turns) return openRun(G.run.id); // the server is ahead of this page
      return toast(err.status ? `The season could not end: ${err.message}` : 'The server cannot be reached. Try again in a moment.');
    }
  }
  const r = resolve(before, C, final);
  if (chk && checksum(r.state) !== chk) { console.warn('this replay strays from the server: reloading'); G.busy = false; return openRun(G.run.id); }
  G.turns.push(final);
  G.events.push(r.events);
  G.s = r.state;
  G.pre = r.state;
  G.snaps.push(snapOf(C, r.state));
  for (const [id, aim] of Object.entries(G.aims)) if (!r.state.armies[id] || r.state.prov[aim]?.owner === C.you) delete G.aims[id];
  if (G.run.local) Object.assign(G.run, { turns: G.turns });
  saveRun({ ...G.run, at: Date.now(), turn: G.s.turn, aims: G.aims });
  draw();
  G.map.clash(r.events);
  G.busy = false;
  $('#end-turn').disabled = false;
  $('#end-turn').textContent = 'End the season';
  dispatch(r.events, r.state, before.turn);
  if (G.s.status !== 'running') { showChips(); return setTimeout(scroll, 900); }
  newTurn();
}

const GOOD = new Set(['victory', 'submits']), BAD = new Set(['defeat', 'hero', 'unpaid']);
function news(C, s, e) {
  const you = C.you, mine = (x) => x === you || friends(s, you, x);
  let cls = '';
  if (e.type === 'battle') cls = mine(e.winner) ? 'good' : (e.sides ?? []).some(mine) ? 'bad' : '';
  else if (['capture', 'starved', 'storm'].includes(e.type)) cls = mine(e.sides?.[0]) ? 'good' : mine(e.sides?.[1]) ? 'bad' : '';
  else if (GOOD.has(e.type)) cls = 'good';
  else if (BAD.has(e.type)) cls = 'bad';
  let more = '';
  if (e.type === 'battle' && e.plans) {
    const side = mine(e.sides?.[0]) ? 'a' : mine(e.sides?.[1]) ? 'd' : null;
    if (side) {
      const p = e.plans[side], q = e.plans[side === 'a' ? 'd' : 'a'], lost = e.lost[side === 'a' ? 0 : 1], killed = e.lost[side === 'a' ? 1 : 0];
      const how = p.fit >= 0.5 ? 'it suited the ground and the armies' : p.fit >= 0 ? 'it served' : 'it did not suit the ground or the armies';
      more = `<small>Our plan: ${esc(PLANS[p.id]?.name ?? p.id)}${p.by === 'general' ? ' (the general’s choice)' : ''}; ${how}. Theirs: ${esc(PLANS[q.id]?.name ?? q.id)}. We lost ${fmtMen(lost)}, they lost ${fmtMen(killed)}.</small>`;
    }
  }
  return `<li class="${cls}"><span>${esc(e.text)}${more}</span></li>`;
}
// The season's dispatches, into the conversation: what happened, what the enemy declared, and what history did.
function dispatch(events, s, t, { quiet = false } = {}) {
  const C = G.C;
  const fell = new Set(events.filter((e) => ['starved', 'storm'].includes(e.type)).map((e) => e.at));
  const shown = events.filter((e) => e.type !== 'card' && (!e.minor || (e.sides ?? []).includes(C.you)) && !(e.type === 'capture' && fell.has(e.at))).slice(0, 12);
  chat({ kind: 'dispatch', title: `Dispatches: ${turnLabel(C, t)}`, items: shown.length ? shown.map((e) => news(C, s, e)).join('') : '<li>A quiet season: the armies march and watch each other.</li>' });
  // what the other sides declare: only those at war with you, or allied to you, and the two that matter most
  const said = Object.entries(s.said ?? {}).filter(([side]) => C.sides[side] && side !== C.you && (atWar(s, C.you, side) || friends(s, C.you, side)))
    .sort(([a], [b]) => atWar(s, C.you, b) - atWar(s, C.you, a) || menOf(s, b) - menOf(s, a)).slice(0, 2);
  for (const [side, line] of said) chat({ kind: 'msg', who: `side:${side}`, text: line });
  if (C.turns[t]?.history) chat({ kind: 'history', text: C.turns[t].history });
  if (quiet) return;
  const big = events.find((e) => ['victory', 'defeat'].includes(e.type)) ?? events.find((e) => e.type === 'battle' && e.decisive && (e.sides ?? []).includes(C.you)) ?? events.find((e) => e.type === 'capture' && e.capital);
  if (big) toast(big.text, 5000);
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
    <div class="stats"><span><b>${st.won}</b>battles won</span><span><b>${st.lost}</b>battles lost</span><span><b>${st.taken}</b>cities taken</span><span><b>${fmtMen(st.dead)}</b>of your men fell</span><span><b>${(s.end?.turn ?? s.turn) + 1}</b>seasons</span></div>
    <div class="history"><h4>How it really ended</h4><p>${esc(C.history.text)}</p></div>
    <div class="history"><h4>The historian’s judgement</h4><p id="summary" class="thinking">${G.rec?.summary ? esc(G.rec.summary) : G.run.local ? esc(localSummary(C, s)) : 'The historian is writing…'}</p></div>
    <details open><summary><b>Your war, beside history’s</b></summary><div class="timeline"><div class="h">When</div><div class="h">Your war</div><div class="h">History</div>${rows}</div></details>
    <div class="share"><button class="btn" data-war>The war room</button></div>
    ${link ? `<div class="share"><input readonly value="${esc(link)}" aria-label="The link to this campaign"><button class="btn" data-copy>Copy the link</button></div>` : '<p class="fine">This campaign was played without the server, so it has no link to share and no NFT.</p>'}
    ${link && !G.watch ? `<div class="nft" id="nft"><img src="/nft/${esc(G.rec?.token ?? '')}.svg" alt="" hidden><div><b>Keep this scroll as an NFT</b><p class="sub">A token on Base Sepolia (a test network: no money value), with your verdict and this summary. The game pays the fees.</p><div id="nft-box"></div></div></div>` : ''}
    <div class="share">${!G.watch ? `<a class="btn main" href="?c=${C.id}">Play it again</a>` : ''}${next ? `<a class="btn" href="?c=${next.id}">Next: ${esc(next.title)}</a>` : ''}<a class="btn" href="/campaign/">All campaigns</a></div>`, {});
  sheet.querySelector('[data-copy]')?.addEventListener('click', () => { navigator.clipboard?.writeText(link); toast('The link is copied.'); });
  sheet.querySelector('[data-war]')?.addEventListener('click', openWarRoom);
  if (link && !G.watch) nftBox();
  if (!G.run.local && !G.rec?.summary) waitForSummary();
}
function localSummary(C, s) {
  const v = s.verdict?.as ?? 'as';
  return `${C.hero.name} ${s.status === 'won' ? 'achieved the goal' : 'fought on to the end'}: ${s.stats.won} battles won, ${s.stats.lost} lost, ${s.stats.taken} cities taken. ${v === 'better' ? 'A better ending than history’s.' : v === 'as' ? 'History would recognise this war.' : 'History went better than this.'}`;
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
  $('#court').hidden = true;
  $('#game').classList.add('watching-run');
  const bar = document.createElement('div');
  bar.className = 'replay panel';
  bar.id = 'replay';
  $('#game').append(bar);
  const chip = document.createElement('div');
  chip.className = 'watching panel';
  $('#game').append(chip);
  const setChip = () => { chip.innerHTML = `${G.rec?.status === 'running' ? '<i class="dot"></i> Live' : 'Replay'} · ${esc(G.rec?.name ?? 'Someone')} as ${esc(C.hero.name)}`; };
  setChip();
  const at = (n) => { let s = newCampaign(C, G.run.seed); for (let i = 0; i < n; i++) s = resolve(s, C, G.turns[i]).state; return s; };
  const show = (n) => {
    G.view = Math.max(0, Math.min(G.turns.length, n));
    G.s = at(G.view);
    draw();
    if (G.view > 0) G.map.clash(G.events[G.view - 1] ?? []);
    bar.innerHTML = `<button class="round" data-b aria-label="Back">‹</button><button class="round" data-p aria-label="Play">${G.playing ? '❚❚' : '▶'}</button><button class="round" data-f aria-label="Forward">›</button><input type="range" min="0" max="${G.turns.length}" value="${G.view}" aria-label="Season"><small>${esc(turnLabel(C, G.view))}</small>${G.s.status !== 'running' ? '<button class="btn" data-end>The scroll</button>' : ''}`;
    bar.querySelector('[data-b]').onclick = () => { G.playing = false; show(G.view - 1); };
    bar.querySelector('[data-f]').onclick = () => { G.playing = false; show(G.view + 1); };
    bar.querySelector('[data-p]').onclick = () => { G.playing = !G.playing; if (G.playing && G.view >= G.turns.length) show(0); play(); show(G.view); };
    bar.querySelector('input').oninput = (e) => { G.playing = false; show(+e.target.value); };
    bar.querySelector('[data-end]')?.addEventListener('click', () => scroll());
    const top = (G.events[G.view - 1] ?? []).filter((e) => !e.minor).slice(0, 2).map((e) => e.text).join(' · ');
    if (top) toast(top, 2600);
  };
  const play = async () => {
    while (G.playing && G.view < G.turns.length) { await sleep(2600); if (G.playing) show(G.view + 1); }
    G.playing = false;
  };
  G.playing = G.turns.length > 0 && rec?.status !== 'running';
  show(G.playing ? 0 : G.turns.length);
  if (G.playing) play();
  if (rec?.status === 'running') {
    const connect = () => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/run/${encodeURIComponent(G.run.id)}/live`);
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.t === 'turn' && d.n === G.turns.length) {
          const s = at(G.turns.length), r = resolve(s, C, d.inputs);
          G.turns.push(d.inputs);
          G.events.push(r.events);
          G.snaps.push(snapOf(C, r.state));
          if (G.view === G.turns.length - 1) show(G.turns.length); else show(G.view);
        }
        if (d.t === 'end') { G.rec = { ...(G.rec ?? {}), ...d.run, status: 'over' }; setChip(); }
      };
      ws.onclose = () => { if (G.rec?.status === 'running') setTimeout(connect, 5000); };
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
  if (on) closePop();
}
$('#hide-btn').addEventListener('click', () => setBare(!G.bare));
$('#show-btn').addEventListener('click', () => setBare(false));
$('#brief-btn').addEventListener('click', () => G.C && briefing(G.C, { inGame: true }));
$('#war-btn').addEventListener('click', () => G.C && openWarRoom());
$('#zin').addEventListener('click', () => G.map?.zoomAt(1.5));
$('#zout').addEventListener('click', () => G.map?.zoomAt(1 / 1.5));
$('#end-turn').addEventListener('click', endTurn);
$('#say').addEventListener('submit', (e) => { e.preventDefault(); say($('#say-text').value); });
$('#say-text').addEventListener('input', autosize);
$('#say-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); say($('#say-text').value); } });
$('#court-toggle').addEventListener('click', () => $('#court').classList.toggle('open'));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.target.closest('textarea')) { e.target.blur(); return; }
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'h' || e.key === 'H') setBare(!G.bare);
  if (e.key === 'w' || e.key === 'W') G.C && openWarRoom();
  if (e.key === 'Escape') { closePop(); if (G.sel) { G.sel = null; draw(); } }
});
addEventListener('error', (e) => { console.error(e.error ?? e.message); toast('Something went wrong on this page. Reload to carry on: your campaign is saved.', 7000); });
addEventListener('unhandledrejection', (e) => { console.error(e.reason); });

// ---------- where to begin ----------
const params = new URLSearchParams(location.search);
if (params.get('run')) openRun(params.get('run'));
else if (params.get('c') && CAMPAIGN[params.get('c')]) briefing(CAMPAIGN[params.get('c')]);
else showMenu();
