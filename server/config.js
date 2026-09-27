// Every game number lives here (spec §4). Tune these, not the engine.
export const CFG = {
  size: 10,
  maxRounds: 40,
  moveBudget: 2,
  army: { start: 100, max: 200, morale: 1.0, moraleStep: 0.1, moraleMin: 0.7, moraleMax: 1.3, routBelow: 10, respawnStrength: 60, respawnTurns: 2 },
  terrain: {
    plains: { cost: 1, def: 1.0 },
    forest: { cost: 1, def: 1.2 },
    mountain: { cost: 2, def: 1.5 },
    river: { cost: 2, def: 1.0 },
    fort: { cost: 1, def: 1.3 },
    capital: { cost: 1, def: 1.3 },
  },
  riverAttackMod: 0.8,
  fortifyMod: 1.25,
  fortifyHeal: 5,
  homeDefence: 1.15, // an army defending on its own land: a way back for the side that's losing
  recruitCost: 2, // gold per strength point, before the LINK mercenary price. Recruit anywhere on your own land.
  gold: { start: 50, base: 5, perFort: 4, tilesPer: 5 },
  food: { start: 60, cap: 100, base: 4, perFort: 2, perStrength: 10, lowPct: 0.2, reorderTo: 0.6 },
  starveLoss: 0.1,
  starveSupply: 0.7,
  garrison: { neutral: 15, captured: 15, regen: 2, max: 30, capital: 40 },
  combat: { roll: 0.2, loserLoss: 0.3 },
  // Real markets from Chainlink, measured as % change since the season began. Each treasury is a coin;
  // LINK prices the mercenaries both sides hire. Deliberately heavy so ordinary crypto days show up in the war.
  market: {
    coin: { red: 'ETH', blue: 'BTC' },
    income: { per1pct: 0.4, min: 0.2, max: 3 }, // coin +1% = +40% gold income
    mood: { per1pct: 0.1, max: 0.25 }, // coin +1% = +10% battle power, capped at ±25%
    mercs: { per1pct: 0.2, min: 0.5, max: 2 }, // LINK +1% = soldiers cost 20% more, for both sides
  },
  // Real weather over the season's battlefield (Open-Meteo, synced by n8n). Hits both sides.
  weather: {
    clear: {},
    rain: { moveBudget: 1 }, // mud: one step per turn, rivers and mountains impassable
    storm: { attack: 0.7 }, // attacking into a storm: -30% power
    snow: { eat: 2 }, // cold: armies eat twice as much
    heat: { eat: 1.5 },
    fog: { vision: 1 }, // scouts see one tile
  },
  win: { strongholds: 5, rounds: 3 },
  fogRange: 3,
};

// Each season is fought under a real city's sky, in turn.
export const PLACES = [
  { name: 'Bergen, Norway', lat: 60.39, lon: 5.32 },
  { name: 'Lahore, Pakistan', lat: 31.55, lon: 74.34 },
  { name: 'Reykjavík, Iceland', lat: 64.15, lon: -21.94 },
  { name: 'Mumbai, India', lat: 19.08, lon: 72.88 },
  { name: 'London, UK', lat: 51.51, lon: -0.13 },
  { name: 'Chicago, USA', lat: 41.88, lon: -87.63 },
  { name: 'Cairo, Egypt', lat: 30.04, lon: 31.24 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
];

// Chainlink data feeds on Base Sepolia (checked on-chain: description() and fresh rounds).
export const FEEDS = {
  ETH: '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1',
  BTC: '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
  LINK: '0xb113F5A928BCfF189C998ab20d753a47F9dE5A61',
};

// Symmetric across the anti-diagonal: (x,y) mirrors (9-y, 9-x). The river runs along x+y=9;
// the three frontier forts sit on it and are its bridges.
// . plains  f forest  m mountain  ~ river  F fort  C capital      (row = y, column = x)
export const MAP = [
  '...f.....~',
  '.C..m...~.',
  '...F.ffF..',
  'f...m.~f..',
  '.mf..~.f..',
  '....F.m.m.',
  '..f~...F.f',
  '..Ff.f....',
  '.~...m..C.',
  '~.....f...',
];

export const STRONGHOLDS = [
  { id: 0, name: 'Emberreach Keep', x: 1, y: 1, capital: 'red' },
  { id: 1, name: 'Cinder Fort', x: 3, y: 2, home: 'red' },
  { id: 2, name: 'Ashford Bridge', x: 7, y: 2 },
  { id: 3, name: 'Crown Fort', x: 4, y: 5 },
  { id: 4, name: 'Mistbridge', x: 2, y: 7 },
  { id: 5, name: 'Rime Fort', x: 7, y: 6, home: 'blue' },
  { id: 6, name: 'Frostmere Hold', x: 8, y: 8, capital: 'blue' },
];

export const CAST = {
  red: { realm: 'Emberreach', general: 'General Vex', treasury: 'ETH' },
  blue: { realm: 'Frostmere', general: 'Marshal Ilsa', treasury: 'BTC' },
};

// demo: armies start 2 tiles from the Crown Fort with low food, so a capture and the
// n8n food alert both happen in the first minute.
export const SCENARIOS = {
  standard: { red: [1, 1], blue: [8, 8] },
  demo: { red: [3, 4], blue: [5, 6], food: 30, rounds: 20 },
};
