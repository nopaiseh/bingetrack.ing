begin;

select plan(8);

-- 夹具：冷门年份；事务结束回滚。
insert into public.media_items (id, type, title, release_date, runtime) values
  ('f1000000-0000-4000-8000-000000000010', 'album', '搜索年份专辑 2071', '2071-03-01', null),
  ('f1000000-0000-4000-8000-000000000020', 'music', '专辑内无自身日期', null, 4),
  ('f1000000-0000-4000-8000-000000000021', 'music', '自身日期 2072', '2072-05-01', 3),
  ('f1000000-0000-4000-8000-000000000022', 'music', '想听 2071', '2071-08-01', 2),
  ('f1000000-0000-4000-8000-000000000023', 'music', '无日期无专辑', null, 1);

insert into public.music_albums (media_item_id, track_count, label) values
  ('f1000000-0000-4000-8000-000000000010', 1, 'Fixture');

insert into public.music (media_item_id) values
  ('f1000000-0000-4000-8000-000000000020'),
  ('f1000000-0000-4000-8000-000000000021'),
  ('f1000000-0000-4000-8000-000000000022'),
  ('f1000000-0000-4000-8000-000000000023');
insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('f1000000-0000-4000-8000-000000000010', 'f1000000-0000-4000-8000-000000000020', 1, 1);

insert into public.tracking (media_item_id, status, rating) values
  ('f1000000-0000-4000-8000-000000000020', 'watched', 8),
  ('f1000000-0000-4000-8000-000000000021', 'watched', 7),
  ('f1000000-0000-4000-8000-000000000022', 'want_to_watch', null);

select is(
  (select first_air_date::text from public.v_all_media where id = 'f1000000-0000-4000-8000-000000000020'),
  '2071-03-01',
  'v_all_media music falls back to album release_date for first_air_date'
);

select is(
  (select last_air_date::text from public.v_all_media where id = 'f1000000-0000-4000-8000-000000000020'),
  '2071-03-01',
  'v_all_media music falls back to album release_date for last_air_date'
);

select is(
  (select release_year from public.v_all_media where id = 'f1000000-0000-4000-8000-000000000020'),
  '2071',
  'v_all_media music release_year uses coalesced date'
);

select is(
  (select first_air_date::text from public.v_all_media where id = 'f1000000-0000-4000-8000-000000000021'),
  '2072-05-01',
  'v_all_media music prefers its own release_date over album'
);

select ok(
  (select first_air_date from public.v_all_media where id = 'f1000000-0000-4000-8000-000000000023') is null,
  'v_all_media music with neither date keeps null air dates'
);

-- 年份 + 状态搜索计数 = release_year_stats 曲目列（与公开搜索 PostgREST 筛选同口径）
select is(
  (
    select count(*)::bigint
    from public.v_all_media
    where type = 'music'::public.media_type
      and last_air_date >= '2071-01-01'
      and first_air_date <= '2071-12-31'
  ),
  (select total_tracks from public.release_year_stats where release_year = '2071'),
  'type=music year filter total equals release_year_stats.total_tracks'
);

select is(
  (
    select count(*)::bigint
    from public.v_all_media
    where type = 'music'::public.media_type
      and last_air_date >= '2071-01-01'
      and first_air_date <= '2071-12-31'
      and status = 'watched'
  ),
  (select listened_tracks from public.release_year_stats where release_year = '2071'),
  'type=music year+watched equals release_year_stats.listened_tracks'
);

select is(
  (
    select count(*)::bigint
    from public.v_all_media
    where type = 'music'::public.media_type
      and last_air_date >= '2071-01-01'
      and first_air_date <= '2071-12-31'
      and status = 'want_to_watch'
  ),
  (select want_tracks from public.release_year_stats where release_year = '2071'),
  'type=music year+want_to_watch equals release_year_stats.want_tracks'
);

select * from finish();
rollback;
