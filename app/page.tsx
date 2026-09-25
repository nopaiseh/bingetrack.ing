import HomeDashboard from "@/app/HomeDashboard";
import {
  getCachedReleaseYearStats,
  getCachedTopMediaServer,
  getCachedMediaDistributionsServer,
} from "@/lib/functions/cached-media";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import { handlePageDataError } from "@/lib/functions/page-data";
import type { MediaCard, Summary } from "@/lib/types";

// 首页按 24 小时长缓存静态生成，数据变更由管理端 revalidatePath/revalidateTag 即时按需刷新。
export const revalidate = 86400;

const EMPTY_DISTRIBUTIONS = buildMediaDistributions([]);

/** 并行读取年度统计、电影和电视剧榜单及分布数据，组成首页看板的初始数据；仅构建期失败时降级为空看板，运行期失败保留旧页面。 */
export default async function HomePage() {
  let summary: Summary[] = [];
  let topMovies: MediaCard[] = [];
  let topSeries: MediaCard[] = [];
  let distributions = EMPTY_DISTRIBUTIONS;

  try {
    const [fetchedSummary, fetchedTopMovies, fetchedTopSeries, fetchedDistributions] = await Promise.all([
      getCachedReleaseYearStats(),
      getCachedTopMediaServer("movie", null, 10),
      getCachedTopMediaServer("tv_series", null, 10),
      getCachedMediaDistributionsServer(),
    ]);
    summary = fetchedSummary;
    topMovies = fetchedTopMovies ?? [];
    topSeries = fetchedTopSeries ?? [];
    distributions = fetchedDistributions;
  } catch (error) {
    handlePageDataError("home dashboard", error);
  }

  return (
    <div>
      <HomeDashboard
        summary={summary}
        topMovies={topMovies}
        topSeries={topSeries}
        distributions={distributions}
      />
    </div>
  );
}

