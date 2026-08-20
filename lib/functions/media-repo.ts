import { getSupabaseServer } from "@/utils/supabase";
import { MediaType } from "@/lib/functions/media-mapper";
import { Media } from "@/lib/types/Media";

/*
  媒体仓库（server-side helpers）

  说明：
  - 把常用的 v_all_media 查询封装到统一的函数中，页面调用这些函数无需关心视图字段细节。
  - 所有导出的函数均为服务端使用（使用 getSupabaseServer），若需要浏览器端查询，请使用 utils/supabase-client 中的客户端 API。
*/

// 获取单条媒体详情（优先使用已存在的 getMedia 逻辑，作为向后兼容的包装）
export async function getMediaById(id: string, type: string): Promise<Media | null> {
  const db = getSupabaseServer();
  
  // 1. 从视图中直接拉取所有扁平化、计算好的数据
  const { data: viewData, error: viewError } = await db
    .from('v_all_media')
    .select('*')
    .eq('id', id)
    .single();

  if (viewError || !viewData) {
    console.error(`Failed to fetch media details for id ${id}:`, viewError);
    return null;
  }

  // 2. 因为视图里没有 series 字段，我们查一下原表补齐系列名称
  const { data: seriesData } = await db
    .from('media_items')
    .select('media_series(name)')
    .eq('id', id)
    .single();

  const seriesObj = Array.isArray(seriesData?.media_series) 
    ? seriesData?.media_series[0] 
    : seriesData?.media_series;

  // 3. 直接赋值，再也不用做复杂的 map 和 sort 了
  return {
    id: String(viewData.id),
    title: viewData.title || "",
    date: viewData.sort_date || "",
    release_year: viewData.release_year || "",
    runtime: viewData.runtime || null,
    rating: viewData.rating || null,
    genres: viewData.genres || [],
    languages: viewData.languages || [],
    regions: viewData.regions || [],
    status: viewData.status || undefined,
    summary: viewData.summary || "",
    cover_url: viewData.cover_url || "",
    casts: viewData.casts || [],
    directors: viewData.directors || [],
    type: viewData.type === 'movie' ? 'movies' : 'series',
    series: seriesObj?.name || null,
  };
}

// 2. 获取同系列相关作品
export async function getRelatedBySeries(seriesName: string, currentId: string, mode: string): Promise<Media[]> {
  const db = getSupabaseServer();
  
  // 第一步：从基础表中查询出属于该系列的所有作品的 ID (排除当前正在看的这部)
  const { data: seriesItems, error: seriesError } = await db
    .from('media_items')
    .select('id, media_series!inner(name)')
    .eq('media_series.name', seriesName)
    .neq('id', currentId);

  if (seriesError || !seriesItems || seriesItems.length === 0) {
    if (seriesError) console.error(`Failed to fetch related media IDs for series ${seriesName}:`, seriesError);
    return [];
  }

  // 提取出所有相关的 ID
  const relatedIds = seriesItems.map(item => item.id);

  // 第二步：拿着这些 ID，去 v_all_media 视图中拉取完整的富媒体数据 (包含 genres, languages, rating 等)
  const { data, error } = await db
    .from('v_all_media')
    .select('*')
    .in('id', relatedIds)
    .order('sort_date', { ascending: true }); // 按时间顺序排列

  if (error || !data) {
    console.error(`Failed to fetch related media details for series ${seriesName}:`, error);
    return [];
  }

  // 映射数据返回
  return data.map((viewData: any) => ({
    id: String(viewData.id),
    title: viewData.title || "",
    date: viewData.sort_date || "",
    release_year: viewData.release_year || "",
    runtime: viewData.runtime || null,
    rating: viewData.rating || null,
    genres: viewData.genres || [],
    languages: viewData.languages || [],
    regions: viewData.regions || [],
    status: viewData.status || undefined,
    summary: viewData.summary || "",
    cover_url: viewData.cover_url || "",
    casts: viewData.casts || [],
    directors: viewData.directors || [],
    type: viewData.type === 'movie' ? 'movies' : 'series',
    series: seriesName, // 我们已经知道它属于这个系列，直接填入即可
  }));
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

  const { data, error } = await query;
  if (error || !data) return [];

  // 使用扁平化映射适应新视图
  return data.map((item: any) => ({
    id: String(item.id),
    title: item.title || "",
    date: item.sort_date || "",
    release_year: item.release_year || "",
    runtime: item.runtime || null,
    rating: item.rating || null,
    genres: item.genres || [],
    languages: item.languages || [],
    regions: item.regions || [],
    status: item.status || undefined,
    summary: item.summary || "",
    cover_url: item.cover_url || "",
    casts: item.casts || [],
    directors: item.directors || [],
    type: item.type === "movie" ? "movies" : "series",
  }));
}

