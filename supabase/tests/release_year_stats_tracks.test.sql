begin;

select plan(15);

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
  'release_year_stats keeps legacy columns and appends track counts'
);

select ok(
  (
    select bool_and(data_type = 'bigint')
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_year_stats'
      and column_name in ('total_tracks', 'listened_tracks', 'want_tracks')
  ),
  'new track count columns are bigint'
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
create temporary table rys_tracks_all_time_before as
select
  coalesce(s.total_tracks, 0)::bigint as total_tracks,
  coalesce(s.listened_tracks, 0)::bigint as listened_tracks,
  coalesce(s.want_tracks, 0)::bigint as want_tracks,
  coalesce(s.total_albums, 0)::bigint as total_albums,
  coalesce(s.total_runtime, 0)::numeric as total_runtime
from (select 1) as _
left join public.release_year_stats s on s.release_year = 'All Time';

-- 夹具使用冷门年份；事务结束回滚。
-- 专辑 2081（其曲目无自身日期 → 回退到专辑年）
-- 曲目：专辑内无日期、独立单曲、自身有日期、想听、无日期且无专辑（不计）、无 tracking
insert into public.media_items (id, type, title, release_date, runtime) values
  ('e1000000-0000-4000-8000-000000000010', 'album', '曲目统计专辑 2081', '2081-03-01', 999),
  ('e1000000-0000-4000-8000-000000000020', 'music', '专辑内曲目无自身日期', null, 4),
  ('e1000000-0000-4000-8000-000000000021', 'music', '独立单曲 2082', '2082-01-10', 3),
  ('e1000000-0000-4000-8000-000000000022', 'music', '曲目自身日期 2083', '2083-06-15', 5),
  ('e1000000-0000-4000-8000-000000000023', 'music', '想听曲目 2082', '2082-08-01', 2),
  ('e1000000-0000-4000-8000-000000000024', 'music', '无日期无专辑不计', null, 1),
  ('e1000000-0000-4000-8000-000000000025', 'music', '无 tracking 曲目 2083', '2083-09-01', 2),
  ('e1000000-0000-4000-8000-000000000026', 'music', '专辑内曲目自身日期 2084', '2084-02-01', 3);

insert into public.music_albums (media_item_id, track_count, label) values
  ('e1000000-0000-4000-8000-000000000010', 2, 'Fixture');

insert into public.music (media_item_id, track_number, album_id) values
  ('e1000000-0000-4000-8000-000000000020', 1, 'e1000000-0000-4000-8000-000000000010'),
  ('e1000000-0000-4000-8000-000000000026', 2, 'e1000000-0000-4000-8000-000000000010'),
  ('e1000000-0000-4000-8000-000000000021', null, null),
  ('e1000000-0000-4000-8000-000000000022', null, null),
  ('e1000000-0000-4000-8000-000000000023', null, null),
  ('e1000000-0000-4000-8000-000000000024', null, null),
  ('e1000000-0000-4000-8000-000000000025', null, null);

insert into public.tracking (media_item_id, status, rating) values
  ('e1000000-0000-4000-8000-000000000020', 'watched', 8.0),
  ('e1000000-0000-4000-8000-000000000021', 'watched', 7.5),
  ('e1000000-0000-4000-8000-000000000022', 'watched', 9.0),
  ('e1000000-0000-4000-8000-000000000023', 'want_to_watch', null),
  ('e1000000-0000-4000-8000-000000000026', 'watched', 8.5);
-- 000025 故意无 tracking；000024 无可用年份。

-- 2081：专辑内曲目回退到专辑年；已听。
select results_eq(
  $$
    select total_tracks, listened_tracks, want_tracks
    from public.release_year_stats
    where release_year = '2081'
  $$,
  $$ values (1::bigint, 1::bigint, 0::bigint) $$,
  '2081 album-track falls back to album year'
);

-- 2082：独立单曲 + 想听。
select results_eq(
  $$
    select total_tracks, listened_tracks, want_tracks
    from public.release_year_stats
    where release_year = '2082'
  $$,
  $$ values (2::bigint, 1::bigint, 1::bigint) $$,
  '2082 standalone single and want_to_watch'
);

-- 2083：自身有日期的已听 + 无 tracking（计入 total，不算 want）。
select results_eq(
  $$
    select total_tracks, listened_tracks, want_tracks
    from public.release_year_stats
    where release_year = '2083'
  $$,
  $$ values (2::bigint, 1::bigint, 0::bigint) $$,
  '2083 own-date track and untracked incomplete'
);

-- 2084：专辑内曲目自身日期优先于专辑年。
select results_eq(
  $$
    select total_tracks, listened_tracks, want_tracks
    from public.release_year_stats
    where release_year = '2084'
  $$,
  $$ values (1::bigint, 1::bigint, 0::bigint) $$,
  '2084 album-track own date wins over album year'
);

-- 曲目 runtime 不得计入总时长；专辑计数仍独立。
select results_eq(
  $$
    select coalesce(total_runtime, 0), coalesce(total_albums, 0)
    from public.release_year_stats
    where release_year = '2081'
  $$,
  $$ values (0::numeric, 1::bigint) $$,
  '2081 track runtime ignored; album still counted separately'
);

select is(
  (
    select count(*)::integer
    from public.release_year_stats
    where release_year in ('2081', '2082', '2083', '2084')
      and total_tracks > 0
  ),
  4,
  'dated track years appear; undated orphan song excluded'
);

select is(
  (
    select coalesce(sum(total_tracks), 0)::bigint
    from public.release_year_stats
    where release_year in ('2081', '2082', '2083', '2084')
  ),
  6::bigint,
  'year rows sum to six countable tracks'
);

select is(
  (
    select want_tracks
    from public.release_year_stats
    where release_year = '2083'
  ),
  0::bigint,
  '2083 want_tracks excludes untracked song'
);

-- All Time：相对基线只增加夹具贡献（6 曲目、4 已听、1 想听）。
select results_eq(
  $$
    select
      (a.total_tracks - b.total_tracks),
      (a.listened_tracks - b.listened_tracks),
      (a.want_tracks - b.want_tracks)
    from public.release_year_stats a
    cross join rys_tracks_all_time_before b
    where a.release_year = 'All Time'
  $$,
  $$ values (6::bigint, 4::bigint, 1::bigint) $$,
  'All Time track deltas match fixtures'
);

select results_eq(
  $$
    select (a.total_runtime - b.total_runtime)
    from public.release_year_stats a
    cross join rys_tracks_all_time_before b
    where a.release_year = 'All Time'
  $$,
  $$ values (0::numeric) $$,
  'All Time runtime unchanged by track fixtures'
);

select * from finish();
rollback;
