#!/usr/bin/env bash
# Rebuild the local DB from migrations and refresh supabase/schema_snapshot.sql.
#
# Usage (from repo root, with Docker available):
#   supabase start          # once
#   npm run db:schema:snapshot
#
# Or in one shot when Supabase is already running:
#   ./scripts/regenerate-schema-snapshot.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/schema-snapshot.sh
source "${ROOT}/scripts/lib/schema-snapshot.sh"

RESET="${RESET:-1}"

require_local_db

if [[ "$RESET" == "1" ]]; then
  echo "Rebuilding local database from migrations (supabase db reset)..."
  supabase db reset
fi

echo "Dumping public schema (+ ensure_rls + default privileges)..."
dump_public_schema_raw "$SCHEMA_SNAPSHOT_PATH"

if ! grep -q 'CREATE EVENT TRIGGER "ensure_rls"' "$SCHEMA_SNAPSHOT_PATH"; then
  echo "Snapshot is missing ensure_rls after regenerate." >&2
  exit 1
fi
if ! grep -q 'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC' "$SCHEMA_SNAPSHOT_PATH"; then
  echo "Snapshot is missing global ALTER DEFAULT PRIVILEGES after regenerate." >&2
  exit 1
fi

echo "Wrote ${SCHEMA_SNAPSHOT_PATH}"
echo "Commit this file together with any migration that changes the public schema."
