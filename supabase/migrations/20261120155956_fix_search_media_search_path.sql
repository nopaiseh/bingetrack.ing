-- Supabase advisor: function_search_path_mutable
-- 仅 public.search_media 缺固定 search_path（见 20260926000000 为内联故意 reset）。
-- 函数体内对象均已带 public. 前缀；用 ALTER 设 search_path，不改动函数体与权限。
alter function public.search_media(text, text[], boolean, text[]) set search_path = '';
