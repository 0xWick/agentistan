// Every campaign, in the order of history, joined to its map's graph. Written by tools/campaign/seeds.mjs.
import { prepare } from './engine.js';
import persian from './c/persian.js';
import persian_map from './maps/persian.graph.json' with { type: 'json' };
import alexander from './c/alexander.js';
import alexander_map from './maps/alexander.graph.json' with { type: 'json' };
import hannibal from './c/hannibal.js';
import hannibal_map from './maps/hannibal.graph.json' with { type: 'json' };

export const CAMPAIGNS = [prepare(persian, persian_map), prepare(alexander, alexander_map), prepare(hannibal, hannibal_map)];
export const CAMPAIGN = Object.fromEntries(CAMPAIGNS.map((C) => [C.id, C]));
