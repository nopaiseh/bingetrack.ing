"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaCard } from "@/lib/types";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";
import { edgeFadeMask } from "@/lib/edge-fade-mask";

/** 展示卡片海报，并按参数控制图片加载优先级。标题和标签交给共用的卡片正文。 */
function ItemCard({ item, type, eager, highPriority, hideStatusBadge }: { item: MediaCard; type: "movies" | "shows"; eager: boolean; highPriority: boolean; hideStatusBadge?: boolean }) {
  return (
    <>
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 639px) 160px, 192px"
            priority={highPriority}
            loading={highPriority ? undefined : eager ? "eager" : "lazy"}
          />
        ) : (
          <span className="i-material-symbols-image-outline-rounded inline-block size-10 text-fg-faint drop-shadow-md" aria-hidden="true" />
        )}
        {!hideStatusBadge && <MediaCardStatusBadge status={item.status} />}
      </div>
      <MediaCardBody item={item} type={type} />
    </>
  );
}

/** 渲染带标题和可选查看全部链接的横向媒体列表。还能滚动时始终显示翻页按钮和边缘渐隐。没有条目时不输出内容。 */
export default function MediaRow({
  title,
  items,
  viewAllLink,
  type,
  eagerCount = 0,
  hideStatusBadge = false,
}: {
  title: string;
  items: MediaCard[];
  viewAllLink?: string;
  type?: "movies" | "shows";
  eagerCount?: number;
  hideStatusBadge?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    /** 检查当前横向滚动条位置，更新翻页按钮和边缘渐隐。 */
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

  /** 平滑翻动横向列表约 75% 容器宽度。 */
  const handleScroll = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const offset = direction === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/10 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white">
          {title}
        </h2>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-sm text-fg-secondary hover:text-[var(--accent-hover)] transition-all duration-300 uppercase tracking-wider">
            查看全部 &rarr;
          </Link>
        )}
      </div>

      <div className="relative">
      {/* 翻页按钮盖在海报中线，还能滚动时一直可见，不只在悬停时出现。 */}
      <button
        type="button"
        onClick={() => handleScroll("left")}
        aria-label={`向左滚动 ${title}`}
        disabled={!canScrollLeft}
        className={`surface-panel absolute left-0 top-[8.5rem] z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95 sm:top-[10rem] ${
          canScrollLeft ? "flex" : "hidden"
        }`}
      >
        <span className="i-material-symbols-chevron-left-rounded relative z-2 inline-block size-6" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => handleScroll("right")}
        aria-label={`向右滚动 ${title}`}
        disabled={!canScrollRight}
        className={`surface-panel absolute right-0 top-[8.5rem] z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95 sm:top-[10rem] ${
          canScrollRight ? "flex" : "hidden"
        }`}
      >
        <span className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6" aria-hidden="true" />
      </button>

      {/* 左右滚动边缘渐隐：遮罩只作用于列表本身，淡出后透出背后的主题底色。 */}
      <div
        ref={scrollerRef}
        style={edgeFadeMask(canScrollLeft, canScrollRight, "3rem")}
        className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto scroll-px-1 px-1 pb-12 pt-4 scroll-smooth"
      >
        {items.map(/* 决定卡片详情路由类型，并按索引设置首批图片的加载优先级。 */ (media: MediaCard, index: number) => {
          const mediaType = type ?? media.type ?? "movies";
          return (
            <Link
              href={`/${mediaType}/${media.id}`}
              key={media.id}
              className="surface-card interactive-media-card group flex w-40 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl last:snap-end sm:w-48"
            >
              <ItemCard item={media} type={mediaType} eager={index < eagerCount} highPriority={eagerCount > 0 && index === 0} hideStatusBadge={hideStatusBadge} />
            </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}
