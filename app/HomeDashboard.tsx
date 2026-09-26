"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { PosterRowSkeleton } from "@/components/LoadingSkeletons";
import DashboardYearPicker from "@/components/DashboardYearPicker";
import SpotlightHero from "@/components/SpotlightHero";
import AnimatedNumber from "@/components/AnimatedNumber";
import { parseRuntimeParts } from "@/lib/format-runtime";
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
function getStatusSearchLink(type: "movie" | "tv_series", status: "watched" | "watching" | "want_to_watch", year: string) {
  const params = new URLSearchParams({ type, status });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

/** 按媒体分类生成评分降序的搜索链接；指定年份时同时限定起止年份。 */
function getSearchViewAllLink(type: "movie" | "tv_series", year: string) {
  const params = new URLSearchParams({ type, sort: "rating_desc" });
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

/** 只保留最大的两个时间单位，让时长在窄卡片里也能一行放下。 */
function compactRuntime(runtime: number) {
  const { days, hours, minutes } = parseRuntimeParts(runtime);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

/** 按传入标题和图标展示媒体部数，并用一行补充信息（时长或季数、集数）保持各卡片结构一致；提供 href 时作为可点击跳转卡片。 */
function MediaStatusCard({
  title,
  icon,
  count,
  details,
  detailsIcon,
  href,
}: {
  title: string;
  icon: string;
  count: number;
  details: string;
  detailsIcon?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between text-sm font-semibold text-white/85 transition-colors group-hover:text-[var(--accent-hover)]">
        <div className="flex items-center gap-2.5">
          <span className={`${icon} size-4 inline-block text-[var(--accent)] group-hover:text-[var(--accent-hover)]`} aria-hidden="true" />
          <span>{title}</span>
        </div>
        {href && (
          <span className="i-material-symbols-arrow-outward-rounded hidden size-3.5 text-white/40 sm:inline-block transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl tracking-tight text-white sm:text-4xl">
          <AnimatedNumber value={count} />
        </span>
        <span className="text-sm text-white/70">部</span>
      </div>
      <p className="flex items-center gap-1.5 font-mono text-xs text-white/72">
        {detailsIcon && <><span className={`${detailsIcon} size-3.5 shrink-0`} aria-hidden="true" /><span className="sr-only">时长</span></>}
        <span>{details}</span>
      </p>
    </>
  );

  const containerClasses = "surface-inline group flex min-w-0 flex-col gap-3 rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${containerClasses} cursor-pointer`}
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

  // 请求中途切回全时段时，被取消的请求不会复位加载状态，因此只在选定年份时采用该状态。
  const isTopMediaLoading = topMediaLoading && selectedYear !== "All Time";

  // 所选年份没有榜单（或仍在加载）时展示全时段精选，标签也随之显示为全时段，避免年份与内容不符。
  const showYearSpotlight = selectedYear !== "All Time" && displayedTopMovies.length > 0;
  const spotlightCandidates = showYearSpotlight ? displayedTopMovies : topMovies;

  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-20 sm:pt-22 sm:px-6 lg:pt-24 lg:px-8">
      <section aria-labelledby="dashboard-title" className="surface-panel dashboard-intro relative z-10 mb-2 rounded-3xl p-5 sm:p-6 lg:px-8 lg:py-6">
        <div className="relative">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-light)]/90">
            <span className="h-px w-8 bg-[var(--accent)]" />
            <span>{selectedYear === "All Time" ? "全时段档案" : `${selectedYear} 年度档案`}</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h1 id="dashboard-title" className="font-serif-movie text-3xl font-black leading-none text-white sm:text-4xl lg:text-5xl">
                媒体全景
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/72 sm:mt-2.5 sm:text-sm sm:leading-6">
                收录我倾注在光影、声音与文字里的时光。
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 lg:min-w-100 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">电影总计</dt>
                <dd className="mt-1 font-mono text-2xl font-normal tracking-tight text-white sm:text-3xl">
                  <AnimatedNumber value={totalMovies} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">电视剧总计</dt>
                <dd className="mt-1 font-mono text-2xl font-normal tracking-tight text-white sm:text-3xl">
                  <AnimatedNumber value={totalSeries} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/75">完成进度</dt>
                <dd
                  className="mt-1 font-mono text-2xl font-normal tracking-tight text-accent-light sm:text-3xl"
                >
                  <AnimatedNumber value={runtimePercent} />%
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
          <div className="relative flex items-center rounded-full bg-black/25 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]" role="tablist" aria-label="仪表板视图">
            {/* 平滑滑动的物理胶囊底块 */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_14px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-out"
              style={{
                width: `calc((100% - 8px) / ${tabs.length})`,
                transform: `translateX(calc(${tabs.indexOf(activeTab)} * 100%))`,
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
                className={`relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  activeTab === tab
                    ? "text-white font-bold"
                    : "text-white/72 hover:text-white"
                }`}
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
        {isTopMediaLoading && (
          <div role="status" className="surface-muted mb-6 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60">
            正在加载 {selectedYear} 年度精选…
          </div>
        )}
        {activeTab === "总览" && (
          <div key="overview" id="dashboard-panel-overview" role="tabpanel" aria-labelledby="dashboard-tab-overview" className="flex flex-col gap-4 md:gap-6">
            <SpotlightHero items={spotlightCandidates} yearLabel={showYearSpotlight ? selectedYear : "All Time"} />

            <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
            <div className="dashboard-deferred surface-card flex h-full flex-col gap-6 rounded-3xl p-4 sm:p-5 lg:p-7">
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

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <MediaStatusCard
                  title="已观看"
                  icon="i-material-symbols-check-circle-outline-rounded"
                  count={watchedMovies}
                  details={compactRuntime(moviesWatchedRuntime)}
                  detailsIcon="i-material-symbols-schedule-outline-rounded"
                  href={getStatusSearchLink("movie", "watched", selectedYear)}
                />
                <MediaStatusCard
                  title="想要看"
                  icon="i-material-symbols-bookmark-outline-rounded"
                  count={unwatchedMovies}
                  details={compactRuntime(moviesUnwatchedRuntime)}
                  detailsIcon="i-material-symbols-schedule-outline-rounded"
                  href={getStatusSearchLink("movie", "want_to_watch", selectedYear)}
                />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-white/75 font-medium">
                  <span>观影完成度</span>
                  <span className="font-mono text-white/90">{watchedMovies} / {totalMovies} 部 · {moviesPercent}%</span>
                </div>
                <div className="progress-track h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="progress-fill h-full rounded-full transition-all duration-500"
                    style={{ width: `${moviesPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-deferred surface-card flex h-full flex-col gap-6 rounded-3xl p-4 sm:p-5 lg:p-7">
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

              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <MediaStatusCard
                  title="已观看"
                  icon="i-material-symbols-check-circle-outline-rounded"
                  count={watchedSeries}
                  details={`${currentYearData?.watched_seasons ?? 0}季 · ${watchedEpisodes}集`}
                  href={getStatusSearchLink("tv_series", "watched", selectedYear)}
                />
                <MediaStatusCard
                  title="正在看"
                  icon="i-material-symbols-play-circle-outline-rounded"
                  count={watchingSeries}
                  details={`${currentYearData?.watching_seasons ?? 0}季`}
                  href={getStatusSearchLink("tv_series", "watching", selectedYear)}
                />
                <MediaStatusCard
                  title="想要看"
                  icon="i-material-symbols-bookmark-outline-rounded"
                  count={unwatchedSeries}
                  details={`${currentYearData?.unwatched_seasons ?? 0}季 · ${unwatchedEpisodes}集`}
                  href={getStatusSearchLink("tv_series", "want_to_watch", selectedYear)}
                />
              </div>
              
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-white/75 font-medium">
                  <span>追剧集数进度</span>
                  <span className="font-mono text-white/90">{watchedEpisodes} / {totalEpisodes} 集 · {seriesEpisodesPercent}%</span>
                </div>
                <div className="progress-track h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="progress-fill h-full rounded-full transition-all duration-500"
                    style={{ width: `${seriesEpisodesPercent}%` }}
                  />
                </div>
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
              {isTopMediaLoading ? (
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
              {isTopMediaLoading ? (
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
