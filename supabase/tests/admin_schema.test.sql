begin;
select no_plan();

-- 仅在回滚事务内创建虚构账号，测试结束不保留任何用户或媒体。
insert into auth.users(id,email) values
  ('fa000000-0000-4000-8000-000000000001','owner@test.invalid'),
  ('fa000000-0000-4000-8000-000000000002','outsider@test.invalid');
insert into public.site_owner(user_id) values ('fa000000-0000-4000-8000-000000000001');
create temporary table admin_test_ids(name text primary key, id uuid);
grant all on admin_test_ids to authenticated;

-- 构造四种媒体的最小有效负载，所有测试复用同一字段语义。
create function pg_temp.admin_payload(kind text, title text, parent uuid default null, number integer default null)
returns jsonb language sql as $$
  select jsonb_build_object('type',kind,'title',title,'parent_id',parent,'number',number,
    'status','want_to_watch','rating',null,'genres','[]'::jsonb,'languages','[]'::jsonb,
    'regions','[]'::jsonb,'actors','[]'::jsonb,'directors','[]'::jsonb);
$$;

select ok(not has_table_privilege('anon','public.media_items','INSERT,UPDATE,DELETE'), 'anonymous cannot write media');
select ok(not has_table_privilege('authenticated','public.site_owner','INSERT,UPDATE,DELETE'), 'users cannot appoint themselves owner');
select ok(not has_function_privilege('anon','public.admin_save_media(jsonb)','EXECUTE'), 'anonymous cannot call save RPC');
select ok(not has_function_privilege('anon','public.admin_delete_media(uuid,text)','EXECUTE'), 'anonymous cannot call delete RPC');
select ok(not exists(select 1 from pg_proc where oid in ('public.is_site_owner()'::regprocedure,'public.admin_save_media(jsonb)'::regprocedure,'public.admin_delete_media(uuid,text)'::regprocedure) and prosecdef), 'all admin functions use invoker privileges');

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000002',true); end $$;
select is(public.is_site_owner(),false,'other authenticated user is not owner');
select throws_ok($$insert into public.media_items(type,title) values ('movie','unauthorized')$$,'42501',null,'other user cannot insert directly');
select throws_ok($$select public.admin_save_media(pg_temp.admin_payload('movie','unauthorized'))$$,'42501',null,'other user cannot save through RPC');
select throws_ok($$select public.admin_delete_media('fa000000-0000-4000-8000-000000000003','x')$$,'42501',null,'other user cannot delete through RPC');
select is((select count(*)::integer from public.site_owner),0,'other user cannot read owner identity');

do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000001',true); end $$;
select is(public.is_site_owner(),true,'designated owner is recognized');
select lives_ok($$insert into admin_test_ids values ('movie',public.admin_save_media(pg_temp.admin_payload('movie','Admin test movie') || '{"genres":["Admin genre"],"actors":["Doe, Jane"]}'))$$,'owner creates media and relations atomically');
select lives_ok($$insert into admin_test_ids values ('series',public.admin_save_media(pg_temp.admin_payload('tv_series','Admin test series')))$$,'owner creates series');
select lives_ok($$insert into admin_test_ids values ('season',public.admin_save_media(pg_temp.admin_payload('tv_season','Admin test season',(select id from admin_test_ids where name='series'),1)))$$,'owner creates season');
select lives_ok($$insert into admin_test_ids values ('episode',public.admin_save_media(pg_temp.admin_payload('tv_episode','Admin test episode',(select id from admin_test_ids where name='season'),1)))$$,'owner creates episode');
select lives_ok($$select public.admin_save_media(pg_temp.admin_payload('movie','Admin updated movie') || jsonb_build_object('id',(select id from admin_test_ids where name='movie'),'status','watched','rating',8.5))$$,'owner updates watched state and rating');
select is((select status::text from public.tracking where media_item_id=(select id from admin_test_ids where name='movie')),'watched','watched status persists');
select is((select rating from public.tracking where media_item_id=(select id from admin_test_ids where name='movie')),8.5::numeric,'rating persists');
select is((select count(*)::integer from public.media_genres where media_item_id=(select id from admin_test_ids where name='movie')),0,'clearing related names removes only current associations');
select throws_ok($$select public.admin_save_media(pg_temp.admin_payload('tv_episode','Duplicate episode',(select id from admin_test_ids where name='season'),1))$$,'23505',null,'duplicate episode number is rejected');
select is((select count(*)::integer from public.media_items where title='Duplicate episode'),0,'failed relation save leaves no orphan media');
select throws_ok($$select public.admin_save_media(pg_temp.admin_payload('tv_season','Wrong parent',(select id from admin_test_ids where name='movie'),1))$$,'P0002',null,'movie cannot be parent of season');
select throws_ok($$select public.admin_save_media(pg_temp.admin_payload('tv_series','Change type') || jsonb_build_object('id',(select id from admin_test_ids where name='movie')))$$,'22023',null,'existing media type cannot change');
select throws_ok($$select public.admin_delete_media((select id from admin_test_ids where name='series'),'Wrong title')$$,'22023',null,'delete requires exact title confirmation');

