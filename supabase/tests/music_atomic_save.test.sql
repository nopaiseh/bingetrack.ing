begin;
select plan(18);

-- 虚构站长与外人，事务结束回滚。
insert into auth.users(id,email) values
  ('b1000000-0000-4000-8000-000000000001','music-owner@test.invalid'),
  ('b1000000-0000-4000-8000-000000000002','music-outsider@test.invalid');
insert into public.site_owner(user_id) values ('b1000000-0000-4000-8000-000000000001');

create function pg_temp.album_payload(title text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','album','title',title,'status','want_to_watch','rating',null,
    'runtime',null,'label','测试厂牌','genres','[]'::jsonb,
    'artists',jsonb_build_array('原子艺人'),
    'collections','[]'::jsonb,
    'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'lyricists','[]'::jsonb,'composers','[]'::jsonb
  );
$$;

create function pg_temp.track_payload(title text, track_no integer, runtime numeric)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','music','title',title,'number',track_no,'runtime',runtime,
    'status','want_to_watch','rating',null,
    'artists',jsonb_build_array('原子艺人'),
    'lyricists','[]'::jsonb,'composers','[]'::jsonb,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'collections','[]'::jsonb
  );
$$;

grant execute on function pg_temp.album_payload(text) to authenticated;
grant execute on function pg_temp.track_payload(text, integer, numeric) to authenticated;

select ok(
  not has_function_privilege('anon','public.admin_save_album_with_tracks(jsonb,jsonb)','EXECUTE'),
  'anonymous cannot call admin_save_album_with_tracks'
);
select ok(
  has_function_privilege('authenticated','public.admin_save_album_with_tracks(jsonb,jsonb)','EXECUTE'),
  'authenticated can execute admin_save_album_with_tracks'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.admin_save_album_with_tracks(jsonb,jsonb)'::regprocedure),
  'admin_save_album_with_tracks is security invoker'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.music'::regclass
      and conname = 'music_album_id_track_number_key'
  ),
  'music has unique (album_id, track_number)'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_music_runtime_seconds_check'
  ),
  'media_items has music runtime 1–7200 check'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true); end $$;
select throws_ok(
  $$select public.admin_save_album_with_tracks(pg_temp.album_payload('Unauthorized album'), '[]'::jsonb)$$,
  '42501',
  null,
  'non-owner cannot save album with tracks'
);

do $$ begin perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true); end $$;

-- 原子回滚：第二首曲目 runtime 非法时，专辑也不应留下。
select throws_ok(
  $$select public.admin_save_album_with_tracks(
      pg_temp.album_payload('Rollback album'),
      jsonb_build_array(
        pg_temp.track_payload('Good track', 1, 180),
        pg_temp.track_payload('Bad track', 2, 0)
      )
    )$$,
  '22023',
  null,
  'invalid track runtime aborts the whole album+tracks transaction'
);
select is(
  (select count(*)::integer from public.media_items where title = 'Rollback album'),
  0,
  'failed track save leaves no album row'
);
select is(
  (select count(*)::integer from public.media_items where title in ('Good track','Bad track')),
  0,
  'failed track save leaves no track rows'
);

-- 合法边界：1 与 7200 秒
select lives_ok(
  $$select public.admin_save_album_with_tracks(
      pg_temp.album_payload('Boundary album'),
      jsonb_build_array(
        pg_temp.track_payload('One second', 1, 1),
        pg_temp.track_payload('Two hours', 2, 7200)
      )
    )$$,
  'runtimes 1 and 7200 are accepted'
);
select is(
  (select count(*)::integer from public.music m
    join public.media_items a on a.id = m.album_id
    where a.title = 'Boundary album'),
  2,
  'boundary album keeps both tracks'
);

-- 重复曲序被拒绝
select throws_ok(
  $$select public.admin_save_media(
      pg_temp.track_payload('Dup number', 1, 120)
      || jsonb_build_object(
        'parent_id', (select id from public.media_items where title = 'Boundary album' and type = 'album')
      )
    )$$,
  '23505',
  null,
  'duplicate track number within album is rejected'
);

-- runtime 7201 拒绝；电影仍可超过 7200（分钟语义）
select throws_ok(
  $$select public.admin_save_media(
      pg_temp.track_payload('Too long', 3, 7201)
      || jsonb_build_object(
        'parent_id', (select id from public.media_items where title = 'Boundary album' and type = 'album')
      )
    )$$,
  '22023',
  null,
  'runtime 7201 is rejected for tracks'
);

select lives_ok(
  $$select public.admin_save_media(jsonb_build_object(
      'type','movie','title','Long movie','status','want_to_watch','rating',null,
      'runtime',9000,'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
      'actors','[]'::jsonb,'directors','[]'::jsonb
    ))$$,
  'movie runtime above 7200 remains allowed'
);

-- CHECK 约束直接拦截非法 update
select throws_ok(
  $$update public.media_items set runtime = 0
    where title = 'One second' and type = 'music'$$,
  '23514',
  null,
  'check rejects runtime 0 on music rows'
);
select throws_ok(
  $$update public.media_items set runtime = 7201
    where title = 'Two hours' and type = 'music'$$,
  '23514',
  null,
  'check rejects runtime 7201 on music rows'
);

select lives_ok(
  $$update public.media_items set runtime = null
    where title = 'One second' and type = 'music'$$,
  'null runtime remains allowed for tracks'
);

select is(
  (select track_count from public.music_albums a
    join public.media_items m on m.id = a.media_item_id
    where m.title = 'Boundary album'),
  2,
  'album_with_tracks writes music_albums.track_count'
);

select * from finish();
rollback;
