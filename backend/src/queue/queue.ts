// Job queue abstraction. With REDIS_URL set, jobs run on a BullMQ worker
// (persistent, retried, resumable across restarts, priority). Without it, jobs
// run in-process in the background (works now; lost on restart).
import { processJob, type JobPayload } from './processor.js';

const REDIS_URL = process.env.REDIS_URL;
let mode: 'redis' | 'memory' = 'memory';
// typed as any: bullmq bundles its own ioredis copy, so the instance types differ
let bullQueue: any = null;

export function queueMode(): 'redis' | 'memory' {
  return mode;
}

export async function initQueue(): Promise<void> {
  if (!REDIS_URL) { mode = 'memory'; return; }
  try {
    const { Queue, Worker } = await import('bullmq');
    const IORedis = (await import('ioredis')).default;
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    await connection.ping();
    bullQueue = new Queue('dataguard-jobs', { connection: connection as any });
    new Worker('dataguard-jobs', async (job: any) => { await processJob(job.data as JobPayload); }, {
      connection: connection as any,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
    });
    mode = 'redis';
    console.log('[queue] BullMQ worker connected to Redis');
  } catch (e) {
    console.error('[queue] Redis unavailable, using in-memory queue:', (e as Error).message);
    mode = 'memory';
  }
}

// priority: lower number = higher priority (BullMQ convention); 0 = normal FIFO.
export async function enqueue(payload: JobPayload, priority = 0): Promise<void> {
  if (mode === 'redis' && bullQueue) {
    await bullQueue.add('job', payload, {
      priority: priority || undefined,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return;
  }
  // In-memory: run in the background without blocking the HTTP response.
  setImmediate(() => { void processJob(payload); });
}
