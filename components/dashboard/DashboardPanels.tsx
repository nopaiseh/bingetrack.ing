"use client";

import DashboardCategoryPanel from "@/components/dashboard/DashboardCategoryPanel";
import OverviewBoards from "@/components/dashboard/OverviewBoards";
import type { MediaCard, MediaDistribution } from "@/lib/types";

/** 按当前标签展示总览、电影或电视节目，并显示年度精选的加载与错误状态。 */
export default function DashboardPanels({
  activeTab,
  selectedYear,
  topMediaError,
  isTopMediaLoading,
  watchedMovies,
  unwatchedMovies,
  totalMovies,
  moviesPercent,
  avgMoviesRating,
  avgMoviesRatingPercent,
  moviesWatchedRuntime,
  moviesUnwatchedRuntime,
  totalMoviesRuntime,
  movieDistribution,
  topMovies,
  displayedTopMovies,
  watchedSeries,
  watchingSeries,
  unwatchedSeries,
  watchedEpisodes,
  unwatchedEpisodes,
  totalEpisodes,
  seriesEpisodesPercent,
  watchedSeasons,
  watchingSeasons,
  unwatchedSeasons,
  totalSeries,
  seriesPercent,
  avgSeriesRating,
  avgSeriesRatingPercent,
  seriesWatchedRuntime,
  seriesUnwatchedRuntime,
  totalSeriesRuntime,
  seriesDistribution,
  topSeries,
  displayedTopSeries,
}: {
  activeTab: string;
  selectedYear: string;
  topMediaError: string | null;
  isTopMediaLoading: boolean;
  watchedMovies: number;
  unwatchedMovies: number;
  totalMovies: number;
  moviesPercent: number;
  avgMoviesRating: number;
  avgMoviesRatingPercent: number;
  moviesWatchedRuntime: number;
  moviesUnwatchedRuntime: number;
  totalMoviesRuntime: number;
  movieDistribution: MediaDistribution;
  topMovies: MediaCard[];
  displayedTopMovies: MediaCard[];
  watchedSeries: number;
  watchingSeries: number;
  unwatchedSeries: number;
  watchedEpisodes: number;
  unwatchedEpisodes: number;
  totalEpisodes: number;
  seriesEpisodesPercent: number;
  watchedSeasons: number;
  watchingSeasons: number;
  unwatchedSeasons: number;
  totalSeries: number;
  seriesPercent: number;
  avgSeriesRating: number;
  avgSeriesRatingPercent: number;
  seriesWatchedRuntime: number;
  seriesUnwatchedRuntime: number;
  totalSeriesRuntime: number;
  seriesDistribution: MediaDistribution;
  topSeries: MediaCard[];
  displayedTopSeries: MediaCard[];
}) {
  return (
    <div className="w-full">
      {topMediaError && selectedYear !== "All Time" && (
        <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {topMediaError}
        </div>
      )}
      {isTopMediaLoading && (
        <div role="status" className="surface-muted mb-6 rounded-xl border border-white/10 px-4 py-3 text-sm text-fg-muted">
          正在加载 {selectedYear} 年度精选…
        </div>
      )}
      {activeTab === "总览" && (
        <OverviewBoards
          selectedYear={selectedYear}
          watchedMovies={watchedMovies}
          unwatchedMovies={unwatchedMovies}
          totalMovies={totalMovies}
          moviesPercent={moviesPercent}
          watchedSeries={watchedSeries}
          watchingSeries={watchingSeries}
          unwatchedSeries={unwatchedSeries}
          watchedEpisodes={watchedEpisodes}
          unwatchedEpisodes={unwatchedEpisodes}
          totalEpisodes={totalEpisodes}
          seriesEpisodesPercent={seriesEpisodesPercent}
          watchedSeasons={watchedSeasons}
          watchingSeasons={watchingSeasons}
          unwatchedSeasons={unwatchedSeasons}
        />
      )}
      {activeTab === "电影" && (
        <DashboardCategoryPanel
          panelKey="movies"
          categoryName="电影"
          watchedCount={watchedMovies}
          totalCount={totalMovies}
          watchedPercent={moviesPercent}
          avgRating={avgMoviesRating}
          avgRatingPercent={avgMoviesRatingPercent}
          watchedRuntime={moviesWatchedRuntime}
          unwatchedRuntime={moviesUnwatchedRuntime}
          totalRuntime={totalMoviesRuntime}
          distribution={movieDistribution}
          isTopMediaLoading={isTopMediaLoading}
          allTimeTitle="影史精选"
          selectedYear={selectedYear}
          allTimeItems={topMovies}
          yearItems={displayedTopMovies}
          mediaType="movies"
          searchType="movie"
        />
      )}
      {activeTab === "电视节目" && (
        <DashboardCategoryPanel
          panelKey="tv-shows"
          categoryName="电视节目"
          watchedCount={watchedSeries}
          totalCount={totalSeries}
          watchedPercent={seriesPercent}
          avgRating={avgSeriesRating}
          avgRatingPercent={avgSeriesRatingPercent}
          watchedRuntime={seriesWatchedRuntime}
          unwatchedRuntime={seriesUnwatchedRuntime}
          totalRuntime={totalSeriesRuntime}
          distribution={seriesDistribution}
          isTopMediaLoading={isTopMediaLoading}
          allTimeTitle="剧集精选"
          selectedYear={selectedYear}
          allTimeItems={topSeries}
          yearItems={displayedTopSeries}
          mediaType="shows"
          searchType="tv_show"
        />
      )}
    </div>
  );
}
