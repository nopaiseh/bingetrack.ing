-- 疑似重复人物的两种处理：
-- 1. 合并：把一个或多个人物的演职关联并入保留的人物，再删除他们（原子执行）。
-- 2. 标记「不是同一人」：记录这一对人物，之后不再出现在报告中；任一人物被删除时记录随之清除。

create table public.people_distinct_pairs (
  person_a uuid not null references public.people(id) on delete cascade,
  person_b uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_a, person_b),
  constraint people_distinct_pairs_order_check check (person_a < person_b)
);
create index people_distinct_pairs_person_b_idx on public.people_distinct_pairs using btree (person_b);

alter table public.people_distinct_pairs enable row level security;
revoke all on public.people_distinct_pairs from public, anon, authenticated;
grant select, insert, delete on public.people_distinct_pairs to authenticated;
create policy "Owner select" on public.people_distinct_pairs for select to authenticated using ((select public.is_site_owner()));
create policy "Owner insert" on public.people_distinct_pairs for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner delete" on public.people_distinct_pairs for delete to authenticated using ((select public.is_site_owner()));

-- 报告改为逐对判断：写法相同，且名字不同或至少一方未填别名，且未标记为不是同一人。
-- 同名但别名各异的仍不列出。末尾新增 group_key，供报告页按组显示。
create or replace view public.v_report_similar_people
with (security_invoker = true) as
with keyed as (
  select p.id, p.name, p.alternate_name, public.manage_name_key(p.name) as name_key
  from public.people p
), pairs as (
  select a.id, o.id as other_id, o.name as other_name, o.alternate_name as other_alternate_name
  from keyed a
  join keyed o on o.name_key = a.name_key and o.id <> a.id
  where a.name_key <> ''
    and (a.name <> o.name or coalesce(btrim(a.alternate_name), '') = '' or coalesce(btrim(o.alternate_name), '') = '')
    and not exists (
      select 1 from public.people_distinct_pairs d
      where d.person_a = least(a.id, o.id) and d.person_b = greatest(a.id, o.id)
    )
)
select k.id::text as id, 'people'::text as link_type, k.id as link_id, k.name as title,
  coalesce(nullif(btrim(k.alternate_name), ''), '未填别名') as detail,
  array(
    select p.other_name || coalesce('（' || nullif(btrim(p.other_alternate_name), '') || '）', '')
    from pairs p where p.id = k.id order by p.other_name, p.other_id
  ) as tags,
  0 as weight, k.name_key || ' ' || k.name as sort_key,
  k.name_key as group_key
from keyed k
where exists (select 1 from pairs p where p.id = k.id);

-- 合并人物：演职关联并入保留的人物，同一作品同一职务已存在时保留原记录，只补上缺少的角色名、取较前的番位。
-- 保留的人物没有别名时沿用被合并者的别名。被合并者仍是专辑艺术家时拒绝合并（专辑不在管理范围内）。
create function public.manage_merge_people(p_keep uuid, p_remove uuid[]) returns integer
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
  if exists (select 1 from public.music_albums a where a.artist_id = any(p_remove)) then
    raise exception 'Person is still an album artist' using errcode = '23503';
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
