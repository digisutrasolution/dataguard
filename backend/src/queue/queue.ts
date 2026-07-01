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
  let connection: any = null;
  try {
    const { Queue, Worker } = await import('bullmq');
    const IORedis = (await import('ioredis')).default;
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: false, lazyConnect: true });
    connection.on('error', () => {}); // avoid unhandled 'error' crashes; handled below
    // Fail fast (3s) so a down Redis never hangs startup — fall back to memory.
    await Promise.race([
      connection.connect().then(() => connection.ping()),
      new Promise((_, rej) => setTimeout(() => rej(new Error('redis_timeout')), 3000)),
    ]);
    bullQueue = new Queue('dataguard-jobs', { connection: connection as any });
    new Worker('dataguard-jobs', async (job: any) => { await processJob(job.data as JobPayload); }, {
      connection: connection as any,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
    });
    mode = 'redis';
    console.log('[queue] BullMQ worker connected to Redis');
  } catch (e) {
    console.error('[queue] Redis unavailable, using in-memory queue:', (e as Error).message);
    try { connection?.disconnect(); } catch { /* ignore */ }
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
