import { getSupabasePublicServer } from "@/utils/supabase";
import { mapViewRowToMedia, mapViewRowToMediaCard } from "@/lib/functions/media-mapper";
import { buildMediaDistributions, type DistributionCountRow } from "@/lib/functions/media-distributions";
import { quotePostgrestFilterValue } from "@/lib/functions/postgrest-filter";
import { EpisodeInfo, MediaCard, Media, MediaDistributions, SeasonEpisodePage, SeasonInfo, ViewAllMediaRow, FetchMediaListOptions } from "@/lib/types";


// 统一为查询失败附加操作名称和原始错误，让页面区分加载失败与查无记录。
export class MediaRepositoryError extends Error {
  /** 创建包含操作名称和原始原因的仓库错误，保留异常链便于定位失败查询。 */
  constructor(operation: string, cause?: unknown) {
    super(`Media repository operation failed: ${operation}`, { cause });
    this.name = "MediaRepositoryError";
  }
}

// 列表只读取卡片需要的字段，避免把简介和演职员等详情数据传到客户端。
const MEDIA_CARD_COLUMNS = "id,type,title,sort_date,release_year,rating,genres,languages,cover_url";

/** 只将 PostgREST 表缺失或 PostgreSQL 关系缺失错误识别为聚合视图缺失。 */
function isMissingAggregateView(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** 缺少任一端年份时返回 undefined，同年显示单年，跨年显示起止范围。 */
function formatYearRange(first: number | null, last: number | null): string | undefined {
  if (first == null || last == null) return undefined;
  return first === last ? String(first) : `${first} - ${last}`;
}

type SeriesReleaseYearRow = {
  series_id: string;
  tv_episodes: Array<{
    media_items: { release_date: string | null } | Array<{ release_date: string | null }> | null;
  }> | null;
};

export type SitemapMediaEntry = {
  path: string;
};

const SITEMAP_PAGE_SIZE = 1_000;

// 按 ID 分批读取电影、电视剧和季的地址，避免单次查询行数上限截断站点地图。
export async function getSitemapMediaEntries(): Promise<SitemapMediaEntry[]> {
  const db = getSupabasePublicServer();
  const entries: SitemapMediaEntry[] = [];

  for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
    const { data, error } = await db
      .from("v_all_media")
      .select("id, type")
      .in("type", ["movie", "tv_series"])
      .order("id", { ascending: true })
      .range(offset, offset + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch media routes for sitemap:", error);
      throw new MediaRepositoryError("fetch sitemap media routes", error);
    }

    const rows = data ?? [];
    entries.push(...rows.map(/* 根据媒体类型构造详情路径，并对 ID 做 URL 编码。 */ (row) => ({
      path: `/${row.type === "movie" ? "movies" : "series"}/${encodeURIComponent(String(row.id))}`,
    })));

    if (rows.length < SITEMAP_PAGE_SIZE) break;
  }

  for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
    const { data, error } = await db
      .from("tv_seasons")
      .select("id, series_id")
      .order("id", { ascending: true })
      .range(offset, offset + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch season routes for sitemap:", error);
      throw new MediaRepositoryError("fetch sitemap season routes", error);
    }

    const rows = data ?? [];
    entries.push(...rows.map(/* 对电视剧和季 ID 编码后构造季详情路径。 */ (row) => ({
      path: `/series/${encodeURIComponent(String(row.series_id))}/seasons/${encodeURIComponent(String(row.id))}`,
    })));

    if (rows.length < SITEMAP_PAGE_SIZE) break;
  }

  return entries;
}

