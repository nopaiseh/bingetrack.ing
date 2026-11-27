begin;

select plan(13);

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

insert into public.music (media_item_id) values
  ('a2000000-0000-4000-8000-000000000002'),
  ('a2000000-0000-4000-8000-000000000003'),
  ('a2000000-0000-4000-8000-000000000004');

insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 1, 1),
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 1, 2),
  ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 1, 3);

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
  public.album_average_rating('a2000000-0000-4000-8000-000000000001'),
  7.0::numeric,
  'album average rating averages rated tracks via album_tracks'
);

select is(
  (select track_total from public.v_continue_listening
   where album_id = 'a2000000-0000-4000-8000-000000000001'),
  3,
  'continue listening sees three tracks'
);

select is(
  (select track_watched from public.v_continue_listening
   where album_id = 'a2000000-0000-4000-8000-000000000001'),
  2,
  'continue listening counts two watched tracks'
);

select ok(
  exists (
    select 1 from public.v_all_media
    where id = 'a2000000-0000-4000-8000-000000000001' and type = 'album'
  ),
  'v_all_media includes album'
);

select * from finish();
rollback;
