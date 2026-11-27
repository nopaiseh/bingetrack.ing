import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  getMediaById,
  getMediaByIdForCache,
  getSeasonEpisodes,
  getSeasonNextEpisodeNumber,
  getSeasonsBySeriesId,
  searchMediaServer,
  fetchTopMediaServer,
  fetchMediaDistributionsServer,
  fetchUpcomingReleasesServer,
  getBookStats,
  getAlbumStats,
} from "./media-repo";
import { getAlbumDetail, getAlbumDetailForCache } from "./album-repo";
import { getSongDetailForCache } from "./song-repo";
import { getPersonDetailForCache } from "./person-repo";
import { cachedWithSeriesFallback } from "./cache-degrade";
import { reportHandledError } from "@/lib/report-error";
import { parseMediaSearchParams } from "@/lib/api/media-params";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { withRetry } from "./retry";
import { isMediaId } from "./media-id";
import { getCurrentlyReading, getHomeContinue } from "@/lib/continue-watching";
import { MEDIA_LISTS_TAG, MEDIA_TAG, mediaItemTag, PERSON_TAG, personItemTag } from "./media-cache-tags";
import type { Summary } from "@/lib/types";

// 公开详情只靠 tag 失效（保存时 revalidateMediaItems／revalidateAllMedia）；非法 ID 不进缓存。
// v4：系列查询失败时缓存回调抛 SeriesDegradedError；外层无缓存重跑并返回空系列，
// 同时 connection() 退出本请求 Full Route Cache（键未变，无需升版）。
export const getCachedMediaById = cache(async (id: string) => {
  if (!isMediaId(id)) return null;
  return cachedWithSeriesFallback(
    () =>
      unstable_cache(getMediaByIdForCache, ["public-media-detail-v4"], {
        revalidate: false,
        tags: [MEDIA_TAG, mediaItemTag(id)],
      })(id),
    () => getMediaById(id),
  );
});

/** 专辑详情（元数据、拥有权、曲目、credits、系列）；写入走 media / media:item 失效。 */
export const getCachedAlbumDetail = cache(async (id: string) => {
  if (!isMediaId(id)) return null;
  // v3：系列／同系列失败 → SeriesDegradedError，外层无缓存重跑并退出 Full Route Cache。
  return cachedWithSeriesFallback(
    () =>
      unstable_cache(getAlbumDetailForCache, ["public-album-detail-v3"], {
        revalidate: false,
        tags: [MEDIA_TAG, mediaItemTag(id)],
      })(id),
    () => getAlbumDetail(id),
  );
});

// 季摘要沿用电视节目 ID 的标签，单集或季变更时随电视节目详情一起失效。
export const getCachedSeasonsBySeriesId = cache(async (seriesId: string) => {
  if (!isMediaId(seriesId)) return [];
  return unstable_cache(getSeasonsBySeriesId, ["public-media-seasons-v3"], {
    revalidate: false,
    tags: [MEDIA_TAG, mediaItemTag(seriesId)],
  })(seriesId);
});

// 单集分页与季统计：标签挂在电视节目上，保存单集时失效列表包含所属节目。
export const getCachedSeasonEpisodes = cache(
  async (
    seriesId: string,
    seasonId: string,
    page: number,
    pageSize: number,
    status: "all" | "watched" | "unwatched" = "all",
    order: "asc" | "desc" = "asc",
  ) => {
    if (!isMediaId(seriesId) || !isMediaId(seasonId)) return null;
    return unstable_cache(getSeasonEpisodes, ["public-season-episodes-v2"], {
      revalidate: false,
      tags: [MEDIA_TAG, mediaItemTag(seriesId)],
    })(seriesId, seasonId, page, pageSize, status, order);
  },
);

// 下一集只跟季有关；查询失败时降级为不标记，避免单集列表整页打不开。
export const getCachedSeasonNextEpisodeNumber = cache(async (seriesId: string, seasonId: string) => {
  if (!isMediaId(seriesId) || !isMediaId(seasonId)) return null;
  try {
    return await unstable_cache(getSeasonNextEpisodeNumber, ["public-season-next-episode-v1"], {
      revalidate: false,
      tags: [MEDIA_TAG, mediaItemTag(seriesId)],
    })(seriesId, seasonId);
  } catch (error) {
    reportHandledError("Season next episode lookup failed:", error);
    return null;
  }
});

