begin;

select plan(9);

-- 图书／单曲／电影夹具：同名人物挂在不同角色与类型上，验证组合语义。
insert into public.people (id, name, alternate_name) values
  ('d1000000-0000-4000-8000-000000000001', '人物筛选作者', null),
  ('d1000000-0000-4000-8000-000000000002', '人物筛选作词', null),
  ('d1000000-0000-4000-8000-000000000003', '人物筛选作曲', null),
  ('d1000000-0000-4000-8000-000000000004', '人物筛选跨类', 'Cross Type Person'),
  ('d1000000-0000-4000-8000-000000000005', '人物筛选诺兰', null);

insert into public.media_items (id, type, title, release_date) values
  ('d2000000-0000-4000-8000-000000000001', 'book', '人物筛选图书', '2022-01-01'),
  ('d2000000-0000-4000-8000-000000000002', 'book', '人物筛选作者', '2022-02-01'),
  ('d2000000-0000-4000-8000-000000000003', 'music', '人物筛选单曲', '2023-01-01'),
  ('d2000000-0000-4000-8000-000000000004', 'album', '人物筛选专辑', '2023-02-01'),
  ('d2000000-0000-4000-8000-000000000005', 'movie', '人物筛选电影', '2021-01-01'),
  ('d2000000-0000-4000-8000-000000000006', 'movie', '无关电影标题', '2021-02-01'),
  -- 系列名含人名、成员无该导演；另一系列成员有该导演演职。
  ('d2000000-0000-4000-8000-000000000007', 'movie', '系列名撞名成员', '2019-01-01'),
  ('d2000000-0000-4000-8000-000000000008', 'movie', '系列内导演作品', '2019-02-01'),
  ('d2000000-0000-4000-8000-000000000009', 'movie', '非系列导演作品', '2019-03-01');

insert into public.books (media_item_id, page_count, publisher) values
  ('d2000000-0000-4000-8000-000000000001', 200, '测验社'),
  ('d2000000-0000-4000-8000-000000000002', 180, '测验社');

insert into public.music_albums (media_item_id, track_count, label) values
  ('d2000000-0000-4000-8000-000000000004', 1, '测验厂牌');

insert into public.music (media_item_id) values
  ('d2000000-0000-4000-8000-000000000003');
insert into public.album_tracks (album_id, song_id, disc_number, track_number) values
  ('d2000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000003', 1, 1);

insert into public.media_series (id, name) values
  ('d3000000-0000-4000-8000-000000000001', '人物筛选诺兰系列'),
  ('d3000000-0000-4000-8000-000000000002', '无关系列名');

insert into public.media_item_series (media_item_id, series_id, position) values
  ('d2000000-0000-4000-8000-000000000007', 'd3000000-0000-4000-8000-000000000001', 1),
  ('d2000000-0000-4000-8000-000000000008', 'd3000000-0000-4000-8000-000000000002', 1);

insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'author', 0),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000002', 'lyricist', 0),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', 'composer', 1),
  ('d2000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000004', 'artist', 0),
  ('d2000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000004', 'director', 0),
  ('d2000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000001', 'actor', 0),
  ('d2000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000005', 'director', 0),
  ('d2000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000005', 'director', 0);

set local role anon;

select results_eq(
  $$select id from public.search_media('人物筛选作词') order by id$$,
  $$values ('d2000000-0000-4000-8000-000000000003'::uuid)$$,
  'uncategorised keyword search matches lyricist credits'
);

select results_eq(
  $$select id from public.search_media('人物筛选作曲') order by id$$,
  $$values ('d2000000-0000-4000-8000-000000000003'::uuid)$$,
  'uncategorised keyword search matches composer credits'
);

select results_eq(
  $$select id from public.search_media('人物筛选作者', '{}', false, array['author']) order by id$$,
  $$values ('d2000000-0000-4000-8000-000000000001'::uuid)$$,
  'author credit-role search matches author credits only'
);

select results_eq(
  $$select id from public.search_media(
    '人物筛选跨类', array['movie'], false, array['director']
  ) order by id$$,
  $$values ('d2000000-0000-4000-8000-000000000005'::uuid)$$,
  'type and person together require both: movie director hit, not album artist'
);

select ok(
  not exists (
    select 1 from public.search_media(
      '人物筛选作者', array['book'], false, array['author']
    ) where id = 'd2000000-0000-4000-8000-000000000002'
  )
  and exists (
    select 1 from public.search_media(
      '人物筛选作者', array['book'], false, array['author']
    ) where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'type and person AND skips title-only book hits without the author credit'
);

select ok(
  exists (
    select 1 from public.search_media('人物筛选作者', array['book'])
    where id = 'd2000000-0000-4000-8000-000000000001'
  )
  and exists (
    select 1 from public.search_media('人物筛选作者', array['book'])
    where id = 'd2000000-0000-4000-8000-000000000002'
  ),
  'type-only keyword search matches book titles and author credits'
);

select ok(
  exists (
    select 1 from public.search_media('人物筛选作词', array['music'])
    where id = 'd2000000-0000-4000-8000-000000000003'
  )
  and not exists (
    select 1 from public.search_media('人物筛选作词', array['book'])
    where id = 'd2000000-0000-4000-8000-000000000003'
  ),
  'type-only search still matches credits of that type and excludes other types'
);

select is(
  (select count(*)::integer from public.search_media(
    '人物筛选作者', array['book'], false, array['author']
  ) where id = 'd2000000-0000-4000-8000-000000000006'),
  0,
  'type and person AND excludes same-name credits on a different media type'
);

select ok(
  not exists (
    select 1 from public.search_media('人物筛选诺兰', '{}', true, array['director'])
    where id = 'd2000000-0000-4000-8000-000000000007'
  )
  and exists (
    select 1 from public.search_media('人物筛选诺兰', '{}', true, array['director'])
    where id = 'd2000000-0000-4000-8000-000000000008'
  )
  and not exists (
    select 1 from public.search_media('人物筛选诺兰', '{}', true, array['director'])
    where id = 'd2000000-0000-4000-8000-000000000009'
  ),
  'series and person AND: name-only series excluded; credited series member kept; non-series credit excluded'
);

reset role;

select * from finish();
rollback;
