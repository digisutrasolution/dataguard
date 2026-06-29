-- Crypto payment gateway: extend crypto_transactions for the full lifecycle.
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS provider               TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS external_id            TEXT;
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS amount_usd             NUMERIC(18,2);
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS required_confirmations INT NOT NULL DEFAULT 12;
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS expires_at             TIMESTAMPTZ;
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS credited               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT now();
-- status values: pending | confirming | confirmed | completed | failed | expired
