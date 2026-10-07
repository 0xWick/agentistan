# Agentistan: the Silk Road world (design)

Agentistan is becoming a medieval world on a real map that writes its own history. It's the Silk Road in 1200 AD. AI plays the rulers, viziers, generals and assassins; kingdoms rise, split and fall on their own, and visitors watch it like a war-history video. The game comes first and the tech second. The two-kingdom war keeps running at `/classic/` until the new world replaces it.

Decided with Umar on 2026-10-07. We change it as we go.

## The world

- **Map:** from Baghdad and Georgia to Bengal, and from the Aral steppe to Gujarat (39.5–90.5°E, 18.5–47.5°N). It's built from Natural Earth (public domain) by `tools/map/build.py`. The relief is cropped, graded warm and earthy, and given deep seas. The Aral Sea is restored to its extent before the 20th century.
- **Provinces:** about 70, with their names of the time (Khorasan, Transoxiana, Ghor, Punjab, Sindh, Jibal, Fars, the Doab…). Their borders come from real administrative borders, so they follow rivers and ridges.
  - Each has a city, terrain, walls (0–3), wealth and a Silk Road flag.
  - Famous fortresses start with the strongest walls: Alamut, Ranthambore, Kalinjar, Bamiyan.
- **Realms in 1200:** the real powers and their real rulers. When those rulers die, the AI invents their successors.
  - With AI rulers: Khwarazm, the Ghurids, Qara Khitai, the Karakhanids, the Abbasids, the Eldiguzids, Georgia and Alamut.
  - Rule-based: the Salghurids, Zengids, Shirvanshahs, Soomras, Kashmir, Chaulukyas, Paramaras, Chandelas, Chahamanas, Sena and the Kipchaks.
- **No religion** in any rule or AI line.

## The rules (few, and each one visible on the map)

- **Gold** is the only resource. Provinces pay it, scaled by their loyalty. It pays for armies, walls, bribes and assassins. A realm with no gold loses soldiers to desertion.
- **Loyalty** is the mood of each province's people. Conquest, war, distance from the capital and disasters lower it; peace and garrisons raise it. Low loyalty shows a 🔥 and can turn into a revolt.
- **Armies** are led by named generals with a skill and a trait.
  - They move one province a month; mountains, deserts and big rivers take two. Mountain passes close in winter.
  - Every army costs upkeep.
- **Battles:** soldiers × general skill × terrain × morale × provable dice (seeded, like the classic war). Generals can die.
- **Sieges:** walls make a siege last walls × 2 months, unless the attacker storms them at a heavy cost.
- **Diplomacy:** war, peace, alliance or vassal. Vassals pay tribute.
- **Power moves:** one per reign, at a moment the ruler chooses: Great Levy, Mighty Walls, Bribe a Governor, Royal Feast or Silk Tax.

## How it grows on its own

- **Revolts:** rebels who hold 2 provinces for a year found a new kingdom, and the AI names it.
- **Succession:** a ruler dies (old age, battle or an assassin). A weak heir may face a pretender who splits the realm.
- **Assassins:** Alamut's agents, plus guilds that form at random in rich cities. Rulers hire them.
- **Betrayal:** an ambitious, disloyal general can defect with his army or seize the throne.
- **The steppe:** frequent Kipchak raids, and the Mongol horde from the east at a random time (most likely 1215–1225).
- **Disasters:** plague along the trade roads, famine, earthquakes.
- **History check:** the world knows the real timeline from 1200 to 1256 and says where this age diverges from it.

## Time and the AI

- **Timing:** 1 turn = 1 month, every 15 minutes. An age lasts about a week (1200–1256) and ends early if one realm rules 60% of the map. Every age restarts in 1200; past ages stay replayable.
- **No AI required:** every decision has a rule-based default, so the world runs with no AI at all.
  - Rulers set a plan every few turns with the big model.
  - Cheaper models voice the viziers, generals and rebels, and write the chronicle.
  - Groq's free tier gives each of gpt-oss-120b, gpt-oss-20b and qwen3.8-27b its own daily allowance.
- **Recording:** each month is saved as a small frame, so the page can replay "while you were away".

## Parts

1. **The world:** the map, the engine, the emergent events, and a balance simulator. Targets: 2–5 new kingdoms per age, realms that rise and fall, and no runaway empire before about 1230.
2. **The cast:** the AI roles and the token budget.
3. **The new page:** map first, a timelapse, Pick a side and a simple plan popup. The classic war is retired then (its replays stay).
4. **The tech re-fit:** the chronicle on-chain, real weather for the real cities, n8n as heralds, and the How-it's-built page.
