import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { SkeletonBlock } from "./LoadingSkeletons";

/** 为搜索卡片提供与海报和文本布局对应的加载占位。 */
export function SearchMediaCardSkeleton() {
  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-xl">
      <SkeletonBlock className="aspect-2/3 w-full rounded-none" />
      <div className="flex flex-col space-y-3 px-3 py-2.5">
        <SkeletonBlock className="h-4 w-3/4" />
        <div className="mt-1 flex items-center justify-between">
          <SkeletonBlock className="h-3 w-8" />
          <SkeletonBlock className="h-3 w-10" />
        </div>
        <div className="mt-1 flex gap-1.5">
          <SkeletonBlock className="h-4 w-10" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

/** 渲染搜索媒体卡片，详情链接携带来源地址以保留返回时的筛选和分页。 */
export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  return (
    <Link href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`} className="surface-card interactive-media-card group flex cursor-pointer flex-col overflow-hidden rounded-xl">
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 20vw, 16vw"
          />
        ) : (
          <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-white/30 drop-shadow-md" aria-hidden="true" />
        )}
      </div>


      <div className="flex flex-col space-y-1.5 px-3 py-2.5">
        <h3 className="truncate text-sm font-bold text-white transition-colors duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-red-400 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)]" title={item.title}>{item.title}</h3>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-white/60">{item.date ? item.date.substring(0, 4) : "未知"}</span>
          <span className="flex items-center gap-1 font-bold text-white drop-shadow-sm">
            {item.rating ? <><span className="i-material-symbols-star-rounded inline-block size-3 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]" aria-hidden="true" />{Number(item.rating).toFixed(1)}</> : <span className="text-white/50">未评分</span>}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 2)].map(/* 将最多三个类型和两个语言标签渲染为卡片徽标。 */ (tag, index) => (
            <span key={`${tag}-${index}`} className="surface-muted inline-flex items-center rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-md transition-all duration-300 group-hover:border-red-400/30 group-hover:bg-red-500/15 group-hover:text-red-400 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
