"use client";

import { useState } from "react";
import Image from "next/image";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import HorizontalMediaScroller, {
  HORIZONTAL_MEDIA_CARD_CLASS,
  HORIZONTAL_MEDIA_SCROLL_BTN_TOP_SQUARE,
} from "@/components/HorizontalMediaScroller";
import LetterTile from "@/components/LetterTile";
import { continueWatchingPosterSrc } from "@/components/ContinueWatchingRail";
import { RAIL_POSTER_SIZES } from "@/lib/poster-image-sizes";

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
      <LetterTile title={title} decorative className="h-full w-full" />
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

function ListeningCard({ item, eager }: { item: ContinueListeningCard; eager: boolean }) {
  const title = continueListeningTitle(item.title);
  const progress = item.trackProgress;
  return (
    <HoverPrefetchLink href={item.href} className={HORIZONTAL_MEDIA_CARD_CLASS}>
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
  if (items.length === 0) return null;

  return (
    <HorizontalMediaScroller
      title="在听"
      titleId="continue-listening-heading"
      scrollerId="continue-listening-scroller"
      scrollerLabel="在听列表"
      scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_SQUARE}
      measureKey={items.length}
    >
      {items.map((item, index) => (
        <ListeningCard key={item.albumId} item={item} eager={index === 0} />
      ))}
    </HorizontalMediaScroller>
  );
}
