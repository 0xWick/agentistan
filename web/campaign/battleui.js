// The field of battle, for a commander who takes command of it: the ground as a small board, the units as counters,
// hour by hour. Tap one of your units, then a square to send it there or an enemy to attack; or speak to your officers
// in plain words. "Next hour" plays the hour; "Fall back" ends it; "Leave it to the general" fights the rest of the day
// for you. Every hour's orders are kept in the record the season ends with, and the engine fights it again from them.
import { newField, hour, reachOf, aiOrders, sanitize, battleWords, report, label, W, H, TYPES, GROUND, HOURS } from './battle.js';

const NS = 'http://www.w3.org/2000/svg', CELL = 56;
const el = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
const TILE = { open: '#e6d7a9', hill: '#cdb57c', wood: '#93a56c', marsh: '#a7bba8', river: '#7fa3bd', ford: '#a9c3d0', rock: '#8c7f6a' };
const MARK = { // the ground's own ink: a hill, trees, reeds, a ford
  hill: 'M8 40 22 18l8 11 6-8 12 19', wood: 'M14 42V34M10 34l4-12 4 12zM34 42V32M29 32l5-14 5 14zM24 38v-6M21 32l3-9 3 9z',
  marsh: 'M8 38h40M12 32h14M30 32h12M18 26v12M36 26v12', ford: 'M10 22h36M10 30h36M10 38h36', rock: 'M8 44 18 16l10 14 8-10 12 24z',
};
const GLYPH = { // the counters: a shield for foot, a horse's head for horse, a bow for archers
  foot: 'M28 10l14 5v11c0 9-6 15-14 19-8-4-14-10-14-19V15z',
  horse: 'M18 44c0-9 2-16 8-21l-4-9 9 4 11 8-3 4-7-2c1 7 4 11 4 16z',
  bows: 'M20 10c14 6 14 30 0 36M20 10v36M14 28h26M34 23l6 5-6 5',
};

// Ask, then fight. Resolves with the record (or null: the general fights it, as the rules would).
export function commandBattle(b, ui) {
  return new Promise((done) => {
    const S = b.setup, you = S.you, them = you === 'a' ? 'd' : 'a';
    const ours = S.armies.filter((a) => a.camp === you), theirs = S.armies.filter((a) => a.camp === them);
    const men = (list) => ui.fmtMen(list.reduce((t, a) => t + a.men, 0)), leader = ours.find((a) => a.hero)?.gen ?? ours[0]?.gen ?? 'your general';
    ui.openSheet(`<h2>A battle at ${ui.esc(S.place)}</h2>
      <p class="sub">${ui.esc(S.names[you])}, ${men(ours)} men under ${ui.esc(ours.map((a) => a.gen ?? 'its officers').join(' and '))}, against ${ui.esc(S.names[them])}, ${men(theirs)} under ${ui.esc(theirs.map((a) => a.gen ?? 'its officers').join(' and '))}.</p>
      <p>The ground is ${ui.esc(S.ground)}. ${ui.esc(ui.planName(S.plans[you]))} is our plan; theirs, ${ui.esc(ui.planName(S.plans[them]).toLowerCase())}. Will you take command on the field, hour by hour, or leave the battle to ${ui.esc(leader)}?</p>
      <div class="share"><button class="btn main" data-take>Take command</button><button class="btn" data-leave>Leave it to ${ui.esc(leader.split(' ')[0])}</button></div>`, { onClose: () => done(null) });
    const sheet = document.getElementById('sheet');
    sheet.querySelector('[data-leave]').onclick = () => { sheet.onclose = null; sheet.close(); done(null); };
    sheet.querySelector('[data-take]').onclick = () => { sheet.onclose = null; fight(b, ui, done); };
  });
}

