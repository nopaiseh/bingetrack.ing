
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE TYPE "public"."album_release_kind" AS ENUM (
    'album',
    'ep',
    'single',
    'compilation'
);

ALTER TYPE "public"."album_release_kind" OWNER TO "postgres";

CREATE TYPE "public"."media_type" AS ENUM (
    'movie',
    'tv_show',
    'tv_season',
    'tv_episode',
    'music',
    'album',
    'book'
);

ALTER TYPE "public"."media_type" OWNER TO "postgres";

CREATE TYPE "public"."ownership_status" AS ENUM (
    'want_to_own',
    'owned'
);

ALTER TYPE "public"."ownership_status" OWNER TO "postgres";

CREATE TYPE "public"."tracking_status" AS ENUM (
    'watched',
    'want_to_watch',
    'in_progress'
);

ALTER TYPE "public"."tracking_status" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_delete_media"("p_id" "uuid", "p_confirm_title" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  current_title text;
  item_type public.media_type;
  descendants uuid[];
  orphan_songs uuid[];
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select title,type into current_title,item_type from public.media_items where id=p_id for update;
  if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
  if p_confirm_title is distinct from current_title
    or item_type not in ('movie','tv_show','tv_season','tv_episode','book','album','music') then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;

  if item_type = 'album' then
    select coalesce(array_agg(at.song_id), '{}'::uuid[]) into orphan_songs
    from public.album_tracks at
    where at.album_id = p_id
      and not exists (
        select 1 from public.album_tracks other
        where other.song_id = at.song_id and other.album_id is distinct from p_id
      );
    delete from public.media_items where id = any(orphan_songs);
    delete from public.media_items where id = p_id;
    return;
  end if;

  if item_type = 'music' then
    delete from public.media_items where id = p_id;
    return;
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

ALTER FUNCTION "public"."admin_delete_media"("p_id" "uuid", "p_confirm_title" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."admin_delete_media"("p_id" "uuid", "p_confirm_title" "text") IS '站长按标题确认删除；删专辑时只删除不再属于任何其他专辑的曲目。';

CREATE OR REPLACE FUNCTION "public"."admin_save_album_with_tracks"("p_album" "jsonb", "p_tracks" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  album_result jsonb;
  saved_album_id uuid;
  track jsonb;
  track_payload jsonb;
  track_parent uuid;
  track_result jsonb;
  tracks_len integer;
  actual_track_count integer;
  affected uuid[] := '{}';
  keep_song_ids uuid[] := '{}';
  unbound_song_ids uuid[] := '{}';
  saved_song_id uuid;
  existing_song uuid;
  disc_no integer;
  track_no integer;
  existing_type public.media_type;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;

  if coalesce(p_album->>'type', '') <> 'album' then
    raise exception 'Invalid album input' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tracks) is distinct from 'array' then
    raise exception 'Invalid tracks' using errcode = '22023';
  end if;
  tracks_len := jsonb_array_length(p_tracks);
  if tracks_len > 1000 then
    raise exception 'Too many tracks' using errcode = '22023';
  end if;

  album_result := public.manage_save_media(p_album);
  saved_album_id := (album_result->>'id')::uuid;
  select coalesce(array_agg(x::uuid), '{}'::uuid[]) into affected
  from jsonb_array_elements_text(album_result->'affected_person_ids') as x;

  for track in select value from jsonb_array_elements(p_tracks) loop
    if jsonb_typeof(track) is distinct from 'object' then
      raise exception 'Invalid track payload' using errcode = '22023';
    end if;
    track_parent := nullif(track->>'parent_id', '')::uuid;
    if track_parent is not null and track_parent is distinct from saved_album_id then
      raise exception 'Track parent must match album' using errcode = '22023';
    end if;

    existing_song := nullif(track->>'id', '')::uuid;
    disc_no := coalesce(nullif(track->>'disc_number', '')::integer, 1);
    track_no := (track->>'number')::integer;
    if track_no is null or track_no < 0 or track_no > 100000
       or disc_no is null or disc_no < 1 or disc_no > 100 then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;

    if existing_song is not null then
      -- 引用已有曲目：只挂 album_tracks，绝不重置 status／credits／元数据
      select type into existing_type from public.media_items where id = existing_song;
      if not found or existing_type is distinct from 'music'::public.media_type then
        raise exception 'Referenced song not found' using errcode = 'P0002';
      end if;
      if not exists (select 1 from public.music where media_item_id = existing_song) then
        raise exception 'Referenced song not found' using errcode = 'P0002';
      end if;
      if exists (
        select 1 from public.album_tracks
        where album_id = saved_album_id
          and disc_number = disc_no
          and track_number = track_no
          and song_id is distinct from existing_song
      ) then
        raise exception 'duplicate key value violates unique constraint'
          using errcode = '23505';
      end if;
      delete from public.album_tracks
      where album_id = saved_album_id and song_id = existing_song;
      insert into public.album_tracks(album_id, song_id, disc_number, track_number)
      values(saved_album_id, existing_song, disc_no, track_no)
      on conflict on constraint album_tracks_pkey do update
        set song_id = excluded.song_id;
      saved_song_id := existing_song;
    else
      -- 新建曲目：经 admin_save_media（含 status／credits）
      track_payload := track
        || jsonb_build_object(
          'type', 'music',
          'parent_id', saved_album_id::text
        );
      if coalesce(track_payload->>'status', '') = '' then
        track_payload := track_payload || jsonb_build_object('status', 'want_to_watch');
      end if;
      if track_payload->'credits' is null then
        track_payload := track_payload || jsonb_build_object('credits', '[]'::jsonb);
      end if;
      track_result := public.admin_save_media(track_payload);
      saved_song_id := (track_result->>'id')::uuid;
      select coalesce(affected || array_agg(x::uuid), affected) into affected
      from jsonb_array_elements_text(track_result->'affected_person_ids') as x;
    end if;
    keep_song_ids := array_append(keep_song_ids, saved_song_id);
  end loop;

  -- 非空曲目列表视为完整清单：解绑未列出曲；仅当曲目不再属于任何专辑时删除本体
  if tracks_len > 0 then
    select coalesce(array_agg(at.song_id), '{}'::uuid[]) into unbound_song_ids
    from public.album_tracks at
    where at.album_id = saved_album_id
      and not (at.song_id = any(keep_song_ids));

    delete from public.album_tracks at
    where at.album_id = saved_album_id
      and not (at.song_id = any(keep_song_ids));

    if cardinality(unbound_song_ids) > 0 then
      delete from public.media_items m
      where m.id = any(unbound_song_ids)
        and m.type = 'music'::public.media_type
        and not exists (
          select 1 from public.album_tracks other where other.song_id = m.id
        );
    end if;
  end if;

  select count(*)::integer into actual_track_count
  from public.album_tracks
  where album_id = saved_album_id;
  update public.music_albums
  set track_count = actual_track_count
  where media_item_id = saved_album_id;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[]) into affected
  from unnest(affected) as x;

  return jsonb_build_object(
    'id', saved_album_id,
    'affected_person_ids', to_jsonb(affected)
  );
end $$;

ALTER FUNCTION "public"."admin_save_album_with_tracks"("p_album" "jsonb", "p_tracks" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."admin_save_album_with_tracks"("p_album" "jsonb", "p_tracks" "jsonb") IS '站长同事务保存专辑与曲目；引用已有 song 只挂链不改 status／credits；非空 p_tracks 为完整清单（解绑未列曲，孤儿曲删除）；回写 track_count。返回 {id,affected_person_ids}。';

CREATE OR REPLACE FUNCTION "public"."admin_save_media"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  item_id uuid := nullif(p_data->>'id', '')::uuid;
  item_type public.media_type := (p_data->>'type')::public.media_type;
  parent_id uuid := nullif(p_data->>'parent_id', '')::uuid;
  previous_parent_id uuid := nullif(p_data->>'previous_parent_id', '')::uuid;
  item_number integer := (p_data->>'number')::integer;
  -- disc_number：显式传入用传入值；未传（null）时编辑保留原盘号，新建默认 1。
  disc_no integer := nullif(p_data->>'disc_number', '')::integer;
  old_type public.media_type;
  target text;
  link_table text;
  key_column text;
  field text;
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
  release_kind_text text;
  release_kind_value public.album_release_kind;
  related_fields text[];
  status_text text := coalesce(p_data->>'status', '');
  page_count_value integer;
  publisher_value text;
  isbn_value text;
  author_names text[] := '{}';
  duplicate_id uuid;
  credit_entry jsonb;
  credit_role text;
  credit_order integer;
  role_row record;
  person_obj jsonb;
  person_alt text;
  affected uuid[] := '{}';
  old_person uuid;
  link_album boolean;
  old_album_ids uuid[] := '{}';
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);

  if item_type is null
    or item_type not in ('movie','tv_show','tv_season','tv_episode','album','music','book')
    or nullif(btrim(p_data->>'title'), '') is null
    or length(p_data->>'title') > 300 then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;

  -- 拒绝旧版角色字段，强制走 credits[]
  if p_data ? 'actors' or p_data ? 'directors' or p_data ? 'artists'
     or p_data ? 'lyricists' or p_data ? 'composers' or p_data ? 'authors' then
    raise exception 'Legacy credit fields are not supported; use credits[]' using errcode = '22023';
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

  if item_type in ('tv_season','tv_episode') then
    if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;
    if item_type = 'tv_season' and not exists(
      select 1 from public.media_items where id = parent_id and type = 'tv_show'::public.media_type
    ) then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if item_type = 'tv_episode' and not exists(
      select 1 from public.tv_seasons s
      join public.media_items m on m.id = s.id
      where s.id = parent_id and m.type = 'tv_season'::public.media_type
    ) then
      raise exception 'Season not found' using errcode = 'P0002';
    end if;
  end if;

  -- 曲目：可独立；若带 parent_id 则写入 album_tracks（须同时给 number）
  link_album := false;
  if item_type = 'music' then
    if parent_id is not null or item_number is not null then
      if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
        raise exception 'Invalid parent or number' using errcode = '22023';
      end if;
      -- 未传 disc_number：优先取 previous_parent（挪专辑）或当前 parent 上原盘号；新建默认 1
      if disc_no is null and item_id is not null then
        select at.disc_number into disc_no
        from public.album_tracks at
        where at.song_id = item_id
          and at.album_id = coalesce(previous_parent_id, parent_id);
      end if;
      disc_no := coalesce(disc_no, 1);
      if disc_no < 1 or disc_no > 100 then
        raise exception 'Invalid disc_number' using errcode = '22023';
      end if;
      if not exists(
        select 1 from public.media_items where id = parent_id and type = 'album'::public.media_type
      ) then
        raise exception 'Album not found' using errcode = 'P0002';
      end if;
      link_album := true;
    end if;
  end if;

  if item_type = 'album' then
    album_label := nullif(btrim(coalesce(p_data->>'label', '')), '');
    if album_label is not null and length(album_label) > 200 then
      raise exception 'Invalid label' using errcode = '22023';
    end if;
    release_kind_text := coalesce(nullif(btrim(p_data->>'release_kind'), ''), 'album');
    begin
      release_kind_value := release_kind_text::public.album_release_kind;
    exception when others then
      raise exception 'Invalid release_kind' using errcode = '22023';
    end;
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
    insert into public.music_albums(media_item_id, label, release_kind)
    values(item_id, album_label, release_kind_value)
    on conflict(media_item_id) do update set label = excluded.label, release_kind = excluded.release_kind;
  elsif item_type = 'music' then
    insert into public.music(media_item_id) values(item_id)
    on conflict(media_item_id) do nothing;
    if link_album then
      -- 表单单父级语义：仅当 previous_parent_id 与新 parent 不同时，删除那一条旧关联；
      -- 其它专辑关联（共用歌）保持不变。仅改标题／评分且 previous=parent 时不删任何关联。
      -- 多专辑挂载请走 admin_save_album_with_tracks 引用已有 song id。
      if previous_parent_id is not null
         and previous_parent_id is distinct from parent_id then
        delete from public.album_tracks
        where song_id = item_id
          and album_id = previous_parent_id;
        old_album_ids := array[previous_parent_id];
      end if;

      delete from public.album_tracks where album_id = parent_id and song_id = item_id;
      -- 曲位已被其它歌占用则拒绝（保留 23505，与旧 music.album_id/track_number 唯一约束一致）
      if exists (
        select 1 from public.album_tracks
        where album_id = parent_id
          and disc_number = disc_no
          and track_number = item_number
          and song_id is distinct from item_id
      ) then
        raise exception 'duplicate key value violates unique constraint'
          using errcode = '23505';
      end if;
      insert into public.album_tracks(album_id, song_id, disc_number, track_number)
      values(parent_id, item_id, disc_no, item_number)
      on conflict on constraint album_tracks_pkey do update
        set song_id = excluded.song_id;
      update public.music_albums a
      set track_count = (select count(*)::integer from public.album_tracks t where t.album_id = a.media_item_id)
      where a.media_item_id = parent_id
         or a.media_item_id = any(old_album_ids);
    end if;
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
    related_fields := array['genres','regions'];
  elsif item_type = 'music' then
    related_fields := array['genres','languages'];
    if jsonb_typeof(p_data->'genres') = 'array'
      and jsonb_array_length(p_data->'genres') > 2 then
      raise exception 'Music tracks allow at most 2 genres' using errcode = '22023';
    end if;
  elsif item_type = 'book' then
    related_fields := array['genres','languages','regions'];
  else
    related_fields := array['genres','languages','regions'];
  end if;

  foreach field in array related_fields loop
    related_limit := 100;
    if jsonb_typeof(p_data->field) is distinct from 'array'
      or jsonb_array_length(p_data->field) > related_limit then
      raise exception 'Invalid related names' using errcode = '22023';
    end if;
    case field
      when 'genres' then target := 'genres'; link_table := 'media_genres'; key_column := 'genre_id';
      when 'languages' then target := 'languages'; link_table := 'media_languages'; key_column := 'language_id';
      else target := 'regions'; link_table := 'media_regions'; key_column := 'region_id';
    end case;
    execute format('delete from public.%I where media_item_id=$1', link_table) using item_id;
    for entry in select value from jsonb_array_elements(p_data->field) loop
      if jsonb_typeof(entry) = 'string' then
        item_name := btrim(entry #>> '{}');
      else
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if item_name is null or item_name = '' or length(item_name) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      execute format(
        'insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',
        target
      ) into related_id using item_name;
      execute format(
        'insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',
        link_table, key_column
      ) using item_id, related_id;
    end loop;
  end loop;

  -- credits[]：每角色最多 300 条（与旧 actors／directors 等分字段上限一致）
  if jsonb_typeof(p_data->'credits') is distinct from 'array' then
    raise exception 'Invalid credits' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'credits') c
    group by nullif(btrim(c->>'role'), '')
    having count(*) > 300
  ) then
    raise exception 'Invalid credits' using errcode = '22023';
  end if;

  for old_person in
    select person_id from public.media_credits where media_item_id = item_id
  loop
    affected := array_append(affected, old_person);
  end loop;

  delete from public.media_credits where media_item_id = item_id;

  for credit_entry in select value from jsonb_array_elements(p_data->'credits') loop
    if jsonb_typeof(credit_entry) is distinct from 'object' then
      raise exception 'Invalid credit entry' using errcode = '22023';
    end if;
    credit_role := nullif(btrim(credit_entry->>'role'), '');
    if credit_role is null then
      raise exception 'Invalid credit role' using errcode = '22023';
    end if;
    select * into role_row from public.credit_roles where code = credit_role;
    if not found then
      raise exception 'Unknown credit role' using errcode = '22023';
    end if;
    if not (item_type = any(role_row.allowed_types)) then
      raise exception 'Credit role not allowed for media type' using errcode = '22023';
    end if;

    item_character := nullif(btrim(credit_entry->>'character'), '');
    if item_character is not null and not role_row.allows_character then
      raise exception 'character not allowed for role' using errcode = '22023';
    end if;
    if length(item_character) > 200 then
      raise exception 'Invalid character' using errcode = '22023';
    end if;

    begin
      credit_order := coalesce((credit_entry->>'order')::integer, 0);
    exception when others then
      raise exception 'Invalid credit order' using errcode = '22023';
    end;
    if credit_order < 0 then
      raise exception 'Invalid credit order' using errcode = '22023';
    end if;

    person_obj := credit_entry->'person';
    if jsonb_typeof(person_obj) is distinct from 'object' then
      raise exception 'Invalid credit person' using errcode = '22023';
    end if;
    chosen_person := null;
    if nullif(person_obj->>'id', '') is not null then
      if person_obj->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid person id' using errcode = '22023';
      end if;
      chosen_person := (person_obj->>'id')::uuid;
      select id into related_id from public.people where id = chosen_person;
      if not found then raise exception 'Person not found' using errcode = 'P0002'; end if;
    else
      item_name := btrim(coalesce(person_obj->>'name', ''));
      person_alt := nullif(btrim(coalesce(person_obj->>'alternate_name', '')), '');
      if item_name is null or item_name = '' or length(item_name) > 200
         or length(person_alt) > 200 then
        raise exception 'Invalid person name' using errcode = '22023';
      end if;
      insert into public.people(name, alternate_name) values(item_name, person_alt)
      on conflict(name, alternate_name) do update set name = excluded.name
      returning id into related_id;
    end if;

    insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
    values(item_id, related_id, credit_role, credit_order, item_character)
    on conflict do nothing;

    affected := array_append(affected, related_id);
    if credit_role = 'author' then
      select name into item_name from public.people where id = related_id;
      author_names := array_append(author_names, item_name);
    end if;
  end loop;

  if item_type = 'book' then
    duplicate_id := public.find_book_by_title_and_authors(
      btrim(p_data->>'title'), author_names, item_id
    );
    if duplicate_id is not null then
      raise exception 'Duplicate book title and authors' using errcode = '23505';
    end if;
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into affected
  from unnest(affected) as x;

  return jsonb_build_object(
    'id', item_id,
    'affected_person_ids', to_jsonb(affected)
  );
end $_$;

