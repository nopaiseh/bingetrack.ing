import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { isUpcomingDate } from "@/lib/upcoming";
import { SEARCH_POSTER_SIZES } from "@/lib/poster-image-sizes";
import DeferredSearchPoster from "@/components/search/DeferredSearchPoster";
import { SkeletonBlock } from "./LoadingSkeletons";
import LetterTile from "./LetterTile";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";
import MusicCardBody from "./MusicCardBody";
import { getMediaTypeDefinition, publicPathForDbType } from "@/lib/media-types";

/** 已看、在看优先于即将上映；还没看且日期在今天之后，用即将上映代替想看。 */
function showUpcoming(item: MediaCard): boolean {
  if (item.status === "watched" || item.status === "watching" || item.status === "in_progress") return false;
  if (item.dbType === "book") return false;
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

function typeTagLabel(item: MediaCard): string | null {
  if (!item.dbType) return null;
  return getMediaTypeDefinition(item.dbType)?.label ?? null;
}

function isSquareCover(item: MediaCard): boolean {
  return getMediaTypeDefinition(item.dbType ?? "")?.coverAspect === "1/1";
}

function detailHref(item: MediaCard, returnHref: string): string | null {
  if (!item.dbType) return null;
  const path = publicPathForDbType(item.dbType, item.id);
  if (!path) return null;
  return `${path}?from=${encodeURIComponent(returnHref)}`;
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

function isBookCard(item: MediaCard): boolean {
  return item.dbType === "book";
}

function isMusicCard(item: MediaCard): boolean {
  return item.dbType === "album" || item.dbType === "music";
}

/** 搜索网格：影视／图书 2:3、音乐 1:1；专辑／单曲带类型标签。无公开详情的单曲只展示、不可点进详情。 */
export function SearchMediaCard({
  item,
  returnHref,
  preload = false,
  eager = false,
  deferPoster = false,
}: {
  item: MediaCard;
  returnHref: string;
  /** 首屏 LCP 候选：`preload` + `fetchPriority=high`（替代已弃用的 `priority`）。 */
  preload?: boolean;
  /** 首屏其余海报：eager，避免懒加载推迟可见图。 */
  eager?: boolean;
  /**
   * When true, hold the poster src until near the viewport.
   * First ~6 above-the-fold cards should pass false so images render immediately.
   */
  deferPoster?: boolean;
}) {
  const square = isSquareCover(item);
  const book = isBookCard(item);
  const music = isMusicCard(item);
  const typeLabel = typeTagLabel(item);
  const href = detailHref(item, returnHref);
  const mediaBodyDbType = item.dbType === "tv_show" ? "tv_show" : item.dbType === "book" ? "book" : "movie";
  const showTypeOnFilmCard = Boolean(typeLabel && music);

  const cover = (
    <div
      className={`image-placeholder relative flex w-full items-center justify-center overflow-hidden ${
        square ? "aspect-square" : "aspect-2/3"
      }`}
    >
      {item.cover_url ? (
        <DeferredSearchPoster
          src={item.cover_url}
          defer={deferPoster}
          sizes={SEARCH_POSTER_SIZES}
          preload={preload}
          eager={eager}
        />
      ) : (
        <LetterTile title={item.title} decorative />
      )}
      {showUpcoming(item) ? (
        <UpcomingPosterBadge />
      ) : (
        <MediaCardStatusBadge status={item.status} kind={book ? "book" : music ? "listen" : "watch"} />
      )}
      {showTypeOnFilmCard ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-10 inline-flex items-center rounded-md border border-[var(--accent-border)] bg-[var(--canvas)]/90 px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-hover)]">
          {typeLabel}
        </span>
      ) : null}
    </div>
  );

  const body = music ? (
    <MusicCardBody item={item} headingLevel={2} artistFallback="omit" />
  ) : (
    <MediaCardBody item={item} dbType={mediaBodyDbType} headingLevel={2} />
  );

  const className =
    "search-media-card surface-card interactive-media-card group flex h-full flex-col overflow-hidden rounded-xl focus-ring";

  if (!href) {
    return (
      <article className={`${className} cursor-default`} aria-label={item.title}>
        {cover}
        {body}
      </article>
    );
  }

  return (
    <Link href={href} className={`${className} cursor-pointer`}>
      {cover}
      {body}
    </Link>
  );
}
