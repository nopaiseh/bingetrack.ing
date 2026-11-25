"use client";

import DashboardCategoryPanel from "@/components/dashboard/DashboardCategoryPanel";
import MusicBookCategoryPanel from "@/components/dashboard/MusicBookCategoryPanel";
import OverviewBoards from "@/components/dashboard/OverviewBoards";
import TopMediaInlineError from "@/components/dashboard/TopMediaInlineError";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import type { TopMediaType } from "@/components/dashboard/top-media-fetch";
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
    topType: "movie" as const,
  },
  {
    tab: MEDIA_TYPE_DEFINITIONS.tv_show.label,
    panelKey: "tv-shows" as const,
    categoryName: MEDIA_TYPE_DEFINITIONS.tv_show.label,
    allTimeTitle: "剧集精选",
    mediaType: "tv_show" as const,
    searchType: "tv_show" as const,
    itemsKey: "shows" as const,
    topType: "tv_show" as const,
  },
] as const;

const OVERVIEW_ERROR_LABELS: Record<TopMediaType, string> = {
  movie: "电影",
  tv_show: "电视节目",
  album: "音乐",
  book: "图书",
};

/** 按当前标签展示总览、电影、电视节目、音乐或图书，并显示年度精选的加载与错误状态。 */
export default function DashboardPanels({
  stats,
  activeTab,
  selectedYear,
  topMediaErrors,
  isTopMediaLoading,
  topMediaLoadingByType,
  onRetryTopMedia,
  topMovies,
  displayedTopMovies,
  topSeries,
  displayedTopSeries,
  topAlbums,
  displayedTopAlbums,
  topBooks,
  displayedTopBooks,
}: {
  stats: DashboardStats;
  activeTab: string;
  selectedYear: string;
  topMediaErrors: Partial<Record<TopMediaType, string>>;
  isTopMediaLoading: boolean;
  topMediaLoadingByType: Partial<Record<TopMediaType, boolean>>;
  onRetryTopMedia: (type: TopMediaType) => void;
  topMovies: MediaCard[];
  displayedTopMovies: MediaCard[];
  topSeries: MediaCard[];
  displayedTopSeries: MediaCard[];
  topAlbums: MediaCard[];
  displayedTopAlbums: MediaCard[];
  topBooks: MediaCard[];
  displayedTopBooks: MediaCard[];
}) {
  const itemsByKey = {
    movies: { allTime: topMovies, year: displayedTopMovies },
    shows: { allTime: topSeries, year: displayedTopSeries },
  };

  const overviewErrors =
    activeTab === "总览" && selectedYear !== "All Time"
      ? (Object.entries(topMediaErrors) as [TopMediaType, string][])
      : [];

  return (
    <div className="w-full">
      {overviewErrors.map(([type, message]) => (
        <div key={type} className="mb-6">
          <TopMediaInlineError
            message={`${OVERVIEW_ERROR_LABELS[type]}：${message}`}
            onRetry={() => onRetryTopMedia(type)}
          />
        </div>
      ))}
      {isTopMediaLoading && activeTab === "总览" && (
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
            isTopMediaLoading={Boolean(topMediaLoadingByType[panel.topType])}
            topMediaError={topMediaErrors[panel.topType] ?? null}
            onRetryTopMedia={() => onRetryTopMedia(panel.topType)}
            allTimeTitle={panel.allTimeTitle}
            selectedYear={selectedYear}
            allTimeItems={itemsByKey[panel.itemsKey].allTime}
            yearItems={itemsByKey[panel.itemsKey].year}
            mediaType={panel.mediaType}
            searchType={panel.searchType}
          />
        ) : null,
      )}
      {activeTab === "音乐" && (
        <MusicBookCategoryPanel
          stats={stats}
          kind="music"
          selectedYear={selectedYear}
          isTopMediaLoading={Boolean(topMediaLoadingByType.album)}
          topMediaError={topMediaErrors.album ?? null}
          onRetryTopMedia={() => onRetryTopMedia("album")}
          allTimeItems={topAlbums}
          yearItems={displayedTopAlbums}
        />
      )}
      {activeTab === "图书" && (
        <MusicBookCategoryPanel
          stats={stats}
          kind="books"
          selectedYear={selectedYear}
          isTopMediaLoading={Boolean(topMediaLoadingByType.book)}
          topMediaError={topMediaErrors.book ?? null}
          onRetryTopMedia={() => onRetryTopMedia("book")}
          allTimeItems={topBooks}
          yearItems={displayedTopBooks}
        />
      )}
    </div>
  );
}
