-- admin_delete_media：支持专辑原子删除（先删曲目 media_items，再删专辑，同事务）。
-- music.album_id 无 ON DELETE CASCADE，不可只删专辑行。权限／确认标题／security invoker／search_path／grant 保持不变。

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
    or item_type not in ('movie','tv_show','tv_season','tv_episode','book','album','music') then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;

  if item_type = 'album' then
    -- 先删下属曲目（级联清 music 行），再删专辑（级联清 music_albums）。
    delete from public.media_items
      where id in (select m.media_item_id from public.music m where m.album_id = p_id);
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

comment on function public.admin_delete_media(uuid, text) is
  '站长按标题确认删除媒体树；支持 movie／tv_*／book／album／music。专辑同事务删下属曲目。';

revoke all on function public.admin_delete_media(uuid,text) from public, anon;
grant execute on function public.admin_delete_media(uuid,text) to authenticated;
