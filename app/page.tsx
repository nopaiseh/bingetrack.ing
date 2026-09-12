import HomeDashboard from "@/app/HomeDashboard";
import {
  getCachedReleaseYearStats,
  getCachedTopMediaServer,
  getCachedMediaDistributionsServer,
} from "@/lib/functions/cached-media";

export const revalidate = 60;

/** 并行读取年度统计、电影和电视剧榜单及分布数据，组成首页看板的初始数据。 */
export default async function HomePage() {
  const [summary, topMovies, topSeries, distributions] = await Promise.all([
    getCachedReleaseYearStats(),
    getCachedTopMediaServer("movie", null, 10),
    getCachedTopMediaServer("tv_series", null, 10),
    getCachedMediaDistributionsServer(),
  ]);

  return (
    <div>
      <HomeDashboard
        summary={summary}
        topMovies={topMovies ?? []}
        topSeries={topSeries ?? []}
        distributions={distributions}
      />
    </div>
  );
}

