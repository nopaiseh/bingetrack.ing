import MoviesCatalog from './MoviesCatalog';
import { fetchMediaCardsServer, fetchStatsServer } from '@/lib/functions/media-repo';
import { handlePageDataError } from '@/lib/functions/page-data';
import type { MediaCard } from '@/lib/types';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "电影",
  description: "浏览已看、想看与即将上映的电影记录。",
};

// 电影目录按 24 小时长缓存，数据变更由管理端即时按需刷新。
export const revalidate = 86400;

const DEFAULT_MOVIE_STATS = { total: 0, watched: 0, want: 0, upcoming: 0 };

/** 并行读取电影统计及最近的已看、想看卡片，再交给目录组件展示；仅构建期失败时降级渲染基础骨架，运行期失败保留旧页面。 */
export default async function MoviesPage() {
  let stats = DEFAULT_MOVIE_STATS;
  let watchedRes: MediaCard[] = [];
  let wantRes: MediaCard[] = [];

  try {
    const [fetchedStats, fetchedWatched, fetchedWant] = await Promise.all([
      fetchStatsServer("movie"),
      fetchMediaCardsServer({ type: "movie", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "movie", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
    ]);
    stats = {
      total: fetchedStats.total,
      watched: fetchedStats.watched,
      want: fetchedStats.want,
      upcoming: fetchedStats.upcoming,
    };
    watchedRes = fetchedWatched;
    wantRes = fetchedWant;
  } catch (error) {
    handlePageDataError("movies page", error);
  }

  return (
    <MoviesCatalog
      watched={watchedRes}
      want={wantRes}
      stats={stats}
    />
  );
}
