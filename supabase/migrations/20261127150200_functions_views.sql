-- 重建依赖 album_tracks 的视图／函数；通用 credits 保存 API；get_person_works／get_song_detail。
-- 同事务：卸下仍读 music.album_id／track_number 的旧视图／函数 → 按 album_tracks 重建。
-- 本文件不删 music 列（见 503）；失败则整文件回滚，公开页／搜索／统计保持旧对象可用。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

-- ---------------------------------------------------------------------------
-- 0) 卸下仍引用 music.album_id／track_number 的对象（同事务内立即重建）
-- ---------------------------------------------------------------------------
drop function if exists public.search_media(text, text[], boolean, text[]);
drop function if exists public.get_media_stats(text);
drop function if exists public.get_media_distribution_counts();
drop function if exists public.admin_save_album_with_tracks(jsonb, jsonb);
drop function if exists public.admin_save_media(jsonb);
drop function if exists public.manage_save_media(jsonb);
drop function if exists public.get_person_works(uuid);
drop function if exists public.get_song_detail(uuid);
-- 先卸视图，再卸 album_average_rating（v_all_media 依赖它）
drop view if exists public.v_all_media;
drop view if exists public.v_continue_listening;
drop view if exists public.release_year_stats;
drop function if exists public.album_average_rating(uuid);

-- ---------------------------------------------------------------------------
-- 1) 专辑评分／在听
-- ---------------------------------------------------------------------------
create or replace function public.album_average_rating(p_album_id uuid)
returns numeric
language sql
stable
parallel safe
set search_path to ''
as $$
  select round(avg(t.rating), 1)
  from public.album_tracks at
  join public.tracking t on t.media_item_id = at.song_id
  where at.album_id = p_album_id
    and t.rating is not null;
$$;

revoke all on function public.album_average_rating(uuid) from public;
grant execute on function public.album_average_rating(uuid) to anon, authenticated, service_role;

comment on function public.album_average_rating(uuid) is
  '专辑评分 = 本专辑 album_tracks 下属已评分曲目的实时平均；共享曲目只计入本专辑。';

create or replace view public.v_continue_listening
with (security_invoker = true)
as
select
  album.media_item_id as album_id,
  item.title,
  item.cover_url,
  item.release_date,
  count(at.song_id)::integer as track_total,
  count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)::integer as track_watched,
  max(item_track.release_date) filter (where t.status = 'watched'::public.tracking_status) as latest_watched_track_release_date
from public.music_albums album
join public.media_items item on item.id = album.media_item_id
join public.album_tracks at on at.album_id = album.media_item_id
join public.media_items item_track on item_track.id = at.song_id
left join public.tracking t on t.media_item_id = at.song_id
group by album.media_item_id, item.title, item.cover_url, item.release_date
having count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status) > 0
   and count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)
       < count(at.song_id);

comment on view public.v_continue_listening is
  '在听专辑：至少一首曲目 watched，但未全部 watched。共享曲目的收听状态对包含它的每张专辑生效。';

grant select on public.v_continue_listening to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) v_all_media／release_year_stats／search／stats
-- ---------------------------------------------------------------------------

create or replace view public.v_all_media
with (security_invoker = true)
as
select
  m.id,
  m.type,
  m.title,
  m.summary,
  m.cover_url,
  m.release_date as sort_date,
  extract(year from m.release_date)::text as release_year,
  round(avg(t.rating), 1) as rating,
  m.runtime::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director') as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author') as authors
from public.media_items m
left join public.tracking t on t.media_item_id = m.id
where m.type = 'movie'::public.media_type
group by m.id, m.runtime
union all
select
  series.id,
  series.type,
  series.title,
  series.summary,
  series.cover_url,
  coalesce(
    max(episode_media.release_date) filter (where episode_media.release_date <= current_date),
    min(episode_media.release_date)
  ) as sort_date,
  case
    when min(episode_media.release_date) is null then null::text
    when max(episode_media.release_date) > current_date then extract(year from min(episode_media.release_date))::text || ' - Present'
    when extract(year from min(episode_media.release_date)) = extract(year from max(episode_media.release_date)) then extract(year from min(episode_media.release_date))::text
    else extract(year from min(episode_media.release_date))::text || ' - ' || extract(year from max(episode_media.release_date))::text
  end as release_year,
  round(avg(t.rating), 1) as rating,
  (select sum(ep_media.runtime)::integer from public.tv_seasons s join public.tv_episodes e on e.season_id = s.id join public.media_items ep_media on e.id = ep_media.id where s.series_id = series.id) as runtime,
  case
    when count(episodes.id) > 0 and count(t.media_item_id) = count(episodes.id) and min(t.status)::text = 'watched' and max(t.status)::text = 'watched' then 'watched'
    when count(episodes.id) > 0 and count(t.media_item_id) = count(episodes.id) and min(t.status)::text = 'want_to_watch' and max(t.status)::text = 'want_to_watch' then 'want_to_watch'
    when count(t.media_item_id) > 0 then 'watching'
    else null::text
  end as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = series.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = series.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = series.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'director') as directors,
  series.alternate_title,
  min(episode_media.release_date) as first_air_date,
  max(episode_media.release_date) as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'author') as authors
from public.media_items series
left join public.tv_seasons seasons on seasons.series_id = series.id
left join public.tv_episodes episodes on episodes.season_id = seasons.id
left join public.media_items episode_media on episodes.id = episode_media.id
left join public.tracking t on t.media_item_id = episodes.id
where series.type = 'tv_show'::public.media_type
group by series.id
union all
select
  album_item.id,
  album_item.type,
  album_item.title,
  album_item.summary,
  album_item.cover_url,
  album_item.release_date as sort_date,
  extract(year from album_item.release_date)::text as release_year,
  public.album_average_rating(album_item.id) as rating,
  null::integer as runtime,
  case
    when count(mu.song_id) > 0
      and count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)
        = count(mu.song_id)
      then 'watched'
    when count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status) > 0
      then 'watching'
    when count(t.media_item_id) filter (where t.status = 'want_to_watch'::public.tracking_status) > 0
      then 'want_to_watch'
    else null::text
  end as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = album_item.id) as genres,
  -- 专辑语言 = 下属单曲语言去重并集；无单曲语言时为 NULL（与原先无关联行行为一致）。
  (
    select array_agg(distinct l.name order by l.name)
    from public.album_tracks track
    join public.media_languages ml on ml.media_item_id = track.song_id
    join public.languages l on l.id = ml.language_id
    where track.album_id = album_item.id
  ) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = album_item.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'director') as directors,
  album_item.alternate_title,
  album_item.release_date as first_air_date,
  album_item.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'author') as authors
