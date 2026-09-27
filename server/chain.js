// Chain: reads Chainlink price feeds and writes receipts to the RealmLedger contract.
// NETWORK=local talks to an Anvil fork of Base Sepolia (set LEDGER_ADDRESS); NETWORK=base-sepolia talks to the public testnet.
// No filesystem access, so the same module runs in the Cloudflare Worker and in Node (deploy.js, tests).
import { createPublicClient, createWalletClient, http, parseAbi, decodeEventLog, decodeFunctionResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import LEDGER from './RealmLedger.json' with { type: 'json' };
import DEPLOYED from '../deployments/base-sepolia.json' with { type: 'json' };
import { FEEDS } from './config.js';

export { LEDGER };
export const FEED_ABI = parseAbi(['function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)']);
export const KINGDOM_ID = { red: 1, blue: 2 };

const round = ([roundId, answer, , updatedAt]) => ({ roundId: roundId.toString(), answer: Number(answer), updatedAt: Number(updatedAt) });

// The raw eth_call result of latestRoundData() (what the n8n Market Sync workflow posts) -> numbers.
export const decodeRoundData = (hex) => round(decodeFunctionResult({ abi: FEED_ABI, functionName: 'latestRoundData', data: hex }));

export function makeChain(env) {
  const name = env.NETWORK || 'local';
  const rpc = name === 'local' ? env.LOCAL_RPC_URL || 'http://127.0.0.1:8545' : env.CHAIN_RPC_URL || 'https://sepolia.base.org';
  const chain = { ...baseSepolia, rpcUrls: { default: { http: [rpc] } } }; // an Anvil fork keeps chain id 84532
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const oracle = createPublicClient({ chain: baseSepolia, transport: http(env.ORACLE_RPC_URL || 'https://sepolia.base.org') });
  const account = env.DEPLOYER_PRIVATE_KEY ? privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY) : null;
  const wallet = account && createWalletClient({ account, chain, transport: http(rpc) });
  const ledger = env.LEDGER_ADDRESS || (name === DEPLOYED.chain ? DEPLOYED.address : null);
  return {
    name, rpc, ledger, pub, wallet, feed: FEEDS.ETH, feeds: FEEDS,
    account: account?.address ?? null,
    explorer: name === 'local' ? null : env.EXPLORER_URL || 'https://sepolia.basescan.org',
    enabled: Boolean(wallet && ledger),
    readFeed: async (coin = 'ETH') => round(await oracle.readContract({ address: FEEDS[coin], abi: FEED_ABI, functionName: 'latestRoundData' })),
    send: (kind, args) => wallet.writeContract({ address: ledger, abi: LEDGER.abi, functionName: kind === 'capture' ? 'recordCapture' : 'recordSeasonResult', args }),
    async confirm(hash) {
      const r = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (r.status !== 'success') throw Object.assign(new Error('transaction reverted'), { fatal: true });
      const out = { block: Number(r.blockNumber) };
      for (const log of r.logs) {
        try {
          const ev = decodeEventLog({ abi: LEDGER.abi, data: log.data, topics: log.topics });
          if (ev.eventName === 'StrongholdCaptured') Object.assign(out, { ethUsd: Number(ev.args.ethUsd) / 1e8, priceUpdatedAt: Number(ev.args.priceUpdatedAt) });
        } catch { /* not our event */ }
      }
      return out;
    },
  };
}
