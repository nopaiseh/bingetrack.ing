import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { SkeletonBlock } from "./LoadingSkeletons";
import MediaRatingBadge from "./MediaRatingBadge";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

/** 为搜索卡片提供高度拟真且美观的加载骨架。 */
export function SearchMediaCardSkeleton() {
  return (
    <div className="search-media-card surface-card flex flex-col overflow-hidden rounded-xl">
      {/* 拟真海报占位，带暗黑景深与极简胶片图标 */}
      <div className="relative flex aspect-2/3 w-full items-center justify-center overflow-hidden bg-white/4">
        <SkeletonBlock className="absolute inset-0 rounded-none bg-transparent" />
        <span className="i-material-symbols-image-outline-rounded inline-block size-8 text-white/15 drop-shadow" aria-hidden="true" />
      </div>

      {/* 文本与标签信息占位，与真实卡片高度及间距完全统一 */}
      <div className="flex flex-col space-y-1.5 px-3 py-2.5">
        <SkeletonBlock className="h-4 w-4/5 rounded-md" />
        <div className="flex items-center justify-between pt-0.5">
          <SkeletonBlock className="h-2.5 w-9 rounded-md" />
          <div className="flex items-center gap-1">
            <span className="i-material-symbols-star-rounded inline-block size-3 text-amber-400/20" aria-hidden="true" />
            <SkeletonBlock className="h-2.5 w-6 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1 overflow-hidden">
          <SkeletonBlock className="h-4 w-11 shrink-0 rounded-md" />
          <SkeletonBlock className="h-4 w-11 shrink-0 rounded-md" />
          <SkeletonBlock className="h-4 w-10 shrink-0 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** 渲染搜索媒体卡片，详情链接携带来源地址以保留返回时的筛选和分页。 */
export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  // 与横向列表保持完全一致的标签规则：优先展示前三个类型并补充语言，总数最多三项。
  const tags = [...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 1)].slice(0, 3);

  return (
    <Link href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`} className="search-media-card surface-card interactive-media-card group flex cursor-pointer flex-col overflow-hidden rounded-xl">
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 20vw, 16vw"
          />
        ) : (
          <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-white/30 drop-shadow-md" aria-hidden="true" />
        )}
        <MediaCardStatusBadge status={item.status} />
      </div>


      <div className="flex flex-col space-y-1.5 px-3 py-2.5">
        <h3 className="font-serif-movie truncate text-sm font-bold text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]" title={item.title}>{item.title}</h3>
        <div className="flex items-center justify-between gap-1.5 min-w-0 text-xs">
          <span className="font-medium text-white/60 whitespace-nowrap shrink-0">
            {item.type === "series"
              ? String(item.release_year || (item.date ? item.date.substring(0, 4) : "未知")).replace(/\s*-\s*/g, "–")
              : item.date ? item.date.substring(0, 4) : "未知"}
          </span>
          <MediaRatingBadge
            rating={item.rating}
            size="sm"
            showTier={item.rating != null}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 w-full overflow-hidden">
          {tags.map(/* 将一个类型或语言标签渲染为统一可截断的紧凑徽标。 */ (tag, index) => (
            <span key={`${tag}-${index}`} title={tag} className="inline-flex items-center shrink truncate rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-md transition-all duration-300 group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-soft)] group-hover:text-white">{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
