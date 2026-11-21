-- 角色名里常见的括号备注（别名、声、客串、年份等）不再标为 bracket_note；人物名仍检查括号。
-- 其余规则与签名不变；CREATE OR REPLACE 后重申权限，避免 PUBLIC 默认可执行。

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
    -- 多个角色统一写作「A / B」。
    case when p_character and p_name ~ '[^ ]/|/[^ ]|[／、|｜;；]' then 'separator' end,
    case when not p_character and p_name ~ '[一-鿿]' and p_name ~ '[A-Za-z]' then 'mixed_script' end,
    case when not p_character and p_name ~ '[0-9０-９]' then 'digits' end,
    case when length(p_name) > case when p_character then 100 else 40 end then 'too_long' end
  ], null)
$$;

revoke execute on function public.manage_name_issues(text, boolean) from public, anon;
grant execute on function public.manage_name_issues(text, boolean) to authenticated;
