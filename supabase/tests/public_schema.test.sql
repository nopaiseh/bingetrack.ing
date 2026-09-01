begin;

select plan(5);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  ),
  16,
  'all public tables have RLS enabled'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v')
      and has_table_privilege('anon', c.oid, 'MAINTAIN')
  ),
  'anon cannot maintain public relations'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v')
      and has_table_privilege('authenticated', c.oid, 'MAINTAIN')
  ),
  'authenticated cannot maintain public relations'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and roles = array['anon', 'authenticated']::name[]
  ),
  16,
  'all public-read policies target anon and authenticated'
);

create table public.rls_test_probe (id integer);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'rls_test_probe'
  ),
  'the event trigger enables RLS on new public tables'
);

select * from finish();
rollback;
