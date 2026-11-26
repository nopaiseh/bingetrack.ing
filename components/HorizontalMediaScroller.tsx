"use client";

import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import { edgeFadeMask } from "@/lib/edge-fade-mask";
import { scrollBehavior } from "@/lib/scroll-behavior";
import { useHorizontalScrollEdges } from "@/hooks/useHorizontalScrollEdges";

/** 目录行与首页 rail 共用的卡片宽度：手机约两张，sm 起 w-48。 */
export const HORIZONTAL_MEDIA_CARD_WIDTH_CLASS = "w-40 sm:w-48";

/** 横滑行内单卡外壳：固定宽度、scroll-snap、焦点环。 */
export const HORIZONTAL_MEDIA_CARD_CLASS = `surface-card interactive-media-card group flex ${HORIZONTAL_MEDIA_CARD_WIDTH_CLASS} flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl focus-ring last:snap-end`;

/** 2:3 海报行翻页钮垂直位置（封面中线，含 scroller 上内边距）。 */
export const HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER = "top-[8.5rem] sm:top-[10rem]";

/** 1:1 方封面行翻页钮垂直位置。 */
export const HORIZONTAL_MEDIA_SCROLL_BTN_TOP_SQUARE = "top-[6rem] sm:top-[7rem]";

const SCROLL_BTN_CLASS =
  "surface-panel focus-ring absolute z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95 motion-reduce:active:scale-100";

/** 按约一屏 75% 宽度翻动；遵守 prefers-reduced-motion。 */
export function scrollHorizontalMediaRow(el: HTMLElement, direction: "left" | "right") {
  const offset = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
  el.scrollBy({ left: offset, behavior: scrollBehavior() });
}

type HorizontalMediaScrollerProps = {
  title: string;
  /** 标题元素 id；缺省时自动生成，供 section aria-labelledby 使用。 */
  titleId?: string;
  viewAllLink?: string;
  /** 滚动容器 id；缺省时自动生成，供翻页按钮 aria-controls 使用。 */
  scrollerId?: string;
  /** 滚动容器无障碍名称；缺省为「{title}列表」。 */
  scrollerLabel?: string;
  /** 翻页按钮相对封面中线的 top 类名。 */
  scrollButtonTopClass: string;
  /** 内容变化时重测溢出（如条目数量）。 */
  measureKey?: string | number;
  children: ReactNode;
  className?: string;
};

/**
 * 站内横向媒体行共用外壳：统一标题栏、边缘渐隐、翻页按钮与方向键。
 * 桌面与手机均在可滚动方向显示翻页钮；焦点落在列表上时左右方向键翻页。
 */
export default function HorizontalMediaScroller({
  title,
  titleId,
  viewAllLink,
  scrollerId,
  scrollerLabel,
  scrollButtonTopClass,
  measureKey = "",
  children,
  className = "",
}: HorizontalMediaScrollerProps) {
  const reactId = useId();
  const headingId = titleId ?? `horizontal-media-heading-${reactId}`;
  const resolvedScrollerId = scrollerId ?? `horizontal-media-scroller-${reactId}`;
  const label = scrollerLabel ?? `${title}列表`;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const { canScrollLeft, canScrollRight } = useHorizontalScrollEdges(scrollerRef, measureKey);

  // 翻到头／尾时对应钮会 disabled+hidden；若焦点仍在该钮上，移回可聚焦的滚动列表。
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!canScrollLeft && active === prevBtnRef.current) {
      scrollerRef.current?.focus();
      return;
    }
    if (!canScrollRight && active === nextBtnRef.current) {
      scrollerRef.current?.focus();
    }
  }, [canScrollLeft, canScrollRight]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (el) scrollHorizontalMediaRow(el, direction);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    handleScroll(event.key === "ArrowLeft" ? "left" : "right");
  };

  return (
    <section aria-labelledby={headingId} className={`relative min-w-0 ${className}`.trim()}>
      <div className="mb-5 flex items-end justify-between border-b border-white/10 pr-1 pb-3">
        <h2 id={headingId} className="text-xl font-bold tracking-wide text-fg">
          {title}
        </h2>
        {viewAllLink ? (
          <HoverPrefetchLink
            href={viewAllLink}
            className="focus-ring rounded-sm text-sm uppercase tracking-wider text-fg-secondary transition-all duration-300 hover:text-[var(--accent-hover)]"
          >
            查看全部 &rarr;
          </HoverPrefetchLink>
        ) : null}
      </div>

      <div className="relative min-w-0">
        <button
          ref={prevBtnRef}
          type="button"
          onClick={() => handleScroll("left")}
          aria-label={`向左滚动 ${title}`}
          aria-controls={resolvedScrollerId}
          disabled={!canScrollLeft}
          className={`${SCROLL_BTN_CLASS} left-0 ${scrollButtonTopClass} ${canScrollLeft ? "flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-left-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>
        <button
          ref={nextBtnRef}
          type="button"
          onClick={() => handleScroll("right")}
          aria-label={`向右滚动 ${title}`}
          aria-controls={resolvedScrollerId}
          disabled={!canScrollRight}
          className={`${SCROLL_BTN_CLASS} right-0 ${scrollButtonTopClass} ${canScrollRight ? "flex" : "hidden"}`}
        >
          <span
            className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>

        <div
          id={resolvedScrollerId}
          ref={scrollerRef}
          role="group"
          tabIndex={0}
          aria-label={label}
          onKeyDown={onKeyDown}
          style={edgeFadeMask(canScrollLeft, canScrollRight, "3rem")}
          className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto overscroll-x-contain scroll-px-1 px-1 pb-12 pt-4 motion-safe:scroll-smooth focus-ring"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
