import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { mapViewRowToMedia, mapViewRowToMediaCard } from "@/lib/functions/media-mapper";
import { isMediaId } from "@/lib/functions/media-id";
import { withRetry } from "@/lib/functions/retry";
import { fetchAlbumCoversByTrackIds, trackDisplayCoverUrl } from "@/lib/music/track-display-cover";
import { EpisodeInfo, MediaCard, Media, SeasonEpisodePage, SeasonInfo, ViewAllMediaRow } from "@/lib/types";
import { reportHandledError } from "@/lib/report-error";
import { nextUnwatchedEpisodeNumber } from "@/lib/season-browse";
import { MEDIA_CARD_COLUMNS, MediaRepositoryError, firstRelated, formatYearRange } from "./shared";

// 详情读取完整视图；找不到记录返回 null，查询失败则抛出错误。
export async function getMediaById(id: string): Promise<Media | null> {
  if (!isMediaId(id)) return null;

  return withRetry(async () => {
    const db = getSupabasePublicServer();

    const { data: viewData, error: viewError } = await db.from("v_all_media").select("*").eq("id", id).maybeSingle();

    if (viewError) {
      console.error(`Failed to fetch media details for id ${id}:`, viewError);
      throw new MediaRepositoryError("fetch media details", viewError);
    }
    if (!viewData) return null;

    // 视图未提供作品所属系列，额外读取关联表；映射函数会将系列名称排序后展示。
    const { data: seriesData, error: seriesError } = await db
      .from("media_item_series")
      .select("position, media_series(name)")
      .eq("media_item_id", id)
      .order("position", { ascending: true, nullsFirst: false });

    if (seriesError) {
      reportHandledError(`Failed to fetch series memberships for media ${id}:`, seriesError);
    }

    const seriesNames = (seriesData ?? []).flatMap(
      /* 兼容对象或数组形式的系列关联，只收集非空系列名称。 */ (membership) => {
        const linkedSeries = Array.isArray(membership.media_series)
          ? membership.media_series[0]
          : membership.media_series;
        return linkedSeries?.name ? [linkedSeries.name] : [];
      },
    );

    const media = mapViewRowToMedia(viewData as ViewAllMediaRow, seriesNames);
    if (String(viewData.type) === "music") {
      try {
        const covers = await fetchAlbumCoversByTrackIds(db, [id]);
        media.cover_url = trackDisplayCoverUrl(covers.get(id)) ?? "";
      } catch (error) {
        throw new MediaRepositoryError("fetch track album cover", error);
      }
    }
    return media;
  });
}

