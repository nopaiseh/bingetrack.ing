begin;
select no_plan();

-- 仅在回滚事务内构造报告样本，测试结束不保留任何资料。
insert into auth.users(id,email) values
  ('fc000000-0000-4000-8000-000000000001','owner@test.invalid'),
  ('fc000000-0000-4000-8000-000000000002','outsider@test.invalid');
insert into public.site_owner(user_id) values ('fc000000-0000-4000-8000-000000000001');

insert into public.media_items(id,type,title,cover_url,summary,release_date) values
  ('fc000000-0000-4000-8000-000000000100','movie','Report movie',null,null,null),
  ('fc000000-0000-4000-8000-000000000110','tv_show','Report show','c.jpg','s',null),
  ('fc000000-0000-4000-8000-000000000111','tv_season','Report S1',null,null,null),
  ('fc000000-0000-4000-8000-000000000112','tv_episode','Report E1',null,null,'2024-01-01'),
  ('fc000000-0000-4000-8000-000000000113','tv_episode','Report E3',null,null,null),
  ('fc000000-0000-4000-8000-000000000114','tv_season','Report S3',null,null,null),
  ('fc000000-0000-4000-8000-000000000120','tv_show','Empty show',null,null,null);
insert into public.tv_seasons(id,series_id,season_number) values
  ('fc000000-0000-4000-8000-000000000111','fc000000-0000-4000-8000-000000000110',1),
  ('fc000000-0000-4000-8000-000000000114','fc000000-0000-4000-8000-000000000110',3);
insert into public.tv_episodes(id,season_id,episode_number) values
  ('fc000000-0000-4000-8000-000000000112','fc000000-0000-4000-8000-000000000111',1),
  ('fc000000-0000-4000-8000-000000000113','fc000000-0000-4000-8000-000000000111',3);
insert into public.tracking(media_item_id,status,rating) values
  ('fc000000-0000-4000-8000-000000000100','watched',null),
  ('fc000000-0000-4000-8000-000000000112','want_to_watch',7.5);

-- 集号接续上一季的节目：第 2 季接着第 1 季编号，第 3 季接续时跳号，第 4 季重新从 1 编号。
insert into public.media_items(id,type,title,cover_url,summary,release_date) values
  ('fc000000-0000-4000-8000-000000000150','tv_show','Continued show','c.jpg','s',null),
  ('fc000000-0000-4000-8000-000000000151','tv_season','Continued S1',null,null,null),
  ('fc000000-0000-4000-8000-000000000152','tv_season','Continued S2',null,null,null),
  ('fc000000-0000-4000-8000-000000000153','tv_season','Continued S3',null,null,null),
  ('fc000000-0000-4000-8000-000000000159','tv_season','Continued S4',null,null,null),
  ('fc000000-0000-4000-8000-000000000154','tv_episode','Continued E1',null,null,null),
  ('fc000000-0000-4000-8000-000000000155','tv_episode','Continued E2',null,null,null),
  ('fc000000-0000-4000-8000-000000000156','tv_episode','Continued E3',null,null,null),
  ('fc000000-0000-4000-8000-000000000157','tv_episode','Continued E4',null,null,null),
  ('fc000000-0000-4000-8000-000000000158','tv_episode','Continued E7',null,null,null),
  ('fc000000-0000-4000-8000-000000000160','tv_episode','Continued S4E1',null,null,null);
insert into public.tv_seasons(id,series_id,season_number) values
  ('fc000000-0000-4000-8000-000000000151','fc000000-0000-4000-8000-000000000150',1),
  ('fc000000-0000-4000-8000-000000000152','fc000000-0000-4000-8000-000000000150',2),
  ('fc000000-0000-4000-8000-000000000153','fc000000-0000-4000-8000-000000000150',3),
  ('fc000000-0000-4000-8000-000000000159','fc000000-0000-4000-8000-000000000150',4);
