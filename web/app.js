import { LENS, TECH } from './lens.js';
import { headline, turnStory, flow, isMoment, momentText, MOMENTS, roundOf, turnOf, regionsOf, SKY, WEATHER, WEATHER_SHORT, asBusiness } from './story.js';
import './theme.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u ?? '') ? u : '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = 50; // SVG units per tile
const KIND = { '.': 'plains', f: 'forest', m: 'mountain', '~': 'river', F: 'fort', C: 'capital' };
const MAP_TILES = Array.from({ length: 100 }, (_, i) => [i % 10, Math.floor(i / 10)]);
// Mirrors regionAt in server/config.js: the Crownlands in the middle, then the four corners.
const regionAt = (x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 ? 'mid' : y < 5 ? (x < 5 ? 'nw' : 'ne') : x < 5 ? 'sw' : 'se');
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
const TL = { season: 0, past: false, lines: [], snaps: [], evs: [], turns: [], keys: [], maxId: 0, pos: 0, live: true, playing: false, speed: 1, gen: 0 };
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

function reset(season) {
  Object.assign(TL, { season, lines: [], snaps: [], evs: [], turns: [], keys: [], maxId: 0, pos: 0 });
}

function add(line) {
  const i = TL.lines.push(line) - 1;
  if (line.k === 's') return TL.snaps.push(i);
  TL.evs.push(i);
  TL.maxId = Math.max(TL.maxId, line.e.id);
  if (line.e.type === 'turn.started') TL.turns.push(i);
  if (isMoment(line.e)) TL.keys.push(i);
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
  // Season 1 started recording mid-season: its early events come after a later snapshot, so the map can't match them yet.
  const t = turnOf(events.at(-1));
  document.documentElement.classList.toggle('stale', t > 0 && S.state.turn > t + 1);
  renderState();
  renderSimple();
  renderLog();
  renderTheater();
  renderPipeline();
  renderLens(!(TL.live || TL.playing));
  renderTimeline();
  relabel();
}

// "See it as your business": rewrites the simple view's words (castles → clients, gold → cash…) in place.
// Each text node remembers its original, so switching back restores it; fresh renders start from war words.
const original = new WeakMap();
const biz = () => document.documentElement.dataset.lens === 'biz' && document.documentElement.dataset.view !== 'nerd'; // the nerd view has no switch
function relabel(roots = document.querySelectorAll('[data-relabel]')) {
  for (const root of roots) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('[data-keep]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n; (n = walk.nextNode());) {
      if (!original.has(n)) original.set(n, n.nodeValue);
      n.nodeValue = biz() ? asBusiness(original.get(n)) : original.get(n);
    }
  }
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

