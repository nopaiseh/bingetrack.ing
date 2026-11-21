import CatalogEmptyState from "@/components/CatalogEmptyState";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

/** 将电视节目统计及已看、在看、想看列表渲染为目录页。 */
export default function ShowsCatalog({ watched, watching, want, stats }: MediaCatalogProps) {
  const watchedItems = watched ?? [];
  const watchingItems = watching ?? [];
  const wantItems = want ?? [];
  const isEmpty = watchedItems.length === 0 && watchingItems.length === 0 && wantItems.length === 0;

  const statItems = [
    { label: "电视节目总数量", value: stats?.total || 0, href: "/search?type=tv_show" },
    { label: "已看的电视节目", value: stats?.watched || 0, href: "/search?type=tv_show&status=watched" },
    { label: "在看的电视节目", value: stats?.watching || 0, href: "/search?type=tv_show&status=watching" },
    { label: "想看的电视节目", value: stats?.want || 0, href: "/search?type=tv_show&status=want_to_watch" },
    { label: "近期将播出", value: stats?.upcoming || 0, href: "/search?type=tv_show&status=upcoming&sort=date_asc" },
  ];

  return (
    <div className="relative min-h-[60vh] pt-14 text-fg">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">电视节目</h1>
        <CatalogStatGrid items={statItems} />

        {isEmpty ? (
          <CatalogEmptyState
            title="还没有电视节目"
            description="录入剧集后，已看、在看与想看会显示在这里。"
            ctaHref="/search?type=tv_show"
            ctaLabel="去搜索 →"
          />
        ) : (
          <div className="space-y-12">
            <MediaRow
              title="我已看"
              items={watchedItems}
              eagerCount={2}
              viewAllLink="/search?type=tv_show&status=watched"
              type="shows"
              hideStatusBadge
            />
            <MediaRow
              title="我在看"
              items={watchingItems}
              eagerCount={watchedItems.length ? 0 : 2}
              viewAllLink="/search?type=tv_show&status=watching"
              type="shows"
              hideStatusBadge
            />
            <MediaRow
              title="我想看"
              items={wantItems}
              eagerCount={watchedItems.length || watchingItems.length ? 0 : 2}
              viewAllLink="/search?type=tv_show&status=want_to_watch"
              type="shows"
              hideStatusBadge
            />
          </div>
        )}
      </div>
    </div>
  );
}
