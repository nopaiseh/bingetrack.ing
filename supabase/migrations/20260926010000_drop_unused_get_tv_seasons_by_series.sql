-- 删除未使用的 RPC：应用、脚本与测试均不调用它，生产 API 日志中也没有调用记录；
-- 它仍对匿名角色开放，删除可缩小公开接口面。季资料由 v_media_season_summaries 与 get_season_episode_page 提供。
drop function public.get_tv_seasons_by_series(uuid);
