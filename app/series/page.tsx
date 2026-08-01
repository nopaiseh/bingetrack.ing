import { supabaseServer } from "@/utils/supabase";
import SeriesCatalog from "./SeriesCatalog" 
import { Media } from "@/lib/types/Media";

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
  const { data: watchedData, error } = await supabaseServer
    .rpc("get_tv_series_by_status", { p_status: "watched" })
    .order("release_years", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching TV series:", error);
  }

  {/* 格式化电影数据为 Media 类型 */}
  const formatItem = (item: any) => {
    const userTracking = item.tracking?.[0] || {};

    return {
      id: item.id,
      title: item.title,
      date: item.release_years,
      rating: item.average_rating,
      status: item.status,
      summary: item.summary,
      cover_url: item.cover_url,
      genres: (item.genres ?? []),
      languages: (item.languages ?? []),
      regions: (item.media_regions ?? []).map((r: any) => r.regions.name),
      series: item.media_series?.name || null,
      casts: (item.media_credits ?? [])
        .filter((c: any) => c.role === 'actor')
        .sort((a: any, b: any) => a.credit_order - b.credit_order)
        .map((c: any) => c.people.name)
    };
  };

  const watchedSeries = (watchedData ?? []).map(formatItem) as Media[];

   {/* 渲染 SeriesCatalog 组件并传入数据 */}
  return (
    <SeriesCatalog 
      watched={watchedSeries} 
      want={[]}
      watching={[]}
      stats={{ totalSeries: totalSeriesCount, totalSeasons: totalSeasonsCount, totalEpisodes: totalEpisodesCount, totalUpcomingEpisodes: totalUpcomingEpisodesCount }} />
  );
}