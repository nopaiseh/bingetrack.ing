#!/usr/bin/env bash
# Shared helpers for regenerating and comparing supabase/schema_snapshot.sql.
set -euo pipefail

SCHEMA_SNAPSHOT_PATH="${SCHEMA_SNAPSHOT_PATH:-supabase/schema_snapshot.sql}"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

normalize_schema_sql() {
  # Strip dump noise that is not structural: comments, psql meta, blank-run padding,
  # and trailing whitespace. Idempotent: re-normalizing the output must not change it.
  sed -E \
    -e '/^--/d' \
    -e '/^\\restrict /d' \
    -e '/^\\unrestrict /d' \
    -e 's/[[:space:]]+$//' \
    | awk '
      BEGIN { blank = 0; pending_blank = 0 }
      NF == 0 {
        if (blank == 0) pending_blank = 1
        blank++
        next
      }
      {
        if (pending_blank) print ""
        pending_blank = 0
        blank = 0
        print
      }
    '
}

append_migration_guards() {
  # supabase db dump --schema public intentionally omits database-level event
  # triggers and global default privileges. Re-attach the guards that live in
  # migrations so the snapshot stays honest about ensure_rls + EXECUTE defaults.
  cat <<'SQL'


CREATE EVENT TRIGGER "ensure_rls" ON "ddl_command_end"
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION "public"."rls_auto_enable"();


ALTER EVENT TRIGGER "ensure_rls" OWNER TO "postgres";


ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;
SQL
}

dump_public_schema_raw() {
  local out="$1"
  local tmp
  tmp="$(mktemp)"

  supabase db dump --local --schema public --file "$tmp"

  {
    cat "$tmp"
    append_migration_guards
  } | normalize_schema_sql >"$out"

  rm -f "$tmp"
}

require_local_db() {
  if ! psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1' >/dev/null 2>&1; then
    echo "Local Supabase Postgres is not reachable at ${LOCAL_DB_URL}." >&2
    echo "Start it with: supabase start   (or: supabase db reset)" >&2
    exit 1
  fi
}
