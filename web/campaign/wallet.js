// A wallet made in the browser for players without one: the key never leaves this browser, and can be exported.
const WALLET = 'agentistan:wallet';
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const myWallet = () => { try { return JSON.parse(localStorage.getItem(WALLET) ?? 'null'); } catch { return null; } };
export async function makeWallet() {
  const [{ secp256k1 }, { keccak_256 }] = await Promise.all([import('https://esm.sh/@noble/curves@1.9.1/secp256k1'), import('https://esm.sh/@noble/hashes@1.8.0/sha3')]);
  const key = secp256k1.utils.randomPrivateKey(), pub = secp256k1.getPublicKey(key, false).slice(1);
  const w = { key: `0x${hex(key)}`, address: `0x${hex(keccak_256(pub).slice(-20))}`, made: Date.now() };
  try { localStorage.setItem(WALLET, JSON.stringify(w)); } catch { /* a private window: export it at once */ }
  return w;
}
export function exportKey(w) {
  const text = `Agentistan wallet (Base Sepolia testnet)\nAddress: ${w.address}\nPrivate key: ${w.key}\n\nKeep this file secret: whoever has the key owns the scrolls.\nTo see them in MetaMask: add the Base Sepolia network, import this private key, then import the NFT by its contract address and token id.\n`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: `agentistan-wallet-${w.address.slice(2, 8)}.txt` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
