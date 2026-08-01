import { supabaseServer } from "@/utils/supabase";
import SeriesCatalog from "./SeriesCatalog";
import { Media } from "@/lib/types/Media";
import { mapSupabaseToMedia, SupabaseMediaItem } from "@/lib/functions/mediaMapper";

export const revalidate = 60;

export default async function SeriesPage() {
  const today = new Date().toISOString().split('T')[0];

  {/* 获取电视剧统计数据 */}
  const totalSeriesCountRes = await supabaseServer
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("type", "tv_series");

  const totalSeasonsCountRes = await supabaseServer
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("type", "tv_season");

  const totalEpisodesCountRes = await supabaseServer
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("type", "tv_episode");

  const totalUpcomingEpisodesCountRes = await supabaseServer
    .from("media_items")
    .select("*", { count: "exact", head: true })
    .eq("type", "tv_episode")
    .gte("release_date", today);


  const totalSeriesCount = totalSeriesCountRes.count ?? 0;
  const totalSeasonsCount = totalSeasonsCountRes.count ?? 0;
  const totalEpisodesCount = totalEpisodesCountRes.count ?? 0;
  const totalUpcomingEpisodesCount = totalUpcomingEpisodesCountRes.count ?? 0;

  {/* 获取已看过、正在看和想看的电视剧数据 */}
  const { data: watchedData, error } = (await supabaseServer
    .rpc("get_tv_series_by_status", { p_status: "watched" })
    .order("release_years", { ascending: false })
    .limit(10)) as {
    data: SupabaseMediaItem[] | null;
    error: unknown;
  };

  if (error) {
    console.error("Error fetching TV series:", error);
  }

  const watchedSeries = (watchedData ?? []).map((item) =>
    mapSupabaseToMedia(item, "series"),
  ) as Media[];

   {/* 渲染 SeriesCatalog 组件并传入数据 */}
  return (
    <SeriesCatalog 
      watched={watchedSeries} 
      want={[]}
      watching={[]}
      stats={{ totalSeries: totalSeriesCount, totalSeasons: totalSeasonsCount, totalEpisodes: totalEpisodesCount, totalUpcomingEpisodes: totalUpcomingEpisodesCount }} />
  );
}