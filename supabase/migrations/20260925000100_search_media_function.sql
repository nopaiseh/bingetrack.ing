-- 在数据库内完成关键词与分类匹配，替代应用先取 ID 再以 URL 回传（最多 100 个）的做法。
-- 返回 v_all_media 行，状态、类型标签、年份、排序、分页和精确计数继续由 PostgREST 叠加。
--
-- 匹配规则与原应用逻辑一致：
-- * 有关键词且未限定分类：搜索电影与电视剧标题、作品系列名、导演与演员姓名。
-- * 有关键词且限定分类：各分类命中取并集；“系列”分类还包含标题命中且属于任意系列的条目。
-- * 无关键词：按类型筛选；“系列”分类为所有系列成员（与类型筛选取并集）。
-- 关键词中的 % 和 _ 保留 ILIKE 通配含义。
create function public.search_media(
  p_query text default null,
  p_types text[] default '{}',
  p_series_only boolean default false,
  p_credit_roles text[] default '{}'
) returns setof public.v_all_media
language sql stable security invoker set search_path = ''
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
      '%' || term || '%' as pattern,
      series_only,
      all_categories,
      case when all_categories then array['movie', 'tv_series'] else types end as searched_types,
      all_categories or series_only as searches_series,
      case when all_categories then array['director', 'actor'] else roles end as searched_roles
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
      and (scope.term is null or ms.name ilike scope.pattern)
  ), matched as (
    select id from series_members cross join scope where scope.term is not null
    union
    select m.id
    from public.v_all_media m cross join scope
    where scope.term is not null
      and m.type::text = any(scope.searched_types)
      and (m.title ilike scope.pattern or m.alternate_title ilike scope.pattern)
    union
    select m.id
    from public.v_all_media m cross join scope
    where scope.term is not null
      and scope.series_only
      and (m.title ilike scope.pattern or m.alternate_title ilike scope.pattern)
      and exists (select 1 from public.media_item_series s where s.media_item_id = m.id)
    union
    select mc.media_item_id
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    cross join scope
    where scope.term is not null
      and mc.role::text = any(scope.searched_roles)
      and (p.name ilike scope.pattern or p.alternate_name ilike scope.pattern)
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
