-- 演员饰演的角色名。一位演员在同一作品中饰演多个角色时写在同一字符串里（如「A / B」），
-- 主键仍为 (media_item_id, person_id, role)；导演等非演员条目不得填写。
alter table public.media_credits
  add column character_name text,
  add constraint media_credits_character_actor_only_check
    check (character_name is null or role = 'actor'::public.person_role),
  add constraint media_credits_character_name_length_check
    check (character_name is null or (length(character_name) between 1 and 200));

-- 在末尾追加与 casts 按 credit_order 一一对应的 characters 数组，未填写角色的位置为 null。
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
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = m.id and mc.role = 'actor'::public.person_role) as characters
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
  (select array_agg(mc.character_name order by mc.credit_order) from public.media_credits mc join public.people p on p.id = mc.person_id where mc.media_item_id = series.id and mc.role = 'actor'::public.person_role) as characters
from public.media_items series
left join public.tv_seasons seasons on seasons.series_id = series.id
left join public.tv_episodes episodes on episodes.season_id = seasons.id
left join public.media_items episode_media on episodes.id = episode_media.id
left join public.tracking t on t.media_item_id = episodes.id
where series.type = 'tv_series'::public.media_type
group by series.id;

-- actors 元素可为名称字符串（旧版本应用）或 {"name","character"} 对象；其余关联仍只接受字符串。
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
  related_id uuid;
  position integer;
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  -- 串行化管理事务，避免删除父条目与新增季集同时执行。
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  if item_type is null or item_type not in ('movie','tv_series','tv_season','tv_episode')
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
    if item_type = 'tv_season' and not exists(select 1 from public.media_items where id = parent_id and type = 'tv_series') then
      raise exception 'Series not found' using errcode = 'P0002';
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
      if jsonb_typeof(entry) = 'string' then
        item_name := btrim(entry #>> '{}');
      elsif field = 'actors' and jsonb_typeof(entry) = 'object'
        and jsonb_typeof(entry->'name') = 'string'
        and coalesce(jsonb_typeof(entry->'character'), 'null') in ('string','null') then
        item_name := btrim(entry->>'name');
        item_character := nullif(btrim(entry->>'character'), '');
      else
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      if item_name is null or item_name = '' or length(item_name) > 200 or length(item_character) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      execute format('insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',target)
        into related_id using item_name;
      if target = 'people' then
        insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name)
        values(item_id,related_id,person_kind,position,item_character) on conflict do nothing;
      else
        execute format('insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',link_table,key_column) using item_id,related_id;
      end if;
      position := position + 1;
    end loop;
  end loop;
  return item_id;
end $$;
