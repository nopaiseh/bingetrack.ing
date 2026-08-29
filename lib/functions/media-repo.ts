import { getSupabaseServer } from "@/utils/supabase";
import { getSupabaseBrowser } from "@/utils/supabase-client";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";
import { DistributionItem, EpisodeInfo, Media, MediaDistribution, MediaDistributions, SeasonEpisodePage, SeasonInfo, ViewAllMediaRow, FetchMediaListOptions } from "@/lib/types";

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

// 获取单条媒体详情
export async function getMediaById(id: string): Promise<Media | null> {
  const db = getSupabaseServer();

  // 1. 从视图中直接拉取所有扁平化、计算好的数据
  const { data: viewData, error: viewError } = await db
    .from("v_all_media")
    .select("*")
    .eq("id", id)
    .single();

  if (viewError || !viewData) {
    console.error(`Failed to fetch media details for id ${id}:`, viewError);
    return null;
  }

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

  const db = getSupabaseServer();

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
  const db = getSupabaseServer();
  const { data, error } = await db
    .from("tv_seasons")
    .select("id, season_number, tv_episodes(id, media_items(release_date, tracking(status)))")
    .eq("series_id", seriesId)
    .order("season_number", { ascending: true });

  if (error) {
    console.error(`Failed to fetch seasons for series ${seriesId}:`, error);
    return [];
  }

  const seasonRows = (data ?? []) as SeasonRow[];
  const seasonIds = seasonRows.map((season) => season.id);
  const { data: mediaItems, error: mediaItemsError } = seasonIds.length > 0
    ? await db.from("media_items").select("id, title, summary, cover_url").in("id", seasonIds)
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

type EpisodeRow = {
  id: string;
  episode_number: number;
  media_items: {
    title: string | null;
    summary: string | null;
    cover_url: string | null;
    release_date: string | null;
    runtime: number | null;
    tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
  } | Array<{
    title: string | null;
    summary: string | null;
    cover_url: string | null;
    release_date: string | null;
    runtime: number | null;
    tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
  }> | null;
};

type SeasonHeaderRow = {
  id: string;
  season_number: number;
  tv_episodes: Array<{
    id: string;
    episode_number: number;
    media_items: {
      release_date: string | null;
      runtime: number | null;
      tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
    } | Array<{
      release_date: string | null;
      runtime: number | null;
      tracking: { status: string | null; rating: number | null } | Array<{ status: string | null; rating: number | null }> | null;
    }> | null;
  }> | null;
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
  const [seasonResult, seasonMediaResult] = await Promise.all([
    db
      .from("tv_seasons")
      .select("id, season_number, tv_episodes(id, episode_number, media_items(release_date, runtime, tracking(status, rating)))")
      .eq("id", seasonId)
      .eq("series_id", seriesId)
      .maybeSingle(),
    db
      .from("media_items")
      .select("title, summary, cover_url")
      .eq("id", seasonId)
      .maybeSingle(),
  ]);
  const { data: seasonData, error: seasonError } = seasonResult;
  const { data: seasonMedia, error: seasonMediaError } = seasonMediaResult;

  if (seasonError || !seasonData) {
    if (seasonError) console.error(`Failed to fetch season ${seasonId}:`, seasonError);
    return null;
  }

  if (seasonMediaError) {
    console.error(`Failed to fetch summary for season ${seasonId}:`, seasonMediaError);
  }

  const season = seasonData as SeasonHeaderRow;
  const allEpisodes = (season.tv_episodes ?? []).map((episode) => {
    const mediaItem = Array.isArray(episode.media_items) ? episode.media_items[0] : episode.media_items;
    const tracking = firstRelated(mediaItem?.tracking);
    return {
      id: episode.id,
      episodeNumber: episode.episode_number,
      releaseDate: mediaItem?.release_date ?? null,
      runtime: mediaItem?.runtime ?? null,
      status: tracking?.status ?? null,
      rating: tracking?.rating ?? null,
    };
  });
  const watchedCount = allEpisodes.filter((episode) => episode.status === "watched").length;
  const totalRuntime = allEpisodes.reduce((sum, episode) => sum + (episode.runtime ?? 0), 0);
  const ratings = allEpisodes.map((episode) => episode.rating).filter((rating): rating is number => rating !== null);
  const averageRating = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
  const filteredEpisodes = allEpisodes
    .filter((episode) => status === "all" || (status === "watched" ? episode.status === "watched" : episode.status !== "watched"))
    .sort((left, right) => order === "asc" ? left.episodeNumber - right.episodeNumber : right.episodeNumber - left.episodeNumber);
  const offset = (page - 1) * pageSize;
  const pageIds = filteredEpisodes.slice(offset, offset + pageSize).map((episode) => episode.id);

  let episodeRows: EpisodeRow[] = [];
  if (pageIds.length > 0) {
    const { data, error } = await db
      .from("tv_episodes")
      .select("id, episode_number, media_items(title, summary, cover_url, release_date, runtime, tracking(status, rating))")
      .in("id", pageIds);

    if (error) {
      console.error(`Failed to fetch episodes for season ${seasonId}:`, error);
      return null;
    }
    episodeRows = (data ?? []) as EpisodeRow[];
  }

  const episodeMap = new Map(episodeRows.map((episode) => [episode.id, episode]));
  const episodes: EpisodeInfo[] = pageIds.flatMap((id) => {
    const episode = episodeMap.get(id);
    if (!episode) return [];
    const mediaItem = Array.isArray(episode.media_items) ? episode.media_items[0] : episode.media_items;
    const tracking = firstRelated(mediaItem?.tracking);
    return [{
      id: episode.id,
      episodeNumber: episode.episode_number,
      title: mediaItem?.title ?? `第 ${episode.episode_number} 集`,
      summary: mediaItem?.summary ?? "",
      coverUrl: mediaItem?.cover_url ?? "",
      releaseDate: mediaItem?.release_date ?? null,
      runtime: mediaItem?.runtime ?? null,
      status: tracking?.status ?? null,
      rating: tracking?.rating ?? null,
    }];
  });

  const dates = allEpisodes
    .map((episode) => episode.releaseDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  const firstYear = dates[0]?.slice(0, 4);
  const lastYear = dates.at(-1)?.slice(0, 4);

  return {
    season: {
      id: season.id,
      seasonNumber: season.season_number,
      title: seasonMedia?.title ?? `第 ${season.season_number} 季`,
      coverUrl: seasonMedia?.cover_url ?? "",
      episodeCount: allEpisodes.length,
      watchedEpisodeCount: watchedCount,
      releaseYearRange: firstYear && lastYear ? (firstYear === lastYear ? firstYear : `${firstYear} - ${lastYear}`) : undefined,
      summary: seasonMedia?.summary ?? "",
    },
    episodes,
    total: filteredEpisodes.length,
    watchedCount,
    totalRuntime,
    averageRating,
  };
}

// 从视图中获取前 N 条媒体（按评分降序），用于首页/看板显示
export async function fetchTopMediaServer(
  mediaType: "movie" | "tv_series",
  year?: string | null,
  limit = 10,
): Promise<Media[]> {
  const db = getSupabaseServer();

  if (mediaType === "tv_series" && year) {
    type YearEpisodeRow = {
      tv_seasons: { series_id: string } | Array<{ series_id: string }> | null;
      media_items: {
        tracking: { rating: number | null } | Array<{ rating: number | null }> | null;
      } | Array<{
        tracking: { rating: number | null } | Array<{ rating: number | null }> | null;
      }> | null;
    };

    // A series belongs to a year when at least one of its episodes was released
    // in that year. Its ranking score is the mean of ratings on only those
    // episodes (unrated episodes do not contribute to the mean).
    const { data: episodeData, error: episodeError } = await db
      .from("tv_episodes")
      .select("tv_seasons!inner(series_id), media_items!inner(release_date, tracking(rating))")
      .gte("media_items.release_date", `${year}-01-01`)
      .lte("media_items.release_date", `${year}-12-31`);

    if (episodeError || !episodeData) {
      if (episodeError) console.error(`Failed to fetch TV episodes released in ${year}:`, episodeError);
      return [];
    }

    const ratingsBySeries = new Map<string, number[]>();
    for (const episode of episodeData as YearEpisodeRow[]) {
      const season = firstRelated(episode.tv_seasons);
      const mediaItem = firstRelated(episode.media_items);
      if (!season?.series_id) continue;

      const ratings = ratingsBySeries.get(season.series_id) ?? [];
      const rating = firstRelated(mediaItem?.tracking)?.rating;
      if (rating !== null && rating !== undefined) ratings.push(rating);
      ratingsBySeries.set(season.series_id, ratings);
    }

    const seriesIds = Array.from(ratingsBySeries.keys());
    if (seriesIds.length === 0) return [];

    const { data: seriesData, error: seriesError } = await db
      .from("v_all_media")
      .select("*")
      .eq("type", "tv_series")
      .in("id", seriesIds);

    if (seriesError || !seriesData) {
      if (seriesError) console.error(`Failed to fetch TV series released in ${year}:`, seriesError);
      return [];
    }

    return (seriesData as ViewAllMediaRow[])
      .map((item) => {
        const ratings = ratingsBySeries.get(String(item.id)) ?? [];
        const yearRating = ratings.length > 0
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null;
        return { ...mapViewRowToMedia(item), rating: yearRating };
      })
      .sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1))
      .slice(0, limit);
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
  if (error || !data) return [];

  return data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item));
}

