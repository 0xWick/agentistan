// The living map: the world simulated month by month right here in the browser, drawn like an old map. The cards,
// the chronicle and the great-event pictures all read the moment on the timeline (S.s).
import { newAge, tick, PROVINCES, PROV, LAND, living, provincesOf, armiesOf, menOf, dateText, yearOf, atWar, weatherOf, seasonName, cityOf, prosperityOf, steersman, rulingTemper } from './engine.js';
import { brain } from './doctrine.js';
import { TEMPER_TEXT } from './names.js';
import { S, $, esc, icon, symbols, kindOf, worth, colorOf, ink, men } from './ui.js';
import { card, openCard, closeCard, backCard, refreshCard, eventCard, isGreat, ART } from './cards.js';
import { PAINTED } from './portrait.js';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
S.story = story;
const SPEED = { 1: 3000, 4: 900, 16: 220 }; // ms per month
const HOLD = { 1: 1800, 4: 900, 16: 0 }; // extra pause after a great event, so it can be read
const shown = []; // the feed
const setState = (x) => { s = x; S.s = x; };
const total = () => s?.months ?? 672;

// ---------- the map, drawn once ----------
const map = $('#map');
const layer = {};
async function boot() {
  // The icons first, so the buttons and the welcome card show them before the map has loaded.
  const defs = el('defs');
  defs.innerHTML = `${symbols()}
    <pattern id="w-snow" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5" cy="6" r="2.2" fill="#fff"/><circle cx="16" cy="15" r="1.6" fill="#fff"/><circle cx="12" cy="3" r="1" fill="#fff"/></pattern>
    <pattern id="w-rains" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M3 0v9M11 6v9" stroke="#3d6b8c" stroke-width="1.6" stroke-linecap="round"/></pattern>
    <pattern id="w-heat" width="26" height="14" patternUnits="userSpaceOnUse"><path d="M0 7q3.25-5 6.5 0t6.5 0 6.5 0 6.5 0" fill="none" stroke="#c2541f" stroke-width="1.4"/></pattern>`;
  map.append(defs);
  const [g, art] = await Promise.all([fetch('/world/geo.json').then((r) => r.json()), fetch('/art/manifest.json').then((r) => r.json()).catch(() => ({ events: [], people: [] }))]);
  geo = g;
  for (const k of art.events ?? []) ART.add(k);
  for (const k of art.people ?? []) PAINTED.add(k);
  ({ width: W, height: H } = geo);
  xyOf = projector(geo.proj);
  map.setAttribute('viewBox', `0 0 ${W} ${H}`);
  for (const name of ['base', 'tiles', 'rivers', 'provs', 'weather', 'edges', 'road', 'regions', 'realms', 'cities', 'seats', 'marks', 'sieges', 'arrows', 'battles', 'armies', 'pulses']) map.append((layer[name] = el('g', { class: `l-${name}` })));
  // The parchment: a small picture of the whole world at once, then sharper tiles as the view closes in.
  layer.base.append(el('image', { href: '/world/base.webp', width: W, height: H, preserveAspectRatio: 'none' }));
  for (let lv = 1; lv < 4; lv++) layer.tiles.append((tileLayers[lv] = el('g')));
  for (const r of geo.rivers) layer.rivers.append(el('path', { class: 'river', d: r.d, 'stroke-width': Math.max(1, 4.2 - r.rank * 0.45) }));
  geo.provinces.forEach((p) => layer.provs.append(el('path', { class: 'prov', d: p.d, 'data-id': p.id, fill: 'transparent', 'fill-opacity': 0.5 })));
  geo.edges.forEach(([a, b, d]) => layer.edges.append(el('path', { class: 'edge inner', d, 'data-a': a, 'data-b': b })));
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
  setState(newAge(age));
  Object.assign(story, { keys: { 0: structuredClone(s) }, events: [], frontier: 0 });
  last = {};
  shown.length = 0;
  $('#feed-list').innerHTML = '';
  $('#track-events').innerHTML = '';
  closeCard();
  layer.road.innerHTML = '';
  for (const road of s.roads ?? []) layer.road.append(el('path', { class: 'silkroad', d: `M${road.map((id) => PROV[id].xy.join(' ')).join('L')}` }));
  ticks();
  render([{ type: 'age.started', text: `The year ${yearOf(0, s)}. The realms of the Old World stand as history left them.`, date: dateText(0, s) }]);
}

