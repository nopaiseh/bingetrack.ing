export const PAGE_SIZE = 30;
export type SearchFilters = Record<string, string[]>;

const TYPE_VALUES = new Set(["movie", "tv_show", "series", "director", "actor"]);
const STATUS_VALUES = new Set(["want_to_watch", "watching", "watched"]);
const SORT_VALUES = new Set(["date_asc", "date_desc", "rating_asc", "rating_desc"]);

/** 拆分逗号列表并去重。 */
function readList(value: string | null): string[] {
  return [...new Set(value?.split(",").filter(Boolean) ?? [])];
}

/** 分类、状态和排序只接受规范值，出现任何未知值都视为无效地址。 */
export function hasOnlyKnownFilterValues(searchParams: URLSearchParams): boolean {
  const within = (key: string, allowed: Set<string>) =>
    readList(searchParams.get(key)).every(/* 检查每个值是否为规范值。 */ (value) => allowed.has(value));
  const sort = searchParams.get("sort");
  return within("type", TYPE_VALUES) && within("status", STATUS_VALUES) && (sort === null || SORT_VALUES.has(sort));
}

/** 从 URL 读取多选筛选和年份范围，缺省排序使用日期降序。 */
export function readFilters(searchParams: URLSearchParams): SearchFilters {
  return {
    type: readList(searchParams.get("type")),
    status: readList(searchParams.get("status")),
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

// 把页面筛选项和页码转换成 API 参数，供服务端首屏与浏览器后续请求共用。
export function buildMediaSearchQuery(searchParams: URLSearchParams): string {
  const filters = readFilters(searchParams);
  const query = searchParams.get("q")?.trim() || "";
  const page = readSearchPage(searchParams);
  const params = new URLSearchParams();
  if (query) params.set("q", query);

  const mediaTypes = filters.type.filter(/* 媒体分类映射为数据库媒体类型。 */ (t) => t === "movie" || t === "tv_show");
  const creditRoles = filters.type.filter(/* 人员分类映射为导演或演员角色。 */ (t) => t === "director" || t === "actor");
  if (mediaTypes.length > 0) params.set("type", mediaTypes.join(","));
  if (filters.type.includes("series")) params.set("series", "true");
  if (creditRoles.length > 0) params.set("creditRole", creditRoles.join(","));
  const statuses = filters.status.filter(/* 忽略无法识别的状态值。 */ (s) => STATUS_VALUES.has(s));
  if (statuses.length > 0) params.set("status", statuses.join(","));

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
