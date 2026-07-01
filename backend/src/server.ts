// DataGuard Solutions — API server (starter).
// REST surface mirrors section 17 of the spec. Auth/rate-limit are stubbed
// with a simple API-key check; wire to api_keys table + Redis in production.
import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { z } from 'zod';
import type { CountryCode } from 'libphonenumber-js';
import {
  validateOne,
  validateBulk,
  generate,
  type OutFormat,
} from './modules/validation/engine.js';
import { deduct, getWallet, recharge } from './modules/wallet/wallet.js';
import { priceFor, listRules, createRule, updateRule, deleteRule } from './modules/pricing/pricing.js';
import { listInvoices, getInvoice } from './modules/invoices/invoices.js';
import PDFDocument from 'pdfkit';
import { detectMany } from './modules/detection/provider.js';
import {
  listProviders,
  getActiveProvider,
  addProvider,
  updateProvider,
  activateProvider,
  removeProvider,
} from './modules/detection/registry.js';
import {
  register,
  login,
  me,
  setup2fa,
  enable2fa,
  disable2fa,
} from './modules/auth/service.js';
import { requireAuth, requirePermission } from './modules/auth/middleware.js';
import { recordJob, listJobs, createJob, getJob } from './modules/jobs/jobs.js';
import { initQueue, enqueue, queueMode } from './queue/queue.js';
import { adminStats, adminCustomers, customerStats } from './modules/reports/stats.js';
import { logAudit, listAudit } from './modules/audit/audit.js';
import { createPayment, getPayment, listPayments, completePayment } from './modules/payments/payments.js';
import { COINS } from './modules/payments/provider.js';
import { reqMeta } from './common/meta.js';
import { createKey, listKeys, revokeKey, resolveKey, logRequest, listLogs } from './modules/apikeys/apikeys.js';
import { initDb, dbActive } from './db/pool.js';

const app = express();
app.set('trust proxy', 1); // behind a proxy/LB — needed for correct req.ip
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = Number(process.env.PORT ?? 4000);
const CUSTOMER = 'demo-customer'; // portal/demo default
// Customer for the request: from the resolved API key, else the demo customer.
const cust = (req: express.Request) => req.customerId ?? CUSTOMER;

// --- Rate limiting ---
// In-memory store (per-process). Swap for a Redis store for multi-instance.
const apiLimiter = rateLimit({
  windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false,
  message: { error: 'rate_limited' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});
app.use('/api', apiLimiter);

// --- API-key gate for the programmatic data API ---
// Portal/admin routes (/auth, /admin) use JWT instead and are exempt here.
// Accepts the configured demo key (-> demo customer) OR a real hashed key from
// the api_keys table (-> its customer); real-key requests are logged.
app.use('/api', async (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/payments/webhook' ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/admin')
  ) {
    return next();
  }
  const key = req.header('x-api-key');
  if (!key) return res.status(401).json({ error: 'invalid_api_key' });

  if (key === (process.env.API_KEY ?? 'demo-key')) {
    req.customerId = CUSTOMER; req.apiKeyId = 'demo';
    return next();
  }
  const resolved = await resolveKey(key);
  if (!resolved) return res.status(401).json({ error: 'invalid_api_key' });
  req.customerId = resolved.customerId;
  req.apiKeyId = resolved.id;
  req.apiKeyRateLimit = resolved.rateLimit;
  res.on('finish', () => void logRequest({ keyId: resolved.id, customerId: resolved.customerId, method: req.method, path: req.path, status: res.statusCode }));
  next();
});

// Per-key rate limit (real keys only; demo/portal uses the global limiter above).
const keyLimiter = rateLimit({
  windowMs: 60_000,
  limit: (req) => req.apiKeyRateLimit ?? 1000,
  keyGenerator: (req) => req.apiKeyId ?? req.ip ?? 'anon',
  skip: (req) => !req.apiKeyId || req.apiKeyId === 'demo',
  standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited' },
});
app.use('/api', keyLimiter);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'DataGuard API', store: dbActive() ? 'postgres' : 'memory', queue: queueMode(), ts: Date.now() }),
);

