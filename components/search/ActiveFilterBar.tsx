"use client";

import FilterChip from "@/components/search/FilterChip";
import { toggleSearchFilter } from "@/components/search/search-filters";
import { optionLabel, STATUS_OPTIONS, TYPE_OPTIONS } from "@/components/search/search-model";
import type { SearchFilters } from "@/lib/api/search-state";

/** 已选条件标签。排序不在这里出现；清空时保留当前排序。 */
export default function ActiveFilterBar({
  filters,
  setFilters,
  genreOptions,
  regionOptions,
  languageOptions,
}: {
  filters: SearchFilters;
  setFilters: (update: SearchFilters | ((previous: SearchFilters) => SearchFilters)) => void;
  genreOptions: string[];
  regionOptions: string[];
  languageOptions: string[];
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-xl">
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-fg-subtle mr-1">
        <span className="i-material-symbols-filter-alt-outline-rounded size-3.5 inline-block text-[var(--accent)]" aria-hidden="true" />
        已选条件:
      </span>

      {filters.type?.map((t) => (
        <FilterChip key={`chip-type-${t}`} category="分类" label={optionLabel(TYPE_OPTIONS, t)} accent onRemove={() => setFilters((prev) => toggleSearchFilter(prev, "type", t, true, TYPE_OPTIONS.map((option) => option.value)))} />
      ))}
      {filters.status?.map((s) => (
        <FilterChip key={`chip-status-${s}`} category="状态" label={optionLabel(STATUS_OPTIONS, s)} accent onRemove={() => setFilters((prev) => toggleSearchFilter(prev, "status", s, true, STATUS_OPTIONS.map((option) => option.value)))} />
      ))}
      {filters.genre?.map((g) => (
        <FilterChip key={`chip-genre-${g}`} category="类型" label={g} onRemove={() => setFilters((prev) => toggleSearchFilter(prev, "genre", g, true, genreOptions))} />
      ))}
      {filters.region?.map((r) => (
        <FilterChip key={`chip-region-${r}`} category="地区" label={r} onRemove={() => setFilters((prev) => toggleSearchFilter(prev, "region", r, true, regionOptions))} />
      ))}
      {filters.language?.map((l) => (
        <FilterChip key={`chip-language-${l}`} category="语言" label={l} onRemove={() => setFilters((prev) => toggleSearchFilter(prev, "language", l, true, languageOptions))} />
      ))}

      {filters.year?.some(Boolean) && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white shadow-xs"
        >
          <span className="text-fg-muted">年份:</span>
          <span>
            {filters.year[0] && filters.year[1]
              ? `${filters.year[0]} - ${filters.year[1]}`
              : filters.year[0]
                ? `${filters.year[0]} 年起`
                : `截至 ${filters.year[1]} 年`}
          </span>
          <button
            type="button"
            aria-label="清除年份筛选"
            onClick={() => setFilters((prev) => ({ ...prev, year: [] }))}
            className="ml-0.5 rounded p-0.5 text-fg-secondary hover:bg-white/15 hover:text-white transition-colors"
          >
            <span className="i-material-symbols-close-rounded size-3 inline-block" aria-hidden="true" />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => setFilters({ type: [], status: [], genre: [], region: [], language: [], year: [], sort: filters.sort || ["date_desc"] })}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-fg-secondary transition-colors hover:text-fg cursor-pointer"
      >
        <span className="i-material-symbols-restart-alt-rounded size-3.5 inline-block" aria-hidden="true" />
        清空筛选
      </button>
    </div>
  );
}
