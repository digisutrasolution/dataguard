// Crypto payment lifecycle: create -> confirming -> confirmed -> completed
// (wallet credited, exactly once). Postgres when active, in-memory otherwise.
// The mock provider self-drives confirmations to demo the full flow.
import { randomUUID } from 'node:crypto';
import { dbActive, q } from '../../db/pool.js';
import { recharge } from '../wallet/wallet.js';
import { getCryptoProvider, type Coin } from './provider.js';

export type PaymentStatus = 'pending' | 'confirming' | 'confirmed' | 'completed' | 'failed' | 'expired';

export interface Payment {
  id: string;
  customer_id: string;
  coin: Coin;
  address: string;
  amount: number;        // coin amount
  amount_usd: number;
  credits: number;
  confirmations: number;
  required_confirmations: number;
  status: PaymentStatus;
  tx_hash: string | null;
  provider: string;
  expires_at: string | null;
  credited: boolean;
  created_at: string;
  updated_at: string;
}

const num = (v: any) => Number(v ?? 0);
function row(r: any): Payment {
  return {
    id: r.id, customer_id: r.customer_id, coin: r.coin, address: r.address,
    amount: num(r.amount), amount_usd: num(r.amount_usd), credits: num(r.credits),
    confirmations: num(r.confirmations), required_confirmations: num(r.required_confirmations),
    status: r.status, tx_hash: r.tx_hash, provider: r.provider, expires_at: r.expires_at,
    credited: r.credited, created_at: r.created_at, updated_at: r.updated_at,
  };
}

const mem = new Map<string, Payment>();

export async function createPayment(input: { customerId: string; coin: Coin; credits: number }): Promise<Payment> {
  const provider = getCryptoProvider();
  const pr = await provider.createPayment(input);
  const id = randomUUID();
  if (dbActive()) {
    await q(
      `INSERT INTO crypto_transactions
        (id, customer_id, coin, address, amount, amount_usd, credits, confirmations,
         required_confirmations, status, provider, external_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,'pending',$9,$10,$11)`,
      [id, input.customerId, input.coin, pr.address, pr.amountCoin, pr.amountUsd, input.credits,
       pr.requiredConfirmations, provider.name, pr.externalId, pr.expiresAt],
    );
  } else {
    const now = new Date().toISOString();
    mem.set(id, {
      id, customer_id: input.customerId, coin: input.coin, address: pr.address, amount: pr.amountCoin,
      amount_usd: pr.amountUsd, credits: input.credits, confirmations: 0,
      required_confirmations: pr.requiredConfirmations, status: 'pending', tx_hash: null,
      provider: provider.name, expires_at: pr.expiresAt, credited: false, created_at: now, updated_at: now,
    });
  }
  if (provider.simulated) scheduleMockConfirm(id, pr.requiredConfirmations);
  return (await getPayment(id))!;
}

export async function getPayment(id: string): Promise<Payment | null> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM crypto_transactions WHERE id=$1`, [id]);
    return rows[0] ? row(rows[0]) : null;
  }
  return mem.get(id) ?? null;
}

export async function listPayments(customerId: string, limit = 20): Promise<Payment[]> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM crypto_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT $2`, [customerId, limit]);
    return rows.map(row);
  }
  return [...mem.values()].filter((p) => p.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

async function setConfirmations(id: string, conf: number, status: PaymentStatus): Promise<void> {
  if (dbActive()) { await q(`UPDATE crypto_transactions SET confirmations=$2, status=$3, updated_at=now() WHERE id=$1 AND credited=false`, [id, conf, status]); return; }
  const p = mem.get(id); if (p && !p.credited) { p.confirmations = conf; p.status = status; p.updated_at = new Date().toISOString(); }
}

// Idempotent completion: credits the wallet exactly once.
export async function completePayment(id: string, txHash?: string): Promise<Payment | null> {
  if (dbActive()) {
    const { rows } = await q(
      `UPDATE crypto_transactions
       SET status='completed', credited=true, confirmations=required_confirmations,
           tx_hash=COALESCE($2,tx_hash), updated_at=now()
       WHERE id=$1 AND credited=false
       RETURNING customer_id, credits`,
      [id, txHash ?? null]);
    if (rows[0]) await recharge(rows[0].customer_id, Number(rows[0].credits), `crypto:${id}`);
  } else {
    const p = mem.get(id);
    if (p && !p.credited) {
      p.credited = true; p.status = 'completed'; p.confirmations = p.required_confirmations;
      if (txHash) p.tx_hash = txHash; p.updated_at = new Date().toISOString();
      await recharge(p.customer_id, p.credits, `crypto:${id}`);
    }
  }
  return getPayment(id);
}

// Mock blockchain: advance confirmations over a few ticks, then complete.
function scheduleMockConfirm(id: string, required: number): void {
  let conf = 0;
  const step = Math.max(1, Math.ceil(required / 4));
  const tick = async () => {
    conf += step;
    if (conf >= required) {
      await completePayment(id, '0x' + randomUUID().replace(/-/g, ''));
    } else {
      await setConfirmations(id, conf, 'confirming');
      setTimeout(tick, 1500);
    }
  };
  setTimeout(tick, 1500);
}
