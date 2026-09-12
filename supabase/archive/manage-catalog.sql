-- 已于 2026-09-11 应用到生产。保留为增量记录，不重复执行；当前快照已包含这些定义。
begin;

-- 系列与成员关系沿用唯一站长的 RLS；匿名角色保持只读。
grant insert, update, delete on public.media_series, public.media_item_series to authenticated;
create policy "Owner insert" on public.media_series for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.media_series for update to authenticated using ((select public.is_site_owner())) with check ((select public.is_site_owner()));
create policy "Owner delete" on public.media_series for delete to authenticated using ((select public.is_site_owner()));
create policy "Owner insert" on public.media_item_series for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.media_item_series for update to authenticated using ((select public.is_site_owner())) with check ((select public.is_site_owner()));
create policy "Owner delete" on public.media_item_series for delete to authenticated using ((select public.is_site_owner()));

-- 包装已有媒体事务，把系列关联纳入同一次提交；保留原 RPC 供旧版本应用使用。
create function public.manage_save_media(p_data jsonb) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  item_id uuid;
  item_name text;
  collection_id uuid;
  collection_ids uuid[] := '{}';
begin
  if not public.is_site_owner() then raise insufficient_privilege; end if;
  if jsonb_typeof(p_data->'collections') is distinct from 'array' or jsonb_array_length(p_data->'collections') > 100 then
    raise exception 'Invalid collection names' using errcode = '22023';
  end if;
  item_id := public.admin_save_media(p_data);
  for item_name in select btrim(value) from jsonb_array_elements_text(p_data->'collections') loop
    if item_name is null or item_name = '' or length(item_name) > 200 then
      raise exception 'Invalid collection name' using errcode = '22023';
    end if;
    insert into public.media_series(name) values(item_name)
      on conflict(name) do update set name=excluded.name returning id into collection_id;
    collection_ids := array_append(collection_ids, collection_id);
    -- 已有成员保留其在系列中的顺序，新增成员默认排在末尾。
    insert into public.media_item_series(media_item_id,series_id,position)
      select item_id,collection_id,coalesce(max(position),0)+1 from public.media_item_series where series_id=collection_id
      on conflict(media_item_id,series_id) do nothing;
  end loop;
  delete from public.media_item_series where media_item_id=item_id and not (series_id=any(collection_ids));
  return item_id;
end $$;
revoke all on function public.manage_save_media(jsonb) from public, anon;
grant execute on function public.manage_save_media(jsonb) to authenticated;
commit;