// One month forward. At the edge of what has been lived, the world is simulated (and remembered); behind it, the
// recorded month is simply replayed.
function advance() {
  const before = s;
  const r = tick(s, brain);
  setState(r.state);
  S.prev = before;
  story.events[s.month - 1] = r.events;
  if (s.month > story.frontier) {
    story.frontier = s.month;
    if (s.month % 12 === 0) story.keys[s.month] = structuredClone(s);
    markTrack(r.events);
    r.fresh = true;
  }
  return r;
}

// Jump to any month already lived: back to the year's snapshot, then forward month by month.
function seek(month) {
  const m = Math.max(0, Math.min(story.frontier, Math.round(month)));
  if (m === s.month) return;
  const k = Math.max(...Object.keys(story.keys).map(Number).filter((x) => x <= m));
  let x = structuredClone(story.keys[k]);
  while (x.month < m) x = tick(x, brain).state;
  setState(x);
  last = {};
  $('#feed-list').innerHTML = '';
  // The chronicle as it stood that month: its latest entries.
  const recent = [];
  for (let i = m - 1; i >= 0 && recent.length < 7; i--) for (const e of [...(story.events[i] ?? [])].reverse()) if (worth(e) && recent.length < 7) recent.push(e);
  render(recent.reverse(), { quiet: true });
}
function step(months) {
  playPause(false);
  if (months > 0 && s.month + months > story.frontier) {
    for (let i = 0; i < months && s.status === 'running'; i++) render(advance().events);
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
  paintWeather();
  paintSeats();
  paintArmies();
  paintBattles();
  paintSieges();
  paintMarks();
  if (!quiet) for (const e of events) pulse(e);
  feed(events);
  powers();
  $('#date').textContent = dateText(s.month, s);
  $('#ask-date').textContent = dateText(s.month, s);
  $('#yr').textContent = yearOf(s.month, s);
  seasonBadge();
  const at = (m) => `${(Math.min(m, total()) / total()) * 100}%`;
  $('#done').style.width = at(story.frontier);
  $('#now').style.left = at(s.month);
  $('#back').disabled = s.month === 0;
  if (card.kind) refreshCard();
}

// Great moments marked on the timeline, where they happened in the age.
function markTrack(events) {
  for (const e of events) {
    if (!(['founded', 'fallen', 'horde', 'split', 'coup', 'golden', 'charter', 'commune', 'uprising'].includes(e.type) || (e.type === 'capture' && e.capital))) continue;
    const m = document.createElement('i');
    m.className = 'ev';
    m.style.left = `${(Math.min(e.month, total()) / total()) * 100}%`;
    m.style.background = kindOf(e)[1];
    m.title = `${e.date}: ${e.text}`;
    m.dataset.month = e.month + 1;
    $('#track-events').append(m);
  }
}
function ticks() {
  $('#track-ticks').innerHTML = '';
  const y0 = yearOf(0, s), years = Math.round(total() / 12);
  for (let y = 0; y <= years; y += 10) {
    const t = document.createElement('span');
    t.className = 'tick';
    t.style.left = `${((y * 12) / total()) * 100}%`;
    t.textContent = y0 + y < 0 ? `${-(y0 + y)} BC` : y0 + y;
    $('#track-ticks').append(t);
  }
}

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

// The season on the map: snow over the cold lands in winter, rain over the monsoon lands, heat over the deserts.
function paintWeather() {
  const key = s.month % 12;
  if (key === last.weather) return;
  last.weather = key;
  layer.weather.innerHTML = '';
  geo.provinces.forEach((p, i) => {
    const w = weatherOf(PROVINCES[i].id, s.month);
    if (w) layer.weather.append(el('path', { d: p.d, class: `wx ${w}`, fill: `url(#w-${w})` }));
  });
}
const SEASON = {
  winter: ['snow', 'Winter', 'Snow closes the northern passes; armies keep to winter quarters'],
  spring: ['wheat', 'Spring', 'The roads open again; spring harvests in the south'],
  summer: ['sun', 'Summer', 'Heat in the deserts; in India the monsoon rains halt all campaigns'],
  autumn: ['wheat', 'Autumn', 'The campaigning season: granaries full after the harvest'],
};
function seasonBadge() {
  const [ic, name, text] = SEASON[seasonName(s.month)];
  const b = $('#season');
  if (b.dataset.key === name) return;
  b.dataset.key = name;
  b.innerHTML = `${icon(ic)}<span>${name}</span>`;
  b.title = text;
}

// A realm's name across its lands, sized to its reach, in English and in the script of its chroniclers.
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
    const g = el('g', { 'data-realm': r.id, class: r.golden > s.month ? 'golden' : '' });
    g.append(el('text', { class: 'realm-label', x, y, 'font-size': size, fill: ink(r.color, 0.62) }, r.short));
    if (r.fa && size > 22) g.append(el('text', { class: 'realm-fa', x, y: y + size * 0.72, 'font-size': size * 0.55, fill: ink(r.color, 0.7) }, r.fa));
    layer.realms.append(g);
  }
}

