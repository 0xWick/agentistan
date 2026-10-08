// Worker entry. Pages come straight from web/ as static assets (the Worker isn't even invoked for them).
// /api/era* is the living world (the Era Durable Object); /api/run* the campaigns (Campaigns); /internal/art paints;
// the rest is the classic war (World).
export { World } from './world.js';
export { Era } from './era.js';
export { Campaigns } from './campaigns.js';

const world = (env) => env.WORLD.get(env.WORLD.idFromName('world'));
const era = (env, name = 'main') => env.ERA.get(env.ERA.idFromName(name));
const campaigns = (env) => env.CAMPAIGNS.get(env.CAMPAIGNS.idFromName('campaigns'));
const CAMPAIGN_NFT = 1_000_000; // token ids from here up are campaign scrolls

// The secret header, compared in constant time.
function authorized(req, env) {
  const enc = new TextEncoder(), got = enc.encode(req.headers.get('x-realm-secret') ?? ''), want = enc.encode(env.REALM_SECRET ?? '');
  return want.length > 0 && got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
}

// One picture from Workers AI (free: about 230 a day), for tools/art.mjs to save into web/art/. Never public.
async function art(req, env) {
  if (req.method !== 'POST' || !authorized(req, env)) return new Response('forbidden', { status: 403 });
  if (!env.AI) return Response.json({ error: 'no AI binding' }, { status: 503 });
  const { prompt, steps = 6 } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 2000) return Response.json({ error: 'a prompt, please' }, { status: 400 });
  try {
    const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: Math.min(8, Math.max(1, steps | 0)) });
    return Response.json({ image: out.image });
  } catch (err) {
    return Response.json({ error: String(err?.message ?? err).slice(0, 300) }, { status: 502 }); // e.g. the free neurons are spent for the day
  }
}

// Two games, two names: nobodysplaying.umarkhatana.com is the classic two-kingdom war (Nobody's Playing), and
// agentistan.umarkhatana.com the living world and its campaigns. They share this Worker; only the front page differs.
const CLASSIC_HOST = /^nobodysplaying\./;

export default {
  fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if ((p === '/' || p === '/index.html') && env.ASSETS) {
      const page = CLASSIC_HOST.test(url.hostname) ? '/classic/' : '/';
      return env.ASSETS.fetch(new Request(new URL(page, url), req));
    }
    if (p === '/internal/art') return art(req, env);
    if (p === '/api/run' || p.startsWith('/api/run/') || p === '/api/runs' || p.startsWith('/internal/campaign/')) return campaigns(env).fetch(req);
    if (p.startsWith('/nft/') && +p.slice(5).replace(/\.(svg|json)$/, '') >= CAMPAIGN_NFT) return campaigns(env).fetch(req);
    const game = p.match(/^\/api\/game\/([\w-]{3,40})\/era/)?.[1];
    if (game) { // a game's own world; it must have been started from the lobby
      const r = new Request(req);
      r.headers.set('x-era-game', game);
      return era(env, `game:${game}`).fetch(r);
    }
    if (p === '/api/era' || p.startsWith('/api/era/') || p.startsWith('/internal/era/') || p === '/api/games' || p.startsWith('/nft/')) return era(env).fetch(req);
    return world(env).fetch(req);
  },
  scheduled: (_event, env, ctx) => ctx.waitUntil(Promise.all([
    world(env).tick(), // every 10 min: wake-up call and fallbacks for the classic war
    era(env).fetch('https://era/internal/era/watch').catch((err) => console.error('era watch failed:', err)),
  ])),
};
