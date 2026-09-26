// Every game number lives here (spec §4). Tune these, not the engine.
export const CFG = {
  size: 10,
  maxRounds: 40,
  moveBudget: 2,
  army: { start: 100, max: 200, morale: 1.0, moraleStep: 0.1, moraleMin: 0.7, moraleMax: 1.3, routBelow: 10, respawnStrength: 30, respawnTurns: 2 },
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
  recruitCost: 2, // gold per strength point
  gold: { start: 50, base: 5, perFort: 3, tilesPer: 5, blueFlat: 1 },
  food: { start: 60, cap: 100, base: 4, perFort: 2, perStrength: 10, lowPct: 0.2, reorderTo: 0.6 },
  starveLoss: 0.1,
  starveSupply: 0.7,
  garrison: { neutral: 25, captured: 15, regen: 2, max: 30, capital: 40 },
  combat: { roll: 0.2, loserLoss: 0.3 },
  market: { amplify: 10, min: 0.5, max: 1.5 }, // shown in the UI as "game effect amplified 10x"
  win: { strongholds: 5, rounds: 3 },
  fogRange: 3,
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
  blue: { realm: 'Frostmere', general: 'Marshal Ilsa', treasury: 'gold' },
};

// demo: armies start 2 tiles from the Crown Fort with low food, so a capture and the
// n8n food alert both happen in the first minute.
export const SCENARIOS = {
  standard: { red: [1, 1], blue: [8, 8] },
  demo: { red: [3, 4], blue: [5, 6], food: 30, rounds: 20 },
};
