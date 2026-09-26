#!/usr/bin/env bash
# Put the world on your own Cloudflare domain with a named tunnel (free). Only the world server is published;
# the n8n editor stays on localhost.   Usage: bash scripts/tunnel.sh [subdomain]   (default: agentistan)
# The domain is the one you pick in the browser during `cloudflared tunnel login`.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
SUB="${1:-agentistan}"
NAME="${TUNNEL_NAME:-nobodys-playing}"
CERT="$HOME/.cloudflared/cert.pem"

[ -f "$CERT" ] || cloudflared tunnel login # prints a link: open it, pick your domain, then this continues

tunnel_id() { cloudflared tunnel list -o json | python3 -c "import json,sys; print(next((t['id'] for t in json.load(sys.stdin) if t['name'] == '$NAME'), ''))"; }
[ -n "$(tunnel_id)" ] || cloudflared tunnel create "$NAME"
ID=$(tunnel_id)

# A bare label gets the login domain appended by Cloudflare; the output tells us the full hostname.
OUT=$(cloudflared tunnel route dns "$NAME" "$SUB" 2>&1) || { echo "$OUT"; exit 1; }
echo "$OUT"
HOST=$(grep -oE "CNAME [A-Za-z0-9.-]+" <<<"$OUT" | head -1 | cut -d' ' -f2)
HOST="${HOST:-$(grep -oE "$SUB\.[A-Za-z0-9.-]+" <<<"$OUT" | head -1)}"
[ -n "$HOST" ] || { echo "Could not read the hostname from cloudflared's output above" >&2; exit 1; }

cat > "$HOME/.cloudflared/$NAME.yml" <<EOF
tunnel: $ID
credentials-file: $HOME/.cloudflared/$ID.json
ingress:
  - hostname: $HOST
    service: http://127.0.0.1:${PORT:-8080}
  # Any other hostname routed to this tunnel (an earlier subdomain, say) serves the site too.
  - service: http://127.0.0.1:${PORT:-8080}
EOF
grep -q '^TUNNEL_NAME=' .env || printf '\nTUNNEL_NAME=%s\n' "$NAME" >> .env
mkdir -p data && echo "https://$HOST" > data/public-url
bash scripts/dev.sh stop tunnel
bash scripts/dev.sh start
echo "Live at https://$HOST"
