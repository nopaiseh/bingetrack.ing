-- 管理列表排序依据：电影与单集取自身上映日期；剧集与剧季取最近一集的播出日期，
-- 尚无已播集时取最早一集，与 v_all_media 中剧集 sort_date 的口径一致。
-- parent_id、item_number 供按上级条目筛选和同日期内按季号／集号排序。
create view public.v_manage_media_order
with (security_invoker = true) as
select
  m.id,
  m.type,
  m.title,
  coalesce(s.series_id, e.season_id) as parent_id,
  coalesce(s.season_number, e.episode_number) as item_number,
  case m.type
    when 'tv_series'::public.media_type then (
      select coalesce(
        max(em.release_date) filter (where em.release_date <= current_date),
        min(em.release_date)
      )
      from public.tv_seasons ss
      join public.tv_episodes ee on ee.season_id = ss.id
      join public.media_items em on em.id = ee.id
      where ss.series_id = m.id
    )
    when 'tv_season'::public.media_type then (
      select coalesce(
        max(em.release_date) filter (where em.release_date <= current_date),
        min(em.release_date)
      )
      from public.tv_episodes ee
      join public.media_items em on em.id = ee.id
      where ee.season_id = m.id
    )
    else m.release_date
  end as sort_date
from public.media_items m
left join public.tv_seasons s on s.id = m.id
left join public.tv_episodes e on e.id = m.id;

-- 仅管理页使用：匿名访客不可读取，登录用户读取时仍受底表 RLS 约束。
revoke all on public.v_manage_media_order from public, anon, authenticated;
grant select on public.v_manage_media_order to authenticated;
