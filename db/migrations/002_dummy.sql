-- Adds the dimensions/tables the dashboards & reports read for dummy data.
ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS country TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_country ON validation_jobs(country);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON validation_jobs(created_at);

CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  TEXT NOT NULL,
    label        TEXT,
    key_prefix   TEXT NOT NULL,          -- display only, e.g. dg_live_a1b2…
    rate_limit   INT NOT NULL DEFAULT 1000,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crypto_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   TEXT NOT NULL,
    coin          TEXT NOT NULL,         -- USDT|BTC|ETH|TRX
    address       TEXT NOT NULL,
    tx_hash       TEXT,
    amount        NUMERIC(24,8),
    credits       NUMERIC(18,4),
    confirmations INT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|failed|expired|completed
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crypto_customer ON crypto_transactions(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor       TEXT,
    customer_id TEXT,
    action      TEXT NOT NULL,
    target      TEXT,
    ip          TEXT,
    device      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
