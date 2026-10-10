// The war room: every side of the war at a glance — who leads it, its men, gold, lands and will to fight, how they have
// moved season by season, its armies and their generals — and the people of the war, living and fallen.
import { newCampaign, resolve, armiesOf, menOf, owned, relOf, leaderOf, fmtMen, goalState, courtOf, isDead, conditionsOf } from './engine.js';

// Each side's strength at the start of every season, from the record.
export function history(C, seed, turns) {
  let s = newCampaign(C, seed);
  const snap = (st) => ({ t: st.turn, label: C.turns[Math.min(st.turn, C.turns.length - 1)].label, sides: Object.fromEntries(Object.keys(C.sides).map((id) => [id, { men: menOf(st, id), will: st.sides[id].will, gold: st.sides[id].gold, provs: owned(st, id).length, alive: st.sides[id].alive }])) });
  const out = [snap(s)];
  for (const inp of turns) { s = resolve(s, C, inp).state; out.push(snap(s)); }
  return out;
}
export const snapOf = (C, s) => ({ t: s.turn, sides: Object.fromEntries(Object.keys(C.sides).map((id) => [id, { men: menOf(s, id), will: s.sides[id].will, gold: s.sides[id].gold, provs: owned(s, id).length, alive: s.sides[id].alive }])) });

