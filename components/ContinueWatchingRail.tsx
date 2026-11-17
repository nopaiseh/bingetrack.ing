"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";

/**
 * 首页「继续观看」卡片。只保留展示需要的字段。
 * `lastWatchedAt` 目前是上映日而不是观看时间，不能出现在界面上。
 */
export type ContinueWatchingCard = {
  showId: string;
  title: string;
  posterPath: string | null;
  href: string;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    href: string;
  } | null;
  seasonProgress: {
    seasonNumber: number;
    watched: number;
    total: number;
  };
};

const TMDB_POSTER_SIZE = "w342";
const SCROLL_GAP = "0.75rem";

/** 空白标题用占位文案，避免卡片和图片替代文本是空的。 */
export function continueWatchingTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || "未命名节目";
}

/**
 * 把后端给出的海报路径拼成图片地址。
 * 单段路径是 TMDB 文件名，用 w342（卡片大约 150–192px，两倍屏落在 342 附近）。
 * 多段且以 / 开头的是站内路径，原样交给图片组件。
 */
export function continueWatchingPosterSrc(posterPath: string | null): string | null {
  const path = posterPath?.trim() ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || /[#?\\]/.test(path)) return null;
  const file = path.slice(1);
  if (file.includes("/")) return path;
  return `https://image.tmdb.org/t/p/${TMDB_POSTER_SIZE}/${encodeURIComponent(file)}`;
}

/** 下一集写成 S2 · E5，有集名再附上；没有下一集说明这一季已经看完。 */
export function continueWatchingEpisodeLine(next: ContinueWatchingCard["nextEpisode"]): string {
  if (!next) return "本季已看完";
  const code = `S${next.seasonNumber} · E${next.episodeNumber}`;
  return next.title ? `${code} ${next.title}` : code;
}

/** 进度条旁的短文案：第 N 季 watched/total。 */
export function continueWatchingProgressText(progress: ContinueWatchingCard["seasonProgress"]): string {
  return `第 ${progress.seasonNumber} 季 ${progress.watched}/${progress.total}`;
}

/** 进度条的无障碍名称，把分数读成「已看多少集，共多少集」。 */
export function continueWatchingProgressLabel(progress: ContinueWatchingCard["seasonProgress"]): string {
  return `第 ${progress.seasonNumber} 季已看 ${progress.watched} 集，共 ${progress.total} 集`;
}

/** 有下一集时链到季页面（不是单集页）；这一季看完了就回节目页。 */
export function continueWatchingHref(item: Pick<ContinueWatchingCard, "href" | "nextEpisode">): string {
  return item.nextEpisode?.href ?? item.href;
}

/** 进度条宽度。总数不是正数时保持空条。 */
function progressPercent(progress: ContinueWatchingCard["seasonProgress"]): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress.watched / progress.total) * 100)));
}

/** 进度条的 aria 最大值至少为 1，避免 0/0 时最大值小于最小值。 */
function progressMax(total: number): number {
  return total > 0 ? total : 1;
}

function progressNow(progress: ContinueWatchingCard["seasonProgress"]): number {
  if (progress.total <= 0) return 0;
  return Math.min(progress.total, Math.max(0, progress.watched));
}

