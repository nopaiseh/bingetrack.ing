begin;

select plan(26);

select ok(
  exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typname = 'ownership_status'),
  'ownership_status enum exists'
);

select ok(
  to_regclass('public.ownership') is not null,
  'ownership table exists'
);

select ok(
  (select count(*) = 1 from pg_constraint
   where conrelid = 'public.ownership'::regclass and contype = 'u'
     and pg_get_constraintdef(oid) ilike '%media_item_id%'),
  'ownership.media_item_id is unique'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ownership'
      and policyname = 'Allow SELECT from website'
      and roles = array['anon', 'authenticated']::name[]
  ),
  'ownership has public read policy matching tracking'
);

select ok(
  exists (select 1 from public.credit_roles where code = 'lyricist'),
  'credit_roles includes lyricist'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_albums' and column_name = 'track_count'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_albums' and column_name = 'label'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_albums' and column_name = 'release_kind'
  ),
  'albums have track_count, label, release_kind'
);

select ok(
  not exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.music_albums'::regclass
      and a.attname = 'artist_id'
      and not a.attisdropped
  ),
  'music_albums.artist_id column is gone'
);

select ok(
  to_regclass('public.album_tracks') is not null
  and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='music' and column_name in ('album_id','track_number')
  ),
  'album_tracks exists; music.album_id/track_number removed'
);

-- 专辑／曲目夹具（含共享曲：同曲挂两张专辑，各有不同评分）
insert into public.people (id, name) values
  ('a1000000-0000-4000-8000-000000000001', '测试艺人 A'),
  ('a1000000-0000-4000-8000-000000000002', '测试艺人 B');

insert into public.media_items (id, type, title, release_date, cover_url) values
  ('a2000000-0000-4000-8000-000000000001', 'album', '去重测试专辑', '2024-01-01', 'https://example.com/a.jpg'),
  ('a2000000-0000-4000-8000-000000000002', 'music', '去重测试单曲', '2024-01-02', null),
  ('a2000000-0000-4000-8000-000000000003', 'music', '另一首歌', '2024-01-03', null),
  ('a2000000-0000-4000-8000-000000000004', 'music', '第三首歌', '2024-01-04', null),
  ('a2000000-0000-4000-8000-000000000020', 'album', '专辑B仅共享', '2023-06-01', 'https://example.com/b.jpg'),
  ('a2000000-0000-4000-8000-000000000021', 'music', '只在B的歌', null, null);

insert into public.music_albums (media_item_id, track_count, label) values
  ('a2000000-0000-4000-8000-000000000001', 3, '测试厂牌'),
  ('a2000000-0000-4000-8000-000000000020', 2, '厂牌B');

insert into public.music (media_item_id) values
  ('a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000003'),
  ('a2000000-0000-4000-8000-000000000004'),
  ('a2000000-0000-4000-8000-000000000021');

insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 1, 1),
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 1, 2),
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 1, 3),
  -- 共享曲挂在专辑 B；另有只在 B 的歌（评分 9）证明 A 平均不含它
  ('a2000000-0000-4000-8000-000000000020', 'a2000000-0000-4000-8000-000000000002', 1, 1),
  ('a2000000-0000-4000-8000-000000000020', 'a2000000-0000-4000-8000-000000000021', 1, 2);

insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'artist', 0),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'artist', 0),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'artist', 1),
  ('a2000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000001', 'artist', 0),
  ('a2000000-0000-4000-8000-000000000021', 'a1000000-0000-4000-8000-000000000001', 'artist', 0);

insert into public.tracking (media_item_id, status, rating) values
  ('a2000000-0000-4000-8000-000000000002', 'watched', 8.0),
  ('a2000000-0000-4000-8000-000000000003', 'watched', 6.0),
  ('a2000000-0000-4000-8000-000000000021', 'watched', 9.0);

select is(
  public.find_music_by_title_and_artists(
    'album',
    '  去重测试专辑  ',
    array['测试艺人 A']
  ),
  'a2000000-0000-4000-8000-000000000001'::uuid,
  'dedupe finds album by normalized title and artists'
);

select is(
  public.find_music_by_title_and_artists('music', '去重测试单曲', array['测试艺人 B', '测试艺人 A']),
  'a2000000-0000-4000-8000-000000000002'::uuid,
  'dedupe matches artist set regardless of order'
);

select is(
  public.album_average_rating('a2000000-0000-4000-8000-000000000001'),
  7.0::numeric,
  'album rating is live average of rated tracks'
);

select is(
  public.album_average_rating('a2000000-0000-4000-8000-000000000020'),
  8.5::numeric,
  'album B average uses only its own tracks (shared 8 + B-only 9)'
);

