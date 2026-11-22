begin;

select plan(8);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'album_avg_rating'
      and data_type = 'numeric'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'book_avg_rating'
      and data_type = 'numeric'
  ),
  'album_avg_rating and book_avg_rating are numeric columns'
);

select ok(
  (
    select ordinal_position
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'album_avg_rating'
  ) = (
    select ordinal_position + 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'want_tracks'
  )
  and (
    select ordinal_position
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'book_avg_rating'
  ) = (
    select ordinal_position + 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name = 'album_avg_rating'
  ),
  'rating columns are appended after want_tracks'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'release_year_stats'
      and c.relkind = 'v'
      and coalesce(
        (select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'),
        'false'
      ) = 'true'
  ),
  'release_year_stats keeps security_invoker'
);

select ok(
  has_table_privilege('anon', 'public.release_year_stats', 'SELECT')
    and has_table_privilege('authenticated', 'public.release_year_stats', 'SELECT'),
  'public roles can still select release_year_stats'
);

-- 冷门年份夹具；事务结束回滚。
insert into public.media_items (id, type, title, release_date) values
  ('f1000000-0000-4000-8000-000000000001', 'album', '评分专辑 2083 A', '2083-01-10'),
  ('f1000000-0000-4000-8000-000000000002', 'album', '评分专辑 2083 B', '2083-02-10'),
  ('f1000000-0000-4000-8000-000000000003', 'album', '评分专辑 2083 想听不计', '2083-03-10'),
  ('f1000000-0000-4000-8000-000000000010', 'music', '评分单曲不计 2083', '2083-04-10'),
  ('f1000000-0000-4000-8000-000000000020', 'book', '评分图书 2083 A', '2083-05-10'),
  ('f1000000-0000-4000-8000-000000000021', 'book', '评分图书 2083 B', '2083-06-10'),
  ('f1000000-0000-4000-8000-000000000022', 'book', '评分图书 2083 在读不计', '2083-07-10'),
  ('f1000000-0000-4000-8000-000000000030', 'album', '评分专辑 2084 已听', '2084-01-01'),
  ('f1000000-0000-4000-8000-000000000031', 'book', '评分图书 2084 无评分', '2084-02-01');

insert into public.music_albums (media_item_id) values
  ('f1000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000003'),
  ('f1000000-0000-4000-8000-000000000030');

insert into public.music (media_item_id, album_id, track_number) values
  ('f1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000001', 1);

insert into public.books (media_item_id) values
  ('f1000000-0000-4000-8000-000000000020'),
  ('f1000000-0000-4000-8000-000000000021'),
  ('f1000000-0000-4000-8000-000000000022'),
  ('f1000000-0000-4000-8000-000000000031');

insert into public.tracking (media_item_id, status, rating) values
  ('f1000000-0000-4000-8000-000000000001', 'watched', 8.0),
  ('f1000000-0000-4000-8000-000000000002', 'watched', 9.0),
  ('f1000000-0000-4000-8000-000000000003', 'want_to_watch', 1.0),
  ('f1000000-0000-4000-8000-000000000010', 'watched', 2.0),
  ('f1000000-0000-4000-8000-000000000020', 'watched', 7.0),
  ('f1000000-0000-4000-8000-000000000021', 'watched', 8.0),
  ('f1000000-0000-4000-8000-000000000022', 'in_progress', 3.0),
  ('f1000000-0000-4000-8000-000000000030', 'watched', 6.5),
  ('f1000000-0000-4000-8000-000000000031', 'watched', null);

-- 2083：专辑 (8+9)/2=8.5；图书 (7+8)/2=7.5；想听／在读／单曲评分不计。
select is(
  (select album_avg_rating from public.release_year_stats where release_year = '2083'),
  8.5,
  '2083 album_avg_rating averages listened albums only'
);

select is(
  (select book_avg_rating from public.release_year_stats where release_year = '2083'),
  7.5,
  '2083 book_avg_rating averages read books only'
);

select is(
  (select album_avg_rating from public.release_year_stats where release_year = '2084'),
  6.5,
  '2084 album_avg_rating for single listened album'
);

select ok(
  (select book_avg_rating from public.release_year_stats where release_year = '2084') is null,
  '2084 book_avg_rating is null when read book has no rating'
);

select * from finish();

rollback;
