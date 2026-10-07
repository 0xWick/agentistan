// Portraits for everyone the world knows, drawn by code like a manuscript miniature: a bust in a gilded roundel, the
// headgear of their land and rank, the beard or veil of their age. The same person always gets the same face.
// Famous figures may have a painted portrait in /art/people/ instead (see paintedFor).

const SKIN = { latin: '#f2d4b4', greek: '#efcfac', georgian: '#eccaa6', armenian: '#e6c19c', magyar: '#f2d4b4', slavic: '#f1d3b2', persian: '#e6bf98', turk: '#e4bf96',
  kurd: '#e2bb92', arab: '#dcb088', berber: '#d6a882', afghan: '#d9ad86', punjabi: '#c99a72', sindhi: '#c4936a', kashmiri: '#dcb48c', rajput: '#bf8b62', hindustani: '#b9845b',
  bengali: '#b07b52', nubian: '#8a5a3c', chinese: '#eccb98', mongol: '#e2b886', steppe: '#e0b98c',
  frankish: '#f2d4b4', english: '#f4d8ba', celtic: '#f5dcc2', iberian: '#ecc8a2', german: '#f3d6b8', westslav: '#f2d5b6', norse: '#f6dcc4', baltic: '#f4d9bd', rus: '#f2d4b4', alan: '#ecc9a4',
  deccani: '#b3804f', tamil: '#9e6c45', sinhala: '#a8744b', burmese: '#c99a6a', khmer: '#bd8c5e', viet: '#e3bf8e', malay: '#c08e60', korean: '#eccb9c', japanese: '#efcf9e', tibetan: '#c99868',
  mande: '#5e3b26', sudanic: '#6a4329', forest: '#5a3824', ethiopian: '#7e5236', swahili: '#7a4e34', shona: '#5c3a25',
  roman: '#ecc9a2', punic: '#dcb48a', hellenic: '#e9c7a0', gaulish: '#f2d6b8', celtiberian: '#e8c39c', germanic: '#f5dcc4', thracian: '#eccaa4', illyrian: '#ecc8a2', scythian: '#e8c49c',
  iranian: '#dfb890', mauryan: '#b3804f', andhra: '#a8744b', sangam: '#9e6c45', lankan: '#a8744b', han: '#eccb98', xiongnu: '#e0b386', sabaean: '#c9986a', nabataean: '#d4a77c', kushite: '#6e4630',
  numidian: '#c99a6e', egyptian: '#c4936a', orontid: '#e2bd96', kartvel: '#eccaa6', briton: '#f5dcc2', gojoseon: '#eccb9c', aulac: '#e0b98a', yue: '#e3bf8e', pyu: '#c99a6a', saka: '#e2b886',
  british: '#f4d8ba', french_m: '#f2d4b4', german_m: '#f3d6b8', russian_m: '#f2d4b4', italian_m: '#ecc9a2', iberian_m: '#ecc8a2', turkish_m: '#e2bd96', arab_m: '#d8ae86', persian_m: '#dfb890', indian_m: '#b07b52',
  dutch_m: '#f4d8ba', slav_m: '#f2d4b4', baltic_m: '#f5dac0', caucasian_m: '#e6c19c', turkestan_m: '#e2bd92', mongol_m: '#e6c08e', tibetan_m: '#d9ae80', albanian_m: '#ecc9a2',
  chinese_m: '#eccb98', japanese_m: '#efcf9e', korean_m: '#eccb9c', southslav_m: '#eccaa4', greek_m: '#e9c7a0', romanian_m: '#ecc8a2', magyar_m: '#f0d0ae', nordic_m: '#f6dcc4', african_m: '#5e3b26', sea_m: '#c08e60', afghan_m: '#d9ad86' };
