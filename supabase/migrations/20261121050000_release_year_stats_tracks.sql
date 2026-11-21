-- 媒体全景年度统计：在 release_year_stats 末尾追加曲目（全部 songs）计数。
-- 现有列名、类型、顺序与计算结果保持不变；时长列仍只含影视。
-- 曲目年份：自身 media_items.release_date，否则所属专辑的 release_date；二者皆无则不计。
-- 无 tracking 视为未完成（也不算想听）；口径与专辑／图书一致。

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
  -- 专辑时长强制为 0；无 tracking 不算想听，仅 want_to_watch 计入 want_albums。
  select m.id, extract(year from m.release_date)::integer as release_year,
    'album'::text as media_type,
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
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'album'::public.media_type and m.release_date is not null
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
    extract(year from coalesce(m.release_date, album_item.release_date))::integer as release_year,
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
  left join public.music mu on mu.media_item_id = m.id
  left join public.media_items album_item on album_item.id = mu.album_id
  left join public.tracking t on t.media_item_id = m.id
  where m.type = 'music'::public.media_type
    and coalesce(m.release_date, album_item.release_date) is not null
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
  count(id) filter (where media_type = 'music' and status = 'want_to_watch') as want_tracks
from combined_stats
group by release_year
order by (release_year is null) desc, coalesce(release_year::text, 'All Time') desc;
