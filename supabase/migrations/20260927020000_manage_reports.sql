-- 管理页数据报告：每份报告一个视图，列结构一致，方便同一页面分页展示。
-- id 为行键；link_type 为媒体类型或关联资料类别，与 link_id 组成修正入口；
-- tags 为问题代码或名称列表；列表按 weight 倒序、sort_key 正序排列。

-- 名称比对键：NFKC 统一全角半角，去掉空白与标点后转小写，用于找出写法不同的同一人物。
create function public.manage_name_key(p_name text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select lower(regexp_replace(normalize(p_name, nfkc), '[[:space:][:punct:]·・．]+', '', 'g')) $$;

-- 疑似名字错误只给出可疑迹象，最终由站长判断；p_character 区分角色名与人物名的规则。
create function public.manage_name_issues(p_name text, p_character boolean) returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select array_remove(array[
    case when p_name ~ '^\s|\s$' then 'edge_space' end,
    case when p_name ~ '\s{2,}' then 'double_space' end,
    case when p_name ~ '[​-‏⁠﻿­]|[[:cntrl:]]' then 'invisible_char' end,
    case when p_name ~ '[０-９Ａ-Ｚａ-ｚ　]' then 'fullwidth' end,
    case when p_name ~ '[()（）\[\]【】]' then 'bracket_note' end,
    case when lower(btrim(p_name)) ~ '^([?？_.。*\-—]+|n/?a|tbd|tba|unknown|none|null|未知|待定|不详|无|暂无)$' then 'placeholder' end,
    case when p_name ~ '^\s*[,，、;；:：/／|｜·.。\-—]|[,，、;；:：/／|｜·\-—]\s*$' then 'edge_punct' end,
    -- 多个角色统一写作「A / B」。
    case when p_character and p_name ~ '[^ ]/|/[^ ]|[／、|｜;；]' then 'separator' end,
    case when not p_character and p_name ~ '[一-鿿]' and p_name ~ '[A-Za-z]' then 'mixed_script' end,
    case when not p_character and p_name ~ '[0-9０-９]' then 'digits' end,
    case when length(p_name) > case when p_character then 100 else 40 end then 'too_long' end
  ], null)
$$;

-- 季和单集的上级位置，供各报告显示条目所在的电视节目。
create view public.v_report_media_context
with (security_invoker = true) as
select
  m.id,
  m.type,
  m.title,
  case m.type
    when 'tv_season'::public.media_type then coalesce(show.title, '未知电视节目') || ' · 第 ' || s.season_number || ' 季'
    when 'tv_episode'::public.media_type then coalesce(ep_show.title, '未知电视节目') || ' · 第 ' || es.season_number || ' 季 · 第 ' || e.episode_number || ' 集'
  end as context
from public.media_items m
left join public.tv_seasons s on s.id = m.id
left join public.media_items show on show.id = s.series_id
left join public.tv_episodes e on e.id = m.id
left join public.tv_seasons es on es.id = e.season_id
left join public.media_items ep_show on ep_show.id = es.series_id;

-- 没有任何演职员条目、也不是专辑艺术家的人物。
create view public.v_report_orphan_people
with (security_invoker = true) as
select p.id::text as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  p.alternate_name as detail, '{}'::text[] as tags, 0 as weight, p.name as sort_key
from public.people p
where not exists (select 1 from public.media_credits mc where mc.person_id = p.id)
  and not exists (select 1 from public.music_albums a where a.artist_id = p.id);

-- 每部作品一行，列出尚未填写角色名的演员。
create view public.v_report_missing_character
with (security_invoker = true) as
select c.id::text as id, c.type::text as link_type, c.id as link_id, c.title, c.context as detail,
  array_agg(p.name order by mc.credit_order, p.name) as tags, count(*)::integer as weight, c.title as sort_key
from public.media_credits mc
join public.people p on p.id = mc.person_id
join public.v_report_media_context c on c.id = mc.media_item_id
where mc.role = 'actor'::public.person_role and mc.character_name is null
group by c.id, c.type, c.title, c.context;

-- 尚未填写别名的人物，参与作品多的排在前面。
create view public.v_report_missing_alias
with (security_invoker = true) as
select p.id::text as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  case when count(mc.media_item_id) = 0 then '未关联作品' else '参与 ' || count(distinct mc.media_item_id) || ' 部作品' end as detail,
  '{}'::text[] as tags, count(distinct mc.media_item_id)::integer as weight, p.name as sort_key
from public.people p
left join public.media_credits mc on mc.person_id = p.id
where coalesce(btrim(p.alternate_name), '') = ''
group by p.id, p.name;

-- 人物名与角色名的可疑写法；角色名另检查是否与演员同名。
create view public.v_report_suspicious_names
with (security_invoker = true) as
select 'people:' || p.id as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  nullif(btrim(p.alternate_name), '') as detail,
  public.manage_name_issues(p.name, false) as tags, 0 as weight, p.name as sort_key
from public.people p
where cardinality(public.manage_name_issues(p.name, false)) > 0
union all
select 'credit:' || mc.media_item_id || ':' || mc.person_id, c.type::text, c.id, mc.character_name,
  coalesce(c.context || ' · ', '') || c.title || ' · ' || p.name || ' 饰',
  public.manage_name_issues(mc.character_name, true)
    || case when public.manage_name_key(mc.character_name) = public.manage_name_key(p.name) then array['same_as_actor'] else '{}'::text[] end,
  0, mc.character_name
from public.media_credits mc
join public.people p on p.id = mc.person_id
join public.v_report_media_context c on c.id = mc.media_item_id
where mc.character_name is not null
  and (cardinality(public.manage_name_issues(mc.character_name, true)) > 0
    or public.manage_name_key(mc.character_name) = public.manage_name_key(p.name));

-- 比对键相同的人物：写法不同，或同名但有人未填别名。同名且别名各异属正常区分，不列出。
create view public.v_report_similar_people
with (security_invoker = true) as
with keyed as (
  select p.id, p.name, p.alternate_name, public.manage_name_key(p.name) as name_key
  from public.people p
), groups as (
  select name_key from keyed where name_key <> ''
  group by name_key
  having count(*) > 1 and (count(distinct name) > 1 or bool_or(coalesce(btrim(alternate_name), '') = ''))
)
select k.id::text as id, 'people'::text as link_type, k.id as link_id, k.name as title,
  coalesce(nullif(btrim(k.alternate_name), ''), '未填别名') as detail,
  array(
    select o.name || coalesce('（' || nullif(btrim(o.alternate_name), '') || '）', '')
    from keyed o where o.name_key = k.name_key and o.id <> k.id order by o.name, o.id
  ) as tags,
  0 as weight, k.name_key || ' ' || k.name as sort_key
from keyed k
join groups g on g.name_key = k.name_key;

-- 未被任何作品使用的类型、地区、语言与系列；tags 为资料类别。
create view public.v_report_unused_references
with (security_invoker = true) as
select 'genres:' || g.id as id, 'genres'::text as link_type, g.id as link_id, g.name as title,
  null::text as detail, array['genres'] as tags, 0 as weight, g.name as sort_key
from public.genres g where not exists (select 1 from public.media_genres x where x.genre_id = g.id)
union all
select 'regions:' || r.id, 'regions', r.id, r.name, null, array['regions'], 0, r.name
from public.regions r where not exists (select 1 from public.media_regions x where x.region_id = r.id)
union all
select 'languages:' || l.id, 'languages', l.id, l.name, null, array['languages'], 0, l.name
from public.languages l where not exists (select 1 from public.media_languages x where x.language_id = l.id)
union all
select 'collections:' || s.id, 'collections', s.id, s.name, s.alternate_name, array['collections'], 0, s.name
from public.media_series s where not exists (select 1 from public.media_item_series x where x.series_id = s.id);

-- 电影与电视节目的缺漏字段；单集只检查播出日期，因为季与节目的排序依赖它。
create view public.v_report_incomplete_media
with (security_invoker = true) as
select * from (
  select m.id::text as id, m.type::text as link_type, m.id as link_id, m.title, c.context as detail,
    array_remove(case when m.type = 'tv_episode'::public.media_type then array[
      case when m.release_date is null then 'no_release_date' end
    ] else array[
      case when nullif(btrim(m.cover_url), '') is null then 'no_cover' end,
      case when nullif(btrim(m.summary), '') is null then 'no_summary' end,
      case when m.type = 'movie'::public.media_type and m.release_date is null then 'no_release_date' end,
      case when not exists (select 1 from public.media_genres x where x.media_item_id = m.id) then 'no_genres' end,
      case when not exists (select 1 from public.media_regions x where x.media_item_id = m.id) then 'no_regions' end,
      case when not exists (select 1 from public.media_languages x where x.media_item_id = m.id) then 'no_languages' end,
      case when not exists (select 1 from public.media_credits x where x.media_item_id = m.id and x.role = 'actor'::public.person_role) then 'no_actors' end,
      case when not exists (select 1 from public.media_credits x where x.media_item_id = m.id and x.role = 'director'::public.person_role) then 'no_directors' end
    ] end, null) as tags,
    0 as weight, m.title as sort_key
  from public.media_items m
  join public.v_report_media_context c on c.id = m.id
  where m.type in ('movie'::public.media_type, 'tv_show'::public.media_type, 'tv_episode'::public.media_type)
) r
where cardinality(r.tags) > 0;

-- 没有季的节目、没有单集的季，以及季号、集号断号（编号 0 为特别篇，不参与断号检查）。
create view public.v_report_tv_structure
with (security_invoker = true) as
select m.id::text as id, m.type::text as link_type, m.id as link_id, m.title,
  case when gap.missing is null then null else '缺第 ' || array_to_string(gap.missing, '、') || ' 季' end as detail,
  array[case when gap.total = 0 then 'no_seasons' else 'season_gap' end] as tags, 0 as weight, m.title as sort_key
from public.media_items m
cross join lateral (
  select (select count(*) from public.tv_seasons s where s.series_id = m.id) as total,
    (select array_agg(n order by n) from generate_series(1, (select max(season_number) from public.tv_seasons s where s.series_id = m.id)) n
      where not exists (select 1 from public.tv_seasons s where s.series_id = m.id and s.season_number = n)) as missing
) gap
where m.type = 'tv_show'::public.media_type and (gap.total = 0 or gap.missing is not null)
union all
select m.id::text, m.type::text, m.id, m.title,
  c.context || case when gap.missing is null then '' else ' · 缺第 ' || array_to_string(gap.missing, '、') || ' 集' end,
  array[case when gap.total = 0 then 'no_episodes' else 'episode_gap' end], 0, c.context
from public.media_items m
join public.v_report_media_context c on c.id = m.id
cross join lateral (
  select (select count(*) from public.tv_episodes e where e.season_id = m.id) as total,
    (select array_agg(n order by n) from generate_series(1, (select max(episode_number) from public.tv_episodes e where e.season_id = m.id)) n
      where not exists (select 1 from public.tv_episodes e where e.season_id = m.id and e.episode_number = n)) as missing
) gap
where m.type = 'tv_season'::public.media_type and (gap.total = 0 or gap.missing is not null);

-- 想看却有评分，或已看的电影没有评分；节目与季的状态由单集推算，不检查。
create view public.v_report_tracking_conflicts
with (security_invoker = true) as
select m.id::text as id, m.type::text as link_type, m.id as link_id, m.title, c.context as detail,
  array[case when t.status = 'want_to_watch'::public.tracking_status then 'rating_unwatched' else 'watched_unrated' end] as tags,
  0 as weight, m.title as sort_key
from public.media_items m
join public.tracking t on t.media_item_id = m.id
join public.v_report_media_context c on c.id = m.id
where (m.type in ('movie'::public.media_type, 'tv_episode'::public.media_type)
    and t.status = 'want_to_watch'::public.tracking_status and t.rating is not null)
  or (m.type = 'movie'::public.media_type and t.status = 'watched'::public.tracking_status and t.rating is null);

-- 演员或导演顺序重复、断号或为空；重新保存作品即会按当前顺序重排为 0..n-1。
create view public.v_report_credit_order
with (security_invoker = true) as
select c.id::text as id, c.type::text as link_type, c.id as link_id, c.title, c.context as detail,
  array_agg(o.role::text || '_order' order by o.role) as tags, 0 as weight, c.title as sort_key
from (
  select mc.media_item_id, mc.role
  from public.media_credits mc
  group by mc.media_item_id, mc.role
  having count(mc.credit_order) <> count(*)
    or count(distinct mc.credit_order) <> count(*)
    or min(mc.credit_order) <> 0
    or max(mc.credit_order) <> count(*) - 1
) o
join public.v_report_media_context c on c.id = o.media_item_id
group by c.id, c.type, c.title, c.context;

-- 报告仅供管理页读取：匿名访客不可读，登录用户读取时仍受底表 RLS 约束。
do $$
declare target text;
begin
  foreach target in array array['v_report_media_context','v_report_orphan_people','v_report_missing_character',
    'v_report_missing_alias','v_report_suspicious_names','v_report_similar_people','v_report_unused_references',
    'v_report_incomplete_media','v_report_tv_structure','v_report_tracking_conflicts','v_report_credit_order'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', target);
    execute format('grant select on public.%I to authenticated', target);
  end loop;
end $$;

-- 一次删除当前全部闲置人物或闲置关联资料；删除时再次确认未被引用，返回删除条数。
create function public.manage_delete_unused(p_kind text) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  removed integer := 0;
  batch integer;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if p_kind = 'people' then
    delete from public.people p
    where not exists (select 1 from public.media_credits mc where mc.person_id = p.id)
      and not exists (select 1 from public.music_albums a where a.artist_id = p.id);
    get diagnostics removed = row_count;
  elsif p_kind = 'references' then
    delete from public.genres g where not exists (select 1 from public.media_genres x where x.genre_id = g.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.regions r where not exists (select 1 from public.media_regions x where x.region_id = r.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.languages l where not exists (select 1 from public.media_languages x where x.language_id = l.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.media_series s where not exists (select 1 from public.media_item_series x where x.series_id = s.id);
    get diagnostics batch = row_count; removed := removed + batch;
  else
    raise exception 'Invalid report kind' using errcode = '22023';
  end if;
  return removed;
end $$;
revoke all on function public.manage_delete_unused(text) from public, anon;
grant execute on function public.manage_delete_unused(text) to authenticated;
