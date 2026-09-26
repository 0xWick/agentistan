import { LENS, TECH } from './lens.js';
import './theme.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u ?? '') ? u : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = 50; // SVG units per tile
const KIND = { '.': 'plains', f: 'forest', m: 'mountain', '~': 'river', F: 'fort', C: 'capital' };
const STAGES = [
  { id: 'event', name: 'Event', hint: 'the clock starts a turn' },
  { id: 'n8n', name: 'n8n', hint: 'an automation routes it' },
  { id: 'agent', name: 'AI General', hint: 'decides, using tools' },
  { id: 'game', name: 'Game', hint: 'the rules are applied' },
  { id: 'chain', name: 'Chain', hint: 'a receipt is written' },
];
const pipeStage = (e) => (e.type === 'turn.started' ? 'event' : ['n8n', 'agent', 'chain', 'game'].includes(e.stage) ? e.stage : null);
const ASKED = +new URLSearchParams(location.search).get('season') || 0; // /?season=N opens that season's recording

let meta = null; // live server metadata: map, cast, chain, AI status, branding, next turn
let S = null; // what is on screen: one snapshot of the world, plus meta
let events = []; // events up to the timeline position, oldest first
let pinned = null;
let filter = 'all';
let lensAt = 0;
let dismissedSeason = 0;

// ---------- timeline: the season's recording plus whatever arrives live ----------
// Lines are {k:'s', s: snapshot} or {k:'e', e: event} in order; the slider position is a line index.
const TL = { season: 0, past: false, lines: [], snaps: [], evs: [], turns: [], maxId: 0, pos: 0, live: true, playing: false, speed: 1, gen: 0 };
const last = () => TL.lines.length - 1;
const countUpTo = (arr, p) => { // how many entries of the sorted array are <= p
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= p) lo = m + 1;
    else hi = m;
  }
  return lo;
};
const snapKey = (s) => JSON.stringify([s.state, s.counters, s.proofs, s.journals, s.lessons]);
const turnOf = (e) => +(/t(\d+)$/.exec(e?.traceId ?? '')?.[1] ?? 0);

function reset(season) {
  Object.assign(TL, { season, lines: [], snaps: [], evs: [], turns: [], maxId: 0, pos: 0 });
}

function add(line) {
  const i = TL.lines.push(line) - 1;
  if (line.k === 's') return TL.snaps.push(i);
  TL.evs.push(i);
  TL.maxId = Math.max(TL.maxId, line.e.id);
  if (line.e.type === 'turn.started') TL.turns.push(i);
}

function addState(d) { // a public state from the server; skipped when nothing on screen would change
  const { meta: _meta, events: _events, ...s } = d;
  const prev = TL.snaps.length && TL.lines[TL.snaps.at(-1)].s;
  if (!prev || snapKey(prev) !== snapKey(s)) add({ k: 's', s: { at: new Date().toISOString(), ...s } });
}

// Draws the whole page as it was at line p. Going backwards is the same call with a smaller p.
function show(p, step = false) {
  if (!TL.snaps.length) return;
  TL.pos = Math.max(0, Math.min(p, last()));
  S = { ...TL.lines[TL.snaps[Math.max(0, countUpTo(TL.snaps, TL.pos) - 1)]].s, meta };
  const c = countUpTo(TL.evs, TL.pos);
  events = TL.evs.slice(Math.max(0, c - 300), c).map((i) => TL.lines[i].e);
  const at = TL.lines[TL.pos];
  if (step && at.k === 'e' && (at.e.type === 'battle.resolved' || at.e.type === 'stronghold.captured')) burst(at.e.data.x, at.e.data.y);
  renderState();
  renderLog();
  renderTheater();
  renderPipeline();
  renderLens(!(TL.live || TL.playing));
  renderTimeline();
}

async function play(from) {
  const gen = ++TL.gen;
  if (from !== undefined) show(from);
  Object.assign(TL, { playing: true, live: false });
  renderTimeline();
  while (TL.playing && gen === TL.gen) {
    if (TL.pos >= last()) {
      TL.playing = false;
      if (!TL.past) return goLive();
      break;
    }
    show(TL.pos + 1, true);
    const at = TL.lines[TL.pos];
    await sleep(reduced ? 40 : (at.k === 's' ? 600 : at.e.stage === 'agent' ? 550 : 200) / TL.speed);
  }
  renderTimeline();
}

