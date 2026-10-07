// Era: one shared world, alive on the server. An alarm turns the month at a set pace (15 minutes: an age lasts a
// week). Every month is kept (what went in, what happened, a checksum) and a full snapshot each year, so any visitor
// replays the age so far in the browser with the same engine, then watches it live over a WebSocket.
// The engine is pure, so the browser's replay and the server's world are the same history.
import { DurableObject } from 'cloudflare:workers';
import { newAge, tick, frame, ENGINE, AGES, QUARTER } from '../web/silk/engine.js';
import { brain } from '../web/silk/doctrine.js';
import { makeCast } from './cast.js';
import { makeSealer, DEPLOYED, EXPLORER } from './seal.js';
import { play, makeHeralds, flushCouncil, councilOpen, tidySeats } from './play.js';

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (status, body, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': cache } });
const PACE = 15 * 60_000; // a game's month every 15 minutes
const QUARTER_MS = 6 * 3600_000, REFLECT = 3600_000; // the living world: a quarter every 6 hours, its first hour for reflection
const REST = 6 * 3600_000; // between ages, six hours of quiet
export function checksum(s) { // a short fingerprint of the map, so a replay that strays from the record is noticed
  const str = JSON.stringify(frame(s));
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export class Era extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.hits = new Map();
    this.hooks = []; // after each month: the AI cast, the heralds, the chain
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.load();
      if (env.LLM_API_KEY && env.CAST !== 'off') this.hooks.push(makeCast(env, this));
      const sealer = makeSealer(env, this);
      if (sealer) this.hooks.push(sealer);
      const heralds = makeHeralds(env, this);
      if (heralds) this.hooks.push(heralds);
    });
  }

  load() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS months (age INTEGER, m INTEGER, inputs TEXT, events TEXT, chk TEXT, PRIMARY KEY (age, m))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS snaps (age INTEGER, m INTEGER, state TEXT, PRIMARY KEY (age, m))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, m INTEGER, kind TEXT, k TEXT, json TEXT)');
    this.meta = this.get('meta');
    this.s = null;
  }
  get(k) {
    const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0];
    return r ? JSON.parse(r.v) : null;
  }
  put(k, v) { this.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, JSON.stringify(v)); }
  state() { return (this.s ??= this.get('state')); }
  public() {
    const s = this.state(), m = this.meta;
    if (!s || !m) return { status: 'none' };
    return { game: m.game ?? null, age: m.age, seed: m.seed, ageId: m.ageId, engine: m.engine, month: s.month, months: s.months, startYear: s.startYear, status: s.status, pace: m.pace, next: m.next, restUntil: m.restUntil ?? null, quarter: m.quarter ? { opens: m.councilOpens, ends: m.next } : null,
      viewers: this.ctx.getWebSockets().length, endReason: s.endReason, past: (m.ages ?? []).slice(-6), chain: this.chain() };
  }
  chain() { // the registry on Base Sepolia: where it is, and the last year sealed
    const book = this.get('seals'), done = (book?.list ?? []).filter((x) => x.status === 'done' && book.age === this.meta?.age);
    const last = done.at(-1);
    return { address: DEPLOYED.address, explorer: EXPLORER, sealedTo: last?.to ?? 0, last: last ? { seq: last.seq, to: last.to, hash: last.hash, block: last.block } : null, seals: done.slice(-12).map((x) => ({ seq: x.seq, from: x.from, to: x.to, hash: x.hash })) };
  }

  // ---------- the turn of the month ----------
  begin({ seed = 1 + Math.floor(Math.random() * 99999), ageId = this.meta?.ageId ?? '1200', pace = this.meta?.pace ?? PACE, game = this.meta?.game } = {}) {
    const s = newAge(seed, ageId), age = (this.meta?.age ?? 0) + 1;
    const quarter = !game, every = quarter ? QUARTER_MS : pace;
    this.meta = { ...(this.meta ?? {}), age, seed, ageId, pace: every, quarter, councilOpens: Date.now(), opened: Date.now(), game: game ?? null, engine: ENGINE, started: Date.now(), next: Date.now() + every, restUntil: null, ages: this.meta?.ages ?? [] };
    this.put('seats', {}); // a new age: every throne is free again
    this.put('orders', {});
    this.s = s;
    this.put('state', s);
    this.put('meta', this.meta);
    this.sql.exec('INSERT OR REPLACE INTO snaps (age, m, state) VALUES (?, 0, ?)', age, JSON.stringify(s));
    for (const old of this.sql.exec('SELECT DISTINCT age FROM snaps WHERE age < ?', age - 4).toArray()) { // keep the last five ages
      this.sql.exec('DELETE FROM snaps WHERE age = ?', old.age);
      this.sql.exec('DELETE FROM months WHERE age = ?', old.age);
    }
    this.ctx.storage.setAlarm(this.meta.next);
    this.broadcast({ t: 'age', era: this.public() });
  }

  async alarm() {
    const s = this.state();
    if (!s || !this.meta) return;
    if (this.meta.engine !== ENGINE && !this.meta.game) return this.begin(); // new rules: an old record would replay differently, so a new age begins
    if (s.status !== 'running') { // the age is over: rest a while, then history starts again
      if (this.meta.game) return; // a game ends when its age ends
      if (Date.now() >= (this.meta.restUntil ?? 0)) { // the living world takes the ages in turn
        const order = Object.keys(AGES), next = order[(order.indexOf(this.meta.ageId) + 1) % order.length];
        this.begin({ ageId: next });
      }
      else this.ctx.storage.setAlarm(this.meta.restUntil);
      return;
    }
    if (this.meta.quarter && Date.now() < this.meta.next - 1000) { // the reflection hour is over: the council opens
      this.ctx.storage.setAlarm(this.meta.next);
      if ((this.meta.opened ?? 0) < this.meta.councilOpens) {
        this.meta.opened = Date.now();
        this.put('meta', this.meta);
        this.broadcast({ t: 'council', opens: this.meta.councilOpens, next: this.meta.next });
        await councilOpen(this).catch((err) => console.error('council reminders failed:', err));
      }
      return;
    }
    // The turn: a month, or in the living world a whole quarter, with everyone's orders carried out together.
    if (this.meta.quarter) flushCouncil(this, this.state());
    const months = this.meta.quarter ? QUARTER - (s.month % QUARTER) : 1, events = [];
    let m = s.month;
    for (let i = 0; i < months && this.s.status === 'running'; i++) { m = this.s.month; events.push(...this.turn(m)); }
    const state = this.s;
    this.meta.next = Date.now() + this.meta.pace;
    if (this.meta.quarter) this.meta.councilOpens = Date.now() + REFLECT;
    if (state.status !== 'running') {
      this.meta.restUntil = Date.now() + REST;
      this.meta.ages = [...(this.meta.ages ?? []), { age: this.meta.age, seed: this.meta.seed, ended: Date.now(), reason: state.endReason, winner: state.realms[state.winner]?.name ?? null }].slice(-20);
    }
    this.put('meta', this.meta);
    this.ctx.storage.setAlarm(state.status !== 'running' ? this.meta.restUntil : this.meta.quarter ? this.meta.councilOpens : this.meta.next);
    if (this.meta.quarter) {
      this.broadcast({ t: 'quarter', m: state.month, next: this.meta.next, opens: this.meta.councilOpens });
      tidySeats(this, state, events);
    }
    for (const hook of this.hooks) {
      try { await hook(state, events, m); } catch (err) { console.error('after-month hook failed:', err); } // nothing outside the engine may stop the world
    }
  }
  turn(m) {
    const inputs = this.takeInputs(m);
    const { state, events } = tick(this.s, brain, inputs, { inPlace: true });
    this.s = state;
    const chk = checksum(state);
    this.sql.exec('INSERT OR REPLACE INTO months (age, m, inputs, events, chk) VALUES (?, ?, ?, ?, ?)', this.meta.age, m, JSON.stringify(inputs), JSON.stringify(events), chk);
    if (state.month % 12 === 0) this.sql.exec('INSERT OR REPLACE INTO snaps (age, m, state) VALUES (?, ?, ?)', this.meta.age, state.month, JSON.stringify(state));
    this.put('state', state);
    this.broadcast({ t: 'month', m, inputs, events, chk, next: this.meta.next, status: state.status });
    return events;
  }

  // Inputs for a month: the AI's answers and plans, players' acts. Queued now, applied when that month turns.
  queue(m, kind, k, value) { this.sql.exec('INSERT INTO queue (m, kind, k, json) VALUES (?, ?, ?, ?)', m, kind, k, JSON.stringify(value)); }
  takeInputs(m) {
    const rows = this.sql.exec('SELECT kind, k, json FROM queue WHERE m <= ? ORDER BY id', m).toArray();
    this.sql.exec('DELETE FROM queue WHERE m <= ?', m);
    const inputs = {};
    for (const { kind, k, json: v } of rows) {
      const val = JSON.parse(v);
      if (kind === 'answer') (inputs.answers ??= {})[k] = val;
      else if (kind === 'plan') (inputs.plans ??= {})[k] = val;
      else if (kind === 'act') ((inputs.acts ??= {})[k] ??= []).push(val);
      else if (kind === 'persona') ((inputs.personas ??= {})[k] = val);
      else if (kind === 'skies') ((inputs.skies ??= {})[k] = val);
      else if (kind === 'seize') ((inputs.seize ??= {})[k] = val);
      else if (kind === 'leave') ((inputs.leave ??= {})[k] = val);
      else if (kind === 'council') ((inputs.councils ??= {})[k] = val);
    }
    return inputs;
  }

  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(text); } catch { /* closing */ }
    }
  }
  webSocketMessage() { /* viewers only listen; pings are answered automatically */ }
  webSocketClose(ws, code) { try { ws.close(code, 'bye'); } catch { /* already closed */ } }

  // ---------- HTTP ----------
  allow(ip) {
    const now = Date.now(), b = this.hits.get(ip) ?? { n: 0, t: now };
    if (now - b.t > 60_000) Object.assign(b, { n: 0, t: now });
    b.n++;
    this.hits.set(ip, b);
    if (this.hits.size > 5000) this.hits.clear(); // ponytail: crude cap, like the other limiters
    return b.n <= 240;
  }
  authorized(req) {
    const enc = new TextEncoder(), got = enc.encode(req.headers.get('x-realm-secret') ?? ''), want = enc.encode(this.env.REALM_SECRET ?? '');
    return want.length > 0 && got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
  }

  async fetch(req) {
    const url = new URL(req.url), p = url.pathname.replace(/^\/api\/(game\/[\w-]+\/)?era/, '/api/era'), ip = req.headers.get('cf-connecting-ip') ?? 'local';
    try {
      if (p === '/internal/era/watch') { // the cron's wake-up: a world must always be turning
        if (!this.meta) this.begin();
        else if (!(await this.ctx.storage.getAlarm())) this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, this.state()?.status !== 'running' ? this.meta.restUntil ?? 0 : this.meta.quarter && (this.meta.opened ?? 0) < this.meta.councilOpens ? this.meta.councilOpens : this.meta.next));
        return json(200, this.public());
      }
      if (p === '/internal/era/skies') return (await play(this, req, p, url)) ?? json(404, { error: 'not found' });
      if (p.startsWith('/internal/era/')) {
        if (!this.authorized(req)) return json(403, { error: 'forbidden' });
        const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        if (p === '/internal/era/start') { this.begin({ seed: body.seed, ageId: body.ageId, pace: body.pace, game: body.game }); return json(200, this.public()); }
        if (p === '/internal/era/pace') { this.meta.pace = Math.max(10_000, +body.pace || PACE); this.meta.next = Date.now() + this.meta.pace; this.put('meta', this.meta); this.ctx.storage.setAlarm(this.meta.next); return json(200, this.public()); }
        if (p === '/internal/era/council-now') { this.meta.councilOpens = Date.now(); this.put('meta', this.meta); return json(200, this.public()); } // end the reflection hour (tests)
        if (p === '/internal/era/step') { this.meta.next = Date.now(); await this.alarm(); return json(200, this.public()); } // turn now (tests and local play)
        return json(404, { error: 'not found' });
      }
      if (!this.allow(ip)) return json(429, { error: 'slow down' });
      if (p === '/api/games') return (await play(this, req, p, url)) ?? json(404, { error: 'not found' });
      if (!this.meta && req.headers.get('x-era-game')) return json(404, { error: 'no such game' });
      if (!this.meta) this.begin();
      if (p === '/api/era') return json(200, this.public());
      if (p === '/api/era/live') {
        if (req.headers.get('upgrade') !== 'websocket') return json(426, { error: 'a WebSocket, please' });
        if (this.ctx.getWebSockets().length > 2000) return json(503, { error: 'too many watchers' });
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);
        server.send(JSON.stringify({ t: 'hello', era: this.public() }));
        return new Response(null, { status: 101, webSocket: client });
      }
      const age = +(url.searchParams.get('age') ?? this.meta.age);
      if (p === '/api/era/snap') { // the year's snapshot at or before a month
        const m = Math.max(0, +(url.searchParams.get('m') ?? 0));
        const row = this.sql.exec('SELECT m, state FROM snaps WHERE age = ? AND m <= ? ORDER BY m DESC LIMIT 1', age, m).toArray()[0];
        if (!row) return json(404, { error: 'no snapshot' });
        return new Response(`{"m":${row.m},"state":${row.state}}`, { headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
      }
      if (p === '/api/era/months') { // the record: each month's inputs, events and checksum
        const from = Math.max(0, +(url.searchParams.get('from') ?? 0)), to = +(url.searchParams.get('to') ?? 1e9);
        const rows = this.sql.exec('SELECT m, inputs, events, chk FROM months WHERE age = ? AND m >= ? AND m < ? ORDER BY m', age, from, to).toArray();
        return new Response(`[${rows.map((r) => `{"m":${r.m},"inputs":${r.inputs},"events":${r.events},"chk":"${r.chk}"}`).join(',')}]`, { headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (p === '/api/era/state') return json(200, { m: this.state().month, state: this.state(), era: this.public() });
      const played = await play(this, req, p, url);
      if (played) return played;
      return json(404, { error: 'not found' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'internal error' });
    }
  }
}
