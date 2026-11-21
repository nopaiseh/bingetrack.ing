-- 名字检查：人物名允许英文缩写（如 J·K·西蒙斯、O-T·法格本勒）不标 mixed_script；
-- 特殊空格（NBSP 等）先规范化再判 separator / edge_space / double_space，并新增 special_space 标签（U+3000 仍只走 fullwidth）。
-- 合并后自动上 prod：只替换函数，不改数据。

create or replace function public.manage_name_issues(p_name text, p_character boolean) returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select array_remove(array[
    case when n ~ '^\s|\s$' then 'edge_space' end,
    case when n ~ '\s{2,}' then 'double_space' end,
    case when p_name ~ '[​-‏⁠﻿­]|[[:cntrl:]]' then 'invisible_char' end,
    case when p_name ~ '[０-９Ａ-Ｚａ-ｚ　]' then 'fullwidth' end,
    -- U+3000 已由 fullwidth 覆盖，此处不含，避免双重标记。
    case when p_name ~ U&'[\00A0\1680\2000-\200A\202F\205F]' then 'special_space' end,
    case when not p_character and p_name ~ '[()（）\[\]【】]' then 'bracket_note' end,
    case when lower(btrim(p_name)) ~ '^([?？_.。*\-—]+|n/?a|tbd|tba|unknown|none|null|未知|待定|不详|无|暂无)$' then 'placeholder' end,
    case when p_name ~ '^\s*[,，、;；:：/／|｜·.。\-—]|[,，、;；:：/／|｜·\-—]\s*$' then 'edge_punct' end,
    -- 多个角色统一写作「A / B」；特殊空格先换成普通空格；字母/字母（如 UDT/SEAL）先去掉斜杠再判断。
    case when p_character and regexp_replace(n, '([A-Za-z])/([A-Za-z])', '\1\2', 'g') ~ '[^ ]/|/[^ ]|[／、|｜;；]' then 'separator' end,
    -- 仅当某段含拉丁字母且不是「单个大写字母（可带点）用连字符连接」的缩写时，才标中英文混写。
    case when not p_character and p_name ~ '[一-鿿]' and exists (
      select 1
      from regexp_split_to_table(p_name, '[·・•‧]') as seg
      where seg ~ '[A-Za-z]'
        and seg !~ '^[A-Z]\.?(-[A-Z]\.?)*$'
    ) then 'mixed_script' end,
    case when not p_character and p_name ~ '[0-9０-９]' then 'digits' end,
    case when length(p_name) > case when p_character then 100 else 40 end then 'too_long' end
  ], null)
  from (
    select regexp_replace(p_name, U&'[\00A0\1680\2000-\200A\202F\205F\3000]', ' ', 'g') as n
  ) as normalized
$$;

revoke execute on function public.manage_name_issues(text, boolean) from public, anon;
grant execute on function public.manage_name_issues(text, boolean) to authenticated;
