import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { SkeletonBlock } from "./LoadingSkeletons";
import MediaCardBody from "./MediaCardBody";
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

      {/* 文本与标签信息占位，与两行标题的真实卡片高度对齐 */}
      <div className="flex flex-col space-y-1.5 px-3 py-2.5">
        <div className="min-h-10 space-y-1.5">
          <SkeletonBlock className="h-4 w-4/5 rounded-md" />
          <SkeletonBlock className="h-4 w-2/5 rounded-md" />
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <SkeletonBlock className="h-2.5 w-9 rounded-md" />
          <div className="flex items-center gap-1">
            <span className="i-material-symbols-star-rounded inline-block size-3 text-amber-400/20" aria-hidden="true" />
            <SkeletonBlock className="h-2.5 w-6 rounded-md" />
          </div>
        </div>
        <div className="mt-1.5 flex min-h-6 items-center gap-1.5 overflow-hidden">
          <SkeletonBlock className="h-5 w-11 shrink-0 rounded-md" />
          <SkeletonBlock className="h-5 w-11 shrink-0 rounded-md" />
          <SkeletonBlock className="h-5 w-10 shrink-0 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** 渲染搜索媒体卡片，详情链接携带来源地址以保留返回时的筛选和分页。 */
export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  const type = item.type === "shows" ? "shows" : "movies";

  return (
    <Link href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`} className="search-media-card surface-card interactive-media-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl">
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
          <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-fg-faint drop-shadow-md" aria-hidden="true" />
        )}
        <MediaCardStatusBadge status={item.status} />
      </div>
      <MediaCardBody item={item} type={type} />
    </Link>
  );
}
