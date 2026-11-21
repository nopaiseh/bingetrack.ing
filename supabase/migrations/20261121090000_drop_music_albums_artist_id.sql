-- 删除已弃用的 music_albums.artist_id：艺人改走 media_credits(role=artist)。
-- 先去掉仍引用该列的视图／函数依赖，再 drop column（索引与外键随列删除）。

create or replace view public.v_report_orphan_people
with (security_invoker = true) as
select p.id::text as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  p.alternate_name as detail, '{}'::text[] as tags, 0 as weight, p.name as sort_key
from public.people p
where not exists (select 1 from public.media_credits mc where mc.person_id = p.id);

revoke all on public.v_report_orphan_people from public, anon, authenticated;
grant select on public.v_report_orphan_people to authenticated;

create or replace function public.manage_delete_unused(p_kind text) returns integer
language plpgsql security invoker set search_path = ''
as $$
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

revoke all on function public.manage_delete_unused(text) from public, anon;
grant execute on function public.manage_delete_unused(text) to authenticated;

-- 合并人物：演职关联并入保留的人物；album artist_id 已移除，不再单独拦截。
create or replace function public.manage_merge_people(p_keep uuid, p_remove uuid[]) returns integer
language plpgsql security invoker set search_path = ''
as $$
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

revoke all on function public.manage_merge_people(uuid, uuid[]) from public, anon;
grant execute on function public.manage_merge_people(uuid, uuid[]) to authenticated;

alter table public.music_albums drop column if exists artist_id;
