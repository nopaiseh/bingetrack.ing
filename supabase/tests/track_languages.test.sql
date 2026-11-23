begin;
select plan(12);

-- 与迁移 20261123030745 中 copy_album_languages_to_tracks 同逻辑；供本测试复现下放。
create function pg_temp.copy_album_languages_to_tracks()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.media_languages (media_item_id, language_id)
  select mu.media_item_id, ml.language_id
  from public.media_languages ml
  join public.media_items album_item
    on album_item.id = ml.media_item_id
   and album_item.type = 'album'::public.media_type
  join public.music mu on mu.album_id = album_item.id
  where not exists (
    select 1
    from public.media_languages existing
    where existing.media_item_id = mu.media_item_id
  )
  on conflict do nothing;

  delete from public.media_languages ml
  using public.media_items m
  where ml.media_item_id = m.id
    and m.type = 'album'::public.media_type;

  delete from public.languages l
  where not exists (
    select 1 from public.media_languages x where x.language_id = l.id
  );
end $$;

-- 虚构站长；事务结束回滚。
insert into auth.users(id,email) values
  ('f1000000-0000-4000-8000-000000000001','track-lang-owner@test.invalid');
insert into public.site_owner(user_id) values ('f1000000-0000-4000-8000-000000000001');

create temporary table track_lang_ids (
  name text primary key,
  id uuid not null
) on commit drop;
grant all on track_lang_ids to authenticated;

create function pg_temp.album_payload(
  title text,
  languages jsonb default '[]'::jsonb,
  regions jsonb default '[]'::jsonb
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','album','title',title,'status','want_to_watch','rating',null,
    'runtime',null,'label','语言测试厂牌','genres','[]'::jsonb,
    'artists',jsonb_build_array(jsonb_build_object('name','语言测试艺人')),
    'collections','[]'::jsonb,
    'languages',languages,'regions',regions,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'lyricists','[]'::jsonb,'composers','[]'::jsonb
  );
$$;

create function pg_temp.track_payload(
  title text,
  track_no integer,
  languages jsonb default '[]'::jsonb,
  genres jsonb default '[]'::jsonb
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','music','title',title,'number',track_no,'runtime',180,
    'status','want_to_watch','rating',null,
    'artists',jsonb_build_array(jsonb_build_object('name','语言测试艺人')),
    'lyricists','[]'::jsonb,'composers','[]'::jsonb,
    'genres',genres,'languages',languages,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'collections','[]'::jsonb
  );
$$;

grant execute on function pg_temp.album_payload(text, jsonb, jsonb) to authenticated;
grant execute on function pg_temp.track_payload(text, integer, jsonb, jsonb) to authenticated;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true); end $$;

-- 建两张专辑与曲目（语言先由直接插入模拟迁移前状态）。
select lives_ok(
  $$insert into track_lang_ids(name, id)
    values (
      'album_inherit',
      public.admin_save_album_with_tracks(
        pg_temp.album_payload('继承语言专辑', '[]'::jsonb, '["台湾"]'::jsonb),
        jsonb_build_array(
          pg_temp.track_payload('无语言曲目', 1),
          pg_temp.track_payload('已有语言曲目', 2)
        )
      )
    )$$,
  'seed album with two tracks for language inheritance'
);

select lives_ok(
  $$insert into track_lang_ids(name, id)
    values (
      'album_union',
      public.admin_save_album_with_tracks(
        pg_temp.album_payload('并集语言专辑'),
        jsonb_build_array(
          pg_temp.track_payload('并集曲目甲', 1, '["日语"]'::jsonb),
          pg_temp.track_payload('并集曲目乙', 2, '["英语","日语"]'::jsonb)
        )
      )
    )$$,
  'seed album whose tracks already have languages'
);

-- 模拟迁移前：专辑挂语言；一曲无语言、一曲已有自己的语言。
reset role;
insert into public.languages (id, name) values
  ('f2000000-0000-4000-8000-000000000001', '专辑遗留国语'),
  ('f2000000-0000-4000-8000-000000000002', '专辑遗留粤语'),
  ('f2000000-0000-4000-8000-000000000003', '曲目自带闽南语')
on conflict (name) do nothing;

