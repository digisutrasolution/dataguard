-- DataGuard Solutions — Enterprise schema (PostgreSQL 15+)
-- Designed for billions of records: partitioning + sharding-ready keys + indexes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ TENANCY & IDENTITY ============
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    TEXT NOT NULL,
    email           CITEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',   -- active|suspended|closed
    custom_pricing  JSONB,                            -- per-customer overrides
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE, -- NULL = system role
    name         TEXT NOT NULL,
    is_system    BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE permissions (
    id    SERIAL PRIMARY KEY,
    key   TEXT UNIQUE NOT NULL          -- e.g. 'validation.run', 'wallet.recharge'
);

CREATE TABLE role_permissions (
    role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT  REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,  -- NULL = platform admin
    role_id       UUID REFERENCES roles(id),
    email         CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    totp_secret   TEXT,                                  -- 2FA
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_customer ON users(customer_id);

-- ============ COUNTRY / PHONE RULES ============
CREATE TABLE countries (
    iso2        CHAR(2) PRIMARY KEY,
    name        TEXT NOT NULL,
    prefix      TEXT NOT NULL                            -- '+91'
);

CREATE TABLE phone_rules (
    id              SERIAL PRIMARY KEY,
    iso2            CHAR(2) REFERENCES countries(iso2),
    number_type     TEXT NOT NULL,                       -- mobile|landline|tollfree
    min_len         INT NOT NULL,
    max_len         INT NOT NULL,
    pattern         TEXT,                                -- regex (national significant number)
    carrier_prefix  TEXT[]                               -- known operator prefixes
);
CREATE INDEX idx_phone_rules_iso ON phone_rules(iso2);

-- ============ SERVICES & PRICING ============
CREATE TABLE services (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,                    -- basic|advanced|premium|...
    name        TEXT NOT NULL,
    tier        TEXT NOT NULL,
    features    JSONB NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE pricing_rules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id    UUID REFERENCES services(id),
    iso2          CHAR(2),                               -- NULL = global
    min_qty       BIGINT NOT NULL DEFAULT 0,             -- tiered/bulk thresholds
    credits_each  NUMERIC(12,6) NOT NULL,                -- credits per number
    customer_id   UUID REFERENCES customers(id)          -- NULL = standard
);
CREATE INDEX idx_pricing_lookup ON pricing_rules(service_id, iso2, min_qty);

-- ============ WALLET & BILLING ============
CREATE TABLE wallets (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    balance     NUMERIC(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
    id          BIGSERIAL,
    customer_id UUID NOT NULL,
    type        TEXT NOT NULL,                           -- recharge|debit|refund
    amount      NUMERIC(18,4) NOT NULL,
    balance_after NUMERIC(18,4) NOT NULL,
    ref         TEXT,                                    -- job id / payment id
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_tx_customer ON transactions(customer_id, created_at DESC);

CREATE TABLE crypto_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers(id),
    coin          TEXT NOT NULL,                         -- USDT|BTC|ETH|TRX
    address       TEXT NOT NULL,
    tx_hash       TEXT,
    amount        NUMERIC(24,8),
    confirmations INT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',       -- pending|confirmed|credited
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ JOBS & RESULTS (billions) ============
CREATE TABLE validation_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers(id),
    service_id    UUID NOT NULL REFERENCES services(id),
    file_name     TEXT,
    total_records BIGINT NOT NULL DEFAULT 0,
    processed     BIGINT NOT NULL DEFAULT 0,
    valid_count   BIGINT NOT NULL DEFAULT 0,
    invalid_count BIGINT NOT NULL DEFAULT 0,
    dup_count     BIGINT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'queued',        -- queued|running|completed|failed|paused
    credits_used  NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_customer ON validation_jobs(customer_id, created_at DESC);

-- High-volume: range-partition by created_at, hash sub-shard by job_id at app layer.
CREATE TABLE validation_results (
    job_id      UUID NOT NULL,
    raw_input   TEXT NOT NULL,
    e164        TEXT,
    iso2        CHAR(2),
    number_type TEXT,
    status      TEXT NOT NULL,                           -- valid|invalid|duplicate
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_results_job ON validation_results(job_id);

CREATE TABLE generated_numbers (
    id          BIGSERIAL,
    customer_id UUID NOT NULL,
    iso2        CHAR(2) NOT NULL,
    e164        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============ API & LOGGING ============
CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    key_hash    TEXT NOT NULL,                           -- store hash only
    label       TEXT,
    rate_limit  INT NOT NULL DEFAULT 1000,               -- req/min
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_apikeys_customer ON api_keys(customer_id);

CREATE TABLE audit_logs (
    id          BIGSERIAL,
    actor_id    UUID,
    customer_id UUID,
    action      TEXT NOT NULL,
    target      TEXT,
    meta        JSONB,
    ip          INET,
    device      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_audit_customer ON audit_logs(customer_id, created_at DESC);

CREATE TABLE payment_logs (
    id          BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL,
    provider    TEXT NOT NULL,
    tx_id       TEXT,
    amount      NUMERIC(18,4),
    status      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Example monthly partitions (automate via pg_partman in production)
CREATE TABLE validation_results_2026_06 PARTITION OF validation_results
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE transactions_2026_06 PARTITION OF transactions
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE generated_numbers_2026_06 PARTITION OF generated_numbers
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