// ---- Auth (JWT + 2FA) ----------------------------------------------------
const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totp: z.string().optional(),
});
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const p = credsSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    const out = await register(p.data.email, p.data.password);
    const m = reqMeta(req);
    void logAudit({ actor: p.data.email, customerId: out.user.customerId, action: 'user.register', target: 'self', ...m });
    res.status(201).json(out);
  } catch {
    res.status(409).json({ error: 'email_taken' });
  }
});
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const p = credsSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const m = reqMeta(req);
  const r = await login(p.data.email, p.data.password, p.data.totp);
  if (!r.ok) {
    if (r.reason !== 'twofa_required')
      void logAudit({ actor: p.data.email, action: 'login.failed', target: r.reason, ...m });
    const code = r.reason === 'twofa_required' ? 200 : 401;
    return res.status(code).json({ error: r.reason });
  }
  void logAudit({ actor: r.user.email, customerId: r.user.customerId, action: 'login.success', target: 'session', ...m });
  res.json({ token: r.token, user: r.user });
});
app.get('/api/auth/me', requireAuth, async (req, res) => res.json(await me(req.user!.email)));
app.post('/api/auth/2fa/setup', requireAuth, async (req, res) => res.json(await setup2fa(req.user!.email)));
app.post('/api/auth/2fa/enable', requireAuth, async (req, res) => {
  const ok = await enable2fa(req.user!.email, String(req.body?.totp ?? ''));
  if (ok) void logAudit({ actor: req.user!.email, customerId: req.user!.customerId, action: '2fa.enable', ...reqMeta(req) });
  res.status(ok ? 200 : 400).json({ enabled: ok });
});
app.post('/api/auth/2fa/disable', requireAuth, async (req, res) => {
  void logAudit({ actor: req.user!.email, customerId: req.user!.customerId, action: '2fa.disable', ...reqMeta(req) });
  await disable2fa(req.user!.email);
  res.json({ enabled: false });
});

// POST /api/validate — single number
const validateSchema = z.object({
  number: z.string(),
  defaultCountry: z.string().length(2).optional(),
});
app.post('/api/validate', (req, res) => {
  const p = validateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const result = validateOne(p.data.number, {
    defaultCountry: p.data.defaultCountry as CountryCode | undefined,
  });
  res.json(result);
});

// POST /api/bulk-validation — array of numbers, charges wallet
const bulkSchema = z.object({
  numbers: z.array(z.string()).max(1_000_000),
  defaultCountry: z.string().length(2).optional(),
  service: z.enum(['basic', 'advanced', 'premium']).default('basic'),
  removeDuplicates: z.boolean().default(true),
});
app.post('/api/bulk-validation', async (req, res) => {
  const p = bulkSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const cost = await priceFor(p.data.service, p.data.numbers.length, { country: p.data.defaultCountry, customerId: CUSTOMER });
  let wallet;
  try {
    wallet = await deduct(CUSTOMER, cost, 'bulk-validation');
  } catch (e) {
    if ((e as Error).message === 'INSUFFICIENT_BALANCE')
      return res.status(402).json({ error: 'insufficient_balance', cost });
    throw e; // real errors -> global handler, not masked as "insufficient balance"
  }
  const summary = validateBulk(p.data.numbers, {
    defaultCountry: p.data.defaultCountry as CountryCode | undefined,
    removeDuplicates: p.data.removeDuplicates,
  });
  await recordJob({
    customerId: CUSTOMER,
    service: p.data.service,
    total: summary.total,
    valid: summary.valid,
    invalid: summary.invalid,
    dup: summary.duplicate,
    creditsUsed: cost,
  });
  res.json({ ...summary, creditsUsed: cost, balance: wallet.balance });
});

// POST /api/detect — Number Detection (single) via custom third-party provider.
// Returns registration: registered | unregistered | unknown.
const detectSchema = z.object({
  number: z.string(),
  defaultCountry: z.string().length(2).optional(),
});
app.post('/api/detect', async (req, res) => {
  const p = detectSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const v = validateOne(p.data.number, {
    defaultCountry: p.data.defaultCountry as CountryCode | undefined,
  });
  if (v.status !== 'valid') {
    return res.json({ input: v.raw, e164: null, iso2: v.iso2, registration: 'unknown', reason: 'invalid_number' });
  }
  const cost = await priceFor('detection', 1, { country: p.data.defaultCountry, customerId: CUSTOMER });
  let wallet;
  try {
    wallet = await deduct(CUSTOMER, cost, 'detect');
  } catch (e) {
    if ((e as Error).message === 'INSUFFICIENT_BALANCE')
      return res.status(402).json({ error: 'insufficient_balance', cost });
    throw e; // real errors -> global handler, not masked as "insufficient balance"
  }
  const provider = await getActiveProvider();
  const d = await provider.detect(v.e164!);
  res.json({ input: v.raw, iso2: v.iso2, ...d, creditsUsed: cost, balance: wallet.balance });
});

