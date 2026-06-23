// Postgres connection pool. The app runs with or without a DB:
//   • DATABASE_URL set + reachable  → repositories use Postgres (durable)
//   • otherwise                     → repositories fall back to in-memory Maps
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;

export const pool = url ? new Pool({ connectionString: url, max: 10 }) : null;
pool?.on('error', (e) => console.error('[pg] pool error:', e.message));

let active = false;
export function dbActive(): boolean {
  return active;
}

// Called once at startup; flips repositories over to Postgres on success.
export async function initDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('select 1');
    active = true;
    return true;
  } catch (e) {
    console.error('[pg] connection failed, using in-memory store:', (e as Error).message);
    active = false;
    return false;
  }
}

export async function q<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('NO_DB');
  return pool.query<T>(text, params);
}

// Run a function inside a single transaction (BEGIN/COMMIT, ROLLBACK on error).
export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('NO_DB');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