// Live stream over a WebSocket. The server sends a fresh snapshot on every (re)connect, so gaps heal themselves.
function connect(delay = 1000) {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
  let ping = 0;
  ws.onopen = () => {
    setLive(true);
    delay = 1000;
    ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 30_000); // keeps proxies from dropping a quiet socket
  };
  ws.onmessage = (m) => {
    if (m.data === 'pong') return;
    const { kind, data } = JSON.parse(m.data);
    onMessage(kind, data);
  };
  ws.onclose = () => {
    clearInterval(ping);
    setLive(false);
    setTimeout(() => connect(Math.min(delay * 2, 30_000)), delay);
  };
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
    $('#theater-who').textContent = $('#n-big').textContent = 'Can’t reach the world right now. Retrying…';
    return setTimeout(boot, 5000);
  }
  meta = now.meta;
  drawBoard();
  const season = ASKED || now.state.season;
  TL.past = season !== now.state.season;
  await load(season);
  if (!TL.snaps.length) {
    if (TL.past) return void ($('#theater-who').textContent = $('#n-big').textContent = `There’s no recording of season ${season}.`);
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
  setTimeout(() => TL.live && play(start), 400);
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
  if (!$('#labels').childElementCount) $('#labels').innerHTML = s.strongholds.map((h) => `<text class="sh-name" x="${h.x * T + 25}" y="${h.y * T + 7}">${esc(h.name)}</text>`).join('');
  // Five regions, each under a real city's sky: every tile takes its region's tint or pattern, and each region gets a label
  // saying what the weather does there.
  const sky = Object.fromEntries(regionsOf(s).map((w) => [w.id, w]));
  const LABEL = { nw: [4, 14, 'start'], ne: [496, 14, 'end'], mid: [250, 164, 'middle'], sw: [4, 493, 'start'], se: [496, 493, 'end'] };
  $('#weather').innerHTML = !sky.mid ? '' : `${MAP_TILES.map(([x, y]) => {
    const w = sky[regionAt(x, y)];
    return w.kind === 'clear' ? '' : `<rect class="wx wx-${esc(w.kind)}" x="${x * T}" y="${y * T}" width="${T}" height="${T}"><title>${esc(w.name)}: ${esc(w.kind)}, the real sky over ${esc(w.place)}. ${esc(WEATHER[w.kind] ?? '')}</title></rect>`;
  }).join('')}<path class="wx-edge" d="M150 150h200v200h-200zM250 0V150M250 350V500M0 250H150M350 250H500"/>${Object.entries(LABEL).map(([id, [lx, ly, anchor]]) => {
    const w = sky[id];
    return w ? `<text class="wx-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${SKY[w.kind] ?? ''} ${esc(w.place.split(',')[0])}${Number.isFinite(w.tempC) ? ` ${Math.round(w.tempC)}°` : ''}: ${esc(WEATHER_SHORT[w.kind] ?? w.kind)}</text>` : '';
  }).join('')}`;
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
  if (S) $('#tl-label').textContent = `Season ${TL.season} · round ${roundOf(turnOf(events.at(-1)) || S.state.turn)} of ${S.state.maxRounds} · ${when}`;
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
  const el = $('#next'), up = $('#n-next');
  up.textContent = '';
  el.disabled = TL.past || TL.live; // looking back: the pill is the way back to live
  if (TL.past) el.textContent = 'Watching a recording';
  else if (!TL.live) el.textContent = TL.playing ? '▶ Replaying · skip to live' : '⏪ Looking back · go live';
  else {
    const at = meta.nextTurnAt, left = Math.max(0, Math.round((at - Date.now()) / 1000));
    const every = meta.turnIntervalMs >= 60_000 ? `${Math.round(meta.turnIntervalMs / 60_000)} min` : `${Math.round(meta.turnIntervalMs / 1000)} s`;
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.textContent = S.state.status !== 'running' ? 'New season starting…'
      : !at ? 'Turn in progress…'
      : `Next turn in ${clock}`;
    el.title = `One turn every ${every}`;
    const k = S.state.active;
    if (S.state.status === 'running' && at) up.textContent = `Up next: ${meta.cast[k].general} (${meta.cast[k].realm}) moves in ${clock}.`;
  }
  relabel([up]);
}

// ---------- simple view: the tech strip on top, then narrator, score and key moments ----------
function renderSimple() {
  const s = S.state, cast = meta.cast, R = (k) => cast[k].realm;
  const tr = events.findLast((e) => e.type === 'turn.started')?.traceId;
  const inTurn = tr ? events.filter((e) => e.traceId === tr) : [];
  const start = inTurn.find((e) => e.type === 'turn.started');

  // The narrator tells the story; what prices and weather are doing lives in the tech strip above, so it's left out here.
  const [first, ...rest] = document.documentElement.classList.contains('stale')
    ? [`Replaying round ${roundOf(turnOf(events.at(-1)))}.`, 'This part of the season was recorded before the map was, so the map and score catch up later in the timeline.']
    : headline(s, cast);
  $('#n-big').innerHTML = `<strong>${esc(first)}</strong> ${esc(rest.join(' '))}`;
  $('#n-when').textContent = start ? `Round ${roundOf(turnOf(start))} · ${R(start.kingdom)}'s move` : '';
  const { lines, quote } = turnStory(inTurn.filter((e) => !['turn.started', 'market.shift', 'weather.changed'].includes(e.type)), s, cast);
  $('#n-lines').textContent = lines.join(' ') || (start ? `${cast[start.kingdom].general} is about to decide…` : 'Waiting for the first move…');
  $('#n-quote').hidden = !quote;
  if (quote) $('#n-quote').innerHTML = `<p>“${esc(quote.text)}”</p><cite>${esc(quote.who)}${quote.thinking ? ', thinking out loud' : ', explaining the order'}</cite>`;

  const count = (k) => s.strongholds.filter((h) => h.owner === k).length;
  const order = { red: 0, null: 1, blue: 2 };
  $('#s-round').textContent = `Score · round ${roundOf(s.turn)} of ${s.maxRounds}`;
  $('#tug').innerHTML = s.strongholds.slice().sort((a, b) => order[a.owner] - order[b.owner]).map((h) => `<i class="o-${h.owner ?? 'none'}" title="${esc(h.name)}"></i>`).join('');
  $('#tug').setAttribute('aria-label', `Castles: ${R('red')} ${count('red')}, unclaimed ${count(null)}, ${R('blue')} ${count('blue')}`);
  $('#tug-legend').innerHTML = `<b class="red">${R('red')} ${count('red')}</b><span class="muted">${count(null)} unclaimed</span><b class="blue">${count('blue')} ${R('blue')}</b>`;
  $('#sides').innerHTML = ['red', 'blue'].map((k) => {
    const K = s.kingdoms[k], A = s.armies[k];
    const army = A.routed ? 'Wiped out, regrouping' : `${A.strength} soldiers${A.fortified ? ', dug in' : ''}`;
    const d = S.effects?.[k]?.dividend, sign = (n) => (n >= 0 ? '+' : '−');
    const paid = d?.gold ? ` <span class="${d.gold >= 0 ? 'up' : 'down'}" title="${d.coin} moved ${sign(d.pct)}${Math.abs(d.pct).toFixed(2)}% since its last turn">${sign(d.gold)}${Math.abs(d.gold)} from ${d.coin}</span>` : '';
    return `<article class="side ${k}">
      <h3>${R(k)}${s.active === k && s.status === 'running' ? ' <span class="to-move">to move</span>' : ''}</h3>
      <p class="muted">${cast[k].general} (AI) · gold held in ${cast[k].treasury}</p>
      <dl>
        <div><dt>⚔️ Army</dt><dd>${army}</dd></div>
        <div><dt>🍞 Food</dt><dd>${K.food}%${K.food < 20 ? ' <span class="low">low</span>' : ''}<span class="bar${K.food < 20 ? ' low' : ''}"><i style="width:${K.food}%"></i></span></dd></div>
        <div><dt>💰 Gold</dt><dd>${K.gold}${paid}</dd></div>
      </dl>
    </article>`;
  }).join('');

  const at = TL.lines[TL.pos];
  const now = at?.k === 'e' ? (at.e.type === 'turn.started' ? 'event' : at.e.stage) : null;
  $('#flow').innerHTML = flow(inTurn, s, meta, now, S.proofs, S.effects).map((st) => `<li class="st-${st.id}${st.done ? ' done' : ''}${st.active ? ' now' : ''}">
    <span class="head"><span class="ic" aria-hidden="true">${st.icon}</span><b>${st.name}</b></span><span class="tech">${esc(st.tech)}</span>
    <span class="does">${esc(st.does)}</span><span class="for-you">${esc(st.biz)}</span><span class="now-txt" title="${esc(st.now)}">${esc(st.now)}</span></li>`).join('');

  const c = countUpTo(TL.keys, TL.pos), keys = TL.keys.slice(0, c);
  $('#moments').innerHTML = keys.slice(-4).reverse().map((i) => {
    const m = TL.lines[i].e;
    return `<li><button data-line="${i}"><span class="when">Round ${roundOf(turnOf(m)) || 1}</span><span aria-hidden="true">${MOMENTS[m.type]}</span><span>${esc(momentText(m, s, cast))}</span></button></li>`;
  }).join('') || '<li class="muted">Nothing big has happened yet.</li>';
  renderAskWho();
  fit();
}

