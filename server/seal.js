// The chain: once a year of the living world, a seal goes to Chronicle on Base Sepolia with the year's deeds (who
// took which province, and how), its treaties (who promised what to whom), the treaties broken, and fingerprints of
// the world and of its public record. Sent in the background one at a time, confirmed months later: the game never
// waits for the chain, and a seal that fails is tried again next month.
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import CHRONICLE from './Chronicle.json' with { type: 'json' };
import DEPLOYED from '../deployments/chronicle-base-sepolia.json' with { type: 'json' };
import { PROVINCES } from '../web/silk/engine.js';

const HOW = { start: 0, conquest: 1, revolt: 2, secession: 3, bribe: 4, inheritance: 5, verdict: 6, commune: 7, treaty: 8 };
const KIND = { peace: 1, alliance: 2, marriage: 3, vassal: 4, verdict: 5 };
const PINDEX = Object.fromEntries(PROVINCES.map((p) => [p.id, p.i]));
export const EXPLORER = 'https://sepolia.basescan.org';

// What one seal holds: everything that happened in months [from, to) of this age.
export function sealFor(s, book, from, to) {
  const idx = (id) => {
    if (!id) return 0;
    if (!book.realms[id]) { book.realms[id] = book.next++; book.named.push(id); }
    return book.realms[id];
  };
  book.named = [];
  const deeds = [];
  for (const p of PROVINCES) for (const d of s.deeds[p.id] ?? []) if (d.m >= from && d.m < to) deeds.push({ province: PINDEX[p.id], realm: idx(d.realm), how: HOW[d.how] ?? 1, month: d.m });
  const treaties = [], breaches = [];
  for (const t of Object.values(s.treaties)) {
    const id = +t.id.slice(1);
    if (t.signed >= from && t.signed < to && KIND[t.kind]) {
      treaties.push({ id, kind: KIND[t.kind], a: idx(t.parties[0]), b: idx(t.parties[1]), signed: t.signed, until: t.until ?? 0, gold: Math.round(t.pay?.gold ?? 0), payer: idx(t.pay?.from) });
      book.sworn.push(id);
    }
    if (t.broken && t.broken.m >= from && t.broken.m < to && book.sworn.includes(id)) breaches.push({ id, by: idx(t.broken.by), month: t.broken.m });
  }
  const names = book.named.map((id) => s.realms[id]?.name ?? id);
  return { deeds, treaties, breaches, realms: book.named.map((id) => book.realms[id]), names };
}

export function makeSealer(env, era) {
  if (!env.DEPLOYER_PRIVATE_KEY || env.SEAL === 'off' || !DEPLOYED.address) return null;
  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY);
  const transport = http(env.CHAIN_RPC_URL || 'https://sepolia.base.org');
  const pub = createPublicClient({ chain: baseSepolia, transport }), wallet = createWalletClient({ account, chain: baseSepolia, transport });
  return async function seal(s) {
    const age = era.meta.age;
    let book = era.get('seals');
    if (!book || book.age !== age) book = { age, chainAge: (era.meta.seed % 1_000_000) * 100 + age, realms: {}, next: 1, sworn: [], covered: 0, seq: 0, list: [] };
    // A year has ended (or the sealer has just arrived): queue what happened since the last seal.
    if (s.month % 12 === 0 && s.month > book.covered) {
      const body = sealFor(s, book, book.covered, s.month);
      const record = era.sql.exec('SELECT inputs, events FROM months WHERE age = ? AND m >= ? AND m < ? ORDER BY m', age, book.covered, s.month).toArray().map((r) => `${r.inputs}${r.events}`).join('\n');
      book.list.push({ seq: book.seq++, from: book.covered, to: s.month, status: 'queued', tries: 0,
        args: [{ age: book.chainAge, year: book.seq - 1, month: s.month, stateHash: keccak256(stringToHex(JSON.stringify(s))), recordHash: keccak256(stringToHex(record)) }, body.realms, body.names, body.deeds, body.treaties, body.breaches] });
      book.covered = s.month;
    }
    // One seal in flight at a time, in order.
    const sent = book.list.find((x) => x.status === 'sent');
    if (sent) {
      const r = await pub.getTransactionReceipt({ hash: sent.hash }).catch(() => null);
      if (r) Object.assign(sent, r.status === 'success' ? { status: 'done', block: Number(r.blockNumber) } : { status: 'queued', error: 'reverted' });
      else if (Date.now() - sent.at > 30 * 60_000) Object.assign(sent, { status: 'queued', error: 'lost' });
    }
    const next = !book.list.some((x) => x.status === 'sent') && book.list.find((x) => x.status === 'queued');
    if (next && next.tries < 6) {
      next.tries++;
      try {
        next.hash = await wallet.writeContract({ address: DEPLOYED.address, abi: CHRONICLE.abi, functionName: 'seal', args: next.args });
        Object.assign(next, { status: 'sent', at: Date.now() });
      } catch (err) {
        next.error = (err.shortMessage ?? err.message).slice(0, 160);
        console.error('seal failed:', next.error);
      }
    }
    book.list = book.list.filter((x, i, all) => x.status !== 'done' || i >= all.length - 60); // keep the last sixty
    era.put('seals', book);
  };
}
export { DEPLOYED };
