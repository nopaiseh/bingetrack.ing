import type { EpisodeInfo } from "@/lib/types";

/** 季页单集列表每页条数；服务端默认页与筛选接口共用，避免两侧分页错位。 */
export const SEASON_EPISODE_PAGE_SIZE = 10;

export type SeasonStatusFilter = "all" | "watched" | "unwatched";
export type SeasonEpisodeOrder = "asc" | "desc";

export type SeasonBrowseQuery = {
  page: number;
  status: SeasonStatusFilter;
  order: SeasonEpisodeOrder;
};

export type SeasonEpisodeListResponse = {
  episodes: EpisodeInfo[];
  total: number;
};

/** 判断分页、状态和排序是否都是季页的默认值。 */
export function isDefaultSeasonBrowseQuery(query: SeasonBrowseQuery): boolean {
  return query.page === 1 && query.status === "all" && query.order === "asc";
}

/** 把已解析的分页条件压成稳定键，用来区分一次列表请求。 */
export function seasonBrowseKey(query: SeasonBrowseQuery): string {
  return `${query.page}:${query.status}:${query.order}`;
}

/**
 * 解析季页查询串。非法页码视为第一页，未知状态和排序回退到全部、升序。
 * 与原先服务端页面的容错一致，旧链接不会因此变成错误页。
 */
export function readSeasonBrowseQuery(search: string): SeasonBrowseQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requestedPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const statusValue = params.get("status");
  const status: SeasonStatusFilter = statusValue === "watched" || statusValue === "unwatched" ? statusValue : "all";
  const order: SeasonEpisodeOrder = params.get("order") === "desc" ? "desc" : "asc";
  return { page, status, order };
}

/** 生成季页查询串，省略第一页、全部状态和升序，使默认地址保持干净。 */
export function seasonBrowseSearch(query: SeasonBrowseQuery): string {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.status !== "all") params.set("status", query.status);
  if (query.order !== "asc") params.set("order", query.order);
  const value = params.toString();
  return value ? `?${value}` : "";
}

/** 把分页条件接到季页路径上。 */
export function seasonBrowseHref(basePath: string, query: SeasonBrowseQuery): string {
  return `${basePath}${seasonBrowseSearch(query)}`;
}

/** 生成单集列表接口地址，查询串规则与季页地址相同。 */
export function seasonEpisodeListPath(seriesId: string, seasonId: string, query: SeasonBrowseQuery): string {
  return `/api/shows/${encodeURIComponent(seriesId)}/seasons/${encodeURIComponent(seasonId)}/episodes${seasonBrowseSearch(query)}`;
}