function fight(b, ui, done) {
  const S = b.setup, you = S.you, tempers = S.tempers, record = { rounds: [] };
  let f = newField(S), orders = {}, sel = null, busy = false;
  const talk = [{ who: 'herald', text: `The armies are drawn up at ${S.place}. ${S.names[you]} on the ${you === 'a' ? 'left' : 'right'} of the field. ${HOURS} hours of daylight.` }];
  ui.openSheet(`<div class="field">
      <header class="f-head"><div><h2>The battle of ${ui.esc(S.place)}</h2><p class="sub" id="f-sub"></p></div><button class="x" data-close aria-label="Leave it to the general">×</button></header>
      <div class="f-body"><div class="f-board"><svg id="f-svg" viewBox="0 0 ${W * CELL} ${H * CELL}" role="img" aria-label="The field of battle"></svg><p class="f-help">Tap one of your units, then a square to send it there or an enemy to attack. Tap it again to hold.</p></div>
        <aside class="f-talk"><ol id="f-log"></ol>
          <div class="f-chips" id="f-chips"></div>
          <form id="f-say" class="f-say"><input id="f-text" maxlength="200" autocomplete="off" placeholder="Speak to your officers…" aria-label="Your words"><button class="btn">Speak</button></form>
          <div class="f-act"><button class="btn main" id="f-next">Next hour</button><button class="btn" id="f-back">Fall back</button><button class="btn" id="f-auto">Leave it to the general</button></div>
        </aside></div></div>`, { wide: true, onClose: () => finish(true) });
  const sheet = document.getElementById('sheet'), svg = sheet.querySelector('#f-svg'), log = sheet.querySelector('#f-log');

  function finish(auto) {
    if (finish.done) return;
    finish.done = true;
    if (auto && !f.over) record.auto = true;
    sheet.onclose = null;
    if (sheet.open) sheet.close();
    done(record);
  }
  const unitAt = (x, y) => f.units.find((u) => !u.gone && u.x === x && u.y === y);
  function draw() {
    svg.innerHTML = '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const g = f.ground[y][x], gx = x * CELL, gy = y * CELL;
      svg.append(el('rect', { x: gx, y: gy, width: CELL, height: CELL, fill: TILE[g], class: 'f-tile', 'data-x': x, 'data-y': y }));
      if (MARK[g]) svg.append(el('path', { d: MARK[g], transform: `translate(${gx} ${gy})`, fill: g === 'wood' || g === 'rock' ? 'rgba(58,40,22,0.35)' : 'none', stroke: 'rgba(58,40,22,0.45)', 'stroke-width': 1.6, 'pointer-events': 'none' }));
    }
    const u0 = sel && f.units.find((u) => u.id === sel && !u.gone);
    if (u0) for (const [x, y] of reachOf(f, u0)) svg.append(el('rect', { x: x * CELL + 3, y: y * CELL + 3, width: CELL - 6, height: CELL - 6, rx: 6, class: 'f-reach', 'data-x': x, 'data-y': y }));
    for (const [id, o] of Object.entries(orders)) { // the orders, as arrows
      const u = f.units.find((x) => x.id === id && !x.gone);
      const t = o.attack ? f.units.find((x) => x.id === o.attack && !x.gone) : o.to ? { x: o.to[0], y: o.to[1] } : null;
      if (!u || !t) continue;
      svg.append(el('line', { x1: u.x * CELL + CELL / 2, y1: u.y * CELL + CELL / 2, x2: t.x * CELL + CELL / 2, y2: t.y * CELL + CELL / 2, class: `f-order${o.attack ? ' attack' : ''}` }));
    }
    for (const u of f.units.filter((x) => !x.gone)) {
      const g = el('g', { class: `f-unit ${u.camp === you ? 'mine' : 'theirs'}${u.id === sel ? ' sel' : ''}${orders[u.id]?.hold ? ' hold' : ''}`, transform: `translate(${u.x * CELL + 4} ${u.y * CELL + 4})`, 'data-unit': u.id });
      g.append(el('rect', { width: CELL - 8, height: CELL - 8, rx: 7, fill: S.colors[u.camp] ?? '#6a5032', class: 'f-chip' }));
      g.append(el('path', { d: GLYPH[u.type], transform: 'scale(0.62) translate(5 0)', fill: 'rgba(251,243,221,0.92)', stroke: 'rgba(42,28,14,0.6)', 'stroke-width': 1.5 }));
      g.append(el('text', { x: (CELL - 8) / 2, y: CELL - 13, class: 'f-men' }, u.men >= 1000 ? `${(u.men / 1000).toFixed(u.men >= 10000 ? 0 : 1)}k` : `${u.men}`));
      g.append(el('rect', { x: 3, y: 2, width: (CELL - 14) * Math.max(0, u.morale) / 100, height: 3, rx: 1.5, class: 'f-morale' }));
      g.append(el('title', {}, `${label(u)}${u.camp === you ? '' : ` (${S.names[u.camp]})`}: ${u.men} men, spirits ${Math.round(u.morale)} of 100`));
      svg.append(g);
    }
    sheet.querySelector('#f-sub').textContent = f.over ? (f.winner === you ? 'The field is ours.' : 'The day is lost.') : `Hour ${f.hour + 1} of ${HOURS} · ${S.names[you]} against ${S.names[you === 'a' ? 'd' : 'a']}`;
    log.innerHTML = talk.map((m) => `<li class="${m.who === 'you' ? 'you' : m.who === 'herald' ? 'herald' : ''}">${m.who && m.who !== 'you' && m.who !== 'herald' ? `<b>${ui.esc(m.who)}</b> ` : ''}${ui.esc(m.text)}</li>`).join('');
    log.scrollTop = log.scrollHeight;
    sheet.querySelector('#f-chips').innerHTML = f.over ? '' : ['Charge!', 'Hold the line', 'Horse, round their flank', 'Archers, loose at their foot', 'Take the high ground'].map((c) => `<button type="button" class="pick">${c}</button>`).join('');
    for (const b2 of ['#f-next', '#f-back', '#f-auto']) sheet.querySelector(b2).disabled = busy || f.over;
    if (f.over) { sheet.querySelector('.f-act').innerHTML = '<button class="btn main" id="f-done">Back to the war</button>'; sheet.querySelector('#f-done').onclick = () => finish(false); }
  }
  const officer = (unitId) => { const u = f.units.find((x) => x.id === unitId); return u?.camp === you ? u.gen ?? 'An officer' : 'A scout'; };
  svg.addEventListener('click', (e) => {
    if (f.over || busy) return;
    const ug = e.target.closest('[data-unit]'), id = ug?.dataset.unit, u = id && f.units.find((x) => x.id === id);
    if (u && u.camp === you) { if (sel === id) { orders[id] = { hold: true }; sel = null; } else sel = id; return draw(); }
    if (!sel) return;
    if (u && u.camp !== you) { orders[sel] = { attack: u.id }; sel = null; return draw(); }
    const t = e.target.closest('[data-x]');
    if (t) { orders[sel] = { to: [+t.dataset.x, +t.dataset.y] }; sel = null; draw(); }
  });
  async function speak(text) {
    text = text.trim();
    if (!text || f.over) return;
    talk.push({ who: 'you', text });
    const r = battleWords(f, text);
    if (r.retreat) return back();
    Object.assign(orders, r.orders);
    if (r.said && !Object.keys(r.orders).length) talk.push({ who: officer(Object.keys(orders)[0]), text: r.said });
    draw();
    const ai = await ui.ask?.(f, text).catch(() => null); // the officers' own voices, and what the AI reads in the words
    if (ai) {
      Object.assign(orders, sanitize(f, ai.orders));
      for (const m of ai.replies ?? []) talk.push({ who: m.who, text: m.text });
    } else if (Object.keys(r.orders).length) talk.push({ who: officer(Object.keys(r.orders)[0]), text: 'It will be done.' });
    draw();
  }
  async function next() {
    if (busy || f.over) return;
    busy = true;
    const mine = sanitize(f, orders), before = f;
    record.rounds.push({ orders: mine });
    f = hour(f, mine, { tempers });
    orders = {};
    for (const l of report(before, f)) talk.push({ who: l.camp === you ? officer(l.unit) : 'herald', text: l.text });
    if (f.over) talk.push({ who: 'herald', text: f.winner === you ? `Victory at ${S.place}.` : `The battle of ${S.place} is lost.` });
    busy = false;
    draw();
    if (!f.over) ui.ask?.(f, null).then((ai) => { if (!ai) return; for (const m of ai.replies ?? []) talk.push({ who: m.who, text: m.text }); Object.assign(orders, sanitize(f, ai.orders)); draw(); }).catch(() => {});
  }
  function back() {
    if (f.over) return;
    record.rounds.push({ orders: {}, retreat: true });
    f = hour(f, {}, { retreat: you, tempers });
    talk.push({ who: 'herald', text: f.log.at(-1)?.text ?? 'We fall back.' });
    draw();
  }
  function auto() { // the rest of the day, as the general fights it: exactly as the engine will
    if (f.over) return;
    record.auto = true;
    while (!f.over) { const before = f; f = hour(f, aiOrders(f, you, 'steady'), { tempers }); for (const l of report(before, f).slice(0, 1)) talk.push({ who: 'herald', text: `Hour ${f.hour}: ${l.text}` }); }
    talk.push({ who: 'herald', text: f.winner === you ? `Victory at ${S.place}.` : `The battle of ${S.place} is lost.` });
    draw();
  }
  sheet.querySelector('#f-say').addEventListener('submit', (e) => { e.preventDefault(); const i = sheet.querySelector('#f-text'); speak(i.value); i.value = ''; });
  sheet.querySelector('#f-chips').addEventListener('click', (e) => { const p = e.target.closest('.pick'); if (p) speak(p.textContent); });
  sheet.querySelector('#f-next').onclick = next;
  sheet.querySelector('#f-back').onclick = back;
  sheet.querySelector('#f-auto').onclick = auto;
  draw();
}
