"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";

/** 展示卡片海报、年份、评分及最多四个标签，并按参数控制图片加载优先级。 */
function ItemCard({ item, type, eager, highPriority }: { item: MediaCard; type: "movies" | "series"; eager: boolean; highPriority: boolean }) {
  // 合并类型与语言标签，优先展示前三个类型并补充语言，统一控制卡片高度。
  const tags = [...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 1)].slice(0, 3);

  return (
    <>
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 639px) 144px, 176px"
            priority={highPriority}
            loading={highPriority ? undefined : eager ? "eager" : "lazy"}
          />
        ) : (
          <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-white/30 drop-shadow-md" aria-hidden="true" />
        )}
      </div>
      
      <div className="flex flex-col space-y-1.5 grow px-3 py-2.5 min-w-0">
        <h3 className="font-serif-movie text-sm font-bold text-white truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-red-400 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-colors duration-300" title={item.title}>
          {item.title}
        </h3>

        <div className="flex justify-between items-center text-xs">
          <span className="text-white/60 font-medium">
            {type === "series"
              ? item.release_year || (item.date ? item.date.substring(0, 4) : "未知")
              : item.date ? item.date.substring(0, 4) : "未知"}
          </span>
          <MediaRatingBadge
            rating={item.rating}
            size="sm"
            showTier={item.rating != null}
          />
        </div>
        
        <div className="mt-1.5 flex items-center gap-1.5 w-full overflow-hidden">
          {tags.map(/* 将一个类型或语言标签渲染为统一可截断的紧凑徽标。 */ (tag: string, i: number) => (
            <span
              key={`tag-${i}`}
              title={tag} 
              className="surface-muted inline-flex items-center shrink truncate rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-md transition-all duration-300 group-hover:border-red-400/30 group-hover:bg-red-500/15 group-hover:text-red-400 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/** 渲染带标题和可选查看全部链接的横向媒体列表；支持桌面端悬浮平滑翻页。没有条目时不输出内容。 */
export default function MediaRow({
  title,
  items,
  viewAllLink,
  type,
  eagerCount = 0,
}: {
  title: string;
  items: MediaCard[];
  viewAllLink?: string;
  type?: "movies" | "series";
  eagerCount?: number;
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
  }, [items]);

  /** 平滑翻动横向列表约 75% 容器宽度。 */
  const handleScroll = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const offset = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="group/row relative">
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/10 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {title}
        </h2>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-sm text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] transition-all duration-300 uppercase tracking-wider">
            查看全部 &rarr;
          </Link>
        )}
      </div>

      {/* 桌面端左翻页按钮 */}
      <button
        type="button"
        onClick={() => handleScroll("left")}
        aria-label={`向左滚动 ${title}`}
        disabled={!canScrollLeft}
        className={`surface-panel absolute -left-3 top-1/2 -translate-y-1/2 z-20 hidden lg:flex size-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-all duration-300 hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-300 hover:scale-110 active:scale-95 hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] ${
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
        aria-label={`向右滚动 ${title}`}
        disabled={!canScrollRight}
        className={`surface-panel absolute -right-3 top-1/2 -translate-y-1/2 z-20 hidden lg:flex size-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition-all duration-300 hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-300 hover:scale-110 active:scale-95 hover:shadow-[0_0_16px_rgba(239,68,68,0.4)] ${
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
        className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto scroll-px-1 px-1 pb-12 pt-4 scroll-smooth"
      >
        {items.map(/* 决定卡片详情路由类型，并按索引设置首批图片的加载优先级。 */ (media: MediaCard, index: number) => {
          const mediaType = type ?? media.type ?? "movies";
          return (
            <Link
              href={`/${mediaType}/${media.id}`}
              key={media.id}
              className="surface-card interactive-media-card group flex w-36 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl last:snap-end sm:w-44"
            >
              <ItemCard item={media} type={mediaType} eager={index < eagerCount} highPriority={eagerCount > 0 && index === 0} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