ALTER FUNCTION "public"."admin_save_media"("p_data" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."admin_save_media"("p_data" "jsonb") IS '站长原子保存媒体。credits:[{person:{id}|{name,alternate_name},role,character?,order}]；返回 {id,affected_person_ids}。不再接受 actors／directors 等旧字段。music 可无专辑；带 parent_id+number 时写入 album_tracks。';

CREATE OR REPLACE FUNCTION "public"."album_average_rating"("p_album_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select round(avg(t.rating), 1)
  from public.album_tracks at
  join public.tracking t on t.media_item_id = at.song_id
  where at.album_id = p_album_id
    and t.rating is not null;
$$;

ALTER FUNCTION "public"."album_average_rating"("p_album_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."album_average_rating"("p_album_id" "uuid") IS '专辑评分 = 本专辑 album_tracks 下属已评分曲目的实时平均；共享曲目只计入本专辑。';

CREATE OR REPLACE FUNCTION "public"."enforce_tracking_status_for_media_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."enforce_tracking_status_for_media_type"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."enforce_tracking_status_for_media_type"() IS 'tracking.status=in_progress 仅允许 media_items.type=book；影视／音乐仍为 watched／want_to_watch。';

CREATE OR REPLACE FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[] DEFAULT '{}'::"text"[], "p_exclude_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
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
          and mc.role = 'author'
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

ALTER FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[], "p_exclude_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[], "p_exclude_id" "uuid") IS '按规范化标题与 author 角色演职员集合查找已有图书；p_exclude_id 排除自身；供导入／保存去重，不持久化 ISBN。';

CREATE OR REPLACE FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[] DEFAULT '{}'::"text"[]) RETURNS "uuid"
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
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
          and mc.role = 'artist'
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

ALTER FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[]) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[]) IS '按规范化标题与 artist 角色演职员集合查找已有 music／album；供导入去重，不持久化外部 ID。';

CREATE OR REPLACE FUNCTION "public"."get_media_distribution_counts"() RETURNS TABLE("media_type" "text", "release_year" "text", "dimension" "text", "name" "text", "item_count" integer)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_media_distribution_counts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_media_stats"("p_media_type" "text") RETURNS TABLE("total" bigint, "watched" bigint, "watching" bigint, "want" bigint, "upcoming" bigint, "in_progress" bigint)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."get_media_stats"("p_media_type" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_media_stats"("p_media_type" "text") IS '按媒体类型统计 total／watched／watching／want／upcoming／in_progress；图书用 in_progress（在读），影视该列为 0。';

CREATE OR REPLACE FUNCTION "public"."get_person_works"("p_person_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  result jsonb;
begin
  if p_person_id is null or not exists (select 1 from public.people where id = p_person_id) then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;

  with credits as (
    select
      mc.role,
      cr.label as role_label,
      cr.sort_order as role_sort,
      mc.character_name,
      mc.credit_order,
      mi.id as media_id,
      mi.type,
      mi.title,
      mi.alternate_title,
      case
        when mi.type = 'music'::public.media_type then coalesce(
          nullif(mi.cover_url, ''),
          (
            select ai.cover_url
            from public.album_tracks at
            join public.media_items ai on ai.id = at.album_id
            where at.song_id = mi.id
              and ai.cover_url is not null
              and nullif(ai.cover_url, '') is not null
            order by ai.release_date asc nulls last, at.disc_number, at.track_number
            limit 1
          )
        )
        else mi.cover_url
      end as cover_url,
      mi.release_date,
      case
        when mi.type = 'music'::public.media_type then coalesce(
          mi.release_date,
          (
            select min(ai.release_date)
            from public.album_tracks at
            join public.media_items ai on ai.id = at.album_id
            where at.song_id = mi.id
          )
        )
        else mi.release_date
      end as effective_release_date
    from public.media_credits mc
    join public.credit_roles cr on cr.code = mc.role
    join public.media_items mi on mi.id = mc.media_item_id
    where mc.person_id = p_person_id
      and mi.type in (
        'movie'::public.media_type,
        'tv_show'::public.media_type,
        'album'::public.media_type,
        'music'::public.media_type,
        'book'::public.media_type
      )
  ), film_tv as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date,
          'character', character_name
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type in ('movie'::public.media_type, 'tv_show'::public.media_type)
    group by role, role_label, role_sort
  ), albums as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date,
          'release_kind', (
            select a.release_kind::text from public.music_albums a where a.media_item_id = media_id
          )
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type = 'album'::public.media_type
    group by role, role_label, role_sort
  ), songs as (
    -- 每首歌只出现一次（跨角色取 sort_order 最小的角色分组仍按角色列出时，同一首歌可在不同角色下各出现一次；
    -- 需求：music split into albums and songs；each song appearing once → 按 media_id 去重，保留 credit_order／角色优先）
    select distinct on (media_id)
      role, role_label, role_sort, media_id, title, alternate_title, cover_url, effective_release_date, character_name
    from credits
    where type = 'music'::public.media_type
    order by media_id, role_sort, credit_order
  ), songs_by_role as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', 'music',
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from songs
    group by role, role_label, role_sort
  ), books as (
    select role, role_label, role_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', media_id,
          'type', type,
          'title', title,
          'alternate_title', alternate_title,
          'cover_url', cover_url,
          'release_date', effective_release_date
        )
        order by effective_release_date desc nulls last, title, media_id
      ) as items
    from credits
    where type = 'book'::public.media_type
    group by role, role_label, role_sort
  )
  select jsonb_build_object(
    'person_id', p_person_id,
    'film_tv', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
      from film_tv
    ), '[]'::jsonb),
    'music', jsonb_build_object(
      'albums', coalesce((
        select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
        from albums
      ), '[]'::jsonb),
      'songs', coalesce((
        select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
        from songs_by_role
      ), '[]'::jsonb)
    ),
    'books', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'label', role_label, 'items', items) order by role_sort)
      from books
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

ALTER FUNCTION "public"."get_person_works"("p_person_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_person_works"("p_person_id" "uuid") IS '人物作品：影视仅 tv_show／movie；音乐分 albums／songs（歌去重）；图书。按角色分组。';

CREATE OR REPLACE FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text" DEFAULT 'all'::"text", "p_order" "text" DEFAULT 'asc'::"text", "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  with season as (
    select s.id, s.season_number
    from public.tv_seasons as s
    where s.id = p_season_id
      and s.series_id = p_series_id
  ),
  episodes as (
    select
      e.id,
      e.episode_number,
      m.title,
      m.alternate_title,
      m.summary,
      m.cover_url,
      m.release_date,
      m.runtime,
      t.status::text as status,
      t.rating
    from season
    join public.tv_episodes as e on e.season_id = season.id
    join public.media_items as m on m.id = e.id
    left join public.tracking as t on t.media_item_id = e.id
  ),
  filtered as (
    select *
    from episodes
    where p_status = 'all'
       or (p_status = 'watched' and status = 'watched')
       or (p_status = 'unwatched' and status is distinct from 'watched')
  ),
  page_rows as (
    select *
    from filtered
    order by
      case when p_order = 'desc' then episode_number end desc,
      case when p_order <> 'desc' then episode_number end asc,
      id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'season_number', season.season_number,
    'episode_count', (select count(*) from episodes),
    'watched_count', (select count(*) from episodes where status = 'watched'),
    'total_runtime', coalesce((select sum(runtime) from episodes), 0),
    'average_rating', (select avg(rating) from episodes where rating is not null),
    'first_release_date', (select min(release_date) from episodes),
    'last_release_date', (select max(release_date) from episodes),
    'total', (select count(*) from filtered),
    'episodes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'episode_number', episode_number,
          'title', title,
          'alternate_title', alternate_title,
          'summary', summary,
          'cover_url', cover_url,
          'release_date', release_date,
          'runtime', runtime,
          'status', status,
          'rating', rating
        )
        order by
          case when p_order = 'desc' then episode_number end desc,
          case when p_order <> 'desc' then episode_number end asc,
          id
      )
      from page_rows
    ), '[]'::jsonb)
  )
  from season;
$$;

ALTER FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text", "p_order" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_song_detail"("p_song_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  song record;
  cover text;
  result jsonb;
begin
  select
    m.id, m.title, m.alternate_title, m.runtime, m.release_date, m.summary, m.cover_url,
    coalesce(
      m.release_date,
      (
        select min(ai.release_date)
        from public.album_tracks at
        join public.media_items ai on ai.id = at.album_id
        where at.song_id = m.id
      )
    ) as effective_release_date
  into song
  from public.media_items m
  join public.music mu on mu.media_item_id = m.id
  where m.id = p_song_id and m.type = 'music'::public.media_type;

  if not found then
    raise exception 'Song not found' using errcode = 'P0002';
  end if;

  cover := song.cover_url;
  if cover is null then
    select ai.cover_url into cover
    from public.album_tracks at
    join public.media_items ai on ai.id = at.album_id
    where at.song_id = p_song_id
      and ai.cover_url is not null
    order by ai.release_date asc nulls last, at.disc_number, at.track_number
    limit 1;
  end if;

  with credit_rows as (
    select mc.role, mc.credit_order, p.id as person_id, p.name, p.alternate_name
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    where mc.media_item_id = p_song_id
      and mc.role in ('artist','composer','lyricist','arranger','producer','featured')
  ), credits_by_role as (
    select role,
      jsonb_agg(
        jsonb_build_object(
          'id', person_id,
          'name', name,
          'alternate_name', alternate_name
        ) order by credit_order, name
      ) as people
    from credit_rows
    group by role
  ), albums as (
    select
      ai.id, ai.title, ai.cover_url, ai.release_date,
      a.release_kind::text as release_kind,
      at.disc_number, at.track_number
    from public.album_tracks at
    join public.media_items ai on ai.id = at.album_id
    join public.music_albums a on a.media_item_id = at.album_id
    where at.song_id = p_song_id
  ), album_other_tracks_ranked as (
    select
      alb.id as album_id,
      ot.song_id,
      om.title,
      ot.disc_number,
      ot.track_number,
      om.runtime,
      row_number() over (
        partition by alb.id
        order by ot.disc_number, ot.track_number, ot.song_id
      ) as rn
    from albums alb
    join public.album_tracks ot on ot.album_id = alb.id and ot.song_id <> p_song_id
    join public.media_items om on om.id = ot.song_id
  ), album_other_tracks as (
    select
      album_id,
      jsonb_agg(
        jsonb_build_object(
          'id', song_id,
          'title', title,
          'disc_number', disc_number,
          'track_number', track_number,
          'duration_seconds', runtime
        )
        order by disc_number, track_number, song_id
      ) as tracks
    from album_other_tracks_ranked
    where rn <= 20
    group by album_id
  ), related_credit_people as (
    select person_id from credit_rows where role in ('artist', 'composer', 'lyricist')
  ), related_candidates as (
    -- 按歌去重；relations = 与当前曲共享人物时，相关曲上实际出现的 artist／composer／lyricist（固定顺序、去重）
    select
      mi.id,
      mi.title,
      coalesce(
        nullif(mi.cover_url, ''),
        (
          select ai.cover_url
          from public.album_tracks at
          join public.media_items ai on ai.id = at.album_id
          where at.song_id = mi.id
            and ai.cover_url is not null
          order by ai.release_date asc nulls last, at.disc_number, at.track_number
          limit 1
        )
      ) as cover_url,
      coalesce(mi.release_date, (
        select min(ai.release_date) from public.album_tracks at
        join public.media_items ai on ai.id = at.album_id where at.song_id = mi.id
      )) as release_date,
      array_remove(array[
        case when bool_or(mc.role = 'artist') then 'artist' end,
        case when bool_or(mc.role = 'composer') then 'composer' end,
        case when bool_or(mc.role = 'lyricist') then 'lyricist' end
      ], null)::text[] as relations
    from public.media_credits mc
    join public.media_items mi on mi.id = mc.media_item_id
    where mc.person_id in (select person_id from related_credit_people)
      and mc.role in ('artist', 'composer', 'lyricist')
      and mi.type = 'music'::public.media_type
      and mi.id <> p_song_id
      -- 同专辑曲目已在 albums[].other_tracks；共用歌任一共同专辑即排除（在 LIMIT 之前）
      and not exists (
        select 1
        from public.album_tracks cur
        join public.album_tracks oth on oth.album_id = cur.album_id
        where cur.song_id = p_song_id
          and oth.song_id = mi.id
      )
    group by mi.id, mi.title, mi.cover_url, mi.release_date
  ), related_songs as (
    select id, title, cover_url, release_date, relations
    from related_candidates
    order by release_date desc nulls last, id
    limit 12
  )
  select jsonb_build_object(
    'id', song.id,
    'title', song.title,
    'alternate_title', song.alternate_title,
    'duration_seconds', song.runtime,
    'release_date', song.effective_release_date,
    'summary', song.summary,
    'cover_url', cover,
    'genres', coalesce((
      select jsonb_agg(g.name order by g.name)
      from public.media_genres mg join public.genres g on g.id = mg.genre_id
      where mg.media_item_id = p_song_id
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(l.name order by l.name)
      from public.media_languages ml join public.languages l on l.id = ml.language_id
      where ml.media_item_id = p_song_id
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('id', ms.id, 'name', ms.name) order by mis.position nulls last, ms.name)
      from public.media_item_series mis
      join public.media_series ms on ms.id = mis.series_id
      where mis.media_item_id = p_song_id
    ), '[]'::jsonb),
    'credits', coalesce((
      select jsonb_object_agg(role, people) from credits_by_role
    ), '{}'::jsonb),
    'albums', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'cover_url', a.cover_url,
          'release_date', a.release_date,
          'release_kind', a.release_kind,
          'disc_number', a.disc_number,
          'track_number', a.track_number,
          'other_tracks', coalesce(ot.tracks, '[]'::jsonb)
        )
        order by a.release_date desc nulls last, a.title
      )
      from albums a
      left join album_other_tracks ot on ot.album_id = a.id
    ), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'cover_url', cover_url,
          'release_date', release_date,
          'relations', to_jsonb(relations)
        )
        order by release_date desc nulls last, id
      )
      from related_songs
    ), '[]'::jsonb),
    'tracking', (
      select jsonb_build_object('status', t.status, 'rating', t.rating)
      from public.tracking t where t.media_item_id = p_song_id
    )
  ) into result;

  return result;
end $$;

ALTER FUNCTION "public"."get_song_detail"("p_song_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_song_detail"("p_song_id" "uuid") IS '歌曲详情：元数据、按角色 credits、所属专辑与同专其他曲（每专最多 20）、相关歌曲扁平数组（排除同专辑／共用专辑歌后艺人／词曲合并去重最多 12，含 relations text[]）、封面回退专辑、tracking（受 RLS）。';

CREATE OR REPLACE FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer DEFAULT 10) RETURNS TABLE("series_id" "uuid", "year_rating" numeric)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select
    seasons.series_id,
    avg(episode_tracking.rating)::numeric as year_rating
  from public.tv_episodes as episodes
  inner join public.tv_seasons as seasons
    on seasons.id = episodes.season_id
  inner join public.media_items as episode_media
    on episode_media.id = episodes.id
  left join public.tracking as episode_tracking
    on episode_tracking.media_item_id = episodes.id
  where episode_media.release_date >= make_date(p_year, 1, 1)
    and episode_media.release_date < make_date(p_year + 1, 1, 1)
  group by seasons.series_id
  order by year_rating desc nulls last, seasons.series_id
  limit greatest(1, least(coalesce(p_limit, 10), 20));
$$;

ALTER FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_site_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$ select exists(select 1 from public.site_owner where user_id = (select auth.uid())); $$;