// 搜索结果按查询串缓存。upcoming=true 的过滤条件含当天日期，故保留 1 小时定时重建；
// 其余筛选仍只靠后台写入时的 media / media:lists 标签失效。
export const searchCachedMedia = unstable_cache(
  /** 解析缓存键中的查询参数并执行媒体搜索。 */
  async (query: string) => searchMediaServer(parseMediaSearchParams(new URLSearchParams(query))),
  ["public-media-search-v3"],
  { revalidate: 3600, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
);

// 榜单数据按类型、年份与数量缓存；写入走 media:lists。
// v4：select 增加 authors，并支持 album／book 类型键。
export const getCachedTopMediaServer = cache(
  unstable_cache(fetchTopMediaServer, ["public-media-top-v4"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

// 即将上映候选池：查询下限取 UTC 昨天且带 limit，跨日不重建会挤掉真正的即将上映条目，故保留 24 小时定时。
// 候选池留有余量，缓存滞后时由浏览器按当天过滤；倒计时天数在页面重新生成时按新加坡日历现算。
export const getCachedUpcomingReleasesServer = cache(
  unstable_cache(fetchUpcomingReleasesServer, ["public-media-upcoming-v2"], {
    revalidate: 86400,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

// 全时段分布统计；写入走 media:lists。
export const getCachedMediaDistributionsServer = cache(
  unstable_cache(fetchMediaDistributionsServer, ["public-media-distributions-v2"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

// 首页「继续」全站一条：{ watching, listening, reading }。
// getHomeContinue 只用公开读取客户端，缓存回调里不能读 cookies()、headers() 或当前用户。
// 观看／收听／阅读写入走 revalidateMediaItems，失效 media:lists；全站刷新失效 media。
export const getCachedHomeContinue = cache(
  unstable_cache(getHomeContinue, ["public-media-home-continue-v2"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

/** 首页「在读」单独缓存；前端可直接使用，不必改 HomeDashboard 形状。 */
export const getCachedCurrentlyReading = cache(
  unstable_cache(getCurrentlyReading, ["public-media-currently-reading-v1"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

// 年度统计聚合；写入走 media:lists。
export const getCachedReleaseYearStats = cache(
  unstable_cache(
    async () => {
      return withRetry(async () => {
        const db = getSupabasePublicServer();
        const { data, error } = await db
          .from("release_year_stats")
          .select("*")
          .order("release_year", { ascending: false });
        if (error) {
          console.error("Failed to fetch release year stats:", error);
          throw new Error("Failed to fetch dashboard summary", { cause: error });
        }
        return (data as Summary[] | null) ?? [];
      });
    },
    ["public-media-release-year-stats-v2"],
    { revalidate: false, tags: [MEDIA_TAG, MEDIA_LISTS_TAG] },
  ),
);

/** 图书目录统计；写入走 media:lists 失效。 */
export const getCachedBookStats = cache(
  unstable_cache(getBookStats, ["public-book-stats-v1"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

/** 专辑目录统计；写入走 media:lists 失效。 */
export const getCachedAlbumStats = cache(
  unstable_cache(getAlbumStats, ["public-album-stats-v1"], {
    revalidate: false,
    tags: [MEDIA_TAG, MEDIA_LISTS_TAG],
  }),
);

/** 歌曲详情（get_song_detail）；写入走 media / media:item 失效。非法 ID 不进缓存。 */
export const getCachedSongDetail = cache(async (id: string) => {
  if (!isMediaId(id)) return null;
  return unstable_cache(getSongDetailForCache, ["public-song-detail-v1"], {
    revalidate: false,
    tags: [MEDIA_TAG, mediaItemTag(id)],
  })(id);
});

/** 人物详情（people 行 + get_person_works）；写入走 media / person / person:item 失效。 */
export const getCachedPersonDetail = cache(async (id: string) => {
  if (!isMediaId(id)) return null;
  return unstable_cache(getPersonDetailForCache, ["public-person-detail-v2"], {
    revalidate: false,
    tags: [MEDIA_TAG, PERSON_TAG, personItemTag(id)],
  })(id);
});
