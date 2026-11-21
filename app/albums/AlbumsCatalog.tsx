import CatalogEmptyState from "@/components/CatalogEmptyState";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import type { AlbumStats } from "@/lib/functions/media-repo";
import type { MediaCard } from "@/lib/types";

/** 专辑目录：五项统计卡 + 已听／在听／想听横向分区（与电影／电视同构）。 */
export default function AlbumsCatalog({
  watched,
  watching,
  want,
  stats,
}: {
  watched: readonly MediaCard[];
  watching: readonly MediaCard[];
  want: readonly MediaCard[];
  stats: AlbumStats;
}) {
  const watchedItems = [...(watched ?? [])];
  const watchingItems = [...(watching ?? [])];
  const wantItems = [...(want ?? [])];
  const isEmpty = (stats?.total ?? 0) === 0;

  const statItems = [
    { label: "专辑总数量", value: stats.total, href: "/search?type=album" },
    { label: "单曲总数量", value: stats.trackTotal, href: "/search?type=music" },
    { label: "已听的专辑", value: stats.watched, href: "/search?type=album&status=watched" },
    { label: "在听的专辑", value: stats.watching, href: "/search?type=album&status=watching" },
    { label: "想听的专辑", value: stats.want, href: "/search?type=album&status=want_to_watch" },
  ];

  return (
    <div className="relative min-h-[60vh] pt-14 text-fg">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">专辑</h1>
        <CatalogStatGrid items={statItems} />

        {isEmpty ? (
          <CatalogEmptyState message="还没有专辑。" />
        ) : (
          <div className="space-y-12">
            <MediaRow
              title="我已听"
              items={watchedItems}
              eagerCount={2}
              viewAllLink="/search?type=album&status=watched"
              type="album"
              hideStatusBadge
            />
            <MediaRow
              title="我在听"
              items={watchingItems}
              eagerCount={watchedItems.length ? 0 : 2}
              viewAllLink="/search?type=album&status=watching"
              type="album"
              hideStatusBadge
            />
            <MediaRow
              title="我想听"
              items={wantItems}
              eagerCount={watchedItems.length || watchingItems.length ? 0 : 2}
              viewAllLink="/search?type=album&status=want_to_watch"
              type="album"
              hideStatusBadge
            />
          </div>
        )}
      </div>
    </div>
  );
}
