begin;

select plan(12);

insert into auth.users(id,email) values
  ('d1000000-0000-4000-8000-000000000001','books-isbn-owner@test.invalid');
insert into public.site_owner(user_id) values ('d1000000-0000-4000-8000-000000000001');

create function pg_temp.book_payload(title text, authors jsonb, extras jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'type','book','title',title,'status','want_to_watch','rating',null,
    'genres','[]'::jsonb,'languages','[]'::jsonb,'authors',authors,
    'page_count',120,'publisher','ISBN测验社','collections','[]'::jsonb
  ) || extras;
$$;
grant execute on function pg_temp.book_payload(text, jsonb, jsonb) to authenticated;

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'isbn'
  ),
  'books.isbn column exists'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.books'::regclass
      and conname = 'books_isbn_format_check'
  ),
  'books_isbn_format_check exists'
);

select is(
  public.normalize_book_isbn('978-0-306-40615-7'),
  '9780306406157',
  'normalize_book_isbn strips hyphens'
);

select is(
  public.normalize_book_isbn('0 306 40615 x'),
  '030640615X',
  'normalize_book_isbn uppercases x'
);

insert into public.media_items (id, type, title) values
  ('d2000000-0000-4000-8000-000000000001', 'book', 'ISBN 约束书'),
  ('d2000000-0000-4000-8000-000000000002', 'book', 'ISBN 合法书');

select lives_ok(
  $$insert into public.books(media_item_id,isbn) values('d2000000-0000-4000-8000-000000000002','9780306406157')$$,
  'normalized isbn-13 accepted'
);

select throws_ok(
  $$insert into public.books(media_item_id,isbn) values('d2000000-0000-4000-8000-000000000001','978-0-306-40615-7')$$,
  '23514',
  null,
  'hyphenated isbn rejected by check'
);

select throws_ok(
  $$insert into public.books(media_item_id,isbn) values('d2000000-0000-4000-8000-000000000001','12345')$$,
  '23514',
  null,
  'short isbn rejected'
);

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true); end $$;

select lives_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '带连字符ISBN书',
    '[{"name":"作者甲"}]'::jsonb,
    '{"isbn":"978-0-306-40615-7"}'::jsonb
  ))$$,
  'admin_save_media normalizes isbn on save'
);

select is(
  (select isbn from public.books b
    join public.media_items m on m.id = b.media_item_id
    where m.title = '带连字符ISBN书'),
  '9780306406157',
  'saved isbn is normalized'
);

select lives_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    'ISBN10书',
    '[{"name":"作者乙"}]'::jsonb,
    '{"isbn":"0-306-40615-x"}'::jsonb
  ))$$,
  'admin_save_media accepts isbn-10 with x'
);

select is(
  (select isbn from public.books b
    join public.media_items m on m.id = b.media_item_id
    where m.title = 'ISBN10书'),
  '030640615X',
  'saved isbn-10 uppercases X'
);

select throws_ok(
  $$select public.admin_save_media(pg_temp.book_payload(
    '坏ISBN书',
    '[{"name":"作者丙"}]'::jsonb,
    '{"isbn":"not-isbn"}'::jsonb
  ))$$,
  '22023',
  null,
  'RPC rejects invalid isbn'
);

select * from finish();
rollback;
