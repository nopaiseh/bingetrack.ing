-- A. 角色名 separator：斜杠两边都是 ASCII 英文字母时不算多角色（如 UDT/SEAL）。
--    PostgreSQL 正则无前瞻，用捕获组去掉「字母/字母」中的斜杠后再套原正则；全角斜杠等规则不变。
-- B. 「已确认」：记下确认时的名字；视图排除 confirmation 且 confirmed_name = 当前 title 的条目，改名后自动失效。
-- 合并后会自动上 prod：只新增表/替换函数与视图，不改动既有行数据。

create or replace function public.manage_name_issues(p_name text, p_character boolean) returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select array_remove(array[
    case when p_name ~ '^\s|\s$' then 'edge_space' end,
    case when p_name ~ '\s{2,}' then 'double_space' end,
    case when p_name ~ '[​-‏⁠﻿­]|[[:cntrl:]]' then 'invisible_char' end,
    case when p_name ~ '[０-９Ａ-Ｚａ-ｚ　]' then 'fullwidth' end,
    case when not p_character and p_name ~ '[()（）\[\]【】]' then 'bracket_note' end,
    case when lower(btrim(p_name)) ~ '^([?？_.。*\-—]+|n/?a|tbd|tba|unknown|none|null|未知|待定|不详|无|暂无)$' then 'placeholder' end,
    case when p_name ~ '^\s*[,，、;；:：/／|｜·.。\-—]|[,，、;；:：/／|｜·\-—]\s*$' then 'edge_punct' end,
    -- 多个角色统一写作「A / B」；字母/字母（如 UDT/SEAL）先去掉斜杠再判断。
    case when p_character and regexp_replace(p_name, '([A-Za-z])/([A-Za-z])', '\1\2', 'g') ~ '[^ ]/|/[^ ]|[／、|｜;；]' then 'separator' end,
    case when not p_character and p_name ~ '[一-鿿]' and p_name ~ '[A-Za-z]' then 'mixed_script' end,
    case when not p_character and p_name ~ '[0-9０-９]' then 'digits' end,
    case when length(p_name) > case when p_character then 100 else 40 end then 'too_long' end
  ], null)
$$;

revoke execute on function public.manage_name_issues(text, boolean) from public, anon;
grant execute on function public.manage_name_issues(text, boolean) to authenticated;

-- 疑似名字错误的「确认无误」记录；item_id 与 v_report_suspicious_names.id 一致。
create table public.name_issue_confirmations (
  item_id text primary key,
  confirmed_name text not null,
  confirmed_at timestamptz not null default now()
);

-- 权限与 people_distinct_pairs 完全一致（照抄 RLS 策略与 grant）。
alter table public.name_issue_confirmations enable row level security;
revoke all on public.name_issue_confirmations from public, anon, authenticated;
grant select, insert, delete on public.name_issue_confirmations to authenticated;
create policy "Owner select" on public.name_issue_confirmations for select to authenticated using ((select public.is_site_owner()));
create policy "Owner insert" on public.name_issue_confirmations for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner delete" on public.name_issue_confirmations for delete to authenticated using ((select public.is_site_owner()));

-- 重建报告视图：排除已确认且名字未改的条目；列与 security_invoker 保持不变。
create or replace view public.v_report_suspicious_names
with (security_invoker = true) as
select 'people:' || p.id as id, 'people'::text as link_type, p.id as link_id, p.name as title,
  nullif(btrim(p.alternate_name), '') as detail,
  public.manage_name_issues(p.name, false) as tags, 0 as weight, p.name as sort_key
from public.people p
where cardinality(public.manage_name_issues(p.name, false)) > 0
  and not exists (
    select 1 from public.name_issue_confirmations c
    where c.item_id = 'people:' || p.id and c.confirmed_name = p.name
  )
union all
select 'credit:' || mc.media_item_id || ':' || mc.person_id, c.type::text, c.id, mc.character_name,
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
    where conf.item_id = 'credit:' || mc.media_item_id || ':' || mc.person_id
      and conf.confirmed_name = mc.character_name
  );

revoke all on public.v_report_suspicious_names from public, anon, authenticated;
grant select on public.v_report_suspicious_names to authenticated;
