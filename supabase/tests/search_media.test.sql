begin;

select plan(12);

select ok(
  has_function_privilege('anon', 'public.search_media(text, text[], boolean, text[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.search_media(text, text[], boolean, text[])', 'EXECUTE'),
  'public roles can execute the search RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.search_media(text, text[], boolean, text[])'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) and not exists (
    select 1 from pg_proc
    where oid = 'public.search_media(text, text[], boolean, text[])'::regprocedure and prosecdef
  ),
  'search RPC has no PUBLIC grant and runs with invoker privileges'
);

select ok(
  (
    select exists (
      select 1
      from unnest(proconfig) as cfg
      where cfg like 'search_path=%'
    )
    from pg_proc
    where oid = 'public.search_media(text, text[], boolean, text[])'::regprocedure
  ),
  'search RPC locks search_path so the advisor is satisfied'
);

-- 超过旧版 100 个 ID 上限的标题命中，用于验证结果不再被截断。
insert into public.media_items (id, type, title, release_date)
select ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'movie', '检索上限回归 ' || n, '2020-01-01'
from generate_series(1, 150) as n;

insert into public.people (id, name, alternate_name) values
  ('71000000-0000-4000-8000-000000000001', '检索测试演员', 'Search Fixture Actor');
insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('70000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'actor', 0);

insert into public.media_series (id, name) values
  ('72000000-0000-4000-8000-000000000001', '检索测试系列');
insert into public.media_item_series (media_item_id, series_id, position) values
  ('70000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 1),
  ('70000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 2);

-- LIKE 通配符字面匹配：标题含 %／_ 的条目，以及不含通配符的对照条目。
insert into public.media_items (id, type, title, release_date) values
  ('73000000-0000-4000-8000-000000000001', 'movie', '100% 完成度', '2021-01-01'),
  ('73000000-0000-4000-8000-000000000002', 'movie', 'under_score 片名', '2021-02-01'),
  ('73000000-0000-4000-8000-000000000003', 'movie', '普通片名无通配', '2021-03-01');

set local role anon;

select is(
  (select count(*)::integer from public.search_media('检索上限回归')),
  150,
  'keyword search returns every title match instead of the first 100'
);

select is(
  (select count(*)::integer from public.search_media('检索上限回归', array['tv_show'])),
  0,
  'a type category limits title matches to that type'
);

select results_eq(
  $$select id from public.search_media('Search Fixture Actor')$$,
  $$values ('70000000-0000-4000-8000-000000000001'::uuid)$$,
  'uncategorised keyword search matches credited people by alternate name'
);

select is(
  (select count(*)::integer from public.search_media('检索测试演员', '{}', false, array['director'])),
  0,
  'a credit-role category only matches that role'
);

select is(
  (select count(*)::integer from public.search_media('检索测试系列')),
  2,
  'uncategorised keyword search matches collection names'
);

select ok(
  (select count(*) from public.search_media(null, '{}', true)
   where id in ('70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003')) = 2
  and not exists (select 1 from public.search_media(null, '{}', true) where id = '70000000-0000-4000-8000-000000000004'),
  'series-only browsing without a keyword returns exactly the collection members'
);

select ok(
  (select count(*) from public.search_media('检索上限回归 1', '{}', true)) = 0
  and (select count(*) from public.search_media('检索上限回归 2', '{}', true)) = 1,
  'series-only keyword search keeps title matches that belong to a collection'
);

select ok(
  (select count(*)::integer from public.search_media('%')) = 1
  and exists (
    select 1 from public.search_media('%')
    where id = '73000000-0000-4000-8000-000000000001'
  )
  and not exists (
    select 1 from public.search_media('%')
    where id in (
      '73000000-0000-4000-8000-000000000002',
      '73000000-0000-4000-8000-000000000003',
      '70000000-0000-4000-8000-000000000001'
    )
  ),
  'keyword percent matches only titles containing a literal percent sign'
);

select ok(
  (select count(*)::integer from public.search_media('_')) = 1
  and exists (
    select 1 from public.search_media('_')
    where id = '73000000-0000-4000-8000-000000000002'
  )
  and not exists (
    select 1 from public.search_media('_')
    where id in (
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000003',
      '70000000-0000-4000-8000-000000000001'
    )
  ),
  'keyword underscore matches only titles containing a literal underscore'
);

reset role;

select * from finish();
rollback;
