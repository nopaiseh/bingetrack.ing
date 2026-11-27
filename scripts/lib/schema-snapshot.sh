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

# Emit migration-owned event triggers + default privileges from live catalogs.
# supabase db dump --schema public omits database-level event triggers and global
# default ACLs; we re-attach them from pg_event_trigger / pg_default_acl so the
# snapshot tracks the rebuilt DB rather than hardcoded SQL.
append_migration_guards() {
  psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -At <<'SQL'
-- Always-quote identifiers so output matches pg_dump --quote-all-identifier.
-- qi(t) := '"' || replace(t, '"', '""') || '"'
-- ---------------------------------------------------------------------------
-- Event triggers whose handler lives in public (app migrations such as ensure_rls).
-- Columns used: name, event, tags, function, owner. Sorted by name.
-- ---------------------------------------------------------------------------
SELECT format(
  E'\nCREATE EVENT TRIGGER %s ON %s\n%s   EXECUTE FUNCTION %s.%s();\n\nALTER EVENT TRIGGER %s OWNER TO %s;\n',
  ('"' || replace((e.evtname)::text, '"', '""') || '"'),
  ('"' || replace((e.evtevent)::text, '"', '""') || '"'),
  CASE
    WHEN e.evttags IS NULL THEN ''
    ELSE format(
      E'         WHEN TAG IN (%s)\n',
      (
        SELECT string_agg(quote_literal(tag), ', ' ORDER BY tag)
        FROM unnest(e.evttags) AS tag
      )
    )
  END,
  ('"' || replace((n.nspname)::text, '"', '""') || '"'),
  ('"' || replace((p.proname)::text, '"', '""') || '"'),
  ('"' || replace((e.evtname)::text, '"', '""') || '"'),
  ('"' || replace((r.rolname)::text, '"', '""') || '"')
)
FROM pg_event_trigger e
JOIN pg_proc p ON p.oid = e.evtfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = e.evtowner
WHERE n.nspname = 'public'
ORDER BY e.evtname;

-- ---------------------------------------------------------------------------
-- Default privileges for role postgres that dump --schema public omits:
-- global rows (defaclnamespace = 0). Sorted by object type.
-- Format is fixed: quoted identifiers, privileges in a stable order, ALL when
-- the privilege set is complete for that object class.
-- ---------------------------------------------------------------------------
WITH
obj AS (
  SELECT *
  FROM (VALUES
    ('r'::"char", 'TABLES'::text, ARRAY['INSERT','SELECT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']::text[]),
    ('S'::"char", 'SEQUENCES'::text, ARRAY['USAGE','SELECT','UPDATE']::text[]),
    ('f'::"char", 'FUNCTIONS'::text, ARRAY['EXECUTE']::text[]),
    ('T'::"char", 'TYPES'::text, ARRAY['USAGE']::text[])
  ) AS v(obj_char, obj_type, priv_order)
),
acl_rows AS (
  SELECT
    d.defaclrole,
    d.defaclnamespace,
    d.defaclobjtype,
    d.defaclacl,
    r.rolname AS role_name,
    o.obj_type,
    o.priv_order,
    acldefault(d.defaclobjtype, d.defaclrole) AS default_acl
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid = d.defaclrole
  JOIN obj o ON o.obj_char = d.defaclobjtype
  WHERE d.defaclrole = 'postgres'::regrole
    AND d.defaclnamespace = 0
),
-- Privileges present in the default ACL but missing from the actual ACL → REVOKE
revokes AS (
  SELECT
    a.role_name,
    a.obj_type,
    a.priv_order,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END AS grantee_key,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE ('"' || replace((x.grantee::regrole::text)::text, '"', '""') || '"') END AS grantee_sql,
    x.privilege_type,
    x.is_grantable
  FROM acl_rows a
  CROSS JOIN LATERAL aclexplode(a.default_acl) AS x
  WHERE NOT EXISTS (
    SELECT 1
    FROM aclexplode(a.defaclacl) AS y
    WHERE y.grantee = x.grantee
      AND y.privilege_type = x.privilege_type
      AND y.is_grantable = x.is_grantable
  )
),
revoke_grouped AS (
  SELECT
    role_name,
    obj_type,
    priv_order,
    grantee_key,
    grantee_sql,
    array_agg(upper(privilege_type) ORDER BY array_position(priv_order, upper(privilege_type))) AS privs
  FROM revokes
  GROUP BY role_name, obj_type, priv_order, grantee_key, grantee_sql
),
revoke_sql AS (
  SELECT
    1 AS kind_order,
    role_name,
    obj_type,
    grantee_key,
    CASE
      WHEN privs = priv_order THEN
        format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %s REVOKE ALL ON %s FROM %s;',
          ('"' || replace((role_name)::text, '"', '""') || '"'), obj_type, grantee_sql
        )
      ELSE
        format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %s REVOKE %s ON %s FROM %s;',
          ('"' || replace((role_name)::text, '"', '""') || '"'), array_to_string(privs, ','), obj_type, grantee_sql
        )
    END AS ddl
  FROM revoke_grouped
),
-- Privileges present in the actual ACL but not in the default ACL → GRANT
grants AS (
  SELECT
    a.role_name,
    a.obj_type,
    a.priv_order,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END AS grantee_key,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE ('"' || replace((x.grantee::regrole::text)::text, '"', '""') || '"') END AS grantee_sql,
    x.privilege_type,
    x.is_grantable
  FROM acl_rows a
  CROSS JOIN LATERAL aclexplode(a.defaclacl) AS x
  WHERE NOT EXISTS (
    SELECT 1
    FROM aclexplode(a.default_acl) AS y
    WHERE y.grantee = x.grantee
      AND y.privilege_type = x.privilege_type
      AND y.is_grantable = x.is_grantable
  )
),
grant_grouped AS (
  SELECT
    role_name,
    obj_type,
    priv_order,
    grantee_key,
    grantee_sql,
    bool_or(is_grantable) AS any_grant_option,
    array_agg(upper(privilege_type) ORDER BY array_position(priv_order, upper(privilege_type))) AS privs
  FROM grants
  GROUP BY role_name, obj_type, priv_order, grantee_key, grantee_sql
),
grant_sql AS (
  SELECT
    2 AS kind_order,
    role_name,
    obj_type,
    grantee_key,
    CASE
      WHEN privs = priv_order THEN
        format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %s GRANT ALL ON %s TO %s%s;',
          ('"' || replace((role_name)::text, '"', '""') || '"'),
          obj_type,
          grantee_sql,
          CASE WHEN any_grant_option THEN ' WITH GRANT OPTION' ELSE '' END
        )
      ELSE
        format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %s GRANT %s ON %s TO %s%s;',
          ('"' || replace((role_name)::text, '"', '""') || '"'),
          array_to_string(privs, ','),
          obj_type,
          grantee_sql,
          CASE WHEN any_grant_option THEN ' WITH GRANT OPTION' ELSE '' END
        )
    END AS ddl
  FROM grant_grouped
)
SELECT E'\n' || ddl
FROM (
  SELECT * FROM revoke_sql
  UNION ALL
  SELECT * FROM grant_sql
) AS stmts
ORDER BY
  kind_order,
  CASE obj_type
    WHEN 'SEQUENCES' THEN 1
    WHEN 'FUNCTIONS' THEN 2
    WHEN 'TABLES' THEN 3
    WHEN 'TYPES' THEN 4
    ELSE 5
  END,
  grantee_key,
  ddl;
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
