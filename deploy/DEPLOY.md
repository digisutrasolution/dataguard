# DataGuard — Deployment (single node)

Containerized stack: **web** (Caddy: TLS + static + `/api` proxy) → **api**
(Express + BullMQ worker) → **postgres** + **redis**. One command to run.

## Prerequisites
- A server (recommended: **DigitalOcean Droplet, Bangalore**, 4 vCPU / 8 GB to start).
- A domain pointing an A record at the droplet's IP (for HTTPS).
- Docker + Compose on the server.

```bash
# On a fresh Ubuntu droplet:
curl -fsSL https://get.docker.com | sh
```

## 1. Get the code + configure
```bash
git clone https://github.com/digisutrasolution/dataguard.git
cd dataguard
cp .env.production.example .env
nano .env   # set the secrets below
```
Set in `.env`:
- `POSTGRES_PASSWORD` — strong DB password
- `JWT_SECRET` — long random (≥32 chars): `openssl rand -base64 48`
- `API_KEY` — programmatic key: `openssl rand -hex 24`
- `SITE_ADDRESS` — your domain, e.g. `app.dataguard.io` (or `:80` to test without TLS)
- `BACKUP_PASSPHRASE` — backup encryption key

## 2. Launch
```bash
docker compose up -d --build
```
- Migrations run automatically on the api container's first start.
- Caddy auto-provisions a Let's Encrypt certificate once `SITE_ADDRESS` is a real
  domain resolving to this server (ports 80 + 443 must be open).
- Check: `curl https://app.dataguard.io/api/health` → `{"status":"ok",...}`

## First-login secret rotation (do immediately)
The seed creates demo logins (`admin@dataguard.io/admin123`, `owner@acme.com/owner123`).
Before real use: sign in, create your own admin, and remove/disable the demos.
Also confirm `JWT_SECRET`/`API_KEY` are not the demo values (the API refuses to
boot in production with a weak/missing `JWT_SECRET`).

## Option B — managed Postgres/Redis (recommended for production)
Use **DO Managed Postgres + Redis (Bangalore)** for automated backups, PITR, and
failover. Then remove the `postgres`/`redis` services from `docker-compose.yml`
and point the api at the managed endpoints in `.env`:
```
DATABASE_URL=postgresql://user:pass@managed-pg-host:25060/dataguard?sslmode=require
REDIS_URL=rediss://default:pass@managed-redis-host:25061
```
(Managed Postgres handles backups — the scripts below are for the self-hosted DB.)

## Backups (self-hosted DB)
`deploy/backup.sh` writes an AES-256 encrypted, gzipped `pg_dump`; keeps 30 days;
optional off-site to DO Spaces/S3. Schedule hourly/daily via host cron:
```bash
# hourly incremental-style dump (edit paths/env)
0 * * * * cd /root/dataguard && DATABASE_URL=... BACKUP_PASSPHRASE=... BACKUP_DIR=/root/backups sh deploy/backup.sh >> /var/log/dg-backup.log 2>&1
```
Restore: `sh deploy/restore.sh /root/backups/dataguard-YYYYMMDD-HHMMSS.sql.gz.enc`

## Monitoring & alerts
- Liveness: `GET /api/health` returns `store`, `queue`, `uptimeSec`, `rssMb`.
- Point **UptimeRobot** or **DO Monitoring** at `/api/health` for uptime + alerts.
- Logs: `docker compose logs -f api` / `web`.

## Update / redeploy
```bash
git pull
docker compose up -d --build   # rolling-ish; api restarts, migrations re-run (idempotent)
```

## Rollback
```bash
git checkout <previous-tag-or-commit>
docker compose up -d --build
```

## Scaling later (beyond single node)
Split the in-process worker into its own service, add more api replicas behind
Caddy, move Postgres/Redis to managed clusters, and add ClickHouse for
billion-row analytics — see the main README roadmap.
