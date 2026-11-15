"use client";

import type { SearchFilters } from "@/lib/api/search-state";
import { changeSearchYear } from "@/components/search/search-filters";

/** 起止年份。两端都空时「全部」为选中；倒置范围由 changeSearchYear 拉齐。 */
export default function SearchYearFilter({
  year,
  yearOptions,
  setFilters,
}: {
  year: readonly string[] | undefined;
  yearOptions: string[];
  setFilters: (update: SearchFilters | ((previous: SearchFilters) => SearchFilters)) => void;
}) {
  const allYears = !year?.length || (year[0] === "" && year[1] === "");

  return (
    <div className="flex flex-col items-start gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-0">
      <span className="text-fg-muted text-sm font-medium w-16 shrink-0 tracking-wider">
        年份
      </span>
      <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
        <button
          aria-pressed={!year?.some(Boolean)}
          onClick={/* 清除起止年份。 */ () => {
            setFilters(/* 清除年份筛选。 */ (prev) => ({ ...prev, year: [] }));
          }}
          className={`min-h-10 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
            allYears
              ? "filter-option-active"
              : "filter-option"
          }`}
        >
          全部
        </button>

        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
          <div className="relative group">
            <select
              aria-label="开始年份"
              value={year?.[0] || ""}
              onChange={(e) => setFilters((prev) => changeSearchYear(prev, "start", e.target.value))}
              className={`min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg py-1.5 pl-3 pr-8 text-[13px] backdrop-blur-2xl transition-all sm:min-w-25 ${
                year?.[0]
                  ? "filter-option-active font-semibold"
                  : "filter-option"
              }`}
            >
              <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">开始年份</option>
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
              ))}
            </select>
            <span className={`i-material-symbols-expand-more-rounded absolute right-3 top-1/2 inline-block size-3 -translate-y-1/2 pointer-events-none transition-colors ${
              year?.[0] ? "text-current opacity-90" : "text-fg-subtle group-hover:text-white"
            }`} aria-hidden="true" />
          </div>

          <span className="text-fg-muted text-[13px] font-medium px-1">至</span>

          <div className="relative group">
            <select
              aria-label="结束年份"
              value={year?.[1] || ""}
              onChange={(e) => setFilters((prev) => changeSearchYear(prev, "end", e.target.value))}
              className={`min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg py-1.5 pl-3 pr-8 text-[13px] backdrop-blur-2xl transition-all sm:min-w-25 ${
                year?.[1]
                  ? "filter-option-active font-semibold"
                  : "filter-option"
              }`}
            >
              <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">最终年份</option>
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
              ))}
            </select>
            <span className={`i-material-symbols-expand-more-rounded absolute right-3 top-1/2 inline-block size-3 -translate-y-1/2 pointer-events-none transition-colors ${
              year?.[1] ? "text-current opacity-90" : "text-fg-subtle group-hover:text-white"
            }`} aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
