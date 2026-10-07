// Regalia: the players' keepsakes, ERC-721 tokens on Base Sepolia (contracts/src/Regalia.sol). A token is awarded
// when a player seizes a throne, wins a battle with his own plan, ends his reign, or ends an era as its master. It waits
// until the player gives an address (a wallet made in his browser, or his own), then goes out in a batch with the
// next mint. Its name, picture and traits are served here, at /nft/<id>, in the standard metadata shape.
import { createPublicClient, createWalletClient, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import REGALIA from './Regalia.json' with { type: 'json' };
import DEPLOYED from '../deployments/regalia-base-sepolia.json' with { type: 'json' };
import { yearOf, yearLabel, AGES, provincesOf } from '../web/silk/engine.js';

const the = (n) => (/^(Kingdom|Empire|Sultanate|Duchy|Principality|Republic|Emirate|Khanate|County|Grand|Union|State|Bogd|Beylik|Khedivate|Commune|Armed|Democratic|Rising)\b/.test(n ?? '') ? `the ${n}` : n);
export const KINDS = {
  throne: { title: 'Seal of the Throne', text: (m) => `${m.ruler} seized the throne of ${the(m.realm)} in ${m.year}.` },
  honour: { title: 'Battle Honour', text: (m) => `${m.ruler} of ${the(m.realm)} won the battle at ${m.place} in ${m.year} with a plan of his own: ${m.plan}.` },
  scroll: { title: 'Reign Scroll', text: (m) => `The reign of ${m.ruler} over ${the(m.realm)}, ${m.from} to ${m.year}: ${m.story}.` },
  crown: { title: 'Era Crown', text: (m) => `${(the(m.realm) ?? '').replace(/^./, (c) => c.toUpperCase())} ended ${m.era} as master of the world, in ${m.year}.` },
};
export function setupRegalia(era) {
  era.sql.exec('CREATE TABLE IF NOT EXISTS regalia (id INTEGER PRIMARY KEY, kind TEXT, seat TEXT, owner TEXT, meta TEXT, status TEXT, tx TEXT, at INTEGER)');
}
// A keepsake earned: it waits for an address, or is queued for the next mint.
export function award(era, seat, kind, meta) {
  const id = (era.get('regaliaNext') ?? 1);
  era.put('regaliaNext', id + 1);
  const owner = seat.wallet ?? null;
  era.sql.exec('INSERT INTO regalia (id, kind, seat, owner, meta, status, tx, at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)', id, kind, seat.hash, owner, JSON.stringify(meta), owner ? 'queued' : 'waiting', Date.now());
  return id;
}
// A player gives his address: everything waiting for him goes into the next mint.
export function claimRegalia(era, seatHash, address) {
  era.sql.exec("UPDATE regalia SET owner = ?, status = 'queued' WHERE seat = ? AND status = 'waiting'", address, seatHash);
}
export const regaliaOf = (era, { seat, owner }) => era.sql.exec('SELECT id, kind, owner, meta, status, tx FROM regalia WHERE seat = ? OR (owner IS NOT NULL AND owner = ?) ORDER BY id DESC LIMIT 60', seat ?? '', owner ?? '')
  .toArray().map((r) => ({ ...r, meta: JSON.parse(r.meta), title: KINDS[r.kind]?.title }));
export { isAddress };

// What a token says of itself: standard ERC-721 metadata, and its picture.
export function metadata(era, id, site) {
  const row = era.sql.exec('SELECT id, kind, meta FROM regalia WHERE id = ?', id).toArray()[0];
  if (!row) return null;
  const m = JSON.parse(row.meta), K = KINDS[row.kind];
  return {
    name: `${K.title}: ${m.ruler}, ${m.realm}`,
    description: `${K.text(m)} A keepsake of Agentistan, a world that writes its own history.`,
    image: `${site}/nft/${row.id}.svg`,
    external_url: site,
    attributes: [{ trait_type: 'Kind', value: K.title }, { trait_type: 'Realm', value: m.realm }, { trait_type: 'Ruler', value: m.ruler }, { trait_type: 'Era', value: m.era }, { trait_type: 'Year', value: m.year },
      ...(m.provinces !== undefined ? [{ trait_type: 'Provinces', value: m.provinces, display_type: 'number' }] : []), ...(m.plan ? [{ trait_type: 'Plan', value: m.plan }] : [])],
  };
}
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const EMBLEM = {
  throne: 'M150 300 165 215 205 250 240 175 275 250 315 215 330 300zM150 312h180v16H150z',
  honour: 'M175 185l130 130M305 185 175 315M190 300l-22 22M290 300l22 22M160 180l18 18M320 180l-18 18',
  scroll: 'M180 190h120a16 16 0 0 1 0 32h-8v86a16 16 0 0 1-16 16H180a16 16 0 0 1 0-32h8v-86a16 16 0 0 1-8-16zM205 240h70M205 262h70M205 284h50',
  crown: 'M150 300 165 215 205 250 240 175 275 250 315 215 330 300zM150 312h180v16H150zM240 150l8 16 18 2-13 12 3 18-16-9-16 9 3-18-13-12 18-2z',
};
// The picture: a parchment card with the realm's colours and the token's emblem. No fonts to fetch, no scripts.
export function picture(era, id) {
  const row = era.sql.exec('SELECT id, kind, meta FROM regalia WHERE id = ?', id).toArray()[0];
  if (!row) return null;
  const m = JSON.parse(row.meta), K = KINDS[row.kind], c = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#8c6b3f', stroke = row.kind === 'honour' || row.kind === 'scroll';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" width="480" height="600">
<defs><radialGradient id="p" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#f6ecd2"/><stop offset="1" stop-color="#d9c08a"/></radialGradient></defs>
<rect width="480" height="600" fill="url(#p)"/><rect x="14" y="14" width="452" height="572" fill="none" stroke="#b3852c" stroke-width="6"/><rect x="26" y="26" width="428" height="548" fill="none" stroke="#6a5032" stroke-width="1.5"/>
<text x="240" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#27466e">${esc(K.title)}</text>
<path d="M150 130h180v150c0 60-45 95-90 115-45-20-90-55-90-115z" fill="${c}" stroke="#3a2816" stroke-width="3"/>
<path d="${EMBLEM[row.kind]}" transform="translate(0 -20) scale(1) translate(0 0)" fill="${stroke ? 'none' : '#f3d27a'}" stroke="${stroke ? '#f3d27a' : '#3a2816'}" stroke-width="${stroke ? 12 : 2}" stroke-linecap="round" stroke-linejoin="round"/>
<text x="240" y="440" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#3a2816">${esc(m.ruler)}</text>
<text x="240" y="474" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#6a5032">${esc(m.realm)} · ${esc(m.year)}</text>
<text x="240" y="506" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#6a5032">${esc(m.era)}</text>
<text x="240" y="556" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#8c6b3f">Agentistan · Regalia no. ${row.id}</text>
</svg>`;
}

// What happened this quarter that earns a keepsake.
export function awardsFor(era, s, events, seats, lost = []) {
  const pack = AGES[s.ageId], eraName = pack?.name ?? 'an age', year = yearLabel(yearOf(s.month, s));
  const base = (realm, ruler) => ({ realm: s.realms[realm]?.name ?? realm, ruler: ruler ?? s.chars[s.realms[realm]?.ruler]?.name ?? '?', era: eraName, color: s.realms[realm]?.color, year });
  for (const e of events) {
    if (e.type === 'coup' && e.player && seats[e.player]) award(era, seats[e.player], 'throne', { ...base(e.player), year: e.date?.split(' ').pop() ?? year });
    if (e.type === 'battle' && e.commanded?.length && (e.lost?.[0] ?? 0) + (e.lost?.[1] ?? 0) >= 3) {
      for (const realm of e.commanded) if (seats[realm] && realm === e.winner) {
        const side = Object.values(e.tactics ?? {}).find((t) => t?.by === 'ruler');
        award(era, seats[realm], 'honour', { ...base(realm), place: (e.text.match(/ at ([^:]+?)(?: after|:)/)?.[1] ?? 'the field'), plan: side?.id ?? 'his own' });
      }
    }
  }
  for (const { seat, realm, ruler, since, why } of lost) award(era, seat, 'scroll', { ...base(realm, ruler), from: since, story: why, provinces: provincesOf(s, realm).length });
  const ended = events.find((e) => e.type === 'age.ended');
  if (ended) { // the end of an era: a crown for its master, a scroll for every reign it closes
    const winner = ended.realms?.[0];
    if (seats[winner]) award(era, seats[winner], 'crown', { ...base(winner, seats[winner].name), provinces: provincesOf(s, winner).length });
    for (const [realm, seat] of Object.entries(seats)) award(era, seat, 'scroll', { ...base(realm, seat.name), from: seat.sinceYear ?? '?', story: 'the era ended', provinces: provincesOf(s, realm).length });
  }
}

// After the quarter: confirm what was sent, and send the next batch (the game never waits for the chain).
export function makeMinter(env, era) {
  if (!env.DEPLOYER_PRIVATE_KEY || env.SEAL === 'off' || !DEPLOYED.address) return null;
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY), transport = http(env.CHAIN_RPC_URL || 'https://sepolia.base.org');
  const pub = createPublicClient({ chain: baseSepolia, transport }), wallet = createWalletClient({ account, chain: baseSepolia, transport });
  return async function mint() {
    if (era.meta.game) return;
    for (const { tx } of era.sql.exec("SELECT DISTINCT tx FROM regalia WHERE status = 'sent'").toArray()) {
      const r = await pub.getTransactionReceipt({ hash: tx }).catch(() => null);
      if (r) era.sql.exec('UPDATE regalia SET status = ? WHERE tx = ?', r.status === 'success' ? 'minted' : 'queued', tx);
    }
    const batch = era.sql.exec("SELECT id, owner FROM regalia WHERE status = 'queued' AND owner IS NOT NULL ORDER BY id LIMIT 20").toArray();
    if (!batch.length) return;
    try {
      const tx = await wallet.writeContract({ address: DEPLOYED.address, abi: REGALIA.abi, functionName: 'mint', args: [batch.map((b) => b.owner), batch.map((b) => BigInt(b.id))] });
      for (const b of batch) era.sql.exec("UPDATE regalia SET status = 'sent', tx = ? WHERE id = ?", tx, b.id);
    } catch (err) {
      console.error('mint failed:', (err.shortMessage ?? err.message).slice(0, 160));
    }
  };
}
export { DEPLOYED as REGALIA_AT };
