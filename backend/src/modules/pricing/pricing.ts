// DB-driven pricing. Resolves the most specific matching rule (customer >
// country > global; highest matching bulk tier). Falls back to the static
// creditsFor() rates when no DB or no rule matches.
import { dbActive, q } from '../../db/pool.js';
import { creditsFor } from '../wallet/wallet.js';

export interface PricingRule {
  id: string;
  service: string;
  iso2: string | null;
  customer_id: string | null;
  min_qty: number;
  credits_per_number: number;
  active: boolean;
}

const num = (v: any) => Number(v ?? 0);
function row(r: any): PricingRule {
  return { id: r.id, service: r.service, iso2: r.iso2, customer_id: r.customer_id, min_qty: num(r.min_qty), credits_per_number: num(r.credits_per_number), active: r.active };
}

// Credits charged for `qty` numbers of `service`, honoring country/customer rules.
export async function priceFor(
  service: string, qty: number, opts: { country?: string | null; customerId?: string | null } = {},
): Promise<number> {
  if (!dbActive()) return creditsFor(qty, service);
  const { rows } = await q(
    `SELECT * FROM pricing_rules
     WHERE active AND service = $1 AND min_qty <= $2
       AND (customer_id = $3 OR customer_id IS NULL)
       AND (iso2 = $4 OR iso2 IS NULL)
     ORDER BY (customer_id IS NOT NULL) DESC, (iso2 IS NOT NULL) DESC, min_qty DESC
     LIMIT 1`,
    [service, qty, opts.customerId ?? null, opts.country ?? null],
  );
  if (!rows[0]) return creditsFor(qty, service);
  return Math.ceil(qty * num(rows[0].credits_per_number));
}

export async function listRules(): Promise<PricingRule[]> {
  if (!dbActive()) return [];
  const { rows } = await q(`SELECT * FROM pricing_rules ORDER BY service, customer_id NULLS FIRST, iso2 NULLS FIRST, min_qty`);
  return rows.map(row);
}

export async function createRule(input: { service: string; iso2?: string | null; customerId?: string | null; minQty?: number; creditsPerNumber: number }): Promise<PricingRule | null> {
  if (!dbActive()) return null;
  const { rows } = await q(
    `INSERT INTO pricing_rules (service, iso2, customer_id, min_qty, credits_per_number)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.service, input.iso2 ?? null, input.customerId ?? null, input.minQty ?? 0, input.creditsPerNumber]);
  return row(rows[0]);
}

export async function updateRule(id: string, patch: { creditsPerNumber?: number; minQty?: number; active?: boolean }): Promise<PricingRule | null> {
  if (!dbActive()) return null;
  const { rows } = await q(
    `UPDATE pricing_rules SET
       credits_per_number = COALESCE($2, credits_per_number),
       min_qty = COALESCE($3, min_qty),
       active = COALESCE($4, active),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, patch.creditsPerNumber ?? null, patch.minQty ?? null, patch.active ?? null]);
  return rows[0] ? row(rows[0]) : null;
}

export async function deleteRule(id: string): Promise<boolean> {
  if (!dbActive()) return false;
  const r = await q(`DELETE FROM pricing_rules WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