// Seats of power: a crowned palace for each capital, a fortress for each citadel (walls 3+), a small tower for a
// walled town (shown when zoomed in).
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
      g.classList.toggle('fighting', !!a.battle);
      g.querySelector('text').textContent = men(a.size);
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

// A battle in progress: crossed swords between the two banners, and the month of fighting it has reached.
function paintBattles() {
  layer.battles.innerHTML = '';
  for (const b of Object.values(s.battles ?? {})) {
    const [x, y] = PROV[b.at].xy;
    const g = el('g', { class: 'battle', 'data-war': b.war ?? '', 'data-prov': b.at });
    g.append(el('circle', { cx: x, cy: y - 14, r: 34, class: 'battle-ring' }));
    g.append(el('circle', { cx: x - 20, cy: y - 64, r: 9, fill: colorOf(b.ra[0]), class: 'battle-side' }), el('circle', { cx: x + 20, cy: y - 64, r: 9, fill: colorOf(b.rd[0]), class: 'battle-side' }));
    g.append(el('use', { href: '#i-swords', x: x - 15, y: y - 79, width: 30, height: 30, class: 'battle-swords' }));
    g.append(el('text', { x, y: y + 44, class: 'battle-text' }, `month ${b.rounds + 1}`));
    layer.battles.append(g);
  }
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
    if (q.building) marks.push(['hammer', '#6a5032']);
    marks.forEach(([n, c], i) => layer.marks.append(el('use', { href: `#i-${n}`, x: x + 10 + i * 20, y: y - 26, width: 20, height: 20, style: `color:${c}`, class: `mark${n === 'hammer' ? ' works' : ''}` })));
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
    if (!worth(e)) continue;
    const [ic, color] = kindOf(e);
    const li = document.createElement('li');
    li.innerHTML = `<span style="color:${color}">${icon(ic)}</span><span class="t">${esc(e.text)}<span class="d">${esc(e.date)}</span></span>`;
    if (e.at) li.dataset.at = e.at;
    if (e.war) li.dataset.war = e.war;
    else if (e.chars?.[0] && ['death', 'crowned', 'birth', 'epithet', 'marriage', 'regency', 'turncoat', 'intrigue'].includes(e.type) && s.chars[e.chars[0]]) li.dataset.char = e.chars[0];
    else if (e.realms?.[0]) li.dataset.realm = e.realms[0];
    list.prepend(li);
  }
  while (list.children.length > 7) list.lastElementChild.remove();
}

