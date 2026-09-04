-- Deterministic, fictional records used only by Playwright in local/CI Supabase.
-- Never load this file into a hosted project.

begin;

insert into public.genres (id, name) values
  ('10000000-0000-4000-8000-000000000001', '测试剧情'),
  ('10000000-0000-4000-8000-000000000002', '测试科幻');

insert into public.languages (id, name) values
  ('20000000-0000-4000-8000-000000000001', '测试语言');

insert into public.regions (id, name) values
  ('30000000-0000-4000-8000-000000000001', '测试地区');

insert into public.people (id, name, alternate_name) values
  ('40000000-0000-4000-8000-000000000001', '测试导演', 'Fixture Director'),
  ('40000000-0000-4000-8000-000000000002', '测试演员', 'Fixture Actor');

insert into public.media_items (
  id, type, title, alternate_title, summary, cover_url, release_date, runtime
) values
  ('50000000-0000-4000-8000-000000000001', 'movie', '测试电影：星光档案', 'Fixture Movie', '用于端到端测试的虚构电影。', null, '2024-03-15', 120),
  ('50000000-0000-4000-8000-000000000002', 'tv_series', '测试剧集：城市信号', 'Fixture Series', '用于端到端测试的虚构电视剧。', null, '2025-01-01', null),
  ('50000000-0000-4000-8000-000000000003', 'tv_season', '城市信号 第一季', 'Fixture Season One', '测试季度简介。', null, '2025-01-01', null),
  ('50000000-0000-4000-8000-000000000004', 'tv_episode', '启程', 'Pilot Signal', '第一集测试简介。', null, '2025-01-02', 45),
  ('50000000-0000-4000-8000-000000000005', 'tv_episode', '回声', 'Signal Echo', '第二集测试简介。', null, '2025-01-09', 50);

insert into public.tv_seasons (id, series_id, season_number) values
  ('50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 1);

insert into public.tv_episodes (id, season_id, episode_number) values
  ('50000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', 1),
  ('50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000003', 2);

insert into public.tracking (id, media_item_id, status, rating) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'watched', 8.5),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000004', 'watched', 8.0),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000005', 'want_to_watch', null);

insert into public.media_genres (media_item_id, genre_id) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');

insert into public.media_languages (media_item_id, language_id) values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');

insert into public.media_regions (media_item_id, region_id) values
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');

insert into public.media_credits (media_item_id, person_id, role, credit_order) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'director', 0),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'actor', 0),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'director', 0),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'actor', 0);

commit;
