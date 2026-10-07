// Deploys Chronicle (the registry of land and oaths) to Base Sepolia and records it for the server.
//   (cd contracts && forge build) && node --env-file=.env tools/deploy-chronicle.mjs
// Needs faucet ETH in DEPLOYER_PRIVATE_KEY. Writes server/Chronicle.json (the ABI) and deployments/chronicle-base-sepolia.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const root = new URL('../', import.meta.url);
const built = JSON.parse(readFileSync(new URL('contracts/out/Chronicle.sol/Chronicle.json', root)));
writeFileSync(new URL('server/Chronicle.json', root), `${JSON.stringify({ abi: built.abi })}\n`);
if (process.argv.includes('--abi-only')) process.exit(0);

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const transport = http(process.env.CHAIN_RPC_URL || 'https://sepolia.base.org');
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });
console.log(`deploying Chronicle from ${account.address}, balance ${formatEther(await pub.getBalance({ address: account.address }))} ETH`);
const tx = await wallet.deployContract({ abi: built.abi, bytecode: built.bytecode.object });
const r = await pub.waitForTransactionReceipt({ hash: tx });
const dep = { chain: 'base-sepolia', chainId: 84532, address: r.contractAddress, block: Number(r.blockNumber), keeper: account.address, tx, deployedAt: new Date().toISOString() };
writeFileSync(new URL('deployments/chronicle-base-sepolia.json', root), `${JSON.stringify(dep, null, 2)}\n`);
console.log(dep, `https://sepolia.basescan.org/address/${dep.address}`);
