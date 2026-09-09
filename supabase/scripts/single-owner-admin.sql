-- 已于 2026-09-09 应用到生产的单人管理扩展。保留为迁移记录，不重复执行；当前快照已包含这些定义。
begin;

-- 只能由可信数据库管理员配置唯一站长；站点用户没有新增或修改权限。
create table public.site_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.site_owner enable row level security;
revoke all on public.site_owner from public, anon, authenticated;
grant select on public.site_owner to authenticated;
grant all on public.site_owner to service_role;
create policy "Owner may verify own identity" on public.site_owner
  for select to authenticated using (user_id = (select auth.uid()));

-- 以调用者身份读取受 RLS 保护的站长记录，不能通过用户可编辑的 metadata 提权。
create function public.is_site_owner() returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists(select 1 from public.site_owner where user_id = (select auth.uid())); $$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

-- 对影视及关联表逐项授权；不向匿名用户授予任何写入权限。
do $$
declare target text;
begin
  foreach target in array array['media_items','tv_seasons','tv_episodes','tracking',
    'genres','languages','regions','people','media_genres','media_languages','media_regions','media_credits'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', target);
    execute format('create policy "Owner insert" on public.%I for insert to authenticated with check ((select public.is_site_owner()))', target);
    execute format('create policy "Owner update" on public.%I for update to authenticated using ((select public.is_site_owner())) with check ((select public.is_site_owner()))', target);
    execute format('create policy "Owner delete" on public.%I for delete to authenticated using ((select public.is_site_owner()))', target);
  end loop;
end $$;

-- 原子保存媒体、季集关系、评分和关联名称；任何一步失败则整次调用回滚。
create function public.admin_save_media(p_data jsonb) returns uuid
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
  item_name text;
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
    for item_name in select btrim(value) from jsonb_array_elements_text(p_data->field) loop
      if item_name is null or item_name = '' or length(item_name) > 200 then
        raise exception 'Invalid related name' using errcode = '22023';
      end if;
      execute format('insert into public.%I(name) values($1) on conflict(name) do update set name=excluded.name returning id',target)
        into related_id using item_name;
      if target = 'people' then
        insert into public.media_credits(media_item_id,person_id,role,credit_order)
        values(item_id,related_id,person_kind,position) on conflict do nothing;
      else
        execute format('insert into public.%I(media_item_id,%I) values($1,$2) on conflict do nothing',link_table,key_column) using item_id,related_id;
      end if;
      position := position + 1;
    end loop;
  end loop;
  return item_id;
end $$;
revoke all on function public.admin_save_media(jsonb) from public, anon;
grant execute on function public.admin_save_media(jsonb) to authenticated;

-- 删除整个影视树中的 media_items，避免外键级联只删除关系而留下孤立的季集资料。
create function public.admin_delete_media(p_id uuid, p_confirm_title text) returns void
language plpgsql security invoker set search_path = ''
as $$
declare current_title text; item_type public.media_type; descendants uuid[];
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(73489126);
  select title,type into current_title,item_type from public.media_items where id=p_id for update;
  if not found then raise exception 'Media not found' using errcode = 'P0002'; end if;
  if p_confirm_title is distinct from current_title or item_type not in ('movie','tv_series','tv_season','tv_episode') then
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
revoke all on function public.admin_delete_media(uuid,text) from public, anon;
grant execute on function public.admin_delete_media(uuid,text) to authenticated;

commit;
