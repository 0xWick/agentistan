// Every number of the Silk Road world lives here. Tune these (with tools/simulate.js), not the engine.
// Units: soldiers in thousands ("12" = 12,000 men), gold in a realm's monthly coin, time in months.
export const RULES = {
  start: { year: 1200, month: 0 }, // January 1200
  months: 672, // 56 years: an age ends in 1256, the year Alamut fell
  unite: { alone: 0.55, withVassals: 0.7 }, // a realm holding 55% of the provinces (70% counting its vassals) ends the age

  economy: {
    perWealth: 1, // gold a month per point of wealth, at full loyalty
    upkeep: 0.9, // gold a month per thousand soldiers
    recruitCost: 6, // gold per thousand soldiers raised
    manpower: 1.3, // thousand soldiers a realm can field per point of wealth it holds
    tribute: 0.25, // share of a vassal's income paid to its overlord
    silkBonus: 1, // extra gold a month from each Silk Road city held
    startGold: 3, // months of income in the treasury at the start
  },

  loyalty: {
    base: 58, capital: 22, perHop: -4, freeHops: 2, // the far edges of a realm are the restless ones
    conquered: -22, conqueredDecay: 0.95, // freshly taken lands stay hostile for a few years
    war: -4, enemyArmy: -14, ownArmy: 5, ravaged: -18, plague: -12, famine: -16,
    tax: { low: 7, normal: 0, high: -12 },
    drift: 0.12, // share of the gap to its target closed each month
    revoltBelow: 22, revoltChance: 0.004, // per month and per point below the threshold
  },

  garrison: { base: 1, perWealth: 0.6 }, // thousand defenders in a province with no army
  walls: { defence: 0.45, siegeMonths: 3, stormRatio: 2.6, stormLoss: 0.35 }, // walls x3 months of siege, or a costly storm

  move: { plains: 1, river: 1, steppe: 1, forest: 1, hills: 1, desert: 2, mountains: 2 }, // months to enter a province
  winter: [11, 0, 1], // December to February: the high passes close
  nomadSpeed: 2, // steppe riders cover two provinces a month in open country

  battle: {
    luck: 0.25, // each side's dice: up to ±25%
    skill: 0.12, // +12% power per point of general skill above 3
    terrain: { hills: 1.15, mountains: 1.4, forest: 1.1, river: 1.05 }, // defender's ground
    home: 1.1, // defending your own land
    loserLoss: [0.3, 0.45], winnerLoss: [0.06, 0.16],
    generalDies: { loser: 0.08, winner: 0.02 },
    rest: { winner: 1, loser: 3 }, // months an army needs after a battle before it marches again
  },

  armies: { perProvinces: 7, min: 1, max: 4, startPerWealth: 0.55, minSize: 2 }, // armies below minSize disband
  campaign: { start: 0.3 }, // an idle army sets out on a campaign in a given month (never in winter, unless it rides the steppe)
  sustain: { war: 0.95, peace: 0.75 }, // recruit only while upkeep stays under this share of income

  life: { // chance of dying each month, by age band; "ailing" multiplies it
    bands: [[40, 0.0006], [50, 0.0012], [60, 0.0024], [70, 0.0045], [80, 0.009], [200, 0.02]],
    ailing: 4,
    heirEachYear: 0.25, // a ruler without an heir names one
  },

  succession: { crisis: 0.22, perProvince: 0.006, weakHeir: 0.25, splitShare: 0.4 },
  betrayal: { chance: 0.004, coupShare: 0.4 }, // a disloyal, ambitious general each month; coup instead of defection
  rebels: { foundAfter: 12, minProvinces: 2 }, // rebels holding 2 provinces for a year found a kingdom

  agents: {
    alamutEvery: 30, alamutStrike: 8, alamutDues: 3, // months between Alamut's own strikes; their cost; what fear brings in each month
    contractCost: 35, success: 0.35, exposed: 0.5, // a hired killing: price, odds, and the chance the employer is unmasked
    guildChance: 0.002, // per month and rich city: a guild of daggers forms
  },

  steppe: {
    raidEvery: 24, // months between Kipchak raids, on average
    mongols: { chance: 0.85, year: 1219, spread: 3, size: 100, generals: 4 }, // most ages, the horde comes around 1219
  },

  disasters: { plague: 0.003, plagueMonths: 8, spread: { silk: 0.35, other: 0.1 }, earthquake: 0.003, famine: 0.004 },

  power: ['levy', 'walls', 'bribe', 'feast', 'silktax'], // one power move per reign

  diplomacy: {
    warRatio: 1.25, // declare war on a neighbour this much weaker
    peaceAfter: 30, // months of fruitless war before suing for peace
    truce: 24,
    balance: 0.3, // a realm holding 30% of the map makes its neighbours ally against it
  },
};
