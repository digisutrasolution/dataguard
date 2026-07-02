#!/bin/sh
# Restore an encrypted backup: ./restore.sh dataguard-YYYYMMDD-HHMMSS.sql.gz.enc
# Requires: DATABASE_URL, BACKUP_PASSPHRASE. WARNING: applies onto the target DB.
set -e
: "${DATABASE_URL:?DATABASE_URL required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required}"
FILE="${1:?usage: restore.sh <backup-file>}"

openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$BACKUP_PASSPHRASE" -in "$FILE" | \
  gunzip | psql "$DATABASE_URL"

echo "restore complete from: $FILE"
