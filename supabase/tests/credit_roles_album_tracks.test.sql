-- credit_roles 字典约束、共享曲统计、专辑删除保留共享曲、独立单曲、get_person_works 去重。

begin;
select plan(19);

insert into auth.users(id,email) values
  ('c1000000-0000-4000-8000-000000000001','cr-owner@test.invalid');
insert into public.site_owner(user_id) values ('c1000000-0000-4000-8000-000000000001');

select ok(to_regclass('public.credit_roles') is not null, 'credit_roles exists');
select is((select count(*)::integer from public.credit_roles), 13, '13 seeded roles');
select ok(
  (select allows_character from public.credit_roles where code='actor')
  and (select allows_character from public.credit_roles where code='voice_actor'),
  'actor and voice_actor allow character'
);
select ok(
  (select allowed_types = array['tv_show']::public.media_type[] from public.credit_roles where code='guest')
  and (select allowed_types = array['tv_show']::public.media_type[] from public.credit_roles where code='host'),
  'guest/host are tv_show only'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true); end $$;

-- 导演不可写角色名
select throws_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'type','movie','title','Bad character','status','want_to_watch',
    'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb,
    'credits', jsonb_build_array(jsonb_build_object(
      'person',jsonb_build_object('name','导演X'),'role','director','character','不行','order',0
    ))
  ))$$,
  '22023',
  null,
  'director cannot have character'
);

-- 图书不可挂 artist
select throws_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'type','book','title','Bad role book','status','want_to_watch',
    'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb,
    'credits', jsonb_build_array(jsonb_build_object(
      'person',jsonb_build_object('name','艺人'),'role','artist','order',0
    ))
  ))$$,
  '22023',
  null,
  'artist not allowed on book'
);

-- 独立单曲（无专辑）
select lives_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'type','music','title','独立单曲测试','status','want_to_watch','runtime',90,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb,
    'credits', jsonb_build_array(jsonb_build_object(
      'person',jsonb_build_object('name','独行侠'),'role','artist','order',0
    ))
  ))$$,
  'standalone song without album is allowed'
);
select ok(
  exists (
    select 1 from public.media_items m
    join public.music mu on mu.media_item_id = m.id
    where m.title = '独立单曲测试'
      and not exists (select 1 from public.album_tracks at where at.song_id = m.id)
  ),
  'standalone song has music row and no album_tracks'
);

-- 两张专辑共享一首歌
create temporary table cr_ids(name text primary key, id uuid);
grant all on cr_ids to authenticated;

select lives_ok(
  $$insert into cr_ids values ('album_a', (public.admin_save_album_with_tracks(
    jsonb_build_object('type','album','title','专辑A','status','want_to_watch','release_kind','album',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object('title','共享之歌','number',1,'status','watched','rating',8,'runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb),
      jsonb_build_object('title','仅A','number',2,'status','want_to_watch','runtime',80,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb)
    )
  )->>'id')::uuid)$$,
  'album A with shared song saved'
);

select lives_ok(
  $$insert into cr_ids values ('shared', (select id from public.media_items where title='共享之歌'))$$,
  'capture shared song id'
);

select lives_ok(
  $$insert into cr_ids values ('album_b', (public.admin_save_album_with_tracks(
    jsonb_build_object('type','album','title','专辑B','status','want_to_watch','release_kind','compilation',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'id', (select id from cr_ids where name='shared'),
        'title','共享之歌','number',1,'status','watched','rating',8,'runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      )
    )
  )->>'id')::uuid)$$,
  'album B references existing shared song'
);

select is(
  (select count(*)::integer from public.album_tracks where song_id = (select id from cr_ids where name='shared')),
  2,
  'shared song appears on two albums'
);

-- 听过共享曲 → 两张专辑在 v_all_media 都算 watching／watched 口径受曲目影响
select ok(
  (select status from public.v_all_media where id = (select id from cr_ids where name='album_b')) in ('watched','watching'),
  'album B reflects listened shared song'
);

select is(
  public.album_average_rating((select id from cr_ids where name='album_a')),
  8.0::numeric,
  'album A average uses only its own tracks ratings'
);

-- 删专辑 B：共享曲应保留
select lives_ok(
  $$select public.admin_delete_media((select id from cr_ids where name='album_b'), '专辑B')$$,
  'delete album B'
);
select ok(
  exists (select 1 from public.media_items where id = (select id from cr_ids where name='shared')),
  'shared song kept after deleting album B'
);
select is(
  (select count(*)::integer from public.album_tracks where song_id = (select id from cr_ids where name='shared')),
  1,
  'shared song remains only on album A'
);

-- get_person_works：同一首歌只出现一次（按角色分组内 media_id 去重）
select is(
  (
    select jsonb_array_length(role_block->'items')
    from jsonb_array_elements(
      public.get_person_works((select id from public.people where name='共享艺人'))->'music'->'songs'
    ) role_block
    where role_block->>'role' = 'artist'
  ),
  (
    select count(distinct value->>'id')::integer
    from jsonb_array_elements(
      (
        select r->'items'
        from jsonb_array_elements(
          public.get_person_works((select id from public.people where name='共享艺人'))->'music'->'songs'
        ) r
        where r->>'role' = 'artist'
        limit 1
      )
    ) value
  ),
  'get_person_works songs section has unique song ids for artist role'
);

select ok(
  not exists (select 1 from pg_type where typname = 'person_role'),
  'person_role enum dropped'
);

select * from finish();
rollback;
