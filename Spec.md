Nobody's Playing — V1 Build Spec
Sep 26, 2026 · @Muhammad Umar
1. Why this exists
This is a sales tool disguised as a game. Its job is to make a client say "I get it — I want that for my business" within 60 seconds of opening a link.
Most people have heard of AI agents, n8n, blockchain and Chainlink, but can't picture what they do. A live world where nobody is playing makes each one visible: you watch an AI think, an automation fire, a real-world price move the economy, and a tamper-proof receipt appear.
Thesis (one sentence for the landing page): A war nobody is playing — run entirely by AI generals, business automations, real market data and a public ledger. Just watch.
Who it's for, and what each should walk away with:
Audience
What they should feel
What proves it
Prospective clients (founders, ops managers)
"These four tools map to problems I have."
Tech Lens translates every event into a business analogy
Technical buyers / CTOs
"This person can ship a real, reliable system."
Live tx links, n8n workflow screenshots, public repo, test report
General public (LinkedIn, X)
"That's cool, I'll share it."
Characters with personalities, battles, a season winner
Design rule that follows from this: every feature must either make a technology legible to a layman or prove it is real. Anything that does neither is cut from V1.
Working title: "Nobody's Playing". Rename freely.
2. What changed from the original idea
The core loop stays: two AI generals, n8n orchestration, one Chainlink feed, captures recorded on-chain. The changes all serve the "legible and provable" rule, or make it buildable and testable without you.
Change
Why
Added a Tech Lens layer — every log event carries a plain-English line and an "in your business, this is like…" analogy
The original showed what happened but not why a client should care. This is the single most important addition.
Added a live pipeline strip (Event → n8n → AI → Game → Chain) that lights up per turn
Makes the architecture visible without a diagram lecture
The contract itself reads Chainlink on every capture and stamps the ETH price into the record
Genuine on-chain oracle consumption, not just an off-chain API call dressed up
Asymmetric kingdoms: Red keeps its treasury in ETH, Blue in gold
Laymen instantly get "real markets affect this world"; price moves create strategy differences the AI must reason about
Generals have personalities and a visible journal (memory)
Personality makes it shareable; the journal proves the agent has memory
Seasons: games end and restart automatically; winners written on-chain
"Continuously running" needs an arc, or it becomes wallpaper
Agent runtime lives in the world server, called by n8n (not inside n8n's AI Agent node)
Deterministic mock mode for tests, reliable tool-calling, easy cost control. n8n still owns every trigger, rule and route.
n8n gets 4 workflows, each mapped to a business pattern (event routing, threshold alert, scheduled data sync, notifications)
Each workflow is a sellable service you can point to
Spectator-aware pacing and a daily LLM budget cap
A 24/7 public demo must not burn money when nobody is watching
Fork-based chain testing (Anvil fork of the testnet)
Lets Claude Code test everything, including the real Chainlink feed, without spending faucet ETH or waiting on you
"Hire me" footer and a How-It's-Built page
It's a portfolio piece; the call to action must be on the page
3. The spectator experience
A visitor opens one URL and sees a living map within 2 seconds, with no login, wallet or install. There are no player controls in V1.
First visit: a dismissible 4-card intro ("Meet the cast"): The Generals (AI agents), The Automations (n8n), The Oracle (Chainlink), The Ledger (blockchain). One sentence each, plus one business analogy. A "What am I looking at?" button reopens it.
Main screen (desktop; stacks vertically on mobile at 375 px):
+---------------------------------------------------------------+
| Header: title · Season 3, Turn 41 · proof counters            |
+---------------------------+-----------------------------------+
|                           | DECISION THEATER                  |
|        10x10 MAP          | General Vex is thinking...        |
|  terrain, forts, armies,  |  > get_enemy_position()           |
|  ownership tint, battle   |  "They're weak on the river."     |
|  animations               |  > attack(fort_3)                 |
+---------------------------+-----------------------------------+
| PIPELINE STRIP: Event > n8n > AI General > Game > Chain       |
+---------------------------+-----------------------------------+
| LIVE EVENT LOG            | TECH LENS (explains the selected  |
| color-coded by tech       | or latest event in plain English) |
+---------------------------+-----------------------------------+
| KINGDOM CARDS: gold, food, army, treasury, journal (memory)   |
| PROOF PANEL: on-chain receipts with explorer links            |
| Footer: Built by <name> · Hire me · How it's built            |
+---------------------------------------------------------------+
Proof counters (header): AI decisions made · Tool calls · Automations run · Oracle reads · On-chain receipts. They are cumulative across seasons and read from the database.
Tech Lens copy is templated per event type (no LLM, so it is instant, free and accurate). Examples Claude Code must implement, with the rest written in the same style:
Event
Plain English
In your business…
agent.tool_called
The AI general asked for information before deciding, like a manager checking a report.
An AI assistant that checks your inventory before placing an order.
n8n.workflow_run
An automation noticed something happened and started the right process on its own.
When a form is submitted, the CRM, invoice and welcome email all happen automatically.
n8n.threshold_alert
Food dropped below 20%, so an automation called the quartermaster.
Stock below minimum triggers a reorder and a Slack alert.
oracle.price_update
Real ETH price data was brought in from outside the game by Chainlink.
Your contracts or apps react to live exchange rates, weather or shipping data.
chain.tx_confirmed
The capture was written to a public ledger. Nobody, including the builder, can edit it.
Tamper-proof records for certificates, supply chain or payouts.
Event log format: 12:41:08  [AI] General Vex → get_enemy_position(), with a tech badge per line (AI, n8n, Oracle, Chain, Game). Clicking a line pins it in the Tech Lens.
Proof panel rows: Turn 41 · Red captured Fort 3 · ETH $X at capture · tx 0xabc… linking to the block explorer. Show pending → confirmed states.
How it's built page (/how): architecture diagram (static SVG), the 4 n8n workflows as screenshots, contract address with explorer link, repo link, and the latest test report summary.
Visual direction: clean, board-game-like 2D; one warm and one cool kingdom color; readable at a glance on a phone. No copyrighted sprites or emoji-dependent visuals; use simple SVG icons drawn for this project.
4. Game design
Two kingdoms fight over 7 strongholds on a 10×10 grid, one AI decision per turn, alternating Red then Blue. Rules are simple and deterministic so the AI's reasoning is the interesting part. All numbers below live in one game.config.ts so they can be tuned without code changes.
Cast
Kingdom
General (AI)
Personality
Treasury
Emberreach (Red)
General Vex
Aggressive, impatient, takes risks, short confident lines
Held in ETH: income swings with the real ETH price
Frostmere (Blue)
Marshal Ilsa
Cautious, economical, plays the long game, dry wit
Held in gold: stable income, +1 base gold per turn
Each kingdom also has a Quartermaster (a second, small AI agent) that n8n calls only when food runs low.
Map. Fixed, hand-authored JSON map, symmetric across the anti-diagonal (tile (x,y) mirrors (9−y, 9−x)). Coordinates 0–9. Red capital (1,1), Blue capital (8,8). Five forts: Red-side (3,2), Blue-side (7,6), and three frontier forts on the anti-diagonal at (7,2), (4,5) "Crown Fort" and (2,7). A river runs along the anti-diagonal; the three frontier forts are its only bridges. Sprinkle forest and mountain symmetrically. Claude Code may tune terrain, but must keep 7 strongholds and the symmetry.
Terrain
Move cost
Defense modifier
Notes
Plains
1
1.0
Default
Forest
1
1.2

Mountain
2
1.5

River
2
1.0
Attacking from a river tile ×0.8
Fort / Capital
1
1.3
Has a garrison
Armies. One army per kingdom. Strength starts at 100, max 200. Move budget 2 per turn. Morale starts at 1.0; +0.1 per win (max 1.3), −0.1 per loss (min 0.7).
General actions (exactly one per turn):
Action
Rule
move(x,y)
Destination within move budget, path avoids enemy army tile. Claims every plains/forest/mountain/river tile entered.
attack(x,y)
Target is adjacent and holds the enemy army or a non-owned stronghold. Resolves a battle. Winning against a stronghold captures it and moves the army in.
fortify()
Defense ×1.25 until your next turn; heal +5 strength.
recruit(n)
2 gold per strength point; only while standing on your capital or a fort you own.
hold()
Do nothing. Also the fallback when the agent times out or submits an invalid action twice.
Quartermaster action: buy_food(n), 1 gold per food, capped by gold and food capacity. Does not use the general's action.
Economy (applied at the start of each kingdom's turn):
• Gold income = (5 + 3 × forts owned + floor(tiles owned / 5)) × market multiplier. Blue gets +1 flat.
• Food: +4 per turn, +2 per fort owned; consumption = ceil(army strength / 10). Capacity 100, start 60. Start gold 50.
• Food at 0 → army loses 10% strength per turn ("starving").
• Market multiplier (Red only) = clamp(1 + (P_now / P_season_start − 1) × ORACLE_AMPLIFY, 0.5, 1.5). Default ORACLE_AMPLIFY = 10, shown in the UI as "game effect amplified 10×" for honesty. Testnet feeds move slowly; amplification keeps the effect visible.
Garrisons. Neutral strongholds start with garrison 25. A captured stronghold gets garrison 15, regenerating +2 per round to 30. Capitals start with garrison 40.
Combat (deterministic, seeded):
power = strength × morale × terrainMod × supplyMod × (1 + roll)
  attacker terrainMod: 0.8 if attacking from river, else 1.0
  defender terrainMod: tile defense modifier × 1.25 if fortified
  supplyMod: 0.7 if food == 0, else 1.0
  roll: uniform in [-0.2, +0.2] from seeded RNG
  seed = sha256(seasonId + ":" + turn + ":battle")
winner = higher power (ties go to defender)
loser loses 30% strength; winner loses 30% × (loserPower / winnerPower)
A losing army retreats 1 tile toward its capital. Below 10 strength it is routed: it respawns at its capital with 30 strength after 2 of its own turns. The battle seed and both power values are logged and stored so any battle can be replayed and checked.
Fog of war. The enemy army is visible if within Chebyshev distance 3 of your army or any stronghold you own. Otherwise the tool returns the last seen position and how many turns ago.
Seasons.
• Win: capture the enemy capital, or hold ≥ 5 of 7 strongholds at the end of 3 consecutive rounds.
• Round limit 40. Then score = 10 × strongholds + tiles owned; tie → Blue (the defender's advantage).
• On season end: 60-second results screen, each general writes a one-sentence "lesson learned" that carries into the next season's memory, the result is written on-chain, and a new season starts automatically.
Scenarios (SCENARIO env): standard; demo (armies start 2 tiles from the Crown Fort, so a capture happens in the first few turns); test_capture and test_starve (fixed deterministic setups used by the integration tests).
5. Architecture
One TypeScript "world" server owns the truth; n8n owns every trigger, rule and route; the chain is the public receipt book. Four containers in production, one extra (Anvil) in tests.
Component
Tech
Responsibility
world
Node 22, TypeScript, Fastify, SQLite (better-sqlite3 + Drizzle), viem, Anthropic SDK
Game engine, turn clock, REST + WebSocket API, agent runtime, chain outbox, serves the built web UI
n8n
Official n8n image, pinned to the latest stable 2.x tag at build time, SQLite storage
4 workflows: Turn Router, Supply Alert (sub-workflow), Market Sync, Town Crier
web
Vite, React, TypeScript, Tailwind
Spectator UI; built to static files served by world
contracts
Foundry, Solidity ^0.8.24
RealmLedger contract: stronghold ownership, capture records, season results; reads Chainlink ETH/USD
caddy (prod)
Caddy 2
HTTPS, reverse proxy; n8n editor not exposed publicly
anvil (test/dev)
Foundry Anvil, forking the testnet
Local chain with the real Chainlink feed state, no faucet ETH needed
Chain choice: Base Sepolia (chain id 84532, ~2 s blocks, cheap, easy faucets). Fallback preset: Ethereum Sepolia, where the Chainlink ETH/USD proxy is 0x694AA1769357215DE4FAC081bf1f309aDC325306 (Chainlink docs). Chain is config-driven (CHAIN_PRESET). Claude Code must take the Base Sepolia ETH/USD proxy address from Chainlink's feed address list and verify it on-chain before use: description() returns "ETH / USD", decimals() returns 8, latestRoundData().updatedAt is within the last 48 hours.
Turn lifecycle:
sequenceDiagram
  participant W as World (engine + clock)
  participant N as n8n: Turn Router
  participant S as n8n: Supply Alert
  participant A as World: Agent runtime
  participant C as Chain (RealmLedger)
  W->>N: POST /webhook/turn {season, turn, kingdom, traceId}
  N->>W: POST /internal/events (stage n8n, executionId)
  N->>W: GET /internal/kingdoms/:k/resources
  alt food < 20% of capacity
    N->>S: Execute sub-workflow
    S->>A: POST /internal/agent/quartermaster
    A-->>S: {action: buy_food, n, rationale}
    S->>W: POST /internal/actions (buy_food)
  end
  N->>A: POST /internal/agent/decide {kingdom, traceId}
  A->>W: read tools (in-process, same validated handlers)
  A-->>N: {action, args, public_rationale, memory_note}
  N->>W: POST /internal/actions
  alt invalid action
    W-->>N: 422 {reason}
    N->>A: decide again with retryReason (once)
    N->>W: POST /internal/actions (or hold)
  end
  W->>W: resolve battle, update state, emit events
  opt stronghold captured
    W->>C: recordCapture(...) via outbox (retries, nonce-safe)
    C-->>W: receipt, emit chain.tx_confirmed
  end
  W->>W: schedule next turn (interval) / watchdog
Side loops: Market Sync runs on an n8n schedule (default every 2 min) and reads the Chainlink feed itself via JSON-RPC eth_call, then posts the price to the world. Town Crier receives notable events (capture, season end) from the world and posts to Discord if a webhook URL is configured.
Reliability rules:
• The world never waits forever. If n8n has not posted an action within TURN_TIMEOUT_MS (default 75 s), the world applies hold(), logs "General hesitated", and advances.
• Chain writes go through a SQLite outbox: one sender, sequential nonces, 3 retries with backoff, status visible in the Proof panel. A chain outage never stops the game.
• Every request between world and n8n carries X-Realm-Secret (shared secret) and a traceId so the UI can group one turn's events.
• Spectator-aware pacing: with 0 WebSocket viewers for 5 minutes, the turn interval becomes IDLE_TURN_INTERVAL_MS (default 300 s), or the clock pauses if IDLE_MODE=pause. The first viewer to connect restores normal pace.
6. Component specs
Each component below is independently testable; the engine is pure functions so game rules never need a network to test.
6.1 World server
• Engine (world/src/engine): pure applyAction(state, action, rng) → { state, events } and startTurn(state, market) → { state, events }. No I/O. Seeded RNG (sha256-based) injected.
• Clock: schedules turns at TURN_INTERVAL_MS (default 20 000 live, 2 000 in tests), a watchdog at TURN_TIMEOUT_MS, and idle pacing (section 5).
• Database (SQLite, WAL mode): seasons, turns, state_snapshots (one per turn), events, battles (canonical JSON + hash), agent_memory, lessons, chain_outbox, oracle_prices, llm_usage (tokens, cache hits, estimated USD), counters.
• Restart-safe: on boot, resume from the latest snapshot; never lose an outbox item.
• WebSocket /ws: on connect send snapshot (state + last 100 events + counters), then stream event messages.
• Serves the built web UI at / and /how.
6.2 Agent runtime
• Provider: Anthropic Messages API with tool use. GENERAL_MODEL default claude-haiku-4-5-20251001 (cheap, fast); claude-sonnet-5 as an optional "premium" setting. Provider behind an interface so another LLM can be added later.
• Modes: LLM_MODE=live|mock. Mock is a heuristic bot that makes the same tool calls and writes template rationales. It is used in tests, and in production when the daily budget is spent, with a visible UI label "Generals resting, running on standing orders".
• General tools: read tools get_battlefield, get_enemy_position, get_resources, get_market, get_journal; action tools move, attack, fortify, recruit, hold. Calling an action tool ends the loop. The runtime dry-runs the action through the engine; if invalid, it returns the error to the model (max 2 corrections). The decision is returned to n8n, not applied — n8n posts it to the world.
• Action tool schema requires public_rationale (≤ 30 words, in character, plain English) and memory_note (≤ 25 words).
• Limits per decision: ≤ 6 model calls, ≤ 8 tool calls, 45 s wall clock, max_tokens 400 per call.
• Prompt: system prompt = rules summary generated from game.config.ts + personality + style rules ("before each tool call, write one in-character sentence of ≤ 20 words"). Use prompt caching on system prompt and tool definitions.
• Memory given each turn: last 8 journal notes, last 3 season lessons, last known enemy position.
• Streaming to UI: each text block emits agent.thought; each tool use emits agent.tool_called, then agent.tool_result (summarized).
• Quartermaster: tools get_resources, buy_food(n); ≤ 3 model calls.
• Season end: one call per general for the "lesson learned" sentence.
• Safety: spectators cannot send text, so no user input ever reaches a prompt. Rationale text is length-capped and stripped of URLs and markup before display.
6.3 n8n workflows
• Workflows live as JSON in n8n/workflows/. The container entrypoint imports and publishes them before starting n8n: n8n import:workflow --separate --input=/workflows, then n8n publish:workflow --id=<id> per workflow. n8n 2.0 replaced activate/deactivate with publish/unpublish, and these CLI changes need a restart to take effect if n8n is already running (n8n CLI docs).
• Use only built-in nodes: Webhook, Respond to Webhook, Schedule Trigger, HTTP Request, IF, Switch, Set, Execute Workflow, Execute Workflow Trigger. No Code nodes (n8n 2.x runs them on task runners and blocks env access by default (n8n 2.0 breaking changes)).
• Config comes from environment via $env in expressions (WORLD_URL, REALM_SECRET, CHAIN_RPC_URL, FEED_ADDRESS, DISCORD_WEBHOOK_URL). Set N8N_BLOCK_ENV_ACCESS_IN_NODE=false and verify $env resolves in expressions on the pinned version.
• Create the n8n owner account non-interactively from N8N_OWNER_EMAIL / N8N_OWNER_PASSWORD using the method the pinned version supports, and verify by logging in with Playwright (this is also how the workflow screenshots for /how are captured).
• Every workflow posts n8n.workflow_started and n8n.workflow_finished to /internal/events with workflow, executionId and traceId.
Workflow
Trigger
Steps
Business pattern it demonstrates
Turn Router
Webhook POST /webhook/turn (respond 202 immediately)
Report start → get resources → IF food < 20% run Supply Alert → decide (60 s timeout, continue on error) → post action → on 422 decide again with retryReason, else post hold → report finish
Event-driven orchestration with error handling and retries
Supply Alert
Execute Workflow Trigger (sub-workflow)
Report → call Quartermaster → post buy_food → report
Threshold alert → automatic reorder
Market Sync
Schedule, every MARKET_SYNC_MINUTES (default 2)
JSON-RPC eth_call to the feed with selector 0xfeaf968c (latestRoundData()) → Set node decodes answer (word 2) and updatedAt (word 4) with expressions → post to /internal/oracle/price
Scheduled sync of external data into a system
Town Crier
Webhook POST /webhook/crier
IF DISCORD_WEBHOOK_URL set → post a formatted message; else report "no channel configured"
Notifications to the tools a team already uses
If the Market Sync hex decoding proves unreliable on the pinned n8n version, fall back to an HTTP call to /internal/oracle/refresh (the world reads the feed with viem) and note the fallback in the build report.
6.4 Smart contract: RealmLedger
• Constructor: (address priceFeed, address operator); owner = deployer. setOperator is owner-only.
• startSeason(uint32 season, uint8[7] initialOwners) — operator only.
• recordCapture(uint32 season, uint32 turn, uint8 strongholdId, uint8 kingdom, bytes32 battleHash) — operator only. Reads latestRoundData(), requires answer > 0, updates ownerOf[season][strongholdId], emits StrongholdCaptured(season, turn, strongholdId, kingdom, previousOwner, ethUsd, priceUpdatedAt, battleHash).
• recordSeasonResult(uint32 season, uint8 winner, uint16 rounds, bytes32 finalStateHash) — operator only; emits SeasonEnded.
• battleHash = keccak256 of the battle's canonical JSON stored in SQLite. The /how page has a "verify a battle" box: paste a turn number, see the JSON, its hash, and the matching on-chain event.
• Foundry tests: unit tests with a mock aggregator, access control, events, and a fork test against the real feed on a forked testnet.
• Deploy with forge script; write deployments/<chain>.json (address, block, feed, tx). Verify source on the explorer if ETHERSCAN_API_KEY is set.
6.5 Web UI
• Components: MapGrid (SVG; terrain, ownership tint, army tokens with strength, move and battle animations), DecisionTheater, PipelineStrip, EventLog (filter by tech), TechLens, KingdomCard (resources, market multiplier, journal), ProofPanel, HeaderCounters, IntroCards, SeasonResults overlay, HowPage.
• Reconnects the WebSocket automatically; shows "Live" / "Reconnecting" state.
• Accessibility: tech badges use icon + label, not color alone; respects prefers-reduced-motion; readable at 375 px.
• Branding from env: PUBLIC_OWNER_NAME, PUBLIC_HIRE_URL, PUBLIC_REPO_URL, PUBLIC_CONTACT_EMAIL, PUBLIC_EXPLORER_URL.
7. API and event contracts
Public endpoints are read-only; everything that changes state is under /internal/* and requires X-Realm-Secret. Validate every request body with Zod and publish the schemas from a shared packages/contracts-ts package used by world, web and tests.
Method + path
Auth
Purpose
GET /api/health
none
{ ok, world, n8n, chain, oracle, llmMode, budgetLeftUsd }
GET /api/state
none
Current snapshot (fog of war not applied; spectators see everything)
GET /api/events?since=<id>&limit=
none
Paged events
GET /api/proof
none
Chain records with status and explorer links
GET /api/battles/:season/:turn
none
Canonical battle JSON + hash
WS /ws
none
snapshot, then event messages
GET /internal/kingdoms/:k/resources
secret
Gold, food, capacity, strength (used by Turn Router)
POST /internal/agent/decide
secret
{ kingdom, traceId, retryReason? } → { action, args, public_rationale, memory_note, usage }
POST /internal/agent/quartermaster
secret
{ kingdom, traceId } → { action: "buy_food", args: { n }, rationale }
POST /internal/actions
secret
Apply an action; 200 with events, or 422 { reason }
POST /internal/events
secret
n8n stage reporting
POST /internal/oracle/price
secret
{ roundId, answer, decimals, updatedAt, source }
POST /internal/oracle/refresh
secret
World reads the feed itself (fallback)
POST /internal/test/*
secret + NODE_ENV=test only
reset, scenario, tick (advance one turn now), set-food
Event envelope (every event stored and broadcast in this shape):
{
  "id": 1042,
  "ts": "2026-09-26T12:41:08.120Z",
  "season": 3,
  "turn": 41,
  "traceId": "s3-t41",
  "stage": "game | n8n | agent | oracle | chain",
  "type": "agent.tool_called",
  "kingdom": "red | blue | null",
  "summary": "General Vex → get_enemy_position()",
  "lensKey": "agent.tool_called",
  "data": {}
}
Event types:
Stage
Types
game
turn.started, turn.ended, army.moved, battle.resolved, stronghold.captured, army.routed, resources.updated, season.started, season.ended, turn.timeout
n8n
n8n.workflow_started, n8n.workflow_finished, n8n.threshold_alert, n8n.retry, n8n.notification_sent
agent
agent.thinking_started, agent.thought, agent.tool_called, agent.tool_result, agent.decision, agent.memory_written, agent.fallback
oracle
oracle.price_update, market.shift
chain
chain.tx_queued, chain.tx_sent, chain.tx_confirmed, chain.tx_failed
Every lensKey must have a Tech Lens entry (plain English + business analogy). A unit test fails if any event type lacks one.
8. Testing and definition of done
The build is done when make verify and make verify-live both pass and reports/BUILD_REPORT.md exists. Claude Code must not declare completion on anything less, and must fix and re-run rather than skip a failing test.
Tier
Tool
Covers
Runs
Needs
1. Engine unit
Vitest
Every action, economy, combat determinism (same seed → same result), fog of war, season end, routing, Tech Lens coverage
make verify
nothing
2. Contract
Foundry
Mock-aggregator unit tests, access control, events, fork test reading the real feed
make verify
RPC URL
3. Agent
Vitest
Mock mode end to end; tool-loop limits; invalid-action correction; rationale sanitizing; budget fallback
make verify
nothing
4. Integration
Docker Compose + Vitest
Full stack: world + real n8n + Anvil fork + mock LLM (scenarios below)
make verify
Docker, RPC URL
5. UI E2E
Playwright
Page, streaming, Tech Lens, proof links, mobile, screenshots incl. n8n editor
make verify
Docker
6. Live
Script
Real Claude + real testnet deploy, 10 turns of demo
make verify-live
All keys, funded wallet
Integration scenarios (tier 4), each an automated test with TURN_INTERVAL_MS=2000:
1. Capture → chain. test_capture: within 20 turns there is ≥ 1 stronghold.captured, a matching chain.tx_confirmed, ownerOf on-chain equals world state, and the event's ethUsd equals the feed answer at that block.
2. n8n is really in the loop. Every turn has n8n.workflow_started and n8n.workflow_finished with an executionId, and n8n's own execution records show those executions succeeded.
3. Threshold automation. test_starve (food forced to 15): Supply Alert runs within 1 turn, buy_food applies, food rises.
4. Oracle via n8n. With the schedule at 10 s: oracle.price_update with source: "n8n" arrives, and its answer equals a direct viem read of the feed.
5. n8n outage. Stop n8n mid-season: world logs turn.timeout, applies hold, keeps advancing. Restart n8n: normal turns resume.
6. Chain outage. Stop Anvil: game continues, outbox retries. Restart: outbox drains, all receipts confirmed.
7. World restart. Restart world: resumes the same season and turn with no duplicate chain writes.
8. Budget cap. Live mode with MAX_LLM_USD_PER_DAY=0: agents fall back to mock and the UI shows the "standing orders" label.
9. Season cycle. Accelerated season reaches an end condition, writes recordSeasonResult, and starts season N+1 with lessons in memory.
Playwright checks (tier 5): map shows 100 tiles and 7 strongholds; new events appear within 5 s; clicking an event fills the Tech Lens; proof links match PUBLIC_EXPLORER_URL/tx/0x…; no horizontal scroll at 375 px; intro cards open and close. Save screenshots (desktop, mobile, /how, each n8n workflow in the editor) to reports/screenshots/.
Live tier (tier 6): deploy RealmLedger to Base Sepolia, run 10 turns of demo with real Claude, assert ≥ 1 confirmed capture transaction by fetching its receipt, and assert LLM spend for the run is under $0.50 (from llm_usage).
Definition of done:
[ ] make verify passes from a clean clone (git clean -xdf then make setup && make verify)
[ ] make verify-live passes against Base Sepolia with real Claude
[ ] Contract deployed; address and deploy tx in deployments/base-sepolia.json; verified on the explorer if a key was given
[ ] docker compose -f docker-compose.prod.yml up -d runs the full stack; /api/health all green
[ ] Screenshots saved and used on /how
[ ] reports/BUILD_REPORT.md: test results per tier, contract address, sample tx links, LLM cost per decision and per hour at default pace, known limitations, any deviations from this spec and why
[ ] README.md: what it is (layman first), how to run, how to configure, architecture diagram
[ ] No secrets in git (gitleaks or equivalent scan passes)
9. Milestone build plan
Claude Code builds in 10 milestones, committing after each one only when its exit check passes. Expect roughly a working day of agent time rather than a few hours; the first playable loop (M4) is the halfway point.
Repo layout:
nobodys-playing/
  world/            # Fastify server: engine, clock, api, ws, agent, chain, oracle, db
  web/              # Vite + React spectator UI
  contracts/        # Foundry project: RealmLedger, tests, deploy script
  n8n/              # workflows/*.json, entrypoint.sh (import + publish + owner setup)
  packages/contracts-ts/   # shared Zod schemas and types
  tests/            # integration + Playwright
  deployments/      # <chain>.json written by deploy
  reports/          # BUILD_REPORT.md, screenshots/
  docker-compose.yml, docker-compose.test.yml, docker-compose.prod.yml
  Makefile, .env.example, README.md, SPEC.md (this document)
#
Milestone
Exit check
M0
Scaffold monorepo (pnpm workspaces), Makefile targets, .env.example, CI-style lint + typecheck; verify every key in .env works (Anthropic ping, RPC chain id, wallet balance, feed description())
make setup && make check-env green
M1
Engine + config + map + scenarios, pure functions
Tier 1 green
M2
RealmLedger + Foundry tests + deploy script (Anvil fork)
Tier 2 green; deploy to fork works
M3
World server: DB, clock, API, WS, outbox, oracle reader, test endpoints
Server boots; /api/health green against Anvil
M4
Agent runtime (mock first, then live behind flag)
Tier 3 green; one live decision succeeds and is logged with cost
M5
n8n: 4 workflows, entrypoint import/publish, owner setup
Integration scenarios 2–4 green
M6
Web UI: all components, Tech Lens copy for every event type
UI renders the live stream locally
M7
Full integration + resilience
All tier 4 scenarios + tier 5 green (make verify)
M8
Live testnet: deploy to Base Sepolia, 10 live turns
make verify-live green
M9
Production compose + Caddy; optional deploy to your VPS; README + BUILD_REPORT
Definition of done complete
Rules for the build agent:
• Pin every version (Node, pnpm, n8n image tag, Foundry, npm deps) and record them in the report.
• When the spec and reality disagree (an n8n CLI flag, a feed address), verify against official docs, pick the working option, and log the deviation in the report. Do not stop to ask.
• Stop and ask only for: missing or invalid credentials, an empty wallet, or a spend that would exceed the budgets in section 11.
10. What you provide at the start
Fund the wallet and create the keys before starting Claude Code; after that, nothing in the build needs you. Put the values in a .env file (never committed) at the repo root.
Variable
Required
What it is
How to get it
ANTHROPIC_API_KEY
Yes
Claude API key for the generals
Claude Console; set a monthly spend limit there too (e.g. $20)
DEPLOYER_PRIVATE_KEY
Yes
A brand-new, testnet-only wallet. Deploys the contract and acts as operator
Create a fresh wallet; never reuse one that has held real funds
(funding)
Yes
~0.05 Base Sepolia ETH in that wallet
A Base Sepolia faucet, e.g. Coinbase Developer Platform or QuickNode
BASE_SEPOLIA_RPC_URL
Yes
A dedicated RPC endpoint (the public one is rate-limited and weak for forking)
Free tier at Alchemy, QuickNode or Infura
ETHERSCAN_API_KEY
Optional
Verifies contract source on the explorer (makes the proof more convincing)
Etherscan account; the V2 key covers Base
DISCORD_WEBHOOK_URL
Optional
Town Crier posts captures and season results
Discord channel → Integrations → Webhooks
N8N_OWNER_EMAIL, N8N_OWNER_PASSWORD
Yes
Your n8n editor login
Choose any
PUBLIC_OWNER_NAME, PUBLIC_HIRE_URL, PUBLIC_REPO_URL, PUBLIC_CONTACT_EMAIL
Yes
Branding and call to action
Your details
REALM_SECRET, N8N_ENCRYPTION_KEY
Generated
Shared secret and n8n key
Claude Code generates these in M0
Environment and permissions for the Claude Code session:
• Docker and Docker Compose available, and permission to run them.
• Network access to: npm registry, Docker Hub, GitHub, api.anthropic.com, your RPC host, docs.chain.link, docs.n8n.io, the Base Sepolia explorer, and Foundry's install host.
• Permission to install Foundry, Node 22 and pnpm if missing.
• A GitHub repository and push access (a fine-grained token scoped to that one repo).
• Optional, for public hosting (M9): a small VPS (2 vCPU, 4 GB RAM, Ubuntu 24.04), its SSH host, user and key, and a domain or subdomain whose A record already points at the VPS.
• Run Claude Code in a mode that auto-approves shell commands inside the project folder, so it doesn't pause for permission prompts.
11. Cost, safety and limits
With Haiku and prompt caching, expect roughly $2–3 per hour while people are watching and well under $0.20 per hour when idle; a daily cap enforces a hard ceiling. These are approximate estimates from ~4 model calls and ~12k input tokens per decision; check current Anthropic pricing, and the build report must replace them with measured numbers.
Setting
Default
Effect
TURN_INTERVAL_MS
20 000
~180 AI decisions per hour with viewers
IDLE_TURN_INTERVAL_MS / IDLE_MODE
300 000 / slow
~12 decisions per hour with no viewers; pause stops entirely
MAX_LLM_USD_PER_DAY
5
Past the cap, generals switch to mock ("standing orders") until midnight UTC
GENERAL_MODEL
claude-haiku-4-5-20251001
claude-sonnet-5 gives richer reasoning at several times the cost
Chain gas
—
Only captures and season results are written: roughly 10–30 transactions per season. 0.05 test ETH lasts a very long time
Safety and honesty rules:
• Testnet only. The operator key sits on the server, which is acceptable only because it never holds real value.
• The n8n editor is never exposed publicly; bind it to localhost and reach it over an SSH tunnel.
• Rate-limit the public API and WebSocket connections per IP.
• No spectator input reaches any prompt, so there is no prompt-injection surface in V1.
• Keep the war theme PG: no gore, no real people, places or flags.
• Label everything honestly in the UI: "testnet", "game effect amplified 10×", "standing orders" when mock is running. A portfolio piece loses credibility the moment a visitor catches it faking something.
• Footer disclaimer: test network, no real money, not financial advice.
12. V2/V3 roadmap
Each expansion adds one new, sellable capability, so every release is also a new portfolio post. None of these block V1.
Version
Feature
What it showcases to clients
V2
MCP server exposing the game's read tools, so any MCP client (e.g. Claude Desktop) can ask "who's winning and why?"
Connecting AI assistants to your own systems
V2
Chainlink VRF for battle randomness
Provably fair outcomes (lotteries, raffles, gaming)
V2
Quartermaster rebuilt in n8n's AI Agent node beside the coded one
No-code vs code agents; you can build either
V2
Spectator influence: visitors vote on a weather event each round
Human-in-the-loop AI; handling untrusted input safely
V2
Diplomacy: generals exchange messages and can agree truces
Multi-agent negotiation
V2
L2 sequencer uptime check in the contract
Production-grade oracle hygiene
V3
Mercenaries paid on-chain by the generals from a budget
Agent payments and spending limits
V3
Bring your own general: visitors submit a strategy prompt; sandboxed league table
Prompt engineering, evaluation, safety
V3
White-label demo: reskin kingdoms as warehouses, armies as delivery fleets
Proves the same architecture runs a real business workflow
13. Kickoff prompt for Claude Code
Export this doc as Markdown, save it as SPEC.md in an empty repo with your .env beside it, then paste the prompt below.
You are building "Nobody's Playing", specified in SPEC.md in this repo. Read all of SPEC.md before writing any code.

Purpose: a public portfolio demo that makes AI agents, n8n automation, Chainlink oracles and blockchain records understandable to non-technical clients. Every feature must make a technology legible or prove it is real.

How to work:
1. Follow the milestones in section 9 in order. After each one, run its exit check; commit only when it passes, with a message "M<n>: <summary>".
2. Credentials are in .env. In M0, verify each one (Anthropic ping, RPC chain id, wallet balance >= 0.01 ETH, Chainlink feed description() == "ETH / USD"). If any fails, stop and tell me exactly which and why. This is the only reason to stop early.
3. When the spec and reality disagree (CLI flags, node versions, feed addresses), check official docs, choose the working option, keep going, and record the deviation in reports/BUILD_REPORT.md.
4. Never skip, weaken or delete a failing test to get green. Fix the cause.
5. Keep LLM spend during development under $10 total: use LLM_MODE=mock everywhere except the M4 live check and M8.
6. Never commit .env or any key. Run a secret scan before every push.
7. You are done only when every item in the section 8 Definition of Done is checked. Finish by printing: the contract address, 3 sample transaction links, the local URL, test results per tier, and the measured LLM cost per hour.