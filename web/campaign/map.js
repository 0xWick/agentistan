// The campaign's map, drawn crisp at any zoom: the theater's land and coasts, rivers and provinces as vectors, and
// on top of them, in the page itself, the cities, the ground and the armies, which keep their size on screen
// however far you zoom in or out.
import { reach, oddsOf, atWar, fmtMen } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
const div = (cls, html = '') => Object.assign(document.createElement('div'), { className: cls, innerHTML: html });
const GLYPH = {
  crown: '<svg viewBox="0 0 24 24"><path d="M3 18 4.5 7 9 11.5 12 4l3 7.5L19.5 7 21 18zM3 19.6h18v1.8H3z" fill="#c9a03c" stroke="#3a2816" stroke-width="1"/></svg>',
  tower: '<svg viewBox="0 0 24 24"><path d="M7 21V9L5 7V3h3v2h2V3h4v2h2V3h3v4l-2 2v12z" fill="#3a2816"/></svg>',
  mountains: '<svg viewBox="0 0 24 14"><path d="M1 13 7 4l3 4 3-6 6 11" fill="none" stroke="#6a5032" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  hills: '<svg viewBox="0 0 24 12"><path d="M1 11c3-6 7-6 10 0M10 11c3-5 7-5 11 0" fill="none" stroke="#7a6040" stroke-width="1.5"/></svg>',
  forest: '<svg viewBox="0 0 24 14"><path d="M6 13V9M4 9l2-7 2 7zM14 13V9M12 9l2-7 2 7z" fill="#4f6b3a" stroke="#3d5530" stroke-width=".8"/></svg>',
  desert: '<svg viewBox="0 0 24 10"><path d="M1 8c4-4 7-4 11 0s7 4 11 0" fill="none" stroke="#b08a4a" stroke-width="1.4"/></svg>',
  marsh: '<svg viewBox="0 0 24 10"><path d="M2 8h20M5 5h14M8 2v6M16 2v6" stroke="#5d7f86" stroke-width="1.3"/></svg>',
  swords: '<svg viewBox="0 0 24 24"><path d="M4 4l11 11M20 4 9 15M7 13l4 4M17 13l-4 4M5 19l3-3M19 19l-3-3" fill="none" stroke="#fbf3dd" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

export function makeMap(svg, data, C, handlers) {
  const host = svg.parentElement;
  let view = { x: data.view[0], y: data.view[1], w: data.view[2], h: data.view[3] };
  const home = { ...view };
  const P = Object.fromEntries(data.provinces.map((p) => [p.id, p]));
  const layer = {};
  svg.innerHTML = '';
  svg.append(el('defs'));
  svg.querySelector('defs').innerHTML = `<pattern id="waves" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 12q10-6 20 0t20 0" fill="none" stroke="#7d9692" stroke-width="0.8" opacity="0.45"/></pattern>
    <pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="0.7" fill="#b89a63" opacity="0.35"/><circle cx="7" cy="7" r="0.5" fill="#8c6b3f" opacity="0.25"/></pattern>`;
  for (const name of ['sea', 'land', 'provs', 'edges', 'rivers', 'coast', 'lanes', 'reach', 'arrows']) svg.append((layer[name] = el('g', { class: `l-${name}` })));
  const big = 1e5;
  layer.sea.append(el('rect', { x: -big, y: -big, width: 2 * big, height: 2 * big, fill: '#a9bab4' }), el('rect', { x: -big, y: -big, width: 2 * big, height: 2 * big, fill: 'url(#waves)' }));
  layer.land.append(el('path', { d: data.coast, fill: '#e8d8ad' }), el('path', { d: data.coast, fill: 'url(#grain)' }));
  for (const p of data.provinces) layer.provs.append(el('path', { class: 'prov', d: p.d, 'data-prov': p.id, fill: 'transparent' }));
  for (const [a, b, d] of data.edges) layer.edges.append(el('path', { class: 'edge inner', d, 'data-a': a, 'data-b': b, 'vector-effect': 'non-scaling-stroke' }));
  for (const r of data.rivers ?? []) layer.rivers.append(el('path', { class: 'river', d: r.d, 'vector-effect': 'non-scaling-stroke', 'stroke-width': Math.max(0.8, 2.6 - r.rank * 0.25) }));
  layer.coast.append(el('path', { class: 'coast', d: data.coast, 'vector-effect': 'non-scaling-stroke' }));
  for (const [a, b] of data.lanes) {
    const [x1, y1] = P[a].city, [x2, y2] = P[b].city, mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.12;
    layer.lanes.append(el('path', { class: 'lane', d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, 'vector-effect': 'non-scaling-stroke' }));
  }

  // ---------- the marks, in the page, positioned from the map ----------
  const marks = div('marks');
  host.querySelector('.marks')?.remove();
  host.insertBefore(marks, svg.nextSibling);
  const cities = {}, ground = [], tokens = {}, badges = [], bursts = [];
  for (const p of Object.values(C.prov)) {
    const m = div(`city${p.wealth >= 3 ? ' major' : ''}`, `<i class="dot"></i><span class="nm">${p.name}</span><span class="ic"></span>`);
    m.dataset.city = p.id;
    marks.append(m);
    cities[p.id] = m;
    const g = GLYPH[p.terrain];
    if (g && P[p.id]) {
      const t = div(`terrain t-${p.terrain}`, g);
      marks.append(t);
      ground.push([t, P[p.id].label[0], P[p.id].label[1] + Math.sqrt(P[p.id].area || 1) * 0.18]);
    }
  }
  const toScreen = (x, y) => [((x - view.x) / view.w) * svg.clientWidth, ((y - view.y) / view.h) * svg.clientHeight];
  let frame = 0;
  function place() {
    frame = 0;
    const px = svg.clientWidth / view.w; // screen pixels per map unit
    marks.dataset.zoom = px < 0.35 ? 0 : px < 0.8 ? 1 : 2;
    for (const [id, m] of Object.entries(cities)) { const [x, y] = toScreen(...P[id].city); m.style.transform = `translate(${x}px, ${y}px)`; }
    for (const [t, mx, my] of ground) { const [x, y] = toScreen(mx, my); t.style.transform = `translate(${x}px, ${y}px)`; }
    for (const [id, tk] of Object.entries(tokens)) { const [x, y] = toScreen(tk._x, tk._y); tk.style.transform = `translate(${x}px, ${y}px)`; }
    for (const [b, mx, my] of badges) { const [x, y] = toScreen(mx, my); b.style.transform = `translate(${x}px, ${y}px)`; }
    for (const [b, mx, my] of bursts) { const [x, y] = toScreen(mx, my); b.style.transform = `translate(${x}px, ${y}px)`; }
  }
  const later = () => { if (!frame) frame = requestAnimationFrame(place); };

  // ---------- pan and zoom ----------
  function setView(v) {
    const aspect = svg.clientWidth / Math.max(1, svg.clientHeight);
    v.w = Math.max(home.w / 8, Math.min(home.w * 1.6, v.w));
    v.h = v.w / aspect;
    const cx = home.x + home.w / 2, cy = home.y + home.h / 2, mx = home.w * 0.8, my = home.h * 0.8;
    v.x = Math.max(cx - mx - v.w / 2, Math.min(cx + mx - v.w / 2, v.x));
    v.y = Math.max(cy - my - v.h / 2, Math.min(cy + my - v.h / 2, v.y));
    view = v;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    later();
  }
  function fit() {
    const W0 = svg.clientWidth, H0 = Math.max(1, svg.clientHeight), phone = W0 < 760;
    const right = phone ? 0 : handlers.inset?.() ?? 0, bottom = phone ? H0 * 0.45 : 0, top = phone ? 64 : 70;
    const freeW = W0 - right - 20, freeH = H0 - bottom - top;
    const k = Math.max(home.w / freeW, home.h / freeH) * 1.02;
    setView({ x: home.x + home.w / 2 - (10 + freeW / 2) * k, y: home.y + home.h / 2 - (top + freeH / 2) * k, w: W0 * k });
  }
  const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: view.x + ((cx - r.left) / r.width) * view.w, y: view.y + ((cy - r.top) / r.height) * view.h }; };
  function zoomAt(cx, cy, f) {
    const p = toMap(cx, cy), r = svg.getBoundingClientRect(), w = view.w / f, h = view.h / f;
    setView({ x: p.x - ((cx - r.left) / r.width) * w, y: p.y - ((cy - r.top) / r.height) * h, w });
  }
  host.addEventListener('wheel', (e) => { if (!e.target.closest('#map, .marks')) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0018)); }, { passive: false });
  const pts = new Map();
  let start = null, moved = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const onMap = (e) => e.target === svg || e.target.closest('#map') || (e.target.closest('.marks') && !e.target.closest('.tk, .badge, .city'));
  host.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#map, .marks')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { ...view, px: e.clientX, py: e.clientY, d: pts.size === 2 ? dist() : 0 };
    moved = false;
  });
  host.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (pts.size === 2 && start.d) {
      const [a, b] = [...pts.values()], f = dist() / start.d, w = start.w / f;
      setView({ x: start.x + (start.w - w) * (((a.x + b.x) / 2 - r.left) / r.width), y: start.y + (start.h - w * (start.h / start.w)) * (((a.y + b.y) / 2 - r.top) / r.height), w });
      moved = true;
      return;
    }
    const dx = e.clientX - start.px, dy = e.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 5) { moved = true; host.classList.add('dragging'); }
    if (moved) setView({ ...view, x: start.x - (dx / r.width) * start.w, y: start.y - (dy / r.height) * start.h, w: start.w });
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    host.classList.remove('dragging');
    if (!pts.size && !moved && start) click(e);
    if (!pts.size) start = null;
  };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); start = null; });
  svg.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.7));
  addEventListener('resize', () => setView({ ...view }));
  function click(e) {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const army = t?.closest('[data-army]')?.dataset.army, go = t?.closest('[data-go]')?.dataset.go;
    const prov = t?.closest('[data-city]')?.dataset.city ?? t?.closest('[data-prov]')?.dataset.prov;
    if (go) return handlers.target?.(go, e);
    if (army) return handlers.army?.(army, e);
    if (prov) return handlers.province?.(prov, e);
    handlers.empty?.(e);
  }

  let last = { owner: null };
  // Everything that changes with the state: who holds what, walls and sieges, the armies, the orders.
  function paint(s, { sel = null, orders = {}, you = C.you } = {}) {
    const owner = Object.keys(s.prov).map((id) => s.prov[id].owner ?? '').join(',');
    if (owner !== last.owner) {
      last.owner = owner;
      layer.provs.querySelectorAll('.prov').forEach((path) => {
        const o = s.prov[path.dataset.prov]?.owner;
        path.setAttribute('fill', o ? C.sides[o].color : 'transparent');
        path.setAttribute('fill-opacity', o ? 0.34 : 0);
      });
      layer.edges.querySelectorAll('.edge').forEach((e) => {
        const a = s.prov[e.dataset.a]?.owner, b = s.prov[e.dataset.b]?.owner;
        e.setAttribute('class', `edge ${a === b ? 'inner' : 'border'}`);
      });
    }
    for (const [id, m] of Object.entries(cities)) {
      const st = s.prov[id], p = C.prov[id];
      m.querySelector('.ic').innerHTML = p.capital && st.owner === p.capital ? GLYPH.crown : st.walls ? GLYPH.tower : '';
      m.classList.toggle('walled', !!st.walls);
      m.classList.toggle('besieged', !!st.siege);
      m.style.setProperty('--c', st.owner ? C.sides[st.owner].color : '#6a5032');
    }
    // reach of the chosen army, with what waits there
    layer.reach.innerHTML = '';
    for (const [b] of badges) b.remove();
    badges.length = 0;
    if (sel && s.armies[sel]) {
      for (const id of Object.keys(reach(C, s, sel))) {
        layer.reach.append(el('path', { class: 'reach', d: P[id].d, 'vector-effect': 'non-scaling-stroke' }));
        const o = oddsOf(C, s, sel, id);
        const text = o.kind === 'battle' ? `⚔ ${o.ratio >= 1 ? `${o.ratio.toFixed(1)}:1` : `1:${(1 / o.ratio).toFixed(1)}`}` : o.kind === 'siege' ? (o.fed ? 'fed by sea' : `siege ${o.turns}`) : s.prov[id].owner && atWar(s, s.armies[sel].side, s.prov[id].owner) ? 'take' : 'go';
        const mood = o.kind === 'battle' ? (o.ratio >= 1.2 ? 'good' : o.ratio >= 0.9 ? 'even' : 'bad') : o.kind === 'siege' ? (o.ratio >= 1.3 ? 'even' : 'bad') : 'good';
        const b = div(`badge ${mood}`, text);
        b.dataset.go = id;
        marks.append(b);
        badges.push([b, P[id].city[0], P[id].city[1]]);
      }
    }
    // the orders, as arrows
    layer.arrows.innerHTML = '';
    for (const [id, o] of Object.entries(orders)) {
      const a = s.armies[id];
      if (!a || !o?.to || o.to === a.at) continue;
      const [x1, y1] = P[a.at].city, [x2, y2] = P[o.to].city, mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.15;
      layer.arrows.append(el('path', { class: 'arrow', d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, stroke: C.sides[a.side].color, 'vector-effect': 'non-scaling-stroke' }));
      const ang = Math.atan2(y2 - my, x2 - mx), h = 9 * (view.w / svg.clientWidth);
      layer.arrows.append(el('path', { d: `M${x2} ${y2}l${-h * Math.cos(ang - 0.45)} ${-h * Math.sin(ang - 0.45)}l${h * 0.4 * Math.cos(ang + 1.57)} ${h * 0.4 * Math.sin(ang + 1.57)}z`, fill: C.sides[a.side].color }));
    }
    armies(s, { sel, you });
    place();
  }
  // The armies: a token in the side's colour with its strength; several in one place stand side by side.
  function armies(s, { sel, you }) {
    const at = {};
    for (const a of Object.values(s.armies)) (at[a.at] ??= []).push(a);
    const seen = new Set();
    for (const [pid, list] of Object.entries(at)) {
      if (!P[pid]) continue;
      list.sort((x, y) => (y.side === you) - (x.side === you) || y.men - x.men);
      list.forEach((a, i) => {
        seen.add(a.id);
        let tk = tokens[a.id];
        if (!tk) {
          tk = tokens[a.id] = div('tk', '<span class="flag"></span><b></b><small></small>');
          tk.dataset.army = a.id;
          const [fx, fy] = P[a.from ?? a.at]?.city ?? P[pid].city;
          tk._x = fx; tk._y = fy;
          marks.append(tk);
          const [sx, sy] = toScreen(fx, fy);
          tk.style.transform = `translate(${sx}px, ${sy}px)`;
          tk.getBoundingClientRect(); // so the march from there is animated
        }
        const [nx, ny] = P[pid].city;
        if (tk._x !== nx || tk._y !== ny) { tk.classList.add('moving'); clearTimeout(tk._t); tk._t = setTimeout(() => tk.classList.remove('moving'), 1200); }
        tk._x = nx;
        tk._y = ny;
        tk.style.setProperty('--c', C.sides[a.side].color);
        tk.style.setProperty('--i', i - (list.length - 1) / 2);
        tk.classList.toggle('mine', a.side === you);
        tk.classList.toggle('sel', a.id === sel);
        tk.classList.toggle('hero', !!a.hero);
        tk.querySelector('b').textContent = fmtMen(a.men);
        tk.querySelector('small').textContent = a.gen ? a.gen.split(' ').slice(-1)[0] : '';
        tk.title = `${a.gen ?? 'An army'} · ${fmtMen(a.men)} · ${C.sides[a.side].name}`;
      });
    }
    for (const [id, tk] of Object.entries(tokens)) if (!seen.has(id)) { tk.classList.add('gone'); setTimeout(() => tk.remove(), 500); delete tokens[id]; }
  }
  // A clash of swords where a battle was fought this season.
  function clash(events) {
    for (const [b] of bursts) b.remove();
    bursts.length = 0;
    for (const e of events) {
      if (!e.at || !P[e.at] || !['battle', 'storm', 'refused', 'repulsed'].includes(e.type)) continue;
      const b = div(`burst${e.type === 'battle' ? '' : ' minor'}`, GLYPH.swords);
      marks.append(b);
      bursts.push([b, P[e.at].city[0], P[e.at].city[1]]);
    }
    place();
  }
  function focus(pid) {
    const [x, y] = P[pid].city, w = Math.min(view.w, home.w / 2.2);
    setView({ x: x - w / 2, y: y - (w * (svg.clientHeight / svg.clientWidth)) / 2, w });
  }
  fit();
  return { paint, clash, fit, focus, zoomAt: (f) => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }, P };
}
