begin;

select plan(8);

-- 新列存在、类型与顺序：album_avg_rating／book_avg_rating 排在末尾。
select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'release_year_stats'
  ),
  array[
    'release_year',
    'total_runtime',
    'total_watched_runtime',
    'total_unwatched_runtime',
    'total_movies',
    'watched_movies',
    'unwatched_movies',
    'total_movies_runtime',
    'movies_watched_runtime',
    'movies_unwatched_runtime',
    'movie_avg_rating',
    'total_series',
    'watched_series',
    'watching_series',
    'unwatched_series',
    'total_series_runtime',
    'series_watched_runtime',
    'series_unwatched_runtime',
    'series_avg_rating',
    'total_seasons',
    'watched_seasons',
    'watching_seasons',
    'unwatched_seasons',
    'total_series_episodes',
    'watched_series_episodes',
    'unwatched_episodes',
    'total_albums',
    'listened_albums',
    'total_books',
    'read_books',
    'reading_books',
    'want_albums',
    'want_books',
    'total_tracks',
    'listened_tracks',
    'want_tracks',
    'album_avg_rating',
    'book_avg_rating'
  ]::text[],
  'release_year_stats keeps legacy columns and appends album/book avg ratings'
);

select ok(
  (
    select bool_and(data_type = 'numeric')
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name in ('album_avg_rating', 'book_avg_rating')
  ),
  'album_avg_rating and book_avg_rating are numeric'
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

-- 冷门年份夹具；专辑评分来自下属曲目（全部 watched 才计入 listened／avg）。
insert into public.media_items (id, type, title, release_date) values
  ('f1000000-0000-4000-8000-000000000001', 'album', '评分专辑 2083 A', '2083-01-10'),
  ('f1000000-0000-4000-8000-000000000002', 'album', '评分专辑 2083 B', '2083-02-10'),
  ('f1000000-0000-4000-8000-000000000003', 'album', '评分专辑 2083 想听不计', '2083-03-10'),
  ('f1000000-0000-4000-8000-000000000010', 'music', '评分单曲不计 2083', '2083-04-10'),
  ('f1000000-0000-4000-8000-000000000011', 'music', '评分专辑A曲目', null),
  ('f1000000-0000-4000-8000-000000000012', 'music', '评分专辑B曲目', null),
  ('f1000000-0000-4000-8000-000000000013', 'music', '评分专辑想听曲目', null),
  ('f1000000-0000-4000-8000-000000000020', 'book', '评分图书 2083 A', '2083-05-10'),
  ('f1000000-0000-4000-8000-000000000021', 'book', '评分图书 2083 B', '2083-06-10'),
  ('f1000000-0000-4000-8000-000000000022', 'book', '评分图书 2083 在读不计', '2083-07-10'),
  ('f1000000-0000-4000-8000-000000000030', 'album', '评分专辑 2084 已听', '2084-01-01'),
  ('f1000000-0000-4000-8000-000000000031', 'book', '评分图书 2084 无评分', '2084-02-01'),
  ('f1000000-0000-4000-8000-000000000032', 'music', '评分专辑2084曲目', null);

insert into public.music_albums (media_item_id) values
  ('f1000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000003'),
  ('f1000000-0000-4000-8000-000000000030');

insert into public.music (media_item_id) values
  ('f1000000-0000-4000-8000-000000000010'),
  ('f1000000-0000-4000-8000-000000000011'),
  ('f1000000-0000-4000-8000-000000000012'),
  ('f1000000-0000-4000-8000-000000000013'),
  ('f1000000-0000-4000-8000-000000000032');

insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011', 1, 1),
  ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000012', 1, 1),
  ('f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000013', 1, 1),
  ('f1000000-0000-4000-8000-000000000030', 'f1000000-0000-4000-8000-000000000032', 1, 1);

insert into public.books (media_item_id) values
  ('f1000000-0000-4000-8000-000000000020'),
  ('f1000000-0000-4000-8000-000000000021'),
  ('f1000000-0000-4000-8000-000000000022'),
  ('f1000000-0000-4000-8000-000000000031');

insert into public.tracking (media_item_id, status, rating) values
  ('f1000000-0000-4000-8000-000000000011', 'watched', 8.0),
  ('f1000000-0000-4000-8000-000000000012', 'watched', 9.0),
  ('f1000000-0000-4000-8000-000000000013', 'want_to_watch', 1.0),
  ('f1000000-0000-4000-8000-000000000010', 'watched', 2.0),
  ('f1000000-0000-4000-8000-000000000020', 'watched', 7.0),
  ('f1000000-0000-4000-8000-000000000021', 'watched', 8.0),
  ('f1000000-0000-4000-8000-000000000022', 'in_progress', 3.0),
  ('f1000000-0000-4000-8000-000000000032', 'watched', 6.5),
  ('f1000000-0000-4000-8000-000000000031', 'watched', null);

-- 2083：专辑 (8+9)/2=8.5（曲目评分）；图书 (7+8)/2=7.5；想听／在读／独立单曲评分不计。
select is(
  (select album_avg_rating from public.release_year_stats where release_year = '2083'),
  8.5,
  '2083 album_avg_rating averages listened albums from track ratings'
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
