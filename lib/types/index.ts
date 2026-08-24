export type MediaType = "movies" | "series";

export interface Media {
  id: string;
  title: string;
  date: string;
  release_year?: string | number | null;
  runtime?: number | null;
  rating: number | null;
  genres: string[];
  languages: string[];
  regions?: string[];
  series?: string | null;
  status?: string;
  summary?: string;
  cover_url: string;
  casts?: string[];
  directors?: string[];
  type?: MediaType;
}

export interface Summary {
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
}

export type MediaSummary = Summary;

export interface Stats {
  total?: number;
  watched?: number;
  want?: number;
  upcoming?: number;

  totalSeries?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  totalUpcomingEpisodes?: number;
}

export interface MediaCatalogProps {
  watched?: Media[];
  watching?: Media[];
  want?: Media[];
  stats?: Stats;
}

export interface ViewAllMediaRow {
  id: string | number;
  title?: string | null;
  sort_date?: string | null;
  release_date?: string | null;
  release_year?: string | number | null;
  runtime?: number | null;
  rating?: number | null;
  average_rating?: number | null;
  genres?: string[] | null;
  languages?: string[] | null;
  regions?: string[] | null;
  status?: string | null;
  summary?: string | null;
  cover_url?: string | null;
  casts?: string[] | null;
  directors?: string[] | null;
  type?: string | null;
  series?: string | null;
}

export interface FetchMediaListOptions {
  type?: string | null;
  status?: string | null;
  genre?: string | null;
  region?: string | null;
  language?: string | null;
  startYear?: string | null;
  endYear?: string | null;
  q?: string | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
}
