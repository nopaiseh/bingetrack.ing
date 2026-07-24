import Link from "next/link";
import ItemCard from "@/components/ItemCard";

// --- 1. 类型定义 ---
interface Movie {
  id: string | number;
  cover_url?: string;
  title: string;
  status?: string;
  date?: string;
  rating?: number | string;
  genres?: string[];
  languages?: string[];
}

interface Stats {
  total: number;
  watched: number;
  want: number;
  upcoming: number;
}

interface MovieCatalogProps {
  watched: Movie[];
  want: Movie[];
  stats?: Stats;
}

// --- 2. 页面主组件 ---
export default function MovieCatalog({ 
  watched, 
  want, 
  stats 
}: MovieCatalogProps) {
  // 安全的数据解构，提供默认值防止 undefined
  const statItems = [
    { label: "电影总数量", value: stats?.total || 0 },
    { label: "已观看电影", value: stats?.watched || 0 },
    { label: "想看的电影", value: stats?.want || 0 },
    { label: "近期将上映", value: stats?.upcoming || 0 },
  ];

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-neutral-200">
      {/* 顶部氛围光渲染，与详情页保持风格统一 */}
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-white/5 to-transparent pointer-events-none -z-10" />

      <div className="container w-full mx-auto px-6 md:px-8 max-w-7xl pt-12 pb-24 relative z-10">

        {/* --- 顶部数据看板区 --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {statItems.map((stat, idx) => (
            <div 
              key={idx} 
              className="group flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
            >
              <h2 className="font-medium uppercase text-neutral-400 text-xs tracking-widest mb-2">
                {stat.label}
              </h2>
              <p className="font-semibold text-3xl tracking-tight text-white group-hover:text-amber-400 transition-colors">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* --- 列表展示区 --- */}
        <div className="space-y-12">
          {/* 这里可以按需传入 href，如果有完整的列表页的话 */}
          <MediaRow title="我看过" items={watched} viewAllLink="/movies/watched" />
          <MediaRow title="我想看" items={want} viewAllLink="/movies/want" />
        </div>
      </div>
    </div>
  );
}

// --- 3. 抽取的可复用 Row 组件 ---
function MediaRow({
  title,
  items,
  viewAllLink
}: {
  title: string;
  items: Movie[];
  viewAllLink?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="relative group">
      {/* 标题栏设计：加入“查看全部” */}
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/5 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white">
          {title}
        </h2>
        {viewAllLink && (
          <Link 
            href={viewAllLink}
            className="text-xs font-medium text-neutral-500 hover:text-white transition-colors uppercase tracking-wider"
          >
            查看全部 &rarr;
          </Link>
        )}
      </div>
      
      {/* 桌面端边缘滚动提示（渐变遮罩） */}
      <div className="absolute right-0 top-[50px] bottom-0 w-24 bg-gradient-to-l from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block" />

      {/* 滑动列表 */}
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-4 px-1 snap-x snap-mandatory scroll-pl-2">
        {/* 修复了 (movie: any) 的类型问题 */}
        {items.map((movie: Movie) => (
          <Link 
            href={`/movie/${movie.id}`} 
            key={movie.id} 
            className="flex-none w-44 cursor-pointer flex flex-col snap-start bg-neutral-900/50 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-white/30 hover:shadow-xl hover:shadow-white/5"
          >
            <ItemCard item={movie} />
          </Link>
        ))}
      </div>
    </div>
  );
}