// POST /api/detect-bulk — Number Detection (batch).
const detectBulkSchema = z.object({
  numbers: z.array(z.string()).max(100000),
  defaultCountry: z.string().length(2).optional(),
});
app.post('/api/detect-bulk', async (req, res) => {
  const p = detectBulkSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const cost = await priceFor('detection', p.data.numbers.length, { country: p.data.defaultCountry, customerId: CUSTOMER });
  let wallet;
  try {
    wallet = await deduct(CUSTOMER, cost, 'detect-bulk');
  } catch (e) {
    if ((e as Error).message === 'INSUFFICIENT_BALANCE')
      return res.status(402).json({ error: 'insufficient_balance', cost });
    throw e; // real errors -> global handler, not masked as "insufficient balance"
  }
  const validated = p.data.numbers.map((n) =>
    validateOne(n, { defaultCountry: p.data.defaultCountry as CountryCode | undefined }),
  );
  const provider = await getActiveProvider();
  const detections = await detectMany(provider, validated.map((v) => (v.status === 'valid' ? v.e164 : null)));
  const results = validated.map((v, i) => ({
    raw: v.raw,
    e164: v.e164,
    iso2: v.iso2,
    registration: detections[i].registration,
    carrier: detections[i].carrier,
  }));
  res.json({
    total: results.length,
    registered: results.filter((r) => r.registration === 'registered').length,
    unregistered: results.filter((r) => r.registration === 'unregistered').length,
    unknown: results.filter((r) => r.registration === 'unknown').length,
    provider: provider.name,
    results,
    creditsUsed: cost,
    balance: wallet.balance,
  });
});

// ---- Admin: reports & analytics (JWT + RBAC) -----------------------------
const canReport = [requireAuth, requirePermission('reports.view')];
app.get('/api/admin/stats', ...canReport, async (_req, res) => res.json(await adminStats()));
app.get('/api/admin/customers', ...canReport, async (_req, res) => res.json(await adminCustomers()));
app.get('/api/admin/audit', ...canReport, async (req, res) => res.json(await listAudit(Number(req.query.limit) || 50)));

// ---- Admin: pricing rules (system admin) ---------------------------------
const canAdmin = [requireAuth, requirePermission('system.admin')];
app.get('/api/admin/pricing', ...canAdmin, async (_req, res) => res.json(await listRules()));

const ruleSchema = z.object({
  service: z.enum(['basic', 'advanced', 'premium', 'detection']),
  iso2: z.string().length(2).optional(),
  customerId: z.string().optional(),
  minQty: z.number().int().min(0).default(0),
  creditsPerNumber: z.number().positive(),
});
app.post('/api/admin/pricing', ...canAdmin, async (req, res) => {
  const p = ruleSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const rule = await createRule(p.data);
  void logAudit({ actor: req.user!.email, action: 'pricing.create', target: `${p.data.service}@${p.data.creditsPerNumber}`, ...reqMeta(req) });
  res.status(201).json(rule);
});
app.patch('/api/admin/pricing/:id', ...canAdmin, async (req, res) => {
  const patch = z.object({ creditsPerNumber: z.number().positive().optional(), minQty: z.number().int().min(0).optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!patch.success) return res.status(400).json({ error: patch.error.flatten() });
  const rule = await updateRule(req.params.id, patch.data);
  if (!rule) return res.status(404).json({ error: 'not_found' });
  void logAudit({ actor: req.user!.email, action: 'pricing.update', target: req.params.id, ...reqMeta(req) });
  res.json(rule);
});
app.delete('/api/admin/pricing/:id', ...canAdmin, async (req, res) => {
  if (!(await deleteRule(req.params.id))) return res.status(404).json({ error: 'not_found' });
  void logAudit({ actor: req.user!.email, action: 'pricing.delete', target: req.params.id, ...reqMeta(req) });
  res.json({ ok: true });
});

// ---- Admin: detection provider management (JWT + RBAC) -------------------
const canManage = [requireAuth, requirePermission('detection.manage')];

app.get('/api/admin/detection-providers', ...canManage, async (_req, res) => res.json(await listProviders()));

const addProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['mock', 'http', 'apify']),
  settings: z.record(z.string()).optional(),
});
app.post('/api/admin/detection-providers', ...canManage, async (req, res) => {
  const p = addProviderSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const out = await addProvider(p.data);
  void logAudit({ actor: req.user!.email, action: 'provider.create', target: `${out.type}:${out.id}`, ...reqMeta(req) });
  res.status(201).json(out);
});

const patchProviderSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.string()).optional(),
});
app.patch('/api/admin/detection-providers/:id', ...canManage, async (req, res) => {
  const p = patchProviderSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const updated = await updateProvider(req.params.id, p.data);
  if (!updated) return res.status(404).json({ error: 'not_found' });
  void logAudit({ actor: req.user!.email, action: 'provider.update', target: req.params.id, ...reqMeta(req) });
  res.json(updated);
});

