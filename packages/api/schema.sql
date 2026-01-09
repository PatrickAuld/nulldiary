-- AI Post Secret Database Schema
-- Cloudflare D1 (SQLite)

-- Core submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,                    -- ULID for sortable unique IDs
    message TEXT NOT NULL,
    message_length INTEGER NOT NULL,

    -- Submitter-provided metadata
    author TEXT,
    model TEXT,
    tags TEXT,                              -- JSON array
    context TEXT,

    -- Full HTTP request (JSON blob)
    request_method TEXT NOT NULL,           -- GET or POST
    request_url TEXT NOT NULL,              -- Full URL
    request_path TEXT NOT NULL,             -- Path portion
    request_query_string TEXT,              -- Raw query string
    request_query_params TEXT,              -- JSON object
    request_headers TEXT NOT NULL,          -- JSON object of all headers
    request_body_raw TEXT,                  -- Raw body (POST only, truncated 16KB)
    request_body_parsed TEXT,               -- Parsed body as JSON (if applicable)
    request_content_type TEXT,
    request_content_length INTEGER,

    -- Cloudflare metadata (extracted from cf object)
    cf_ip_hash TEXT NOT NULL,               -- SHA-256 of IP, first 16 chars
    cf_country TEXT,
    cf_city TEXT,
    cf_region TEXT,
    cf_region_code TEXT,
    cf_postal_code TEXT,
    cf_latitude TEXT,
    cf_longitude TEXT,
    cf_timezone TEXT,
    cf_asn INTEGER,
    cf_as_organization TEXT,
    cf_colo TEXT,
    cf_continent TEXT,
    cf_http_protocol TEXT,
    cf_tls_version TEXT,
    cf_tls_cipher TEXT,
    cf_bot_score INTEGER,                   -- Bot management score if available
    cf_verified_bot INTEGER,                -- 1 if verified bot
    cf_raw TEXT,                            -- Full cf object as JSON

    -- Derived request metadata
    user_agent TEXT,                        -- Extracted for convenience
    referer TEXT,
    origin TEXT,
    accept_language TEXT,

    -- Moderation workflow
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, spam
    submitted_at TEXT NOT NULL,             -- ISO 8601
    processing_time_ms INTEGER,
    moderated_at TEXT,
    moderated_by TEXT,
    moderation_notes TEXT,

    -- Publication
    published_at TEXT,
    slug TEXT UNIQUE,                       -- URL-friendly identifier
    featured INTEGER DEFAULT 0              -- 1 if featured on homepage
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_published_at ON submissions(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_ip_hash ON submissions(cf_ip_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_model ON submissions(model);
CREATE INDEX IF NOT EXISTS idx_submissions_slug ON submissions(slug);
CREATE INDEX IF NOT EXISTS idx_submissions_method ON submissions(request_method);
CREATE INDEX IF NOT EXISTS idx_submissions_country ON submissions(cf_country);
CREATE INDEX IF NOT EXISTS idx_submissions_asn ON submissions(cf_asn);
CREATE INDEX IF NOT EXISTS idx_submissions_bot_score ON submissions(cf_bot_score);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limits (
    ip_hash TEXT NOT NULL,
    window TEXT NOT NULL,                   -- e.g., "2024-01-15-14" for hourly
    count INTEGER DEFAULT 1,
    PRIMARY KEY (ip_hash, window)
);

-- Blocked IPs/patterns
CREATE TABLE IF NOT EXISTS blocklist (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,                  -- IP hash or pattern
    reason TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT
);

-- Moderation audit log
CREATE TABLE IF NOT EXISTS moderation_log (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    action TEXT NOT NULL,                   -- approved, rejected, spam, unreviewed
    moderator TEXT NOT NULL,
    notes TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

-- Build tracking
CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    triggered_at TEXT NOT NULL,
    triggered_by TEXT,                      -- moderator or "scheduled"
    status TEXT NOT NULL,                   -- pending, building, complete, failed
    completed_at TEXT,
    posts_included INTEGER,
    cloudflare_deployment_id TEXT
);

-- Request log (for debugging, can be purged periodically)
-- Stores requests that failed validation or were rate-limited
CREATE TABLE IF NOT EXISTS request_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    request_method TEXT NOT NULL,
    request_url TEXT NOT NULL,
    request_headers TEXT NOT NULL,
    request_body_raw TEXT,
    cf_ip_hash TEXT NOT NULL,
    cf_country TEXT,
    cf_raw TEXT,
    outcome TEXT NOT NULL,                  -- rate_limited, validation_failed, blocked, error
    outcome_reason TEXT,
    processing_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_request_log_timestamp ON request_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_log_ip_hash ON request_log(cf_ip_hash);
CREATE INDEX IF NOT EXISTS idx_request_log_outcome ON request_log(outcome);
