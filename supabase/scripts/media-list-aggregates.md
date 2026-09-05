# Media list aggregate rollout

`media-list-aggregates.sql` was applied on 2026-09-06 to Media Vault as `add_media_list_aggregate_views`. The verified definitions are included in `current_schema.sql` for local database/CI setup. The application changes must be deployed separately; database deployment alone does not activate the optimized application query path.

1. Apply the SQL to the target database before deploying the application. It creates two ordinary `security_invoker` views and grants only SELECT to the existing public reader roles; base-table data and RLS policies remain unchanged.
2. Verify both views through the anonymous Data API. Compare year ranges, episode counts and watched counts with the existing nested queries, including empty seasons and future release dates. Card year ranges deliberately remain numeric rather than ending in `Present`.
3. Update `current_schema.sql` only after verifying the live deployment, and include the new views in local database/CI setup.
4. Deploy the application. Only missing-view errors (`PGRST205`/`42P01`) fall back to the old query; permission and network errors remain visible. Before SQL deployment, the fallback adds one unsuccessful request per aggregate lookup, so deploy the SQL first.

Rollback instructions are included in the SQL. Revert the application before dropping the views.

Validation so far: read-only SELECT bodies executed as `anon` against the live database; aggregated episode/watched totals matched base tables (30/24). Unit tests cover projection/count behavior, aggregates, empty seasons, numeric year ranges, and missing-view/error handling. Live deployment verification passed: both views have `security_invoker=true`; anon/authenticated can SELECT and cannot INSERT/UPDATE/DELETE/TRUNCATE. Anonymous Data API queries returned 3 season and 3 series rows; every season count, watched count and season/series year range matched the previous nested queries.

The existing search-category ID prequeries and their PostgREST row-limit/large-IN scalability constraint are separate from these aggregation views and are not changed here.
