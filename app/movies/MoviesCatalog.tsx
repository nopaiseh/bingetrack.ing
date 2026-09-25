import Link from "next/link";
import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

/** 将电影统计和已看、想看列表渲染为目录页。 */
export default function MoviesCatalog({
  watched,
  want,
  stats,
}: MediaCatalogProps) {
  const statItems = [
    { label: "电影总数量", value: stats?.total || 0, href: "/search?type=movie" },
    { label: "已看的电影", value: stats?.watched || 0, href: "/search?type=movie&status=watched" },
    { label: "想看的电影", value: stats?.want || 0, href: "/search?type=movie&status=want_to_watch" },
    { label: "近期将上映", value: stats?.upcoming || 0, href: "/search?type=movie&sort=date_desc" },
  ];

  return (
    <div className="relative text-white/90 pt-14">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">

        
        <div className="mb-8 grid grid-cols-2 gap-3.5 sm:gap-4 md:mb-10 lg:grid-cols-4">
          {statItems.map(/* 将一项电影统计渲染为可点击跳转的卡片。 */ (stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="surface-card interactive-card group flex flex-col justify-between rounded-xl p-3.5 sm:p-4.5 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="font-medium uppercase text-white/70 text-xs tracking-widest group-hover:text-white/90 transition-colors">
                  {stat.label}
                </h2>
                <span className="i-material-symbols-arrow-outward-rounded size-3.5 text-white/40 transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </div>
              <p className="font-mono text-2xl sm:text-3xl tracking-tight text-white group-hover:text-[var(--accent-hover)] transition-colors">
                {stat.value}
              </p>
            </Link>
          ))}
        </div>

        
        <div className="space-y-12">
          <MediaRow title="我已看" items={watched ?? []} eagerCount={2} viewAllLink="/search?type=movie&status=watched" type="movies" hideStatusBadge />
          <MediaRow title="我想看" items={want ?? []} eagerCount={watched?.length ? 0 : 2} viewAllLink="/search?type=movie&status=want_to_watch" type="movies" hideStatusBadge />
        </div>
      </div>
    </div>
  );
}
