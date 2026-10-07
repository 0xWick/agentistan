// Every number of the world lives here. Tune these (with tools/simulate.js), not the engine.
// Units: soldiers in thousands ("12" = 12,000 men), gold in a realm's monthly coin, time in months.
export const RULES = {
  start: { year: 1200, month: 0 }, // January 1200 (an age pack may start elsewhere)
  months: 672, // 56 years: an age ends in 1256, the year Alamut fell
  unite: { alone: 0.55, withVassals: 0.7 }, // a realm holding 55% of the provinces (70% counting its vassals) ends the age

  economy: {
    perWealth: 1, // gold a month per point of wealth, at full loyalty
    upkeep: 0.9, // gold a month per thousand soldiers
    recruitCost: 6, // gold per thousand soldiers raised
    manpower: 1.3, // thousand soldiers a realm can field per point of wealth it holds
    tribute: 0.25, // share of a vassal's income paid to its overlord
    trade: 2, // gold a month for a Silk Road city when the whole road is open (less as it is cut)
    startGold: 3, // months of income in the treasury at the start
    nomad: { riders: 9, recruit: 0.35, upkeep: 0.1, levy: 6, herds: 3, garrison: 4 }, // on the steppe every man is a rider, fed by his herds
  },

  // How well a province lives, 0–100. It scales its wealth from 0.6x (ruin) to 1.4x (a golden age).
  prosperity: { start: 50, drift: 0.05, peace: 6, capital: 6, perWork: 6, trade: 10, war: -6, siege: -30, enemyArmy: -14, ravaged: -30, plague: -18, famine: -18, tax: { low: 4, normal: 0, high: -8 }, conquered: -10, golden: 8, poorBelow: 30 },

  // Works a ruler can build: what they cost, how long they take, what they give.
  works: {
    canal: { cost: 55, months: 12, grain: 0.3, terrain: ['river', 'plains', 'desert'] },
    caravanserai: { cost: 35, months: 8, trade: 1, silk: true },
    market: { cost: 35, months: 6, gold: 0.15, wealth: 3 },
    library: { cost: 45, months: 10, learning: 1, wealth: 3 },
  },

  loyalty: {
    base: 58, capital: 22, perHop: -4, freeHops: 2, // the far edges of a realm are the restless ones
    conquered: -22, conqueredDecay: 0.95, // freshly taken lands stay hostile for a few years
    war: -4, enemyArmy: -14, ownArmy: 5, ravaged: -18, plague: -12, famine: -16, poor: -6,
    tax: { low: 7, normal: 0, high: -12 },
    drift: 0.12, // share of the gap to its target closed each month
    revoltBelow: 22, revoltChance: 0.004, // per month and per point below the threshold
  },

  // Resources besides gold. Grain feeds armies, horses make cavalry, iron arms new soldiers.
  supply: {
    grain: { river: 2.2, plains: 1.6, hills: 1, forest: 0.8, steppe: 0.5, desert: 0.3, mountains: 0.4 }, // a month on average, per point of wealth
    horses: { steppe: 3, plains: 0.5, desert: 0.6, hills: 0.3 }, // a month, flat per province
    iron: { mountains: 1.2, hills: 0.8, forest: 0.4 }, // a month, flat per province
    eat: 1.2, // grain a month per thousand soldiers
    spoil: 0.035, // share of stored grain that rots each month; horses die off at the same rate
    eatAbroad: 1.5, eatHard: 2, // on campaign in foreign land; in desert or mountains
    starve: 0.07, // share of a hungry army lost each month
    ironPerK: 1, // iron to arm a thousand new soldiers
    cavalry: 0.3, horsesPerK: 3, // battle power from a full complement of horses, and how many that takes
    price: { grain: 1.6, iron: 3 }, // gold per unit at the market
    start: 7, // months of output in the stores at the start
  },

  // The year turns differently in each land. Harvest: the share of a year's grain that comes in each month (Jan..Dec).
  seasons: {
    harvest: {
      temperate: [0.2, 0.2, 0.3, 0.4, 0.6, 1.6, 2.6, 2.6, 1.6, 0.9, 0.5, 0.5],
      cold: [0, 0, 0, 0.2, 0.5, 1.5, 3.2, 3.6, 2.2, 0.8, 0, 0],
      monsoon: [0.6, 0.8, 2.2, 2.2, 0.6, 0.2, 0.2, 0.2, 0.6, 2.0, 1.8, 0.6], // rabi in spring, kharif after the rains
      arid: [0.8, 1.2, 2.4, 2.4, 1.6, 0.8, 0.4, 0.4, 0.6, 0.6, 0.4, 0.4], // winter crops, river floods
    },
    snow: { months: [11, 0, 1], move: 1, cold: 0.02, herds: 0.06 }, // cold lands in winter: slow going, frostbite abroad, thin herds
    rains: { months: [5, 6, 7, 8], move: 1 }, // monsoon lands, June to September: floods, mud, no campaigns
    heat: { months: [5, 6, 7], loss: 0.025 }, // arid lands in summer: armies in the desert wilt
  },
  garrison: { base: 1, perWealth: 0.6 }, // thousand defenders in a province with no army
  walls: { defence: 0.4, baseMonths: 2, siegeMonths: 3, stormRatio: 3.2, stormLoss: 0.4 }, // 2 + walls x3 months of siege, or a costly storm; walls count squared

  move: { plains: 1, river: 1, steppe: 1, forest: 1, hills: 1, desert: 2, mountains: 2 }, // months to enter a province
  winter: [11, 0, 1], // December to February: the high passes close
  nomadSpeed: 2, // steppe riders cover two provinces a month in open country
  cross: { river: 1, pass: 2, sea: 2, winter: 4, desert: 3 }, // extra months: a great river, a mountain pass, a strait; passes in winter; a caravan road

  // Battles last until one side breaks: one month when the odds are lopsided, up to three when they are even.
  battle: {
    luck: 0.2, // each side's dice each month: up to ±20%
    skill: 0.12, // +12% power per point of general skill above 3
    terrain: { hills: 1.15, mountains: 1.4, forest: 1.1, river: 1.05 }, // defender's ground
    home: 1.1, // defending your own land
    bleed: 0.11, // share of a side lost in a month of even fighting
    crush: 2.3, // power ratio at which the weaker side breaks at once
    breaks: 0.8, // morale below which a side flees
    rounds: 3, // a battle's longest run, in months
    rout: 0.18, // extra share the loser loses in the flight
    generalDies: { loser: 0.08, winner: 0.02 },
    rest: { winner: 1, loser: 3 }, // months an army needs after a battle before it marches again
  },

  armies: { perProvinces: 7, min: 1, max: 4, startPerWealth: 0.55, minSize: 2 }, // armies below minSize disband
  campaign: { start: 0.15 }, // an idle army sets out on a campaign in a given month (never in winter or the rains)
  sustain: { war: 0.95, peace: 0.75 }, // recruit only while upkeep stays under this share of income

  life: { // chance of dying each month, by age band; "ailing" multiplies it
    bands: [[5, 0.003], [40, 0.0006], [50, 0.0012], [60, 0.0024], [70, 0.0045], [80, 0.009], [90, 0.025], [200, 0.06]],
    ailing: 4,
    heirEachYear: 0.25, // a ruler with neither heir nor child names one
  },
  family: { adult: 16, birth: 0.017, fertileUntil: 42, foreign: 0.55, marryEachYear: 0.22 },

  // What each temperament makes a character do. w: how common it is among the people the world invents.
  temper: {
    ruler: {
      conqueror: { w: 3, war: 2.4, recruit: 1.2, leads: true, campaign: 1.4 },
      builder: { w: 2, war: 0.6, build: 0.08 },
      miser: { w: 1.5, war: 0.7, recruit: 0.6, income: 1.05, build: 0.01 },
      negligent: { w: 1.5, war: 0.5, loyalty: -5, campaign: 0.4, build: 0 },
      paranoid: { w: 1, purge: 0.014, loyalty: -2 },
      hedonist: { w: 1, income: 0.85, loyalty: -2, war: 0.6, build: 0.01 },
      reformer: { w: 1, reform: 0.015, build: 0.03 },
      diplomat: { w: 2, war: 0.5, ally: 2.5 },
      just: { w: 2, loyalty: 6, build: 0.02 },
      tyrant: { w: 1, loyalty: -6, war: 1.4, tax: 'high', fear: 0.5 },
    },
    general: {
      loyal: { w: 3, betray: 0 },
      steady: { w: 3, betray: 0.6 },
      glory: { w: 2, betray: 1, storm: 1.6, attack: 1.3 },
      cautious: { w: 2, betray: 0.6, storm: 0.6, withdraw: true },
      treacherous: { w: 1, betray: 4, turncoat: 0.3 },
      butcher: { w: 1, betray: 1, ravage: true },
      mercenary: { w: 1, betray: 1.5, sells: true },
    },
    consort: { devoted: { w: 3 }, schemer: { w: 1.2, scheme: 0.01 }, regent: { w: 1.5 } },
    vizier: { able: { w: 3, income: 1.1 }, loyal: { w: 2 }, corrupt: { w: 1.5, income: 0.9 }, kingmaker: { w: 1, usurp: 0.006 } },
  },

  succession: { crisis: 0.22, perProvince: 0.006, weakHeir: 0.25, splitShare: 0.4 },
  betrayal: { chance: 0.004, coupShare: 0.4 }, // a disloyal, ambitious general each month; coup instead of defection
  rebels: { foundAfter: 12, minProvinces: 2 }, // rebels holding 2 provinces for a year found a kingdom
  unrest: { separatistHops: 5, separatist: 0.0007, charter: 0.006, uprising: 0.03, commune: 0.0012 },

  agents: {
    alamutEvery: 40, alamutStrike: 8, alamutDues: 3, // months between Alamut's own strikes; their cost; what fear brings in each month
    contractCost: 35, success: 0.35, exposed: 0.5, // a hired killing: price, odds, and the chance the employer is unmasked
    guildChance: 0.002, // per month and rich city: a guild of daggers forms
  },

  steppe: {
    raidEvery: 24, // months between Kipchak raids, on average
    mongols: { size: 80, generals: 4 }, // the armies the tribes give a Great Khan once he unites the steppe
  },

  disasters: { plague: 0.003, plagueMonths: 8, spread: { silk: 0.35, other: 0.1 }, earthquake: 0.003, famine: 0.004, flood: 0.01 },

  // Learning: each realm gathers it from its prosperous, lettered cities; inventions spread to neighbours and by conquest.
  learning: { perProsperity: 0.0006, library: 0.12, spread: 0.0012, conquest: 0.3 },
  // A realm's fortune is reckoned each January; a run of good years is a golden age.
  fortune: { golden: 70, decline: 34, years: 4, goldenYears: 10 },

  power: ['levy', 'walls', 'bribe', 'feast', 'silktax'], // one power move per reign

  diplomacy: {
    warRatio: 1.25, // declare war on a neighbour this much weaker
    peaceAfter: 30, // months of fruitless war before suing for peace
    truce: 24,
    balance: 0.3, // a realm holding 30% of the map makes its neighbours ally against it
    tribute: { share: 0.12, months: 60 }, // a beaten realm pays this share of its income for five years
  },
  reputation: { start: 60, broken: 22, defied: 18, kept: 2 }, // a realm's word: lost by breaking treaties and defying verdicts
  dispute: { years: 10, chance: 0.005 }, // a province held this long gives its old owner a claim; chance each month a claimant goes to arbitration
};