// A line chart in ink: one line per side.
function chart(C, snaps, key, { w = 560, h = 150, label = '', fmt = (v) => Math.round(v) } = {}) {
  if (snaps.length < 2) return '<p class="sub">The chart begins after the first season.</p>';
  const ids = Object.keys(C.sides).filter((id) => snaps.some((x) => x.sides[id]?.[key] > 0));
  const max = Math.max(1, ...snaps.flatMap((x) => ids.map((id) => x.sides[id]?.[key] ?? 0)));
  const L = 40, B = 18, X = (i) => L + (i / Math.max(1, snaps.length - 1)) * (w - L - 8), Y = (v) => h - B - (v / max) * (h - B - 8);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
    <path d="M${L} 6V${h - B}H${w - 6}" class="axis"/>
    ${[0.5, 1].map((f) => `<path d="M${L} ${Y(max * f)}H${w - 6}" class="grid"/><text x="${L - 4}" y="${Y(max * f) + 4}" class="yl">${fmt(max * f)}</text>`).join('')}
    ${ids.map((id) => `<path d="M${snaps.map((x, i) => `${X(i).toFixed(1)} ${Y(x.sides[id]?.[key] ?? 0).toFixed(1)}`).join('L')}" class="line" style="stroke:${C.sides[id].color}"/><circle cx="${X(snaps.length - 1)}" cy="${Y(snaps.at(-1).sides[id]?.[key] ?? 0)}" r="3.5" fill="${C.sides[id].color}"/>`).join('')}
  </svg><p class="legend">${ids.map((id) => `<span><i style="background:${C.sides[id].color}"></i>${C.sides[id].short ?? C.sides[id].name}</span>`).join('')}</p>`;
}
// A half-moon gauge for the will to fight.
const gauge = (v, color) => {
  const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100), x = 30 + 24 * Math.cos(a), y = 30 - 24 * Math.sin(a);
  return `<svg class="gauge" viewBox="0 0 60 36" aria-hidden="true"><path d="M6 30a24 24 0 0 1 48 0" fill="none" stroke="rgba(58,40,22,.15)" stroke-width="6" stroke-linecap="round"/><path d="M6 30A24 24 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/><text x="30" y="31" text-anchor="middle">${Math.round(v)}</text></svg>`;
};
const spark = (vals, color) => {
  if (vals.length < 2) return '';
  const max = Math.max(1, ...vals), X = (i) => (i / (vals.length - 1)) * 70, Y = (v) => 18 - (v / max) * 16;
  return `<svg class="spark" viewBox="0 0 72 20" aria-hidden="true"><path d="M${vals.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('L')}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
};

export function warRoom(C, s, snaps, { face, esc, label }) {
  const you = C.you, g = goalState(C, s), ids = Object.keys(C.sides).filter((id) => s.sides[id].alive || owned(s, id).length);
  const maxMen = Math.max(1, ...ids.map((id) => menOf(s, id)));
  const rel = (id) => (id === you ? ['you', 'Your side'] : relOf(s, you, id) === 'war' ? ['war', 'At war with you'] : relOf(s, you, id) === 'ally' ? ['ally', 'Your ally'] : ['peace', 'At peace']);
  const sides = ids.sort((a, b) => (a === you ? -1 : b === you ? 1 : 0) || (relOf(s, you, b) === 'war') - (relOf(s, you, a) === 'war') || menOf(s, b) - menOf(s, a)).map((id) => {
    const d = C.sides[id], st = s.sides[id], [rk, rt] = rel(id), lead = leaderOf(C, s, id), men = menOf(s, id);
    const armies = armiesOf(s, id).sort((a, b) => b.men - a.men);
    return `<article class="side ${rk}" style="--c:${d.color}" data-side="${id}">
      <header>${face({ name: lead, look: d.look ?? C.hero.look, title: 'leader' }, d.color, 52, `wr${id}`)}<div><h3>${esc(d.name)}</h3><small>led by ${esc(lead)}</small><span class="rel ${rk}">${rt}</span></div></header>
      <div class="kpis">
        <div><b>${fmtMen(men)}</b><span>men</span><i class="bar"><i style="width:${Math.round((men / maxMen) * 100)}%"></i></i>${spark(snaps.map((x) => x.sides[id]?.men ?? 0), d.color)}</div>
        <div><b>${Math.round(st.gold)}</b><span>gold</span>${spark(snaps.map((x) => x.sides[id]?.gold ?? 0), d.color)}</div>
        ${C.sides[id].fleet !== undefined || st.fleet ? `<div><b>${st.fleet ?? 0}</b><span>ships</span></div>` : ''}
        <div><b>${owned(s, id).length}</b><span>provinces</span>${spark(snaps.map((x) => x.sides[id]?.provs ?? 0), d.color)}</div>
        <div class="will">${gauge(st.will, st.will >= 50 ? '#4f7a3a' : st.will >= 25 ? '#b3852c' : '#a3361f')}<span>will to fight</span></div>
      </div>
      ${armies.length ? `<ul class="armies">${armies.slice(0, 6).map((a) => `<li><b>${esc(a.gen ?? 'An army')}</b><span>${fmtMen(a.men)}</span><small>${esc(C.prov[a.at].name)}${a.hero ? ' · the commander' : ''}</small></li>`).join('')}${armies.length > 6 ? `<li><small>and ${armies.length - 6} more</small></li>` : ''}</ul>` : '<p class="sub">No army in the field.</p>'}
      ${conditionsOf(s, id).map((c) => `<p class="cond ${c.kind === 'power' && c.k >= 1 ? 'good' : 'bad'}">${esc(c.why)}: ${c.kind === 'stay' ? 'will not march' : `${c.k >= 1 ? '+' : '−'}${Math.round(Math.abs(c.k - 1) * 100)}% ${c.kind === 'income' ? 'income' : c.army ? `for ${s.armies[c.army]?.gen ?? 'one army'}` : c.hero ? 'for the commander’s army' : 'in battle'}`}${c.until < 90 ? `, ${c.until - s.turn + 1} season${c.until - s.turn ? 's' : ''}` : ''}</p>`).join('')}
      ${d.persona ? `<p class="persona">${esc(d.persona)}</p>` : ''}
    </article>`;
  }).join('');
  const court = courtOf(C, s).filter((p) => !p.army);
  const leaders = ids.filter((id) => id !== you).map((id) => ({ name: leaderOf(C, s, id), title: `leader of ${C.sides[id].name}`, color: C.sides[id].color }));
  const generals = Object.values(s.armies).filter((a) => a.gen && !isDead(s, a.gen)).map((a) => ({ name: a.gen, title: `${fmtMen(a.men)} at ${C.prov[a.at].name}`, color: C.sides[a.side].color }));
  const seen = new Set(), living = [...court.map((p) => ({ name: p.name, title: p.title ?? 'your council', color: C.sides[you].color })), ...leaders, ...generals].filter((p) => !seen.has(p.name) && seen.add(p.name));
  return `<header class="wr-head"><div><h2>The war room</h2><p class="sub">${esc(label)} · ${esc(C.title)}</p></div></header>
    <div class="goalbar"><b>Your goal:</b> ${esc(C.goal.text)}<i class="bar big"><i style="width:${Math.round(g.progress * 100)}%"></i></i><small>${esc(g.text)}</small></div>
    <div class="sides">${sides}</div>
    <div class="charts"><section><h4>Soldiers, season by season</h4>${chart(C, snaps, 'men', { label: 'soldiers by season', fmt: fmtMen })}</section>
      <section><h4>Will to fight</h4>${chart(C, snaps, 'will', { label: 'will to fight by season' })}</section></div>
    <section class="people"><h4>The people of the war</h4>
      <ul class="living">${living.map((p) => `<li style="--c:${p.color}"><b>${esc(p.name)}</b><small>${esc(p.title)}</small></li>`).join('')}</ul>
      ${s.dead?.length ? `<h5>The fallen</h5><ul class="fallen">${s.dead.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </section>`;
}