type DistributionSourceRow = Pick<ViewAllMediaRow, "type" | "sort_date" | "release_year" | "regions" | "languages" | "genres">;

type DistributionCounts = {
  regions: Map<string, number>;
  languages: Map<string, number>;
  genres: Map<string, number>;
};

const EMPTY_DISTRIBUTION: MediaDistribution = { regions: [], languages: [], genres: [] };

function createDistributionCounts(): DistributionCounts {
  return { regions: new Map(), languages: new Map(), genres: new Map() };
}

function incrementCounts(target: Map<string, number>, values: string[] | null | undefined) {
  const uniqueValues = new Set((values ?? []).map((value) => value.trim()).filter(Boolean));
  for (const value of uniqueValues) {
    target.set(value, (target.get(value) ?? 0) + 1);
  }
}

function topFive(counts: Map<string, number>): DistributionItem[] {
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }));
}

function finalizeDistribution(counts: DistributionCounts): MediaDistribution {
  return {
    regions: topFive(counts.regions),
    languages: topFive(counts.languages),
    genres: topFive(counts.genres),
  };
}

export async function fetchMediaDistributionsServer(): Promise<MediaDistributions> {
  const db = getSupabaseServer();
  const pageSize = 1000;
  const rows: DistributionSourceRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("v_all_media")
      .select("type, sort_date, release_year, regions, languages, genres")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Failed to fetch media distribution data:", error);
      return { movies: { "All Time": EMPTY_DISTRIBUTION }, series: { "All Time": EMPTY_DISTRIBUTION } };
    }

    const page = (data ?? []) as DistributionSourceRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const countsByType: Record<"movies" | "series", Map<string, DistributionCounts>> = {
    movies: new Map([["All Time", createDistributionCounts()]]),
    series: new Map([["All Time", createDistributionCounts()]]),
  };

  for (const row of rows) {
    const mediaType = row.type === "movie" || row.type === "movies" ? "movies" : row.type === "tv_series" || row.type === "series" ? "series" : null;
    if (!mediaType) continue;

    const year = String(row.release_year ?? row.sort_date?.slice(0, 4) ?? "").trim();
    const buckets = [countsByType[mediaType].get("All Time")!];
    if (year) {
      if (!countsByType[mediaType].has(year)) countsByType[mediaType].set(year, createDistributionCounts());
      buckets.push(countsByType[mediaType].get(year)!);
    }

    for (const bucket of buckets) {
      incrementCounts(bucket.regions, row.regions);
      incrementCounts(bucket.languages, row.languages);
      incrementCounts(bucket.genres, row.genres);
    }
  }

  return {
    movies: Object.fromEntries(Array.from(countsByType.movies, ([year, counts]) => [year, finalizeDistribution(counts)])),
    series: Object.fromEntries(Array.from(countsByType.series, ([year, counts]) => [year, finalizeDistribution(counts)])),
  };
}

