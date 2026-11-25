-- search_media：转义用户输入中的 LIKE 通配符（%、_）与反斜杠，避免搜 %／_ 匹配全部。
-- 行为、签名、返回结构、权限与 SECURITY 与 20261121080000_search_media_person_filter 一致；
-- 仅在构造 pattern 前转义，并在全部 ILIKE 处显式 ESCAPE '\'。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

create or replace function public.search_media(
  p_query text default null,
  p_types text[] default '{}',
  p_series_only boolean default false,
  p_credit_roles text[] default '{}'
) returns setof public.v_all_media
language sql
stable
security invoker
parallel safe
as $$
  with opts as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      coalesce(p_types, '{}') as types,
      coalesce(p_credit_roles, '{}') as roles,
      coalesce(p_series_only, false) as series_only
  ), scope as (
    select
      term,
      -- 与 lib/admin/catalog.ts escapeLikePattern 一致：\ → \\，% → \%，_ → \_
      '%' || replace(replace(replace(term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pattern,
      series_only,
      all_categories,
      case
        when all_categories then array['movie', 'tv_show', 'album', 'music', 'book']
        else types
      end as searched_types,
      all_categories or series_only as searches_series,
      -- 无分类：全部人物角色；显式角色：用传入值；仅类型：仍搜该类型下全部演职。
      case
        when all_categories or (cardinality(roles) = 0 and cardinality(types) > 0)
          then array['director', 'actor', 'artist', 'author', 'lyricist', 'composer']
        else roles
      end as searched_roles,
      -- 显式人物角色时要求人名命中（与类型／系列组合为 AND，关闭纯标题与系列名命中）。
      cardinality(roles) > 0 as require_person
    from (
      select *, term is not null and cardinality(types) = 0 and not series_only and cardinality(roles) = 0 as all_categories
      from opts
    ) resolved
  ), series_members as (
    select mis.media_item_id as id
    from public.media_item_series mis
    join public.media_series ms on ms.id = mis.series_id
    cross join scope
    where scope.searches_series
      and (scope.term is null or ms.name ilike scope.pattern escape E'\\')
  ), matched as (
    select id from series_members cross join scope
    where scope.term is not null
      and not scope.require_person
    union
    select m.id
    from public.v_all_media m cross join scope
    where scope.term is not null
      and not scope.require_person
      and m.type::text = any(scope.searched_types)
      and (m.title ilike scope.pattern escape E'\\' or m.alternate_title ilike scope.pattern escape E'\\')
    union
    select m.id
    from public.v_all_media m cross join scope
    where scope.term is not null
      and not scope.require_person
      and scope.series_only
      and (m.title ilike scope.pattern escape E'\\' or m.alternate_title ilike scope.pattern escape E'\\')
      and exists (select 1 from public.media_item_series s where s.media_item_id = m.id)
    union
    select mc.media_item_id
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    join public.media_items mi on mi.id = mc.media_item_id
    cross join scope
    where scope.term is not null
      and cardinality(scope.searched_roles) > 0
      and mc.role::text = any(scope.searched_roles)
      and (p.name ilike scope.pattern escape E'\\' or p.alternate_name ilike scope.pattern escape E'\\')
      and (
        cardinality(scope.searched_types) = 0
        or mi.type::text = any(scope.searched_types)
      )
      -- 系列模式 + 人物：仅保留系列成员上的演职命中。
      and (
        not scope.series_only
        or exists (select 1 from public.media_item_series s where s.media_item_id = mc.media_item_id)
      )
  )
  select m.*
  from public.v_all_media m cross join scope
  where case
    when scope.term is not null then m.id in (select id from matched)
    when scope.series_only and cardinality(scope.searched_types) > 0
      then m.type::text = any(scope.searched_types) or m.id in (select id from series_members)
    when scope.series_only then m.id in (select id from series_members)
    when cardinality(scope.searched_types) > 0 then m.type::text = any(scope.searched_types)
    else true
  end;
$$;

revoke all on function public.search_media(text, text[], boolean, text[]) from public;
grant execute on function public.search_media(text, text[], boolean, text[]) to anon, authenticated, service_role;

-- CREATE OR REPLACE 可能清掉函数配置；重新固定 search_path 以满足 advisor。
alter function public.search_media(text, text[], boolean, text[]) set search_path = '';
