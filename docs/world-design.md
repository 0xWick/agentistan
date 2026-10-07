# Agentistan: design and build plan

Agentistan is a living map of the Old World that writes its own history. Real realms and rulers start each age; rules,
AI characters and (later) players carry it on. Watching it should feel like a war-history video. Playing it should feel
like a slow Rome II or Frostpunk you can check twice a day.

Decided with Umar on 2026-10-07: keep the stack (Cloudflare Worker + Durable Objects, plain web page, Groq, Base
Sepolia, n8n). Rebuild the engine's structure inside it, and build every phase below without stopping for reviews
("I would rather change things once everything is built").

## Principles

- **The game first.** Every mechanic must show on the map or in a card, and must change what happens.
- **Pure engine.** `tick(state, brain, inputs)` has no I/O and no clock. Every random draw comes from
  `rngFor(age, month, ...)`. The same age and the same inputs give the same history, in Node, in a Worker and in a
  browser.
- **Decisions are requests.** The rules (doctrine), the AI and players all send the same acts. The engine applies an
  act only if the rules allow it. If nobody answers in time, doctrine decides.
- **Free tiers only.** One Durable Object per world (alarms, SQLite, hibernating WebSockets, 30 s CPU per request).
  Groq free tier: three models, 200k tokens a day each. Workers AI: 10k neurons a day (about 230 Flux pictures).
  Base Sepolia testnet.
- **No religion** in rules or AI text.

## Engine layout (web/silk/, shared by browser and server)

| Module | What it owns |
|---|---|
| `core.js` | map data, randomness, calendar, climate, indexes, lookups, text helpers, ids |
| `ages/1200.js` | the age of 1200: realms, starting wars and alliances, roads, inventions, scripted forces (the steppe, Alamut, the Venetian expedition) |
| `ages/ancient.js` | 200 BC: the owners, cities and peoples of every province, Rome's consuls, the Xiongnu raids |
| `ages/modern.js` | 1914: the empires and their colonies, wealth from industry, the July Crisis and the powers that join the war, the Russian revolutions and the borderlands, presidents and prime ministers, the Great Depression, strongmen |
| `economy.js` | gold, grain, horses, iron, prosperity, trade, works (canals, caravanserais, markets, libraries) |
| `war.js` | conflicts (wars as stories), marching, battles over 1–3 months, sieges, captures, the fall of realms |
| `court.js` | characters: temperaments, families, marriages, offices (consort, heir, vizier, generals), succession, betrayal, plots, intrigue, epithets |
| `people.js` | loyalty, revolts, separatists, charters, uprisings, communes |
| `world.js` | seasons, disasters, inventions, golden ages and decline, legends |
| `acts.js` | the acts any ruler can take, each with its check |
| `engine.js` | `newAge`, the monthly pipeline, the end of an age, re-exports |
| `doctrine.js` | the rule-based brain: plans, acts, army orders, answers to decisions |

Monthly pipeline: inputs → plans/acts → economy → orders → march → battles → sieges → people → court → world → settle.

## Systems

- **Characters.** Each has an office, a temperament, traits, skill, loyalty, family ties and deeds.
  - Rulers: conqueror, builder, miser, negligent, paranoid, hedonist, reformer, diplomat, just, tyrant.
  - Generals: loyal, glory-hunter, treacherous, cautious, butcher, mercenary.
  - Consorts: devoted, schemer, regent.
  - Viziers: able, corrupt, kingmaker.
  - Temperaments change behaviour: war appetite, building, purges, neglect, betrayal, defection mid-battle.
  - Epithets are earned ("the Builder", "the Unready").
- **Families.**
  - Rulers marry, often across borders, which makes an alliance and kin.
  - Children are born, and heirs follow blood.
  - Regencies come with child kings; schemers push their own sons; a line dying out can pass a crown to kin.
- **Wars as stories.**
  - A conflict records its cause, sides, every battle, siege and capture, its deaths, the treaty and the gains.
  - Battles last 1–3 months, with reinforcements, withdrawals and turncoats.
  - Peace is a treaty with terms: cessions, tribute, truce.
