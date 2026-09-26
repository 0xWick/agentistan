// World server: owns the truth. Turn clock, hand-off to n8n, agent runtime, chain outbox, public API and live stream.
import http from 'node:http';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256, stringToHex } from 'viem';
import * as E from './engine.js';
import { CFG, CAST, MAP } from './config.js';
import { makeLLM, decide, lesson, clean } from './agent.js';
import { makeChain, decodeRoundData, KINGDOM_ID } from './chain.js';
import { LENS } from '../web/lens.js';

const env = process.env;
const PORT = +(env.PORT || 8080);
const SECRET = env.REALM_SECRET || '';
const N8N_TURN_URL = env.N8N_TURN_WEBHOOK || ''; // empty = the world runs every turn itself (no n8n)
// 30 min: 48 AI decisions/day ~ 130k tokens, 65% of the Groq free tier (200k tokens/day). See README.
const TURN_INTERVAL = +(env.TURN_INTERVAL_MS || 1_800_000);
const TURN_TIMEOUT = +(env.TURN_TIMEOUT_MS || 90_000);
const IDLE_AFTER = env.IDLE_MODE === 'pause' ? +(env.IDLE_AFTER_MS || 300_000) : Infinity; // opt-in: the default pace already fits the free quota 24/7
const RESULTS_MS = +(env.RESULTS_MS || 60_000);
const SCENARIO = env.SCENARIO || 'standard';
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const DATA = join(DATA_DIR, 'world.json');
const seasonFile = (n) => join(DATA_DIR, 'seasons', `season-${n}.jsonl`);
const PUBLIC = { owner: env.PUBLIC_OWNER_NAME || 'the builder', hireUrl: env.PUBLIC_HIRE_URL || '', repoUrl: env.PUBLIC_REPO_URL || '', email: env.PUBLIC_CONTACT_EMAIL || '' };

const chain = makeChain(env);

// ---------- persistence: one JSON snapshot, written atomically after every change ----------
// ponytail: whole-file JSON snapshot; move to SQLite if history must outlive the 400-event window.
const fresh = () => ({
  state: E.newSeason(1, SCENARIO), events: [], nextId: 1, startedTurn: null, price: null, outbox: [], battles: [],
  counters: { decisions: 0, toolCalls: 0, automations: 0, oracleReads: 0, receipts: 0 },
  memory: { journal: { red: [], blue: [] }, lessons: { red: [], blue: [] } },
});
let W = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : fresh();
const llm = makeLLM(env, (W.llmUsage ??= {})); // usage lives in the snapshot, so the daily cap survives restarts
function save() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(`${DATA}.tmp`, JSON.stringify(W));
  renameSync(`${DATA}.tmp`, DATA);
}

// ---------- season history: every event plus a snapshot per turn, append-only, one file per season ----------
// The UI replays these as timelapses (/?season=N), so past seasons stay watchable.
const snapshot = () => {
  const { meta, ...s } = publicState();
  return { at: new Date().toISOString(), ...s };
};
function record(line) {
  mkdirSync(join(DATA_DIR, 'seasons'), { recursive: true });
  appendFileSync(seasonFile(W.state.season), `${JSON.stringify(line)}\n`);
}
const seasonInfo = (n) => W.history.find((h) => h.season === n);

// ---------- events + live stream ----------
const clients = new Set();
let paused = false, lastViewerAt = Date.now(), lastN8nAt = 0, stateTimer = null;
const trace = () => `s${W.state.season}-t${W.state.turn}`;
const COUNT = { 'agent.decision': 'decisions', 'agent.tool_called': 'toolCalls', 'n8n.workflow_started': 'automations', 'oracle.price_update': 'oracleReads', 'chain.tx_confirmed': 'receipts' };

function emit(type, kingdom, summary, data = {}, traceId = trace()) {
  const e = { id: W.nextId++, ts: new Date().toISOString(), season: W.state.season, turn: W.state.turn, traceId, stage: LENS[type]?.[0] ?? 'game', type, kingdom: kingdom ?? null, summary, lensKey: type, data };
  if (COUNT[type]) W.counters[COUNT[type]]++;
  W.events.push(e);
  if (W.events.length > 400) W.events.splice(0, W.events.length - 400);
  record({ k: 'e', e });
  broadcast('event', e);
  return e;
}

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}

