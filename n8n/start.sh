#!/usr/bin/env bash
# Imports and publishes the workflows, then starts n8n on localhost only (the editor is never exposed publicly).
set -euo pipefail
cd "$(dirname "$0")"
export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$PWD/../data/n8n}"
export N8N_PORT="${N8N_PORT:-5678}" N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-127.0.0.1}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false # workflows read WORLD_URL, REALM_SECRET, ... via $env
export N8N_DIAGNOSTICS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_SECURE_COOKIE=false
export EXECUTIONS_DATA_PRUNE=true EXECUTIONS_DATA_MAX_AGE=48
export WORLD_URL="${WORLD_URL:-http://127.0.0.1:${PORT:-8080}}"
export ORACLE_RPC_URL="${ORACLE_RPC_URL:-https://sepolia.base.org}"
export FEED_ADDRESS="${FEED_ADDRESS:-0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1}"
: "${REALM_SECRET:?REALM_SECRET must be set (see .env)}"

N8N=node_modules/.bin/n8n
[ -x "$N8N" ] || npm install --no-audit --no-fund
"$N8N" import:workflow --separate --input=workflows
for id in nbpTurnRouter001 nbpMarketSync001; do "$N8N" publish:workflow --id="$id"; done
exec "$N8N" start
