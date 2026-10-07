// The dashboards: a dossier for any realm (who rules it, what it holds, whom it fights, and its rise and fall over the
// years), and the world ledger (the rankings, the web of alliances, wars and client states, the great powers' lines).
// Drawn in ink on parchment; the yearly figures come from the server's ledger (the living world) or the page's own
// yearly frames (your own age).
import { S, $, esc, icon, chip, personChip, meter, men, sign, loyalColor, ink } from './ui.js';
import { living, provincesOf, menOf, atWar, allied, steersman, prosperityOf, yearOf, yearLabel, cityOf, ledgerOf, rulingTemper } from './engine.js';
import { incomeOf } from './economy.js';
import { heldBy, RESOURCES } from './resources.js';
import { portrait } from './portrait.js';
import { TEMPER_TEXT } from './names.js';
import { ageOf } from './core.js';
import { API } from './rule.js';

let cache = null;
async function years() { // [{ m, rows: { realm: [provinces, strength, gold, prosperity] } }]
  const s = S.s;
  if (S.live) {
    if (!cache || cache.age !== S.era?.age || cache.until < s.month - 11) {
      const rows = await fetch(`${API}/ledger?age=${S.era?.age ?? ''}`).then((r) => r.json()).catch(() => []);
      cache = { rows, age: S.era?.age, until: s.month };
    }
    return [...cache.rows.filter((x) => x.m <= s.month), { m: s.month, rows: ledgerOf(s) }];
  }
  return [...Object.entries(S.story?.keys ?? {}).map(([m, st]) => ({ m: +m, rows: ledgerOf(st) })).filter((x) => x.m < s.month).sort((a, b) => a.m - b.m), { m: s.month, rows: ledgerOf(s) }];
}

