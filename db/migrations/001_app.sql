-- App-aligned migration: the runnable subset the API uses today.
-- (db/schema.sql remains the full enterprise reference schema.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS customers (
    id           TEXT PRIMARY KEY,
    company_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL,
    customer_id   TEXT,
    totp_secret   TEXT,
    twofa_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
    customer_id TEXT PRIMARY KEY,
    balance     NUMERIC(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id            BIGSERIAL PRIMARY KEY,
    customer_id   TEXT NOT NULL,
    type          TEXT NOT NULL,                 -- recharge|debit
    amount        NUMERIC(18,4) NOT NULL,
    balance_after NUMERIC(18,4) NOT NULL,
    ref           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS detection_providers (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    type      TEXT NOT NULL,                     -- mock|http|apify
    enabled   BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT false,
    settings  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS validation_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   TEXT NOT NULL,
    service       TEXT NOT NULL,
    total_records BIGINT NOT NULL DEFAULT 0,
    valid_count   BIGINT NOT NULL DEFAULT 0,
    invalid_count BIGINT NOT NULL DEFAULT 0,
    dup_count     BIGINT NOT NULL DEFAULT 0,
    credits_used  NUMERIC(18,4) NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'completed',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON validation_jobs(customer_id, created_at DESC);
