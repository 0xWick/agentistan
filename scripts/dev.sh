#!/usr/bin/env bash
# The whole stack in one command: Anvil fork of Base Sepolia (only when NETWORK=local), n8n, the world server,
# a Cloudflare tunnel (TUNNEL_NAME from scripts/tunnel.sh, or QUICK_TUNNEL=1 for a free trycloudflare.com URL)
# and deploy-on-push (when the repo has an origin). Each runs detached with its PID and log in data/.
# Usage: scripts/dev.sh start | stop [name...] | restart [name...] | status
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$HOME/.foundry/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; nvm use 24 >/dev/null; fi
# Load .env literally (no shell parsing, so JSON values survive); variables already set in the environment win.
if [ -f .env ]; then
  while IFS='=' read -r k v; do
    [[ $k =~ ^[A-Z_][A-Z0-9_]*$ ]] && [ -z "${!k+x}" ] && export "$k=$v"
  done < .env
fi
export NETWORK="${NETWORK:-local}" PORT="${PORT:-8080}" # not CHAIN: Foundry reads that name from .env
export N8N_TURN_WEBHOOK="${N8N_TURN_WEBHOOK-http://127.0.0.1:5678/webhook/turn}"
ALL="autodeploy tunnel world n8n anvil"
mkdir -p data

alive() { [ -f "data/$1.pid" ] && kill -0 "$(cat "data/$1.pid")" 2>/dev/null; }
launch() { # name command...
  local name=$1; shift
  if alive "$name"; then echo "$name: already running"; return; fi
  setsid nohup "$@" >"data/$name.log" 2>&1 </dev/null &
  echo $! >"data/$name.pid"
  echo "$name: started (log: data/$name.log)"
}
wait_url() { # name url seconds
  for _ in $(seq "$3"); do curl -sf -o /dev/null "$2" && return 0; sleep 1; done
  echo "$1 did not come up; see data/$1.log" >&2
  return 1
}
stop() { # stop [name...]; default: everything
  for n in ${*:-$ALL}; do
    if alive "$n"; then kill -- "-$(cat "data/$n.pid")" 2>/dev/null || kill "$(cat "data/$n.pid")"; echo "$n: stopped"; fi
    rm -f "data/$n.pid"
  done
}

start() {
  if [ "$NETWORK" = local ]; then
    local rpc=http://127.0.0.1:8545
    launch anvil anvil --fork-url "${FORK_RPC_URL:-https://sepolia.base.org}" --host 127.0.0.1 --port 8545
    for _ in $(seq 60); do cast chain-id --rpc-url $rpc >/dev/null 2>&1 && break; sleep 1; done
    # Fork-only test ETH for the operator wallet; real Base Sepolia is never touched in local mode.
    cast rpc anvil_setBalance "$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")" 0x56BC75E2D63100000 --rpc-url $rpc >/dev/null
    local ledger
    ledger=$(node -p "require('./deployments/local.json').address" 2>/dev/null || true)
    if [ -z "$ledger" ] || [ "$(cast code "$ledger" --rpc-url $rpc)" = "0x" ]; then node server/deploy.js; fi
  fi
  if [ -n "$N8N_TURN_WEBHOOK" ]; then
    launch n8n bash n8n/start.sh
    wait_url n8n http://127.0.0.1:5678/healthz 180
    # Webhooks register a few seconds after /healthz; a GET gets "did you mean POST" once the Turn Router is live.
    for _ in $(seq 60); do curl -s http://127.0.0.1:5678/webhook/turn | grep -q POST && break; sleep 1; done
  fi
  launch world node server/server.js
  wait_url world "http://127.0.0.1:$PORT/api/health" 30
  if [ -n "${TUNNEL_NAME:-}" ] && [ -f "$HOME/.cloudflared/$TUNNEL_NAME.yml" ]; then
    launch tunnel cloudflared tunnel --no-autoupdate --config "$HOME/.cloudflared/$TUNNEL_NAME.yml" run
  elif [ "${QUICK_TUNNEL:-}" = 1 ]; then
    launch tunnel cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT"
    for _ in $(seq 30); do grep -qo 'https://[a-z0-9-]*\.trycloudflare\.com' data/tunnel.log && break; sleep 1; done
    grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' data/tunnel.log | head -1 > data/public-url || true
  fi
  if git remote get-url origin >/dev/null 2>&1; then launch autodeploy bash scripts/autodeploy.sh; fi
  echo "Local: http://localhost:$PORT   n8n editor: http://localhost:5678   Public: $(cat data/public-url 2>/dev/null || echo none)"
}

cmd="${1:-start}"
[ $# -gt 0 ] && shift
case "$cmd" in
  start) start ;;
  stop) stop "$@" ;;
  restart) stop "$@"; sleep 1; start ;;
  status)
    for n in $ALL; do alive "$n" && echo "$n: running" || echo "$n: stopped"; done
    echo "public: $(cat data/public-url 2>/dev/null || echo none)"
    curl -s "http://127.0.0.1:$PORT/api/health" && echo ;;
  *) echo "usage: $0 start | stop [name...] | restart [name...] | status" >&2; exit 1 ;;
esac
