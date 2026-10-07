// The living map: the Silk Road world, simulated month by month right here in the browser, drawn like an old map.
import { newAge, tick, PROVINCES, PROV, living, provincesOf, armiesOf, dateText, yearOf, atWar, friendly } from './engine.js';
import { brain } from './doctrine.js';
import { RULES } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- ink glyphs: every icon on the page, drawn once ----------
const ICON = {
  castle: { f: 'M3 21V10h2V7h3v3h2V7h4v3h2V7h3v3h2v11h-7v-5a2 2 0 0 0-4 0v5z' },
  crown: { f: 'M3 18 4.5 7 9 11.5 12 4l3 7.5L19.5 7 21 18zM3 19.6h18v1.8H3z' },
  swords: { s: 'M4 4l11 11M20 4 9 15M7 13l4 4M17 13l-4 4M5 19l3-3M19 19l-3-3' },
  dagger: { s: 'M12 2l1.6 3v9h-3.2V5zM8.5 14h7M12 14v5M10.8 21h2.4' },
  flame: { f: 'M12 2c.8 3.5 5.5 5.6 5.5 11.2a5.5 5.5 0 0 1-11 0c0-2.6 1.5-4.4 2.6-5.8.2 2.4 1.5 3.6 2.6 3.8-.4-2.9-.6-6 .3-9.2z' },
  skull: { f: 'M12 2a8 8 0 0 0-8 8c0 2.8 1.4 4.5 3 5.6V19h2v2h2v-2h2v2h2v-2h2v-3.4c1.6-1.1 3-2.8 3-5.6a8 8 0 0 0-8-8zm-3 7.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', even: true },
  bow: { s: 'M6 3c7 3.5 7 14.5 0 18M6 3v18M3 12h17M17 9l3 3-3 3' },
  wheat: { s: 'M12 22V8m0 0c-3-1-4-4-4-6 3 0 4 3 4 6m0 0c3-1 4-4 4-6-3 0-4 3-4 6m0 5c-3-1-4-3-4-5 3 0 4 2 4 5m0 0c3-1 4-3 4-5-3 0-4 2-4 5' },
  tower: { f: 'M7 21V9L5 7V3h3v2h2V3h4v2h2V3h3v4l-2 2v12z' },
  banner: { f: 'M5 2h2v20H5zM7 3h12l-3 4 3 4H7z' },
  coin: { s: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 6.5v11M9.2 9.3c0-1 1.2-1.7 2.8-1.7s2.8.7 2.8 1.7-1.2 1.4-2.8 1.7-2.8.8-2.8 1.9 1.2 1.7 2.8 1.7 2.8-.8 2.8-1.7' },
  people: { s: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12.5 15.5A6 6 0 0 1 22 20' },
  eye: { s: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  scroll: { s: 'M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7M6 3a2 2 0 0 0-2 2v2h4M6 3a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3M11 8h5M11 12h5' },
  rings: { s: 'M4 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M10 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0' },
  quake: { s: 'M2 12h4l2-5 3 10 3-12 2 7h6' },
  star: { f: 'M12 2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.3l-5.8 3.5 1.6-6.6-5.2-4.4 6.8-.5z' },
  play: { f: 'M7 4l13 8-13 8z' },
  prev: { s: 'M15 4.5 7.5 12l7.5 7.5', w: 2.8 },
  next: { s: 'M9 4.5 16.5 12 9 19.5', w: 2.8 },
  pause: { f: 'M6 4h4v16H6zM14 4h4v16h-4z' },
  dice: { s: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01', w: 2.6 },
  key: { s: 'M15 4a5 5 0 1 1-4.3 7.6L4 18.3V21h3v-2h2v-2h2l1.6-1.6A5 5 0 0 1 15 4zM16 8h.01', w: 2 },
  plus: { s: 'M12 5v14M5 12h14', w: 2.4 },
  minus: { s: 'M5 12h14', w: 2.4 },
  hill: { s: 'M2 19l6-9 4 5 3-4 7 8z' },
  palace: { f: 'M12 1.5c1.6 1.9 3.6 2.9 3.6 5.4V9H8.4V6.9C8.4 4.4 10.4 3.4 12 1.5zM2.5 10h3.2v2h2v-2h8.6v2h2v-2h3.2v11.5h-7.2V17a2.3 2.3 0 0 0-4.6 0v4.5H2.5z' },
  citadel: { f: 'M1.5 22l3.2-6.5h14.6l3.2 6.5zM7 15V7.5H5V3.5h3v2h2v-2h4v2h2v-2h3v4h-2V15h-3.6v-3.2a1.4 1.4 0 0 0-2.8 0V15z' },
  helmet: { f: 'M12 1.8l1.7 3.4c3.6 1.2 5.3 4.4 5.3 7.8V16H5v-3c0-3.4 1.7-6.6 5.3-7.8zM7.5 17h9v4.5h-3v-2.8h-3v2.8h-3z' },
  circlet: { f: 'M3.5 17l1.6-7.5 3.7 3.6L12 7.6l3.2 5.5 3.7-3.6 1.6 7.5zM3.5 18.6h17v2.2h-17z' },
};
const icon = (name, cls = '') => {
  const i = ICON[name];
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${i.f ? `<path d="${i.f}" fill="currentColor"${i.even ? ' fill-rule="evenodd"' : ''}/>` : `<path d="${i.s}" fill="none" stroke="currentColor" stroke-width="${i.w ?? 1.8}" stroke-linecap="round" stroke-linejoin="round"/>`}</svg>`;
};

// What each event looks like, and whether it earns a place in the feed (the rest only flash on the map).
const KIND = {
  battle: ['swords', '#a3361f', 1], storm: ['swords', '#a3361f', 0], capture: ['castle', '#27466e', 1], siege: ['tower', '#8c6b3f', 0],
  revolt: ['flame', '#c2541f', 1], founded: ['crown', '#b3852c', 1], split: ['crown', '#a3361f', 1], fallen: ['skull', '#3a2816', 1],
  death: ['skull', '#5a4630', 1], crowned: ['crown', '#b3852c', 1], plot: ['dagger', '#5a4630', 1], coup: ['dagger', '#a3361f', 1],
  horde: ['bow', '#a3361f', 1], raid: ['bow', '#8c6b3f', 1], plague: ['skull', '#4f6b3a', 1], famine: ['wheat', '#9a7a2a', 1],
  earthquake: ['quake', '#6a5032', 1], power: ['star', '#b3852c', 1], war: ['swords', '#a3361f', 1], peace: ['scroll', '#2b7d7a', 1],
  alliance: ['rings', '#27466e', 1], vassal: ['scroll', '#6a5032', 1], broke: ['coin', '#8c6b3f', 0], guild: ['dagger', '#3a2816', 1],
  'army.raised': ['banner', '#27466e', 0], 'army.destroyed': ['skull', '#a3361f', 1], capital: ['crown', '#6a5032', 0], heir: ['crown', '#b3852c', 0],
  'age.started': ['scroll', '#27466e', 1], 'age.ended': ['crown', '#b3852c', 1],
};
const kindOf = (e) => (e.type === 'death' && e.cause === 'assassin' ? ['dagger', '#a3361f', 1] : KIND[e.type] ?? ['scroll', '#6a5032', 0]);

// Regions, seas and the lands beyond this world, in English and in a script of their time.
const REGIONS = [
  ['Iraq', 'عراق', 31.6, 45.4], ['Jibal', 'جبال', 34.0, 49.6], ['Azerbaijan', 'آذربایجان', 37.4, 47.6], ['Georgia', 'გეორგია', 42.5, 43.5],
  ['Fars', 'فارس', 28.7, 53.4], ['Khorasan', 'خراسان', 35.2, 59.7], ['Khwarazm', 'خوارزم', 41.0, 60.0], ['Transoxiana', 'ماوراءالنهر', 41.6, 66.4],
  ['Kipchak Steppe', 'دشت قپچاق', 46.0, 64.0], ['Seven Rivers', 'هفت‌رود', 44.4, 79.0], ['Ghor', 'غور', 33.2, 65.2], ['Punjab', 'پنجاب', 31.0, 73.3],
  ['Sindh', 'سند', 26.0, 68.6], ['Hindustan', 'هندوستان', 26.9, 81.2], ['Bengal', 'بنگاله', 24.0, 87.6], ['Anatolia', 'روم', 38.9, 33.5],
  ['Syria', 'الشام', 34.5, 37.6], ['Egypt', 'مصر', 27.5, 30.5], ['Maghreb', 'المغرب', 33.0, -2.0], ['Ifriqiya', 'إفريقية', 34.6, 9.0],
  ['Hellas', 'Ἑλλάς', 39.3, 22.0], ['Italia', 'Italia', 42.5, 13.0], ['Balkans', 'Балкан', 43.6, 22.5], ['Mongolia', 'مغولستان', 46.3, 103.0],
  ['Manchuria', '東北', 45.0, 125.0], ['China', '中國', 30.5, 112.0], ['Gobi', 'گوبی', 43.0, 106.0], ['Tarim', 'تاریم', 39.6, 84.5],
];
const SEAS = [['Caspian Sea', 'دریای خزر', 41.6, 50.9], ['Sea of Khwarazm', 'بحر خوارزم', 45.4, 60.6], ['Sea of Fars', 'دریای پارس', 27.0, 51.6], ['Sea of Hind', 'بحر هند', 15.0, 64.0],
  ['Mare Nostrum', 'بحر الروم', 34.6, 18.5], ['Black Sea', 'Πόντος', 43.2, 34.5], ['Red Sea', 'بحر القلزم', 20.5, 38.6], ['Eastern Sea', '東海', 29.0, 125.0], ['Atlantic', 'Oceanus', 33.0, -16.0]];
const DISTANT = [['Frankish kingdoms', 47.5, 2.0], ['Iberia', 40.0, -4.0], ['Holy Roman Empire', 50.5, 10.0], ['Rus’ principalities', 54.5, 34.0], ['Volga Bulgaria', 55.0, 50.0],
  ['Sahara', 23.0, 5.0], ['Lands of the Blacks', 13.0, 0.0], ['Ethiopia', 11.5, 38.5], ['Arabia', 23.0, 45.0], ['Tibet', 32.0, 87.0], ['Siberia', 62.0, 95.0],
  ['Deccan', 17.0, 77.5], ['Goryeo', 37.5, 127.5], ['Japan', 36.5, 137.5], ['Khmer & Dai Viet', 15.0, 104.0], ['Swahili Coast', -4.0, 39.5]];
// The Silk Road, Constantinople to Chang'an, and its branches south to Baghdad and India.
const ROADS = [
  ['constantinople', 'nicaea', 'ankara', 'sivas', 'erzurum', 'tabriz', 'qazvin', 'rey', 'kumis', 'nishapur', 'sarakhs', 'merv', 'bukhara', 'samarkand', 'ushrusana', 'ferghana', 'kashgar', 'khotan', 'shazhou', 'ganzhou', 'liangzhou', 'jingzhao'],
  ['aleppo', 'edessa', 'mosul', 'baghdad', 'hamadan', 'rey'],
  ['merv', 'balkh', 'bamiyan', 'kabul', 'peshawar', 'lahore', 'delhi'],
  ['shazhou', 'hami', 'qocho', 'almaliq', 'balasagun', 'talas', 'shash', 'samarkand'],
];
// Equal Earth, the projection the map is drawn in (mirrors tools/map/build.py).
let xyOf = () => [0, 0];
function projector({ lon0, x0, y1, scale }) {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, rad = Math.PI / 180;
  return (lat, lon) => {
    const lam = (lon - lon0) * rad, th = Math.asin(M * Math.sin(lat * rad)), t2 = th * th, t6 = t2 ** 3;
    const x = (lam * Math.cos(th)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    return [(x - x0) * scale, (y1 - th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))) * scale];
  };
}

// ---------- state ----------
let geo, s, age, timer = 0, playing = false, speed = 1, last = {};
let W = 8192, H = 6245;
// History, so the timeline can go back and forth: the world is a pure function of (age, month), so a snapshot each
// year plus the months' events is enough to rebuild any month in a few milliseconds.
const story = { keys: {}, events: [], frontier: 0 };
const SPEED = { 1: 2600, 4: 800, 16: 200 }; // ms per month
const HOLD = { 1: 2200, 4: 1000, 16: 0 }; // extra pause after a great event, so it can be read
const GREAT = (e) => ['founded', 'fallen', 'split', 'coup', 'horde', 'age.ended'].includes(e.type) || (e.type === 'capture' && e.capital) || (e.type === 'death' && e.ruler);
const shown = []; // the feed

// ---------- the map, drawn once ----------
const map = $('#map');
const layer = {};
async function boot() {
  // The icons first, so the buttons and the welcome card show them before the map has loaded.
  const defs = el('defs');
  defs.innerHTML = Object.entries(ICON).map(([k, i]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${i.f ? `<path d="${i.f}" fill="currentColor"${i.even ? ' fill-rule="evenodd"' : ''}/>` : `<path d="${i.s}" fill="none" stroke="currentColor" stroke-width="${i.w ?? 1.9}" stroke-linecap="round" stroke-linejoin="round"/>`}</symbol>`).join('');
  map.append(defs);
  geo = await fetch('/world/geo.json').then((r) => r.json());
  ({ width: W, height: H } = geo);
  xyOf = projector(geo.proj);
  map.setAttribute('viewBox', `0 0 ${W} ${H}`);
  for (const name of ['base', 'tiles', 'rivers', 'provs', 'edges', 'road', 'regions', 'realms', 'cities', 'seats', 'marks', 'sieges', 'arrows', 'armies', 'pulses']) map.append((layer[name] = el('g', { class: `l-${name}` })));
  // The parchment: a small picture of the whole world at once, then sharper tiles as the view closes in.
  layer.base.append(el('image', { href: '/world/base.webp', width: W, height: H, preserveAspectRatio: 'none' }));
  for (let lv = 1; lv < 4; lv++) layer.tiles.append((tileLayers[lv] = el('g')));
  for (const r of geo.rivers) layer.rivers.append(el('path', { class: 'river', d: r.d, 'stroke-width': Math.max(1, 4.2 - r.rank * 0.45) }));
  geo.provinces.forEach((p) => {
    const path = el('path', { class: 'prov', d: p.d, 'data-id': p.id, fill: 'transparent', 'fill-opacity': 0.5 });
    layer.provs.append(path);
  });
  geo.edges.forEach(([a, b, d]) => layer.edges.append(el('path', { class: 'edge inner', d, 'data-a': a, 'data-b': b })));
  for (const road of ROADS) layer.road.append(el('path', { class: 'silkroad', d: `M${road.map((id) => PROV[id].xy.join(' ')).join('L')}` }));
  for (const [en, fa, lat, lon] of REGIONS) {
    const [x, y] = xyOf(lat, lon);
    layer.regions.append(el('text', { class: 'region', x, y }, en), el('text', { class: 'region-fa', x, y: y + 26 }, fa));
  }
  for (const [en, fa, lat, lon] of SEAS) {
    const [x, y] = xyOf(lat, lon);
    layer.regions.append(el('text', { class: 'sea', x, y }, en), el('text', { class: 'sea-fa', x, y: y + 28 }, fa));
  }
  for (const [en, lat, lon] of DISTANT) {
    const [x, y] = xyOf(lat, lon);
    layer.regions.append(el('text', { class: 'distant', x, y }, en));
  }
  for (const p of PROVINCES) {
    const g = el('g', { class: 'city', 'data-id': p.id });
    g.append(el('circle', { cx: p.xy[0], cy: p.xy[1], r: p.wealth >= 5 ? 5 : 3.5 }), el('text', { x: p.xy[0] + 8, y: p.xy[1] + 6, class: p.wealth >= 5 ? 'major' : 'minor' }, p.city));
    layer.cities.append(g);
  }
  setupPanZoom();
  newWorld();
  wire();
  // /#plan is the link for outreach: straight to the plan. Everyone else gets five seconds of welcome, then 1200 begins.
  if (location.hash === '#plan') {
    openPlan();
    playPause(true);
  } else {
    $('#forge').showModal();
    welcome = setTimeout(() => $('#forge').open && $('#forge').close('auto'), 5000);
  }
}
let welcome = 0;

// ---------- one month on the map ----------
function newWorld(seed) {
  age = seed ?? 1 + Math.floor(Math.random() * 99999);
  s = newAge(age);
  Object.assign(story, { keys: { 0: structuredClone(s) }, events: [], frontier: 0 });
  last = {};
  shown.length = 0;
  $('#feed-list').innerHTML = '';
  $('#track-events').innerHTML = '';
  closeCard();
  render([{ type: 'age.started', text: 'The year 1200. The realms of the Old World stand as history left them.', date: 'January 1200' }]);
}

// One month forward. At the edge of what has been lived, the world is simulated (and remembered); behind it, the
// recorded month is simply replayed.
function advance() {
  const r = tick(s, brain);
  s = r.state;
  story.events[s.month - 1] = r.events;
  if (s.month > story.frontier) {
    story.frontier = s.month;
    if (s.month % 12 === 0) story.keys[s.month] = structuredClone(s);
    markTrack(r.events);
  }
  return r.events;
}

// Jump to any month already lived: back to the year's snapshot, then forward month by month.
function seek(month) {
  const m = Math.max(0, Math.min(story.frontier, Math.round(month)));
  if (m === s.month) return;
  const k = Math.max(...Object.keys(story.keys).map(Number).filter((x) => x <= m));
  s = structuredClone(story.keys[k]);
  while (s.month < m) s = tick(s, brain).state;
  last = {};
  $('#feed-list').innerHTML = '';
  // The chronicle as it stood that month: its latest entries.
  const recent = [];
  for (let i = m - 1; i >= 0 && recent.length < 7; i--) for (const e of [...(story.events[i] ?? [])].reverse()) if (kindOf(e)[2] && recent.length < 7) recent.push(e);
  render(recent.reverse(), { quiet: true });
}
function step(months) {
  playPause(false);
  if (months > 0 && s.month + months > story.frontier) {
    for (let i = 0; i < months && s.status === 'running'; i++) render(advance());
  } else seek(s.month + months);
}

function render(events, { quiet = false } = {}) {
  const owner = PROVINCES.map((p) => s.provinces[p.id].owner);
  const ownerKey = owner.join(',');
  if (ownerKey !== last.owner) {
    paintProvinces(owner);
    paintRealmLabels();
    last.owner = ownerKey;
  }
  paintSeats();
  paintArmies();
  paintSieges();
  paintMarks();
  if (!quiet) for (const e of events) pulse(e);
  feed(events);
  powers();
  $('#date').textContent = dateText(s.month);
  $('#yr').textContent = yearOf(s.month);
  const at = (m) => `${(Math.min(m, RULES.months) / RULES.months) * 100}%`;
  $('#done').style.width = at(story.frontier);
  $('#now').style.left = at(s.month);
  $('#back').disabled = s.month === 0;
  if (card.kind) refreshCard();
}

// Great moments marked on the timeline, where they happened in the age.
function markTrack(events) {
  for (const e of events) {
    if (!(['founded', 'fallen', 'horde', 'split', 'coup'].includes(e.type) || (e.type === 'capture' && e.capital))) continue;
    const m = document.createElement('i');
    m.className = 'ev';
    m.style.left = `${(Math.min(e.month, RULES.months) / RULES.months) * 100}%`;
    m.style.background = kindOf(e)[1];
    m.title = `${e.date}: ${e.text}`;
    m.dataset.month = e.month + 1;
    $('#track-events').append(m);
  }
}

const colorOf = (id) => s.realms[id]?.color ?? 'transparent';
const ink = (hex, k = 0.5) => {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k + 40 * (1 - k)));
  return `rgb(${c.join(',')})`;
};

function paintProvinces(owner) {
  layer.provs.querySelectorAll('.prov').forEach((path, i) => {
    const o = owner[i];
    path.setAttribute('fill', o ? colorOf(o) : 'transparent');
    path.setAttribute('fill-opacity', o ? (s.realms[o]?.rebel ? 0.32 : 0.5) : 0);
  });
  layer.edges.querySelectorAll('.edge').forEach((e) => {
    const a = owner[+e.dataset.a], b = owner[+e.dataset.b];
    e.setAttribute('class', `edge ${a === b ? 'inner' : a && b ? 'border' : 'wild'}`);
  });
}

// A realm's name across its lands, sized to its reach, in English and in the Persian of its chroniclers.
function paintRealmLabels() {
  layer.realms.innerHTML = '';
  for (const r of living(s)) {
    const mine = provincesOf(s, r.id);
    if (!mine.length) continue;
    let area = 0, x = 0, y = 0;
    for (const p of mine) {
      area += p.area;
      x += p.label[0] * p.area;
      y += p.label[1] * p.area;
    }
    x /= area;
    y /= area;
    const size = Math.max(17, Math.min(64, Math.sqrt(area) / 6.4));
    const g = el('g', { 'data-realm': r.id });
    g.append(el('text', { class: 'realm-label', x, y, 'font-size': size, fill: ink(r.color, 0.62) }, r.short));
    if (r.fa && size > 22) g.append(el('text', { class: 'realm-fa', x, y: y + size * 0.72, 'font-size': size * 0.55, fill: ink(r.color, 0.7) }, r.fa));
    layer.realms.append(g);
  }
}

// Seats of power on the map: a crowned palace for each capital, a fortress for each citadel (walls 3+), a small
// tower for a walled town (shown when zoomed in).
function paintSeats() {
  const caps = new Map(living(s).filter((r) => s.provinces[r.capital]?.owner === r.id).map((r) => [r.capital, r]));
  const key = `${[...caps].map(([p, r]) => `${p}:${r.id}`).join(',')}|${PROVINCES.map((p) => s.provinces[p.id].walls).join('')}`;
  if (key === last.seats) return;
  last.seats = key;
  layer.seats.innerHTML = '';
  for (const p of PROVINCES) {
    const [x, y] = p.xy, r = caps.get(p.id), walls = s.provinces[p.id].walls;
    if (r) layer.seats.append(el('use', { href: '#i-palace', x: x - 16, y: y - 34, width: 32, height: 32, class: 'seat capital', style: `color:${ink(r.color, 0.72)}` }));
    else if (walls >= 3) layer.seats.append(el('use', { href: '#i-citadel', x: x - 12, y: y - 27, width: 24, height: 24, class: 'seat citadel' }));
    else if (walls >= 1) layer.seats.append(el('use', { href: '#i-tower', x: x - 7, y: y - 18, width: 14, height: 14, class: 'seat town' }));
  }
}

// Who leads an army: the king himself, a prince of the blood, or a general.
function leaderOf(a) {
  const r = s.realms[a.realm];
  if (!a.general) return 'helmet';
  return a.general === r?.ruler ? 'crown' : a.general === r?.heir ? 'circlet' : 'helmet';
}

function paintArmies() {
  const live = new Set();
  const byPlace = {};
  for (const a of Object.values(s.armies)) (byPlace[a.at] ??= []).push(a);
  layer.arrows.innerHTML = '';
  for (const [pid, list] of Object.entries(byPlace)) {
    list.forEach((a, i) => {
      live.add(a.id);
      const [cx, cy] = PROV[pid].xy, dx = (i - (list.length - 1) / 2) * 34;
      let g = layer.armies.querySelector(`[data-army="${a.id}"]`);
      if (!g) { // a standard over a medallion that shows who leads, and the army's size beneath
        g = el('g', { class: 'army', 'data-army': a.id });
        g.innerHTML = '<line class="pole" x1="0" y1="-12" x2="0" y2="-46"/><path class="cloth" d="M0 -45h24l-5 6 5 6H0z"/><circle r="2.6" cy="-47" fill="#b3852c"/><circle class="medal" r="13"/><use class="leader" x="-9" y="-9" width="18" height="18"/><text y="28"></text>';
        g.style.opacity = 0;
        layer.armies.append(g);
        requestAnimationFrame(() => (g.style.opacity = 1));
      }
      const scale = Math.max(0.8, Math.min(1.45, 0.75 + a.size / 30)), lead = leaderOf(a);
      g.style.transform = `translate(${cx + dx}px, ${cy - 14}px) scale(${scale})`;
      g.querySelector('.cloth').setAttribute('fill', colorOf(a.realm));
      g.querySelector('.medal').setAttribute('fill', colorOf(a.realm));
      g.querySelector('.leader').setAttribute('href', `#i-${lead}`);
      g.classList.toggle('royal', lead !== 'helmet');
      g.querySelector('text').textContent = `${Math.round(a.size)}k`;
      if (a.path[0] && a.mode === 'march') arrow(PROV[pid].xy, PROV[a.path[0]].xy, colorOf(a.realm));
    });
  }
  layer.armies.querySelectorAll('.army').forEach((g) => {
    if (!live.has(g.dataset.army)) {
      g.style.opacity = 0;
      setTimeout(() => g.remove(), 500);
    }
  });
}

function arrow([x1, y1], [x2, y2], color) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) * 0.12, ny = (x2 - x1) * 0.12;
  const len = Math.hypot(x2 - x1, y2 - y1), k = Math.max(0, (len - 22) / len);
  const ex = x1 + (x2 - x1) * k, ey = y1 + (y2 - y1) * k;
  layer.arrows.append(el('path', { class: 'arrow', d: `M${x1} ${y1}Q${mx + nx} ${my + ny} ${ex} ${ey}`, stroke: ink(color, 0.8) }));
  const ang = Math.atan2(ey - (my + ny), ex - (mx + nx));
  const head = [[0, 0], [-16, -8], [-16, 8]].map(([px, py]) => [ex + px * Math.cos(ang) - py * Math.sin(ang), ey + px * Math.sin(ang) + py * Math.cos(ang)]);
  layer.arrows.append(el('path', { class: 'arrow-head', d: `M${head.map((p) => p.join(' ')).join('L')}Z`, fill: ink(color, 0.8) }));
}

