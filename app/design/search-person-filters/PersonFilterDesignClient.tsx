"use client";

import { useMemo, useState } from "react";
import FilterOptionRow from "@/components/search/FilterOptionRow";
import { toggleSearchFilter } from "@/components/search/search-filters";
import type { SearchFilters } from "@/lib/api/search-state";

/** PR #247 之后的媒体／系列分类（示例基准，不含人物）。 */
const MEDIA_OPTIONS = [
  { value: "movie", label: "电影" },
  { value: "tv_show", label: "电视节目" },
  { value: "album", label: "专辑" },
  { value: "music", label: "单曲" },
  { value: "book", label: "图书" },
  { value: "series", label: "系列" },
] as const;

const PERSON_OPTIONS = [
  { value: "director", label: "导演" },
  { value: "actor", label: "演员" },
  { value: "author", label: "作者" },
  { value: "artist", label: "歌手" },
  { value: "lyricist", label: "作词" },
  { value: "composer", label: "作曲" },
] as const;

/** 方案 A：分类行直接追加人物角色芯片。 */
const OPTION_A_TYPE = [...MEDIA_OPTIONS, ...PERSON_OPTIONS];

const STATUS_OPTIONS = [
  { value: "want_to_watch", label: "想看" },
  { value: "watching", label: "在看" },
  { value: "watched", label: "已看" },
  { value: "upcoming", label: "即将上映" },
];

const SORT_OPTIONS = [
  { id: "date", label: "日期" },
  { id: "rating", label: "评分" },
];

type OptionId = "a" | "b" | "c";

const OPTION_META: Record<OptionId, { title: string; summary: string }> = {
  a: {
    title: "方案 A · 分类行追加角色",
    summary: "在现有分类行直接加「作者／歌手／作词／作曲」。芯片最多，390 宽会多行换行。",
  },
  b: {
    title: "方案 B ·「人物」+ 角色子筛选",
    summary: "分类行用一个「人物」代替导演／演员等；选中后出现第二行角色子筛选。",
  },
  c: {
    title: "方案 C · 分类与人物分行（推荐）",
    summary: "分类只保留作品类型；人物角色单独成行，始终可见，与状态／排序视觉一致。",
  },
};