// The map takes the height left under the header and tech strip (which wrap differently at each width),
// so on a laptop the whole first screen needs no scrolling.
function fit() {
  document.documentElement.style.setProperty('--game-top', `${Math.round($('#simple').getBoundingClientRect().top + scrollY)}px`);
}
addEventListener('resize', fit);

// ---------- "Ask a general": a viewer's question, answered by the AI from the live game ----------
let askK = 'red';
function renderAskWho() {
  document.querySelectorAll('.ask-who button').forEach((b) => {
    b.textContent = `${meta.cast[b.dataset.k].general.split(' ').pop()} (${meta.cast[b.dataset.k].realm})`;
    b.setAttribute('aria-pressed', String(b.dataset.k === askK));
  });
  $('#ask-q').placeholder = `Ask ${biz() ? `${meta.cast[askK].realm}'s AI manager` : meta.cast[askK].general} anything…`;
}

async function ask(question) {
  const q = question.trim(), out = $('#ask-out'), btn = $('#ask .primary');
  if (q.length < 3 || btn.disabled) return;
  out.hidden = false;
  out.textContent = `${meta.cast[askK].general.split(' ').pop()} is thinking…`;
  btn.disabled = true;
  try {
    const d = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kingdom: askK, question: q, view: biz() ? 'business' : 'war' }) }).then((r) => r.json());
    out.innerHTML = !d.answer ? esc(d.error ?? 'No answer this time. Try again in a minute.')
      : `<b>${esc(biz() ? asBusiness(d.who) : d.who)}:</b> “${esc(d.answer)}”<small>${d.mode === 'live' ? `Answered just now by ${esc(d.model.split('/').pop())} (AI on Groq) from the live game's data.` : 'The AI is resting to stay on the free tier.'}</small>`;
  } catch {
    out.textContent = 'Couldn’t reach the general. Try again in a minute.';
  } finally {
    btn.disabled = false;
  }
}

