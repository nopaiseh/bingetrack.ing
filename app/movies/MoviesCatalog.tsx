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
    { label: "电影总数量", value: stats?.total || 0, href: "/search?type=电影" },
    { label: "已看的电影", value: stats?.watched || 0, href: "/search?type=电影&status=已看" },
    { label: "想看的电影", value: stats?.want || 0, href: "/search?type=电影&status=想看" },
    { label: "近期将上映", value: stats?.upcoming || 0, href: "/search?type=电影&sort=date_desc" },
  ];

  return (
    <div className="relative text-white/90 pt-14">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">

        
        <div className="mb-10 grid grid-cols-2 gap-4 md:mb-12 lg:mb-16 lg:grid-cols-4">
          {statItems.map(/* 将一项电影统计渲染为可点击跳转的卡片。 */ (stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium uppercase text-white/50 text-xs tracking-widest group-hover:text-white/70 transition-colors">
                  {stat.label}
                </h2>
                <span className="i-material-symbols-arrow-outward-rounded size-3.5 text-white/30 transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </div>
              <p className="font-mono text-3xl tracking-tight text-white group-hover:text-[var(--accent-hover)] transition-colors">
                {stat.value}
              </p>
            </Link>
          ))}
        </div>

        
        <div className="space-y-12">
          <MediaRow title="我已看" items={watched ?? []} eagerCount={2} viewAllLink="/search?type=电影&status=已看" type="movies" />
          <MediaRow title="我想看" items={want ?? []} eagerCount={watched?.length ? 0 : 2} viewAllLink="/search?type=电影&status=想看" type="movies" />
        </div>
      </div>
    </div>
  );
}
