// Migration + seed runner: `npm run migrate`.
// Applies db/migrations/*.sql in order, then seeds demo data idempotently.
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../../db/migrations');

async function run() {
  if (!pool) {
    console.error('DATABASE_URL not set — nothing to migrate.');
    process.exit(1);
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    process.stdout.write(`applying ${f} … `);
    await pool.query(sql);
    console.log('ok');
  }

  // --- seed (idempotent) ---
  await pool.query(
    `INSERT INTO customers (id, company_name) VALUES ($1,$2)
     ON CONFLICT (id) DO NOTHING`,
    ['demo-customer', 'Acme Corp'],
  );
  await pool.query(
    `INSERT INTO wallets (customer_id, balance) VALUES ($1,$2)
     ON CONFLICT (customer_id) DO NOTHING`,
    ['demo-customer', 512400],
  );
  const admin = bcrypt.hashSync('admin123', 10);
  const owner = bcrypt.hashSync('owner123', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, customer_id) VALUES
       ($1,$2,'admin',NULL), ($3,$4,'customer_owner','demo-customer')
     ON CONFLICT (email) DO NOTHING`,
    ['admin@dataguard.io', admin, 'owner@acme.com', owner],
  );
  await pool.query(
    `INSERT INTO detection_providers (id,name,type,enabled,is_active,settings) VALUES
       ('mock','Built-in mock (offline)','mock',true,true,'{}'),
       ('apify','Apify actor','apify',false,false,$1),
       ('http-custom','Custom HTTP API','http',false,false,$2)
     ON CONFLICT (id) DO NOTHING`,
    [
      JSON.stringify({ actorId: 'your-username~whatsapp-number-checker', token: '', inputField: 'phoneNumbers', resultField: 'status' }),
      JSON.stringify({ url: '', apiKey: '', statusField: 'status' }),
    ],
  );

  console.log('seed complete');
  await pool.end();
}

run().catch((e) => {
  console.error('migration failed:', e.message);
  process.exit(1);
});
