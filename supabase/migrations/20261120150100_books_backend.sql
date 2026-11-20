-- 图书模块后端：books 扩展表、在读状态约束、作者去重、admin_save_media 图书分支、
-- v_all_media／search_media 纳入图书。不修改生产业务数据；预检失败则 RAISE。

-- ---------------------------------------------------------------------------
-- 1) books 表（与 media_items 一对一；无 ISBN；原作名／出版日复用 media_items）
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.books') is not null then
    raise exception
      'Cannot create public.books: table already exists. Inspect and drop/rename before applying this migration.';
  end if;
end $$;

create table public.books (
  media_item_id uuid not null,
  page_count integer,
  publisher text,
  constraint books_pkey primary key (media_item_id),
  constraint books_media_item_id_fkey
    foreign key (media_item_id) references public.media_items(id) on delete cascade,
  constraint books_page_count_range_check
    check (page_count is null or (page_count >= 1 and page_count <= 20000)),
  constraint books_publisher_length_check
    check (publisher is null or (length(publisher) between 1 and 200))
);

comment on table public.books is
  '图书扩展表：页数与出版社；原作名用 media_items.alternate_title，出版日用 media_items.release_date；无 ISBN。';
comment on column public.books.page_count is '页数；空或 1–20000。';
comment on column public.books.publisher is '出版社；空或 1–200 字。';

alter table public.books enable row level security;

create policy "Allow SELECT from website" on public.books
  for select to anon, authenticated using (true);

grant select on public.books to anon, authenticated;
grant insert, update, delete on public.books to authenticated;

create policy "Owner insert" on public.books
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.books
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.books
  for delete to authenticated using ((select public.is_site_owner()));

-- ---------------------------------------------------------------------------
-- 2) in_progress 仅允许图书：预检 + 触发器
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
  sample text;
begin
  select count(*)::integer, string_agg(t.media_item_id::text, ', ' order by t.media_item_id)
  into bad_count, sample
  from (
    select t.media_item_id
    from public.tracking t
    join public.media_items m on m.id = t.media_item_id
    where t.status = 'in_progress'::public.tracking_status
      and m.type <> 'book'::public.media_type
    limit 20
  ) t;

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot enforce in_progress-only-for-books: % non-book tracking row(s) already use in_progress (e.g. %). Fix them before applying this migration.',
      bad_count, sample;
  end if;
end $$;

create or replace function public.enforce_tracking_status_for_media_type()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  media_kind public.media_type;
begin
  if new.status is distinct from 'in_progress'::public.tracking_status then
    return new;
  end if;
  select type into media_kind from public.media_items where id = new.media_item_id;
  if media_kind is distinct from 'book'::public.media_type then
    raise exception 'in_progress status is only allowed for books'
      using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.enforce_tracking_status_for_media_type() from public;

create trigger tracking_status_media_type_check
  before insert or update of status, media_item_id on public.tracking
  for each row
  execute function public.enforce_tracking_status_for_media_type();

comment on function public.enforce_tracking_status_for_media_type() is
  'tracking.status=in_progress 仅允许 media_items.type=book；影视／音乐仍为 watched／want_to_watch。';

-- ---------------------------------------------------------------------------
-- 3) 图书去重：规范化标题 + author 角色集合
-- ---------------------------------------------------------------------------
create or replace function public.find_book_by_title_and_authors(
  p_title text,
  p_author_names text[] default '{}',
  p_exclude_id uuid default null
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
        from unnest(coalesce(p_author_names, '{}'::text[])) as n
        where nullif(btrim(n), '') is not null
      ) as author_keys
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
          and mc.role = 'author'::public.person_role
      ) as author_keys
    from public.media_items m
    cross join wanted
    where m.type = 'book'::public.media_type
      and public.normalize_media_title(m.title) = wanted.title_key
      and (p_exclude_id is null or m.id is distinct from p_exclude_id)
  )
  select c.id
  from candidates c
  cross join wanted
  where c.author_keys = wanted.author_keys
  order by c.id
  limit 1;
$$;

revoke all on function public.find_book_by_title_and_authors(text, text[], uuid) from public;
grant execute on function public.find_book_by_title_and_authors(text, text[], uuid)
  to authenticated, service_role;

comment on function public.find_book_by_title_and_authors(text, text[], uuid) is
  '按规范化标题与 author 角色演职员集合查找已有图书；p_exclude_id 排除自身；供导入／保存去重，不持久化 ISBN。';

