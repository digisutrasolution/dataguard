// Validation job history. Persists a summary row per bulk run (Postgres),
// falls back to an in-memory ring buffer otherwise.
import { dbActive, q } from '../../db/pool.js';

export interface JobSummary {
  customerId: string;
  service: string;
  total: number;
  valid: number;
  invalid: number;
  dup: number;
  creditsUsed: number;
}

const mem: (JobSummary & { id: string; createdAt: string })[] = [];

export async function recordJob(j: JobSummary): Promise<void> {
  if (dbActive()) {
    await q(
      `INSERT INTO validation_jobs
        (customer_id, service, total_records, valid_count, invalid_count, dup_count, credits_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [j.customerId, j.service, j.total, j.valid, j.invalid, j.dup, j.creditsUsed],
    );
    return;
  }
  mem.unshift({ ...j, id: `mem-${mem.length + 1}`, createdAt: new Date().toISOString() });
  if (mem.length > 100) mem.pop();
}

export async function listJobs(customerId: string, limit = 20) {
  if (dbActive()) {
    const { rows } = await q(
      `SELECT id, service, total_records, valid_count, invalid_count, dup_count, credits_used, status, created_at
       FROM validation_jobs WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [customerId, limit],
    );
    return rows;
  }
  return mem.filter((j) => j.customerId === customerId).slice(0, limit);
}
