-- 扩展 get_media_stats：追加 in_progress（在读）计数，供图书目录一次取回四项统计。
-- 返回类型变更须 drop + recreate；不修改业务数据；预检失败则 RAISE。

do $$
declare
  result_type text;
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'tracking_status'
      and e.enumlabel = 'in_progress'
  ) then
    raise exception
      'Cannot extend get_media_stats: tracking_status.in_progress missing. Apply 20261120150000 first.';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'media_type'
      and e.enumlabel = 'book'
  ) then
    raise exception
      'Cannot extend get_media_stats: media_type.book missing. Apply 20261120150100 first.';
  end if;

  if to_regprocedure('public.get_media_stats(text)') is null then
    raise exception
      'Cannot extend get_media_stats: public.get_media_stats(text) does not exist.';
  end if;

  result_type := pg_get_function_result('public.get_media_stats(text)'::regprocedure);

  if result_type ~* 'in_progress' then
    raise exception
      'Cannot extend get_media_stats: in_progress already in return type (%). Inspect before re-applying.',
      result_type;
  end if;

  if result_type is distinct from
    'TABLE(total bigint, watched bigint, watching bigint, want bigint, upcoming bigint)'
  then
    raise exception
      'Cannot extend get_media_stats: unexpected current return type (%). Expected TABLE(total, watched, watching, want, upcoming).',
      result_type;
  end if;
end $$;

drop function public.get_media_stats(text);

-- 统计指定媒体类型的总数、已看、在看、想看、即将上映／播出，以及在读（图书）数量。
-- 发行日期为今天或以后的电影，或存在今天及以后播出且未看单集的电视剧计入 upcoming。
-- in_progress 仅图书使用；影视调用时该列恒为 0，保持既有字段语义不变。
create function public.get_media_stats(p_media_type text)
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

revoke all on function public.get_media_stats(text) from public;
grant execute on function public.get_media_stats(text) to anon, authenticated, service_role;
