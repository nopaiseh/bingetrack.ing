"use client";

import DashboardCategoryPanel from "@/components/dashboard/DashboardCategoryPanel";
import OverviewBoards from "@/components/dashboard/OverviewBoards";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { MEDIA_TYPE_DEFINITIONS } from "@/lib/media-types";
import type { MediaCard } from "@/lib/types";

const CATEGORY_PANELS = [
  {
    tab: MEDIA_TYPE_DEFINITIONS.movie.label,
    panelKey: "movies" as const,
    categoryName: MEDIA_TYPE_DEFINITIONS.movie.label,
    allTimeTitle: "影史精选",
    mediaType: "movie" as const,
    searchType: "movie" as const,
    itemsKey: "movies" as const,
  },
  {
    tab: MEDIA_TYPE_DEFINITIONS.tv_show.label,
    panelKey: "tv-shows" as const,
    categoryName: MEDIA_TYPE_DEFINITIONS.tv_show.label,
    allTimeTitle: "剧集精选",
    mediaType: "tv_show" as const,
    searchType: "tv_show" as const,
    itemsKey: "shows" as const,
  },
] as const;

/** 按当前标签展示总览、电影或电视节目，并显示年度精选的加载与错误状态。 */
export default function DashboardPanels({
  stats,
  activeTab,
  selectedYear,
  topMediaError,
  isTopMediaLoading,
  topMovies,
  displayedTopMovies,
  topSeries,
  displayedTopSeries,
}: {
  stats: DashboardStats;
  activeTab: string;
  selectedYear: string;
  topMediaError: string | null;
  isTopMediaLoading: boolean;
  topMovies: MediaCard[];
  displayedTopMovies: MediaCard[];
  topSeries: MediaCard[];
  displayedTopSeries: MediaCard[];
}) {
  const itemsByKey = {
    movies: { allTime: topMovies, year: displayedTopMovies },
    shows: { allTime: topSeries, year: displayedTopSeries },
  };

  return (
    <div className="w-full">
      {topMediaError && selectedYear !== "All Time" && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {topMediaError}
        </div>
      )}
      {isTopMediaLoading && (
        <div
          role="status"
          className="surface-muted mb-6 rounded-xl border border-white/10 px-4 py-3 text-sm text-fg-muted"
        >
          正在加载 {selectedYear} 年度精选…
        </div>
      )}
      {activeTab === "总览" && <OverviewBoards stats={stats} selectedYear={selectedYear} />}
      {CATEGORY_PANELS.map((panel) =>
        activeTab === panel.tab ? (
          <DashboardCategoryPanel
            key={panel.panelKey}
            stats={stats}
            panelKey={panel.panelKey}
            categoryName={panel.categoryName}
            isTopMediaLoading={isTopMediaLoading}
            allTimeTitle={panel.allTimeTitle}
            selectedYear={selectedYear}
            allTimeItems={itemsByKey[panel.itemsKey].allTime}
            yearItems={itemsByKey[panel.itemsKey].year}
            mediaType={panel.mediaType}
            searchType={panel.searchType}
          />
        ) : null,
      )}
    </div>
  );
}
