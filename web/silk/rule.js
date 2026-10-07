// Playing: in the living world, the lobby (start a game, join one); in a game, the player's seat: claim a realm,
// answer the ruler's decisions, give orders, mark yourself ready, or hand the realm to its vizier (the AI) or to the
// rules. Orders go to the server and pass the engine's checks when the month turns.
import { S, $, esc, icon, chip } from './ui.js';
import { living, provincesOf, atWar, allied, steersman, claimsOf, cityOf, dateText } from './engine.js';
import { RULES } from './rules.js';
import { neighbours, bestWork } from './doctrine.js';

export const GAME = new URLSearchParams(location.search).get('game');
export const API = GAME ? `/api/game/${encodeURIComponent(GAME)}/era` : '/api/era';
const KEY = `agentistan:seat:${GAME}`;
const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v) => { try { localStorage.setItem(KEY, v); } catch { /* private window */ } } };
const post = (u, body) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => ({})));
let me = null, seats = [];
const POWER = { levy: 'Great Levy: every village sends its sons', walls: 'Mighty Walls round the capital', bribe: 'Bribe a neighbouring governor', feast: 'A Royal Feast for the people', silktax: 'A Silk Tax on the caravans' };
const PACE = { quick: 'a month every 3 minutes', hour: 'a month every hour', evening: 'a month every 4 hours' };

export const seatsByRealm = () => Object.fromEntries(seats.map((x) => [x.realm, x]));
export async function loadSeats() {
  if (!GAME) return;
  const d = await fetch(`${API}/seats`).then((r) => r.json()).catch(() => null);
  seats = d?.seats ?? [];
  const token = store.get();
  me = token ? await post(`${API}/me`, { token }).then((x) => (x.realm ? { ...x, token } : null)) : null;
}
export function onSeats(list) { seats = list ?? seats; if (!$('#rule').hidden) render(); }

export async function openRule() {
  $('#rule').hidden = false;
  $('#rule-btn').setAttribute('aria-pressed', 'true');
  await loadSeats();
  render();
}
export function closeRule() {
  $('#rule').hidden = true;
  $('#rule-btn').setAttribute('aria-pressed', 'false');
}
export async function refreshRule() { if (!$('#rule').hidden) { await loadSeats(); render(); } }

