// The campaign's map: a closer look at the world map's parchment, with the campaign's own provinces over it, its
// cities and walls, the armies as banners, and, for the army you have chosen, where it can go and the odds there.
import { armiesAt, atWar, friends, oddsOf, reach, fmtMen } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
const GLYPH = {
  banner: 'M5 2h2v20H5zM7 3h12l-3 4 3 4H7z',
  swords: 'M4 4l11 11M20 4 9 15M7 13l4 4M17 13l-4 4M5 19l3-3M19 19l-3-3',
  crown: 'M3 18 4.5 7 9 11.5 12 4l3 7.5L19.5 7 21 18zM3 19.6h18v1.8H3z',
  tower: 'M7 21V9L5 7V3h3v2h2V3h4v2h2V3h3v4l-2 2v12z',
  flag: 'M5 2h2v20H5zM7 3h12l-3 4 3 4H7z',
};

export function makeMap(svg, data, C, handlers) {
  const layer = {}, W = 8192, H = 6245;
  let view = { x: data.view[0], y: data.view[1], w: data.view[2], h: data.view[3] };
  const home = { ...view };
  const P = Object.fromEntries(data.provinces.map((p) => [p.id, p]));
  svg.innerHTML = '';
  svg.append(el('defs'));
  svg.querySelector('defs').innerHTML = `<filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter>`;
  for (const name of ['base', 'tiles', 'provs', 'edges', 'coast', 'lanes', 'reach', 'sieges', 'cities', 'labels', 'arrows', 'fx', 'badges', 'armies']) svg.append((layer[name] = el('g', { class: `l-${name}` })));
  layer.base.append(el('image', { href: '/world/base.webp', x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' }));
  for (const p of data.provinces) layer.provs.append(el('path', { class: 'prov free', d: p.d, 'data-prov': p.id }));
  for (const [a, b, d] of data.edges) layer.edges.append(el('path', { class: 'edge inner', d, 'data-a': a, 'data-b': b }));
  layer.coast.append(el('path', { class: 'coast', d: data.coast }));
  for (const [a, b] of data.lanes) {
    const [x1, y1] = P[a].city, [x2, y2] = P[b].city, mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.12;
    layer.lanes.append(el('path', { class: 'lane', d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}` }));
  }
  const scale = () => view.w / svg.clientWidth; // map units per screen pixel
  const k = () => Math.max(0.55, Math.min(2.4, scale() * 1.15)); // how big the marks are drawn, so they read at any zoom

  // ---------- the parchment, sharper as you close in ----------
  const tileLayers = {}, shown = new Set();
  for (let lv = 1; lv < 4; lv++) layer.tiles.append((tileLayers[lv] = el('g')));
  let meta = null, tileTimer = 0;
  async function tiles() {
    meta ??= await fetch('/world/tiles/meta.json').then((r) => r.json()).catch(() => ({ tile: 512, levels: 4 }));
    const need = (svg.clientWidth / view.w) * (devicePixelRatio || 1) * 0.8;
    let level = 1;
    while (level < meta.levels - 1 && 2 ** (level - (meta.levels - 1)) < need) level++;
    const span = meta.tile * 2 ** (meta.levels - 1 - level);
    for (let ty = Math.floor(view.y / span); ty * span < view.y + view.h; ty++) {
      for (let tx = Math.floor(view.x / span); tx * span < view.x + view.w; tx++) {
        const key = `${level}/${tx}_${ty}`;
        if (shown.has(key) || tx < 0 || ty < 0 || tx * span >= W || ty * span >= H) continue;
        shown.add(key);
        tileLayers[level].append(el('image', { href: `/world/tiles/${key}.webp`, x: tx * span, y: ty * span, width: Math.min(span, W - tx * span), height: Math.min(span, H - ty * span), preserveAspectRatio: 'none' }));
      }
    }
  }

  // ---------- pan and zoom, kept around the theater ----------
  function setView(v) {
    const aspect = svg.clientWidth / Math.max(1, svg.clientHeight);
    v.w = Math.max(home.w / 7, Math.min(home.w * 1.6, v.w));
    v.h = v.w / aspect;
    const cx = home.x + home.w / 2, cy = home.y + home.h / 2, mx = home.w * 0.8, my = home.h * 0.8;
    v.x = Math.max(cx - mx - v.w / 2, Math.min(cx + mx - v.w / 2, v.x));
    v.y = Math.max(cy - my - v.h / 2, Math.min(cy + my - v.h / 2, v.y));
    view = v;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    clearTimeout(tileTimer);
    tileTimer = setTimeout(tiles, 120);
    restyle();
  }
  // The whole theater in sight, in the part of the screen the panels leave free.
  function fit() {
    const W0 = svg.clientWidth, H0 = Math.max(1, svg.clientHeight), phone = W0 < 760;
    const right = phone ? 0 : (handlers.inset?.() ?? 0), bottom = phone ? H0 * 0.4 : 0, top = phone ? 70 : 0;
    const freeW = W0 - right, freeH = H0 - bottom - top;
    const k = Math.max(home.w / freeW, home.h / freeH) * 1.04; // map units per pixel
    const w = W0 * k, h = H0 * k;
    setView({ x: home.x + home.w / 2 - (freeW / 2) * k, y: home.y + home.h / 2 - (top + freeH / 2) * k, w });
  }
  const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: view.x + ((cx - r.left) / r.width) * view.w, y: view.y + ((cy - r.top) / r.height) * view.h }; };
  function zoomAt(cx, cy, f) {
    const p = toMap(cx, cy), r = svg.getBoundingClientRect(), w = view.w / f, h = view.h / f;
    setView({ x: p.x - ((cx - r.left) / r.width) * w, y: p.y - ((cy - r.top) / r.height) * h, w });
  }
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  const pts = new Map();
  let start = null, moved = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { ...view, px: e.clientX, py: e.clientY, d: pts.size === 2 ? dist() : 0 };
    moved = false;
  });
  svg.addEventListener('pointermove', (e) => {
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
    if (Math.abs(dx) + Math.abs(dy) > 5) { moved = true; svg.classList.add('dragging'); try { svg.setPointerCapture(e.pointerId); } catch { /* fine */ } }
    if (moved) setView({ ...view, x: start.x - (dx / r.width) * start.w, y: start.y - (dy / r.height) * start.h, w: start.w });
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    svg.classList.remove('dragging');
    if (!pts.size && !moved && start) click(e);
    if (!pts.size) start = null;
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); start = null; });
  svg.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.7));
  addEventListener('resize', () => setView({ ...view }));
  function click(e) {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const army = t?.closest('[data-army]')?.dataset.army, badge = t?.closest('[data-go]')?.dataset.go, prov = t?.closest('[data-prov]')?.dataset.prov ?? t?.closest('[data-city]')?.dataset.city;
    if (badge) return handlers.target?.(badge, e);
    if (army) return handlers.army?.(army, e);
    if (prov) return handlers.province?.(prov, e);
    handlers.empty?.(e);
  }

  // ---------- the cities, drawn once ----------
  for (const p of Object.values(C.prov)) {
    const g = el('g', { class: `city${p.wealth >= 3 ? ' major' : ''}`, 'data-city': p.id });
    const [x, y] = P[p.id].city;
    g.append(el('circle', { cx: x, cy: y, r: p.wealth >= 3 ? 3.4 : 2.4 }));
    g.append(el('text', { x: x + 6, y: y + 4 }, p.name));
    layer.cities.append(g);
  }

  let last = { owner: null };
  // Everything that changes with the state: who holds what, the walls and sieges, the armies, the orders.
  function paint(s, { sel = null, orders = {}, you = C.you, show = {} } = {}) {
    const owner = Object.keys(s.prov).map((id) => s.prov[id].owner ?? '').join(',');
    if (owner !== last.owner) {
      last.owner = owner;
      layer.provs.querySelectorAll('.prov').forEach((path) => {
        const o = s.prov[path.dataset.prov]?.owner;
        path.classList.toggle('free', !o);
        path.setAttribute('fill', o ? C.sides[o].color : 'transparent');
        path.setAttribute('fill-opacity', o ? 0.46 : 0);
      });
      layer.edges.querySelectorAll('.edge').forEach((e) => {
        const a = s.prov[e.dataset.a]?.owner, b = s.prov[e.dataset.b]?.owner;
        e.setAttribute('class', `edge ${a === b ? 'inner' : 'border'}`);
      });
      labels(s);
    }
    // walls and crowns
    layer.cities.querySelectorAll('.city').forEach((g) => {
      const id = g.dataset.city, st = s.prov[id], p = C.prov[id];
      g.querySelectorAll('.wall, .crown').forEach((x) => x.remove());
      const [x, y] = P[id].city, size = 9 * k();
      if (p.capital && st.owner === p.capital) g.append(el('path', { class: 'crown', d: GLYPH.crown, transform: `translate(${x - size / 2} ${y - size * 1.45}) scale(${size / 24})` }));
      else if (st.walls) g.append(el('path', { class: 'wall', d: GLYPH.tower, transform: `translate(${x - size / 2} ${y - size * 1.35}) scale(${size / 24})`, opacity: 0.55 + 0.15 * st.walls }));
    });
    layer.sieges.innerHTML = '';
    for (const [id, st] of Object.entries(s.prov)) if (st.siege) {
      const [x, y] = P[id].city;
      layer.sieges.append(el('circle', { class: 'siege-ring', cx: x, cy: y, r: 14 * k() }));
    }
    // reach of the chosen army, with what waits there
    layer.reach.innerHTML = '';
    layer.badges.innerHTML = '';
    if (sel && s.armies[sel]) {
      const r = reach(C, s, sel);
      for (const id of Object.keys(r)) {
        layer.reach.append(el('path', { class: 'reach', d: P[id].d }));
        const o = oddsOf(C, s, sel, id), [x, y] = P[id].city;
        const text = o.kind === 'battle' ? `${o.ratio >= 1 ? o.ratio.toFixed(1) : `1:${(1 / o.ratio).toFixed(1)}`}` : o.kind === 'siege' ? `siege ${o.turns}` : s.prov[id].owner && atWar(s, s.armies[sel].side, s.prov[id].owner) ? 'take' : 'go';
        const mood = o.kind === 'battle' ? (o.ratio >= 1.2 ? 'good' : o.ratio >= 0.9 ? 'even' : 'bad') : o.kind === 'siege' ? (o.ratio >= 1.3 ? 'even' : 'bad') : 'good';
        const g = el('g', { class: `badge-map ${mood}`, 'data-go': id, transform: `translate(${x} ${y - 18 * k()}) scale(${k()})` });
        const w = 8 + text.length * 6.4;
        g.append(el('rect', { x: -w / 2, y: -9, width: w, height: 16, rx: 5 }), el('text', { y: 3 }, o.kind === 'battle' ? `⚔ ${text}` : text));
        layer.badges.append(g);
      }
    }
    // orders: the arrows of your armies
    layer.arrows.innerHTML = '';
    for (const [id, o] of Object.entries(orders)) {
      const a = s.armies[id];
      if (!a || !o?.to || o.to === a.at) continue;
      const [x1, y1] = P[a.at].city, [x2, y2] = P[o.to].city, mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.15;
      layer.arrows.append(el('path', { class: 'arrow', d: `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`, stroke: C.sides[a.side].color, 'stroke-width': 2.6 * k() }));
      const ang = Math.atan2(y2 - my, x2 - mx), h = 8 * k();
      layer.arrows.append(el('path', { d: `M${x2} ${y2}l${-h * Math.cos(ang - 0.45)} ${-h * Math.sin(ang - 0.45)}l${h * 0.25 * Math.cos(ang + 1.57)} ${h * 0.25 * Math.sin(ang + 1.57)}z`, fill: C.sides[a.side].color }));
    }
    armies(s, { sel, you, show });
  }
  function labels(s) {
    layer.labels.innerHTML = '';
    for (const side of Object.keys(C.sides)) {
      const mine = Object.keys(s.prov).filter((id) => s.prov[id].owner === side);
      if (mine.length < 3) continue;
      const area = mine.reduce((t, id) => t + (P[id].area || 1), 0);
      const x = mine.reduce((t, id) => t + P[id].label[0] * (P[id].area || 1), 0) / area, y = mine.reduce((t, id) => t + P[id].label[1] * (P[id].area || 1), 0) / area;
      const size = Math.max(16, Math.min(46, Math.sqrt(area) / 9));
      layer.labels.append(el('text', { class: 'label-side', x, y, 'font-size': size, fill: C.sides[side].color, opacity: 0.55 }, (C.sides[side].short ?? C.sides[side].name).toUpperCase()));
    }
  }
  // The armies: a banner in the side's colour with its strength; several in one place stand in a ring.
  const nodes = {};
  function armies(s, { sel, you }) {
    const at = {};
    for (const a of Object.values(s.armies)) (at[a.at] ??= []).push(a);
    const seen = new Set();
    for (const [pid, list] of Object.entries(at)) {
      list.sort((x, y) => (x.side === you) - (y.side === you) || y.men - x.men);
      list.forEach((a, i) => {
        seen.add(a.id);
        const [cx, cy] = P[pid].city, n = list.length, ang = (i / n) * Math.PI * 2 - Math.PI / 2, rr = n > 1 ? 15 * k() : 0;
        const x = cx + Math.cos(ang) * rr + 10 * k(), y = cy + Math.sin(ang) * rr - 4 * k();
        let g = nodes[a.id];
        if (!g) {
          g = nodes[a.id] = el('g', { class: 'army', 'data-army': a.id });
          const [fx, fy] = P[a.from ?? a.at]?.city ?? [x, y];
          g.setAttribute('transform', `translate(${fx + 10 * k()} ${fy - 4 * k()})`);
          layer.armies.append(g);
        }
        g.innerHTML = '';
        const z = k(), col = C.sides[a.side].color;
        g.classList.toggle('mine', a.side === you);
        g.classList.toggle('sel', a.id === sel);
        g.append(el('circle', { class: 'halo', cx: 0, cy: -9 * z, r: 13 * z, fill: 'transparent' }));
        g.append(el('path', { class: 'pole', d: `M0 ${4 * z}V${-22 * z}` }));
        g.append(el('path', { class: 'cloth', d: `M0 ${-22 * z}h${15 * z}l${-3.5 * z} ${5 * z}l${3.5 * z} ${5 * z}H0z`, fill: col }));
        if (a.hero) g.append(el('circle', { class: 'ring', cx: 7 * z, cy: -17 * z, r: 2.6 * z }));
        g.append(el('text', { x: 0, y: 15 * z, 'font-size': 11 * z }, fmtMen(a.men)));
        requestAnimationFrame(() => g.setAttribute('transform', `translate(${x} ${y})`));
      });
    }
    for (const [id, g] of Object.entries(nodes)) if (!seen.has(id)) { g.style.opacity = 0; setTimeout(() => g.remove(), 600); delete nodes[id]; }
  }
  function restyle() {
    if (handlers.restyle) handlers.restyle();
  }
  // A clash of swords where a battle was fought this turn.
  function clash(events) {
    layer.fx.innerHTML = '';
    for (const e of events) {
      if (!e.at || !P[e.at] || !['battle', 'storm', 'refused', 'repulsed'].includes(e.type)) continue;
      const [x, y] = P[e.at].city, z = k() * 1.5;
      const g = el('g', { transform: `translate(${x} ${y})` }), inner = el('g', { class: 'clash' });
      inner.append(el('circle', { r: 13 * z, fill: e.type === 'battle' ? 'rgba(163,54,31,0.85)' : 'rgba(58,40,22,0.75)' }), el('path', { d: GLYPH.swords, transform: `translate(${-9 * z} ${-9 * z}) scale(${(18 * z) / 24})`, stroke: '#fbf3dd', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }));
      g.append(inner);
      layer.fx.append(g);
    }
  }
  function focus(pid) {
    const [x, y] = P[pid].city, w = Math.min(view.w, home.w / 2.2);
    setView({ x: x - w / 2, y: y - (w * (svg.clientHeight / svg.clientWidth)) / 2, w });
  }
  fit();
  return { paint, clash, fit, focus, zoomAt: (f) => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }, P, screenOf: (pid) => { const [x, y] = P[pid].city, r = svg.getBoundingClientRect(); return { x: r.left + ((x - view.x) / view.w) * r.width, y: r.top + ((y - view.y) / view.h) * r.height }; } };
}
