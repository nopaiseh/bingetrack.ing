export type Summary = {
  release_year: number | string;

  total_runtime: number;
  total_watched_runtime: number;
  total_unwatched_runtime: number;

  total_movies: number;
  watched_movies: number;
  unwatched_movies: number;
  
  total_movies_runtime: number;
  movies_watched_runtime: number;
  movies_unwatched_runtime: number;
  
  movie_avg_rating: number;

  total_series: number;
  watched_series: number;
  watching_series: number;
  unwatched_series: number;
  
  total_series_runtime: number;
  series_watched_runtime: number;
  series_unwatched_runtime: number;
  
  series_avg_rating: number;

  total_seasons: number;
  watched_seasons: number;
  watching_seasons: number;
  unwatched_seasons: number;

  total_series_episodes: number;
  watched_series_episodes: number;
  unwatched_episodes: number;
};