import MediaRow from "@/components/MediaRow";
import { MediaCatalogProps } from "@/lib/interfaces/MediaCatalogProps";

export default function SeriesCatalog({
  watched,
  watching,
  want,
  stats,
}: MediaCatalogProps) {
  const statItems = [
    { label: "影剧总数量", value: stats?.totalSeries || 0 },
    { label: "剧季总数量", value: stats?.totalSeasons || 0 },
    { label: "剧集总数量", value: stats?.totalEpisodes || 0 },
    { label: "近期将播出", value: stats?.totalUpcomingEpisodes || 0 },
  ];

  return (
    <div className="relative bg-[#0a0a0a] text-neutral-200 pt-14">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-linear-to-b from-white/5 to-transparent pointer-events-none -z-10" />
      <div className="container w-full mx-auto px-6 md:px-8 max-w-7xl pt-12 pb-12 relative z-10">

        {/* 统计数据展示区 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {statItems.map((stat, idx) => (
            <div key={idx} className="group flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1">
              <h2 className="font-medium uppercase text-neutral-400 text-xs tracking-widest mb-2">
                {stat.label}
              </h2>
              <p className="font-mono text-3xl tracking-tight text-white group-hover:text-red-400 transition-colors">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* 电视剧列表展示区 */}
        <div className="space-y-12">
          <MediaRow title="我看过" items={watched ?? []} viewAllLink="/series/watched" type="series" />
          <MediaRow title="正在看" items={watching ?? []} viewAllLink="/series/watching" type="series" />
          <MediaRow title="我想看" items={want ?? []} viewAllLink="/series/wantToWatch" type="series" />
        </div>
      </div>
    </div>      
  );
}