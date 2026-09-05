-- Review/deploy separately from the application. No base tables or policies change.
-- Both views execute with the caller's privileges and existing base-table RLS.
begin;

create or replace view public.v_media_series_years
with (security_invoker = true) as
select s.series_id,
  extract(year from min(m.release_date))::integer as first_year,
  extract(year from max(m.release_date))::integer as last_year
from public.tv_seasons s
join public.tv_episodes e on e.season_id = s.id
join public.media_items m on m.id = e.id
group by s.series_id;

create or replace view public.v_media_season_summaries
with (security_invoker = true) as
select s.id, s.series_id, s.season_number,
  sm.title, sm.alternate_title, sm.summary, sm.cover_url,
  count(e.id)::integer as episode_count,
  count(e.id) filter (where t.status = 'watched')::integer as watched_episode_count,
  extract(year from min(em.release_date))::integer as first_year,
  extract(year from max(em.release_date))::integer as last_year
from public.tv_seasons s
left join public.media_items sm on sm.id = s.id
left join public.tv_episodes e on e.season_id = s.id
left join public.media_items em on em.id = e.id
left join public.tracking t on t.media_item_id = e.id
group by s.id, s.series_id, s.season_number, sm.title, sm.alternate_title, sm.summary, sm.cover_url;

revoke all on public.v_media_series_years, public.v_media_season_summaries from public, anon, authenticated;
grant select on public.v_media_series_years, public.v_media_season_summaries to anon, authenticated;
notify pgrst, 'reload schema';
commit;

-- Rollback, after reverting the application (its missing-view fallback is also safe):
-- drop view public.v_media_season_summaries;
-- drop view public.v_media_series_years;