-- ---------------------------------------------------------------------------
-- 4) 扩展 admin_save_media：图书（页数、出版社、作者、在读状态、去重）
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_media(p_data jsonb) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  item_id uuid := nullif(p_data->>'id', '')::uuid;
  item_type public.media_type := (p_data->>'type')::public.media_type;
  parent_id uuid := nullif(p_data->>'parent_id', '')::uuid;
  item_number integer := (p_data->>'number')::integer;
  old_type public.media_type;
  target text;
  link_table text;
  key_column text;
  field text;
  person_kind public.person_role;
  entry jsonb;
  item_name text;
  item_character text;
  chosen_person uuid;
  related_id uuid;
  position integer;
  related_limit integer;
  rating_value numeric := (p_data->>'rating')::numeric;
  runtime_value numeric := (p_data->>'runtime')::numeric;
  runtime_ok boolean;
  album_label text;
  related_fields text[];
  is_credit_field boolean;
  status_text text := coalesce(p_data->>'status', '');
  page_count_value integer;
  publisher_value text;
  author_names text[] := '{}';
  duplicate_id uuid;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  -- 串行化管理事务，避免删除父条目与新增季集／曲目同时执行。
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if item_type is null
    or item_type not in ('movie','tv_show','tv_season','tv_episode','album','music','book')
    or nullif(btrim(p_data->>'title'), '') is null
    or length(p_data->>'title') > 300 then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;

  if item_type = 'book' then
    if status_text not in ('watched','want_to_watch','in_progress') then
      raise exception 'Invalid media input' using errcode = '22023';
    end if;
  elsif status_text not in ('watched','want_to_watch') then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;

  if rating_value is not null
    and (rating_value < 0 or rating_value > 10 or rating_value <> round(rating_value, 1)) then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;

  -- 曲目时长 1–7200 秒；影视仍为 0–100000（分钟语义由应用层约定）；图书不写 runtime。
  if item_type = 'music' then
    runtime_ok := runtime_value is null
      or (runtime_value >= 1 and runtime_value <= 7200 and runtime_value = trunc(runtime_value));
  elsif item_type = 'book' then
    runtime_ok := runtime_value is null;
  else
    runtime_ok := runtime_value is null
      or (runtime_value >= 0 and runtime_value <= 100000);
  end if;
  if not runtime_ok then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;

  if item_type in ('tv_season','tv_episode','music') then
    if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;
    if item_type = 'tv_season' and not exists(
      select 1 from public.media_items where id = parent_id and type = 'tv_show'::public.media_type
    ) then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if item_type = 'tv_episode' and not exists(
      select 1
      from public.tv_seasons s
      join public.media_items m on m.id = s.id
      where s.id = parent_id and m.type = 'tv_season'::public.media_type
    ) then
      raise exception 'Season not found' using errcode = 'P0002';
    end if;
    if item_type = 'music' and not exists(
      select 1 from public.media_items where id = parent_id and type = 'album'::public.media_type
    ) then
      raise exception 'Album not found' using errcode = 'P0002';
    end if;
  end if;

  if item_type = 'album' then
    album_label := nullif(btrim(coalesce(p_data->>'label', '')), '');
    if album_label is not null and length(album_label) > 200 then
      raise exception 'Invalid label' using errcode = '22023';
    end if;
  end if;

  if item_type = 'book' then
    if p_data ? 'page_count' and nullif(p_data->>'page_count', '') is not null then
      begin
        page_count_value := (p_data->>'page_count')::integer;
      exception when others then
        raise exception 'Invalid page_count' using errcode = '22023';
      end;
      if page_count_value < 1 or page_count_value > 20000 then
        raise exception 'Invalid page_count' using errcode = '22023';
      end if;
    else
      page_count_value := null;
    end if;
    publisher_value := nullif(btrim(coalesce(p_data->>'publisher', '')), '');
    if publisher_value is not null and length(publisher_value) > 200 then
      raise exception 'Invalid publisher' using errcode = '22023';
    end if;
  end if;

  if item_id is null then
    insert into public.media_items(type,title,alternate_title,summary,cover_url,release_date,runtime)
    values(
      item_type,
      btrim(p_data->>'title'),
      nullif(p_data->>'alternate_title',''),
      nullif(p_data->>'summary',''),
      nullif(p_data->>'cover_url',''),
      nullif(p_data->>'release_date','')::date,
      runtime_value
    )
    returning id into item_id;
  else
    select type into old_type from public.media_items where id = item_id for update;
    if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
    if old_type <> item_type then raise exception 'Cannot change media type' using errcode = '22023'; end if;
    update public.media_items set
      title = btrim(p_data->>'title'),
      alternate_title = nullif(p_data->>'alternate_title',''),
      summary = nullif(p_data->>'summary',''),
      cover_url = nullif(p_data->>'cover_url',''),
      release_date = nullif(p_data->>'release_date','')::date,
      runtime = runtime_value
    where id = item_id;
  end if;

  if item_type = 'tv_season' then
    insert into public.tv_seasons(id,series_id,season_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set series_id = excluded.series_id, season_number = excluded.season_number;
  elsif item_type = 'tv_episode' then
    insert into public.tv_episodes(id,season_id,episode_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set season_id = excluded.season_id, episode_number = excluded.episode_number;
  elsif item_type = 'album' then
    insert into public.music_albums(media_item_id, label) values(item_id, album_label)
    on conflict(media_item_id) do update set label = excluded.label;
  elsif item_type = 'music' then
    insert into public.music(media_item_id, album_id, track_number) values(item_id, parent_id, item_number)
    on conflict(media_item_id) do update set album_id = excluded.album_id, track_number = excluded.track_number;
  elsif item_type = 'book' then
    insert into public.books(media_item_id, page_count, publisher) values(item_id, page_count_value, publisher_value)
    on conflict(media_item_id) do update set page_count = excluded.page_count, publisher = excluded.publisher;
  end if;

  if item_type in ('movie','tv_episode','music','book') then
    insert into public.tracking(media_item_id,status,rating)
    values(item_id,status_text::public.tracking_status,rating_value)
    on conflict(media_item_id) do update set status = excluded.status, rating = excluded.rating;
  end if;

  if item_type = 'album' then
    related_fields := array['genres','artists'];
  elsif item_type = 'music' then
    related_fields := array['artists','lyricists','composers'];
  elsif item_type = 'book' then
    related_fields := array['genres','languages','authors'];
  else
    related_fields := array['genres','languages','regions','actors','directors'];
  end if;

  foreach field in array related_fields loop
    is_credit_field := field in ('actors','directors','artists','lyricists','composers','authors');
    related_limit := case when is_credit_field then 300 else 100 end;
    if jsonb_typeof(p_data->field) is distinct from 'array'
      or jsonb_array_length(p_data->field) > related_limit then
      raise exception 'Invalid related names' using errcode = '22023';
    end if;
    case field
      when 'genres' then target := 'genres'; link_table := 'media_genres'; key_column := 'genre_id';
      when 'languages' then target := 'languages'; link_table := 'media_languages'; key_column := 'language_id';
      when 'regions' then target := 'regions'; link_table := 'media_regions'; key_column := 'region_id';
      else target := 'people'; link_table := 'media_credits'; key_column := 'person_id';
    end case;
    if target = 'people' then
      person_kind := case field
        when 'actors' then 'actor'::public.person_role
        when 'directors' then 'director'::public.person_role
        when 'artists' then 'artist'::public.person_role
        when 'lyricists' then 'lyricist'::public.person_role
        when 'authors' then 'author'::public.person_role
        else 'composer'::public.person_role
      end;
      delete from public.media_credits where media_item_id = item_id and role = person_kind;
    else
      execute format('delete from public.%I where media_item_id=$1', link_table) using item_id;
    end if;
    position := 0;
    for entry in select value from jsonb_array_elements(p_data->field) loop
      item_character := null;
      chosen_person := null;
      if jsonb_typeof(entry) = 'string' then
        item_name := btrim(entry #>> '{}');
      elsif target = 'people' and jsonb_typeof(entry) = 'object'
        and jsonb_typeof(entry->'name') = 'string'
        and coalesce(jsonb_typeof(entry->'id'), 'null') in ('string','null')
        and coalesce(jsonb_typeof(entry->'character'), 'null') in ('string','null')
        and (field = 'actors' or entry->'character' is null) then
        if nullif(entry->>'id', '') is not null
          and entry->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception 'Invalid person id' using errcode = '22023';
        end if;
        item_name := btrim(entry->>'name');
        chosen_person := nullif(entry->>'id', '')::uuid;
        item_character := nullif(btrim(entry->>'character'), '');
      else
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if item_name is null or item_name = '' or length(item_name) > 200 or length(item_character) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if target = 'people' then
        if chosen_person is not null then
          select id into related_id from public.people where id = chosen_person;
          if not found then raise exception 'Person not found' using errcode = 'P0002'; end if;
        else
          insert into public.people(name) values(item_name)
          on conflict(name, alternate_name) do update set name = excluded.name
          returning id into related_id;
        end if;
        insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
        values(item_id,related_id,person_kind,position,item_character) on conflict do nothing;
        if field = 'authors' then
          author_names := array_append(author_names, item_name);
        end if;
      else
        execute format(
          'insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',
          target
        ) into related_id using item_name;
        execute format(
          'insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',
          link_table, key_column
        ) using item_id, related_id;
      end if;
      position := position + 1;
    end loop;
  end loop;

  if item_type = 'book' then
    -- 排除刚写入的自身：否则 order by id 可能命中本行，去重失效。
    duplicate_id := public.find_book_by_title_and_authors(
      btrim(p_data->>'title'), author_names, item_id
    );
    if duplicate_id is not null then
      raise exception 'Duplicate book title and authors' using errcode = '23505';
    end if;
  end if;

  return item_id;
end $$;

comment on function public.admin_save_media(jsonb) is
  '站长原子保存媒体及关联；支持 movie／tv_*／album／music／book。图书含页数／出版社／作者去重；in_progress 仅图书。';

-- ---------------------------------------------------------------------------
-- 5) admin_delete_media 接受图书（无下属树，级联删 books／tracking／credits）
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_media(p_id uuid, p_confirm_title text) returns void
language plpgsql security invoker set search_path = ''
as $$
declare current_title text; item_type public.media_type; descendants uuid[];
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select title,type into current_title,item_type from public.media_items where id=p_id for update;
  if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
  if p_confirm_title is distinct from current_title
    or item_type not in ('movie','tv_show','tv_season','tv_episode','book') then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;
  with recursive tree(id) as (
    select p_id
    union
    select edges.child from tree join (
      select series_id as parent,id as child from public.tv_seasons
      union all select season_id,id from public.tv_episodes
    ) edges on edges.parent=tree.id
  ) select array_agg(id) into descendants from tree;
  delete from public.media_items where id = any(descendants);
end $$;

comment on function public.admin_delete_media(uuid, text) is
  '站长按标题确认删除媒体树；现支持 movie／tv_*／book。';

-- ---------------------------------------------------------------------------
-- 6) v_all_media：纳入 book，并附加 authors 列（各分支对齐）
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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director'::public.person_role) as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist'::public.person_role) as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author'::public.person_role) as authors
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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'artist'::public.person_role) as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'author'::public.person_role) as authors
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
  (select array_agg(l.name) from public.media_languages ml join public.languages l on l.id = ml.language_id where ml.media_item_id = album_item.id) as languages,
  (select array_agg(r.name) from public.media_regions mr join public.regions r on r.id = mr.region_id where mr.media_item_id = album_item.id) as regions,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'director'::public.person_role) as directors,
  album_item.alternate_title,
  album_item.release_date as first_air_date,
  album_item.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'artist'::public.person_role) as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = album_item.id and mc.role = 'author'::public.person_role) as authors
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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist'::public.person_role) as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author'::public.person_role) as authors
from public.media_items m
left join public.tracking t on t.media_item_id = m.id
where m.type = 'music'::public.media_type
group by m.id, m.runtime
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
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as casts,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'director'::public.person_role) as directors,
  m.alternate_title,
  m.release_date as first_air_date,
  m.release_date as last_air_date,
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as characters,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'artist'::public.person_role) as artists,
  (select array_agg(p.name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'author'::public.person_role) as authors
from public.media_items m
join public.books b on b.media_item_id = m.id
left join public.tracking t on t.media_item_id = m.id
where m.type = 'book'::public.media_type
group by m.id;

-- ---------------------------------------------------------------------------
-- 7) search_media：无分类时纳入 book，并匹配 author
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
  ), scope as (
    select
      term,
      '%' || term || '%' as pattern,
      series_only,
      all_categories,
      case
        when all_categories then array['movie', 'tv_show', 'album', 'music', 'book']
        else types
      end as searched_types,
      all_categories or series_only as searches_series,
      case
        when all_categories then array['director', 'actor', 'artist', 'author']
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
