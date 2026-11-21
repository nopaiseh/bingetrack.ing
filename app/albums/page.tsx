import AlbumsCatalog from "./AlbumsCatalog";
import { getCachedAlbumStats } from "@/lib/functions/cached-media";
import { fetchMediaCardsServer, type AlbumStats } from "@/lib/functions/media-repo";
import { handlePageDataError } from "@/lib/functions/page-data";
import type { MediaCard } from "@/lib/types";
import { buildPageSocialMetadata } from "@/lib/seo/page";

export const metadata = {
  ...buildPageSocialMetadata("专辑", "浏览已听、想听与收藏的专辑封面墙。", "/albums"),
  alternates: { canonical: "/albums" },
};

// 专辑目录无数据缓存标签，只靠管理端 revalidatePath("/albums") 按需刷新。
export const revalidate = false;

const ALBUM_WALL_LIMIT = 240;

const EMPTY_STATS: AlbumStats = {
  total: 0,
  watched: 0,
  watching: 0,
  want: 0,
  trackTotal: 0,
};

/** 读取专辑统计与封面墙卡片；构建期失败降级为空墙与零统计。 */
export default async function AlbumsPage() {
  let albums: MediaCard[] = [];
  let stats: AlbumStats = EMPTY_STATS;

  try {
    const [fetchedAlbums, fetchedStats] = await Promise.all([
      fetchMediaCardsServer({
        type: "album",
        limit: ALBUM_WALL_LIMIT,
        offset: 0,
        sort: "date_desc",
      }),
      getCachedAlbumStats(),
    ]);
    albums = fetchedAlbums;
    stats = fetchedStats;
  } catch (error) {
    handlePageDataError("albums page", error);
  }

  return <AlbumsCatalog albums={albums} stats={stats} />;
}
