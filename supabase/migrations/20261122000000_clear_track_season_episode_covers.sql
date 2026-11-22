-- 清空曲目／季／单集自身封面；保存路径强制这三类 cover_url 为 NULL。
-- 基于 20261121110000（最新 admin_save_media，含 ISBN）只改 cover_url 赋值。
-- 幂等：重复执行安全；先清数据再加 CHECK。

-- ---------------------------------------------------------------------------
-- 1) 清空存量 cover_url（仅 music／tv_season／tv_episode）
-- ---------------------------------------------------------------------------
update public.media_items
set cover_url = null
where type in ('music'::public.media_type, 'tv_season'::public.media_type, 'tv_episode'::public.media_type)
  and cover_url is not null;

-- ---------------------------------------------------------------------------
-- 2) CHECK：这三类 cover_url 必须为 NULL（与 HTTPS CHECK 并存；NULL 仍通过 HTTPS）
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_child_cover_url_null_check'
  ) then
    alter table public.media_items
      add constraint media_items_child_cover_url_null_check
      check (
        type not in (
          'music'::public.media_type,
          'tv_season'::public.media_type,
          'tv_episode'::public.media_type
        )
        or cover_url is null
      );
  end if;
end $$;

comment on constraint media_items_child_cover_url_null_check on public.media_items is
  '曲目／季／单集不存自身封面（展示分别回退专辑／剧集）；cover_url 必须为 NULL。';

-- ---------------------------------------------------------------------------
-- 3) admin_save_media：按 type 强制这三类 cover_url 为 NULL
--    manage_save_media／admin_save_album_with_tracks 经本函数写入，无需另改。
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
  isbn_value text;
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
    isbn_value := nullif(public.normalize_book_isbn(coalesce(p_data->>'isbn', '')), '');
    if isbn_value is not null and isbn_value !~ '^(?:[0-9]{9}[0-9X]|[0-9]{13})$' then
      raise exception 'Invalid isbn' using errcode = '22023';
    end if;
  end if;

  if item_id is null then
    insert into public.media_items(type,title,alternate_title,summary,cover_url,release_date,runtime)
    values(
      item_type,
      btrim(p_data->>'title'),
      nullif(p_data->>'alternate_title',''),
      nullif(p_data->>'summary',''),
      case when item_type in ('music','tv_season','tv_episode') then null else nullif(p_data->>'cover_url','') end,
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
      cover_url = case when item_type in ('music','tv_season','tv_episode') then null else nullif(p_data->>'cover_url','') end,
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
    insert into public.books(media_item_id, page_count, publisher, isbn)
    values(item_id, page_count_value, publisher_value, isbn_value)
    on conflict(media_item_id) do update set
      page_count = excluded.page_count,
      publisher = excluded.publisher,
      isbn = excluded.isbn;
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
      -- 人物字段只接受对象；genres／languages／regions 仍接受纯字符串。
      if target <> 'people' and jsonb_typeof(entry) = 'string' then
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
  '站长原子保存媒体及关联；支持 movie／tv_*／album／music／book。人物字段仅接受对象；genres／languages／regions 仍接受字符串。图书含页数／出版社／ISBN／作者去重；in_progress 仅图书。music／tv_season／tv_episode 的 cover_url 强制为 NULL。';

revoke all on function public.admin_save_media(jsonb) from public, anon;
grant execute on function public.admin_save_media(jsonb) to authenticated;