from public.media_items album_item
join public.music_albums album on album.media_item_id = album_item.id
left join public.album_tracks mu on mu.album_id = album.media_item_id
left join public.tracking t on t.media_item_id = mu.song_id
where album_item.type = 'album'::public.media_type
group by album_item.id
union all
select
  m.id,
  m.type,
  m.title,
  m.summary,
  coalesce(
    nullif(m.cover_url, ''),
    (
      select ai.cover_url
      from public.album_tracks at
      join public.media_items ai on ai.id = at.album_id
      where at.song_id = m.id
        and ai.cover_url is not null
        and nullif(ai.cover_url, '') is not null
      order by ai.release_date asc nulls last, at.disc_number, at.track_number
      limit 1
    )
  ) as cover_url,
  -- 与 release_year_stats 曲目年份一致：自身 release_date，否则所属专辑。
  coalesce(m.release_date, album_dates.earliest_album_release) as sort_date,
  extract(year from coalesce(m.release_date, album_dates.earliest_album_release))::text as release_year,
  round(avg(t.rating), 1) as rating,
  m.runtime::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director') as directors,
  m.alternate_title,
  coalesce(m.release_date, album_dates.earliest_album_release) as first_air_date,
  coalesce(m.release_date, album_dates.earliest_album_release) as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author') as authors
from public.media_items m
left join lateral (
  select min(ai.release_date) as earliest_album_release
  from public.album_tracks at
  join public.media_items ai on ai.id = at.album_id
  where at.song_id = m.id
) album_dates on true
left join public.tracking t on t.media_item_id = m.id
where m.type = 'music'::public.media_type
group by m.id, m.runtime, album_dates.earliest_album_release
union all
select
  m.id,
  m.type,
  m.title,
  m.summary,
  m.cover_url,
  m.release_date as sort_date,
  extract(year from m.release_date)::text as release_year,
  round(avg(t.rating), 1) as rating,
  null::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director') as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author') as authors
from public.media_items m
join public.books b on b.media_item_id = m.id
left join public.tracking t on t.media_item_id = m.id
where m.type = 'book'::public.media_type
group by m.id;

