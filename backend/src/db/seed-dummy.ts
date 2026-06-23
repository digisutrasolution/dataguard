// Dummy-data seeder: `npm run seed`.
// Wipes data tables and repopulates a realistic, demo-ready dataset across
// customers, users, wallets, transactions (ledger), validation jobs, crypto
// payments, api keys, and audit logs. Re-run any time for a clean dataset.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { pool } from './pool.js';

if (!pool) {
  console.error('DATABASE_URL not set — cannot seed.');
  process.exit(1);
}
const db = pool;

const rint = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[rint(0, arr.length - 1)];
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);
const isoDaysAgo = (d: number) => daysAgo(d).toISOString();

const COUNTRIES = ['IN', 'IN', 'IN', 'US', 'US', 'GB', 'AE', 'AU', 'DE', 'SG', 'FR']; // weighted
const SERVICES = ['basic', 'basic', 'advanced', 'advanced', 'premium', 'detection'];
const COINS = ['USDT', 'BTC', 'ETH', 'TRX'];
const CRYPTO_STATES = ['completed', 'completed', 'confirmed', 'pending', 'failed', 'expired'];
const COMPANIES = [
  'Acme Corp', 'Globex Telecom', 'Initech Data', 'Umbrella Verify', 'Hooli Reach',
  'Stark Outreach', 'Wayne Comms', 'Wonka Leads', 'Cyberdyne SMS', 'Soylent Mktg',
  'Pied Piper', 'Massive Dynamic',
];
const CITY_IPS = ['203.0.113.7', '198.51.100.22', '192.0.2.51', '203.0.113.88', '198.51.100.4'];
const DEVICES = ['Chrome / Windows', 'Safari / macOS', 'Firefox / Linux', 'Edge / Windows', 'Chrome / Android'];

async function reset() {
  await db.query(`TRUNCATE customers, users, wallets, transactions, validation_jobs,
    detection_providers, api_keys, crypto_transactions, audit_logs RESTART IDENTITY CASCADE`);
}

async function seedProviders() {
  await db.query(
    `INSERT INTO detection_providers (id,name,type,enabled,is_active,settings) VALUES
       ('mock','Built-in mock (offline)','mock',true,true,'{}'),
       ('apify','Apify actor','apify',false,false,$1),
       ('http-custom','Custom HTTP API','http',false,false,$2)`,
    [
      JSON.stringify({ actorId: 'your-username~whatsapp-number-checker', token: '', inputField: 'phoneNumbers', resultField: 'status' }),
      JSON.stringify({ url: '', apiKey: '', statusField: 'status' }),
    ],
  );
}

