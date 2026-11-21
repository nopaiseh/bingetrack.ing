"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { MediaCard } from "@/lib/types";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import LetterTile from "./LetterTile";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";
import MediaRatingBadge from "./MediaRatingBadge";
import { edgeFadeMask } from "@/lib/edge-fade-mask";
import { scrollBehavior } from "@/lib/scroll-behavior";
import { isDbMediaType, publicPathForDbType, type DbMediaType } from "@/lib/media-types";
import { ALBUM_ROW_COVER_SIZES } from "@/lib/poster-image-sizes";

/** 横向媒体行支持的数据库类型（影视／图书 2:3；专辑 1:1）。 */
type RowDbMediaType = Extract<DbMediaType, "movie" | "tv_show" | "book" | "album">;

function resolveRowDbType(item: MediaCard, rowType?: RowDbMediaType): RowDbMediaType | null {
  if (item.dbType && isDbMediaType(item.dbType)) {
    if (item.dbType === "movie" || item.dbType === "tv_show" || item.dbType === "book" || item.dbType === "album") {
      return item.dbType;
    }
  }
  return rowType ?? null;
}

/** 专辑方封面：评分叠在封面上，正文只保留标题与主艺人。 */
function AlbumItemCard({
  item,
  eager,
  preload,
  hideStatusBadge,
}: {
  item: MediaCard;
  eager: boolean;
  preload: boolean;
  hideStatusBadge?: boolean;
}) {
  const title = item.title.trim() || "未命名专辑";
  const artist = (item.artists ?? []).filter(Boolean)[0] ?? null;

  return (
    <>
      <div className="image-placeholder relative flex aspect-square w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes={ALBUM_ROW_COVER_SIZES}
            preload={preload}
            fetchPriority={preload ? "high" : undefined}
            loading={preload ? undefined : eager ? "eager" : "lazy"}
          />
        ) : (
          <LetterTile title={title} decorative />
        )}
        {!hideStatusBadge && <MediaCardStatusBadge status={item.status} kind="watch" />}
        {item.rating != null ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10">
            <MediaRatingBadge rating={item.rating} size="sm" showTier={false} />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 grow flex-col gap-1 px-3 py-2.5">
        <h3
          className="font-display line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
          title={title}
        >
          {title}
        </h3>
        {artist ? (
          <p className="truncate text-xs text-fg-muted" title={artist}>
            {artist}
          </p>
        ) : (
          <p className="truncate text-xs text-fg-subtle">—</p>
        )}
      </div>
    </>
  );
}

/** 展示卡片海报，并按参数控制图片加载优先级。标题和标签交给共用的卡片正文。 */
function PosterItemCard({
  item,
  dbType,
  eager,
  preload,
  hideStatusBadge,
}: {
  item: MediaCard;
  dbType: Exclude<RowDbMediaType, "album">;
  eager: boolean;
  preload: boolean;
  hideStatusBadge?: boolean;
}) {
  const bodyDbType = dbType === "tv_show" ? "tv_show" : "movie";
  return (
    <>
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 639px) 160px, 192px"
            preload={preload}
            fetchPriority={preload ? "high" : undefined}
            loading={preload ? undefined : eager ? "eager" : "lazy"}
          />
        ) : (
          <LetterTile title={item.title} decorative />
        )}
        {!hideStatusBadge && <MediaCardStatusBadge status={item.status} kind={dbType === "book" ? "book" : "watch"} />}
      </div>
      <MediaCardBody item={item} dbType={bodyDbType} />
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
  /** 行级数据库类型；单卡优先用 item.dbType，缺省时回落到此。 */
  type?: RowDbMediaType;
  eagerCount?: number;
  hideStatusBadge?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const squareRow = type === "album" || items.some((item) => resolveRowDbType(item, type) === "album");
  const scrollButtonTopClass = squareRow ? "top-[6rem] sm:top-[7rem]" : "top-[8.5rem] sm:top-[10rem]";

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
    el.scrollBy({ left: offset, behavior: scrollBehavior() });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/10 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white">{title}</h2>
        {viewAllLink && (
          <HoverPrefetchLink
            href={viewAllLink}
            className="focus-ring rounded-sm text-sm text-fg-secondary uppercase tracking-wider transition-all duration-300 hover:text-[var(--accent-hover)]"
          >
            查看全部 &rarr;
          </HoverPrefetchLink>
        )}
      </div>

      <div className="relative">
        {/* 翻页按钮盖在封面中线，还能滚动时一直可见，不只在悬停时出现。 */}
        <button
          type="button"
          onClick={() => handleScroll("left")}
          aria-label={`向左滚动 ${title}`}
          disabled={!canScrollLeft}
          className={`surface-panel focus-ring absolute left-0 z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95 ${scrollButtonTopClass} ${
            canScrollLeft ? "flex" : "hidden"
          }`}
        >
          <span
            className="i-material-symbols-chevron-left-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => handleScroll("right")}
          aria-label={`向右滚动 ${title}`}
          disabled={!canScrollRight}
          className={`surface-panel focus-ring absolute right-0 z-20 size-10 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-colors duration-200 hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95 ${scrollButtonTopClass} ${
            canScrollRight ? "flex" : "hidden"
          }`}
        >
          <span
            className="i-material-symbols-chevron-right-rounded relative z-2 inline-block size-6"
            aria-hidden="true"
          />
        </button>

        {/* 左右滚动边缘渐隐：遮罩只作用于列表本身，淡出后透出背后的主题底色。 */}
        <div
          ref={scrollerRef}
          style={edgeFadeMask(canScrollLeft, canScrollRight, "3rem")}
          className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto scroll-px-1 px-1 pb-12 pt-4 motion-safe:scroll-smooth"
        >
          {items.map(
            /* 由数据库类型映射详情路径，并按索引设置首批图片的加载优先级。 */ (media: MediaCard, index: number) => {
              const dbType = resolveRowDbType(media, type);
              if (!dbType) return null;
              const href = publicPathForDbType(dbType, media.id);
              if (!href) return null;
              const eager = index < eagerCount;
              const preload = eagerCount > 0 && index === 0;
              if (dbType === "album") {
                const albumTitle = media.title.trim() || "未命名专辑";
                const artist = (media.artists ?? []).filter(Boolean)[0];
                return (
                  <HoverPrefetchLink
                    href={href}
                    key={media.id}
                    className="surface-card interactive-media-card group flex w-40 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl focus-ring last:snap-end sm:w-48"
                    aria-label={artist ? `${albumTitle}，${artist}` : albumTitle}
                  >
                    <AlbumItemCard item={media} eager={eager} preload={preload} hideStatusBadge={hideStatusBadge} />
                  </HoverPrefetchLink>
                );
              }
              return (
                <HoverPrefetchLink
                  href={href}
                  key={media.id}
                  className="surface-card interactive-media-card group flex w-40 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl focus-ring last:snap-end sm:w-48"
                >
                  <PosterItemCard
                    item={media}
                    dbType={dbType}
                    eager={eager}
                    preload={preload}
                    hideStatusBadge={hideStatusBadge}
                  />
                </HoverPrefetchLink>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