function pushState() { // coalesce bursts of changes into one state message
  stateTimer ??= setTimeout(() => {
    stateTimer = null;
    broadcast('state', publicState());
  }, 100);
}

function publicState() {
  return {
    state: W.state,
    counters: W.counters,
    proofs: W.outbox.slice(-25).reverse().map(({ id, label, kind, status, hash, block, ethUsd, error }) => ({ id, label, kind, status, hash, block, ethUsd, error })),
    journals: { red: W.memory.journal.red.slice(-4), blue: W.memory.journal.blue.slice(-4) },
    lessons: { red: W.memory.lessons.red.slice(-3), blue: W.memory.lessons.blue.slice(-3) },
    meta: {
      llm: { ...llm.status(), model: llm.model, callsToday: llm.usage.calls, tokensToday: llm.usage.tokens },
      chain: { name: chain.name, explorer: chain.explorer, ledger: chain.ledger, feed: chain.feed, enabled: chain.enabled },
      n8n: Boolean(N8N_TURN_URL), price: W.price, amplify: CFG.market.amplify, viewers: clients.size, paused,
      turnIntervalMs: TURN_INTERVAL, nextTurnAt: pending ? null : nextTurnAt, public: PUBLIC, map: MAP, cast: CAST,
    },
  };
}

// ---------- the turn loop ----------
let pending = null; // the turn waiting for an order: { traceId, kingdom, timer }
let nextTimer = null, nextTurnAt = 0;
const schedule = (ms = TURN_INTERVAL) => {
  clearTimeout(nextTimer);
  nextTimer = setTimeout(beginTurn, ms);
  W.nextTurnAt = nextTurnAt = Date.now() + ms;
  save(); // a restart keeps the 30-minute rhythm instead of playing a turn early
};

