import { getSupabaseServer } from "@/utils/supabase";
import { mapSupabaseToMedia, MediaType, SupabaseMediaItem } from "@/lib/functions/media-mapper";
import { Media } from "@/lib/types/Media";
import { getMedia as getMediaLegacy } from "@/lib/functions/getMedia";
import { getMediaList as getMediaListLegacy } from "@/lib/functions/getMediaList";

/*
  媒体仓库（server-side helpers）

  说明：
  - 把常用的 v_all_media 查询封装到统一的函数中，页面调用这些函数无需关心视图字段细节。
  - 所有导出的函数均为服务端使用（使用 getSupabaseServer），若需要浏览器端查询，请使用 utils/supabase-client 中的客户端 API。
*/

// 获取单条媒体详情（优先使用已存在的 getMedia 逻辑，作为向后兼容的包装）
export async function getMediaById(id: string, type: MediaType): Promise<Media | null> {
  // 直接复用已有实现，未来可在此处扩展缓存/权限逻辑
  return getMediaLegacy(id, type);
}

// 获取同系列的其他媒体（封装现有实现）
export async function getRelatedBySeries(seriesName: string, currentId: string, mode: "movies" | "series") {
  return getMediaListLegacy({ seriesName, currentId, mode });
}

// 从视图中获取前 N 条媒体（按评分降序），用于首页/看板显示
export async function fetchTopMediaServer(mediaType: "movie" | "tv_series", year?: string | null, limit = 10): Promise<Media[]> {
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

  const { data, error } = (await query) as { data: SupabaseMediaItem[] | null; error: unknown };
  if (error || !data) return [];

  const mediaKind: MediaType = mediaType === "movie" ? "movies" : "series";
  return data.map((item) => mapSupabaseToMedia(item, mediaKind));
}

// 简单的全文 / 列表搜索（按日期降序）——返回标准前端 Media 列表
export async function searchMediaServer(queryText?: string, limit = 100, offset = 0): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaListServer({ q: queryText, limit, offset });
}

// 支持过滤、分页和排序的通用查询
export async function fetchMediaListServer(opts: {
  type?: "movie" | "tv_series" | string;
  genre?: string | null;
  region?: string | null;
  language?: string | null;
  year?: string | null;
  q?: string | null;
  sort?: string | null; // e.g. 'date_desc', 'rating_desc'
  limit?: number;
  offset?: number;
}): Promise<{ rows: Media[]; total: number }> {
  const db = getSupabaseServer();
  const {
    type,
    genre,
    region,
    language,
    year,
    q,
    sort,
    limit = 50,
    offset = 0,
  } = opts || {};

  // 缓存 key
  const cacheKey = JSON.stringify({ type, genre, region, language, year, q, sort, limit, offset });
  const now = Date.now();

  // 可选 Redis 支持：优先使用 Redis（通过 REDIS_URL），否则回退到内存 Map
  let redisClient: any = null;
  if (process.env.REDIS_URL) {
    try {
      // 延迟加载 ioredis，以避免在不需要时增加依赖开销
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IORedis = require("ioredis");
      if (!(global as any)._mediaRepoRedis) {
        (global as any)._mediaRepoRedis = new IORedis(process.env.REDIS_URL);
      }
      redisClient = (global as any)._mediaRepoRedis;
    } catch (e) {
      // 无法加载 redis 客户端时回退到内存缓存
      redisClient = null;
    }
  }

  // 检查缓存
  if (redisClient) {
    try {
      const cachedStr = await redisClient.get(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && parsed.ts && now - parsed.ts < 30 * 1000) {
          return { rows: parsed.data as Media[], total: parsed.total ?? 0 };
        }
      }
    } catch (e) {
      // 读取缓存失败则继续正常查询
    }
  } else {
    if (!(global as any)._mediaRepoCache) (global as any)._mediaRepoCache = new Map();
    const cache: Map<string, { ts: number; data: Media[]; total?: number }> = (global as any)._mediaRepoCache;
    const cached = cache.get(cacheKey);
    if (cached && now - cached.ts < 30 * 1000) {
      return { rows: cached.data, total: cached.total ?? 0 };
    }
  }

  // 构造数据查询（带分页）和计数查询（不带分页）
  // 数据查询
  let dataQuery = db.from("v_all_media").select("*");
  // 计数查询
  let countQuery = db.from("v_all_media").select("id", { count: "exact", head: true });

  const applyFilters = (qBuilder: any) => {
    let q = qBuilder;
    if (type) q = q.eq("type", type);
    if (genre) q = q.contains("genres", [genre]);
    if (region) q = q.contains("regions", [region]);
    if (language) q = q.contains("languages", [language]);

    if (year) {
      q = q.gte("sort_date", `${year}-01-01`).lte("sort_date", `${year}-12-31`);
    }

    if (q && typeof q === "object" && typeof opts.q === "string" && opts.q.trim().length > 0) {
      const value = (opts.q || "").trim();
      q = q.ilike("title", `%${value}%`).or(`summary.ilike.%${value}%`);
    }

    // sort handling for dataQuery only
    if (qBuilder === dataQuery) {
      if (sort) {
        const [field, order] = sort.split("_");
        const ascending = order === "asc";
        if (field === "date") {
          q = q.order("sort_date", { ascending });
        } else if (field === "rating") {
          q = q.order("rating", { ascending });
        }
      } else {
        q = q.order("sort_date", { ascending: false, nullsFirst: false });
      }
    }

    return q;
  };

  dataQuery = applyFilters(dataQuery);
  countQuery = applyFilters(countQuery);

  dataQuery = dataQuery.range(offset, Math.max(0, offset + limit - 1));

  const responses = (await Promise.all([dataQuery, countQuery])) as any[];
  const dataRes = responses[0] as { data: SupabaseMediaItem[] | null; error: unknown };
  const countRes = responses[1] as { data: null; count: number | null; error: unknown };

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const results = data.map((item) => {
    const kind: MediaType = item.type === "movie" ? "movies" : "series";
    return mapSupabaseToMedia(item, kind);
  });

  // 写入缓存
  if (redisClient) {
    try {
      await redisClient.set(cacheKey, JSON.stringify({ ts: now, data: results, total }), "EX", 30);
    } catch (e) {
      // 忽略缓存写入错误
    }
  } else {
    const cache: Map<string, { ts: number; data: Media[]; total?: number }> = (global as any)._mediaRepoCache;
    cache.set(cacheKey, { ts: now, data: results, total });
  }

  return { rows: results, total };
}

// 统计信息查询（例如 Movies 页面需要的 total/watched/want/upcoming）
export async function fetchStatsServer(mediaType: "movie" | "tv_series") {
  const db = getSupabaseServer();
  const today = new Date().toISOString().split("T")[0];

  const totalRes = await db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType);
  const watchedRes = await db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).eq("status", "watched");
  const wantRes = await db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).eq("status", "want_to_watch");
  const upcomingRes = await db.from("v_all_media").select("id", { count: "exact", head: true }).eq("type", mediaType).gte("sort_date", today);

  return {
    total: totalRes.count ?? 0,
    watched: watchedRes.count ?? 0,
    want: wantRes.count ?? 0,
    upcoming: upcomingRes.count ?? 0,
  };
}
