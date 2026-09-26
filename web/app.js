import { LENS, TECH } from './lens.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u ?? '') ? u : '');
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

const TIMELAPSE = +new URLSearchParams(location.search).get('season') || 0; // /?season=N replays a recorded season
let S = null; // latest public state from the server
let events = [];
let pinned = null;
let filter = 'all';
let lensAt = 0;
let dismissedSeason = 0;
let replaying = false;
let autoplayed = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const badge = (stage) => {
  const t = TECH[stage] ?? TECH.game;
  return `<span class="badge b-${stage}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t.icon}"/></svg>${t.label}</span>`;
};

function connect() {
  const es = new EventSource('/api/stream');
  es.addEventListener('snapshot', (m) => {
    S = JSON.parse(m.data);
    events = S.events;
    drawBoard();
    renderState();
    renderLog();
    renderTheater();
    renderPipeline();
    renderLens(true);
    if (!autoplayed && !TIMELAPSE) { // a turn comes every 30 minutes, so show newcomers the last one straight away
      autoplayed = true;
      if ($('#intro').open) $('#intro').addEventListener('close', replay, { once: true });
      else setTimeout(replay, 600);
    }
  });
  es.addEventListener('state', (m) => {
    S = JSON.parse(m.data);
    renderState();
  });
  es.addEventListener('event', (m) => onEvent(JSON.parse(m.data)));
  es.onopen = () => setLive(true);
  es.onerror = () => setLive(false); // EventSource reconnects by itself and gets a fresh snapshot
}

function setLive(ok) {
  $('#live').textContent = ok ? 'Live' : 'Reconnecting…';
  $('#live').className = `pill ${ok ? 'live' : 'down'}`;
}

function onEvent(e) {
  events.push(e);
  if (events.length > 300) events.shift();
  if (e.type === 'battle.resolved' || e.type === 'stronghold.captured') burst(e.data.x, e.data.y);
  if (filter === 'all' || e.stage === filter) {
    $('#events').insertAdjacentHTML('afterbegin', logLine(e));
    while ($('#events').children.length > 150) $('#events').lastChild.remove();
  }
  if (!replaying) {
    renderTheater();
    renderPipeline();
  }
  renderLens();
}

// Plays the latest turn back step by step: n8n → AI thoughts and tool calls → order → game → chain.
async function replay() {
  const last = events.findLast((e) => e.type === 'agent.decision');
  if (!last || replaying) return;
  replaying = true;
  const steps = events.filter((e) => e.traceId === last.traceId);
  for (let i = 1; i <= steps.length; i++) {
    renderTheater(steps.slice(0, i));
    renderPipeline(steps.slice(0, i));
    await new Promise((r) => setTimeout(r, reduced ? 0 : 700));
  }
  replaying = false;
}

function renderNext() {
  if (!S || TIMELAPSE) return;
  const s = S.state, at = S.meta.nextTurnAt, mins = Math.round(S.meta.turnIntervalMs / 60000);
  const left = Math.max(0, Math.round((at - Date.now()) / 1000));
  $('#next').textContent = s.status !== 'running' ? 'New season starting…'
    : !at ? 'Turn in progress…'
    : `Next turn in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · one every ${mins} min`;
}

