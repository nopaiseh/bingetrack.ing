import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { isUpcomingDate } from "@/lib/upcoming";
import { SkeletonBlock } from "./LoadingSkeletons";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

/** 已看、在看优先于即将上映；还没看且日期在今天之后，用即将上映代替想看。 */
function showUpcoming(item: MediaCard): boolean {
  if (item.status === "watched" || item.status === "watching") return false;
  return isUpcomingDate(item.date);
}

/** 海报右上角的「即将上映」角标，外形与观看状态角标一致。 */
function UpcomingPosterBadge() {
  return (
    <span
      data-testid="media-card-upcoming-badge"
      className="pointer-events-none absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--canvas)] px-2 py-1 text-xs font-medium text-[var(--accent-hover)] transition-opacity duration-300"
      aria-label="即将上映"
      title="即将上映"
    >
      <span className="inline-block size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
      即将上映
    </span>
  );
}

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
      className="search-media-card surface-card interactive-media-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl focus-ring"
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
        {showUpcoming(item) ? <UpcomingPosterBadge /> : <MediaCardStatusBadge status={item.status} />}
      </div>
      <MediaCardBody item={item} type={mediaType} />
    </Link>
  );
}