const HAIR = ['#2a1d14', '#3a2616', '#1d1712', '#4a3220'];
const EAST = new Set(['chinese', 'mongol', 'steppe', 'korean', 'japanese', 'viet', 'tibetan', 'han', 'xiongnu', 'gojoseon', 'aulac', 'yue', 'saka', 'chinese_m', 'japanese_m', 'korean_m', 'mongol_m', 'tibetan_m']);
const WEST = new Set(['latin', 'magyar', 'slavic', 'greek', 'georgian', 'armenian', 'nubian', 'frankish', 'english', 'celtic', 'iberian', 'german', 'westslav', 'norse', 'baltic', 'rus', 'alan', 'ethiopian', 'roman', 'punic', 'hellenic', 'gaulish', 'celtiberian', 'germanic', 'thracian', 'illyrian', 'scythian', 'orontid', 'kartvel', 'briton', 'british', 'french_m', 'german_m', 'russian_m', 'italian_m', 'iberian_m', 'southslav_m', 'greek_m', 'romanian_m', 'magyar_m', 'nordic_m', 'dutch_m', 'slav_m', 'baltic_m', 'caucasian_m', 'albanian_m']);
const NOMADS = new Set(['mongol', 'steppe', 'xiongnu', 'saka', 'scythian']);
const INDIA = new Set(['rajput', 'hindustani', 'bengali', 'kashmiri', 'punjabi', 'sindhi', 'deccani', 'tamil', 'sinhala', 'burmese', 'khmer', 'malay', 'mauryan', 'andhra', 'sangam', 'lankan', 'pyu', 'indian_m', 'sea_m']);

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// The dress of 1914: uniforms for monarchs and generals, suits for presidents and ministers.
const isModern = (cu) => cu === 'british' || cu.endsWith('_m');
const CIVIL = /President|Minister|Premier|Chairman|Leader|Chancellor|Secretary|Commissar|Regent|Chief/;
const UNIFORM = { british: '#7a6a45', french_m: '#6f86a6', german_m: '#6b6e5a', russian_m: '#6e6b4c', italian_m: '#7a7a62', turkish_m: '#7a6a4a', japanese_m: '#6a6440', magyar_m: '#6b6e5a' };
const COVERED = new Set(['arab_m', 'persian_m', 'afghan_m', 'turkish_m']); // women's heads covered in public

