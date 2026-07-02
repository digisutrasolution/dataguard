// Resellers + commission tracking. Commission = a reseller's assigned customers'
// credit spend × credit-USD × the reseller's commission rate. Postgres only.
import { dbActive, q } from '../../db/pool.js';

const CREDIT_USD = 0.0025;
const num = (v: any) => Number(v ?? 0);

export interface Reseller {
  id: string;
  name: string;
  email: string | null;
  commission_rate: number;
  customers: number;
  credits: number;
  commission_usd: number;
  created_at: string;
}

export async function listResellers(): Promise<Reseller[]> {
  if (!dbActive()) return [];
  const { rows } = await q(
    `SELECT r.id, r.name, r.email, r.commission_rate, r.created_at,
            count(DISTINCT c.id)                          AS customers,
            coalesce(sum(j.credits_used),0)               AS credits
     FROM resellers r
     LEFT JOIN customers c ON c.reseller_id = r.id
     LEFT JOIN validation_jobs j ON j.customer_id = c.id
     GROUP BY r.id ORDER BY r.name`);
  return rows.map((r) => ({
    id: r.id, name: r.name, email: r.email, commission_rate: num(r.commission_rate),
    customers: num(r.customers), credits: num(r.credits),
    commission_usd: Math.round(num(r.credits) * CREDIT_USD * num(r.commission_rate) * 100) / 100,
    created_at: r.created_at,
  }));
}

export async function createReseller(name: string, email: string | null, rate: number) {
  if (!dbActive()) return null;
  const { rows } = await q(
    `INSERT INTO resellers (name, email, commission_rate) VALUES ($1,$2,$3) RETURNING id, name, email, commission_rate, created_at`,
    [name, email, rate]);
  return rows[0];
}

export async function updateReseller(id: string, rate: number) {
  if (!dbActive()) return null;
  const { rows } = await q(`UPDATE resellers SET commission_rate=$2 WHERE id=$1 RETURNING id`, [id, rate]);
  return rows[0] ? { ok: true } : null;
}

export async function deleteReseller(id: string): Promise<boolean> {
  if (!dbActive()) return false;
  const r = await q(`DELETE FROM resellers WHERE id=$1`, [id]); // customers.reseller_id -> NULL (FK)
  return (r.rowCount ?? 0) > 0;
}

// Customers assigned to a reseller, with per-customer commission.
export async function resellerCustomers(id: string) {
  if (!dbActive()) return [];
  const { rows } = await q(
    `SELECT c.id, c.company_name, r.commission_rate,
            coalesce(sum(j.total_records),0) AS numbers,
            coalesce(sum(j.credits_used),0)  AS spent
     FROM customers c
     JOIN resellers r ON r.id = c.reseller_id
     LEFT JOIN validation_jobs j ON j.customer_id = c.id
     WHERE c.reseller_id = $1
     GROUP BY c.id, c.company_name, r.commission_rate ORDER BY spent DESC`, [id]);
  return rows.map((c) => ({
    id: c.id, company: c.company_name, numbers: num(c.numbers), spent: num(c.spent),
    commission_usd: Math.round(num(c.spent) * CREDIT_USD * num(c.commission_rate) * 100) / 100,
  }));
}

// All customers + which reseller (if any) they belong to — for the assign UI.
export async function customersWithReseller() {
  if (!dbActive()) return [];
  const { rows } = await q(`SELECT id, company_name AS company, reseller_id FROM customers ORDER BY company_name`);
  return rows;
}

export async function assignCustomer(customerId: string, resellerId: string | null) {
  if (!dbActive()) return false;
  const r = await q(`UPDATE customers SET reseller_id=$2 WHERE id=$1`, [customerId, resellerId]);
  return (r.rowCount ?? 0) > 0;
}