function renderState() {
  const { state: s, counters: C } = S;
  $('#clock').textContent = `Season ${s.season} · Round ${Math.ceil(s.turn / 2)} of ${s.maxRounds}${meta.paused ? ' · paused (nobody watching)' : ''}`;
  const live = meta.llm.mode === 'live';
  $('#ai-mode').textContent = live ? `AI: live · ${meta.llm.model.split('/').pop()} · free tier` : 'Generals resting: running on standing orders';
  $('#ai-mode').classList.toggle('warn', !live);
  $('#ai-mode').title = meta.llm.why ?? `${meta.llm.callsToday} AI calls today`;
  $('#counters').innerHTML = [['AI decisions', C.decisions], ['Tool calls', C.toolCalls], ['Automations run', C.automations], ['Oracle reads', C.oracleReads], ['On-chain receipts', C.receipts]]
    .map(([l, v]) => `<div><dt>${l}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
  drawMap();
  renderKingdoms();
  renderProofs();
  renderResults();
  const p = meta.public;
  $('#owner').textContent = p.owner;
  $('#hire').href = $('#site').href = safeUrl(p.hireUrl) || (p.email ? `mailto:${p.email}` : '#');
  $('#site').textContent = `By ${p.owner} ↗`;
  document.querySelectorAll('.owner-name').forEach((e) => { e.textContent = p.owner; });
  document.querySelectorAll('.book-link').forEach((a) => { a.href = safeUrl(p.bookingUrl) || '#'; a.hidden = !safeUrl(p.bookingUrl); });
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
    const fx = S.effects?.[k], m = s.market?.[fx?.coin];
    const dv = fx?.dividend;
    const market = fx ? `Treasury in ${fx.coin} · ${fx.coin} $${m?.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '…'} from Chainlink${dv ? ` · last turn ${dv.pct >= 0 ? '+' : ''}${dv.pct.toFixed(2)}% = ${dv.gold >= 0 ? '+' : ''}${dv.gold} gold` : ''} · ${fx.pct >= 0 ? '+' : ''}${fx.pct.toFixed(2)}% this season = battle power ${fx.mood >= 0 ? '+' : ''}${Math.round(fx.mood * 100)}% · soldiers ${S.effects.LINK.cost} gold (LINK)`
      : 'Treasury in gold';
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
document.querySelectorAll('.replay').forEach((b) => b.addEventListener('click', () => {
  TL.speed = 1;
  play(TL.turns.at(-1) ?? 0);
}));
$('#moments').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-line]');
  if (b) scrub(+b.dataset.line, true);
});
$('#next').addEventListener('click', goLive);

// ---------- "A free plan for your business": the visitor's business in, a plan from the AI out ----------
const TECH_COLOR = { 'AI agent': 'agent', 'n8n automation': 'n8n', 'Live data': 'oracle', 'Blockchain record': 'chain', 'Always-on cloud': 'game' };
const bookUrl = (content) => {
  const raw = safeUrl(meta?.public?.bookingUrl);
  if (!raw) return '';
  const u = new URL(raw);
  u.searchParams.set('utm_content', content); // Calendly shows it on the booking: this one came from a plan
  return u.href;
};
function renderPlan({ plan: p, model }) {
  if (!p.fit) return `<p class="plan-note">${esc(p.headline)}</p>`;
  const book = bookUrl('plan');
  return `<article class="plan-result">
    <h3>${esc(p.headline)}</h3>${p.situation ? `<p class="muted">${esc(p.situation)}</p>` : ''}
    <ol class="plan-steps">${p.steps.map((s) => `<li><b>${esc(s.title)}</b>
      ${s.today ? `<p><span class="lbl">Today</span> ${esc(s.today)}</p>` : ''}
      <p><span class="lbl">Automated</span> ${esc(s.automated)}</p>
      ${s.result ? `<p><span class="lbl">You get</span> ${esc(s.result)}</p>` : ''}
      <p class="plan-tech">${s.tech.map((t) => `<span class="tchip" style="--c: var(--${TECH_COLOR[t] ?? 'game'})">${esc(t)}</span>`).join('')}</p></li>`).join('')}</ol>
    ${p.first_step ? `<p><b>First step:</b> ${esc(p.first_step)}</p>` : ''}
    ${p.care ? `<p class="plan-care">🔒 ${esc(p.care)}</p>` : ''}
    ${p.why_umar ? `<p class="muted">${esc(p.why_umar)}</p>` : ''}
    ${book ? `<p class="plan-cta"><a class="btn primary" href="${esc(book)}" target="_blank" rel="noopener">📅 Book a free 30-minute call to go through it</a></p>` : ''}
    <p class="muted"><small>Drafted just now by ${esc(model.split('/').pop())} (AI on Groq, thinking it through) from what you wrote. A starting point for the call, not a quote.</small></p>
  </article>`;
}
async function draftPlan(text) {
  const btn = $('#plan-form .primary'), out = $('#plan-out');
  if (text.trim().length < 10 || btn.disabled) return void (out.innerHTML = '<p class="plan-note">Tell me a little about your business first: a sentence or two is enough.</p>');
  btn.disabled = true;
  out.innerHTML = '<p class="muted">Thinking it through… about 10 seconds, up to a minute when busy.</p>';
  try {
    const r = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const d = await r.json();
    out.innerHTML = d.plan ? renderPlan(d) : `<p class="plan-note">${esc(d.error ?? 'No plan this time. Try again in a minute.')}</p>`;
  } catch {
    out.innerHTML = '<p class="plan-note">Couldn’t reach the planner. Try again in a minute.</p>';
  } finally {
    btn.disabled = false;
  }
}
const openPlan = () => $('#plan').open || $('#plan').showModal();
document.querySelectorAll('.plan-open').forEach((b) => b.addEventListener('click', openPlan));
$('#plan').addEventListener('click', (ev) => {
  const pick = ev.target.closest('.plan-picks button');
  if (!pick) return;
  $('#plan-text').value = pick.dataset.text;
  draftPlan(pick.dataset.text);
});
$('#plan-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  draftPlan($('#plan-text').value);
});
// /#plan opens it straight away: the link to send people.
const planFromHash = () => location.hash === '#plan' && openPlan();
addEventListener('hashchange', planFromHash);
planFromHash();
function setLens(v) {
  if (v === 'biz') document.documentElement.dataset.lens = 'biz';
  else delete document.documentElement.dataset.lens;
  document.querySelectorAll('.see-as button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lens === 'biz') === biz())));
  if (meta) renderAskWho();
  relabel();
}
document.querySelector('.see-as').addEventListener('click', (ev) => {
  const v = ev.target.closest('button')?.dataset.lens;
  if (!v) return;
  setLens(v);
  try { localStorage.setItem('np-lens', v); } catch { /* private browsing: lasts until the tab closes */ }
});
setLens(document.documentElement.dataset.lens);
$('#ask').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[type="button"]');
  if (!b || !meta) return;
  if (b.dataset.k) {
    askK = b.dataset.k;
    renderAskWho();
  } else ask(b.dataset.q);
});
$('#ask').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (meta) ask($('#ask-q').value);
});

// Simple view by default; the full dashboard lives in the nerd view. Both share one map.
function setView(v) {
  const nerd = v === 'nerd';
  if (nerd) document.documentElement.dataset.view = 'nerd';
  else delete document.documentElement.dataset.view;
  if (nerd) $('#nerd').prepend($('.board'));
  else $('#simple').prepend($('.board'));
  $('#view').textContent = nerd ? 'Simple view' : 'Nerd view';
  $('#view').setAttribute('aria-pressed', String(nerd));
  relabel();
  if (!nerd) fit();
}
$('#view').addEventListener('click', () => {
  const v = document.documentElement.dataset.view === 'nerd' ? 'simple' : 'nerd';
  setView(v);
  try { localStorage.setItem('np-view', v); } catch { /* private browsing: lasts until the tab closes */ }
});
setView(document.documentElement.dataset.view);
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
setInterval(() => renderLens(), 3000);
setInterval(renderNext, 1000);
renderFilters();
boot();
