#!/usr/bin/env bash
set -euo pipefail

# Start the admin app (port 3000) and public site (port 4321).
# The public site also serves the /s/* ingestion endpoint.
# Ctrl+C stops all.

cd "$(dirname "$0")/.."

# Supabase env vars — required for both apps.
# Override via .env or shell exports if needed.
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY

cleanup() {
  echo ""
  echo "==> Stopping services..."
  kill "$admin_pid" "$public_pid" 2>/dev/null || true
  wait "$admin_pid" "$public_pid" 2>/dev/null || true
  echo "    Done."
}
trap cleanup EXIT INT TERM

echo "==> Starting admin app on port 3000..."
pnpm --filter @nulldiary/admin dev &
admin_pid=$!

echo "==> Starting public site on port 4321..."
pnpm --filter @nulldiary/public dev &
public_pid=$!

echo ""
echo "Services running:"
echo "  Admin (moderation UI):             http://localhost:3000"
echo "  Public site + ingestion (/s/*):    http://localhost:4321"
echo ""
echo "Press Ctrl+C to stop all services."

wait
