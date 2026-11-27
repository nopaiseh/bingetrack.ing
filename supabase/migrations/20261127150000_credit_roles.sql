-- credit_roles 字典：演职角色可配置，media_credits.role 改为 text FK。
-- 过渡期保留 person_role 枚举（隐式 text 转换），drop_legacy 再删。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

-- ---------------------------------------------------------------------------
-- 1) 字典表
-- ---------------------------------------------------------------------------
create table public.credit_roles (
  code text primary key,
  label text not null,
  sort_order integer not null,
  allowed_types public.media_type[] not null,
  allows_character boolean not null default false,
  constraint credit_roles_label_length_check
    check (length(label) between 1 and 100),
  constraint credit_roles_sort_order_nonnegative_check
    check (sort_order >= 0),
  constraint credit_roles_allowed_types_nonempty_check
    check (cardinality(allowed_types) > 0)
);

comment on table public.credit_roles is
  '演职角色字典。media_credits.role 外键指向 code；allowed_types 限制可用媒体类型；allows_character 控制是否可填角色名。';

comment on column public.credit_roles.allowed_types is
  '该角色允许挂载的 media_items.type。由 media_credits_enforce_allowed_types 触发器强制；保存 RPC 亦预检。';

comment on column public.credit_roles.allows_character is
  '为 true 时可写 media_credits.character_name（当前 actor／voice_actor）。';

alter table public.credit_roles enable row level security;

grant select on public.credit_roles to anon, authenticated, service_role;
grant insert, update, delete on public.credit_roles to authenticated, service_role;

create policy "Allow SELECT from website" on public.credit_roles
  for select to anon, authenticated using (true);

create policy "Owner insert" on public.credit_roles
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.credit_roles
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.credit_roles
  for delete to authenticated using ((select public.is_site_owner()));

-- ---------------------------------------------------------------------------
-- 2) 种子：既有 6 角色保持语义；新增 7 角色
--    allowed_types 口径（文档）：
--      actor／director／writer／voice_actor → movie + tv_*（影视树）
--      author → book
--      artist → album + music
--      composer／lyricist／arranger／featured → music
--      producer → album + music
--      guest／host → tv_show only
-- ---------------------------------------------------------------------------
insert into public.credit_roles (code, label, sort_order, allowed_types, allows_character) values
  ('actor',       '演员',   10, array['movie','tv_show','tv_season','tv_episode']::public.media_type[], true),
  ('director',    '导演',   20, array['movie','tv_show','tv_season','tv_episode']::public.media_type[], false),
  ('writer',      '编剧',   30, array['movie','tv_show','tv_season','tv_episode']::public.media_type[], false),
  ('voice_actor', '配音',   40, array['movie','tv_show','tv_season','tv_episode']::public.media_type[], true),
  ('host',        '主持',   50, array['tv_show']::public.media_type[], false),
  ('guest',       '嘉宾',   60, array['tv_show']::public.media_type[], false),
  ('author',      '作者',   70, array['book']::public.media_type[], false),
  ('artist',      '艺人',   80, array['album','music']::public.media_type[], false),
  ('composer',    '作曲',   90, array['music']::public.media_type[], false),
  ('lyricist',    '作词',  100, array['music']::public.media_type[], false),
  ('arranger',    '编曲',  110, array['music']::public.media_type[], false),
  ('producer',    '制作人', 120, array['album','music']::public.media_type[], false),
  ('featured',    '合唱',  130, array['music']::public.media_type[], false);

-- ---------------------------------------------------------------------------
-- 3) media_credits.role：enum → text + FK；角色名改由 allows_character 校验
--    先卸依赖视图／函数（列类型变更所需），稍后再按 text 比较重建。
-- ---------------------------------------------------------------------------
drop function if exists public.search_media(text, text[], boolean, text[]);
drop function if exists public.get_media_stats(text);
drop function if exists public.get_media_distribution_counts();
drop view if exists public.v_all_media;
drop view if exists public.v_report_missing_character;
drop view if exists public.v_report_incomplete_media;
drop view if exists public.v_report_credit_order;

alter table public.media_credits
  drop constraint if exists media_credits_character_actor_only_check;

