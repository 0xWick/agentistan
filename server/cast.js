// The AI cast: the people of the living world, given minds. Three jobs, each optional, each inside Groq's free tier:
//  1. personas: an ambition, a fear, a secret and a voice for the notable people of the world, written once each;
//  2. decisions: when one of them faces a turning point (betray? bow to the new king? accept the match? defy the
//     verdict? make peace?), the AI answers for them, in character, before the next month turns;
//  3. counsel: every other month one great power's ruler sets a course: war, peace, alliance, works, taxes.
// Everything the AI says becomes an input to the next month and goes through the engine's checks like any other act.
// When the AI is late, out of budget or wrong, doctrine decides, and the world never waits.
import { makeLLM, clean } from './agent.js';
import { living, provincesOf, menOf, atWar, allied, strength, prosperityOf, claimsOf, rulingTemper, steersman, cityOf, yearOf, INVENTIONS } from '../web/silk/engine.js';
import { TEMPER_TEXT } from '../web/silk/names.js';
import { neighbours, bestWork } from '../web/silk/doctrine.js';

const NO_RELIGION = 'Keep religion out entirely: no gods, faiths, clergy, prayers or holy places.';
const ageOf = (s, c) => yearOf(s.month, s) - c.born;
const temperText = (t) => (TEMPER_TEXT[t] ? `${TEMPER_TEXT[t][0]} (${TEMPER_TEXT[t][1]})` : 'unknown');
const parse = (text) => {
  const m = String(text ?? '').match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
};

// The realms whose people the AI plays: the great powers, by land.
const ranked = (s, n) => living(s).map((r) => [r.id, provincesOf(s, r.id).length]).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);