ALTER FUNCTION "public"."is_site_owner"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_delete_unused"("p_kind" "text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  removed integer := 0;
  batch integer;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if p_kind = 'people' then
    delete from public.people p
    where not exists (select 1 from public.media_credits mc where mc.person_id = p.id);
    get diagnostics removed = row_count;
  elsif p_kind = 'references' then
    delete from public.genres g where not exists (select 1 from public.media_genres x where x.genre_id = g.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.regions r where not exists (select 1 from public.media_regions x where x.region_id = r.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.languages l where not exists (select 1 from public.media_languages x where x.language_id = l.id);
    get diagnostics batch = row_count; removed := removed + batch;
    delete from public.media_series s where not exists (select 1 from public.media_item_series x where x.series_id = s.id);
    get diagnostics batch = row_count; removed := removed + batch;
  else
    raise exception 'Invalid report kind' using errcode = '22023';
  end if;
  return removed;
end $$;

ALTER FUNCTION "public"."manage_delete_unused"("p_kind" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_merge_people"("p_keep" "uuid", "p_remove" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  moved integer := 0;
  keep_alias text;
  inherited_alias text;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  if p_keep is null or coalesce(cardinality(p_remove), 0) = 0 or p_keep = any(p_remove) then
    raise exception 'Choose one person to keep and at least one other person' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select alternate_name into keep_alias from public.people where id = p_keep for update;
  if not found then raise exception 'Person to keep not found' using errcode = 'P0002'; end if;
  if (select count(*) from public.people where id = any(p_remove)) <> cardinality(array(select distinct unnest(p_remove))) then
    raise exception 'Person to merge not found' using errcode = 'P0002';
  end if;
  select alternate_name into inherited_alias from public.people
    where id = any(p_remove) and coalesce(btrim(alternate_name), '') <> '' order by name, id limit 1;

  insert into public.media_credits (media_item_id, person_id, role, credit_order, character_name)
    select distinct on (media_item_id, role) media_item_id, p_keep, role, credit_order, character_name
    from public.media_credits where person_id = any(p_remove)
    order by media_item_id, role, credit_order, character_name nulls last
  on conflict (media_item_id, person_id, role) do update
    set character_name = coalesce(public.media_credits.character_name, excluded.character_name),
        credit_order = least(public.media_credits.credit_order, excluded.credit_order);
  get diagnostics moved = row_count;
  delete from public.media_credits where person_id = any(p_remove);
  delete from public.people where id = any(p_remove);
  if coalesce(btrim(keep_alias), '') = '' and inherited_alias is not null then
    update public.people set alternate_name = inherited_alias where id = p_keep;
  end if;
  return moved;
end $$;

ALTER FUNCTION "public"."manage_merge_people"("p_keep" "uuid", "p_remove" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_name_issue_credit_item_id"("p_media" "uuid", "p_person" "uuid", "p_character" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select 'credit:' || p_media::text || ':' || p_person::text || ':' || encode(convert_to(p_character, 'UTF8'), 'hex');
$$;

ALTER FUNCTION "public"."manage_name_issue_credit_item_id"("p_media" "uuid", "p_person" "uuid", "p_character" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_name_issue_people_item_id"("p_person" "uuid") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select 'people:' || p_person::text;
$$;

ALTER FUNCTION "public"."manage_name_issue_people_item_id"("p_person" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_name_issues"("p_name" "text", "p_character" boolean) RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $_$
  select array_remove(array[
    case when n ~ '^\s|\s$' then 'edge_space' end,
    case when n ~ '\s{2,}' then 'double_space' end,
    case when p_name ~ '[​-‏⁠﻿­]|[[:cntrl:]]' then 'invisible_char' end,
    case when p_name ~ '[０-９Ａ-Ｚａ-ｚ　]' then 'fullwidth' end,
    -- U+3000 已由 fullwidth 覆盖，此处不含，避免双重标记。
    case when p_name ~ U&'[\00A0\1680\2000-\200A\202F\205F]' then 'special_space' end,
    case when not p_character and p_name ~ '[()（）\[\]【】]' then 'bracket_note' end,
    case when lower(btrim(p_name)) ~ '^([?？_.。*\-—]+|n/?a|tbd|tba|unknown|none|null|未知|待定|不详|无|暂无)$' then 'placeholder' end,
    case when p_name ~ '^\s*[,，、;；:：/／|｜·.。\-—]|[,，、;；:：/／|｜·\-—]\s*$' then 'edge_punct' end,
    -- 多个角色统一写作「A / B」；特殊空格先换成普通空格；字母/字母（如 UDT/SEAL）先去掉斜杠再判断。
    case when p_character and regexp_replace(n, '([A-Za-z])/([A-Za-z])', '\1\2', 'g') ~ '[^ ]/|/[^ ]|[／、|｜;；]' then 'separator' end,
    -- 仅当某段含拉丁字母且不是「单个大写字母（可带点）用连字符连接」的缩写时，才标中英文混写。
    case when not p_character and p_name ~ '[一-鿿]' and exists (
      select 1
      from regexp_split_to_table(p_name, '[·・•‧]') as seg
      where seg ~ '[A-Za-z]'
        and seg !~ '^[A-Z]\.?(-[A-Z]\.?)*$'
    ) then 'mixed_script' end,
    case when not p_character and p_name ~ '[0-9０-９]' then 'digits' end,
    case when length(p_name) > case when p_character then 100 else 40 end then 'too_long' end
  ], null)
  from (
    select regexp_replace(p_name, U&'[\00A0\1680\2000-\200A\202F\205F\3000]', ' ', 'g') as n
  ) as normalized
$_$;

ALTER FUNCTION "public"."manage_name_issues"("p_name" "text", "p_character" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_name_key"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$ select lower(regexp_replace(normalize(p_name, nfkc), '[[:space:][:punct:]·・．]+', '', 'g')) $$;

ALTER FUNCTION "public"."manage_name_key"("p_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manage_save_media"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  result jsonb;
  item_id uuid;
  item_name text;
  collection_id uuid;
  collection_ids uuid[] := '{}';
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  if jsonb_typeof(p_data->'collections') is distinct from 'array' or jsonb_array_length(p_data->'collections') > 100 then
    raise exception 'Invalid collection names' using errcode = '22023';
  end if;
  result := public.admin_save_media(p_data);
  item_id := (result->>'id')::uuid;
  for item_name in select btrim(value) from jsonb_array_elements_text(p_data->'collections') loop
    if item_name is null or item_name = '' or length(item_name) > 200 then
      raise exception 'Invalid collection name' using errcode = '22023';
    end if;
    insert into public.media_series(name) values(item_name)
      on conflict(name) do update set name=excluded.name returning id into collection_id;
    collection_ids := array_append(collection_ids, collection_id);
    insert into public.media_item_series(media_item_id,series_id,position)
      select item_id,collection_id,coalesce(max(position),0)+1 from public.media_item_series where series_id=collection_id
      on conflict(media_item_id,series_id) do nothing;
  end loop;
  delete from public.media_item_series where media_item_id=item_id and not (series_id=any(collection_ids));
  return result;
end $$;

ALTER FUNCTION "public"."manage_save_media"("p_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."media_credits_enforce_allowed_types"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."media_credits_enforce_allowed_types"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."media_credits_enforce_allowed_types"() IS 'media_credits.role 必须属于 credit_roles.allowed_types 对应该媒体类型；media_item_id 变更时亦校验。';

CREATE OR REPLACE FUNCTION "public"."media_credits_enforce_character"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."media_credits_enforce_character"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."media_credits_enforce_character"() IS '仅 allows_character=true 的角色可写 character_name；替代旧的 actor-only check。';

CREATE OR REPLACE FUNCTION "public"."name_issue_confirmations_sync_keys"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  media_text text;
  person_text text;
  character_hex text;
begin
  if new.item_id ~* '^people:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.person_id := substr(new.item_id, 8)::uuid;
    new.media_item_id := null;
    new.character_name := null;
    new.item_id := public.manage_name_issue_people_item_id(new.person_id);
    return new;
  end if;

  if new.item_id ~* '^credit:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]+$' then
    media_text := split_part(new.item_id, ':', 2);
    person_text := split_part(new.item_id, ':', 3);
    character_hex := split_part(new.item_id, ':', 4);
    new.media_item_id := media_text::uuid;
    new.person_id := person_text::uuid;
    new.character_name := convert_from(decode(character_hex, 'hex'), 'UTF8');
    new.item_id := public.manage_name_issue_credit_item_id(new.media_item_id, new.person_id, new.character_name);
    return new;
  end if;

  raise exception 'invalid name_issue_confirmations.item_id' using errcode = '22023';
end;
$_$;

ALTER FUNCTION "public"."name_issue_confirmations_sync_keys"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."normalize_book_isbn"("p_raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select upper(regexp_replace(btrim(coalesce(p_raw, '')), '[\s-]+', '', 'g'));
$$;

ALTER FUNCTION "public"."normalize_book_isbn"("p_raw" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."normalize_book_isbn"("p_raw" "text") IS '图书 ISBN 规范化：去首尾空白、去掉空格与连字符、x 转大写；不校验校验位。';

CREATE OR REPLACE FUNCTION "public"."normalize_media_title"("p_title" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select lower(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'));
$$;

ALTER FUNCTION "public"."normalize_media_title"("p_title" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."normalize_media_title"("p_title" "text") IS '去首尾空白、折叠内部空白并小写，供音乐／专辑去重与导入比对。';

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    begin
      execute format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
      raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
    exception when others then
      raise warning 'rls_auto_enable: failed to enable RLS on %: %', cmd.object_identity, sqlerrm;
    end;
  end loop;
end;
$$;

ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_all_media" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"public"."media_type" AS "type",
    NULL::"text" AS "title",
    NULL::"text" AS "summary",
    NULL::"text" AS "cover_url",
    NULL::"date" AS "sort_date",
    NULL::"text" AS "release_year",
    NULL::numeric AS "rating",
    NULL::integer AS "runtime",
    NULL::"text" AS "status",
    NULL::"text"[] AS "genres",
    NULL::"text"[] AS "languages",
    NULL::"text"[] AS "regions",
    NULL::"text"[] AS "casts",
    NULL::"text"[] AS "directors",
    NULL::"text" AS "alternate_title",
    NULL::"date" AS "first_air_date",
    NULL::"date" AS "last_air_date",
    NULL::"text"[] AS "characters",
    NULL::"text"[] AS "artists",
    NULL::"text"[] AS "authors";

ALTER VIEW "public"."v_all_media" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."search_media"("p_query" "text" DEFAULT NULL::"text", "p_types" "text"[] DEFAULT '{}'::"text"[], "p_series_only" boolean DEFAULT false, "p_credit_roles" "text"[] DEFAULT '{}'::"text"[]) RETURNS SETOF "public"."v_all_media"
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
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

ALTER FUNCTION "public"."search_media"("p_query" "text", "p_types" "text"[], "p_series_only" boolean, "p_credit_roles" "text"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."album_tracks" (
    "album_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "disc_number" integer DEFAULT 1 NOT NULL,
    "track_number" integer NOT NULL,
    CONSTRAINT "album_tracks_disc_number_positive_check" CHECK (("disc_number" >= 1)),
    CONSTRAINT "album_tracks_track_number_nonnegative_check" CHECK (("track_number" >= 0))
);

ALTER TABLE "public"."album_tracks" OWNER TO "postgres";

COMMENT ON TABLE "public"."album_tracks" IS '专辑曲目关联：同一首歌可出现在多张专辑；盘号＋曲序在专辑内唯一。';

CREATE TABLE IF NOT EXISTS "public"."books" (
    "media_item_id" "uuid" NOT NULL,
    "page_count" integer,
    "publisher" "text",
    "isbn" "text",
    CONSTRAINT "books_isbn_format_check" CHECK ((("isbn" IS NULL) OR ("isbn" ~ '^(?:[0-9]{9}[0-9X]|[0-9]{13})$'::"text"))),
    CONSTRAINT "books_page_count_range_check" CHECK ((("page_count" IS NULL) OR (("page_count" >= 1) AND ("page_count" <= 20000)))),
    CONSTRAINT "books_publisher_length_check" CHECK ((("publisher" IS NULL) OR (("length"("publisher") >= 1) AND ("length"("publisher") <= 200))))
);

ALTER TABLE "public"."books" OWNER TO "postgres";

COMMENT ON TABLE "public"."books" IS '图书扩展表：页数、出版社与 ISBN；原作名用 media_items.alternate_title，出版日用 media_items.release_date。';

COMMENT ON COLUMN "public"."books"."page_count" IS '页数；空或 1–20000。';

COMMENT ON COLUMN "public"."books"."publisher" IS '出版社；空或 1–200 字。';

COMMENT ON COLUMN "public"."books"."isbn" IS '规范化 ISBN：10 位（末位可为 X）或 13 位数字；可空。保存时去掉空格／连字符并大写 x。';

COMMENT ON CONSTRAINT "books_isbn_format_check" ON "public"."books" IS 'ISBN 须为规范化后的 10 位（末位可 X）或 13 位数字；与 lib/books/resolve-cover normalizeIsbn 一致。';

CREATE TABLE IF NOT EXISTS "public"."credit_roles" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "allowed_types" "public"."media_type"[] NOT NULL,
    "allows_character" boolean DEFAULT false NOT NULL,
    CONSTRAINT "credit_roles_allowed_types_nonempty_check" CHECK (("cardinality"("allowed_types") > 0)),
    CONSTRAINT "credit_roles_label_length_check" CHECK ((("length"("label") >= 1) AND ("length"("label") <= 100))),
    CONSTRAINT "credit_roles_sort_order_nonnegative_check" CHECK (("sort_order" >= 0))
);

ALTER TABLE "public"."credit_roles" OWNER TO "postgres";

COMMENT ON TABLE "public"."credit_roles" IS '演职角色字典（person_role 枚举已移除）。media_credits.role → credit_roles.code。';

COMMENT ON COLUMN "public"."credit_roles"."allowed_types" IS '该角色允许挂载的 media_items.type。由 media_credits_enforce_allowed_types 触发器强制；保存 RPC 亦预检。';

COMMENT ON COLUMN "public"."credit_roles"."allows_character" IS '为 true 时可写 media_credits.character_name（当前 actor／voice_actor）。';

CREATE TABLE IF NOT EXISTS "public"."genres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."genres" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."languages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."languages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_credits" (
    "media_item_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "credit_order" integer DEFAULT 0,
    "character_name" "text",
    CONSTRAINT "media_credits_character_name_length_check" CHECK ((("character_name" IS NULL) OR (("length"("character_name") >= 1) AND ("length"("character_name") <= 200)))),
    CONSTRAINT "media_credits_order_nonnegative_check" CHECK ((("credit_order" IS NULL) OR ("credit_order" >= 0)))
);

ALTER TABLE "public"."media_credits" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_genres" (
    "media_item_id" "uuid" NOT NULL,
    "genre_id" "uuid" NOT NULL
);

ALTER TABLE "public"."media_genres" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_item_series" (
    "media_item_id" "uuid" NOT NULL,
    "series_id" "uuid" NOT NULL,
    "position" integer,
    CONSTRAINT "media_item_series_position_check" CHECK ((("position" IS NULL) OR ("position" >= 0)))
);

ALTER TABLE "public"."media_item_series" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."media_type" NOT NULL,
    "title" "text" NOT NULL,
    "alternate_title" "text",
    "summary" "text",
    "cover_url" "text",
    "release_date" "date",
    "runtime" numeric,
    CONSTRAINT "media_items_alternate_title_length_check" CHECK ((("alternate_title" IS NULL) OR ("length"("alternate_title") <= 300))),
    CONSTRAINT "media_items_child_cover_url_null_check" CHECK ((("type" <> ALL (ARRAY['music'::"public"."media_type", 'tv_season'::"public"."media_type", 'tv_episode'::"public"."media_type"])) OR ("cover_url" IS NULL))),
    CONSTRAINT "media_items_cover_url_https_check" CHECK ((("cover_url" IS NULL) OR ("cover_url" ~* '^https://'::"text"))),
    CONSTRAINT "media_items_music_runtime_seconds_check" CHECK ((("type" <> 'music'::"public"."media_type") OR ("runtime" IS NULL) OR (("runtime" >= (1)::numeric) AND ("runtime" <= (7200)::numeric)))),
    CONSTRAINT "media_items_runtime_nonnegative_check" CHECK ((("runtime" IS NULL) OR ("runtime" >= (0)::numeric))),
    CONSTRAINT "media_items_summary_length_check" CHECK ((("summary" IS NULL) OR ("length"("summary") <= 20000)))
);

ALTER TABLE "public"."media_items" OWNER TO "postgres";

COMMENT ON CONSTRAINT "media_items_alternate_title_length_check" ON "public"."media_items" IS '别名／副标题最多 300 字；与 parseMediaForm string() 默认上限一致。';

COMMENT ON CONSTRAINT "media_items_child_cover_url_null_check" ON "public"."media_items" IS '曲目／季／单集不存自身封面（展示分别回退专辑／剧集）；cover_url 必须为 NULL。';

COMMENT ON CONSTRAINT "media_items_cover_url_https_check" ON "public"."media_items" IS '封面须为 HTTPS 地址或空（大小写不敏感）；与 new URL() 规范化后的 protocol === https: 一致。';

COMMENT ON CONSTRAINT "media_items_music_runtime_seconds_check" ON "public"."media_items" IS '曲目时长以秒计，允许空或 1–7200；电影／单集仍走 media_items_runtime_nonnegative_check 与表单上限。';

COMMENT ON CONSTRAINT "media_items_summary_length_check" ON "public"."media_items" IS '简介最多 20000 字；与 parseMediaForm string("summary", 20000) 一致。';

CREATE TABLE IF NOT EXISTS "public"."media_languages" (
    "media_item_id" "uuid" NOT NULL,
    "language_id" "uuid" NOT NULL
);

ALTER TABLE "public"."media_languages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_regions" (
    "media_item_id" "uuid" NOT NULL,
    "region_id" "uuid" NOT NULL
);

ALTER TABLE "public"."media_regions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."media_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "alternate_name" "text",
    CONSTRAINT "media_series_alternate_name_length_check" CHECK ((("alternate_name" IS NULL) OR ("length"("alternate_name") <= 300)))
);

ALTER TABLE "public"."media_series" OWNER TO "postgres";

COMMENT ON CONSTRAINT "media_series_alternate_name_length_check" ON "public"."media_series" IS '系列别名最多 300 字；与 saveReference 校验一致。';

CREATE TABLE IF NOT EXISTS "public"."music" (
    "media_item_id" "uuid" NOT NULL
);

ALTER TABLE "public"."music" OWNER TO "postgres";

COMMENT ON TABLE "public"."music" IS '曲目扩展表；所属专辑与曲序见 album_tracks。允许无专辑的独立单曲。';

CREATE TABLE IF NOT EXISTS "public"."music_albums" (
    "media_item_id" "uuid" NOT NULL,
    "track_count" integer,
    "label" "text",
    "release_kind" "public"."album_release_kind" DEFAULT 'album'::"public"."album_release_kind" NOT NULL,
    CONSTRAINT "music_albums_label_length_check" CHECK ((("label" IS NULL) OR (("length"("label") >= 1) AND ("length"("label") <= 200)))),
    CONSTRAINT "music_albums_track_count_nonnegative_check" CHECK ((("track_count" IS NULL) OR ("track_count" >= 0)))
);

ALTER TABLE "public"."music_albums" OWNER TO "postgres";

COMMENT ON COLUMN "public"."music_albums"."track_count" IS '专辑曲目数（导入／编辑写入，非实时聚合）。';

COMMENT ON COLUMN "public"."music_albums"."label" IS '唱片公司。';

COMMENT ON COLUMN "public"."music_albums"."release_kind" IS '发行形态：album／ep／single／compilation；默认 album。';

CREATE TABLE IF NOT EXISTS "public"."name_issue_confirmations" (
    "item_id" "text" NOT NULL,
    "confirmed_name" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "media_item_id" "uuid",
    "character_name" "text",
    CONSTRAINT "name_issue_confirmations_shape_check" CHECK (((("media_item_id" IS NULL) AND ("character_name" IS NULL)) OR (("media_item_id" IS NOT NULL) AND ("character_name" IS NOT NULL))))
);

ALTER TABLE "public"."name_issue_confirmations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ownership" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "status" "public"."ownership_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ownership" OWNER TO "postgres";

COMMENT ON TABLE "public"."ownership" IS '实体拥有意向／状态，与 tracking（听过／想听等）独立；可复用于图书等类型。';

CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "alternate_name" "text",
    CONSTRAINT "people_alternate_name_length_check" CHECK ((("alternate_name" IS NULL) OR ("length"("alternate_name") <= 300)))
);

ALTER TABLE "public"."people" OWNER TO "postgres";

COMMENT ON CONSTRAINT "people_alternate_name_length_check" ON "public"."people" IS '人物别名最多 300 字；与 saveReference 校验一致。';

CREATE TABLE IF NOT EXISTS "public"."people_distinct_pairs" (
    "person_a" "uuid" NOT NULL,
    "person_b" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "people_distinct_pairs_order_check" CHECK (("person_a" < "person_b"))
);

ALTER TABLE "public"."people_distinct_pairs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."regions" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."release_year_stats" AS
SELECT
    NULL::"text" AS "release_year",
    NULL::numeric AS "total_runtime",
    NULL::numeric AS "total_watched_runtime",
    NULL::numeric AS "total_unwatched_runtime",
    NULL::bigint AS "total_movies",
    NULL::bigint AS "watched_movies",
    NULL::bigint AS "unwatched_movies",
    NULL::numeric AS "total_movies_runtime",
    NULL::numeric AS "movies_watched_runtime",
    NULL::numeric AS "movies_unwatched_runtime",
    NULL::numeric AS "movie_avg_rating",
    NULL::bigint AS "total_series",
    NULL::bigint AS "watched_series",
    NULL::bigint AS "watching_series",
    NULL::bigint AS "unwatched_series",
    NULL::numeric AS "total_series_runtime",
    NULL::numeric AS "series_watched_runtime",
    NULL::numeric AS "series_unwatched_runtime",
    NULL::numeric AS "series_avg_rating",
    NULL::numeric AS "total_seasons",
    NULL::numeric AS "watched_seasons",
    NULL::numeric AS "watching_seasons",
    NULL::numeric AS "unwatched_seasons",
    NULL::numeric AS "total_series_episodes",
    NULL::numeric AS "watched_series_episodes",
    NULL::numeric AS "unwatched_episodes",
    NULL::bigint AS "total_albums",
    NULL::bigint AS "listened_albums",
    NULL::bigint AS "total_books",
    NULL::bigint AS "read_books",
    NULL::bigint AS "reading_books",
    NULL::bigint AS "want_albums",
    NULL::bigint AS "want_books",
    NULL::bigint AS "total_tracks",
    NULL::bigint AS "listened_tracks",
    NULL::bigint AS "want_tracks",
    NULL::numeric AS "album_avg_rating",
    NULL::numeric AS "book_avg_rating";

ALTER VIEW "public"."release_year_stats" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."site_owner" (
    "singleton" boolean DEFAULT true NOT NULL,
    "user_id" "uuid" NOT NULL,
    CONSTRAINT "site_owner_singleton_check" CHECK ("singleton")
);

ALTER TABLE "public"."site_owner" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_item_id" "uuid" NOT NULL,
    "status" "public"."tracking_status" NOT NULL,
    "rating" numeric(2,1),
    CONSTRAINT "tracking_rating_range_check" CHECK ((("rating" IS NULL) OR (("rating" >= (0)::numeric) AND ("rating" <= (10)::numeric))))
);

ALTER TABLE "public"."tracking" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tv_episodes" (
    "id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "episode_number" integer NOT NULL,
    CONSTRAINT "tv_episodes_number_nonnegative_check" CHECK (("episode_number" >= 0))
);

ALTER TABLE "public"."tv_episodes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tv_seasons" (
    "id" "uuid" NOT NULL,
    "series_id" "uuid" NOT NULL,
    "season_number" integer NOT NULL,
    CONSTRAINT "tv_seasons_number_nonnegative_check" CHECK (("season_number" >= 0))
);

ALTER TABLE "public"."tv_seasons" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_continue_listening" WITH ("security_invoker"='true') AS
 SELECT "album"."media_item_id" AS "album_id",
    "item"."title",
    "item"."cover_url",
    "item"."release_date",
    ("count"("at"."song_id"))::integer AS "track_total",
    ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")))::integer AS "track_watched",
    "max"("item_track"."release_date") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) AS "latest_watched_track_release_date"
   FROM (((("public"."music_albums" "album"
     JOIN "public"."media_items" "item" ON (("item"."id" = "album"."media_item_id")))
     JOIN "public"."album_tracks" "at" ON (("at"."album_id" = "album"."media_item_id")))
     JOIN "public"."media_items" "item_track" ON (("item_track"."id" = "at"."song_id")))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "at"."song_id")))
  GROUP BY "album"."media_item_id", "item"."title", "item"."cover_url", "item"."release_date"
 HAVING (("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) > 0) AND ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) < "count"("at"."song_id")));

ALTER VIEW "public"."v_continue_listening" OWNER TO "postgres";

COMMENT ON VIEW "public"."v_continue_listening" IS '在听专辑：至少一首曲目 watched，但未全部 watched。共享曲目的收听状态对包含它的每张专辑生效。';

CREATE OR REPLACE VIEW "public"."v_manage_media_order" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."type",
    "m"."title",
    COALESCE("s"."series_id", "e"."season_id") AS "parent_id",
    COALESCE("s"."season_number", "e"."episode_number") AS "item_number",
        CASE "m"."type"
            WHEN 'tv_show'::"public"."media_type" THEN ( SELECT COALESCE("max"("em"."release_date") FILTER (WHERE ("em"."release_date" <= CURRENT_DATE)), "min"("em"."release_date")) AS "coalesce"
               FROM (("public"."tv_seasons" "ss"
                 JOIN "public"."tv_episodes" "ee" ON (("ee"."season_id" = "ss"."id")))
                 JOIN "public"."media_items" "em" ON (("em"."id" = "ee"."id")))
              WHERE ("ss"."series_id" = "m"."id"))
            WHEN 'tv_season'::"public"."media_type" THEN ( SELECT COALESCE("max"("em"."release_date") FILTER (WHERE ("em"."release_date" <= CURRENT_DATE)), "min"("em"."release_date")) AS "coalesce"
               FROM ("public"."tv_episodes" "ee"
                 JOIN "public"."media_items" "em" ON (("em"."id" = "ee"."id")))
              WHERE ("ee"."season_id" = "m"."id"))
            ELSE "m"."release_date"
        END AS "sort_date",
    "m"."alternate_title",
        CASE "m"."type"
            WHEN 'tv_show'::"public"."media_type" THEN ( SELECT
                    CASE
                        WHEN (("count"("ee"."id") > 0) AND ("count"("t"."media_item_id") = "count"("ee"."id")) AND "bool_and"(("t"."status" = 'watched'::"public"."tracking_status"))) THEN 'watched'::"text"
                        WHEN (("count"("ee"."id") > 0) AND ("count"("t"."media_item_id") = "count"("ee"."id")) AND "bool_and"(("t"."status" = 'want_to_watch'::"public"."tracking_status"))) THEN 'want_to_watch'::"text"
                        WHEN ("count"("t"."media_item_id") > 0) THEN 'watching'::"text"
                        ELSE 'want_to_watch'::"text"
                    END AS "case"
               FROM (("public"."tv_seasons" "ss"
                 JOIN "public"."tv_episodes" "ee" ON (("ee"."season_id" = "ss"."id")))
                 LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "ee"."id")))
              WHERE ("ss"."series_id" = "m"."id"))
            WHEN 'tv_season'::"public"."media_type" THEN ( SELECT
                    CASE
                        WHEN (("count"("ee"."id") > 0) AND ("count"("ee"."id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) = "count"("ee"."id"))) THEN 'watched'::"text"
                        WHEN ("count"("ee"."id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) > 0) THEN 'watching'::"text"
                        ELSE 'want_to_watch'::"text"
                    END AS "case"
               FROM ("public"."tv_episodes" "ee"
                 LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "ee"."id")))
              WHERE ("ee"."season_id" = "m"."id"))
            ELSE COALESCE(("tm"."status")::"text", 'want_to_watch'::"text")
        END AS "status",
        CASE "m"."type"
            WHEN 'tv_show'::"public"."media_type" THEN ( SELECT "round"("avg"("t"."rating"), 1) AS "round"
               FROM (("public"."tv_seasons" "ss"
                 JOIN "public"."tv_episodes" "ee" ON (("ee"."season_id" = "ss"."id")))
                 JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "ee"."id")))
              WHERE ("ss"."series_id" = "m"."id"))
            WHEN 'tv_season'::"public"."media_type" THEN NULL::numeric
            ELSE "tm"."rating"
        END AS "rating"
   FROM ((("public"."media_items" "m"
     LEFT JOIN "public"."tv_seasons" "s" ON (("s"."id" = "m"."id")))
     LEFT JOIN "public"."tv_episodes" "e" ON (("e"."id" = "m"."id")))
     LEFT JOIN "public"."tracking" "tm" ON (("tm"."media_item_id" = "m"."id")));

ALTER VIEW "public"."v_manage_media_order" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_media_season_summaries" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."series_id",
    "s"."season_number",
    "sm"."title",
    "sm"."alternate_title",
    "sm"."summary",
    "sm"."cover_url",
    ("count"("e"."id"))::integer AS "episode_count",
    ("count"("e"."id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")))::integer AS "watched_episode_count",
    (EXTRACT(year FROM "min"("em"."release_date")))::integer AS "first_year",
    (EXTRACT(year FROM "max"("em"."release_date")))::integer AS "last_year"
   FROM (((("public"."tv_seasons" "s"
     LEFT JOIN "public"."media_items" "sm" ON (("sm"."id" = "s"."id")))
     LEFT JOIN "public"."tv_episodes" "e" ON (("e"."season_id" = "s"."id")))
     LEFT JOIN "public"."media_items" "em" ON (("em"."id" = "e"."id")))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "e"."id")))
  GROUP BY "s"."id", "s"."series_id", "s"."season_number", "sm"."title", "sm"."alternate_title", "sm"."summary", "sm"."cover_url";

ALTER VIEW "public"."v_media_season_summaries" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_media_series_years" WITH ("security_invoker"='true') AS
 SELECT "s"."series_id",
    (EXTRACT(year FROM "min"("m"."release_date")))::integer AS "first_year",
    (EXTRACT(year FROM "max"("m"."release_date")))::integer AS "last_year"
   FROM (("public"."tv_seasons" "s"
     JOIN "public"."tv_episodes" "e" ON (("e"."season_id" = "s"."id")))
     JOIN "public"."media_items" "m" ON (("m"."id" = "e"."id")))
  GROUP BY "s"."series_id";

ALTER VIEW "public"."v_media_series_years" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_media_context" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."type",
    "m"."title",
        CASE "m"."type"
            WHEN 'tv_season'::"public"."media_type" THEN (((COALESCE("show"."title", '未知电视节目'::"text") || ' · 第 '::"text") || "s"."season_number") || ' 季'::"text")
            WHEN 'tv_episode'::"public"."media_type" THEN (((((COALESCE("ep_show"."title", '未知电视节目'::"text") || ' · 第 '::"text") || "es"."season_number") || ' 季 · 第 '::"text") || "e"."episode_number") || ' 集'::"text")
            ELSE NULL::"text"
        END AS "context"
   FROM ((((("public"."media_items" "m"
     LEFT JOIN "public"."tv_seasons" "s" ON (("s"."id" = "m"."id")))
     LEFT JOIN "public"."media_items" "show" ON (("show"."id" = "s"."series_id")))
     LEFT JOIN "public"."tv_episodes" "e" ON (("e"."id" = "m"."id")))
     LEFT JOIN "public"."tv_seasons" "es" ON (("es"."id" = "e"."season_id")))
     LEFT JOIN "public"."media_items" "ep_show" ON (("ep_show"."id" = "es"."series_id")));

ALTER VIEW "public"."v_report_media_context" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_credit_order" WITH ("security_invoker"='true') AS
 SELECT ("c"."id")::"text" AS "id",
    ("c"."type")::"text" AS "link_type",
    "c"."id" AS "link_id",
    "c"."title",
    "c"."context" AS "detail",
    "array_agg"(("o"."role" || '_order'::"text") ORDER BY "o"."role") AS "tags",
    0 AS "weight",
    "c"."title" AS "sort_key"
   FROM (( SELECT "mc"."media_item_id",
            "mc"."role"
           FROM "public"."media_credits" "mc"
          GROUP BY "mc"."media_item_id", "mc"."role"
         HAVING (("count"("mc"."credit_order") <> "count"(*)) OR ("count"(DISTINCT "mc"."credit_order") <> "count"(*)) OR ("min"("mc"."credit_order") <> 0) OR ("max"("mc"."credit_order") <> ("count"(*) - 1)))) "o"
     JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "o"."media_item_id")))
  GROUP BY "c"."id", "c"."type", "c"."title", "c"."context";

