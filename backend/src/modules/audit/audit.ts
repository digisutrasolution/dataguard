// Audit / activity log. Writes to the audit_logs table (Postgres) or an
// in-memory ring otherwise. Logging never throws — failures are swallowed so
// they can't break the request that triggered them.
import { dbActive, q } from '../../db/pool.js';

export interface AuditEntry {
  actor?: string | null;
  customerId?: string | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  device?: string | null;
}

const mem: (AuditEntry & { id: number; created_at: string })[] = [];

export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    if (dbActive()) {
      await q(
        `INSERT INTO audit_logs (actor, customer_id, action, target, ip, device)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [e.actor ?? null, e.customerId ?? null, e.action, e.target ?? null, e.ip ?? null, e.device ?? null],
      );
      return;
    }
    mem.unshift({ ...e, id: mem.length + 1, created_at: new Date().toISOString() });
    if (mem.length > 200) mem.pop();
  } catch {
    // never let audit logging break the caller
  }
}

export async function listAuditByActor(actor: string, limit = 30) {
  if (dbActive()) {
    const { rows } = await q(
      `SELECT id, actor, customer_id, action, target, ip, device, created_at
       FROM audit_logs WHERE actor = $1 ORDER BY created_at DESC LIMIT $2`, [actor, limit]);
    return rows;
  }
  return mem.filter((l) => l.actor === actor).slice(0, limit);
}

export async function listAudit(limit = 50) {
  if (dbActive()) {
    const { rows } = await q(
      `SELECT id, actor, customer_id, action, target, ip, device, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
  return mem.slice(0, limit);
}
