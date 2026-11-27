-- 按 role 过滤 media_credits（如 author／artist 子集）时需要以 role 开头的索引。
-- 现有 media_credits_person_id_role_media_item_id_idx 以 person_id 开头，不能替代。
-- 无其它以 role 开头的复合索引，故新增单列索引。

create index if not exists media_credits_role_idx on public.media_credits (role);
