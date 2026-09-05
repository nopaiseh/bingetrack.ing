"use client";

import { useState, useEffect } from "react";
import MediaRow from "@/components/MediaRow";
import DashboardYearPicker from "@/components/DashboardYearPicker";
import { DistributionItem, MediaCard, MediaDistribution, MediaDistributions, Summary } from "@/lib/types";
import {
  ChartPie,
  CheckCircle,
  CircleEllipsis,
  Film,
  Globe2,
  Languages,
  Layers3,
  PauseCircle,
  PlayCircle,
  Tv,
  type LucideIcon,
} from "lucide-react";

const EMPTY_MEDIA_DISTRIBUTION: MediaDistribution = {
  regions: [],
  languages: [],
  genres: [],
};

function getSearchViewAllLink(type: "电影" | "电视剧", year: string) {
  const params = new URLSearchParams({ type, sort: "rating_desc" });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

function DistributionCard({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: DistributionItem[] }) {
  return (
    <div className="surface-card interactive-card group h-full rounded-2xl p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex h-8 items-center gap-3 text-sm text-neutral-400">
        <div className="surface-raised flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-colors duration-300 group-hover:bg-red-500/15 group-hover:text-red-400 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <span className="font-medium tracking-wide text-white/80 transition-colors group-hover:text-white">{title}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-20 truncate text-sm text-white/70" title={item.name}>{item.name}</span>
            <div className="progress-track h-1.5 flex-1 overflow-hidden rounded-full shadow-inner">
              <div className="h-full bg-neutral-300/80" style={{ width: `${item.percent}%` }} />
            </div>
            <span className="text-xs text-white/50 w-8 text-right">{item.percent}%</span>
          </div>
        ))}
        {items.length === 0 && <span className="py-6 text-center text-sm text-white/60">暂无数据</span>}
      </div>
    </div>
  );
}

function DistributionTop5Cards({ distribution }: { distribution: MediaDistribution }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <DistributionCard title="影视产地分布 Top 5" icon={Globe2} items={distribution.regions} />
      <DistributionCard title="主要语言 Top 5" icon={Languages} items={distribution.languages} />
      <DistributionCard title="主要类型 Top 5" icon={CircleEllipsis} items={distribution.genres} />
    </div>
  );
}

