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

/** 为地区、语言和类型分别创建独立的空计数表。 */
function createDistributionCounts(): DistributionCounts {
  return { regions: new Map(), languages: new Map(), genres: new Map() };
}

// 百分比以该维度全部计数为分母，再截取前五名；多标签作品可贡献多次计数。
function topFive(counts: Map<string, number>): DistributionItem[] {
  const total = Array.from(counts.values()).reduce(/* 将每一项计数累加为该维度总数。 */ (sum, count) => sum + count, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .sort(/* 按数量降序排序，数量相同时按中文名称排序。 */ (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 5)
    .map(/* 保留名称和数量，并计算占该维度总数的整数百分比。 */ ([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }));
}

/** 将三个维度的原始计数分别转换为前五名展示数据。 */
function finalizeDistribution(counts: DistributionCounts): MediaDistribution {
  return {
    regions: topFive(counts.regions),
    languages: topFive(counts.languages),
    genres: topFive(counts.genres),
  };
}

/** 按媒体类型和年份组织数据库计数，生成各维度前五名并补齐空的全部年份分组。 */
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
    movies: Object.fromEntries(Array.from(countsByType.movies, /* 将某年电影计数转换为年度分布条目。 */ ([year, counts]) => [year, finalizeDistribution(counts)])),
    series: Object.fromEntries(Array.from(countsByType.series, /* 将某年电视剧计数转换为年度分布条目。 */ ([year, counts]) => [year, finalizeDistribution(counts)])),
  };
}
