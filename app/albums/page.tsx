import AlbumsCatalog from "./AlbumsCatalog";
import { getCachedAlbumStats } from "@/lib/functions/cached-media";
import { fetchMediaCardsServer, type AlbumStats } from "@/lib/functions/media-repo";
import { handlePageDataError } from "@/lib/functions/page-data";
import type { MediaCard } from "@/lib/types";
import { buildPageSocialMetadata } from "@/lib/seo/page";

export const metadata = {
  ...buildPageSocialMetadata("专辑", "浏览已听、在听与想听的专辑记录。", "/albums"),
  alternates: { canonical: "/albums" },
};

// 专辑目录无数据缓存标签，只靠管理端 revalidatePath("/albums") 按需刷新。
export const revalidate = false;

const EMPTY_STATS: AlbumStats = {
  total: 0,
  watched: 0,
  watching: 0,
  want: 0,
  trackTotal: 0,
};

/** 并行读取专辑统计与已听／在听／想听卡片；构建期失败时降级为空目录。 */
export default async function AlbumsPage() {
  let watched: MediaCard[] = [];
  let watching: MediaCard[] = [];
  let want: MediaCard[] = [];
  let stats: AlbumStats = EMPTY_STATS;

  try {
    const [fetchedStats, watchedCards, watchingCards, wantCards] = await Promise.all([
      getCachedAlbumStats(),
      fetchMediaCardsServer({ type: "album", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "album", status: "watching", limit: 10, offset: 0, sort: "date_desc" }),
      fetchMediaCardsServer({ type: "album", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
    ]);
    stats = fetchedStats;
    watched = watchedCards;
    watching = watchingCards;
    want = wantCards;
  } catch (error) {
    handlePageDataError("albums page", error);
  }

  return <AlbumsCatalog watched={watched} watching={watching} want={want} stats={stats} />;
}
