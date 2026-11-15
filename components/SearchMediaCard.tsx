import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { SkeletonBlock } from "./LoadingSkeletons";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

/** 搜索结果加载时的卡片骨架，外形与目录卡一致。 */
export function SearchMediaCardSkeleton() {
  return (
    <div className="search-media-card surface-card flex flex-col overflow-hidden rounded-xl">
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        <SkeletonBlock className="absolute inset-0 rounded-none bg-transparent" />
        <span
          className="i-material-symbols-image-outline-rounded inline-block size-8 text-white/15"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div className="min-h-10 space-y-1.5">
          <SkeletonBlock className="h-4 w-4/5 rounded-md" />
          <SkeletonBlock className="h-4 w-2/5 rounded-md" />
        </div>
        <SkeletonBlock className="h-4 w-3/5 rounded-md" />
      </div>
    </div>
  );
}

/** 搜索网格复用目录卡：描边底色、海报角标，以及评分档位和类型标签。 */
export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  const mediaType = item.type === "shows" ? "shows" : "movies";

  return (
    <Link
      href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`}
      className="search-media-card surface-card interactive-media-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 639px) 46vw, (max-width: 1279px) 30vw, 16vw"
          />
        ) : (
          <span
            className="i-material-symbols-image-outline-rounded inline-block size-10 text-fg-muted"
            aria-hidden="true"
          />
        )}
        <MediaCardStatusBadge status={item.status} />
      </div>
      <MediaCardBody item={item} type={mediaType} />
    </Link>
  );
}
