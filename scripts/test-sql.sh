#!/usr/bin/env bash
# Applies migrations to a throwaway PostgreSQL database and runs SQL tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-sql.sh
set -euo pipefail
DB=${TEST_DB:-tr3s_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run database/test-support/supabase-stub.sql
for f in database/migrations/000[1-3]_*.sql; do run "$f"; done
run database/test-support/grants.sql
for t in tests/sql/*.sql; do echo "== $t"; run "$t"; done
echo "== tests/sql/concurrency.sh"; TEST_DB=$DB tests/sql/concurrency.sh
echo "SQL tests passed"
