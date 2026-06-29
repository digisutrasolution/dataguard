# DataGuard Solutions — Starter Monorepo

Enterprise global phone validation & data intelligence platform.
This repo is a **runnable foundation** for the full spec (admin/customer portals,
billion-record validation, wallet/crypto billing, REST API).

```
dataguard/
├── db/schema.sql        PostgreSQL schema — partitioned, sharding-ready, indexed
├── backend/             TypeScript API + real validation engine (libphonenumber)
└── frontend/            React + Vite dashboard (3 screens, dark/light)
```

## What's implemented now

| Area | Status |
|---|---|
| Async jobs — queue + workers, chunked, live progress, priority (BullMQ/Redis or in-memory) | ✅ working |
| Crypto payments — pluggable gateway, payment lifecycle, auto wallet credit | ✅ working (mock; NOWPayments-ready) |
| Persistence — PostgreSQL (users, wallets, transactions ledger, providers, jobs) | ✅ working, durable |
| Auth — JWT login/register, bcrypt, TOTP 2FA, RBAC roles/permissions | ✅ working |
| Validation engine (single + bulk, E.164, dedupe, type) | ✅ working |
| Number Detection (registered/unregistered/unknown) — multi-provider (Apify/HTTP/mock), admin-managed | ✅ working |
| Country-based generator (national / international / E.164) | ✅ working |
| Wallet + tiered/bulk pricing + auto-deduct | ✅ working (in-memory) |
| REST API (`/validate`, `/bulk-validation`, `/generate`, `/balance`) | ✅ working |
| API-key gate | ✅ stub (swap for `api_keys` table) |
| Admin / Customer / Validate UI | ✅ working, live-wired |
| DB schema (18 tables, partitions) | ✅ DDL ready |

## Run it

**One command (recommended)** — starts backend + frontend together:
```bash
npm run setup    # first time only: installs root + backend + frontend deps
npm run dev      # runs API (:4000) and web (:5173) concurrently
```
> ⚠️ The frontend needs the backend running. If you start **only** the frontend,
> every `/api/*` call fails and the terminal fills with proxy errors. Use
> `npm run dev` from the project root so both always run.

Open http://localhost:5173 → Dashboard, Validate, Admin.

**Or run them separately** (two terminals — PowerShell uses `;`, not `&&`):
```powershell
cd backend ; npm run dev      # :4000
cd frontend ; npm run dev     # :5173, proxies /api → 4000
```

**Try the API directly:**
```bash
curl -X POST http://localhost:4000/api/validate \
  -H "x-api-key: demo-key" -H "content-type: application/json" \
  -d '{"number":"9876543210","defaultCountry":"IN"}'
# -> {"e164":"+919876543210","iso2":"IN","status":"valid", ...}

curl -X POST http://localhost:4000/api/detect-bulk \
  -H "x-api-key: demo-key" -H "content-type: application/json" \
  -d '{"numbers":["9876543210","9876543216"],"defaultCountry":"IN"}'
# -> {"registered":1,"unregistered":1,"results":[{...,"registration":"registered","carrier":"Airtel"}], ...}
```

## Persistence — PostgreSQL

The app runs with **or** without a database. If `DATABASE_URL` is set and reachable,
repositories use Postgres; otherwise they fall back to in-memory Maps (data resets
on restart). `GET /api/health` reports `store: postgres | memory`.

- Pool + auto-switch: [pool.ts](backend/src/db/pool.ts) (`dbActive()` flag)
- Migration + idempotent seed: `npm run migrate` ([migrate.ts](backend/src/db/migrate.ts), [001_app.sql](db/migrations/001_app.sql))
- Repos with DB/memory branches: users, wallet (atomic guarded debit + transactions
  ledger), detection providers, jobs
- `db/schema.sql` remains the full enterprise reference schema (partitioning/sharding);
  `db/migrations/001_app.sql` is the runnable subset the API uses today.

**One-time setup** (PostgreSQL 17/18 — both compatible):
```sql
-- as the postgres superuser (pgAdmin query tool or psql):
CREATE ROLE dataguard LOGIN PASSWORD 'your-password';
CREATE DATABASE dataguard OWNER dataguard;
```
Then set `DATABASE_URL=postgresql://dataguard:your-password@localhost:5432/dataguard`
in `backend/.env` and run `npm run migrate`. Verified: wallet balance + job history
survive a server restart (durable).

## Crypto payments (recharge)

Prepaid wallet top-ups via crypto. Pluggable gateway (like detection providers):
a mock provider simulates blockchain confirmations offline; a real provider
(NOWPayments) activates when `NOWPAYMENTS_API_KEY` is set.

- `POST /api/payments` `{ coin, credits }` → `{ address, amount, status, … }`
- `GET /api/payments/:id` → live `{ status, confirmations, … }`
- `GET /api/payments` → history · `POST /api/payments/webhook` → provider IPN (key-gate exempt)
- Lifecycle: `pending → confirming → confirmed → completed`; wallet is credited
  **exactly once** (idempotent guard), recorded in the transactions ledger.
- 1 credit = $0.0025. Recharge UI at `/recharge` with live confirmation progress.

