begin;
select plan(10);

-- 虚构站长；事务结束回滚。种子／其它测试可能已有季号，父级只用本文件新建的剧集。
insert into auth.users(id,email) values
  ('c1000000-0000-4000-8000-000000000001','child-cover-owner@test.invalid');
insert into public.site_owner(user_id) values ('c1000000-0000-4000-8000-000000000001');

create temporary table child_cover_ids (
  name text primary key,
  id uuid not null
) on commit drop;
grant all on child_cover_ids to authenticated;

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.media_items'::regclass
      and conname = 'media_items_child_cover_url_null_check'
  ),
  'media_items has child cover_url null check'
);

-- CHECK 拒绝曲目／季／单集写入自身封面；电影仍可写。
select throws_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('music', 'Bad track cover', 'https://coverartarchive.org/release/x/front-500')$$,
  '23514',
  null,
  'music cover_url must be null'
);

select throws_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('tv_season', 'Bad season cover', 'https://image.tmdb.org/t/p/w500/s.jpg')$$,
  '23514',
  null,
  'tv_season cover_url must be null'
);

select throws_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('tv_episode', 'Bad episode cover', 'https://image.tmdb.org/t/p/w500/e.jpg')$$,
  '23514',
  null,
  'tv_episode cover_url must be null'
);

select lives_ok(
  $$insert into public.media_items(type, title, cover_url)
    values ('movie', 'Movie keeps cover', 'https://image.tmdb.org/t/p/w500/m.jpg')$$,
  'movie cover_url still allowed'
);

-- admin_save_media 对提交的封面强制为 NULL。
-- 先写入自建剧集／季／单集并记下 id，再断言；不依赖标题查找，也不复用种子里的父级。
set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true); end $$;

select lives_ok(
  $$insert into child_cover_ids(name, id)
    values (
      'show',
      public.admin_save_media(jsonb_build_object(
        'type','tv_show','title','Child cover test show','status','want_to_watch',
        'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
        'actors','[]'::jsonb,'directors','[]'::jsonb,'collections','[]'::jsonb,
        'cover_url','https://image.tmdb.org/t/p/w500/show.jpg'
      ))
    )$$,
  'owner creates dedicated show parent'
);

select lives_ok(
  $$insert into child_cover_ids(name, id)
    values (
      'season',
      public.admin_save_media(jsonb_build_object(
        'type','tv_season','title','Child cover test season','status','want_to_watch',
        'parent_id',(select id from child_cover_ids where name = 'show'),
        'number',1,
        'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
        'actors','[]'::jsonb,'directors','[]'::jsonb,'collections','[]'::jsonb,
        'cover_url','https://image.tmdb.org/t/p/w500/season.jpg'
      ))
    )$$,
  'owner creates season under dedicated show'
);

select is(
  (select cover_url from public.media_items where id = (select id from child_cover_ids where name = 'season')),
  null,
  'admin_save_media forces tv_season cover_url to null'
);

select lives_ok(
  $$insert into child_cover_ids(name, id)
    values (
      'episode',
      public.admin_save_media(jsonb_build_object(
        'type','tv_episode','title','Child cover test episode','status','want_to_watch','rating',null,
        'parent_id',(select id from child_cover_ids where name = 'season'),
        'number',1,
        'genres','[]'::jsonb,'languages','[]'::jsonb,'regions','[]'::jsonb,
        'actors','[]'::jsonb,'directors','[]'::jsonb,'collections','[]'::jsonb,
        'cover_url','https://image.tmdb.org/t/p/w500/ep.jpg'
      ))
    )$$,
  'owner creates episode under dedicated season'
);

select is(
  (select cover_url from public.media_items where id = (select id from child_cover_ids where name = 'episode')),
  null,
  'admin_save_media forces tv_episode cover_url to null'
);

select * from finish();
rollback;
