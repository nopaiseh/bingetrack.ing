import CatalogEmptyState from "@/components/CatalogEmptyState";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import type { MediaCard } from "@/lib/types";

export type BookCatalogStats = {
  total: number;
  reading: number;
  read: number;
  want: number;
};

/** 图书目录：统计卡与在读／已读／想读横向分区（与电影／电视同构，无筛选标签）。 */
export default function BooksCatalog({
  reading,
  read,
  want,
  stats,
}: {
  reading: MediaCard[];
  read: MediaCard[];
  want: MediaCard[];
  stats: BookCatalogStats;
}) {
  const readingItems = reading ?? [];
  const readItems = read ?? [];
  const wantItems = want ?? [];
  const isEmpty = (stats?.total ?? 0) === 0;

  const statItems = [
    { label: "图书总数量", value: stats.total || 0, href: "/search?type=book" },
    { label: "读过的书", value: stats.read || 0, href: "/search?type=book&status=watched" },
    { label: "在读的书", value: stats.reading || 0, href: "/search?type=book&status=in_progress" },
    { label: "想读的书", value: stats.want || 0, href: "/search?type=book&status=want_to_watch" },
  ];

  return (
    <div className="relative min-h-[60vh] pt-14 text-fg">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">图书</h1>
        <CatalogStatGrid items={statItems} />

        {isEmpty ? (
          <CatalogEmptyState
            title="还没有图书"
            description="录入作品后，在读、读过与想读会显示在这里。"
            ctaHref="/search?type=book"
            ctaLabel="去搜索"
          />
        ) : (
          <div className="space-y-12">
            <MediaRow
              title="在读"
              items={readingItems}
              eagerCount={2}
              viewAllLink="/search?type=book&status=in_progress"
              type="book"
              hideStatusBadge
            />
            <MediaRow
              title="我已读"
              items={readItems}
              eagerCount={readingItems.length ? 0 : 2}
              viewAllLink="/search?type=book&status=watched"
              type="book"
              hideStatusBadge
            />
            <MediaRow
              title="我想读"
              items={wantItems}
              eagerCount={readingItems.length || readItems.length ? 0 : 2}
              viewAllLink="/search?type=book&status=want_to_watch"
              type="book"
              hideStatusBadge
            />
          </div>
        )}
      </div>
    </div>
  );
}
