"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import { continueWatchingPosterSrc } from "@/components/ContinueWatchingRail";

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

function scrollBehavior(): ScrollBehavior {
  if (typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function CoverFallback({ title }: { title: string }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden" data-poster-fallback="">
      <LetterTile title={title} className="h-full w-full" />
    </div>
  );
}

function ListeningCover({ item }: { item: ContinueListeningCard }) {
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
        sizes="(max-width: 640px) 42vw, 192px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ListeningCard({ item }: { item: ContinueListeningCard }) {
  const title = continueListeningTitle(item.title);
  const progress = item.trackProgress;
  return (
    <Link
      href={item.href}
      data-continue-card=""
      className="group flex w-[42vw] max-w-48 shrink-0 flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-48"
    >
      <div className="overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:ring-white/25">
        <ListeningCover item={item} />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
        <p className="text-xs text-fg-muted">{continueListeningProgressText(progress)}</p>
        <div
          className="h-1 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progressMax(progress.total)}
          aria-valuenow={progressNow(progress)}
          aria-label={continueListeningProgressLabel(progress)}
        >
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPercent(progress)}%` }} />
        </div>
      </div>
    </Link>
  );
}

/** 首页「在听」横滑行；无条目时不渲染。 */
export default function ContinueListeningRail({ items }: { items: readonly ContinueListeningCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanPrev(el.scrollLeft > 2);
      setCanNext(el.scrollLeft < max - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items]);

  if (items.length === 0) return null;

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: scrollBehavior() });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByPage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByPage(1);
    }
  };

  return (
    <section aria-labelledby="continue-listening-heading" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="continue-listening-heading" className="text-xl font-bold tracking-wide text-fg">
          在听
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-sm text-fg-muted disabled:opacity-30"
            aria-controls="continue-listening-scroller"
            disabled={!canPrev}
            onClick={() => scrollByPage(-1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-2 py-1 text-sm text-fg-muted disabled:opacity-30"
            aria-controls="continue-listening-scroller"
            disabled={!canNext}
            onClick={() => scrollByPage(1)}
          >
            下一页
          </button>
        </div>
      </div>
      <div
        id="continue-listening-scroller"
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex overflow-x-auto pb-1 outline-none"
        style={{ gap: SCROLL_GAP, scrollSnapType: "x mandatory" } as CSSProperties}
      >
        {items.map((item) => (
          <div key={item.albumId} className="scroll-snap-align-start">
            <ListeningCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
