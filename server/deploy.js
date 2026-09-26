// Deploys RealmLedger to NETWORK (local | base-sepolia) and records it in deployments/<chain>.json.
//   NETWORK=local npm run deploy          (Anvil fork, see scripts/dev.sh)
//   NETWORK=base-sepolia npm run deploy   (public testnet; needs faucet ETH in DEPLOYER_PRIVATE_KEY)
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeChain, LEDGER } from './chain.js';

const c = makeChain(process.env);
if (!c.wallet) throw new Error('Set DEPLOYER_PRIVATE_KEY in .env first');
const balance = await c.pub.getBalance({ address: c.account });
console.log(`Deploying RealmLedger to ${c.name} (${c.rpc}) from ${c.account}, balance ${Number(balance) / 1e18} ETH`);
if (balance === 0n) throw new Error(`Wallet ${c.account} has no ETH on ${c.name}. Use a Base Sepolia faucet.`);

const tx = await c.wallet.deployContract({ abi: LEDGER.abi, bytecode: LEDGER.bytecode, args: [c.feed] });
const r = await c.pub.waitForTransactionReceipt({ hash: tx });
const dep = {
  chain: c.name, chainId: await c.pub.getChainId(), address: r.contractAddress, block: Number(r.blockNumber),
  feed: c.feed, operator: c.account, tx, deployedAt: new Date().toISOString(),
};
mkdirSync(new URL('../deployments/', import.meta.url), { recursive: true });
writeFileSync(c.depFile, `${JSON.stringify(dep, null, 2)}\n`);
console.log(dep);
if (c.explorer) console.log(`${c.explorer}/address/${dep.address}`);
