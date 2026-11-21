"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import LetterTile from "@/components/LetterTile";
import { continueWatchingPosterSrc } from "@/components/ContinueWatchingRail";
import { RAIL_POSTER_SIZES } from "@/lib/poster-image-sizes";
import { scrollBehavior } from "@/lib/scroll-behavior";

/** 首页「在听」卡片。 */
export type ContinueListeningCard = {
  albumId: string;
  title: string;
  posterPath: string | null;
  href: string;
  trackProgress: {
    watched: number;
    total: number;
  };
};

const SCROLL_GAP = "0.75rem";

export function continueListeningTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || "未命名专辑";
}

export function continueListeningProgressText(progress: ContinueListeningCard["trackProgress"]): string {
  return `${progress.watched}/${progress.total} 首`;
}

export function continueListeningProgressLabel(progress: ContinueListeningCard["trackProgress"]): string {
  return `已听 ${progress.watched} 首，共 ${progress.total} 首`;
}

function progressPercent(progress: ContinueListeningCard["trackProgress"]): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress.watched / progress.total) * 100)));
}

function progressMax(total: number): number {
  return total > 0 ? total : 1;
}

function progressNow(progress: ContinueListeningCard["trackProgress"]): number {
  if (progress.total <= 0) return 0;
  return Math.min(progress.total, Math.max(0, progress.watched));
}

function CoverFallback({ title }: { title: string }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden" data-poster-fallback="">
      <LetterTile title={title} className="h-full w-full" />
    </div>
  );
}

function ListeningCover({ item, eager }: { item: ContinueListeningCard; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const title = continueListeningTitle(item.title);
  const src = failed ? null : continueWatchingPosterSrc(item.posterPath);
  if (!src) return <CoverFallback title={title} />;
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-black/20">
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

function ListeningCard({ item, eager }: { item: ContinueListeningCard; eager: boolean }) {
  const title = continueListeningTitle(item.title);
  const progress = item.trackProgress;
  return (
    <HoverPrefetchLink
      href={item.href}
      data-continue-card=""
      className="surface-card interactive-media-card group flex w-[calc((100%-2*var(--cw-gap))/3.05)] flex-none snap-start flex-col overflow-hidden rounded-xl focus-ring sm:w-36"
    >
      <ListeningCover item={item} eager={eager} />
      <div className="flex min-w-0 grow flex-col gap-1.5 px-3 py-3">
        <h3
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-fg transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
          title={title}
        >
          {title}
        </h3>
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <p className="text-sm text-fg-secondary">
            <span className="font-mono">{continueListeningProgressText(progress)}</span>
          </p>
          <div
            className="progress-track h-1 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progressMax(progress.total)}
            aria-valuenow={progressNow(progress)}
            aria-label={continueListeningProgressLabel(progress)}
          >
            <div className="progress-fill h-full rounded-full" style={{ width: `${progressPercent(progress)}%` }} />
          </div>
        </div>
      </div>
    </HoverPrefetchLink>
  );
}

/** 首页「在听」横滑行；无条目时不渲染。 */
export default function ContinueListeningRail({ items }: { items: readonly ContinueListeningCard[] }) {
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
    <section aria-labelledby="continue-listening-heading" className="min-w-0">
      <div className="mb-4 border-b border-[var(--border,rgba(255,255,255,0.1))] pb-3">
        <h2 id="continue-listening-heading" className="text-xl font-bold tracking-wide text-fg">
          在听
        </h2>
      </div>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => scrollByCard("left")}
          aria-label="向左滚动在听"
          aria-controls="continue-listening-scroller"
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
          aria-label="向右滚动在听"
          aria-controls="continue-listening-scroller"
          className={`${buttonClass} right-0 top-[6.5rem] focus-ring ${canScrollRight ? "hidden md:flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>
        <div
          id="continue-listening-scroller"
          ref={scrollerRef}
          tabIndex={0}
          aria-label="在听列表"
          onKeyDown={onKeyDown}
          style={{ "--cw-gap": SCROLL_GAP } as CSSProperties}
          className="no-scrollbar flex snap-x snap-mandatory gap-[var(--cw-gap)] overflow-x-auto overscroll-x-contain scroll-px-1 px-1 pb-4 pt-3 focus-ring"
        >
          {items.map((item, index) => (
            <ListeningCard key={item.albumId} item={item} eager={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
