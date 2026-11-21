begin;

select plan(27);

-- 虚构站长，事务结束回滚。
insert into auth.users(id,email) values
  ('c1000000-0000-4000-8000-000000000001','books-owner@test.invalid'),
  ('c1000000-0000-4000-8000-000000000002','books-outsider@test.invalid');
insert into public.site_owner(user_id) values ('c1000000-0000-4000-8000-000000000001');

create function pg_temp.book_payload(title text, authors jsonb, extras jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','book','title',title,'status','want_to_watch','rating',null,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'authors',authors,
    'page_count',200,'publisher','测验出版社','collections','[]'::jsonb
  ) || extras;
$$;
grant execute on function pg_temp.book_payload(text, jsonb, jsonb) to authenticated;

select ok(to_regclass('public.books') is not null, 'books table exists');

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'page_count'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'publisher'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'isbn'
  ),
  'books has page_count, publisher and isbn'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.books'::regclass
      and conname = 'books_page_count_range_check'
  ),
  'books page_count has 1–20000 check'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books'
      and policyname = 'Allow SELECT from website'
      and roles = array['anon', 'authenticated']::name[]
  ),
  'books has public read policy like music tables'
);

select ok(
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'tracking_status' and e.enumlabel = 'in_progress'
  ),
  'tracking_status includes in_progress'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'tracking_status_media_type_check'
      and tgrelid = 'public.tracking'::regclass
  ),
  'tracking has in_progress-only-for-books trigger'
);

select ok(
  not has_function_privilege('anon','public.admin_save_media(jsonb)','EXECUTE'),
  'anonymous cannot call admin_save_media'
);

select ok(
  has_function_privilege('authenticated','public.find_book_by_title_and_authors(text,text[],uuid)','EXECUTE'),
  'authenticated can execute find_book_by_title_and_authors'
);

-- 夹具：电影与图书（直接写入，验证约束／触发器）
insert into public.media_items (id, type, title, release_date) values
  ('c2000000-0000-4000-8000-000000000001', 'movie', '在读约束电影', '2020-01-01'),
  ('c2000000-0000-4000-8000-000000000010', 'book', '预置图书', '2021-01-01');

insert into public.books (media_item_id, page_count, publisher) values
  ('c2000000-0000-4000-8000-000000000010', 320, '测试社');

insert into public.tracking (media_item_id, status, rating) values
  ('c2000000-0000-4000-8000-000000000001', 'want_to_watch', null);

select throws_ok(
  $$update public.tracking set status = 'in_progress' where media_item_id = 'c2000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'non-book cannot use in_progress'
);

select lives_ok(
  $$insert into public.tracking(media_item_id,status,rating)
    values('c2000000-0000-4000-8000-000000000010','in_progress',null)
    on conflict(media_item_id) do update set status = excluded.status$$,
  'book can use in_progress'
);

select throws_ok(
  $$insert into public.media_items(id,type,title) values('c2000000-0000-4000-8000-000000000011','book','坏页数');
    insert into public.books(media_item_id,page_count) values('c2000000-0000-4000-8000-000000000011', 0)$$,
  '23514',
  null,
  'page_count 0 rejected'
);

select throws_ok(
  $$insert into public.media_items(id,type,title) values('c2000000-0000-4000-8000-000000000012','book','超页数');
    insert into public.books(media_item_id,page_count) values('c2000000-0000-4000-8000-000000000012', 20001)$$,
  '23514',
  null,
  'page_count 20001 rejected'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true); end $$;
select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload('无权图书', '[{"name":"作者"}]'::jsonb))$$,
  '42501',
  null,
  'non-owner cannot save book'
);

do $$ begin perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true); end $$;

select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload('纯字符串作者', '["作者字符串"]'::jsonb))$$,
  '22023',
  null,
  'author plain strings are rejected'
);

select lives_ok(
  $$select public.admin_save_media(pg_temp.book_payload('原子图书', '[{"name":"作者甲"},{"name":"作者乙"}]'::jsonb))$$,
  'owner saves book with authors in one transaction'
);

select is(
  (select page_count from public.books b
    join public.media_items m on m.id = b.media_item_id where m.title = '原子图书'),
  200,
  'books row stores page_count'
);

select is(
  (select count(*)::integer from public.media_credits mc
    join public.media_items m on m.id = mc.media_item_id
    where m.title = '原子图书' and mc.role = 'author'),
  2,
  'author credits written'
);

select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload('原子图书', '[{"name":"作者乙"},{"name":"作者甲"}]'::jsonb))$$,
  '23505',
  null,
  'duplicate title+author set rejected'
);

select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '作者上限书',
    (select jsonb_agg(jsonb_build_object('name', '作者' || g)) from generate_series(1, 301) g)
  ))$$,
  '22023',
  null,
  'more than 300 authors rejected'
);

select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '坏页数书', '[{"name":"作者丙"}]'::jsonb, '{"page_count":0}'::jsonb
  ))$$,
  '22023',
  null,
  'RPC rejects invalid page_count'
);

select throws_ok(
  $$select public.admin_save_media(jsonb_build_object(
    'type','movie','title','伪在读电影','status','in_progress','rating',null,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
    'actors','[]'::jsonb,'directors','[]'::jsonb
  ))$$,
  '22023',
  null,
  'RPC rejects in_progress for non-book'
);

select lives_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '在读书', '[{"name":"作者丁"}]'::jsonb, '{"status":"in_progress"}'::jsonb
  ))$$,
  'RPC accepts in_progress for book'
);

select lives_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '类型字符串书', '[{"name":"作者戊"}]'::jsonb, '{"genres":["仍可字符串类型"]}'::jsonb
  ))$$,
  'book genres still accept plain strings'
);

select ok(
  exists (
    select 1 from public.v_all_media
    where type = 'book' and title = '在读书' and status = 'in_progress'
  ),
  'v_all_media includes books with in_progress'
);

select ok(
  exists (
    select 1 from public.search_media('在读书') where type = 'book'
  ),
  'search_media finds books by title'
);

select ok(
  pg_get_function_result('public.get_media_stats(text)'::regprocedure)
    ~ 'in_progress',
  'get_media_stats return type includes in_progress'
);

select results_eq(
  $$
    select total, watched, watching, want, in_progress
    from public.get_media_stats('book')
  $$,
  $$
    select
      count(*)::bigint as total,
      count(*) filter (where media.status = 'watched')::bigint as watched,
      count(*) filter (where media.status = 'watching')::bigint as watching,
      count(*) filter (where media.status = 'want_to_watch')::bigint as want,
      count(*) filter (where media.status = 'in_progress')::bigint as in_progress
    from public.v_all_media as media
    where media.type::text = 'book'
  $$,
  'get_media_stats book counts cover total/watched/want/in_progress'
);

select * from finish();
rollback;
