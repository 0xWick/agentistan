// Worker entry. Pages come straight from web/ as static assets (the Worker isn't even invoked for them);
// everything else (/api/*, /internal/*) goes to the one World Durable Object, except /internal/art, which paints.
export { World } from './world.js';

const world = (env) => env.WORLD.get(env.WORLD.idFromName('world'));

// The secret header, compared in constant time.
function authorized(req, env) {
  const enc = new TextEncoder(), got = enc.encode(req.headers.get('x-realm-secret') ?? ''), want = enc.encode(env.REALM_SECRET ?? '');
  return want.length > 0 && got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
}

// One picture from Workers AI (free: about 230 a day), for tools/art.js to save into web/art/. Never public.
async function art(req, env) {
  if (req.method !== 'POST' || !authorized(req, env)) return new Response('forbidden', { status: 403 });
  if (!env.AI) return Response.json({ error: 'no AI binding' }, { status: 503 });
  const { prompt, steps = 6 } = await req.json().catch(() => ({}));
  if (typeof prompt !== 'string' || prompt.length < 10 || prompt.length > 2000) return Response.json({ error: 'a prompt, please' }, { status: 400 });
  const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: Math.min(8, Math.max(1, steps | 0)) });
  return Response.json({ image: out.image });
}

export default {
  fetch: (req, env) => (new URL(req.url).pathname === '/internal/art' ? art(req, env) : world(env).fetch(req)),
  scheduled: (_event, env, ctx) => ctx.waitUntil(world(env).tick()), // every 10 min: wake-up call and fallbacks
};