// ---------- map ----------
function drawBoard() {
  let g = '';
  S.meta.map.forEach((row, y) => [...row].forEach((c, x) => {
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
    const who = h.owner ? S.meta.cast[h.owner].realm : 'neutral';
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
    el.querySelector('title').textContent = `${S.meta.cast[k].realm} army: strength ${a.strength}, morale ${a.morale}${a.fortified ? ', fortified' : ''}`;
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
function renderState() {
  if (!S) return;
  const { state: s, meta, counters: C } = S;
  $('#clock').textContent = `Season ${s.season} · Round ${Math.ceil(s.turn / 2)} of ${s.maxRounds}${meta.paused ? ' · paused (nobody watching)' : ''}`;
  const live = meta.llm.mode === 'live';
  $('#ai-mode').textContent = live ? `AI: live · ${meta.llm.model.split('/').pop()} · free tier` : 'Generals resting: running on standing orders';
  $('#ai-mode').className = `pill ${live ? '' : 'warn'}`;
  $('#ai-mode').title = meta.llm.why ?? `${meta.llm.callsToday} AI calls today`;
  $('#counters').innerHTML = [['AI decisions', C.decisions], ['Tool calls', C.toolCalls], ['Automations run', C.automations], ['Oracle reads', C.oracleReads], ['On-chain receipts', C.receipts]]
    .map(([l, v]) => `<div><dt>${l}</dt><dd>${v.toLocaleString()}</dd></div>`).join('');
  renderNext();
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
  const { state: s, meta } = S;
  $('#kingdoms').innerHTML = ['red', 'blue'].map((k) => {
    const K = s.kingdoms[k], A = s.armies[k], c = meta.cast[k];
    const held = s.strongholds.filter((h) => h.owner === k).length, tiles = s.owner.filter((o) => o === k).length;
    const journal = (S.journals[k] ?? []).slice().reverse().map((j) => `<li>${esc(j.note)} <span class="muted">(turn ${j.turn})</span></li>`).join('') || '<li class="muted">No notes yet.</li>';
    const lessons = (S.lessons[k] ?? []).map((l) => `<li>${esc(l)}</li>`).join('');
    const market = k === 'red'
      ? `Treasury in ETH · ETH ${meta.price ? `$${meta.price.usd.toFixed(2)}` : '…'} from Chainlink${s.market.start && s.market.price ? `, ${s.market.price >= s.market.start ? '+' : ''}${((s.market.price / s.market.start - 1) * 100).toFixed(2)}% this season` : ''} · income ×${s.market.mult} <span class="muted">(game effect amplified ${meta.amplify}×)</span>`
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
  const { chain } = S.meta;
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
  el.hidden = s.status !== 'ended' || dismissedSeason === s.season;
  if (el.hidden) return;
  const lessons = ['red', 'blue'].map((k) => (S.lessons[k]?.length ? `<p><b>${S.meta.cast[k].general}:</b> “${esc(S.lessons[k].at(-1))}”</p>` : '')).join('');
  el.innerHTML = `<div class="card" role="dialog" aria-label="Season results"><p class="muted">Season ${s.season} is over</p><h2>${S.meta.cast[s.winner].realm} wins</h2><p>${esc(s.endReason)}.</p>
    <p class="muted">${TIMELAPSE ? 'End of the recording. The result was written on-chain and each general wrote a lesson into its memory.' : 'The result is being written on-chain and each general has written a lesson into its memory. A new season starts in about a minute.'}</p>
    ${lessons}<button class="btn" id="results-close">Keep watching</button></div>`;
}

const logLine = (e) => `<li data-id="${e.id}"${pinned?.id === e.id ? ' class="sel"' : ''}><time>${new Date(e.ts).toLocaleTimeString([], { hour12: false })}</time>${badge(e.stage)}<span class="sum">${esc(e.summary)}</span></li>`;

function renderLog() {
  $('#events').innerHTML = events.filter((e) => filter === 'all' || e.stage === filter).slice(-150).reverse().map(logLine).join('');
}

function renderFilters() {
  $('#filters').innerHTML = [['all', 'All'], ...Object.entries(TECH).map(([k, t]) => [k, t.label])]
    .map(([k, l]) => `<button data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('');
}

function renderTheater(list = events) {
  const start = list.findLast((e) => e.type === 'agent.thinking_started');
  if (!start) return;
  const steps = list.filter((e) => e.traceId === start.traceId && e.stage === 'agent' && e.id > start.id);
  const decided = steps.some((e) => e.type === 'agent.decision');
  $('#theater-who').textContent = decided ? `${S?.meta.cast[start.kingdom]?.general ?? 'The general'} has given the order.` : start.summary;
  $('#theater').innerHTML = steps.map((e) => {
    const cls = { 'agent.thought': 'thought', 'agent.tool_called': 'call', 'agent.decision': 'decision', 'agent.fallback': 'fallback' }[e.type] ?? 'result';
    const text = e.type === 'agent.tool_called' ? `> ${e.summary.split('→ ').pop()}` : e.type === 'agent.thought' && e.data.text ? `“${e.data.text}”` : e.summary;
    return `<li class="${cls}">${esc(text)}</li>`;
  }).join('');
}

function renderPipeline(list = events) {
  const tr = list.findLast((e) => e.type === 'turn.started')?.traceId;
  const inTurn = list.filter((e) => e.traceId === tr && pipeStage(e));
  const now = inTurn.length ? pipeStage(inTurn.at(-1)) : null;
  $('#pipeline').innerHTML = STAGES.map((st) => {
    const last = inTurn.findLast((e) => pipeStage(e) === st.id);
    return `<li class="${last ? 'done' : ''}${now === st.id ? ' now' : ''}"><b>${st.name}</b><span>${esc(last ? last.summary : st.hint)}</span></li>`;
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
    <p class="muted">${pinned ? '<button class="btn" id="unpin">Follow live events</button>' : 'Following live events. Click any log line to pin it here.'}</p>`;
}

// ---------- wiring ----------
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
$('#replay').addEventListener('click', replay);
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

// ---------- timelapse: replay a recorded season (events + one snapshot per turn) through the same panels ----------
let speed = 4;
let tlPaused = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timelapse(n) {
  $('#tl-bar').hidden = false;
  $('#tl-title').textContent = `Timelapse · Season ${n}`;
  $('#live').textContent = 'Recording';
  $('#live').className = 'pill tag';
  $('#next').hidden = true;
  const setSpeed = (v) => {
    speed = v;
    document.querySelectorAll('.tl-speed .btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
  };
  setSpeed(speed);
  document.querySelector('.tl-speed').addEventListener('click', (ev) => ev.target.dataset.speed && setSpeed(+ev.target.dataset.speed));
  $('#tl-pause').addEventListener('click', () => {
    tlPaused = !tlPaused;
    $('#tl-pause').textContent = tlPaused ? 'Play' : 'Pause';
  });
  const [live, res] = await Promise.all([fetch('/api/state').then((r) => r.json()), fetch(`/api/seasons/${n}`)]);
  const lines = res.ok ? (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const first = lines.find((l) => l.k === 's');
  if (!first) {
    $('#theater-who').textContent = `There is no recording of season ${n} yet.`;
    return;
  }
  S = { ...live, ...first.s };
  events = [];
  drawBoard();
  renderState();
  renderLog();
  const turns = lines.filter((l) => l.k === 's').length;
  let seen = 0;
  for (const line of lines) {
    while (tlPaused) await sleep(200);
    if (line.k === 's') {
      Object.assign(S, line.s);
      renderState();
      $('#tl-progress').textContent = `Turn ${S.state.turn} · snapshot ${++seen} of ${turns} · ${new Date(line.s.at).toLocaleString()}`;
      await sleep(1200 / speed);
    } else {
      onEvent(line.e);
      await sleep(line.e.stage === 'agent' ? 260 / speed : 90 / speed);
    }
  }
  $('#tl-progress').textContent += ' · end of recording';
}

renderFilters();
if (TIMELAPSE) timelapse(TIMELAPSE); // after the declarations above, which it uses
else connect();