select ok(
  exists (
    select 1 from public.v_continue_listening
    where album_id = 'a2000000-0000-4000-8000-000000000001'
      and track_watched = 2
      and track_total = 3
  ),
  'continue listening lists albums with partial watched tracks'
);

select is(
  (select track_total from public.v_continue_listening
   where album_id = 'a2000000-0000-4000-8000-000000000001'),
  3,
  'shared track still counts on album A continue listening totals'
);

-- 专辑 B 两曲皆 watched → 不进 continue listening，但 track 统计仍可通过子查询验证
select is(
  (
    select count(*)::integer
    from public.album_tracks at
    where at.album_id = 'a2000000-0000-4000-8000-000000000020'
  ),
  2,
  'shared track also linked on album B (two album_tracks rows for shared song across albums)'
);

select is(
  (select status from public.v_all_media where id = 'a2000000-0000-4000-8000-000000000001'),
  'watching',
  'album with some watched tracks reports watching (在听)'
);

-- 仅有想听、没有任何听过的专辑：不得标成 watching
insert into public.media_items (id, type, title, release_date) values
  ('a2000000-0000-4000-8000-000000000011', 'album', '只想听专辑', '2024-02-01'),
  ('a2000000-0000-4000-8000-000000000012', 'music', '想听曲 A', '2024-02-02'),
  ('a2000000-0000-4000-8000-000000000013', 'music', '想听曲 B', '2024-02-03');
insert into public.music_albums (media_item_id, track_count) values
  ('a2000000-0000-4000-8000-000000000011', 2);
insert into public.music (media_item_id) values
  ('a2000000-0000-4000-8000-000000000012'),
  ('a2000000-0000-4000-8000-000000000013');
insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('a2000000-0000-4000-8000-000000000011', 'a2000000-0000-4000-8000-000000000012', 1, 1),
  ('a2000000-0000-4000-8000-000000000011', 'a2000000-0000-4000-8000-000000000013', 1, 2);
insert into public.tracking (media_item_id, status, rating) values
  ('a2000000-0000-4000-8000-000000000012', 'want_to_watch', null),
  ('a2000000-0000-4000-8000-000000000013', 'want_to_watch', null);

select is(
  (select status from public.v_all_media where id = 'a2000000-0000-4000-8000-000000000011'),
  'want_to_watch',
  'album with only want_to_watch tracks (no watched) is want_to_watch, not watching'
);

select ok(
  not exists (
    select 1 from public.v_continue_listening
    where album_id = 'a2000000-0000-4000-8000-000000000011'
  ),
  'want-only albums are excluded from continue listening'
);

-- 全部听过 → watched
insert into public.tracking (media_item_id, status, rating) values
  ('a2000000-0000-4000-8000-000000000004', 'watched', 7.0);

select is(
  (select status from public.v_all_media where id = 'a2000000-0000-4000-8000-000000000001'),
  'watched',
  'album with all tracks watched reports watched'
);

-- 多专辑歌：无自身发行日时用最早专辑日；封面回退专辑（按专辑发行日最早优先）
select is(
  (select sort_date from public.v_all_media where id = 'a2000000-0000-4000-8000-000000000021'),
  '2023-06-01'::date,
  'multi-album song without own date sorts by earliest album date'
);

select is(
  (select cover_url from public.v_all_media where id = 'a2000000-0000-4000-8000-000000000002'),
  'https://example.com/b.jpg',
  'song cover falls back to earliest-dated album cover'
);

select ok(
  exists (
    select 1 from public.release_year_stats
    where release_year = '2024'
      and (total_albums > 0 or total_tracks > 0)
  ),
  'shared track / albums participate in release_year_stats'
);

set local role anon;

select ok(
  exists (select 1 from public.search_media('去重测试专辑') where id = 'a2000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.search_media('去重测试单曲') where id = 'a2000000-0000-4000-8000-000000000002')
  and exists (select 1 from public.search_media('测试艺人 A') where type::text in ('album', 'music')),
  'search_media returns albums, tracks, and artist name hits'
);

select lives_ok(
  $$select public.get_person_works('a1000000-0000-4000-8000-000000000001')$$,
  'anon can execute get_person_works'
);

select lives_ok(
  $$select public.get_song_detail('a2000000-0000-4000-8000-000000000002')$$,
  'anon can execute get_song_detail'
);

select throws_ok(
  $$select public.admin_save_media('{"type":"album","title":"x"}'::jsonb)$$,
  '42501',
  null,
  'anon cannot execute admin_save_media'
);

reset role;

select * from finish();
rollback;
