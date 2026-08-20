import SeriesCatalog from "./SeriesCatalog";
import { fetchMediaListServer, fetchStatsServer } from "@/lib/functions/media-repo";

export const revalidate = 60;

export default async function SeriesPage() {
  // 服务端获取基础统计数据，用于首屏渲染（SEO 优化）
  const stats = await fetchStatsServer('tv_series');

  // 获取已看示例数据（分页由 media-repo 处理）
  const watchedRes = await fetchMediaListServer({ type: 'tv_series', limit: 10, offset: 0, sort: 'date_desc' });
  const watchedSeries = watchedRes.rows;

  return (
    <SeriesCatalog
      watched={watchedSeries}
      want={[]}
      watching={[]}
      stats={{ totalSeries: stats.total, totalSeasons: 0, totalEpisodes: 0, totalUpcomingEpisodes: stats.upcoming }}
    />
  );
}
