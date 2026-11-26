"use client";

import Image from "next/image";
import { MediaCard } from "@/lib/types";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import HorizontalMediaScroller, {
  HORIZONTAL_MEDIA_CARD_CLASS,
  HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER,
  HORIZONTAL_MEDIA_SCROLL_BTN_TOP_SQUARE,
} from "@/components/HorizontalMediaScroller";
import LetterTile from "./LetterTile";
import MediaCardBody from "./MediaCardBody";
import MediaCardStatusBadge from "./MediaCardStatusBadge";
import MusicCardBody from "./MusicCardBody";
import { isDbMediaType, publicPathForDbType, type DbMediaType } from "@/lib/media-types";
import { ALBUM_ROW_COVER_SIZES } from "@/lib/poster-image-sizes";

/** 横向媒体行支持的数据库类型（影视／图书 2:3；专辑 1:1）。 */
type RowDbMediaType = Extract<DbMediaType, "movie" | "tv_show" | "book" | "album">;

const ROW_DB_TYPES = new Set<RowDbMediaType>(["movie", "tv_show", "book", "album"]);

/**
 * 单卡优先认 item.dbType：专辑／影视／图书直接返回；
 * 已识别但不属于横滑行的库类型（如 music 单曲）返回 null，禁止回落到行级 type
 *（否则专辑行里的单曲会被链到 /albums/{曲目 id}）。
 * 缺库类型时才回落行级 type。
 */
export function resolveRowDbType(item: MediaCard, rowType?: RowDbMediaType): RowDbMediaType | null {
  if (item.dbType && isDbMediaType(item.dbType)) {
    if (ROW_DB_TYPES.has(item.dbType as RowDbMediaType)) {
      return item.dbType as RowDbMediaType;
    }
    return null;
  }
  return rowType ?? null;
}

/**
 * 有整数系列序号时返回「第 N 部」文案；缺省／非整数不编造序号。
 * 供 MediaRow 角标与单测共用。
 */
export function formatSeriesPositionLabel(position: number | null | undefined): string | null {
  if (position == null || !Number.isInteger(position) || position < 0) return null;
  return `第${position}部`;
}

/** 封面左上角系列序号角标；文案本身可读，不依赖颜色表意。 */
function SeriesPositionBadge({ position }: { position: number | null | undefined }) {
  const label = formatSeriesPositionLabel(position);
  if (!label) return null;
  return (
    <span
      data-testid="media-card-series-position"
      className="pointer-events-none absolute top-2 left-2 z-10 inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--canvas)] px-2 py-1 text-xs font-medium text-fg-muted"
      aria-label={`系列${label}`}
    >
      {label}
    </span>
  );
}

/** 专辑方封面；正文与搜索音乐卡共用 MusicCardBody（年、评分、类型；无「专辑」角标）。 */
function AlbumItemCard({
  item,
  eager,
  preload,
  hideStatusBadge,
  showSeriesPosition,
}: {
  item: MediaCard;
  eager: boolean;
  preload: boolean;
  hideStatusBadge?: boolean;
  showSeriesPosition?: boolean;
}) {
  const title = item.title.trim() || "未命名专辑";

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
        {showSeriesPosition ? <SeriesPositionBadge position={item.seriesPosition} /> : null}
        {!hideStatusBadge && <MediaCardStatusBadge status={item.status} kind="listen" />}
      </div>
      <MusicCardBody item={{ ...item, title }} headingLevel={3} artistFallback="dash" />
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
  showSeriesPosition,
}: {
  item: MediaCard;
  dbType: Exclude<RowDbMediaType, "album">;
  eager: boolean;
  preload: boolean;
  hideStatusBadge?: boolean;
  showSeriesPosition?: boolean;
}) {
  const bodyDbType = dbType === "tv_show" ? "tv_show" : dbType === "book" ? "book" : "movie";
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
        {showSeriesPosition ? <SeriesPositionBadge position={item.seriesPosition} /> : null}
        {!hideStatusBadge && <MediaCardStatusBadge status={item.status} kind={dbType === "book" ? "book" : "watch"} />}
      </div>
      <MediaCardBody item={item} dbType={bodyDbType} />
    </>
  );
}

/** 渲染带标题和可选查看全部链接的横向媒体列表。没有条目时不输出内容。 */
export default function MediaRow({
  title,
  items,
  viewAllLink,
  type,
  eagerCount = 0,
  hideStatusBadge = false,
  showSeriesPosition = false,
}: {
  title: string;
  items: readonly MediaCard[];
  viewAllLink?: string;
  /** 行级数据库类型；单卡优先用 item.dbType，缺省时回落到此。 */
  type?: RowDbMediaType;
  eagerCount?: number;
  hideStatusBadge?: boolean;
  /**
   * 为 true 时在封面左上角显示「第 N 部」（读 item.seriesPosition）。
   * 缺省关闭，其它目录行不受影响；字段缺失时不显示角标。
   */
  showSeriesPosition?: boolean;
}) {
  const squareRow = type === "album" || items.some((item) => resolveRowDbType(item, type) === "album");

  if (!items || items.length === 0) return null;

  return (
    <HorizontalMediaScroller
      title={title}
      viewAllLink={viewAllLink}
      scrollButtonTopClass={
        squareRow ? HORIZONTAL_MEDIA_SCROLL_BTN_TOP_SQUARE : HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER
      }
      measureKey={items.length}
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
                className={HORIZONTAL_MEDIA_CARD_CLASS}
                aria-label={artist ? `${albumTitle}，${artist}` : albumTitle}
              >
                <AlbumItemCard
                  item={media}
                  eager={eager}
                  preload={preload}
                  hideStatusBadge={hideStatusBadge}
                  showSeriesPosition={showSeriesPosition}
                />
              </HoverPrefetchLink>
            );
          }
          return (
            <HoverPrefetchLink href={href} key={media.id} className={HORIZONTAL_MEDIA_CARD_CLASS}>
              <PosterItemCard
                item={media}
                dbType={dbType}
                eager={eager}
                preload={preload}
                hideStatusBadge={hideStatusBadge}
                showSeriesPosition={showSeriesPosition}
              />
            </HoverPrefetchLink>
          );
        },
      )}
    </HorizontalMediaScroller>
  );
}
