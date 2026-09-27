// The narrator and the plain-English "who's doing what" strip for the simple view.
// Templated like the Tech Lens: instant, free, works when scrubbing backwards, and never makes anything up.
export const WIN = { castles: 5, rounds: 3 }; // mirrors CFG.win in server/config.js

const other = (k) => (k === 'red' ? 'blue' : 'red');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const roundOf = (turn) => Math.ceil(turn / 2);
export const turnOf = (e) => +(/t(\d+)$/.exec(e?.traceId ?? '')?.[1] ?? 0);
const held = (s, k) => s.strongholds.filter((h) => h.owner === k).length;

// The castles are the only landmarks a newcomer knows, so every place is "at" or "near" one.
export function place(s, x, y) {
  const h = s.strongholds.reduce((b, c) => (dist(c, { x, y }) < dist(b, { x, y }) ? c : b));
  return `${dist(h, { x, y }) ? 'near' : 'at'} ${h.name}`;
}

// What each kind of weather does to the region it's in (the map has five regions, each under a real city's sky).
export const WEATHER = {
  clear: 'fair weather, so an army there forages 4 extra food',
  rain: 'mud, so every step there costs one more',
  snow: 'drifts slow every step, and armies there eat twice as much',
  storm: 'every step there costs one more, and attacks into it are 30% weaker',
  wind: 'attacks into it are 20% weaker',
  fog: 'an army there can only be seen from one tile away',
  heat: 'armies there eat twice as much food',
  cold: 'armies there eat 50% more food',
};
// The same, in two or three words, for the map.
export const WEATHER_SHORT = { clear: 'forage +4', rain: 'steps +1', snow: 'steps +1, eat ×2', storm: 'steps +1, attacks −30%', wind: 'attacks −20%', fog: 'armies hidden', heat: 'eat ×2', cold: 'eat ×1.5' };
export const SKY = { clear: '☀️', rain: '🌧️', snow: '❄️', storm: '⛈️', wind: '💨', fog: '🌫️', heat: '🔥', cold: '🥶' };
const signed = (n, digits = 0) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;
export const regionsOf = (s) => Object.entries(s.weather?.regions ?? {}).map(([id, w]) => ({ id, ...w }));
// "ETH rose 0.31% since Emberreach's last turn, so its treasury gained 31 gold."
const dividendText = (d, realm) => `${d.coin} ${d.pct >= 0 ? 'rose' : 'fell'} ${Math.abs(d.pct).toFixed(2)}% since ${realm}'s last turn, so its treasury ${d.gold >= 0 ? 'gained' : 'lost'} ${Math.abs(d.gold)} gold`;

