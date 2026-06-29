-- DB-driven pricing rules + invoices.
CREATE TABLE IF NOT EXISTS pricing_rules (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service            TEXT NOT NULL,                 -- basic|advanced|premium|detection
    iso2               TEXT,                          -- NULL = all countries
    customer_id        TEXT,                          -- NULL = standard (all customers)
    min_qty            BIGINT NOT NULL DEFAULT 0,     -- bulk tier threshold
    credits_per_number NUMERIC(12,6) NOT NULL,
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_lookup ON pricing_rules(service, min_qty);

CREATE TABLE IF NOT EXISTS invoices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number      TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    payment_id  TEXT,
    coin        TEXT,
    amount_usd  NUMERIC(18,2) NOT NULL,
    credits     BIGINT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'paid',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id, created_at DESC);

-- Seed standard pricing (reproduces the previous hardcoded rates + bulk tiers).
-- Guarded so re-running migrations never duplicates the standard rules.
INSERT INTO pricing_rules (service, min_qty, credits_per_number)
SELECT * FROM (VALUES
  ('basic',0,0.01),('basic',10000,0.008),('basic',100000,0.006),
  ('advanced',0,0.02),('advanced',10000,0.016),('advanced',100000,0.012),
  ('premium',0,0.05),('premium',10000,0.04),('premium',100000,0.03),
  ('detection',0,0.08),('detection',10000,0.064),('detection',100000,0.048)
) AS v(service, min_qty, credits_per_number)
WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE customer_id IS NULL AND iso2 IS NULL);
