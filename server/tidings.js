// Tidings: anyone may follow what interests them in the living world (the Mongols, plots and coups, romances,
// history taking another road, one realm) and have it sent where they like: a Discord or Slack channel by its webhook,
// or their phone through ntfy.sh. Every event is tagged as it happens; after each month, each follower's matching
// events go to n8n (the Tidings workflow), which makes them a card for that channel and delivers it.
import MANIFEST from '../web/art/manifest.json' with { type: 'json' };
import { yearOf } from '../web/silk/engine.js';

export const TOPICS = {
  battles: 'Battles, sieges and conquests',
  diplomacy: 'Wars, peace and alliances',
  plots: 'Plots, coups and betrayals',
  romance: 'Marriages, births and scandals',
  steppe: 'The steppe and the Mongols',
  disasters: 'Plague, famine and disaster',
  rise: 'Kingdoms rising and falling',
  golden: 'Golden ages, great works and discoveries',
  anomaly: 'History taking another road',
};
const KIND = {
  battle: 'battles', clash: 'battles', fighting: 'battles', storm: 'battles', capture: 'battles', siege: 'battles',
  war: 'diplomacy', peace: 'diplomacy', alliance: 'diplomacy', vassal: 'diplomacy', ceded: 'diplomacy', broken: 'diplomacy',
  plot: 'plots', coup: 'plots', turncoat: 'plots', intrigue: 'plots', guild: 'plots',
  marriage: 'romance', birth: 'romance', affair: 'romance', 'match.refused': 'romance',
  horde: 'steppe', raid: 'steppe',
  plague: 'disasters', famine: 'disasters', hunger: 'disasters', earthquake: 'disasters', flood: 'disasters', slump: 'disasters',
  founded: 'rise', split: 'rise', fallen: 'rise', revolt: 'rise', uprising: 'rise', separatist: 'rise', commune: 'rise', 'age.ended': 'rise',
  golden: 'golden', built: 'golden', invention: 'golden', reform: 'golden', charter: 'golden',
};
// When the great figures of 1200 really died: a death well before it is history taking another road.
const DIED = {
  temujin: 1227, 'genghis-khan': 1227, tamar: 1213, 'muhammad-ii': 1220, 'jalal-al-din': 1231, 'al-adil': 1218, kaloyan: 1207, 'enrico-dandolo': 1205,
  'theodore-laskaris': 1221, 'mu-izz-al-din-muhammad': 1206, 'ghiyath-al-din-muhammad': 1203, 'qutb-al-din-aibak': 1210, toghrul: 1203, kuchlug: 1218,
  zhangzong: 1208, ningzong: 1224, 'han-tuozhou': 1207, aimery: 1205, emeric: 1204, borte: 1230, 'terken-khatun': 1233, jebe: 1223, subutai: 1248,
  'lakshmana-sena': 1206, 'bakhtiyar-khalji': 1206, 'muhammad-an-nasir': 1213, 'az-zahir-ghazi': 1216, frederick: 1250, 'yang-meizi': 1233,
};
const ART = { battle: 'battle', clash: 'battle', fighting: 'battle', storm: 'siege', siege: 'siege', capture: 'fallen', fallen: 'fallen', revolt: 'uprising', uprising: 'uprising', founded: 'split', split: 'split', crowned: 'crowned', coup: 'crowned', plot: 'assassin', intrigue: 'assassin', turncoat: 'turncoat', horde: 'horde', raid: 'raid', plague: 'plague', famine: 'famine', earthquake: 'earthquake', flood: 'flood', golden: 'golden', built: 'built', invention: 'invention', peace: 'peace', war: 'war', alliance: 'court', marriage: 'court', charter: 'charter', commune: 'commune', decline: 'decline' };
const STEPPE = /mongol|kerait|naiman|tatar|merkit|khamag|kipchak|cuman|qara khitai/i;
export const slug = (n) => String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The tags of one event: its kind, its realms and famous people, the steppe, and history's other roads.
export function tagsOf(e, s) {
  const t = new Set(), chars = (e.chars ?? []).map((id) => s.chars?.[id]).filter(Boolean), realms = e.realms ?? [];
  if (KIND[e.type]) t.add(KIND[e.type]);
  for (const r of realms) t.add(`realm:${r}`);
  for (const c of chars) if (c.famous) t.add(`person:${slug(c.name)}`);
  if (realms.some((r) => s.realms?.[r]?.nomad || STEPPE.test(s.realms?.[r]?.name ?? '')) || chars.some((c) => /temujin|genghis/i.test(c.name))) t.add('steppe');
  const famousDeath = chars.find((c) => c.famous && !c.alive && DIED[slug(c.name)] && yearOf(c.died ?? s.month, s) <= DIED[slug(c.name)] - 3);
  if ((e.type === 'death' || e.type === 'fallen' || e.type === 'coup') && famousDeath) t.add('anomaly');
  if (e.type === 'coup' && chars.some((c) => c.famous)) t.add('anomaly');
  if (e.type === 'founded' || e.type === 'split') t.add('anomaly'); // a kingdom history never knew
  if (e.type === 'affair') t.add('plots');
  return [...t];
}

