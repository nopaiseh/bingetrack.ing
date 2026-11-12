import type { EpisodeInfo } from "@/lib/types";

/** 季页单集列表每页条数；服务端默认页与筛选接口共用，避免两侧分页错位。 */
export const SEASON_EPISODE_PAGE_SIZE = 20;

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
  /** 最后一集已看之后的第一集未看；没有时为 null。筛选和翻页都用同一集号标记。 */
  nextEpisodeNumber: number | null;
};

/**
 * 按调用方给出的顺序找出「最后一集已看」，以及排在它后面的第一集未看。
 * 比较函数大于 0 表示更靠后。尚未开看时返回 null；已看的就是最后一集时 next 为 null。
 * 更早被跳过的未看集不计入下一集，只认已看进度的最前缘。
 */
export function nextUnwatchedAfterLastWatched<T extends { status: string | null }>(
  episodes: readonly T[],
  compare: (left: T, right: T) => number,
): { lastWatched: T; next: T | null } | null {
  let lastWatched: T | null = null;
  for (const episode of episodes) {
    if (episode.status === "watched" && (lastWatched === null || compare(episode, lastWatched) > 0)) {
      lastWatched = episode;
    }
  }
  if (!lastWatched) return null;

  let next: T | null = null;
  for (const episode of episodes) {
    const isAfterLastWatched = compare(episode, lastWatched) > 0 && episode.status !== "watched";
    if (isAfterLastWatched && (next === null || compare(episode, next) < 0)) next = episode;
  }
  return { lastWatched, next };
}

/**
 * 最后一集已看之后、集号最小的未看单集。
 * 尚未开看，或已看的就是编号最大的一集时，没有「下一集」。
 */
export function nextUnwatchedEpisodeNumber(
  episodes: readonly { episodeNumber: number; status: string | null }[],
): number | null {
  return nextUnwatchedAfterLastWatched(
    episodes,
    (left, right) => left.episodeNumber - right.episodeNumber,
  )?.next?.episodeNumber ?? null;
}

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