function paintSieges() {
  layer.sieges.innerHTML = '';
  for (const p of PROVINCES) {
    const sg = s.provinces[p.id].siege;
    if (!sg) continue;
    const g = el('g', { class: 'siege' });
    g.append(el('circle', { cx: p.xy[0], cy: p.xy[1], r: 24, stroke: ink(colorOf(sg.realm), 0.75) }), el('text', { x: p.xy[0], y: p.xy[1] + 42 }, `${sg.left}`));
    layer.sieges.append(g);
  }
}

function paintMarks() {
  layer.marks.innerHTML = '';
  for (const p of PROVINCES) {
    const q = s.provinces[p.id], [x, y] = p.xy;
    const marks = [];
    if (q.plague > 0) marks.push(['skull', '#4f6b3a']);
    if (q.famine > 0) marks.push(['wheat', '#9a7a2a']);
    if (q.ravaged > 0) marks.push(['flame', '#4a3626']);
    else if (q.owner && q.loyalty < 28) marks.push(['flame', '#c2541f']);
    marks.forEach(([n, c], i) => layer.marks.append(el('use', { href: `#i-${n}`, x: x + 10 + i * 20, y: y - 26, width: 20, height: 20, style: `color:${c}`, class: 'mark' })));
  }
}

function pulse(e) {
  if (!e.at || reduced) return;
  const [ic, color] = kindOf(e), [x, y] = PROV[e.at].xy;
  const g = el('g', { class: 'pulse' });
  g.append(el('circle', { cx: x, cy: y, r: 22, stroke: color }), el('use', { href: `#i-${ic}`, x: x - 16, y: y - 50, width: 32, height: 32, style: `color:${color}` }));
  layer.pulses.append(g);
  setTimeout(() => g.remove(), 1900);
}