/** 为电视剧卡片补齐剧集首末年份，优先用聚合视图，仅视图缺失时回退逐集计算。 */
async function addSeriesReleaseYearRanges<T extends MediaCard>(
  db: ReturnType<typeof getSupabasePublicServer>,
  items: T[],
): Promise<T[]> {
  const seriesIds = items
    .filter(/* 只保留电视剧条目以补充剧集年份范围。 */ (item) => item.type === "series")
    .map(/* 提取需要查询年份范围的电视剧 ID。 */ (item) => item.id);
  if (seriesIds.length === 0) return items;

  const aggregate = await db.from("v_media_series_years")
    .select("series_id,first_year,last_year").in("series_id", seriesIds);
  if (!aggregate.error) {
    const years = new Map((aggregate.data ?? []).map(/* 将电视剧 ID 与格式化后的首末年份组成查找表条目。 */ (row) => [
      row.series_id, formatYearRange(row.first_year, row.last_year),
    ]));
    return items.map(/* 用聚合年份覆盖显示年份，缺少聚合结果时保留原值。 */ (item) => ({ ...item, release_year: years.get(item.id) ?? item.release_year }));
  }
  if (!isMissingAggregateView(aggregate.error)) {
    throw new MediaRepositoryError("fetch series year aggregates", aggregate.error);
  }

  // 聚合视图不存在时才逐集计算首末年份；前面的检查会直接抛出其他聚合查询错误。
  const { data, error } = await db
    .from("tv_seasons")
    .select("series_id, tv_episodes(media_items(release_date))")
    .in("series_id", seriesIds);

  if (error || !data) {
    if (error) console.error("Failed to fetch series release year ranges:", error);
    return items;
  }

  const yearsBySeries = new Map<string, number[]>();
  for (const season of data as SeriesReleaseYearRow[]) {
    const years = yearsBySeries.get(season.series_id) ?? [];
    for (const episode of season.tv_episodes ?? []) {
      const releaseDate = firstRelated(episode.media_items)?.release_date;
      const year = releaseDate?.match(/^(\d{4})-/)?.[1];
      if (year) years.push(Number(year));
    }
    yearsBySeries.set(season.series_id, years);
  }

  return items.map(/* 根据已收集剧集年份计算范围，没有年份时保留原条目。 */ (item) => {
    const years = yearsBySeries.get(item.id);
    if (!years?.length) return item;
    const firstYear = Math.min(...years);
    const lastYear = Math.max(...years);
    return {
      ...item,
      release_year: firstYear === lastYear ? String(firstYear) : `${firstYear} - ${lastYear}`,
    };
  });
}

// 详情读取完整视图；找不到记录返回 null，查询失败则抛出错误。
export async function getMediaById(id: string): Promise<Media | null> {
  const db = getSupabasePublicServer();

  const { data: viewData, error: viewError } = await db
    .from("v_all_media")
    .select("*")
    .eq("id", id)
    .maybeSingle();

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
    console.error(`Failed to fetch series memberships for media ${id}:`, seriesError);
  }

  const seriesNames = (seriesData ?? []).flatMap(/* 兼容对象或数组形式的系列关联，只收集非空系列名称。 */ (membership) => {
    const linkedSeries = Array.isArray(membership.media_series)
      ? membership.media_series[0]
      : membership.media_series;
    return linkedSeries?.name ? [linkedSeries.name] : [];
  });

  return mapViewRowToMedia(viewData as ViewAllMediaRow, seriesNames);
}

// 先找到同一作品系列中的其他条目，再读取卡片数据并按发行日期排列。
export async function getRelatedBySeries(seriesName: string, currentId: string): Promise<MediaCard[]> {
  if (!seriesName) return [];

  const db = getSupabasePublicServer();

  const { data: seriesItems, error: seriesError } = await db
    .from("media_item_series")
    .select("media_item_id, media_series!inner(name)")
    .eq("media_series.name", seriesName)
    .neq("media_item_id", currentId)
    .order("position", { ascending: true, nullsFirst: false });

  if (seriesError || !seriesItems || seriesItems.length === 0) {
    if (seriesError) console.error(`Failed to fetch related media IDs for series ${seriesName}:`, seriesError);
    return [];
  }

  const relatedIds = seriesItems.map(/* 提取关联作品 ID，供后续卡片查询使用。 */ (item) => item.media_item_id);

  const { data, error } = await db
    .from("v_all_media")
    .select(MEDIA_CARD_COLUMNS)
    .in("id", relatedIds)
    .order("sort_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error || !data) {
    console.error(`Failed to fetch related media details for series ${seriesName}:`, error);
    return [];
  }

  return data.map(/* 将视图行转换为轻量媒体卡片。 */ (item: ViewAllMediaRow) => mapViewRowToMediaCard(item));
}

