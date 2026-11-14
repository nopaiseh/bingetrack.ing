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

  // 电影总数采用已看与未看之和；进度按已看数量占比计算。
  const watchedMovies = currentYearData?.watched_movies || 0;
  const unwatchedMovies = currentYearData?.unwatched_movies || 0;
  const totalMovies = watchedMovies + unwatchedMovies;
  const moviesPercent = percent(watchedMovies, totalMovies);

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = percent(avgMoviesRating, 10);
  const moviesWatchedRuntime = currentYearData?.movies_watched_runtime ?? 0;
  const moviesUnwatchedRuntime = currentYearData?.movies_unwatched_runtime ?? 0;
  const totalMoviesRuntime = currentYearData?.total_movies_runtime ?? 0;

  // 电视节目总数包含已看、在看和未看三种状态，在看不计入已看进度。
  const watchedSeries = currentYearData?.watched_series || 0;
  const watchingSeries = currentYearData?.watching_series || 0;
  const unwatchedSeries = currentYearData?.unwatched_series || 0;
  const totalSeries = watchedSeries + watchingSeries + unwatchedSeries;
  const seriesPercent = percent(watchedSeries, totalSeries);

  // 电视节目进度按已看集数占比计算，真实反映追剧进展并避免全 0% 空白条。
  const watchedEpisodes = currentYearData?.watched_series_episodes ?? 0;
  const unwatchedEpisodes = currentYearData?.unwatched_episodes ?? 0;
  const totalEpisodes = currentYearData?.total_series_episodes ?? (watchedEpisodes + unwatchedEpisodes);
  const seriesEpisodesPercent = percent(watchedEpisodes, totalEpisodes);

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = percent(avgSeriesRating, 10);
  const seriesWatchedRuntime = currentYearData?.series_watched_runtime ?? 0;
  const seriesUnwatchedRuntime = currentYearData?.series_unwatched_runtime ?? 0;
  const totalSeriesRuntime = currentYearData?.total_series_runtime ?? 0;

  const watchedRuntime = currentYearData?.total_watched_runtime ?? 0;
  const totalRuntime = currentYearData?.total_runtime ?? 0;
  const runtimePercent = percent(watchedRuntime, totalRuntime);

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
  };
}
