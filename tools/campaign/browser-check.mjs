// Plays a campaign in a real browser: begins it, speaks to the council, opens the war room, ends seasons, zooms, and
// saves screenshots. Prints the conversation and any page errors.
//   BASE=http://localhost:8787 SHOTS=/tmp/shots TURNS=3 SAY='How strong is the enemy?|We march on Placentia' \
//     node tools/campaign/browser-check.mjs hannibal [width] [height]
// Needs Playwright with Chromium (npx playwright install chromium); PLAYWRIGHT=/path/to/playwright/index.mjs if it is not installed here.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const base = process.env.BASE ?? 'http://localhost:8787', cid = process.argv[2] ?? 'hannibal', W = +(process.argv[3] ?? 1440), H = +(process.argv[4] ?? 900), errors = [];
const shot = (p, n) => p.screenshot({ path: `${process.env.SHOTS ?? '.'}/ui-${cid}-${W}-${n}.png` });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack?.split('\n').slice(0, 3).join('\n')}`));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

await p.goto(`${base}/campaign/?c=${cid}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.click('[data-begin]');
await p.waitForTimeout(2500);
await shot(p, '0brief');
await p.click('#sheet[open] [data-close]').catch(() => {});
await p.waitForTimeout(2500);
await shot(p, '1court');
const opt = await p.$('.m.card [data-opt="0"]');
if (opt) { await opt.click(); await p.waitForTimeout(500); }
const say = async (text) => { await p.fill('#say-text', text); await p.press('#say-text', 'Enter'); await p.waitForTimeout(3500); };
for (const t of (process.env.SAY ?? 'How strong is the enemy?').split('|')) await say(t);
await shot(p, '2said');
const tk = await p.$('.tk.mine');
if (tk) { await tk.click({ timeout: 4000 }).catch((e) => errors.push(`token: ${e.message.split('\n')[0]}`)); await p.waitForTimeout(500); await shot(p, '3reach'); }
await p.keyboard.press('Escape');
await p.click('#war-btn');
await p.waitForTimeout(700);
await shot(p, '4warroom');
await p.click('#sheet[open] [data-close]').catch(() => {});
for (let t = 0; t < +(process.env.TURNS ?? 3); t++) {
  for (const o of await p.$$('.m.card [data-opt="0"]:not([disabled])')) await o.click().catch(() => {});
  await p.click('#end-turn').catch((e) => errors.push(`end: ${e.message}`));
  await p.waitForTimeout(3000);
  if (await p.$('#sheet[open]')) { await shot(p, `5end${t}`); break; }
}
await shot(p, '6after');
await p.mouse.move(W / 3, H / 2);
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(100); }
await p.waitForTimeout(400);
await shot(p, '7zoomin');
console.log(await p.$$eval('#chat > li', (l) => l.map((x) => `[${x.className}] ${x.innerText.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')));
console.log(errors.join('\n') || 'no errors');
await b.close();
