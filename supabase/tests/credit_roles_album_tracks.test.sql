-- credit_roles 字典约束、共享曲统计、专辑删除保留共享曲、独立单曲、get_person_works 去重。

begin;
select plan(43);

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

-- 专辑 B 仅共享已听曲 → 精确为 watched；专辑 A 另有未听曲 → watching
select is(
  (select status from public.v_all_media where id = (select id from cr_ids where name='album_b')),
  'watched',
  'album B with only watched shared song is watched'
);

select is(
  (select status from public.v_all_media where id = (select id from cr_ids where name='album_a')),
  'watching',
  'album A with mixed listen status is watching'
);

-- 仅挂在专辑 B 的另一首歌（评分 9）证明 A 平均不含它
select lives_ok(
  $$insert into cr_ids values ('b_only', (public.admin_save_media(jsonb_build_object(
    'type','music','title','仅B评分曲','parent_id',(select id from cr_ids where name='album_b')::text,
    'number',2,'status','watched','rating',9,'runtime',90,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid)$$,
  'song only on album B with rating 9'
);

select is(
  public.album_average_rating((select id from cr_ids where name='album_a')),
  8.0::numeric,
  'album A average uses only its own tracks ratings'
);

select is(
  public.album_average_rating((select id from cr_ids where name='album_b')),
  8.5::numeric,
  'album B average is (8+9)/2 and excludes album-A-only tracks'
);

-- 共用歌经 admin_save_media 保存（previous_parent=当前 parent）：其它专辑关联不得被删
select lives_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'id', (select id from cr_ids where name='shared')::text,
    'type','music','title','共享之歌','parent_id',(select id from cr_ids where name='album_a')::text,
    'previous_parent_id',(select id from cr_ids where name='album_a')::text,
    'number',1,'status','watched','rating',8,'runtime',100,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))$$,
  'saving shared song with previous_parent=current parent succeeds'
);

select is(
  (select count(*)::integer from public.album_tracks where song_id = (select id from cr_ids where name='shared')),
  2,
  'shared song still on two albums after admin_save_media edit'
);

-- 引用已有曲：状态预设为 watched，引用载荷给 want_to_watch 不得覆盖
update public.tracking set status = 'watched', rating = 9.5
where media_item_id = (select id from cr_ids where name='shared');

select lives_ok(
  $$select public.admin_save_album_with_tracks(
    jsonb_build_object(
      'id', (select id from cr_ids where name='album_b')::text,
      'type','album','title','专辑B','status','want_to_watch','release_kind','compilation',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', (select id from cr_ids where name='shared'),
        'title','共享之歌','number',1,'status','want_to_watch','rating',1,'runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','其它人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      ),
      jsonb_build_object(
        'id', (select id from cr_ids where name='b_only'),
        'title','仅B评分曲','number',2,'status','watched','rating',9,'runtime',90,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      )
    )
  )$$,
  're-save album B referencing shared song with different status/credits'
);

select is(
  (select status::text from public.tracking where media_item_id = (select id from cr_ids where name='shared')),
  'watched',
  'referencing existing song does not overwrite its tracking status'
);

select is(
  (select count(*)::integer from public.media_credits
   where media_item_id = (select id from cr_ids where name='shared') and role = 'artist'),
  1,
  'referencing existing song does not overwrite its credits'
);

-- 换专辑：previous_parent 不同于新 parent → 只删旧链；双方 track_count 更新
select lives_ok(
  $$insert into cr_ids values ('move_song', (public.admin_save_media(jsonb_build_object(
    'type','music','title','可挪曲','parent_id',(select id from cr_ids where name='album_a')::text,
    'number',9,'disc_number',2,'status','want_to_watch','runtime',70,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid)$$,
  'create disc-2 track on album A for move test'
);

select is(
  (select disc_number from public.album_tracks
   where song_id = (select id from cr_ids where name='move_song')
     and album_id = (select id from cr_ids where name='album_a')),
  2,
  'new track stores disc_number 2'
);

select lives_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'id', (select id from cr_ids where name='move_song')::text,
    'type','music','title','可挪曲',
    'parent_id',(select id from cr_ids where name='album_b')::text,
    'previous_parent_id',(select id from cr_ids where name='album_a')::text,
    'number',9,'status','want_to_watch','runtime',70,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))$$,
  'move track to album B without sending disc_number'
);

