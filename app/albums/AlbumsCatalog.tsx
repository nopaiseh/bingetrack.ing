import AlbumCoverWall from "@/components/AlbumCoverWall";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import type { AlbumStats } from "@/lib/functions/media-repo";
import type { MediaCard } from "@/lib/types";

/** 专辑目录：五项统计卡（方案 C）+ 封面墙。 */
export default function AlbumsCatalog({ albums, stats }: { albums: readonly MediaCard[]; stats: AlbumStats }) {
  const statItems = [
    { label: "专辑总数量", value: stats.total, href: "/search?type=album" },
    { label: "单曲总数量", value: stats.trackTotal, href: "/search?type=music" },
    { label: "已听的专辑", value: stats.watched, href: "/search?type=album&status=watched" },
    { label: "在听的专辑", value: stats.watching, href: "/search?type=album&status=watching" },
    { label: "想听的专辑", value: stats.want, href: "/search?type=album&status=want_to_watch" },
  ];

  return (
    <div className="relative text-fg pt-14">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">专辑</h1>
        <CatalogStatGrid items={statItems} />
        <AlbumCoverWall items={albums} />
      </div>
    </div>
  );
}
