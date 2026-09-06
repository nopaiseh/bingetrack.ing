import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getMediaById, getSeasonsBySeriesId, searchMediaServer } from "./media-repo";
import { parseMediaSearchParams } from "@/lib/api/media-params";

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