export function makeCast(env, era) {
  // In a game the AI speaks only for the realms whose players asked for it; in the living world, for the great powers.
  const spotlight = (s, n = 16) => {
    if (!era.meta?.game) return [...new Set([...Object.keys(s.players ?? {}), ...ranked(s, n)])];
    const seats = era.get('seats') ?? {};
    return Object.keys(seats).filter((r) => seats[r].delegate === 'ai' && s.realms[r] && !s.realms[r].fallen);
  };
  const usage = era.get('castUsage') ?? { big: {}, small: {} };
  const key = env.LLM_API_KEY ? env : null;
  const big = makeLLM({ ...env, LLM_MODEL: env.CAST_MODEL || 'openai/gpt-oss-120b', MAX_LLM_TOKENS_PER_DAY: env.CAST_TOKENS || '110000', MAX_LLM_CALLS_PER_DAY: '700', LLM_EXTRA: '{"reasoning_effort":"low"}' }, usage.big);
  const small = makeLLM({ ...env, LLM_MODEL: env.PERSONA_MODEL || 'qwen/qwen3.8-27b', MAX_LLM_TOKENS_PER_DAY: '150000', MAX_LLM_CALLS_PER_DAY: '700', LLM_EXTRA: '{}' }, usage.small);
  const save = () => era.put('castUsage', usage);
  const ask = async (llm, system, user, maxTokens) => {
    if (!key || llm.status().mode !== 'live') return null;
    const { message } = await llm.chat([{ role: 'system', content: system }, { role: 'user', content: user }], undefined, { max_tokens: maxTokens, temperature: 0.8, response_format: { type: 'json_object' }, maxWait: 20 });
    return parse(message.content);
  };

  // ---------- 1. personas ----------
  async function personas(s, m) {
    if (era.meta?.game) return; // games keep the free budget for decisions
    const stars = new Set(spotlight(s));
    const want = Object.values(s.chars).filter((c) => c.alive && !c.persona && stars.has(c.realm) && (['ruler', 'heir', 'vizier'].includes(c.role) || (c.role === 'consort' && s.realms[c.realm]?.ruler === c.spouse) || (c.role === 'general' && (c.famous || (s.armies[c.army]?.size ?? 0) >= 15))))
      .sort((a, b) => (b.player ? 1 : 0) - (a.player ? 1 : 0) || (b.role === 'ruler') - (a.role === 'ruler') || (b.famous ? 1 : 0) - (a.famous ? 1 : 0)).slice(0, 4);
    if (!want.length) return;
    const lines = want.map((c) => {
      const r = s.realms[c.realm], sp = s.chars[c.spouse];
      return `- id ${c.id}: ${c.title ?? ''} ${c.name}, ${c.female ? 'woman' : 'man'} of ${ageOf(s, c)}, ${c.role} of ${r?.name} (capital ${cityOf(s, r?.capital)}), ${c.culture} customs. Temperament: ${temperText(c.temper)}.${c.traits?.length ? ` Traits: ${c.traits.join(', ')}.` : ''}${sp ? ` Spouse: ${sp.name}.` : ''}${c.player ? ` A usurper who seized the throne in a coup; they describe themselves: "${clean(s.players?.[c.realm]?.line ?? '', 30)}". Build on that.` : c.famous ? ' A real figure of history: stay true to what is known of them up to this date.' : ' Not in the chronicles: invent them.'}`;
    });
    const out = await ask(small, `You write character sketches for a living simulation of the Old World that began in 1200 AD. For each person give: ambition, fear, secret (each one plain sentence, at most 18 words) and voice (one line they might say, at most 16 words). Fit their temperament, culture, age and rank; be specific and vivid, never modern. ${NO_RELIGION} Reply with JSON only: {"people":[{"id":"...","ambition":"...","fear":"...","secret":"...","voice":"..."}]}`,
      `The date: ${yearOf(s.month, s)}.\n${lines.join('\n')}`, 900);
    for (const p of out?.people ?? []) {
      if (!want.some((c) => c.id === p.id)) continue;
      era.queue(m + 1, 'persona', p.id, { ambition: clean(p.ambition, 22), fear: clean(p.fear, 22), secret: clean(p.secret, 22), voice: clean(p.voice, 20), by: small.model });
    }
  }

  // ---------- 2. decisions at the turning points ----------
  function situation(s, rid) {
    const r = s.realms[rid];
    if (!r) return '';
    const wars = living(s).filter((o) => atWar(s, rid, o.id)).map((o) => `${o.short} (strength ${Math.round(strength(s, o.id))})`);
    return `${r.name}: ${provincesOf(s, rid).length} provinces, ${Math.round(menOf(s, rid))}k soldiers, strength ${Math.round(strength(s, rid))}, gold ${Math.round(r.gold)}, prosperity ${Math.round(prosperityOf(s, rid))}/100, its word ${Math.round(r.rep ?? 60)}/100${wars.length ? `, at war with ${wars.join(', ')}` : ', at peace'}.`;
  }
  async function decisions(s, m) {
    const stars = new Set(spotlight(s, 20));
    const due = s.pending.filter((d) => stars.has(d.realm) || s.chars[d.char]?.famous).sort((a, b) => (s.players?.[b.realm] ? 1 : 0) - (s.players?.[a.realm] ? 1 : 0)).slice(0, 5);
    if (!due.length) return;
    const lines = due.map((d) => {
      const c = s.chars[d.char], ruler = s.chars[s.realms[d.realm]?.ruler];
      return `- decision ${d.id}: ${c.title ?? ''} ${c.name} (${c.role}, ${ageOf(s, c)}), temperament ${temperText(c.temper)}${c.persona ? `; ambition: ${c.persona.ambition}; fear: ${c.persona.fear}; secret: ${c.persona.secret}` : ''}; loyalty to the crown ${Math.round(c.loyalty)}/100.${ruler && ruler.id !== c.id ? ` Their ruler: ${ruler.name}, ${temperText(rulingTemper(s, s.realms[d.realm]))}, aged ${ageOf(s, ruler)}.` : ''}\n  Situation: ${situation(s, d.realm)}${d.from ? ` The other side: ${situation(s, d.from)}` : ''}${d.claimant ? ` The claimant: ${situation(s, d.claimant)}` : ''}\n  Question: ${d.question}\n  Options: ${d.options.join(' | ')}`;
    });
    const out = await ask(big, `You are the minds of the rulers, generals, ministers and nobles of a living historical simulation of the Old World from 1200 AD. For each decision, choose exactly one of its options as that person would: guided by their temperament, ambition, fear and situation, not by what is wise. Loyal people rarely betray; treacherous and ambitious ones often do. ${NO_RELIGION} Reply with JSON only: {"answers":[{"id":"...","choice":"one of the options","say":"one sentence in their voice, at most 20 words"}]}`,
      `The date: ${s.month % 12 + 1}/${yearOf(s.month, s)}.\n${lines.join('\n')}`, 700);
    for (const a of out?.answers ?? []) {
      const d = due.find((x) => x.id === a.id);
      if (d && d.options.includes(a.choice)) era.queue(m + 1, 'answer', d.id, { choice: a.choice, say: clean(a.say, 22), by: big.model });
    }
  }

  // ---------- 3. counsel: a great power sets its course ----------
  async function counsel(s, m) {
    if (m % 2) return;
    const seen = era.get('counselAt') ?? {};
    const rid = spotlight(s, 12).filter((id) => !s.realms[id].rebel && !s.players?.[id]) // a player sets his own course.sort((a, b) => (seen[a] ?? -99) - (seen[b] ?? -99))[0];
    if (!rid) return;
    seen[rid] = m;
    era.put('counselAt', seen);
    const r = s.realms[rid], who = steersman(s, r), next = neighbours(s, rid).realms;
    const near = next.map((id) => {
      const o = s.realms[id], rel = atWar(s, rid, id) ? 'AT WAR' : allied(s, rid, id) ? 'ally' : (s.truces[[rid, id].sort().join('|')] ?? -1) > s.month ? 'truce' : 'peace';
      return `${id}: ${o.name}, strength ${Math.round(strength(s, id))} (${rel}${o.overlord === rid ? ', your vassal' : ''}${s.kin[[rid, id].sort().join('|')] ? ', kin by marriage' : ''}${o.horde ? ', a horde' : ''}, its word ${Math.round(o.rep ?? 60)})`;
    });
    const claims = claimsOf(s, rid).map((c) => `${cityOf(s, c.place)} (held by ${s.realms[c.holder]?.short})`);
    const powers = ['levy', 'walls', 'bribe', 'feast', 'silktax'];
    const out = await ask(big, `You are the ruler of a realm in a living historical simulation of the Old World from 1200 AD. Set your course for the coming months, in character. Choose only among the ids given. war: one neighbour to attack, or null. peace: neighbours you are at war with and want peace with (may be empty). ally: one neighbour to ally with, or null. build: true to raise a work (canal, caravanserai, market, library). tax: low, normal or high. power: your reign's one great gamble (levy, walls, bribe, feast, silktax) or null${r.power ? ' (already spent: use null)' : ''}. say: one sentence in your voice, at most 22 words, about your intent. ${NO_RELIGION} Reply with JSON only: {"war":null,"peace":[],"ally":null,"build":false,"tax":"normal","power":null,"say":"..."}`,
      `The date: ${yearOf(s.month, s)}. You are ${who.title ?? ''} ${who.name}${r.regent ? ` (regent for ${s.chars[r.ruler]?.name})` : ''}, aged ${ageOf(s, who)}, temperament ${temperText(rulingTemper(s, r))}${who.persona ? `; ambition: ${who.persona.ambition}; fear: ${who.persona.fear}` : ''}.\nYour realm: ${situation(s, rid)} Grain ${Math.round(r.grain ?? 0)}, learning: ${r.known.map((k) => INVENTIONS[k]?.name).join(', ') || 'none'}.\nNeighbours: ${near.join('; ') || 'none'}.${claims.length ? `\nYour old claims (an arbiter may rule on them): ${claims.join(', ')}.` : ''}`, 500);
    if (!out) return;
    const acts = [];
    if (next.includes(out.war) && !atWar(s, rid, out.war)) acts.push({ kind: 'war', target: out.war, say: clean(out.say, 24) });
    for (const t of Array.isArray(out.peace) ? out.peace : []) if (atWar(s, rid, t)) acts.push({ kind: 'peace', target: t });
    if (next.includes(out.ally) && !atWar(s, rid, out.ally)) acts.push({ kind: 'ally', target: out.ally });
    if (out.build === true) { const w = bestWork(s, rid); if (w) acts.push({ kind: 'build', ...w }); }
    if (powers.includes(out.power) && !r.power) acts.push({ kind: 'power', power: out.power });
    for (const a of acts) era.queue(m + 1, 'act', rid, a);
    era.queue(m + 1, 'plan', rid, { tax: ['low', 'normal', 'high'].includes(out.tax) ? out.tax : 'normal', said: clean(out.say, 24), by: big.model });
  }

  return async function afterMonth(s, events, m) {
    for (const job of [decisions, counsel, personas]) {
      try { await job(s, m); } catch (err) { console.error(`cast ${job.name} failed:`, err.message); }
    }
    save();
  };
}
