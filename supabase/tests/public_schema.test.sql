begin;

select plan(15);

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

select ok(
  has_function_privilege('anon', 'public.get_top_tv_series_by_year(integer, integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_top_tv_series_by_year(integer, integer)', 'EXECUTE'),
  'public roles can execute the year-specific TV ranking RPC'
);

select ok(
  has_function_privilege('anon', 'public.get_media_distribution_counts()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_media_distribution_counts()', 'EXECUTE'),
  'public roles can execute the media distribution RPC'
);

select ok(
  has_function_privilege('anon', 'public.get_media_stats(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_media_stats(text)', 'EXECUTE'),
  'public roles can execute the media stats RPC'
);

select ok(
  has_function_privilege('anon', 'public.get_season_episode_page(uuid, uuid, text, text, integer, integer)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_season_episode_page(uuid, uuid, text, text, integer, integer)', 'EXECUTE'),
  'public roles can execute the season episode RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid in (
      'public.get_top_tv_series_by_year(integer, integer)'::regprocedure,
      'public.get_media_distribution_counts()'::regprocedure,
      'public.get_media_stats(text)'::regprocedure,
      'public.get_season_episode_page(uuid, uuid, text, text, integer, integer)'::regprocedure
    )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no implicit execute privilege on public read RPCs'
);

select ok(
  not exists (
    select 1
    from pg_proc
    where oid in (
      'public.get_top_tv_series_by_year(integer, integer)'::regprocedure,
      'public.get_media_distribution_counts()'::regprocedure,
      'public.get_media_stats(text)'::regprocedure,
      'public.get_season_episode_page(uuid, uuid, text, text, integer, integer)'::regprocedure
    )
      and prosecdef
  ),
  'public read RPCs execute with invoker privileges'
);

select ok(
  has_function_privilege('service_role', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'),
  'the RLS event-trigger function remains service-role-only'
);

set local role anon;

select results_eq(
  $$select * from public.get_media_stats('movie')$$,
  $$
    select
      count(*) as total,
      count(*) filter (where media.status = 'watched') as watched,
      count(*) filter (where media.status = 'watching') as watching,
      count(*) filter (where media.status = 'want_to_watch') as want,
      count(*) filter (where media.sort_date >= current_date) as upcoming
    from public.v_all_media as media
    where media.type::text = 'movie'
  $$,
  'anonymous media stats match the equivalent direct read query'
);

reset role;

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('v_media_series_years', 'v_media_season_summaries')
     and c.reloptions @> array['security_invoker=true']),
  2,
  'both media aggregate views respect caller permissions and RLS'
);

select ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) roles(name)
    where n.nspname = 'public'
      and c.relname in ('v_media_series_years', 'v_media_season_summaries')
      and (not has_table_privilege(roles.name, c.oid, 'SELECT')
        or has_table_privilege(roles.name, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))
  ),
  'public readers have only read access to the media aggregate views'
);

select * from finish();
rollback;
