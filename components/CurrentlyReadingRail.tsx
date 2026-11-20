"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { continueWatchingPosterSrc } from "@/components/ContinueWatchingRail";
import { RAIL_POSTER_SIZES } from "@/lib/poster-image-sizes";
import { scrollBehavior } from "@/lib/scroll-behavior";

/** 首页「在读」卡片。无页数进度。 */
export type CurrentlyReadingCard = {
  bookId: string;
  title: string;
  posterPath: string | null;
  href: string;
  authors: string[];
};

const SCROLL_GAP = "0.75rem";

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
      <LetterTile title={title} className="h-full w-full" />
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
        alt={title}
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
    <Link
      href={item.href}
      data-continue-card=""
      className="surface-card interactive-media-card group flex w-[calc((100%-2*var(--cw-gap))/3.05)] flex-none snap-start flex-col overflow-hidden rounded-xl focus-ring sm:w-36"
    >
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
    </Link>
  );
}

/** 横向在读图书轨。没有在读条目时整段不渲染。 */
export default function CurrentlyReadingRail({ items }: { items: readonly CurrentlyReadingCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    };

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkScroll);
    observer?.observe(el);
    if (!observer) window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  if (items.length === 0) return null;

  const scrollByCard = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-continue-card]");
    const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 12;
    const amount = (card?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: scrollBehavior() });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollByCard(event.key === "ArrowLeft" ? "left" : "right");
  };

  const buttonClass =
    "surface-panel absolute z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95";

  return (
    <section aria-labelledby="currently-reading-heading" className="min-w-0">
      <div className="mb-4 border-b border-[var(--border,rgba(255,255,255,0.1))] pb-3">
        <h2 id="currently-reading-heading" className="text-xl font-bold tracking-wide text-fg">
          在读
        </h2>
      </div>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => scrollByCard("left")}
          aria-label="向左滚动在读"
          aria-controls="currently-reading-scroller"
          className={`${buttonClass} left-0 top-[6.5rem] focus-ring ${canScrollLeft ? "hidden md:flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-left-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard("right")}
          aria-label="向右滚动在读"
          aria-controls="currently-reading-scroller"
          className={`${buttonClass} right-0 top-[6.5rem] focus-ring ${canScrollRight ? "hidden md:flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>
        <div
          id="currently-reading-scroller"
          ref={scrollerRef}
          tabIndex={0}
          aria-label="在读列表"
          onKeyDown={onKeyDown}
          style={{ "--cw-gap": SCROLL_GAP } as CSSProperties}
          className="no-scrollbar flex snap-x snap-mandatory gap-[var(--cw-gap)] overflow-x-auto overscroll-x-contain scroll-px-1 px-1 pb-4 pt-3 focus-ring"
        >
          {items.map((item, index) => (
            <ReadingCard key={item.bookId} item={item} eager={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