function CategoryHeaderCards({
  year,
  categoryName,
  watchedCount,
  totalCount,
  watchedPercent,
  avgRating,
  avgRatingPercent,
}: {
  year: string;
  categoryName: string;
  watchedCount: number;
  totalCount: number;
  watchedPercent: number;
  avgRating: number;
  avgRatingPercent: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
      <div className="surface-card interactive-card group col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:col-span-3 lg:p-6">
        <div className="text-white/60 mb-4 flex justify-between items-center drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
          <i className="text-xl font-medium">{year} {categoryName} 阅览进度</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{watchedCount}</span>
            <span className="text-sm text-white/50 font-medium">
              / {totalCount} 部 (已看 / 总数)
            </span>
          </div>
          <div className="progress-track h-2 w-full overflow-hidden rounded-full shadow-inner">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
              style={{
                width: `${watchedPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="surface-card interactive-card group col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:p-6">
        <div className="text-white/60 mb-4 flex justify-between items-center drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
          <i className="text-xl font-medium">平均{categoryName}评分</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{avgRating || 0}</span>
            <span className="text-sm text-white/50 font-medium">/ 10</span>
          </div>
          <div className="progress-track h-2 w-full overflow-hidden rounded-full shadow-inner">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
              style={{
                width: `${avgRatingPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaRuntimeCards({
  watchedRuntime,
  unwatchedRuntime,
  totalRuntime,
}: {
  watchedRuntime: number;
  unwatchedRuntime: number;
  totalRuntime: number;
}) {
  const completionPercent = percent(watchedRuntime, totalRuntime);
  const watchedHours = Math.round(watchedRuntime / 60);
  const unwatchedHours = Math.round(unwatchedRuntime / 60);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <PlayCircle className="size-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">已看总时长</span>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{watchedHours}</span>
            <span className="font-medium text-white/50">小时</span>
          </div>
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">
          相当于连续观看约 {Math.round(watchedHours / 24)} 天
        </p>
      </div>

      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <Layers3 className="size-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">待看总时长</span>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{unwatchedHours}</span>
            <span className="font-medium text-white/50">小时</span>
          </div>
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">尚未完成的内容时长</p>
      </div>

      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <ChartPie className="size-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">完成进度</span>
          </div>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="font-mono text-5xl tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{completionPercent}%</span>
            <span className="font-medium text-white/50">已完成</span>
          </div>
        </div>
        <div className="progress-track mt-2 h-2 w-full overflow-hidden rounded-full shadow-inner">
          <div className="h-full rounded-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

// Unified Status Card to handle both Movies and Series
function MediaStatusCard({
  title,
  icon: Icon,
  count,
  seasonsCount,
  episodesCount,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  seasonsCount?: number;
  episodesCount?: number;
}) {
  return (
    <div className="surface-muted group flex flex-col gap-4 rounded-xl border border-white/10 p-4 shadow-[0_4px_15px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-red-400/40 hover:bg-white/10 hover:shadow-[0_8px_25px_rgba(248,113,113,0.15)] sm:p-5">
      <div className="text-white/70 font-bold text-sm flex items-center gap-2 border-b border-white/10 pb-2 group-hover:text-red-300 transition-colors">
        <Icon className="size-4" aria-hidden="true" /> {title}
      </div>
      <div className="flex flex-col gap-3 mt-1">
        <div className="flex justify-between items-end">
          <span className="text-sm text-white/50">部数</span>
          <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
            {count} <span className="text-xs text-white/60 font-normal">部</span>
          </span>
        </div>
        {seasonsCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/50">季数</span>
            <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {seasonsCount} <span className="text-xs text-white/60 font-normal">季</span>
            </span>
          </div>
        )}
        {episodesCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/50">集数</span>
            <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {episodesCount} <span className="text-xs text-white/60 font-normal">集</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

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
    (item) => String(item.release_year) === String(selectedYear),
  );
  const movieDistribution = distributions.movies[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;
  const seriesDistribution = distributions.series[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;

  // Derive movie totals strictly from 2 tracking states (Watched + Unwatched)
  const watchedMovies = currentYearData?.watched_movies || 0;
  const unwatchedMovies = currentYearData?.unwatched_movies || 0;
  const totalMovies = watchedMovies + unwatchedMovies;
  const moviesPercent = percent(watchedMovies, totalMovies);

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = percent(avgMoviesRating, 10);
  const moviesWatchedRuntime = currentYearData?.movies_watched_runtime ?? 0;
  const moviesUnwatchedRuntime = currentYearData?.movies_unwatched_runtime ?? 0;
  const totalMoviesRuntime = currentYearData?.total_movies_runtime ?? 0;

  // Derive series totals strictly from 3 tracking states
  const watchedSeries = currentYearData?.watched_series || 0;
  const watchingSeries = currentYearData?.watching_series || 0;
  const unwatchedSeries = currentYearData?.unwatched_series || 0;
  const totalSeries = watchedSeries + watchingSeries + unwatchedSeries;
  const seriesPercent = percent(watchedSeries, totalSeries);

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = percent(avgSeriesRating, 10);
  const seriesWatchedRuntime = currentYearData?.series_watched_runtime ?? 0;
  const seriesUnwatchedRuntime = currentYearData?.series_unwatched_runtime ?? 0;
  const totalSeriesRuntime = currentYearData?.total_series_runtime ?? 0;

  const watchedRuntime = currentYearData?.total_watched_runtime ?? 0;
  const totalRuntime = currentYearData?.total_runtime ?? 0;
  const runtimePercent = percent(watchedRuntime, totalRuntime);

  useEffect(() => {
    if (selectedYear === "All Time") {
      return;
    }

    const controller = new AbortController();
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
    return () => controller.abort();
  }, [selectedYear]);

  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 pt-24 sm:px-6 lg:px-8">
      <section aria-labelledby="dashboard-title" className="relative z-10 mb-2 rounded-3xl border border-white/10 bg-[var(--surface-panel)] px-5 pb-5 pt-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:px-7 sm:pb-6 sm:pt-8 lg:px-10 lg:pb-8 lg:pt-10">
        <div className="relative">
          <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-red-300/90">
            <span className="h-px w-8 bg-red-400" />
            <span>{selectedYear === "All Time" ? "全时段档案" : `${selectedYear} 年度档案`}</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h1 id="dashboard-title" className="font-mono text-4xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-5xl lg:text-7xl">
                媒体全景
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
                收录我倾注在光影、声音与文字里的时光。
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-5 lg:min-w-100 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div>
                <dt className="text-[11px] tracking-wide text-white/60">电影总计</dt>
                <dd className="mt-1 font-mono text-xl font-medium text-white sm:text-2xl">{totalMovies}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/60">电视剧总计</dt>
                <dd className="mt-1 font-mono text-xl font-medium text-white sm:text-2xl">{totalSeries}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-white/60">完成进度</dt>
                <dd className="mt-1 font-mono text-xl font-medium text-red-300 sm:text-2xl">{runtimePercent}%</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="relative mt-7 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center">
          <div className="surface-control flex gap-1 rounded-xl p-1.5" role="tablist" aria-label="仪表板视图">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                id={`dashboard-tab-${tabIds[tab]}`}
                aria-controls={`dashboard-panel-${tabIds[tab]}`}
                aria-selected={activeTab === tab}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === tab
                    ? "surface-selected text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-white/20 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <DashboardYearPicker
            years={summary.map((item) => item.release_year)}
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
            {/* Movies Section (Updated to 2 columns) */}
            <div className="dashboard-deferred surface-card interactive-card group flex flex-col gap-6 rounded-2xl p-4 sm:p-5 lg:p-6">
              <div className="flex items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                    <Film className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                    电影看板
                  </span>
                </div>
              </div>

              {/* Grid set to grid-cols-2 as requested */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <MediaStatusCard
                  title="已观看"
                  icon={CheckCircle}
                  count={watchedMovies}
                />
                <MediaStatusCard
                  title="想要看"
                  icon={PauseCircle}
                  count={unwatchedMovies}
                />
              </div>

              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
                  style={{ width: `${moviesPercent}%` }}
                />
              </div>
            </div>

            {/* Series Section */}
            <div className="dashboard-deferred surface-card interactive-card group flex flex-col gap-6 rounded-2xl p-4 sm:p-5 lg:p-6">
              <div className="flex items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                    <Tv className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                    电视剧看板
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <MediaStatusCard
                  title="已观看"
                  icon={CheckCircle}
                  count={watchedSeries}
                  seasonsCount={currentYearData?.watched_seasons ?? 0}
                  episodesCount={currentYearData?.watched_series_episodes ?? 0}
                />
                <MediaStatusCard
                  title="正在看"
                  icon={PlayCircle}
                  count={watchingSeries}
                  seasonsCount={currentYearData?.watching_seasons ?? 0}
                />
                <MediaStatusCard
                  title="想要看"
                  icon={PauseCircle}
                  count={unwatchedSeries}
                  seasonsCount={currentYearData?.unwatched_seasons ?? 0}
                  episodesCount={currentYearData?.unwatched_episodes ?? 0}
                />
              </div>
              
              <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
                  style={{ width: `${seriesPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "电影" && (
          <div key="movies" id="dashboard-panel-movies" role="tabpanel" aria-labelledby="dashboard-tab-movies" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear}
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
              <MediaRow
                title="影史精选"
                items={selectedYear === "All Time" ? topMovies : displayedTopMovies}
                viewAllLink={getSearchViewAllLink("电影", selectedYear)}
                type="movies"
              />
            </div>
          </div>
        )}

        {activeTab === "电视剧" && (
          <div key="tv-series" id="dashboard-panel-tv-series" role="tabpanel" aria-labelledby="dashboard-tab-tv-series" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear}
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
              <MediaRow
                title="影史精选"
                items={selectedYear === "All Time" ? topSeries : displayedTopSeries}
                viewAllLink={getSearchViewAllLink("电视剧", selectedYear)}
                type="series"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