type SeasonRow = {
  id: string;
  season_number: number;
  tv_episodes: Array<{
    id: string;
    media_items: {
      release_date: string | null;
      tracking: { status: string | null } | Array<{ status: string | null }> | null;
    } | Array<{
      release_date: string | null;
      tracking: { status: string | null } | Array<{ status: string | null }> | null;
    }> | null;
  }> | null;
};

// 关联结果可能是对象或数组，统一取首项，并将空关联转换为 undefined。
function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

// 优先读取数据库聚合好的季摘要；仅在视图缺失时回退到逐集统计。
export async function getSeasonsBySeriesId(seriesId: string): Promise<SeasonInfo[]> {
  const db = getSupabasePublicServer();
  const aggregate = await db.from("v_media_season_summaries")
    .select("id,season_number,title,alternate_title,summary,cover_url,episode_count,watched_episode_count,first_year,last_year")
    .eq("series_id", seriesId).order("season_number", { ascending: true });
  if (!aggregate.error) {
    return (aggregate.data ?? []).map(/* 将聚合行转换为季摘要，规范计数字段、年份范围与空值。 */ (row) => ({
      id: row.id,
      seasonNumber: row.season_number,
      title: row.title ?? `第 ${row.season_number} 季`,
      alternateTitle: row.alternate_title ?? null,
      coverUrl: row.cover_url ?? "",
      episodeCount: Number(row.episode_count),
      watchedEpisodeCount: Number(row.watched_episode_count),
      releaseYearRange: formatYearRange(row.first_year, row.last_year),
      summary: row.summary ?? "",
    }));
  }
  if (!isMissingAggregateView(aggregate.error)) {
    throw new MediaRepositoryError("fetch season aggregates", aggregate.error);
  }
  const { data, error } = await db
    .from("tv_seasons")
    .select("id, season_number, tv_episodes(id, media_items(release_date, tracking(status)))")
    .eq("series_id", seriesId)
    .order("season_number", { ascending: true });

  if (error) {
    console.error(`Failed to fetch seasons for series ${seriesId}:`, error);
    throw new MediaRepositoryError("fetch series seasons", error);
  }

  const seasonRows = (data ?? []) as SeasonRow[];
  const seasonIds = seasonRows.map(/* 提取季 ID，用于批量读取季简介和封面。 */ (season) => season.id);
  const { data: mediaItems, error: mediaItemsError } = seasonIds.length > 0
    ? await db.from("media_items").select("id, title, alternate_title, summary, cover_url").in("id", seasonIds)
    : { data: [], error: null };

  if (mediaItemsError) {
    console.error(`Failed to fetch season summaries for series ${seriesId}:`, mediaItemsError);
  }

  const seasonMedia = new Map((mediaItems ?? []).map(/* 以媒体 ID 建立完整行的查找表条目。 */ (item) => [item.id, item]));

  return seasonRows.map(/* 根据该季剧集计算首末发行年份和已看集数，并合并季的简介与封面。 */ (season) => {
    const releaseDates = (season.tv_episodes ?? [])
      .map(/* 兼容对象或数组关联，读取单集发行日期。 */ (episode) => {
        const mediaItem = Array.isArray(episode.media_items) ? episode.media_items[0] : episode.media_items;
        return mediaItem?.release_date;
      })
      .filter(/* 仅保留非空且符合四位年、两位月日格式的日期字符串。 */ (date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)))
      .sort();
    const firstYear = releaseDates[0]?.slice(0, 4);
    const lastYear = releaseDates.at(-1)?.slice(0, 4);
    const mediaItem = seasonMedia.get(season.id);
    const watchedEpisodeCount = (season.tv_episodes ?? []).filter(/* 判断剧集首个关联观看记录是否为已看。 */ (episode) => {
      const episodeMedia = Array.isArray(episode.media_items) ? episode.media_items[0] : episode.media_items;
      return firstRelated(episodeMedia?.tracking)?.status === "watched";
    }).length;

    return {
      id: season.id,
      seasonNumber: season.season_number,
      title: mediaItem?.title ?? `第 ${season.season_number} 季`,
      alternateTitle: mediaItem?.alternate_title ?? null,
      coverUrl: mediaItem?.cover_url ?? "",
      episodeCount: season.tv_episodes?.length ?? 0,
      watchedEpisodeCount,
      releaseYearRange: firstYear && lastYear
        ? (firstYear === lastYear ? firstYear : `${firstYear} - ${lastYear}`)
        : undefined,
      summary: mediaItem?.summary ?? "",
    };
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

/** 并行获取季简介与 RPC 剧集分页，规范返回字段；季不存在返回 null，查询失败抛错。 */
export async function getSeasonEpisodes(
  seriesId: string,
  seasonId: string,
  page: number,
  pageSize: number,
  status: "all" | "watched" | "unwatched" = "all",
  order: "asc" | "desc" = "asc",
): Promise<SeasonEpisodePage | null> {
  const db = getSupabasePublicServer();
  const offset = (page - 1) * pageSize;
  // 并行读取分页剧集与季简介；分页和整季统计由 RPC 一次返回。
  const [episodePageResult, seasonMediaResult] = await Promise.all([
    db.rpc("get_season_episode_page", {
      p_series_id: seriesId,
      p_season_id: seasonId,
      p_status: status,
      p_order: order,
      p_limit: pageSize,
      p_offset: offset,
    }),
    db
      .from("media_items")
      .select("title, alternate_title, summary, cover_url")
      .eq("id", seasonId)
      .maybeSingle(),
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
  const episodes: EpisodeInfo[] = (result.episodes ?? []).map(/* 将 RPC 剧集行转换为展示对象，补齐空字段并转换评分数值。 */ (episode) => ({
      id: episode.id,
      episodeNumber: episode.episode_number,
      title: episode.title ?? `第 ${episode.episode_number} 集`,
      alternateTitle: episode.alternate_title ?? null,
      summary: episode.summary ?? "",
      coverUrl: episode.cover_url ?? "",
      releaseDate: episode.release_date,
      runtime: episode.runtime,
      status: episode.status,
      rating: episode.rating === null ? null : Number(episode.rating),
  }));
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
      releaseYearRange: firstYear && lastYear ? (firstYear === lastYear ? firstYear : `${firstYear} - ${lastYear}`) : undefined,
      summary: seasonMedia?.summary ?? "",
    },
    episodes,
    total: Number(result.total),
    watchedCount,
    totalRuntime: Number(result.total_runtime),
    averageRating: result.average_rating === null ? null : Number(result.average_rating),
  };
}

/** 获取指定类型的评分榜单；年度电视剧按当年剧集评分排名，并补充电视剧年份范围。 */
export async function fetchTopMediaServer(
  mediaType: "movie" | "tv_series",
  year?: string | null,
  limit = 10,
): Promise<MediaCard[]> {
  const db = getSupabasePublicServer();

  if (mediaType === "tv_series" && year) {
    type RankedSeriesRow = {
      series_id: string;
      year_rating: number | string | null;
    };

    // 按年份查看电视剧榜单时，由数据库按当年剧集评分排名，再补齐卡片信息。
    const { data: rankedData, error: rankingError } = await db.rpc(
      "get_top_tv_series_by_year",
      { p_year: Number(year), p_limit: limit },
    );

    if (rankingError || !rankedData) {
      if (rankingError) console.error(`Failed to rank TV series released in ${year}:`, rankingError);
      throw new MediaRepositoryError("rank year-specific TV series", rankingError);
    }

    const rankedRows = rankedData as RankedSeriesRow[];
    const seriesIds = rankedRows.map(/* 提取数据库排名返回的电视剧 ID。 */ (row) => row.series_id);
    if (seriesIds.length === 0) return [];

    const ratingsBySeries = new Map(rankedRows.map(/* 将电视剧 ID 和可为空的年度评分组成查找表条目。 */ (row) => [
      row.series_id,
      row.year_rating === null ? null : Number(row.year_rating),
    ]));

    const { data: seriesData, error: seriesError } = await db
      .from("v_all_media")
      .select(MEDIA_CARD_COLUMNS)
      .eq("type", "tv_series")
      .in("id", seriesIds);

    if (seriesError || !seriesData) {
      if (seriesError) console.error(`Failed to fetch TV series released in ${year}:`, seriesError);
      throw new MediaRepositoryError("fetch year-specific TV series", seriesError);
    }

    const rankedSeries = (seriesData as ViewAllMediaRow[])
      .map(/* 将电视剧视图行转成卡片，并把评分替换为所选年份的评分。 */ (item) => {
        const yearRating = ratingsBySeries.get(String(item.id)) ?? null;
        return { ...mapViewRowToMediaCard(item), rating: yearRating };
      })
      .sort(/* 按年度评分降序排列，缺失评分置后，同分时按 ID 排序。 */ (left, right) =>
        (right.rating ?? -1) - (left.rating ?? -1) || left.id.localeCompare(right.id),
      );
    return addSeriesReleaseYearRanges(db, rankedSeries);
  }

  let query = db
    .from("v_all_media")
    .select(MEDIA_CARD_COLUMNS)
    .eq("type", mediaType)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (year) {
    query = query.gte("sort_date", `${year}-01-01`).lte("sort_date", `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch top media:", error);
    throw new MediaRepositoryError("fetch top media", error);
  }
  if (!data) return [];

  const items = data.map(/* 将榜单视图行转换为媒体卡片。 */ (item: ViewAllMediaRow) => mapViewRowToMediaCard(item));
  return mediaType === "tv_series" ? addSeriesReleaseYearRanges(db, items) : items;
}

/** 调用分布计数 RPC，再转换为按媒体类型和年份组织的前五名统计。 */
export async function fetchMediaDistributionsServer(): Promise<MediaDistributions> {
  const db = getSupabasePublicServer();

  const { data, error } = await db.rpc("get_media_distribution_counts");
  if (error || !data) {
    if (error) console.error("Failed to fetch media distribution counts:", error);
    throw new MediaRepositoryError("fetch media distribution counts", error);
  }

  return buildMediaDistributions(data as DistributionCountRow[]);
}

/** 使用统一列表查询执行搜索，返回卡片与精确总数。 */
export async function searchMediaServer(opts: FetchMediaListOptions = {}): Promise<{ rows: MediaCard[]; total: number }> {
  return fetchMediaList(opts);
}

/** 将列表查询入口委托给统一实现，保留卡片和总数返回结构。 */
export async function fetchMediaListServer(opts: FetchMediaListOptions = {}): Promise<{ rows: MediaCard[]; total: number }> {
  return fetchMediaList(opts);
}

// 目录页另有统计查询，此处只取卡片，跳过精确总数查询。
export async function fetchMediaCardsServer(opts: FetchMediaListOptions = {}): Promise<MediaCard[]> {
  return (await fetchMediaList(opts, false)).rows;
}

/** 合并分类搜索命中，统一应用属性筛选与稳定排序，再分页读取卡片并按需查询总数。 */
async function fetchMediaList(opts: FetchMediaListOptions, includeTotal = true): Promise<{ rows: MediaCard[]; total: number }> {
  const db = getSupabasePublicServer();
  const {
    type, seriesOnly = false, creditRole, status, genre, region, language, startYear, endYear, q, sort, limit = 30, offset = 0,
  } = opts || {};

  let dataQuery = db.from("v_all_media").select(MEDIA_CARD_COLUMNS);
  let countQuery = db.from("v_all_media").select("id", { count: "exact", head: true });

  const types = type?.split(",").filter(Boolean) ?? [];
  const creditRoles = creditRole?.split(",").filter(/* 只接受导演和演员两类演职员角色。 */ (role) => role === "director" || role === "actor") ?? [];
  const hasQuery = typeof q === "string" && q.trim().length > 0;
  const queryText = hasQuery ? `%${q.trim()}%` : "";
  const quotedQueryText = quotePostgrestFilterValue(queryText);
  const titleSearchFilter = `title.ilike.${quotedQueryText},alternate_title.ilike.${quotedQueryText}`;
  // 输入关键词且未限定分类时，同时搜索片名、作品系列名及导演和演员姓名。
  const searchesAllCategories = hasQuery && types.length === 0 && !seriesOnly && creditRoles.length === 0;
  const searchedTypes = searchesAllCategories ? ["movie", "tv_series"] : types;
  const searchesSeries = searchesAllCategories || seriesOnly;
  const searchedCreditRoles = searchesAllCategories ? ["director", "actor"] : creditRoles;

  let seriesItemIds: string[] = [];
  if (searchesSeries) {
    let seriesQuery = db
      .from("media_item_series")
      .select("media_item_id, media_series!inner(name)");
    if (hasQuery) {
      seriesQuery = seriesQuery.ilike("media_series.name", queryText);
    }

    const { data: seriesItems, error: seriesError } = await seriesQuery;
    if (seriesError) {
      console.error("Failed to filter media by series:", seriesError);
      throw new MediaRepositoryError("filter media by series", seriesError);
    }

    seriesItemIds = Array.from(new Set((seriesItems ?? []).map(/* 提取作品系列匹配到的媒体 ID。 */ (item) => item.media_item_id)));
  }

  let classificationHandlesQuery = false;

  if (hasQuery && (searchedTypes.length > 0 || searchesSeries || searchedCreditRoles.length > 0)) {
    const [titleResult, creditResult] = await Promise.all([
      searchedTypes.length > 0 || searchesSeries
        ? db.from("v_all_media").select("id, type").or(titleSearchFilter)
        : Promise.resolve({ data: [], error: null }),
      searchedCreditRoles.length > 0
        ? db
            .from("media_credits")
            .select("media_item_id, people!inner(name)")
            .in("role", searchedCreditRoles)
            .or(`name.ilike.${quotedQueryText},alternate_name.ilike.${quotedQueryText}`, {
              referencedTable: "people",
            })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (titleResult.error || creditResult.error) {
      console.error("Failed to filter media by search category:", titleResult.error ?? creditResult.error);
      throw new MediaRepositoryError("filter media by search category", titleResult.error ?? creditResult.error);
    }

    const titleMatches = titleResult.data ?? [];
    const typedTitleIds = searchedTypes.length > 0
      ? titleMatches
          .filter(/* 只保留类型属于当前搜索分类的标题命中。 */ (item) => searchedTypes.includes(String(item.type)))
          .map(/* 将匹配条目的 ID 转为字符串以合并搜索结果。 */ (item) => String(item.id))
      : [];

    let seriesTitleIds: string[] = [];
    if (seriesOnly && titleMatches.length > 0) {
      const { data: seriesTitleItems, error: seriesTitleError } = await db
        .from("media_item_series")
        .select("media_item_id")
        .in("media_item_id", titleMatches.map(/* 提取标题命中的字符串 ID，用于查询作品系列关联。 */ (item) => String(item.id)));

      if (seriesTitleError) {
        console.error("Failed to filter series media by title:", seriesTitleError);
        throw new MediaRepositoryError("filter series media by title", seriesTitleError);
      }

      seriesTitleIds = (seriesTitleItems ?? []).map(/* 提取同时命中标题和作品系列关联的媒体 ID。 */ (item) => item.media_item_id);
    }

    // 各搜索分类的命中结果取并集并去重，再统一叠加状态、年份等筛选条件。
    const matchingIds = Array.from(new Set([
      ...(searchesSeries ? seriesItemIds : []),
      ...typedTitleIds,
      ...seriesTitleIds,
      ...(creditResult.data ?? []).map(/* 提取演职员搜索命中的媒体 ID。 */ (credit) => credit.media_item_id),
    ]));
    if (matchingIds.length === 0) {
      return { rows: [], total: 0 };
    }

    dataQuery = dataQuery.in("id", matchingIds);
    countQuery = countQuery.in("id", matchingIds);
    classificationHandlesQuery = true;
  } else if (seriesOnly && types.length > 0) {
    const typeFilter = `type.in.(${types.join(",")})`;
    const filters = seriesItemIds.length > 0
      ? `${typeFilter},id.in.(${seriesItemIds.join(",")})`
      : typeFilter;
    dataQuery = dataQuery.or(filters);
    countQuery = countQuery.or(filters);
  } else if (seriesOnly) {
    dataQuery = dataQuery.in("id", seriesItemIds);
    countQuery = countQuery.in("id", seriesItemIds);
  } else if (types.length > 0) {
    dataQuery = dataQuery.in("type", types);
    countQuery = countQuery.in("type", types);
  }
  // 数据查询与计数查询使用相同筛选条件，保证分页总数对应当前结果集。
  if (status) {
    const statuses = status.split(",");
    dataQuery = dataQuery.in("status", statuses);
    countQuery = countQuery.in("status", statuses);
  }
  if (genre) {
    const genres = genre.split(",");
    dataQuery = dataQuery.overlaps("genres", genres);
    countQuery = countQuery.overlaps("genres", genres);
  }
  if (region) {
    const regions = region.split(",");
    dataQuery = dataQuery.overlaps("regions", regions);
    countQuery = countQuery.overlaps("regions", regions);
  }
  if (language) {
    const languages = language.split(",");
    dataQuery = dataQuery.overlaps("languages", languages);
    countQuery = countQuery.overlaps("languages", languages);
  }
  if (startYear) {
    dataQuery = dataQuery.gte("sort_date", `${startYear}-01-01`);
    countQuery = countQuery.gte("sort_date", `${startYear}-01-01`);
  }
  if (endYear) {
    dataQuery = dataQuery.lte("sort_date", `${endYear}-12-31`);
    countQuery = countQuery.lte("sort_date", `${endYear}-12-31`);
  }
  if (!classificationHandlesQuery && !seriesOnly && hasQuery) {
    dataQuery = dataQuery.or(titleSearchFilter);
    countQuery = countQuery.or(titleSearchFilter);
  }

  if (sort) {
    const [field, order] = sort.split("_");
    const ascending = order === "asc";

    if (field === "date") {
      dataQuery = dataQuery.order("sort_date", { ascending, nullsFirst: false });
    } else if (field === "rating") {
      dataQuery = dataQuery.order("rating", { ascending, nullsFirst: false });
    }
  } else {
    dataQuery = dataQuery.order("sort_date", { ascending: false, nullsFirst: false });
  }

  // 用唯一 ID 打破日期或评分相同时的排序平局，防止跨页重复或漏项。
  dataQuery = dataQuery.order("id", { ascending: true });

  dataQuery = dataQuery.range(offset, offset + limit - 1);

  const [dataRes, countRes] = await Promise.all([dataQuery, includeTotal ? countQuery : Promise.resolve({ count: null, error: null })]);

  if (dataRes.error || countRes.error) {
    console.error("Failed to fetch media list:", dataRes.error ?? countRes.error);
    throw new MediaRepositoryError("fetch media list", dataRes.error ?? countRes.error);
  }

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const mappedResults: MediaCard[] = data.map(/* 将分页查询结果转换为卡片对象。 */ (item: ViewAllMediaRow) => mapViewRowToMediaCard(item));
  const results = await addSeriesReleaseYearRanges(db, mappedResults);

  return { rows: results, total };
}

// 读取数据库的媒体状态统计，并将可能以字符串返回的计数转换为数字。
export async function fetchStatsServer(mediaType: "movie" | "tv_series") {
  const db = getSupabasePublicServer();
  const { data, error } = await db.rpc("get_media_stats", { p_media_type: mediaType });
  if (error || !data?.[0]) {
    if (error) console.error("Failed to fetch media stats:", error);
    throw new MediaRepositoryError("fetch media stats", error);
  }
  const stats = data[0] as Record<"total" | "watched" | "watching" | "want" | "upcoming", number | string>;

  return {
    total: Number(stats.total),
    watched: Number(stats.watched),
    watching: Number(stats.watching),
    want: Number(stats.want),
    upcoming: Number(stats.upcoming),
  };
}
