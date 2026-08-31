import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/types";

export default function SeriesCatalog({
  watched,
  watching,
  want,
  stats,
}: MediaCatalogProps) {
  const statItems = [
    { label: "影剧总数量", value: stats?.total || 0 },
    { label: "已看的影剧", value: stats?.watched || 0 },
    { label: "想看的影剧", value: stats?.want || 0 },
    { label: "近期将播出", value: stats?.upcoming || 0 },
  ];

  return (
    <div className="relative text-neutral-200 pt-14">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8">

        
        <div className="mb-10 grid grid-cols-2 gap-4 md:mb-12 lg:mb-16 lg:grid-cols-4">
          {statItems.map((stat, idx) => (
            <div key={idx} className="glass-card group flex flex-col rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 sm:p-5 lg:p-6">
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
          <MediaRow title="我已看" items={watched ?? []} viewAllLink="/search?type=电视剧&status=已看" type="series" />
          <MediaRow title="我在看" items={watching ?? []} viewAllLink="/search?type=电视剧&status=在看" type="series" />
          <MediaRow title="我想看" items={want ?? []} viewAllLink="/search?type=电视剧&status=想看" type="series" />
        </div>
      </div>
    </div>      
  );
}