/** 系列相关卡片：先按 seriesPosition（null 靠后），再按发行日、id。 */
function compareSeriesCards(a: MediaCard, b: MediaCard): number {
  const pa = a.seriesPosition;
  const pb = b.seriesPosition;
  if (pa != null && pb != null && pa !== pb) return pa - pb;
  if (pa != null && pb == null) return -1;
  if (pa == null && pb != null) return 1;
  const dateA = a.date || "";
  const dateB = b.date || "";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// 先找到同一作品系列中的其他条目，再读取卡片数据；按系列序位、发行日排列，并附带 seriesPosition。
export async function getRelatedBySeries(seriesName: string, currentId: string): Promise<MediaCard[]> {
  if (!seriesName) return [];

  return withRetry(async () => {
    const db = getSupabasePublicServer();

    const { data: seriesItems, error: seriesError } = await db
      .from("media_item_series")
      .select("media_item_id, position, media_series!inner(name)")
      .eq("media_series.name", seriesName)
      .neq("media_item_id", currentId)
      .order("position", { ascending: true, nullsFirst: false });

    if (seriesError || !seriesItems || seriesItems.length === 0) {
      if (seriesError) reportHandledError(`Failed to fetch related media IDs for series ${seriesName}:`, seriesError);
      return [];
    }

    const relatedIds = seriesItems.map(/* 提取关联作品 ID，供后续卡片查询使用。 */ (item) => item.media_item_id);
    const positionById = new Map(
      seriesItems.map(/* 保留 media_item_series.position，供卡片「第几部」展示。 */ (item) => [
        String(item.media_item_id),
        typeof item.position === "number" ? item.position : null,
      ]),
    );

    const { data, error } = await db
      .from("v_all_media")
      .select(MEDIA_CARD_COLUMNS)
      .in("id", relatedIds)
      .order("sort_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (error || !data) {
      reportHandledError(`Failed to fetch related media details for series ${seriesName}:`, error);
      return [];
    }

    return data
      .map(/* 将视图行转换为轻量媒体卡片，并附带系列序位。 */ (item: ViewAllMediaRow) => ({
        ...mapViewRowToMediaCard(item),
        seriesPosition: positionById.get(String(item.id)) ?? null,
      }))
      .sort(compareSeriesCards);
  });
}

/** 读取 v_media_season_summaries 中的季摘要。查询失败一律抛出 MediaRepositoryError。 */
export async function getSeasonsBySeriesId(seriesId: string): Promise<SeasonInfo[]> {
  if (!isMediaId(seriesId)) return [];

  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const { data, error } = await db
      .from("v_media_season_summaries")
      .select(
        "id,season_number,title,alternate_title,summary,cover_url,episode_count,watched_episode_count,first_year,last_year",
      )
      .eq("series_id", seriesId)
      .order("season_number", { ascending: true });
    if (error) throw new MediaRepositoryError("fetch season aggregates", error);
    return (data ?? []).map(
      /* 将聚合行转换为季摘要，规范计数字段、年份范围与空值。 */ (row) => ({
        id: row.id,
        seasonNumber: row.season_number,
        title: row.title ?? `第 ${row.season_number} 季`,
        alternateTitle: row.alternate_title ?? null,
        coverUrl: row.cover_url ?? "",
        episodeCount: Number(row.episode_count),
        watchedEpisodeCount: Number(row.watched_episode_count),
        releaseYearRange: formatYearRange(row.first_year, row.last_year),
        summary: row.summary ?? "",
      }),
    );
  });
}

type SeasonEpisodePageRow = {
  season_number: number;
  episode_count: number | string;
  watched_count: number | string;
  total_runtime: number | string;
  average_rating: number | string | null;
  first_release_date: string | null;
  last_release_date: string | null;
  total: number | string;
  episodes: Array<{
    id: string;
    episode_number: number;
    title: string | null;
    alternate_title: string | null;
    summary: string | null;
    cover_url: string | null;
    release_date: string | null;
    runtime: number | null;
    status: string | null;
    rating: number | null;
  }>;
};

