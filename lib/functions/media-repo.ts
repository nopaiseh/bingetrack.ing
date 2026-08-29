import { getSupabaseServer } from "@/utils/supabase";
import { getSupabaseBrowser } from "@/utils/supabase-client";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";
import { DistributionItem, Media, MediaDistribution, MediaDistributions, ViewAllMediaRow, FetchMediaListOptions } from "@/lib/types";

/*
  媒体仓库（server-side helpers）

  说明：
  - 把常用的 v_all_media 查询封装到统一的函数中，页面调用这些函数无需关心视图字段细节。
  - 所有导出的函数均为服务端使用（使用 getSupabaseServer），若需要浏览器端查询，请使用 utils/supabase-client 中的客户端 API。
*/

declare global {
  var _mediaRepoCache: Map<string, { ts: number; data: Media[]; total?: number }> | undefined;
}

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

  // 2. 因为视图里没有 series 字段，我们查一下原表补齐系列名称
  const { data: seriesData } = await db
    .from("media_items")
    .select("media_series(name)")
    .eq("id", id)
    .single();

  const seriesObj = Array.isArray(seriesData?.media_series)
    ? seriesData?.media_series[0]
    : seriesData?.media_series;

  return mapViewRowToMedia(viewData as ViewAllMediaRow, seriesObj?.name ?? null);
}

// 2. 获取同系列相关作品
export async function getRelatedBySeries(seriesName: string, currentId: string): Promise<Media[]> {
  if (!seriesName) return [];

  const db = getSupabaseServer();

  // 第一步：从基础表中查询出属于该系列的所有作品的 ID (排除当前正在看的这部)
  const { data: seriesItems, error: seriesError } = await db
    .from("media_items")
    .select("id, media_series!inner(name)")
    .eq("media_series.name", seriesName)
    .neq("id", currentId);

  if (seriesError || !seriesItems || seriesItems.length === 0) {
    if (seriesError) console.error(`Failed to fetch related media IDs for series ${seriesName}:`, seriesError);
    return [];
  }

  const relatedIds = seriesItems.map((item) => item.id);

  // 第二步：拿着这些 ID，去 v_all_media 视图中拉取完整的富媒体数据
  const { data, error } = await db
    .from("v_all_media")
    .select("*")
    .in("id", relatedIds)
    .order("sort_date", { ascending: true });

  if (error || !data) {
    console.error(`Failed to fetch related media details for series ${seriesName}:`, error);
    return [];
  }

  return data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item, seriesName));
}

// 从视图中获取前 N 条媒体（按评分降序），用于首页/看板显示
export async function fetchTopMediaServer(
  mediaType: "movie" | "tv_series",
  year?: string | null,
  limit = 10,
): Promise<Media[]> {
  const db = getSupabaseServer();
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
    type, status, genre, region, language, startYear, endYear, q, sort, limit = 30, offset = 0,
  } = opts || {};

  // 1. 初始化缓存变量
  const cacheKey = JSON.stringify({ access: usePublicClient ? "public" : "service", type, status, genre, region, language, startYear, endYear, q, sort, limit, offset });
  const now = Date.now();

  // 2. 内存缓存读取机制
  if (!globalThis._mediaRepoCache) {
    globalThis._mediaRepoCache = new Map();
  }
  const cache = globalThis._mediaRepoCache;
  const cached = cache.get(cacheKey);

  if (cached && now - cached.ts < 30 * 1000) {
    return { rows: cached.data, total: cached.total ?? 0 };
  }

  // 3. 构造查询
  let dataQuery = db.from("v_all_media").select("*");
  let countQuery = db.from("v_all_media").select("id", { count: "exact", head: true });

  if (type) {
    const types = type.split(",");
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
  if (typeof q === "string" && q.trim().length > 0) {
    const queryText = `%${q.trim()}%`;
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

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const results: Media[] = data.map((item: ViewAllMediaRow) => mapViewRowToMedia(item));

  // 4. 写入内存缓存 (保留 30 秒)
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