// ---------- the feed: only what matters, in a line each ----------
function feed(events) {
  const list = $('#feed-list');
  for (const e of events) {
    const [ic, color, worth] = kindOf(e);
    if (!worth) continue;
    const li = document.createElement('li');
    li.innerHTML = `<span style="color:${color}">${icon(ic)}</span><span class="t">${esc(e.text)}<span class="d">${esc(e.date)}</span></span>`;
    if (e.at) li.dataset.at = e.at;
    if (e.realms?.[0]) li.dataset.realm = e.realms[0];
    list.prepend(li);
  }
  while (list.children.length > 7) list.lastElementChild.remove();
}

// Each power at a glance: its share of the land, its king, its soldiers and its gold. Ranked by land.
const LAND = PROVINCES.reduce((t, p) => t + p.area, 0);
const statsOf = (r) => {
  const mine = provincesOf(s, r.id);
  return { r, n: mine.length, land: mine.reduce((t, p) => t + p.area, 0) / LAND, men: armiesOf(s, r.id).reduce((t, a) => t + a.size, 0), ruler: s.chars[r.ruler] };
};
function powers() {
  const rows = living(s).map(statsOf).filter((x) => x.n > 0).sort((a, b) => b.land - a.land);
  const key = rows.map((x) => `${x.r.id}${x.n}${x.ruler?.name}${Math.round(x.men)}${Math.round(x.r.gold / 10)}`).join();
  if (key === last.powers) return;
  last.powers = key;
  $('#powers-list').innerHTML = rows.map(({ r, land, men, ruler }) => `<li><button data-realm="${r.id}">
      <i class="shield" style="--c:${r.color}"></i><span class="nm">${esc(r.short)}</span><span class="n">${Math.max(1, Math.round(land * 100))}%</span>
      <span class="sub"><span>${icon('crown')}${esc(ruler?.name ?? '—')}</span><span>${icon('banner')}${Math.round(men)}k</span><span>${icon('coin')}${Math.round(r.gold)}</span></span>
    </button></li>`).join('');
}

