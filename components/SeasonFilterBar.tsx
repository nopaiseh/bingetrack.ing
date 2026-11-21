"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { edgeFadeMask } from "@/lib/edge-fade-mask";
import { scrollBehavior } from "@/lib/scroll-behavior";
import { useHorizontalScrollEdges } from "@/hooks/useHorizontalScrollEdges";

type SeasonFilterBarProps = {
  /** 筛选芯片与排序控件。 */
  chips: ReactNode;
  /** 右侧「N 集」等元信息。 */
  trailing: ReactNode;
  /** 内容变化时重测溢出，例如总数文案变化。 */
  measureKey?: string | number;
};

const BAR_SHELL = "relative sticky top-20 z-20 mb-6";
const BAR_SURFACE =
  "surface-overlay no-scrollbar flex items-center gap-2 overflow-x-auto overscroll-x-contain rounded-2xl p-3 motion-safe:scroll-smooth";
/** 与 MediaRow 翻页钮同为 40px，并叠 tap-target-expand 保证点击区。 */
const ARROW_BTN =
  "surface-panel focus-ring tap-target-expand absolute top-1/2 z-10 inline-flex size-10 shrink-0 -translate-y-1/2 items-center justify-center rounded-lg text-fg-secondary shadow-md shadow-black/30 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95";

/** 按约一屏 75% 宽度翻动筛选条；遵守 prefers-reduced-motion。 */
function scrollFilterBar(el: HTMLElement, direction: "left" | "right") {
  const offset = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
  el.scrollBy({ left: offset, behavior: scrollBehavior() });
}

/**
 * 季页筛选条：横向溢出时用 edgeFadeMask 边缘渐隐，并在可滚动方向显示可访问箭头。
 * 桌面端放得下时无渐隐、无箭头，与原先外观一致。
 */
export default function SeasonFilterBar({ chips, trailing, measureKey }: SeasonFilterBarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight } = useHorizontalScrollEdges(scrollerRef, measureKey ?? "");

  const onScrollerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollFilterBar(event.currentTarget, event.key === "ArrowLeft" ? "left" : "right");
  };

  return (
    <div
      className={BAR_SHELL}
      data-testid="season-filter-bar"
      data-can-scroll-left={canScrollLeft ? "1" : "0"}
      data-can-scroll-right={canScrollRight ? "1" : "0"}
    >
      {canScrollLeft ? (
        <button
          type="button"
          className={`${ARROW_BTN} left-1`}
          aria-label="向左滚动筛选选项"
          onClick={() => {
            const el = scrollerRef.current;
            if (el) scrollFilterBar(el, "left");
          }}
        >
          <span className="i-material-symbols-chevron-left-rounded inline-block size-5" aria-hidden="true" />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          className={`${ARROW_BTN} right-1`}
          aria-label="向右滚动筛选选项"
          onClick={() => {
            const el = scrollerRef.current;
            if (el) scrollFilterBar(el, "right");
          }}
        >
          <span className="i-material-symbols-chevron-right-rounded inline-block size-5" aria-hidden="true" />
        </button>
      ) : null}

      <div
        ref={scrollerRef}
        role="group"
        aria-label="筛选与排序"
        tabIndex={0}
        onKeyDown={onScrollerKeyDown}
        style={edgeFadeMask(canScrollLeft, canScrollRight, "2rem")}
        className={`${BAR_SURFACE} focus-ring ${canScrollLeft ? "pl-12" : ""} ${canScrollRight ? "pr-12" : ""}`}
      >
        <span
          className="i-material-symbols-filter-list-rounded ml-1 size-4 shrink-0 text-fg-muted inline-block"
          aria-hidden="true"
        />
        {chips}
        <span className="ml-auto shrink-0 whitespace-nowrap text-[13px] text-fg-muted">{trailing}</span>
      </div>
    </div>
  );
}
