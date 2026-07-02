-- Resellers + commissions.
CREATE TABLE IF NOT EXISTS resellers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    email           CITEXT UNIQUE,
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20,   -- 0..1 (e.g. 0.20 = 20%)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_reseller ON customers(reseller_id);

-- Demo reseller + assign a few customers so commission data shows immediately (guarded).
INSERT INTO resellers (name, email, commission_rate)
SELECT 'Nexus Partners', 'partner@nexus.example', 0.20
WHERE NOT EXISTS (SELECT 1 FROM resellers);

UPDATE customers SET reseller_id = (SELECT id FROM resellers ORDER BY created_at LIMIT 1)
WHERE reseller_id IS NULL
  AND id IN (SELECT id FROM customers ORDER BY created_at LIMIT 4);
