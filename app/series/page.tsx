import { supabaseServer } from "@/utils/supabase";
import SeriesCatalog from "./SeriesCatalog" 
// 你的UI组件

// 匹配你的 Schema 类型定义
type DbTvShowItem = {
  id: string;
  title: string;
  cover_url: string;
  release_date: string;
  tv_shows: { seasons_count: number } | { seasons_count: number }[] | null;
  tracking: { status: 'watched' | 'want_to_watch' | 'upcoming'; rating: number } | any;
  media_genres: { genres: { name: string } }[];
};

export default async function SeriesPage() {
  // 1. 获取类型为 'tv_show' 的所有媒体
  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id, title, cover_url, release_date,
      tv_shows ( seasons_count ),
      tracking ( status, rating ),
      media_genres ( genres ( name ) )
    `)
    .eq("type", "tv_show")
    .order("release_date", { ascending: false });

  if (error || !data) {
    console.error("Error fetching tv shows:", error);
    return <div>无法加载剧集数据</div>;
  }

  // 2. 数据转换与格式化
  const allSeries = (data as unknown as DbTvShowItem[]).map((item) => {
    const tracking = Array.isArray(item.tracking) ? item.tracking[0] : item.tracking;
    // 处理 1对1 扩展表可能返回数组或对象的情况
    const tvShowExt = Array.isArray(item.tv_shows) ? item.tv_shows[0] : item.tv_shows;

    return {
      id: item.id,
      title: item.title,
      cover_url: item.cover_url || "",
      date: item.release_date || "",
      rating: tracking?.rating ?? null,
      status: tracking?.status ?? "",
      genres: item.media_genres?.map((g) => g.genres.name) || [],
      seasonsCount: tvShowExt?.seasons_count || 1, // 从专属表提取季数
    };
  });

  // 3. 按照状态进行分类
  const watched = allSeries.filter((s) => s.status === "watched");
  const want = allSeries.filter((s) => s.status === "want_to_watch");
  const upcoming = allSeries.filter((s) => s.status === "upcoming");

  const stats = {
    total: allSeries.length,
    watched: watched.length,
    want: want.length,
    upcoming: upcoming.length,
  };

  // 4. 将分类好的数据传递给之前设计好的 Catalog 组件
  return <SeriesCatalog watched={watched} want={want} upcoming={upcoming} stats={stats} />;
}