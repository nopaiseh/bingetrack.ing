import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

export default function MoviesCatalog({
  watched,
  want,
  stats,
}: MediaCatalogProps) {
  const statItems = [
    { label: "电影总数量", value: stats?.total || 0 },
    { label: "已看的电影", value: stats?.watched || 0 },
    { label: "想看的电影", value: stats?.want || 0 },
    { label: "近期将上映", value: stats?.upcoming || 0 },
  ];

  return (
    <div className="relative text-neutral-200 pt-14">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">

        
        <div className="mb-10 grid grid-cols-2 gap-4 md:mb-12 lg:mb-16 lg:grid-cols-4">
          {statItems.map((stat, idx) => (
            <div key={idx} className="surface-card interactive-card group flex flex-col rounded-2xl p-4 sm:p-5 lg:p-6">
              <h2 className="font-medium uppercase text-neutral-400 text-xs tracking-widest mb-2">
                {stat.label}
              </h2>
              <p className="font-mono text-3xl tracking-tight text-white group-hover:text-red-400 transition-colors">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        
        <div className="space-y-12">
          <MediaRow title="我已看" items={watched ?? []} viewAllLink="/search?type=电影&status=已看" type="movies" />
          <MediaRow title="我想看" items={want ?? []} viewAllLink="/search?type=电影&status=想看" type="movies" />
        </div>
      </div>
    </div>
  );
}
