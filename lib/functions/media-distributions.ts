import type { DistributionItem, MediaDistribution, MediaDistributions } from "@/lib/types";

type DistributionDimension = keyof MediaDistribution;

export type DistributionCountRow = {
  media_type: "movies" | "series";
  release_year: string;
  dimension: DistributionDimension;
  name: string;
  item_count: number;
};

type DistributionCounts = Record<DistributionDimension, Map<string, number>>;

function createDistributionCounts(): DistributionCounts {
  return { regions: new Map(), languages: new Map(), genres: new Map() };
}

function topFive(counts: Map<string, number>): DistributionItem[] {
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }));
}

function finalizeDistribution(counts: DistributionCounts): MediaDistribution {
  return {
    regions: topFive(counts.regions),
    languages: topFive(counts.languages),
    genres: topFive(counts.genres),
  };
}

export function buildMediaDistributions(rows: DistributionCountRow[]): MediaDistributions {
  const countsByType: Record<"movies" | "series", Map<string, DistributionCounts>> = {
    movies: new Map(),
    series: new Map(),
  };

  for (const row of rows) {
    const yearCounts = countsByType[row.media_type];
    if (!yearCounts.has(row.release_year)) {
      yearCounts.set(row.release_year, createDistributionCounts());
    }
    yearCounts.get(row.release_year)![row.dimension].set(row.name, row.item_count);
  }

  if (!countsByType.movies.has("All Time")) countsByType.movies.set("All Time", createDistributionCounts());
  if (!countsByType.series.has("All Time")) countsByType.series.set("All Time", createDistributionCounts());

  return {
    movies: Object.fromEntries(Array.from(countsByType.movies, ([year, counts]) => [year, finalizeDistribution(counts)])),
    series: Object.fromEntries(Array.from(countsByType.series, ([year, counts]) => [year, finalizeDistribution(counts)])),
  };
}
