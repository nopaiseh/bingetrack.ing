"use client";

import type { RefObject } from "react";
import FilterOptionRow from "@/components/search/FilterOptionRow";
import SearchYearFilter from "@/components/search/SearchYearFilter";
import { toggleSearchFilter, toggleSearchSort } from "@/components/search/search-filters";
import { PRIMARY_CATEGORIES, SORT_OPTIONS } from "@/components/search/search-model";
import type { SearchFilters } from "@/lib/api/search-state";

/** 分类、状态、排序，以及可折叠的类型、地区、语言和年份。 */
export default function SearchFilterPanel({
  filters,
  setFilters,
  advancedVisible,
  genreOptions,
  regionOptions,
  languageOptions,
  yearOptions,
  panelRef,
}: {
  filters: SearchFilters;
  setFilters: (update: SearchFilters | ((previous: SearchFilters) => SearchFilters)) => void;
  advancedVisible: boolean;
  genreOptions: string[];
  regionOptions: string[];
  languageOptions: string[];
  yearOptions: string[];
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const advancedCategories = [
    { id: "genre", label: "类型", options: genreOptions },
    { id: "region", label: "地区", options: regionOptions },
    { id: "language", label: "语言", options: languageOptions },
  ];

  return (
    <div id="search-filter-panel" ref={panelRef} className="surface-panel mt-4 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col">
        {PRIMARY_CATEGORIES.map(
          /* 为每个主要分类渲染选项。 */ (category) => (
            <FilterOptionRow
              key={category.id}
              label={category.label}
              options={category.options}
              selected={filters[category.id] || []}
              onClear={() =>
                setFilters((prev) =>
                  toggleSearchFilter(
                    prev,
                    category.id,
                    "全部",
                    category.multiSelect,
                    category.options.map((option) => option.value),
                  ),
                )
              }
              onToggle={(value) =>
                setFilters((prev) =>
                  toggleSearchFilter(
                    prev,
                    category.id,
                    value,
                    category.multiSelect,
                    category.options.map((option) => option.value),
                  ),
                )
              }
            />
          ),
        )}

        <div
          className={`flex flex-col items-start gap-3 py-3.5 sm:flex-row sm:gap-0 ${advancedVisible ? "border-b border-white/10" : ""}`}
        >
          <span className="text-fg-muted text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider">排序</span>
          <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
            {SORT_OPTIONS.map(
              /* 渲染排序按钮。 */ (option) => {
                const currentSort = filters.sort?.[0] || "date_desc";
                const [currentField, currentOrder] = currentSort.split("_");
                const isSelected = currentField === option.id;

                return (
                  <button
                    key={option.id}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected ? `${option.label}，${currentOrder === "desc" ? "降序" : "升序"}` : option.label
                    }
                    onClick={/* 切换排序方向。 */ () => setFilters((prev) => toggleSearchSort(prev, option.id))}
                    className={`group flex min-h-10 items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
                      isSelected ? "filter-option-active" : "filter-option"
                    }`}
                  >
                    {option.label}
                    {isSelected &&
                      (currentOrder === "desc" ? (
                        <span
                          className="i-material-symbols-arrow-downward-rounded inline-block size-3"
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className="i-material-symbols-arrow-upward-rounded inline-block size-3"
                          aria-hidden="true"
                        />
                      ))}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {advancedVisible && (
          <div id="search-filters" className="flex flex-col origin-top animate-in slide-in-from-top-2 fade-in">
            {advancedCategories.map(
              /* 渲染高级分类选项。 */ (category) => (
                <FilterOptionRow
                  key={category.id}
                  label={category.label}
                  options={category.options.map((option) => ({ value: option, label: option }))}
                  selected={filters[category.id] || []}
                  onClear={() =>
                    setFilters((prev) => toggleSearchFilter(prev, category.id, "全部", true, category.options))
                  }
                  onToggle={(value) =>
                    setFilters((prev) => toggleSearchFilter(prev, category.id, value, true, category.options))
                  }
                />
              ),
            )}
            <SearchYearFilter year={filters.year} yearOptions={yearOptions} setFilters={setFilters} />
          </div>
        )}
      </div>
    </div>
  );
}
