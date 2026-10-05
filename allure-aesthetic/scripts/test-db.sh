#!/usr/bin/env bash
# Rebuilds a throwaway local database and runs: stubs -> migrations -> seed -> tests.
# Usage: scripts/test-db.sh            (needs a local Postgres 15+ and psql)
#        PGURL=postgres://... scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=${DB:-allure_test}
ADMIN_URL=${PGURL:-postgres://postgres@localhost:5432/postgres}
DB_URL=${ADMIN_URL%/*}/$DB
PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL "$ADMIN_URL" -c "drop database if exists $DB" -c "create database $DB"

$PSQL "$DB_URL" -f supabase/tests/00_supabase_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  $PSQL "$DB_URL" -f "$f"
done
echo "→ supabase/seed.sql"
$PSQL "$DB_URL" -f supabase/seed.sql
for f in supabase/tests/[1-9]*.sql; do
  echo "→ $f"
  $PSQL "$DB_URL" -f "$f"
done
echo "✓ all good"
