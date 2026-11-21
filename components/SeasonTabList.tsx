"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import type { SeasonInfo } from "@/lib/types";

/**
 * 季详情头部的全宽季度切换条。
 * 横向滚动、隐藏滚动条；加载后只调整 scrollLeft，把当前季滚进可视区。
 */
export default function SeasonTabList({
  seriesId,
  seasonId,
  seasons,
}: {
  seriesId: string;
  seasonId: string;
  seasons: SeasonInfo[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (!list || !current) return;
    const target = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    list.scrollLeft = Math.max(0, target);
  }, [seasonId]);

  if (seasons.length <= 1) return null;

  return (
    <div className="season-tab-scroller relative mt-4 min-w-0">
      <div
        ref={listRef}
        role="tablist"
        aria-label="选择季度"
        className="no-scrollbar flex min-w-0 overflow-x-auto border-b border-white/10"
      >
        {seasons.map((season) => {
          const current = season.id === seasonId;
          return (
            <Link
              key={season.id}
              ref={current ? currentRef : undefined}
              role="tab"
              aria-selected={current}
              aria-current={current ? "page" : undefined}
              href={`/shows/${seriesId}/seasons/${season.id}`}
              className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap -mb-px transition-colors ${
                current
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              第 {season.seasonNumber} 季
            </Link>
          );
        })}
      </div>
    </div>
  );
}