app.post('/api/admin/detection-providers/:id/activate', ...canManage, async (req, res) => {
  const activated = await activateProvider(req.params.id);
  if (!activated) return res.status(404).json({ error: 'not_found' });
  void logAudit({ actor: req.user!.email, action: 'provider.activate', target: req.params.id, ...reqMeta(req) });
  res.json(activated);
});

app.delete('/api/admin/detection-providers/:id', ...canManage, async (req, res) => {
  if (!(await removeProvider(req.params.id)))
    return res.status(409).json({ error: 'cannot_remove_active_or_mock' });
  void logAudit({ actor: req.user!.email, action: 'provider.delete', target: req.params.id, ...reqMeta(req) });
  res.json({ ok: true });
});

// POST /api/generate — country-based generator
const genSchema = z.object({
  country: z.string().length(2),
  quantity: z.number().int().positive().max(100000),
  format: z.enum(['e164', 'national', 'international']).default('e164'),
});
app.post('/api/generate', (req, res) => {
  const p = genSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const numbers = generate(
    p.data.country as CountryCode,
    p.data.quantity,
    p.data.format as OutFormat,
  );
  res.json({ count: numbers.length, numbers });
});

// GET /api/balance
app.get('/api/balance', async (_req, res) => res.json(await getWallet(CUSTOMER)));

// POST /api/recharge (demo — production credits via crypto webhook)
app.post('/api/recharge', async (req, res) => {
  const credits = Number(req.body?.credits ?? 0);
  if (!credits || credits < 0) return res.status(400).json({ error: 'bad_amount' });
  const w = await recharge(CUSTOMER, credits, 'manual');
  void logAudit({ customerId: CUSTOMER, action: 'wallet.recharge', target: `${credits} credits`, ...reqMeta(req) });
  res.json(w);
});

// ---- Crypto payments (recharge) ------------------------------------------
// POST /api/payments — create a crypto recharge; returns address + amount.
const paymentSchema = z.object({
  coin: z.enum(['USDT', 'BTC', 'ETH', 'TRX']),
  credits: z.number().int().positive().max(100_000_000),
});
app.post('/api/payments', async (req, res) => {
  const p = paymentSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const payment = await createPayment({ customerId: CUSTOMER, coin: p.data.coin, credits: p.data.credits });
  void logAudit({ customerId: CUSTOMER, action: 'payment.create', target: `${p.data.credits} via ${p.data.coin}`, ...reqMeta(req) });
  res.status(201).json(payment);
});
app.get('/api/payments', async (_req, res) => res.json(await listPayments(CUSTOMER)));
app.get('/api/payments/:id', async (req, res) => {
  const payment = await getPayment(req.params.id);
  if (!payment) return res.status(404).json({ error: 'not_found' });
  res.json(payment);
});
app.get('/api/payments/coins', (_req, res) => res.json({ coins: COINS }));
// POST /api/payments/webhook — IPN endpoint for real providers (no key gate; verify signature in prod).
app.post('/api/payments/webhook', async (req, res) => {
  const { id, status, tx_hash } = req.body ?? {};
  if (status === 'finished' || status === 'confirmed' || status === 'completed') {
    if (id) await completePayment(String(id), tx_hash);
  }
  res.json({ ok: true });
});

// ---- Invoices ------------------------------------------------------------
app.get('/api/invoices', async (_req, res) => res.json(await listInvoices(CUSTOMER)));
app.get('/api/invoices/:id', async (req, res) => {
  const inv = await getInvoice(req.params.id, CUSTOMER);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  res.json(inv);
});
app.get('/api/invoices/:id/pdf', async (req, res) => {
  const inv = await getInvoice(req.params.id, CUSTOMER);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="${inv.number}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  doc.fontSize(20).text('DataGuard Solutions', { continued: false });
  doc.fontSize(10).fillColor('#666').text('Secure phone validation platform');
  doc.moveDown(1.5);
  doc.fillColor('#000').fontSize(16).text('Invoice');
  doc.moveDown(0.5).fontSize(10);
  doc.text(`Invoice no:   ${inv.number}`);
  doc.text(`Date:         ${new Date(inv.created_at).toLocaleString()}`);
  doc.text(`Customer:     ${inv.customer_id}`);
  doc.text(`Status:       ${inv.status.toUpperCase()}`);
  doc.moveDown(1);
  doc.fontSize(11).text('Description', 50, doc.y, { width: 320, continued: true }).text('Amount', { align: 'right' });
  doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor('#ccc').stroke();
  doc.moveDown(0.6);
  doc.text(`${inv.credits.toLocaleString()} prepaid credits${inv.coin ? ` (paid in ${inv.coin})` : ''}`, 50, doc.y, { width: 320, continued: true })
     .text(`$${inv.amount_usd.toFixed(2)}`, { align: 'right' });
  doc.moveDown(1);
  doc.fontSize(13).text('Total', 50, doc.y, { width: 320, continued: true }).text(`$${inv.amount_usd.toFixed(2)}`, { align: 'right' });
  doc.moveDown(3);
  doc.fontSize(8).fillColor('#999').text('© 2026 DataGuard Solutions. All rights reserved. Developed by Steven | Innovation & Security Solutions.', { align: 'center' });
  doc.end();
});

