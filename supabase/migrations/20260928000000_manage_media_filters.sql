-- 管理列表按别名搜索、按观看状态筛选、按评分排序：在 v_manage_media_order 末尾追加 alternate_title、status、rating。
-- 只追加列、不改原有列，旧版应用照常读取；回滚时用 20260926020000_manage_media_order.sql 的定义重建视图即可。
--
-- status 与管理列表显示口径一致，没有记录时视为 want_to_watch（没看过）：
--   电影、单集取自身 tracking；
--   电视节目与 v_all_media 相同：全部单集看过为 watched，全部想看为 want_to_watch，其余有记录为 watching；
--   季与 v_media_season_summaries 相同：全部单集看过为 watched，部分看过为 watching。
-- rating：电影、单集取自身评分，电视节目取各集评分平均（一位小数），季不评分。
create or replace view public.v_manage_media_order
with (security_invoker = true) as
select
  m.id,
  m.type,
  m.title,
  coalesce(s.series_id, e.season_id) as parent_id,
  coalesce(s.season_number, e.episode_number) as item_number,
  case m.type
    when 'tv_show'::public.media_type then (
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
  end as sort_date,
  m.alternate_title,
  case m.type
    when 'tv_show'::public.media_type then (
      select case
        when count(ee.id) > 0 and count(t.media_item_id) = count(ee.id) and bool_and(t.status = 'watched') then 'watched'
        when count(ee.id) > 0 and count(t.media_item_id) = count(ee.id) and bool_and(t.status = 'want_to_watch') then 'want_to_watch'
        when count(t.media_item_id) > 0 then 'watching'
        else 'want_to_watch'
      end
      from public.tv_seasons ss
      join public.tv_episodes ee on ee.season_id = ss.id
      left join public.tracking t on t.media_item_id = ee.id
      where ss.series_id = m.id
    )
    when 'tv_season'::public.media_type then (
      select case
        when count(ee.id) > 0 and count(ee.id) filter (where t.status = 'watched') = count(ee.id) then 'watched'
        when count(ee.id) filter (where t.status = 'watched') > 0 then 'watching'
        else 'want_to_watch'
      end
      from public.tv_episodes ee
      left join public.tracking t on t.media_item_id = ee.id
      where ee.season_id = m.id
    )
    else coalesce(tm.status::text, 'want_to_watch')
  end as status,
  case m.type
    when 'tv_show'::public.media_type then (
      select round(avg(t.rating), 1)
      from public.tv_seasons ss
      join public.tv_episodes ee on ee.season_id = ss.id
      join public.tracking t on t.media_item_id = ee.id
      where ss.series_id = m.id
    )
    when 'tv_season'::public.media_type then null::numeric
    else tm.rating
  end as rating
from public.media_items m
left join public.tv_seasons s on s.id = m.id
left join public.tv_episodes e on e.id = m.id
left join public.tracking tm on tm.media_item_id = m.id;

-- create or replace 保留原有授权；这里重申一次，避免权限随视图变化被误改。
revoke all on public.v_manage_media_order from public, anon, authenticated;
grant select on public.v_manage_media_order to authenticated;
