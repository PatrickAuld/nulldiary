#!/usr/bin/env bash
set -euo pipefail

# Start Postgres, wait for readiness, run migrations.

cd "$(dirname "$0")/.."

DATABASE_URL="postgres://aipromptsecret:aipromptsecret@localhost:5432/aipromptsecret"
export DATABASE_URL

echo "==> Starting Postgres..."
docker compose up -d postgres

echo "==> Waiting for Postgres to accept connections..."
retries=30
until docker compose exec -T postgres pg_isready -U aipromptsecret -d aipromptsecret >/dev/null 2>&1; do
  retries=$((retries - 1))
  if [ "$retries" -le 0 ]; then
    echo "ERROR: Postgres did not become ready"
    exit 1
  fi
  sleep 1
done
echo "    Postgres is ready."

echo "==> Running migrations..."
# Check if the schema already exists (messages table as sentinel)
table_exists=$(docker compose exec -T postgres \
  psql -U aipromptsecret -d aipromptsecret -tAc \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages');")

if [ "$table_exists" = "t" ]; then
  echo "    Tables already exist, skipping migration."
else
  docker compose exec -T postgres \
    psql -U aipromptsecret -d aipromptsecret < packages/db/migrations/0000_initial.sql
  echo "    Migration applied."
fi

echo ""
echo "Postgres is up and migrated."
echo "  DATABASE_URL=$DATABASE_URL"
echo ""
echo "Next steps:"
echo "  ./scripts/dev-services.sh   Start admin (port 3000) + public (port 4321)"
echo "  ./scripts/seed.sh           Send test messages via the ingestion endpoint"
echo "  ./scripts/dev-down.sh       Stop Postgres"
