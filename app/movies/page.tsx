import MoviesCatalog from './MoviesCatalog';
import { fetchMediaCardsServer, fetchStatsServer } from '@/lib/functions/media-repo';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "电影",
  description: "浏览已看、想看与即将上映的电影记录。",
};

export const revalidate = 60;

export default async function MoviesPage() {
  const [stats, watchedRes, wantRes] = await Promise.all([
    fetchStatsServer("movie"),
    fetchMediaCardsServer({ type: "movie", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaCardsServer({ type: "movie", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
  ]);

  return (
    <MoviesCatalog
      watched={watchedRes}
      want={wantRes}
      stats={{ total: stats.total, watched: stats.watched, want: stats.want, upcoming: stats.upcoming }}
    />
  );
}