// ---------- popups: a province, a realm ----------
const card = { kind: null, id: null };
function openCard(kind, id, at) {
  Object.assign(card, { kind, id, at });
  refreshCard();
  const c = $('#card');
  c.hidden = false;
  if (at && innerWidth > 760) {
    const r = c.getBoundingClientRect();
    c.style.left = `${Math.min(innerWidth - r.width - 12, Math.max(12, at.x + 16))}px`;
    c.style.top = `${Math.min(innerHeight - r.height - 90, Math.max(80, at.y - 40))}px`;
  }
}
function closeCard() {
  card.kind = null;
  $('#card').hidden = true;
}
const pips = (n, max) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">●</span>`).join('')}</span>`;
const age_ = (c) => (c ? yearOf(s.month) - c.born : '');
const chip = (id) => `<span class="chip" data-realm="${id}"><i class="shield" style="--c:${colorOf(id)}"></i>${esc(s.realms[id]?.short ?? id)}</span>`;

function refreshCard() {
  const c = $('#card');
  if (card.kind === 'province') {
    const p = PROV[card.id], q = s.provinces[card.id], r = s.realms[q.owner];
    const loyal = Math.round(q.loyalty), lc = loyal < 30 ? '#c2541f' : loyal < 55 ? '#b3852c' : '#4f7a3a';
    const here = Object.values(s.armies).filter((a) => a.at === card.id);
    c.innerHTML = `<button class="x" aria-label="Close">×</button>
      <div class="who">${r ? `<i class="shield" style="--c:${r.color}"></i>${esc(r.short)}` : 'Unclaimed land'}</div>
      <h3>${esc(p.city)}</h3><p class="fa">${esc(p.fa)}</p>
      <div class="stats">
        <span class="stat" title="Wealth">${icon('coin')}${pips(p.wealth, 5)}</span>
        <span class="stat" title="Walls">${icon('tower')}${pips(q.walls, 4)}</span>
        <span class="stat" title="Loyalty of the people">${icon('people')}<span class="meter"><i style="width:${loyal}%;background:${lc}"></i></span></span>
        <span class="stat" title="Terrain">${icon('hill')}${esc(p.terrain)}</span>
      </div>
      ${q.siege ? `<div class="row" style="color:var(--vermilion)">${icon('tower', 'i')} Besieged by ${chip(q.siege.realm)} · ${q.siege.left} months</div>` : ''}
      ${here.length ? `<div class="row">${icon('banner')} ${here.map((a) => `${chip(a.realm)} ${Math.round(a.size)}k`).join(' ')}</div>` : ''}
      <p class="fact">${esc(p.fact)}</p>`;
  } else if (card.kind === 'realm') {
    const r = s.realms[card.id];
    if (!r) return closeCard();
    const ruler = s.chars[r.ruler], heir = s.chars[r.heir];
    const men = armiesOf(s, r.id).reduce((t, a) => t + a.size, 0);
    const wars = living(s).filter((o) => atWar(s, r.id, o.id)).map((o) => o.id);
    const friends = living(s).filter((o) => o.id !== r.id && friendly(s, r.id, o.id)).map((o) => o.id);
    const p = r.plan ?? {}, aims = (p.targets ?? []).filter((t) => t !== 'neutral' && s.realms[t] && !s.realms[t].fallen);
    const thoughts = [
      aims.length ? `Wants ${aims.slice(0, 3).map((t) => esc(s.realms[t].short)).join(', ')}` : null,
      (p.targets ?? []).includes('neutral') ? 'Eyes the free lands next door' : null,
      p.peace?.length ? `Seeks peace with ${p.peace.map((t) => esc(s.realms[t]?.short)).join(', ')}` : null,
      r.tax === 'high' ? 'Taxes are heavy' : r.tax === 'low' ? 'Taxes eased to calm the people' : null,
      r.power ? `Has spent the reign's power move: ${{ levy: 'Great Levy', walls: 'Mighty Walls', bribe: 'a bribe', feast: 'a Royal Feast', silktax: 'Silk Tax' }[r.power]}` : null,
    ].filter(Boolean);
    const st = statsOf(r), cap = PROV[r.capital];
    const leads = ruler?.army && s.armies[ruler.army] ? s.armies[ruler.army] : null;
    const court = Object.values(s.chars).filter((x) => x.alive && x.realm === r.id && x.role === 'courtier');
    const END = { age: 'skull', battle: 'swords', assassin: 'dagger', overthrown: 'dagger', coup: 'dagger', poisoned: 'dagger' };
    const past = (r.lineage ?? []).slice().reverse();
    c.innerHTML = `<button class="x" aria-label="Close">×</button>
      <div class="who"><i class="shield big" style="--c:${r.color}"></i>${r.rebel ? 'A rebellion' : r.origin === 'historic' ? 'A power of 1200' : r.origin === 'horde' ? 'A horde from the steppe' : `Founded ${yearOf(r.founded)}`}</div>
      <h3>${esc(r.name)}</h3>${r.fa ? `<p class="fa">${esc(r.fa)}</p>` : ''}
      <div class="king">
        <span class="medal" style="--c:${r.color}">${icon('crown')}</span>
        <span><b>${esc(ruler ? `${ruler.title ?? ''} ${ruler.name}` : 'No ruler')}</b>
          <small>${ruler ? `aged ${age_(ruler)}${ruler.since ? ` · reigning since ${ruler.since}` : ''}` : ''}${leads ? ` · leads ${Math.round(leads.size)}k at ${esc(PROV[leads.at].city)}` : ''}</small></span>
      </div>
      ${heir || court.length ? `<div class="family">${heir ? `<span>${icon('circlet')}<b>${esc(heir.name)}</b> ${esc(heir.relation ?? 'heir')}${heir.relation ? ' and heir' : ''}, ${age_(heir)}</span>` : ''}${court.map((x) => `<span>${icon('people')}<b>${esc(x.name)}</b> ${esc(x.title ?? x.role)}</span>`).join('')}</div>` : ''}
      <div class="grid4">
        <span>${icon('castle')}<b>${st.n}</b><small>provinces · ${Math.max(1, Math.round(st.land * 100))}% of the land</small></span>
        <span>${icon('palace')}<b>${esc(cap?.city ?? '—')}</b><small>capital</small></span>
        <span>${icon('banner')}<b>${Math.round(men)}k</b><small>soldiers</small></span>
        <span>${icon('coin')}<b>${Math.round(r.gold)}</b><small>gold · +${Math.round(r.lastIncome ?? 0)} a month</small></span>
      </div>
      ${wars.length ? `<div class="row">${icon('swords')}<span>At war with</span> ${wars.map(chip).join('')}</div>` : ''}
      ${friends.length ? `<div class="row">${icon('rings')}<span>Friends</span> ${friends.map(chip).join('')}</div>` : ''}
      ${thoughts.length ? `<div class="mind"><b>${icon('eye')} In the ruler's mind</b>${thoughts.join('. ')}.</div>` : ''}
      ${past.length ? `<details class="lineage"><summary>${icon('scroll')} The ${esc(r.dynasty ?? 'line')}: ${past.length} before</summary><ol>${past.map((l) => `<li><span>${esc(l.name)}</span><small>${l.since}–${l.until}</small>${l.cause && END[l.cause] ? `<i title="${esc(l.cause)}">${icon(END[l.cause])}</i>` : ''}</li>`).join('')}</ol></details>` : ''}`;
  }
}

// ---------- the free plan: a visitor's business in, the AI's plan out (POST /api/plan, server/plan.js) ----------
const BOOK = 'https://calendly.com/realumargujjar/30min?utm_source=agentistan&utm_medium=book-button&utm_content=plan';
function openPlan() {
  if (!$('#plan').open) $('#plan').showModal();
  setTimeout(() => $('#plan-text').focus(), 50);
}
async function draftPlan(text) {
  const out = $('#plan-out'), go = $('#plan-go');
  if (text.trim().length < 10) return void (out.innerHTML = '<p class="note">A sentence or two about your business is enough.</p>');
  if (go.disabled) return;
  go.disabled = true;
  out.innerHTML = `<p class="note thinking">${icon('eye')} Thinking it through…</p>`;
  try {
    const d = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }).then((r) => r.json());
    const p = d.plan;
    out.innerHTML = !p ? `<p class="note">${esc(d.error ?? 'No plan this time. Try again in a minute.')}</p>`
      : !p.fit ? `<p class="note">${esc(p.headline)}</p>`
      : `<article class="plan-result">
          <h3>${esc(p.headline)}</h3>
          <ol class="steps">${p.steps.map((st) => `<li><b>${esc(st.title)}</b><span>${esc(st.automated)}</span>${st.result ? `<span class="you">${esc(st.result)}</span>` : ''}<span class="tech">${st.tech.map((t) => `<i>${esc(t)}</i>`).join('')}</span></li>`).join('')}</ol>
          ${p.care ? `<p class="care">${icon('tower')}${esc(p.care)}</p>` : ''}
          <a class="btn main wide" href="${BOOK}" target="_blank" rel="noopener">Book a free 30-minute call</a>
          <p class="fine">Drafted just now by AI from what you wrote: a starting point, not a quote.</p>
        </article>`;
  } catch {
    out.innerHTML = '<p class="note">Couldn’t reach the planner. Try again in a minute.</p>';
  } finally {
    go.disabled = false;
  }
}

// ---------- the player ----------
function playPause(on = !playing) {
  playing = on;
  $('#play').innerHTML = icon(playing ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  clearTimeout(timer);
  if (playing) loop();
}
function loop() {
  if (!playing) return;
  if (s.status !== 'running') {
    playPause(false);
    return;
  }
  const events = advance();
  render(events);
  timer = setTimeout(loop, SPEED[speed] + (events.some(GREAT) ? HOLD[speed] : 0));
}
function setSpeed(v) {
  speed = v;
  document.documentElement.style.setProperty('--step', `${Math.min(1.1, (SPEED[v] * 0.85) / 1000)}s`);
  document.querySelectorAll('.speed button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
}

// ---------- pan and zoom ----------
const view = { x: 0, y: 0, w: W, h: H };
function fit() {
  const phone = innerWidth < 760;
  const [x1] = xyOf(37, phone ? 48 : -9), [x2] = xyOf(37, phone ? 82 : 121), [, cy] = xyOf(phone ? 37 : 38, 60);
  const w = x2 - x1, h = w / (innerWidth / innerHeight);
  setView({ x: x1, y: cy - h / 2, w, h });
}
function setView(v) {
  const aspect = innerWidth / innerHeight;
  v.w = Math.max(420, Math.min(W, v.w));
  v.h = v.w / aspect;
  if (v.h > H) { v.h = H; v.w = H * aspect; }
  v.x = Math.max(0, Math.min(W - v.w, v.x));
  v.y = Math.max(0, Math.min(H - v.h, v.y));
  Object.assign(view, v);
  map.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  map.dataset.zoom = v.w < 950 ? 3 : v.w < 1750 ? 2 : v.w < 3800 ? 1 : 0;
  clearTimeout(tileTimer);
  tileTimer = setTimeout(loadTiles, 120);
}

// Sharper parchment as the view closes in: the coarsest tile level that still looks crisp on this screen.
const tileLayers = {}, tilesShown = new Set();
let tileTimer = 0, tileMeta = null;
async function loadTiles() {
  tileMeta ??= await fetch('/world/tiles/meta.json').then((r) => r.json()).catch(() => ({ tile: 512, levels: 4 }));
  const need = (innerWidth / view.w) * (devicePixelRatio || 1) * 0.8; // screen pixels per map unit
  let level = 1;
  while (level < tileMeta.levels - 1 && 2 ** (level - (tileMeta.levels - 1)) < need) level++;
  const span = tileMeta.tile * 2 ** (tileMeta.levels - 1 - level); // map units per tile at this level
  for (let ty = Math.floor(view.y / span); ty * span < view.y + view.h; ty++) {
    for (let tx = Math.floor(view.x / span); tx * span < view.x + view.w; tx++) {
      const key = `${level}/${tx}_${ty}`;
      if (tilesShown.has(key) || tx < 0 || ty < 0 || tx * span >= W || ty * span >= H) continue;
      tilesShown.add(key);
      tileLayers[level].append(el('image', { href: `/world/tiles/${key}.webp`, x: tx * span, y: ty * span, width: Math.min(span, W - tx * span), height: Math.min(span, H - ty * span), preserveAspectRatio: 'none' }));
    }
  }
}
const toMap = (cx, cy) => ({ x: view.x + (cx / innerWidth) * view.w, y: view.y + (cy / innerHeight) * view.h });
function zoomAt(cx, cy, k) {
  const p = toMap(cx, cy), w = view.w / k, h = view.h / k;
  setView({ x: p.x - (cx / innerWidth) * w, y: p.y - (cy / innerHeight) * h, w, h });
}
function setupPanZoom() {
  map.setAttribute('preserveAspectRatio', 'none');
  fit();
  addEventListener('resize', () => setView({ ...view }));
  map.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  const pts = new Map();
  let start = null, moved = false;
  map.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { ...view, px: e.clientX, py: e.clientY, d: pts.size === 2 ? dist() : 0 };
    moved = false;
    map.setPointerCapture(e.pointerId);
  });
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  map.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && start.d) {
      const [a, b] = [...pts.values()];
      const k = dist() / start.d, w = start.w / k;
      setView({ ...view, x: start.x + (start.w - w) * ((a.x + b.x) / 2 / innerWidth), y: start.y + (start.h - w * (start.h / start.w)) * ((a.y + b.y) / 2 / innerHeight), w });
      moved = true;
      return;
    }
    const dx = e.clientX - start.px, dy = e.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; map.classList.add('dragging'); }
    if (moved) setView({ ...view, x: start.x - (dx / innerWidth) * start.w, y: start.y - (dy / innerHeight) * start.h, w: start.w });
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    map.classList.remove('dragging');
    if (!pts.size && !moved) click(e);
    if (!pts.size) start = null;
  };
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); start = null; });
  map.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 1.8));
}
function click(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const realm = t?.closest('[data-realm]')?.dataset.realm;
  const army = t?.closest('[data-army]')?.dataset.army;
  const prov = t?.closest('.prov')?.dataset.id;
  if (realm) return openCard('realm', realm, { x: e.clientX, y: e.clientY });
  if (army && s.armies[army]) return openCard('realm', s.armies[army].realm, { x: e.clientX, y: e.clientY });
  if (prov) return openCard('province', prov, { x: e.clientX, y: e.clientY });
  closeCard();
}
function focus(pid) {
  const [x, y] = PROV[pid].xy, w = Math.min(view.w, 1300);
  setView({ x: x - w / 2, y: y - (w / (innerWidth / innerHeight)) / 2, w });
}

// ---------- controls ----------
function wire() {
  $('#play').addEventListener('click', () => playPause());
  // Back and forth through the age: a month (or, with Shift, a year), or straight to any lived moment on the timeline.
  $('#back').addEventListener('click', (e) => step(e.shiftKey ? -12 : -1));
  $('#fwd').addEventListener('click', (e) => step(e.shiftKey ? 12 : 1));
  const track = $('.track');
  const seekAt = (e) => {
    const r = track.getBoundingClientRect();
    playPause(false);
    seek(((e.clientX - r.left) / r.width) * RULES.months);
  };
  track.addEventListener('pointerdown', (e) => {
    seekAt(e);
    track.setPointerCapture(e.pointerId);
    const move = (ev) => seekAt(ev);
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', () => track.removeEventListener('pointermove', move), { once: true });
  });
  document.querySelectorAll('.speed button').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  $('#new').addEventListener('click', () => { playPause(false); newWorld(); playPause(true); });
  $('#zin').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1.5));
  $('#zout').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.5));
  $('#forge').addEventListener('close', () => {
    clearTimeout(welcome);
    if (!playing) playPause(true);
  });
  $('#forge-plan').addEventListener('click', () => { $('#forge').close(); openPlan(); });
  $('#plan-btn').addEventListener('click', openPlan);
  $('#plan').addEventListener('click', (e) => {
    const pick = e.target.closest('.pick');
    if (pick) {
      $('#plan-text').value = pick.dataset.text;
      draftPlan(pick.dataset.text);
    }
    if (e.target === $('#plan')) $('#plan').close(); // a click on the backdrop
  });
  $('#plan-go').addEventListener('click', () => draftPlan($('#plan-text').value));
  addEventListener('hashchange', () => location.hash === '#plan' && openPlan());
  $('#key-btn').addEventListener('click', () => {
    const k = $('#key'), open = k.hidden;
    k.hidden = !open;
    $('#key-btn').setAttribute('aria-pressed', String(open));
  });
  $('#powers-btn').addEventListener('click', () => {
    const k = $('#powers'), open = k.hidden;
    k.hidden = !open;
    $('#powers-btn').setAttribute('aria-pressed', String(open));
  });
  document.addEventListener('click', (e) => {
    const r = e.target.closest('.chip[data-realm], .powers [data-realm], .feed li');
    if (!r) return;
    if (r.matches('.feed li')) {
      if (r.dataset.at) focus(r.dataset.at);
      if (r.dataset.realm && s.realms[r.dataset.realm]) openCard('realm', r.dataset.realm);
      return;
    }
    openCard('realm', r.dataset.realm, e.target.closest('.card') ? null : { x: e.clientX, y: e.clientY });
  });
  $('#card').addEventListener('click', (e) => { if (e.target.closest('.x')) closeCard(); });
  addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.target.closest('button, a, input, textarea')) { e.preventDefault(); playPause(); }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea')) step((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 12 : 1));
    if (e.key === 'Escape') closeCard();
  });
  for (const y of [1200, 1210, 1220, 1230, 1240, 1250]) {
    const t = document.createElement('span');
    t.className = 'tick';
    t.style.left = `${((y - 1200) * 12 / RULES.months) * 100}%`;
    t.textContent = y;
    $('#track-ticks').append(t);
  }
  if (innerWidth < 760) { // a phone: the map comes first, the powers list on request
    $('#powers').hidden = true;
    $('#powers-btn').setAttribute('aria-pressed', 'false');
  }
  setSpeed(1);
  playPause(false);
}

boot();