/** 系统要求减少动态效果时，滚动不要再做平滑动画。 */
function scrollBehavior(): ScrollBehavior {
  if (typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** 无海报，或图片加载失败时，用和全站相同的字块渐变，格子仍是 2:3。 */
function PosterFallback({ title }: { title: string }) {
  return (
    <div className="relative aspect-2/3 w-full overflow-hidden" data-poster-fallback="">
      <LetterTile title={title} className="h-full w-full" />
    </div>
  );
}

/** 2:3 海报。首张立即加载，其余懒加载；失败后回到首字占位。 */
function ContinueWatchingPoster({ item, eager }: { item: ContinueWatchingCard; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const title = continueWatchingTitle(item.title);
  const src = failed ? null : continueWatchingPosterSrc(item.posterPath);

  if (!src) return <PosterFallback title={title} />;

  return (
    <div className="image-placeholder relative aspect-2/3 w-full overflow-hidden">
      <Image
        src={src}
        alt={title}
        fill
        sizes="(max-width: 639px) 42vw, 192px"
        className="object-cover"
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** 一条正在看的节目。整张卡片链到季页面或节目页。 */
function ContinueWatchingCardLink({ item, eager }: { item: ContinueWatchingCard; eager: boolean }) {
  const title = continueWatchingTitle(item.title);
  const next = item.nextEpisode;
  const episodeLine = continueWatchingEpisodeLine(next);
  const progress = item.seasonProgress;

  return (
    <Link
      href={continueWatchingHref(item)}
      data-continue-card=""
      className="surface-card interactive-media-card group flex w-[calc((100%-2*var(--cw-gap))/3.05)] flex-none snap-start flex-col overflow-hidden rounded-xl focus-ring sm:w-36"
    >
      <ContinueWatchingPoster item={item} eager={eager} />
      <div className="flex min-w-0 grow flex-col gap-1.5 px-3 py-3">
        <h3
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-fg transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
          title={title}
        >
          {title}
        </h3>
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-fg-secondary" title={episodeLine}>
          {next ? (
            <>
              <span className="font-mono">{`S${next.seasonNumber} · E${next.episodeNumber}`}</span>
              {next.title ? ` ${next.title}` : null}
              <span className="sr-only">{`，打开第 ${next.seasonNumber} 季`}</span>
            </>
          ) : (
            <>
              本季已看完
              <span className="sr-only">，打开节目页</span>
            </>
          )}
        </p>
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <p className="text-sm text-fg-secondary">
            第 <span className="font-mono">{progress.seasonNumber}</span> 季{" "}
            <span className="font-mono">{`${progress.watched}/${progress.total}`}</span>
          </p>
          <div
            className="progress-track h-1 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progressMax(progress.total)}
            aria-valuenow={progressNow(progress)}
            aria-label={continueWatchingProgressLabel(progress)}
          >
            <div className="progress-fill h-full rounded-full" style={{ width: `${progressPercent(progress)}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** 横向等宽海报轨。没有正在看的节目时整段不渲染。手机大约露出三张。 */
export default function ContinueWatchingRail({ items }: { items: readonly ContinueWatchingCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    /** 根据滚动位置决定桌面两端的翻页按钮出不出现。 */
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

  /** 按一张卡片加间距翻动，让滚动吸附落在卡片边缘。 */
  const scrollByCard = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-continue-card]");
    const gap = Number.parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 12;
    const amount = (card?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: scrollBehavior() });
  };

  /** 焦点在列表本身时，左右方向键按卡片翻动，而不是滚动整页。 */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollByCard(event.key === "ArrowLeft" ? "left" : "right");
  };

  const buttonClass =
    "surface-panel absolute z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95";

  return (
    <section aria-labelledby="continue-watching-heading" className="min-w-0">
      <div className="mb-4 border-b border-[var(--border,rgba(255,255,255,0.1))] pb-3">
        <h2 id="continue-watching-heading" className="text-xl font-bold tracking-wide text-fg">
          继续观看
        </h2>
      </div>
      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => scrollByCard("left")}
          aria-label="向左滚动继续观看"
          aria-controls="continue-watching-scroller"
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
          aria-label="向右滚动继续观看"
          aria-controls="continue-watching-scroller"
          className={`${buttonClass} right-0 top-[6.5rem] focus-ring ${canScrollRight ? "hidden md:flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>
        <div
          id="continue-watching-scroller"
          ref={scrollerRef}
          tabIndex={0}
          aria-label="继续观看列表"
          onKeyDown={onKeyDown}
          style={{ "--cw-gap": SCROLL_GAP } as CSSProperties}
          className="no-scrollbar flex snap-x snap-mandatory gap-[var(--cw-gap)] overflow-x-auto overscroll-x-contain scroll-px-1 px-1 pb-4 pt-3 focus-ring"
        >
          {items.map((item, index) => (
            <ContinueWatchingCardLink key={item.showId} item={item} eager={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
