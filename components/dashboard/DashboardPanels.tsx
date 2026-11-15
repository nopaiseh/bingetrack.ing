"use client";

import DashboardCategoryPanel from "@/components/dashboard/DashboardCategoryPanel";
import OverviewBoards from "@/components/dashboard/OverviewBoards";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import type { MediaCard } from "@/lib/types";

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
      {activeTab === "电影" && (
        <DashboardCategoryPanel
          stats={stats}
          panelKey="movies"
          categoryName="电影"
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
          stats={stats}
          panelKey="tv-shows"
          categoryName="电视节目"
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
