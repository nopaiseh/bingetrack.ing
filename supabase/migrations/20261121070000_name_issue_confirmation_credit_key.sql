-- 疑似名字「确认无误」跟进（#230 架构评审）：
-- 1. credit 确认键纳入角色名，避免同一演员同一作品多个角色共用一行、互相覆盖。
-- 2. 拆出 person_id / media_item_id / character_name / credit_role，并加 FK ON DELETE CASCADE，
--    作品或人物删除时确认行随之清除；同时清理既有孤儿行。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

-- 与视图 / 应用共用的 item_id 构造：角色名用 hex，避免「:」与大小写问题。
create or replace function public.manage_name_issue_people_item_id(p_person uuid)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'people:' || p_person::text;
$$;

create or replace function public.manage_name_issue_credit_item_id(p_media uuid, p_person uuid, p_character text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 'credit:' || p_media::text || ':' || p_person::text || ':' || encode(convert_to(p_character, 'UTF8'), 'hex');
$$;

revoke execute on function public.manage_name_issue_people_item_id(uuid) from public, anon;
revoke execute on function public.manage_name_issue_credit_item_id(uuid, uuid, text) from public, anon;
grant execute on function public.manage_name_issue_people_item_id(uuid) to authenticated;
grant execute on function public.manage_name_issue_credit_item_id(uuid, uuid, text) to authenticated;

alter table public.name_issue_confirmations
  add column if not exists person_id uuid,
  add column if not exists media_item_id uuid,
  add column if not exists character_name text,
  add column if not exists credit_role public.person_role;

-- 回填人物确认：people:<uuid>
update public.name_issue_confirmations
set person_id = substr(item_id, 8)::uuid
where item_id ~* '^people:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and person_id is null;

-- 回填演职确认：旧键 credit:<work>:<person> → 取该作品该演员唯一的 actor 行角色名，写入新键。
-- 每位演员在同一作品同一职务只有一行（media_credits 主键），故可安全 1:1 映射；无匹配行视为孤儿，稍后删除。
update public.name_issue_confirmations as c
set
  media_item_id = mc.media_item_id,
  person_id = mc.person_id,
  character_name = mc.character_name,
  credit_role = mc.role,
  item_id = public.manage_name_issue_credit_item_id(mc.media_item_id, mc.person_id, mc.character_name)
from public.media_credits as mc
where c.item_id ~* '^credit:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and mc.media_item_id = split_part(c.item_id, ':', 2)::uuid
  and mc.person_id = split_part(c.item_id, ':', 3)::uuid
  and mc.role = 'actor'::public.person_role
  and mc.character_name is not null;

-- 一次性清理孤儿：人物/作品已不存在，或旧 credit 键找不到对应演职行，或列未填全。
delete from public.name_issue_confirmations c
where c.person_id is null
  or not exists (select 1 from public.people p where p.id = c.person_id)
  or (
    c.item_id like 'credit:%'
    and (
      c.media_item_id is null
      or c.character_name is null
      or c.credit_role is null
      or not exists (select 1 from public.media_items m where m.id = c.media_item_id)
      or not exists (
        select 1
        from public.media_credits mc
        where mc.media_item_id = c.media_item_id
          and mc.person_id = c.person_id
          and mc.role = c.credit_role
      )
    )
  );

alter table public.name_issue_confirmations
  alter column person_id set not null;

alter table public.name_issue_confirmations
  drop constraint if exists name_issue_confirmations_shape_check;
alter table public.name_issue_confirmations
  add constraint name_issue_confirmations_shape_check check (
    (media_item_id is null and character_name is null and credit_role is null)
    or (media_item_id is not null and character_name is not null and credit_role is not null)
  );

alter table public.name_issue_confirmations
  drop constraint if exists name_issue_confirmations_person_id_fkey;
alter table public.name_issue_confirmations
  add constraint name_issue_confirmations_person_id_fkey
  foreign key (person_id) references public.people (id) on delete cascade;

alter table public.name_issue_confirmations
  drop constraint if exists name_issue_confirmations_media_item_id_fkey;
alter table public.name_issue_confirmations
  add constraint name_issue_confirmations_media_item_id_fkey
  foreign key (media_item_id) references public.media_items (id) on delete cascade;

-- MATCH SIMPLE：人物确认行的 media/role 为 null 时不校验；演职确认行引用 media_credits，删除演职即级联清除。
alter table public.name_issue_confirmations
  drop constraint if exists name_issue_confirmations_media_credit_fkey;
alter table public.name_issue_confirmations
  add constraint name_issue_confirmations_media_credit_fkey
  foreign key (media_item_id, person_id, credit_role)
  references public.media_credits (media_item_id, person_id, role)
  on delete cascade;

create index if not exists name_issue_confirmations_media_item_id_idx
  on public.name_issue_confirmations using btree (media_item_id)
  where media_item_id is not null;

-- 应用仍只写 item_id；插入/更新时从 item_id 同步结构化列，保证 FK 生效。
create or replace function public.name_issue_confirmations_sync_keys()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  media_text text;
  person_text text;
  character_hex text;
begin
  if new.item_id ~* '^people:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.person_id := substr(new.item_id, 8)::uuid;
    new.media_item_id := null;
    new.character_name := null;
    new.credit_role := null;
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
    new.credit_role := 'actor'::public.person_role;
    new.item_id := public.manage_name_issue_credit_item_id(new.media_item_id, new.person_id, new.character_name);
    return new;
  end if;

  raise exception 'invalid name_issue_confirmations.item_id' using errcode = '22023';
end;
$$;

drop trigger if exists name_issue_confirmations_sync_keys on public.name_issue_confirmations;
create trigger name_issue_confirmations_sync_keys
  before insert or update of item_id on public.name_issue_confirmations
  for each row
  execute function public.name_issue_confirmations_sync_keys();

revoke all on function public.name_issue_confirmations_sync_keys() from public, anon, authenticated;

-- 重建报告视图：credit 行 id 含角色名；排除确认时用结构化列匹配。
create or replace view public.v_report_suspicious_names
with (security_invoker = true) as
select public.manage_name_issue_people_item_id(p.id) as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  nullif(btrim(p.alternate_name), '') as detail,
  public.manage_name_issues(p.name, false) as tags, 0 as weight, p.name as sort_key
from public.people p
where cardinality(public.manage_name_issues(p.name, false)) > 0
  and not exists (
    select 1 from public.name_issue_confirmations c
    where c.person_id = p.id
      and c.media_item_id is null
      and c.confirmed_name = p.name
  )
union all
select public.manage_name_issue_credit_item_id(mc.media_item_id, mc.person_id, mc.character_name), c.type::text, c.id, mc.character_name,
  coalesce(c.context || ' · ', '') || c.title || ' · ' || p.name || ' 饰',
  public.manage_name_issues(mc.character_name, true)
    || case when public.manage_name_key(mc.character_name) = public.manage_name_key(p.name) then array['same_as_actor'] else '{}'::text[] end,
  0, mc.character_name
from public.media_credits mc
join public.people p on p.id = mc.person_id
join public.v_report_media_context c on c.id = mc.media_item_id
where mc.character_name is not null
  and (cardinality(public.manage_name_issues(mc.character_name, true)) > 0
    or public.manage_name_key(mc.character_name) = public.manage_name_key(p.name))
  and not exists (
    select 1 from public.name_issue_confirmations conf
    where conf.media_item_id = mc.media_item_id
      and conf.person_id = mc.person_id
      and conf.character_name = mc.character_name
      and conf.confirmed_name = mc.character_name
  );

revoke all on public.v_report_suspicious_names from public, anon, authenticated;
grant select on public.v_report_suspicious_names to authenticated;
