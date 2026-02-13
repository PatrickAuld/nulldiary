-- Add ingestion protections: IP denylist + parse_status values.

-- Extend parse_status enum to support new ingestion outcomes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'too_long'
      AND enumtypid = 'parse_status'::regtype
  ) THEN
    ALTER TYPE parse_status ADD VALUE 'too_long';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'denied_ip'
      AND enumtypid = 'parse_status'::regtype
  ) THEN
    ALTER TYPE parse_status ADD VALUE 'denied_ip';
  END IF;
END $$;

-- Store denied IPs and CIDR ranges.
-- Use network cidr; a single IP should be stored as /32 (IPv4) or /128 (IPv6).
CREATE TABLE IF NOT EXISTS ip_denylist (
  network cidr PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Speed up containment queries: ip::inet <<= network
CREATE INDEX IF NOT EXISTS ip_denylist_network_gist
  ON ip_denylist
  USING gist (network inet_ops);

-- Helper function exposed via PostgREST RPC (used by ingestion code).
CREATE OR REPLACE FUNCTION ip_is_denied(p_ip inet)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM ip_denylist
    WHERE p_ip <<= network
  );
$$;