// How real prices and weather are hitting each side right now, in a sentence or two. fx: effectsOf(state), from the server.
export function forces(s, cast, fx) {
  const out = [];
  if (fx) {
    for (const k of ['red', 'blue']) {
      const d = fx[k].dividend, mood = Math.round(fx[k].mood * 100);
      if (d?.gold) out.push(`${dividendText(d, cast[k].realm)}${mood ? ` (and ${fx[k].coin}'s trend this season has it fighting ${signed(mood)}%)` : ''}.`);
      else if (mood) out.push(`${fx[k].coin} is ${fx[k].pct >= 0 ? 'up' : 'down'} ${Math.abs(fx[k].pct).toFixed(2)}% this season, so ${cast[k].realm} fights ${signed(mood)}%.`);
    }
  }
  const bad = regionsOf(s).filter((w) => w.kind !== 'clear');
  if (bad.length) out.push(`Weather: ${bad.map((w) => `${w.kind} in the ${w.name}`).join(', ')}.`);
  return out;
}

// The big picture as a few sentences: who is winning, why, and how long is left.
export function headline(s, cast, fx) {
  const R = (k) => cast[k].realm;
  if (s.status === 'ended') {
    const pts = /score (\d+) to (\d+)/.exec(s.endReason ?? '')?.slice(1).map(Number).sort((a, b) => b - a);
    return [`${R(s.winner)} won season ${s.season}!`, pts ? `Time ran out, and they held more castles and land: ${pts[0]} points to ${pts[1]}.` : `${cap(s.endReason)}.`];
  }
  const r = held(s, 'red'), b = held(s, 'blue'), out = [];
  const near = ['red', 'blue'].find((k) => held(s, k) >= WIN.castles);
  if (near) {
    const left = WIN.rounds - s.kingdoms[near].holdStreak;
    out.push(`${R(near)} holds ${held(s, near)} of the 7 castles. If they keep them ${plural(left, 'more round')}, they win.`);
  } else if (r === b) out.push(`Neck and neck: ${plural(r, 'castle')} each.`);
  else {
    const lead = r > b ? 'red' : 'blue';
    out.push(`${R(lead)} is ahead, holding ${held(s, lead)} castles to ${held(s, other(lead))}.`);
  }
  const A = s.armies, down = ['red', 'blue'].find((k) => A[k].routed);
  const big = A.red.strength >= A.blue.strength * 1.5 ? 'red' : A.blue.strength >= A.red.strength * 1.5 ? 'blue' : null;
  if (down) out.push(`${R(down)}'s army was wiped out and is regrouping at home.`);
  else if (big) out.push(`${R(big)}'s army is much bigger: ${A[big].strength} soldiers to ${A[other(big)].strength}.`);
  out.push(...forces(s, cast, fx));
  const left = s.maxRounds - roundOf(s.turn);
  out.push(left > 0 ? `${plural(left, 'round')} to go.` : 'Final round! If nobody wins outright, whoever holds more castles (then land) wins.');
  return out;
}

function order({ action, args = {} }, s, k, cast) {
  if (action === 'move') return `move the army ${place(s, args.x, args.y)}`;
  if (action === 'attack') {
    const h = s.strongholds.find((c) => c.x === args.x && c.y === args.y);
    return h ? `attack ${h.name}` : `attack ${cast[other(k)].realm}'s army ${place(s, args.x, args.y)}`;
  }
  if (action === 'recruit') return `train ${args.n ?? 'more'} new soldiers`;
  if (action === 'fortify') return 'dig in and defend';
  return 'wait and hold its ground';
}

function battle(d, s, cast) {
  const R = (k) => cast[k]?.realm, a = d.attacker, df = d.defender;
  const foe = df.garrison ? `the defenders of ${d.stronghold}` : `${R(df.side)}'s army`;
  const m = Math.max(a.power, df.power) / Math.max(1, Math.min(a.power, df.power));
  const how = m >= 2 ? 'crushed' : m < 1.15 ? 'narrowly beat' : 'beat';
  const where = df.garrison ? '' : ` ${place(s, d.x, d.y)}`;
  return d.winner === a.side ? `${R(a.side)} ${how} ${foe}${where}.` : `${cap(foe)} ${how} ${R(a.side)}'s attack${where}.`;
}

// One turn told in plain sentences, plus the general's own words.
export function turnStory(evs, s, cast) {
  const R = (k) => cast[k]?.realm, G = (k) => cast[k]?.general;
  const lines = [];
  let quote = null, decided = false;
  for (const e of evs) {
    const d = e.data ?? {}, k = e.kingdom;
    const say = {
      'season.started': () => 'A new season begins. Both generals remember the lessons of the last one.',
      'turn.started': () => `It's ${R(k)}'s move.`,
      'agent.thinking_started': () => { quote = { who: G(k), text: 'Thinking…', thinking: true }; },
      'agent.thought': () => { if (!decided && d.text) quote = { who: G(k), text: d.text, thinking: true }; },
      'agent.fallback': () => `The AI is resting (free usage limit), so ${G(k)} follows simple standing orders.`,
      'agent.decision': () => {
        decided = true;
        quote = d.public_rationale ? { who: G(k), text: d.public_rationale } : null;
        return `${G(k)} decided to ${order(d, s, k, cast)}.`;
      },
      'army.held': () => (decided ? null : `${R(k)} has no army on the field, so it can only wait.`),
      'turn.timeout': () => `${G(k)} took too long to decide, so the army waited.`,
      'n8n.threshold_alert': () => `${R(k)} was running out of food, so an automation bought more.`,
      'n8n.unreachable': () => 'The automation service was down, so the game ran this turn by itself.',
      'battle.resolved': () => `Battle! ${battle(d, s, cast)}`,
      'stronghold.captured': () => `${R(k)} captured ${d.name}${d.previousOwner ? ` from ${R(d.previousOwner)}` : ''}!`,
      'army.routed': () => `${R(k)}'s army was wiped out and fled home to regroup.`,
      'army.moved': () => (d.retreat ? `${R(k)}'s army fell back.` : d.respawn ? `${R(k)}'s army has regrouped at home.` : null),
      'army.starving': () => `${R(k)}'s soldiers are starving, so the army is shrinking.`,
      // The start of a turn: what the markets and the weather just did to this kingdom.
      'resources.updated': () => {
        if (d.income === undefined) return null; // a food purchase, told by the automation line
        const parts = [];
        if (d.dividend) parts.push(`${dividendText({ coin: d.coin, pct: d.dividendPct, gold: d.dividend }, R(k))}.`);
        if (d.forage) parts.push(`${R(k)}'s army foraged ${d.forage} extra food in the clear weather.`);
        if (d.weather && ['heat', 'snow', 'cold'].includes(d.weather)) parts.push(`The ${d.weather} made ${R(k)}'s army eat ${d.eat} food this turn.`);
        return parts.join(' ') || null;
      },
      'market.shift': () => (d.coin === 'LINK' ? `LINK moved ${signed(d.pct, 2)}% this season, so soldiers now cost ${d.after} gold each, for both sides.`
        : d.coin ? `${d.coin} is ${d.pct >= 0 ? 'up' : 'down'} ${Math.abs(d.pct).toFixed(2)}% this season, so ${R(k)} now fights ${signed(d.mood * 100)}%.`
          : `The real ETH price moved, so Emberreach now earns ${d.after >= d.before ? 'a little more' : 'a little less'} gold.`), // season 1 wording
      'weather.changed': () => (d.name ? `${cap(d.kind)} in the ${d.name} (${String(d.place).split(',')[0]}): ${WEATHER[d.kind]}.`
        : `The sky over ${d.place} turned to ${d.kind}: ${WEATHER[d.kind]}.`), // season 2 had one sky for the whole map
      'chain.tx_confirmed': () => 'The result is now recorded on a public blockchain, where nobody can change it.',
      'season.ended': () => `Season over! ${R(d.winner)} wins.`,
    }[e.type]?.();
    if (say) lines.push(say);
  }
  return { lines, quote };
}

// Headline events for the "key moments" list. Successful sieges show as captures, so only failed ones count as battles.
export const MOMENTS = { 'season.started': '🚩', 'battle.resolved': '⚔️', 'stronghold.captured': '🏰', 'army.routed': '💥', 'season.ended': '🏆' };
export const isMoment = (e) => e.type in MOMENTS && (e.type !== 'battle.resolved' || !e.data.defender?.garrison || e.data.winner !== e.data.attacker?.side);

export function momentText(e, s, cast) {
  const R = (k) => cast[k]?.realm, d = e.data ?? {};
  if (e.type === 'battle.resolved') return battle(d, s, cast);
  if (e.type === 'stronghold.captured') return `${R(e.kingdom)} captured ${d.name}${d.previousOwner ? ` from ${R(d.previousOwner)}` : ''}`;
  if (e.type === 'army.routed') return `${R(e.kingdom)}'s army was wiped out`;
  if (e.type === 'season.ended') return `${R(d.winner)} won the season`;
  return 'The season began';
}

// The turn pipeline in plain words: what each piece of tech does, and what it did this turn.
// The first five run in order every turn; the last two bring the real world in (prices and weather).
export function flow(evs, s, meta, nowStage, proofs, fx) {
  const R = (k) => meta.cast[k]?.realm, G = (k) => meta.cast[k]?.general;
  const last = (pred) => evs.findLast(pred);
  const start = last((e) => e.type === 'turn.started');
  const ms = meta.turnIntervalMs, every = ms >= 60_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 1000)} seconds`;

  const n8n = last((e) => e.stage === 'n8n');
  const n8nNow = !n8n ? 'Waiting for the next turn.'
    : n8n.type === 'n8n.unreachable' ? 'Was down, so the game ran the turn itself.'
    : n8n.type === 'n8n.threshold_alert' ? `Food was low, so it bought more for ${R(n8n.kingdom)}.`
    : n8n.type === 'n8n.workflow_finished' ? `Delivered ${G(n8n.kingdom)}'s order to the game.`
    : n8n.type === 'n8n.news_posted' ? 'Posted the news to Discord.'
    : n8n.data?.workflow === 'Market Sync' ? 'Fetched the latest Chainlink prices.'
    : n8n.data?.workflow === 'Weather Sync' ? 'Fetched the latest weather.'
    : `Checked ${R(n8n.kingdom)}'s supplies and asked the general for orders.`;

  const ai = last((e) => e.stage === 'agent' && e.type !== 'agent.memory_written');
  const aiNow = !ai && start && evs.some((e) => e.type === 'army.held') ? 'Nothing to command: the army is regrouping.'
    : !ai ? (meta.llm.mode === 'live' ? 'Ready for the next turn.' : 'Resting: the free daily limit is used up.')
    : ai.type === 'agent.decision' ? `${G(ai.kingdom)} chose to ${order(ai.data, s, ai.kingdom, meta.cast)}${ai.data.mode === 'standing' ? ' (simple rules, AI resting)' : ''}.`
    : ai.type === 'agent.fallback' ? 'Resting, so simple rules are choosing.'
    : ai.type === 'agent.tool_called' || ai.type === 'agent.tool_result' ? `${G(ai.kingdom)} is studying the map…`
    : `${G(ai.kingdom)} is thinking…`;

  const g = last((e) => e.type === 'stronghold.captured') ?? last((e) => e.type === 'battle.resolved')
    ?? last((e) => e.stage === 'game' && !['turn.started', 'resources.updated', 'season.started'].includes(e.type))
    ?? last((e) => e.type === 'resources.updated');
  const gameNow = !g ? 'Waiting for an order.'
    : g.type === 'stronghold.captured' ? `${R(g.kingdom)} took ${g.data.name}.`
    : g.type === 'battle.resolved' ? `Rolled the dice: ${battle(g.data, s, meta.cast)}`
    : g.type === 'resources.updated' ? `Paid ${R(g.kingdom)} its gold and food.`
    : g.type === 'army.moved' ? `Moved ${R(g.kingdom)}'s army ${place(s, g.data.x, g.data.y)}.`
    : g.type === 'army.held' ? `Kept ${R(g.kingdom)}'s army where it was.`
    : g.type === 'army.fortified' ? `Dug ${R(g.kingdom)}'s army in.`
    : g.type === 'army.recruited' ? `Trained ${g.data.n} soldiers for ${R(g.kingdom)}.`
    : g.type === 'army.routed' ? `${R(g.kingdom)}'s army broke and fled.`
    : 'Carried out the order.';

  const tx = last((e) => e.stage === 'chain');
  const done = proofs.filter((p) => p.status === 'confirmed').length;
  const chainNow = tx?.type === 'chain.tx_queued' ? 'Writing the capture to the blockchain…'
    : tx?.type === 'chain.tx_sent' ? 'Sent. Waiting for the network to confirm…'
    : tx?.type === 'chain.tx_confirmed' ? 'Recorded for good. ✓'
    : tx?.type === 'chain.tx_failed' ? 'Failed this time; it shows openly and the game carries on.'
    : `Nothing to record this turn. ${plural(done, 'result')} on record so far.`;

  const coin = (k) => {
    const d = fx[k].dividend;
    return `${d ? `${d.coin} ${signed(d.pct, 2)}% since ${R(k)}'s last turn → ${signed(d.gold)} gold` : `${fx[k].coin}: no reading yet`}; ${signed(fx[k].pct, 2)}% this season → fights ${signed(fx[k].mood * 100)}%`;
  };
  const priceNow = !fx ? 'Waiting for the first prices.' : `${coin('red')}. ${coin('blue')}. LINK ${signed(fx.LINK.pct, 2)}% → soldiers cost ${fx.LINK.cost} gold.`;
  const skies = regionsOf(s);
  const weatherNow = !skies.length ? 'Clear skies.'
    : skies.map((w) => `${SKY[w.kind]} ${w.name}: ${w.kind}${w.place ? ` (${w.place.split(',')[0]}${Number.isFinite(w.tempC) ? ` ${Math.round(w.tempC)}°C` : ''})` : ''}`).join(' · ');

  const stages = [
    { id: 'event', icon: '⏰', name: 'The clock', tech: 'Cloudflare', does: `Starts a new turn every ${every}. Nobody presses a button.`,
      now: start ? `Round ${roundOf(turnOf(start))}: ${R(start.kingdom)}'s turn.` : 'Waiting for the first turn.' },
    { id: 'n8n', icon: '⚙️', name: 'Automation', tech: 'n8n', does: 'Runs each turn, reorders food, syncs prices and weather, posts news to Discord.', now: n8nNow },
    { id: 'agent', icon: '🧠', name: 'AI general', tech: `${meta.llm.model.split('/').pop()} on Groq`, does: 'Reads the map and picks one move, then explains why.', now: aiNow },
    { id: 'game', icon: '🎲', name: 'Game rules', tech: 'Rules engine', does: 'Blocks illegal moves and settles battles with fair, replayable dice.', now: gameNow },
    { id: 'chain', icon: '🔒', name: 'Blockchain', tech: 'Base Sepolia', does: 'Writes every castle capture to a public record nobody can edit.', now: chainNow },
    { id: 'oracle', icon: '📈', name: 'Live prices', tech: 'Chainlink', does: 'Each treasury is held in a coin: every 1% ETH or BTC moves = 100 gold won or lost. The season\'s trend sets fighting spirit; LINK sets the price of soldiers.', now: priceNow },
    { id: 'weather', icon: '🌦️', name: 'Live weather', tech: 'Open-Meteo, via n8n', does: 'Five regions, each dealt a real city\'s sky every season. Every kind of weather changes that ground: movement, food or fighting.', now: weatherNow },
  ];
  const seen = new Set(evs.map((e) => (e.type === 'turn.started' ? 'event' : e.stage)));
  return stages.map((st) => ({ ...st, done: seen.has(st.id), active: st.id === nowStage }));
}