insert into public.tv_episodes(id,season_id,episode_number) values
  ('fc000000-0000-4000-8000-000000000154','fc000000-0000-4000-8000-000000000151',1),
  ('fc000000-0000-4000-8000-000000000155','fc000000-0000-4000-8000-000000000151',2),
  ('fc000000-0000-4000-8000-000000000156','fc000000-0000-4000-8000-000000000152',3),
  ('fc000000-0000-4000-8000-000000000157','fc000000-0000-4000-8000-000000000152',4),
  ('fc000000-0000-4000-8000-000000000158','fc000000-0000-4000-8000-000000000153',7),
  ('fc000000-0000-4000-8000-000000000160','fc000000-0000-4000-8000-000000000159',1);

insert into public.people(id,name,alternate_name) values
  ('fc000000-0000-4000-8000-000000000201','Report Orphan',null),
  ('fc000000-0000-4000-8000-000000000202','Report Actor','Alias'),
  ('fc000000-0000-4000-8000-000000000203','Report  Actor',null),
  ('fc000000-0000-4000-8000-000000000204','Twin Name','One'),
  ('fc000000-0000-4000-8000-000000000205','Twin Name','Two'),
  ('fc000000-0000-4000-8000-000000000206','Report Artist',null);
insert into public.media_credits(media_item_id,person_id,role,credit_order,character_name) values
  ('fc000000-0000-4000-8000-000000000100','fc000000-0000-4000-8000-000000000202','actor',0,null),
  ('fc000000-0000-4000-8000-000000000100','fc000000-0000-4000-8000-000000000203','actor',0,'Hero/Villain'),
  ('fc000000-0000-4000-8000-000000000110','fc000000-0000-4000-8000-000000000204','actor',0,'Twin Name'),
  ('fc000000-0000-4000-8000-000000000110','fc000000-0000-4000-8000-000000000205','actor',1,'Good Twin');
insert into public.media_items(id,type,title) values ('fc000000-0000-4000-8000-000000000130','album','Report album');
insert into public.music_albums(media_item_id,artist_id) values ('fc000000-0000-4000-8000-000000000130','fc000000-0000-4000-8000-000000000206');
insert into public.genres(id,name) values ('fc000000-0000-4000-8000-000000000301','Report unused genre');

-- 名称检查函数
select is(public.manage_name_key('Ｔｏｍ　Hanks'), public.manage_name_key('tom hanks'), 'name key folds width, case and spacing');
select is(public.manage_name_issues('张三', false), '{}'::text[], 'plain Chinese name has no issues');
select is(public.manage_name_issues('A / B', true), '{}'::text[], 'standard character separator is accepted');
select ok('separator' = any(public.manage_name_issues('A/B', true)), 'unspaced character separator is flagged');
select ok('bracket_note' = any(public.manage_name_issues('张三（配音）', false)), 'bracketed note is flagged');
select ok('placeholder' = any(public.manage_name_issues('未知', true)), 'placeholder is flagged');
select ok('mixed_script' = any(public.manage_name_issues('Tom汉克斯', false)), 'mixed script person name is flagged');
select ok('fullwidth' = any(public.manage_name_issues('Ｔｏｍ', false)), 'full-width letters are flagged');

