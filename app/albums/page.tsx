import AlbumCoverWall from "@/components/AlbumCoverWall";
import { fetchMediaCardsServer } from "@/lib/functions/media-repo";
import { handlePageDataError } from "@/lib/functions/page-data";
import type { MediaCard } from "@/lib/types";
import { buildPageSocialMetadata } from "@/lib/seo/page";

export const metadata = {
  ...buildPageSocialMetadata("专辑", "浏览已听、想听与收藏的专辑封面墙。", "/albums"),
  alternates: { canonical: "/albums" },
};

// 专辑目录按 24 小时长缓存，数据变更由管理端即时按需刷新。
export const revalidate = 86400;

const ALBUM_WALL_LIMIT = 240;

/** 读取专辑卡片并渲染紧凑封面墙；构建期失败降级为空墙。 */
export default async function AlbumsPage() {
  let albums: MediaCard[] = [];

  try {
    albums = await fetchMediaCardsServer({
      type: "album",
      limit: ALBUM_WALL_LIMIT,
      offset: 0,
      sort: "date_desc",
    });
  } catch (error) {
    handlePageDataError("albums page", error);
  }

  return (
    <div className="relative text-fg pt-14">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">专辑</h1>
        <AlbumCoverWall items={albums} />
      </div>
    </div>
  );
}
