-- 音乐模块第一期：拥有权、作词人、专辑字段、艺人改走 media_credits、
-- 专辑评分／在听进度视图、去重辅助、search_media 扩展到专辑与单曲。
-- 不写入 MusicBrainz ID；不触碰生产数据以外的应用环境。

-- 1) 作词人角色
alter type public.person_role add value if not exists 'lyricist';

-- 2) 拥有权（与收听／观看追踪独立；图书等日后可复用）
create type public.ownership_status as enum ('want_to_own', 'owned');

create table public.ownership (
  id uuid default gen_random_uuid() not null,
  media_item_id uuid not null,
  status public.ownership_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ownership_pkey primary key (id),
  constraint ownership_media_item_id_key unique (media_item_id),
  constraint ownership_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade
);

comment on table public.ownership is
  '实体拥有意向／状态，与 tracking（听过／想听等）独立；可复用于图书等类型。';

create index ownership_status_idx on public.ownership using btree (status);

alter table public.ownership enable row level security;

create policy "Allow SELECT from website" on public.ownership
  for select to anon, authenticated using (true);

grant select on public.ownership to anon, authenticated;
grant insert, update, delete on public.ownership to authenticated;

create policy "Owner insert" on public.ownership
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.ownership
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.ownership
  for delete to authenticated using ((select public.is_site_owner()));

-- 音乐扩展表此前仅有公开读；补齐站长写入，便于后续导入与管理。
grant insert, update, delete on public.music to authenticated;
grant insert, update, delete on public.music_albums to authenticated;

create policy "Owner insert" on public.music
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.music
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.music
  for delete to authenticated using ((select public.is_site_owner()));

create policy "Owner insert" on public.music_albums
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.music_albums
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.music_albums
  for delete to authenticated using ((select public.is_site_owner()));

-- 3) 专辑元数据
alter table public.music_albums
  add column track_count integer,
  add column label text,
  add constraint music_albums_track_count_nonnegative_check
    check (track_count is null or track_count >= 0),
  add constraint music_albums_label_length_check
    check (label is null or (length(label) between 1 and 200));

comment on column public.music_albums.track_count is '专辑曲目数（导入／编辑写入，非实时聚合）。';
comment on column public.music_albums.label is '唱片公司。';

-- 4) 将 music_albums.artist_id 迁入 media_credits（role=artist），保留列但标记弃用
insert into public.media_credits (media_item_id, person_id, role, credit_order)
select a.media_item_id, a.artist_id, 'artist'::public.person_role, 0
from public.music_albums a
where a.artist_id is not null
on conflict (media_item_id, person_id, role) do nothing;

comment on column public.music_albums.artist_id is
  'DEPRECATED: 专辑艺人改走 media_credits（role=artist）。保留列以免破坏旧数据与外键；新代码勿再读写。';

-- 5) 标题规范化与音乐去重：同名（忽略大小写与多余空白）+ 同一组艺人 = 同一条目
create or replace function public.normalize_media_title(p_title text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'));
$$;

revoke all on function public.normalize_media_title(text) from public;
grant execute on function public.normalize_media_title(text) to anon, authenticated, service_role;

comment on function public.normalize_media_title(text) is
  '去首尾空白、折叠内部空白并小写，供音乐／专辑去重与导入比对。';

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
          and mc.role = 'artist'::public.person_role
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

revoke all on function public.find_music_by_title_and_artists(public.media_type, text, text[]) from public;
grant execute on function public.find_music_by_title_and_artists(public.media_type, text, text[])
  to authenticated, service_role;

comment on function public.find_music_by_title_and_artists(public.media_type, text, text[]) is
  '按规范化标题与 artist 角色演职员集合查找已有 music／album；供导入去重，不持久化外部 ID。';

-- 6) 专辑评分：已评分曲目的实时平均（不落库）
create or replace function public.album_average_rating(p_album_id uuid)
returns numeric
language sql
stable
parallel safe
set search_path to ''
as $$
  select round(avg(t.rating), 1)
  from public.music mu
  join public.tracking t on t.media_item_id = mu.media_item_id
  where mu.album_id = p_album_id
    and t.rating is not null;
$$;

revoke all on function public.album_average_rating(uuid) from public;
grant execute on function public.album_average_rating(uuid) to anon, authenticated, service_role;

comment on function public.album_average_rating(uuid) is
  '专辑评分 = 下属已评分单曲 rating 的实时平均；不存储。';

-- 7) 在听：至少一首听过、但未全部听过的专辑
create or replace view public.v_continue_listening
with (security_invoker = true)
as
select
  album.media_item_id as album_id,
  item.title,
  item.cover_url,
  item.release_date,
  count(mu.media_item_id)::integer as track_total,
  count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)::integer as track_watched,
  max(item_track.release_date) filter (where t.status = 'watched'::public.tracking_status) as last_listened_release_date
from public.music_albums album
join public.media_items item on item.id = album.media_item_id
join public.music mu on mu.album_id = album.media_item_id
join public.media_items item_track on item_track.id = mu.media_item_id
left join public.tracking t on t.media_item_id = mu.media_item_id
group by album.media_item_id, item.title, item.cover_url, item.release_date
having count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status) > 0
   and count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)
       < count(mu.media_item_id);

comment on view public.v_continue_listening is
  '在听专辑：至少一首曲目 status=watched，但并非全部曲目都已 watched。无新 tracking 状态。';

grant select on public.v_continue_listening to anon, authenticated, service_role;

-- 8) 扩展 v_all_media：纳入 album／music，并附加 artists 数组；专辑 rating／status 由曲目汇总
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
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist'::public.person_role) as artists
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
  max(episode_media.release_date) as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'artist'::public.person_role) as artists
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
    when count(mu.media_item_id) > 0
      and count(t.media_item_id) = count(mu.media_item_id)
      and min(t.status)::text = 'watched'
      and max(t.status)::text = 'watched'
      then 'watched'
    when count(mu.media_item_id) > 0
      and count(t.media_item_id) = count(mu.media_item_id)
      and min(t.status)::text = 'want_to_watch'
      and max(t.status)::text = 'want_to_watch'
      then 'want_to_watch'
    when count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status) > 0
      then 'watching'
    when count(t.media_item_id) > 0 then 'watching'
    else null::text
  end as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = album_item.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = album_item.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = album_item.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'director'::public.person_role) as directors,
  album_item.alternate_title,
  album_item.release_date as first_air_date,
  album_item.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'artist'::public.person_role) as artists
from public.media_items album_item
join public.music_albums album on album.media_item_id = album_item.id
left join public.music mu on mu.album_id = album.media_item_id
left join public.tracking t on t.media_item_id = mu.media_item_id
where album_item.type = 'album'::public.media_type
group by album_item.id
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
  m.runtime::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director'::public.person_role) as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist'::public.person_role) as artists
from public.media_items m
left join public.tracking t on t.media_item_id = m.id
where m.type = 'music'::public.media_type
group by m.id, m.runtime;

-- 9) search_media：无分类关键词时纳入 album／music，并匹配 artist 角色
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
  ), scope as (
    select
      term,
      '%' || term || '%' as pattern,
      series_only,
      all_categories,
      case
        when all_categories then array['movie', 'tv_show', 'album', 'music']
        else types
      end as searched_types,
      all_categories or series_only as searches_series,
      case
        when all_categories then array['director', 'actor', 'artist']
        else roles
      end as searched_roles
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

revoke all on function public.search_media(text, text[], boolean, text[]) from public;
grant execute on function public.search_media(text, text[], boolean, text[]) to anon, authenticated, service_role;