Coins: USDT, BTC, ETH, TRX. Migration `004_payments.sql`.

## Async jobs — queue + workers

Bulk validation/detection run in the background so large uploads never block the
request. Submit returns a job id immediately; the UI polls for live progress.

- `POST /api/jobs` `{ numbers[], defaultCountry?, service, priority }` → `{ jobId, status, queue }`
- `GET /api/jobs/:id` → `{ status, processed, total_records, valid/invalid/dup, sample }`
- Processing is **chunked (5k)** with progress checkpoints after each chunk and a
  yield between chunks so the server stays responsive.

**Two modes** (auto-selected, like the DB):
| `REDIS_URL` set | Engine | Behavior |
|---|---|---|
| yes | BullMQ worker | persistent, retried (3×, backoff), priority, resumable across restarts |
| no | in-process | runs in background now; jobs lost on restart |

`GET /api/health` reports `queue: redis | memory`. To enable Redis locally: install
Memurai (Windows) or run Redis via WSL/Docker, then set `REDIS_URL=redis://localhost:6379`.

## Auth — JWT + 2FA + RBAC

Two independent auth mechanisms:
- **API key** (`x-api-key`) — programmatic data endpoints (`/validate`, `/detect`, …).
- **JWT** (`Authorization: Bearer`) — portal & admin endpoints (`/auth/*`, `/admin/*`).

Passwords are bcrypt-hashed; 2FA uses TOTP (otplib). Roles map to permissions in
[rbac.ts](backend/src/modules/auth/rbac.ts); admin provider routes require the
`detection.manage` permission.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` | self-signup → customer_owner + JWT |
| `POST /api/auth/login` | `{email,password,totp?}` → JWT (or `{error:"twofa_required"}`) |
| `GET  /api/auth/me` | current user (JWT) |
| `POST /api/auth/2fa/setup` | returns `{secret, otpauth}` for the QR |
| `POST /api/auth/2fa/enable` | confirm a code to turn 2FA on |
| `POST /api/auth/2fa/disable` | turn 2FA off |

**Demo accounts:** `admin@dataguard.io` / `admin123` (platform admin) ·
`owner@acme.com` / `owner123` (customer owner). Sign in at `/login`; manage 2FA on
the Admin overview. `JWT_SECRET` env var overrides the dev signing key.

## Number Detection — multiple providers, managed from admin

Endpoints: `POST /api/detect` (single) and `POST /api/detect-bulk` (batch).
Each number is first validated/normalized to E.164, then checked against the
**active** provider. Result `registration` is one of **registered | unregistered | unknown**
(plus `carrier`). Detection is priced highest (0.08 credits/number) since it
consumes paid lookups.

Providers are managed in **Admin → Detection providers**
([registry.ts](backend/src/modules/detection/registry.ts) +
[provider.ts](backend/src/modules/detection/provider.ts)). Many providers can be
configured; exactly one is active at a time.

| Type | Description |
|---|---|
| `mock` | deterministic, offline — default fallback (cannot be removed) |
| `apify` | runs an Apify Actor (WhatsApp/Telegram checker, HLR, etc.) |
| `http` | generic custom HTTP API (Bearer auth) |

**Admin API**
```
GET    /api/admin/detection-providers            list (secrets masked)
POST   /api/admin/detection-providers            add { name, type, settings }
PATCH  /api/admin/detection-providers/:id         edit { name?, enabled?, settings? }
POST   /api/admin/detection-providers/:id/activate  make active (exclusive)
DELETE /api/admin/detection-providers/:id         remove (not active / not mock)
```

**Apify setup** — in the admin UI, Configure the Apify provider:
- `actorId` — e.g. `your-username~whatsapp-number-checker`
- `token` — your Apify API token (stored server-side, masked in responses)
- `inputField` — the actor's input array field (default `phoneNumbers`)
- `resultField` — dataset item field holding the status (default `status`; the
  adapter also recognizes `isRegistered` / `exists` / `registered` booleans)

The adapter calls Apify's `run-sync-get-dataset-items` endpoint and maps the
first dataset item via `mapRegistration()`. Secrets are never returned to the
client (masked as `••••1234`), and a masked value sent back on update is ignored
so it never overwrites the stored secret.

For a generic HTTP provider, set `url`, `apiKey`, and `statusField` instead.

## Production path (next steps)

1. **Persistence** — apply `db/schema.sql`, replace the in-memory wallet/results
   Maps with Postgres (+ ClickHouse for `validation_results` at billions scale).
2. **Queue + workers** — move `bulk-validation` to BullMQ/Kafka workers, chunked +
   resumable; stream results, update `validation_jobs.processed`.
3. **Auth** — JWT + 2FA (TOTP), RBAC via `roles`/`permissions`, hash API keys.
4. **Crypto gateway** — address generation + blockchain webhook → `crypto_transactions`
   → auto-credit wallet.
5. **Ops** — Docker/K8s, NGINX LB, blue/green deploy, Prometheus/Grafana, pg_partman
   for auto-partitioning, encrypted backups.

---
© 2026 DataGuard Solutions. All Rights Reserved.
Developed by Steven | Innovation & Security Solutions
