#!/usr/bin/env bash
set -euo pipefail

# Start the admin app (port 3000) and public site (port 4321).
# The public site also serves the /s/* ingestion endpoint.
# Ctrl+C stops all.

cd "$(dirname "$0")/.."

DATABASE_URL="postgres://aipromptsecret:aipromptsecret@localhost:5432/aipromptsecret"
export DATABASE_URL

cleanup() {
  echo ""
  echo "==> Stopping services..."
  kill "$admin_pid" "$public_pid" 2>/dev/null || true
  wait "$admin_pid" "$public_pid" 2>/dev/null || true
  echo "    Done."
}
trap cleanup EXIT INT TERM

echo "==> Starting admin app on port 3000..."
pnpm --filter @aipromptsecret/admin dev &
admin_pid=$!

echo "==> Starting public site on port 4321..."
pnpm --filter @aipromptsecret/public dev &
public_pid=$!

echo ""
echo "Services running:"
echo "  Admin (moderation UI):             http://localhost:3000"
echo "  Public site + ingestion (/s/*):    http://localhost:4321"
echo ""
echo "Press Ctrl+C to stop all services."

wait