function pause() {
  TL.gen++;
  TL.playing = false;
  renderTimeline();
}

function goLive() {
  TL.gen++;
  Object.assign(TL, { live: true, playing: false });
  show(last());
}

function scrub(p, step = false) {
  TL.gen++;
  Object.assign(TL, { live: false, playing: false });
  show(p, step);
}

// ---------- loading and live updates ----------
let loading = null;
const queue = [];

async function load(season, pending) {
  if (pending) queue.push(pending);
  loading = (async () => {
    const res = await fetch(`/api/seasons/${season}`, { cache: 'no-store' }).catch(() => null);
    const text = res?.ok ? await res.text() : '';
    reset(season);
    for (const l of text.split('\n')) {
      if (!l) continue;
      try { add(JSON.parse(l)); } catch { /* a line still being written; the live stream fills the gap */ }
    }
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
  renderTicks();
  queue.splice(0).forEach(([kind, d]) => onMessage(kind, d));
}

function onMessage(kind, d) {
  if (loading) return queue.push([kind, d]);
  if (kind !== 'event') meta = d.meta;
  const season = kind === 'event' ? d.season : d.state.season;
  if (TL.past || season < TL.season) return;
  if (season > TL.season) return load(season, [kind, d]); // a new season began: switch to its recording
  if (kind === 'event') {
    if (d.id <= TL.maxId) return;
    add({ k: 'e', e: d });
    if (d.type === 'turn.started') renderTicks();
  } else {
    if (kind === 'snapshot') d.events.filter((e) => e.id > TL.maxId && e.season === TL.season).forEach((e) => add({ k: 'e', e }));
    addState(d);
  }
  if (TL.live) show(last(), kind === 'event');
  else renderTimeline();
}

function connect() {
  const es = new EventSource('/api/stream');
  for (const kind of ['snapshot', 'state', 'event']) es.addEventListener(kind, (m) => onMessage(kind, JSON.parse(m.data)));
  es.onopen = () => setLive(true);
  es.onerror = () => setLive(false); // EventSource reconnects by itself and sends a fresh snapshot
}

function setLive(ok) {
  $('#live').textContent = ok ? 'Live' : 'Reconnecting…';
  $('#live').className = `pill ${ok ? 'live' : 'down'}`;
}

async function boot() {
  let now;
  try {
    now = await fetch('/api/state', { cache: 'no-store' }).then((r) => r.json());
  } catch {
    $('#theater-who').textContent = 'Can’t reach the world right now. Retrying…';
    return setTimeout(boot, 5000);
  }
  meta = now.meta;
  drawBoard();
  const season = ASKED || now.state.season;
  TL.past = season !== now.state.season;
  await load(season);
  if (!TL.snaps.length) {
    if (TL.past) return void ($('#theater-who').textContent = `There’s no recording of season ${season}.`);
    addState(now);
  }
  if (TL.past) {
    $('#live').textContent = `Recording · season ${season}`;
    $('#live').className = 'pill tag';
    TL.speed = 4;
    return play(0);
  }
  connect();
  show(last());
  // A turn comes every 30 minutes, so newcomers see the last one played back first, then the view follows live.
  const start = ASKED ? 0 : (TL.turns.at(-1) ?? 0);
  if (ASKED) TL.speed = 4;
  const go = () => TL.live && play(start);
  if ($('#intro').open) $('#intro').addEventListener('close', go, { once: true });
  else setTimeout(go, 400);
}

// ---------- map ----------
function drawBoard() {
  let g = '';
  meta.map.forEach((row, y) => [...row].forEach((c, x) => {
    const k = KIND[c], X = x * T, Y = y * T;
    g += `<rect class="t t-${k}" x="${X}" y="${Y}" width="${T}" height="${T}"><title>(${x},${y}) ${k}</title></rect>`;
    if (k === 'forest') g += `<path class="g-forest" d="M${X + 12} ${Y + 36}l8-16 8 16zM${X + 24} ${Y + 40}l8-16 8 16z"/>`;
    if (k === 'mountain') g += `<path class="g-mountain" d="M${X + 7} ${Y + 40}l13-22 8 12 5-7 11 17z"/>`;
    if (k === 'river') g += `<path class="g-river" d="M${X} ${Y + 20}q6.25-6 12.5 0t12.5 0t12.5 0t12.5 0M${X} ${Y + 32}q6.25-6 12.5 0t12.5 0t12.5 0t12.5 0"/>`;
  }));
  $('#terrain').innerHTML = g;
}

function drawMap() {
  const s = S.state;
  $('#owners').innerHTML = s.owner.map((o, i) => (o ? `<rect class="own-${o}" x="${(i % 10) * T}" y="${Math.floor(i / 10) * T}" width="${T}" height="${T}"/>` : '')).join('');
  $('#strongholds').innerHTML = s.strongholds.map((h) => {
    const shape = h.capital ? 'M-14 10V-4l7-9 7 9 7-9 7 9V10z' : 'M-11 10V-6h4v-5h5v5h4v-5h5v5h4V10z';
    const who = h.owner ? meta.cast[h.owner].realm : 'neutral';
    return `<g transform="translate(${h.x * T + 25} ${h.y * T + 22})"><title>${esc(h.name)}: ${who}, garrison ${h.garrison}</title><path class="fort o-${h.owner ?? 'none'}" d="${shape}"/><text class="garrison" y="22">${h.garrison}</text></g>`;
  }).join('');
  for (const k of ['red', 'blue']) {
    const a = s.armies[k];
    let el = document.getElementById(`army-${k}`);
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.id = `army-${k}`;
      el.setAttribute('class', `army ${k}`);
      el.innerHTML = '<circle class="ring" r="21"/><circle class="body" r="16"/><text></text><title></title>';
      $('#armies').append(el);
    }
    el.style.display = a.routed ? 'none' : '';
    el.style.transform = `translate(${a.x * T + 25}px, ${a.y * T + 25}px)`;
    el.querySelector('text').textContent = a.strength;
    el.querySelector('.ring').style.display = a.fortified ? '' : 'none';
    el.querySelector('title').textContent = `${meta.cast[k].realm} army: strength ${a.strength}, morale ${a.morale}${a.fortified ? ', fortified' : ''}`;
  }
}

function burst(x, y) {
  if (x === undefined) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  Object.entries({ cx: x * T + 25, cy: y * T + 25, r: 30, fill: 'url(#burst)', class: 'burst' }).forEach(([k, v]) => c.setAttribute(k, v));
  $('#fx').append(c);
  setTimeout(() => c.remove(), 1200);
}

// ---------- panels ----------
function renderTimeline() {
  const r = $('#tl-range');
  r.max = String(Math.max(0, last()));
  r.value = String(TL.pos);
  const at = TL.lines[TL.pos];
  const ts = at && (at.k === 'e' ? at.e.ts : at.s.at);
  const when = ts ? new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
  if (S) $('#tl-label').textContent = `Season ${TL.season} · turn ${turnOf(events.at(-1)) || S.state.turn} · ${when}`;
  $('#tl-play').textContent = TL.playing ? 'Pause' : 'Play';
  $('#tl-live').textContent = TL.past ? 'Back to live' : TL.live ? '● Live' : 'Go live';
  $('#tl-live').classList.toggle('on', !TL.past && TL.live);
  document.querySelectorAll('.tl-speed .btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === TL.speed)));
  renderNext();
}

function renderTicks() {
  $('#tl-turns').innerHTML = TL.turns.map((i) => `<option value="${i}"></option>`).join('');
}

function renderNext() {
  if (!meta || !S) return;
  const el = $('#next');
  if (TL.past) return void (el.textContent = 'Watching a recording');
  if (!TL.live) return void (el.textContent = 'Looking back · press Live to catch up');
  const at = meta.nextTurnAt, left = Math.max(0, Math.round((at - Date.now()) / 1000));
  const every = meta.turnIntervalMs >= 60_000 ? `${Math.round(meta.turnIntervalMs / 60_000)} min` : `${Math.round(meta.turnIntervalMs / 1000)} s`;
  el.textContent = S.state.status !== 'running' ? 'New season starting…'
    : !at ? 'Turn in progress…'
    : `Next turn in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · one every ${every}`;
}

function renderState() {
  const { state: s, counters: C } = S;
  $('#clock').textContent = `Season ${s.season} · Round ${Math.ceil(s.turn / 2)} of ${s.maxRounds}${meta.paused ? ' · paused (nobody watching)' : ''}`;
  const live = meta.llm.mode === 'live';
  $('#ai-mode').textContent = live ? `AI: live · ${meta.llm.model.split('/').pop()} · free tier` : 'Generals resting: running on standing orders';
  $('#ai-mode').className = `pill ${live ? '' : 'warn'}`;
  $('#ai-mode').title = meta.llm.why ?? `${meta.llm.callsToday} AI calls today`;
  $('#counters').innerHTML = [['AI decisions', C.decisions], ['Tool calls', C.toolCalls], ['Automations run', C.automations], ['Oracle reads', C.oracleReads], ['On-chain receipts', C.receipts]]
    .map(([l, v]) => `<div><dt>${l}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
  drawMap();
  renderKingdoms();
  renderProofs();
  renderResults();
  const p = meta.public;
  $('#owner').textContent = p.owner;
  $('#hire').href = safeUrl(p.hireUrl) || (p.email ? `mailto:${p.email}` : '#');
  $('#repo').href = safeUrl(p.repoUrl) || '#';
  $('#repo-wrap').hidden = !safeUrl(p.repoUrl);
}

function renderKingdoms() {
  const s = S.state;
  $('#kingdoms').innerHTML = ['red', 'blue'].map((k) => {
    const K = s.kingdoms[k], A = s.armies[k], c = meta.cast[k];
    const held = s.strongholds.filter((h) => h.owner === k).length, tiles = s.owner.filter((o) => o === k).length;
    const journal = (S.journals[k] ?? []).slice().reverse().map((j) => `<li>${esc(j.note)} <span class="muted">(turn ${j.turn})</span></li>`).join('') || '<li class="muted">No notes yet.</li>';
    const lessons = (S.lessons[k] ?? []).map((l) => `<li>${esc(l)}</li>`).join('');
    const eth = s.market.price ? `$${s.market.price.toFixed(2)}` : '…';
    const change = s.market.start && s.market.price ? `, ${s.market.price >= s.market.start ? '+' : ''}${((s.market.price / s.market.start - 1) * 100).toFixed(2)}% this season` : '';
    const market = k === 'red'
      ? `Treasury in ETH · ETH ${eth} from Chainlink${change} · income ×${s.market.mult} <span class="muted">(game effect amplified ${meta.amplify}×)</span>`
      : 'Treasury in gold · steady income, +1 per turn';
    return `<article class="kcard ${k}">
      <h3>${c.realm}</h3>
      <p class="sub">${c.general}${s.active === k && s.status === 'running' ? ' · <b>to move</b>' : ''}</p>
      <div class="stats">
        <div class="stat">Gold<b>${K.gold}</b></div>
        <div class="stat">Food<b>${K.food}/100</b><div class="bar${K.food < 20 ? ' low' : ''}"><i style="width:${K.food}%"></i><em style="left:20%" title="automation reorders below 20%"></em></div></div>
        <div class="stat">Army<b>${A.routed ? 'Routed' : A.strength}</b><div class="bar"><i style="width:${A.strength / 2}%"></i></div></div>
        <div class="stat">Morale<b>${A.morale.toFixed(1)}</b></div>
        <div class="stat">Strongholds<b>${held} / 7</b></div>
        <div class="stat">Land<b>${tiles} tiles</b></div>
      </div>
      <p class="market">${market}</p>
      <h2>Journal (the AI's memory)</h2><ol class="journal">${journal}</ol>
      ${lessons ? `<h2>Lessons from past seasons</h2><ul class="journal">${lessons}</ul>` : ''}
    </article>`;
  }).join('');
}

function renderProofs() {
  const { chain } = meta;
  const tx = (h) => (!h ? '' : chain.explorer
    ? `<a href="${esc(chain.explorer)}/tx/${esc(h)}" target="_blank" rel="noopener">tx ${esc(h.slice(0, 10))}…</a>`
    : `<code title="${esc(h)}">tx ${esc(h.slice(0, 10))}…</code>`);
  $('#contract').innerHTML = !chain.ledger ? 'No contract deployed yet.' : chain.explorer
    ? `RealmLedger on Base Sepolia: <a href="${esc(chain.explorer)}/address/${esc(chain.ledger)}" target="_blank" rel="noopener">${esc(chain.ledger.slice(0, 12))}…</a>`
    : `RealmLedger on a local test chain (a fork of Base Sepolia): <code>${esc(chain.ledger.slice(0, 12))}…</code>`;
  $('#proofs').innerHTML = S.proofs.map((p) => `<li><span class="lbl">${esc(p.label)}</span>${p.ethUsd ? `<span>ETH $${p.ethUsd.toFixed(2)} at capture</span>` : ''}<span class="st st-${esc(p.status)}">${esc(p.status)}</span>${tx(p.hash)}</li>`).join('')
    || '<li class="muted">No receipts yet. The first capture writes one.</li>';
}

function renderResults() {
  const s = S.state, el = $('#results');
  el.hidden = s.status !== 'ended' || dismissedSeason === s.season || TL.pos !== last();
  if (el.hidden) return;
  const lessons = ['red', 'blue'].map((k) => (S.lessons[k]?.length ? `<p><b>${meta.cast[k].general}:</b> “${esc(S.lessons[k].at(-1))}”</p>` : '')).join('');
  el.innerHTML = `<div class="card" role="dialog" aria-label="Season results"><p class="muted">Season ${s.season} is over</p><h2>${meta.cast[s.winner].realm} wins</h2><p>${esc(s.endReason)}.</p>
    <p class="muted">${TL.past ? 'End of the recording. The result was written on-chain and each general wrote a lesson into its memory.' : 'The result is being written on-chain and each general has written a lesson into its memory. A new season starts in about a minute.'}</p>
    ${lessons}<button class="btn" id="results-close">Keep watching</button></div>`;
}

const logLine = (e) => `<li data-id="${e.id}"${pinned?.id === e.id ? ' class="sel"' : ''}><time>${new Date(e.ts).toLocaleTimeString([], { hour12: false })}</time>${badge(e.stage)}<span class="sum">${esc(e.summary)}</span></li>`;

function badge(stage) {
  const t = TECH[stage] ?? TECH.game;
  return `<span class="badge b-${stage}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t.icon}"/></svg>${t.label}</span>`;
}

function renderLog() {
  $('#events').innerHTML = events.filter((e) => filter === 'all' || e.stage === filter).slice(-150).reverse().map(logLine).join('');
}

function renderFilters() {
  $('#filters').innerHTML = [['all', 'All'], ...Object.entries(TECH).map(([k, t]) => [k, t.label])]
    .map(([k, l]) => `<button data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('');
}

function renderTheater() {
  const start = events.findLast((e) => e.type === 'agent.thinking_started');
  if (!start) {
    $('#theater-who').textContent = 'Waiting for the next turn…';
    $('#theater').innerHTML = '';
    return;
  }
  const steps = events.filter((e) => e.traceId === start.traceId && e.stage === 'agent' && e.id > start.id);
  const decided = steps.some((e) => e.type === 'agent.decision');
  $('#theater-who').textContent = decided ? `${meta.cast[start.kingdom]?.general ?? 'The general'} has given the order.` : start.summary;
  $('#theater').innerHTML = steps.map((e) => {
    const cls = { 'agent.thought': 'thought', 'agent.tool_called': 'call', 'agent.decision': 'decision', 'agent.fallback': 'fallback' }[e.type] ?? 'result';
    const text = e.type === 'agent.tool_called' ? `> ${e.summary.split('→ ').pop()}` : e.type === 'agent.thought' && e.data.text ? `“${e.data.text}”` : e.summary;
    return `<li class="${cls}">${esc(text)}</li>`;
  }).join('');
}

function renderPipeline() {
  const tr = events.findLast((e) => e.type === 'turn.started')?.traceId;
  const inTurn = events.filter((e) => e.traceId === tr && pipeStage(e));
  const now = inTurn.length ? pipeStage(inTurn.at(-1)) : null;
  $('#pipeline').innerHTML = STAGES.map((st) => {
    const done = inTurn.findLast((e) => pipeStage(e) === st.id);
    return `<li class="${done ? 'done' : ''}${now === st.id ? ' now' : ''}"><b>${st.name}</b><span>${esc(done ? done.summary : st.hint)}</span></li>`;
  }).join('');
}

function renderLens(force) {
  if (!force && (pinned || Date.now() - lensAt < 3000)) return;
  lensAt = Date.now();
  const e = pinned ?? events.findLast((x) => !['turn.started', 'resources.updated', 'agent.tool_result'].includes(x.type)) ?? events.at(-1);
  if (!e) return;
  const [stage, plain, biz] = LENS[e.lensKey] ?? ['game', '', ''];
  $('#lens').innerHTML = `<div class="lens-head">${badge(stage)}<strong>${esc(e.summary)}</strong></div>
    <dl><div><dt>In plain English</dt><dd>${esc(plain)}</dd></div><div class="biz"><dt>In your business, this is like…</dt><dd>${esc(biz)}</dd></div></dl>
    <p class="muted">${pinned ? '<button class="btn" id="unpin">Follow the timeline</button>' : 'Following the timeline. Click any log line to pin it here.'}</p>`;
}

// ---------- controls ----------
let raf = 0, want = 0, wheel = 0;
$('#tl-range').addEventListener('input', (ev) => {
  want = +ev.target.value;
  TL.gen++;
  Object.assign(TL, { live: false, playing: false });
  raf ||= requestAnimationFrame(() => {
    raf = 0;
    show(want);
  });
});
$('#tl-range').addEventListener('keydown', (ev) => { // Shift + arrow jumps to the previous or next turn
  if (!ev.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  ev.preventDefault();
  scrub(ev.key === 'ArrowRight' ? (TL.turns.find((i) => i > TL.pos) ?? last()) : (TL.turns.findLast((i) => i < TL.pos) ?? 0));
});
$('#timeline').addEventListener('wheel', (ev) => { // scroll over the bar: down or right moves forward, up or left moves back
  ev.preventDefault();
  wheel += Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
  const steps = Math.trunc(wheel / 40);
  if (!steps) return;
  wheel -= steps * 40;
  scrub(TL.pos + steps, steps === 1);
}, { passive: false });
$('#tl-play').addEventListener('click', () => (TL.playing ? pause() : play(TL.past && TL.pos >= last() ? 0 : undefined)));
document.querySelector('.tl-speed').addEventListener('click', (ev) => {
  if (!ev.target.dataset.speed) return;
  TL.speed = +ev.target.dataset.speed;
  renderTimeline();
});
$('#tl-live').addEventListener('click', () => (TL.past ? location.assign('/') : goLive()));
$('#replay').addEventListener('click', () => {
  TL.speed = 1;
  play(TL.turns.at(-1) ?? 0);
});
$('#filters').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  filter = b.dataset.f;
  renderFilters();
  renderLog();
});
$('#events').addEventListener('click', (ev) => {
  const li = ev.target.closest('li[data-id]');
  if (!li) return;
  pinned = events.find((e) => e.id === +li.dataset.id) ?? null;
  renderLog();
  renderLens(true);
});
$('#lens').addEventListener('click', (ev) => {
  if (ev.target.id !== 'unpin') return;
  pinned = null;
  renderLog();
  renderLens(true);
});
$('#results').addEventListener('click', (ev) => {
  if (ev.target.id !== 'results-close') return;
  dismissedSeason = S.state.season;
  renderResults();
});
$('#intro-open').addEventListener('click', () => $('#intro').showModal());
try {
  if (!localStorage.getItem('np-intro-seen')) {
    $('#intro').showModal();
    localStorage.setItem('np-intro-seen', '1');
  }
} catch {
  $('#intro').showModal();
}
setInterval(() => renderLens(), 3000);
setInterval(renderNext, 1000);
renderFilters();
boot();
