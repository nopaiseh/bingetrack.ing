begin;
select plan(16);

-- 虚构站长；事务结束回滚。
insert into auth.users(id,email) values
  ('d1000000-0000-4000-8000-000000000001','track-genre-owner@test.invalid');
insert into public.site_owner(user_id) values ('d1000000-0000-4000-8000-000000000001');

create temporary table track_genre_ids (
  name text primary key,
  id uuid not null
) on commit drop;
grant all on track_genre_ids to authenticated;

create function pg_temp.album_payload(title text, genres jsonb default '[]'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','album','title',title,'status','want_to_watch','rating',null,
    'runtime',null,'label','类型测试厂牌','genres',genres,
    'artists',jsonb_build_array(jsonb_build_object('name','类型测试艺人')),
    'collections','[]'::jsonb,
    'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'lyricists','[]'::jsonb,'composers','[]'::jsonb
  );
$$;

create function pg_temp.track_payload(title text, track_no integer, genres jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','music','title',title,'number',track_no,'runtime',180,
    'status','want_to_watch','rating',null,
    'artists',jsonb_build_array(jsonb_build_object('name','类型测试艺人')),
    'lyricists','[]'::jsonb,'composers','[]'::jsonb,
    'genres',genres,'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'collections','[]'::jsonb
  );
$$;

grant execute on function pg_temp.album_payload(text, jsonb) to authenticated;
grant execute on function pg_temp.track_payload(text, integer, jsonb) to authenticated;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true); end $$;

-- 专辑带类型；曲目 0／1／2 个类型均可保存。
select lives_ok(
  $$insert into track_genre_ids(name, id)
    values (
      'album',
      public.admin_save_album_with_tracks(
        pg_temp.album_payload('Track genre album', '["专辑流行"]'::jsonb),
        jsonb_build_array(
          pg_temp.track_payload('Zero genres', 1, '[]'::jsonb),
          pg_temp.track_payload('One genre', 2, '["曲目流行"]'::jsonb),
          pg_temp.track_payload('Two genres', 3, '["曲目流行","曲目说唱"]'::jsonb)
        )
      )
    )$$,
  'album with tracks of 0/1/2 genres saves'
);

select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    join public.music mu on mu.media_item_id = mg.media_item_id
    join public.media_items t on t.id = mu.media_item_id
    where mu.album_id = (select id from track_genre_ids where name = 'album')
      and t.title = 'Zero genres'
  ),
  null,
  'track with 0 genres has no media_genres rows'
);

select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    join public.music mu on mu.media_item_id = mg.media_item_id
    join public.media_items t on t.id = mu.media_item_id
    where mu.album_id = (select id from track_genre_ids where name = 'album')
      and t.title = 'One genre'
  ),
  array['曲目流行'],
  'track with 1 genre persists association'
);

select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    join public.music mu on mu.media_item_id = mg.media_item_id
    join public.media_items t on t.id = mu.media_item_id
    where mu.album_id = (select id from track_genre_ids where name = 'album')
      and t.title = 'Two genres'
  ),
  array['曲目流行','曲目说唱'],
  'track with 2 genres persists associations'
);

-- 专辑类型不受曲目类型影响。
select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    where mg.media_item_id = (select id from track_genre_ids where name = 'album')
  ),
  array['专辑流行'],
  'album genres remain independent of track genres'
);

-- v_all_media 曲目分支可读到类型名。
select ok(
  (
    select genres @> array['曲目流行','曲目说唱']::text[]
    from public.v_all_media
    where title = 'Two genres' and type = 'music'
  ),
  'v_all_media music row exposes track genres'
);

select ok(
  (
    select genres @> array['专辑流行']::text[]
      and not (coalesce(genres, '{}') @> array['曲目说唱']::text[])
    from public.v_all_media
    where id = (select id from track_genre_ids where name = 'album')
  ),
  'v_all_media album genres unaffected by track genres'
);

-- 3 个类型被拒绝。
select throws_ok(
  $$select public.admin_save_media(
      pg_temp.track_payload('Three genres', 4, '["a","b","c"]'::jsonb)
      || jsonb_build_object(
        'parent_id', (select id from track_genre_ids where name = 'album')::text
      )
    )$$,
  '22023',
  null,
  'saving a track with 3 genres is rejected'
);

select is(
  (select count(*)::integer from public.media_items where title = 'Three genres'),
  0,
  'rejected 3-genre track leaves no media row'
);

-- 经 admin_save_album_with_tracks 同样拒绝。
select throws_ok(
  $$select public.admin_save_album_with_tracks(
      pg_temp.album_payload('Reject album'),
      jsonb_build_array(
        pg_temp.track_payload('Ok track', 1, '["x"]'::jsonb),
        pg_temp.track_payload('Bad track', 2, '["a","b","c"]'::jsonb)
      )
    )$$,
  '22023',
  null,
  'album+tracks aborts when a track has 3 genres'
);

select is(
  (select count(*)::integer from public.media_items where title in ('Reject album','Ok track','Bad track')),
  0,
  'failed genre limit aborts whole album+tracks transaction'
);

-- 清空曲目类型后，孤立类型名可被 manage_delete_unused 清理；专辑类型保留。
select lives_ok(
  $$select public.admin_save_media(
      pg_temp.track_payload('Two genres', 3, '[]'::jsonb)
      || jsonb_build_object(
        'id', (select id from public.media_items where title = 'Two genres' and type = 'music')::text,
        'parent_id', (select id from track_genre_ids where name = 'album')::text
      )
    )$$,
  'clearing track genres succeeds'
);

select ok(
  exists (select 1 from public.genres where name = '曲目说唱'),
  'orphan track-only genre remains until cleanup'
);

select lives_ok(
  $$select public.manage_delete_unused('references')$$,
  'owner can delete unused references including orphan genres'
);

select ok(
  not exists (select 1 from public.genres where name = '曲目说唱'),
  'orphan track genre cleaned up by manage_delete_unused'
);

select ok(
  exists (select 1 from public.genres where name = '专辑流行')
  and exists (
    select 1 from public.media_genres mg
    where mg.media_item_id = (select id from track_genre_ids where name = 'album')
  ),
  'album genre survives orphan cleanup'
);

select * from finish();
rollback;
