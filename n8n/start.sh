#!/bin/sh
# Imports and publishes the workflows, then starts n8n.
# Locally: `bash n8n/start.sh` next to `npm run dev` (editor on localhost only).
# On Render: the Dockerfile runs this with N8N_LISTEN_ADDRESS=0.0.0.0 and N8N_DISABLE_UI=true (webhooks only, no editor).
set -eu
cd "$(dirname "$0")"
export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$PWD/../data/n8n}"
export N8N_PORT="${N8N_PORT:-${PORT:-5678}}" N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-127.0.0.1}" # Render passes PORT
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false # workflows read WORLD_URL, REALM_SECRET, ... via $env
export N8N_DIAGNOSTICS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_SECURE_COOKIE=false
export EXECUTIONS_DATA_PRUNE=true EXECUTIONS_DATA_MAX_AGE=48
export WORLD_URL="${WORLD_URL:-http://127.0.0.1:8787}"
export ORACLE_RPC_URL="${ORACLE_RPC_URL:-https://sepolia.base.org}"
: "${REALM_SECRET:?REALM_SECRET must be set (see .env)}"

N8N=node_modules/.bin/n8n # locally it's installed here; the Docker image has it on PATH instead
[ -x "$N8N" ] || [ ! -f /.dockerenv ] || N8N=$(command -v n8n)
[ -x "$N8N" ] || npm install --no-audit --no-fund
"$N8N" import:workflow --separate --input=workflows
for id in nbpTurnRouter001 nbpMarketSync001 nbpWeatherSync01 nbpWarCorresp01; do "$N8N" publish:workflow --id="$id"; done
exec "$N8N" start
