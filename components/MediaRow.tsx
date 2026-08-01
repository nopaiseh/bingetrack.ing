import Link from "next/link";
import { Media } from "@/lib/types/Media";

function ItemCard({ item }: { item: Media }) {
  return (
    <>
      <div className="h-68 w-full bg-neutral-900 relative flex items-center justify-center">
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
        )}
      </div>
      <div className="flex flex-col space-y-1 grow px-2 py-2">
        {/* 标题 */}
        <h3 className="text-sm font-semibold text-white truncate" title={item.title}>
          {item.title}
        </h3>

        {/* 上映日期和评分 */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-neutral-400">{item.date}</span>
          <span className="text-neutral-300 font-semibold flex items-center gap-1">
            {item.rating ? (
              <>
                <i className="fas fa-star text-yellow-500 text-[10px]"></i>
                {Number(item.rating).toFixed(1)}
              </>
            ) : (
              <span className="text-neutral-400">未评分</span>
            )}
          </span>
        </div>
        
        {/* 标签区域 */}
        <div className="flex flex-wrap gap-1">
          {(item.genres ?? []).map((g: string, i: number) => (
            <span key={`g-${i}`} className="inline-flex items-center px-1 py-1 rounded-md bg-white/3 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-sm">
              {g}
            </span>
          ))}
          {(item.languages ?? []).map((l: string, i: number) => (
            <span key={`l-${i}`} className="inline-flex items-center px-1 py-1 rounded-md bg-white/3 border border-white/10 text-neutral-300 text-xs font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-sm">
              {l}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export default function MediaRow({
  title,
  items,
  viewAllLink,
  type
}: {
  title: string;
  items: Media[];
  viewAllLink?: string;
  type: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="relative group">
      {/* 标题和查看全部链接 */}
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/5 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white">
          {title}
        </h2>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-xs font-medium text-neutral-500 hover:text-white transition-colors uppercase tracking-wider">
            查看全部 &rarr;
          </Link>
        )}
      </div>
      
      {/* 滑动列表 */}
      <div className="flex space-x-4 overflow-x-auto no-scrollbar py-4 px-1 snap-x snap-mandatory scroll-pl-2">
        {items.map((media: Media) => (
          <Link href={`/${type}/${media.id}`} key={media.id} className="flex-none w-44 cursor-pointer flex flex-col snap-start bg-neutral-900/50 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-white/30 hover:shadow-xl hover:shadow-white/5">
            <ItemCard item={media} />
          </Link>
        ))}
      </div>
    </div>
  );
}