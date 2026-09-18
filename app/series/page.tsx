import SeriesCatalog from "./SeriesCatalog";
import { fetchMediaCardsServer, fetchStatsServer } from "@/lib/functions/media-repo";
import type { MediaCard } from "@/lib/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "电视剧",
  description: "浏览已看、在看与想看的电视剧记录。",
};

// 电视剧目录按 24 小时长缓存，数据变更由管理端即时按需刷新。
export const revalidate = 86400;

const DEFAULT_SERIES_STATS = { total: 0, watched: 0, watching: 0, want: 0, upcoming: 0 };

/** 并行读取电视剧统计与已看、在看、想看卡片，交给目录组件展示；在静态预渲染或数据库超时时降级渲染基础骨架，避免阻断构建。 */
export default async function SeriesPage() {
  let stats = DEFAULT_SERIES_STATS;
  let watchedRes: MediaCard[] = [];
  let watchingRes: MediaCard[] = [];
  let wantRes: MediaCard[] = [];

  try {
    const [fetchedStats, fetchedWatched, fetchedWatching, fetchedWant] = await Promise.all([
      fetchStatsServer("tv_series"),
      fetchMediaCardsServer({ type: "tv_series", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "tv_series", status: "watching", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "tv_series", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
    ]);
    stats = {
      total: fetchedStats.total,
      watched: fetchedStats.watched,
      watching: fetchedStats.watching,
      want: fetchedStats.want,
      upcoming: fetchedStats.upcoming,
    };
    watchedRes = fetchedWatched;
    watchingRes = fetchedWatching;
    wantRes = fetchedWant;
  } catch (error) {
    console.error("Failed to fetch series page data, falling back to empty catalog:", error);
  }

  return (
    <SeriesCatalog
      watched={watchedRes}
      want={wantRes}
      watching={watchingRes}
      stats={stats}
    />
  );
}
