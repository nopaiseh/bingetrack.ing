"use client";

import dynamic from "next/dynamic";
import { PosterRowSkeleton } from "@/components/LoadingSkeletons";
import { getSearchViewAllLink } from "@/components/dashboard/dashboard-links";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import TopMediaInlineError from "@/components/dashboard/TopMediaInlineError";
import type { MediaCard } from "@/lib/types";
import { type CatalogDbMediaType } from "@/lib/media-types";

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

/** 电影或电视节目标签下的进度、时长、分布和精选榜单。两套标签共用同一结构。 */
export default function DashboardCategoryPanel({
  stats,
  panelKey,
  categoryName,
  isTopMediaLoading,
  topMediaError = null,
  onRetryTopMedia,
  allTimeTitle,
  selectedYear,
  allTimeItems,
  yearItems,
  mediaType,
  searchType,
}: {
  stats: DashboardStats;
  panelKey: "movies" | "tv-shows";
  categoryName: string;
  isTopMediaLoading: boolean;
  topMediaError?: string | null;
  onRetryTopMedia?: () => void;
  allTimeTitle: string;
  selectedYear: string;
  allTimeItems: MediaCard[];
  yearItems: MediaCard[];
  mediaType: Extract<CatalogDbMediaType, "movie" | "tv_show">;
  searchType: Extract<CatalogDbMediaType, "movie" | "tv_show">;
}) {
  const movies = panelKey === "movies";
  const watchedCount = movies ? stats.watchedMovies : stats.watchedSeries;
  const totalCount = movies ? stats.totalMovies : stats.totalSeries;
  const watchedPercent = movies ? stats.moviesPercent : stats.seriesPercent;
  const avgRating = movies ? stats.avgMoviesRating : stats.avgSeriesRating;
  const avgRatingPercent = movies ? stats.avgMoviesRatingPercent : stats.avgSeriesRatingPercent;
  const watchedRuntime = movies ? stats.moviesWatchedRuntime : stats.seriesWatchedRuntime;
  const unwatchedRuntime = movies ? stats.moviesUnwatchedRuntime : stats.seriesUnwatchedRuntime;
  const totalRuntime = movies ? stats.totalMoviesRuntime : stats.totalSeriesRuntime;
  const distribution = movies ? stats.movieDistribution : stats.seriesDistribution;

  return (
    <div
      id={`dashboard-panel-${panelKey}`}
      role="tabpanel"
      aria-labelledby={`dashboard-tab-${panelKey}`}
      className="animate-fade-in flex flex-col gap-4 md:gap-6"
    >
      <CategoryHeaderCards
        year={selectedYear === "All Time" ? "全时段" : selectedYear}
        categoryName={categoryName}
        watchedCount={watchedCount}
        totalCount={totalCount}
        watchedPercent={watchedPercent}
        avgRating={avgRating}
        avgRatingPercent={avgRatingPercent}
      />

      <MediaRuntimeCards
        watchedRuntime={watchedRuntime}
        unwatchedRuntime={unwatchedRuntime}
        totalRuntime={totalRuntime}
      />

      <DistributionTop5Cards distribution={distribution} />

      <div className="space-y-12 mt-4">
        {isTopMediaLoading ? (
          <PosterRowSkeleton />
        ) : topMediaError && onRetryTopMedia ? (
          <TopMediaInlineError message={topMediaError} onRetry={onRetryTopMedia} />
        ) : (
          <MediaRow
            title={selectedYear === "All Time" ? allTimeTitle : `${selectedYear} 年度精选`}
            items={selectedYear === "All Time" ? allTimeItems : yearItems}
            viewAllLink={getSearchViewAllLink(searchType, selectedYear)}
            type={mediaType}
          />
        )}
      </div>
    </div>
  );
}