// ---------- a line chart in ink ----------
function chart(lines, { w = 520, h = 170, label = '' } = {}) {
  const all = lines.flatMap((l) => l.points);
  if (!lines.some((l) => l.points.length >= 2)) return '<p class="sub">The chronicle is too young for a chart: come back in a year or two.</p>';
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(1, ...ys);
  const L = 34, B = 20, X = (x) => L + ((x - x0) / Math.max(1, x1 - x0)) * (w - L - 10), Y = (y) => h - B - (y / y1) * (h - B - 8);
  const ticks = [];
  const span = x1 - x0, step = span > 600 ? 120 : span > 240 ? 60 : span > 96 ? 24 : 12;
  for (let m = Math.ceil(x0 / step) * step; m <= x1; m += step) ticks.push(m);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    <path d="M${L} 6V${h - B}H${w - 6}" class="axis"/>
    ${[0.5, 1].map((f) => `<path d="M${L} ${Y(y1 * f)}H${w - 6}" class="grid"/><text x="${L - 4}" y="${Y(y1 * f) + 4}" class="yl">${Math.round(y1 * f)}</text>`).join('')}
    ${ticks.map((m) => `<text x="${X(m)}" y="${h - 5}" class="xl">${esc(yearLabel(yearOf(m, S.s)))}</text>`).join('')}
    ${lines.map((l) => `<path d="M${l.points.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join('L')}" class="line" style="stroke:${l.color}"/>${l.points.length ? `<circle cx="${X(l.points.at(-1)[0])}" cy="${Y(l.points.at(-1)[1])}" r="3" style="fill:${l.color}"/>` : ''}`).join('')}
  </svg>${lines.length > 1 ? `<p class="legend">${lines.map((l) => `<span><i style="background:${l.color}"></i>${esc(l.name)}</span>`).join('')}</p>` : ''}`;
}

// ---------- the dossier of a realm ----------
export async function openDossier(id) {
  const s = S.s, r = s.realms[id];
  if (!r) return;
  const ys = await years(), ruler = s.chars[r.ruler], who = steersman(s, r), mine = provincesOf(s, id);
  const rank = living(s).map((o) => [o.id, provincesOf(s, o.id).length]).sort((a, b) => b[1] - a[1]).findIndex(([x]) => x === id) + 1;
  const loyal = mine.reduce((t, p) => t + s.provinces[p.id].loyalty, 0) / Math.max(1, mine.length);
  const wars = living(s).filter((o) => atWar(s, id, o.id)), friends = living(s).filter((o) => allied(s, id, o.id)), clients = living(s).filter((o) => o.overlord === id);
  const kin = living(s).filter((o) => o.id !== id && s.kin?.[[id, o.id].sort().join('|')]);
  const pays = Object.values(s.treaties).filter((t) => t.ended === null && t.pay && t.parties.includes(id));
  const held = Object.entries(heldBy(s, id));
  const line = (k, name, color) => ({ name, color, points: ys.filter((y) => y.rows[id]).map((y) => [y.m, y.rows[id][k]]) });
  const events = [];
  for (let m = s.month - 1; m >= 0 && events.length < 8; m--) for (const e of [...(S.story?.events?.[m] ?? [])].reverse()) if (e.realms?.includes(id) && !e.minor && events.length < 8) events.push(e);
  const past = (r.lineage ?? []).slice(-8).reverse();
  dash(`<header class="d-head"><i class="shield big" style="--c:${r.color}"></i>
      <div><h2>${esc(r.name)}</h2>${r.fa ? `<p class="fa">${esc(r.fa)}</p>` : ''}<p class="sub">${esc(r.dynasty ?? '')} · ranked ${rank} of ${living(s).length} by land${s.players?.[id] ? ` · ${icon('crown')} ruled by ${esc(s.players[id].name)}` : ''}</p></div></header>
    <div class="d-grid">
      <section>
        <div class="d-ruler">${ruler ? portrait(ruler, { color: r.color, age: ageOf(s, ruler), size: 72, uid: 'dossier' }) : ''}<div>
          <p><b>${esc(ruler?.title ?? '')} ${esc(ruler?.name ?? '—')}</b>${ruler?.epithet ? ` <i>${esc(ruler.epithet)}</i>` : ''}</p>
          <p class="sub">${TEMPER_TEXT[rulingTemper(s, r)] ? `${esc(TEMPER_TEXT[rulingTemper(s, r)][0])}: ${esc(TEMPER_TEXT[rulingTemper(s, r)][1])}` : ''}${ruler ? ` · aged ${ageOf(s, ruler)}` : ''}</p>
          ${who && who.id !== ruler?.id ? `<p class="sub">Regent: ${personChip(who)}</p>` : ''}
          ${s.chars[r.heir] ? `<p class="sub">Heir: ${personChip(s.chars[r.heir])}</p>` : ''}${s.chars[r.vizier] ? `<p class="sub">Vizier: ${personChip(s.chars[r.vizier])}</p>` : ''}</div></div>
        <div class="tiles">
          <div><b>${mine.length}</b><small>provinces</small></div><div><b>${men(menOf(s, id))}</b><small>soldiers</small></div>
          <div><b>${Math.round(r.gold)}</b><small>gold ${sign(incomeOf(s, id))}/mo</small></div><div><b>${Math.round(r.grain ?? 0)}</b><small>grain</small></div></div>
        <p class="m">prosperity ${meter(prosperityOf(s, id), '#4f7a3a')}</p><p class="m">loyalty ${meter(loyal, loyalColor(loyal))}</p><p class="m">its word ${meter(r.rep ?? 60, '#b3852c')}</p>
        ${held.length ? `<p class="row">${held.map(([k, n]) => `<span class="rs" title="${esc(RESOURCES[k].text)}">${icon(RESOURCES[k].icon)} ${esc(RESOURCES[k].name)}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</p>` : ''}
        <h3>${icon('scales')} Relations</h3>
        ${wars.length ? `<p class="row">${icon('swords')} At war with ${wars.map((o) => chip(o.id)).join(' ')}</p>` : '<p class="row">At peace with all</p>'}
        ${friends.length ? `<p class="row">${icon('rings')} Allied with ${friends.map((o) => chip(o.id)).join(' ')}</p>` : ''}
        ${r.overlord ? `<p class="row">${icon('scroll')} A client of ${chip(r.overlord)}</p>` : ''}
        ${clients.length ? `<p class="row">${icon('scroll')} Its client states: ${clients.map((o) => chip(o.id)).join(' ')}</p>` : ''}
        ${kin.length ? `<p class="row">${icon('rings')} Kin by marriage: ${kin.map((o) => chip(o.id)).join(' ')}</p>` : ''}
        ${pays.length ? `<p class="row">${icon('coin')} ${pays.map((t) => t.pay.from === id ? `pays ${t.pay.gold}/mo to ${chip(t.pay.to)}` : `receives ${t.pay.gold}/mo from ${chip(t.pay.from)}`).join('; ')}</p>` : ''}
      </section>
      <section>
        <h3>${icon('banner')} Its rise and fall</h3>
        <h5>Provinces</h5>${chart([line(0, 'provinces', ink(r.color, 0.85))], { label: 'provinces by year' })}
        <h5>Strength</h5>${chart([line(1, 'strength', ink(r.color, 0.85))], { h: 130, label: 'strength by year' })}
        <h3>${icon('crown')} Its rulers</h3>
        <ul class="review">${ruler ? `<li><b>${esc(ruler.name)}</b> <small>since ${esc(yearLabel(ruler.since ?? yearOf(0, s)))}</small></li>` : ''}${past.map((l) => `<li>${esc(l.name)}${l.epithet ? ` <i>${esc(l.epithet)}</i>` : ''} <small>${esc(yearLabel(l.since))}–${esc(yearLabel(l.until))}${l.cause ? `, ${esc(l.cause)}` : ''}</small></li>`).join('')}</ul>
        <h3>${icon('book')} Lately</h3>
        <ul class="review">${events.map((e) => `<li><small>${esc(e.date)}</small> ${esc(e.text)}</li>`).join('') || '<li>Nothing the chronicle noted.</li>'}</ul>
      </section>
    </div>`);
}

