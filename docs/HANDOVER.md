# Agentistan: handover

State on 10 October 2026, at the commit that adds this file. Everything is pushed to `main` (which deploys) and to `campaigns-and-watch` (kept identical).

## 1. What this is

Agentistan has two parts, served by one Cloudflare Worker:

- **Watch**, at [agentistan.umarkhatana.com](https://agentistan.umarkhatana.com). The Old World of 1200: 117 real realms and their rulers, played entirely by AI and the rules. It advances one month every 2 hours. Nobody plays it; people watch. The page is simple: a map, a short "at a glance" panel, a chronicle, and popups on demand. Every panel can be hidden (eye button or H).
- **Campaigns**, at [/campaign/](https://agentistan.umarkhatana.com/campaign/). Short historical wars, in chronological order. You play the person who fought each one, with their historical goal, and can do better than history. The AI plays every other side. A finished campaign becomes a shareable replay, an AI historian's summary, and an optional NFT on Base Sepolia. Anyone can watch a campaign live.

The older two-kingdom game, **Nobody's Playing**, is retired but still served at [nobodysplaying.umarkhatana.com](https://nobodysplaying.umarkhatana.com) and at `/classic/`.

## 2. Decisions the owner has made

Keep to these unless the owner changes them.

- **Play means campaigns. Watch means the automated 1200 world.** The two were split to simplify the app.
- **Campaign roster:** 25 wars, in chronological order across all eras, including religious wars. "Hitler's Fury" is the owner's own idea; give it a neutral historian's voice and no Nazi symbols. The full order is in [campaigns-design.md](campaigns-design.md).
- **AI everywhere it helps, but on free tiers only (Groq).** The rules must always be able to take over when the AI budget runs out.
- **The AI plays every other faction** in campaigns, and every kingdom in Watch.
- **Each campaign has its own map**, built from Natural Earth data.
- **n8n and blockchain** are used where they add something, in the simplest way:
  - n8n announces finished wars and big moments;
  - each finished campaign can be kept as an NFT scroll, and the game pays the fees.
- **Campaign controls:** no dropdowns or forms. You command by talking to your council (advisers, generals, envoys) in plain words, like a real court. "Every word matters." The decision cards stay, but they arrive inside the conversation.
- **Characters are real.** The dead never act, lead or speak. The AI must strictly follow the game's data.
- **Dashboards** are rich infographics in popups that can be hidden, such as the war room. Every panel can be hidden for a full view of the map.
- **Watch** is very slow and simple. It has a scrolling timeline and step back/forward controls.
- **Working style:**
  - The owner likes work built end to end, then reported once it is done.
  - Push to remote when asked.
  - Commit messages end with a `Co-Authored-By` line for the AI that helped.

## 3. Where things stand

**Live and working:**

- **Watch:**
  - runs only the 1200 world, a month every 2 hours, with no players;
  - the AI counsels up to 6 realms a month, in rotation;
  - back/forward buttons (Shift jumps a year), mouse-wheel scrubbing over the timeline, and dragging the timeline;
  - army and battle icons stay readable at any zoom.
- **Campaigns, 7 of 25 built:** persian, sparta, alexander, hannibal, maccabees, caesar, threekingdoms.
- **Campaign play:**
  - a council chat with cards inside it;
  - a crisp map: SVG land, plus an HTML layer for cities and armies that keeps their size at any zoom;
  - the war room dashboard;
  - live watching and replays;
  - the end-of-war scroll beside history;
  - the NFT claim.
- **n8n Campaign Herald** on Render: the workflow `nbpCampaignHrld1`, at `/webhook/campaign`.
- **Regalia ERC-721** on Base Sepolia, at `0x265efc0a8cfde6a97e5c89fb6317c96e8b202cb2` (see `deployments/regalia-base-sepolia.json`). Campaign scroll token ids start at 1,000,000.

**Checks:**

- `npm test` passes: 29 tests, including "the people are real" and "the council understands plain words".
- `node tools/campaign/people-check.mjs` reports 0 problems over 280 simulated wars.

**Not done yet** (details in section 9):

- the other 18 campaigns;
- a balance pass;
- the owner's website write-ups.

## 4. Repository map

| Path | What it is |
|---|---|
| `server/worker.js` | Entry point. Routes `/api/run*`, `/api/runs`, `/internal/campaign/*` and `/nft/<id ≥ 1,000,000>` to Campaigns; `/api/era*` and the rest to Era; host-based routing for nobodysplaying. |
| `server/campaigns.js` | **Campaigns Durable Object** (SQLite). Holds runs, turns, plans and kv. Handles: start, plan, council, turn, claim, live WebSocket, the historian's summary, the n8n herald, the NFT mint (alarm), metadata and the SVG picture. |
| `server/era.js`, `server/cast.js`, `server/play.js` | **Watch** (the Era DO). `cast.js` holds the AI counsel rotation; `play.js` holds the retired player features. |
| `server/world.js` | The retired classic war (World DO). |
| `server/agent.js` | `makeLLM()`: the Groq client, with daily token and call caps and saved usage. |
| `web/silk/` | Watch front end (`view.js`, `view.css`) and the 1200 world's engine (`engine.js`, `world.js`, …). Watch's page is `web/index.html`. |
| `web/campaign/engine.js` | **The campaign rules.** Pure and deterministic; shared by browser, server and Node. |
| `web/campaign/court.js` | **The council's rules.** `situation()` (the AI's view of the war), `normalize()` (checks any proposal), `proposal()`, `interpret()` (plain words to orders), `summary()`, `suggestions()`. |
| `web/campaign/app.js` | The campaign page: menu, briefing, council chat, map taps, war room, end of season, scroll and NFT, watch/replay mode. |
| `web/campaign/map.js` | The map: SVG layers plus the `.marks` HTML overlay (cities, terrain glyphs, army tokens, reach badges, battle bursts). |
| `web/campaign/warroom.js` | The war room dashboard: per-side cards, sparklines, will gauges, charts, the living and the fallen. |
| `web/campaign/c/<id>.js` | One campaign's data. |
| `web/campaign/maps/<id>.json`, `<id>.graph.json` | Built map drawing, and the graph the engine uses. |
| `web/campaign/catalog.js` | Generated list of campaigns. Do not hand-edit; `seeds.mjs` writes it. |
| `tools/campaign/` | `seeds.mjs` + `build.py` (maps), `sim.mjs` (balance), `people-check.mjs` (characters), `browser-check.mjs` (real-browser play-through with screenshots). |
| `test/campaign.test.js` | Campaign tests. |
| `test/silk.test.js`, `test/game.test.js` | Watch and classic tests. |
| `n8n/workflows/` | n8n workflows. `campaign-herald.json` is the campaigns one. |
| `docs/campaigns-design.md` | Design of campaigns and Watch, and the full roster. |
| `docs/world-design.md` | The 1200 world's engine. |

## 5. How a campaign works

### The engine (`web/campaign/engine.js`)

- **Deterministic.** A run is `(campaign, seed, list of turn inputs)`. The server replays a run from its record and checks a checksum. The browser runs the same code.
- **`ENGINE = 2`.** Bump it whenever a change would make an old record replay differently.
  - Runs record `v`.
  - Runs from another version get HTTP 410, and the page offers "Begin it again".
  - `/api/runs` lists only the current version.
- **A season:** cards are answered, then all sides move at once. After that come battles (plans and counters), sieges, surrenders, plunder, gold and upkeep, will to fight, events, and the goal check.
- **People:**
  - `s.dead` lists everyone who has died.
  - Event or card effects can include `fx.kill` (with `fx.succeed: { Name: ['Successor', skill] }`) and `fx.leader`.
  - When an army is destroyed, its general escapes half the time; otherwise he dies.
  - Only named people die. `isPerson()` treats "New levies" or "the Argives" as nobody.
  - When a side's leader dies, the side passes to `C.sides[id].heirs` (the first heir still living), or to "the captains of X".
  - `sameMan()` treats "King Darius III" and "Darius III" as the same person.
- **The council:**
  - `courtOf(C, s)` returns the advisers in `C.court` (entries have `from`/`until` turns, and are filtered by death) plus your generals.
  - It never includes the commander's own army: the player *is* the commander.
- **Condition helpers.** The `q` object passed to event and card conditions has `owns`, `at`, `near`, `war`, `ally`, `will`, `flag`, `army`, `hero`, `living(name)`, and more.

### The council (`court.js` and `server/campaigns.js` → `council()`)

1. **The literal reading comes first.** `interpret()` reads the commander's words: cards answered, named armies, named places, plan words, "raise N", "offer peace", "make it so". These orders are fixed.
2. **Questions of fact are answered from the data,** with no AI. This covers "who leads…", "where are their armies", gold, and the goal.
3. **Otherwise the AI answers in character** and fills in only what the words left open. Its orders go through `normalize()`, which allows only the player's armies, real provinces and cards that are due. A target too far away becomes a step on the road, and the aim is kept for next season.
4. **The order list in the chat is always the truth.** The AI's sentences are flavour. In testing, they are now mostly right.

Other details:

- `COUNCIL_PER_SEASON` (default 8) caps AI replies per run per season; after that the rules answer.
- Offline (a local run with no server), the browser uses `interpret()` directly.
- The AI's first counsel each season and the other sides' plans come from `think()` / `planFor()`. They are made in the background after each turn and cached in the `plans` table.

### The AI budget

All models are Groq's free tier: about 200K tokens a day and 8K tokens a minute **per model, per account**.

| Who | Model | Daily cap in code |
|---|---|---|
| Campaign council's voice | `openai/gpt-oss-120b` (`COUNCIL_MODEL`) | 60K (`COUNCIL_TOKENS`) |
| Campaign plans and other sides | `openai/gpt-oss-20b` (`CAMPAIGN_MODEL`) | 185K |
| Campaign fallback | `qwen/qwen3.8-27b` (`CAMPAIGN_MODEL_2`) | 45K |
| Watch counsel | `openai/gpt-oss-120b` (`CAST_MODEL`) | 110K |
| Watch personas | `qwen/qwen3.8-27b` (`PERSONA_MODEL`) | 150K |
| Watch suggestions (`play.js`) | qwen | 60K |

**Watch out:**

- On paper, qwen's caps add up to more than 200K.
- So do 120b's, if the classic world or the free-plan feature (`LLM_MODEL`, 180K) is used heavily.

If Groq starts refusing calls, lower one of the caps. Each feature falls back to the rules or the next model.

### A turn on the server

`POST /api/run/<id>/turn` with `{token, t, inputs, aims}`:

1. The server adds the other sides' AI plans.
2. It resolves the turn and stores the inputs and checksum.
3. It broadcasts to watchers.
4. On a big moment it pings n8n.
5. When the war ends, `finish()` writes the verdict, then the historian's summary arrives, via n8n or directly after 90 s.

The page replays the turn and compares checksums. If it gets 409, it reloads from the server.

### NFT

1. The player claims with an address. The page can make a wallet in the browser.
2. The run is queued.
3. The DO's alarm mints with the deployer key, so the game pays the gas.

Metadata and picture are at `/nft/<token>.json` and `/nft/<token>.svg`. Testnet only.

## 6. Run, test, deploy

- **Install:** `npm install`. You need Node 22 or newer.
- **Local server:** `npx wrangler dev` (port 8787).
  - `.dev.vars` sets `N8N_URL=` and `PUBLIC_URL=http://localhost:8787`, so local runs never reach production n8n.
  - It has no AI key, so locally the council runs on the rules.
  - **Gotcha:** `pkill -f "wrangler dev"` also matches the shell that runs it. Restart from a separate script, or kill by PID.
- **Tests:** `npm test`.
- **Character check:** `node tools/campaign/people-check.mjs [seeds]`.
- **Real-browser check:**

  ```
  BASE=http://localhost:8787 SHOTS=/tmp/shots TURNS=3 SAY='How strong is the enemy?|We march on Placentia' node tools/campaign/browser-check.mjs hannibal 1440 900
  ```

  - Run it again at `390 844` for a phone.
  - It needs Playwright with Chromium. If Playwright isn't installed in the repo, set `PLAYWRIGHT=/path/to/playwright/index.mjs`.
  - Use `BASE=https://agentistan.umarkhatana.com` to test the live site, including the real AI.
- **Balance:** `node tools/campaign/sim.mjs <id> 30 --smart [--why] [--verbose] [--cards=history|advise|first|second]`.
- **Deploy:** push to `main`. Cloudflare's CI runs `wrangler deploy`, and it is live in about 80 seconds. Keep `campaigns-and-watch` in step: `git push origin campaigns-and-watch:main`.
- **Secrets** live in Cloudflare (`npx wrangler secret put NAME`) and are never committed:
  - `LLM_API_KEY` (Groq);
  - `REALM_SECRET` (n8n ↔ worker);
  - `DEPLOYER_PRIVATE_KEY` (testnet minter).

  Optional settings: `COUNCIL_MODEL`, `COUNCIL_TOKENS`, `COUNCIL_PER_SEASON`, `CAMPAIGN_MODEL`, `CAMPAIGN_TOKENS`, `WATCH_PACE_MS`, `COUNSEL_BATCH`.
- **n8n** runs on Render (`n8n/`, `https://agentistan-n8n.onrender.com`). It calls `/internal/campaign/summary` and `/internal/campaign/heralded` with the `x-realm-secret` header.

## 7. Adding a campaign (checklist)

1. **Write `web/campaign/c/<id>.js`**, using `hannibal.js` or `threekingdoms.js` as a model. It needs:
   - `id`, `n` (its place in the chronological order), `era`, `title`, `years`, `you`, `hero`, `court`, `hook`, `brief`, `goal`, `lose`, `history`;
   - `view`, `turns` (season labels), `meanwhile` (what history did each season), `sides`, `provinces`, `armies`, `cards`, `events`.
2. **Get the characters right:**
   - Side names must not be a person's name (use "The house of Cao", not "Cao Cao").
   - Give `heirs` to any side led by a person.
   - Make the leader's name match the army's general's name.
   - Write `C.court` with `from`/`until` from history.
   - Put each historical death in as an event with `fx.kill` (and `fx.succeed` / `fx.leader`), guarded by `if: (q) => q.living('Name')` so nobody dies twice.
   - Leave battle deaths to the game.
3. **Build the map:**

   ```
   node tools/campaign/seeds.mjs <id> | NE_DIR=<folder with ne_10m_land, ne_10m_minor_islands, ne_10m_lakes zips> python tools/campaign/build.py
   ```

   - Needs Python with shapely, numpy and pyshp.
   - The zips come from naciscdn.org (Natural Earth).
   - Coast handling: `sea` lanes, `straits`, and `cut` for edges that must not join (for example across the Alps).
4. **Check it:**
   - Simulate with `sim.mjs` (rules and `--smart`).
   - Run `people-check.mjs` and `npm test`.
   - Run `browser-check.mjs`.
5. **Optional:** add art keys (`art:` on cards) that exist in `web/art/manifest.json`. `tools/art.mjs` paints new ones with Workers AI.

## 8. Known rough edges

- **Balance**, measured on 10 Oct 2026 with `--smart` over 30 runs; the same on the commit before this round, so not a new regression:

  | Campaign | Result |
  |---|---|
  | Persian | 1 win in 30 (the Persians are still in Greece at the end) |
  | Sparta | 13 Athens surrenders; 15 Sparta itself falls |
  | Alexander | 6 wins; Alexander dies in 18 |
  | Hannibal | 22 Rome sues for peace (too easy, since history says Rome never broke) |
  | Maccabees | 23 wins |
  | Caesar | 0 wins (time runs out) |
  | Three Kingdoms | 30 "as history" |

  Targets:
  - wars history won should be won often by a competent player;
  - "better than history" should be rare;
  - wars history lost should be winnable maybe 15–35% of the time;
  - the hero should rarely die.
- **The AI council's sentences** can still misstate a detail. The order list is authoritative. If it matters, give the council more of the 120b budget or tighten the prompt in `council()`.
- **On phones**, the campaign map is small at the starting zoom, and army tokens crowd where many armies meet. You can zoom, but a better fit or grouping of tokens would help.
- **Portraits** are generated faces, not paintings, except a few (`hero.art`).
- **Old campaigns** (rules version 1) are closed by design. Players see a friendly message.

## 9. What to do next, in order

1. **The balance pass** over the 7 campaigns, with the targets above. Persian and Caesar first.
2. **The remaining 18 campaigns,** in this order:
   - attila
   - caliphate (Khalid)
   - hastings
   - crusade (Godfrey)
   - saladin
   - khan (Genghis; painted art exists: `hero.art: 'genghis-khan'`)
   - agincourt
   - hussites (plans include `wagons`)
   - constantinople
   - granada (Isabella)
   - babur
   - navarre (Henry IV)
   - gustavus
   - napoleon
   - august (Wilhelm II)
   - hitler ("Hitler's Fury")
   - finesthour (Churchill)
   - zhukov

   The engine already has plans for later eras: `guns`, `corps`, `dig`, `barrage`, `blitz`, `depth`.
3. **The owner's website task:**
   - On umarkhatana.com, split the portfolio's Work section into two projects:
     - the old post becomes **Nobody's Playing**, pointing at nobodysplaying.umarkhatana.com;
     - a separate new write-up for **Agentistan** (agentistan.umarkhatana.com), with screenshots and everything.
   - The site's repo is cloned at `~/umarkhatana.com` (GitHub `0xWick/umarkhatana`, Astro). Its Work list is in `src/data.ts`.
   - That clone currently has no entry for either game, so pull first and check the live site for the "old post".
   - Take fresh screenshots with `browser-check.mjs` against the live site.

## 10. Contacts and accounts (no secrets here)

- **GitHub:** `0xWick/agentistan` (this repo) and `0xWick/umarkhatana` (the website).
- **Cloudflare:**
  - account `5019c76593047f6f9ad9d2487a049106`;
  - Worker `agentistan`;
  - routes `agentistan.umarkhatana.com/*` and `nobodysplaying.umarkhatana.com/*`.
- **Render:** n8n at `agentistan-n8n.onrender.com`.
- **Base Sepolia contracts:** listed in `deployments/`. Regalia (campaign scrolls) is at `0x265efc0a8cfde6a97e5c89fb6317c96e8b202cb2`; the keeper (minter) is `0xaB24D8e5d6dEcEC70e5B10E215cD9B1A1e38F046`.