// Each power at a glance: its share of the land, its ruler, its soldiers and its gold. Ranked by land.
const statsOf = (r) => {
  const mine = provincesOf(s, r.id);
  return { r, n: mine.length, land: mine.reduce((t, p) => t + p.area, 0) / LAND, men: menOf(s, r.id), ruler: s.chars[r.ruler] };
};
function powers() {
  const rows = living(s).map(statsOf).filter((x) => x.n > 0).sort((a, b) => b.land - a.land);
  const key = rows.map((x) => `${x.r.id}${x.n}${x.ruler?.name}${Math.round(x.men)}${Math.round(x.r.gold / 10)}${x.r.golden > s.month}`).join();
  if (key === last.powers) return;
  last.powers = key;
  $('#powers-list').innerHTML = rows.map(({ r, land, men: m, ruler }) => `<li><button data-realm="${r.id}">
      <i class="shield" style="--c:${r.color}"></i><span class="nm">${esc(r.short)}${r.golden > s.month ? `<span class="gold" title="A golden age">${icon('sun')}</span>` : ''}</span><span class="n">${Math.max(1, Math.round(land * 100))}%</span>
      <span class="sub"><span>${icon('crown')}${esc(ruler?.name ?? '—')}</span><span>${icon('banner')}${men(m)}</span><span>${icon('coin')}${Math.round(r.gold)}</span>${(r.grain ?? 0) < m * 1.2 && !r.nomad ? `<span class="hungry" title="Granaries nearly empty">${icon('wheat')}</span>` : ''}</span>
    </button></li>`).join('');
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

// ---------- the chronicler: ask about the world at this moment ----------
// The world lives in this browser, so the question goes with what the chronicles record now: the realms and their
// rulers and courts, their wars and treaties, who holds which cities, and the great events of the age so far.
function factsNow() {
  const out = [], rows = living(s).map(statsOf).filter((x) => x.n > 0).sort((a, b) => b.land - a.land);
  const ageOf = (c) => (c ? yearOf(s.month, s) - c.born : '');
  out.push('Realms, largest first:');
  for (const { r, n, men: m, ruler } of rows.slice(0, 20)) {
    const heir = s.chars[r.heir], consort = s.chars[ruler?.spouse], vizier = s.chars[r.vizier], regent = s.chars[r.regent];
    const wars = [...new Set(living(s).filter((o) => atWar(s, r.id, o.id)).map((o) => s.conflicts[s.wars[[r.id, o.id].sort().join('|')]?.conflict]?.name ?? `war with ${o.short}`))];
    const line = (r.lineage ?? []).slice(-3).map((l) => `${l.name}${l.epithet ? ` ${l.epithet}` : ''} ${l.since}-${l.until}${l.cause ? ` (${l.cause})` : ''}`).join(', ');
    const temper = TEMPER_TEXT[rulingTemper(s, r)]?.[0];
    out.push(`- ${r.name} (${r.short}): ${ruler ? `${ruler.title ?? ''} ${ruler.name}${ruler.epithet ? ` ${ruler.epithet}` : ''}, aged ${ageOf(ruler)}${temper ? `, a ${temper.toLowerCase()}` : ''}${ruler.since ? `, reigning since ${ruler.since}` : ''}` : 'no ruler'}${regent ? `; regent ${regent.name}` : ''}${consort?.alive ? `; consort ${consort.name}` : ''}${heir ? `; heir ${heir.name} (${heir.relation ?? 'heir'})` : ''}${vizier?.alive ? `; ${vizier.title} ${vizier.name}` : ''}; house: ${r.dynasty}${line ? `; before: ${line}` : ''}; ${n} provinces, capital ${cityOf(s, r.capital)}, holds ${provincesOf(s, r.id).map((p) => cityOf(s, p.id)).slice(0, 12).join(', ')}; ${Math.round(m)}k soldiers, gold ${Math.round(r.gold)}, prosperity ${Math.round(prosperityOf(s, r.id))}/100${r.golden > s.month ? ', in a golden age' : ''}${wars.length ? `; at war: ${wars.join(', ')}` : ''}${r.overlord ? `; vassal of ${s.realms[r.overlord]?.short}` : ''}${r.origin !== 'historic' ? `; founded ${yearOf(r.founded, s)}` : ''}.`);
  }
  if (rows.length > 20) out.push(`- smaller realms: ${rows.slice(20).map((x) => `${x.r.short} (${x.n})`).join(', ')}.`);
  const fallen = Object.values(s.realms).filter((r) => r.fallen).map((r) => `${r.name} (fell ${yearOf(r.fellAt ?? 0, s)})`);
  if (fallen.length) out.push(`Fallen realms: ${fallen.join('; ')}.`);
  const great = [], lately = [];
  for (let m = 0; m < s.month; m++) for (const e of story.events[m] ?? []) {
    if (isGreat(e, s) || ['crowned', 'war', 'peace', 'power', 'plague', 'marriage', 'golden', 'invention', 'verdict', 'reform'].includes(e.type) && !e.minor || (e.type === 'death' && e.cause === 'assassin')) great.push(`${e.date}: ${e.text}`);
    if (m >= s.month - 6 && worth(e)) lately.push(`${e.date}: ${e.text}`);
  }
  out.push('Great events of the age so far:', ...great.slice(-55).map((x) => `- ${x}`), 'The last few months:', ...lately.slice(-15).map((x) => `- ${x}`));
  return out.join('\n').slice(0, 9000);
}
async function askChronicler(q) {
  const question = q.trim();
  if (question.length < 3) return;
  const log = $('#ask-log'), li = document.createElement('li');
  li.innerHTML = `<p class="q">${esc(question)}<small>${esc(dateText(s.month, s))}</small></p><p class="a thinking">${icon('quill')} The chronicler searches his pages…</p>`;
  log.append(li);
  log.scrollTop = log.scrollHeight;
  $('#ask-q').value = '';
  try {
    const d = await fetch('/api/chronicle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, date: dateText(s.month, s), facts: factsNow() }) }).then((r) => r.json());
    li.querySelector('.a').outerHTML = `<p class="a">${esc(d.answer ?? d.error ?? 'The chronicles are silent.')}</p>`;
  } catch {
    li.querySelector('.a').outerHTML = '<p class="a">The chronicler cannot be reached just now. Try again in a minute.</p>';
  }
  log.scrollTop = log.scrollHeight;
}

// ---------- the player ----------
function playPause(on = !playing) {
  playing = on;
  $('#play').innerHTML = icon(playing ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  clearTimeout(timer);
  if (playing) loop();
}
let lastCard = -99;
function loop() {
  if (!playing) return;
  if (s.status !== 'running') {
    playPause(false);
    return;
  }
  const r = advance();
  render(r.events);
  // A great event, freshly lived, gets its card: at 1× the story waits for the reader; at 4× it shows for a moment.
  const great = r.fresh && speed < 16 && s.month - lastCard >= (speed === 1 ? 3 : 8) ? r.events.filter((e) => isGreat(e, s)).sort((a, b) => rank(b) - rank(a))[0] : null;
  if (great) {
    lastCard = s.month;
    eventCard(great, S.prev, s, r.events);
    if (speed === 1) { playing = false; $('#play').innerHTML = icon('play'); resumeAfterCard = true; return; }
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => $('#event').open && $('#event').close('auto'), 3500);
  }
  timer = setTimeout(loop, SPEED[speed] + (r.events.some((e) => isGreat(e, s)) ? HOLD[speed] : 0));
}
let resumeAfterCard = false, cardTimer = 0;
const rank = (e) => ({ 'age.ended': 9, horde: 8, fallen: 7, capture: 6, split: 6, coup: 6, golden: 5, death: 5, battle: 4, turncoat: 4, uprising: 4, commune: 3, charter: 3, separatist: 3, invention: 2, defied: 2, war: 2 })[e.type] ?? 1;
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
    try { map.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
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
  const at = { x: e.clientX, y: e.clientY };
  const army = t?.closest('[data-army]')?.dataset.army, battle = t?.closest('.battle'), realm = t?.closest('[data-realm]')?.dataset.realm, prov = t?.closest('.prov')?.dataset.id;
  if (army && s.armies[army]) return openCard('army', army, at);
  if (battle?.dataset.war) return openCard('war', battle.dataset.war, at);
  if (realm) return openCard('realm', realm, at);
  if (prov) return openCard('province', prov, at);
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
    seek(((e.clientX - r.left) / r.width) * total());
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
  // The great-event card: Continue resumes the story; the other button opens the war or the realm.
  $('#event').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === $('#event') || b) $('#event').close(b?.value ?? 'go');
    if (b?.dataset.war) openCard('war', b.dataset.war);
    else if (b?.dataset.realm) openCard('realm', b.dataset.realm);
  });
  $('#event').addEventListener('close', () => {
    clearTimeout(cardTimer);
    if (resumeAfterCard) { resumeAfterCard = false; playPause(true); }
  });
  const toggleAsk = (open = $('#ask').hidden) => {
    $('#ask').hidden = !open;
    $('#ask-btn').setAttribute('aria-pressed', String(open));
    if (open) { $('#key').hidden = true; setTimeout(() => $('#ask-q').focus(), 30); }
  };
  $('#ask-btn').addEventListener('click', () => toggleAsk());
  $('#ask-x').addEventListener('click', () => toggleAsk(false));
  $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); askChronicler($('#ask-q').value); });
  $('#ask').addEventListener('click', (e) => { const b = e.target.closest('.pick'); if (b) askChronicler(b.dataset.q); });
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
  // Anything that names a realm, a person, a war, an army or a town opens its card.
  document.addEventListener('click', (e) => {
    if (e.target.closest('#map, dialog')) return;
    const inCard = !!e.target.closest('.card');
    const at = inCard ? null : { x: e.clientX, y: e.clientY };
    if (e.target.closest('.card .x')) return closeCard();
    if (e.target.closest('.card .back')) return backCard();
    const feedItem = e.target.closest('.feed li');
    if (feedItem?.dataset.at) focus(feedItem.dataset.at);
    const t = e.target.closest('[data-war]:not([data-war=""]), [data-char], [data-army], [data-prov], [data-realm]');
    if (!t) return;
    if (t.dataset.war) return openCard('war', t.dataset.war, at);
    if (t.dataset.char && s.chars[t.dataset.char]) return openCard('char', t.dataset.char, at);
    if (t.dataset.army && s.armies[t.dataset.army]) return openCard('army', t.dataset.army, at);
    if (t.dataset.prov) { focus(t.dataset.prov); return openCard('province', t.dataset.prov, at); }
    if (t.dataset.realm && s.realms[t.dataset.realm]) return openCard('realm', t.dataset.realm, at);
  });
  addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.target.closest('button, a, input, textarea')) { e.preventDefault(); playPause(); }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea')) step((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 12 : 1));
    if (e.key === 'Escape') { closeCard(); toggleAsk(false); }
  });
  if (innerWidth < 760) { // a phone: the map comes first, the powers list on request
    $('#powers').hidden = true;
    $('#powers-btn').setAttribute('aria-pressed', 'false');
  }
  setSpeed(1);
  playPause(false);
}

boot();
