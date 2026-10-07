// What every part of the page shares: the ink glyphs, how each kind of event looks, small bits of markup, and the
// world the page is showing right now (S.s), so the map, the cards and the panels all read the same moment.
export const S = { s: null, story: null, prev: null, chain: null };
export const $ = (q) => document.querySelector(q);
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- ink glyphs: every icon on the page, drawn once ----------
export const ICON = {
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
  quill: { s: 'M20 3c-7 1-12 6-14 14M20 3c1 4-2 8-6 9l-4 1M20 3c-1 3-4 5-7 6M6 17l-2 4' },
  horse: { f: 'M4 21l1.6-6.4L4 12l2.4-4.4L10 6l1.4-3 1.8 2.2 2.6.4 3.6 3.6-1.2 2.2-2.6-.8-1.2 2.6 1.4 4.2-1.8.6-1.8-3.6-3.4.4-.8 4.8z' },
  anvil: { f: 'M3 7h13c0 2.6 2.4 3.6 5 3.6V12c-2.8 0-4.4 1-5.4 2.6L17 18h2v2.6H6V18h2l1.4-3.4C6.6 13.6 4 11.6 3 7z' },
  palace: { f: 'M12 1.5c1.6 1.9 3.6 2.9 3.6 5.4V9H8.4V6.9C8.4 4.4 10.4 3.4 12 1.5zM2.5 10h3.2v2h2v-2h8.6v2h2v-2h3.2v11.5h-7.2V17a2.3 2.3 0 0 0-4.6 0v4.5H2.5z' },
  citadel: { f: 'M1.5 22l3.2-6.5h14.6l3.2 6.5zM7 15V7.5H5V3.5h3v2h2v-2h4v2h2v-2h3v4h-2V15h-3.6v-3.2a1.4 1.4 0 0 0-2.8 0V15z' },
  helmet: { f: 'M12 1.8l1.7 3.4c3.6 1.2 5.3 4.4 5.3 7.8V16H5v-3c0-3.4 1.7-6.6 5.3-7.8zM7.5 17h9v4.5h-3v-2.8h-3v2.8h-3z' },
  circlet: { f: 'M3.5 17l1.6-7.5 3.7 3.6L12 7.6l3.2 5.5 3.7-3.6 1.6 7.5zM3.5 18.6h17v2.2h-17z' },
  sun: { s: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1' },
  snow: { s: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5M3.5 10.5l3.8-.6-1.3-3.6M20.5 13.5l-3.8.6 1.3 3.6M3.5 13.5l3.8.6-1.3 3.6M20.5 10.5l-3.8-.6 1.3-3.6', w: 1.5 },
  rain: { s: 'M7 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19 8.5a3.3 3.3 0 0 1-.5 6.5zM8 18l-1.2 3M12 18l-1.2 3M16 18l-1.2 3' },
  scales: { s: 'M12 3v18M7 21h10M4 7h16M6.5 7 3.5 14a3 3 0 0 0 6 0zM17.5 7l-3 7a3 3 0 0 0 6 0zM12 3l-1.5 2h3z' },
  hammer: { s: 'M14.5 4.5 19.5 9.5 17 12l-5-5zM12.5 9.5 4 18a1.4 1.4 0 0 0 2 2l8.5-8.5M15 3l2-1 5 5-1 2' },
  seal: { f: 'M12 2.5c1.3 1.1 2.9.7 3.9 1.9s.6 2.8 1.6 4 2.5 1.7 2.5 3.6-1.5 2.5-2.5 3.6-.6 2.8-1.6 4-2.6.8-3.9 1.9c-1.3-1.1-2.9-.7-3.9-1.9s-.6-2.8-1.6-4S4 13.9 4 12s1.5-2.5 2.5-3.6.6-2.8 1.6-4S10.7 3.6 12 2.5zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z', even: true },
  book: { s: 'M12 6.5C9.5 4.8 6.5 4.5 3 5v13c3.5-.5 6.5-.2 9 1.5 2.5-1.7 5.5-2 9-1.5V5c-3.5-.5-6.5-.2-9 1.5zM12 6.5v13' },
  ship: { s: 'M3 15h18l-2.5 5h-13zM12 3v12M12 4l6 8h-6M12 6l-5 6h5' },
  close: { s: 'M6 6l12 12M18 6 6 18', w: 2.2 },
};
export const icon = (name, cls = '') => {
  const i = ICON[name] ?? ICON.scroll;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${i.f ? `<path d="${i.f}" fill="currentColor"${i.even ? ' fill-rule="evenodd"' : ''}/>` : `<path d="${i.s}" fill="none" stroke="currentColor" stroke-width="${i.w ?? 1.8}" stroke-linecap="round" stroke-linejoin="round"/>`}</svg>`;
};
export const symbols = () => Object.entries(ICON).map(([k, i]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${i.f ? `<path d="${i.f}" fill="currentColor"${i.even ? ' fill-rule="evenodd"' : ''}/>` : `<path d="${i.s}" fill="none" stroke="currentColor" stroke-width="${i.w ?? 1.9}" stroke-linecap="round" stroke-linejoin="round"/>`}</symbol>`).join('');

// What each event looks like, and whether it earns a place in the chronicle (the rest only flash on the map).
const V = '#a3361f', L = '#27466e', G = '#b3852c', I = '#6a5032', T = '#2b7d7a';
export const KIND = {
  battle: ['swords', V, 1], clash: ['swords', V, 1], fighting: ['swords', '#c2541f', 1], storm: ['swords', V, 0], capture: ['castle', L, 1], siege: ['tower', '#8c6b3f', 0],
  revolt: ['flame', '#c2541f', 1], founded: ['crown', G, 1], split: ['crown', V, 1], fallen: ['skull', '#3a2816', 1], death: ['skull', '#5a4630', 1], crowned: ['crown', G, 1],
  plot: ['dagger', '#5a4630', 1], coup: ['dagger', V, 1], turncoat: ['dagger', V, 1], intrigue: ['dagger', '#5a4630', 1], horde: ['bow', V, 1], raid: ['bow', '#8c6b3f', 1],
  plague: ['skull', '#4f6b3a', 1], famine: ['wheat', '#9a7a2a', 1], hunger: ['wheat', '#9a5a2a', 1], earthquake: ['quake', I, 1], flood: ['rain', '#3d6b8c', 1],
  power: ['star', G, 1], war: ['swords', V, 1], peace: ['scroll', T, 1], 'peace.refused': ['scroll', I, 0], alliance: ['rings', L, 1], vassal: ['scroll', I, 1], broke: ['coin', '#8c6b3f', 0],
  guild: ['dagger', '#3a2816', 1], 'army.raised': ['banner', L, 0], 'army.destroyed': ['skull', V, 1], capital: ['crown', I, 0], heir: ['crown', G, 0],
  marriage: ['rings', G, 1], 'match.refused': ['rings', I, 0], birth: ['circlet', G, 1], regency: ['crown', I, 1], vizier: ['scroll', I, 0], reform: ['seal', L, 1], feast: ['coin', G, 0],
  epithet: ['quill', I, 1], built: ['hammer', '#8c6b3f', 1], invention: ['book', L, 1], season: ['sun', L, 1], toll: ['snow', '#5d7f86', 1], golden: ['sun', G, 1], decline: ['skull', I, 1],
  poverty: ['wheat', I, 1], charter: ['seal', V, 1], uprising: ['flame', V, 1], commune: ['banner', T, 1], separatist: ['banner', V, 1], broken: ['scroll', V, 1],
  dispute: ['scales', L, 1], verdict: ['scales', L, 1], ceded: ['scales', T, 1], defied: ['scales', V, 1], 'age.started': ['scroll', L, 1], 'age.ended': ['crown', G, 1],
};
const WEATHER_ICON = { snow: 'snow', rains: 'rain', heat: 'sun', harvest: 'wheat' };
export const kindOf = (e) => {
  if (e.type === 'death' && e.cause === 'assassin') return ['dagger', V, 1];
  const k = KIND[e.type] ?? ['scroll', I, 0];
  if (e.weather) return [WEATHER_ICON[e.weather] ?? k[0], k[1], k[2]];
  return k;
};
export const worth = (e) => !!kindOf(e)[2] && !e.minor;

// ---------- bits of markup ----------
export const colorOf = (id) => S.s?.realms[id]?.color ?? 'transparent';
export const ink = (hex, k = 0.5) => {
  const n = parseInt(String(hex).slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k + 40 * (1 - k)));
  return `rgb(${c.join(',')})`;
};
export const chip = (id) => `<span class="chip" data-realm="${id}"><i class="shield" style="--c:${colorOf(id)}"></i>${esc(S.s.realms[id]?.short ?? id)}</span>`;
export const personChip = (c) => (c ? `<span class="chip person" data-char="${c.id}">${esc(c.name)}${c.epithet ? ` <i>${esc(c.epithet)}</i>` : ''}</span>` : '');
export const pips = (n, max) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">●</span>`).join('')}</span>`;
export const meter = (v, color) => `<span class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span>`;
export const sign = (n) => `${(n ?? 0) >= 0 ? '+' : '−'}${Math.abs(Math.round(n ?? 0))}`;
export const months = (n) => `${n} ${n === 1 ? 'month' : 'months'}`;
export const men = (k) => (k < 0.05 ? '0' : k < 0.95 ? `${Math.max(1, Math.round(k * 10)) * 100}` : `${Math.round(k)}k`);
export const loyalColor = (v) => (v < 30 ? '#c2541f' : v < 55 ? '#b3852c' : '#4f7a3a');
