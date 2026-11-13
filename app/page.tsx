import HomeDashboard from "@/app/HomeDashboard";
import type { ContinueWatchingCard } from "@/components/ContinueWatchingRail";
import { getContinueWatching, type ContinueWatchingItem } from "@/lib/continue-watching";
import {
  getCachedReleaseYearStats,
  getCachedTopMediaServer,
  getCachedMediaDistributionsServer,
  getCachedUpcomingReleasesServer,
} from "@/lib/functions/cached-media";
import { buildMediaDistributions } from "@/lib/functions/media-distributions";
import { handlePageDataError } from "@/lib/functions/page-data";
import { TOP_MEDIA_LIMIT } from "@/lib/api/media-params";
import { gmt8DateKey } from "@/lib/upcoming";
import type { MediaCard, Summary, UpcomingRelease } from "@/lib/types";
import type { Metadata } from "next";
import { buildWebsiteJsonLd } from "@/lib/seo/page";
import { serializeJsonLd } from "@/lib/seo/media";

// 规范地址只写在本页。根布局的 metadata 会合并进所有子路由，未单独声明的页面会因此继承首页地址。
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// 首页按 24 小时长缓存静态生成，数据变更由管理端 revalidatePath/revalidateTag 即时按需刷新。
export const revalidate = 86400;

const EMPTY_DISTRIBUTIONS = buildMediaDistributions([]);

/**
 * 丢掉 lastWatchedAt。该字段目前是上映日，不是观看时间，不能交给界面。
 */
function continueWatchingCards(items: readonly ContinueWatchingItem[]): ContinueWatchingCard[] {
  return items.map((item) => ({
    showId: item.showId,
    title: item.title,
    posterPath: item.posterPath,
    href: item.href,
    nextEpisode: item.nextEpisode,
    seasonProgress: item.seasonProgress,
  }));
}

/** 并行读取年度统计、榜单、分布、即将上映和继续观看；仅构建期失败时降级为空数据，运行期失败保留旧页面。 */
export default async function HomePage() {
  let summary: Summary[] = [];
  let topMovies: MediaCard[] = [];
  let topSeries: MediaCard[] = [];
  let distributions = EMPTY_DISTRIBUTIONS;
  let upcoming: UpcomingRelease[] = [];
  let continueWatching: ContinueWatchingCard[] = [];

  const dashboardResult = Promise.all([
    getCachedReleaseYearStats(),
    getCachedTopMediaServer("movie", null, TOP_MEDIA_LIMIT),
    getCachedTopMediaServer("tv_show", null, TOP_MEDIA_LIMIT),
    getCachedMediaDistributionsServer(),
    getCachedUpcomingReleasesServer(),
  ]);
  const continueResult = getContinueWatching();
  const [dashboard, watching] = await Promise.allSettled([dashboardResult, continueResult]);

  if (dashboard.status === "fulfilled") {
    const [fetchedSummary, fetchedTopMovies, fetchedTopSeries, fetchedDistributions, fetchedUpcoming] = dashboard.value;
    summary = fetchedSummary;
    topMovies = fetchedTopMovies ?? [];
    topSeries = fetchedTopSeries ?? [];
    distributions = fetchedDistributions;
    upcoming = fetchedUpcoming;
  } else {
    handlePageDataError("home dashboard", dashboard.reason);
  }

  if (watching.status === "fulfilled") {
    continueWatching = continueWatchingCards(watching.value);
  } else {
    handlePageDataError("continue watching", watching.reason);
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildWebsiteJsonLd()) }}
      />
      <HomeDashboard
        summary={summary}
        topMovies={topMovies}
        topSeries={topSeries}
        distributions={distributions}
        upcoming={upcoming}
        continueWatching={continueWatching}
        renderedOn={gmt8DateKey()}
      />
    </div>
  );
}

