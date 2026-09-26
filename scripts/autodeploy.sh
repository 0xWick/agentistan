#!/usr/bin/env bash
# Deploy on push: every minute, fast-forward to origin/main and restart only what changed.
# web/ is served straight from disk, so page changes go live without a restart.
set -uo pipefail
cd "$(dirname "$0")/.."
BRANCH="${DEPLOY_BRANCH:-main}"
while sleep "${DEPLOY_POLL_SECONDS:-60}"; do
  git fetch -q origin "$BRANCH" || continue
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] && continue
  changed=$(git diff --name-only HEAD "origin/$BRANCH")
  if ! git merge -q --ff-only "origin/$BRANCH"; then
    echo "$(date -Is) cannot fast-forward to origin/$BRANCH (local commits or edits?); skipping"
    continue
  fi
  echo "$(date -Is) deployed $(git rev-parse --short HEAD): $(echo "$changed" | tr '\n' ' ')"
  grep -q '^package-lock.json$' <<<"$changed" && npm ci --no-audit --no-fund
  restart=""
  grep -q '^n8n/' <<<"$changed" && restart="$restart n8n"
  grep -qE '^(server/|package)' <<<"$changed" && restart="$restart world"
  # shellcheck disable=SC2086
  [ -n "$restart" ] && bash scripts/dev.sh restart $restart
done