ALTER VIEW "public"."v_report_credit_order" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_incomplete_media" WITH ("security_invoker"='true') AS
 SELECT "id",
    "link_type",
    "link_id",
    "title",
    "detail",
    "tags",
    "weight",
    "sort_key"
   FROM ( SELECT ("m"."id")::"text" AS "id",
            ("m"."type")::"text" AS "link_type",
            "m"."id" AS "link_id",
            "m"."title",
            "c"."context" AS "detail",
            "array_remove"(
                CASE
                    WHEN ("m"."type" = 'tv_episode'::"public"."media_type") THEN ARRAY[
                    CASE
                        WHEN ("m"."release_date" IS NULL) THEN 'no_release_date'::"text"
                        ELSE NULL::"text"
                    END]
                    ELSE ARRAY[
                    CASE
                        WHEN (NULLIF("btrim"("m"."cover_url"), ''::"text") IS NULL) THEN 'no_cover'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NULLIF("btrim"("m"."summary"), ''::"text") IS NULL) THEN 'no_summary'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (("m"."type" = 'movie'::"public"."media_type") AND ("m"."release_date" IS NULL)) THEN 'no_release_date'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NOT (EXISTS ( SELECT 1
                           FROM "public"."media_genres" "x"
                          WHERE ("x"."media_item_id" = "m"."id")))) THEN 'no_genres'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NOT (EXISTS ( SELECT 1
                           FROM "public"."media_regions" "x"
                          WHERE ("x"."media_item_id" = "m"."id")))) THEN 'no_regions'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NOT (EXISTS ( SELECT 1
                           FROM "public"."media_languages" "x"
                          WHERE ("x"."media_item_id" = "m"."id")))) THEN 'no_languages'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NOT (EXISTS ( SELECT 1
                           FROM "public"."media_credits" "x"
                          WHERE (("x"."media_item_id" = "m"."id") AND ("x"."role" = 'actor'::"text"))))) THEN 'no_actors'::"text"
                        ELSE NULL::"text"
                    END,
                    CASE
                        WHEN (NOT (EXISTS ( SELECT 1
                           FROM "public"."media_credits" "x"
                          WHERE (("x"."media_item_id" = "m"."id") AND ("x"."role" = 'director'::"text"))))) THEN 'no_directors'::"text"
                        ELSE NULL::"text"
                    END]
                END, NULL::"text") AS "tags",
            0 AS "weight",
            "m"."title" AS "sort_key"
           FROM ("public"."media_items" "m"
             JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "m"."id")))
          WHERE ("m"."type" = ANY (ARRAY['movie'::"public"."media_type", 'tv_show'::"public"."media_type", 'tv_episode'::"public"."media_type"]))) "r"
  WHERE ("cardinality"("tags") > 0);

ALTER VIEW "public"."v_report_incomplete_media" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_missing_alias" WITH ("security_invoker"='true') AS
 SELECT ("p"."id")::"text" AS "id",
    'people'::"text" AS "link_type",
    "p"."id" AS "link_id",
    "p"."name" AS "title",
        CASE
            WHEN ("count"("mc"."media_item_id") = 0) THEN '未关联作品'::"text"
            ELSE (('参与 '::"text" || "count"(DISTINCT "mc"."media_item_id")) || ' 部作品'::"text")
        END AS "detail",
    '{}'::"text"[] AS "tags",
    ("count"(DISTINCT "mc"."media_item_id"))::integer AS "weight",
    "p"."name" AS "sort_key"
   FROM ("public"."people" "p"
     LEFT JOIN "public"."media_credits" "mc" ON (("mc"."person_id" = "p"."id")))
  WHERE (COALESCE("btrim"("p"."alternate_name"), ''::"text") = ''::"text")
  GROUP BY "p"."id", "p"."name";

ALTER VIEW "public"."v_report_missing_alias" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_missing_character" WITH ("security_invoker"='true') AS
 SELECT ("c"."id")::"text" AS "id",
    ("c"."type")::"text" AS "link_type",
    "c"."id" AS "link_id",
    "c"."title",
    "c"."context" AS "detail",
    "array_agg"("p"."name" ORDER BY "mc"."credit_order", "p"."name") AS "tags",
    ("count"(*))::integer AS "weight",
    "c"."title" AS "sort_key"
   FROM (("public"."media_credits" "mc"
     JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
     JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "mc"."media_item_id")))
  WHERE (("mc"."role" = 'actor'::"text") AND ("mc"."character_name" IS NULL))
  GROUP BY "c"."id", "c"."type", "c"."title", "c"."context";

ALTER VIEW "public"."v_report_missing_character" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_orphan_people" WITH ("security_invoker"='true') AS
 SELECT ("id")::"text" AS "id",
    'people'::"text" AS "link_type",
    "id" AS "link_id",
    "name" AS "title",
    "alternate_name" AS "detail",
    '{}'::"text"[] AS "tags",
    0 AS "weight",
    "name" AS "sort_key"
   FROM "public"."people" "p"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."media_credits" "mc"
          WHERE ("mc"."person_id" = "p"."id"))));

