// Wallet repository + pricing. Postgres when active (with a transactions ledger),
// in-memory Map otherwise.
import { dbActive, q } from '../../db/pool.js';

export interface Wallet {
  customerId: string;
  balance: number; // credits
}

// Per-number base rate by service. Detection hits a paid third-party API, so it
// carries the highest rate.
const SERVICE_RATES: Record<string, number> = {
  basic: 0.01,
  advanced: 0.02,
  premium: 0.05,
  detection: 0.08,
};

// Tiered/bulk pricing: credits per number drops as volume grows.
export function creditsFor(quantity: number, service = 'basic'): number {
  const base = SERVICE_RATES[service] ?? SERVICE_RATES.basic;
  let rate = base;
  if (quantity >= 100000) rate = base * 0.6;
  else if (quantity >= 10000) rate = base * 0.8;
  return Math.ceil(quantity * rate);
}

// ---- in-memory fallback ----
const mem = new Map<string, Wallet>([
  ['demo-customer', { customerId: 'demo-customer', balance: 512400 }],
]);

export async function getWallet(customerId: string): Promise<Wallet> {
  if (dbActive()) {
    const { rows } = await q('SELECT customer_id, balance FROM wallets WHERE customer_id = $1', [customerId]);
    if (rows[0]) return { customerId, balance: Number(rows[0].balance) };
    await q('INSERT INTO wallets (customer_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [customerId]);
    return { customerId, balance: 0 };
  }
  if (!mem.has(customerId)) mem.set(customerId, { customerId, balance: 0 });
  return mem.get(customerId)!;
}

export async function deduct(customerId: string, credits: number, ref?: string): Promise<Wallet> {
  if (dbActive()) {
    // Atomic guarded debit: only succeeds if balance is sufficient.
    const { rows } = await q(
      `UPDATE wallets SET balance = balance - $2, updated_at = now()
       WHERE customer_id = $1 AND balance >= $2 RETURNING balance`,
      [customerId, credits],
    );
    if (!rows[0]) throw new Error('INSUFFICIENT_BALANCE');
    const balance = Number(rows[0].balance);
    await q(
      `INSERT INTO transactions (customer_id, type, amount, balance_after, ref)
       VALUES ($1,'debit',$2,$3,$4)`,
      [customerId, credits, balance, ref ?? null],
    );
    return { customerId, balance };
  }
  const w = await getWallet(customerId);
  if (w.balance < credits) throw new Error('INSUFFICIENT_BALANCE');
  w.balance -= credits;
  return w;
}

export async function recharge(customerId: string, credits: number, ref?: string): Promise<Wallet> {
  if (dbActive()) {
    await q('INSERT INTO wallets (customer_id, balance) VALUES ($1,0) ON CONFLICT DO NOTHING', [customerId]);
    const { rows } = await q(
      `UPDATE wallets SET balance = balance + $2, updated_at = now()
       WHERE customer_id = $1 RETURNING balance`,
      [customerId, credits],
    );
    const balance = Number(rows[0].balance);
    await q(
      `INSERT INTO transactions (customer_id, type, amount, balance_after, ref)
       VALUES ($1,'recharge',$2,$3,$4)`,
      [customerId, credits, balance, ref ?? null],
    );
    return { customerId, balance };
  }
  const w = await getWallet(customerId);
  w.balance += credits;
  return w;
}
