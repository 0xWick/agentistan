# Agentistan: campaigns and the Watch

Decided with Umar on 2026-10-08. This replaces the "seize a throne in the living world" design of
[world-design.md](world-design.md) (its engine and the 1200 world stay; the council, seats and quarters leave the page).

The site has two parts:

- **Watch** (`/`): one world from 1200, played entirely by the AI and the rules, very slowly. A calm, simple view:
  the map first, a small "at a glance" panel, the chronicle, and popups only when you ask. Every panel can be hidden
  for the full map.
- **Campaigns** (`/campaign/`): short historical wars in time order, from the Persian Wars to the Second World War.
  You play one historical person, with the goal that person had. The AI plays every other side. You learn how it
  really went, turn by turn, and you can do better than history. A finished campaign becomes a shareable scroll (a
  replay with its timeline and a summary) and an NFT; anyone can watch a campaign live while it is being played.

## Principles

- **Simple to play, rewarding to think.** A turn is: move your armies on the map, answer the cards for the decisive
  choices, end the turn. Battles turn on the ground, the season, the armies and the plan, so a thoughtful player wins
  more. No forms.
- **History teaches.** Every turn ends with "Meanwhile, in history"; every scripted card shows, after you choose, what
  the real person chose and what came of it; the end shows your timeline beside history's.
- **Pure engine.** `web/campaign/engine.js` has no I/O and no clock: the same campaign, seed and inputs give the same
  war in the browser and on the server. The server checks every turn by replaying it.
- **The AI is the strategist, the rules move the pieces.** At turning points one batched request sets every AI side's
  plan (stance, target, peace or war, a line in character) and gives your advisor's counsel. The rules carry it out
  and check it. When the AI is late or out of its free budget, the rules decide and the page says so.
- **Free tiers only.** Groq free tier, Base Sepolia, Cloudflare free plan, n8n on Render.
- **Religion as history.** Campaigns may be about religious wars. The game's own voice is a neutral historian: it says
  what each side believed and why it fought, never which faith is right. Characters may speak of their faith as their
  sources record, but never mock another. No prophet appears as a character or in a portrait. Massacres are told
  plainly in the history notes and never count as a reward. The Watch world keeps its no-religion rule.

## A campaign

A campaign is a JS module in `web/campaign/c/<id>.js` (shared by browser and server) plus its map,
`web/campaign/maps/<id>.json`, built by `tools/campaign/build.py` from the module's province seeds.

- **Who and what:** the side you play, the hero (portrait, title), a one-line hook, a briefing of 2–3 short paragraphs,
  the goal (the historical one), and how it really ended.
- **The calendar:** a list of turns, each a date ("Spring 216 BC"), so quiet years can be skipped. 10–20 turns.
- **Meanwhile, in history:** a line for each turn: what really happened then.
- **The map:** 15–40 provinces (name, lat/lon, owner, walls, wealth), sea crossings, the theater's bounds. Provinces
  are Voronoi cells around the seeds, clipped to the land of the world map and to a radius around each seed, drawn in
  the same Equal Earth projection over the same parchment, so a campaign's map is a closer look at the world.
- **The sides:** name, colour, leader, gold, will to fight, soldiers' quality, horse share, fleet, AI temperament
  (`bold`, `steady`, `cautious`, `delaying`, `rash`), and a persona line for the AI.
- **Armies:** side, place, men, general and skill (1–5).
- **Cards:** the decisive choices of the war. Each has a time or a condition, a text, 2–3 options with effects (gold,
  men, will, relations, armies, flags, provinces), and what history chose. A preview of each option's effects is shown.
- **Events:** history's own moves (a new army raised, an ally changing sides, a fleet arriving), each with a
  condition, so history adapts when the player changes it.

## The rules (engine)

- **A turn:** card answers → AI plans → orders → movement (2 steps; mountains and marsh cost 2; sea crossings need a
  fleet or a strait) → battles → sieges and captures → money and upkeep → attrition (enemy land, mountains in winter,
  deserts in summer) → will to fight → events → goals.
