// Players and the outside world. In a game (an Era of its own, ?game=<id>), players claim realms, send orders,
// answer their ruler's decisions and mark themselves ready; an absent player's realm is played by doctrine or, if
// they ask, by the AI. n8n carries the heralds (great events to Discord), the players' reminders, a daily digest,
// and the real sky over the great capitals into the game.
import { RULES as R } from '../web/silk/rules.js';
import { living, provincesOf, steersman, PROV, isGreat, dateText, yearOf, cityOf, AGES } from '../web/silk/engine.js';
import { clean } from './agent.js';

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-type': 'application/json', 'cache-control': 'no-store' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const PACES = { quick: 3 * 60_000, hour: 60 * 60_000, evening: 4 * 3600_000 };
const KINDS = ['war', 'peace', 'ally', 'submit', 'independence', 'power', 'hire', 'build', 'claim'];
const DISCORD = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/; // the only address a reminder goes to
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
const publicSeats = (era, s) => Object.entries(era.get('seats') ?? {}).map(([realm, x]) => ({ realm, name: x.name, delegate: x.delegate, ready: x.ready === s.month, since: x.since }));
// What the player's ruler must decide: their peace offers, matches and verdicts (a general's own choices stay his).
const decisionsFor = (s, realm) => s.pending.filter((d) => d.realm === realm && d.char === steersman(s, s.realms[realm])?.id);

export async function play(era, req, p, url) {
  const s = era.state();
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  // ---------- the lobby (kept by the living world) ----------
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
  // ---------- seats ----------
  if (p === '/api/era/seats') return json(200, { seats: publicSeats(era, s), game: era.meta.game ?? null, month: s.month, next: era.meta.next });
  if (p === '/api/era/claim' && req.method === 'POST') {
    if (!era.meta.game) return json(400, { error: 'The living world is played by its own people. Start a game to rule a realm.' });
    const seats = era.get('seats') ?? {}, r = s.realms[body.realm];
    if (!r || r.fallen || !provincesOf(s, r.id).length) return json(400, { error: 'no such realm' });
    if (seats[r.id]) return json(409, { error: 'that realm already has a ruler' });
    if (Object.keys(seats).length >= 12) return json(409, { error: 'this game is full' });
    const name = clean(body.name, 4).slice(0, 24);
    if (name.length < 2) return json(400, { error: 'a name, please' });
    const webhook = typeof body.webhook === 'string' && DISCORD.test(body.webhook.trim()) ? body.webhook.trim() : null;
    const token = newToken();
    seats[r.id] = { name, hash: await hash(token), since: s.month, delegate: 'me', webhook, ready: null };
    era.put('seats', seats);
    era.broadcast({ t: 'seats', seats: publicSeats(era, s) });
    return json(200, { token, realm: r.id, name });
  }
  if (p === '/api/era/me' && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(404, { error: 'not seated' });
    return json(200, { realm: me.realm, name: me.seat.name, delegate: me.seat.delegate, ready: me.seat.ready === s.month, decisions: decisionsFor(s, me.realm), next: era.meta.next });
  }
  if (['/api/era/act', '/api/era/answer', '/api/era/ready', '/api/era/delegate'].includes(p) && req.method === 'POST') {
    const me = await seatOf(era, body.token);
    if (!me) return json(403, { error: 'not seated' });
    const { realm, seat, seats } = me;
    if (p === '/api/era/act') {
      const acts = (Array.isArray(body.acts) ? body.acts : []).slice(0, 6).filter((a) => KINDS.includes(a?.kind)).map((a) => ({
        kind: a.kind, ...(typeof a.target === 'string' && s.realms[a.target] ? { target: a.target } : {}), ...(typeof a.place === 'string' && PROV[a.place] ? { place: a.place } : {}),
        ...(Object.keys(R.works).includes(a.work) ? { work: a.work } : {}), ...(R.power.includes(a.power) ? { power: a.power } : {}), ...(a.say ? { say: clean(a.say, 24) } : {}),
      }));
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
    const from = Math.max(0, s.month - 96), rows = era.sql.exec('SELECT events FROM months WHERE age = ? AND m >= ? ORDER BY m', era.meta.age, from).toArray();
    const great = rows.flatMap((r) => JSON.parse(r.events)).filter((e) => isGreat(e, s)).slice(-8);
    const top = living(s).map((r) => [r, provincesOf(s, r.id).length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return json(200, { title: `A day in Agentistan: ${dateText(from, s)} to ${dateText(s.month, s)}`, text: [...great.map((e) => `• ${e.date}: ${e.text}`), '', `The great powers: ${top.map(([r, n]) => `${r.short} (${n} provinces)`).join(', ')}.`].join('\n').slice(0, 1800), url: era.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com' });
  }
  return null;
}

// After each month: the heralds (the living world) and the reminders (games), both through n8n, both best-effort.
export function makeHeralds(env, era) {
  const n8n = (env.N8N_URL || '').replace(/\/$/, ''), site = env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
  if (!n8n) return null;
  const post = (path, item) => fetch(`${n8n}/webhook/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': env.REALM_SECRET ?? '' }, body: JSON.stringify(item), signal: AbortSignal.timeout(8000) }).catch((err) => console.error(`n8n ${path}:`, err.message));
  return async function heralds(s, events, m) {
    const game = era.meta.game;
    if (!game) {
      const great = events.filter((e) => isGreat(e, s)).slice(0, 2);
      for (const e of great) await post('news', { title: `${e.date}: ${clean(e.text, 14)}`, text: e.text, url: site, color: 0xb3852c });
      return;
    }
    const seats = era.get('seats') ?? {}, when = new Date(era.meta.next).toISOString().slice(11, 16);
    const hooks = Object.entries(seats).filter(([, x]) => x.webhook && x.delegate === 'me');
    if (!hooks.length) return;
    for (const [realm, x] of hooks) {
      const waiting = s.pending.filter((d) => d.realm === realm && d.char === steersman(s, s.realms[realm])?.id).length;
      const mine = events.filter((e) => e.realms?.includes(realm) && !e.minor).slice(0, 3).map((e) => `• ${e.text}`);
      await post('reminder', { webhook: x.webhook, title: `${game.name}: ${dateText(s.month, s)}`, text: [`${s.realms[realm]?.short ?? realm}, your move.${waiting ? ` ${waiting} decision${waiting > 1 ? 's' : ''} wait for you.` : ''} The next month turns at ${when} UTC.`, ...mine].join('\n'), url: `${site}/?game=${game.id}` });
    }
  };
}
export { PACES };
