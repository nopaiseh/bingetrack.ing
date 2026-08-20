import MoviesCatalog from './MoviesCatalog';
import { fetchMediaListServer, fetchStatsServer } from '@/lib/functions/media-repo';

export const revalidate = 60;

export default async function MoviesPage() {
  const stats = await fetchStatsServer('movie');

  // 已看与想看的示例：这里仍可根据需求通过 status 字段进一步过滤
  const watchedRes = await fetchMediaListServer({ type: 'movie', status: 'watched', limit: 10, offset: 0, sort: 'date_desc' });
  const wantRes = await fetchMediaListServer({ type: 'movie', status: 'want_to_watch', limit: 10, offset: 0, sort: 'date_desc' });

  const watchedMovies = watchedRes.rows;
  const wantMovies = wantRes.rows;

  return (
    <MoviesCatalog
      watched={watchedMovies}
      want={wantMovies}
      stats={{ total: stats.total, watched: stats.watched, want: stats.want, upcoming: stats.upcoming }}
    />
  );
}
