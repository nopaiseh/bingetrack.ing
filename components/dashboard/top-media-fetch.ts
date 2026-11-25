import type { DashboardTab } from "@/components/dashboard/dashboard-url";

/** 首页年度精选 API 的 media type 参数。 */
export const TOP_MEDIA_TYPES = ["movie", "tv_show", "album", "book"] as const;
export type TopMediaType = (typeof TOP_MEDIA_TYPES)[number];

/** 各看板标签需要的年度精选类型：总览预取全部，单类型标签只取自身。 */
export const TAB_TOP_MEDIA_TYPES: Record<DashboardTab, readonly TopMediaType[]> = {
  总览: TOP_MEDIA_TYPES,
  电影: ["movie"],
  电视节目: ["tv_show"],
  音乐: ["album"],
  图书: ["book"],
};

/** 缓存键：年份 + 媒体类型，避免跨年／跨类型互相覆盖。 */
export function topMediaCacheKey(year: string, type: TopMediaType): string {
  return `${year}:${type}`;
}