select is(
  (select disc_number from public.album_tracks
   where song_id = (select id from cr_ids where name='move_song')
     and album_id = (select id from cr_ids where name='album_b')),
  2,
  'omitted disc_number preserves original disc when re-linking after move'
);

select ok(
  not exists (
    select 1 from public.album_tracks
    where song_id = (select id from cr_ids where name='move_song')
      and album_id = (select id from cr_ids where name='album_a')
  )
  and (select track_count from public.music_albums where media_item_id = (select id from cr_ids where name='album_a'))
      = (select count(*)::integer from public.album_tracks where album_id = (select id from cr_ids where name='album_a'))
  and (select track_count from public.music_albums where media_item_id = (select id from cr_ids where name='album_b'))
      = (select count(*)::integer from public.album_tracks where album_id = (select id from cr_ids where name='album_b')),
  'moving track updates both albums track_count and drops old link'
);

-- 解绑后删除孤儿曲目：完整清单不含仅 A 的曲 → 解绑并删除
insert into cr_ids values ('orphan', (select id from public.media_items where title='仅A'));

select lives_ok(
  $$select public.admin_save_album_with_tracks(
    jsonb_build_object(
      'id', (select id from cr_ids where name='album_a')::text,
      'type','album','title','专辑A','status','want_to_watch','release_kind','album',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', (select id from cr_ids where name='shared'),
        'title','共享之歌','number',1,'status','watched','rating',8,'runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','共享艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      )
    )
  )$$,
  'album A complete list unbinds A-only track'
);

select ok(
  not exists (select 1 from public.media_items where id = (select id from cr_ids where name='orphan')),
  'unbound orphan track is deleted'
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

-- 无效 release_kind
select throws_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'type','album','title','坏形态','status','want_to_watch','release_kind','lp',
    'credits','[]'::jsonb,'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
  ))$$,
  '22023',
  null,
  'invalid release_kind rejected'
);

-- 直接插入：未知角色／类型不允许的角色／非演员角色名
select throws_ok(
  $$insert into public.media_credits(media_item_id, person_id, role, credit_order)
    values(
      (select id from cr_ids where name='album_a'),
      (select id from public.people where name='共享艺人'),
      'not_a_role', 0
    )$$,
  '23514',
  null,
  'unknown role rejected'
);

select throws_ok(
  $$insert into public.media_credits(media_item_id, person_id, role, credit_order)
    values(
      (select id from cr_ids where name='album_a'),
      (select id from public.people where name='共享艺人'),
      'author', 0
    )$$,
  '23514',
  null,
  'disallowed-type role rejected by trigger'
);

select throws_ok(
  $$insert into public.media_credits(media_item_id, person_id, role, credit_order, character_name)
    values(
      (select id from cr_ids where name='shared'),
      (select id from public.people where name='共享艺人'),
      'artist', 0, '角色名'
    )$$,
  '23514',
  null,
  'character name on non-actor role rejected'
);

reset role;

-- anon：可读 RPC；不可写字典／album_tracks；不可调 admin
set local role anon;

select throws_ok(
  $$insert into public.credit_roles(code,label,sort_order,allowed_types)
    values('x','x',999,array['movie']::public.media_type[])$$,
  '42501',
  null,
  'anon cannot insert credit_roles'
);

select throws_ok(
  $$insert into public.album_tracks(album_id,song_id,disc_number,track_number)
    values(
      'a2000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000002',
      1, 99
    )$$,
  '42501',
  null,
  'anon cannot insert album_tracks'
);

reset role;

-- get_song_detail：同专其他曲上限 20；相关歌曲合并去重上限 12
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true); end $$;

do $$
declare
  album_id uuid;
  song_id uuid;
  i integer;
  detail jsonb;
  other_count integer;
  related_count integer;