ALTER VIEW "public"."v_report_orphan_people" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_similar_people" WITH ("security_invoker"='true') AS
 WITH "keyed" AS (
         SELECT "p"."id",
            "p"."name",
            "p"."alternate_name",
            "public"."manage_name_key"("p"."name") AS "name_key"
           FROM "public"."people" "p"
        ), "pairs" AS (
         SELECT "a"."id",
            "o"."id" AS "other_id",
            "o"."name" AS "other_name",
            "o"."alternate_name" AS "other_alternate_name"
           FROM ("keyed" "a"
             JOIN "keyed" "o" ON ((("o"."name_key" = "a"."name_key") AND ("o"."id" <> "a"."id"))))
          WHERE (("a"."name_key" <> ''::"text") AND (("a"."name" <> "o"."name") OR (COALESCE("btrim"("a"."alternate_name"), ''::"text") = ''::"text") OR (COALESCE("btrim"("o"."alternate_name"), ''::"text") = ''::"text")) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."people_distinct_pairs" "d"
                  WHERE (("d"."person_a" = LEAST("a"."id", "o"."id")) AND ("d"."person_b" = GREATEST("a"."id", "o"."id")))))))
        )
 SELECT ("id")::"text" AS "id",
    'people'::"text" AS "link_type",
    "id" AS "link_id",
    "name" AS "title",
    COALESCE(NULLIF("btrim"("alternate_name"), ''::"text"), '未填别名'::"text") AS "detail",
    ARRAY( SELECT ("p"."other_name" || COALESCE((('（'::"text" || NULLIF("btrim"("p"."other_alternate_name"), ''::"text")) || '）'::"text"), ''::"text"))
           FROM "pairs" "p"
          WHERE ("p"."id" = "k"."id")
          ORDER BY "p"."other_name", "p"."other_id") AS "tags",
    0 AS "weight",
    (("name_key" || ' '::"text") || "name") AS "sort_key",
    "name_key" AS "group_key"
   FROM "keyed" "k"
  WHERE (EXISTS ( SELECT 1
           FROM "pairs" "p"
          WHERE ("p"."id" = "k"."id")));

ALTER VIEW "public"."v_report_similar_people" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_suspicious_names" WITH ("security_invoker"='true') AS
 SELECT "public"."manage_name_issue_people_item_id"("p"."id") AS "id",
    'people'::"text" AS "link_type",
    "p"."id" AS "link_id",
    "p"."name" AS "title",
    NULLIF("btrim"("p"."alternate_name"), ''::"text") AS "detail",
    "public"."manage_name_issues"("p"."name", false) AS "tags",
    0 AS "weight",
    "p"."name" AS "sort_key"
   FROM "public"."people" "p"
  WHERE (("cardinality"("public"."manage_name_issues"("p"."name", false)) > 0) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."name_issue_confirmations" "c"
          WHERE (("c"."person_id" = "p"."id") AND ("c"."media_item_id" IS NULL) AND ("c"."confirmed_name" = "p"."name"))))))
UNION ALL
 SELECT "public"."manage_name_issue_credit_item_id"("mc"."media_item_id", "mc"."person_id", "mc"."character_name") AS "id",
    ("c"."type")::"text" AS "link_type",
    "c"."id" AS "link_id",
    "mc"."character_name" AS "title",
    ((((COALESCE(("c"."context" || ' · '::"text"), ''::"text") || "c"."title") || ' · '::"text") || "p"."name") || ' 饰'::"text") AS "detail",
    ("public"."manage_name_issues"("mc"."character_name", true) ||
        CASE
            WHEN ("public"."manage_name_key"("mc"."character_name") = "public"."manage_name_key"("p"."name")) THEN ARRAY['same_as_actor'::"text"]
            ELSE '{}'::"text"[]
        END) AS "tags",
    0 AS "weight",
    "mc"."character_name" AS "sort_key"
   FROM (("public"."media_credits" "mc"
     JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
     JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "mc"."media_item_id")))
  WHERE (("mc"."character_name" IS NOT NULL) AND (("cardinality"("public"."manage_name_issues"("mc"."character_name", true)) > 0) OR ("public"."manage_name_key"("mc"."character_name") = "public"."manage_name_key"("p"."name"))) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."name_issue_confirmations" "conf"
          WHERE (("conf"."media_item_id" = "mc"."media_item_id") AND ("conf"."person_id" = "mc"."person_id") AND ("conf"."character_name" = "mc"."character_name") AND ("conf"."confirmed_name" = "mc"."character_name"))))));

ALTER VIEW "public"."v_report_suspicious_names" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_tracking_conflicts" WITH ("security_invoker"='true') AS
 SELECT ("m"."id")::"text" AS "id",
    ("m"."type")::"text" AS "link_type",
    "m"."id" AS "link_id",
    "m"."title",
    "c"."context" AS "detail",
    ARRAY[
        CASE
            WHEN ("t"."status" = 'want_to_watch'::"public"."tracking_status") THEN 'rating_unwatched'::"text"
            ELSE 'watched_unrated'::"text"
        END] AS "tags",
    0 AS "weight",
    "m"."title" AS "sort_key"
   FROM (("public"."media_items" "m"
     JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
     JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "m"."id")))
  WHERE ((("m"."type" = ANY (ARRAY['movie'::"public"."media_type", 'tv_episode'::"public"."media_type"])) AND ("t"."status" = 'want_to_watch'::"public"."tracking_status") AND ("t"."rating" IS NOT NULL)) OR (("m"."type" = 'movie'::"public"."media_type") AND ("t"."status" = 'watched'::"public"."tracking_status") AND ("t"."rating" IS NULL)));

ALTER VIEW "public"."v_report_tracking_conflicts" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_tv_structure" WITH ("security_invoker"='true') AS
 SELECT ("m"."id")::"text" AS "id",
    ("m"."type")::"text" AS "link_type",
    "m"."id" AS "link_id",
    "m"."title",
        CASE
            WHEN ("gap"."missing" IS NULL) THEN NULL::"text"
            ELSE (('缺第 '::"text" || "array_to_string"("gap"."missing", '、'::"text")) || ' 季'::"text")
        END AS "detail",
    ARRAY[
        CASE
            WHEN ("gap"."total" = 0) THEN 'no_seasons'::"text"
            ELSE 'season_gap'::"text"
        END] AS "tags",
    0 AS "weight",
    "m"."title" AS "sort_key"
   FROM ("public"."media_items" "m"
     CROSS JOIN LATERAL ( SELECT ( SELECT "count"(*) AS "count"
                   FROM "public"."tv_seasons" "s"
                  WHERE ("s"."series_id" = "m"."id")) AS "total",
            ( SELECT "array_agg"("n"."n" ORDER BY "n"."n") AS "array_agg"
                   FROM "generate_series"(1, ( SELECT "max"("s"."season_number") AS "max"
                           FROM "public"."tv_seasons" "s"
                          WHERE ("s"."series_id" = "m"."id"))) "n"("n")
                  WHERE (NOT (EXISTS ( SELECT 1
                           FROM "public"."tv_seasons" "s"
                          WHERE (("s"."series_id" = "m"."id") AND ("s"."season_number" = "n"."n")))))) AS "missing") "gap")
  WHERE (("m"."type" = 'tv_show'::"public"."media_type") AND (("gap"."total" = 0) OR ("gap"."missing" IS NOT NULL)))
UNION ALL
 SELECT ("m"."id")::"text" AS "id",
    ("m"."type")::"text" AS "link_type",
    "m"."id" AS "link_id",
    "m"."title",
    ("c"."context" ||
        CASE
            WHEN ("gap"."missing" IS NULL) THEN ''::"text"
            ELSE ((' · 缺第 '::"text" || "array_to_string"("gap"."missing", '、'::"text")) || ' 集'::"text")
        END) AS "detail",
    ARRAY[
        CASE
            WHEN ("counts"."total" = 0) THEN 'no_episodes'::"text"
            ELSE 'episode_gap'::"text"
        END] AS "tags",
    0 AS "weight",
    "c"."context" AS "sort_key"
   FROM ((((("public"."media_items" "m"
     JOIN "public"."v_report_media_context" "c" ON (("c"."id" = "m"."id")))
     LEFT JOIN LATERAL ( SELECT "s"."series_id",
            "s"."season_number"
           FROM "public"."tv_seasons" "s"
          WHERE ("s"."id" = "m"."id")) "season" ON (true))
     CROSS JOIN LATERAL ( SELECT ( SELECT "count"(*) AS "count"
                   FROM "public"."tv_episodes" "e"
                  WHERE ("e"."season_id" = "m"."id")) AS "total",
            ( SELECT "min"("e"."episode_number") AS "min"
                   FROM "public"."tv_episodes" "e"
                  WHERE (("e"."season_id" = "m"."id") AND ("e"."episode_number" > 0))) AS "first_number",
            ( SELECT "max"("e"."episode_number") AS "max"
                   FROM "public"."tv_episodes" "e"
                  WHERE ("e"."season_id" = ( SELECT "ps"."id"
                           FROM "public"."tv_seasons" "ps"
                          WHERE (("ps"."series_id" = "season"."series_id") AND ("ps"."season_number" > 0) AND ("ps"."season_number" < "season"."season_number") AND (EXISTS ( SELECT 1
                                   FROM "public"."tv_episodes" "pe"
                                  WHERE (("pe"."season_id" = "ps"."id") AND ("pe"."episode_number" > 0)))))
                          ORDER BY "ps"."season_number" DESC
                         LIMIT 1))) AS "previous_last") "counts")
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN (("season"."season_number" > 0) AND ("counts"."previous_last" IS NOT NULL) AND ("counts"."first_number" > "counts"."previous_last")) THEN ("counts"."previous_last" + 1)
                    ELSE 1
                END AS "start") "numbering")
     CROSS JOIN LATERAL ( SELECT ( SELECT "array_agg"("n"."n" ORDER BY "n"."n") AS "array_agg"
                   FROM "generate_series"("numbering"."start", ( SELECT "max"("e"."episode_number") AS "max"
                           FROM "public"."tv_episodes" "e"
                          WHERE ("e"."season_id" = "m"."id"))) "n"("n")
                  WHERE (NOT (EXISTS ( SELECT 1
                           FROM "public"."tv_episodes" "e"
                          WHERE (("e"."season_id" = "m"."id") AND ("e"."episode_number" = "n"."n")))))) AS "missing") "gap")
  WHERE (("m"."type" = 'tv_season'::"public"."media_type") AND (("counts"."total" = 0) OR ("gap"."missing" IS NOT NULL)));

ALTER VIEW "public"."v_report_tv_structure" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_report_unused_references" WITH ("security_invoker"='true') AS
 SELECT ('genres:'::"text" || "g"."id") AS "id",
    'genres'::"text" AS "link_type",
    "g"."id" AS "link_id",
    "g"."name" AS "title",
    NULL::"text" AS "detail",
    ARRAY['genres'::"text"] AS "tags",
    0 AS "weight",
    "g"."name" AS "sort_key"
   FROM "public"."genres" "g"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."media_genres" "x"
          WHERE ("x"."genre_id" = "g"."id"))))
UNION ALL
 SELECT ('regions:'::"text" || "r"."id") AS "id",
    'regions'::"text" AS "link_type",
    "r"."id" AS "link_id",
    "r"."name" AS "title",
    NULL::"text" AS "detail",
    ARRAY['regions'::"text"] AS "tags",
    0 AS "weight",
    "r"."name" AS "sort_key"
   FROM "public"."regions" "r"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."media_regions" "x"
          WHERE ("x"."region_id" = "r"."id"))))
UNION ALL
 SELECT ('languages:'::"text" || "l"."id") AS "id",
    'languages'::"text" AS "link_type",
    "l"."id" AS "link_id",
    "l"."name" AS "title",
    NULL::"text" AS "detail",
    ARRAY['languages'::"text"] AS "tags",
    0 AS "weight",
    "l"."name" AS "sort_key"
   FROM "public"."languages" "l"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."media_languages" "x"
          WHERE ("x"."language_id" = "l"."id"))))
UNION ALL
 SELECT ('collections:'::"text" || "s"."id") AS "id",
    'collections'::"text" AS "link_type",
    "s"."id" AS "link_id",
    "s"."name" AS "title",
    "s"."alternate_name" AS "detail",
    ARRAY['collections'::"text"] AS "tags",
    0 AS "weight",
    "s"."name" AS "sort_key"
   FROM "public"."media_series" "s"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."media_item_series" "x"
          WHERE ("x"."series_id" = "s"."id"))));

ALTER VIEW "public"."v_report_unused_references" OWNER TO "postgres";

ALTER TABLE ONLY "public"."album_tracks"
    ADD CONSTRAINT "album_tracks_album_song_key" UNIQUE ("album_id", "song_id");

ALTER TABLE ONLY "public"."album_tracks"
    ADD CONSTRAINT "album_tracks_pkey" PRIMARY KEY ("album_id", "disc_number", "track_number");

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("media_item_id");

ALTER TABLE ONLY "public"."credit_roles"
    ADD CONSTRAINT "credit_roles_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."genres"
    ADD CONSTRAINT "genres_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."languages"
    ADD CONSTRAINT "languages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."media_credits"
    ADD CONSTRAINT "media_credits_pkey" PRIMARY KEY ("media_item_id", "person_id", "role");

ALTER TABLE ONLY "public"."media_genres"
    ADD CONSTRAINT "media_genres_pkey" PRIMARY KEY ("media_item_id", "genre_id");

ALTER TABLE ONLY "public"."media_item_series"
    ADD CONSTRAINT "media_item_series_pkey" PRIMARY KEY ("media_item_id", "series_id");

ALTER TABLE ONLY "public"."media_items"
    ADD CONSTRAINT "media_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."media_languages"
    ADD CONSTRAINT "media_languages_pkey" PRIMARY KEY ("media_item_id", "language_id");

ALTER TABLE ONLY "public"."media_regions"
    ADD CONSTRAINT "media_regions_pkey" PRIMARY KEY ("media_item_id", "region_id");

ALTER TABLE ONLY "public"."media_series"
    ADD CONSTRAINT "media_series_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."media_series"
    ADD CONSTRAINT "media_series_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."music_albums"
    ADD CONSTRAINT "music_albums_pkey" PRIMARY KEY ("media_item_id");

ALTER TABLE ONLY "public"."music"
    ADD CONSTRAINT "music_pkey" PRIMARY KEY ("media_item_id");

ALTER TABLE ONLY "public"."name_issue_confirmations"
    ADD CONSTRAINT "name_issue_confirmations_pkey" PRIMARY KEY ("item_id");

ALTER TABLE ONLY "public"."ownership"
    ADD CONSTRAINT "ownership_media_item_id_key" UNIQUE ("media_item_id");

ALTER TABLE ONLY "public"."ownership"
    ADD CONSTRAINT "ownership_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."people_distinct_pairs"
    ADD CONSTRAINT "people_distinct_pairs_pkey" PRIMARY KEY ("person_a", "person_b");

ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_name_alternate_name_key" UNIQUE NULLS NOT DISTINCT ("name", "alternate_name");

ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."site_owner"
    ADD CONSTRAINT "site_owner_pkey" PRIMARY KEY ("singleton");

ALTER TABLE ONLY "public"."site_owner"
    ADD CONSTRAINT "site_owner_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."tracking"
    ADD CONSTRAINT "tracking_media_item_id_key" UNIQUE ("media_item_id");

ALTER TABLE ONLY "public"."tracking"
    ADD CONSTRAINT "tracking_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_episodes"
    ADD CONSTRAINT "tv_episodes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_episodes"
    ADD CONSTRAINT "tv_episodes_season_id_episode_number_key" UNIQUE ("season_id", "episode_number");

ALTER TABLE ONLY "public"."tv_seasons"
    ADD CONSTRAINT "tv_seasons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_seasons"
    ADD CONSTRAINT "tv_seasons_series_id_season_number_key" UNIQUE ("series_id", "season_number");

CREATE INDEX "album_tracks_song_id_idx" ON "public"."album_tracks" USING "btree" ("song_id");

CREATE INDEX "idx_media_items_alternate_title_trgm" ON "public"."media_items" USING "gin" ("alternate_title" "extensions"."gin_trgm_ops");

CREATE INDEX "idx_media_items_release_date" ON "public"."media_items" USING "btree" ("release_date" DESC);

CREATE INDEX "idx_media_items_title_trgm" ON "public"."media_items" USING "gin" ("title" "extensions"."gin_trgm_ops");

CREATE INDEX "idx_media_items_type" ON "public"."media_items" USING "btree" ("type");

CREATE INDEX "idx_media_items_type_release_date_id" ON "public"."media_items" USING "btree" ("type", "release_date", "id");

CREATE INDEX "idx_media_series_name_trgm" ON "public"."media_series" USING "gin" ("name" "extensions"."gin_trgm_ops");

CREATE INDEX "idx_people_alternate_name_trgm" ON "public"."people" USING "gin" ("alternate_name" "extensions"."gin_trgm_ops");

CREATE INDEX "idx_people_name_trgm" ON "public"."people" USING "gin" ("name" "extensions"."gin_trgm_ops");

CREATE INDEX "media_credits_person_id_role_media_item_id_idx" ON "public"."media_credits" USING "btree" ("person_id", "role", "media_item_id");

CREATE INDEX "media_credits_role_idx" ON "public"."media_credits" USING "btree" ("role");

CREATE INDEX "media_genres_genre_id_media_item_id_idx" ON "public"."media_genres" USING "btree" ("genre_id", "media_item_id");

CREATE INDEX "media_item_series_series_id_media_item_id_idx" ON "public"."media_item_series" USING "btree" ("series_id", "media_item_id");

CREATE INDEX "media_languages_language_id_media_item_id_idx" ON "public"."media_languages" USING "btree" ("language_id", "media_item_id");

CREATE INDEX "media_regions_region_id_media_item_id_idx" ON "public"."media_regions" USING "btree" ("region_id", "media_item_id");

CREATE INDEX "name_issue_confirmations_media_item_id_idx" ON "public"."name_issue_confirmations" USING "btree" ("media_item_id") WHERE ("media_item_id" IS NOT NULL);

CREATE INDEX "name_issue_confirmations_person_id_idx" ON "public"."name_issue_confirmations" USING "btree" ("person_id");

CREATE INDEX "ownership_status_idx" ON "public"."ownership" USING "btree" ("status");

CREATE INDEX "people_distinct_pairs_person_b_idx" ON "public"."people_distinct_pairs" USING "btree" ("person_b");

