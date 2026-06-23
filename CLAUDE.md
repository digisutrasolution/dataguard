# CLAUDE.md — DataGuard Solutions

Enterprise global phone validation & data intelligence SaaS. This is a runnable
starter being built in verified increments. Brand footer: "© 2026 DataGuard
Solutions — Developed by Steven | Innovation & Security Solutions".

## Monorepo layout
```
dataguard/
├── db/
│   ├── schema.sql               full enterprise reference schema (partitioning/sharding) — NOT auto-run
│   └── migrations/001_app.sql   runnable subset the API actually uses (applied by npm run migrate)
├── backend/                     TypeScript + Express API + validation/detection engine
│   └── src/
│       ├── server.ts            all routes; API-key gate for data API, JWT for /auth & /admin
│       ├── db/                  pool.ts (Postgres↔memory switch), migrate.ts (migrate + seed)
│       └── modules/
│           ├── validation/      engine.ts (libphonenumber-js): validate, bulk, generate
│           ├── detection/       provider.ts (mock/http/apify), registry.ts (admin-managed, 1 active)
│           ├── wallet/          wallet.ts (pricing + atomic guarded debit + tx ledger)
│           ├── auth/            users, jwt, rbac, middleware, service (login/2FA)
│           └── jobs/            jobs.ts (validation_jobs history)
└── frontend/                    React + Vite + react-router (dark/light)
    └── src/
        ├── App.tsx              sidebar + routes; Protected wrapper for /admin/*
        ├── lib/api.ts           API client (x-api-key + Bearer), setAuthToken
        ├── lib/auth.tsx         AuthProvider context (token in localStorage)
        └── pages/               CustomerDashboard, Validate, AdminDashboard, Providers, Login
```

## Run (Windows PowerShell 5.1 — IMPORTANT)
This shell does **not** support `&&`. Use `;` or separate lines. Two terminals
(both servers are long-running):
```powershell
cd "D:\Claude Dev\dataguard\backend"; npm run dev     # :4000
cd "D:\Claude Dev\dataguard\frontend"; npm run dev    # :5173  ← open this
```
Frontend dev server proxies `/api` → `http://localhost:4000`. Sign in at `/login`.

Backend scripts: `npm run dev` (tsx watch), `npm run migrate`, `npm run typecheck`
(tsx does NOT type-check — run `npm run typecheck` before claiming a backend change compiles).

## Auth & access
- Two mechanisms: `x-api-key: demo-key` for the programmatic data API
  (`/validate`, `/bulk-validation`, `/detect*`, `/generate`, `/balance`, `/history`);
  JWT `Authorization: Bearer` for `/auth/*` and `/admin/*` (exempt from the key gate).
- RBAC permissions in `modules/auth/rbac.ts`; admin provider routes require `detection.manage`.
- Demo logins: `admin@dataguard.io` / `admin123` (admin), `owner@acme.com` / `owner123` (customer_owner).
- 2FA = TOTP (otplib); set up from Admin → Overview.

## Database (PostgreSQL)
- Installed locally: **PostgreSQL 17**, service `postgresql-x64-17`, port 5432. NO Docker.
  (User may say "18" — that's pgAdmin's version, not the server.)
- App role/db: `dataguard` / `dataguard`. Connection string lives in `backend/.env` as
  `DATABASE_URL`. If unset/unreachable, the app falls back to in-memory Maps (data resets).
  `GET /api/health` reports `store: postgres | memory`.
- Setup is privileged: creating roles / restarting the pg service needs the `postgres`
  superuser password or Windows admin. **Claude has NEITHER here** — ask the user to run
  privileged DB ops via pgAdmin or psql (`C:\Program Files\PostgreSQL\17\bin\psql.exe`).
- After schema changes: edit `db/migrations/*.sql`, run `npm run migrate` (idempotent seed).
- repos pattern: every repo branches on `dbActive()` — keep BOTH the SQL path and the
  in-memory fallback working when editing users/wallet/registry/jobs.

## Conventions
- ESM (`"type": "module"`) — local imports use `.js` extensions in TS source.
- Validation/pricing logic is pure & sync; data-access (repos) is async.
- Secrets (provider tokens/api keys) are masked on read (`••••1234`) and a masked value
  sent back on update is ignored so it never overwrites the real secret.
- `.env` is git-ignored-style (a dotfile; hidden in Explorer). `.env.example` is the template.

## Status
Done: validation engine, generator, Number Detection (multi-provider incl. Apify),
auth (JWT+2FA+RBAC), PostgreSQL persistence (verified durable across restart).
Stubbed/next: queue + workers (resumable billion-scale bulk → needs Redis),
ClickHouse for `validation_results` analytics, crypto gateway webhooks, K8s/ops.

## Gotchas
- Port 4000 EADDRINUSE: `tsx watch` spawns a child node that holds the port; killing only
  the watcher orphans it. Kill by port AND by command-line match (node procs matching
  `dataguard|tsx`). See prior cleanup commands.
- Before production: rotate `API_KEY` (still `demo-key`), set a strong `JWT_SECRET`, and
  change the seeded demo passwords.