export function setupTidings(era) {
  era.sql.exec('CREATE TABLE IF NOT EXISTS followers (id TEXT PRIMARY KEY, key TEXT, channel TEXT, target TEXT, tags TEXT, created INTEGER, day TEXT, sent INTEGER DEFAULT 0, ip TEXT)');
}
const CHANNELS = {
  discord: (x) => /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(x),
  slack: (x) => /^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/.test(x),
  ntfy: (x) => /^[A-Za-z0-9_-]{8,64}$/.test(x), // a topic on ntfy.sh, as long as a password
};
const site = (env) => env.PUBLIC_URL || 'https://agentistan.umarkhatana.com';
const post = (env, item) => {
  const n8n = (env.N8N_URL || '').replace(/\/$/, '');
  if (!n8n) return Promise.resolve();
  return fetch(`${n8n}/webhook/tidings`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-realm-secret': env.REALM_SECRET ?? '' }, body: JSON.stringify(item), signal: AbortSignal.timeout(8000) }).catch(() => null);
};
const labels = (tags, s) => tags.map((t) => TOPICS[t] ?? (t.startsWith('realm:') ? s?.realms?.[t.slice(6)]?.name ?? t.slice(6) : null)).filter(Boolean);

// POST /api/era/follow { channel, target, tags } · POST /api/era/unfollow { id, key } · GET /api/era/topics
export async function tidingsRoute(era, req, p, ip) {
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (p === '/api/era/topics') return json(200, { topics: TOPICS, realms: Object.values(era.state()?.realms ?? {}).filter((r) => r.alive !== false).map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)) });
  if (req.method !== 'POST') return json(405, { error: 'POST, please' });
  const body = await req.json().catch(() => ({}));
  if (p === '/api/era/unfollow') {
    const row = era.sql.exec('SELECT key FROM followers WHERE id = ?', String(body.id ?? '')).toArray()[0];
    if (!row || row.key !== String(body.key ?? '')) return json(404, { error: 'no such follower' });
    era.sql.exec('DELETE FROM followers WHERE id = ?', String(body.id));
    return json(200, { ok: true });
  }
  const channel = String(body.channel ?? ''), target = String(body.target ?? '').trim();
  if (!CHANNELS[channel]?.(target)) return json(400, { error: channel === 'ntfy' ? 'A topic name of 8 to 64 letters, digits, - or _' : 'That does not look like a webhook URL for this channel' });
  const tags = [...new Set((Array.isArray(body.tags) ? body.tags : []).map(String).filter((t) => TOPICS[t] || /^realm:[\w-]{2,40}$/.test(t)))].slice(0, 20);
  if (!tags.length) return json(400, { error: 'Choose at least one thing to follow' });
  const today = new Date().toISOString().slice(0, 10);
  if (era.sql.exec('SELECT COUNT(*) AS n FROM followers WHERE ip = ? AND created > ?', ip, Date.now() - 86400_000).toArray()[0].n >= 5) return json(429, { error: 'Enough for today' });
  const id = crypto.randomUUID().slice(0, 12), key = crypto.randomUUID().replace(/-/g, '');
  era.sql.exec('INSERT INTO followers (id, key, channel, target, tags, created, day, sent, ip) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)', id, key, channel, target, JSON.stringify(tags), Date.now(), today, ip);
  const leave = `${site(era.env)}/?unfollow=${id}.${key}`;
  await post(era.env, { channel, target, title: 'You follow the living world of Agentistan', text: `You will hear of: ${labels(tags, era.state()).join('; ')}. A month passes every two hours.`, url: site(era.env), image: `${site(era.env)}/art/events/golden.webp`, tags: [], leave });
  return json(200, { id, key, leave });
}

// After each month: every follower gets the events that match what they follow, a few at a time, at most twelve a day.
export function makeTidings(env, era) {
  if (!(env.N8N_URL || '')) return null;
  return async function tidings(s, events) {
    if (era.meta.game) return; // only the living world
    const rows = era.sql.exec('SELECT id, key, channel, target, tags, day, sent FROM followers').toArray();
    if (!rows.length) return;
    const tagged = events.filter((e) => e.text).map((e) => ({ e, tags: tagsOf(e, s) }));
    const today = new Date().toISOString().slice(0, 10);
    for (const f of rows) {
      const want = new Set(JSON.parse(f.tags)), sent = f.day === today ? f.sent : 0;
      if (sent >= 12) continue;
      const hits = tagged.filter((x) => x.tags.some((t) => want.has(t))).sort((a, b) => (a.e.minor ? 1 : 0) - (b.e.minor ? 1 : 0)).slice(0, Math.min(3, 12 - sent));
      for (const { e, tags } of hits) {
        const art = ART[e.type] && MANIFEST.events?.includes(ART[e.type]) ? `${site(env)}/art/events/${ART[e.type]}.webp` : null;
        await post(env, { channel: f.channel, target: f.target, title: `${e.date ?? ''}${e.date ? ': ' : ''}${String(e.text).split(/[:;,]/)[0].slice(0, 90)}`, text: e.text, url: site(env), image: art, tags: labels(tags.filter((t) => want.has(t)), s), leave: `${site(env)}/?unfollow=${f.id}.${f.key}` });
      }
      if (hits.length) era.sql.exec('UPDATE followers SET day = ?, sent = ? WHERE id = ?', today, sent + hits.length, f.id);
    }
  };
}
