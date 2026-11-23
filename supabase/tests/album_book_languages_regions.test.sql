begin;
select plan(10);
-- 专辑 languages 已下放到单曲（见 track_languages 迁移）；本文件仍覆盖专辑 regions 与图书 languages／regions。

-- 虚构站长；事务结束回滚。
insert into auth.users(id,email) values
  ('e1000000-0000-4000-8000-000000000001','album-book-lang-region-owner@test.invalid');
insert into public.site_owner(user_id) values ('e1000000-0000-4000-8000-000000000001');

create temporary table album_book_lr_ids (
  name text primary key,
  id uuid not null
) on commit drop;
grant all on album_book_lr_ids to authenticated;

create function pg_temp.album_payload(
  title text,
  genres jsonb default '[]'::jsonb,
  languages jsonb default '[]'::jsonb,
  regions jsonb default '[]'::jsonb,
  artists jsonb default '[{"name":"语区测试艺人"}]'::jsonb
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','album','title',title,'status','want_to_watch','rating',null,
    'runtime',null,'label','语区测试厂牌','genres',genres,
    'artists',artists,'languages',languages,'regions',regions,
    'collections','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb,
    'lyricists','[]'::jsonb,'composers','[]'::jsonb
  );
$$;

create function pg_temp.book_payload(
  title text,
  authors jsonb,
  genres jsonb default '[]'::jsonb,
  languages jsonb default '[]'::jsonb,
  regions jsonb default '[]'::jsonb
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','book','title',title,'status','want_to_watch','rating',null,
    'genres',genres,'languages',languages,'regions',regions,'authors',authors,
    'page_count',180,'publisher','语区测验社','collections','[]'::jsonb
  );
$$;

grant execute on function pg_temp.album_payload(text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function pg_temp.book_payload(text, jsonb, jsonb, jsonb, jsonb) to authenticated;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true); end $$;

-- 专辑：regions 仍可写；languages 在 payload 中被忽略；保留 genres／artists。
select lives_ok(
  $$insert into album_book_lr_ids(name, id)
    values (
      'album',
      public.admin_save_media(pg_temp.album_payload(
        '语区专辑',
        '["专辑流行"]'::jsonb,
        '["日语","英语"]'::jsonb,
        '["日本","美国"]'::jsonb
      ))
    )$$,
  'album saves with regions; languages in payload ignored'
);

select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    where mg.media_item_id = (select id from album_book_lr_ids where name = 'album')
  ),
  array['专辑流行'],
  'album genres still persist'
);

select is(
  (
    select array_agg(p.name order by p.name)
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    where mc.media_item_id = (select id from album_book_lr_ids where name = 'album')
      and mc.role = 'artist'::public.person_role
  ),
  array['语区测试艺人'],
  'album artists still persist'
);

select is(
  (
    select count(*)::integer
    from public.media_languages ml
    where ml.media_item_id = (select id from album_book_lr_ids where name = 'album')
  ),
  0,
  'album languages in payload are not written'
);

select is(
  (
    select array_agg(r.name order by r.name)
    from public.media_regions mr
    join public.regions r on r.id = mr.region_id
    where mr.media_item_id = (select id from album_book_lr_ids where name = 'album')
  ),
  array['日本','美国'],
  'album regions persist'
);

-- 图书：regions，并保留 genres／languages／authors。
select lives_ok(
  $$insert into album_book_lr_ids(name, id)
    values (
      'book',
      public.admin_save_media(pg_temp.book_payload(
        '语区图书',
        '[{"name":"作者甲"},{"name":"作者乙"}]'::jsonb,
        '["小说"]'::jsonb,
        '["中文"]'::jsonb,
        '["中国","香港"]'::jsonb
      ))
    )$$,
  'book saves with regions'
);

select is(
  (
    select array_agg(g.name order by g.name)
    from public.media_genres mg
    join public.genres g on g.id = mg.genre_id
    where mg.media_item_id = (select id from album_book_lr_ids where name = 'book')
  ),
  array['小说'],
  'book genres still persist'
);

select is(
  (
    select array_agg(l.name order by l.name)
    from public.media_languages ml
    join public.languages l on l.id = ml.language_id
    where ml.media_item_id = (select id from album_book_lr_ids where name = 'book')
  ),
  array['中文'],
  'book languages still persist'
);

select is(
  (
    select array_agg(p.name order by mc.credit_order)
    from public.media_credits mc
    join public.people p on p.id = mc.person_id
    where mc.media_item_id = (select id from album_book_lr_ids where name = 'book')
      and mc.role = 'author'::public.person_role
  ),
  array['作者甲','作者乙'],
  'book authors still persist'
);

select is(
  (
    select array_agg(r.name order by r.name)
    from public.media_regions mr
    join public.regions r on r.id = mr.region_id
    where mr.media_item_id = (select id from album_book_lr_ids where name = 'book')
  ),
  array['中国','香港'],
  'book regions persist'
);

select * from finish();
rollback;
