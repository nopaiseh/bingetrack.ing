import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { isUpcomingDate } from "@/lib/upcoming";
import { SkeletonBlock } from "./LoadingSkeletons";
import LetterTile from "./LetterTile";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

/** 电影取上映年；剧集保留跨年区间，并把连字符收成短横。 */
function cardYear(item: MediaCard): string {
  if (item.type === "shows") {
    return String(item.release_year || (item.date ? item.date.substring(0, 4) : "未知")).replace(/\s*-\s*/g, "–");
  }
  return item.date ? item.date.substring(0, 4) : "未知";
}

/** 已看、在看优先于即将上映；还没看且日期在今天之后，用即将上映代替想看。 */
function showUpcoming(item: MediaCard): boolean {
  if (item.status === "watched" || item.status === "watching") return false;
  return isUpcomingDate(item.date);
}

/** 搜索结果加载时的海报格：只占海报、标题和一行元信息。 */
export function SearchMediaCardSkeleton() {
  return (
    <div className="search-media-card flex flex-col">
      <div className="relative flex aspect-2/3 w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-2)]">
        <SkeletonBlock className="absolute inset-0 rounded-none bg-transparent" />
        <span className="i-material-symbols-image-outline-rounded inline-block size-8 text-white/15" aria-hidden="true" />
      </div>
      <div className="space-y-2 px-0.5 pt-2.5">
        <div className="min-h-10 space-y-1.5">
          <SkeletonBlock className="h-4 w-4/5 rounded-md" />
          <SkeletonBlock className="h-4 w-2/5 rounded-md" />
        </div>
        <SkeletonBlock className="h-4 w-3/5 rounded-md" />
      </div>
    </div>
  );
}

/** 海报网格卡片。没有封面时用标题首字；状态和评分排在标题下面。 */
export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  const upcoming = showUpcoming(item);
  const year = cardYear(item);

  return (
    <Link
      href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`}
      className="search-media-card group flex h-full cursor-pointer flex-col rounded-xl"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-[var(--surface-2)]">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 639px) 46vw, (max-width: 1279px) 30vw, 16vw"
          />
        ) : (
          <LetterTile title={item.title} />
        )}
      </div>
      <h3
        className="mt-2.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-fg transition-colors group-hover:text-[var(--accent-hover)]"
        title={item.title}
      >
        {item.title}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
        <span className="font-mono">{year}</span>
        {upcoming ? (
          <span className="inline-flex items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-sm font-medium text-[var(--accent-hover)]">
            即将上映
          </span>
        ) : (
          <MediaCardStatusBadge status={item.status} placement="inline" />
        )}
        {item.rating == null ? (
          <span>未评分</span>
        ) : (
          <span className="font-mono">{Number(item.rating).toFixed(1)}</span>
        )}
      </div>
    </Link>
  );
}