alter table public.media_credits
  alter column role type text using role::text;

alter table public.media_credits
  add constraint media_credits_role_fkey
    foreign key (role) references public.credit_roles(code);

-- 过渡：既有视图／函数仍写 'actor'::person_role；隐式转到 text 以便比较。
do $$
begin
  if not exists (
    select 1 from pg_cast
    where castsource = 'public.person_role'::regtype
      and casttarget = 'text'::regtype
      and castcontext = 'i'
  ) then
    create cast (public.person_role as text) with inout as implicit;
  end if;
end $$;

create or replace function public.media_credits_enforce_character()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  role_allows boolean;
begin
  if new.character_name is null then
    return new;
  end if;
  select cr.allows_character into role_allows
  from public.credit_roles cr
  where cr.code = new.role;
  if role_allows is distinct from true then
    raise exception 'character_name only allowed for roles with allows_character'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists media_credits_enforce_character on public.media_credits;
create trigger media_credits_enforce_character
  before insert or update of role, character_name on public.media_credits
  for each row execute function public.media_credits_enforce_character();

revoke all on function public.media_credits_enforce_character() from public, anon, authenticated;

comment on function public.media_credits_enforce_character() is
  '仅 allows_character=true 的角色可写 character_name；替代旧的 actor-only check。';

create or replace function public.media_credits_enforce_allowed_types()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  media_type public.media_type;
  allowed public.media_type[];
begin
  select m.type into media_type
  from public.media_items m
  where m.id = new.media_item_id;
  if media_type is null then
    raise exception 'media_item not found for credit'
      using errcode = '23514';
  end if;
  select cr.allowed_types into allowed
  from public.credit_roles cr
  where cr.code = new.role;
  if allowed is null then
    raise exception 'unknown credit role'
      using errcode = '23514';
  end if;
  if not (media_type = any(allowed)) then
    raise exception 'credit role not allowed for media type'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists media_credits_enforce_allowed_types on public.media_credits;
create trigger media_credits_enforce_allowed_types
  before insert or update of role, media_item_id on public.media_credits
  for each row execute function public.media_credits_enforce_allowed_types();

revoke all on function public.media_credits_enforce_allowed_types() from public, anon, authenticated;

comment on function public.media_credits_enforce_allowed_types() is
  'media_credits.role 必须属于 credit_roles.allowed_types 对应该媒体类型；media_item_id 变更时亦校验。';

-- ---------------------------------------------------------------------------
-- 4) 索引
-- ---------------------------------------------------------------------------
drop index if exists public.media_credits_person_id_idx;
create index media_credits_person_id_role_media_item_id_idx
  on public.media_credits using btree (person_id, role, media_item_id);

create index if not exists name_issue_confirmations_person_id_idx
  on public.name_issue_confirmations using btree (person_id);

-- ---------------------------------------------------------------------------
-- 4b) 重建依赖 media_credits.role 的视图／函数（比较改为 text 字面量）
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
    when count(mu.media_item_id) > 0
      and count(t.media_item_id) filter (where t.status = 'watched'::public.tracking_status)
        = count(mu.media_item_id)
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
    from public.music track
    join public.media_languages ml on ml.media_item_id = track.media_item_id
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
  -- 与 release_year_stats 曲目年份一致：自身 release_date，否则所属专辑。
  coalesce(m.release_date, album_item.release_date) as sort_date,
  extract(year from coalesce(m.release_date, album_item.release_date))::text as release_year,
  round(avg(t.rating), 1) as rating,
  m.runtime::integer as runtime,
  (select t1.status::text from public.tracking t1 where t1.media_item_id = m.id limit 1) as status,
  (select array_agg(g.name) from public.media_genres mg join public.genres g on g.id = mg.genre_id where mg.media_item_id = m.id) as genres,
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = m.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = m.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director') as directors,
  m.alternate_title,
  coalesce(m.release_date, album_item.release_date) as first_air_date,
  coalesce(m.release_date, album_item.release_date) as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor') as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist') as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author') as authors
