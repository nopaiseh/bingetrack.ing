"use client";

import type { SearchFilters } from "@/lib/api/search-state";

/** 无结果时给出说明、对比度足够的清除按钮，以及电影 / 电视节目 / 即将上映三个起步方向。 */
export default function SearchEmptyState({
  query,
  canReset,
  onReset,
  onSuggest,
}: {
  query: string;
  canReset: boolean;
  onReset: () => void;
  onSuggest: (partial: Partial<Pick<SearchFilters, "type" | "status">>) => void;
}) {
  return (
    <div className="col-span-full flex flex-col items-center px-4 py-16 text-center sm:py-24" role="status">
      <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-fg-secondary">
        <span className="i-material-symbols-search-rounded inline-block size-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-semibold text-fg">没有匹配的作品</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-secondary">
        {query
          ? "没有与这个关键词匹配的电影、电视节目或人物。可以换一个词，或清除目前的筛选后再试。"
          : "没有作品符合当前筛选。可以放宽条件，或从下面的方向开始。"}
      </p>
      {canReset && (
        <button
          type="button"
          onClick={onReset}
          className="button-accent mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          <span className="i-material-symbols-filter-alt-off-rounded inline-block size-4" aria-hidden="true" />
          清除筛选
        </button>
      )}
      <div className="mt-8">
        <p className="text-sm text-fg-muted">试试这些</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onSuggest({ type: ["movie"] })}
            className="filter-option min-h-10 rounded-full px-4 py-1.5 text-sm"
          >
            电影
          </button>
          <button
            type="button"
            onClick={() => onSuggest({ type: ["tv_show"] })}
            className="filter-option min-h-10 rounded-full px-4 py-1.5 text-sm"
          >
            电视节目
          </button>
          <button
            type="button"
            onClick={() => onSuggest({ status: ["upcoming"] })}
            className="filter-option min-h-10 rounded-full px-4 py-1.5 text-sm"
          >
            即将上映
          </button>
        </div>
      </div>
    </div>
  );
}
