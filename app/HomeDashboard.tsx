"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PosterRowSkeleton } from "@/components/LoadingSkeletons";
import DashboardYearPicker from "@/components/DashboardYearPicker";
import SpotlightHero from "@/components/SpotlightHero";
import AnimatedNumber from "@/components/AnimatedNumber";
import type { MediaCard, MediaDistribution, MediaDistributions, Summary } from "@/lib/types";

const CategoryHeaderCards = dynamic(() => import("@/components/dashboard/CategoryHeaderCards"), {
  loading: () => <div className="min-h-36 rounded-2xl bg-white/5 animate-pulse" />,
});

const MediaRuntimeCards = dynamic(() => import("@/components/dashboard/MediaRuntimeCards"), {
  loading: () => <div className="min-h-36 rounded-2xl bg-white/5 animate-pulse" />,
});

const DistributionTop5Cards = dynamic(() => import("@/components/dashboard/DistributionTop5Cards"), {
  loading: () => <div className="min-h-60 rounded-2xl bg-white/5 animate-pulse" />,
});

const MediaRow = dynamic(() => import("@/components/MediaRow"), {
  loading: () => <PosterRowSkeleton />,
});

const EMPTY_MEDIA_DISTRIBUTION: MediaDistribution = {
  regions: [],
  languages: [],
  genres: [],
};

