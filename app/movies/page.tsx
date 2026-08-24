import MoviesCatalog from './MoviesCatalog';
import { fetchMediaListServer, fetchStatsServer } from '@/lib/functions/media-repo';

export const revalidate = 60;

export default async function MoviesPage() {
  const [stats, watchedRes, wantRes] = await Promise.all([
    fetchStatsServer("movie"),
    fetchMediaListServer({ type: "movie", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaListServer({ type: "movie", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
  ]);

  return (
    <MoviesCatalog
      watched={watchedRes.rows}
      want={wantRes.rows}
      stats={{ total: stats.total, watched: stats.watched, want: stats.want, upcoming: stats.upcoming }}
    />
  );
}
