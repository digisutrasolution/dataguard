// Invoices: generated when a payment completes. Postgres or in-memory.
import { randomUUID } from 'node:crypto';
import { dbActive, q } from '../../db/pool.js';

export interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  payment_id: string | null;
  coin: string | null;
  amount_usd: number;
  credits: number;
  status: string;
  created_at: string;
}

const num = (v: any) => Number(v ?? 0);
function row(r: any): Invoice {
  return { id: r.id, number: r.number, customer_id: r.customer_id, payment_id: r.payment_id, coin: r.coin, amount_usd: num(r.amount_usd), credits: num(r.credits), status: r.status, created_at: r.created_at };
}
function genNumber(): string {
  return 'INV-' + new Date().toISOString().slice(0, 7).replace('-', '') + '-' + randomUUID().slice(0, 6).toUpperCase();
}

const mem: Invoice[] = [];

export async function createInvoiceForPayment(p: { id: string; customerId: string; coin: string; amountUsd: number; credits: number }): Promise<void> {
  const number = genNumber();
  if (dbActive()) {
    await q(
      `INSERT INTO invoices (number, customer_id, payment_id, coin, amount_usd, credits, status)
       VALUES ($1,$2,$3,$4,$5,$6,'paid')`,
      [number, p.customerId, p.id, p.coin, p.amountUsd, p.credits]);
    return;
  }
  mem.unshift({ id: randomUUID(), number, customer_id: p.customerId, payment_id: p.id, coin: p.coin, amount_usd: p.amountUsd, credits: p.credits, status: 'paid', created_at: new Date().toISOString() });
}

export async function listInvoices(customerId: string, limit = 50): Promise<Invoice[]> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM invoices WHERE customer_id=$1 ORDER BY created_at DESC LIMIT $2`, [customerId, limit]);
    return rows.map(row);
  }
  return mem.filter((i) => i.customer_id === customerId).slice(0, limit);
}

export async function getInvoice(id: string, customerId: string): Promise<Invoice | null> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM invoices WHERE id=$1 AND customer_id=$2`, [id, customerId]);
    return rows[0] ? row(rows[0]) : null;
  }
  return mem.find((i) => i.id === id && i.customer_id === customerId) ?? null;
}
