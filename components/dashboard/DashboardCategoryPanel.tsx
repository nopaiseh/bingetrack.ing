"use client";

import dynamic from "next/dynamic";
import { PosterRowSkeleton } from "@/components/LoadingSkeletons";
import { getSearchViewAllLink } from "@/components/dashboard/dashboard-links";
import type { MediaCard, MediaDistribution } from "@/lib/types";

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
  panelKey,
  categoryName,
  watchedCount,
  totalCount,
  watchedPercent,
  avgRating,
  avgRatingPercent,
  watchedRuntime,
  unwatchedRuntime,
  totalRuntime,
  distribution,
  isTopMediaLoading,
  allTimeTitle,
  selectedYear,
  allTimeItems,
  yearItems,
  mediaType,
  searchType,
}: {
  panelKey: "movies" | "tv-shows";
  categoryName: string;
  watchedCount: number;
  totalCount: number;
  watchedPercent: number;
  avgRating: number;
  avgRatingPercent: number;
  watchedRuntime: number;
  unwatchedRuntime: number;
  totalRuntime: number;
  distribution: MediaDistribution;
  isTopMediaLoading: boolean;
  allTimeTitle: string;
  selectedYear: string;
  allTimeItems: MediaCard[];
  yearItems: MediaCard[];
  mediaType: "movies" | "shows";
  searchType: "movie" | "tv_show";
}) {
  return (
    <div key={panelKey} id={`dashboard-panel-${panelKey}`} role="tabpanel" aria-labelledby={`dashboard-tab-${panelKey}`} className="animate-fade-in flex flex-col gap-4 md:gap-6">
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
