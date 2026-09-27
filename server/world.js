// World: one Durable Object owns the truth. Turn clock (alarms), hand-off to n8n, agent runtime, chain outbox,
// markets and weather, the public API and the live stream (hibernating WebSockets). State lives in the object's SQLite.
import { DurableObject } from 'cloudflare:workers';
import { keccak256, stringToHex } from 'viem';
import * as E from './engine.js';
import { CFG, CAST, MAP, REGIONS, cityNamed } from './config.js';
import { makeLLM, decide, lesson, clean, seasonStats, answer } from './agent.js';
import { draftPlan } from './plan.js';
import { makeChain, decodeRoundData, KINGDOM_ID } from './chain.js';
import { LENS } from '../web/lens.js';
import { headline, momentText, isMoment, turnStory, WEATHER } from '../web/story.js';

const COINS = ['ETH', 'BTC', 'LINK'];
const COUNT = { 'agent.decision': 'decisions', 'agent.tool_called': 'toolCalls', 'n8n.workflow_started': 'automations', 'oracle.price_update': 'oracleReads', 'chain.tx_confirmed': 'receipts' };
const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json' } });
const pickArgs = (a) => Object.fromEntries(['x', 'y', 'n'].filter((f) => a?.[f] != null && Number.isFinite(+a[f])).map((f) => [f, Math.trunc(+a[f])]));
const isKingdom = (k) => k === 'red' || k === 'blue';
const COLOR = { red: 0xd9480f, blue: 0x1864ab, null: 0x495057 };
const SKY_ICON = { clear: '☀️', rain: '🌧️', snow: '❄️', storm: '⛈️', wind: '💨', fog: '🌫️', heat: '🔥', cold: '🥶' };
// The public AI features share the free tier with the generals, so each has its own limits and stops at a share of the
// day's tokens. Ask: ~1k tokens a question. Plan: ~5k (high reasoning) but seldom used and the most valuable, so it
// may use nearly everything left.
const AI = {
  ask: { perIp: 4, windowMs: 600_000, perDay: 40, maxShare: 0.8 },
  plan: { perIp: 3, windowMs: 3_600_000, perDay: 15, maxShare: 0.95, maxWait: 45 }, // waits out the per-minute limit
};

