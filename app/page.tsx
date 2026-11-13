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
import { hasReleaseWithinSgtWindow, sgtDateKey } from "@/lib/upcoming";
import type { MediaCard, Summary, UpcomingRelease } from "@/lib/types";
import type { Metadata } from "next";
import { buildWebsiteJsonLd } from "@/lib/seo/page";
import { serializeJsonLd } from "@/lib/seo/media";

// 规范地址只写在本页。根布局的 metadata 会合并进所有子路由，未单独声明的页面会因此继承首页地址。
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// 首页仍是静态 ISR。upcomingFirst 按新加坡日历日计算，24 小时会让区块顺序在午夜后陈旧一整天，
// 因此页面重新验证缩短到 1 小时（3600 必须是字面量，Next.js 才能静态分析）。
// 过期后的第一次请求仍可能拿到旧页面（stale-while-revalidate），下一次即为新的一天。
// 榜单、分布和即将上映候选池仍走 24 小时数据缓存；管理端 revalidatePath("/") 会立即刷新。
export const revalidate = 3600;

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

  const now = new Date();

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
        upcomingFirst={hasReleaseWithinSgtWindow(upcoming, now)}
        renderedOn={sgtDateKey(now)}
      />
    </div>
  );
}

