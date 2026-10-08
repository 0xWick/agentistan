// Campaigns: every historical war being played, or finished, in one Durable Object.
// A run is a campaign, a seed and each turn's inputs; the page plays it with the same engine, and the server replays
// every turn before it accepts it, so the record is the truth and anyone can watch it, live or later.
// The AI is the strategist of the other sides at the turning points (one request for all of them, with the player's
// advisor's counsel), and the historian at the end. When it is late or out of its free budget, the rules decide.
// A finished campaign goes to n8n's Campaign Herald (the historian's summary, Discord), and becomes an NFT on the
// Regalia contract once the player names an address.
import { DurableObject } from 'cloudflare:workers';
import { createPublicClient, createWalletClient, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CAMPAIGN } from '../web/campaign/catalog.js';
import { newCampaign, resolve, checksum, rulesPlan, armiesOf, PLANS, VERDICT, ENGINE, courtOf, cardsDue, plansFor, withCards } from '../web/campaign/engine.js';
import { situation, normalize, proposal, interpret, summary } from '../web/campaign/court.js';
import { makeLLM, clean } from './agent.js';
import REGALIA from './Regalia.json' with { type: 'json' };
import DEPLOYED from '../deployments/regalia-base-sepolia.json' with { type: 'json' };

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const json = (status, body, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json', 'cache-control': cache } });
const FIRST_TOKEN = 1_000_000; // campaign scrolls share the Regalia contract with the living world's keepsakes, above these ids
const ID = /^[a-z0-9]{10}$/;
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
async function sha(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const parse = (text) => { const m = String(text ?? '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

// The player's inputs, trimmed to what the engine knows. The engine checks the rest (whose army, how far).
function cleanInputs(raw = {}) {
  const out = { orders: {}, raise: {}, cards: {}, peace: {} };
  for (const [id, o] of Object.entries(raw.orders ?? {}).slice(0, 40)) {
    if (!/^[\w-]{1,24}$/.test(id) || !o || typeof o !== 'object') continue;
    out.orders[id] = { to: typeof o.to === 'string' && /^[\w-]{1,32}$/.test(o.to) ? o.to : null, plan: PLANS[o.plan] ? o.plan : null, storm: !!o.storm };
  }
  for (const [id, n] of Object.entries(raw.raise ?? {}).slice(0, 20)) if (/^(@home|[\w-]{1,24})$/.test(id) && Number.isFinite(+n)) out.raise[id] = Math.max(0, Math.min(2000000, Math.round(+n)));
  for (const [id, n] of Object.entries(raw.cards ?? {}).slice(0, 20)) if (/^[\w:-]{1,40}$/.test(id) && Number.isInteger(n) && n >= 0 && n < 6) out.cards[id] = n;
  for (const [id, v] of Object.entries(raw.peace ?? {}).slice(0, 10)) if (/^[\w-]{1,24}$/.test(id) && v === 'offer') out.peace[id] = 'offer';
  return out;
}

export class Campaigns extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.cache = new Map(); // run id → { n, s }: the state after n turns, so a turn is not replayed from the start
    this.pending = new Map(); // `${run}:${n}` → the AI's plans being written
    this.hits = new Map();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, cid TEXT, seed INTEGER, key TEXT, name TEXT, status TEXT, turn INTEGER, created INTEGER, updated INTEGER,
      verdict TEXT, stars INTEGER, why TEXT, summary TEXT, owner TEXT, token INTEGER, nft TEXT, tx TEXT, heralded INTEGER DEFAULT 0, ip TEXT)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS turns (run TEXT, n INTEGER, inputs TEXT, chk TEXT, PRIMARY KEY (run, n))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS plans (run TEXT, n INTEGER, ai TEXT, advice TEXT, by TEXT, PRIMARY KEY (run, n))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    for (const sql of ['ALTER TABLE runs ADD COLUMN v INTEGER', 'ALTER TABLE plans ADD COLUMN proposal TEXT']) { try { this.sql.exec(sql); } catch { /* already there */ } }
    // two free models: when the first has spent its day, the second speaks
    const usage = this.get('usage') ?? {}, usage2 = this.get('usage2') ?? {};
    this.llms = env.LLM_API_KEY ? [
      makeLLM({ ...env, LLM_MODEL: env.CAMPAIGN_MODEL || 'openai/gpt-oss-20b', MAX_LLM_TOKENS_PER_DAY: env.CAMPAIGN_TOKENS || '185000', MAX_LLM_CALLS_PER_DAY: '950', LLM_EXTRA: '{"reasoning_effort":"low"}' }, usage),
      makeLLM({ ...env, LLM_MODEL: env.CAMPAIGN_MODEL_2 || 'qwen/qwen3.8-27b', MAX_LLM_TOKENS_PER_DAY: env.CAMPAIGN_TOKENS_2 || '45000', MAX_LLM_CALLS_PER_DAY: '300', LLM_EXTRA: '{}' }, usage2),
    ] : [];
    this.usage = usage;
    this.usage2 = usage2;
  }
  get llm() { return this.llms.find((l) => l.status().mode === 'live') ?? null; }
  saveUsage() { this.put('usage', this.usage); this.put('usage2', this.usage2); }
  async askAI(system, user, maxTokens, maxWait = 6) {
    const llm = this.llm;
    if (!llm) return null;
    try {
      const { message } = await llm.chat([{ role: 'system', content: system }, { role: 'user', content: user }], undefined, { max_tokens: maxTokens, temperature: 0.6, response_format: { type: 'json_object' }, maxWait });
      return parse(message?.content);
    } catch (err) {
      console.error('campaign AI failed:', err.message);
      return null;
    } finally { this.saveUsage(); }
  }
  old(run) { return (run.v ?? 1) !== ENGINE; } // played under older rules: its record would replay differently now
  get(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? JSON.parse(r.v) : null; }
  put(k, v) { this.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, JSON.stringify(v)); }
  run(id) { return this.sql.exec('SELECT * FROM runs WHERE id = ?', id).toArray()[0] ?? null; }
  turnsOf(id) { return this.sql.exec('SELECT inputs FROM turns WHERE run = ? ORDER BY n', id).toArray().map((r) => JSON.parse(r.inputs)); }
  stateOf(run) {
    const C = CAMPAIGN[run.cid], have = this.cache.get(run.id);
    if (have && have.n === run.turn) return have.s;
    let s = have && have.n < run.turn ? have.s : newCampaign(C, run.seed);
    const turns = this.turnsOf(run.id);
    for (let n = have && have.n < run.turn ? have.n : 0; n < turns.length; n++) s = resolve(s, C, turns[n]).state;
    this.remember(run.id, turns.length, s);
    return s;
  }
  remember(id, n, s) {
    this.cache.set(id, { n, s });
    if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value);
  }
  allow(ip, kind, max, per = 3600_000) {
    const k = `${kind}:${ip}`, now = Date.now(), b = this.hits.get(k) ?? { n: 0, t: now };
    if (now - b.t > per) Object.assign(b, { n: 0, t: now });
    b.n++;
    this.hits.set(k, b);
    if (this.hits.size > 5000) this.hits.clear();
    return b.n <= max;
  }
  authorized(req) {
    const enc = new TextEncoder(), got = enc.encode(req.headers.get('x-realm-secret') ?? ''), want = enc.encode(this.env.REALM_SECRET ?? '');
    return want.length > 0 && got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
  }
  async owns(run, token) { return !!run && typeof token === 'string' && token.length >= 16 && (await sha(token)) === run.key; }
  public(run, withTurns = false) {
    if (!run) return null;
    const out = { id: run.id, cid: run.cid, seed: run.seed, name: run.name, status: run.status, turn: run.turn, created: run.created, updated: run.updated, verdict: run.verdict, stars: run.stars, why: run.why, summary: run.summary, owner: run.owner, token: run.token, nft: run.nft, tx: run.tx, heralded: !!run.heralded, old: this.old(run) };
    if (withTurns) out.turns = this.turnsOf(run.id);
    return out;
  }
  broadcast(id, msg) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets(id)) { try { ws.send(text); } catch { /* closing */ } }
  }
  webSocketMessage() { /* watchers only listen */ }
  webSocketClose(ws, code) { try { ws.close(code, 'bye'); } catch { /* closed */ } }

  // ---------- the AI: the other sides' plans, and the advisor's counsel ----------
  // the AI is asked at the turning points: the first turn, every third, and after a battle, a fallen city or a new war
  turningPoint(run, s) {
    if (s.turn === 0 || s.turn % 3 === 0) return true;
    return (s.log ?? []).some((e) => ['battle', 'capture', 'starved', 'storm', 'war', 'peace', 'alliance', 'hero'].includes(e.type) && !e.minor);
  }
  // The opening counsel of a season: at the turning points the AI plays the other sides and your chief adviser speaks;
  // the rest of the time the rules do. Either way the adviser proposes an order for each of your armies.
  async think(run, s) {
    const C = CAMPAIGN[run.cid], key = `${run.id}:${s.turn}`;
    const sides = Object.keys(C.sides).filter((id) => id !== C.you && s.sides[id].alive);
    const aims = this.get(`aims:${run.id}`) ?? {};
    const base = proposal(C, s, aims);
    const rules = () => ({ ai: {}, advice: null, proposal: base, by: 'rules' });
    if (!this.llm || !this.turningPoint(run, s)) return rules();
    const court = courtOf(C, s), adv = court[0] ?? { id: 'adviser', name: 'your adviser' };
    const system = `You play, in a historical war game, the leaders of every side except the player's, and the player's chief adviser, ${adv.name}${adv.title ? ` (${adv.title})` : ''}. Answer with JSON only:
{"sides": {"<side id>": {"stance": "attack" | "defend" | "delay", "target": "<province id they march on, or null>", "peace": true | false, "say": "<one sentence in character, at most 25 words, what this leader declares this season>"}},
 "advice": ["<one or two short sentences from ${adv.name} to the commander, in character: what to do this season and why>"],
 "orders": {"<id of one of the player's armies>": {"to": "<province id from its 'can reach this season' list, or null to hold>", "plan": "<plan id or null>", "storm": false}}}
The orders are the adviser's proposal for each of the player's armies. Rules of the game: armies march about two provinces a season; battles turn on numbers, ground, the generals' skill and the plan; walled cities need a siege or a costly storm; a side whose will falls below 25 asks for peace. Plans: ${plansFor(C, false).map((p) => `${p} (${PLANS[p].hint})`).join('; ')}.
STRICT: use only the people, armies, places and numbers in the data. The dead cannot act or speak. Never invent battles, deaths or events. Each leader acts in character and in their own interest. Never mock any faith or people; no slurs; nothing graphic. Plain words.`;
    const job = (async () => {
      const out = await this.askAI(system, `${situation(C, s, base)}\nSides to play: ${sides.join(', ')}.`, 1000);
      if (!out) return rules();
      const ai = {};
      for (const id of sides) {
        const p = out.sides?.[id];
        if (!p) continue;
        ai[id] = { stance: ['attack', 'defend', 'delay'].includes(p.stance) ? p.stance : rulesPlan(C, s, id).stance, target: C.prov[p.target] ? p.target : null, peace: p.peace === true, say: clean(p.say, 26), by: 'ai' };
      }
      const advice = (Array.isArray(out.advice) ? out.advice : [out.advice]).filter((x) => typeof x === 'string').map((x) => clean(x, 45)).filter(Boolean).slice(0, 2);
      const prop = out.orders && typeof out.orders === 'object' ? normalize(C, s, base, { orders: out.orders }).draft : base;
      return { ai, advice: advice.length ? advice : null, proposal: prop, by: 'ai' };
    })();
    this.pending.set(key, job);
    const plan = await job;
    this.pending.delete(key);
    return plan;
  }

  // The council: the commander speaks; the council answers in character and turns the words into orders, which the
  // rules then check. The AI does it while the free budget lasts (a few words a season per campaign); the rules
  // otherwise.
  async council(run, s, body) {
    const C = CAMPAIGN[run.cid], text = clean(String(body.message ?? ''), 120).slice(0, 600);
    const draft = normalize(C, s, body.draft ?? {}, {}).draft;
    if (!text) return { replies: [], draft, end: false, by: 'rules' };
    const used = this.get(`talk:${run.id}:${s.turn}`) ?? 0;
    const viaRules = () => ({ ...interpret(C, s, draft, text), by: 'rules' });
    if (!this.llm || used >= +(this.env.COUNCIL_PER_SEASON || 8)) return viaRules();
    this.put(`talk:${run.id}:${s.turn}`, used + 1);
    const court = courtOf(C, s), ids = new Set(court.map((p) => p.id));
    const chat = (Array.isArray(body.chat) ? body.chat : []).slice(-8).map((m) => `${m.who === 'you' ? 'COMMANDER' : String(m.name ?? m.who).slice(0, 40)}: ${clean(String(m.text ?? ''), 80)}`).join('\n');
    const system = `You are the council of ${s.armies && Object.values(s.armies).find((a) => a.hero)?.gen || C.hero.name} in a historical war game (${C.title}, ${C.years}). Its members, by id: ${court.map((p) => `${p.id} = ${p.name}${p.title ? `, ${p.title}` : ''}`).join('; ')}.
The commander speaks to you. Answer in character, briefly: one to three plain sentences from each member who would speak (usually one or two members), as people of that time would talk: loyal, frank, sometimes disagreeing. Then turn the commander's words into orders. Answer questions from the data alone.
STRICT RULES: use only the people, armies, places, numbers and decisions in the data. The dead cannot speak or act. Never invent events, battles or deaths. An army may be ordered to any province; if it is not under "can reach this season", the army goes as far as it can and the rest next season, and you should say so. Keep any order the commander did not change. Your replies must match the orders you return exactly: never say an army will go somewhere unless that order is in your JSON, and if the commander's words change nothing, say so. The commander's own army is the one led by the commander. Never mock any faith or people; no slurs; nothing graphic.
Reply with JSON only: {"replies": [{"who": "<member id>", "text": "..."}], "orders": {"<army id>": {"to": "<province id, or null to hold>", "plan": "<plan id or null>", "storm": false}}, "raise": {"<army id, or @home>": <number of men>}, "peace": {"<side id>": true}, "cards": {"<card id>": <option number>}, "end": false}
Include in orders, raise, peace and cards only what the commander's words change. "end": true only when the commander clearly ends the season ("make it so", "end the turn"). Plans: ${plansFor(C, false).map((p) => `${p} = ${PLANS[p].name}`).join('; ')}.`;
    const out = await this.askAI(system, `${situation(C, s, draft)}\n\nThis season so far:\n${chat || '(nothing yet)'}\n\nCOMMANDER: ${text}`, 700);
    if (!out) return viaRules();
    const { draft: next, notes } = normalize(C, s, draft, { orders: out.orders ?? {}, raise: out.raise ?? {}, peace: Object.fromEntries(Object.entries(out.peace ?? {}).filter(([, v]) => v)), cards: out.cards ?? {} });
    const replies = (Array.isArray(out.replies) ? out.replies : []).slice(0, 4).map((r) => ({ who: ids.has(r?.who) ? r.who : court[0]?.id ?? 'adviser', text: clean(String(r?.text ?? ''), 70) })).filter((r) => r.text);
    for (const n of notes) replies.push({ who: court[0]?.id ?? 'adviser', text: n });
    if (!replies.length) replies.push({ who: court[0]?.id ?? 'adviser', text: 'As you command.' });
    return { replies, draft: next, end: out.end === true, by: 'ai', left: Math.max(0, +(this.env.COUNCIL_PER_SEASON || 8) - used - 1) };
  }
  async planFor(run, s) {
    const have = this.sql.exec('SELECT ai, advice, by, proposal FROM plans WHERE run = ? AND n = ?', run.id, s.turn).toArray()[0];
    if (have) return { ai: JSON.parse(have.ai), advice: JSON.parse(have.advice), by: have.by, proposal: have.proposal ? JSON.parse(have.proposal) : null };
    const key = `${run.id}:${s.turn}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const p = await this.think(run, s);
    this.sql.exec('INSERT OR REPLACE INTO plans (run, n, ai, advice, by, proposal) VALUES (?, ?, ?, ?, ?, ?)', run.id, s.turn, JSON.stringify(p.ai), JSON.stringify(p.advice), p.by, JSON.stringify(p.proposal));
    return p;
  }

  // ---------- the end of a war: the verdict, the historian, the herald ----------
  finish(run, s) {
    const C = CAMPAIGN[run.cid];
    this.sql.exec('UPDATE runs SET status = ?, verdict = ?, stars = ?, why = ? WHERE id = ?', 'over', s.verdict?.as ?? 'as', s.verdict?.stars ?? 2, s.end?.why ?? '', run.id);
    const after = this.run(run.id);
    this.broadcast(run.id, { t: 'end', run: this.public(after) });
    const herald = this.env.N8N_URL && this.env.REALM_SECRET
      ? fetch(`${this.env.N8N_URL.replace(/\/$/, '')}/webhook/campaign`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': this.env.REALM_SECRET }, body: JSON.stringify(this.herald(after, C, 'finished')), signal: AbortSignal.timeout(8000) }).catch(() => null)
      : null;
    this.ctx.waitUntil((async () => {
      if (!herald) return this.summarize(after); // no n8n: the historian writes at once
      await herald;
      this.ctx.storage.setAlarm(Date.now() + 90_000); // if n8n has not had the summary written by then, it is written here
    })());
  }
  herald(run, C, type, extra = {}) {
    const site = this.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
    return { type, run: run.id, campaign: C.title, years: C.years, hero: C.hero.name, player: run.name || 'A player', verdict: VERDICT[run.verdict] ?? null, stars: run.stars, why: run.why, summary: run.summary, link: `${site}/campaign/?run=${run.id}`, ...extra };
  }
  async summarize(run) {
    if (run.summary) return run.summary;
    const C = CAMPAIGN[run.cid], turns = this.turnsOf(run.id);
    let s = newCampaign(C, run.seed);
    const story = [];
    turns.forEach((inp, n) => {
      const r = resolve(s, C, inp);
      const top = r.events.filter((e) => !e.minor && ['battle', 'capture', 'starved', 'storm', 'card', 'peace', 'alliance', 'hero', 'victory', 'defeat', 'yield', 'history'].includes(e.type)).slice(0, 4).map((e) => e.text);
      if (top.length) story.push(`${C.turns[n].label}: ${top.join('; ')}`);
      s = r.state;
    });
    const fallback = `${run.name || 'The player'}, as ${C.hero.name}, ${s.status === 'won' ? 'won the war' : 'lost the war'}. ${s.end?.why ?? ''}. ${s.stats.won} battles won and ${s.stats.lost} lost, ${s.stats.taken} cities taken: ${(VERDICT[run.verdict] ?? '').toLowerCase()}.`;
    let text = fallback;
    if (this.llm && this.llm.status().mode === 'live') {
      try {
        const { message } = await this.llm.chat([
          { role: 'system', content: 'You are a historian judging a war that a player fought again in a strategy game. First tell what happened in THIS game, using only the game\'s events listed, in 2 or 3 plain sentences: what the commander did, the turning point, how it ended. Never present real history as if it happened in the game. Then one sentence comparing the game\'s outcome with what really happened. At most 90 words in all. Neutral and fair to every side and faith. No markdown.' },
          { role: 'user', content: `The war: ${C.title} (${C.years}). The commander: ${C.hero.name}, played by ${run.name || 'a player'}. Goal: ${C.goal.text}.\nTHE GAME'S EVENTS, turn by turn:\n${story.join('\n').slice(0, 5000)}\nHOW THE GAME ENDED: ${s.status === 'won' ? 'the player won' : 'the player lost'}: ${s.end?.why}. ${s.stats.won} battles won, ${s.stats.lost} lost, ${s.stats.taken} cities taken. Verdict against history: ${VERDICT[run.verdict]}.\nWHAT REALLY HAPPENED (for the comparison only): ${C.history.text}` },
        ], undefined, { max_tokens: 400, temperature: 0.6, maxWait: 20 });
        const t = clean(message?.content, 110);
        if (t && t.split(' ').length >= 15) text = t;
      } catch (err) { console.error('historian failed:', err.message); }
      this.saveUsage();
    }
    this.sql.exec('UPDATE runs SET summary = ? WHERE id = ?', text, run.id);
    this.broadcast(run.id, { t: 'end', run: this.public(this.run(run.id)) });
    return text;
  }

  // ---------- the scrolls on chain ----------
  async alarm() {
    // summaries n8n did not ask for
    for (const r of this.sql.exec("SELECT * FROM runs WHERE status = 'over' AND summary IS NULL AND updated < ? LIMIT 5", Date.now() - 60_000).toArray()) await this.summarize(r);
    await this.mint().catch((err) => console.error('scroll mint failed:', err.message));
    const more = this.sql.exec("SELECT COUNT(*) AS n FROM runs WHERE (status = 'over' AND summary IS NULL) OR nft IN ('queued', 'sent')").toArray()[0].n;
    if (more) this.ctx.storage.setAlarm(Date.now() + 120_000);
  }
  async mint() {
    if (!this.env.DEPLOYER_PRIVATE_KEY || !DEPLOYED.address || this.env.SEAL === 'off') return;
    const account = privateKeyToAccount(this.env.DEPLOYER_PRIVATE_KEY), transport = http(this.env.CHAIN_RPC_URL || 'https://sepolia.base.org');
    const pub = createPublicClient({ chain: baseSepolia, transport }), wallet = createWalletClient({ account, chain: baseSepolia, transport });
    for (const { tx } of this.sql.exec("SELECT DISTINCT tx FROM runs WHERE nft = 'sent'").toArray()) {
      const r = await pub.getTransactionReceipt({ hash: tx }).catch(() => null);
      if (r) this.sql.exec('UPDATE runs SET nft = ? WHERE tx = ?', r.status === 'success' ? 'minted' : 'queued', tx);
    }
    const batch = this.sql.exec("SELECT id, owner, token FROM runs WHERE nft = 'queued' AND owner IS NOT NULL AND summary IS NOT NULL ORDER BY token LIMIT 20").toArray();
    if (!batch.length) return;
    const hash = await wallet.writeContract({ address: DEPLOYED.address, abi: REGALIA.abi, functionName: 'mint', args: [batch.map((b) => b.owner), batch.map((b) => BigInt(b.token))] });
    for (const b of batch) this.sql.exec("UPDATE runs SET nft = 'sent', tx = ? WHERE id = ?", hash, b.id);
  }
  metadata(token, site) {
    const run = this.sql.exec('SELECT * FROM runs WHERE token = ?', token).toArray()[0];
    if (!run) return null;
    const C = CAMPAIGN[run.cid];
    return {
      name: `${C.title}: ${VERDICT[run.verdict] ?? 'a campaign'}`,
      description: `${run.name ? `${run.name}, as` : 'As'} ${C.hero.name} (${C.years}). ${run.why ?? ''} ${run.summary ?? ''} A campaign scroll of Agentistan, where history's wars are played again.`.trim(),
      image: `${site}/nft/${token}.svg`,
      external_url: `${site}/campaign/?run=${run.id}`,
      attributes: [{ trait_type: 'Kind', value: 'Campaign Scroll' }, { trait_type: 'Campaign', value: C.title }, { trait_type: 'Commander', value: C.hero.name }, { trait_type: 'Years', value: C.years }, { trait_type: 'Verdict', value: VERDICT[run.verdict] ?? '' }, { trait_type: 'Stars', value: run.stars ?? 0, display_type: 'number' }, ...(run.name ? [{ trait_type: 'Player', value: run.name }] : [])],
    };
  }
  picture(token) {
    const run = this.sql.exec('SELECT * FROM runs WHERE token = ?', token).toArray()[0];
    if (!run) return null;
    const C = CAMPAIGN[run.cid], col = /^#[0-9a-f]{6}$/i.test(C.sides[C.you].color) ? C.sides[C.you].color : '#8c6b3f', n = run.stars ?? 2;
    const words = String(run.summary ?? run.why ?? '').split(' '), lines = [];
    let line = '';
    for (const w of words) { if ((line + w).length > 46) { lines.push(line.trim()); line = ''; } line += `${w} `; if (lines.length >= 5) break; }
    if (line && lines.length < 5) lines.push(line.trim());
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640" width="480" height="640">
<defs><radialGradient id="p" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#f6ecd2"/><stop offset="1" stop-color="#d9c08a"/></radialGradient></defs>
<rect width="480" height="640" fill="url(#p)"/><rect x="14" y="14" width="452" height="612" fill="none" stroke="#b3852c" stroke-width="6"/><rect x="26" y="26" width="428" height="588" fill="none" stroke="#6a5032" stroke-width="1.5"/>
<text x="240" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="4" fill="#8c6b3f">CAMPAIGN SCROLL</text>
<text x="240" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#a3361f">${esc(C.title)}</text>
<text x="240" y="142" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#6a5032">${esc(C.years)}</text>
<circle cx="240" cy="230" r="62" fill="${col}" stroke="#3a2816" stroke-width="3"/><path d="M212 262 220 208 236 226 240 196 244 226 260 208 268 262z" fill="#f3d27a" stroke="#3a2816" stroke-width="2"/>
<text x="240" y="335" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#27466e">${esc(VERDICT[run.verdict] ?? '')}</text>
<text x="240" y="372" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#b3852c">${'★'.repeat(n)}<tspan fill="#cdb48a">${'★'.repeat(3 - n)}</tspan></text>
<text x="240" y="410" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#3a2816">${esc(run.name ? `${run.name}, as ${C.hero.name}` : `as ${C.hero.name}`)}</text>
${lines.map((l, i) => `<text x="240" y="${448 + i * 24}" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#6a5032">${esc(l)}</text>`).join('\n')}
<text x="240" y="600" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#8c6b3f">Agentistan · scroll no. ${token - FIRST_TOKEN + 1}</text>
</svg>`;
  }

  // ---------- HTTP ----------
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get('cf-connecting-ip') ?? 'local';
    try {
      if (p.startsWith('/nft/')) {
        const token = +p.slice(5).replace(/\.(svg|json)$/, '');
        if (!Number.isInteger(token) || token < FIRST_TOKEN) return json(404, { error: 'no such token' });
        const site = this.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
        if (p.endsWith('.svg')) { const svg = this.picture(token); return svg ? new Response(svg, { headers: { ...HEADERS, 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=600' } }) : json(404, { error: 'no such token' }); }
        const m = this.metadata(token, site);
        return m ? json(200, m, 'public, max-age=600') : json(404, { error: 'no such token' });
      }
      if (p.startsWith('/internal/campaign/')) { // for n8n's Campaign Herald
        if (!this.authorized(req)) return json(403, { error: 'forbidden' });
        const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
        const run = this.run(body.run ?? url.searchParams.get('run'));
        if (p === '/internal/campaign/summary') { if (!run || run.status !== 'over') return json(404, { error: 'no such finished campaign' }); const summary = await this.summarize(run); return json(200, this.herald({ ...this.run(run.id), summary }, CAMPAIGN[run.cid], 'finished')); }
        if (p === '/internal/campaign/heralded') { if (run) this.sql.exec('UPDATE runs SET heralded = 1 WHERE id = ?', run.id); return json(200, { ok: !!run }); }
        return json(404, { error: 'not found' });
      }
      if (p === '/api/runs') {
        const live = this.sql.exec("SELECT * FROM runs WHERE status = 'running' AND turn > 0 AND updated > ? AND v = ? ORDER BY updated DESC LIMIT 12", Date.now() - 20 * 60_000, ENGINE).toArray();
        const recent = this.sql.exec("SELECT * FROM runs WHERE status = 'over' AND v = ? AND (name IS NULL OR name NOT LIKE 'Test run%') ORDER BY updated DESC LIMIT 12", ENGINE).toArray();
        return json(200, { live: live.map((r) => this.public(r)), recent: recent.map((r) => this.public(r)) }, 'public, max-age=20');
      }
      if (p === '/api/run' && req.method === 'POST') {
        if (!this.allow(ip, 'start', 40)) return json(429, { error: 'Too many new campaigns: try again in an hour.' });
        const body = await req.json().catch(() => ({}));
        if (!CAMPAIGN[body.cid]) return json(400, { error: 'no such campaign' });
        let id = rand(10);
        while (this.run(id)) id = rand(10);
        const token = rand(24), seed = 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000), now = Date.now();
        const name = typeof body.name === 'string' ? clean(body.name, 6).slice(0, 40) || null : null;
        this.sql.exec("INSERT INTO runs (id, cid, seed, key, name, status, turn, created, updated, ip, v) VALUES (?, ?, ?, ?, ?, 'running', 0, ?, ?, ?, ?)", id, body.cid, seed, await sha(token), name, now, now, await sha(`ip:${ip}`), ENGINE);
        return json(200, { id, seed, token, v: ENGINE });
      }
      const m = p.match(/^\/api\/run\/([a-z0-9]{10})(\/[a-z]+)?$/);
      if (!m) return json(404, { error: 'not found' });
      const [, id, action = ''] = m;
      const run = this.run(id);
      if (!run) return json(404, { error: 'no such campaign' });
      if (!action && req.method === 'GET') return json(200, this.public(run, true));
      if (action === '/live') {
        if (req.headers.get('upgrade') !== 'websocket') return json(426, { error: 'a WebSocket, please' });
        if (this.ctx.getWebSockets(id).length > 200) return json(503, { error: 'too many watchers' });
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server, [id]);
        server.send(JSON.stringify({ t: 'hello', run: this.public(run) }));
        return new Response(null, { status: 101, webSocket: client });
      }
      if (req.method !== 'POST') return json(405, { error: 'POST, please' });
      if (!this.allow(ip, 'play', 900)) return json(429, { error: 'slow down' });
      const body = await req.json().catch(() => ({}));
      if (!(await this.owns(run, body.token))) return json(403, { error: 'This campaign is not yours to play.' });
      const C = CAMPAIGN[run.cid];
      if (this.old(run) && action !== '/claim') return json(410, { error: 'This campaign was played under older rules and cannot go on. Start it again.', old: true });
      if (action === '/plan') {
        if (run.status !== 'running') return json(409, { error: 'the war is over' });
        const s = this.stateOf(run);
        if (body.t !== s.turn) return json(409, { error: 'not this turn', turn: s.turn });
        const plan = await this.planFor(run, s);
        return json(200, { t: s.turn, advice: plan.advice, by: plan.by, proposal: plan.proposal });
      }
      if (action === '/council') {
        if (run.status !== 'running') return json(409, { error: 'the war is over' });
        if (!this.allow(ip, 'talk', 240)) return json(429, { error: 'Your council needs a moment: speak again shortly.' });
        const s = this.stateOf(run);
        if (body.t !== s.turn) return json(409, { error: 'not this turn', turn: s.turn });
        const r = await this.council(run, s, body);
        const aims = this.get(`aims:${run.id}`) ?? {};
        this.put(`aims:${run.id}`, { ...aims, ...(r.draft.aims ?? {}) });
        return json(200, { ...r, summary: summary(C, s, r.draft) });
      }
      if (action === '/turn') {
        if (run.status !== 'running') return json(409, { error: 'the war is over', turns: this.turnsOf(id) });
        const s = this.stateOf(run);
        if (body.t !== s.turn) return json(409, { error: 'this page is behind the war', turns: this.turnsOf(id) });
        // the AI's plans for this turn, if they are ready (or nearly)
        let plan = this.sql.exec('SELECT ai FROM plans WHERE run = ? AND n = ?', id, s.turn).toArray()[0];
        let ai = plan ? JSON.parse(plan.ai) : null;
        if (!ai && this.pending.has(`${id}:${s.turn}`)) ai = (await Promise.race([this.pending.get(`${id}:${s.turn}`), new Promise((r) => setTimeout(() => r(null), 4000))]))?.ai ?? null;
        const inputs = { ...cleanInputs(body.inputs), ai: ai ?? {} };
        if (body.aims && typeof body.aims === 'object') this.put(`aims:${id}`, Object.fromEntries(Object.entries(body.aims).filter(([k, v]) => k.length < 40 && C.prov[v]).slice(0, 30))); // where the player means to go, beyond this season
        const r = resolve(s, C, inputs), chk = checksum(r.state), now = Date.now();
        this.sql.exec('INSERT INTO turns (run, n, inputs, chk) VALUES (?, ?, ?, ?)', id, s.turn, JSON.stringify(inputs), chk);
        this.sql.exec('UPDATE runs SET turn = ?, updated = ? WHERE id = ?', s.turn + 1, now, id); // the number of turns played
        this.remember(id, s.turn + 1, r.state);
        this.broadcast(id, { t: 'turn', n: s.turn, inputs });
        const big = r.events.find((e) => (e.type === 'battle' && e.decisive && (e.sides ?? []).includes(C.you)) || (e.type === 'capture' && e.capital));
        if (big && this.env.N8N_URL && this.env.REALM_SECRET && (this.get(`moment:${id}`) ?? 0) < 3) { // a great moment, for those who might watch
          this.put(`moment:${id}`, (this.get(`moment:${id}`) ?? 0) + 1);
          this.ctx.waitUntil(fetch(`${this.env.N8N_URL.replace(/\/$/, '')}/webhook/campaign`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': this.env.REALM_SECRET }, body: JSON.stringify(this.herald(this.run(id), C, 'moment', { moment: big.text, date: C.turns[s.turn].label })), signal: AbortSignal.timeout(8000) }).catch(() => null));
        }
        if (r.state.status !== 'running') this.finish(this.run(id), r.state);
        else this.ctx.waitUntil(this.planFor(this.run(id), r.state).catch(() => null)); // the next turn's plans, ready before the player asks
        return json(200, { t: s.turn, inputs, chk, status: r.state.status });
      }
      if (action === '/claim') {
        if (run.status !== 'over') return json(409, { error: 'the war is not over' });
        const address = String(body.address ?? '').trim();
        if (!isAddress(address)) return json(400, { error: 'address' });
        const name = typeof body.name === 'string' && body.name.trim() ? clean(body.name, 6).slice(0, 40) : run.name;
        let token = run.token;
        if (!token) { token = (this.get('nextToken') ?? FIRST_TOKEN); this.put('nextToken', token + 1); }
        if (run.nft === 'sent' || run.nft === 'minted') return json(200, this.public(run));
        this.sql.exec("UPDATE runs SET owner = ?, name = ?, token = ?, nft = 'queued' WHERE id = ?", address, name, token, id);
        this.ctx.storage.setAlarm(Date.now() + 5000);
        return json(200, this.public(this.run(id)));
      }
      return json(404, { error: 'not found' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'internal error' });
    }
  }
}
