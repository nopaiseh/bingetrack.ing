-- album_tracks：曲目与专辑多对多；music_albums.release_kind；从 music 回填。
-- 本文件不卸视图／函数、不删 music.album_id／track_number（见 502／503）。
-- 合并后会通过 Supabase GitHub 集成自动上 prod。

-- ---------------------------------------------------------------------------
-- 1) release_kind
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'album_release_kind'
  ) then
    create type public.album_release_kind as enum ('album', 'ep', 'single', 'compilation');
  end if;
end $$;

alter table public.music_albums
  add column if not exists release_kind public.album_release_kind not null default 'album'::public.album_release_kind;

comment on column public.music_albums.release_kind is
  '发行形态：album／ep／single／compilation；默认 album。';

-- ---------------------------------------------------------------------------
-- 2) album_tracks
-- ---------------------------------------------------------------------------
create table public.album_tracks (
  album_id uuid not null,
  song_id uuid not null,
  disc_number integer not null default 1,
  track_number integer not null,
  constraint album_tracks_pkey primary key (album_id, disc_number, track_number),
  constraint album_tracks_album_song_key unique (album_id, song_id),
  constraint album_tracks_disc_number_positive_check check (disc_number >= 1),
  constraint album_tracks_track_number_nonnegative_check check (track_number >= 0),
  constraint album_tracks_album_id_fkey
    foreign key (album_id) references public.music_albums(media_item_id) on delete cascade,
  -- media_items FK：PostgREST embed（media:media_items!album_tracks_song_id_fkey）需要直接关系。
  constraint album_tracks_song_id_fkey
    foreign key (song_id) references public.media_items(id) on delete cascade,
  -- music FK：保证 song_id 一定是曲目扩展行，而不仅是任意 media_items。
  constraint album_tracks_song_id_music_fkey
    foreign key (song_id) references public.music(media_item_id) on delete cascade
);

create index album_tracks_song_id_idx on public.album_tracks using btree (song_id);

comment on table public.album_tracks is
  '专辑曲目关联：同一首歌可出现在多张专辑；盘号＋曲序在专辑内唯一。';

alter table public.album_tracks enable row level security;

grant select on public.album_tracks to anon, authenticated, service_role;
grant insert, update, delete on public.album_tracks to authenticated, service_role;

create policy "Allow SELECT from website" on public.album_tracks
  for select to anon, authenticated using (true);
create policy "Owner insert" on public.album_tracks
  for insert to authenticated with check ((select public.is_site_owner()));
create policy "Owner update" on public.album_tracks
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));
create policy "Owner delete" on public.album_tracks
  for delete to authenticated using ((select public.is_site_owner()));

-- ---------------------------------------------------------------------------
-- 3) 回填前数据校验（有问题则整迁失败，避免脏数据上 prod）
-- ---------------------------------------------------------------------------
do $$
declare
  bad_null integer;
  bad_dup integer;
  bad_album integer;
  bad_type integer;
  sample text;
begin
  select count(*)::integer, string_agg(media_item_id::text, ', ' order by media_item_id)
  into bad_null, sample
  from (
    select media_item_id from public.music
    where album_id is null or track_number is null
    limit 20
  ) s;
  if coalesce(bad_null, 0) > 0 then
    raise exception
      'album_tracks backfill aborted: % music row(s) have null album_id or track_number (e.g. %).',
      bad_null, sample;
  end if;

  select count(*)::integer, string_agg(album_id::text || '#' || track_number::text, ', ' order by album_id, track_number)
  into bad_dup, sample
  from (
    select album_id, track_number
    from public.music
    group by album_id, track_number
    having count(*) > 1
    limit 20
  ) d;
  if coalesce(bad_dup, 0) > 0 then
    raise exception
      'album_tracks backfill aborted: % duplicate (album_id, track_number) group(s) (e.g. %).',
      bad_dup, sample;
  end if;

  select count(*)::integer, string_agg(m.media_item_id::text, ', ' order by m.media_item_id)
  into bad_album, sample
  from (
    select mu.media_item_id
    from public.music mu
    where not exists (
      select 1 from public.music_albums a where a.media_item_id = mu.album_id
    )
    limit 20
  ) m;
  if coalesce(bad_album, 0) > 0 then
    raise exception
      'album_tracks backfill aborted: % music row(s) reference missing albums (e.g. %).',
      bad_album, sample;
  end if;

  select count(*)::integer, string_agg(mu.media_item_id::text, ', ' order by mu.media_item_id)
  into bad_type, sample
  from (
    select mu.media_item_id
    from public.music mu
    join public.media_items mi on mi.id = mu.media_item_id
    where mi.type is distinct from 'music'::public.media_type
    limit 20
  ) mu;
  if coalesce(bad_type, 0) > 0 then
    raise exception
      'album_tracks backfill aborted: % music rows whose media_items.type is not music (e.g. %).',
      bad_type, sample;
  end if;
end $$;

insert into public.album_tracks (album_id, song_id, disc_number, track_number)
select album_id, media_item_id, 1, track_number
from public.music;

-- music.album_id／track_number 仍保留至 20261127150300_drop_legacy.sql；
-- 公开页／搜索／统计仍可用旧对象，直至 502 同事务切换到 album_tracks。

comment on table public.music is
  '曲目扩展表；album_tracks 已回填。所属专辑与曲序列在 drop_legacy 迁移中移除。允许无专辑的独立单曲。';
