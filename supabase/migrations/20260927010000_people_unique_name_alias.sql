-- 同名人物以别名区分：名称与别名组合唯一，别名为空也视为相同值，避免重复创建无别名的同名人物。
alter table public.people
  drop constraint people_name_key,
  add constraint people_name_alternate_name_key unique nulls not distinct (name, alternate_name);

-- actors、directors 元素可为名称字符串或 {"id","name"} 对象（actors 另有 "character"），其余关联仍只接受字符串。
-- 同名人物只能凭 id 区分：带 id 时直接关联该人物；无 id 时只匹配或新建无别名的同名人物，不猜测有别名的人。
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
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  -- 串行化管理事务，避免删除父条目与新增季集同时执行。
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if item_type is null or item_type not in ('movie','tv_show','tv_season','tv_episode')
    or nullif(btrim(p_data->>'title'), '') is null or length(p_data->>'title') > 300
    or coalesce(p_data->>'status','') not in ('watched','want_to_watch') then
    raise exception 'Invalid media input' using errcode = '22023';
  end if;
  if (p_data->>'rating')::numeric not between 0 and 10
    or (p_data->>'rating')::numeric <> round((p_data->>'rating')::numeric, 1)
    or (p_data->>'runtime')::numeric not between 0 and 100000 then
    raise exception 'Invalid numeric input' using errcode = '22023';
  end if;
  if item_type in ('tv_season','tv_episode') then
    if parent_id is null or item_number is null or item_number < 0 or item_number > 100000 or parent_id = item_id then
      raise exception 'Invalid parent or number' using errcode = '22023';
    end if;
    if item_type = 'tv_season' and not exists(select 1 from public.media_items where id = parent_id and type = 'tv_show') then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if item_type = 'tv_episode' and not exists(select 1 from public.tv_seasons s join public.media_items m on m.id = s.id where s.id = parent_id and m.type = 'tv_season') then
      raise exception 'Season not found' using errcode = 'P0002';
    end if;
  end if;

  if item_id is null then
    insert into public.media_items(type,title,alternate_title,summary,cover_url,release_date,runtime)
    values(item_type,btrim(p_data->>'title'),nullif(p_data->>'alternate_title',''),nullif(p_data->>'summary',''),
      nullif(p_data->>'cover_url',''),nullif(p_data->>'release_date','')::date,(p_data->>'runtime')::numeric)
    returning id into item_id;
  else
    select type into old_type from public.media_items where id = item_id for update;
    if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
    if old_type <> item_type then raise exception 'Cannot change media type' using errcode = '22023'; end if;
    update public.media_items set title=btrim(p_data->>'title'),alternate_title=nullif(p_data->>'alternate_title',''),
      summary=nullif(p_data->>'summary',''),cover_url=nullif(p_data->>'cover_url',''),
      release_date=nullif(p_data->>'release_date','')::date,runtime=(p_data->>'runtime')::numeric where id=item_id;
  end if;
  if item_type = 'tv_season' then
    insert into public.tv_seasons(id,series_id,season_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set series_id=excluded.series_id, season_number=excluded.season_number;
  elsif item_type = 'tv_episode' then
    insert into public.tv_episodes(id,season_id,episode_number) values(item_id,parent_id,item_number)
    on conflict(id) do update set season_id=excluded.season_id, episode_number=excluded.episode_number;
  end if;
  insert into public.tracking(media_item_id,status,rating)
  values(item_id,(p_data->>'status')::public.tracking_status,(p_data->>'rating')::numeric)
  on conflict(media_item_id) do update set status=excluded.status, rating=excluded.rating;

  -- 关联名称一行一个，由数据库唯一约束去重；只替换当前条目的关联。
  foreach field in array array['genres','languages','regions','actors','directors'] loop
    if jsonb_typeof(p_data->field) is distinct from 'array' or jsonb_array_length(p_data->field) > 100 then
      raise exception 'Invalid related names' using errcode = '22023';
    end if;
    case field
      when 'genres' then target := 'genres'; link_table := 'media_genres'; key_column := 'genre_id';
      when 'languages' then target := 'languages'; link_table := 'media_languages'; key_column := 'language_id';
      when 'regions' then target := 'regions'; link_table := 'media_regions'; key_column := 'region_id';
      else target := 'people'; link_table := 'media_credits'; key_column := 'person_id';
    end case;
    if target = 'people' then
      person_kind := case when field = 'actors' then 'actor'::public.person_role else 'director'::public.person_role end;
      delete from public.media_credits where media_item_id=item_id and role=person_kind;
    else
      execute format('delete from public.%I where media_item_id=$1',link_table) using item_id;
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
          on conflict(name, alternate_name) do update set name=excluded.name returning id into related_id;
        end if;
        insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
        values(item_id,related_id,person_kind,position,item_character) on conflict do nothing;
      else
        execute format('insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',target)
          into related_id using item_name;
        execute format('insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',link_table,key_column) using item_id,related_id;
      end if;
      position := position + 1;
    end loop;
  end loop;
  return item_id;
end $$;
