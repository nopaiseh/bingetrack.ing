import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMediaById, getSeasonsBySeriesId, searchMediaServer, fetchTopMediaServer, fetchMediaDistributionsServer } from "./media-repo";
import { parseMediaSearchParams } from "@/lib/api/media-params";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import type { Summary } from "@/lib/types";

// 公开详情缓存 60 秒，函数参数参与缓存键；React cache 合并同次渲染的重复读取。
export const getCachedMediaById = cache(unstable_cache(getMediaById, ["public-media-detail-v1"], {
  revalidate: 60,
  tags: ["media"],
}));

export const getCachedSeasonsBySeriesId = cache(unstable_cache(getSeasonsBySeriesId, ["public-media-seasons-v1"], {
  revalidate: 60,
  tags: ["media"],
}));

// 以完整查询字符串区分搜索缓存，30 秒后允许重新验证。
export const searchCachedMedia = unstable_cache(
  /** 解析缓存键中的查询参数并执行媒体搜索。 */
  async (query: string) => searchMediaServer(parseMediaSearchParams(new URLSearchParams(query))),
  ["public-media-search-v1"],
  { revalidate: 30, tags: ["media"] },
);

// 榜单数据按类型、年份与数量缓存 60 秒。
export const getCachedTopMediaServer = cache(unstable_cache(
  fetchTopMediaServer,
  ["public-media-top-v1"],
  { revalidate: 60, tags: ["media"] },
));

// 全时段分布统计缓存 60 秒。
export const getCachedMediaDistributionsServer = cache(unstable_cache(
  fetchMediaDistributionsServer,
  ["public-media-distributions-v1"],
  { revalidate: 60, tags: ["media"] },
));

// 年度统计聚合结果缓存 60 秒。
export const getCachedReleaseYearStats = cache(unstable_cache(
  async () => {
    const db = getSupabasePublicServer();
    const { data, error } = await db.from("release_year_stats").select("*").order("release_year", { ascending: false });
    if (error) {
      console.error("Failed to fetch release year stats:", error);
      throw new Error("Failed to fetch dashboard summary", { cause: error });
    }
    return (data as Summary[] | null) ?? [];
  },
  ["public-media-release-year-stats-v1"],
  { revalidate: 60, tags: ["media"] },
));