// ---------- the world ledger ----------
export async function openLedger() {
  const s = S.s, ys = await years();
  const rows = living(s).map((r) => ({ r, n: provincesOf(s, r.id).length, men: menOf(s, r.id), gold: r.gold, pros: prosperityOf(s, r.id) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const top = rows.slice(0, 6).map((x) => x.r);
  const lines = top.map((r) => ({ name: r.short, color: ink(r.color, 0.8), points: ys.filter((y) => y.rows[r.id]).map((y) => [y.m, y.rows[r.id][0]]) }));
  const wars = [...new Map(Object.values(s.wars).map((w) => [w.conflict, s.conflicts[w.conflict]]).filter(([, c]) => c && c.ended === null)).values()];
  dash(`<header class="d-head"><i class="shield big" style="--c:#8c6b3f"></i><div><h2>The ledger of the world</h2><p class="sub">${esc(s.realms ? `${rows.length} realms` : '')} · ${esc(yearLabel(yearOf(s.month, s)))}</p></div></header>
    <div class="d-grid">
      <section>
        <h3>${icon('crown')} The powers</h3>
        <table class="ranks"><thead><tr><th></th><th>Realm</th><th>Land</th><th>Soldiers</th><th>Gold</th><th>Prosperity</th></tr></thead><tbody>
        ${rows.slice(0, 24).map((x, i) => `<tr><td>${i + 1}</td><td>${chip(x.r.id)}${s.players?.[x.r.id] ? ` <span title="Ruled by ${esc(s.players[x.r.id].name)}">${icon('crown')}</span>` : ''}</td><td>${x.n}</td><td>${men(x.men)}</td><td>${Math.round(x.gold)}</td><td>${meter(x.pros, '#4f7a3a')}</td></tr>`).join('')}
        </tbody></table>
      </section>
      <section>
        <h3>${icon('rings')} The web of power</h3>${web(s, rows.slice(0, 16).map((x) => x.r))}
        <h3>${icon('banner')} The great powers' land</h3>${chart(lines, { label: 'land of the great powers by year' })}
        <h3>${icon('swords')} Wars under way</h3>
        <ul class="review">${wars.map((c) => `<li><button class="link" data-war="${c.id}">${esc(c.name)}</button> <small>since ${esc(yearLabel(yearOf(c.since, s)))} · ${c.battles} battles</small></li>`).join('') || '<li>The world is at peace.</li>'}</ul>
      </section>
    </div>`);
}
// The web: the great powers on a circle; blue for alliances, red for wars, gold dashes for client states.
function web(s, list) {
  const n = list.length, R = 120, C = 150, at = (i) => [C + R * Math.cos((i / n) * 2 * Math.PI - Math.PI / 2), C + R * Math.sin((i / n) * 2 * Math.PI - Math.PI / 2)];
  const idx = Object.fromEntries(list.map((r, i) => [r.id, i])), edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = list[i].id, b = list[j].id;
    if (atWar(s, a, b)) edges.push([i, j, 'war']);
    else if (allied(s, a, b)) edges.push([i, j, 'ally']);
    else if (s.realms[a].overlord === b || s.realms[b].overlord === a) edges.push([i, j, 'client']);
  }
  for (const r of living(s)) if (r.overlord && idx[r.overlord] !== undefined && idx[r.id] === undefined) { /* small clients are left out */ }
  return `<svg class="web" viewBox="0 0 300 300" role="img" aria-label="Alliances, wars and client states among the great powers">
    ${edges.map(([i, j, k]) => { const [x1, y1] = at(i), [x2, y2] = at(j); return `<path d="M${x1} ${y1}Q${C} ${C} ${x2} ${y2}" class="e ${k}"/>`; }).join('')}
    ${list.map((r, i) => { const [x, y] = at(i); return `<g data-realm="${r.id}" class="n"><circle cx="${x}" cy="${y}" r="9" style="fill:${r.color}"/><text x="${x}" y="${y + (y > C ? 22 : -14)}">${esc(r.short)}</text></g>`; }).join('')}
  </svg><p class="legend"><span><i class="ally"></i>alliance</span><span><i class="war"></i>war</span><span><i class="client"></i>client state</span></p>`;
}

function dash(html) {
  const d = $('#dash');
  d.innerHTML = `<div class="panel"><button class="x" data-close aria-label="Close">×</button>${html}</div>`;
  if (!d.open) d.showModal();
}
document.addEventListener('click', (e) => {
  const d = $('#dash');
  if (e.target === d || e.target.closest('#dash [data-close]')) return d.close();
  const inside = e.target.closest('#dash, #council'), chipped = e.target.closest('[data-realm]');
  if (inside && chipped && S.s.realms[chipped.dataset.realm]) { e.stopImmediatePropagation(); return openDossier(chipped.dataset.realm); } // a realm named in a dashboard: its dossier
  if (e.target.closest('#dash [data-war], #dash [data-char]')) d.close(); // a war or a person: their card, on the map
  const b = e.target.closest('[data-dossier]');
  if (b) return openDossier(b.dataset.dossier);
  if (e.target.closest('#ledger-btn')) return openLedger();
});