// c: a character; color: their realm's colour; age: years; uid: a unique id for gradient names.
export function portrait(c, { color = '#6a5032', age = 40, size = 64, uid = '' } = {}) {
  const culture = c.culture ?? 'persian', h = hash(`${c.id}${c.name}`), r = (n) => ((h >>> n) & 255) / 255;
  const female = !!c.female, child = age < 14, old = age >= 58;
  const skin = SKIN[culture] ?? SKIN.persian, hair = old ? (age > 68 ? '#e8e2d6' : '#9a9184') : HAIR[h % HAIR.length];
  const robe = shade(color, 0.85), robe2 = shade(color, 0.6), gold = '#c9a03c', id = `p${uid}${h % 99999}`;
  const role = c.role === 'ruler' ? 'ruler' : c.role === 'heir' ? 'heir' : c.role === 'general' ? 'general' : c.role === 'vizier' ? 'vizier' : c.role === 'consort' ? 'consort' : child ? 'child' : 'noble';
  const fw = 10.5 + r(3) * 2; // face half-width
  const modern = isModern(culture), civil = modern && CIVIL.test(c.title ?? ''), uniform = modern && !female && !child && !civil && ['ruler', 'heir', 'general'].includes(role);
  const uni = UNIFORM[culture] ?? '#5d5a48';
  const parts = [];
  // the roundel
  parts.push(`<defs><radialGradient id="${id}g" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="#f6ecd2"/><stop offset="1" stop-color="${shade(color, 1.25)}"/></radialGradient><clipPath id="${id}c"><circle cx="32" cy="32" r="29"/></clipPath></defs>`);
  parts.push(`<circle cx="32" cy="32" r="31" fill="${gold}"/><circle cx="32" cy="32" r="29" fill="url(#${id}g)"/>`);
  const body = [];
  // shoulders and robe, with a collar
  if (modern && !female) {
    body.push(`<path d="M6 66c1-14 10-20 26-20s25 6 26 20z" fill="${uniform ? uni : child ? robe : '#2b2f38'}"/>`);
    if (uniform) body.push(`<path d="M25 45h14v5h-14z" fill="${shade(uni, 0.8)}"/>`, `<path d="M10 54h8M46 54h8" stroke="${gold}" stroke-width="2.6"/>`, ...[54, 59, 64].map((y) => `<circle cx="32" cy="${y}" r="1" fill="${gold}"/>`), role === 'ruler' ? `<path d="M20 50l24 14" stroke="${shade(color, 1.1)}" stroke-width="2.4"/>` : '');
    else if (!child) body.push(`<path d="M26 46l6 11 6-11z" fill="#f3ecdc"/>`, `<path d="M31 48.5l1 9 1-9z" fill="${shade(color, 0.6)}"/>`, `<path d="M26 46l4 14M38 46l-4 14" stroke="#1b1e25" stroke-width="1"/>`);
  } else {
  body.push(`<path d="M6 66c1-14 10-20 26-20s25 6 26 20z" fill="${robe}"/>`);
  body.push(modern ? `<path d="M24 47c2 5 5 8 8 8s6-3 8-8" fill="none" stroke="#f3ecdc" stroke-width="2.2"/>` : `<path d="M24 47c2 5 5 8 8 8s6-3 8-8" fill="none" stroke="${gold}" stroke-width="1.6"/>`);
  }
  if (!modern && role === 'general') body.push(`<path d="M10 66c1-11 8-16 22-16s21 5 22 16" fill="none" stroke="${shade(robe, 0.7)}" stroke-width="1" stroke-dasharray="2 1.6"/>`, `<path d="M14 54h36" stroke="#9aa0a8" stroke-width="2.4" opacity="0.7"/>`);
  if (!modern && role === 'ruler') body.push(`<path d="M32 50v16" stroke="${gold}" stroke-width="1.4"/>`, `<circle cx="32" cy="57" r="1.8" fill="${gold}"/>`);
  // neck and face
  body.push(`<path d="M27 40h10v8c-3 2-7 2-10 0z" fill="${shade(skin, 0.9)}"/>`);
  const fy = 30, fh = 13 + r(5) * 1.5;
  // hair behind the head
  const veiled = female && !child && (modern ? COVERED.has(culture) : !NOMADS.has(culture) && culture !== 'chinese');
  const veilColor = WEST.has(culture) ? '#f3ecdc' : shade(color, 1.15);
  if (veiled) body.push(`<path d="M${32 - fw - 4} ${fy + 2}c-1-14 ${fw + 4} -19 ${fw + 4} -19s${fw + 5} 5 ${fw + 4} 19l4 34h${-2 * fw - 16}z" fill="${veilColor}"/>`); // the veil falls behind the face
  else if (female) body.push(`<path d="M${32 - fw - 3} ${fy}c0-12 6-17 ${fw + 3} -17s${fw + 3} 5 ${fw + 3} 17v14c-3 3-6 3-8 0h${-2 * fw + 4}c-2 3-5 3-8 0z" fill="${hair}"/>`);
  body.push(`<ellipse cx="32" cy="${fy}" rx="${fw}" ry="${fh}" fill="${skin}"/>`);
  // eyes, brows, nose, mouth
  const ey = fy - 1.5, ex = fw * 0.42, slant = EAST.has(culture) ? 0.9 : 0;
  for (const s of [-1, 1]) {
    body.push(`<path d="M${32 + s * ex - 2.4} ${ey + (s > 0 ? -slant : slant) * 0.3}q2.4 -1.6 4.8 0q-2.4 1.4 -4.8 0z" fill="#2a1d14"/>`);
    body.push(`<path d="M${32 + s * ex - 2.8} ${ey - 3}q2.8 -${1.4 + slant * 0.4} 5.6 ${s > 0 ? -slant * 0.5 : slant * 0.5}" fill="none" stroke="${old ? '#8a8276' : hair}" stroke-width="${female ? 0.8 : 1.3}" stroke-linecap="round"/>`);
  }
  body.push(`<path d="M32 ${ey + 1}q-1.4 4.4 -0.6 5.6q1.2 0.6 2 0" fill="none" stroke="${shade(skin, 0.7)}" stroke-width="0.9" stroke-linecap="round"/>`);
  body.push(`<path d="M${29.4} ${fy + 8.6}q2.6 1.2 5.2 0" fill="none" stroke="${shade(skin, 0.55)}" stroke-width="1.1" stroke-linecap="round"/>`);
  if (female) body.push(`<circle cx="${32 - fw * 0.55}" cy="${fy + 4}" r="1.8" fill="#d98878" opacity="0.35"/><circle cx="${32 + fw * 0.55}" cy="${fy + 4}" r="1.8" fill="#d98878" opacity="0.35"/>`);
  if (old) body.push(`<path d="M${32 - fw * 0.7} ${fy + 2}q1.6 1.4 3.2 0M${32 + fw * 0.7 - 3.2} ${fy + 2}q1.6 1.4 3.2 0" fill="none" stroke="${shade(skin, 0.75)}" stroke-width="0.6"/>`);
  // beards and moustaches by custom
  if (!female && !child && age >= 18) {
    const beard = modern ? (EAST.has(culture) ? (r(9) < 0.4 ? 'moustache' : 'none') : r(9) < 0.55 ? 'moustache' : r(9) < 0.75 ? 'short' : 'none') : EAST.has(culture) ? (culture === 'chinese' ? 'goatee' : 'drooping') : WEST.has(culture) && culture !== 'greek' && r(9) < 0.5 ? 'short' : INDIA.has(culture) && r(9) < 0.4 ? 'moustache' : 'full';
    const b = old ? hair : shade(hair, 1.05);
    if (beard === 'full') body.push(`<path d="M${32 - fw + 0.6} ${fy + 1}c0 ${9 + r(11) * 6} 6 ${14 + r(11) * 5} ${fw - 0.6} ${14 + r(11) * 5}s${fw - 0.6} -${5 + r(11) * 5} ${fw - 0.6} -${14 + r(11) * 5}c-2 4 -5 6 -${fw - 0.6} 6s-${fw - 2.6} -2 -${fw - 0.6} -6z" fill="${b}"/>`, `<path d="M28.6 ${fy + 7.6}q3.4 -1.6 6.8 0" fill="none" stroke="${shade(skin, 0.55)}" stroke-width="1"/>`);
    if (beard === 'short') body.push(`<path d="M${32 - fw + 1} ${fy + 3}c1 7 5 10 ${fw - 1} 10s${fw - 2} -3 ${fw - 1} -10c-3 3 -6 4 -${fw - 1} 4s-${fw - 2} -1 -${fw - 1} -4z" fill="${b}"/>`);
    if (beard === 'goatee') body.push(`<path d="M30 ${fy + 9.5}q2 7 4 0z" fill="${b}"/>`, `<path d="M28 ${fy + 7}q-2 3 -3 5M36 ${fy + 7}q2 3 3 5" fill="none" stroke="${b}" stroke-width="0.9"/>`);
    if (beard === 'drooping') body.push(`<path d="M28.4 ${fy + 7.2}q-1.8 2 -2.2 7M35.6 ${fy + 7.2}q1.8 2 2.2 7" fill="none" stroke="${b}" stroke-width="1.6" stroke-linecap="round"/>`, `<path d="M28.4 ${fy + 7.2}q3.6 -1.4 7.2 0" fill="none" stroke="${b}" stroke-width="1.4"/>`);
    if (beard !== 'goatee' && beard !== 'drooping' && beard !== 'none') body.push(`<path d="M28.2 ${fy + 7.4}q1.9 -1.6 3.8 -0.2q1.9 -1.4 3.8 0.2" fill="none" stroke="${b}" stroke-width="1.5" stroke-linecap="round"/>`);
  }
  body.push(modern ? modernHat({ culture, role, female, child, fw, fy, hair, gold, color, uniform, uni, veiled, veilColor }) : headgear({ culture, role, female, child, fw, fy, hair, gold, color, r, old, veilColor }));
  parts.push(`<g clip-path="url(#${id}c)">${body.join('')}</g>`);
  parts.push(`<circle cx="32" cy="32" r="29" fill="none" stroke="#3a2816" stroke-width="1.2"/>`);
  return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" style="width:${size}px;height:${size}px" aria-hidden="true">${parts.join('')}</svg>`;
}

