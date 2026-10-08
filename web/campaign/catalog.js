// Every campaign, in the order of history, joined to its map's graph. Written by tools/campaign/seeds.mjs.
import { prepare } from './engine.js';
import persian from './c/persian.js';
import persian_map from './maps/persian.graph.json' with { type: 'json' };
import sparta from './c/sparta.js';
import sparta_map from './maps/sparta.graph.json' with { type: 'json' };
import alexander from './c/alexander.js';
import alexander_map from './maps/alexander.graph.json' with { type: 'json' };
import hannibal from './c/hannibal.js';
import hannibal_map from './maps/hannibal.graph.json' with { type: 'json' };
import maccabees from './c/maccabees.js';
import maccabees_map from './maps/maccabees.graph.json' with { type: 'json' };
import caesar from './c/caesar.js';
import caesar_map from './maps/caesar.graph.json' with { type: 'json' };
import threekingdoms from './c/threekingdoms.js';
import threekingdoms_map from './maps/threekingdoms.graph.json' with { type: 'json' };

export const CAMPAIGNS = [prepare(persian, persian_map), prepare(sparta, sparta_map), prepare(alexander, alexander_map), prepare(hannibal, hannibal_map), prepare(maccabees, maccabees_map), prepare(caesar, caesar_map), prepare(threekingdoms, threekingdoms_map)];
export const CAMPAIGN = Object.fromEntries(CAMPAIGNS.map((C) => [C.id, C]));