from public.media_items m
left join public.music mu on mu.media_item_id = m.id
left join public.media_items album_item on album_item.id = mu.album_id
left join public.tracking t on t.media_item_id = m.id
where m.type = 'music'::public.media_type
group by m.id, m.runtime, album_item.release_date
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
create or replace view public.v_report_missing_character
with (security_invoker = true) as
select c.id::text as id, c.type::text as link_type, c.id as link_id, c.title, c.context as detail,
  array_agg(p.name order by mc.credit_order, p.name) as tags, count(*)::integer as weight, c.title as sort_key
from public.media_credits mc
join public.people p on p.id = mc.person_id
join public.v_report_media_context c on c.id = mc.media_item_id
where mc.role = 'actor' and mc.character_name is null
group by c.id, c.type, c.title, c.context;
create or replace view public.v_report_incomplete_media
with (security_invoker = true) as
select * from (
  select m.id::text as id, m.type::text as link_type, m.id as link_id, m.title, c.context as detail,
    array_remove(case when m.type = 'tv_episode'::public.media_type then array[
      case when m.release_date is null then 'no_release_date' end
    ] else array[
      case when nullif(btrim(m.cover_url), '') is null then 'no_cover' end,
      case when nullif(btrim(m.summary), '') is null then 'no_summary' end,
      case when m.type = 'movie'::public.media_type and m.release_date is null then 'no_release_date' end,
      case when not exists (select 1 from public.media_genres x where x.media_item_id = m.id) then 'no_genres' end,
      case when not exists (select 1 from public.media_regions x where x.media_item_id = m.id) then 'no_regions' end,
      case when not exists (select 1 from public.media_languages x where x.media_item_id = m.id) then 'no_languages' end,
      case when not exists (select 1 from public.media_credits x where x.media_item_id = m.id and x.role = 'actor') then 'no_actors' end,
      case when not exists (select 1 from public.media_credits x where x.media_item_id = m.id and x.role = 'director') then 'no_directors' end
    ] end, null) as tags,
    0 as weight, m.title as sort_key
  from public.media_items m
  join public.v_report_media_context c on c.id = m.id
  where m.type in ('movie'::public.media_type, 'tv_show'::public.media_type, 'tv_episode'::public.media_type)
) r
where cardinality(r.tags) > 0;
create or replace view public.v_report_credit_order
with (security_invoker = true) as
select c.id::text as id, c.type::text as link_type, c.id as link_id, c.title, c.context as detail,
  array_agg(o.role::text || '_order' order by o.role) as tags, 0 as weight, c.title as sort_key
from (
  select mc.media_item_id, mc.role
  from public.media_credits mc
  group by mc.media_item_id, mc.role
  having count(mc.credit_order) <> count(*)
    or count(distinct mc.credit_order) <> count(*)
    or min(mc.credit_order) <> 0
    or max(mc.credit_order) <> count(*) - 1
) o
join public.v_report_media_context c on c.id = o.media_item_id
group by c.id, c.type, c.title, c.context;
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

grant select on public.v_all_media to anon, authenticated, service_role;
revoke all on public.v_report_missing_character from public, anon, authenticated;
revoke all on public.v_report_incomplete_media from public, anon, authenticated;
revoke all on public.v_report_credit_order from public, anon, authenticated;
grant select on public.v_report_missing_character to authenticated;
grant select on public.v_report_incomplete_media to authenticated;
grant select on public.v_report_credit_order to authenticated;

revoke all on function public.get_media_stats(text) from public;
grant execute on function public.get_media_stats(text) to anon, authenticated, service_role;

revoke all on function public.get_media_distribution_counts() from public;
grant execute on function public.get_media_distribution_counts() to anon, authenticated, service_role;
alter function public.get_media_distribution_counts() set search_path = '';
alter function public.get_media_stats(text) set search_path = '';

-- ---------------------------------------------------------------------------
-- 5) search_media：默认角色列表读自 credit_roles（按 sort_order）
-- ---------------------------------------------------------------------------
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

comment on function public.search_media(text, text[], boolean, text[]) is
  '跨表关键词搜索；无显式角色时默认角色列表取自 credit_roles（按 sort_order）。LIKE 通配符已转义。';