async function seedCustomer(id: string, company: string, isCore: boolean) {
  await db.query('INSERT INTO customers (id, company_name, created_at) VALUES ($1,$2,$3)',
    [id, company, isoDaysAgo(rint(40, 90))]);

  // events: an opening recharge + periodic recharges + per-job debits, folded for balance_after
  type Ev = { date: Date; type: 'recharge' | 'debit'; amount: number; ref: string; job?: any };
  const events: Ev[] = [];
  events.push({ date: daysAgo(rint(60, 88)), type: 'recharge', amount: rint(200, 800) * 1000, ref: 'opening' });
  for (let i = 0; i < rint(1, 4); i++)
    events.push({ date: daysAgo(rint(1, 55)), type: 'recharge', amount: rint(50, 400) * 1000, ref: 'topup' });

  const jobCount = isCore ? rint(10, 16) : rint(4, 14);
  for (let i = 0; i < jobCount; i++) {
    const total = rint(1, 500) * 1000;
    const invalid = Math.floor(total * (rint(8, 30) / 100));
    const dup = Math.floor(total * (rint(2, 12) / 100));
    const valid = total - invalid - dup;
    const service = pick(SERVICES);
    const rate = service === 'premium' ? 0.05 : service === 'detection' ? 0.08 : service === 'advanced' ? 0.02 : 0.01;
    const credits = Math.ceil(total * rate * (total >= 100000 ? 0.6 : total >= 10000 ? 0.8 : 1));
    const date = daysAgo(rint(0, 60));
    events.push({ date, type: 'debit', amount: credits, ref: 'job',
      job: { total, valid, invalid, dup, service, credits, country: pick(COUNTRIES), date } });
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = 0;
  for (const e of events) {
    if (e.type === 'recharge') balance += e.amount;
    else balance = Math.max(0, balance - e.amount);
    await db.query(
      `INSERT INTO transactions (customer_id, type, amount, balance_after, ref, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, e.type, e.amount, balance, e.ref, e.date.toISOString()],
    );
    if (e.job) {
      const j = e.job;
      await db.query(
        `INSERT INTO validation_jobs
          (customer_id, service, total_records, valid_count, invalid_count, dup_count, credits_used, status, country, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9)`,
        [id, j.service, j.total, j.valid, j.invalid, j.dup, j.credits, j.country, j.date.toISOString()],
      );
    }
  }
  await db.query('INSERT INTO wallets (customer_id, balance, updated_at) VALUES ($1,$2,now())', [id, balance]);

  // crypto payments
  for (let i = 0; i < rint(0, 3); i++) {
    const coin = pick(COINS);
    const credits = rint(50, 400) * 1000;
    const status = pick(CRYPTO_STATES);
    await db.query(
      `INSERT INTO crypto_transactions (customer_id, coin, address, tx_hash, amount, credits, confirmations, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, coin, 'T' + randomUUID().replace(/-/g, '').slice(0, 32),
       status === 'pending' ? null : '0x' + randomUUID().replace(/-/g, ''),
       (credits * 0.0025).toFixed(2), credits,
       status === 'pending' ? rint(0, 5) : 12, status, isoDaysAgo(rint(0, 50))],
    );
  }

  // api keys
  for (let i = 0; i < rint(1, 2); i++) {
    await db.query(
      `INSERT INTO api_keys (customer_id, label, key_prefix, rate_limit, is_active, last_used_at, created_at)
       VALUES ($1,$2,$3,$4,true,$5,$6)`,
      [id, i === 0 ? 'Production' : 'Staging', `dg_live_${randomUUID().slice(0, 6)}`,
       pick([1000, 5000, 10000]), isoDaysAgo(rint(0, 5)), isoDaysAgo(rint(20, 80))],
    );
  }
}

async function seedUsers(customerMap: { id: string; company: string }[]) {
  const admin = bcrypt.hashSync('admin123', 10);
  const owner = bcrypt.hashSync('owner123', 10);
  const member = bcrypt.hashSync('member123', 10);
  await db.query(
    `INSERT INTO users (email, password_hash, role, customer_id) VALUES ($1,$2,'admin',NULL)`,
    ['admin@dataguard.io', admin],
  );
  await db.query(
    `INSERT INTO users (email, password_hash, role, customer_id) VALUES ($1,$2,'customer_owner','demo-customer')`,
    ['owner@acme.com', owner],
  );
  // a few extra owners/members on other customers
  for (const c of customerMap.slice(1, 6)) {
    const slug = c.company.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
    await db.query(
      `INSERT INTO users (email, password_hash, role, customer_id) VALUES ($1,$2,'customer_owner',$3) ON CONFLICT DO NOTHING`,
      [`owner@${slug}.com`, owner, c.id],
    );
    if (Math.random() > 0.4)
      await db.query(
        `INSERT INTO users (email, password_hash, role, customer_id) VALUES ($1,$2,'customer_member',$3) ON CONFLICT DO NOTHING`,
        [`team@${slug}.com`, member, c.id],
      );
  }
}

async function seedAudit(customerMap: { id: string }[]) {
  const actions: [string, string][] = [
    ['login', 'session'], ['logout', 'session'], ['pricing.update', 'plan:premium'],
    ['provider.activate', 'detection:apify'], ['user.create', 'team member'],
    ['wallet.recharge', 'crypto:USDT'], ['permission.update', 'role:customer_member'],
    ['apikey.create', 'Production'],
  ];
  for (let i = 0; i < 40; i++) {
    const [action, target] = pick(actions);
    await db.query(
      `INSERT INTO audit_logs (actor, customer_id, action, target, ip, device, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [pick(['admin@dataguard.io', 'owner@acme.com', 'system']), pick(customerMap).id,
       action, target, pick(CITY_IPS), pick(DEVICES), isoDaysAgo(rint(0, 30))],
    );
  }
}

async function run() {
  console.log('seeding dummy data…');
  await reset();
  await seedProviders();

  const customerMap = [{ id: 'demo-customer', company: 'Acme Corp' },
    ...COMPANIES.slice(1).map((company) => ({ id: `cust-${randomUUID().slice(0, 8)}`, company }))];

  for (const c of customerMap) await seedCustomer(c.id, c.company, c.id === 'demo-customer');
  await seedUsers(customerMap);
  await seedAudit(customerMap);

  const counts = await db.query(`SELECT
     (SELECT count(*) FROM customers) customers,
     (SELECT count(*) FROM users) users,
     (SELECT count(*) FROM validation_jobs) jobs,
     (SELECT count(*) FROM transactions) tx,
     (SELECT count(*) FROM crypto_transactions) crypto,
     (SELECT count(*) FROM audit_logs) audit`);
  console.log('seed complete:', counts.rows[0]);
  await db.end();
}

run().catch((e) => { console.error('seed failed:', e.message); process.exit(1); });
