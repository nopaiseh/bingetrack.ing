import { describe, expect, it } from "vitest";
import { deriveDashboardStats, percent } from "@/components/dashboard/dashboard-stats";
import type { MediaDistributions, Summary } from "@/lib/types";

const emptyDistributions: MediaDistributions = { movies: {}, shows: {} };

describe("percent", () => {
  it("returns 0 when the total is not positive", () => {
    expect(percent(3, 0)).toBe(0);
    expect(percent(3, -1)).toBe(0);
    expect(percent(0, 0)).toBe(0);
  });

  it("rounds and clamps the ratio to 0–100", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(1, 2)).toBe(50);
    expect(percent(10, 10)).toBe(100);
    expect(percent(11, 10)).toBe(100);
    expect(percent(-1, 10)).toBe(0);
  });
});

describe("deriveDashboardStats", () => {
  it("returns zeros and empty distributions when the year is missing", () => {
    const stats = deriveDashboardStats([], "2024", emptyDistributions);
    expect(stats.currentYearData).toBeUndefined();
    expect(stats.totalMovies).toBe(0);
    expect(stats.totalSeries).toBe(0);
    expect(stats.moviesPercent).toBe(0);
    expect(stats.seriesPercent).toBe(0);
    expect(stats.seriesEpisodesPercent).toBe(0);
    expect(stats.runtimePercent).toBe(0);
    expect(stats.avgMoviesRatingPercent).toBe(0);
    expect(stats.movieDistribution).toEqual({ regions: [], languages: [], genres: [] });
    expect(stats.seriesDistribution).toEqual({ regions: [], languages: [], genres: [] });
  });

  it("sums movies without the watching count and falls back when episode totals are missing", () => {
    const summary = [
      {
        release_year: 2024,
        watched_movies: 4,
        unwatched_movies: 6,
        movie_avg_rating: 8.2,
        movies_watched_runtime: 100,
        movies_unwatched_runtime: 50,
        total_movies_runtime: 150,
        watched_series: 1,
        watching_series: 1,
        unwatched_series: 0,
        watched_series_episodes: 4,
        unwatched_episodes: 6,
        series_avg_rating: 0,
        series_watched_runtime: 0,
        series_unwatched_runtime: 0,
        total_series_runtime: 0,
        total_watched_runtime: 0,
        total_runtime: 0,
        watched_seasons: 2,
      } as Summary,
    ];
    const distributions: MediaDistributions = {
      movies: { "2024": { regions: [{ name: "美国", count: 2, percent: 100 }], languages: [], genres: [] } },
      shows: {},
    };

    const stats = deriveDashboardStats(summary, "2024", distributions);

    expect(stats.totalMovies).toBe(10);
    expect(stats.moviesPercent).toBe(40);
    expect(stats.avgMoviesRating).toBe(8.2);
    expect(stats.avgMoviesRatingPercent).toBe(82);
    expect(stats.totalSeries).toBe(2);
    expect(stats.seriesPercent).toBe(50);
    expect(stats.totalEpisodes).toBe(10);
    expect(stats.seriesEpisodesPercent).toBe(40);
    expect(stats.runtimePercent).toBe(0);
    expect(stats.movieDistribution.regions).toEqual([{ name: "美国", count: 2, percent: 100 }]);
    expect(stats.seriesDistribution.genres).toEqual([]);
    expect(stats.currentYearData?.watched_seasons).toBe(2);
  });
});