begin
  album_id := (public.admin_save_media(jsonb_build_object(
    'type','album','title','上限专辑','status','want_to_watch','release_kind','album',
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','上限艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;

  song_id := (public.admin_save_media(jsonb_build_object(
    'type','music','title','上限主歌','parent_id',album_id::text,'number',1,
    'status','want_to_watch','runtime',100,
    'credits',jsonb_build_array(
      jsonb_build_object('person',jsonb_build_object('name','上限艺人'),'role','artist','order',0),
      jsonb_build_object('person',jsonb_build_object('name','上限词曲'),'role','composer','order',0),
      jsonb_build_object('person',jsonb_build_object('name','上限词曲'),'role','lyricist','order',0)
    ),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;

  for i in 2..25 loop
    perform public.admin_save_media(jsonb_build_object(
      'type','music','title','同专曲'||i,'parent_id',album_id::text,'number',i,
      'status','want_to_watch','runtime',60,
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','上限艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
    ));
  end loop;

  -- 再造 15 首相关歌（同一艺人／词曲），确保去重后仍能触达 12 上限
  for i in 1..15 loop
    perform public.admin_save_media(jsonb_build_object(
      'type','music','title','相关歌'||i,'status','want_to_watch','runtime',50,
      'credits',jsonb_build_array(
        jsonb_build_object('person',jsonb_build_object('name','上限艺人'),'role','artist','order',0),
        jsonb_build_object('person',jsonb_build_object('name','上限词曲'),'role','composer','order',0)
      ),
      'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
    ));
  end loop;

  -- 三关系合并样本：artist + composer + lyricist → relations 合并去重固定序
  perform public.admin_save_media(jsonb_build_object(
    'type','music','title','三关系相关歌','status','want_to_watch','runtime',55,
    'release_date','2099-12-31',
    'credits',jsonb_build_array(
      jsonb_build_object('person',jsonb_build_object('name','上限艺人'),'role','artist','order',0),
      jsonb_build_object('person',jsonb_build_object('name','上限词曲'),'role','composer','order',0),
      jsonb_build_object('person',jsonb_build_object('name','上限词曲'),'role','lyricist','order',0)
    ),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ));

  detail := public.get_song_detail(song_id);
  other_count := jsonb_array_length(detail->'albums'->0->'other_tracks');
  related_count := jsonb_array_length(detail->'related');
  if other_count is distinct from 20 then
    raise exception 'expected other_tracks=20 got %', other_count;
  end if;
  if related_count is distinct from 12 then
    raise exception 'expected related=12 got %', related_count;
  end if;
  if jsonb_typeof(detail->'related') is distinct from 'array' then
    raise exception 'related must be a flat array';
  end if;
  -- 去重：同一首歌不得出现两次
  if (
    select count(*) from (
      select value->>'id' as id from jsonb_array_elements(detail->'related')
    ) r
  ) is distinct from (
    select count(distinct value->>'id') from jsonb_array_elements(detail->'related')
  ) then
    raise exception 'related songs must be deduped by id';
  end if;
  -- 排序：effective date desc then id
  if exists (
    select 1
    from generate_series(0, related_count - 2) as g(i)
    where (detail->'related'->g.i->>'release_date') is not null
      and (detail->'related'->(g.i+1)->>'release_date') is not null
      and (detail->'related'->g.i->>'release_date') < (detail->'related'->(g.i+1)->>'release_date')
  ) then
    raise exception 'related songs must be ordered by release_date desc';
  end if;
  -- 每项必须有 relations 数组；多关系合并为固定序 artist → composer → lyricist
  if exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where jsonb_typeof(r->'relations') is distinct from 'array'
       or jsonb_array_length(r->'relations') < 1
  ) then
    raise exception 'each related song must have non-empty relations[]';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'title' = '三关系相关歌'
      and r->'relations' = '["artist","composer","lyricist"]'::jsonb
  ) then
    raise exception 'merged relations must be ["artist","composer","lyricist"] for 三关系相关歌';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'title' like '相关歌%'
      and r->'relations' = '["artist","composer"]'::jsonb
  ) then
    raise exception 'artist+composer related songs must merge relations to ["artist","composer"]';
  end if;
  -- 同专辑曲目不得进入 related（已在 other_tracks）
  if exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'title' like '同专曲%'
  ) then
    raise exception 'same-album tracks must not appear in related';
  end if;
end $$;

select ok(true, 'get_song_detail caps related at 12 with sort/dedupe/merged relations; excludes same-album');

-- 当前歌属多张专辑：任一共同专辑上的歌都不得进 related
do $$
declare
  album_x uuid;
  album_y uuid;
  shared_song uuid;
  only_x uuid;
  only_y uuid;
  related_ok uuid;
  detail jsonb;
begin
  album_x := (public.admin_save_album_with_tracks(
    jsonb_build_object(
      'type','album','title','多专排除X','status','want_to_watch','release_kind','album',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
    ),
    jsonb_build_array(
      jsonb_build_object(
        'title','多专共享主歌','number',1,'status','want_to_watch','runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      ),
      jsonb_build_object(
        'title','仅X专辑曲','number',2,'status','want_to_watch','runtime',80,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      )
    )
  )->>'id')::uuid;

  shared_song := (select id from public.media_items where title = '多专共享主歌');
  only_x := (select id from public.media_items where title = '仅X专辑曲');

  album_y := (public.admin_save_album_with_tracks(
    jsonb_build_object(
      'type','album','title','多专排除Y','status','want_to_watch','release_kind','album',
      'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
      'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', shared_song,
        'title','多专共享主歌','number',1,'status','want_to_watch','runtime',100,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      ),
      jsonb_build_object(
        'title','仅Y专辑曲','number',2,'status','want_to_watch','runtime',80,
        'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
        'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
      )
    )
  )->>'id')::uuid;

  only_y := (select id from public.media_items where title = '仅Y专辑曲');
  related_ok := (public.admin_save_media(jsonb_build_object(
    'type','music','title','多专外相关歌','status','want_to_watch','runtime',70,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','多专艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;

  if (select count(*) from public.album_tracks where song_id = shared_song) is distinct from 2 then
    raise exception 'fixture: shared song should be on two albums';
  end if;

  detail := public.get_song_detail(shared_song);
  if exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'id' in (only_x::text, only_y::text)
  ) then
    raise exception 'multi-album song must exclude tracks from any shared album';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'id' = related_ok::text
  ) then
    raise exception 'related song outside shared albums must remain';
  end if;
end $$;

select ok(true, 'related excludes tracks from any album shared with multi-album current song');

-- 当前歌不属于任何专辑：不得因其它歌有专辑而误排除
do $$
declare
  standalone uuid;
  album_z uuid;
  on_album uuid;
  other_standalone uuid;
  detail jsonb;
begin
  standalone := (public.admin_save_media(jsonb_build_object(
    'type','music','title','无专辑主歌','status','want_to_watch','runtime',90,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','无专艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;

  album_z := (public.admin_save_media(jsonb_build_object(
    'type','album','title','无专对照专辑','status','want_to_watch','release_kind','album',
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','无专艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'regions','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;
  on_album := (public.admin_save_media(jsonb_build_object(
    'type','music','title','有专辑相关歌','parent_id',album_z::text,'number',1,
    'status','want_to_watch','runtime',60,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','无专艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;
  other_standalone := (public.admin_save_media(jsonb_build_object(
    'type','music','title','另一无专辑相关歌','status','want_to_watch','runtime',55,
    'credits',jsonb_build_array(jsonb_build_object('person',jsonb_build_object('name','无专艺人'),'role','artist','order',0)),
    'genres','[]'::jsonb,'languages','[]'::jsonb,'collections','[]'::jsonb
  ))->>'id')::uuid;

  if exists (select 1 from public.album_tracks where song_id = standalone) then
    raise exception 'fixture: standalone must have no album_tracks';
  end if;

  detail := public.get_song_detail(standalone);
  if not exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'id' = on_album::text
  ) then
    raise exception 'standalone current song must not exclude album-linked related songs';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(detail->'related') r
    where r->>'id' = other_standalone::text
  ) then
    raise exception 'standalone current song must keep other standalone related songs';
  end if;
end $$;

select ok(true, 'standalone current song does not falsely exclude related songs');

select * from finish();
rollback;
