"use client";

import { useState } from "react";
import Image from "next/image";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import HorizontalMediaScroller, {
  HORIZONTAL_MEDIA_CARD_CLASS,
  HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER,
} from "@/components/HorizontalMediaScroller";
import LetterTile from "@/components/LetterTile";
import { continueWatchingPosterSrc } from "@/components/ContinueWatchingRail";
import { RAIL_POSTER_SIZES } from "@/lib/poster-image-sizes";

/** 首页「在读」卡片。无页数进度。 */
export type CurrentlyReadingCard = {
  bookId: string;
  title: string;
  posterPath: string | null;
  href: string;
  authors: string[];
};

export function currentlyReadingTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || "未命名图书";
}

export function currentlyReadingAuthorsLine(authors: readonly string[]): string | null {
  const names = authors.map((name) => name.trim()).filter(Boolean);
  return names.length > 0 ? names.join("、") : null;
}

function CoverFallback({ title }: { title: string }) {
  return (
    <div className="relative aspect-2/3 w-full overflow-hidden" data-poster-fallback="">
      <LetterTile title={title} decorative className="h-full w-full" />
    </div>
  );
}

function ReadingCover({ item, eager }: { item: CurrentlyReadingCard; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const title = currentlyReadingTitle(item.title);
  const src = failed ? null : continueWatchingPosterSrc(item.posterPath);
  if (!src) return <CoverFallback title={title} />;
  return (
    <div className="image-placeholder relative aspect-2/3 w-full overflow-hidden">
      <Image
        src={src}
        alt=""
        fill
        sizes={RAIL_POSTER_SIZES}
        className="object-cover"
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ReadingCard({ item, eager }: { item: CurrentlyReadingCard; eager: boolean }) {
  const title = currentlyReadingTitle(item.title);
  const authors = currentlyReadingAuthorsLine(item.authors);
  return (
    <HoverPrefetchLink href={item.href} className={HORIZONTAL_MEDIA_CARD_CLASS}>
      <ReadingCover item={item} eager={eager} />
      <div className="flex min-w-0 grow flex-col gap-1.5 px-3 py-3">
        <h3
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-fg transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
          title={title}
        >
          {title}
        </h3>
        {authors ? (
          <p className="line-clamp-2 text-sm leading-5 text-fg-secondary" title={authors}>
            {authors}
          </p>
        ) : null}
      </div>
    </HoverPrefetchLink>
  );
}

/** 横向在读图书轨。没有在读条目时整段不渲染。 */
export default function CurrentlyReadingRail({ items }: { items: readonly CurrentlyReadingCard[] }) {
  if (items.length === 0) return null;

  return (
    <HorizontalMediaScroller
      title="在读"
      titleId="currently-reading-heading"
      scrollerId="currently-reading-scroller"
      scrollerLabel="在读列表"
      scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER}
      measureKey={items.length}
    >
      {items.map((item, index) => (
        <ReadingCard key={item.bookId} item={item} eager={index === 0} />
      ))}
    </HorizontalMediaScroller>
  );
}
