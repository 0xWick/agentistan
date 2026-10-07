// Players and the outside world. In the living world anyone may seize a free realm: the coup takes effect at the turn
// of the quarter, and from then on the player rules it from the council, every quarter, with the matters before him,
// his standing orders and his armies; what he leaves undecided, his vizier decides. (Private games, ?game=<id>, still
// work month by month, but they are no longer in the menu.) n8n carries the heralds (great events to Discord), the
// players' reminders, a daily digest, and the real sky over the great capitals into the world.
import { RULES as R } from '../web/silk/rules.js';
import { living, provincesOf, steersman, PROV, isGreat, dateText, cityOf, AGES, acceptsPeace, acceptsAlliance, menOf, prosperityOf } from '../web/silk/engine.js';
import { rngFor, usedNames, yearOf, atWar, pick } from '../web/silk/core.js';
import { brain, neighbours, bestWork } from '../web/silk/doctrine.js';
import { strength } from '../web/silk/economy.js';
import { personName, womanName, TEMPER_TEXT } from '../web/silk/names.js';
import { clean, makeLLM } from './agent.js';

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-type': 'application/json', 'cache-control': 'no-store' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const PACES = { quick: 3 * 60_000, hour: 60 * 60_000, evening: 4 * 3600_000 };
const KINDS = ['war', 'peace', 'ally', 'submit', 'independence', 'power', 'hire', 'build', 'claim', 'heir', 'abdicate', 'tactic', 'army'];
const DISCORD = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/; // the only address a reminder goes to
const COUP_EVERY = 6 * 3600_000; // one new throne per visitor in this time
const newToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hash(t) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function seatOf(era, token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const h = await hash(token), seats = era.get('seats') ?? {};
  const realm = Object.keys(seats).find((r) => seats[r].hash === h);
  return realm ? { realm, seat: seats[realm], seats } : null;
}
const publicSeats = (era, s) => Object.entries(era.get('seats') ?? {}).map(([realm, x]) => ({ realm, name: x.name, delegate: x.delegate, ready: x.ready === s.month || !!x.ended, since: x.since }));
// What the player's ruler must decide: peace offers, matches, verdicts, the realm's matters (a general's own choices stay his).
const quarterOf = (s) => Math.floor(s.month / 3);
const decisionsFor = (s, realm) => s.pending.filter((d) => d.realm === realm && d.char === steersman(s, s.realms[realm])?.id);
// Where the quarter stands: the reflection hour, then the council.
const phaseOf = (era) => (Date.now() < (era.meta.councilOpens ?? 0) ? 'reflection' : 'council');

// What the vizier would do, and why.
const WHY = {
  peace: { accept: 'Our side is the weaker: peace saves the army', refuse: 'We can still win this war' },
  alliance: { accept: 'A friend at our side is worth the promise', refuse: 'Their wars would become ours' },
  match: { accept: 'A marriage makes kin of a neighbour', refuse: 'Their word is poor, or we are at war' },
  verdict: { accept: 'Defying the arbiter would cost us our word', defy: 'We are strong enough to keep it' },
  pretender: { pay: 'Gold is cheaper than a civil war', hunt: 'A pretender alive is a war waiting', ignore: 'He has few friends; let him rot in exile' },
  ambition: { reward: 'A loyal general is worth the gold', dismiss: 'Better no general than a traitor at the head of an army', ignore: 'He talks; he will not act' },
  unrest: { grant: 'A little relief now saves a revolt later', garrison: 'Soldiers in the streets keep the peace', ignore: 'It will pass' },
  famine: { relief: 'The people will remember who fed them', ignore: 'The treasury cannot spare it' },
};
function advise(s, d) {
  const choice = brain.decide(s, d, rngFor('advice', d.id));
  return { choice, why: WHY[d.topic ?? d.kind]?.[choice] ?? '' };
}
function validActs(s, realm, list) {
  return (Array.isArray(list) ? list : []).slice(0, 24).filter((a) => KINDS.includes(a?.kind)).map((a) => ({
    kind: a.kind, ...(typeof a.target === 'string' && s.realms[a.target] ? { target: a.target } : {}), ...(typeof a.place === 'string' && PROV[a.place] ? { place: a.place } : {}),
    ...(Object.keys(R.works).includes(a.work) ? { work: a.work } : {}), ...(R.power.includes(a.power) ? { power: a.power } : {}), ...(a.say ? { say: clean(a.say, 24) } : {}),
    ...(typeof a.char === 'string' && s.chars[a.char]?.realm === realm ? { char: a.char } : {}),
    ...(typeof a.battle === 'string' && s.battles[a.battle] ? { battle: a.battle } : {}), ...(typeof a.tactic === 'string' ? { tactic: a.tactic.slice(0, 20) } : {}),
    ...(typeof a.army === 'string' && s.armies[a.army]?.realm === realm ? { army: a.army } : {}), ...(typeof a.order === 'string' ? { order: a.order.slice(0, 10) } : {}), ...(typeof a.plan === 'string' ? { plan: a.plan.slice(0, 20) } : {}),
  }));
}

