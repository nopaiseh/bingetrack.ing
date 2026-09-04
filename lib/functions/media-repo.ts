import { getSupabaseServer } from "@/utils/supabase";
import { getSupabasePublicServer } from "@/utils/supabase";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";
import { buildMediaDistributions, type DistributionCountRow } from "@/lib/functions/media-distributions";
import { EpisodeInfo, Media, MediaDistributions, SeasonEpisodePage, SeasonInfo, ViewAllMediaRow, FetchMediaListOptions } from "@/lib/types";

/*
  媒体仓库（server-side helpers）

  说明：
  - 把常用的 v_all_media 查询封装到统一的函数中，页面调用这些函数无需关心视图字段细节。
  - 所有导出的函数均为服务端使用（使用 getSupabaseServer），若需要浏览器端查询，请使用 utils/supabase-client 中的客户端 API。
*/

declare global {
  var _mediaRepoCache: Map<string, { ts: number; data: Media[]; total?: number }> | undefined;
}

const MEDIA_CACHE_TTL_MS = 30_000;
const MEDIA_CACHE_MAX_ENTRIES = 200;

export class MediaRepositoryError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Media repository operation failed: ${operation}`, { cause });
    this.name = "MediaRepositoryError";
  }
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

/** Return every public movie and TV series route for the generated sitemap. */
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
    entries.push(...rows.map((row) => ({
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
    entries.push(...rows.map((row) => ({
      path: `/series/${encodeURIComponent(String(row.series_id))}/seasons/${encodeURIComponent(String(row.id))}`,
    })));

    if (rows.length < SITEMAP_PAGE_SIZE) break;
  }

  return entries;
}

async function addSeriesReleaseYearRanges(
  db: ReturnType<typeof getSupabaseServer>,
  items: Media[],
): Promise<Media[]> {
  const seriesIds = items
    .filter((item) => item.type === "series")
    .map((item) => item.id);
  if (seriesIds.length === 0) return items;

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

  return items.map((item) => {
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

// 获取单条媒体详情
export async function getMediaById(id: string): Promise<Media | null> {
  const db = getSupabasePublicServer();

  // 1. 从视图中直接拉取所有扁平化、计算好的数据
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

  // 2. The view does not expose collection memberships, so load every linked
  // series from the many-to-many junction table in display order.
  const { data: seriesData, error: seriesError } = await db
    .from("media_item_series")
    .select("position, media_series(name)")
    .eq("media_item_id", id)
    .order("position", { ascending: true, nullsFirst: false });

  if (seriesError) {
    console.error(`Failed to fetch series memberships for media ${id}:`, seriesError);
  }

  const seriesNames = (seriesData ?? []).flatMap((membership) => {
    const linkedSeries = Array.isArray(membership.media_series)
      ? membership.media_series[0]
      : membership.media_series;
    return linkedSeries?.name ? [linkedSeries.name] : [];
  });

  return mapViewRowToMedia(viewData as ViewAllMediaRow, seriesNames);
}

// 2. 获取同系列相关作品
export async function getRelatedBySeries(seriesName: string, currentId: string): Promise<Media[]> {
  if (!seriesName) return [];

  const db = getSupabasePublicServer();

  // 第一步：从基础表中查询出属于该系列的所有作品的 ID (排除当前正在看的这部)
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

  const relatedIds = seriesItems.map((item) => item.media_item_id);

  // 第二步：拿着这些 ID，去 v_all_media 视图中拉取完整的富媒体数据
  const { data, error } = await db
    .from("v_all_media")
    .select("*")
    .in("id", relatedIds)
    .order("sort_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error || !data) {
    console.error(`Failed to fetch related media details for series ${seriesName}:`, error);
    return [];
  }

  return data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item, [seriesName]));
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

function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function getSeasonsBySeriesId(seriesId: string): Promise<SeasonInfo[]> {
  const db = getSupabasePublicServer();
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
  const seasonIds = seasonRows.map((season) => season.id);
  const { data: mediaItems, error: mediaItemsError } = seasonIds.length > 0
    ? await db.from("media_items").select("id, title, alternate_title, summary, cover_url").in("id", seasonIds)
    : { data: [], error: null };

  if (mediaItemsError) {
    console.error(`Failed to fetch season summaries for series ${seriesId}:`, mediaItemsError);
  }

  const seasonMedia = new Map((mediaItems ?? []).map((item) => [item.id, item]));

  return seasonRows.map((season) => {
    const releaseDates = (season.tv_episodes ?? [])
      .map((episode) => {
        const mediaItem = Array.isArray(episode.media_items) ? episode.media_items[0] : episode.media_items;
        return mediaItem?.release_date;
      })
      .filter((date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)))
      .sort();
    const firstYear = releaseDates[0]?.slice(0, 4);
    const lastYear = releaseDates.at(-1)?.slice(0, 4);
    const mediaItem = seasonMedia.get(season.id);
    const watchedEpisodeCount = (season.tv_episodes ?? []).filter((episode) => {
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

export async function getSeasonEpisodes(
  seriesId: string,
  seasonId: string,
  page: number,
  pageSize: number,
  status: "all" | "watched" | "unwatched" = "all",
  order: "asc" | "desc" = "asc",
): Promise<SeasonEpisodePage | null> {
  const db = getSupabaseServer();
  const offset = (page - 1) * pageSize;
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
  const episodes: EpisodeInfo[] = (result.episodes ?? []).map((episode) => ({
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

// 从视图中获取前 N 条媒体（按评分降序），用于首页/看板显示
export async function fetchTopMediaServer(
  mediaType: "movie" | "tv_series",
  year?: string | null,
  limit = 10,
): Promise<Media[]> {
  const db = mediaType === "tv_series" && year
    ? getSupabaseServer()
    : getSupabasePublicServer();

  if (mediaType === "tv_series" && year) {
    type RankedSeriesRow = {
      series_id: string;
      year_rating: number | string | null;
    };

    // PostgreSQL performs the episode-year filtering, grouping, averaging,
    // ordering, and limiting. The app only receives the ranked series IDs.
    const { data: rankedData, error: rankingError } = await db.rpc(
      "get_top_tv_series_by_year",
      { p_year: Number(year), p_limit: limit },
    );

    if (rankingError || !rankedData) {
      if (rankingError) console.error(`Failed to rank TV series released in ${year}:`, rankingError);
      throw new MediaRepositoryError("rank year-specific TV series", rankingError);
    }

    const rankedRows = rankedData as RankedSeriesRow[];
    const seriesIds = rankedRows.map((row) => row.series_id);
    if (seriesIds.length === 0) return [];

    const ratingsBySeries = new Map(rankedRows.map((row) => [
      row.series_id,
      row.year_rating === null ? null : Number(row.year_rating),
    ]));

    const { data: seriesData, error: seriesError } = await db
      .from("v_all_media")
      .select("*")
      .eq("type", "tv_series")
      .in("id", seriesIds);

    if (seriesError || !seriesData) {
      if (seriesError) console.error(`Failed to fetch TV series released in ${year}:`, seriesError);
      throw new MediaRepositoryError("fetch year-specific TV series", seriesError);
    }

    const rankedSeries = (seriesData as ViewAllMediaRow[])
      .map((item) => {
        const yearRating = ratingsBySeries.get(String(item.id)) ?? null;
        return { ...mapViewRowToMedia(item), rating: yearRating };
      })
      .sort((left, right) =>
        (right.rating ?? -1) - (left.rating ?? -1) || left.id.localeCompare(right.id),
      );
    return addSeriesReleaseYearRanges(db, rankedSeries);
  }

  let query = db
    .from("v_all_media")
    .select("*")
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

  const items = data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item));
  return mediaType === "tv_series" ? addSeriesReleaseYearRanges(db, items) : items;
}

export async function fetchMediaDistributionsServer(): Promise<MediaDistributions> {
  const db = getSupabaseServer();

  const { data, error } = await db.rpc("get_media_distribution_counts");
  if (error || !data) {
    if (error) console.error("Failed to fetch media distribution counts:", error);
    throw new MediaRepositoryError("fetch media distribution counts", error);
  }

  return buildMediaDistributions(data as DistributionCountRow[]);
}

export async function searchMediaServer(opts: FetchMediaListOptions = {}): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaList(opts);
}

export async function fetchMediaListServer(opts: FetchMediaListOptions = {}): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaList(opts);
}

async function fetchMediaList(opts: FetchMediaListOptions): Promise<{ rows: Media[]; total: number }> {
  const db = getSupabasePublicServer();
  const {
    type, seriesOnly = false, creditRole, status, genre, region, language, startYear, endYear, q, sort, limit = 30, offset = 0,
  } = opts || {};

  // 1. 初始化缓存变量
  const cacheKey = JSON.stringify({ type, seriesOnly, creditRole, status, genre, region, language, startYear, endYear, q, sort, limit, offset });
  const now = Date.now();

  // 2. 内存缓存读取机制
  if (!globalThis._mediaRepoCache) {
    globalThis._mediaRepoCache = new Map();
  }
  const cache = globalThis._mediaRepoCache;
  const cached = cache.get(cacheKey);

  if (cached && now - cached.ts < MEDIA_CACHE_TTL_MS) {
    return { rows: cached.data, total: cached.total ?? 0 };
  }
  if (cached) cache.delete(cacheKey);

  // 3. 构造查询
  let dataQuery = db.from("v_all_media").select("*");
  let countQuery = db.from("v_all_media").select("id", { count: "exact", head: true });

  const types = type?.split(",").filter(Boolean) ?? [];
  const creditRoles = creditRole?.split(",").filter((role) => role === "director" || role === "actor") ?? [];
  const hasQuery = typeof q === "string" && q.trim().length > 0;
  const queryText = hasQuery ? `%${q.trim()}%` : "";
  const titleSearchFilter = `title.ilike.${queryText},alternate_title.ilike.${queryText}`;
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

    seriesItemIds = Array.from(new Set((seriesItems ?? []).map((item) => item.media_item_id)));
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
            .or(`name.ilike.${queryText},alternate_name.ilike.${queryText}`, {
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
          .filter((item) => searchedTypes.includes(String(item.type)))
          .map((item) => String(item.id))
      : [];

    let seriesTitleIds: string[] = [];
    if (seriesOnly && titleMatches.length > 0) {
      const { data: seriesTitleItems, error: seriesTitleError } = await db
        .from("media_item_series")
        .select("media_item_id")
        .in("media_item_id", titleMatches.map((item) => String(item.id)));

      if (seriesTitleError) {
        console.error("Failed to filter series media by title:", seriesTitleError);
        throw new MediaRepositoryError("filter series media by title", seriesTitleError);
      }

      seriesTitleIds = (seriesTitleItems ?? []).map((item) => item.media_item_id);
    }

    const matchingIds = Array.from(new Set([
      ...(searchesSeries ? seriesItemIds : []),
      ...typedTitleIds,
      ...seriesTitleIds,
      ...(creditResult.data ?? []).map((credit) => credit.media_item_id),
    ]));
    if (matchingIds.length === 0) {
      cache.set(cacheKey, { ts: now, data: [], total: 0 });
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

  // Offset pagination needs a unique tie-breaker or equal dates/ratings can
  // move between pages and appear duplicated or missing.
  dataQuery = dataQuery.order("id", { ascending: true });

  dataQuery = dataQuery.range(offset, offset + limit - 1);

  const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);

  if (dataRes.error || countRes.error) {
    console.error("Failed to fetch media list:", dataRes.error ?? countRes.error);
    throw new MediaRepositoryError("fetch media list", dataRes.error ?? countRes.error);
  }

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const mappedResults: Media[] = data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item));
  const results = await addSeriesReleaseYearRanges(db, mappedResults);

  // Keep the short-lived process cache bounded on long-running server instances.
  if (cache.size >= MEDIA_CACHE_MAX_ENTRIES) {
    for (const [key, entry] of cache) {
      if (now - entry.ts >= MEDIA_CACHE_TTL_MS || cache.size >= MEDIA_CACHE_MAX_ENTRIES) {
        cache.delete(key);
      }
      if (cache.size < MEDIA_CACHE_MAX_ENTRIES) break;
    }
  }
  cache.set(cacheKey, { ts: now, data: results, total });

  return { rows: results, total };
}

// 统计信息查询（例如 Movies / Series 页面需要的 total/watched/want/upcoming）
export async function fetchStatsServer(mediaType: "movie" | "tv_series") {
  const db = getSupabaseServer();
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
