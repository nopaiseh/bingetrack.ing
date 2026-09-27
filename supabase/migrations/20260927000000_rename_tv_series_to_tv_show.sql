-- 把媒体类型 tv_series 改名为 tv_show，公开栏目同步由 /series 改为 /shows，不保留旧值兼容。
--
-- 枚举改名只修改标签，已有行与视图中的 'tv_series'::public.media_type 常量按内部 OID 引用，自动跟随新名称；
-- 函数体以文本保存、调用时才解析，因此所有以字符串比较类型的函数都需要重建。
-- 应用须与本迁移同时发布：旧版本应用发送的 tv_series 在迁移后会被数据库拒绝。
alter type public.media_type rename value 'tv_series' to 'tv_show';

alter function public.get_top_tv_series_by_year(integer, integer) rename to get_top_tv_shows_by_year;

-- 与原定义一致，仅把类型值改为 tv_show，并把电视节目的分组键由 series 改为与路由一致的 shows。
create or replace function public.get_media_distribution_counts()
returns table(
  media_type text,
  release_year text,
  dimension text,
  name text,
  item_count integer
)
language sql
stable
parallel safe
set search_path to ''
as $$
  with series_years as (
    select distinct
      seasons.series_id,
      extract(year from episode_media.release_date)::integer::text as release_year
    from public.tv_episodes as episodes
    inner join public.tv_seasons as seasons on seasons.id = episodes.season_id
    inner join public.media_items as episode_media on episode_media.id = episodes.id
    where episode_media.release_date is not null
  ), media as (
    select
      all_media.id,
      case all_media.type::text
        when 'movie' then 'movies'
        when 'tv_show' then 'shows'
      end as media_type,
      all_media.release_year,
      all_media.sort_date,
      all_media.regions,
      all_media.languages,
      all_media.genres
    from public.v_all_media as all_media
    where all_media.type::text in ('movie', 'tv_show')
  ), buckets as (
    select id, media_type, 'All Time'::text as release_year, regions, languages, genres
    from media
    union all
    select
      id,
      media_type,
      coalesce(nullif(release_year, ''), extract(year from sort_date)::integer::text),
      regions,
      languages,
      genres
    from media
    where media_type = 'movies'
      and coalesce(nullif(release_year, ''), extract(year from sort_date)::integer::text) is not null
    union all
    select
      media.id,
      media.media_type,
      series_years.release_year,
      media.regions,
      media.languages,
      media.genres
    from media
    inner join series_years on series_years.series_id = media.id
  ), dimension_values as (
    select id, media_type, release_year, 'regions'::text as dimension, unnest(regions) as value
    from buckets
    union all
    select id, media_type, release_year, 'languages', unnest(languages)
    from buckets
    union all
    select id, media_type, release_year, 'genres', unnest(genres)
    from buckets
  ), unique_values as (
    select distinct id, media_type, release_year, dimension, btrim(value) as value
    from dimension_values
    where btrim(value) <> ''
  )
  select media_type, release_year, dimension, value as name, count(*)::integer as item_count
  from unique_values
  group by media_type, release_year, dimension, value;
$$;

create or replace function public.get_media_stats(p_media_type text)
returns table(
  total bigint,
  watched bigint,
  watching bigint,
  want bigint,
  upcoming bigint
)
language sql
stable
parallel safe
set search_path to ''
as $$
  with upcoming_series as (
    select distinct s.series_id
    from public.tv_seasons as s
    join public.tv_episodes as e on e.season_id = s.id
    join public.media_items as em on em.id = e.id
    left join public.tracking as t on t.media_item_id = e.id
    where em.release_date >= current_date
      and (t.status is distinct from 'watched')
  )
  select
    count(*) as total,
    count(*) filter (where media.status = 'watched') as watched,
    count(*) filter (where media.status = 'watching') as watching,
    count(*) filter (where media.status = 'want_to_watch') as want,
    case
      when p_media_type = 'tv_show' then
        count(*) filter (
          where media.status is distinct from 'watched'
            and u.series_id is not null
        )
      else
        count(*) filter (where media.sort_date >= current_date)
    end as upcoming
  from public.v_all_media as media
  left join upcoming_series as u on u.series_id = media.id
  where media.type::text = p_media_type;
