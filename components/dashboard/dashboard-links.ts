import type { SearchDbMediaType } from "@/lib/media-types";

/** 按媒体分类与观看／阅读／收听状态生成搜索链接；指定年份时同时限定起止年份。 */
export function getStatusSearchLink(
  type: SearchDbMediaType,
  status: "watched" | "watching" | "want_to_watch" | "in_progress",
  year: string,
) {
  const params = new URLSearchParams({ type, status });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

/** 按媒体分类生成评分降序的搜索链接；指定年份时同时限定起止年份。 */
export function getSearchViewAllLink(type: SearchDbMediaType, year: string) {
  const params = new URLSearchParams({ type, sort: "rating_desc" });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}
