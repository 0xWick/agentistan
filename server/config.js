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
  // Real markets from Chainlink. Each treasury is held in a coin; LINK prices the soldiers both sides hire.
  // Deliberately heavy, so an ordinary hour in crypto shows up in the war.
  market: {
    coin: { red: 'ETH', blue: 'BTC' },
    dividend: 100, // every turn: gold gained (or lost) per 1% the coin moved since that kingdom's last turn
    mood: { per1pct: 0.2, max: 0.4 }, // the coin's trend this season: +1% = +20% battle power, capped at ±40%
    mercs: { per1pct: 0.3, min: 0.5, max: 2.5 }, // LINK this season: +1% = soldiers cost 30% more, for both sides
  },
  // Real weather, region by region (Open-Meteo, synced by n8n). Every kind does something you can see.
  weather: {
    clear: { forage: 4 }, // fair weather: an army there forages 4 food a turn
    rain: { moveCost: 1 }, // mud: every step into the region costs one more
    snow: { moveCost: 1, eat: 2 }, // drifts slow armies, and they eat twice as much
    storm: { moveCost: 1, attack: 0.7 }, // attacking into a storm: -30% power
    wind: { attack: 0.8 }, // gales: attacks into the region -20%
    fog: { vision: 1 }, // an enemy in fog is seen only from one tile away
    heat: { eat: 2 },
    cold: { eat: 1.5 },
  },
  win: { strongholds: 5, rounds: 3 },
  fogRange: 3,
};

// Five regions: the four corners and the Crownlands in the middle. Each season every region is dealt one real city at random,
// one from each climate, so the map always mixes hot, cold, wet, tropical and changeable skies.
export const REGIONS = [
  { id: 'nw', name: 'Ember Highlands' },
  { id: 'ne', name: 'Northern Marches' },
  { id: 'mid', name: 'Crownlands' },
  { id: 'sw', name: 'Southern Fens' },
  { id: 'se', name: 'Frost Vale' },
];
export const regionAt = (x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 ? 'mid' : y < 5 ? (x < 5 ? 'nw' : 'ne') : x < 5 ? 'sw' : 'se');
const city = (name, lat, lon) => ({ name, lat, lon });
export const CLIMATES = {
  hot: [city('Lahore, Pakistan', 31.55, 74.34), city('Dubai, UAE', 25.2, 55.27), city('Cairo, Egypt', 30.04, 31.24), city('Phoenix, USA', 33.45, -112.07), city('Riyadh, Saudi Arabia', 24.71, 46.68), city('Karachi, Pakistan', 24.86, 67.0)],
  cold: [city('Reykjavík, Iceland', 64.15, -21.94), city('Anchorage, USA', 61.22, -149.9), city('Yakutsk, Russia', 62.03, 129.73), city('Oslo, Norway', 59.91, 10.75), city('Moscow, Russia', 55.76, 37.62), city('Ulaanbaatar, Mongolia', 47.89, 106.91)],
  wet: [city('Bergen, Norway', 60.39, 5.32), city('London, UK', 51.51, -0.13), city('Seattle, USA', 47.61, -122.33), city('Dublin, Ireland', 53.35, -6.26), city('Vancouver, Canada', 49.28, -123.12)],
  tropical: [city('Mumbai, India', 19.08, 72.88), city('Singapore', 1.35, 103.82), city('Manila, Philippines', 14.6, 120.98), city('Kolkata, India', 22.57, 88.36), city('Jakarta, Indonesia', -6.21, 106.85), city('Bangkok, Thailand', 13.76, 100.5)],
  changeable: [city('New York, USA', 40.71, -74.01), city('Chicago, USA', 41.88, -87.63), city('Tokyo, Japan', 35.68, 139.69), city('Toronto, Canada', 43.65, -79.38), city('Wellington, New Zealand', -41.29, 174.78), city('Cape Town, South Africa', -33.92, 18.42)],
};
export const cityNamed = (name) => Object.values(CLIMATES).flat().find((c) => c.name === name);

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
