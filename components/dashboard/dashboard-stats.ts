import type { MediaDistribution, MediaDistributions, Summary } from "@/lib/types";

export const EMPTY_MEDIA_DISTRIBUTION: MediaDistribution = {
  regions: [],
  languages: [],
  genres: [],
};

/** 将完成比例四舍五入为百分数并限制在 0 到 100；总数非正时返回 0。 */
export function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

/** 从年度统计和分布里取出当前年份的看板数字。 */
export function deriveDashboardStats(summary: Summary[], selectedYear: string, distributions: MediaDistributions) {
  const currentYearData = summary.find(
    /** 从统计行中找到当前所选年份的数据。 */
    (item) => String(item.release_year) === String(selectedYear),
  );
  const movieDistribution = distributions.movies[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;
  const seriesDistribution = distributions.shows[selectedYear] ?? EMPTY_MEDIA_DISTRIBUTION;

  // 电影总数采用已看与未看之和；进度按已看数量占比计算。缺行时全部为 0（某年仅有音乐／图书时影视看板不炸）。
  const watchedMovies = Number(currentYearData?.watched_movies) || 0;
  const unwatchedMovies = Number(currentYearData?.unwatched_movies) || 0;
  const totalMovies = watchedMovies + unwatchedMovies;
  const moviesPercent = percent(watchedMovies, totalMovies);

  const avgMoviesRating = readNullableRating(currentYearData?.movie_avg_rating);
  const avgMoviesRatingPercent = avgMoviesRating == null ? 0 : percent(avgMoviesRating, 10);
  const moviesWatchedRuntime = Number(currentYearData?.movies_watched_runtime) || 0;
  const moviesUnwatchedRuntime = Number(currentYearData?.movies_unwatched_runtime) || 0;
  const totalMoviesRuntime = Number(currentYearData?.total_movies_runtime) || 0;

  // 电视节目总数包含已看、在看和未看三种状态，在看不计入已看进度。
  const watchedSeries = Number(currentYearData?.watched_series) || 0;
  const watchingSeries = Number(currentYearData?.watching_series) || 0;
  const unwatchedSeries = Number(currentYearData?.unwatched_series) || 0;
  const totalSeries = watchedSeries + watchingSeries + unwatchedSeries;
  const seriesPercent = percent(watchedSeries, totalSeries);

  // 电视节目进度按已看集数占比计算，真实反映追剧进展并避免全 0% 空白条。
  const watchedEpisodes = Number(currentYearData?.watched_series_episodes) || 0;
  const unwatchedEpisodes = Number(currentYearData?.unwatched_episodes) || 0;
  const totalEpisodes = Number(currentYearData?.total_series_episodes) || watchedEpisodes + unwatchedEpisodes;
  const seriesEpisodesPercent = percent(watchedEpisodes, totalEpisodes);

  const avgSeriesRating = readNullableRating(currentYearData?.series_avg_rating);
  const avgSeriesRatingPercent = avgSeriesRating == null ? 0 : percent(avgSeriesRating, 10);
  const seriesWatchedRuntime = currentYearData?.series_watched_runtime ?? 0;
  const seriesUnwatchedRuntime = currentYearData?.series_unwatched_runtime ?? 0;
  const totalSeriesRuntime = currentYearData?.total_series_runtime ?? 0;

  const watchedRuntime = Number(currentYearData?.total_watched_runtime) || 0;
  const totalRuntime = Number(currentYearData?.total_runtime) || 0;
  const runtimePercent = percent(watchedRuntime, totalRuntime);

  // 专辑／图书／曲目仅做数据派生；全景音乐看板用曲目三列，时长仍只来自影视。
  const totalAlbums = Number(currentYearData?.total_albums) || 0;
  const listenedAlbums = Number(currentYearData?.listened_albums) || 0;
  const wantAlbums = Number(currentYearData?.want_albums) || 0;
  const totalBooks = Number(currentYearData?.total_books) || 0;
  const readBooks = Number(currentYearData?.read_books) || 0;
  const readingBooks = Number(currentYearData?.reading_books) || 0;
  const wantBooks = Number(currentYearData?.want_books) || 0;
  const totalTracks = Number(currentYearData?.total_tracks) || 0;
  const listenedTracks = Number(currentYearData?.listened_tracks) || 0;
  const wantTracks = Number(currentYearData?.want_tracks) || 0;
  const tracksPercent = percent(listenedTracks, totalTracks);
  const booksPercent = percent(readBooks, totalBooks);

  const avgAlbumsRating = readNullableRating(currentYearData?.album_avg_rating);
  const avgAlbumsRatingPercent = avgAlbumsRating == null ? 0 : percent(avgAlbumsRating, 10);
  const avgBooksRating = readNullableRating(currentYearData?.book_avg_rating);
  const avgBooksRatingPercent = avgBooksRating == null ? 0 : percent(avgBooksRating, 10);

  return {
    currentYearData,
    movieDistribution,
    seriesDistribution,
    watchedMovies,
    unwatchedMovies,
    totalMovies,
    moviesPercent,
    avgMoviesRating,
    avgMoviesRatingPercent,
    moviesWatchedRuntime,
    moviesUnwatchedRuntime,
    totalMoviesRuntime,
    watchedSeries,
    watchingSeries,
    unwatchedSeries,
    totalSeries,
    seriesPercent,
    watchedEpisodes,
    unwatchedEpisodes,
    totalEpisodes,
    seriesEpisodesPercent,
    avgSeriesRating,
    avgSeriesRatingPercent,
    seriesWatchedRuntime,
    seriesUnwatchedRuntime,
    totalSeriesRuntime,
    runtimePercent,
    totalAlbums,
    listenedAlbums,
    wantAlbums,
    totalBooks,
    readBooks,
    readingBooks,
    wantBooks,
    totalTracks,
    listenedTracks,
    wantTracks,
    tracksPercent,
    booksPercent,
    avgAlbumsRating,
    avgAlbumsRatingPercent,
    avgBooksRating,
    avgBooksRatingPercent,
  };
}

/** 把视图里的评分读成数字；null／undefined／NaN 视为暂无评分。 */
function readNullableRating(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export type DashboardStats = ReturnType<typeof deriveDashboardStats>;
