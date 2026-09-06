export const PAGE_SIZE = 30;
export type SearchFilters = Record<string, string[]>;

/** 从 URL 读取多选筛选和年份范围，缺省排序使用日期降序。 */
export function readFilters(searchParams: URLSearchParams): SearchFilters {
  return {
    type: searchParams.get("type")?.split(",").filter(Boolean) ?? [],
    status: searchParams.get("status")?.split(",").filter(Boolean) ?? [],
    genre: searchParams.get("genre")?.split(",").filter(Boolean) ?? [],
    region: searchParams.get("region")?.split(",").filter(Boolean) ?? [],
    language: searchParams.get("language")?.split(",").filter(Boolean) ?? [],
    year: searchParams.get("startYear") || searchParams.get("endYear")
      ? [searchParams.get("startYear") || "", searchParams.get("endYear") || ""]
      : [],
    sort: [searchParams.get("sort") || "date_desc"],
  };
}

/** 原地重写 URL 中的筛选参数，保留其他参数，并省略空筛选和默认排序。 */
export function writeFilters(params: URLSearchParams, filters: SearchFilters) {
  for (const key of ["type", "status", "genre", "region", "language", "startYear", "endYear", "sort"]) {
    params.delete(key);
  }
  for (const key of ["type", "status", "genre", "region", "language"]) {
    if (filters[key]?.length) params.set(key, filters[key].join(","));
  }
  if (filters.year?.[0]) params.set("startYear", filters.year[0]);
  if (filters.year?.[1]) params.set("endYear", filters.year[1]);
  if (filters.sort?.[0] && filters.sort[0] !== "date_desc") params.set("sort", filters.sort[0]);
}

/** 读取正整数页码，非法值回退第一页，最大限制为 3334。 */
export function readSearchPage(params: URLSearchParams): number {
  const page = Number(params.get("page") ?? "1");
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 3334) : 1;
}

// 把页面中文筛选项和页码转换成 API 参数，供服务端首屏与浏览器后续请求共用。
export function buildMediaSearchQuery(searchParams: URLSearchParams): string {
  const filters = readFilters(searchParams);
  const query = searchParams.get("q")?.trim() || "";
  const page = readSearchPage(searchParams);
  const params = new URLSearchParams();
  if (query) params.set("q", query);

  if (filters.type && filters.type.length > 0) {
    const typeMap: Record<string, string> = { 电影: "movie", 电视剧: "tv_series" };
    const creditRoleMap: Record<string, string> = { 导演: "director", 演员: "actor" };
    const mappedTypes = filters.type.map(/* 将中文媒体分类映射为数据库媒体类型。 */ (t) => typeMap[t]).filter(Boolean);
    const mappedCreditRoles = filters.type.map(/* 将中文人员分类映射为导演或演员角色。 */ (t) => creditRoleMap[t]).filter(Boolean);
    if (mappedTypes.length > 0) params.set("type", mappedTypes.join(","));
    if (filters.type.includes("系列")) params.set("series", "true");
    if (mappedCreditRoles.length > 0) params.set("creditRole", mappedCreditRoles.join(","));
  }

  if (filters.status && filters.status.length > 0) {
    const statusMap: Record<string, string> = { 想看: "want_to_watch", 在看: "watching", 已看: "watched" };
    const mappedStatuses = filters.status.map(/* 将中文观看状态映射为 API 状态值。 */ (s) => statusMap[s]).filter(Boolean);
    if (mappedStatuses.length > 0) params.set("status", mappedStatuses.join(","));
  }

  if (filters.genre && filters.genre.length > 0) params.set("genre", filters.genre.join(","));
  if (filters.region && filters.region.length > 0) params.set("region", filters.region.join(","));
  if (filters.language && filters.language.length > 0) params.set("language", filters.language.join(","));

  if (filters.year && filters.year.length === 2) {
    if (filters.year[0]) params.set("startYear", filters.year[0]);
    if (filters.year[1]) params.set("endYear", filters.year[1]);
  }

  if (filters.sort && filters.sort.length > 0) params.set("sort", filters.sort[0]);

  params.set("limit", PAGE_SIZE.toString());
  params.set("offset", ((page - 1) * PAGE_SIZE).toString());
  return params.toString();
}
