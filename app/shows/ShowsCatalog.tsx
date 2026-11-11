import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

/** 将电视节目统计及已看、在看、想看列表渲染为目录页。 */
export default function ShowsCatalog({
  watched,
  watching,
  want,
  stats,
}: MediaCatalogProps) {
  const statItems = [
    { label: "电视节目总数量", value: stats?.total || 0, href: "/search?type=tv_show" },
    { label: "已看的电视节目", value: stats?.watched || 0, href: "/search?type=tv_show&status=watched" },
    { label: "在看的电视节目", value: stats?.watching || 0, href: "/search?type=tv_show&status=watching" },
    { label: "想看的电视节目", value: stats?.want || 0, href: "/search?type=tv_show&status=want_to_watch" },
    { label: "近期将播出", value: stats?.upcoming || 0, href: "/search?type=tv_show&status=upcoming&sort=date_asc" },
  ];

  return (
    <div className="relative text-fg pt-14 min-h-[60vh]">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">

        
        <CatalogStatGrid items={statItems} />

        
        <div className="space-y-12">
          <MediaRow title="我已看" items={watched ?? []} eagerCount={2} viewAllLink="/search?type=tv_show&status=watched" type="shows" hideStatusBadge />
          <MediaRow title="我在看" items={watching ?? []} eagerCount={watched?.length ? 0 : 2} viewAllLink="/search?type=tv_show&status=watching" type="shows" hideStatusBadge />
          <MediaRow title="我想看" items={want ?? []} eagerCount={watched?.length || watching?.length ? 0 : 2} viewAllLink="/search?type=tv_show&status=want_to_watch" type="shows" hideStatusBadge />
        </div>
      </div>
    </div>      
  );
}