/** 本地预览用筛选面板：复用现有 FilterOptionRow 与表面样式，数据为示例。 */
export default function PersonFilterDesignClient({ option }: { option: OptionId }) {
  // 方案 B 默认勾选「人物」，方便截图时看到角色子行；其余方案从空筛选开始。
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    type: option === "b" ? ["person"] : [],
    person: option === "b" ? ["author"] : [],
    status: [],
    sort: ["date_desc"],
  }));

  const meta = OPTION_META[option];
  const personSelected = filters.type.includes("person");

  const typeOptions = useMemo(() => {
    if (option === "a") return OPTION_A_TYPE.map((item) => ({ ...item }));
    if (option === "b") return [...MEDIA_OPTIONS, { value: "person", label: "人物" }];
    return MEDIA_OPTIONS.map((item) => ({ ...item }));
  }, [option]);

  const typeSelected = useMemo(() => {
    if (option === "b") return filters.type.filter((value) => value === "person" || MEDIA_OPTIONS.some((m) => m.value === value));
    if (option === "c") return filters.type.filter((value) => MEDIA_OPTIONS.some((m) => m.value === value));
    return filters.type;
  }, [filters.type, option]);

  const personRowSelected = option === "c" ? filters.person : filters.person;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 space-y-2">
        <p className="text-fg-muted text-sm tracking-wider">设计预览 · 示例数据 · 不接搜索接口</p>
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{meta.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">{meta.summary}</p>
        <nav className="flex flex-wrap gap-2 pt-2" aria-label="方案切换">
          {(["a", "b", "c"] as const).map((id) => (
            <a
              key={id}
              href={`/design/search-person-filters?option=${id}`}
              className={`min-h-10 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
                option === id ? "filter-option-active" : "filter-option"
              }`}
              aria-current={option === id ? "page" : undefined}
            >
              方案 {id.toUpperCase()}
            </a>
          ))}
        </nav>
      </header>

      <section aria-label="筛选面板示例" data-design-panel={option}>
        <div className="surface-panel rounded-2xl p-4 sm:p-5" id="design-filter-panel">
          <div className="flex flex-col">
            <FilterOptionRow
              label="分类"
              options={typeOptions}
              selected={typeSelected}
              onClear={() =>
                setFilters((prev) => {
                  const cleared = toggleSearchFilter(
                    prev,
                    "type",
                    "全部",
                    true,
                    typeOptions.map((item) => item.value),
                  );
                  if (option === "b") return { ...cleared, person: [] };
                  return cleared;
                })
              }
              onToggle={(value) =>
                setFilters((prev) => {
                  const next = toggleSearchFilter(
                    prev,
                    "type",
                    value,
                    true,
                    typeOptions.map((item) => item.value),
                  );
                  if (option === "b" && value === "person" && next.type.includes("person") === false) {
                    return { ...next, person: [] };
                  }
                  return next;
                })
              }
            />

            {option === "b" && personSelected ? (
              <FilterOptionRow
                label="角色"
                options={PERSON_OPTIONS.map((item) => ({ ...item }))}
                selected={personRowSelected}
                onClear={() =>
                  setFilters((prev) =>
                    toggleSearchFilter(
                      prev,
                      "person",
                      "全部",
                      true,
                      PERSON_OPTIONS.map((item) => item.value),
                    ),
                  )
                }
                onToggle={(value) =>
                  setFilters((prev) =>
                    toggleSearchFilter(
                      prev,
                      "person",
                      value,
                      true,
                      PERSON_OPTIONS.map((item) => item.value),
                    ),
                  )
                }
              />
            ) : null}

            {option === "c" ? (
              <FilterOptionRow
                label="人物"
                options={PERSON_OPTIONS.map((item) => ({ ...item }))}
                selected={personRowSelected}
                onClear={() =>
                  setFilters((prev) =>
                    toggleSearchFilter(
                      prev,
                      "person",
                      "全部",
                      true,
                      PERSON_OPTIONS.map((item) => item.value),
                    ),
                  )
                }
                onToggle={(value) =>
                  setFilters((prev) =>
                    toggleSearchFilter(
                      prev,
                      "person",
                      value,
                      true,
                      PERSON_OPTIONS.map((item) => item.value),
                    ),
                  )
                }
              />
            ) : null}

            <FilterOptionRow
              label="状态"
              options={STATUS_OPTIONS}
              selected={filters.status}
              onClear={() =>
                setFilters((prev) =>
                  toggleSearchFilter(
                    prev,
                    "status",
                    "全部",
                    true,
                    STATUS_OPTIONS.map((item) => item.value),
                  ),
                )
              }
              onToggle={(value) =>
                setFilters((prev) =>
                  toggleSearchFilter(
                    prev,
                    "status",
                    value,
                    true,
                    STATUS_OPTIONS.map((item) => item.value),
                  ),
                )
              }
            />

            <div className="flex flex-col items-start gap-3 py-3.5 sm:flex-row sm:gap-0">
              <span className="text-fg-muted mt-1.5 w-16 shrink-0 text-sm font-medium tracking-wider">排序</span>
              <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                {SORT_OPTIONS.map((item) => {
                  const current = filters.sort?.[0] || "date_desc";
                  const [field, order] = current.split("_");
                  const selected = field === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      className={`group flex min-h-10 items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all duration-300 backdrop-blur-2xl ${
                        selected ? "filter-option-active" : "filter-option"
                      }`}
                      onClick={() =>
                        setFilters((prev) => {
                          if (selected) {
                            const nextOrder = order === "desc" ? "asc" : "desc";
                            return { ...prev, sort: [`${item.id}_${nextOrder}`] };
                          }
                          return { ...prev, sort: [`${item.id}_desc`] };
                        })
                      }
                    >
                      {item.label}
                      {selected ? (
                        <span
                          className={`inline-block size-3 ${
                            order === "desc"
                              ? "i-material-symbols-arrow-downward-rounded"
                              : "i-material-symbols-arrow-upward-rounded"
                          }`}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-4 text-xs leading-5 text-fg-subtle">
        说明：本页仅演示筛选芯片布局与交互；搜索结果区未渲染。方案 B 已预选「人物」以便截图显示角色子行——若未显示，点一次「人物」。
      </p>
    </main>
  );
}