/** 按媒体分类与观看状态生成搜索链接；指定年份时同时限定起止年份。 */
function getStatusSearchLink(type: "movie" | "tv_series" | "电影" | "电视剧", status: string, year: string) {
  const typeMap: Record<string, string> = { 电影: "movie", 电视剧: "tv_series", movie: "movie", tv_series: "tv_series" };
  const statusMap: Record<string, string> = { 已看: "watched", 在看: "watching", 想看: "want_to_watch", watched: "watched", watching: "watching", want_to_watch: "want_to_watch" };
  const params = new URLSearchParams({
    type: typeMap[type] || type,
    status: statusMap[status] || status,
  });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

/** 按媒体分类生成评分降序的搜索链接；指定年份时同时限定起止年份。 */
function getSearchViewAllLink(type: "movie" | "tv_series" | "电影" | "电视剧", year: string) {
  const typeMap: Record<string, string> = { 电影: "movie", 电视剧: "tv_series", movie: "movie", tv_series: "tv_series" };
  const params = new URLSearchParams({ type: typeMap[type] || type, sort: "rating_desc" });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

/** 将完成比例四舍五入为百分数并限制在 0 到 100；总数非正时返回 0。 */
function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

/** 按传入标题和图标展示媒体部数，并在提供数据时补充季数与集数；提供 href 时作为可点击跳转卡片。 */
function MediaStatusCard({
  title,
  icon,
  count,
  seasonsCount,
  episodesCount,
  href,
}: {
  title: string;
  icon: string;
  count: number;
  seasonsCount?: number;
  episodesCount?: number;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-white/85 font-semibold text-sm flex items-center justify-between pb-1 transition-colors group-hover:text-[var(--accent-hover)]">
        <div className="flex items-center gap-2.5">
          <span className={`${icon} size-4 inline-block text-[var(--accent)] group-hover:text-[var(--accent-hover)]`} aria-hidden="true" />
          <span>{title}</span>
        </div>
        {href && (
          <span className="i-material-symbols-arrow-outward-rounded size-3.5 text-white/40 transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-2.5 mt-1">
        <div className="flex justify-between items-end">
          <span className="text-sm text-white/70">部数</span>
          <span className="text-2xl font-mono text-white">
            <AnimatedNumber value={count} /> <span className="text-xs text-white/70 font-normal">部</span>
          </span>
        </div>
        {seasonsCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/70">季数</span>
            <span className="text-2xl font-mono text-white">
              <AnimatedNumber value={seasonsCount} /> <span className="text-xs text-white/70 font-normal">季</span>
            </span>
          </div>
        )}
        {episodesCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/70">集数</span>
            <span className="text-2xl font-mono text-white">
              <AnimatedNumber value={episodesCount} /> <span className="text-xs text-white/70 font-normal">集</span>
            </span>
          </div>
        )}
      </div>
    </>
  );

  const containerClasses = "group flex flex-col gap-3.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${containerClasses} cursor-pointer hover:scale-[1.01]`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
}

/** 根据年份和总览、电影、电视剧标签组织统计、分布及榜单；年份变化时加载对应榜单。 */
export default function HomeDashboard({
  summary,
  topMovies,
  topSeries,
  distributions,
}: {
  summary: Summary[];
  topMovies: MediaCard[];
  topSeries: MediaCard[];
  distributions: MediaDistributions;
}) {
  const [activeTab, setActiveTab] = useState("总览");
  const tabs = ["总览", "电影", "电视剧"];
  const tabIds: Record<string, string> = {
    总览: "overview",
    电影: "movies",
    电视剧: "tv-series",
  };

  const [selectedYear, setSelectedYear] = useState("All Time");
  const [displayedTopMovies, setDisplayedTopMovies] = useState(topMovies);
  const [displayedTopSeries, setDisplayedTopSeries] = useState(topSeries);
  const [topMediaError, setTopMediaError] = useState<string | null>(null);
  const [topMediaLoading, setTopMediaLoading] = useState(false);

  const currentYearData = summary.find(
    /** 从统计行中找到当前所选年份的数据。 */
    (item) => String(item.release_year) === String(selectedYear),
  );
  const movieDistribution = distributions.movies[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;
  const seriesDistribution = distributions.series[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;

  // 电影总数采用已看与未看之和；进度按已看数量占比计算。
  const watchedMovies = currentYearData?.watched_movies || 0;
  const unwatchedMovies = currentYearData?.unwatched_movies || 0;
  const totalMovies = watchedMovies + unwatchedMovies;
  const moviesPercent = percent(watchedMovies, totalMovies);

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = percent(avgMoviesRating, 10);
  const moviesWatchedRuntime = currentYearData?.movies_watched_runtime ?? 0;
  const moviesUnwatchedRuntime = currentYearData?.movies_unwatched_runtime ?? 0;
  const totalMoviesRuntime = currentYearData?.total_movies_runtime ?? 0;

  // 电视剧总数包含已看、在看和未看三种状态，在看不计入已看进度。
  const watchedSeries = currentYearData?.watched_series || 0;
  const watchingSeries = currentYearData?.watching_series || 0;
  const unwatchedSeries = currentYearData?.unwatched_series || 0;
  const totalSeries = watchedSeries + watchingSeries + unwatchedSeries;
  const seriesPercent = percent(watchedSeries, totalSeries);

  // 电视剧进度按已看集数占比计算，真实反映追剧进展并避免全 0% 空白条。
  const watchedEpisodes = currentYearData?.watched_series_episodes ?? 0;
  const unwatchedEpisodes = currentYearData?.unwatched_episodes ?? 0;
  const totalEpisodes = currentYearData?.total_series_episodes ?? (watchedEpisodes + unwatchedEpisodes);
  const seriesEpisodesPercent = percent(watchedEpisodes, totalEpisodes);

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = percent(avgSeriesRating, 10);
  const seriesWatchedRuntime = currentYearData?.series_watched_runtime ?? 0;
  const seriesUnwatchedRuntime = currentYearData?.series_unwatched_runtime ?? 0;
  const totalSeriesRuntime = currentYearData?.total_series_runtime ?? 0;

  const watchedRuntime = currentYearData?.total_watched_runtime ?? 0;
  const totalRuntime = currentYearData?.total_runtime ?? 0;
  const runtimePercent = percent(watchedRuntime, totalRuntime);

  useEffect(/* 选择具体年份时启动榜单请求，离开该年份或卸载组件时取消请求。 */ () => {
    if (selectedYear === "All Time") {
      return;
    }

    const controller = new AbortController();
    /** 并行加载该年的电影和电视剧榜单，更新加载状态与结果，并显示非取消类错误。 */
    const loadTopMedia = async () => {
      try {
        setTopMediaError(null);
        setTopMediaLoading(true);
        setDisplayedTopMovies([]);
        setDisplayedTopSeries([]);
        const [moviesResponse, seriesResponse] = await Promise.all([
          fetch(`/api/top-media?type=movie&year=${encodeURIComponent(selectedYear)}&limit=10`, { signal: controller.signal }),
          fetch(`/api/top-media?type=tv_series&year=${encodeURIComponent(selectedYear)}&limit=10`, { signal: controller.signal }),
        ]);
        if (!moviesResponse.ok || !seriesResponse.ok) throw new Error("Failed to load top media");
        const [movies, series] = await Promise.all([moviesResponse.json(), seriesResponse.json()]);
        setDisplayedTopMovies(movies);
        setDisplayedTopSeries(series);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error);
          setTopMediaError("年度精选暂时无法加载，请稍后重试。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setTopMediaLoading(false);
        }
      }
    };

    void loadTopMedia();
    return /* 取消当前年份尚未完成的榜单请求。 */ () => controller.abort();
  }, [selectedYear]);

  const spotlightCandidates = selectedYear === "All Time"
    ? topMovies
    : (displayedTopMovies.length > 0 ? displayedTopMovies : topMovies);

  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-20 sm:pt-22 sm:px-6 lg:pt-24 lg:px-8">
      <section aria-labelledby="dashboard-title" className="surface-panel relative z-10 mb-2 rounded-3xl p-5 sm:p-6 lg:px-8 lg:py-6">
        <div className="relative">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-light)]/90">
            <span className="h-px w-8 bg-[var(--accent)]" />
            <span>{selectedYear === "All Time" ? "全时段档案" : `${selectedYear} 年度档案`}</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h1 id="dashboard-title" className="font-mono text-3xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-4xl lg:text-5xl">
                媒体全景
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/55 sm:mt-2.5 sm:text-sm sm:leading-6">
                收录我倾注在光影、声音与文字里的时光。
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 lg:min-w-100 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">电影总计</dt>
                <dd className="mt-1 font-mono text-xl font-medium text-white sm:text-2xl">
                  <AnimatedNumber value={totalMovies} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">电视剧总计</dt>
                <dd className="mt-1 font-mono text-xl font-medium text-white sm:text-2xl">
                  <AnimatedNumber value={totalSeries} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">完成进度</dt>
                <dd
                  className="mt-1 font-mono text-xl font-medium text-accent-light text-[var(--accent-light)] sm:text-2xl"
                  style={{ color: "var(--accent-light)" }}
                >
                  <AnimatedNumber value={runtimePercent} />%
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
          <div className="surface-control relative flex items-center rounded-xl p-1.5" role="tablist" aria-label="仪表板视图">
            {/* 平滑滑动的物理胶囊底块 */}
            <div
              aria-hidden="true"
              className="surface-active pointer-events-none absolute top-1.5 bottom-1.5 rounded-lg border border-[var(--accent-border)] shadow-[0_4px_15px_var(--accent-glow-soft)] transition-transform duration-300 ease-out"
              style={{
                width: `calc((100% - 12px) / ${tabs.length})`,
                transform: `translateX(calc(${tabs.indexOf(activeTab)} * 100%))`,
                background: "var(--accent-soft)",
                borderColor: "var(--accent-border)",
              }}
            />

            {tabs.map(/* 为每个看板分类渲染可切换的标签按钮。 */ (tab) => (
              <button
                key={tab}
                onClick={/* 将点击的分类设为当前看板标签。 */ () => setActiveTab(tab)}
                role="tab"
                id={`dashboard-tab-${tabIds[tab]}`}
                aria-controls={`dashboard-panel-${tabIds[tab]}`}
                aria-selected={activeTab === tab}
                className={`relative z-10 px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  activeTab === tab
                    ? "text-accent-hover text-[var(--accent-hover)] font-bold"
                    : "text-white/70 hover:text-white"
                }`}
                style={activeTab === tab ? { color: "var(--accent-hover)" } : undefined}
              >
                {tab}
              </button>
            ))}
          </div>

          <DashboardYearPicker
            years={summary.map(/* 提取统计行的年份，供年份选择器使用。 */ (item) => item.release_year)}
            selectedYear={selectedYear}
            onSelect={setSelectedYear}
          />
        </div>
      </section>

      <div className="w-full">
        {topMediaError && selectedYear !== "All Time" && (
          <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {topMediaError}
          </div>
        )}
        {topMediaLoading && selectedYear !== "All Time" && (
          <div role="status" className="surface-muted mb-6 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60">
            正在加载 {selectedYear} 年度精选…
          </div>
        )}
        {activeTab === "总览" && (
          <div key="overview" id="dashboard-panel-overview" role="tabpanel" aria-labelledby="dashboard-tab-overview" className="flex flex-col gap-4 md:gap-6">
            <SpotlightHero items={spotlightCandidates} yearLabel={selectedYear} />

            <div className="dashboard-deferred surface-card flex flex-col gap-6 rounded-2xl p-4 sm:p-5 lg:p-6">
              <div className="flex items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                    <span className="i-material-symbols-movie-rounded size-4 inline-block" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 tracking-wide">
                    电影看板
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MediaStatusCard
                  title="已观看"
                  icon="i-material-symbols-check-circle-outline-rounded"
                  count={watchedMovies}
                  href={getStatusSearchLink("movie", "watched", selectedYear)}
                />
                <MediaStatusCard
                  title="想要看"
                  icon="i-material-symbols-bookmark-outline-rounded"
                  count={unwatchedMovies}
                  href={getStatusSearchLink("movie", "want_to_watch", selectedYear)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-white/75 font-medium">
                  <span>观影完成度</span>
                  <span className="font-mono text-white/90">{watchedMovies} / {totalMovies} 部 · {moviesPercent}%</span>
                </div>
                <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
                  <div
                    className="h-full bg-linear-to-r from-[var(--accent-dark)] to-[var(--accent-hover)] rounded-full transition-all duration-500"
                    style={{ width: `${moviesPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-deferred surface-card flex flex-col gap-6 rounded-2xl p-4 sm:p-5 lg:p-6">
              <div className="flex items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                    <span className="i-material-symbols-tv-rounded size-4 inline-block" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 tracking-wide">
                    电视剧看板
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <MediaStatusCard
                  title="已观看"
                  icon="i-material-symbols-check-circle-outline-rounded"
                  count={watchedSeries}
                  seasonsCount={currentYearData?.watched_seasons ?? 0}
                  episodesCount={currentYearData?.watched_series_episodes ?? 0}
                  href={getStatusSearchLink("tv_series", "watched", selectedYear)}
                />
                <MediaStatusCard
                  title="正在看"
                  icon="i-material-symbols-play-circle-outline-rounded"
                  count={watchingSeries}
                  seasonsCount={currentYearData?.watching_seasons ?? 0}
                  href={getStatusSearchLink("tv_series", "watching", selectedYear)}
                />
                <MediaStatusCard
                  title="想要看"
                  icon="i-material-symbols-bookmark-outline-rounded"
                  count={unwatchedSeries}
                  seasonsCount={currentYearData?.unwatched_seasons ?? 0}
                  episodesCount={currentYearData?.unwatched_episodes ?? 0}
                  href={getStatusSearchLink("tv_series", "want_to_watch", selectedYear)}
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-white/75 font-medium">
                  <span>追剧集数进度</span>
                  <span className="font-mono text-white/90">{watchedEpisodes} / {totalEpisodes} 集 · {seriesEpisodesPercent}%</span>
                </div>
                <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
                  <div
                    className="h-full bg-linear-to-r from-[var(--accent-dark)] to-[var(--accent-hover)] rounded-full transition-all duration-500"
                    style={{ width: `${seriesEpisodesPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "电影" && (
          <div key="movies" id="dashboard-panel-movies" role="tabpanel" aria-labelledby="dashboard-tab-movies" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear === "All Time" ? "全时段" : selectedYear}
              categoryName="电影"
              watchedCount={watchedMovies}
              totalCount={totalMovies}
              watchedPercent={moviesPercent}
              avgRating={avgMoviesRating}
              avgRatingPercent={avgMoviesRatingPercent}
            />

            <MediaRuntimeCards
              watchedRuntime={moviesWatchedRuntime}
              unwatchedRuntime={moviesUnwatchedRuntime}
              totalRuntime={totalMoviesRuntime}
            />

            <DistributionTop5Cards distribution={movieDistribution} />

            <div className="space-y-12 mt-4">
              {topMediaLoading ? (
                <PosterRowSkeleton />
              ) : (
                <MediaRow
                  title={selectedYear === "All Time" ? "影史精选" : `${selectedYear} 年度精选`}
                  items={selectedYear === "All Time" ? topMovies : displayedTopMovies}
                  viewAllLink={getSearchViewAllLink("movie", selectedYear)}
                  type="movies"
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "电视剧" && (
          <div key="tv-series" id="dashboard-panel-tv-series" role="tabpanel" aria-labelledby="dashboard-tab-tv-series" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear === "All Time" ? "全时段" : selectedYear}
              categoryName="电视剧"
              watchedCount={watchedSeries}
              totalCount={totalSeries}
              watchedPercent={seriesPercent}
              avgRating={avgSeriesRating}
              avgRatingPercent={avgSeriesRatingPercent}
            />

            <MediaRuntimeCards
              watchedRuntime={seriesWatchedRuntime}
              unwatchedRuntime={seriesUnwatchedRuntime}
              totalRuntime={totalSeriesRuntime}
            />

            <DistributionTop5Cards distribution={seriesDistribution} />

            <div className="space-y-12 mt-4">
              {topMediaLoading ? (
                <PosterRowSkeleton />
              ) : (
                <MediaRow
                  title={selectedYear === "All Time" ? "影史精选" : `${selectedYear} 年度精选`}
                  items={selectedYear === "All Time" ? topSeries : displayedTopSeries}
                  viewAllLink={getSearchViewAllLink("tv_series", selectedYear)}
                  type="series"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
