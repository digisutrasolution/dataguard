// API key management. Keys are shown in plaintext once at creation; only a
// SHA-256 hash is stored. Postgres when active, in-memory otherwise.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { dbActive, q } from '../../db/pool.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export interface ApiKeyView {
  id: string;
  label: string | null;
  key_prefix: string;
  rate_limit: number;
  is_active: boolean;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

interface KeyRecord extends ApiKeyView { customer_id: string; key_hash: string }
const num = (v: any) => Number(v ?? 0);
function view(r: any): ApiKeyView {
  return { id: r.id, label: r.label, key_prefix: r.key_prefix, rate_limit: num(r.rate_limit),
    is_active: r.is_active, last_used_at: r.last_used_at, request_count: num(r.request_count), created_at: r.created_at };
}

const mem = new Map<string, KeyRecord>();
const memLogs: any[] = [];

export async function createKey(customerId: string, label: string, rateLimit = 1000): Promise<{ plaintext: string; view: ApiKeyView }> {
  const raw = 'dg_live_' + randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  const hash = sha(raw);
  const prefix = raw.slice(0, 14) + '…';
  const id = randomUUID();
  if (dbActive()) {
    const { rows } = await q(
      `INSERT INTO api_keys (id, customer_id, label, key_prefix, key_hash, rate_limit, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [id, customerId, label, prefix, hash, rateLimit]);
    return { plaintext: raw, view: view(rows[0]) };
  }
  const rec: KeyRecord = { id, customer_id: customerId, label, key_prefix: prefix, key_hash: hash,
    rate_limit: rateLimit, is_active: true, last_used_at: null, request_count: 0, created_at: new Date().toISOString() };
  mem.set(id, rec);
  return { plaintext: raw, view: view(rec) };
}

export async function listKeys(customerId: string): Promise<ApiKeyView[]> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM api_keys WHERE customer_id=$1 ORDER BY created_at DESC`, [customerId]);
    return rows.map(view);
  }
  return [...mem.values()].filter((k) => k.customer_id === customerId).map(view);
}

export async function revokeKey(id: string, customerId: string): Promise<boolean> {
  if (dbActive()) {
    const r = await q(`UPDATE api_keys SET is_active=false WHERE id=$1 AND customer_id=$2`, [id, customerId]);
    return (r.rowCount ?? 0) > 0;
  }
  const k = mem.get(id);
  if (k && k.customer_id === customerId) { k.is_active = false; return true; }
  return false;
}

// Authenticate a presented key -> the owning customer. Updates usage counters.
export async function resolveKey(raw: string): Promise<{ customerId: string; id: string; rateLimit: number } | null> {
  const hash = sha(raw);
  if (dbActive()) {
    const { rows } = await q(`SELECT id, customer_id, rate_limit FROM api_keys WHERE key_hash=$1 AND is_active=true`, [hash]);
    if (!rows[0]) return null;
    void q(`UPDATE api_keys SET last_used_at=now(), request_count=request_count+1 WHERE id=$1`, [rows[0].id]).catch(() => {});
    return { customerId: rows[0].customer_id, id: rows[0].id, rateLimit: num(rows[0].rate_limit) };
  }
  const k = [...mem.values()].find((x) => x.key_hash === hash && x.is_active);
  if (!k) return null;
  k.last_used_at = new Date().toISOString(); k.request_count++;
  return { customerId: k.customer_id, id: k.id, rateLimit: k.rate_limit };
}

export async function logRequest(e: { keyId: string; customerId: string; method: string; path: string; status: number }): Promise<void> {
  try {
    if (dbActive()) { await q(`INSERT INTO api_logs (key_id, customer_id, method, path, status) VALUES ($1,$2,$3,$4,$5)`, [e.keyId, e.customerId, e.method, e.path, e.status]); return; }
    memLogs.unshift({ id: memLogs.length + 1, ...e, created_at: new Date().toISOString() });
    if (memLogs.length > 500) memLogs.pop();
  } catch { /* logging never breaks the request */ }
}

export async function listLogs(customerId: string, limit = 100) {
  if (dbActive()) {
    const { rows } = await q(`SELECT id, method, path, status, created_at FROM api_logs WHERE customer_id=$1 ORDER BY created_at DESC LIMIT $2`, [customerId, limit]);
    return rows;
  }
  return memLogs.filter((l) => l.customerId === customerId).slice(0, limit);
}
