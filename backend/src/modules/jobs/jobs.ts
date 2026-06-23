// Validation/detection job store. Postgres when active, in-memory Map otherwise.
// Supports the async lifecycle: queued -> running -> completed | failed, with
// live progress (processed count) and a small result sample for preview.
import { randomUUID } from 'node:crypto';
import { dbActive, q } from '../../db/pool.js';

export type JobType = 'validation' | 'detection';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  customer_id: string;
  job_type: JobType;
  service: string;
  status: JobStatus;
  total_records: number;
  processed: number;
  valid_count: number;
  invalid_count: number;
  dup_count: number;
  credits_used: number;
  priority: number;
  country: string | null;
  sample: unknown[] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const num = (v: any) => Number(v ?? 0);
function rowToJob(r: any): JobRecord {
  return {
    id: r.id, customer_id: r.customer_id, job_type: r.job_type, service: r.service, status: r.status,
    total_records: num(r.total_records), processed: num(r.processed), valid_count: num(r.valid_count),
    invalid_count: num(r.invalid_count), dup_count: num(r.dup_count), credits_used: num(r.credits_used),
    priority: num(r.priority), country: r.country, sample: r.sample, error: r.error,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

const mem = new Map<string, JobRecord>();

export async function createJob(input: {
  customerId: string; jobType: JobType; service: string; total: number; credits: number;
  country?: string | null; priority?: number;
}): Promise<string> {
  const id = randomUUID();
  if (dbActive()) {
    await q(
      `INSERT INTO validation_jobs
        (id, customer_id, job_type, service, status, total_records, credits_used, country, priority)
       VALUES ($1,$2,$3,$4,'queued',$5,$6,$7,$8)`,
      [id, input.customerId, input.jobType, input.service, input.total, input.credits, input.country ?? null, input.priority ?? 0],
    );
  } else {
    const now = new Date().toISOString();
    mem.set(id, {
      id, customer_id: input.customerId, job_type: input.jobType, service: input.service, status: 'queued',
      total_records: input.total, processed: 0, valid_count: 0, invalid_count: 0, dup_count: 0,
      credits_used: input.credits, priority: input.priority ?? 0, country: input.country ?? null,
      sample: null, error: null, created_at: now, updated_at: now,
    });
  }
  return id;
}

export async function markRunning(id: string): Promise<void> {
  if (dbActive()) { await q(`UPDATE validation_jobs SET status='running', updated_at=now() WHERE id=$1`, [id]); return; }
  const j = mem.get(id); if (j) { j.status = 'running'; j.updated_at = new Date().toISOString(); }
}

export async function updateProgress(id: string, p: { processed: number; valid: number; invalid: number; dup: number }): Promise<void> {
  if (dbActive()) {
    await q(`UPDATE validation_jobs SET processed=$2, valid_count=$3, invalid_count=$4, dup_count=$5, updated_at=now() WHERE id=$1`,
      [id, p.processed, p.valid, p.invalid, p.dup]);
    return;
  }
  const j = mem.get(id);
  if (j) { j.processed = p.processed; j.valid_count = p.valid; j.invalid_count = p.invalid; j.dup_count = p.dup; j.updated_at = new Date().toISOString(); }
}

export async function finishJob(id: string, p: { valid: number; invalid: number; dup: number; processed: number; sample: unknown[] }): Promise<void> {
  if (dbActive()) {
    await q(`UPDATE validation_jobs SET status='completed', processed=$2, valid_count=$3, invalid_count=$4, dup_count=$5, sample=$6, updated_at=now() WHERE id=$1`,
      [id, p.processed, p.valid, p.invalid, p.dup, JSON.stringify(p.sample)]);
    return;
  }
  const j = mem.get(id);
  if (j) { Object.assign(j, { status: 'completed', processed: p.processed, valid_count: p.valid, invalid_count: p.invalid, dup_count: p.dup, sample: p.sample, updated_at: new Date().toISOString() }); }
}

export async function failJob(id: string, error: string): Promise<void> {
  if (dbActive()) { await q(`UPDATE validation_jobs SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [id, error]); return; }
  const j = mem.get(id); if (j) { j.status = 'failed'; j.error = error; j.updated_at = new Date().toISOString(); }
}

export async function getJob(id: string): Promise<JobRecord | null> {
  if (dbActive()) {
    const { rows } = await q(`SELECT * FROM validation_jobs WHERE id=$1`, [id]);
    return rows[0] ? rowToJob(rows[0]) : null;
  }
  return mem.get(id) ?? null;
}

export async function listJobs(customerId: string, limit = 20) {
  if (dbActive()) {
    const { rows } = await q(
      `SELECT id, job_type, service, total_records, processed, valid_count, invalid_count, dup_count,
              credits_used, status, country, created_at
       FROM validation_jobs WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [customerId, limit]);
    return rows;
  }
  return [...mem.values()].filter((j) => j.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

// Back-compat: synchronous endpoints still record a completed job in one shot.
export async function recordJob(j: { customerId: string; service: string; total: number; valid: number; invalid: number; dup: number; creditsUsed: number }): Promise<void> {
  const id = await createJob({ customerId: j.customerId, jobType: 'validation', service: j.service, total: j.total, credits: j.creditsUsed });
  await finishJob(id, { valid: j.valid, invalid: j.invalid, dup: j.dup, processed: j.total, sample: [] });
}