$$;

-- 保持可内联：不设置 search_path（见 20260926000000_inline_search_media.sql）。
create or replace function public.search_media(
  p_query text default null,
  p_types text[] default '{}',
  p_series_only boolean default false,
  p_credit_roles text[] default '{}'
) returns setof public.v_all_media
language sql stable security invoker
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
      case when all_categories then array['movie', 'tv_show'] else types end as searched_types,
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

-- actors 元素可为名称字符串或 {"name","character"} 对象；其余关联仍只接受字符串。
create or replace function public.admin_save_media(p_data jsonb) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  item_id uuid := nullif(p_data->>'id', '')::uuid;
  item_type public.media_type := (p_data->>'type')::public.media_type;
  parent_id uuid := nullif(p_data->>'parent_id', '')::uuid;
  item_number integer := (p_data->>'number')::integer;
  old_type public.media_type;
  target text;
  link_table text;
  key_column text;
  field text;
  person_kind public.person_role;
  entry jsonb;
  item_name text;
  item_character text;
  related_id uuid;
  position integer;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  -- 串行化管理事务，避免删除父条目与新增季集同时执行。
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if item_type is null or item_type not in ('movie','tv_show','tv_season','tv_episode')
    or nullif(btrim(p_data->>'title'), '') is null or length(p_data->>'title') > 300
    or coalesce(p_data->>'status','') not in ('watched','want_to_watch') then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;
  if (p_data->>'rating')::numeric not between 0 and 10
    or (p_data->>'rating')::numeric <> round((p_data->>'rating')::numeric, 1)
    or (p_data->>'runtime')::numeric not between 0 and 100000 then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;
  if item_type in ('tv_season','tv_episode') then
    if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;
    if item_type = 'tv_season' and not exists(select 1 from public.media_items where id = parent_id and type = 'tv_show') then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if item_type = 'tv_episode' and not exists(select 1 from public.tv_seasons s join public.media_items m on m.id = s.id where s.id = parent_id and m.type = 'tv_season') then
      raise exception 'Season not found' using errcode = 'P0002';
    end if;
  end if;

  if item_id is null then
    insert into public.media_items(type,title,alternate_title,summary,cover_url,release_date,runtime)
    values(item_type,btrim(p_data->>'title'),nullif(p_data->>'alternate_title',''),nullif(p_data->>'summary',''),
      nullif(p_data->>'cover_url',''),nullif(p_data->>'release_date','')::date,(p_data->>'runtime')::numeric)
    returning id into item_id;
  else
    select type into old_type from public.media_items where id = item_id for update;
    if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
    if old_type <> item_type then raise exception 'Cannot change media type' using errcode = '22023'; end if;
    update public.media_items set title=btrim(p_data->>'title'),alternate_title=nullif(p_data->>'alternate_title',''),
      summary=nullif(p_data->>'summary',''),cover_url=nullif(p_data->>'cover_url',''),
      release_date=nullif(p_data->>'release_date','')::date,runtime=(p_data->>'runtime')::numeric where id=item_id;
  end if;
  if item_type = 'tv_season' then
    insert into public.tv_seasons(id,series_id,season_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set series_id=excluded.series_id, season_number=excluded.season_number;
  elsif item_type = 'tv_episode' then
    insert into public.tv_episodes(id,season_id,episode_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set season_id=excluded.season_id, episode_number=excluded.episode_number;
  end if;
  insert into public.tracking(media_item_id,status,rating)
  values(item_id,(p_data->>'status')::public.tracking_status,(p_data->>'rating')::numeric)
  on conflict(media_item_id) do update set status=excluded.status, rating=excluded.rating;

  -- 关联名称一行一个，由数据库唯一约束去重；只替换当前条目的关联。
  foreach field in array array['genres','languages','regions','actors','directors'] loop
    if jsonb_typeof(p_data->field) is distinct from 'array' or jsonb_array_length(p_data->field) > 100 then
      raise exception 'Invalid related names' using errcode = '22023';
    end if;
    case field
      when 'genres' then target := 'genres'; link_table := 'media_genres'; key_column := 'genre_id';
      when 'languages' then target := 'languages'; link_table := 'media_languages'; key_column := 'language_id';
      when 'regions' then target := 'regions'; link_table := 'media_regions'; key_column := 'region_id';
      else target := 'people'; link_table := 'media_credits'; key_column := 'person_id';
    end case;
    if target = 'people' then
      person_kind := case when field = 'actors' then 'actor'::public.person_role else 'director'::public.person_role end;
      delete from public.media_credits where media_item_id=item_id and role=person_kind;
    else
      execute format('delete from public.%I where media_item_id=$1',link_table) using item_id;
    end if;
    position := 0;
    for entry in select value from jsonb_array_elements(p_data->field) loop
      item_character := null;
      if jsonb_typeof(entry) = 'string' then
        item_name := btrim(entry #>> '{}');
      elsif field = 'actors' and jsonb_typeof(entry) = 'object'
        and jsonb_typeof(entry->'name') = 'string'
        and coalesce(jsonb_typeof(entry->'character'), 'null') in ('string','null') then
        item_name := btrim(entry->>'name');
        item_character := nullif(btrim(entry->>'character'), '');
      else
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if item_name is null or item_name = '' or length(item_name) > 200 or length(item_character) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      execute format('insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',target)
        into related_id using item_name;
      if target = 'people' then
        insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
        values(item_id,related_id,person_kind,position,item_character) on conflict do nothing;
      else
        execute format('insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',link_table,key_column) using item_id,related_id;
      end if;
      position := position + 1;
    end loop;
  end loop;
  return item_id;
end $$;

-- 删除整个影视树中的 media_items，避免外键级联只删除关系而留下孤立的季集资料。
create or replace function public.admin_delete_media(p_id uuid, p_confirm_title text) returns void
language plpgsql security invoker set search_path = ''
as $$
declare current_title text; item_type public.media_type; descendants uuid[];
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select title,type into current_title,item_type from public.media_items where id=p_id for update;
  if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
  if p_confirm_title is distinct from current_title or item_type not in ('movie','tv_show','tv_season','tv_episode') then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;
  with recursive tree(id) as (
    select p_id
    union
    select edges.child from tree join (
      select series_id as parent,id as child from public.tv_seasons
      union all select season_id,id from public.tv_episodes
    ) edges on edges.parent=tree.id
  ) select array_agg(id) into descendants from tree;
  delete from public.media_items where id = any(descendants);
end $$;

-- 视图内部的电视节目分组标签同步改名，输出列不变。
create or replace view public.release_year_stats
with (security_invoker = true)
as
with ep_raw as (
  select
    series.id as series_id,
    seasons.id as season_id,
    episodes.id as episode_id,
    episode_media.release_date,
    extract(year from episode_media.release_date)::integer as release_year,
    coalesce(episode_media.runtime, 0::numeric) as runtime,
    coalesce(episode_tracking.status = 'watched'::public.tracking_status, false) as is_watched,
    episode_tracking.rating
  from public.media_items series
  join public.tv_seasons seasons on seasons.series_id = series.id
  join public.tv_episodes episodes on episodes.season_id = seasons.id
  join public.media_items episode_media on episode_media.id = episodes.id
  left join public.tracking episode_tracking on episode_tracking.media_item_id = episodes.id
  where series.type = 'tv_show'::public.media_type
), season_year_agg as (
  select series_id, release_year, season_id,
    count(episode_id) as total_eps,
    count(episode_id) filter (where is_watched) as watched_eps,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as season_status
  from ep_raw where release_year is not null
  group by series_id, release_year, season_id
), series_seasons_year_agg as (
  select series_id, release_year,
    count(season_id) as total_seasons,
    count(season_id) filter (where season_status = 'watched') as watched_seasons,
    count(season_id) filter (where season_status = 'watching') as watching_seasons,
    count(season_id) filter (where season_status = 'unwatched') as unwatched_seasons
  from season_year_agg group by series_id, release_year
), series_year_agg as (
  select series_id, release_year,
    count(episode_id) as total_episodes,
    count(episode_id) filter (where is_watched) as watched_episodes,
    count(episode_id) filter (where not is_watched) as unwatched_episodes,
    sum(runtime) as total_runtime,
    coalesce(sum(runtime) filter (where is_watched), 0::numeric) as watched_runtime,
    coalesce(sum(runtime) filter (where not is_watched), 0::numeric) as unwatched_runtime,
    avg(rating) filter (where rating is not null) as rating,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as status
  from ep_raw where release_year is not null
  group by series_id, release_year
), tv_stats_year as (
  select s.series_id as id, s.release_year, 'tv_show'::text as media_type,
    s.status, s.rating, s.total_runtime, s.watched_runtime, s.unwatched_runtime,
    s.total_episodes, s.watched_episodes, s.unwatched_episodes,
    ss.total_seasons, ss.watched_seasons, ss.watching_seasons, ss.unwatched_seasons
  from series_year_agg s
  join series_seasons_year_agg ss on ss.series_id = s.series_id and ss.release_year = s.release_year
), season_all_agg as (
  select series_id, season_id,
    count(episode_id) as total_eps,
    count(episode_id) filter (where is_watched) as watched_eps,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as season_status
  from ep_raw group by series_id, season_id
), series_seasons_all_agg as (
  select series_id,
    count(season_id) as total_seasons,
    count(season_id) filter (where season_status = 'watched') as watched_seasons,
    count(season_id) filter (where season_status = 'watching') as watching_seasons,
    count(season_id) filter (where season_status = 'unwatched') as unwatched_seasons
  from season_all_agg group by series_id
), series_all_agg as (
  select series_id,
    count(episode_id) as total_episodes,
    count(episode_id) filter (where is_watched) as watched_episodes,
    count(episode_id) filter (where not is_watched) as unwatched_episodes,
    sum(runtime) as total_runtime,
    coalesce(sum(runtime) filter (where is_watched), 0::numeric) as watched_runtime,
    coalesce(sum(runtime) filter (where not is_watched), 0::numeric) as unwatched_runtime,
    avg(rating) filter (where rating is not null) as rating,
    case
      when count(episode_id) = count(episode_id) filter (where is_watched) then 'watched'
      when count(episode_id) filter (where is_watched) = 0 then 'unwatched'
      else 'watching'
    end as status
  from ep_raw group by series_id
), tv_stats_all as (
  select s.series_id as id, null::integer as release_year, 'tv_show'::text as media_type,
    s.status, s.rating, s.total_runtime, s.watched_runtime, s.unwatched_runtime,
    s.total_episodes, s.watched_episodes, s.unwatched_episodes,
    ss.total_seasons, ss.watched_seasons, ss.watching_seasons, ss.unwatched_seasons
  from series_all_agg s join series_seasons_all_agg ss on ss.series_id = s.series_id
), movie_base as (
  select m.id, extract(year from m.release_date)::integer as release_year,
    'movie'::text as media_type,
    case when t.status = 'watched'::public.tracking_status then 'watched' else 'unwatched' end as status,
    t.rating, coalesce(m.runtime, 0::numeric) as total_runtime,
    case when t.status = 'watched'::public.tracking_status then coalesce(m.runtime, 0::numeric) else 0::numeric end as watched_runtime,
    case when t.status is distinct from 'watched'::public.tracking_status then coalesce(m.runtime, 0::numeric) else 0::numeric end as unwatched_runtime,
    0::bigint as total_episodes, 0::bigint as watched_episodes, 0::bigint as unwatched_episodes,
    0::bigint as total_seasons, 0::bigint as watched_seasons, 0::bigint as watching_seasons, 0::bigint as unwatched_seasons
  from public.media_items m
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'movie'::public.media_type and m.release_date is not null
), movie_stats as (
  select * from movie_base
  union all
  select id, null::integer, media_type, status, rating, total_runtime,
    watched_runtime, unwatched_runtime, total_episodes, watched_episodes,
    unwatched_episodes, total_seasons, watched_seasons, watching_seasons, unwatched_seasons
  from movie_base
), combined_stats as (
  select * from movie_stats
  union all select * from tv_stats_year
  union all select * from tv_stats_all
)
select
  coalesce(release_year::text, 'All Time') as release_year,
  coalesce(sum(total_runtime), 0::numeric) as total_runtime,
  coalesce(sum(watched_runtime), 0::numeric) as total_watched_runtime,
  coalesce(sum(unwatched_runtime), 0::numeric) as total_unwatched_runtime,
  count(id) filter (where media_type = 'movie') as total_movies,
  count(id) filter (where media_type = 'movie' and status = 'watched') as watched_movies,
  count(id) filter (where media_type = 'movie' and status = 'unwatched') as unwatched_movies,
  coalesce(sum(total_runtime) filter (where media_type = 'movie'), 0::numeric) as total_movies_runtime,
  coalesce(sum(watched_runtime) filter (where media_type = 'movie'), 0::numeric) as movies_watched_runtime,
  coalesce(sum(unwatched_runtime) filter (where media_type = 'movie'), 0::numeric) as movies_unwatched_runtime,
  round(avg(rating) filter (where media_type = 'movie' and status = 'watched'), 1) as movie_avg_rating,
  count(id) filter (where media_type = 'tv_show') as total_series,
  count(id) filter (where media_type = 'tv_show' and status = 'watched') as watched_series,
  count(id) filter (where media_type = 'tv_show' and status = 'watching') as watching_series,
  count(id) filter (where media_type = 'tv_show' and status = 'unwatched') as unwatched_series,
  coalesce(sum(total_runtime) filter (where media_type = 'tv_show'), 0::numeric) as total_series_runtime,
  coalesce(sum(watched_runtime) filter (where media_type = 'tv_show'), 0::numeric) as series_watched_runtime,
  coalesce(sum(unwatched_runtime) filter (where media_type = 'tv_show'), 0::numeric) as series_unwatched_runtime,
  round(avg(rating) filter (where media_type = 'tv_show' and rating is not null), 1) as series_avg_rating,
  coalesce(sum(total_seasons) filter (where media_type = 'tv_show'), 0::numeric) as total_seasons,
  coalesce(sum(watched_seasons) filter (where media_type = 'tv_show'), 0::numeric) as watched_seasons,
  coalesce(sum(watching_seasons) filter (where media_type = 'tv_show'), 0::numeric) as watching_seasons,
  coalesce(sum(unwatched_seasons) filter (where media_type = 'tv_show'), 0::numeric) as unwatched_seasons,
  coalesce(sum(total_episodes) filter (where media_type = 'tv_show'), 0::numeric) as total_series_episodes,
  coalesce(sum(watched_episodes) filter (where media_type = 'tv_show'), 0::numeric) as watched_series_episodes,
  coalesce(sum(unwatched_episodes) filter (where media_type = 'tv_show'), 0::numeric) as unwatched_episodes
from combined_stats
group by release_year
order by (release_year is null) desc, coalesce(release_year::text, 'All Time') desc;