// 修复函数签名，使其能接收包含所有过滤条件的对象
export async function searchMediaServer(opts: any = {}): Promise<{ rows: Media[]; total: number }> {
  return fetchMediaListServer(opts);
}

// 支持过滤、分页和排序的通用查询
// 支持过滤、分页和排序的通用查询
export async function fetchMediaListServer(opts: {
  type?: "movie" | "tv_series" | string;
  genre?: string | null;
  region?: string | null;
  language?: string | null;
  startYear?: string | null; 
  endYear?: string | null;   
  status?: string | null;
  q?: string | null;
  sort?: string | null; 
  limit?: number;
  offset?: number;
}): Promise<{ rows: Media[]; total: number }> {
  const db = getSupabaseServer();
  const {
    type, genre, region, language, startYear, endYear, status, q, sort, limit = 50, offset = 0,
  } = opts || {};

  // 1. 初始化缓存变量
  const cacheKey = JSON.stringify({ type, genre, region, language, startYear, endYear, status, q, sort, limit, offset });
  const now = Date.now();

  // 2. 内存缓存读取机制
  if (!(global as any)._mediaRepoCache) (global as any)._mediaRepoCache = new Map();
  const cache: Map<string, { ts: number; data: Media[]; total?: number }> = (global as any)._mediaRepoCache;
  const cached = cache.get(cacheKey);
  
  if (cached && now - cached.ts < 30 * 1000) {
    return { rows: cached.data, total: cached.total ?? 0 };
  }

  // 3. 构造查询
  let dataQuery = db.from("v_all_media").select("*");
  let countQuery = db.from("v_all_media").select("id", { count: "exact", head: true });

  const applyFilters = (qBuilder: any) => {
    let queryObj = qBuilder;
    
    if (type) queryObj = queryObj.eq("type", type);
    
    if (status) {
      if (status === 'untracked') queryObj = queryObj.is("status", null);
      else queryObj = queryObj.eq("status", status);
    }

    // 将逗号分隔的字符串还原为数组，Supabase 的 .contains 原生支持数组匹配多项
    if (genre) queryObj = queryObj.contains("genres", genre.split(","));
    if (region) queryObj = queryObj.contains("regions", region.split(","));
    if (language) queryObj = queryObj.contains("languages", language.split(","));

    // 灵活应用年份区间过滤
    if (startYear) queryObj = queryObj.gte("sort_date", `${startYear}-01-01`);
    if (endYear) queryObj = queryObj.lte("sort_date", `${endYear}-12-31`);

    if (typeof q === "string" && q.trim().length > 0) {
      const value = q.trim();
      queryObj = queryObj.ilike("title", `%${value}%`);
    }

    if (qBuilder === dataQuery) {
      if (sort) {
        const [field, order] = sort.split("_");
        const ascending = order === "asc";
        // 如果排序字段是日期
        if (field === "date") {
          queryObj = queryObj.order("sort_date", { ascending });
        } 
        // 如果排序字段是评分
        else if (field === "rating") {
          queryObj = queryObj.order("rating", { ascending });
        }
      } else {
        // 默认按日期降序
        queryObj = queryObj.order("sort_date", { ascending: false, nullsFirst: false });
      }
    }

    return queryObj;
  };

  dataQuery = applyFilters(dataQuery);
  countQuery = applyFilters(countQuery);
  dataQuery = dataQuery.range(offset, Math.max(0, offset + limit - 1));

  const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);
  
  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  // 使用扁平化映射
  const results: Media[] = data.map((item: any) => ({
    id: String(item.id),
    title: item.title || "",
    date: item.sort_date || "",
    release_year: item.release_year || "",
    runtime: item.runtime || null,
    rating: item.rating || null,
    genres: item.genres || [],
    languages: item.languages || [],
    regions: item.regions || [],
    status: item.status || undefined,
    summary: item.summary || "",
    cover_url: item.cover_url || "",
    casts: item.casts || [],
    directors: item.directors || [],
    type: item.type === "movie" ? "movies" : "series",
  }));
  
  // 4. 写入内存缓存 (保留 30 秒)
  cache.set(cacheKey, { ts: now, data: results, total });

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