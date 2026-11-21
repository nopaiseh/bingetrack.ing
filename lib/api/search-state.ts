import { SEARCH_DB_TYPES, isSearchDbMediaType } from "@/lib/media-types";

export const PAGE_SIZE = 30;
export type SearchFilters = Readonly<Record<string, readonly string[]>>;

const TYPE_VALUES = new Set([...SEARCH_DB_TYPES, "series"]);
/** 与 API `creditRole` 白名单一致；页面 URL 也用同名参数。 */
const CREDIT_ROLE_VALUES = new Set(["director", "actor", "author", "artist", "lyricist", "composer"]);
const STATUS_VALUES = new Set(["want_to_watch", "watching", "watched", "in_progress", "upcoming"]);
// “即将上映”在页面上是一个状态选项，但发给 API 时单独成为 upcoming 参数。
// in_progress 为图书「在读」；影视不会产出该状态。
const WATCH_STATUS_VALUES = new Set(["want_to_watch", "watching", "watched", "in_progress"]);
const SORT_VALUES = new Set(["date_asc", "date_desc", "rating_asc", "rating_desc"]);

/** 拆分逗号列表并去重。 */
function readList(value: string | null): string[] {
  return [...new Set(value?.split(",").filter(Boolean) ?? [])];
}

const LEGACY_TYPE_CREDIT_ROLES = new Set(["director", "actor"]);

/**
 * 兼容旧搜索链接：把 `type=director`／`type=actor`（可与其他 type 混写）迁到 `creditRole`，
 * 并从 `type` 中去掉；已有 `creditRole` 与其它参数原样保留。有迁移时返回 true（params 已原地改写）。
 */
export function migrateLegacyCreditRolesFromType(params: URLSearchParams): boolean {
  const types = readList(params.get("type"));
  const legacyRoles = types.filter(/* 旧分类行里的人物角色。 */ (value) => LEGACY_TYPE_CREDIT_ROLES.has(value));
  if (legacyRoles.length === 0) return false;

  const remainingTypes = types.filter(/* 留下真正的媒体／系列分类。 */ (value) => !LEGACY_TYPE_CREDIT_ROLES.has(value));
  const creditRoles = [...new Set([...readList(params.get("creditRole")), ...legacyRoles])];

  if (remainingTypes.length > 0) params.set("type", remainingTypes.join(","));
  else params.delete("type");
  params.set("creditRole", creditRoles.join(","));
  return true;
}

/** 分类、人物角色、状态和排序只接受规范值，出现任何未知值都视为无效地址。 */
export function hasOnlyKnownFilterValues(searchParams: URLSearchParams): boolean {
  const within = (key: string, allowed: Set<string>) =>
    readList(searchParams.get(key)).every(/* 检查每个值是否为规范值。 */ (value) => allowed.has(value));
  const sort = searchParams.get("sort");
  return (
    within("type", TYPE_VALUES) &&
    within("creditRole", CREDIT_ROLE_VALUES) &&
    within("status", STATUS_VALUES) &&
    (sort === null || SORT_VALUES.has(sort))
  );
}

/** 从 URL 读取多选筛选和年份范围，缺省排序使用日期降序。 */
export function readFilters(searchParams: URLSearchParams): SearchFilters {
  return {
    type: readList(searchParams.get("type")),
    creditRole: readList(searchParams.get("creditRole")),
    status: readList(searchParams.get("status")),
    genre: searchParams.get("genre")?.split(",").filter(Boolean) ?? [],
    region: searchParams.get("region")?.split(",").filter(Boolean) ?? [],
    language: searchParams.get("language")?.split(",").filter(Boolean) ?? [],
    year:
      searchParams.get("startYear") || searchParams.get("endYear")
        ? [searchParams.get("startYear") || "", searchParams.get("endYear") || ""]
        : [],
    sort: [searchParams.get("sort") || "date_desc"],
  };
}

/** 原地重写 URL 中的筛选参数，保留其他参数，并省略空筛选和默认排序。 */
export function writeFilters(params: URLSearchParams, filters: SearchFilters) {
  for (const key of ["type", "creditRole", "status", "genre", "region", "language", "startYear", "endYear", "sort"]) {
    params.delete(key);
  }
  for (const key of ["type", "creditRole", "status", "genre", "region", "language"]) {
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

  const mediaTypes = filters.type.filter(/* 媒体分类映射为数据库媒体类型（含单曲）。 */ (t) => isSearchDbMediaType(t));
  const creditRoles = filters.creditRole.filter(/* 仅保留白名单人物角色。 */ (role) => CREDIT_ROLE_VALUES.has(role));
  if (mediaTypes.length > 0) params.set("type", mediaTypes.join(","));
  if (filters.type.includes("series")) params.set("series", "true");
  if (creditRoles.length > 0) params.set("creditRole", creditRoles.join(","));
  const statuses = filters.status.filter(/* 忽略无法识别的状态值。 */ (s) => WATCH_STATUS_VALUES.has(s));
  if (statuses.length > 0) params.set("status", statuses.join(","));
  if (filters.status.includes("upcoming")) params.set("upcoming", "true");

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