async function render() {
  const box = $('#rule-body'), s = S.s;
  if (!GAME) return lobby(box);
  if (!me) {
    const taken = seatsByRealm();
    const free = living(s).map((r) => [r, provincesOf(s, r.id).length]).filter(([r, n]) => n > 0 && !taken[r.id] && !r.rebel).sort((a, b) => b[1] - a[1]);
    box.innerHTML = `<p class="sub">Choose a realm to rule. Its ruler's choices become yours; the rules play everyone else.</p>
      ${seats.length ? `<div class="row">${icon('people')}<span>Seated</span> ${seats.map((x) => `${chip(x.realm)} <small>${esc(x.name)}</small>`).join(' ')}</div>` : ''}
      <form id="claim-form" class="rule-form">
        <label><span>Realm</span><select name="realm">${free.map(([r, n]) => `<option value="${r.id}">${esc(r.name)} · ${n} provinces</option>`).join('')}</select></label>
        <label><span>Your name</span><input name="name" maxlength="24" required placeholder="As the chronicles shall call you"></label>
        <label><span>Discord webhook <small>(optional: your reminders)</small></span><input name="webhook" placeholder="https://discord.com/api/webhooks/…"></label>
        <button class="btn main wide">Take the throne</button>
      </form>`;
    $('#claim-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), d = await post(`${API}/claim`, Object.fromEntries(f));
      if (d.token) { store.set(d.token); await loadSeats(); render(); } else box.insertAdjacentHTML('afterbegin', `<p class="note">${esc(d.error ?? 'That did not work.')}</p>`);
    };
    return;
  }
  const r = s.realms[me.realm];
  if (!r || r.fallen) { box.innerHTML = `<p class="sub">Your realm, ${esc(r?.name ?? me.realm)}, is no more. The chronicles will remember ${esc(me.name)}.</p>`; return; }
  const who = steersman(s, r), next = neighbours(s, r.id).realms, wars = next.concat(living(s).map((o) => o.id)).filter((id, i, a) => a.indexOf(id) === i && atWar(s, r.id, id));
  const peaceful = next.filter((id) => !atWar(s, r.id, id)), friends = peaceful.filter((id) => !allied(s, r.id, id) && !s.realms[id].nomad);
  const work = bestWork(s, r.id), claims = claimsOf(s, r.id).filter((c) => !atWar(s, r.id, c.holder));
  const mins = Math.max(0, Math.round(((me.next ?? Date.now()) - Date.now()) / 60000));
  const opts = (ids) => ids.map((id) => `<option value="${id}">${esc(s.realms[id].short)}</option>`).join('');
  box.innerHTML = `<div class="who">${chip(r.id)}<span>${esc(who?.title ?? '')} ${esc(who?.name ?? '')} · played by ${esc(me.name)}</span></div>
    <p class="sub">${me.ready ? 'You are ready.' : 'Your orders for this month.'} The month turns in ${mins} min, sooner if everyone is ready.</p>
    ${(me.decisions ?? []).length ? `<div class="decisions">${me.decisions.map((d) => `<div class="decision"><p>${esc(d.question)}</p><div class="picks">${d.options.map((o) => `<button class="pick" data-answer="${d.id}" data-choice="${o}">${esc(o)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
    <form id="orders" class="rule-form">
      <label><span>${icon('coin')} Taxes</span><select name="tax"><option value="">as they are (${esc(r.tax)})</option><option value="low">low: the people are grateful</option><option value="normal">normal</option><option value="high">high: gold now, anger later</option></select></label>
      ${peaceful.length ? `<label><span>${icon('swords')} Declare war on</span><select name="war"><option value=""></option>${opts(peaceful)}</select></label>` : ''}
      ${wars.length ? `<label><span>${icon('scroll')} Offer peace to</span><select name="peace"><option value=""></option>${opts(wars)}</select></label>` : ''}
      ${friends.length ? `<label><span>${icon('rings')} Seek an alliance with</span><select name="ally"><option value=""></option>${opts(friends)}</select></label>` : ''}
      ${work ? `<label class="check"><input type="checkbox" name="build"> ${icon('hammer')} Build a ${esc(work.work)} at ${esc(cityOf(s, work.place))} (${RULES.works[work.work].cost} gold)</label>` : ''}
      ${!r.power ? `<label><span>${icon('star')} Your reign's great gamble</span><select name="power"><option value=""></option>${Object.entries(POWER).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></label>` : ''}
      ${claims.length ? `<label><span>${icon('scales')} Take a claim to an arbiter</span><select name="claim"><option value=""></option>${claims.map((c) => `<option value="${c.place}">${esc(cityOf(s, c.place))}</option>`).join('')}</select></label>` : ''}
      <label><span>${icon('quill')} Your words to the chronicle </span><input name="say" maxlength="120" placeholder="optional"></label>
      <div class="go"><button class="btn main" value="send">Send orders</button><button class="btn" type="button" id="ready">${icon('play')} Ready</button></div>
    </form>
    <div class="delegate">${icon('eye')} When I am away, my realm is played by
      <label><input type="radio" name="delegate" value="me"${me.delegate === 'me' ? ' checked' : ''}> nobody: the rules wait for me</label>
      <label><input type="radio" name="delegate" value="ai"${me.delegate === 'ai' ? ' checked' : ''}> my vizier (the AI)</label>
      <label><input type="radio" name="delegate" value="doctrine"${me.delegate === 'doctrine' ? ' checked' : ''}> the rules</label></div>
    <p class="fine">Share this game: <a href="${location.href}">${esc(location.href)}</a></p>`;
  $('#orders').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), say = f.say || undefined, acts = [];
    if (f.war) acts.push({ kind: 'war', target: f.war, say });
    if (f.peace) acts.push({ kind: 'peace', target: f.peace });
    if (f.ally) acts.push({ kind: 'ally', target: f.ally });
    if (f.build && work) acts.push({ kind: 'build', ...work });
    if (f.power) acts.push({ kind: 'power', power: f.power });
    if (f.claim) acts.push({ kind: 'claim', place: f.claim });
    const d = await post(`${API}/act`, { token: me.token, acts, tax: f.tax || undefined });
    box.insertAdjacentHTML('afterbegin', `<p class="note">${d.queued !== undefined ? `${d.queued} orders sent: they take effect when ${dateText(d.month, s)} turns.` : esc(d.error ?? 'That did not work.')}</p>`);
  };
  $('#ready').onclick = async () => { await post(`${API}/ready`, { token: me.token }); await loadSeats(); render(); };
  box.querySelectorAll('[data-answer]').forEach((b) => (b.onclick = async () => { await post(`${API}/answer`, { token: me.token, id: b.dataset.answer, choice: b.dataset.choice }); b.closest('.decision').innerHTML = `<p class="note">You chose: ${esc(b.dataset.choice)}.</p>`; }));
  box.querySelectorAll('[name=delegate]').forEach((x) => (x.onchange = () => post(`${API}/delegate`, { token: me.token, to: x.value })));
}

async function lobby(box) {
  const games = await fetch('/api/games').then((r) => r.json()).catch(() => []);
  box.innerHTML = `<p class="sub">The living world is played by its own people. To rule a realm yourself, start a game and send the link to friends: each takes a realm; the rules, or the AI, play the rest.</p>
    <form id="new-game" class="rule-form">
      <label><span>Name</span><input name="name" maxlength="40" placeholder="A game of kings"></label>
      <label><span>Age</span><select name="age"><option value="1200">The Old World, 1200</option><option value="ancient">The ancient world, 200 BC</option></select></label>
      <label><span>Pace</span><select name="pace">${Object.entries(PACE).map(([k, t]) => `<option value="${k}"${k === 'hour' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <button class="btn main wide">Start a game</button>
    </form>
    ${games.length ? `<h3 class="games-h">Games under way</h3><ul class="games">${games.slice(0, 8).map((g) => `<li><a href="/?game=${encodeURIComponent(g.id)}">${esc(g.name)}</a> <small>${PACE[Object.keys(PACE).find((k) => g.pace === { quick: 180000, hour: 3600000, evening: 14400000 }[k])] ?? ''}</small></li>`).join('')}</ul>` : ''}`;
  $('#new-game').onsubmit = async (e) => {
    e.preventDefault();
    const d = await post('/api/games', Object.fromEntries(new FormData(e.target)));
    if (d.url) location.href = d.url;
    else box.insertAdjacentHTML('afterbegin', `<p class="note">${esc(d.error ?? 'The game could not be started.')}</p>`);
  };
}
