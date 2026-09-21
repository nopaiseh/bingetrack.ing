"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SeasonInfo } from "@/lib/types";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

/**
 * 电视剧季列表横向平滑轮播组件。
 * 遵循全站卡片统一尺寸规范（w-40 sm:w-48），无论季数多少均保持视觉协调且不侵占纵向空间。
 */
export default function SeasonRow({
  seriesId,
  seasons,
}: {
  seriesId: string;
  seasons: SeasonInfo[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /** 检查当前横向滚动条位置，更新翻页按钮可见状态。 */
  const checkScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollerRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [seasons]);

  /** 平滑翻动横向列表约 75% 容器宽度。 */
  const handleScroll = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const offset = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (!seasons || seasons.length === 0) {
    return (
      <div className="mb-12 mt-12">
        <div className="flex items-center gap-2 mb-5 border-b border-white/10 pb-3">
          <h2 className="text-xl font-bold tracking-wide text-white">季度列表</h2>
        </div>
        <div className="surface-muted rounded-xl border border-white/10 px-6 py-10 text-center text-sm text-white/60">
          暂无季集数据
        </div>
      </div>
    );
  }

  return (
    <div className="group/row relative mb-12 mt-12">
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-wide text-white">季度列表</h2>
          <span className="text-xs text-white/50 font-medium tracking-normal">
            共 {seasons.length} 季
          </span>
        </div>
      </div>

      {/* 桌面端左翻页按钮 */}
      <button
        type="button"
        onClick={() => handleScroll("left")}
        aria-label="向左滚动季度列表"
        disabled={!canScrollLeft}
        className={`surface-panel absolute -left-3 top-1/2 -translate-y-1/2 z-20 hidden lg:flex size-10 items-center justify-center rounded-full text-white/80 shadow-lg shadow-black/40 transition-all duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white hover:scale-105 active:scale-95 ${
          canScrollLeft
            ? "opacity-0 group-hover/row:opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="i-material-symbols-chevron-left-rounded size-6 inline-block" aria-hidden="true" />
      </button>

      {/* 桌面端右翻页按钮 */}
      <button
        type="button"
        onClick={() => handleScroll("right")}
        aria-label="向右滚动季度列表"
        disabled={!canScrollRight}
        className={`surface-panel absolute -right-3 top-1/2 -translate-y-1/2 z-20 hidden lg:flex size-10 items-center justify-center rounded-full text-white/80 shadow-lg shadow-black/40 transition-all duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white hover:scale-105 active:scale-95 ${
          canScrollRight
            ? "opacity-0 group-hover/row:opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="i-material-symbols-chevron-right-rounded size-6 inline-block" aria-hidden="true" />
      </button>

      {/* 左右滚动边缘暗影提示 */}
      <div
        className={`pointer-events-none absolute left-0 top-14 bottom-8 w-8 bg-gradient-to-r from-[var(--canvas)] to-transparent z-10 transition-opacity duration-300 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`pointer-events-none absolute right-0 top-14 bottom-8 w-8 bg-gradient-to-l from-[var(--canvas)] to-transparent z-10 transition-opacity duration-300 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={scrollerRef}
        className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto scroll-px-1 px-1 pb-12 pt-2 scroll-smooth"
      >
        {seasons.map((season) => {
          const status = season.episodeCount > 0 && season.watchedEpisodeCount === season.episodeCount
            ? "watched"
            : season.watchedEpisodeCount > 0
              ? "watching"
              : undefined;

          return (
            <Link
              key={season.id}
              href={`/series/${seriesId}/seasons/${season.id}`}
              className="surface-card interactive-media-card group flex w-40 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl last:snap-end sm:w-48"
            >
              <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
                {season.coverUrl ? (
                  <Image
                    src={season.coverUrl}
                    alt={`${season.title} 海报`}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    sizes="(max-width: 639px) 160px, 192px"
                  />
                ) : (
                  <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-white/30 drop-shadow-md" aria-hidden="true" />
                )}
                <span className="image-label absolute left-2 top-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/75 backdrop-blur-md">
                  第 {season.seasonNumber} 季
                </span>
                <MediaCardStatusBadge status={status} />
              </div>

              <div className="flex flex-col space-y-1.5 grow px-3 py-2.5 min-w-0">
                <h3
                  className="font-serif-movie truncate text-sm font-bold text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
                  title={season.title}
                >
                  {season.title}
                </h3>

                <div className="flex items-center justify-between text-xs text-white/60 font-medium">
                  <span className="whitespace-nowrap truncate">
                    {season.releaseYearRange ? season.releaseYearRange.replace(/\s*-\s*/g, "–") : "–"}
                  </span>
                  <span className="shrink-0 text-white/50 ml-1">
                    {season.watchedEpisodeCount > 0
                      ? `${season.watchedEpisodeCount}/${season.episodeCount} 集`
                      : `${season.episodeCount} 集`}
                  </span>
                </div>

                {season.episodeCount > 0 && season.watchedEpisodeCount > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10 mt-1">
                    <div
                      className="h-full bg-[var(--accent)] transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((season.watchedEpisodeCount / season.episodeCount) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