function modernHat({ culture, role, female, child, fw, fy, hair, gold, color, uniform, uni, veiled, veilColor }) {
  const top = fy - 13.5, L = 32 - fw - 1.5, W = (fw + 1.5) * 2;
  const hairCap = `<path d="M${L} ${top + 7}c0-9 ${W / 2} -11 ${W / 2} -11s${W / 2} 2 ${W / 2} 11c-3-4 -${W - 4} -4 -${W} 0z" fill="${hair}"/>`;
  if (child) return hairCap;
  if (female) {
    const tiara = role === 'ruler' || role === 'consort' ? `<path d="M${L + 4} ${top - 1}q${W / 2 - 4} -6 ${W - 8} 0" fill="none" stroke="${gold}" stroke-width="1.8"/><circle cx="32" cy="${top - 4}" r="1.5" fill="#f3ecdc" stroke="${gold}" stroke-width="0.5"/>` : '';
    if (veiled) return `<path d="M${L} ${top + 7}c0-9 ${W / 2} -11 ${W / 2} -11s${W / 2} 2 ${W / 2} 11c-4-4 -${W - 4} -4 -${W} 0z" fill="${veilColor}"/>` + tiara;
    return `<ellipse cx="32" cy="${top + 1}" rx="${fw + 2}" ry="6.5" fill="${hair}"/><ellipse cx="32" cy="${top - 5}" rx="${fw - 3}" ry="5" fill="${hair}"/>` + tiara; // hair pinned up, 1910s
  }
  if (culture === 'turkish_m') return `<path d="M${L + 3} ${top + 5}l2-12h${W - 10}l2 12z" fill="#a3261f"/><path d="M${L + W - 6} ${top - 7}q4 4 3 10" fill="none" stroke="#1d1712" stroke-width="1.2"/>`; // the fez
  if (culture === 'arab_m') return `<path d="M${L - 3} ${top + 7}c0-11 ${W / 2 + 3} -13 ${W / 2 + 3} -13s${W / 2 + 3} 2 ${W / 2 + 3} 13l2 24h${-W - 10}z" fill="#f3ecdc"/><path d="M${L} ${top + 1}q${W / 2} -4 ${W} 0" fill="none" stroke="#1d1712" stroke-width="2.2"/>`; // keffiyeh and agal
  if (culture === 'persian_m' || culture === 'afghan_m') return `<path d="M${L + 2} ${top + 5}c0-9 ${W / 2 - 2} -12 ${W / 2 - 2} -12s${W / 2 - 2} 3 ${W / 2 - 2} 12z" fill="#2a2420"/>${role === 'ruler' ? `<circle cx="32" cy="${top - 2}" r="1.8" fill="#a3361f" stroke="${gold}" stroke-width="0.6"/>` : ''}`; // the lambskin hat
  if (culture === 'indian_m') return `<path d="M${L - 1} ${top + 5}c0-9 ${W / 2 + 1} -12 ${W / 2 + 1} -12s${W / 2 + 1} 3 ${W / 2 + 1} 12c-2 3 -${W / 2 - 1} 4 -${W / 2 + 1} 4s-${W / 2 - 1} -1 -${W / 2 + 1} -4z" fill="${role === 'ruler' ? '#e2a23c' : '#e8dcc4'}"/>`;
  if (uniform) return hairCap + `<path d="M${L - 1} ${top + 4}c0-7 ${W / 2 + 1} -10 ${W / 2 + 1} -10s${W / 2 + 1} 3 ${W / 2 + 1} 10z" fill="${uni}"/><path d="M${L - 1} ${top + 4}h${W + 2}" stroke="${role === 'general' ? '#a3361f' : gold}" stroke-width="2.2"/><path d="M${L + 2} ${top + 6}q${W / 2 - 2} 4 ${W - 4} 0" fill="#1d1712"/>`; // a peaked cap
  return hairCap; // bare-headed
}