// What each snapshot carries besides the raw state, so recordings replay the market and weather effects too.
export const effectsOf = (s) => ({
  red: { coin: E.coinOf('red'), pct: E.marketPct(s, E.coinOf('red')), mood: E.mood(s, 'red'), dividend: s.kingdoms.red.dividend ?? null },
  blue: { coin: E.coinOf('blue'), pct: E.marketPct(s, E.coinOf('blue')), mood: E.mood(s, 'blue'), dividend: s.kingdoms.blue.dividend ?? null },
  LINK: { pct: E.marketPct(s, 'LINK'), cost: E.recruitCost(s) },
  weather: Object.fromEntries(Object.entries(s.weather?.regions ?? {}).map(([id, w]) => [id, w.kind])),
});

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.cfg = {
      secret: env.REALM_SECRET || '',
      n8n: (env.N8N_URL || '').replace(/\/$/, ''), // empty = the world runs every turn itself
      // 30 min: 48 AI decisions/day ~ 105k tokens, about half the Groq free tier (200k tokens/day). See README.
      interval: +(env.TURN_INTERVAL_MS || 1_800_000),
      timeout: +(env.TURN_TIMEOUT_MS || 90_000),
      results: +(env.RESULTS_MS || 60_000),
      scenario: env.SCENARIO || 'standard',
      site: env.PUBLIC_URL || 'https://agentistan.umarkhatana.com',
      public: { owner: env.PUBLIC_OWNER_NAME || 'the builder', hireUrl: env.PUBLIC_HIRE_URL || '', bookingUrl: env.PUBLIC_BOOKING_URL || '', repoUrl: env.PUBLIC_REPO_URL || '', email: env.PUBLIC_CONTACT_EMAIL || '' },
    };
    this.chain = makeChain(env);
    this.sql = ctx.storage.sql;
    this.hits = new Map();
    this.aiHits = {}; // kind -> ip -> times of recent uses
    this.answers = new Map(); // the same question (same turn) or plan request (same day) is answered again for free
    this.stateTimer = null;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); // keep-alives never wake the object
    ctx.blockConcurrencyWhile(async () => this.load());
  }

  // ---------- persistence: the world as one JSON row; recordings and battles as rows ----------
  load() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS lines (i INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, k TEXT, eid INTEGER, json TEXT)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS lines_by_season ON lines (season, i)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS battles (season INTEGER, turn INTEGER, json TEXT, hash TEXT, PRIMARY KEY (season, turn))');
    const row = this.sql.exec("SELECT v FROM kv WHERE k = 'world'").toArray()[0];
    this.W = row ? JSON.parse(row.v) : null; // null until /internal/import starts or migrates a world
    if (!this.W) return;
    this.W.state = E.upgrade(this.W.state); // a save from an older version of the rules (e.g. one sky for the whole map)
    this.llm = makeLLM(this.env, (this.W.llmUsage ??= {})); // usage is saved, so the daily cap survives restarts
  }

  save() {
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('world', ?)", JSON.stringify(this.W));
  }

  // Season recordings: every event plus a snapshot per turn. The UI replays these as timelapses.
  record(line, season = this.W.state.season) {
    this.sql.exec('INSERT INTO lines (season, k, eid, json) VALUES (?, ?, ?, ?)', season, line.k, line.e?.id ?? null, JSON.stringify(line));
  }

  recent(n) {
    return this.sql.exec("SELECT json FROM lines WHERE k = 'e' ORDER BY i DESC LIMIT ?", n).toArray().reverse().map((r) => JSON.parse(r.json).e);
  }

  snapshot() {
    const { meta, ...s } = this.publicState();
    return { at: new Date().toISOString(), ...s };
  }

  // ---------- timers: named deadlines in the world row; one alarm fires at the earliest ----------
  at(name, ms) {
    this.W.timers[name] = Date.now() + Math.max(0, ms);
    this.arm();
  }

  cancel(name) {
    delete this.W.timers[name];
    this.arm();
  }

  arm() {
    const next = Math.min(...Object.values(this.W.timers));
    if (Number.isFinite(next)) this.ctx.storage.setAlarm(next);
  }

  async alarm() {
    if (!this.W) return;
    const due = Object.entries(this.W.timers).filter(([, t]) => t <= Date.now()).map(([name]) => name);
    due.forEach((name) => delete this.W.timers[name]);
    this.save();
    for (const name of due) {
      try {
        await { turn: () => this.beginTurn(), watchdog: () => this.watchdog(), seasonEnd: () => this.endSeason(), season: () => this.startSeason(), pump: () => this.pump(), news: () => this.flushNews() }[name]?.();
      } catch (err) {
        console.error(`timer ${name} failed:`, err);
        if (name === 'turn' && !this.W.pending) this.at('turn', 60_000); // try the turn again in a minute
      }
    }
    this.save();
    this.arm();
  }

  // ---------- events + live stream ----------
  trace() {
    return `s${this.W.state.season}-t${this.W.state.turn}`;
  }

  emit(type, kingdom, summary, data = {}, traceId = this.trace()) {
    const W = this.W;
    const e = { id: W.nextId++, ts: new Date().toISOString(), season: W.state.season, turn: W.state.turn, traceId, stage: LENS[type]?.[0] ?? 'game', type, kingdom: kingdom ?? null, summary, lensKey: type, data };
    if (COUNT[type]) W.counters[COUNT[type]]++;
    this.record({ k: 'e', e });
    this.broadcast('event', e);
    try { this.news(e); } catch (err) { console.error('news not queued:', err); } // a Discord post must never break the game
    return e;
  }

  broadcast(kind, data) {
    const msg = JSON.stringify({ kind, data });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch { /* closing */ }
    }
  }

  pushState() { // coalesce bursts of changes into one state message
    this.stateTimer ??= setTimeout(() => {
      this.stateTimer = null;
      this.broadcast('state', this.publicState());
    }, 100);
  }

  publicState() {
    const W = this.W, c = this.chain, st = this.llm.status();
    return {
      state: W.state,
      effects: effectsOf(W.state),
      counters: W.counters,
      proofs: W.outbox.slice(-25).reverse().map(({ id, label, kind, status, hash, block, ethUsd, error }) => ({ id, label, kind, status, hash, block, ethUsd, error })),
      journals: { red: W.memory.journal.red.slice(-4), blue: W.memory.journal.blue.slice(-4) },
      lessons: { red: W.memory.lessons.red.slice(-3), blue: W.memory.lessons.blue.slice(-3) },
      meta: {
        llm: { ...st, model: this.llm.model, callsToday: this.llm.usage.calls, tokensToday: this.llm.usage.tokens },
        chain: { name: c.name, explorer: c.explorer, ledger: c.ledger, feed: c.feed, feeds: c.feeds, enabled: c.enabled },
        n8n: Boolean(this.cfg.n8n), prices: W.prices, viewers: this.ctx.getWebSockets().length,
        turnIntervalMs: this.cfg.interval, nextTurnAt: W.pending ? null : W.nextTurnAt, public: this.cfg.public, map: MAP, cast: CAST,
        host: 'Cloudflare Workers + Durable Objects',
      },
    };
  }

  // ---------- the turn loop ----------
  schedule(ms = this.cfg.interval) {
    this.W.nextTurnAt = Date.now() + ms; // a restart keeps the 30-minute rhythm instead of playing a turn early
    this.at('turn', ms);
    this.save();
  }

  async beginTurn() {
    const W = this.W;
    if (W.state.status !== 'running' || W.pending) return;
    const traceId = this.trace();
    if (W.startedTurn !== traceId) { // restart-safe: a turn's economy is never applied twice
      const r = E.startTurn(W.state);
      W.state = r.state;
      W.startedTurn = traceId;
      r.events.forEach((e) => this.emit(e.type, e.kingdom, e.summary, e.data, traceId));
      this.record({ k: 's', s: this.snapshot() });
    }
    const k = W.state.active;
    W.pending = { traceId, kingdom: k };
    this.at('watchdog', this.cfg.timeout);
    this.save();
    this.pushState();
    if (W.state.armies[k].routed) return this.applyGeneral(k, { action: 'hold', args: {} }, 'world');
    if (this.cfg.n8n) {
      try {
        const res = await fetch(`${this.cfg.n8n}/webhook/turn`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-realm-secret': this.cfg.secret },
          body: JSON.stringify({ season: W.state.season, turn: W.state.turn, kingdom: k, traceId }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return; // n8n drives the rest of the turn; the watchdog covers us if it never answers
      } catch (err) {
        this.emit('n8n.unreachable', k, `n8n did not answer (${clean(err.message, 8)}), so the world runs this turn itself`, {}, traceId);
      }
    }
    // Same steps as the n8n Turn Router, in-process.
    const K = W.state.kingdoms[k];
    if (K.food < CFG.food.cap * CFG.food.lowPct) this.quartermaster(k, Math.round(CFG.food.cap * CFG.food.reorderTo - K.food), traceId);
    this.applyGeneral(k, await this.runDecision(k, traceId), 'world');
  }

  runDecision(k, traceId, retryReason) {
    return decide({ s: this.W.state, k, mem: this.W.memory, llm: this.llm, retryReason, emit: (type, summary, data) => this.emit(type, k, summary, data, traceId) });
  }

  quartermaster(k, n, traceId, executionId) {
    const r = E.applyAction(this.W.state, k, { action: 'buy_food', args: { n } });
    if (r.error) return { status: 422, body: { reason: r.error } };
    if (executionId) this.emit('n8n.threshold_alert', k, `Food below 20%: the Supply Alert automation reordered food for ${CAST[k].realm} (execution #${executionId})`, { executionId, n }, traceId);
    this.W.state = r.state;
    r.events.forEach((e) => this.emit(e.type, e.kingdom, e.summary, e.data, traceId));
    this.save();
    this.pushState();
    return { status: 200, body: { ok: true } };
  }

  applyGeneral(k, d, via, executionId) {
    const W = this.W;
    if (W.pending?.kingdom !== k) return { status: 409, body: { reason: `no turn is waiting for ${k}` } };
    const { traceId } = W.pending, turn = W.state.turn;
    const r = E.applyAction(W.state, k, { action: d.action, args: d.args ?? {} });
    if (r.error) return { status: 422, body: { reason: r.error } };
    W.pending = null;
    this.cancel('watchdog');
    W.state = r.state;
    if (d.memory_note) W.memory.journal[k] = [...W.memory.journal[k], { turn, note: d.memory_note }].slice(-20);
    r.events.forEach((e) => this.emit(e.type, e.kingdom, e.summary, e.data, traceId));
    this.record({ k: 's', s: this.snapshot() }); // the map changes right where the move appears in the recording
    if (d.memory_note) this.emit('agent.memory_written', k, `${CAST[k].general}'s journal: "${d.memory_note}"`, { note: d.memory_note }, traceId);
    if (via === 'n8n') this.emit('n8n.workflow_finished', k, `Turn Router delivered ${CAST[k].general}'s order to the game (execution #${executionId})`, { executionId }, traceId);
    let hash = null;
    if (r.battle) {
      const canonical = JSON.stringify(r.battle); // its hash goes on-chain with any capture
      hash = keccak256(stringToHex(canonical));
      this.sql.exec('INSERT OR REPLACE INTO battles (season, turn, json, hash) VALUES (?, ?, ?, ?)', r.battle.season, turn, canonical, hash);
    }
    for (const e of r.events.filter((x) => x.type === 'stronghold.captured')) {
      this.enqueue('capture', [W.state.season, turn, e.data.strongholdId, KINGDOM_ID[e.kingdom], hash], `Turn ${turn} · ${CAST[e.kingdom].realm} captured ${e.data.name}`, traceId);
    }
    if (W.state.status === 'ended') this.at('seasonEnd', 0);
    else {
      this.schedule();
      if (k === 'blue') { // both generals have moved
        try { this.roundReport(turn); } catch (err) { console.error('round report not queued:', err); }
      }
    }
    this.save();
    this.pushState();
    return { status: 200, body: { ok: true } };
  }

  watchdog() {
    const p = this.W.pending;
    if (!p) return;
    this.emit('turn.timeout', p.kingdom, `${CAST[p.kingdom].general} hesitated: no order within ${this.cfg.timeout / 1000}s, so the army holds`, {}, p.traceId);
    this.applyGeneral(p.kingdom, { action: 'hold', args: {} }, 'watchdog');
  }

  async endSeason() {
    const W = this.W, s = W.state;
    Object.assign(W.history.find((h) => h.season === s.season) ?? {}, { endedAt: new Date().toISOString(), winner: s.winner, reason: s.endReason, rounds: E.roundOf(s), turns: s.turn });
    this.enqueue('season', [s.season, KINGDOM_ID[s.winner], E.roundOf(s), keccak256(stringToHex(JSON.stringify(s)))], `Season ${s.season} · ${CAST[s.winner].realm} won`, this.trace());
    const events = this.sql.exec("SELECT json FROM lines WHERE season = ? AND k = 'e'", s.season).toArray().map((r) => JSON.parse(r.json).e);
    for (const k of ['red', 'blue']) {
      const l = await lesson({ s, k, llm: this.llm, stats: seasonStats(events, k) });
      W.memory.lessons[k] = [...W.memory.lessons[k], l].slice(-10);
      this.emit('agent.lesson', k, `${CAST[k].general}'s lesson: "${l}"`, { lesson: l });
    }
    this.record({ k: 's', s: this.snapshot() }); // the recording ends with the lessons
    this.at('season', this.cfg.results);
    this.save();
    this.pushState();
  }

  async startSeason() {
    const W = this.W;
    W.state = E.newSeason(W.state.season + 1, this.cfg.scenario, Object.fromEntries(COINS.map((c) => [c, W.prices[c]?.usd ?? null])));
    W.memory.journal = { red: [], blue: [] };
    W.startedTurn = null;
    const places = this.places().map((p) => p.place);
    W.history.push({ season: W.state.season, scenario: this.cfg.scenario, places, startedAt: new Date().toISOString() });
    this.record({ k: 's', s: this.snapshot() });
    await this.refreshWeather().catch((err) => console.error('weather read failed:', err.message)); // the new skies, right away
    this.emit('season.started', null, `Season ${W.state.season} begins under real skies over ${places.map((n) => n.split(',')[0]).join(', ')}. The generals remember last season's lessons.`, { places });
    this.schedule(3000);
    this.pushState();
  }

  // ---------- chain outbox: one sender, strict order, retries with backoff; a chain outage never stops the game ----------
  enqueue(kind, args, label, traceId) {
    const W = this.W;
    W.outbox.push({ id: (W.outbox.at(-1)?.id ?? 0) + 1, kind, args, label, traceId, status: 'queued', tries: 0, checks: 0, nextTry: 0 });
    W.outbox = W.outbox.filter((i, n, all) => n >= all.length - 200 || !['confirmed', 'failed'].includes(i.status));
    this.emit('chain.tx_queued', null, `Receipt queued: ${label}${this.chain.enabled ? '' : ' (no chain configured yet)'}`, {}, traceId);
    if (this.chain.enabled) this.at('pump', 0);
  }

  async pump() {
    for (const item of this.W.outbox) {
      if (!['queued', 'sent'].includes(item.status)) continue;
      if (item.nextTry > Date.now()) return this.at('pump', item.nextTry - Date.now()); // keep strict order
      await this.deliver(item);
      this.save();
      this.pushState();
      if (item.status !== 'confirmed' && item.status !== 'failed') return this.at('pump', Math.max(5000, item.nextTry - Date.now()));
    }
  }

  async deliver(item) {
    try {
      if (item.status === 'queued') {
        item.tries++;
        item.hash = await this.chain.send(item.kind, item.args);
        item.status = 'sent';
        this.save();
        this.emit('chain.tx_sent', null, `Receipt sent to the ${this.chain.name} chain: ${item.label}`, { hash: item.hash }, item.traceId);
      }
      const r = await this.chain.confirm(item.hash);
      Object.assign(item, { status: 'confirmed', error: null }, r);
      this.emit('chain.tx_confirmed', null, `On-chain receipt confirmed: ${item.label}${r.ethUsd ? ` · ETH $${r.ethUsd.toFixed(2)} at capture` : ''}`,
        { hash: item.hash, block: r.block, ethUsd: r.ethUsd, url: this.chain.explorer && `${this.chain.explorer}/tx/${item.hash}` }, item.traceId);
    } catch (err) {
      item.error = clean(err.shortMessage ?? err.message, 20);
      if (err.fatal || /revert/i.test(item.error)) {
        item.status = 'failed';
        this.emit('chain.tx_failed', null, `Receipt failed: ${item.label} (${item.error})`, {}, item.traceId);
      } else {
        // a sent tx whose receipt never shows up (e.g. the node dropped it) is re-sent after 3 checks
        if (item.status === 'sent' && ++item.checks >= 3) Object.assign(item, { status: 'queued', checks: 0 });
        item.nextTry = Date.now() + Math.min(300_000, 5000 * 2 ** item.tries);
      }
    }
  }

  // ---------- markets: Chainlink ETH, BTC and LINK, from n8n Market Sync (or read directly when n8n is quiet) ----------
  onPrices(rounds, source, executionId) {
    const W = this.W, before = effectsOf(W.state), fresh = [];
    for (const [coin, r] of Object.entries(rounds)) {
      if (!COINS.includes(coin) || !(r?.answer > 0)) continue;
      const usd = r.answer / 1e8;
      if (r.roundId !== W.prices[coin]?.roundId) fresh.push(coin);
      W.prices[coin] = { usd, roundId: r.roundId, updatedAt: r.updatedAt, source, at: new Date().toISOString() };
      W.state = E.setPrice(W.state, coin, usd);
    }
    W.pricesAt = Date.now();
    if (!fresh.length) { // same Chainlink rounds as last read: count it, don't fill the log with it
      W.counters.oracleReads++;
      if (executionId) W.counters.automations++;
      return this.save();
    }
    if (executionId) this.emit('n8n.workflow_started', null, `Market Sync automation (execution #${executionId}) read ETH, BTC and LINK from Chainlink`, { executionId, workflow: 'Market Sync' });
    const fmt = (c) => `${c} $${W.prices[c].usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    this.emit('oracle.price_update', null, `Chainlink: ${COINS.filter((c) => W.prices[c]).map(fmt).join(' · ')} (fetched by ${source === 'n8n' ? 'n8n' : 'the world server'})`,
      { prices: Object.fromEntries(COINS.map((c) => [c, W.prices[c]?.usd ?? null])), fresh, source });
    // Announce a coin once it has moved half a point since its last announcement (LINK: a full point), not on every wiggle.
    const after = effectsOf(W.state), said = (W.announced ??= {});
    for (const k of ['red', 'blue']) {
      const a = after[k];
      if (Math.abs(a.pct - (said[a.coin] ?? 0)) < 0.5) continue;
      said[a.coin] = a.pct;
      this.emit('market.shift', k, `${a.coin} is ${a.pct >= 0 ? 'up' : 'down'} ${Math.abs(a.pct).toFixed(2)}% this season: ${CAST[k].realm} now fights ${a.mood >= 0 ? '+' : ''}${Math.round(a.mood * 100)}%`,
        { coin: a.coin, pct: a.pct, before: before[k].mood, mood: a.mood });
    }
    if (Math.abs(after.LINK.pct - (said.LINK ?? 0)) >= 1) {
      said.LINK = after.LINK.pct;
      this.emit('market.shift', null, `LINK is ${after.LINK.pct >= 0 ? 'up' : 'down'} ${Math.abs(after.LINK.pct).toFixed(2)}% this season: soldiers now cost ${after.LINK.cost} gold each, for both sides`,
        { coin: 'LINK', pct: after.LINK.pct, before: before.LINK.cost, after: after.LINK.cost });
    }
    this.save();
    this.pushState();
  }

  async refreshPrices() {
    const rounds = {};
    for (const c of COINS) rounds[c] = await this.chain.readFeed(c);
    this.onPrices(rounds, 'world');
  }

  // ---------- weather: four regions, each under a real city's sky (Open-Meteo, from n8n Weather Sync or read directly) ----------
  places() { // the city each region was dealt this season, in REGIONS order (what /api/weather tells n8n)
    return REGIONS.map((r) => { const c = cityNamed(this.W.state.weather.regions[r.id].place); return { id: r.id, name: r.name, place: c.name, lat: c.lat, lon: c.lon }; });
  }

  // readings: Open-Meteo `current` objects, one per region in places() order.
  onWeather(readings, source, executionId) {
    const W = this.W, places = this.places();
    if (!Array.isArray(readings) || readings.length !== places.length) return { status: 400, body: { reason: `current must be an array of ${places.length} Open-Meteo readings, one per region` } };
    const changed = [];
    places.forEach((p, i) => {
      const cur = readings[i] ?? {}, w = { code: +cur.weather_code, tempC: +cur.temperature_2m, windKmh: +cur.wind_speed_10m, place: p.place };
      if (![w.code, w.tempC, w.windKmh].every(Number.isFinite)) return;
      const was = W.state.weather.regions[p.id]?.kind ?? 'clear';
      W.state = E.setWeather(W.state, p.id, w);
      const now = W.state.weather.regions[p.id].kind;
      if (now !== was) changed.push({ ...p, ...w, kind: now, was });
    });
    W.weatherAt = Date.now();
    if (!changed.length && executionId) W.counters.automations++; // otherwise counted by its n8n event below
    if (changed.length && executionId) this.emit('n8n.workflow_started', null, `Weather Sync automation (execution #${executionId}) read the sky over ${places.map((p) => p.place.split(',')[0]).join(', ')} from Open-Meteo`, { executionId, workflow: 'Weather Sync' });
    for (const c of changed) {
      this.emit('weather.changed', null, `${c.kind[0].toUpperCase()}${c.kind.slice(1)} in the ${c.name} (the real sky over ${c.place}, ${Math.round(c.tempC)}°C, wind ${Math.round(c.windKmh)} km/h): ${WEATHER[c.kind]}`,
        { region: c.id, name: c.name, place: c.place, kind: c.kind, was: c.was, tempC: c.tempC, windKmh: c.windKmh, code: c.code, source });
    }
    this.save();
    this.pushState();
    return { status: 200, body: { ok: true, regions: Object.fromEntries(places.map((p) => [p.id, W.state.weather.regions[p.id].kind])) } };
  }

  async refreshWeather() {
    const ps = this.places(), q = (k) => ps.map((p) => p[k]).join(',');
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${q('lat')}&longitude=${q('lon')}&current=temperature_2m,weather_code,wind_speed_10m`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body = await res.json();
    this.onWeather((Array.isArray(body) ? body : [body]).map((b) => b.current ?? {}), 'world');
  }

  // ---------- news for Discord, via the n8n War Correspondent: big moments at once, and a report after every round ----------
  post(item) {
    if (!this.cfg.n8n) return;
    this.W.newsQ = [...(this.W.newsQ ?? []), { url: this.cfg.site, color: COLOR.null, ...item, title: item.title.slice(0, 250), text: item.text.slice(0, 1800) }].slice(-20);
    this.at('news', 0);
  }

  skies() {
    return REGIONS.map((r) => {
      const w = this.W.state.weather.regions[r.id];
      return `${SKY_ICON[w.kind]} ${r.name}: ${w.kind}${w.place ? ` (${w.place.split(',')[0]}${Number.isFinite(w.tempC) ? `, ${Math.round(w.tempC)}°C` : ''})` : ''}`;
    }).join(' · ');
  }

  news(e) {
    if (!isMoment(e)) return; // captures, wiped-out armies, battles between armies, season start and end
    const s = this.W.state, R = (k) => CAST[k]?.realm;
    const icon = { 'stronghold.captured': '🏰', 'army.routed': '💥', 'battle.resolved': '⚔️', 'season.ended': '🏆', 'season.started': '🚩' }[e.type];
    const title = e.type === 'season.ended' ? `${R(e.data.winner)} won season ${s.season}` : e.type === 'season.started' ? `Season ${s.season} begins` : momentText(e, s, CAST);
    this.post({ title: `${icon} ${title}`, text: `${headline(s, CAST, effectsOf(s)).join(' ')}\n\n${this.skies()}\n\nRound ${E.roundOf(s)} of ${s.maxRounds} · season ${s.season}`, color: COLOR[e.kingdom ?? e.data?.winner ?? null] ?? COLOR.null, kind: e.type });
  }

  // After both generals have moved: the round in plain words, from the narrator.
  roundReport(blueTurn) {
    const s = this.W.state, traces = [`s${s.season}-t${blueTurn - 1}`, `s${s.season}-t${blueTurn}`];
    const evs = this.sql.exec("SELECT json FROM lines WHERE season = ? AND k = 'e' ORDER BY i DESC LIMIT 200", s.season).toArray().map((r) => JSON.parse(r.json).e).reverse();
    const told = (t) => turnStory(evs.filter((e) => e.traceId === t && e.type !== 'turn.started'), s, CAST).lines.join(' ') || 'Nothing happened.';
    this.post({
      title: `📜 Round ${blueTurn / 2} of ${s.maxRounds}: ${headline(s, CAST, effectsOf(s))[0]}`,
      text: `🔴 **${CAST.red.realm}:** ${told(traces[0])}\n🔵 **${CAST.blue.realm}:** ${told(traces[1])}\n\n${headline(s, CAST, effectsOf(s)).slice(1).join(' ')}\n\n${this.skies()}`,
      kind: 'round',
    });
  }

  async flushNews() {
    const q = this.W.newsQ ?? [];
    this.W.newsQ = [];
    for (const item of q) {
      await fetch(`${this.cfg.n8n}/webhook/news`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': this.cfg.secret }, body: JSON.stringify(item), signal: AbortSignal.timeout(8000),
      }).catch((err) => console.error('news not delivered:', err.message));
    }
  }

  // ---------- the cron tick (every 10 minutes): keep n8n awake, and fill in for it if it's quiet ----------
  async tick() {
    if (!this.W) return;
    const W = this.W;
    if (W.state.status === 'running' && !W.pending && !W.timers.turn) this.schedule(Math.max(3000, (W.nextTurnAt ?? 0) - Date.now()));
    if (W.state.status === 'ended' && !W.timers.season && !W.timers.seasonEnd) this.at('season', 5000);
    this.arm();
    if (this.cfg.n8n) await fetch(`${this.cfg.n8n}/healthz`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.ok && (W.n8nAt = Date.now())).catch(() => {});
    if (Date.now() - (W.pricesAt ?? 0) > 20 * 60_000) await this.refreshPrices().catch((err) => console.error('oracle read failed:', err.shortMessage ?? err.message));
    const unread = Object.values(W.state.weather.regions).some((w) => !Number.isFinite(w.tempC)); // e.g. right after an upgrade
    if (unread || Date.now() - (W.weatherAt ?? 0) > 50 * 60_000) await this.refreshWeather().catch((err) => console.error('weather read failed:', err.message));
    this.save();
  }

  // ---------- HTTP ----------
  allow(ip) {
    const now = Date.now(), h = this.hits.get(ip) ?? { n: 0, t: now };
    if (now - h.t > 60_000) Object.assign(h, { n: 0, t: now });
    h.n++;
    this.hits.set(ip, h);
    if (this.hits.size > 5000) this.hits.clear(); // ponytail: crude cap on the in-memory limiter
    return h.n <= 300;
  }

  authorized(req) {
    const enc = new TextEncoder(), got = enc.encode(req.headers.get('x-realm-secret') ?? ''), want = enc.encode(this.cfg.secret);
    return want.length > 0 && got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
  }

  live(req, ip) {
    if (req.headers.get('upgrade') !== 'websocket') return json(426, { error: 'expected a WebSocket upgrade' });
    if (this.ctx.getWebSockets().length >= 500 || this.ctx.getWebSockets(ip).length >= 5) return json(429, { error: 'too many live connections' });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [ip]);
    server.send(JSON.stringify({ kind: 'snapshot', data: { ...this.publicState(), events: this.recent(100) } }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage() { /* spectators never send anything that matters; pings are auto-answered */ }

  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch { /* already closed */ }
  }

  // Can this visitor use this AI feature now? 'visitor' (their limit), 'resting' (the day's or the free tier's), or null,
  // which also counts the use.
  quota(kind, ip) {
    const L = AI[kind], now = Date.now(), hits = (this.aiHits[kind] ??= new Map());
    const mine = (hits.get(ip) ?? []).filter((t) => now - t < L.windowMs);
    if (mine.length >= L.perIp) return 'visitor';
    const day = new Date().toISOString().slice(0, 10);
    if (this.W.aiDaily?.day !== day) this.W.aiDaily = { day };
    const used = this.W.aiDaily[kind] ?? 0, st = this.llm.status();
    const ready = st.mode === 'live' || (st.soon && L.maxWait); // a per-minute pause is one a patient caller can wait out
    if (!ready || used >= L.perDay || this.llm.usage.tokens >= this.llm.tokenCap * L.maxShare) return 'resting';
    hits.set(ip, [...mine, now]);
    if (hits.size > 5000) hits.clear(); // ponytail: crude cap, like the request limiter
    this.W.aiDaily[kind] = used + 1;
    return null;
  }

  // "Ask the general": a viewer's question, answered in character from the live game. Past its budget, the general's
  // latest journal note answers.
  async ask(req, ip) {
    if (req.method !== 'POST') return json(405, { error: 'POST a question' });
    const body = await req.json().catch(() => ({}));
    const k = body.kingdom, q = typeof body.question === 'string' ? clean(body.question, 40).slice(0, 200) : '', business = body.view === 'business';
    if (!isKingdom(k) || q.length < 3) return json(400, { error: 'Pick a general and ask a question.' });
    const s = this.W.state, who = CAST[k].general, key = `${s.season}:${s.turn}:${k}:${business}:${q.toLowerCase()}`;
    if (this.answers.has(key)) return json(200, this.answers.get(key));
    const why = this.quota('ask', ip);
    if (why === 'visitor') return json(429, { error: `${who} answers ${AI.ask.perIp} questions per visitor every 10 minutes. Try again soon.` });
    if (why) {
      const note = this.W.memory.journal[k].at(-1)?.note;
      return json(200, { who, mode: 'resting', answer: note ? `I'm resting to stay on the free AI tier. My latest journal note: "${note}"` : 'I\'m resting to stay on the free AI tier. Ask me again tomorrow.' });
    }
    try {
      const out = { who, mode: 'live', model: this.llm.model, answer: (await answer({ s, k, mem: this.W.memory, llm: this.llm, question: q, business })) || 'No comment.' };
      if (this.answers.size > 200) this.answers.clear();
      this.answers.set(key, out);
      return json(200, out);
    } catch (err) {
      console.error('ask failed:', err);
      return json(503, { error: `${who} couldn't answer just now. Try again in a minute.` });
    } finally {
      this.save(); // keeps the AI usage and the daily question count
    }
  }

  // "Get your free plan": a visitor describes their business; the AI drafts how Umar could automate it (server/plan.js).
  async plan(req, ip) {
    if (req.method !== 'POST') return json(405, { error: 'POST your request' });
    const body = await req.json().catch(() => ({}));
    const request = typeof body.text === 'string' ? clean(body.text, 120).slice(0, 700) : '';
    if (request.length < 10) return json(400, { error: 'Tell me a little about your business first: a sentence or two is enough.' });
    const key = `plan:${new Date().toISOString().slice(0, 10)}:${request.toLowerCase()}`;
    if (this.answers.has(key)) return json(200, this.answers.get(key));
    const why = this.quota('plan', ip);
    if (why === 'visitor') return json(429, { error: `That's ${AI.plan.perIp} plans this hour. Book a call and Umar will map the rest with you.` });
    if (why) return json(503, { error: 'The planner is resting to stay on the free AI tier. Book a call and Umar will map it with you directly.' });
    try {
      const out = { plan: await draftPlan({ llm: this.llm, request, maxWait: AI.plan.maxWait }), model: this.llm.model };
      if (this.answers.size > 200) this.answers.clear();
      this.answers.set(key, out);
      return json(200, out);
    } catch (err) {
      console.error('plan failed:', err);
      return json(503, { error: 'The planner couldn\'t finish this one. Try again in a minute, or book a call.' });
    } finally {
      this.save(); // keeps the AI usage and the daily count
    }
  }

  health() {
    const W = this.W;
    return {
      ok: true, world: W.state.status, season: W.state.season, turn: W.state.turn, viewers: this.ctx.getWebSockets().length,
      n8n: !this.cfg.n8n ? 'off (world runs turns directly)' : Date.now() - (W.n8nAt ?? 0) < 900_000 ? 'ok' : 'no recent contact',
      chain: this.chain.enabled ? `${this.chain.name} ${this.chain.ledger}` : 'off',
      oracle: Object.fromEntries(COINS.map((c) => [c, W.prices[c]?.usd ?? null])), weather: W.state.weather,
      llmMode: this.llm.status().mode, model: this.llm.model, llmCallsToday: this.llm.usage.calls, nextTurnAt: W.nextTurnAt, timers: W.timers,
    };
  }

  async fetch(req) {
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get('cf-connecting-ip') ?? 'local';
    try {
      if (p.startsWith('/internal/')) return await this.internal(req, p);
      if (!this.allow(ip)) return json(429, { error: 'slow down' });
      if (!this.W) return json(503, { error: 'the world has not started yet' });
      if (p === '/api/live') return this.live(req, ip);
      if (p === '/api/ask') return await this.ask(req, ip);
      if (p === '/api/plan') return await this.plan(req, ip);
      if (p === '/api/state') return json(200, this.publicState());
      if (p === '/api/health') return json(200, this.health());
      if (p === '/api/proof') return json(200, this.publicState().proofs);
      if (p === '/api/weather') { // for the n8n Weather Sync workflow: this season's city for each region, in order
        return json(200, { regions: this.places().map((p) => ({ ...p, now: this.W.state.weather.regions[p.id] })) });
      }
      if (p === '/api/seasons') return json(200, this.W.history.map((h) => ({ ...h, live: h.season === this.W.state.season && this.W.state.status === 'running' })));
      const sf = p.match(/^\/api\/seasons\/(\d+)$/);
      if (sf) {
        const rows = this.sql.exec('SELECT json FROM lines WHERE season = ? ORDER BY i', +sf[1]).toArray();
        if (!rows.length) return json(404, { error: 'no recording for that season' });
        return new Response(`${rows.map((r) => r.json).join('\n')}\n`, { headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' } });
      }
      if (p === '/api/events') {
        const since = url.searchParams.get('since'), limit = Math.min(200, +url.searchParams.get('limit') || 100);
        if (since === null) return json(200, this.recent(limit));
        return json(200, this.sql.exec("SELECT json FROM lines WHERE k = 'e' AND eid > ? ORDER BY i LIMIT ?", +since, limit).toArray().map((r) => JSON.parse(r.json).e));
      }
      const b = p.match(/^\/api\/battles\/(\d+)\/(\d+)$/);
      if (b) {
        const hit = this.sql.exec('SELECT json, hash FROM battles WHERE season = ? AND turn = ?', +b[1], +b[2]).toArray()[0];
        return hit ? json(200, { battle: JSON.parse(hit.json), canonicalJson: hit.json, keccak256: hit.hash }) : json(404, { error: 'no battle on that turn' });
      }
      return json(404, { error: 'not found' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'internal error' });
    }
  }

  async internal(req, p) {
    if (!this.authorized(req)) return json(401, { error: 'bad or missing X-Realm-Secret' });
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (p === '/internal/import') return this.import(body);
    if (!this.W) return json(503, { error: 'the world has not started yet' });
    const W = this.W, exec = clean(req.headers.get('x-n8n-execution'), 1).slice(0, 24);
    if (exec) W.n8nAt = Date.now(); // saved: the object may sleep between calls
    const km = p.match(/^\/internal\/kingdoms\/(red|blue)\/resources$/);
    if (km && req.method === 'GET') {
      const k = km[1], K = W.state.kingdoms[k];
      if (exec) this.emit('n8n.workflow_started', k, `Turn Router automation (execution #${exec}) picked up the turn and checked ${CAST[k].realm}'s stores`, { executionId: exec, workflow: 'Turn Router' }, W.pending?.traceId);
      this.save();
      return json(200, { kingdom: k, gold: K.gold, food: K.food, capacity: CFG.food.cap, lowFoodBelow: CFG.food.cap * CFG.food.lowPct, reorderTo: CFG.food.cap * CFG.food.reorderTo, strength: W.state.armies[k].strength });
    }
    if (req.method !== 'POST') return json(404, { error: 'not found' });
    if (p === '/internal/agent/decide') {
      if (!isKingdom(body.kingdom)) return json(400, { reason: 'kingdom must be red or blue' });
      if (W.pending?.kingdom !== body.kingdom) return json(409, { reason: `it is not ${body.kingdom}'s turn` });
      const d = await this.runDecision(body.kingdom, W.pending.traceId, typeof body.retryReason === 'string' ? clean(body.retryReason) : undefined);
      this.save();
      return json(200, { ...d, kingdom: body.kingdom, traceId: W.pending?.traceId ?? body.traceId, usage: { callsToday: this.llm.usage.calls, tokensToday: this.llm.usage.tokens } });
    }
    if (p === '/internal/actions') {
      if (!isKingdom(body.kingdom) || typeof body.action !== 'string') return json(400, { reason: 'kingdom and action are required' });
      const args = pickArgs(body.args);
      const r = body.action === 'buy_food'
        ? this.quartermaster(body.kingdom, args.n, W.pending?.traceId ?? this.trace(), exec)
        : this.applyGeneral(body.kingdom, { action: body.action, args, memory_note: clean(body.memory_note, 25) }, exec ? 'n8n' : 'api', exec);
      return json(r.status, r.body);
    }
    if (p === '/internal/oracle/prices') {
      const rounds = {};
      for (const c of COINS) {
        const raw = body.feeds?.[c];
        if (typeof raw === 'string' && /^0x[0-9a-fA-F]{320}$/.test(raw)) rounds[c] = decodeRoundData(raw);
      }
      if (!Object.keys(rounds).length) return json(400, { reason: 'feeds must map ETH, BTC and LINK to the hex result of latestRoundData()' });
      this.onPrices(rounds, body.source === 'n8n' ? 'n8n' : 'api', exec);
      return json(200, { ok: true, prices: Object.fromEntries(Object.entries(rounds).map(([c, r]) => [c, r.answer / 1e8])) });
    }
    if (p === '/internal/oracle/refresh') {
      await this.refreshPrices();
      return json(200, { ok: true, prices: W.prices });
    }
    if (p === '/internal/weather') {
      const r = this.onWeather(body.current, body.source === 'n8n' ? 'n8n' : 'api', exec);
      return json(r.status, r.body);
    }
    if (p === '/internal/news/posted') {
      this.emit('n8n.news_posted', null, `War Correspondent automation (execution #${exec || '?'}) posted to Discord: ${clean(body.title, 20)}`, { executionId: exec, title: clean(body.title, 20) });
      this.save();
      return json(200, { ok: true });
    }
    if (p === '/internal/tick') {
      await this.tick();
      return json(200, this.health());
    }
    return json(404, { error: 'not found' });
  }

  // One-off: move a world in (from the old Node server's world.json and season files), or start a fresh one.
  import(body) {
    if (this.W && !body.force) return json(409, { error: 'a world already exists; pass force to replace it' });
    const old = body.world;
    this.sql.exec('DELETE FROM lines');
    this.sql.exec('DELETE FROM battles');
    const W = old ? structuredClone(old) : {
      state: E.newSeason(1, this.cfg.scenario), nextId: 1, startedTurn: null, outbox: [], history: [],
      counters: { decisions: 0, toolCalls: 0, automations: 0, oracleReads: 0, receipts: 0 },
      memory: { journal: { red: [], blue: [] }, lessons: { red: [], blue: [] } },
    };
    W.state = E.upgrade(W.state);
    W.prices ??= W.price ? { ETH: W.price } : {};
    for (const b of W.battles ?? []) this.sql.exec('INSERT OR REPLACE INTO battles (season, turn, json, hash) VALUES (?, ?, ?, ?)', b.season, b.turn, b.json, b.hash);
    for (const [n, text] of Object.entries(body.seasons ?? {})) {
      for (const l of String(text).split('\n')) {
        if (!l.trim()) continue;
        const line = JSON.parse(l);
        this.record(line, +n);
      }
    }
    delete W.events;
    delete W.battles;
    delete W.price;
    Object.assign(W, { timers: {}, pending: null, newsQ: [] });
    W.history ??= [];
    if (!W.history.some((h) => h.season === W.state.season)) W.history.push({ season: W.state.season, scenario: this.cfg.scenario, startedAt: new Date().toISOString() });
    this.W = W;
    this.llm = makeLLM(this.env, (W.llmUsage ??= {}));
    if (!old) {
      this.record({ k: 's', s: this.snapshot() });
      const places = this.places().map((p) => p.place);
      this.emit('season.started', null, `Season ${W.state.season} begins under real skies over ${places.map((n) => n.split(',')[0]).join(', ')}.`, { places });
    }
    if (W.state.status === 'ended') this.at('season', 5000);
    else this.schedule(Math.max(3000, (W.nextTurnAt ?? 0) - Date.now()));
    if (W.outbox.some((i) => ['queued', 'sent'].includes(i.status)) && this.chain.enabled) this.at('pump', 1000);
    this.save();
    return json(200, this.health());
  }
}