async function beginTurn() {
  if (W.state.status !== 'running' || pending) return;
  if (!clients.size && Date.now() - lastViewerAt > IDLE_AFTER) { // nobody watching: save the free AI quota
    paused = true;
    return pushState();
  }
  const traceId = trace();
  if (W.startedTurn !== traceId) { // restart-safe: a turn's economy is never applied twice
    const r = E.startTurn(W.state);
    W.state = r.state;
    W.startedTurn = traceId;
    r.events.forEach((e) => emit(e.type, e.kingdom, e.summary, e.data, traceId));
    save();
  }
  const k = W.state.active;
  pending = { traceId, kingdom: k, timer: setTimeout(() => watchdog(traceId), TURN_TIMEOUT) };
  pushState();
  if (W.state.armies[k].routed) return applyGeneral(k, { action: 'hold', args: {} }, 'world');
  if (N8N_TURN_URL) {
    try {
      const res = await fetch(N8N_TURN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-realm-secret': SECRET },
        body: JSON.stringify({ season: W.state.season, turn: W.state.turn, kingdom: k, traceId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return; // n8n drives the rest of the turn; the watchdog covers us if it never answers
    } catch (err) {
      emit('n8n.unreachable', k, `n8n did not answer (${clean(err.message, 8)}), so the world runs this turn itself`, {}, traceId);
    }
  }
  // Same steps as the n8n Turn Router, in-process.
  const K = W.state.kingdoms[k];
  if (K.food < CFG.food.cap * CFG.food.lowPct) quartermaster(k, Math.round(CFG.food.cap * CFG.food.reorderTo - K.food), traceId);
  applyGeneral(k, await runDecision(k, traceId), 'world');
}

const runDecision = (k, traceId, retryReason) =>
  decide({ s: W.state, k, mem: W.memory, llm, retryReason, emit: (type, summary, data) => emit(type, k, summary, data, traceId) });

function quartermaster(k, n, traceId, executionId) {
  const r = E.applyAction(W.state, k, { action: 'buy_food', args: { n } });
  if (r.error) return { status: 422, body: { reason: r.error } };
  if (executionId) emit('n8n.threshold_alert', k, `Food below 20%: the Supply Alert automation reordered food for ${CAST[k].realm} (execution #${executionId})`, { executionId, n }, traceId);
  W.state = r.state;
  r.events.forEach((e) => emit(e.type, e.kingdom, e.summary, e.data, traceId));
  save();
  pushState();
  return { status: 200, body: { ok: true } };
}

function applyGeneral(k, d, via, executionId) {
  if (pending?.kingdom !== k) return { status: 409, body: { reason: `no turn is waiting for ${k}` } };
  const { traceId } = pending, turn = W.state.turn;
  const r = E.applyAction(W.state, k, { action: d.action, args: d.args ?? {} });
  if (r.error) return { status: 422, body: { reason: r.error } };
  clearTimeout(pending.timer);
  pending = null;
  W.state = r.state;
  r.events.forEach((e) => emit(e.type, e.kingdom, e.summary, e.data, traceId));
  if (d.memory_note) {
    W.memory.journal[k] = [...W.memory.journal[k], { turn, note: d.memory_note }].slice(-20);
    emit('agent.memory_written', k, `${CAST[k].general}'s journal: "${d.memory_note}"`, { note: d.memory_note }, traceId);
  }
  if (via === 'n8n') emit('n8n.workflow_finished', k, `Turn Router delivered ${CAST[k].general}'s order to the game (execution #${executionId})`, { executionId }, traceId);
  if (r.battle) {
    const json = JSON.stringify(r.battle); // canonical battle record; its hash goes on-chain with any capture
    W.battles = [...W.battles, { season: r.battle.season, turn, json, hash: keccak256(stringToHex(json)) }].slice(-100);
  }
  for (const e of r.events.filter((x) => x.type === 'stronghold.captured')) {
    enqueue('capture', [W.state.season, turn, e.data.strongholdId, KINGDOM_ID[e.kingdom], W.battles.at(-1).hash], `Turn ${turn} · ${CAST[e.kingdom].realm} captured ${e.data.name}`, traceId);
  }
  record({ k: 's', s: snapshot() });
  save();
  pushState();
  if (W.state.status === 'ended') endSeason();
  else schedule();
  return { status: 200, body: { ok: true } };
}

function watchdog(traceId) {
  if (pending?.traceId !== traceId) return;
  const k = pending.kingdom;
  emit('turn.timeout', k, `${CAST[k].general} hesitated: no order within ${TURN_TIMEOUT / 1000}s, so the army holds`, {}, traceId);
  applyGeneral(k, { action: 'hold', args: {} }, 'watchdog');
}

async function endSeason() {
  const s = W.state;
  Object.assign(seasonInfo(s.season) ?? {}, { endedAt: new Date().toISOString(), winner: s.winner, reason: s.endReason, rounds: E.roundOf(s), turns: s.turn });
  enqueue('season', [s.season, KINGDOM_ID[s.winner], E.roundOf(s), keccak256(stringToHex(JSON.stringify(s)))], `Season ${s.season} · ${CAST[s.winner].realm} won`, trace());
  for (const k of ['red', 'blue']) {
    const l = await lesson({ s, k, llm });
    W.memory.lessons[k] = [...W.memory.lessons[k], l].slice(-10);
    emit('agent.lesson', k, `${CAST[k].general}'s lesson: "${l}"`, { lesson: l });
  }
  record({ k: 's', s: snapshot() }); // the recording ends with the lessons
  save();
  pushState();
  nextTimer = setTimeout(startSeason, RESULTS_MS);
}

function startSeason() {
  W.state = E.newSeason(W.state.season + 1, SCENARIO, W.price?.usd ?? null);
  W.memory.journal = { red: [], blue: [] };
  W.startedTurn = null;
  W.history.push({ season: W.state.season, scenario: SCENARIO, startedAt: new Date().toISOString() });
  record({ k: 's', s: snapshot() });
  emit('season.started', null, `Season ${W.state.season} begins. The generals remember last season's lessons.`);
  save();
  pushState();
  schedule(3000);
}

// ---------- chain outbox: one sender, strict order, retries with backoff; a chain outage never stops the game ----------
let pumping = false;
function enqueue(kind, args, label, traceId) {
  W.outbox.push({ id: (W.outbox.at(-1)?.id ?? 0) + 1, kind, args, label, traceId, status: 'queued', tries: 0, checks: 0, nextTry: 0 });
  W.outbox = W.outbox.filter((i, n, all) => n >= all.length - 200 || !['confirmed', 'failed'].includes(i.status));
  emit('chain.tx_queued', null, `Receipt queued: ${label}${chain.enabled ? '' : ' (no chain configured yet)'}`, {}, traceId);
  pump();
}

async function pump() {
  if (pumping || !chain.enabled) return;
  pumping = true;
  try {
    for (const item of W.outbox) {
      if (!['queued', 'sent'].includes(item.status)) continue;
      if (item.nextTry > Date.now()) break; // keep strict order
      await deliver(item);
      save();
      pushState();
      if (item.status !== 'confirmed' && item.status !== 'failed') break;
    }
  } finally {
    pumping = false;
  }
}

async function deliver(item) {
  try {
    if (item.status === 'queued') {
      item.tries++;
      item.hash = await chain.send(item.kind, item.args);
      item.status = 'sent';
      save();
      emit('chain.tx_sent', null, `Receipt sent to the ${chain.name} chain: ${item.label}`, { hash: item.hash }, item.traceId);
    }
    const r = await chain.confirm(item.hash);
    Object.assign(item, { status: 'confirmed', error: null }, r);
    emit('chain.tx_confirmed', null, `On-chain receipt confirmed: ${item.label}${r.ethUsd ? ` · ETH $${r.ethUsd.toFixed(2)} at capture` : ''}`,
      { hash: item.hash, block: r.block, ethUsd: r.ethUsd, url: chain.explorer && `${chain.explorer}/tx/${item.hash}` }, item.traceId);
  } catch (err) {
    item.error = clean(err.shortMessage ?? err.message, 20);
    if (err.fatal || /revert/i.test(item.error)) {
      item.status = 'failed';
      emit('chain.tx_failed', null, `Receipt failed: ${item.label} (${item.error})`, {}, item.traceId);
    } else {
      // a sent tx whose receipt never shows up (e.g. the node restarted) is re-sent after 3 checks
      if (item.status === 'sent' && ++item.checks >= 3) Object.assign(item, { status: 'queued', checks: 0 });
      item.nextTry = Date.now() + Math.min(300_000, 5000 * 2 ** item.tries);
    }
  }
}

// ---------- oracle ----------
function onPrice({ roundId, answer, updatedAt }, source, executionId) {
  const usd = answer / 1e8, before = W.state.market.mult, newRound = roundId !== W.price?.roundId;
  W.price = { usd, roundId, updatedAt, source, at: new Date().toISOString() };
  W.state = E.setPrice(W.state, usd);
  if (!newRound || paused) { // same Chainlink round as last read: count it, don't fill the log with it
    W.counters.oracleReads++;
    if (executionId) W.counters.automations++;
    return save();
  }
  if (executionId) emit('n8n.workflow_started', null, `Market Sync automation (execution #${executionId}) read the ETH price from Chainlink`, { executionId, workflow: 'Market Sync' });
  const age = Math.max(0, Math.round((Date.now() / 1000 - updatedAt) / 60));
  emit('oracle.price_update', null, `Chainlink ETH/USD: $${usd.toFixed(2)} (feed updated ${age} min ago, fetched by ${source === 'n8n' ? 'n8n' : 'the world server'})`, { usd, roundId, updatedAt, source });
  const after = W.state.market.mult;
  if (Math.abs(after - before) >= 0.01) {
    const pct = ((usd / W.state.market.start - 1) * 100).toFixed(2);
    emit('market.shift', 'red', `ETH is ${pct}% vs season start: Emberreach income x${before} → x${after} (effect amplified ${CFG.market.amplify}x)`, { before, after, pct: +pct });
  }
  save();
  pushState();
}

const refreshPrice = async () => onPrice(await chain.readFeed(), 'world');

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const send = (res, status, body) => {
  res.writeHead(status, { ...HEADERS, 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const ipOf = (req) => String(req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress).split(',')[0].trim();

const hits = new Map(); // ponytail: in-memory per-IP limiter, fine for one process
function allow(req) {
  const ip = ipOf(req), now = Date.now(), h = hits.get(ip) ?? { n: 0, t: now };
  if (now - h.t > 60_000) Object.assign(h, { n: 0, t: now });
  hits.set(ip, { ...h, n: h.n + 1 });
  return h.n < 300;
}

function authorized(req) {
  const got = Buffer.from(String(req.headers['x-realm-secret'] ?? '')), want = Buffer.from(SECRET);
  return SECRET.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size <= 65_536) return chunks.push(c);
      reject(new Error('body too large'));
      req.destroy();
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const pickArgs = (a) => Object.fromEntries(['x', 'y', 'n'].filter((f) => a?.[f] != null && Number.isFinite(+a[f])).map((f) => [f, Math.trunc(+a[f])]));
const isKingdom = (k) => k === 'red' || k === 'blue';

function stream(req, res) {
  const ip = ipOf(req);
  if (clients.size >= 500 || [...clients].filter((c) => c.ip === ip).length >= 5) return send(res, 429, { error: 'too many live connections' });
  res.writeHead(200, { ...HEADERS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.ip = ip;
  res.write(`event: snapshot\ndata: ${JSON.stringify({ ...publicState(), events: W.events.slice(-100) })}\n\n`);
  clients.add(res);
  lastViewerAt = Date.now();
  if (paused) {
    paused = false;
    schedule(1000);
  }
  req.on('close', () => {
    clients.delete(res);
    lastViewerAt = Date.now();
  });
}

async function internal(req, res, p) {
  if (!authorized(req)) return send(res, 401, { error: 'bad or missing X-Realm-Secret' });
  const exec = clean(req.headers['x-n8n-execution'], 1).slice(0, 24);
  if (exec) lastN8nAt = Date.now();
  const km = p.match(/^\/internal\/kingdoms\/(red|blue)\/resources$/);
  if (km && req.method === 'GET') {
    const k = km[1], K = W.state.kingdoms[k];
    if (exec) emit('n8n.workflow_started', k, `Turn Router automation (execution #${exec}) picked up the turn and checked ${CAST[k].realm}'s stores`, { executionId: exec, workflow: 'Turn Router' }, pending?.traceId);
    return send(res, 200, { kingdom: k, gold: K.gold, food: K.food, capacity: CFG.food.cap, lowFoodBelow: CFG.food.cap * CFG.food.lowPct, reorderTo: CFG.food.cap * CFG.food.reorderTo, strength: W.state.armies[k].strength });
  }
  if (req.method !== 'POST') return send(res, 404, { error: 'not found' });
  const body = await readJson(req);
  if (p === '/internal/agent/decide') {
    if (!isKingdom(body.kingdom)) return send(res, 400, { reason: 'kingdom must be red or blue' });
    if (pending?.kingdom !== body.kingdom) return send(res, 409, { reason: `it is not ${body.kingdom}'s turn` });
    const d = await runDecision(body.kingdom, pending.traceId, typeof body.retryReason === 'string' ? clean(body.retryReason) : undefined);
    return send(res, 200, { ...d, kingdom: body.kingdom, traceId: pending?.traceId ?? body.traceId, usage: { callsToday: llm.usage.calls, tokensToday: llm.usage.tokens } });
  }
  if (p === '/internal/actions') {
    if (!isKingdom(body.kingdom) || typeof body.action !== 'string') return send(res, 400, { reason: 'kingdom and action are required' });
    const args = pickArgs(body.args);
    const r = body.action === 'buy_food'
      ? quartermaster(body.kingdom, args.n, pending?.traceId ?? trace(), exec)
      : applyGeneral(body.kingdom, { action: body.action, args, memory_note: clean(body.memory_note, 25) }, exec ? 'n8n' : 'api', exec);
    return send(res, r.status, r.body);
  }
  if (p === '/internal/oracle/price') {
    if (typeof body.raw !== 'string' || !/^0x[0-9a-fA-F]{320}$/.test(body.raw)) return send(res, 400, { reason: 'raw must be the hex result of latestRoundData()' });
    const round = decodeRoundData(body.raw);
    if (round.answer <= 0) return send(res, 400, { reason: 'feed answer must be positive' });
    onPrice(round, body.source === 'n8n' ? 'n8n' : 'api', exec);
    return send(res, 200, { ok: true, usd: round.answer / 1e8 });
  }
  if (p === '/internal/oracle/refresh') {
    await refreshPrice();
    return send(res, 200, { ok: true, price: W.price });
  }
  return send(res, 404, { error: 'not found' });
}

async function serveStatic(res, rel) {
  const file = normalize(join(WEB, rel));
  if (!file.startsWith(WEB) || !TYPES[extname(file)]) return send(res, 404, { error: 'not found' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(file)], 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    send(res, 404, { error: 'not found' });
  }
}

const health = () => ({
  ok: true, world: W.state.status, season: W.state.season, turn: W.state.turn, paused, viewers: clients.size,
  n8n: !N8N_TURN_URL ? 'off (world runs turns directly)' : Date.now() - lastN8nAt < 300_000 ? 'ok' : 'no recent calls',
  chain: chain.enabled ? `${chain.name} ${chain.ledger}` : 'off', oracle: W.price ? `ok, $${W.price.usd}` : 'waiting',
  llmMode: llm.status().mode, model: llm.model, llmCallsToday: llm.usage.calls,
});

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;
    if (p.startsWith('/internal/')) return await internal(req, res, p);
    if (!allow(req)) return send(res, 429, { error: 'slow down' });
    if (p === '/api/stream') return stream(req, res);
    if (p === '/api/state') return send(res, 200, publicState());
    if (p === '/api/health') return send(res, 200, health());
    if (p === '/api/proof') return send(res, 200, publicState().proofs);
    if (p === '/api/seasons') return send(res, 200, W.history.map((h) => ({ ...h, live: h.season === W.state.season && W.state.status === 'running' })));
    const sf = p.match(/^\/api\/seasons\/(\d+)$/);
    if (sf) {
      if (!existsSync(seasonFile(+sf[1]))) return send(res, 404, { error: 'no recording for that season' });
      res.writeHead(200, { ...HEADERS, 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' });
      return createReadStream(seasonFile(+sf[1])).pipe(res);
    }
    if (p === '/api/events') {
      const q = new URL(req.url, 'http://x').searchParams, limit = Math.min(200, +q.get('limit') || 100);
      return send(res, 200, q.has('since') ? W.events.filter((e) => e.id > +q.get('since')).slice(0, limit) : W.events.slice(-limit)); // no since: latest
    }
    const b = p.match(/^\/api\/battles\/(\d+)\/(\d+)$/);
    if (b) {
      const hit = W.battles.find((x) => x.season === +b[1] && x.turn === +b[2]);
      return hit ? send(res, 200, { battle: JSON.parse(hit.json), canonicalJson: hit.json, keccak256: hit.hash }) : send(res, 404, { error: 'no battle on that turn' });
    }
    return await serveStatic(res, p === '/' ? 'index.html' : p === '/how' ? 'how.html' : p === '/history' ? 'history.html' : p.slice(1));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
  }
});

// ---------- boot ----------
server.listen(PORT, env.HOST || '127.0.0.1', () => { // behind a tunnel or proxy; set HOST=0.0.0.0 to expose directly
  console.log(`Nobody's Playing on http://localhost:${PORT} | n8n: ${N8N_TURN_URL || 'off'} | chain: ${chain.enabled ? `${chain.name} ${chain.ledger}` : 'off'} | AI: ${llm.status().mode} (${llm.model})`);
});
W.history ??= [];
if (!existsSync(seasonFile(W.state.season))) {
  // Recording starts now; keep whatever of this season the snapshot still holds.
  const first = W.events.find((e) => e.season === W.state.season);
  W.history = [...W.history.filter((h) => h.season !== W.state.season), { season: W.state.season, scenario: SCENARIO, startedAt: first?.ts ?? new Date().toISOString(), partial: W.state.turn > 1 }];
  record({ k: 's', s: snapshot() });
  W.events.filter((e) => e.season === W.state.season).forEach((e) => record({ k: 'e', e }));
  save();
}
if (!W.events.length) emit('season.started', null, `Season ${W.state.season} begins.`);
if (!W.price || !N8N_TURN_URL) refreshPrice().catch((err) => console.error('oracle read failed:', err.shortMessage ?? err.message));
if (!N8N_TURN_URL) setInterval(() => refreshPrice().catch(() => {}), +(env.MARKET_POLL_MS || 600_000)); // n8n Market Sync does this otherwise
if (W.state.status === 'ended') nextTimer = setTimeout(startSeason, 5000);
else schedule(Math.max(3000, (W.nextTurnAt ?? 0) - Date.now()));
setInterval(pump, 5000);
setInterval(() => clients.forEach((c) => c.write(': ping\n\n')), 25_000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { save(); process.exit(0); });
