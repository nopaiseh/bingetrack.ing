begin;

select plan(10);

-- 函数仍可被公开角色执行；安全属性与既有 public_schema 断言一致。
select ok(
  has_function_privilege('anon', 'public.get_media_distribution_counts()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_media_distribution_counts()', 'EXECUTE'),
  'public roles can execute get_media_distribution_counts'
);

select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.get_media_distribution_counts()'::regprocedure
  ),
  'get_media_distribution_counts remains security invoker'
);

-- 冷门年份夹具，避免与 e2e seed 冲突；事务结束回滚。
insert into public.genres (id, name) values
  ('e1000000-0000-4000-8000-000000000001', '分布测试流行'),
  ('e1000000-0000-4000-8000-000000000002', '分布测试摇滚'),
  ('e1000000-0000-4000-8000-000000000003', '分布测试小说');

insert into public.languages (id, name) values
  ('e1000000-0000-4000-8000-000000000011', '分布测试英语'),
  ('e1000000-0000-4000-8000-000000000012', '分布测试汉语');

insert into public.regions (id, name) values
  ('e1000000-0000-4000-8000-000000000021', '分布测试日本');

insert into public.media_items (id, type, title, release_date) values
  ('e2000000-0000-4000-8000-000000000001', 'album', '分布专辑 2087 A', '2087-03-01'),
  ('e2000000-0000-4000-8000-000000000002', 'album', '分布专辑 2087 B', '2087-06-01'),
  ('e2000000-0000-4000-8000-000000000003', 'album', '分布专辑无日期不计', null),
  ('e2000000-0000-4000-8000-000000000010', 'music', '分布单曲不计 2087', '2087-04-01'),
  ('e2000000-0000-4000-8000-000000000020', 'book', '分布图书 2087', '2087-05-01'),
  ('e2000000-0000-4000-8000-000000000021', 'book', '分布图书 2088', '2088-01-01');

insert into public.music_albums (media_item_id) values
  ('e2000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-000000000002'),
  ('e2000000-0000-4000-8000-000000000003');

insert into public.music (media_item_id, album_id, track_number) values
  ('e2000000-0000-4000-8000-000000000010', 'e2000000-0000-4000-8000-000000000001', 1);

insert into public.books (media_item_id) values
  ('e2000000-0000-4000-8000-000000000020'),
  ('e2000000-0000-4000-8000-000000000021');

-- 专辑：类型；图书：类型＋语言；地区挂在专辑上验证可选维度。
insert into public.media_genres (media_item_id, genre_id) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002'),
  ('e2000000-0000-4000-8000-000000000010', 'e1000000-0000-4000-8000-000000000002'),
  ('e2000000-0000-4000-8000-000000000020', 'e1000000-0000-4000-8000-000000000003'),
  ('e2000000-0000-4000-8000-000000000021', 'e1000000-0000-4000-8000-000000000003');

insert into public.media_languages (media_item_id, language_id) values
  ('e2000000-0000-4000-8000-000000000020', 'e1000000-0000-4000-8000-000000000011'),
  ('e2000000-0000-4000-8000-000000000021', 'e1000000-0000-4000-8000-000000000012');

insert into public.media_regions (media_item_id, region_id) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000021');

-- 专辑 All Time：流行=2，摇滚=1；单曲类型不计入 albums。
select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'albums'
      and release_year = 'All Time'
      and dimension = 'genres'
      and name = '分布测试流行'
  ),
  2,
  'albums All Time counts genre across dated albums only'
);

select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'albums'
      and release_year = '2087'
      and dimension = 'genres'
      and name = '分布测试摇滚'
  ),
  1,
  'albums year bucket matches movie-style release year'
);

select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'albums'
      and release_year = 'All Time'
      and dimension = 'regions'
      and name = '分布测试日本'
  ),
  1,
  'albums emit region rows when linked'
);

-- 单曲也挂了「摇滚」，但 albums 计数仍只来自专辑本体（应为 1）。
select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'albums'
      and release_year = 'All Time'
      and dimension = 'genres'
      and name = '分布测试摇滚'
  ),
  1,
  'individual tracks do not contribute album distribution rows'
);

select ok(
  not exists (
    select 1
    from public.get_media_distribution_counts()
    where media_type not in ('movies', 'shows', 'albums', 'books')
  ),
  'distribution route keys stay within public media types'
);

-- 图书：All Time 小说=2；2087 英语=1；2088 汉语=1。
select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'books'
      and release_year = 'All Time'
      and dimension = 'genres'
      and name = '分布测试小说'
  ),
  2,
  'books All Time counts genres'
);

select is(
  (
    select item_count
    from public.get_media_distribution_counts()
    where media_type = 'books'
      and release_year = '2087'
      and dimension = 'languages'
      and name = '分布测试英语'
  ),
  1,
  'books year bucket includes languages'
);

select is(
  (
    select count(*)::integer
    from public.get_media_distribution_counts()
    where media_type = 'books'
      and dimension = 'regions'
      and name like '分布测试%'
  ),
  0,
  'books with no regions emit no region rows'
);

select * from finish();

rollback;
