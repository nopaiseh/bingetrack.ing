"use client";

import { SearchMediaCard, SearchMediaCardSkeleton } from "@/components/SearchMediaCard";
import SearchEmptyState from "@/components/search/SearchEmptyState";
import { sortCaption } from "@/components/search/search-model";
import { PAGE_SIZE, type SearchFilters } from "@/lib/api/search-state";
import { SEARCH_ABOVE_FOLD_COUNT } from "@/lib/poster-image-sizes";
import type { MediaCard } from "@/lib/types";
import { pageNumbers } from "@/lib/pagination";

/** 结果说明、错误、卡片网格和分页。加载中且尚无卡片时铺满占位。 */
export default function SearchResultSection({
  filters,
  mediaItems,
  total,
  page,
  totalPages,
  isLoading,
  requestError,
  queryTooLong,
  rangeLabel,
  returnHref,
  canResetSearch,
  urlQuery,
  onRetry,
  onReset,
  onSuggest,
  onPage,
}: {
  filters: SearchFilters;
  mediaItems: MediaCard[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  requestError: string | null;
  queryTooLong: boolean;
  rangeLabel: string | null;
  returnHref: string;
  canResetSearch: boolean;
  urlQuery: string;
  onRetry: () => void;
  onReset: () => void;
  onSuggest: (partial: Partial<Pick<SearchFilters, "type" | "status">>) => void;
  onPage: (page: number) => void;
}) {
  return (
    <>
      {(mediaItems.length > 0 || (isLoading && !requestError)) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-sm text-fg-muted">
          <p>{sortCaption(filters.sort?.[0] || "date_desc")}</p>
          {rangeLabel ? <p className="font-mono">{rangeLabel}</p> : null}
        </div>
      )}

      {requestError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {requestError}
          {!queryTooLong && (
            <button
              type="button"
              className="ml-3 underline underline-offset-4"
              onClick={/* 清除已完成的查询键，重新请求当前搜索条件。 */ onRetry}
            >
              重试
            </button>
          )}
        </div>
      )}

      <div
        className={`relative grid grid-cols-2 items-start gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:gap-x-5 lg:grid-cols-4 xl:grid-cols-6 ${
          isLoading && mediaItems.length === 0 ? "min-h-128" : ""
        }`}
        aria-busy={isLoading}
      >
        {isLoading && mediaItems.length === 0 ? (
          [...Array(PAGE_SIZE)].map(
            /* 为首轮搜索加载生成一张占位卡片。 */ (_, i) => <SearchMediaCardSkeleton key={`loading-initial-${i}`} />,
          )
        ) : requestError ? null : mediaItems.length > 0 ? (
          mediaItems.map(
            /* 首屏 preload／eager；其余 defer 到接近视口再设 src。 */ (item, index) => (
              <SearchMediaCard
                key={`${item.type}-${item.id}`}
                item={item}
                returnHref={returnHref}
                preload={index === 0}
                eager={index < SEARCH_ABOVE_FOLD_COUNT}
                deferPoster={index >= SEARCH_ABOVE_FOLD_COUNT}
              />
            ),
          )
        ) : total === 0 ? (
          <SearchEmptyState query={urlQuery} canReset={canResetSearch} onReset={onReset} onSuggest={onSuggest} />
        ) : null}
      </div>

      {totalPages > 1 && !isLoading && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="搜索结果分页">
          <button
            onClick={/* 返回上一页搜索结果。 */ () => onPage(page - 1)}
            disabled={page === 1}
            className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white disabled:pointer-events-none disabled:opacity-30"
            aria-label="上一页"
          >
            <span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" />
          </button>
          {pageNumbers(page, totalPages).map(
            /* 将页码窗口中的一页渲染为分页按钮。 */ (pageNumber) => (
              <button
                key={pageNumber}
                onClick={/* 跳转到点击的结果页。 */ () => onPage(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
                className={`min-w-10 rounded-xl px-3 py-2 text-center text-sm transition-all ${pageNumber === page ? "filter-option-active shadow-md" : "surface-muted border border-white/10 text-fg-secondary hover:bg-white/10 hover:text-white"}`}
              >
                {pageNumber}
              </button>
            ),
          )}
          <button
            onClick={/* 前往下一页搜索结果。 */ () => onPage(page + 1)}
            disabled={page === totalPages}
            className="surface-control rounded-xl p-2.5 text-fg-secondary transition-all hover:text-white disabled:pointer-events-none disabled:opacity-30"
            aria-label="下一页"
          >
            <span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}
