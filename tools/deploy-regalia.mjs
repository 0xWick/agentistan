// Deploys Regalia (the players' keepsakes, ERC-721) to Base Sepolia and records it for the server.
//   (cd contracts && forge build) && node --env-file=.env tools/deploy-regalia.mjs
// Needs faucet ETH in DEPLOYER_PRIVATE_KEY. Writes server/Regalia.json (the ABI) and deployments/regalia-base-sepolia.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const root = new URL('../', import.meta.url);
const built = JSON.parse(readFileSync(new URL('contracts/out/Regalia.sol/Regalia.json', root)));
writeFileSync(new URL('server/Regalia.json', root), `${JSON.stringify({ abi: built.abi })}\n`);
if (process.argv.includes('--abi-only')) process.exit(0);

const base = `${process.env.PUBLIC_URL || 'https://agentistan.umarkhatana.com'}/nft/`;
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const transport = http(process.env.CHAIN_RPC_URL || 'https://sepolia.base.org');
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });
console.log(`deploying Regalia from ${account.address}, balance ${formatEther(await pub.getBalance({ address: account.address }))} ETH, base ${base}`);
const tx = await wallet.deployContract({ abi: built.abi, bytecode: built.bytecode.object, args: [base] });
const r = await pub.waitForTransactionReceipt({ hash: tx });
const dep = { chain: 'base-sepolia', chainId: 84532, address: r.contractAddress, block: Number(r.blockNumber), keeper: account.address, base, tx, deployedAt: new Date().toISOString() };
writeFileSync(new URL('deployments/regalia-base-sepolia.json', root), `${JSON.stringify(dep, null, 2)}\n`);
console.log(dep, `https://sepolia.basescan.org/address/${dep.address}`);
