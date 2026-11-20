begin;
select plan(12);

-- 虚构站长与外人，事务结束回滚。
insert into auth.users(id,email) values
  ('b2000000-0000-4000-8000-000000000001','music-delete-owner@test.invalid'),
  ('b2000000-0000-4000-8000-000000000002','music-delete-outsider@test.invalid');
insert into public.site_owner(user_id) values ('b2000000-0000-4000-8000-000000000001');

create function pg_temp.album_payload(title text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','album','title',title,'status','want_to_watch','rating',null,
    'runtime',null,'label','删除测试厂牌','genres','[]'::jsonb,
    'artists',jsonb_build_array('删除测试艺人'),
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
    'artists',jsonb_build_array('删除测试艺人'),
    'lyricists','[]'::jsonb,'composers','[]'::jsonb,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'collections','[]'::jsonb
  );
$$;

grant execute on function pg_temp.album_payload(text) to authenticated;
grant execute on function pg_temp.track_payload(text, integer, numeric) to authenticated;

select ok(
  not (select prosecdef from pg_proc where oid = 'public.admin_delete_media(uuid,text)'::regprocedure),
  'admin_delete_media remains security invoker'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',true); end $$;

select lives_ok(
  $$select public.admin_save_album_with_tracks(
      pg_temp.album_payload('Atomic delete album'),
      jsonb_build_array(
        pg_temp.track_payload('Delete track one', 1, 120),
        pg_temp.track_payload('Delete track two', 2, 180)
      )
    )$$,
  'owner seeds album with two tracks for delete tests'
);

select is(
  (select count(*)::integer from public.music m
    join public.media_items a on a.id = m.album_id
    where a.title = 'Atomic delete album'),
  2,
  'seed album has two track rows'
);

-- 非站长无权删除
do $$ begin perform set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000002',true); end $$;
select throws_ok(
  $$select public.admin_delete_media(
      (select id from public.media_items where title = 'Atomic delete album' and type = 'album'),
      'Atomic delete album'
    )$$,
  '42501',
  null,
  'non-owner cannot delete album through RPC'
);

-- 确认标题不符
do $$ begin perform set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',true); end $$;
select throws_ok(
  $$select public.admin_delete_media(
      (select id from public.media_items where title = 'Atomic delete album' and type = 'album'),
      'Wrong album title'
    )$$,
  '22023',
  null,
  'delete album requires exact title confirmation'
);
select is(
  (select count(*)::integer from public.media_items where title = 'Atomic delete album' and type = 'album'),
  1,
  'failed confirmation leaves album intact'
);
select is(
  (select count(*)::integer from public.music m
    join public.media_items a on a.id = m.album_id
    where a.title = 'Atomic delete album'),
  2,
  'failed confirmation leaves tracks intact'
);

-- 单删曲目：所属专辑与同专辑其他曲目保留
select lives_ok(
  $$select public.admin_delete_media(
      (select id from public.media_items where title = 'Delete track one' and type = 'music'),
      'Delete track one'
    )$$,
  'owner deletes a single track through RPC'
);
select is(
  (select count(*)::integer from public.media_items where title = 'Atomic delete album' and type = 'album'),
  1,
  'single track delete leaves album intact'
);
select is(
  (select count(*)::integer from public.media_items where title = 'Delete track two' and type = 'music'),
  1,
  'single track delete leaves sibling tracks intact'
);

-- 站长删除专辑：剩余曲目一并消失
select lives_ok(
  $$select public.admin_delete_media(
      (select id from public.media_items where title = 'Atomic delete album' and type = 'album'),
      'Atomic delete album'
    )$$,
  'owner deletes album and tracks atomically'
);
select is(
  (select count(*)::integer from public.media_items
    where title in ('Atomic delete album','Delete track one','Delete track two')),
  0,
  'album delete removes album and all track media_items'
);

select * from finish();
rollback;
