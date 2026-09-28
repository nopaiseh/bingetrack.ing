import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMediaById, getSeasonsBySeriesId, searchMediaServer, fetchTopMediaServer, fetchMediaDistributionsServer, fetchUpcomingReleasesServer } from "./media-repo";
import { parseMediaSearchParams } from "@/lib/api/media-params";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { withRetry } from "./retry";
import { isMediaId } from "./media-id";
import { MEDIA_LISTS_TAG, MEDIA_TAG, mediaItemTag } from "./media-cache-tags";
import type { Summary } from "@/lib/types";

// 公开详情长缓存 24 小时，函数参数参与缓存键；每个条目带独立标签，保存时只失效受影响的详情页。
// 非法 ID 在进入数据缓存前直接返回，避免任意路径参数写入缓存条目。
export const getCachedMediaById = cache(async (id: string) => {
  if (!isMediaId(id)) return null;
  return unstable_cache(getMediaById, ["public-media-detail-v3"], {
    revalidate: 86400,
    tags: [MEDIA_TAG, mediaItemTag(id)],
  })(id);
});

// 季摘要沿用电视节目 ID 的标签，单集或季变更时随电视节目详情一起失效。
export const getCachedSeasonsBySeriesId = cache(async (seriesId: string) => {
  if (!isMediaId(seriesId)) return [];
  return unstable_cache(getSeasonsBySeriesId, ["public-media-seasons-v3"], {
    revalidate: 86400,
    tags: [MEDIA_TAG, mediaItemTag(seriesId)],
  })(seriesId);
});

// 以完整查询字符串区分搜索缓存，1 小时后允许重新验证，数据变更由 "media" tag 即时失效。
export const searchCachedMedia = unstable_cache(
  /** 解析缓存键中的查询参数并执行媒体搜索。 */
  async (query: string) => searchMediaServer(parseMediaSearchParams(new URLSearchParams(query))),
  ["public-media-search-v3"],
  { revalidate: 3600, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
);

// 榜单数据按类型、年份与数量长缓存 24 小时。
export const getCachedTopMediaServer = cache(unstable_cache(
  fetchTopMediaServer,
  ["public-media-top-v3"],
  { revalidate: 86400, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
));

// 即将上映候选池长缓存 24 小时；候选池留有余量，缓存滞后时由浏览器按当天过滤。
export const getCachedUpcomingReleasesServer = cache(unstable_cache(
  fetchUpcomingReleasesServer,
  ["public-media-upcoming-v2"],
  { revalidate: 86400, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
));

// 全时段分布统计长缓存 24 小时。
export const getCachedMediaDistributionsServer = cache(unstable_cache(
  fetchMediaDistributionsServer,
  ["public-media-distributions-v2"],
  { revalidate: 86400, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
));

// 年度统计聚合结果长缓存 24 小时。
export const getCachedReleaseYearStats = cache(unstable_cache(
  async () => {
    return withRetry(async () => {
      const db = getSupabasePublicServer();
      const { data, error } = await db.from("release_year_stats").select("*").order("release_year", { ascending: false });
      if (error) {
        console.error("Failed to fetch release year stats:", error);
        throw new Error("Failed to fetch dashboard summary", { cause: error });
      }
      return (data as Summary[] | null) ?? [];
    });
  },
  ["public-media-release-year-stats-v2"],
  { revalidate: 86400, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
));

