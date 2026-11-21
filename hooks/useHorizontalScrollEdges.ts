"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export type HorizontalScrollEdges = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  refresh: () => void;
};

/** 跟踪横向滚动容器的左右溢出状态，供边缘渐隐与翻页按钮复用。 */
export function useHorizontalScrollEdges(
  scrollerRef: RefObject<HTMLElement | null>,
  measureKey: string | number = "",
): HorizontalScrollEdges {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const refresh = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, [scrollerRef]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const run = () => refresh();
    run();
    // 字体 / 图标加载会拉长内容但不改变容器 clientWidth，需观察子节点并补帧重测。
    const raf = window.requestAnimationFrame(() => {
      run();
      window.requestAnimationFrame(run);
    });
    const timeouts = [50, 150, 400].map((ms) => window.setTimeout(run, ms));
    el.addEventListener("scroll", run, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
    observer?.observe(el);
    for (const child of el.children) observer?.observe(child);
    if (!observer) window.addEventListener("resize", run);
    void document.fonts?.ready?.then(run);
    return () => {
      window.cancelAnimationFrame(raf);
      for (const id of timeouts) window.clearTimeout(id);
      el.removeEventListener("scroll", run);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", run);
    };
  }, [refresh, scrollerRef, measureKey]);

  return { canScrollLeft, canScrollRight, refresh };
}