grant select on public.v_all_media to anon, authenticated, service_role;

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
), album_base as (
  -- 专辑时长强制为 0。状态／评分来自 album_tracks 下属曲目（与 v_all_media 一致）：
  -- 全部 watched → listened；仅有 want_to_watch → want；部分 watched → watching（不进 listened／want）。
  -- 评分 = 本专辑曲目评分平均（album_average_rating）；空专辑不计为已听。
  select m.id, extract(year from m.release_date)::integer as release_year,
    'album'::text as media_type,
    case
      when count(at.song_id) > 0
        and count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)
          = count(at.song_id)
        then 'watched'
      when count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status) > 0
        then 'watching'
      when count(t.media_item_id) filter (where t.status = 'want_to_watch'::public.tracking_status) > 0
        then 'want_to_watch'
      else 'unwatched'
    end as status,
    public.album_average_rating(m.id) as rating,
    0::numeric as total_runtime,
    0::numeric as watched_runtime,
    0::numeric as unwatched_runtime,
    0::bigint as total_episodes, 0::bigint as watched_episodes, 0::bigint as unwatched_episodes,
    0::bigint as total_seasons, 0::bigint as watched_seasons, 0::bigint as watching_seasons, 0::bigint as unwatched_seasons
  from public.media_items m
  left join public.album_tracks at on at.album_id = m.id
  left join public.tracking t on t.media_item_id = at.song_id
  where m.type = 'album'::public.media_type and m.release_date is not null
  group by m.id
), album_stats as (
  select * from album_base
  union all
  select id, null::integer, media_type, status, rating, total_runtime,
    watched_runtime, unwatched_runtime, total_episodes, watched_episodes,
    unwatched_episodes, total_seasons, watched_seasons, watching_seasons, unwatched_seasons
  from album_base
), book_base as (
  -- 图书不计入时长；in_progress → reading_books；want_to_watch → want_books；无 tracking 不算想读。
  select m.id, extract(year from m.release_date)::integer as release_year,
    'book'::text as media_type,
    case
      when t.status = 'watched'::public.tracking_status then 'watched'
      when t.status = 'in_progress'::public.tracking_status then 'in_progress'
      when t.status = 'want_to_watch'::public.tracking_status then 'want_to_watch'
      else 'unwatched'
    end as status,
    t.rating,
    0::numeric as total_runtime,
    0::numeric as watched_runtime,
    0::numeric as unwatched_runtime,
    0::bigint as total_episodes, 0::bigint as watched_episodes, 0::bigint as unwatched_episodes,
    0::bigint as total_seasons, 0::bigint as watched_seasons, 0::bigint as watching_seasons, 0::bigint as unwatched_seasons
  from public.media_items m
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'book'::public.media_type and m.release_date is not null
), book_stats as (
  select * from book_base
  union all
  select id, null::integer, media_type, status, rating, total_runtime,
    watched_runtime, unwatched_runtime, total_episodes, watched_episodes,
    unwatched_episodes, total_seasons, watched_seasons, watching_seasons, unwatched_seasons
  from book_base
), track_base as (
  -- 全部 songs（含专辑内曲目与独立单曲）；时长强制为 0。
  -- 年份优先用曲目自身 release_date，否则回退到 album 的 release_date。
  -- 无 tracking 不算想听，仅 want_to_watch 计入 want_tracks。
  select m.id,
    extract(year from coalesce(m.release_date, album_dates.earliest_album_release))::integer as release_year,
    'music'::text as media_type,
    case
      when t.status = 'watched'::public.tracking_status then 'watched'
      when t.status = 'want_to_watch'::public.tracking_status then 'want_to_watch'
      else 'unwatched'
    end as status,
    t.rating,
    0::numeric as total_runtime,
    0::numeric as watched_runtime,
    0::numeric as unwatched_runtime,
    0::bigint as total_episodes, 0::bigint as watched_episodes, 0::bigint as unwatched_episodes,
    0::bigint as total_seasons, 0::bigint as watched_seasons, 0::bigint as watching_seasons, 0::bigint as unwatched_seasons
  from public.media_items m
  left join lateral (
    select min(ai.release_date) as earliest_album_release
    from public.album_tracks at
    join public.media_items ai on ai.id = at.album_id
    where at.song_id = m.id
  ) album_dates on true
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'music'::public.media_type
    and coalesce(m.release_date, album_dates.earliest_album_release) is not null
), track_stats as (
  select * from track_base
  union all
  select id, null::integer, media_type, status, rating, total_runtime,
    watched_runtime, unwatched_runtime, total_episodes, watched_episodes,
    unwatched_episodes, total_seasons, watched_seasons, watching_seasons, unwatched_seasons
  from track_base
), combined_stats as (
  select * from movie_stats
  union all select * from tv_stats_year
  union all select * from tv_stats_all
  union all select * from album_stats
  union all select * from book_stats
  union all select * from track_stats
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
  coalesce(sum(unwatched_episodes) filter (where media_type = 'tv_show'), 0::numeric) as unwatched_episodes,
  count(id) filter (where media_type = 'album') as total_albums,
  count(id) filter (where media_type = 'album' and status = 'watched') as listened_albums,
  count(id) filter (where media_type = 'book') as total_books,
  count(id) filter (where media_type = 'book' and status = 'watched') as read_books,
  count(id) filter (where media_type = 'book' and status = 'in_progress') as reading_books,
  count(id) filter (where media_type = 'album' and status = 'want_to_watch') as want_albums,
  count(id) filter (where media_type = 'book' and status = 'want_to_watch') as want_books,
  count(id) filter (where media_type = 'music') as total_tracks,
  count(id) filter (where media_type = 'music' and status = 'watched') as listened_tracks,
  count(id) filter (where media_type = 'music' and status = 'want_to_watch') as want_tracks,
  round(avg(rating) filter (where media_type = 'album' and status = 'watched'), 1) as album_avg_rating,
  round(avg(rating) filter (where media_type = 'book' and status = 'watched'), 1) as book_avg_rating
from combined_stats
group by release_year
order by (release_year is null) desc, coalesce(release_year::text, 'All Time') desc;

grant select on public.release_year_stats to anon, authenticated, service_role;

create or replace function public.get_media_stats(p_media_type text)
returns table(
  total bigint,
  watched bigint,
  watching bigint,
  want bigint,
  upcoming bigint,
  in_progress bigint
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
    end as upcoming,
    count(*) filter (where media.status = 'in_progress') as in_progress
  from public.v_all_media as media
  left join upcoming_series as u on u.series_id = media.id
  where media.type::text = p_media_type;
$$;

comment on function public.get_media_stats(text) is
  '按媒体类型统计 total／watched／watching／want／upcoming／in_progress；图书用 in_progress（在读），影视该列为 0。';
;

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
        when 'album' then 'albums'
        when 'book' then 'books'
      end as media_type,
      all_media.release_year,
      all_media.sort_date,
      all_media.regions,
      all_media.languages,
      all_media.genres
    from public.v_all_media as all_media
    where all_media.type::text in ('movie', 'tv_show', 'album', 'book')
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
    where media_type in ('movies', 'albums', 'books')
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


revoke all on function public.get_media_stats(text) from public;
grant execute on function public.get_media_stats(text) to anon, authenticated, service_role;
alter function public.get_media_stats(text) set search_path = '';
revoke all on function public.get_media_distribution_counts() from public;
grant execute on function public.get_media_distribution_counts() to anon, authenticated, service_role;
alter function public.get_media_distribution_counts() set search_path = '';

-- search_media
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
  ), all_role_codes as (
    select coalesce(array_agg(cr.code order by cr.sort_order), '{}'::text[]) as codes
    from public.credit_roles cr
  ), scope as (
    select
      term,
      '%' || replace(replace(replace(term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pattern,
      series_only,
      all_categories,
      case
        when all_categories then array['movie', 'tv_show', 'album', 'music', 'book']
        else types
      end as searched_types,
      all_categories or series_only as searches_series,
      case
        when all_categories or (cardinality(roles) = 0 and cardinality(types) > 0)
          then (select codes from all_role_codes)
        else roles
      end as searched_roles,
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
      and mc.role = any(scope.searched_roles)
      and (p.name ilike scope.pattern escape E'\\' or p.alternate_name ilike scope.pattern escape E'\\')
      and (
        cardinality(scope.searched_types) = 0
        or mi.type::text = any(scope.searched_types)
      )
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
alter function public.search_media(text, text[], boolean, text[]) set search_path = '';

-- ---------------------------------------------------------------------------
-- 3) 通用 credits 保存 API（返回 jsonb：id + affected_person_ids）
-- ---------------------------------------------------------------------------
drop function if exists public.manage_save_media(jsonb);
drop function if exists public.admin_save_media(jsonb);
drop function if exists public.admin_save_album_with_tracks(jsonb, jsonb);

create function public.admin_save_media(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  item_id uuid := nullif(p_data->>'id', '')::uuid;
  item_type public.media_type := (p_data->>'type')::public.media_type;
  parent_id uuid := nullif(p_data->>'parent_id', '')::uuid;
  item_number integer := (p_data->>'number')::integer;
  disc_no integer := coalesce(nullif(p_data->>'disc_number', '')::integer, 1);
  old_type public.media_type;
  target text;
  link_table text;
  key_column text;
  field text;
  entry jsonb;
  item_name text;
  item_character text;
  chosen_person uuid;
  related_id uuid;
  position integer;
  related_limit integer;
  rating_value numeric := (p_data->>'rating')::numeric;
  runtime_value numeric := (p_data->>'runtime')::numeric;
  runtime_ok boolean;
  album_label text;
  release_kind_text text;
  release_kind_value public.album_release_kind;
  related_fields text[];
  status_text text := coalesce(p_data->>'status', '');
  page_count_value integer;
  publisher_value text;
  isbn_value text;
  author_names text[] := '{}';
  duplicate_id uuid;
  credit_entry jsonb;
  credit_role text;
  credit_order integer;
  role_row record;
  person_obj jsonb;
  person_alt text;
  affected uuid[] := '{}';
  old_person uuid;
  link_album boolean;
  old_album_ids uuid[] := '{}';
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);

  if item_type is null
    or item_type not in ('movie','tv_show','tv_season','tv_episode','album','music','book')
    or nullif(btrim(p_data->>'title'), '') is null
    or length(p_data->>'title') > 300 then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;

  -- 拒绝旧版角色字段，强制走 credits[]
  if p_data ? 'actors' or p_data ? 'directors' or p_data ? 'artists'
     or p_data ? 'lyricists' or p_data ? 'composers' or p_data ? 'authors' then
    raise exception 'Legacy credit fields are not supported; use credits[]' using errcode = '22023';
  end if;

  if item_type = 'book' then
    if status_text not in ('watched','want_to_watch','in_progress') then
      raise exception 'Invalid media input' using errcode = '22023';
    end if;
  elsif status_text not in ('watched','want_to_watch') then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;

  if rating_value is not null
    and (rating_value < 0 or rating_value > 10 or rating_value <> round(rating_value, 1)) then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;

  if item_type = 'music' then
    runtime_ok := runtime_value is null
      or (runtime_value >= 1 and runtime_value <= 7200 and runtime_value = trunc(runtime_value));
  elsif item_type = 'book' then
    runtime_ok := runtime_value is null;
  else
    runtime_ok := runtime_value is null
      or (runtime_value >= 0 and runtime_value <= 100000);
  end if;
  if not runtime_ok then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;

  if item_type in ('tv_season','tv_episode') then
    if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;
    if item_type = 'tv_season' and not exists(
      select 1 from public.media_items where id = parent_id and type = 'tv_show'::public.media_type
    ) then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if item_type = 'tv_episode' and not exists(
      select 1 from public.tv_seasons s
      join public.media_items m on m.id = s.id
      where s.id = parent_id and m.type = 'tv_season'::public.media_type
    ) then
      raise exception 'Season not found' using errcode = 'P0002';
    end if;
  end if;

  -- 曲目：可独立；若带 parent_id 则写入 album_tracks（须同时给 number）
  link_album := false;
  if item_type = 'music' then
    if parent_id is not null or item_number is not null then
      if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
        raise exception 'Invalid parent or number' using errcode = '22023';
      end if;
      if disc_no is null or disc_no < 1 or disc_no > 100 then
        raise exception 'Invalid disc_number' using errcode = '22023';
      end if;
      if not exists(
        select 1 from public.media_items where id = parent_id and type = 'album'::public.media_type
      ) then
        raise exception 'Album not found' using errcode = 'P0002';
      end if;
      link_album := true;
    end if;
  end if;

  if item_type = 'album' then
    album_label := nullif(btrim(coalesce(p_data->>'label', '')), '');
    if album_label is not null and length(album_label) > 200 then
      raise exception 'Invalid label' using errcode = '22023';
    end if;
    release_kind_text := coalesce(nullif(btrim(p_data->>'release_kind'), ''), 'album');
    begin
      release_kind_value := release_kind_text::public.album_release_kind;
    exception when others then
      raise exception 'Invalid release_kind' using errcode = '22023';
    end;
  end if;

  if item_type = 'book' then
    if p_data ? 'page_count' and nullif(p_data->>'page_count', '') is not null then
      begin
        page_count_value := (p_data->>'page_count')::integer;
      exception when others then
        raise exception 'Invalid page_count' using errcode = '22023';
      end;
      if page_count_value < 1 or page_count_value > 20000 then
        raise exception 'Invalid page_count' using errcode = '22023';
      end if;
    else
      page_count_value := null;
    end if;
    publisher_value := nullif(btrim(coalesce(p_data->>'publisher', '')), '');
    if publisher_value is not null and length(publisher_value) > 200 then
      raise exception 'Invalid publisher' using errcode = '22023';
    end if;
    isbn_value := nullif(public.normalize_book_isbn(coalesce(p_data->>'isbn', '')), '');
    if isbn_value is not null and isbn_value !~ '^(?:[0-9]{9}[0-9X]|[0-9]{13})$' then
      raise exception 'Invalid isbn' using errcode = '22023';
    end if;
  end if;

  if item_id is null then
    insert into public.media_items(type,title,alternate_title,summary,cover_url,release_date,runtime)
    values(
      item_type,
      btrim(p_data->>'title'),
      nullif(p_data->>'alternate_title',''),
      nullif(p_data->>'summary',''),
      case when item_type in ('music','tv_season','tv_episode') then null else nullif(p_data->>'cover_url','') end,
      nullif(p_data->>'release_date','')::date,
      runtime_value
    )
    returning id into item_id;
  else
    select type into old_type from public.media_items where id = item_id for update;
    if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
    if old_type <> item_type then raise exception 'Cannot change media type' using errcode = '22023'; end if;
    update public.media_items set
      title = btrim(p_data->>'title'),
      alternate_title = nullif(p_data->>'alternate_title',''),
      summary = nullif(p_data->>'summary',''),
      cover_url = case when item_type in ('music','tv_season','tv_episode') then null else nullif(p_data->>'cover_url','') end,
      release_date = nullif(p_data->>'release_date','')::date,
      runtime = runtime_value
    where id = item_id;
  end if;

  if item_type = 'tv_season' then
    insert into public.tv_seasons(id,series_id,season_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set series_id = excluded.series_id, season_number = excluded.season_number;
  elsif item_type = 'tv_episode' then
    insert into public.tv_episodes(id,season_id,episode_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set season_id = excluded.season_id, episode_number = excluded.episode_number;
  elsif item_type = 'album' then
    insert into public.music_albums(media_item_id, label, release_kind)
    values(item_id, album_label, release_kind_value)
    on conflict(media_item_id) do update set label = excluded.label, release_kind = excluded.release_kind;
  elsif item_type = 'music' then
    insert into public.music(media_item_id) values(item_id)
    on conflict(media_item_id) do nothing;
    if link_album then
      -- 表单单父级语义：改 parent 视为挪专辑，卸下其它专辑关联并刷新双方 track_count。
      -- 多专辑挂载请走 admin_save_album_with_tracks 引用已有 song id（不经此路径清链）。
      select coalesce(array_agg(at.album_id), '{}'::uuid[]) into old_album_ids
      from public.album_tracks at
      where at.song_id = item_id
        and at.album_id is distinct from parent_id;
      delete from public.album_tracks
      where song_id = item_id
        and album_id is distinct from parent_id;

      delete from public.album_tracks where album_id = parent_id and song_id = item_id;
      -- 曲位已被其它歌占用则拒绝（保留 23505，与旧 music.album_id/track_number 唯一约束一致）
      if exists (
        select 1 from public.album_tracks
        where album_id = parent_id
          and disc_number = disc_no
          and track_number = item_number
          and song_id is distinct from item_id
      ) then
        raise exception 'duplicate key value violates unique constraint'
          using errcode = '23505';
      end if;
      insert into public.album_tracks(album_id, song_id, disc_number, track_number)
      values(parent_id, item_id, disc_no, item_number)
      on conflict on constraint album_tracks_pkey do update
        set song_id = excluded.song_id;
      update public.music_albums a
      set track_count = (select count(*)::integer from public.album_tracks t where t.album_id = a.media_item_id)
      where a.media_item_id = parent_id
         or a.media_item_id = any(old_album_ids);
    end if;
  elsif item_type = 'book' then
    insert into public.books(media_item_id, page_count, publisher, isbn)
    values(item_id, page_count_value, publisher_value, isbn_value)
    on conflict(media_item_id) do update set
      page_count = excluded.page_count,
      publisher = excluded.publisher,
      isbn = excluded.isbn;
  end if;

  if item_type in ('movie','tv_episode','music','book') then
    insert into public.tracking(media_item_id,status,rating)
    values(item_id,status_text::public.tracking_status,rating_value)
    on conflict(media_item_id) do update set status = excluded.status, rating = excluded.rating;
  end if;

  if item_type = 'album' then
    related_fields := array['genres','regions'];
  elsif item_type = 'music' then
    related_fields := array['genres','languages'];
    if jsonb_typeof(p_data->'genres') = 'array'
      and jsonb_array_length(p_data->'genres') > 2 then
      raise exception 'Music tracks allow at most 2 genres' using errcode = '22023';
    end if;
  elsif item_type = 'book' then
    related_fields := array['genres','languages','regions'];
  else
    related_fields := array['genres','languages','regions'];
  end if;

  foreach field in array related_fields loop
    related_limit := 100;
    if jsonb_typeof(p_data->field) is distinct from 'array'
      or jsonb_array_length(p_data->field) > related_limit then
      raise exception 'Invalid related names' using errcode = '22023';
    end if;
    case field
      when 'genres' then target := 'genres'; link_table := 'media_genres'; key_column := 'genre_id';
      when 'languages' then target := 'languages'; link_table := 'media_languages'; key_column := 'language_id';
      else target := 'regions'; link_table := 'media_regions'; key_column := 'region_id';
    end case;
    execute format('delete from public.%I where media_item_id=$1', link_table) using item_id;
    for entry in select value from jsonb_array_elements(p_data->field) loop
      if jsonb_typeof(entry) = 'string' then
        item_name := btrim(entry #>> '{}');
      else
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if item_name is null or item_name = '' or length(item_name) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      execute format(
        'insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',
        target
      ) into related_id using item_name;
      execute format(
        'insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',
        link_table, key_column
      ) using item_id, related_id;
    end loop;
  end loop;

  -- credits[]：每角色最多 300 条（与旧 actors／directors 等分字段上限一致）
  if jsonb_typeof(p_data->'credits') is distinct from 'array' then
    raise exception 'Invalid credits' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'credits') c
    group by nullif(btrim(c->>'role'), '')
    having count(*) > 300
  ) then
    raise exception 'Invalid credits' using errcode = '22023';
  end if;

  for old_person in
    select person_id from public.media_credits where media_item_id = item_id
  loop
    affected := array_append(affected, old_person);
  end loop;

  delete from public.media_credits where media_item_id = item_id;

  for credit_entry in select value from jsonb_array_elements(p_data->'credits') loop
    if jsonb_typeof(credit_entry) is distinct from 'object' then
      raise exception 'Invalid credit entry' using errcode = '22023';
    end if;
    credit_role := nullif(btrim(credit_entry->>'role'), '');
    if credit_role is null then
      raise exception 'Invalid credit role' using errcode = '22023';
    end if;
    select * into role_row from public.credit_roles where code = credit_role;
    if not found then
      raise exception 'Unknown credit role' using errcode = '22023';
    end if;
    if not (item_type = any(role_row.allowed_types)) then
      raise exception 'Credit role not allowed for media type' using errcode = '22023';
    end if;

    item_character := nullif(btrim(credit_entry->>'character'), '');
    if item_character is not null and not role_row.allows_character then
      raise exception 'character not allowed for role' using errcode = '22023';
    end if;
    if length(item_character) > 200 then
      raise exception 'Invalid character' using errcode = '22023';
    end if;

    begin
      credit_order := coalesce((credit_entry->>'order')::integer, 0);
    exception when others then
      raise exception 'Invalid credit order' using errcode = '22023';
    end;
    if credit_order < 0 then
      raise exception 'Invalid credit order' using errcode = '22023';
    end if;

    person_obj := credit_entry->'person';
    if jsonb_typeof(person_obj) is distinct from 'object' then
      raise exception 'Invalid credit person' using errcode = '22023';
    end if;
    chosen_person := null;
    if nullif(person_obj->>'id', '') is not null then
      if person_obj->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid person id' using errcode = '22023';
      end if;
      chosen_person := (person_obj->>'id')::uuid;
      select id into related_id from public.people where id = chosen_person;
      if not found then raise exception 'Person not found' using errcode = 'P0002'; end if;
    else
      item_name := btrim(coalesce(person_obj->>'name', ''));
      person_alt := nullif(btrim(coalesce(person_obj->>'alternate_name', '')), '');
      if item_name is null or item_name = '' or length(item_name) > 200
         or length(person_alt) > 200 then
        raise exception 'Invalid person name' using errcode = '22023';
      end if;
      insert into public.people(name, alternate_name) values(item_name, person_alt)
      on conflict(name, alternate_name) do update set name = excluded.name
      returning id into related_id;
    end if;

    insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
    values(item_id, related_id, credit_role, credit_order, item_character)
    on conflict do nothing;

    affected := array_append(affected, related_id);
    if credit_role = 'author' then
      select name into item_name from public.people where id = related_id;
      author_names := array_append(author_names, item_name);
    end if;
  end loop;

  if item_type = 'book' then
    duplicate_id := public.find_book_by_title_and_authors(
      btrim(p_data->>'title'), author_names, item_id
    );
    if duplicate_id is not null then
      raise exception 'Duplicate book title and authors' using errcode = '23505';
    end if;
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into affected
  from unnest(affected) as x;

  return jsonb_build_object(
    'id', item_id,
    'affected_person_ids', to_jsonb(affected)
  );
end $$;

comment on function public.admin_save_media(jsonb) is
  '站长原子保存媒体。credits:[{person:{id}|{name,alternate_name},role,character?,order}]；返回 {id,affected_person_ids}。不再接受 actors／directors 等旧字段。music 可无专辑；带 parent_id+number 时写入 album_tracks。';

revoke all on function public.admin_save_media(jsonb) from public, anon;
grant execute on function public.admin_save_media(jsonb) to authenticated;

create function public.manage_save_media(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  result jsonb;
  item_id uuid;
  item_name text;
  collection_id uuid;
  collection_ids uuid[] := '{}';
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  if jsonb_typeof(p_data->'collections') is distinct from 'array' or jsonb_array_length(p_data->'collections') > 100 then
    raise exception 'Invalid collection names' using errcode = '22023';
  end if;
  result := public.admin_save_media(p_data);
  item_id := (result->>'id')::uuid;
  for item_name in select btrim(value) from jsonb_array_elements_text(p_data->'collections') loop
    if item_name is null or item_name = '' or length(item_name) > 200 then
      raise exception 'Invalid collection name' using errcode = '22023';
    end if;
    insert into public.media_series(name) values(item_name)
      on conflict(name) do update set name=excluded.name returning id into collection_id;
    collection_ids := array_append(collection_ids, collection_id);
    insert into public.media_item_series(media_item_id,series_id,position)
      select item_id,collection_id,coalesce(max(position),0)+1 from public.media_item_series where series_id=collection_id
      on conflict(media_item_id,series_id) do nothing;
  end loop;
  delete from public.media_item_series where media_item_id=item_id and not (series_id=any(collection_ids));
  return result;
end $$;

revoke all on function public.manage_save_media(jsonb) from public, anon;
grant execute on function public.manage_save_media(jsonb) to authenticated;

create function public.admin_save_album_with_tracks(p_album jsonb, p_tracks jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  album_result jsonb;
  saved_album_id uuid;
  track jsonb;
  track_payload jsonb;
  track_parent uuid;
  track_result jsonb;
  tracks_len integer;
  actual_track_count integer;
  affected uuid[] := '{}';
  keep_song_ids uuid[] := '{}';
  unbound_song_ids uuid[] := '{}';
  saved_song_id uuid;
  existing_song uuid;
  disc_no integer;
  track_no integer;
  existing_type public.media_type;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;

  if coalesce(p_album->>'type', '') <> 'album' then
    raise exception 'Invalid album input' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tracks) is distinct from 'array' then
    raise exception 'Invalid tracks' using errcode = '22023';
  end if;
  tracks_len := jsonb_array_length(p_tracks);
  if tracks_len > 1000 then
    raise exception 'Too many tracks' using errcode = '22023';
  end if;

  album_result := public.manage_save_media(p_album);
  saved_album_id := (album_result->>'id')::uuid;
  select coalesce(array_agg(x::uuid), '{}'::uuid[]) into affected
  from jsonb_array_elements_text(album_result->'affected_person_ids') as x;

  for track in select value from jsonb_array_elements(p_tracks) loop
    if jsonb_typeof(track) is distinct from 'object' then
      raise exception 'Invalid track payload' using errcode = '22023';
    end if;
    track_parent := nullif(track->>'parent_id', '')::uuid;
    if track_parent is not null and track_parent is distinct from saved_album_id then
      raise exception 'Track parent must match album' using errcode = '22023';
    end if;

    existing_song := nullif(track->>'id', '')::uuid;
    disc_no := coalesce(nullif(track->>'disc_number', '')::integer, 1);
    track_no := (track->>'number')::integer;
    if track_no is null or track_no < 0 or track_no > 100000
       or disc_no is null or disc_no < 1 or disc_no > 100 then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;

    if existing_song is not null then
      -- 引用已有曲目：只挂 album_tracks，绝不重置 status／credits／元数据
      select type into existing_type from public.media_items where id = existing_song;
      if not found or existing_type is distinct from 'music'::public.media_type then
        raise exception 'Referenced song not found' using errcode = 'P0002';
      end if;
      if not exists (select 1 from public.music where media_item_id = existing_song) then
        raise exception 'Referenced song not found' using errcode = 'P0002';
      end if;
      if exists (
        select 1 from public.album_tracks
        where album_id = saved_album_id
          and disc_number = disc_no
          and track_number = track_no
          and song_id is distinct from existing_song
      ) then
        raise exception 'duplicate key value violates unique constraint'
          using errcode = '23505';
      end if;
      delete from public.album_tracks
      where album_id = saved_album_id and song_id = existing_song;
      insert into public.album_tracks(album_id, song_id, disc_number, track_number)
      values(saved_album_id, existing_song, disc_no, track_no)
      on conflict on constraint album_tracks_pkey do update
        set song_id = excluded.song_id;
      saved_song_id := existing_song;
    else
      -- 新建曲目：经 admin_save_media（含 status／credits）
      track_payload := track
        || jsonb_build_object(
          'type', 'music',
          'parent_id', saved_album_id::text
        );
      if coalesce(track_payload->>'status', '') = '' then
        track_payload := track_payload || jsonb_build_object('status', 'want_to_watch');
      end if;
      if track_payload->'credits' is null then
        track_payload := track_payload || jsonb_build_object('credits', '[]'::jsonb);
      end if;
      track_result := public.admin_save_media(track_payload);
      saved_song_id := (track_result->>'id')::uuid;
      select coalesce(affected || array_agg(x::uuid), affected) into affected
      from jsonb_array_elements_text(track_result->'affected_person_ids') as x;
    end if;
    keep_song_ids := array_append(keep_song_ids, saved_song_id);
  end loop;

  -- 非空曲目列表视为完整清单：解绑未列出曲；仅当曲目不再属于任何专辑时删除本体
  if tracks_len > 0 then
    select coalesce(array_agg(at.song_id), '{}'::uuid[]) into unbound_song_ids
    from public.album_tracks at
    where at.album_id = saved_album_id
      and not (at.song_id = any(keep_song_ids));

    delete from public.album_tracks at
    where at.album_id = saved_album_id
      and not (at.song_id = any(keep_song_ids));

    if cardinality(unbound_song_ids) > 0 then
      delete from public.media_items m
      where m.id = any(unbound_song_ids)
        and m.type = 'music'::public.media_type
        and not exists (
          select 1 from public.album_tracks other where other.song_id = m.id
        );
    end if;
  end if;

  select count(*)::integer into actual_track_count
  from public.album_tracks
  where album_id = saved_album_id;
  update public.music_albums
  set track_count = actual_track_count
  where media_item_id = saved_album_id;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[]) into affected
  from unnest(affected) as x;

  return jsonb_build_object(
    'id', saved_album_id,
    'affected_person_ids', to_jsonb(affected)
  );
end $$;

revoke all on function public.admin_save_album_with_tracks(jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_album_with_tracks(jsonb, jsonb) to authenticated;

comment on function public.admin_save_album_with_tracks(jsonb, jsonb) is
  '站长同事务保存专辑与曲目；引用已有 song 只挂链不改 status／credits；非空 p_tracks 为完整清单（解绑未列曲，孤儿曲删除）；回写 track_count。返回 {id,affected_person_ids}。';

create or replace function public.admin_delete_media(p_id uuid, p_confirm_title text) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  current_title text;
  item_type public.media_type;
  descendants uuid[];
  orphan_songs uuid[];
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select title,type into current_title,item_type from public.media_items where id=p_id for update;
  if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
  if p_confirm_title is distinct from current_title
    or item_type not in ('movie','tv_show','tv_season','tv_episode','book','album','music') then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;

  if item_type = 'album' then
    select coalesce(array_agg(at.song_id), '{}'::uuid[]) into orphan_songs
    from public.album_tracks at
    where at.album_id = p_id
      and not exists (
        select 1 from public.album_tracks other
        where other.song_id = at.song_id and other.album_id is distinct from p_id
      );
    delete from public.media_items where id = any(orphan_songs);
    delete from public.media_items where id = p_id;
    return;
  end if;

  if item_type = 'music' then
    delete from public.media_items where id = p_id;
    return;
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

comment on function public.admin_delete_media(uuid, text) is
  '站长按标题确认删除；删专辑时只删除不再属于任何其他专辑的曲目。';

revoke all on function public.admin_delete_media(uuid,text) from public, anon;
grant execute on function public.admin_delete_media(uuid,text) to authenticated;


-- find_book／find_music：role 比较改为 text（与 credit_roles 对齐）
create or replace function public.find_book_by_title_and_authors(
  p_title text,
  p_author_names text[] default '{}',
  p_exclude_id uuid default null
)
returns uuid
language sql
stable
parallel safe
set search_path to ''
as $$
  with wanted as (
    select public.normalize_media_title(p_title) as title_key,
      (
        select coalesce(array_agg(distinct public.normalize_media_title(n) order by public.normalize_media_title(n)), '{}'::text[])
        from unnest(coalesce(p_author_names, '{}'::text[])) as n
        where nullif(btrim(n), '') is not null
      ) as author_keys
  ), candidates as (
    select m.id,
      (
        select coalesce(
          array_agg(distinct public.normalize_media_title(p.name) order by public.normalize_media_title(p.name)),
          '{}'::text[]
        )
        from public.media_credits mc
        join public.people p on p.id = mc.person_id
        where mc.media_item_id = m.id
          and mc.role = 'author'
      ) as author_keys
    from public.media_items m
    cross join wanted
    where m.type = 'book'::public.media_type
      and public.normalize_media_title(m.title) = wanted.title_key
      and (p_exclude_id is null or m.id is distinct from p_exclude_id)
  )
  select c.id
  from candidates c
  cross join wanted
  where c.author_keys = wanted.author_keys
  order by c.id
  limit 1;
$$;

create or replace function public.find_music_by_title_and_artists(
  p_type public.media_type,
  p_title text,
  p_artist_names text[] default '{}'
)
returns uuid
language sql
stable
parallel safe
set search_path to ''
as $$
  with wanted as (
    select public.normalize_media_title(p_title) as title_key,
      (
        select coalesce(array_agg(distinct public.normalize_media_title(n) order by public.normalize_media_title(n)), '{}'::text[])
        from unnest(coalesce(p_artist_names, '{}'::text[])) as n
        where nullif(btrim(n), '') is not null
      ) as artist_keys
  ), candidates as (
    select m.id,
      (
        select coalesce(
          array_agg(distinct public.normalize_media_title(p.name) order by public.normalize_media_title(p.name)),
          '{}'::text[]
        )
        from public.media_credits mc
        join public.people p on p.id = mc.person_id
        where mc.media_item_id = m.id
          and mc.role = 'artist'
      ) as artist_keys
    from public.media_items m
    cross join wanted
    where m.type = p_type
      and public.normalize_media_title(m.title) = wanted.title_key
  )
  select c.id
  from candidates c
  cross join wanted
  where c.artist_keys = wanted.artist_keys
  order by c.id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4) get_person_works / get_song_detail
-- ---------------------------------------------------------------------------
create or replace function public.get_person_works(p_person_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_person_id is null or not exists (select 1 from public.people where id = p_person_id) then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;

  with credits as (
    select
      mc.role,
      cr.label as role_label,
      cr.sort_order as role_sort,
      mc.character_name,
      mc.credit_order,
      mi.id as media_id,
      mi.type,
      mi.title,
      mi.alternate_title,
      mi.cover_url,
      mi.release_date,
      case
        when mi.type = 'music'::public.media_type then coalesce(
          mi.release_date,
          (
            select min(ai.release_date)
            from public.album_tracks at
            join public.media_items ai on ai.id = at.album_id
            where at.song_id = mi.id
          )
        )
        else mi.release_date
      end as effective_release_date
    from public.media_credits mc
    join public.credit_roles cr on cr.code = mc.role
    join public.media_items mi on mi.id = mc.media_item_id
    where mc.person_id = p_person_id
      and mi.type in (
        'movie'::public.media_type,
        'tv_show'::public.media_type,
        'album'::public.media_type,
        'music'::public.media_type,
        'book'::public.media_type
      )
  ), film_tv as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date,
          'character', character_name
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type in ('movie'::public.media_type, 'tv_show'::public.media_type)
    group by role, role_label, role_sort
  ), albums as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date,
          'release_kind', (
            select a.release_kind::text from public.music_albums a where a.media_item_id = media_id
          )
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type = 'album'::public.media_type
    group by role, role_label, role_sort
  ), songs as (
    -- 每首歌只出现一次（跨角色取 sort_order 最小的角色分组仍按角色列出时，同一首歌可在不同角色下各出现一次；
    -- 需求：music split into albums and songs；each song appearing once → 按 media_id 去重，保留 credit_order／角色优先）
    select distinct on (media_id)
      role, role_label, role_sort, media_id, title, alternate_title, cover_url, effective_release_date, character_name
    from credits
    where type = 'music'::public.media_type
    order by media_id, role_sort, credit_order
  ), songs_by_role as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', 'music',
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from songs
    group by role, role_label, role_sort
  ), books as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type = 'book'::public.media_type
    group by role, role_label, role_sort
  )
  select jsonb_build_object(
    'person_id', p_person_id,
    'film_tv', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
      from film_tv
    ), '[]'::jsonb),
    'music', jsonb_build_object(
      'albums', coalesce((
        select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
        from albums
      ), '[]'::jsonb),
      'songs', coalesce((
        select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
        from songs_by_role
      ), '[]'::jsonb)
    ),
    'books', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
      from books
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

revoke all on function public.get_person_works(uuid) from public;
grant execute on function public.get_person_works(uuid) to anon, authenticated, service_role;

comment on function public.get_person_works(uuid) is
  '人物作品：影视仅 tv_show／movie；音乐分 albums／songs（歌去重）；图书。按角色分组。';

create or replace function public.get_song_detail(p_song_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  song record;
  cover text;
  result jsonb;
begin
  select
    m.id, m.title, m.alternate_title, m.runtime, m.release_date, m.summary, m.cover_url,
    coalesce(
      m.release_date,
      (
        select min(ai.release_date)
        from public.album_tracks at
        join public.media_items ai on ai.id = at.album_id
        where at.song_id = m.id
      )
    ) as effective_release_date
  into song
  from public.media_items m
  join public.music mu on mu.media_item_id = m.id
  where m.id = p_song_id and m.type = 'music'::public.media_type;

  if not found then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;

  cover := song.cover_url;
  if cover is null then
    select ai.cover_url into cover
    from public.album_tracks at
    join public.media_items ai on ai.id = at.album_id
    where at.song_id = p_song_id
      and ai.cover_url is not null
    order by ai.release_date asc nulls last, at.disc_number, at.track_number
    limit 1;
  end if;

  with credit_rows as (
    select mc.role, mc.credit_order, p.id as person_id, p.name, p.alternate_name
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    where mc.media_item_id = p_song_id
      and mc.role in ('artist','composer','lyricist','arranger','producer','featured')
  ), credits_by_role as (
    select role,
      jsonb_agg(
        jsonb_build_object(
          'id', person_id,
          'name', name,
          'alternate_name', alternate_name
        ) order by credit_order, name
      ) as people
    from credit_rows
    group by role
  ), albums as (
    select
      ai.id, ai.title, ai.cover_url, ai.release_date,
      a.release_kind::text as release_kind,
      at.disc_number, at.track_number
    from public.album_tracks at
    join public.media_items ai on ai.id = at.album_id
    join public.music_albums a on a.media_item_id = at.album_id
    where at.song_id = p_song_id
  ), album_other_tracks_ranked as (
    select
      alb.id as album_id,
      ot.song_id,
      om.title,
      ot.disc_number,
      ot.track_number,
      om.runtime,
      row_number() over (
        partition by alb.id
        order by ot.disc_number, ot.track_number, ot.song_id
      ) as rn
    from albums alb
    join public.album_tracks ot on ot.album_id = alb.id and ot.song_id <> p_song_id
    join public.media_items om on om.id = ot.song_id
  ), album_other_tracks as (
    select
      album_id,
      jsonb_agg(
        jsonb_build_object(
          'id', song_id,
          'title', title,
          'disc_number', disc_number,
          'track_number', track_number,
          'duration_seconds', runtime
        )
        order by disc_number, track_number, song_id
      ) as tracks
    from album_other_tracks_ranked
    where rn <= 20
    group by album_id
  ), related_credit_people as (
    select person_id from credit_rows where role in ('artist', 'composer', 'lyricist')
  ), related_candidates as (
    select
      mi.id,
      mi.title,
      coalesce(
        nullif(mi.cover_url, ''),
        (
          select ai.cover_url
          from public.album_tracks at
          join public.media_items ai on ai.id = at.album_id
          where at.song_id = mi.id
            and ai.cover_url is not null
          order by ai.release_date asc nulls last, at.disc_number, at.track_number
          limit 1
        )
      ) as cover_url,
      coalesce(mi.release_date, (
        select min(ai.release_date) from public.album_tracks at
        join public.media_items ai on ai.id = at.album_id where at.song_id = mi.id
      )) as release_date
    from public.media_credits mc
    join public.media_items mi on mi.id = mc.media_item_id
    where mc.person_id in (select person_id from related_credit_people)
      and mc.role in ('artist', 'composer', 'lyricist')
      and mi.type = 'music'::public.media_type
      and mi.id <> p_song_id
    group by mi.id, mi.title, mi.cover_url, mi.release_date
  ), related_songs as (
    select id, title, cover_url, release_date
    from related_candidates
    order by release_date desc nulls last, id
    limit 12
  )
  select jsonb_build_object(
    'id', song.id,
    'title', song.title,
    'alternate_title', song.alternate_title,
    'duration_seconds', song.runtime,
    'release_date', song.effective_release_date,
    'summary', song.summary,
    'cover_url', cover,
    'genres', coalesce((
      select jsonb_agg(g.name order by g.name)
      from public.media_genres mg join public.genres g on g.id = mg.genre_id
      where mg.media_item_id = p_song_id
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(l.name order by l.name)
      from public.media_languages ml join public.languages l on l.id = ml.language_id
      where ml.media_item_id = p_song_id
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('id', ms.id, 'name', ms.name) order by mis.position nulls last, ms.name)
      from public.media_item_series mis
      join public.media_series ms on ms.id = mis.series_id
      where mis.media_item_id = p_song_id
    ), '[]'::jsonb),
    'credits', coalesce((
      select jsonb_object_agg(role, people) from credits_by_role
    ), '{}'::jsonb),
    'albums', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'cover_url', a.cover_url,
          'release_date', a.release_date,
          'release_kind', a.release_kind,
          'disc_number', a.disc_number,
          'track_number', a.track_number,
          'other_tracks', coalesce(ot.tracks, '[]'::jsonb)
        )
        order by a.release_date desc nulls last, a.title
      )
      from albums a
      left join album_other_tracks ot on ot.album_id = a.id
    ), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id, 'title', title, 'cover_url', cover_url, 'release_date', release_date
        )
        order by release_date desc nulls last, id
      )
      from related_songs
    ), '[]'::jsonb),
    'tracking', (
      select jsonb_build_object('status', t.status, 'rating', t.rating)
      from public.tracking t where t.media_item_id = p_song_id
    )
  ) into result;

  return result;
end $$;

revoke all on function public.get_song_detail(uuid) from public;
grant execute on function public.get_song_detail(uuid) to anon, authenticated, service_role;

comment on function public.get_song_detail(uuid) is
  '歌曲详情：元数据、按角色 credits、所属专辑与同专其他曲（每专最多 20）、相关歌曲（艺人／词曲合并去重最多 12）、封面回退专辑、tracking（受 RLS）。';