- **Battles:** power = men × quality × general (±8% a skill point) × morale × plan × ground (defenders in hills,
  mountains, forest, or behind walls) × luck (±15%, seeded). The loser loses 25–75% and falls back, or is destroyed if
  it cannot. Plans: when you march on an enemy army you choose one of three plans, each fitting some ground, numbers
  and horse (charge, hold the high ground, double envelopment, feigned retreat, ambush, refuse battle, archers behind
  stakes, barrage, dig in, armour). Your advisor says which fits and why; the general picks if you do not.
- **Sieges:** a walled city falls after as many turns as its walls, or at once to a storm (a battle against its
  garrison behind the walls). Open land is taken by standing on it.
- **Will to fight:** each side's will (0–100) falls with defeats, lost cities, empty coffers and long war, and rises
  with victories. An AI side below 25 offers peace; your side at 0 recalls you (you lose).
- **The end:** the goal is met (win), the turns run out, your hero falls, or you are recalled. The verdict compares you
  with history: **better than history**, **as history**, or **worse than history** (3, 2 or 1 stars).

## Server

- **Campaigns** Durable Object (`server/campaigns.js`), one instance: runs and their turns in SQLite.
  - `POST /api/run {cid}` starts a run: `{ id, seed, token }`; the token (kept in the browser) is needed to play it.
  - `POST /api/run/<id>/plan {token, t}` asks for the AI's plans for turn t, at the start of the turn, so they are
    ready when the player ends it (the AI at turning points; the rules otherwise).
  - `POST /api/run/<id>/turn {token, t, inputs, chk}` records the turn after replaying it; the server's state is the
    truth. Watchers get the turn over a WebSocket (`/api/run/<id>/live`).
  - `GET /api/run/<id>` gives the run's record for replays; `GET /api/runs` the runs being played now and the latest.
  - `POST /api/run/<id>/claim {token, address}` gives the NFT an owner.
  - At the end: the verdict and the timeline at once; the historian's summary (AI) soon after; then n8n's Campaign
    Herald posts it to Discord; the NFT is minted in the next batch once it has an owner.
- **NFTs:** the Regalia contract already on Base Sepolia (`deployments/regalia-base-sepolia.json`); campaign scrolls use
  token ids from 1,000,000 up. `/nft/<id>` serves their metadata and picture.
- **n8n:** the Campaign Herald workflow: a finished campaign (summary → seal → Discord) and big moments of campaigns
  being played ("Hannibal has won at Cannae: watch live"). If n8n is quiet, the world does the summary itself.

## Watch

- The Era object runs only the age of 1200, one month every two hours (a year a day). No thrones to seize, no council.
- The AI plays every kingdom: each month one batched request sets the course of a group of realms, the great powers
  often and the small ones in turn, so every realm gets the AI's plan regularly. The rules carry it out.
- The page: the map; a top bar (title, date, live state; Campaigns, The world, Ask, Hide panels); a small "at a
  glance" panel; the chronicle; a simple catch-up bar. Great events show as a short headline you can open, never as an
  interruption. **H** or the eye button hides everything for the full map.

## Build

- [x] 1. Campaign maps: land of the world map, the builder, the first map
- [x] 2. Campaign engine and the first campaign (Hannibal), with tests
- [x] 3. Campaign page: menu, briefing, map and orders, cards, battle plans, turn recap, the end scroll, hiding panels
- [x] 4. Campaigns server: runs, AI plans, live watching, replays, summary, NFT; worker routes; wrangler migration
- [x] 5. n8n Campaign Herald
- [x] 6. Watch: 1200 only, a month every two hours, no players, AI strategist for every kingdom, the simple page
- [ ] 7. The other 24 campaigns, in time order
- [ ] 8. Balance pass (simulated runs), tests, README and design docs