/** 并行获取季简介与 RPC 单集分页，规范返回字段；季不存在返回 null，查询失败抛错。 */
export async function getSeasonEpisodes(
  seriesId: string,
  seasonId: string,
  page: number,
  pageSize: number,
  status: "all" | "watched" | "unwatched" = "all",
  order: "asc" | "desc" = "asc",
): Promise<SeasonEpisodePage | null> {
  if (!isMediaId(seriesId) || !isMediaId(seasonId)) return null;

  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const offset = (page - 1) * pageSize;
    // 并行读取分页单集与季简介；分页和整季统计由 RPC 一次返回。
    const [episodePageResult, seasonMediaResult] = await Promise.all([
      db.rpc("get_season_episode_page", {
        p_series_id: seriesId,
        p_season_id: seasonId,
        p_status: status,
        p_order: order,
        p_limit: pageSize,
        p_offset: offset,
      }),
      db.from("media_items").select("title, alternate_title, summary, cover_url").eq("id", seasonId).maybeSingle(),
    ]);
    const { data: episodePageData, error: episodePageError } = episodePageResult;
    const { data: seasonMedia, error: seasonMediaError } = seasonMediaResult;

    if (episodePageError) {
      console.error(`Failed to fetch season ${seasonId}:`, episodePageError);
      throw new MediaRepositoryError("fetch season episode page", episodePageError);
    }
    if (!episodePageData) return null;

    if (seasonMediaError) {
      console.error(`Failed to fetch summary for season ${seasonId}:`, seasonMediaError);
      throw new MediaRepositoryError("fetch season summary", seasonMediaError);
    }

    const result = episodePageData as SeasonEpisodePageRow;
    // 列表改为纯文字，不再把剧照地址放进页面或接口响应。数据库函数仍会选出 cover_url，这里直接丢掉。
    const episodes: EpisodeInfo[] = (result.episodes ?? []).map(
      /* 将 RPC 单集行转换为展示对象，补齐空字段并转换评分数值。 */ (episode) => ({
        id: episode.id,
        episodeNumber: episode.episode_number,
        title: episode.title ?? `第 ${episode.episode_number} 集`,
        alternateTitle: episode.alternate_title ?? null,
        summary: episode.summary ?? "",
        releaseDate: episode.release_date,
        runtime: episode.runtime,
        status: episode.status,
        rating: episode.rating === null ? null : Number(episode.rating),
      }),
    );
    const firstYear = result.first_release_date?.slice(0, 4);
    const lastYear = result.last_release_date?.slice(0, 4);
    const episodeCount = Number(result.episode_count);
    const watchedCount = Number(result.watched_count);

    return {
      season: {
        id: seasonId,
        seasonNumber: result.season_number,
        title: seasonMedia?.title ?? `第 ${result.season_number} 季`,
        alternateTitle: seasonMedia?.alternate_title ?? null,
        coverUrl: seasonMedia?.cover_url ?? "",
        episodeCount,
        watchedEpisodeCount: watchedCount,
        releaseYearRange:
          firstYear && lastYear ? (firstYear === lastYear ? firstYear : `${firstYear} - ${lastYear}`) : undefined,
        summary: seasonMedia?.summary ?? "",
      },
      episodes,
      total: Number(result.total),
      watchedCount,
      totalRuntime: Number(result.total_runtime),
      averageRating: result.average_rating === null ? null : Number(result.average_rating),
    };
  });
}

type SeasonProgressRow = {
  episode_number: number;
  media:
    | {
        tracking: { status: string | null } | Array<{ status: string | null }> | null;
      }
    | Array<{
        tracking: { status: string | null } | Array<{ status: string | null }> | null;
      }>
    | null;
};

const SEASON_PROGRESS_PAGE = 1000;
const SEASON_PROGRESS_PAGE_LIMIT = 20;

/**
 * 读取一季每集的观看状态，算出「下一集」：最后一集已看之后的第一集未看。
 * 不改数据库函数，只读集号和状态。单季超过一页时继续翻页，避免被行数上限截断。
 */
export async function getSeasonNextEpisodeNumber(seriesId: string, seasonId: string): Promise<number | null> {
  if (!isMediaId(seriesId) || !isMediaId(seasonId)) return null;

  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const episodes: { episodeNumber: number; status: string | null }[] = [];

    for (let page = 0; page < SEASON_PROGRESS_PAGE_LIMIT; page += 1) {
      const offset = page * SEASON_PROGRESS_PAGE;
      const progressColumns =
        "episode_number, media:media_items!tv_episodes_id_fkey(tracking(status)), season:tv_seasons!tv_episodes_season_id_fkey!inner(series_id)";
      const { data, error } = await db
        .from("tv_episodes")
        .select(progressColumns)
        .eq("season_id", seasonId)
        .eq("season.series_id", seriesId)
        .order("episode_number", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + SEASON_PROGRESS_PAGE - 1);

      if (error) {
        console.error(`Failed to read watch progress for season ${seasonId}:`, error);
        throw new MediaRepositoryError("fetch season watch progress", error);
      }

      const rows = (data ?? []) as SeasonProgressRow[];
      for (const row of rows) {
        episodes.push({
          episodeNumber: Number(row.episode_number),
          status: firstRelated(firstRelated(row.media)?.tracking)?.status ?? null,
        });
      }
      if (rows.length < SEASON_PROGRESS_PAGE) break;
    }

    return nextUnwatchedEpisodeNumber(episodes);
  });
}
