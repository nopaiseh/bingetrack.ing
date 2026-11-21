import Image from "next/image";
import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { isUpcomingDate } from "@/lib/upcoming";
import { SEARCH_POSTER_SIZES } from "@/lib/poster-image-sizes";
import { SkeletonBlock } from "./LoadingSkeletons";
import LetterTile from "./LetterTile";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";
import MediaRatingBadge from "./MediaRatingBadge";
import { getMediaTypeDefinition, MEDIA_TYPE_DEFINITIONS, publicPathForDbType } from "@/lib/media-types";

/** 已看、在看优先于即将上映；还没看且日期在今天之后，用即将上映代替想看。 */
function showUpcoming(item: MediaCard): boolean {
  if (item.status === "watched" || item.status === "watching" || item.status === "in_progress") return false;
  if (item.dbType === "book" || item.type === "books") return false;
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
  if (item.dbType && getMediaTypeDefinition(item.dbType)) {
    return getMediaTypeDefinition(item.dbType)!.label;
  }
  if (item.type === "albums") return MEDIA_TYPE_DEFINITIONS.album.label;
  if (item.type === "music") return MEDIA_TYPE_DEFINITIONS.music.label;
  if (item.type === "movies") return MEDIA_TYPE_DEFINITIONS.movie.label;
  if (item.type === "shows") return MEDIA_TYPE_DEFINITIONS.tv_show.label;
  if (item.type === "books") return MEDIA_TYPE_DEFINITIONS.book.label;
  return null;
}

function isSquareCover(item: MediaCard): boolean {
  if (item.dbType === "album" || item.dbType === "music") return true;
  return item.type === "albums" || item.type === "music";
}

function detailHref(item: MediaCard, returnHref: string): string | null {
  if (item.dbType) {
    const path = publicPathForDbType(item.dbType, item.id);
    if (path) return `${path}?from=${encodeURIComponent(returnHref)}`;
  }
  if (item.type === "movies" || item.type === "shows" || item.type === "albums" || item.type === "books") {
    return `/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`;
  }
  return null;
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

function MusicSearchBody({ item, typeLabel }: { item: MediaCard; typeLabel: string | null }) {
  const year = item.date
    ? item.date.substring(0, 4)
    : item.release_year
      ? String(item.release_year).slice(0, 4)
      : "未知";
  const artist = (item.artists ?? []).filter(Boolean)[0] ?? null;

  return (
    <div className="flex min-w-0 grow flex-col space-y-1.5 px-3 py-2.5">
      <h2
        className="font-serif-movie line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
        title={item.title}
      >
        {item.title}
      </h2>
      {artist ? <p className="truncate text-xs text-fg-muted">{artist}</p> : null}
      <div className="flex min-w-0 items-center justify-between gap-1.5 text-xs">
        <span className="shrink-0 whitespace-nowrap font-medium text-fg-secondary">{year}</span>
        <MediaRatingBadge rating={item.rating} size="sm" showTier={item.rating != null} />
      </div>
      {typeLabel ? (
        <div className="mt-1.5 flex min-h-6 w-full items-center gap-1.5 overflow-hidden">
          <span className="inline-flex min-h-5 shrink items-center truncate rounded-md border border-[var(--accent-border)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-medium tracking-wide text-[var(--accent-hover)]">
            {typeLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function isBookCard(item: MediaCard): boolean {
  return item.dbType === "book" || item.type === "books";
}

/** 搜索网格：影视／图书 2:3、音乐 1:1；专辑／单曲带类型标签。无公开详情的单曲只展示、不可点进详情。 */
export function SearchMediaCard({
  item,
  returnHref,
  preload = false,
  eager = false,
}: {
  item: MediaCard;
  returnHref: string;
  /** 首屏 LCP 候选：`preload` + `fetchPriority=high`（替代已弃用的 `priority`）。 */
  preload?: boolean;
  /** 首屏其余海报：eager，避免懒加载推迟可见图。 */
  eager?: boolean;
}) {
  const square = isSquareCover(item);
  const book = isBookCard(item);
  const typeLabel = typeTagLabel(item);
  const href = detailHref(item, returnHref);
  const mediaBodyType = item.type === "shows" ? "shows" : "movies";
  const showTypeOnFilmCard =
    typeLabel &&
    (item.type === "albums" || item.type === "music" || item.dbType === "album" || item.dbType === "music");

  const cover = (
    <div
      className={`image-placeholder relative flex w-full items-center justify-center overflow-hidden ${
        square ? "aspect-square" : "aspect-2/3"
      }`}
    >
      {item.cover_url ? (
        <Image
          src={item.cover_url}
          alt=""
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          sizes={SEARCH_POSTER_SIZES}
          preload={preload}
          fetchPriority={preload ? "high" : undefined}
          loading={preload ? undefined : eager ? "eager" : "lazy"}
        />
      ) : square || book ? (
        <LetterTile title={item.title} />
      ) : (
        <span
          className="i-material-symbols-image-outline-rounded inline-block size-10 text-fg-muted"
          aria-hidden="true"
        />
      )}
      {showUpcoming(item) ? (
        <UpcomingPosterBadge />
      ) : (
        <MediaCardStatusBadge status={item.status} kind={book ? "book" : "watch"} />
      )}
      {showTypeOnFilmCard ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-10 inline-flex items-center rounded-md border border-[var(--accent-border)] bg-[var(--canvas)]/90 px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-hover)]">
          {typeLabel}
        </span>
      ) : null}
    </div>
  );

  const body =
    item.type === "albums" || item.type === "music" || item.dbType === "album" || item.dbType === "music" ? (
      <MusicSearchBody item={item} typeLabel={null} />
    ) : (
      <MediaCardBody item={item} type={mediaBodyType} headingLevel={2} />
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
