#!/usr/bin/env bash
# Ricrea il database di prova locale e applica stub Supabase, migrazioni e seed.
# Uso: DATABASE_URL=postgres://tester:tester@localhost:5432/mizana_test scripts/db_reset_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${DATABASE_URL:-postgres://tester:tester@localhost:5432/mizana_test}"
ADMIN_URL="${URL%/*}/postgres"
DB="${URL##*/}"
psql "$ADMIN_URL" -qX -v ON_ERROR_STOP=1 -c "drop database if exists \"$DB\" with (force);" -c "create database \"$DB\";"
psql "$URL" -qX -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do
  psql "$URL" -qX -v ON_ERROR_STOP=1 -f "$f"
done
psql "$URL" -qX -v ON_ERROR_STOP=1 -f supabase/seed.sql
echo "database $DB pronto"