export async function searchMediaServer(opts: FetchMediaListOptions = {}): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaList(opts, true);
}

export async function fetchMediaListServer(opts: FetchMediaListOptions = {}): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaList(opts, false);
}

async function fetchMediaList(
  opts: FetchMediaListOptions,
  usePublicClient: boolean,
): Promise<{ rows: Media[]; total: number }> {
  const db = usePublicClient ? getSupabaseBrowser() : getSupabaseServer();
  const {
    type, seriesOnly = false, creditRole, status, genre, region, language, startYear, endYear, q, sort, limit = 30, offset = 0,
  } = opts || {};

  // 1. 初始化缓存变量
  const cacheKey = JSON.stringify({ access: usePublicClient ? "public" : "service", type, seriesOnly, creditRole, status, genre, region, language, startYear, endYear, q, sort, limit, offset });
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

  let seriesItemIds: string[] = [];
  if (seriesOnly) {
    let seriesQuery = db
      .from("media_item_series")
      .select("media_item_id, media_series!inner(name)");
    if (hasQuery) {
      seriesQuery = seriesQuery.ilike("media_series.name", queryText);
    }

    const { data: seriesItems, error: seriesError } = await seriesQuery;
    if (seriesError) {
      console.error("Failed to filter media by series:", seriesError);
      return { rows: [], total: 0 };
    }

    seriesItemIds = Array.from(new Set((seriesItems ?? []).map((item) => item.media_item_id)));
  }

  let classificationHandlesQuery = false;

  if (hasQuery && (types.length > 0 || seriesOnly || creditRoles.length > 0)) {
    const [titleResult, creditResult] = await Promise.all([
      types.length > 0
        ? db.from("v_all_media").select("id").in("type", types).ilike("title", queryText)
        : Promise.resolve({ data: [], error: null }),
      creditRoles.length > 0
        ? db
            .from("media_credits")
            .select("media_item_id, people!inner(name)")
            .in("role", creditRoles)
            .ilike("people.name", queryText)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (titleResult.error || creditResult.error) {
      console.error("Failed to filter media by search category:", titleResult.error ?? creditResult.error);
      return { rows: [], total: 0 };
    }

    const matchingIds = Array.from(new Set([
      ...(seriesOnly ? seriesItemIds : []),
      ...(titleResult.data ?? []).map((item) => String(item.id)),
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
    dataQuery = dataQuery.ilike("title", queryText);
    countQuery = countQuery.ilike("title", queryText);
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

  dataQuery = dataQuery.range(offset, offset + limit - 1);

  const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);

  if (dataRes.error || countRes.error) {
    console.error("Failed to fetch media list:", dataRes.error ?? countRes.error);
    return { rows: [], total: 0 };
  }

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const results: Media[] = data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item));

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
  const today = new Date().toISOString().split("T")[0];

  const [totalRes, watchedRes, watchingRes, wantRes, upcomingRes] = await Promise.all([
    db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType),
    db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).eq("status", "watched"),
    db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).eq("status", "watching"),
    db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).eq("status", "want_to_watch"),
    db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).gte("sort_date", today),
  ]);

  return {
    total: totalRes.count ?? 0,
    watched: watchedRes.count ?? 0,
    watching: watchingRes.count ?? 0,
    want: wantRes.count ?? 0,
    upcoming: upcomingRes.count ?? 0,
  };
}
