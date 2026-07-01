-- API platform: real hashed keys + request logs.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash      TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS request_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON api_keys(key_hash);

CREATE TABLE IF NOT EXISTS api_logs (
    id          BIGSERIAL PRIMARY KEY,
    key_id      UUID,
    customer_id TEXT,
    method      TEXT,
    path        TEXT,
    status      INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apilogs_customer ON api_logs(customer_id, created_at DESC);
