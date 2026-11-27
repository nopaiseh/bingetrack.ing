-- 首页即将上映：按 type 等值 + release_date 范围过滤，再按 release_date、id 升序取 limit。
-- 现有 idx_media_items_type 与 idx_media_items_release_date（DESC）是单列，无法一次覆盖
-- equality + range + ORDER BY + LIMIT；本复合索引与单集查询（及电影分支经视图下推后的
-- type/release_date 过滤）对齐，避免超时前的顺序扫描。

create index if not exists idx_media_items_type_release_date_id
  on public.media_items using btree (type, release_date asc, id asc);
