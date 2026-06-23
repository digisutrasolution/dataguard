// Aggregate queries for dashboards & reports. Read-only; Postgres only.
import { dbActive, q } from '../../db/pool.js';

const CREDIT_USD = 0.0025; // display rate: credits → USD revenue

const num = (v: any) => Number(v ?? 0);

export async function adminStats() {
  if (!dbActive()) return null;
  const { rows: t } = await q(`SELECT
     (SELECT count(*) FROM customers)                                   AS customers,
     (SELECT count(*) FROM users)                                       AS users,
     (SELECT coalesce(sum(amount),0) FROM transactions WHERE type='recharge') AS credits_sold,
     (SELECT coalesce(sum(total_records),0) FROM validation_jobs)       AS numbers_validated,
     (SELECT coalesce(sum(valid_count),0) FROM validation_jobs)         AS valid,
     (SELECT count(*) FROM validation_jobs)                             AS jobs`);
  const s = t[0];
  const creditsSold = num(s.credits_sold);
  const numbers = num(s.numbers_validated);
  const valid = num(s.valid);

  const { rows: daily } = await q(
    `SELECT to_char(created_at::date,'MM-DD') AS d, sum(total_records) AS n
     FROM validation_jobs WHERE created_at > now() - interval '14 days'
     GROUP BY created_at::date ORDER BY created_at::date`);
  const { rows: monthly } = await q(
    `SELECT to_char(date_trunc('month',created_at),'Mon') AS m, sum(amount) AS c
     FROM transactions WHERE type='recharge' AND created_at > now() - interval '6 months'
     GROUP BY date_trunc('month',created_at) ORDER BY date_trunc('month',created_at)`);
  const { rows: countries } = await q(
    `SELECT country, sum(total_records) AS n FROM validation_jobs
     WHERE country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 6`);
  const { rows: services } = await q(
    `SELECT service, count(*) AS jobs, sum(total_records) AS n FROM validation_jobs
     GROUP BY service ORDER BY n DESC`);

  return {
    customers: num(s.customers),
    activeUsers: num(s.users),
    creditsSold,
    revenueUsd: Math.round(creditsSold * CREDIT_USD),
    numbersValidated: numbers,
    jobs: num(s.jobs),
    successRate: numbers ? Math.round((valid / numbers) * 1000) / 10 : 0,
    dailyUsage: daily.map((r) => ({ d: r.d, n: num(r.n) })),
    monthlyRevenue: monthly.map((r) => ({ m: r.m, usd: Math.round(num(r.c) * CREDIT_USD) })),
    topCountries: countries.map((r) => ({ country: r.country, n: num(r.n) })),
    servicePerformance: services.map((r) => ({ service: r.service, jobs: num(r.jobs), n: num(r.n) })),
  };
}

export async function adminCustomers() {
  if (!dbActive()) return [];
  const { rows } = await q(
    `SELECT c.id, c.company_name,
            coalesce(w.balance,0)                  AS balance,
            coalesce(sum(j.total_records),0)       AS numbers,
            coalesce(sum(j.credits_used),0)        AS spent,
            count(j.id)                            AS jobs,
            max(j.created_at)                      AS last_activity
     FROM customers c
     LEFT JOIN wallets w ON w.customer_id = c.id
     LEFT JOIN validation_jobs j ON j.customer_id = c.id
     GROUP BY c.id, c.company_name, w.balance
     ORDER BY numbers DESC`);
  return rows.map((r) => ({
    id: r.id,
    company: r.company_name,
    balance: num(r.balance),
    numbers: num(r.numbers),
    spent: num(r.spent),
    jobs: num(r.jobs),
    lastActivity: r.last_activity,
  }));
}

export async function customerStats(customerId: string) {
  if (!dbActive()) return null;
  const { rows } = await q(
    `SELECT coalesce(sum(total_records),0) AS numbers,
            coalesce(sum(valid_count),0)   AS valid,
            coalesce(sum(credits_used),0)  AS spent,
            count(*)                       AS jobs
     FROM validation_jobs
     WHERE customer_id = $1 AND created_at > date_trunc('month', now())`,
    [customerId]);
  const s = rows[0];
  const numbers = num(s.numbers);
  return {
    numbersThisMonth: numbers,
    successRate: numbers ? Math.round((num(s.valid) / numbers) * 1000) / 10 : 0,
    creditsSpent: num(s.spent),
    jobs: num(s.jobs),
  };
}
