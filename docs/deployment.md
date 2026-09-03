# Deployment and rollback runbook

The application is deployed through the Vercel Git integration. Pull requests
receive preview deployments and `main` is the production branch.

## Required repository settings

Repository files cannot enforce these settings. Configure them once in GitHub
and Vercel:

1. Protect `main` and require a pull request plus the
   `Lint, type-check, unit, and browser tests` status check before merging.
2. Disable bypassing the required check, including for administrators when that
   is practical.
3. In Vercel, prevent production deployment until the required GitHub check has
   passed. If that feature is unavailable on the current plan, keep automatic
   preview deployments but promote a tested preview to production manually.
4. Keep Preview and Production environment variables separately scoped. Preview
   deployments must not use the production Supabase service-role key.

## Application release

1. Open a pull request and wait for both the Vercel preview and GitHub `Tests`
   check to succeed.
2. Verify the preview URL with `DEPLOYMENT_URL=<url> npm run smoke` and inspect
   the affected user flow.
3. Merge only after required checks pass.
4. Confirm the production deployment references the merged commit.
5. Run `DEPLOYMENT_URL=https://www.bingetrack.ing npm run smoke` and inspect
   Vercel runtime errors after the deployment.

The `Deployment smoke test` workflow also runs when Vercel reports a successful
GitHub Deployment and can be started manually for any URL.

## Database release

`supabase/scripts/current_schema.sql` remains the reproducible schema snapshot
for a fresh database. For every new production schema change, also create a
versioned migration with `supabase migration new <descriptive-name>` and include
an explicit rollback plan in the pull request.

Use expand-and-contract changes so the old and new application versions can run
against the database during deployment:

1. Expand: add compatible columns, tables, indexes, functions, grants, and RLS.
2. Run the schema and pgTAP checks against a fresh local Supabase instance.
3. Apply and verify the production DDL before deploying code that requires it.
4. Deploy the application and run the production smoke test.
5. Contract in a later release only after old code no longer depends on the
   removed database objects.
6. Synchronize `supabase/scripts/current_schema.sql` with the verified final
   production state.

Do not apply the full snapshot to an existing database. Back up affected data
before destructive DDL. A rollback must identify whether the safe response is
application rollback, forward-fix SQL, or restoring data from backup.

## Application rollback

1. If the database remains backward-compatible, use Vercel Instant Rollback to
   restore the last known-good production deployment.
2. Run the production smoke test and inspect runtime logs.
3. If a database change is involved, do not blindly reverse it. Follow the
   reviewed rollback plan or deploy a forward-compatible application fix.
4. Record the failed commit, deployment URL, symptoms, and recovery action.

## Environment setup

The variable names and public placeholders are documented in `.env.example`.
For local development, link the Vercel project and pull Development variables
into the ignored `.env.local` file:

```sh
vercel link
vercel env pull .env.local --environment=development
npm run env:check
```

Environment changes affect only new Vercel deployments. Redeploy after rotating
or changing a variable.
