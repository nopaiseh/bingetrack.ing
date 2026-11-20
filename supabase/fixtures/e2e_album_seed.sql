-- 专辑／曲目夹具：在生产构建之后载入，使 /albums 目录 ISR 仍烘焙「还没有专辑。」空状态，
-- 同时详情页（按需生成）能读到固定曲目数据。仅供本地与 CI，不要导入线上项目。

begin;

insert into public.media_items (
  id, type, title, alternate_title, summary, cover_url, release_date, runtime
) values
  ('50000000-0000-4000-8000-000000000020', 'album', '测试专辑：夜航电台', 'Fixture Album', '用于端到端测试的虚构专辑。', null, '2024-05-20', null),
  ('50000000-0000-4000-8000-000000000021', 'music', '夜航序曲', 'Night Overture', '专辑第一首测试曲目。', null, '2024-05-20', 210),
  ('50000000-0000-4000-8000-000000000022', 'music', '回港信号', 'Harbor Signal', '专辑第二首测试曲目。', null, '2024-05-20', 185)
on conflict (id) do nothing;

insert into public.music_albums (media_item_id, track_count, label) values
  ('50000000-0000-4000-8000-000000000020', 2, '测试厂牌')
on conflict (media_item_id) do nothing;

insert into public.music (media_item_id, track_number, album_id) values
  ('50000000-0000-4000-8000-000000000021', 1, '50000000-0000-4000-8000-000000000020'),
  ('50000000-0000-4000-8000-000000000022', 2, '50000000-0000-4000-8000-000000000020')
on conflict (media_item_id) do nothing;

insert into public.tracking (id, media_item_id, status, rating) values
  ('60000000-0000-4000-8000-000000000021', '50000000-0000-4000-8000-000000000021', 'watched', 8.5),
  ('60000000-0000-4000-8000-000000000022', '50000000-0000-4000-8000-000000000022', 'want_to_watch', null)
on conflict (id) do nothing;

insert into public.ownership (media_item_id, status) values
  ('50000000-0000-4000-8000-000000000020', 'owned')
on conflict (media_item_id) do nothing;

insert into public.media_genres (media_item_id, genre_id) values
  ('50000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000002')
on conflict (media_item_id, genre_id) do nothing;

insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('50000000-0000-4000-8000-000000000020', '40000000-0000-4000-8000-000000000004', 'artist', 0),
  ('50000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000004', 'artist', 0),
  ('50000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000005', 'lyricist', 0),
  ('50000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000006', 'composer', 0),
  ('50000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000004', 'artist', 0)
on conflict (media_item_id, person_id, role) do nothing;

commit;
