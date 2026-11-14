/** 按媒体分类与观看状态生成搜索链接；指定年份时同时限定起止年份。 */
export function getStatusSearchLink(type: "movie" | "tv_show", status: "watched" | "watching" | "want_to_watch", year: string) {
  const params = new URLSearchParams({ type, status });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

/** 按媒体分类生成评分降序的搜索链接；指定年份时同时限定起止年份。 */
export function getSearchViewAllLink(type: "movie" | "tv_show", year: string) {
  const params = new URLSearchParams({ type, sort: "rating_desc" });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}
