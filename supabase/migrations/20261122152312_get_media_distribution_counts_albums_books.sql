-- 媒体全景地区／语言／类型分布：在 get_media_distribution_counts 中纳入专辑与图书。
-- 路由键与 PUBLIC_MEDIA_TYPES 对齐（albums／books）；单曲（music）不计。
-- 年份分桶口径与电影一致（release_year 或 sort_date 年）；All Time 汇总不变。
-- 维度仍来自 v_all_media 的 regions／languages／genres 数组；某类型未挂某维度则自然无行。

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