function headgear({ culture, role, female, child, fw, fy, hair, gold, color, r, old, veilColor }) {
  const top = fy - 13.5, L = 32 - fw - 1.5, W = (fw + 1.5) * 2;
  const jewel = (x, y, c = '#a3361f') => `<circle cx="${x}" cy="${y}" r="1.7" fill="${c}" stroke="${gold}" stroke-width="0.6"/>`;
  const turban = (cloth, h = 9, plume) => `<path d="M${L - 1} ${top + 5}c0-${h} ${W / 2 + 1} -${h + 3} ${W / 2 + 1} -${h + 3}s${W / 2 + 1} 3 ${W / 2 + 1} ${h + 3}c-2 3 -${W / 2 - 1} 4 -${W / 2 + 1} 4s-${W / 2 - 1} -1 -${W / 2 + 1} -4z" fill="${cloth}"/>
    <path d="M${L} ${top + 1}q${W / 2} -5 ${W} 0M${L + 1} ${top - 3}q${W / 2 - 1} -4 ${W - 2} 1" fill="none" stroke="${shade(cloth, 0.8)}" stroke-width="0.9"/>${plume ? `${jewel(32, top - 1)}<path d="M32 ${top - 2}q3 -7 6 -9" fill="none" stroke="${plume}" stroke-width="2" stroke-linecap="round"/>` : ''}`;
  if (child) return `<path d="M${L + 1} ${top + 6}c1-9 ${W / 2 - 1} -10 ${W / 2 - 1} -10s${W / 2 - 2} 1 ${W / 2 - 1} 10c-4 -3 -${W - 4} -3 -${W - 2} 0z" fill="${hair}"/>`;
  if (female) {
    if (NOMADS.has(culture)) return `<path d="M${L + 2} ${top + 5}c0-5 ${W / 2 - 2} -6 ${W / 2 - 2} -6s${W / 2 - 2} 1 ${W / 2 - 2} 6z" fill="${shade(color, 0.6)}"/><path d="M28 ${top}l2-22h4l2 22z" fill="${shade(color, 0.5)}"/><path d="M27 ${top - 22}h10" stroke="${gold}" stroke-width="2"/>${jewel(32, top - 4)}<path d="M${L + 1} ${top + 6}v12M${L + W - 1} ${top + 6}v12" stroke="${gold}" stroke-width="1" stroke-dasharray="1.4 1.2"/>`; // the boqta
    if (culture === 'chinese') return `<path d="M${L + 1} ${top + 5}c0-8 ${W / 2 - 1} -9 ${W / 2 - 1} -9s${W / 2 - 1} 1 ${W / 2 - 1} 9z" fill="${hair}"/><path d="M${L - 3} ${top - 1}q${W / 2 + 3} -9 ${W + 6} 0" fill="none" stroke="${gold}" stroke-width="2.4"/>${jewel(32, top - 4, '#2b7d7a')}${jewel(L, top + 1, '#2b7d7a')}${jewel(L + W, top + 1, '#2b7d7a')}`;
    const veil = `<path d="M${L} ${top + 7}c0-9 ${W / 2} -11 ${W / 2} -11s${W / 2} 2 ${W / 2} 11c-4-4 -${W - 4} -4 -${W} 0z" fill="${veilColor}"/><path d="M${L + 1} ${top + 6}q${W / 2 - 1} -6 ${W - 2} 0" fill="none" stroke="${shade(veilColor, 0.82)}" stroke-width="0.8"/>`; // its edge across the brow
    const crown = role === 'ruler' || role === 'consort' ? (WEST.has(culture) ? `<path d="M${L + 2} ${top + 1}l2-6 3 4 3-6 3 6 3-6 3 6 3-4 2 6z" fill="${gold}"/>${jewel(32, top - 1)}` : `<path d="M${L + 2} ${top + 1}q${W / 2 - 2} -4 ${W - 4} 0" fill="none" stroke="${gold}" stroke-width="2.2"/>${jewel(32, top - 1)}`) : '';
    return veil + crown;
  }
  if (role === 'general') {
    if (EAST.has(culture)) return `<path d="M${L - 1} ${top + 7}c0-11 ${W / 2 + 1} -13 ${W / 2 + 1} -13s${W / 2 + 1} 2 ${W / 2 + 1} 13z" fill="#7a6a52"/><path d="M${L - 3} ${top + 7}h${W + 6}" stroke="#5a4a36" stroke-width="2.6"/><path d="M32 ${top - 6}v-6" stroke="#a3361f" stroke-width="2.4" stroke-linecap="round"/>`;
    if (WEST.has(culture)) return `<path d="M${L - 0.5} ${top + 8}c0-12 ${W / 2 + 0.5} -14 ${W / 2 + 0.5} -14s${W / 2 + 0.5} 2 ${W / 2 + 0.5} 14z" fill="#8f949a"/><path d="M32 ${top + 6}v8" stroke="#6f747a" stroke-width="2.6"/><path d="M${L} ${top + 8}h${W}" stroke="#6f747a" stroke-width="1.6"/>`;
    return `<path d="M${L - 0.5} ${top + 7}c0-10 ${W / 2 + 0.5} -16 ${W / 2 + 0.5} -16s${W / 2 + 0.5} 6 ${W / 2 + 0.5} 16z" fill="#8f949a"/><path d="M32 ${top - 9}v-4" stroke="#8f949a" stroke-width="1.6"/><path d="M${L} ${top + 7}h${W}" stroke="${gold}" stroke-width="1.6"/><path d="M${L - 1} ${top + 8}c0 8 2 13 4 15M${L + W + 1} ${top + 8}c0 8 -2 13 -4 15" fill="none" stroke="#7a7f86" stroke-width="2.2" stroke-dasharray="1.2 0.8"/>`; // a spangenhelm with mail
  }
  if (role === 'vizier') return EAST.has(culture) || culture === 'chinese' ? `<path d="M${L + 1} ${top + 5}h${W - 2}v-7h${-W + 2}z" fill="#1d1712"/><path d="M${L - 5} ${top + 1}h${W + 10}" stroke="#1d1712" stroke-width="1.6"/>` : WEST.has(culture) ? `<path d="M${L + 1} ${top + 5}c0-6 ${W / 2 - 1} -8 ${W / 2 - 1} -8s${W / 2 - 1} 2 ${W / 2 - 1} 8z" fill="${shade(color, 0.5)}"/>` : turban('#f3ecdc', 12);
  const royal = role === 'ruler', heir = role === 'heir';
  if (NOMADS.has(culture)) return `<path d="M${L - 1} ${top + 6}c0-9 ${W / 2 + 1} -14 ${W / 2 + 1} -14s${W / 2 + 1} 5 ${W / 2 + 1} 14z" fill="${shade(color, 0.7)}"/><path d="M${L - 3} ${top + 6}q${W / 2 + 3} -4 ${W + 6} 0v3q-${W / 2 + 3} -3 -${W + 6} 0z" fill="#6a4a2a"/>${royal ? jewel(32, top - 4, '#b3852c') : ''}`; // fur-brimmed hat
  if (culture === 'chinese') return royal ? `<path d="M${L - 4} ${top - 3}h${W + 8}v-3h${-W - 8}z" fill="#1d1712"/><path d="M${L + 2} ${top + 5}h${W - 4}v-8h${-W + 4}z" fill="#1d1712"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${L - 3 + i * ((W + 6) / 4)} ${top - 3}v6" stroke="${gold}" stroke-width="0.9" stroke-dasharray="1 1"/>`).join('')}` : `<path d="M${L + 2} ${top + 5}c0-6 ${W / 2 - 2} -9 ${W / 2 - 2} -9s${W / 2 - 2} 3 ${W / 2 - 2} 9z" fill="#1d1712"/><path d="M${L - 4} ${top + 2}l4-1M${L + W + 4} ${top + 2}l-4-1" stroke="#1d1712" stroke-width="1.6"/>`;
  if (culture === 'greek') return royal ? `<path d="M${L + 1} ${top + 4}c0-8 ${W / 2 - 1} -11 ${W / 2 - 1} -11s${W / 2 - 1} 3 ${W / 2 - 1} 11z" fill="${gold}"/>${jewel(32, top - 2, '#27466e')}${jewel(L + 4, top + 1)}${jewel(L + W - 4, top + 1)}<path d="M${L + 1} ${top + 4}v9M${L + W - 1} ${top + 4}v9" stroke="${gold}" stroke-width="1.2" stroke-dasharray="1.5 1"/>` : `<path d="M${L + 1} ${top + 5}c0-7 ${W / 2 - 1} -9 ${W / 2 - 1} -9s${W / 2 - 1} 2 ${W / 2 - 1} 9z" fill="${hair}"/>${heir ? `<path d="M${L + 2} ${top + 2}q${W / 2 - 2} -4 ${W - 4} 0" fill="none" stroke="${gold}" stroke-width="1.6"/>` : ''}`;
  if (WEST.has(culture)) {
    const hairCap = `<path d="M${L} ${top + 7}c0-9 ${W / 2} -11 ${W / 2} -11s${W / 2} 2 ${W / 2} 11c-3-4 -${W - 4} -4 -${W} 0z" fill="${hair}"/>`;
    if (royal) return hairCap + `<path d="M${L + 0.5} ${top + 2}l1-8 4 5 3.5-8 3.5 8 4-5 3.5 8 3.5-8 1 8z" fill="${gold}" transform="translate(${(W - 25) / 2} 0)"/>${jewel(32, top - 1)}`;
    if (heir) return hairCap + `<path d="M${L + 2} ${top + 2}q${W / 2 - 2} -3 ${W - 4} 0" fill="none" stroke="${gold}" stroke-width="1.8"/>`;
    return hairCap;
  }
  if (INDIA.has(culture)) return turban(royal ? '#e2a23c' : heir ? '#c9773a' : '#e8dcc4', 9, royal ? '#f3ecdc' : null);
  // the lands of the sultans: a turban, with a jewel and a plume for the ruler
  return turban(royal ? '#f3ecdc' : heir ? '#e8dcc4' : shade(color, 1.2), 10, royal ? '#a3361f' : null) + (royal && culture === 'turk' ? `<path d="M32 ${top - 6}v-6" stroke="${gold}" stroke-width="2"/>` : '');
}

// Painted portraits for the famous (made once, see tools/art.js). Keyed by name.
export const PAINTED = new Set();
// Only the real figures of history (famous), and the right one of two namesakes.
const OWNER = { 'muhammad-ii': 'khwarazm' };
export const paintedFor = (c) => (c?.famous && PAINTED.has(slug(c.name)) && (!OWNER[slug(c.name)] || OWNER[slug(c.name)] === c.realm) ? `/art/people/${slug(c.name)}.webp` : null);
export const slug = (n) => String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
