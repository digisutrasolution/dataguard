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
