// Worker entry. Pages come straight from web/ as static assets (the Worker isn't even invoked for them);
// everything else (/api/*, /internal/*) goes to the one World Durable Object.
export { World } from './world.js';

const world = (env) => env.WORLD.get(env.WORLD.idFromName('world'));

export default {
  fetch: (req, env) => world(env).fetch(req),
  scheduled: (_event, env, ctx) => ctx.waitUntil(world(env).tick()), // every 10 min: wake-up call and fallbacks
};
