begin;

select plan(18);

-- Constraints exist after migration.
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_summary_length_check'
  ),
  'media_items has summary length check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_alternate_title_length_check'
  ),
  'media_items has alternate_title length check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_cover_url_https_check'
  ),
  'media_items has cover_url https check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_alternate_name_length_check'
  ),
  'people has alternate_name length check'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_series'::regclass
      and conname = 'media_series_alternate_name_length_check'
  ),
  'media_series has alternate_name length check'
);

-- Valid boundary rows succeed (NULL and max-length / https).
select lives_ok(
  $$insert into public.media_items(type, title, alternate_title, summary, cover_url)
    values (
      'movie',
      'Check movie valid',
      repeat('a', 300),
      repeat('s', 20000),
      'https://image.tmdb.org/t/p/w500/valid.jpg'
    )$$,
  'media_items accepts null-safe max summary/alias and https cover'
);

select lives_ok(
  $$insert into public.media_items(type, title, alternate_title, summary, cover_url)
    values ('movie', 'Check movie nulls', null, null, null)$$,
  'media_items allows null summary, alternate_title, and cover_url'
);

select lives_ok(
  $$insert into public.people(name, alternate_name)
    values ('Check person', repeat('p', 300))$$,
  'people accepts alternate_name of length 300'
);

select lives_ok(
  $$insert into public.people(name, alternate_name)
    values ('Check person null alias', null)$$,
  'people allows null alternate_name'
);

select lives_ok(
  $$insert into public.media_series(name, alternate_name)
    values ('Check collection', repeat('c', 300))$$,
  'media_series accepts alternate_name of length 300'
);

select lives_ok(
  $$insert into public.media_series(name, alternate_name)
    values ('Check collection null alias', null)$$,
  'media_series allows null alternate_name'
);

-- Violating inserts fail with check_violation (23514).
select throws_ok(
  $$insert into public.media_items(type, title, summary)
    values ('movie', 'Bad summary', repeat('x', 20001))$$,
  '23514',
  null,
  'summary longer than 20000 is rejected'
);

select throws_ok(
  $$insert into public.media_items(type, title, alternate_title)
    values ('movie', 'Bad alias', repeat('y', 301))$$,
  '23514',
  null,
  'alternate_title longer than 300 is rejected'
);

select throws_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('movie', 'Bad http cover', 'http://image.tmdb.org/t/p/w500/x.jpg')$$,
  '23514',
  null,
  'http cover_url is rejected'
);

select throws_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('movie', 'Bad relative cover', '/t/p/w500/x.jpg')$$,
  '23514',
  null,
  'non-https cover_url is rejected'
);

select throws_ok(
  $$insert into public.people(name, alternate_name)
    values ('Bad person alias', repeat('z', 301))$$,
  '23514',
  null,
  'people.alternate_name longer than 300 is rejected'
);

select throws_ok(
  $$insert into public.media_series(name, alternate_name)
    values ('Bad collection alias', repeat('w', 301))$$,
  '23514',
  null,
  'media_series.alternate_name longer than 300 is rejected'
);

-- Valid https covers for music hosts also pass (same column).
select lives_ok(
  $$insert into public.media_items(type, title, cover_url)
    values (
      'album',
      'Check album cover',
      'https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg'
    )$$,
  'https mzstatic cover_url is accepted'
);

select * from finish();
rollback;
