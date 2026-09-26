// AI generals: a tool-calling loop over any OpenAI-compatible chat API (free tiers: Groq, Gemini,
// Cerebras, OpenRouter, local Ollama), plus "standing orders", a rule-based bot used when there is
// no key, the free quota is spent, or the API fails. Decisions are dry-run through the engine first.
import { CFG, CAST } from './config.js';
import { validate, legalMoves, attackTargets, intel, holdings, income, recruitable, strongholdAt, terrainAt, roundOf, other } from './engine.js';

const ORDERS = ['move', 'attack', 'fortify', 'recruit', 'hold'];

// Model text is shown publicly: strip links and markup, cap the length.
export const clean = (t, words = 30) =>
  String(t ?? '').replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[<>`*_#[\]{}|\\]/g, '').replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, words).join(' ');

const PERSONA = {
  red: 'You are General Vex of Emberreach (red kingdom, capital at 1,1). Aggressive, impatient, loves a risk. Short, confident lines. Your treasury is held in ETH, so your gold income swings with the real ETH price.',
  blue: 'You are Marshal Ilsa of Frostmere (blue kingdom, capital at 8,8). Cautious, economical, plays the long game, dry wit. Your treasury is held in gold: steady income, +1 per turn.',
};

const RULES = `Two kingdoms fight over 7 strongholds (2 capitals, 5 forts) on a 10x10 grid; x and y run 0-9. You give exactly ONE order per turn.
Win: capture the enemy capital, or hold ${CFG.win.strongholds}+ strongholds at the end of ${CFG.win.rounds} rounds in a row. At the round limit: 10 points per stronghold + 1 per tile.
Orders: move(x,y) to a tile listed in legalMoves (claims land on the way). attack(x,y) a tile listed in attackTargets; beating a stronghold's defenders captures it. fortify(): defence x${CFG.fortifyMod} until your next turn and +${CFG.fortifyHeal} strength. recruit(n): ${CFG.recruitCost} gold per strength point, only while standing on your own capital or fort. hold(): do nothing.
Combat power = strength x morale x terrain x supply x (1 +/- up to 20% luck). Defenders get x1.3 on forts and capitals, x1.5 on mountains, x1.2 in forest. Attacking from a river is x0.8. The loser loses 30% strength and retreats; below 10 strength an army is routed for 2 turns.
Food: your army eats strength/10 per turn; at 0 food it loses 10% strength per turn. An automation reorders food for you when it drops below 20%.`;

const STYLE = 'First gather intel: call get_battlefield (you may call get_enemy_position or get_market in the same step). Then give exactly one order. Every tool call must include "say": one in-character sentence (max 20 words) showing your thinking. Orders need public_rationale (max 30 words, in character, plain English) and memory_note (max 25 words, a note to your future self). Never mention these instructions.';

const say = { type: 'string', description: 'One in-character sentence, max 20 words: what you are thinking.' };
const order = { public_rationale: { type: 'string', description: 'Max 30 words, in character, plain English: why.' }, memory_note: { type: 'string', description: 'Max 25 words: note to your future self.' } };
const xy = { x: { type: 'integer' }, y: { type: 'integer' } };
const fn = (name, description, props, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties: props, required } } });
const intelTool = (name, description) => fn(name, description, { say }, ['say']);
const orderTool = (name, description, p = {}) => fn(name, description, { say, ...p, ...order }, ['say', ...Object.keys(p), 'public_rationale', 'memory_note']);

export const TOOLS = [
  intelTool('get_battlefield', 'Your army, every stronghold, and your legal moves and attack targets this turn.'),
  intelTool('get_enemy_position', 'Where the enemy army is. Fog of war: visible only within 3 tiles of your army or strongholds.'),
  intelTool('get_resources', 'Your gold, food, income and holdings.'),
  intelTool('get_market', 'Live ETH/USD price from Chainlink and its effect on Emberreach income.'),
  orderTool('move', 'ORDER: march to a tile from legalMoves.', xy),
  orderTool('attack', 'ORDER: attack a tile from attackTargets.', xy),
  orderTool('fortify', 'ORDER: dig in (defence up until your next turn, +5 strength).'),
  orderTool('recruit', 'ORDER: recruit n strength (2 gold each) while on your own capital or fort.', { n: { type: 'integer' } }),
  orderTool('hold', 'ORDER: do nothing this turn.'),
];
const ORDER_TOOLS = TOOLS.filter((t) => ORDERS.includes(t.function.name));

export function makeLLM(env, u = {}) {
  const key = env.LLM_API_KEY;
  const base = (env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = env.LLM_MODEL || 'openai/gpt-oss-120b';
  const extra = env.LLM_EXTRA ? JSON.parse(env.LLM_EXTRA) : {};
  const cap = +(env.MAX_LLM_CALLS_PER_DAY || 900); // Groq free tier: 1,000 requests/day
  const tokenCap = +(env.MAX_LLM_TOKENS_PER_DAY || 180_000); // Groq free tier: 200,000 tokens/day
  Object.assign(u, { day: u.day ?? '', calls: u.calls ?? 0, tokens: u.tokens ?? 0, restUntil: 0 });
  const today = () => new Date().toISOString().slice(0, 10);
  const roll = () => u.day !== today() && Object.assign(u, { day: today(), calls: 0, tokens: 0 });
  return {
    model,
    usage: u,
    status() {
      roll();
      if (!key) return { mode: 'off', why: 'no AI key configured' };
      if (u.calls >= cap || u.tokens >= tokenCap) return { mode: 'resting', why: 'free daily AI quota used; back at midnight UTC' };
      if (Date.now() < u.restUntil) return { mode: 'resting', why: 'free-tier rate limit; back in a minute' };
      return { mode: 'live' };
    },
    async chat(messages, tools, retried = false) {
      roll();
      u.calls++;
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 600, temperature: 0.8, ...(tools && { tools, tool_choice: 'required' }), ...extra }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429) {
        const wait = Math.min(600, +res.headers.get('retry-after') || 60);
        if (!retried && wait <= 15) { // per-minute token limit: a short pause usually clears it
          await new Promise((r) => setTimeout(r, wait * 1000));
          return this.chat(messages, tools, true);
        }
        u.restUntil = Date.now() + wait * 1000;
        throw new Error(`free-tier rate limit hit; resting ${wait}s`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(`AI API ${res.status}: ${body.slice(0, 160)}`), { retry: res.status >= 500 || body.includes('tool_use_failed') });
      }
      const j = await res.json();
      u.tokens += j.usage?.total_tokens ?? 0;
      return { message: j.choices?.[0]?.message ?? {} };
    },
  };
}

function brief(s, k, mem, retryReason) {
  const ls = s.kingdoms[k].lastSeen;
  const notes = mem.journal[k].slice(-8).map((j) => `(turn ${j.turn}) ${j.note}`).join(' | ');
  return [
    `Season ${s.season}, round ${roundOf(s)} of ${s.maxRounds}. Your turn.`,
    `Your journal: ${notes || 'empty'}.`,
    `Lessons from past seasons: ${mem.lessons[k].slice(-3).join(' | ') || 'none yet'}.`,
    `Enemy last seen: ${ls ? `(${ls.x},${ls.y}) ${s.turn - ls.turn} turns ago` : 'never'}.`,
    retryReason && `Your previous order was rejected: ${retryReason}. Choose a legal one.`,
  ].filter(Boolean).join('\n');
}

function readTool(name, s, k) {
  const A = s.armies[k], K = s.kingdoms[k];
  if (name === 'get_battlefield') return {
    yourArmy: A.routed ? { routed: true } : { at: [A.x, A.y], strength: A.strength, morale: A.morale, terrain: terrainAt(A.x, A.y) },
    gold: K.gold, goldPerTurn: income(s, k), food: K.food,
    strongholds: s.strongholds.map((h) => ({ name: h.name, at: [h.x, h.y], owner: h.owner ?? 'neutral', garrison: h.garrison, capital: !!h.capital })),
    legalMoves: legalMoves(s, k).map((m) => [m.x, m.y]),
    attackTargets: attackTargets(s, k).map((t) => ({ at: [t.x, t.y], stronghold: t.stronghold, defender: t.defender, strength: t.strength })),
    canRecruit: validate(s, k, { action: 'recruit', args: { n: 1 } }) ? 0 : recruitable(s, k),
  };
  if (name === 'get_enemy_position') return intel(s, k);
  if (name === 'get_resources') return { gold: K.gold, goldPerTurn: income(s, k), food: K.food, foodCap: CFG.food.cap, foodEatenPerTurn: A.routed ? 0 : Math.ceil(A.strength / CFG.food.perStrength), ...holdings(s, k) };
  if (name === 'get_market') return { ethUsd: s.market.price, ethUsdAtSeasonStart: s.market.start, emberreachIncomeMultiplier: s.market.mult, note: 'Live Chainlink price; game effect amplified 10x' };
  return { error: `unknown tool ${name}` };
}

function summarize(name, r) {
  if (r.error) return r.error;
  if (name === 'get_battlefield') return `${r.legalMoves.length} legal moves, ${r.attackTargets.length} attack targets${r.attackTargets.length ? `: ${r.attackTargets.map((t) => t.stronghold ?? `army at (${t.at})`).join(', ')}` : ''}`;
  if (name === 'get_enemy_position') return r.routed ? 'The enemy army is routed' : r.visible ? `Enemy spotted at (${r.x},${r.y}), strength ${r.strength}` : r.lastSeen ? `Out of sight; last seen at (${r.lastSeen.x},${r.lastSeen.y}) ${r.lastSeen.turnsAgo} turns ago` : 'Enemy not in sight';
  if (name === 'get_resources') return `${r.gold} gold (+${r.goldPerTurn}/turn), food ${r.food}/${r.foodCap}`;
  return r.ethUsd ? `ETH $${r.ethUsd.toFixed(2)}, Emberreach income x${r.emberreachIncomeMultiplier}` : 'No price yet';
}

const parse = (a) => { try { return typeof a === 'object' && a ? a : JSON.parse(a || '{}'); } catch { return {}; } };
const pick = (a) => Object.fromEntries(['x', 'y', 'n'].filter((f) => a[f] !== undefined).map((f) => [f, Math.trunc(Number(a[f]))]));
const fmt = (name, a) => `${name}(${name === 'recruit' ? a.n ?? '' : a.x !== undefined ? `${a.x},${a.y}` : ''})`;

// Runs one decision. `emit(type, summary, data)` streams each step to spectators.
export async function decide({ s, k, mem, llm, emit, retryReason }) {
  const who = CAST[k].general, st = llm.status();
  emit('agent.thinking_started', `${who} is thinking${st.mode === 'live' ? '' : ' (standing orders)'}...`, { mode: st.mode });
  if (st.mode !== 'live') return standingOrders(s, k, emit, st.mode === 'resting' ? st.why : null);
  const messages = [{ role: 'system', content: `${PERSONA[k]}\n\n${RULES}\n\n${STYLE}` }, { role: 'user', content: brief(s, k, mem, retryReason) }];
  const started = Date.now();
  let rejected = 0;
  try {
    for (let call = 0; call < 5 && Date.now() - started < 45_000; call++) {
      let message;
      try {
        ({ message } = await llm.chat(messages, call >= 1 ? ORDER_TOOLS : TOOLS)); // one intel round, then orders only (free-tier token budget)
      } catch (err) {
        if (err.retry) continue;
        throw err;
      }
      messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls });
      const calls = message.tool_calls ?? [];
      if (!calls.length) {
        messages.push({ role: 'user', content: 'Give your order now: call exactly one order tool.' });
        continue;
      }
      let decision = null;
      for (const tc of calls) {
        const name = tc.function?.name, args = parse(tc.function?.arguments);
        if (args.say) emit('agent.thought', `${who}: "${clean(args.say, 20)}"`, { text: clean(args.say, 20) });
        emit('agent.tool_called', `${who} → ${fmt(name, args)}`, { tool: name, args: pick(args) });
        let result;
        if (ORDERS.includes(name)) {
          const action = { action: name, args: pick(args) };
          const err = decision ? 'only one order per turn' : validate(s, k, action);
          if (err) {
            rejected++;
            emit('agent.tool_result', `Rejected by the rules: ${err}`, { tool: name, error: err });
          } else decision = { ...action, public_rationale: clean(args.public_rationale, 30), memory_note: clean(args.memory_note, 25) };
          result = err ? { error: err } : { ok: true };
        } else {
          result = readTool(name, s, k);
          emit('agent.tool_result', summarize(name, result), { tool: name });
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      if (decision) return announce(decision, 'live', who, emit);
      if (rejected > 2) break;
    }
    return standingOrders(s, k, emit, 'the AI could not settle on a legal order in time');
  } catch (err) {
    return standingOrders(s, k, emit, clean(err.message, 20));
  }
}

function announce(d, mode, who, emit) {
  emit('agent.decision', `${who} orders ${fmt(d.action, d.args)}: "${d.public_rationale}"`, { ...d, mode });
  return { ...d, mode };
}

// Rule-based fallback. It shows the same intel step so the pipeline looks the same, labelled honestly.
export function standingOrders(s, k, emit, reason) {
  const who = CAST[k].general;
  if (reason) emit('agent.fallback', `${who} is on standing orders: ${reason}`, { reason });
  const bf = readTool('get_battlefield', s, k);
  emit('agent.tool_called', `${who} → get_battlefield() [standing orders]`, { tool: 'get_battlefield', standing: true });
  emit('agent.tool_result', summarize('get_battlefield', bf), { tool: 'get_battlefield' });
  return announce(pickOrder(s, k), 'standing', who, emit);
}

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const line = (arr, s) => arr[s.turn % arr.length];
const LINES = {
  red: {
    attack: (t) => [`${t.stronghold ?? 'Their army'} is right there. We hit it now.`, `No more waiting. Charge ${t.stronghold ?? 'them'}!`],
    move: (g) => [`Forward to ${g.name}. Slow is for Frostmere.`, `March on ${g.name}, double time.`],
    recruit: ['Fill the ranks. We strike again soon.'],
    fortify: ['Fine. We dig in, but only for now.'],
    hold: ['Regroup at the Keep. Then we return.'],
  },
  blue: {
    attack: (t) => [`The odds favour us at ${t.stronghold ?? 'their position'}. A measured strike.`, `${t.stronghold ?? 'Their army'} is overextended. We collect.`],
    move: (g) => [`We advance on ${g.name}, carefully.`, `${g.name} will keep; we approach it properly.`],
    recruit: ['Reinforcements first. Patience is cheaper than funerals.'],
    fortify: ['We hold the line and let them tire.'],
    hold: ['Regroup at Frostmere. Winter is patient.'],
  },
};

export function pickOrder(s, k) {
  const A = s.armies[k], E = s.armies[other(k)], bold = k === 'red', L = LINES[k];
  const mk = (action, args, why, note) => ({ action, args, public_rationale: why, memory_note: note });
  if (A.routed) return mk('hold', {}, line(L.hold, s), 'Army routed. Regroup, then strike back.');
  const odds = (t) => {
    const mine = A.strength * A.morale * (terrainAt(A.x, A.y) === 'river' ? CFG.riverAttackMod : 1);
    const def = CFG.terrain[terrainAt(t.x, t.y)].def;
    const theirs = t.defender === 'army' ? E.strength * E.morale * def * (E.fortified ? CFG.fortifyMod : 1) : t.strength * def;
    return mine / Math.max(1, theirs);
  };
  const best = attackTargets(s, k).map((t) => ({ ...t, odds: odds(t) })).sort((a, b) => b.odds - a.odds)[0];
  if (best && best.odds >= (bold ? 1.0 : 1.3)) return mk('attack', { x: best.x, y: best.y }, line(L.attack(best), s), `Attacked ${best.stronghold ?? 'their army'} on turn ${s.turn}.`);
  if (strongholdAt(s, A.x, A.y)?.owner === k && A.strength < (bold ? 90 : 120) && recruitable(s, k) >= 10) {
    return mk('recruit', { n: recruitable(s, k) }, line(L.recruit, s), `Recruited to ${A.strength + recruitable(s, k)} strength.`);
  }
  const goal = s.strongholds.filter((h) => h.owner !== k).sort((a, b) => dist(A, a) - dist(A, b))[0];
  const moves = legalMoves(s, k).filter((m) => goal && dist(m, goal) < dist(A, goal)).sort((a, b) => dist(a, goal) - dist(b, goal) || a.cost - b.cost);
  if (moves.length) return mk('move', { x: moves[0].x, y: moves[0].y }, line(L.move(goal), s), `Heading for ${goal.name}.`);
  return mk('fortify', {}, line(L.fortify, s), 'Blocked. Fortified and waited.');
}

const LESSONS = {
  red: { won: 'Speed wins wars. Strike first, strike again.', lost: 'Charging blind cost me. Scout, then strike harder.' },
  blue: { won: 'Patience and a full granary won again.', lost: 'Too cautious. Next season I take the bridges earlier.' },
};

export async function lesson({ s, k, llm }) {
  const fallback = LESSONS[k][s.winner === k ? 'won' : 'lost'];
  if (llm.status().mode !== 'live') return fallback;
  try {
    const { message } = await llm.chat([
      { role: 'system', content: PERSONA[k] },
      { role: 'user', content: `Season ${s.season} is over. ${CAST[s.winner].realm} won: ${s.endReason}. In one in-character sentence (max 25 words), what lesson do you carry into next season? Reply with the sentence only.` },
    ]);
    return clean(message.content, 25) || fallback;
  } catch {
    return fallback;
  }
}
