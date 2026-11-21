begin;

select plan(18);

-- 新列存在且类型为 bigint；原有列顺序未变（新列排在末尾）。
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
    'want_tracks'
  ]::text[],
  'release_year_stats keeps legacy columns and appends album/book/track counts'
);

select ok(
  (
    select bool_and(data_type = 'bigint')
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name in (
        'total_albums', 'listened_albums', 'total_books', 'read_books', 'reading_books',
        'want_albums', 'want_books'
      )
  ),
  'new album/book count columns are bigint'
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

-- 记录 All Time 基线，避免与 CI 已载入的 e2e seed 冲突；无行时用零。
create temporary table rys_all_time_before as
select
  coalesce(s.total_movies, 0)::bigint as total_movies,
  coalesce(s.watched_movies, 0)::bigint as watched_movies,
  coalesce(s.unwatched_movies, 0)::bigint as unwatched_movies,
  coalesce(s.total_runtime, 0)::numeric as total_runtime,
  coalesce(s.total_watched_runtime, 0)::numeric as total_watched_runtime,
  coalesce(s.total_unwatched_runtime, 0)::numeric as total_unwatched_runtime,
  coalesce(s.total_albums, 0)::bigint as total_albums,
  coalesce(s.listened_albums, 0)::bigint as listened_albums,
  coalesce(s.total_books, 0)::bigint as total_books,
  coalesce(s.read_books, 0)::bigint as read_books,
  coalesce(s.reading_books, 0)::bigint as reading_books,
  coalesce(s.want_albums, 0)::bigint as want_albums,
  coalesce(s.want_books, 0)::bigint as want_books
from (select 1) as _
left join public.release_year_stats s on s.release_year = 'All Time';

-- 夹具使用冷门年份，年份行可绝对断言；事务结束回滚。
insert into public.media_items (id, type, title, release_date, runtime) values
  ('d1000000-0000-4000-8000-000000000001', 'movie', '统计电影 2091 已看', '2091-06-01', 120),
  ('d1000000-0000-4000-8000-000000000002', 'movie', '统计电影 2092 未看', '2092-03-01', 90),
  ('d1000000-0000-4000-8000-000000000010', 'album', '统计专辑 2091 已听', '2091-01-15', 999),
  ('d1000000-0000-4000-8000-000000000011', 'album', '统计专辑 2092 未听', '2092-02-15', 888),
  ('d1000000-0000-4000-8000-000000000012', 'album', '统计专辑 2092 想听', '2092-05-15', null),
  ('d1000000-0000-4000-8000-000000000013', 'album', '无日期专辑不计', null, 50),
  ('d1000000-0000-4000-8000-000000000020', 'music', '单曲不计 2091', '2091-07-01', 4),
  ('d1000000-0000-4000-8000-000000000021', 'music', '单曲不计 2092', '2092-07-01', 5),
  ('d1000000-0000-4000-8000-000000000030', 'book', '统计图书 2091 已读', '2091-08-01', 300),
  ('d1000000-0000-4000-8000-000000000031', 'book', '统计图书 2092 在读', '2092-04-01', 250),
  ('d1000000-0000-4000-8000-000000000032', 'book', '统计图书 2092 想读', '2092-09-01', null),
  ('d1000000-0000-4000-8000-000000000033', 'book', '统计图书 2092 无 tracking', '2092-10-01', null);

insert into public.tracking (media_item_id, status, rating) values
  ('d1000000-0000-4000-8000-000000000001', 'watched', 8.0),
  ('d1000000-0000-4000-8000-000000000002', 'want_to_watch', null),
  ('d1000000-0000-4000-8000-000000000010', 'watched', 9.0),
  ('d1000000-0000-4000-8000-000000000012', 'want_to_watch', null),
  ('d1000000-0000-4000-8000-000000000020', 'watched', 7.0),
  ('d1000000-0000-4000-8000-000000000030', 'watched', 8.5),
  ('d1000000-0000-4000-8000-000000000031', 'in_progress', null),
  ('d1000000-0000-4000-8000-000000000032', 'want_to_watch', null);
-- 000011（专辑）与 000033（图书）故意无 tracking，视为未完成。

-- 2091：1 专辑已听、1 图书已读；无想听／想读；单曲与无日期不计。
select results_eq(
  $$
    select total_albums, listened_albums, want_albums,
           total_books, read_books, reading_books, want_books
    from public.release_year_stats
    where release_year = '2091'
  $$,
  $$ values (1::bigint, 1::bigint, 0::bigint, 1::bigint, 1::bigint, 0::bigint, 0::bigint) $$,
  '2091 album/book counts'
);

-- 2092：2 专辑（1 无 tracking + 1 想听）、3 图书（1 在读 + 1 想读 + 1 无 tracking）。
select results_eq(
  $$
    select total_albums, listened_albums, want_albums,
           total_books, read_books, reading_books, want_books
    from public.release_year_stats
    where release_year = '2092'
  $$,
  $$ values (2::bigint, 0::bigint, 1::bigint, 3::bigint, 0::bigint, 1::bigint, 1::bigint) $$,
  '2092 album/book counts'
);

-- 电影列与时长：专辑 runtime／单曲／图书不得计入。
select results_eq(
  $$
    select total_movies, watched_movies, unwatched_movies,
           total_movies_runtime, movies_watched_runtime, movies_unwatched_runtime,
           total_runtime, total_watched_runtime, total_unwatched_runtime
    from public.release_year_stats
    where release_year = '2091'
  $$,
  $$ values (
    1::bigint, 1::bigint, 0::bigint,
    120::numeric, 120::numeric, 0::numeric,
    120::numeric, 120::numeric, 0::numeric
  ) $$,
  '2091 movie columns and runtimes ignore album/book/music'
);

select results_eq(
  $$
    select total_movies, watched_movies, unwatched_movies,
           total_movies_runtime, movies_watched_runtime, movies_unwatched_runtime,
           total_runtime, total_watched_runtime, total_unwatched_runtime
    from public.release_year_stats
    where release_year = '2092'
  $$,
  $$ values (
    1::bigint, 0::bigint, 1::bigint,
    90::numeric, 0::numeric, 90::numeric,
    90::numeric, 0::numeric, 90::numeric
  ) $$,
  '2092 movie columns and runtimes ignore album/book/music'
);

-- All Time：相对基线只增加夹具贡献（3 专辑、1 已听、1 想听；4 图书、1 已读、1 在读、1 想读；2 电影、时长 +210）。
select results_eq(
  $$
    select
      (a.total_albums - b.total_albums),
      (a.listened_albums - b.listened_albums),
      (a.want_albums - b.want_albums),
      (a.total_books - b.total_books),
      (a.read_books - b.read_books),
      (a.reading_books - b.reading_books),
      (a.want_books - b.want_books)
    from public.release_year_stats a
    cross join rys_all_time_before b
    where a.release_year = 'All Time'
  $$,
  $$ values (3::bigint, 1::bigint, 1::bigint, 4::bigint, 1::bigint, 1::bigint, 1::bigint) $$,
  'All Time album/book deltas match fixtures'
);

select results_eq(
  $$
    select
      (a.total_movies - b.total_movies),
      (a.watched_movies - b.watched_movies),
      (a.unwatched_movies - b.unwatched_movies),
      (a.total_runtime - b.total_runtime),
      (a.total_watched_runtime - b.total_watched_runtime),
      (a.total_unwatched_runtime - b.total_unwatched_runtime)
    from public.release_year_stats a
    cross join rys_all_time_before b
    where a.release_year = 'All Time'
  $$,
  $$ values (2::bigint, 1::bigint, 1::bigint, 210::numeric, 120::numeric, 90::numeric) $$,
  'All Time movie/runtime deltas exclude album/book/music durations'
);

select is(
  (
    select count(*)::integer
    from public.media_items
    where type = 'music'
      and id in (
        'd1000000-0000-4000-8000-000000000020',
        'd1000000-0000-4000-8000-000000000021'
      )
  ),
  2,
  'fixture singles exist but stay out of album stats'
);

select is(
  (
    select coalesce(sum(total_albums), 0)::bigint
    from public.release_year_stats
    where release_year in ('2091', '2092')
  ),
  3::bigint,
  'year rows sum to three albums; singles and undated album excluded'
);

select is(
  (
    select listened_albums
    from public.release_year_stats
    where release_year = '2091'
  ),
  1::bigint,
  '2091 listened_albums counts watched albums only'
);

select is(
  (
    select reading_books
    from public.release_year_stats
    where release_year = '2092'
  ),
  1::bigint,
  '2092 reading_books counts in_progress only'
);

select is(
  (
    select read_books
    from public.release_year_stats
    where release_year = '2092'
  ),
  0::bigint,
  '2092 has no read books; untracked and want_to_watch are incomplete'
);

select is(
  (
    select total_albums
    from public.release_year_stats
    where release_year = '2092'
  ),
  2::bigint,
  '2092 total_albums includes untracked album as incomplete'
);

select is(
  (
    select want_albums
    from public.release_year_stats
    where release_year = '2092'
  ),
  1::bigint,
  '2092 want_albums counts want_to_watch only; untracked album excluded'
);

select is(
  (
    select want_books
    from public.release_year_stats
    where release_year = '2092'
  ),
  1::bigint,
  '2092 want_books counts want_to_watch only; untracked book excluded'
);

select * from finish();
rollback;