CREATE OR REPLACE VIEW "public"."release_year_stats" WITH ("security_invoker"='true') AS
 WITH "ep_raw" AS (
         SELECT "series"."id" AS "series_id",
            "seasons"."id" AS "season_id",
            "episodes"."id" AS "episode_id",
            "episode_media"."release_date",
            (EXTRACT(year FROM "episode_media"."release_date"))::integer AS "release_year",
            COALESCE("episode_media"."runtime", (0)::numeric) AS "runtime",
            COALESCE(("episode_tracking"."status" = 'watched'::"public"."tracking_status"), false) AS "is_watched",
            "episode_tracking"."rating"
           FROM (((("public"."media_items" "series"
             JOIN "public"."tv_seasons" "seasons" ON (("seasons"."series_id" = "series"."id")))
             JOIN "public"."tv_episodes" "episodes" ON (("episodes"."season_id" = "seasons"."id")))
             JOIN "public"."media_items" "episode_media" ON (("episode_media"."id" = "episodes"."id")))
             LEFT JOIN "public"."tracking" "episode_tracking" ON (("episode_tracking"."media_item_id" = "episodes"."id")))
          WHERE ("series"."type" = 'tv_show'::"public"."media_type")
        ), "season_year_agg" AS (
         SELECT "ep_raw"."series_id",
            "ep_raw"."release_year",
            "ep_raw"."season_id",
            "count"("ep_raw"."episode_id") AS "total_eps",
            "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") AS "watched_eps",
                CASE
                    WHEN ("count"("ep_raw"."episode_id") = "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched")) THEN 'watched'::"text"
                    WHEN ("count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") = 0) THEN 'unwatched'::"text"
                    ELSE 'watching'::"text"
                END AS "season_status"
           FROM "ep_raw"
          WHERE ("ep_raw"."release_year" IS NOT NULL)
          GROUP BY "ep_raw"."series_id", "ep_raw"."release_year", "ep_raw"."season_id"
        ), "series_seasons_year_agg" AS (
         SELECT "season_year_agg"."series_id",
            "season_year_agg"."release_year",
            "count"("season_year_agg"."season_id") AS "total_seasons",
            "count"("season_year_agg"."season_id") FILTER (WHERE ("season_year_agg"."season_status" = 'watched'::"text")) AS "watched_seasons",
            "count"("season_year_agg"."season_id") FILTER (WHERE ("season_year_agg"."season_status" = 'watching'::"text")) AS "watching_seasons",
            "count"("season_year_agg"."season_id") FILTER (WHERE ("season_year_agg"."season_status" = 'unwatched'::"text")) AS "unwatched_seasons"
           FROM "season_year_agg"
          GROUP BY "season_year_agg"."series_id", "season_year_agg"."release_year"
        ), "series_year_agg" AS (
         SELECT "ep_raw"."series_id",
            "ep_raw"."release_year",
            "count"("ep_raw"."episode_id") AS "total_episodes",
            "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") AS "watched_episodes",
            "count"("ep_raw"."episode_id") FILTER (WHERE (NOT "ep_raw"."is_watched")) AS "unwatched_episodes",
            "sum"("ep_raw"."runtime") AS "total_runtime",
            COALESCE("sum"("ep_raw"."runtime") FILTER (WHERE "ep_raw"."is_watched"), (0)::numeric) AS "watched_runtime",
            COALESCE("sum"("ep_raw"."runtime") FILTER (WHERE (NOT "ep_raw"."is_watched")), (0)::numeric) AS "unwatched_runtime",
            "avg"("ep_raw"."rating") FILTER (WHERE ("ep_raw"."rating" IS NOT NULL)) AS "rating",
                CASE
                    WHEN ("count"("ep_raw"."episode_id") = "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched")) THEN 'watched'::"text"
                    WHEN ("count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") = 0) THEN 'unwatched'::"text"
                    ELSE 'watching'::"text"
                END AS "status"
           FROM "ep_raw"
          WHERE ("ep_raw"."release_year" IS NOT NULL)
          GROUP BY "ep_raw"."series_id", "ep_raw"."release_year"
        ), "tv_stats_year" AS (
         SELECT "s"."series_id" AS "id",
            "s"."release_year",
            'tv_show'::"text" AS "media_type",
            "s"."status",
            "s"."rating",
            "s"."total_runtime",
            "s"."watched_runtime",
            "s"."unwatched_runtime",
            "s"."total_episodes",
            "s"."watched_episodes",
            "s"."unwatched_episodes",
            "ss"."total_seasons",
            "ss"."watched_seasons",
            "ss"."watching_seasons",
            "ss"."unwatched_seasons"
           FROM ("series_year_agg" "s"
             JOIN "series_seasons_year_agg" "ss" ON ((("ss"."series_id" = "s"."series_id") AND ("ss"."release_year" = "s"."release_year"))))
        ), "season_all_agg" AS (
         SELECT "ep_raw"."series_id",
            "ep_raw"."season_id",
            "count"("ep_raw"."episode_id") AS "total_eps",
            "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") AS "watched_eps",
                CASE
                    WHEN ("count"("ep_raw"."episode_id") = "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched")) THEN 'watched'::"text"
                    WHEN ("count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") = 0) THEN 'unwatched'::"text"
                    ELSE 'watching'::"text"
                END AS "season_status"
           FROM "ep_raw"
          GROUP BY "ep_raw"."series_id", "ep_raw"."season_id"
        ), "series_seasons_all_agg" AS (
         SELECT "season_all_agg"."series_id",
            "count"("season_all_agg"."season_id") AS "total_seasons",
            "count"("season_all_agg"."season_id") FILTER (WHERE ("season_all_agg"."season_status" = 'watched'::"text")) AS "watched_seasons",
            "count"("season_all_agg"."season_id") FILTER (WHERE ("season_all_agg"."season_status" = 'watching'::"text")) AS "watching_seasons",
            "count"("season_all_agg"."season_id") FILTER (WHERE ("season_all_agg"."season_status" = 'unwatched'::"text")) AS "unwatched_seasons"
           FROM "season_all_agg"
          GROUP BY "season_all_agg"."series_id"
        ), "series_all_agg" AS (
         SELECT "ep_raw"."series_id",
            "count"("ep_raw"."episode_id") AS "total_episodes",
            "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") AS "watched_episodes",
            "count"("ep_raw"."episode_id") FILTER (WHERE (NOT "ep_raw"."is_watched")) AS "unwatched_episodes",
            "sum"("ep_raw"."runtime") AS "total_runtime",
            COALESCE("sum"("ep_raw"."runtime") FILTER (WHERE "ep_raw"."is_watched"), (0)::numeric) AS "watched_runtime",
            COALESCE("sum"("ep_raw"."runtime") FILTER (WHERE (NOT "ep_raw"."is_watched")), (0)::numeric) AS "unwatched_runtime",
            "avg"("ep_raw"."rating") FILTER (WHERE ("ep_raw"."rating" IS NOT NULL)) AS "rating",
                CASE
                    WHEN ("count"("ep_raw"."episode_id") = "count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched")) THEN 'watched'::"text"
                    WHEN ("count"("ep_raw"."episode_id") FILTER (WHERE "ep_raw"."is_watched") = 0) THEN 'unwatched'::"text"
                    ELSE 'watching'::"text"
                END AS "status"
           FROM "ep_raw"
          GROUP BY "ep_raw"."series_id"
        ), "tv_stats_all" AS (
         SELECT "s"."series_id" AS "id",
            NULL::integer AS "release_year",
            'tv_show'::"text" AS "media_type",
            "s"."status",
            "s"."rating",
            "s"."total_runtime",
            "s"."watched_runtime",
            "s"."unwatched_runtime",
            "s"."total_episodes",
            "s"."watched_episodes",
            "s"."unwatched_episodes",
            "ss"."total_seasons",
            "ss"."watched_seasons",
            "ss"."watching_seasons",
            "ss"."unwatched_seasons"
           FROM ("series_all_agg" "s"
             JOIN "series_seasons_all_agg" "ss" ON (("ss"."series_id" = "s"."series_id")))
        ), "movie_base" AS (
         SELECT "m"."id",
            (EXTRACT(year FROM "m"."release_date"))::integer AS "release_year",
            'movie'::"text" AS "media_type",
                CASE
                    WHEN ("t"."status" = 'watched'::"public"."tracking_status") THEN 'watched'::"text"
                    ELSE 'unwatched'::"text"
                END AS "status",
            "t"."rating",
            COALESCE("m"."runtime", (0)::numeric) AS "total_runtime",
                CASE
                    WHEN ("t"."status" = 'watched'::"public"."tracking_status") THEN COALESCE("m"."runtime", (0)::numeric)
                    ELSE (0)::numeric
                END AS "watched_runtime",
                CASE
                    WHEN ("t"."status" IS DISTINCT FROM 'watched'::"public"."tracking_status") THEN COALESCE("m"."runtime", (0)::numeric)
                    ELSE (0)::numeric
                END AS "unwatched_runtime",
            (0)::bigint AS "total_episodes",
            (0)::bigint AS "watched_episodes",
            (0)::bigint AS "unwatched_episodes",
            (0)::bigint AS "total_seasons",
            (0)::bigint AS "watched_seasons",
            (0)::bigint AS "watching_seasons",
            (0)::bigint AS "unwatched_seasons"
           FROM ("public"."media_items" "m"
             LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
          WHERE (("m"."type" = 'movie'::"public"."media_type") AND ("m"."release_date" IS NOT NULL))
        ), "movie_stats" AS (
         SELECT "movie_base"."id",
            "movie_base"."release_year",
            "movie_base"."media_type",
            "movie_base"."status",
            "movie_base"."rating",
            "movie_base"."total_runtime",
            "movie_base"."watched_runtime",
            "movie_base"."unwatched_runtime",
            "movie_base"."total_episodes",
            "movie_base"."watched_episodes",
            "movie_base"."unwatched_episodes",
            "movie_base"."total_seasons",
            "movie_base"."watched_seasons",
            "movie_base"."watching_seasons",
            "movie_base"."unwatched_seasons"
           FROM "movie_base"
        UNION ALL
         SELECT "movie_base"."id",
            NULL::integer AS "int4",
            "movie_base"."media_type",
            "movie_base"."status",
            "movie_base"."rating",
            "movie_base"."total_runtime",
            "movie_base"."watched_runtime",
            "movie_base"."unwatched_runtime",
            "movie_base"."total_episodes",
            "movie_base"."watched_episodes",
            "movie_base"."unwatched_episodes",
            "movie_base"."total_seasons",
            "movie_base"."watched_seasons",
            "movie_base"."watching_seasons",
            "movie_base"."unwatched_seasons"
           FROM "movie_base"
        ), "album_base" AS (
         SELECT "m"."id",
            (EXTRACT(year FROM "m"."release_date"))::integer AS "release_year",
            'album'::"text" AS "media_type",
                CASE
                    WHEN (("count"("at"."song_id") > 0) AND ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) = "count"("at"."song_id"))) THEN 'watched'::"text"
                    WHEN ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) > 0) THEN 'watching'::"text"
                    WHEN ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'want_to_watch'::"public"."tracking_status")) > 0) THEN 'want_to_watch'::"text"
                    ELSE 'unwatched'::"text"
                END AS "status",
            "public"."album_average_rating"("m"."id") AS "rating",
            (0)::numeric AS "total_runtime",
            (0)::numeric AS "watched_runtime",
            (0)::numeric AS "unwatched_runtime",
            (0)::bigint AS "total_episodes",
            (0)::bigint AS "watched_episodes",
            (0)::bigint AS "unwatched_episodes",
            (0)::bigint AS "total_seasons",
            (0)::bigint AS "watched_seasons",
            (0)::bigint AS "watching_seasons",
            (0)::bigint AS "unwatched_seasons"
           FROM (("public"."media_items" "m"
             LEFT JOIN "public"."album_tracks" "at" ON (("at"."album_id" = "m"."id")))
             LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "at"."song_id")))
          WHERE (("m"."type" = 'album'::"public"."media_type") AND ("m"."release_date" IS NOT NULL))
          GROUP BY "m"."id"
        ), "album_stats" AS (
         SELECT "album_base"."id",
            "album_base"."release_year",
            "album_base"."media_type",
            "album_base"."status",
            "album_base"."rating",
            "album_base"."total_runtime",
            "album_base"."watched_runtime",
            "album_base"."unwatched_runtime",
            "album_base"."total_episodes",
            "album_base"."watched_episodes",
            "album_base"."unwatched_episodes",
            "album_base"."total_seasons",
            "album_base"."watched_seasons",
            "album_base"."watching_seasons",
            "album_base"."unwatched_seasons"
           FROM "album_base"
        UNION ALL
         SELECT "album_base"."id",
            NULL::integer AS "int4",
            "album_base"."media_type",
            "album_base"."status",
            "album_base"."rating",
            "album_base"."total_runtime",
            "album_base"."watched_runtime",
            "album_base"."unwatched_runtime",
            "album_base"."total_episodes",
            "album_base"."watched_episodes",
            "album_base"."unwatched_episodes",
            "album_base"."total_seasons",
            "album_base"."watched_seasons",
            "album_base"."watching_seasons",
            "album_base"."unwatched_seasons"
           FROM "album_base"
        ), "book_base" AS (
         SELECT "m"."id",
            (EXTRACT(year FROM "m"."release_date"))::integer AS "release_year",
            'book'::"text" AS "media_type",
                CASE
                    WHEN ("t"."status" = 'watched'::"public"."tracking_status") THEN 'watched'::"text"
                    WHEN ("t"."status" = 'in_progress'::"public"."tracking_status") THEN 'in_progress'::"text"
                    WHEN ("t"."status" = 'want_to_watch'::"public"."tracking_status") THEN 'want_to_watch'::"text"
                    ELSE 'unwatched'::"text"
                END AS "status",
            "t"."rating",
            (0)::numeric AS "total_runtime",
            (0)::numeric AS "watched_runtime",
            (0)::numeric AS "unwatched_runtime",
            (0)::bigint AS "total_episodes",
            (0)::bigint AS "watched_episodes",
            (0)::bigint AS "unwatched_episodes",
            (0)::bigint AS "total_seasons",
            (0)::bigint AS "watched_seasons",
            (0)::bigint AS "watching_seasons",
            (0)::bigint AS "unwatched_seasons"
           FROM ("public"."media_items" "m"
             LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
          WHERE (("m"."type" = 'book'::"public"."media_type") AND ("m"."release_date" IS NOT NULL))
        ), "book_stats" AS (
         SELECT "book_base"."id",
            "book_base"."release_year",
            "book_base"."media_type",
            "book_base"."status",
            "book_base"."rating",
            "book_base"."total_runtime",
            "book_base"."watched_runtime",
            "book_base"."unwatched_runtime",
            "book_base"."total_episodes",
            "book_base"."watched_episodes",
            "book_base"."unwatched_episodes",
            "book_base"."total_seasons",
            "book_base"."watched_seasons",
            "book_base"."watching_seasons",
            "book_base"."unwatched_seasons"
           FROM "book_base"
        UNION ALL
         SELECT "book_base"."id",
            NULL::integer AS "int4",
            "book_base"."media_type",
            "book_base"."status",
            "book_base"."rating",
            "book_base"."total_runtime",
            "book_base"."watched_runtime",
            "book_base"."unwatched_runtime",
            "book_base"."total_episodes",
            "book_base"."watched_episodes",
            "book_base"."unwatched_episodes",
            "book_base"."total_seasons",
            "book_base"."watched_seasons",
            "book_base"."watching_seasons",
            "book_base"."unwatched_seasons"
           FROM "book_base"
        ), "track_base" AS (
         SELECT "m"."id",
            (EXTRACT(year FROM COALESCE("m"."release_date", "album_dates"."earliest_album_release")))::integer AS "release_year",
            'music'::"text" AS "media_type",
                CASE
                    WHEN ("t"."status" = 'watched'::"public"."tracking_status") THEN 'watched'::"text"
                    WHEN ("t"."status" = 'want_to_watch'::"public"."tracking_status") THEN 'want_to_watch'::"text"
                    ELSE 'unwatched'::"text"
                END AS "status",
            "t"."rating",
            (0)::numeric AS "total_runtime",
            (0)::numeric AS "watched_runtime",
            (0)::numeric AS "unwatched_runtime",
            (0)::bigint AS "total_episodes",
            (0)::bigint AS "watched_episodes",
            (0)::bigint AS "unwatched_episodes",
            (0)::bigint AS "total_seasons",
            (0)::bigint AS "watched_seasons",
            (0)::bigint AS "watching_seasons",
            (0)::bigint AS "unwatched_seasons"
           FROM (("public"."media_items" "m"
             LEFT JOIN LATERAL ( SELECT "min"("ai"."release_date") AS "earliest_album_release"
                   FROM ("public"."album_tracks" "at"
                     JOIN "public"."media_items" "ai" ON (("ai"."id" = "at"."album_id")))
                  WHERE ("at"."song_id" = "m"."id")) "album_dates" ON (true))
             LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
          WHERE (("m"."type" = 'music'::"public"."media_type") AND (COALESCE("m"."release_date", "album_dates"."earliest_album_release") IS NOT NULL))
        ), "track_stats" AS (
         SELECT "track_base"."id",
            "track_base"."release_year",
            "track_base"."media_type",
            "track_base"."status",
            "track_base"."rating",
            "track_base"."total_runtime",
            "track_base"."watched_runtime",
            "track_base"."unwatched_runtime",
            "track_base"."total_episodes",
            "track_base"."watched_episodes",
            "track_base"."unwatched_episodes",
            "track_base"."total_seasons",
            "track_base"."watched_seasons",
            "track_base"."watching_seasons",
            "track_base"."unwatched_seasons"
           FROM "track_base"
        UNION ALL
         SELECT "track_base"."id",
            NULL::integer AS "int4",
            "track_base"."media_type",
            "track_base"."status",
            "track_base"."rating",
            "track_base"."total_runtime",
            "track_base"."watched_runtime",
            "track_base"."unwatched_runtime",
            "track_base"."total_episodes",
            "track_base"."watched_episodes",
            "track_base"."unwatched_episodes",
            "track_base"."total_seasons",
            "track_base"."watched_seasons",
            "track_base"."watching_seasons",
            "track_base"."unwatched_seasons"
           FROM "track_base"
        ), "combined_stats" AS (
         SELECT "movie_stats"."id",
            "movie_stats"."release_year",
            "movie_stats"."media_type",
            "movie_stats"."status",
            "movie_stats"."rating",
            "movie_stats"."total_runtime",
            "movie_stats"."watched_runtime",
            "movie_stats"."unwatched_runtime",
            "movie_stats"."total_episodes",
            "movie_stats"."watched_episodes",
            "movie_stats"."unwatched_episodes",
            "movie_stats"."total_seasons",
            "movie_stats"."watched_seasons",
            "movie_stats"."watching_seasons",
            "movie_stats"."unwatched_seasons"
           FROM "movie_stats"
        UNION ALL
         SELECT "tv_stats_year"."id",
            "tv_stats_year"."release_year",
            "tv_stats_year"."media_type",
            "tv_stats_year"."status",
            "tv_stats_year"."rating",
            "tv_stats_year"."total_runtime",
            "tv_stats_year"."watched_runtime",
            "tv_stats_year"."unwatched_runtime",
            "tv_stats_year"."total_episodes",
            "tv_stats_year"."watched_episodes",
            "tv_stats_year"."unwatched_episodes",
            "tv_stats_year"."total_seasons",
            "tv_stats_year"."watched_seasons",
            "tv_stats_year"."watching_seasons",
            "tv_stats_year"."unwatched_seasons"
           FROM "tv_stats_year"
        UNION ALL
         SELECT "tv_stats_all"."id",
            "tv_stats_all"."release_year",
            "tv_stats_all"."media_type",
            "tv_stats_all"."status",
            "tv_stats_all"."rating",
            "tv_stats_all"."total_runtime",
            "tv_stats_all"."watched_runtime",
            "tv_stats_all"."unwatched_runtime",
            "tv_stats_all"."total_episodes",
            "tv_stats_all"."watched_episodes",
            "tv_stats_all"."unwatched_episodes",
            "tv_stats_all"."total_seasons",
            "tv_stats_all"."watched_seasons",
            "tv_stats_all"."watching_seasons",
            "tv_stats_all"."unwatched_seasons"
           FROM "tv_stats_all"
        UNION ALL
         SELECT "album_stats"."id",
            "album_stats"."release_year",
            "album_stats"."media_type",
            "album_stats"."status",
            "album_stats"."rating",
            "album_stats"."total_runtime",
            "album_stats"."watched_runtime",
            "album_stats"."unwatched_runtime",
            "album_stats"."total_episodes",
            "album_stats"."watched_episodes",
            "album_stats"."unwatched_episodes",
            "album_stats"."total_seasons",
            "album_stats"."watched_seasons",
            "album_stats"."watching_seasons",
            "album_stats"."unwatched_seasons"
           FROM "album_stats"
        UNION ALL
         SELECT "book_stats"."id",
            "book_stats"."release_year",
            "book_stats"."media_type",
            "book_stats"."status",
            "book_stats"."rating",
            "book_stats"."total_runtime",
            "book_stats"."watched_runtime",
            "book_stats"."unwatched_runtime",
            "book_stats"."total_episodes",
            "book_stats"."watched_episodes",
            "book_stats"."unwatched_episodes",
            "book_stats"."total_seasons",
            "book_stats"."watched_seasons",
            "book_stats"."watching_seasons",
            "book_stats"."unwatched_seasons"
           FROM "book_stats"
        UNION ALL
         SELECT "track_stats"."id",
            "track_stats"."release_year",
            "track_stats"."media_type",
            "track_stats"."status",
            "track_stats"."rating",
            "track_stats"."total_runtime",
            "track_stats"."watched_runtime",
            "track_stats"."unwatched_runtime",
            "track_stats"."total_episodes",
            "track_stats"."watched_episodes",
            "track_stats"."unwatched_episodes",
            "track_stats"."total_seasons",
            "track_stats"."watched_seasons",
            "track_stats"."watching_seasons",
            "track_stats"."unwatched_seasons"
           FROM "track_stats"
        )
 SELECT COALESCE(("release_year")::"text", 'All Time'::"text") AS "release_year",
    COALESCE("sum"("total_runtime"), (0)::numeric) AS "total_runtime",
    COALESCE("sum"("watched_runtime"), (0)::numeric) AS "total_watched_runtime",
    COALESCE("sum"("unwatched_runtime"), (0)::numeric) AS "total_unwatched_runtime",
    "count"("id") FILTER (WHERE ("media_type" = 'movie'::"text")) AS "total_movies",
    "count"("id") FILTER (WHERE (("media_type" = 'movie'::"text") AND ("status" = 'watched'::"text"))) AS "watched_movies",
    "count"("id") FILTER (WHERE (("media_type" = 'movie'::"text") AND ("status" = 'unwatched'::"text"))) AS "unwatched_movies",
    COALESCE("sum"("total_runtime") FILTER (WHERE ("media_type" = 'movie'::"text")), (0)::numeric) AS "total_movies_runtime",
    COALESCE("sum"("watched_runtime") FILTER (WHERE ("media_type" = 'movie'::"text")), (0)::numeric) AS "movies_watched_runtime",
    COALESCE("sum"("unwatched_runtime") FILTER (WHERE ("media_type" = 'movie'::"text")), (0)::numeric) AS "movies_unwatched_runtime",
    "round"("avg"("rating") FILTER (WHERE (("media_type" = 'movie'::"text") AND ("status" = 'watched'::"text"))), 1) AS "movie_avg_rating",
    "count"("id") FILTER (WHERE ("media_type" = 'tv_show'::"text")) AS "total_series",
    "count"("id") FILTER (WHERE (("media_type" = 'tv_show'::"text") AND ("status" = 'watched'::"text"))) AS "watched_series",
    "count"("id") FILTER (WHERE (("media_type" = 'tv_show'::"text") AND ("status" = 'watching'::"text"))) AS "watching_series",
    "count"("id") FILTER (WHERE (("media_type" = 'tv_show'::"text") AND ("status" = 'unwatched'::"text"))) AS "unwatched_series",
    COALESCE("sum"("total_runtime") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "total_series_runtime",
    COALESCE("sum"("watched_runtime") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "series_watched_runtime",
    COALESCE("sum"("unwatched_runtime") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "series_unwatched_runtime",
    "round"("avg"("rating") FILTER (WHERE (("media_type" = 'tv_show'::"text") AND ("rating" IS NOT NULL))), 1) AS "series_avg_rating",
    COALESCE("sum"("total_seasons") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "total_seasons",
    COALESCE("sum"("watched_seasons") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "watched_seasons",
    COALESCE("sum"("watching_seasons") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "watching_seasons",
    COALESCE("sum"("unwatched_seasons") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "unwatched_seasons",
    COALESCE("sum"("total_episodes") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "total_series_episodes",
    COALESCE("sum"("watched_episodes") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "watched_series_episodes",
    COALESCE("sum"("unwatched_episodes") FILTER (WHERE ("media_type" = 'tv_show'::"text")), (0)::numeric) AS "unwatched_episodes",
    "count"("id") FILTER (WHERE ("media_type" = 'album'::"text")) AS "total_albums",
    "count"("id") FILTER (WHERE (("media_type" = 'album'::"text") AND ("status" = 'watched'::"text"))) AS "listened_albums",
    "count"("id") FILTER (WHERE ("media_type" = 'book'::"text")) AS "total_books",
    "count"("id") FILTER (WHERE (("media_type" = 'book'::"text") AND ("status" = 'watched'::"text"))) AS "read_books",
    "count"("id") FILTER (WHERE (("media_type" = 'book'::"text") AND ("status" = 'in_progress'::"text"))) AS "reading_books",
    "count"("id") FILTER (WHERE (("media_type" = 'album'::"text") AND ("status" = 'want_to_watch'::"text"))) AS "want_albums",
    "count"("id") FILTER (WHERE (("media_type" = 'book'::"text") AND ("status" = 'want_to_watch'::"text"))) AS "want_books",
    "count"("id") FILTER (WHERE ("media_type" = 'music'::"text")) AS "total_tracks",
    "count"("id") FILTER (WHERE (("media_type" = 'music'::"text") AND ("status" = 'watched'::"text"))) AS "listened_tracks",
    "count"("id") FILTER (WHERE (("media_type" = 'music'::"text") AND ("status" = 'want_to_watch'::"text"))) AS "want_tracks",
    "round"("avg"("rating") FILTER (WHERE (("media_type" = 'album'::"text") AND ("status" = 'watched'::"text"))), 1) AS "album_avg_rating",
    "round"("avg"("rating") FILTER (WHERE (("media_type" = 'book'::"text") AND ("status" = 'watched'::"text"))), 1) AS "book_avg_rating"
   FROM "combined_stats"
  GROUP BY "release_year"
  ORDER BY ("release_year" IS NULL) DESC, COALESCE(("release_year")::"text", 'All Time'::"text") DESC;

CREATE OR REPLACE VIEW "public"."v_all_media" WITH ("security_invoker"='true') AS
 SELECT "m"."id",
    "m"."type",
    "m"."title",
    "m"."summary",
    "m"."cover_url",
    "m"."release_date" AS "sort_date",
    (EXTRACT(year FROM "m"."release_date"))::"text" AS "release_year",
    "round"("avg"("t"."rating"), 1) AS "rating",
    ("m"."runtime")::integer AS "runtime",
    ( SELECT ("t1"."status")::"text" AS "status"
           FROM "public"."tracking" "t1"
          WHERE ("t1"."media_item_id" = "m"."id")
         LIMIT 1) AS "status",
    ( SELECT "array_agg"("g"."name") AS "array_agg"
           FROM ("public"."media_genres" "mg"
             JOIN "public"."genres" "g" ON (("g"."id" = "mg"."genre_id")))
          WHERE ("mg"."media_item_id" = "m"."id")) AS "genres",
    ( SELECT "array_agg"("l"."name") AS "array_agg"
           FROM ("public"."media_languages" "ml"
             JOIN "public"."languages" "l" ON (("l"."id" = "ml"."language_id")))
          WHERE ("ml"."media_item_id" = "m"."id")) AS "languages",
    ( SELECT "array_agg"("r"."name") AS "array_agg"
           FROM ("public"."media_regions" "mr"
             JOIN "public"."regions" "r" ON (("r"."id" = "mr"."region_id")))
          WHERE ("mr"."media_item_id" = "m"."id")) AS "regions",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "casts",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'director'::"text"))) AS "directors",
    "m"."alternate_title",
    "m"."release_date" AS "first_air_date",
    "m"."release_date" AS "last_air_date",
    ( SELECT "array_agg"("mc"."character_name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "characters",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'artist'::"text"))) AS "artists",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'author'::"text"))) AS "authors"
   FROM ("public"."media_items" "m"
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
  WHERE ("m"."type" = 'movie'::"public"."media_type")
  GROUP BY "m"."id", "m"."runtime"
UNION ALL
 SELECT "series"."id",
    "series"."type",
    "series"."title",
    "series"."summary",
    "series"."cover_url",
    COALESCE("max"("episode_media"."release_date") FILTER (WHERE ("episode_media"."release_date" <= CURRENT_DATE)), "min"("episode_media"."release_date")) AS "sort_date",
        CASE
            WHEN ("min"("episode_media"."release_date") IS NULL) THEN NULL::"text"
            WHEN ("max"("episode_media"."release_date") > CURRENT_DATE) THEN ((EXTRACT(year FROM "min"("episode_media"."release_date")))::"text" || ' - Present'::"text")
            WHEN (EXTRACT(year FROM "min"("episode_media"."release_date")) = EXTRACT(year FROM "max"("episode_media"."release_date"))) THEN (EXTRACT(year FROM "min"("episode_media"."release_date")))::"text"
            ELSE (((EXTRACT(year FROM "min"("episode_media"."release_date")))::"text" || ' - '::"text") || (EXTRACT(year FROM "max"("episode_media"."release_date")))::"text")
        END AS "release_year",
    "round"("avg"("t"."rating"), 1) AS "rating",
    ( SELECT ("sum"("ep_media"."runtime"))::integer AS "sum"
           FROM (("public"."tv_seasons" "s"
             JOIN "public"."tv_episodes" "e" ON (("e"."season_id" = "s"."id")))
             JOIN "public"."media_items" "ep_media" ON (("e"."id" = "ep_media"."id")))
          WHERE ("s"."series_id" = "series"."id")) AS "runtime",
        CASE
            WHEN (("count"("episodes"."id") > 0) AND ("count"("t"."media_item_id") = "count"("episodes"."id")) AND (("min"("t"."status"))::"text" = 'watched'::"text") AND (("max"("t"."status"))::"text" = 'watched'::"text")) THEN 'watched'::"text"
            WHEN (("count"("episodes"."id") > 0) AND ("count"("t"."media_item_id") = "count"("episodes"."id")) AND (("min"("t"."status"))::"text" = 'want_to_watch'::"text") AND (("max"("t"."status"))::"text" = 'want_to_watch'::"text")) THEN 'want_to_watch'::"text"
            WHEN ("count"("t"."media_item_id") > 0) THEN 'watching'::"text"
            ELSE NULL::"text"
        END AS "status",
    ( SELECT "array_agg"("g"."name") AS "array_agg"
           FROM ("public"."media_genres" "mg"
             JOIN "public"."genres" "g" ON (("g"."id" = "mg"."genre_id")))
          WHERE ("mg"."media_item_id" = "series"."id")) AS "genres",
    ( SELECT "array_agg"("l"."name") AS "array_agg"
           FROM ("public"."media_languages" "ml"
             JOIN "public"."languages" "l" ON (("l"."id" = "ml"."language_id")))
          WHERE ("ml"."media_item_id" = "series"."id")) AS "languages",
    ( SELECT "array_agg"("r"."name") AS "array_agg"
           FROM ("public"."media_regions" "mr"
             JOIN "public"."regions" "r" ON (("r"."id" = "mr"."region_id")))
          WHERE ("mr"."media_item_id" = "series"."id")) AS "regions",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "series"."id") AND ("mc"."role" = 'actor'::"text"))) AS "casts",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "series"."id") AND ("mc"."role" = 'director'::"text"))) AS "directors",
    "series"."alternate_title",
    "min"("episode_media"."release_date") AS "first_air_date",
    "max"("episode_media"."release_date") AS "last_air_date",
    ( SELECT "array_agg"("mc"."character_name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "series"."id") AND ("mc"."role" = 'actor'::"text"))) AS "characters",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "series"."id") AND ("mc"."role" = 'artist'::"text"))) AS "artists",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "series"."id") AND ("mc"."role" = 'author'::"text"))) AS "authors"
   FROM (((("public"."media_items" "series"
     LEFT JOIN "public"."tv_seasons" "seasons" ON (("seasons"."series_id" = "series"."id")))
     LEFT JOIN "public"."tv_episodes" "episodes" ON (("episodes"."season_id" = "seasons"."id")))
     LEFT JOIN "public"."media_items" "episode_media" ON (("episodes"."id" = "episode_media"."id")))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "episodes"."id")))
  WHERE ("series"."type" = 'tv_show'::"public"."media_type")
  GROUP BY "series"."id"
UNION ALL
 SELECT "album_item"."id",
    "album_item"."type",
    "album_item"."title",
    "album_item"."summary",
    "album_item"."cover_url",
    "album_item"."release_date" AS "sort_date",
    (EXTRACT(year FROM "album_item"."release_date"))::"text" AS "release_year",
    "public"."album_average_rating"("album_item"."id") AS "rating",
    NULL::integer AS "runtime",
        CASE
            WHEN (("count"("mu"."song_id") > 0) AND ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) = "count"("mu"."song_id"))) THEN 'watched'::"text"
            WHEN ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'watched'::"public"."tracking_status")) > 0) THEN 'watching'::"text"
            WHEN ("count"("t"."media_item_id") FILTER (WHERE ("t"."status" = 'want_to_watch'::"public"."tracking_status")) > 0) THEN 'want_to_watch'::"text"
            ELSE NULL::"text"
        END AS "status",
    ( SELECT "array_agg"("g"."name") AS "array_agg"
           FROM ("public"."media_genres" "mg"
             JOIN "public"."genres" "g" ON (("g"."id" = "mg"."genre_id")))
          WHERE ("mg"."media_item_id" = "album_item"."id")) AS "genres",
    ( SELECT "array_agg"(DISTINCT "l"."name" ORDER BY "l"."name") AS "array_agg"
           FROM (("public"."album_tracks" "track"
             JOIN "public"."media_languages" "ml" ON (("ml"."media_item_id" = "track"."song_id")))
             JOIN "public"."languages" "l" ON (("l"."id" = "ml"."language_id")))
          WHERE ("track"."album_id" = "album_item"."id")) AS "languages",
    ( SELECT "array_agg"("r"."name") AS "array_agg"
           FROM ("public"."media_regions" "mr"
             JOIN "public"."regions" "r" ON (("r"."id" = "mr"."region_id")))
          WHERE ("mr"."media_item_id" = "album_item"."id")) AS "regions",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "album_item"."id") AND ("mc"."role" = 'actor'::"text"))) AS "casts",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "album_item"."id") AND ("mc"."role" = 'director'::"text"))) AS "directors",
    "album_item"."alternate_title",
    "album_item"."release_date" AS "first_air_date",
    "album_item"."release_date" AS "last_air_date",
    ( SELECT "array_agg"("mc"."character_name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "album_item"."id") AND ("mc"."role" = 'actor'::"text"))) AS "characters",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "album_item"."id") AND ("mc"."role" = 'artist'::"text"))) AS "artists",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "album_item"."id") AND ("mc"."role" = 'author'::"text"))) AS "authors"
   FROM ((("public"."media_items" "album_item"
     JOIN "public"."music_albums" "album" ON (("album"."media_item_id" = "album_item"."id")))
     LEFT JOIN "public"."album_tracks" "mu" ON (("mu"."album_id" = "album"."media_item_id")))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "mu"."song_id")))
  WHERE ("album_item"."type" = 'album'::"public"."media_type")
  GROUP BY "album_item"."id"