-- 各报告内容
select ok(exists(select 1 from public.v_report_orphan_people where link_id='fc000000-0000-4000-8000-000000000201'), 'unlinked person is orphan');
select ok(not exists(select 1 from public.v_report_orphan_people where link_id in ('fc000000-0000-4000-8000-000000000202','fc000000-0000-4000-8000-000000000206')), 'credited person and album artist are not orphans');
select is((select tags from public.v_report_missing_character where link_id='fc000000-0000-4000-8000-000000000100'), array['Report Actor'], 'actor without character is listed per work');
select ok(exists(select 1 from public.v_report_missing_alias where link_id='fc000000-0000-4000-8000-000000000201'), 'person without alias is listed');
select ok(not exists(select 1 from public.v_report_missing_alias where link_id='fc000000-0000-4000-8000-000000000202'), 'person with alias is not listed');
select ok(exists(select 1 from public.v_report_suspicious_names where id='credit:fc000000-0000-4000-8000-000000000100:fc000000-0000-4000-8000-000000000203' and 'separator' = any(tags)), 'suspicious character name is listed');
select ok(exists(select 1 from public.v_report_suspicious_names where link_id='fc000000-0000-4000-8000-000000000203' and 'double_space' = any(tags)), 'suspicious person name is listed');
select ok(exists(select 1 from public.v_report_suspicious_names where 'same_as_actor' = any(tags) and title='Twin Name'), 'character named after its actor is listed');
select is((select count(*)::integer from public.v_report_similar_people where link_id in ('fc000000-0000-4000-8000-000000000202','fc000000-0000-4000-8000-000000000203')), 2, 'spelling variants are similar people');
select ok(not exists(select 1 from public.v_report_similar_people where title='Twin Name'), 'same names with distinct aliases are not flagged');
select ok(exists(select 1 from public.v_report_unused_references where link_id='fc000000-0000-4000-8000-000000000301'), 'unused genre is listed');
select ok((select array['no_cover','no_summary','no_release_date','no_genres'] <@ tags from public.v_report_incomplete_media where link_id='fc000000-0000-4000-8000-000000000100'), 'incomplete movie lists missing fields');
select ok(exists(select 1 from public.v_report_incomplete_media where link_id='fc000000-0000-4000-8000-000000000113' and tags=array['no_release_date']), 'episode without date is listed');
select ok(exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000120' and tags=array['no_seasons']), 'show without seasons is listed');
select is((select detail from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000110'), '缺第 2 季', 'season gap is described');
select ok(exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000111' and detail like '%缺第 2 集'), 'episode gap is described');
select ok(exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000114' and tags=array['no_episodes']), 'season without episodes is listed');
select ok(not exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000152'), 'season continuing the previous season''s numbering is not a gap');
select ok(exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000153' and detail like '%缺第 5、6 集'), 'continued numbering reports only the skipped episodes');
select ok(not exists(select 1 from public.v_report_tv_structure where link_id='fc000000-0000-4000-8000-000000000159'), 'season restarting at episode 1 is still fine');
select ok(exists(select 1 from public.v_report_tracking_conflicts where link_id='fc000000-0000-4000-8000-000000000112' and tags=array['rating_unwatched']), 'rated unwatched episode is listed');
select ok(exists(select 1 from public.v_report_tracking_conflicts where link_id='fc000000-0000-4000-8000-000000000100' and tags=array['watched_unrated']), 'unrated watched movie is listed');
select ok(exists(select 1 from public.v_report_credit_order where link_id='fc000000-0000-4000-8000-000000000100' and tags=array['actor_order']), 'duplicate actor order is listed');
select ok(not exists(select 1 from public.v_report_credit_order where link_id='fc000000-0000-4000-8000-000000000110'), 'contiguous order is not listed');

-- 权限与批量删除
select ok(not has_function_privilege('anon','public.manage_delete_unused(text)','EXECUTE'), 'anonymous cannot bulk delete');
set local role anon;
select throws_ok($$select id from public.v_report_orphan_people limit 1$$,'42501',null,'anonymous visitors cannot read reports');
reset role;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000002',true); end $$;
select throws_ok($$select public.manage_delete_unused('people')$$,'42501',null,'other user cannot bulk delete');
select throws_ok($$select public.manage_merge_people('fc000000-0000-4000-8000-000000000202', array['fc000000-0000-4000-8000-000000000203']::uuid[])$$,'42501',null,'other user cannot merge people');
select throws_ok($$insert into public.people_distinct_pairs(person_a,person_b) values ('fc000000-0000-4000-8000-000000000202','fc000000-0000-4000-8000-000000000203')$$,'42501',null,'other user cannot mark people as distinct');

do $$ begin perform set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000001',true); end $$;
select throws_ok($$select public.manage_delete_unused('media')$$,'22023',null,'unknown kind is rejected');
select lives_ok($$select public.manage_delete_unused('people')$$,'owner deletes orphan people');
select ok(not exists(select 1 from public.people where id='fc000000-0000-4000-8000-000000000201'), 'orphan person was deleted');
select ok(exists(select 1 from public.people where id='fc000000-0000-4000-8000-000000000206'), 'album artist is kept');
select lives_ok($$select public.manage_delete_unused('references')$$,'owner deletes unused references');
select ok(not exists(select 1 from public.genres where id='fc000000-0000-4000-8000-000000000301'), 'unused genre was deleted');

-- 疑似重复人物：标记不是同一人后离开报告，取消标记后回来；合并后演职关联并入保留的人物
insert into public.people_distinct_pairs(person_a,person_b) values ('fc000000-0000-4000-8000-000000000202','fc000000-0000-4000-8000-000000000203');
select ok(not exists(select 1 from public.v_report_similar_people where link_id in ('fc000000-0000-4000-8000-000000000202','fc000000-0000-4000-8000-000000000203')), 'people marked as distinct leave the report');
select throws_ok($$insert into public.people_distinct_pairs(person_a,person_b) values ('fc000000-0000-4000-8000-000000000203','fc000000-0000-4000-8000-000000000202')$$,'23514',null,'pairs are stored with the smaller id first');
delete from public.people_distinct_pairs where person_a='fc000000-0000-4000-8000-000000000202';
select ok(exists(select 1 from public.v_report_similar_people where link_id='fc000000-0000-4000-8000-000000000202' and group_key <> ''), 'removing the mark brings the group back');
select throws_ok($$select public.manage_merge_people('fc000000-0000-4000-8000-000000000202', array['fc000000-0000-4000-8000-000000000202']::uuid[])$$,'22023',null,'cannot merge a person into themselves');
select throws_ok($$select public.manage_merge_people('fc000000-0000-4000-8000-000000000202', array['fc000000-0000-4000-8000-000000000206']::uuid[])$$,'23503',null,'album artist cannot be merged away');
select is(public.manage_merge_people('fc000000-0000-4000-8000-000000000202', array['fc000000-0000-4000-8000-000000000203']::uuid[]), 1, 'merge moves the credit');
select ok(not exists(select 1 from public.people where id='fc000000-0000-4000-8000-000000000203'), 'merged person is deleted');
select is((select character_name from public.media_credits where media_item_id='fc000000-0000-4000-8000-000000000100' and person_id='fc000000-0000-4000-8000-000000000202' and role='actor'), 'Hero/Villain', 'missing character name is filled from the merged credit');
select ok(not exists(select 1 from public.v_report_similar_people where link_id='fc000000-0000-4000-8000-000000000202'), 'merged group leaves the report');
insert into public.people(id,name,alternate_name) values
  ('fc000000-0000-4000-8000-000000000207','Solo Name',null),
  ('fc000000-0000-4000-8000-000000000208','Solo  Name','Solo Alias');
insert into public.media_credits(media_item_id,person_id,role,credit_order) values ('fc000000-0000-4000-8000-000000000110','fc000000-0000-4000-8000-000000000208','director',0);
select lives_ok($$select public.manage_merge_people('fc000000-0000-4000-8000-000000000207', array['fc000000-0000-4000-8000-000000000208']::uuid[])$$,'owner merges into a person without alias');
select is((select alternate_name from public.people where id='fc000000-0000-4000-8000-000000000207'), 'Solo Alias', 'kept person inherits the merged alias');
select ok(exists(select 1 from public.media_credits where person_id='fc000000-0000-4000-8000-000000000207' and role='director'), 'director credit moved to the kept person');
reset role;

select * from finish();
rollback;