- **Seasons.** Each province has a climate (cold, monsoon, arid, temperate).
  - Winter snow closes passes and thins herds.
  - The monsoon floods rivers and halts campaigns.
  - Summer heat wears armies in the desert.
  - Harvests come in their months, so granaries must last until the next one.
- **Life inside realms.**
  - Prosperity rises in peace and falls in war, plague and famine; it scales wealth.
  - The Silk Road pays only along its open stretches.
  - Works raise prosperity, grain, trade or learning.
  - Inventions spread across borders and by conquest.
  - Poverty breeds unrest. Golden ages and declines are proclaimed.
- **Unrest.** Provinces revolt; distant governors break away; barons force charters; capitals rise; rich cities
  become communes.
- **Agreements and the registry.**
  - Every change of hands is a deed: who, when, how. Treaties have terms, and the engine pays them like escrow.
  - Breaking a treaty is possible, but it is recorded and costs reputation, which other rulers read.
  - Claims go to arbitration by a neutral power, judged on the registry; the losing side accepts or defies.
- **Event cards.** Great events stop the 1× playback with a picture, what happened, a before/after infographic and
  the consequences.
- **Portraits.** Every character has a miniature portrait drawn by code (culture, age, rank, sex). Famous figures and
  event types get illustrations made once with Workers AI (`web/art/`).

## Server, AI, chain, players

- **One shared world** in a Durable Object (`Era`). An alarm ticks one month at a set pace. It stores yearly
  snapshots, monthly events and inputs, and streams months to viewers. The page replays history from snapshots and
  inputs, and the sandbox (dice) still runs a private age in the browser.
- **The AI cast.** Personas (ambition, secret, fear, voice) are written once per notable character by the small
  model. Turning-point decisions of AI-led characters are batched into one call per month. Doctrine decides whenever
  the AI is late, out of budget or wrong.
- **The chain.** `Chronicle.sol` on Base Sepolia. Once per game year, one transaction seals the state hash, the inputs
  hash, the year's deeds, its treaties, and the treaties broken. The game never waits for it.
- **Players.** A player claims a realm in a game. Orders are acts, and turns resolve at the deadline; an absent
  player's realm is played by its AI or by doctrine. n8n carries heralds (great events), turn reminders and daily
  digests.
- **Ages.** The Old World of 1200 filled with playable realms; the ancient world of 200 BC; the age of world wars
  from 1914. Each age is a pack on the same map. A pack gives:
  - the realms and their people (rulers, heirs, consorts, viziers, generals and their temperaments);
  - every province's owner, city, name, people and, if it differs from the map, its wealth and walls;
  - the wars and alliances already under way, the roads that carry trade, and what is already known;
  - its own words for some events ("orders a general mobilisation" in 1914, "calls a Great Levy" in 1200);
  - its tempo (`mods`: how soon wars end in peace, how often generals betray, how eager rulers are for war);
  - seats of government for empires (a viceroy in Delhi governs India, not London);
  - `setup` and `month` hooks for the forces of the age, which act only while history still allows them
    (Italy joins in 1915 only if it is free to, Russia's revolution needs Russia still at war).
- **Coalitions.** A side in a war is a realm with its allies, vassals and overlord. Allies make no separate peace
  while they fight on, unless the war is lost; an overlord defends its vassal; a vassal makes war only beside its
  overlord.

## Progress

- [x] 0. Old World map, resources, crossings, lineages, timeline, chronicler
- [x] 1. Engine split, acts, characters and temperaments, families, wars as stories, battles over months, seasons,
      war/army/character cards, event cards, portraits, art
- [x] 2. Prosperity, trade, works, inventions, unrest, golden ages, treaties, registry, disputes, legends
- [x] 3. Shared world on the server (Era DO), page as its window, classic war retired
- [x] 4. AI cast: personas and batched decisions
- [x] 5. Chronicle.sol: yearly seals of deeds and treaties
- [x] 6. Multiplayer games, delegation, n8n heralds and reminders
- [x] 7. Ages: full 1200 map, 200 BC, 1914 (all built by 2026-10-07)

Open: balance tuning across ages; painted portraits for the famous of 200 BC and 1914; region labels for ages other
than 1200; a fresh og image.