UNION ALL
 SELECT "m"."id",
    "m"."type",
    "m"."title",
    "m"."summary",
    COALESCE(NULLIF("m"."cover_url", ''::"text"), ( SELECT "ai"."cover_url"
           FROM ("public"."album_tracks" "at"
             JOIN "public"."media_items" "ai" ON (("ai"."id" = "at"."album_id")))
          WHERE (("at"."song_id" = "m"."id") AND ("ai"."cover_url" IS NOT NULL) AND (NULLIF("ai"."cover_url", ''::"text") IS NOT NULL))
          ORDER BY "ai"."release_date", "at"."disc_number", "at"."track_number"
         LIMIT 1)) AS "cover_url",
    COALESCE("m"."release_date", "album_dates"."earliest_album_release") AS "sort_date",
    (EXTRACT(year FROM COALESCE("m"."release_date", "album_dates"."earliest_album_release")))::"text" AS "release_year",
    "round"("avg"("t"."rating"), 1) AS "rating",
    ("m"."runtime")::integer AS "runtime",
    ( SELECT ("t1"."status")::"text" AS "status"
           FROM "public"."tracking" "t1"
          WHERE ("t1"."media_item_id" = "m"."id")
         LIMIT 1) AS "status",
    ( SELECT "array_agg"("g"."name") AS "array_agg"
           FROM ("public"."media_genres" "mg"
             JOIN "public"."genres" "g" ON (("g"."id" = "mg"."genre_id")))
          WHERE ("mg"."media_item_id" = "m"."id")) AS "genres",
    ( SELECT "array_agg"("l"."name") AS "array_agg"
           FROM ("public"."media_languages" "ml"
             JOIN "public"."languages" "l" ON (("l"."id" = "ml"."language_id")))
          WHERE ("ml"."media_item_id" = "m"."id")) AS "languages",
    ( SELECT "array_agg"("r"."name") AS "array_agg"
           FROM ("public"."media_regions" "mr"
             JOIN "public"."regions" "r" ON (("r"."id" = "mr"."region_id")))
          WHERE ("mr"."media_item_id" = "m"."id")) AS "regions",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "casts",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'director'::"text"))) AS "directors",
    "m"."alternate_title",
    COALESCE("m"."release_date", "album_dates"."earliest_album_release") AS "first_air_date",
    COALESCE("m"."release_date", "album_dates"."earliest_album_release") AS "last_air_date",
    ( SELECT "array_agg"("mc"."character_name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "characters",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'artist'::"text"))) AS "artists",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'author'::"text"))) AS "authors"
   FROM (("public"."media_items" "m"
     LEFT JOIN LATERAL ( SELECT "min"("ai"."release_date") AS "earliest_album_release"
           FROM ("public"."album_tracks" "at"
             JOIN "public"."media_items" "ai" ON (("ai"."id" = "at"."album_id")))
          WHERE ("at"."song_id" = "m"."id")) "album_dates" ON (true))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
  WHERE ("m"."type" = 'music'::"public"."media_type")
  GROUP BY "m"."id", "m"."runtime", "album_dates"."earliest_album_release"
UNION ALL
 SELECT "m"."id",
    "m"."type",
    "m"."title",
    "m"."summary",
    "m"."cover_url",
    "m"."release_date" AS "sort_date",
    (EXTRACT(year FROM "m"."release_date"))::"text" AS "release_year",
    "round"("avg"("t"."rating"), 1) AS "rating",
    NULL::integer AS "runtime",
    ( SELECT ("t1"."status")::"text" AS "status"
           FROM "public"."tracking" "t1"
          WHERE ("t1"."media_item_id" = "m"."id")
         LIMIT 1) AS "status",
    ( SELECT "array_agg"("g"."name") AS "array_agg"
           FROM ("public"."media_genres" "mg"
             JOIN "public"."genres" "g" ON (("g"."id" = "mg"."genre_id")))
          WHERE ("mg"."media_item_id" = "m"."id")) AS "genres",
    ( SELECT "array_agg"("l"."name") AS "array_agg"
           FROM ("public"."media_languages" "ml"
             JOIN "public"."languages" "l" ON (("l"."id" = "ml"."language_id")))
          WHERE ("ml"."media_item_id" = "m"."id")) AS "languages",
    ( SELECT "array_agg"("r"."name") AS "array_agg"
           FROM ("public"."media_regions" "mr"
             JOIN "public"."regions" "r" ON (("r"."id" = "mr"."region_id")))
          WHERE ("mr"."media_item_id" = "m"."id")) AS "regions",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "casts",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'director'::"text"))) AS "directors",
    "m"."alternate_title",
    "m"."release_date" AS "first_air_date",
    "m"."release_date" AS "last_air_date",
    ( SELECT "array_agg"("mc"."character_name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'actor'::"text"))) AS "characters",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'artist'::"text"))) AS "artists",
    ( SELECT "array_agg"("p"."name" ORDER BY "mc"."credit_order") AS "array_agg"
           FROM ("public"."media_credits" "mc"
             JOIN "public"."people" "p" ON (("p"."id" = "mc"."person_id")))
          WHERE (("mc"."media_item_id" = "m"."id") AND ("mc"."role" = 'author'::"text"))) AS "authors"
   FROM (("public"."media_items" "m"
     JOIN "public"."books" "b" ON (("b"."media_item_id" = "m"."id")))
     LEFT JOIN "public"."tracking" "t" ON (("t"."media_item_id" = "m"."id")))
  WHERE ("m"."type" = 'book'::"public"."media_type")
  GROUP BY "m"."id";

CREATE OR REPLACE TRIGGER "media_credits_enforce_allowed_types" BEFORE INSERT OR UPDATE OF "role", "media_item_id" ON "public"."media_credits" FOR EACH ROW EXECUTE FUNCTION "public"."media_credits_enforce_allowed_types"();

CREATE OR REPLACE TRIGGER "media_credits_enforce_character" BEFORE INSERT OR UPDATE OF "role", "character_name" ON "public"."media_credits" FOR EACH ROW EXECUTE FUNCTION "public"."media_credits_enforce_character"();

CREATE OR REPLACE TRIGGER "name_issue_confirmations_sync_keys" BEFORE INSERT OR UPDATE OF "item_id" ON "public"."name_issue_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."name_issue_confirmations_sync_keys"();

CREATE OR REPLACE TRIGGER "tracking_status_media_type_check" BEFORE INSERT OR UPDATE OF "status", "media_item_id" ON "public"."tracking" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tracking_status_for_media_type"();

ALTER TABLE ONLY "public"."album_tracks"
    ADD CONSTRAINT "album_tracks_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."music_albums"("media_item_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."album_tracks"
    ADD CONSTRAINT "album_tracks_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."album_tracks"
    ADD CONSTRAINT "album_tracks_song_id_music_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."music"("media_item_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_credits"
    ADD CONSTRAINT "media_credits_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_credits"
    ADD CONSTRAINT "media_credits_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_credits"
    ADD CONSTRAINT "media_credits_role_fkey" FOREIGN KEY ("role") REFERENCES "public"."credit_roles"("code");

ALTER TABLE ONLY "public"."media_genres"
    ADD CONSTRAINT "media_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_genres"
    ADD CONSTRAINT "media_genres_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_item_series"
    ADD CONSTRAINT "media_item_series_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_item_series"
    ADD CONSTRAINT "media_item_series_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."media_series"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_languages"
    ADD CONSTRAINT "media_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_languages"
    ADD CONSTRAINT "media_languages_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_regions"
    ADD CONSTRAINT "media_regions_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."media_regions"
    ADD CONSTRAINT "media_regions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."music_albums"
    ADD CONSTRAINT "music_albums_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."music"
    ADD CONSTRAINT "music_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."name_issue_confirmations"
    ADD CONSTRAINT "name_issue_confirmations_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."name_issue_confirmations"
    ADD CONSTRAINT "name_issue_confirmations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ownership"
    ADD CONSTRAINT "ownership_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."people_distinct_pairs"
    ADD CONSTRAINT "people_distinct_pairs_person_a_fkey" FOREIGN KEY ("person_a") REFERENCES "public"."people"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."people_distinct_pairs"
    ADD CONSTRAINT "people_distinct_pairs_person_b_fkey" FOREIGN KEY ("person_b") REFERENCES "public"."people"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."site_owner"
    ADD CONSTRAINT "site_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tracking"
    ADD CONSTRAINT "tracking_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tv_episodes"
    ADD CONSTRAINT "tv_episodes_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tv_episodes"
    ADD CONSTRAINT "tv_episodes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."tv_seasons"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tv_seasons"
    ADD CONSTRAINT "tv_seasons_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tv_seasons"
    ADD CONSTRAINT "tv_seasons_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;

CREATE POLICY "Allow SELECT from website" ON "public"."album_tracks" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."books" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."credit_roles" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."genres" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."languages" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_credits" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_genres" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_item_series" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_items" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_languages" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_regions" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."media_series" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."music" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."music_albums" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."ownership" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."people" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."regions" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."tracking" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."tv_episodes" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Allow SELECT from website" ON "public"."tv_seasons" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Owner delete" ON "public"."album_tracks" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."books" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."credit_roles" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."genres" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."languages" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_credits" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_genres" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_item_series" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_items" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_languages" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_regions" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."media_series" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."music" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."music_albums" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."name_issue_confirmations" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."ownership" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."people" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."people_distinct_pairs" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."regions" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."tracking" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."tv_episodes" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner delete" ON "public"."tv_seasons" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."album_tracks" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."books" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."credit_roles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."genres" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."languages" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_credits" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_genres" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_item_series" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_items" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_languages" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_regions" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."media_series" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."music" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."music_albums" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."name_issue_confirmations" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."ownership" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."people" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."people_distinct_pairs" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."regions" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."tracking" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."tv_episodes" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner insert" ON "public"."tv_seasons" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner may verify own identity" ON "public"."site_owner" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "Owner select" ON "public"."name_issue_confirmations" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner select" ON "public"."people_distinct_pairs" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."album_tracks" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."books" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."credit_roles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."genres" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."languages" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_credits" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_genres" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_item_series" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_items" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_languages" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_regions" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."media_series" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."music" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."music_albums" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."ownership" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."people" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."regions" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."tracking" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."tv_episodes" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

CREATE POLICY "Owner update" ON "public"."tv_seasons" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_site_owner"() AS "is_site_owner")) WITH CHECK (( SELECT "public"."is_site_owner"() AS "is_site_owner"));

ALTER TABLE "public"."album_tracks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."credit_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."genres" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."languages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_credits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_genres" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_item_series" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_languages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_regions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."media_series" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."music" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."music_albums" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."name_issue_confirmations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ownership" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."people_distinct_pairs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."site_owner" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tracking" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_episodes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_seasons" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_delete_media"("p_id" "uuid", "p_confirm_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_media"("p_id" "uuid", "p_confirm_title" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_save_album_with_tracks"("p_album" "jsonb", "p_tracks" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_album_with_tracks"("p_album" "jsonb", "p_tracks" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_save_media"("p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_media"("p_data" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."album_average_rating"("p_album_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."album_average_rating"("p_album_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."album_average_rating"("p_album_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."album_average_rating"("p_album_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_tracking_status_for_media_type"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[], "p_exclude_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[], "p_exclude_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_book_by_title_and_authors"("p_title" "text", "p_author_names" "text"[], "p_exclude_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_music_by_title_and_artists"("p_type" "public"."media_type", "p_title" "text", "p_artist_names" "text"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_media_distribution_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_media_distribution_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_media_distribution_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_media_distribution_counts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_media_stats"("p_media_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_media_stats"("p_media_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_media_stats"("p_media_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_media_stats"("p_media_type" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_person_works"("p_person_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_person_works"("p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_person_works"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_person_works"("p_person_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text", "p_order" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text", "p_order" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text", "p_order" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_season_episode_page"("p_series_id" "uuid", "p_season_id" "uuid", "p_status" "text", "p_order" "text", "p_limit" integer, "p_offset" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_song_detail"("p_song_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_song_detail"("p_song_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_song_detail"("p_song_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_song_detail"("p_song_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_tv_shows_by_year"("p_year" integer, "p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_site_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_site_owner"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_delete_unused"("p_kind" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_delete_unused"("p_kind" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_merge_people"("p_keep" "uuid", "p_remove" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_merge_people"("p_keep" "uuid", "p_remove" "uuid"[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_name_issue_credit_item_id"("p_media" "uuid", "p_person" "uuid", "p_character" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_name_issue_credit_item_id"("p_media" "uuid", "p_person" "uuid", "p_character" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_name_issue_people_item_id"("p_person" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_name_issue_people_item_id"("p_person" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_name_issues"("p_name" "text", "p_character" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_name_issues"("p_name" "text", "p_character" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_name_key"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_name_key"("p_name" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."manage_save_media"("p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_save_media"("p_data" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."media_credits_enforce_allowed_types"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."media_credits_enforce_character"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."name_issue_confirmations_sync_keys"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."normalize_book_isbn"("p_raw" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_book_isbn"("p_raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_book_isbn"("p_raw" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."normalize_media_title"("p_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_media_title"("p_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_media_title"("p_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_media_title"("p_title" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_all_media" TO "service_role";
GRANT SELECT ON TABLE "public"."v_all_media" TO "anon";
GRANT SELECT ON TABLE "public"."v_all_media" TO "authenticated";

REVOKE ALL ON FUNCTION "public"."search_media"("p_query" "text", "p_types" "text"[], "p_series_only" boolean, "p_credit_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_media"("p_query" "text", "p_types" "text"[], "p_series_only" boolean, "p_credit_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."search_media"("p_query" "text", "p_types" "text"[], "p_series_only" boolean, "p_credit_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_media"("p_query" "text", "p_types" "text"[], "p_series_only" boolean, "p_credit_roles" "text"[]) TO "service_role";

GRANT ALL ON TABLE "public"."album_tracks" TO "service_role";
GRANT SELECT ON TABLE "public"."album_tracks" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."album_tracks" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."books" TO "service_role";
GRANT SELECT ON TABLE "public"."books" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."books" TO "authenticated";

GRANT ALL ON TABLE "public"."credit_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."credit_roles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."credit_roles" TO "authenticated";

GRANT ALL ON TABLE "public"."genres" TO "service_role";
GRANT SELECT ON TABLE "public"."genres" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."genres" TO "authenticated";

GRANT ALL ON TABLE "public"."languages" TO "service_role";
GRANT SELECT ON TABLE "public"."languages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."languages" TO "authenticated";

GRANT ALL ON TABLE "public"."media_credits" TO "service_role";
GRANT SELECT ON TABLE "public"."media_credits" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_credits" TO "authenticated";

GRANT ALL ON TABLE "public"."media_genres" TO "service_role";
GRANT SELECT ON TABLE "public"."media_genres" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_genres" TO "authenticated";

GRANT ALL ON TABLE "public"."media_item_series" TO "service_role";
GRANT SELECT ON TABLE "public"."media_item_series" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_item_series" TO "authenticated";

GRANT ALL ON TABLE "public"."media_items" TO "service_role";
GRANT SELECT ON TABLE "public"."media_items" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_items" TO "authenticated";

GRANT ALL ON TABLE "public"."media_languages" TO "service_role";
GRANT SELECT ON TABLE "public"."media_languages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_languages" TO "authenticated";

GRANT ALL ON TABLE "public"."media_regions" TO "service_role";
GRANT SELECT ON TABLE "public"."media_regions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_regions" TO "authenticated";

GRANT ALL ON TABLE "public"."media_series" TO "service_role";
GRANT SELECT ON TABLE "public"."media_series" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_series" TO "authenticated";

GRANT ALL ON TABLE "public"."music" TO "service_role";
GRANT SELECT ON TABLE "public"."music" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."music" TO "authenticated";

GRANT ALL ON TABLE "public"."music_albums" TO "service_role";
GRANT SELECT ON TABLE "public"."music_albums" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."music_albums" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."name_issue_confirmations" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."name_issue_confirmations" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ownership" TO "service_role";
GRANT SELECT ON TABLE "public"."ownership" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ownership" TO "authenticated";

GRANT ALL ON TABLE "public"."people" TO "service_role";
GRANT SELECT ON TABLE "public"."people" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."people" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."people_distinct_pairs" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."people_distinct_pairs" TO "authenticated";

GRANT ALL ON TABLE "public"."regions" TO "service_role";
GRANT SELECT ON TABLE "public"."regions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."regions" TO "authenticated";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."release_year_stats" TO "service_role";
GRANT SELECT ON TABLE "public"."release_year_stats" TO "anon";
GRANT SELECT ON TABLE "public"."release_year_stats" TO "authenticated";

GRANT ALL ON TABLE "public"."site_owner" TO "service_role";
GRANT SELECT ON TABLE "public"."site_owner" TO "authenticated";

GRANT ALL ON TABLE "public"."tracking" TO "service_role";
GRANT SELECT ON TABLE "public"."tracking" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tracking" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_episodes" TO "service_role";
GRANT SELECT ON TABLE "public"."tv_episodes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tv_episodes" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_seasons" TO "service_role";
GRANT SELECT ON TABLE "public"."tv_seasons" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tv_seasons" TO "authenticated";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_continue_listening" TO "service_role";
GRANT SELECT ON TABLE "public"."v_continue_listening" TO "anon";
GRANT SELECT ON TABLE "public"."v_continue_listening" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_manage_media_order" TO "service_role";
GRANT SELECT ON TABLE "public"."v_manage_media_order" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_media_season_summaries" TO "service_role";
GRANT SELECT ON TABLE "public"."v_media_season_summaries" TO "anon";
GRANT SELECT ON TABLE "public"."v_media_season_summaries" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_media_series_years" TO "service_role";
GRANT SELECT ON TABLE "public"."v_media_series_years" TO "anon";
GRANT SELECT ON TABLE "public"."v_media_series_years" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_media_context" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_media_context" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_credit_order" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_credit_order" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_incomplete_media" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_incomplete_media" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_missing_alias" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_missing_alias" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_missing_character" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_missing_character" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_orphan_people" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_orphan_people" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_similar_people" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_similar_people" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_suspicious_names" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_suspicious_names" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_tracking_conflicts" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_tracking_conflicts" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_tv_structure" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_tv_structure" TO "authenticated";

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."v_report_unused_references" TO "service_role";
GRANT SELECT ON TABLE "public"."v_report_unused_references" TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";

CREATE EVENT TRIGGER "ensure_rls" ON "ddl_command_end"
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER EVENT TRIGGER "ensure_rls" OWNER TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;
