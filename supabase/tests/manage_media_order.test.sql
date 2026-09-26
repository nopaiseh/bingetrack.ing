begin;
select plan(7);

-- 构造一部电影和两部剧集：剧集排序看最近已播集，未来集不提前把剧集顶到最前。
insert into public.media_items(id,type,title,release_date) values
  ('fb000000-0000-4000-8000-000000000001','movie','Order movie','2024-05-01'),
  ('fb000000-0000-4000-8000-000000000010','tv_series','Order series A',null),
  ('fb000000-0000-4000-8000-000000000011','tv_season','Order A S1',null),
  ('fb000000-0000-4000-8000-000000000012','tv_episode','Order A E1','2023-01-01'),
  ('fb000000-0000-4000-8000-000000000013','tv_episode','Order A E2','2025-03-01'),
  ('fb000000-0000-4000-8000-000000000014','tv_episode','Order A E3',current_date + 365),
  ('fb000000-0000-4000-8000-000000000020','tv_series','Order series B',null),
  ('fb000000-0000-4000-8000-000000000021','tv_season','Order B S1',null),
  ('fb000000-0000-4000-8000-000000000022','tv_episode','Order B E1',current_date + 30);
insert into public.tv_seasons(id,series_id,season_number) values
  ('fb000000-0000-4000-8000-000000000011','fb000000-0000-4000-8000-000000000010',1),
  ('fb000000-0000-4000-8000-000000000021','fb000000-0000-4000-8000-000000000020',1);
insert into public.tv_episodes(id,season_id,episode_number) values
  ('fb000000-0000-4000-8000-000000000012','fb000000-0000-4000-8000-000000000011',1),
  ('fb000000-0000-4000-8000-000000000013','fb000000-0000-4000-8000-000000000011',2),
  ('fb000000-0000-4000-8000-000000000014','fb000000-0000-4000-8000-000000000011',3),
  ('fb000000-0000-4000-8000-000000000022','fb000000-0000-4000-8000-000000000021',1);

select is((select sort_date from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000001'),'2024-05-01'::date,'movie sorts by its release date');
select is((select sort_date from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000010'),'2025-03-01'::date,'series sorts by latest aired episode, ignoring future episodes');
select is((select sort_date from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000011'),'2025-03-01'::date,'season sorts by latest aired episode');
select is((select sort_date from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000020'),current_date + 30,'series with no aired episode falls back to earliest episode');
select is((select parent_id from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000013'),'fb000000-0000-4000-8000-000000000011'::uuid,'episode exposes its season as parent');
select is((select item_number from public.v_manage_media_order where id='fb000000-0000-4000-8000-000000000011'),1,'season exposes its season number');

set local role anon;
select throws_ok($$select id from public.v_manage_media_order limit 1$$,'42501',null,'anonymous visitors cannot read the admin ordering view');
reset role;

select * from finish();
rollback;
