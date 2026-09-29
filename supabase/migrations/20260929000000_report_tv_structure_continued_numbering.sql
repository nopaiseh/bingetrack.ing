-- 季集结构报告允许下一季的集号接续上一季（第 1 季到第 24 集，第 2 季从第 25 集开始），不再把 1–24 报为缺集。
-- 判断：季号大于 0 的季，若首个集号大于上一个有单集的季的最大集号，就从「上一季最大集号 + 1」起检查断号；
-- 否则仍从第 1 集检查。编号 0 的特别季与特别集照旧不计。季的断号判断不变。
create or replace view public.v_report_tv_structure
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
left join lateral (
  select s.series_id, s.season_number from public.tv_seasons s where s.id = m.id
) season on true
cross join lateral (
  select (select count(*) from public.tv_episodes e where e.season_id = m.id) as total,
    (select min(e.episode_number) from public.tv_episodes e where e.season_id = m.id and e.episode_number > 0) as first_number,
    (select max(e.episode_number) from public.tv_episodes e where e.season_id = (
      select ps.id from public.tv_seasons ps
      where ps.series_id = season.series_id and ps.season_number > 0 and ps.season_number < season.season_number
        and exists (select 1 from public.tv_episodes pe where pe.season_id = ps.id and pe.episode_number > 0)
      order by ps.season_number desc limit 1
    )) as previous_last
) counts
cross join lateral (
  select case when season.season_number > 0 and counts.previous_last is not null and counts.first_number > counts.previous_last
    then counts.previous_last + 1 else 1 end as start
) numbering
cross join lateral (
  select (select array_agg(n order by n) from generate_series(numbering.start, (select max(episode_number) from public.tv_episodes e where e.season_id = m.id)) n
    where not exists (select 1 from public.tv_episodes e where e.season_id = m.id and e.episode_number = n)) as missing
) gap
where m.type = 'tv_season'::public.media_type and (counts.total = 0 or gap.missing is not null);