insert into public.media_languages (media_item_id, language_id)
select (select id from track_lang_ids where name = 'album_inherit'), id
from public.languages
where name in ('专辑遗留国语', '专辑遗留粤语');

insert into public.media_languages (media_item_id, language_id)
select m.id, l.id
from public.media_items m
join public.music mu on mu.media_item_id = m.id
cross join public.languages l
where mu.album_id = (select id from track_lang_ids where name = 'album_inherit')
  and m.title = '已有语言曲目'
  and l.name = '曲目自带闽南语';

select pg_temp.copy_album_languages_to_tracks();

-- (a) 无语言单曲继承专辑语言；专辑上不再有语言行。
select is(
  (
    select array_agg(l.name order by l.name)
    from public.media_languages ml
    join public.languages l on l.id = ml.language_id
    join public.music mu on mu.media_item_id = ml.media_item_id
    join public.media_items t on t.id = mu.media_item_id
    where mu.album_id = (select id from track_lang_ids where name = 'album_inherit')
      and t.title = '无语言曲目'
  ),
  array['专辑遗留国语','专辑遗留粤语'],
  'track without languages inherits album languages'
);

select is(
  (
    select count(*)::integer
    from public.media_languages ml
    where ml.media_item_id = (select id from track_lang_ids where name = 'album_inherit')
  ),
  0,
  'album media_languages rows removed after copy'
);

-- (b) 已有语言的单曲保持不变（不并入专辑语言）。
select is(
  (
    select array_agg(l.name order by l.name)
    from public.media_languages ml
    join public.languages l on l.id = ml.language_id
    join public.music mu on mu.media_item_id = ml.media_item_id
    join public.media_items t on t.id = mu.media_item_id
    where mu.album_id = (select id from track_lang_ids where name = 'album_inherit')
      and t.title = '已有语言曲目'
  ),
  array['曲目自带闽南语'],
  'track that already had languages keeps them unchanged'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true); end $$;

-- (c) admin_save_media 保存单曲语言成功。
select lives_ok(
  $$select public.admin_save_media(
      pg_temp.track_payload('无语言曲目', 1, '["韩语","日语"]'::jsonb)
      || jsonb_build_object(
        'id', (select id from public.media_items where title = '无语言曲目' and type = 'music')::text,
        'parent_id', (select id from track_lang_ids where name = 'album_inherit')::text
      )
    )$$,
  'admin_save_media saves track languages'
);

select is(
  (
    select array_agg(l.name order by l.name)
    from public.media_languages ml
    join public.languages l on l.id = ml.language_id
    join public.media_items t on t.id = ml.media_item_id
    where t.title = '无语言曲目' and t.type = 'music'
  ),
  array['日语','韩语'],
  'saved track languages persist on media_languages'
);

-- (d) 专辑 payload 带 languages 时被忽略，不报错、不写专辑。
select lives_ok(
  $$select public.admin_save_media(
      pg_temp.album_payload(
        '继承语言专辑',
        '["应被忽略的语言"]'::jsonb,
        '["台湾"]'::jsonb
      ) || jsonb_build_object(
        'id', (select id from track_lang_ids where name = 'album_inherit')::text
      )
    )$$,
  'album payload with languages does not error'
);

select is(
  (
    select count(*)::integer
    from public.media_languages ml
    where ml.media_item_id = (select id from track_lang_ids where name = 'album_inherit')
  ),
  0,
  'album languages in payload are not written'
);

select is(
  (
    select array_agg(r.name order by r.name)
    from public.media_regions mr
    join public.regions r on r.id = mr.region_id
    where mr.media_item_id = (select id from track_lang_ids where name = 'album_inherit')
  ),
  array['台湾'],
  'album regions still persist when languages ignored'
);

-- (e) v_all_media 专辑 languages = 各单曲语言并集。
select is(
  (
    select languages
    from public.v_all_media
    where id = (select id from track_lang_ids where name = 'album_union')
  ),
  array['日语','英语'],
  'v_all_media album languages equal distinct union of track languages'
);

select ok(
  (
    select languages @> array['日语','韩语']::text[]
      and languages @> array['曲目自带闽南语']::text[]
    from public.v_all_media
    where id = (select id from track_lang_ids where name = 'album_inherit')
  ),
  'v_all_media album languages reflect updated track languages after save'
);

select * from finish();
rollback;
