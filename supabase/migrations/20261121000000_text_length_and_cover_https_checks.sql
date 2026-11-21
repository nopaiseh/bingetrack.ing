-- DB-level CHECK backstops for app-only validation of synopsis/alias length and cover HTTPS.
-- Limits match lib/admin/media-form.ts and app/(admin)/manage/reference-actions.ts exactly.
-- Never mutates existing rows; fails with table/column/count if any violating data exists.

-- ---------------------------------------------------------------------------
-- 1) media_items.summary ≤ 20000（简介）
--    Source: lib/admin/media-form.ts string("summary", 20000) + string() max check
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*)::integer into bad_count
  from public.media_items
  where summary is not null and length(summary) > 20000;

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot add media_items.summary length check (≤20000): % row(s) violate it. Fix those summaries before applying this migration.',
      bad_count;
  end if;
end $$;

alter table public.media_items
  add constraint media_items_summary_length_check
  check (summary is null or length(summary) <= 20000);

comment on constraint media_items_summary_length_check on public.media_items is
  '简介最多 20000 字；与 parseMediaForm string("summary", 20000) 一致。';

-- ---------------------------------------------------------------------------
-- 2) media_items.alternate_title ≤ 300（别名／副标题）
--    Source: lib/admin/media-form.ts string("alternate_title") with default max = 300
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*)::integer into bad_count
  from public.media_items
  where alternate_title is not null and length(alternate_title) > 300;

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot add media_items.alternate_title length check (≤300): % row(s) violate it. Fix those alternate_title values before applying this migration.',
      bad_count;
  end if;
end $$;

alter table public.media_items
  add constraint media_items_alternate_title_length_check
  check (alternate_title is null or length(alternate_title) <= 300);

comment on constraint media_items_alternate_title_length_check on public.media_items is
  '别名／副标题最多 300 字；与 parseMediaForm string() 默认上限一致。';

-- ---------------------------------------------------------------------------
-- 3) media_items.cover_url must be https（可空）
--    Source: lib/admin/media-form.ts assertCoverUrl — url.protocol !== "https:"
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*)::integer into bad_count
  from public.media_items
  where cover_url is not null and cover_url !~* '^https://';

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot add media_items.cover_url https check: % row(s) violate it. Fix those cover_url values before applying this migration.',
      bad_count;
  end if;
end $$;

alter table public.media_items
  add constraint media_items_cover_url_https_check
  check (cover_url is null or cover_url ~* '^https://');

comment on constraint media_items_cover_url_https_check on public.media_items is
  '封面须为 HTTPS 地址或空（大小写不敏感）；与 new URL() 规范化后的 protocol === https: 一致。';

-- ---------------------------------------------------------------------------
-- 4) people.alternate_name ≤ 300（人物别名）
--    Source: app/(admin)/manage/reference-actions.ts alternate.length > 300
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*)::integer into bad_count
  from public.people
  where alternate_name is not null and length(alternate_name) > 300;

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot add people.alternate_name length check (≤300): % row(s) violate it. Fix those alternate_name values before applying this migration.',
      bad_count;
  end if;
end $$;

alter table public.people
  add constraint people_alternate_name_length_check
  check (alternate_name is null or length(alternate_name) <= 300);

comment on constraint people_alternate_name_length_check on public.people is
  '人物别名最多 300 字；与 saveReference 校验一致。';

-- ---------------------------------------------------------------------------
-- 5) media_series.alternate_name ≤ 300（系列别名）
--    Source: app/(admin)/manage/reference-actions.ts alternate.length > 300
--            （collections → media_series，config.alternate = true）
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*)::integer into bad_count
  from public.media_series
  where alternate_name is not null and length(alternate_name) > 300;

  if coalesce(bad_count, 0) > 0 then
    raise exception
      'Cannot add media_series.alternate_name length check (≤300): % row(s) violate it. Fix those alternate_name values before applying this migration.',
      bad_count;
  end if;
end $$;

alter table public.media_series
  add constraint media_series_alternate_name_length_check
  check (alternate_name is null or length(alternate_name) <= 300);

comment on constraint media_series_alternate_name_length_check on public.media_series is
  '系列别名最多 300 字；与 saveReference 校验一致。';
