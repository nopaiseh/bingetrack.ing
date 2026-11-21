import CatalogEmptyState from "@/components/CatalogEmptyState";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

/** 将电影统计和已看、想看列表渲染为目录页。 */
export default function MoviesCatalog({ watched, want, stats }: MediaCatalogProps) {
  const watchedItems = watched ?? [];
  const wantItems = want ?? [];
  // 以统计总数为准：仅「近期将上映」等计入 total 时，不显示「还没有电影」。
  const isEmpty = (stats?.total ?? 0) === 0;

  const statItems = [
    { label: "电影总数量", value: stats?.total || 0, href: "/search?type=movie" },
    { label: "已看的电影", value: stats?.watched || 0, href: "/search?type=movie&status=watched" },
    { label: "想看的电影", value: stats?.want || 0, href: "/search?type=movie&status=want_to_watch" },
    { label: "近期将上映", value: stats?.upcoming || 0, href: "/search?type=movie&status=upcoming&sort=date_asc" },
  ];

  return (
    <div className="relative min-h-[60vh] pt-14 text-fg">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">电影</h1>
        <CatalogStatGrid items={statItems} />

        {isEmpty ? (
          <CatalogEmptyState
            title="还没有电影"
            description="录入作品后，已看与想看会显示在这里。"
            ctaHref="/search?type=movie"
            ctaLabel="去搜索"
          />
        ) : (
          <div className="space-y-12">
            <MediaRow
              title="我已看"
              items={watchedItems}
              eagerCount={2}
              viewAllLink="/search?type=movie&status=watched"
              type="movies"
              hideStatusBadge
            />
            <MediaRow
              title="我想看"
              items={wantItems}
              eagerCount={watchedItems.length ? 0 : 2}
              viewAllLink="/search?type=movie&status=want_to_watch"
              type="movies"
              hideStatusBadge
            />
          </div>
        )}
      </div>
    </div>
  );
}