export async function play(era, req, p, url) {
  const s = era.state();
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  // ---------- the lobby of private games (kept, but off the menu) ----------
  if (p === '/api/games' && req.method === 'GET') return json(200, (era.get('games') ?? []).slice(0, 30));
  if (p === '/api/games' && req.method === 'POST') {
    if (era.meta?.game) return json(400, { error: 'games are made from the living world' });
    const pace = PACES[body.pace] ?? PACES.hour, name = clean(body.name, 8).slice(0, 40) || 'A game of kings';
    const id = newToken().slice(0, 10);
    const res = await era.env.ERA.get(era.env.ERA.idFromName(`game:${id}`)).fetch('https://era/internal/era/start', { method: 'POST', headers: { 'x-realm-secret': era.env.REALM_SECRET ?? '', 'content-type': 'application/json' }, body: JSON.stringify({ pace, game: { id, name }, ageId: AGES[body.age] ? body.age : '1200' }) });
    if (!res.ok) return json(503, { error: 'the game could not be started' });
    era.put('games', [{ id, name, pace, created: Date.now() }, ...(era.get('games') ?? [])].slice(0, 50));
    return json(200, { id, name, pace, url: `/?game=${id}` });
  }
  if (!s) return null;
  // ---------- thrones ----------
  if (p === '/api/era/seats') return json(200, { seats: publicSeats(era, s), game: era.meta.game ?? null, month: s.month, next: era.meta.next, quarter: era.meta.quarter ? { opens: era.meta.councilOpens, ends: era.meta.next } : null });
  if (p === '/api/era/claim' && req.method === 'POST') {
    const seats = era.get('seats') ?? {}, r = s.realms[body.realm];
    if (!r || r.fallen || r.rebel || !provincesOf(s, r.id).length) return json(400, { error: 'no such realm' });
    if (seats[r.id] || s.players?.[r.id]) return json(409, { error: 'another ruler holds that throne' });
    if (body.token && (await seatOf(era, body.token))) return json(409, { error: 'you already hold a throne: one realm each' });
    const name = clean(body.name, 5).slice(0, 32);
    if (name.length < 2) return json(400, { error: 'a name, please' });
    if (era.meta.quarter && era.env.COUP_LIMIT !== 'off') { // one coup at a time from one place
      const ip = await hash(`${era.env.REALM_SECRET ?? ''}:${req.headers.get('cf-connecting-ip') ?? 'local'}`), recent = era.get('coups') ?? {};
      if ((recent[ip] ?? 0) > Date.now() - COUP_EVERY) return json(429, { error: 'one coup at a time: try again in a few hours' });
      for (const k of Object.keys(recent)) if (recent[k] < Date.now() - COUP_EVERY) delete recent[k];
      recent[ip] = Date.now();
      era.put('coups', recent);
    } else if (Object.keys(seats).length >= 12) return json(409, { error: 'this game is full' });
    const webhook = typeof body.webhook === 'string' && DISCORD.test(body.webhook.trim()) ? body.webhook.trim() : null;
    const token = newToken();
    seats[r.id] = { name, hash: await hash(token), since: era.meta.quarter ? Date.now() : s.month, delegate: 'me', webhook, ready: null, ended: false, lastSeen: Date.now() };
    era.put('seats', seats);
    if (era.meta.quarter) era.queue(s.month, 'seize', r.id, { name, female: !!body.female, temper: R.temper.ruler[body.temper] ? body.temper : 'conqueror', line: clean(body.line ?? '', 30).slice(0, 160) });
    era.broadcast({ t: 'seats', seats: publicSeats(era, s) });
    return json(200, { token, realm: r.id, name, coupAt: era.meta.next });
  }
  if (p === '/api/era/me' && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(404, { error: 'not seated' });
    return json(200, { realm: me.realm, name: me.seat.name, delegate: me.seat.delegate, ready: me.seat.ready === s.month || !!me.seat.ended, decisions: decisionsFor(s, me.realm), next: era.meta.next });
  }
  // ---------- the council ----------
  if (p === '/api/era/council' && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(404, { error: 'not seated' });
    me.seat.lastSeen = Date.now();
    era.put('seats', me.seats);
    const P = s.players?.[me.realm];
    return json(200, { realm: me.realm, name: me.seat.name, phase: phaseOf(era), opens: era.meta.councilOpens, ends: era.meta.next, ended: !!me.seat.ended, seized: !!P, missed: P?.missed ?? 0, grace: R.absence.grace,
      cards: decisionsFor(s, me.realm).map((d) => ({ ...d, advice: advise(s, d) })), draft: (era.get('orders') ?? {})[me.realm] ?? null, month: s.month, letters: lettersFor(era, me.realm), quota: { letters: LETTERS_PER_QUARTER, talks: TALKS_PER_QUARTER } });
  }
  if (p === '/api/era/orders' && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(403, { error: 'not seated' });
    if (phaseOf(era) !== 'council') return json(409, { error: 'the council is not open yet: this hour is for reflection' });
    const orders = era.get('orders') ?? {}, cards = decisionsFor(s, me.realm);
    const answers = Object.fromEntries(Object.entries(body.answers ?? {}).filter(([id, c]) => cards.some((d) => d.id === id && d.options.includes(c))));
    orders[me.realm] = { acts: validActs(s, me.realm, body.acts), answers, tax: ['low', 'normal', 'high'].includes(body.tax) ? body.tax : null, say: body.say ? clean(body.say, 24) : null, at: Date.now() };
    era.put('orders', orders);
    Object.assign(me.seat, { ended: !!body.end, lastSeen: Date.now() });
    era.put('seats', me.seats);
    if (body.end) era.broadcast({ t: 'seats', seats: publicSeats(era, s) });
    return json(200, { saved: true, ended: me.seat.ended, ends: era.meta.next });
  }
  if (['/api/era/letter', '/api/era/reply', '/api/era/talk'].includes(p) && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(403, { error: 'not seated' });
    if (p === '/api/era/talk') { const t = await talk(era, s, me, body.question ?? ''); return json(t.error ? 429 : 200, t); }
    if (p === '/api/era/letter') { const x = await sendLetter(era, s, me, body); return json(x.error ? 400 : 200, x); }
    const all = era.get('letters') ?? [], l = all.find((x) => x.id === body.id && x.to === me.realm);
    if (!l || !l.prop || l.answer) return json(400, { error: 'no such proposal, or it has been answered' });
    l.answer = body.answer === 'accept' ? 'accept' : 'decline';
    l.answered = true;
    if (l.answer === 'accept') era.queue(s.month, 'pact', me.realm, pactOf(l)); // carried out when the quarter turns
    const text = clean(body.text ?? '', 70).slice(0, 400);
    all.push({ id: newToken().slice(0, 10), from: me.realm, to: l.from, text: text || `${me.seat.name} ${l.answer === 'accept' ? 'accepts' : 'declines'} ${PROPOSALS[l.prop.kind]}.`, prop: null, q: quarterOf(s), m: s.month, at: Date.now(), by: me.seat.name, answer: null, reply: l.id });
    era.put('letters', all.slice(-400));
    return json(200, { answer: l.answer });
  }
  if (p === '/api/era/suggest' && req.method === 'POST') { // "fill it for me"
    const ip = await hash(`${era.env.REALM_SECRET ?? ''}:s:${req.headers.get('cf-connecting-ip') ?? 'local'}`), book = era.get('suggests') ?? {}, now = Date.now();
    const mine = book[ip] && book[ip].t > now - 3600_000 ? book[ip] : { t: now, n: 0 };
    if (mine.n >= 30) return json(429, { error: 'enough suggestions for this hour' });
    mine.n++;
    book[ip] = mine;
    for (const k of Object.keys(book)) if (book[k].t < now - 3600_000) delete book[k];
    era.put('suggests', book);
    if (body.what === 'seize') return json(200, await suggestSeize(era, s, body.realm));
    if (body.what === 'letter') {
      const me = await seatOf(era, body.token), to = s.realms[body.to];
      if (!me || !to) return json(400, { error: 'not seated, or no such realm' });
      const r = s.realms[me.realm], ruler = steersman(s, r), prop = PROPOSALS[body.prop] ?? null;
      const ai = await aiJSON(era, `You are the scribe of ${ruler?.title ?? ''} ${ruler?.name}, ruler of ${r.name}, in the year ${yearOf(s.month, s)}. Write the ruler's letter to the ruler of ${to.name} in at most 50 words: courteous or menacing as the situation suits, in the voice of the age, never modern.${prop ? ` It proposes ${prop}.` : ''} ${NO_RELIGION} Reply with JSON only: {"text":"..."}`,
        situationOf(era, s, me.realm), 220);
      return json(200, { text: clean(ai?.text, 55) || (prop ? `To the ruler of ${to.short}: I propose ${prop}. Let our realms profit from it.` : `To the ruler of ${to.short}: greetings from ${r.short}.`), by: ai?.text ? 'ai' : 'rules' });
    }
    if (body.what === 'orders') {
      const me = await seatOf(era, body.token);
      if (!me) return json(403, { error: 'not seated' });
      return json(200, await suggestOrders(era, s, me.realm, decisionsFor(s, me.realm)));
    }
    return json(400, { error: 'seize or orders' });
  }
  if (p === '/api/era/leave' && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(404, { error: 'not seated' });
    delete me.seats[me.realm];
    era.put('seats', me.seats);
    if (s.players?.[me.realm]) era.queue(s.month, 'leave', me.realm, true);
    era.broadcast({ t: 'seats', seats: publicSeats(era, s) });
    return json(200, { left: me.realm });
  }
  // ---------- private games: month by month ----------
  if (['/api/era/act', '/api/era/answer', '/api/era/ready', '/api/era/delegate'].includes(p) && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(403, { error: 'not seated' });
    const { realm, seat, seats } = me;
    if (p === '/api/era/act') {
      const acts = validActs(s, realm, body.acts).slice(0, 6);
      for (const a of acts) era.queue(s.month, 'act', realm, a); // the engine checks each one when the month turns
      if (['low', 'normal', 'high'].includes(body.tax)) era.queue(s.month, 'plan', realm, { tax: body.tax, by: 'player' });
      return json(200, { queued: acts.length, month: s.month });
    }
    if (p === '/api/era/answer') {
      const d = decisionsFor(s, realm).find((x) => x.id === body.id);
      if (!d || !d.options.includes(body.choice)) return json(400, { error: 'no such decision, or no such choice' });
      era.queue(s.month, 'answer', d.id, { choice: body.choice, say: body.say ? clean(body.say, 24) : undefined, by: 'player' });
      return json(200, { ok: true });
    }
    if (p === '/api/era/delegate') {
      if (!['me', 'ai', 'doctrine'].includes(body.to)) return json(400, { error: 'me, ai or doctrine' });
      seat.delegate = body.to;
      era.put('seats', seats);
      return json(200, { delegate: seat.delegate });
    }
    seat.ready = s.month; // ready: when every player is, the month turns at once
    era.put('seats', seats);
    const all = Object.values(seats).filter((x) => x.delegate === 'me');
    if (all.length && all.every((x) => x.ready === s.month)) { era.meta.next = Date.now() + 3000; era.put('meta', era.meta); era.ctx.storage.setAlarm(era.meta.next); }
    era.broadcast({ t: 'seats', seats: publicSeats(era, s) });
    return json(200, { ready: true, next: era.meta.next });
  }
  // ---------- the outside world, through n8n ----------
  if (p === '/api/era/skies') { // the capitals of the great powers, for n8n to read their real sky
    const big = living(s).map((r) => [r, provincesOf(s, r.id).length]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r]) => r.capital).filter((pid) => PROV[pid]);
    return json(200, { places: big.map((pid) => ({ pid, city: cityOf(s, pid), lat: PROV[pid].lat, lon: PROV[pid].lon })) });
  }
  if (p === '/internal/era/skies' && req.method === 'POST') {
    if (!era.authorized(req)) return json(403, { error: 'forbidden' });
    const places = Array.isArray(body.places) ? body.places : [], now = Array.isArray(body.current) ? body.current : [];
    let n = 0;
    places.forEach((pl, i) => {
      const c = now[i] ?? {}, code = +c.weather_code, t = +c.temperature_2m, wind = +c.wind_speed_10m;
      const kind = code >= 95 || wind >= 55 ? 'storm' : [63, 65, 66, 67, 81, 82].includes(code) ? 'rain' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : t >= 38 ? 'heat' : t <= -15 ? 'cold' : null;
      if (kind && PROV[pl.pid]) { era.queue(s.month, 'skies', pl.pid, { kind, tempC: Number.isFinite(t) ? t : null, city: clean(pl.city, 4) }); n++; }
    });
    return json(200, { queued: n });
  }
  if (p === '/api/era/digest') { // a day of the living world in a few lines, for the n8n daily digest
    const from = Math.max(0, s.month - 12), rows = era.sql.exec('SELECT events FROM months WHERE age = ? AND m >= ? ORDER BY m', era.meta.age, from).toArray();
    const great = rows.flatMap((r) => JSON.parse(r.events)).filter((e) => isGreat(e, s)).slice(-8);
    const top = living(s).map((r) => [r, provincesOf(s, r.id).length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const rulers = Object.values(era.get('seats') ?? {}).length;
    return json(200, { title: `A day in Agentistan: ${dateText(from, s)} to ${dateText(s.month, s)}`, text: [...great.map((e) => `• ${e.date}: ${e.text}`), '', `The great powers: ${top.map(([r, n]) => `${r.short} (${n} provinces)`).join(', ')}.${rulers ? ` ${rulers} realms are ruled by players.` : ''}`].join('\n').slice(0, 1800), url: era.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com' });
  }
  return null;
}

// ---------- "fill it for me": a usurper's name and line, the vizier's draft of the orders ----------
// The rules choose the moves (free, always there); the small AI model writes the words, while its allowance lasts.
const LINES = { conqueror: 'A soldier who means to water the horses in every river of the land', builder: 'A builder of roads and markets, tired of kings who only build tombs',
  diplomat: 'A patient player of marriages and treaties who has never lost a negotiation', just: 'A judge of the frontier towns, come to give the people the law they were promised',
  reformer: 'A clerk who read every ledger of the old court and found it rotten', miser: 'A merchant who counted the old crown\'s debts, and decided to collect them',
  paranoid: 'A survivor of three plots who trusts no one, least of all friends', hedonist: 'A lover of hunts and feasts who found the old court far too dull',
  tyrant: 'An iron hand that the old dynasty underestimated for the last time', negligent: 'A reluctant heir of chaos who would rather the vizier did the work' };
function suggester(era) {
  if (!era.env.LLM_API_KEY || era.env.CAST === 'off') return null;
  if (!era.suggestLLM) {
    era.suggestUsage = era.get('suggestUsage') ?? {};
    era.suggestLLM = makeLLM({ ...era.env, LLM_MODEL: era.env.PERSONA_MODEL || 'qwen/qwen3.8-27b', MAX_LLM_TOKENS_PER_DAY: '60000', MAX_LLM_CALLS_PER_DAY: '400', LLM_EXTRA: '{}' }, era.suggestUsage);
  }
  return era.suggestLLM;
}
async function aiJSON(era, system, user, maxTokens = 220) {
  const llm = suggester(era);
  if (!llm || llm.status().mode !== 'live') return null;
  try {
    const { message } = await llm.chat([{ role: 'system', content: system }, { role: 'user', content: user }], undefined, { max_tokens: maxTokens, temperature: 0.9, response_format: { type: 'json_object' }, maxWait: 12 });
    era.put('suggestUsage', era.suggestUsage);
    const m = String(message?.content ?? '').match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}
const NO_RELIGION = 'Keep religion out entirely: no gods, faiths, clergy, prayers or holy places.';
async function suggestSeize(era, s, realm) {
  const r = s.realms[realm];
  if (!r) return { error: 'no such realm' };
  const rng = rngFor('suggest', realm, Date.now()), female = rng() < 0.2, warring = living(s).some((o) => atWar(s, realm, o.id));
  const name = female ? womanName(rng, r.culture, usedNames(s)) : personName(rng, r.culture, usedNames(s));
  const temper = pick(rng, warring ? ['conqueror', 'conqueror', 'tyrant', 'paranoid', 'diplomat'] : ['builder', 'diplomat', 'just', 'reformer', 'conqueror', 'miser']);
  const ai = await aiJSON(era, `You write one line, at most 18 words, in which a usurper who has just seized a throne describes ${female ? 'herself' : 'himself'}: vivid, specific, in the spirit of the age and the place, never modern. ${NO_RELIGION} Reply with JSON only: {"line":"..."}`,
    `The year ${yearOf(s.month, s)}. The realm: ${r.name}, ${provincesOf(s, realm).length} provinces, ${r.culture} customs, ${warring ? 'at war' : 'at peace'}. The usurper: ${name}, temperament ${TEMPER_TEXT[temper][0]} (${TEMPER_TEXT[temper][1]}).`);
  return { name, female, temper, line: clean(ai?.line, 22) || LINES[temper], by: ai?.line ? 'ai' : 'rules' };
}
async function suggestOrders(era, s, realm, cards) {
  const r = s.realms[realm], who = steersman(s, r), plan = brain.planFor(s, realm, rngFor('suggest', s.month, realm, Date.now() % 997));
  const next = neighbours(s, realm).realms, acts = [], why = [];
  for (const a of plan.acts ?? []) {
    if (a.kind === 'war' && next.includes(a.target)) { acts.push({ kind: 'war', target: a.target }); why.push(`${s.realms[a.target].short} is weaker than us (strength ${Math.round(strength(s, a.target))} against our ${Math.round(strength(s, realm))}) and worth taking`); }
    if (a.kind === 'peace') { acts.push({ kind: 'peace', target: a.target }); why.push(`The war with ${s.realms[a.target]?.short} costs more than it brings`); }
    if (a.kind === 'ally') { acts.push({ kind: 'ally', target: a.target }); why.push(`${s.realms[a.target]?.short} would make a useful friend`); }
    if (a.kind === 'power' && !r.power) { acts.push({ kind: 'power', power: a.power }); why.push('The moment is right for the great gamble of the reign'); }
    if (a.kind === 'claim') { acts.push({ kind: 'claim', place: a.place }); why.push(`Our old claim to ${cityOf(s, a.place)} deserves an arbiter`); }
  }
  const work = bestWork(s, realm);
  if (work && r.gold > R.works[work.work].cost + 30 && !acts.some((a) => a.kind === 'war')) { acts.push({ kind: 'build', ...work }); why.push(`The treasury can pay for a ${work.work} at ${cityOf(s, work.place)}`); }
  const tax = plan.tax ?? 'normal';
  if (tax !== 'normal') why.push(tax === 'high' ? 'The treasury needs gold: taxes up' : 'The provinces grumble: taxes down');
  if (!acts.length) why.push('Hold steady: there is no war worth starting this quarter');
  const answers = Object.fromEntries(cards.map((d) => [d.id, advise(s, d).choice]));
  const ai = await aiJSON(era, `You are the vizier of a realm in a living historical world. In at most 45 words, advise your ruler why these orders suit this quarter, in your own voice; then give one line (at most 16 words) the ruler might proclaim to the chronicle. Never modern. ${NO_RELIGION} Reply with JSON only: {"counsel":"...","say":"..."}`,
    `The year ${yearOf(s.month, s)}. The realm: ${r.name}, ${provincesOf(s, realm).length} provinces, ${Math.round(r.gold)} gold. Ruler: ${who?.name}, ${TEMPER_TEXT[who?.temper]?.[0] ?? ''}. The drafted orders: ${why.join('; ')}.`, 260);
  const say = clean(ai?.say, 18);
  if (say) for (const a of acts) if (a.kind === 'war') a.say = say;
  return { acts, tax, answers, why, counsel: clean(ai?.counsel, 50) || null, say: say || null, by: ai ? 'ai' : 'rules' };
}

// ---------- letters between rulers, with a proposal or without ----------
const PROPOSALS = { alliance: 'an alliance', peace: 'peace', pay: 'that I pay you tribute', demand: 'that you pay me tribute', bow: 'that I become your client state', client: 'that you become my client state', gift: 'a gift of gold' };
const LETTERS_PER_QUARTER = 4, TALKS_PER_QUARTER = 6;
function pactOf(l) { // what a proposal does if it is accepted
  const { from, to, prop } = l, gold = Math.max(1, Math.min(R.players.maxTribute, Math.round(+prop?.gold || 5)));
  return { alliance: { kind: 'alliance', from, to }, peace: { kind: 'peace', from, to }, pay: { kind: 'tribute', from, to, gold }, demand: { kind: 'tribute', from: to, to: from, gold },
    bow: { kind: 'client', from, to }, client: { kind: 'client', from: to, to: from }, gift: { kind: 'gift', from, to, gold: Math.max(1, Math.min(500, Math.round(+prop?.gold || 10))) } }[prop?.kind] ?? null;
}
function aiAccepts(s, l) { // a ruler with no player reads a proposal
  const them = l.to, us = l.from, k = l.prop?.kind, near = neighbours(s, them).realms.includes(us);
  if (k === 'alliance') return !atWar(s, us, them) && acceptsAlliance(s, them, us);
  if (k === 'peace') return atWar(s, us, them) && acceptsPeace(s, them, us);
  if (k === 'pay' || k === 'gift') return !atWar(s, us, them);
  if (k === 'demand') return near && strength(s, them) < strength(s, us) * 0.5;
  if (k === 'bow') return !s.realms[us]?.overlord;
  if (k === 'client') return near && !s.realms[them]?.overlord && strength(s, them) < strength(s, us) * 0.35;
  return false;
}
function lettersFor(era, realm) {
  const all = era.get('letters') ?? [];
  return { inbox: all.filter((l) => l.to === realm).slice(-30), outbox: all.filter((l) => l.from === realm).slice(-20) };
}
function addLetter(era, l) { era.put('letters', [...(era.get('letters') ?? []), l].slice(-400)); return l; }
async function sendLetter(era, s, me, body) {
  const to = s.realms[body.to], prop = PROPOSALS[body.prop?.kind] ? { kind: body.prop.kind, gold: Math.round(+body.prop.gold || 0) || undefined } : null;
  if (!to || to.fallen || to.id === me.realm || !provincesOf(s, to.id).length) return { error: 'no such realm' };
  if (prop?.kind === 'peace' && !atWar(s, me.realm, to.id)) return { error: 'you are not at war with them' };
  if (prop?.kind === 'alliance' && atWar(s, me.realm, to.id)) return { error: 'make peace first' };
  const text = clean(body.text ?? '', 70).slice(0, 400);
  if (!text && !prop) return { error: 'a few words, or a proposal' };
  const all = era.get('letters') ?? [], q = quarterOf(s);
  if (all.filter((l) => l.from === me.realm && l.q === q && !l.reply).length >= LETTERS_PER_QUARTER) return { error: `${LETTERS_PER_QUARTER} letters a quarter: your scribes are worn out` };
  return { letter: addLetter(era, { id: newToken().slice(0, 10), from: me.realm, to: to.id, text, prop, q, m: s.month, at: Date.now(), by: me.seat.name, answer: null }) };
}
// At the turn of the quarter the courts with no player decide on their letters (the pacts take effect at once);
// afterwards their replies are written, in character while the AI allowance lasts.
function answerLetters(era, s) {
  const all = era.get('letters') ?? [], seats = era.get('seats') ?? {};
  for (const l of all) {
    if (l.answered || l.reply || seats[l.to] || !s.realms[l.to] || s.realms[l.to].fallen) continue;
    l.answered = true;
    const yes = l.prop ? aiAccepts(s, l) : null;
    if (l.prop) l.answer = yes ? 'accept' : 'decline';
    if (yes) era.queue(s.month, 'pact', l.to, pactOf(l));
    const r = s.realms[l.to], who = steersman(s, r);
    all.push({ id: newToken().slice(0, 10), from: l.to, to: l.from, text: l.prop ? `${who?.name ?? 'The court'} of ${r.short} ${yes ? 'accepts' : 'declines'} ${PROPOSALS[l.prop.kind]}.` : `The court of ${r.short} has read your letter.`, prop: null, q: quarterOf(s), m: s.month, at: Date.now(), by: who?.name ?? r.short, answer: null, reply: l.id, pen: true });
  }
  era.put('letters', all.slice(-400));
}
export async function penReplies(era) {
  const s = era.state(), all = era.get('letters') ?? [];
  let pens = 8;
  for (const l of all) {
    if (!l.pen || pens-- <= 0) continue;
    l.pen = false;
    const asked = all.find((x) => x.id === l.reply), r = s.realms[l.from], who = steersman(s, r);
    if (!asked || !r) continue;
    const ai = await aiJSON(era, `You are ${who?.title ?? ''} ${who?.name}, ruler of ${r.name} in the year ${yearOf(s.month, s)}, temperament ${TEMPER_TEXT[who?.temper]?.[0] ?? ''}. Reply to a letter from another ruler in at most 40 words, in your own voice, never modern.${asked.prop ? ` You ${asked.answer === 'accept' ? 'ACCEPT' : 'DECLINE'} their proposal of ${PROPOSALS[asked.prop.kind]}; say so plainly.` : ''} ${NO_RELIGION} Reply with JSON only: {"reply":"..."}`,
      `From ${s.realms[asked.from]?.name} (${asked.by}): "${asked.text || `I propose ${PROPOSALS[asked.prop?.kind]}.`}"`, 160);
    if (ai?.reply) l.text = clean(ai.reply, 45);
  }
  era.put('letters', all.slice(-400));
}
// The vizier, asked: what he knows of the realm and its neighbours, and his answer in his own voice.
function situationOf(era, s, realm) {
  const r = s.realms[realm], next = neighbours(s, realm).realms;
  const rel = (id) => (atWar(s, realm, id) ? 'at war' : s.allies?.[[realm, id].sort().join('|')] ? 'ally' : s.realms[id]?.overlord === realm ? 'our client' : r.overlord === id ? 'our overlord' : 'at peace');
  const recent = era.sql.exec('SELECT events FROM months WHERE age = ? AND m >= ? ORDER BY m', era.meta.age, Math.max(0, s.month - 6)).toArray().flatMap((x) => JSON.parse(x.events)).filter((e) => e.realms?.includes(realm)).slice(-6).map((e) => e.text);
  return [`${r.name}: ${provincesOf(s, realm).length} provinces, ${Math.round(menOf(s, realm))}k soldiers (strength ${Math.round(strength(s, realm))}), ${Math.round(r.gold)} gold, prosperity ${Math.round(prosperityOf(s, realm))}/100, taxes ${r.tax}.`,
    `Neighbours: ${next.map((id) => `${s.realms[id].short} (${rel(id)}, strength ${Math.round(strength(s, id))})`).join('; ') || 'none'}.`,
    recent.length ? `Lately: ${recent.join(' / ')}` : ''].join('\n');
}
async function talk(era, s, me, question) {
  const book = era.get('talks') ?? {}, q = quarterOf(s), mine = book[me.realm]?.q === q ? book[me.realm] : { q, n: 0 };
  if (mine.n >= TALKS_PER_QUARTER) return { error: `Your vizier has spoken enough this quarter (${TALKS_PER_QUARTER} questions).` };
  mine.n++;
  book[me.realm] = mine;
  era.put('talks', book);
  const r = s.realms[me.realm], ruler = steersman(s, r), v = s.chars[r.vizier];
  const ai = await aiJSON(era, `You are ${v?.alive ? v.name : 'the vizier'}, vizier to ${ruler?.title ?? ''} ${ruler?.name} of ${r.name}, in the year ${yearOf(s.month, s)}. Answer your ruler's question in at most 80 words, frankly and in character, using only what you know of the realm below; give a clear recommendation. Never modern. ${NO_RELIGION} Reply with JSON only: {"answer":"..."}`,
    `${situationOf(era, s, me.realm)}\n\nThe ruler asks: "${clean(question, 60)}"`, 320);
  if (ai?.answer) return { answer: clean(ai.answer, 90), by: 'ai', left: TALKS_PER_QUARTER - mine.n, vizier: v?.alive ? v.name : 'Your vizier' };
  const draft = await suggestOrders({ ...era, env: { ...era.env, CAST: 'off' } }, s, me.realm, []); // no AI left: the rules speak
  return { answer: `My lord, as I see it: ${draft.why.join('; ')}.`, by: 'rules', left: TALKS_PER_QUARTER - mine.n, vizier: v?.alive ? v.name : 'Your vizier' };
}

// ---------- the turn of the quarter: the council's orders become the month's inputs ----------
export function flushCouncil(era, s) {
  answerLetters(era, s);
  const orders = era.get('orders') ?? {}, seats = era.get('seats') ?? {};
  for (const [realm, o] of Object.entries(orders)) {
    if (!seats[realm]) continue;
    for (const a of o.acts ?? []) era.queue(s.month, 'act', realm, a);
    if (o.tax || o.say) era.queue(s.month, 'plan', realm, { ...(o.tax ? { tax: o.tax } : {}), ...(o.say ? { said: o.say } : {}), by: 'player' }); // the court proclaims it
    for (const [id, choice] of Object.entries(o.answers ?? {})) era.queue(s.month, 'answer', id, { choice, by: 'player' });
    era.queue(s.month, 'council', realm, true);
  }
  for (const [realm, x] of Object.entries(seats)) {
    if (x.ended && !orders[realm]) era.queue(s.month, 'council', realm, true);
    x.ended = false;
  }
  era.put('orders', {});
  era.put('seats', seats);
}
// After the quarter: a throne lost (to a usurper, to conquest) frees its seat.
export function tidySeats(era, s, events) {
  const seats = era.get('seats') ?? {};
  let changed = false;
  for (const realm of Object.keys(seats)) {
    const queued = era.sql.exec('SELECT COUNT(*) AS n FROM queue WHERE kind = ? AND k = ?', 'seize', realm).toArray()[0]?.n;
    if (s.players?.[realm] || queued) continue;
    const why = events.find((e) => e.usurped === realm) ?? (s.realms[realm]?.fallen ? { text: `${s.realms[realm].name} is no more` } : null);
    const hook = seats[realm].webhook;
    delete seats[realm];
    changed = true;
    if (hook) n8nPost(era.env, 'reminder', { webhook: hook, title: `Your throne is lost: ${dateText(s.month, s)}`, text: `${why?.text ?? 'Your realm has passed from your hands.'} Seize another throne whenever you like.`, url: site(era.env) });
  }
  if (changed) { era.put('seats', seats); era.broadcast({ t: 'seats', seats: publicSeats(era, s) }); }
}
// The council opens: each player with a Discord address hears of it, with the matters waiting.
export async function councilOpen(era) {
  const s = era.state(), seats = era.get('seats') ?? {}, when = new Date(era.meta.next).toISOString().slice(11, 16);
  for (const [realm, x] of Object.entries(seats)) {
    if (!x.webhook) continue;
    const waiting = decisionsFor(s, realm).length, missed = s.players?.[realm]?.missed ?? 0;
    await n8nPost(era.env, 'reminder', { webhook: x.webhook, title: `${s.realms[realm]?.short ?? realm}: your council is open`, text: [`${waiting ? `${waiting} matter${waiting > 1 ? 's' : ''} wait for you.` : 'No matters wait; your orders, though, do.'} The quarter turns at ${when} UTC.`, missed > R.absence.grace ? `You have been away ${missed} councils: your vizier grows bold.` : ''].filter(Boolean).join('\n'), url: site(era.env) });
  }
}

const site = (env) => env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
function n8nPost(env, path, item) {
  const n8n = (env.N8N_URL || '').replace(/\/$/, '');
  if (!n8n) return Promise.resolve();
  return fetch(`${n8n}/webhook/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': env.REALM_SECRET ?? '' }, body: JSON.stringify(item), signal: AbortSignal.timeout(8000) }).catch((err) => console.error(`n8n ${path}:`, err.message));
}

// After each turn: the heralds (the living world's great events) and, in private games, the reminders.
export function makeHeralds(env, era) {
  if (!(env.N8N_URL || '')) return null;
  return async function heralds(s, events) {
    const game = era.meta.game;
    if (!game) {
      for (const e of events.filter((x) => isGreat(x, s)).slice(0, 3)) await n8nPost(env, 'news', { title: `${e.date}: ${clean(e.text, 14)}`, text: e.text, url: site(env), color: 0xb3852c });
      return;
    }
    const seats = era.get('seats') ?? {}, when = new Date(era.meta.next).toISOString().slice(11, 16);
    for (const [realm, x] of Object.entries(seats).filter(([, y]) => y.webhook && y.delegate === 'me')) {
      const waiting = decisionsFor(s, realm).length;
      const mine = events.filter((e) => e.realms?.includes(realm) && !e.minor).slice(0, 3).map((e) => `• ${e.text}`);
      await n8nPost(env, 'reminder', { webhook: x.webhook, title: `${game.name}: ${dateText(s.month, s)}`, text: [`${s.realms[realm]?.short ?? realm}, your move.${waiting ? ` ${waiting} decision${waiting > 1 ? 's' : ''} wait for you.` : ''} The next month turns at ${when} UTC.`, ...mine].join('\n'), url: `${site(env)}/?game=${game.id}` });
    }
  };
}
export { PACES };
