export type Summary = {
  release_year: number | string;
  
  // ================= 总计时长 (分钟) =================
  total_runtime: number;
  total_watched_runtime: number;
  total_unwatched_runtime: number;

  // ================= 电影 (Movies) =================
  total_movies: number;
  watched_movies: number;
  unwatched_movies: number;
  
  total_movies_runtime: number;
  movies_watched_runtime: number;
  movies_unwatched_runtime: number;
  
  movie_avg_rating: number;

  // ================= 电视剧 - 部 (Series) =================
  total_series: number;
  watched_series: number;
  watching_series: number;
  unwatched_series: number;
  
  total_series_runtime: number;
  series_watched_runtime: number;
  series_unwatched_runtime: number;
  
  series_avg_rating: number;

  // ================= 电视剧 - 季 (Seasons) =================
  total_seasons: number;
  watched_seasons: number;
  watching_seasons: number;
  unwatched_seasons: number;

  // ================= 电视剧 - 集 (Episodes) =================
  total_series_episodes: number;
  watched_series_episodes: number;
  unwatched_episodes: number;
};