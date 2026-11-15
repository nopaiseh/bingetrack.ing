"use client";

import type { RefObject } from "react";

/** 搜索词输入框和筛选开关。输入框与按钮同一行，放不下时由 .search-bar-row 换行。 */
export default function SearchBar({
  query,
  onQueryChange,
  onClearQuery,
  inputRef,
  inputTooLong,
  maxLength,
  showAdvanced,
  hasActiveAdvancedFilters,
  onToggleAdvanced,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  inputTooLong: boolean;
  maxLength: number;
  showAdvanced: boolean;
  hasActiveAdvancedFilters: boolean;
  onToggleAdvanced: () => void;
}) {
  return (
    <div className="search-bar-row group relative">
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-5">
          <span className="i-material-symbols-search-rounded inline-block size-4 text-fg-subtle transition-all duration-300 group-focus-within:text-white" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          aria-label="搜索媒体"
          aria-describedby={inputTooLong ? "search-query-limit" : undefined}
          aria-invalid={inputTooLong}
          value={query}
          onChange={/* 将搜索输入框内容写入本地输入状态。 */ (e) => {
            onQueryChange(e.target.value);
          }}
          placeholder="搜索电影、电视节目、导演或演员..."
          className="search-bar-control surface-control relative z-0 w-full border border-[var(--accent-border)] py-4 pl-12 pr-12 text-base text-white outline-none transition-all duration-300 placeholder:text-fg-subtle"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3">
          {query && (
            <button
              type="button"
              onClick={/* 清空搜索词，后续由防抖逻辑同步到 URL。 */ onClearQuery}
              className="pointer-events-auto text-fg-subtle transition-all duration-300 hover:text-[var(--accent-hover)]"
              aria-label="清除搜索"
            >
              <span className="i-material-symbols-close-rounded inline-block size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {inputTooLong && (
          <div id="search-query-limit" role="tooltip" className="absolute left-0 top-full z-20 mt-2 rounded-lg border border-red-400/30 bg-neutral-900 px-3 py-2 text-sm text-red-200 shadow-lg">
            搜索词最多 {maxLength} 个字符，请缩短后再搜索。
          </div>
        )}
      </div>
      <button
        type="button"
        aria-expanded={showAdvanced}
        aria-controls="search-filters"
        onClick={/* 展开类型、地区、语言和年份。分类、状态和排序始终可见。 */ onToggleAdvanced}
        className={`search-bar-control inline-flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium ${
          showAdvanced || hasActiveAdvancedFilters ? "filter-option-active" : "filter-option"
        }`}
      >
        <span className="i-material-symbols-tune-rounded inline-block size-4" aria-hidden="true" />
        {showAdvanced ? "收起筛选" : "筛选"}
      </button>
    </div>
  );
}
