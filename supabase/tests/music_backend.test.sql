begin;

select plan(15);

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
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'person_role' and e.enumlabel = 'lyricist'
  ),
  'person_role includes lyricist'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_albums' and column_name = 'track_count'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_albums' and column_name = 'label'
  ),
  'albums have track_count and label'
);

select ok(
  (
    select pg_catalog.col_description('public.music_albums'::regclass, a.attnum)
    from pg_attribute a
    where a.attrelid = 'public.music_albums'::regclass and a.attname = 'artist_id'
  ) ilike '%DEPRECATED%',
  'music_albums.artist_id is marked deprecated'
);

-- 专辑／曲目夹具
insert into public.people (id, name) values
  ('a1000000-0000-4000-8000-000000000001', '测试艺人 A'),
  ('a1000000-0000-4000-8000-000000000002', '测试艺人 B');

insert into public.media_items (id, type, title, release_date) values
  ('a2000000-0000-4000-8000-000000000001', 'album', '去重测试专辑', '2024-01-01'),
  ('a2000000-0000-4000-8000-000000000002', 'music', '去重测试单曲', '2024-01-02'),
  ('a2000000-0000-4000-8000-000000000003', 'music', '另一首歌', '2024-01-03'),
  ('a2000000-0000-4000-8000-000000000004', 'music', '第三首歌', '2024-01-04');

insert into public.music_albums (media_item_id, track_count, label) values
  ('a2000000-0000-4000-8000-000000000001', 3, '测试厂牌');

insert into public.music (media_item_id, track_number, album_id) values
  ('a2000000-0000-4000-8000-000000000002', 1, 'a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000003', 2, 'a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000004', 3, 'a2000000-0000-4000-8000-000000000001');

insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'artist', 0),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'artist', 0),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'artist', 1);

insert into public.tracking (media_item_id, status, rating) values
  ('a2000000-0000-4000-8000-000000000002', 'watched', 8.0),
  ('a2000000-0000-4000-8000-000000000003', 'watched', 6.0);

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
insert into public.music (media_item_id, track_number, album_id) values
  ('a2000000-0000-4000-8000-000000000012', 1, 'a2000000-0000-4000-8000-000000000011'),
  ('a2000000-0000-4000-8000-000000000013', 2, 'a2000000-0000-4000-8000-000000000011');
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

set local role anon;

select ok(
  exists (select 1 from public.search_media('去重测试专辑') where id = 'a2000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.search_media('去重测试单曲') where id = 'a2000000-0000-4000-8000-000000000002')
  and exists (select 1 from public.search_media('测试艺人 A') where type::text in ('album', 'music')),
  'search_media returns albums, tracks, and artist name hits'
);

reset role;

select * from finish();
rollback;
