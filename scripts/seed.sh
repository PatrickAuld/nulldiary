#!/usr/bin/env bash
set -euo pipefail

# Seed test messages via the ingestion endpoint.
# Requires the public site to be running on port 4321.

INGESTION_URL="${INGESTION_URL:-http://localhost:4321}"

echo "==> Seeding messages via $INGESTION_URL/s/ ..."
echo ""

# --- Header-based messages ---

echo "1/8  Header x-message ..."
curl -s -X POST "$INGESTION_URL/s/" \
  -H "x-message: Hello from a header message" \
  | jq . 2>/dev/null || true
echo ""

echo "2/8  Header x-secret ..."
curl -s -X POST "$INGESTION_URL/s/" \
  -H "x-secret: I secretly love writing YAML" \
  | jq . 2>/dev/null || true
echo ""

# --- Body JSON messages ---

echo "3/8  JSON body (message field) ..."
curl -s -X POST "$INGESTION_URL/s/" \
  -H "Content-Type: application/json" \
  -d '{"message": "This came from a JSON body"}' \
  | jq . 2>/dev/null || true
echo ""

echo "4/8  JSON body (secret field) ..."
curl -s -X POST "$INGESTION_URL/s/" \
  -H "Content-Type: application/json" \
  -d '{"secret": "AI agents dream of electric sheep"}' \
  | jq . 2>/dev/null || true
echo ""

echo "5/8  JSON body (prompt field) ..."
curl -s -X POST "$INGESTION_URL/s/" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Tell me something nobody knows"}' \
  | jq . 2>/dev/null || true
echo ""

# --- Query parameter ---

echo "6/8  Query parameter ..."
curl -s "$INGESTION_URL/s/?message=Submitted+via+query+parameter" \
  | jq . 2>/dev/null || true
echo ""

# --- Path segment ---

echo "7/8  Path segment ..."
curl -s "$INGESTION_URL/s/Path-based+secret+message" \
  | jq . 2>/dev/null || true
echo ""

# --- Plain text body ---

echo "8/8  Plain text body ..."
curl -s -X PUT "$INGESTION_URL/s/" \
  -H "Content-Type: text/plain" \
  -d "This is a plain text secret sent via PUT" \
  | jq . 2>/dev/null || true
echo ""

echo "==> Done. 8 messages seeded."
echo "    View them at http://localhost:3000/messages"
