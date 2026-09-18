-- 将电视剧排序基准更新为最新播出单集，并补充首播与末播日期字段用于平局排序与年份筛选解耦。
begin;

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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director'::public.person_role) as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date
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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'director'::public.person_role) as directors,
  series.alternate_title,
  min(episode_media.release_date) as first_air_date,
  max(episode_media.release_date) as last_air_date
from public.media_items series
left join public.tv_seasons seasons on seasons.series_id = series.id
left join public.tv_episodes episodes on episodes.season_id = seasons.id
left join public.media_items episode_media on episodes.id = episode_media.id
left join public.tracking t on t.media_item_id = episodes.id
where series.type = 'tv_series'::public.media_type
group by series.id;

notify pgrst, 'reload schema';
commit;

