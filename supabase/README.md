# Supabase schema snapshot

The complete application-owned `public` schema lives in one file:

`scripts/current_schema.sql`

It creates the current types, tables, constraints, indexes, RLS policies,
views, functions, event triggers, and grants on a fresh Supabase database.
Supabase-managed schemas and application data are intentionally excluded.

## Schema-change workflow

For this personal project, the file is a current-state snapshot rather than an
append-only history:

1. Apply the schema change to the live project.
2. Update `scripts/current_schema.sql` so it rebuilds that same final
   state from scratch.
3. Review the security advisor and verify the affected query or API path.

The snapshot is an executable reference, not an append-only Supabase migration.
Updating it does not apply changes to an existing database; live DDL must be
applied explicitly.

## Fresh local database

With Docker available:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/current_schema.sql
```

Run this only against an empty Postgres 17 database.
