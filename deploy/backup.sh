#!/bin/sh
# Encrypted Postgres backup. Run on the host (cron) or in a sidecar with the
# postgres client installed. Requires: DATABASE_URL, BACKUP_PASSPHRASE.
# Optional off-site: S3_BUCKET (+ aws cli configured).
set -e
: "${DATABASE_URL:?DATABASE_URL required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required}"
DIR="${BACKUP_DIR:-/backups}"
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/dataguard-$STAMP.sql.gz.enc"

pg_dump "$DATABASE_URL" | gzip | \
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$BACKUP_PASSPHRASE" -out "$OUT"

# Retention: keep 30 days locally
find "$DIR" -name 'dataguard-*.sql.gz.enc' -mtime +30 -delete 2>/dev/null || true

# Optional off-site copy
if [ -n "$S3_BUCKET" ]; then
  aws s3 cp "$OUT" "s3://$S3_BUCKET/backups/$(basename "$OUT")"
fi

echo "backup complete: $OUT ($(du -h "$OUT" | cut -f1))"