do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000002',true); end $$;
select lives_ok($$update public.media_items set title='unauthorized' where id=(select id from admin_test_ids where name='movie')$$,'RLS silently filters unauthorized updates');
select is((select title from public.media_items where id=(select id from admin_test_ids where name='movie')),'Admin updated movie','other user cannot update existing media');
select lives_ok($$delete from public.media_items where id=(select id from admin_test_ids where name='movie')$$,'RLS silently filters unauthorized deletes');
select is((select count(*)::integer from public.media_items where id=(select id from admin_test_ids where name='movie')),1,'other user cannot delete existing media');

do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000001',true); end $$;
select lives_ok($$select public.admin_delete_media((select id from admin_test_ids where name='series'),'Admin test series')$$,'owner deletes complete series tree');
select is((select count(*)::integer from public.media_items where id in (select id from admin_test_ids where name in ('series','season','episode'))),0,'delete leaves no orphan seasons or episodes');
select is((select count(*)::integer from public.tracking where media_item_id in (select id from admin_test_ids where name in ('series','season','episode'))),0,'delete removes descendant tracking');
select is((select count(*)::integer from public.media_items where id=(select id from admin_test_ids where name='movie')),1,'unrelated movie survives series deletion');

-- 八类管理补充：系列和关联资料不能绕过站长权限，失败须整次回滚。
select ok(not has_table_privilege('anon','public.media_series','INSERT,UPDATE,DELETE'), 'anonymous cannot write collections');
select ok(not has_function_privilege('anon','public.manage_save_media(jsonb)','EXECUTE'), 'anonymous cannot call catalog save');
select lives_ok($$select public.manage_save_media(pg_temp.admin_payload('movie','Catalog movie') || '{"collections":["Catalog collection"],"actors":["Catalog person"],"genres":["Catalog genre"],"regions":["Catalog region"]}')$$, 'owner creates collection and all reference kinds with media');
select is((select count(*)::integer from public.media_item_series join public.media_series on series_id=media_series.id where name='Catalog collection'),1,'collection membership saved');
select lives_ok($$update public.media_item_series set position=9 where series_id=(select id from public.media_series where name='Catalog collection')$$,'owner reorders collection member');
select lives_ok($$select public.manage_save_media(pg_temp.admin_payload('movie','Catalog movie') || jsonb_build_object('id',(select id from public.media_items where title='Catalog movie'),'collections',jsonb_build_array('Catalog collection'),'actors',jsonb_build_array('Catalog person'),'genres',jsonb_build_array('Catalog genre'),'regions',jsonb_build_array('Catalog region')))$$,'owner updates existing media with collection');
select is((select position from public.media_item_series where series_id=(select id from public.media_series where name='Catalog collection')),9,'media save preserves collection order');
select throws_ok($$select public.manage_save_media(pg_temp.admin_payload('movie','Catalog rollback') || '{"collections":[""]}')$$,'22023',null,'invalid collection aborts transaction');
select is((select count(*)::integer from public.media_items where title='Catalog rollback'),0,'invalid collection leaves no media or tracking');
select lives_ok($$update public.media_series set name='Catalog renamed' where name='Catalog collection'$$,'owner renames collection');
select is((select count(*)::integer from public.media_item_series join public.media_series on series_id=media_series.id where name='Catalog renamed'),1,'rename preserves membership');
do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000002',true); end $$;
select throws_ok($$insert into public.media_series(name) values('Unauthorized collection')$$,'42501',null,'nonowner cannot create collection');
select throws_ok($$select public.manage_save_media(pg_temp.admin_payload('movie','Unauthorized catalog') || '{"collections":[]}')$$,'42501',null,'nonowner cannot use wrapper');
select lives_ok($$delete from public.media_series where name='Catalog renamed'$$,'nonowner delete is filtered');
select is((select count(*)::integer from public.media_series where name='Catalog renamed'),1,'nonowner cannot delete collection');
select lives_ok($$update public.media_item_series set position=99 where series_id=(select id from public.media_series where name='Catalog renamed')$$,'nonowner member update is filtered');
select is((select position from public.media_item_series where series_id=(select id from public.media_series where name='Catalog renamed')),9,'nonowner cannot reorder collection');
do $$ begin perform set_config('request.jwt.claim.sub','fa000000-0000-4000-8000-000000000001',true); end $$;
select is((select count(*)::integer from public.media_credits join public.media_items on media_item_id=media_items.id where title='Catalog movie'),1,'person remains associated before deletion');
select lives_ok($$delete from public.media_series where name='Catalog renamed'$$,'owner deletes collection');
select lives_ok($$delete from public.people where name='Catalog person'; delete from public.genres where name='Catalog genre'; delete from public.regions where name='Catalog region'$$,'owner deletes reference data');
select is((select count(*)::integer from public.media_credits join public.media_items on media_item_id=media_items.id where title='Catalog movie'),0,'reference deletion removes links');
select is((select count(*)::integer from public.media_items where title='Catalog movie'),1,'deleting reference data preserves movie');
select is((select count(*)::integer from public.tracking join public.media_items on media_item_id=media_items.id where title='Catalog movie'),1,'deleting reference data preserves tracking');

reset role;
set local role anon;
select lives_ok($$select id,title from public.media_items limit 1$$,'public browsing still works');
reset role;
select * from finish();
rollback;