// GET /api/history — recent validation jobs for the customer
app.get('/api/history', async (_req, res) => res.json(await listJobs(CUSTOMER)));

// GET /api/my/stats — customer dashboard aggregates (this month)
app.get('/api/my/stats', async (_req, res) => res.json(await customerStats(CUSTOMER)));

// ---- API keys (customer-managed) -----------------------------------------
const keySchema = z.object({ label: z.string().min(1).max(60), rateLimit: z.number().int().min(60).max(100000).default(1000) });
app.post('/api/keys', async (req, res) => {
  const p = keySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const out = await createKey(cust(req), p.data.label, p.data.rateLimit);
  void logAudit({ customerId: cust(req), action: 'apikey.create', target: p.data.label, ...reqMeta(req) });
  res.status(201).json({ ...out.view, key: out.plaintext }); // plaintext shown ONCE
});
app.get('/api/keys', async (req, res) => res.json(await listKeys(cust(req))));
app.delete('/api/keys/:id', async (req, res) => {
  if (!(await revokeKey(req.params.id, cust(req)))) return res.status(404).json({ error: 'not_found' });
  void logAudit({ customerId: cust(req), action: 'apikey.revoke', target: req.params.id, ...reqMeta(req) });
  res.json({ ok: true });
});
app.get('/api/logs', async (req, res) => res.json(await listLogs(cust(req), 100)));

// ---- Async jobs (queue + workers) ----------------------------------------
// POST /api/jobs — submit a validation OR detection job; processed in the
// background with live progress. Returns immediately with a job id.
const jobSchema = z.object({
  numbers: z.array(z.string()).min(1).max(1_000_000),
  defaultCountry: z.string().length(2).optional(),
  service: z.enum(['basic', 'advanced', 'premium', 'detection']).default('basic'),
  priority: z.enum(['normal', 'high']).default('normal'),
});
app.post('/api/jobs', async (req, res) => {
  const p = jobSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { numbers, defaultCountry, service, priority } = p.data;
  const jobType = service === 'detection' ? 'detection' : 'validation';
  const cost = await priceFor(service, numbers.length, { country: defaultCountry, customerId: CUSTOMER });
  try {
    await deduct(CUSTOMER, cost, `job:${jobType}`);
  } catch (e) {
    if ((e as Error).message === 'INSUFFICIENT_BALANCE')
      return res.status(402).json({ error: 'insufficient_balance', cost });
    throw e;
  }
  const jobId = await createJob({
    customerId: CUSTOMER, jobType, service, total: numbers.length, credits: cost,
    country: defaultCountry ?? null, priority: priority === 'high' ? 10 : 0,
  });
  await enqueue({ jobId, customerId: CUSTOMER, jobType, service, numbers, defaultCountry }, priority === 'high' ? 1 : 0);
  res.status(202).json({ jobId, status: 'queued', total: numbers.length, creditsUsed: cost, queue: queueMode() });
});

// GET /api/jobs/:id — poll job status + live progress + result sample
app.get('/api/jobs/:id', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  res.json(job);
});

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// ---- Global error handler (last) ----
// express-async-errors forwards rejected promises here, so a thrown error in any
// handler returns a clean 500 JSON instead of hanging the request.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', req.method, req.path, '-', err?.message ?? err);
  if (res.headersSent) return;
  res.status(err?.status ?? 500).json({ error: 'internal_error' });
});

// Connect to Postgres + queue (if configured) before accepting traffic.
Promise.all([initDb(), initQueue()]).then(([dbOk]) => {
  console.log(`[store] ${dbOk ? 'Postgres connected' : 'in-memory (no DB)'} · [queue] ${queueMode()}`);
  app.listen(PORT, () =>
    console.log(`DataGuard API listening on http://localhost:${PORT}`),
  );
});
