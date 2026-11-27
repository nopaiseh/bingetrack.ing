#!/usr/bin/env bash
# Compare supabase/schema_snapshot.sql to a fresh dump of a DB rebuilt from migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/schema-snapshot.sh
source "${ROOT}/scripts/lib/schema-snapshot.sh"

RESET="${RESET:-0}"

if [[ ! -f "$SCHEMA_SNAPSHOT_PATH" ]]; then
  echo "Missing ${SCHEMA_SNAPSHOT_PATH}." >&2
  echo "Generate it with: npm run db:schema:snapshot" >&2
  exit 1
fi

require_local_db

if [[ "$RESET" == "1" ]]; then
  echo "Rebuilding local database from migrations (supabase db reset)..."
  supabase db reset
fi

tmp_dump="$(mktemp)"
tmp_committed="$(mktemp)"
trap 'rm -f "$tmp_dump" "$tmp_committed"' EXIT

echo "Dumping public schema from the local database..."
dump_public_schema_raw "$tmp_dump"
normalize_schema_sql <"$SCHEMA_SNAPSHOT_PATH" >"$tmp_committed"

if cmp -s "$tmp_committed" "$tmp_dump"; then
  echo "Schema snapshot matches migrations (${SCHEMA_SNAPSHOT_PATH})."
  exit 0
fi

echo "Schema snapshot drift detected." >&2
echo "Committed file: ${SCHEMA_SNAPSHOT_PATH}" >&2
echo "Fresh dump (normalized) differs. First diff hunks:" >&2
diff -u "$tmp_committed" "$tmp_dump" | head -n 80 >&2 || true
echo >&2
echo "To regenerate the snapshot after intentional schema changes:" >&2
echo "  1. Ensure Docker is running and the repo root is the working directory." >&2
echo "  2. supabase start   # if not already running" >&2
echo "  3. npm run db:schema:snapshot" >&2
echo "  4. Commit supabase/schema_snapshot.sql with the migration PR." >&2
exit 1
